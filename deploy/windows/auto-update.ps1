param([string]$Root = 'C:\services\abujalife')
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$config = Read-AbujaLifeConfiguration $Root
$repo = 'https://github.com/Lamarrsdrip/AbujaLife-.git'
$statePath = Join-Path $Root 'shared\state\auto-deploy.json'
$stagingRoot = Join-Path $Root 'staging\auto-deploy'
$gitPath = 'C:\Program Files\Git\cmd\git.exe'
$headers = @{ 'User-Agent' = 'AbujaLife-production-updater'; 'Accept' = 'application/vnd.github+json' }

function Write-State([hashtable]$State) {
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

try {
    $sha = $null
    $remote = (& $gitPath ls-remote $repo 'refs/heads/main' 2>$null | Select-Object -First 1)
    if (-not $remote -or $remote -notmatch '^([0-9a-f]{40})\s') { throw 'Unable to resolve the public main branch.' }
    $sha = $Matches[1]
    $currentPath = Join-Path $Root 'shared\state\current.json'
    $current = if (Test-Path -LiteralPath $currentPath) { Get-Content $currentPath -Raw | ConvertFrom-Json } else { $null }
    if ($current -and [string]$current.revision -eq $sha) { exit 0 }

    $checks = Invoke-RestMethod -Uri "https://api.github.com/repos/Lamarrsdrip/AbujaLife-/commits/$sha/check-runs" -Headers $headers -Method Get
    $required = @($checks.check_runs | Where-Object { $_.name -in @('qa', 'windows', 'build-and-publish') })
    if ($required.Count -lt 3 -or @($required | Where-Object { $_.status -ne 'completed' -or $_.conclusion -ne 'success' }).Count) {
        Write-State @{ status = 'waiting-for-ci'; revision = $sha; checkedAt = (Get-Date).ToUniversalTime().ToString('o') }
        exit 0
    }

    if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
    $source = Join-Path $stagingRoot $sha
    & $gitPath clone --depth 1 --branch main $repo $source
    if ($LASTEXITCODE -ne 0) { throw 'The production source clone failed.' }
    # The Windows promotion verifies the signed release manifest. Build the
    # same clean source archive used by the owner Mac before invoking it.
    $archive = Join-Path $stagingRoot ($sha + '.tar.gz')
    & $config.nodePath (Join-Path $source 'deploy\package-release.mjs') $archive
    if ($LASTEXITCODE -ne 0) { throw 'The production release package failed.' }
    $packaged = Join-Path $stagingRoot ($sha + '-RELEASE')
    New-Item -ItemType Directory -Path $packaged -Force | Out-Null
    tar.exe -xf $archive -C $packaged
    if ($LASTEXITCODE -ne 0) { throw 'The production release archive could not be extracted.' }
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $packaged 'deploy\windows\deploy.ps1') -SourceDirectory $packaged -Root $Root
    if ($LASTEXITCODE -ne 0) { throw "The AbujaLife release promotion failed with exit code $LASTEXITCODE." }
    Write-State @{ status = 'deployed'; revision = $sha; deployedAt = (Get-Date).ToUniversalTime().ToString('o') }
} catch {
    Write-State @{ status = 'failed'; revision = $sha; error = $_.Exception.Message; checkedAt = (Get-Date).ToUniversalTime().ToString('o') }
    throw
}
