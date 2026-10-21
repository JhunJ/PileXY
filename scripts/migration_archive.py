"""Create and verify a complete, split migration backup without external packages.

Workspace credentials are excluded. Explicitly staged credentials can be included
with --private-config; the resulting ZIP is private and is NOT encrypted.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import stat
import sys
import tempfile
import time
from datetime import datetime, timezone
import zipfile


BUFFER_SIZE = 8 * 1024 * 1024
MAX_CHUNK_SIZE = 1500 * 1024 * 1024
EXCLUDED_DIRECTORIES = {
    ".git", ".venv", "venv", "env", "__pycache__", ".pytest_cache", ".cursor",
    ".ssh", ".cloudflared", "secrets", "private-config",
}
EXCLUDED_CREDENTIAL_NAMES = {
    "credentials.json", "credentials.yaml", "credentials.yml", "secrets.json",
    "secret.json", "token.txt", "cert.pem",
}
EXCLUDED_RELATIVE_PATHS = {"tools/meissa-login-test.json"}
ENV_TEMPLATES = {".env.example", ".env.sample", ".env.template"}


def emit(value: dict, *, error: bool = False) -> None:
    print(json.dumps(value, ensure_ascii=True, sort_keys=True),
          file=sys.stderr if error else sys.stdout, flush=True)


def fingerprint(path: Path) -> tuple[int, ...]:
    return stat_fingerprint(path.stat(follow_symlinks=False))


def stat_fingerprint(metadata: os.stat_result) -> tuple[int, ...]:
    return (metadata.st_dev, metadata.st_ino, metadata.st_size,
            metadata.st_mtime_ns, metadata.st_ctime_ns)


def is_link(metadata: os.stat_result) -> bool:
    return (stat.S_ISLNK(metadata.st_mode)
            or bool(getattr(metadata, "st_file_attributes", 0)
                    & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)))


def exclusion(path: PurePosixPath, *, directory: bool, extra: set[str]) -> str | None:
    name = path.name.lower()
    relative = path.as_posix().lower()
    if relative in extra:
        return "explicit_exclusion"
    if directory and name in EXCLUDED_DIRECTORIES:
        return "runtime_or_private_directory"
    if not directory:
        if name.endswith((".sqlite3-wal", ".sqlite3-shm", ".sqlite3-journal")):
            return "sqlite_sidecar_included_in_database_snapshot"
        if ((name == ".env" or name.startswith(".env.")) and name not in ENV_TEMPLATES
                or name in EXCLUDED_CREDENTIAL_NAMES
                or name.endswith((".key", ".pem", ".pfx", ".p12"))
                or name.endswith("-token.txt")
                or relative in EXCLUDED_RELATIVE_PATHS):
            return "private_configuration_requires_explicit_staging"
    return None


def inventory(root: Path, private: Path | None, extra: set[str]) -> tuple[list[dict], list[dict]]:
    files: list[dict] = []
    excluded: list[dict] = []

    def walk(folder: Path, base: Path, prefix: str, private_scope: bool) -> None:
        with os.scandir(folder) as iterator:
            children = sorted(iterator, key=lambda child: child.name.casefold())
        for child in children:
            path = Path(child.path)
            relative = path.relative_to(base).as_posix()
            archive_path = prefix + relative
            metadata = child.stat(follow_symlinks=False)
            directory = stat.S_ISDIR(metadata.st_mode)
            reason = (None if private_scope else
                      exclusion(PurePosixPath(relative), directory=directory, extra=extra))
            if reason:
                excluded.append({"path": archive_path, "reason": reason})
                continue
            if is_link(metadata):
                raise RuntimeError(f"Symlink or reparse point requires manual review: {path}")
            if directory:
                walk(path, base, prefix, private_scope)
            elif stat.S_ISREG(metadata.st_mode):
                source_fingerprint = fingerprint(path)
                sidecar = Path(str(path) + "-wal") if path.suffix.lower() == ".sqlite3" else None
                if sidecar is not None and sidecar.exists() and is_link(sidecar.lstat()):
                    raise RuntimeError(f"SQLite WAL cannot be a link: {sidecar}")
                files.append({"path": archive_path, "source": path,
                              "fingerprint": source_fingerprint,
                              "wal_fingerprint": fingerprint(sidecar) if sidecar is not None and sidecar.exists() else None,
                              "private": private_scope})
            else:
                raise RuntimeError(f"Unsupported non-regular file: {path}")

    walk(root, root, "", False)
    if private is not None:
        walk(private, private, "private-config/", True)
    names = [item["path"] for item in files]
    if len(names) != len(set(names)):
        raise RuntimeError("Duplicate archive paths in source inventory")
    return files, excluded


def inventory_signature(files: list[dict]) -> dict:
    return {item["path"]: (item["fingerprint"], item["wal_fingerprint"]) for item in files}


def assert_stable(item: dict) -> None:
    path = item["source"]
    if fingerprint(path) != item["fingerprint"]:
        raise RuntimeError(f"Source changed while archiving; stop writers and retry: {path}")
    if path.suffix.lower() == ".sqlite3":
        wal = Path(str(path) + "-wal")
        current = fingerprint(wal) if wal.exists() else None
        if current != item["wal_fingerprint"]:
            raise RuntimeError(f"SQLite source changed while archiving; stop writers and retry: {path}")


def sqlite_integrity(path: Path) -> None:
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=30)) as database:
        result = database.execute("PRAGMA integrity_check").fetchall()
    if result != [("ok",)]:
        raise RuntimeError(f"SQLite integrity check failed: {path.name}")


def snapshot_sqlite(source: Path, target: Path) -> None:
    started = time.monotonic()

    def progress(status: int, remaining: int, total: int) -> None:
        if time.monotonic() - started > 180:
            raise RuntimeError(f"SQLite backup timed out; stop writers and retry: {source}")

    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=30)) as database:
        with closing(sqlite3.connect(target)) as destination:
            database.backup(destination, pages=2048, progress=progress, sleep=0.05)
    sqlite_integrity(target)


def hash_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while block := stream.read(BUFFER_SIZE):
            digest.update(block)
            size += len(block)
    return size, digest.hexdigest()


def zip_info(item: dict) -> zipfile.ZipInfo:
    timestamp = datetime.fromtimestamp(item["fingerprint"][3] / 1e9, timezone.utc)
    year = min(2107, max(1980, timestamp.year))
    date_time = (year, timestamp.month, min(timestamp.day, 28) if year != timestamp.year else timestamp.day,
                 timestamp.hour, timestamp.minute, timestamp.second)
    info = zipfile.ZipInfo(item["path"], date_time)
    info.compress_type = zipfile.ZIP_DEFLATED
    info._compresslevel = 1
    info.external_attr = (stat.S_IFREG | 0o600) << 16
    return info


def split_archive(path: Path, chunk_size: int) -> tuple[dict, list[dict]]:
    total_hash = hashlib.sha256()
    total_size = 0
    chunks: list[dict] = []
    with path.open("rb") as source:
        index = 1
        while total_size < path.stat().st_size:
            name = f"{path.name}.part{index:03d}"
            partial = path.with_name(name + ".incomplete")
            digest = hashlib.sha256()
            size = 0
            with partial.open("xb") as destination:
                while size < chunk_size:
                    block = source.read(min(BUFFER_SIZE, chunk_size - size))
                    if not block:
                        break
                    destination.write(block)
                    digest.update(block)
                    total_hash.update(block)
                    size += len(block)
                    total_size += len(block)
            partial.rename(path.with_name(name))
            chunks.append({"name": name, "size": size, "sha256": digest.hexdigest()})
            emit({"event": "chunk_complete", "name": name, "size": size}, error=True)
            index += 1
    return ({"name": path.name, "size": total_size, "sha256": total_hash.hexdigest()}, chunks)


def make_archive(root: Path, output: Path, private: Path | None, extra: set[str], chunk_size: int) -> dict:
    if output.is_relative_to(root) or private is not None and output.is_relative_to(private):
        raise ValueError("--output must be outside the workspace and private configuration directories")
    if output.exists() and any(output.iterdir()):
        raise ValueError("--output must be a new or empty directory; existing backups are never overwritten")
    files, excluded = inventory(root, private, extra)
    signature = inventory_signature(files)
    output.mkdir(parents=True, exist_ok=True)
    partial_zip = output / "migration.zip.incomplete"
    archive_path = output / "migration.zip"
    entries: list[dict] = []
    last_progress = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="pilexy-migration-") as temporary:
        with zipfile.ZipFile(partial_zip, "x", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=1, allowZip64=True) as archive:
            for index, item in enumerate(files, 1):
                assert_stable(item)
                source = item["source"]
                sqlite_backup = source.suffix.lower() == ".sqlite3"
                if sqlite_backup:
                    source = Path(temporary) / f"database-{index}.sqlite3"
                    snapshot_sqlite(item["source"], source)
                digest = hashlib.sha256()
                size = 0
                with source.open("rb") as stream, archive.open(zip_info(item), "w", force_zip64=True) as destination:
                    # Windows stat/fstat can disagree on the legacy ctime field
                    # for copied files. Device, inode, size and mtime still match;
                    # full path fingerprints are checked before and after reads.
                    if not sqlite_backup and stat_fingerprint(os.fstat(stream.fileno()))[:4] != item["fingerprint"][:4]:
                        raise RuntimeError(f"Source changed before reading: {item['source']}")
                    while block := stream.read(BUFFER_SIZE):
                        destination.write(block)
                        digest.update(block)
                        size += len(block)
                assert_stable(item)
                kind = "sqlite_backup" if sqlite_backup else "private_config" if item["private"] else "file"
                entries.append({"path": item["path"], "size": size,
                                "sha256": digest.hexdigest(), "kind": kind})
                if sqlite_backup:
                    source.unlink()
                if time.monotonic() - last_progress >= 10:
                    emit({"event": "archive_progress", "files_done": index,
                          "files_total": len(files)}, error=True)
                    last_progress = time.monotonic()
        current, _ = inventory(root, private, extra)
        if inventory_signature(current) != signature:
            raise RuntimeError("Source inventory changed while archiving; stop writers and retry")
    partial_zip.rename(archive_path)
    archive_metadata, chunks = split_archive(archive_path, chunk_size)
    manifest = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_root": str(root),
        "archive": archive_metadata,
        "chunks": chunks,
        "entries": entries,
        "exclusions": excluded,
        "sqlite_integrity": "ok",
        "private_configuration_included": private is not None,
        "encrypted": False,
    }
    manifest_path = output / "migration-manifest.json"
    with manifest_path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, ensure_ascii=True, indent=2)
        stream.write("\n")
    return {"event": "archive_complete", "manifest": str(manifest_path),
            "files": len(entries), "chunks": len(chunks), **archive_metadata}


def safe_member_name(name: str) -> bool:
    path = PurePosixPath(name)
    return bool(name) and "\\" not in name and ":" not in name and not path.is_absolute() and ".." not in path.parts


def manifest_local_file(folder: Path, name: str) -> Path:
    if not safe_member_name(name) or PurePosixPath(name).name != name:
        raise ValueError("Manifest archive/chunk names must be plain filenames")
    path = folder / name
    if is_link(path.lstat()) or not path.is_file():
        raise ValueError(f"Backup file must be a regular file: {name}")
    return path


def verify_archive(manifest_path: Path) -> dict:
    with manifest_path.open(encoding="utf-8") as stream:
        manifest = json.load(stream)
    if manifest.get("schema_version") != 1:
        raise ValueError("Unsupported migration manifest version")
    folder = manifest_path.parent
    archive_metadata = manifest["archive"]
    archive_path = manifest_local_file(folder, archive_metadata["name"])
    size, digest = hash_file(archive_path)
    if (size, digest) != (archive_metadata["size"], archive_metadata["sha256"]):
        raise RuntimeError("Full ZIP size or SHA-256 does not match manifest")
    concatenated_hash = hashlib.sha256()
    concatenated_size = 0
    for chunk in manifest["chunks"]:
        path = manifest_local_file(folder, chunk["name"])
        chunk_hash = hashlib.sha256()
        chunk_size = 0
        with path.open("rb") as stream:
            while block := stream.read(BUFFER_SIZE):
                chunk_hash.update(block)
                concatenated_hash.update(block)
                chunk_size += len(block)
        if (chunk_size, chunk_hash.hexdigest()) != (chunk["size"], chunk["sha256"]):
            raise RuntimeError(f"Chunk size or SHA-256 does not match: {chunk['name']}")
        if chunk_size > MAX_CHUNK_SIZE:
            raise RuntimeError(f"Chunk exceeds 1500 MiB: {chunk['name']}")
        concatenated_size += chunk_size
    if (concatenated_size, concatenated_hash.hexdigest()) != (size, digest):
        raise RuntimeError("Joined chunk contents do not match the full ZIP")
    expected = {entry["path"]: entry for entry in manifest["entries"]}
    if len(expected) != len(manifest["entries"]) or not all(safe_member_name(name) for name in expected):
        raise RuntimeError("Duplicate or unsafe archive entry in manifest")
    sqlite_count = 0
    with tempfile.TemporaryDirectory(prefix="pilexy-verify-") as temporary:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            if len(infos) != len(expected) or {info.filename for info in infos} != set(expected):
                raise RuntimeError("ZIP entries differ from manifest")
            for index, info in enumerate(infos):
                entry = expected[info.filename]
                if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16):
                    raise RuntimeError(f"Unexpected directory or symlink: {info.filename}")
                entry_hash = hashlib.sha256()
                entry_size = 0
                sqlite_backup = entry["kind"] == "sqlite_backup"
                database_path = Path(temporary) / f"database-{index}.sqlite3"
                destination = database_path.open("xb") if sqlite_backup else None
                try:
                    # ZipExtFile checks CRC when every entry is read to EOF.
                    with archive.open(info) as stream:
                        while block := stream.read(BUFFER_SIZE):
                            entry_hash.update(block)
                            entry_size += len(block)
                            if destination is not None:
                                destination.write(block)
                finally:
                    if destination is not None:
                        destination.close()
                if (entry_size, entry_hash.hexdigest()) != (entry["size"], entry["sha256"]):
                    raise RuntimeError(f"Entry size or SHA-256 does not match: {info.filename}")
                if sqlite_backup:
                    sqlite_integrity(database_path)
                    database_path.unlink()
                    sqlite_count += 1
    return {"event": "verification_complete", "files": len(expected),
            "sqlite_databases": sqlite_count, "chunks": len(manifest["chunks"]),
            "crc": "ok", "sha256": "ok", "sqlite_integrity": "ok"}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, help="New/empty backup directory outside --root")
    parser.add_argument("--private-config", type=Path, help="Explicitly staged private configuration; ZIP is not encrypted")
    parser.add_argument("--exclude", action="append", default=[], help="Additional exact relative file/directory path to exclude")
    parser.add_argument("--chunk-size-mib", type=int, default=1500, help="Split size, from 1 to 1500 MiB")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--inventory", action="store_true", help="Print source inventory without archiving")
    modes.add_argument("--verify", type=Path, metavar="MANIFEST", help="Verify full ZIP and all split parts beside manifest")
    args = parser.parse_args(argv)
    try:
        if args.verify:
            emit(verify_archive(args.verify.resolve()))
            return 0
        root = args.root.resolve(strict=True)
        private = args.private_config.resolve(strict=True) if args.private_config else None
        if not root.is_dir() or private is not None and not private.is_dir():
            raise ValueError("Source paths must be directories")
        if private is not None and (private.is_relative_to(root) or root.is_relative_to(private)):
            raise ValueError("--private-config must be separate from the workspace")
        extra = {path.replace("\\", "/").strip("/").lower() for path in args.exclude}
        if args.inventory:
            files, excluded = inventory(root, private, extra)
            emit({"root": str(root), "files": [{"path": item["path"], "size": item["fingerprint"][2]} for item in files],
                  "file_count": len(files), "total_bytes": sum(item["fingerprint"][2] for item in files),
                  "exclusions": excluded})
            return 0
        if args.output is None:
            raise ValueError("--output is required and must be outside the workspace")
        if not 1 <= args.chunk_size_mib <= 1500:
            raise ValueError("--chunk-size-mib must be between 1 and 1500")
        emit(make_archive(root, args.output.resolve(), private, extra, args.chunk_size_mib * 1024 * 1024))
        return 0
    except (OSError, ValueError, RuntimeError, sqlite3.Error, zipfile.BadZipFile, KeyError, TypeError) as exc:
        emit({"event": "error", "type": type(exc).__name__, "message": str(exc)}, error=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
