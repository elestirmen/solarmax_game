import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHudCoachItems } from '../assets/ui/hud_coach.js';

test('HUD coach suggests selection basics when nothing is selected', function () {
    var items = buildHudCoachItems({ nodeCount: 0, fleetCount: 0, sendPct: 50 });
    assert.equal(items.length, 3);
    assert.equal(items[0].key, 'SOL');
    assert.match(items[2].text, /%50/);
});

test('HUD coach switches to flow instructions in command mode', function () {
    var items = buildHudCoachItems({ commandMode: 'flow', sendPct: 75 });
    assert.equal(items[0].text, 'Hedef node seç');
    assert.equal(items[2].key, '%75');
});

test('HUD coach distinguishes owned-node and parked-fleet selections', function () {
    var owned = buildHudCoachItems({ nodeCount: 1, ownedCount: 1, fleetCount: 0, sendPct: 25 });
    var fleet = buildHudCoachItems({ nodeCount: 0, ownedCount: 0, fleetCount: 1, sendPct: 25 });

    assert.equal(owned[2].key, 'U');
    assert.equal(fleet[1].key, 'BOŞ');
});
