import test from 'node:test';
import assert from 'node:assert/strict';

import { createInputState, reconcileInputStateAfterAuthoritativeSync } from '../assets/app/input_controller.js';

function sortedSetValues(set) {
    return Array.from(set).sort(function (a, b) { return a - b; });
}

test('reconcileInputStateAfterAuthoritativeSync preserves valid online selection and drag sources', function () {
    var inputState = createInputState();
    inputState.sel.add(1);
    inputState.sel.add(2);
    inputState.selFleets.add(41);
    inputState.selFleets.add(42);
    inputState.dragActive = true;
    inputState.dragPending = true;
    inputState.dragNodeIds = [1, 3];
    inputState.dragFleetIds = [41, 77];
    inputState.dragDownNodeId = 3;
    inputState.dragDownFleetId = 77;
    inputState.commandMode = 'flow';

    reconcileInputStateAfterAuthoritativeSync(inputState, {
        human: 0,
        nodes: [
            { id: 0, owner: 1 },
            { id: 1, owner: 0 },
            { id: 2, owner: 0 },
            { id: 3, owner: 1 },
        ],
        fleets: [
            { id: 41, owner: 0, active: true, holding: true },
            { id: 42, owner: 0, active: true, holding: true },
            { id: 77, owner: 1, active: true, holding: true },
        ],
    });

    assert.deepEqual(sortedSetValues(inputState.sel), [1, 2]);
    assert.deepEqual(sortedSetValues(inputState.selFleets), [41, 42]);
    assert.deepEqual(inputState.dragNodeIds, [1]);
    assert.deepEqual(inputState.dragFleetIds, [41]);
    assert.equal(inputState.dragActive, true);
    assert.equal(inputState.dragPending, true);
    assert.equal(inputState.dragDownNodeId, 1);
    assert.equal(inputState.dragDownFleetId, 41);
    assert.equal(inputState.commandMode, 'flow');
});

test('reconcileInputStateAfterAuthoritativeSync clears stale online selection and drag state', function () {
    var inputState = createInputState();
    inputState.sel.add(3);
    inputState.selFleets.add(77);
    inputState.dragActive = true;
    inputState.dragPending = true;
    inputState.dragNodeIds = [3];
    inputState.dragFleetIds = [77];
    inputState.dragDownNodeId = 3;
    inputState.dragDownFleetId = 77;
    inputState.commandMode = 'flow';
    inputState.touchPointOrderPending = true;
    inputState.mousePointOrderPending = true;
    inputState.touchEmptyAwait = true;

    reconcileInputStateAfterAuthoritativeSync(inputState, {
        human: 0,
        nodes: [
            { id: 0, owner: 0 },
            { id: 1, owner: 1 },
            { id: 2, owner: 1 },
            { id: 3, owner: 1 },
        ],
        fleets: [
            { id: 77, owner: 1, active: true, holding: true },
        ],
    });

    assert.deepEqual(sortedSetValues(inputState.sel), []);
    assert.deepEqual(sortedSetValues(inputState.selFleets), []);
    assert.deepEqual(inputState.dragNodeIds, []);
    assert.deepEqual(inputState.dragFleetIds, []);
    assert.equal(inputState.dragActive, false);
    assert.equal(inputState.dragPending, false);
    assert.equal(inputState.dragDownNodeId, -1);
    assert.equal(inputState.dragDownFleetId, -1);
    assert.equal(inputState.touchPointOrderPending, false);
    assert.equal(inputState.mousePointOrderPending, false);
    assert.equal(inputState.touchEmptyAwait, false);
    assert.equal(inputState.commandMode, '');
});
