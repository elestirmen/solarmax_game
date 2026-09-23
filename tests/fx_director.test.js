import test from 'node:test';
import assert from 'node:assert/strict';

import { createFxDirector, resetFxDirector, sampleFxDirector } from '../assets/app/fx_director.js';

function node(id, owner, x, y, units) {
    return { id: id, owner: owner, pos: { x: x, y: y }, radius: 20, units: units };
}

function fleet(id, owner, srcId, tgtId, opts) {
    opts = opts || {};
    return {
        id: id,
        active: true,
        owner: owner,
        srcId: srcId,
        tgtId: tgtId,
        count: opts.count === undefined ? 10 : opts.count,
        t: opts.t === undefined ? 0.5 : opts.t,
        x: opts.x === undefined ? 100 : opts.x,
        y: opts.y === undefined ? 0 : opts.y,
        headingX: opts.headingX === undefined ? 1 : opts.headingX,
        headingY: opts.headingY === undefined ? 0 : opts.headingY,
        holding: !!opts.holding,
    };
}

function types(events) {
    return events.map(function (e) { return e.type; });
}

test('first sample only primes the director', function () {
    var director = createFxDirector();
    var events = sampleFxDirector(director, {
        key: 'm1',
        nodes: [node(0, 0, 0, 0, 10), node(1, -1, 300, 0, 5)],
        fleets: [fleet(1, 0, 0, 1)],
    });
    assert.deepEqual(events, []);
});

test('an owner change is reported as a capture with the impact direction', function () {
    var director = createFxDirector();
    var nodes = [node(0, 0, 0, 0, 10), node(1, -1, 300, 0, 5)];
    sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [fleet(7, 0, 0, 1, { t: 0.97, x: 276, y: 0 })] });
    nodes[1].owner = 0;
    nodes[1].units = 4;
    var events = sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [] });
    assert.deepEqual(types(events), ['impact', 'capture']);
    var capture = events[1];
    assert.equal(capture.nodeId, 1);
    assert.equal(capture.fromOwner, -1);
    assert.equal(capture.toOwner, 0);
    assert.ok(capture.dirX > 0.9, 'fleet travelled +x, so the capture ripple starts from that side');
    var impact = events[0];
    assert.ok(impact.x < 300, 'impact lands on the rim facing the attacker');
});

test('arriving at an own world is a reinforcement, not combat', function () {
    var director = createFxDirector();
    var nodes = [node(0, 0, 0, 0, 10), node(1, 0, 300, 0, 5)];
    sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [fleet(3, 0, 0, 1, { t: 0.99, x: 280 })] });
    var events = sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [] });
    assert.deepEqual(types(events), ['reinforce']);
    assert.equal(events[0].count, 10);
});

test('a fleet vanishing mid-route was destroyed in space', function () {
    var director = createFxDirector();
    var nodes = [node(0, 0, 0, 0, 10), node(1, 1, 600, 0, 5)];
    sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [fleet(4, 0, 0, 1, { t: 0.4, x: 240, count: 6 })] });
    var events = sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [] });
    assert.deepEqual(types(events), ['destroyed']);
    assert.equal(events[0].x, 240);
    assert.equal(events[0].count, 6);
});

test('ships lost on the way are attrition; ships lost at the target are impacts', function () {
    var director = createFxDirector();
    var nodes = [node(0, 0, 0, 0, 10), node(1, 1, 600, 0, 5)];
    sampleFxDirector(director, {
        key: 'm1',
        nodes: nodes,
        fleets: [fleet(5, 0, 0, 1, { t: 0.4, x: 240, count: 12 }), fleet(6, 0, 0, 1, { t: 0.99, x: 578, count: 12 })],
    });
    var events = sampleFxDirector(director, {
        key: 'm1',
        nodes: nodes,
        fleets: [fleet(5, 0, 0, 1, { t: 0.42, x: 250, count: 9 }), fleet(6, 0, 0, 1, { t: 0.98, x: 575, count: 8 })],
    });
    var byType = {};
    events.forEach(function (e) { byType[e.type] = e; });
    assert.equal(byType.attrition.count, 3);
    assert.equal(byType.impact.count, 4);
    assert.equal(byType.impact.nodeId, 1);
});

test('new moving fleets are launches; a parked fleet shrinking because it launched is not damage', function () {
    var director = createFxDirector();
    var nodes = [node(0, 0, 0, 0, 10), node(1, 1, 600, 0, 5)];
    sampleFxDirector(director, { key: 'm1', nodes: nodes, fleets: [fleet(8, 0, -1, -1, { holding: true, x: 300, y: 300, count: 20, t: 1 })] });
    var events = sampleFxDirector(director, {
        key: 'm1',
        nodes: nodes,
        fleets: [
            fleet(8, 0, -1, -1, { holding: true, x: 300, y: 300, count: 10, t: 1 }),
            fleet(9, 0, -1, 1, { x: 305, y: 300, count: 10, t: 0 }),
        ],
    });
    assert.deepEqual(types(events), ['launch']);
    assert.equal(events[0].count, 10);
});

test('a new match key re-primes instead of reporting the whole board as changes', function () {
    var director = createFxDirector();
    sampleFxDirector(director, { key: 'm1', nodes: [node(0, 0, 0, 0, 10)], fleets: [] });
    var events = sampleFxDirector(director, { key: 'm2', nodes: [node(0, 1, 0, 0, 10)], fleets: [] });
    assert.deepEqual(events, []);
    resetFxDirector(director);
    assert.equal(director.primed, false);
});
