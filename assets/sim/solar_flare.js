/**
 * Global solar flare: deterministic schedule from tick + seed.
 * Each gap between blasts is a pseudo-random duration in [gapMin, gapMax] ticks (same seed => same sequence).
 * Warning window precedes each blast; blast tick wipes all active fleets (space units).
 */

function solarGapTicks(seed, index, minG, maxG) {
    var s = Math.floor(Number(seed) || 0) | 0;
    var k = Math.floor(Number(index) || 0) | 0;
    var x = Math.imul(s ^ Math.imul(k, 374761393), 2654435761);
    x ^= x >>> 16;
    x = Math.imul(x, 2246822519);
    x ^= x >>> 13;
    x = Math.imul(x, 3266489917);
    x ^= x >>> 16;
    var range = maxG - minG + 1;
    if (range <= 1) return minG;
    return minG + ((x >>> 0) % range);
}

/** Smallest blast tick B with B >= tick (blast times are sums of gap[0], gap[1], …). */
export function smallestBlastTickAtOrAfter(tick, seed, cfg) {
    cfg = cfg || {};
    var minG = Math.max(30, Math.floor(Number(cfg.gapMinTicks) || 5400));
    var maxG = Math.max(minG, Math.floor(Number(cfg.gapMaxTicks) || 9000));
    var t = Math.max(0, Math.floor(Number(tick) || 0));

    var acc = solarGapTicks(seed, 0, minG, maxG);
    var idx = 1;
    var guard = 0;
    while (acc < t && guard < 200000) {
        acc += solarGapTicks(seed, idx, minG, maxG);
        idx++;
        guard++;
    }
    return acc;
}

export function getSolarFlareFrame(tick, seed, cfg) {
    cfg = cfg || {};
    tick = Math.max(0, Math.floor(Number(tick) || 0));
    var minG = Math.max(30, Math.floor(Number(cfg.gapMinTicks) || 5400));
    var maxG = Math.max(minG, Math.floor(Number(cfg.gapMaxTicks) || 9000));
    var W = Math.max(1, Math.floor(Number(cfg.warnTicks) || 180));
    if (W >= minG) W = Math.max(1, minG - 1);

    var upcoming = smallestBlastTickAtOrAfter(tick, seed, cfg);
    var dist = upcoming - tick;
    if (dist === 0) {
        return { phase: 'blast', ticksToBlast: 0, warnTicks: W, gapMin: minG, gapMax: maxG };
    }
    if (dist > 0 && dist <= W) {
        return {
            phase: 'warn',
            ticksToBlast: dist,
            warnProgress: (W - dist) / W,
            warnTicks: W,
            gapMin: minG,
            gapMax: maxG,
        };
    }
    return { phase: 'idle', ticksToBlast: dist, warnTicks: W, gapMin: minG, gapMax: maxG };
}

export function getSolarFlareTransitions(previousTick, nextTick, seed, cfg) {
    cfg = cfg || {};
    var prev = Math.floor(Number(previousTick));
    var next = Math.max(0, Math.floor(Number(nextTick) || 0));
    if (!Number.isFinite(prev)) prev = -1;
    if (next <= prev) return { warnStartTick: -1, blastTick: -1 };

    var minG = Math.max(30, Math.floor(Number(cfg.gapMinTicks) || 5400));
    var W = Math.max(1, Math.floor(Number(cfg.warnTicks) || 180));
    if (W >= minG) W = Math.max(1, minG - 1);

    var blastTick = smallestBlastTickAtOrAfter(Math.max(0, prev + 1), seed, cfg);
    var warnStartTick = blastTick - W;
    return {
        warnStartTick: prev < warnStartTick && warnStartTick <= next && next < blastTick ? warnStartTick : -1,
        blastTick: prev < blastTick && blastTick <= next ? blastTick : -1,
    };
}

/** Deactivate every fleet in transit or holding in space. Returns how many were cleared. */
export function applySolarFlareFleetWipe(fleets) {
    if (!Array.isArray(fleets)) return 0;
    var n = 0;
    for (var i = 0; i < fleets.length; i++) {
        var f = fleets[i];
        if (!f || !f.active) continue;
        f.active = false;
        f.holding = false;
        f.count = 0;
        if (Array.isArray(f.trail)) f.trail.length = 0;
        n++;
    }
    return n;
}
