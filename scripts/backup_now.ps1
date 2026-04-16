param(
  [int]$RetentionDays = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RetentionDays -lt 7 -or $RetentionDays -gt 30) {
  throw "RetentionDays must be between 7 and 30."
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = Join-Path $ProjectRoot "data"
$BackupRoot = Join-Path $DataRoot "backups"
$TempRoot = Join-Path $env:TEMP ("pilexy-backup-" + [guid]::NewGuid().ToString("N"))
$Now = Get-Date
$Stamp = $Now.ToString("yyyyMMdd_HHmmss")
$ArchiveName = "pilexy_backup_$Stamp.zip"
$ArchivePath = Join-Path $BackupRoot $ArchiveName
$LogPath = Join-Path $BackupRoot "backup.log"

$Targets = @(
  "saved_works",
  "saved_settings",
  "excel_compare_cache",
  "construction"
)

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

try {
  foreach ($target in $Targets) {
    $srcPath = Join-Path $DataRoot $target
    if (-not (Test-Path -LiteralPath $srcPath)) {
      continue
    }
    $dstPath = Join-Path $TempRoot $target
    Copy-Item -LiteralPath $srcPath -Destination $dstPath -Recurse -Force
  }

  Compress-Archive -Path (Join-Path $TempRoot "*") -DestinationPath $ArchivePath -CompressionLevel Optimal -Force

  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  $removed = 0
  Get-ChildItem -LiteralPath $BackupRoot -File -Filter "*.zip" | ForEach-Object {
    if ($_.LastWriteTime -lt $cutoff) {
      Remove-Item -LiteralPath $_.FullName -Force
      $removed += 1
    }
  }

  $line = "{0} | OK | archive={1} | retentionDays={2} | removed={3}" -f $Now.ToString("s"), $ArchiveName, $RetentionDays, $removed
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}
catch {
  $line = "{0} | ERROR | {1}" -f (Get-Date).ToString("s"), $_.Exception.Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  throw
}
finally {
  if (Test-Path -LiteralPath $TempRoot) {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force
  }
}
