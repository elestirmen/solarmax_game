import { hashMix, hashSeed } from './shared_config.js';

var MAP_W = 1600;
var MAP_H = 1000;
var DEFAULT_RADIUS = 170;

function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function dist(a, b) {
    var dx = (Number(b.x) || 0) - (Number(a.x) || 0);
    var dy = (Number(b.y) || 0) - (Number(a.y) || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function canonicalMutatorType(raw) {
    raw = String(raw || 'none').toLowerCase();
    if (raw === 'ion' || raw === 'ionstorm' || raw === 'ion-storm') return 'ion_storm';
    if (raw === 'blackout-zone' || raw === 'blackoutzone') return 'blackout';
    if (raw === 'ion_storm' || raw === 'blackout' || raw === 'auto') return raw;
    return 'none';
}

function hasExplicitArea(raw) {
    return !!(raw && typeof raw === 'object' &&
        Number.isFinite(Number(raw.x)) &&
        Number.isFinite(Number(raw.y)) &&
        Number.isFinite(Number(raw.r)));
}

function pickAnchorNode(nodes, seed, salt, opts) {
    opts = opts || {};
    nodes = Array.isArray(nodes) ? nodes : [];
    var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
    var candidates = nodes.filter(function (node) {
        return !!(node && node.pos && node.kind !== 'turret');
    });
    if (opts.preferNeutral) {
        var neutral = candidates.filter(function (node) { return node.owner === -1; });
        if (neutral.length) candidates = neutral;
    }
    if (!candidates.length) return null;

    var scored = candidates.map(function (node) {
        var centerDist = dist(node.pos, center);
        var edgeDist = Math.min(node.pos.x, MAP_W - node.pos.x, node.pos.y, MAP_H - node.pos.y);
        var ownerPenalty = node.owner >= 0 ? 140 : 0;
        var gatePenalty = node.gate ? 110 : 0;
        var strategicBonus = node.strategic ? -65 : 0;
        var score = centerDist + ownerPenalty + gatePenalty + strategicBonus - edgeDist * 0.08;
        var tie = hashMix(seed + salt, node.id, Math.max(0, node.owner) + 2, nodes.length);
        return { node: node, score: score, tie: tie };
    });

    scored.sort(function (a, b) {
        if (Math.abs(a.score - b.score) > 0.01) return a.score - b.score;
        return a.tie - b.tie;
    });

    var top = scored.slice(0, Math.min(6, scored.length));
    var pick = Math.min(top.length - 1, Math.floor(hashMix(seed + salt * 3, top.length, nodes.length, salt + 7) * top.length));
    return top[pick] ? top[pick].node : scored[0].node;
}

function generateIonStorm(nodes, seed) {
    var anchor = pickAnchorNode(nodes, seed, 19, { preferNeutral: true });
    if (!anchor) return { type: 'none' };
    return {
        type: 'ion_storm',
        x: Number(anchor.pos.x) || MAP_W * 0.5,
        y: Number(anchor.pos.y) || MAP_H * 0.5,
        r: clamp((Number(anchor.radius) || 24) * 3.8 + 98, 120, 235),
        speedMult: 0.72,
    };
}

function generateBlackout(nodes, seed) {
    var anchor = pickAnchorNode(nodes, seed, 41, { preferNeutral: false });
    if (!anchor) return { type: 'none' };
    return {
        type: 'blackout',
        x: Number(anchor.pos.x) || MAP_W * 0.5,
        y: Number(anchor.pos.y) || MAP_H * 0.5,
        r: clamp((Number(anchor.radius) || 24) * 4.1 + 106, 130, 245),
    };
}

export function normalizeMapMutator(raw) {
    var source = raw && typeof raw === 'object' ? raw : { type: raw };
    var type = canonicalMutatorType(source.type);
    var normalized = { type: type };

    if (type === 'auto' && Number.isFinite(Number(source.chance))) {
        normalized.chance = clamp(source.chance, 0, 1);
    }
    if (type !== 'ion_storm' && type !== 'blackout') return normalized;

    normalized.x = clamp(source.x, 0, MAP_W);
    normalized.y = clamp(source.y, 0, MAP_H);
    normalized.r = clamp(source.r, 80, 280);
    if (type === 'ion_storm') {
        var rawSpeedMult = Number(source.speedMult);
        normalized.speedMult = Number.isFinite(rawSpeedMult) ? clamp(rawSpeedMult, 0.45, 0.95) : 0.72;
    }
    return normalized;
}

export function resolveMapMutator(params) {
    params = params || {};
    var raw = params.mapMutator !== undefined ? params.mapMutator : params.config;
    var normalized = normalizeMapMutator(raw);
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var seed = hashSeed(params.seed || '42');
    if (normalized.type === 'none') return normalized;

    if (normalized.type === 'auto') {
        var chance = normalized.chance;
        if (!Number.isFinite(chance)) chance = 0.68;
        if (hashMix(seed, nodes.length, 5, 11) > chance) return { type: 'none' };
        return hashMix(seed + 23, nodes.length, 17, 29) < 0.5
            ? generateIonStorm(nodes, seed)
            : generateBlackout(nodes, seed);
    }

    if (hasExplicitArea(raw)) return normalized;
    return normalized.type === 'ion_storm' ? generateIonStorm(nodes, seed) : generateBlackout(nodes, seed);
}

export function isPointInsideMapMutator(params) {
    params = params || {};
    var point = params.point && typeof params.point === 'object' ? params.point : null;
    var mapMutator = normalizeMapMutator(params.mapMutator || params.mutator);
    if (!point || mapMutator.type === 'none' || mapMutator.type === 'auto') return false;
    var dx = (Number(point.x) || 0) - (Number(mapMutator.x) || 0);
    var dy = (Number(point.y) || 0) - (Number(mapMutator.y) || 0);
    var radius = Math.max(1, Number(mapMutator.r) || DEFAULT_RADIUS);
    return dx * dx + dy * dy <= radius * radius;
}

export function getMapMutatorSpeedMultiplier(params) {
    params = params || {};
    var mapMutator = normalizeMapMutator(params.mapMutator || params.mutator);
    if (mapMutator.type !== 'ion_storm') return 1;
    if (!isPointInsideMapMutator({ point: params.point, mapMutator: mapMutator })) return 1;
    return clamp(mapMutator.speedMult, 0.45, 0.95);
}

export function isTerritoryBonusBlockedAtPoint(params) {
    params = params || {};
    var mapMutator = normalizeMapMutator(params.mapMutator || params.mutator);
    if (mapMutator.type !== 'blackout') return false;
    return isPointInsideMapMutator({ point: params.point, mapMutator: mapMutator });
}

export function mapMutatorName(mutator) {
    var type = canonicalMutatorType(mutator && mutator.type !== undefined ? mutator.type : mutator);
    if (type === 'ion_storm') return 'İyon Fırtınası';
    if (type === 'blackout') return 'Karartma Bölgesi';
    if (type === 'auto') return 'Rastgele';
    return 'Yok';
}

export function mapMutatorHint(mutator) {
    var type = canonicalMutatorType(mutator && mutator.type !== undefined ? mutator.type : mutator);
    if (type === 'ion_storm') return 'İyon Fırtınası: alan içinde filolar yavaşlar; uzun rotayı değil güvenli açıyı seç.';
    if (type === 'blackout') return 'Karartma Bölgesi: alan içinde territory hızı ve park filo koruması çalışmaz.';
    return 'Ek mutatör yok.';
}
