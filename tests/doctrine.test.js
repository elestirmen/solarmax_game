import test from 'node:test';
import assert from 'node:assert/strict';

import {
    activateDoctrine,
    buildDoctrineLoadout,
    doctrineModifiers,
    ensureDoctrineStates,
    tickDoctrineStates,
} from '../assets/sim/doctrine.js';

test('buildDoctrineLoadout applies chosen human doctrine and auto-assigns AI doctrines', function () {
    var doctrines = buildDoctrineLoadout([
        { isAI: false },
        { isAI: true },
        { isAI: true },
    ], { doctrineId: 'siege' });

    assert.deepEqual(doctrines, ['siege', 'siege', 'logistics']);
});

test('buildDoctrineLoadout with a seed can diverge from the archetype default for AIs', function () {
    var players = [{ isAI: false }, { isAI: true }];
    var sawDifferent = false;
    for (var s = 1; s <= 64; s++) {
        var d = buildDoctrineLoadout(players, { doctrineId: 'logistics', seed: s });
        assert.equal(d[0], 'logistics');
        if (d[1] !== 'siege') sawDifferent = true;
    }
    assert.equal(sawDifferent, true);
});

test('buildDoctrineLoadout preserves explicit doctrine for AIs', function () {
    var d = buildDoctrineLoadout(
        [{ isAI: false }, { isAI: true }, { isAI: true }],
        { doctrineId: 'logistics', doctrines: [null, 'assimilation', 'siege'], seed: 12345 },
    );
    assert.equal(d[1], 'assimilation');
    assert.equal(d[2], 'siege');
});

test('activateDoctrine starts active window and cooldown', function () {
    var doctrines = ['logistics'];
    var states = ensureDoctrineStates(doctrines, []);
    var activation = activateDoctrine(doctrines, states, 0);

    assert.equal(activation.activated, true);
    assert.equal(activation.states[0].activeTicks > 0, true);
    assert.equal(activation.states[0].cooldownTicks > 0, true);
});

test('doctrineModifiers reflect passive and active effects', function () {
    var doctrines = ['assimilation'];
    var states = ensureDoctrineStates(doctrines, [{ activeTicks: 120, cooldownTicks: 720 }]);
    var modifiers = doctrineModifiers(doctrines, states, 0);
    var ticked = tickDoctrineStates(doctrines, states);

    assert.equal(modifiers.assimMult > 1.5, true);
    assert.equal(modifiers.active, true);
    assert.equal(ticked[0].activeTicks, 119);
});
