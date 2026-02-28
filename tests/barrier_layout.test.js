import test from 'node:test';
import assert from 'node:assert/strict';

import { selectBarrierGateIds } from '../assets/sim/barrier_layout.js';

test('prefers non-turret gate candidates near the barrier', function () {
    var gateIds = selectBarrierGateIds({
        barrierX: 800,
        targetGateCount: 1,
        minVerticalGap: 120,
        nodes: [
            { id: 0, owner: -1, kind: 'turret', pos: { x: 798, y: 240 } },
            { id: 1, owner: -1, kind: 'core', pos: { x: 802, y: 260 } },
            { id: 2, owner: -1, kind: 'relay', pos: { x: 850, y: 520 } },
        ],
    });
    assert.deepEqual(gateIds, [1]);
});

test('falls back to turret candidates when no normal neutral node exists', function () {
    var gateIds = selectBarrierGateIds({
        barrierX: 800,
        targetGateCount: 1,
        minVerticalGap: 120,
        nodes: [
            { id: 0, owner: -1, kind: 'turret', pos: { x: 790, y: 200 } },
            { id: 1, owner: 0, kind: 'core', pos: { x: 240, y: 200 } },
        ],
    });
    assert.deepEqual(gateIds, [0]);
});

test('spreads multiple gates vertically when possible', function () {
    var gateIds = selectBarrierGateIds({
        barrierX: 800,
        targetGateCount: 2,
        minVerticalGap: 120,
        nodes: [
            { id: 0, owner: -1, kind: 'core', pos: { x: 801, y: 220 } },
            { id: 1, owner: -1, kind: 'core', pos: { x: 805, y: 280 } },
            { id: 2, owner: -1, kind: 'core', pos: { x: 810, y: 470 } },
        ],
    });
    assert.deepEqual(gateIds, [0, 2]);
});
