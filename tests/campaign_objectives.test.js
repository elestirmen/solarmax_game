import test from 'node:test';
import assert from 'node:assert/strict';

import { describeCampaignObjectives, evaluateCampaignObjectives } from '../assets/campaign/objectives.js';

test('evaluateCampaignObjectives completes numeric progress goals', function () {
    var level = {
        objectives: [
            { type: 'owned_nodes', target: 4, label: '4 node kontrol et' },
            { type: 'pulse_control_ticks', target: 180, label: 'Pulse kontrolunu 6s tut' },
        ],
    };
    var snapshot = {
        tick: 220,
        didWin: false,
        gameOver: false,
        ownedNodes: 5,
        stats: { pulseControlTicks: 210 },
    };

    var rows = evaluateCampaignObjectives(level, snapshot, { tickRate: 30 });

    assert.equal(rows[0].complete, true);
    assert.equal(rows[0].progressText, '5 / 4');
    assert.equal(rows[1].complete, true);
    assert.equal(rows[1].progressText, '7s / 6s');
});

test('evaluateCampaignObjectives marks cap pressure goal as failed once exceeded', function () {
    var level = {
        objectives: [{ type: 'peak_cap_pressure_below', target: 1.02, label: 'Straini kontrol et' }],
    };
    var snapshot = {
        tick: 300,
        didWin: false,
        gameOver: false,
        ownedNodes: 0,
        stats: { peakCapPressure: 1.1 },
    };

    var rows = evaluateCampaignObjectives(level, snapshot, { tickRate: 30 });

    assert.equal(rows[0].complete, false);
    assert.equal(rows[0].failed, true);
    assert.equal(rows[0].progressText, '110% / 102%');
});

test('evaluateCampaignObjectives resolves win-before-tick on game over', function () {
    var level = {
        objectives: [{ type: 'win_before_tick', target: 500, label: '500 tickten once kazan' }],
    };

    var success = evaluateCampaignObjectives(level, {
        tick: 420,
        didWin: true,
        gameOver: true,
        ownedNodes: 0,
        stats: {},
    }, { tickRate: 30 });
    var fail = evaluateCampaignObjectives(level, {
        tick: 620,
        didWin: true,
        gameOver: true,
        ownedNodes: 0,
        stats: {},
    }, { tickRate: 30 });

    assert.equal(success[0].complete, true);
    assert.equal(fail[0].failed, true);
});

test('describeCampaignObjectives includes goal prefixes', function () {
    var summary = describeCampaignObjectives({
        objectives: [
            { type: 'owned_nodes', target: 4, label: '4 node kontrol et' },
            { type: 'win_before_tick', target: 600, label: '600 tickten once kazan', optional: true },
        ],
    }, { tickRate: 30 });

    assert.equal(summary, 'Gorev: 4 node kontrol et | Bonus: 600 tickten once kazan');
});

test('evaluateCampaignObjectives resolves encounter and survival goals', function () {
    var level = {
        objectives: [
            { type: 'encounter_captured', encounterType: 'relay_core', target: 1 },
            { type: 'encounter_control_ticks', encounterType: 'relay_core', target: 180 },
            { type: 'survive_until_tick', target: 900 },
        ],
    };
    var rows = evaluateCampaignObjectives(level, {
        tick: 930,
        didWin: false,
        gameOver: false,
        ownedNodes: 0,
        humanIndex: 0,
        encounters: [
            { type: 'relay_core', owner: 0, assimilated: true, controlTicksByPlayer: { 0: 210 } },
        ],
        stats: {},
    }, { tickRate: 30 });

    assert.equal(rows[0].complete, true);
    assert.equal(rows[1].progressText, '7s / 6s');
    assert.equal(rows[2].complete, true);
});
