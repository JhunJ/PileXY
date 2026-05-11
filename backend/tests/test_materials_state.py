"""materials_state 저장/기본값."""

import uuid

from backend import construction_reports as cr
from backend import materials_state as ms


def test_default_bundle_has_keys():
    b = ms.default_materials_bundle()
    assert "suppliers" in b and "receipts" in b
    assert len(b["truckLoadRules"]) >= 11
    assert isinstance(b.get("joinLengthSpecs"), list) and len(b["joinLengthSpecs"]) >= 1


def test_put_get_roundtrip(tmp_path, monkeypatch):
    """임시 DB 파일로 격리."""
    db = tmp_path / "t.sqlite3"
    monkeypatch.setattr(cr, "CONSTRUCTION_DB_PATH", str(db))

    pc = f"테스트프로젝트-{uuid.uuid4().hex[:8]}"
    first = ms.get_materials_state(pc)
    assert first.get("meta", {}).get("saved") is False

    first["suppliers"] = [{"id": "s1", "name": "테스트업체", "contact": "", "phone": "", "address": "", "distanceKm": 0, "etaText": ""}]
    out = ms.put_materials_state(pc, first)
    assert out["suppliers"][0]["name"] == "테스트업체"

    again = ms.get_materials_state(pc)
    assert again.get("meta", {}).get("saved") is True
    assert again["suppliers"][0]["id"] == "s1"
