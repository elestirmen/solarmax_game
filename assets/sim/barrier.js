function isAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}

function sideOfNode(node, barrierX) {
    if (!node || !node.pos) return 0;
    return node.pos.x < barrierX ? -1 : 1;
}

export function isDispatchAllowed(opts) {
    opts = opts || {};
    var src = opts.src;
    var tgt = opts.tgt;
    var barrier = opts.barrier;
    var owner = Number(opts.owner);
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];

    if (!src || !tgt || !barrier || barrier.type !== 'barrier') return true;

    var barrierX = Number(barrier.x);
    if (!Number.isFinite(barrierX)) return true;

    var srcSide = sideOfNode(src, barrierX);
    var tgtSide = sideOfNode(tgt, barrierX);
    if (srcSide === 0 || tgtSide === 0 || srcSide === tgtSide) return true;

    var gateIds = Array.isArray(barrier.gateIds) ? barrier.gateIds : [];
    for (var i = 0; i < gateIds.length; i++) {
        var gate = nodes[gateIds[i]];
        if (!gate || !gate.gate) continue;
        if (gate.owner !== owner) continue;
        if (!isAssimilated(gate)) continue;
        return true;
    }

    return false;
}
