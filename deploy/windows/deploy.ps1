param([Parameter(Mandatory=$true)][string]$SourceDirectory, [string]$Root = 'C:\services\abujalife')
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$config = Read-AbujaLifeConfiguration $Root
$env:ABUJALIFE_WINDOWS_ROOT = $Root
Invoke-CheckedNative $config.nodePath @((Join-Path $PSScriptRoot 'deploy.mjs'), [IO.Path]::GetFullPath($SourceDirectory))
