param([string]$Root = 'C:\services\abujalife')
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$Root = Assert-AbujaLifeRoot $Root
$config = Read-AbujaLifeConfiguration $Root
$runtime = Join-Path $Root 'shared\runtime'
foreach ($file in @('runtime.mjs', 'supervisor.mjs', 'backup-run.mjs')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $runtime $file) -Force }
$apiPrincipal = New-ScheduledTaskPrincipal -UserId 'S-1-5-19' -LogonType ServiceAccount -RunLevel Limited
$backupPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$apiSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$apiArgument = '"' + (Join-Path $runtime 'supervisor.mjs') + '"'
# The default service root is explicit in the stable launcher; the environment
# variable is unnecessary for ScheduledTask SYSTEM startup at this standard path.
if ($Root -ne 'C:\services\abujalife') { throw 'Task bootstrap currently requires the documented C:\services\abujalife root.' }
$apiAction = New-ScheduledTaskAction -Execute $config.nodePath -Argument $apiArgument -WorkingDirectory $Root
Register-ScheduledTask -TaskName 'AbujaLife-API' -Action $apiAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $apiPrincipal -Settings $apiSettings -Description 'AbujaLife isolated LocalService Node supervisor; graceful release reload; crash recovery; loopback API.' -Force | Out-Null
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$backupAction = New-ScheduledTaskAction -Execute $config.nodePath -Argument ('"' + (Join-Path $runtime 'backup-run.mjs') + '"') -WorkingDirectory $Root
Register-ScheduledTask -TaskName 'AbujaLife-Backup' -Action $backupAction -Trigger (New-ScheduledTaskTrigger -Daily -At '03:15') -Principal $backupPrincipal -Settings $backupSettings -Description 'Daily at 03:15 SERVER LOCAL TIME. Isolated Mongo backup; AES-GCM; authenticated dry-run validation; 14 day local retention.' -Force | Out-Null
$guardAction = New-ScheduledTaskAction -Execute $config.nodePath -Argument ('"' + (Join-Path $runtime 'backup-run.mjs') + '" --recover-stale-lock') -WorkingDirectory $Root
$guardTrigger = New-ScheduledTaskTrigger -Once -At ([DateTime]::Now.AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$guardSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'AbujaLife-Mongo-LockGuard' -Action $guardAction -Trigger $guardTrigger -Principal $backupPrincipal -Settings $guardSettings -Description 'Every five minutes, release only a proven stale AbujaLife backup write-lock after the backup PID has exited; never accesses Okrika.' -Force | Out-Null
Write-Output 'AbujaLife-API starts after reboot; supervisor restarts API crashes. AbujaLife-Backup runs daily at 03:15 server local time.'
