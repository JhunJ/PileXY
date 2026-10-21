"""Isolated migration backup checks; no application data or network access."""
from contextlib import closing, redirect_stderr
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
import zipfile


SPEC = importlib.util.spec_from_file_location("migration_archive", Path(__file__).parents[1] / "migration_archive.py")
archive_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(archive_tool)


class MigrationArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="pilexy-archive-test-")
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / "workspace"
        self.root.mkdir()
        self.output = self.base / "backup"

    def tearDown(self):
        self.temporary.cleanup()

    def create(self, private=None, chunk_size=1024 * 1024):
        with redirect_stderr(io.StringIO()):
            return archive_tool.make_archive(self.root, self.output, private, set(), chunk_size)

    def test_complete_split_backup_roundtrip_and_explicit_private_config(self):
        for folder in ("backend", "data/backups", "logs", "현장 도면", "tools", ".git", ".venv"):
            (self.root / folder).mkdir(parents=True)
        expected = {
            "backend/main.py": b"print('current working tree')\n",
            "data/backups/old-backup.bin": os.urandom(2 * 1024 * 1024),
            "logs/server.log": b"historic log\n",
            "현장 도면/말뚝.dxf": "현재 도면".encode(),
            ".env.example": b"EXAMPLE=\n",
        }
        for name, contents in expected.items():
            (self.root / name).write_bytes(contents)
        for name in (".env", "tools/meissa-login-test.json", ".git/config", ".venv/python.exe"):
            (self.root / name).write_bytes(b"must not be included from workspace")
        private = self.base / "private"
        private.mkdir()
        (private / ".env").write_bytes(b"STAGED_FIXTURE=example\n")
        expected["private-config/.env"] = b"STAGED_FIXTURE=example\n"
        result = self.create(private)
        self.assertGreaterEqual(result["chunks"], 3)
        verified = archive_tool.verify_archive(self.output / "migration-manifest.json")
        self.assertEqual(verified["files"], len(expected))
        with zipfile.ZipFile(self.output / "migration.zip") as backup:
            self.assertEqual(set(backup.namelist()), set(expected))
            for name, contents in expected.items():
                self.assertEqual(backup.read(name), contents)
        manifest = json.loads((self.output / "migration-manifest.json").read_text())
        self.assertFalse(manifest["encrypted"])
        self.assertTrue(all(chunk["size"] <= 1024 * 1024 for chunk in manifest["chunks"]))

    def test_live_sqlite_wal_is_backed_up_without_raw_sidecars(self):
        database_path = self.root / "active.sqlite3"
        with closing(sqlite3.connect(database_path)) as database:
            database.execute("PRAGMA journal_mode=WAL")
            database.execute("CREATE TABLE sample(value TEXT)")
            database.execute("INSERT INTO sample VALUES ('committed WAL row')")
            database.commit()
            self.assertTrue(Path(str(database_path) + "-wal").exists())
            self.create()
            result = archive_tool.verify_archive(self.output / "migration-manifest.json")
            self.assertEqual(result["sqlite_databases"], 1)
            with zipfile.ZipFile(self.output / "migration.zip") as backup:
                self.assertEqual(backup.namelist(), ["active.sqlite3"])
                restored = self.base / "restored.sqlite3"
                restored.write_bytes(backup.read("active.sqlite3"))
            with closing(sqlite3.connect(restored)) as restored_database:
                self.assertEqual(restored_database.execute("SELECT value FROM sample").fetchone(),
                                 ("committed WAL row",))

    def test_corrupt_part_is_rejected(self):
        (self.root / "sample.txt").write_bytes(b"sample")
        self.create()
        part = self.output / "migration.zip.part001"
        contents = part.read_bytes()
        part.write_bytes(bytes([contents[0] ^ 1]) + contents[1:])
        with self.assertRaisesRegex(RuntimeError, "Chunk size or SHA-256"):
            archive_tool.verify_archive(self.output / "migration-manifest.json")

    def test_source_mutation_is_rejected(self):
        sample = self.root / "sample.txt"
        sample.write_text("before", encoding="utf-8")
        files, _ = archive_tool.inventory(self.root, None, set())
        sample.write_text("modified after inventory", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "Source changed"):
            archive_tool.assert_stable(files[0])

    def test_copied_file_with_preserved_old_mtime_is_backed_up(self):
        original = self.base / "original.txt"
        original.write_bytes(b"preserved old modification time")
        os.utime(original, (946684800, 946684800))
        shutil.copy2(original, self.root / "copied.txt")
        self.create()
        self.assertEqual(archive_tool.verify_archive(self.output / "migration-manifest.json")["files"], 1)

    def test_output_inside_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "outside"):
            archive_tool.make_archive(self.root, self.root / "backup", None, set(), 1024)
        self.assertFalse((self.root / "backup").exists())

    def test_manifest_traversal_is_rejected(self):
        self.assertFalse(archive_tool.safe_member_name("../outside.txt"))
        self.assertFalse(archive_tool.safe_member_name("C:/outside.txt"))
        self.assertFalse(archive_tool.safe_member_name("folder\\outside.txt"))

    def test_symlink_is_never_followed(self):
        outside = self.base / "outside.txt"
        outside.write_bytes(b"outside")
        try:
            (self.root / "link.txt").symlink_to(outside)
        except OSError:
            self.skipTest("Creating symlinks requires an unavailable Windows privilege")
        with self.assertRaisesRegex(RuntimeError, "Symlink or reparse point"):
            archive_tool.inventory(self.root, None, set())


if __name__ == "__main__":
    unittest.main()
