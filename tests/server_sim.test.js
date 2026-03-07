import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyCommandToAuthoritativeState,
    buildAuthoritativeState,
    captureAuthoritativeSnapshot,
    computeAuthoritativeSnapshotHash,
    simulateAuthoritativeTick,
} from '../assets/sim/server_sim.js';

function baseSnapshot() {
    return {
        tick: 0,
        winner: -1,
        state: 'playing',
        players: [
            { idx: 0, alive: true, isAI: false, color: '#4a8eff' },
            { idx: 1, alive: true, isAI: false, color: '#e74c3c' },
        ],
        nodes: [
            { id: 0, pos: { x: 0, y: 0 }, radius: 24, owner: 0, units: 30, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
            { id: 1, pos: { x: 120, y: 0 }, radius: 24, owner: 1, units: 12, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        ],
        fleets: [],
        flows: [],
        wormholes: [],
        mapFeature: { type: 'none' },
        playerCapital: {},
        strategicNodes: [],
        aiTicks: [0, 0],
        aiProfiles: [],
        flowId: 0,
        fleetSerial: 0,
    };
}

test('buildAuthoritativeState normalizes snapshot and capture stays hashable', function () {
    var state = buildAuthoritativeState(baseSnapshot(), {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });
    var snapshot = captureAuthoritativeSnapshot(state);

    assert.equal(state.seed > 0, true);
    assert.equal(state.nodes[0].maxUnits > 0, true);
    assert.equal(snapshot.players.length, 2);
    assert.match(computeAuthoritativeSnapshotHash(state), /^[a-f0-9]{8,32}$/);
});

test('applyCommandToAuthoritativeState dispatches a fleet for send commands', function () {
    var state = buildAuthoritativeState(baseSnapshot(), {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    var applied = applyCommandToAuthoritativeState(state, 0, 'send', {
        sources: [0],
        tgtId: 1,
        pct: 0.5,
    });

    assert.equal(applied, true);
    assert.equal(state.fleets.length, 1);
    assert.equal(state.fleets[0].owner, 0);
    assert.equal(state.nodes[0].units < 30, true);
});

test('simulateAuthoritativeTick advances state and resolves game over when only one player has assets', function () {
    var snapshot = baseSnapshot();
    snapshot.players[1].alive = false;
    snapshot.nodes = [
        { id: 0, pos: { x: 0, y: 0 }, radius: 24, owner: 0, units: 20, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    simulateAuthoritativeTick(state);

    assert.equal(state.tick, 1);
    assert.equal(state.state, 'gameOver');
    assert.equal(state.winner, 0);
});
