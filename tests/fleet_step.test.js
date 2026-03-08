import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCombatOutcome, resolveFleetArrivals, stepFleetMovement } from '../assets/sim/fleet_step.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function bezPt(p0, cp, p2, t) {
    var u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
    };
}

test('stepFleetMovement advances fleet position and preserves trail history', function () {
    var fleets = [{
        active: true,
        srcId: 0,
        tgtId: 1,
        t: 0.1,
        speed: 80,
        spdVar: 1,
        arcLen: 100,
        routeSpeedMult: 1,
        cpx: 50,
        cpy: 20,
        x: 5,
        y: 5,
        trail: [],
        offsetL: 0,
        launchT: 0.05,
    }];
    var nodes = [
        { pos: { x: 0, y: 0 } },
        { pos: { x: 100, y: 0 } },
    ];

    stepFleetMovement({
        fleets: fleets,
        nodes: nodes,
        dt: 1 / 30,
        tune: { fspeed: 80 },
        mapFeature: { type: 'none' },
        callbacks: { clamp: clamp, bezPt: bezPt },
        constants: { baseFleetSpeed: 80, gravitySpeedMult: 0.75, trailLen: 12 },
    });

    assert.ok(fleets[0].t > 0.1);
    assert.equal(fleets[0].trail.length, 1);
    assert.notEqual(fleets[0].x, 5);
    assert.notEqual(fleets[0].y, 5);
});

test('stepFleetMovement respects fleet trail scale when trimming trail history', function () {
    var fleets = [{
        active: true,
        srcId: 0,
        tgtId: 1,
        t: 0.08,
        speed: 80,
        spdVar: 1.03,
        arcLen: 100,
        routeSpeedMult: 1.2,
        cpx: 50,
        cpy: 20,
        x: 5,
        y: 5,
        trail: [],
        offsetL: 3,
        launchT: 0.05,
        trailScale: 1.5,
    }];
    var nodes = [
        { pos: { x: 0, y: 0 } },
        { pos: { x: 100, y: 0 } },
    ];

    for (var i = 0; i < 20; i++) {
        stepFleetMovement({
            fleets: fleets,
            nodes: nodes,
            dt: 1 / 30,
            tune: { fspeed: 80 },
            mapFeature: { type: 'none' },
            callbacks: { clamp: clamp, bezPt: bezPt },
            constants: { baseFleetSpeed: 80, gravitySpeedMult: 0.75, trailLen: 6 },
        });
    }

    assert.equal(fleets[0].trail.length > 6, true);
    assert.equal(fleets[0].trail.length <= 9, true);
});

test('stepFleetMovement updates heading, bank, and throttle toward the route tangent', function () {
    var fleets = [{
        active: true,
        srcId: 0,
        tgtId: 1,
        t: 0.34,
        speed: 80,
        spdVar: 1,
        arcLen: 120,
        routeSpeedMult: 1,
        cpx: 50,
        cpy: 55,
        x: 20,
        y: 12,
        trail: [],
        offsetL: 2,
        launchT: 0.04,
        trailScale: 1,
        headingX: 1,
        headingY: 0,
        bank: 0,
        throttle: 0.3,
        turnRate: 7.4,
        throttleBias: 1.04,
        lookAhead: 0.03,
    }];
    var nodes = [
        { pos: { x: 0, y: 0 } },
        { pos: { x: 100, y: 0 } },
    ];

    stepFleetMovement({
        fleets: fleets,
        nodes: nodes,
        dt: 1 / 30,
        tune: { fspeed: 80 },
        mapFeature: { type: 'none' },
        callbacks: { clamp: clamp, bezPt: bezPt },
        constants: { baseFleetSpeed: 80, gravitySpeedMult: 0.75, trailLen: 12 },
    });

    var headingLen = Math.sqrt(fleets[0].headingX * fleets[0].headingX + fleets[0].headingY * fleets[0].headingY);
    assert.equal(Math.abs(headingLen - 1) < 0.0001, true);
    assert.equal(fleets[0].headingY !== 0, true);
    assert.equal(Math.abs(fleets[0].bank) > 0.001, true);
    assert.equal(fleets[0].throttle > 0.3, true);
});

test('stepFleetMovement boosts friendly fleets inside their territory', function () {
    var fleets = [
        {
            active: true,
            owner: 0,
            srcId: -1,
            tgtId: -1,
            t: 0.2,
            speed: 80,
            spdVar: 1,
            arcLen: 100,
            routeSpeedMult: 1,
            cpx: 50,
            cpy: 0,
            x: 30,
            y: 0,
            fromX: 0,
            fromY: 0,
            toX: 100,
            toY: 0,
            trail: [],
            offsetL: 0,
            launchT: 0,
        },
        {
            active: true,
            owner: 0,
            srcId: -1,
            tgtId: -1,
            t: 0.2,
            speed: 80,
            spdVar: 1,
            arcLen: 100,
            routeSpeedMult: 1,
            cpx: 350,
            cpy: 0,
            x: 330,
            y: 0,
            fromX: 300,
            fromY: 0,
            toX: 400,
            toY: 0,
            trail: [],
            offsetL: 0,
            launchT: 0,
        },
    ];
    var nodes = [
        { owner: 0, radius: 24, level: 1, kind: 'core', pos: { x: 0, y: 0 } },
    ];

    stepFleetMovement({
        fleets: fleets,
        nodes: nodes,
        dt: 1 / 30,
        tune: { fspeed: 80 },
        mapFeature: { type: 'none' },
        callbacks: { clamp: clamp, bezPt: bezPt },
        constants: { baseFleetSpeed: 80, gravitySpeedMult: 0.75, territorySpeedMult: 1.18, trailLen: 12 },
    });

    assert.equal(fleets[0].t > fleets[1].t, true);
});

test('stepFleetMovement converts empty-space arrivals into holding fleets', function () {
    var fleets = [{
        active: true,
        owner: 0,
        count: 14,
        srcId: 0,
        tgtId: -1,
        fromX: 0,
        fromY: 0,
        toX: 90,
        toY: 40,
        t: 1.02,
        speed: 80,
        spdVar: 1,
        arcLen: 100,
        routeSpeedMult: 1,
        cpx: 45,
        cpy: 20,
        x: 88,
        y: 39,
        trail: [{ x: 80, y: 35 }],
        offsetL: 0,
        launchT: 0,
    }];

    stepFleetMovement({
        fleets: fleets,
        nodes: [{ pos: { x: 0, y: 0 } }],
        dt: 1 / 30,
        tune: { fspeed: 80 },
        mapFeature: { type: 'none' },
        callbacks: { clamp: clamp, bezPt: bezPt },
        constants: { baseFleetSpeed: 80, gravitySpeedMult: 0.75, trailLen: 12 },
    });

    assert.equal(fleets[0].holding, true);
    assert.equal(fleets[0].holdUnsuppliedTicks, 0);
    assert.equal(fleets[0].t, 0);
    assert.equal(fleets[0].x, 90);
    assert.equal(fleets[0].y, 40);
    assert.equal(fleets[0].trail.length, 0);
});

test('resolveCombatOutcome captures node, resets assimilation, and reports effects', function () {
    var targetNode = {
        id: 4,
        owner: 1,
        kind: 'turret',
        level: 2,
        defense: true,
        gate: true,
        units: 10,
        maxUnits: 20,
        pos: { x: 40, y: 60 },
    };

    var result = resolveCombatOutcome({
        fleet: { owner: 0, count: 40 },
        targetNode: targetNode,
        players: [{ color: '#4a8eff' }, { color: '#e74c3c' }],
        tune: { def: 1.2 },
        humanIndex: 0,
        callbacks: {
            nodeTypeOf: function () { return { def: 1 }; },
            nodeLevelDefMult: function () { return 1.2; },
            nodeCapacity: function () { return 24; },
        },
        constants: {
            turretCaptureResist: 1.35,
            defenseBonus: 1.25,
            assimLockTicks: 180,
        },
    });

    assert.equal(result.captured, true);
    assert.equal(targetNode.owner, 0);
    assert.equal(targetNode.assimilationProgress, 0);
    assert.equal(targetNode.assimilationLock, 180);
    assert.equal(targetNode.maxUnits, 24);
    assert.equal(result.statsDelta.nodesCaptured, 1);
    assert.equal(result.statsDelta.gateCaptures, 1);
    assert.deepEqual(result.audio, ['capture']);
    assert.equal(result.particleBursts.length, 2);
    assert.equal(result.shockwaves.length >= 1, true);
});

test('resolveFleetArrivals handles friendly overflow and clears enemy flows on capture', function () {
    var fleets = [
        { active: true, owner: 0, count: 10, srcId: 0, tgtId: 1, t: 1.1, trail: [] },
        { active: true, owner: 0, count: 25, srcId: 0, tgtId: 2, t: 1.05, trail: [] },
    ];
    var nodes = [
        { id: 0, owner: 0, units: 40, maxUnits: 40, level: 1, pos: { x: 0, y: 0 } },
        { id: 1, owner: 0, units: 18, maxUnits: 20, level: 1, pos: { x: 50, y: 0 } },
        { id: 2, owner: 1, units: 4, maxUnits: 18, level: 1, defense: false, gate: false, kind: 'core', pos: { x: 90, y: 0 } },
    ];
    var flows = [
        { srcId: 2, tgtId: 2, owner: 1, active: true },
        { srcId: 0, tgtId: 2, owner: 0, active: true },
    ];

    var result = resolveFleetArrivals({
        fleets: fleets,
        nodes: nodes,
        flows: flows,
        players: [{ color: '#4a8eff' }, { color: '#e74c3c' }],
        tune: { def: 1.2 },
        humanIndex: 0,
        callbacks: {
            nodeTypeOf: function () { return { def: 1 }; },
            nodeLevelDefMult: function () { return 1; },
            nodeCapacity: function (node) { return node.maxUnits; },
        },
        constants: {
            turretCaptureResist: 1.35,
            defenseBonus: 1.25,
            assimLockTicks: 180,
        },
    });

    assert.equal(fleets.length, 1);
    assert.equal(fleets[0].active, true);
    assert.equal(fleets[0].count, 20);
    assert.equal(fleets[0].t < 1, true);
    assert.equal(nodes[1].units, 20);
    assert.equal(nodes[0].units, 40);
    assert.equal(nodes[2].owner, 0);
    assert.equal(nodes[2].units, 1);
    assert.equal(result.toasts.length, 1);
    assert.equal(result.statsDelta.nodesCaptured, 1);
    assert.equal(result.flows.length, 1);
    assert.equal(result.flows[0].owner, 0);
});

test('resolveFleetArrivals keeps grouped fleet units in transit until their visual slot reaches the target', function () {
    var fleets = [
        {
            active: true,
            owner: 0,
            count: 12,
            srcId: 0,
            tgtId: 1,
            t: 1.024,
            cpx: 50,
            cpy: 0,
            x: 100,
            y: 0,
            trail: [],
            offsetL: 0,
            trailScale: 1,
            throttle: 0.3,
            lookAhead: 0.022,
            launchT: 0,
        },
    ];
    var nodes = [
        { id: 0, owner: 0, units: 20, maxUnits: 20, level: 1, pos: { x: 0, y: 0 } },
        { id: 1, owner: 1, units: 1, maxUnits: 20, level: 1, defense: false, gate: false, kind: 'core', pos: { x: 100, y: 0 } },
    ];

    var result = resolveFleetArrivals({
        fleets: fleets,
        nodes: nodes,
        flows: [],
        players: [{ color: '#4a8eff' }, { color: '#e74c3c' }],
        tune: { def: 1 },
        humanIndex: 0,
        callbacks: {
            nodeTypeOf: function () { return { def: 1 }; },
            nodeLevelDefMult: function () { return 1; },
            nodeCapacity: function (node) { return node.maxUnits; },
        },
        constants: {
            turretCaptureResist: 1.35,
            defenseBonus: 1.25,
            assimLockTicks: 180,
        },
    });

    assert.equal(nodes[1].owner, 0);
    assert.equal(nodes[1].units, 2);
    assert.equal(fleets.length, 1);
    assert.equal(fleets[0].active, true);
    assert.equal(fleets[0].count, 9);
    assert.equal(fleets[0].t < 1, true);
    assert.equal(fleets[0].x < 100, true);
    assert.equal(result.statsDelta.nodesCaptured, 1);
});

test('resolveFleetArrivals leaves holding fleets untouched', function () {
    var fleets = [
        {
            active: true,
            holding: true,
            owner: 0,
            count: 11,
            srcId: -1,
            tgtId: -1,
            x: 60,
            y: 24,
            fromX: 60,
            fromY: 24,
            toX: 60,
            toY: 24,
            trail: [],
        },
    ];
    var nodes = [
        { id: 0, owner: 0, units: 20, maxUnits: 20, level: 1, pos: { x: 0, y: 0 } },
    ];

    var result = resolveFleetArrivals({
        fleets: fleets,
        nodes: nodes,
        flows: [],
        players: [{ color: '#4a8eff' }],
        tune: { def: 1 },
        humanIndex: 0,
        callbacks: {
            nodeTypeOf: function () { return { def: 1 }; },
            nodeLevelDefMult: function () { return 1; },
            nodeCapacity: function (node) { return node.maxUnits; },
        },
        constants: {
            turretCaptureResist: 1.35,
            defenseBonus: 1.25,
            assimLockTicks: 180,
        },
    });

    assert.equal(result.fleets.length, 1);
    assert.equal(result.fleets[0].holding, true);
    assert.equal(result.fleets[0].count, 11);
});
