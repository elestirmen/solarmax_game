import test from 'node:test';
import assert from 'node:assert/strict';

import { SIM_CONSTANTS } from '../assets/sim/shared_config.js';
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

test('captureAuthoritativeSnapshot preserves objective metadata for sync clients', function () {
    var state = buildAuthoritativeState(baseSnapshot(), {
        manifest: {
            seed: 'sim-seed',
            difficulty: 'normal',
            rulesMode: 'advanced',
            fogEnabled: false,
            objectives: [{ type: 'owned_nodes', target: 3 }],
            missionScript: {
                phases: [
                    {
                        id: 'alpha',
                        objectives: [{ type: 'owned_nodes', target: 3 }],
                    },
                ],
            },
            endOnObjectives: true,
        },
    });
    var snapshot = captureAuthoritativeSnapshot(state);

    assert.deepEqual(snapshot.objectives, [{ type: 'owned_nodes', target: 3 }]);
    assert.equal(snapshot.missionScript.phases[0].id, 'alpha');
    assert.equal(snapshot.missionState.phaseIndex, 0);
    assert.equal(snapshot.endOnObjectives, true);
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

test('applyCommandToAuthoritativeState adds deterministic launch variance for repeated route sends', function () {
    var state = buildAuthoritativeState(baseSnapshot(), {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    applyCommandToAuthoritativeState(state, 0, 'send', {
        sources: [0],
        tgtId: 1,
        pct: 0.5,
    });
    applyCommandToAuthoritativeState(state, 0, 'send', {
        sources: [0],
        tgtId: 1,
        pct: 0.5,
    });

    assert.equal(state.fleets.length, 2);
    assert.equal(state.fleets[0].id, 1);
    assert.equal(state.fleets[1].id, 2);
    assert.equal(state.fleets[0].spdVar >= 0.97 && state.fleets[0].spdVar <= 1.03, true);
    assert.equal(state.fleets[1].spdVar >= 0.97 && state.fleets[1].spdVar <= 1.03, true);
    assert.equal(state.fleets[0].trailScale >= 0.9, true);
    assert.equal(state.fleets[1].trailScale >= 0.9, true);
    assert.equal(state.fleets[0].turnRate > 4.8, true);
    assert.equal(state.fleets[0].throttleBias >= 0.94, true);
    assert.equal(state.fleets[0].lookAhead >= 0.016, true);
    assert.equal(Math.abs(Math.sqrt(state.fleets[0].headingX * state.fleets[0].headingX + state.fleets[0].headingY * state.fleets[0].headingY) - 1) < 0.0001, true);
    assert.equal(state.fleets[1].t < state.fleets[0].t, true);
    assert.notEqual(state.fleets[0].offsetL, state.fleets[1].offsetL);
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

test('simulateAuthoritativeTick keeps turret beam visuals in authoritative snapshots', function () {
    var snapshot = baseSnapshot();
    snapshot.nodes = [
        { id: 0, pos: { x: 0, y: 0 }, radius: 24, owner: 0, units: 12, level: 1, kind: 'turret', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        { id: 1, pos: { x: 240, y: 0 }, radius: 24, owner: 1, units: 18, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
    ];
    snapshot.fleets = [
        { active: true, owner: 1, count: 10, srcId: 1, tgtId: 0, t: 0, speed: 0, arcLen: 1, cpx: 0, cpy: 0, x: 30, y: 0, trail: [], offsetL: 0, spdVar: 1, routeSpeedMult: 1, dmgAcc: 0.6, launchT: 0 },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    simulateAuthoritativeTick(state);
    var authoritativeSnapshot = captureAuthoritativeSnapshot(state);

    assert.equal(state.turretBeams.length > 0, true);
    assert.equal(authoritativeSnapshot.turretBeams.length > 0, true);
    assert.equal(authoritativeSnapshot.turretBeams[0].owner, 0);
    assert.equal(authoritativeSnapshot.shockwaves.length > 0, true);
});

test('simulateAuthoritativeTick decays unsupplied holding fleets after the grace period', function () {
    var snapshot = baseSnapshot();
    snapshot.fleets = [
        {
            id: 1,
            active: true,
            holding: true,
            owner: 0,
            count: 10,
            holdUnsuppliedTicks: 0,
            srcId: -1,
            tgtId: -1,
            fromX: 420,
            fromY: 0,
            toX: 420,
            toY: 0,
            cpx: 420,
            cpy: 0,
            x: 420,
            y: 0,
            trail: [],
        },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    for (var i = 0; i < SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS + SIM_CONSTANTS.HOLD_DECAY_INTERVAL_TICKS; i++) {
        simulateAuthoritativeTick(state);
    }

    assert.equal(state.fleets[0].count, 9);
    assert.equal(state.fleets[0].holdUnsuppliedTicks > SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS, true);
});

test('simulateAuthoritativeTick keeps supplied holding fleets stable', function () {
    var snapshot = baseSnapshot();
    snapshot.fleets = [
        {
            id: 1,
            active: true,
            holding: true,
            owner: 0,
            count: 10,
            holdUnsuppliedTicks: 0,
            srcId: -1,
            tgtId: -1,
            fromX: 0,
            fromY: 120,
            toX: 0,
            toY: 120,
            cpx: 0,
            cpy: 120,
            x: 0,
            y: 120,
            trail: [],
        },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    for (var i = 0; i < SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS + SIM_CONSTANTS.HOLD_DECAY_INTERVAL_TICKS; i++) {
        simulateAuthoritativeTick(state);
    }

    assert.equal(state.fleets[0].count, 10);
    assert.equal(state.fleets[0].holdUnsuppliedTicks, 0);
});

test('simulateAuthoritativeTick lets blackout zones disable holding fleet territory protection', function () {
    var snapshot = baseSnapshot();
    snapshot.mapMutator = { type: 'blackout', x: 0, y: 120, r: 120 };
    snapshot.fleets = [
        {
            id: 1,
            active: true,
            holding: true,
            owner: 0,
            count: 10,
            holdUnsuppliedTicks: 0,
            srcId: -1,
            tgtId: -1,
            fromX: 0,
            fromY: 120,
            toX: 0,
            toY: 120,
            cpx: 0,
            cpy: 120,
            x: 0,
            y: 120,
            trail: [],
        },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: { seed: 'sim-seed', difficulty: 'normal', rulesMode: 'advanced', fogEnabled: false },
    });

    for (var i = 0; i < SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS + SIM_CONSTANTS.HOLD_DECAY_INTERVAL_TICKS; i++) {
        simulateAuthoritativeTick(state);
    }

    assert.equal(state.fleets[0].count, 9);
    assert.equal(state.fleets[0].holdUnsuppliedTicks > SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS, true);
});

test('simulateAuthoritativeTick ends encounter missions when required objectives are complete', function () {
    var snapshot = baseSnapshot();
    snapshot.nodes = [
        { id: 0, pos: { x: 0, y: 0 }, radius: 24, owner: 0, units: 30, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        { id: 1, pos: { x: 120, y: 0 }, radius: 24, owner: 0, units: 16, level: 1, kind: 'relay', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        { id: 2, pos: { x: 240, y: 0 }, radius: 24, owner: 1, units: 16, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
    ];
    var state = buildAuthoritativeState(snapshot, {
        manifest: {
            seed: 'sim-seed',
            difficulty: 'normal',
            rulesMode: 'advanced',
            fogEnabled: false,
            encounters: [{ id: 'relay-a', type: 'relay_core', nodeId: 1 }],
            objectives: [{ type: 'encounter_captured', target: 1, encounterId: 'relay-a' }],
            endOnObjectives: true,
        },
    });

    simulateAuthoritativeTick(state);

    assert.equal(state.state, 'gameOver');
    assert.equal(state.winner, 0);
});

test('simulateAuthoritativeTick keeps scripted mission failures from being overwritten by elimination logic', function () {
    var snapshot = {
        tick: 0,
        winner: -1,
        state: 'playing',
        players: [
            { idx: 0, alive: true, isAI: false, color: '#4a8eff' },
        ],
        nodes: [
            { id: 0, pos: { x: 0, y: 0 }, radius: 24, owner: 0, units: 18, level: 1, kind: 'core', prodAcc: 0, defense: false, assimilationProgress: 1, assimilationLock: 0 },
        ],
        fleets: [],
        flows: [],
        wormholes: [],
        mapFeature: { type: 'none' },
        playerCapital: {},
        strategicNodes: [],
        aiTicks: [0],
        aiProfiles: [],
        flowId: 0,
        fleetSerial: 0,
    };
    var state = buildAuthoritativeState(snapshot, {
        manifest: {
            seed: 'sim-seed',
            difficulty: 'normal',
            rulesMode: 'advanced',
            fogEnabled: false,
            missionScript: {
                phases: [
                    {
                        id: 'fail-fast',
                        objectives: [{ id: 'hold-two', type: 'owned_nodes', target: 2 }],
                        lossConditions: [{ type: 'tick_limit', target: 0, message: 'Misyon zamaninda kirildi.' }],
                    },
                ],
            },
            endOnObjectives: true,
        },
    });

    simulateAuthoritativeTick(state);

    assert.equal(state.state, 'gameOver');
    assert.equal(state.winner, -1);
    assert.equal(state.missionFailureText, 'Misyon zamaninda kirildi.');
});
