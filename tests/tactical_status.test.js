import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTacticalStatus, formatMatchTime } from '../assets/ui/tactical_status.js';

test('match time uses a stable mm:ss player-facing format', function () {
    assert.equal(formatMatchTime(0, 30), '00:00');
    assert.equal(formatMatchTime(1890, 30), '01:03');
});

test('tactical status distinguishes opening, critical, and dominant phases', function () {
    assert.equal(buildTacticalStatus({ tick: 300, tickRate: 30, powers: [40, 60], humanIndex: 0 }).id, 'opening');
    assert.equal(buildTacticalStatus({ tick: 900, tickRate: 30, powers: [20, 80], humanIndex: 0 }).id, 'critical');
    assert.equal(buildTacticalStatus({ tick: 900, tickRate: 30, powers: [70, 30], humanIndex: 0 }).id, 'dominant');
});
