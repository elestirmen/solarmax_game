function mixHash(hash, value) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    return hash >>> 0;
}

function scaledInt(value, scale) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.floor(n * scale);
}

export function computeSyncHash(state) {
    state = state || {};
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    var fleets = Array.isArray(state.fleets) ? state.fleets : [];
    var players = Array.isArray(state.players) ? state.players : [];
    var tick = Number(state.tick);
    if (!Number.isFinite(tick)) tick = 0;

    var hash = 2166136261 >>> 0;
    hash = mixHash(hash, tick);
    hash = mixHash(hash, players.length);
    hash = mixHash(hash, nodes.length);

    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni] || {};
        hash = mixHash(hash, Number(node.id) || ni);
        hash = mixHash(hash, (Number(node.owner) || 0) + 2);
        hash = mixHash(hash, scaledInt(node.units, 100));
        hash = mixHash(hash, Number(node.level) || 0);
        hash = mixHash(hash, node.defense ? 1 : 0);
        hash = mixHash(hash, scaledInt(node.assimilationProgress, 1000));
        hash = mixHash(hash, Number(node.assimilationLock) || 0);
    }

    var activeCount = 0;
    for (var fi = 0; fi < fleets.length; fi++) {
        if (fleets[fi] && fleets[fi].active) activeCount++;
    }
    hash = mixHash(hash, activeCount);

    for (var fj = 0; fj < fleets.length; fj++) {
        var fleet = fleets[fj];
        if (!fleet || !fleet.active) continue;
        hash = mixHash(hash, (Number(fleet.owner) || 0) + 2);
        hash = mixHash(hash, Number(fleet.srcId) || 0);
        hash = mixHash(hash, Number(fleet.tgtId) || 0);
        hash = mixHash(hash, fleet.holding ? 1 : 0);
        hash = mixHash(hash, scaledInt(fleet.count, 100));
        hash = mixHash(hash, scaledInt(fleet.t, 10000));
        hash = mixHash(hash, scaledInt(fleet.x, 10));
        hash = mixHash(hash, scaledInt(fleet.y, 10));
        hash = mixHash(hash, scaledInt(fleet.fromX, 10));
        hash = mixHash(hash, scaledInt(fleet.fromY, 10));
        hash = mixHash(hash, scaledInt(fleet.toX, 10));
        hash = mixHash(hash, scaledInt(fleet.toY, 10));
        hash = mixHash(hash, scaledInt(fleet.cpx, 10));
        hash = mixHash(hash, scaledInt(fleet.cpy, 10));
    }

    for (var pi = 0; pi < players.length; pi++) {
        var player = players[pi] || {};
        hash = mixHash(hash, player.alive === false ? 0 : 1);
        hash = mixHash(hash, player.isAI ? 1 : 0);
    }

    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
