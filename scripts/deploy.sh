#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-docker}"
LIVE_URL="${LIVE_URL:-https://solarmax.urgup.keenetic.link/}"

bundle_from_html() {
    local html="${1:-}"
    printf '%s' "$html" | rg -o 'assets/game-[^"]+' -m 1 || true
}

bundle_from_file() {
    local path="${1:-}"
    if [ ! -f "$path" ]; then
        return 0
    fi
    rg -o 'assets/game-[^"]+' -m 1 "$path" || true
}

bundle_from_container() {
    docker exec solarmax-app sh -lc "grep -o 'assets/game-[^\"]*' /app/dist/stellar_conquest.html | head -n 1" 2>/dev/null || true
}

verify_deploy() {
    local local_bundle=""
    local container_bundle=""
    local live_bundle=""

    local_bundle="$(bundle_from_file "$ROOT_DIR/dist/stellar_conquest.html")"

    for _ in $(seq 1 15); do
        container_bundle="$(bundle_from_container)"
        if [ -n "$container_bundle" ]; then
            break
        fi
        sleep 1
    done

    if [ -n "$LIVE_URL" ]; then
        live_bundle="$(bundle_from_html "$(curl -fsS "$LIVE_URL" 2>/dev/null || true)")"
    fi

    echo "Yerel dist bundle:     ${local_bundle:-bulunamadi}"
    echo "Konteyner bundle:      ${container_bundle:-bulunamadi}"
    if [ -n "$LIVE_URL" ]; then
        echo "Canli URL bundle:      ${live_bundle:-bulunamadi}"
    fi

    if [ -n "$container_bundle" ] && [ -n "$local_bundle" ] && [ "$container_bundle" != "$local_bundle" ]; then
        echo "Hata: konteyner eski bundle servis ediyor." >&2
        return 1
    fi

    if [ -n "$LIVE_URL" ] && [ -n "$container_bundle" ] && [ -n "$live_bundle" ] && [ "$live_bundle" != "$container_bundle" ]; then
        echo "Hata: canli URL eski bundle servis ediyor." >&2
        return 1
    fi
}

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

if [ "$MODE" = "check" ]; then
    verify_deploy
    exit 0
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
echo "Deploy dogrulamasi:"
verify_deploy
