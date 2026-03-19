#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-docker}"

deploy_local() {
    echo "=== Solarmax yerel deploy: build + node sunucu (dist mode) ==="
    npm run build
    PORT="${PORT:-3000}"
    fuser -k "${PORT}/tcp" 2>/dev/null || true
    sleep 1
    echo "http://localhost:${PORT} — calisiyor (Ctrl+C ile durdur)"
    exec node server.js
}

if [ "$MODE" = "local" ]; then
    deploy_local
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    echo "Hata: docker compose bulunamadi." >&2
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "Hata: Docker daemon erisilemiyor." >&2
    exit 1
fi

if ! docker network inspect npm-net >/dev/null 2>&1; then
    echo "npm-net agi bulunamadi, olusturuluyor..."
    docker network create npm-net >/dev/null
fi

echo "Solarmax deploy basliyor..."
"${COMPOSE_CMD[@]}" up -d --build

echo
echo "Canli konteyner durumu:"
"${COMPOSE_CMD[@]}" ps

echo
echo "Servis edilen bundle:"
LIVE_BUNDLE=""
for _ in $(seq 1 15); do
    LIVE_BUNDLE="$(docker exec solarmax-app sh -lc "grep -o 'assets/game-[^\"]*' /app/dist/stellar_conquest.html | head -n 1" 2>/dev/null || true)"
    if [ -n "$LIVE_BUNDLE" ]; then
        break
    fi
    sleep 1
done

if [ -n "$LIVE_BUNDLE" ]; then
    echo "$LIVE_BUNDLE"
else
    echo "Uyari: konteyner ayaga kalkti ama bundle dogrulamasi zamaninda alinmadi." >&2
fi
