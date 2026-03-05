function clampMinZero(value) {
    if (value < 0) return 0;
    return value;
}

function secondsFromTicks(ticks, tickRate) {
    tickRate = tickRate || 30;
    return Math.max(0, Math.round((ticks / tickRate) * 10) / 10);
}

export function formatObjectiveLabel(objective, tickRate) {
    objective = objective || {};
    tickRate = tickRate || 30;
    if (objective.label) return objective.label;

    var target = Number(objective.target) || 0;
    switch (objective.type) {
        case 'owned_nodes': return 'En az ' + target + ' node tut';
        case 'upgrades': return target + ' upgrade yap';
        case 'defense_activations': return 'Savunmayi ' + target + ' kez ac';
        case 'flow_links_created': return target + ' flow hatti kur';
        case 'wormhole_dispatches': return 'Wormhole uzerinden ' + target + ' sevkiyat yap';
        case 'gate_captures': return target + ' GATE ele gecir';
        case 'pulse_control_ticks': return 'Pulse kontrolunu ' + secondsFromTicks(target, tickRate) + 's tut';
        case 'units_produced': return target + ' birlik uret';
        case 'peak_cap_pressure_below': return 'Strain zirvesini %' + Math.round(target * 100) + ' altinda tut';
        case 'win_before_tick': return target + ' tickten once kazan';
        default: return 'Gorev';
    }
}

function metricValue(type, snapshot) {
    var stats = snapshot && snapshot.stats ? snapshot.stats : {};
    switch (type) {
        case 'owned_nodes': return Number(snapshot.ownedNodes) || 0;
        case 'upgrades': return Number(stats.upgrades) || 0;
        case 'defense_activations': return Number(stats.defenseActivations) || 0;
        case 'flow_links_created': return Number(stats.flowLinksCreated) || 0;
        case 'wormhole_dispatches': return Number(stats.wormholeDispatches) || 0;
        case 'gate_captures': return Number(stats.gateCaptures) || 0;
        case 'pulse_control_ticks': return Number(stats.pulseControlTicks) || 0;
        case 'units_produced': return Number(stats.unitsProduced) || 0;
        case 'peak_cap_pressure_below': return Number(stats.peakCapPressure) || 0;
        case 'win_before_tick': return Number(snapshot.tick) || 0;
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
        var target = Number(objective.target) || 0;
        var currentValue = metricValue(type, snapshot);
        var complete = false;
        var failed = false;
        var progressText = '';

        if (type === 'win_before_tick') {
            complete = didWin && currentValue <= target;
            failed = gameOver && !complete;
            if (complete) progressText = currentValue + '/' + target + ' tick';
            else if (gameOver) progressText = 'Kacti: ' + currentValue + '/' + target;
            else progressText = 'Kalan ' + Math.max(0, target - currentValue) + ' tick';
        } else if (type === 'peak_cap_pressure_below') {
            var currentPct = Math.round(clampMinZero(currentValue) * 100);
            var targetPct = Math.round(clampMinZero(target) * 100);
            complete = currentValue <= target;
            failed = currentValue > target;
            progressText = currentPct + '% / ' + targetPct + '%';
        } else if (type === 'pulse_control_ticks') {
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
    if (!objectives.length) return 'Gorev yok.';
    return objectives.map(function (objective) {
        var prefix = objective.optional ? 'Bonus' : 'Gorev';
        return prefix + ': ' + formatObjectiveLabel(objective, tickRate);
    }).join(' | ');
}
