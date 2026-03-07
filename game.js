/* ============================================================
   Stellar Conquest Ã¢â‚¬â€œ Complete Game (Plain JavaScript)
   No build tools needed. Open stellar_conquest.html directly.
   v2: Orbital warriors, fleet trails, enhanced visuals
   ============================================================ */

import { computeSendCount } from './assets/sim/dispatch_math.js';
import { applyTurretDamage } from './assets/sim/turret.js';
import { shouldStartDragSend, resolveRightClickAction } from './assets/sim/input_policy.js';
import { isDispatchAllowed } from './assets/sim/barrier.js';
import { selectBarrierGateIds } from './assets/sim/barrier_layout.js';
import { applyDefenseFieldDamage, getDefenseFieldStats } from './assets/sim/defense_field.js';
import { computePlayerUnitCount, computeGlobalCap } from './assets/sim/cap.js';
import { computeOwnershipMetrics, computeSupplyConnected as computeSupplyConnectedState, computePowerByPlayer as computePowerByPlayerState, getPlayerCapitalId } from './assets/sim/state_metrics.js';
import { stepNodeEconomy } from './assets/sim/node_economy.js';
import { getRulesetConfig, normalizeRulesetMode, normalizeNodeKindForRuleset } from './assets/sim/ruleset.js';
import { computeFriendlyReinforcementRoom } from './assets/sim/reinforcement.js';
import { getStrategicPulseState, isStrategicPulseActiveForNode } from './assets/sim/strategic_pulse.js';
import { computeSyncHash } from './assets/sim/state_hash.js';
import { applyPlayerCommandWithOps } from './assets/sim/command_apply.js';
import { sanitizeCommandData } from './assets/sim/command_schema.js';
import { resolveFleetArrivals, stepFleetMovement } from './assets/sim/fleet_step.js';
import { stepFlowLinks } from './assets/sim/flow_step.js';
import { CAMPAIGN_LEVELS } from './assets/campaign/levels.js';
import { buildDailyChallenge, dailyChallengeKey } from './assets/campaign/daily_challenge.js';
import { describeCampaignObjectives, evaluateCampaignObjectives } from './assets/campaign/objectives.js';
import { buildCustomMapExport, normalizeCustomMapConfig } from './assets/sim/custom_map.js';
import { resolveMatchEndState } from './assets/sim/end_state.js';
import { renderLeaderboardUI, renderMissionPanel, renderRoomListUI, renderStatRows } from './assets/ui/renderers.js';

// Ã¢â€â‚¬Ã¢â€â‚¬ CONSTANTS Ã¢â€â‚¬Ã¢â€â‚¬
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
    TRAIL_LEN = 12, MAX_ORBITERS = 72, ORBIT_SPD = 0.018, ORBIT_UNIT_STEP = 3, ORBIT_MAX_RINGS = 5,
    NODE_LEVEL_MAX = 3,
    DDA_MAX_BOOST = 0.2,
    WORMHOLE_SPEED_MULT = 2.0,
    GRAVITY_RADIUS = 170,
    GRAVITY_SPEED_MULT = 1.35,
    SUPPLY_DIST = 220,
    ISOLATED_PROD_PENALTY = 0.6,
    DEFENSE_PROD_PENALTY = 0.75,
    DEFENSE_BONUS = 1.25,
    ASSIM_BASE_RATE = 0.0012,
    ASSIM_UNIT_BONUS = 0.00014,
    ASSIM_GARRISON_FLOOR = 0.35,
    ASSIM_LEVEL_RESIST = 0.35,
    ASSIM_LOCK_TICKS = 180,
    TURRET_RANGE = 220,
    TURRET_DPS = 16,
    TURRET_MIN_GARRISON = 8,
    TURRET_CAPTURE_RESIST = 1.35,
    DEFENSE_FIELD_RANGE_PAD = 24,
    DEFENSE_FIELD_LEVEL_RANGE = 4,
    DEFENSE_FIELD_DPS = 2.6,
    DEFENSE_FIELD_LEVEL_DPS = 0.3,
    DEFENSE_FIELD_DEFENSE_BONUS = 1.25,
    DEFENSE_FIELD_BULWARK_BONUS = 1.18,
    DEFENSE_FIELD_RELAY_RANGE = 6,
    STRATEGIC_PULSE_CYCLE = 540,
    STRATEGIC_PULSE_ACTIVE = 300,
    STRATEGIC_PULSE_PROD = 1.35,
    STRATEGIC_PULSE_SPEED = 1.18,
    STRATEGIC_PULSE_ASSIM = 1.3,
    STRATEGIC_PULSE_CAP = 18,
    STRATEGIC_PULSE_AI_BONUS = 52,
    CAP_SOFT_START = 0.82,
    CAP_SOFT_FLOOR = 0.28,
    DEFENSE_ASSIM_BONUS = 1.18,
    SUPPLIED_UPGRADE_DISCOUNT = 0.94;
var SYNC_HASH_INTERVAL_TICKS = 90, TICK_RATE = Math.round(1 / TICK_DT);

var NODE_TYPE_DEFS = {
    core: { label: 'Core', prod: 1.0, def: 1.0, cap: 1.0, flow: 1.0, speed: 1.0, color: '#8db3ff' },
    forge: { label: 'Forge', prod: 1.35, def: 0.9, cap: 0.9, flow: 1.1, speed: 1.0, color: '#ffad66' },
    bulwark: { label: 'Bulwark', prod: 0.75, def: 1.45, cap: 1.25, flow: 0.9, speed: 0.95, color: '#b6c1d9' },
    relay: { label: 'Relay', prod: 0.95, def: 0.95, cap: 0.85, flow: 1.35, speed: 1.35, color: '#7de3ff' },
    nexus: { label: 'Nexus', prod: 1.1, def: 1.1, cap: 1.1, flow: 1.15, speed: 1.1, color: '#c9a0dc' },
    turret: { label: 'Turret', prod: 0.0, def: 2.25, cap: 0.8, flow: 0.8, speed: 1.0, color: '#8ff0ff' },
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

// Ã¢â€â‚¬Ã¢â€â‚¬ STARS (background) Ã¢â€â‚¬Ã¢â€â‚¬
var stars = []; for (var i = 0; i < 300; i++)stars.push({ x: Math.random() * MAP_W * 1.5 - MAP_W * 0.25, y: Math.random() * MAP_H * 1.5 - MAP_H * 0.25, r: Math.random() * 1.5 + 0.3, b: Math.random() * 0.5 + 0.3 });

// Ã¢â€â‚¬Ã¢â€â‚¬ SEEDED RNG Ã¢â€â‚¬Ã¢â€â‚¬
function RNG(s) { this.s = s | 0; if (!this.s) this.s = 1; }
RNG.prototype.next = function () { var t = this.s += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
RNG.prototype.nextInt = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
RNG.prototype.nextFloat = function (a, b) { return a + this.next() * (b - a); };
function hashSeed(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h) || 1; }

var planetTexCache = {};
function buildPermTable(rnd) { var p = new Uint8Array(512); for (var i = 0; i < 256; i++) p[i] = i; for (var i = 0; i < 255; i++) { var j = i + ~~(rnd() * (256 - i)), t = p[i]; p[i] = p[j]; p[j] = t; } for (var i = 256; i < 512; i++) p[i] = p[i - 256]; return p; }
var grad2 = new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);
function createNoise2D(rnd) { rnd = rnd || Math.random; var perm = buildPermTable(rnd), gx = new Float64Array(perm).map(function(v){return grad2[(v%12)*2];}), gy = new Float64Array(perm).map(function(v){return grad2[(v%12)*2+1];}); var F2=0.5*(Math.sqrt(3)-1), G2=(3-Math.sqrt(3))/6; return function(x,y){ var s=(x+y)*F2, i=Math.floor(x+s)|0, j=Math.floor(y+s)|0, t=(i+j)*G2, X0=i-t, Y0=j-t, x0=x-X0, y0=y-Y0; var i1,j1; x0>y0?(i1=1,j1=0):(i1=0,j1=1); var x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2; var ii=i&255, jj=j&255; var n0=0,n1=0,n2=0; var t0=0.5-x0*x0-y0*y0; if(t0>=0){var gi=ii+perm[jj]; t0*=t0; n0=t0*t0*(gx[gi]*x0+gy[gi]*y0);} var t1=0.5-x1*x1-y1*y1; if(t1>=0){var gi=ii+i1+perm[jj+j1]; t1*=t1; n1=t1*t1*(gx[gi]*x1+gy[gi]*y1);} var t2=0.5-x2*x2-y2*y2; if(t2>=0){var gi=ii+1+perm[jj+1]; t2*=t2; n2=t2*t2*(gx[gi]*x2+gy[gi]*y2);} return 70*(n0+n1+n2); }; }
function createSeededNoise(seed) { var rng = new RNG(seed); return createNoise2D(function () { return rng.next(); }); }
function fbm(noise2D, x, y, octaves, persistence) { octaves = octaves || 4; persistence = persistence || 0.5; var total = 0, freq = 1, amp = 1, maxV = 0; for (var i = 0; i < octaves; i++) { total += noise2D(x * freq, y * freq) * amp; maxV += amp; amp *= persistence; freq *= 2; } return total / maxV; }
function getPlanetTexture(id, radius) {
    if (planetTexCache[id]) return planetTexCache[id];
    var scale = 2, size = radius * 2 * scale, r = radius * scale, cx = r, cy = r;
    var canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return canvas;
    var rng = new RNG(id * 9999), type = rng.nextInt(0, 3);
    var noise2D = createSeededNoise(id * 12345), noiseDetail = createSeededNoise(id * 67890);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
    var baseScale = 0.015, detailScale = 0.08;
    var imgData = ctx.createImageData(size, size), data = imgData.data;
    for (var py = 0; py < size; py++) for (var px = 0; px < size; px++) {
        var dx = (px - cx) / r, dy = (py - cy) / r, distSq = dx * dx + dy * dy;
        if (distSq > 1) continue;
        var dist = Math.sqrt(distSq), angle = Math.atan2(dy, dx);
        var nx = Math.cos(angle) * (1 - dist), ny = Math.sin(angle) * (1 - dist), u = nx * 3, v = ny * 3;
        var baseNoise = fbm(noise2D, u * baseScale, v * baseScale, 4, 0.5), detailNoise = noiseDetail(u * detailScale, v * detailScale);
        var rv = 0, gv = 0, bv = 0, av = 255;
        if (type === 0) {
            var landThresh = 0.15;
            if (baseNoise > landThresh) { var lv = (detailNoise + 1) * 0.5; rv = Math.floor(45 + (0.2 + (1 - lv) * 0.5) * 80); gv = Math.floor(90 + (0.3 + lv * 0.4) * 60); bv = Math.floor(40 + lv * 30); }
            else { var depth = (landThresh - baseNoise) / landThresh; rv = Math.floor(10 + depth * 35); gv = Math.floor(22 + depth * 75); bv = Math.floor(40 + depth * 120); }
        } else if (type === 1) { var t = (baseNoise + 1) * 0.5, dust = (detailNoise + 1) * 0.5; rv = Math.floor(92 + t * 80 + dust * 40); gv = Math.floor(35 + t * 50 + dust * 30); bv = Math.floor(28 + t * 25); }
        else if (type === 2) { var cn = fbm(noise2D, u * 0.04, v * 0.04, 3, 0.6), crater = Math.pow(Math.max(0, -cn), 2), base = 42 + (baseNoise + 1) * 25; rv = gv = bv = Math.floor(Math.max(26, base * (1 - crater * 0.8))); }
        else { var t = (baseNoise + 1) * 0.5; rv = Math.floor(26 + t * 60); gv = Math.floor(60 + t * 80); bv = Math.floor(90 + t * 70); }
        var idx = (py * size + px) * 4; data[idx] = Math.min(255, Math.max(0, rv)); data[idx + 1] = Math.min(255, Math.max(0, gv)); data[idx + 2] = Math.min(255, Math.max(0, bv)); data[idx + 3] = av;
    }
    ctx.putImageData(imgData, 0, 0);
    if (type === 2) { ctx.globalCompositeOperation = 'multiply'; for (var i = 0; i < rng.nextInt(12, 25); i++) { var fx = cx + rng.nextFloat(-r * 0.85, r * 0.85), fy = cy + rng.nextFloat(-r * 0.85, r * 0.85), fr = rng.nextFloat(r * 0.05, r * 0.25); if ((fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) > (r - fr) * (r - fr)) continue; var grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr); grad.addColorStop(0, 'rgba(20,20,20,0.9)'); grad.addColorStop(0.5, 'rgba(50,50,50,0.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
    if (type !== 2) { for (var i = 0; i < rng.nextInt(12, 28); i++) { var fx = cx + rng.nextFloat(-r * 0.85, r * 0.85), fy = cy + rng.nextFloat(-r * 0.85, r * 0.85), fr = rng.nextFloat(r * 0.15, r * 0.5); if ((fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) > (r - fr) * (r - fr)) continue; var ca = type === 0 ? 0.55 : (type === 1 ? 0.12 : 0.3), grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr); grad.addColorStop(0, 'rgba(255,255,255,' + ca + ')'); grad.addColorStop(0.6, 'rgba(255,255,255,' + ca * 0.4 + ')'); grad.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(fx, fy, fr, fr * 0.6, rng.nextFloat(0, Math.PI), 0, Math.PI * 2); ctx.fill(); } }
    var sg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0.8)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    var sp = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.45, 0, cx - r * 0.45, cy - r * 0.45, r * 0.55); sp.addColorStop(0, 'rgba(255,255,255,0.45)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.15)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sp; ctx.fill();
    if (type !== 2) { var ac = { 0: 'rgba(100,180,255,', 1: 'rgba(255,140,60,', 3: 'rgba(180,120,255,' }[type] || 'rgba(150,150,200,'; var ag = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r); ag.addColorStop(0, ac + '0)'); ag.addColorStop(0.8, ac + '0.2)'); ag.addColorStop(1, ac + '0.55)'); ctx.fillStyle = ag; ctx.fill(); ctx.strokeStyle = ac + '0.85)'; ctx.lineWidth = 1.5 * scale; ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(120,120,120,0.7)'; ctx.lineWidth = 1 * scale; ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); planetTexCache[id] = canvas; return canvas;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ VECTOR Ã¢â€â‚¬Ã¢â€â‚¬
function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function hashMix(a, b, c, d) {
    var h = ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761)) >>> 0;
    return (h % 1000000) / 1000000;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ BEZIER Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ FLEET POOL (with trail + lateral offset for swarm) Ã¢â€â‚¬Ã¢â€â‚¬
function mkFleet() {
    return {
        active: false, owner: -1, count: 0, srcId: -1, tgtId: -1, t: 0, speed: 0, arcLen: 1, cpx: 0, cpy: 0, x: 0, y: 0,
        trail: [], offsetL: 0, spdVar: 1, routeSpeedMult: 1, dmgAcc: 0, launchT: 0
    };
}  // trail: array of {x,y}, offsetL: perpendicular spread, spdVar: speed variation
var pool = [];
for (var i = 0; i < POOL_SZ; i++)pool.push(mkFleet());
function acquireFleet() { for (var i = 0; i < pool.length; i++) { if (!pool[i].active) return pool[i]; } var f = mkFleet(); pool.push(f); return f; }

// Ã¢â€â‚¬Ã¢â€â‚¬ GAME STATE Ã¢â€â‚¬Ã¢â€â‚¬
var G = {
    state: 'mainMenu', winner: -1, tick: 0, speed: 1, rng: null, seed: 42, diff: 'normal',
    rulesMode: 'advanced', rules: getRulesetConfig('advanced'),
    nodes: [], fleets: [], flows: [], players: [], human: 0, fog: null,
    cam: { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 },
    diffCfg: DIFFICULTY_PRESETS.normal,
    tune: { prod: 1, fspeed: FLEET_SPEED, def: DEF_FACTOR, flowInt: 15, aiAgg: AI_AGG, aiBuf: AI_BUF, aiInt: AI_INTERVAL, fogEnabled: false, aiAssist: true },
    rec: { events: [], seed: 0, nc: 0, diff: 'normal' },
    rep: null, aiTicks: [], flowId: 0, fleetSerial: 0,
    aiProfiles: [], mapFeature: { type: 'none' }, wormholes: [],
    stats: { nodesCaptured: 0, fleetsSent: 0, upgrades: 0, unitsProduced: 0 },
    particles: [], turretBeams: [], fieldBeams: [], mapMode: 'random',
    playerCapital: {}, strategicNodes: [],
    strategicPulse: { active: false, nodeId: -1, cycle: 0, phase: 0, remainingTicks: 0, announcedCycle: -1 },
    powerByPlayer: {}, capByPlayer: {}, unitByPlayer: {},
    campaign: { active: false, levelIndex: -1, unlocked: 1, completed: 0, reminderShown: {} },
    daily: { active: false, challenge: null, reminderShown: {}, bestTick: 0, completed: false },
};
var ACHIEVEMENTS = [
    { id: 'first_win', name: 'Ilk Zafer', check: function () { return G.winner === G.human; } },
    { id: 'capture_10', name: '10 Gezegen Fethet', check: function () { return G.stats.nodesCaptured >= 10; } },
    { id: 'upgrade_master', name: 'Upgrade Ustasi', check: function () { return G.stats.upgrades >= 5; } },
    { id: 'fleet_lord', name: 'Filo Komutani', check: function () { return G.stats.fleetsSent >= 50; } },
    { id: 'fast_win', name: 'Hizli Zafer', check: function () { return G.winner === G.human && G.tick < 500; } },
];
function checkAchievements() {
    try {
        var unlocked = JSON.parse(localStorage.getItem('stellar_achievements') || '[]');
        for (var i = 0; i < ACHIEVEMENTS.length; i++) {
            var a = ACHIEVEMENTS[i];
            if (unlocked.indexOf(a.id) >= 0) continue;
            if (a.check()) {
                unlocked.push(a.id);
                localStorage.setItem('stellar_achievements', JSON.stringify(unlocked));
                if (typeof AudioFX !== 'undefined') AudioFX.achievement();
                var toast = document.createElement('div');
                toast.className = 'achievement-toast';
                toast.textContent = 'Basarim: ' + a.name;
                document.body.appendChild(toast);
                setTimeout(function () { toast.remove(); }, 3000);
            }
        }
    } catch (e) {}
}
function defaultTune() { return { prod: 1, fspeed: FLEET_SPEED, def: DEF_FACTOR, flowInt: 15, aiAgg: AI_AGG, aiBuf: AI_BUF, aiInt: AI_INTERVAL, fogEnabled: false, aiAssist: true }; }
var gameToastTimer = 0;
function showGameToast(message) {
    if (!message) return;
    var toast = document.getElementById('gameToastMsg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gameToastMsg';
        toast.className = 'achievement-toast';
        toast.style.bottom = '92px';
        toast.style.padding = '8px 16px';
        toast.style.fontSize = '0.86rem';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    if (gameToastTimer) clearTimeout(gameToastTimer);
    gameToastTimer = setTimeout(function () {
        toast.style.display = 'none';
    }, 1200);
}

var net = {
    socket: null,
    connected: false,
    online: false,
    authoritativeEnabled: false,
    authoritativeReady: false,
    roomCode: '',
    players: [],
    isHost: false,
    playerName: '',
    pendingJoin: false,
    localPlayerIndex: 0,
    pendingCommands: [],
    matchId: '',
    lastAppliedSeq: -1,
    syncHashSentTick: -1,
    syncWarningTick: -99999,
    syncWarningText: '',
    syncHistory: [],
    commandHistory: [],
    resyncRequestId: '',
    lastSummaryTick: -1,
    lastPingWallMs: 0,
    reconnectToken: '',
    resumePending: false,
};

// Ã¢â€â‚¬Ã¢â€â‚¬ FOG Ã¢â€â‚¬Ã¢â€â‚¬
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
function applyRulesetNodeKinds() {
    if (!G.rules || !G.rules.simplifyNodeKinds) return;
    for (var i = 0; i < G.nodes.length; i++) {
        var node = G.nodes[i];
        node.kind = normalizeNodeKindForRuleset(node.kind, G.rulesMode);
        node.maxUnits = nodeCapacity(node);
        if (node.units > node.maxUnits) node.units = node.maxUnits;
    }
}
function isNodeAssimilated(node) {
    if (!node) return false;
    if ((node.assimilationLock || 0) > 0) return false;
    return node.assimilationProgress === undefined || node.assimilationProgress >= 1;
}
function preferredCameraNodeForPlayer(playerIndex) {
    var preferredId = G.playerCapital && G.playerCapital[playerIndex] !== undefined ? Number(G.playerCapital[playerIndex]) : -1;
    if (isFinite(preferredId) && preferredId >= 0 && G.nodes[preferredId] && G.nodes[preferredId].owner === playerIndex) {
        return G.nodes[preferredId];
    }
    for (var i = 0; i < G.nodes.length; i++) {
        if (G.nodes[i] && G.nodes[i].owner === playerIndex) return G.nodes[i];
    }
    return G.nodes[0] || null;
}
function upgradeCost(node) {
    var cost = 18 + node.radius * 0.85 + (node.level - 1) * 14;
    if (node.kind === 'relay') cost *= 0.92;
    else if (node.kind === 'forge') cost *= 0.95;
    else if (node.kind === 'bulwark') cost *= 1.08;
    else if (node.kind === 'turret') cost *= 1.12;
    if (node.supplied === true) cost *= SUPPLIED_UPGRADE_DISCOUNT;
    return Math.max(10, Math.floor(cost));
}
function initNodeKind(node) {
    var roll = G.rng.next();
    if (roll < 0.18) node.kind = 'forge';
    else if (roll < 0.36) node.kind = 'bulwark';
    else if (roll < 0.52) node.kind = 'relay';
    else if (roll < 0.65) node.kind = 'nexus';
    else node.kind = 'core';
    node.level = 1;
    node.maxUnits = nodeCapacity(node);
}
function nodePowerValue(node) {
    return node.units + node.maxUnits * 0.06 + node.level * 6;
}
function spawnAnchors(playerCount) {
    playerCount = Math.max(1, Math.floor(playerCount || 1));
    var anchors = [];
    var cx = MAP_W * 0.5, cy = MAP_H * 0.5;
    var rx = MAP_W * 0.5 - MAP_PAD;
    var ry = MAP_H * 0.5 - MAP_PAD;
    var startAngle = -Math.PI * 0.75;
    for (var i = 0; i < playerCount; i++) {
        var ang = startAngle + (Math.PI * 2 * i) / playerCount;
        anchors.push({ x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry });
    }
    return anchors;
}
function getPlayerCapital(pi) {
    return getPlayerCapitalId({
        playerIndex: pi,
        playerCapital: G.playerCapital,
        nodes: G.nodes,
        anchorPositions: spawnAnchors(G.players.length),
        isNodeAssimilated: isNodeAssimilated,
        distanceFn: dist,
    });
}
function computeSupplyConnected(pi) {
    return computeSupplyConnectedState({
        playerIndex: pi,
        playerCapital: G.playerCapital,
        nodes: G.nodes,
        anchorPositions: spawnAnchors(G.players.length),
        isNodeAssimilated: isNodeAssimilated,
        distanceFn: dist,
        maxLinkDist: SUPPLY_DIST,
    });
}
function computePowerByPlayer() {
    return computePowerByPlayerState({
        players: G.players,
        nodes: G.nodes,
        fleets: G.fleets,
        nodePowerValue: nodePowerValue,
    });
}
function pickAIProfile(aiIndex) {
    return AI_ARCHETYPES[(aiIndex - 1) % AI_ARCHETYPES.length];
}
function difficultyConfig(diff) {
    return DIFFICULTY_PRESETS[diff] || DIFFICULTY_PRESETS.normal;
}
function currentStrategicPulse(tick) {
    return getStrategicPulseState({
        strategicNodeIds: G.strategicNodes,
        tick: tick,
        seed: G.seed,
        cycleTicks: STRATEGIC_PULSE_CYCLE,
        activeTicks: STRATEGIC_PULSE_ACTIVE,
    });
}
function strategicPulseAppliesToNode(nodeId) {
    return isStrategicPulseActiveForNode(nodeId, G.strategicPulse);
}
function strategicPulseToast() {
    if (G.state !== 'playing' || !G.strategicPulse.active) return;
    if (G.strategicPulse.announcedCycle === G.strategicPulse.cycle) return;
    G.strategicPulse.announcedCycle = G.strategicPulse.cycle;
    showGameToast('Strategic pulse aktif: PULSE hubi +35% uretim, +18% filo hizi, +30% asimilasyon ve +18 cap verir.');
}
function isLinkedWormhole(srcId, tgtId) {
    for (var i = 0; i < G.wormholes.length; i++) {
        var w = G.wormholes[i];
        if ((w.a === srcId && w.b === tgtId) || (w.b === srcId && w.a === tgtId)) return true;
    }
    return false;
}
function placeWormholeFeature() {
    // Wormhole pair: farthest neutral-ish pair, inspired by constellation shortcuts.
    var bestA = -1, bestB = -1, bestD = -1;
    for (var i = 0; i < G.nodes.length; i++) {
        for (var j = i + 1; j < G.nodes.length; j++) {
            var a = G.nodes[i], b = G.nodes[j];
            if (a.owner !== -1 || b.owner !== -1 || a.kind === 'turret' || b.kind === 'turret') continue;
            var d = dist(a.pos, b.pos);
            if (d > bestD) { bestD = d; bestA = a.id; bestB = b.id; }
        }
    }
    if (bestA < 0) return false;
    G.wormholes.push({ a: bestA, b: bestB });
    G.nodes[bestA].kind = 'relay';
    G.nodes[bestB].kind = 'relay';
    G.nodes[bestA].maxUnits = nodeCapacity(G.nodes[bestA]);
    G.nodes[bestB].maxUnits = nodeCapacity(G.nodes[bestB]);
    G.mapFeature = { type: 'wormhole', a: bestA, b: bestB };
    return true;
}
function placeGravityFeature() {
    // Gravity sling: single anomaly around a central neutral node.
    var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
    var bestNode = null, bestCenterDist = Infinity;
    for (var n = 0; n < G.nodes.length; n++) {
        var node = G.nodes[n];
        if (node.owner !== -1 || node.kind === 'turret') continue;
        var cd = dist(node.pos, center);
        if (cd < bestCenterDist) { bestCenterDist = cd; bestNode = node; }
    }
    if (!bestNode) return false;
    G.mapFeature = { type: 'gravity', nodeId: bestNode.id, x: bestNode.pos.x, y: bestNode.pos.y, r: GRAVITY_RADIUS };
    bestNode.kind = 'core';
    bestNode.maxUnits = nodeCapacity(bestNode);
    if (bestNode.units > bestNode.maxUnits) bestNode.units = bestNode.maxUnits;
    return true;
}
function placeBarrierFeature() {
    var barrierX = MAP_W * 0.5;
    var candidates = [];
    for (var i = 0; i < G.nodes.length; i++) {
        var node = G.nodes[i];
        if (node.owner !== -1) continue;
        candidates.push(node);
    }
    if (!candidates.length) return false;

    candidates.sort(function (a, b) {
        var ad = Math.abs(a.pos.x - barrierX);
        var bd = Math.abs(b.pos.x - barrierX);
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });

    var targetGateCount = candidates.length > 12 && G.rng.next() < 0.55 ? 2 : 1;
    var gateIds = selectBarrierGateIds({
        nodes: G.nodes,
        barrierX: barrierX,
        targetGateCount: targetGateCount,
        minVerticalGap: 120,
    });
    if (!gateIds.length) return false;

    for (var ni = 0; ni < G.nodes.length; ni++) G.nodes[ni].gate = false;
    for (var g = 0; g < gateIds.length; g++) {
        var gate = G.nodes[gateIds[g]];
        if (gate.kind === 'turret') {
            gate.kind = normalizeNodeKindForRuleset('core', G.rulesMode);
            gate.level = 1;
        }
        gate.gate = true;
        gate.assimilationProgress = 1;
        gate.assimilationLock = 0;
        gate.maxUnits = nodeCapacity(gate);
        if (gate.units > gate.maxUnits) gate.units = gate.maxUnits;
    }
    G.mapFeature = { type: 'barrier', x: barrierX, gateIds: gateIds.slice() };
    return true;
}
function applyMapFeature(cfg) {
    cfg = cfg || {};
    G.wormholes = [];
    for (var ni = 0; ni < G.nodes.length; ni++) G.nodes[ni].gate = false;
    G.mapFeature = { type: 'none' };
    if (G.nodes.length < 8) return;
    var forcedType = cfg.type || 'auto';
    if (forcedType === 'none') return;
    if (forcedType === 'wormhole') { placeWormholeFeature(); return; }
    if (forcedType === 'gravity') { placeGravityFeature(); return; }
    if (forcedType === 'barrier') { placeBarrierFeature(); return; }

    var featureChance = typeof cfg.chance === 'number' ? clamp(cfg.chance, 0, 1) : G.diffCfg.featureChance;
    if (G.rng.next() > featureChance) return;

    var featureRoll = G.rng.next();
    if (featureRoll < 0.34) {
        if (!placeWormholeFeature()) {
            if (!placeGravityFeature()) placeBarrierFeature();
        }
    } else if (featureRoll < 0.68) {
        if (!placeGravityFeature()) {
            if (!placeBarrierFeature()) placeWormholeFeature();
        }
    } else {
        if (!placeBarrierFeature()) {
            if (!placeWormholeFeature()) placeGravityFeature();
        }
    }
}

function applyCustomMapDefinition(customMap) {
    customMap = normalizeCustomMapConfig(customMap || {});
    G.nodes = [];
    G.wormholes = [];
    G.mapFeature = customMap.mapFeature || { type: 'none' };
    G.mapMode = 'custom';

    for (var i = 0; i < customMap.nodes.length; i++) {
        var rawNode = customMap.nodes[i];
        var node = {
            id: i,
            pos: { x: rawNode.pos.x, y: rawNode.pos.y },
            radius: rawNode.radius,
            owner: rawNode.owner,
            units: rawNode.units,
            prodAcc: rawNode.prodAcc || 0,
            maxUnits: MAX_UNITS,
            visionR: VISION_R + rawNode.radius * 2,
            selected: false,
            kind: rawNode.kind,
            level: rawNode.level,
            defense: rawNode.defense === true,
            strategic: rawNode.strategic === true,
            gate: rawNode.gate === true,
            assimilationProgress: rawNode.assimilationProgress,
            assimilationLock: rawNode.assimilationLock,
        };
        node.maxUnits = nodeCapacity(node);
        node.units = clamp(node.units, 0, node.maxUnits);
        if (node.owner >= 0 && node.units < 1) node.units = 1;
        G.nodes.push(node);
    }

    G.wormholes = Array.isArray(customMap.wormholes) ? customMap.wormholes.map(function (pair) {
        return { a: pair.a, b: pair.b };
    }) : [];

    G.strategicNodes = [];
    var strategicSet = {};
    var strategicIds = Array.isArray(customMap.strategicNodes) ? customMap.strategicNodes : [];
    for (var si = 0; si < strategicIds.length; si++) strategicSet[strategicIds[si]] = true;
    for (var ni = 0; ni < G.nodes.length; ni++) {
        G.nodes[ni].strategic = !!strategicSet[G.nodes[ni].id];
        if (G.nodes[ni].strategic) G.strategicNodes.push(G.nodes[ni].id);
    }

    if (G.mapFeature.type === 'barrier') {
        var gateSet = {};
        var gateIds = Array.isArray(G.mapFeature.gateIds) ? G.mapFeature.gateIds.slice() : [];
        G.mapFeature.gateIds = gateIds;
        for (var gi = 0; gi < gateIds.length; gi++) gateSet[gateIds[gi]] = true;
        for (var bi = 0; bi < G.nodes.length; bi++) G.nodes[bi].gate = !!gateSet[G.nodes[bi].id];
    } else {
        for (var ng = 0; ng < G.nodes.length; ng++) G.nodes[ng].gate = false;
    }

    if (G.mapFeature.type === 'gravity' && G.mapFeature.nodeId >= 0 && G.nodes[G.mapFeature.nodeId]) {
        G.mapFeature.x = G.nodes[G.mapFeature.nodeId].pos.x;
        G.mapFeature.y = G.nodes[G.mapFeature.nodeId].pos.y;
    }

    G.playerCapital = {};
    for (var p = 0; p < G.players.length; p++) {
        var capitalId = customMap.playerCapital && customMap.playerCapital[p] !== undefined ? Number(customMap.playerCapital[p]) : -1;
        if (!isFinite(capitalId) || !G.nodes[capitalId] || G.nodes[capitalId].owner !== p) capitalId = -1;
        if (capitalId < 0) {
            for (var ci = 0; ci < G.nodes.length; ci++) {
                if (G.nodes[ci].owner === p) { capitalId = G.nodes[ci].id; break; }
            }
        }
        if (capitalId >= 0) G.playerCapital[p] = capitalId;
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ INIT GAME Ã¢â€â‚¬Ã¢â€â‚¬
function initGame(seedStr, nc, diff, opts) {
    opts = opts || {};
    var keepReplay = !!opts.keepReplay;
    var keepTuning = !!opts.keepTuning;
    var menuFog = typeof opts.fogEnabled === 'boolean' ? opts.fogEnabled : null;
    var rulesMode = normalizeRulesetMode(opts.rulesMode || 'advanced');
    var mapFeatureCfg = null;
    var customMapCfg = opts.customMap ? normalizeCustomMapConfig(opts.customMap) : null;
    if (typeof opts.mapFeature === 'string') mapFeatureCfg = { type: opts.mapFeature };
    else if (opts.mapFeature && typeof opts.mapFeature === 'object') mapFeatureCfg = opts.mapFeature;
    G.seed = (isNaN(Number(seedStr)) ? hashSeed(seedStr) : Number(seedStr)) || 42;
    G.diff = diff;
    G.rng = new RNG(G.seed);
    G.tick = 0;
    G.speed = 1;
    G.winner = -1;
    G.diffCfg = difficultyConfig(diff);
    G.rulesMode = rulesMode;
    G.rules = getRulesetConfig(rulesMode);
    if (!keepTuning) {
        G.tune = defaultTune();
        G.tune.aiAgg = G.diffCfg.aiAggBase;
        G.tune.aiBuf = G.diffCfg.aiBuffer;
        G.tune.aiInt = G.diffCfg.aiInterval;
        G.tune.flowInt = G.diffCfg.flowInterval;
        G.tune.aiAssist = G.diffCfg.adaptiveAI;
    }
    if (menuFog !== null) G.tune.fogEnabled = menuFog;
    if (opts.tuneOverrides && typeof opts.tuneOverrides === 'object') {
        var ovr = opts.tuneOverrides;
        if (typeof ovr.prod === 'number') G.tune.prod = ovr.prod;
        if (typeof ovr.fspeed === 'number') G.tune.fspeed = ovr.fspeed;
        if (typeof ovr.def === 'number') G.tune.def = ovr.def;
        if (typeof ovr.flowInt === 'number') G.tune.flowInt = Math.max(1, Math.floor(ovr.flowInt));
        if (typeof ovr.aiAgg === 'number') G.tune.aiAgg = ovr.aiAgg;
        if (typeof ovr.aiBuf === 'number') G.tune.aiBuf = Math.max(0, Math.floor(ovr.aiBuf));
        if (typeof ovr.aiInt === 'number') G.tune.aiInt = Math.max(1, Math.floor(ovr.aiInt));
        if (typeof ovr.aiAssist === 'boolean') G.tune.aiAssist = ovr.aiAssist;
        if (typeof ovr.fogEnabled === 'boolean') G.tune.fogEnabled = ovr.fogEnabled;
    }
    G.flowId = 0;
    G.fleetSerial = 0;
    G.stats = {
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
    };
    G.particles = [];
    G.turretBeams = [];
    G.fieldBeams = [];
    for (var i = 0; i < pool.length; i++) { pool[i].active = false; pool[i].trail = []; }
    G.fleets = [];
    G.flows = [];
    var aiDefault = diff === 'easy' ? 1 : diff === 'normal' ? 2 : 3;
    var humanCount = Math.max(1, Math.floor(Number(opts.humanCount || 1)));
    var aic = opts.aiCount !== undefined ? Math.max(0, Math.floor(Number(opts.aiCount))) : aiDefault;
    var totalPlayers = customMapCfg ? customMapCfg.playerCount : (humanCount + aic);
    G.players = [];
    for (var pi = 0; pi < totalPlayers; pi++) {
        G.players.push({ idx: pi, color: PLAYER_COLORS[pi % PLAYER_COLORS.length], isAI: pi >= humanCount, alive: true });
    }
    var localPlayerIndex = opts.localPlayerIndex !== undefined ? Number(opts.localPlayerIndex) : 0;
    G.human = clamp(Math.floor(localPlayerIndex), 0, totalPlayers - 1);
    G.aiTicks = [];
    G.aiProfiles = [];
    for (var ai = 0; ai < G.players.length; ai++) {
        G.aiTicks.push(0);
        if (G.players[ai].isAI) G.aiProfiles[ai] = pickAIProfile(ai);
    }
    if (customMapCfg) {
        applyCustomMapDefinition(customMapCfg);
    } else {
        G.mapMode = 'random';
        genMap(nc);
        applyMapFeature(mapFeatureCfg || {});
    }
    applyRulesetNodeKinds();
    G.fog = initFog(G.players.length, G.nodes.length);
    for (var p = 0; p < G.players.length; p++) updateVis(G.fog, p, G.nodes, 0);
    powerRenderKey = '';
    G.powerByPlayer = computePowerByPlayer();
    G.strategicPulse = currentStrategicPulse(0);
    G.strategicPulse.announcedCycle = -1;
    var pn = preferredCameraNodeForPlayer(G.human);
    if (pn) { G.cam.x = pn.pos.x; G.cam.y = pn.pos.y; } G.cam.zoom = 1;
    if (!keepReplay) G.rec = { events: [], seed: G.seed, nc: nc, diff: diff, rulesMode: G.rulesMode };
    if (!keepReplay) G.rep = null;
    G.state = keepReplay ? 'replay' : 'playing';
    G.campaign.reminderShown = {};
    G.daily.reminderShown = {};
    if (!keepReplay && G.mapFeature.type === 'barrier') showGameToast(barrierGatePromptText());
}
function genMap(nc) {
    G.nodes = []; var att = 0, placed = 0, minDist = NODE_MINDIST;
    while (placed < nc && att < 4500) {
        if (att === 1400 || att === 2800) minDist *= 0.9;
        var x = G.rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD), y = G.rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD), r = G.rng.nextFloat(NODE_RMIN, NODE_RMAX);
        var ok = true; for (var i = 0; i < G.nodes.length; i++)if (dist({ x: x, y: y }, G.nodes[i].pos) < minDist) { ok = false; break; }
        if (ok) {
            var node = { id: placed, pos: { x: x, y: y }, radius: r, owner: -1, units: G.rng.nextInt(2, NEUTRAL_MAX), prodAcc: 0, maxUnits: MAX_UNITS, visionR: VISION_R + r * 2, selected: false, kind: 'core', level: 1, defense: false, strategic: false, gate: false };
            initNodeKind(node);
            node.maxUnits = nodeCapacity(node);
            node.units = Math.min(node.units, Math.max(2, Math.floor(node.maxUnits * 0.4)));
            G.nodes.push(node); placed++;
        }
        att++;
    }
    while (placed < nc) {
        var fx = G.rng.nextFloat(MAP_PAD, MAP_W - MAP_PAD), fy = G.rng.nextFloat(MAP_PAD, MAP_H - MAP_PAD), fr = G.rng.nextFloat(NODE_RMIN, NODE_RMAX);
        var fn = { id: placed, pos: { x: fx, y: fy }, radius: fr, owner: -1, units: G.rng.nextInt(2, NEUTRAL_MAX), prodAcc: 0, maxUnits: MAX_UNITS, visionR: VISION_R + fr * 2, selected: false, kind: 'core', level: 1, defense: false, strategic: false, gate: false };
        initNodeKind(fn);
        fn.maxUnits = nodeCapacity(fn);
        fn.units = Math.min(fn.units, Math.max(2, Math.floor(fn.maxUnits * 0.4)));
        G.nodes.push(fn); placed++;
    }
    var corners = spawnAnchors(G.players.length);
    G.playerCapital = {};
    for (var p = 0; p < G.players.length; p++) {
        var c = corners[p % corners.length], best = null, bd = Infinity;
        for (var n = 0; n < G.nodes.length; n++) { var cand = G.nodes[n]; if (cand.owner !== -1) continue; var d = dist(cand.pos, c); if (d < bd) { bd = d; best = cand; } }
        if (best) {
            best.owner = p;
            best.assimilationProgress = 1;
            best.assimilationLock = 0;
            best.kind = 'core';
            best.level = 2;
            best.maxUnits = nodeCapacity(best);
            best.defense = false;
            var startBoost = p === 0 ? G.diffCfg.humanStartBoost : G.diffCfg.aiStartBoost;
            var baseUnits = p === 0 ? 20 : 18;
            best.units = Math.min(best.maxUnits - 2, Math.max(12, Math.floor(baseUnits * startBoost)));
            best.radius = Math.max(best.radius, 28);
            G.playerCapital[p] = best.id;
        }
    }
    for (var ni = 0; ni < G.nodes.length; ni++) {
        if (!G.nodes[ni].defense) G.nodes[ni].defense = false;
    }
    G.strategicNodes = [];
    var center = { x: MAP_W * 0.5, y: MAP_H * 0.5 };
    for (var si = 0; si < G.nodes.length; si++) {
        var nd = G.nodes[si];
        if (dist(nd.pos, center) < MAP_W * 0.35 && nd.owner === -1) {
            var neighborCount = 0;
            for (var sj = 0; sj < G.nodes.length; sj++) if (sj !== si && dist(G.nodes[sj].pos, nd.pos) < SUPPLY_DIST * 1.2) neighborCount++;
            if (neighborCount >= 3) { nd.strategic = true; G.strategicNodes.push(nd.id); }
        }
    }
    if (!G.strategicNodes.length) {
        var fallbackStrategic = null, fallbackDist = Infinity;
        for (var sf = 0; sf < G.nodes.length; sf++) {
            var fsn = G.nodes[sf];
            if (fsn.owner !== -1) continue;
            var fd = dist(fsn.pos, center);
            if (fd < fallbackDist) { fallbackDist = fd; fallbackStrategic = fsn; }
        }
        if (!fallbackStrategic) {
            for (var sf2 = 0; sf2 < G.nodes.length; sf2++) {
                var anyNode = G.nodes[sf2];
                var ad = dist(anyNode.pos, center);
                if (ad < fallbackDist) { fallbackDist = ad; fallbackStrategic = anyNode; }
            }
        }
        if (fallbackStrategic) {
            fallbackStrategic.strategic = true;
            G.strategicNodes.push(fallbackStrategic.id);
        }
    }

    var neutralNodes = [];
    for (var ni2 = 0; ni2 < G.nodes.length; ni2++) if (G.nodes[ni2].owner === -1) neutralNodes.push(G.nodes[ni2]);
    neutralNodes.sort(function (a, b) {
        var ad = Math.abs(a.pos.x - center.x), bd = Math.abs(b.pos.x - center.x);
        if (ad !== bd) return ad - bd;
        return a.id - b.id;
    });
    var turretCount = Math.min(neutralNodes.length, G.rng.nextInt(1, 3));
    for (var ti = 0; ti < turretCount; ti++) {
        var tn = neutralNodes[ti];
        tn.kind = 'turret';
        tn.level = 1;
        tn.maxUnits = nodeCapacity(tn);
        tn.units = Math.min(tn.maxUnits - 1, G.rng.nextInt(22, 34));
        tn.assimilationProgress = 1;
        tn.assimilationLock = 0;
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ DISPATCH Ã¢â€â‚¬Ã¢â€â‚¬
function dispatch(owner, srcIds, tgtId, pct) {
    pct = clamp(typeof pct === 'number' ? pct : 0.5, 0.05, 1);
    var tgt = G.nodes[tgtId]; if (!tgt) return;
    var didSend = false;
    var blockedByBarrier = false;
    var barrierCfg = G.mapFeature && G.mapFeature.type === 'barrier' ? G.mapFeature : null;
    var friendlyRoom = null;
    if (tgt.owner === owner) {
        var incomingFriendlyUnits = 0;
        for (var fi0 = 0; fi0 < G.fleets.length; fi0++) {
            var incomingFleet = G.fleets[fi0];
            if (!incomingFleet.active || incomingFleet.owner !== owner || incomingFleet.tgtId !== tgtId) continue;
            incomingFriendlyUnits += Math.max(0, Math.floor(incomingFleet.count) || 0);
        }
        friendlyRoom = computeFriendlyReinforcementRoom({
            targetUnits: tgt.units,
            targetMaxUnits: tgt.maxUnits,
            incomingUnits: incomingFriendlyUnits,
        });
    }
    for (var si = 0; si < srcIds.length; si++) {
        var src = G.nodes[srcIds[si]]; if (!src || src.owner !== owner) continue;
        if (!isDispatchAllowed({ src: src, tgt: tgt, barrier: barrierCfg, owner: owner, nodes: G.nodes })) {
            blockedByBarrier = true;
            continue;
        }
        var srcType = nodeTypeOf(src);
        var send = computeSendCount({ srcUnits: src.units, pct: pct, flowMult: srcType.flow });
        var cnt = send.sendCount;
        if (friendlyRoom !== null) {
            cnt = Math.min(cnt, friendlyRoom);
        }
        if (cnt <= 0) continue;
        if (cnt === send.sendCount) src.units = send.newSrcUnits;
        else src.units -= cnt;
        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= cnt;
        var hasWormholeLink = isLinkedWormhole(src.id, tgtId);
        var curv = hasWormholeLink ? 0.05 : BEZ_CURV;
        var cp = bezCP(src.pos, tgt.pos, curv);
        var routeQueue = 0;
        for (var fi = 0; fi < G.fleets.length; fi++) {
            var qf = G.fleets[fi];
            if (!qf.active) continue;
            if (qf.owner === owner && qf.srcId === src.id && qf.tgtId === tgtId) routeQueue++;
        }
        var launchDelay = Math.min(0.28, routeQueue * 0.03);
        var f = acquireFleet(); f.active = true; f.owner = owner; f.count = cnt; f.srcId = srcIds[si]; f.tgtId = tgtId;
        f.t = -launchDelay;
        f.speed = FLEET_SPEED;
        f.offsetL = 0;
        f.spdVar = 1;
        f.routeSpeedMult = srcType.speed * (hasWormholeLink ? WORMHOLE_SPEED_MULT : 1);
        if (isNodeAssimilated(src) && strategicPulseAppliesToNode(src.id)) {
            f.routeSpeedMult *= STRATEGIC_PULSE_SPEED;
        }
        f.cpx = cp.x; f.cpy = cp.y; f.arcLen = bezLen(src.pos, cp, tgt.pos);
        f.launchT = clamp((src.radius + 2) / Math.max(f.arcLen, 1), 0, 0.12);
        var launchPt = bezPt(src.pos, cp, tgt.pos, f.launchT);
        f.x = launchPt.x; f.y = launchPt.y;
        f.trail = [];
        f.dmgAcc = 0;
        G.fleets.push(f);
        if (owner === G.human && hasWormholeLink) G.stats.wormholeDispatches++;
    }
    if (didSend && owner === G.human) {
        G.stats.fleetsSent++;
        if (typeof AudioFX !== 'undefined') AudioFX.send();
    }
    if (blockedByBarrier && owner === G.human) {
        showGameToast('Gecit kilitli: ' + barrierGateObjectiveText() + ', sonra asimilasyon tamamlanana kadar bekle.');
    } else if (!didSend && friendlyRoom !== null && owner === G.human) {
        showGameToast('Hedef dolu: dost takviye sigmiyor. Birlik cikar veya baska hedefe yonlendir.');
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ COMBAT Ã¢â€â‚¬Ã¢â€â‚¬
function spawnParticles(x, y, count, color, isCapture) {
    for (var i = 0; i < count; i++) {
        var a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        var spd = 2 + Math.random() * 4;
        G.particles.push({ x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, col: color || '#fff', r: isCapture ? 3 : 1.5 });
    }
    if (G.particles.length > 120) G.particles = G.particles.slice(-100);
}

// Ã¢â€â‚¬Ã¢â€â‚¬ FLOW LINKS Ã¢â€â‚¬Ã¢â€â‚¬
function addFlow(owner, srcId, tgtId) {
    srcId = Math.floor(Number(srcId));
    tgtId = Math.floor(Number(tgtId));
    if (!isFinite(srcId) || !isFinite(tgtId) || srcId === tgtId) return;
    var srcNode = G.nodes[srcId], tgtNode = G.nodes[tgtId];
    if (!srcNode || !tgtNode) return;
    if (srcNode.owner !== owner) return;
    for (var i = 0; i < G.flows.length; i++) { var f = G.flows[i]; if (f.srcId === srcId && f.tgtId === tgtId && f.owner === owner) { f.active = !f.active; return; } }
    G.flows.push({ id: G.flowId++, srcId: srcId, tgtId: tgtId, owner: owner, tickAcc: 0, active: true });
    if (owner === G.human) G.stats.flowLinksCreated++;
}
function rmFlow(owner, srcId, tgtId) { G.flows = G.flows.filter(function (f) { return !(f.srcId === srcId && f.tgtId === tgtId && f.owner === owner); }); }
function toggleDefense(owner, nodeId) {
    var node = G.nodes[nodeId];
    if (!node || node.owner !== owner) return false;
    node.defense = !node.defense;
    if (owner === G.human && node.defense) G.stats.defenseActivations++;
    return true;
}
function upgradeNode(owner, nodeId) {
    if (!G.rules || !G.rules.allowUpgrade) return false;
    var node = G.nodes[nodeId];
    if (!node || node.owner !== owner || !isNodeAssimilated(node)) return false;
    if (node.level >= NODE_LEVEL_MAX) return false;
    var cost = upgradeCost(node);
    if (node.units < cost) return false;
    node.units -= cost;
    node.level++;
    node.maxUnits = nodeCapacity(node);
    if (node.units > node.maxUnits) node.units = node.maxUnits;
    if (owner === G.human) { G.stats.upgrades++; if (typeof AudioFX !== 'undefined') AudioFX.upgrade(); }
    return true;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ AI Ã¢â€â‚¬Ã¢â€â‚¬
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
    var barrierCfg = G.mapFeature && G.mapFeature.type === 'barrier' ? G.mapFeature : null;
    var ownsGate = false;
    if (barrierCfg && Array.isArray(barrierCfg.gateIds)) {
        for (var gi = 0; gi < barrierCfg.gateIds.length; gi++) {
            var gateNode = G.nodes[barrierCfg.gateIds[gi]];
            if (!gateNode || !gateNode.gate) continue;
            if (gateNode.owner !== pi) continue;
            if (!isNodeAssimilated(gateNode)) continue;
            ownsGate = true;
            break;
        }
    }
    var myUnits = (G.unitByPlayer && Number(G.unitByPlayer[pi])) || computePlayerUnitCount({ nodes: G.nodes, fleets: G.fleets, owner: pi });
    var myCap = (G.capByPlayer && Number(G.capByPlayer[pi])) || computeGlobalCap({
        nodes: G.nodes,
        owner: pi,
        baseCap: G.rules ? G.rules.baseCap : 180,
        capPerNodeFactor: G.rules ? G.rules.capPerNodeFactor : 42,
    });
    var capPressure = myCap > 0 ? myUnits / myCap : 0;
    if (capPressure > 0.85) reserve = Math.max(1, Math.floor(reserve * 0.72));
    function canDispatchAI(srcNode, tgtNode) {
        return isDispatchAllowed({ src: srcNode, tgt: tgtNode, barrier: barrierCfg, owner: pi, nodes: G.nodes });
    }

    var targets = [];
    for (var ni = 0; ni < G.nodes.length; ni++) {
        var n = G.nodes[ni];
        if (n.owner === pi) continue;
        if (useFog && !G.fog.vis[pi][n.id]) continue;
        var tu = useFog ? (G.fog.vis[pi][n.id] ? n.units : G.fog.ls[pi][n.id].units) : n.units;
        var tDef = nodeTypeOf(n).def * nodeLevelDefMult(n) * (n.owner >= 0 ? G.tune.def : 1);

        var bd = Infinity;
        var reachable = false;
        for (var oi = 0; oi < own.length; oi++) {
            if (!canDispatchAI(own[oi], n)) continue;
            var d = dist(own[oi].pos, n.pos);
            reachable = true;
            if (d < bd) bd = d;
        }
        if (!reachable) continue;

        var score = 0;
        score += Math.max(0, 520 - bd) * 0.45;
        score += Math.max(0, 55 - tu * tDef) * 2.1;
        score += n.radius * 0.75;
        if (n.owner === -1) score += 34;
        if (n.kind === 'forge') score += 20;
        if (n.kind === 'relay') score += 12;
        if (n.kind === 'turret') score -= 18;
        if (n.gate && n.owner !== pi) score += ownsGate ? 10 : 64;
        if (strategicPulseAppliesToNode(n.id)) score += STRATEGIC_PULSE_AI_BONUS;
        if (n.level > 1) score += (n.level - 1) * 11;
        if (capPressure > 0.9) score += Math.max(0, 44 - tu * tDef) * 0.6;
        score *= aggr;

        targets.push({ id: n.id, score: score, units: tu, effDef: tDef });
    }

    targets.sort(function (a, b) { return b.score - a.score; });
    var attackCount = myPower < humanPower ? 2 : 1;
    if (profile.name === 'Rusher') attackCount = Math.min(2, targets.length);
    if (capPressure > 0.9) attackCount += 1;
    attackCount = Math.min(attackCount, targets.length, G.diffCfg.maxAttackTargets);

    for (var ti = 0; ti < attackCount; ti++) {
        var t = targets[ti], tn = G.nodes[t.id], srcs = [], total = 0;
        var needed = t.units * t.effDef + 5 + tn.level * 3;
        if (tn.kind === 'turret') needed += 18;
        if (tn.gate && tn.owner !== pi && barrierCfg && !ownsGate) needed = Math.max(6, needed * 0.82);
        if (capPressure > 0.9) needed *= 0.93;
        var cands = own.filter(function (n) {
            if (n.units <= reserve + 1) return false;
            return canDispatchAI(n, tn);
        }).sort(function (a, b) { return dist(a.pos, tn.pos) - dist(b.pos, tn.pos); });
        for (var j = 0; j < cands.length && srcs.length < maxSources; j++) {
            var av = cands[j].units - reserve;
            if (av <= 0) continue;
            srcs.push(cands[j].id);
            total += av;
            if (total >= needed) break;
        }
        if (srcs.length === 0) continue;
        if (total < needed * 0.55 && tn.owner !== -1) continue;
        var pctMax = capPressure > 0.9 ? 0.9 : 0.75;
        var pct = clamp(needed / Math.max(total, 1), 0.3, pctMax);
        if (capPressure > 0.95) pct = Math.max(pct, 0.72);

        var flowGate = ((G.tick + tn.id * 3 + pi * 7) % 13) === 0;
        var shouldFlow = tn.owner !== -1 && tn.units > 12 && profile.flow > 0.75 && flowGate &&
            !G.flows.some(function (f) { return f.owner === pi && f.tgtId === tn.id && f.active; }) &&
            canDispatchAI(G.nodes[srcs[0]], tn);
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

    var defenseCmds = 0;
    for (var di = 0; di < own.length && defenseCmds < 2; di++) {
        var defNode = own[di];
        var pulseHold = strategicPulseAppliesToNode(defNode.id);
        var shouldFortify = !defNode.defense && (
            (!isNodeAssimilated(defNode) && defNode.units < defNode.maxUnits * 0.72) ||
            (pulseHold && defNode.units < defNode.maxUnits * 0.78) ||
            (defNode.gate && defNode.units < defNode.maxUnits * 0.62)
        );
        if (shouldFortify) {
            cmds.push({ type: 'toggleDefense', nodeId: defNode.id });
            defenseCmds++;
            continue;
        }
        var shouldReleaseDefense = defNode.defense &&
            isNodeAssimilated(defNode) &&
            !pulseHold &&
            !defNode.gate &&
            defNode.kind !== 'bulwark' &&
            defNode.units > defNode.maxUnits * 0.8;
        if (shouldReleaseDefense) {
            cmds.push({ type: 'toggleDefense', nodeId: defNode.id });
            defenseCmds++;
        }
    }

    for (var fi = 0; fi < G.flows.length; fi++) {
        var fl = G.flows[fi];
        if (fl.owner !== pi || !fl.active) continue;
        var flowTarget = G.nodes[fl.tgtId];
        if (!flowTarget || flowTarget.owner === pi) cmds.push({ type: 'rmFlow', srcId: fl.srcId, tgtId: fl.tgtId });
    }
    return cmds;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ REPLAY Ã¢â€â‚¬Ã¢â€â‚¬
function recEvt(type, data) { if (net.online) return; G.rec.events.push({ tick: G.tick, type: type, data: data || {} }); }
function applyPlayerCommand(playerIndex, type, data) {
    return applyPlayerCommandWithOps(playerIndex, type, data, {
        send: dispatch,
        flow: addFlow,
        rmFlow: rmFlow,
        upgrade: upgradeNode,
        toggleDefense: toggleDefense,
    });
}
function applyRep(evt) {
    var d = evt.data || {};
    var type = evt.type;
    if (type === 'sendPacket') type = 'send';
    else if (type === 'toggleFlow') type = 'flow';
    else if (type === 'removeFlow') type = 'rmFlow';
    else if (type === 'speedChange') type = 'speed';
    else if (type === 'upgradeNode') type = 'upgrade';
    else if (type === 'toggleDefense') { applyPlayerCommand(G.human, 'toggleDefense', d); return; }

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

// Ã¢â€â‚¬Ã¢â€â‚¬ TICK Ã¢â€â‚¬Ã¢â€â‚¬
function gameTick(runtimeOpts) {
    runtimeOpts = runtimeOpts || {};
    if (G.state !== 'playing' && G.state !== 'replay') return;

    // Lockstep determinism: Throttle simulation to stay synced with server ticks
    if (net.online) {
        if (!runtimeOpts.skipNetworkSync) {
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
        }

        if (net.pendingCommands.length > 0) {
            net.pendingCommands.sort(function (a, b) {
                var tickDelta = (a.tick || 0) - (b.tick || 0);
                if (tickDelta !== 0) return tickDelta;
                return (a.seq || 0) - (b.seq || 0);
            });
            var remaining = [];
            for (var qi = 0; qi < net.pendingCommands.length; qi++) {
                var cmd = net.pendingCommands[qi];
                if (cmd && cmd.matchId && net.matchId && cmd.matchId !== net.matchId) continue;
                if ((cmd.tick || 0) <= G.tick + 1) { // Apply when due
                    if (typeof cmd.seq === 'number' && cmd.seq <= net.lastAppliedSeq) continue;
                    applyPlayerCommand(cmd.playerIndex, cmd.type, cmd.data);
                    if (typeof cmd.seq === 'number') net.lastAppliedSeq = cmd.seq;
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
    G.strategicPulse = currentStrategicPulse(G.tick);
    strategicPulseToast();
    var ownershipMetrics = computeOwnershipMetrics({
        players: G.players,
        nodes: G.nodes,
        fleets: G.fleets,
        strategicPulse: G.strategicPulse,
        rules: G.rules,
        strategicPulseCapBonus: STRATEGIC_PULSE_CAP,
        playerCapital: G.playerCapital,
        anchorPositions: spawnAnchors(G.players.length),
        isNodeAssimilated: isNodeAssimilated,
        distanceFn: dist,
        maxLinkDist: SUPPLY_DIST,
        nodePowerValue: nodePowerValue,
    });
    var power = ownershipMetrics.powerByPlayer;
    var supplyByPlayer = ownershipMetrics.supplyByPlayer;
    var ownerUnits = ownershipMetrics.unitByPlayer;
    var ownerCaps = ownershipMetrics.capByPlayer;
    G.powerByPlayer = power;
    G.unitByPlayer = ownerUnits;
    G.capByPlayer = ownerCaps;
    if (ownerCaps[G.human] > 0) {
        var humanCapPressureTick = ownerUnits[G.human] / ownerCaps[G.human];
        if (humanCapPressureTick > G.stats.peakCapPressure) G.stats.peakCapPressure = humanCapPressureTick;
    }
    if ((power[G.human] || 0) > G.stats.peakPower) G.stats.peakPower = power[G.human] || 0;
    var livePulseNode = G.nodes[G.strategicPulse.nodeId];
    if (G.strategicPulse.active && livePulseNode && livePulseNode.owner === G.human && isNodeAssimilated(livePulseNode)) {
        G.stats.pulseControlTicks++;
    }
    stepNodeEconomy({
        nodes: G.nodes,
        humanIndex: G.human,
        powerByPlayer: power,
        supplyByPlayer: supplyByPlayer,
        ownerUnits: ownerUnits,
        ownerCaps: ownerCaps,
        tune: G.tune,
        diffCfg: G.diffCfg,
        rules: G.rules,
        stats: G.stats,
        constants: {
            baseProd: BASE_PROD,
            nodeRadiusMax: NODE_RMAX,
            isolatedProdPenalty: ISOLATED_PROD_PENALTY,
            capSoftStart: CAP_SOFT_START,
            capSoftFloor: CAP_SOFT_FLOOR,
            ddaMaxBoost: DDA_MAX_BOOST,
            defenseProdPenalty: DEFENSE_PROD_PENALTY,
            strategicPulseProd: STRATEGIC_PULSE_PROD,
            strategicPulseAssim: STRATEGIC_PULSE_ASSIM,
            defenseAssimBonus: DEFENSE_ASSIM_BONUS,
            assimBaseRate: ASSIM_BASE_RATE,
            assimUnitBonus: ASSIM_UNIT_BONUS,
            assimGarrisonFloor: ASSIM_GARRISON_FLOOR,
            assimLevelResist: ASSIM_LEVEL_RESIST,
        },
        callbacks: {
            clamp: clamp,
            nodeTypeOf: nodeTypeOf,
            nodeCapacity: nodeCapacity,
            nodeLevelProdMult: nodeLevelProdMult,
            strategicPulseAppliesToNode: strategicPulseAppliesToNode,
            isNodeAssimilated: isNodeAssimilated,
        },
    });
    var turretReport = applyTurretDamage({
        nodes: G.nodes,
        fleets: G.fleets,
        dt: TICK_DT,
        range: TURRET_RANGE,
        dps: TURRET_DPS,
        minGarrison: TURRET_MIN_GARRISON,
    });
    if (turretReport && Array.isArray(turretReport.shots) && turretReport.shots.length > 0) {
        for (var tsi = 0; tsi < turretReport.shots.length; tsi++) {
            var shot = turretReport.shots[tsi];
            G.turretBeams.push({
                fromX: shot.fromX,
                fromY: shot.fromY,
                toX: shot.toX,
                toY: shot.toY,
                owner: shot.turretOwner,
                life: 0.12,
                maxLife: 0.12,
            });
        }
        if (G.turretBeams.length > 80) G.turretBeams = G.turretBeams.slice(-80);
    }

    stepFleetMovement({
        fleets: G.fleets,
        nodes: G.nodes,
        dt: TICK_DT,
        tune: G.tune,
        mapFeature: G.mapFeature,
        callbacks: {
            clamp: clamp,
            bezPt: bezPt,
        },
        constants: {
            baseFleetSpeed: FLEET_SPEED,
            gravitySpeedMult: GRAVITY_SPEED_MULT,
            trailLen: TRAIL_LEN,
        },
    });
    var fieldReport = applyDefenseFieldDamage({
        nodes: G.nodes,
        fleets: G.fleets,
        dt: TICK_DT,
        cfg: defenseFieldCfg(),
    });
    if (fieldReport && Array.isArray(fieldReport.arcs) && fieldReport.arcs.length > 0) {
        for (var fai = 0; fai < fieldReport.arcs.length; fai++) {
            var arc = fieldReport.arcs[fai];
            G.fieldBeams.push({
                fromX: arc.fromX,
                fromY: arc.fromY,
                toX: arc.toX,
                toY: arc.toY,
                owner: arc.owner,
                life: 0.1,
                maxLife: 0.1,
            });
        }
        if (G.fieldBeams.length > 120) G.fieldBeams = G.fieldBeams.slice(-120);
    }
    var arrivalReport = resolveFleetArrivals({
        fleets: G.fleets,
        nodes: G.nodes,
        flows: G.flows,
        players: G.players,
        tune: G.tune,
        humanIndex: G.human,
        callbacks: {
            nodeTypeOf: nodeTypeOf,
            nodeLevelDefMult: nodeLevelDefMult,
            nodeCapacity: nodeCapacity,
        },
        constants: {
            turretCaptureResist: TURRET_CAPTURE_RESIST,
            defenseBonus: DEFENSE_BONUS,
            assimLockTicks: ASSIM_LOCK_TICKS,
        },
    });
    G.flows = arrivalReport.flows;
    if (arrivalReport.statsDelta.nodesCaptured > 0) G.stats.nodesCaptured += arrivalReport.statsDelta.nodesCaptured;
    if (arrivalReport.statsDelta.gateCaptures > 0) G.stats.gateCaptures += arrivalReport.statsDelta.gateCaptures;
    for (var ari = 0; ari < arrivalReport.particleBursts.length; ari++) {
        var burst = arrivalReport.particleBursts[ari];
        spawnParticles(burst.x, burst.y, burst.count, burst.color, burst.isCapture);
    }
    for (var ati = 0; ati < arrivalReport.toasts.length; ati++) {
        showGameToast(arrivalReport.toasts[ati]);
    }
    for (var aui = 0; aui < arrivalReport.audio.length; aui++) {
        if (typeof AudioFX === 'undefined') break;
        if (arrivalReport.audio[aui] === 'capture' && typeof AudioFX.capture === 'function') AudioFX.capture();
        else if (arrivalReport.audio[aui] === 'combat' && typeof AudioFX.combat === 'function') AudioFX.combat();
    }
    var flowReport = stepFlowLinks({
        flows: G.flows,
        nodes: G.nodes,
        flowInterval: G.tune.flowInt,
        constants: {
            flowFraction: FLOW_FRAC,
            minReserve: 2,
        },
    });
    G.flows = flowReport.flows;
    for (var fdi = 0; fdi < flowReport.dispatches.length; fdi++) {
        var flowDispatch = flowReport.dispatches[fdi];
        dispatch(flowDispatch.owner, [flowDispatch.srcId], flowDispatch.tgtId, flowDispatch.pct);
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
    if (net.online && !runtimeOpts.skipNetworkSync) sendOnlineStateHash();
    maybeShowCampaignObjectiveReminder();
    refreshCampaignMissionPanels();
    advanceTransientVisuals(TICK_DT);
    checkEnd(); G.tick++;
}
function checkEnd() {
    var resolved = resolveMatchEndState({
        nodes: G.nodes,
        fleets: G.fleets,
        players: G.players,
    });
    for (var i = 0; i < G.players.length; i++) G.players[i].alive = resolved.playersAlive[i] !== false;
    if (resolved.gameOver) {
        G.winner = resolved.winnerIndex;
        if (G.state === 'playing' || G.state === 'replay') G.state = 'gameOver';
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ COLOR UTILS Ã¢â€â‚¬Ã¢â€â‚¬
function hexRgb(h) { var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null; }
function lighten(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.min(255, c.r + a) + ',' + Math.min(255, c.g + a) + ',' + Math.min(255, c.b + a) + ')' : h; }
function darken(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.max(0, c.r - a) + ',' + Math.max(0, c.g - a) + ',' + Math.max(0, c.b - a) + ')' : h; }
function hexToRgba(h, a) { var c = hexRgb(h); return c ? 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')' : h; }
function blendHex(a, b, t) { var ca = hexRgb(a), cb = hexRgb(b); if (!ca || !cb) return a; t = Math.max(0, Math.min(1, t)); return '#' + [0,1,2].map(function(i){ var v = Math.round((i===0?ca.r:i===1?ca.g:ca.b) * (1-t) + (i===0?cb.r:i===1?cb.g:cb.b) * t); return ('0' + Math.max(0,Math.min(255,v)).toString(16)).slice(-2); }).join(''); }

// Ã¢â€â‚¬Ã¢â€â‚¬ RENDERING Ã¢â€â‚¬Ã¢â€â‚¬
function nodeTypeLetter(kind) {
    if (kind === 'forge') return 'F';
    if (kind === 'bulwark') return 'B';
    if (kind === 'relay') return 'R';
    if (kind === 'nexus') return 'N';
    if (kind === 'turret') return 'T';
    return 'C';
}

function drawTypeBadge(ctx, n, tdef) {
    var bx = n.pos.x, by = n.pos.y + n.radius * 0.6, br = Math.max(4, n.radius * 0.18);
    var letter = nodeTypeLetter(n.kind);
    ctx.font = 'bold ' + Math.max(6, br) + 'px Outfit,sans-serif';
    ctx.fillStyle = hexToRgba(tdef.color, 0.9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, bx, by);
}

// Override with clearer, lightweight class silhouettes.
function drawPlanetTypeVisual(ctx, n, tdef, _col, tick) {
    var cx = n.pos.x, cy = n.pos.y, r = n.radius, k = n.kind;
    var accent = tdef.color;
    var pulse = 0.5 + Math.sin(tick * 0.05 + n.id * 1.37) * 0.5;
    var ring = r + 3.4;
    ctx.save();

    // Shared modern frame: soft halo + clean ring.
    var halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, ring + 8);
    halo.addColorStop(0, hexToRgba(accent, 0));
    halo.addColorStop(0.72, hexToRgba(accent, 0.08 + pulse * 0.03));
    halo.addColorStop(1, hexToRgba(accent, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, ring + 8, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(accent, 0.34 + pulse * 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (k === 'core') {
        // Balanced, symmetric, neutral tech signature.
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.26)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2.2, r * 0.17), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accent, 0.62);
        ctx.fill();

        for (var c = 0; c < 4; c++) {
            var ca = c * Math.PI * 0.5;
            var x1 = cx + Math.cos(ca) * (r * 0.54);
            var y1 = cy + Math.sin(ca) * (r * 0.54);
            var x2 = cx + Math.cos(ca) * (r * 0.74);
            var y2 = cy + Math.sin(ca) * (r * 0.74);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = hexToRgba(accent, 0.5);
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    } else if (k === 'forge') {
        // Production motif: hot radial fins + glowing cores.
        ctx.beginPath();
        ctx.arc(cx, cy, ring + 1.9, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(accent, 0.72);
        ctx.lineWidth = 1.4;
        ctx.stroke();

        for (var fi = 0; fi < 6; fi++) {
            var fa = tick * 0.016 + fi * Math.PI / 3;
            var ix = cx + Math.cos(fa) * (r * 0.43);
            var iy = cy + Math.sin(fa) * (r * 0.43);
            var ox = cx + Math.cos(fa) * (r + 6.3);
            var oy = cy + Math.sin(fa) * (r + 6.3);
            ctx.beginPath();
            ctx.moveTo(ix, iy);
            ctx.lineTo(ox, oy);
            ctx.strokeStyle = hexToRgba(accent, 0.6 + Math.sin(tick * 0.03 + fi) * 0.06);
            ctx.lineWidth = 1.15;
            ctx.stroke();
        }

        for (var v = -1; v <= 1; v++) {
            ctx.beginPath();
            ctx.arc(cx + v * r * 0.22, cy + r * 0.08, Math.max(1.25, r * 0.085), 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(accent, 0.76);
            ctx.fill();
        }
    } else if (k === 'bulwark') {
        // Defensive motif: shield-like shell + reinforced inner shell.
        ctx.beginPath();
        for (var bi = 0; bi < 8; bi++) {
            var ba = Math.PI / 8 + bi * (Math.PI / 4);
            var bx = cx + Math.cos(ba) * (ring + 1.7);
            var by = cy + Math.sin(ba) * (ring + 1.7);
            if (bi === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.strokeStyle = hexToRgba(accent, 0.8);
        ctx.lineWidth = 1.9;
        ctx.stroke();

        ctx.beginPath();
        for (var bi2 = 0; bi2 < 8; bi2++) {
            var ba2 = Math.PI / 8 + bi2 * (Math.PI / 4);
            var bx3 = cx + Math.cos(ba2) * (r + 0.9);
            var by3 = cy + Math.sin(ba2) * (r + 0.9);
            if (bi2 === 0) ctx.moveTo(bx3, by3);
            else ctx.lineTo(bx3, by3);
        }
        ctx.closePath();
        ctx.strokeStyle = hexToRgba(accent, 0.42);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - r * 0.42, cy);
        ctx.lineTo(cx + r * 0.42, cy);
        ctx.strokeStyle = hexToRgba(accent, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
    } else if (k === 'relay') {
        // Transfer motif: counter-rotating rings + directional chevrons.
        ctx.beginPath();
        ctx.arc(cx, cy, ring + 2.6, 0, Math.PI * 2);
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = -tick * 0.22;
        ctx.strokeStyle = hexToRgba(accent, 0.78);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, r + 1.05, 0, Math.PI * 2);
        ctx.setLineDash([2.5, 3.5]);
        ctx.lineDashOffset = tick * 0.18;
        ctx.strokeStyle = hexToRgba(accent, 0.45);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        for (var ri = 0; ri < 2; ri++) {
            var ra = tick * 0.03 + ri * Math.PI;
            var rx = cx + Math.cos(ra) * (ring + 1.8);
            var ry = cy + Math.sin(ra) * (ring + 1.8);
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(ra);
            var sz = Math.max(3.6, r * 0.22);
            ctx.beginPath();
            ctx.moveTo(-sz, -sz * 0.58);
            ctx.lineTo(0, 0);
            ctx.lineTo(-sz, sz * 0.58);
            ctx.strokeStyle = hexToRgba(accent, 0.92);
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.restore();
        }
    } else if (k === 'nexus') {
        // Hybrid motif: diamond core + network links.
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.6);
        ctx.lineTo(cx + r * 0.6, cy);
        ctx.lineTo(cx, cy + r * 0.6);
        ctx.lineTo(cx - r * 0.6, cy);
        ctx.closePath();
        ctx.strokeStyle = hexToRgba(accent, 0.8);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, ring + 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(accent, 0.48);
        ctx.lineWidth = 1.1;
        ctx.stroke();

        for (var ni = 0; ni < 4; ni++) {
            var na = ni * Math.PI * 0.5 + tick * 0.01;
            var px = cx + Math.cos(na) * (r * 0.68);
            var py = cy + Math.sin(na) * (r * 0.68);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
            ctx.strokeStyle = hexToRgba(accent, 0.32);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(accent, 0.7);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.9, r * 0.13), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accent, 0.82);
        ctx.fill();
    }
    ctx.restore();
}

function drawTurretStation(ctx, n, col, tick) {
    var cx = n.pos.x, cy = n.pos.y, r = n.radius;
    var pulse = 0.75 + Math.sin(tick * 0.08 + n.id * 0.5) * 0.25;
    var shellColor = col && col.indexOf('#') === 0 ? col : '#8ff0ff';

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    var glow = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r + 10);
    glow.addColorStop(0, hexToRgba(shellColor, 0.05));
    glow.addColorStop(0.8, hexToRgba(shellColor, 0.18 * pulse));
    glow.addColorStop(1, hexToRgba(shellColor, 0));
    ctx.fillStyle = glow;
    ctx.fill();

    var sides = 6;
    var innerR = Math.max(5, r * 0.45);
    var outerR = Math.max(8, r * 0.78);
    var baseA = tick * 0.006 + n.id * 0.3;

    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
        var a = baseA + (Math.PI * 2 * i) / sides;
        var rr = i % 2 === 0 ? outerR : innerR;
        var px = cx + Math.cos(a) * rr;
        var py = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = hexToRgba(shellColor, 0.35);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(shellColor, 0.92);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, r * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(shellColor, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function drawRocketShape(ctx, x, y, dirX, dirY, col, flicker, alpha, scale) {
    var nX = -dirY, nY = dirX;
    scale = (scale || 1) * 1.5;
    alpha = alpha === undefined ? 1 : alpha;

    var flameLen = (3 + flicker * 2) * scale;
    var flameWidth = (0.9 + flicker * 0.6) * scale;
    var bx = x - dirX * flameLen, by = y - dirY * flameLen;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(x - dirX * 0.4 * scale + nX * flameWidth, y - dirY * 0.4 * scale + nY * flameWidth);
    ctx.lineTo(bx, by);
    ctx.lineTo(x - dirX * 0.4 * scale - nX * flameWidth, y - dirY * 0.4 * scale - nY * flameWidth);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,145,70,' + (0.22 + flicker * 0.22) + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bx, by, (1.1 + flicker * 0.9) * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,210,130,' + (0.18 + flicker * 0.24) + ')';
    ctx.fill();

    var noseX = x + dirX * 1.8 * scale, noseY = y + dirY * 1.8 * scale;
    var leftX = x - dirX * 1.35 * scale + nX * 1.15 * scale, leftY = y - dirY * 1.35 * scale + nY * 1.15 * scale;
    var rightX = x - dirX * 1.35 * scale - nX * 1.15 * scale, rightY = y - dirY * 1.35 * scale - nY * 1.15 * scale;

    ctx.beginPath();
    ctx.arc(x, y, 4.3 * scale, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(col, 0.2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(noseX, noseY, 0.7 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
}

function drawFleetRocket(ctx, f, col, tick) {
    var count = Math.max(1, Number(f.count) || 1);
    var srcNode = G.nodes[f.srcId], tgtNode = G.nodes[f.tgtId];
    var cp = { x: f.cpx, y: f.cpy };
    var launchT = clamp(typeof f.launchT === 'number' ? f.launchT : 0, 0, 0.2);
    var trail = f.trail || [];
    var tl = trail.length;
    if (tl > 0) {
        var prev = trail[0];
        for (var i = 1; i < tl; i++) {
            var curr = trail[i];
            var t = i / tl;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = hexToRgba(col, 0.04 + t * 0.18);
            ctx.lineWidth = 0.6 + t * 1.6;
            ctx.lineCap = 'round';
            ctx.stroke();
            prev = curr;
        }
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(f.x, f.y);
        ctx.strokeStyle = hexToRgba(col, 0.28);
        ctx.lineWidth = 2.3;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    var dirX = 1, dirY = 0;
    if (tl > 0) {
        var from = trail[tl - 1];
        dirX = f.x - from.x;
        dirY = f.y - from.y;
    } else {
        var src = G.nodes[f.srcId], tgt = G.nodes[f.tgtId];
        if (src && tgt) { dirX = tgt.pos.x - src.pos.x; dirY = tgt.pos.y - src.pos.y; }
    }
    var dLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= dLen; dirY /= dLen;
    var nX = -dirY, nY = dirX;

    var phase = tick * 0.28 + f.srcId * 0.9 + f.tgtId * 0.6 + f.offsetL * 0.08;
    var flicker = 0.5 + 0.5 * Math.sin(phase);
    drawRocketShape(ctx, f.x, f.y, dirX, dirY, col, flicker, 1, 1);

    var supportCount = Math.max(0, Math.floor(count) - 1);
    if (supportCount > 0 && srcNode && tgtNode) {
        var spacingT = 0.012;
        var swarmWidth = Math.min(20, 6 + count * 0.35);
        for (var ui = 1; ui <= supportCount; ui++) {
            var tUnit = f.t - ui * spacingT;
            if (tUnit <= 0 || tUnit >= 1) continue;
            var curveT = launchT + (1 - launchT) * clamp(tUnit, 0, 1);

            var pt = bezPt(srcNode.pos, cp, tgtNode.pos, curveT);
            var pt2 = bezPt(srcNode.pos, cp, tgtNode.pos, Math.min(1, curveT + 0.01));
            var udx = pt2.x - pt.x, udy = pt2.y - pt.y;
            var ulen = Math.sqrt(udx * udx + udy * udy) || 1;
            udx /= ulen; udy /= ulen;
            var unx = -udy, uny = udx;

            var centered = count <= 1 ? 0 : ((ui / (count - 1)) * 2 - 1);
            var jitter = hashMix(G.seed, f.srcId, f.tgtId, ui);
            var offsetL = centered * swarmWidth + (jitter - 0.5) * 1.6;
            var fade = Math.min(1, curveT * 5) * Math.min(1, (1 - curveT) * 5);
            var sx = pt.x + unx * offsetL * fade;
            var sy = pt.y + uny * offsetL * fade;
            var localFlicker = 0.5 + 0.5 * Math.sin(phase + ui * 0.33);
            var alpha = clamp(0.88 - ui * 0.0025, 0.35, 0.88);
            drawRocketShape(ctx, sx, sy, udx, udy, col, localFlicker, alpha, 0.76);
        }
    }
}

function render(ctx, cv, tick) {
    ctx.fillStyle = COLORS_BG; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(cv.width / 2, cv.height / 2); ctx.scale(G.cam.zoom, G.cam.zoom); ctx.translate(-G.cam.x, -G.cam.y);

    var hw = cv.width / 2 / G.cam.zoom, hh = cv.height / 2 / G.cam.zoom;
    // Ã¢â€â‚¬Ã¢â€â‚¬ STARS Ã¢â€â‚¬Ã¢â€â‚¬
    for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (Math.abs(s.x - G.cam.x) > hw + 50 || Math.abs(s.y - G.cam.y) > hh + 50) continue;
        var twinkle = 0.6 + 0.4 * Math.sin(tick * 0.03 + i * 2.1);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(200,220,255,' + s.b * twinkle + ')'; ctx.fill();
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ GRID Ã¢â€â‚¬Ã¢â€â‚¬
    var sp = 100;
    var sx = Math.floor((G.cam.x - hw) / sp) * sp, sy = Math.floor((G.cam.y - hh) / sp) * sp;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (var x = sx; x <= G.cam.x + hw; x += sp) for (var y = sy; y <= G.cam.y + hh; y += sp) { ctx.beginPath(); ctx.arc(x, y, 0.4, 0, Math.PI * 2); ctx.fill(); }

    drawMapFeature(ctx, tick);

    for (var tr = 0; tr < G.nodes.length; tr++) {
        var turretNode = G.nodes[tr];
        if (turretNode.kind !== 'turret') continue;
        var turretVisible = !G.tune.fogEnabled || turretNode.owner === G.human || !!G.fog.vis[G.human][turretNode.id];
        if (!turretVisible) continue;
        var turretCol = turretNode.owner >= 0 && G.players[turretNode.owner] ? G.players[turretNode.owner].color : NODE_TYPE_DEFS.turret.color;
        ctx.beginPath();
        ctx.arc(turretNode.pos.x, turretNode.pos.y, TURRET_RANGE, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(turretCol, 0.16);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }
    for (var fr = 0; fr < G.nodes.length; fr++) {
        var fieldNode = G.nodes[fr];
        if (!fieldNode || fieldNode.kind === 'turret' || fieldNode.owner < 0) continue;
        var fieldVisible = !G.tune.fogEnabled || fieldNode.owner === G.human || !!G.fog.vis[G.human][fieldNode.id];
        if (!fieldVisible) continue;
        var fieldStats = getDefenseFieldStats(fieldNode, defenseFieldCfg());
        if (!fieldStats.active) continue;
        var fieldCol = G.players[fieldNode.owner] ? G.players[fieldNode.owner].color : COL_NEUTRAL;
        var fieldAlpha = fieldNode.owner === G.human ? 0.12 : 0.07;
        if (fieldNode.selected) fieldAlpha += 0.05;
        ctx.beginPath();
        ctx.arc(fieldNode.pos.x, fieldNode.pos.y, fieldStats.range, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(fieldCol, fieldAlpha);
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = fieldNode.defense ? 1.4 : 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ FLOW LINKS Ã¢â€â‚¬Ã¢â€â‚¬
    for (var i = 0; i < G.flows.length; i++) {
        var fl = G.flows[i]; if (!fl.active) continue;
        var sn = G.nodes[fl.srcId], tn = G.nodes[fl.tgtId];
        if (G.tune.fogEnabled && fl.owner !== G.human && !G.fog.vis[G.human][fl.srcId] && !G.fog.vis[G.human][fl.tgtId]) continue;
        var col = G.players[fl.owner] ? G.players[fl.owner].color : COL_NEUTRAL, cp = bezCP(sn.pos, tn.pos);
        ctx.beginPath(); ctx.moveTo(sn.pos.x, sn.pos.y); ctx.quadraticCurveTo(cp.x, cp.y, tn.pos.x, tn.pos.y);
        ctx.strokeStyle = hexToRgba(col, 0.35); ctx.lineWidth = 1; ctx.stroke();
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ FLEETS WITH TRAILS Ã¢â€â‚¬Ã¢â€â‚¬
    var fhw = hw + 30, fhh = hh + 30;
    for (var i = 0; i < G.fleets.length; i++) {
        var f = G.fleets[i]; if (!f.active || f.t <= 0) continue;
        if (G.tune.fogEnabled && f.owner !== G.human && !fleetVis(f, G.human, G.nodes)) continue;
        if (Math.abs(f.x - G.cam.x) > fhw || Math.abs(f.y - G.cam.y) > fhh) continue;
        var col = G.players[f.owner] ? G.players[f.owner].color : COL_NEUTRAL;
        drawFleetRocket(ctx, f, col, tick);
    }
    for (var bi = 0; bi < G.turretBeams.length; bi++) {
        var beam = G.turretBeams[bi];
        var beamAlpha = clamp(beam.life / Math.max(beam.maxLife, 0.0001), 0, 1);
        var beamCol = beam.owner >= 0 && G.players[beam.owner] ? G.players[beam.owner].color : NODE_TYPE_DEFS.turret.color;
        ctx.beginPath();
        ctx.moveTo(beam.fromX, beam.fromY);
        ctx.lineTo(beam.toX, beam.toY);
        ctx.strokeStyle = hexToRgba(beamCol, 0.18 * beamAlpha);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(beam.fromX, beam.fromY);
        ctx.lineTo(beam.toX, beam.toY);
        ctx.strokeStyle = hexToRgba('#ffffff', 0.75 * beamAlpha);
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(beam.toX, beam.toY, 1.6 + beamAlpha * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#ffffff', 0.55 * beamAlpha);
        ctx.fill();
    }
    for (var fbi = 0; fbi < G.fieldBeams.length; fbi++) {
        var fieldBeam = G.fieldBeams[fbi];
        var fieldBeamAlpha = clamp(fieldBeam.life / Math.max(fieldBeam.maxLife, 0.0001), 0, 1);
        var fieldBeamCol = fieldBeam.owner >= 0 && G.players[fieldBeam.owner] ? G.players[fieldBeam.owner].color : '#8db3ff';
        ctx.beginPath();
        ctx.moveTo(fieldBeam.fromX, fieldBeam.fromY);
        ctx.lineTo(fieldBeam.toX, fieldBeam.toY);
        ctx.strokeStyle = hexToRgba(fieldBeamCol, 0.22 * fieldBeamAlpha);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(fieldBeam.toX, fieldBeam.toY, 1.2 + fieldBeamAlpha, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#ffffff', 0.45 * fieldBeamAlpha);
        ctx.fill();
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ NODES Ã¢â€â‚¬Ã¢â€â‚¬
    for (var i = 0; i < G.nodes.length; i++) {
        var n = G.nodes[i];
        var vis = !G.tune.fogEnabled || !!G.fog.vis[G.human][n.id], col, dUnits;
        if (n.owner === -1) col = COL_NEUTRAL;
        else if (vis || n.owner === G.human) col = G.players[n.owner] ? G.players[n.owner].color : COL_NEUTRAL;
        else { var ls = G.fog.ls[G.human][n.id]; col = (ls.tick >= 0 && ls.owner >= 0) ? darken(G.players[ls.owner] ? G.players[ls.owner].color : COL_NEUTRAL, 40) : COL_FOG; }
        if (vis || n.owner === G.human) dUnits = '' + Math.floor(n.units);
        else { var ls2 = G.fog.ls[G.human][n.id]; dUnits = ls2.tick >= 0 ? '' + ls2.units : '?'; }

        // selection ring (sade)
        if (n.selected && n.owner === G.human) {
            ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Precompute orbital data Ã¢â€â‚¬Ã¢â€â‚¬
        if ((vis || n.owner === G.human) && n.owner >= 0 && n.supplied === false) {
            ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,100,100,0.35)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        }
        if ((vis || n.owner === G.human) && n.defense) {
            ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
            ctx.fillText('\u26E8', n.pos.x, n.pos.y - n.radius - 4);
        }
        if ((vis || n.owner === G.human) && n.strategic) {
            ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
            if (strategicPulseAppliesToNode(n.id)) {
                var pulseGlow = 0.45 + Math.sin(tick * 0.12 + n.id) * 0.2;
                ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 9, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,230,120,' + pulseGlow + ')';
                ctx.lineWidth = 2.2;
                ctx.stroke();
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,235,170,0.95)';
                ctx.textAlign = 'center';
                ctx.fillText('PULSE', n.pos.x, n.pos.y - n.radius - 10);
            }
        }
        var gateVisible = n.gate && (vis || n.owner === G.human || (G.mapFeature && G.mapFeature.type === 'barrier'));
        if (gateVisible) {
            var gatePulse = 0.55 + 0.45 * Math.sin(tick * 0.08 + n.id);
            var gateAlpha = (vis || n.owner === G.human) ? 0.95 : 0.62;
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 9, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,220,140,' + (0.28 + gatePulse * 0.24) * gateAlpha + ')';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(n.pos.x, n.pos.y - n.radius - 8);
            ctx.lineTo(n.pos.x + 5, n.pos.y - n.radius - 2);
            ctx.lineTo(n.pos.x, n.pos.y - n.radius + 4);
            ctx.lineTo(n.pos.x - 5, n.pos.y - n.radius - 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,220,140,' + gateAlpha + ')';
            ctx.fill();
            ctx.font = 'bold 10px Outfit,sans-serif';
            ctx.fillStyle = 'rgba(255,232,180,' + gateAlpha + ')';
            ctx.textAlign = 'center';
            ctx.fillText('GATE', n.pos.x, n.pos.y + n.radius + 13);
            ctx.restore();
        }
        if ((vis || n.owner === G.human) && n.owner >= 0 && n.assimilationProgress !== undefined && n.assimilationProgress < 1) {
            var ringR = n.radius + 7;
            var lockPhase = (n.assimilationLock || 0) > 0 ? (1 - clamp((n.assimilationLock || 0) / ASSIM_LOCK_TICKS, 0, 1)) : 1;
            var assimPhase = clamp(n.assimilationProgress || 0, 0, 1);
            var prog = clamp(lockPhase * 0.5 + assimPhase * 0.5, 0, 1);
            var pulse = 0.8 + Math.sin(tick * 0.09 + n.id * 0.7) * 0.2;

            // Base assimilation circle around the planet.
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, ringR, 0, Math.PI * 2, false);
            ctx.strokeStyle = hexToRgba(col, 0.16 + 0.12 * pulse);
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Rotating dashed ring makes "ongoing process" readable at a glance.
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.lineDashOffset = -tick * 0.7;
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, ringR, 0, Math.PI * 2, false);
            ctx.strokeStyle = hexToRgba(col, 0.36);
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, false);
            ctx.strokeStyle = hexToRgba(col, 0.82);
            ctx.lineWidth = 2.8;
            ctx.lineCap = 'round';
            ctx.stroke();

            var endA = -Math.PI / 2 + Math.PI * 2 * prog;
            var ex = n.pos.x + Math.cos(endA) * ringR;
            var ey = n.pos.y + Math.sin(endA) * ringR;
            ctx.beginPath();
            ctx.arc(ex, ey, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fill();
        }
        var hasOrbiters = (vis || n.owner === G.human) && n.owner >= 0 && n.kind !== 'turret';
        var orbData = [];
        if (hasOrbiters) {
            var uCount = Math.max(0, Math.floor(n.units));
            var orbiters = Math.min(MAX_ORBITERS, Math.round(uCount / ORBIT_UNIT_STEP));
            if (uCount > 0 && orbiters < 1) orbiters = 1;
            hasOrbiters = orbiters > 0;
            if (hasOrbiters) {
                // Stable orbital distribution: density scales with unit count.
                var GOLDEN = 2.39996323;
                var assigned = 0;
                var basePhase = n.id * 0.113;
                var ringStep = 6.8;
                var ringStart = n.radius + 7.5;
                var minSpacing = 7.6;
                for (var ring = 0; ring < ORBIT_MAX_RINGS && assigned < orbiters; ring++) {
                    var rr = ringStart + ring * ringStep;
                    var rrY = rr * (0.56 + Math.min(0.26, ring * 0.08));
                    var ringCap = Math.max(8, Math.floor((Math.PI * 2 * rr) / minSpacing));
                    var count = Math.min(ringCap, orbiters - assigned);
                    if (count <= 0) break;
                    var tilt = (n.id * 0.73 + ring * 1.17 + 0.21) % (Math.PI * 2);
                    // Outer rings move slower for a more natural orbit feel.
                    var speedMag = ORBIT_SPD * Math.pow((n.radius + 9) / rr, 0.5) * (1 + ring * 0.04);
                    var baseSpeed = (ring % 2 === 0 ? 1 : -1) * speedMag;
                    var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
                    var rd = { rr: rr, rrY: rrY, tilt: tilt, cosT: cosT, sinT: sinT, baseSpeed: baseSpeed, count: count, ring: ring, dots: [] };
                    for (var oi = 0; oi < count; oi++) {
                        var phase = basePhase + oi * GOLDEN + ring * 1.37;
                        var angle = tick * baseSpeed + phase;
                        var wobble = Math.sin(tick * 0.045 + oi * 1.7 + ring * 0.9) * 0.9;
                        var lx = Math.cos(angle) * (rr + wobble);
                        var ly = Math.sin(angle) * (rrY + wobble * 0.35);
                        var ox = n.pos.x + lx * cosT - ly * sinT;
                        var oy = n.pos.y + lx * sinT + ly * cosT;
                        var dotR = Math.max(1.2, 1.9 - ring * 0.17 + (oi % 9 === 0 ? 0.22 : 0));
                        var behind = Math.sin(angle) < 0;
                        rd.dots.push({ ox: ox, oy: oy, dotR: dotR, behind: behind, angle: angle, oi: oi });
                    }
                    orbData.push(rd);
                    assigned += count;
                }
            }
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ PASS 1: Back-half orbit tracks + back warriors (BEHIND planet) Ã¢â€â‚¬Ã¢â€â‚¬
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

        // Ã¢â€â‚¬Ã¢â€â‚¬ PLANET BODY (drawn between back and front orbiters) Ã¢â€â‚¬Ã¢â€â‚¬
        var tdef = nodeTypeOf(n);
        if (n.kind === 'turret') {
            drawTurretStation(ctx, n, col, tick);
        } else {
            var bodyCol = col;
            if ((vis || n.owner === G.human) && col.indexOf('#') === 0) {
                var typeBlend = n.owner === -1 ? 0.5 : 0.22;
                bodyCol = blendHex(col, tdef.color, typeBlend);
            }
            var planetCanvas = getPlanetTexture(n.id, n.radius);
            ctx.save();
            if (!vis && n.owner !== G.human) { ctx.globalAlpha = 0.3; ctx.filter = 'grayscale(100%) brightness(50%)'; }
            ctx.drawImage(planetCanvas, n.pos.x - n.radius, n.pos.y - n.radius, n.radius * 2, n.radius * 2);
            ctx.restore();
            if ((vis || n.owner === G.human) && n.owner >= 0 && col && col.indexOf('#') === 0) {
                ctx.save();
                ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius, 0, Math.PI * 2); ctx.clip();
                var tint = ctx.createRadialGradient(n.pos.x - n.radius * 0.3, n.pos.y - n.radius * 0.3, 0, n.pos.x, n.pos.y, n.radius * 1.2);
                tint.addColorStop(0, hexToRgba(col, 0.35)); tint.addColorStop(0.7, hexToRgba(col, 0.15)); tint.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = tint; ctx.fillRect(n.pos.x - n.radius, n.pos.y - n.radius, n.radius * 2, n.radius * 2);
                ctx.restore();
                ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, n.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = hexToRgba(col, 0.9); ctx.lineWidth = 2.5; ctx.stroke();
            }
        }

        if ((vis || n.owner === G.human) && n.level > 1) {
            for (var lv = 1; lv < n.level; lv++) {
                var la = -Math.PI / 2 + (lv - 1) * 0.5;
                var lx = n.pos.x + Math.cos(la) * (n.radius + 5);
                var ly = n.pos.y + Math.sin(la) * (n.radius + 5);
                ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
            }
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ PASS 2: Front-half orbit tracks + front warriors (IN FRONT of planet) Ã¢â€â‚¬Ã¢â€â‚¬
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
        else { ctx.fillStyle = '#fff'; }
        ctx.fillText(dUnits, n.pos.x, n.pos.y); ctx.shadowBlur = 0;

        if (vis || n.owner === G.human) {
            drawTypeBadge(ctx, n, nodeTypeOf(n));
            if (n.level > 1) {
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                ctx.fillText('L' + n.level, n.pos.x, n.pos.y - n.radius * 0.66);
            }
        }
    }

    // particles
    for (var pi = 0; pi < G.particles.length; pi++) {
        var p = G.particles[pi];
        var alpha = p.life / p.maxLife;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(p.col, alpha);
        ctx.fill();
    }

    // drag line (sade)
    if (inp.dragActive) {
        var ds = inp.dragStart, de = inp.dragEnd, dcp = bezCP(ds, de, BEZ_CURV * 0.7);
        ctx.beginPath(); ctx.moveTo(ds.x, ds.y); ctx.quadraticCurveTo(dcp.x, dcp.y, de.x, de.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
    // minimap
    var mm = document.getElementById('minimapCanvas');
    if (mm && mm.getContext && (G.state === 'playing' || G.state === 'replay') && G.nodes.length > 0) {
        var mmCtx = mm.getContext('2d');
        mm.width = 140; mm.height = 90;
        var scale = Math.min(mm.width / MAP_W, mm.height / MAP_H);
        var mx = mm.width / 2 - G.cam.x * scale, my = mm.height / 2 - G.cam.y * scale;
        mmCtx.fillStyle = 'rgba(8,12,21,0.95)'; mmCtx.fillRect(0, 0, mm.width, mm.height);
        mmCtx.save(); mmCtx.translate(mx, my); mmCtx.scale(scale, scale);
        for (var mi = 0; mi < G.nodes.length; mi++) {
            var mn = G.nodes[mi];
            var mcol = mn.owner < 0 ? '#5a6272' : (G.players[mn.owner] ? G.players[mn.owner].color : '#888');
            mmCtx.fillStyle = mcol; mmCtx.beginPath(); mmCtx.arc(mn.pos.x, mn.pos.y, 8, 0, Math.PI * 2); mmCtx.fill();
        }
        mmCtx.restore();
        var vw = (cv.width / G.cam.zoom) * scale, vh = (cv.height / G.cam.zoom) * scale;
        mmCtx.strokeStyle = 'rgba(255,255,255,0.6)'; mmCtx.strokeRect(mm.width / 2 - vw / 2, mm.height / 2 - vh / 2, vw, vh);
        document.getElementById('minimap').classList.remove('hidden');
    } else if (document.getElementById('minimap')) document.getElementById('minimap').classList.add('hidden');
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
            ctx.beginPath(); ctx.moveTo(a.pos.x, a.pos.y); ctx.lineTo(b.pos.x, b.pos.y);
            ctx.strokeStyle = 'rgba(125,227,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.beginPath(); ctx.arc(a.pos.x, a.pos.y, a.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(125,227,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    } else if (G.mapFeature.type === 'gravity') {
        var g = G.mapFeature;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(175,145,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (G.mapFeature.type === 'barrier') {
        var barrier = G.mapFeature;
        var bx = barrier.x;
        var minY = MAP_PAD * 0.5;
        var maxY = MAP_H - MAP_PAD * 0.5;
        var cuts = [];
        var gateIds = Array.isArray(barrier.gateIds) ? barrier.gateIds : [];
        for (var gi = 0; gi < gateIds.length; gi++) {
            var gate = G.nodes[gateIds[gi]];
            if (!gate) continue;
            var gap = gate.radius + 24;
            cuts.push({ y0: gate.pos.y - gap, y1: gate.pos.y + gap, node: gate });
        }
        cuts.sort(function (a, b) { return a.y0 - b.y0; });
        var segY = minY;
        ctx.save();
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = 'rgba(255,120,120,0.35)';
        ctx.lineWidth = 2;
        for (var ci = 0; ci < cuts.length; ci++) {
            var cut = cuts[ci];
            var y0 = clamp(cut.y0, minY, maxY);
            var y1 = clamp(cut.y1, minY, maxY);
            if (y0 > segY) {
                ctx.beginPath();
                ctx.moveTo(bx, segY);
                ctx.lineTo(bx, y0);
                ctx.stroke();
            }
            segY = Math.max(segY, y1);
        }
        if (segY < maxY) {
            ctx.beginPath();
            ctx.moveTo(bx, segY);
            ctx.lineTo(bx, maxY);
            ctx.stroke();
        }
        ctx.restore();

        for (var ci2 = 0; ci2 < cuts.length; ci2++) {
            var gateNode = cuts[ci2].node;
            var pulse = 0.55 + 0.45 * Math.sin(tick * 0.08 + gateNode.id);
            ctx.beginPath();
            ctx.arc(gateNode.pos.x, gateNode.pos.y, gateNode.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,210,120,' + (0.2 + pulse * 0.3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = 'bold 10px Outfit,sans-serif';
            ctx.fillStyle = 'rgba(255,225,160,0.92)';
            ctx.textAlign = gateNode.pos.x <= bx ? 'right' : 'left';
            ctx.fillText('GATE', bx + (gateNode.pos.x <= bx ? -16 : 16), gateNode.pos.y + 3);
        }
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ INPUT Ã¢â€â‚¬Ã¢â€â‚¬
var inp = {
    sel: new Set(), marqActive: false, marqStart: { x: 0, y: 0 }, marqEnd: { x: 0, y: 0 }, dragActive: false, dragStart: { x: 0, y: 0 }, dragEnd: { x: 0, y: 0 }, dragSrcs: [],
    dragPending: false, dragDownNodeId: -1, dragDownScreen: { x: 0, y: 0 }, dragThreshold: 6,
    panActive: false, panLast: { x: 0, y: 0 }, mw: { x: 0, y: 0 }, ms: { x: 0, y: 0 }, sendPct: 50, shift: false,
    pinchActive: false, pinchStartDist: 0, pinchStartZoom: 1, pinchWorldCenter: { x: 0, y: 0 }
};
function s2w(sx, sy) { return { x: (sx - cv.width / 2) / G.cam.zoom + G.cam.x, y: (sy - cv.height / 2) / G.cam.zoom + G.cam.y }; }
function touchScreenPos(touch) {
    var r = cv.getBoundingClientRect();
    return {
        x: (touch.clientX - r.left) * (cv.width / r.width),
        y: (touch.clientY - r.top) * (cv.height / r.height),
    };
}
function screenMidpoint(a, b) { return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }; }
function screenDistance(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
function beginTouchPinch(a, b) {
    var center = screenMidpoint(a, b);
    inp.pinchActive = true;
    inp.pinchStartDist = Math.max(1, screenDistance(a, b));
    inp.pinchStartZoom = G.cam.zoom;
    inp.pinchWorldCenter = s2w(center.x, center.y);
    inp.dragActive = false;
    inp.dragPending = false;
    inp.marqActive = false;
}
function updateTouchPinch(a, b) {
    var center = screenMidpoint(a, b);
    var distNow = Math.max(1, screenDistance(a, b));
    G.cam.zoom = clamp(inp.pinchStartZoom * (distNow / Math.max(1, inp.pinchStartDist)), ZOOM_MIN, ZOOM_MAX);
    G.cam.x = inp.pinchWorldCenter.x - (center.x - cv.width / 2) / G.cam.zoom;
    G.cam.y = inp.pinchWorldCenter.y - (center.y - cv.height / 2) / G.cam.zoom;
}
function hitNode(wp) { for (var i = 0; i < G.nodes.length; i++) { var n = G.nodes[i]; if (dist(wp, n.pos) <= n.radius + 5) return n; } return null; }
function nodesInRect(s, e, pi) {
    var x0 = Math.min(s.x, e.x), x1 = Math.max(s.x, e.x), y0 = Math.min(s.y, e.y), y1 = Math.max(s.y, e.y), r = [];
    for (var i = 0; i < G.nodes.length; i++) { var n = G.nodes[i]; if (n.owner === pi && n.pos.x >= x0 && n.pos.x <= x1 && n.pos.y >= y0 && n.pos.y <= y1) r.push(n.id); } return r;
}
function selectedSendSources(tgtId) {
    var srcs = [];
    inp.sel.forEach(function (sid) {
        var sn = G.nodes[sid];
        if (!sn || sn.owner !== G.human || sid === tgtId) return;
        srcs.push(sid);
    });
    return srcs;
}
function sendFromSelectionTo(tgtId) {
    var srcs = selectedSendSources(tgtId);
    if (!srcs.length) return false;
    var sendData = { sources: srcs, tgtId: tgtId, pct: inp.sendPct / 100 };
    if (!issueOnlineCommand('send', sendData)) {
        applyPlayerCommand(G.human, 'send', sendData);
        recEvt('send', sendData);
    }
    return true;
}
function sendFromSourcesTo(srcs, tgtId) {
    var valid = [];
    for (var i = 0; i < srcs.length; i++) {
        var sid = srcs[i];
        var sn = G.nodes[sid];
        if (sn && sn.owner === G.human && sid !== tgtId) valid.push(sid);
    }
    if (!valid.length) return false;
    var sendData = { sources: valid, tgtId: tgtId, pct: inp.sendPct / 100 };
    if (!issueOnlineCommand('send', sendData)) {
        applyPlayerCommand(G.human, 'send', sendData);
        recEvt('send', sendData);
    }
    return true;
}
function centroidForSources(srcIds) {
    var cx = 0, cy = 0, cc = 0;
    for (var i = 0; i < srcIds.length; i++) {
        var sn = G.nodes[srcIds[i]];
        if (!sn || sn.owner !== G.human) continue;
        cx += sn.pos.x;
        cy += sn.pos.y;
        cc++;
    }
    if (!cc) return null;
    return { x: cx / cc, y: cy / cc };
}
function beginDragSend(srcIds, worldPos) {
    var center = centroidForSources(srcIds);
    if (!center) return false;
    inp.dragActive = true;
    inp.dragPending = false;
    inp.dragSrcs = srcIds.slice();
    inp.dragStart = center;
    inp.dragEnd = worldPos;
    return true;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ DOM Ã¢â€â‚¬Ã¢â€â‚¬
var cv = document.getElementById('gameCanvas'), ctx = cv.getContext('2d');
var $ = function (id) { return document.getElementById(id); };
var mainMenu = $('mainMenu'), pauseOv = $('pauseOverlay'), goOv = $('gameOverOverlay'), hud = $('hud'), repBar = $('replayBar'), tunePanel = $('tuningPanel'), tuneOpen = $('tuneOpenBtn');
var seedIn = $('seedInput'), rndSeedBtn = $('randomSeedBtn'), ncIn = $('nodeCountInput'), ncLbl = $('nodeCountLabel'), diffSel = $('difficultySelect');
var gameModeSel = $('gameModeSelect'), multiModeSel = $('multiModeSelect');
var startBtn = $('startBtn'), sandboxBtn = $('sandboxBtn'), campaignBtn = $('campaignBtn'), dailyChallengeBtn = $('dailyChallengeBtn'), importMapBtn = $('importMapBtn'), exportMapBtn = $('exportMapBtn'), loadRepBtn = $('loadReplayBtn'), repFileIn = $('replayFileInput'), customMapFileIn = $('customMapFileInput');
var playerNameIn = $('playerNameInput');
var startRoomBtn = $('startRoomBtn');
var createRoomBtn = $('createRoomBtn');
var joinRoomCodeInput = $('joinRoomCodeInput');
var joinRoomBtn = $('joinRoomBtn');
var hostControls = $('hostControls'), leaveRoomBtn = $('leaveRoomBtn');
var customMapStatusEl = $('customMapStatus');
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
var chatMessagesEl = $('chatMessages');
var tabSingle = $('tabSingle'), tabMulti = $('tabMulti'), panelSingle = $('panelSingle'), panelMulti = $('panelMulti');
var pauseTitleEl = $('pauseTitle'), pauseHintEl = $('pauseHint'), resumeBtn = $('resumeBtn'), quitBtn = $('quitBtn');
var goTitle = $('gameOverTitle'), goMsg = $('gameOverMsg'), goStatsEl = $('gameOverStats'), repBtn = $('replayBtn'), expRepBtn = $('exportReplayBtn'), restartBtn = $('restartBtn'), nextLevelBtn = $('nextLevelBtn');
var hudTelemetryRow = $('hudTelemetryRow'), hudTick = $('hudTick'), hudPct = $('hudPercent'), sendPctIn = $('sendPercent'), hudCap = $('hudCap'), hudMeta = $('hudMeta'), pauseBtn = $('pauseBtn'), spdBtn = $('speedBtn');
var sendPctQuickBtns = Array.prototype.slice.call(document.querySelectorAll('.send-quick-btn'));
var powerSidebar = $('powerSidebar'), powerListEl = $('powerList');
var scenarioOv = $('scenarioOverlay'), scenarioStartBtn = $('scenarioStartBtn'), scenarioCloseBtn = $('scenarioCloseBtn'), scenarioProgressEl = $('scenarioProgress'), scenarioBubbleListEl = $('scenarioBubbleList'), scenarioMissionEl = $('scenarioMission');
var campaignMissionHud = $('campaignMissionHud'), dailyChallengeCard = $('dailyChallengeCard');
var repSlower = $('replaySlower'), repPauseBtn = $('replayPause'), repFaster = $('replayFaster'), repSpdLbl = $('replaySpeedLabel'), repTickLbl = $('replayTickLabel'), repStopBtn = $('replayStop');
var tuneProd = $('tuneProduction'), tuneFSpd = $('tuneFleetSpeed'), tuneDef = $('tuneDefense'), tuneFlowInt = $('tuneFlowInterval');
var tuneAiAgg = $('tuneAIAggression'), tuneAiBuf = $('tuneAIBuffer'), tuneAiDec = $('tuneAIDecision');
var tuneResetBtn = $('tuneResetBtn'), tuneTogBtn = $('tuneToggleBtn');
var tuneFogCb = $('tuneFogOfWar'), tuneAiAssistCb = $('tuneAiAssist'), menuFogCb = $('menuFogOfWar');
var exportMapHudBtn = $('exportMapHudBtn');
var audioToggleBtn = $('audioToggleBtn'), hudInfoToggleBtn = $('hudInfoToggleBtn');
var tuneVals = { p: $('tuneProductionVal'), f: $('tuneFleetSpeedVal'), d: $('tuneDefenseVal'), fi: $('tuneFlowIntervalVal'), aa: $('tuneAIAggressionVal'), ab: $('tuneAIBufferVal'), ad: $('tuneAIDecisionVal') };
var UI_PREFS_KEY = 'stellar_ui_prefs_v1';
var DEFAULT_SFX_VOLUME = 0.85, DEFAULT_MUSIC_VOLUME = 0.55;
var tuningOpen = false, lastRepData = null, powerRenderKey = '', inGameMenuOpen = false;
var uiPrefs = loadUiPrefs();

function loadUiPrefs() {
    try {
        var raw = localStorage.getItem(UI_PREFS_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return {
            audioEnabled: parsed && parsed.audioEnabled !== false,
            hudTelemetryVisible: !!(parsed && parsed.hudTelemetryVisible),
        };
    } catch (e) {
        return {
            audioEnabled: true,
            hudTelemetryVisible: false,
        };
    }
}
function saveUiPrefs() {
    try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
            audioEnabled: uiPrefs.audioEnabled !== false,
            hudTelemetryVisible: !!uiPrefs.hudTelemetryVisible,
        }));
    } catch (e) {}
}
function applyAudioPreference() {
    if (typeof AudioFX === 'undefined') return;
    AudioFX.setSfxVolume(uiPrefs.audioEnabled ? DEFAULT_SFX_VOLUME : 0);
    AudioFX.setMusicVolume(uiPrefs.audioEnabled ? DEFAULT_MUSIC_VOLUME : 0);
    if (!uiPrefs.audioEnabled) {
        AudioFX.stopMusic();
    } else if (G.state === 'playing' || G.state === 'paused') {
        AudioFX.startMusic();
    }
}
function syncAudioToggleButton() {
    if (!audioToggleBtn) return;
    audioToggleBtn.textContent = uiPrefs.audioEnabled ? 'Ses: Acik' : 'Ses: Kapali';
}
function syncHudTelemetryVisibility() {
    if (hudTelemetryRow) hudTelemetryRow.classList.toggle('hidden', !uiPrefs.hudTelemetryVisible);
    if (hudInfoToggleBtn) hudInfoToggleBtn.textContent = uiPrefs.hudTelemetryVisible ? 'Tick: Acik' : 'Tick: Kapali';
}
function syncPauseOverlayContent() {
    var onlineMenu = net.online && G.state === 'playing' && inGameMenuOpen;
    if (pauseTitleEl) pauseTitleEl.textContent = onlineMenu ? 'Mac Menusu' : 'Duraklatildi';
    if (pauseHintEl) {
        if (onlineMenu) {
            pauseHintEl.textContent = 'Ana menuye donersin. Ayrilirsan yerine AI devam eder.';
            pauseHintEl.classList.remove('hidden');
        } else {
            pauseHintEl.textContent = '';
            pauseHintEl.classList.add('hidden');
        }
    }
    if (resumeBtn) resumeBtn.textContent = onlineMenu ? 'Oyuna Don' : 'Devam';
    if (quitBtn) quitBtn.textContent = onlineMenu ? 'Ana Menuye Don' : 'Ana Menu';
    syncAudioToggleButton();
    syncHudTelemetryVisibility();
}
function syncMatchHudControls() {
    if (pauseBtn) {
        pauseBtn.textContent = net.online ? 'CIKIS' : '||';
        pauseBtn.title = net.online ? 'Ana Menuye Don' : 'Duraklat';
        pauseBtn.classList.toggle('hud-exit-btn', !!net.online);
    }
    if (spdBtn) {
        spdBtn.disabled = !!net.online;
        spdBtn.title = net.online ? 'Online maclarda devre disi' : 'Hiz';
    }
}
function setAudioEnabled(enabled) {
    uiPrefs.audioEnabled = !!enabled;
    saveUiPrefs();
    applyAudioPreference();
    syncAudioToggleButton();
}
function setHudTelemetryVisible(visible) {
    uiPrefs.hudTelemetryVisible = !!visible;
    saveUiPrefs();
    syncHudTelemetryVisibility();
}
function openPauseMenu() {
    if (G.state !== 'playing') return;
    if (net.online) {
        inGameMenuOpen = true;
        syncPauseOverlayContent();
        showUI(G.state);
        return;
    }
    G.state = 'paused';
    showUI('paused');
}
function closePauseMenu() {
    if (net.online) {
        if (!inGameMenuOpen) return;
        inGameMenuOpen = false;
        syncPauseOverlayContent();
        showUI(G.state);
        return;
    }
    if (G.state === 'paused') {
        G.state = 'playing';
        showUI('playing');
    }
}
function togglePauseMenu() {
    if (net.online) {
        if (inGameMenuOpen) closePauseMenu();
        else openPauseMenu();
        return;
    }
    if (G.state === 'paused') closePauseMenu();
    else openPauseMenu();
}

syncPauseOverlayContent();
syncHudTelemetryVisibility();
syncMatchHudControls();
if (!uiPrefs.audioEnabled) applyAudioPreference();

function labelForPlayer(idx) {
    var label = '';
    if (net.online && Array.isArray(net.players)) {
        for (var i = 0; i < net.players.length; i++) {
            var np = net.players[i];
            if (Number(np.index) === idx) { label = np.name || ''; break; }
        }
    }
    if (!label) {
        if (idx === G.human) label = 'You';
        else if (G.players[idx] && G.players[idx].isAI) {
            var aiN = 0;
            for (var p = 0; p <= idx; p++) if (G.players[p] && G.players[p].isAI) aiN++;
            label = 'AI ' + aiN;
        } else {
            label = 'Oyuncu ' + (idx + 1);
        }
    }
    if (idx === G.human && label.indexOf('You') === -1) label += ' (You)';
    return label;
}

function pulseBonusSummary() {
    return 'Pulse: uretim +' + Math.round((STRATEGIC_PULSE_PROD - 1) * 100) + '% | filo hizi +' + Math.round((STRATEGIC_PULSE_SPEED - 1) * 100) + '% | asimilasyon +' + Math.round((STRATEGIC_PULSE_ASSIM - 1) * 100) + '% | cap +' + STRATEGIC_PULSE_CAP;
}

function defenseFieldCfg() {
    return {
        baseRangePad: DEFENSE_FIELD_RANGE_PAD,
        levelRangeBonus: DEFENSE_FIELD_LEVEL_RANGE,
        baseDps: DEFENSE_FIELD_DPS,
        levelDpsBonus: DEFENSE_FIELD_LEVEL_DPS,
        defenseDpsBonus: DEFENSE_FIELD_DEFENSE_BONUS,
        bulwarkDpsBonus: DEFENSE_FIELD_BULWARK_BONUS,
        relayRangeBonus: DEFENSE_FIELD_RELAY_RANGE,
    };
}

function defenseFieldSummary(node) {
    var stats = getDefenseFieldStats(node, defenseFieldCfg());
    if (!stats.active) return 'Field OFF: asimilasyon tamamlaninca acilir';
    return 'Field: r' + Math.round(stats.range) + ' | dusman filo ' + stats.dps.toFixed(1) + '/s erir';
}

function barrierGateNodes() {
    if (!G.mapFeature || G.mapFeature.type !== 'barrier' || !Array.isArray(G.mapFeature.gateIds)) return [];
    var gates = [];
    for (var gi = 0; gi < G.mapFeature.gateIds.length; gi++) {
        var gate = G.nodes[G.mapFeature.gateIds[gi]];
        if (gate && gate.gate) gates.push(gate);
    }
    gates.sort(function (a, b) {
        if (a.pos.y !== b.pos.y) return a.pos.y - b.pos.y;
        return a.id - b.id;
    });
    return gates;
}

function barrierGateLabel(index, total) {
    if (total <= 1) return 'Merkez GATE';
    if (total === 2) return index === 0 ? 'Ust GATE' : 'Alt GATE';
    return 'GATE ' + (index + 1);
}

function barrierGateObjectiveText() {
    var gates = barrierGateNodes();
    if (!gates.length) return 'haritadaki GATE gezegeni bulunamadi';
    if (gates.length === 1) return 'haritadaki GATE etiketli gezegeni ele gecir';
    return 'haritadaki GATE etiketli gezegenlerden birini ele gecir';
}

function barrierGatePromptText() {
    return 'Barrier aktif: ' + barrierGateObjectiveText() + '. Gecis, fetih yetmez; asimilasyon tamamlaninca acilir.';
}

function barrierGateStatusText() {
    var gates = barrierGateNodes();
    if (!gates.length) return 'Barrier aktif ama GATE gezegeni bulunamadi.';
    var parts = [];
    for (var i = 0; i < gates.length; i++) {
        var gate = gates[i];
        var ownerText = gate.owner < 0 ? 'Tarafsiz' : labelForPlayer(gate.owner);
        var statusText = gate.owner >= 0 ? (isNodeAssimilated(gate) ? 'hazir, gecit acik' : 'asimile oluyor, gecit kapali') : 'bos, once fethet';
        parts.push(barrierGateLabel(i, gates.length) + ': ' + ownerText + ' ' + statusText);
    }
    return 'Barrier | ' + parts.join(' | ');
}

function selectionMetaText() {
    if (!hudMeta || !inp || !inp.sel) return '';
    var ids = Array.from(inp.sel).filter(function (id) { return !!G.nodes[id]; });
    if (!ids.length) {
        var idleParts = [];
        if (G.mapFeature && G.mapFeature.type === 'barrier') idleParts.push(barrierGateStatusText());
        if (G.strategicPulse && G.strategicPulse.active) idleParts.push(pulseBonusSummary());
        if (idleParts.length) return idleParts.join(' | ');
        return 'Bir gezegen sec: upgrade maliyeti, savunma alani, asimilasyon, supply ve pulse etkileri burada gorunur.';
    }

    if (ids.length === 1) {
        var node = G.nodes[ids[0]];
        var ownerLabel = node.owner >= 0 ? labelForPlayer(node.owner) : 'Tarafsiz';
        var parts = [nodeTypeOf(node).label + ' L' + node.level, ownerLabel];
        if (node.owner === G.human) {
            if (G.rules && G.rules.allowUpgrade) {
                if (node.level >= NODE_LEVEL_MAX) parts.push('Upgrade: MAX');
                else parts.push('Upgrade: ' + upgradeCost(node));
            } else {
                parts.push('Upgrade OFF');
            }
            parts.push(node.defense ? ('Defense ON | Assim +' + Math.round((DEFENSE_ASSIM_BONUS - 1) * 100) + '% | Prod -' + Math.round((1 - DEFENSE_PROD_PENALTY) * 100) + '%') : 'Defense OFF');
            if (node.kind !== 'turret') parts.push(defenseFieldSummary(node));
            if (node.supplied === true) parts.push('Supply upgrade -' + Math.round((1 - SUPPLIED_UPGRADE_DISCOUNT) * 100) + '%');
            if (!isNodeAssimilated(node)) parts.push('Assim ' + Math.round(clamp(node.assimilationProgress || 0, 0, 1) * 100) + '%');
        } else if (node.strategic) {
            parts.push('Strategic hub');
        }
        if (node.gate) parts.push(node.owner === G.human && isNodeAssimilated(node) ? 'GATE ready: gecit acik' : 'GATE: bariyeri asip diger tarafa gecisi acar');
        if (strategicPulseAppliesToNode(node.id)) parts.push(pulseBonusSummary());
        else if (node.strategic) parts.push('Strategic hub: pulse buraya dondugunde uretim, hiz, asimilasyon ve cap bonusu gelir');
        return parts.join(' | ');
    }

    var owned = ids.map(function (id) { return G.nodes[id]; }).filter(function (node) { return node.owner === G.human; });
    var summary = [ids.length + ' secili'];
    if (!owned.length) return summary.join(' | ');

    if (G.rules && G.rules.allowUpgrade) {
        var upgradeable = owned.filter(function (node) { return node.level < NODE_LEVEL_MAX; });
        if (upgradeable.length) {
            var minCost = Infinity, maxCost = 0;
            for (var i = 0; i < upgradeable.length; i++) {
                var cost = upgradeCost(upgradeable[i]);
                if (cost < minCost) minCost = cost;
                if (cost > maxCost) maxCost = cost;
            }
            summary.push('Upgrade ' + minCost + (maxCost !== minCost ? ('-' + maxCost) : ''));
        } else {
            summary.push('Upgrade MAX');
        }
    } else {
        summary.push('Upgrade OFF');
    }
    var suppliedCount = owned.filter(function (node) { return node.supplied === true; }).length;
    var gateCount = owned.filter(function (node) { return node.gate && isNodeAssimilated(node); }).length;
    var pulseCount = owned.filter(function (node) { return strategicPulseAppliesToNode(node.id); }).length;
    summary.push('Supply ' + suppliedCount + '/' + owned.length);
    if (gateCount > 0) summary.push('Gate x' + gateCount);
    if (pulseCount > 0) summary.push('Pulse x' + pulseCount);
    return summary.join(' | ');
}

function updatePowerSidebar() {
    if (!powerSidebar || !powerListEl || !G.players || !G.players.length) return;
    var rows = [];
    for (var i = 0; i < G.players.length; i++) {
        var ply = G.players[i] || {};
        rows.push({
            idx: i,
            name: labelForPlayer(i),
            color: ply.color || COL_NEUTRAL,
            alive: ply.alive !== false,
            self: i === G.human,
            power: Math.max(0, Math.round((G.powerByPlayer && G.powerByPlayer[i]) || 0))
        });
    }
    rows.sort(function (a, b) { if (b.power !== a.power) return b.power - a.power; return a.idx - b.idx; });

    var nextKey = rows.map(function (r) { return r.idx + ':' + r.power + ':' + (r.alive ? 1 : 0) + ':' + r.name; }).join('|');
    if (nextKey === powerRenderKey) return;
    powerRenderKey = nextKey;

    var frag = document.createDocumentFragment();
    for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        var rowEl = document.createElement('div');
        rowEl.className = 'power-row' + (row.self ? ' self' : '') + (row.alive ? '' : ' dead');

        var playerEl = document.createElement('div');
        playerEl.className = 'power-player';

        var dotEl = document.createElement('span');
        dotEl.className = 'power-dot';
        dotEl.style.background = row.color;

        var nameEl = document.createElement('span');
        nameEl.className = 'power-name';
        nameEl.textContent = row.name;

        var valEl = document.createElement('span');
        valEl.className = 'power-value';
        valEl.textContent = '' + row.power;

        playerEl.appendChild(dotEl);
        playerEl.appendChild(nameEl);
        rowEl.appendChild(playerEl);
        rowEl.appendChild(valEl);
        frag.appendChild(rowEl);
    }
    powerListEl.replaceChildren(frag);
}

function countOwnedNodes(owner) {
    var total = 0;
    for (var i = 0; i < G.nodes.length; i++) {
        if (G.nodes[i].owner === owner) total++;
    }
    return total;
}

function currentCampaignLevel() {
    if (!G.campaign.active || G.campaign.levelIndex < 0) return null;
    return CAMPAIGN_LEVELS[G.campaign.levelIndex] || null;
}

function currentMissionDefinition() {
    if (G.daily.active && G.daily.challenge) return G.daily.challenge;
    return currentCampaignLevel();
}

function currentMissionMode() {
    if (G.daily.active && G.daily.challenge) return 'daily';
    if (currentCampaignLevel()) return 'campaign';
    return '';
}

function currentMissionSnapshot() {
    return {
        tick: G.tick,
        didWin: G.winner === G.human,
        gameOver: G.state === 'gameOver',
        ownedNodes: countOwnedNodes(G.human),
        stats: G.stats || {},
    };
}

function currentCampaignObjectiveRows() {
    var level = currentMissionDefinition();
    if (!level) return [];
    return evaluateCampaignObjectives(level, currentMissionSnapshot(), { tickRate: TICK_RATE });
}

function currentMissionPanelTitle(level) {
    if (!level) return 'Misyon';
    if (currentMissionMode() === 'daily') return 'Gunluk Challenge';
    return 'Bolum ' + level.id + ': ' + level.name;
}

function currentMissionPanelSubtitle(level) {
    if (!level) return '';
    if (currentMissionMode() === 'daily') {
        var statusBits = [];
        statusBits.push(level.title || 'Gunluk');
        statusBits.push(level.blurb || '');
        if (G.daily.completed) statusBits.push('Durum: Tamamlandi');
        else if (G.daily.bestTick > 0) statusBits.push('En iyi: ' + G.daily.bestTick + ' tick');
        return statusBits.filter(Boolean).join(' | ');
    }
    return level.blurb || '';
}

function refreshCampaignMissionPanels() {
    var level = currentMissionDefinition();
    var rows = level ? currentCampaignObjectiveRows() : [];

    if (campaignMissionHud) {
        if (!level || G.state !== 'playing') {
            campaignMissionHud.classList.add('hidden');
        } else {
            campaignMissionHud.classList.remove('hidden');
            renderMissionPanel(campaignMissionHud, {
                title: currentMissionPanelTitle(level),
                subtitle: currentMissionPanelSubtitle(level),
                items: rows.map(function (row) {
                    return { label: row.label, progressText: row.progressText, complete: row.complete, failed: row.failed, optional: row.optional };
                }),
            });
        }
    }
}

function maybeShowCampaignObjectiveReminder() {
    var level = currentMissionDefinition();
    if (!level || G.state !== 'playing') return;
    var rows = currentCampaignObjectiveRows();
    if (!rows.length) return;
    var mode = currentMissionMode();
    var reminderShown = mode === 'daily' ? G.daily.reminderShown : G.campaign.reminderShown;
    if (!reminderShown) reminderShown = {};
    if (mode === 'daily') G.daily.reminderShown = reminderShown;
    else G.campaign.reminderShown = reminderShown;

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.complete || row.failed) continue;
        if (!row.remindAt || G.tick < row.remindAt) continue;
        if (reminderShown[row.id]) continue;
        reminderShown[row.id] = true;
        if (row.coach) showGameToast((mode === 'daily' ? 'Challenge' : 'Misyon') + ' ipucu: ' + row.coach);
        break;
    }
}

function humanGameOverStatRows() {
    var rows = [
        { label: 'Fethedilen', value: G.stats.nodesCaptured },
        { label: 'Filo emri', value: G.stats.fleetsSent },
        { label: 'Upgrade', value: G.stats.upgrades },
        { label: 'Uretim', value: G.stats.unitsProduced },
        { label: 'Flow kurulum', value: G.stats.flowLinksCreated },
        { label: 'Savunma aktivasyonu', value: G.stats.defenseActivations },
        { label: 'Pulse kontrol', value: (Math.round((G.stats.pulseControlTicks / TICK_RATE) * 10) / 10) + 's' },
        { label: 'Wormhole sevkiyat', value: G.stats.wormholeDispatches },
        { label: 'Peak power', value: Math.round(G.stats.peakPower || 0) },
        { label: 'Peak strain', value: Math.round((G.stats.peakCapPressure || 0) * 100) + '%' },
    ];
    if (G.stats.gateCaptures > 0) rows.push({ label: 'GATE fetih', value: G.stats.gateCaptures });

    var missionRows = currentCampaignObjectiveRows();
    for (var i = 0; i < missionRows.length; i++) {
        rows.push({
            label: (missionRows[i].optional ? 'Bonus' : 'Gorev') + ' ' + (i + 1),
            value: missionRows[i].complete ? 'Tamam' : (missionRows[i].failed ? 'Kacirildi' : missionRows[i].progressText),
            emphasis: missionRows[i].complete && !missionRows[i].optional,
        });
    }
    return rows;
}

function currentAlivePlayerIndices() {
    var alive = [];
    for (var i = 0; i < G.players.length; i++) if (G.players[i] && G.players[i].alive) alive.push(i);
    return alive;
}

function rememberNetworkCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return;
    if (typeof cmd.seq !== 'number') return;
    for (var i = 0; i < net.commandHistory.length; i++) {
        if (net.commandHistory[i].seq === cmd.seq && net.commandHistory[i].matchId === cmd.matchId) return;
    }
    net.commandHistory.push({
        matchId: cmd.matchId,
        seq: cmd.seq,
        playerIndex: cmd.playerIndex,
        tick: cmd.tick,
        type: cmd.type,
        data: JSON.parse(JSON.stringify(cmd.data || {})),
    });
    var minTick = Math.max(0, G.tick - (SYNC_HASH_INTERVAL_TICKS * 6));
    net.commandHistory = net.commandHistory.filter(function (entry) {
        return (entry.tick || 0) >= minTick;
    });
}

function captureSyncSnapshot() {
    return {
        tick: G.tick,
        winner: G.winner,
        state: G.state === 'gameOver' ? 'gameOver' : 'playing',
        nodes: G.nodes.map(function (node) {
            return {
                id: node.id,
                pos: { x: node.pos.x, y: node.pos.y },
                radius: node.radius,
                owner: node.owner,
                units: node.units,
                prodAcc: node.prodAcc || 0,
                level: node.level,
                kind: node.kind,
                defense: !!node.defense,
                strategic: !!node.strategic,
                gate: !!node.gate,
                assimilationProgress: node.assimilationProgress,
                assimilationLock: node.assimilationLock || 0,
            };
        }),
        fleets: G.fleets.filter(function (fleet) { return fleet && fleet.active; }).map(function (fleet) {
            return {
                active: true,
                owner: fleet.owner,
                count: fleet.count,
                srcId: fleet.srcId,
                tgtId: fleet.tgtId,
                t: fleet.t,
                speed: fleet.speed,
                arcLen: fleet.arcLen,
                cpx: fleet.cpx,
                cpy: fleet.cpy,
                x: fleet.x,
                y: fleet.y,
                trail: Array.isArray(fleet.trail) ? fleet.trail.map(function (pt) { return { x: pt.x, y: pt.y }; }) : [],
                offsetL: fleet.offsetL || 0,
                spdVar: fleet.spdVar || 1,
                routeSpeedMult: fleet.routeSpeedMult || 1,
                dmgAcc: fleet.dmgAcc || 0,
                launchT: fleet.launchT || 0,
            };
        }),
        flows: G.flows.map(function (flow) {
            return {
                id: flow.id,
                srcId: flow.srcId,
                tgtId: flow.tgtId,
                owner: flow.owner,
                tickAcc: flow.tickAcc || 0,
                active: flow.active !== false,
            };
        }),
        players: G.players.map(function (player) {
            return {
                idx: player.idx,
                alive: player.alive !== false,
                isAI: !!player.isAI,
                color: player.color,
            };
        }),
        fog: JSON.parse(JSON.stringify(G.fog || {})),
        stats: JSON.parse(JSON.stringify(G.stats || {})),
        wormholes: JSON.parse(JSON.stringify(G.wormholes || [])),
        mapFeature: JSON.parse(JSON.stringify(G.mapFeature || { type: 'none' })),
        playerCapital: JSON.parse(JSON.stringify(G.playerCapital || {})),
        strategicNodes: Array.isArray(G.strategicNodes) ? G.strategicNodes.slice() : [],
        strategicPulse: JSON.parse(JSON.stringify(G.strategicPulse || {})),
        powerByPlayer: JSON.parse(JSON.stringify(G.powerByPlayer || {})),
        capByPlayer: JSON.parse(JSON.stringify(G.capByPlayer || {})),
        unitByPlayer: JSON.parse(JSON.stringify(G.unitByPlayer || {})),
        aiTicks: Array.isArray(G.aiTicks) ? G.aiTicks.slice() : [],
        aiProfiles: JSON.parse(JSON.stringify(G.aiProfiles || [])),
        turretBeams: JSON.parse(JSON.stringify(G.turretBeams || [])),
        fieldBeams: JSON.parse(JSON.stringify(G.fieldBeams || [])),
        flowId: G.flowId,
        fleetSerial: G.fleetSerial,
        rngState: G.rng ? G.rng.s : 1,
        lastAppliedSeq: net.lastAppliedSeq,
    };
}

function advanceTransientVisuals(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (var pi = G.particles.length - 1; pi >= 0; pi--) {
        var particle = G.particles[pi];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= dt;
        if (particle.life <= 0) G.particles.splice(pi, 1);
    }
    for (var bi = G.turretBeams.length - 1; bi >= 0; bi--) {
        G.turretBeams[bi].life -= dt;
        if (G.turretBeams[bi].life <= 0) G.turretBeams.splice(bi, 1);
    }
    for (var fi = G.fieldBeams.length - 1; fi >= 0; fi--) {
        G.fieldBeams[fi].life -= dt;
        if (G.fieldBeams[fi].life <= 0) G.fieldBeams.splice(fi, 1);
    }
}

function handleAuthoritativeState(payload) {
    if (!net.online || !payload || payload.matchId !== net.matchId || !payload.snapshot) return;
    var firstAuthoritativeFrame = !net.authoritativeReady;
    if (!applySyncSnapshot(payload.snapshot)) return;
    net.authoritativeReady = true;
    net.syncWarningTick = -99999;
    net.syncWarningText = '';
    if (typeof payload.hash === 'string' && payload.hash) rememberSyncSnapshot(payload.tick, payload.hash);
    if (firstAuthoritativeFrame) {
        setRoomStatus('Online mac sunucu state ile senkronize edildi.', false);
    }
}

function maybeSendOnlinePing() {
    if (!net.online || !net.socket || !net.matchId) return;
    var now = Date.now();
    if (net.lastPingWallMs > 0 && now - net.lastPingWallMs < 1500) return;
    net.lastPingWallMs = now;
    net.socket.emit('pingTick', { clientTs: now });
}

function rememberSyncSnapshot(tick, hash) {
    if (!net.matchId) return;
    net.syncHistory.push({
        matchId: net.matchId,
        tick: tick,
        hash: hash,
        snapshot: captureSyncSnapshot(),
    });
    if (net.syncHistory.length > 8) net.syncHistory = net.syncHistory.slice(-8);
}

function findSyncSnapshot(tick, hash) {
    for (var i = net.syncHistory.length - 1; i >= 0; i--) {
        var entry = net.syncHistory[i];
        if (entry.matchId !== net.matchId) continue;
        if (entry.tick !== tick) continue;
        if (hash && entry.hash !== hash) continue;
        return entry;
    }
    return null;
}

function rebuildPendingCommandsFromHistory(afterTick, afterSeq) {
    var pending = [];
    for (var i = 0; i < net.commandHistory.length; i++) {
        var entry = net.commandHistory[i];
        if (entry.matchId !== net.matchId) continue;
        if (typeof afterSeq === 'number' && entry.seq <= afterSeq) continue;
        if ((entry.tick || 0) <= afterTick) continue;
        pending.push({
            matchId: entry.matchId,
            seq: entry.seq,
            playerIndex: entry.playerIndex,
            tick: entry.tick,
            type: entry.type,
            data: JSON.parse(JSON.stringify(entry.data || {})),
        });
    }
    pending.sort(function (a, b) {
        var tickDelta = (a.tick || 0) - (b.tick || 0);
        if (tickDelta !== 0) return tickDelta;
        return (a.seq || 0) - (b.seq || 0);
    });
    net.pendingCommands = pending;
}

function applySyncSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    var preservedHuman = G.human;
    var preservedCam = { x: G.cam.x, y: G.cam.y, zoom: G.cam.zoom };

    G.tick = Math.max(0, Math.floor(Number(snapshot.tick) || 0));
    G.winner = Number(snapshot.winner);
    if (!isFinite(G.winner)) G.winner = -1;
    G.state = snapshot.state === 'gameOver' ? 'gameOver' : 'playing';
    G.nodes = JSON.parse(JSON.stringify(Array.isArray(snapshot.nodes) ? snapshot.nodes : []));
    G.fleets = JSON.parse(JSON.stringify(Array.isArray(snapshot.fleets) ? snapshot.fleets : []));
    G.flows = JSON.parse(JSON.stringify(Array.isArray(snapshot.flows) ? snapshot.flows : []));
    G.wormholes = JSON.parse(JSON.stringify(Array.isArray(snapshot.wormholes) ? snapshot.wormholes : []));
    G.mapFeature = JSON.parse(JSON.stringify(snapshot.mapFeature || { type: 'none' }));
    G.playerCapital = JSON.parse(JSON.stringify(snapshot.playerCapital || {}));
    G.strategicNodes = Array.isArray(snapshot.strategicNodes) ? snapshot.strategicNodes.slice() : [];
    G.strategicPulse = JSON.parse(JSON.stringify(snapshot.strategicPulse || currentStrategicPulse(G.tick)));
    G.powerByPlayer = JSON.parse(JSON.stringify(snapshot.powerByPlayer || {}));
    G.capByPlayer = JSON.parse(JSON.stringify(snapshot.capByPlayer || {}));
    G.unitByPlayer = JSON.parse(JSON.stringify(snapshot.unitByPlayer || {}));
    G.stats = JSON.parse(JSON.stringify(snapshot.stats || G.stats || {}));
    G.aiTicks = Array.isArray(snapshot.aiTicks) ? snapshot.aiTicks.slice() : [];
    G.aiProfiles = JSON.parse(JSON.stringify(snapshot.aiProfiles || []));
    G.turretBeams = JSON.parse(JSON.stringify(Array.isArray(snapshot.turretBeams) ? snapshot.turretBeams : []));
    G.fieldBeams = JSON.parse(JSON.stringify(Array.isArray(snapshot.fieldBeams) ? snapshot.fieldBeams : []));
    G.flowId = Math.max(0, Math.floor(Number(snapshot.flowId) || 0));
    G.fleetSerial = Math.max(0, Math.floor(Number(snapshot.fleetSerial) || 0));
    G.fog = JSON.parse(JSON.stringify(snapshot.fog || initFog(G.players.length, G.nodes.length)));

    for (var ni = 0; ni < G.nodes.length; ni++) {
        var node = G.nodes[ni];
        node.id = ni;
        node.visionR = VISION_R + node.radius * 2;
        node.selected = false;
        node.maxUnits = nodeCapacity(node);
        node.units = clamp(node.units, 0, node.maxUnits);
    }
    for (var pi = 0; pi < G.players.length; pi++) {
        if (snapshot.players && snapshot.players[pi]) {
            G.players[pi].alive = snapshot.players[pi].alive !== false;
            G.players[pi].isAI = !!snapshot.players[pi].isAI;
            if (snapshot.players[pi].color) G.players[pi].color = snapshot.players[pi].color;
        }
    }
    G.human = preservedHuman;
    G.cam.x = preservedCam.x;
    G.cam.y = preservedCam.y;
    G.cam.zoom = preservedCam.zoom;
    G.rng = new RNG(1);
    G.rng.s = Math.floor(Number(snapshot.rngState) || 1) || 1;
    net.lastAppliedSeq = typeof snapshot.lastAppliedSeq === 'number' ? snapshot.lastAppliedSeq : -1;
    powerRenderKey = '';
    return true;
}

function handleIncomingSyncSnapshot(payload) {
    if (!net.online || !payload || payload.matchId !== net.matchId || !payload.snapshot) return;
    if (findSyncSnapshot(payload.tick, payload.hash)) return;

    var targetTick = G.tick;
    if (!applySyncSnapshot(payload.snapshot)) return;

    rebuildPendingCommandsFromHistory(G.tick, net.lastAppliedSeq);
    var guard = 0;
    while (G.tick < targetTick && G.state === 'playing' && guard < 720) {
        gameTick({ skipNetworkSync: true });
        guard++;
    }
    net.resyncRequestId = '';
    net.syncWarningTick = G.tick;
    net.syncWarningText = 'Sync snapshot uygulandi (tick ' + payload.tick + ').';
    showGameToast(net.syncWarningText);
    setRoomStatus(net.syncWarningText, false);
}

function sendOnlineStateSummary(force) {
    if (!net.online || !net.socket || !net.matchId) return;
    if (!force && net.lastSummaryTick >= 0 && G.tick - net.lastSummaryTick < SYNC_HASH_INTERVAL_TICKS) return;
    net.lastSummaryTick = G.tick;
    net.socket.emit('stateSummary', {
        matchId: net.matchId,
        tick: G.tick,
        gameOver: G.state === 'gameOver',
        winnerIndex: G.state === 'gameOver' ? G.winner : null,
        aliveIndices: currentAlivePlayerIndices(),
    });
}

function sendOnlineStateHash() {
    if (!net.online || !net.socket || !net.matchId) return;
    if (net.syncHashSentTick >= 0 && G.tick - net.syncHashSentTick < SYNC_HASH_INTERVAL_TICKS) return;
    net.syncHashSentTick = G.tick;
    var hash = computeSyncHash({
        tick: G.tick,
        nodes: G.nodes,
        fleets: G.fleets,
        players: G.players,
    });
    rememberSyncSnapshot(G.tick, hash);
    net.socket.emit('stateHash', {
        matchId: net.matchId,
        tick: G.tick,
        hash: hash,
    });
    sendOnlineStateSummary(false);
}

function closeScenarioMenu() {
    if (scenarioOv) scenarioOv.classList.add('hidden');
}
function openScenarioMenu() {
    if (!scenarioOv) return;
    refreshCampaignUI();
    scenarioOv.classList.remove('hidden');
}

function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
roomButtonState();
setRoomStatus('', false);
ensureSocket();

if (tabSingle && tabMulti && panelSingle && panelMulti) {
    tabSingle.addEventListener('click', function () {
        tabSingle.classList.add('active'); tabMulti.classList.remove('active');
        panelSingle.classList.remove('hidden'); panelMulti.classList.add('hidden');
        closeScenarioMenu();
    });
    tabMulti.addEventListener('click', function () {
        tabMulti.classList.add('active'); tabSingle.classList.remove('active');
        panelMulti.classList.remove('hidden'); panelSingle.classList.add('hidden');
        closeScenarioMenu();
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
    if (st !== 'playing') inGameMenuOpen = false;
    var pauseVisible = st === 'paused' || (st === 'playing' && inGameMenuOpen);
    mainMenu.classList.toggle('hidden', st !== 'mainMenu'); pauseOv.classList.toggle('hidden', !pauseVisible); goOv.classList.toggle('hidden', st !== 'gameOver');
    var ig = st === 'playing' || st === 'paused' || st === 'replay'; hud.classList.toggle('hidden', !ig || st === 'replay'); repBar.classList.toggle('hidden', st !== 'replay');
    if (powerSidebar) powerSidebar.classList.toggle('hidden', !ig || st === 'replay');
    var cp = document.getElementById('chatPanel'); if (cp) cp.classList.toggle('hidden', !ig || !net.online);
    if (st === 'mainMenu') {
        refreshCampaignUI();
        refreshDailyChallengeCard();
        refreshCustomMapStatus();
    }
    closeScenarioMenu();
    if (st === 'playing' && tuningOpen) { tunePanel.classList.remove('hidden'); tuneOpen.classList.add('hidden'); }
    else if (st === 'playing') { tunePanel.classList.add('hidden'); tuneOpen.classList.remove('hidden'); }
    else { tunePanel.classList.add('hidden'); tuneOpen.classList.add('hidden'); }
    syncPauseOverlayContent();
    syncMatchHudControls();
    syncHudTelemetryVisibility();
    refreshCampaignMissionPanels();
}

function setRoomStatus(msg, error) {
    if (!roomStatusEl) return;
    roomStatusEl.textContent = msg || '';
    roomStatusEl.style.color = error ? '#ff8f8f' : 'var(--text-dim)';
}

var CHAT_LOG_LIMIT = 120;
function clearChatMessages() {
    if (!chatMessagesEl) return;
    chatMessagesEl.replaceChildren();
}
function appendChatMessage(text, color) {
    if (!chatMessagesEl || !text) return;
    var line = document.createElement('div');
    line.textContent = text;
    if (color) line.style.color = color;
    chatMessagesEl.appendChild(line);
    while (chatMessagesEl.childNodes.length > CHAT_LOG_LIMIT) {
        chatMessagesEl.removeChild(chatMessagesEl.firstChild);
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}
function chatColorForPlayer(index) {
    var idx = Math.floor(Number(index));
    if (isFinite(idx) && idx >= 0) {
        if (G.players && G.players[idx] && G.players[idx].color) return G.players[idx].color;
        return PLAYER_COLORS[idx % PLAYER_COLORS.length];
    }
    return 'var(--danger)';
}

function renderRoomPlayers(players, hostId) {
    if (!roomPlayersEl) return;
    roomPlayersEl.replaceChildren();
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
    renderRoomListUI(roomListEl, rooms, { connected: net.connected });
}

function clearRoomState(message, opts) {
    opts = opts || {};
    inGameMenuOpen = false;
    net.online = false;
    net.authoritativeEnabled = false;
    net.authoritativeReady = false;
    net.roomCode = '';
    net.players = [];
    net.isHost = false;
    net.localPlayerIndex = 0;
    net.pendingCommands = [];
    net.matchId = '';
    net.lastAppliedSeq = -1;
    net.syncHashSentTick = -1;
    net.syncWarningTick = -99999;
    net.syncWarningText = '';
    net.syncHistory = [];
    net.commandHistory = [];
    net.resyncRequestId = '';
    net.lastSummaryTick = -1;
    net.lastPingWallMs = 0;
    net.resumePending = !!opts.preserveResume;
    clearChatMessages();
    renderRoomPlayers([], null);
    if (!opts.preserveResume) clearRoomResumeState();
    if (message) setRoomStatus(message, false);
    roomButtonState();
    if (roomListEl) roomListEl.style.display = '';
    if (createRoomBtn) createRoomBtn.style.display = '';
    if (joinRoomCodeInput && joinRoomCodeInput.parentElement) joinRoomCodeInput.parentElement.style.display = '';
    if (hostControls) hostControls.style.display = 'none';
    if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';
    if (multiRoomTypeIn) multiRoomTypeIn.value = 'standard';
    syncRoomTypeInputs();
    syncPauseOverlayContent();
    syncMatchHudControls();
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
    if (!chosen) { setRoomStatus('Once nick secmelisin.', true); return; }
    net.playerName = chosen;

    setRoomStatus('Oda kuruluyor...', false);
    var multiSeed = $('multiSeedInput'), multiNode = $('multiNodeInput'), multiDiff = $('multiDiffSelect'), multiRoomType = $('multiRoomTypeSelect');
    var roomMode = (multiRoomType && multiRoomType.value) || 'standard';
    if (roomMode === 'custom' && !currentCustomMapConfig) {
        setRoomStatus('Custom oda acmak icin once bir custom map yukle.', true);
        return;
    }
    net.socket.emit('createRoom', {
        action: 'create',
        playerName: net.playerName,
        mode: roomMode,
        seed: (multiSeed && multiSeed.value) || seedIn.value || '42',
        nodeCount: Number((multiNode && multiNode.value) || ncIn.value || 16),
        difficulty: (multiDiff && multiDiff.value) || diffSel.value || 'normal',
        fogEnabled: menuFogCb ? !!menuFogCb.checked : false,
        rulesMode: (multiModeSel && multiModeSel.value) || (gameModeSel && gameModeSel.value) || 'advanced',
        customMap: roomMode === 'custom' ? currentCustomMapConfig : null,
    });
}

function doJoinRoom() {
    ensureSocket();
    if (!net.socket) { setRoomStatus('Socket.IO yuklenemedi.', true); return; }
    if (!net.connected) { setRoomStatus('Sunucuya baglaniyor...', false); return; }
    if (net.roomCode) return;

    var chosen = (playerNameIn && playerNameIn.value.trim()) || '';
    if (!chosen) { setRoomStatus('Once nick secmelisin.', true); return; }
    net.playerName = chosen;

    var code = (joinRoomCodeInput && joinRoomCodeInput.value.trim().toUpperCase()) || '';
    if (!code || code.length !== 5) { setRoomStatus('Gecerli bir oda kodu girin (5 karakter).', true); return; }

    net.pendingJoin = false;
    setRoomStatus('Odaya baglaniliyor...', false);
    net.socket.emit('joinRoom', {
        action: 'join',
        playerName: net.playerName,
        roomCode: code,
        reconnectToken: net.reconnectToken || '',
    });
}

function issueOnlineCommand(type, data) {
    if (net.online && net.socket && net.roomCode) {
        if (net.authoritativeEnabled && !net.authoritativeReady) {
            setRoomStatus('Mac acilisi sunucudan senkronize ediliyor. Bir an bekle.', false);
            return true;
        }
        var sanitized = sanitizeCommandData(type, data || {});
        if (!sanitized) return false;
        // Ä°leri tarihli komut gÃ¶ndererek, aÄŸ gecikmesine raÄŸmen 
        // iki oyuncuda da aynÄ± tick'te eÅŸzamanlÄ± iÅŸletilmesini saÄŸla (Command Delay)
        var rtt = typeof net.lastPingMs === 'number' && net.lastPingMs > 0 ? net.lastPingMs : 180;
        var delayTicks = clamp(Math.round((rtt / 2) / 33.33) + 4, 6, 18);
        net.socket.emit('playerCommand', { type: type, data: sanitized, tick: G.tick + delayTicks, matchId: net.matchId });
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
        setRoomStatus('Baglanti kuruldu. Oda Kur veya Katil.', false);
        requestLobby();
        net.socket.emit('requestDailyChallenge');
        maybeResumeOnlineRoom();
        roomButtonState();
    });

    net.socket.on('connect_error', function () {
        net.connected = false;
        serverDailyChallenge = null;
        refreshDailyChallengeCard();
        setRoomStatus('Cok oyunculu sunucuya ulasilamadi. "npm run server" ile baslat.', true);
        roomButtonState();
    });

    net.socket.on('disconnect', function () {
        net.connected = false;
        serverDailyChallenge = null;
        refreshDailyChallengeCard();
        clearRoomState('Cok oyunculu sunucudan baglanti koptu.', { preserveResume: true });
        if (G.state === 'playing' || G.state === 'paused' || G.state === 'gameOver') {
            G.state = 'mainMenu';
            showUI('mainMenu');
        }
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
        net.resumePending = false;
        if (state.reconnectToken) {
            saveRoomResumeState({
                roomCode: state.code,
                playerName: net.playerName,
                reconnectToken: state.reconnectToken,
            });
        }
        if (state.config) {
            var stateMode = normalizeRulesetMode(state.config.rulesMode || 'advanced');
            if (multiModeSel) multiModeSel.value = stateMode;
            if (gameModeSel) gameModeSel.value = stateMode;
            if (multiRoomTypeIn) multiRoomTypeIn.value = state.config.mode === 'daily' ? 'daily' : (state.config.mode === 'custom' ? 'custom' : 'standard');
            syncRoomTypeInputs();
        }

        if (hostControls) hostControls.style.display = net.isHost ? 'flex' : 'none';
        if (roomListEl) roomListEl.style.display = 'none';
        if (createRoomBtn) createRoomBtn.style.display = 'none';
        if (joinRoomCodeInput && joinRoomCodeInput.parentElement) joinRoomCodeInput.parentElement.style.display = 'none';
        if (leaveRoomBtn) leaveRoomBtn.style.display = 'block';

        renderRoomPlayers(net.players, state.hostId);
        var status = 'Oda: ' + state.code + ' | ' + net.players.length + '/' + state.maxPlayers + ' oyuncu';
        if (state.preview && state.preview.mode === 'daily') {
            status += ' | Gunluk: ' + ((state.preview.challengeTitle || '') + (state.preview.challengeKey ? (' (' + state.preview.challengeKey + ')') : ''));
            if (state.preview.aiCount) status += ' | AI ' + state.preview.aiCount;
        } else if (state.preview && state.preview.mode === 'custom') {
            status += ' | Custom: ' + (state.preview.customMapName || 'Harita');
            status += ' | Slot ' + (state.preview.playerCount || state.maxPlayers || net.players.length);
            if (state.preview.aiCount) status += ' | AI ' + state.preview.aiCount;
        }
        if (net.players.length < 2) status += ' | En az 2 oyuncu gerekli';
        else status += (net.isHost ? ' | Oyunu baslatabilirsin' : ' | Hostun baslatmasi bekleniyor...');
        setRoomStatus(status, false);
        roomButtonState();
    });

    net.socket.on('roomError', function (err) {
        net.pendingJoin = false;
        if (net.resumePending) clearRoomResumeState();
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
        var leftName = (payload && payload.name) ? payload.name : 'Bir oyuncu';
        var leftColor = chatColorForPlayer(payload && payload.index);
        if (G.state === 'playing' && G.players && G.players[payload.index]) {
            G.players[payload.index].isAI = true;
            appendChatMessage(leftName + ' oyundan ayrildi. Yerine Yapay Zeka gecti.', leftColor);
        } else if (net.players) {
            net.players = net.players.filter(function (p) { return p.index !== payload.index; });
            renderRoomPlayers(net.players, net.isHost ? net.socket.id : null);
            appendChatMessage(leftName + ' odadan ayrildi.', leftColor);
        }
    });
    net.socket.on('playerRejoined', function (payload) {
        if (G.state === 'playing' && G.players && G.players[payload.index]) {
            G.players[payload.index].isAI = false;
        }
        appendChatMessage((payload && payload.name ? payload.name : 'Bir oyuncu') + ' yeniden baglandi.', 'var(--success)');
    });

    net.socket.on('pongTick', function (payload) {
        if (!net.online) return;
        net.lastPingMs = Date.now() - payload.clientTs;
        var latencyTicks = net.lastPingMs / 2 / 33.33;
        var realServerTick = payload.serverTick + latencyTicks;
        net.syncDrift = G.tick - realServerTick;
    });

    net.socket.on('matchStarted', function (payload) {
        var players = payload.players || [];
        net.players = players;
        net.pendingJoin = false;
        net.resumePending = false;
        net.matchId = payload.matchId || '';
        net.authoritativeEnabled = payload && payload.authoritative === true;
        net.authoritativeReady = false;
        if (payload && payload.reconnectToken) {
            saveRoomResumeState({
                roomCode: payload.roomCode || net.roomCode,
                playerName: net.playerName,
                reconnectToken: payload.reconnectToken,
            });
        }
        var self = players.find(function (p) { return p.socketId === net.socket.id; });
        net.localPlayerIndex = self ? self.index : 0;
        net.online = true;
        net.pendingCommands = [];
        net.syncDrift = 0;
        net.lastPingTick = 0;
        net.lastAppliedSeq = -1;
        net.syncHashSentTick = -1;
        net.syncWarningTick = -99999;
        net.syncWarningText = '';
        net.syncHistory = [];
        net.commandHistory = [];
        net.resyncRequestId = '';
        net.lastSummaryTick = -1;
        net.lastPingWallMs = 0;

        var onlineCustomMap = payload && payload.mode === 'custom' && payload.customMap ? normalizeCustomMapConfig(payload.customMap) : null;
        initGame(payload.seed || '42', Number(payload.nodeCount || 16), payload.difficulty || 'normal', {
            keepReplay: false,
            keepTuning: false,
            fogEnabled: !!payload.fogEnabled,
            rulesMode: payload.rulesMode || 'advanced',
            humanCount: Number(payload.humanCount || players.length || 2),
            aiCount: Number(payload.aiCount || 0),
            localPlayerIndex: net.localPlayerIndex,
            mapFeature: payload.mapFeature || 'none',
            customMap: onlineCustomMap,
            tuneOverrides: onlineCustomMap ? onlineCustomMap.tuneOverrides || null : null,
        });
        G.campaign.active = false;
        G.campaign.levelIndex = -1;
        G.daily.active = payload.mode === 'daily' && !!payload.challenge;
        G.daily.challenge = G.daily.active ? payload.challenge : null;
        G.daily.reminderShown = {};
        if (G.daily.active) syncDailyChallengeState(payload.challenge);
        else { G.daily.bestTick = 0; G.daily.completed = false; }
        currentCustomMapConfig = onlineCustomMap;
        inp.sel.clear();
        clearChatMessages();
        for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = false;
        spIdx = 0;
        spdBtn.textContent = '1x';
        tuneFogCb.checked = G.tune.fogEnabled;
        if (menuFogCb) menuFogCb.checked = G.tune.fogEnabled;
        setRoomStatus(
            'Online mac basladi. Sen P' + (net.localPlayerIndex + 1) + ' oldun.' +
            (payload.mode === 'daily' && payload.challengeTitle ? (' | Gunluk: ' + payload.challengeTitle) : '') +
            (payload.mode === 'custom' && payload.customMapName ? (' | Custom: ' + payload.customMapName) : '') +
            (net.authoritativeEnabled ? ' | Sunucu state senkronu bekleniyor...' : ''),
            false
        );
        applyAudioPreference();
        showUI('playing');
        showGameToast('Ana menu icin sag ustteki CIKIS butonunu kullan.');
    });

    net.socket.on('roomCommand', function (cmd) {
        if (!net.online) return;
        if (net.authoritativeEnabled && net.authoritativeReady) return;
        if (cmd && cmd.matchId && net.matchId && cmd.matchId !== net.matchId) return;
        rememberNetworkCommand(cmd);
        net.pendingCommands.push(cmd);
    });

    net.socket.on('syncIssue', function (payload) {
        if (!net.online) return;
        if (!payload) return;
        net.syncWarningTick = G.tick;
        net.syncWarningText = 'Sync uyusmazligi tespit edildi (tick ' + payload.tick + '). Mac sonucu dogrulanmayabilir.';
        showGameToast(net.syncWarningText);
        setRoomStatus(net.syncWarningText, true);
    });
    net.socket.on('requestSyncSnapshot', function (payload) {
        if (!net.online || !payload || payload.matchId !== net.matchId) return;
        var entry = findSyncSnapshot(payload.tick, payload.hash);
        if (!entry) return;
        net.resyncRequestId = payload.requestId || '';
        net.socket.emit('syncSnapshot', {
            matchId: net.matchId,
            requestId: payload.requestId,
            tick: entry.tick,
            hash: entry.hash,
            snapshot: entry.snapshot,
        });
    });
    net.socket.on('syncSnapshot', function (payload) {
        handleIncomingSyncSnapshot(payload);
    });
    net.socket.on('authoritativeState', function (payload) {
        handleAuthoritativeState(payload);
    });

    net.socket.on('chat', function (payload) {
        appendChatMessage((payload.name || '?') + ': ' + (payload.message || ''));
    });
    net.socket.on('emote', function (payload) {
        appendChatMessage((payload.name || '?') + ': ' + (payload.emote || '').toUpperCase(), 'var(--accent)');
    });
    net.socket.on('rematchVote', function (payload) {
        appendChatMessage(payload.name + ' tekrar oynamak istiyor (' + payload.count + '/' + payload.total + ')', 'var(--success)');
    });
    net.socket.on('resultConflict', function (payload) {
        setRoomStatus((payload && payload.message) || 'Mac sonucu dogrulanamadi.', true);
    });
    net.socket.on('matchResultConfirmed', function (payload) {
        if (payload && payload.draw) appendChatMessage('Mac sonucu: Berabere', 'var(--text-dim)');
        else appendChatMessage('Mac sonucu onaylandi: ' + ((payload && payload.winnerName) || ('P' + ((payload && payload.winnerIndex >= 0) ? (payload.winnerIndex + 1) : '?'))), 'var(--text-dim)');
        setRoomStatus('Mac sonucu sunucu tarafinda onaylandi.', false);
    });
    net.socket.on('leaderboard', function (payload) {
        var el = document.getElementById('leaderboardList');
        if (!el) return;
        renderLeaderboardUI(el, payload || []);
    });
    net.socket.on('dailyChallenge', function (payload) {
        if (!payload) return;
        serverDailyChallenge = payload.challenge || null;
        refreshDailyChallengeCard();
    });
}
function normalizeReplay(raw) {
    if (!raw || !Array.isArray(raw.events)) throw new Error('Replay events missing');
    var nc = Number(raw.nc !== undefined ? raw.nc : raw.nodeCount);
    var diff = raw.diff !== undefined ? raw.diff : raw.difficulty;
    var seed = Number(raw.seed);
    var rulesMode = normalizeRulesetMode(raw.rulesMode || raw.mode || 'advanced');
    return {
        seed: isNaN(seed) ? 42 : seed,
        nc: isNaN(nc) ? 16 : nc,
        diff: (typeof diff === 'string' ? diff : 'normal'),
        rulesMode: rulesMode,
        events: raw.events.map(function (e) {
            return { tick: Number(e.tick) || 0, type: e.type, data: e.data || {} };
        }),
    };
}
function startReplayFromData(raw) {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    var rep = normalizeReplay(raw);
    initGame('' + rep.seed, rep.nc, rep.diff, { keepReplay: true, keepTuning: false, fogEnabled: false, rulesMode: rep.rulesMode });
    G.campaign.active = false;
    G.campaign.levelIndex = -1;
    G.daily.active = false;
    G.daily.challenge = null;
    G.daily.reminderShown = {};
    currentCustomMapConfig = null;
    G.rep = { events: rep.events, idx: 0, speed: 1, paused: false };
    spIdx = 0;
    spdBtn.textContent = '1x';
    repSpdLbl.textContent = '1x';
    repPauseBtn.textContent = 'Duraklat';
    showUI('replay');
}
// Menu
ncIn.addEventListener('input', function () { ncLbl.textContent = ncIn.value; });
var multiNodeIn = $('multiNodeInput'), multiNodeLbl = $('multiNodeLabel');
if (multiNodeIn && multiNodeLbl) multiNodeIn.addEventListener('input', function () { multiNodeLbl.textContent = multiNodeIn.value; });
var multiRoomTypeIn = $('multiRoomTypeSelect');
function syncRoomTypeInputs() {
    var roomMode = multiRoomTypeIn ? multiRoomTypeIn.value : 'standard';
    var locksMapConfig = roomMode === 'daily' || roomMode === 'custom';
    var multiSeed = $('multiSeedInput'), multiDiff = $('multiDiffSelect');
    if (multiSeed) multiSeed.disabled = !!locksMapConfig;
    if (multiNodeIn) multiNodeIn.disabled = !!locksMapConfig;
    if (multiDiff) multiDiff.disabled = !!locksMapConfig;
    if (multiModeSel) multiModeSel.disabled = !!locksMapConfig;
    if (multiNodeLbl) multiNodeLbl.style.opacity = locksMapConfig ? '0.45' : '1';
}
if (multiRoomTypeIn) {
    multiRoomTypeIn.addEventListener('change', function () {
        syncRoomTypeInputs();
    });
}
syncRoomTypeInputs();
if (gameModeSel && multiModeSel) {
    gameModeSel.addEventListener('change', function () { multiModeSel.value = gameModeSel.value; });
    multiModeSel.addEventListener('change', function () { gameModeSel.value = multiModeSel.value; });
}
rndSeedBtn.addEventListener('click', function () { seedIn.value = '' + Math.floor(Math.random() * 100000); });
var SCENARIO_UNLOCKED_KEY = 'stellar_scenario_unlocked_v1';
var SCENARIO_COMPLETED_KEY = 'stellar_scenario_completed_v1';
var LEGACY_CAMPAIGN_UNLOCKED_KEY = 'stellar_campaign_unlocked_v2';
var DAILY_CHALLENGE_STATE_KEY = 'stellar_daily_challenge_v1';
var ROOM_RESUME_STATE_KEY = 'stellar_room_resume_v1';
var campaignSelectedLevel = 0;
var currentCustomMapConfig = null;
var serverDailyChallenge = null;

function loadRoomResumeState() {
    try {
        var raw = localStorage.getItem(ROOM_RESUME_STATE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.roomCode || !parsed.playerName || !parsed.reconnectToken) return null;
        return {
            roomCode: String(parsed.roomCode).trim().toUpperCase(),
            playerName: String(parsed.playerName).trim(),
            reconnectToken: String(parsed.reconnectToken).trim(),
        };
    } catch (e) {
        return null;
    }
}
function saveRoomResumeState(info) {
    if (!info || !info.roomCode || !info.playerName || !info.reconnectToken) return;
    net.reconnectToken = String(info.reconnectToken || '');
    try {
        localStorage.setItem(ROOM_RESUME_STATE_KEY, JSON.stringify({
            roomCode: String(info.roomCode).trim().toUpperCase(),
            playerName: String(info.playerName).trim(),
            reconnectToken: String(info.reconnectToken).trim(),
        }));
    } catch (e) {}
}
function clearRoomResumeState() {
    net.reconnectToken = '';
    net.resumePending = false;
    try { localStorage.removeItem(ROOM_RESUME_STATE_KEY); } catch (e) {}
}
function maybeResumeOnlineRoom() {
    if (!net.socket || !net.connected || net.roomCode || net.resumePending) return false;
    var resume = loadRoomResumeState();
    if (!resume) return false;
    net.playerName = resume.playerName;
    net.reconnectToken = resume.reconnectToken;
    net.resumePending = true;
    setRoomStatus('Baglanti geri geldi. Mactaki koltuk geri aliniyor...', false);
    net.socket.emit('joinRoom', {
        action: 'join',
        playerName: resume.playerName,
        roomCode: resume.roomCode,
        reconnectToken: resume.reconnectToken,
    });
    return true;
}

function clampCampaignUnlocked(v) {
    var n = Math.floor(Number(v));
    if (!isFinite(n) || n < 1) n = 1;
    if (n > CAMPAIGN_LEVELS.length) n = CAMPAIGN_LEVELS.length;
    return n;
}
function clampCampaignCompleted(v) {
    var n = Math.floor(Number(v));
    if (!isFinite(n) || n < 0) n = 0;
    if (n > CAMPAIGN_LEVELS.length) n = CAMPAIGN_LEVELS.length;
    return n;
}
function loadCampaignUnlocked() {
    try {
        var raw = localStorage.getItem(SCENARIO_UNLOCKED_KEY);
        if (raw === null || raw === undefined) raw = localStorage.getItem(LEGACY_CAMPAIGN_UNLOCKED_KEY);
        return clampCampaignUnlocked(raw ? parseInt(raw, 10) : 1);
    } catch (e) {
        return 1;
    }
}
function loadCampaignCompleted() {
    try {
        var raw = localStorage.getItem(SCENARIO_COMPLETED_KEY);
        if (raw === null || raw === undefined) {
            var legacyUnlock = localStorage.getItem(SCENARIO_UNLOCKED_KEY);
            if (legacyUnlock === null || legacyUnlock === undefined) legacyUnlock = localStorage.getItem(LEGACY_CAMPAIGN_UNLOCKED_KEY);
            if (legacyUnlock !== null && legacyUnlock !== undefined) {
                return clampCampaignCompleted(Math.max(0, parseInt(legacyUnlock, 10) - 1));
            }
        }
        return clampCampaignCompleted(raw ? parseInt(raw, 10) : 0);
    } catch (e) {
        return 0;
    }
}
function saveCampaignUnlocked(v) {
    var clamped = clampCampaignUnlocked(v);
    G.campaign.unlocked = clamped;
    try { localStorage.setItem(SCENARIO_UNLOCKED_KEY, '' + clamped); } catch (e) {}
}
function saveCampaignCompleted(v) {
    var clamped = clampCampaignCompleted(v);
    G.campaign.completed = clamped;
    try { localStorage.setItem(SCENARIO_COMPLETED_KEY, '' + clamped); } catch (e) {}
}
function loadDailyChallengeStore() {
    try {
        var raw = localStorage.getItem(DAILY_CHALLENGE_STATE_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}
function saveDailyChallengeStore(store) {
    try { localStorage.setItem(DAILY_CHALLENGE_STATE_KEY, JSON.stringify(store || {})); } catch (e) {}
}
function getDailyChallengeProgress(key) {
    var store = loadDailyChallengeStore();
    var entry = store && store[key] && typeof store[key] === 'object' ? store[key] : {};
    var bestTick = Math.max(0, Math.floor(Number(entry.bestTick) || 0));
    return {
        completed: entry.completed === true,
        bestTick: bestTick,
    };
}
function saveDailyChallengeProgress(key, didWin, tick) {
    var store = loadDailyChallengeStore();
    var entry = store[key] && typeof store[key] === 'object' ? store[key] : {};
    if (didWin) entry.completed = true;
    var nextTick = Math.max(0, Math.floor(Number(tick) || 0));
    if (didWin && nextTick > 0 && (!entry.bestTick || nextTick < entry.bestTick)) entry.bestTick = nextTick;
    store[key] = entry;
    saveDailyChallengeStore(store);
    return getDailyChallengeProgress(key);
}
function syncDailyChallengeState(challenge) {
    var progress = challenge ? getDailyChallengeProgress(challenge.key) : { completed: false, bestTick: 0 };
    G.daily.bestTick = progress.bestTick;
    G.daily.completed = progress.completed;
}
function todayDailyChallenge() {
    return serverDailyChallenge || buildDailyChallenge(dailyChallengeKey(new Date()));
}
function campaignFeatureName(feature) {
    if (!feature) return 'Standart';
    if (typeof feature === 'string') {
        if (feature === 'wormhole') return 'Wormhole';
        if (feature === 'gravity') return 'Gravity';
        if (feature === 'barrier') return 'Barrier';
        if (feature === 'none') return 'Yok';
        return 'Rastgele';
    }
    if (feature.type === 'wormhole') return 'Wormhole';
    if (feature.type === 'gravity') return 'Gravity';
    if (feature.type === 'barrier') return 'Barrier';
    if (feature.type === 'none') return 'Yok';
    return 'Rastgele';
}
function campaignSystemsSummary(level) {
    var parts = [
        'Pulse hublari gecici tempo bonusu verir',
        'Strain capin %' + Math.round(CAP_SOFT_START * 100) + '\'inde baslar',
        'Defense asimilasyonu hizlandirir ama uretimi keser',
        'Asimile gezegenler yakin savunma alani acar',
        'Turretler artik daha sert kusatma hedefidir',
    ];
    var rulesMode = (level && level.rulesMode) || 'advanced';
    if (rulesMode === 'advanced') parts.push('Supply altindaki node daha ucuza upgrade olur');
    return parts.join(' | ');
}
function campaignFeatureHint(level) {
    var feature = level ? level.mapFeature : null;
    var featureType = typeof feature === 'string' ? feature : ((feature && feature.type) || 'none');
    if (featureType === 'wormhole') return 'Wormhole: bagli iki uc arasinda filolar 2.0x hizla gider. Uzun rota yerine wormhole eksenini tut.';
    if (featureType === 'gravity') return 'Gravity: merkez alani filolari 1.35x hizlandirir. Merkezden gecen rota hem baskin hem savunmada avantaja doner.';
    if (featureType === 'barrier') return 'Barrier: karsi tarafa gecmek icin GATE gezegenini al ve asimilasyon tamamlanana kadar tut.';
    if (featureType === 'auto') return 'Anomali: harita tek bir ozel mekanikle acilir. Ilk dakikada ne oldugunu gozleyip plana hizla don.';
    return 'Standart harita: supply zinciri, pulse zamani ve savunma alani kullanimi macin temposunu belirler.';
}
function campaignLevelSummary(level) {
    return 'Bolum ' + level.id + ': ' + level.name + '\n' +
        level.blurb + '\n' +
        'Nodes: ' + level.nc + ' | AI: ' + level.aiCount + ' | Diff: ' + level.diff.toUpperCase() +
        ' | Feature: ' + campaignFeatureName(level.mapFeature) + (level.fog ? ' | Fog ON' : ' | Fog OFF') + '\n' +
        'Harita Dersi: ' + campaignFeatureHint(level) + '\n' +
        'Systems: ' + campaignSystemsSummary(level) + '\n' +
        'Objectives: ' + describeCampaignObjectives(level, { tickRate: TICK_RATE }) + '\n' +
        'Plan: ' + (level.hint || 'Map temposunu pulse, supply ve savunma alani ile yonet.');
}
function refreshDailyChallengeCard() {
    if (!dailyChallengeCard) return;
    var challenge = todayDailyChallenge();
    var progress = getDailyChallengeProgress(challenge.key);
    renderMissionPanel(dailyChallengeCard, {
        title: 'Bugunun Challenge\'i',
        subtitle: challenge.key + ' | ' + challenge.blurb + (progress.completed ? ' | Temizlendi' : (progress.bestTick > 0 ? ' | En iyi: ' + progress.bestTick + ' tick' : ' | Henuz temizlenmedi')),
        items: evaluateCampaignObjectives(challenge, {
            tick: 0,
            didWin: false,
            gameOver: false,
            ownedNodes: 0,
            stats: {},
        }, { tickRate: TICK_RATE }).map(function (row) {
            return { label: row.label, progressText: row.optional ? 'Bonus' : 'Ana', optional: row.optional };
        }),
    });
}
function refreshCustomMapStatus() {
    if (!customMapStatusEl) return;
    if (!currentCustomMapConfig) {
        customMapStatusEl.textContent = 'Custom map yukleyip baslangic duzenini, anomalileri ve acilis node sahipliklerini sabitleyebilirsin.';
        return;
    }
    customMapStatusEl.textContent =
        'Hazir custom map: ' + currentCustomMapConfig.name +
        ' | ' + currentCustomMapConfig.nodes.length + ' node' +
        ' | ' + currentCustomMapConfig.playerCount + ' oyuncu' +
        ' | ' + campaignFeatureName(currentCustomMapConfig.mapFeature);
}
function applyCampaignLevelSelection(levelIndex) {
    var unlocked = G.campaign.unlocked || 1;
    var idx = Math.max(0, Math.min(CAMPAIGN_LEVELS.length - 1, Math.floor(Number(levelIndex) || 0)));
    if (idx >= unlocked) idx = unlocked - 1;
    campaignSelectedLevel = idx;
    return idx;
}
function refreshCampaignUI() {
    if (!scenarioProgressEl || !scenarioBubbleListEl || !scenarioMissionEl) return;
    var unlocked = G.campaign.unlocked || 1;
    var completed = G.campaign.completed || 0;
    if (!isFinite(unlocked) || unlocked < 1) unlocked = 1;
    unlocked = Math.min(CAMPAIGN_LEVELS.length, unlocked);
    completed = clampCampaignCompleted(completed);
    if (completed > unlocked) unlocked = completed;
    G.campaign.unlocked = unlocked;
    G.campaign.completed = completed;
    applyCampaignLevelSelection(campaignSelectedLevel);

    scenarioProgressEl.textContent = 'Gecilen: ' + completed + ' / ' + CAMPAIGN_LEVELS.length + '  |  Acilan: ' + unlocked + ' / ' + CAMPAIGN_LEVELS.length;
    scenarioBubbleListEl.replaceChildren();
    for (var i = 0; i < CAMPAIGN_LEVELS.length; i++) {
        var lvl = CAMPAIGN_LEVELS[i];
        var bubble = document.createElement('button');
        bubble.type = 'button';
        bubble.className = 'scenario-bubble';
        bubble.textContent = '' + lvl.id;
        if (i < unlocked) bubble.classList.add('unlocked');
        else bubble.classList.add('locked');
        if (i < completed) bubble.classList.add('done');
        if (i === campaignSelectedLevel) bubble.classList.add('selected');
        var status = i < completed ? 'Gecildi' : (i < unlocked ? 'Acik' : 'Kilitli');
        bubble.title = 'Bolum ' + lvl.id + ' - ' + lvl.name + ' (' + status + ')';
        if (i < unlocked) {
            (function (idx) {
                bubble.addEventListener('click', function () {
                    applyCampaignLevelSelection(idx);
                    refreshCampaignUI();
                });
            })(i);
        } else {
            bubble.disabled = true;
        }
        scenarioBubbleListEl.appendChild(bubble);
    }
    var selected = CAMPAIGN_LEVELS[campaignSelectedLevel];
    var selectedDone = campaignSelectedLevel < completed;
    renderMissionPanel(scenarioMissionEl, {
        title: 'Bolum ' + selected.id + ': ' + selected.name,
        subtitle: selected.blurb + ' | AI ' + selected.aiCount + ' | ' + selected.diff.toUpperCase() + ' | ' + campaignFeatureName(selected.mapFeature) + ' | ' + (selectedDone ? 'Durum: Gecildi' : 'Durum: Hazir'),
        items: evaluateCampaignObjectives(selected, {
            tick: 0,
            didWin: false,
            gameOver: false,
            ownedNodes: 0,
            stats: {},
        }, { tickRate: TICK_RATE }).map(function (row) {
            return { label: row.label, progressText: row.optional ? 'Bonus' : 'Ana', optional: row.optional };
        }),
    });
    if (scenarioStartBtn) scenarioStartBtn.textContent = 'Bolum ' + selected.id + ' Baslat';
}
function resetSelectionAndSpeed() {
    inp.sel.clear();
    for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = false;
    spIdx = 0;
    if (spdBtn) spdBtn.textContent = '1x';
}
function finalizeLocalGameStart(fogOn) {
    G.campaign.active = false;
    G.campaign.levelIndex = -1;
    G.daily.active = false;
    G.daily.challenge = null;
    G.daily.reminderShown = {};
    G.daily.bestTick = 0;
    G.daily.completed = false;
    resetSelectionAndSpeed();
    if (tuneFogCb) tuneFogCb.checked = !!fogOn;
    applyAudioPreference();
    showUI('playing');
}
function startSinglePlayerGame() {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    currentCustomMapConfig = null;
    var fogOn = menuFogCb ? !!menuFogCb.checked : false;
    var nc = (ncIn && ncIn.value) ? parseInt(ncIn.value, 10) : 16;
    nc = (isNaN(nc) || nc < 8 || nc > 30) ? 16 : nc;
    initGame((seedIn && seedIn.value) || '42', nc, (diffSel && diffSel.value) || 'normal', {
        fogEnabled: fogOn,
        rulesMode: (gameModeSel && gameModeSel.value) || 'advanced',
    });
    finalizeLocalGameStart(fogOn);
    refreshCustomMapStatus();
}
function startSandboxGame() {
    startSinglePlayerGame();
    tuningOpen = true;
    if (tunePanel && tuneOpen && G.state === 'playing') {
        tunePanel.classList.remove('hidden');
        tuneOpen.classList.add('hidden');
    }
}
function startDailyChallengeGame() {
    var challenge = todayDailyChallenge();
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    currentCustomMapConfig = null;
    syncDailyChallengeState(challenge);
    initGame(challenge.seed, challenge.nc, challenge.diff, {
        fogEnabled: !!challenge.fog,
        aiCount: challenge.aiCount,
        mapFeature: challenge.mapFeature || 'auto',
        rulesMode: challenge.rulesMode || 'advanced',
    });
    G.campaign.active = false;
    G.campaign.levelIndex = -1;
    G.daily.active = true;
    G.daily.challenge = challenge;
    G.daily.reminderShown = {};
    syncDailyChallengeState(challenge);
    resetSelectionAndSpeed();
    if (menuFogCb) menuFogCb.checked = !!challenge.fog;
    if (tuneFogCb) tuneFogCb.checked = !!challenge.fog;
    applyAudioPreference();
    showUI('playing');
    showGameToast('Gunluk challenge acildi: ' + challenge.title);
}
function startCustomMapGame(customMap) {
    var normalized = normalizeCustomMapConfig(customMap);
    if (!normalized || !normalized.nodes || normalized.nodes.length < 4) return;
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    currentCustomMapConfig = normalized;
    initGame(normalized.seed || 'custom-map', normalized.nodes.length, normalized.difficulty || 'normal', {
        fogEnabled: !!normalized.fogEnabled,
        aiCount: Math.max(0, normalized.playerCount - 1),
        rulesMode: normalized.rulesMode || 'advanced',
        tuneOverrides: normalized.tuneOverrides || null,
        customMap: normalized,
    });
    finalizeLocalGameStart(normalized.fogEnabled);
    showGameToast('Custom map yuklendi: ' + normalized.name);
    refreshCustomMapStatus();
}
function exportCurrentMapState() {
    if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'gameOver') {
        if (currentCustomMapConfig) {
            var presetBlob = new Blob([JSON.stringify(currentCustomMapConfig, null, 2)], { type: 'application/json' });
            var presetUrl = URL.createObjectURL(presetBlob);
            var presetLink = document.createElement('a');
            presetLink.href = presetUrl;
            presetLink.download = (currentCustomMapConfig.name || 'stellar-map').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.json';
            presetLink.click();
            URL.revokeObjectURL(presetUrl);
            showGameToast('Hazir custom map disa aktarıldi.');
            return;
        }
        showGameToast('Disa aktarmak icin once bir mac ac.');
        return;
    }
    var exported = buildCustomMapExport({
        seed: G.seed,
        diff: G.diff,
        rulesMode: G.rulesMode,
        tune: G.tune,
        nodes: G.nodes,
        players: G.players,
        wormholes: G.wormholes,
        mapFeature: G.mapFeature,
        strategicNodes: G.strategicNodes,
        playerCapital: G.playerCapital,
    }, {
        name: (G.daily.active && G.daily.challenge ? ('daily-' + G.daily.challenge.key) : (G.campaign.active ? ('campaign-' + ((currentCampaignLevel() && currentCampaignLevel().id) || 'map')) : ('map-' + G.seed))),
        seed: '' + G.seed,
        difficulty: G.diff,
        fogEnabled: !!G.tune.fogEnabled,
        rulesMode: G.rulesMode,
    });
    var blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (exported.name || 'stellar-map').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.json';
    link.click();
    URL.revokeObjectURL(url);
    showGameToast('Harita JSON olarak disa aktarıldi.');
}
function startCampaignLevel(levelIndex) {
    var idx = applyCampaignLevelSelection(levelIndex);
    var lvl = CAMPAIGN_LEVELS[idx];
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    initGame(lvl.seed, lvl.nc, lvl.diff, {
        fogEnabled: !!lvl.fog,
        aiCount: lvl.aiCount,
        mapFeature: lvl.mapFeature || 'auto',
        tuneOverrides: lvl.tune || null,
        rulesMode: lvl.rulesMode || 'advanced',
    });
    G.campaign.active = true;
    G.campaign.levelIndex = idx;
    G.campaign.reminderShown = {};
    G.daily.active = false;
    G.daily.challenge = null;
    G.daily.reminderShown = {};
    G.daily.bestTick = 0;
    G.daily.completed = false;
    currentCustomMapConfig = null;
    if (menuFogCb) menuFogCb.checked = !!lvl.fog;
    if (tuneFogCb) tuneFogCb.checked = !!lvl.fog;
    resetSelectionAndSpeed();
    applyAudioPreference();
    closeScenarioMenu();
    showUI('playing');
    if (lvl.hint) {
        setTimeout(function () {
            if (G.campaign.active && G.campaign.levelIndex === idx && G.state === 'playing') showGameToast('Bolum ipucu: ' + lvl.hint);
        }, 1200);
    }
    refreshCampaignMissionPanels();
    refreshCampaignUI();
}
function completeCampaignLevel() {
    if (!G.campaign.active || G.campaign.levelIndex < 0) return;
    var completedNow = Math.max(G.campaign.completed || 0, G.campaign.levelIndex + 1);
    saveCampaignCompleted(completedNow);
    var nextUnlock = Math.max(G.campaign.unlocked || 1, G.campaign.levelIndex + 2);
    saveCampaignUnlocked(nextUnlock);
    campaignSelectedLevel = Math.min(CAMPAIGN_LEVELS.length - 1, Math.max(0, nextUnlock - 1));
    refreshCampaignUI();
}

G.campaign.unlocked = loadCampaignUnlocked();
G.campaign.completed = loadCampaignCompleted();
if (G.campaign.completed > G.campaign.unlocked) G.campaign.unlocked = G.campaign.completed;
campaignSelectedLevel = Math.max(0, Math.min((G.campaign.unlocked || 1) - 1, CAMPAIGN_LEVELS.length - 1));
if (sandboxBtn) {
    sandboxBtn.addEventListener('click', function () {
        startSandboxGame();
    });
}
if (scenarioStartBtn) {
    scenarioStartBtn.addEventListener('click', function () {
        startCampaignLevel(campaignSelectedLevel);
    });
}
if (scenarioCloseBtn) {
    scenarioCloseBtn.addEventListener('click', function () {
        closeScenarioMenu();
    });
}
if (scenarioOv) {
    scenarioOv.addEventListener('click', function (e) {
        if (e.target === scenarioOv) closeScenarioMenu();
    });
}
refreshCampaignUI();
refreshDailyChallengeCard();
refreshCustomMapStatus();
if (startBtn) {
    startBtn.addEventListener('click', function () {
        startSinglePlayerGame();
    });
}
if (campaignBtn) {
    campaignBtn.addEventListener('click', function () {
        openScenarioMenu();
    });
}
if (dailyChallengeBtn) {
    dailyChallengeBtn.addEventListener('click', function () {
        startDailyChallengeGame();
    });
}
if (importMapBtn) {
    importMapBtn.addEventListener('click', function () {
        if (customMapFileIn) customMapFileIn.click();
    });
}
if (exportMapBtn) {
    exportMapBtn.addEventListener('click', function () {
        exportCurrentMapState();
    });
}
if (exportMapHudBtn) {
    exportMapHudBtn.addEventListener('click', function () {
        exportCurrentMapState();
    });
}
if (customMapFileIn) {
    customMapFileIn.addEventListener('change', function () {
        var file = customMapFileIn.files && customMapFileIn.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var normalized = normalizeCustomMapConfig(JSON.parse(reader.result));
                startCustomMapGame(normalized);
            } catch (err) {
                alert('Custom map yuklenemedi: ' + err);
            }
            customMapFileIn.value = '';
        };
        reader.readAsText(file);
    });
}

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
pauseBtn.addEventListener('click', function () {
    togglePauseMenu();
});
resumeBtn.addEventListener('click', function () {
    closePauseMenu();
});
quitBtn.addEventListener('click', function () {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState(net.online ? 'Mactan ayrildin. Yerine AI devam ediyor.' : '');
    G.state = 'mainMenu'; showUI('mainMenu');
});
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', function () {
        setAudioEnabled(!uiPrefs.audioEnabled);
        showGameToast(uiPrefs.audioEnabled ? 'Ses acildi.' : 'Ses kapatildi.');
    });
}
if (hudInfoToggleBtn) {
    hudInfoToggleBtn.addEventListener('click', function () {
        setHudTelemetryVisible(!uiPrefs.hudTelemetryVisible);
        showGameToast(uiPrefs.hudTelemetryVisible ? 'Tick bilgisi acildi.' : 'Tick bilgisi kapatildi.');
    });
}
var speeds = [1, 2, 4], spIdx = 0;
spdBtn.addEventListener('click', function () { if (net.online) return; spIdx = (spIdx + 1) % 3; G.speed = speeds[spIdx]; spdBtn.textContent = G.speed + 'x'; recEvt('speed', { speed: G.speed }); });
var themeBtn = $('themeBtn');
function syncThemeButton() {
    if (!themeBtn) return;
    themeBtn.textContent = document.body.classList.contains('theme-light') ? 'KOYU' : 'ACIK';
}
if (themeBtn) themeBtn.addEventListener('click', function () {
    document.body.classList.toggle('theme-light');
    syncThemeButton();
});
syncThemeButton();
var chatPanel = $('chatPanel'), chatInput = $('chatInput'), chatToggle = $('chatToggle');
if (chatToggle) chatToggle.addEventListener('click', function () {
    if (chatPanel) chatPanel.classList.toggle('hidden');
});
if (chatInput) chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        if (net.socket && net.roomCode) net.socket.emit('chat', { message: chatInput.value.trim() });
        chatInput.value = '';
    }
});
document.querySelectorAll('.emote-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var em = btn.getAttribute('data-emote');
        if (em && net.socket && net.roomCode) net.socket.emit('emote', { emote: em });
    });
});
var rematchBtn = $('rematchBtn');
if (rematchBtn) rematchBtn.addEventListener('click', function () {
    if (net.socket && net.roomCode) net.socket.emit('requestRematch');
});
var leaderboardBtn = $('leaderboardBtn'), leaderboardOv = $('leaderboardOverlay'), leaderboardList = $('leaderboardList'), leaderboardClose = $('leaderboardClose');
if (leaderboardBtn) leaderboardBtn.addEventListener('click', function () {
    if (leaderboardOv) leaderboardOv.classList.remove('hidden');
    if (net.socket && net.connected) net.socket.emit('requestLeaderboard');
});
if (leaderboardClose) leaderboardClose.addEventListener('click', function () { if (leaderboardOv) leaderboardOv.classList.add('hidden'); });
function syncSendQuickButtons() {
    for (var i = 0; i < sendPctQuickBtns.length; i++) {
        var btn = sendPctQuickBtns[i];
        var pct = parseInt(btn.getAttribute('data-send-pct') || '0', 10);
        if (pct === inp.sendPct) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}
function setSendPct(pct) {
    var next = clamp(Math.round(Number(pct) || 50), 10, 100);
    inp.sendPct = next;
    if (sendPctIn) sendPctIn.value = '' + next;
    if (hudPct) hudPct.textContent = 'Send: ' + next + '%';
    syncSendQuickButtons();
}
sendPctIn.addEventListener('input', function () { setSendPct(parseInt(sendPctIn.value, 10)); });
for (var sqi = 0; sqi < sendPctQuickBtns.length; sqi++) {
    (function (btn) {
        btn.addEventListener('click', function () {
            var pct = parseInt(btn.getAttribute('data-send-pct') || '50', 10);
            setSendPct(pct);
        });
    })(sendPctQuickBtns[sqi]);
}
syncSendQuickButtons();
repBtn.addEventListener('click', function () { if (lastRepData) startReplayFromData(lastRepData); });
expRepBtn.addEventListener('click', function () { if (!lastRepData) return; var b = new Blob([JSON.stringify(lastRepData, null, 2)], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'replay-' + lastRepData.seed + '.json'; a.click(); URL.revokeObjectURL(u); });
if (nextLevelBtn) nextLevelBtn.addEventListener('click', function () {
    if (!G.campaign.active || G.campaign.levelIndex < 0) return;
    var nextIdx = G.campaign.levelIndex + 1;
    if (nextIdx >= CAMPAIGN_LEVELS.length) {
        G.state = 'mainMenu';
        showUI('mainMenu');
        return;
    }
    campaignSelectedLevel = nextIdx;
    startCampaignLevel(nextIdx);
});
restartBtn.addEventListener('click', function () { G.state = 'mainMenu'; showUI('mainMenu'); });
repSlower.addEventListener('click', function () { if (G.rep) G.rep.speed = Math.max(0.25, G.rep.speed / 2); repSpdLbl.textContent = (G.rep ? G.rep.speed : 1) + 'x'; });
repFaster.addEventListener('click', function () { if (G.rep) G.rep.speed = Math.min(8, G.rep.speed * 2); repSpdLbl.textContent = (G.rep ? G.rep.speed : 1) + 'x'; });
repPauseBtn.addEventListener('click', function () { if (G.rep) { G.rep.paused = !G.rep.paused; repPauseBtn.textContent = G.rep.paused ? 'Oynat' : 'Duraklat'; } });
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

// Ã¢â€â‚¬Ã¢â€â‚¬ CANVAS MOUSE Ã¢â€â‚¬Ã¢â€â‚¬
cv.addEventListener('mousedown', function (e) {
    if (G.state !== 'playing') return; var w = s2w(e.offsetX, e.offsetY); inp.mw = w; inp.ms = { x: e.offsetX, y: e.offsetY };
    if (e.button === 1) { inp.panActive = true; inp.panLast = { x: e.offsetX, y: e.offsetY }; e.preventDefault(); return; }
    if (e.button === 2) {
        var nd = hitNode(w);
        var selectedOwnedSources = 0;
        inp.sel.forEach(function (sid) {
            var sn = G.nodes[sid];
            if (sn && sn.owner === G.human) selectedOwnedSources++;
        });
        var rightClickAction = resolveRightClickAction({
            targetExists: !!nd,
            targetOwnerIsHuman: !!(nd && nd.owner === G.human),
            targetSelected: !!(nd && inp.sel.has(nd.id)),
            selectedOwnedCount: selectedOwnedSources,
        });
        if (rightClickAction === 'defense' && nd && nd.owner === G.human) {
            var defIds = inp.sel.has(nd.id) && inp.sel.size > 0 ? Array.from(inp.sel) : [nd.id];
            if (issueOnlineCommand('toggleDefense', { nodeIds: defIds })) { } else {
                defIds.forEach(function (id) { toggleDefense(G.human, id); });
                recEvt('toggleDefense', { nodeIds: defIds });
            }
        } else if (rightClickAction === 'flow' && nd) {
            inp.sel.forEach(function (sid) {
                var sn = G.nodes[sid];
                if (sn && sn.owner === G.human && sid !== nd.id) {
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
    inp.dragPending = false;
    inp.dragDownNodeId = -1;
    if (cn && cn.owner === G.human && inp.sel.size > 0 && !inp.sel.has(cn.id) && !e.shiftKey) {
        if (sendFromSelectionTo(cn.id)) return;
    }

    if (cn && cn.owner === G.human) {
        var dragSources = [];
        if (inp.sel.has(cn.id) && inp.sel.size > 0) {
            inp.sel.forEach(function (sid) {
                var sn = G.nodes[sid];
                if (sn && sn.owner === G.human) dragSources.push(sid);
            });
        } else {
            G.nodes.forEach(function (n) { n.selected = false; });
            inp.sel.clear();
            cn.selected = true;
            inp.sel.add(cn.id);
            dragSources = [cn.id];
            if (typeof AudioFX !== 'undefined') AudioFX.select();
            recEvt('select', { ids: Array.from(inp.sel), append: false });
        }
        if (dragSources.length > 0) {
            inp.dragPending = true;
            inp.dragDownNodeId = cn.id;
            inp.dragDownScreen = { x: e.offsetX, y: e.offsetY };
            inp.dragSrcs = dragSources;
            var startPt = centroidForSources(dragSources);
            inp.dragStart = startPt || { x: cn.pos.x, y: cn.pos.y };
            inp.dragEnd = w;
        }
        return;
    }

    if (cn && inp.sel.size > 0) {
        sendFromSelectionTo(cn.id);
        return;
    }

    if (!cn) {
        if (!e.shiftKey) { G.nodes.forEach(function (n) { n.selected = false; }); inp.sel.clear(); recEvt('deselect', {}); }
        inp.marqActive = true; inp.marqStart = { x: e.offsetX, y: e.offsetY }; inp.marqEnd = { x: e.offsetX, y: e.offsetY };
    }
});
cv.addEventListener('mousemove', function (e) {
    var w = s2w(e.offsetX, e.offsetY); inp.mw = w; inp.ms = { x: e.offsetX, y: e.offsetY };
    if (inp.panActive) { var dx = (e.offsetX - inp.panLast.x) / G.cam.zoom, dy = (e.offsetY - inp.panLast.y) / G.cam.zoom; G.cam.x -= dx; G.cam.y -= dy; inp.panLast = { x: e.offsetX, y: e.offsetY }; return; }
    if (inp.dragPending && !inp.dragActive) {
        var mdx = e.offsetX - inp.dragDownScreen.x;
        var mdy = e.offsetY - inp.dragDownScreen.y;
        var movedPx = Math.sqrt(mdx * mdx + mdy * mdy);
        if (shouldStartDragSend({ downOnOwnedNode: inp.dragDownNodeId >= 0, movedPx: movedPx, thresholdPx: inp.dragThreshold })) {
            beginDragSend(inp.dragSrcs, w);
        }
    }
    if (inp.dragActive) { inp.dragEnd = w; return; }
    if (inp.marqActive) { inp.marqEnd = { x: e.offsetX, y: e.offsetY }; }
});
cv.addEventListener('mouseup', function (e) {
    if (e.button === 1) { inp.panActive = false; return; }
    if (inp.dragActive) {
        var w = s2w(e.offsetX, e.offsetY), tn = hitNode(w);
        if (tn && inp.dragSrcs.length > 0) sendFromSourcesTo(inp.dragSrcs, tn.id);
        inp.dragActive = false; inp.dragPending = false; inp.dragDownNodeId = -1; inp.dragSrcs = []; return;
    }
    inp.dragPending = false;
    inp.dragDownNodeId = -1;
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
cv.addEventListener('touchstart', function (e) {
    if ((G.state === 'playing' || G.state === 'replay') && e.touches.length === 2) {
        beginTouchPinch(touchScreenPos(e.touches[0]), touchScreenPos(e.touches[1]));
        e.preventDefault();
        return;
    }
    if (e.touches.length === 1 && G.state === 'playing') {
        var pos = touchScreenPos(e.touches[0]);
        inp.touchStart = pos;
        inp.pinchActive = false;
        inp.dragPending = false;
        inp.dragDownNodeId = -1;
        var w = s2w(pos.x, pos.y); var cn = hitNode(w);
        if (cn && cn.owner === G.human && inp.sel.size > 0 && !inp.sel.has(cn.id)) {
            if (sendFromSelectionTo(cn.id)) { e.preventDefault(); return; }
        }
        if (cn && cn.owner === G.human) {
            var touchSources = [];
            if (inp.sel.has(cn.id) && inp.sel.size > 0) {
                inp.sel.forEach(function (sid) {
                    var sn = G.nodes[sid];
                    if (sn && sn.owner === G.human) touchSources.push(sid);
                });
            } else {
                G.nodes.forEach(function (n) { n.selected = false; });
                inp.sel.clear();
                cn.selected = true;
                inp.sel.add(cn.id);
                touchSources = [cn.id];
                if (typeof AudioFX !== 'undefined') AudioFX.select();
                recEvt('select', { ids: Array.from(inp.sel), append: false });
            }
            inp.dragPending = true;
            inp.dragDownNodeId = cn.id;
            inp.dragDownScreen = { x: pos.x, y: pos.y };
            inp.dragSrcs = touchSources;
            var touchStartPt = centroidForSources(touchSources);
            inp.dragStart = touchStartPt || { x: cn.pos.x, y: cn.pos.y };
            inp.dragEnd = w;
        } else if (cn && inp.sel.size > 0) {
            sendFromSelectionTo(cn.id);
        } else {
            inp.marqActive = true; inp.marqStart = pos; inp.marqEnd = pos;
        }
        e.preventDefault();
    }
}, { passive: false });
cv.addEventListener('touchmove', function (e) {
    if ((G.state === 'playing' || G.state === 'replay') && e.touches.length === 2) {
        var posA = touchScreenPos(e.touches[0]);
        var posB = touchScreenPos(e.touches[1]);
        if (!inp.pinchActive) beginTouchPinch(posA, posB);
        updateTouchPinch(posA, posB);
        e.preventDefault();
        return;
    }
    if (e.touches.length === 1 && G.state === 'playing') {
        var pos = touchScreenPos(e.touches[0]);
        var w = s2w(pos.x, pos.y);
        if (inp.dragPending && !inp.dragActive) {
            var mdx = pos.x - inp.dragDownScreen.x;
            var mdy = pos.y - inp.dragDownScreen.y;
            var movedPx = Math.sqrt(mdx * mdx + mdy * mdy);
            if (shouldStartDragSend({ downOnOwnedNode: inp.dragDownNodeId >= 0, movedPx: movedPx, thresholdPx: inp.dragThreshold })) {
                beginDragSend(inp.dragSrcs, w);
            }
        }
        if (inp.dragActive) inp.dragEnd = w;
        else if (inp.marqActive) inp.marqEnd = pos;
        e.preventDefault();
    }
}, { passive: false });
cv.addEventListener('touchend', function (e) {
    if (inp.pinchActive && e.touches.length < 2) {
        inp.pinchActive = false;
        if (e.touches.length === 1) {
            inp.dragPending = false;
            inp.dragActive = false;
        }
    }
    if (e.changedTouches.length === 1 && G.state === 'playing') {
        var pos = touchScreenPos(e.changedTouches[0]);
        var w = s2w(pos.x, pos.y);
        if (inp.dragActive) {
            var tn = hitNode(w);
            if (tn && inp.dragSrcs.length > 0) sendFromSourcesTo(inp.dragSrcs, tn.id);
            inp.dragActive = false;
            inp.dragPending = false;
            inp.dragDownNodeId = -1;
            inp.dragSrcs = [];
        } else if (inp.marqActive) {
            var sw = s2w(inp.marqStart.x, inp.marqStart.y), ew = s2w(pos.x, pos.y), ids = nodesInRect(sw, ew, G.human);
            if (ids.length > 0) { G.nodes.forEach(function (n) { n.selected = false; }); inp.sel.clear(); ids.forEach(function (id) { G.nodes[id].selected = true; inp.sel.add(id); }); }
            inp.marqActive = false;
        } else {
            inp.dragPending = false;
            inp.dragDownNodeId = -1;
        }
    }
}, { passive: false });
window.addEventListener('keydown', function (e) {
    var pauseKey = e.key === 'Escape' || e.key === 'p' || e.key === 'P';
    if (G.state === 'playing') {
        if (pauseKey) {
            togglePauseMenu();
            e.preventDefault();
            return;
        }
        if (inGameMenuOpen) return;
        if (e.key === 'a') { G.nodes.forEach(function (n) { if (n.owner === G.human) { n.selected = true; inp.sel.add(n.id); } }); }
        if (e.key === 'u' || e.key === 'U') {
            var targetIds = Array.from(inp.sel);
            if (targetIds.length > 0) {
                if (issueOnlineCommand('upgrade', { nodeIds: targetIds })) {
                } else {
                    var upgraded = [];
                    inp.sel.forEach(function (id) { if (upgradeNode(G.human, id)) upgraded.push(id); });
                    if (upgraded.length > 0) recEvt('upgrade', { nodeIds: upgraded });
                }
            }
        }
        if (e.key >= '1' && e.key <= '9') {
            setSendPct(parseInt(e.key, 10) * 10);
        } else if (e.key === '0') {
            setSendPct(100);
        }
    }
    else if (G.state === 'paused') {
        if (pauseKey) {
            closePauseMenu();
            e.preventDefault();
        }
    }
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GAME LOOP Ã¢â€â‚¬Ã¢â€â‚¬
var acc = 0, lastT = 0, prevSt = 'mainMenu';
function loop(ts) {
    var rawDt = Math.min((ts - lastT) / 1000, 0.1); lastT = ts;
    if (G.state !== prevSt) {
        showUI(G.state); if (G.state === 'gameOver') {
            if (prevSt === 'playing') lastRepData = JSON.parse(JSON.stringify(G.rec));
            if (nextLevelBtn) nextLevelBtn.style.display = 'none';
            goTitle.textContent = G.winner === G.human ? 'Zafer' : 'Maglubiyet';
            goMsg.textContent = G.winner === G.human ? (G.tick + ' tickte tum yildizlari fethettin.') : ('Tick ' + G.tick + ' civarinda oyundan dustun.');
            if (G.campaign.active && G.campaign.levelIndex >= 0) {
                var level = CAMPAIGN_LEVELS[G.campaign.levelIndex];
                if (G.winner === G.human) {
                    completeCampaignLevel();
                    if (G.campaign.levelIndex + 1 < CAMPAIGN_LEVELS.length) {
                        var nextInfo = CAMPAIGN_LEVELS[G.campaign.levelIndex + 1];
                        goTitle.textContent = 'Bolum ' + level.id + ' Tamamlandi';
                        goMsg.textContent = 'Yeni bolum acildi: ' + nextInfo.id + '. ' + nextInfo.name;
                        if (nextLevelBtn) {
                            nextLevelBtn.textContent = 'Sonraki Bolum (' + nextInfo.id + ')';
                            nextLevelBtn.style.display = 'block';
                        }
                    } else {
                        goTitle.textContent = 'Senaryo Tamamlandi';
                        goMsg.textContent = '20 bolumun tamamini bitirdin. Solarmax Protocol temizlendi.';
                    }
                } else {
                    goTitle.textContent = 'Bolum ' + level.id + ' Kaybedildi';
                    goMsg.textContent = 'Ayni bolumu tekrar dene veya stratejini degistir.';
                }
            }
            if (G.daily.active && G.daily.challenge) {
                var dailyProgress = saveDailyChallengeProgress(G.daily.challenge.key, G.winner === G.human, G.tick);
                G.daily.bestTick = dailyProgress.bestTick;
                G.daily.completed = dailyProgress.completed;
                refreshDailyChallengeCard();
                if (G.winner === G.human) {
                    goTitle.textContent = 'Gunluk Challenge Tamamlandi';
                    goMsg.textContent = dailyProgress.bestTick === G.tick ?
                        ('Yeni en iyi sure: ' + G.tick + ' tick.') :
                        ('Challenge temizlendi. En iyi sure: ' + dailyProgress.bestTick + ' tick.');
                } else {
                    goTitle.textContent = 'Gunluk Challenge Kacirildi';
                    goMsg.textContent = dailyProgress.bestTick > 0 ?
                        ('Bugunun en iyi sonucun: ' + dailyProgress.bestTick + ' tick. Bir tur daha dene.') :
                        'Bugunun challengei henuz temizlenmedi. Acilisi daha agresif kur.';
                }
            }
            if (goStatsEl) renderStatRows(goStatsEl, humanGameOverStatRows());
            if (typeof AudioFX !== 'undefined') { AudioFX.stopMusic(); G.winner === G.human ? AudioFX.victory() : AudioFX.defeat(); }
            checkAchievements();
            var rematchBtn = document.getElementById('rematchBtn');
            if (rematchBtn) rematchBtn.style.display = net.online ? 'block' : 'none';
            if (net.online && net.socket) {
                sendOnlineStateSummary(true);
                net.socket.emit('reportResult', { winnerIndex: G.winner, winner: G.winner === G.human });
            }
        } prevSt = G.state;
    }
    if (G.state === 'playing' || G.state === 'replay') {
        var useAuthoritativeState = net.online && net.authoritativeEnabled && G.state === 'playing';
        if (useAuthoritativeState) {
            acc = 0;
            advanceTransientVisuals(rawDt);
            if (net.authoritativeReady) maybeSendOnlinePing();
        } else {
            var es = G.state === 'replay' && G.rep ? (G.rep.paused ? 0 : G.rep.speed) : G.speed;
            acc += rawDt * es;
            while (acc >= TICK_DT) { gameTick(); acc -= TICK_DT; }
        }
        var featureName = G.mapFeature.type === 'wormhole' ? 'Wormhole' : (G.mapFeature.type === 'gravity' ? 'Gravity' : (G.mapFeature.type === 'barrier' ? 'Barrier' : 'Standart'));
        var pulseText = '';
        if (G.strategicPulse && G.strategicPulse.active) {
            var pulseNode = G.nodes[G.strategicPulse.nodeId];
            var pulseOwner = pulseNode ? pulseNode.owner : -1;
            var pulseOwnerText = pulseOwner < 0 ? 'Tarafsiz' : (pulseOwner === G.human ? 'Sen' : ('P' + (pulseOwner + 1)));
            pulseText = ' | Pulse: ' + pulseOwnerText + ' ' + Math.max(1, Math.ceil((G.strategicPulse.remainingTicks || 0) / 30)) + 's';
        }
        hudTick.textContent = 'Tick: ' + G.tick + ' | ' + G.diff + pulseText;
        if (hudCap) {
            var hu = Math.floor((G.unitByPlayer && G.unitByPlayer[G.human]) || 0);
            var hc = Math.floor((G.capByPlayer && G.capByPlayer[G.human]) || 0);
            var humanCapPressure = hc > 0 ? hu / hc : 0;
            var capText = 'Cap ' + hu + '/' + hc;
            if (humanCapPressure > CAP_SOFT_START) {
                capText += ' | Strain ' + Math.round(humanCapPressure * 100) + '%';
            }
            hudCap.textContent = capText;
        }
        if (hudMeta) hudMeta.textContent = selectionMetaText();
        var pingEl = document.getElementById('pingDisplay');
        if (pingEl) {
            var pingText = net.online && net.lastPingMs !== undefined ? ('Ping: ' + Math.round(net.lastPingMs) + 'ms') : '';
            if (net.online && net.syncWarningText && G.tick - net.syncWarningTick < SYNC_HASH_INTERVAL_TICKS * 2) {
                pingText += (pingText ? ' | ' : '') + 'SYNC';
            }
            pingEl.textContent = pingText;
        }
        if (G.state === 'replay') repTickLbl.textContent = 'Tick: ' + G.tick;
    }
    if (G.state === 'playing' || G.state === 'paused') updatePowerSidebar();
    if (G.state !== 'mainMenu') render(ctx, cv, G.tick);
    requestAnimationFrame(loop);
}
showUI('mainMenu');
requestAnimationFrame(function (ts) { lastT = ts; loop(ts); });
