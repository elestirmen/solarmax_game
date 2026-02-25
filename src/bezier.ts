/* =========================================================
   bezier.ts – Quadratic bezier utilities
   ========================================================= */

import { Vec2, sub, add, scale, perpendicular, normalize } from './utils';
import { BEZIER_CURVATURE, BEZIER_SEGMENTS } from './constants';

/**
 * Compute the control point for a quadratic bezier between src and tgt.
 * Offset perpendicular to the src→tgt direction, proportional to distance.
 */
export function computeControlPoint(src: Vec2, tgt: Vec2, curvature: number = BEZIER_CURVATURE): Vec2 {
    const dir = sub(tgt, src);
    const mid = add(src, scale(dir, 0.5));
    const perp = perpendicular(normalize(dir));
    const d = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    return add(mid, scale(perp, d * curvature));
}

/**
 * Evaluate quadratic bezier B(t) = (1-t)²P0 + 2(1-t)t·P1 + t²·P2
 */
export function bezierPoint(p0: Vec2, cp: Vec2, p2: Vec2, t: number): Vec2 {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
    };
}

/**
 * Approximate arc length of a quadratic bezier by segmentation.
 */
export function bezierArcLength(p0: Vec2, cp: Vec2, p2: Vec2, segments: number = BEZIER_SEGMENTS): number {
    let length = 0;
    let prev = p0;
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const cur = bezierPoint(p0, cp, p2, t);
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        length += Math.sqrt(dx * dx + dy * dy);
        prev = cur;
    }
    return length;
}

/**
 * Advance t parameter by a given world-distance along the bezier.
 * Uses uniform-speed approximation via segment table.
 */
export function advanceT(
    _p0: Vec2, _cp: Vec2, _p2: Vec2,
    currentT: number, worldDist: number,
    arcLength: number, _segments: number = BEZIER_SEGMENTS
): number {
    // Convert worldDist to a t-delta (approximate: linear mapping)
    // For better accuracy we use segment-based lookup
    const dt = worldDist / arcLength;
    const newT = currentT + dt;
    // Clamp to avoid overshoot
    return newT >= 1 ? 1 : newT;
}

/**
 * Build a lookup table for more accurate arc-length parameterization.
 * Returns array of { t, len } for each segment endpoint.
 */
export function buildArcLengthTable(
    p0: Vec2, cp: Vec2, p2: Vec2, segments: number = BEZIER_SEGMENTS
): { t: number; len: number }[] {
    const table: { t: number; len: number }[] = [{ t: 0, len: 0 }];
    let totalLength = 0;
    let prev = p0;
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const cur = bezierPoint(p0, cp, p2, t);
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
        table.push({ t, len: totalLength });
        prev = cur;
    }
    return table;
}

/**
 * Given a distance along the curve, find the corresponding t using the arc-length table.
 */
export function tFromDistance(
    table: { t: number; len: number }[], targetDist: number
): number {
    const totalLen = table[table.length - 1].len;
    if (targetDist >= totalLen) return 1;
    if (targetDist <= 0) return 0;

    // Binary search
    let lo = 0;
    let hi = table.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (table[mid].len < targetDist) lo = mid;
        else hi = mid;
    }

    const segLen = table[hi].len - table[lo].len;
    if (segLen < 0.0001) return table[lo].t;
    const frac = (targetDist - table[lo].len) / segLen;
    return table[lo].t + frac * (table[hi].t - table[lo].t);
}
