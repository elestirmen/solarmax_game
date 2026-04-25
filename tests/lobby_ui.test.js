import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLobbyListStatus, buildRoomStatusSummary, getLobbyControlState } from '../assets/ui/lobby_ui.js';

test('getLobbyControlState hides browse controls once inside a room', function () {
    var state = getLobbyControlState({
        inRoom: true,
        connected: true,
        isHost: true,
        playerCount: 2,
    });

    assert.equal(state.disablePlayerName, true);
    assert.equal(state.startDisabled, false);
    assert.equal(state.showRoomList, false);
    assert.equal(state.showHostControls, true);
    assert.equal(state.showLeaveRoom, true);
});

test('buildLobbyListStatus returns clear empty and populated states', function () {
    assert.equal(buildLobbyListStatus({ connected: false }), 'Sunucuya bağlanılıyor...');
    assert.match(buildLobbyListStatus({ connected: true, roomCount: 0 }), /Henüz oda yok/);
    assert.equal(buildLobbyListStatus({ connected: true, roomCount: 4 }), '4 oda mevcut. Birine katıl veya yeni oda kur.');
});

test('buildRoomStatusSummary reflects preview type and readiness', function () {
    var daily = buildRoomStatusSummary({
        code: 'QWERT',
        maxPlayers: 4,
        preview: {
            mode: 'daily',
            challengeTitle: 'Signal Break',
            challengeKey: '2026-03-17',
            aiCount: 2,
        },
    }, {
        playerCount: 2,
        isHost: false,
    });
    var custom = buildRoomStatusSummary({
        code: 'ABCDE',
        maxPlayers: 3,
        preview: {
            mode: 'custom',
            customMapName: 'Nebula Run',
            playerCount: 3,
            aiCount: 1,
        },
    }, {
        playerCount: 1,
        isHost: true,
    });

    assert.match(daily, /Günlük: Signal Break \(2026-03-17\)/);
    assert.match(daily, /Hostun başlatması bekleniyor/);
    assert.match(custom, /Özel: Nebula Run/);
    assert.match(custom, /En az 2 oyuncu gerekli/);
});
