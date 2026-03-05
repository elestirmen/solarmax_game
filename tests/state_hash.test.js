import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSyncHash } from '../assets/sim/state_hash.js';

test('computeSyncHash stays stable for the same state', function () {
    var state = {
        tick: 42,
        players: [{ alive: true, isAI: false }, { alive: true, isAI: true }],
        nodes: [
            { id: 0, owner: 0, units: 15.2, level: 2, defense: false, assimilationProgress: 1, assimilationLock: 0 },
            { id: 1, owner: 1, units: 10, level: 1, defense: true, assimilationProgress: 0.4, assimilationLock: 12 },
        ],
        fleets: [
            { active: true, owner: 0, srcId: 0, tgtId: 1, count: 8, t: 0.33, x: 100, y: 120 },
        ],
    };

    assert.equal(computeSyncHash(state), computeSyncHash(state));
});

test('computeSyncHash changes when ownership changes', function () {
    var baseState = {
        tick: 12,
        players: [{ alive: true, isAI: false }],
        nodes: [{ id: 0, owner: 0, units: 10, level: 1, defense: false }],
        fleets: [],
    };
    var variant = {
        tick: 12,
        players: [{ alive: true, isAI: false }],
        nodes: [{ id: 0, owner: 1, units: 10, level: 1, defense: false }],
        fleets: [],
    };

    assert.notEqual(computeSyncHash(baseState), computeSyncHash(variant));
});
