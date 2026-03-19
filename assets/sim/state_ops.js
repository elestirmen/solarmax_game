import { computeSendCount } from './dispatch_math.js';
import { isDispatchAllowed } from './barrier.js';
import { computeFriendlyReinforcementRoom } from './reinforcement.js';
import { isStrategicPulseActiveForNode } from './strategic_pulse.js';
import { SIM_CONSTANTS, buildFleetSpawnProfile, isNodeAssimilated, nodeCapacity, nodeTypeOf, upgradeCost } from './shared_config.js';

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function bezCP(start, target, curve) {
    curve = curve || SIM_CONSTANTS.BEZ_CURV;
    var dx = target.x - start.x;
    var dy = target.y - start.y;
    var mx = start.x + dx * 0.5;
    var my = start.y + dy * 0.5;
    var length = Math.sqrt(dx * dx + dy * dy);
    var nx = 0;
    var ny = 0;
    if (length >= 0.01) {
        nx = -dy / length;
        ny = dx / length;
    }
    return { x: mx + nx * length * curve, y: my + ny * length * curve };
}

function bezPt(p0, cp, p2, t) {
    var u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
    };
}

function bezLen(p0, cp, p2) {
    var length = 0;
    var px = p0.x;
    var py = p0.y;
    for (var i = 1; i <= SIM_CONSTANTS.BEZ_SEG; i++) {
        var t = i / SIM_CONSTANTS.BEZ_SEG;
        var pt = bezPt(p0, cp, p2, t);
        var dx = pt.x - px;
        var dy = pt.y - py;
        length += Math.sqrt(dx * dx + dy * dy);
        px = pt.x;
        py = pt.y;
    }
    return length || 1;
}

function tangentDir(p0, cp, p2, t, step) {
    var pt = bezPt(p0, cp, p2, t);
    var pt2 = bezPt(p0, cp, p2, Math.min(1, t + Math.max(0.01, Number(step) || 0.02)));
    var dx = pt2.x - pt.x;
    var dy = pt2.y - pt.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
}

function normalizePointTarget(point) {
    point = point && typeof point === 'object' ? point : null;
    if (!point) return null;
    var x = Number(point.x);
    var y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: x, y: y };
}

function normalizeDispatchOrder(srcIdsOrData, tgtId, pct) {
    var raw = srcIdsOrData && typeof srcIdsOrData === 'object' && !Array.isArray(srcIdsOrData)
        ? srcIdsOrData
        : { sources: srcIdsOrData, tgtId: tgtId, pct: pct };
    var targetId = raw.tgtId !== undefined ? raw.tgtId : raw.targetId;
    var normalizedTargetId = Number.isFinite(Number(targetId)) ? Math.floor(Number(targetId)) : null;

    return {
        sources: Array.isArray(raw.sources) ? raw.sources.slice() : [],
        fleetIds: Array.isArray(raw.fleetIds) ? raw.fleetIds.slice() : [],
        tgtId: normalizedTargetId,
        targetPoint: normalizePointTarget(raw.targetPoint !== undefined ? raw.targetPoint : raw.point),
        pct: clamp(typeof raw.pct === 'number' ? raw.pct : Number(raw.percent !== undefined ? raw.percent : raw.pct), 0.05, 1),
    };
}

function computeFleetSendCount(fleetCount, pct) {
    var available = Math.max(0, Math.floor(Number(fleetCount) || 0));
    if (available <= 0) return 0;
    if (pct >= 0.999) return available;
    return Math.min(available, Math.max(1, Math.floor(available * pct)));
}

function makeRoutePointKey(point) {
    point = point || { x: 0, y: 0 };
    return Math.round((Number(point.x) || 0) * 10) + ':' + Math.round((Number(point.y) || 0) * 10);
}

function countQueuedRouteFleets(state, owner, sourceKey, targetKey) {
    var count = 0;
    for (var i = 0; i < state.fleets.length; i++) {
        var fleet = state.fleets[i];
        if (!fleet || !fleet.active || fleet.holding || fleet.owner !== owner) continue;
        if (fleet.routeSrcKey === sourceKey && fleet.routeTgtKey === targetKey) count++;
    }
    return count;
}

function createDispatchedFleet(state, params) {
    params = params || {};

    var owner = Number(params.owner);
    var count = Math.max(0, Math.floor(Number(params.count) || 0));
    var sourceNode = params.sourceNode || null;
    var sourceFleet = params.sourceFleet || null;
    var targetNode = params.targetNode || null;
    var sourcePos = params.sourcePos || (sourceNode && sourceNode.pos) || null;
    var targetPos = params.targetPos || (targetNode && targetNode.pos) || null;
    if (!sourcePos || !targetPos || count <= 0) return false;

    var hasWormholeLink = !!(sourceNode && targetNode && isLinkedWormhole(state.wormholes, sourceNode.id, targetNode.id));
    var cp = bezCP(sourcePos, targetPos, hasWormholeLink ? 0.05 : SIM_CONSTANTS.BEZ_CURV);
    var sourceKey = sourceNode ? 'n:' + sourceNode.id : 'f:' + (sourceFleet ? sourceFleet.id : Math.round(sourcePos.x) + ':' + Math.round(sourcePos.y));
    var targetKey = targetNode ? 'n:' + targetNode.id : 'p:' + makeRoutePointKey(targetPos);
    var routeQueue = countQueuedRouteFleets(state, owner, sourceKey, targetKey);
    var launchDelay = hasWormholeLink ? 0 : Math.min(0.28, routeQueue * 0.03);
    var arcLen = hasWormholeLink ? 1 : bezLen(sourcePos, cp, targetPos);
    var sourceRadius = sourceNode && Number.isFinite(Number(sourceNode.radius))
        ? Number(sourceNode.radius)
        : Math.max(6, Math.min(18, Math.sqrt(count) * 1.6));
    var launchT = hasWormholeLink ? 0 : clamp((sourceRadius + 2) / Math.max(arcLen, 1), 0, sourceNode ? 0.12 : 0.08);
    var launchPoint = hasWormholeLink
        ? { x: targetPos.x, y: targetPos.y }
        : bezPt(sourcePos, cp, targetPos, launchT);

    var routeSpeedMult = 1;
    if (sourceNode && !hasWormholeLink) {
        var srcType = nodeTypeOf(sourceNode);
        routeSpeedMult = srcType.speed;
        if (isNodeAssimilated(sourceNode) && isStrategicPulseActiveForNode(sourceNode.id, state.strategicPulse)) {
            routeSpeedMult *= SIM_CONSTANTS.STRATEGIC_PULSE_SPEED;
        }
    }

    state.fleetSerial = Math.max(0, Math.floor(Number(state.fleetSerial) || 0)) + 1;
    var spawnProfile = buildFleetSpawnProfile({
        seed: state.seed,
        srcId: sourceNode ? sourceNode.id : -Math.max(1, Math.floor(Number(sourceFleet && sourceFleet.id) || 1)),
        tgtId: targetNode ? targetNode.id : Math.round(targetPos.x * 7 + targetPos.y * 13),
        serial: state.fleetSerial,
        routeQueue: routeQueue,
        count: count,
        routeSpeedMult: routeSpeedMult,
    });
    var whDx = targetPos.x - sourcePos.x;
    var whDy = targetPos.y - sourcePos.y;
    var whLen = Math.sqrt(whDx * whDx + whDy * whDy) || 1;
    var launchDir = hasWormholeLink
        ? { x: whDx / whLen, y: whDy / whLen }
        : tangentDir(sourcePos, cp, targetPos, launchT, Math.max(0.012, spawnProfile.lookAhead));

    state.fleets.push({
        id: state.fleetSerial,
        active: true,
        owner: owner,
        count: count,
        srcId: sourceNode ? sourceNode.id : -1,
        tgtId: targetNode ? targetNode.id : -1,
        fromX: sourcePos.x,
        fromY: sourcePos.y,
        toX: targetPos.x,
        toY: targetPos.y,
        holding: false,
        holdUnsuppliedTicks: 0,
        routeSrcKey: sourceKey,
        routeTgtKey: targetKey,
        t: hasWormholeLink ? 1 : -launchDelay,
        speed: SIM_CONSTANTS.FLEET_SPEED,
        arcLen: arcLen,
        cpx: cp.x,
        cpy: cp.y,
        x: launchPoint.x,
        y: launchPoint.y,
        trail: [],
        offsetL: spawnProfile.offsetL,
        spdVar: spawnProfile.spdVar,
        routeSpeedMult: routeSpeedMult,
        trailScale: spawnProfile.trailScale,
        headingX: launchDir.x,
        headingY: launchDir.y,
        bank: 0,
        throttle: 0.34 * spawnProfile.throttleBias,
        turnRate: spawnProfile.turnRate,
        throttleBias: spawnProfile.throttleBias,
        lookAhead: spawnProfile.lookAhead,
        hitFlash: 0,
        hitJitter: 0,
        hitDirX: 0,
        hitDirY: 0,
        dmgAcc: 0,
        launchT: launchT,
        wormholeInstant: !!hasWormholeLink,
    });

    return hasWormholeLink;
}

export function isLinkedWormhole(wormholes, srcId, tgtId) {
    var links = Array.isArray(wormholes) ? wormholes : [];
    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (!link) continue;
        if ((link.a === srcId && link.b === tgtId) || (link.b === srcId && link.a === tgtId)) return true;
    }
    return false;
}

export function dispatchUnits(state, owner, srcIds, tgtId, pct) {
    state = state || {};
    var order = normalizeDispatchOrder(srcIds, tgtId, pct);
    var sourceIds = Array.isArray(order.sources) ? order.sources : [];
    var fleetIds = Array.isArray(order.fleetIds) ? order.fleetIds : [];
    var targetNode = state.nodes && order.tgtId !== null ? state.nodes[order.tgtId] : null;
    var targetPoint = targetNode ? targetNode.pos : order.targetPoint;
    if (!targetNode && !targetPoint) return false;

    var didSend = false;
    var blockedByBarrier = false;
    var barrierCfg = state.mapFeature && state.mapFeature.type === 'barrier' ? state.mapFeature : null;
    var friendlyRoom = null;
    if (targetNode && targetNode.owner === owner) {
        var incomingFriendlyUnits = 0;
        for (var fi0 = 0; fi0 < state.fleets.length; fi0++) {
            var incomingFleet = state.fleets[fi0];
            if (!incomingFleet || !incomingFleet.active || incomingFleet.owner !== owner || incomingFleet.tgtId !== order.tgtId) continue;
            incomingFriendlyUnits += Math.max(0, Math.floor(Number(incomingFleet.count) || 0));
        }
        friendlyRoom = computeFriendlyReinforcementRoom({
            targetUnits: targetNode.units,
            targetMaxUnits: targetNode.maxUnits,
            incomingUnits: incomingFriendlyUnits,
        });
    }

    for (var si = 0; si < sourceIds.length; si++) {
        var sourceNode = state.nodes[sourceIds[si]];
        if (!sourceNode || sourceNode.owner !== owner) continue;
        if (!isDispatchAllowed({
            src: sourceNode,
            tgt: targetNode || { pos: targetPoint },
            barrier: barrierCfg,
            owner: owner,
            nodes: state.nodes,
        })) {
            blockedByBarrier = true;
            continue;
        }

        var srcType = nodeTypeOf(sourceNode);
        var send = computeSendCount({ srcUnits: sourceNode.units, pct: order.pct, flowMult: srcType.flow });
        var count = send.sendCount;
        if (friendlyRoom !== null) count = Math.min(count, friendlyRoom);
        if (count <= 0) continue;

        if (count === send.sendCount) sourceNode.units = send.newSrcUnits;
        else sourceNode.units -= count;
        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= count;

        var usedWormhole = createDispatchedFleet(state, {
            owner: owner,
            count: count,
            sourceNode: sourceNode,
            targetNode: targetNode,
            sourcePos: sourceNode.pos,
            targetPos: targetPoint,
        });

        if (owner === state.humanIndex && usedWormhole && state.stats) {
            state.stats.wormholeDispatches = (Number(state.stats.wormholeDispatches) || 0) + 1;
        }
    }

    for (var fi2 = 0; fi2 < fleetIds.length; fi2++) {
        var sourceFleet = null;
        for (var sf = 0; sf < state.fleets.length; sf++) {
            var parked = state.fleets[sf];
            if (!parked || !parked.active || !parked.holding || parked.owner !== owner) continue;
            if ((Number(parked.id) || 0) === fleetIds[fi2]) {
                sourceFleet = parked;
                break;
            }
        }
        if (!sourceFleet) continue;

        var fleetSourcePos = { x: Number(sourceFleet.x) || 0, y: Number(sourceFleet.y) || 0 };
        if (!isDispatchAllowed({
            src: { pos: fleetSourcePos },
            tgt: targetNode || { pos: targetPoint },
            barrier: barrierCfg,
            owner: owner,
            nodes: state.nodes,
        })) {
            blockedByBarrier = true;
            continue;
        }

        var fleetCount = computeFleetSendCount(sourceFleet.count, order.pct);
        if (friendlyRoom !== null) fleetCount = Math.min(fleetCount, friendlyRoom);
        if (fleetCount <= 0) continue;

        sourceFleet.count = Math.max(0, Math.floor(Number(sourceFleet.count) || 0) - fleetCount);
        if (sourceFleet.count <= 0) {
            sourceFleet.count = 0;
            sourceFleet.active = false;
            sourceFleet.holding = false;
            sourceFleet.holdUnsuppliedTicks = 0;
            sourceFleet.trail = [];
        }

        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= fleetCount;

        createDispatchedFleet(state, {
            owner: owner,
            count: fleetCount,
            sourceFleet: sourceFleet,
            targetNode: targetNode,
            sourcePos: fleetSourcePos,
            targetPos: targetPoint,
        });
    }

    if (didSend && owner === state.humanIndex && state.stats) {
        state.stats.fleetsSent = (Number(state.stats.fleetsSent) || 0) + 1;
    }

    return didSend || blockedByBarrier || friendlyRoom !== null;
}

export function addFlowLink(state, owner, srcId, tgtId) {
    srcId = Math.floor(Number(srcId));
    tgtId = Math.floor(Number(tgtId));
    if (!isFinite(srcId) || !isFinite(tgtId) || srcId === tgtId) return false;
    var sourceNode = state.nodes[srcId];
    var targetNode = state.nodes[tgtId];
    if (!sourceNode || !targetNode || sourceNode.owner !== owner) return false;
    for (var i = 0; i < state.flows.length; i++) {
        var flow = state.flows[i];
        if (flow.srcId === srcId && flow.tgtId === tgtId && flow.owner === owner) {
            flow.active = !flow.active;
            return true;
        }
    }
    state.flowId = Math.max(0, Math.floor(Number(state.flowId) || 0)) + 1;
    state.flows.push({ id: state.flowId, srcId: srcId, tgtId: tgtId, owner: owner, tickAcc: 0, active: true });
    if (owner === state.humanIndex && state.stats) {
        state.stats.flowLinksCreated = (Number(state.stats.flowLinksCreated) || 0) + 1;
    }
    return true;
}

export function removeFlowLink(state, owner, srcId, tgtId) {
    state.flows = state.flows.filter(function (flow) {
        return !(flow.srcId === srcId && flow.tgtId === tgtId && flow.owner === owner);
    });
    return true;
}

export function toggleDefenseMode(state, owner, nodeId) {
    var node = state.nodes[nodeId];
    if (!node || node.owner !== owner) return false;
    node.defense = !node.defense;
    if (owner === state.humanIndex && node.defense && state.stats) {
        state.stats.defenseActivations = (Number(state.stats.defenseActivations) || 0) + 1;
    }
    return true;
}

export function upgradeStateNode(state, owner, nodeId) {
    if (!state.rules || !state.rules.allowUpgrade) return false;
    var node = state.nodes[nodeId];
    if (!node || node.owner !== owner || !isNodeAssimilated(node)) return false;
    if ((Number(node.level) || 1) >= SIM_CONSTANTS.NODE_LEVEL_MAX) return false;
    var cost = upgradeCost(node);
    if ((Number(node.units) || 0) < cost) return false;
    node.units -= cost;
    node.level = (Number(node.level) || 1) + 1;
    node.maxUnits = nodeCapacity(node);
    if (node.units > node.maxUnits) node.units = node.maxUnits;
    if (owner === state.humanIndex && state.stats) {
        state.stats.upgrades = (Number(state.stats.upgrades) || 0) + 1;
    }
    return true;
}
