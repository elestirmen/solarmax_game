import test from 'node:test';
import assert from 'node:assert/strict';

import { controlsBarrierForOwner, isDispatchAllowed } from '../assets/sim/barrier.js';

function mkNodes() {
    return [
        { id: 0, pos: { x: 200, y: 100 }, owner: 0 },
        { id: 1, pos: { x: 1200, y: 100 }, owner: 1 },
        { id: 2, pos: { x: 800, y: 300 }, owner: -1, kind: 'gate', gate: true, assimilationProgress: 1, assimilationLock: 0 },
    ];
}

test('blocks cross-barrier dispatch without controlled gate', function () {
    var nodes = mkNodes();
    var allowed = isDispatchAllowed({
        src: nodes[0],
        tgt: nodes[1],
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    });
    assert.equal(allowed, false);
});

test('allows cross-barrier dispatch when owner controls assimilated gate', function () {
    var nodes = mkNodes();
    nodes[2].owner = 0;
    var allowed = isDispatchAllowed({
        src: nodes[0],
        tgt: nodes[1],
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    });
    assert.equal(allowed, true);
});

test('allows dispatch on same side of barrier', function () {
    var nodes = mkNodes();
    nodes[1].pos.x = 300;
    var allowed = isDispatchAllowed({
        src: nodes[0],
        tgt: nodes[1],
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    });
    assert.equal(allowed, true);
});

test('allows dispatch to enemy gate across barrier so it can be contested', function () {
    var nodes = mkNodes();
    nodes[2].owner = 1;
    var allowed = isDispatchAllowed({
        src: nodes[0],
        tgt: nodes[2],
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    });
    assert.equal(allowed, true);
});

test('controlsBarrierForOwner requires an assimilated controlled gate', function () {
    var nodes = mkNodes();
    assert.equal(controlsBarrierForOwner({
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    }), false);

    nodes[2].owner = 0;
    nodes[2].assimilationProgress = 0.4;
    assert.equal(controlsBarrierForOwner({
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    }), false);

    nodes[2].assimilationProgress = 1;
    assert.equal(controlsBarrierForOwner({
        barrier: { type: 'barrier', x: 800, gateIds: [2] },
        owner: 0,
        nodes: nodes,
    }), true);
});
