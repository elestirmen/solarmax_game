/* =========================================================
   render.ts – Canvas rendering: nodes, fleets, bezier links,
               fog overlay, selection, HUD elements
   ========================================================= */

import { GameNode, Fleet, FlowLink, Camera, Player } from './entities';
// input coordinate transforms used elsewhere
import { bezierPoint, computeControlPoint } from './bezier';
import { FogState, isNodeVisible, isFleetVisible } from './fog';
import { COLORS, BEZIER_CURVATURE, PULSE_SPEED } from './constants';
import { Vec2 } from './utils';

/* ---- Main render function ---- */
export function render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    cam: Camera,
    nodes: GameNode[],
    fleets: Fleet[],
    flowLinks: FlowLink[],
    players: Player[],
    fog: FogState,
    humanPlayer: number,
    tick: number,
    dt: number,
    marquee: { active: boolean; start: Vec2; end: Vec2 },
    drag: { active: boolean; start: Vec2; end: Vec2 },
): void {
    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save and apply camera transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Draw background grid dots
    drawGrid(ctx, cam, canvas);

    // Draw flow links (bezier curves)
    drawFlowLinks(ctx, flowLinks, nodes, players, fog, humanPlayer, tick);

    // Draw fleets
    drawFleets(ctx, fleets, nodes, players, fog, humanPlayer, cam, canvas);

    // Draw nodes
    drawNodes(ctx, nodes, players, fog, humanPlayer, tick);

    // Draw drag line
    if (drag.active) {
        drawDragLine(ctx, drag.start, drag.end, tick);
    }

    ctx.restore();

    // Draw marquee (screen space)
    if (marquee.active) {
        drawMarquee(ctx, marquee.start, marquee.end);
    }

    void dt;
}

/* ---- Background grid ---- */
function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, canvas: HTMLCanvasElement): void {
    const spacing = 50;
    const halfW = canvas.width / 2 / cam.zoom;
    const halfH = canvas.height / 2 / cam.zoom;
    const startX = Math.floor((cam.x - halfW) / spacing) * spacing;
    const startY = Math.floor((cam.y - halfH) / spacing) * spacing;
    const endX = cam.x + halfW;
    const endY = cam.y + halfH;

    ctx.fillStyle = COLORS.gridDot;
    for (let x = startX; x <= endX; x += spacing) {
        for (let y = startY; y <= endY; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/* ---- Nodes ---- */
function drawNodes(
    ctx: CanvasRenderingContext2D,
    nodes: GameNode[],
    players: Player[],
    fog: FogState,
    humanPlayer: number,
    tick: number,
): void {
    for (const node of nodes) {
        const visible = isNodeVisible(fog, humanPlayer, node.id);
        const color = getNodeColor(node, players, fog, humanPlayer, visible);
        const displayUnits = getDisplayUnits(node, fog, humanPlayer, visible);

        // Glow for selected node
        if (node.selected && node.owner === humanPlayer) {
            ctx.save();
            ctx.shadowColor = COLORS.selectionGlow;
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(node.pos.x, node.pos.y, node.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, node.radius, 0, Math.PI * 2);

        if (!visible && node.owner !== humanPlayer) {
            // Fogged: dark silhouette
            ctx.fillStyle = COLORS.fogNode;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            // Visible: gradient fill
            const grad = ctx.createRadialGradient(
                node.pos.x - node.radius * 0.3,
                node.pos.y - node.radius * 0.3,
                node.radius * 0.1,
                node.pos.x,
                node.pos.y,
                node.radius
            );
            grad.addColorStop(0, lighten(color, 30));
            grad.addColorStop(1, color);
            ctx.fillStyle = grad;
            ctx.fill();

            // Border
            ctx.strokeStyle = lighten(color, 50);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Production pulse for owned visible nodes
        if (visible && node.owner >= 0) {
            const pulse = (Math.sin(tick * 0.08 + node.id * 1.5) + 1) * 0.5;
            ctx.beginPath();
            ctx.arc(node.pos.x, node.pos.y, node.radius + 2 + pulse * 3, 0, Math.PI * 2);
            ctx.strokeStyle = `${color}33`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Unit count text
        ctx.font = `bold ${Math.max(11, node.radius * 0.55)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';

        if (!visible && node.owner !== humanPlayer) {
            // Never seen
            if (fog.lastSeen[humanPlayer][node.id].tick < 0) {
                ctx.fillStyle = '#666';
                ctx.fillText('?', node.pos.x, node.pos.y);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillText(String(fog.lastSeen[humanPlayer][node.id].units), node.pos.x, node.pos.y);
            }
        } else {
            ctx.fillText(displayUnits, node.pos.x, node.pos.y);
        }
    }
}

function getNodeColor(
    node: GameNode,
    players: Player[],
    fog: FogState,
    humanPlayer: number,
    visible: boolean,
): string {
    if (node.owner === -1) return COLORS.neutral;
    if (visible || node.owner === humanPlayer) {
        return players[node.owner]?.color ?? COLORS.neutral;
    }
    // Fogged: use lastSeen owner color dimmed, or grey
    const ls = fog.lastSeen[humanPlayer][node.id];
    if (ls.tick >= 0 && ls.owner >= 0) {
        return darken(players[ls.owner]?.color ?? COLORS.neutral, 40);
    }
    return COLORS.fogNode;
}

function getDisplayUnits(
    node: GameNode,
    fog: FogState,
    humanPlayer: number,
    visible: boolean,
): string {
    if (visible || node.owner === humanPlayer) {
        return String(Math.floor(node.units));
    }
    const ls = fog.lastSeen[humanPlayer][node.id];
    if (ls.tick >= 0) return String(ls.units);
    return '?';
}

/* ---- Flow Links (Bezier) ---- */
function drawFlowLinks(
    ctx: CanvasRenderingContext2D,
    flowLinks: FlowLink[],
    nodes: GameNode[],
    players: Player[],
    fog: FogState,
    humanPlayer: number,
    tick: number,
): void {
    for (const link of flowLinks) {
        if (!link.active) continue;

        // Only show links owned by human or where both ends are visible
        const srcNode = nodes[link.sourceId];
        const tgtNode = nodes[link.targetId];
        if (link.owner !== humanPlayer) {
            if (!isNodeVisible(fog, humanPlayer, link.sourceId) &&
                !isNodeVisible(fog, humanPlayer, link.targetId)) continue;
        }

        const color = players[link.owner]?.color ?? COLORS.neutral;
        const cp = computeControlPoint(srcNode.pos, tgtNode.pos, BEZIER_CURVATURE);

        // Draw bezier curve
        ctx.beginPath();
        ctx.moveTo(srcNode.pos.x, srcNode.pos.y);
        ctx.quadraticCurveTo(cp.x, cp.y, tgtNode.pos.x, tgtNode.pos.y);
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Animated pulse along curve
        const phases = 3;
        for (let i = 0; i < phases; i++) {
            const t = ((tick * PULSE_SPEED * 0.01 + i / phases) % 1);
            const pt = bezierPoint(srcNode.pos, cp, tgtNode.pos, t);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `${color}aa`;
            ctx.fill();
        }

        // Direction arrow at midpoint
        const midT = 0.5;
        const mid = bezierPoint(srcNode.pos, cp, tgtNode.pos, midT);
        const ahead = bezierPoint(srcNode.pos, cp, tgtNode.pos, midT + 0.05);
        drawArrow(ctx, mid, ahead, color + '88', 6);
    }
}

/* ---- Fleets ---- */
function drawFleets(
    ctx: CanvasRenderingContext2D,
    fleets: Fleet[],
    nodes: GameNode[],
    players: Player[],
    _fog: FogState,
    humanPlayer: number,
    cam: Camera,
    canvas: HTMLCanvasElement,
): void {
    const halfW = canvas.width / 2 / cam.zoom + 20;
    const halfH = canvas.height / 2 / cam.zoom + 20;

    for (const fleet of fleets) {
        if (!fleet.active) continue;

        // Fog: hide enemy fleets outside vision
        if (fleet.owner !== humanPlayer && !isFleetVisible(fleet, humanPlayer, nodes)) {
            continue;
        }

        // Viewport culling
        if (
            Math.abs(fleet.x - cam.x) > halfW ||
            Math.abs(fleet.y - cam.y) > halfH
        ) continue;

        const color = players[fleet.owner]?.color ?? COLORS.neutral;

        // Fleet dot
        ctx.beginPath();
        ctx.arc(fleet.x, fleet.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Count label for larger fleets
        if (fleet.count > 5) {
            ctx.font = '9px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#ffffffbb';
            ctx.fillText(String(fleet.count), fleet.x, fleet.y - 4);
        }
    }
}

/* ---- Drag line ---- */
function drawDragLine(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    tick: number,
): void {
    const cp = computeControlPoint(start, end, BEZIER_CURVATURE * 0.7);

    // Dashed bezier path
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -tick * 0.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Arrow at end
    const preEnd = bezierPoint(start, cp, end, 0.9);
    drawArrow(ctx, preEnd, end, 'rgba(255,255,255,0.6)', 8);
}

/* ---- Marquee ---- */
function drawMarquee(ctx: CanvasRenderingContext2D, start: Vec2, end: Vec2): void {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(74, 142, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(74, 142, 255, 0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}

/* ---- Arrow helper ---- */
function drawArrow(
    ctx: CanvasRenderingContext2D,
    from: Vec2, to: Vec2,
    color: string, size: number
): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(to.x, to.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.5);
    ctx.lineTo(-size, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

/* ---- Color utilities ---- */
function lighten(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgb(${Math.min(255, rgb.r + amount)},${Math.min(255, rgb.g + amount)},${Math.min(255, rgb.b + amount)})`;
}

function darken(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgb(${Math.max(0, rgb.r - amount)},${Math.max(0, rgb.g - amount)},${Math.max(0, rgb.b - amount)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

