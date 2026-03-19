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
import { activateDoctrine, buildDoctrineLoadout, canActivateDoctrine, doctrineActiveName, doctrineCooldownSummary, doctrineModifiers, doctrineName, doctrineSummary, ensureDoctrineStates, tickDoctrineStates } from './assets/sim/doctrine.js';
import { buildEncounterState, encounterHint, encounterName, encounterSummary, stepEncounterState } from './assets/sim/encounters.js';
import { getRulesetConfig, normalizeRulesetMode, normalizeNodeKindForRuleset } from './assets/sim/ruleset.js';
import { computeFriendlyReinforcementRoom } from './assets/sim/reinforcement.js';
import { buildFleetSpawnProfile, getFleetUnitSpacingT, hashMix } from './assets/sim/shared_config.js';
import { getStrategicPulseState, isStrategicPulseActiveForNode } from './assets/sim/strategic_pulse.js';
import { computeSyncHash } from './assets/sim/state_hash.js';
import { applyPlayerCommandWithOps } from './assets/sim/command_apply.js';
import { sanitizeCommandData } from './assets/sim/command_schema.js';
import { advanceMissionState, applyMissionScript, getActiveMissionPhase } from './assets/sim/mission_script.js';
import { resolveFleetArrivals, stepFleetMovement } from './assets/sim/fleet_step.js';
import { stepHoldingFleetDecay } from './assets/sim/holding_decay.js';
import { getTerritoryOwnersAtPoint, territoryRadiusForNode } from './assets/sim/territory.js';
import { stepFlowLinks } from './assets/sim/flow_step.js';
import { decideAiCommands } from './assets/sim/ai.js';
import { isPointInsideMapMutator, isTerritoryBonusBlockedAtPoint as isTerritoryBonusBlockedByMutator, mapMutatorHint, mapMutatorName, resolveMapMutator } from './assets/sim/mutator.js';
import { CAMPAIGN_LEVELS } from './assets/campaign/levels.js';
import { buildDailyChallenge } from './assets/campaign/daily_challenge.js';
import { describeCampaignObjectives, evaluateCampaignObjectives } from './assets/campaign/objectives.js';
import { buildCustomMapExport, normalizeCustomMapConfig } from './assets/sim/custom_map.js';
import { resolveMatchEndState } from './assets/sim/end_state.js';
import { todayDateKey } from './assets/sim/match_manifest.js';
import { playlistName, resolvePlaylistConfig } from './assets/sim/playlists.js';
import { attachGameInputController, createInputState } from './assets/app/input_controller.js';
import { runAiAndWrapTickPhase, runCombatTickPhase, runEconomyTickPhase, runOnlineTickSyncPhase } from './assets/app/game_tick_phases.js';
import { renderMarqueeLayer, renderMinimapLayer, renderWorldLayers } from './assets/app/render_layers.js';
import { applyCampaignRunState, applyDailyChallengeRunState, applySkirmishRunState, buildCampaignLevelStartConfig, buildCustomMapStartConfig, buildDailyChallengeStartConfig, buildSkirmishStartConfig } from './assets/app/start_flow.js';
import { applyRoomStateNetState, beginOnlineMatch, buildCreateRoomRequest, buildJoinRoomRequest, buildOnlineMatchInitOptions, buildOnlineMatchStatusText, buildRoomStateMenuPatches, computeOnlineCommandTick, getSocketEndpoint, resetOnlineRoomState } from './assets/net/online_session.js';
import { canvasToViewportPoint, findHoveredNodeAtScreen } from './assets/app/hover_target.js';
import { HUD_ACTION_HELP_DEFAULT, buildHudContextBadge, buildHudHintText, buildNodeHoverTip } from './assets/ui/hud_assistive.js';
import { buildHudAdvisorCard } from './assets/ui/hud_advisor.js';
import { buildHudCoachItems, renderHudCoach } from './assets/ui/hud_coach.js';
import { applyLobbyControlState, buildLobbyListStatus, buildRoomStatusSummary, getLobbyControlState, renderRoomPlayers, setRoomStatusState } from './assets/ui/lobby_ui.js';
import { buildDoctrineButtonState, buildHudCapText, buildHudTickText, buildPingDisplayText } from './assets/ui/match_hud.js';
import { MENU_PANEL_META, buildMenuHeroSummary, buildMenuLobbyMeta, clampMenuNodeCount, createInitialMenuState as createMenuState, menuBackTarget, menuDifficultyLabel, normalizeMenuDifficulty, normalizeMenuDoctrine, normalizeMenuPanel, normalizeMenuPlaylist, normalizeMenuRoomType, normalizeMenuRulesMode, normalizeMenuSeed } from './assets/ui/menu_state.js';
import { buildMissionPanelSubtitle, buildMissionPanelTitle, pickPrimaryObjectiveRow, resolveMissionDefinition, resolveMissionMode } from './assets/ui/mission_state.js';
import { applyRoomTypeUiState, getRoomTypeUiState } from './assets/ui/room_type_ui.js';
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
    TRAIL_LEN = 12, MAX_ORBIT_SQUADS = 14, MAX_ORBIT_SHIPS_PER_SQUAD = 6, ORBIT_UNITS_PER_VISIBLE_SHIP = 2, ORBIT_SPD = 0.018, ORBIT_UNIT_STEP = 14, ORBIT_MAX_RINGS = 4,
    NODE_LEVEL_MAX = 3,
    DDA_MAX_BOOST = 0.2,
    WORMHOLE_SPEED_MULT = 2.0,
    GRAVITY_RADIUS = 170,
    GRAVITY_SPEED_MULT = 1.35,
    SUPPLY_DIST = 220,
    TERRITORY_RADIUS_BASE = 88,
    TERRITORY_RADIUS_NODE_RADIUS_MULT = 1.7,
    TERRITORY_RADIUS_LEVEL_BONUS = 14,
    TERRITORY_SPEED_MULT = 1.18,
    HOLD_DECAY_GRACE_TICKS = 300,
    HOLD_DECAY_INTERVAL_TICKS = 36,
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
    TURRET_CAPTURE_RESIST = 1.7,
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
    SUPPLIED_UPGRADE_DISCOUNT = 0.94,
    DAILY_CHALLENGE_TIMEZONE = 'Europe/Istanbul';
var SYNC_HASH_INTERVAL_TICKS = 90, TICK_RATE = Math.round(1 / TICK_DT);
var NODE_HOVER_DWELL_MS = 0;

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
        aiReserveScale: 1.0, aiCommitMax: 0.72, aiCriticalCommitMax: 0.8, aiOpportunityRatio: 0.62,
        aiExtraSources: 0, aiTargetHumanBias: 4, aiTargetCapitalBias: 12, aiFlowPeriod: 13, aiUpgradePeriod: 19,
    },
    normal: {
        aiAggBase: 1.08, aiBuffer: 4, aiInterval: 26, flowInterval: 15,
        aiUsesFog: false, adaptiveAI: true,
        humanStartBoost: 1.0, aiStartBoost: 1.0,
        humanProdMult: 1.0, aiProdMult: 1.0,
        featureChance: 0.62, maxAttackTargets: 2,
        aiReserveScale: 0.9, aiCommitMax: 0.82, aiCriticalCommitMax: 0.9, aiOpportunityRatio: 0.52,
        aiExtraSources: 1, aiTargetHumanBias: 12, aiTargetCapitalBias: 28, aiFlowPeriod: 9, aiUpgradePeriod: 15,
    },
    hard: {
        aiAggBase: 1.38, aiBuffer: 3, aiInterval: 18, flowInterval: 12,
        aiUsesFog: true, adaptiveAI: true,
        humanStartBoost: 0.92, aiStartBoost: 1.1,
        humanProdMult: 0.98, aiProdMult: 1.07,
        featureChance: 0.78, maxAttackTargets: 3,
        aiReserveScale: 0.78, aiCommitMax: 0.92, aiCriticalCommitMax: 1.0, aiOpportunityRatio: 0.45,
        aiExtraSources: 2, aiTargetHumanBias: 24, aiTargetCapitalBias: 56, aiFlowPeriod: 6, aiUpgradePeriod: 11,
    },
};

// Ã¢â€â‚¬Ã¢â€â‚¬ SPACE BACKDROP (background) Ã¢â€â‚¬Ã¢â€â‚¬
var stars = [];
var spaceNebulas = [];
var spaceDustBands = [];

// Ã¢â€â‚¬Ã¢â€â‚¬ SEEDED RNG Ã¢â€â‚¬Ã¢â€â‚¬
function RNG(s) { this.s = s | 0; if (!this.s) this.s = 1; }
RNG.prototype.next = function () { var t = this.s += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
RNG.prototype.nextInt = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
RNG.prototype.nextFloat = function (a, b) { return a + this.next() * (b - a); };
function hashSeed(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h) || 1; }

function seedSpaceBackdrop() {
    var rng = new RNG(hashSeed('stellar-space-backdrop-v2'));
    var starPalette = ['#d9e7ff', '#b7dbff', '#9fe8ff', '#ffe6bc'];
    var nebulaPalette = [
        { core: '#3d7cff', edge: '#10305f' },
        { core: '#26c6da', edge: '#0a3751' },
        { core: '#ff9f6e', edge: '#4b1f1a' },
        { core: '#7ee081', edge: '#103d2c' }
    ];
    stars.length = 0;
    spaceNebulas.length = 0;
    spaceDustBands.length = 0;

    for (var i = 0; i < 440; i++) {
        stars.push({
            x: rng.nextFloat(-MAP_W * 0.42, MAP_W * 1.42),
            y: rng.nextFloat(-MAP_H * 0.42, MAP_H * 1.42),
            r: rng.nextFloat(0.35, 1.9),
            b: rng.nextFloat(0.22, 0.72),
            depth: rng.nextFloat(0.74, 1.08),
            twinkle: rng.nextFloat(0.6, 1.7),
            phase: rng.nextFloat(0, Math.PI * 2),
            col: starPalette[rng.nextInt(0, starPalette.length - 1)],
            glow: rng.next() > 0.9 ? rng.nextFloat(2.4, 5.8) : 0,
            glint: rng.next() > 0.955 ? rng.nextFloat(3, 7) : 0
        });
    }

    for (var ni = 0; ni < 11; ni++) {
        var nebulaTint = nebulaPalette[rng.nextInt(0, nebulaPalette.length - 1)];
        spaceNebulas.push({
            x: rng.nextFloat(-MAP_W * 0.18, MAP_W * 1.18),
            y: rng.nextFloat(-MAP_H * 0.18, MAP_H * 1.18),
            rx: rng.nextFloat(120, 280),
            ry: rng.nextFloat(70, 170),
            depth: rng.nextFloat(0.8, 0.96),
            alpha: rng.nextFloat(0.16, 0.34),
            rot: rng.nextFloat(0, Math.PI * 2),
            phase: rng.nextFloat(0, Math.PI * 2),
            drift: rng.nextFloat(6, 18),
            core: nebulaTint.core,
            edge: nebulaTint.edge
        });
    }

    for (var di = 0; di < 7; di++) {
        var dustTint = nebulaPalette[rng.nextInt(0, nebulaPalette.length - 1)];
        spaceDustBands.push({
            x: rng.nextFloat(-MAP_W * 0.22, MAP_W * 1.22),
            y: rng.nextFloat(-MAP_H * 0.22, MAP_H * 1.22),
            rx: rng.nextFloat(210, 420),
            ry: rng.nextFloat(34, 72),
            depth: rng.nextFloat(0.86, 1),
            alpha: rng.nextFloat(0.06, 0.12),
            rot: rng.nextFloat(0, Math.PI * 2),
            phase: rng.nextFloat(0, Math.PI * 2),
            color: dustTint.core
        });
    }
}

seedSpaceBackdrop();

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

function normalizePointTarget(point) {
    point = point && typeof point === 'object' ? point : null;
    if (!point) return null;
    var x = Number(point.x), y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: x, y: y };
}

function normalizeDispatchOrder(srcIdsOrData, tgtId, pct) {
    var raw = srcIdsOrData && typeof srcIdsOrData === 'object' && !Array.isArray(srcIdsOrData)
        ? srcIdsOrData
        : { sources: srcIdsOrData, tgtId: tgtId, pct: pct };
    var targetId = raw.tgtId !== undefined ? raw.tgtId : raw.targetId;
    var normalizedTargetId = Number.isFinite(Number(targetId)) ? Math.floor(Number(targetId)) : null;
    return {
        sources: Array.isArray(raw.sources) ? raw.sources.slice() : [],
        fleetIds: Array.isArray(raw.fleetIds) ? raw.fleetIds.slice() : [],
        tgtId: normalizedTargetId,
        targetPoint: normalizePointTarget(raw.targetPoint !== undefined ? raw.targetPoint : raw.point),
        pct: clamp(typeof raw.pct === 'number' ? raw.pct : Number(raw.percent !== undefined ? raw.percent : raw.pct), 0.05, 1),
    };
}

function computeFleetSendCount(fleetCount, pct) {
    var available = Math.max(0, Math.floor(Number(fleetCount) || 0));
    if (available <= 0) return 0;
    if (pct >= 0.999) return available;
    return Math.min(available, Math.max(1, Math.floor(available * pct)));
}

function makeRoutePointKey(point) {
    point = point || { x: 0, y: 0 };
    return Math.round((Number(point.x) || 0) * 10) + ':' + Math.round((Number(point.y) || 0) * 10);
}

function countQueuedRouteFleets(owner, sourceKey, targetKey) {
    var count = 0;
    for (var i = 0; i < G.fleets.length; i++) {
        var fleet = G.fleets[i];
        if (!fleet || !fleet.active || fleet.holding || fleet.owner !== owner) continue;
        if (fleet.routeSrcKey === sourceKey && fleet.routeTgtKey === targetKey) count++;
    }
    return count;
}

function fleetRouteStart(fleet) {
    if (Number.isFinite(fleet.fromX) && Number.isFinite(fleet.fromY)) return { x: Number(fleet.fromX), y: Number(fleet.fromY) };
    var sourceNode = G.nodes[fleet.srcId];
    if (sourceNode && sourceNode.pos) return sourceNode.pos;
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) return { x: Number(fleet.x), y: Number(fleet.y) };
    return null;
}

function fleetRouteTarget(fleet) {
    if (Number.isFinite(fleet.toX) && Number.isFinite(fleet.toY)) return { x: Number(fleet.toX), y: Number(fleet.toY) };
    var targetNode = G.nodes[fleet.tgtId];
    if (targetNode && targetNode.pos) return targetNode.pos;
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) return { x: Number(fleet.x), y: Number(fleet.y) };
    return null;
}

function fleetSelectionRadius(fleet) {
    var count = Math.max(1, Math.floor(Number(fleet && fleet.count) || 0));
    return clamp(7 + Math.sqrt(count) * 1.3, 9, 20);
}

// Ã¢â€â‚¬Ã¢â€â‚¬ FLEET POOL (with trail + lateral offset for swarm) Ã¢â€â‚¬Ã¢â€â‚¬
function mkFleet() {
    return {
        id: 0, active: false, owner: -1, count: 0, srcId: -1, tgtId: -1, t: 0, speed: 0, arcLen: 1, cpx: 0, cpy: 0, x: 0, y: 0,
        fromX: 0, fromY: 0, toX: 0, toY: 0, holding: false, holdUnsuppliedTicks: 0, routeSrcKey: '', routeTgtKey: '',
        trail: [], offsetL: 0, spdVar: 1, routeSpeedMult: 1, trailScale: 1,
        headingX: 1, headingY: 0, bank: 0, throttle: 0.3, turnRate: 6, throttleBias: 1, lookAhead: 0.022,
        dmgAcc: 0, launchT: 0
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
    aiTicks: [], flowId: 0, fleetSerial: 0,
    aiProfiles: [], mapFeature: { type: 'none' }, mapMutator: { type: 'none' }, wormholes: [],
    playlist: 'standard', doctrineId: '', doctrines: [], doctrineStates: [], encounters: [], encounterContext: {}, objectives: [], endOnObjectives: false,
    missionScript: null, missionState: null, missionFailureText: '',
    stats: { nodesCaptured: 0, fleetsSent: 0, upgrades: 0, unitsProduced: 0, doctrineActivations: 0 },
    particles: [], turretBeams: [], fieldBeams: [], shockwaves: [], mapMode: 'random',
    playerCapital: {}, strategicNodes: [],
    strategicPulse: { active: false, nodeId: -1, cycle: 0, phase: 0, remainingTicks: 0, announcedCycle: -1 },
    powerByPlayer: {}, capByPlayer: {}, unitByPlayer: {},
    campaign: { active: false, levelIndex: -1, unlocked: 1, completed: 0, reminderShown: {} },
    daily: { active: false, challenge: null, reminderShown: {}, bestTick: 0, completed: false },
};
var orbitalVisualCache = {};
var territoryLayerCanvas = null;
var territoryLayerCtx = null;

function resetOrbitalVisuals() {
    orbitalVisualCache = {};
}

function ensureTerritoryLayerCanvas(width, height) {
    width = Math.max(1, Math.floor(Number(width) || 1));
    height = Math.max(1, Math.floor(Number(height) || 1));
    if (!territoryLayerCanvas) {
        territoryLayerCanvas = document.createElement('canvas');
        territoryLayerCtx = territoryLayerCanvas.getContext('2d', { alpha: true });
    }
    if (territoryLayerCanvas.width !== width) territoryLayerCanvas.width = width;
    if (territoryLayerCanvas.height !== height) territoryLayerCanvas.height = height;
    return territoryLayerCtx;
}

function territoryConfig() {
    return {
        territoryRadiusBase: TERRITORY_RADIUS_BASE,
        territoryRadiusNodeRadiusMult: TERRITORY_RADIUS_NODE_RADIUS_MULT,
        territoryRadiusLevelBonus: TERRITORY_RADIUS_LEVEL_BONUS,
    };
}

function territoryBonusBlockedAtPoint(point) {
    return isTerritoryBonusBlockedByMutator({
        point: point,
        mapMutator: G.mapMutator,
    });
}

function territoryPresenceAtPoint(point) {
    return getTerritoryOwnersAtPoint({
        point: point,
        nodes: G.nodes,
        callbacks: {
            isNodeTerritoryActive: isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: function (opts) {
                return territoryBonusBlockedAtPoint(opts && opts.point);
            },
        },
        constants: territoryConfig(),
    });
}

function holdingFleetState(fleet) {
    if (!fleet || !fleet.holding) return { supplied: false, contested: false, bonusBlocked: false, friendly: false };
    var point = { x: Number(fleet.x) || 0, y: Number(fleet.y) || 0 };
    var presence = territoryPresenceAtPoint(point);
    return {
        supplied: presence.ownerCount === 1 && presence.owners[fleet.owner] === true && presence.bonusBlocked !== true,
        contested: presence.ownerCount > 1,
        bonusBlocked: presence.bonusBlocked === true,
        friendly: !!presence.owners[fleet.owner],
    };
}

var ACHIEVEMENTS = [
    { id: 'first_win', name: 'Ilk Zafer', check: function () { return G.winner === G.human; } },
    { id: 'capture_10', name: '10 Gezegen Fethet', check: function () { return G.stats.nodesCaptured >= 10; } },
    { id: 'upgrade_master', name: 'Upgrade Ustasi', check: function () { return G.stats.upgrades >= 5; } },
    { id: 'fleet_lord', name: 'Filo Komutani', check: function () { return G.stats.fleetsSent >= 50; } },
    { id: 'fast_win', name: 'Hızlı Zafer', check: function () { return G.winner === G.human && G.tick < 500; } },
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
var gameToastTimer = 0, activeGameToastKind = '';
function hideGameToast(kind) {
    var toast = document.getElementById('gameToastMsg');
    if (!toast) return;
    if (kind && activeGameToastKind !== kind) return;
    toast.style.display = 'none';
    if (gameToastTimer) clearTimeout(gameToastTimer);
    gameToastTimer = 0;
    activeGameToastKind = '';
}
function showGameToast(message, opts) {
    if (!message) return;
    opts = opts || {};
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
    activeGameToastKind = opts.kind || 'info';
    toast.textContent = message;
    toast.style.display = 'block';
    if (gameToastTimer) clearTimeout(gameToastTimer);
    gameToastTimer = setTimeout(function () {
        toast.style.display = 'none';
        activeGameToastKind = '';
        gameToastTimer = 0;
    }, 1200);
}
function hintsEnabled() {
    return !uiPrefs || uiPrefs.hintsEnabled !== false;
}
function showHintToast(message) {
    if (!hintsEnabled()) return;
    showGameToast(message, { kind: 'hint' });
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
    showHintToast('Strategic pulse aktif: PULSE hubi +35% uretim, +18% filo hizi, +30% asimilasyon ve +18 cap verir.');
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

function applyMapMutator(cfg) {
    G.mapMutator = resolveMapMutator({
        seed: G.seed,
        nodes: G.nodes,
        mapMutator: cfg,
    });
}

function applyCustomMapDefinition(customMap) {
    customMap = normalizeCustomMapConfig(customMap || {});
    G.nodes = [];
    G.wormholes = [];
    G.mapFeature = customMap.mapFeature || { type: 'none' };
    G.mapMutator = resolveMapMutator({
        seed: customMap.seed || G.seed,
        nodes: customMap.nodes,
        mapMutator: customMap.mapMutator,
    });
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
    var keepTuning = !!opts.keepTuning;
    var menuFog = typeof opts.fogEnabled === 'boolean' ? opts.fogEnabled : null;
    var playlistConfig = resolvePlaylistConfig({
        seed: seedStr,
        nodeCount: nc,
        difficulty: diff,
        fogEnabled: menuFog === null ? false : menuFog,
        rulesMode: opts.rulesMode || 'advanced',
        aiCount: opts.aiCount,
        mapFeature: opts.mapFeature,
        mapMutator: opts.mapMutator,
        tuneOverrides: opts.tuneOverrides || null,
        doctrineId: opts.doctrineId || 'auto',
        encounters: opts.encounters || [],
        playlist: opts.playlist || 'standard',
        forcePlaylistOverrides: opts.forcePlaylistOverrides === true,
    });
    seedStr = playlistConfig.seed;
    nc = playlistConfig.nodeCount;
    diff = playlistConfig.difficulty || diff;
    if (playlistConfig.fogEnabled !== undefined) menuFog = playlistConfig.fogEnabled;
    var rulesMode = normalizeRulesetMode(playlistConfig.rulesMode || opts.rulesMode || 'advanced');
    var mapFeatureCfg = null;
    var mapMutatorCfg = playlistConfig.mapMutator !== undefined ? playlistConfig.mapMutator : 'auto';
    var customMapCfg = opts.customMap ? normalizeCustomMapConfig(opts.customMap) : null;
    if (typeof playlistConfig.mapFeature === 'string') mapFeatureCfg = { type: playlistConfig.mapFeature };
    else if (playlistConfig.mapFeature && typeof playlistConfig.mapFeature === 'object') mapFeatureCfg = playlistConfig.mapFeature;
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
    if (playlistConfig.tuneOverrides && typeof playlistConfig.tuneOverrides === 'object') {
        var ovr = playlistConfig.tuneOverrides;
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
    G.playlist = String(playlistConfig.playlist || 'standard');
    G.doctrineId = playlistConfig.doctrineId && playlistConfig.doctrineId !== 'auto' ? playlistConfig.doctrineId : '';
    G.objectives = JSON.parse(JSON.stringify(Array.isArray(opts.objectives) ? opts.objectives : []));
    G.endOnObjectives = opts.endOnObjectives === true;
    G.missionScript = null;
    G.missionState = null;
    G.missionFailureText = '';
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
        doctrineActivations: 0,
    };
    G.particles = [];
    G.turretBeams = [];
    G.fieldBeams = [];
    G.shockwaves = [];
    resetOrbitalVisuals();
    for (var i = 0; i < pool.length; i++) { pool[i].active = false; pool[i].trail = []; }
    G.fleets = [];
    G.flows = [];
    G.mapMutator = { type: 'none' };
    var aiDefault = diff === 'easy' ? 1 : diff === 'normal' ? 2 : 3;
    var humanCount = Math.max(1, Math.floor(Number(opts.humanCount || 1)));
    var aic = playlistConfig.aiCount !== undefined ? Math.max(0, Math.floor(Number(playlistConfig.aiCount))) : aiDefault;
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
        applyMapMutator(mapMutatorCfg);
    }
    applyRulesetNodeKinds();
    G.doctrines = buildDoctrineLoadout(G.players, {
        doctrineId: G.doctrineId || playlistConfig.doctrineId || 'logistics',
        doctrines: opts.doctrines || [],
    });
    G.doctrineStates = ensureDoctrineStates(G.doctrines, opts.doctrineStates || []);
    G.encounters = buildEncounterState(customMapCfg ? customMapCfg.encounters : playlistConfig.encounters, G.nodes, G.seed);
    G.encounterContext = {};
    applyMissionScript(G, opts.missionScript || null);
    stepEncounterState(G);
    G.fog = initFog(G.players.length, G.nodes.length);
    for (var p = 0; p < G.players.length; p++) updateVis(G.fog, p, G.nodes, 0);
    powerRenderKey = '';
    G.powerByPlayer = computePowerByPlayer();
    G.strategicPulse = currentStrategicPulse(0);
    G.strategicPulse.announcedCycle = -1;
    var pn = preferredCameraNodeForPlayer(G.human);
    if (pn) { G.cam.x = pn.pos.x; G.cam.y = pn.pos.y; } G.cam.zoom = 1;
    G.state = 'playing';
    G.campaign.reminderShown = {};
    G.daily.reminderShown = {};
    if (G.mapFeature.type === 'barrier') showHintToast(barrierGatePromptText());
    if (G.mapMutator && G.mapMutator.type !== 'none') showHintToast(mapMutatorHint(G.mapMutator));
    if (G.encounters && G.encounters.length) showHintToast(encounterHint(G.encounters[0]));
    if (humanDoctrineId()) showHintToast(doctrineSummary(humanDoctrineId()));
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
function createDispatchedFleetLocal(owner, params) {
    params = params || {};
    var count = Math.max(0, Math.floor(Number(params.count) || 0));
    var sourceNode = params.sourceNode || null;
    var sourceFleet = params.sourceFleet || null;
    var targetNode = params.targetNode || null;
    var sourcePos = params.sourcePos || (sourceNode && sourceNode.pos) || null;
    var targetPos = params.targetPos || (targetNode && targetNode.pos) || null;
    if (!sourcePos || !targetPos || count <= 0) return false;

    var hasWormholeLink = !!(sourceNode && targetNode && isLinkedWormhole(sourceNode.id, targetNode.id));
    var curv = hasWormholeLink ? 0.05 : BEZ_CURV;
    var cp = bezCP(sourcePos, targetPos, curv);
    var sourceKey = sourceNode ? 'n:' + sourceNode.id : 'f:' + (sourceFleet ? sourceFleet.id : Math.round(sourcePos.x) + ':' + Math.round(sourcePos.y));
    var targetKey = targetNode ? 'n:' + targetNode.id : 'p:' + makeRoutePointKey(targetPos);
    var routeQueue = countQueuedRouteFleets(owner, sourceKey, targetKey);
    var launchDelay = Math.min(0.28, routeQueue * 0.03);

    G.fleetSerial = Math.max(0, Math.floor(Number(G.fleetSerial) || 0)) + 1;
    var routeSpeedMult = 1;
    if (sourceNode) {
        var srcType = nodeTypeOf(sourceNode);
        routeSpeedMult = srcType.speed * (hasWormholeLink ? WORMHOLE_SPEED_MULT : 1);
        if (isNodeAssimilated(sourceNode) && strategicPulseAppliesToNode(sourceNode.id)) {
            routeSpeedMult *= STRATEGIC_PULSE_SPEED;
        }
    }
    var spawnProfile = buildFleetSpawnProfile({
        seed: G.seed,
        srcId: sourceNode ? sourceNode.id : -Math.max(1, Math.floor(Number(sourceFleet && sourceFleet.id) || 1)),
        tgtId: targetNode ? targetNode.id : Math.round(targetPos.x * 7 + targetPos.y * 13),
        serial: G.fleetSerial,
        routeQueue: routeQueue,
        count: count,
        routeSpeedMult: routeSpeedMult,
    });
    var arcLen = bezLen(sourcePos, cp, targetPos);
    var sourceRadius = sourceNode && Number.isFinite(Number(sourceNode.radius))
        ? Number(sourceNode.radius)
        : Math.max(6, Math.min(18, Math.sqrt(count) * 1.6));
    var launchT = clamp((sourceRadius + 2) / Math.max(arcLen, 1), 0, sourceNode ? 0.12 : 0.08);
    var launchPt = bezPt(sourcePos, cp, targetPos, launchT);
    var launchDirPt = bezPt(sourcePos, cp, targetPos, Math.min(1, launchT + Math.max(0.012, spawnProfile.lookAhead)));
    var launchDx = launchDirPt.x - launchPt.x, launchDy = launchDirPt.y - launchPt.y;
    var launchLen = Math.sqrt(launchDx * launchDx + launchDy * launchDy) || 1;
    var f = acquireFleet();
    f.id = G.fleetSerial;
    f.active = true;
    f.owner = owner;
    f.count = count;
    f.srcId = sourceNode ? sourceNode.id : -1;
    f.tgtId = targetNode ? targetNode.id : -1;
    f.fromX = sourcePos.x;
    f.fromY = sourcePos.y;
    f.toX = targetPos.x;
    f.toY = targetPos.y;
    f.holding = false;
    f.holdUnsuppliedTicks = 0;
    f.routeSrcKey = sourceKey;
    f.routeTgtKey = targetKey;
    f.t = -launchDelay;
    f.speed = FLEET_SPEED;
    f.routeSpeedMult = routeSpeedMult;
    f.offsetL = spawnProfile.offsetL;
    f.spdVar = spawnProfile.spdVar;
    f.trailScale = spawnProfile.trailScale;
    f.turnRate = spawnProfile.turnRate;
    f.throttleBias = spawnProfile.throttleBias;
    f.lookAhead = spawnProfile.lookAhead;
    f.cpx = cp.x;
    f.cpy = cp.y;
    f.arcLen = arcLen;
    f.launchT = launchT;
    f.x = launchPt.x;
    f.y = launchPt.y;
    f.headingX = launchDx / launchLen;
    f.headingY = launchDy / launchLen;
    f.bank = 0;
    f.throttle = 0.34 * f.throttleBias;
    f.hitFlash = 0;
    f.hitJitter = 0;
    f.hitDirX = 0;
    f.hitDirY = 0;
    f.trail = [];
    f.dmgAcc = 0;
    G.fleets.push(f);
    return hasWormholeLink;
}

function dispatch(owner, srcIds, tgtId, pct) {
    var order = normalizeDispatchOrder(srcIds, tgtId, pct);
    var tgt = order.tgtId !== null ? G.nodes[order.tgtId] : null;
    var targetPoint = tgt ? tgt.pos : order.targetPoint;
    if (!tgt && !targetPoint) return;
    var didSend = false;
    var blockedByBarrier = false;
    var barrierCfg = G.mapFeature && G.mapFeature.type === 'barrier' ? G.mapFeature : null;
    var friendlyRoom = null;
    if (tgt && tgt.owner === owner) {
        var incomingFriendlyUnits = 0;
        for (var fi0 = 0; fi0 < G.fleets.length; fi0++) {
            var incomingFleet = G.fleets[fi0];
            if (!incomingFleet.active || incomingFleet.owner !== owner || incomingFleet.tgtId !== order.tgtId) continue;
            incomingFriendlyUnits += Math.max(0, Math.floor(incomingFleet.count) || 0);
        }
        friendlyRoom = computeFriendlyReinforcementRoom({
            targetUnits: tgt.units,
            targetMaxUnits: tgt.maxUnits,
            incomingUnits: incomingFriendlyUnits,
        });
    }
    for (var si = 0; si < order.sources.length; si++) {
        var src = G.nodes[order.sources[si]]; if (!src || src.owner !== owner) continue;
        if (!isDispatchAllowed({ src: src, tgt: tgt || { pos: targetPoint }, barrier: barrierCfg, owner: owner, nodes: G.nodes })) {
            blockedByBarrier = true;
            continue;
        }
        var srcType = nodeTypeOf(src);
        var send = computeSendCount({ srcUnits: src.units, pct: order.pct, flowMult: srcType.flow });
        var cnt = send.sendCount;
        if (friendlyRoom !== null) {
            cnt = Math.min(cnt, friendlyRoom);
        }
        if (cnt <= 0) continue;
        if (cnt === send.sendCount) src.units = send.newSrcUnits;
        else src.units -= cnt;
        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= cnt;
        var usedWormhole = createDispatchedFleetLocal(owner, {
            count: cnt,
            sourceNode: src,
            targetNode: tgt,
            sourcePos: src.pos,
            targetPos: targetPoint,
        });
        if (owner === G.human && usedWormhole) G.stats.wormholeDispatches++;
    }
    for (var fi = 0; fi < order.fleetIds.length; fi++) {
        var sourceFleet = null;
        for (var sfi = 0; sfi < G.fleets.length; sfi++) {
            var candidate = G.fleets[sfi];
            if (!candidate || !candidate.active || !candidate.holding || candidate.owner !== owner) continue;
            if ((Number(candidate.id) || 0) === order.fleetIds[fi]) {
                sourceFleet = candidate;
                break;
            }
        }
        if (!sourceFleet) continue;
        var sourceFleetPos = { x: Number(sourceFleet.x) || 0, y: Number(sourceFleet.y) || 0 };
        if (!isDispatchAllowed({ src: { pos: sourceFleetPos }, tgt: tgt || { pos: targetPoint }, barrier: barrierCfg, owner: owner, nodes: G.nodes })) {
            blockedByBarrier = true;
            continue;
        }
        var fleetCount = computeFleetSendCount(sourceFleet.count, order.pct);
        if (friendlyRoom !== null) fleetCount = Math.min(fleetCount, friendlyRoom);
        if (fleetCount <= 0) continue;
        sourceFleet.count = Math.max(0, Math.floor(Number(sourceFleet.count) || 0) - fleetCount);
        if (sourceFleet.count <= 0) {
            sourceFleet.count = 0;
            sourceFleet.active = false;
            sourceFleet.holding = false;
            sourceFleet.holdUnsuppliedTicks = 0;
            sourceFleet.trail = [];
        }
        didSend = true;
        if (friendlyRoom !== null) friendlyRoom -= fleetCount;
        createDispatchedFleetLocal(owner, {
            count: fleetCount,
            sourceFleet: sourceFleet,
            targetNode: tgt,
            sourcePos: sourceFleetPos,
            targetPos: targetPoint,
        });
    }
    if (didSend && owner === G.human) {
        G.stats.fleetsSent++;
        if (typeof AudioFX !== 'undefined') AudioFX.send();
    }
    if (blockedByBarrier && owner === G.human) {
        showGameToast('Geçit kilitli: ' + barrierGateObjectiveText() + ', sonra asimilasyon tamamlanana kadar bekle.');
    } else if (!didSend && friendlyRoom !== null && owner === G.human) {
        showGameToast('Hedef dolu: dost takviye sigmiyor. Birlik cikar veya baska hedefe yonlendir.');
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ COMBAT Ã¢â€â‚¬Ã¢â€â‚¬
function spawnParticles(x, y, count, color, isCapture, opts) {
    opts = opts || {};
    var dirX = Number(opts.dirX);
    var dirY = Number(opts.dirY);
    var dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    var hasDir = Number.isFinite(dirLen) && dirLen > 0.0001;
    var baseAngle = hasDir ? Math.atan2(dirY, dirX) : 0;
    var spread = Number(opts.spread);
    if (!Number.isFinite(spread) || spread <= 0) spread = Math.PI * 2;
    var speedMin = Number(opts.speedMin);
    var speedMax = Number(opts.speedMax);
    if (!Number.isFinite(speedMin)) speedMin = 2;
    if (!Number.isFinite(speedMax)) speedMax = 6;
    var lifeMin = Number(opts.lifeMin);
    var lifeMax = Number(opts.lifeMax);
    if (!Number.isFinite(lifeMin)) lifeMin = 0.4;
    if (!Number.isFinite(lifeMax)) lifeMax = 0.7;
    var radiusScale = Number(opts.radiusScale);
    if (!Number.isFinite(radiusScale) || radiusScale <= 0) radiusScale = 1;
    var drag = Number(opts.drag);
    if (!Number.isFinite(drag) || drag <= 0 || drag > 1) drag = 0.94;
    var glow = Number(opts.glow);
    if (!Number.isFinite(glow) || glow < 0) glow = isCapture ? 0.55 : 0.28;
    for (var i = 0; i < count; i++) {
        var a = hasDir
            ? baseAngle + (Math.random() - 0.5) * spread
            : (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.5;
        var spd = speedMin + Math.random() * Math.max(0, speedMax - speedMin);
        var life = lifeMin + Math.random() * Math.max(0, lifeMax - lifeMin);
        G.particles.push({
            x: x,
            y: y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            drag: drag,
            life: life,
            maxLife: life,
            col: color || '#fff',
            glow: glow,
            r: (isCapture ? 3 : 1.5) * radiusScale,
        });
    }
    if (G.particles.length > 120) G.particles = G.particles.slice(-100);
}

function enqueueShockwave(x, y, opts) {
    opts = opts || {};
    var life = Number(opts.life);
    if (!Number.isFinite(life) || life <= 0) life = 0.24;
    G.shockwaves.push({
        x: Number(x) || 0,
        y: Number(y) || 0,
        radius: Math.max(0, Number(opts.radius) || 8),
        grow: Math.max(1, Number(opts.grow) || 18),
        life: life,
        maxLife: life,
        col: opts.color || '#ffffff',
        alpha: Math.max(0, Number(opts.alpha) || 0.3),
        fillAlpha: Math.max(0, Number(opts.fillAlpha) || 0),
        lineWidth: Math.max(0.8, Number(opts.lineWidth) || 1.4),
    });
    if (G.shockwaves.length > 80) G.shockwaves = G.shockwaves.slice(-72);
}

function applyImpactFeedback(impacts) {
    if (!Array.isArray(impacts) || impacts.length === 0) return;
    for (var i = 0; i < impacts.length; i++) {
        var impact = impacts[i];
        if (!impact) continue;
        var col = impact.owner >= 0 && G.players[impact.owner] ? G.players[impact.owner].color : '#ffffff';
        spawnParticles(impact.x, impact.y, impact.killed ? 8 : 4, col, false, {
            dirX: impact.dirX,
            dirY: impact.dirY,
            spread: impact.kind === 'field' ? Math.PI * 0.75 : Math.PI * 0.55,
            speedMin: impact.kind === 'field' ? 1.8 : 2.2,
            speedMax: impact.killed ? 5.4 : 4.2,
            drag: 0.92,
            lifeMin: 0.18,
            lifeMax: impact.killed ? 0.42 : 0.3,
            radiusScale: impact.killed ? 1.15 : 0.82,
            glow: impact.killed ? 0.48 : 0.24,
        });
        enqueueShockwave(impact.x, impact.y, {
            color: col,
            radius: impact.killed ? 6 : 4,
            grow: impact.killed ? 16 : 9,
            life: impact.killed ? 0.24 : 0.14,
            alpha: impact.kind === 'field' ? 0.2 : 0.28,
            fillAlpha: impact.killed ? 0.06 : 0.02,
            lineWidth: impact.killed ? 1.5 : 1,
        });
    }
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
    return decideAiCommands(G, pi);
}

function applyPlayerCommand(playerIndex, type, data) {
    return applyPlayerCommandWithOps(playerIndex, type, data, {
        send: dispatch,
        flow: addFlow,
        rmFlow: rmFlow,
        upgrade: upgradeNode,
        toggleDefense: toggleDefense,
        activateDoctrine: activateDoctrineForPlayer,
    });
}

// Ã¢â€â‚¬Ã¢â€â‚¬ TICK Ã¢â€â‚¬Ã¢â€â‚¬
function gameTick(runtimeOpts) {
    runtimeOpts = runtimeOpts || {};
    if (G.state !== 'playing') return;
    runOnlineTickSyncPhase({
        game: G,
        net: net,
        runtimeOpts: runtimeOpts,
        applyPlayerCommand: applyPlayerCommand,
    });

    runEconomyTickPhase({
        game: G,
        constants: {
            strategicPulseCap: STRATEGIC_PULSE_CAP,
            supplyDistance: SUPPLY_DIST,
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
            tickDoctrineStates: tickDoctrineStates,
            currentStrategicPulse: currentStrategicPulse,
            strategicPulseToast: strategicPulseToast,
            computeOwnershipMetrics: computeOwnershipMetrics,
            spawnAnchors: spawnAnchors,
            isNodeAssimilated: isNodeAssimilated,
            dist: dist,
            nodePowerValue: nodePowerValue,
            stepEncounterState: stepEncounterState,
            stepNodeEconomy: stepNodeEconomy,
            clamp: clamp,
            nodeTypeOf: nodeTypeOf,
            nodeCapacity: nodeCapacity,
            nodeLevelProdMult: nodeLevelProdMult,
            strategicPulseAppliesToNode: strategicPulseAppliesToNode,
            ownerProdMultiplier: function (owner, node) {
                var modifiers = doctrineModifiers(G.doctrines, G.doctrineStates, owner);
                var prodMult = modifiers.prodMult;
                if (node && node.supplied === true) prodMult *= modifiers.suppliedProdMult;
                var relayCoreCount = Number(G.encounterContext && G.encounterContext.relayCoreCountByPlayer && G.encounterContext.relayCoreCountByPlayer[owner]) || 0;
                if (relayCoreCount > 0) prodMult *= 1 + relayCoreCount * 0.08;
                return prodMult;
            },
            ownerAssimilationMultiplier: function (owner) {
                return doctrineModifiers(G.doctrines, G.doctrineStates, owner).assimMult;
            },
        },
    });

    runCombatTickPhase({
        game: G,
        constants: {
            tickDt: TICK_DT,
            turretRange: TURRET_RANGE,
            turretDps: TURRET_DPS,
            turretMinGarrison: TURRET_MIN_GARRISON,
            baseFleetSpeed: FLEET_SPEED,
            gravitySpeedMult: GRAVITY_SPEED_MULT,
            territorySpeedMult: TERRITORY_SPEED_MULT,
            territoryRadiusBase: TERRITORY_RADIUS_BASE,
            territoryRadiusNodeRadiusMult: TERRITORY_RADIUS_NODE_RADIUS_MULT,
            territoryRadiusLevelBonus: TERRITORY_RADIUS_LEVEL_BONUS,
            trailLen: TRAIL_LEN,
            turretCaptureResist: TURRET_CAPTURE_RESIST,
            defenseBonus: DEFENSE_BONUS,
            assimLockTicks: ASSIM_LOCK_TICKS,
            holdDecayGraceTicks: HOLD_DECAY_GRACE_TICKS,
            holdDecayIntervalTicks: HOLD_DECAY_INTERVAL_TICKS,
            flowFraction: FLOW_FRAC,
        },
        callbacks: {
            applyTurretDamage: applyTurretDamage,
            applyImpactFeedback: applyImpactFeedback,
            stepFleetMovement: stepFleetMovement,
            clamp: clamp,
            bezPt: bezPt,
            isNodeAssimilated: isNodeAssimilated,
            isTerritoryBonusBlockedAtPoint: function (opts) {
                return territoryBonusBlockedAtPoint(opts && opts.point);
            },
            fleetSpeedMultiplier: function (fleet) {
                return doctrineModifiers(G.doctrines, G.doctrineStates, fleet && fleet.owner).fleetSpeedMult;
            },
            applyDefenseFieldDamage: applyDefenseFieldDamage,
            defenseFieldCfg: defenseFieldCfg,
            resolveFleetArrivals: resolveFleetArrivals,
            nodeTypeOf: nodeTypeOf,
            nodeLevelDefMult: nodeLevelDefMult,
            nodeCapacity: nodeCapacity,
            attackMultiplier: function (owner, targetNode) {
                var modifiers = doctrineModifiers(G.doctrines, G.doctrineStates, owner);
                var mult = modifiers.attackMult;
                if (targetNode && targetNode.kind === 'turret') mult *= modifiers.turretAttackMult;
                return mult;
            },
            defenseMultiplier: function () {
                return 1;
            },
            spawnParticles: spawnParticles,
            enqueueShockwave: enqueueShockwave,
            stepHoldingFleetDecay: stepHoldingFleetDecay,
            showGameToast: showGameToast,
            playArrivalAudio: function (kind) {
                if (typeof AudioFX === 'undefined') return;
                if (kind === 'capture' && typeof AudioFX.capture === 'function') AudioFX.capture();
                else if (kind === 'combat' && typeof AudioFX.combat === 'function') AudioFX.combat();
            },
            stepFlowLinks: stepFlowLinks,
            dispatch: dispatch,
        },
    });

    runAiAndWrapTickPhase({
        game: G,
        net: net,
        runtimeOpts: runtimeOpts,
        constants: {
            tickDt: TICK_DT,
        },
        callbacks: {
            aiDecide: aiDecide,
            applyPlayerCommand: applyPlayerCommand,
            updateVis: updateVis,
            sendOnlineStateHash: sendOnlineStateHash,
            maybeShowCampaignObjectiveReminder: maybeShowCampaignObjectiveReminder,
            refreshCampaignMissionPanels: refreshCampaignMissionPanels,
            advanceTransientVisuals: advanceTransientVisuals,
            maybeResolveMissionObjectiveVictory: maybeResolveMissionObjectiveVictory,
            checkEnd: checkEnd,
        },
    });
}
function checkEnd() {
    var resolved = resolveMatchEndState({
        nodes: G.nodes,
        fleets: G.fleets,
        players: G.players,
    });
    for (var i = 0; i < G.players.length; i++) G.players[i].alive = resolved.playersAlive[i] !== false;
    if (G.state !== 'playing') return;
    if (resolved.gameOver) {
        G.winner = resolved.winnerIndex;
        G.state = 'gameOver';
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ COLOR UTILS Ã¢â€â‚¬Ã¢â€â‚¬
function hexRgb(h) { var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null; }
function lighten(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.min(255, c.r + a) + ',' + Math.min(255, c.g + a) + ',' + Math.min(255, c.b + a) + ')' : h; }
function darken(h, a) { var c = hexRgb(h); return c ? 'rgb(' + Math.max(0, c.r - a) + ',' + Math.max(0, c.g - a) + ',' + Math.max(0, c.b - a) + ')' : h; }
function hexToRgba(h, a) { var c = hexRgb(h); return c ? 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')' : h; }
function blendHex(a, b, t) { var ca = hexRgb(a), cb = hexRgb(b); if (!ca || !cb) return a; t = Math.max(0, Math.min(1, t)); return '#' + [0,1,2].map(function(i){ var v = Math.round((i===0?ca.r:i===1?ca.g:ca.b) * (1-t) + (i===0?cb.r:i===1?cb.g:cb.b) * t); return ('0' + Math.max(0,Math.min(255,v)).toString(16)).slice(-2); }).join(''); }

// Ã¢â€â‚¬Ã¢â€â‚¬ RENDERING Ã¢â€â‚¬Ã¢â€â‚¬
function drawScreenBackdrop(ctx, cv, tick) {
    var baseGrad = ctx.createLinearGradient(0, 0, 0, cv.height);
    baseGrad.addColorStop(0, '#091322');
    baseGrad.addColorStop(0.55, COLORS_BG);
    baseGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, cv.width, cv.height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    var rimA = ctx.createRadialGradient(cv.width * 0.18, cv.height * 0.2, 0, cv.width * 0.18, cv.height * 0.2, Math.max(cv.width, cv.height) * 0.75);
    rimA.addColorStop(0, 'rgba(66, 135, 245, 0.22)');
    rimA.addColorStop(0.42, 'rgba(37, 92, 180, 0.12)');
    rimA.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rimA;
    ctx.fillRect(0, 0, cv.width, cv.height);

    var rimB = ctx.createRadialGradient(cv.width * 0.82, cv.height * 0.78, 0, cv.width * 0.82, cv.height * 0.78, Math.max(cv.width, cv.height) * 0.7);
    rimB.addColorStop(0, 'rgba(255, 148, 88, 0.16)');
    rimB.addColorStop(0.38, 'rgba(110, 43, 23, 0.12)');
    rimB.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rimB;
    ctx.fillRect(0, 0, cv.width, cv.height);

    var aurora = ctx.createLinearGradient(0, cv.height * (0.15 + Math.sin(tick * 0.003) * 0.015), cv.width, cv.height * 0.85);
    aurora.addColorStop(0, 'rgba(40, 118, 188, 0)');
    aurora.addColorStop(0.3, 'rgba(40, 118, 188, 0.06)');
    aurora.addColorStop(0.7, 'rgba(52, 182, 172, 0.05)');
    aurora.addColorStop(1, 'rgba(52, 182, 172, 0)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();

    var vignette = ctx.createRadialGradient(cv.width * 0.5, cv.height * 0.5, Math.min(cv.width, cv.height) * 0.18, cv.width * 0.5, cv.height * 0.5, Math.max(cv.width, cv.height) * 0.78);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.68, 'rgba(2, 4, 9, 0.16)');
    vignette.addColorStop(1, 'rgba(2, 3, 7, 0.56)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cv.width, cv.height);
}

function projectBackdropPoint(x, y, depth) {
    return {
        x: x + G.cam.x * (1 - depth),
        y: y + G.cam.y * (1 - depth)
    };
}

function drawBackdropEllipse(ctx, x, y, rx, ry, rotation, colorStops, alpha, composite) {
    ctx.save();
    if (composite) ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(rx, ry);
    var grad = ctx.createRadialGradient(0, 0, 0.04, 0, 0, 1);
    for (var i = 0; i < colorStops.length; i++) grad.addColorStop(colorStops[i].stop, colorStops[i].color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawWorldBackdrop(ctx, tick, hw, hh) {
    for (var di = 0; di < spaceDustBands.length; di++) {
        var band = spaceDustBands[di];
        var bandOffset = Math.sin(tick * 0.002 + band.phase) * band.rx * 0.03;
        var bandPt = projectBackdropPoint(band.x + bandOffset, band.y + Math.cos(tick * 0.0016 + band.phase) * band.ry * 0.16, band.depth);
        if (Math.abs(bandPt.x - G.cam.x) > hw + band.rx + 80 || Math.abs(bandPt.y - G.cam.y) > hh + band.ry + 80) continue;
        drawBackdropEllipse(ctx, bandPt.x, bandPt.y, band.rx, band.ry, band.rot, [
            { stop: 0, color: hexToRgba(blendHex(band.color, '#ffffff', 0.22), 0.95) },
            { stop: 0.45, color: hexToRgba(band.color, 0.36) },
            { stop: 1, color: hexToRgba(band.color, 0) }
        ], band.alpha, 'screen');
    }

    for (var ni = 0; ni < spaceNebulas.length; ni++) {
        var nebula = spaceNebulas[ni];
        var driftX = Math.sin(tick * 0.0014 + nebula.phase) * nebula.drift;
        var driftY = Math.cos(tick * 0.001 + nebula.phase * 1.7) * nebula.drift * 0.6;
        var nebulaPt = projectBackdropPoint(nebula.x + driftX, nebula.y + driftY, nebula.depth);
        if (Math.abs(nebulaPt.x - G.cam.x) > hw + nebula.rx + 120 || Math.abs(nebulaPt.y - G.cam.y) > hh + nebula.ry + 120) continue;

        drawBackdropEllipse(ctx, nebulaPt.x, nebulaPt.y, nebula.rx, nebula.ry, nebula.rot, [
            { stop: 0, color: hexToRgba(blendHex(nebula.core, '#ffffff', 0.18), 0.78) },
            { stop: 0.35, color: hexToRgba(nebula.core, 0.34) },
            { stop: 0.74, color: hexToRgba(nebula.edge, 0.2) },
            { stop: 1, color: hexToRgba(nebula.edge, 0) }
        ], nebula.alpha, 'screen');

        drawBackdropEllipse(ctx, nebulaPt.x - nebula.rx * 0.14, nebulaPt.y - nebula.ry * 0.08, nebula.rx * 0.44, nebula.ry * 0.34, nebula.rot * 0.85, [
            { stop: 0, color: hexToRgba('#ffffff', 0.34) },
            { stop: 0.4, color: hexToRgba(blendHex(nebula.core, '#ffffff', 0.45), 0.24) },
            { stop: 1, color: 'rgba(255,255,255,0)' }
        ], nebula.alpha * 0.58, 'lighter');
    }

    ctx.save();
    for (var si = 0; si < stars.length; si++) {
        var star = stars[si];
        var starPt = projectBackdropPoint(star.x, star.y, star.depth);
        if (Math.abs(starPt.x - G.cam.x) > hw + star.glow + 30 || Math.abs(starPt.y - G.cam.y) > hh + star.glow + 30) continue;
        var twinkle = 0.56 + 0.44 * Math.sin(tick * 0.024 * star.twinkle + star.phase);
        var alpha = star.b * twinkle;
        if (star.glow > 0) {
            ctx.beginPath();
            ctx.arc(starPt.x, starPt.y, star.glow, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(star.col, alpha * 0.08);
            ctx.fill();
        }
        if (star.r < 1) {
            var side = Math.max(1, star.r * 1.3);
            ctx.fillStyle = hexToRgba(star.col, alpha);
            ctx.fillRect(starPt.x - side * 0.5, starPt.y - side * 0.5, side, side);
        } else {
            ctx.beginPath();
            ctx.arc(starPt.x, starPt.y, star.r, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(star.col, alpha);
            ctx.fill();
        }
        if (star.glint > 0) {
            ctx.strokeStyle = hexToRgba(star.col, alpha * 0.24);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(starPt.x - star.glint, starPt.y);
            ctx.lineTo(starPt.x + star.glint, starPt.y);
            ctx.moveTo(starPt.x, starPt.y - star.glint * 0.72);
            ctx.lineTo(starPt.x, starPt.y + star.glint * 0.72);
            ctx.stroke();
        }
    }
    ctx.restore();
}

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

function drawRocketShape(ctx, x, y, dirX, dirY, col, flicker, alpha, scale, bank, throttle) {
    var nX = -dirY, nY = dirX;
    scale = (scale || 1) * 1.5;
    alpha = alpha === undefined ? 1 : alpha;
    bank = clamp(Number(bank) || 0, -1, 1);
    throttle = clamp(Number(throttle) || 1, 0.2, 1.3);

    var flameLen = (2.7 + flicker * 1.8) * scale * (0.72 + throttle * 0.48);
    var flameWidth = (0.82 + flicker * 0.52) * scale * (0.82 + throttle * 0.22);
    var bankShift = bank * 0.95 * scale;
    var bx = x - dirX * flameLen + nX * bankShift * 0.32, by = y - dirY * flameLen + nY * bankShift * 0.32;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(x - dirX * 0.4 * scale + nX * (flameWidth + Math.max(0, bank) * 0.38 * scale), y - dirY * 0.4 * scale + nY * (flameWidth + Math.max(0, bank) * 0.38 * scale));
    ctx.lineTo(bx, by);
    ctx.lineTo(x - dirX * 0.4 * scale - nX * (flameWidth + Math.max(0, -bank) * 0.38 * scale), y - dirY * 0.4 * scale - nY * (flameWidth + Math.max(0, -bank) * 0.38 * scale));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,145,70,' + (0.16 + throttle * 0.1 + flicker * 0.16) + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bx, by, (1.1 + flicker * 0.9) * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,210,130,' + (0.12 + throttle * 0.12 + flicker * 0.16) + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bx, by, (2.1 + throttle * 1.4 + flicker * 0.8) * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,170,90,' + (0.05 + throttle * 0.08) + ')';
    ctx.fill();

    var noseX = x + dirX * 1.85 * scale + nX * bankShift * 0.08, noseY = y + dirY * 1.85 * scale + nY * bankShift * 0.08;
    var leftSpan = (1.08 + Math.max(0, bank) * 0.58) * scale;
    var rightSpan = (1.08 + Math.max(0, -bank) * 0.58) * scale;
    var leftBack = (1.34 - Math.max(0, -bank) * 0.22) * scale;
    var rightBack = (1.34 - Math.max(0, bank) * 0.22) * scale;
    var leftX = x - dirX * leftBack + nX * leftSpan, leftY = y - dirY * leftBack + nY * leftSpan;
    var rightX = x - dirX * rightBack - nX * rightSpan, rightY = y - dirY * rightBack - nY * rightSpan;

    ctx.beginPath();
    ctx.arc(x + nX * bankShift * 0.16, y + nY * bankShift * 0.16, 4.3 * scale, 0, Math.PI * 2);
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
    ctx.moveTo(x - dirX * 0.15 * scale + nX * (0.2 + bank * 0.26) * scale, y - dirY * 0.15 * scale + nY * (0.2 + bank * 0.26) * scale);
    ctx.lineTo(noseX - dirX * 0.58 * scale, noseY - dirY * 0.58 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + throttle * 0.24) + ')';
    ctx.lineWidth = 0.95 * scale;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(noseX, noseY, 0.7 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
}

function drawFleetRocket(ctx, f, col, tick) {
    var count = Math.max(1, Number(f.count) || 1);
    var routeStart = fleetRouteStart(f), routeTarget = fleetRouteTarget(f);
    if (!routeStart || !routeTarget) return;
    var cp = { x: f.cpx, y: f.cpy };
    var launchT = clamp(typeof f.launchT === 'number' ? f.launchT : 0, 0, 0.2);
    var trail = f.trail || [];
    var tl = trail.length;
    var trailScale = clamp(Number(f.trailScale) || 1, 0.85, 1.5);
    var routeVisual = clamp((Number(f.routeSpeedMult) || 1) * (Number(f.spdVar) || 1), 0.85, 2);
    var hitFlash = clamp(Number(f.hitFlash) || 0, 0, 0.8);
    var hitJitter = clamp(Number(f.hitJitter) || 0, 0, 1.4);
    var hitDirX = Number.isFinite(f.hitDirX) ? f.hitDirX : 0;
    var hitDirY = Number.isFinite(f.hitDirY) ? f.hitDirY : 0;
    var throttle = clamp(Number(f.throttle) || (0.74 + Math.max(0, routeVisual - 1) * 0.18), 0.2, 1.28);
    var leadBank = clamp(Number(f.bank) || 0, -1, 1);
    var jitterPhase = tick * 18 + (f.id || 0) * 1.37;
    var hitShake = hitJitter * hitFlash;
    var renderX = f.x + hitDirX * Math.sin(jitterPhase) * hitShake * 0.75 - hitDirY * Math.cos(jitterPhase * 0.9) * hitShake * 0.45;
    var renderY = f.y + hitDirY * Math.sin(jitterPhase) * hitShake * 0.75 + hitDirX * Math.cos(jitterPhase * 0.9) * hitShake * 0.45;
    var shipCol = hitFlash > 0 ? blendHex(col, '#ffffff', Math.min(0.6, hitFlash * 0.72)) : col;
    var trailAlphaBoost = clamp(0.92 + Math.max(0, routeVisual - 1) * 0.65 + (trailScale - 1) * 0.45 + hitFlash * 0.28, 0.85, 1.7);
    var trailWidthBoost = clamp(0.95 + (trailScale - 1) * 0.85, 0.9, 1.5);
    if (tl > 0) {
        var prev = trail[0];
        for (var i = 1; i < tl; i++) {
            var curr = trail[i];
            var t = i / tl;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = hexToRgba(col, (0.04 + t * 0.18) * trailAlphaBoost);
            ctx.lineWidth = (0.6 + t * 1.6) * trailWidthBoost;
            ctx.lineCap = 'round';
            ctx.stroke();
            prev = curr;
        }
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(renderX, renderY);
        ctx.strokeStyle = hexToRgba(col, 0.28 * trailAlphaBoost);
        ctx.lineWidth = 2.3 * trailWidthBoost;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    var dirX = 1, dirY = 0;
    if (Number.isFinite(f.headingX) && Number.isFinite(f.headingY)) {
        dirX = f.headingX;
        dirY = f.headingY;
    } else if (tl > 0) {
        var from = trail[tl - 1];
        dirX = f.x - from.x;
        dirY = f.y - from.y;
    } else {
        dirX = routeTarget.x - routeStart.x;
        dirY = routeTarget.y - routeStart.y;
    }
    var dLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= dLen; dirY /= dLen;

    var phase = tick * 0.28 + f.srcId * 0.9 + f.tgtId * 0.6 + (f.id || 0) * 0.17 + f.offsetL * 0.08;
    var flicker = 0.5 + 0.5 * Math.sin(phase);
    if (hitFlash > 0.01) {
        ctx.beginPath();
        ctx.arc(renderX, renderY, (6.5 + hitShake * 3.2) * trailScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.08 + hitFlash * 0.18) + ')';
        ctx.fill();
    }
    drawRocketShape(ctx, renderX, renderY, dirX, dirY, shipCol, flicker, 1, 1, leadBank, throttle + hitFlash * 0.18);

    var supportCount = Math.max(0, Math.floor(count) - 1);
    if (supportCount > 0) {
        var spacingT = getFleetUnitSpacingT(f);
        var visibleSupportCount = Math.min(supportCount, Math.max(1, Math.min(24, Math.round(Math.sqrt(count) * 4.2))));
        var swarmLaneCount = Math.max(2, Math.min(6, Math.round(Math.sqrt(visibleSupportCount * 0.9))));
        var swarmWingGap = Math.min(13.5, 4.8 + Math.sqrt(visibleSupportCount) * 1.28 + Math.abs(f.offsetL) * 0.04);
        var swarmPush = Math.min(5.6, 1.8 + Math.sqrt(count) * 0.34);
        var visualStep = supportCount / visibleSupportCount;
        for (var vi = 0; vi < visibleSupportCount; vi++) {
            var unitIndex = Math.min(supportCount, Math.round(vi * visualStep) + 1);
            var row = Math.floor(vi / swarmLaneCount);
            var rowStart = row * swarmLaneCount;
            var rowCount = Math.min(swarmLaneCount, visibleSupportCount - rowStart);
            var lane = vi % swarmLaneCount;
            var centeredLane = rowCount <= 1 ? 0 : lane - (rowCount - 1) * 0.5;
            var jitter = hashMix(G.seed, f.id || 0, unitIndex, supportCount);
            var driftNoise = hashMix(G.seed + 31, f.srcId + unitIndex, f.tgtId, f.id || 0);
            var depthT = (row + 1) * spacingT * 0.55 + (driftNoise - 0.5) * spacingT * 0.28;
            var tUnit = f.t - depthT;
            if (tUnit <= 0) continue;
            var curveT = launchT + (1 - launchT) * clamp(tUnit, 0, 0.999);

            var pt = bezPt(routeStart, cp, routeTarget, curveT);
            var pt2 = bezPt(routeStart, cp, routeTarget, Math.min(1, curveT + 0.01));
            var udx = pt2.x - pt.x, udy = pt2.y - pt.y;
            var ulen = Math.sqrt(udx * udx + udy * udy) || 1;
            udx /= ulen; udy /= ulen;
            var unx = -udy, uny = udx;

            var settlePhase = tick * 0.045 + unitIndex * 0.37 + driftNoise * Math.PI * 2;
            var microDrift = Math.sin(settlePhase) * (0.18 + row * 0.04);
            var offsetL = centeredLane * swarmWingGap + (jitter - 0.5) * swarmWingGap * 0.18 + microDrift;
            var pushBack = row * swarmPush + (driftNoise - 0.5) * swarmPush * 0.22;
            var fade = Math.min(1, curveT * 5) * Math.min(1, (1 - curveT) * 5);
            var sx = pt.x + unx * offsetL * fade - udx * pushBack * fade;
            var sy = pt.y + uny * offsetL * fade - udy * pushBack * fade;
            var localFlicker = 0.5 + 0.5 * Math.sin(phase + unitIndex * 0.33);
            var alpha = clamp(0.9 - row * 0.08 - vi * 0.004, 0.32, 0.9);
            var supportScale = clamp(0.82 - row * 0.04, 0.62, 0.82);
            var supportBank = leadBank * clamp(1 - row * 0.12, 0.26, 0.92) + (driftNoise - 0.5) * 0.02;
            drawRocketShape(ctx, sx, sy, udx, udy, shipCol, localFlicker, alpha, supportScale, supportBank, throttle * 0.94 + hitFlash * 0.12);
        }
    }
}

function drawHoldingFleet(ctx, fleet, col, tick, selected) {
    var x = Number(fleet.x) || 0;
    var y = Number(fleet.y) || 0;
    var r = fleetSelectionRadius(fleet);
    var pulse = 0.72 + 0.28 * Math.sin(tick * 0.08 + (fleet.id || 0) * 0.31);
    var status = holdingFleetState(fleet);
    var dir = Number.isFinite(fleet.headingX) && Number.isFinite(fleet.headingY)
        ? { x: fleet.headingX, y: fleet.headingY }
        : { x: 1, y: 0 };
    var dirLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    dir.x /= dirLen;
    dir.y /= dirLen;
    var nX = -dir.y, nY = dir.x;
    var count = Math.max(1, Math.floor(Number(fleet.count) || 0));
    var shipCount = Math.max(3, Math.min(9, Math.round(Math.sqrt(count) * 1.5)));
    var formationRadius = Math.max(6, r * 0.78);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, formationRadius + 6, formationRadius * 0.72 + 4, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(col, 0.06 + pulse * 0.05);
    ctx.fill();

    if (status.contested || status.bonusBlocked || !status.supplied) {
        ctx.beginPath();
        ctx.ellipse(x, y, formationRadius + 10, formationRadius * 0.9 + 6, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
        ctx.setLineDash(status.contested ? [5, 4] : [2, 5]);
        ctx.strokeStyle = status.contested
            ? 'rgba(255,232,180,0.8)'
            : (status.bonusBlocked ? 'rgba(255,210,150,0.72)' : 'rgba(255,145,145,0.82)');
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
    } else if (status.supplied) {
        ctx.beginPath();
        ctx.ellipse(x, y, formationRadius + 8, formationRadius * 0.84 + 5, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(160,255,210,0.42)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    for (var i = 0; i < shipCount; i++) {
        var ratio = shipCount <= 1 ? 0 : i / (shipCount - 1);
        var lateral = (ratio - 0.5) * formationRadius * 1.35;
        var depth = (Math.abs(ratio - 0.5) * -3.4) + Math.sin(tick * 0.02 + i * 1.7 + (fleet.id || 0)) * 1.1;
        var shipX = x + nX * lateral - dir.x * depth;
        var shipY = y + nY * lateral - dir.y * depth;
        var shipScale = i === Math.floor(shipCount / 2) ? 0.8 : 0.66;
        var shipAlpha = i === Math.floor(shipCount / 2) ? 0.96 : 0.72;
        drawRocketShape(ctx, shipX, shipY, dir.x, dir.y, col, 0.5 + 0.5 * Math.sin(tick * 0.06 + i * 0.8 + fleet.id), shipAlpha, shipScale, 0, 0.6);
    }

    if (selected) {
        var bracketR = formationRadius + 6;
        var bracketA = Math.atan2(dir.y, dir.x);
        var bracketPts = [
            { x: Math.cos(bracketA) * bracketR - Math.sin(bracketA) * bracketR * 0.72, y: Math.sin(bracketA) * bracketR + Math.cos(bracketA) * bracketR * 0.72 },
            { x: Math.cos(bracketA) * bracketR + Math.sin(bracketA) * bracketR * 0.72, y: Math.sin(bracketA) * bracketR - Math.cos(bracketA) * bracketR * 0.72 },
            { x: -Math.cos(bracketA) * bracketR + Math.sin(bracketA) * bracketR * 0.72, y: -Math.sin(bracketA) * bracketR - Math.cos(bracketA) * bracketR * 0.72 },
            { x: -Math.cos(bracketA) * bracketR - Math.sin(bracketA) * bracketR * 0.72, y: -Math.sin(bracketA) * bracketR + Math.cos(bracketA) * bracketR * 0.72 },
        ];
        ctx.strokeStyle = hexToRgba(col, 0.95);
        ctx.lineWidth = 1.6;
        for (var bi = 0; bi < bracketPts.length; bi++) {
            var bp = bracketPts[bi];
            ctx.beginPath();
            ctx.moveTo(x + bp.x * 0.7, y + bp.y * 0.7);
            ctx.lineTo(x + bp.x, y + bp.y);
            ctx.stroke();
        }
    }

    ctx.font = 'bold 10px Outfit,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillText(String(count), x, y + formationRadius + 9);
    if (status.contested || status.bonusBlocked || !status.supplied) {
        ctx.font = 'bold 9px Outfit,sans-serif';
        ctx.fillStyle = status.contested
            ? 'rgba(255,236,196,0.92)'
            : (status.bonusBlocked ? 'rgba(255,220,170,0.9)' : 'rgba(255,170,170,0.92)');
        ctx.fillText(status.contested ? 'CEPHE' : (status.bonusBlocked ? 'KARARTMA' : 'DESTEKSIZ'), x, y - formationRadius - 10);
    }
    ctx.restore();
}

function desiredOrbitSquadCount(node) {
    var visibleShips = desiredOrbitVisibleShipCount(node);
    if (visibleShips <= 0) return 0;
    var preferredShipsPerSquad = 4;
    return Math.min(MAX_ORBIT_SQUADS, Math.max(1, Math.ceil(visibleShips / preferredShipsPerSquad)));
}

function desiredOrbitVisibleShipCount(node) {
    var uCount = Math.max(0, Math.floor(node.units || 0));
    if (uCount <= 0 || node.owner < 0 || node.kind === 'turret') return 0;
    var scaled = Math.round(uCount / ORBIT_UNITS_PER_VISIBLE_SHIP);
    if (uCount > 0 && scaled < 1) scaled = 1;
    return clamp(scaled, 1, MAX_ORBIT_SQUADS * MAX_ORBIT_SHIPS_PER_SQUAD);
}

function buildOrbitalSquad(node, slot) {
    var lane = slot % ORBIT_MAX_RINGS;
    var seedBase = G.seed + node.id * 97 + slot * 37;
    var orbitDir = hashMix(G.seed + node.id * 13, node.id, 7, 5) > 0.5 ? 1 : -1;
    return {
        slot: slot,
        lane: lane,
        phase: (slot * 2.39996323 + hashMix(seedBase, node.id, slot, 11) * Math.PI * 2) % (Math.PI * 2),
        speedMult: 0.88 + hashMix(seedBase + 29, node.id, slot, 17) * 0.58,
        turnDir: orbitDir,
        tilt: (node.id * 0.61 + lane * 0.94 + hashMix(seedBase + 53, node.id, slot, 23) * 0.65) % (Math.PI * 2),
        precession: (hashMix(seedBase + 67, node.id, slot, 29) - 0.5) * 0.0011,
        radiusBias: (hashMix(seedBase + 97, node.id, slot, 37) - 0.5) * 3.1,
        ellipseRatio: 0.58 + hashMix(seedBase + 113, node.id, slot, 41) * 0.14,
        bobblePhase: hashMix(seedBase + 131, node.id, slot, 43) * Math.PI * 2,
        bobbleAmp: 0.18 + hashMix(seedBase + 149, node.id, slot, 47) * 0.34,
        members: 1,
        wingSpread: 1.2 + hashMix(seedBase + 181, node.id, slot, 59) * 0.72,
        radialLag: 0.18 + hashMix(seedBase + 191, node.id, slot, 61) * 0.2,
        baseScale: 0.34 + hashMix(seedBase + 197, node.id, slot, 67) * 0.12,
        bankBias: (hashMix(seedBase + 211, node.id, slot, 71) - 0.5) * 0.42,
        throttleBias: 0.82 + hashMix(seedBase + 227, node.id, slot, 73) * 0.22,
        presence: 0
    };
}

function getNodeOrbitalSquads(node) {
    var desired = desiredOrbitSquadCount(node);
    var visibleShips = desiredOrbitVisibleShipCount(node);
    if (desired <= 0) return [];

    var signature = G.seed + ':' + node.id + ':' + node.radius + ':' + node.kind;
    var entry = orbitalVisualCache[node.id];
    if (!entry || entry.signature !== signature) {
        entry = { signature: signature, squads: [] };
        orbitalVisualCache[node.id] = entry;
    }

    while (entry.squads.length < desired) {
        entry.squads.push(buildOrbitalSquad(node, entry.squads.length));
    }

    var baseMembers = desired > 0 ? Math.floor(visibleShips / desired) : 0;
    var extraMembers = desired > 0 ? (visibleShips % desired) : 0;
    for (var i = 0; i < entry.squads.length; i++) {
        var squad = entry.squads[i];
        var target = i < desired ? 1 : 0;
        if (i < desired) squad.members = clamp(baseMembers + (i < extraMembers ? 1 : 0), 1, MAX_ORBIT_SHIPS_PER_SQUAD);
        else squad.members = 0;
        squad.presence += (target - squad.presence) * (target > squad.presence ? 0.18 : 0.24);
        squad.presence = clamp(squad.presence, 0, 1);
    }

    while (entry.squads.length > desired && entry.squads[entry.squads.length - 1].presence < 0.04) {
        entry.squads.pop();
    }

    var active = [];
    for (var ai = 0; ai < entry.squads.length; ai++) {
        if (entry.squads[ai].presence > 0.04) active.push(entry.squads[ai]);
    }
    return active;
}

function getOrbitalFrame(node, squad, tick) {
    var baseRadius = node.radius + 12.5 + squad.lane * 8.4 + squad.radiusBias - (node.defense ? squad.lane * 0.55 : 0);
    var bobble = Math.sin(tick * 0.021 + squad.bobblePhase + squad.slot * 0.61) * squad.bobbleAmp;
    var rx = Math.max(node.radius + 9, baseRadius + bobble);
    var ry = rx * clamp(squad.ellipseRatio + Math.sin(tick * 0.01 + squad.bobblePhase) * 0.015, 0.56, 0.82);
    var tilt = squad.tilt + tick * squad.precession;
    var orbitSpeed = ORBIT_SPD * squad.speedMult * Math.pow((node.radius + 12) / rx, 0.42) * squad.turnDir;
    var angle = tick * orbitSpeed + squad.phase;

    return {
        rx: rx,
        ry: ry,
        tilt: tilt,
        cosT: Math.cos(tilt),
        sinT: Math.sin(tilt),
        angle: angle,
        orbitDir: squad.turnDir,
    };
}

function orbitalPoint(node, frame, angle) {
    var lx = Math.cos(angle) * frame.rx;
    var ly = Math.sin(angle) * frame.ry;
    return {
        x: node.pos.x + lx * frame.cosT - ly * frame.sinT,
        y: node.pos.y + lx * frame.sinT + ly * frame.cosT,
        localX: lx,
        localY: ly
    };
}

function orbitalTangent(frame, angle) {
    var dx = -Math.sin(angle) * frame.rx * frame.orbitDir;
    var dy = Math.cos(angle) * frame.ry * frame.orbitDir;
    var tx = dx * frame.cosT - dy * frame.sinT;
    var ty = dx * frame.sinT + dy * frame.cosT;
    var len = Math.sqrt(tx * tx + ty * ty) || 1;
    return { x: tx / len, y: ty / len };
}

function orbitalRadial(point, node) {
    var rx = point.x - node.pos.x;
    var ry = point.y - node.pos.y;
    var len = Math.sqrt(rx * rx + ry * ry) || 1;
    return { x: rx / len, y: ry / len };
}

function drawOrbitalTrack(ctx, node, frame, col, frontPass, alpha, width) {
    ctx.save();
    ctx.translate(node.pos.x, node.pos.y);
    ctx.rotate(frame.tilt);
    ctx.beginPath();
    ctx.ellipse(0, 0, frame.rx, frame.ry, 0, frontPass ? 0 : Math.PI, frontPass ? Math.PI : Math.PI * 2);
    ctx.strokeStyle = hexToRgba(col, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

function drawOrbitalSquadron(ctx, node, squad, col, tick, frontPass) {
    if (!squad || squad.presence <= 0.04) return;

    var baseCol = col && col.indexOf('#') === 0 ? col : '#c8d6e5';
    var frame = getOrbitalFrame(node, squad, tick);
    var lead = orbitalPoint(node, frame, frame.angle);
    var shipIsFront = lead.localY >= 0;
    var arcAlpha = (frontPass ? 0.14 : 0.06) * squad.presence + (node.defense ? 0.02 : 0);
    drawOrbitalTrack(ctx, node, frame, baseCol, frontPass, arcAlpha, frontPass ? 1.05 : 0.85);
    if (shipIsFront !== frontPass) return;

    var tangent = orbitalTangent(frame, frame.angle);
    var radial = orbitalRadial(lead, node);
    var dirX = tangent.x, dirY = tangent.y;
    var nX = -dirY, nY = dirX;
    var formationTightness = node.defense ? 0.82 : 1.02;
    var leadScale = (squad.baseScale + (frontPass ? 0.06 : 0)) * (0.9 + squad.presence * 0.18);
    var spread = squad.wingSpread * leadScale * 3.15 * formationTightness;
    var trailGap = leadScale * 4.9 * (node.defense ? 0.84 : 1);
    var radialGap = leadScale * 3.2 * squad.radialLag;
    var shipAlpha = (frontPass ? 0.8 : 0.38) * squad.presence;
    var shipCol = frontPass ? blendHex(baseCol, '#ffffff', 0.08 + squad.presence * 0.08) : blendHex(baseCol, '#8fa3bf', 0.24);
    var radialLean = clamp(lead.localY / Math.max(1, frame.ry), -1, 1);
    var bank = clamp(frame.orbitDir * (0.18 + squad.bankBias) + radialLean * 0.14, -0.68, 0.68);
    var throttle = clamp(squad.throttleBias + (frontPass ? 0.08 : -0.03) + (node.defense ? 0.05 : 0), 0.55, 1.15);
    var flickerBase = tick * 0.32 + squad.phase + squad.slot * 0.73;
    var members = Math.max(1, squad.members);
    var formation = [
        { back: 0, lateral: 0, radial: 0, scale: 1 },
        { back: 1.05, lateral: 1, radial: 0.34, scale: 0.82 },
        { back: 1.05, lateral: -1, radial: -0.34, scale: 0.82 },
        { back: 1.95, lateral: 0, radial: 0.16, scale: 0.74 },
        { back: 2.15, lateral: 1.6, radial: 0.52, scale: 0.64 },
        { back: 2.15, lateral: -1.6, radial: -0.52, scale: 0.64 }
    ];

    if (frontPass) {
        ctx.beginPath();
        ctx.arc(lead.x, lead.y, leadScale * 6.2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(baseCol, 0.08 * squad.presence);
        ctx.fill();
    }

    for (var mi = 0; mi < members && mi < formation.length; mi++) {
        var form = formation[mi];
        var px = lead.x - dirX * trailGap * form.back + nX * spread * form.lateral + radial.x * radialGap * form.radial;
        var py = lead.y - dirY * trailGap * form.back + nY * spread * form.lateral + radial.y * radialGap * form.radial;
        var scale = leadScale * form.scale;
        var alpha = shipAlpha * (1 - mi * 0.08);
        var flicker = 0.5 + 0.5 * Math.sin(flickerBase + mi * 0.57);
        drawRocketShape(ctx, px, py, dirX, dirY, shipCol, flicker, alpha, scale, bank * (1 - mi * 0.18), throttle - mi * 0.04);
    }
}

function fillTerritoryCircleSet(ctx, territories, color, alpha, expand) {
    if (!territories.length || alpha <= 0) return;
    ctx.beginPath();
    for (var i = 0; i < territories.length; i++) {
        var territory = territories[i];
        var radius = Math.max(2, territory.radius + expand);
        ctx.moveTo(territory.x + radius, territory.y);
        ctx.arc(territory.x, territory.y, radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fill();
}

function strokeTerritoryCircleSet(ctx, territories, color, alpha, expand, lineWidth) {
    if (!territories.length || alpha <= 0) return;
    ctx.beginPath();
    for (var i = 0; i < territories.length; i++) {
        var territory = territories[i];
        var radius = Math.max(2, territory.radius + expand);
        ctx.moveTo(territory.x + radius, territory.y);
        ctx.arc(territory.x, territory.y, radius, 0, Math.PI * 2);
    }
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = Math.max(0.5, lineWidth || 1);
    ctx.stroke();
}

function drawTerritoryBridgeSet(ctx, territories, color, alpha, expand) {
    if (territories.length < 2 || alpha <= 0) return;
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < territories.length; i++) {
        var a = territories[i];
        for (var j = i + 1; j < territories.length; j++) {
            var b = territories[j];
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var distSq = dx * dx + dy * dy;
            var joinThreshold = a.radius + b.radius + 10;
            if (distSq > joinThreshold * joinThreshold) continue;
            ctx.lineWidth = Math.max(18, Math.min(a.radius, b.radius) * 1.42 + expand * 2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }
}

function drawContestedFronts(ctx, territorySets, tick) {
    var fronts = [];
    for (var i = 0; i < territorySets.length; i++) {
        for (var j = i + 1; j < territorySets.length; j++) {
            var aSet = territorySets[i];
            var bSet = territorySets[j];
            for (var ai = 0; ai < aSet.territories.length; ai++) {
                var a = aSet.territories[ai];
                for (var bi = 0; bi < bSet.territories.length; bi++) {
                    var b = bSet.territories[bi];
                    var dx = b.x - a.x;
                    var dy = b.y - a.y;
                    var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                    var overlap = (a.radius + b.radius) - d;
                    if (overlap <= 10) continue;
                    var dirX = dx / d;
                    var dirY = dy / d;
                    var centerBias = clamp(a.radius / Math.max(a.radius + b.radius, 1), 0.3, 0.7);
                    var midX = a.x + dx * centerBias;
                    var midY = a.y + dy * centerBias;
                    fronts.push({
                        x: midX,
                        y: midY,
                        radius: clamp(10 + overlap * 0.48, 12, 56),
                        ax: a.x + dirX * Math.min(a.radius * 0.4, d * 0.35),
                        ay: a.y + dirY * Math.min(a.radius * 0.4, d * 0.35),
                        bx: b.x - dirX * Math.min(b.radius * 0.4, d * 0.35),
                        by: b.y - dirY * Math.min(b.radius * 0.4, d * 0.35),
                    });
                }
            }
        }
    }
    if (!fronts.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.setLineDash([6, 5]);
    for (var fi = 0; fi < fronts.length; fi++) {
        var front = fronts[fi];
        var pulse = 0.52 + 0.48 * Math.sin(tick * 0.05 + fi * 0.9);
        ctx.beginPath();
        ctx.moveTo(front.ax, front.ay);
        ctx.lineTo(front.bx, front.by);
        ctx.strokeStyle = 'rgba(255,228,168,' + (0.12 + pulse * 0.08) + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(front.x, front.y, front.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,232,180,' + (0.03 + pulse * 0.025) + ')';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(front.x, front.y, front.radius * (0.74 + pulse * 0.08), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,238,196,' + (0.18 + pulse * 0.08) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawTerritories(ctx, tick) {
    var territoryCfg = territoryConfig();
    var byOwner = {};
    var territorySets = [];

    for (var i = 0; i < G.nodes.length; i++) {
        var node = G.nodes[i];
        if (!node || node.owner < 0) continue;
        if (!isNodeAssimilated(node)) continue;
        if (G.tune.fogEnabled && node.owner !== G.human && !G.fog.vis[G.human][node.id]) continue;
        if (!byOwner[node.owner]) byOwner[node.owner] = [];
        byOwner[node.owner].push({
            node: node,
            x: Number(node.pos.x) || 0,
            y: Number(node.pos.y) || 0,
            radius: territoryRadiusForNode(node, territoryCfg),
        });
    }
    for (var ownerKey in byOwner) {
        if (!Object.prototype.hasOwnProperty.call(byOwner, ownerKey)) continue;
        var owner = Math.floor(Number(ownerKey));
        var territories = byOwner[ownerKey];
        var color = G.players[owner] ? G.players[owner].color : COL_NEUTRAL;
        var fillAlpha = owner === G.human ? 0.085 : 0.052;
        var layer = ensureTerritoryLayerCanvas(ctx.canvas.width, ctx.canvas.height);
        if (!layer) continue;

        function prepareLayer() {
            layer.setTransform(1, 0, 0, 1, 0, 0);
            layer.clearRect(0, 0, territoryLayerCanvas.width, territoryLayerCanvas.height);
            layer.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
            layer.scale(G.cam.zoom, G.cam.zoom);
            layer.translate(-G.cam.x, -G.cam.y);
        }

        function compositeLayer(alpha) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = alpha;
            ctx.drawImage(territoryLayerCanvas, 0, 0);
            ctx.restore();
        }

        prepareLayer();
        drawTerritoryBridgeSet(layer, territories, color, 1, 0);
        fillTerritoryCircleSet(layer, territories, color, 1, 0);
        compositeLayer(fillAlpha);
        territorySets.push({ owner: owner, territories: territories });
    }
    drawContestedFronts(ctx, territorySets, tick);
}

function render(ctx, cv, tick) {
    pruneSelectedFleetIds();
    drawScreenBackdrop(ctx, cv, tick);
    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.scale(G.cam.zoom, G.cam.zoom);
    ctx.translate(-G.cam.x, -G.cam.y);
    renderWorldLayers({
        ctx: ctx,
        canvas: cv,
        tick: tick,
        game: G,
        inputState: inp,
        constants: {
            bezierCurve: BEZ_CURV,
            turretRange: TURRET_RANGE,
            assimLockTicks: ASSIM_LOCK_TICKS,
            colNeutral: COL_NEUTRAL,
            colFog: COL_FOG,
            nodeTypeDefs: NODE_TYPE_DEFS,
        },
        helpers: {
            drawWorldBackdrop: drawWorldBackdrop,
            drawMapFeature: drawMapFeature,
            drawTerritories: drawTerritories,
            getDefenseFieldStats: getDefenseFieldStats,
            defenseFieldCfg: defenseFieldCfg,
            hexToRgba: hexToRgba,
            bezCP: bezCP,
            drawHoldingFleet: drawHoldingFleet,
            drawFleetRocket: drawFleetRocket,
            fleetVis: fleetVis,
            clamp: clamp,
            strategicPulseAppliesToNode: strategicPulseAppliesToNode,
            getNodeOrbitalSquads: getNodeOrbitalSquads,
            drawOrbitalSquadron: drawOrbitalSquadron,
            drawTurretStation: drawTurretStation,
            nodeTypeOf: nodeTypeOf,
            blendHex: blendHex,
            darken: darken,
            getPlanetTexture: getPlanetTexture,
            drawTypeBadge: drawTypeBadge,
        },
    });
    ctx.restore();

    renderMinimapLayer({
        minimapCanvas: document.getElementById('minimapCanvas'),
        minimapWrapper: document.getElementById('minimap'),
        viewportCanvas: cv,
        game: G,
        constants: {
            mapWidth: MAP_W,
            mapHeight: MAP_H,
        },
    });
    renderMarqueeLayer({
        ctx: ctx,
        inputState: inp,
    });
    drawNodeHoverTipCanvas(ctx, cv);
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

    if (G.mapMutator && G.mapMutator.type === 'ion_storm') {
        var ion = G.mapMutator;
        var ionPulse = 0.72 + 0.28 * Math.sin(tick * 0.05);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ion.x, ion.y, ion.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,210,255,0.035)';
        ctx.fill();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = 'rgba(145,228,255,' + (0.18 + ionPulse * 0.08) + ')';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        for (var ia = 0; ia < 3; ia++) {
            var ang = tick * 0.02 + ia * (Math.PI * 2 / 3);
            var arcR = ion.r * (0.42 + ia * 0.16);
            ctx.beginPath();
            ctx.arc(ion.x, ion.y, arcR, ang, ang + Math.PI * 0.72);
            ctx.strokeStyle = 'rgba(195,245,255,' + (0.08 + ionPulse * 0.06) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    } else if (G.mapMutator && G.mapMutator.type === 'blackout') {
        var blackout = G.mapMutator;
        var blackoutPulse = 0.64 + 0.36 * Math.sin(tick * 0.04 + 0.8);
        ctx.save();
        ctx.beginPath();
        ctx.arc(blackout.x, blackout.y, blackout.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12,16,28,0.14)';
        ctx.fill();
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = 'rgba(255,214,150,' + (0.16 + blackoutPulse * 0.06) + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(blackout.x, blackout.y, blackout.r * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,236,196,' + (0.08 + blackoutPulse * 0.05) + ')';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ INPUT Ã¢â€â‚¬Ã¢â€â‚¬
var inp = createInputState();
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
    resetDragState();
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
function findHoldingFleetById(id) {
    for (var i = 0; i < G.fleets.length; i++) {
        var fleet = G.fleets[i];
        if (!fleet || !fleet.active || !fleet.holding) continue;
        if ((Number(fleet.id) || 0) === id) return fleet;
    }
    return null;
}
function pruneSelectedFleetIds() {
    var stale = [];
    inp.selFleets.forEach(function (id) {
        var fleet = findHoldingFleetById(id);
        if (!fleet || fleet.owner !== G.human) stale.push(id);
    });
    for (var i = 0; i < stale.length; i++) inp.selFleets.delete(stale[i]);
}
function syncNodeSelectionFlags() {
    for (var i = 0; i < G.nodes.length; i++) G.nodes[i].selected = inp.sel.has(G.nodes[i].id);
}
function clearSelection() {
    inp.sel.clear();
    inp.selFleets.clear();
    inp.commandMode = '';
    syncNodeSelectionFlags();
}
function selectedOwnedNodeIds(exceptId) {
    var ids = [];
    inp.sel.forEach(function (id) {
        var node = G.nodes[id];
        if (!node || node.owner !== G.human || id === exceptId) return;
        ids.push(node.id);
    });
    return ids;
}
function selectEntityIds(nodeIds, fleetIds, append) {
    pruneSelectedFleetIds();
    if (!append) {
        inp.sel.clear();
        inp.selFleets.clear();
        inp.commandMode = '';
    }
    for (var i = 0; i < nodeIds.length; i++) {
        var node = G.nodes[nodeIds[i]];
        if (!node || node.owner !== G.human) continue;
        inp.sel.add(node.id);
    }
    for (var fi = 0; fi < fleetIds.length; fi++) {
        var fleet = findHoldingFleetById(fleetIds[fi]);
        if (!fleet || fleet.owner !== G.human) continue;
        inp.selFleets.add(fleet.id);
    }
    syncNodeSelectionFlags();
}
function selectNodeIds(ids, append) {
    selectEntityIds(ids, [], append);
}
function selectFleetIds(ids, append) {
    selectEntityIds([], ids, append);
}
function hitHoldingFleet(wp) {
    var best = null, bestDist = Infinity;
    for (var i = G.fleets.length - 1; i >= 0; i--) {
        var fleet = G.fleets[i];
        if (!fleet || !fleet.active || !fleet.holding || fleet.owner !== G.human) continue;
        var radius = fleetSelectionRadius(fleet) + 6;
        var dx = (Number(fleet.x) || 0) - wp.x;
        var dy = (Number(fleet.y) || 0) - wp.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > radius || d >= bestDist) continue;
        best = fleet;
        bestDist = d;
    }
    return best;
}
function nodesInRect(s, e, pi) {
    var x0 = Math.min(s.x, e.x), x1 = Math.max(s.x, e.x), y0 = Math.min(s.y, e.y), y1 = Math.max(s.y, e.y), r = [];
    for (var i = 0; i < G.nodes.length; i++) { var n = G.nodes[i]; if (n.owner === pi && n.pos.x >= x0 && n.pos.x <= x1 && n.pos.y >= y0 && n.pos.y <= y1) r.push(n.id); } return r;
}
function holdingFleetIdsInRect(s, e, pi) {
    var x0 = Math.min(s.x, e.x), x1 = Math.max(s.x, e.x), y0 = Math.min(s.y, e.y), y1 = Math.max(s.y, e.y), ids = [];
    for (var i = 0; i < G.fleets.length; i++) {
        var fleet = G.fleets[i];
        if (!fleet || !fleet.active || !fleet.holding || fleet.owner !== pi) continue;
        var fx = Number(fleet.x) || 0;
        var fy = Number(fleet.y) || 0;
        if (fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1) ids.push(fleet.id);
    }
    return ids;
}
function selectedSendOrder(tgtId) {
    pruneSelectedFleetIds();
    var srcs = selectedOwnedNodeIds(tgtId), fleetIds = [];
    inp.selFleets.forEach(function (id) {
        var fleet = findHoldingFleetById(id);
        if (!fleet || fleet.owner !== G.human) return;
        fleetIds.push(fleet.id);
    });
    return { sources: srcs, fleetIds: fleetIds };
}
function sendFromSelectionTo(tgtId) {
    var selected = selectedSendOrder(tgtId);
    if (!selected.sources.length && !selected.fleetIds.length) return false;
    var sendData = { sources: selected.sources, fleetIds: selected.fleetIds, tgtId: tgtId, pct: inp.sendPct / 100 };
    if (!issueOnlineCommand('send', sendData)) {
        applyPlayerCommand(G.human, 'send', sendData);
    }
    return true;
}
function sendFromSourcesTo(srcs, fleetIds, tgtId) {
    var valid = [], validFleetIds = [];
    for (var i = 0; i < srcs.length; i++) {
        var sid = srcs[i];
        var sn = G.nodes[sid];
        if (sn && sn.owner === G.human && sid !== tgtId) valid.push(sid);
    }
    for (var fi = 0; fi < fleetIds.length; fi++) {
        var fleet = findHoldingFleetById(fleetIds[fi]);
        if (!fleet || fleet.owner !== G.human) continue;
        validFleetIds.push(fleet.id);
    }
    if (!valid.length && !validFleetIds.length) return false;
    var sendData = { sources: valid, fleetIds: validFleetIds, tgtId: tgtId, pct: inp.sendPct / 100 };
    if (!issueOnlineCommand('send', sendData)) {
        applyPlayerCommand(G.human, 'send', sendData);
    }
    return true;
}
function sendFromSourcesToPoint(srcs, fleetIds, point) {
    var targetPoint = normalizePointTarget(point);
    if (!targetPoint) return false;
    var valid = [], validFleetIds = [];
    for (var i = 0; i < srcs.length; i++) {
        var sid = srcs[i];
        var sn = G.nodes[sid];
        if (sn && sn.owner === G.human) valid.push(sid);
    }
    for (var fi = 0; fi < fleetIds.length; fi++) {
        var fleet = findHoldingFleetById(fleetIds[fi]);
        if (!fleet || fleet.owner !== G.human) continue;
        validFleetIds.push(fleet.id);
    }
    if (!valid.length && !validFleetIds.length) return false;
    var sendData = { sources: valid, fleetIds: validFleetIds, targetPoint: targetPoint, pct: inp.sendPct / 100 };
    if (!issueOnlineCommand('send', sendData)) {
        applyPlayerCommand(G.human, 'send', sendData);
    }
    return true;
}
function centroidForSources(srcIds, fleetIds) {
    var cx = 0, cy = 0, cc = 0;
    for (var i = 0; i < srcIds.length; i++) {
        var sn = G.nodes[srcIds[i]];
        if (!sn || sn.owner !== G.human) continue;
        cx += sn.pos.x;
        cy += sn.pos.y;
        cc++;
    }
    for (var fi = 0; fi < fleetIds.length; fi++) {
        var fleet = findHoldingFleetById(fleetIds[fi]);
        if (!fleet || fleet.owner !== G.human) continue;
        cx += Number(fleet.x) || 0;
        cy += Number(fleet.y) || 0;
        cc++;
    }
    if (!cc) return null;
    return { x: cx / cc, y: cy / cc };
}
function beginDragSend(srcIds, fleetIds, worldPos) {
    var center = centroidForSources(srcIds, fleetIds);
    if (!center) return false;
    inp.dragActive = true;
    inp.dragPending = false;
    inp.dragNodeIds = srcIds.slice();
    inp.dragFleetIds = fleetIds.slice();
    inp.dragStart = center;
    inp.dragEnd = worldPos;
    return true;
}
function resetDragState() {
    inp.dragActive = false;
    inp.dragPending = false;
    inp.dragDownNodeId = -1;
    inp.dragDownFleetId = -1;
    inp.dragNodeIds = [];
    inp.dragFleetIds = [];
    inp.touchPointOrderPending = false;
    inp.mousePointOrderPending = false;
}
function clearCommandMode() {
    inp.commandMode = '';
}
function toggleFlowFromSelectionTo(targetId) {
    var sourceIds = selectedOwnedNodeIds(targetId);
    if (!sourceIds.length) return false;
    for (var i = 0; i < sourceIds.length; i++) {
        var flowData = { srcId: sourceIds[i], tgtId: targetId };
        if (!issueOnlineCommand('flow', flowData)) {
            applyPlayerCommand(G.human, 'flow', flowData);
        }
    }
    return true;
}
function activateSelectionUpgrade() {
    var targetIds = selectedOwnedNodeIds();
    if (!targetIds.length || !(G.rules && G.rules.allowUpgrade)) return false;
    if (issueOnlineCommand('upgrade', { nodeIds: targetIds })) return true;
    for (var i = 0; i < targetIds.length; i++) upgradeNode(G.human, targetIds[i]);
    return true;
}
function activateSelectionDefense() {
    var targetIds = selectedOwnedNodeIds();
    if (!targetIds.length) return false;
    if (issueOnlineCommand('toggleDefense', { nodeIds: targetIds })) return true;
    for (var i = 0; i < targetIds.length; i++) toggleDefense(G.human, targetIds[i]);
    return true;
}
function armFlowSelection() {
    if (!selectedOwnedNodeIds().length) return false;
    inp.commandMode = inp.commandMode === 'flow' ? '' : 'flow';
    if (inp.commandMode === 'flow') showGameToast('Flow hedefini seç.');
    return true;
}
function applyCommandModeTarget(nodeId) {
    if (inp.commandMode !== 'flow') return false;
    clearCommandMode();
    if (!toggleFlowFromSelectionTo(nodeId)) {
        showGameToast('Flow için farklı bir hedef seç.');
        return true;
    }
    showGameToast('Flow emri güncellendi.');
    return true;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ DOM Ã¢â€â‚¬Ã¢â€â‚¬
var cv = document.getElementById('gameCanvas'), ctx = cv.getContext('2d');
var $ = function (id) { return document.getElementById(id); };
var mainMenu = $('mainMenu'), pauseOv = $('pauseOverlay'), goOv = $('gameOverOverlay'), hud = $('hud'), tunePanel = $('tuningPanel'), tuneOpen = $('tuneOpenBtn');
var seedIn = $('seedInput'), rndSeedBtn = $('randomSeedBtn'), ncIn = $('nodeCountInput'), ncLbl = $('nodeCountLabel'), diffSel = $('difficultySelect');
var playlistSel = $('playlistSelect'), doctrineSel = $('doctrineSelect');
var gameModeSel = $('gameModeSelect'), multiModeSel = $('multiModeSelect'), multiPlaylistSel = $('multiPlaylistSelect'), multiDoctrineSel = $('multiDoctrineSelect');
var multiSeedIn = $('multiSeedInput'), multiNodeIn = $('multiNodeInput'), multiNodeLbl = $('multiNodeLabel'), multiDiffSel = $('multiDiffSelect'), multiRoomTypeIn = $('multiRoomTypeSelect');
var hostSetupModeHint = $('hostSetupModeHint');
var startBtn = $('startBtn'), customStartBtn = $('customStartBtn'), sandboxBtn = $('sandboxBtn'), campaignBtn = $('campaignBtn'), dailyChallengeBtn = $('dailyChallengeBtn'), importMapBtn = $('importMapBtn'), exportMapBtn = $('exportMapBtn'), customMapFileIn = $('customMapFileInput');
var menuCustomizeBtn = $('menuCustomizeBtn'), menuOpenContentBtn = $('menuOpenContentBtn'), menuOpenMultiplayerBtn = $('menuOpenMultiplayerBtn'), menuOpenToolsBtn = $('menuOpenToolsBtn');
var menuHubView = $('menuHubView'), menuSubHeader = $('menuSubHeader'), menuSectionTitle = $('menuSectionTitle'), menuSectionCopy = $('menuSectionCopy'), menuBackBtn = $('menuBackBtn');
var panelSingleCustomize = $('panelSingleCustomize'), panelContent = $('panelContent'), panelMultiplayer = $('panelMultiplayer'), panelHostSetup = $('panelHostSetup'), panelTools = $('panelTools');
var playerNameIn = $('playerNameInput'), hostSetupBtn = $('hostSetupBtn'), hostSetupCreateRoomBtn = $('hostSetupCreateRoomBtn'), hostSetupBackBtn = $('hostSetupBackBtn');
var startRoomBtn = $('startRoomBtn');
var createRoomBtn = $('createRoomBtn');
var joinRoomRow = $('joinRoomRow');
var joinRoomCodeInput = $('joinRoomCodeInput');
var joinRoomBtn = $('joinRoomBtn');
var hostControls = $('hostControls'), leaveRoomBtn = $('leaveRoomBtn');
var customMapStatusEl = $('customMapStatus');
var contentCampaignProgressEl = $('contentCampaignProgress'), contentCampaignMissionEl = $('contentCampaignMission'), contentCampaignStartBtn = $('contentCampaignStartBtn');
var menuSeedChip = $('menuSeedChip'), menuPlaylistChip = $('menuPlaylistChip'), menuDoctrineChip = $('menuDoctrineChip'), menuModeChip = $('menuModeChip'), menuFogChip = $('menuFogChip');
var menuQuickStatusEl = $('menuQuickStatus'), menuStagePlaylistLabel = $('menuStagePlaylistLabel'), menuStageDoctrineLabel = $('menuStageDoctrineLabel');
var menuDailySpotlightTitle = $('menuDailySpotlightTitle'), menuDailySpotlightCopy = $('menuDailySpotlightCopy'), menuCampaignSpotlightTitle = $('menuCampaignSpotlightTitle'), menuCampaignSpotlightCopy = $('menuCampaignSpotlightCopy');
var menuHubDailyBtn = $('menuHubDailyBtn'), menuHubCampaignBtn = $('menuHubCampaignBtn'), menuContentCardMeta = $('menuContentCardMeta'), menuMultiCardMeta = $('menuMultiCardMeta');
var howToPlayBtn = $('howToPlayBtn');
var howToPlayOv = $('howToPlayOverlay');
var closeHowToPlayBtn = $('closeHowToPlayBtn');
var pauseHowToPlayBtn = $('pauseHowToPlayBtn');

function openHowToPlayModal() {
    if (howToPlayOv) howToPlayOv.classList.remove('hidden');
}
function closeHowToPlayModal() {
    if (howToPlayOv) howToPlayOv.classList.add('hidden');
}

if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', function () {
        openHowToPlayModal();
    });
}
if (pauseHowToPlayBtn) {
    pauseHowToPlayBtn.addEventListener('click', function () {
        openHowToPlayModal();
    });
}
if (closeHowToPlayBtn) {
    closeHowToPlayBtn.addEventListener('click', function () {
        closeHowToPlayModal();
    });
}
if (howToPlayOv) {
    howToPlayOv.addEventListener('click', function (e) {
        if (e.target === howToPlayOv) closeHowToPlayModal();
    });
}
var roomStatusEl = $('roomStatus'), roomPlayersEl = $('roomPlayers'), roomListEl = $('roomList');
var chatMessagesEl = $('chatMessages');
var pauseTitleEl = $('pauseTitle'), pauseHintEl = $('pauseHint'), resumeBtn = $('resumeBtn'), quitBtn = $('quitBtn');
var goTitle = $('gameOverTitle'), goMsg = $('gameOverMsg'), goStatsEl = $('gameOverStats'), restartBtn = $('restartBtn'), nextLevelBtn = $('nextLevelBtn');
var hudTelemetryRow = $('hudTelemetryRow'), hudTick = $('hudTick'), hudPct = $('hudPercent'), sendPctIn = $('sendPercent'), hudCap = $('hudCap'), hudMeta = $('hudMeta'), pauseBtn = $('pauseBtn'), spdBtn = $('speedBtn');
var hudContextBadge = $('hudContextBadge'), hudHintLine = $('hudHintLine'), hudCoachRow = $('hudCoachRow'), hudActionTip = $('hudActionTip');
var hudAdvisorCard = $('hudAdvisorCard'), hudAdvisorTitle = $('hudAdvisorTitle'), hudAdvisorBody = $('hudAdvisorBody');
var nodeHoverTip = $('nodeHoverTip'), nodeHoverTipTitle = $('nodeHoverTipTitle'), nodeHoverTipBody = $('nodeHoverTipBody');
var doctrineBtn = $('doctrineBtn'), upgradeHudBtn = $('upgradeHudBtn'), defenseHudBtn = $('defenseHudBtn'), flowHudBtn = $('flowHudBtn');
var sendPctQuickBtns = Array.prototype.slice.call(document.querySelectorAll('.send-quick-btn'));
var powerSidebar = $('powerSidebar'), powerListEl = $('powerList');
var scenarioOv = $('scenarioOverlay'), scenarioStartBtn = $('scenarioStartBtn'), scenarioCloseBtn = $('scenarioCloseBtn'), scenarioProgressEl = $('scenarioProgress'), scenarioBubbleListEl = $('scenarioBubbleList'), scenarioMissionEl = $('scenarioMission');
var campaignMissionHud = $('campaignMissionHud'), dailyChallengeCard = $('dailyChallengeCard');
var tuneProd = $('tuneProduction'), tuneFSpd = $('tuneFleetSpeed'), tuneDef = $('tuneDefense'), tuneFlowInt = $('tuneFlowInterval');
var tuneAiAgg = $('tuneAIAggression'), tuneAiBuf = $('tuneAIBuffer'), tuneAiDec = $('tuneAIDecision');
var tuneResetBtn = $('tuneResetBtn'), tuneTogBtn = $('tuneToggleBtn');
var tuneFogCb = $('tuneFogOfWar'), tuneAiAssistCb = $('tuneAiAssist'), menuFogCb = $('menuFogOfWar');
var exportMapHudBtn = $('exportMapHudBtn');
var audioToggleBtn = $('audioToggleBtn'), hudInfoToggleBtn = $('hudInfoToggleBtn'), hintToggleBtn = $('hintToggleBtn');
var tuneVals = { p: $('tuneProductionVal'), f: $('tuneFleetSpeedVal'), d: $('tuneDefenseVal'), fi: $('tuneFlowIntervalVal'), aa: $('tuneAIAggressionVal'), ab: $('tuneAIBufferVal'), ad: $('tuneAIDecisionVal') };
var UI_PREFS_KEY = 'stellar_ui_prefs_v1';
var DEFAULT_SFX_VOLUME = 0.85, DEFAULT_MUSIC_VOLUME = 0.55;
var tuningOpen = false, powerRenderKey = '', inGameMenuOpen = false, hudActionHelpBound = false;
var menuPanelViews = {
    hub: menuHubView,
    single_customize: panelSingleCustomize,
    content: panelContent,
    multiplayer: panelMultiplayer,
    host_setup: panelHostSetup,
    tools: panelTools,
};

function setMenuLobbyMeta(text) {
    if (menuMultiCardMeta) menuMultiCardMeta.textContent = text || 'Lobi taraması bekleniyor';
}
function refreshMenuHeroSummary() {
    var summary = buildMenuHeroSummary(menuState.skirmish);
    if (menuSeedChip) menuSeedChip.textContent = summary.seedChip;
    if (menuPlaylistChip) menuPlaylistChip.textContent = summary.playlistChip;
    if (menuDoctrineChip) menuDoctrineChip.textContent = summary.doctrineChip;
    if (menuModeChip) menuModeChip.textContent = summary.modeChip;
    if (menuFogChip) menuFogChip.textContent = summary.fogChip;
    if (menuQuickStatusEl) menuQuickStatusEl.textContent = summary.quickStatus;
    if (menuStagePlaylistLabel) menuStagePlaylistLabel.textContent = summary.stagePlaylistLabel;
    if (menuStageDoctrineLabel) menuStageDoctrineLabel.textContent = summary.stageDoctrineLabel;
}
var menuState = createMenuState({
    skirmish: {
        seed: seedIn ? seedIn.value : '42',
        nodeCount: ncIn ? ncIn.value : 16,
        difficulty: diffSel ? diffSel.value : 'normal',
        playlist: playlistSel ? playlistSel.value : 'standard',
        doctrineId: doctrineSel ? doctrineSel.value : 'auto',
        rulesMode: gameModeSel ? gameModeSel.value : 'advanced',
        fogEnabled: menuFogCb ? !!menuFogCb.checked : false,
    },
    multiplayer: {
        playerName: playerNameIn ? playerNameIn.value.trim() : '',
        joinCode: joinRoomCodeInput ? String(joinRoomCodeInput.value || '').trim().toUpperCase() : '',
        roomType: multiRoomTypeIn ? multiRoomTypeIn.value : 'standard',
    },
});

function applySkirmishMenuState() {
    var sk = menuState.skirmish;
    if (seedIn) seedIn.value = sk.seed;
    if (multiSeedIn) multiSeedIn.value = sk.seed;
    if (ncIn) ncIn.value = '' + sk.nodeCount;
    if (ncLbl) ncLbl.textContent = '' + sk.nodeCount;
    if (multiNodeIn) multiNodeIn.value = '' + sk.nodeCount;
    if (multiNodeLbl) multiNodeLbl.textContent = '' + sk.nodeCount;
    if (diffSel) diffSel.value = sk.difficulty;
    if (multiDiffSel) multiDiffSel.value = sk.difficulty;
    if (playlistSel) playlistSel.value = sk.playlist;
    if (multiPlaylistSel) multiPlaylistSel.value = sk.playlist;
    if (doctrineSel) doctrineSel.value = sk.doctrineId;
    if (multiDoctrineSel) multiDoctrineSel.value = sk.doctrineId;
    if (gameModeSel) gameModeSel.value = sk.rulesMode;
    if (multiModeSel) multiModeSel.value = sk.rulesMode;
    if (menuFogCb) menuFogCb.checked = !!sk.fogEnabled;
    refreshMenuHeroSummary();
}
function applyMultiplayerMenuState() {
    var mp = menuState.multiplayer;
    if (playerNameIn && playerNameIn.value !== mp.playerName) playerNameIn.value = mp.playerName;
    if (joinRoomCodeInput && joinRoomCodeInput.value !== mp.joinCode) joinRoomCodeInput.value = mp.joinCode;
    if (multiRoomTypeIn) multiRoomTypeIn.value = mp.roomType;
    syncRoomTypeInputs();
}
function applyMenuStateToInputs() {
    applySkirmishMenuState();
    applyMultiplayerMenuState();
}
function updateSkirmishMenuState(patch) {
    if (!patch) return;
    if (patch.seed !== undefined) menuState.skirmish.seed = normalizeMenuSeed(patch.seed);
    if (patch.nodeCount !== undefined) menuState.skirmish.nodeCount = clampMenuNodeCount(patch.nodeCount);
    if (patch.difficulty !== undefined) menuState.skirmish.difficulty = normalizeMenuDifficulty(patch.difficulty);
    if (patch.playlist !== undefined) menuState.skirmish.playlist = normalizeMenuPlaylist(patch.playlist);
    if (patch.doctrineId !== undefined) menuState.skirmish.doctrineId = normalizeMenuDoctrine(patch.doctrineId);
    if (patch.rulesMode !== undefined) menuState.skirmish.rulesMode = normalizeMenuRulesMode(patch.rulesMode);
    if (patch.fogEnabled !== undefined) menuState.skirmish.fogEnabled = !!patch.fogEnabled;
    applySkirmishMenuState();
}
function updateMultiplayerMenuState(patch) {
    if (!patch) return;
    if (patch.playerName !== undefined) menuState.multiplayer.playerName = String(patch.playerName || '').trim();
    if (patch.joinCode !== undefined) menuState.multiplayer.joinCode = String(patch.joinCode || '').trim().toUpperCase();
    if (patch.roomType !== undefined) menuState.multiplayer.roomType = normalizeMenuRoomType(patch.roomType);
    applyMultiplayerMenuState();
}
function setMenuPanel(panel, opts) {
    opts = opts || {};
    var next = normalizeMenuPanel(panel);
    menuState.panel = next;
    for (var key in menuPanelViews) {
        if (!Object.prototype.hasOwnProperty.call(menuPanelViews, key)) continue;
        var view = menuPanelViews[key];
        if (view) view.classList.toggle('hidden', key !== next);
    }
    if (menuSubHeader) menuSubHeader.classList.toggle('hidden', next === 'hub');
    if (menuSectionTitle) menuSectionTitle.textContent = next === 'hub' ? '' : MENU_PANEL_META[next].title;
    if (menuSectionCopy) menuSectionCopy.textContent = next === 'hub' ? '' : MENU_PANEL_META[next].copy;
    if (menuBackBtn) menuBackBtn.dataset.target = menuBackTarget(next);
    if (next === 'multiplayer' || next === 'host_setup') requestLobby();
    if (!opts.keepOverlay) closeScenarioMenu();
}

applyMenuStateToInputs();
setMenuLobbyMeta(buildMenuLobbyMeta({ connected: false }));
var uiPrefs = loadUiPrefs();

function loadUiPrefs() {
    try {
        var raw = localStorage.getItem(UI_PREFS_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return {
            audioEnabled: parsed && parsed.audioEnabled !== false,
            hudTelemetryVisible: !!(parsed && parsed.hudTelemetryVisible),
            hintsEnabled: parsed ? parsed.hintsEnabled !== false : true,
        };
    } catch (e) {
        return {
            audioEnabled: true,
            hudTelemetryVisible: false,
            hintsEnabled: true,
        };
    }
}
function saveUiPrefs() {
    try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
            audioEnabled: uiPrefs.audioEnabled !== false,
            hudTelemetryVisible: !!uiPrefs.hudTelemetryVisible,
            hintsEnabled: uiPrefs.hintsEnabled !== false,
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
    audioToggleBtn.textContent = uiPrefs.audioEnabled ? 'Ses: Açık' : 'Ses: Kapalı';
}
function syncHudTelemetryVisibility() {
    if (hudTelemetryRow) hudTelemetryRow.classList.toggle('hidden', !uiPrefs.hudTelemetryVisible);
    if (hudInfoToggleBtn) hudInfoToggleBtn.textContent = uiPrefs.hudTelemetryVisible ? 'Tick: Açık' : 'Tick: Kapalı';
}
function syncHintToggleButton() {
    if (!hintToggleBtn) return;
    hintToggleBtn.textContent = uiPrefs.hintsEnabled !== false ? 'İpucu: Açık' : 'İpucu: Kapalı';
}
function setHudActionTip(text) {
    if (!hudActionTip) return;
    hudActionTip.textContent = text || HUD_ACTION_HELP_DEFAULT;
}
function screenNodePos(node) {
    if (!node || !node.pos) return null;
    return {
        x: (node.pos.x - G.cam.x) * G.cam.zoom + cv.width * 0.5,
        y: (node.pos.y - G.cam.y) * G.cam.zoom + cv.height * 0.5,
    };
}
function hoveredNodeAtScreen(screenPos) {
    if (!screenPos || G.state !== 'playing') return null;
    return findHoveredNodeAtScreen({
        nodes: G.nodes,
        screenPos: screenPos,
        camera: G.cam,
        viewport: { width: cv.width, height: cv.height },
        visibilityTest: isNodeVisibleToHuman,
        extraRadius: 8,
        minRadius: 16,
    });
}
function isNodeVisibleToHuman(node) {
    if (!node) return false;
    if (!G.tune || !G.tune.fogEnabled) return true;
    if (node.owner === G.human) return true;
    return !!(G.fog && G.fog.vis && G.fog.vis[G.human] && G.fog.vis[G.human][node.id]);
}
function ensureNodeHoverTipElements() {
    if (!nodeHoverTip) nodeHoverTip = $('nodeHoverTip');
    if (!nodeHoverTipTitle) nodeHoverTipTitle = $('nodeHoverTipTitle');
    if (!nodeHoverTipBody) nodeHoverTipBody = $('nodeHoverTipBody');
    return !!(nodeHoverTip && nodeHoverTipTitle && nodeHoverTipBody);
}
function hideNodeHoverTip() {
    if (!ensureNodeHoverTipElements()) return;
    nodeHoverTip.classList.add('hidden');
    nodeHoverTip.setAttribute('aria-hidden', 'true');
}
function showNodeHoverTipForNode(node, screenPos) {
    if (!ensureNodeHoverTipElements() || !node || !screenPos) {
        hideNodeHoverTip();
        return;
    }
    if (G.state !== 'playing' || !isNodeVisibleToHuman(node)) {
        hideNodeHoverTip();
        return;
    }
    var tip = buildNodeHoverTip({
        kind: node.kind,
        label: nodeTypeOf(node).label,
    });
    nodeHoverTipTitle.textContent = tip.title;
    nodeHoverTipBody.textContent = tip.body;
    nodeHoverTip.classList.remove('hidden');
    nodeHoverTip.setAttribute('aria-hidden', 'false');
    positionNodeHoverTip(canvasToViewportPoint(screenPos, cv.getBoundingClientRect(), { width: cv.width, height: cv.height }));
}
function syncHoveredNodeStateFromPointer() {
    if (!inp || G.state !== 'playing' || inp.pointerInsideCanvas !== true) return;
    if (inp.panActive || inp.dragActive || inp.dragPending || inp.marqActive || inp.mousePointOrderPending || inp.touchPointOrderPending || inp.commandMode) return;
    var liveNode = hoveredNodeAtScreen(inp.ms);
    var liveId = liveNode ? liveNode.id : -1;
    var currentId = Number.isFinite(Number(inp.hoverNodeId)) ? Math.floor(Number(inp.hoverNodeId)) : -1;
    if (liveId !== currentId) {
        inp.hoverNodeId = liveId;
        inp.hoverSince = liveId >= 0 ? Date.now() : 0;
    }
}
function hoveredNodeForTip() {
    if (!inp || G.state !== 'playing' || inp.pointerInsideCanvas !== true) return null;
    if (inp.panActive || inp.dragActive || inp.dragPending || inp.marqActive || inp.mousePointOrderPending || inp.touchPointOrderPending || inp.commandMode) return null;
    syncHoveredNodeStateFromPointer();
    var node = hoveredNodeAtScreen(inp.ms);
    if (!node && Number.isFinite(Number(inp.hoverNodeId)) && Number(inp.hoverNodeId) >= 0) {
        node = G.nodes[Math.floor(Number(inp.hoverNodeId))];
    }
    if (!node) return null;
    if (NODE_HOVER_DWELL_MS > 0 && (!inp.hoverSince || Date.now() - inp.hoverSince < NODE_HOVER_DWELL_MS)) return null;
    if (!isNodeVisibleToHuman(node)) return null;
    return node;
}
function currentHoveredNodeTip() {
    var node = hoveredNodeForTip();
    if (!node) return null;
    return buildNodeHoverTip({
        kind: node.kind,
        label: nodeTypeOf(node).label,
    });
}
function positionNodeHoverTip(screenPos) {
    if (!ensureNodeHoverTipElements() || !screenPos) return;
    var pad = 14;
    var offsetX = 18;
    var offsetY = 20;
    var viewportW = window.innerWidth || document.documentElement.clientWidth || cv.width;
    var viewportH = window.innerHeight || document.documentElement.clientHeight || cv.height;
    var width = nodeHoverTip.offsetWidth || 240;
    var height = nodeHoverTip.offsetHeight || 72;
    var left = Math.round((Number(screenPos.x) || 0) + offsetX);
    var top = Math.round((Number(screenPos.y) || 0) + offsetY);
    if (left + width > viewportW - pad) left = Math.max(pad, Math.round((Number(screenPos.x) || 0) - width - offsetX));
    if (top + height > viewportH - pad) top = Math.max(pad, Math.round((Number(screenPos.y) || 0) - height - offsetY));
    nodeHoverTip.style.left = left + 'px';
    nodeHoverTip.style.top = top + 'px';
}
function wrapCanvasText(ctx, text, maxWidth) {
    text = String(text || '').trim();
    if (!text) return [];
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
        var next = line ? (line + ' ' + words[i]) : words[i];
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = words[i];
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}
function drawNodeHoverTipCanvas(ctx, canvas) {
    if (!ctx || !canvas || !inp) return;
    var node = hoveredNodeForTip();
    if (!node) return;
    var tip = buildNodeHoverTip({
        kind: node.kind,
        label: nodeTypeOf(node).label,
    });
    var anchor = screenNodePos(node) || inp.ms;

    var padX = 12;
    var padY = 10;
    var bodyMaxWidth = Math.min(280, Math.max(180, canvas.width * 0.24));
    ctx.save();
    ctx.font = '700 12px Outfit, sans-serif';
    var titleWidth = ctx.measureText(tip.title || '').width;
    ctx.font = '12px Outfit, sans-serif';
    var bodyLines = wrapCanvasText(ctx, tip.body || '', bodyMaxWidth);
    var bodyWidth = 0;
    for (var i = 0; i < bodyLines.length; i++) {
        bodyWidth = Math.max(bodyWidth, ctx.measureText(bodyLines[i]).width);
    }
    var width = Math.max(150, Math.min(bodyMaxWidth + padX * 2, Math.max(titleWidth, bodyWidth) + padX * 2));
    var titleLineHeight = 16;
    var bodyLineHeight = 15;
    var height = padY * 2 + titleLineHeight + (bodyLines.length ? 6 + bodyLines.length * bodyLineHeight : 0);
    var left = Math.round((Number(anchor.x) || 0) + Math.max(18, (Number(node.radius) || 0) * G.cam.zoom * 0.45));
    var top = Math.round((Number(anchor.y) || 0) - Math.max(26, (Number(node.radius) || 0) * G.cam.zoom * 0.55));
    var edgePad = 14;
    if (left + width > canvas.width - edgePad) left = Math.max(edgePad, Math.round((Number(anchor.x) || 0) - width - 18));
    if (top + height > canvas.height - edgePad) top = Math.max(edgePad, Math.round((Number(anchor.y) || 0) - height - 22));
    if (top < edgePad) top = Math.min(canvas.height - height - edgePad, Math.round((Number(anchor.y) || 0) + 20));

    ctx.fillStyle = 'rgba(8, 13, 24, 0.92)';
    ctx.strokeStyle = 'rgba(118, 162, 255, 0.34)';
    ctx.lineWidth = 1;
    ctx.fillRect(left, top, width, height);
    ctx.strokeRect(left, top, width, height);

    ctx.fillStyle = '#eef4ff';
    ctx.font = '700 12px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(tip.title || '', left + padX, top + padY);

    ctx.fillStyle = '#dbe8ff';
    ctx.font = '12px Outfit, sans-serif';
    var bodyY = top + padY + titleLineHeight + 6;
    for (var li = 0; li < bodyLines.length; li++) {
        ctx.fillText(bodyLines[li], left + padX, bodyY + li * bodyLineHeight);
    }
    ctx.restore();
}
function syncNodeHoverTip() {
    if (!ensureNodeHoverTipElements()) return;
    var node = hoveredNodeForTip();
    if (!node) {
        hideNodeHoverTip();
        return;
    }
    var tip = buildNodeHoverTip({
        kind: node.kind,
        label: nodeTypeOf(node).label,
    });
    nodeHoverTipTitle.textContent = tip.title;
    nodeHoverTipBody.textContent = tip.body;
    nodeHoverTip.classList.remove('hidden');
    nodeHoverTip.setAttribute('aria-hidden', 'false');
    var anchor = screenNodePos(node) || inp.ms;
    positionNodeHoverTip(canvasToViewportPoint(anchor, cv.getBoundingClientRect(), { width: cv.width, height: cv.height }));
}
function bindHudActionHelp() {
    if (hudActionHelpBound) return;
    var hudActionRoot = document.getElementById('hudRight');
    if (!hudActionRoot) return;
    var buttons = hudActionRoot.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        (function (btn) {
            function showHelp() {
                if (btn.disabled) {
                    setHudActionTip(btn.getAttribute('data-help-disabled') || btn.getAttribute('data-help') || btn.title || HUD_ACTION_HELP_DEFAULT);
                    return;
                }
                setHudActionTip(btn.getAttribute('data-help') || btn.title || HUD_ACTION_HELP_DEFAULT);
            }
            btn.addEventListener('mouseenter', showHelp);
            btn.addEventListener('focus', showHelp);
            btn.addEventListener('mouseleave', function () { setHudActionTip(); });
            btn.addEventListener('blur', function () { setHudActionTip(); });
        })(buttons[i]);
    }
    hudActionHelpBound = true;
    setHudActionTip();
}
function syncPauseOverlayContent() {
    var onlineMenu = net.online && G.state === 'playing' && inGameMenuOpen;
    if (pauseTitleEl) pauseTitleEl.textContent = onlineMenu ? 'Maç Menüsü' : 'Duraklatıldı';
    if (pauseHintEl) {
        if (onlineMenu) {
            pauseHintEl.textContent = 'Ana menüye dönersin. Ayrılırsan yerine AI devam eder.';
            pauseHintEl.classList.remove('hidden');
        } else {
            pauseHintEl.textContent = '';
            pauseHintEl.classList.add('hidden');
        }
    }
    if (resumeBtn) resumeBtn.textContent = onlineMenu ? 'Oyuna Dön' : 'Devam';
    if (quitBtn) quitBtn.textContent = onlineMenu ? 'Ana Menüye Dön' : 'Ana Menü';
    syncAudioToggleButton();
    syncHudTelemetryVisibility();
    syncHintToggleButton();
}
function syncMatchHudControls() {
    if (pauseBtn) {
        pauseBtn.textContent = net.online ? 'ÇIKIŞ' : 'MENÜ';
        pauseBtn.title = net.online ? 'Ana Menüye Dön' : 'Duraklat';
        pauseBtn.setAttribute('data-help', net.online
            ? 'Maç menüsünü açar. Ana menüye dönersen yerini AI devralır.'
            : 'Oyunu duraklatır ve menüyü açar. Kısayol: Esc veya P.');
        pauseBtn.classList.toggle('hud-exit-btn', !!net.online);
    }
    if (spdBtn) {
        spdBtn.disabled = !!net.online;
        spdBtn.title = net.online ? 'Online maçlarda devre dışı' : 'Hız';
        spdBtn.textContent = 'HIZ ' + G.speed + 'x';
        spdBtn.setAttribute('data-help', net.online
            ? 'Online maçlarda hız sabittir; tüm istemciler aynı tick hızında kalır.'
            : 'Tek oyunculuda oyun hızını değiştirir. Döngü: 1x, 2x, 4x.');
        spdBtn.setAttribute('data-help-disabled', 'Online maçlarda hız sunucu senkronu için sabittir.');
    }
    if (upgradeHudBtn) {
        upgradeHudBtn.disabled = G.state !== 'playing' || !selectedOwnedNodeIds().length || !(G.rules && G.rules.allowUpgrade);
        upgradeHudBtn.title = G.rules && G.rules.allowUpgrade ? 'Seçili gezegenleri yükselt' : 'Bu modda upgrade kapalı';
        upgradeHudBtn.setAttribute('data-help', 'Seçili kendi node\'larını upgrade eder. Kısayol: U.');
        upgradeHudBtn.setAttribute('data-help-disabled', G.rules && G.rules.allowUpgrade
            ? 'Önce kendi bir node seç. Upgrade yalnızca asimile ve yeterli garnizonlu node\'larda çalışır.'
            : 'Bu modda upgrade kapalı.');
    }
    if (defenseHudBtn) {
        defenseHudBtn.disabled = G.state !== 'playing' || !selectedOwnedNodeIds().length;
        defenseHudBtn.title = 'Seçili gezegenlerde savunmayı aç veya kapat';
        defenseHudBtn.setAttribute('data-help', 'Defense modu savunmayı ve asimilasyonu güçlendirir, üretimi düşürür.');
        defenseHudBtn.setAttribute('data-help-disabled', 'Defense için önce kendi bir node seç.');
    }
    if (flowHudBtn) {
        var hasOwnedSelection = selectedOwnedNodeIds().length > 0;
        if (!hasOwnedSelection && inp.commandMode) clearCommandMode();
        flowHudBtn.disabled = G.state !== 'playing' || !hasOwnedSelection;
        flowHudBtn.textContent = inp.commandMode === 'flow' ? 'HEDEF' : 'FLOW';
        flowHudBtn.title = inp.commandMode === 'flow' ? 'Flow hedefi seç' : 'Seçili kaynaklar için flow hedefi seç';
        flowHudBtn.classList.toggle('active', inp.commandMode === 'flow');
        flowHudBtn.setAttribute('data-help', inp.commandMode === 'flow'
            ? 'Flow modu aktif: hedef node\'a tıkla, boş alana tıklarsan iptal olur.'
            : 'Seçili kaynaklardan otomatik transfer hattı kurmak için hedef modu açar.');
        flowHudBtn.setAttribute('data-help-disabled', 'Flow için önce bir veya daha fazla kendi node seç.');
    }
    if (chatToggle) {
        chatToggle.disabled = !net.online;
        chatToggle.title = net.online ? 'Sohbet' : 'Sohbet yalnızca çok oyunculuda';
        chatToggle.setAttribute('data-help', net.online
            ? 'Sohbet panelini açar veya kapatır. Emote ve kısa mesajlar burada.'
            : 'Sohbet yalnızca çok oyunculu odalarda aktiftir.');
        chatToggle.setAttribute('data-help-disabled', 'Sohbet yalnızca çok oyunculu odalarda aktiftir.');
    }
    if (exportMapHudBtn) {
        exportMapHudBtn.setAttribute('data-help', 'Geçerli maçı JSON custom map olarak dışa aktarır.');
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
function setHintsEnabled(enabled) {
    uiPrefs.hintsEnabled = !!enabled;
    saveUiPrefs();
    syncHintToggleButton();
    if (!uiPrefs.hintsEnabled) hideGameToast('hint');
    syncHudAssistiveText();
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
    return 'Pulse: üretim +' + Math.round((STRATEGIC_PULSE_PROD - 1) * 100) + '% | filo hızı +' + Math.round((STRATEGIC_PULSE_SPEED - 1) * 100) + '% | asimilasyon +' + Math.round((STRATEGIC_PULSE_ASSIM - 1) * 100) + '% | cap +' + STRATEGIC_PULSE_CAP;
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
    if (!stats.active) return 'Field OFF: asimilasyon tamamlanınca açılır';
    return 'Field: r' + Math.round(stats.range) + ' | düşman filo ' + stats.dps.toFixed(1) + '/s erir';
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
    if (total === 2) return index === 0 ? 'Üst GATE' : 'Alt GATE';
    return 'GATE ' + (index + 1);
}

function barrierGateObjectiveText() {
    var gates = barrierGateNodes();
    if (!gates.length) return 'haritadaki GATE gezegeni bulunamadı';
    if (gates.length === 1) return 'haritadaki GATE etiketli gezegeni ele geçir';
    return 'haritadaki GATE etiketli gezegenlerden birini ele geçir';
}

function barrierGatePromptText() {
    return 'Barrier aktif: ' + barrierGateObjectiveText() + '. Geçiş, fetih yetmez; asimilasyon tamamlanınca açılır.';
}

function barrierGateStatusText() {
    var gates = barrierGateNodes();
    if (!gates.length) return 'Barrier aktif ama GATE gezegeni bulunamadı.';
    var parts = [];
    for (var i = 0; i < gates.length; i++) {
        var gate = gates[i];
        var ownerText = gate.owner < 0 ? 'Tarafsız' : labelForPlayer(gate.owner);
        var statusText = gate.owner >= 0 ? (isNodeAssimilated(gate) ? 'hazır, geçit açık' : 'asimile oluyor, geçit kapalı') : 'boş, önce fethet';
        parts.push(barrierGateLabel(i, gates.length) + ': ' + ownerText + ' ' + statusText);
    }
    return 'Barrier | ' + parts.join(' | ');
}

function humanDoctrineId() {
    if (!Array.isArray(G.doctrines) || !G.doctrines.length) return '';
    return G.doctrines[G.human] || '';
}

function humanDoctrineStatusText() {
    var doctrineId = humanDoctrineId();
    if (!doctrineId) return '';
    return doctrineName(doctrineId) + ' | ' + doctrineCooldownSummary(G.doctrines, G.doctrineStates, G.human);
}

function encounterStatusText() {
    if (!Array.isArray(G.encounters) || !G.encounters.length) return '';
    var parts = [];
    for (var i = 0; i < G.encounters.length; i++) {
        var encounter = G.encounters[i];
        var node = G.nodes[encounter.nodeId];
        if (!node) continue;
        var ownerText = node.owner < 0 ? 'Tarafsız' : labelForPlayer(node.owner);
        if (encounter.type === 'relay_core') {
            parts.push(encounterName(encounter) + ': ' + ownerText + (isNodeAssimilated(node) ? ' | hat açık' : ' | asimilasyon bekliyor'));
        } else if (encounter.type === 'mega_turret') {
            parts.push(encounterName(encounter) + ': ' + ownerText + ' | kuşatma hedefi');
        }
    }
    return parts.join(' | ');
}

function activateDoctrineForPlayer(playerIndex) {
    var activation = activateDoctrine(G.doctrines, G.doctrineStates, playerIndex);
    G.doctrineStates = activation.states;
    if (activation.activated && playerIndex === G.human) {
        G.stats.doctrineActivations = (Number(G.stats.doctrineActivations) || 0) + 1;
        showGameToast(doctrineActiveName(G.doctrines[playerIndex]) + ' aktif.');
    }
    return activation.activated;
}

function triggerHumanDoctrine() {
    if (!humanDoctrineId()) return false;
    if (issueOnlineCommand('activateDoctrine', {})) return true;
    return activateDoctrineForPlayer(G.human);
}

function selectionMetaText() {
    if (!hudMeta || !inp || !inp.sel) return '';
    if (inp.commandMode === 'flow') return 'FLOW modu aktif: hedef gezegene dokun ya da tıkla.';
    var ids = Array.from(inp.sel).filter(function (id) { return !!G.nodes[id]; });
    if (!ids.length) {
        var hoverTip = currentHoveredNodeTip();
        if (hoverTip) return hoverTip.title + ' | ' + hoverTip.body;
        var idleParts = [];
        if (G.mapFeature && G.mapFeature.type === 'barrier') idleParts.push(barrierGateStatusText());
        if (G.mapMutator && G.mapMutator.type !== 'none') idleParts.push('Mutator: ' + mapMutatorName(G.mapMutator));
        if (G.encounters && G.encounters.length) idleParts.push(encounterStatusText());
        if (humanDoctrineId()) idleParts.push(humanDoctrineStatusText());
        if (G.strategicPulse && G.strategicPulse.active) idleParts.push(pulseBonusSummary());
        if (idleParts.length) return idleParts.join(' | ');
        return 'Bir gezegen seç: upgrade maliyeti, savunma alanı, asimilasyon, supply ve pulse etkileri burada görünür.';
    }

    if (ids.length === 1) {
        var node = G.nodes[ids[0]];
        var ownerLabel = node.owner >= 0 ? labelForPlayer(node.owner) : 'Tarafsız';
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
        if (node.gate) parts.push(node.owner === G.human && isNodeAssimilated(node) ? 'GATE ready: geçit açık' : 'GATE: bariyeri aşıp diğer tarafa geçişi açar');
        if (node.encounterType) parts.push(encounterName(node.encounterType));
        if (strategicPulseAppliesToNode(node.id)) parts.push(pulseBonusSummary());
        else if (node.strategic) parts.push('Strategic hub: pulse buraya döndüğünde üretim, hız, asimilasyon ve cap bonusu gelir');
        if (G.mapMutator && G.mapMutator.type !== 'none' && isPointInsideMapMutator({ point: node.pos, mapMutator: G.mapMutator })) {
            parts.push(mapMutatorName(G.mapMutator));
        }
        return parts.join(' | ');
    }

    var owned = ids.map(function (id) { return G.nodes[id]; }).filter(function (node) { return node.owner === G.human; });
    var summary = [ids.length + ' seçili'];
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
function syncHudAssistiveText() {
    pruneSelectedFleetIds();
    var commandMode = inp ? inp.commandMode : '';
    var nodeCount = inp && inp.sel ? inp.sel.size : 0;
    var fleetCount = inp && inp.selFleets ? inp.selFleets.size : 0;
    var ownedCount = selectedOwnedNodeIds().length;
    var selectedOwnedNodes = [];
    var selectedNodeLabel = '';
    var i = 0;
    if (nodeCount === 1 && inp && inp.sel) {
        var selectedNode = G.nodes[Array.from(inp.sel)[0]];
        if (selectedNode) selectedNodeLabel = nodeTypeOf(selectedNode).label;
    }
    if (inp && inp.sel) {
        Array.from(inp.sel).forEach(function (id) {
            var node = G.nodes[id];
            if (node && node.owner === G.human) selectedOwnedNodes.push(node);
        });
    }
    if (hudContextBadge) {
        hudContextBadge.textContent = buildHudContextBadge({
            commandMode: commandMode,
            nodeCount: nodeCount,
            fleetCount: fleetCount,
            online: net.online,
            selectedNodeLabel: selectedNodeLabel,
        });
    }
    var hintsOn = hintsEnabled();
    var hoverTip = hintsOn && !nodeCount && !fleetCount ? currentHoveredNodeTip() : null;
    if (hudHintLine) {
        hudHintLine.classList.toggle('hidden', !hintsOn);
        hudHintLine.textContent = hoverTip
            ? (hoverTip.title + ': ' + hoverTip.body)
            : buildHudHintText({
                commandMode: commandMode,
                nodeCount: nodeCount,
                fleetCount: fleetCount,
                ownedCount: ownedCount,
            });
    }
    if (hudCoachRow) {
        hudCoachRow.classList.toggle('hidden', !hintsOn);
        renderHudCoach(hudCoachRow, hintsOn ? buildHudCoachItems({
            commandMode: commandMode,
            nodeCount: nodeCount,
            fleetCount: fleetCount,
            ownedCount: ownedCount,
            sendPct: inp ? inp.sendPct : 50,
        }) : []);
    }
    if (hudAdvisorCard) {
        var objectiveRows = currentCampaignObjectiveRows();
        var primaryObjective = pickPrimaryObjectiveRow(objectiveRows);
        var gates = barrierGateNodes();
        var readyGateCount = 0;
        for (i = 0; i < gates.length; i++) {
            if (gates[i].owner === G.human && isNodeAssimilated(gates[i])) readyGateCount++;
        }
        var hu = Math.floor((G.unitByPlayer && G.unitByPlayer[G.human]) || 0);
        var hc = Math.floor((G.capByPlayer && G.capByPlayer[G.human]) || 0);
        var pulseNode = G.strategicPulse && G.nodes ? G.nodes[G.strategicPulse.nodeId] : null;
        var advisor = hintsOn ? buildHudAdvisorCard({
            tick: G.tick,
            commandMode: commandMode,
            selectedOwnedUnassimilated: selectedOwnedNodes.some(function (node) { return !isNodeAssimilated(node); }),
            selectedOwnedUnsupplied: selectedOwnedNodes.some(function (node) { return node.supplied !== true; }),
            holdingFleetSelected: fleetCount > 0 && nodeCount === 0,
            capPressure: hc > 0 ? hu / hc : 0,
            primaryObjectiveTitle: primaryObjective ? currentMissionPanelTitle(currentMissionDefinition()) : '',
            primaryObjectiveLabel: primaryObjective ? primaryObjective.label : '',
            primaryObjectiveProgress: primaryObjective ? primaryObjective.progressText : '',
            primaryObjectiveCoach: primaryObjective ? primaryObjective.coach : '',
            mapFeatureType: G.mapFeature ? G.mapFeature.type : 'none',
            readyGateCount: readyGateCount,
            pulseOwnedActive: !!(G.strategicPulse && G.strategicPulse.active && pulseNode && pulseNode.owner === G.human && isNodeAssimilated(pulseNode)),
            encounterCount: Array.isArray(G.encounters) ? G.encounters.length : 0,
        }) : null;
        hudAdvisorCard.classList.toggle('hidden', !advisor);
        hudAdvisorCard.classList.remove('tone-info', 'tone-accent', 'tone-warning', 'tone-objective');
        if (advisor) {
            hudAdvisorCard.classList.add('tone-' + advisor.tone);
            if (hudAdvisorTitle) hudAdvisorTitle.textContent = advisor.title;
            if (hudAdvisorBody) hudAdvisorBody.textContent = advisor.body;
        }
    }
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
    var resolved = resolveMissionDefinition({
        dailyActive: G.daily.active,
        dailyChallenge: G.daily.challenge,
        campaignActive: G.campaign.active,
        campaignLevelIndex: G.campaign.levelIndex,
        campaignLevels: CAMPAIGN_LEVELS,
        objectives: G.objectives,
        playlist: G.playlist || 'standard',
        humanDoctrineId: humanDoctrineId(),
        doctrineId: G.doctrineId || '',
        endOnObjectives: G.endOnObjectives === true,
    });
    if (!resolved) return null;
    if (Array.isArray(G.objectives) && G.objectives.length) resolved = Object.assign({}, resolved, { objectives: JSON.parse(JSON.stringify(G.objectives)) });
    if (G.endOnObjectives === true) resolved.endOnObjectives = true;
    var phase = getActiveMissionPhase(G.missionScript, G.missionState);
    if (phase) {
        resolved = Object.assign({}, resolved, {
            phaseTitle: phase.title || '',
            phaseBlurb: phase.blurb || '',
        });
    }
    return resolved;
}

function currentMissionMode() {
    return resolveMissionMode({
        dailyActive: G.daily.active,
        dailyChallenge: G.daily.challenge,
        campaignActive: G.campaign.active,
        campaignLevelIndex: G.campaign.levelIndex,
        objectives: G.objectives,
    });
}

function currentMissionSnapshot() {
    return {
        tick: G.tick,
        didWin: G.winner === G.human,
        gameOver: G.state === 'gameOver',
        ownedNodes: countOwnedNodes(G.human),
        stats: G.stats || {},
        encounters: G.encounters || [],
        humanIndex: G.human,
        nodes: G.nodes || [],
    };
}

function currentCampaignObjectiveRows() {
    var level = currentMissionDefinition();
    if (!level) return [];
    return evaluateCampaignObjectives(level, currentMissionSnapshot(), { tickRate: TICK_RATE });
}

function currentMissionPanelTitle(level) {
    var title = buildMissionPanelTitle(level, currentMissionMode());
    if (level && level.phaseTitle) {
        var phaseIndex = G.missionState ? (Number(G.missionState.phaseIndex) || 0) + 1 : 1;
        var phaseCount = G.missionScript && Array.isArray(G.missionScript.phases) ? G.missionScript.phases.length : phaseIndex;
        title += ' | Faz ' + phaseIndex + '/' + phaseCount + ': ' + level.phaseTitle;
    }
    return title;
}

function currentMissionPanelSubtitle(level) {
    var subtitle = buildMissionPanelSubtitle({
        level: level,
        mode: currentMissionMode(),
        dailyCompleted: G.daily.completed,
        dailyBestTick: G.daily.bestTick,
    });
    if (level && level.phaseBlurb) return [level.phaseBlurb, subtitle].filter(Boolean).join(' | ');
    return subtitle;
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

function currentMissionIsComplete() {
    var rows = currentCampaignObjectiveRows();
    if (!rows.length) return false;
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].optional) continue;
        if (!rows[i].complete) return false;
    }
    return true;
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
        if (row.coach) showHintToast((mode === 'daily' ? 'Challenge' : 'Misyon') + ' ipucu: ' + row.coach);
        break;
    }
}

function maybeResolveMissionObjectiveVictory() {
    if (G.state !== 'playing') return;
    var result = advanceMissionState(G, { tickRate: TICK_RATE });
    if (result && result.phaseAdvanced) {
        if (currentMissionMode() === 'daily') G.daily.reminderShown = {};
        else G.campaign.reminderShown = {};
        if (result.phase && (result.phase.title || result.phase.hint || result.phase.blurb)) {
            var phaseBits = ['Yeni faz'];
            if (result.phase.title) phaseBits.push(result.phase.title);
            if (result.phase.hint) phaseBits.push(result.phase.hint);
            else if (result.phase.blurb) phaseBits.push(result.phase.blurb);
            showHintToast(phaseBits.join(': '));
        }
    } else if (result && result.failed && result.failureText) {
        showHintToast(result.failureText);
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
        { label: 'Doktrin aktivasyonu', value: G.stats.doctrineActivations || 0 },
    ];
    if (G.stats.gateCaptures > 0) rows.push({ label: 'GATE fetih', value: G.stats.gateCaptures });

    var missionRows = currentCampaignObjectiveRows();
    for (var i = 0; i < missionRows.length; i++) {
        rows.push({
            label: (missionRows[i].optional ? 'Bonus' : 'Görev') + ' ' + (i + 1),
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
                id: fleet.id || 0,
                active: true,
                owner: fleet.owner,
                count: fleet.count,
                srcId: fleet.srcId,
                tgtId: fleet.tgtId,
                fromX: fleet.fromX,
                fromY: fleet.fromY,
                toX: fleet.toX,
                toY: fleet.toY,
                holding: !!fleet.holding,
                holdUnsuppliedTicks: Math.max(0, Math.floor(Number(fleet.holdUnsuppliedTicks) || 0)),
                routeSrcKey: fleet.routeSrcKey || '',
                routeTgtKey: fleet.routeTgtKey || '',
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
                trailScale: fleet.trailScale || 1,
                headingX: Number.isFinite(fleet.headingX) ? fleet.headingX : 1,
                headingY: Number.isFinite(fleet.headingY) ? fleet.headingY : 0,
                bank: fleet.bank || 0,
                throttle: fleet.throttle || 0.3,
                turnRate: fleet.turnRate || 6,
                throttleBias: fleet.throttleBias || 1,
                lookAhead: fleet.lookAhead || 0.022,
                hitFlash: fleet.hitFlash || 0,
                hitJitter: fleet.hitJitter || 0,
                hitDirX: Number.isFinite(fleet.hitDirX) ? fleet.hitDirX : 0,
                hitDirY: Number.isFinite(fleet.hitDirY) ? fleet.hitDirY : 0,
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
        mapMutator: JSON.parse(JSON.stringify(G.mapMutator || { type: 'none' })),
        playlist: G.playlist || 'standard',
        doctrineId: G.doctrineId || '',
        doctrines: JSON.parse(JSON.stringify(G.doctrines || [])),
        doctrineStates: JSON.parse(JSON.stringify(G.doctrineStates || [])),
        encounters: JSON.parse(JSON.stringify(G.encounters || [])),
        objectives: JSON.parse(JSON.stringify(G.objectives || [])),
        missionScript: JSON.parse(JSON.stringify(G.missionScript || null)),
        missionState: JSON.parse(JSON.stringify(G.missionState || null)),
        missionFailureText: G.missionFailureText || '',
        endOnObjectives: G.endOnObjectives === true,
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
        shockwaves: JSON.parse(JSON.stringify(G.shockwaves || [])),
        flowId: G.flowId,
        fleetSerial: G.fleetSerial,
        rngState: G.rng ? G.rng.s : 1,
        lastAppliedSeq: net.lastAppliedSeq,
    };
}

function advanceTransientVisuals(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (var fi0 = 0; fi0 < G.fleets.length; fi0++) {
        var visualFleet = G.fleets[fi0];
        if (!visualFleet) continue;
        visualFleet.hitFlash = Math.max(0, (Number(visualFleet.hitFlash) || 0) - dt * 2.8);
        visualFleet.hitJitter = Math.max(0, (Number(visualFleet.hitJitter) || 0) - dt * 3.6);
    }
    for (var pi = G.particles.length - 1; pi >= 0; pi--) {
        var particle = G.particles[pi];
        particle.x += particle.vx;
        particle.y += particle.vy;
        var drag = Number(particle.drag);
        if (Number.isFinite(drag) && drag > 0 && drag < 1) {
            particle.vx *= drag;
            particle.vy *= drag;
        }
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
    for (var swi = G.shockwaves.length - 1; swi >= 0; swi--) {
        G.shockwaves[swi].life -= dt;
        if (G.shockwaves[swi].life <= 0) G.shockwaves.splice(swi, 1);
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
        setRoomStatus('Online maç sunucu state ile senkronize edildi.', 'success');
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
    G.mapMutator = JSON.parse(JSON.stringify(snapshot.mapMutator || { type: 'none' }));
    G.playlist = String(snapshot.playlist || G.playlist || 'standard');
    G.doctrineId = String(snapshot.doctrineId || G.doctrineId || '');
    G.doctrines = JSON.parse(JSON.stringify(Array.isArray(snapshot.doctrines) ? snapshot.doctrines : G.doctrines || []));
    G.doctrineStates = ensureDoctrineStates(G.doctrines, Array.isArray(snapshot.doctrineStates) ? snapshot.doctrineStates : G.doctrineStates || []);
    G.encounters = JSON.parse(JSON.stringify(Array.isArray(snapshot.encounters) ? snapshot.encounters : G.encounters || []));
    G.objectives = JSON.parse(JSON.stringify(Array.isArray(snapshot.objectives) ? snapshot.objectives : G.objectives || []));
    G.missionScript = JSON.parse(JSON.stringify(snapshot.missionScript || null));
    G.missionState = JSON.parse(JSON.stringify(snapshot.missionState || null));
    G.missionFailureText = String(snapshot.missionFailureText || '');
    G.endOnObjectives = snapshot.endOnObjectives === true;
    G.encounterContext = {};
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
    G.shockwaves = JSON.parse(JSON.stringify(Array.isArray(snapshot.shockwaves) ? snapshot.shockwaves : []));
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
    stepEncounterState(G);
    net.lastAppliedSeq = typeof snapshot.lastAppliedSeq === 'number' ? snapshot.lastAppliedSeq : -1;
    clearSelection(true);
    resetDragState();
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
        state: G.state,
        winner: G.winner,
        nodes: G.nodes,
        fleets: G.fleets,
        players: G.players,
        mapFeature: G.mapFeature,
        mapMutator: G.mapMutator,
        doctrines: G.doctrines,
        doctrineStates: G.doctrineStates,
        encounters: G.encounters,
        objectives: G.objectives,
        missionScript: G.missionScript,
        missionState: G.missionState,
        missionFailureText: G.missionFailureText,
        endOnObjectives: G.endOnObjectives === true,
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
setMenuPanel('hub', { keepOverlay: true });

if (menuCustomizeBtn) menuCustomizeBtn.addEventListener('click', function () { setMenuPanel('single_customize'); });
if (menuOpenContentBtn) menuOpenContentBtn.addEventListener('click', function () { setMenuPanel('content'); });
if (menuOpenMultiplayerBtn) menuOpenMultiplayerBtn.addEventListener('click', function () { setMenuPanel('multiplayer'); });
if (menuOpenToolsBtn) menuOpenToolsBtn.addEventListener('click', function () { setMenuPanel('tools'); });
if (menuBackBtn) menuBackBtn.addEventListener('click', function () { setMenuPanel(menuBackBtn.dataset.target || 'hub'); });
if (hostSetupBtn) hostSetupBtn.addEventListener('click', function () { setMenuPanel('host_setup'); });
if (hostSetupBackBtn) hostSetupBackBtn.addEventListener('click', function () { setMenuPanel('multiplayer'); });

if (roomListEl) {
    roomListEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-room-code]');
        if (!btn || net.roomCode) return;
        var code = btn.getAttribute('data-room-code');
        if (code) {
            updateMultiplayerMenuState({ joinCode: code });
            doJoinRoom();
        }
    });
}

function showUI(st) {
    if (st !== 'playing') inGameMenuOpen = false;
    var pauseVisible = st === 'paused' || (st === 'playing' && inGameMenuOpen);
    mainMenu.classList.toggle('hidden', st !== 'mainMenu'); pauseOv.classList.toggle('hidden', !pauseVisible); goOv.classList.toggle('hidden', st !== 'gameOver');
    var ig = st === 'playing' || st === 'paused';
    hud.classList.toggle('hidden', !ig);
    if (powerSidebar) powerSidebar.classList.toggle('hidden', !ig);
    var cp = document.getElementById('chatPanel'); if (cp) cp.classList.toggle('hidden', !ig || !net.online);
    if (st === 'mainMenu') {
        setMenuPanel(net.roomCode ? 'multiplayer' : 'hub', { keepOverlay: true });
        applyMenuStateToInputs();
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
    syncHudAssistiveText();
    refreshCampaignMissionPanels();
}

function setRoomStatus(msg, error) {
    setRoomStatusState(roomStatusEl, msg || '', error === true ? 'error' : (error === 'success' ? 'success' : 'info'));
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

function roomButtonState() {
    applyLobbyControlState({
        playerNameInput: playerNameIn,
        startRoomButton: startRoomBtn,
        roomList: roomListEl,
        createRoomButton: createRoomBtn,
        hostSetupButton: hostSetupBtn,
        joinCodeRow: joinRoomRow,
        hostControls: hostControls,
        leaveRoomButton: leaveRoomBtn,
    }, getLobbyControlState({
        inRoom: !!net.roomCode,
        connected: net.connected,
        isHost: net.isHost,
        playerCount: net.players.length,
    }));
}

function renderRoomList(rooms) {
    renderRoomListUI(roomListEl, rooms, { connected: net.connected });
    setMenuLobbyMeta(buildMenuLobbyMeta({
        connected: net.connected,
        roomCount: rooms ? rooms.length : 0,
    }));
}

function clearRoomState(message, opts) {
    opts = opts || {};
    inGameMenuOpen = false;
    resetOnlineRoomState(net, opts);
    clearChatMessages();
    renderRoomPlayers(roomPlayersEl, [], null);
    if (!opts.preserveResume) clearRoomResumeState();
    if (message) setRoomStatus(message, false);
    roomButtonState();
    syncRoomTypeInputs();
    syncPauseOverlayContent();
    syncMatchHudControls();
    if (net.connected) setMenuLobbyMeta('Lobi taranıyor');
    requestLobby();
}

function requestLobby() {
    if (net.socket && net.connected) net.socket.emit('requestLobby');
}

function doCreateRoom() {
    ensureSocket();
    if (!net.socket) { setRoomStatus('Socket.IO yüklenemedi.', true); return; }
    if (!net.connected) { setRoomStatus('Sunucuya bağlanıyor...', false); return; }
    if (net.roomCode) return;

    var chosen = (playerNameIn && playerNameIn.value.trim()) || menuState.multiplayer.playerName || '';
    if (!chosen) { setRoomStatus('Önce nick seçmelisin.', true); return; }
    updateMultiplayerMenuState({ playerName: chosen });
    net.playerName = chosen;

    setRoomStatus('Oda kuruluyor...', false);
    var roomMode = normalizeMenuRoomType(menuState.multiplayer.roomType);
    var sk = menuState.skirmish;
    if (roomMode === 'custom' && !currentCustomMapConfig) {
        setRoomStatus('Custom oda açmak için önce bir custom map yükle.', true);
        return;
    }
    net.socket.emit('createRoom', buildCreateRoomRequest({
        playerName: net.playerName,
        mode: roomMode,
        skirmish: sk,
        customMap: currentCustomMapConfig,
    }));
}

function doJoinRoom() {
    ensureSocket();
    if (!net.socket) { setRoomStatus('Socket.IO yüklenemedi.', true); return; }
    if (!net.connected) { setRoomStatus('Sunucuya bağlanıyor...', false); return; }
    if (net.roomCode) return;

    var chosen = (playerNameIn && playerNameIn.value.trim()) || menuState.multiplayer.playerName || '';
    if (!chosen) { setRoomStatus('Önce nick seçmelisin.', true); return; }
    updateMultiplayerMenuState({ playerName: chosen });
    net.playerName = chosen;

    var code = (joinRoomCodeInput && joinRoomCodeInput.value.trim().toUpperCase()) || menuState.multiplayer.joinCode || '';
    if (!code || code.length !== 5) { setRoomStatus('Geçerli bir oda kodu girin (5 karakter).', true); return; }
    updateMultiplayerMenuState({ joinCode: code });

    net.pendingJoin = false;
    setRoomStatus('Odaya bağlanılıyor...', false);
    net.socket.emit('joinRoom', buildJoinRoomRequest({
        playerName: net.playerName,
        roomCode: code,
        reconnectToken: net.reconnectToken || '',
    }));
}

function issueOnlineCommand(type, data) {
    if (net.online && net.socket && net.roomCode) {
        if (net.authoritativeEnabled && !net.authoritativeReady) {
            setRoomStatus('Maç açılışı sunucudan senkronize ediliyor. Bir an bekle.', false);
            return true;
        }
        var sanitized = sanitizeCommandData(type, data || {});
        if (!sanitized) return false;
        net.socket.emit('playerCommand', {
            type: type,
            data: sanitized,
            tick: computeOnlineCommandTick(G.tick, net.lastPingMs),
            matchId: net.matchId,
        });
        return true;
    }
    return false;
}

function ensureSocket() {
    if (net.socket || typeof window.io !== 'function') return;
    net.socket = window.io(getSocketEndpoint(window.location));

    net.socket.on('connect', function () {
        net.connected = true;
        setRoomStatus('Bağlantı kuruldu. Oda Kur veya Katıl.', 'success');
        setMenuLobbyMeta('Lobi taranıyor');
        requestLobby();
        net.socket.emit('requestDailyChallenge');
        maybeResumeOnlineRoom();
        roomButtonState();
    });

    net.socket.on('connect_error', function () {
        net.connected = false;
        serverDailyChallenge = null;
        refreshDailyChallengeCard();
        setRoomStatus('Çok oyunculu sunucuya ulaşılamadı. "npm run server" ile başlat.', true);
        setMenuLobbyMeta('Çok oyunculu sunucu offline');
        roomButtonState();
    });

    net.socket.on('disconnect', function () {
        net.connected = false;
        serverDailyChallenge = null;
        refreshDailyChallengeCard();
        clearRoomState('Çok oyunculu sunucudan bağlantı koptu.', { preserveResume: true });
        setMenuLobbyMeta('Bağlantı koptu');
        if (G.state === 'playing' || G.state === 'paused' || G.state === 'gameOver') {
            G.state = 'mainMenu';
            showUI('mainMenu');
        }
    });

    net.socket.on('lobbyState', function (payload) {
        var rooms = payload && Array.isArray(payload.rooms) ? payload.rooms : [];
        if (net.roomCode) return; // Already in a room
        renderRoomList(rooms);
        setRoomStatus(buildLobbyListStatus({ connected: net.connected, roomCount: rooms.length }), false);
    });

    net.socket.on('roomState', function (state) {
        applyRoomStateNetState(net, state);
        if (state.reconnectToken) {
            saveRoomResumeState({
                roomCode: state.code,
                playerName: net.playerName,
                reconnectToken: state.reconnectToken,
            });
        }
        var menuPatches = buildRoomStateMenuPatches(state, menuState.skirmish);
        if (menuPatches) {
            updateSkirmishMenuState(menuPatches.skirmish);
            updateMultiplayerMenuState(menuPatches.multiplayer);
        }

        renderRoomPlayers(roomPlayersEl, net.players, state.hostId);
        setRoomStatus(buildRoomStatusSummary(state, {
            playerCount: net.players.length,
            isHost: net.isHost,
        }), false);
        setMenuLobbyMeta(buildMenuLobbyMeta({ roomCode: state.code }));
        roomButtonState();
        if (G.state === 'mainMenu') setMenuPanel('multiplayer', { keepOverlay: true });
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
        if (G.state === 'playing' || G.state === 'paused') {
            G.state = 'mainMenu';
            showUI('mainMenu');
            setMenuPanel('multiplayer', { keepOverlay: true });
        } else {
            setMenuPanel('multiplayer', { keepOverlay: true });
        }
    });

    net.socket.on('playerLeft', function (payload) {
        var leftName = (payload && payload.name) ? payload.name : 'Bir oyuncu';
        var leftColor = chatColorForPlayer(payload && payload.index);
        if (G.state === 'playing' && G.players && G.players[payload.index]) {
            G.players[payload.index].isAI = true;
            appendChatMessage(leftName + ' oyundan ayrıldı. Yerine Yapay Zeka geçti.', leftColor);
        } else if (net.players) {
            net.players = net.players.filter(function (p) { return p.index !== payload.index; });
            renderRoomPlayers(roomPlayersEl, net.players, net.isHost ? net.socket.id : null);
            appendChatMessage(leftName + ' odadan ayrıldı.', leftColor);
        }
    });
    net.socket.on('playerRejoined', function (payload) {
        if (G.state === 'playing' && G.players && G.players[payload.index]) {
            G.players[payload.index].isAI = false;
        }
        appendChatMessage((payload && payload.name ? payload.name : 'Bir oyuncu') + ' yeniden bağlandı.', 'var(--success)');
    });

    net.socket.on('pongTick', function (payload) {
        if (!net.online) return;
        net.lastPingMs = Date.now() - payload.clientTs;
        var latencyTicks = net.lastPingMs / 2 / 33.33;
        var realServerTick = payload.serverTick + latencyTicks;
        net.syncDrift = G.tick - realServerTick;
    });

    net.socket.on('matchStarted', function (payload) {
        var onlineState = beginOnlineMatch(net, payload, net.socket.id);
        if (payload && payload.reconnectToken) {
            saveRoomResumeState({
                roomCode: payload.roomCode || net.roomCode,
                playerName: net.playerName,
                reconnectToken: payload.reconnectToken,
            });
        }
        initGame(payload.seed || '42', Number(payload.nodeCount || 16), payload.difficulty || 'normal', buildOnlineMatchInitOptions(payload, onlineState));
        G.campaign.active = false;
        G.campaign.levelIndex = -1;
        G.daily.active = payload.mode === 'daily' && !!payload.challenge;
        G.daily.challenge = G.daily.active ? payload.challenge : null;
        G.daily.reminderShown = {};
        if (G.daily.active) syncDailyChallengeState(payload.challenge);
        else { G.daily.bestTick = 0; G.daily.completed = false; }
        currentCustomMapConfig = onlineState.onlineCustomMap;
        clearSelection(true);
        clearChatMessages();
        spIdx = 0;
        G.speed = 1;
        spdBtn.textContent = 'HIZ 1x';
        tuneFogCb.checked = G.tune.fogEnabled;
        if (menuFogCb) menuFogCb.checked = G.tune.fogEnabled;
        setRoomStatus(buildOnlineMatchStatusText(payload, net.localPlayerIndex, net.authoritativeEnabled), false);
        applyAudioPreference();
        showUI('playing');
        showHintToast('Ana menü için sağ üstteki CIKIS butonunu kullan.');
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
        net.syncWarningText = 'Sync uyuşmazlığı tespit edildi (tick ' + payload.tick + '). Maç sonucu doğrulanmayabilir.';
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
        setRoomStatus((payload && payload.message) || 'Maç sonucu doğrulanamadı.', true);
    });
    net.socket.on('matchResultConfirmed', function (payload) {
        if (payload && payload.draw) appendChatMessage('Maç sonucu: Berabere', 'var(--text-dim)');
        else appendChatMessage('Maç sonucu onaylandı: ' + ((payload && payload.winnerName) || ('P' + ((payload && payload.winnerIndex >= 0) ? (payload.winnerIndex + 1) : '?'))), 'var(--text-dim)');
        setRoomStatus('Maç sonucu sunucu tarafında onaylandı.', 'success');
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
// Menu
function syncRoomTypeInputs() {
    var roomMode = normalizeMenuRoomType(menuState.multiplayer.roomType);
    applyRoomTypeUiState({
        roomTypeSelect: multiRoomTypeIn,
        seedInput: multiSeedIn,
        nodeInput: multiNodeIn,
        difficultySelect: multiDiffSel,
        rulesModeSelect: multiModeSel,
        playlistSelect: multiPlaylistSel,
        doctrineSelect: multiDoctrineSel,
        nodeLabel: multiNodeLbl,
        modeHint: hostSetupModeHint,
    }, getRoomTypeUiState(roomMode));
}
syncRoomTypeInputs();
if (seedIn) seedIn.addEventListener('input', function () { updateSkirmishMenuState({ seed: seedIn.value }); });
if (multiSeedIn) multiSeedIn.addEventListener('input', function () { updateSkirmishMenuState({ seed: multiSeedIn.value }); });
if (ncIn) ncIn.addEventListener('input', function () { updateSkirmishMenuState({ nodeCount: ncIn.value }); });
if (multiNodeIn) multiNodeIn.addEventListener('input', function () { updateSkirmishMenuState({ nodeCount: multiNodeIn.value }); });
if (diffSel) diffSel.addEventListener('change', function () { updateSkirmishMenuState({ difficulty: diffSel.value }); });
if (multiDiffSel) multiDiffSel.addEventListener('change', function () { updateSkirmishMenuState({ difficulty: multiDiffSel.value }); });
if (playlistSel) playlistSel.addEventListener('change', function () { updateSkirmishMenuState({ playlist: playlistSel.value }); });
if (multiPlaylistSel) multiPlaylistSel.addEventListener('change', function () { updateSkirmishMenuState({ playlist: multiPlaylistSel.value }); });
if (doctrineSel) doctrineSel.addEventListener('change', function () { updateSkirmishMenuState({ doctrineId: doctrineSel.value }); });
if (multiDoctrineSel) multiDoctrineSel.addEventListener('change', function () { updateSkirmishMenuState({ doctrineId: multiDoctrineSel.value }); });
if (gameModeSel) gameModeSel.addEventListener('change', function () { updateSkirmishMenuState({ rulesMode: gameModeSel.value }); });
if (multiModeSel) multiModeSel.addEventListener('change', function () { updateSkirmishMenuState({ rulesMode: multiModeSel.value }); });
if (menuFogCb) menuFogCb.addEventListener('change', function () { updateSkirmishMenuState({ fogEnabled: !!menuFogCb.checked }); });
if (multiRoomTypeIn) multiRoomTypeIn.addEventListener('change', function () { updateMultiplayerMenuState({ roomType: multiRoomTypeIn.value }); });
if (playerNameIn) playerNameIn.addEventListener('input', function () { updateMultiplayerMenuState({ playerName: playerNameIn.value }); });
if (joinRoomCodeInput) joinRoomCodeInput.addEventListener('input', function () { updateMultiplayerMenuState({ joinCode: joinRoomCodeInput.value }); });
if (rndSeedBtn) rndSeedBtn.addEventListener('click', function () { updateSkirmishMenuState({ seed: '' + Math.floor(Math.random() * 100000) }); });
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
    updateMultiplayerMenuState({ playerName: resume.playerName, joinCode: resume.roomCode });
    net.reconnectToken = resume.reconnectToken;
    net.resumePending = true;
    setRoomStatus('Bağlantı geri geldi. Maçtaki koltuk geri alınıyor...', false);
    net.socket.emit('joinRoom', buildJoinRoomRequest({
        playerName: resume.playerName,
        roomCode: resume.roomCode,
        reconnectToken: resume.reconnectToken,
    }));
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
    return serverDailyChallenge || buildDailyChallenge(todayDateKey(DAILY_CHALLENGE_TIMEZONE));
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
function campaignMutatorName(mutator) {
    return mapMutatorName(mutator);
}
function campaignLayoutName(level) {
    return level && level.customMap ? 'El Yapimi' : 'Prosedurel';
}
function campaignSystemsSummary(level) {
    var parts = [
        'Pulse hubları geçici tempo bonusu verir',
        'Strain cap\'in %' + Math.round(CAP_SOFT_START * 100) + '\'inde başlar',
        'Defense asimilasyonu hızlandırır ama üretimi keser',
        'Asimile gezegenler yakın savunma alanı açar',
        'Turretler artık daha sert kuşatma hedefidir',
    ];
    var rulesMode = (level && level.rulesMode) || 'advanced';
    if (level && level.customMap) parts.unshift('El yapimi sektor acilis rotalarini ve ilk cepheyi sabitler');
    if (rulesMode === 'advanced') parts.push('Supply altındaki node daha ucuza upgrade olur');
    if (level && level.encounters && level.encounters.length) parts.push('Encounterlar objective akışını değiştirir');
    if (level && level.doctrineId) parts.push('Doktrin açılışta oyunun temposunu belirler');
    return parts.join(' | ');
}
function campaignFeatureHint(level) {
    var feature = level ? level.mapFeature : null;
    var featureType = typeof feature === 'string' ? feature : ((feature && feature.type) || 'none');
    if (featureType === 'wormhole') return 'Wormhole: bağlı iki uç arasında filolar 2.0x hızla gider. Uzun rota yerine wormhole eksenini tut.';
    if (featureType === 'gravity') return 'Gravity: merkez alanı filoları 1.35x hızlandırır. Merkezden geçen rota hem baskın hem savunmada avantaja döner.';
    if (featureType === 'barrier') return 'Barrier: karşı tarafa geçmek için GATE gezegenini al ve asimilasyon tamamlanana kadar tut.';
    if (featureType === 'auto') return 'Anomali: harita tek bir özel mekanikle açılır. İlk dakikada ne olduğunu gözleyip plana hızla dön.';
    return 'Standart harita: supply zinciri, pulse zamanı ve savunma alanı kullanımı maçın temposunu belirler.';
}
function campaignLevelSummary(level) {
    return 'Bölüm ' + level.id + ': ' + level.name + '\n' +
        level.blurb + '\n' +
        'Node: ' + level.nc + ' | AI: ' + level.aiCount + ' | Zorluk: ' + menuDifficultyLabel(level.diff) +
        ' | Duzen: ' + campaignLayoutName(level) +
        ' | Özellik: ' + campaignFeatureName(level.mapFeature) +
        ' | Mutator: ' + campaignMutatorName(level.mapMutator || 'none') +
        ' | Oyun Listesi: ' + playlistName(level.playlist || 'standard') +
        (level.doctrineId ? (' | Doktrin: ' + doctrineName(level.doctrineId)) : '') +
        (level.fog ? ' | Sis Açık' : ' | Sis Kapalı') + '\n' +
        'Harita Dersi: ' + campaignFeatureHint(level) + '\n' +
        'Mutator: ' + mapMutatorHint(level.mapMutator || 'none') + '\n' +
        'Encounter: ' + encounterSummary(level.encounters || []) + '\n' +
        'Sistemler: ' + campaignSystemsSummary(level) + '\n' +
        'Hedefler: ' + describeCampaignObjectives(level, { tickRate: TICK_RATE }) + '\n' +
        'Plan: ' + (level.hint || 'Map temposunu pulse, supply ve savunma alanı ile yönet.');
}
function refreshDailyChallengeCard() {
    var challenge = todayDailyChallenge();
    var progress = getDailyChallengeProgress(challenge.key);
    var subtitle = challenge.key + ' | ' + challenge.blurb + (progress.completed ? ' | Temizlendi' : (progress.bestTick > 0 ? ' | En iyi: ' + progress.bestTick + ' tick' : ' | Henüz temizlenmedi'));
    var items = evaluateCampaignObjectives(challenge, {
        tick: 0,
        didWin: false,
        gameOver: false,
        ownedNodes: 0,
        stats: {},
        encounters: challenge.encounters || [],
        humanIndex: 0,
    }, { tickRate: TICK_RATE }).map(function (row) {
        return { label: row.label, progressText: row.optional ? 'Bonus' : 'Ana', optional: row.optional };
    });
    if (dailyChallengeCard) {
        renderMissionPanel(dailyChallengeCard, {
            title: 'Bugünün Challenge\'ı',
            subtitle: subtitle,
            items: items,
        });
    }
    if (menuDailySpotlightTitle) menuDailySpotlightTitle.textContent = challenge.title || 'Günlük challenge hazır';
    if (menuDailySpotlightCopy) menuDailySpotlightCopy.textContent = challenge.blurb + (progress.completed ? ' | Temizlendi' : (progress.bestTick > 0 ? ' | En iyi: ' + progress.bestTick + ' tick' : ' | İlk temizliği yap'));
    if (menuHubDailyBtn) menuHubDailyBtn.textContent = progress.completed ? 'Challenge\'ı Tekrar Oyna' : 'Günlük Challenge';
}
function refreshCustomMapStatus() {
    if (!customMapStatusEl) return;
    if (!currentCustomMapConfig) {
        customMapStatusEl.textContent = 'Custom map yükleyip başlangıç düzenini, anomalileri ve açılış node sahipliklerini sabitleyebilirsin.';
        return;
    }
    customMapStatusEl.textContent =
        'Hazır custom map: ' + currentCustomMapConfig.name +
        ' | ' + currentCustomMapConfig.nodes.length + ' node' +
        ' | ' + currentCustomMapConfig.playerCount + ' oyuncu' +
        ' | ' + campaignFeatureName(currentCustomMapConfig.mapFeature) +
        ' | Mutator: ' + campaignMutatorName(currentCustomMapConfig.mapMutator || 'none') +
        ' | Playlist: ' + playlistName(currentCustomMapConfig.playlist || 'standard') +
        (currentCustomMapConfig.doctrineId ? (' | Doktrin: ' + doctrineName(currentCustomMapConfig.doctrineId)) : '') +
        (currentCustomMapConfig.encounters && currentCustomMapConfig.encounters.length ? (' | Encounter: ' + encounterSummary(currentCustomMapConfig.encounters)) : '');
}
function applyCampaignLevelSelection(levelIndex) {
    var unlocked = G.campaign.unlocked || 1;
    var idx = Math.max(0, Math.min(CAMPAIGN_LEVELS.length - 1, Math.floor(Number(levelIndex) || 0)));
    if (idx >= unlocked) idx = unlocked - 1;
    campaignSelectedLevel = idx;
    return idx;
}
function refreshCampaignUI() {
    var unlocked = G.campaign.unlocked || 1;
    var completed = G.campaign.completed || 0;
    if (!isFinite(unlocked) || unlocked < 1) unlocked = 1;
    unlocked = Math.min(CAMPAIGN_LEVELS.length, unlocked);
    completed = clampCampaignCompleted(completed);
    if (completed > unlocked) unlocked = completed;
    G.campaign.unlocked = unlocked;
    G.campaign.completed = completed;
    applyCampaignLevelSelection(campaignSelectedLevel);

    if (scenarioProgressEl) scenarioProgressEl.textContent = 'Geçilen: ' + completed + ' / ' + CAMPAIGN_LEVELS.length + '  |  Açılan: ' + unlocked + ' / ' + CAMPAIGN_LEVELS.length;
    if (scenarioBubbleListEl) {
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
            var status = i < completed ? 'Geçildi' : (i < unlocked ? 'Açık' : 'Kilitli');
            bubble.title = 'Bölüm ' + lvl.id + ' - ' + lvl.name + ' (' + status + ')';
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
    }
    var selected = CAMPAIGN_LEVELS[campaignSelectedLevel];
    var selectedDone = campaignSelectedLevel < completed;
    var missionData = {
        title: 'Bölüm ' + selected.id + ': ' + selected.name,
        subtitle: selected.blurb + ' | AI ' + selected.aiCount + ' | ' + menuDifficultyLabel(selected.diff) + ' | ' + campaignLayoutName(selected) + ' | ' + campaignFeatureName(selected.mapFeature) + ' | Mutator: ' + campaignMutatorName(selected.mapMutator || 'none') + ' | Oyun Listesi: ' + playlistName(selected.playlist || 'standard') + (selected.doctrineId ? (' | Doktrin: ' + doctrineName(selected.doctrineId)) : '') + ' | ' + (selectedDone ? 'Durum: Geçildi' : 'Durum: Hazır'),
        items: evaluateCampaignObjectives(selected, {
            tick: 0,
            didWin: false,
            gameOver: false,
            ownedNodes: 0,
            stats: {},
            encounters: selected.encounters || [],
            humanIndex: 0,
        }, { tickRate: TICK_RATE }).map(function (row) {
            return { label: row.label, progressText: row.optional ? 'Bonus' : 'Ana', optional: row.optional };
        }),
    };
    if (scenarioMissionEl) renderMissionPanel(scenarioMissionEl, missionData);
    if (contentCampaignMissionEl) renderMissionPanel(contentCampaignMissionEl, missionData);
    if (contentCampaignProgressEl) {
        contentCampaignProgressEl.textContent = 'Geçilen: ' + completed + ' / ' + CAMPAIGN_LEVELS.length + ' | Açılan: ' + unlocked + ' / ' + CAMPAIGN_LEVELS.length + ' | Seçili: Bölüm ' + selected.id;
    }
    if (menuCampaignSpotlightTitle) menuCampaignSpotlightTitle.textContent = 'Bölüm ' + selected.id + ': ' + selected.name;
    if (menuCampaignSpotlightCopy) {
        menuCampaignSpotlightCopy.textContent = selected.blurb + ' | ' + (selectedDone ? 'Geçildi' : 'Hazır') + ' | AI ' + selected.aiCount + ' | ' + playlistName(selected.playlist || 'standard');
    }
    if (menuContentCardMeta) {
        menuContentCardMeta.textContent = 'Seçili görev // Bölüm ' + selected.id + ' | ' + (selectedDone ? 'Geçildi' : 'Hazır');
    }
    if (scenarioStartBtn) scenarioStartBtn.textContent = 'Bölüm ' + selected.id + ' Başlat';
    if (contentCampaignStartBtn) contentCampaignStartBtn.textContent = 'Bölüm ' + selected.id + ' Başlat';
    if (menuHubCampaignBtn) menuHubCampaignBtn.textContent = 'Bölüm ' + selected.id + ' Başlat';
}
function resetSelectionAndSpeed() {
    clearSelection(true);
    resetDragState();
    spIdx = 0;
    G.speed = 1;
    if (spdBtn) spdBtn.textContent = 'HIZ 1x';
}
function finalizeLocalGameStart(fogOn) {
    applySkirmishRunState(G);
    resetSelectionAndSpeed();
    if (tuneFogCb) tuneFogCb.checked = !!fogOn;
    applyAudioPreference();
    showUI('playing');
}
function startSinglePlayerGame() {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    var startConfig = buildSkirmishStartConfig(menuState.skirmish);
    currentCustomMapConfig = startConfig.customMapConfig;
    initGame(startConfig.seed, startConfig.nodeCount, startConfig.difficulty, startConfig.initOptions);
    finalizeLocalGameStart(startConfig.fogEnabled);
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
    var startConfig = buildDailyChallengeStartConfig(challenge);
    currentCustomMapConfig = startConfig.customMapConfig;
    syncDailyChallengeState(challenge);
    initGame(startConfig.seed, startConfig.nodeCount, startConfig.difficulty, startConfig.initOptions);
    applyDailyChallengeRunState(G, challenge);
    syncDailyChallengeState(challenge);
    resetSelectionAndSpeed();
    if (menuFogCb) menuFogCb.checked = startConfig.fogEnabled;
    if (tuneFogCb) tuneFogCb.checked = startConfig.fogEnabled;
    applyAudioPreference();
    showUI('playing');
    showGameToast(startConfig.toastText);
}
function startCustomMapGame(customMap) {
    var normalized = normalizeCustomMapConfig(customMap);
    var startConfig = buildCustomMapStartConfig(normalized);
    if (!startConfig) return;
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    currentCustomMapConfig = startConfig.customMapConfig;
    initGame(startConfig.seed, startConfig.nodeCount, startConfig.difficulty, startConfig.initOptions);
    finalizeLocalGameStart(startConfig.fogEnabled);
    showGameToast(startConfig.toastText);
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
            showGameToast('Hazır custom map dışa aktarıldı.');
            return;
        }
        showGameToast('Dışa aktarmak için önce bir maç aç.');
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
        mapMutator: G.mapMutator,
        strategicNodes: G.strategicNodes,
        playerCapital: G.playerCapital,
    }, {
        name: (G.daily.active && G.daily.challenge ? ('daily-' + G.daily.challenge.key) : (G.campaign.active ? ('campaign-' + ((currentCampaignLevel() && currentCampaignLevel().id) || 'map')) : ('map-' + G.seed))),
        seed: '' + G.seed,
        difficulty: G.diff,
        fogEnabled: !!G.tune.fogEnabled,
        rulesMode: G.rulesMode,
        playlist: G.playlist || 'standard',
        doctrineId: humanDoctrineId() || '',
        endOnObjectives: G.endOnObjectives === true,
    });
    var blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (exported.name || 'stellar-map').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.json';
    link.click();
    URL.revokeObjectURL(url);
    showGameToast('Harita JSON olarak dışa aktarıldı.');
}
function startCampaignLevel(levelIndex) {
    var idx = applyCampaignLevelSelection(levelIndex);
    var lvl = CAMPAIGN_LEVELS[idx];
    var startConfig = buildCampaignLevelStartConfig(lvl, idx);
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState('');
    initGame(startConfig.seed, startConfig.nodeCount, startConfig.difficulty, startConfig.initOptions);
    applyCampaignRunState(G, startConfig.campaignLevelIndex);
    currentCustomMapConfig = startConfig.customMapConfig;
    if (menuFogCb) menuFogCb.checked = startConfig.fogEnabled;
    if (tuneFogCb) tuneFogCb.checked = startConfig.fogEnabled;
    resetSelectionAndSpeed();
    applyAudioPreference();
    closeScenarioMenu();
    showUI('playing');
    if (startConfig.hintText) {
        setTimeout(function () {
            if (G.campaign.active && G.campaign.levelIndex === idx && G.state === 'playing') showHintToast(startConfig.hintText);
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
if (menuHubDailyBtn) {
    menuHubDailyBtn.addEventListener('click', function () {
        startDailyChallengeGame();
    });
}
if (menuHubCampaignBtn) {
    menuHubCampaignBtn.addEventListener('click', function () {
        startCampaignLevel(campaignSelectedLevel);
    });
}
if (customStartBtn) {
    customStartBtn.addEventListener('click', function () {
        startSinglePlayerGame();
    });
}
if (campaignBtn) {
    campaignBtn.addEventListener('click', function () {
        openScenarioMenu();
    });
}
if (contentCampaignStartBtn) {
    contentCampaignStartBtn.addEventListener('click', function () {
        startCampaignLevel(campaignSelectedLevel);
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
                alert('Custom map yüklenemedi: ' + err);
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
if (hostSetupCreateRoomBtn) {
    hostSetupCreateRoomBtn.addEventListener('click', function () {
        doCreateRoom();
        setMenuPanel('multiplayer', { keepOverlay: true });
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
        clearRoomState('Odadan ayrıldın.');
        setMenuPanel('multiplayer', { keepOverlay: true });
    });
}

if (startRoomBtn) {
    startRoomBtn.addEventListener('click', function () {
        if (!net.socket || !net.roomCode) return;
        if (net.players.length < 2) {
            setRoomStatus('Online başlat için en az 2 oyuncu gerekli.', true);
            return;
        }
        setRoomStatus('Online maç başlatılıyor...', false);
        net.socket.emit('startMatch');
    });
}

pauseBtn.addEventListener('click', function () {
    togglePauseMenu();
});
resumeBtn.addEventListener('click', function () {
    closePauseMenu();
});
quitBtn.addEventListener('click', function () {
    if (net.socket && net.roomCode) net.socket.emit('leaveRoom');
    clearRoomState(net.online ? 'Maçtan ayrıldın. Yerine AI devam ediyor.' : '');
    G.state = 'mainMenu'; showUI('mainMenu');
});
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', function () {
        setAudioEnabled(!uiPrefs.audioEnabled);
        showGameToast(uiPrefs.audioEnabled ? 'Ses açıldı.' : 'Ses kapatıldı.');
    });
}
if (hudInfoToggleBtn) {
    hudInfoToggleBtn.addEventListener('click', function () {
        setHudTelemetryVisible(!uiPrefs.hudTelemetryVisible);
        showGameToast(uiPrefs.hudTelemetryVisible ? 'Tick bilgisi açıldı.' : 'Tick bilgisi kapatıldı.');
    });
}
if (hintToggleBtn) {
    hintToggleBtn.addEventListener('click', function () {
        setHintsEnabled(!(uiPrefs.hintsEnabled !== false));
        showGameToast(uiPrefs.hintsEnabled !== false ? 'İpuçları açıldı.' : 'İpuçları kapatıldı.');
    });
}
var speeds = [1, 2, 4], spIdx = 0;
spdBtn.addEventListener('click', function () { if (net.online) return; spIdx = (spIdx + 1) % 3; G.speed = speeds[spIdx]; spdBtn.textContent = 'HIZ ' + G.speed + 'x'; });
var themeBtn = $('themeBtn');
function syncThemeButton() {
    if (!themeBtn) return;
    themeBtn.textContent = 'TEMA';
    themeBtn.title = document.body.classList.contains('theme-light') ? 'Koyu temaya geç' : 'Açık temaya geç';
    themeBtn.setAttribute('data-help', document.body.classList.contains('theme-light')
        ? 'Açık tema aktif. Tıklarsan koyu temaya geçer.'
        : 'Koyu tema aktif. Tıklarsan açık temaya geçer.');
}
if (themeBtn) themeBtn.addEventListener('click', function () {
    document.body.classList.toggle('theme-light');
    syncThemeButton();
});
syncThemeButton();
bindHudActionHelp();
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
    if (hudPct) hudPct.textContent = 'Gönder: ' + next + '%';
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
if (doctrineBtn) {
    doctrineBtn.addEventListener('click', function () {
        if (G.state !== 'playing') return;
        triggerHumanDoctrine();
    });
}
if (upgradeHudBtn) {
    upgradeHudBtn.addEventListener('click', function () {
        if (G.state !== 'playing') return;
        if (activateSelectionUpgrade()) clearCommandMode();
    });
}
if (defenseHudBtn) {
    defenseHudBtn.addEventListener('click', function () {
        if (G.state !== 'playing') return;
        if (activateSelectionDefense()) clearCommandMode();
    });
}
if (flowHudBtn) {
    flowHudBtn.addEventListener('click', function () {
        if (G.state !== 'playing') return;
        if (!armFlowSelection()) showGameToast('Flow için önce kendi gezegenlerini seç.');
    });
}
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
    if (net.online) return; G.tune.prod = parseFloat(tuneProd.value); G.tune.fspeed = parseFloat(tuneFSpd.value);
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
attachGameInputController({
    canvas: cv,
    windowTarget: window,
    gameState: G,
    inputState: inp,
    syncHoverTooltip: function (payload) {
        payload = payload && typeof payload === 'object' ? payload : {};
        if (payload.pointerInsideCanvas !== true) {
            hideNodeHoverTip();
            return;
        }
        showNodeHoverTipForNode(payload.node || null, payload.screenPos || null);
    },
    screenToWorld: s2w,
    touchScreenPos: touchScreenPos,
    hitNode: hitNode,
    hitNodeAtScreen: hoveredNodeAtScreen,
    hitHoldingFleet: hitHoldingFleet,
    resolveRightClickAction: resolveRightClickAction,
    shouldStartDragSend: shouldStartDragSend,
    issueOnlineCommand: issueOnlineCommand,
    toggleDefense: toggleDefense,
    applyPlayerCommand: applyPlayerCommand,
    pruneSelectedFleetIds: pruneSelectedFleetIds,
    syncNodeSelectionFlags: syncNodeSelectionFlags,
    clearSelection: clearSelection,
    selectEntityIds: selectEntityIds,
    selectNodeIds: selectNodeIds,
    selectFleetIds: selectFleetIds,
    selectedSendOrder: selectedSendOrder,
    sendFromSelectionTo: sendFromSelectionTo,
    sendFromSourcesTo: sendFromSourcesTo,
    sendFromSourcesToPoint: sendFromSourcesToPoint,
    nodesInRect: nodesInRect,
    holdingFleetIdsInRect: holdingFleetIdsInRect,
    centroidForSources: centroidForSources,
    beginDragSend: beginDragSend,
    resetDragState: resetDragState,
    clearCommandMode: clearCommandMode,
    applyCommandModeTarget: applyCommandModeTarget,
    beginTouchPinch: beginTouchPinch,
    updateTouchPinch: updateTouchPinch,
    showGameToast: showGameToast,
    togglePauseMenu: togglePauseMenu,
    closePauseMenu: closePauseMenu,
    isInGameMenuOpen: function () { return inGameMenuOpen; },
    isHowToPlayVisible: function () { return howToPlayOv && !howToPlayOv.classList.contains('hidden'); },
    closeHowToPlayModal: closeHowToPlayModal,
    activateSelectionUpgrade: activateSelectionUpgrade,
    triggerHumanDoctrine: triggerHumanDoctrine,
    setSendPct: setSendPct,
    clamp: clamp,
    zoomMin: ZOOM_MIN,
    zoomMax: ZOOM_MAX,
    zoomSpeed: ZOOM_SPD,
    selectAllHumanNodes: function () {
        clearSelection(true);
        G.nodes.forEach(function (n) { if (n.owner === G.human) inp.sel.add(n.id); });
        syncNodeSelectionFlags();
    },
    audioSelect: function () {
        if (typeof AudioFX !== 'undefined') AudioFX.select();
    },
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GAME LOOP Ã¢â€â‚¬Ã¢â€â‚¬
var acc = 0, lastT = 0, prevSt = 'mainMenu';
function loop(ts) {
    var rawDt = Math.min((ts - lastT) / 1000, 0.1); lastT = ts;
    if (G.state !== prevSt) {
        showUI(G.state); if (G.state === 'gameOver') {
            if (nextLevelBtn) nextLevelBtn.style.display = 'none';
            goTitle.textContent = G.winner === G.human ? 'Zafer' : 'Maglubiyet';
            goMsg.textContent = G.winner === G.human ? (G.tick + ' tickte tum yildizlari fethettin.') : ('Tick ' + G.tick + ' civarinda oyundan dustun.');
            if (G.campaign.active && G.campaign.levelIndex >= 0) {
                var level = CAMPAIGN_LEVELS[G.campaign.levelIndex];
                if (G.winner === G.human) {
                    completeCampaignLevel();
                    if (G.campaign.levelIndex + 1 < CAMPAIGN_LEVELS.length) {
                        var nextInfo = CAMPAIGN_LEVELS[G.campaign.levelIndex + 1];
                        goTitle.textContent = 'Bölüm ' + level.id + ' Tamamlandı';
                        goMsg.textContent = 'Yeni bölüm açıldı: ' + nextInfo.id + '. ' + nextInfo.name;
                        if (nextLevelBtn) {
                            nextLevelBtn.textContent = 'Sonraki Bölüm (' + nextInfo.id + ')';
                            nextLevelBtn.style.display = 'block';
                        }
                    } else {
                        goTitle.textContent = 'Senaryo Tamamlandı';
                        goMsg.textContent = CAMPAIGN_LEVELS.length + ' bölümün tamamını bitirdin. Solarmax Protocol temizlendi.';
                    }
                } else {
                    goTitle.textContent = 'Bölüm ' + level.id + ' Kaybedildi';
                    goMsg.textContent = G.missionFailureText || 'Aynı bölümü tekrar dene veya stratejini değiştir.';
                }
            }
            if (G.daily.active && G.daily.challenge) {
                var dailyProgress = saveDailyChallengeProgress(G.daily.challenge.key, G.winner === G.human, G.tick);
                G.daily.bestTick = dailyProgress.bestTick;
                G.daily.completed = dailyProgress.completed;
                refreshDailyChallengeCard();
                if (G.winner === G.human) {
                    goTitle.textContent = 'Günlük Challenge Tamamlandı';
                    goMsg.textContent = dailyProgress.bestTick === G.tick ?
                        ('Yeni en iyi süre: ' + G.tick + ' tick.') :
                        ('Challenge temizlendi. En iyi süre: ' + dailyProgress.bestTick + ' tick.');
                } else {
                    goTitle.textContent = 'Günlük Challenge Kaçırıldı';
                    goMsg.textContent = G.missionFailureText || (dailyProgress.bestTick > 0 ?
                        ('Bugünün en iyi sonucun: ' + dailyProgress.bestTick + ' tick. Bir tur daha dene.') :
                        'Bugünün challengei henüz temizlenmedi. Açılışı daha agresif kur.');
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
    if (G.state === 'playing') {
        var useAuthoritativeState = net.online && net.authoritativeEnabled && G.state === 'playing';
        if (useAuthoritativeState) {
            acc = 0;
            advanceTransientVisuals(rawDt);
            if (net.authoritativeReady) maybeSendOnlinePing();
        } else {
            acc += rawDt * G.speed;
            while (acc >= TICK_DT) { gameTick(); acc -= TICK_DT; }
        }
        var pulseNode = G.strategicPulse ? G.nodes[G.strategicPulse.nodeId] : null;
        hudTick.textContent = buildHudTickText({
            tick: G.tick,
            diff: G.diff,
            pulseActive: !!(G.strategicPulse && G.strategicPulse.active),
            pulseOwner: pulseNode ? pulseNode.owner : -1,
            pulseRemainingTicks: G.strategicPulse ? G.strategicPulse.remainingTicks : 0,
            humanIndex: G.human,
        });
        if (hudCap) {
            hudCap.textContent = buildHudCapText({
                units: G.unitByPlayer && G.unitByPlayer[G.human],
                cap: G.capByPlayer && G.capByPlayer[G.human],
                strainThreshold: CAP_SOFT_START,
            });
        }
        if (hudMeta) hudMeta.textContent = selectionMetaText();
        syncHudAssistiveText();
        if (doctrineBtn) {
            var doctrineId = humanDoctrineId();
            var doctrineButtonState = buildDoctrineButtonState({
                doctrineId: doctrineId,
                doctrineName: doctrineId ? doctrineName(doctrineId) : '',
                doctrineStatus: doctrineId ? doctrineCooldownSummary(G.doctrines, G.doctrineStates, G.human) : '',
                ready: doctrineId ? (G.state === 'playing' && canActivateDoctrine(G.doctrines, G.doctrineStates, G.human)) : false,
            });
            doctrineBtn.disabled = doctrineButtonState.disabled;
            doctrineBtn.textContent = doctrineButtonState.text;
            doctrineBtn.title = doctrineButtonState.title;
            doctrineBtn.setAttribute('data-help', doctrineButtonState.help);
            doctrineBtn.setAttribute('data-help-disabled', doctrineButtonState.helpDisabled);
        }
        syncMatchHudControls();
        var pingEl = document.getElementById('pingDisplay');
        if (pingEl) {
            pingEl.textContent = buildPingDisplayText({
                online: net.online,
                lastPingMs: net.lastPingMs,
                syncWarningText: net.syncWarningText,
                currentTick: G.tick,
                syncWarningTick: net.syncWarningTick,
                syncWindowTicks: SYNC_HASH_INTERVAL_TICKS * 2,
            });
        }
    }
    syncNodeHoverTip();
    if (G.state === 'playing' || G.state === 'paused') updatePowerSidebar();
    if (G.state !== 'mainMenu') render(ctx, cv, G.tick);
    requestAnimationFrame(loop);
}
showUI('mainMenu');
requestAnimationFrame(function (ts) { lastT = ts; loop(ts); });
