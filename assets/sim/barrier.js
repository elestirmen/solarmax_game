function isAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}

function sideOfNode(node, barrierX) {
    if (!node || !node.pos) return 0;
    return node.pos.x < barrierX ? -1 : 1;
}

export function isBarrierGate(node, barrier) {
    if (!node) return false;
    if (node.gate === true) return true;
    var gateIds = Array.isArray(barrier && barrier.gateIds) ? barrier.gateIds : [];
    var nodeId = Math.floor(Number(node.id));
    for (var i = 0; i < gateIds.length; i++) {
        if ((Number(gateIds[i]) || 0) === nodeId) return true;
    }
    return false;
}

export function syncBarrierGateNodes(params) {
    params = params || {};
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var barrierX = Number(params.barrierX);
    var gateIds = Array.isArray(params.gateIds) ? params.gateIds : [];
    if (!Number.isFinite(barrierX)) return nodes;

    var gateSet = {};
    for (var gi = 0; gi < gateIds.length; gi++) {
        gateSet[Math.floor(Number(gateIds[gi]))] = true;
    }

    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (!node) continue;
        var isGate = gateSet[ni] === true || gateSet[Math.floor(Number(node.id))] === true;
        node.gate = isGate;
        if (!isGate) continue;
        if (!node.pos || typeof node.pos !== 'object') node.pos = { x: barrierX, y: 0 };
        node.pos.x = barrierX;
        node.kind = 'gate';
    }

    return nodes;
}

export function controlsBarrierForOwner(opts) {
    opts = opts || {};
    var barrier = opts.barrier;
    var owner = Number(opts.owner);
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    if (!barrier || barrier.type !== 'barrier') return false;
    if (!Number.isFinite(owner) || owner < 0) return false;

    var gateIds = Array.isArray(barrier.gateIds) ? barrier.gateIds : [];
    for (var i = 0; i < gateIds.length; i++) {
        var gate = nodes[gateIds[i]];
        if (!gate || !isBarrierGate(gate, barrier)) continue;
        if (gate.owner !== owner) continue;
        if (!isAssimilated(gate)) continue;
        return true;
    }
    return false;
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
    if (isBarrierGate(src, barrier) || isBarrierGate(tgt, barrier)) return true;
    return controlsBarrierForOwner({ barrier: barrier, owner: owner, nodes: nodes });
}
