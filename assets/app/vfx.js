// Client-only visual effects: a fixed pool of particles drawn with cached, additively
// blended sprites, plus short-lived per-planet visual state (hit flashes, capture
// ripples, garrison bumps).
//
// Nothing in here is read by the simulation or the sync hash, so it is free to use real
// frame time, Math.random and whatever the display can afford. Speeds are world units per
// second and drag is "fraction of velocity kept per 1/60 s", so an effect looks the same
// at 30, 60 or 144 Hz.

var KIND_GLOW = 0;
var KIND_SPARK = 1;
var KIND_DEBRIS = 2;
var KIND_RING = 3;
var KIND_EMBER = 4;

var TAU = Math.PI * 2;

function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function parseHex(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
    if (!m) return [255, 255, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function mixRgb(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
    ];
}

function rgbCss(rgb, alpha) {
    if (alpha === undefined) return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
}

function makeParticle() {
    return {
        active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
        size: 1, sizeEnd: 1, alpha: 1, drag: 1, len: 0, rot: 0, spin: 0,
        color: '#ffffff', css: 'rgb(255,255,255)', flicker: 0, phase: 0,
    };
}

export function createVfxSystem(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var capacity = Math.max(64, Math.floor(Number(opts.capacity) || 2400));
    var pool = new Array(capacity);
    for (var i = 0; i < capacity; i++) pool[i] = makeParticle();
    return {
        pool: pool,
        cursor: 0,
        live: 0,
        nodes: {},
        random: typeof opts.random === 'function' ? opts.random : Math.random,
        reducedMotion: opts.reducedMotion === true,
        time: 0,
    };
}

export function resetVfxSystem(sys) {
    if (!sys) return;
    for (var i = 0; i < sys.pool.length; i++) sys.pool[i].active = false;
    sys.live = 0;
    sys.cursor = 0;
    sys.nodes = {};
}

// The pool is a ring: when it is full the oldest slot is reused, so a huge battle sheds
// its earliest sparks instead of refusing to draw the newest (and most relevant) ones.
function nextParticle(sys) {
    var pool = sys.pool;
    var p = pool[sys.cursor];
    sys.cursor = (sys.cursor + 1) % pool.length;
    if (!p.active) sys.live++;
    p.active = true;
    return p;
}

function emit(sys, kind, x, y, vx, vy, life, size, sizeEnd, color, o) {
    var p = nextParticle(sys);
    o = o || {};
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.sizeEnd = sizeEnd;
    p.alpha = o.alpha === undefined ? 1 : o.alpha;
    p.drag = o.drag === undefined ? 1 : o.drag;
    p.len = o.len || 0;
    p.rot = o.rot || 0;
    p.spin = o.spin || 0;
    p.flicker = o.flicker || 0;
    p.phase = o.phase || 0;
    if (p.color !== color) {
        p.color = color;
        p.css = rgbCss(parseHex(color));
    }
    return p;
}

export function vfxLiveCount(sys) {
    return sys ? sys.live : 0;
}

export function updateVfxSystem(sys, dt) {
    if (!sys || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    sys.time += dt;
    var frames = dt * 60;
    var pool = sys.pool;
    for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
            p.active = false;
            sys.live--;
            continue;
        }
        if (p.drag !== 1) {
            var keep = Math.pow(p.drag, frames);
            p.vx *= keep;
            p.vy *= keep;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.spin) p.rot += p.spin * dt;
    }
    var nodes = sys.nodes;
    for (var id in nodes) {
        if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue;
        var n = nodes[id];
        n.hit = Math.max(0, n.hit - dt * 3.2);
        n.bump = Math.max(0, n.bump - dt * 2.6);
        n.reinforce = Math.max(0, n.reinforce - dt * 2.2);
        if (n.capture) {
            n.capture.age += dt;
            if (n.capture.age >= n.capture.duration) n.capture = null;
        }
        if (n.hit <= 0 && n.bump <= 0 && n.reinforce <= 0 && !n.capture) delete nodes[id];
    }
}

// ── Sprites ─────────────────────────────────────────────────────────────────────────
// Radial gradients are the single most expensive thing a 2D canvas is asked to draw.
// Baking each colour once and stamping it with drawImage is what lets a battle carry
// hundreds of glowing sparks instead of a couple of dozen.

var spriteCache = {};

function createSpriteCanvas(size) {
    if (typeof document !== 'undefined' && document.createElement) {
        var c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
    return null;
}

export function getGlowSprite(color) {
    var key = 'g' + color;
    if (spriteCache[key] !== undefined) return spriteCache[key];
    var size = 64;
    var c = createSpriteCanvas(size);
    var g = c ? c.getContext('2d') : null;
    if (!g) { spriteCache[key] = null; return null; }
    var rgb = parseHex(color);
    var hot = mixRgb(rgb, [255, 255, 255], 0.7);
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgbCss(hot, 1));
    grad.addColorStop(0.16, rgbCss(mixRgb(rgb, [255, 255, 255], 0.35), 0.9));
    grad.addColorStop(0.42, rgbCss(rgb, 0.34));
    grad.addColorStop(0.7, rgbCss(rgb, 0.1));
    grad.addColorStop(1, rgbCss(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache[key] = c;
    return c;
}

// A soft halo with no hot core - for planet auras, where a white centre would wash out
// the garrison number printed on top.
export function getHaloSprite(color) {
    var key = 'h' + color;
    if (spriteCache[key] !== undefined) return spriteCache[key];
    var size = 128;
    var c = createSpriteCanvas(size);
    var g = c ? c.getContext('2d') : null;
    if (!g) { spriteCache[key] = null; return null; }
    var rgb = parseHex(color);
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgbCss(rgb, 0.55));
    grad.addColorStop(0.35, rgbCss(rgb, 0.4));
    grad.addColorStop(0.55, rgbCss(rgb, 0.16));
    grad.addColorStop(0.78, rgbCss(rgb, 0.05));
    grad.addColorStop(1, rgbCss(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache[key] = c;
    return c;
}

export function getRingSprite(color) {
    var key = 'r' + color;
    if (spriteCache[key] !== undefined) return spriteCache[key];
    var size = 128;
    var c = createSpriteCanvas(size);
    var g = c ? c.getContext('2d') : null;
    if (!g) { spriteCache[key] = null; return null; }
    var rgb = parseHex(color);
    var hot = mixRgb(rgb, [255, 255, 255], 0.55);
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgbCss(rgb, 0));
    grad.addColorStop(0.6, rgbCss(rgb, 0));
    grad.addColorStop(0.8, rgbCss(rgb, 0.35));
    grad.addColorStop(0.9, rgbCss(hot, 0.95));
    grad.addColorStop(0.95, rgbCss(rgb, 0.4));
    grad.addColorStop(1, rgbCss(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache[key] = c;
    return c;
}

// ── Drawing ─────────────────────────────────────────────────────────────────────────

export function drawVfxSystem(sys, ctx, opts) {
    if (!sys || !ctx || sys.live <= 0) return;
    opts = opts || {};
    var zoom = Math.max(0.05, Number(opts.zoom) || 1);
    var minWorld = 0.9 / zoom;
    var bounds = opts.bounds || null;
    var pool = sys.pool;
    var time = sys.time;
    var i, p, u, a, s;

    function visible(p, pad) {
        if (!bounds) return true;
        return p.x > bounds.minX - pad && p.x < bounds.maxX + pad && p.y > bounds.minY - pad && p.y < bounds.maxY + pad;
    }

    ctx.save();
    // Debris is solid matter, so it is drawn normally and under the light.
    for (i = 0; i < pool.length; i++) {
        p = pool[i];
        if (!p.active || p.kind !== KIND_DEBRIS || !visible(p, 12)) continue;
        u = 1 - p.life / p.maxLife;
        a = p.alpha * (1 - u * u);
        if (a <= 0.01) continue;
        s = Math.max(minWorld, p.size + (p.sizeEnd - p.size) * u);
        var c = Math.cos(p.rot), sn = Math.sin(p.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.css;
        ctx.beginPath();
        ctx.moveTo(p.x + c * s * 1.6, p.y + sn * s * 1.6);
        ctx.lineTo(p.x - c * s * 0.8 - sn * s * 0.9, p.y - sn * s * 0.8 + c * s * 0.9);
        ctx.lineTo(p.x - c * s * 0.8 + sn * s * 0.9, p.y - sn * s * 0.8 - c * s * 0.9);
        ctx.closePath();
        ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';

    for (i = 0; i < pool.length; i++) {
        p = pool[i];
        if (!p.active || p.kind !== KIND_RING) continue;
        u = 1 - p.life / p.maxLife;
        var eased = 1 - (1 - u) * (1 - u) * (1 - u);
        var radius = p.size + (p.sizeEnd - p.size) * eased;
        if (!visible(p, radius + 4)) continue;
        a = p.alpha * (1 - u) * (1 - u * 0.4);
        if (a <= 0.01 || radius <= 0.5) continue;
        var ring = getRingSprite(p.color);
        if (!ring) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(ring, p.x - radius, p.y - radius, radius * 2, radius * 2);
    }

    for (i = 0; i < pool.length; i++) {
        p = pool[i];
        if (!p.active || (p.kind !== KIND_GLOW && p.kind !== KIND_EMBER)) continue;
        u = 1 - p.life / p.maxLife;
        s = Math.max(minWorld * 2, p.size + (p.sizeEnd - p.size) * u);
        if (!visible(p, s)) continue;
        a = p.alpha * (p.kind === KIND_EMBER ? Math.sin(Math.min(1, u * 3) * Math.PI * 0.5) * (1 - u) : (1 - u) * (1 - u));
        if (p.flicker) a *= 1 - p.flicker + p.flicker * (0.5 + 0.5 * Math.sin(time * 18 + p.phase));
        if (a <= 0.01) continue;
        var glow = getGlowSprite(p.color);
        if (!glow) continue;
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.drawImage(glow, p.x - s, p.y - s, s * 2, s * 2);
    }

    ctx.lineCap = 'round';
    for (i = 0; i < pool.length; i++) {
        p = pool[i];
        if (!p.active || p.kind !== KIND_SPARK || !visible(p, 24)) continue;
        u = 1 - p.life / p.maxLife;
        a = p.alpha * (1 - u);
        if (a <= 0.01) continue;
        s = Math.max(minWorld, p.size + (p.sizeEnd - p.size) * u);
        var tx = p.x - p.vx * p.len;
        var ty = p.y - p.vy * p.len;
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.css;
        ctx.lineWidth = s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        // White-hot head: the one detail that makes a line read as a spark.
        if (s > minWorld * 1.2) {
            ctx.globalAlpha = a * 0.8;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = s * 0.45;
            ctx.beginPath();
            ctx.moveTo(p.x - p.vx * p.len * 0.35, p.y - p.vy * p.len * 0.35);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
    }
    ctx.restore();
}

// ── Planet visual state ─────────────────────────────────────────────────────────────

function nodeState(sys, nodeId) {
    var n = sys.nodes[nodeId];
    if (!n) {
        n = { hit: 0, hitColor: '#ffffff', hitDirX: 0, hitDirY: 0, bump: 0, reinforce: 0, reinforceColor: '#ffffff', capture: null };
        sys.nodes[nodeId] = n;
    }
    return n;
}

export function getNodeVfx(sys, nodeId) {
    return sys && sys.nodes ? (sys.nodes[nodeId] || null) : null;
}

export function markNodeHit(sys, nodeId, color, dirX, dirY, strength) {
    if (!sys) return;
    var n = nodeState(sys, nodeId);
    n.hit = Math.min(1, Math.max(n.hit, 0.35 + (Number(strength) || 0) * 0.65));
    n.hitColor = color || '#ffffff';
    n.hitDirX = Number(dirX) || 0;
    n.hitDirY = Number(dirY) || 0;
}

export function markNodeCapture(sys, nodeId, fromColor, toColor, dirX, dirY) {
    if (!sys) return;
    var n = nodeState(sys, nodeId);
    n.capture = {
        age: 0,
        duration: sys.reducedMotion ? 0.25 : 0.7,
        fromColor: fromColor || '#868d99',
        toColor: toColor || '#ffffff',
        dirX: Number(dirX) || 0,
        dirY: Number(dirY) || 0,
    };
    n.bump = 1;
}

export function markNodeReinforced(sys, nodeId, color, strength) {
    if (!sys) return;
    var n = nodeState(sys, nodeId);
    n.reinforce = Math.min(1, Math.max(n.reinforce, 0.4 + (Number(strength) || 0) * 0.6));
    n.reinforceColor = color || '#ffffff';
    n.bump = Math.max(n.bump, 0.35);
}

// ── Recipes ─────────────────────────────────────────────────────────────────────────
// Each recipe is one game event. They take world coordinates and an intensity so the
// same event can be a flicker at the edge of a skirmish or the centrepiece of a capture.

function rnd(sys, lo, hi) {
    return lo + sys.random() * (hi - lo);
}

function scaleCount(sys, n) {
    return sys.reducedMotion ? Math.max(1, Math.round(n * 0.4)) : Math.round(n);
}

export function vfxBurst(sys, x, y, o) {
    if (!sys) return;
    o = o || {};
    var color = o.color || '#ffffff';
    var count = scaleCount(sys, Number(o.count) || 8);
    var hasDir = Number.isFinite(o.dirX) && Number.isFinite(o.dirY) && (o.dirX !== 0 || o.dirY !== 0);
    var baseA = hasDir ? Math.atan2(o.dirY, o.dirX) : 0;
    var spread = Number(o.spread) || TAU;
    var speedMin = Number(o.speedMin) || 60;
    var speedMax = Number(o.speedMax) || 180;
    var lifeMin = Number(o.lifeMin) || 0.3;
    var lifeMax = Number(o.lifeMax) || 0.6;
    var size = Number(o.size) || 1.4;
    var drag = o.drag === undefined ? 0.9 : o.drag;
    for (var i = 0; i < count; i++) {
        var ang = hasDir ? baseA + (sys.random() - 0.5) * spread : sys.random() * TAU;
        var spd = rnd(sys, speedMin, speedMax);
        var life = rnd(sys, lifeMin, lifeMax);
        var vx = Math.cos(ang) * spd, vy = Math.sin(ang) * spd;
        if (o.sparks !== false) {
            emit(sys, KIND_SPARK, x, y, vx, vy, life, size * rnd(sys, 0.7, 1.25), size * 0.3, color, { drag: drag, len: Number(o.len) || 0.035, alpha: o.alpha === undefined ? 0.95 : o.alpha });
        } else {
            emit(sys, KIND_GLOW, x, y, vx, vy, life, size * 2.2, size * 0.6, color, { drag: drag, alpha: o.alpha === undefined ? 0.8 : o.alpha });
        }
    }
}

export function vfxFlash(sys, x, y, radius, color, life, alpha) {
    if (!sys) return;
    emit(sys, KIND_GLOW, x, y, 0, 0, life || 0.3, radius, radius * 1.15, color || '#ffffff', { alpha: alpha === undefined ? 0.9 : alpha });
}

export function vfxRing(sys, x, y, fromRadius, toRadius, color, life, alpha) {
    if (!sys) return;
    emit(sys, KIND_RING, x, y, 0, 0, life || 0.45, fromRadius, toRadius, color || '#ffffff', { alpha: alpha === undefined ? 0.8 : alpha });
}

export function vfxDebris(sys, x, y, color, count, o) {
    if (!sys) return;
    o = o || {};
    count = scaleCount(sys, count || 8);
    for (var i = 0; i < count; i++) {
        var ang = sys.random() * TAU;
        var spd = rnd(sys, Number(o.speedMin) || 40, Number(o.speedMax) || 150);
        var size = rnd(sys, 0.9, 2.1) * (Number(o.scale) || 1);
        emit(sys, KIND_DEBRIS, x + Math.cos(ang) * (o.offset || 0), y + Math.sin(ang) * (o.offset || 0), Math.cos(ang) * spd, Math.sin(ang) * spd,
            rnd(sys, 0.7, 1.4), size, size * 0.4, color, { drag: 0.94, rot: sys.random() * TAU, spin: rnd(sys, -9, 9), alpha: 0.9 });
    }
}

export function vfxEmbers(sys, x, y, color, count, radius) {
    if (!sys) return;
    count = scaleCount(sys, count || 8);
    radius = Number(radius) || 12;
    for (var i = 0; i < count; i++) {
        var ang = sys.random() * TAU;
        var dist = radius * rnd(sys, 0.6, 1.1);
        var spd = rnd(sys, 8, 34);
        emit(sys, KIND_EMBER, x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, Math.cos(ang) * spd, Math.sin(ang) * spd,
            rnd(sys, 0.9, 1.9), rnd(sys, 1.6, 3.2), 0.6, color, { drag: 0.97, alpha: 0.85, flicker: 0.35, phase: sys.random() * TAU });
    }
}

// A world changing hands: the loudest event in the game, and deliberately so.
export function vfxCapture(sys, x, y, radius, color, fromColor, dirX, dirY, intensity) {
    if (!sys) return;
    var r = Math.max(8, Number(radius) || 18);
    var k = Math.max(0.4, Math.min(1.6, Number(intensity) || 1));
    vfxFlash(sys, x, y, r * 2.4 * k, '#ffffff', 0.26, 0.85);
    vfxFlash(sys, x, y, r * 4.2 * k, color, 0.7, 0.55);
    vfxRing(sys, x, y, r * 0.9, r * (3.1 + k), color, 0.62, 0.9);
    vfxRing(sys, x, y, r * 0.5, r * 2.1, '#ffffff', 0.3, 0.7);
    vfxBurst(sys, x, y, {
        color: color, count: 30 * k, speedMin: 120, speedMax: 420 * Math.sqrt(k), lifeMin: 0.3, lifeMax: 0.75,
        size: 1.7, drag: 0.9, len: 0.04, dirX: dirX, dirY: dirY, spread: (dirX || dirY) ? Math.PI * 1.7 : TAU,
    });
    vfxBurst(sys, x, y, { color: '#ffffff', count: 10 * k, speedMin: 200, speedMax: 480, lifeMin: 0.15, lifeMax: 0.35, size: 1.2, drag: 0.88, len: 0.03 });
    if (fromColor) vfxDebris(sys, x, y, fromColor, 10 * k, { offset: r * 0.8, speedMin: 50, speedMax: 170 });
    vfxEmbers(sys, x, y, color, 12 * k, r);
}

// Ships hitting a defended world. `dir` is the direction the fleet was travelling;
// sparks kick back out of the surface.
export function vfxImpact(sys, x, y, color, dirX, dirY, strength) {
    if (!sys) return;
    var k = Math.max(0.2, Math.min(1.5, Number(strength) || 0.5));
    vfxFlash(sys, x, y, 7 + k * 9, color, 0.18, 0.75);
    vfxBurst(sys, x, y, {
        color: color, count: 4 + k * 8, speedMin: 70, speedMax: 240, lifeMin: 0.18, lifeMax: 0.42,
        size: 1.2 + k * 0.5, drag: 0.88, len: 0.035, dirX: -(dirX || 0), dirY: -(dirY || 0), spread: Math.PI * 1.25,
    });
    if (k > 0.9 && !sys.reducedMotion) vfxRing(sys, x, y, 3, 14 + k * 8, color, 0.3, 0.55);
}

// A fleet (or part of one) destroyed in open space: turrets, defence fields, flares.
export function vfxExplosion(sys, x, y, color, size) {
    if (!sys) return;
    var k = Math.max(0.3, Math.min(2, Number(size) || 1));
    vfxFlash(sys, x, y, 10 * k + 6, '#ffffff', 0.16, 0.8);
    vfxFlash(sys, x, y, 18 * k + 8, color, 0.42, 0.6);
    vfxBurst(sys, x, y, { color: color, count: 8 + k * 10, speedMin: 60, speedMax: 260, lifeMin: 0.25, lifeMax: 0.6, size: 1.3, drag: 0.9, len: 0.035 });
    vfxDebris(sys, x, y, color, 3 + k * 4, { speedMin: 30, speedMax: 120, scale: 0.8 });
    if (k > 0.8) vfxRing(sys, x, y, 4, 20 * k + 10, color, 0.4, 0.6);
}

// Friendly ships folding into a garrison: an inward pulse, no sparks, so reinforcing
// never reads as combat.
export function vfxReinforce(sys, x, y, radius, color, strength) {
    if (!sys) return;
    var r = Math.max(8, Number(radius) || 18);
    var k = Math.max(0.2, Math.min(1, Number(strength) || 0.4));
    vfxRing(sys, x, y, r * (1.9 + k * 0.4), r * 1.02, color, 0.4, 0.3 + k * 0.25);
}

export function vfxLaunch(sys, x, y, color, dirX, dirY, strength) {
    if (!sys) return;
    var k = Math.max(0.2, Math.min(1.2, Number(strength) || 0.5));
    vfxFlash(sys, x, y, 6 + k * 8, color, 0.22, 0.5);
    vfxBurst(sys, x, y, {
        color: color, count: 3 + k * 6, speedMin: 30, speedMax: 110, lifeMin: 0.2, lifeMax: 0.45,
        size: 1, drag: 0.9, len: 0.05, dirX: -(dirX || 0), dirY: -(dirY || 0), spread: Math.PI * 0.9,
    });
}

export function vfxFirework(sys, x, y, color) {
    if (!sys) return;
    vfxFlash(sys, x, y, 26, '#ffffff', 0.22, 0.9);
    vfxFlash(sys, x, y, 60, color, 0.9, 0.45);
    vfxRing(sys, x, y, 6, 90, color, 0.9, 0.8);
    vfxBurst(sys, x, y, { color: color, count: 46, speedMin: 90, speedMax: 360, lifeMin: 0.7, lifeMax: 1.5, size: 1.8, drag: 0.94, len: 0.05 });
    vfxEmbers(sys, x, y, color, 18, 26);
}
