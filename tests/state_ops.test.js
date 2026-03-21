import test from 'node:test';
import assert from 'node:assert/strict';

import { SIM_CONSTANTS } from '../assets/sim/shared_config.js';
import { dispatchUnits, upgradeStateNode } from '../assets/sim/state_ops.js';

function makeState() {
    return {
        seed: 42,
        tick: 0,
        humanIndex: 0,
        rules: { allowUpgrade: true },
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

test('upgradeStateNode starts a timed upgrade instead of applying instantly', function () {
    var state = makeState();
    state.tick = 12;
    state.nodes[0].maxUnits = 200;
    state.nodes[0].units = 140;

    assert.equal(upgradeStateNode(state, 0, 0), true);
    assert.equal(state.nodes[0].level, 1);
    assert.equal(state.nodes[0].upgradeTargetLevel, 2);
    assert.equal(state.nodes[0].upgradeStartTick, 12);
    assert.equal(state.nodes[0].upgradeCompleteTick, 12 + SIM_CONSTANTS.UPGRADE_DURATION_TICKS);
    assert.equal(upgradeStateNode(state, 0, 0), false);
});
