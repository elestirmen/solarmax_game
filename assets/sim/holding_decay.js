import { SIM_CONSTANTS, isNodeAssimilated } from './shared_config.js';

function resolveFleetPoint(fleet) {
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) {
        return { x: Number(fleet.x), y: Number(fleet.y) };
    }
    if (Number.isFinite(fleet.toX) && Number.isFinite(fleet.toY)) {
        return { x: Number(fleet.toX), y: Number(fleet.toY) };
    }
    if (Number.isFinite(fleet.fromX) && Number.isFinite(fleet.fromY)) {
        return { x: Number(fleet.fromX), y: Number(fleet.fromY) };
    }
    return null;
}

export function isHoldingFleetSupplied(params) {
    params = params || {};

    var fleet = params.fleet || null;
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};

    if (!fleet || !fleet.active || !fleet.holding) return true;

    var owner = Math.floor(Number(fleet.owner));
    if (!Number.isFinite(owner) || owner < 0) return false;

    var fleetPoint = resolveFleetPoint(fleet);
    if (!fleetPoint) return false;

    var supplyDist = Number(constants.holdSupplyDist);
    if (!Number.isFinite(supplyDist) || supplyDist <= 0) supplyDist = SIM_CONSTANTS.SUPPLY_DIST;
    var assimilatedFn = typeof callbacks.isNodeAssimilated === 'function' ? callbacks.isNodeAssimilated : isNodeAssimilated;

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner !== owner || !node.pos || !assimilatedFn(node)) continue;
        var reach = supplyDist + Math.max(0, Number(node.radius) || 0);
        var dx = fleetPoint.x - (Number(node.pos.x) || 0);
        var dy = fleetPoint.y - (Number(node.pos.y) || 0);
        if (dx * dx + dy * dy <= reach * reach) return true;
    }

    return false;
}

export function stepHoldingFleetDecay(params) {
    params = params || {};

    var fleets = Array.isArray(params.fleets) ? params.fleets : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};

    var graceTicks = Math.max(0, Math.floor(Number(constants.holdDecayGraceTicks) || SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS));
    var intervalTicks = Math.max(1, Math.floor(Number(constants.holdDecayIntervalTicks) || SIM_CONSTANTS.HOLD_DECAY_INTERVAL_TICKS));
    var report = {
        decayedFleets: 0,
        lostUnits: 0,
        collapsedFleetIds: [],
    };

    for (var i = 0; i < fleets.length; i++) {
        var fleet = fleets[i];
        if (!fleet || !fleet.active || !fleet.holding) continue;

        if (isHoldingFleetSupplied({
            fleet: fleet,
            nodes: nodes,
            callbacks: callbacks,
            constants: constants,
        })) {
            fleet.holdUnsuppliedTicks = 0;
            continue;
        }

        var unsuppliedTicks = Math.max(0, Math.floor(Number(fleet.holdUnsuppliedTicks) || 0)) + 1;
        fleet.holdUnsuppliedTicks = unsuppliedTicks;
        if (unsuppliedTicks <= graceTicks) continue;
        if ((unsuppliedTicks - graceTicks) % intervalTicks !== 0) continue;

        var currentCount = Math.max(0, Math.floor(Number(fleet.count) || 0));
        if (currentCount <= 0) continue;

        fleet.count = currentCount - 1;
        fleet.hitFlash = Math.max(Number(fleet.hitFlash) || 0, 0.14);
        fleet.hitJitter = Math.max(Number(fleet.hitJitter) || 0, 0.12);
        report.decayedFleets++;
        report.lostUnits++;

        if (fleet.count > 0) continue;

        fleet.count = 0;
        fleet.active = false;
        fleet.holding = false;
        fleet.t = 0;
        if (Array.isArray(fleet.trail)) fleet.trail.length = 0;
        report.collapsedFleetIds.push(Number(fleet.id) || 0);
    }

    return report;
}
