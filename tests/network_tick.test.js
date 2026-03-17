import test from 'node:test';
import assert from 'node:assert/strict';

import { computeOnlineSimSpeed, consumePendingNetworkCommands, isOnlinePingDue } from '../assets/net/network_tick.js';

test('isOnlinePingDue requests ping on first tick and after the interval', function () {
    assert.equal(isOnlinePingDue(0, 0, 45), true);
    assert.equal(isOnlinePingDue(44, 1, 45), false);
    assert.equal(isOnlinePingDue(46, 1, 45), true);
});

test('computeOnlineSimSpeed maps drift bands to catch-up or slow-down speeds', function () {
    assert.equal(computeOnlineSimSpeed(40), 0.1);
    assert.equal(computeOnlineSimSpeed(12), 0.5);
    assert.equal(computeOnlineSimSpeed(4), 0.85);
    assert.equal(computeOnlineSimSpeed(-4), 1.15);
    assert.equal(computeOnlineSimSpeed(-20), 2.0);
    assert.equal(computeOnlineSimSpeed(-40), 4.0);
    assert.equal(computeOnlineSimSpeed(-120), 10.0);
    assert.equal(computeOnlineSimSpeed(0), 1.0);
});

test('consumePendingNetworkCommands sorts queue, applies due commands, and keeps future ones', function () {
    var result = consumePendingNetworkCommands({
        pendingCommands: [
            { tick: 40, seq: 4, type: 'future' },
            { tick: 10, seq: 2, type: 'due-b' },
            { tick: 10, seq: 1, type: 'due-a' },
        ],
        currentTick: 10,
        matchId: 'm1',
        lastAppliedSeq: -1,
    });

    assert.deepEqual(result.dueCommands.map(function (cmd) { return cmd.type; }), ['due-a', 'due-b']);
    assert.deepEqual(result.remainingCommands.map(function (cmd) { return cmd.type; }), ['future']);
    assert.equal(result.lastAppliedSeq, 2);
});

test('consumePendingNetworkCommands drops stale seq and foreign match ids', function () {
    var result = consumePendingNetworkCommands({
        pendingCommands: [
            { tick: 10, seq: 1, matchId: 'm1', type: 'stale' },
            { tick: 10, seq: 3, matchId: 'm2', type: 'other-match' },
            { tick: 11, seq: 4, matchId: 'm1', type: 'due' },
        ],
        currentTick: 10,
        matchId: 'm1',
        lastAppliedSeq: 1,
    });

    assert.deepEqual(result.dueCommands.map(function (cmd) { return cmd.type; }), ['due']);
    assert.equal(result.remainingCommands.length, 0);
    assert.equal(result.lastAppliedSeq, 4);
});
