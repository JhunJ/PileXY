"""One-off: inspect construction_records for pile_classification (단본/합계)."""
import json
import sqlite3

DB = r"d:\정헌재 선임_2025\건축_BIM\PileXY\data\construction\construction_reports.sqlite3"


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    print("TABLES:", [r[0] for r in c.fetchall()])

    c.execute("PRAGMA table_info(construction_records)")
    col_names = [r[1] for r in c.fetchall()]
    print("construction_records columns:", col_names)

    c.execute("SELECT COUNT(*) AS n FROM construction_records")
    total = c.fetchone()["n"]
    print("\n총 레코드:", total)

    c.execute(
        "SELECT COUNT(*) AS n FROM construction_records WHERE pile_classification_single IS NOT NULL"
    )
    print("pile_classification_single NOT NULL:", c.fetchone()["n"])
    c.execute(
        "SELECT COUNT(*) AS n FROM construction_records WHERE pile_classification_total IS NOT NULL"
    )
    print("pile_classification_total NOT NULL:", c.fetchone()["n"])
    c.execute(
        """SELECT COUNT(*) AS n FROM construction_records
           WHERE pile_classification_single IS NULL AND pile_classification_total IS NULL"""
    )
    print("둘 다 NULL:", c.fetchone()["n"])

    # installed-like: check if column exists
    if "installed" in col_names:
        c.execute("SELECT COUNT(*) AS n FROM construction_records WHERE installed = 1")
        print("installed=1:", c.fetchone()["n"])
    else:
        print("(no installed column in table — may be computed in app)")

    print("\n--- 단본·합계 값 분포 (상위 20) ---")
    c.execute(
        """SELECT pile_classification_single, pile_classification_total, COUNT(*) AS n
           FROM construction_records
           GROUP BY pile_classification_single, pile_classification_total
           ORDER BY n DESC
           LIMIT 20"""
    )
    for row in c.fetchall():
        print(dict(row))

    print("\n--- 최근 20행 (주요 열만) ---")
    c.execute(
        """SELECT dataset_id, construction_date, location, pile_number, pile_diameter,
                  pile_classification_single, pile_classification_total
           FROM construction_records
           ORDER BY rowid DESC
           LIMIT 20"""
    )
    for row in c.fetchall():
        print(dict(row))

    print("\n--- dataset별 단본 NULL 비율 ---")
    c.execute(
        """SELECT dataset_id,
                  COUNT(*) AS n,
                  SUM(CASE WHEN pile_classification_single IS NULL
                            AND pile_classification_total IS NULL THEN 1 ELSE 0 END) AS both_null
           FROM construction_records
           GROUP BY dataset_id
           ORDER BY n DESC
           LIMIT 15"""
    )
    for row in c.fetchall():
        d = dict(row)
        n = d["n"] or 1
        d["both_null_pct"] = round(100 * (d["both_null"] or 0) / n, 1)
        print(d)

    print("\n--- raw_json: 데이터 행 1건 (pile_number에 숫자·하이픈 있는 최근 행) ---")
    c.execute(
        """SELECT raw_json FROM construction_records
           WHERE raw_json IS NOT NULL AND TRIM(raw_json) != ''
             AND pile_number GLOB '*[0-9]*'
             AND LENGTH(pile_number) < 40
           ORDER BY rowid DESC
           LIMIT 1"""
    )
    row = c.fetchone()
    if row:
        j = json.loads(row[0])
        keys = sorted(j.keys())
        print("keys count:", len(keys))
        print("all keys:", keys)
        for k in keys:
            lk = k.lower()
            if any(x in lk for x in ("class", "single", "total", "본", "길이", "구분", "단본", "합계", "pile")):
                print(repr(k), ":", j.get(k))
    else:
        print("(raw_json 비어 있음)")

    conn.close()


if __name__ == "__main__":
    main()
