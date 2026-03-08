import { resolveFriendlyArrival } from './reinforcement.js';
import { getFleetUnitSpacingT } from './shared_config.js';
import { isPointInsideFriendlyTerritory } from './territory.js';

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

function fleetTravelDirection(fleet, targetNode, nodes) {
    fleet = fleet || {};
    targetNode = targetNode || {};
    nodes = Array.isArray(nodes) ? nodes : [];
    if (Number.isFinite(fleet.headingX) && Number.isFinite(fleet.headingY)) {
        return normalizeDirection(fleet.headingX, fleet.headingY, 1, 0);
    }
    var sourceNode = nodes[fleet.srcId];
    if (sourceNode && sourceNode.pos && targetNode.pos) {
        return normalizeDirection(targetNode.pos.x - sourceNode.pos.x, targetNode.pos.y - sourceNode.pos.y, 1, 0);
    }
    if (Number.isFinite(fleet.fromX) && Number.isFinite(fleet.fromY) && Number.isFinite(fleet.toX) && Number.isFinite(fleet.toY)) {
        return normalizeDirection(fleet.toX - fleet.fromX, fleet.toY - fleet.fromY, 1, 0);
    }
    return { x: 1, y: 0 };
}

function defaultClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function defaultBezPt(p0, cp, p2, t) {
    var u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
    };
}

function resolveFleetRouteStart(fleet, nodes) {
    if (Number.isFinite(fleet.fromX) && Number.isFinite(fleet.fromY)) {
        return { x: Number(fleet.fromX), y: Number(fleet.fromY) };
    }
    var sourceNode = nodes[fleet.srcId];
    if (sourceNode && sourceNode.pos) return sourceNode.pos;
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) {
        return { x: Number(fleet.x), y: Number(fleet.y) };
    }
    return null;
}

function resolveFleetRouteTarget(fleet, nodes) {
    if (Number.isFinite(fleet.toX) && Number.isFinite(fleet.toY)) {
        return { x: Number(fleet.toX), y: Number(fleet.toY) };
    }
    var targetNode = nodes[fleet.tgtId];
    if (targetNode && targetNode.pos) return targetNode.pos;
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) {
        return { x: Number(fleet.x), y: Number(fleet.y) };
    }
    return null;
}

function holdingFleetRadius(fleet) {
    var count = Math.max(1, Math.floor(Number(fleet && fleet.count) || 0));
    return defaultClamp(7 + Math.sqrt(count) * 1.3, 9, 20);
}

function mergeHoldingFleet(fleets, fleet, index) {
    var mergeRadius = Math.max(10, holdingFleetRadius(fleet));
    var fleetCount = Math.max(0, Math.floor(Number(fleet.count) || 0));
    var fleetUnsuppliedTicks = Math.max(0, Math.floor(Number(fleet.holdUnsuppliedTicks) || 0));
    for (var i = 0; i < fleets.length; i++) {
        if (i === index) continue;
        var other = fleets[i];
        if (!other || !other.active || !other.holding || other.owner !== fleet.owner) continue;
        var dx = (Number(other.x) || 0) - (Number(fleet.x) || 0);
        var dy = (Number(other.y) || 0) - (Number(fleet.y) || 0);
        if (dx * dx + dy * dy > mergeRadius * mergeRadius) continue;
        var otherCount = Math.max(0, Math.floor(Number(other.count) || 0));
        var otherUnsuppliedTicks = Math.max(0, Math.floor(Number(other.holdUnsuppliedTicks) || 0));
        var totalCount = otherCount + fleetCount;
        other.count = totalCount;
        other.holdUnsuppliedTicks = totalCount > 0
            ? Math.floor(((otherUnsuppliedTicks * otherCount) + (fleetUnsuppliedTicks * fleetCount)) / totalCount)
            : 0;
        other.hitFlash = Math.max(Number(other.hitFlash) || 0, Number(fleet.hitFlash) || 0);
        other.hitJitter = Math.max(Number(other.hitJitter) || 0, Number(fleet.hitJitter) || 0);
        fleets.splice(index, 1);
        return true;
    }
    return false;
}

function parkFleetAtTarget(fleets, fleet, index, targetPoint) {
    fleet.holding = true;
    fleet.holdUnsuppliedTicks = 0;
    fleet.t = 0;
    fleet.arcLen = 1;
    fleet.launchT = 0;
    fleet.x = targetPoint.x;
    fleet.y = targetPoint.y;
    fleet.fromX = targetPoint.x;
    fleet.fromY = targetPoint.y;
    fleet.toX = targetPoint.x;
    fleet.toY = targetPoint.y;
    fleet.cpx = targetPoint.x;
    fleet.cpy = targetPoint.y;
    fleet.routeSpeedMult = 1;
    fleet.routeSrcKey = 'p:' + Math.round(targetPoint.x * 10) + ':' + Math.round(targetPoint.y * 10);
    fleet.routeTgtKey = fleet.routeSrcKey;
    if (Array.isArray(fleet.trail)) fleet.trail.length = 0;
    return mergeHoldingFleet(fleets, fleet, index);
}

function computeFleetPose(fleet, nodes) {
    var startPoint = resolveFleetRouteStart(fleet, nodes);
    var targetPoint = resolveFleetRouteTarget(fleet, nodes);
    if (!startPoint || !targetPoint) return null;

    var clamp = defaultClamp;
    var bezPt = defaultBezPt;
    var cp = { x: fleet.cpx, y: fleet.cpy };
    var lookAhead = Number(fleet.lookAhead);
    var launchT = clamp(typeof fleet.launchT === 'number' ? fleet.launchT : 0, 0, 0.2);
    if (!Number.isFinite(lookAhead) || lookAhead <= 0) lookAhead = 0.022;

    if ((Number(fleet.t) || 0) > 0) {
        var curveT = launchT + (1 - launchT) * clamp(fleet.t, 0, 1);
        var pt = bezPt(startPoint, cp, targetPoint, curveT);
        var pt2 = bezPt(startPoint, cp, targetPoint, Math.min(1, curveT + Math.max(0.01, lookAhead)));
        var dirX = pt2.x - pt.x;
        var dirY = pt2.y - pt.y;
        var dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        var nx = -dirY / dirLen;
        var ny = dirX / dirLen;
        var fade = Math.min(1, curveT * 5) * Math.min(1, (1 - curveT) * 5);

        return {
            x: pt.x + nx * (Number(fleet.offsetL) || 0) * fade,
            y: pt.y + ny * (Number(fleet.offsetL) || 0) * fade,
            dirX: dirX / dirLen,
            dirY: dirY / dirLen,
        };
    }

    var waitPt = bezPt(startPoint, cp, targetPoint, launchT);
    var waitPt2 = bezPt(startPoint, cp, targetPoint, Math.min(1, launchT + Math.max(0.01, lookAhead)));
    var waitDir = normalizeDirection(waitPt2.x - waitPt.x, waitPt2.y - waitPt.y, 1, 0);
    return {
        x: waitPt.x,
        y: waitPt.y,
        dirX: waitDir.x,
        dirY: waitDir.y,
    };
}

function countArrivedFleetUnits(fleet) {
    var fleetCount = Math.max(0, Math.floor(Number(fleet && fleet.count) || 0));
    var fleetT = Number(fleet && fleet.t);
    if (fleetCount <= 0 || !Number.isFinite(fleetT) || fleetT < 1) return 0;

    var spacingT = Math.max(0.0001, getFleetUnitSpacingT(fleet));
    return Math.min(fleetCount, 1 + Math.floor((fleetT - 1 + 0.000001) / spacingT));
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
    var territorySpeedMult = Number(constants.territorySpeedMult);
    var trailLen = Number(constants.trailLen);
    var clamp = typeof callbacks.clamp === 'function' ? callbacks.clamp : defaultClamp;
    var bezPt = typeof callbacks.bezPt === 'function' ? callbacks.bezPt : defaultBezPt;

    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 30;
    if (!Number.isFinite(baseFleetSpeed) || baseFleetSpeed <= 0) baseFleetSpeed = 80;
    if (!Number.isFinite(gravitySpeedMult) || gravitySpeedMult <= 0) gravitySpeedMult = 1;
    if (!Number.isFinite(territorySpeedMult) || territorySpeedMult <= 0) territorySpeedMult = 1;
    if (!Number.isFinite(trailLen) || trailLen < 0) trailLen = 12;

    for (var i = fleets.length - 1; i >= 0; i--) {
        var fleet = fleets[i];
        if (!fleet || !fleet.active) continue;
        if (fleet.holding) {
            fleet.t = 0;
            if (Array.isArray(fleet.trail) && fleet.trail.length > 0) fleet.trail.length = 0;
            if (!Number.isFinite(fleet.x) || !Number.isFinite(fleet.y)) {
                var holdTarget = resolveFleetRouteTarget(fleet, nodes);
                if (holdTarget) {
                    fleet.x = holdTarget.x;
                    fleet.y = holdTarget.y;
                }
            }
            continue;
        }

        var speedMult = Number(fleet.routeSpeedMult) || 1;
        if (mapFeature && mapFeature.type === 'gravity') {
            var gdx = (Number(fleet.x) || 0) - (Number(mapFeature.x) || 0);
            var gdy = (Number(fleet.y) || 0) - (Number(mapFeature.y) || 0);
            var gravityR = Number(mapFeature.r) || 0;
            if (gdx * gdx + gdy * gdy <= gravityR * gravityR) speedMult *= gravitySpeedMult;
        }
        if (territorySpeedMult > 1 && isPointInsideFriendlyTerritory({
            owner: fleet.owner,
            point: { x: Number(fleet.x) || 0, y: Number(fleet.y) || 0 },
            nodes: nodes,
            callbacks: callbacks,
            constants: constants,
        })) {
            speedMult *= territorySpeedMult;
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

        var routeStart = resolveFleetRouteStart(fleet, nodes);
        var routeTarget = resolveFleetRouteTarget(fleet, nodes);
        if (!routeStart || !routeTarget) continue;

        if (fleet.t >= 1) {
            if ((Number(fleet.tgtId) || 0) < 0) {
                if (parkFleetAtTarget(fleets, fleet, i, routeTarget)) continue;
                continue;
            }
            var spacingT = Math.max(0.0001, getFleetUnitSpacingT(fleet));
            var fleetCount = Math.max(0, Math.floor(Number(fleet.count) || 0));
            var arrivedCount = Math.min(fleetCount, 1 + Math.floor(((Number(fleet.t) || 0) - 1 + 0.000001) / spacingT));
            var previewT = (Number(fleet.t) || 0) - arrivedCount * spacingT;
            var previewPose = null;

            if (arrivedCount < fleetCount) {
                previewPose = computeFleetPose({
                    srcId: fleet.srcId,
                    tgtId: fleet.tgtId,
                    cpx: fleet.cpx,
                    cpy: fleet.cpy,
                    t: previewT,
                    launchT: fleet.launchT,
                    lookAhead: lookAhead,
                    offsetL: fleet.offsetL,
                    headingX: fleet.headingX,
                    headingY: fleet.headingY,
                }, nodes);
            }

            if (previewPose) {
                fleet.trail.push({ x: fleet.x, y: fleet.y });
                if (fleet.trail.length > fleetTrailLen) fleet.trail.shift();
                fleet.x = previewPose.x;
                fleet.y = previewPose.y;
                updateVisualState(previewPose.dirX, previewPose.dirY, 0.44 * throttleBias, 0.14);
            }
            continue;
        }

        if (fleet.t > 0) {
            var cp = { x: fleet.cpx, y: fleet.cpy };
            var launchT = clamp(typeof fleet.launchT === 'number' ? fleet.launchT : 0, 0, 0.2);
            var curveT = launchT + (1 - launchT) * clamp(fleet.t, 0, 1);
            var pt = bezPt(routeStart, cp, routeTarget, curveT);
            var pt2 = bezPt(routeStart, cp, routeTarget, Math.min(1, curveT + Math.max(0.01, lookAhead)));
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

        if (routeStart && routeTarget) {
            var waitCp = { x: fleet.cpx, y: fleet.cpy };
            var waitLaunchT = clamp(typeof fleet.launchT === 'number' ? fleet.launchT : 0, 0, 0.2);
            var waitPt = bezPt(routeStart, waitCp, routeTarget, waitLaunchT);
            var waitPt2 = bezPt(routeStart, waitCp, routeTarget, Math.min(1, waitLaunchT + Math.max(0.01, lookAhead)));
            fleet.x = waitPt.x;
            fleet.y = waitPt.y;
            updateVisualState(waitPt2.x - waitPt.x, waitPt2.y - waitPt.y, 0.3 * throttleBias, 0.18);
        } else if (routeStart) {
            fleet.x = routeStart.x;
            fleet.y = routeStart.y;
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
    var impactDir = fleetTravelDirection(fleet, targetNode, params.nodes);

    var particleBursts = [
        {
            x: targetNode.pos ? targetNode.pos.x : 0,
            y: targetNode.pos ? targetNode.pos.y : 0,
            count: 8 + Math.min(atk, 12),
            color: color,
            isCapture: false,
            dirX: impactDir.x,
            dirY: impactDir.y,
            spread: Math.PI * 0.95,
            speedMin: 2.2,
            speedMax: 5.2,
            drag: 0.94,
            lifeMin: 0.28,
            lifeMax: 0.52,
            radiusScale: 0.95,
        },
    ];
    var shockwaves = [
        {
            x: targetNode.pos ? targetNode.pos.x : 0,
            y: targetNode.pos ? targetNode.pos.y : 0,
            color: color,
            radius: targetNode.radius ? targetNode.radius * 0.55 : 10,
            grow: captured ? 28 : 18,
            life: captured ? 0.34 : 0.2,
            alpha: captured ? 0.42 : 0.26,
            lineWidth: captured ? 2.2 : 1.5,
            fillAlpha: captured ? 0.08 : 0.04,
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
            dirX: impactDir.x,
            dirY: impactDir.y,
            spread: Math.PI * 1.65,
            speedMin: 2.8,
            speedMax: 6.2,
            drag: 0.95,
            lifeMin: 0.34,
            lifeMax: 0.68,
            radiusScale: 1.28,
        });
        shockwaves.push({
            x: targetNode.pos ? targetNode.pos.x : 0,
            y: targetNode.pos ? targetNode.pos.y : 0,
            color: '#ffffff',
            radius: targetNode.radius ? targetNode.radius * 0.25 : 6,
            grow: (targetNode.radius || 20) + 22,
            life: 0.42,
            alpha: 0.26,
            lineWidth: 1.4,
            fillAlpha: 0,
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
        shockwaves: shockwaves,
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
    var shockwaves = [];
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
        if (fleet.holding) continue;
        if ((Number(fleet.t) || 0) < 1) continue;

        var targetNode = nodes[fleet.tgtId];
        if (!targetNode) {
            fleet.active = false;
            fleet.trail = [];
            fleets.splice(i, 1);
            continue;
        }

        var arrivingCount = countArrivedFleetUnits(fleet);
        if (arrivingCount <= 0) continue;

        if (targetNode.owner === fleet.owner) {
            var sourceNode = nodes[fleet.srcId];
            var friendlyArrival = resolveFriendlyArrival({
                targetUnits: targetNode.units,
                targetMaxUnits: targetNode.maxUnits,
                sourceUnits: sourceNode && sourceNode.owner === fleet.owner ? sourceNode.units : 0,
                sourceMaxUnits: sourceNode && sourceNode.owner === fleet.owner ? sourceNode.maxUnits : 0,
                fleetCount: arrivingCount,
            });
            targetNode.units = friendlyArrival.targetUnits;
            if (sourceNode && sourceNode.owner === fleet.owner) sourceNode.units = friendlyArrival.sourceUnits;
            if (friendlyArrival.lost > 0 && fleet.owner === humanIndex) {
                toasts.push('Takviye taski: hedef doluydu. Fazla birlik once kaynaga dondu, kalan fazlalik dagildi.');
            }
        } else {
            var combatResult = resolveCombatOutcome({
                fleet: {
                    id: fleet.id,
                    owner: fleet.owner,
                    count: arrivingCount,
                    srcId: fleet.srcId,
                    tgtId: fleet.tgtId,
                    t: fleet.t,
                    headingX: fleet.headingX,
                    headingY: fleet.headingY,
                },
                targetNode: targetNode,
                players: players,
                tune: params.tune,
                humanIndex: humanIndex,
                nodes: nodes,
                callbacks: {
                    nodeTypeOf: nodeTypeOf,
                    nodeLevelDefMult: nodeLevelDefMult,
                    nodeCapacity: nodeCapacity,
                },
                constants: params.constants,
            });
            particleBursts = particleBursts.concat(combatResult.particleBursts);
            shockwaves = shockwaves.concat(combatResult.shockwaves || []);
            audio = audio.concat(combatResult.audio);
            statsDelta.nodesCaptured += combatResult.statsDelta.nodesCaptured;
            statsDelta.gateCaptures += combatResult.statsDelta.gateCaptures;
            if (combatResult.captured) {
                activeFlows = activeFlows.filter(function (flow) {
                    return !(flow.tgtId === targetNode.id && flow.owner !== fleet.owner);
                });
            }
        }

        var remainingCount = Math.max(0, Math.floor(Number(fleet.count) || 0) - arrivingCount);
        if (remainingCount > 0) {
            fleet.count = remainingCount;
            fleet.t = (Number(fleet.t) || 0) - arrivingCount * Math.max(0.0001, getFleetUnitSpacingT(fleet));
            fleet.trail = [];
            var pose = computeFleetPose(fleet, nodes);
            if (pose) {
                fleet.x = pose.x;
                fleet.y = pose.y;
                fleet.headingX = pose.dirX;
                fleet.headingY = pose.dirY;
            }
            continue;
        }

        fleet.active = false;
        fleet.trail = [];
        fleets.splice(i, 1);
    }

    return {
        fleets: fleets,
        flows: activeFlows,
        particleBursts: particleBursts,
        shockwaves: shockwaves,
        audio: audio,
        toasts: toasts,
        statsDelta: statsDelta,
    };
}
