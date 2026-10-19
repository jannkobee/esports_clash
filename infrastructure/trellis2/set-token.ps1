param()
$ErrorActionPreference = 'Stop'

$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$tokenDirectory = Join-Path $workspacePath '.local-tools/trellis2'
$tokenPath = Join-Path $tokenDirectory 'hf-token.txt'
$pins = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'model-pins.json') -Raw | ConvertFrom-Json
$checkpoint = $pins.files | Where-Object { $_.repo -eq 'facebook/dinov3-vitl16-pretrain-lvd1689m' -and $_.remote -eq 'config.json' } | Select-Object -First 1
if (-not $checkpoint) { throw 'Official DINOv3 checkpoint configuration is missing.' }

$maskedToken = Read-Host 'Paste your Hugging Face read token (input is hidden)' -AsSecureString
$tokenPointer = [IntPtr]::Zero
$plainToken = $null
try {
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($maskedToken)
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
    if ($plainToken -notmatch '^hf_[A-Za-z0-9]+$') { throw 'Expected a Hugging Face access token beginning with hf_.' }
    $checkpointUrl = 'https://huggingface.co/' + $checkpoint.repo + '/resolve/' + $checkpoint.revision + '/' + $checkpoint.remote
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Head -Uri $checkpointUrl -Headers @{Authorization = 'Bearer ' + $plainToken} -TimeoutSec 30
        if ($response.StatusCode -ne 200) { throw 'Checkpoint access was not confirmed.' }
    } catch {
        throw 'DINOv3 access check failed. Confirm this token belongs to your approved account and can read public gated repositories. Any existing token file was preserved.'
    }
    New-Item -ItemType Directory -Force -Path $tokenDirectory | Out-Null
    [IO.File]::WriteAllText($tokenPath, $plainToken, (New-Object Text.UTF8Encoding($false)))
    Write-Output 'Official DINOv3 access verified. Token saved in the ignored .local-tools/trellis2/hf-token.txt file.'
    Write-Output 'Tell Codex: token ready. The supplied game model remains selected.'
} finally {
    if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    $plainToken = $null
    if ($maskedToken) { $maskedToken.Dispose() }
}
