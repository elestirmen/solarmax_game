import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomMapExport, buildCustomMapSnapshot, normalizeCustomMapConfig } from '../assets/sim/custom_map.js';

test('normalizeCustomMapConfig sanitizes owners, gates, and feature data', function () {
    var normalized = normalizeCustomMapConfig({
        name: '  Test Map  ',
        seed: 'map-seed',
        difficulty: 'hard',
        fogEnabled: true,
        rulesMode: 'classic',
        players: 3,
        nodes: [
            { x: 100, y: 100, radius: 28, owner: 0, units: 30, kind: 'core', gate: true },
            { x: 300, y: 200, radius: 26, owner: 1, units: 24, kind: 'relay' },
            { x: 500, y: 300, radius: 24, owner: 9, units: 18, kind: 'turret' },
        ],
        mapFeature: { type: 'barrier', x: 810, gateIds: [0, 99] },
        mapMutator: { type: 'blackout', x: 420, y: 260, r: 160 },
        strategicNodes: [1, 5],
        playerCapital: { 0: 0, 1: 1, 2: 2 },
    });

    assert.equal(normalized.name, 'Test Map');
    assert.equal(normalized.playerCount, 3);
    assert.equal(normalized.nodes[2].owner, -1);
    assert.deepEqual(normalized.mapFeature.gateIds, [0]);
    assert.equal(normalized.mapMutator.type, 'blackout');
    assert.deepEqual(normalized.strategicNodes, [1]);
    assert.equal(normalized.playerCapital[0], 0);
    assert.equal(normalized.playerCapital[1], 1);
});

test('buildCustomMapExport round-trips map structure into normalized JSON', function () {
    var exported = buildCustomMapExport({
        seed: 42,
        diff: 'normal',
        rulesMode: 'advanced',
        tune: { fogEnabled: false },
        players: [{ idx: 0 }, { idx: 1 }],
        nodes: [
            { id: 0, pos: { x: 100, y: 120 }, radius: 28, owner: 0, units: 30, prodAcc: 0, level: 2, kind: 'core', defense: false, strategic: true, gate: false, assimilationProgress: 1, assimilationLock: 0 },
            { id: 1, pos: { x: 400, y: 360 }, radius: 24, owner: 1, units: 22, prodAcc: 0, level: 1, kind: 'relay', defense: true, strategic: false, gate: false, assimilationProgress: 1, assimilationLock: 0 },
        ],
        wormholes: [{ a: 0, b: 1 }],
        mapFeature: { type: 'wormhole' },
        mapMutator: { type: 'ion_storm', x: 240, y: 220, r: 150, speedMult: 0.7 },
        strategicNodes: [0],
        playerCapital: { 0: 0, 1: 1 },
    }, {
        name: 'Exported Map',
        seed: '42',
    });

    assert.equal(exported.name, 'Exported Map');
    assert.equal(exported.nodes.length, 2);
    assert.equal(exported.mapFeature.type, 'wormhole');
    assert.equal(exported.mapMutator.type, 'ion_storm');
    assert.deepEqual(exported.wormholes, [{ a: 0, b: 1 }]);
    assert.deepEqual(exported.playerCapital, { 0: 0, 1: 1 });
});

test('buildCustomMapSnapshot keeps player slots and feature-normalized coordinates', function () {
    var snapshot = buildCustomMapSnapshot({
        name: 'Gravity Wells',
        playerCount: 3,
        nodes: [
            { x: 100, y: 120, owner: 0, units: 22 },
            { x: 320, y: 240, owner: 1, units: 18 },
            { x: 540, y: 360, owner: 2, units: 18 },
        ],
        mapFeature: { type: 'gravity', nodeId: 1, x: 1, y: 1, r: 180 },
        mapMutator: { type: 'blackout', x: 320, y: 240, r: 160 },
        doctrineId: 'siege',
        encounters: [{ type: 'relay_core', nodeId: 1 }],
    }, [
        { index: 0, botControlled: false },
        { index: 1, botControlled: false },
        { index: 2, botControlled: true },
    ]);

    assert.equal(snapshot.players.length, 3);
    assert.deepEqual(snapshot.players.map(function (player) { return player.isAI; }), [false, false, true]);
    assert.equal(snapshot.mapFeature.type, 'gravity');
    assert.equal(snapshot.mapMutator.type, 'blackout');
    assert.equal(snapshot.mapFeature.x, snapshot.nodes[1].pos.x);
    assert.equal(snapshot.mapFeature.y, snapshot.nodes[1].pos.y);
    assert.equal(snapshot.doctrineId, 'siege');
    assert.equal(snapshot.encounters.length, 1);
    assert.equal(snapshot.nodes[1].encounterType, 'relay_core');
});
