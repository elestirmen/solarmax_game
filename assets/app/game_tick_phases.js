import { computeOnlineSimSpeed, consumePendingNetworkCommands, isOnlinePingDue } from '../net/network_tick.js';

export function runOnlineTickSyncPhase(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var game = opts.game;
    var net = opts.net;
    var runtimeOpts = opts.runtimeOpts || {};
    if (!net.online) return;

    if (!runtimeOpts.skipNetworkSync) {
        if (isOnlinePingDue(game.tick, net.lastPingTick, 45)) {
            net.lastPingTick = game.tick;
            net.socket.emit('pingTick', { clientTs: Date.now() });
        }

        if (net.syncDrift !== undefined) {
            net.syncDrift += (game.speed - 1.0);
            game.speed = computeOnlineSimSpeed(net.syncDrift);
        }
    }

    if (net.pendingCommands.length <= 0) return;

    var queueState = consumePendingNetworkCommands({
        pendingCommands: net.pendingCommands,
        currentTick: game.tick,
        matchId: net.matchId,
        lastAppliedSeq: net.lastAppliedSeq,
    });
    for (var i = 0; i < queueState.dueCommands.length; i++) {
        var cmd = queueState.dueCommands[i];
        opts.applyPlayerCommand(cmd.playerIndex, cmd.type, cmd.data);
    }
    net.lastAppliedSeq = queueState.lastAppliedSeq;
    net.pendingCommands = queueState.remainingCommands;
}

export function runEconomyTickPhase(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var game = opts.game;
    var constants = opts.constants || {};
    var callbacks = opts.callbacks || {};

    game.doctrineStates = callbacks.tickDoctrineStates(game.doctrines, game.doctrineStates);
    game.strategicPulse = callbacks.currentStrategicPulse(game.tick);
    callbacks.strategicPulseToast();

    var ownershipMetrics = callbacks.computeOwnershipMetrics({
        players: game.players,
        nodes: game.nodes,
        fleets: game.fleets,
        strategicPulse: game.strategicPulse,
        rules: game.rules,
        strategicPulseCapBonus: constants.strategicPulseCap,
        playerCapital: game.playerCapital,
        anchorPositions: callbacks.spawnAnchors(game.players.length),
        isNodeAssimilated: callbacks.isNodeAssimilated,
        distanceFn: callbacks.dist,
        maxLinkDist: constants.supplyDistance,
        nodePowerValue: callbacks.nodePowerValue,
    });
    var power = ownershipMetrics.powerByPlayer;
    var supplyByPlayer = ownershipMetrics.supplyByPlayer;
    var ownerUnits = ownershipMetrics.unitByPlayer;
    var ownerCaps = ownershipMetrics.capByPlayer;

    game.powerByPlayer = power;
    game.unitByPlayer = ownerUnits;
    game.capByPlayer = ownerCaps;

    if (ownerCaps[game.human] > 0) {
        var humanCapPressureTick = ownerUnits[game.human] / ownerCaps[game.human];
        if (humanCapPressureTick > game.stats.peakCapPressure) game.stats.peakCapPressure = humanCapPressureTick;
    }
    if ((power[game.human] || 0) > game.stats.peakPower) game.stats.peakPower = power[game.human] || 0;

    var livePulseNode = game.nodes[game.strategicPulse.nodeId];
    if (game.strategicPulse.active && livePulseNode && livePulseNode.owner === game.human && callbacks.isNodeAssimilated(livePulseNode)) {
        game.stats.pulseControlTicks++;
    }

    callbacks.stepEncounterState(game);
    callbacks.stepNodeEconomy({
        nodes: game.nodes,
        humanIndex: game.human,
        powerByPlayer: power,
        supplyByPlayer: supplyByPlayer,
        ownerUnits: ownerUnits,
        ownerCaps: ownerCaps,
        tune: game.tune,
        diffCfg: game.diffCfg,
        rules: game.rules,
        stats: game.stats,
        constants: {
            baseProd: constants.baseProd,
            nodeRadiusMax: constants.nodeRadiusMax,
            isolatedProdPenalty: constants.isolatedProdPenalty,
            capSoftStart: constants.capSoftStart,
            capSoftFloor: constants.capSoftFloor,
            ddaMaxBoost: constants.ddaMaxBoost,
            defenseProdPenalty: constants.defenseProdPenalty,
            strategicPulseProd: constants.strategicPulseProd,
            strategicPulseAssim: constants.strategicPulseAssim,
            defenseAssimBonus: constants.defenseAssimBonus,
            assimBaseRate: constants.assimBaseRate,
            assimUnitBonus: constants.assimUnitBonus,
            assimGarrisonFloor: constants.assimGarrisonFloor,
            assimLevelResist: constants.assimLevelResist,
        },
        callbacks: {
            clamp: callbacks.clamp,
            nodeTypeOf: callbacks.nodeTypeOf,
            nodeCapacity: callbacks.nodeCapacity,
            nodeLevelProdMult: callbacks.nodeLevelProdMult,
            strategicPulseAppliesToNode: callbacks.strategicPulseAppliesToNode,
            isNodeAssimilated: callbacks.isNodeAssimilated,
            ownerProdMultiplier: callbacks.ownerProdMultiplier,
            ownerAssimilationMultiplier: callbacks.ownerAssimilationMultiplier,
        },
    });

    return {
        power: power,
        supplyByPlayer: supplyByPlayer,
        ownerUnits: ownerUnits,
        ownerCaps: ownerCaps,
    };
}

export function runCombatTickPhase(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var game = opts.game;
    var constants = opts.constants || {};
    var callbacks = opts.callbacks || {};

    var turretReport = callbacks.applyTurretDamage({
        nodes: game.nodes,
        fleets: game.fleets,
        dt: constants.tickDt,
        range: constants.turretRange,
        dps: constants.turretDps,
        minGarrison: constants.turretMinGarrison,
    });
    if (turretReport && Array.isArray(turretReport.shots) && turretReport.shots.length > 0) {
        for (var tsi = 0; tsi < turretReport.shots.length; tsi++) {
            var shot = turretReport.shots[tsi];
            game.turretBeams.push({
                fromX: shot.fromX,
                fromY: shot.fromY,
                toX: shot.toX,
                toY: shot.toY,
                owner: shot.turretOwner,
                life: 0.12,
                maxLife: 0.12,
            });
        }
        if (game.turretBeams.length > 80) game.turretBeams = game.turretBeams.slice(-80);
    }
    callbacks.applyImpactFeedback(turretReport && turretReport.impacts);

    callbacks.stepFleetMovement({
        fleets: game.fleets,
        nodes: game.nodes,
        dt: constants.tickDt,
        tune: game.tune,
        mapFeature: game.mapFeature,
        mapMutator: game.mapMutator,
        callbacks: {
            clamp: callbacks.clamp,
            bezPt: callbacks.bezPt,
            isNodeTerritoryActive: callbacks.isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: callbacks.isTerritoryBonusBlockedAtPoint,
            fleetSpeedMultiplier: callbacks.fleetSpeedMultiplier,
        },
        constants: {
            baseFleetSpeed: constants.baseFleetSpeed,
            gravitySpeedMult: constants.gravitySpeedMult,
            territorySpeedMult: constants.territorySpeedMult,
            territoryRadiusBase: constants.territoryRadiusBase,
            territoryRadiusNodeRadiusMult: constants.territoryRadiusNodeRadiusMult,
            territoryRadiusLevelBonus: constants.territoryRadiusLevelBonus,
            trailLen: constants.trailLen,
        },
    });

    var fieldReport = callbacks.applyDefenseFieldDamage({
        nodes: game.nodes,
        fleets: game.fleets,
        dt: constants.tickDt,
        cfg: callbacks.defenseFieldCfg(),
    });
    if (fieldReport && Array.isArray(fieldReport.arcs) && fieldReport.arcs.length > 0) {
        for (var fai = 0; fai < fieldReport.arcs.length; fai++) {
            var arc = fieldReport.arcs[fai];
            game.fieldBeams.push({
                fromX: arc.fromX,
                fromY: arc.fromY,
                toX: arc.toX,
                toY: arc.toY,
                owner: arc.owner,
                life: 0.1,
                maxLife: 0.1,
            });
        }
        if (game.fieldBeams.length > 120) game.fieldBeams = game.fieldBeams.slice(-120);
    }
    callbacks.applyImpactFeedback(fieldReport && fieldReport.impacts);

    var arrivalReport = callbacks.resolveFleetArrivals({
        fleets: game.fleets,
        nodes: game.nodes,
        flows: game.flows,
        players: game.players,
        tune: game.tune,
        humanIndex: game.human,
        callbacks: {
            nodeTypeOf: callbacks.nodeTypeOf,
            nodeLevelDefMult: callbacks.nodeLevelDefMult,
            nodeCapacity: callbacks.nodeCapacity,
            attackMultiplier: callbacks.attackMultiplier,
            defenseMultiplier: callbacks.defenseMultiplier,
        },
        constants: {
            turretCaptureResist: constants.turretCaptureResist,
            defenseBonus: constants.defenseBonus,
            assimLockTicks: constants.assimLockTicks,
        },
    });
    game.flows = arrivalReport.flows;
    if (arrivalReport.statsDelta.nodesCaptured > 0) game.stats.nodesCaptured += arrivalReport.statsDelta.nodesCaptured;
    if (arrivalReport.statsDelta.gateCaptures > 0) game.stats.gateCaptures += arrivalReport.statsDelta.gateCaptures;

    for (var ari = 0; ari < arrivalReport.particleBursts.length; ari++) {
        var burst = arrivalReport.particleBursts[ari];
        callbacks.spawnParticles(burst.x, burst.y, burst.count, burst.color, burst.isCapture, burst);
    }
    for (var asi = 0; asi < (arrivalReport.shockwaves || []).length; asi++) {
        var wave = arrivalReport.shockwaves[asi];
        callbacks.enqueueShockwave(wave.x, wave.y, wave);
    }

    callbacks.stepHoldingFleetDecay({
        fleets: game.fleets,
        nodes: game.nodes,
        callbacks: {
            isNodeTerritoryActive: callbacks.isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: callbacks.isTerritoryBonusBlockedAtPoint,
        },
        constants: {
            holdDecayGraceTicks: constants.holdDecayGraceTicks,
            holdDecayIntervalTicks: constants.holdDecayIntervalTicks,
            territoryRadiusBase: constants.territoryRadiusBase,
            territoryRadiusNodeRadiusMult: constants.territoryRadiusNodeRadiusMult,
            territoryRadiusLevelBonus: constants.territoryRadiusLevelBonus,
        },
    });

    for (var ati = 0; ati < arrivalReport.toasts.length; ati++) callbacks.showGameToast(arrivalReport.toasts[ati]);
    for (var aui = 0; aui < arrivalReport.audio.length; aui++) callbacks.playArrivalAudio(arrivalReport.audio[aui]);

    var flowReport = callbacks.stepFlowLinks({
        flows: game.flows,
        nodes: game.nodes,
        flowInterval: game.tune.flowInt,
        constants: {
            flowFraction: constants.flowFraction,
            minReserve: 2,
        },
    });
    game.flows = flowReport.flows;
    for (var fdi = 0; fdi < flowReport.dispatches.length; fdi++) {
        var flowDispatch = flowReport.dispatches[fdi];
        callbacks.dispatch(flowDispatch.owner, [flowDispatch.srcId], flowDispatch.tgtId, flowDispatch.pct);
    }
}

export function runAiAndWrapTickPhase(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var game = opts.game;
    var net = opts.net;
    var runtimeOpts = opts.runtimeOpts || {};
    var callbacks = opts.callbacks || {};
    var constants = opts.constants || {};

    for (var p = 0; p < game.players.length; p++) {
        if (!game.players[p].isAI || !game.players[p].alive) continue;
        game.aiTicks[p]++;
        if (game.aiTicks[p] >= game.tune.aiInt) {
            game.aiTicks[p] = 0;
            var cmds = callbacks.aiDecide(p);
            for (var c = 0; c < cmds.length; c++) {
                var cmd = cmds[c];
                callbacks.applyPlayerCommand(p, cmd.type, cmd.data || {});
            }
        }
    }

    for (var fogPlayer = 0; fogPlayer < game.players.length; fogPlayer++) {
        callbacks.updateVis(game.fog, fogPlayer, game.nodes, game.tick);
    }
    if (net.online && !runtimeOpts.skipNetworkSync) callbacks.sendOnlineStateHash();
    callbacks.maybeShowCampaignObjectiveReminder();
    callbacks.refreshCampaignMissionPanels();
    callbacks.advanceTransientVisuals(constants.tickDt);
    callbacks.maybeResolveMissionObjectiveVictory();
    callbacks.checkEnd();
    game.tick++;
}
