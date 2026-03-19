import test from 'node:test';
import assert from 'node:assert/strict';

import { HUD_ACTION_HELP_DEFAULT, buildHudContextBadge, buildHudHintText, buildNodeHoverTip } from '../assets/ui/hud_assistive.js';

test('HUD helpers return empty-state guidance', function () {
    assert.equal(HUD_ACTION_HELP_DEFAULT.length > 10, true);
    assert.equal(buildHudContextBadge({ online: false }), 'Hazır — kaynak seç');
    assert.match(buildHudHintText({ nodeCount: 0, fleetCount: 0 }), /Sol tıkla kendi gezegenini seç/);
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
    var turretTip = buildNodeHoverTip({ kind: 'turret', label: 'Turret' });
    var fallbackTip = buildNodeHoverTip({ kind: 'unknown' });

    assert.equal(forgeTip.title, 'Forge');
    assert.match(forgeTip.body, /Üretim yüksek/);
    assert.match(turretTip.body, /Üretmez/);
    assert.equal(fallbackTip.title, 'Core');
});
