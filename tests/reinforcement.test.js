import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFriendlyReinforcementRoom, resolveFriendlyArrival } from '../assets/sim/reinforcement.js';

test('computeFriendlyReinforcementRoom subtracts incoming friendly fleets from remaining room', function () {
    var room = computeFriendlyReinforcementRoom({
        targetUnits: 30,
        targetMaxUnits: 40,
        incomingUnits: 6,
    });

    assert.equal(room, 4);
});

test('resolveFriendlyArrival returns overflow to source instead of losing it when source has room', function () {
    var result = resolveFriendlyArrival({
        targetUnits: 38,
        targetMaxUnits: 40,
        sourceUnits: 12,
        sourceMaxUnits: 30,
        fleetCount: 8,
    });

    assert.deepEqual(result, {
        targetUnits: 40,
        sourceUnits: 18,
        delivered: 2,
        returned: 6,
        lost: 0,
    });
});

test('resolveFriendlyArrival reports only the remainder as lost when both target and source are full', function () {
    var result = resolveFriendlyArrival({
        targetUnits: 40,
        targetMaxUnits: 40,
        sourceUnits: 29,
        sourceMaxUnits: 30,
        fleetCount: 4,
    });

    assert.deepEqual(result, {
        targetUnits: 40,
        sourceUnits: 30,
        delivered: 0,
        returned: 1,
        lost: 3,
    });
});
