#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SETTINGS_PATH="${WORKSPACE_PATH}/.env.evolution.local"

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  fi
}

if [ ! -f "${SETTINGS_PATH}" ]; then
  cat <<EOF > "${SETTINGS_PATH}"
EVOLUTION_APP_KEY=base64:$(generate_secret)
EVOLUTION_DB_PASSWORD=$(generate_secret)
EVOLUTION_WORKER_TOKEN=$(generate_secret)
EVOLUTION_OWNER_EMAIL=owner@teamfight.local
EVOLUTION_OWNER_PASSWORD=$(generate_secret)
EOF
fi

if ! grep -q '^ONLINE_WORKER_TOKEN=' "${SETTINGS_PATH}"; then
  echo "ONLINE_WORKER_TOKEN=$(generate_secret)" >> "${SETTINGS_PATH}"
fi

echo "Local settings ready in .env.evolution.local. Existing secrets were preserved."

