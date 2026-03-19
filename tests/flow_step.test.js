import test from 'node:test';
import assert from 'node:assert/strict';

import { stepFlowLinks } from '../assets/sim/flow_step.js';

test('stepFlowLinks emits dispatch intents when active links reach their interval', function () {
    var flows = [
        { srcId: 0, tgtId: 1, owner: 0, tickAcc: 1, active: true },
    ];
    var nodes = [
        { owner: 0, units: 30 },
        { owner: 1, units: 5 },
    ];

    var result = stepFlowLinks({
        flows: flows,
        nodes: nodes,
        flowInterval: 2,
        constants: { flowFraction: 0.25, minReserve: 2 },
    });

    assert.equal(result.dispatches.length, 1);
    assert.equal(result.dispatches[0].owner, 0);
    assert.equal(result.dispatches[0].srcId, 0);
    assert.equal(result.dispatches[0].tgtId, 1);
    assert.equal(flows[0].tickAcc, 0);
});

test('stepFlowLinks deactivates invalid flows and skips drained sources', function () {
    var flows = [
        { srcId: 0, tgtId: 2, owner: 0, tickAcc: 0, active: true },
        { srcId: 1, tgtId: 2, owner: 1, tickAcc: 0, active: true },
    ];
    var nodes = [
        { owner: 2, units: 50 },
        { owner: 1, units: 2 },
        { owner: 0, units: 10 },
    ];

    var result = stepFlowLinks({
        flows: flows,
        nodes: nodes,
        flowInterval: 1,
        constants: { flowFraction: 0.5, minReserve: 2 },
    });

    assert.equal(flows[0].active, false);
    assert.equal(result.dispatches.length, 0);
});

test('stepFlowLinks reduces fraction when source node is in defense mode', function () {
    var flows = [
        { srcId: 0, tgtId: 1, owner: 0, tickAcc: 2, active: true },
    ];
    var nodes = [
        { owner: 0, units: 100, defense: true },
        { owner: 0, units: 5 },
    ];

    var withDefense = stepFlowLinks({
        flows: flows,
        nodes: nodes,
        flowInterval: 2,
        constants: { flowFraction: 0.1, minReserve: 2, defenseFlowMult: 0.5 },
    });
    var flows2 = [{ srcId: 0, tgtId: 1, owner: 0, tickAcc: 2, active: true }];
    var nodes2 = [
        { owner: 0, units: 100, defense: false },
        { owner: 0, units: 5 },
    ];
    var noDefense = stepFlowLinks({
        flows: flows2,
        nodes: nodes2,
        flowInterval: 2,
        constants: { flowFraction: 0.1, minReserve: 2, defenseFlowMult: 0.5 },
    });

    assert.equal(withDefense.dispatches.length, 1);
    assert.equal(noDefense.dispatches.length, 1);
    assert.ok(withDefense.dispatches[0].pct < noDefense.dispatches[0].pct);
});
