import { getSolarFlareFrame } from '../sim/solar_flare.js';

function nodeIsWormholeEndpoint(game, nodeId) {
    var links = game && Array.isArray(game.wormholes) ? game.wormholes : [];
    for (var wi = 0; wi < links.length; wi++) {
        var w = links[wi];
        if (!w) continue;
        if (w.a === nodeId || w.b === nodeId) return true;
    }
    return false;
}

function traceRoundedPill(ctx, x, y, w, h) {
    var r = Math.min(h * 0.5, w * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawGateFallback(ctx, node, col, helpers) {
    var stroke = col && col.indexOf('#') === 0 ? col : '#f0be6a';
    var rgba = typeof helpers.hexToRgba === 'function'
        ? helpers.hexToRgba
        : function (hex, alpha) { return hex === stroke ? 'rgba(240,190,106,' + alpha + ')' : 'rgba(255,255,255,' + alpha + ')'; };
    var r = Math.max(8, Number(node.radius) || 12);
    var spineHalfH = r + 26;
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.pos.x, node.pos.y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(stroke, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(node.pos.x, node.pos.y, r * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#fff0c7', 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(node.pos.x, node.pos.y - spineHalfH);
    ctx.lineTo(node.pos.x, node.pos.y + spineHalfH);
    ctx.strokeStyle = rgba(stroke, 0.42);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
}

function drawSolarFlareCorona(ctx, game, tick, constants) {
    var cfg = constants.solarFlare;
    if (!cfg || !game || (game.state !== 'playing' && game.state !== 'paused')) return;
    var frame = getSolarFlareFrame(tick, game.seed, cfg);
    if (frame.phase !== 'warn') return;
    var mw = Number(constants.mapWidth) || 1600;
    var mh = Number(constants.mapHeight) || 1000;
    var cx = mw * 0.5;
    var cy = mh * 0.5;
    var u = Number(frame.warnProgress) || 0;
    var throb = 0.65 + 0.35 * Math.sin(tick * 0.31);
    var r = (Math.min(mw, mh) * 0.22) * (0.85 + u * 0.35) * throb;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    g.addColorStop(0, 'rgba(255,250,220,' + (0.35 + u * 0.25) + ')');
    g.addColorStop(0.55, 'rgba(255,140,40,' + (0.12 + u * 0.18) + ')');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1.05 + u * 0.08), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,160,' + (0.22 + u * 0.2) + ')';
    ctx.lineWidth = 2 + u * 2;
    ctx.stroke();
    ctx.restore();
}

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

/** Wormhole sevkiyat — ışınlanma anı: tünel, enerji başı, dönen portal kıvılcımları */
function drawWormholeTeleportBeam(ctx, beam, lifeAlpha, ownerColor, tick, helpers) {
    var fx = beam.fromX, fy = beam.fromY, tx = beam.toX, ty = beam.toY;
    var u = 1 - lifeAlpha;
    var spawnPhase = Number(beam.spawnTick) || 0;
    var flick = 0.6 + 0.4 * Math.sin((tick - spawnPhase) * 0.88);
    var headT = 1 - Math.pow(1 - u, 2.15);
    if (headT > 1) headT = 1;
    var hx = fx + (tx - fx) * headT;
    var hy = fy + (ty - fy) * headT;
    var burstA = lifeAlpha * (1 - u * 0.88);
    var rSpin = (tick - spawnPhase) * 0.15;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(95, 60, 240,' + (0.26 * lifeAlpha * flick) + ')';
    ctx.lineWidth = 24 + 11 * u;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.strokeStyle = helpers.hexToRgba(ownerColor, 0.32 * lifeAlpha);
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(150, 245, 255,' + (0.36 * lifeAlpha) + ')';
    ctx.lineWidth = 5.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = 'rgba(255, 248, 225,' + (0.82 * lifeAlpha) + ')';
    ctx.lineWidth = 3.6;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255,' + (0.93 * lifeAlpha) + ')';
    ctx.lineWidth = 1.45;
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var dashUnit = 12;
    ctx.setLineDash([dashUnit * 0.5, dashUnit * 0.95]);
    ctx.lineDashOffset = -((tick - spawnPhase) * 7) % (dashUnit * 2.9);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(255, 255, 255,' + (0.38 * lifeAlpha * flick) + ')';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var pi;
    for (pi = 0; pi < 3; pi++) {
        var a0 = rSpin + pi * (Math.PI * 2 / 3);
        var pr = 5 + u * 27;
        ctx.beginPath();
        ctx.arc(fx, fy, pr, a0, a0 + 1.12);
        ctx.strokeStyle = 'rgba(205, 180, 255,' + (0.52 * burstA) + ')';
        ctx.lineWidth = 2.3;
        ctx.stroke();
    }
    var rSpin2 = -rSpin * 1.08;
    for (pi = 0; pi < 3; pi++) {
        var b0 = rSpin2 + pi * (Math.PI * 2 / 3);
        var pr2 = 6 + u * 31;
        ctx.beginPath();
        ctx.arc(tx, ty, pr2, b0, b0 + 1.05);
        ctx.strokeStyle = 'rgba(255, 210, 140,' + (0.5 * burstA) + ')';
        ctx.lineWidth = 2.05;
        ctx.stroke();
    }
    ctx.restore();

    var coreR = 2.8 + (1 - u) * 5 + flick * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var g = ctx.createRadialGradient(hx, hy, 0, hx, hy, coreR * 3.1);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.96 * lifeAlpha) + ')');
    g.addColorStop(0.4, 'rgba(190, 238, 255,' + (0.48 * lifeAlpha) + ')');
    g.addColorStop(1, 'rgba(110, 70, 220, 0)');
    ctx.beginPath();
    ctx.arc(hx, hy, coreR * 2.9, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(fx, fy, 2.4 + lifeAlpha * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(225, 200, 255,' + (0.7 * lifeAlpha) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx, ty, 2.6 + lifeAlpha * 2.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 234, 195,' + (0.72 * lifeAlpha) + ')';
    ctx.fill();
}

function drawFleetsAndBeamsLayer(ctx, game, tick, inputState, hw, hh, constants, helpers) {
    var fhw = hw + 30;
    var fhh = hh + 30;
    for (var i = 0; i < game.fleets.length; i++) {
        var fleet = game.fleets[i];
        if (!fleet.active) continue;
        if (game.tune.fogEnabled && fleet.owner !== game.human && !helpers.fleetVis(fleet, game.human, game.nodes)) continue;
        var renderState = helpers.getFleetRenderState ? helpers.getFleetRenderState(fleet) : fleet;
        var fleetX = Number(renderState.x);
        var fleetY = Number(renderState.y);
        if (!Number.isFinite(fleetX)) fleetX = Number(fleet.x) || 0;
        if (!Number.isFinite(fleetY)) fleetY = Number(fleet.y) || 0;
        if (Math.abs(fleetX - game.cam.x) > fhw || Math.abs(fleetY - game.cam.y) > fhh) continue;
        var col = game.players[fleet.owner] ? game.players[fleet.owner].color : constants.colNeutral;
        if (fleet.holding) {
            helpers.drawHoldingFleet(ctx, fleet, col, tick, inputState.selFleets.has(fleet.id), renderState);
            continue;
        }
        if ((Number.isFinite(renderState.t) ? renderState.t : fleet.t) <= 0) continue;
        helpers.drawFleetRocket(ctx, fleet, col, tick, renderState);
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
        var isWh = fieldBeam.wormholeFlash === true;
        if (isWh) {
            drawWormholeTeleportBeam(ctx, fieldBeam, fieldBeamAlpha, fieldBeamCol, tick, helpers);
            continue;
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fieldBeam.fromX, fieldBeam.fromY);
        ctx.lineTo(fieldBeam.toX, fieldBeam.toY);
        ctx.strokeStyle = helpers.hexToRgba(fieldBeamCol, 0.22 * fieldBeamAlpha);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(fieldBeam.fromX, fieldBeam.fromY);
        ctx.lineTo(fieldBeam.toX, fieldBeam.toY);
        ctx.strokeStyle = helpers.hexToRgba('#ffffff', 0.45 * fieldBeamAlpha);
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(fieldBeam.toX, fieldBeam.toY, 1.2 + fieldBeamAlpha, 0, Math.PI * 2);
        ctx.fillStyle = helpers.hexToRgba('#ffffff', 0.45 * fieldBeamAlpha);
        ctx.fill();
    }
}

function drawNodesLayer(ctx, game, tick, constants, helpers) {
    var getNodeVisualScale = typeof helpers.getNodeVisualScale === 'function' ? helpers.getNodeVisualScale : function () { return 1; };
    var getNodeUpgradeProgress = typeof helpers.getNodeUpgradeProgress === 'function' ? helpers.getNodeUpgradeProgress : function () { return 0; };
    var isNodeUpgradePending = typeof helpers.isNodeUpgradePending === 'function' ? helpers.isNodeUpgradePending : function () { return false; };
    for (var i = 0; i < game.nodes.length; i++) {
        var n = game.nodes[i];
        var vis = !game.tune.fogEnabled || !!game.fog.vis[game.human][n.id];
        var visualScale = Math.max(1, Number(getNodeVisualScale(n, tick)) || 1);
        var drawRadius = Math.max(1, (Number(n.radius) || 0) * visualScale);
        var drawNode = visualScale === 1 ? n : {
            id: n.id,
            owner: n.owner,
            kind: n.kind,
            pos: n.pos,
            radius: drawRadius,
            defense: n.defense,
            level: n.level,
            units: n.units,
        };
        var upgrading = isNodeUpgradePending(n, tick);
        var upgradeProgress = upgrading ? helpers.clamp(getNodeUpgradeProgress(n, tick), 0, 1) : 0;
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
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        if ((vis || n.owner === game.human) && n.owner >= 0 && n.supplied === false) {
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 3, 0, Math.PI * 2);
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
            ctx.fillText('\u26E8', n.pos.x, n.pos.y - drawRadius - 4);
        }
        var whEnd = nodeIsWormholeEndpoint(game, n.id);
        if ((vis || n.owner === game.human) && whEnd) {
            var bhPhase = tick * 0.098 + n.id * 0.71;
            var cx = n.pos.x;
            var cy = n.pos.y;
            var r = drawRadius;
            var diskOut = r + 21 + Math.sin(bhPhase * 1.05) * 1.8;
            ctx.save();
            var gravHalo = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, diskOut);
            gravHalo.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gravHalo.addColorStop(0.55, 'rgba(55, 20, 95, 0.14)');
            gravHalo.addColorStop(0.78, 'rgba(180, 70, 30, 0.11)');
            gravHalo.addColorStop(0.9, 'rgba(255, 190, 110, 0.1)');
            gravHalo.addColorStop(1, 'rgba(15, 8, 35, 0)');
            ctx.fillStyle = gravHalo;
            ctx.beginPath();
            ctx.arc(cx, cy, diskOut, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'screen';
            for (var wi = 0; wi < 6; wi++) {
                var bandR = r + 3.2 + wi * 2.4 + Math.sin(bhPhase + wi * 0.95) * 1.1;
                var a0 = bhPhase * 0.74 + wi * 0.88;
                var a1 = a0 + Math.PI * (1.15 + (wi % 3) * 0.08);
                var br = 220 - wi * 22;
                var bg = 70 + wi * 28;
                var bb = 40 + wi * 14;
                ctx.beginPath();
                ctx.arc(cx, cy, bandR, a0, a1);
                ctx.strokeStyle = 'rgba(' + br + ',' + bg + ',' + bb + ',' + (0.18 + wi * 0.045) + ')';
                ctx.lineWidth = 2.4 - wi * 0.28;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.arc(cx, cy, r + 5.5 + Math.sin(bhPhase * 1.2) * 0.6, bhPhase * 0.3, bhPhase * 0.3 + Math.PI * 1.6);
            ctx.strokeStyle = 'rgba(255, 230, 200, 0.14)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.strategic) {
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,0,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (helpers.strategicPulseAppliesToNode(n.id)) {
                var pulseGlow = 0.45 + Math.sin(tick * 0.12 + n.id) * 0.2;
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius + 9, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,230,120,' + pulseGlow + ')';
                ctx.lineWidth = 2.2;
                ctx.stroke();
                ctx.font = 'bold 9px Outfit,sans-serif';
                ctx.fillStyle = 'rgba(255,235,170,0.95)';
                ctx.textAlign = 'center';
                ctx.fillText('PULSE', n.pos.x, n.pos.y - drawRadius - 10);
            }
        }

        var gateVisible = n.gate && n.kind !== 'gate' && (vis || n.owner === game.human || (game.mapFeature && game.mapFeature.type === 'barrier'));
        if (gateVisible) {
            var gatePulse = 0.55 + 0.45 * Math.sin(tick * 0.08 + n.id);
            var gateAlpha = (vis || n.owner === game.human) ? 0.95 : 0.62;
            var barrierX = game.mapFeature && game.mapFeature.type === 'barrier' ? Number(game.mapFeature.x) : n.pos.x;
            var gateSpineX = Number.isFinite(barrierX) ? barrierX : n.pos.x;
            var gateSpineHalfH = drawRadius + 26;
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 9, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,220,140,' + (0.28 + gatePulse * 0.24) * gateAlpha + ')';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gateSpineX, n.pos.y - gateSpineHalfH);
            ctx.lineTo(gateSpineX, n.pos.y + gateSpineHalfH);
            ctx.strokeStyle = 'rgba(255,235,205,' + (0.22 + gatePulse * 0.16) * gateAlpha + ')';
            ctx.lineWidth = 1.7;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(n.pos.x, n.pos.y - drawRadius - 8);
            ctx.lineTo(n.pos.x + 5, n.pos.y - drawRadius - 2);
            ctx.lineTo(n.pos.x, n.pos.y - drawRadius + 4);
            ctx.lineTo(n.pos.x - 5, n.pos.y - drawRadius - 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,220,140,' + gateAlpha + ')';
            ctx.fill();
            ctx.font = 'bold 10px Outfit,sans-serif';
            ctx.fillStyle = 'rgba(255,232,180,' + gateAlpha + ')';
            ctx.textAlign = 'center';
            ctx.fillText('GATE', n.pos.x, n.pos.y + drawRadius + 13);
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.encounterType) {
            var encounterPulse = 0.58 + 0.42 * Math.sin(tick * 0.07 + n.id * 0.9);
            var encounterCol = n.encounterType === 'mega_turret' ? 'rgba(255,196,132,' : 'rgba(130,238,255,';
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 12, 0, Math.PI * 2);
            ctx.strokeStyle = encounterCol + (0.24 + encounterPulse * 0.18) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = 'bold 9px Outfit,sans-serif';
            ctx.fillStyle = encounterCol + '0.92)';
            ctx.textAlign = 'center';
            ctx.fillText(n.encounterType === 'mega_turret' ? 'BOSS' : 'CORE', n.pos.x, n.pos.y - drawRadius - 16);
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.owner >= 0 && n.assimilationProgress !== undefined && n.assimilationProgress < 1) {
            var ringR = drawRadius + 7;
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

        var hasOrbiters = (vis || n.owner === game.human) && n.owner >= 0 && n.kind !== 'turret' && n.kind !== 'gate';
        var orbitalSquads = [];
        if (hasOrbiters) {
            orbitalSquads = helpers.getNodeOrbitalSquads(n);
            hasOrbiters = orbitalSquads.length > 0;
        }
        if (hasOrbiters) {
            for (var osi = 0; osi < orbitalSquads.length; osi++) helpers.drawOrbitalSquadron(ctx, drawNode, orbitalSquads[osi], col, tick, false);
        }

        var tdef = helpers.nodeTypeOf(n);
        if (n.kind === 'turret') {
            helpers.drawTurretStation(ctx, drawNode, col, tick);
        } else if (n.kind === 'gate') {
            try {
                if (typeof helpers.drawGateStation === 'function') helpers.drawGateStation(ctx, drawNode, col, tick);
                else drawGateFallback(ctx, drawNode, col, helpers);
            } catch (err) {
                if (typeof console !== 'undefined' && console.error) console.error('Gate render failed', err);
                drawGateFallback(ctx, drawNode, col, helpers);
            }
            if ((vis || n.owner === game.human) && n.owner >= 0 && col && col.indexOf('#') === 0) {
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius + 2.6, 0, Math.PI * 2);
                ctx.strokeStyle = helpers.hexToRgba(col, 0.88);
                ctx.lineWidth = 2.3;
                ctx.stroke();
            }
        } else {
            var bodyCol = col;
            if ((vis || n.owner === game.human) && col.indexOf('#') === 0) {
                var typeBlend = 0.22;
                if (n.owner === -1) typeBlend = 0.66;
                else if (n.kind === 'core') typeBlend = 0.13;
                else typeBlend = 0.49;
                bodyCol = helpers.blendHex(col, tdef.color, typeBlend);
            }
            var planetCanvas = helpers.getPlanetTexture(n.id, n.radius, n.kind);
            ctx.save();
            if (!vis && n.owner !== game.human) {
                ctx.globalAlpha = 0.3;
                ctx.filter = 'grayscale(100%) brightness(50%)';
            }
            ctx.drawImage(planetCanvas, n.pos.x - drawRadius, n.pos.y - drawRadius, drawRadius * 2, drawRadius * 2);
            ctx.restore();
            if ((vis || n.owner === game.human || n.owner === -1) && typeof helpers.drawPlanetTypeVisual === 'function') {
                helpers.drawPlanetTypeVisual(ctx, drawNode, tdef, bodyCol, tick);
            }
            if (n.kind !== 'turret' && (vis || n.owner === game.human || n.owner === -1)) {
                var rimAlpha = n.owner === -1 ? 0.5 : (n.kind === 'core' ? 0.24 : 0.58);
                var rimW = n.kind === 'core' ? 1.2 : 2.45;
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius + 1.38, 0, Math.PI * 2);
                ctx.strokeStyle = helpers.hexToRgba(tdef.color, rimAlpha);
                ctx.lineWidth = rimW;
                ctx.stroke();
            }
            if (whEnd && (vis || n.owner === game.human)) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius, 0, Math.PI * 2);
                ctx.clip();
                ctx.globalCompositeOperation = 'multiply';
                var voidGrad = ctx.createRadialGradient(
                    n.pos.x, n.pos.y, 0,
                    n.pos.x, n.pos.y, drawRadius * 1.05
                );
                voidGrad.addColorStop(0, 'rgba(20, 8, 32, 0.96)');
                voidGrad.addColorStop(0.42, 'rgba(38, 18, 58, 0.62)');
                voidGrad.addColorStop(0.72, 'rgba(70, 40, 88, 0.28)');
                voidGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = voidGrad;
                ctx.fillRect(n.pos.x - drawRadius, n.pos.y - drawRadius, drawRadius * 2, drawRadius * 2);
                ctx.restore();

                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius + 1.3, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 195, 120, 0.52)';
                ctx.lineWidth = 1.65;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius - 1.1, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(140, 90, 220, 0.32)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
            if ((vis || n.owner === game.human) && n.owner >= 0 && col && col.indexOf('#') === 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius, 0, Math.PI * 2);
                ctx.clip();
                var tint = ctx.createRadialGradient(n.pos.x - drawRadius * 0.3, n.pos.y - drawRadius * 0.3, 0, n.pos.x, n.pos.y, drawRadius * 1.2);
                tint.addColorStop(0, helpers.hexToRgba(col, 0.35));
                tint.addColorStop(0.7, helpers.hexToRgba(col, 0.15));
                tint.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = tint;
                ctx.fillRect(n.pos.x - drawRadius, n.pos.y - drawRadius, drawRadius * 2, drawRadius * 2);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, drawRadius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = helpers.hexToRgba(col, 0.9);
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        }

        if ((vis || n.owner === game.human) && upgrading) {
            var chargeTint = tdef.color || '#ffffff';
            var chargePulse = 0.55 + 0.45 * Math.sin(tick * 0.22 + n.id * 0.9);
            var chargeHeight = drawRadius * (0.85 + upgradeProgress * 0.45);
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            var chargeGlow = ctx.createRadialGradient(n.pos.x, n.pos.y, drawRadius * 0.3, n.pos.x, n.pos.y, drawRadius + 24);
            chargeGlow.addColorStop(0, helpers.hexToRgba(chargeTint, 0));
            chargeGlow.addColorStop(0.72, helpers.hexToRgba(chargeTint, 0.12 + chargePulse * 0.12));
            chargeGlow.addColorStop(1, helpers.hexToRgba(chargeTint, 0));
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 24, 0, Math.PI * 2);
            ctx.fillStyle = chargeGlow;
            ctx.fill();

            var beamGrad = ctx.createLinearGradient(n.pos.x, n.pos.y - drawRadius - chargeHeight, n.pos.x, n.pos.y + drawRadius + chargeHeight);
            beamGrad.addColorStop(0, helpers.hexToRgba(chargeTint, 0));
            beamGrad.addColorStop(0.2, helpers.hexToRgba(chargeTint, 0.06));
            beamGrad.addColorStop(0.5, helpers.hexToRgba(chargeTint, 0.26 + upgradeProgress * 0.12));
            beamGrad.addColorStop(0.8, helpers.hexToRgba(chargeTint, 0.06));
            beamGrad.addColorStop(1, helpers.hexToRgba(chargeTint, 0));
            ctx.fillStyle = beamGrad;
            ctx.fillRect(n.pos.x - drawRadius * 0.34, n.pos.y - drawRadius - chargeHeight, drawRadius * 0.68, drawRadius * 2 + chargeHeight * 2);

            ctx.setLineDash([6, 5]);
            ctx.lineDashOffset = -tick * 1.6;
            ctx.beginPath();
            ctx.arc(n.pos.x, n.pos.y, drawRadius + 8 + Math.sin(tick * 0.18 + n.id) * 1.2, -Math.PI * 0.75, Math.PI * 1.18);
            ctx.strokeStyle = helpers.hexToRgba(chargeTint, 0.34 + chargePulse * 0.18);
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.setLineDash([]);

            for (var spark = 0; spark < 3; spark++) {
                var sparkA = tick * 0.14 + n.id * 0.63 + spark * 2.1;
                var sparkR = drawRadius + 7 + spark * 2.2 + Math.sin(tick * 0.2 + spark) * 0.8;
                var sparkX = n.pos.x + Math.cos(sparkA) * sparkR;
                var sparkY = n.pos.y + Math.sin(sparkA) * sparkR;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 1.7 + upgradeProgress * 1.15, 0, Math.PI * 2);
                ctx.fillStyle = helpers.hexToRgba('#ffffff', 0.8 - spark * 0.14);
                ctx.fill();
            }
            ctx.restore();
        }

        if ((vis || n.owner === game.human) && n.level > 1) {
            var upgradeTint = tdef.color || '#ffffff';
            var ringCount = Math.max(1, n.level - 1);
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            for (var ring = 0; ring < ringCount; ring++) {
                var phase = tick * 0.045 + n.id * 0.7 + ring * 0.9;
                var ringRadius = drawRadius + 4.4 + ring * 3.4 + Math.sin(phase) * 0.35;
                ctx.beginPath();
                ctx.arc(n.pos.x, n.pos.y, ringRadius, -Math.PI * 0.76 + ring * 0.18, Math.PI * 0.68 + ring * 0.18);
                ctx.strokeStyle = helpers.hexToRgba(upgradeTint, Math.min(0.66, 0.25 + ring * 0.13 + (n.kind === 'nexus' ? 0.08 : 0)));
                ctx.lineWidth = 1.25 + ring * 0.18;
                ctx.stroke();
            }
            ctx.restore();
            for (var lv = 1; lv < n.level; lv++) {
                var offsetIndex = lv - (ringCount + 1) * 0.5;
                var la = -Math.PI / 2 + offsetIndex * 0.42;
                var lx = n.pos.x + Math.cos(la) * (drawRadius + 7.2);
                var ly = n.pos.y + Math.sin(la) * (drawRadius + 7.2);
                ctx.beginPath();
                ctx.arc(lx, ly, n.kind === 'nexus' ? 2.45 : 2.1, 0, Math.PI * 2);
                ctx.fillStyle = helpers.hexToRgba(upgradeTint, n.kind === 'nexus' ? 0.96 : 0.84);
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255,255,255,0.86)';
                ctx.stroke();
            }
        }

        if (hasOrbiters) {
            for (var osj = 0; osj < orbitalSquads.length; osj++) helpers.drawOrbitalSquadron(ctx, drawNode, orbitalSquads[osj], col, tick, true);
        }

        ctx.font = 'bold ' + Math.max(11, drawRadius * 0.5) + 'px Outfit,sans-serif';
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
        } else if (n.kind === 'gate') {
            unitFill = '#fff4dc';
            unitStroke = 'rgba(7,10,16,0.94)';
        }
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = n.kind === 'turret' ? 4.5 : (n.kind === 'gate' ? 3.8 : 3.2);
        ctx.strokeStyle = unitStroke;
        ctx.strokeText(dUnits, n.pos.x, n.pos.y);
        ctx.fillStyle = unitFill;
        ctx.fillText(dUnits, n.pos.x, n.pos.y);
        ctx.shadowBlur = 0;

        if (vis || n.owner === game.human) {
            helpers.drawTypeBadge(ctx, drawNode, helpers.nodeTypeOf(n));
            if (n.level > 1 || upgrading) {
                var levelText = upgrading ? ('UP ' + Math.round(upgradeProgress * 100) + '%') : ('L' + n.level);
                ctx.font = 'bold 9px Outfit,sans-serif';
                var badgeTextWidth = ctx.measureText(levelText).width;
                var badgeW = Math.max(upgrading ? 36 : 19, badgeTextWidth + 8);
                var badgeH = 12;
                var badgeX = n.pos.x - badgeW * 0.5;
                var badgeY = n.pos.y - drawRadius - 10;
                traceRoundedPill(ctx, badgeX, badgeY, badgeW, badgeH);
                ctx.fillStyle = helpers.hexToRgba(tdef.color || '#ffffff', upgrading ? 0.34 : (n.kind === 'nexus' ? 0.36 : 0.24));
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = upgrading ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.34)';
                ctx.stroke();
                ctx.strokeStyle = 'rgba(5,8,14,0.74)';
                ctx.lineWidth = 2.6;
                ctx.strokeText(levelText, n.pos.x, badgeY + badgeH * 0.5 + 0.5);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(levelText, n.pos.x, badgeY + badgeH * 0.5 + 0.5);
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
    drawSolarFlareCorona(ctx, game, tick, constants);
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
    var helpers = opts.helpers || {};
    var blendHex = typeof helpers.blendHex === 'function' ? helpers.blendHex : function (a) { return a; };
    var nodeTypeOf = typeof helpers.nodeTypeOf === 'function' ? helpers.nodeTypeOf : function (n) {
        var defs = constants.nodeTypeDefs;
        return defs && n && defs[n.kind] ? defs[n.kind] : { color: '#8db3ff' };
    };
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
        var tdef = nodeTypeOf(mn);
        var baseCol = mn.owner < 0 ? '#5a6272' : (game.players[mn.owner] ? game.players[mn.owner].color : '#888');
        var mcol = baseCol;
        var tc = tdef && tdef.color ? tdef.color : '#8db3ff';
        if (mn.owner >= 0) {
            mcol = blendHex(baseCol, tc, mn.kind === 'core' ? 0.15 : 0.42);
        } else {
            mcol = blendHex(baseCol, tc, 0.38);
        }
        var mr = 7.6;
        if (mn.kind === 'turret') mr = 10.2;
        else if (mn.kind === 'gate') mr = 9.6;
        else if (mn.kind === 'forge' || mn.kind === 'bulwark' || mn.kind === 'nexus') mr = 8.9;
        else if (mn.kind === 'relay') mr = 8.35;
        ctx.fillStyle = mcol;
        ctx.beginPath();
        ctx.arc(mn.pos.x, mn.pos.y, mr, 0, Math.PI * 2);
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
