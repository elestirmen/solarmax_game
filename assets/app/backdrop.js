// The space behind the map: a procedurally generated nebula baked once per sector seed,
// two tiled star layers with parallax, a handful of live bright stars and the occasional
// shooting star.
//
// Everything expensive happens once, off the frame path. Per frame the backdrop is a
// few dozen drawImage calls, where the old one filled several hundred gradients and arcs.

var TAU = Math.PI * 2;

function makeRng(seed) {
    var s = (Math.floor(Number(seed) || 0) ^ 0x9e3779b9) >>> 0;
    if (!s) s = 1;
    return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Smooth value noise on a hashed lattice. Cheaper than simplex and, for soft gas clouds
// that are upscaled anyway, indistinguishable from it.
function makeValueNoise(rng) {
    var size = 256;
    var perm = new Uint16Array(size * 2);
    var values = new Float32Array(size);
    for (var i = 0; i < size; i++) {
        perm[i] = i;
        values[i] = rng();
    }
    for (var j = size - 1; j > 0; j--) {
        var k = Math.floor(rng() * (j + 1));
        var tmp = perm[j]; perm[j] = perm[k]; perm[k] = tmp;
    }
    for (var m = 0; m < size; m++) perm[m + size] = perm[m];
    return function (x, y) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf);
        var v = yf * yf * (3 - 2 * yf);
        var x0 = xi & 255, y0 = yi & 255;
        var x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
        var a = values[perm[perm[x0] + y0] & 255];
        var b = values[perm[perm[x1] + y0] & 255];
        var c = values[perm[perm[x0] + y1] & 255];
        var d = values[perm[perm[x1] + y1] & 255];
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

function fbm(noise, x, y, octaves) {
    var total = 0, amp = 0.5, freq = 1, norm = 0;
    for (var i = 0; i < octaves; i++) {
        total += noise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
    }
    return total / norm;
}

function smoothstep(a, b, x) {
    var t = (x - a) / (b - a);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
}

// Palettes stay dark and only moderately saturated: the board's six owner colours have
// to stay the brightest thing on screen.
var NEBULA_PALETTES = [
    { a: [34, 88, 190], b: [18, 142, 170], hot: [255, 158, 96], deep: [60, 30, 120] },
    { a: [104, 42, 170], b: [30, 110, 180], hot: [255, 120, 190], deep: [20, 60, 120] },
    { a: [150, 50, 60], b: [40, 80, 170], hot: [255, 186, 110], deep: [70, 20, 90] },
    { a: [20, 120, 130], b: [40, 70, 170], hot: [170, 255, 214], deep: [30, 40, 110] },
];

function createCanvas(w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

/**
 * Start baking the nebula for a sector. `bounds` is the world rectangle the texture
 * covers. The work is split into rows so it can be spread over several frames
 * (advanceNebulaJob) instead of stalling the first frame of a match.
 */
export function createNebulaJob(seed, bounds, opts) {
    opts = opts || {};
    var width = Math.max(64, Math.floor(Number(opts.width) || 480));
    var height = Math.max(40, Math.floor(Number(opts.height) || Math.round(width * (bounds.h / bounds.w))));
    var canvas = createCanvas(width, height);
    var g = canvas ? canvas.getContext('2d') : null;
    if (!g) return null;
    var rng = makeRng(seed);
    var noiseA = makeValueNoise(rng);
    var noiseB = makeValueNoise(rng);
    var noiseC = makeValueNoise(rng);
    return {
        canvas: canvas,
        g: g,
        img: g.createImageData(width, height),
        width: width,
        height: height,
        row: 0,
        bounds: bounds,
        noiseA: noiseA,
        noiseB: noiseB,
        noiseC: noiseC,
        palette: NEBULA_PALETTES[Math.floor(rng() * NEBULA_PALETTES.length) % NEBULA_PALETTES.length],
        ox: rng() * 100,
        oy: rng() * 100,
        // Nebula features are a few hundred world units across regardless of texture size.
        featureScale: 3.2 / Math.max(bounds.w, bounds.h) * 2.2,
        done: false,
    };
}

function bakeNebulaRow(job, py) {
    var data = job.img.data;
    var width = job.width, height = job.height, bounds = job.bounds, palette = job.palette;
    var noiseA = job.noiseA, noiseB = job.noiseB, noiseC = job.noiseC;
    var wy = (py / height) * bounds.h * job.featureScale + job.oy;
    for (var px = 0; px < width; px++) {
        var wx = (px / width) * bounds.w * job.featureScale + job.ox;
        // Domain warping is what turns blobs into filaments.
        var qx = fbm(noiseB, wx * 0.9, wy * 0.9, 3);
        var qy = fbm(noiseB, wx * 0.9 + 5.2, wy * 0.9 + 1.3, 3);
        var density = fbm(noiseA, wx + qx * 2.2, wy + qy * 2.2, 5);
        var cloud = smoothstep(0.42, 0.82, density);
        var tint = smoothstep(0.3, 0.7, fbm(noiseC, wx * 0.6 + 11, wy * 0.6 - 7, 3));
        var dust = smoothstep(0.52, 0.74, fbm(noiseC, wx * 2.6 - 3, wy * 2.6 + 9, 4));
        var glow = cloud * cloud * (1 - dust * 0.75);
        var core = Math.pow(cloud, 5) * (1 - dust);
        var wisps = smoothstep(0.55, 0.62, density) * (1 - smoothstep(0.62, 0.72, density)) * 0.35;
        var haze = wisps + cloud * 0.15;
        var r = (palette.a[0] * (1 - tint) + palette.b[0] * tint) * glow + palette.hot[0] * core * 0.55 + palette.deep[0] * haze;
        var gg = (palette.a[1] * (1 - tint) + palette.b[1] * tint) * glow + palette.hot[1] * core * 0.55 + palette.deep[1] * haze;
        var b = (palette.a[2] * (1 - tint) + palette.b[2] * tint) * glow + palette.hot[2] * core * 0.55 + palette.deep[2] * haze;
        var i = (py * width + px) * 4;
        var k = 0.42;
        data[i] = r * k > 255 ? 255 : r * k;
        data[i + 1] = gg * k > 255 ? 255 : gg * k;
        data[i + 2] = b * k > 255 ? 255 : b * k;
        data[i + 3] = 255;
    }
}

/** Bake rows until `budgetMs` is spent. Returns true once the texture is complete. */
export function advanceNebulaJob(job, budgetMs) {
    if (!job) return true;
    if (job.done) return true;
    var now = typeof performance !== 'undefined' && performance.now ? function () { return performance.now(); } : function () { return Date.now(); };
    var start = now();
    var budget = Math.max(0.5, Number(budgetMs) || 4);
    while (job.row < job.height) {
        bakeNebulaRow(job, job.row);
        job.row++;
        if ((job.row & 3) === 0 && now() - start >= budget) break;
    }
    if (job.row >= job.height) {
        job.g.putImageData(job.img, 0, 0);
        job.img = null;
        job.done = true;
    }
    return job.done;
}

/** Bake the whole nebula at once. Returns { canvas, bounds, palette } or null. */
export function buildNebulaTexture(seed, bounds, opts) {
    var job = createNebulaJob(seed, bounds, opts);
    if (!job) return null;
    while (!advanceNebulaJob(job, 1e9)) { /* bake everything */ }
    return { canvas: job.canvas, bounds: job.bounds, palette: job.palette };
}

/** A square tile of stars that repeats seamlessly. */
export function buildStarTile(seed, opts) {
    opts = opts || {};
    var size = Math.max(64, Math.floor(Number(opts.size) || 512));
    var count = Math.max(1, Math.floor(Number(opts.count) || 200));
    var minR = Number(opts.minRadius) || 0.4;
    var maxR = Number(opts.maxRadius) || 1.2;
    var canvas = createCanvas(size, size);
    var g = canvas ? canvas.getContext('2d') : null;
    if (!g) return null;
    var rng = makeRng(seed);
    var tints = ['#ffffff', '#d9e7ff', '#b7d4ff', '#ffe9c4', '#ffd6d0', '#c8f4ff'];
    for (var i = 0; i < count; i++) {
        var x = rng() * size, y = rng() * size;
        var r = minR + Math.pow(rng(), 2.2) * (maxR - minR);
        var alpha = 0.25 + rng() * 0.7;
        var tint = tints[Math.floor(rng() * tints.length)];
        // Draw at every wrapped position the star can touch so the tile edges are seamless.
        for (var ox = -1; ox <= 1; ox++) {
            for (var oy = -1; oy <= 1; oy++) {
                var sx = x + ox * size, sy = y + oy * size;
                if (sx < -6 || sx > size + 6 || sy < -6 || sy > size + 6) continue;
                if (r > 1.1) {
                    var halo = g.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
                    halo.addColorStop(0, 'rgba(200,220,255,' + (alpha * 0.28) + ')');
                    halo.addColorStop(1, 'rgba(200,220,255,0)');
                    g.fillStyle = halo;
                    g.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
                }
                g.globalAlpha = alpha;
                g.fillStyle = tint;
                g.beginPath();
                g.arc(sx, sy, r, 0, TAU);
                g.fill();
                g.globalAlpha = 1;
            }
        }
    }
    return canvas;
}

export function createBackdropState() {
    return {
        key: '',
        nebula: null,
        nebulaJob: null,
        nebulaFade: 0,
        farTile: null,
        midTile: null,
        brightStars: [],
        shootingStars: [],
        nextShootingAt: 4,
        time: 0,
        rng: makeRng(7),
    };
}

/**
 * Make sure the textures for this sector exist. Cheap when nothing changed.
 * @param {object} state  from createBackdropState()
 * @param {object} opts   { seed, mapWidth, mapHeight }
 */
export function ensureBackdrop(state, opts) {
    var seed = Math.floor(Number(opts.seed) || 1);
    var mapW = Math.max(1, Number(opts.mapWidth) || 1600);
    var mapH = Math.max(1, Number(opts.mapHeight) || 1000);
    var key = seed + ':' + mapW + ':' + mapH;
    if (state.key === key) {
        stepNebulaBake(state, opts.bakeBudgetMs);
        return state;
    }
    state.key = key;
    var bounds = { x: -mapW * 0.75, y: -mapH * 0.75, w: mapW * 2.5, h: mapH * 2.5 };
    state.nebula = null;
    state.nebulaFade = 0;
    state.nebulaJob = createNebulaJob(seed, bounds, { width: Math.max(160, Math.floor(Number(opts.nebulaWidth) || 520)) });
    stepNebulaBake(state, opts.bakeBudgetMs);
    if (!state.farTile) state.farTile = buildStarTile(101, { size: 512, count: 340, minRadius: 0.35, maxRadius: 0.95 });
    if (!state.midTile) state.midTile = buildStarTile(202, { size: 512, count: 70, minRadius: 0.6, maxRadius: 1.6 });
    var rng = makeRng(seed + 17);
    state.brightStars = [];
    for (var i = 0; i < 26; i++) {
        state.brightStars.push({
            x: bounds.x + rng() * bounds.w,
            y: bounds.y + rng() * bounds.h,
            r: 0.9 + rng() * 1.3,
            depth: 0.55 + rng() * 0.3,
            phase: rng() * TAU,
            speed: 0.6 + rng() * 1.4,
            glint: rng() > 0.55 ? 5 + rng() * 9 : 0,
            color: ['#ffffff', '#cfe0ff', '#ffe4bd', '#bfeaff'][Math.floor(rng() * 4)],
        });
    }
    state.shootingStars = [];
    return state;
}

function stepNebulaBake(state, budgetMs) {
    if (!state.nebulaJob) return;
    if (advanceNebulaJob(state.nebulaJob, budgetMs === undefined ? 5 : budgetMs)) {
        state.nebula = { canvas: state.nebulaJob.canvas, bounds: state.nebulaJob.bounds, palette: state.nebulaJob.palette };
        state.nebulaJob = null;
    }
}

function drawTiled(ctx, tile, offsetX, offsetY, width, height, alpha) {
    if (!tile) return;
    var size = tile.width;
    var startX = -(((offsetX % size) + size) % size);
    var startY = -(((offsetY % size) + size) % size);
    ctx.globalAlpha = alpha;
    for (var x = startX; x < width; x += size) {
        for (var y = startY; y < height; y += size) ctx.drawImage(tile, x, y);
    }
    ctx.globalAlpha = 1;
}

/**
 * Screen-space part: base colour, star layers, shooting stars. Call with an identity
 * (CSS-pixel) transform, before the world transform is applied.
 */
export function drawBackdropScreen(ctx, state, opts) {
    var w = opts.width, h = opts.height;
    var cam = opts.cam;
    var dt = Math.max(0, Math.min(0.1, Number(opts.dt) || 0));
    state.time += dt;
    var zoom = Math.max(0.2, Number(cam.zoom) || 1);

    var base = ctx.createLinearGradient(0, 0, w * 0.35, h);
    base.addColorStop(0, '#060b18');
    base.addColorStop(0.55, '#050810');
    base.addColorStop(1, '#030509');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Distant stars barely move and do not scale: that is what makes them read as far.
    var farShift = 0.04 + (zoom - 1) * 0.01;
    drawTiled(ctx, state.farTile, cam.x * farShift * zoom, cam.y * farShift * zoom, w, h, 0.85);
    drawTiled(ctx, state.midTile, cam.x * 0.11 * zoom, cam.y * 0.11 * zoom, w, h, 0.9);

    if (opts.motion !== false) {
        if (state.time >= state.nextShootingAt) {
            state.nextShootingAt = state.time + 7 + state.rng() * 11;
            var fromLeft = state.rng() > 0.5;
            var angle = (fromLeft ? 0.35 : Math.PI - 0.35) + (state.rng() - 0.5) * 0.4;
            state.shootingStars.push({
                x: w * (0.1 + state.rng() * 0.8),
                y: h * (0.05 + state.rng() * 0.35),
                vx: Math.cos(angle) * (520 + state.rng() * 380),
                vy: Math.sin(angle) * (520 + state.rng() * 380),
                life: 0.9,
                maxLife: 0.9,
            });
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (var i = state.shootingStars.length - 1; i >= 0; i--) {
            var s = state.shootingStars[i];
            s.life -= dt;
            if (s.life <= 0) { state.shootingStars.splice(i, 1); continue; }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            var u = s.life / s.maxLife;
            var a = Math.sin(u * Math.PI) * 0.8;
            var tailX = s.x - s.vx * 0.09, tailY = s.y - s.vy * 0.09;
            var grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
            grad.addColorStop(0, 'rgba(160,200,255,0)');
            grad.addColorStop(1, 'rgba(235,245,255,' + a + ')');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
        }
        ctx.restore();
    }
}

/**
 * World-space part: nebula and bright stars, with parallax. Call inside the world
 * transform. `glowSprite(color)` returns a cached additive glow sprite.
 */
export function drawBackdropWorld(ctx, state, opts) {
    var cam = opts.cam;
    var tick = Number(opts.tick) || 0;
    var halfW = opts.halfWidth, halfH = opts.halfHeight;
    var nebula = state.nebula;
    if (nebula && nebula.canvas) {
        // Fades in once baked, so a sector's gas clouds arrive rather than pop.
        state.nebulaFade = Math.min(1, state.nebulaFade + Math.max(0, Number(opts.dt) || 0.016) * 1.6);
        // Parallax: the nebula sits a little further away than the planets.
        var depth = 0.86;
        var b = nebula.bounds;
        var px = cam.x * (1 - depth);
        var py = cam.y * (1 - depth);
        ctx.save();
        ctx.globalAlpha = state.nebulaFade * state.nebulaFade * (3 - 2 * state.nebulaFade);
        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(nebula.canvas, b.x + px, b.y + py, b.w, b.h);
        ctx.restore();
    }
    var glow = typeof opts.glowSprite === 'function' ? opts.glowSprite : null;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < state.brightStars.length; i++) {
        var star = state.brightStars[i];
        var sx = star.x + cam.x * (1 - star.depth);
        var sy = star.y + cam.y * (1 - star.depth);
        if (Math.abs(sx - cam.x) > halfW + 30 || Math.abs(sy - cam.y) > halfH + 30) continue;
        var tw = 0.6 + 0.4 * Math.sin(tick * 0.03 * star.speed + star.phase);
        var zoom = Math.max(0.2, Number(cam.zoom) || 1);
        // Keep bright stars roughly constant on screen instead of ballooning on zoom.
        var r = star.r / Math.sqrt(zoom);
        if (glow) {
            var sprite = glow(star.color);
            if (sprite) {
                ctx.globalAlpha = 0.55 * tw;
                ctx.drawImage(sprite, sx - r * 5, sy - r * 5, r * 10, r * 10);
            }
        }
        if (star.glint > 0) {
            var gl = star.glint / Math.sqrt(zoom) * (0.7 + tw * 0.3);
            ctx.globalAlpha = 0.35 * tw;
            ctx.strokeStyle = star.color;
            ctx.lineWidth = 0.8 / zoom;
            ctx.beginPath();
            ctx.moveTo(sx - gl, sy);
            ctx.lineTo(sx + gl, sy);
            ctx.moveTo(sx, sy - gl * 0.7);
            ctx.lineTo(sx, sy + gl * 0.7);
            ctx.stroke();
        }
    }
    ctx.restore();
}

export function drawVignette(ctx, w, h, strength) {
    var k = Number(strength);
    if (!Number.isFinite(k)) k = 1;
    var vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.7, 'rgba(1,3,8,' + (0.18 * k) + ')');
    vignette.addColorStop(1, 'rgba(1,2,6,' + (0.62 * k) + ')');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}
