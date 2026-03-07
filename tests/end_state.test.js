import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMatchEndState } from '../assets/sim/end_state.js';

test('resolveMatchEndState marks winner when one player has assets left', function () {
    var result = resolveMatchEndState({
        players: [{ alive: true }, { alive: true }, { alive: true }],
        nodes: [{ owner: 0 }, { owner: 0 }],
        fleets: [{ owner: 0, active: true }],
    });

    assert.deepEqual(result.playersAlive, [true, false, false]);
    assert.deepEqual(result.aliveIndices, [0]);
    assert.equal(result.winnerIndex, 0);
    assert.equal(result.gameOver, true);
});

test('resolveMatchEndState returns draw when nobody is alive', function () {
    var result = resolveMatchEndState({
        players: [{ alive: true }, { alive: true }],
        nodes: [],
        fleets: [],
    });

    assert.equal(result.winnerIndex, -1);
    assert.equal(result.gameOver, true);
});

test('resolveMatchEndState preserves eliminated players as dead', function () {
    var result = resolveMatchEndState({
        players: [{ alive: false }, { alive: true }],
        nodes: [{ owner: 0 }, { owner: 1 }],
        fleets: [],
    });

    assert.deepEqual(result.playersAlive, [false, true]);
    assert.equal(result.gameOver, true);
    assert.equal(result.winnerIndex, 1);
});
