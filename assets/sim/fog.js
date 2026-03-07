import { SIM_CONSTANTS } from './shared_config.js';

export function initFog(playerCount, nodeCount) {
    var vis = [];
    var ls = [];
    var pc = Math.max(0, Math.floor(Number(playerCount) || 0));
    var nc = Math.max(0, Math.floor(Number(nodeCount) || 0));
    for (var p = 0; p < pc; p++) {
        vis.push({});
        var row = [];
        for (var n = 0; n < nc; n++) row.push({ tick: -1, owner: -1, units: 0 });
        ls.push(row);
    }
    return { vis: vis, ls: ls };
}

export function updateVis(fog, playerIndex, nodes, tick, opts) {
    fog = fog || initFog(0, 0);
    nodes = Array.isArray(nodes) ? nodes : [];
    opts = opts || {};

    if (!Array.isArray(fog.vis)) fog.vis = [];
    if (!Array.isArray(fog.ls)) fog.ls = [];
    if (!fog.vis[playerIndex]) fog.vis[playerIndex] = {};
    if (!fog.ls[playerIndex]) fog.ls[playerIndex] = [];

    var selectedBonus = Number(opts.selectedBonus);
    if (!Number.isFinite(selectedBonus) || selectedBonus <= 0) selectedBonus = SIM_CONSTANTS.SEL_BONUS;
    var baseVision = Number(opts.baseVision);
    if (!Number.isFinite(baseVision) || baseVision <= 0) baseVision = SIM_CONSTANTS.VISION_R;

    fog.vis[playerIndex] = {};
    var owned = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner !== playerIndex || !node.pos) continue;
        var visionRadius = Number(node.visionR);
        if (!Number.isFinite(visionRadius) || visionRadius <= 0) visionRadius = baseVision + (Number(node.radius) || 0) * 2;
        if (node.selected) visionRadius *= selectedBonus;
        owned.push({ x: node.pos.x, y: node.pos.y, r2: visionRadius * visionRadius });
    }

    for (var ni = 0; ni < nodes.length; ni++) {
        var current = nodes[ni];
        if (!current || !current.pos) continue;
        if (current.owner === playerIndex) {
            fog.vis[playerIndex][current.id] = true;
            fog.ls[playerIndex][current.id] = { tick: tick, owner: current.owner, units: Math.floor(Number(current.units) || 0) };
            continue;
        }
        for (var oi = 0; oi < owned.length; oi++) {
            var ownerNode = owned[oi];
            var dx = current.pos.x - ownerNode.x;
            var dy = current.pos.y - ownerNode.y;
            if (dx * dx + dy * dy <= ownerNode.r2) {
                fog.vis[playerIndex][current.id] = true;
                fog.ls[playerIndex][current.id] = { tick: tick, owner: current.owner, units: Math.floor(Number(current.units) || 0) };
                break;
            }
        }
    }
    return fog;
}
