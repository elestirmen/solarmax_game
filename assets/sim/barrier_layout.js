export function selectBarrierGateIds(params) {
    params = params || {};
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var barrierX = typeof params.barrierX === 'number' ? params.barrierX : 0;
    var targetGateCount = Math.max(1, Math.floor(params.targetGateCount || 1));
    var minVerticalGap = Math.max(0, Math.floor(params.minVerticalGap || 0));

    var primary = [];
    var fallback = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner !== -1) continue;
        if (node.kind === 'turret') fallback.push(node);
        else primary.push(node);
    }

    var candidates = primary.length ? primary.slice() : fallback.slice();
    if (!candidates.length) return [];

    candidates.sort(function (a, b) {
        var ad = Math.abs(a.pos.x - barrierX);
        var bd = Math.abs(b.pos.x - barrierX);
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });

    var gateIds = [];
    for (var ci = 0; ci < candidates.length && gateIds.length < targetGateCount; ci++) {
        var cand = candidates[ci];
        var tooClose = false;
        for (var gi = 0; gi < gateIds.length; gi++) {
            var gateNode = nodes[gateIds[gi]];
            if (!gateNode) continue;
            if (Math.abs(gateNode.pos.y - cand.pos.y) < minVerticalGap) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) gateIds.push(cand.id);
    }

    if (!gateIds.length) gateIds.push(candidates[0].id);
    return gateIds;
}
