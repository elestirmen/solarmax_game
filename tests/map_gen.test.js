import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialMatchSnapshot } from '../assets/sim/map_gen.js';

test('buildInitialMatchSnapshot is deterministic for the same manifest and player roster', function () {
    var manifest = {
        seed: 'server-map-seed',
        nodeCount: 18,
        difficulty: 'normal',
        rulesMode: 'advanced',
        mapFeature: 'barrier',
    };
    var players = [
        { index: 0, name: 'Host', botControlled: false },
        { index: 1, name: 'Guest', botControlled: false },
        { index: 2, name: 'AI 1', botControlled: true },
    ];

    var a = buildInitialMatchSnapshot(manifest, players);
    var b = buildInitialMatchSnapshot(manifest, players);

    assert.deepEqual(a, b);
});

test('buildInitialMatchSnapshot assigns a capital to every player and preserves AI flags', function () {
    var manifest = {
        seed: 'capital-check',
        nodeCount: 16,
        difficulty: 'easy',
        rulesMode: 'advanced',
        mapFeature: 'wormhole',
    };
    var players = [
        { index: 0, name: 'Host', botControlled: false },
        { index: 1, name: 'Guest', botControlled: false },
        { index: 2, name: 'AI 1', botControlled: true },
    ];

    var snapshot = buildInitialMatchSnapshot(manifest, players);
    var capitalIds = Object.values(snapshot.playerCapital).sort(function (a, b) { return a - b; });
    var owners = snapshot.nodes
        .filter(function (node) { return node.owner >= 0; })
        .map(function (node) { return node.owner; })
        .sort(function (a, b) { return a - b; });

    assert.equal(capitalIds.length, players.length);
    assert.deepEqual(owners, [0, 1, 2]);
    assert.deepEqual(
        snapshot.players.map(function (player) { return player.isAI; }),
        [false, false, true]
    );
    assert.equal(snapshot.mapFeature.type, 'wormhole');
});
