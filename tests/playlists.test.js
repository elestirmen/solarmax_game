import test from 'node:test';
import assert from 'node:assert/strict';

import { playlistName, resolvePlaylistConfig } from '../assets/sim/playlists.js';

test('resolvePlaylistConfig applies frontier defaults when selected', function () {
    var resolved = resolvePlaylistConfig({
        seed: '42',
        nodeCount: 16,
        difficulty: 'normal',
        fogEnabled: false,
        rulesMode: 'advanced',
        playlist: 'frontier',
        doctrineId: 'auto',
        encounters: [],
        forcePlaylistOverrides: true,
    });

    assert.equal(resolved.playlist, 'frontier');
    assert.equal(resolved.nodeCount, 20);
    assert.equal(resolved.doctrineId, 'siege');
    assert.equal(resolved.encounters.length, 2);
});

test('resolvePlaylistConfig preserves explicit sizing when playlist overrides are not forced', function () {
    var resolved = resolvePlaylistConfig({
        seed: '42',
        nodeCount: 18,
        difficulty: 'easy',
        playlist: 'frontier',
        doctrineId: 'auto',
        encounters: [],
    });

    assert.equal(resolved.playlist, 'frontier');
    assert.equal(resolved.nodeCount, 18);
    assert.equal(resolved.difficulty, 'easy');
    assert.equal(resolved.doctrineId, 'siege');
    assert.equal(resolved.encounters.length, 2);
});

test('resolvePlaylistConfig preserves explicit tune overrides when playlist overrides are not forced', function () {
    var resolved = resolvePlaylistConfig({
        playlist: 'puzzle',
        tuneOverrides: { aiAgg: 1.02, aiBuf: 6, aiInt: 30, flowInt: 15 },
    });

    assert.deepEqual(resolved.tuneOverrides, { aiAgg: 1.02, aiBuf: 6, aiInt: 30, flowInt: 15 });
});

test('playlistName returns a readable label', function () {
    assert.equal(playlistName('puzzle'), 'Puzzle Sector');
});
