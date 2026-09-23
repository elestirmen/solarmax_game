// A client-side record of how a match went: each player's sector power sampled over
// time, plus the moments worth pointing at afterwards (worlds taken and lost). It feeds
// the result screen's chart and never touches the simulation.

var MAX_SAMPLES = 600;

export function createMatchTimeline() {
    return { samples: [], events: [], playerCount: 0, lastTick: -1, peakTotal: 0 };
}

/**
 * @param {object} timeline
 * @param {number} tick
 * @param {object|Array} powerByPlayer  power keyed by player index
 * @param {number} playerCount
 */
export function recordTimelineSample(timeline, tick, powerByPlayer, playerCount) {
    if (!timeline) return;
    tick = Math.max(0, Math.floor(Number(tick) || 0));
    if (tick <= timeline.lastTick) return;
    playerCount = Math.max(0, Math.floor(Number(playerCount) || 0));
    var values = [];
    var total = 0;
    for (var p = 0; p < playerCount; p++) {
        var v = Math.max(0, Number(powerByPlayer && powerByPlayer[p]) || 0);
        values.push(v);
        total += v;
    }
    timeline.playerCount = Math.max(timeline.playerCount, playerCount);
    timeline.samples.push({ tick: tick, values: values, total: total });
    timeline.lastTick = tick;
    if (total > timeline.peakTotal) timeline.peakTotal = total;
    // Long matches keep their whole arc: when the buffer fills, every other sample is
    // dropped, halving the resolution instead of forgetting the opening.
    if (timeline.samples.length > MAX_SAMPLES) {
        var thinned = [];
        for (var i = 0; i < timeline.samples.length; i += 2) thinned.push(timeline.samples[i]);
        var last = timeline.samples[timeline.samples.length - 1];
        if (thinned[thinned.length - 1] !== last) thinned.push(last);
        timeline.samples = thinned;
    }
}

export function noteTimelineEvent(timeline, event) {
    if (!timeline || !event) return;
    timeline.events.push({
        tick: Math.max(0, Math.floor(Number(event.tick) || 0)),
        type: String(event.type || ''),
        owner: Math.floor(Number(event.owner)),
    });
    if (timeline.events.length > 200) timeline.events.shift();
}

/**
 * Power share of each player over time, as SVG polyline point strings in a
 * width x height box. Shares (not raw power) keep a runaway late game from flattening
 * the whole opening into the baseline.
 */
export function buildTimelineChart(timeline, opts) {
    opts = opts || {};
    var width = Math.max(10, Number(opts.width) || 320);
    var height = Math.max(10, Number(opts.height) || 96);
    var result = { width: width, height: height, lines: [], markers: [], durationTicks: 0 };
    if (!timeline || timeline.samples.length < 2) return result;
    var samples = timeline.samples;
    var t0 = samples[0].tick;
    var t1 = samples[samples.length - 1].tick;
    var span = Math.max(1, t1 - t0);
    result.durationTicks = span;
    var count = timeline.playerCount;
    for (var p = 0; p < count; p++) {
        var pts = [];
        var lastY = null;
        for (var i = 0; i < samples.length; i++) {
            var s = samples[i];
            var share = s.total > 0 ? (s.values[p] || 0) / s.total : 0;
            var x = ((s.tick - t0) / span) * width;
            var y = height - share * height;
            pts.push(x.toFixed(1) + ',' + y.toFixed(1));
            lastY = y;
        }
        result.lines.push({ player: p, points: pts.join(' '), endY: lastY });
    }
    for (var e = 0; e < timeline.events.length; e++) {
        var ev = timeline.events[e];
        if (ev.tick < t0 || ev.tick > t1) continue;
        result.markers.push({ x: ((ev.tick - t0) / span) * width, type: ev.type, owner: ev.owner });
    }
    return result;
}
