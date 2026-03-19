function mixHash(hash, value) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    return hash >>> 0;
}

function mixText(hash, value) {
    var text = String(value || '');
    hash = mixHash(hash, text.length);
    for (var i = 0; i < text.length; i++) {
        hash = mixHash(hash, text.charCodeAt(i));
    }
    return hash >>> 0;
}

function scaledInt(value, scale) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.floor(n * scale);
}

function typeCode(value) {
    value = String(value || '').toLowerCase();
    if (value === 'wormhole') return 11;
    if (value === 'gravity') return 13;
    if (value === 'barrier') return 17;
    if (value === 'ion_storm') return 19;
    if (value === 'blackout') return 23;
    if (value === 'auto') return 29;
    if (value === 'relay_core') return 31;
    if (value === 'mega_turret') return 37;
    return 7;
}

function doctrineCode(value) {
    value = String(value || '').toLowerCase();
    if (value === 'logistics') return 41;
    if (value === 'assimilation') return 43;
    if (value === 'siege') return 47;
    return 11;
}

function hashNodeIds(hash, nodeIds) {
    nodeIds = Array.isArray(nodeIds) ? nodeIds : [];
    hash = mixHash(hash, nodeIds.length);
    for (var i = 0; i < nodeIds.length; i++) {
        hash = mixHash(hash, Number(nodeIds[i]) || 0);
    }
    return hash >>> 0;
}

function hashObjective(hash, objective) {
    objective = objective || {};
    hash = mixText(hash, objective.id || '');
    hash = mixText(hash, objective.type || '');
    hash = mixText(hash, objective.encounterId || '');
    hash = mixText(hash, objective.encounterType || '');
    hash = mixHash(hash, scaledInt(objective.target, 1000));
    hash = mixHash(hash, objective.optional ? 1 : 0);
    hash = hashNodeIds(hash, objective.nodeIds);
    return hash >>> 0;
}

function hashLossCondition(hash, condition) {
    condition = condition || {};
    hash = mixText(hash, condition.id || '');
    hash = mixText(hash, condition.type || '');
    hash = mixHash(hash, scaledInt(condition.target, 1000));
    hash = mixHash(hash, Number(condition.graceTick) || 0);
    hash = hashNodeIds(hash, condition.nodeIds);
    return hash >>> 0;
}

function hashMissionScript(hash, missionScript) {
    var phases = Array.isArray(missionScript && missionScript.phases) ? missionScript.phases : [];
    hash = mixHash(hash, phases.length);
    for (var i = 0; i < phases.length; i++) {
        var phase = phases[i] || {};
        var objectives = Array.isArray(phase.objectives) ? phase.objectives : [];
        var lossConditions = Array.isArray(phase.lossConditions) ? phase.lossConditions : [];
        hash = mixText(hash, phase.id || '');
        hash = mixHash(hash, objectives.length);
        for (var oi = 0; oi < objectives.length; oi++) {
            hash = hashObjective(hash, objectives[oi]);
        }
        hash = mixHash(hash, lossConditions.length);
        for (var li = 0; li < lossConditions.length; li++) {
            hash = hashLossCondition(hash, lossConditions[li]);
        }
    }
    return hash >>> 0;
}

function hashMissionState(hash, missionState) {
    missionState = missionState && typeof missionState === 'object' ? missionState : null;
    if (!missionState) return mixHash(hash, 0);
    hash = mixHash(hash, 1);
    hash = mixHash(hash, Number(missionState.phaseIndex) || 0);
    hash = mixHash(hash, Number(missionState.phaseStartedTick) || 0);
    hash = mixHash(hash, missionState.failed ? 1 : 0);
    var completedPhaseIds = Array.isArray(missionState.completedPhaseIds) ? missionState.completedPhaseIds : [];
    hash = mixHash(hash, completedPhaseIds.length);
    for (var i = 0; i < completedPhaseIds.length; i++) {
        hash = mixText(hash, completedPhaseIds[i]);
    }
    hash = mixText(hash, missionState.failureText || '');
    return hash >>> 0;
}

export function computeSyncHash(state) {
    state = state || {};
    var nodes = Array.isArray(state.nodes) ? state.nodes : [];
    var fleets = Array.isArray(state.fleets) ? state.fleets : [];
    var players = Array.isArray(state.players) ? state.players : [];
    var doctrines = Array.isArray(state.doctrines) ? state.doctrines : [];
    var doctrineStates = Array.isArray(state.doctrineStates) ? state.doctrineStates : [];
    var encounters = Array.isArray(state.encounters) ? state.encounters : [];
    var objectives = Array.isArray(state.objectives) ? state.objectives : [];
    var tick = Number(state.tick);
    var winner = Number(state.winner);
    if (!Number.isFinite(tick)) tick = 0;
    if (!Number.isFinite(winner)) winner = -1;

    var hash = 2166136261 >>> 0;
    hash = mixHash(hash, tick);
    hash = mixHash(hash, state.state === 'gameOver' ? 1 : 0);
    hash = mixHash(hash, winner + 2);
    hash = mixHash(hash, state.endOnObjectives === true ? 1 : 0);
    hash = mixHash(hash, players.length);
    hash = mixHash(hash, nodes.length);
    hash = mixHash(hash, typeCode(state.mapFeature && state.mapFeature.type));
    hash = mixHash(hash, scaledInt(state.mapFeature && state.mapFeature.x, 10));
    hash = mixHash(hash, scaledInt(state.mapFeature && state.mapFeature.y, 10));
    hash = mixHash(hash, scaledInt(state.mapFeature && state.mapFeature.r, 10));
    hash = mixHash(hash, Number(state.mapFeature && state.mapFeature.nodeId) || 0);
    var gateIds = Array.isArray(state.mapFeature && state.mapFeature.gateIds) ? state.mapFeature.gateIds : [];
    hash = mixHash(hash, gateIds.length);
    for (var gi = 0; gi < gateIds.length; gi++) hash = mixHash(hash, Number(gateIds[gi]) || 0);
    hash = mixHash(hash, typeCode(state.mapMutator && state.mapMutator.type));
    hash = mixHash(hash, scaledInt(state.mapMutator && state.mapMutator.x, 10));
    hash = mixHash(hash, scaledInt(state.mapMutator && state.mapMutator.y, 10));
    hash = mixHash(hash, scaledInt(state.mapMutator && state.mapMutator.r, 10));
    hash = mixHash(hash, scaledInt(state.mapMutator && state.mapMutator.speedMult, 1000));
    hash = mixHash(hash, objectives.length);
    for (var oi0 = 0; oi0 < objectives.length; oi0++) {
        hash = hashObjective(hash, objectives[oi0]);
    }
    hash = hashMissionScript(hash, state.missionScript);
    hash = hashMissionState(hash, state.missionState);
    hash = mixText(hash, state.missionFailureText || '');

    for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni] || {};
        hash = mixHash(hash, Number(node.id) || ni);
        hash = mixHash(hash, (Number(node.owner) || 0) + 2);
        hash = mixHash(hash, scaledInt(node.units, 100));
        hash = mixHash(hash, Number(node.level) || 0);
        hash = mixHash(hash, node.defense ? 1 : 0);
        hash = mixHash(hash, scaledInt(node.assimilationProgress, 1000));
        hash = mixHash(hash, Number(node.assimilationLock) || 0);
    }

    var activeCount = 0;
    for (var fi = 0; fi < fleets.length; fi++) {
        if (fleets[fi] && fleets[fi].active) activeCount++;
    }
    hash = mixHash(hash, activeCount);

    for (var fj = 0; fj < fleets.length; fj++) {
        var fleet = fleets[fj];
        if (!fleet || !fleet.active) continue;
        hash = mixHash(hash, (Number(fleet.owner) || 0) + 2);
        hash = mixHash(hash, Number(fleet.srcId) || 0);
        hash = mixHash(hash, Number(fleet.tgtId) || 0);
        hash = mixHash(hash, fleet.holding ? 1 : 0);
        hash = mixHash(hash, Number(fleet.holdUnsuppliedTicks) || 0);
        hash = mixHash(hash, scaledInt(fleet.count, 100));
        hash = mixHash(hash, scaledInt(fleet.t, 10000));
        hash = mixHash(hash, scaledInt(fleet.x, 10));
        hash = mixHash(hash, scaledInt(fleet.y, 10));
        hash = mixHash(hash, scaledInt(fleet.fromX, 10));
        hash = mixHash(hash, scaledInt(fleet.fromY, 10));
        hash = mixHash(hash, scaledInt(fleet.toX, 10));
        hash = mixHash(hash, scaledInt(fleet.toY, 10));
        hash = mixHash(hash, scaledInt(fleet.cpx, 10));
        hash = mixHash(hash, scaledInt(fleet.cpy, 10));
    }

    for (var pi = 0; pi < players.length; pi++) {
        var player = players[pi] || {};
        hash = mixHash(hash, player.alive === false ? 0 : 1);
        hash = mixHash(hash, player.isAI ? 1 : 0);
        hash = mixHash(hash, doctrineCode(doctrines[pi]));
        hash = mixHash(hash, Number(doctrineStates[pi] && doctrineStates[pi].cooldownTicks) || 0);
        hash = mixHash(hash, Number(doctrineStates[pi] && doctrineStates[pi].activeTicks) || 0);
    }

    hash = mixHash(hash, encounters.length);
    for (var ei = 0; ei < encounters.length; ei++) {
        var encounter = encounters[ei] || {};
        hash = mixHash(hash, typeCode(encounter.type));
        hash = mixHash(hash, Number(encounter.nodeId) || 0);
        hash = mixHash(hash, (Number(encounter.owner) || 0) + 2);
        hash = mixHash(hash, encounter.assimilated ? 1 : 0);
        var controlTicksByPlayer = encounter.controlTicksByPlayer || {};
        for (var ci = 0; ci < players.length; ci++) {
            hash = mixHash(hash, Number(controlTicksByPlayer[ci]) || 0);
        }
    }

    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
