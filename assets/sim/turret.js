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
    var rangeSq = range * range;

    for (var ni = 0; ni < nodes.length; ni++) {
        var turret = nodes[ni];
        if (!turret || turret.kind !== 'turret') continue;
        if (!turret.pos) continue;
        if ((turret.units || 0) < minGarrison) continue;
        if (!isAssimilated(turret)) continue;

        for (var fi = 0; fi < fleets.length; fi++) {
            var fleet = fleets[fi];
            if (!fleet || !fleet.active || (fleet.count || 0) <= 0) continue;
            if (turret.owner !== -1 && fleet.owner === turret.owner) continue;

            var dx = (fleet.x || 0) - turret.pos.x;
            var dy = (fleet.y || 0) - turret.pos.y;
            if (dx * dx + dy * dy > rangeSq) continue;

            fleet.dmgAcc = Number(fleet.dmgAcc) || 0;
            fleet.dmgAcc += dps * dt;
            var damage = Math.floor(fleet.dmgAcc);
            if (damage <= 0) continue;

            hits++;
            fleet.dmgAcc -= damage;
            fleet.count -= damage;

            if (fleet.count <= 0) {
                fleet.count = 0;
                fleet.active = false;
                if (Array.isArray(fleet.trail)) fleet.trail.length = 0;
                kills++;
            }
        }
    }

    return { hits: hits, kills: kills };
}
