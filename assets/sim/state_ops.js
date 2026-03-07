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
    srcIds = Array.isArray(srcIds) ? srcIds : [];
    pct = clamp(typeof pct === 'number' ? pct : 0.5, 0.05, 1);

    var targetNode = state.nodes && state.nodes[tgtId];
    if (!targetNode) return false;

    var didSend = false;
    var blockedByBarrier = false;
    var barrierCfg = state.mapFeature && state.mapFeature.type === 'barrier' ? state.mapFeature : null;
    var friendlyRoom = null;
    if (targetNode.owner === owner) {
        var incomingFriendlyUnits = 0;
        for (var fi0 = 0; fi0 < state.fleets.length; fi0++) {
            var incomingFleet = state.fleets[fi0];
            if (!incomingFleet || !incomingFleet.active || incomingFleet.owner !== owner || incomingFleet.tgtId !== tgtId) continue;
            incomingFriendlyUnits += Math.max(0, Math.floor(Number(incomingFleet.count) || 0));
        }
        friendlyRoom = computeFriendlyReinforcementRoom({
            targetUnits: targetNode.units,
            targetMaxUnits: targetNode.maxUnits,
            incomingUnits: incomingFriendlyUnits,
        });
    }

    for (var si = 0; si < srcIds.length; si++) {
        var sourceNode = state.nodes[srcIds[si]];
        if (!sourceNode || sourceNode.owner !== owner) continue;
        if (!isDispatchAllowed({ src: sourceNode, tgt: targetNode, barrier: barrierCfg, owner: owner, nodes: state.nodes })) {
            blockedByBarrier = true;
            continue;
        }

        var srcType = nodeTypeOf(sourceNode);
        var send = computeSendCount({ srcUnits: sourceNode.units, pct: pct, flowMult: srcType.flow });
        var count = send.sendCount;
        if (friendlyRoom !== null) count = Math.min(count, friendlyRoom);
        if (count <= 0) continue;

        if (count === send.sendCount) sourceNode.units = send.newSrcUnits;
        else sourceNode.units -= count;
        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= count;

        var hasWormholeLink = isLinkedWormhole(state.wormholes, sourceNode.id, tgtId);
        var cp = bezCP(sourceNode.pos, targetNode.pos, hasWormholeLink ? 0.05 : SIM_CONSTANTS.BEZ_CURV);
        var routeQueue = 0;
        for (var fi = 0; fi < state.fleets.length; fi++) {
            var queuedFleet = state.fleets[fi];
            if (!queuedFleet || !queuedFleet.active) continue;
            if (queuedFleet.owner === owner && queuedFleet.srcId === sourceNode.id && queuedFleet.tgtId === tgtId) routeQueue++;
        }
        var launchDelay = Math.min(0.28, routeQueue * 0.03);
        var arcLen = bezLen(sourceNode.pos, cp, targetNode.pos);
        var launchT = clamp((sourceNode.radius + 2) / Math.max(arcLen, 1), 0, 0.12);
        var launchPoint = bezPt(sourceNode.pos, cp, targetNode.pos, launchT);
        var routeSpeedMult = srcType.speed * (hasWormholeLink ? SIM_CONSTANTS.WORMHOLE_SPEED_MULT : 1);
        if (isNodeAssimilated(sourceNode) && isStrategicPulseActiveForNode(sourceNode.id, state.strategicPulse)) {
            routeSpeedMult *= SIM_CONSTANTS.STRATEGIC_PULSE_SPEED;
        }

        state.fleetSerial = Math.max(0, Math.floor(Number(state.fleetSerial) || 0)) + 1;
        var spawnProfile = buildFleetSpawnProfile({
            seed: state.seed,
            srcId: sourceNode.id,
            tgtId: tgtId,
            serial: state.fleetSerial,
            routeQueue: routeQueue,
            count: count,
            routeSpeedMult: routeSpeedMult,
        });
        var launchDir = tangentDir(sourceNode.pos, cp, targetNode.pos, launchT, Math.max(0.012, spawnProfile.lookAhead));
        state.fleets.push({
            id: state.fleetSerial,
            active: true,
            owner: owner,
            count: count,
            srcId: sourceNode.id,
            tgtId: tgtId,
            t: -launchDelay,
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
        });

        if (owner === state.humanIndex && hasWormholeLink && state.stats) {
            state.stats.wormholeDispatches = (Number(state.stats.wormholeDispatches) || 0) + 1;
        }
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
