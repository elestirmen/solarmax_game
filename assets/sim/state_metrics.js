import { computePlayerUnitCount, computeGlobalCap } from './cap.js';

export function getPlayerCapitalId(params) {
    params = params || {};
    var playerIndex = Number(params.playerIndex);
    var playerCapital = params.playerCapital || {};
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var anchorPositions = Array.isArray(params.anchorPositions) ? params.anchorPositions : [];
    var isNodeAssimilated = typeof params.isNodeAssimilated === 'function' ? params.isNodeAssimilated : function () { return true; };
    var distanceFn = typeof params.distanceFn === 'function' ? params.distanceFn : function () { return Infinity; };

    var capital = playerCapital[playerIndex];
    if (capital !== undefined && nodes[capital] && nodes[capital].owner === playerIndex && isNodeAssimilated(nodes[capital])) return capital;

    var anchor = anchorPositions[playerIndex % Math.max(1, anchorPositions.length)] || { x: 0, y: 0 };
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner !== playerIndex || !isNodeAssimilated(node)) continue;
        var d = distanceFn(node.pos, anchor);
        if (d < bestDist) {
            bestDist = d;
            best = node.id;
        }
    }
    playerCapital[playerIndex] = best;
    return best;
}

export function computeSupplyConnected(params) {
    params = params || {};
    var playerIndex = Number(params.playerIndex);
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var isNodeAssimilated = typeof params.isNodeAssimilated === 'function' ? params.isNodeAssimilated : function () { return true; };
    var distanceFn = typeof params.distanceFn === 'function' ? params.distanceFn : function () { return Infinity; };
    var maxLinkDist = Number(params.maxLinkDist);
    if (!Number.isFinite(maxLinkDist) || maxLinkDist <= 0) maxLinkDist = 220;

    var capital = getPlayerCapitalId(params);
    if (capital === null || capital === undefined) return new Set();

    var connected = new Set([capital]);
    var changed = true;
    while (changed) {
        changed = false;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!node || node.owner !== playerIndex || connected.has(node.id) || !isNodeAssimilated(node)) continue;
            for (var j = 0; j < nodes.length; j++) {
                var other = nodes[j];
                if (!other || other.owner !== playerIndex || !connected.has(other.id) || !isNodeAssimilated(other)) continue;
                if (distanceFn(node.pos, other.pos) <= maxLinkDist) {
                    connected.add(node.id);
                    changed = true;
                    break;
                }
            }
        }
    }
    return connected;
}

export function computePowerByPlayer(params) {
    params = params || {};
    var players = Array.isArray(params.players) ? params.players : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var fleets = Array.isArray(params.fleets) ? params.fleets : [];
    var nodePowerValue = typeof params.nodePowerValue === 'function' ? params.nodePowerValue : function (node) { return Number(node.units) || 0; };

    var power = {};
    for (var i = 0; i < players.length; i++) power[i] = 0;
    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (!node || node.owner < 0) continue;
        power[node.owner] += nodePowerValue(node);
    }
    for (var fi = 0; fi < fleets.length; fi++) {
        var fleet = fleets[fi];
        if (fleet && fleet.active) power[fleet.owner] += fleet.count;
    }
    return power;
}

export function computeOwnershipMetrics(params) {
    params = params || {};
    var players = Array.isArray(params.players) ? params.players : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var fleets = Array.isArray(params.fleets) ? params.fleets : [];
    var strategicPulse = params.strategicPulse || { active: false, nodeId: -1 };
    var rules = params.rules || {};
    var strategicPulseCapBonus = Number(params.strategicPulseCapBonus) || 0;
    var isNodeAssimilated = typeof params.isNodeAssimilated === 'function' ? params.isNodeAssimilated : function () { return true; };

    var powerByPlayer = computePowerByPlayer(params);
    var supplyByPlayer = {};
    var unitByPlayer = {};
    var capByPlayer = {};

    for (var pi = 0; pi < players.length; pi++) {
        supplyByPlayer[pi] = computeSupplyConnected({
            playerIndex: pi,
            playerCapital: params.playerCapital || {},
            nodes: nodes,
            anchorPositions: params.anchorPositions || [],
            isNodeAssimilated: isNodeAssimilated,
            distanceFn: params.distanceFn,
            maxLinkDist: params.maxLinkDist,
        });
    }

    for (var op = 0; op < players.length; op++) {
        unitByPlayer[op] = computePlayerUnitCount({ nodes: nodes, fleets: fleets, owner: op });
        capByPlayer[op] = computeGlobalCap({
            nodes: nodes,
            owner: op,
            baseCap: rules.baseCap,
            capPerNodeFactor: rules.capPerNodeFactor,
        });
        var pulseNode = nodes[strategicPulse.nodeId];
        if (strategicPulse.active && pulseNode && pulseNode.owner === op && isNodeAssimilated(pulseNode)) {
            capByPlayer[op] += strategicPulseCapBonus;
        }
    }

    return {
        powerByPlayer: powerByPlayer,
        supplyByPlayer: supplyByPlayer,
        unitByPlayer: unitByPlayer,
        capByPlayer: capByPlayer,
    };
}
