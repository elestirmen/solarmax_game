import { computePlayerUnitCount, computeGlobalCap } from './cap.js';
import { isDispatchAllowed } from './barrier.js';
import { AI_ARCHETYPES, SIM_CONSTANTS, difficultyConfig, isNodeAssimilated, nodeLevelDefMult, nodeTypeOf, upgradeCost } from './shared_config.js';

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function dist(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function strategicPulseAppliesToNode(state, nodeId) {
    return !!(state.strategicPulse && state.strategicPulse.active && state.strategicPulse.nodeId === nodeId);
}

function strongestHumanPower(state, selfIndex, powerByPlayer) {
    var best = 1;
    for (var i = 0; i < state.players.length; i++) {
        var player = state.players[i];
        if (!player || player.isAI || i === selfIndex) continue;
        best = Math.max(best, Number(powerByPlayer[i]) || 0);
    }
    return best;
}

export function decideAiCommands(state, playerIndex) {
    state = state || {};
    var commands = [];
    var own = [];
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i] && state.nodes[i].owner === playerIndex) own.push(state.nodes[i]);
    if (!own.length) return commands;

    var profile = state.aiProfiles && state.aiProfiles[playerIndex] ? state.aiProfiles[playerIndex] : AI_ARCHETYPES[1];
    var diffCfg = state.diffCfg || difficultyConfig(state.diff);
    var useFog = !!diffCfg.aiUsesFog;
    var power = state.powerByPlayer || {};
    var myPower = Number(power[playerIndex]) || 1;
    var humanPower = strongestHumanPower(state, playerIndex, power);
    var delta = humanPower - myPower;
    var assist = state.tune && state.tune.aiAssist ? clamp(delta / 420, -0.12, SIM_CONSTANTS.DDA_MAX_BOOST) : 0;
    var aggr = (Number(state.tune && state.tune.aiAgg) || 1) * (Number(profile.aggr) || 1) * (1 + assist * 0.8);
    var reserve = Math.max(2, Math.floor((Number(state.tune && state.tune.aiBuf) || 0) * (Number(profile.reserve) || 1) * (1 - assist * 0.5)));
    var maxSources = profile.name === 'Rusher' ? 4 : 3;
    var barrierCfg = state.mapFeature && state.mapFeature.type === 'barrier' ? state.mapFeature : null;
    var ownsGate = false;

    if (barrierCfg && Array.isArray(barrierCfg.gateIds)) {
        for (var gi = 0; gi < barrierCfg.gateIds.length; gi++) {
            var gateNode = state.nodes[barrierCfg.gateIds[gi]];
            if (!gateNode || !gateNode.gate || gateNode.owner !== playerIndex || !isNodeAssimilated(gateNode)) continue;
            ownsGate = true;
            break;
        }
    }

    var myUnits = (state.unitByPlayer && Number(state.unitByPlayer[playerIndex])) || computePlayerUnitCount({ nodes: state.nodes, fleets: state.fleets, owner: playerIndex });
    var myCap = (state.capByPlayer && Number(state.capByPlayer[playerIndex])) || computeGlobalCap({
        nodes: state.nodes,
        owner: playerIndex,
        baseCap: state.rules ? state.rules.baseCap : 180,
        capPerNodeFactor: state.rules ? state.rules.capPerNodeFactor : 42,
    });
    var capPressure = myCap > 0 ? myUnits / myCap : 0;
    if (capPressure > 0.85) reserve = Math.max(1, Math.floor(reserve * 0.72));

    function canDispatchAI(srcNode, tgtNode) {
        return isDispatchAllowed({ src: srcNode, tgt: tgtNode, barrier: barrierCfg, owner: playerIndex, nodes: state.nodes });
    }

    var targets = [];
    for (var ni = 0; ni < state.nodes.length; ni++) {
        var node = state.nodes[ni];
        if (!node || node.owner === playerIndex) continue;
        if (useFog && !(state.fog && state.fog.vis && state.fog.vis[playerIndex] && state.fog.vis[playerIndex][node.id])) continue;
        var targetUnits = useFog
            ? (state.fog.vis[playerIndex][node.id] ? node.units : ((((state.fog.ls || [])[playerIndex] || [])[node.id] || {}).units || 0))
            : node.units;
        var targetDefense = nodeTypeOf(node).def * nodeLevelDefMult(node) * (node.owner >= 0 ? (Number(state.tune && state.tune.def) || 1) : 1);

        var bestDistance = Infinity;
        var reachable = false;
        for (var oi = 0; oi < own.length; oi++) {
            if (!canDispatchAI(own[oi], node)) continue;
            var distance = dist(own[oi].pos, node.pos);
            reachable = true;
            if (distance < bestDistance) bestDistance = distance;
        }
        if (!reachable) continue;

        var score = 0;
        score += Math.max(0, 520 - bestDistance) * 0.45;
        score += Math.max(0, 55 - targetUnits * targetDefense) * 2.1;
        score += (Number(node.radius) || 0) * 0.75;
        if (node.owner === -1) score += 34;
        if (node.kind === 'forge') score += 20;
        if (node.kind === 'relay') score += 12;
        if (node.kind === 'turret') score -= 18;
        if (node.gate && node.owner !== playerIndex) score += ownsGate ? 10 : 64;
        if (strategicPulseAppliesToNode(state, node.id)) score += SIM_CONSTANTS.STRATEGIC_PULSE_AI_BONUS;
        if ((Number(node.level) || 1) > 1) score += ((Number(node.level) || 1) - 1) * 11;
        if (capPressure > 0.9) score += Math.max(0, 44 - targetUnits * targetDefense) * 0.6;
        score *= aggr;
        targets.push({ id: node.id, score: score, units: targetUnits, effDef: targetDefense });
    }

    targets.sort(function (a, b) { return b.score - a.score; });
    var attackCount = myPower < humanPower ? 2 : 1;
    if (profile.name === 'Rusher') attackCount = Math.min(2, targets.length);
    if (capPressure > 0.9) attackCount += 1;
    attackCount = Math.min(attackCount, targets.length, diffCfg.maxAttackTargets);

    for (var ti = 0; ti < attackCount; ti++) {
        var target = targets[ti];
        var targetNode = state.nodes[target.id];
        var sources = [];
        var total = 0;
        var needed = target.units * target.effDef + 5 + (Number(targetNode.level) || 1) * 3;
        if (targetNode.kind === 'turret') needed += 18;
        if (targetNode.gate && targetNode.owner !== playerIndex && barrierCfg && !ownsGate) needed = Math.max(6, needed * 0.82);
        if (capPressure > 0.9) needed *= 0.93;

        var candidates = own.filter(function (node) {
            if ((Number(node.units) || 0) <= reserve + 1) return false;
            return canDispatchAI(node, targetNode);
        }).sort(function (a, b) { return dist(a.pos, targetNode.pos) - dist(b.pos, targetNode.pos); });

        for (var cj = 0; cj < candidates.length && sources.length < maxSources; cj++) {
            var available = (Number(candidates[cj].units) || 0) - reserve;
            if (available <= 0) continue;
            sources.push(candidates[cj].id);
            total += available;
            if (total >= needed) break;
        }
        if (!sources.length) continue;
        if (total < needed * 0.55 && targetNode.owner !== -1) continue;

        var pctMax = capPressure > 0.9 ? 0.9 : 0.75;
        var pct = clamp(needed / Math.max(total, 1), 0.3, pctMax);
        if (capPressure > 0.95) pct = Math.max(pct, 0.72);

        var flowGate = ((state.tick + targetNode.id * 3 + playerIndex * 7) % 13) === 0;
        var shouldFlow = targetNode.owner !== -1 && targetNode.units > 12 && profile.flow > 0.75 && flowGate &&
            !state.flows.some(function (flow) { return flow.owner === playerIndex && flow.tgtId === targetNode.id && flow.active; }) &&
            canDispatchAI(state.nodes[sources[0]], targetNode);
        if (shouldFlow) commands.push({ type: 'flow', data: { srcId: sources[0], tgtId: targetNode.id } });
        commands.push({ type: 'send', data: { sources: sources, tgtId: targetNode.id, pct: pct } });
    }

    var upgradeGate = ((state.tick + playerIndex * 11) % 19) === 0;
    if (upgradeGate && profile.upg > 0.4) {
        var upgradeNode = null;
        var upgradeScore = -1;
        for (var ui = 0; ui < own.length; ui++) {
            var ownNode = own[ui];
            if ((Number(ownNode.level) || 1) >= SIM_CONSTANTS.NODE_LEVEL_MAX) continue;
            var cost = upgradeCost(ownNode);
            if ((Number(ownNode.units) || 0) < cost + reserve + 6) continue;
            var scoreValue = (Number(ownNode.units) || 0) - cost + (ownNode.kind === 'forge' ? 12 : 0) + (ownNode.kind === 'relay' ? 8 : 0);
            if (scoreValue > upgradeScore) {
                upgradeScore = scoreValue;
                upgradeNode = ownNode;
            }
        }
        if (upgradeNode) commands.push({ type: 'upgrade', data: { nodeId: upgradeNode.id } });
    }

    var defenseCommands = 0;
    for (var di = 0; di < own.length && defenseCommands < 2; di++) {
        var defenseNode = own[di];
        var pulseHold = strategicPulseAppliesToNode(state, defenseNode.id);
        var shouldFortify = !defenseNode.defense && (
            (!isNodeAssimilated(defenseNode) && defenseNode.units < defenseNode.maxUnits * 0.72) ||
            (pulseHold && defenseNode.units < defenseNode.maxUnits * 0.78) ||
            (defenseNode.gate && defenseNode.units < defenseNode.maxUnits * 0.62)
        );
        if (shouldFortify) {
            commands.push({ type: 'toggleDefense', data: { nodeId: defenseNode.id } });
            defenseCommands++;
            continue;
        }
        var shouldReleaseDefense = defenseNode.defense &&
            isNodeAssimilated(defenseNode) &&
            !pulseHold &&
            !defenseNode.gate &&
            defenseNode.kind !== 'bulwark' &&
            defenseNode.units > defenseNode.maxUnits * 0.8;
        if (shouldReleaseDefense) {
            commands.push({ type: 'toggleDefense', data: { nodeId: defenseNode.id } });
            defenseCommands++;
        }
    }

    for (var fi = 0; fi < state.flows.length; fi++) {
        var flow = state.flows[fi];
        if (flow.owner !== playerIndex || !flow.active) continue;
        var flowTarget = state.nodes[flow.tgtId];
        if (!flowTarget || flowTarget.owner === playerIndex) commands.push({ type: 'rmFlow', data: { srcId: flow.srcId, tgtId: flow.tgtId } });
    }

    return commands;
}
