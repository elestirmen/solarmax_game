import { selectBarrierGateIds } from './barrier_layout.js';
import { normalizeNodeKindForRuleset } from './ruleset.js';
import { PLAYER_COLORS, SIM_CONSTANTS, difficultyConfig, nodeCapacity } from './shared_config.js';

var MAP_W = 1600;
var MAP_H = 1000;
var MAP_PAD = 80;
var NODE_RMIN = 18;
var NODE_RMAX = 36;
var NODE_MINDIST = 100;
var NEUTRAL_MAX = 20;
var GRAVITY_RADIUS = 170;

export function RNG(seed) {
    this.s = seed | 0;
    if (!this.s) this.s = 1;
}

RNG.prototype.next = function () {
    var t = this.s += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

RNG.prototype.nextInt = function (a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
};

RNG.prototype.nextFloat = function (a, b) {
    return a + this.next() * (b - a);
};

function dist(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

export function spawnAnchors(playerCount) {
    playerCount = Math.max(1, Math.floor(playerCount || 1));
    var anchors = [];
    var cx = MAP_W * 0.5;
    var cy = MAP_H * 0.5;
    var rx = MAP_W * 0.5 - MAP_PAD;
    var ry = MAP_H * 0.5 - MAP_PAD;
    var startAngle = -Math.PI * 0.75;
    for (var i = 0; i < playerCount; i++) {
        var ang = startAngle + (Math.PI * 2 * i) / playerCount;
        anchors.push({ x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry });
    }
    return anchors;
}

function initNodeKind(node, rng) {
    var roll = rng.next();
    if (roll < 0.18) node.kind = 'forge';
    else if (roll < 0.36) node.kind = 'bulwark';
    else if (roll < 0.52) node.kind = 'relay';
    else if (roll < 0.65) node.kind = 'nexus';
    else node.kind = 'core';
    node.level = 1;
    node.maxUnits = nodeCapacity(node);
}

function buildBaseNode(id, x, y, radius, units, rng) {
    var node = {
        id: id,
        pos: { x: x, y: y },
        radius: radius,
        owner: -1,
        units: units,
        prodAcc: 0,
        maxUnits: 200,
        visionR: SIM_CONSTANTS.VISION_R + radius * 2,
        selected: false,
        kind: 'core',
        level: 1,
        defense: false,
        strategic: false,
        gate: false,
        assimilationProgress: 1,
        assimilationLock: 0,
    };
    initNodeKind(node, rng);
    node.maxUnits = nodeCapacity(node);
    node.units = Math.min(node.units, Math.max(2, Math.floor(node.maxUnits * 0.4)));
    return node;
}

function applyRulesetNodeKinds(nodes, rulesMode) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        node.kind = normalizeNodeKindForRuleset(node.kind, rulesMode);
        node.maxUnits = nodeCapacity(node);
        if (node.units > node.maxUnits) node.units = node.maxUnits;
    }
}

function placeWormholeFeature(state) {
    var bestA = -1;
    var bestB = -1;
    var bestD = -1;
    for (var i = 0; i < state.nodes.length; i++) {
        for (var j = i + 1; j < state.nodes.length; j++) {
            var a = state.nodes[i];
            var b = state.nodes[j];
            if (a.owner !== -1 || b.owner !== -1 || a.kind === 'turret' || b.kind === 'turret') continue;
            var d = dist(a.pos, b.pos);
            if (d > bestD) {
                bestD = d;
                bestA = a.id;
                bestB = b.id;
            }
        }
    }
    if (bestA < 0) return false;
    state.wormholes = [{ a: bestA, b: bestB }];
    state.nodes[bestA].kind = 'relay';
    state.nodes[bestB].kind = 'relay';
    state.nodes[bestA].maxUnits = nodeCapacity(state.nodes[bestA]);
    state.nodes[bestB].maxUnits = nodeCapacity(state.nodes[bestB]);
    state.mapFeature = { type: 'wormhole', a: bestA, b: bestB };
    return true;
}

function placeGravityFeature(state) {
    var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
    var bestNode = null;
    var bestCenterDist = Infinity;
    for (var n = 0; n < state.nodes.length; n++) {
        var node = state.nodes[n];
        if (node.owner !== -1 || node.kind === 'turret') continue;
        var cd = dist(node.pos, center);
        if (cd < bestCenterDist) {
            bestCenterDist = cd;
            bestNode = node;
        }
    }
    if (!bestNode) return false;
    state.mapFeature = { type: 'gravity', nodeId: bestNode.id, x: bestNode.pos.x, y: bestNode.pos.y, r: GRAVITY_RADIUS };
    bestNode.kind = 'core';
    bestNode.maxUnits = nodeCapacity(bestNode);
    if (bestNode.units > bestNode.maxUnits) bestNode.units = bestNode.maxUnits;
    return true;
}

function placeBarrierFeature(state) {
    var barrierX = MAP_W * 0.5;
    var gateIds = selectBarrierGateIds({
        nodes: state.nodes,
        barrierX: barrierX,
        targetGateCount: state.nodes.length > 12 && state.rng.next() < 0.55 ? 2 : 1,
        minVerticalGap: 120,
    });
    if (!gateIds.length) return false;

    for (var i = 0; i < state.nodes.length; i++) state.nodes[i].gate = false;
    for (var g = 0; g < gateIds.length; g++) {
        var gate = state.nodes[gateIds[g]];
        if (gate.kind === 'turret') {
            gate.kind = normalizeNodeKindForRuleset('core', state.rulesMode);
            gate.level = 1;
        }
        gate.gate = true;
        gate.assimilationProgress = 1;
        gate.assimilationLock = 0;
        gate.maxUnits = nodeCapacity(gate);
        if (gate.units > gate.maxUnits) gate.units = gate.maxUnits;
    }
    state.mapFeature = { type: 'barrier', x: barrierX, gateIds: gateIds.slice() };
    return true;
}

function applyMapFeature(state, cfg, diffCfg) {
    cfg = cfg || {};
    state.wormholes = [];
    for (var ni = 0; ni < state.nodes.length; ni++) state.nodes[ni].gate = false;
    state.mapFeature = { type: 'none' };
    if (state.nodes.length < 8) return;

    var forcedType = cfg.type || 'auto';
    if (forcedType === 'none') return;
    if (forcedType === 'wormhole') { placeWormholeFeature(state); return; }
    if (forcedType === 'gravity') { placeGravityFeature(state); return; }
    if (forcedType === 'barrier') { placeBarrierFeature(state); return; }

    var featureChance = typeof cfg.chance === 'number' ? clamp(cfg.chance, 0, 1) : diffCfg.featureChance;
    if (state.rng.next() > featureChance) return;

    var featureRoll = state.rng.next();
    if (featureRoll < 0.34) {
        if (!placeWormholeFeature(state)) {
            if (!placeGravityFeature(state)) placeBarrierFeature(state);
        }
    } else if (featureRoll < 0.68) {
        if (!placeGravityFeature(state)) {
            if (!placeBarrierFeature(state)) placeWormholeFeature(state);
        }
    } else {
        if (!placeBarrierFeature(state)) {
            if (!placeWormholeFeature(state)) placeGravityFeature(state);
        }
    }
}

export function buildInitialMatchSnapshot(manifest, players) {
    manifest = manifest || {};
    players = Array.isArray(players) ? players : [];

    var seed = isNaN(Number(manifest.seed)) ? Number(manifest.seed) : Number(manifest.seed);
    if (!Number.isFinite(seed)) seed = 42;
    var rng = new RNG(seed);
    var diffCfg = difficultyConfig(manifest.difficulty || 'normal');
    var nodeCount = Math.max(8, Math.floor(Number(manifest.nodeCount) || 16));
    var nodes = [];
    var attempts = 0;
    var placed = 0;
    var minDist = NODE_MINDIST;

    while (placed < nodeCount && attempts < 4500) {
        if (attempts === 1400 || attempts === 2800) minDist *= 0.9;
        var x = rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD);
        var y = rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD);
        var radius = rng.nextFloat(NODE_RMIN, NODE_RMAX);
        var ok = true;
        for (var i = 0; i < nodes.length; i++) {
            if (dist({ x: x, y: y }, nodes[i].pos) < minDist) {
                ok = false;
                break;
            }
        }
        if (ok) {
            nodes.push(buildBaseNode(placed, x, y, radius, rng.nextInt(2, NEUTRAL_MAX), rng));
            placed++;
        }
        attempts++;
    }

    while (placed < nodeCount) {
        var fx = rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD);
        var fy = rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD);
        var fr = rng.nextFloat(NODE_RMIN, NODE_RMAX);
        nodes.push(buildBaseNode(placed, fx, fy, fr, rng.nextInt(2, NEUTRAL_MAX), rng));
        placed++;
    }

    var playerCapital = {};
    var anchors = spawnAnchors(players.length || 1);
    for (var p = 0; p < players.length; p++) {
        var anchor = anchors[p % anchors.length];
        var best = null;
        var bestDist = Infinity;
        for (var n = 0; n < nodes.length; n++) {
            var candidate = nodes[n];
            if (candidate.owner !== -1) continue;
            var d = dist(candidate.pos, anchor);
            if (d < bestDist) {
                bestDist = d;
                best = candidate;
            }
        }
        if (!best) continue;
        best.owner = p;
        best.assimilationProgress = 1;
        best.assimilationLock = 0;
        best.kind = 'core';
        best.level = 2;
        best.maxUnits = nodeCapacity(best);
        best.defense = false;
        var isBot = !!(players[p] && players[p].botControlled);
        var startBoost = isBot ? diffCfg.aiStartBoost : diffCfg.humanStartBoost;
        var baseUnits = isBot ? 18 : 20;
        best.units = Math.min(best.maxUnits - 2, Math.max(12, Math.floor(baseUnits * startBoost)));
        best.radius = Math.max(best.radius, 28);
        playerCapital[p] = best.id;
    }

    var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
    var strategicNodes = [];
    for (var si = 0; si < nodes.length; si++) {
        var node = nodes[si];
        if (dist(node.pos, center) >= MAP_W * 0.35 || node.owner !== -1) continue;
        var neighborCount = 0;
        for (var sj = 0; sj < nodes.length; sj++) {
            if (sj !== si && dist(nodes[sj].pos, node.pos) < SIM_CONSTANTS.SUPPLY_DIST * 1.2) neighborCount++;
        }
        if (neighborCount >= 3) {
            node.strategic = true;
            strategicNodes.push(node.id);
        }
    }
    if (!strategicNodes.length) {
        var fallback = null;
        var fallbackDist = Infinity;
        for (var f = 0; f < nodes.length; f++) {
            if (nodes[f].owner !== -1) continue;
            var fd = dist(nodes[f].pos, center);
            if (fd < fallbackDist) {
                fallbackDist = fd;
                fallback = nodes[f];
            }
        }
        if (!fallback) {
            for (var a = 0; a < nodes.length; a++) {
                var ad = dist(nodes[a].pos, center);
                if (ad < fallbackDist) {
                    fallbackDist = ad;
                    fallback = nodes[a];
                }
            }
        }
        if (fallback) {
            fallback.strategic = true;
            strategicNodes.push(fallback.id);
        }
    }

    var neutralNodes = [];
    for (var nn = 0; nn < nodes.length; nn++) if (nodes[nn].owner === -1) neutralNodes.push(nodes[nn]);
    neutralNodes.sort(function (a, b) {
        var ad = Math.abs(a.pos.x - center.x);
        var bd = Math.abs(b.pos.x - center.x);
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });
    var turretCount = Math.min(neutralNodes.length, rng.nextInt(1, 3));
    for (var ti = 0; ti < turretCount; ti++) {
        var turret = neutralNodes[ti];
        turret.kind = 'turret';
        turret.level = 1;
        turret.maxUnits = nodeCapacity(turret);
        turret.units = Math.min(turret.maxUnits - 1, rng.nextInt(22, 34));
        turret.assimilationProgress = 1;
        turret.assimilationLock = 0;
    }

    var featureState = {
        nodes: nodes,
        wormholes: [],
        mapFeature: { type: 'none' },
        rng: rng,
        rulesMode: manifest.rulesMode || 'advanced',
    };
    applyMapFeature(featureState, typeof manifest.mapFeature === 'string' ? { type: manifest.mapFeature } : (manifest.mapFeature || {}), diffCfg);
    applyRulesetNodeKinds(nodes, manifest.rulesMode || 'advanced');

    var snapshotPlayers = [];
    for (var pi = 0; pi < players.length; pi++) {
        snapshotPlayers.push({
            idx: pi,
            alive: true,
            isAI: !!players[pi].botControlled,
            color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
        });
    }

    return {
        tick: 0,
        winner: -1,
        state: 'playing',
        nodes: nodes,
        fleets: [],
        flows: [],
        wormholes: featureState.wormholes,
        mapFeature: featureState.mapFeature,
        playerCapital: playerCapital,
        strategicNodes: strategicNodes,
        players: snapshotPlayers,
        aiTicks: snapshotPlayers.map(function () { return 0; }),
        aiProfiles: [],
        flowId: 0,
        fleetSerial: 0,
    };
}
