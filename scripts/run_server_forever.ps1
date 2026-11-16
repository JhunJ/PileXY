# Keep one owned backend alive, and recover from exits or prolonged HTTP stalls.
param(
    [ValidateRange(1, 65535)][int]$Port = 3001,
    [string]$BindHost = '127.0.0.1',
    [ValidateRange(1, 3600)][int]$HealthCheckIntervalSeconds = 30,
    [ValidateRange(1, 60)][int]$HealthTimeoutSeconds = 5,
    # CAD imports can temporarily occupy the event loop. Do not interrupt them
    # because of a few missed probes; require 30 minutes of continuous failure.
    [ValidateRange(1, 86400)][int]$UnhealthyRestartAfterSeconds = 1800,
    [ValidateRange(1, 300)][int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$watchdogLog = Join-Path $logDir 'watchdog.log'

function Write-Log([string]$Message) {
    Add-Content -LiteralPath $watchdogLog -Encoding UTF8 -Value (
        '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    )
}

function Test-LocalHttp {
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/")
    $request.Proxy = $null
    $request.Timeout = $HealthTimeoutSeconds * 1000
    $request.ReadWriteTimeout = $HealthTimeoutSeconds * 1000
    $request.KeepAlive = $false
    $response = $null
    try {
        # Only wait for headers; never buffer the frontend or large app data.
        $response = $request.GetResponse()
        return ([int]$response.StatusCode -lt 500)
    }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response
        return ($response -and [int]$response.StatusCode -lt 500)
    }
    finally {
        if ($response) { $response.Close() }
        $request.Abort()
    }
}

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    Write-Log "FATAL: python not found at $python"
    exit 1
}

. (Join-Path $PSScriptRoot 'pilexy_watchdog_native.ps1')

$sha = [System.Security.Cryptography.SHA256]::Create()
try {
    $key = [BitConverter]::ToString($sha.ComputeHash(
        [Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant())
    )).Replace('-', '').Substring(0, 16)
}
finally { $sha.Dispose() }
$mutex = New-Object System.Threading.Mutex($false, "Local\PileXY-Backend-$key-$Port")
$ownsMutex = $false
$proc = $null
$job = $null
$awake = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { exit 0 }

    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:PYTHONUNBUFFERED = '1'
    $launchPython = $python
    $storeVersion = $null
    $venvConfig = Get-Content -LiteralPath (Join-Path $root 'backend\.venv\pyvenv.cfg') -Raw -Encoding UTF8
    if ($venvConfig -match '(?im)^home\s*=\s*.*\\WindowsApps\\PythonSoftwareFoundation\.Python\.(\d+\.\d+)') {
        $storeVersion = $Matches[1]
    }
    # Keep the system awake without keeping the screen on or disabling locking.
    $awake = ([PileXY.WatchdogJob]::SetThreadExecutionState([uint32]2147483649) -ne 0)
    if (-not $awake) { Write-Log 'WARNING: Windows did not accept the system-awake request.' }
    Write-Log "watchdog started (pid $PID) for ${BindHost}:${Port}; HTTP failure grace ${UnhealthyRestartAfterSeconds}s"

    while ($true) {
        try {
            $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
            if ($listeners.Count -gt 0) {
                # This watchdog only stops its own child. A pre-existing owner
                # may be another application or an older manually started server.
                $owners = ($listeners.OwningProcess | Sort-Object -Unique) -join ', '
                Write-Log "port $Port already owned by PID(s) $owners; leaving them running and retrying"
            }
            else {
                if ($storeVersion) {
                    # Store aliases activate outside the caller's job. Resolve
                    # the real binary on every start, including after updates.
                    $package = Get-AppxPackage -Name "PythonSoftwareFoundation.Python.$storeVersion" |
                        Sort-Object Version -Descending | Select-Object -First 1
                    if (-not $package) { throw "Python $storeVersion Store package could not be resolved." }
                    $launchPython = Join-Path $package.InstallLocation "python$storeVersion.exe"
                    if (-not (Test-Path -LiteralPath $launchPython -PathType Leaf)) {
                        throw 'The installed Store Python executable is missing.'
                    }
                    $env:__PYVENV_LAUNCHER__ = $python
                    Write-Log "using direct Store Python $storeVersion with the existing virtual environment"
                }
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
                $out = Join-Path $logDir "server-$stamp.out.log"
                $err = Join-Path $logDir "server-$stamp.err.log"
                $job = New-Object PileXY.WatchdogJob
                $arguments = '-m uvicorn backend.main:app --host "{0}" --port {1}' -f $BindHost, $Port
                $proc = $job.StartHidden($launchPython, $arguments, $root, $out, $err)
                Write-Log "started uvicorn (pid $($proc.Id))"
                $clock = [Diagnostics.Stopwatch]::StartNew()
                $failedSince = $null
                $nextProbe = 0
                while (-not $proc.HasExited) {
                    if ($clock.Elapsed.TotalSeconds -ge $nextProbe) {
                        if (Test-LocalHttp) {
                            if ($null -ne $failedSince) { Write-Log 'local HTTP response recovered' }
                            $failedSince = $null
                        }
                        elseif ($null -eq $failedSince) {
                            $failedSince = $clock.Elapsed.TotalSeconds
                            Write-Log 'local HTTP probe failed; allowing time for startup or long CAD work'
                        }
                        elseif (($clock.Elapsed.TotalSeconds - $failedSince) -ge $UnhealthyRestartAfterSeconds) {
                            Write-Log "local HTTP unresponsive for ${UnhealthyRestartAfterSeconds}s; restarting owned backend"
                            break
                        }
                        $nextProbe = $clock.Elapsed.TotalSeconds + $HealthCheckIntervalSeconds
                    }
                    if ($proc.WaitForExit(1000)) { break }
                }
                if ($proc.HasExited) { Write-Log "uvicorn exited with code $($proc.ExitCode)" }
            }
        }
        catch {
            Write-Log ('backend supervision error: {0}' -f $_.Exception.Message)
        }
        finally {
            if ($job) { $job.Dispose(); $job = $null }
            # Covers a launch that failed before being assigned to its job.
            if ($proc) {
                if (-not $proc.HasExited) {
                    Stop-Process -InputObject $proc -Force -ErrorAction SilentlyContinue
                }
                $proc.Dispose()
                $proc = $null
            }
        }
        Start-Sleep -Seconds $RestartDelaySeconds
    }
}
finally {
    if ($job) { $job.Dispose() }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -InputObject $proc -Force -ErrorAction SilentlyContinue
    }
    if ($awake) { [void][PileXY.WatchdogJob]::SetThreadExecutionState([uint32]2147483648) }
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
