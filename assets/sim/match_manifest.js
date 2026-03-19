import { buildDailyChallenge } from '../campaign/daily_challenge.js';
import { toFiniteInt } from './command_schema.js';
import { normalizeCustomMapConfig } from './custom_map.js';
import { normalizeDoctrineId } from './doctrine.js';
import { playlistName, resolvePlaylistConfig } from './playlists.js';

export var DEFAULT_MATCH_CONFIG = {
    mode: 'standard',
    seed: '42',
    nodeCount: 16,
    difficulty: 'normal',
    fogEnabled: false,
    rulesMode: 'advanced',
    aiCount: 0,
    mapFeature: 'none',
    mapMutator: 'auto',
    playlist: 'standard',
    doctrineId: 'auto',
};

function pickDefaults(options) {
    return options && options.defaults ? options.defaults : DEFAULT_MATCH_CONFIG;
}

export function normalizeDifficulty(raw, options) {
    var defaults = pickDefaults(options);
    var value = String(raw || defaults.difficulty).toLowerCase();
    if (value === 'easy' || value === 'normal' || value === 'hard') return value;
    return defaults.difficulty;
}

export function normalizeRulesMode(raw, options) {
    var defaults = pickDefaults(options);
    var value = String(raw || defaults.rulesMode).toLowerCase();
    return value === 'classic' ? 'classic' : defaults.rulesMode === 'classic' ? 'classic' : 'advanced';
}

export function normalizeNodeCount(raw, options) {
    var defaults = pickDefaults(options);
    var value = Number(raw);
    if (!Number.isFinite(value)) return defaults.nodeCount;
    return Math.max(8, Math.min(30, Math.floor(value)));
}

export function normalizeRoomMode(raw, options) {
    var defaults = pickDefaults(options);
    var value = String(raw || defaults.mode).toLowerCase();
    if (value === 'daily') return 'daily';
    if (value === 'custom') return 'custom';
    return 'standard';
}

export function todayDateKey(timeZone) {
    timeZone = timeZone || 'UTC';
    var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    var year = parts.find(function (part) { return part.type === 'year'; });
    var month = parts.find(function (part) { return part.type === 'month'; });
    var day = parts.find(function (part) { return part.type === 'day'; });
    return (year ? year.value : '1970') + '-' + (month ? month.value : '01') + '-' + (day ? day.value : '01');
}

export function normalizeChallengeDate(raw, options) {
    options = options || {};
    var value = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return todayDateKey(options.timeZone || 'UTC');
}

export function buildStandardMatchManifest(config, options) {
    config = config || {};
    options = options || {};
    var defaults = pickDefaults(options);
    var playlistResolved = resolvePlaylistConfig({
        seed: String(config.seed || defaults.seed),
        nodeCount: normalizeNodeCount(config.nodeCount, options),
        difficulty: normalizeDifficulty(config.difficulty, options),
        fogEnabled: config.fogEnabled === true,
        rulesMode: normalizeRulesMode(config.rulesMode, options),
        aiCount: Math.max(0, toFiniteInt(config.aiCount) || 0),
        mapFeature: config.mapFeature || defaults.mapFeature || 'none',
        mapMutator: config.mapMutator || defaults.mapMutator || 'none',
        tuneOverrides: config.tuneOverrides || null,
        doctrineId: config.doctrineId || defaults.doctrineId || 'auto',
        encounters: Array.isArray(config.encounters) ? config.encounters : [],
        playlist: config.playlist || defaults.playlist || 'standard',
        forcePlaylistOverrides: true,
    });
    return {
        mode: 'standard',
        modeLabel: 'Standart',
        challengeKey: '',
        challengeTitle: '',
        challengeBlurb: '',
        seed: String(playlistResolved.seed || defaults.seed),
        nodeCount: normalizeNodeCount(playlistResolved.nodeCount, options),
        difficulty: normalizeDifficulty(playlistResolved.difficulty, options),
        fogEnabled: playlistResolved.fogEnabled === true,
        rulesMode: normalizeRulesMode(playlistResolved.rulesMode, options),
        aiCount: Math.max(0, toFiniteInt(playlistResolved.aiCount) || 0),
        mapFeature: playlistResolved.mapFeature || defaults.mapFeature || 'none',
        mapMutator: playlistResolved.mapMutator || defaults.mapMutator || 'none',
        playlist: playlistResolved.playlist || 'standard',
        playlistLabel: playlistResolved.playlistLabel || playlistName(playlistResolved.playlist || 'standard'),
        playlistBlurb: playlistResolved.playlistBlurb || '',
        doctrineId: playlistResolved.doctrineId && playlistResolved.doctrineId !== 'auto' ? normalizeDoctrineId(playlistResolved.doctrineId) : '',
        encounters: Array.isArray(playlistResolved.encounters) ? playlistResolved.encounters : [],
        tuneOverrides: playlistResolved.tuneOverrides || null,
        objectives: [],
        missionScript: null,
        hint: '',
        endOnObjectives: false,
    };
}

export function buildDailyMatchManifest(dateKey, options) {
    options = options || {};
    var defaults = pickDefaults(options);
    var challenge = buildDailyChallenge(normalizeChallengeDate(dateKey, options));
    return {
        mode: 'daily',
        modeLabel: 'Gunluk Challenge',
        challengeKey: challenge.key,
        challengeTitle: challenge.title,
        challengeBlurb: challenge.blurb,
        seed: challenge.seed || defaults.seed,
        nodeCount: Number(challenge.nc) || defaults.nodeCount,
        difficulty: normalizeDifficulty(challenge.diff, options),
        fogEnabled: !!challenge.fog,
        rulesMode: normalizeRulesMode(challenge.rulesMode, options),
        aiCount: Math.max(0, toFiniteInt(challenge.aiCount) || 0),
        mapFeature: challenge.mapFeature || defaults.mapFeature || 'none',
        mapMutator: challenge.mapMutator || defaults.mapMutator || 'none',
        playlist: challenge.playlist || 'standard',
        playlistLabel: playlistName(challenge.playlist || 'standard'),
        playlistBlurb: '',
        doctrineId: challenge.doctrineId ? normalizeDoctrineId(challenge.doctrineId) : '',
        encounters: Array.isArray(challenge.encounters) ? challenge.encounters : [],
        objectives: Array.isArray(challenge.objectives) ? challenge.objectives : [],
        missionScript: challenge.missionScript || null,
        hint: challenge.hint || '',
        endOnObjectives: challenge.endOnObjectives === true,
        challenge: challenge,
    };
}

export function buildCustomMatchManifest(config, options) {
    config = config || {};
    options = options || {};
    var customMap = normalizeCustomMapConfig(config.customMap || {});
    var requestedHumans = toFiniteInt(options.humanCount);
    if (requestedHumans === null) requestedHumans = Math.max(1, toFiniteInt(config.humanCount) || 1);
    var humanCount = Math.max(1, Math.min(customMap.playerCount, requestedHumans));
    return {
        mode: 'custom',
        modeLabel: 'Custom Harita',
        challengeKey: '',
        challengeTitle: '',
        challengeBlurb: '',
        seed: customMap.seed,
        nodeCount: customMap.nodes.length,
        difficulty: customMap.difficulty,
        fogEnabled: customMap.fogEnabled === true,
        rulesMode: customMap.rulesMode,
        aiCount: Math.max(0, customMap.playerCount - humanCount),
        mapFeature: customMap.mapFeature || { type: 'none' },
        mapMutator: customMap.mapMutator || { type: 'none' },
        playlist: customMap.playlist || 'standard',
        playlistLabel: playlistName(customMap.playlist || 'standard'),
        playlistBlurb: '',
        doctrineId: customMap.doctrineId ? normalizeDoctrineId(customMap.doctrineId) : '',
        encounters: Array.isArray(customMap.encounters) ? customMap.encounters : [],
        objectives: [],
        missionScript: customMap.missionScript || null,
        hint: '',
        endOnObjectives: customMap.endOnObjectives === true,
        customMapName: customMap.name,
        customMap: customMap,
        playerCount: customMap.playerCount,
        tuneOverrides: customMap.tuneOverrides || null,
    };
}

export function buildRoomMatchManifest(roomOrConfig, options) {
    options = options || {};
    var config = roomOrConfig && roomOrConfig.config ? roomOrConfig.config : (roomOrConfig || pickDefaults(options));
    var mode = normalizeRoomMode(config.mode, options);
    if (mode === 'daily') {
        return buildDailyMatchManifest(config.challengeDate || config.challengeKey, options);
    }
    if (mode === 'custom') {
        return buildCustomMatchManifest(config, {
            defaults: options.defaults,
            timeZone: options.timeZone,
            humanCount: roomOrConfig && Array.isArray(roomOrConfig.players) ? roomOrConfig.players.length : options.humanCount,
        });
    }
    return buildStandardMatchManifest(config, options);
}

export function normalizeRoomConfig(payload, options) {
    payload = payload || {};
    options = options || {};
    var mode = normalizeRoomMode(payload.mode, options);
    if (mode === 'daily') {
        var manifest = buildDailyMatchManifest(payload.challengeDate, options);
        return {
            mode: mode,
            challengeDate: manifest.challengeKey,
            challengeKey: manifest.challengeKey,
            challengeTitle: manifest.challengeTitle,
            seed: manifest.seed,
            nodeCount: manifest.nodeCount,
            difficulty: manifest.difficulty,
            fogEnabled: manifest.fogEnabled,
            rulesMode: manifest.rulesMode,
            aiCount: manifest.aiCount,
            mapFeature: manifest.mapFeature,
            mapMutator: manifest.mapMutator,
            playlist: manifest.playlist,
            doctrineId: manifest.doctrineId,
            encounters: manifest.encounters,
        };
    }
    if (mode === 'custom') {
        var customManifest = buildCustomMatchManifest(payload, options);
        return {
            mode: mode,
            customMapName: customManifest.customMapName,
            customMap: customManifest.customMap,
            seed: customManifest.seed,
            nodeCount: customManifest.nodeCount,
            difficulty: customManifest.difficulty,
            fogEnabled: customManifest.fogEnabled,
            rulesMode: customManifest.rulesMode,
            aiCount: customManifest.aiCount,
            mapFeature: customManifest.mapFeature,
            mapMutator: customManifest.mapMutator,
            playlist: customManifest.playlist,
            doctrineId: customManifest.doctrineId,
            encounters: customManifest.encounters,
            playerCount: customManifest.playerCount,
            tuneOverrides: customManifest.tuneOverrides,
        };
    }
    var defaults = pickDefaults(options);
    return {
        mode: mode,
        seed: String(payload.seed || defaults.seed),
        nodeCount: normalizeNodeCount(payload.nodeCount, options),
        difficulty: normalizeDifficulty(payload.difficulty, options),
        fogEnabled: payload.fogEnabled === true,
        rulesMode: normalizeRulesMode(payload.rulesMode, options),
        aiCount: Math.max(0, toFiniteInt(payload.aiCount) || 0),
        mapFeature: payload.mapFeature || defaults.mapFeature || 'none',
        mapMutator: payload.mapMutator || defaults.mapMutator || 'none',
        playlist: payload.playlist || defaults.playlist || 'standard',
        doctrineId: payload.doctrineId || defaults.doctrineId || 'auto',
        encounters: Array.isArray(payload.encounters) ? payload.encounters : [],
        tuneOverrides: payload.tuneOverrides || null,
    };
}
