function mergeNode(base, extra) {
    extra = extra && typeof extra === 'object' ? extra : {};
    for (var key in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
        base[key] = extra[key];
    }
    return base;
}

function node(x, y, owner, units, kind, extra) {
    var owned = owner >= 0;
    return mergeNode({
        x: x,
        y: y,
        radius: owned ? 30 : 24,
        owner: owner,
        units: units,
        kind: kind || 'core',
        level: owned ? 2 : 1,
        assimilationProgress: 1,
        assimilationLock: 0,
        defense: false,
    }, extra);
}

export function buildCoreLockHandcraftedMap() {
    return {
        name: 'Core Kilidi Layout',
        playerCount: 4,
        nodes: [
            node(260, 760, 0, 24, 'core'),
            node(230, 240, 1, 22, 'core'),
            node(1320, 220, 2, 22, 'core'),
            node(1320, 780, 3, 22, 'core'),
            node(390, 230, -1, 16, 'relay'),
            node(560, 300, -1, 18, 'bulwark'),
            node(760, 360, -1, 16, 'core', { gate: true }),
            node(600, 500, -1, 18, 'forge'),
            node(760, 640, -1, 16, 'core', { gate: true }),
            node(580, 700, -1, 18, 'bulwark'),
            node(450, 780, -1, 16, 'relay'),
            node(1000, 500, -1, 20, 'core'),
            node(920, 340, -1, 17, 'relay'),
            node(1130, 240, -1, 18, 'forge'),
            node(920, 660, -1, 17, 'relay'),
            node(1130, 760, -1, 18, 'forge'),
        ],
        mapFeature: { type: 'barrier', x: 800, gateIds: [6, 8] },
        playerCapital: { 0: 0, 1: 1, 2: 2, 3: 3 },
    };
}

/** Sis + sabit wormhole: kampanya bolum 32 — iki faz (cikis noktalari, kopru ritmi). */
export function buildVeilBridgeHandcraftedMap() {
    return {
        name: 'Sis Koprusu Layout',
        playerCount: 3,
        nodes: [
            node(160, 820, 0, 26, 'core'),
            node(1410, 240, 1, 22, 'core'),
            node(1410, 760, 2, 22, 'core'),
            node(320, 700, -1, 14, 'relay'),
            node(480, 620, -1, 16, 'forge'),
            node(700, 500, -1, 18, 'core', { strategic: true }),
            node(900, 420, -1, 15, 'relay'),
            node(1040, 340, -1, 16, 'bulwark'),
            node(1180, 480, -1, 17, 'core'),
            node(1020, 620, -1, 15, 'relay'),
            node(520, 380, -1, 14, 'forge'),
            node(800, 680, -1, 15, 'relay'),
        ],
        mapFeature: { type: 'wormhole' },
        wormholes: [{ a: 4, b: 9 }],
        strategicNodes: [5],
        playerCapital: { 0: 0, 1: 1, 2: 2 },
    };
}

export function buildGunlineHandcraftedMap() {
    return {
        name: 'Turret Hatti Layout',
        playerCount: 4,
        nodes: [
            node(200, 500, 0, 24, 'core'),
            node(1380, 220, 1, 22, 'core'),
            node(1420, 500, 2, 22, 'core'),
            node(1380, 780, 3, 22, 'core'),
            node(360, 300, -1, 16, 'relay'),
            node(420, 500, -1, 18, 'forge'),
            node(360, 700, -1, 16, 'relay'),
            node(590, 330, -1, 18, 'bulwark'),
            node(620, 500, -1, 18, 'core'),
            node(590, 670, -1, 18, 'bulwark'),
            node(820, 500, -1, 20, 'core'),
            node(1030, 330, -1, 18, 'bulwark'),
            node(1030, 500, -1, 18, 'forge'),
            node(1030, 670, -1, 18, 'bulwark'),
            node(1220, 220, -1, 18, 'relay'),
            node(1240, 500, -1, 18, 'nexus'),
            node(1220, 780, -1, 18, 'relay'),
        ],
        mapFeature: { type: 'none' },
        mapMutator: { type: 'ion_storm', x: 820, y: 500, r: 180, speedMult: 0.72 },
        playerCapital: { 0: 0, 1: 1, 2: 2, 3: 3 },
    };
}
