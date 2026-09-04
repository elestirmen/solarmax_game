import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCombatOutcome } from '../assets/sim/fleet_step.js';
import { buildDispatchForecast } from '../assets/ui/command_preview.js';

test('dispatch forecast uses real send-count reserve behavior', function () {
    var forecast = buildDispatchForecast({
        sourceGroups: [{ units: 20, flowMult: 1 }, { units: 10, flowMult: 1 }],
        sendPct: 50,
        target: { owner: 1, units: 8, level: 1, kind: 'core' },
        humanIndex: 0,
    });
    assert.equal(forecast.sendUnits, 15);
    assert.equal(forecast.tone, 'advantage');
});

test('dispatch forecast calls out risky fortified targets and full friendly nodes', function () {
    var risky = buildDispatchForecast({
        sourceGroups: [{ units: 20, flowMult: 1 }],
        sendPct: 50,
        target: { owner: 1, units: 10, level: 2, defense: true, kind: 'bulwark' },
        humanIndex: 0,
    });
    assert.equal(risky.tone, 'danger');

    var full = buildDispatchForecast({
        sourceGroups: [{ units: 20, flowMult: 1 }],
        sendPct: 50,
        target: { owner: 0, units: 30, maxUnits: 30 },
        humanIndex: 0,
    });
    assert.equal(full.label, 'HEDEF DOLU');
});

test('the forecast verdict matches what the sim actually resolves', function () {
    // A forecast that says "AVANTAJLI" has to capture, and one that says "YETERSİZ"
    // has to fail. Both sides read the same defence formula, so this holds by
    // construction - the test is here to catch it drifting apart again.
    var cases = [
        { units: 8, level: 1, kind: 'core', defense: false },
        { units: 10, level: 2, kind: 'bulwark', defense: true },
        { units: 12, level: 1, kind: 'forge', defense: false },
        { units: 6, level: 3, kind: 'relay', defense: false },
        { units: 9, level: 1, kind: 'turret', defense: false },
    ];

    for (var i = 0; i < cases.length; i++) {
        var spec = cases[i];
        var forecast = buildDispatchForecast({
            sourceGroups: [{ units: 41, flowMult: 1 }],
            sendPct: 50,
            target: Object.assign({ owner: 1 }, spec),
            humanIndex: 0,
        });

        var target = Object.assign({ id: 1, owner: 1, maxUnits: 200, pos: { x: 0, y: 0 } }, spec);
        var result = resolveCombatOutcome({
            fleet: { owner: 0, count: forecast.sendUnits },
            targetNode: target,
            players: [{ color: '#3d8bfd' }, { color: '#ff5c5c' }],
            tune: { def: 1.2 },
            humanIndex: 0,
            callbacks: { nodeCapacity: function (node) { return node.maxUnits; } },
            constants: {},
        });

        assert.equal(result.captured, forecast.ratio > 1, spec.kind + ': forecast ratio ' + forecast.ratio.toFixed(2) + ' vs captured ' + result.captured);
        if (forecast.tone === 'advantage') assert.equal(result.captured, true, spec.kind + ' was called advantageous but did not capture');
        if (forecast.tone === 'danger') assert.equal(result.captured, false, spec.kind + ' was called insufficient but captured');
    }
});
