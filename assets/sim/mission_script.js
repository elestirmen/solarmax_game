import { evaluateCampaignObjectives } from '../campaign/objectives.js';

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function toFiniteInt(value, fallback) {
    value = Number(value);
    if (!Number.isFinite(value)) return fallback;
    return Math.floor(value);
}

function normalizeObjectiveList(list) {
    return Array.isArray(list) ? cloneValue(list) : [];
}

function normalizeLossCondition(rawCondition) {
    rawCondition = rawCondition && typeof rawCondition === 'object' ? rawCondition : {};
    var type = String(rawCondition.type || '').toLowerCase();
    if (
        type !== 'owned_nodes_below' &&
        type !== 'control_node_ids_below' &&
        type !== 'phase_time_limit' &&
        type !== 'tick_limit'
    ) return null;

    return {
        id: String(rawCondition.id || type).slice(0, 64) || type,
        type: type,
        target: Math.max(0, toFiniteInt(rawCondition.target, 0)),
        graceTick: Math.max(0, toFiniteInt(rawCondition.graceTick, 0)),
        nodeIds: Array.isArray(rawCondition.nodeIds) ? rawCondition.nodeIds.slice() : [],
        message: String(rawCondition.message || '').trim(),
    };
}

function normalizeMissionPhase(rawPhase, index, fallbackObjectives) {
    rawPhase = rawPhase && typeof rawPhase === 'object' ? rawPhase : {};
    var objectives = normalizeObjectiveList(rawPhase.objectives);
    if (!objectives.length && index === 0) objectives = normalizeObjectiveList(fallbackObjectives);
    return {
        id: String(rawPhase.id || ('phase-' + (index + 1))).slice(0, 64) || ('phase-' + (index + 1)),
        title: String(rawPhase.title || ('Faz ' + (index + 1))).trim(),
        blurb: String(rawPhase.blurb || '').trim(),
        hint: String(rawPhase.hint || '').trim(),
        objectives: objectives,
        lossConditions: (Array.isArray(rawPhase.lossConditions) ? rawPhase.lossConditions : [])
            .map(normalizeLossCondition)
            .filter(Boolean),
    };
}

function humanIndexOfState(state) {
    if (Number.isFinite(Number(state && state.humanIndex))) return Math.floor(Number(state.humanIndex));
    if (Number.isFinite(Number(state && state.human))) return Math.floor(Number(state.human));
    return 0;
}

function buildMissionSnapshot(state) {
    return {
        tick: Math.max(0, toFiniteInt(state && state.tick, 0)),
        didWin: Number(state && state.winner) === humanIndexOfState(state),
        gameOver: state && state.state === 'gameOver',
        ownedNodes: Math.max(0, toFiniteInt(state && state.ownedNodes, -1)),
        stats: state && state.stats ? state.stats : {},
        encounters: Array.isArray(state && state.encounters) ? state.encounters : [],
        humanIndex: humanIndexOfState(state),
        nodes: Array.isArray(state && state.nodes) ? state.nodes : [],
    };
}

function countOwnedNodesForHuman(nodes, humanIndex) {
    var total = 0;
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].owner === humanIndex) total++;
    }
    return total;
}

function countControlledNodeIds(snapshot, nodeIds) {
    nodeIds = Array.isArray(nodeIds) ? nodeIds : [];
    var nodes = Array.isArray(snapshot && snapshot.nodes) ? snapshot.nodes : [];
    var humanIndex = Number(snapshot && snapshot.humanIndex);
    var controlled = 0;
    for (var i = 0; i < nodeIds.length; i++) {
        var node = nodes[Number(nodeIds[i])];
        if (!node || node.owner !== humanIndex) continue;
        if ((Number(node.assimilationLock) || 0) > 0) continue;
        if (node.assimilationProgress !== undefined && Number(node.assimilationProgress) < 1) continue;
        controlled++;
    }
    return controlled;
}

function requiredObjectivesComplete(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var hasRequired = false;
    for (var i = 0; i < rows.length; i++) {
        if (!rows[i] || rows[i].optional) continue;
        hasRequired = true;
        if (!rows[i].complete) return false;
    }
    return hasRequired;
}

function conditionTriggered(condition, snapshot, missionState) {
    condition = condition || {};
    snapshot = snapshot || {};
    missionState = missionState || {};
    if (condition.type === 'owned_nodes_below') {
        if ((Number(snapshot.tick) || 0) < (Number(condition.graceTick) || 0)) return false;
        return (Number(snapshot.ownedNodes) || 0) < Math.max(0, Number(condition.target) || 0);
    }
    if (condition.type === 'control_node_ids_below') {
        if ((Number(snapshot.tick) || 0) < (Number(condition.graceTick) || 0)) return false;
        return countControlledNodeIds(snapshot, condition.nodeIds) < Math.max(0, Number(condition.target) || 0);
    }
    if (condition.type === 'phase_time_limit') {
        return ((Number(snapshot.tick) || 0) - (Number(missionState.phaseStartedTick) || 0)) >= Math.max(0, Number(condition.target) || 0);
    }
    if (condition.type === 'tick_limit') {
        return (Number(snapshot.tick) || 0) >= Math.max(0, Number(condition.target) || 0);
    }
    return false;
}

export function normalizeMissionScript(rawScript, fallbackObjectives) {
    rawScript = rawScript && typeof rawScript === 'object' ? rawScript : null;
    if (!rawScript || !Array.isArray(rawScript.phases) || !rawScript.phases.length) return null;
    var phases = [];
    for (var i = 0; i < rawScript.phases.length; i++) {
        phases.push(normalizeMissionPhase(rawScript.phases[i], i, fallbackObjectives));
    }
    if (!phases.length) return null;
    return {
        phases: phases,
    };
}

export function ensureMissionState(rawState, missionScript, tick) {
    if (!missionScript || !Array.isArray(missionScript.phases) || !missionScript.phases.length) return null;
    rawState = rawState && typeof rawState === 'object' ? rawState : {};
    var phaseIndex = toFiniteInt(rawState.phaseIndex, 0);
    if (phaseIndex < 0) phaseIndex = 0;
    if (phaseIndex >= missionScript.phases.length) phaseIndex = missionScript.phases.length - 1;
    return {
        phaseIndex: phaseIndex,
        phaseStartedTick: Math.max(0, toFiniteInt(rawState.phaseStartedTick, Math.max(0, toFiniteInt(tick, 0)))),
        completedPhaseIds: Array.isArray(rawState.completedPhaseIds) ? rawState.completedPhaseIds.slice(0, 32) : [],
        failed: rawState.failed === true,
        failureText: String(rawState.failureText || '').trim(),
    };
}

export function getActiveMissionPhase(missionScript, missionState) {
    if (!missionScript || !missionState || !Array.isArray(missionScript.phases) || !missionScript.phases.length) return null;
    return missionScript.phases[Math.max(0, Math.min(missionScript.phases.length - 1, Number(missionState.phaseIndex) || 0))] || null;
}

export function applyMissionScript(state, rawMissionScript) {
    state = state && typeof state === 'object' ? state : {};
    var fallbackObjectives = Array.isArray(state.objectives) ? state.objectives : [];
    state.missionScript = normalizeMissionScript(rawMissionScript, fallbackObjectives);
    state.missionState = ensureMissionState(state.missionState, state.missionScript, state.tick);
    state.missionFailureText = String(state.missionFailureText || '').trim();
    if (!state.missionScript || !state.missionState) return null;
    var phase = getActiveMissionPhase(state.missionScript, state.missionState);
    state.objectives = normalizeObjectiveList(phase && phase.objectives);
    return phase;
}

export function advanceMissionState(state, opts) {
    state = state && typeof state === 'object' ? state : {};
    opts = opts && typeof opts === 'object' ? opts : {};

    var snapshot = buildMissionSnapshot({
        tick: state.tick,
        winner: state.winner,
        state: state.state,
        ownedNodes: state.ownedNodes !== undefined ? state.ownedNodes : countOwnedNodesForHuman(state.nodes || [], humanIndexOfState(state)),
        stats: state.stats,
        encounters: state.encounters,
        humanIndex: humanIndexOfState(state),
        nodes: state.nodes,
    });
    var tickRate = Math.max(1, toFiniteInt(opts.tickRate, 30));
    var rows = evaluateCampaignObjectives({
        objectives: Array.isArray(state.objectives) ? state.objectives : [],
    }, snapshot, {
        tickRate: tickRate,
    });
    var phase = getActiveMissionPhase(state.missionScript, state.missionState);
    var requiredComplete = requiredObjectivesComplete(rows);

    if (phase && !requiredComplete) {
        for (var li = 0; li < phase.lossConditions.length; li++) {
            if (!conditionTriggered(phase.lossConditions[li], snapshot, state.missionState)) continue;
            state.missionFailureText = phase.lossConditions[li].message || state.missionFailureText || 'Misyon hedefi kacirildi.';
            state.winner = -1;
            state.state = 'gameOver';
            state.missionState.failed = true;
            state.missionState.failureText = state.missionFailureText;
            return {
                rows: rows,
                failed: true,
                failureText: state.missionFailureText,
            };
        }
    }

    if (!requiredComplete) {
        return {
            rows: rows,
            phase: phase,
        };
    }

    if (phase && state.missionScript) {
        var nextPhaseIndex = state.missionState.phaseIndex + 1;
        if (nextPhaseIndex < state.missionScript.phases.length) {
            if (phase.id && state.missionState.completedPhaseIds.indexOf(phase.id) < 0) state.missionState.completedPhaseIds.push(phase.id);
            state.missionState.phaseIndex = nextPhaseIndex;
            state.missionState.phaseStartedTick = snapshot.tick;
            state.missionState.failed = false;
            state.missionState.failureText = '';
            var nextPhase = getActiveMissionPhase(state.missionScript, state.missionState);
            state.objectives = normalizeObjectiveList(nextPhase && nextPhase.objectives);
            return {
                rows: evaluateCampaignObjectives({ objectives: state.objectives }, snapshot, { tickRate: tickRate }),
                phaseAdvanced: true,
                phase: nextPhase,
            };
        }
    }

    if (state.endOnObjectives === true) {
        state.winner = humanIndexOfState(state);
        state.state = 'gameOver';
        return {
            rows: rows,
            won: true,
            phase: phase,
        };
    }

    return {
        rows: rows,
        phase: phase,
    };
}
