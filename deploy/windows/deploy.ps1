param([Parameter(Mandatory=$true)][string]$SourceDirectory, [string]$Root = 'C:\services\abujalife')
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$config = Read-AbujaLifeConfiguration $Root
$env:ABUJALIFE_WINDOWS_ROOT = $Root
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'auto-update.ps1')) {
    $runtime = Join-Path $Root 'shared\runtime'
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'auto-update.ps1') -Destination (Join-Path $runtime 'auto-update.ps1') -Force
}
Invoke-CheckedNative $config.nodePath @((Join-Path $PSScriptRoot 'deploy.mjs'), [IO.Path]::GetFullPath($SourceDirectory))
