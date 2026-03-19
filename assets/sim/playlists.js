function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeTuneOverrides(base, extra) {
    base = base && typeof base === 'object' ? cloneValue(base) : {};
    extra = extra && typeof extra === 'object' ? extra : {};
    for (var key in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
        base[key] = extra[key];
    }
    return Object.keys(base).length ? base : null;
}

function hasTuneOverrides(value) {
    return !!(value && typeof value === 'object' && Object.keys(value).length);
}

export var PLAYLIST_DEFS = {
    standard: {
        id: 'standard',
        label: 'Standart',
        blurb: 'Varsayilan kurallar. Harita tohumu oyunun kimligini belirler.',
    },
    chaos: {
        id: 'chaos',
        label: 'Chaos',
        blurb: 'Anomali, mutator ve kusatma hedefleri hizli tempoda ust uste biner.',
        aiCount: 3,
        mapFeature: 'auto',
        mapMutator: 'auto',
        doctrineId: 'siege',
        encounters: [{ type: 'mega_turret' }],
        tuneOverrides: { aiAgg: 1.28, flowInt: 12 },
    },
    ironman: {
        id: 'ironman',
        label: 'Ironman',
        blurb: 'Daha sert ekonomi ve karanlik alanlarla hata payi azalir.',
        difficulty: 'hard',
        fogEnabled: true,
        mapMutator: 'blackout',
        doctrineId: 'logistics',
        tuneOverrides: { prod: 0.94, def: 1.08, aiAssist: false },
    },
    puzzle: {
        id: 'puzzle',
        label: 'Puzzle Sector',
        blurb: 'Daha kucuk, daha belirgin ve objective odakli sektorler.',
        nodeCount: 12,
        aiCount: 1,
        difficulty: 'normal',
        mapFeature: 'barrier',
        mapMutator: 'blackout',
        doctrineId: 'assimilation',
        encounters: [{ type: 'relay_core' }],
        tuneOverrides: { aiAgg: 0.92, aiBuf: 7, flowInt: 17 },
    },
    zen: {
        id: 'zen',
        label: 'Zen',
        blurb: 'Daha yavas acilis, daha okunur ritim. Sistemi ogrenmek icin uygun.',
        nodeCount: 14,
        aiCount: 1,
        difficulty: 'easy',
        fogEnabled: false,
        mapFeature: 'gravity',
        mapMutator: 'ion_storm',
        doctrineId: 'logistics',
        tuneOverrides: { prod: 1.05, aiAgg: 0.74, aiBuf: 9, flowInt: 19 },
    },
    frontier: {
        id: 'frontier',
        label: 'Frontier',
        blurb: 'Daha buyuk sektor, daha cok baski noktasi ve iki objective birden.',
        nodeCount: 20,
        aiCount: 3,
        difficulty: 'hard',
        mapFeature: 'auto',
        mapMutator: 'auto',
        doctrineId: 'siege',
        encounters: [{ type: 'relay_core' }, { type: 'mega_turret' }],
        tuneOverrides: { aiAgg: 1.18, aiBuf: 4, flowInt: 13 },
    },
};

var PLAYLIST_IDS = Object.keys(PLAYLIST_DEFS);

export function normalizePlaylistId(raw) {
    var value = String(raw || '').toLowerCase();
    if (PLAYLIST_DEFS[value]) return value;
    return 'standard';
}

export function playlistDef(raw) {
    return PLAYLIST_DEFS[normalizePlaylistId(raw)];
}

export function playlistName(raw) {
    return playlistDef(raw).label;
}

export function playlistSummary(raw) {
    var def = playlistDef(raw);
    return def.label + ': ' + def.blurb;
}

export function playlistOptionList() {
    return PLAYLIST_IDS.map(function (id) {
        var def = PLAYLIST_DEFS[id];
        return {
            id: def.id,
            label: def.label,
            blurb: def.blurb,
        };
    });
}

export function resolvePlaylistConfig(config) {
    config = config && typeof config === 'object' ? cloneValue(config) : {};
    var playlistId = normalizePlaylistId(config.playlist || config.playlistId);
    var def = playlistDef(playlistId);
    var resolved = cloneValue(config);
    var forceOverrides = config.forcePlaylistOverrides === true;
    resolved.playlist = playlistId;
    resolved.playlistLabel = def.label;
    resolved.playlistBlurb = def.blurb;

    if (playlistId === 'standard') return resolved;

    if (def.nodeCount !== undefined && (forceOverrides || resolved.nodeCount === undefined || resolved.nodeCount === null)) resolved.nodeCount = def.nodeCount;
    if (def.aiCount !== undefined && (forceOverrides || resolved.aiCount === undefined || resolved.aiCount === null)) resolved.aiCount = def.aiCount;
    if (def.difficulty && (forceOverrides || !resolved.difficulty)) resolved.difficulty = def.difficulty;
    if (def.fogEnabled !== undefined && (forceOverrides || resolved.fogEnabled === undefined || resolved.fogEnabled === null)) resolved.fogEnabled = def.fogEnabled;
    if (def.rulesMode && (forceOverrides || !resolved.rulesMode)) resolved.rulesMode = def.rulesMode;
    if (def.mapFeature !== undefined && (forceOverrides || !resolved.mapFeature || resolved.mapFeature === 'none' || resolved.mapFeature.type === 'none')) resolved.mapFeature = cloneValue(def.mapFeature);
    if (def.mapMutator !== undefined && (forceOverrides || !resolved.mapMutator || resolved.mapMutator === 'none' || resolved.mapMutator === 'auto' || resolved.mapMutator.type === 'none')) resolved.mapMutator = cloneValue(def.mapMutator);
    if (def.tuneOverrides && typeof def.tuneOverrides === 'object') {
        if (forceOverrides) resolved.tuneOverrides = mergeTuneOverrides(resolved.tuneOverrides, def.tuneOverrides);
        else resolved.tuneOverrides = mergeTuneOverrides(def.tuneOverrides, resolved.tuneOverrides);
    }
    if (!resolved.doctrineId || resolved.doctrineId === 'auto') resolved.doctrineId = def.doctrineId || resolved.doctrineId;
    if (!Array.isArray(resolved.encounters) || !resolved.encounters.length) resolved.encounters = cloneValue(def.encounters || []);
    return resolved;
}
