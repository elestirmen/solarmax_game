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
