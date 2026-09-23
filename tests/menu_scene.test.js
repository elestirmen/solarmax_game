import test from 'node:test';
import assert from 'node:assert/strict';

import { MENU_SCENE_HEIGHT, MENU_SCENE_WIDTH, createMenuScene, menuSceneCamera, updateMenuScene } from '../assets/app/menu_scene.js';

test('the menu sector launches streams and changes hands over time', function () {
    var scene = createMenuScene();
    var captures = 0, impacts = 0;
    var hooks = {
        impact: function () { impacts++; },
        capture: function (planet, from, to) {
            captures++;
            assert.notEqual(from, to);
            assert.equal(planet.owner, to);
        },
        reinforce: function () {},
    };
    for (var i = 0; i < 60 * 90; i++) updateMenuScene(scene, 1 / 60, hooks);
    assert.ok(impacts > 0, 'streams reach their targets');
    assert.ok(captures > 0, 'worlds change hands');
    var owners = {};
    scene.planets.forEach(function (p) { if (p.owner >= 0) owners[p.owner] = true; });
    assert.ok(Object.keys(owners).length >= 2, 'the scene never settles on a single empire');
});

test('the menu camera fills the viewport', function () {
    var scene = createMenuScene();
    var cam = menuSceneCamera(scene, 1920, 1080);
    assert.ok(MENU_SCENE_WIDTH * 0.92 * cam.zoom >= 1920 - 0.01);
    assert.ok(MENU_SCENE_HEIGHT * 0.92 * cam.zoom >= 1080 - 0.01 || MENU_SCENE_WIDTH * 0.92 * cam.zoom >= 1920 - 0.01);
});
