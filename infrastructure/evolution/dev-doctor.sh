#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${WORKSPACE_PATH}"

# ANSI Tactical Palette
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_CYAN="\033[38;2;56;189;248m"
CLR_GREEN="\033[38;2;34;197;94m"
CLR_AMBER="\033[38;2;245;158;11m"
CLR_RED="\033[38;2;239;68;68m"
CLR_MUTED="\033[38;2;100;116;139m"

TOTAL_PASS=0
TOTAL_WARN=0
TOTAL_FAIL=0

check_pass() {
    local label="$1"
    local detail="${2:-}"
    TOTAL_PASS=$((TOTAL_PASS + 1))
    echo -e "  [${CLR_GREEN}PASS${CLR_RESET}] ${label} ${CLR_MUTED}${detail}${CLR_RESET}"
}

check_warn() {
    local label="$1"
    local detail="${2:-}"
    TOTAL_WARN=$((TOTAL_WARN + 1))
    echo -e "  [${CLR_AMBER}WARN${CLR_RESET}] ${label} ${CLR_AMBER}${detail}${CLR_RESET}"
}

check_fail() {
    local label="$1"
    local detail="${2:-}"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    echo -e "  [${CLR_RED}FAIL${CLR_RESET}] ${label} ${CLR_RED}${detail}${CLR_RESET}"
}

echo -e "${CLR_CYAN}${CLR_BOLD}"
echo "================================================================================"
echo "   ESPORTS CLASH EVOLUTION STACK // DIAGNOSTIC DOCTOR & HEALTH MONITOR"
echo "================================================================================"
echo -e "${CLR_RESET}"

# 1. System & Tools Prerequisites
echo -e "${CLR_BOLD}>> 1. HOST ENVIRONMENT & TOOLCHAINS${CLR_RESET}"

if command -v docker >/dev/null 2>&1; then
    DOCKER_VER=$(docker --version | cut -d',' -f1)
    if docker info >/dev/null 2>&1; then
        check_pass "Docker Daemon" "${DOCKER_VER} (running)"
    else
        check_fail "Docker Daemon" "Installed but daemon is not responding / permission denied"
    fi
else
    check_fail "Docker" "Command not found. Install Docker Engine."
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_VER=$(docker compose version --short 2>/dev/null || docker compose version)
    check_pass "Docker Compose" "${COMPOSE_VER}"
else
    check_fail "Docker Compose" "compose plugin missing"
fi

if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    check_pass "Node.js" "${NODE_VER}"
else
    check_warn "Node.js" "Not installed on host (required for local scripts & client tests)"
fi

if command -v curl >/dev/null 2>&1; then
    check_pass "cURL" "Available"
else
    check_warn "cURL" "Not found on host"
fi

# 2. Configuration & Secrets
echo ""
echo -e "${CLR_BOLD}>> 2. SECRETS & CONFIGURATION${CLR_RESET}"

if [ -f ".env.evolution.local" ]; then
    check_pass "Environment File" ".env.evolution.local present"
    if grep -q '^EVOLUTION_APP_KEY=base64:' .env.evolution.local; then
        check_pass "Application Key" "Configured"
    else
        check_fail "Application Key" "Missing EVOLUTION_APP_KEY in .env.evolution.local"
    fi
    if grep -q '^ONLINE_WORKER_TOKEN=' .env.evolution.local; then
        check_pass "Worker Token" "Configured"
    else
        check_warn "Worker Token" "ONLINE_WORKER_TOKEN missing, run ./infrastructure/evolution/setup.sh"
    fi
else
    check_fail "Environment File" ".env.evolution.local missing! Run: ./infrastructure/evolution/setup.sh"
fi

# 3. Container Services
echo ""
echo -e "${CLR_BOLD}>> 3. EVOLUTION DOCKER SERVICES${CLR_RESET}"

COMPOSE_CMD="docker compose --env-file .env.evolution.local -f compose.evolution.yaml -f compose.evolution.dev.yaml"

check_container() {
    local service="$1"
    local label="$2"
    local cid
    cid=$(${COMPOSE_CMD} ps -q "${service}" 2>/dev/null || true)
    if [ -n "${cid}" ]; then
        local status
        status=$(docker inspect --format='{{.State.Status}}' "${cid}" 2>/dev/null || echo "unknown")
        local health
        health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${cid}" 2>/dev/null || echo "none")
        if [ "${status}" = "running" ]; then
            if [ "${health}" = "healthy" ] || [ "${health}" = "none" ]; then
                check_pass "Service [${label}]" "running (${status}${health:+, health: $health})"
            else
                check_warn "Service [${label}]" "running but health status is: ${health}"
            fi
        else
            check_fail "Service [${label}]" "Container exists but status is: ${status}"
        fi
    else
        check_warn "Service [${label}]" "Not running (start via: ./infrastructure/evolution/dev.sh)"
    fi
}

check_container "database" "PostgreSQL Database"
check_container "avatar-redis" "Avatar Redis Queue"
check_container "api" "Evolution Laravel API"
check_container "web" "Reverse Proxy / Web"
check_container "frontend-dev" "Game Client Dev Server"
check_container "worker" "Background Task Worker"
check_container "avatar-queue-worker" "Avatar 3D Pipeline Worker"

# 4. Service Endpoints & Health Probes
echo ""
echo -e "${CLR_BOLD}>> 4. ENDPOINT CONNECTIVITY & HTTP PROBES${CLR_RESET}"

# Database ping
if ${COMPOSE_CMD} exec -T database pg_isready -U postgres >/dev/null 2>&1; then
    check_pass "PostgreSQL Connection" "pg_isready: accepting connections"
else
    check_warn "PostgreSQL Connection" "Database not reachable or container stopped"
fi

# Redis ping
if ${COMPOSE_CMD} exec -T avatar-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    check_pass "Redis Queue Connection" "PONG received"
else
    check_warn "Redis Queue Connection" "Redis ping failed"
fi

# Backoffice API probe
API_PORT="${EVOLUTION_API_PORT:-8089}"
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/evolution" --max-time 3 2>/dev/null || echo "000")
    if [ "${HTTP_CODE}" = "200" ] || [ "${HTTP_CODE}" = "302" ]; then
        check_pass "Backoffice Lab HTTP" "http://127.0.0.1:${API_PORT}/evolution (HTTP ${HTTP_CODE})"
    elif [ "${HTTP_CODE}" = "000" ]; then
        check_warn "Backoffice Lab HTTP" "Not reachable on port ${API_PORT}"
    else
        check_warn "Backoffice Lab HTTP" "http://127.0.0.1:${API_PORT}/evolution returned HTTP ${HTTP_CODE}"
    fi

    # Web client probe
    WEB_PORT="${EVOLUTION_WEB_PORT:-8088}"
    WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" --max-time 3 2>/dev/null || echo "000")
    if [ "${WEB_CODE}" = "200" ] || [ "${WEB_CODE}" = "304" ]; then
        check_pass "Game Client HTTP" "http://127.0.0.1:${WEB_PORT}/ (HTTP ${WEB_CODE})"
    elif [ "${WEB_CODE}" = "000" ]; then
        check_warn "Game Client HTTP" "Not reachable on port ${WEB_PORT}"
    else
        check_warn "Game Client HTTP" "http://127.0.0.1:${WEB_PORT}/ returned HTTP ${WEB_CODE}"
    fi
fi

# 5. Local Storage & Artifacts Permissions
echo ""
echo -e "${CLR_BOLD}>> 5. STORAGE & PIPELINE DIRECTORIES${CLR_RESET}"

STORAGE_DIRS=(
    "EsportsClash.Api/storage/app/public"
    "EsportsClash.Api/storage/framework/cache"
    "EsportsClash.Api/storage/framework/sessions"
    "EsportsClash.Api/storage/framework/views"
    "EsportsClash.Api/storage/logs"
)

for dir in "${STORAGE_DIRS[@]}"; do
    if [ -d "${dir}" ]; then
        if [ -w "${dir}" ]; then
            check_pass "Directory [${dir}]" "exists & writable"
        else
            check_warn "Directory [${dir}]" "exists but not writable by current user"
        fi
    else
        check_warn "Directory [${dir}]" "does not exist yet"
    fi
done

# Summary & Diagnostics Report
echo ""
echo "================================================================================"
echo -e "   HEALTH SUMMARY: ${CLR_GREEN}${TOTAL_PASS} PASS${CLR_RESET}  ·  ${CLR_AMBER}${TOTAL_WARN} WARN${CLR_RESET}  ·  ${CLR_RED}${TOTAL_FAIL} FAIL${CLR_RESET}"
echo "================================================================================"

if [ ${TOTAL_FAIL} -eq 0 ]; then
    echo -e "${CLR_GREEN}✓ System is healthy and operational.${CLR_RESET}"
    exit 0
else
    echo -e "${CLR_RED}✗ Issues detected. Review the [FAIL] items above.${CLR_RESET}"
    exit 1
fi

