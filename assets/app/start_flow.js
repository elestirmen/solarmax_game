export function buildSkirmishStartConfig(skirmish) {
    skirmish = skirmish && typeof skirmish === 'object' ? skirmish : {};
    return {
        seed: skirmish.seed,
        nodeCount: skirmish.nodeCount,
        difficulty: skirmish.difficulty,
        fogEnabled: !!skirmish.fogEnabled,
        customMapConfig: null,
        initOptions: {
            fogEnabled: !!skirmish.fogEnabled,
            rulesMode: skirmish.rulesMode,
            mapMutator: 'auto',
            playlist: skirmish.playlist,
            doctrineId: skirmish.doctrineId,
            forcePlaylistOverrides: skirmish.playlist !== 'standard',
        },
    };
}

export function buildDailyChallengeStartConfig(challenge) {
    challenge = challenge && typeof challenge === 'object' ? challenge : {};
    return {
        seed: challenge.seed,
        nodeCount: challenge.nc,
        difficulty: challenge.diff,
        fogEnabled: !!challenge.fog,
        customMapConfig: null,
        toastText: challenge.title ? 'Günlük challenge açıldı: ' + challenge.title : '',
        initOptions: {
            fogEnabled: !!challenge.fog,
            aiCount: challenge.aiCount,
            mapFeature: challenge.mapFeature || 'auto',
            mapMutator: challenge.mapMutator || 'auto',
            rulesMode: challenge.rulesMode || 'advanced',
            playlist: challenge.playlist || 'standard',
            doctrineId: challenge.doctrineId || 'auto',
            encounters: challenge.encounters || [],
            objectives: challenge.objectives || [],
            endOnObjectives: challenge.endOnObjectives === true,
        },
    };
}

export function buildCustomMapStartConfig(customMap) {
    customMap = customMap && typeof customMap === 'object' ? customMap : null;
    if (!customMap || !Array.isArray(customMap.nodes) || customMap.nodes.length < 4) return null;

    return {
        seed: customMap.seed || 'custom-map',
        nodeCount: customMap.nodes.length,
        difficulty: customMap.difficulty || 'normal',
        fogEnabled: !!customMap.fogEnabled,
        customMapConfig: customMap,
        toastText: 'Custom map yüklendi: ' + (customMap.name || 'Harita'),
        initOptions: {
            fogEnabled: !!customMap.fogEnabled,
            aiCount: Math.max(0, (customMap.playerCount || 1) - 1),
            rulesMode: customMap.rulesMode || 'advanced',
            tuneOverrides: customMap.tuneOverrides || null,
            customMap: customMap,
            playlist: customMap.playlist || 'standard',
            doctrineId: customMap.doctrineId || 'auto',
            encounters: customMap.encounters || [],
            objectives: customMap.objectives || [],
            endOnObjectives: customMap.endOnObjectives === true,
        },
    };
}

export function buildCampaignLevelStartConfig(level, levelIndex) {
    level = level && typeof level === 'object' ? level : {};
    return {
        seed: level.seed,
        nodeCount: level.nc,
        difficulty: level.diff,
        fogEnabled: !!level.fog,
        customMapConfig: null,
        campaignLevelIndex: Number.isFinite(levelIndex) ? levelIndex : -1,
        hintText: level.hint ? 'Bölüm ipucu: ' + level.hint : '',
        initOptions: {
            fogEnabled: !!level.fog,
            aiCount: level.aiCount,
            mapFeature: level.mapFeature || 'auto',
            mapMutator: level.mapMutator || 'none',
            tuneOverrides: level.tune || null,
            rulesMode: level.rulesMode || 'advanced',
            playlist: level.playlist || 'standard',
            doctrineId: level.doctrineId || 'auto',
            encounters: level.encounters || [],
            objectives: level.objectives || [],
            endOnObjectives: level.endOnObjectives === true,
        },
    };
}

function resetDailyState(gameState) {
    gameState.daily.active = false;
    gameState.daily.challenge = null;
    gameState.daily.reminderShown = {};
    gameState.daily.bestTick = 0;
    gameState.daily.completed = false;
}

export function applySkirmishRunState(gameState) {
    gameState.campaign.active = false;
    gameState.campaign.levelIndex = -1;
    resetDailyState(gameState);
}

export function applyDailyChallengeRunState(gameState, challenge) {
    gameState.campaign.active = false;
    gameState.campaign.levelIndex = -1;
    gameState.daily.active = true;
    gameState.daily.challenge = challenge || null;
    gameState.daily.reminderShown = {};
}

export function applyCampaignRunState(gameState, levelIndex) {
    gameState.campaign.active = true;
    gameState.campaign.levelIndex = Number.isFinite(levelIndex) ? levelIndex : -1;
    gameState.campaign.reminderShown = {};
    resetDailyState(gameState);
}
