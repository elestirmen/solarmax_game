export function computePlayerUnitCount(opts) {
    opts = opts || {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var fleets = Array.isArray(opts.fleets) ? opts.fleets : [];
    var owner = Number(opts.owner);

    var total = 0;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner !== owner) continue;
        total += Math.max(0, Math.floor(Number(node.units) || 0));
    }
    for (var j = 0; j < fleets.length; j++) {
        var fleet = fleets[j];
        if (!fleet || !fleet.active || fleet.owner !== owner) continue;
        total += Math.max(0, Math.floor(Number(fleet.count) || 0));
    }

    return total;
}

export function computeGlobalCap(opts) {
    opts = opts || {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var owner = Number(opts.owner);
    var baseCap = Number(opts.baseCap);
    var capPerNodeFactor = Number(opts.capPerNodeFactor);

    if (!Number.isFinite(baseCap)) baseCap = 180;
    if (!Number.isFinite(capPerNodeFactor)) capPerNodeFactor = 42;

    var ownedNodes = 0;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node && node.owner === owner) ownedNodes++;
    }

    return Math.max(1, Math.floor(baseCap + ownedNodes * capPerNodeFactor));
}
