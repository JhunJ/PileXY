"""Inspect PDAM DB for pile 479 — run: python scripts/inspect_pdam_479.py"""
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "construction", "construction_reports.sqlite3")


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    print("=== recent datasets ===")
    for r in conn.execute(
        "SELECT id, project_context, filename, created_at FROM construction_datasets ORDER BY created_at DESC LIMIT 8"
    ):
        print(dict(r))
    print("\n=== rows with 479 in pile_number ===")
    q = """
    SELECT dataset_id, row_number, construction_date, pile_type, construction_method, location, pile_number,
           boring_depth, penetration_depth, pile_remaining, installed, raw_json
    FROM construction_records
    WHERE pile_number LIKE '%479%' OR CAST(pile_number_sort AS TEXT) = '479'
    ORDER BY dataset_id, row_number
    """
    rows = list(conn.execute(q))
    for r in rows:
        print(dict(r))
    print(f"\ntotal: {len(rows)}")
    conn.close()


if __name__ == "__main__":
    main()
