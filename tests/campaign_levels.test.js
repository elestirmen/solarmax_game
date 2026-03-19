import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN_LEVELS } from '../assets/campaign/levels.js';

test('campaign tutorial only keeps easy difficulty for the opening trio', function () {
    var easyIds = CAMPAIGN_LEVELS.filter(function (level) {
        return level.diff === 'easy';
    }).map(function (level) {
        return level.id;
    });

    assert.deepEqual(easyIds, [1, 2, 3]);
});

test('late objective campaign chapters avoid soft resets in pressure', function () {
    var lateObjectiveLevels = CAMPAIGN_LEVELS.filter(function (level) {
        return level.id >= 21 && level.endOnObjectives === true;
    });

    assert.equal(lateObjectiveLevels.every(function (level) { return level.diff !== 'easy'; }), true);
    assert.equal(lateObjectiveLevels.every(function (level) { return level.aiCount >= 2; }), true);

    var turretLine = lateObjectiveLevels.find(function (level) { return level.id === 22; });
    assert.ok(turretLine);
    assert.equal(turretLine.objectives.filter(function (objective) { return !objective.optional; }).length >= 2, true);
    assert.equal(lateObjectiveLevels.filter(function (level) { return !!level.customMap; }).length >= 2, true);
});
