/* =========================================================
   input.ts – Mouse/keyboard input handling & replay recording
   ========================================================= */

import { GameNode, Camera } from './entities';
import { Vec2, dist } from './utils';
import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, CAMERA_ZOOM_SPEED } from './constants';

export interface InputState {
    // Selection
    selectedNodes: Set<number>;
    // Marquee
    marqueeActive: boolean;
    marqueeStart: Vec2;
    marqueeEnd: Vec2;
    // Drag (fleet send)
    dragActive: boolean;
    dragStart: Vec2;       // world coords (source node center)
    dragEnd: Vec2;         // world coords (current mouse)
    dragSourceNodes: number[];
    // Camera
    panActive: boolean;
    panLastScreen: Vec2;
    // Mouse world position
    mouseWorld: Vec2;
    mouseScreen: Vec2;
    // Send percentage
    sendPercent: number;
    // Shift held
    shiftHeld: boolean;
}

export function createInputState(): InputState {
    return {
        selectedNodes: new Set(),
        marqueeActive: false,
        marqueeStart: { x: 0, y: 0 },
        marqueeEnd: { x: 0, y: 0 },
        dragActive: false,
        dragStart: { x: 0, y: 0 },
        dragEnd: { x: 0, y: 0 },
        dragSourceNodes: [],
        panActive: false,
        panLastScreen: { x: 0, y: 0 },
        mouseWorld: { x: 0, y: 0 },
        mouseScreen: { x: 0, y: 0 },
        sendPercent: 50,
        shiftHeld: false,
    };
}

/* ---- Coordinate transform ---- */
export function screenToWorld(sx: number, sy: number, cam: Camera, canvas: HTMLCanvasElement): Vec2 {
    return {
        x: (sx - canvas.width / 2) / cam.zoom + cam.x,
        y: (sy - canvas.height / 2) / cam.zoom + cam.y,
    };
}

export function worldToScreen(wx: number, wy: number, cam: Camera, canvas: HTMLCanvasElement): Vec2 {
    return {
        x: (wx - cam.x) * cam.zoom + canvas.width / 2,
        y: (wy - cam.y) * cam.zoom + canvas.height / 2,
    };
}

/* ---- Hit testing ---- */
export function hitTestNode(worldPos: Vec2, nodes: GameNode[]): GameNode | null {
    for (const node of nodes) {
        if (dist(worldPos, node.pos) <= node.radius + 5) {
            return node;
        }
    }
    return null;
}

export function nodesInRect(
    start: Vec2,
    end: Vec2,
    nodes: GameNode[],
    playerIndex: number
): number[] {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const result: number[] = [];
    for (const node of nodes) {
        if (
            node.owner === playerIndex &&
            node.pos.x >= minX && node.pos.x <= maxX &&
            node.pos.y >= minY && node.pos.y <= maxY
        ) {
            result.push(node.id);
        }
    }
    return result;
}

/* ---- Camera zoom ---- */
export function applyZoom(cam: Camera, delta: number, _mouseWorld: Vec2): void {
    const factor = delta > 0 ? (1 - CAMERA_ZOOM_SPEED) : (1 + CAMERA_ZOOM_SPEED);
    cam.zoom *= factor;
    if (cam.zoom < CAMERA_ZOOM_MIN) cam.zoom = CAMERA_ZOOM_MIN;
    if (cam.zoom > CAMERA_ZOOM_MAX) cam.zoom = CAMERA_ZOOM_MAX;
}
