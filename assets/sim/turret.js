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
    var impacts = [];
    for (var ni = 0; ni < nodes.length; ni++) {
        var turret = nodes[ni];
        if (!turret || turret.kind !== 'turret') continue;
        if (!turret.pos) continue;
        var turretRange = range * Math.max(0.5, Number(turret.turretRangeMult) || 1);
        var turretDps = dps * Math.max(0.2, Number(turret.turretDpsMult) || 1);
        var requiredGarrison = turret.owner === -1 ? Math.max(1, Math.ceil(minGarrison * Math.max(0.5, Number(turret.turretMinGarrisonMult) || 1))) : 1;
        if ((turret.units || 0) < requiredGarrison) continue;
        if (turret.owner === -1 && !isAssimilated(turret)) continue;
        var rangeSq = turretRange * turretRange;

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
        bestFleet.dmgAcc += turretDps * dt;
        var damage = Math.floor(bestFleet.dmgAcc);
        if (damage <= 0) continue;

        hits++;
        var hitLen = Math.sqrt(bestDistSq) || 1;
        var hitDirX = ((bestFleet.x || 0) - turret.pos.x) / hitLen;
        var hitDirY = ((bestFleet.y || 0) - turret.pos.y) / hitLen;
        shots.push({
            fromX: turret.pos.x,
            fromY: turret.pos.y,
            toX: bestFleet.x || 0,
            toY: bestFleet.y || 0,
            turretOwner: turret.owner,
        });
        bestFleet.dmgAcc -= damage;
        bestFleet.hitFlash = Math.max(Number(bestFleet.hitFlash) || 0, Math.min(0.52, 0.18 + damage * 0.05));
        bestFleet.hitJitter = Math.max(Number(bestFleet.hitJitter) || 0, Math.min(1.15, 0.3 + damage * 0.16));
        bestFleet.hitDirX = hitDirX;
        bestFleet.hitDirY = hitDirY;
        impacts.push({
            x: bestFleet.x || 0,
            y: bestFleet.y || 0,
            owner: turret.owner,
            damage: damage,
            killed: (bestFleet.count - damage) <= 0,
            dirX: hitDirX,
            dirY: hitDirY,
            kind: 'turret',
        });
        bestFleet.count -= damage;

        if (bestFleet.count <= 0) {
            bestFleet.count = 0;
            bestFleet.active = false;
            if (Array.isArray(bestFleet.trail)) bestFleet.trail.length = 0;
            kills++;
        }
    }

    return { hits: hits, kills: kills, shots: shots, impacts: impacts };
}
