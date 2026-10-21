"""다른 저장 버전 기초값 이식 — id가 같아도 좌표가 다르면 쓰지 않는다."""

from __future__ import annotations


def map_preset_by_coord(src_map: dict, src_circles: list, dest_circles: list, tol: float = 0.25):
    src_by_id = {str(c["id"]): c for c in src_circles}
    dest_by_id = {str(c["id"]): c for c in dest_circles}
    pairs = []
    for src_id, _raw in src_map.items():
        src = src_by_id.get(str(src_id))
        if not src:
            continue
        sx, sy = float(src["center_x"]), float(src["center_y"])
        for dest in dest_circles:
            d = ((float(dest["center_x"]) - sx) ** 2 + (float(dest["center_y"]) - sy) ** 2) ** 0.5
            if d <= tol:
                pairs.append((d, str(src_id), str(dest["id"])))
    pairs.sort()
    used_src, used_dest = set(), set()
    assigned = []
    for d, sid, did in pairs:
        if sid in used_src or did in used_dest:
            continue
        used_src.add(sid)
        used_dest.add(did)
        assigned.append((sid, did, d))
    for sid in src_map:
        if sid in used_src:
            continue
        src = src_by_id.get(sid)
        if src is not None:
            continue
        if sid not in dest_by_id or sid in used_dest:
            continue
        used_src.add(sid)
        used_dest.add(sid)
        assigned.append((sid, sid, 0.0))
    return assigned, used_dest


def test_same_id_different_coord_uses_location():
    src_circles = [{"id": "C5090", "center_x": 10.0, "center_y": 20.0}]
    dest_circles = [
        {"id": "C5090", "center_x": 100.0, "center_y": 200.0},
        {"id": "C3120", "center_x": 10.0, "center_y": 20.0},
    ]
    assigned, used_dest = map_preset_by_coord({"C5090": 1500}, src_circles, dest_circles)
    assert assigned == [("C5090", "C3120", 0.0)]
    assert "C3120" in used_dest
    assert "C5090" not in used_dest


def test_coord_match_all_source_values():
    src_circles = [
        {"id": "A1", "center_x": 0.0, "center_y": 0.0},
        {"id": "A2", "center_x": 5.0, "center_y": 0.0},
    ]
    dest_circles = [
        {"id": "B9", "center_x": 0.0, "center_y": 0.0},
        {"id": "B8", "center_x": 5.0, "center_y": 0.0},
    ]
    assigned, _ = map_preset_by_coord({"A1": 800, "A2": 1100}, src_circles, dest_circles)
    dest_of = {s: d for s, d, _ in assigned}
    assert dest_of == {"A1": "B9", "A2": "B8"}
