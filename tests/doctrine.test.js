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
