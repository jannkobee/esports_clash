param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location -LiteralPath $workspacePath
try {
    $composeArgs = @('compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml', '-f', 'compose.evolution.dev.yaml')
    if ($Stop) {
        # Stop the dev-facing processes only; training and evidence stay running.
        & docker @composeArgs stop web frontend-dev
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop development frontend.' }
        & docker compose --env-file .env.evolution.local -f compose.evolution.yaml up -d --no-deps api worker scheduler avatar-queue-worker web
    } else {
        if (-not (Test-Path -LiteralPath '.env.evolution.local')) { throw 'Run infrastructure/evolution/setup.ps1 and the base deployment first.' }
        & docker @composeArgs build frontend-dev
        if ($LASTEXITCODE -ne 0) { throw 'Development image build failed.' }
        # Never recreate runner, avatar-worker, match-worker, database or init.
        & docker @composeArgs up -d --wait --wait-timeout 120 --no-deps api worker scheduler avatar-queue-worker frontend-dev
        if ($LASTEXITCODE -ne 0) { throw 'Development services failed to start.' }
        & docker @composeArgs up -d --no-deps web
    }
    if ($LASTEXITCODE -ne 0) { throw 'Development mode switch failed.' }
} finally { Pop-Location }
