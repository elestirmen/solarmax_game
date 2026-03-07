import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDailyChallenge, dailyChallengeKey } from '../assets/campaign/daily_challenge.js';

test('dailyChallengeKey normalizes Date inputs to YYYY-MM-DD', function () {
    var key = dailyChallengeKey(new Date('2026-03-07T10:15:00Z'));
    assert.equal(key, '2026-03-07');
});

test('buildDailyChallenge is deterministic for the same day', function () {
    var a = buildDailyChallenge('2026-03-07');
    var b = buildDailyChallenge('2026-03-07');
    assert.deepEqual(a, b);
});

test('buildDailyChallenge varies seed and title across days', function () {
    var a = buildDailyChallenge('2026-03-07');
    var b = buildDailyChallenge('2026-03-08');
    assert.notEqual(a.seed, b.seed);
    assert.notEqual(a.title + a.blurb, b.title + b.blurb);
});

test('buildDailyChallenge emits a main objective keyed to the selected feature', function () {
    var days = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
    var featureObjectives = {};

    for (var i = 0; i < days.length; i++) {
        var challenge = buildDailyChallenge(days[i]);
        featureObjectives[challenge.mapFeature] = challenge.objectives[0].type;
    }

    if (featureObjectives.wormhole) assert.equal(featureObjectives.wormhole, 'wormhole_dispatches');
    if (featureObjectives.barrier) assert.equal(featureObjectives.barrier, 'gate_captures');
    if (featureObjectives.gravity) assert.equal(featureObjectives.gravity, 'pulse_control_ticks');
});
