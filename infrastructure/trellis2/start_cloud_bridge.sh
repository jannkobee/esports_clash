#!/usr/bin/env bash
set -e

PORT="${TRELLIS_BRIDGE_PORT:-8096}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/../../.local-tools/trellis2/data"
mkdir -p "${LOG_DIR}"

# Check if already running on the port
PID=$(lsof -t -i :${PORT} 2>/dev/null || true)
if [ -n "${PID}" ]; then
    echo "[CloudBridge] Terminating existing process ${PID} on port ${PORT}..."
    kill -9 ${PID} 2>/dev/null || true
    sleep 1
fi

echo "[CloudBridge] Starting Cloud Bridge on 0.0.0.0:${PORT}..."
nohup python3 "${SCRIPT_DIR}/cloud_bridge.py" "${PORT}" > "${LOG_DIR}/bridge.log" 2>&1 &
NEW_PID=$!
disown "${NEW_PID}" 2>/dev/null || true
echo "[CloudBridge] Started with PID ${NEW_PID}. Logs: ${LOG_DIR}/bridge.log"

for i in {1..10}; do
    if curl -s "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
        echo "[CloudBridge] Healthcheck passed on port ${PORT}."
        exit 0
    fi
    sleep 0.5
done

echo "[CloudBridge] Warning: Healthcheck did not respond within 5 seconds; check ${LOG_DIR}/bridge.log"
exit 1
