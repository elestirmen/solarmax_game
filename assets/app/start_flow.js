import { normalizeCustomMapConfig } from '../sim/custom_map.js';

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
            missionScript: challenge.missionScript || null,
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
            missionScript: customMap.missionScript || null,
            endOnObjectives: customMap.endOnObjectives === true,
        },
    };
}

export function buildCampaignLevelStartConfig(level, levelIndex) {
    level = level && typeof level === 'object' ? level : {};
    // Senaryo bölümlerinde zafer yalnızca rakip eliminasyonu ile (tüm düğüm ve aktif filoları yok).
    // Görevler ilerleme, faz ve koç ipuçları içindir; hedef tamamlanınca maç otomatik bitmez.
    var campaignEndOnObjectives = false;
    var customMap = level.customMap && typeof level.customMap === 'object'
        ? normalizeCustomMapConfig({
            name: level.customMap.name || ('Campaign ' + (level.id || (Number(levelIndex) + 1))),
            seed: level.customMap.seed || level.seed || ('campaign-' + (level.id || (Number(levelIndex) + 1))),
            difficulty: level.diff || level.customMap.difficulty || 'normal',
            fogEnabled: level.fog !== undefined ? !!level.fog : level.customMap.fogEnabled === true,
            rulesMode: level.rulesMode || level.customMap.rulesMode || 'advanced',
            playerCount: level.customMap.playerCount,
            nodes: level.customMap.nodes,
            wormholes: level.customMap.wormholes,
            mapFeature: level.customMap.mapFeature !== undefined ? level.customMap.mapFeature : (level.mapFeature || 'none'),
            mapMutator: level.customMap.mapMutator !== undefined ? level.customMap.mapMutator : (level.mapMutator || 'none'),
            playlist: level.playlist || level.customMap.playlist || 'standard',
            doctrineId: level.doctrineId || level.customMap.doctrineId || 'auto',
            encounters: Array.isArray(level.encounters) && level.encounters.length ? level.encounters : (level.customMap.encounters || []),
            strategicNodes: level.customMap.strategicNodes,
            playerCapital: level.customMap.playerCapital,
            tuneOverrides: level.tune || level.customMap.tuneOverrides || level.customMap.tune || null,
            missionScript: level.missionScript || level.customMap.missionScript || null,
            endOnObjectives: campaignEndOnObjectives,
        })
        : null;
    if (customMap) {
        return {
            seed: customMap.seed || level.seed,
            nodeCount: customMap.nodes.length,
            difficulty: customMap.difficulty || level.diff,
            fogEnabled: !!customMap.fogEnabled,
            customMapConfig: customMap,
            campaignLevelIndex: Number.isFinite(levelIndex) ? levelIndex : -1,
            hintText: level.hint ? 'Bölüm ipucu: ' + level.hint : '',
            initOptions: {
                fogEnabled: !!customMap.fogEnabled,
                aiCount: Math.max(0, (customMap.playerCount || 1) - 1),
                rulesMode: customMap.rulesMode || level.rulesMode || 'advanced',
                tuneOverrides: customMap.tuneOverrides || null,
                customMap: customMap,
                playlist: customMap.playlist || level.playlist || 'standard',
                doctrineId: customMap.doctrineId || level.doctrineId || 'auto',
                encounters: customMap.encounters || level.encounters || [],
                objectives: level.objectives || [],
                missionScript: level.missionScript || customMap.missionScript || null,
                endOnObjectives: campaignEndOnObjectives,
            },
        };
    }
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
            missionScript: level.missionScript || null,
            endOnObjectives: campaignEndOnObjectives,
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
