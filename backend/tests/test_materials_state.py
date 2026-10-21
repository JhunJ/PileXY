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


def test_custom_plan_rows_preserve_duplicate_labels_order_and_quantities(tmp_path, monkeypatch):
    monkeypatch.setattr(cr, "CONSTRUCTION_DB_PATH", str(tmp_path / "rows.sqlite3"))
    data = ms.default_materials_bundle()
    data['planRows'] = [{'id': 'row2', 'label': '105동'}, {'id': 'row1', 'label': '105동'}]
    data['planByBuilding'] = {'row1': {'10': 3}, 'row2': {'J20': 5}}
    ms.put_materials_state('행 테스트', data)
    restored = ms.get_materials_state('행 테스트')
    assert restored['planRows'] == data['planRows']
    assert restored['planByBuilding'] == data['planByBuilding']
    assert ms.get_materials_state('다른 프로젝트')['planByBuilding'] == {}
    restored['planRows'] = []
    restored['planByBuilding'] = {}
    ms.put_materials_state('행 테스트', restored)
    assert ms.get_materials_state('행 테스트')['planRows'] == []


def test_three_segment_join_and_quantities_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(cr, "CONSTRUCTION_DB_PATH", str(tmp_path / "join.sqlite3"))
    data = ms.default_materials_bundle()
    data["joinLengthSpecs"] = [{"totalM": 34, "seg1M": 12, "seg2M": 11, "seg3M": 11}]
    data["planByBuilding"] = {"101동": {"J34": 2}}
    data["receipts"] = [{"id": "r1", "qtyByLength": {"J34": 3}}]
    ms.put_materials_state("3구간 테스트", data)
    restored = ms.get_materials_state("3구간 테스트")
    assert restored["joinLengthSpecs"] == data["joinLengthSpecs"]
    assert restored["planByBuilding"] == data["planByBuilding"]
    assert restored["receipts"] == data["receipts"]
