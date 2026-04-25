import { AI_ARCHETYPES } from './shared_config.js';

export var DOCTRINE_DEFS = {
    logistics: {
        id: 'logistics',
        label: 'Lojistik',
        activeLabel: 'Overdrive',
        blurb: 'Supply altindaki ekonomi guclenir, filolar daha duzenli akar.',
        cooldownTicks: 900,
        activeTicks: 180,
        passive: {
            prodMult: 1,
            suppliedProdMult: 1.12,
            assimMult: 1,
            fleetSpeedMult: 1.04,
            attackMult: 0.95,
            turretAttackMult: 1,
        },
        active: {
            prodMult: 1.06,
            suppliedProdMult: 1.08,
            assimMult: 1,
            fleetSpeedMult: 1.18,
            attackMult: 1,
            turretAttackMult: 1,
        },
    },
    assimilation: {
        id: 'assimilation',
        label: 'Asimilasyon',
        activeLabel: 'Yakinsama',
        blurb: 'Yeni fetihler daha hizli oturur, cephe yerlesimi ivme kazanir.',
        cooldownTicks: 960,
        activeTicks: 180,
        passive: {
            prodMult: 1,
            suppliedProdMult: 1,
            assimMult: 1.38,
            fleetSpeedMult: 0.97,
            attackMult: 0.98,
            turretAttackMult: 1,
        },
        active: {
            prodMult: 1,
            suppliedProdMult: 1,
            assimMult: 1.82,
            fleetSpeedMult: 1.04,
            attackMult: 1.04,
            turretAttackMult: 1,
        },
    },
    siege: {
        id: 'siege',
        label: 'Kusatma',
        activeLabel: 'Yarma',
        blurb: 'Savunmali hedefler daha kolay dusurulur ama ekonomi biraz yavaslar.',
        cooldownTicks: 1020,
        activeTicks: 150,
        passive: {
            prodMult: 0.94,
            suppliedProdMult: 1,
            assimMult: 1,
            fleetSpeedMult: 1,
            attackMult: 1.1,
            turretAttackMult: 1.18,
        },
        active: {
            prodMult: 1,
            suppliedProdMult: 1,
            assimMult: 1,
            fleetSpeedMult: 1.03,
            attackMult: 1.22,
            turretAttackMult: 1.32,
        },
    },
};

var DOCTRINE_IDS = Object.keys(DOCTRINE_DEFS);

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

export function normalizeDoctrineId(raw) {
    var value = String(raw || '').toLowerCase();
    if (DOCTRINE_DEFS[value]) return value;
    return 'logistics';
}

export function doctrineDef(raw) {
    return DOCTRINE_DEFS[normalizeDoctrineId(raw)];
}

export function doctrineName(raw) {
    return doctrineDef(raw).label;
}

export function doctrineActiveName(raw) {
    return doctrineDef(raw).activeLabel;
}

export function doctrineSummary(raw) {
    var def = doctrineDef(raw);
    return def.label + ': ' + def.blurb;
}

export function createDoctrineState(raw) {
    return {
        id: normalizeDoctrineId(raw),
        cooldownTicks: 0,
        activeTicks: 0,
        activations: 0,
    };
}

function normalizedState(rawState, doctrineId) {
    var state = rawState && typeof rawState === 'object' ? cloneValue(rawState) : createDoctrineState(doctrineId);
    state.id = normalizeDoctrineId(state.id || doctrineId);
    state.cooldownTicks = Math.max(0, Math.floor(Number(state.cooldownTicks) || 0));
    state.activeTicks = Math.max(0, Math.floor(Number(state.activeTicks) || 0));
    state.activations = Math.max(0, Math.floor(Number(state.activations) || 0));
    return state;
}

function aiDoctrineForIndex(index) {
    var profile = AI_ARCHETYPES[(Math.max(1, Math.floor(Number(index) || 1)) - 1 + AI_ARCHETYPES.length) % AI_ARCHETYPES.length];
    if (!profile) return 'logistics';
    if (profile.name === 'Rusher') return 'siege';
    if (profile.name === 'Turtle') return 'assimilation';
    return 'logistics';
}

export function buildDoctrineLoadout(players, opts) {
    opts = opts || {};
    players = Array.isArray(players) ? players : [];
    var explicit = Array.isArray(opts.doctrines) ? opts.doctrines : [];
    var defaultDoctrine = normalizeDoctrineId(opts.doctrineId);
    var doctrines = [];
    for (var i = 0; i < players.length; i++) {
        var player = players[i] || {};
        var explicitDoctrine = explicit[i];
        var doctrineId = explicitDoctrine ? normalizeDoctrineId(explicitDoctrine) : (player.isAI ? aiDoctrineForIndex(i) : defaultDoctrine);
        doctrines.push(doctrineId);
    }
    return doctrines;
}

export function ensureDoctrineStates(doctrines, rawStates) {
    doctrines = Array.isArray(doctrines) ? doctrines : [];
    rawStates = Array.isArray(rawStates) ? rawStates : [];
    var states = [];
    for (var i = 0; i < doctrines.length; i++) {
        states.push(normalizedState(rawStates[i], doctrines[i]));
    }
    return states;
}

export function tickDoctrineStates(doctrines, rawStates) {
    var states = ensureDoctrineStates(doctrines, rawStates);
    for (var i = 0; i < states.length; i++) {
        if (states[i].cooldownTicks > 0) states[i].cooldownTicks--;
        if (states[i].activeTicks > 0) states[i].activeTicks--;
    }
    return states;
}

export function canActivateDoctrine(doctrines, rawStates, playerIndex) {
    if (Array.isArray(doctrines)) {
        if (!doctrines.length || !doctrines[playerIndex]) return false;
    } else if (!doctrines) {
        return false;
    }
    var doctrineId = Array.isArray(doctrines) ? doctrines[playerIndex] : doctrines;
    var def = doctrineDef(doctrineId);
    var states = ensureDoctrineStates(Array.isArray(doctrines) ? doctrines : [doctrineId], Array.isArray(rawStates) ? rawStates : [rawStates]);
    var state = states[Array.isArray(doctrines) ? playerIndex : 0];
    if (!def || !state) return false;
    return state.cooldownTicks <= 0 && state.activeTicks <= 0;
}

export function activateDoctrine(doctrines, rawStates, playerIndex) {
    var doctrineList = Array.isArray(doctrines) ? doctrines.slice() : [doctrines];
    var states = ensureDoctrineStates(doctrineList, Array.isArray(rawStates) ? rawStates : [rawStates]);
    var idx = Array.isArray(doctrines) ? playerIndex : 0;
    var def = doctrineDef(doctrineList[idx]);
    var state = states[idx];
    if (!def || !state || state.cooldownTicks > 0 || state.activeTicks > 0) {
        return {
            activated: false,
            states: states,
        };
    }
    state.id = def.id;
    state.activeTicks = def.activeTicks;
    state.cooldownTicks = def.cooldownTicks;
    state.activations = (Number(state.activations) || 0) + 1;
    return {
        activated: true,
        states: states,
        state: state,
        doctrine: def,
    };
}

function applyModifierSet(target, source) {
    source = source || {};
    if (source.prodMult) target.prodMult *= source.prodMult;
    if (source.suppliedProdMult) target.suppliedProdMult *= source.suppliedProdMult;
    if (source.assimMult) target.assimMult *= source.assimMult;
    if (source.fleetSpeedMult) target.fleetSpeedMult *= source.fleetSpeedMult;
    if (source.attackMult) target.attackMult *= source.attackMult;
    if (source.turretAttackMult) target.turretAttackMult *= source.turretAttackMult;
}

export function doctrineModifiers(doctrines, rawStates, playerIndex) {
    var doctrineId = Array.isArray(doctrines) ? doctrines[playerIndex] : doctrines;
    var def = doctrineDef(doctrineId);
    var states = ensureDoctrineStates(Array.isArray(doctrines) ? doctrines : [doctrineId], Array.isArray(rawStates) ? rawStates : [rawStates]);
    var state = states[Array.isArray(doctrines) ? playerIndex : 0];
    var result = {
        id: def.id,
        label: def.label,
        activeLabel: def.activeLabel,
        active: !!(state && state.activeTicks > 0),
        cooldownTicks: state ? state.cooldownTicks : 0,
        activeTicks: state ? state.activeTicks : 0,
        prodMult: 1,
        suppliedProdMult: 1,
        assimMult: 1,
        fleetSpeedMult: 1,
        attackMult: 1,
        turretAttackMult: 1,
    };
    applyModifierSet(result, def.passive);
    if (result.active) applyModifierSet(result, def.active);
    result.prodMult = clamp(result.prodMult, 0.5, 3);
    result.suppliedProdMult = clamp(result.suppliedProdMult, 0.5, 3);
    result.assimMult = clamp(result.assimMult, 0.5, 4);
    result.fleetSpeedMult = clamp(result.fleetSpeedMult, 0.5, 3);
    result.attackMult = clamp(result.attackMult, 0.5, 3);
    result.turretAttackMult = clamp(result.turretAttackMult, 0.5, 4);
    return result;
}

export function doctrineCooldownSummary(doctrines, rawStates, playerIndex) {
    var mods = doctrineModifiers(doctrines, rawStates, playerIndex);
    if (mods.active) return mods.activeLabel + ' aktif: ' + Math.max(1, Math.ceil(mods.activeTicks / 30)) + 's';
    if (mods.cooldownTicks > 0) return 'Hazır değil: ' + Math.max(1, Math.ceil(mods.cooldownTicks / 30)) + 's';
    return mods.activeLabel + ' hazır';
}

export function doctrineOptionList() {
    return DOCTRINE_IDS.map(function (id) {
        return {
            id: id,
            label: doctrineName(id),
            blurb: doctrineDef(id).blurb,
        };
    });
}
