import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldStartDragSend } from '../assets/sim/input_policy.js';

test('starts drag-send when owned node and threshold reached', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: true, movedPx: 6, thresholdPx: 6 }), true);
});

test('does not start drag-send below threshold', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: true, movedPx: 5.9, thresholdPx: 6 }), false);
});

test('does not start drag-send when pointer was not on owned node', function () {
    assert.equal(shouldStartDragSend({ downOnOwnedNode: false, movedPx: 14, thresholdPx: 6 }), false);
});
