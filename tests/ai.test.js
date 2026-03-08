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

function buildState(diff, nodes, powerByPlayer) {
    var diffCfg = difficultyConfig(diff);
    return {
        diff: diff,
        diffCfg: diffCfg,
        tick: 0,
        players: [
            { idx: 0, isAI: false, alive: true, color: '#4a8eff' },
            { idx: 1, isAI: true, alive: true, color: '#e74c3c' },
        ],
        nodes: nodes,
        fleets: [],
        flows: [],
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
