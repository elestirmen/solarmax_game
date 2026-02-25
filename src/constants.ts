/* =========================================================
   constants.ts – All tunable defaults for Stellar Conquest
   ========================================================= */

export const TICK_RATE = 30;                 // ticks per second
export const TICK_DT = 1 / TICK_RATE;        // seconds per tick

/* ---- Node ---- */
export const NODE_MIN_RADIUS = 18;
export const NODE_MAX_RADIUS = 36;
export const NODE_MIN_DISTANCE = 100;        // min px between node centres
export const NEUTRAL_MAX_UNITS = 20;         // neutral nodes start with ≤ this

/* ---- Production ---- */
export const BASE_PRODUCTION_RATE = 0.12;    // units per tick per radius-unit
export const MAX_NODE_UNITS = 200;

/* ---- Fleet / packets ---- */
export const FLEET_SPEED = 80;               // world-units per second
export const FLEET_DOT_RADIUS = 2.5;
export const FLEET_POOL_SIZE = 2000;

/* ---- Flow link ---- */
export const FLOW_TICK_INTERVAL = 15;        // ticks between flow dispatches
export const FLOW_AMOUNT_FRACTION = 0.08;    // fraction of source count sent per flow tick

/* ---- Combat ---- */
export const DEFENSE_FACTOR = 1.2;           // defender advantage

/* ---- Vision (Fog of War) ---- */
export const BASE_VISION_RADIUS = 180;       // world-units
export const SELECTED_VISION_BONUS = 1.2;    // 20% extra when selected

/* ---- AI ---- */
export const AI_DECISION_INTERVAL = 30;      // ticks between AI decisions
export const AI_SEND_PERCENT = 0.55;
export const AI_DEFENSE_BUFFER = 5;          // keep at least this many units
export const AI_AGGRESSION = 1.0;            // score multiplier
export const AI_FLOW_CHANCE = 0.3;

/* ---- Camera ---- */
export const CAMERA_ZOOM_MIN = 0.3;
export const CAMERA_ZOOM_MAX = 3.0;
export const CAMERA_ZOOM_SPEED = 0.1;

/* ---- Map gen ---- */
export const MAP_PADDING = 80;
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1000;

/* ---- Colors ---- */
export const COLORS = {
    background: '#0a0e17',
    neutral: '#5a6272',
    neutralDark: '#3a3f4a',
    fogOverlay: 'rgba(6, 10, 20, 0.55)',
    fogNode: '#2e3340',
    selectionGlow: 'rgba(255, 255, 255, 0.35)',
    gridDot: 'rgba(255,255,255,0.03)',
    players: [
        '#4a8eff',   // player 0 – blue
        '#e74c3c',   // player 1 – red
        '#2ecc71',   // player 2 – green
        '#f39c12',   // player 3 – orange
        '#9b59b6',   // player 4 – purple
        '#1abc9c',   // player 5 – teal
    ],
};

/* ---- Bezier ---- */
export const BEZIER_CURVATURE = 0.15;        // perpendicular offset factor
export const BEZIER_SEGMENTS = 20;           // arc-length approximation segments
export const PULSE_SPEED = 0.6;             // pulse animation speed

/* ---- Difficulties ---- */
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface TuningParams {
    productionMultiplier: number;
    fleetSpeed: number;
    defenseFactor: number;
    flowTickInterval: number;
    aiAggression: number;
    aiBuffer: number;
    aiDecisionInterval: number;
}

export function defaultTuning(): TuningParams {
    return {
        productionMultiplier: 1.0,
        fleetSpeed: FLEET_SPEED,
        defenseFactor: DEFENSE_FACTOR,
        flowTickInterval: FLOW_TICK_INTERVAL,
        aiAggression: AI_AGGRESSION,
        aiBuffer: AI_DEFENSE_BUFFER,
        aiDecisionInterval: AI_DECISION_INTERVAL,
    };
}
