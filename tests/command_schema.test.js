import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeCommandData, sanitizeCommandPayload } from '../assets/sim/command_schema.js';

test('sanitizeCommandData normalizes send payloads', function () {
    assert.deepEqual(
        sanitizeCommandData('send', { sources: [1, '2', 2], tgtId: '4', pct: 2 }),
        { sources: [1, 2], fleetIds: [], tgtId: 4, pct: 1 }
    );
});

test('sanitizeCommandData accepts parked fleet sends to point targets', function () {
    assert.deepEqual(
        sanitizeCommandData('send', { fleetIds: ['7', 7, 8], targetPoint: { x: '140.25', y: 88.5 }, pct: 0.4 }),
        { sources: [], fleetIds: [7, 8], targetPoint: { x: 140.25, y: 88.5 }, pct: 0.4 }
    );
});

test('sanitizeCommandData accepts grouped upgrade commands', function () {
    assert.deepEqual(
        sanitizeCommandData('upgrade', { nodeIds: [3, '5', 3] }),
        { nodeIds: [3, 5] }
    );
});

test('sanitizeCommandPayload rejects unsupported commands', function () {
    assert.equal(sanitizeCommandPayload({ type: 'dance', data: {} }), null);
});

test('sanitizeCommandData accepts doctrine activation without payload', function () {
    assert.deepEqual(sanitizeCommandData('activateDoctrine', {}), {});
});
