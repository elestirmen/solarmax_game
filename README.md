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

## License

Private project.
