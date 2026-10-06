param(
  [string]$CaddyDirectory = 'C:\Caddy',
  [string]$Root = 'C:\services\abujalife',
  [int]$Port = 18787
)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Invalid private API port.' }
$exe = Join-Path $CaddyDirectory 'caddy.exe'
$config = Join-Path $CaddyDirectory 'Caddyfile'
$current = [IO.File]::ReadAllText($config)
if ($current -match '(?m)^api\.abujacity\.life\s*\{') {
  Write-Output 'AbujaLife hostname already configured; inspect existing vhost before editing.'
  exit 0
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$config.before-abujalife-$stamp"
$candidate = "$config.abujalife-candidate"
$logs = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$logPath = ($logs -replace '\\','/') + '/access.json'
$snippet = @"

api.abujacity.life {
    encode zstd gzip
    header Alt-Svc clear
    request_body {
        max_size 1MB
    }
    reverse_proxy 127.0.0.1:$Port {
        flush_interval -1
    }
    log {
        output file $logPath {
            roll_size 10MiB
            roll_keep 10
            roll_keep_for 336h
        }
    }
}
"@
[IO.File]::WriteAllText($candidate, $current.TrimEnd() + "`r`n" + $snippet + "`r`n", [Text.UTF8Encoding]::new($false))
& $exe validate --config $candidate --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy validation failed; active configuration preserved.' }
Copy-Item -LiteralPath $config -Destination $backup
Copy-Item -LiteralPath $candidate -Destination $config -Force
& $exe reload --config $config --adapter caddyfile
if ($LASTEXITCODE -ne 0) {
  Copy-Item -LiteralPath $backup -Destination $config -Force
  & $exe reload --config $config --adapter caddyfile
  throw 'Caddy reload failed; previous configuration restored.'
}
Write-Output ('AbujaLife vhost reloaded. Original configuration: ' + $backup)
