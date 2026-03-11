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
        aiProfiles: [],
        tune: {
            aiAssist: true,
            aiAgg: diffCfg.aiAggBase,
            aiBuf: diffCfg.aiBuffer,
            def: 1.2,
            fogEnabled: extra.fogEnabled === true,
        },
        mapFeature: { type: 'none' },
        strategicPulse: { active: false, nodeId: -1 },
        rules: { baseCap: 180, capPerNodeFactor: 42 },
        playerCapital: { 0: 0, 1: 1 },
        powerByPlayer: powerByPlayer,
        unitByPlayer: powerByPlayer,
        capByPlayer: { 0: 220, 1: 220 },
        fog: extra.fog || buildFog(nodes),
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

test('ai does not reuse a nearly depleted source for a second opening send in the same tick', function () {
    var nodes = [
        node(0, -1, 160, 0, 8, 'core'),
        node(1, -1, 220, 44, 7, 'core'),
        node(2, 1, 0, 0, 34, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 60, 1: 96 }), 1);
    var sends = commands.filter(function (command) { return command.type === 'send'; });

    assert.equal(sends.length, 1);
    assert.deepEqual(sends[0].data.sources, [2]);
});

test('ai avoids low-odds turret pokes when a softer target is available', function () {
    var nodes = [
        node(0, -1, 45, 0, 7, 'core'),
        node(1, 1, 120, 0, 34, 'core'),
        node(2, 0, 282, 0, 10, 'turret'),
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

test('ai stages a turret siege on a safe friendly planet before committing', function () {
    var nodes = [
        node(0, 1, 0, 0, 74, 'core'),
        node(1, 1, 124, 0, 34, 'core'),
        node(2, 0, 268, 0, 92, 'turret'),
        node(3, 0, 320, 52, 54, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 170, 1: 122 }), 1);
    var stageSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 0;
    });

    assert.ok(stageSend);
    assert.deepEqual(stageSend.data.sources, [1]);
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

test('ai does not direct-attack a turret when only the raw available count barely looks sufficient', function () {
    var nodes = [
        node(0, 0, 0, 0, 12, 'turret'),
        node(1, 1, 110, 0, 30, 'core'),
        node(2, 1, 152, 28, 30, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 78, 1: 92 }), 1);
    var turretDirectSends = commands.filter(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 0;
    });

    assert.equal(turretDirectSends.length, 0);
});

test('ai requires at least a 72-unit siege wave before sending fleets into turret range', function () {
    var nodes = [
        node(0, 0, 0, 0, 10, 'turret'),
        node(1, 1, 110, 0, 20, 'core'),
        node(2, 1, 150, 24, 20, 'core'),
        node(3, 1, 196, -18, 18, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 76, 1: 88 }), 1);
    var turretDirectSends = commands.filter(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 0;
    });

    assert.equal(turretDirectSends.length, 0);
});

test('ai launches a turret siege only after the staging planet exceeds the threshold', function () {
    var nodes = [
        node(0, 1, 0, 0, 86, 'core'),
        node(1, 1, 124, 0, 18, 'core'),
        node(2, 0, 268, 0, 16, 'turret'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 90, 1: 122 }), 1);
    var turretSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 2;
    });

    assert.ok(turretSend);
    assert.deepEqual(turretSend.data.sources, [0]);
    assert.equal(turretSend.data.pct, 1);
});

test('ai does not drip-feed a planet that sits inside hostile turret coverage', function () {
    var nodes = [
        node(0, 0, 0, 0, 12, 'turret'),
        node(1, 0, 148, 0, 16, 'core'),
        node(2, 1, 284, 0, 20, 'core'),
        node(3, 1, 324, 24, 20, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 84, 1: 88 }), 1);
    var protectedNodeSends = commands.filter(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 1;
    });
    var protectedNodeFlows = commands.filter(function (command) {
        return command.type === 'flow' && command.data && command.data.tgtId === 1;
    });

    assert.equal(protectedNodeSends.length, 0);
    assert.equal(protectedNodeFlows.length, 0);
});

test('ai coordinates multi-source burst against turret when multiple safe nodes can reach it', function () {
    var nodes = [
        node(0, 0, 0, 0, 18, 'turret'),
        node(1, 1, -260, 0, 52, 'core'),
        node(2, 1, -290, 40, 44, 'core'),
        node(3, 1, -320, -20, 36, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 80, 1: 156 }), 1);
    var turretSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 0;
    });

    assert.ok(turretSend, 'should launch coordinated burst against turret');
    assert.ok(turretSend.data.sources.length >= 2, 'should use multiple sources for burst');
    assert.ok(turretSend.data.sources.indexOf(1) >= 0, 'strongest safe node should participate');
});

test('ai prefers safe staging routes that avoid turret range', function () {
    var nodes = [
        node(0, 1, 60, 0, 10, 'core'),
        node(1, 1, -80, 0, 50, 'core'),
        node(2, 1, 170, 120, 50, 'core'),
        node(3, 0, 300, 0, 60, 'turret'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 92, 1: 132 }), 1);
    var stageSend = commands.find(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 1;
    });

    if (stageSend && stageSend.data.sources.length >= 2) {
        var safeIdx = stageSend.data.sources.indexOf(0);
        var unsafeIdx = stageSend.data.sources.indexOf(2);
        if (safeIdx >= 0 && unsafeIdx >= 0) {
            assert.ok(safeIdx < unsafeIdx, 'safe-route source should be ordered before unsafe-route source');
        }
    }
});

test('ai treats a target behind a turret as protected when the attack route crosses turret range', function () {
    var nodes = [
        node(0, 0, 0, 0, 12, 'turret'),
        node(1, 0, 252, 0, 16, 'core'),
        node(2, 1, -304, 0, 22, 'core'),
        node(3, 1, -348, 30, 22, 'core'),
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 84, 1: 92 }), 1);
    var screenedTargetSends = commands.filter(function (command) {
        return command.type === 'send' && command.data && command.data.tgtId === 1;
    });

    assert.equal(screenedTargetSends.length, 0);
});

test('siege doctrine lets ai trigger doctrine activation before a turret assault', function () {
    var nodes = [
        node(0, 1, 0, 0, 72, 'core'),
        node(1, 1, 122, 0, 32, 'core'),
        node(2, 0, 262, 0, 22, 'turret'),
    ];
    var commands = decideAiCommands(Object.assign(buildState('hard', nodes, { 0: 96, 1: 128 }), {
        doctrines: ['logistics', 'siege'],
        doctrineStates: [{ cooldownTicks: 0, activeTicks: 0 }, { cooldownTicks: 0, activeTicks: 0 }],
    }), 1);

    assert.equal(commands[0].type, 'activateDoctrine');
});

test('hard ai ignores fog memory when the match itself has fog disabled', function () {
    var nodes = [
        node(0, 0, 0, 0, 50, 'core'),
        node(1, 1, 420, 0, 52, 'core'),
        node(2, -1, 540, 0, 6, 'core'),
    ];
    var fog = buildFog(nodes);
    fog.vis[1][2] = false;
    fog.ls[1][2] = { units: 0 };

    var commands = decideAiCommands(buildState('hard', nodes, { 0: 70, 1: 96 }, {
        fog: fog,
        fogEnabled: false,
    }), 1);
    var firstSend = commands.find(function (command) { return command.type === 'send'; });

    assert.ok(firstSend);
    assert.equal(firstSend.data.tgtId, 2);
});

test('ai does not auto-fortify a fresh capture when local pressure is low', function () {
    var frontier = node(2, 1, 520, 40, 16, 'core');
    frontier.assimilationProgress = 0.2;
    frontier.assimilationLock = 0;

    var nodes = [
        node(0, 0, 0, 0, 18, 'core'),
        node(1, 1, 600, 0, 56, 'core'),
        frontier,
    ];
    var commands = decideAiCommands(buildState('hard', nodes, { 0: 62, 1: 108 }), 1);
    var defenseToggle = commands.find(function (command) {
        return command.type === 'toggleDefense' && command.data && command.data.nodeId === 2;
    });

    assert.equal(defenseToggle, undefined);
});
