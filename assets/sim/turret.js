function isAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}

export function applyTurretDamage(opts) {
    opts = opts || {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var fleets = Array.isArray(opts.fleets) ? opts.fleets : [];
    var dt = Number(opts.dt);
    var range = Number(opts.range);
    var dps = Number(opts.dps);
    var minGarrison = Number(opts.minGarrison);

    if (!Number.isFinite(dt) || dt <= 0) dt = 0;
    if (!Number.isFinite(range) || range <= 0) range = 0;
    if (!Number.isFinite(dps) || dps <= 0) dps = 0;
    if (!Number.isFinite(minGarrison)) minGarrison = 1;

    var hits = 0;
    var kills = 0;
    var shots = [];
    var rangeSq = range * range;

    for (var ni = 0; ni < nodes.length; ni++) {
        var turret = nodes[ni];
        if (!turret || turret.kind !== 'turret') continue;
        if (!turret.pos) continue;
        if ((turret.units || 0) < minGarrison) continue;
        if (!isAssimilated(turret)) continue;

        var bestFleet = null;
        var bestDistSq = rangeSq + 1;
        for (var fi = 0; fi < fleets.length; fi++) {
            var fleet = fleets[fi];
            if (!fleet || !fleet.active || (fleet.count || 0) <= 0) continue;
            if (turret.owner !== -1 && fleet.owner === turret.owner) continue;

            var dx = (fleet.x || 0) - turret.pos.x;
            var dy = (fleet.y || 0) - turret.pos.y;
            var distSq = dx * dx + dy * dy;
            if (distSq > rangeSq) continue;
            if (!bestFleet || distSq < bestDistSq) {
                bestFleet = fleet;
                bestDistSq = distSq;
            }
        }

        if (!bestFleet) continue;
        bestFleet.dmgAcc = Number(bestFleet.dmgAcc) || 0;
        bestFleet.dmgAcc += dps * dt;
        var damage = Math.floor(bestFleet.dmgAcc);
        if (damage <= 0) continue;

        hits++;
        shots.push({
            fromX: turret.pos.x,
            fromY: turret.pos.y,
            toX: bestFleet.x || 0,
            toY: bestFleet.y || 0,
            turretOwner: turret.owner,
        });
        bestFleet.dmgAcc -= damage;
        bestFleet.count -= damage;

        if (bestFleet.count <= 0) {
            bestFleet.count = 0;
            bestFleet.active = false;
            if (Array.isArray(bestFleet.trail)) bestFleet.trail.length = 0;
            kills++;
        }
    }

    return { hits: hits, kills: kills, shots: shots };
}
