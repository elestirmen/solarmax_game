import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyCampaignRunState,
    applyDailyChallengeRunState,
    applySkirmishRunState,
    buildCampaignLevelStartConfig,
    buildCustomMapStartConfig,
    buildDailyChallengeStartConfig,
    buildSkirmishStartConfig,
} from '../assets/app/start_flow.js';

test('buildSkirmishStartConfig preserves menu skirmish tuning in init payload', function () {
    var config = buildSkirmishStartConfig({
        seed: '42',
        nodeCount: 20,
        difficulty: 'hard',
        fogEnabled: true,
        rulesMode: 'classic',
        playlist: 'frontier',
        doctrineId: 'siege',
    });

    assert.equal(config.seed, '42');
    assert.equal(config.nodeCount, 20);
    assert.equal(config.initOptions.rulesMode, 'classic');
    assert.equal(config.initOptions.forcePlaylistOverrides, true);
});

test('daily, custom, and campaign start configs derive mode-specific init data', function () {
    var daily = buildDailyChallengeStartConfig({
        seed: 'daily-1',
        nc: 16,
        diff: 'normal',
        fog: true,
        aiCount: 2,
        title: 'Relay Rush',
        rulesMode: 'advanced',
        encounters: [{ id: 'enc' }],
        objectives: [{ id: 'obj' }],
    });
    var custom = buildCustomMapStartConfig({
        name: 'Frontier Shell',
        seed: 'map-7',
        difficulty: 'easy',
        fogEnabled: true,
        playerCount: 3,
        nodes: [
            { x: 100, y: 100, owner: 0, units: 20 },
            { x: 260, y: 100, owner: 1, units: 20 },
            { x: 420, y: 100, owner: -1, units: 12 },
            { x: 580, y: 100, owner: -1, units: 12 },
        ],
    });
    var campaign = buildCampaignLevelStartConfig({
        seed: 'campaign-2',
        nc: 22,
        diff: 'hard',
        fog: false,
        aiCount: 3,
        mapFeature: 'barrier',
        mapMutator: 'blackout',
        hint: 'Gate oncek relay ile acilir.',
    }, 4);

    assert.match(daily.toastText, /Relay Rush/);
    assert.equal(daily.initOptions.aiCount, 2);
    assert.equal(custom.nodeCount, 4);
    assert.equal(custom.initOptions.aiCount, 2);
    assert.equal(campaign.campaignLevelIndex, 4);
    assert.match(campaign.hintText, /Gate/);
});

test('buildCustomMapStartConfig rejects invalid maps', function () {
    assert.equal(buildCustomMapStartConfig({ nodes: [{ x: 0, y: 0 }] }), null);
});

test('run state helpers switch campaign and daily flags predictably', function () {
    var gameState = {
        campaign: { active: true, levelIndex: 3, reminderShown: { intro: true } },
        daily: { active: true, challenge: { title: 'Old' }, reminderShown: { pulse: true }, bestTick: 320, completed: true },
    };

    applySkirmishRunState(gameState);
    assert.equal(gameState.campaign.active, false);
    assert.equal(gameState.daily.active, false);
    assert.deepEqual(gameState.daily.reminderShown, {});

    applyDailyChallengeRunState(gameState, { title: 'New Daily' });
    assert.equal(gameState.daily.active, true);
    assert.equal(gameState.daily.challenge.title, 'New Daily');

    applyCampaignRunState(gameState, 6);
    assert.equal(gameState.campaign.active, true);
    assert.equal(gameState.campaign.levelIndex, 6);
    assert.equal(gameState.daily.active, false);
});
