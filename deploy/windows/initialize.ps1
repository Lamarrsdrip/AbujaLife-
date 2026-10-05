param(
    [string]$Root = 'C:\services\abujalife',
    [string]$NodePath = 'C:\Program Files\nodejs\node.exe',
    [string]$MongodPath = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe',
    [Parameter(Mandatory=$true)][string]$MongoToolsDirectory,
    [Parameter(Mandatory=$true)][string]$PublicWebUrl,
    [Parameter(Mandatory=$true)][string]$ApiPublicUrl
)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
foreach ($file in @($NodePath, $MongodPath, (Join-Path $MongoToolsDirectory 'mongodump.exe'), (Join-Path $MongoToolsDirectory 'mongorestore.exe'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required installed runtime/tool is missing: $file" }
}
if ([int]((& $NodePath --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Node 24 or newer is required.' }
$existingListener = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
$existingService = Get-Service -Name 'AbujaLifeMongoDB' -ErrorAction SilentlyContinue
if ($existingListener -and -not $existingService) { throw 'Port 27017 is occupied. Stop and investigate; existing Mongo services must not be altered.' }
New-Item -ItemType Directory -Path $Root -Force | Out-Null
# SID-based ACL works independently of Windows installation language.
Invoke-CheckedNative 'icacls.exe' @($Root, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F')
$existingShared = Join-Path $Root 'shared'
if (Test-Path -LiteralPath $existingShared -PathType Container) {
    # Recover interrupted setup before Node overwrites existing runtime files.
    # Parent inheritance contains only Admin/SYSTEM; LocalService directory-only
    # traverse grants cannot propagate into privileged secret files.
    Invoke-CheckedNative 'icacls.exe' @($existingShared, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '/Q')
    Invoke-CheckedNative 'icacls.exe' @($existingShared, '/inheritance:e', '/T', '/Q')
}
$env:ABUJALIFE_WINDOWS_ROOT = $Root
Invoke-CheckedNative $NodePath @((Join-Path $PSScriptRoot 'initialize.mjs'), $Root, $NodePath, $MongodPath, $MongoToolsDirectory, $PublicWebUrl, $ApiPublicUrl)
Invoke-CheckedNative 'icacls.exe' @((Join-Path $Root 'shared'), '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '/Q')
# Existing files must inherit the subsequently granted narrow directory ACLs.
# A protected ACL on every child would prevent the LocalService launcher from
# reading its already-created runtime files. Root/shared inherit only Admin/SYSTEM.
Invoke-CheckedNative 'icacls.exe' @((Join-Path $Root 'shared'), '/inheritance:e', '/T', '/Q')
# LocalService may execute read-only releases and read only its own runtime
# secrets. Privileged Mongo/backup keys and database files remain inaccessible.
foreach ($directory in @($Root, (Join-Path $Root 'shared'))) { Invoke-CheckedNative 'icacls.exe' @($directory, '/grant:r', '*S-1-5-19:(RX)', '/Q') }
foreach ($directory in @((Join-Path $Root 'releases'), (Join-Path $Root 'shared\state'), (Join-Path $Root 'shared\runtime'))) { Invoke-CheckedNative 'icacls.exe' @($directory, '/grant:r', '*S-1-5-19:(OI)(CI)RX', '/Q') }
foreach ($directory in @((Join-Path $Root 'shared\run'), (Join-Path $Root 'shared\logs'))) { Invoke-CheckedNative 'icacls.exe' @($directory, '/grant:r', '*S-1-5-19:(OI)(CI)M', '/Q') }
foreach ($file in @((Join-Path $Root 'shared\windows.json'), (Join-Path $Root 'shared\providers.json'), (Join-Path $Root 'shared\.secrets\mongo-app-password'), (Join-Path $Root 'shared\.secrets\config-key'))) { Invoke-CheckedNative 'icacls.exe' @($file, '/grant:r', '*S-1-5-19:R', '/Q') }
Invoke-CheckedNative 'icacls.exe' @((Join-Path $Root 'shared\.secrets'), '/grant:r', '*S-1-5-19:(X)', '/Q')
$mongoConfig = Join-Path $Root 'shared\mongo\mongod.yml'
if ($existingService) {
    $serviceDetails = Get-CimInstance Win32_Service -Filter "Name='AbujaLifeMongoDB'"
    if ($serviceDetails.PathName -notlike "*$mongoConfig*" -or $serviceDetails.PathName -notlike '*mongod.exe*') { throw 'An unexpected executable owns AbujaLifeMongoDB. Refusing to modify it.' }
} else {
    Invoke-CheckedNative $MongodPath @('--config', $mongoConfig, '--install', '--serviceName', 'AbujaLifeMongoDB', '--serviceDisplayName', 'AbujaLife private MongoDB', '--serviceDescription', 'Isolated AbujaLife MongoDB replica set; loopback 27017; independent of Okrika.')
}
Set-Service -Name 'AbujaLifeMongoDB' -StartupType Automatic
Invoke-CheckedNative 'sc.exe' @('failure', 'AbujaLifeMongoDB', 'reset=', '86400', 'actions=', 'restart/5000/restart/15000/restart/30000')
Start-Service -Name 'AbujaLifeMongoDB'
(Get-Service -Name 'AbujaLifeMongoDB').WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
# This rule is scoped to only AbujaLife's private ports and never edits Okrika rules.
$rule = Get-NetFirewallRule -DisplayName 'AbujaLife private Mongo/API ports' -ErrorAction SilentlyContinue
if (-not $rule) { New-NetFirewallRule -DisplayName 'AbujaLife private Mongo/API ports' -Direction Inbound -Action Block -Protocol TCP -LocalPort 27017,18787,18788 -Profile Any | Out-Null }
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Push-Location $sourceRoot
try {
    $npm = Join-Path (Split-Path $NodePath -Parent) 'node_modules\npm\bin\npm-cli.js'
    if (-not (Test-Path (Join-Path $sourceRoot 'node_modules\mongodb\package.json'))) { Invoke-CheckedNative $NodePath @($npm, 'ci', '--no-audit', '--no-fund') }
    Invoke-CheckedNative $NodePath @((Join-Path $PSScriptRoot 'bootstrap-mongo.mjs'))
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'install-tasks.ps1') -Root $Root
Write-Output 'AbujaLife private MongoDB, server-only secrets, firewall scope, and startup/backup tasks are initialized. No Okrika resource was modified.'
