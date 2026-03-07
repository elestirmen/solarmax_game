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
    WORMHOLE_SPEED_MULT: 2.0,
    GRAVITY_SPEED_MULT: 1.35,
    SUPPLY_DIST: 220,
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
    TURRET_CAPTURE_RESIST: 1.35,
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
        aiAggBase: 0.82, aiBuffer: 8, aiInterval: 40, flowInterval: 18,
        aiUsesFog: false, adaptiveAI: false,
        humanStartBoost: 1.2, aiStartBoost: 0.88,
        humanProdMult: 1.08, aiProdMult: 0.94,
        featureChance: 0.35, maxAttackTargets: 1,
    },
    normal: {
        aiAggBase: 1.0, aiBuffer: 5, aiInterval: 30, flowInterval: 15,
        aiUsesFog: false, adaptiveAI: true,
        humanStartBoost: 1.0, aiStartBoost: 1.0,
        humanProdMult: 1.0, aiProdMult: 1.0,
        featureChance: 0.62, maxAttackTargets: 2,
    },
    hard: {
        aiAggBase: 1.22, aiBuffer: 4, aiInterval: 22, flowInterval: 12,
        aiUsesFog: true, adaptiveAI: true,
        humanStartBoost: 0.92, aiStartBoost: 1.1,
        humanProdMult: 0.98, aiProdMult: 1.07,
        featureChance: 0.78, maxAttackTargets: 2,
    },
};

export function hashSeed(value) {
    value = String(value || '');
    var hash = 0;
    for (var i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
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
