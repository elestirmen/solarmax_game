function drawGridLayer(ctx, game, hw, hh) {
    var spacing = 100;
    var startX = Math.floor((game.cam.x - hw) / spacing) * spacing;
    var startY = Math.floor((game.cam.y - hh) / spacing) * spacing;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (var x = startX; x <= game.cam.x + hw; x += spacing) {
        for (var y = startY; y <= game.cam.y + hh; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawDefenseRangeLayer(ctx, game, tick, constants, helpers) {
    for (var tr = 0; tr < game.nodes.length; tr++) {
        var turretNode = game.nodes[tr];
        if (turretNode.kind !== 'turret') continue;
        var turretVisible = !game.tune.fogEnabled || turretNode.owner === game.human || !!game.fog.vis[game.human][turretNode.id];
        if (!turretVisible) continue;
        var turretCol = turretNode.owner >= 0 && game.players[turretNode.owner] ? game.players[turretNode.owner].color : constants.nodeTypeDefs.turret.color;
        ctx.beginPath();
        ctx.arc(turretNode.pos.x, turretNode.pos.y, constants.turretRange, 0, Math.PI * 2);
        ctx.strokeStyle = helpers.hexToRgba(turretCol, 0.16);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }

}

function drawFlowLinksLayer(ctx, game, constants, helpers) {
    for (var i = 0; i < game.flows.length; i++) {
        var fl = game.flows[i];
        if (!fl.active) continue;
        var sn = game.nodes[fl.srcId];
        var tn = game.nodes[fl.tgtId];
        if (game.tune.fogEnabled && fl.owner !== game.human && !game.fog.vis[game.human][fl.srcId] && !game.fog.vis[game.human][fl.tgtId]) continue;
        var col = game.players[fl.owner] ? game.players[fl.owner].color : constants.colNeutral;
        var cp = helpers.bezCP(sn.pos, tn.pos);
        ctx.beginPath();
        ctx.moveTo(sn.pos.x, sn.pos.y);
        ctx.quadraticCurveTo(cp.x, cp.y, tn.pos.x, tn.pos.y);
        ctx.strokeStyle = helpers.hexToRgba(col, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawFleetsAndBeamsLayer(ctx, game, tick, inputState, hw, hh, constants, helpers) {
    var fhw = hw + 30;
    var fhh = hh + 30;
    for (var i = 0; i < game.fleets.length; i++) {
        var fleet = game.fleets[i];
        if (!fleet.active) continue;
        if (game.tune.fogEnabled && fleet.owner !== game.human && !helpers.fleetVis(fleet, game.human, game.nodes)) continue;
        if (Math.abs(fleet.x - game.cam.x) > fhw || Math.abs(fleet.y - game.cam.y) > fhh) continue;
        var col = game.players[fleet.owner] ? game.players[fleet.owner].color : constants.colNeutral;
        if (fleet.holding) {
            helpers.drawHoldingFleet(ctx, fleet, col, tick, inputState.selFleets.has(fleet.id));
            continue;
        }
        if (fleet.t <= 0) continue;
        helpers.drawFleetRocket(ctx, fleet, col, tick);
    }

    for (var bi = 0; bi < game.turretBeams.length; bi++) {
        var beam = game.turretBeams[bi];
        var beamAlpha = helpers.clamp(beam.life / Math.max(beam.maxLife, 0.0001), 0, 1);
        var beamCol = beam.owner >= 0 && game.players[beam.owner] ? game.players[beam.owner].color : constants.nodeTypeDefs.turret.color;
        ctx.beginPath();
        ctx.moveTo(beam.fromX, beam.fromY);
        ctx.lineTo(beam.toX, beam.toY);
        ctx.strokeStyle = helpers.hexToRgba(beamCol, 0.18 * beamAlpha);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(beam.fromX, beam.fromY);
        ctx.lineTo(beam.toX, beam.toY);
        ctx.strokeStyle = helpers.hexToRgba('#ffffff', 0.75 * beamAlpha);
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(beam.toX, beam.toY, 1.6 + beamAlpha * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = helpers.hexToRgba('#ffffff', 0.55 * beamAlpha);
        ctx.fill();
    }

    for (var fbi = 0; fbi < game.fieldBeams.length; fbi++) {
        var fieldBeam = game.fieldBeams[fbi];
        var fieldBeamAlpha = helpers.clamp(fieldBeam.life / Math.max(fieldBeam.maxLife, 0.0001), 0, 1);
        var fieldBeamCol = fieldBeam.owner >= 0 && game.players[fieldBeam.owner] ? game.players[fieldBeam.owner].color : '#8db3ff';
        ctx.beginPath();
        ctx.moveTo(fieldBeam.fromX, fieldBeam.fromY);
        ctx.lineTo(fieldBeam.toX, fieldBeam.toY);
        ctx.strokeStyle = helpers.hexToRgba(fieldBeamCol, 0.22 * fieldBeamAlpha);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(fieldBeam.toX, fieldBeam.toY, 1.2 + fieldBeamAlpha, 0, Math.PI * 2);
        ctx.fillStyle = helpers.hexToRgba('#ffffff', 0.45 * fieldBeamAlpha);
        ctx.fill();
    }
}

function drawNodesLayer(ctx, game, tick, constants, helpers) {
    for (var i = 0; i < game.nodes.length; i++) {
        var n = game.nodes[i];
        var vis = !game.tune.fogEnabled || !!game.fog.vis[game.human][n.id];
        var col;
        var dUnits;
        if (n.owner === -1) col = constants.colNeutral;
        else if (vis || n.owner === game.human) col = game.players[n.owner] ? game.players[n.owner].color : constants.colNeutral;
        else {
            var ls = game.fog.ls[game.human][n.id];
            col = (ls.tick >= 0 && ls.owner >= 0) ? helpers.darken(game.players[ls.owner] ? game.players[ls.owner].color : constants.colNeutral, 40) : constants.colFog;
        }
        if (vis || n.owner === game.human) dUnits = '' + Math.floor(n.units);
        else {
            var ls2 = game.fog.ls[game.human][n.id];
            dUnits = ls2.tick >= 0 ? '' + ls2.units : '?';
        }

        if (n.selected && n.owner === game.human) {
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        if ((vis || n.owner === game.human) && n.owner >= 0 && n.supplied === false) {
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,100,100,0.35)';
            ctx.setLineDash([2, 3]);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if ((vis || n.owner === game.human) && n.defense) {
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.textAlign = 'center';
            ctx.fillText('\u26E8', n.pos.x, n.pos.y - n.radius - 4);
        }
        if ((vis || n.owner === game.human) && n.strategic) {
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,0,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (helpers.strategicPulseAppliesToNode(n.id)) {
                var pulseGlow = 0.45 + Math.sin(tick * 0.12 + n.id) * 0.2;
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, n.radius + 9, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,230,120,' + pulseGlow + ')';
                ctx.lineWidth = 2.2;
                ctx.stroke();
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,235,170,0.95)';
                ctx.textAlign = 'center';
                ctx.fillText('PULSE', n.pos.x, n.pos.y - n.radius - 10);
            }
        }

        var gateVisible = n.gate && (vis || n.owner === game.human || (game.mapFeature && game.mapFeature.type === 'barrier'));
        if (gateVisible) {
            var gatePulse = 0.55 + 0.45 * Math.sin(tick * 0.08 + n.id);
            var gateAlpha = (vis || n.owner === game.human) ? 0.95 : 0.62;
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 9, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,220,140,' + (0.28 + gatePulse * 0.24) * gateAlpha + ')';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(n.pos.x, n.pos.y - n.radius - 8);
            ctx.lineTo(n.pos.x + 5, n.pos.y - n.radius - 2);
            ctx.lineTo(n.pos.x, n.pos.y - n.radius + 4);
            ctx.lineTo(n.pos.x - 5, n.pos.y - n.radius - 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,220,140,' + gateAlpha + ')';
            ctx.fill();
            ctx.font = 'bold 10px Outfit,sans-serif';
            ctx.fillStyle = 'rgba(255,232,180,' + gateAlpha + ')';
            ctx.textAlign = 'center';
            ctx.fillText('GATE', n.pos.x, n.pos.y + n.radius + 13);
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.encounterType) {
            var encounterPulse = 0.58 + 0.42 * Math.sin(tick * 0.07 + n.id * 0.9);
            var encounterCol = n.encounterType === 'mega_turret' ? 'rgba(255,196,132,' : 'rgba(130,238,255,';
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, n.radius + 12, 0, Math.PI * 2);
            ctx.strokeStyle = encounterCol + (0.24 + encounterPulse * 0.18) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = 'bold 9px Outfit,sans-serif';
            ctx.fillStyle = encounterCol + '0.92)';
            ctx.textAlign = 'center';
            ctx.fillText(n.encounterType === 'mega_turret' ? 'BOSS' : 'CORE', n.pos.x, n.pos.y - n.radius - 16);
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.owner >= 0 && n.assimilationProgress !== undefined && n.assimilationProgress < 1) {
            var ringR = n.radius + 7;
            var lockPhase = (n.assimilationLock || 0) > 0 ? (1 - helpers.clamp((n.assimilationLock || 0) / constants.assimLockTicks, 0, 1)) : 1;
            var assimPhase = helpers.clamp(n.assimilationProgress || 0, 0, 1);
            var prog = helpers.clamp(lockPhase * 0.5 + assimPhase * 0.5, 0, 1);
            var pulse = 0.8 + Math.sin(tick * 0.09 + n.id * 0.7) * 0.2;

            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, ringR, 0, Math.PI * 2, false);
            ctx.strokeStyle = helpers.hexToRgba(col, 0.16 + 0.12 * pulse);
            ctx.lineWidth = 1.6;
            ctx.stroke();

            /* Kesikli iz halkasi yalniz turret (menzil halkasiyla tutarli); gezegenlerde ust uste binen dash kaldirildi. */
            if (n.kind === 'turret') {
                ctx.save();
                ctx.setLineDash([5, 4]);
                ctx.lineDashOffset = -tick * 0.7;
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, ringR, 0, Math.PI * 2, false);
                ctx.strokeStyle = helpers.hexToRgba(col, 0.36);
                ctx.lineWidth = 1.1;
                ctx.stroke();
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, false);
            ctx.strokeStyle = helpers.hexToRgba(col, 0.82);
            ctx.lineWidth = 2.8;
            ctx.lineCap = 'round';
            ctx.stroke();

            var endA = -Math.PI / 2 + Math.PI * 2 * prog;
            var ex = n.pos.x + Math.cos(endA) * ringR;
            var ey = n.pos.y + Math.sin(endA) * ringR;
            ctx.beginPath();
            ctx.arc(ex, ey, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fill();
        }

        var hasOrbiters = (vis || n.owner === game.human) && n.owner >= 0 && n.kind !== 'turret';
        var orbitalSquads = [];
        if (hasOrbiters) {
            orbitalSquads = helpers.getNodeOrbitalSquads(n);
            hasOrbiters = orbitalSquads.length > 0;
        }
        if (hasOrbiters) {
            for (var osi = 0; osi < orbitalSquads.length; osi++) helpers.drawOrbitalSquadron(ctx, n, orbitalSquads[osi], col, tick, false);
        }

        var tdef = helpers.nodeTypeOf(n);
        if (n.kind === 'turret') {
            helpers.drawTurretStation(ctx, n, col, tick);
        } else {
            var bodyCol = col;
            if ((vis || n.owner === game.human) && col.indexOf('#') === 0) {
                var typeBlend = n.owner === -1 ? 0.5 : 0.22;
                bodyCol = helpers.blendHex(col, tdef.color, typeBlend);
            }
            var planetCanvas = helpers.getPlanetTexture(n.id, n.radius);
            ctx.save();
            if (!vis && n.owner !== game.human) {
                ctx.globalAlpha = 0.3;
                ctx.filter = 'grayscale(100%) brightness(50%)';
            }
            ctx.drawImage(planetCanvas, n.pos.x - n.radius, n.pos.y - n.radius, n.radius * 2, n.radius * 2);
            ctx.restore();
            if ((vis || n.owner === game.human) && n.owner >= 0 && col && col.indexOf('#') === 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, n.radius, 0, Math.PI * 2);
                ctx.clip();
                var tint = ctx.createRadialGradient(n.pos.x - n.radius * 0.3, n.pos.y - n.radius * 0.3, 0, n.pos.x, n.pos.y, n.radius * 1.2);
                tint.addColorStop(0, helpers.hexToRgba(col, 0.35));
                tint.addColorStop(0.7, helpers.hexToRgba(col, 0.15));
                tint.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = tint;
                ctx.fillRect(n.pos.x - n.radius, n.pos.y - n.radius, n.radius * 2, n.radius * 2);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, n.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = helpers.hexToRgba(col, 0.9);
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        }

        if ((vis || n.owner === game.human) && n.level > 1) {
            for (var lv = 1; lv < n.level; lv++) {
                var la = -Math.PI / 2 + (lv - 1) * 0.5;
                var lx = n.pos.x + Math.cos(la) * (n.radius + 5);
                var ly = n.pos.y + Math.sin(la) * (n.radius + 5);
                ctx.beginPath();
                ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.fill();
            }
        }

        if (hasOrbiters) {
            for (var osj = 0; osj < orbitalSquads.length; osj++) helpers.drawOrbitalSquadron(ctx, n, orbitalSquads[osj], col, tick, true);
        }

        ctx.font = 'bold ' + Math.max(11, n.radius * 0.5) + 'px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var unitFill = '#fff';
        var unitStroke = 'rgba(6,10,16,0.78)';
        if (!vis && n.owner !== game.human) {
            unitFill = dUnits === '?' ? '#555' : '#777';
            unitStroke = 'rgba(6,10,16,0.45)';
        } else if (n.kind === 'turret') {
            unitFill = '#f7fbff';
            unitStroke = 'rgba(4,8,14,0.96)';
        }
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = n.kind === 'turret' ? 4.5 : 3.2;
        ctx.strokeStyle = unitStroke;
        ctx.strokeText(dUnits, n.pos.x, n.pos.y);
        ctx.fillStyle = unitFill;
        ctx.fillText(dUnits, n.pos.x, n.pos.y);
        ctx.shadowBlur = 0;

        if (vis || n.owner === game.human) {
            helpers.drawTypeBadge(ctx, n, helpers.nodeTypeOf(n));
            if (n.level > 1) {
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                ctx.fillText('L' + n.level, n.pos.x, n.pos.y - n.radius * 0.66);
            }
        }
    }
}

function drawParticleLayer(ctx, game, tick, inputState, constants, helpers) {
    for (var pi = 0; pi < game.particles.length; pi++) {
        var p = game.particles[pi];
        var alpha = p.life / p.maxLife;
        if ((p.glow || 0) > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (1.8 + p.glow), 0, Math.PI * 2);
            ctx.fillStyle = helpers.hexToRgba(p.col, alpha * p.glow * 0.45);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = helpers.hexToRgba(p.col, alpha);
        ctx.fill();
    }

    for (var swi = 0; swi < game.shockwaves.length; swi++) {
        var wave = game.shockwaves[swi];
        var lifeAlpha = helpers.clamp(wave.life / Math.max(wave.maxLife, 0.0001), 0, 1);
        var progress = 1 - lifeAlpha;
        var radius = (Number(wave.radius) || 0) + (Number(wave.grow) || 0) * progress;
        if ((Number(wave.fillAlpha) || 0) > 0) {
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = helpers.hexToRgba(wave.col || '#ffffff', wave.fillAlpha * lifeAlpha);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = helpers.hexToRgba(wave.col || '#ffffff', (Number(wave.alpha) || 0.3) * lifeAlpha);
        ctx.lineWidth = (Number(wave.lineWidth) || 1.4) * (1 + progress * 0.3);
        ctx.stroke();
    }

    if (inputState.dragActive) {
        var ds = inputState.dragStart;
        var de = inputState.dragEnd;
        var dcp = helpers.bezCP(ds, de, constants.bezierCurve * 0.7);
        ctx.beginPath();
        ctx.moveTo(ds.x, ds.y);
        ctx.quadraticCurveTo(dcp.x, dcp.y, de.x, de.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

export function renderWorldLayers(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var ctx = opts.ctx;
    var cv = opts.canvas;
    var tick = opts.tick;
    var game = opts.game;
    var inputState = opts.inputState;
    var constants = opts.constants || {};
    var helpers = opts.helpers || {};

    var hw = cv.width / 2 / game.cam.zoom;
    var hh = cv.height / 2 / game.cam.zoom;

    helpers.drawWorldBackdrop(ctx, tick, hw, hh);
    drawGridLayer(ctx, game, hw, hh);
    helpers.drawMapFeature(ctx, tick);
    helpers.drawTerritories(ctx, tick);
    drawDefenseRangeLayer(ctx, game, tick, constants, helpers);
    drawFlowLinksLayer(ctx, game, constants, helpers);
    drawFleetsAndBeamsLayer(ctx, game, tick, inputState, hw, hh, constants, helpers);
    drawNodesLayer(ctx, game, tick, constants, helpers);
    drawParticleLayer(ctx, game, tick, inputState, constants, helpers);
}

export function renderMinimapLayer(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var canvas = opts.minimapCanvas;
    var wrapper = opts.minimapWrapper;
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var game = opts.game;
    var viewportCanvas = opts.viewportCanvas;
    var constants = opts.constants || {};
    if (!canvas || !ctx || !(game.state === 'playing' || game.state === 'paused') || game.nodes.length <= 0) {
        if (wrapper) wrapper.classList.add('hidden');
        return;
    }

    canvas.width = 140;
    canvas.height = 90;
    var scale = Math.min(canvas.width / constants.mapWidth, canvas.height / constants.mapHeight);
    var mx = canvas.width / 2 - game.cam.x * scale;
    var my = canvas.height / 2 - game.cam.y * scale;
    ctx.fillStyle = 'rgba(8,12,21,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(scale, scale);
    for (var i = 0; i < game.nodes.length; i++) {
        var mn = game.nodes[i];
        var mcol = mn.owner < 0 ? '#5a6272' : (game.players[mn.owner] ? game.players[mn.owner].color : '#888');
        ctx.fillStyle = mcol;
        ctx.beginPath();
        ctx.arc(mn.pos.x, mn.pos.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    var vw = (viewportCanvas.width / game.cam.zoom) * scale;
    var vh = (viewportCanvas.height / game.cam.zoom) * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(canvas.width / 2 - vw / 2, canvas.height / 2 - vh / 2, vw, vh);
    if (wrapper) wrapper.classList.remove('hidden');
}

export function renderMarqueeLayer(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var ctx = opts.ctx;
    var inputState = opts.inputState;
    if (!inputState.marqActive) return;

    var mx = Math.min(inputState.marqStart.x, inputState.marqEnd.x);
    var my = Math.min(inputState.marqStart.y, inputState.marqEnd.y);
    var mw = Math.abs(inputState.marqEnd.x - inputState.marqStart.x);
    var mh = Math.abs(inputState.marqEnd.y - inputState.marqStart.y);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(74,142,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.fillStyle = 'rgba(74,142,255,0.06)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.restore();
}
