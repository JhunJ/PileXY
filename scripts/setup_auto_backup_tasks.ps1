param(
  [int]$RetentionDays = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RetentionDays -lt 7 -or $RetentionDays -gt 30) {
  throw "RetentionDays must be between 7 and 30."
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupScript = Join-Path $PSScriptRoot "backup_now.ps1"

if (-not (Test-Path -LiteralPath $BackupScript)) {
  throw "backup_now.ps1 not found: $BackupScript"
}

$times = @("06:00", "23:00")

foreach ($time in $times) {
  $safeTime = $time.Replace(":", "")
  $taskName = "PileXY-AutoBackup-$safeTime"
  $taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$BackupScript`" -RetentionDays $RetentionDays"
  schtasks /Create /TN $taskName /SC DAILY /ST $time /TR $taskCommand /F | Out-Null
  Write-Host "Created/updated task: $taskName ($time)"
}

Write-Host ""
Write-Host "Done."
Write-Host "Backup target: $ProjectRoot\data"
Write-Host "Backup output: $ProjectRoot\data\backups"
Write-Host "RetentionDays: $RetentionDays"
