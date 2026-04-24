"""
파일 마스터 좌표 기반 필지 검토(자동 쿼리점·대지 윤곽·외부 침범 판정).
외부 필지: VWorld WFS(선택, VWORLD_API_KEY) 또는 기하 정보만 반환.
"""
from __future__ import annotations

import json
import logging
import math
import os
import re
import statistics
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["parcel-review"])

try:
    from pyproj import Transformer

    _HAS_PYPROJ = True
except ImportError:
    _HAS_PYPROJ = False

try:
    from shapely.geometry import Point, Polygon, mapping

    _HAS_SHAPELY = True
except ImportError:
    _HAS_SHAPELY = False

# WFS BBOX: 쿼리 경위도 기준 사방 half_m(도면 근사 m), 대지(볼록) 꼭짓점 박스에 pad_m. 과대 시 500건 상한·잡필지 증가.
PARCEL_WFS_QUERY_BBOX_HALF_M = 280.0
PARCEL_WFS_SITE_BBOX_PAD_M = 170.0


class ParcelReviewVertex(BaseModel):
    x: float
    y: float


class ParcelReviewBuilding(BaseModel):
    name: str = ""
    kind: str = "building"
    vertices: List[ParcelReviewVertex] = Field(default_factory=list)


class ParcelReviewCircle(BaseModel):
    center_x: float = 0.0
    center_y: float = 0.0
    radius: Optional[float] = None


class ParcelReviewCluster(BaseModel):
    hull: List[ParcelReviewVertex] = Field(default_factory=list)


class ParcelReviewRequest(BaseModel):
    circles: List[ParcelReviewCircle] = Field(default_factory=list)
    buildings: List[ParcelReviewBuilding] = Field(default_factory=list)
    pile_clusters: List[ParcelReviewCluster] = Field(default_factory=list)
    """도면 좌표를 이 EPSG 평면좌표(미터)로 간주하고 4326으로 변환해 필지를 조회합니다."""
    assumed_epsg: int = Field(default=5186, ge=3857, le=5188)
    tolerance_m: float = Field(default=0.35, ge=0.0, le=5.0)
    swap_xy: bool = Field(
        default=False,
        description=(
            "True면 도면 (x,y)를 각각 북·동(N,E)으로 보고 EPSG 투입 시 (동,북)=(y,x)로 바꿉니다. "
            "일부 CAD는 축 라벨이 GIS와 반대로 저장됩니다."
        ),
    )


def _median(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    return float(statistics.median(xs))


def _convex_hull_monotone(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Andrew monotone chain. points unique by coord."""
    pts = sorted(set((float(x), float(y)) for x, y in points))
    if len(pts) <= 1:
        return list(pts)
    if len(pts) == 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: List[Tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: List[Tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _compute_query_point(req: ParcelReviewRequest) -> Tuple[float, float, str]:
    xs = [c.center_x for c in req.circles if math.isfinite(c.center_x) and math.isfinite(c.center_y)]
    ys = [c.center_y for c in req.circles if math.isfinite(c.center_x) and math.isfinite(c.center_y)]
    mx, my = _median(xs), _median(ys)
    if mx is not None and my is not None:
        return mx, my, "말뚝(원) 중심 좌표의 중앙값"
    verts: List[Tuple[float, float]] = []
    for b in req.buildings:
        for v in b.vertices:
            if math.isfinite(v.x) and math.isfinite(v.y):
                verts.append((v.x, v.y))
    if verts:
        x0 = min(x for x, _ in verts)
        x1 = max(x for x, _ in verts)
        y0 = min(y for _, y in verts)
        y1 = max(y for _, y in verts)
        return (x0 + x1) / 2, (y0 + y1) / 2, "동·주차장 윤곽 바운딩 박스 중심"
    for cl in req.pile_clusters:
        for v in cl.hull:
            if math.isfinite(v.x) and math.isfinite(v.y):
                verts.append((v.x, v.y))
    if verts:
        x0 = min(x for x, _ in verts)
        x1 = max(x for x, _ in verts)
        y0 = min(y for _, y in verts)
        y1 = max(y for _, y in verts)
        return (x0 + x1) / 2, (y0 + y1) / 2, "클러스터 hull 바운딩 박스 중심"
    return 0.0, 0.0, "none"


def _square_around_segment(p0: Tuple[float, float], p1: Tuple[float, float], pad: float) -> List[Tuple[float, float]]:
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length
    px, py = nx * pad, ny * pad
    return [
        (x0 - px, y0 - py),
        (x1 - px, y1 - py),
        (x1 + px, y1 + py),
        (x0 + px, y0 + py),
    ]


def _site_polygon_points(req: ParcelReviewRequest) -> List[Tuple[float, float]]:
    """대지(검토 대상) 외곽: 동·주차장·타워 윤곽 정점 우선, 없으면 말뚝 중심 볼록 껍질."""
    verts: List[Tuple[float, float]] = []
    for b in req.buildings:
        for v in b.vertices:
            if math.isfinite(v.x) and math.isfinite(v.y):
                verts.append((v.x, v.y))
    if len(verts) >= 3:
        return _convex_hull_monotone(verts)
    centers: List[Tuple[float, float]] = []
    radii: List[float] = []
    for c in req.circles:
        if math.isfinite(c.center_x) and math.isfinite(c.center_y):
            centers.append((c.center_x, c.center_y))
            r = c.radius if c.radius is not None and math.isfinite(float(c.radius)) and float(c.radius) > 0 else None
            radii.append(float(r) if r is not None else 0.0)
    if len(centers) >= 3:
        return _convex_hull_monotone(centers)
    if len(centers) == 2:
        pad = max(1.0, math.hypot(centers[1][0] - centers[0][0], centers[1][1] - centers[0][1]) * 0.15)
        return _square_around_segment(centers[0], centers[1], pad)
    if len(centers) == 1:
        r = max(radii[0] if radii else 0.0, 2.0)
        cx, cy = centers[0]
        return [(cx - r, cy - r), (cx + r, cy - r), (cx + r, cy + r), (cx - r, cy + r)]
    for cl in req.pile_clusters:
        for v in cl.hull:
            if math.isfinite(v.x) and math.isfinite(v.y):
                verts.append((v.x, v.y))
    if len(verts) >= 3:
        return _convex_hull_monotone(verts)
    return verts


def _gis_en_from_drawing(dx: float, dy: float, swap_xy: bool) -> Tuple[float, float]:
    """도면 (dx,dy) → EPSG 투영에 넣을 (동ing E, 북ing N). swap_xy면 (x,y)=(N,E)로 가정."""
    if swap_xy:
        return float(dy), float(dx)
    return float(dx), float(dy)


def _drawing_xy_from_gis_en(e: float, n: float, swap_xy: bool) -> Tuple[float, float]:
    """투영 (E,N) → 도면 (x,y). swap_xy면 도면 x=N, y=E."""
    if swap_xy:
        return float(n), float(e)
    return float(e), float(n)


def _to_lonlat(easting: float, northing: float, epsg: int) -> Optional[Tuple[float, float]]:
    """EPSG 평면 (동ing, 북ing) → WGS84."""
    if not _HAS_PYPROJ:
        return None
    try:
        t = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
        lon, lat = t.transform(easting, northing)
        if not (math.isfinite(lon) and math.isfinite(lat)):
            return None
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            return None
        return float(lon), float(lat)
    except Exception as e:
        _log.warning("proj transform failed: %s", e)
        return None


def _from_lonlat_ring(ring_lonlat: List[Tuple[float, float]], epsg: int, swap_xy: bool) -> List[Tuple[float, float]]:
    if not _HAS_PYPROJ or not ring_lonlat:
        return []
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    out: List[Tuple[float, float]] = []
    for lon, lat in ring_lonlat:
        e, n = t.transform(lon, lat)
        x_d, y_d = _drawing_xy_from_gis_en(e, n, swap_xy)
        if math.isfinite(x_d) and math.isfinite(y_d):
            out.append((float(x_d), float(y_d)))
    return out


def _parse_pos_list(text: str) -> List[Tuple[float, float]]:
    text = re.sub(r"\s+", " ", (text or "").strip())
    parts = text.replace(",", " ").split()
    nums: List[float] = []
    for p in parts:
        try:
            nums.append(float(p))
        except ValueError:
            continue
    if len(nums) < 4 or len(nums) % 2 != 0:
        return []
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums), 2)]


def _orient_ring_lonlat(
    ring: List[Tuple[float, float]],
    lon: float,
    lat: float,
) -> Tuple[List[Tuple[float, float]], str]:
    """posList (a,b)를 (경도,위도)로 둔 링과 꼭짓점 (b,a) 링 중 쿼리점에 더 맞는 쪽을 고릅니다."""
    if len(ring) < 3:
        return ring, "too_few_vertices"
    pt = Point(lon, lat)
    candidates: List[Tuple[Tuple[int, float], List[Tuple[float, float]], str]] = []
    for label, r in (
        ("as_parsed_pairs", ring),
        ("vertex_xy_swapped", [(b, a) for (a, b) in ring]),
    ):
        try:
            poly = Polygon(r)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty:
                continue
            ins = 1 if (poly.contains(pt) or poly.covers(pt)) else 0
            d = float(poly.distance(pt))
            candidates.append(((ins, -d), r, label))
        except Exception:
            continue
    if not candidates:
        return ring, "invalid_geometry_fallback_as_parsed"
    _sc, r_out, label = max(candidates, key=lambda x: x[0])
    return r_out, label


def _extract_poslist_rings_from_gml(
    xml_text: str,
    min_vertices: int = 3,
) -> List[Tuple[List[Tuple[float, float]], Dict[str, str]]]:
    """posList 링 (lon,lat) + attrs. min_vertices 이상 꼭짓점만."""
    found: List[Tuple[List[Tuple[float, float]], Dict[str, str]]] = []
    if not xml_text:
        return found
    for m in re.finditer(
        r"<(?:\w+:)?posList[^>]*>([^<]+)</(?:\w+:)?posList>",
        xml_text,
        flags=re.IGNORECASE,
    ):
        ring = _parse_pos_list(m.group(1))
        if len(ring) < min_vertices:
            continue
        chunk = xml_text[max(0, m.start() - 1200) : m.end() + 80]
        pnu_m = re.search(r"<[^>]*pnu[^>]*>(\d{10,25})</[^>]*pnu>", chunk, re.I)
        attrs: Dict[str, str] = {}
        if pnu_m:
            attrs["pnu"] = pnu_m.group(1)
        found.append((ring, attrs))
    return found


def _extract_polygons_from_gml(xml_text: str) -> List[Tuple[List[Tuple[float, float]], Dict[str, str]]]:
    """부번 등 폐곡선(삼각형 이상)."""
    return _extract_poslist_rings_from_gml(xml_text, min_vertices=3)


def _bbox_lonlat_around_query(lon: float, lat: float, half_m: float) -> Tuple[float, float, float, float]:
    """(min_lat, min_lon, max_lat, max_lon) — VWorld WFS BBOX 순서."""
    d_lat = half_m / 111_320.0
    cos_lat = max(0.2, abs(math.cos(math.radians(lat))))
    d_lon = half_m / (111_320.0 * cos_lat)
    return lat - d_lat, lon - d_lon, lat + d_lat, lon + d_lon


def _bbox_lonlat_from_drawing_site(
    site_pts: List[Tuple[float, float]],
    epsg: int,
    swap_xy: bool,
    pad_m: float,
) -> Optional[Tuple[float, float, float, float]]:
    """대지(도면 m) 꼭짓점을 WGS84로 넓혀 BBOX — 대지가 쿼리보다 넓을 때 WFS가 잘리지 않게."""
    if not _HAS_PYPROJ or len(site_pts) < 2:
        return None
    xs = [p[0] for p in site_pts]
    ys = [p[1] for p in site_pts]
    minx, maxx = min(xs) - pad_m, max(xs) + pad_m
    miny, maxy = min(ys) - pad_m, max(ys) + pad_m
    corners = [(minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy)]
    lons: List[float] = []
    lats: List[float] = []
    for dx, dy in corners:
        e, n = _gis_en_from_drawing(dx, dy, swap_xy)
        ll = _to_lonlat(e, n, epsg)
        if ll:
            lons.append(ll[0])
            lats.append(ll[1])
    if len(lons) < 2:
        return None
    return min(lats), min(lons), max(lats), max(lons)


def _merge_lonlat_bboxes(
    a: Tuple[float, float, float, float],
    b: Optional[Tuple[float, float, float, float]],
) -> Tuple[float, float, float, float]:
    if b is None:
        return a
    min_lat = min(a[0], b[0])
    min_lon = min(a[1], b[1])
    max_lat = max(a[2], b[2])
    max_lon = max(a[3], b[3])
    return min_lat, min_lon, max_lat, max_lon


def _fetch_vworld_cadastral_wfs_bbox(
    typename: str,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    api_key: str,
    domain: str,
    max_features: int,
    query_lonlat: Optional[Dict[str, float]] = None,
    min_poslist_vertices: int = 3,
) -> Tuple[List[Tuple[List[Tuple[float, float]], Dict[str, str]]], str, Dict[str, Any]]:
    """VWorld 연속지적 WFS GetFeature (EPSG:4326 BBOX). typename 예: lp_pa_cbnd_bubun, lp_pa_cbnd_bonbun."""
    if min_lat > max_lat:
        min_lat, max_lat = max_lat, min_lat
    if min_lon > max_lon:
        min_lon, max_lon = max_lon, min_lon
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon},EPSG:4326"
    meta: Dict[str, Any] = {
        "service": "VWorld WFS GetFeature",
        "typename": typename,
        "srs": "EPSG:4326",
        "bbox_param": bbox,
        "bbox_note": "VWorld 요구: min_lat,min_lon,max_lat,max_lon,EPSG:4326",
        "bbox_degrees": {
            "min_lat": round(min_lat, 8),
            "min_lon": round(min_lon, 8),
            "max_lat": round(max_lat, 8),
            "max_lon": round(max_lon, 8),
        },
        "query_lonlat_used": query_lonlat or {},
        "max_features": max_features,
        "min_poslist_vertices": min_poslist_vertices,
        "http_status": None,
        "response_chars": 0,
        "poslist_polygon_count": 0,
    }
    url = "https://api.vworld.kr/req/wfs"
    params = {
        "SERVICE": "WFS",
        "REQUEST": "GetFeature",
        "VERSION": "1.1.0",
        "TYPENAME": typename,
        "BBOX": bbox,
        "SRSNAME": "EPSG:4326",
        "OUTPUTFORMAT": "text/xml; subtype=gml/3.1.1",
        "MAXFEATURES": str(int(max_features)),
        "KEY": api_key,
        "DOMAIN": domain or "localhost",
    }
    try:
        r = requests.get(url, params=params, timeout=30)
        meta["http_status"] = int(r.status_code)
        meta["response_chars"] = len(r.text or "")
        if r.status_code != 200:
            return [], f"HTTP {r.status_code}", meta
        polys = _extract_poslist_rings_from_gml(r.text, min_vertices=min_poslist_vertices)
        meta["poslist_polygon_count"] = len(polys)
        if not polys and "ExceptionReport" in r.text:
            return [], "WFS 오류 응답", meta
        return polys, "", meta
    except requests.RequestException as e:
        meta["http_status"] = meta.get("http_status")
        return [], str(e), meta


def _fetch_vworld_parcels_bbox(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    api_key: str,
    domain: str,
    max_features: int,
    query_lonlat: Optional[Dict[str, float]] = None,
) -> Tuple[List[Tuple[List[Tuple[float, float]], Dict[str, str]]], str, Dict[str, Any]]:
    """WFS BBOX로 주변 필지(부번 경계). 하위 호환 래퍼."""
    return _fetch_vworld_cadastral_wfs_bbox(
        "lp_pa_cbnd_bubun",
        min_lat,
        min_lon,
        max_lat,
        max_lon,
        api_key,
        domain,
        max_features,
        query_lonlat,
        min_poslist_vertices=3,
    )


def _project_wfs_lonlat_rings_to_draw_xy(
    polys_ll: List[Tuple[List[Tuple[float, float]], Dict[str, str]]],
    lon: float,
    lat: float,
    epsg: int,
    swap_xy: bool,
    max_rings: int,
) -> List[List[Dict[str, float]]]:
    """4326 링들을 도면 m 폴리라인(닫힌 링)으로 투영. orient는 삼각형 이상만."""
    out: List[List[Dict[str, float]]] = []
    for ring_raw, _attrs in polys_ll[:max_rings]:
        if len(ring_raw) < 2:
            continue
        if len(ring_raw) >= 3:
            ring_ll, _o = _orient_ring_lonlat(ring_raw, lon, lat)
        else:
            ring_ll = ring_raw
        ring_proj = _from_lonlat_ring(ring_ll, epsg, swap_xy)
        if len(ring_proj) >= 2:
            out.append([{"x": float(px), "y": float(py)} for px, py in ring_proj])
    return out


def _fetch_vworld_parcels(
    lon: float,
    lat: float,
    api_key: str,
    domain: str,
) -> Tuple[List[Tuple[List[Tuple[float, float]], Dict[str, str]]], str, Dict[str, Any]]:
    """쿼리점 중심 BBOX (반경은 PARCEL_WFS_QUERY_BBOX_HALF_M, 하위 호환 엔드포인트)."""
    min_lat, min_lon, max_lat, max_lon = _bbox_lonlat_around_query(lon, lat, PARCEL_WFS_QUERY_BBOX_HALF_M)
    return _fetch_vworld_parcels_bbox(
        min_lat,
        min_lon,
        max_lat,
        max_lon,
        api_key,
        domain,
        200,
        {"lon": lon, "lat": lat},
    )


def _pick_parcel_polygon(
    polys: List[Tuple[List[Tuple[float, float]], Dict[str, str]]],
    lon: float,
    lat: float,
    qx: float,
    qy: float,
    epsg: int,
    swap_xy: bool,
) -> Tuple[Optional[List[Tuple[float, float]]], Optional[str], bool, bool, Dict[str, Any]]:
    """선택한 필지 링, PNU, 쿼리∈필지(WGS84), 쿼리∈필지(투영 도면), pick_디버그.

    우선순위:
    (1) 도면 투영에서 쿼리점 포함
    (2) WGS84 평면에서 쿼리점 포함
    (3) 도면 투영 링까지 거리(m) 짧을수록
    (4) WGS84 평면에서 링까지 거리(도) 짧을수록 — 투영 거리 동점 시 보조
    (5) 투영 면적이 작을수록 — 인접 동일 거리일 때 지번 조각·대지 필지 구분
    """
    pick_dbg: Dict[str, Any] = {
        "metric": (
            "maximize (inside_projected_draw, inside_wgs84_planar, -distance_m_projected, "
            "-distance_deg_ll_planar, -area_sqm_projected)"
        ),
        "candidates_total": 0,
        "candidates_ranked": [],
    }
    if not polys or not _HAS_SHAPELY:
        pick_dbg["note"] = "no_polygons_or_no_shapely"
        return None, None, False, False, pick_dbg
    pt_ll = Point(lon, lat)
    pt_draw = Point(qx, qy)
    best: Optional[Tuple[int, int, float, float, float, List[Tuple[float, float]], str]] = None
    sortable: List[Tuple[Tuple[int, int, float, float, float], Dict[str, Any]]] = []
    for ring_raw, attrs in polys:
        if len(ring_raw) < 3:
            continue
        ring, orient = _orient_ring_lonlat(ring_raw, lon, lat)
        try:
            poly_ll = Polygon(ring)
            if not poly_ll.is_valid:
                poly_ll = poly_ll.buffer(0)
            if poly_ll.is_empty:
                continue
            inside_ll = 1 if (poly_ll.contains(pt_ll) or poly_ll.covers(pt_ll)) else 0
            d_ll = float(poly_ll.distance(pt_ll))
            ring_proj: List[Tuple[float, float]] = []
            inside_draw = 0
            d_proj = 1e18
            area_draw = 0.0
            if _HAS_PYPROJ:
                ring_proj = _from_lonlat_ring(ring, epsg, swap_xy)
                if len(ring_proj) >= 3:
                    poly_draw = Polygon(ring_proj)
                    if not poly_draw.is_valid:
                        poly_draw = poly_draw.buffer(0)
                    if not poly_draw.is_empty:
                        area_draw = float(poly_draw.area)
                        if poly_draw.contains(pt_draw) or poly_draw.covers(pt_draw):
                            inside_draw = 1
                            d_proj = 0.0
                        else:
                            d_proj = float(poly_draw.distance(pt_draw))
            else:
                d_proj = 0.0 if inside_ll else d_ll
            pnu = attrs.get("pnu", "") or ""
            cand = (inside_draw, inside_ll, -d_proj, -d_ll, -area_draw, ring, pnu)
            if best is None or cand > best:
                best = cand
            k = (inside_draw, inside_ll, -d_proj, -d_ll, -area_draw)
            ring_xy: Optional[List[Dict[str, float]]] = None
            if len(ring_proj) >= 3:
                ring_xy = [{"x": round(float(px), 4), "y": round(float(py), 4)} for px, py in ring_proj]
            sortable.append(
                (
                    k,
                    {
                        "pnu": (pnu or None),
                        "vertex_count": len(ring),
                        "ring_orient": orient,
                        "inside_wgs84_planar": bool(inside_ll),
                        "inside_projected_draw": bool(inside_draw),
                        "distance_query_to_ring_m_projected": (round(float(d_proj), 4) if d_proj < 1e17 else None),
                        "distance_query_to_ring_deg_ll_planar": round(float(d_ll), 10),
                        "area_sqm_projected": (round(area_draw, 2) if area_draw > 0 else None),
                        "ring_draw_xy": ring_xy,
                    },
                )
            )
        except Exception:
            continue
    pick_dbg["candidates_total"] = len(sortable)
    sortable.sort(key=lambda x: x[0], reverse=True)
    # 도면 오버레이용: 대지·쿼리 넓은 BBOX 조회 시 후보가 많으므로 상위 150개까지 투영 링 유지
    pick_dbg["candidates_ranked"] = [r for _, r in sortable[:150]]

    if best is None:
        pick_dbg["note"] = "no_valid_polygon_after_parse"
        return None, None, False, False, pick_dbg
    inside_draw_b, inside_ll_b, _, _, _, ring_out, pnu_out = best
    pick_dbg["winner_pnu"] = pnu_out or None
    pick_dbg["winner_flags"] = {
        "inside_wgs84_planar": bool(inside_ll_b),
        "inside_projected_draw": bool(inside_draw_b),
    }
    if not inside_draw_b and not inside_ll_b:
        pick_dbg["fallback_nearest"] = True
        pick_dbg["fallback_explanation"] = (
            "조회된 모든 필지에서 쿼리점이 링 내부가 아닙니다. "
            "그 경우 연속지적 선택은 도면 투영 거리(m) → WGS84 평면 거리(도) → 투영 면적 순으로 "
            "가장 가까운 필지로 정해집니다(행정상 ‘현장 필지’와 다를 수 있음). "
            "EPSG·XY바꿔 투영·말뚝 중앙값이 실제 대지와 맞는지 확인하세요."
        )
    return ring_out, (pnu_out or None), bool(inside_ll_b), bool(inside_draw_b), pick_dbg


def _client_nearby_parcel_rings(pick_dbg: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """프론트 오버레이용. debug 중첩 없이도 인접 링을 쓰도록 최상위 응답에 실을 목록."""
    if not pick_dbg or not isinstance(pick_dbg, dict):
        return []
    ranked = pick_dbg.get("candidates_ranked")
    if not isinstance(ranked, list):
        return []
    winner = pick_dbg.get("winner_pnu")
    w_key = str(winner).strip() if winner is not None and str(winner).strip() != "" else ""
    out: List[Dict[str, Any]] = []
    winner_row_emitted = False
    for c in ranked[:150]:
        if not isinstance(c, dict):
            continue
        ring = c.get("ring_draw_xy")
        if not isinstance(ring, list) or len(ring) < 3:
            continue
        pn = c.get("pnu")
        pnu_s = str(pn).strip() if pn is not None and str(pn).strip() != "" else ""
        is_w = bool(w_key and pnu_s == w_key)
        # 동일 PNU가 후보 목록에 여러 번 오면 모두 is_winner=True가 되어 프론트에서 인접 선이 전부 스킵됨 → 한 건만 승자로 표시
        if is_w and winner_row_emitted:
            is_w = False
        if is_w:
            winner_row_emitted = True
        out.append({"pnu": pnu_s or None, "ring": ring, "is_winner": is_w})
    return out


@router.post("/parcel-review")
def parcel_review(body: ParcelReviewRequest = Body(...)) -> Dict[str, Any]:
    warnings: List[str] = []
    if not _HAS_PYPROJ:
        warnings.append("pyproj 미설치: 좌표 변환·필지 연동을 사용할 수 없습니다. requirements 설치 후 다시 시도하세요.")
    if not _HAS_SHAPELY:
        warnings.append("shapely 미설치: 필지 링 평가가 제한됩니다. requirements 설치 후 다시 시도하세요.")

    qx, qy, qmethod = _compute_query_point(body)
    site_pts = _site_polygon_points(body)
    site_ring_draw = [{"x": px, "y": py} for px, py in site_pts]

    e0, n0 = (0.0, 0.0)
    lonlat: Optional[Tuple[float, float]] = None
    if _HAS_PYPROJ:
        e0, n0 = _gis_en_from_drawing(qx, qy, body.swap_xy)
        lonlat = _to_lonlat(e0, n0, body.assumed_epsg)
    if lonlat is None and _HAS_PYPROJ:
        warnings.append(
            "쿼리점을 경위도로 변환하지 못했습니다. assumed_epsg·도면 단위를 확인하세요. "
            "CAD 축이 북동(N,E)과 X,Y가 뒤집혀 있으면 「XY 바꿔 투영」을 켜 보세요.",
        )

    parcel_ring_draw: List[Dict[str, float]] = []
    encroachment_rings_draw: List[List[Dict[str, float]]] = []
    parcel_pnu: Optional[str] = None
    parcel_available = False
    parcel_contains_query_lonlat = False
    query_inside_parcel_drawing: bool = False
    encroachment = False
    encroachment_area_sqm: Optional[float] = None
    message = ""
    nearby_parcel_rings_draw: List[Dict[str, Any]] = []
    cadastral_bonbun_rings_draw: List[List[Dict[str, float]]] = []

    api_key = (os.environ.get("VWORLD_API_KEY") or os.environ.get("VWORLD_KEY") or "").strip()
    domain = (os.environ.get("VWORLD_DOMAIN") or "localhost").strip()

    debug: Dict[str, Any] = {
        "version": 1,
        "coordinate_chain": (
            "도면(x,y) → swap_xy면 (E,N)=(y,x)로 EPSG 투입 → pyproj로 WGS84 쿼리점 → "
            "VWorld WFS(EPSG:4326 posList) → _orient_ring_lonlat 로 꼭짓점 쌍 보정 → "
            "동일 assumed_epsg로 필지 링을 도면 m에 투영 → 말뚝·대지(볼록)와 같은 평면에서 Shapely 판정"
        ),
        "internal_vs_external": {
            "external_source": (
                "VWorld WFS GetFeature lp_pa_cbnd_bubun(부번)·lp_pa_cbnd_bonbun(본번 경계선), SRSNAME EPSG:4326"
            ),
            "internal_comparison_plane": (
                f"도면 좌표(미터): assumed_epsg={body.assumed_epsg} 로 투영한 필지 링 vs "
                "말뚝·동·클러스터 볼록 윤곽(동일 좌표)"
            ),
        },
        "drawing_query": {"x": qx, "y": qy, "method": qmethod},
        "tm_inputs_for_pyproj": {
            "easting_m": round(e0, 6),
            "northing_m": round(n0, 6),
            "swap_xy": bool(body.swap_xy),
            "assumed_epsg": body.assumed_epsg,
        },
        "computed_query_lonlat": ({"lon": lonlat[0], "lat": lonlat[1]} if lonlat else None),
        "site_polygon_vertex_count": len(site_pts),
        "wfs": {},
        "parcel_pick": {},
    }

    if lonlat and api_key and _HAS_SHAPELY:
        lon, lat = lonlat
        q_bbox = _bbox_lonlat_around_query(lon, lat, PARCEL_WFS_QUERY_BBOX_HALF_M)
        site_bbox = _bbox_lonlat_from_drawing_site(
            site_pts, body.assumed_epsg, body.swap_xy, PARCEL_WFS_SITE_BBOX_PAD_M
        )
        merged = _merge_lonlat_bboxes(q_bbox, site_bbox)
        polys, err, wfs_meta = _fetch_vworld_parcels_bbox(
            merged[0],
            merged[1],
            merged[2],
            merged[3],
            api_key,
            domain,
            500,
            {"lon": lon, "lat": lat},
        )
        bonb_polys, bonb_err, bonb_meta = _fetch_vworld_cadastral_wfs_bbox(
            "lp_pa_cbnd_bonbun",
            merged[0],
            merged[1],
            merged[2],
            merged[3],
            api_key,
            domain,
            350,
            {"lon": lon, "lat": lat},
            min_poslist_vertices=2,
        )
        cadastral_bonbun_rings_draw = _project_wfs_lonlat_rings_to_draw_xy(
            bonb_polys,
            lon,
            lat,
            body.assumed_epsg,
            body.swap_xy,
            max_rings=300,
        )
        debug["wfs"] = {
            **wfs_meta,
            "fetch_error": err or None,
            "bbox_query": {
                "half_m": PARCEL_WFS_QUERY_BBOX_HALF_M,
                "min_lat": round(q_bbox[0], 8),
                "min_lon": round(q_bbox[1], 8),
                "max_lat": round(q_bbox[2], 8),
                "max_lon": round(q_bbox[3], 8),
            },
            "bbox_from_site_polygon": (
                {
                    "min_lat": round(site_bbox[0], 8),
                    "min_lon": round(site_bbox[1], 8),
                    "max_lat": round(site_bbox[2], 8),
                    "max_lon": round(site_bbox[3], 8),
                }
                if site_bbox
                else None
            ),
            "bbox_merged_used": {
                "min_lat": round(merged[0], 8),
                "min_lon": round(merged[1], 8),
                "max_lat": round(merged[2], 8),
                "max_lon": round(merged[3], 8),
            },
        }
        debug["wfs_bonbun"] = {
            **bonb_meta,
            "fetch_error": bonb_err or None,
            "rings_projected_count": len(cadastral_bonbun_rings_draw),
        }
        if err:
            warnings.append(f"VWorld 필지 조회 실패: {err}")
        ring4326, pnu_guess, parcel_contains_query_lonlat, query_inside_parcel_drawing, pick_dbg = _pick_parcel_polygon(
            polys,
            lon,
            lat,
            qx,
            qy,
            body.assumed_epsg,
            body.swap_xy,
        )
        debug["parcel_pick"] = pick_dbg
        nearby_parcel_rings_draw = _client_nearby_parcel_rings(pick_dbg)
        if ring4326 and len(ring4326) >= 3:
            parcel_available = True
            parcel_pnu = pnu_guess
            ring_proj = _from_lonlat_ring(ring4326, body.assumed_epsg, body.swap_xy)
            if len(ring_proj) >= 3:
                parcel_ring_draw = [{"x": px, "y": py} for px, py in ring_proj]
                if not query_inside_parcel_drawing and parcel_contains_query_lonlat:
                    warnings.append(
                        "경위도 링 안이나 도면 투영 링 밖입니다. assumed_epsg·원점·XY바꿔 투영을 확인하세요.",
                    )
                elif query_inside_parcel_drawing and not parcel_contains_query_lonlat:
                    warnings.append(
                        "도면 투영 기준으로는 필지 안입니다. WGS84 링은 평면 근사·좌표 순서와 어긋날 수 있습니다.",
                    )
                # 대지(볼록) vs 단일 연속지적 면적 차(침범) 비교는 하지 않음 — 오버레이·WFS 후보만 제공
                encroachment = False
                encroachment_area_sqm = None
                encroachment_rings_draw = []
            else:
                warnings.append("필지 경계를 도면 좌표로 변환하지 못했습니다.")
        elif api_key and not polys:
            warnings.append("주변에 필지 경계 응답이 없습니다. 좌표계·현장 위치를 확인하세요.")
    else:
        if not api_key:
            debug["wfs"] = {"skipped": True, "reason": "VWORLD_API_KEY unset"}
            warnings.append(
                "VWORLD_API_KEY 환경 변수가 없어 외부 필지 경계를 가져오지 않았습니다. "
                "키를 설정하면 자동으로 연속지적 경계를 조회합니다."
            )
        elif not lonlat:
            debug["wfs"] = {"skipped": True, "reason": "query_lonlat unavailable (pyproj/epsg)"}
        elif not _HAS_SHAPELY:
            debug["wfs"] = {"skipped": True, "reason": "shapely unavailable"}
        message = "도면 기준 쿼리점·대지 윤곽(볼록)만 계산했습니다. 키 설정 후 다시 실행하면 연속지적 링을 함께 조회합니다."

    if len(site_pts) >= 3 and _HAS_SHAPELY:
        try:
            _sp = Polygon(site_pts)
            if _sp.is_valid and not _sp.is_empty:
                debug["site_convex_hull_area_sqm"] = round(float(_sp.area), 2)
        except Exception:
            pass
    debug["result_flags"] = {
        "parcel_available": parcel_available,
        "parcel_pnu": parcel_pnu,
        "parcel_contains_query_lonlat": parcel_contains_query_lonlat,
        "query_inside_parcel_drawing": query_inside_parcel_drawing,
        "encroachment": encroachment,
        "encroachment_area_sqm": encroachment_area_sqm,
    }
    debug["request_echo"] = {
        "circles": len(body.circles),
        "buildings": len(body.buildings),
        "pile_clusters": len(body.pile_clusters),
        "assumed_epsg": body.assumed_epsg,
        "swap_xy": bool(body.swap_xy),
        "tolerance_m": body.tolerance_m,
    }

    return {
        "ok": True,
        "query_point": {"x": qx, "y": qy, "method": qmethod},
        "query_lonlat": ({"lon": lonlat[0], "lat": lonlat[1]} if lonlat else None),
        "assumed_epsg": body.assumed_epsg,
        "tolerance_m": body.tolerance_m,
        "swap_xy": bool(body.swap_xy),
        "site_polygon": site_ring_draw,
        "parcel_available": parcel_available,
        "parcel_pnu": parcel_pnu,
        "parcel_contains_query_lonlat": parcel_contains_query_lonlat,
        "query_inside_parcel_drawing": query_inside_parcel_drawing,
        "parcel_ring": parcel_ring_draw,
        "encroachment": encroachment,
        "encroachment_area_sqm": encroachment_area_sqm,
        "encroachment_rings": encroachment_rings_draw,
        "warnings": warnings,
        "message": message,
        "nearby_parcel_rings": nearby_parcel_rings_draw,
        "cadastral_bonbun_rings": cadastral_bonbun_rings_draw,
        "debug": debug,
    }
