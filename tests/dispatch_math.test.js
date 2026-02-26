import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSendCount } from '../assets/sim/dispatch_math.js';

test('computeSendCount sends half from 100 with pct 0.5', function () {
    var result = computeSendCount({ srcUnits: 100, pct: 0.5, flowMult: 1 });
    assert.equal(result.sendCount, 50);
    assert.equal(result.newSrcUnits, 50);
});

test('computeSendCount keeps one unit when src is 2', function () {
    var result = computeSendCount({ srcUnits: 2, pct: 1, flowMult: 1 });
    assert.equal(result.sendCount, 1);
    assert.equal(result.newSrcUnits, 1);
});

test('computeSendCount returns zero when srcUnits is 1', function () {
    var result = computeSendCount({ srcUnits: 1, pct: 1, flowMult: 1 });
    assert.equal(result.sendCount, 0);
    assert.equal(result.newSrcUnits, 1);
});

test('computeSendCount clamps pct to 0.05 minimum', function () {
    var result = computeSendCount({ srcUnits: 100, pct: 0.01, flowMult: 1 });
    assert.equal(result.sendCount, 5);
    assert.equal(result.newSrcUnits, 95);
});
