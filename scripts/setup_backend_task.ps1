# Recreate the backend login task on the destination PC after rebuilding its venv.
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1, 65535)][int]$Port = 3001,
    [string]$BindHost = '127.0.0.1',
    [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$watchdog = Join-Path $PSScriptRoot 'run_server_forever.ps1'
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$taskName = 'PileXY Backend'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Create backend\.venv and install backend\requirements.txt first.'
}
if (-not (Test-Path -LiteralPath $watchdog -PathType Leaf)) {
    throw 'Backend watchdog script is missing.'
}
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and @($existing.Actions | Where-Object {
    $_.Arguments -notlike ('*' + $watchdog + '*')
}).Count -gt 0) {
    throw "An unrelated task named '$taskName' already exists."
}
if ($existing -and $existing.State -eq 'Running') {
    throw 'The backend task is already running. Stop it before replacing its configuration.'
}
if (-not $PSCmdlet.ShouldProcess($taskName, 'Register the backend task for this user')) { return }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Port {1} -BindHost "{2}"' -f $watchdog, $Port, $BindHost
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null
if (-not $NoStart) { Start-ScheduledTask -TaskName $taskName }
[pscustomobject]@{ TaskName = $taskName; Port = $Port; Started = -not $NoStart }
