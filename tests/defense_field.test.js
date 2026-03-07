import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDefenseFieldDamage, getDefenseFieldStats } from '../assets/sim/defense_field.js';

test('owned assimilated planets chip enemy fleets inside the field', function () {
    var nodes = [
        {
            id: 0,
            owner: 0,
            kind: 'core',
            level: 1,
            radius: 24,
            units: 10,
            pos: { x: 0, y: 0 },
            assimilationProgress: 1,
            assimilationLock: 0,
        },
    ];
    var fleets = [
        { active: true, owner: 1, count: 10, x: 30, y: 0, fieldDmgAcc: 0, trail: [] },
    ];

    var result = applyDefenseFieldDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        cfg: { baseRangePad: 24, baseDps: 3 },
    });

    assert.equal(result.hits, 1);
    assert.equal(result.kills, 0);
    assert.equal(result.arcs.length, 1);
    assert.equal(result.impacts.length, 1);
    assert.equal(fleets[0].count, 7);
    assert.equal(fleets[0].hitFlash > 0, true);
});

test('field does not harm friendly fleets or incomplete captures', function () {
    var nodes = [
        {
            id: 0,
            owner: 0,
            kind: 'core',
            level: 1,
            radius: 24,
            units: 10,
            pos: { x: 0, y: 0 },
            assimilationProgress: 0.4,
            assimilationLock: 60,
        },
    ];
    var fleets = [
        { active: true, owner: 0, count: 10, x: 30, y: 0, fieldDmgAcc: 0, trail: [] },
        { active: true, owner: 1, count: 10, x: 30, y: 0, fieldDmgAcc: 0, trail: [] },
    ];

    var result = applyDefenseFieldDamage({
        nodes: nodes,
        fleets: fleets,
        dt: 1,
        cfg: { baseRangePad: 24, baseDps: 3 },
    });

    assert.equal(result.hits, 0);
    assert.equal(fleets[0].count, 10);
    assert.equal(fleets[1].count, 10);
});

test('defense mode and bulwark raise field strength', function () {
    var stats = getDefenseFieldStats({
        owner: 0,
        kind: 'bulwark',
        level: 2,
        radius: 24,
        units: 12,
        defense: true,
        assimilationProgress: 1,
        assimilationLock: 0,
    }, {
        baseRangePad: 20,
        baseDps: 2,
        levelRangeBonus: 5,
        levelDpsBonus: 0.5,
        defenseDpsBonus: 1.2,
        bulwarkDpsBonus: 1.1,
    });

    assert.equal(stats.active, true);
    assert.equal(stats.range, 49);
    assert.equal(Math.round(stats.dps * 100), 396);
});
