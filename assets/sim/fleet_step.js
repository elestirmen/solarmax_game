import { resolveFriendlyArrival } from './reinforcement.js';

function normalizeDirection(dx, dy, fallbackX, fallbackY) {
    var x = Number(dx);
    var y = Number(dy);
    var len = Math.sqrt(x * x + y * y);
    if (!Number.isFinite(len) || len < 0.0001) {
        x = Number(fallbackX);
        y = Number(fallbackY);
        len = Math.sqrt(x * x + y * y);
    }
    if (!Number.isFinite(len) || len < 0.0001) return { x: 1, y: 0 };
    return { x: x / len, y: y / len };
}

export function stepFleetMovement(params) {
    params = params || {};

    var fleets = Array.isArray(params.fleets) ? params.fleets : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var tune = params.tune || {};
    var mapFeature = params.mapFeature || {};
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};

    var dt = Number(params.dt);
    var baseFleetSpeed = Number(constants.baseFleetSpeed);
    var gravitySpeedMult = Number(constants.gravitySpeedMult);
    var trailLen = Number(constants.trailLen);
    var clamp = typeof callbacks.clamp === 'function' ? callbacks.clamp : function (value, min, max) {
        return Math.max(min, Math.min(max, value));
    };
    var bezPt = typeof callbacks.bezPt === 'function' ? callbacks.bezPt : function (_p0, _cp, p2) {
        return { x: p2.x, y: p2.y };
    };

    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 30;
    if (!Number.isFinite(baseFleetSpeed) || baseFleetSpeed <= 0) baseFleetSpeed = 80;
    if (!Number.isFinite(gravitySpeedMult) || gravitySpeedMult <= 0) gravitySpeedMult = 1;
    if (!Number.isFinite(trailLen) || trailLen < 0) trailLen = 12;

    for (var i = fleets.length - 1; i >= 0; i--) {
        var fleet = fleets[i];
        if (!fleet || !fleet.active) continue;

        var speedMult = Number(fleet.routeSpeedMult) || 1;
        if (mapFeature && mapFeature.type === 'gravity') {
            var gdx = (Number(fleet.x) || 0) - (Number(mapFeature.x) || 0);
            var gdy = (Number(fleet.y) || 0) - (Number(mapFeature.y) || 0);
            var gravityR = Number(mapFeature.r) || 0;
            if (gdx * gdx + gdy * gdy <= gravityR * gravityR) speedMult *= gravitySpeedMult;
        }
        var fleetTrailScale = Number(fleet.trailScale);
        if (!Number.isFinite(fleetTrailScale) || fleetTrailScale <= 0) fleetTrailScale = 1;
        var fleetTrailLen = Math.max(4, Math.round(trailLen * fleetTrailScale));
        var turnRate = Number(fleet.turnRate);
        if (!Number.isFinite(turnRate) || turnRate <= 0) turnRate = 6;
        var throttleBias = Number(fleet.throttleBias);
        if (!Number.isFinite(throttleBias) || throttleBias <= 0) throttleBias = 1;
        var lookAhead = Number(fleet.lookAhead);
        if (!Number.isFinite(lookAhead) || lookAhead <= 0) lookAhead = 0.022;

        function updateVisualState(dirX, dirY, throttleTarget, bankWeight) {
            var desired = normalizeDirection(dirX, dirY, fleet.headingX, fleet.headingY);
            var current = normalizeDirection(fleet.headingX, fleet.headingY, desired.x, desired.y);
            var blend = clamp(dt * turnRate * (0.88 + speedMult * 0.14), 0.08, 1);
            var next = normalizeDirection(
                current.x + (desired.x - current.x) * blend,
                current.y + (desired.y - current.y) * blend,
                desired.x,
                desired.y
            );
            var turnCross = current.x * desired.y - current.y * desired.x;
            var bankTarget = clamp(-turnCross * (1.45 + turnRate * 0.05) * bankWeight, -0.95, 0.95);
            var bankBlend = clamp(dt * 8.5, 0.08, 1);
            var throttleBlend = clamp(dt * 5.5, 0.08, 1);

            fleet.headingX = next.x;
            fleet.headingY = next.y;
            fleet.bank = (Number(fleet.bank) || 0) + (bankTarget - (Number(fleet.bank) || 0)) * bankBlend;
            if (!Number.isFinite(fleet.throttle)) fleet.throttle = throttleTarget;
            fleet.throttle = (Number(fleet.throttle) || 0) + (throttleTarget - (Number(fleet.throttle) || 0)) * throttleBlend;
        }

        var dp = ((Number(fleet.speed) || 0) * (Number(fleet.spdVar) || 1) * (Number(tune.fspeed) || baseFleetSpeed) / baseFleetSpeed) * speedMult * dt;
        var arcLen = Math.max(1, Number(fleet.arcLen) || 1);
        fleet.t = (Number(fleet.t) || 0) + dp / arcLen;

        if (fleet.t >= 1) {
            var arrivalNode = nodes[fleet.tgtId];
            if (arrivalNode && arrivalNode.pos) {
                fleet.trail.push({ x: fleet.x, y: fleet.y });
                if (fleet.trail.length > fleetTrailLen) fleet.trail.shift();
                fleet.x = arrivalNode.pos.x;
                fleet.y = arrivalNode.pos.y;
            }
            continue;
        }

        if (fleet.t > 0) {
            var src = nodes[fleet.srcId];
            var tgt = nodes[fleet.tgtId];
            if (!src || !src.pos || !tgt || !tgt.pos) continue;

            var cp = { x: fleet.cpx, y: fleet.cpy };
            var launchT = clamp(typeof fleet.launchT === 'number' ? fleet.launchT : 0, 0, 0.2);
            var curveT = launchT + (1 - launchT) * clamp(fleet.t, 0, 1);
            var pt = bezPt(src.pos, cp, tgt.pos, curveT);
            var pt2 = bezPt(src.pos, cp, tgt.pos, Math.min(1, curveT + Math.max(0.01, lookAhead)));
            var tdx = pt2.x - pt.x;
            var tdy = pt2.y - pt.y;
            var tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            var nx = -tdy / tlen;
            var ny = tdx / tlen;
            var fade = Math.min(1, curveT * 5) * Math.min(1, (1 - curveT) * 5);
            var ox = pt.x + nx * (Number(fleet.offsetL) || 0) * fade;
            var oy = pt.y + ny * (Number(fleet.offsetL) || 0) * fade;
            var departEase = clamp((curveT - launchT) / 0.16, 0, 1);
            var arriveEase = clamp((1 - curveT) / 0.24, 0, 1);
            var throttleTarget = clamp(
                (0.56 + departEase * 0.48) *
                (0.74 + arriveEase * 0.26) *
                throttleBias *
                (0.98 + Math.max(0, speedMult - 1) * 0.08),
                0.4,
                1.24
            );
            var bankWeight = Math.min(1, curveT * 4.5) * (0.35 + Math.min(1, (1 - curveT) * 3.2));
            updateVisualState(tdx, tdy, throttleTarget, bankWeight);

            fleet.trail.push({ x: fleet.x, y: fleet.y });
            if (fleet.trail.length > fleetTrailLen) fleet.trail.shift();
            fleet.x = ox;
            fleet.y = oy;
            continue;
        }

        var waitSrc = nodes[fleet.srcId];
        var waitTgt = nodes[fleet.tgtId];
        if (waitSrc && waitSrc.pos && waitTgt && waitTgt.pos) {
            var waitCp = { x: fleet.cpx, y: fleet.cpy };
            var waitLaunchT = clamp(typeof fleet.launchT === 'number' ? fleet.launchT : 0, 0, 0.2);
            var waitPt = bezPt(waitSrc.pos, waitCp, waitTgt.pos, waitLaunchT);
            var waitPt2 = bezPt(waitSrc.pos, waitCp, waitTgt.pos, Math.min(1, waitLaunchT + Math.max(0.01, lookAhead)));
            fleet.x = waitPt.x;
            fleet.y = waitPt.y;
            updateVisualState(waitPt2.x - waitPt.x, waitPt2.y - waitPt.y, 0.3 * throttleBias, 0.18);
        } else if (waitSrc && waitSrc.pos) {
            fleet.x = waitSrc.pos.x;
            fleet.y = waitSrc.pos.y;
            updateVisualState(1, 0, 0.28 * throttleBias, 0.1);
        }
    }

    return fleets;
}

export function resolveCombatOutcome(params) {
    params = params || {};

    var fleet = params.fleet || {};
    var targetNode = params.targetNode || {};
    var players = Array.isArray(params.players) ? params.players : [];
    var tune = params.tune || {};
    var humanIndex = Number(params.humanIndex);
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};

    var nodeTypeOf = typeof callbacks.nodeTypeOf === 'function' ? callbacks.nodeTypeOf : function () { return { def: 1 }; };
    var nodeLevelDefMult = typeof callbacks.nodeLevelDefMult === 'function' ? callbacks.nodeLevelDefMult : function () { return 1; };
    var nodeCapacity = typeof callbacks.nodeCapacity === 'function' ? callbacks.nodeCapacity : function (node) { return Number(node.maxUnits) || 0; };
    var turretCaptureResist = Number(constants.turretCaptureResist);
    var defenseBonus = Number(constants.defenseBonus);
    var assimLockTicks = Number(constants.assimLockTicks);

    if (!Number.isFinite(turretCaptureResist) || turretCaptureResist <= 0) turretCaptureResist = 1;
    if (!Number.isFinite(defenseBonus) || defenseBonus <= 0) defenseBonus = 1;
    if (!Number.isFinite(assimLockTicks) || assimLockTicks < 0) assimLockTicks = 0;

    var targetOwnerBefore = targetNode.owner;
    var humanInvolved = fleet.owner === humanIndex || targetOwnerBefore === humanIndex;
    var defMult = (targetOwnerBefore >= 0 ? Number(tune.def) || 1 : 1) * (Number(nodeTypeOf(targetNode).def) || 1) * (Number(nodeLevelDefMult(targetNode)) || 1);
    if (targetNode.kind === 'turret') defMult *= turretCaptureResist;
    if (targetNode.defense) defMult *= defenseBonus;

    var atk = Number(fleet.count) || 0;
    var def = (Number(targetNode.units) || 0) * defMult;
    var color = players[fleet.owner] ? players[fleet.owner].color : '#fff';
    var captured = atk > def;

    var particleBursts = [
        {
            x: targetNode.pos ? targetNode.pos.x : 0,
            y: targetNode.pos ? targetNode.pos.y : 0,
            count: 8 + Math.min(atk, 12),
            color: color,
            isCapture: false,
        },
    ];

    var statsDelta = { nodesCaptured: 0, gateCaptures: 0 };
    var audio = [];

    if (captured) {
        targetNode.owner = fleet.owner;
        targetNode.units = Math.max(1, Math.floor(atk - def));
        targetNode.defense = false;
        targetNode.assimilationProgress = 0;
        targetNode.assimilationLock = assimLockTicks;
        particleBursts.push({
            x: targetNode.pos ? targetNode.pos.x : 0,
            y: targetNode.pos ? targetNode.pos.y : 0,
            count: 12,
            color: color,
            isCapture: true,
        });
        if (humanIndex === fleet.owner) {
            statsDelta.nodesCaptured = 1;
            statsDelta.gateCaptures = targetNode.gate ? 1 : 0;
            audio.push('capture');
        } else if (humanInvolved) {
            audio.push('combat');
        }
    } else {
        targetNode.units = Math.max(0, (def - atk) / defMult);
        if (humanInvolved) audio.push('combat');
    }

    targetNode.maxUnits = nodeCapacity(targetNode);

    return {
        targetOwnerBefore: targetOwnerBefore,
        captured: captured,
        humanInvolved: humanInvolved,
        particleBursts: particleBursts,
        statsDelta: statsDelta,
        audio: audio,
    };
}

export function resolveFleetArrivals(params) {
    params = params || {};

    var fleets = Array.isArray(params.fleets) ? params.fleets : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var players = Array.isArray(params.players) ? params.players : [];
    var callbacks = params.callbacks || {};
    var flows = Array.isArray(params.flows) ? params.flows : [];
    var humanIndex = Number(params.humanIndex);

    var nodeTypeOf = typeof callbacks.nodeTypeOf === 'function' ? callbacks.nodeTypeOf : function () { return { def: 1 }; };
    var nodeLevelDefMult = typeof callbacks.nodeLevelDefMult === 'function' ? callbacks.nodeLevelDefMult : function () { return 1; };
    var nodeCapacity = typeof callbacks.nodeCapacity === 'function' ? callbacks.nodeCapacity : function (node) { return Number(node.maxUnits) || 0; };

    var particleBursts = [];
    var audio = [];
    var toasts = [];
    var statsDelta = { nodesCaptured: 0, gateCaptures: 0 };
    var activeFlows = flows;

    for (var i = fleets.length - 1; i >= 0; i--) {
        var fleet = fleets[i];
        if (!fleet || !fleet.active) {
            fleets.splice(i, 1);
            continue;
        }
        if ((Number(fleet.t) || 0) < 1) continue;

        var targetNode = nodes[fleet.tgtId];
        if (!targetNode) {
            fleet.active = false;
            fleet.trail = [];
            fleets.splice(i, 1);
            continue;
        }

        if (targetNode.owner === fleet.owner) {
            var sourceNode = nodes[fleet.srcId];
            var friendlyArrival = resolveFriendlyArrival({
                targetUnits: targetNode.units,
                targetMaxUnits: targetNode.maxUnits,
                sourceUnits: sourceNode && sourceNode.owner === fleet.owner ? sourceNode.units : 0,
                sourceMaxUnits: sourceNode && sourceNode.owner === fleet.owner ? sourceNode.maxUnits : 0,
                fleetCount: fleet.count,
            });
            targetNode.units = friendlyArrival.targetUnits;
            if (sourceNode && sourceNode.owner === fleet.owner) sourceNode.units = friendlyArrival.sourceUnits;
            if (friendlyArrival.lost > 0 && fleet.owner === humanIndex) {
                toasts.push('Takviye taski: hedef doluydu. Fazla birlik once kaynaga dondu, kalan fazlalik dagildi.');
            }
        } else {
            var combatResult = resolveCombatOutcome({
                fleet: fleet,
                targetNode: targetNode,
                players: players,
                tune: params.tune,
                humanIndex: humanIndex,
                callbacks: {
                    nodeTypeOf: nodeTypeOf,
                    nodeLevelDefMult: nodeLevelDefMult,
                    nodeCapacity: nodeCapacity,
                },
                constants: params.constants,
            });
            particleBursts = particleBursts.concat(combatResult.particleBursts);
            audio = audio.concat(combatResult.audio);
            statsDelta.nodesCaptured += combatResult.statsDelta.nodesCaptured;
            statsDelta.gateCaptures += combatResult.statsDelta.gateCaptures;
            if (combatResult.captured) {
                activeFlows = activeFlows.filter(function (flow) {
                    return !(flow.tgtId === targetNode.id && flow.owner !== fleet.owner);
                });
            }
        }

        fleet.active = false;
        fleet.trail = [];
        fleets.splice(i, 1);
    }

    return {
        fleets: fleets,
        flows: activeFlows,
        particleBursts: particleBursts,
        audio: audio,
        toasts: toasts,
        statsDelta: statsDelta,
    };
}
