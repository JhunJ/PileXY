"""Trace PDAM row matched to T7-9 for 청주센텀자이 — run from repo root: python scripts/trace_t7_9_cheongju.py"""
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


def norm_text(t: str) -> str:
    return re.sub(r"\s+", "", (t or "").strip()).upper()


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    print("=== construction_datasets (청주/센텀/V3) ===")
    all_ds = list(conn.execute("SELECT id, dataset_name, project_context, filename FROM construction_datasets"))
    picked = []
    for r in all_ds:
        blob = " ".join(str(r[k] or "") for k in r.keys())
        if any(k in blob for k in ("청주", "센텀", "Centum", "centum", "V3.1")):
            picked.append(dict(r))
            print(dict(r))
    if not picked:
        print("(none — listing last 5 datasets)")
        for r in conn.execute(
            "SELECT id, dataset_name, project_context, filename FROM construction_datasets ORDER BY created_at DESC LIMIT 5"
        ):
            print(dict(r))
        dataset_id = all_ds[-1]["id"] if all_ds else None
    else:
        # Prefer project_context containing 청주
        for p in picked:
            if "청주" in str(p.get("project_context") or "") or "센텀" in str(p.get("project_context") or ""):
                dataset_id = p["id"]
                break
        else:
            dataset_id = picked[0]["id"]

    print(f"\n=== Using dataset_id = {dataset_id} ===")

    for r in conn.execute(
        "SELECT row_number, location, pile_number, construction_date, equipment, construction_method, pile_remaining "
        "FROM construction_records WHERE dataset_id=? AND (pile_number LIKE '%1049%' OR pile_number LIKE '%T7%9%' OR pile_number LIKE '%7-9%') "
        "ORDER BY row_number LIMIT 40",
        (dataset_id,),
    ):
        print(dict(r))

    records = [
        dict(r)
        for r in conn.execute(
            "SELECT location, pile_number, construction_date, row_number, equipment, pile_type, construction_method, "
            "pile_remaining, penetration_depth, boring_depth, excavation_depth, installed, construction_month "
            "FROM construction_records WHERE dataset_id=?",
            (dataset_id,),
        )
    ]
    for r in records:
        r["installed"] = bool(r.get("installed"))
    conn.close()

    print("\n=== saved_works: find T7-9 circle (청주/센텀/V3.1) ===")
    work_files: list[tuple[str, dict]] = []
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
        if any(k in title for k in ("청주", "센텀", "Centum", "V3.1", "centum")):
            work_files.append((name, data))

    if not work_files:
        print("No saved work title matched — scanning ALL works for circle text T7-9 …")
        for name in os.listdir(SAVED):
            if not name.endswith(".json") or name == "index.json":
                continue
            path = os.path.join(SAVED, name)
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
            except OSError:
                continue
            for c in data.get("circles") or []:
                mt = c.get("matched_text") or {}
                tx = norm_text(str(mt.get("text") or ""))
                if tx == "T7-9" or tx.endswith("T7-9"):
                    work_files.append((name, data))
                    break

    target_circle = None
    target_name = None
    for name, data in work_files:
        circles = data.get("circles") or []
        for c in circles:
            mt = c.get("matched_text") or {}
            raw = str(mt.get("text") or "").strip()
            if norm_text(raw) == "T7-9":
                target_circle = c
                target_name = name
                break
        if target_circle:
            break

    if not target_circle:
        print("No circle with matched_text T7-9 found.")
        return

    data = next(d for n, d in work_files if n == target_name)
    title = str(data.get("title") or "")
    print(f"work file: {target_name}\ntitle: {title[:200]}")

    mt = target_circle.get("matched_text") or {}
    print(
        f"\ncircle id={target_circle.get('id')} building_name={target_circle.get('building_name')!r} "
        f"matched_text={mt.get('text')!r} center=({target_circle.get('center_x')},{target_circle.get('center_y')})"
    )

    work_id = data.get("id") or target_name.replace(".json", "")
    safe = re.sub(r"[^\w\-]", "", str(work_id))
    if safe != str(work_id):
        work_id = target_name.replace(".json", "")

    saved_buildings = cr._load_saved_work_buildings(work_id)  # type: ignore[attr-defined]
    if not saved_buildings:
        saved_buildings = data.get("buildings") or []
    pu, _u = cr._saved_work_parking_unify_context(saved_buildings or [])  # type: ignore[attr-defined]
    latest = cr._latest_records_by_pile(records, parking_unified_location=pu)

    print(f"\nparking_unified_location={pu!r}")

    m = cr.map_records_to_circles(
        latest,
        [target_circle],
        parking_unified_location=pu,
        outline_buildings=saved_buildings,
    )
    om = m["circleMappings"][0]
    print("\n=== map_records_to_circles result for this circle ===")
    keys = [
        "status",
        "matchType",
        "circleLocation",
        "location",
        "locationNormalized",
        "sourceLocationNormalized",
        "pileNumber",
        "matchedRecordPileNumber",
        "matchedRecordDisplayPileNumber",
        "constructionDate",
        "equipment",
        "constructionMethod",
        "pileRemaining",
        "inferredRecordLocation",
        "inferenceReason",
        "pdamMappingSourceCircleId",
    ]
    for k in keys:
        if k in om:
            print(f"  {k}: {om.get(k)!r}")

    # Show the full PDAM row if we can find it
    pile_key = cr._record_dedupe_key_for_latest(  # type: ignore[attr-defined]
        {
            "location": om.get("location"),
            "pile_number": om.get("matchedRecordPileNumber"),
            "construction_date": om.get("constructionDate"),
            "row_number": om.get("recordRowNumber"),
        },
        parking_unified_location=pu,
    )
    print(f"\n  dedupe key (approx): {pile_key}")

    rec_match = None
    for r in latest:
        if cr._record_key(r) == pile_key:  # type: ignore[attr-defined]
            rec_match = r
            break
    if rec_match:
        print("\n=== Matched PDAM row (from latest_records) ===")
        for k in sorted(rec_match.keys()):
            print(f"  {k}: {rec_match.get(k)!r}")


if __name__ == "__main__":
    main()
