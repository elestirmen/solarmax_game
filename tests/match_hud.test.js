import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDoctrineButtonState, buildHudCapText, buildHudTickText, buildPingDisplayText } from '../assets/ui/match_hud.js';

test('buildHudTickText shows pulse owner and time left when active', function () {
    var text = buildHudTickText({
        tick: 240,
        diff: 'hard',
        pulseActive: true,
        pulseOwner: 0,
        pulseRemainingTicks: 90,
        humanIndex: 0,
    });

    assert.match(text, /Tick: 240/);
    assert.match(text, /hard/);
    assert.match(text, /Pulse: Sen 3s/);
});

test('buildHudCapText surfaces strain once pressure crosses threshold', function () {
    assert.equal(buildHudCapText({ units: 82, cap: 100, strainThreshold: 0.82 }), 'Cap 82/100');
    assert.equal(buildHudCapText({ units: 91, cap: 100, strainThreshold: 0.82 }), 'Cap 91/100 | Strain 91%');
});

test('buildDoctrineButtonState describes missing and ready doctrines', function () {
    var emptyState = buildDoctrineButtonState({});
    var readyState = buildDoctrineButtonState({
        doctrineId: 'siege',
        doctrineName: 'Siege',
        doctrineStatus: 'Hazır',
        ready: true,
    });

    assert.equal(emptyState.disabled, true);
    assert.match(emptyState.help, /doktrin yüklemesi yok/i);
    assert.equal(readyState.disabled, false);
    assert.match(readyState.title, /Siege/);
    assert.match(readyState.help, /Kısayol: Q/);
});

test('buildPingDisplayText appends SYNC tag while warning window is active', function () {
    assert.equal(buildPingDisplayText({ online: false }), '');
    assert.equal(buildPingDisplayText({
        online: true,
        lastPingMs: 48.7,
        syncWarningText: 'warn',
        currentTick: 200,
        syncWarningTick: 100,
        syncWindowTicks: 300,
    }), 'Ping: 49ms | SYNC');
});
