"""저장 작업 JSON에서 동일 중심 좌표에 서로 다른 circle id가 몇 건인지 집계합니다.

  python scripts/debug_saved_work_duplicate_centers.py data/saved_works/work_6e937cbe3bad.json

청주센텀자이 V3.1 등 DXF에 동일 좌표에 원이 여러 개 있으면 캔버스 숫자가 겹쳐 보일 수 있어,
프론트에서는 좌표당 링/라벨을 한 번만 그리도록 처리합니다.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "data/saved_works/work_6e937cbe3bad.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    circles = data.get("circles") or []
    by_pos: dict[tuple[float, float], list[str]] = defaultdict(list)
    for c in circles:
        try:
            x = round(float(c.get("center_x")), 2)
            y = round(float(c.get("center_y")), 2)
        except (TypeError, ValueError):
            continue
        cid = str(c.get("id", ""))
        by_pos[(x, y)].append(cid)

    multi = [(p, ids) for p, ids in by_pos.items() if len(ids) > 1]
    multi.sort(key=lambda t: -len(t[1]))
    print(f"file={path}")
    print(f"circles={len(circles)} positions={len(by_pos)} duplicate_positions={len(multi)}")
    for (x, y), ids in multi[:25]:
        print(f"  ({x}, {y}) n={len(ids)} ids={ids[:8]}{'...' if len(ids) > 8 else ''}")


if __name__ == "__main__":
    main()
