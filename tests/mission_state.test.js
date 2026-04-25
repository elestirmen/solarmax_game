import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMissionPanelSubtitle, buildMissionPanelTitle, pickPrimaryObjectiveRow, resolveMissionDefinition, resolveMissionMode } from '../assets/ui/mission_state.js';

test('resolveMissionDefinition prefers daily, then campaign, then objective match', function () {
    var daily = resolveMissionDefinition({
        dailyActive: true,
        dailyChallenge: { title: 'Daily' },
        campaignActive: true,
        campaignLevelIndex: 0,
        campaignLevels: [{ title: 'Campaign' }],
        objectives: [{ id: 'obj' }],
    });
    var campaign = resolveMissionDefinition({
        dailyActive: false,
        campaignActive: true,
        campaignLevelIndex: 0,
        campaignLevels: [{ title: 'Campaign' }],
        objectives: [{ id: 'obj' }],
    });
    var objective = resolveMissionDefinition({
        dailyActive: false,
        campaignActive: false,
        objectives: [{ id: 'obj' }],
        playlist: 'zen',
    });

    assert.equal(daily.title, 'Daily');
    assert.equal(campaign.title, 'Campaign');
    assert.equal(objective.title, 'Hedef Maçı');
});

test('resolveMissionMode and panel title/subtitle reflect mission type', function () {
    var mode = resolveMissionMode({
        dailyActive: true,
        dailyChallenge: { title: 'Günlük' },
    });
    var title = buildMissionPanelTitle({ id: 3, name: 'Relay' }, 'campaign');
    var subtitle = buildMissionPanelSubtitle({
        mode: 'daily',
        level: { title: 'Günlük', blurb: 'Açıklama', playlist: 'zen', doctrineId: 'logistics' },
        dailyBestTick: 420,
    });

    assert.equal(mode, 'daily');
    assert.equal(title, 'Bölüm 3: Relay');
    assert.match(subtitle, /En iyi: 420 tick/);
});

test('pickPrimaryObjectiveRow prefers required incomplete rows', function () {
    var row = pickPrimaryObjectiveRow([
        { id: 'bonus', optional: true, complete: false, failed: false },
        { id: 'main', optional: false, complete: false, failed: false },
    ]);

    assert.equal(row.id, 'main');
});
