# Run after creating a dedicated tunnel in the Cloudflare account.
# Published route: pilexy.yeobaekstudio.com -> http://127.0.0.1:3001.
# Does not modify DNS, the shared Cloudflared service, or the backend task.
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TokenFile,
    [string]$CloudflaredPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    [string]$ExpectedTunnelId,
    [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$watchdog = Join-Path $PSScriptRoot 'run_cloudflare_forever.ps1'
$privateDir = Join-Path $env:LOCALAPPDATA 'PileXY\Cloudflare'
$destination = Join-Path $privateDir 'tunnel-token.txt'
$taskName = 'PileXY Cloudflare Tunnel'

function Set-PrivateTokenAccess([string]$Path, [bool]$Directory) {
    $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $systemSid = 'S-1-5-18'
    $oldAcl = Get-Acl -LiteralPath $Path
    $otherSids = @($oldAcl.Access | ForEach-Object {
        $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    } | Where-Object { $_ -ne $userSid -and $_ -ne $systemSid } | Select-Object -Unique)
    $rights = if ($Directory) { '(OI)(CI)F' } else { 'F' }
    # icacls updates only the access rules and needs no audit/owner privileges.
    & "$env:SystemRoot\System32\icacls.exe" $Path '/inheritance:r' '/grant:r' `
        "*${userSid}:$rights" "*${systemSid}:$rights" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect the dedicated tunnel token location.' }
    foreach ($sid in $otherSids) {
        & "$env:SystemRoot\System32\icacls.exe" $Path '/remove' "*$sid" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not remove an unrelated access rule from the token location.' }
    }
}

if (-not (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf)) {
    throw "Cloudflared was not found at $CloudflaredPath."
}
if (-not (Test-Path -LiteralPath $watchdog -PathType Leaf)) {
    throw "Connector watchdog was not found at $watchdog."
}
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask -and @($existingTask.Actions | Where-Object {
    $_.Arguments -notlike ('*' + $watchdog + '*')
}).Count -gt 0) {
    throw "An unrelated task named '$taskName' already exists."
}
if (-not $PSCmdlet.ShouldProcess($taskName, 'Save a protected tunnel token and configure automatic startup at login')) {
    return
}
if ($existingTask -and $existingTask.State -eq 'Running') {
    throw "The dedicated connector is already running. Stop its task before replacing its token."
}

$secureToken = $null
$tokenPointer = [IntPtr]::Zero
try {
    if ($TokenFile) {
        $token = (Get-Content -LiteralPath $TokenFile -Raw).Trim()
    }
    else {
        $secureToken = Read-Host 'Paste the dedicated PileXY tunnel token (input is hidden)' -AsSecureString
        $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
    }
    try {
        $padded = $token.Replace('-', '+').Replace('_', '/')
        $padded += '=' * ((4 - $padded.Length % 4) % 4)
        $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($padded)) | ConvertFrom-Json
        $tunnelId = [guid]::Parse($payload.t).ToString()
        if (-not $payload.a -or -not $payload.s) { throw 'Missing token fields.' }
    }
    catch { throw 'This is not a valid Cloudflare tunnel token. Paste only the token, not the installation command.' }
    if ($ExpectedTunnelId -and $tunnelId -ne ([guid]::Parse($ExpectedTunnelId).ToString())) {
        throw 'The token belongs to a different tunnel than ExpectedTunnelId.'
    }
    # This PC already uses this shared tunnel for other domains. Keep it separate.
    if ($tunnelId -eq 'aff25516-9fc9-45cf-996c-bb46d8af80fd') {
        throw 'This token belongs to the existing shared tunnel. Use a dedicated PileXY tunnel token.'
    }

    New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    Set-PrivateTokenAccess -Path $privateDir -Directory $true
    [IO.File]::WriteAllText($destination, $token, [Text.Encoding]::ASCII)
    Set-PrivateTokenAccess -Path $destination -Directory $false
}
finally {
    if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    if ($secureToken) { $secureToken.Dispose() }
    $token = $null
    $padded = $null
    $payload = $null
}

$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -TokenFile "{1}" -CloudflaredPath "{2}"' -f $watchdog, $destination, $CloudflaredPath
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null
if (-not $NoStart) { Start-ScheduledTask -TaskName $taskName }
[pscustomobject]@{ TaskName = $taskName; TunnelId = $tunnelId; Started = -not $NoStart; Metrics = 'http://127.0.0.1:20251' }
