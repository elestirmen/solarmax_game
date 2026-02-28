import test from 'node:test';
import assert from 'node:assert/strict';

import { getStrategicPulseState, isStrategicPulseActiveForNode } from '../assets/sim/strategic_pulse.js';

test('strategic pulse rotates deterministically by cycle and seed', function () {
    var a = getStrategicPulseState({
        strategicNodeIds: [3, 7, 9],
        tick: 0,
        seed: 5,
        cycleTicks: 100,
        activeTicks: 40,
    });
    var b = getStrategicPulseState({
        strategicNodeIds: [3, 7, 9],
        tick: 100,
        seed: 5,
        cycleTicks: 100,
        activeTicks: 40,
    });

    assert.equal(a.nodeId, 9);
    assert.equal(b.nodeId, 3);
});

test('strategic pulse becomes inactive after the active window', function () {
    var pulse = getStrategicPulseState({
        strategicNodeIds: [4],
        tick: 65,
        seed: 0,
        cycleTicks: 100,
        activeTicks: 40,
    });

    assert.equal(pulse.active, false);
    assert.equal(pulse.remainingTicks, 35);
});

test('isStrategicPulseActiveForNode matches only the current active node', function () {
    var pulse = getStrategicPulseState({
        strategicNodeIds: [1, 2],
        tick: 10,
        seed: 0,
        cycleTicks: 100,
        activeTicks: 40,
    });

    assert.equal(isStrategicPulseActiveForNode(1, pulse), true);
    assert.equal(isStrategicPulseActiveForNode(2, pulse), false);
});
