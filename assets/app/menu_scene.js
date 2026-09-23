// The main menu's living backdrop: a small sector where four empires trade worlds
// forever. It is decorative only - no sim, no AI, no randomness that matters - so it is
// cheap, cannot leak state into a match, and looks the same every time the menu opens.

var TAU = Math.PI * 2;

function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

var LAYOUT = [
    // Worlds sit toward the edges: the middle of the screen belongs to the menu panel.
    { x: 180, y: 190, r: 40, owner: 0 },
    { x: 420, y: 760, r: 30, owner: 0 },
    { x: 150, y: 560, r: 24, owner: -1 },
    { x: 1400, y: 170, r: 44, owner: 1 },
    { x: 1250, y: 470, r: 26, owner: -1 },
    { x: 1440, y: 780, r: 34, owner: 2 },
    { x: 820, y: 90, r: 22, owner: -1 },
    { x: 960, y: 880, r: 28, owner: 3 },
    { x: 620, y: 420, r: 20, owner: -1 },
];

export var MENU_SCENE_WIDTH = 1600;
export var MENU_SCENE_HEIGHT = 960;

export function createMenuScene() {
    var planets = [];
    for (var i = 0; i < LAYOUT.length; i++) {
        var spec = LAYOUT[i];
        planets.push({
            id: 'menu-' + i,
            textureId: 900 + i,
            x: spec.x,
            y: spec.y,
            r: spec.r,
            owner: spec.owner,
            garrison: spec.owner >= 0 ? 30 + spec.r : 12,
            orbitPhase: i * 1.7,
        });
    }
    return {
        planets: planets,
        streams: [],
        time: 0,
        nextStreamAt: 0.8,
        rng: makeRng(20260923),
        cam: { x: MENU_SCENE_WIDTH / 2, y: MENU_SCENE_HEIGHT / 2, zoom: 1 },
    };
}

function distance(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function streamControlPoint(from, to) {
    var mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    var dx = to.x - from.x, dy = to.y - from.y;
    return { x: mx - dy * 0.18, y: my + dx * 0.18 };
}

function bezier(p0, cp, p2, t) {
    var u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y };
}

function launchStream(scene) {
    var rng = scene.rng;
    var owned = scene.planets.filter(function (p) { return p.owner >= 0 && p.garrison > 18; });
    if (!owned.length) return;
    var from = owned[Math.floor(rng() * owned.length)];
    var candidates = scene.planets
        .filter(function (p) { return p !== from; })
        .sort(function (a, b) { return distance(from, a) - distance(from, b); })
        .slice(0, 4);
    var to = candidates[Math.floor(rng() * candidates.length)];
    if (!to) return;
    var count = Math.max(6, Math.floor(from.garrison * (0.45 + rng() * 0.3)));
    from.garrison -= count;
    var length = distance(from, to);
    scene.streams.push({
        from: from,
        to: to,
        cp: streamControlPoint(from, to),
        owner: from.owner,
        count: count,
        landed: 0,
        t: 0,
        duration: length / 95,
        spacing: 0.018,
        seed: rng() * 100,
    });
}

/**
 * @param {object} scene
 * @param {number} dt seconds
 * @param {object} hooks { impact(x, y, owner, dirX, dirY), capture(planet, fromOwner, toOwner, dirX, dirY), reinforce(planet, owner) }
 */
export function updateMenuScene(scene, dt, hooks) {
    if (!scene || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    hooks = hooks || {};
    scene.time += dt;
    // A slow drift so the view never sits perfectly still.
    scene.cam.x = MENU_SCENE_WIDTH / 2 + Math.sin(scene.time * 0.035) * 90;
    scene.cam.y = MENU_SCENE_HEIGHT / 2 + Math.cos(scene.time * 0.027) * 50;

    for (var i = 0; i < scene.planets.length; i++) {
        var planet = scene.planets[i];
        if (planet.owner >= 0) planet.garrison = Math.min(90, planet.garrison + dt * (1.4 + planet.r * 0.03));
    }

    if (scene.time >= scene.nextStreamAt) {
        launchStream(scene);
        scene.nextStreamAt = scene.time + 1.1 + scene.rng() * 1.8;
    }

    for (var s = scene.streams.length - 1; s >= 0; s--) {
        var stream = scene.streams[s];
        stream.t += dt / Math.max(0.5, stream.duration);
        // Ships land one by one, exactly like the real game.
        var shouldHaveLanded = Math.min(stream.count, Math.max(0, Math.floor((stream.t - 1) / stream.spacing) + 1));
        while (stream.landed < shouldHaveLanded) {
            stream.landed++;
            var target = stream.to;
            var near = bezier(stream.from, stream.cp, target, 0.96);
            var dx = target.x - near.x, dy = target.y - near.y;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            dx /= len; dy /= len;
            if (target.owner === stream.owner) {
                target.garrison += 1;
                if (stream.landed === 1 && hooks.reinforce) hooks.reinforce(target, stream.owner);
            } else {
                target.garrison -= 1;
                if (hooks.impact && stream.landed % 2 === 1) hooks.impact(target.x - dx * target.r * 0.9, target.y - dy * target.r * 0.9, stream.owner, dx, dy);
                if (target.garrison < 0) {
                    var previous = target.owner;
                    target.owner = stream.owner;
                    target.garrison = 1;
                    if (hooks.capture) hooks.capture(target, previous, stream.owner, dx, dy);
                }
            }
        }
        if (stream.landed >= stream.count) scene.streams.splice(s, 1);
    }

    // Keep the story going: if one empire swallows everything, the neutrals come back.
    var owners = {};
    for (var k = 0; k < scene.planets.length; k++) if (scene.planets[k].owner >= 0) owners[scene.planets[k].owner] = true;
    if (Object.keys(owners).length < 2) {
        for (var m = 0; m < scene.planets.length; m++) {
            var reset = scene.planets[m];
            reset.owner = LAYOUT[m].owner;
            reset.garrison = reset.owner >= 0 ? 30 + reset.r : 12;
        }
    }
}

export function menuSceneCamera(scene, viewWidth, viewHeight) {
    var zoom = Math.max(viewWidth / (MENU_SCENE_WIDTH * 0.92), viewHeight / (MENU_SCENE_HEIGHT * 0.92));
    scene.cam.zoom = zoom;
    return scene.cam;
}

/**
 * Draw the scene in world space. The caller has already applied the camera transform.
 * helpers: { colorFor(owner), planetTexture(id, r), haloSprite(color), paintHue(ctx, x, y, r, color, k),
 *            paintRipple(ctx, x, y, r, capture), nodeVfx(id), shipPush(...), shipFlush(ctx, color, opts) }
 */
export function drawMenuSceneWorld(ctx, scene, helpers) {
    var time = scene.time;
    var i, planet, color;
    for (i = 0; i < scene.planets.length; i++) {
        planet = scene.planets[i];
        color = helpers.colorFor(planet.owner);
        var nfx = helpers.nodeVfx(planet.id);
        var halo = helpers.haloSprite(planet.owner >= 0 ? color : '#9aa3b2');
        if (halo) {
            var haloR = planet.r * (planet.owner >= 0 ? 3.4 : 2.4);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (planet.owner >= 0 ? 0.42 : 0.12) + (nfx && nfx.capture ? 0.35 * (1 - nfx.capture.age / nfx.capture.duration) : 0);
            ctx.drawImage(halo, planet.x - haloR, planet.y - haloR, haloR * 2, haloR * 2);
            ctx.restore();
        }
        var tex = helpers.planetTexture(planet.textureId, planet.r);
        if (tex) ctx.drawImage(tex, planet.x - planet.r, planet.y - planet.r, planet.r * 2, planet.r * 2);
        if (nfx && nfx.capture) helpers.paintRipple(ctx, planet.x, planet.y, planet.r, nfx.capture);
        else helpers.paintHue(ctx, planet.x, planet.y, planet.r, planet.owner >= 0 ? color : '#868d99', planet.owner >= 0 ? 0.9 : 0.85);
        if (planet.owner >= 0) {
            ctx.beginPath();
            ctx.arc(planet.x, planet.y, planet.r + 2.2, 0, TAU);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = 2.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Garrison: a handful of ships in orbit, more for bigger stacks.
            var ships = Math.min(14, Math.round(planet.garrison / 6));
            for (var o = 0; o < ships; o++) {
                var a = time * (0.5 + (o % 3) * 0.12) + planet.orbitPhase + o * (TAU / Math.max(1, ships));
                var rx = planet.r + 12 + (o % 3) * 6;
                var ry = rx * 0.62;
                var px = planet.x + Math.cos(a) * rx;
                var py = planet.y + Math.sin(a) * ry;
                var tx = -Math.sin(a) * rx, ty = Math.cos(a) * ry;
                var tl = Math.sqrt(tx * tx + ty * ty) || 1;
                helpers.shipPush(px, py, tx / tl, ty / tl, 1.5, Math.sin(a) > 0 ? 0.9 : 0.45, 4);
            }
            helpers.shipFlush(ctx, color, { glow: 0.7, streak: 0.6 });
        }
    }

    for (var s = 0; s < scene.streams.length; s++) {
        var stream = scene.streams[s];
        color = helpers.colorFor(stream.owner);
        var visible = Math.min(40, stream.count - stream.landed);
        var stride = (stream.count - stream.landed) / Math.max(1, visible);
        for (var k = 0; k < visible; k++) {
            var unit = stream.landed + Math.floor(k * stride);
            var tu = stream.t - unit * stream.spacing;
            if (tu <= 0 || tu >= 1) continue;
            var pt = bezier(stream.from, stream.cp, stream.to, tu);
            var pt2 = bezier(stream.from, stream.cp, stream.to, Math.min(1, tu + 0.01));
            var dx = pt2.x - pt.x, dy = pt2.y - pt.y;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            dx /= len; dy /= len;
            var fade = Math.min(1, tu * 6) * Math.min(1, (1 - tu) * 7);
            var j = Math.sin(unit * 12.9898 + stream.seed) * 43758.5453;
            j = j - Math.floor(j) - 0.5;
            var off = (j * 12 + Math.sin(time * 3 + unit) * 1.2) * fade;
            helpers.shipPush(pt.x - dy * off, pt.y + dx * off, dx, dy, 1.6, 0.9, 9);
        }
        helpers.shipFlush(ctx, color, { glow: 1, streak: 1 });
    }
}
