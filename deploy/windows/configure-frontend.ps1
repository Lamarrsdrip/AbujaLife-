param(
  [Parameter(Mandatory=$true)][string]$ReleaseDirectory,
  [string]$Root = 'C:\services\abujalife',
  [string]$CaddyDirectory = 'C:\Caddy'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$releaseFull = [IO.Path]::GetFullPath($ReleaseDirectory).TrimEnd('\')
$releasePrefix = $rootFull + '\releases\'
if (-not $releaseFull.StartsWith($releasePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'The static release must be inside the AbujaLife immutable release directory.' }

$dist = Join-Path $releaseFull 'dist'
$required = @('index.html', 'runtime-config.js', 'sw.js', 'manifest.webmanifest')
foreach ($name in $required) { if (-not (Test-Path -LiteralPath (Join-Path $dist $name) -PathType Leaf)) { throw "The production static build is missing $name." } }
$runtimeConfig = [IO.File]::ReadAllText((Join-Path $dist 'runtime-config.js'))
if ($runtimeConfig -notmatch 'https://api\.abujacity\.life' -or $runtimeConfig -match 'localhost|127\.0\.0\.1') { throw 'The static runtime configuration does not target the production API.' }
$releaseManifest = Get-Content -LiteralPath (Join-Path $releaseFull 'RELEASE.json') -Raw | ConvertFrom-Json
if ($releaseManifest.mode -ne 'production-mongodb-api' -or $releaseManifest.publicOrigin -ne 'https://abujacity.life' -or $releaseManifest.apiPublicOrigin -ne 'https://api.abujacity.life' -or $releaseManifest.revision -notmatch '^[a-f0-9]{40}$') { throw 'The static build is not attached to a valid production release manifest.' }

$exe = Join-Path $CaddyDirectory 'caddy.exe'
$config = Join-Path $CaddyDirectory 'Caddyfile'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf) -or -not (Test-Path -LiteralPath $config -PathType Leaf)) { throw 'The existing Caddy installation/configuration was not found.' }
$current = [IO.File]::ReadAllText($config)
$begin = '# BEGIN ABUJALIFE FRONTEND'
$end = '# END ABUJALIFE FRONTEND'
$beginCount = ([regex]::Matches($current, [regex]::Escape($begin))).Count
$endCount = ([regex]::Matches($current, [regex]::Escape($end))).Count
if ($beginCount -ne $endCount -or $beginCount -gt 1) { throw 'The managed AbujaLife Caddy section is malformed; active configuration was left untouched.' }
if ($beginCount -eq 0 -and ($current -match '(?m)^abujacity\.life\s*\{' -or $current -match '(?m)^www\.abujacity\.life\s*\{')) { throw 'An unmanaged AbujaLife web site already exists in Caddy; inspect it before changing the configuration.' }

$rootPath = $dist -replace '\\', '/'
$logs = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$logPath = (($logs -replace '\\', '/') + '/frontend-access.json')
$snippet = @"
$begin
abujacity.life {
    encode zstd gzip
    root * $rootPath
    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-Frame-Options DENY
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        Alt-Svc "clear"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://api.abujacity.life https://overpass-api.de; frame-src https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests"
    }
    @noCache {
        path / /index.html /admin /admin/ /admin.html /admin/index.html /runtime-config.js /sw.js /manifest.webmanifest /RELEASE.json *.js *.css
        not path /assets/*
    }
    header @noCache Cache-Control "no-cache, no-store, must-revalidate"
    @immutable path /assets/*
    header @immutable Cache-Control "public, max-age=31536000, immutable"
    @static {
        path *.png *.jpg *.jpeg *.svg *.webp *.avif *.ico *.woff *.woff2 *.ttf *.otf *.eot *.mp3 *.wav *.ogg *.glb *.gltf *.bin
        not path /assets/*
    }
    header @static Cache-Control "public, max-age=3600"
    @admin path /admin /admin/ /admin/*
    rewrite @admin /admin/index.html
    try_files {path} {path}/ /index.html
    file_server
    log {
        output file $logPath {
            roll_size 10MiB
            roll_keep 10
            roll_keep_for 336h
        }
    }
}

www.abujacity.life {
    redir https://abujacity.life{uri} 308
}
$end
"@

$candidate = Join-Path $CaddyDirectory 'Caddyfile.abujalife-frontend-candidate'
$backup = $config + '.before-abujalife-frontend-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$replacement = if ($beginCount -eq 1) {
  [regex]::Replace($current, '(?s)# BEGIN ABUJALIFE FRONTEND.*?# END ABUJALIFE FRONTEND', $snippet.Trim())
} else {
  $current.TrimEnd() + "`r`n`r`n" + $snippet.Trim() + "`r`n"
}
[IO.File]::WriteAllText($candidate, $replacement, [Text.UTF8Encoding]::new($false))
try {
  & $exe validate --config $candidate --adapter caddyfile
  if ($LASTEXITCODE -ne 0) { throw 'Caddy rejected the candidate configuration; the active configuration was left untouched.' }
  [IO.File]::Replace($candidate, $config, $backup)
  try {
    & $exe reload --config $config --adapter caddyfile
    if ($LASTEXITCODE -ne 0) { throw 'Caddy reload failed.' }
    $health = Invoke-RestMethod -Uri 'https://api.abujacity.life/health' -Method Get -TimeoutSec 8
    if ($health.ok -ne $true -or $health.storage -ne 'mongodb') { throw 'The Mongo-backed API health check failed after Caddy reload.' }
    $statePath = Join-Path $Root 'shared\state\frontend.json'
    $state = @{ revision = [string]$releaseManifest.revision; releaseDirectory = $releaseFull; switchedAt = [DateTime]::UtcNow.ToString('o'); caddyBackup = $backup }
    $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output ("AbujaLife frontend now serves release " + $state.revision + "; previous Caddyfile: " + $backup)
  } catch {
    $activationError = $_.Exception.Message
    $rollback = $config + '.rollback'
    [IO.File]::Copy($backup, $rollback, $true)
    [IO.File]::Replace($rollback, $config, $null)
    & $exe reload --config $config --adapter caddyfile
    if ($LASTEXITCODE -ne 0) { throw "Frontend activation failed ($activationError) and Caddy rollback reload failed; inspect Caddy immediately." }
    throw "Frontend activation failed ($activationError); the previous Caddy configuration was restored."
  }
} finally {
  Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath ($config + '.rollback') -Force -ErrorAction SilentlyContinue
}
