import { buildDefenseFieldConfig } from './shared_config.js';

function isAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}

export function getDefenseFieldStats(node, cfg) {
    cfg = buildDefenseFieldConfig(cfg);
    if (!node) return { active: false, range: 0, dps: 0 };

    var baseRangePad = Number(cfg.baseRangePad);
    var baseDps = Number(cfg.baseDps);
    var levelRangeBonus = Number(cfg.levelRangeBonus);
    var levelDpsBonus = Number(cfg.levelDpsBonus);
    var defenseDpsBonus = Number(cfg.defenseDpsBonus);
    var bulwarkDpsBonus = Number(cfg.bulwarkDpsBonus);
    var relayRangeBonus = Number(cfg.relayRangeBonus);

    if (node.owner < 0 || node.kind === 'turret' || !isAssimilated(node) || (node.units || 0) <= 0) {
        return { active: false, range: 0, dps: 0 };
    }

    var level = Math.max(1, Math.floor(node.level || 1));
    var range = Math.max(0, (node.radius || 0) + baseRangePad + Math.max(0, level - 1) * levelRangeBonus);
    var dps = Math.max(0, baseDps * (1 + Math.max(0, level - 1) * levelDpsBonus));
    if (node.defense) dps *= defenseDpsBonus;
    if (node.kind === 'bulwark') dps *= bulwarkDpsBonus;
    if (node.kind === 'relay') range += relayRangeBonus;

    return { active: true, range: range, dps: dps };
}

export function applyDefenseFieldDamage(opts) {
    opts = opts || {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var fleets = Array.isArray(opts.fleets) ? opts.fleets : [];
    var dt = Number(opts.dt);
    var cfg = opts.cfg || {};

    if (!Number.isFinite(dt) || dt <= 0) dt = 0;

    var hits = 0;
    var kills = 0;
    var arcs = [];
    var impacts = [];

    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (!node || !node.pos) continue;
        var stats = getDefenseFieldStats(node, cfg);
        if (!stats.active || stats.dps <= 0 || stats.range <= 0) continue;

        var rangeSq = stats.range * stats.range;
        for (var fi = 0; fi < fleets.length; fi++) {
            var fleet = fleets[fi];
            if (!fleet || !fleet.active || (fleet.count || 0) <= 0) continue;
            if (fleet.owner === node.owner) continue;

            var dx = (fleet.x || 0) - node.pos.x;
            var dy = (fleet.y || 0) - node.pos.y;
            if (dx * dx + dy * dy > rangeSq) continue;

            fleet.fieldDmgAcc = Number(fleet.fieldDmgAcc) || 0;
            fleet.fieldDmgAcc += stats.dps * dt;
            var damage = Math.floor(fleet.fieldDmgAcc);
            if (damage <= 0) continue;

            hits++;
            var hitLen = Math.sqrt(dx * dx + dy * dy) || 1;
            var hitDirX = dx / hitLen;
            var hitDirY = dy / hitLen;
            arcs.push({
                fromX: node.pos.x,
                fromY: node.pos.y,
                toX: fleet.x || 0,
                toY: fleet.y || 0,
                owner: node.owner,
            });
            fleet.fieldDmgAcc -= damage;
            fleet.hitFlash = Math.max(Number(fleet.hitFlash) || 0, Math.min(0.48, 0.12 + damage * 0.045));
            fleet.hitJitter = Math.max(Number(fleet.hitJitter) || 0, Math.min(0.9, 0.22 + damage * 0.12));
            fleet.hitDirX = hitDirX;
            fleet.hitDirY = hitDirY;
            impacts.push({
                x: fleet.x || 0,
                y: fleet.y || 0,
                owner: node.owner,
                damage: damage,
                killed: (fleet.count - damage) <= 0,
                dirX: hitDirX,
                dirY: hitDirY,
                kind: 'field',
            });
            fleet.count -= damage;

            if (fleet.count <= 0) {
                fleet.count = 0;
                fleet.active = false;
                if (Array.isArray(fleet.trail)) fleet.trail.length = 0;
                kills++;
            }
        }
    }

    return { hits: hits, kills: kills, arcs: arcs, impacts: impacts };
}
