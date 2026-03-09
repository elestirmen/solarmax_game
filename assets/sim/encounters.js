import { hashSeed, isNodeAssimilated, nodeCapacity } from './shared_config.js';

export var ENCOUNTER_DEFS = {
    mega_turret: {
        id: 'mega_turret',
        label: 'Mega Turret',
        blurb: 'Genis menzilli sabit savunma. Dusurulurse hat acilir.',
    },
    relay_core: {
        id: 'relay_core',
        label: 'Relay Core',
        blurb: 'Ele gecirilirse supply omurgasina tempo ve uretim kazandirir.',
    },
};

function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function dist(a, b) {
    var dx = (Number(b && b.x) || 0) - (Number(a && a.x) || 0);
    var dy = (Number(b && b.y) || 0) - (Number(a && a.y) || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeEncounterType(raw) {
    var value = String(raw || '').toLowerCase();
    if (ENCOUNTER_DEFS[value]) return value;
    return '';
}

function normalizeControlTicks(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var result = {};
    for (var key in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
        var tickCount = Math.max(0, Math.floor(Number(raw[key]) || 0));
        if (tickCount > 0) result[key] = tickCount;
    }
    return result;
}

function pickEncounterNode(type, nodes, usedIds) {
    usedIds = usedIds || {};
    nodes = Array.isArray(nodes) ? nodes : [];
    var center = { x: 800, y: 500 };
    var candidates = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || !node.pos || usedIds[node.id]) continue;
        if (node.gate) continue;
        if (node.owner !== -1) continue;
        if (type === 'mega_turret' && node.kind === 'turret') {
            candidates.push({ node: node, score: 240 - dist(node.pos, center) + (Number(node.radius) || 0) * 0.6 });
            continue;
        }
        if (type === 'mega_turret' && node.kind !== 'turret') {
            candidates.push({ node: node, score: 180 - dist(node.pos, center) + (Number(node.radius) || 0) * 0.8 });
            continue;
        }
        if (type === 'relay_core' && node.kind !== 'turret') {
            candidates.push({ node: node, score: 220 - dist(node.pos, center) + (Number(node.radius) || 0) * 0.7 + (node.strategic ? 22 : 0) });
        }
    }
    if (!candidates.length) return -1;
    candidates.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.node.id - b.node.id;
    });
    return candidates[0].node.id;
}

function applyMegaTurret(node) {
    if (!node) return;
    node.kind = 'turret';
    node.level = Math.max(2, Math.floor(Number(node.level) || 1));
    node.defense = false;
    node.assimilationProgress = 1;
    node.assimilationLock = 0;
    node.turretRangeMult = 1.34;
    node.turretDpsMult = 1.45;
    node.turretCaptureResistMult = 1.3;
    node.maxUnits = nodeCapacity(node);
    node.units = clamp(Math.max(Number(node.units) || 0, 38), 1, Math.max(1, node.maxUnits - 1));
}

function applyRelayCore(node) {
    if (!node) return;
    node.kind = 'relay';
    node.level = Math.max(2, Math.floor(Number(node.level) || 1));
    node.defense = false;
    node.strategic = true;
    node.maxUnits = nodeCapacity(node);
    node.units = clamp(Math.max(Number(node.units) || 0, 26), 1, Math.max(1, node.maxUnits - 1));
}

export function encounterName(raw) {
    var type = normalizeEncounterType(raw && raw.type ? raw.type : raw);
    return type ? ENCOUNTER_DEFS[type].label : 'Encounter';
}

export function encounterHint(raw) {
    var type = normalizeEncounterType(raw && raw.type ? raw.type : raw);
    return type ? ENCOUNTER_DEFS[type].blurb : '';
}

export function normalizeEncounterList(rawEncounters, nodes, seed) {
    rawEncounters = Array.isArray(rawEncounters) ? rawEncounters : (rawEncounters ? [rawEncounters] : []);
    nodes = Array.isArray(nodes) ? nodes : [];
    var usedIds = {};
    var normalized = [];
    var seedValue = Number(seed);
    if (!Number.isFinite(seedValue)) seedValue = hashSeed(seed || 'encounters');

    for (var i = 0; i < rawEncounters.length; i++) {
        var raw = rawEncounters[i];
        var config = typeof raw === 'string' ? { type: raw } : (raw && typeof raw === 'object' ? cloneValue(raw) : {});
        var type = normalizeEncounterType(config.type);
        if (!type) continue;
        var nodeId = Math.floor(Number(config.nodeId));
        if (!Number.isFinite(nodeId) || !nodes[nodeId] || usedIds[nodeId]) {
            nodeId = pickEncounterNode(type, nodes, usedIds);
        }
        if (nodeId < 0 || !nodes[nodeId]) continue;
        usedIds[nodeId] = true;
        normalized.push({
            id: String(config.id || (type + '-' + (i + 1))).slice(0, 48),
            type: type,
            nodeId: nodeId,
            controlTicksByPlayer: normalizeControlTicks(config.controlTicksByPlayer),
            owner: Number(config.owner),
            assimilated: config.assimilated === true,
            seed: seedValue,
        });
    }
    return normalized;
}

export function applyEncountersToNodes(encounters, nodes) {
    encounters = Array.isArray(encounters) ? encounters : [];
    nodes = Array.isArray(nodes) ? nodes : [];
    for (var i = 0; i < encounters.length; i++) {
        var encounter = encounters[i];
        var node = nodes[encounter.nodeId];
        if (!node) continue;
        node.encounterType = encounter.type;
        node.encounterId = encounter.id;
        if (encounter.type === 'mega_turret') applyMegaTurret(node);
        else if (encounter.type === 'relay_core') applyRelayCore(node);
    }
    return encounters;
}

export function buildEncounterState(rawEncounters, nodes, seed) {
    var encounters = normalizeEncounterList(rawEncounters, nodes, seed);
    applyEncountersToNodes(encounters, nodes);
    return encounters;
}

export function stepEncounterState(state) {
    state = state || {};
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    state.encounters = Array.isArray(state.encounters) ? state.encounters : [];
    var relayCoreCountByPlayer = {};

    for (var i = 0; i < state.encounters.length; i++) {
        var encounter = state.encounters[i];
        var node = nodes[encounter.nodeId];
        if (!node) continue;
        encounter.owner = Number(node.owner);
        encounter.assimilated = isNodeAssimilated(node);
        encounter.controlTicksByPlayer = normalizeControlTicks(encounter.controlTicksByPlayer);
        if (encounter.owner >= 0 && encounter.assimilated) {
            encounter.controlTicksByPlayer[encounter.owner] = (Number(encounter.controlTicksByPlayer[encounter.owner]) || 0) + 1;
            if (encounter.type === 'relay_core') {
                relayCoreCountByPlayer[encounter.owner] = (relayCoreCountByPlayer[encounter.owner] || 0) + 1;
            }
        }
    }

    state.encounterContext = {
        relayCoreCountByPlayer: relayCoreCountByPlayer,
    };
    return state.encounters;
}

export function encounterSummary(encounters) {
    encounters = Array.isArray(encounters) ? encounters : [];
    if (!encounters.length) return 'Encounter yok';
    return encounters.map(function (encounter) {
        return encounterName(encounter);
    }).join(' | ');
}
