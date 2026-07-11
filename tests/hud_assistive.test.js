import test from 'node:test';
import assert from 'node:assert/strict';

import { HUD_ACTION_HELP_DEFAULT, buildHudContextBadge, buildHudHintText, buildNodeHoverTip, buildNodeHoverStats } from '../assets/ui/hud_assistive.js';

test('HUD helpers return empty-state guidance', function () {
    assert.equal(HUD_ACTION_HELP_DEFAULT.length > 10, true);
    assert.equal(buildHudContextBadge({ online: false }), 'Hazır — kaynak seç');
    assert.match(buildHudHintText({ nodeCount: 0, fleetCount: 0 }), /Sol tıkla kendi gezegenini seç/);
});

test('HUD helpers switch to touch-first guidance on coarse pointers', function () {
    assert.match(buildHudHintText({ nodeCount: 0, fleetCount: 0, coarsePointer: true }), /iki parmak/i);
    assert.match(buildHudHintText({ commandMode: 'flow', coarsePointer: true }), /dokun/i);
    assert.doesNotMatch(buildHudHintText({ ownedCount: 1, nodeCount: 1, coarsePointer: true }), /Sağ tık/);
});

test('HUD helpers describe flow mode and multi selection correctly', function () {
    assert.equal(buildHudContextBadge({ commandMode: 'flow', nodeCount: 2, fleetCount: 0 }), 'Flow hedefi seçiliyor');
    assert.match(buildHudHintText({ commandMode: 'flow' }), /Flow:/);
    assert.equal(buildHudContextBadge({ nodeCount: 2, fleetCount: 1 }), '3 öğe seçili');
    assert.match(buildHudHintText({ nodeCount: 2, fleetCount: 0, ownedCount: 2 }), /Çoklu seçim/);
});

test('HUD helpers distinguish owned and foreign selections', function () {
    assert.equal(buildHudContextBadge({ nodeCount: 1, selectedNodeLabel: 'Forge' }), 'Forge');
    assert.match(buildHudHintText({ nodeCount: 1, ownedCount: 1 }), /Kaynak hazır/);
    assert.match(buildHudHintText({ nodeCount: 1, ownedCount: 0 }), /Bu dünya senin değil/);
});

test('HUD hover tips explain planet roles succinctly', function () {
    var forgeTip = buildNodeHoverTip({ kind: 'forge', label: 'Forge' });
    var gateTip = buildNodeHoverTip({ kind: 'gate', label: 'Gate' });
    var turretTip = buildNodeHoverTip({ kind: 'turret', label: 'Turret' });
    var fallbackTip = buildNodeHoverTip({ kind: 'unknown' });

    assert.equal(forgeTip.title, 'Forge');
    assert.match(forgeTip.body, /Üretim yüksek/);
    assert.match(gateTip.body, /Bariyer kapısı/);
    assert.match(turretTip.body, /Üretmez/);
    assert.equal(fallbackTip.title, 'Core');
});

test('buildNodeHoverStats summarises owner, garrison and status', function () {
    var stats = buildNodeHoverStats({
        ownerLabel: 'Sen', units: 42.7, capacity: 60, level: 2,
        defense: true, supplied: false,
    });
    assert.match(stats, /Sen/);
    assert.match(stats, /Birlik 42 \/ 60/);
    assert.match(stats, /Sv\.2/);
    assert.match(stats, /Kalkan açık/);
    assert.match(stats, /Tedariksiz/);
});

test('buildNodeHoverStats omits flags that do not apply', function () {
    var stats = buildNodeHoverStats({ ownerLabel: 'Tarafsız', units: 12, level: 1 });
    assert.match(stats, /Tarafsız/);
    assert.match(stats, /Birlik 12/);
    assert.doesNotMatch(stats, /Kalkan/);
    assert.doesNotMatch(stats, /Tedariksiz/);
    assert.doesNotMatch(stats, /\//);
});

test('buildNodeHoverTip carries the live stat line alongside the type tip', function () {
    var tip = buildNodeHoverTip({ kind: 'forge', ownerLabel: 'AI 1', units: 8 });
    assert.equal(tip.title, 'Forge');
    assert.match(tip.stats, /AI 1/);
    assert.match(tip.body, /Üretim yüksek/);
});

test('buildNodeHoverStats is empty when no stats are supplied', function () {
    assert.equal(buildNodeHoverStats({}), '');
    assert.equal(buildNodeHoverStats(), '');
});

test('node hover helper includes a selected-source dispatch forecast', function () {
    var tip = buildNodeHoverTip({
        kind: 'bulwark', ownerLabel: 'AI 1', units: 12, capacity: 40, level: 2,
        forecastLabel: 'RİSKLİ', forecastSummary: '10 saldırı · ~17 savunma', forecastTone: 'warning',
    });
    assert.match(tip.stats, /RİSKLİ/);
    assert.equal(tip.forecastTone, 'warning');
});
