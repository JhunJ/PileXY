"""Trace why pile 479 shows 미시공 for 청주센텀자이 — run: python scripts/trace_cheongju_479.py"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import construction_reports as cr  # noqa: E402

SAVED = os.path.join(ROOT, "data", "saved_works")
DB = os.path.join(ROOT, "data", "construction", "construction_reports.sqlite3")


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    print("=== construction_datasets (recent) ===")
    for r in conn.execute(
        "SELECT id, dataset_name, project_context, filename, created_at FROM construction_datasets ORDER BY created_at DESC LIMIT 12"
    ):
        print(dict(r))

    ds_rows = list(
        conn.execute(
            "SELECT id FROM construction_datasets WHERE IFNULL(project_context,'') LIKE '%청주%' "
            "OR IFNULL(dataset_name,'') LIKE '%청주%' OR IFNULL(filename,'') LIKE '%청주%'"
        )
    )
    if not ds_rows:
        print("\nNo dataset with '청주' in name/context — using project_context 청주센텀자이 from metadata")
        ds_rows = list(
            conn.execute(
                "SELECT id FROM construction_datasets WHERE IFNULL(project_context,'') LIKE '%센텀%'"
            )
        )
    if not ds_rows:
        ds_rows = list(conn.execute("SELECT id FROM construction_datasets ORDER BY created_at DESC LIMIT 1"))

    dataset_id = ds_rows[0]["id"]
    print(f"\n=== Using dataset_id = {dataset_id} ===")

    q479 = list(
        conn.execute(
            "SELECT row_number, sequence_no, location, pile_number, construction_date FROM construction_records "
            "WHERE dataset_id=? AND (pile_number LIKE '%479%' OR pile_number_sort=479) ORDER BY row_number",
            (dataset_id,),
        )
    )
    print(f"\nPDAM rows mentioning 479 (dataset {dataset_id}): {len(q479)}")
    for r in q479[:20]:
        print(dict(r))

    records = [
        dict(r)
        for r in conn.execute(
            "SELECT location, pile_number, construction_date, row_number, equipment, pile_type, construction_method, "
            "pile_remaining, penetration_depth, boring_depth, excavation_depth, installed, construction_month "
            f"FROM construction_records WHERE dataset_id=?",
            (dataset_id,),
        )
    ]
    for r in records:
        r["installed"] = bool(r.get("installed"))
    conn.close()

    # saved works: buildings / circles for title
    print("\n=== saved_works matching 청주 / 타워 / V2.1 ===")
    for name in os.listdir(SAVED):
        if not name.endswith(".json") or name == "index.json":
            continue
        path = os.path.join(SAVED, name)
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except OSError:
            continue
        title = str(data.get("title") or "")
        if not any(k in title for k in ("청주", "센텀", "V2.1", "타워")):
            continue
        buildings = data.get("buildings") or []
        parking = [b for b in buildings if str(b.get("kind", "")).lower() == "parking"]
        circles = data.get("circles") or []
        c479 = [c for c in circles if "479" in str((c.get("matched_text") or {}).get("text", ""))]
        print(f"\n--- {name} title={title[:80]}")
        print(f"    buildings: {len(buildings)}, parking outlines: {len(parking)} {[b.get('name') for b in parking]}")
        print(f"    circles with text 479: {len(c479)}")
        for c in c479[:5]:
            mt = c.get("matched_text") or {}
            print(
                f"      circle id={c.get('id')} building_name={c.get('building_name')!r} "
                f"text={mt.get('text')!r} center=({c.get('center_x')},{c.get('center_y')})"
            )

        work_id = data.get("id") or name.replace(".json", "")
        safe = re.sub(r"[^\w\-]", "", work_id)
        if safe != work_id:
            continue
        saved_buildings = cr._load_saved_work_buildings(work_id)
        if not saved_buildings:
            saved_buildings = buildings
        pu, _u = cr._saved_work_parking_unify_context(saved_buildings or [])
        latest = cr._latest_records_by_pile(records, parking_unified_location=pu)
        rec479 = next((x for x in latest if str(x.get("pile_number")) == "479"), None)
        print(f"    parking_unified_location={pu!r}")
        if rec479:
            rl = cr._record_location_for_pdam_match(rec479, pu)
            print(f"    PDAM 479 row: location={rec479.get('location')!r} -> record_loc={rl!r}")

        if c479:
            c = c479[0]
            m = cr.map_records_to_circles(
                latest,
                [c],
                parking_unified_location=pu,
                outline_buildings=saved_buildings,
            )
            om = m["circleMappings"][0]
            print(f"    map_records (first 479 circle): status={om.get('status')} matchType={om.get('matchType')} circleLocation={om.get('circleLocation')!r}")


if __name__ == "__main__":
    main()
