export var SIM_CONSTANTS = {
    TICK_DT: 1 / 30,
    TICK_RATE: 30,
    BASE_PROD: 0.12,
    MAX_UNITS: 200,
    FLEET_SPEED: 80,
    FLOW_FRAC: 0.08,
    DEF_FACTOR: 1.2,
    VISION_R: 180,
    SEL_BONUS: 1.2,
    AI_INTERVAL: 30,
    AI_BUF: 5,
    AI_AGG: 1.0,
    TRAIL_LEN: 12,
    NODE_LEVEL_MAX: 3,
    DDA_MAX_BOOST: 0.2,
    GRAVITY_SPEED_MULT: 1.35,
    SUPPLY_DIST: 220,
    TERRITORY_RADIUS_BASE: 88,
    TERRITORY_RADIUS_NODE_RADIUS_MULT: 1.7,
    TERRITORY_RADIUS_LEVEL_BONUS: 14,
    TERRITORY_SPEED_MULT: 1.18,
    HOLD_DECAY_GRACE_TICKS: 300,
    HOLD_DECAY_INTERVAL_TICKS: 36,
    ISOLATED_PROD_PENALTY: 0.6,
    DEFENSE_PROD_PENALTY: 0.75,
    DEFENSE_BONUS: 1.25,
    ASSIM_BASE_RATE: 0.0012,
    ASSIM_UNIT_BONUS: 0.00014,
    ASSIM_GARRISON_FLOOR: 0.35,
    ASSIM_LEVEL_RESIST: 0.35,
    ASSIM_LOCK_TICKS: 180,
    TURRET_RANGE: 220,
    TURRET_DPS: 16,
    TURRET_MIN_GARRISON: 8,
    TURRET_CAPTURE_RESIST: 1.7,
    DEFENSE_FIELD_DEFENSE_BONUS: 1.25,
    STRATEGIC_PULSE_CYCLE: 540,
    STRATEGIC_PULSE_ACTIVE: 300,
    STRATEGIC_PULSE_PROD: 1.35,
    STRATEGIC_PULSE_SPEED: 1.18,
    STRATEGIC_PULSE_ASSIM: 1.3,
    STRATEGIC_PULSE_CAP: 18,
    STRATEGIC_PULSE_AI_BONUS: 52,
    CAP_SOFT_START: 0.82,
    CAP_SOFT_FLOOR: 0.28,
    DEFENSE_ASSIM_BONUS: 1.18,
    SUPPLIED_UPGRADE_DISCOUNT: 0.94,
    SYNC_HASH_INTERVAL_TICKS: 90,
    BEZ_CURV: 0.15,
    BEZ_SEG: 20,
};

export var PLAYER_COLORS = ['#4a8eff', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

export var NODE_TYPE_DEFS = {
    core: { label: 'Core', prod: 1.0, def: 1.0, cap: 1.0, flow: 1.0, speed: 1.0, color: '#8db3ff' },
    forge: { label: 'Forge', prod: 1.35, def: 0.9, cap: 0.9, flow: 1.1, speed: 1.0, color: '#ffad66' },
    bulwark: { label: 'Bulwark', prod: 0.75, def: 1.45, cap: 1.25, flow: 0.9, speed: 0.95, color: '#b6c1d9' },
    relay: { label: 'Relay', prod: 0.95, def: 0.95, cap: 0.85, flow: 1.35, speed: 1.35, color: '#7de3ff' },
    nexus: { label: 'Nexus', prod: 1.1, def: 1.1, cap: 1.1, flow: 1.15, speed: 1.1, color: '#c9a0dc' },
    turret: { label: 'Turret', prod: 0.0, def: 2.25, cap: 0.8, flow: 0.8, speed: 1.0, color: '#8ff0ff' },
};

export var AI_ARCHETYPES = [
    { name: 'Rusher', aggr: 1.2, flow: 0.9, reserve: 0.85, upg: 0.45 },
    { name: 'Balancer', aggr: 1.0, flow: 1.0, reserve: 1.0, upg: 0.65 },
    { name: 'Turtle', aggr: 0.8, flow: 0.7, reserve: 1.25, upg: 0.85 },
];

export var DIFFICULTY_PRESETS = {
    easy: {
        aiAggBase: 0.85, aiBuffer: 7, aiInterval: 36, flowInterval: 17,
        aiUsesFog: false, adaptiveAI: false,
        humanStartBoost: 1.2, aiStartBoost: 0.9,
        humanProdMult: 1.08, aiProdMult: 0.96,
        featureChance: 0.35, maxAttackTargets: 1,
        aiReserveScale: 0.92, aiCommitMax: 0.75, aiCriticalCommitMax: 0.84, aiOpportunityRatio: 0.56,
        aiExtraSources: 0, aiTargetHumanBias: 6, aiTargetCapitalBias: 16, aiFlowPeriod: 12, aiUpgradePeriod: 17,
    },
    normal: {
        aiAggBase: 1.12, aiBuffer: 3, aiInterval: 22, flowInterval: 13,
        aiUsesFog: false, adaptiveAI: true,
        humanStartBoost: 1.0, aiStartBoost: 1.0,
        humanProdMult: 1.0, aiProdMult: 1.02,
        featureChance: 0.62, maxAttackTargets: 2,
        aiReserveScale: 0.82, aiCommitMax: 0.86, aiCriticalCommitMax: 0.94, aiOpportunityRatio: 0.46,
        aiExtraSources: 2, aiTargetHumanBias: 16, aiTargetCapitalBias: 36, aiFlowPeriod: 7, aiUpgradePeriod: 13,
    },
    hard: {
        aiAggBase: 1.45, aiBuffer: 2, aiInterval: 14, flowInterval: 10,
        aiUsesFog: true, adaptiveAI: true,
        humanStartBoost: 0.9, aiStartBoost: 1.15,
        humanProdMult: 0.96, aiProdMult: 1.1,
        featureChance: 0.78, maxAttackTargets: 3,
        aiReserveScale: 0.68, aiCommitMax: 0.95, aiCriticalCommitMax: 1.0, aiOpportunityRatio: 0.38,
        aiExtraSources: 3, aiTargetHumanBias: 32, aiTargetCapitalBias: 72, aiFlowPeriod: 5, aiUpgradePeriod: 9,
    },
};

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

export function hashSeed(value) {
    value = String(value || '');
    var hash = 0;
    for (var i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
}

export function hashMix(a, b, c, d) {
    var h = ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761)) >>> 0;
    return (h % 1000000) / 1000000;
}

export function buildFleetSpawnProfile(params) {
    params = params || {};

    var seed = Math.floor(Number(params.seed) || 1);
    var srcId = Math.floor(Number(params.srcId) || 0);
    var tgtId = Math.floor(Number(params.tgtId) || 0);
    var serial = Math.max(1, Math.floor(Number(params.serial) || 1));
    var routeQueue = Math.max(0, Math.floor(Number(params.routeQueue) || 0));
    var count = Math.max(1, Number(params.count) || 1);
    var routeSpeedMult = Math.max(0.6, Number(params.routeSpeedMult) || 1);

    var laneIndex = 0;
    if (routeQueue > 0) {
        laneIndex = (routeQueue % 2 === 1 ? 1 : -1) * Math.ceil(routeQueue / 2);
    }

    var laneWidth = Math.min(15, 2.8 + Math.sqrt(count) * 0.85);
    var offsetNoise = hashMix(seed, srcId, tgtId, serial);
    var speedNoise = hashMix(seed + 17, tgtId, serial, routeQueue + 1);
    var turnNoise = hashMix(seed + 31, srcId + serial, tgtId + routeQueue, count);
    var throttleNoise = hashMix(seed + 53, tgtId, count, serial);
    var offsetSpread = routeQueue > 0 ? 2.4 : 3.1;
    var offsetL = laneIndex * laneWidth + (offsetNoise - 0.5) * offsetSpread;
    var spdVar = clamp(1 + (speedNoise - 0.5) * 0.06, 0.97, 1.03);
    var trailScale = clamp(
        0.9 +
        Math.min(0.22, Math.sqrt(count) * 0.038) +
        Math.max(0, routeSpeedMult * spdVar - 1) * 0.55 +
        Math.min(0.12, Math.abs(offsetL) * 0.008),
        0.9,
        1.42
    );
    var turnRate = clamp(5.2 + turnNoise * 2.4 + Math.max(0, routeSpeedMult - 1) * 0.6, 4.8, 8.4);
    var throttleBias = clamp(0.94 + throttleNoise * 0.14 + Math.max(0, routeSpeedMult - 1) * 0.04, 0.94, 1.12);
    var lookAhead = clamp(0.016 + turnNoise * 0.016 + Math.min(0.006, Math.abs(offsetL) * 0.00035), 0.016, 0.034);

    return {
        offsetL: offsetL,
        spdVar: spdVar,
        trailScale: trailScale,
        turnRate: turnRate,
        throttleBias: throttleBias,
        lookAhead: lookAhead,
    };
}

export function getFleetUnitSpacingT(fleet) {
    fleet = fleet || {};

    var trailScale = Number(fleet.trailScale);
    var throttle = Number(fleet.throttle);
    if (!Number.isFinite(trailScale) || trailScale <= 0) trailScale = 1;
    if (!Number.isFinite(throttle) || throttle <= 0) throttle = 0.3;

    return 0.011 +
        Math.max(0, trailScale - 1) * 0.004 +
        Math.max(0, throttle - 0.8) * 0.002;
}

export function difficultyConfig(diff) {
    return DIFFICULTY_PRESETS[String(diff || '').toLowerCase()] || DIFFICULTY_PRESETS.normal;
}

export function defaultTune() {
    return {
        prod: 1,
        fspeed: SIM_CONSTANTS.FLEET_SPEED,
        def: SIM_CONSTANTS.DEF_FACTOR,
        flowInt: 15,
        aiAgg: SIM_CONSTANTS.AI_AGG,
        aiBuf: SIM_CONSTANTS.AI_BUF,
        aiInt: SIM_CONSTANTS.AI_INTERVAL,
        fogEnabled: false,
        aiAssist: true,
    };
}

export function nodeTypeOf(node) {
    return NODE_TYPE_DEFS[node && node.kind] || NODE_TYPE_DEFS.core;
}

export function nodeLevelProdMult(node) {
    return 1 + ((Number(node && node.level) || 1) - 1) * 0.15;
}

export function nodeLevelDefMult(node) {
    return 1 + ((Number(node && node.level) || 1) - 1) * 0.2;
}

export function nodeLevelCapMult(node) {
    return 1 + ((Number(node && node.level) || 1) - 1) * 0.12;
}

export function nodeCapacity(node) {
    var typeDef = nodeTypeOf(node);
    return Math.floor(SIM_CONSTANTS.MAX_UNITS * typeDef.cap * nodeLevelCapMult(node));
}

export function isNodeAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}

export function upgradeCost(node) {
    var radius = Number(node && node.radius) || 0;
    var level = Number(node && node.level) || 1;
    var cost = 18 + radius * 0.85 + (level - 1) * 14;
    if (node && node.kind === 'relay') cost *= 0.92;
    else if (node && node.kind === 'forge') cost *= 0.95;
    else if (node && node.kind === 'bulwark') cost *= 1.08;
    else if (node && node.kind === 'turret') cost *= 1.12;
    if (node && node.supplied === true) cost *= SIM_CONSTANTS.SUPPLIED_UPGRADE_DISCOUNT;
    return Math.max(10, Math.floor(cost));
}

export function pickAIProfile(aiIndex) {
    var index = Math.max(0, Math.floor(Number(aiIndex) || 0));
    return AI_ARCHETYPES[(index - 1 + AI_ARCHETYPES.length) % AI_ARCHETYPES.length];
}
