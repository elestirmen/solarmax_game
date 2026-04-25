import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getMapMutatorSpeedMultiplier,
    isTerritoryBonusBlockedAtPoint,
    mapMutatorName,
    resolveMapMutator,
} from '../assets/sim/mutator.js';

test('resolveMapMutator deterministically generates the same mutator for the same seed and nodes', function () {
    var nodes = [
        { id: 0, owner: -1, kind: 'core', radius: 24, pos: { x: 220, y: 240 } },
        { id: 1, owner: -1, kind: 'relay', radius: 26, pos: { x: 760, y: 420 }, strategic: true },
        { id: 2, owner: 0, kind: 'core', radius: 28, pos: { x: 120, y: 120 } },
        { id: 3, owner: 1, kind: 'core', radius: 28, pos: { x: 1320, y: 820 } },
    ];

    var a = resolveMapMutator({ seed: 'mutator-seed', nodes: nodes, mapMutator: 'auto' });
    var b = resolveMapMutator({ seed: 'mutator-seed', nodes: nodes, mapMutator: 'auto' });

    assert.deepEqual(a, b);
    assert.ok(a.type === 'none' || a.type === 'ion_storm' || a.type === 'blackout');
});

test('ion storm applies a fleet speed multiplier only inside its area', function () {
    var mutator = { type: 'ion_storm', x: 400, y: 300, r: 180, speedMult: 0.68 };

    assert.equal(getMapMutatorSpeedMultiplier({
        mapMutator: mutator,
        point: { x: 400, y: 300 },
    }), 0.68);
    assert.equal(getMapMutatorSpeedMultiplier({
        mapMutator: mutator,
        point: { x: 800, y: 300 },
    }), 1);
});

test('blackout blocks territory bonuses inside its area', function () {
    var mutator = { type: 'blackout', x: 520, y: 280, r: 140 };

    assert.equal(isTerritoryBonusBlockedAtPoint({
        mapMutator: mutator,
        point: { x: 520, y: 280 },
    }), true);
    assert.equal(isTerritoryBonusBlockedAtPoint({
        mapMutator: mutator,
        point: { x: 760, y: 280 },
    }), false);
});

test('mapMutatorName returns localized labels for known mutators', function () {
    assert.equal(mapMutatorName('ion_storm'), 'İyon Fırtınası');
    assert.equal(mapMutatorName('blackout'), 'Karartma Bölgesi');
});
