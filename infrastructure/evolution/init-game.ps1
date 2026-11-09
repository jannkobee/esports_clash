param(
    [Parameter(Mandatory = $true)][string]$OwnerFile,
    [string]$EnvironmentFile = '.env.evolution.local',
    [switch]$Development
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repoRoot
try {
    $privateInput = (Resolve-Path -LiteralPath $OwnerFile).Path
    $environment = (Resolve-Path -LiteralPath $EnvironmentFile).Path
    $compose = @('compose', '--env-file', $environment, '-f', 'compose.evolution.yaml')
    if ($Development) { $compose += @('-f', 'compose.evolution.dev.yaml') }
    # This file contains credentials. Never print its contents or pass them as command arguments.
    $remoteInput = '/tmp/hexatrick-init-' + [guid]::NewGuid().ToString('N') + '.json'
    & docker @compose cp $privateInput ('api:' + $remoteInput)
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy private owner input to the API.' }
    try {
        & docker @compose exec -T api php artisan game:init ('--owner-file=' + $remoteInput)
        if ($LASTEXITCODE -ne 0) { throw 'Game initialization stopped. Resolve the reported prerequisite and rerun; do not reset the database.' }
    } finally {
        & docker @compose exec -T api rm -f -- $remoteInput
    }
} finally { Pop-Location }
