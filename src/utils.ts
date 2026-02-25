/* =========================================================
   utils.ts – Seeded RNG, vector math, object pool
   ========================================================= */

/* ---- Seeded RNG (Mulberry32) ---- */
export class SeededRNG {
    private state: number;
    constructor(seed: number) {
        this.state = seed | 0;
        if (this.state === 0) this.state = 1;
    }

    /** Returns float in [0, 1) */
    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Random int in [min, max] inclusive */
    nextInt(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    /** Random float in [min, max) */
    nextFloat(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

/* ---- 2D Vector ---- */
export interface Vec2 {
    x: number;
    y: number;
}

export function vec2(x: number, y: number): Vec2 {
    return { x, y };
}

export function dist(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

export function normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len < 0.0001) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

export function perpendicular(v: Vec2): Vec2 {
    return { x: -v.y, y: v.x };
}

export function add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
    return { x: v.x * s, y: v.y * s };
}

/* ---- Simple Object Pool ---- */
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;

    constructor(factory: () => T, reset: (obj: T) => void, initialSize: number) {
        this.factory = factory;
        this.reset = reset;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    acquire(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    release(obj: T): void {
        this.reset(obj);
        this.pool.push(obj);
    }

    get available(): number {
        return this.pool.length;
    }
}

/* ---- Misc ---- */
export function hashSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        hash = ((hash << 5) - hash + c) | 0;
    }
    return Math.abs(hash) || 1;
}
