param([ValidateSet('status','reload','stop','start','backup')][string]$Action = 'status', [string]$Root = 'C:\services\abujalife')
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$config = Read-AbujaLifeConfiguration $Root
if ($Action -eq 'status') {
    Get-Service -Name 'AbujaLifeMongoDB' | Select-Object Name,Status,StartType
    Get-ScheduledTask -TaskName 'AbujaLife-API','AbujaLife-Backup' | Select-Object TaskName,State
    Get-Content -LiteralPath (Join-Path $Root 'shared\state\current.json') -ErrorAction SilentlyContinue
    Get-Content -LiteralPath (Join-Path $Root 'shared\run\supervisor-state.json') -ErrorAction SilentlyContinue
    return
}
if ($Action -eq 'backup') { Start-ScheduledTask -TaskName 'AbujaLife-Backup'; return }
if ($Action -eq 'start') { Enable-ScheduledTask -TaskName 'AbujaLife-API' | Out-Null; Start-ScheduledTask -TaskName 'AbujaLife-API'; return }
$command = @{id=[Guid]::NewGuid().ToString(); command=$Action; requestedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json
$file = Join-Path $Root 'shared\run\api-control.json'
$temp = $file + '.operator.partial'
[IO.File]::WriteAllText($temp, $command, (New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $temp -Destination $file -Force
if ($Action -eq 'stop') {
    Disable-ScheduledTask -TaskName 'AbujaLife-API' | Out-Null
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $deadline) {
        $state = Get-Content -LiteralPath (Join-Path $Root 'shared\run\supervisor-state.json') -Raw | ConvertFrom-Json
        if ($state.status -eq 'stopped') { Write-Output 'Only the AbujaLife API stopped gracefully; task disabled for maintenance.'; return }
        Start-Sleep -Milliseconds 500
    }
    throw 'AbujaLife did not confirm graceful shutdown. Inspect its logs before restoring; no forced stop was attempted.'
}
