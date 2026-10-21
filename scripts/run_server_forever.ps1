# PileXY backend watchdog: keeps uvicorn alive, restarting it if it exits.
param(
    [int]$Port = 3001,
    # 0.0.0.0 so the cloudflared tunnel (which targets the LAN IP) can reach it.
    [string]$BindHost = '0.0.0.0'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$watchdogLog = Join-Path $logDir 'watchdog.log'

function Write-Log([string]$message) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Add-Content -Path $watchdogLog -Value $line -Encoding UTF8
}

if (-not (Test-Path $python)) {
    Write-Log "FATAL: python not found at $python"
    exit 1
}

$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

Write-Log "watchdog started (pid $PID) for ${BindHost}:${Port}"

while ($true) {
    # Free the port if a stale process still holds it.
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -ne $PID } |
        ForEach-Object {
            Write-Log "port $Port busy, stopping pid $($_.OwningProcess)"
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }

    $stamp = Get-Date -Format 'yyyyMMdd'
    $out = Join-Path $logDir "server-$stamp.out.log"
    $err = Join-Path $logDir "server-$stamp.err.log"

    Write-Log "starting uvicorn"
    $proc = Start-Process -FilePath $python `
        -ArgumentList '-m', 'uvicorn', 'backend.main:app', '--host', $BindHost, '--port', "$Port" `
        -WorkingDirectory $root `
        -NoNewWindow -PassThru `
        -RedirectStandardOutput $out -RedirectStandardError $err

    $proc.WaitForExit()
    Write-Log "uvicorn exited with code $($proc.ExitCode); restarting in 3s"
    Start-Sleep -Seconds 3
}
