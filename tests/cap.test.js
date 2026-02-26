import test from 'node:test';
import assert from 'node:assert/strict';

import { computePlayerUnitCount, computeGlobalCap } from '../assets/sim/cap.js';

test('computePlayerUnitCount sums node and active fleet units for a player', function () {
    var total = computePlayerUnitCount({
        owner: 0,
        nodes: [
            { owner: 0, units: 12.9 },
            { owner: 1, units: 50 },
            { owner: 0, units: 7.1 },
        ],
        fleets: [
            { owner: 0, count: 9, active: true },
            { owner: 0, count: 4, active: false },
            { owner: 1, count: 12, active: true },
        ],
    });

    assert.equal(total, 28);
});

test('computeGlobalCap scales with owned node count', function () {
    var cap = computeGlobalCap({
        owner: 1,
        baseCap: 180,
        capPerNodeFactor: 42,
        nodes: [
            { owner: 1 },
            { owner: 1 },
            { owner: 0 },
            { owner: 1 },
        ],
    });

    assert.equal(cap, 306);
});
