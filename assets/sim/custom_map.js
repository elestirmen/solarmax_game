var MAP_W = 1600;
var MAP_H = 1000;
var NODE_RMIN = 18;
var NODE_RMAX = 36;
var MAX_UNITS = 200;
var VALID_KINDS = {
    core: true,
    forge: true,
    bulwark: true,
    relay: true,
    nexus: true,
    turret: true,
};

function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function toInt(value, fallback) {
    value = Number(value);
    if (!Number.isFinite(value)) return fallback;
    return Math.floor(value);
}

function normalizeDifficulty(raw) {
    raw = String(raw || 'normal').toLowerCase();
    if (raw === 'easy' || raw === 'normal' || raw === 'hard') return raw;
    return 'normal';
}

function normalizeRulesMode(raw) {
    raw = String(raw || 'advanced').toLowerCase();
    return raw === 'classic' ? 'classic' : 'advanced';
}

function normalizeNodeKind(raw) {
    raw = String(raw || 'core').toLowerCase();
    return VALID_KINDS[raw] ? raw : 'core';
}

function sanitizeIndexList(value, maxExclusive, maxItems) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    var result = [];
    for (var i = 0; i < value.length; i++) {
        var idx = toInt(value[i], -1);
        if (idx < 0 || idx >= maxExclusive || seen[idx]) continue;
        seen[idx] = true;
        result.push(idx);
        if (maxItems && result.length >= maxItems) break;
    }
    return result;
}

function sanitizePlayerCapital(rawCapital, nodes, playerCount) {
    var capital = {};
    rawCapital = rawCapital && typeof rawCapital === 'object' ? rawCapital : {};
    for (var i = 0; i < playerCount; i++) {
        var rawValue = rawCapital[i];
        var explicitId = toInt(rawValue, -1);
        if (explicitId >= 0 && explicitId < nodes.length && nodes[explicitId].owner === i) {
            capital[i] = explicitId;
            continue;
        }
        for (var ni = 0; ni < nodes.length; ni++) {
            if (nodes[ni].owner === i) {
                capital[i] = nodes[ni].id;
                break;
            }
        }
    }
    return capital;
}

function sanitizeTuneOverrides(rawTune) {
    rawTune = rawTune && typeof rawTune === 'object' ? rawTune : null;
    if (!rawTune) return null;
    var tune = {};
    if (Number.isFinite(Number(rawTune.prod))) tune.prod = clamp(rawTune.prod, 0.1, 5);
    if (Number.isFinite(Number(rawTune.fspeed))) tune.fspeed = clamp(rawTune.fspeed, 20, 300);
    if (Number.isFinite(Number(rawTune.def))) tune.def = clamp(rawTune.def, 0.5, 3);
    if (Number.isFinite(Number(rawTune.flowInt))) tune.flowInt = clamp(rawTune.flowInt, 5, 60);
    if (Number.isFinite(Number(rawTune.aiAgg))) tune.aiAgg = clamp(rawTune.aiAgg, 0.1, 3);
    if (Number.isFinite(Number(rawTune.aiBuf))) tune.aiBuf = clamp(rawTune.aiBuf, 0, 20);
    if (Number.isFinite(Number(rawTune.aiInt))) tune.aiInt = clamp(rawTune.aiInt, 10, 120);
    if (typeof rawTune.fogEnabled === 'boolean') tune.fogEnabled = rawTune.fogEnabled;
    if (typeof rawTune.aiAssist === 'boolean') tune.aiAssist = rawTune.aiAssist;
    return Object.keys(tune).length ? tune : null;
}

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

export function normalizeCustomMapConfig(rawMap) {
    rawMap = rawMap && typeof rawMap === 'object' ? rawMap : {};
    var rawNodes = Array.isArray(rawMap.nodes) ? rawMap.nodes : [];
    var nodes = [];
    var maxOwner = -1;

    for (var i = 0; i < rawNodes.length && i < 60; i++) {
        var rawNode = rawNodes[i] && typeof rawNodes[i] === 'object' ? rawNodes[i] : {};
        var owner = toInt(rawNode.owner, -1);
        if (owner > maxOwner) maxOwner = owner;
        nodes.push({
            id: i,
            pos: {
                x: clamp(rawNode.pos && rawNode.pos.x !== undefined ? rawNode.pos.x : rawNode.x, 0, MAP_W),
                y: clamp(rawNode.pos && rawNode.pos.y !== undefined ? rawNode.pos.y : rawNode.y, 0, MAP_H),
            },
            radius: clamp(rawNode.radius, NODE_RMIN, NODE_RMAX),
            owner: owner,
            units: clamp(rawNode.units, 0, MAX_UNITS),
            prodAcc: clamp(rawNode.prodAcc, 0, 10),
            level: clamp(rawNode.level, 1, 3),
            kind: normalizeNodeKind(rawNode.kind),
            defense: rawNode.defense === true,
            strategic: rawNode.strategic === true,
            gate: rawNode.gate === true,
            assimilationProgress: clamp(rawNode.assimilationProgress === undefined ? 1 : rawNode.assimilationProgress, 0, 1),
            assimilationLock: clamp(rawNode.assimilationLock, 0, 600),
        });
    }

    var playerCount = clamp(rawMap.playerCount !== undefined ? rawMap.playerCount : (rawMap.players !== undefined ? rawMap.players : (maxOwner + 1 || 2)), 2, 6);
    for (var ni = 0; ni < nodes.length; ni++) {
        if (nodes[ni].owner >= playerCount) nodes[ni].owner = -1;
        if (nodes[ni].kind === 'turret') {
            nodes[ni].assimilationProgress = 1;
            nodes[ni].assimilationLock = 0;
        }
    }

    var rawFeature = rawMap.mapFeature && typeof rawMap.mapFeature === 'object' ? rawMap.mapFeature : { type: rawMap.mapFeature };
    var featureType = String(rawFeature.type || 'none').toLowerCase();
    if (featureType !== 'wormhole' && featureType !== 'gravity' && featureType !== 'barrier') featureType = 'none';

    var wormholes = [];
    var rawWormholes = Array.isArray(rawMap.wormholes) ? rawMap.wormholes : [];
    if (featureType === 'wormhole') {
        var pairSeen = {};
        for (var wi = 0; wi < rawWormholes.length && wormholes.length < 4; wi++) {
            var rawPair = rawWormholes[wi] || {};
            var a = toInt(rawPair.a, -1);
            var b = toInt(rawPair.b, -1);
            if (a < 0 || b < 0 || a >= nodes.length || b >= nodes.length || a === b) continue;
            var key = a < b ? (a + ':' + b) : (b + ':' + a);
            if (pairSeen[key]) continue;
            pairSeen[key] = true;
            wormholes.push({ a: a, b: b });
        }
    }

    var strategicNodes = sanitizeIndexList(rawMap.strategicNodes, nodes.length, 12);
    if (!strategicNodes.length) {
        for (var si = 0; si < nodes.length; si++) {
            if (nodes[si].strategic) strategicNodes.push(nodes[si].id);
        }
    }

    var mapFeature = { type: featureType };
    if (featureType === 'gravity') {
        mapFeature.x = clamp(rawFeature.x, 0, MAP_W);
        mapFeature.y = clamp(rawFeature.y, 0, MAP_H);
        mapFeature.r = clamp(rawFeature.r, 60, 260);
        mapFeature.nodeId = toInt(rawFeature.nodeId, -1);
        if (mapFeature.nodeId < 0 || mapFeature.nodeId >= nodes.length) mapFeature.nodeId = -1;
    } else if (featureType === 'barrier') {
        var gateIds = sanitizeIndexList(rawFeature.gateIds, nodes.length, 6);
        if (!gateIds.length) {
            for (var gi = 0; gi < nodes.length; gi++) {
                if (nodes[gi].gate) gateIds.push(nodes[gi].id);
            }
        }
        mapFeature.x = clamp(rawFeature.x, 0, MAP_W);
        mapFeature.gateIds = gateIds;
    } else if (featureType === 'wormhole') {
        if (!wormholes.length && nodes.length >= 2) wormholes.push({ a: 0, b: nodes.length - 1 });
    }

    var playerCapital = sanitizePlayerCapital(rawMap.playerCapital, nodes, playerCount);

    return {
        version: 1,
        kind: 'stellar-custom-map',
        name: String(rawMap.name || 'Ozel Harita').trim().slice(0, 60) || 'Ozel Harita',
        seed: String(rawMap.seed || 'custom-map').slice(0, 60) || 'custom-map',
        difficulty: normalizeDifficulty(rawMap.difficulty),
        fogEnabled: rawMap.fogEnabled === true,
        rulesMode: normalizeRulesMode(rawMap.rulesMode),
        playerCount: playerCount,
        nodes: nodes,
        wormholes: wormholes,
        mapFeature: mapFeature,
        strategicNodes: strategicNodes,
        playerCapital: playerCapital,
        tuneOverrides: sanitizeTuneOverrides(rawMap.tuneOverrides || rawMap.tune),
    };
}

export function buildCustomMapSnapshot(rawMap, players) {
    var customMap = normalizeCustomMapConfig(rawMap);
    players = Array.isArray(players) ? players : [];
    var totalPlayers = Math.max(customMap.playerCount, players.length || 0);
    var nodes = cloneValue(customMap.nodes);
    var mapFeature = cloneValue(customMap.mapFeature || { type: 'none' });
    var wormholes = cloneValue(customMap.wormholes || []);
    var playerCapital = cloneValue(customMap.playerCapital || {});

    if (mapFeature.type === 'barrier') {
        var gateIds = Array.isArray(mapFeature.gateIds) ? mapFeature.gateIds : [];
        for (var gi = 0; gi < gateIds.length; gi++) {
            if (nodes[gateIds[gi]]) nodes[gateIds[gi]].gate = true;
        }
    } else if (mapFeature.type === 'gravity' && mapFeature.nodeId >= 0 && nodes[mapFeature.nodeId]) {
        mapFeature.x = nodes[mapFeature.nodeId].pos.x;
        mapFeature.y = nodes[mapFeature.nodeId].pos.y;
    }

    var snapshotPlayers = [];
    for (var pi = 0; pi < totalPlayers; pi++) {
        var player = players[pi] || {};
        snapshotPlayers.push({
            idx: pi,
            alive: true,
            isAI: !!player.botControlled,
            color: player.color,
        });
    }

    return {
        tick: 0,
        winner: -1,
        state: 'playing',
        nodes: nodes,
        fleets: [],
        flows: [],
        wormholes: wormholes,
        mapFeature: mapFeature,
        playerCapital: playerCapital,
        strategicNodes: cloneValue(customMap.strategicNodes || []),
        players: snapshotPlayers,
        aiTicks: snapshotPlayers.map(function () { return 0; }),
        aiProfiles: [],
        flowId: 0,
        fleetSerial: 0,
    };
}

export function buildCustomMapExport(state, meta) {
    state = state && typeof state === 'object' ? state : {};
    meta = meta && typeof meta === 'object' ? meta : {};
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    var exportNodes = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i] || {};
        exportNodes.push({
            id: i,
            pos: { x: Number(node.pos && node.pos.x) || 0, y: Number(node.pos && node.pos.y) || 0 },
            radius: Number(node.radius) || NODE_RMIN,
            owner: toInt(node.owner, -1),
            units: Number(node.units) || 0,
            prodAcc: Number(node.prodAcc) || 0,
            level: toInt(node.level, 1),
            kind: normalizeNodeKind(node.kind),
            defense: node.defense === true,
            strategic: node.strategic === true,
            gate: node.gate === true,
            assimilationProgress: node.assimilationProgress === undefined ? 1 : Number(node.assimilationProgress) || 0,
            assimilationLock: toInt(node.assimilationLock, 0),
        });
    }

    return normalizeCustomMapConfig({
        name: meta.name || ('Harita ' + (meta.seed || state.seed || 'custom')),
        seed: meta.seed || state.seed || 'custom-map',
        difficulty: meta.difficulty || state.diff || 'normal',
        fogEnabled: meta.fogEnabled !== undefined ? meta.fogEnabled : !!(state.tune && state.tune.fogEnabled),
        rulesMode: meta.rulesMode || state.rulesMode || 'advanced',
        playerCount: meta.playerCount || (Array.isArray(state.players) ? state.players.length : 2),
        nodes: exportNodes,
        wormholes: Array.isArray(state.wormholes) ? state.wormholes : [],
        mapFeature: state.mapFeature || { type: 'none' },
        strategicNodes: Array.isArray(state.strategicNodes) ? state.strategicNodes : [],
        playerCapital: state.playerCapital || {},
        tuneOverrides: meta.tuneOverrides || state.tune || null,
    });
}
