$ErrorActionPreference = 'Stop'
$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$settingsPath = Join-Path $workspacePath '.env.evolution.local'
if (-not (Test-Path -LiteralPath $settingsPath)) {
    function New-EvolutionSecret {
        $secretBytes = New-Object byte[] 32
        $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($secretBytes) } finally { $generator.Dispose() }
        return [Convert]::ToBase64String($secretBytes)
    }
    @(
        "EVOLUTION_APP_KEY=base64:$(New-EvolutionSecret)"
        "EVOLUTION_DB_PASSWORD=$(New-EvolutionSecret)"
        "EVOLUTION_WORKER_TOKEN=$(New-EvolutionSecret)"
        'EVOLUTION_OWNER_EMAIL=owner@teamfight.local'
        "EVOLUTION_OWNER_PASSWORD=$(New-EvolutionSecret)"
    ) | Set-Content -LiteralPath $settingsPath -Encoding ascii
}
Write-Output 'Local settings ready in .env.evolution.local. Existing secrets were preserved.'

if (-not (Select-String -LiteralPath $settingsPath -Pattern '^ONLINE_WORKER_TOKEN=' -Quiet)) {
    $workerBytes = New-Object byte[] 32
    $workerGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $workerGenerator.GetBytes($workerBytes) } finally { $workerGenerator.Dispose() }
    Add-Content -LiteralPath $settingsPath -Value ('ONLINE_WORKER_TOKEN=' + [Convert]::ToBase64String($workerBytes)) -Encoding ascii
}
