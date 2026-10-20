#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${WORKSPACE_PATH}"

if [ ! -f ".env.evolution.local" ]; then
  "${SCRIPT_DIR}/setup.sh"
fi

COMPOSE_ARGS=(compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.evolution.dev.yaml)

if [ "${1:-}" = "--stop" ] || [ "${1:-}" = "stop" ]; then
  docker "${COMPOSE_ARGS[@]}" stop web frontend-dev api worker scheduler avatar-queue-worker
  echo "Stopped development services."
elif [ "${1:-}" = "--down" ] || [ "${1:-}" = "down" ]; then
  docker "${COMPOSE_ARGS[@]}" down
  echo "Tore down all evolution services."
else
  # Ensure database and redis are running first
  docker compose --env-file .env.evolution.local -f compose.evolution.yaml up -d database avatar-redis

  # Run migrations and seed/catalog bootstrap if needed
  docker compose --env-file .env.evolution.local -f compose.evolution.yaml run --rm init

  # Build dev frontend and start services
  docker "${COMPOSE_ARGS[@]}" build frontend-dev
  docker "${COMPOSE_ARGS[@]}" up -d --wait --wait-timeout 120 --no-deps api worker scheduler avatar-queue-worker frontend-dev
  docker "${COMPOSE_ARGS[@]}" up -d --no-deps web

  echo ""
  echo "=========================================================="
  echo "🚀 Esports Clash Evolution Dev Stack is ready!"
  echo "👉 Evolution Lab / Owner Dashboard: http://localhost:8089"
  echo "👉 Game Frontend (Dev Mode):         http://localhost:8088"
  echo "=========================================================="
fi

