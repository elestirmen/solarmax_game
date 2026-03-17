import test from 'node:test';
import assert from 'node:assert/strict';

import { HUD_ACTION_HELP_DEFAULT, buildHudContextBadge, buildHudHintText } from '../assets/ui/hud_assistive.js';

test('HUD helpers return empty-state guidance', function () {
    assert.equal(HUD_ACTION_HELP_DEFAULT.length > 10, true);
    assert.equal(buildHudContextBadge({ online: false }), 'Hazır');
    assert.match(buildHudHintText({ nodeCount: 0, fleetCount: 0 }), /Sol tıkla bir gezegen seç/);
});

test('HUD helpers describe flow mode and multi selection correctly', function () {
    assert.equal(buildHudContextBadge({ commandMode: 'flow', nodeCount: 2, fleetCount: 0 }), 'FLOW hedefi');
    assert.match(buildHudHintText({ commandMode: 'flow' }), /FLOW modu/);
    assert.equal(buildHudContextBadge({ nodeCount: 2, fleetCount: 1 }), '3 seçim');
    assert.match(buildHudHintText({ nodeCount: 2, fleetCount: 0, ownedCount: 2 }), /Toplu emir hazır/);
});

test('HUD helpers distinguish owned and foreign selections', function () {
    assert.equal(buildHudContextBadge({ nodeCount: 1, selectedNodeLabel: 'Forge' }), 'Forge');
    assert.match(buildHudHintText({ nodeCount: 1, ownedCount: 1 }), /Seçili node hazır/);
    assert.match(buildHudHintText({ nodeCount: 1, ownedCount: 0 }), /Bu node sana ait değil/);
});
