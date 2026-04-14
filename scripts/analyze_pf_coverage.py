"""One-off: analyze PF vs polylines in saved work JSON (e.g. 풍무역 V1.1.2)."""
import json
import math
import sys
from pathlib import Path


def polygon_area(verts):
    if len(verts) < 3:
        return 0
    s = 0.0
    for i in range(len(verts)):
        a, b = verts[i], verts[(i + 1) % len(verts)]
        s += a["x"] * b["y"] - b["x"] * a["y"]
    return abs(s) / 2


def point_in_poly(pt, verts):
    x, y = pt["x"], pt["y"]
    n = len(verts)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = verts[i]["x"], verts[i]["y"]
        xj, yj = verts[j]["x"], verts[j]["y"]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-18) + xi):
            inside = not inside
        j = i
    return inside


def dist_point_to_seg(p, a, b):
    px, py = p["x"], p["y"]
    ax, ay, bx, by = a["x"], a["y"], b["x"], b["y"]
    vx, vy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy + 1e-30)))
    qx, qy = ax + t * vx, ay + t * vy
    return math.hypot(px - qx, py - qy)


def dist_point_to_poly(pt, verts):
    if point_in_poly(pt, verts):
        return 0.0
    dmin = float("inf")
    for i in range(len(verts)):
        d = dist_point_to_seg(pt, verts[i], verts[(i + 1) % len(verts)])
        dmin = min(dmin, d)
    return dmin


def simple_normalize_vertices(pl):
    pts = pl.get("points") or []
    verts = [
        {"x": float(p["x"]), "y": float(p["y"])}
        for p in pts
        if p.get("x") is not None and p.get("y") is not None
    ]
    if len(verts) < 3:
        return []
    if math.hypot(verts[0]["x"] - verts[-1]["x"], verts[0]["y"] - verts[-1]["y"]) < 1e-6:
        verts = verts[:-1]
    return verts


def max_d_for_poly(vertices, band_small=True):
    xs = [v["x"] for v in vertices]
    ys = [v["y"] for v in vertices]
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    side = max(dx, dy, 1)
    diag = math.hypot(dx, dy) or side
    cap = min(max(side * 0.05, diag * 0.035), 220)
    base = max(35, min(cap, 260))
    if band_small:
        return max(30, min(base * 0.68, 165))
    return min(base, 215)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "data/saved_works/work_7cf2c96284c0.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw = data["rawPolylines"]
    polys = []
    for i, pl in enumerate(raw):
        vid = str(pl.get("id") or pl.get("cluster_id") or f"polyline-{i+1}")
        v = simple_normalize_vertices(pl)
        if len(v) < 3:
            continue
        a = polygon_area(v)
        if not (math.isfinite(a) and a > 1e-10):
            continue
        polys.append({"id": vid, "vertices": v, "area": a})

    polys.sort(key=lambda r: (r["area"], r["id"]))
    print(f"file: {path.name}")
    print(f"usable outline polylines: {len(polys)}")

    texts = data["texts"]
    cands = []
    for t in texts:
        if not t.get("foundation_pf_only"):
            continue
        # construction.js getPfTextWorldXYFromTextRecord: text_center → insert → center
        tx = float(
            t.get("text_center_x") if t.get("text_center_x") is not None else t.get("insert_x") if t.get("insert_x") is not None else t.get("center_x") or 0
        )
        ty = float(
            t.get("text_center_y") if t.get("text_center_y") is not None else t.get("insert_y") if t.get("insert_y") is not None else t.get("center_y") or 0
        )
        h = float(t.get("height") or 0)
        cands.append({"id": str(t["id"]), "x": tx, "y": ty, "h": h, "text": (t.get("text") or "")[:20]})

    print(f"foundation_pf_only texts: {len(cands)}")

    hs = sorted([c["h"] for c in cands if c["h"] > 0])
    med = hs[len(hs) // 2] if hs else 0
    print(f"positive height median: {med}")

    small_ids = set()
    large_ids = set()
    for c in cands:
        if c["h"] <= 0:
            small_ids.add(c["id"])
        elif med and c["h"] <= med:
            small_ids.add(c["id"])
        else:
            large_ids.add(c["id"])
    print(f"small band: {len(small_ids)}  large band: {len(large_ids)}")

    def owner_for_pt(pt):
        for pl in polys:
            if point_in_poly(pt, pl["vertices"]):
                return pl["id"]
        return None

    cand_owner = {c["id"]: owner_for_pt({"x": c["x"], "y": c["y"]}) for c in cands}
    null_own = sum(1 for v in cand_owner.values() if v is None)
    print(f"candidates with NO containing poly (insert outside all outlines): {null_own} / {len(cands)}")

    band_small = True
    idset = small_ids if band_small else large_ids
    jobs_with = 0
    for pl in polys:
        maxd = max_d_for_poly(pl["vertices"], band_small)
        ok = False
        pid = pl["id"]
        for c in cands:
            if c["id"] not in idset:
                continue
            oid = cand_owner[c["id"]]
            if oid is not None and oid != pid:
                continue
            d = dist_point_to_poly({"x": c["x"], "y": c["y"]}, pl["vertices"])
            if d <= maxd:
                ok = True
                break
        if ok:
            jobs_with += 1

    print(f"polys with >=1 assignable cand (owner strict, small band, maxD): {jobs_with}")
    print(f"polys with zero assignable cand: {len(polys) - jobs_with}")


if __name__ == "__main__":
    main()
