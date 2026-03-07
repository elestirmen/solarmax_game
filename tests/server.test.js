import test from 'node:test';
import assert from 'node:assert/strict';

import {
    rooms,
    socketToRoom,
    leaderboard,
    dailyChallengeScores,
    createRoom,
    startRoomMatch,
    cleanupPlayer,
    normalizeWinnerIndex,
    recordMatchResult,
    sanitizePlayerName,
    recordStateHash,
    createSyncSnapshotRequest,
    recordStateSummary,
    commitRoomResult,
    buildRoomMatchManifest,
    buildDailyChallengeLeaderboard,
    getRoomAuthoritativeTick,
    processRoomAuthoritativeTick,
    stopRoomSimulation,
    resumeStartedRoomPlayer,
} from '../server.js';

function resetServerState() {
    for (const room of rooms.values()) {
        stopRoomSimulation(room);
        if (room.resumeExpiryTimer) clearTimeout(room.resumeExpiryTimer);
    }
    rooms.clear();
    socketToRoom.clear();
    leaderboard.length = 0;
    dailyChallengeScores.length = 0;
}

function createStartedRoom() {
    var room = createRoom({ seed: 'disconnect-test' });
    room.hostId = 's0';
    room.players = [
        { socketId: 's0', name: 'Host', index: 0 },
        { socketId: 's1', name: 'Leaver', index: 1 },
        { socketId: 's2', name: 'Closer', index: 2 },
    ];
    socketToRoom.set('s0', room.code);
    socketToRoom.set('s1', room.code);
    socketToRoom.set('s2', room.code);
    startRoomMatch(room);
    stopRoomSimulation(room);
    return room;
}

test('disconnect keeps the original match slot valid for winner resolution', function () {
    resetServerState();
    var room = createStartedRoom();

    cleanupPlayer('s1');

    assert.equal(room.players.length, 2);
    assert.equal(room.matchPlayers.length, 3);
    assert.equal(room.matchPlayers[1].connected, false);
    assert.equal(room.matchPlayers[1].botControlled, true);
    assert.equal(normalizeWinnerIndex(1, room), 1);
});

test('recordMatchResult does not award a win to a disconnected AI takeover slot', function () {
    resetServerState();
    var room = createStartedRoom();

    cleanupPlayer('s1');
    recordMatchResult(room, 1);

    assert.deepEqual(
        leaderboard.map(function (entry) {
            return { name: entry.name, wins: entry.wins, games: entry.games };
        }),
        [
            { name: 'Host', wins: 0, games: 1 },
            { name: 'Closer', wins: 0, games: 1 },
        ]
    );
});

test('sanitizePlayerName strips html brackets and collapses whitespace', function () {
    assert.equal(sanitizePlayerName('  <b> A  B \n\tC </b>  '), 'b A B C /b');
});

test('recordStateHash reports a sync issue when active clients disagree', function () {
    resetServerState();
    var room = createStartedRoom();

    assert.equal(recordStateHash(room, 's0', { matchId: room.matchId, tick: 90, hash: 'aaaaaaaa' }), null);
    assert.equal(recordStateHash(room, 's1', { matchId: room.matchId, tick: 90, hash: 'bbbbbbbb' }), null);

    var issue = recordStateHash(room, 's2', { matchId: room.matchId, tick: 90, hash: 'aaaaaaaa' });

    assert.deepEqual(issue, {
        tick: 90,
        majorityHash: 'aaaaaaaa',
        majorityCount: 2,
        hashCounts: [
            { hash: 'aaaaaaaa', count: 2 },
            { hash: 'bbbbbbbb', count: 1 },
        ],
    });
});

test('createSyncSnapshotRequest targets a majority client after hash disagreement', function () {
    resetServerState();
    var room = createStartedRoom();

    recordStateHash(room, 's0', { matchId: room.matchId, tick: 90, hash: 'aaaaaaaa' });
    recordStateHash(room, 's1', { matchId: room.matchId, tick: 90, hash: 'bbbbbbbb' });
    var issue = recordStateHash(room, 's2', { matchId: room.matchId, tick: 90, hash: 'aaaaaaaa' });

    var request = createSyncSnapshotRequest(room, issue);

    assert.equal(request.tick, 90);
    assert.equal(request.majorityHash, 'aaaaaaaa');
    assert.equal(request.sourceSocketId, 's0');
    assert.match(request.requestId, /^s/);
});

test('recordStateSummary can finalize a winner without explicit reportResult consensus', function () {
    resetServerState();
    var room = createStartedRoom();

    assert.equal(recordStateSummary(room, 's0', { matchId: room.matchId, tick: 420, gameOver: true, aliveIndices: [2] }), null);
    assert.equal(recordStateSummary(room, 's1', { matchId: room.matchId, tick: 426, gameOver: true, aliveIndices: [2] }), null);

    var result = recordStateSummary(room, 's2', { matchId: room.matchId, tick: 430, gameOver: true, aliveIndices: [2] });

    assert.deepEqual(result, { winnerIndex: 2, tick: 430 });

    var confirmed = commitRoomResult(room, 2);

    assert.equal(room.resultCommitted, true);
    assert.deepEqual(confirmed, {
        winnerIndex: 2,
        winnerName: 'Closer',
        draw: false,
    });
});

test('buildRoomMatchManifest derives daily rooms from server-side challenge config', function () {
    resetServerState();
    var room = createRoom({ mode: 'daily', challengeDate: '2026-03-07' });

    var manifest = buildRoomMatchManifest(room);

    assert.equal(manifest.mode, 'daily');
    assert.equal(manifest.challengeKey, '2026-03-07');
    assert.equal(manifest.seed, 'daily-2026-03-07');
    assert.ok(manifest.aiCount >= 1);
    assert.ok(Array.isArray(manifest.objectives));
});

test('commitRoomResult records daily challenge clears for human winners', function () {
    resetServerState();
    var room = createRoom({ mode: 'daily', challengeDate: '2026-03-07' });
    room.hostId = 's0';
    room.players = [
        { socketId: 's0', name: 'Host', index: 0 },
        { socketId: 's1', name: 'Guest', index: 1 },
    ];
    socketToRoom.set('s0', room.code);
    socketToRoom.set('s1', room.code);
    startRoomMatch(room);

    var confirmed = commitRoomResult(room, 1, 840);

    assert.deepEqual(confirmed, {
        winnerIndex: 1,
        winnerName: 'Guest',
        draw: false,
    });
    assert.equal(dailyChallengeScores.length, 1);
    assert.equal(dailyChallengeScores[0].dateKey, room.matchManifest.challengeKey);
    assert.equal(dailyChallengeScores[0].finishTick, 840);

    assert.deepEqual(buildDailyChallengeLeaderboard(room.matchManifest.challengeKey), [
        { name: 'Guest', bestTick: 840, attempts: 1, clears: 1 },
    ]);
});

test('startRoomMatch boots an authoritative server sim and advances queued commands', function () {
    resetServerState();
    var room = createRoom({ seed: 'authoritative-room', aiCount: 0 });
    room.hostId = 's0';
    room.players = [
        { socketId: 's0', name: 'Host', index: 0 },
        { socketId: 's1', name: 'Guest', index: 1 },
    ];
    socketToRoom.set('s0', room.code);
    socketToRoom.set('s1', room.code);
    startRoomMatch(room);
    stopRoomSimulation(room);
    var sourceId = room.serverSim.state.playerCapital[0];
    var targetId = room.serverSim.state.playerCapital[1];

    assert.equal(room.serverSim.ready, true);
    assert.equal(room.serverSnapshotHistory.length > 0, true);
    assert.equal(getRoomAuthoritativeTick(room), 0);

    room.serverCommandQueue.push({
        matchId: room.matchId,
        seq: 0,
        playerIndex: 0,
        tick: 1,
        type: 'send',
        data: { sources: [sourceId], tgtId: targetId, pct: 0.5 },
    });

    processRoomAuthoritativeTick(room);

    assert.equal(getRoomAuthoritativeTick(room), 1);
    assert.equal(room.serverSim.state.fleets.length > 0, true);
    stopRoomSimulation(room);
});

test('started 1v1 room stays resumable after a disconnect and token resume restores the slot', function () {
    resetServerState();
    var room = createRoom({ seed: 'resume-room', aiCount: 0 });
    room.hostId = 's0';
    room.players = [
        { socketId: 's0', name: 'Host', index: 0 },
        { socketId: 's1', name: 'Guest', index: 1 },
    ];
    socketToRoom.set('s0', room.code);
    socketToRoom.set('s1', room.code);
    startRoomMatch(room);
    stopRoomSimulation(room);

    var reconnectToken = room.matchPlayers[1].reconnectToken;
    cleanupPlayer('s1');

    assert.equal(room.started, true);
    assert.equal(room.players.length, 1);
    assert.equal(room.matchPlayers[1].connected, false);
    assert.equal(room.matchPlayers[1].botControlled, true);
    assert.equal(room.serverSim.state.players[1].isAI, true);

    var resumed = resumeStartedRoomPlayer({
        id: 's1b',
        join: function () {},
    }, room, reconnectToken);

    assert.equal(resumed, true);
    assert.equal(room.players.length, 2);
    assert.equal(room.matchPlayers[1].connected, true);
    assert.equal(room.matchPlayers[1].botControlled, false);
    assert.equal(room.matchPlayers[1].socketId, 's1b');
    assert.equal(room.serverSim.state.players[1].isAI, false);
    stopRoomSimulation(room);
});

test('custom rooms derive player cap and authoritative snapshot from uploaded map', function () {
    resetServerState();
    var room = createRoom({
        mode: 'custom',
        customMap: {
            name: 'Bridge',
            seed: 'bridge-seed',
            difficulty: 'hard',
            fogEnabled: true,
            rulesMode: 'classic',
            playerCount: 4,
            nodes: [
                { x: 120, y: 120, owner: 0, units: 24, kind: 'core' },
                { x: 340, y: 220, owner: 1, units: 22, kind: 'relay' },
                { x: 620, y: 400, owner: 2, units: 18, kind: 'core' },
                { x: 860, y: 520, owner: 3, units: 18, kind: 'core' },
            ],
            mapFeature: { type: 'barrier', x: 800, gateIds: [1] },
        },
    });
    room.hostId = 's0';
    room.players = [
        { socketId: 's0', name: 'Host', index: 0 },
        { socketId: 's1', name: 'Guest', index: 1 },
    ];
    socketToRoom.set('s0', room.code);
    socketToRoom.set('s1', room.code);
    startRoomMatch(room);
    stopRoomSimulation(room);

    assert.equal(room.maxPlayers, 4);
    assert.equal(room.matchManifest.mode, 'custom');
    assert.equal(room.matchManifest.customMapName, 'Bridge');
    assert.equal(room.matchManifest.aiCount, 2);
    assert.equal(room.serverSim.state.nodes.length, 4);
    assert.equal(room.serverSim.state.mapFeature.type, 'barrier');
    assert.equal(room.serverSim.state.players.length, 4);
    assert.equal(room.serverSim.state.players[2].isAI, true);
    stopRoomSimulation(room);
});
