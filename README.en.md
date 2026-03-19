<p align="center">
  <img src="https://img.shields.io/badge/Stellar%20Conquest-v1.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-yellow?style=flat-square" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square" alt="Socket.IO" />
</p>

<h1 align="center">Stellar Conquest</h1>

<p align="center">
  <strong>Real-time space conquest strategy</strong> - fast macro decisions, deep map control, no micro-management clutter.
</p>

<p align="center">
  <a href="./README.md">TR</a> • <a href="./README.en.md">EN</a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#learning-the-game">Learning</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#how-to-play">How to Play</a> •
  <a href="#setup">Setup</a> •
  <a href="#tests">Tests</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#live-demo">Live Demo</a>
</p>

---

## Summary

**Stellar Conquest** is a browser-based real-time space strategy game built around planet capture, **flow** logistics, **parked fleet** staging, and tempo gained through **assimilation and territory**. It deliberately favors **timing, routing, and map reading** over sheer click volume.

**Single codebase, two runtimes:** Simulation logic lives under `assets/sim/`; the Canvas 2D client (`game.js`) and the multiplayer host (`server.js`) share the same rules, advancing a **deterministic tick** and checking **state hashes** for sync. Campaign, daily challenge, playlist presets, mutators, and PvE encounters (e.g. **Mega Turret**, **Relay Core**) are layers on top of that core.

**Recent updates (e.g. Mar 2026):** Periodic **solar flares** on the map — warning phase, then effects on **deep-space fleets** and **planet garrisons**, driven deterministically from the match seed (`assets/sim/solar_flare.js`, tuning in `shared_config.js`). On mobile, **Visual Viewport** alignment (`stellar_conquest.html` and `game.js` CSS vars `--app-vvh` / `--app-vvw`), a tuning control, and layout tweaks for campaign / power HUD.

---

## Quick Start

```bash
# Install dependencies
npm install

# Singleplayer / development mode
npm run dev
# -> http://localhost:5173

# Multiplayer server
npm run server
# -> http://localhost:3000
```

**One-command Docker launch:**

```bash
docker compose up -d --build
```

**Opening `stellar_conquest.html` directly:** Prefer `npm run dev` for development (Vite resolves ESM cleanly). You can also serve the repo root over HTTP (`npx serve .`, etc.) and open `stellar_conquest.html`; `file://` may block modules depending on the browser.

---

## Learning the game

1. **Menu → Help / How to play** (tutorial modal in `stellar_conquest.html` and the multiplayer shell): controls, flow, assimilation, doctrines, mutators, and HUD in one place.
2. **First match:** **Quick Start** on the main screen, or playlist **Zen** + doctrine **Logistics** for a slower, readable opening.
3. **Campaign:** mission panel plus coach hints; optional bonus goals are not required to finish a stage.
4. **As a developer:** `npm test` for rules coverage; `npm run e2e` for menu / multiplayer smoke tests.

---

## Features

### Core Mechanics

| Mechanic | Description |
|--------|-------------|
| **Planet capture** | Capture through fleet dispatch and attrition-based combat |
| **Flow links** | Set routes once and let your economy reinforce automatically |
| **Parked fleets** | Hold deep space, stage attacks, and decay when unsupported |
| **Territory and assimilation** | Borders grow from fully assimilated worlds |
| **Defense systems** | Defensive nodes, turrets, and defense fields |
| **Map features** | Wormholes, gravity wells, and barrier gates |
| **Solar flare** | Timed map event: warning window, then impact on fleets in space and garrison on planets; seed-deterministic |

### Game Modes

- **Skirmish** - Free matches against AI or friends
- **Campaign** - Structured handcrafted mission ladder
- **Daily Challenge** - Seeded procedural scenario with daily variation
- **Custom Maps** - JSON-based custom map import/export flow
- **Multiplayer** - Real-time Socket.IO rooms for up to 6 players

### AI

- Fast heuristic AI designed to run in the browser
- Multiple difficulty levels with dynamic tuning
- Aware of territory, turrets, supply, **contested** areas, and local threat geometry

### In-game guidance

- Context badge and hint strip (what to do next from current selection)
- Short **hover** tooltips on planet types and HUD action buttons
- Pause menu **Hints** toggle for coach messages

---

## Architecture

```text
stellar_conquest.html     Singleplayer entry + menu / tutorial UI
index.html                Vite dev shell
game.js                   Main client (~6.2k lines): rendering, menu, singleplayer loop
server.js                 Express + Socket.IO; authoritative tick, rooms, snapshots

assets/
  sim/                    Shared simulation (client preview + server authority)
    shared_config.js      Tick constants, difficulty, planet types
    server_sim.js         Server tick pipeline
    command_apply.js      Deterministic command application
    territory.js, flow_step.js, fleet_step.js, node_economy.js, …
    playlists.js          Standard / Zen / Chaos / … presets
    mutator.js            Ion storm, blackout, etc.
    solar_flare.js        Solar flare scheduling and effects (client + server)
    encounters.js         Relay Core, Mega Turret, etc.
    mission_script.js     Campaign script hooks
    match_manifest.js     Match metadata (snapshot-safe)
    custom_map.js         JSON map import/export
    doctrine.js           Doctrine passive/active rules
  app/                    Client helpers (input, tick phases, hover target, start flow)
  net/                    online_session, network_tick
  campaign/
    levels.js             Campaign definitions + objectives
    handcrafted_maps.js   Hand-authored layouts
    objectives.js         Objective evaluation
    daily_challenge.js    Daily seeded scenario
  ui/                     HUD, lobby, mission panel, coach / advisor
tests/                    node:test unit tests
e2e/                      Playwright smoke tests
```

**Rule of thumb:** gameplay changes belong in `assets/sim/` whenever possible so local preview and server stay aligned.

---

## How to Play

### Core Controls (PC)

| Action | Control |
|-------|---------|
| Select planet | Left click |
| Multi-select | Shift + left click |
| Box selection | Drag on empty space |
| Send fleet | Left click target while a source is selected |
| Group send | Ctrl + drag and release |
| Toggle flow | Right click on target |
| Defense mode | Right click on your own planet |
| Camera pan | Middle mouse + drag |
| Zoom | Mouse wheel |

### Keyboard Shortcuts

| Key | Function |
|-----|----------|
| `1`-`9` | Send percentage (10-90) |
| `0` | Send percentage 100 |
| `U` | Upgrade selected planets |
| `A` | Select all owned planets |
| `Q` | Doctrine active ability |
| `Esc` / `P` | Pause / resume |

**Note:** For the full control list and mobile HUD action buttons (upgrade, defense, flow, doctrine), use the in-game **How to play** modal.

### Mobile

- One finger to select and drag; two fingers to pan and zoom
- **Visual viewport** offsets (browser chrome / safe area) are compensated; canvas tracks `--app-vvh` / `--app-vvw`
- Tuning control top-right; panel stacking tuned for touch

---

## Setup

### Requirements

- **Node.js** 18+
- **npm** or **pnpm**

### Singleplayer / Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Multiplayer Server

```bash
npm run server
```

Open `http://localhost:3000`.

### Production Build

```bash
npm run build
```

Output is written to `dist/`. `server.js` auto-detects:

- **dist mode** if `dist/` exists
- **source mode** otherwise

### Docker Deployment

```bash
docker compose up -d --build
```

The game server runs in the `solarmax-app` container on port `3000`.

| Detail | Value |
|-------|-------|
| Container name | `solarmax-app` |
| Internal port | `3000` |
| Persistent data | `./data` volume |
| External network | `npm-net` must already exist |

If you run behind a reverse proxy, enable WebSocket forwarding for Socket.IO. The current live setup uses Nginx Proxy Manager with Let's Encrypt TLS.

---

## Tests

The project uses the built-in Node.js test runner (no extra test framework).

```bash
npm test
```

`tests/` covers shared simulation modules plus selected UI helpers (campaign levels, playlists, mission scripts, solar flare rules, online session, etc.). Current unit test count: **208** (see the `tests` line in `npm test` output).

**E2E (Playwright):**

```bash
npm run e2e
```

Smoke flows live in `e2e/`. For a CI-like container run, use `npm run e2e:docker`.

---

## Multiplayer Protocol Notes

- Room codes are 5 characters long
- Match results are accepted only after **all active players** report the same winner index
- Rematch and result votes are cleared when players disconnect
- The server runs the authoritative simulation tick and uses sync hashes to keep clients aligned

---

## Live Demo

**[https://solarmax.urgup.keenetic.link](https://solarmax.urgup.keenetic.link)**

---

## Tech Stack

| Layer | Technology |
|------|------------|
| Client | Plain JavaScript (ES modules), Canvas 2D; main module `game.js` (~6.2k lines) |
| Dev server | Vite 5 |
| Multiplayer | Express 4 + Socket.IO 4 |
| Build | Vite |
| Unit tests | Node.js built-in `node:test` |
| E2E | Playwright (`@playwright/test`) |
| Containerization | Docker + Docker Compose |

No framework and no heavy game engine. **Rules-heavy code** is meant to live in shared `assets/sim/`; the client focuses on rendering, input, and flow.

---

## Design Philosophy

The game is built around **fast macro decisions instead of heavy micro**:

- **Simple input loop** - select, drag/send, set flow, reposition, choose timing. New systems should create better decisions, not more buttons.
- **Map-level depth** - mechanics should influence routes, territory, timing windows, and objective pressure instead of memorized unit rosters.
- **Cross-mode reuse** - good features should work in skirmish, campaign, daily challenge, custom maps, and multiplayer.
- **Readability first** - the player should understand visually why a fleet is fast, slow, contested, protected, unsupplied, or decaying.

---

## Roadmap

The detailed delivery order, module status notes, and copy-paste agent prompts are in **[docs/ROADMAP.en.md](./docs/ROADMAP.en.md)**. The Turkish edition is **[docs/ROADMAP.md](./docs/ROADMAP.md)**.

**Snapshot (March 2026):** Territory 2.0 / contested fronts, sector mutators v1, AI front awareness, readability pass, commander / doctrine v1, and **solar flare** events are largely complete in the shared sim. Campaign / PvE bosses and mode wrappers are partial; ranked playlist, Elo/MMR, faction identity, and community layers are planned or early-stage.

---

## License

Private project.
