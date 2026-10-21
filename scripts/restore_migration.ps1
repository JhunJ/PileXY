# Restores a verified PileXY snapshot into a new/empty directory.
# Never starts a backend, changes DNS, or registers a scheduled task.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$TargetRoot,
    [string]$KeyFile,
    [string]$PythonExecutable,
    [switch]$RestoreTunnelToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'

function Protect-PrivateDirectory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $otherSids = @((Get-Acl -LiteralPath $Path).Access | ForEach-Object {
        $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    } | Where-Object { $_ -ne $sid -and $_ -ne 'S-1-5-18' } | Select-Object -Unique)
    & "$env:SystemRoot\System32\icacls.exe" $Path '/inheritance:r' '/grant:r' `
        "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect the private configuration directory.' }
    foreach ($otherSid in $otherSids) {
        & "$env:SystemRoot\System32\icacls.exe" $Path '/remove' "*$otherSid" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not remove unrelated private-directory access.' }
    }
}

$pythonArguments = @()
if ($PythonExecutable) {
    $python = (Get-Command $PythonExecutable -ErrorAction Stop).Source
}
elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $python = (Get-Command py).Source
    $pythonArguments = @('-3.12')
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $python = (Get-Command python).Source
}
else { throw 'Install Python 3.12 first, or specify -PythonExecutable.' }

$manifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$target = [IO.Path]::GetFullPath($TargetRoot)
if (Test-Path -LiteralPath $target) {
    if (-not (Test-Path -LiteralPath $target -PathType Container)) {
        throw 'TargetRoot must be a new or empty directory.'
    }
    if (@(Get-ChildItem -LiteralPath $target -Force).Count -gt 0) {
        throw 'TargetRoot is not empty. Existing work is never overwritten.'
    }
}
if ($KeyFile) { $KeyFile = (Resolve-Path -LiteralPath $KeyFile).Path }
if ($RestoreTunnelToken -and -not $KeyFile) {
    throw '-RestoreTunnelToken requires -KeyFile.'
}

# Preserve authenticated private configuration under this Windows user, not Git.
$privateDestination = ''
if ($KeyFile) {
    & $python @pythonArguments -c 'import sys; assert sys.version_info >= (3,10); import Crypto.Cipher.AES'
    if ($LASTEXITCODE -ne 0) {
        throw 'Install pycryptodome for this Python first: py -3.12 -m pip install pycryptodome'
    }
    $privateBase = Join-Path $env:LOCALAPPDATA 'PileXY\Migration'
    Protect-PrivateDirectory $privateBase
    $privateDestination = Join-Path $privateBase ([guid]::NewGuid().ToString('N'))
}
if ($RestoreTunnelToken) {
    Protect-PrivateDirectory (Join-Path $env:LOCALAPPDATA 'PileXY\Cloudflare')
}

$restoreProgram = @'
import hashlib, json, os, shutil, sqlite3, stat, subprocess, sys
from pathlib import Path, PurePosixPath, PureWindowsPath
import zipfile

manifest_path, target = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).absolute()
key_file, private_destination, restore_tunnel = sys.argv[3:6]
key_file = '' if key_file == '-' else key_file
private_destination = '' if private_destination == '-' else private_destination
folder = manifest_path.parent
manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
if manifest.get('schema_version') != 1:
    raise ValueError('Unsupported migration manifest version')
if target == Path(target.anchor) or target == folder or folder.is_relative_to(target):
    raise ValueError('Target must be separate from the downloaded backup folder and drive root')
if target.exists() and any(target.iterdir()):
    raise ValueError('Target directory must be empty')
# Reject any existing reparse point in the destination chain before writing files.
for parent in (target, *target.parents):
    if parent.exists() and (parent.is_symlink() or (hasattr(parent, 'is_junction') and parent.is_junction())):
        raise ValueError('Target directory cannot contain a link or junction')
target = target.resolve()

def local_file(name):
    if not isinstance(name, str) or not name or Path(name).name != name or '/' in name or '\\' in name or ':' in name:
        raise ValueError('Unsafe archive/chunk filename')
    path = folder / name
    if path.is_symlink() or not path.is_file():
        raise ValueError('Missing regular backup file: ' + name)
    return path

def file_digest(path):
    result, size = hashlib.sha256(), 0
    with path.open('rb') as handle:
        while block := handle.read(4 * 1024 * 1024):
            result.update(block)
            size += len(block)
    return size, result.hexdigest()

metadata = manifest['archive']
archive_name = metadata['name']
if Path(archive_name).name != archive_name or '/' in archive_name or '\\' in archive_name or ':' in archive_name:
    raise ValueError('Unsafe ZIP filename')
archive_path = folder / archive_name
if archive_path.exists():
    local_file(archive_name)
    if file_digest(archive_path) != (metadata['size'], metadata['sha256']):
        raise ValueError('Existing ZIP does not match the manifest; keep it separate and retry')
    print('Full ZIP SHA-256 verified.', flush=True)
else:
    partial = folder / (archive_name + '.joining')
    if partial.exists():
        raise ValueError('A previous .joining file exists; preserve or remove it before retrying')
    combined, total = hashlib.sha256(), 0
    with partial.open('xb') as output:
        for item in manifest['chunks']:
            path = local_file(item['name'])
            digest, size = hashlib.sha256(), 0
            with path.open('rb') as source:
                while block := source.read(4 * 1024 * 1024):
                    output.write(block)
                    digest.update(block)
                    combined.update(block)
                    size += len(block)
            if (size, digest.hexdigest()) != (item['size'], item['sha256']):
                raise ValueError('Chunk SHA-256 mismatch: ' + item['name'])
            total += size
            print('Verified ' + item['name'], flush=True)
    if (total, combined.hexdigest()) != (metadata['size'], metadata['sha256']):
        raise ValueError('Joined ZIP does not match manifest')
    partial.rename(archive_path)
    print('Joined ZIP SHA-256 verified.', flush=True)

expected = {}
case_names = set()
for entry in manifest['entries']:
    name = entry['path']
    rel = PurePosixPath(name)
    if not name or rel.is_absolute() or '..' in rel.parts or '\\' in name or ':' in name or name.endswith('/'):
        raise ValueError('Unsafe manifest entry')
    if any(part.endswith(('.', ' ')) or PureWindowsPath(part).is_reserved() for part in rel.parts):
        raise ValueError('Non-portable Windows filename: ' + name)
    if name.casefold() in case_names:
        raise ValueError('Duplicate Windows destination: ' + name)
    case_names.add(name.casefold())
    expected[name] = entry

with zipfile.ZipFile(archive_path) as archive:
    infos = archive.infolist()
    if len(infos) != len(expected) or {info.filename for info in infos} != set(expected):
        raise ValueError('ZIP members differ from manifest')
    for info in infos:
        if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16):
            raise ValueError('Links/directories are not allowed as ZIP entries')
        destination = target.joinpath(*PurePosixPath(info.filename).parts)
        if not destination.resolve().is_relative_to(target):
            raise ValueError('Unsafe ZIP destination')
    target.mkdir(parents=True, exist_ok=True)
    for index, info in enumerate(infos, 1):
        destination = target.joinpath(*PurePosixPath(info.filename).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest, size = hashlib.sha256(), 0
        with archive.open(info) as source, destination.open('xb') as output:
            while block := source.read(4 * 1024 * 1024):
                output.write(block)
                digest.update(block)
                size += len(block)
        entry = expected[info.filename]
        if (size, digest.hexdigest()) != (entry['size'], entry['sha256']):
            raise ValueError('Extracted file SHA-256 mismatch: ' + info.filename)
        if index % 50 == 0:
            print(f'Extracted and verified {index}/{len(infos)} files.', flush=True)
print(f'All {len(expected)} files passed ZIP CRC and SHA-256 checks.', flush=True)

database = target / 'data/construction/construction_reports.sqlite3'
remapped = 0
if database.is_file() and database.stat().st_size:
    with sqlite3.connect(database) as connection:
        if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Restored construction database failed integrity_check')
        exists = connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='construction_datasets'").fetchone()
        if exists:
            for dataset_id, old_path in connection.execute('SELECT id,file_path FROM construction_datasets').fetchall():
                if not old_path:
                    continue
                candidate = target / 'data/construction/workbooks' / PureWindowsPath(old_path).name
                if not candidate.is_file():
                    raise ValueError('Missing restored workbook for dataset ' + dataset_id)
                if str(candidate) != old_path:
                    connection.execute('UPDATE construction_datasets SET file_path=? WHERE id=?', (str(candidate), dataset_id))
                    remapped += 1
            connection.commit()
    print(f'Construction database verified; {remapped} workbook paths relocated.', flush=True)

if key_file:
    sealed = target / 'private-config/private-config.sealed'
    decryptor = target / 'scripts/migration_secrets.py'
    if not sealed.is_file() or not decryptor.is_file():
        raise ValueError('Encrypted private configuration or decryption helper is missing')
    subprocess.run([sys.executable, str(decryptor), 'decrypt', '--input', str(sealed),
                    '--destination', private_destination, '--key-file', key_file], check=True)
    private = Path(private_destination)
    for relative in ('.env', 'tools/meissa-login-test.json'):
        source, destination = private / relative, target / relative
        if source.is_file():
            if destination.exists():
                raise ValueError('Private configuration destination already exists: ' + relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    if restore_tunnel == '1':
        source = private / 'cloudflare/tunnel-token.txt'
        destination = Path(os.environ['LOCALAPPDATA']) / 'PileXY/Cloudflare/tunnel-token.txt'
        if not source.is_file():
            raise ValueError('No dedicated tunnel token in private configuration')
        if destination.exists() and file_digest(source) != file_digest(destination):
            raise ValueError('A different tunnel token already exists; it was not overwritten')
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copy2(source, destination)
        print('Dedicated token restored; connector remains stopped.', flush=True)
    print('Private configuration preserved at: ' + str(private), flush=True)
else:
    print('Private configuration remains encrypted. Use the separate recovery key before domain cutover.', flush=True)

report = {'manifest': str(manifest_path), 'source_root': manifest.get('source_root'),
          'restored_root': str(target), 'verified_files': len(expected),
          'construction_workbook_paths_relocated': remapped,
          'private_configuration': private_destination or 'encrypted_only',
          'services_started': False, 'scheduled_tasks_registered': False}
(target / 'migration-restore-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('Restore complete: ' + str(target), flush=True)
'@

$keyArgument = if ($KeyFile) { $KeyFile } else { '-' }
$privateArgument = if ($privateDestination) { $privateDestination } else { '-' }
$restoreProgram | & $python @pythonArguments - $manifest $target $keyArgument $privateArgument ([int][bool]$RestoreTunnelToken)
if ($LASTEXITCODE -ne 0) {
    throw 'Restore did not complete. Existing source data/services were not changed. Keep partial output for inspection.'
}
if ($RestoreTunnelToken) {
    $tokenDirectory = Join-Path $env:LOCALAPPDATA 'PileXY\Cloudflare'
    $tokenPath = Join-Path $tokenDirectory 'tunnel-token.txt'
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & "$env:SystemRoot\System32\icacls.exe" $tokenPath '/inheritance:r' '/grant:r' `
        "*${sid}:F" '*S-1-5-18:F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect the tunnel token file.' }
}

Write-Host 'Next: recreate backend\.venv with Python 3.12 and install backend\requirements.txt.'
Write-Host 'Read MIGRATION.md before enabling the backend and Cloudflare connector.'
