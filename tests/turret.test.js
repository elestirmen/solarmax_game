import test from 'node:test';
import assert from 'node:assert/strict';

import { applyTurretDamage } from '../assets/sim/turret.js';

test('turret damages and kills an enemy fleet with high DPS', function () {
    var nodes = [
        {
            id: 0,
            kind: 'turret',
            owner: 0,
            units: 10,
            pos: { x: 0, y: 0 },
            assimilationProgress: 1,
            assimilationLock: 0,
        },
    ];
    var fleets = [
        {
            active: true,
            owner: 1,
            count: 10,
            x: 10,
            y: 0,
            dmgAcc: 0,
            trail: [],
        },
    ];

    var result = applyTurretDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        range: 120,
        dps: 18,
        minGarrison: 4,
    });

    assert.equal(result.kills, 1);
    assert.equal(result.hits, 1);
    assert.equal(result.shots.length, 1);
    assert.equal(fleets[0].active, false);
    assert.equal(fleets[0].count, 0);
});

test('turret does not damage friendly fleet', function () {
    var nodes = [
        {
            id: 0,
            kind: 'turret',
            owner: 1,
            units: 10,
            pos: { x: 0, y: 0 },
            assimilationProgress: 1,
            assimilationLock: 0,
        },
    ];
    var fleets = [
        {
            active: true,
            owner: 1,
            count: 10,
            x: 10,
            y: 0,
            dmgAcc: 0,
            trail: [],
        },
    ];

    var result = applyTurretDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        range: 120,
        dps: 18,
        minGarrison: 4,
    });

    assert.equal(result.hits, 0);
    assert.equal(result.kills, 0);
    assert.equal(result.shots.length, 0);
    assert.equal(fleets[0].count, 10);
    assert.equal(fleets[0].active, true);
});

test('turret attacks only one target per tick (closest in range)', function () {
    var nodes = [
        {
            id: 0,
            kind: 'turret',
            owner: -1,
            units: 10,
            pos: { x: 0, y: 0 },
            assimilationProgress: 1,
            assimilationLock: 0,
        },
    ];
    var fleets = [
        { active: true, owner: 0, count: 10, x: 10, y: 0, dmgAcc: 0, trail: [] },
        { active: true, owner: 1, count: 10, x: 40, y: 0, dmgAcc: 0, trail: [] },
    ];

    var result = applyTurretDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        range: 120,
        dps: 1,
        minGarrison: 4,
    });

    assert.equal(result.hits, 1);
    assert.equal(result.shots.length, 1);
    assert.equal(fleets[0].count, 9);
    assert.equal(fleets[1].count, 10);
});

test('captured turret fires with low garrison while assimilation is incomplete', function () {
    var nodes = [
        {
            id: 0,
            kind: 'turret',
            owner: 0,
            units: 1,
            pos: { x: 0, y: 0 },
            assimilationProgress: 0.2,
            assimilationLock: 180,
        },
    ];
    var fleets = [
        {
            active: true,
            owner: 1,
            count: 10,
            x: 20,
            y: 0,
            dmgAcc: 0,
            trail: [],
        },
    ];

    var result = applyTurretDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        range: 120,
        dps: 2,
        minGarrison: 6,
    });

    assert.equal(result.hits, 1);
    assert.equal(result.shots.length, 1);
    assert.equal(fleets[0].count, 8);
});
