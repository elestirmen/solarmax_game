/* ============================================================
   Stellar Conquest â€“ Complete Game (Plain JavaScript)
   No build tools needed. Open stellar_conquest.html directly.
   v2: Orbital warriors, fleet trails, enhanced visuals
   ============================================================ */

// â”€â”€ CONSTANTS â”€â”€
var TICK_DT = 1 / 30, BASE_PROD = 0.12, MAX_UNITS = 200,
    NODE_RMIN = 18, NODE_RMAX = 36, NODE_MINDIST = 100, NEUTRAL_MAX = 20,
    FLEET_SPEED = 80, POOL_SZ = 2000, FLOW_FRAC = 0.08,
    DEF_FACTOR = 1.2, VISION_R = 180, SEL_BONUS = 1.2,
    AI_INTERVAL = 30, AI_BUF = 5, AI_AGG = 1.0,
    ZOOM_MIN = 0.3, ZOOM_MAX = 3.0, ZOOM_SPD = 0.1,
    MAP_W = 1600, MAP_H = 1000, MAP_PAD = 80,
    BEZ_CURV = 0.15, BEZ_SEG = 20, PULSE_SPD = 0.6,
    COLORS_BG = '#080c15', COL_NEUTRAL = '#5a6272', COL_FOG = '#2e3340',
    COL_GRID = 'rgba(255,255,255,0.025)', COL_GLOW = 'rgba(255,255,255,0.35)',
    PLAYER_COLORS = ['#4a8eff', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'],
    TRAIL_LEN = 8, MAX_ORBITERS = 40, ORBIT_SPD = 0.02,
    NODE_LEVEL_MAX = 3,
    DDA_MAX_BOOST = 0.2,
    WORMHOLE_SPEED_MULT = 1.75,
    GRAVITY_RADIUS = 170,
    GRAVITY_SPEED_MULT = 1.35;

var NODE_TYPE_DEFS = {
    core: { label: 'Core', prod: 1.0, def: 1.0, cap: 1.0, flow: 1.0, speed: 1.0, color: '#8db3ff' },
    forge: { label: 'Forge', prod: 1.35, def: 0.9, cap: 0.9, flow: 1.1, speed: 1.0, color: '#ffad66' },
    bulwark: { label: 'Bulwark', prod: 0.75, def: 1.45, cap: 1.25, flow: 0.9, speed: 0.95, color: '#b6c1d9' },
    relay: { label: 'Relay', prod: 0.95, def: 0.95, cap: 0.85, flow: 1.35, speed: 1.35, color: '#7de3ff' },
};

var AI_ARCHETYPES = [
    { name: 'Rusher', aggr: 1.2, flow: 0.9, reserve: 0.85, upg: 0.45 },
    { name: 'Balancer', aggr: 1.0, flow: 1.0, reserve: 1.0, upg: 0.65 },
    { name: 'Turtle', aggr: 0.8, flow: 0.7, reserve: 1.25, upg: 0.85 },
];

var DIFFICULTY_PRESETS = {
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

// â”€â”€ STARS (background) â”€â”€
var stars = []; for (var i = 0; i < 300; i++)stars.push({ x: Math.random() * MAP_W * 1.5 - MAP_W * 0.25, y: Math.random() * MAP_H * 1.5 - MAP_H * 0.25, r: Math.random() * 1.5 + 0.3, b: Math.random() * 0.5 + 0.3 });

// â”€â”€ SEEDED RNG â”€â”€
function RNG(s) { this.s = s | 0; if (!this.s) this.s = 1; }
RNG.prototype.next = function () { var t = this.s += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
RNG.prototype.nextInt = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
RNG.prototype.nextFloat = function (a, b) { return a + this.next() * (b - a); };
function hashSeed(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h) || 1; }

// â”€â”€ VECTOR â”€â”€
function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function hashMix(a, b, c, d) {
    var h = ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761)) >>> 0;
    return (h % 1000000) / 1000000;
}

// â”€â”€ BEZIER â”€â”€
function bezCP(s, t, c) {
    c = c || BEZ_CURV; var dx = t.x - s.x, dy = t.y - s.y, mx = s.x + dx * 0.5, my = s.y + dy * 0.5,
        len = Math.sqrt(dx * dx + dy * dy), nx, ny; if (len < 0.01) { nx = 0; ny = 0; } else { nx = -dy / len; ny = dx / len; }
    return { x: mx + nx * len * c, y: my + ny * len * c };
}
function bezPt(p0, cp, p2, t) { var u = 1 - t; return { x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y }; }
function bezLen(p0, cp, p2) {
    var l = 0, px = p0.x, py = p0.y; for (var i = 1; i <= BEZ_SEG; i++) {
        var t = i / BEZ_SEG,
            pt = bezPt(p0, cp, p2, t), dx = pt.x - px, dy = pt.y - py; l += Math.sqrt(dx * dx + dy * dy); px = pt.x; py = pt.y;
    } return l || 1;
}

// â”€â”€ FLEET POOL (with trail + lateral offset for swarm) â”€â”€
function mkFleet() {
    return {
        active: false, owner: -1, count: 0, srcId: -1, tgtId: -1, t: 0, speed: 0, arcLen: 1, cpx: 0, cpy: 0, x: 0, y: 0,
        trail: [], offsetL: 0, spdVar: 1, routeSpeedMult: 1
    };
}  // trail: array of {x,y}, offsetL: perpendicular spread, spdVar: speed variation
var pool = [];
for (var i = 0; i < POOL_SZ; i++)pool.push(mkFleet());
function acquireFleet() { for (var i = 0; i < pool.length; i++) { if (!pool[i].active) return pool[i]; } var f = mkFleet(); pool.push(f); return f; }

// â”€â”€ GAME STATE â”€â”€
var G = {
    state: 'mainMenu', winner: -1, tick: 0, speed: 1, rng: null, seed: 42, diff: 'normal',
    nodes: [], fleets: [], flows: [], players: [], human: 0, fog: null,
    cam: { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 },
    diffCfg: DIFFICULTY_PRESETS.normal,
    tune: { prod: 1, fspeed: FLEET_SPEED, def: DEF_FACTOR, flowInt: 15, aiAgg: AI_AGG, aiBuf: AI_BUF, aiInt: AI_INTERVAL, fogEnabled: false, aiAssist: true },
    rec: { events: [], seed: 0, nc: 0, diff: 'normal' },
    rep: null, aiTicks: [], flowId: 0, fleetSerial: 0,
    aiProfiles: [], mapFeature: { type: 'none' }, wormholes: [],
};
function defaultTune() { return { prod: 1, fspeed: FLEET_SPEED, def: DEF_FACTOR, flowInt: 15, aiAgg: AI_AGG, aiBuf: AI_BUF, aiInt: AI_INTERVAL, fogEnabled: false, aiAssist: true }; }

var net = {
    socket: null,
    connected: false,
    online: false,
    roomCode: '',
    players: [],
    isHost: false,
    playerName: '',
    pendingJoin: false,
    localPlayerIndex: 0,
    pendingCommands: [],
};

// â”€â”€ FOG â”€â”€
function initFog(pc, nc) { var v = [], ls = []; for (var p = 0; p < pc; p++) { v.push({}); var a = []; for (var n = 0; n < nc; n++)a.push({ tick: -1, owner: -1, units: 0 }); ls.push(a); } return { vis: v, ls: ls }; }
function updateVis(fog, pi, nodes, tick) {
    fog.vis[pi] = {}; var owned = [];
    for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (n.owner === pi) { var vr = n.visionR; if (n.selected) vr *= SEL_BONUS; owned.push({ x: n.pos.x, y: n.pos.y, r2: vr * vr }); } }
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.owner === pi) { fog.vis[pi][n.id] = true; fog.ls[pi][n.id] = { tick: tick, owner: n.owner, units: Math.floor(n.units) }; continue; }
        for (var j = 0; j < owned.length; j++) {
            var o = owned[j], dx = n.pos.x - o.x, dy = n.pos.y - o.y;
            if (dx * dx + dy * dy <= o.r2) { fog.vis[pi][n.id] = true; fog.ls[pi][n.id] = { tick: tick, owner: n.owner, units: Math.floor(n.units) }; break; }
        }
    }
}
function fleetVis(f, pi, nodes) {
    if (f.owner === pi) return true;
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i]; if (n.owner === pi) {
            var vr = n.visionR; if (n.selected) vr *= SEL_BONUS;
            var dx = f.x - n.pos.x, dy = f.y - n.pos.y; if (dx * dx + dy * dy <= vr * vr) return true;
        }
    } return false;
}

function nodeTypeOf(node) { return NODE_TYPE_DEFS[node.kind] || NODE_TYPE_DEFS.core; }
function nodeLevelProdMult(node) { return 1 + (node.level - 1) * 0.15; }
function nodeLevelDefMult(node) { return 1 + (node.level - 1) * 0.2; }
function nodeLevelCapMult(node) { return 1 + (node.level - 1) * 0.12; }
function nodeCapacity(node) {
    var td = nodeTypeOf(node);
    return Math.floor(MAX_UNITS * td.cap * nodeLevelCapMult(node));
}
function upgradeCost(node) {
    return Math.floor(18 + node.radius * 0.85 + (node.level - 1) * 14);
}
function initNodeKind(node) {
    var roll = G.rng.next();
    if (roll < 0.22) node.kind = 'forge';
    else if (roll < 0.42) node.kind = 'bulwark';
    else if (roll < 0.58) node.kind = 'relay';
    else node.kind = 'core';
    node.level = 1;
    node.maxUnits = nodeCapacity(node);
}
function nodePowerValue(node) {
    return node.units + node.maxUnits * 0.06 + node.level * 6;
}
function computePowerByPlayer() {
    var power = {};
    for (var i = 0; i < G.players.length; i++) power[i] = 0;
    for (var n = 0; n < G.nodes.length; n++) {
        var node = G.nodes[n];
        if (node.owner >= 0) power[node.owner] += nodePowerValue(node);
    }
    for (var f = 0; f < G.fleets.length; f++) {
        var fleet = G.fleets[f];
        if (fleet.active) power[fleet.owner] += fleet.count;
    }
    return power;
}
function pickAIProfile(aiIndex) {
    return AI_ARCHETYPES[(aiIndex - 1) % AI_ARCHETYPES.length];
}
function difficultyConfig(diff) {
    return DIFFICULTY_PRESETS[diff] || DIFFICULTY_PRESETS.normal;
}
function isLinkedWormhole(srcId, tgtId) {
    for (var i = 0; i < G.wormholes.length; i++) {
        var w = G.wormholes[i];
        if ((w.a === srcId && w.b === tgtId) || (w.b === srcId && w.a === tgtId)) return true;
    }
    return false;
}
function applyMapFeature() {
    G.wormholes = [];
    G.mapFeature = { type: 'none' };
    if (G.nodes.length < 8) return;
    if (G.rng.next() > G.diffCfg.featureChance) return;

    var featureRoll = G.rng.next();
    if (featureRoll < 0.5) {
        // Wormhole pair: farthest neutral-ish pair, inspired by constellation shortcuts.
        var bestA = -1, bestB = -1, bestD = -1;
        for (var i = 0; i < G.nodes.length; i++) {
            for (var j = i + 1; j < G.nodes.length; j++) {
                var a = G.nodes[i], b = G.nodes[j];
                if (a.owner !== -1 || b.owner !== -1) continue;
                var d = dist(a.pos, b.pos);
                if (d > bestD) { bestD = d; bestA = a.id; bestB = b.id; }
            }
        }
        if (bestA >= 0) {
            G.wormholes.push({ a: bestA, b: bestB });
            G.nodes[bestA].kind = 'relay';
            G.nodes[bestB].kind = 'relay';
            G.nodes[bestA].maxUnits = nodeCapacity(G.nodes[bestA]);
            G.nodes[bestB].maxUnits = nodeCapacity(G.nodes[bestB]);
            G.mapFeature = { type: 'wormhole', a: bestA, b: bestB };
        }
    } else {
        // Gravity sling: single anomaly around a central neutral node.
        var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
        var bestNode = null, bestCenterDist = Infinity;
        for (var n = 0; n < G.nodes.length; n++) {
            var node = G.nodes[n];
            if (node.owner !== -1) continue;
            var cd = dist(node.pos, center);
            if (cd < bestCenterDist) { bestCenterDist = cd; bestNode = node; }
        }
        if (bestNode) {
            G.mapFeature = { type: 'gravity', nodeId: bestNode.id, x: bestNode.pos.x, y: bestNode.pos.y, r: GRAVITY_RADIUS };
            bestNode.kind = 'core';
            bestNode.maxUnits = nodeCapacity(bestNode);
            if (bestNode.units > bestNode.maxUnits) bestNode.units = bestNode.maxUnits;
        }
    }
}

// â”€â”€ INIT GAME â”€â”€
function initGame(seedStr, nc, diff, opts) {
    opts = opts || {};
    var keepReplay = !!opts.keepReplay;
    var keepTuning = !!opts.keepTuning;
    var menuFog = typeof opts.fogEnabled === 'boolean' ? opts.fogEnabled : null;
    G.seed = (isNaN(Number(seedStr)) ? hashSeed(seedStr) : Number(seedStr)) || 42;
    G.diff = diff;
    G.rng = new RNG(G.seed);
    G.tick = 0;
    G.speed = 1;
    G.winner = -1;
    G.diffCfg = difficultyConfig(diff);
    if (!keepTuning) {
        G.tune = defaultTune();
        G.tune.aiAgg = G.diffCfg.aiAggBase;
        G.tune.aiBuf = G.diffCfg.aiBuffer;
        G.tune.aiInt = G.diffCfg.aiInterval;
        G.tune.flowInt = G.diffCfg.flowInterval;
        G.tune.aiAssist = G.diffCfg.adaptiveAI;
    }
    if (menuFog !== null) G.tune.fogEnabled = menuFog;
    G.flowId = 0;
    G.fleetSerial = 0;
    for (var i = 0; i < pool.length; i++) { pool[i].active = false; pool[i].trail = []; }
    G.fleets = [];
    G.flows = [];
    var aiDefault = diff === 'easy' ? 1 : diff === 'normal' ? 2 : 3;
    var humanCount = Math.max(1, Math.floor(Number(opts.humanCount || 1)));
    var aic = opts.aiCount !== undefined ? Math.max(0, Math.floor(Number(opts.aiCount))) : aiDefault;
    var totalPlayers = humanCount + aic;
    G.players = [];
    for (var pi = 0; pi < totalPlayers; pi++) {
        G.players.push({ idx: pi, color: PLAYER_COLORS[pi % PLAYER_COLORS.length], isAI: pi >= humanCount, alive: true });
    }
    var localPlayerIndex = opts.localPlayerIndex !== undefined ? Number(opts.localPlayerIndex) : 0;
    G.human = clamp(Math.floor(localPlayerIndex), 0, humanCount - 1);
    G.aiTicks = [];
    G.aiProfiles = [];
    for (var ai = 0; ai < G.players.length; ai++) {
        G.aiTicks.push(0);
        if (G.players[ai].isAI) G.aiProfiles[ai] = pickAIProfile(ai);
    }
    genMap(nc);
    applyMapFeature();
    G.fog = initFog(G.players.length, G.nodes.length);
    for (var p = 0; p < G.players.length; p++) updateVis(G.fog, p, G.nodes, 0);
    var pn = null; for (var ni = 0; ni < G.nodes.length; ni++) if (G.nodes[ni].owner === 0) { pn = G.nodes[ni]; break; }
    if (pn) { G.cam.x = pn.pos.x; G.cam.y = pn.pos.y; } G.cam.zoom = 1;
    if (!keepReplay) G.rec = { events: [], seed: G.seed, nc: nc, diff: diff };
    if (!keepReplay) G.rep = null;
    G.state = keepReplay ? 'replay' : 'playing';
}
function genMap(nc) {
    G.nodes = []; var att = 0, placed = 0, minDist = NODE_MINDIST;
    while (placed < nc && att < 4500) {
        if (att === 1400 || att === 2800) minDist *= 0.9;
        var x = G.rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD), y = G.rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD), r = G.rng.nextFloat(NODE_RMIN, NODE_RMAX);
        var ok = true; for (var i = 0; i < G.nodes.length; i++)if (dist({ x: x, y: y }, G.nodes[i].pos) < minDist) { ok = false; break; }
        if (ok) {
            var node = { id: placed, pos: { x: x, y: y }, radius: r, owner: -1, units: G.rng.nextInt(2, NEUTRAL_MAX), prodAcc: 0, maxUnits: MAX_UNITS, visionR: VISION_R + r * 2, selected: false, kind: 'core', level: 1 };
            initNodeKind(node);
            node.maxUnits = nodeCapacity(node);
            node.units = Math.min(node.units, Math.max(2, Math.floor(node.maxUnits * 0.4)));
            G.nodes.push(node); placed++;
        }
        att++;
    }
    while (placed < nc) {
        var fx = G.rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD), fy = G.rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD), fr = G.rng.nextFloat(NODE_RMIN, NODE_RMAX);
        var fn = { id: placed, pos: { x: fx, y: fy }, radius: fr, owner: -1, units: G.rng.nextInt(2, NEUTRAL_MAX), prodAcc: 0, maxUnits: MAX_UNITS, visionR: VISION_R + fr * 2, selected: false, kind: 'core', level: 1 };
        initNodeKind(fn);
        fn.maxUnits = nodeCapacity(fn);
        fn.units = Math.min(fn.units, Math.max(2, Math.floor(fn.maxUnits * 0.4)));
        G.nodes.push(fn); placed++;
    }
    var corners = [{ x: MAP_PAD, y: MAP_PAD }, { x: MAP_W - MAP_PAD, y: MAP_H - MAP_PAD }, { x: MAP_PAD, y: MAP_H - MAP_PAD }, { x: MAP_W - MAP_PAD, y: MAP_PAD }];
    for (var p = 0; p < G.players.length; p++) {
        var c = corners[p % 4], best = null, bd = Infinity;
        for (var n = 0; n < G.nodes.length; n++) { var cand = G.nodes[n]; if (cand.owner !== -1) continue; var d = dist(cand.pos, c); if (d < bd) { bd = d; best = cand; } }
        if (best) {
            best.owner = p;
            best.kind = 'core';
            best.level = 2;
            best.maxUnits = nodeCapacity(best);
            var startBoost = p === 0 ? G.diffCfg.humanStartBoost : G.diffCfg.aiStartBoost;
            var baseUnits = p === 0 ? 20 : 18;
            best.units = Math.min(best.maxUnits - 2, Math.max(12, Math.floor(baseUnits * startBoost)));
            best.radius = Math.max(best.radius, 28);
        }
    }
}

// â”€â”€ DISPATCH â”€â”€
function dispatch(owner, srcIds, tgtId, pct) {
    pct = clamp(typeof pct === 'number' ? pct : 0.5, 0.05, 1);
    var tgt = G.nodes[tgtId]; if (!tgt) return;
    for (var si = 0; si < srcIds.length; si++) {
        var src = G.nodes[srcIds[si]]; if (!src || src.owner !== owner) continue;
        var srcType = nodeTypeOf(src);
        var cnt = Math.max(1, Math.floor(src.units * pct * srcType.flow));
        cnt = Math.min(cnt, Math.floor(src.units) - 1);
        if (cnt <= 0 || src.units <= 1) continue;
        src.units -= cnt;
        var spacing = 0.012;
        var swarmWidth = Math.min(20, 6 + cnt * 0.35);
        var hasWormholeLink = isLinkedWormhole(src.id, tgtId);
        var curv = hasWormholeLink ? 0.05 : BEZ_CURV;
        var cp = bezCP(src.pos, tgt.pos, curv);
        for (var u = 0; u < cnt; u++) {
            var f = acquireFleet(); f.active = true; f.owner = owner; f.count = 1; f.srcId = srcIds[si]; f.tgtId = tgtId;
            var jitter = hashMix(G.seed, src.id, tgtId, G.fleetSerial++);
            var centered = cnt <= 1 ? 0 : ((u / (cnt - 1)) * 2 - 1);
            f.t = -u * spacing;
            f.speed = FLEET_SPEED; f.x = src.pos.x; f.y = src.pos.y;
            f.offsetL = centered * swarmWidth + (jitter - 0.5) * 1.6;
            f.spdVar = 0.98 + (jitter - 0.5) * 0.04;
            f.routeSpeedMult = srcType.speed * (hasWormholeLink ? WORMHOLE_SPEED_MULT : 1);
            f.cpx = cp.x; f.cpy = cp.y; f.arcLen = bezLen(src.pos, cp, tgt.pos);
            f.trail = [];
            G.fleets.push(f);
        }
    }
}

// â”€â”€ COMBAT â”€â”€
function combat(fleet, tgt) {
    if (tgt.owner === fleet.owner) { tgt.units += fleet.count; return; }
    var defMult = (tgt.owner >= 0 ? G.tune.def : 1) * nodeTypeOf(tgt).def * nodeLevelDefMult(tgt);
    var atk = fleet.count, def = tgt.units * defMult;
    if (atk > def) {
        tgt.owner = fleet.owner;
        tgt.units = Math.max(1, Math.floor(atk - def));
        G.flows = G.flows.filter(function (fl) { return !(fl.tgtId === tgt.id && fl.owner !== fleet.owner); });
    } else {
        tgt.units = Math.max(0, (def - atk) / defMult);
    }
    tgt.maxUnits = nodeCapacity(tgt);
}

// â”€â”€ FLOW LINKS â”€â”€
function addFlow(owner, srcId, tgtId) {
    if (srcId === tgtId) return;
    for (var i = 0; i < G.flows.length; i++) { var f = G.flows[i]; if (f.srcId === srcId && f.tgtId === tgtId && f.owner === owner) { f.active = !f.active; return; } }
    G.flows.push({ id: G.flowId++, srcId: srcId, tgtId: tgtId, owner: owner, tickAcc: 0, active: true });
}
function rmFlow(owner, srcId, tgtId) { G.flows = G.flows.filter(function (f) { return !(f.srcId === srcId && f.tgtId === tgtId && f.owner === owner); }); }
function upgradeNode(owner, nodeId) {
    var node = G.nodes[nodeId];
    if (!node || node.owner !== owner) return false;
    if (node.level >= NODE_LEVEL_MAX) return false;
    var cost = upgradeCost(node);
    if (node.units < cost) return false;
    node.units -= cost;
    node.level++;
    node.maxUnits = nodeCapacity(node);
    if (node.units > node.maxUnits) node.units = node.maxUnits;
    return true;
}

// â”€â”€ AI â”€â”€
function aiDecide(pi) {
    var cmds = [], own = [];
    for (var i = 0; i < G.nodes.length; i++) if (G.nodes[i].owner === pi) own.push(G.nodes[i]);
    if (!own.length) return cmds;

    var profile = G.aiProfiles[pi] || AI_ARCHETYPES[1];
    var useFog = !!G.diffCfg.aiUsesFog;
    var power = computePowerByPlayer();
    var humanPower = power[G.human] || 1;
    var myPower = power[pi] || 1;
    var delta = humanPower - myPower;
    var assist = G.tune.aiAssist ? clamp(delta / 420, -0.12, DDA_MAX_BOOST) : 0;
    var aggr = G.tune.aiAgg * profile.aggr * (1 + assist * 0.8);
    var reserve = Math.max(2, Math.floor(G.tune.aiBuf * profile.reserve * (1 - assist * 0.5)));
    var maxSources = profile.name === 'Rusher' ? 4 : 3;

    var targets = [];
    for (var ni = 0; ni < G.nodes.length; ni++) {
        var n = G.nodes[ni];
        if (n.owner === pi) continue;
        if (useFog && !G.fog.vis[pi][n.id]) continue;
        var tu = useFog ? (G.fog.vis[pi][n.id] ? n.units : G.fog.ls[pi][n.id].units) : n.units;
        var tDef = nodeTypeOf(n).def * nodeLevelDefMult(n) * (n.owner >= 0 ? G.tune.def : 1);

        var bd = Infinity;
        for (var oi = 0; oi < own.length; oi++) {
            var d = dist(own[oi].pos, n.pos);
            if (d < bd) bd = d;
        }

        var score = 0;
        score += Math.max(0, 520 - bd) * 0.45;
        score += Math.max(0, 55 - tu * tDef) * 2.1;
        score += n.radius * 0.75;
        if (n.owner === -1) score += 34;
        if (n.kind === 'forge') score += 20;
        if (n.kind === 'relay') score += 12;
        if (n.level > 1) score += (n.level - 1) * 11;
        score *= aggr;

        targets.push({ id: n.id, score: score, units: tu, effDef: tDef });
    }

    targets.sort(function (a, b) { return b.score - a.score; });
    var attackCount = myPower < humanPower ? 2 : 1;
    if (profile.name === 'Rusher') attackCount = Math.min(2, targets.length);
    attackCount = Math.min(attackCount, targets.length, G.diffCfg.maxAttackTargets);

    for (var ti = 0; ti < attackCount; ti++) {
        var t = targets[ti], tn = G.nodes[t.id], srcs = [], total = 0;
        var needed = t.units * t.effDef + 5 + tn.level * 3;
        var cands = own.filter(function (n) { return n.units > reserve + 1; }).sort(function (a, b) { return dist(a.pos, tn.pos) - dist(b.pos, tn.pos); });
        for (var j = 0; j < cands.length && srcs.length < maxSources; j++) {
            var av = cands[j].units - reserve;
            if (av <= 0) continue;
            srcs.push(cands[j].id);
            total += av;
            if (total >= needed) break;
        }
        if (srcs.length === 0) continue;
        if (total < needed * 0.55 && tn.owner !== -1) continue;
        var pct = clamp(needed / Math.max(total, 1), 0.3, 0.75);

        var flowGate = ((G.tick + tn.id * 3 + pi * 7) % 13) === 0;
        var shouldFlow = tn.owner !== -1 && tn.units > 12 && profile.flow > 0.75 && flowGate &&
            !G.flows.some(function (f) { return f.owner === pi && f.tgtId === tn.id && f.active; });
        if (shouldFlow) cmds.push({ type: 'flow', srcId: srcs[0], tgtId: tn.id });
        cmds.push({ type: 'send', sources: srcs, tgtId: tn.id, pct: pct });
    }

    var upgradeGate = ((G.tick + pi * 11) % 19) === 0;
    if (upgradeGate && profile.upg > 0.4) {
        var upNode = null, upScore = -1;
        for (var oi = 0; oi < own.length; oi++) {
            var ownNode = own[oi];
            if (ownNode.level >= NODE_LEVEL_MAX) continue;
            var cost = upgradeCost(ownNode);
            if (ownNode.units < cost + reserve + 6) continue;
            var s = ownNode.units - cost + (ownNode.kind === 'forge' ? 12 : 0) + (ownNode.kind === 'relay' ? 8 : 0);
            if (s > upScore) { upScore = s; upNode = ownNode; }
        }
        if (upNode) cmds.push({ type: 'upgrade', nodeId: upNode.id });
    }

    for (var fi = 0; fi < G.flows.length; fi++) {
        var fl = G.flows[fi];
        if (fl.owner === pi && fl.active && G.nodes[fl.tgtId].owner === pi) cmds.push({ type: 'rmFlow', srcId: fl.srcId, tgtId: fl.tgtId });
    }
    return cmds;
}

// â”€â”€ REPLAY â”€â”€
function recEvt(type, data) { if (net.online) return; G.rec.events.push({ tick: G.tick, type: type, data: data || {} }); }
function applyPlayerCommand(playerIndex, type, data) {
    data = data || {};
    if (type === 'send') {
        dispatch(playerIndex, data.sources || [], data.tgtId !== undefined ? data.tgtId : data.targetId, data.pct !== undefined ? data.pct : data.percent);
    } else if (type === 'flow') {
        addFlow(playerIndex, data.srcId !== undefined ? data.srcId : data.sourceId, data.tgtId !== undefined ? data.tgtId : data.targetId);
    } else if (type === 'rmFlow') {
        rmFlow(playerIndex, data.srcId !== undefined ? data.srcId : data.sourceId, data.tgtId !== undefined ? data.tgtId : data.targetId);
    } else if (type === 'upgrade') {
        if (Array.isArray(data.nodeIds)) {
            for (var i = 0; i < data.nodeIds.length; i++) upgradeNode(playerIndex, data.nodeIds[i]);
        } else {
            upgradeNode(playerIndex, data.nodeId);
        }
    }
}
function applyRep(evt) {
    var d = evt.data || {};
    var type = evt.type;
    if (type === 'sendPacket') type = 'send';
    else if (type === 'toggleFlow') type = 'flow';
    else if (type === 'removeFlow') type = 'rmFlow';
    else if (type === 'speedChange') type = 'speed';
    else if (type === 'upgradeNode') type = 'upgrade';

    switch (type) {
        case 'select': {
            var ids = d.ids || d.nodeIds || [];
            if (!d.append) for (var si = 0; si < G.nodes.length; si++) G.nodes[si].selected = false;
            for (var sj = 0; sj < ids.length; sj++) if (G.nodes[ids[sj]]) G.nodes[ids[sj]].selected = true;
            break;
        }
        case 'deselect':
            for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = false;
            break;
        case 'send':
            applyPlayerCommand(G.human, 'send', d);
            break;
        case 'flow':
            applyPlayerCommand(G.human, 'flow', d);
            break;
        case 'rmFlow':
            applyPlayerCommand(G.human, 'rmFlow', d);
            break;
        case 'speed':
            G.speed = d.speed;
            break;
        case 'upgrade':
            applyPlayerCommand(G.human, 'upgrade', d);
            break;
    }
}

// â”€â”€ TICK â”€â”€
function gameTick() {
    if (G.state !== 'playing' && G.state !== 'replay') return;

    // Lockstep determinism: Throttle simulation to stay synced with server ticks
    if (net.online) {
        if (!net.lastPingTick || G.tick - net.lastPingTick >= 45) {
            net.lastPingTick = G.tick;
            net.socket.emit('pingTick', { clientTs: Date.now() });
        }

        if (net.syncDrift !== undefined) {
            net.syncDrift += (G.speed - 1.0);

            // Hard-catchup for background tabs or extreme lag
            if (net.syncDrift > 30) G.speed = 0.1;
            else if (net.syncDrift > 10) G.speed = 0.5;
            else if (net.syncDrift > 3) G.speed = 0.85;
            else if (net.syncDrift < -90) G.speed = 10.0;
            else if (net.syncDrift < -30) G.speed = 4.0;
            else if (net.syncDrift < -10) G.speed = 2.0;
            else if (net.syncDrift < -3) G.speed = 1.15;
            else G.speed = 1.0;
        }

        if (net.pendingCommands.length > 0) {
            net.pendingCommands.sort(function (a, b) { return a.tick - b.tick; });
            var remaining = [];
            for (var qi = 0; qi < net.pendingCommands.length; qi++) {
                var cmd = net.pendingCommands[qi];
                if ((cmd.tick || 0) <= G.tick + 1) { // Apply when due
                    applyPlayerCommand(cmd.playerIndex, cmd.type, cmd.data);
                } else {
                    remaining.push(cmd);
                }
            }
            net.pendingCommands = remaining;
        }
    }

    if (G.rep && G.state === 'replay') {
        while (G.rep.idx < G.rep.events.length && G.rep.events[G.rep.idx].tick === G.tick) { applyRep(G.rep.events[G.rep.idx]); G.rep.idx++; }
        if (G.rep.idx >= G.rep.events.length && G.tick > ((G.rep.events.length ? G.rep.events[G.rep.events.length - 1].tick : 0) + 90)) { G.state = 'gameOver'; return; }
    }
    var power = computePowerByPlayer();
    // production
    for (var i = 0; i < G.nodes.length; i++) {
        var n = G.nodes[i]; if (n.owner < 0) continue;
        n.maxUnits = nodeCapacity(n);
        if (n.units > n.maxUnits) n.units = n.maxUnits;
        var td = nodeTypeOf(n);
        var ownerAssist = 0;
        if (n.owner !== G.human && G.tune.aiAssist) {
            var delta = (power[G.human] || 0) - (power[n.owner] || 0);
            ownerAssist = clamp(delta / 950, 0, DDA_MAX_BOOST);
        }
        var diffMult = n.owner === G.human ? G.diffCfg.humanProdMult : G.diffCfg.aiProdMult;
        n.prodAcc += BASE_PROD * G.tune.prod * (n.radius / NODE_RMAX) * td.prod * nodeLevelProdMult(n) * (1 + ownerAssist) * diffMult;
        if (n.prodAcc >= 1) { var a = Math.floor(n.prodAcc); n.units = Math.min(n.maxUnits, n.units + a); n.prodAcc -= a; }
    }
    // fleet movement with trail
    for (var i = G.fleets.length - 1; i >= 0; i--) {
        var f = G.fleets[i]; if (!f.active) continue;
        var speedMult = f.routeSpeedMult || 1;
        if (G.mapFeature.type === 'gravity') {
            var gdx = f.x - G.mapFeature.x, gdy = f.y - G.mapFeature.y;
            if (gdx * gdx + gdy * gdy <= G.mapFeature.r * G.mapFeature.r) speedMult *= GRAVITY_SPEED_MULT;
        }
        var dp = (f.speed * f.spdVar * G.tune.fspeed / FLEET_SPEED) * speedMult * TICK_DT;
        f.t += dp / f.arcLen;
        if (f.t >= 1) {
            var tgt = G.nodes[f.tgtId]; if (tgt.owner === f.owner) { tgt.units += f.count; if (tgt.units > tgt.maxUnits) tgt.units = tgt.maxUnits; } else combat(f, tgt);
            f.active = false; f.trail = []; G.fleets.splice(i, 1);
        } else if (f.t > 0) {
            var s = G.nodes[f.srcId], tg = G.nodes[f.tgtId], cp = { x: f.cpx, y: f.cpy }, pt = bezPt(s.pos, cp, tg.pos, f.t);
            // compute perpendicular offset for swarm spread
            var pt2 = bezPt(s.pos, cp, tg.pos, Math.min(1, f.t + 0.01));
            var tdx = pt2.x - pt.x, tdy = pt2.y - pt.y;
            var tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            var nx = -tdy / tlen, ny = tdx / tlen;
            // fade offset near start/end for convergence at nodes
            var fade = Math.min(1, f.t * 5) * Math.min(1, (1 - f.t) * 5);
            var ox = pt.x + nx * f.offsetL * fade;
            var oy = pt.y + ny * f.offsetL * fade;
            f.trail.push({ x: f.x, y: f.y }); if (f.trail.length > TRAIL_LEN) f.trail.shift();
            f.x = ox; f.y = oy;
        } else {
            // still waiting (negative t = delayed spawn)
            f.x = G.nodes[f.srcId].pos.x; f.y = G.nodes[f.srcId].pos.y;
        }
    }
    // flow links
    for (var i = 0; i < G.flows.length; i++) {
        var fl = G.flows[i]; if (!fl.active) continue;
        if (G.nodes[fl.srcId].owner !== fl.owner) { fl.active = false; continue; }
        fl.tickAcc++; if (fl.tickAcc >= G.tune.flowInt) {
            fl.tickAcc = 0; var amt = Math.max(1, Math.floor(G.nodes[fl.srcId].units * FLOW_FRAC));
            if (G.nodes[fl.srcId].units > amt + 2) dispatch(fl.owner, [fl.srcId], fl.tgtId, amt / G.nodes[fl.srcId].units);
        }
    }
    // AI
    for (var p = 0; p < G.players.length; p++) {
        if (!G.players[p].isAI || !G.players[p].alive) continue; G.aiTicks[p]++;
        if (G.aiTicks[p] >= G.tune.aiInt) {
            G.aiTicks[p] = 0; var cmds = aiDecide(p);
            for (var c = 0; c < cmds.length; c++) {
                var cmd = cmds[c];
                if (cmd.type === 'send') dispatch(p, cmd.sources, cmd.tgtId, cmd.pct);
                else if (cmd.type === 'flow') addFlow(p, cmd.srcId, cmd.tgtId);
                else if (cmd.type === 'rmFlow') rmFlow(p, cmd.srcId, cmd.tgtId);
                else if (cmd.type === 'upgrade') upgradeNode(p, cmd.nodeId);
            }
        }
    }
    // fog
    for (var p = 0; p < G.players.length; p++)updateVis(G.fog, p, G.nodes, G.tick);
    checkEnd(); G.tick++;
}
function checkEnd() {
    var nc = {}, fc = {};
    for (var i = 0; i < G.nodes.length; i++) { var o = G.nodes[i].owner; if (o >= 0) nc[o] = (nc[o] || 0) + 1; }
    for (var i = 0; i < G.fleets.length; i++) { var f = G.fleets[i]; if (f.active) fc[f.owner] = (fc[f.owner] || 0) + 1; }
    for (var i = 0; i < G.players.length; i++) { if (!G.players[i].alive) continue; if (!(nc[i] || 0) && !(fc[i] || 0)) G.players[i].alive = false; }
    var alive = G.players.filter(function (p) { return p.alive; });
    if (alive.length === 1) { G.winner = alive[0].idx; if (G.state === 'playing' || G.state === 'replay') G.state = 'gameOver'; }
    else if (alive.length === 0) { G.winner = -1; if (G.state === 'playing' || G.state === 'replay') G.state = 'gameOver'; }
}

// â”€â”€ COLOR UTILS â”€â”€
function hexRgb(h) { var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null; }
function lighten(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.min(255, c.r + a) + ',' + Math.min(255, c.g + a) + ',' + Math.min(255, c.b + a) + ')' : h; }
function darken(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.max(0, c.r - a) + ',' + Math.max(0, c.g - a) + ',' + Math.max(0, c.b - a) + ')' : h; }
function hexToRgba(h, a) { var c = hexRgb(h); return c ? 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')' : h; }

// â”€â”€ RENDERING â”€â”€
function render(ctx, cv, tick) {
    ctx.fillStyle = COLORS_BG; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(cv.width / 2, cv.height / 2); ctx.scale(G.cam.zoom, G.cam.zoom); ctx.translate(-G.cam.x, -G.cam.y);

    var hw = cv.width / 2 / G.cam.zoom, hh = cv.height / 2 / G.cam.zoom;
    // â”€â”€ STARS â”€â”€
    for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (Math.abs(s.x - G.cam.x) > hw + 50 || Math.abs(s.y - G.cam.y) > hh + 50) continue;
        var twinkle = 0.6 + 0.4 * Math.sin(tick * 0.03 + i * 2.1);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(200,220,255,' + s.b * twinkle + ')'; ctx.fill();
    }

    // â”€â”€ GRID â”€â”€
    var sp = 60;
    var sx = Math.floor((G.cam.x - hw) / sp) * sp, sy = Math.floor((G.cam.y - hh) / sp) * sp;
    ctx.fillStyle = COL_GRID;
    for (var x = sx; x <= G.cam.x + hw; x += sp)for (var y = sy; y <= G.cam.y + hh; y += sp) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill(); }

    drawMapFeature(ctx, tick);

    // â”€â”€ FLOW LINKS â”€â”€
    for (var i = 0; i < G.flows.length; i++) {
        var fl = G.flows[i]; if (!fl.active) continue;
        var sn = G.nodes[fl.srcId], tn = G.nodes[fl.tgtId];
        if (G.tune.fogEnabled && fl.owner !== G.human && !G.fog.vis[G.human][fl.srcId] && !G.fog.vis[G.human][fl.tgtId]) continue;
        var col = G.players[fl.owner] ? G.players[fl.owner].color : COL_NEUTRAL, cp = bezCP(sn.pos, tn.pos);
        // glow line
        ctx.beginPath(); ctx.moveTo(sn.pos.x, sn.pos.y); ctx.quadraticCurveTo(cp.x, cp.y, tn.pos.x, tn.pos.y);
        ctx.strokeStyle = hexToRgba(col, 0.15); ctx.lineWidth = 6; ctx.stroke();
        // core line
        ctx.beginPath(); ctx.moveTo(sn.pos.x, sn.pos.y); ctx.quadraticCurveTo(cp.x, cp.y, tn.pos.x, tn.pos.y);
        ctx.strokeStyle = hexToRgba(col, 0.4); ctx.lineWidth = 1.5; ctx.stroke();
        // animated pulses
        for (var ph = 0; ph < 4; ph++) {
            var tt = ((tick * PULSE_SPD * 0.012 + ph / 4) % 1), pt = bezPt(sn.pos, cp, tn.pos, tt);
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = hexToRgba(col, 0.7); ctx.fill();
        }
        var mid = bezPt(sn.pos, cp, tn.pos, 0.5), ah = bezPt(sn.pos, cp, tn.pos, 0.55);
        drawArrow(ctx, mid, ah, hexToRgba(col, 0.5), 5);
    }

    // â”€â”€ FLEETS WITH TRAILS â”€â”€
    var fhw = hw + 30, fhh = hh + 30;
    for (var i = 0; i < G.fleets.length; i++) {
        var f = G.fleets[i]; if (!f.active || f.t <= 0) continue;
        if (G.tune.fogEnabled && f.owner !== G.human && !fleetVis(f, G.human, G.nodes)) continue;
        if (Math.abs(f.x - G.cam.x) > fhw || Math.abs(f.y - G.cam.y) > fhh) continue;
        var col = G.players[f.owner] ? G.players[f.owner].color : COL_NEUTRAL;
        // draw trail
        for (var ti = 0; ti < f.trail.length; ti++) {
            var tp = f.trail[ti], alpha = (ti + 1) / (f.trail.length + 1) * 0.5;
            var sz = 1 + alpha * 1.5;
            ctx.beginPath(); ctx.arc(tp.x, tp.y, sz, 0, Math.PI * 2); ctx.fillStyle = hexToRgba(col, alpha); ctx.fill();
        }
        // draw unit dot (head)
        ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        // bright core
        ctx.beginPath(); ctx.arc(f.x, f.y, 1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    }

    // â”€â”€ NODES â”€â”€
    for (var i = 0; i < G.nodes.length; i++) {
        var n = G.nodes[i];
        var vis = !G.tune.fogEnabled || !!G.fog.vis[G.human][n.id], col, dUnits;
        if (n.owner === -1) col = COL_NEUTRAL;
        else if (vis || n.owner === G.human) col = G.players[n.owner] ? G.players[n.owner].color : COL_NEUTRAL;
        else { var ls = G.fog.ls[G.human][n.id]; col = (ls.tick >= 0 && ls.owner >= 0) ? darken(G.players[ls.owner] ? G.players[ls.owner].color : COL_NEUTRAL, 40) : COL_FOG; }
        if (vis || n.owner === G.human) dUnits = '' + Math.floor(n.units);
        else { var ls2 = G.fog.ls[G.human][n.id]; dUnits = ls2.tick >= 0 ? '' + ls2.units : '?'; }

        // outer glow for owned nodes
        if ((vis || n.owner === G.human) && n.owner >= 0) {
            ctx.save(); ctx.shadowColor = hexToRgba(col, 0.4); ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fill(); ctx.restore();
        }

        // selection ring
        if (n.selected && n.owner === G.human) {
            ctx.save(); ctx.shadowColor = COL_GLOW; ctx.shadowBlur = 22;
            ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -tick * 0.3; ctx.stroke(); ctx.restore();
        }

        // â”€â”€ Precompute orbital data â”€â”€
        var hasOrbiters = (vis || n.owner === G.human) && n.owner >= 0;
        var orbData = [];
        if (hasOrbiters) {
            var uCount = Math.floor(n.units);
            var orbiters = Math.min(uCount, MAX_ORBITERS);
            // Fixed 3 rings, fill sequentially to avoid redistribution jitter
            var GOLDEN = 2.39996323; // golden angle in radians
            var ringCap = [14, 14, 12]; // fixed capacity per ring
            var assigned = 0;
            for (var ring = 0; ring < 3; ring++) {
                var count = Math.min(ringCap[ring], orbiters - assigned);
                if (count <= 0) break;
                var rr = n.radius + 8 + ring * 8;
                var rrY = rr * (0.45 + ring * 0.1);
                var tilt = ring * 0.7 + n.id * 0.5 + 0.3;
                var baseSpeed = ORBIT_SPD * (1.2 - ring * 0.15) * (ring % 2 === 0 ? 1 : -1);
                var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
                var rd = { rr: rr, rrY: rrY, tilt: tilt, cosT: cosT, sinT: sinT, baseSpeed: baseSpeed, count: count, ring: ring, dots: [] };
                for (var oi = 0; oi < count; oi++) {
                    // Golden angle: each new dot gets a stable unique position
                    var angle = tick * baseSpeed + oi * GOLDEN + ring * 1.5;
                    var wobble = Math.sin(tick * 0.06 + oi * 2.3 + ring) * 1.5;
                    var lx = Math.cos(angle) * (rr + wobble);
                    var ly = Math.sin(angle) * (rrY + wobble * 0.5);
                    var ox = n.pos.x + lx * cosT - ly * sinT;
                    var oy = n.pos.y + lx * sinT + ly * cosT;
                    var dotR = 1.5 + ring * 0.3 + (oi % 5 === 0 ? 0.7 : 0);
                    var behind = Math.sin(angle) < 0;
                    rd.dots.push({ ox: ox, oy: oy, dotR: dotR, behind: behind, angle: angle, oi: oi });
                }
                orbData.push(rd);
                assigned += count;
            }
        }

        // â”€â”€ PASS 1: Back-half orbit tracks + back warriors (BEHIND planet) â”€â”€
        if (hasOrbiters) {
            for (var ri = 0; ri < orbData.length; ri++) {
                var rd = orbData[ri];
                // draw back half of orbit track
                ctx.save();
                ctx.translate(n.pos.x, n.pos.y);
                ctx.rotate(rd.tilt);
                ctx.beginPath();
                ctx.ellipse(0, 0, rd.rr, rd.rrY, 0, Math.PI, Math.PI * 2); // back arc
                ctx.strokeStyle = hexToRgba(col, 0.07 + rd.ring * 0.02);
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
                // draw back warriors (dimmer = depth cue)
                for (var di = 0; di < rd.dots.length; di++) {
                    var d = rd.dots[di];
                    if (!d.behind) continue;
                    // glow (dimmer for back)
                    ctx.beginPath(); ctx.arc(d.ox, d.oy, d.dotR + 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba(col, 0.08); ctx.fill();
                    // core dot (dimmer)
                    ctx.beginPath(); ctx.arc(d.ox, d.oy, d.dotR * 0.85, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba(col, 0.35); ctx.fill();
                }
            }
        }

        // â”€â”€ PLANET BODY (drawn between back and front orbiters) â”€â”€
        ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius, 0, Math.PI * 2);
        if (!vis && n.owner !== G.human) {
            ctx.fillStyle = COL_FOG; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();
        } else {
            var gr = ctx.createRadialGradient(n.pos.x - n.radius * 0.25, n.pos.y - n.radius * 0.25, n.radius * 0.05, n.pos.x, n.pos.y, n.radius);
            gr.addColorStop(0, lighten(col, 50)); gr.addColorStop(0.6, col); gr.addColorStop(1, darken(col, 30));
            ctx.fillStyle = gr; ctx.fill();
            ctx.strokeStyle = hexToRgba(col.indexOf('rgb') >= 0 ? '#ffffff' : lighten(col, 60), 0.5); ctx.lineWidth = 1.5; ctx.stroke();
        }

        if (vis || n.owner === G.human) {
            var tdef = nodeTypeOf(n);
            if (n.kind !== 'core') {
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, n.radius + 3.5, 0, Math.PI * 2);
                ctx.strokeStyle = hexToRgba(tdef.color, 0.45);
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
            if (n.level > 1) {
                for (var lv = 1; lv < n.level; lv++) {
                    var la = -Math.PI / 2 + (lv - 1) * 0.42;
                    var lx = n.pos.x + Math.cos(la) * (n.radius + 7);
                    var ly = n.pos.y + Math.sin(la) * (n.radius + 7);
                    ctx.beginPath();
                    ctx.arc(lx, ly, 2.1, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba('#ffffff', 0.9);
                    ctx.fill();
                }
            }
        }

        // â”€â”€ PASS 2: Front-half orbit tracks + front warriors (IN FRONT of planet) â”€â”€
        if (hasOrbiters) {
            for (var ri = 0; ri < orbData.length; ri++) {
                var rd = orbData[ri];
                // draw front half of orbit track
                ctx.save();
                ctx.translate(n.pos.x, n.pos.y);
                ctx.rotate(rd.tilt);
                ctx.beginPath();
                ctx.ellipse(0, 0, rd.rr, rd.rrY, 0, 0, Math.PI); // front arc
                ctx.strokeStyle = hexToRgba(col, 0.12 + rd.ring * 0.03);
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
                // draw front warriors (brighter = closer)
                for (var di = 0; di < rd.dots.length; di++) {
                    var d = rd.dots[di];
                    if (d.behind) continue;
                    // glow
                    ctx.beginPath(); ctx.arc(d.ox, d.oy, d.dotR + 2, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba(col, 0.18); ctx.fill();
                    // core dot (bright)
                    ctx.beginPath(); ctx.arc(d.ox, d.oy, d.dotR, 0, Math.PI * 2);
                    ctx.fillStyle = hexToRgba(col, 0.85 + (d.oi % 5 === 0 ? 0.15 : 0)); ctx.fill();
                    // bright center
                    ctx.beginPath(); ctx.arc(d.ox, d.oy, d.dotR * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
                }
            }
        }

        // unit count text
        ctx.font = 'bold ' + Math.max(11, n.radius * 0.5) + 'px Outfit,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!vis && n.owner !== G.human) { ctx.fillStyle = dUnits === '?' ? '#555' : '#777'; }
        else { ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; }
        ctx.fillText(dUnits, n.pos.x, n.pos.y); ctx.shadowBlur = 0;

        if (vis || n.owner === G.human) {
            if (n.kind !== 'core') {
                var icon = n.kind === 'forge' ? 'F' : (n.kind === 'bulwark' ? 'B' : 'R');
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = hexToRgba(nodeTypeOf(n).color, 0.95);
                ctx.textAlign = 'center';
                ctx.fillText(icon, n.pos.x, n.pos.y + n.radius * 0.63);
            }
            if (n.level > 1) {
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                ctx.fillText('L' + n.level, n.pos.x, n.pos.y - n.radius * 0.66);
            }
        }
    }

    // drag line
    if (inp.dragActive) {
        var ds = inp.dragStart, de = inp.dragEnd, dcp = bezCP(ds, de, BEZ_CURV * 0.7);
        ctx.save(); ctx.setLineDash([6, 6]); ctx.lineDashOffset = -tick * 0.4; ctx.beginPath(); ctx.moveTo(ds.x, ds.y);
        ctx.quadraticCurveTo(dcp.x, dcp.y, de.x, de.y); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        var pe = bezPt(ds, dcp, de, 0.9); drawArrow(ctx, pe, de, 'rgba(255,255,255,0.5)', 7);
    }
    ctx.restore();
    // marquee (screen space)
    if (inp.marqActive) {
        var mx = Math.min(inp.marqStart.x, inp.marqEnd.x), my = Math.min(inp.marqStart.y, inp.marqEnd.y),
            mw = Math.abs(inp.marqEnd.x - inp.marqStart.x), mh = Math.abs(inp.marqEnd.y - inp.marqStart.y);
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(74,142,255,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = 'rgba(74,142,255,0.06)'; ctx.fillRect(mx, my, mw, mh); ctx.restore();
    }
}
function drawArrow(ctx, f, t, col, sz) {
    var dx = t.x - f.x, dy = t.y - f.y, a = Math.atan2(dy, dx); ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sz, -sz * 0.4); ctx.lineTo(-sz, sz * 0.4); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}

function drawMapFeature(ctx, tick) {
    if (G.mapFeature.type === 'wormhole' && G.wormholes.length > 0) {
        for (var i = 0; i < G.wormholes.length; i++) {
            var w = G.wormholes[i], a = G.nodes[w.a], b = G.nodes[w.b];
            if (!a || !b) continue;
            var pulse = 0.5 + 0.5 * Math.sin(tick * 0.06);
            ctx.beginPath();
            ctx.moveTo(a.pos.x, a.pos.y);
            ctx.lineTo(b.pos.x, b.pos.y);
            ctx.strokeStyle = 'rgba(125,227,255,0.16)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 8]);
            ctx.lineDashOffset = -tick * 0.3;
            ctx.stroke();
            ctx.setLineDash([]);

            var rr = a.radius + 9 + pulse * 2;
            ctx.beginPath();
            ctx.arc(a.pos.x, a.pos.y, rr, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(125,227,255,0.38)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(b.pos.x, b.pos.y, rr, 0, Math.PI * 2);
            ctx.stroke();
        }
    } else if (G.mapFeature.type === 'gravity') {
        var g = G.mapFeature;
        var rPulse = g.r + Math.sin(tick * 0.04) * 5;
        ctx.beginPath();
        ctx.arc(g.x, g.y, rPulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(175,145,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(g.x, g.y, rPulse * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(175,145,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// â”€â”€ INPUT â”€â”€
var inp = {
    sel: new Set(), marqActive: false, marqStart: { x: 0, y: 0 }, marqEnd: { x: 0, y: 0 }, dragActive: false, dragStart: { x: 0, y: 0 }, dragEnd: { x: 0, y: 0 }, dragSrcs: [],
    panActive: false, panLast: { x: 0, y: 0 }, mw: { x: 0, y: 0 }, ms: { x: 0, y: 0 }, sendPct: 50, shift: false
};
function s2w(sx, sy) { return { x: (sx - cv.width / 2) / G.cam.zoom + G.cam.x, y: (sy - cv.height / 2) / G.cam.zoom + G.cam.y }; }
function hitNode(wp) { for (var i = 0; i < G.nodes.length; i++) { var n = G.nodes[i]; if (dist(wp, n.pos) <= n.radius + 5) return n; } return null; }
function nodesInRect(s, e, pi) {
    var x0 = Math.min(s.x, e.x), x1 = Math.max(s.x, e.x), y0 = Math.min(s.y, e.y), y1 = Math.max(s.y, e.y), r = [];
    for (var i = 0; i < G.nodes.length; i++) { var n = G.nodes[i]; if (n.owner === pi && n.pos.x >= x0 && n.pos.x <= x1 && n.pos.y >= y0 && n.pos.y <= y1) r.push(n.id); } return r;
}

// â”€â”€ DOM â”€â”€
var cv = document.getElementById('gameCanvas'), ctx = cv.getContext('2d');
var $ = function (id) { return document.getElementById(id); };
var mainMenu = $('mainMenu'), pauseOv = $('pauseOverlay'), goOv = $('gameOverOverlay'), hud = $('hud'), repBar = $('replayBar'), tunePanel = $('tuningPanel'), tuneOpen = $('tuneOpenBtn');
var seedIn = $('seedInput'), rndSeedBtn = $('randomSeedBtn'), ncIn = $('nodeCountInput'), ncLbl = $('nodeCountLabel'), diffSel = $('difficultySelect');
var startBtn = $('startBtn'), loadRepBtn = $('loadReplayBtn'), repFileIn = $('replayFileInput');
var playerNameIn = $('playerNameInput');
var startRoomBtn = $('startRoomBtn');
var createRoomBtn = $('createRoomBtn');
var joinRoomCodeInput = $('joinRoomCodeInput');
var joinRoomBtn = $('joinRoomBtn');
var hostControls = $('hostControls'), leaveRoomBtn = $('leaveRoomBtn');
var howToPlayBtn = $('howToPlayBtn');
var howToPlayOv = $('howToPlayOverlay');
var closeHowToPlayBtn = $('closeHowToPlayBtn');

if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', function () {
        howToPlayOv.classList.remove('hidden');
    });
}
if (closeHowToPlayBtn) {
    closeHowToPlayBtn.addEventListener('click', function () {
        howToPlayOv.classList.add('hidden');
    });
}
var roomStatusEl = $('roomStatus'), roomPlayersEl = $('roomPlayers'), roomListEl = $('roomList');
var tabSingle = $('tabSingle'), tabMulti = $('tabMulti'), panelSingle = $('panelSingle'), panelMulti = $('panelMulti');
var resumeBtn = $('resumeBtn'), quitBtn = $('quitBtn');
var goTitle = $('gameOverTitle'), goMsg = $('gameOverMsg'), repBtn = $('replayBtn'), expRepBtn = $('exportReplayBtn'), restartBtn = $('restartBtn');
var hudTick = $('hudTick'), hudPct = $('hudPercent'), sendPctIn = $('sendPercent'), pauseBtn = $('pauseBtn'), spdBtn = $('speedBtn');
var repSlower = $('replaySlower'), repPauseBtn = $('replayPause'), repFaster = $('replayFaster'), repSpdLbl = $('replaySpeedLabel'), repTickLbl = $('replayTickLabel'), repStopBtn = $('replayStop');
var tuneProd = $('tuneProduction'), tuneFSpd = $('tuneFleetSpeed'), tuneDef = $('tuneDefense'), tuneFlowInt = $('tuneFlowInterval');
var tuneAiAgg = $('tuneAIAggression'), tuneAiBuf = $('tuneAIBuffer'), tuneAiDec = $('tuneAIDecision');
var tuneResetBtn = $('tuneResetBtn'), tuneTogBtn = $('tuneToggleBtn');
var tuneFogCb = $('tuneFogOfWar'), tuneAiAssistCb = $('tuneAiAssist'), menuFogCb = $('menuFogOfWar');
var tuneVals = { p: $('tuneProductionVal'), f: $('tuneFleetSpeedVal'), d: $('tuneDefenseVal'), fi: $('tuneFlowIntervalVal'), aa: $('tuneAIAggressionVal'), ab: $('tuneAIBufferVal'), ad: $('tuneAIDecisionVal') };
var tuningOpen = false, lastRepData = null;

function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
roomButtonState();
setRoomStatus('', false);
ensureSocket();

if (tabSingle && tabMulti && panelSingle && panelMulti) {
    tabSingle.addEventListener('click', function () {
        tabSingle.classList.add('active'); tabMulti.classList.remove('active');
        panelSingle.classList.remove('hidden'); panelMulti.classList.add('hidden');
    });
    tabMulti.addEventListener('click', function () {
        tabMulti.classList.add('active'); tabSingle.classList.remove('active');
        panelMulti.classList.remove('hidden'); panelSingle.classList.add('hidden');
        requestLobby();
    });
}

if (roomListEl) {
    roomListEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-room-code]');
        if (!btn || net.roomCode) return;
        var code = btn.getAttribute('data-room-code');
        if (code && joinRoomCodeInput) {
            joinRoomCodeInput.value = code;
            doJoinRoom();
        }
    });
}

function showUI(st) {
    mainMenu.classList.toggle('hidden', st !== 'mainMenu'); pauseOv.classList.toggle('hidden', st !== 'paused'); goOv.classList.toggle('hidden', st !== 'gameOver');
    var ig = st === 'playing' || st === 'paused' || st === 'replay'; hud.classList.toggle('hidden', !ig || st === 'replay'); repBar.classList.toggle('hidden', st !== 'replay');
    if (st === 'playing' && tuningOpen) { tunePanel.classList.remove('hidden'); tuneOpen.classList.add('hidden'); }
    else if (st === 'playing') { tunePanel.classList.add('hidden'); tuneOpen.classList.remove('hidden'); }
    else { tunePanel.classList.add('hidden'); tuneOpen.classList.add('hidden'); }
}

function setRoomStatus(msg, error) {
    if (!roomStatusEl) return;
    roomStatusEl.textContent = msg || '';
    roomStatusEl.style.color = error ? '#ff8f8f' : 'var(--text-dim)';
}

function renderRoomPlayers(players, hostId) {
    if (!roomPlayersEl) return;
    roomPlayersEl.innerHTML = '';
    if (!players || players.length === 0) return;
    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var el = document.createElement('span');
        el.className = 'room-player' + (p.socketId === hostId ? ' host' : '');
        el.textContent = p.name + (p.socketId === hostId ? ' (Host)' : '');
        roomPlayersEl.appendChild(el);
    }
}

function roomButtonState() {
    var inRoom = !!net.roomCode;
    if (playerNameIn) playerNameIn.disabled = inRoom || net.online;
    if (startRoomBtn) {
        startRoomBtn.disabled = !inRoom || !net.connected || net.players.length < 2;
        startRoomBtn.textContent = 'Oyunu Baslat';
    }
}

function renderRoomList(rooms) {
    if (!roomListEl) return;
    roomListEl.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'room-list-empty';
        empty.textContent = net.connected ? 'Henuz oda yok.' : 'Sunucuya baglaniliyor...';
        roomListEl.appendChild(empty);
        return;
    }
    for (var i = 0; i < rooms.length; i++) {
        var r = rooms[i];
        var item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = '<div class="room-item-main"><span class="room-item-code">' + r.code + '</span><span class="room-item-meta">' + (r.hostName || 'Host') + ' | ' + r.players + '/' + r.maxPlayers + ' | ' + (r.difficulty || 'normal') + '</span></div><button class="room-join-btn secondary-btn" data-room-code="' + r.code + '">Katil</button>';
        roomListEl.appendChild(item);
    }
}

function clearRoomState(message) {
    net.online = false;
    net.roomCode = '';
    net.players = [];
    net.isHost = false;
    net.localPlayerIndex = 0;
    net.pendingCommands = [];
    renderRoomPlayers([], null);
    if (message) setRoomStatus(message, false);
    roomButtonState();
    if (roomListEl) roomListEl.style.display = '';
    if (createRoomBtn) createRoomBtn.style.display = '';
    if (joinRoomCodeInput && joinRoomCodeInput.parentElement) joinRoomCodeInput.parentElement.style.display = '';
    if (hostControls) hostControls.style.display = 'none';
    if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';
    requestLobby();
}

function requestLobby() {
    if (net.socket && net.connected) net.socket.emit('requestLobby');
}

function doCreateRoom() {
    ensureSocket();
    if (!net.socket) { setRoomStatus('Socket.IO yuklenemedi.', true); return; }
    if (!net.connected) { setRoomStatus('Sunucuya baglaniyor...', false); return; }
    if (net.roomCode) return;

    var chosen = (playerNameIn && playerNameIn.value.trim()) || '';
    if (!chosen) { setRoomStatus('Önce nick seçmelisin.', true); return; }
    net.playerName = chosen;

    setRoomStatus('Oda kuruluyor...', false);
    var multiSeed = $('multiSeedInput'), multiNode = $('multiNodeInput'), multiDiff = $('multiDiffSelect');
    net.socket.emit('createRoom', {
        action: 'create',
        playerName: net.playerName,
        seed: (multiSeed && multiSeed.value) || seedIn.value || '42',
        nodeCount: Number((multiNode && multiNode.value) || ncIn.value || 16),
        difficulty: (multiDiff && multiDiff.value) || diffSel.value || 'normal',
        fogEnabled: menuFogCb ? !!menuFogCb.checked : false,
    });
}

function doJoinRoom() {
    ensureSocket();
    if (!net.socket) { setRoomStatus('Socket.IO yuklenemedi.', true); return; }
    if (!net.connected) { setRoomStatus('Sunucuya baglaniyor...', false); return; }
    if (net.roomCode) return;

    var chosen = (playerNameIn && playerNameIn.value.trim()) || '';
    if (!chosen) { setRoomStatus('Önce nick seçmelisin.', true); return; }
    net.playerName = chosen;

    var code = (joinRoomCodeInput && joinRoomCodeInput.value.trim().toUpperCase()) || '';
    if (!code || code.length < 4) { setRoomStatus('Gecerli bir oda kodu girin (4-6 hane).', true); return; }

    net.pendingJoin = false;
    setRoomStatus('Odaya bağlanıyor...', false);
    net.socket.emit('joinRoom', {
        action: 'join',
        playerName: net.playerName,
        roomCode: code
    });
}

function issueOnlineCommand(type, data) {
    if (net.online && net.socket && net.roomCode) {
        // İleri tarihli komut göndererek, ağ gecikmesine rağmen 
        // iki oyuncuda da aynı tick'te eşzamanlı işletilmesini sağla (Command Delay)
        net.socket.emit('playerCommand', { type: type, data: data || {}, tick: G.tick + 12 });
        return true;
    }
    return false;
}

function socketEndpoint() {
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:3000';
    if (window.location.port === '5173') {
        return window.location.protocol + '//' + window.location.hostname + ':3000';
    }
    return undefined;
}

function ensureSocket() {
    if (net.socket || typeof window.io !== 'function') return;
    net.socket = window.io(socketEndpoint());

    net.socket.on('connect', function () {
        net.connected = true;
        setRoomStatus('Bağlantı kuruldu. Oda Kur veya Katıl.', false);
        requestLobby();
        roomButtonState();
    });

    net.socket.on('connect_error', function () {
        net.connected = false;
        setRoomStatus('Cannot reach multiplayer server. Start it with "npm run server".', true);
        roomButtonState();
    });

    net.socket.on('disconnect', function () {
        net.connected = false;
        clearRoomState('Disconnected from multiplayer server.');
    });

    net.socket.on('lobbyState', function (payload) {
        var rooms = payload && Array.isArray(payload.rooms) ? payload.rooms : [];
        if (net.roomCode) return; // Already in a room
        renderRoomList(rooms);
        if (rooms.length === 0) {
            setRoomStatus('Henuz oda yok. Oda Kur ile yeni oda olustur veya arkadasindan oda kodu al.', false);
        } else {
            setRoomStatus(rooms.length + ' oda mevcut. Birine katil veya yeni oda kur.', false);
        }
    });

    net.socket.on('roomState', function (state) {
        net.roomCode = state.code;
        net.isHost = !!state.isHost;
        net.players = state.players || [];
        net.pendingJoin = false;

        if (hostControls) hostControls.style.display = net.isHost ? 'flex' : 'none';
        if (roomListEl) roomListEl.style.display = 'none';
        if (createRoomBtn) createRoomBtn.style.display = 'none';
        if (joinRoomCodeInput && joinRoomCodeInput.parentElement) joinRoomCodeInput.parentElement.style.display = 'none';
        if (leaveRoomBtn) leaveRoomBtn.style.display = 'block';

        renderRoomPlayers(net.players, state.hostId);
        var status = 'Oda: ' + state.code + ' | ' + net.players.length + '/' + state.maxPlayers + ' oyuncu';
        if (net.players.length < 2) status += ' | En az 2 oyuncu gerekli';
        else status += (net.isHost ? ' | Oyunu baslatabilirsin' : ' | Hostun baslatmasi bekleniyor...');
        setRoomStatus(status, false);
        roomButtonState();
    });

    net.socket.on('roomError', function (err) {
        net.pendingJoin = false;
        setRoomStatus((err && err.message) || 'Room error', true);
        roomButtonState();
    });

    net.socket.on('roomClosed', function (payload) {
        clearRoomState((payload && payload.message) || 'Room closed.');
        requestLobby();
        if (G.state === 'playing' || G.state === 'paused' || G.state === 'replay') {
            G.state = 'mainMenu';
            showUI('mainMenu');
        }
    });

    net.socket.on('playerLeft', function (payload) {
        if (G.state === 'playing' && G.players && G.players[payload.index]) {
            G.players[payload.index].isAI = true;
            console.log(payload.name + ' ayrıldı. Yerine Yapay Zeka geçti.');
        } else if (net.players) {
            net.players = net.players.filter(function (p) { return p.index !== payload.index; });
            renderRoomPlayers(net.players, net.isHost ? net.socket.id : null);
        }
    });

    net.socket.on('pongTick', function (payload) {
        if (!net.online) return;
        var latencyMs = Date.now() - payload.clientTs;
        var latencyTicks = latencyMs / 2 / 33.33;
        var realServerTick = payload.serverTick + latencyTicks;
        net.syncDrift = G.tick - realServerTick;
    });

    net.socket.on('matchStarted', function (payload) {
        var players = payload.players || [];
        net.players = players;
        net.pendingJoin = false;
        var self = players.find(function (p) { return p.socketId === net.socket.id; });
        net.localPlayerIndex = self ? self.index : 0;
        net.online = true;
        net.pendingCommands = [];
        net.syncDrift = 0;
        net.lastPingTick = 0;

        initGame(payload.seed || '42', Number(payload.nodeCount || 16), payload.difficulty || 'normal', {
            keepReplay: false,
            keepTuning: false,
            fogEnabled: !!payload.fogEnabled,
            humanCount: Number(payload.humanCount || players.length || 2),
            aiCount: Number(payload.aiCount || 0),
            localPlayerIndex: net.localPlayerIndex,
        });
        inp.sel.clear();
        for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = false;
        spIdx = 0;
        spdBtn.textContent = '1x';
        tuneFogCb.checked = G.tune.fogEnabled;
        if (menuFogCb) menuFogCb.checked = G.tune.fogEnabled;
        setRoomStatus('Online match started. You are P' + (net.localPlayerIndex + 1) + '.', false);
        showUI('playing');
    });

    net.socket.on('roomCommand', function (cmd) {
        if (!net.online) return;
        net.pendingCommands.push(cmd);
    });
}
function normalizeReplay(raw) {
    if (!raw || !Array.isArray(raw.events)) throw new Error('Replay events missing');
    var nc = Number(raw.nc !== undefined ? raw.nc : raw.nodeCount);
    var diff = raw.diff !== undefined ? raw.diff : raw.difficulty;
    var seed = Number(raw.seed);
    return {
        seed: isNaN(seed) ? 42 : seed,
        nc: isNaN(nc) ? 16 : nc,
        diff: (typeof diff === 'string' ? diff : 'normal'),
        events: raw.events.map(function (e) {
            return { tick: Number(e.tick) || 0, type: e.type, data: e.data || {} };
        }),
    };
}
function startReplayFromData(raw) {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    var rep = normalizeReplay(raw);
    initGame('' + rep.seed, rep.nc, rep.diff, { keepReplay: true, keepTuning: false, fogEnabled: false });
    G.rep = { events: rep.events, idx: 0, speed: 1, paused: false };
    spIdx = 0;
    spdBtn.textContent = '1x';
    repSpdLbl.textContent = '1x';
    repPauseBtn.textContent = 'Pause';
    showUI('replay');
}
// Menu
ncIn.addEventListener('input', function () { ncLbl.textContent = ncIn.value; });
var multiNodeIn = $('multiNodeInput'), multiNodeLbl = $('multiNodeLabel');
if (multiNodeIn && multiNodeLbl) multiNodeIn.addEventListener('input', function () { multiNodeLbl.textContent = multiNodeIn.value; });
rndSeedBtn.addEventListener('click', function () { seedIn.value = '' + Math.floor(Math.random() * 100000); });
startBtn.addEventListener('click', function () {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    var fogOn = menuFogCb ? !!menuFogCb.checked : false;
    initGame(seedIn.value || '42', parseInt(ncIn.value, 10), diffSel.value, { fogEnabled: fogOn });
    inp.sel.clear();
    for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = false;
    spIdx = 0;
    spdBtn.textContent = '1x';
    tuneFogCb.checked = fogOn;
    showUI('playing');
});

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', function () {
        doCreateRoom();
    });
}

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', function () {
        doJoinRoom();
    });
}

if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', function () {
        if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
        clearRoomState('Odadan ayrildin.');
    });
}

if (startRoomBtn) {
    startRoomBtn.addEventListener('click', function () {
        if (!net.socket || !net.roomCode) return;
        if (net.players.length < 2) {
            setRoomStatus('Online baslat icin en az 2 oyuncu gerekli.', true);
            return;
        }
        setRoomStatus('Online mac baslatiliyor...', false);
        net.socket.emit('startMatch');
    });
}

loadRepBtn.addEventListener('click', function () { repFileIn.click(); });
repFileIn.addEventListener('change', function () {
    var f = repFileIn.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () {
        try {
            startReplayFromData(JSON.parse(r.result));
        } catch (e) { alert('Invalid replay: ' + e); }
        repFileIn.value = '';
    }; r.readAsText(f);
});
pauseBtn.addEventListener('click', function () { if (net.online) return; if (G.state === 'playing') { G.state = 'paused'; showUI('paused'); } });
resumeBtn.addEventListener('click', function () { if (G.state === 'paused') { G.state = 'playing'; showUI('playing'); } });
quitBtn.addEventListener('click', function () {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    G.state = 'mainMenu'; showUI('mainMenu');
});
var speeds = [1, 2, 4], spIdx = 0;
spdBtn.addEventListener('click', function () { if (net.online) return; spIdx = (spIdx + 1) % 3; G.speed = speeds[spIdx]; spdBtn.textContent = G.speed + 'x'; recEvt('speed', { speed: G.speed }); });
sendPctIn.addEventListener('input', function () { inp.sendPct = parseInt(sendPctIn.value, 10); hudPct.textContent = 'Send: ' + inp.sendPct + '%'; });
repBtn.addEventListener('click', function () { if (lastRepData) startReplayFromData(lastRepData); });
expRepBtn.addEventListener('click', function () { if (!lastRepData) return; var b = new Blob([JSON.stringify(lastRepData, null, 2)], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'replay-' + lastRepData.seed + '.json'; a.click(); URL.revokeObjectURL(u); });
restartBtn.addEventListener('click', function () { G.state = 'mainMenu'; showUI('mainMenu'); });
repSlower.addEventListener('click', function () { if (G.rep) G.rep.speed = Math.max(0.25, G.rep.speed / 2); repSpdLbl.textContent = (G.rep ? G.rep.speed : 1) + 'x'; });
repFaster.addEventListener('click', function () { if (G.rep) G.rep.speed = Math.min(8, G.rep.speed * 2); repSpdLbl.textContent = (G.rep ? G.rep.speed : 1) + 'x'; });
repPauseBtn.addEventListener('click', function () { if (G.rep) { G.rep.paused = !G.rep.paused; repPauseBtn.textContent = G.rep.paused ? 'Play' : 'Pause'; } });
repStopBtn.addEventListener('click', function () { G.state = 'mainMenu'; showUI('mainMenu'); });
function syncTune() {
    tuneProd.value = G.tune.prod; tuneFSpd.value = G.tune.fspeed; tuneDef.value = G.tune.def; tuneFlowInt.value = G.tune.flowInt;
    tuneAiAgg.value = G.tune.aiAgg; tuneAiBuf.value = G.tune.aiBuf; tuneAiDec.value = G.tune.aiInt;
    tuneFogCb.checked = G.tune.fogEnabled;
    if (tuneAiAssistCb) tuneAiAssistCb.checked = G.tune.aiAssist;
    updTuneLabels();
}
function updTuneLabels() {
    tuneVals.p.textContent = parseFloat(tuneProd.value).toFixed(1); tuneVals.f.textContent = tuneFSpd.value; tuneVals.d.textContent = parseFloat(tuneDef.value).toFixed(1);
    tuneVals.fi.textContent = tuneFlowInt.value; tuneVals.aa.textContent = parseFloat(tuneAiAgg.value).toFixed(1); tuneVals.ab.textContent = tuneAiBuf.value; tuneVals.ad.textContent = tuneAiDec.value;
}
function readTune() {
    if (G.state === 'replay' || net.online) return; G.tune.prod = parseFloat(tuneProd.value); G.tune.fspeed = parseFloat(tuneFSpd.value);
    G.tune.def = parseFloat(tuneDef.value); G.tune.flowInt = parseInt(tuneFlowInt.value, 10); G.tune.aiAgg = parseFloat(tuneAiAgg.value);
    G.tune.aiBuf = parseInt(tuneAiBuf.value, 10); G.tune.aiInt = parseInt(tuneAiDec.value, 10); updTuneLabels();
    if (tuneAiAssistCb) G.tune.aiAssist = tuneAiAssistCb.checked;
}
[tuneProd, tuneFSpd, tuneDef, tuneFlowInt, tuneAiAgg, tuneAiBuf, tuneAiDec].forEach(function (e) { e.addEventListener('input', readTune); });
tuneFogCb.addEventListener('change', function () { G.tune.fogEnabled = tuneFogCb.checked; if (menuFogCb) menuFogCb.checked = tuneFogCb.checked; });
if (tuneAiAssistCb) tuneAiAssistCb.addEventListener('change', function () { if (net.online) { tuneAiAssistCb.checked = G.tune.aiAssist; return; } G.tune.aiAssist = tuneAiAssistCb.checked; });
tuneResetBtn.addEventListener('click', function () {
    G.tune = defaultTune(); tuneFogCb.checked = false; if (menuFogCb) menuFogCb.checked = false;
    if (tuneAiAssistCb) tuneAiAssistCb.checked = true;
    syncTune();
});
tuneTogBtn.addEventListener('click', function () { tuningOpen = false; tunePanel.classList.add('hidden'); tuneOpen.classList.remove('hidden'); });
tuneOpen.addEventListener('click', function () { tuningOpen = true; tunePanel.classList.remove('hidden'); tuneOpen.classList.add('hidden'); syncTune(); });
if (menuFogCb) menuFogCb.addEventListener('change', function () { tuneFogCb.checked = menuFogCb.checked; });

// â”€â”€ CANVAS MOUSE â”€â”€
cv.addEventListener('mousedown', function (e) {
    if (G.state !== 'playing') return; var w = s2w(e.offsetX, e.offsetY); inp.mw = w; inp.ms = { x: e.offsetX, y: e.offsetY };
    if (e.button === 1) { inp.panActive = true; inp.panLast = { x: e.offsetX, y: e.offsetY }; e.preventDefault(); return; }
    if (e.button === 2) {
        var nd = hitNode(w);
        if (nd && inp.sel.size > 0 && nd.owner !== G.human) {
            inp.sel.forEach(function (sid) {
                var sn = G.nodes[sid];
                if (sn && sn.owner === G.human) {
                    var flowData = { srcId: sid, tgtId: nd.id };
                    if (!issueOnlineCommand('flow', flowData)) {
                        applyPlayerCommand(G.human, 'flow', flowData);
                        recEvt('flow', flowData);
                    }
                }
            });
        }
        e.preventDefault(); return;
    }
    var cn = hitNode(w); inp.shift = e.shiftKey;
    if (cn && cn.owner === G.human) { if (!e.shiftKey) { G.nodes.forEach(function (n) { n.selected = false; }); inp.sel.clear(); } cn.selected = true; inp.sel.add(cn.id); recEvt('select', { ids: Array.from(inp.sel), append: e.shiftKey }); }
    else if (cn && inp.sel.size > 0) {
        var srcs = Array.from(inp.sel), pct = inp.sendPct / 100;
        var sendData = { sources: srcs, tgtId: cn.id, pct: pct };
        if (!issueOnlineCommand('send', sendData)) {
            applyPlayerCommand(G.human, 'send', sendData);
            recEvt('send', sendData);
        }
    }
    else {
        // Empty-space drag defaults to marquee selection.
        // Use Ctrl + drag for drag-send when a selection exists.
        if (e.ctrlKey && inp.sel.size > 0) {
            inp.dragActive = true; var cx = 0, cy = 0, cc = 0; inp.sel.forEach(function (id) { cx += G.nodes[id].pos.x; cy += G.nodes[id].pos.y; cc++; });
            inp.dragStart = { x: cx / cc, y: cy / cc }; inp.dragEnd = w; inp.dragSrcs = Array.from(inp.sel);
        } else {
            if (!e.shiftKey) { G.nodes.forEach(function (n) { n.selected = false; }); inp.sel.clear(); recEvt('deselect', {}); }
            inp.marqActive = true; inp.marqStart = { x: e.offsetX, y: e.offsetY }; inp.marqEnd = { x: e.offsetX, y: e.offsetY };
        }
    }
});
cv.addEventListener('mousemove', function (e) {
    var w = s2w(e.offsetX, e.offsetY); inp.mw = w; inp.ms = { x: e.offsetX, y: e.offsetY };
    if (inp.panActive) { var dx = (e.offsetX - inp.panLast.x) / G.cam.zoom, dy = (e.offsetY - inp.panLast.y) / G.cam.zoom; G.cam.x -= dx; G.cam.y -= dy; inp.panLast = { x: e.offsetX, y: e.offsetY }; return; }
    if (inp.dragActive) { inp.dragEnd = w; return; }
    if (inp.marqActive) { inp.marqEnd = { x: e.offsetX, y: e.offsetY }; }
});
cv.addEventListener('mouseup', function (e) {
    if (e.button === 1) { inp.panActive = false; return; }
    if (inp.dragActive) {
        var w = s2w(e.offsetX, e.offsetY), tn = hitNode(w);
        if (tn && inp.dragSrcs.length > 0) {
            var pct = inp.sendPct / 100;
            var dragSend = { sources: inp.dragSrcs, tgtId: tn.id, pct: pct };
            if (!issueOnlineCommand('send', dragSend)) {
                applyPlayerCommand(G.human, 'send', dragSend);
                recEvt('send', dragSend);
            }
        }
        inp.dragActive = false; inp.dragSrcs = []; return;
    }
    if (inp.marqActive) {
        var sw = s2w(inp.marqStart.x, inp.marqStart.y), ew = s2w(inp.marqEnd.x, inp.marqEnd.y), ids = nodesInRect(sw, ew, G.human);
        if (ids.length > 0) { if (!inp.shift) { G.nodes.forEach(function (n) { n.selected = false; }); inp.sel.clear(); } ids.forEach(function (id) { G.nodes[id].selected = true; inp.sel.add(id); }); recEvt('select', { ids: Array.from(inp.sel), append: inp.shift }); } inp.marqActive = false;
    }
});
cv.addEventListener('wheel', function (e) {
    if (G.state !== 'playing' && G.state !== 'replay') return;
    var f = e.deltaY > 0 ? (1 - ZOOM_SPD) : (1 + ZOOM_SPD); G.cam.zoom *= f; G.cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, G.cam.zoom)); e.preventDefault();
}, { passive: false });
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
window.addEventListener('keydown', function (e) {
    if (G.state === 'playing') {
        if (!net.online && (e.key === 'Escape' || e.key === 'p')) { G.state = 'paused'; showUI('paused'); }
        if (e.key === 'a') { G.nodes.forEach(function (n) { if (n.owner === G.human) { n.selected = true; inp.sel.add(n.id); } }); }
        if (e.key === 'u' || e.key === 'U') {
            var targetIds = Array.from(inp.sel);
            if (targetIds.length > 0) {
                if (issueOnlineCommand('upgrade', { nodeIds: targetIds })) {
                    // applied when roomCommand is received
                } else {
                    var upgraded = [];
                    inp.sel.forEach(function (id) { if (upgradeNode(G.human, id)) upgraded.push(id); });
                    if (upgraded.length > 0) recEvt('upgrade', { nodeIds: upgraded });
                }
            }
        }
        if (e.key >= '1' && e.key <= '9') {
            inp.sendPct = parseInt(e.key, 10) * 10;
            sendPctIn.value = '' + inp.sendPct;
            hudPct.textContent = 'Send: ' + inp.sendPct + '%';
        } else if (e.key === '0') {
            inp.sendPct = 100;
            sendPctIn.value = '100';
            hudPct.textContent = 'Send: 100%';
        }
    }
    else if (G.state === 'paused') { if (!net.online && (e.key === 'Escape' || e.key === 'p')) { G.state = 'playing'; showUI('playing'); } }
});

// â”€â”€ GAME LOOP â”€â”€
var acc = 0, lastT = 0, prevSt = 'mainMenu';
function loop(ts) {
    var rawDt = Math.min((ts - lastT) / 1000, 0.1); lastT = ts;
    if (G.state !== prevSt) {
        showUI(G.state); if (G.state === 'gameOver') {
            if (prevSt === 'playing') lastRepData = JSON.parse(JSON.stringify(G.rec));
            goTitle.textContent = G.winner === G.human ? 'Victory!' : 'Defeat';
            goMsg.textContent = G.winner === G.human ? 'Conquered all stars in ' + G.tick + ' ticks!' : 'Eliminated at tick ' + G.tick + '.';
        } prevSt = G.state;
    }
    if (G.state === 'playing' || G.state === 'replay') {
        var es = G.state === 'replay' && G.rep ? (G.rep.paused ? 0 : G.rep.speed) : G.speed; acc += rawDt * es;
        while (acc >= TICK_DT) { gameTick(); acc -= TICK_DT; }
        var featureName = G.mapFeature.type === 'wormhole' ? 'Wormhole' : (G.mapFeature.type === 'gravity' ? 'Gravity' : 'Standard');
        hudTick.textContent = 'Tick: ' + G.tick + ' | ' + G.diff + ' | ' + featureName;
        if (G.state === 'replay') repTickLbl.textContent = 'Tick: ' + G.tick;
    }
    if (G.state !== 'mainMenu') render(ctx, cv, G.tick);
    requestAnimationFrame(loop);
}
showUI('mainMenu');
requestAnimationFrame(function (ts) { lastT = ts; loop(ts); });
