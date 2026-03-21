import test from 'node:test';
import assert from 'node:assert/strict';

import { applySolarFlareFleetWipe, getSolarFlareFrame, getSolarFlareTransitions, smallestBlastTickAtOrAfter } from '../assets/sim/solar_flare.js';

var cfg = {
    gapMinTicks: 100,
    gapMaxTicks: 100,
    warnTicks: 20,
};

test('getSolarFlareFrame warns then blasts with fixed gap', function () {
    assert.equal(getSolarFlareFrame(79, 0, cfg).phase, 'idle');
    assert.equal(getSolarFlareFrame(80, 0, cfg).phase, 'warn');
    assert.equal(getSolarFlareFrame(99, 0, cfg).phase, 'warn');
    assert.equal(getSolarFlareFrame(100, 0, cfg).phase, 'blast');
    assert.equal(getSolarFlareFrame(101, 0, cfg).phase, 'idle');
});

test('successive blasts are separated by at least gapMinTicks', function () {
    var c = { gapMinTicks: 50, gapMaxTicks: 80, warnTicks: 5 };
    var prev = smallestBlastTickAtOrAfter(0, 42, c);
    for (var n = 0; n < 12; n++) {
        var next = smallestBlastTickAtOrAfter(prev + 1, 42, c);
        assert.ok(next - prev >= c.gapMinTicks, 'gap ' + (next - prev));
        prev = next;
    }
});

test('applySolarFlareFleetWipe clears active fleets only', function () {
    var fleets = [
        { active: true, holding: true, count: 10, trail: [1, 2] },
        { active: false, count: 5, trail: [] },
    ];
    assert.equal(applySolarFlareFleetWipe(fleets), 1);
    assert.equal(fleets[0].active, false);
    assert.equal(fleets[0].count, 0);
    assert.equal(fleets[0].trail.length, 0);
    assert.equal(fleets[1].active, false);
});

test('getSolarFlareTransitions detects warning entry and blast across snapshot gaps', function () {
    assert.equal(getSolarFlareTransitions(78, 80, 0, cfg).warnStartTick, 80);
    assert.equal(getSolarFlareTransitions(78, 80, 0, cfg).blastTick, -1);
    assert.equal(getSolarFlareTransitions(98, 100, 0, cfg).warnStartTick, -1);
    assert.equal(getSolarFlareTransitions(98, 100, 0, cfg).blastTick, 100);
    assert.equal(getSolarFlareTransitions(80, 81, 0, cfg).warnStartTick, -1);
});
