import { applyPlayerCommandWithOps } from './command_apply.js';
import { computeOwnershipMetrics } from './state_metrics.js';
import { stepNodeEconomy } from './node_economy.js';
import { applyTurretDamage } from './turret.js';
import { applyDefenseFieldDamage } from './defense_field.js';
import { activateDoctrine, buildDoctrineLoadout, doctrineModifiers, ensureDoctrineStates, tickDoctrineStates } from './doctrine.js';
import { buildEncounterState, stepEncounterState } from './encounters.js';
import { stepFleetMovement, resolveFleetArrivals } from './fleet_step.js';
import { stepHoldingFleetDecay } from './holding_decay.js';
import { stepFlowLinks } from './flow_step.js';
import { resolveMatchEndState } from './end_state.js';
import { getRulesetConfig } from './ruleset.js';
import { getStrategicPulseState } from './strategic_pulse.js';
import { applySolarFlareFleetWipe, getSolarFlareFrame } from './solar_flare.js';
import { computeSyncHash } from './state_hash.js';
import { decideAiCommands } from './ai.js';
import { initFog, updateVis } from './fog.js';
import { isTerritoryBonusBlockedAtPoint, resolveMapMutator } from './mutator.js';
import { evaluateCampaignObjectives } from '../campaign/objectives.js';
import { advanceMissionState, applyMissionScript } from './mission_script.js';
import {
    PLAYER_COLORS,
    SIM_CONSTANTS,
    defaultTune,
    difficultyConfig,
    hashSeed,
    isNodeAssimilated,
    nodeCapacity,
    nodeLevelDefMult,
    nodeLevelProdMult,
    nodeTypeOf,
    pickAIProfile,
} from './shared_config.js';
import { addFlowLink, dispatchUnits, removeFlowLink, toggleDefenseMode, upgradeStateNode } from './state_ops.js';

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function defaultStats() {
    return {
        nodesCaptured: 0,
        fleetsSent: 0,
        upgrades: 0,
        unitsProduced: 0,
        flowLinksCreated: 0,
        defenseActivations: 0,
        gateCaptures: 0,
        wormholeDispatches: 0,
        pulseControlTicks: 0,
        peakCapPressure: 0,
        peakPower: 0,
        doctrineActivations: 0,
    };
}

function applyTuneOverrides(target, rawOverrides) {
    var overrides = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : null;
    if (!overrides) return;
    if (typeof overrides.prod === 'number') target.prod = clamp(overrides.prod, 0.1, 5);
    if (typeof overrides.fspeed === 'number') target.fspeed = clamp(overrides.fspeed, 20, 300);
    if (typeof overrides.def === 'number') target.def = clamp(overrides.def, 0.5, 3);
    if (typeof overrides.flowInt === 'number') target.flowInt = Math.max(1, Math.floor(overrides.flowInt));
    if (typeof overrides.aiAgg === 'number') target.aiAgg = clamp(overrides.aiAgg, 0.1, 3);
    if (typeof overrides.aiBuf === 'number') target.aiBuf = Math.max(0, Math.floor(overrides.aiBuf));
    if (typeof overrides.aiInt === 'number') target.aiInt = Math.max(1, Math.floor(overrides.aiInt));
    if (typeof overrides.aiAssist === 'boolean') target.aiAssist = overrides.aiAssist;
    if (typeof overrides.fogEnabled === 'boolean') target.fogEnabled = overrides.fogEnabled;
}

function primaryHumanIndex(players) {
    for (var i = 0; i < players.length; i++) if (players[i] && !players[i].isAI) return i;
    return 0;
}

function humanPlayerCount(players) {
    var total = 0;
    for (var i = 0; i < players.length; i++) if (players[i] && !players[i].isAI) total++;
    return total;
}

function pushTransientBeams(target, items, opts) {
    if (!Array.isArray(target) || !Array.isArray(items) || !items.length) return;
    opts = opts || {};
    var life = Number(opts.life);
    var limit = Math.max(1, Math.floor(Number(opts.limit) || items.length));
    var ownerKey = opts.ownerKey || 'owner';
    if (!Number.isFinite(life) || life <= 0) life = 0.1;
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        target.push({
            fromX: Number(item.fromX) || 0,
            fromY: Number(item.fromY) || 0,
            toX: Number(item.toX) || 0,
            toY: Number(item.toY) || 0,
            owner: Number(item[ownerKey]),
            life: life,
            maxLife: life,
        });
    }
    if (target.length > limit) target.splice(0, target.length - limit);
}

function decayTransientBeams(target, dt) {
    if (!Array.isArray(target) || !target.length) return;
    var step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) step = 0.033;
    for (var i = target.length - 1; i >= 0; i--) {
        target[i].life = (Number(target[i].life) || 0) - step;
        if (target[i].life <= 0) target.splice(i, 1);
    }
}

function pushTransientShockwaves(target, items, opts) {
    if (!Array.isArray(target) || !Array.isArray(items) || !items.length) return;
    opts = opts || {};
    var limit = Math.max(1, Math.floor(Number(opts.limit) || items.length));
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        var life = Number(item.life !== undefined ? item.life : opts.life);
        if (!Number.isFinite(life) || life <= 0) life = 0.22;
        target.push({
            x: Number(item.x) || 0,
            y: Number(item.y) || 0,
            radius: Math.max(0, Number(item.radius !== undefined ? item.radius : opts.radius) || 8),
            grow: Math.max(1, Number(item.grow !== undefined ? item.grow : opts.grow) || 18),
            life: life,
            maxLife: life,
            col: item.color || (Array.isArray(opts.players) && opts.players[item.owner] ? opts.players[item.owner].color : '#ffffff'),
            alpha: Math.max(0, Number(item.alpha !== undefined ? item.alpha : opts.alpha) || 0.3),
            fillAlpha: Math.max(0, Number(item.fillAlpha !== undefined ? item.fillAlpha : opts.fillAlpha) || 0),
            lineWidth: Math.max(0.8, Number(item.lineWidth !== undefined ? item.lineWidth : opts.lineWidth) || 1.4),
        });
    }
    if (target.length > limit) target.splice(0, target.length - limit);
}

function decayFleetHitVisuals(fleets, dt) {
    if (!Array.isArray(fleets) || !fleets.length) return;
    var step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) step = 0.033;
    for (var i = 0; i < fleets.length; i++) {
        var fleet = fleets[i];
        if (!fleet) continue;
        fleet.hitFlash = Math.max(0, (Number(fleet.hitFlash) || 0) - step * 2.8);
        fleet.hitJitter = Math.max(0, (Number(fleet.hitJitter) || 0) - step * 3.6);
    }
}

function distance(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function countOwnedNodes(nodes, owner) {
    var total = 0;
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].owner === owner) total++;
    }
    return total;
}

function missionObjectiveRows(state) {
    if (!state || !Array.isArray(state.objectives) || !state.objectives.length) return [];
    return evaluateCampaignObjectives({
        objectives: state.objectives,
    }, {
        tick: state.tick,
        didWin: state.winner === state.humanIndex,
        gameOver: state.state === 'gameOver',
        ownedNodes: countOwnedNodes(state.nodes, state.humanIndex),
        stats: state.stats || {},
        encounters: state.encounters || [],
        humanIndex: state.humanIndex,
        nodes: state.nodes || [],
    }, {
        tickRate: 30,
    });
}

function maybeResolveObjectiveVictory(state) {
    if (!state || state.endOnObjectives !== true) return false;
    var rows = missionObjectiveRows(state);
    if (!rows.length) return false;
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].optional) continue;
        if (!rows[i].complete) return false;
    }
    state.winner = state.humanIndex;
    state.state = 'gameOver';
    return true;
}

function ensureNodeDefaults(node, index) {
    node.id = index;
    node.level = Math.max(1, Math.floor(Number(node.level) || 1));
    node.kind = node.kind || 'core';
    node.pos = node.pos || { x: 0, y: 0 };
    node.radius = Number(node.radius) || 20;
    node.maxUnits = nodeCapacity(node);
    node.units = clamp(Number(node.units) || 0, 0, node.maxUnits);
    node.prodAcc = Number(node.prodAcc) || 0;
    node.visionR = SIM_CONSTANTS.VISION_R + node.radius * 2;
    node.selected = false;
    node.assimilationLock = Math.max(0, Math.floor(Number(node.assimilationLock) || 0));
    if (node.assimilationProgress === undefined || node.assimilationProgress === null) node.assimilationProgress = 1;
    return node;
}

function buildSeedFromManifest(manifest, opts) {
    if (typeof opts.seed === 'number' && Number.isFinite(opts.seed)) return opts.seed;
    var rawSeed = manifest && manifest.seed !== undefined ? manifest.seed : '42';
    return isNaN(Number(rawSeed)) ? hashSeed(rawSeed) : Number(rawSeed);
}

export function buildAuthoritativeState(snapshot, opts) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    opts = opts || {};
    var manifest = opts.manifest || {};
    var difficulty = String(opts.difficulty || manifest.difficulty || 'normal');
    var rulesMode = String(opts.rulesMode || manifest.rulesMode || 'advanced');
    var players = Array.isArray(snapshot.players) ? cloneValue(snapshot.players) : [];
    if (!players.length && Array.isArray(opts.players)) {
        for (var pi = 0; pi < opts.players.length; pi++) {
            players.push({
                idx: opts.players[pi].index,
                alive: true,
                isAI: !!opts.players[pi].botControlled,
                color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
            });
        }
    }
    for (var i = 0; i < players.length; i++) {
        players[i].idx = i;
        players[i].alive = players[i].alive !== false;
        players[i].isAI = !!players[i].isAI;
        if (!players[i].color) players[i].color = PLAYER_COLORS[i % PLAYER_COLORS.length];
    }

    var diffCfg = difficultyConfig(difficulty);
    var tune = defaultTune();
    tune.aiAgg = diffCfg.aiAggBase;
    tune.aiBuf = diffCfg.aiBuffer;
    tune.aiInt = diffCfg.aiInterval;
    tune.flowInt = diffCfg.flowInterval;
    tune.aiAssist = diffCfg.adaptiveAI;
    tune.fogEnabled = !!manifest.fogEnabled;
    if (humanPlayerCount(players) > 1) tune.aiAssist = false;
    applyTuneOverrides(tune, opts.tuneOverrides || manifest.tuneOverrides);

    var seed = buildSeedFromManifest(manifest, opts);
    var nodes = Array.isArray(snapshot.nodes) ? cloneValue(snapshot.nodes) : [];
    for (var ni = 0; ni < nodes.length; ni++) ensureNodeDefaults(nodes[ni], ni);
    var state = {
        tick: Math.max(0, Math.floor(Number(snapshot.tick) || 0)),
        winner: Number(snapshot.winner),
        state: snapshot.state === 'gameOver' ? 'gameOver' : 'playing',
        seed: seed,
        diff: difficulty,
        diffCfg: cloneValue(diffCfg),
        rulesMode: rulesMode,
        rules: getRulesetConfig(rulesMode),
        tune: tune,
        humanIndex: primaryHumanIndex(players),
        players: players,
        nodes: nodes,
        fleets: Array.isArray(snapshot.fleets) ? cloneValue(snapshot.fleets) : [],
        flows: Array.isArray(snapshot.flows) ? cloneValue(snapshot.flows) : [],
        wormholes: Array.isArray(snapshot.wormholes) ? cloneValue(snapshot.wormholes) : [],
        mapFeature: cloneValue(snapshot.mapFeature || { type: 'none' }),
        mapMutator: resolveMapMutator({
            seed: seed,
            nodes: nodes,
            mapMutator: snapshot.mapMutator !== undefined ? snapshot.mapMutator : manifest.mapMutator,
        }),
        playlist: String(snapshot.playlist || manifest.playlist || 'standard'),
        doctrineId: String(snapshot.doctrineId || manifest.doctrineId || ''),
        doctrines: buildDoctrineLoadout(players, {
            doctrineId: snapshot.doctrineId || manifest.doctrineId || 'logistics',
            doctrines: Array.isArray(snapshot.doctrines) ? snapshot.doctrines : [],
        }),
        doctrineStates: [],
        encounters: [],
        encounterContext: {},
        objectives: Array.isArray(snapshot.objectives) ? cloneValue(snapshot.objectives) : cloneValue(Array.isArray(manifest.objectives) ? manifest.objectives : []),
        missionScript: cloneValue(snapshot.missionScript !== undefined ? snapshot.missionScript : (manifest.missionScript || null)),
        missionState: cloneValue(snapshot.missionState || null),
        missionFailureText: String(snapshot.missionFailureText || ''),
        endOnObjectives: snapshot.endOnObjectives === true || manifest.endOnObjectives === true,
        playerCapital: cloneValue(snapshot.playerCapital || {}),
        strategicNodes: Array.isArray(snapshot.strategicNodes) ? snapshot.strategicNodes.slice() : [],
        strategicPulse: cloneValue(snapshot.strategicPulse || {}),
        powerByPlayer: cloneValue(snapshot.powerByPlayer || {}),
        capByPlayer: cloneValue(snapshot.capByPlayer || {}),
        unitByPlayer: cloneValue(snapshot.unitByPlayer || {}),
        aiTicks: Array.isArray(snapshot.aiTicks) ? snapshot.aiTicks.slice() : [],
        aiProfiles: Array.isArray(snapshot.aiProfiles) ? cloneValue(snapshot.aiProfiles) : [],
        turretBeams: Array.isArray(snapshot.turretBeams) ? cloneValue(snapshot.turretBeams) : [],
        fieldBeams: Array.isArray(snapshot.fieldBeams) ? cloneValue(snapshot.fieldBeams) : [],
        shockwaves: Array.isArray(snapshot.shockwaves) ? cloneValue(snapshot.shockwaves) : [],
        flowId: Math.max(0, Math.floor(Number(snapshot.flowId) || 0)),
        fleetSerial: Math.max(0, Math.floor(Number(snapshot.fleetSerial) || 0)),
        fog: cloneValue(snapshot.fog || initFog(players.length, nodes.length)),
        stats: cloneValue(snapshot.stats || defaultStats()),
        lastAppliedSeq: typeof snapshot.lastAppliedSeq === 'number' ? snapshot.lastAppliedSeq : -1,
    };
    state.doctrineStates = ensureDoctrineStates(state.doctrines, Array.isArray(snapshot.doctrineStates) ? snapshot.doctrineStates : []);
    state.encounters = buildEncounterState(
        snapshot.encounters !== undefined ? snapshot.encounters : manifest.encounters,
        state.nodes,
        seed
    );
    applyMissionScript(state, state.missionScript);
    stepEncounterState(state);

    if (!state.strategicPulse || typeof state.strategicPulse !== 'object' || state.strategicPulse.nodeId === undefined) {
        state.strategicPulse = getStrategicPulseState({
            strategicNodeIds: state.strategicNodes,
            tick: state.tick,
            seed: state.seed,
            cycleTicks: SIM_CONSTANTS.STRATEGIC_PULSE_CYCLE,
            activeTicks: SIM_CONSTANTS.STRATEGIC_PULSE_ACTIVE,
        });
    }

    for (var ai = 0; ai < players.length; ai++) {
        if (state.aiTicks[ai] === undefined) state.aiTicks[ai] = 0;
        if (players[ai] && players[ai].isAI && !state.aiProfiles[ai]) state.aiProfiles[ai] = pickAIProfile(ai);
    }
    for (var p = 0; p < players.length; p++) updateVis(state.fog, p, state.nodes, state.tick);
    return state;
}

export function captureAuthoritativeSnapshot(state) {
    return {
        tick: state.tick,
        winner: state.winner,
        state: state.state === 'gameOver' ? 'gameOver' : 'playing',
        nodes: cloneValue(state.nodes),
        fleets: cloneValue(state.fleets.filter(function (fleet) { return fleet && fleet.active; })),
        flows: cloneValue(state.flows),
        players: state.players.map(function (player) {
            return {
                idx: player.idx,
                alive: player.alive !== false,
                isAI: !!player.isAI,
                color: player.color,
            };
        }),
        fog: cloneValue(state.fog),
        stats: cloneValue(state.stats),
        wormholes: cloneValue(state.wormholes),
        mapFeature: cloneValue(state.mapFeature),
        mapMutator: cloneValue(state.mapMutator),
        playlist: state.playlist,
        doctrineId: state.doctrineId || '',
        doctrines: cloneValue(state.doctrines),
        doctrineStates: cloneValue(state.doctrineStates),
        encounters: cloneValue(state.encounters),
        objectives: cloneValue(state.objectives || []),
        missionScript: cloneValue(state.missionScript || null),
        missionState: cloneValue(state.missionState || null),
        missionFailureText: state.missionFailureText || '',
        endOnObjectives: state.endOnObjectives === true,
        playerCapital: cloneValue(state.playerCapital),
        strategicNodes: Array.isArray(state.strategicNodes) ? state.strategicNodes.slice() : [],
        strategicPulse: cloneValue(state.strategicPulse),
        powerByPlayer: cloneValue(state.powerByPlayer),
        capByPlayer: cloneValue(state.capByPlayer),
        unitByPlayer: cloneValue(state.unitByPlayer),
        aiTicks: Array.isArray(state.aiTicks) ? state.aiTicks.slice() : [],
        aiProfiles: cloneValue(state.aiProfiles),
        turretBeams: cloneValue(Array.isArray(state.turretBeams) ? state.turretBeams : []),
        fieldBeams: cloneValue(Array.isArray(state.fieldBeams) ? state.fieldBeams : []),
        shockwaves: cloneValue(Array.isArray(state.shockwaves) ? state.shockwaves : []),
        flowId: state.flowId,
        fleetSerial: state.fleetSerial,
        rngState: state.seed,
        lastAppliedSeq: state.lastAppliedSeq,
    };
}

export function computeAuthoritativeSnapshotHash(state) {
    return computeSyncHash({
        tick: state.tick,
        state: state.state,
        winner: state.winner,
        nodes: state.nodes,
        fleets: state.fleets,
        players: state.players,
        mapFeature: state.mapFeature,
        mapMutator: state.mapMutator,
        doctrines: state.doctrines,
        doctrineStates: state.doctrineStates,
        encounters: state.encounters,
        objectives: state.objectives,
        missionScript: state.missionScript,
        missionState: state.missionState,
        missionFailureText: state.missionFailureText,
        endOnObjectives: state.endOnObjectives === true,
    });
}

export function applyCommandToAuthoritativeState(state, playerIndex, type, data) {
    return applyPlayerCommandWithOps(playerIndex, type, data, {
        send: function (owner, sendData) {
            return dispatchUnits(state, owner, sendData);
        },
        flow: function (owner, srcId, tgtId) {
            return addFlowLink(state, owner, srcId, tgtId);
        },
        rmFlow: function (owner, srcId, tgtId) {
            return removeFlowLink(state, owner, srcId, tgtId);
        },
        upgrade: function (owner, nodeId) {
            return upgradeStateNode(state, owner, nodeId);
        },
        toggleDefense: function (owner, nodeId) {
            return toggleDefenseMode(state, owner, nodeId);
        },
        activateDoctrine: function (owner) {
            var activation = activateDoctrine(state.doctrines, state.doctrineStates, owner);
            state.doctrineStates = activation.states;
            if (activation.activated && owner === state.humanIndex) {
                state.stats.doctrineActivations = (Number(state.stats.doctrineActivations) || 0) + 1;
            }
            return activation.activated;
        },
    });
}

export function simulateAuthoritativeTick(state) {
    if (!state || state.state !== 'playing') return state;
    state.doctrineStates = tickDoctrineStates(state.doctrines, state.doctrineStates);

    state.strategicPulse = getStrategicPulseState({
        strategicNodeIds: state.strategicNodes,
        tick: state.tick,
        seed: state.seed,
        cycleTicks: SIM_CONSTANTS.STRATEGIC_PULSE_CYCLE,
        activeTicks: SIM_CONSTANTS.STRATEGIC_PULSE_ACTIVE,
    });

    var metrics = computeOwnershipMetrics({
        players: state.players,
        nodes: state.nodes,
        fleets: state.fleets,
        strategicPulse: state.strategicPulse,
        rules: state.rules,
        strategicPulseCapBonus: SIM_CONSTANTS.STRATEGIC_PULSE_CAP,
        playerCapital: state.playerCapital,
        anchorPositions: [],
        isNodeAssimilated: isNodeAssimilated,
        distanceFn: distance,
        maxLinkDist: SIM_CONSTANTS.SUPPLY_DIST,
        nodePowerValue: function (node) {
            return (Number(node.units) || 0) + (Number(node.maxUnits) || 0) * 0.06 + (Number(node.level) || 1) * 6;
        },
    });
    state.powerByPlayer = metrics.powerByPlayer;
    state.unitByPlayer = metrics.unitByPlayer;
    state.capByPlayer = metrics.capByPlayer;

    if (state.capByPlayer[state.humanIndex] > 0) {
        var capPressure = state.unitByPlayer[state.humanIndex] / state.capByPlayer[state.humanIndex];
        if (capPressure > (Number(state.stats.peakCapPressure) || 0)) state.stats.peakCapPressure = capPressure;
    }
    if ((state.powerByPlayer[state.humanIndex] || 0) > (Number(state.stats.peakPower) || 0)) {
        state.stats.peakPower = state.powerByPlayer[state.humanIndex] || 0;
    }
    var pulseNode = state.nodes[state.strategicPulse.nodeId];
    if (state.strategicPulse.active && pulseNode && pulseNode.owner === state.humanIndex && isNodeAssimilated(pulseNode)) {
        state.stats.pulseControlTicks = (Number(state.stats.pulseControlTicks) || 0) + 1;
    }
    stepEncounterState(state);

    stepNodeEconomy({
        nodes: state.nodes,
        humanIndex: state.humanIndex,
        powerByPlayer: state.powerByPlayer,
        supplyByPlayer: metrics.supplyByPlayer,
        ownerUnits: state.unitByPlayer,
        ownerCaps: state.capByPlayer,
        tune: state.tune,
        diffCfg: state.diffCfg,
        rules: state.rules,
        stats: state.stats,
        constants: {
            baseProd: SIM_CONSTANTS.BASE_PROD,
            nodeRadiusMax: 36,
            isolatedProdPenalty: SIM_CONSTANTS.ISOLATED_PROD_PENALTY,
            capSoftStart: SIM_CONSTANTS.CAP_SOFT_START,
            capSoftFloor: SIM_CONSTANTS.CAP_SOFT_FLOOR,
            ddaMaxBoost: SIM_CONSTANTS.DDA_MAX_BOOST,
            defenseProdPenalty: SIM_CONSTANTS.DEFENSE_PROD_PENALTY,
            strategicPulseProd: SIM_CONSTANTS.STRATEGIC_PULSE_PROD,
            strategicPulseAssim: SIM_CONSTANTS.STRATEGIC_PULSE_ASSIM,
            defenseAssimBonus: SIM_CONSTANTS.DEFENSE_ASSIM_BONUS,
            assimBaseRate: SIM_CONSTANTS.ASSIM_BASE_RATE,
            assimUnitBonus: SIM_CONSTANTS.ASSIM_UNIT_BONUS,
            assimGarrisonFloor: SIM_CONSTANTS.ASSIM_GARRISON_FLOOR,
            assimLevelResist: SIM_CONSTANTS.ASSIM_LEVEL_RESIST,
        },
        callbacks: {
            clamp: clamp,
            nodeTypeOf: nodeTypeOf,
            nodeCapacity: nodeCapacity,
            nodeLevelProdMult: nodeLevelProdMult,
            strategicPulseAppliesToNode: function (nodeId) {
                return !!(state.strategicPulse && state.strategicPulse.active && state.strategicPulse.nodeId === nodeId);
            },
            isNodeAssimilated: isNodeAssimilated,
            ownerProdMultiplier: function (owner, node) {
                var modifiers = doctrineModifiers(state.doctrines, state.doctrineStates, owner);
                var prodMult = modifiers.prodMult;
                if (node && node.supplied === true) prodMult *= modifiers.suppliedProdMult;
                var relayCoreCount = Number(state.encounterContext && state.encounterContext.relayCoreCountByPlayer && state.encounterContext.relayCoreCountByPlayer[owner]) || 0;
                if (relayCoreCount > 0) prodMult *= 1 + relayCoreCount * 0.08;
                return prodMult;
            },
            ownerAssimilationMultiplier: function (owner) {
                return doctrineModifiers(state.doctrines, state.doctrineStates, owner).assimMult;
            },
        },
    });

    var solarCfg = {
        gapMinTicks: SIM_CONSTANTS.SOLAR_FLARE_GAP_MIN_TICKS,
        gapMaxTicks: SIM_CONSTANTS.SOLAR_FLARE_GAP_MAX_TICKS,
        warnTicks: SIM_CONSTANTS.SOLAR_FLARE_WARN_TICKS,
    };
    if (getSolarFlareFrame(state.tick, state.seed, solarCfg).phase === 'blast') {
        applySolarFlareFleetWipe(state.fleets);
    }

    var turretReport = applyTurretDamage({
        nodes: state.nodes,
        fleets: state.fleets,
        dt: SIM_CONSTANTS.TICK_DT,
        range: SIM_CONSTANTS.TURRET_RANGE,
        dps: SIM_CONSTANTS.TURRET_DPS,
        minGarrison: SIM_CONSTANTS.TURRET_MIN_GARRISON,
    });
    pushTransientBeams(state.turretBeams, turretReport && turretReport.shots, {
        life: 0.12,
        limit: 80,
        ownerKey: 'turretOwner',
    });
    pushTransientShockwaves(state.shockwaves, turretReport && turretReport.impacts, {
        limit: 80,
        players: state.players,
        radius: 4,
        grow: 9,
        life: 0.14,
        alpha: 0.28,
        fillAlpha: 0.02,
        lineWidth: 1,
    });

    stepFleetMovement({
        fleets: state.fleets,
        nodes: state.nodes,
        dt: SIM_CONSTANTS.TICK_DT,
        tune: state.tune,
        mapFeature: state.mapFeature,
        mapMutator: state.mapMutator,
        callbacks: {
            clamp: clamp,
            bezPt: function (p0, cp, p2, t) {
                var u = 1 - t;
                return {
                    x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
                    y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
                };
            },
            isNodeTerritoryActive: isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: function (opts) {
                return isTerritoryBonusBlockedAtPoint({
                    point: opts && opts.point,
                    mapMutator: state.mapMutator,
                });
            },
            fleetSpeedMultiplier: function (fleet) {
                return doctrineModifiers(state.doctrines, state.doctrineStates, fleet && fleet.owner).fleetSpeedMult;
            },
        },
        constants: {
            baseFleetSpeed: SIM_CONSTANTS.FLEET_SPEED,
            gravitySpeedMult: SIM_CONSTANTS.GRAVITY_SPEED_MULT,
            territorySpeedMult: SIM_CONSTANTS.TERRITORY_SPEED_MULT,
            trailLen: SIM_CONSTANTS.TRAIL_LEN,
        },
    });

    var fieldReport = applyDefenseFieldDamage({
        nodes: state.nodes,
        fleets: state.fleets,
        dt: SIM_CONSTANTS.TICK_DT,
        cfg: {
            baseRangePad: 24,
            baseDps: 2.6,
            levelRangeBonus: 4,
            levelDpsBonus: 0.3,
            defenseDpsBonus: SIM_CONSTANTS.DEFENSE_FIELD_DEFENSE_BONUS,
            bulwarkDpsBonus: 1.18,
            relayRangeBonus: 6,
        },
    });
    pushTransientBeams(state.fieldBeams, fieldReport && fieldReport.arcs, {
        life: 0.1,
        limit: 120,
        ownerKey: 'owner',
    });
    pushTransientShockwaves(state.shockwaves, fieldReport && fieldReport.impacts, {
        limit: 80,
        players: state.players,
        radius: 4,
        grow: 9,
        life: 0.14,
        alpha: 0.2,
        fillAlpha: 0.02,
        lineWidth: 1,
    });

    var arrivalReport = resolveFleetArrivals({
        fleets: state.fleets,
        nodes: state.nodes,
        flows: state.flows,
        players: state.players,
        tune: state.tune,
        humanIndex: state.humanIndex,
        callbacks: {
            nodeTypeOf: nodeTypeOf,
            nodeLevelDefMult: nodeLevelDefMult,
            nodeCapacity: nodeCapacity,
            attackMultiplier: function (owner, targetNode) {
                var modifiers = doctrineModifiers(state.doctrines, state.doctrineStates, owner);
                var mult = modifiers.attackMult;
                if (targetNode && targetNode.kind === 'turret') mult *= modifiers.turretAttackMult;
                return mult;
            },
            defenseMultiplier: function () {
                return 1;
            },
        },
        constants: {
            turretCaptureResist: SIM_CONSTANTS.TURRET_CAPTURE_RESIST,
            defenseBonus: SIM_CONSTANTS.DEFENSE_BONUS,
            assimLockTicks: SIM_CONSTANTS.ASSIM_LOCK_TICKS,
        },
    });
    state.flows = arrivalReport.flows;
    state.stats.nodesCaptured = (Number(state.stats.nodesCaptured) || 0) + (Number(arrivalReport.statsDelta.nodesCaptured) || 0);
    state.stats.gateCaptures = (Number(state.stats.gateCaptures) || 0) + (Number(arrivalReport.statsDelta.gateCaptures) || 0);
    pushTransientShockwaves(state.shockwaves, arrivalReport && arrivalReport.shockwaves, {
        limit: 80,
        players: state.players,
    });
    stepHoldingFleetDecay({
        fleets: state.fleets,
        nodes: state.nodes,
        callbacks: {
            isNodeTerritoryActive: isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: function (opts) {
                return isTerritoryBonusBlockedAtPoint({
                    point: opts && opts.point,
                    mapMutator: state.mapMutator,
                });
            },
        },
        constants: {
            holdDecayGraceTicks: SIM_CONSTANTS.HOLD_DECAY_GRACE_TICKS,
            holdDecayIntervalTicks: SIM_CONSTANTS.HOLD_DECAY_INTERVAL_TICKS,
            territoryRadiusBase: SIM_CONSTANTS.TERRITORY_RADIUS_BASE,
            territoryRadiusNodeRadiusMult: SIM_CONSTANTS.TERRITORY_RADIUS_NODE_RADIUS_MULT,
            territoryRadiusLevelBonus: SIM_CONSTANTS.TERRITORY_RADIUS_LEVEL_BONUS,
        },
    });

    var flowReport = stepFlowLinks({
        flows: state.flows,
        nodes: state.nodes,
        flowInterval: state.tune.flowInt,
        constants: {
            flowFraction: SIM_CONSTANTS.FLOW_FRAC,
            minReserve: 2,
            defenseFlowMult: SIM_CONSTANTS.DEFENSE_FLOW_MULT,
        },
    });
    state.flows = flowReport.flows;
    for (var fd = 0; fd < flowReport.dispatches.length; fd++) {
        var flowDispatch = flowReport.dispatches[fd];
        dispatchUnits(state, flowDispatch.owner, [flowDispatch.srcId], flowDispatch.tgtId, flowDispatch.pct);
    }

    for (var pi = 0; pi < state.players.length; pi++) {
        if (!state.players[pi] || !state.players[pi].isAI || !state.players[pi].alive) continue;
        state.aiTicks[pi] = (Number(state.aiTicks[pi]) || 0) + 1;
        if (state.aiTicks[pi] < state.tune.aiInt) continue;
        state.aiTicks[pi] = 0;
        var aiCommands = decideAiCommands(state, pi);
        for (var ci = 0; ci < aiCommands.length; ci++) {
            applyCommandToAuthoritativeState(state, pi, aiCommands[ci].type, aiCommands[ci].data);
        }
    }

    for (var vp = 0; vp < state.players.length; vp++) updateVis(state.fog, vp, state.nodes, state.tick);

    advanceMissionState(state, { tickRate: 30 });
    var resolved = resolveMatchEndState({
        nodes: state.nodes,
        fleets: state.fleets,
        players: state.players,
    });
    for (var ri = 0; ri < state.players.length; ri++) state.players[ri].alive = resolved.playersAlive[ri] !== false;
    if (state.state === 'playing' && resolved.gameOver) {
        state.winner = resolved.winnerIndex;
        state.state = 'gameOver';
    }

    decayTransientBeams(state.turretBeams, SIM_CONSTANTS.TICK_DT);
    decayTransientBeams(state.fieldBeams, SIM_CONSTANTS.TICK_DT);
    decayTransientBeams(state.shockwaves, SIM_CONSTANTS.TICK_DT);
    decayFleetHitVisuals(state.fleets, SIM_CONSTANTS.TICK_DT);
    state.tick += 1;
    return state;
}
