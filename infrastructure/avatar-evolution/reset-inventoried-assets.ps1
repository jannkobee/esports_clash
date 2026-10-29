param([switch]$Apply,[switch]$Supplemental)
$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.TrimEnd('\')
$inventoryName = if ($Supplemental) { 'asset-reset-20261024-extra-inventory.json' } else { 'asset-reset-20261024-inventory.json' }
$resultName = if ($Supplemental) { 'asset-reset-20261024-extra-receipt.json' } else { 'asset-reset-20261024-local-receipt.json' }
$receiptPath = Join-Path $workspaceRoot ('docs/avatar-rework/' + $inventoryName)
$inventory = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
$approvedTargets = @()
foreach ($entry in $inventory.files) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $entry.path))
    if (-not $candidate.StartsWith($workspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Asset escapes workspace: $candidate" }
    $item = Get-Item -LiteralPath $candidate
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.PSIsContainer) { throw "Unexpected asset target: $candidate" }
    if ($item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Asset changed after inventory: $candidate" }
    $approvedTargets += $candidate
}
if (-not $Apply) { Write-Output "Verified $($approvedTargets.Count) exact files within $workspaceRoot. Use -Apply for the owner-authorized reset."; exit }
foreach ($candidate in $approvedTargets) { Remove-Item -LiteralPath $candidate -Force }
$remaining = @($approvedTargets | Where-Object { Test-Path -LiteralPath $_ })
if ($remaining.Count) { throw 'Some inventoried asset files remain.' }
@{ deleted = $approvedTargets.Count; completed = (Get-Date).ToString('o'); scope = 'all-45-avatar-assets'; remaining = $remaining.Count } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workspaceRoot ('docs/avatar-rework/' + $resultName))
Write-Output "Deleted $($approvedTargets.Count) inventoried avatar asset files."
