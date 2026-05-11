"""billing_state 프로젝트별 저장."""

import uuid

from backend import billing_state as bs
from backend import construction_reports as cr


def test_billing_default_bundle_has_keys():
    bundle = bs.default_billing_bundle()
    assert bundle["rigCount"] == 3
    assert isinstance(bundle["entries"], dict)


def test_billing_put_get_roundtrip_by_project(tmp_path, monkeypatch):
    db = tmp_path / "billing.sqlite3"
    monkeypatch.setattr(cr, "CONSTRUCTION_DB_PATH", str(db))

    pc1 = f"정산테스트-{uuid.uuid4().hex[:8]}"
    pc2 = f"정산테스트-{uuid.uuid4().hex[:8]}"
    first = bs.get_billing_state(pc1)
    assert first.get("meta", {}).get("saved") is False

    payload = {
        "startDate": "2026-05-01",
        "endDate": "2026-05-31",
        "rigCount": 2,
        "entries": {
            "2026-05-01|rig1": {
                "status": "rain_all",
                "detail": "종일 우천",
                "waitDuration": "",
                "contractorFault": False,
            }
        },
    }
    saved = bs.put_billing_state(pc1, payload)
    assert saved["rigCount"] == 2
    assert saved["entries"]["2026-05-01|rig1"]["detail"] == "종일 우천"

    again = bs.get_billing_state(pc1)
    assert again.get("meta", {}).get("saved") is True
    assert again["entries"]["2026-05-01|rig1"]["status"] == "rain_all"

    other = bs.get_billing_state(pc2)
    assert other.get("meta", {}).get("saved") is False
    assert other["entries"] == {}
