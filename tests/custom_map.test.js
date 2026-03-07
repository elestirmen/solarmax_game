import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomMapExport, normalizeCustomMapConfig } from '../assets/sim/custom_map.js';

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
        strategicNodes: [1, 5],
        playerCapital: { 0: 0, 1: 1, 2: 2 },
    });

    assert.equal(normalized.name, 'Test Map');
    assert.equal(normalized.playerCount, 3);
    assert.equal(normalized.nodes[2].owner, -1);
    assert.deepEqual(normalized.mapFeature.gateIds, [0]);
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
        strategicNodes: [0],
        playerCapital: { 0: 0, 1: 1 },
    }, {
        name: 'Exported Map',
        seed: '42',
    });

    assert.equal(exported.name, 'Exported Map');
    assert.equal(exported.nodes.length, 2);
    assert.equal(exported.mapFeature.type, 'wormhole');
    assert.deepEqual(exported.wormholes, [{ a: 0, b: 1 }]);
    assert.deepEqual(exported.playerCapital, { 0: 0, 1: 1 });
});
