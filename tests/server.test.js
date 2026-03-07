import test from 'node:test';
import assert from 'node:assert/strict';

import {
    rooms,
    socketToRoom,
    leaderboard,
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
} from '../server.js';

function resetServerState() {
    rooms.clear();
    socketToRoom.clear();
    leaderboard.length = 0;
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
