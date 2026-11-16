"""Legacy settings remain readable without leaking another project's settings."""

import asyncio
import hashlib
import json

import pytest

from backend import main


@pytest.fixture
def settings_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "SAVED_SETTINGS_DIR", str(tmp_path))
    return tmp_path


def _save_legacy(folder, *, context="", context_id="", format="name", name="outline", version="123"):
    payload = {
        "projectName": name,
        "versionId": version,
        "contextProject": context,
        "contextProjectId": context_id,
        "buildings": [{"name": "101"}],
    }
    raw = f"{context}::{name}::{version}" if format == "context" else f"{name}::{version}"
    path = folder / (hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24] + ".json")
    path.write_text(json.dumps(payload), encoding="utf-8")
    (folder / "index.json").write_text(json.dumps([{**payload, "name": name}]), encoding="utf-8")
    return path, payload


@pytest.mark.parametrize("format,context", [("name", ""), ("context", "project-a")])
def test_get_reads_indexed_legacy_setting_without_migrating_files(settings_dir, format, context):
    _save_legacy(settings_dir, format=format, context=context)
    before = {p.name: p.read_bytes() for p in settings_dir.iterdir()}

    result = main._get_saved_setting("outline", "123", context)
    assert result["buildings"] == [{"name": "101"}]
    assert {p.name: p.read_bytes() for p in settings_dir.iterdir()} == before
    assert asyncio.run(main.get_saved_setting("outline", "123", context, None))["buildings"] == result["buildings"]


@pytest.mark.parametrize("format", ["name", "context"])
def test_get_and_delete_reject_legacy_payload_from_different_project_id(settings_dir, format):
    path, payload = _save_legacy(settings_dir, context="same-name", context_id="project-a", format=format)
    # Even a stale/colliding index entry cannot grant ownership of the legacy payload.
    index = [{**payload, "contextProjectId": "project-b"}]
    (settings_dir / "index.json").write_text(json.dumps(index), encoding="utf-8")
    assert main._get_saved_setting("outline", "123", "same-name", "project-b") is None
    assert main._remove_saved_setting("outline", "123", "same-name", "project-b") is False
    assert path.is_file()


def test_unscoped_legacy_filename_cannot_cross_context(settings_dir):
    path, payload = _save_legacy(settings_dir, context="project-a")
    (settings_dir / "index.json").write_text(json.dumps([{**payload, "contextProject": "project-b"}]), encoding="utf-8")
    assert main._get_saved_setting("outline", "123", "project-b") is None
    assert main._remove_saved_setting("outline", "123", "project-b") is False
    assert path.is_file()


@pytest.mark.parametrize("field,value", [("projectName", "foreign-outline"), ("versionId", "other-version")])
def test_get_rejects_legacy_payload_with_wrong_identity(settings_dir, field, value):
    path, payload = _save_legacy(settings_dir)
    path.write_text(json.dumps({**payload, field: value}), encoding="utf-8")
    assert main._get_saved_setting("outline", "123") is None


def test_legacy_file_requires_matching_index_entry(settings_dir):
    path, _ = _save_legacy(settings_dir, context="project-a")
    (settings_dir / "index.json").write_text("[]", encoding="utf-8")
    assert main._get_saved_setting("outline", "123", "project-a") is None
    assert not main._remove_saved_setting("outline", "123", "project-a")
    assert path.is_file()


def test_current_setting_has_priority_and_explicit_delete_removes_both_representations(settings_dir):
    legacy_path, payload = _save_legacy(settings_dir, context="project-a", format="context")
    main._put_saved_setting("outline", "123", {**payload, "buildings": [{"name": "202"}]}, "project-a")
    assert main._get_saved_setting("outline", "123", "project-a")["buildings"] == [{"name": "202"}]

    assert main._remove_saved_setting("outline", "123", "project-a")
    assert not legacy_path.exists()
    assert main._get_saved_setting("outline", "123", "project-a") is None
    assert not main._remove_saved_setting("outline", "123", "project-a")


def test_explicit_delete_removes_only_the_matching_legacy_context(settings_dir):
    path, _ = _save_legacy(settings_dir, context="project-a", format="context")
    unrelated_key = main._settings_file_key("outline", "123", "project-b", "b")
    unrelated = settings_dir / (unrelated_key + ".json")
    unrelated.write_text('{"projectName":"outline","versionId":"123"}', encoding="utf-8")
    assert main._remove_saved_setting("outline", "123", "project-a")
    assert not path.exists()
    assert unrelated.is_file()
