import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyRoomStateNetState,
    beginOnlineMatch,
    buildCreateRoomRequest,
    buildJoinRoomRequest,
    buildOnlineMatchInitOptions,
    buildOnlineMatchStatusText,
    buildRoomStateMenuPatches,
    computeOnlineCommandTick,
    getSocketEndpoint,
    resetOnlineRoomState,
} from '../assets/net/online_session.js';

test('getSocketEndpoint resolves local file and vite dev urls', function () {
    assert.equal(getSocketEndpoint({ protocol: 'file:' }), 'http://127.0.0.1:3000');
    assert.equal(getSocketEndpoint({ protocol: 'http:', hostname: 'localhost', port: '5173' }), 'http://localhost:3000');
    assert.equal(getSocketEndpoint({ protocol: 'https:', hostname: 'game.example', port: '443' }), undefined);
});

test('room request builders normalize custom and join payloads', function () {
    var createPayload = buildCreateRoomRequest({
        playerName: 'Host',
        mode: 'custom',
        customMap: { name: 'Orbit' },
        skirmish: {
            seed: '42',
            nodeCount: 24,
            difficulty: 'hard',
            fogEnabled: true,
            rulesMode: 'classic',
            playlist: 'frontier',
            doctrineId: 'siege',
        },
    });
    var joinPayload = buildJoinRoomRequest({
        playerName: 'Wingman',
        roomCode: 'ab12c',
        reconnectToken: 'resume-token',
    });

    assert.equal(createPayload.mode, 'custom');
    assert.equal(createPayload.customMap.name, 'Orbit');
    assert.equal(createPayload.playlist, 'frontier');
    assert.equal(joinPayload.roomCode, 'AB12C');
    assert.equal(joinPayload.reconnectToken, 'resume-token');
});

test('online room state helpers reset and apply lobby state', function () {
    var net = {
        online: true,
        authoritativeEnabled: true,
        authoritativeReady: true,
        roomCode: 'ABCDE',
        players: [{ index: 0 }],
        isHost: true,
        localPlayerIndex: 1,
        pendingCommands: [{ type: 'send' }],
        matchId: 'match-1',
        lastAppliedSeq: 14,
        syncHashSentTick: 90,
        syncWarningTick: 30,
        syncWarningText: 'warn',
        syncHistory: [1],
        commandHistory: [2],
        resyncRequestId: 'req-1',
        lastSummaryTick: 100,
        lastPingWallMs: 25,
        resumePending: false,
        pendingJoin: true,
    };

    resetOnlineRoomState(net, { preserveResume: true });
    assert.equal(net.online, false);
    assert.equal(net.roomCode, '');
    assert.equal(net.resumePending, true);
    assert.deepEqual(net.players, []);

    applyRoomStateNetState(net, {
        code: 'ZXCVB',
        isHost: false,
        players: [{ index: 0 }, { index: 1 }],
    });
    assert.equal(net.roomCode, 'ZXCVB');
    assert.equal(net.isHost, false);
    assert.equal(net.pendingJoin, false);
    assert.equal(net.players.length, 2);
});

test('buildRoomStateMenuPatches mirrors server room config into menu state', function () {
    var patches = buildRoomStateMenuPatches({
        config: {
            seed: '77',
            nodeCount: 18,
            difficulty: 'easy',
            rulesMode: 'classic',
            playlist: 'frontier',
            doctrineId: 'logistics',
            fogEnabled: true,
            mode: 'daily',
        },
    }, {
        seed: 'fallback',
        nodeCount: 24,
        difficulty: 'normal',
    });

    assert.equal(patches.skirmish.seed, '77');
    assert.equal(patches.skirmish.rulesMode, 'classic');
    assert.equal(patches.skirmish.playlist, 'frontier');
    assert.equal(patches.multiplayer.roomType, 'daily');
});

test('computeOnlineCommandTick clamps latency-derived dispatch delay', function () {
    assert.equal(computeOnlineCommandTick(300, 0), 307);
    assert.equal(computeOnlineCommandTick(300, 10000), 318);
});

test('beginOnlineMatch and init/status helpers derive runtime metadata', function () {
    var net = {};
    var payload = {
        roomCode: 'zqpmn',
        players: [{ index: 0, socketId: 'a' }, { index: 1, socketId: 'b' }],
        matchId: 'match-9',
        authoritative: true,
        fogEnabled: true,
        playlist: 'frontier',
        doctrineId: 'siege',
        encounters: [{ id: 'enc' }],
        objectives: [{ id: 'obj' }],
        endOnObjectives: true,
        challengeTitle: 'Daily Relay',
        mode: 'daily',
    };
    var onlineState = beginOnlineMatch(net, payload, 'b');
    var initOptions = buildOnlineMatchInitOptions(payload, onlineState);
    var statusText = buildOnlineMatchStatusText(payload, net.localPlayerIndex, net.authoritativeEnabled);

    assert.equal(net.online, true);
    assert.equal(net.roomCode, 'ZQPMN');
    assert.equal(net.localPlayerIndex, 1);
    assert.equal(initOptions.localPlayerIndex, 1);
    assert.equal(initOptions.humanCount, 2);
    assert.equal(initOptions.endOnObjectives, true);
    assert.match(statusText, /P2/);
    assert.match(statusText, /Daily Relay/);
});
