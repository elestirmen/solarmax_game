import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMenuHeroSummary,
    buildMenuLobbyMeta,
    createInitialMenuState,
    menuBackTarget,
    normalizeMenuPanel,
} from '../assets/ui/menu_state.js';

test('createInitialMenuState normalizes skirmish and multiplayer values', function () {
    var state = createInitialMenuState({
        panel: 'quick_start',
        skirmish: {
            seed: '',
            nodeCount: 999,
            difficulty: 'broken',
            playlist: '',
            doctrineId: '',
            rulesMode: 'classic',
            fogEnabled: 1,
        },
        multiplayer: {
            playerName: '  Commander  ',
            joinCode: ' ab12c ',
            roomType: 'daily',
        },
    });

    assert.equal(state.panel, 'hub');
    assert.equal(state.skirmish.seed, '42');
    assert.equal(state.skirmish.nodeCount, 30);
    assert.equal(state.skirmish.difficulty, 'normal');
    assert.equal(state.skirmish.playlist, 'standard');
    assert.equal(state.skirmish.doctrineId, 'auto');
    assert.equal(state.multiplayer.playerName, 'Commander');
    assert.equal(state.multiplayer.joinCode, 'AB12C');
    assert.equal(state.multiplayer.roomType, 'daily');
});

test('buildMenuHeroSummary returns readable landing labels', function () {
    var summary = buildMenuHeroSummary({
        seed: '77',
        nodeCount: 18,
        difficulty: 'hard',
        playlist: 'frontier',
        doctrineId: 'auto',
        rulesMode: 'advanced',
        fogEnabled: true,
    });

    assert.equal(summary.seedChip, 'Seed 77');
    assert.equal(summary.playlistChip, 'Frontier');
    assert.match(summary.quickStatus, /18 node/);
    assert.match(summary.quickStatus, /Zor/);
    assert.equal(summary.modeChip, 'Gelişmiş');
    assert.equal(summary.fogChip, 'Sis Açık');
});

test('menu helpers expose stable panel routing and lobby summaries', function () {
    assert.equal(normalizeMenuPanel('missing'), 'hub');
    assert.equal(menuBackTarget('host_setup'), 'multiplayer');
    assert.equal(buildMenuLobbyMeta({ connected: false }), 'Sunucuya bağlanılıyor');
    assert.equal(buildMenuLobbyMeta({ connected: true, roomCount: 3 }), '3 aktif oda tarandı');
    assert.equal(buildMenuLobbyMeta({ roomCode: 'abc12' }), 'Canlı oda // ABC12');
});
