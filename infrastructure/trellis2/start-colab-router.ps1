# Run from any directory after the normal evolution stack is installed.
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $taskRoot
try {
    $env:TRELLIS_IMAGE_ID = (& docker image inspect teamfight-trellis2:pilot --format '{{.Id}}').Trim()
    if ($LASTEXITCODE -ne 0 -or $env:TRELLIS_IMAGE_ID -notmatch '^sha256:[a-f0-9]{64}$') {
        throw 'The installed native TRELLIS image is required.'
    }
    & docker compose --project-name teamfight-evolution --env-file .env.evolution.local `
        -f compose.evolution.yaml -f compose.evolution.dev.yaml -f compose.unirig.yaml `
        -f compose.colab-router.yaml up -d --no-deps `
        trellis-worker trellis-router avatar-worker api worker scheduler avatar-queue-worker
    if ($LASTEXITCODE -ne 0) { throw 'Colab router startup failed.' }
} finally {
    Pop-Location
}
