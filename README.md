# Stellar Conquest

Real-time space conquest strategy game with singleplayer and multiplayer.

## Project State

- Single canonical game client source: `game.js`
- Main UI page: `stellar_conquest.html`
- Multiplayer server: `server.js`
- Audio module: `assets/audio.js`

The old parallel TypeScript game implementation was removed to keep one source of truth.

## Run

```bash
npm install
```

### Singleplayer / local client

```bash
npm run dev
```

Open `http://localhost:5173`.

### Multiplayer server

```bash
npm run server
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

This produces `dist/` with Vite output.

`server.js` auto-detects:

- `dist` mode if a built bundle exists
- `source` mode otherwise

## Docker Deployment

This checkout also includes a production Docker setup:

```bash
docker compose up -d --build
```

This starts the game server in a `solarmax-app` container on port `3000` inside Docker.

Notes:

- Persistent server data is stored in `./data`
- The provided Compose file expects an external Docker network named `npm-net`
- If you place the app behind a reverse proxy, enable WebSocket forwarding for Socket.IO

## Live Deployment

The instance in `/opt/solarmax` is published at:

- `https://solarmax.urgup.keenetic.link`

The current production setup uses Nginx Proxy Manager with Let's Encrypt TLS in front of the `solarmax-app` container.

## Multiplayer Notes

- Room code length is fixed to 5 characters
- Match result is accepted only after all active players report the same winner index
- Rematch/result votes are cleaned when players disconnect

## Roadmap

The current game already has a strong foundation:

- real-time planet conquest
- campaign scenarios
- daily challenge generation
- replays
- custom maps
- multiplayer rooms
- territory / assimilation / flow mechanics

The next development stage should not try to turn the project into a bloated traditional RTS. The better direction is to deepen the existing identity:

- fast macro decisions instead of heavy micro
- readable interactions on both mouse and touch
- strong map-level variety
- long-term replayability through rulesets, objectives, and competitive structure

This roadmap is split into three horizons:

- short term: features that strongly improve match variety and strategy without exploding scope
- mid term: systems that create identity, content depth, and stronger progression
- long term: competitive shell, asymmetric depth, and broader ecosystem features

### Product Principles

Every roadmap item below should be evaluated against the same design rules.

#### Keep the core input simple

The main interaction loop should remain:

- select
- drag / send
- set flow
- reposition
- make timing decisions

New systems should create better decisions, not more buttons.

#### Prefer map-level depth over unit-level clutter

The game becomes stronger when new mechanics affect:

- routing
- territory
- timing windows
- map control
- objective pressure

It becomes weaker if the design drifts into too many separate unit classes, upgrade trees, or active ability panels.

#### Make systems reusable across modes

A good feature should ideally be usable in:

- skirmish
- campaign
- daily challenge
- custom maps
- multiplayer

If a feature only works in one mode, it needs a strong reason to exist.

#### Preserve readability

Any future mechanic must be visually legible:

- the player should understand why a fleet is faster, slower, protected, decaying, contested, or losing
- frontlines and special map rules should be readable at a glance
- mobile play should remain viable

### Short-Term Roadmap

These are the highest-value next steps. They build directly on mechanics that already exist and are likely to produce immediate gameplay gains.

#### 1. Territory 2.0 and Contested Fronts

Status:

- partially started through territory bonuses and post-assimilation borders

Goal:

- turn territory from a passive background modifier into a real frontline system

Core idea:

- safe space, contested space, and enemy space should feel meaningfully different

Planned scope:

- contested zones where overlapping assimilated borders disable territory bonuses
- clearer visual distinction for contested space
- stronger link between territory and parked fleet logistics
- optional border instability or pressure penalties near unstable frontlines
- AI awareness of frontlines when evaluating attacks, retreats, and parked fleet positions

Design notes:

- contested zones should not become noisy or overly punitive
- the player should still be able to make bold invasions
- frontlines should encourage positioning, not force static trench gameplay

Dependencies:

- territory visualization improvements
- AI awareness improvements
- consistent rule handling in both local and authoritative simulation

Success criteria:

- players can identify frontlines without opening a tutorial
- territory creates meaningful staging decisions
- parked fleets and border pushes become more strategic

Why this is short-term:

- the project already has the base primitives for territory, assimilation, and parked fleets
- this feature deepens an existing strength instead of opening a new design branch

#### 2. Sector Mutators v1

Goal:

- make maps feel distinct through one dominant environmental rule

Core idea:

- each match should sometimes ask a different strategic question without changing the control scheme

Candidate mutators:

- ion storm sectors that reduce fleet speed
- pulse-rich sectors that temporarily amplify production or movement
- blackout zones that disable territory bonuses
- unstable corridors that boost travel but increase fleet attrition
- collapse regions that accelerate decay for unsupported parked fleets
- rotating anomaly bands that change the safe route over time

Implementation target for v1:

- one active mutator per map
- deterministic generation for seeded play and daily challenges
- clear UI banner plus in-map visual treatment
- mutator metadata in replay and multiplayer snapshots

Design notes:

- mutators should be high signal and low rules text
- the best mutators change routing, tempo, and timing windows
- avoid mutators that only tweak hidden numbers with no spatial consequence

Dependencies:

- match manifest support
- map generation hooks
- render language for anomaly overlays

Success criteria:

- players remember the match by its rule twist
- daily challenges feel less like standard skirmishes with different numbers
- mutators produce different openers, not just different win-more states

#### 3. AI Frontier Awareness

Goal:

- make AI stronger for the right reasons

Core idea:

- AI should understand territory, turrets, staging, and bad attack geometry better than it does now

Planned improvements:

- avoid drip-feeding into defended fronts
- stage parked fleets before major pushes
- prefer human pressure when the frontier is weak
- distinguish safe backline targets from trap targets
- understand contested territory as neutralized space
- evaluate when to stabilize a newly captured world before overextending

Implementation notes:

- keep AI heuristic-driven and cheap enough for mobile / browser execution
- avoid deep search unless it is tightly bounded
- prefer better scoring and pressure timing over raw simulation volume

Dependencies:

- territory 2.0 signals
- better threat scoring around turrets and defended nodes

Success criteria:

- hard AI stops looking obviously self-destructive
- matches are lost because the AI found timing windows, not because it cheated

#### 4. Visual Readability Pass

Goal:

- make the richer strategic systems easy to read in live play

Planned scope:

- stronger frontier rendering
- clearer contested territory presentation
- improved anomaly / mutator language
- cleaner fleet state indicators for supplied / unsupplied / decaying / parked
- better mobile HUD compression and adaptive overlays
- improved post-match and mission-state feedback

Why it matters:

- the game is now gaining more systemic depth
- without a readability pass, that depth turns into confusion

Success criteria:

- fewer rules need to be explained through text
- most systems become understandable from visuals and motion alone

### Mid-Term Roadmap

These systems add identity and retention once the short-term strategic layer is stable.

#### 5. Commander / Doctrine System

Goal:

- give players pre-match strategic identity without introducing a heavy tech tree

Core structure:

- one passive bonus
- one active ability
- one drawback or tradeoff

Candidate doctrine families:

- `Logistics`: stronger flow, reinforcement, and long-route tempo
- `Assimilation`: faster stabilization and stronger recovery after capture
- `Siege`: more reliable pressure against defense-heavy planets and turrets
- `Territory`: stronger control inside owned borders, weaker outside
- `Pulse`: better exploitation of map events and timing windows

Rules constraints:

- doctrine impact should be visible in macro play
- doctrine choice should change priorities, not button spam
- doctrine abilities should be low-frequency and high-impact

Campaign and AI impact:

- campaign missions can be built around doctrine teaching
- AI profiles can map naturally onto doctrine archetypes

Dependencies:

- stable territory and mutator systems
- pre-match UI / lobby support
- balance framework for passive and active effects

Success criteria:

- different doctrine mirrors feel distinct
- no doctrine becomes mandatory in standard play
- doctrine identity is understandable within the first few minutes of a match

#### 6. Campaign Expansion

Goal:

- evolve the campaign from a set of skirmishes into a structured teaching and challenge ladder

Campaign philosophy:

- each mission should teach, test, or remix one major idea
- objectives should force different priorities, not just bigger battles

Mission types to add:

- survive under pressure for a fixed duration
- capture and hold a relay corridor
- preserve a capital while expanding elsewhere
- win under a mutator-specific restriction
- escort, defend, or activate a unique map object
- boss sector mission with staged escalation

Content structure:

- early campaign: teach economy, flow, and assimilation
- mid campaign: introduce territory, anomalies, and staging
- late campaign: combine frontlines, objectives, and boss pressure

Dependencies:

- PvE objective framework
- mutator system
- doctrine system if doctrine tutorials are desired

Success criteria:

- campaign missions feel handcrafted rather than procedurally shuffled
- each chapter introduces or sharpens one concept

#### 7. PvE Objectives and Boss Encounters

Goal:

- create objectives that are not reducible to "kill every opponent"

Candidate content:

- mega-turrets guarding gates
- ancient cores that unlock map-wide advantages
- sector fauna / hazards that occupy important routes
- timed defense events
- shared threats in co-op or race-style scenarios

Boss design rules:

- bosses should create spatial problems, not bullet-hell mechanics
- the player should still solve them through routing, staging, and timing
- bosses should produce new priorities, not just require more units

Dependencies:

- encounter state in shared simulation
- event telegraphing and mission UI support

Success criteria:

- players can describe missions by the encounter, not only the map size
- PvE content expands both campaign and challenge design space

#### 8. Mode Wrappers and Playlist Design

Goal:

- reuse the same core mechanics across different session moods

Candidate playlists:

- `Ranked`: stable competitive preset
- `Chaos`: more anomalies and volatile map rules
- `Ironman`: harsher economy and recovery windows
- `Puzzle Sector`: fixed challenge maps with exact constraints
- `Zen`: slower, lower-pressure macro mode
- `Frontier`: territory-heavy ruleset with stronger staging emphasis

Product value:

- supports different player tastes without fragmenting the controls
- helps the menu feel like a real game shell instead of a single skirmish button

Dependencies:

- mutators
- stronger lobby / manifest configuration
- clearer surfacing of mode-specific rules

Success criteria:

- players self-select into different play styles
- playlists feel intentionally different, not like numeric presets

### Long-Term Roadmap

These items are higher leverage but require stronger foundations first.

#### 9. Competitive Layer: Ranked, Seasons, Spectator, Replay Ecosystem

Goal:

- turn multiplayer into a durable long-term mode

Planned features:

- rating system such as Elo / MMR
- ranked queues or ranked room structure
- seasons with soft resets
- profile progress and lightweight cosmetics
- live spectator mode
- replay browser, match history, and share tools
- richer post-match summaries with timeline and economy breakdowns

Implementation considerations:

- avoid building a fake ranked shell without strong reconnection and sync confidence
- spectator should be designed together with replay and authoritative state capture
- progression rewards should not affect gameplay balance

Dependencies:

- robust multiplayer stability
- replay completeness
- basic account / identity layer if long-term persistence expands

Success criteria:

- multiplayer has retention beyond casual room creation
- players can review matches and learn from them
- competitive play feels legitimate rather than improvised

#### 10. Faction Identity Without Unit Spam

Goal:

- add asymmetry without destroying readability

Preferred methods:

- doctrine defaults
- slight differences in territory behavior
- map interaction bonuses
- assimilation or logistics style differences
- faction-specific relationships with anomalies or objectives

Things to avoid:

- many separate unit production lines
- large RTS-style counter charts
- high APM active ability spam

Why this is long-term:

- asymmetry amplifies every balance problem
- it should only be added after the baseline systems are stable and legible

Success criteria:

- factions feel strategically distinct within the same control scheme
- match readability stays high even for new players

#### 11. Social and Community Features

Goal:

- support player retention beyond individual matches

Possible features:

- shared challenge seeds
- featured daily / weekly sectors
- replay sharing links
- community map spotlight rotation
- tournaments or event playlists
- clan / squad support if the multiplayer audience justifies it

Dependencies:

- replay and playlist infrastructure
- moderation / naming / persistence decisions

Success criteria:

- players have reasons to return even when not grinding ranked
- the game can surface community-created or curated experiences

### Delivery Order

If development time is limited, the recommended order is:

1. territory 2.0 and contested fronts
2. sector mutators v1
3. AI frontier awareness
4. visual readability pass
5. commander / doctrine system
6. campaign expansion plus PvE objective framework
7. playlist design
8. ranked / spectator / replay ecosystem
9. faction identity
10. social layer

This order favors systems that:

- improve the current game immediately
- reuse the existing codebase and rules
- strengthen the game's unique identity before expanding outer shell features

### What Not To Do

To keep the game coherent, avoid these traps:

- do not add a giant tech tree just because strategy games often have one
- do not add many unit types if map control already creates sufficient depth
- do not overload mobile with ability bars and tiny buttons
- do not let spectacle outrun readability
- do not solve AI weakness purely with unfair production cheats
- do not add one-off mechanics that only function in a single obscure mode

### Success Metrics

The roadmap should ultimately improve a few measurable outcomes:

- more distinct match stories
- stronger replayability across seeds and modes
- fewer "AI feels dumb" moments
- more meaningful use of parked fleets, territory, and map features
- better campaign identity
- stronger multiplayer retention

If a future feature does not improve one of those outcomes, it should be questioned before implementation.

## License

Private project.
