export function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

export function computeSendCount(opts) {
    opts = opts || {};
    var srcUnits = Number(opts.srcUnits);
    var pct = Number(opts.pct);
    var flowMult = Number(opts.flowMult);

    if (!Number.isFinite(srcUnits)) srcUnits = 0;
    if (!Number.isFinite(pct)) pct = 0.5;
    if (!Number.isFinite(flowMult)) flowMult = 1;

    pct = clamp(pct, 0.05, 1);

    var availableUnits = Math.floor(srcUnits);
    if (availableUnits < 2) {
        return {
            sendCount: 0,
            newSrcUnits: srcUnits,
        };
    }

    var raw = Math.floor(availableUnits * pct * flowMult);
    var sendCount = clamp(raw, 1, availableUnits - 1);

    return {
        sendCount: sendCount,
        newSrcUnits: srcUnits - sendCount,
    };
}
