import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createVfxSystem,
    getNodeVfx,
    markNodeCapture,
    markNodeHit,
    resetVfxSystem,
    updateVfxSystem,
    vfxBurst,
    vfxCapture,
    vfxLiveCount,
} from '../assets/app/vfx.js';

function seeded() {
    var s = 1;
    return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

test('particles expire with time and the live count follows', function () {
    var sys = createVfxSystem({ capacity: 64, random: seeded() });
    vfxBurst(sys, 0, 0, { count: 10, lifeMin: 0.2, lifeMax: 0.2 });
    assert.equal(vfxLiveCount(sys), 10);
    updateVfxSystem(sys, 0.1);
    assert.equal(vfxLiveCount(sys), 10);
    updateVfxSystem(sys, 0.11);
    assert.equal(vfxLiveCount(sys), 0);
});

test('a full pool recycles its oldest slots instead of refusing new effects', function () {
    var sys = createVfxSystem({ capacity: 64, random: seeded() });
    for (var i = 0; i < 20; i++) vfxBurst(sys, i, 0, { count: 8, lifeMin: 5, lifeMax: 5 });
    assert.equal(vfxLiveCount(sys), 64);
    var newest = sys.pool[(sys.cursor + 63) % 64];
    assert.equal(newest.x, 19, 'the most recent burst is in the pool');
});

test('motion is frame-rate independent', function () {
    var a = createVfxSystem({ capacity: 64, random: seeded() });
    var b = createVfxSystem({ capacity: 64, random: seeded() });
    vfxBurst(a, 0, 0, { count: 1, speedMin: 100, speedMax: 100, lifeMin: 2, lifeMax: 2, drag: 0.9, dirX: 1, dirY: 0, spread: 0.0001 });
    vfxBurst(b, 0, 0, { count: 1, speedMin: 100, speedMax: 100, lifeMin: 2, lifeMax: 2, drag: 0.9, dirX: 1, dirY: 0, spread: 0.0001 });
    for (var i = 0; i < 30; i++) updateVfxSystem(a, 1 / 30);
    for (var j = 0; j < 144; j++) updateVfxSystem(b, 1 / 144);
    var pa = a.pool.find(function (p) { return p.active; });
    var pb = b.pool.find(function (p) { return p.active; });
    assert.ok(Math.abs(pa.vx - pb.vx) < 1e-6, 'drag is applied per second, not per frame');
    assert.ok(Math.abs(pa.x - pb.x) < 12, 'positions agree to within integration error');
});

test('planet hit and capture state decays and then clears', function () {
    var sys = createVfxSystem({ capacity: 64, random: seeded() });
    markNodeHit(sys, 3, '#ff0000', 1, 0, 1);
    markNodeCapture(sys, 3, '#868d99', '#3d8bfd', 1, 0);
    var state = getNodeVfx(sys, 3);
    assert.equal(state.hit, 1);
    assert.equal(state.capture.toColor, '#3d8bfd');
    for (var i = 0; i < 30; i++) updateVfxSystem(sys, 0.05);
    assert.equal(getNodeVfx(sys, 3), null);
});

test('reset clears particles and planet state', function () {
    var sys = createVfxSystem({ capacity: 128, random: seeded() });
    vfxCapture(sys, 0, 0, 20, '#3d8bfd', '#868d99', 1, 0, 1);
    markNodeCapture(sys, 1, '#868d99', '#3d8bfd', 0, 0);
    assert.ok(vfxLiveCount(sys) > 0);
    resetVfxSystem(sys);
    assert.equal(vfxLiveCount(sys), 0);
    assert.equal(getNodeVfx(sys, 1), null);
});

test('reduced motion trims particle counts', function () {
    var full = createVfxSystem({ capacity: 256, random: seeded() });
    var calm = createVfxSystem({ capacity: 256, random: seeded(), reducedMotion: true });
    vfxBurst(full, 0, 0, { count: 20 });
    vfxBurst(calm, 0, 0, { count: 20 });
    assert.ok(vfxLiveCount(calm) < vfxLiveCount(full));
});
