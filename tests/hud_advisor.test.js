import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHudAdvisorCard } from '../assets/ui/hud_advisor.js';

test('advisor prioritizes flow mode guidance', function () {
    var card = buildHudAdvisorCard({
        commandMode: 'flow',
        selectedOwnedUnassimilated: true,
        tick: 10,
    });

    assert.equal(card.title, 'Flow hedefi');
    assert.equal(card.tone, 'accent');
});

test('advisor highlights new capture before generic opening tips', function () {
    var card = buildHudAdvisorCard({
        tick: 120,
        selectedOwnedUnassimilated: true,
    });

    assert.equal(card.title, 'Yeni fetih');
    assert.equal(card.tone, 'warning');
});

test('advisor surfaces mission objective when no higher-priority tactical warning exists', function () {
    var card = buildHudAdvisorCard({
        tick: 900,
        primaryObjectiveTitle: 'Günlük Challenge',
        primaryObjectiveLabel: 'GATE nodeunu ele geçir',
        primaryObjectiveProgress: '0/1',
        primaryObjectiveCoach: 'Asimilasyon tamamlanmadan geçiş açılmaz.',
    });

    assert.equal(card.tone, 'objective');
    assert.match(card.body, /0\/1/);
    assert.match(card.body, /Asimilasyon tamamlanmadan/);
});

test('advisor warns about cap strain before objective text', function () {
    var card = buildHudAdvisorCard({
        capPressure: 0.91,
        primaryObjectiveLabel: 'Relay Core tut',
    });

    assert.equal(card.title, 'Kapasite doluyor');
    assert.equal(card.tone, 'warning');
});
