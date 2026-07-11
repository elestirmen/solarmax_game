import test from 'node:test';
import assert from 'node:assert/strict';

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
