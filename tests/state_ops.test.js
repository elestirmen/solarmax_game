import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchUnits } from '../assets/sim/state_ops.js';

function makeState() {
    return {
        seed: 42,
        humanIndex: 0,
        fleetSerial: 0,
        fleets: [],
        flows: [],
        wormholes: [],
        mapFeature: { type: 'none' },
        strategicPulse: { active: false, nodeId: -1 },
        stats: { fleetsSent: 0, wormholeDispatches: 0 },
        nodes: [
            { id: 0, owner: 0, units: 40, maxUnits: 40, radius: 18, level: 1, kind: 'core', pos: { x: 0, y: 0 } },
            { id: 1, owner: 0, units: 12, maxUnits: 24, radius: 18, level: 1, kind: 'core', pos: { x: 120, y: 0 } },
            { id: 2, owner: 1, units: 20, maxUnits: 24, radius: 18, level: 1, kind: 'core', pos: { x: 240, y: 0 } },
        ],
    };
}

test('dispatchUnits can send from nodes to an empty-space point', function () {
    var state = makeState();

    dispatchUnits(state, 0, {
        sources: [0],
        fleetIds: [],
        targetPoint: { x: 80, y: 60 },
        pct: 0.5,
    });

    assert.equal(state.fleets.length, 1);
    assert.equal(state.fleets[0].tgtId, -1);
    assert.equal(state.fleets[0].toX, 80);
    assert.equal(state.fleets[0].toY, 60);
    assert.equal(state.fleets[0].holding, false);
    assert.equal(state.nodes[0].units < 40, true);
});

test('dispatchUnits can relaunch a holding fleet toward a node', function () {
    var state = makeState();
    state.fleets.push({
        id: 9,
        active: true,
        holding: true,
        owner: 0,
        count: 18,
        srcId: -1,
        tgtId: -1,
        x: 70,
        y: 40,
        fromX: 70,
        fromY: 40,
        toX: 70,
        toY: 40,
        trail: [],
    });

    dispatchUnits(state, 0, {
        sources: [],
        fleetIds: [9],
        tgtId: 2,
        pct: 0.5,
    });

    assert.equal(state.fleets.length, 2);
    assert.equal(state.fleets[0].count, 9);
    assert.equal(state.fleets[0].holding, true);
    assert.equal(state.fleets[1].srcId, -1);
    assert.equal(state.fleets[1].tgtId, 2);
    assert.equal(state.fleets[1].fromX, 70);
    assert.equal(state.fleets[1].fromY, 40);
});
