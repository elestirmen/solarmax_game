import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTimelineChart, createMatchTimeline, noteTimelineEvent, recordTimelineSample } from '../assets/app/match_timeline.js';

test('samples are recorded once per tick and in order', function () {
    var timeline = createMatchTimeline();
    recordTimelineSample(timeline, 0, { 0: 10, 1: 30 }, 2);
    recordTimelineSample(timeline, 0, { 0: 99, 1: 99 }, 2);
    recordTimelineSample(timeline, 30, { 0: 20, 1: 20 }, 2);
    assert.equal(timeline.samples.length, 2);
    assert.deepEqual(timeline.samples[1].values, [20, 20]);
    assert.equal(timeline.peakTotal, 40);
});

test('long matches thin out instead of dropping the opening', function () {
    var timeline = createMatchTimeline();
    for (var t = 0; t < 1400; t++) recordTimelineSample(timeline, t * 30, [t, 1], 2);
    assert.ok(timeline.samples.length <= 600);
    assert.equal(timeline.samples[0].tick, 0, 'the first sample survives thinning');
    assert.equal(timeline.samples[timeline.samples.length - 1].tick, 1399 * 30, 'so does the last');
});

test('the chart plots power share, with the leader at the top', function () {
    var timeline = createMatchTimeline();
    recordTimelineSample(timeline, 0, [50, 50], 2);
    recordTimelineSample(timeline, 300, [90, 10], 2);
    noteTimelineEvent(timeline, { tick: 150, type: 'gain', owner: 0 });
    var chart = buildTimelineChart(timeline, { width: 100, height: 50 });
    assert.equal(chart.lines.length, 2);
    assert.equal(chart.durationTicks, 300);
    assert.equal(chart.lines[0].points, '0.0,25.0 100.0,5.0');
    assert.equal(chart.lines[1].points, '0.0,25.0 100.0,45.0');
    assert.deepEqual(chart.markers, [{ x: 50, type: 'gain', owner: 0 }]);
});

test('an empty timeline produces an empty chart', function () {
    var chart = buildTimelineChart(createMatchTimeline(), { width: 100, height: 50 });
    assert.deepEqual(chart.lines, []);
    assert.equal(chart.durationTicks, 0);
});
