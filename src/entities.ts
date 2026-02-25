/* =========================================================
   entities.ts – Game entity types and fleet pool
   ========================================================= */

import { Vec2, ObjectPool } from './utils';
import { FLEET_POOL_SIZE } from './constants';

/* ---- Player ---- */
export interface Player {
    index: number;       // 0 = human, 1+ = AI
    color: string;
    isAI: boolean;
    alive: boolean;
}

/* ---- Node ---- */
export interface GameNode {
    id: number;
    pos: Vec2;
    radius: number;        // visual & gameplay radius
    owner: number;          // player index, -1 = neutral
    units: number;          // current garrison
    productionAccum: number; // fractional accumulator
    maxUnits: number;
    visionRadius: number;
    selected: boolean;
}

/* ---- Fleet (object-pooled) ---- */
export interface Fleet {
    active: boolean;
    owner: number;
    count: number;
    sourceId: number;
    targetId: number;
    // Bezier traversal
    t: number;              // current parameter [0..1]
    speed: number;          // world units/sec
    arcLength: number;      // total bezier arc length
    // Control point (cached)
    cpx: number;
    cpy: number;
    // Current position (computed each frame)
    x: number;
    y: number;
}

export function createFleet(): Fleet {
    return {
        active: false,
        owner: -1,
        count: 0,
        sourceId: -1,
        targetId: -1,
        t: 0,
        speed: 0,
        arcLength: 1,
        cpx: 0,
        cpy: 0,
        x: 0,
        y: 0,
    };
}

export function resetFleet(f: Fleet): void {
    f.active = false;
    f.owner = -1;
    f.count = 0;
    f.sourceId = -1;
    f.targetId = -1;
    f.t = 0;
    f.speed = 0;
    f.arcLength = 1;
    f.cpx = 0;
    f.cpy = 0;
    f.x = 0;
    f.y = 0;
}

export const fleetPool = new ObjectPool<Fleet>(createFleet, resetFleet, FLEET_POOL_SIZE);

/* ---- Flow Link (persistent connection) ---- */
export interface FlowLink {
    id: number;
    sourceId: number;
    targetId: number;
    owner: number;
    tickAccum: number;      // ticks since last flow dispatch
    active: boolean;
}

/* ---- Fog tracking per node ---- */
export interface LastSeen {
    tick: number;           // -1 = never seen
    owner: number;
    units: number;
}

/* ---- Camera ---- */
export interface Camera {
    x: number;
    y: number;
    zoom: number;
}
