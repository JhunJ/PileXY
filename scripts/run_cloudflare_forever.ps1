# Dedicated PileXY connector. The existing shared Cloudflared service is independent.
param(
    [string]$TokenFile = (Join-Path $env:LOCALAPPDATA 'PileXY\Cloudflare\tunnel-token.txt'),
    [string]$CloudflaredPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    [int]$MetricsPort = 20251
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs\cloudflare'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$watchdogLog = Join-Path $logDir 'watchdog.log'

function Write-ConnectorLog([string]$Message) {
    Add-Content -LiteralPath $watchdogLog -Encoding UTF8 -Value (
        '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    )
}

if (-not (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf)) {
    Write-ConnectorLog 'Cloudflared executable is missing.'
    exit 1
}
if (-not (Test-Path -LiteralPath $TokenFile -PathType Leaf)) {
    Write-ConnectorLog 'Dedicated tunnel token is missing. Run setup_cloudflare_tunnel.ps1 first.'
    exit 1
}

$mutex = New-Object System.Threading.Mutex($false, 'Local\PileXY-Dedicated-Cloudflare')
$ownsMutex = $false
$connector = $null
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { exit 0 }

    # An inherited --token environment setting would override --token-file.
    $env:TUNNEL_TOKEN = $null
    Write-ConnectorLog "Dedicated connector watchdog started (PID $PID)."
    while ($true) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $out = Join-Path $logDir "connector-$stamp.out.log"
        $err = Join-Path $logDir "connector-$stamp.err.log"
        try {
            # Token stays in the protected file and never appears in the command line.
            $arguments = 'tunnel --no-autoupdate --metrics 127.0.0.1:{0} run --token-file "{1}"' -f $MetricsPort, $TokenFile
            $connector = Start-Process -FilePath $CloudflaredPath -ArgumentList $arguments `
                -WorkingDirectory $root -WindowStyle Hidden -PassThru `
                -RedirectStandardOutput $out -RedirectStandardError $err
            Write-ConnectorLog "Started cloudflared (PID $($connector.Id))."
            $connector.WaitForExit()
            Write-ConnectorLog "Connector exited ($($connector.ExitCode)); retrying in 10 seconds."
        }
        catch {
            Write-ConnectorLog ('Could not start connector; retrying in 10 seconds: {0}' -f $_.Exception.Message)
        }
        Start-Sleep -Seconds 10
    }
}
finally {
    if ($connector -and -not $connector.HasExited) {
        Stop-Process -InputObject $connector -Force -ErrorAction SilentlyContinue
    }
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
