function countOwnedNodesByPlayer(nodes, playerCount) {
    var counts = [];
    for (var i = 0; i < playerCount; i++) counts[i] = 0;
    for (var ni = 0; ni < nodes.length; ni++) {
        var owner = Number(nodes[ni] && nodes[ni].owner);
        if (Number.isFinite(owner) && owner >= 0 && owner < playerCount) counts[owner] += 1;
    }
    return counts;
}

function countActiveFleetsByPlayer(fleets, playerCount) {
    var counts = [];
    for (var i = 0; i < playerCount; i++) counts[i] = 0;
    for (var fi = 0; fi < fleets.length; fi++) {
        var fleet = fleets[fi];
        if (!fleet || fleet.active !== true) continue;
        var owner = Number(fleet.owner);
        if (Number.isFinite(owner) && owner >= 0 && owner < playerCount) counts[owner] += 1;
    }
    return counts;
}

export function resolveMatchEndState(state) {
    state = state || {};
    var players = Array.isArray(state.players) ? state.players : [];
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    var fleets = Array.isArray(state.fleets) ? state.fleets : [];
    var playerCount = players.length;
    var nodeCounts = countOwnedNodesByPlayer(nodes, playerCount);
    var fleetCounts = countActiveFleetsByPlayer(fleets, playerCount);
    var playersAlive = [];
    var aliveIndices = [];

    for (var pi = 0; pi < playerCount; pi++) {
        var player = players[pi] || {};
        var wasAlive = player.alive !== false;
        var hasAssets = (nodeCounts[pi] || 0) > 0 || (fleetCounts[pi] || 0) > 0;
        var alive = wasAlive && hasAssets;
        playersAlive.push(alive);
        if (alive) aliveIndices.push(pi);
    }

    var winnerIndex = null;
    var gameOver = false;
    if (aliveIndices.length === 1) {
        winnerIndex = aliveIndices[0];
        gameOver = true;
    } else if (aliveIndices.length === 0 && playerCount > 0) {
        winnerIndex = -1;
        gameOver = true;
    }

    return {
        nodeCounts: nodeCounts,
        fleetCounts: fleetCounts,
        playersAlive: playersAlive,
        aliveIndices: aliveIndices,
        winnerIndex: winnerIndex,
        gameOver: gameOver,
    };
}
