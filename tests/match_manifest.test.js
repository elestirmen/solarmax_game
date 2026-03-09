import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_MATCH_CONFIG,
    buildDailyMatchManifest,
    buildRoomMatchManifest,
    normalizeRoomConfig,
} from '../assets/sim/match_manifest.js';

test('normalizeRoomConfig locks daily rooms to server generated content', function () {
    var config = normalizeRoomConfig({
        mode: 'daily',
        challengeDate: '2026-03-07',
        seed: 'override-me',
        nodeCount: 30,
        difficulty: 'easy',
    }, { defaults: DEFAULT_MATCH_CONFIG, timeZone: 'Europe/Istanbul' });

    assert.equal(config.mode, 'daily');
    assert.equal(config.challengeKey, '2026-03-07');
    assert.equal(config.seed, 'daily-2026-03-07');
    assert.ok(config.mapMutator);
    assert.notEqual(config.nodeCount, 30);
});

test('buildDailyMatchManifest is deterministic for the same date', function () {
    var a = buildDailyMatchManifest('2026-03-07', { defaults: DEFAULT_MATCH_CONFIG, timeZone: 'Europe/Istanbul' });
    var b = buildDailyMatchManifest('2026-03-07', { defaults: DEFAULT_MATCH_CONFIG, timeZone: 'Europe/Istanbul' });

    assert.deepEqual(a, b);
});

test('buildRoomMatchManifest returns standard manifest for standard rooms', function () {
    var manifest = buildRoomMatchManifest({
        config: {
            mode: 'standard',
            seed: 'custom',
            nodeCount: 18,
            difficulty: 'hard',
            fogEnabled: true,
            rulesMode: 'classic',
            aiCount: 2,
            mapFeature: 'barrier',
            mapMutator: 'blackout',
            playlist: 'chaos',
            doctrineId: 'auto',
        },
    }, { defaults: DEFAULT_MATCH_CONFIG, timeZone: 'Europe/Istanbul' });

    assert.equal(manifest.mode, 'standard');
    assert.equal(manifest.seed, 'custom');
    assert.equal(manifest.playlist, 'chaos');
    assert.equal(manifest.playlistLabel, 'Chaos');
    assert.equal(manifest.doctrineId, 'siege');
    assert.equal(Array.isArray(manifest.encounters), true);
    assert.equal(manifest.encounters.length > 0, true);
});

test('buildRoomMatchManifest returns custom manifest with sanitized map metadata', function () {
    var manifest = buildRoomMatchManifest({
        players: [{ index: 0 }, { index: 1 }],
        config: {
            mode: 'custom',
            customMap: {
                name: 'Frontline',
                seed: 'frontline-seed',
                difficulty: 'hard',
                fogEnabled: true,
                rulesMode: 'classic',
                playerCount: 4,
                nodes: [
                    { x: 100, y: 120, owner: 0, units: 20 },
                    { x: 280, y: 240, owner: 1, units: 20 },
                    { x: 500, y: 380, owner: 2, units: 18 },
                    { x: 760, y: 520, owner: 3, units: 18 },
                ],
                mapFeature: { type: 'gravity', nodeId: 2, x: 0, y: 0, r: 180 },
                mapMutator: { type: 'ion_storm', x: 420, y: 340, r: 150, speedMult: 0.7 },
            },
        },
    }, { defaults: DEFAULT_MATCH_CONFIG, timeZone: 'Europe/Istanbul' });

    assert.equal(manifest.mode, 'custom');
    assert.equal(manifest.customMapName, 'Frontline');
    assert.equal(manifest.playerCount, 4);
    assert.equal(manifest.aiCount, 2);
    assert.equal(manifest.mapFeature.type, 'gravity');
    assert.equal(manifest.mapMutator.type, 'ion_storm');
});
