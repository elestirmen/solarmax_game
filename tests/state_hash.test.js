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

test('computeSyncHash changes when a parked fleet route changes', function () {
    var baseState = {
        tick: 18,
        players: [{ alive: true, isAI: false }],
        nodes: [],
        fleets: [
            { active: true, holding: true, owner: 0, srcId: -1, tgtId: -1, count: 9, t: 0, x: 60, y: 40, fromX: 60, fromY: 40, toX: 60, toY: 40, cpx: 60, cpy: 40 },
        ],
    };
    var variant = {
        tick: 18,
        players: [{ alive: true, isAI: false }],
        nodes: [],
        fleets: [
            { active: true, holding: true, owner: 0, srcId: -1, tgtId: -1, count: 9, t: 0, x: 60, y: 40, fromX: 90, fromY: 40, toX: 90, toY: 40, cpx: 90, cpy: 40 },
        ],
    };

    assert.notEqual(computeSyncHash(baseState), computeSyncHash(variant));
});

test('computeSyncHash changes when a parked fleet decay state changes', function () {
    var baseState = {
        tick: 18,
        players: [{ alive: true, isAI: false }],
        nodes: [],
        fleets: [
            { active: true, holding: true, owner: 0, srcId: -1, tgtId: -1, count: 9, holdUnsuppliedTicks: 0, t: 0, x: 60, y: 40, fromX: 60, fromY: 40, toX: 60, toY: 40, cpx: 60, cpy: 40 },
        ],
    };
    var variant = {
        tick: 18,
        players: [{ alive: true, isAI: false }],
        nodes: [],
        fleets: [
            { active: true, holding: true, owner: 0, srcId: -1, tgtId: -1, count: 9, holdUnsuppliedTicks: 30, t: 0, x: 60, y: 40, fromX: 60, fromY: 40, toX: 60, toY: 40, cpx: 60, cpy: 40 },
        ],
    };

    assert.notEqual(computeSyncHash(baseState), computeSyncHash(variant));
});
