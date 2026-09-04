import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionSummary, buildWorldStatusChips } from '../assets/ui/selection_summary.js';

var FULL_MECHANICS = { upgrades: true, flow: true, defense: true, assimilation: true };

function ownWorld(extra) {
    return Object.assign({
        kindLabel: 'Forge',
        level: 2,
        owner: 0,
        ownerLabel: 'Sen',
        isSelf: true,
        units: 42,
        maxUnits: 174,
        supplied: true,
        assimilation: 1,
    }, extra || {});
}

test('an empty selection returns the idle hint and no stats', function () {
    var summary = buildSelectionSummary({ nodes: [], idleHint: 'Bir gezegen seç.' });

    assert.equal(summary.kind, 'empty');
    assert.deepEqual(summary.stats, []);
    assert.deepEqual(summary.notes, ['Bir gezegen seç.']);
});

test('flow targeting mode replaces the readout instead of appending to it', function () {
    var summary = buildSelectionSummary({ commandMode: 'flow', nodes: [ownWorld()] });

    assert.equal(summary.kind, 'command');
    assert.equal(summary.stats.length, 0);
});

test('a single world reports garrison, upgrade cost and supply as separate stats', function () {
    var summary = buildSelectionSummary({
        nodes: [ownWorld({ upgrade: { cost: 96, affordable: false } })],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.kind, 'single');
    assert.equal(summary.title, 'Forge · Seviye 2');
    assert.equal(summary.owner, 'Sen');
    assert.equal(summary.ownerTone, 'self');

    var labels = summary.stats.map(function (stat) { return stat.label; });
    assert.deepEqual(labels, ['Garnizon', 'Yükseltme', 'Tedarik', 'Savunma']);
    assert.equal(summary.stats[0].value, '42/174');
    assert.equal(summary.stats[1].value, '96 birlik');
    assert.equal(summary.stats[1].tone, 'warn');
});

test('stats a match does not run are left out entirely', function () {
    var summary = buildSelectionSummary({
        nodes: [ownWorld({ upgrade: { cost: 96 } })],
        mechanics: { upgrades: false, flow: false, defense: false, assimilation: false },
    });

    assert.deepEqual(summary.stats.map(function (stat) { return stat.label; }), ['Garnizon']);
});

test('a full garrison is flagged so the player can see why production stopped', function () {
    var summary = buildSelectionSummary({ nodes: [ownWorld({ units: 174 })], mechanics: {} });

    assert.equal(summary.stats[0].value, '174/174');
    assert.equal(summary.stats[0].tone, 'warn');
});

test('an unfinished capture shows assimilation progress', function () {
    var summary = buildSelectionSummary({
        nodes: [ownWorld({ assimilation: 0.42 })],
        mechanics: { assimilation: true },
    });

    var assim = summary.stats.filter(function (stat) { return stat.label === 'Asimilasyon'; })[0];
    assert.equal(assim.value, '42%');
});

test('an enemy world is tagged as a rival and shows no owner-only stats', function () {
    var summary = buildSelectionSummary({
        nodes: [{ kindLabel: 'Bulwark', level: 1, owner: 1, ownerLabel: 'AI 1', isSelf: false, units: 30, maxUnits: 236 }],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.ownerTone, 'rival');
    assert.deepEqual(summary.stats.map(function (stat) { return stat.label; }), ['Garnizon']);
});

test('notes are capped so the panel never grows past its grid', function () {
    var summary = buildSelectionSummary({
        nodes: [ownWorld({
            defense: { on: true },
            gate: { open: false },
            encounterName: 'Mega Turret',
            pulse: true,
            mutatorName: 'Karartma Bölgesi',
        })],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.notes.length, 2);
});

test('a multi selection aggregates garrison, upgrade range and supply', function () {
    var summary = buildSelectionSummary({
        nodes: [
            ownWorld({ units: 10, maxUnits: 100, upgrade: { cost: 60 } }),
            ownWorld({ units: 20, maxUnits: 120, supplied: false, upgrade: { cost: 96 } }),
        ],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.kind, 'multi');
    assert.equal(summary.owner, 'Tümü senin');
    var byLabel = {};
    summary.stats.forEach(function (stat) { byLabel[stat.label] = stat.value; });
    assert.equal(byLabel['Toplam garnizon'], '30/220');
    assert.equal(byLabel['Yükseltme'], '60–96 birlik');
    assert.equal(byLabel['Tedarik'], '1/2');
});

test('a multi selection of worlds you do not own says so plainly', function () {
    var summary = buildSelectionSummary({
        nodes: [
            { owner: -1, ownerLabel: 'Tarafsız', isSelf: false, units: 5, maxUnits: 200 },
            { owner: 1, ownerLabel: 'AI 1', isSelf: false, units: 8, maxUnits: 200 },
        ],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.owner, 'Sana ait değil');
    assert.equal(summary.notes.length, 1);
});

test('world status chips carry a title so the numbers stay discoverable', function () {
    var chips = buildWorldStatusChips({
        pulse: { active: true, ownerLabel: 'Sen', seconds: 8, isSelf: true, detail: 'Üretim +35%' },
        barrier: {
            gates: [
                { label: 'Üst GATE', open: false, statusText: 'Tarafsız · önce fethet' },
                { label: 'Alt GATE', open: true, statusText: 'Sen · geçit açık' },
            ],
        },
        mutatorName: 'Karartma Bölgesi',
        doctrine: { label: 'Lojistik', statusText: 'Overdrive hazır', tradeLine: 'Tedarikli üretim +12%' },
    });

    var ids = chips.map(function (chip) { return chip.id; });
    assert.deepEqual(ids, ['pulse', 'barrier', 'mutator', 'doctrine']);
    assert.equal(chips[1].value, '1/2 geçit açık');
    assert.equal(chips[1].tone, 'up');
    assert.equal(chips[0].title, 'Üretim +35%');
    assert.equal(chips[3].title, 'Tedarikli üretim +12%');
});

test('world status chips are empty when a match runs none of those systems', function () {
    assert.deepEqual(buildWorldStatusChips({}), []);
});

test('a parked-fleet selection reports its ships instead of showing nothing', function () {
    var summary = buildSelectionSummary({ nodes: [], fleets: [{ count: 18 }, { count: 7 }] });

    assert.equal(summary.kind, 'fleets');
    assert.equal(summary.title, '2 park filosu');
    assert.equal(summary.stats[0].value, '25');
});

test('a mixed selection counts fleets the way the context badge does', function () {
    var summary = buildSelectionSummary({
        nodes: [ownWorld({ units: 40, maxUnits: 100 })],
        fleets: [{ count: 12 }],
        mechanics: FULL_MECHANICS,
    });

    assert.equal(summary.title, '1 gezegen + 1 filo seçili');
    var byLabel = {};
    summary.stats.forEach(function (stat) { byLabel[stat.label] = stat.value; });
    assert.equal(byLabel['Seçili'], '1 gezegen + 1 filo');
    assert.equal(byLabel['Park filosu'], '12');
});
