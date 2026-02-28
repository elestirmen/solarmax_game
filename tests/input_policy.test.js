import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldStartDragSend, resolveRightClickAction } from '../assets/sim/input_policy.js';

test('starts drag-send when owned node and threshold reached', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: true, movedPx: 6, thresholdPx: 6 }), true);
});

test('does not start drag-send below threshold', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: true, movedPx: 5.9, thresholdPx: 6 }), false);
});

test('does not start drag-send when pointer was not on owned node', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: false, movedPx: 14, thresholdPx: 6 }), false);
});

test('right click on unselected owned target with selection prefers flow toggle', function () {
    assert.equal(resolveRightClickAction({
        targetExists: true,
        targetOwnerIsHuman: true,
        targetSelected: false,
        selectedOwnedCount: 2,
    }), 'flow');
});

test('right click on selected owned target keeps defense toggle behavior', function () {
    assert.equal(resolveRightClickAction({
        targetExists: true,
        targetOwnerIsHuman: true,
        targetSelected: true,
        selectedOwnedCount: 2,
    }), 'defense');
});

test('right click on enemy target without selection does nothing', function () {
    assert.equal(resolveRightClickAction({
        targetExists: true,
        targetOwnerIsHuman: false,
        targetSelected: false,
        selectedOwnedCount: 0,
    }), 'none');
});
