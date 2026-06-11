import test from 'node:test';
import assert from 'node:assert/strict';

import { runEconomyTickPhase } from '../assets/app/game_tick_phases.js';

function makeEconomyHarness() {
    var game = {
        tick: 0,
        doctrines: [],
        doctrineStates: [],
        strategicPulse: { active: false, nodeId: -1, cycle: 0, announcedCycle: -1 },
        players: [{ idx: 0, alive: true }],
        nodes: [{ id: 0, owner: 0, units: 10 }],
        fleets: [],
        rules: {},
        playerCapital: {},
        human: 0,
        tune: {},
        diffCfg: {},
        stats: {
            peakCapPressure: 0,
            peakPower: 0,
            pulseControlTicks: 0,
            unitsProduced: 0,
        },
    };
    var pulseAnnouncements = 0;

    return {
        game: game,
        get pulseAnnouncements() {
            return pulseAnnouncements;
        },
        callbacks: {
            tickDoctrineStates: function (doctrines, states) {
                return states;
            },
            currentStrategicPulse: function (tick) {
                return {
                    active: true,
                    nodeId: 0,
                    cycle: Math.floor(tick / 100),
                    phase: tick % 100,
                    remainingTicks: 20,
                };
            },
            strategicPulseToast: function () {
                if (!game.strategicPulse.active) return;
                if (game.strategicPulse.announcedCycle === game.strategicPulse.cycle) return;
                game.strategicPulse.announcedCycle = game.strategicPulse.cycle;
                pulseAnnouncements++;
            },
            computeOwnershipMetrics: function () {
                return {
                    powerByPlayer: [5],
                    supplyByPlayer: [5],
                    unitByPlayer: [10],
                    capByPlayer: [20],
                };
            },
            spawnAnchors: function () {
                return [];
            },
            isNodeAssimilated: function () {
                return true;
            },
            dist: function () {
                return 0;
            },
            nodePowerValue: function () {
                return 1;
            },
            stepEncounterState: function () {},
            stepNodeEconomy: function () {},
            clamp: function (value, min, max) {
                return Math.max(min, Math.min(max, value));
            },
            nodeTypeOf: function () {
                return {};
            },
            nodeCapacity: function () {
                return 20;
            },
            nodeLevelProdMult: function () {
                return 1;
            },
            strategicPulseAppliesToNode: function () {
                return true;
            },
            ownerProdMultiplier: function () {
                return 1;
            },
            ownerAssimilationMultiplier: function () {
                return 1;
            },
        },
    };
}

test('runEconomyTickPhase preserves strategic pulse announcement state across ticks', function () {
    var harness = makeEconomyHarness();

    runEconomyTickPhase({
        game: harness.game,
        constants: {},
        callbacks: harness.callbacks,
    });
    harness.game.tick = 1;
    runEconomyTickPhase({
        game: harness.game,
        constants: {},
        callbacks: harness.callbacks,
    });

    assert.equal(harness.pulseAnnouncements, 1);
    assert.equal(harness.game.strategicPulse.announcedCycle, 0);
});
