import test from 'node:test';
import assert from 'node:assert/strict';

import { decideAiCommands } from '../assets/sim/ai.js';
import { difficultyConfig } from '../assets/sim/shared_config.js';

function node(id, owner, x, y, units, kind) {
    return {
        id: id,
        owner: owner,
        pos: { x: x, y: y },
        radius: 24,
        units: units,
        level: 1,
        kind: kind || 'core',
        gate: false,
        defense: false,
        supplied: false,
        maxUnits: 200,
        assimilationProgress: 1,
        assimilationLock: 0,
    };
}

function buildFog(nodes) {
    var vis = [{}, {}];
    var ls = [[], []];
    for (var i = 0; i < nodes.length; i++) {
        var current = nodes[i];
        vis[0][current.id] = true;
        vis[1][current.id] = true;
        ls[0][current.id] = { units: current.units };
        ls[1][current.id] = { units: current.units };
    }
    return { vis: vis, ls: ls };
}

function buildState(diff, nodes, powerByPlayer, extra) {
    var diffCfg = difficultyConfig(diff);
    extra = extra || {};
    return {
        diff: diff,
        diffCfg: diffCfg,
        tick: 0,
        players: [
            { idx: 0, isAI: false, alive: true, color: '#4a8eff' },
            { idx: 1, isAI: true, alive: true, color: '#e74c3c' },
        ],
        nodes: nodes,
        fleets: extra.fleets || [],
        flows: extra.flows || [],
        fog: buildFog(nodes),
        aiProfiles: [],
        tune: {
            aiAssist: true,
            aiAgg: diffCfg.aiAggBase,
            aiBuf: diffCfg.aiBuffer,
            def: 1.2,
        },
        mapFeature: { type: 'none' },
        strategicPulse: { active: false, nodeId: -1 },
        rules: { baseCap: 180, capPerNodeFactor: 42 },
        playerCapital: { 0: 0, 1: 1 },
        powerByPlayer: powerByPlayer,
        unitByPlayer: powerByPlayer,
        capByPlayer: { 0: 220, 1: 220 },
    };
}

test('hard difficulty pressures more fronts than normal in the same position', function () {
    var nodes = [
        node(0, 0, 0, 0, 18),
        node(1, 1, 120, 0, 46),
        node(2, 0, 40, 110, 16),
        node(3, 0, -30, 90, 14),
        node(4, 1, 170, 55, 38),
        node(5, 1, 160, -60, 34),
    ];
    var power = { 0: 170, 1: 155 };
    var normalCommands = decideAiCommands(buildState('normal', nodes, power), 1);
    var hardCommands = decideAiCommands(buildState('hard', nodes, power), 1);
    var normalSends = normalCommands.filter(function (command) { return command.type === 'send'; });
    var hardSends = hardCommands.filter(function (command) { return command.type === 'send'; });

    assert.equal(normalSends.length, 2);
    assert.equal(hardSends.length, 3);
});

test('hard difficulty prioritizes the human capital over a nearby neutral pickup', function () {
    var nodes = [
        node(0, 0, 0, 0, 14),
        node(1, 1, 100, 0, 52),
        node(2, -1, 150, 0, 6),
        node(3, 1, 130, 40, 28),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 60, 1: 96 }), 1);
    var firstSend = commands.find(function (command) { return command.type === 'send'; });

    assert.ok(firstSend);
    assert.equal(firstSend.data.tgtId, 0);
});

test('ai avoids low-odds turret pokes when a softer target is available', function () {
    var nodes = [
        node(0, -1, 45, 0, 7, 'core'),
        node(1, 1, 120, 0, 34, 'core'),
        node(2, 0, 78, 0, 10, 'turret'),
        node(3, 1, 145, 26, 18, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 80, 1: 86 }), 1);
    var firstSend = commands.find(function (command) { return command.type === 'send'; });

    assert.ok(firstSend);
    assert.equal(firstSend.data.tgtId, 0);
});

test('ai does not create drip-feed flow links into turret targets', function () {
    var nodes = [
        node(0, 0, 0, 0, 10, 'turret'),
        node(1, 1, 110, 0, 70, 'core'),
        node(2, 1, 150, 35, 44, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 55, 1: 122 }), 1);
    var turretFlows = commands.filter(function (command) {
        return command.type === 'flow' && command.data && command.data.tgtId === 0;
    });

    assert.equal(turretFlows.length, 0);
});

test('ai prioritizes a contested frontline target over a deeper enemy backline node', function () {
    var nodes = [
        node(0, 1, 0, 0, 56, 'core'),
        node(1, 1, -70, 36, 28, 'core'),
        node(2, 0, 116, 0, 16, 'core'),
        node(3, 0, 308, 0, 8, 'core'),
        node(4, 0, 360, 42, 18, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 108, 1: 124 }), 1);
    var firstSend = commands.find(function (command) { return command.type === 'send' && command.data && command.data.tgtId !== undefined; });

    assert.ok(firstSend);
    assert.equal(firstSend.data.tgtId, 2);
});

test('ai keeps reserve on a newly captured frontline node instead of using it as a throwaway source', function () {
    var frontier = node(1, 1, 110, 0, 26, 'core');
    frontier.assimilationProgress = 0.3;
    frontier.assimilationLock = 90;

    var nodes = [
        node(0, 1, 0, 0, 68, 'core'),
        frontier,
        node(2, 0, 210, 0, 18, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 62, 1: 104 }), 1);
    var firstSend = commands.find(function (command) { return command.type === 'send' && command.data && command.data.tgtId === 2; });

    assert.ok(firstSend);
    assert.deepEqual(firstSend.data.sources, [0]);
});

test('ai stages a push with a parked fleet point when a defended target is not ready yet', function () {
    var nodes = [
        node(0, 1, 0, 0, 74, 'core'),
        node(1, 1, 124, 0, 34, 'core'),
        node(2, 0, 268, 0, 92, 'turret'),
        node(3, 0, 320, 52, 54, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 170, 1: 122 }), 1);
    var stageSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.targetPoint;
    });

    assert.ok(stageSend);
    assert.deepEqual(stageSend.data.sources, [0]);
});

test('ai can relaunch a staged holding fleet into the main attack', function () {
    var nodes = [
        node(0, 1, 0, 0, 32, 'core'),
        node(1, 1, 122, 0, 42, 'core'),
        node(2, 0, 216, 0, 28, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 70, 1: 98 }, {
        fleets: [
            {
                id: 9,
                active: true,
                holding: true,
                owner: 1,
                count: 20,
                x: 144,
                y: 0,
                fromX: 144,
                fromY: 0,
                toX: 144,
                toY: 0,
                trail: [],
            },
        ],
    }), 1);
    var attackSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 2;
    });

    assert.ok(attackSend);
    assert.deepEqual(attackSend.data.fleetIds, [9]);
});
