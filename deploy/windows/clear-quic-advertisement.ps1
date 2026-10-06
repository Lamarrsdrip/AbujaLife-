param(
  [string]$CaddyDirectory = 'C:\Caddy'
)
# AbujaLife-only. Does not edit Okrika or any other site block.
# Caddy advertises HTTP/3 by default. This VPS does not answer UDP 443, so
# Safari keeps the Alt-Svc hint and then hangs on the next visit. Clearing it
# on the API origin sends those clients back to the working HTTP/2 listener.
$ErrorActionPreference = 'Stop'
$exe = Join-Path $CaddyDirectory 'caddy.exe'
$config = Join-Path $CaddyDirectory 'Caddyfile'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf) -or -not (Test-Path -LiteralPath $config -PathType Leaf)) {
  throw 'The existing Caddy installation/configuration was not found.'
}
$current = [IO.File]::ReadAllText($config)
$match = [regex]::Match($current, '(?m)^api\.abujacity\.life\s*\{')
if (-not $match.Success) {
  Write-Output 'AbujaLife API vhost is not in this Caddyfile; left it untouched.'
  exit 0
}
$open = $match.Index + $match.Length
$depth = 1
$i = $open
while ($i -lt $current.Length -and $depth -gt 0) {
  $ch = $current[$i]
  if ($ch -eq '{') { $depth++ }
  elseif ($ch -eq '}') { $depth-- }
  $i++
}
if ($depth -ne 0) { throw 'The AbujaLife API vhost braces are unbalanced; Caddy was left untouched.' }
$block = $current.Substring($match.Index, $i - $match.Index)
if ($block -match 'Alt-Svc') {
  Write-Output 'AbujaLife API already clears the HTTP/3 advertisement.'
  exit 0
}
$updated = $current.Substring(0, $open) + "`r`n    header Alt-Svc clear" + $current.Substring($open)
$candidate = $config + '.abujalife-h3-candidate'
$backup = $config + '.before-abujalife-h3-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
[IO.File]::WriteAllText($candidate, $updated, [Text.UTF8Encoding]::new($false))
try {
  & $exe validate --config $candidate --adapter caddyfile
  if ($LASTEXITCODE -ne 0) { throw 'Caddy rejected the HTTP/3 advertisement clear; the active configuration was left untouched.' }
  [IO.File]::Replace($candidate, $config, $backup)
  try {
    & $exe reload --config $config --adapter caddyfile
    if ($LASTEXITCODE -ne 0) { throw 'Caddy reload failed.' }
    Write-Output ('AbujaLife API no longer advertises HTTP/3. Previous Caddyfile: ' + $backup)
  } catch {
    $activationError = $_.Exception.Message
    $rollback = $config + '.rollback-h3'
    [IO.File]::Copy($backup, $rollback, $true)
    [IO.File]::Replace($rollback, $config, $null)
    & $exe reload --config $config --adapter caddyfile
    if ($LASTEXITCODE -ne 0) { throw "HTTP/3 advertisement clear failed ($activationError) and Caddy rollback reload failed." }
    throw "HTTP/3 advertisement clear failed ($activationError); the previous Caddy configuration was restored."
  }
} finally {
  Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath ($config + '.rollback-h3') -Force -ErrorAction SilentlyContinue
}
