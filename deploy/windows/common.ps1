Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-AbujaLifeRoot {
    param([Parameter(Mandatory=$true)][string]$Root)
    $resolved = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    if ($resolved -notmatch '^[A-Za-z]:\\(?:services\\)?abujalife$') {
        throw 'Use the isolated C:\services\abujalife or C:\abujalife directory.'
    }
    return $resolved
}

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run from an elevated Administrator PowerShell session.'
    }
}

function Invoke-CheckedNative {
    param([Parameter(Mandatory=$true)][string]$Executable, [string[]]$Arguments = @())
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "A deployment command failed with exit code $LASTEXITCODE." }
}

function Read-AbujaLifeConfiguration {
    param([string]$Root)
    $Root = Assert-AbujaLifeRoot $Root
    return Get-Content -LiteralPath (Join-Path $Root 'shared\windows.json') -Raw | ConvertFrom-Json
}
