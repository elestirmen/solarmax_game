import { SIM_CONSTANTS } from './shared_config.js';

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

export function territoryRadiusForNode(node, constants) {
    node = node || {};
    constants = constants || {};

    var base = Number(constants.territoryRadiusBase);
    var radiusMult = Number(constants.territoryRadiusNodeRadiusMult);
    var levelBonus = Number(constants.territoryRadiusLevelBonus);

    if (!Number.isFinite(base) || base <= 0) base = SIM_CONSTANTS.TERRITORY_RADIUS_BASE;
    if (!Number.isFinite(radiusMult) || radiusMult <= 0) radiusMult = SIM_CONSTANTS.TERRITORY_RADIUS_NODE_RADIUS_MULT;
    if (!Number.isFinite(levelBonus) || levelBonus < 0) levelBonus = SIM_CONSTANTS.TERRITORY_RADIUS_LEVEL_BONUS;

    var nodeRadius = Math.max(0, Number(node.radius) || 0);
    var level = Math.max(1, Math.floor(Number(node.level) || 1));
    var radius = base + nodeRadius * radiusMult + (level - 1) * levelBonus;

    if (node.kind === 'relay') radius += 12;
    else if (node.kind === 'nexus') radius += 8;
    else if (node.kind === 'bulwark') radius += 6;
    else if (node.kind === 'turret') radius -= 18;

    return clamp(radius, nodeRadius + 28, SIM_CONSTANTS.SUPPLY_DIST * 0.9);
}

export function isTerritoryNodeActive(node, callbacks) {
    if (!node || node.owner < 0 || !node.pos) return false;
    var activeFn = callbacks && typeof callbacks.isNodeTerritoryActive === 'function'
        ? callbacks.isNodeTerritoryActive
        : null;
    if (!activeFn) return true;
    return !!activeFn(node);
}

export function getTerritoryOwnersAtPoint(params) {
    params = params || {};

    var point = params.point && typeof params.point === 'object' ? params.point : null;
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};

    var x = Number(point.x);
    var y = Number(point.y);
    if (!point || !Number.isFinite(x) || !Number.isFinite(y)) {
        return { owners: {}, ownerCount: 0 };
    }
    var owners = {};
    var ownerCount = 0;

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner < 0 || !isTerritoryNodeActive(node, callbacks)) continue;
        var radius = territoryRadiusForNode(node, constants);
        var dx = x - (Number(node.pos.x) || 0);
        var dy = y - (Number(node.pos.y) || 0);
        if (dx * dx + dy * dy > radius * radius) continue;
        if (!owners[node.owner]) {
            owners[node.owner] = true;
            ownerCount++;
        }
    }

    return {
        owners: owners,
        ownerCount: ownerCount,
    };
}

export function isPointInsideFriendlyTerritory(params) {
    params = params || {};

    var owner = Math.floor(Number(params.owner));
    if (!Number.isFinite(owner) || owner < 0) return false;

    var territoryPresence = getTerritoryOwnersAtPoint(params);

    return territoryPresence.ownerCount === 1 && territoryPresence.owners[owner] === true;
}
