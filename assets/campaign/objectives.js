function clampMinZero(value) {
    if (value < 0) return 0;
    return value;
}

function secondsFromTicks(ticks, tickRate) {
    tickRate = tickRate || 30;
    return Math.max(0, Math.round((ticks / tickRate) * 10) / 10);
}

function objectiveTarget(objective) {
    objective = objective || {};
    var target = Number(objective.target);
    if (Number.isFinite(target) && target > 0) return target;
    if (objective.type === 'control_node_ids') {
        var nodeIds = Array.isArray(objective.nodeIds) ? objective.nodeIds : [];
        return Math.max(1, nodeIds.length || 1);
    }
    return 0;
}

function isNodeControlledByHuman(node, humanIndex) {
    if (!node || node.owner !== humanIndex) return false;
    if ((Number(node.assimilationLock) || 0) > 0) return false;
    return node.assimilationProgress === undefined || Number(node.assimilationProgress) >= 1;
}

function matchingEncounters(snapshot, objective) {
    var encounters = Array.isArray(snapshot && snapshot.encounters) ? snapshot.encounters : [];
    var encounterType = String(objective && objective.encounterType || '').toLowerCase();
    var encounterId = String(objective && objective.encounterId || '').trim();
    return encounters.filter(function (encounter) {
        if (!encounter) return false;
        if (encounterType && String(encounter.type || '').toLowerCase() !== encounterType) return false;
        if (encounterId && String(encounter.id || '') !== encounterId) return false;
        return true;
    });
}

function encounterLabelBase(objective) {
    if (objective && objective.labelBase) return objective.labelBase;
    var type = String(objective && objective.encounterType || '').toLowerCase();
    if (type === 'relay_core') return 'Relay Core';
    if (type === 'mega_turret') return 'Mega Turret';
    return 'Encounter';
}

function encounterLabelAccusative(objective) {
    var type = String(objective && objective.encounterType || '').toLowerCase();
    if (type === 'relay_core') return 'Relay Core\'u';
    if (type === 'mega_turret') return 'Mega Turret\'i';
    return encounterLabelBase(objective) + '\'i';
}

export function formatObjectiveLabel(objective, tickRate) {
    objective = objective || {};
    tickRate = tickRate || 30;
    if (objective.label) return objective.label;

    var target = objectiveTarget(objective);
    switch (objective.type) {
        case 'owned_nodes': return 'En az ' + target + ' gezegen tut';
        case 'control_node_ids': return 'Belirlenen ' + target + ' kritik gezegeni ele geçir';
        case 'upgrades': return target + ' upgrade yap';
        case 'defense_activations': return 'Savunmayı ' + target + ' kez aç';
        case 'flow_links_created': return target + ' flow hattı kur';
        case 'wormhole_dispatches': return 'Wormhole üzerinden ' + target + ' sevkiyat yap';
        case 'gate_captures': return target + ' GATE ele geçir';
        case 'pulse_control_ticks': return 'Pulse kontrolünü ' + secondsFromTicks(target, tickRate) + 's tut';
        case 'units_produced': return target + ' birlik üret';
        case 'peak_cap_pressure_below': return 'Strain zirvesini %' + Math.round(target * 100) + ' altında tut';
        case 'win_before_tick': return target + ' tickten önce kazan';
        case 'survive_until_tick': return target + ' tick hayatta kal';
        case 'encounter_captured': return encounterLabelAccusative(objective) + ' ele geçir ve asimilasyonu tamamla';
        case 'encounter_control_ticks': return encounterLabelBase(objective) + ' kontrolünü ' + secondsFromTicks(target, tickRate) + 's tut';
        default: return 'Görev';
    }
}

function metricValue(type, snapshot) {
    var stats = snapshot && snapshot.stats ? snapshot.stats : {};
    switch (type) {
        case 'owned_nodes': return Number(snapshot.ownedNodes) || 0;
        case 'control_node_ids': {
            var objective = snapshot && snapshot.objectiveContext ? snapshot.objectiveContext : {};
            var nodeIds = Array.isArray(objective.nodeIds) ? objective.nodeIds : [];
            var nodes = Array.isArray(snapshot && snapshot.nodes) ? snapshot.nodes : [];
            var humanIndex = Number(snapshot && snapshot.humanIndex);
            var controlled = 0;
            for (var i = 0; i < nodeIds.length; i++) {
                if (isNodeControlledByHuman(nodes[Number(nodeIds[i])], humanIndex)) controlled++;
            }
            return controlled;
        }
        case 'upgrades': return Number(stats.upgrades) || 0;
        case 'defense_activations': return Number(stats.defenseActivations) || 0;
        case 'flow_links_created': return Number(stats.flowLinksCreated) || 0;
        case 'wormhole_dispatches': return Number(stats.wormholeDispatches) || 0;
        case 'gate_captures': return Number(stats.gateCaptures) || 0;
        case 'pulse_control_ticks': return Number(stats.pulseControlTicks) || 0;
        case 'units_produced': return Number(stats.unitsProduced) || 0;
        case 'peak_cap_pressure_below': return Number(stats.peakCapPressure) || 0;
        case 'win_before_tick': return Number(snapshot.tick) || 0;
        case 'survive_until_tick': return Number(snapshot.tick) || 0;
        case 'encounter_captured': {
            var encounters = matchingEncounters(snapshot, snapshot && snapshot.objectiveContext);
            var humanIndex = Number(snapshot && snapshot.humanIndex);
            var total = 0;
            for (var i = 0; i < encounters.length; i++) {
                if (Number(encounters[i].owner) === humanIndex && encounters[i].assimilated === true) total++;
            }
            return total;
        }
        case 'encounter_control_ticks': {
            var matchedEncounters = matchingEncounters(snapshot, snapshot && snapshot.objectiveContext);
            var ownerIndex = Number(snapshot && snapshot.humanIndex);
            var tickTotal = 0;
            for (var ei = 0; ei < matchedEncounters.length; ei++) {
                var controlTicksByPlayer = matchedEncounters[ei].controlTicksByPlayer || {};
                tickTotal += Number(controlTicksByPlayer[ownerIndex]) || 0;
            }
            return tickTotal;
        }
        default: return 0;
    }
}

export function evaluateCampaignObjectives(level, snapshot, opts) {
    opts = opts || {};
    var tickRate = opts.tickRate || 30;
    var objectives = level && Array.isArray(level.objectives) ? level.objectives : [];
    var didWin = !!(snapshot && snapshot.didWin);
    var gameOver = !!(snapshot && snapshot.gameOver);

    return objectives.map(function (objective) {
        objective = objective || {};
        var type = objective.type || '';
        var target = objectiveTarget(objective);
        var objectiveSnapshot = Object.assign({}, snapshot || {}, { objectiveContext: objective });
        var currentValue = metricValue(type, objectiveSnapshot);
        var complete = false;
        var failed = false;
        var progressText = '';

        if (type === 'win_before_tick') {
            complete = didWin && currentValue <= target;
            failed = gameOver && !complete;
            if (complete) progressText = currentValue + '/' + target + ' tick';
            else if (gameOver) progressText = 'Kaçtı: ' + currentValue + '/' + target;
            else progressText = 'Kalan ' + Math.max(0, target - currentValue) + ' tick';
        } else if (type === 'survive_until_tick') {
            complete = currentValue >= target;
            failed = gameOver && !complete;
            if (complete) progressText = currentValue + '/' + target + ' tick';
            else progressText = currentValue + ' / ' + target;
        } else if (type === 'peak_cap_pressure_below') {
            var currentPct = Math.round(clampMinZero(currentValue) * 100);
            var targetPct = Math.round(clampMinZero(target) * 100);
            complete = currentValue <= target;
            failed = currentValue > target;
            progressText = currentPct + '% / ' + targetPct + '%';
        } else if (type === 'pulse_control_ticks' || type === 'encounter_control_ticks') {
            complete = currentValue >= target;
            progressText = secondsFromTicks(currentValue, tickRate) + 's / ' + secondsFromTicks(target, tickRate) + 's';
        } else {
            complete = currentValue >= target;
            progressText = currentValue + ' / ' + target;
        }

        return {
            id: objective.id || type,
            type: type,
            label: formatObjectiveLabel(objective, tickRate),
            optional: !!objective.optional,
            complete: complete,
            failed: failed,
            progressText: progressText,
            remindAt: Number(objective.remindAt) || 0,
            coach: objective.coach || '',
            currentValue: currentValue,
            targetValue: target,
        };
    });
}

export function describeCampaignObjectives(level, opts) {
    opts = opts || {};
    var tickRate = opts.tickRate || 30;
    var objectives = level && Array.isArray(level.objectives) ? level.objectives : [];
    if (!objectives.length) return 'Görev yok.';
    return objectives.map(function (objective) {
        var prefix = objective.optional ? 'Bonus' : 'Görev';
        return prefix + ': ' + formatObjectiveLabel(objective, tickRate);
    }).join(' | ');
}
