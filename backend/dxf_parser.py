from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import ezdxf
_WARNED_NUMPY = False
try:  # pragma: no cover - fallback if numpy is unavailable
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore
from ezdxf.entities import Circle, Insert, Line, LWPolyline, MText, Polyline, Text
from ezdxf.layouts import BaseLayout
from ezdxf.math import BoundingBox, Vec3

# 호(bulge) 세그먼트가 있는 LWPOLYLINE을 경로로 평탄화해 점을 얻기 위함 (선택)
try:
    from ezdxf.path import make_path as _ezdxf_make_path
    _HAS_PATH = True
except ImportError:
    _HAS_PATH = False
    _ezdxf_make_path = None

NUMERIC_TEXT_PATTERN = re.compile(r"^[0-9.\-]+$")
CHAR_WIDTH_FACTOR = 0.6


def _normalize_label_hyphens(s: str) -> str:
    return (
        s.replace("\u2212", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )


def _leading_pf_ascii(compact: str) -> Optional[str]:
    """첫 글자를 ASCII P/F 로 본다(전각 ＰＦ·일반 p f 포함). 아니면 None."""
    if not compact:
        return None
    ch = compact[0]
    o = ord(ch)
    if 0xFF21 <= o <= 0xFF3A:
        mapped = chr(o - 0xFF21 + ord("A"))
    elif 0xFF41 <= o <= 0xFF5A:
        mapped = chr(o - 0xFF41 + ord("A"))
    else:
        mapped = ch.upper()
    return mapped if mapped in ("P", "F") else None


def _ascii_fold_pf_compact(compact: str) -> str:
    """전각 P/F/숫자 등을 ASCII로 펼쳐 PF1 패턴 검사용 문자열을 만든다."""
    out: List[str] = []
    for ch in compact:
        o = ord(ch)
        if 0xFF21 <= o <= 0xFF3A:
            out.append(chr(o - 0xFF21 + ord("A")))
        elif 0xFF41 <= o <= 0xFF5A:
            out.append(chr(o - 0xFF41 + ord("A")))
        elif 0xFF10 <= o <= 0xFF19:
            out.append(chr(o - 0xFF10 + ord("0")))
        else:
            out.append(ch)
    return "".join(out)


def _is_pf_digit_mark_compact(compact: str) -> bool:
    """PF1, PF2, PF2A, PF-3, PF2A-D800, pf12, ＰＦ１ 등 P+F+번호 계열."""
    s = _ascii_fold_pf_compact(compact).upper()
    return bool(re.match(r"^PF-?\d+[A-Z]?(?:-[A-Z0-9]+)?$", s))


def _pf_core_label(compact: str) -> Optional[str]:
    """
    PF 코드에 접미 식별자(-D800 등)가 붙은 경우 앞의 핵심 코드만 사용.
    예) PF2A-D800 -> PF2A
    """
    m = re.match(r"^(PF-?\d+[A-Za-z]?)(?:-[A-Za-z0-9]+)+$", compact)
    if not m:
        return None
    return m.group(1)


def _normalize_tower_crane_pile_label(compact: str) -> Optional[str]:
    """타워크레인 파일번호(T/TC) 표기를 정규화한다. 예) tc4-1 -> TC4-1"""
    m = re.match(r"^(T|TC)(\d+)-(\d+)$", compact, flags=re.IGNORECASE)
    if not m:
        return None
    return f"{m.group(1).upper()}{m.group(2)}-{m.group(3)}"


def _is_foundation_pf_style_compact(compact: str) -> bool:
    """P/F 기초 표기로 보이는 경우만( PHC·PART 등 잡문자열 제외 )."""
    if not compact:
        return False
    if _is_pf_digit_mark_compact(compact):
        return True
    if _leading_pf_ascii(compact) is None:
        return False
    if len(compact) == 1:
        return True
    c1 = compact[1]
    if c1 in "-\u2212\u2013\u2014." or c1.isdigit():
        return True
    # ASCII 라틴 알파벳만 이어지면 PHC·PART 등으로 보고 제외
    if ("A" <= c1 <= "Z") or ("a" <= c1 <= "z"):
        return False
    # 숫자·하이픈 다음: 한글·전각·기호 등은 현장 기초 구역명으로 수집
    return True


def _leading_pf_collectible(compact: str) -> bool:
    """
    공백 제거 본문이 P/F(전각 포함)로 시작하면 기초 후보로 본다.
    PHC·PART 등 말뚝/기초 라벨이 아닌 흔한 잡문자열은 기존과 같이 제외.
    """
    if not compact:
        return False
    if _leading_pf_ascii(compact) is None:
        return False
    u = _ascii_fold_pf_compact(compact).upper()
    if u in ("PHC", "PART"):
        return False
    return True


def foundation_pf_only_flag(raw: str) -> bool:
    """말뚝 번호가 아닌 기초 P/F 표기 — 뷰어·기초 탭용으로만 수집, 자동 매칭 후보에서는 제외."""
    s = _normalize_label_hyphens((raw or "").strip())
    compact = re.sub(r"\s+", "", s)
    if not compact:
        return False
    if NUMERIC_TEXT_PATTERN.fullmatch(compact):
        return False
    if _normalize_tower_crane_pile_label(compact):
        return False
    if _leading_pf_collectible(compact):
        return True
    return _is_foundation_pf_style_compact(compact)


def pile_label_for_collection(raw: str) -> Optional[str]:
    """
    DXF에서 말뚝 매칭 후보로 넣을 TEXT 본문.
    - 숫자·소수점·마이너스·하이픈만 (기존)
    - 또는 T/TC(호기)-파일 번호 (예: T4-1, TC4-1). 앞에 T/TC가 없는 4-1은 동-번호로 숫자 패턴만으로 수집.
    - 또는 기초골조용 P/F로 시작하는 표기(공백 제거 후 첫 글자) — 캔버스 표시·기초 탭 P/F 짝지음용.
    공백은 T/TC 형식에서만 제거해 T4-1, TC4-1과 동일하게 취급.
    """
    s = _normalize_label_hyphens((raw or "").strip())
    if not s:
        return None
    if NUMERIC_TEXT_PATTERN.fullmatch(s):
        return s
    compact = re.sub(r"\s+", "", s)
    tower_label = _normalize_tower_crane_pile_label(compact)
    if tower_label:
        return tower_label
    if _is_foundation_pf_style_compact(compact):
        pf_core = _pf_core_label(compact)
        if pf_core:
            return pf_core
        return s if len(s) <= 120 else f"{s[:117]}..."
    if _leading_pf_collectible(compact):
        pf_core = _pf_core_label(compact)
        if pf_core:
            return pf_core
        return s if len(s) <= 120 else f"{s[:117]}..."
    return None
# 원형 폴리라인 인식: 절대 오차(단위), 상대 오차(반지름 대비), 최소 꼭짓점 수
POLYLINE_CIRCLE_TOLERANCE = 0.01
POLYLINE_CIRCLE_RELATIVE_TOLERANCE = 0.02  # 반지름의 2% 이내면 원으로 인정
MIN_POLYLINE_CIRCLE_POINTS = 4
# 폴리곤 면적이 적합원 면적의 이 비율 이상이어야 원으로 인정 (사각형은 2/π≈0.64라서 제외)
POLYLINE_CIRCLE_AREA_RATIO_MIN = 0.85
LINE_JOIN_TOLERANCE = 1e-3


@dataclass(frozen=True)
class LineSegmentRecord:
    start: Tuple[float, float]
    end: Tuple[float, float]
    layer: str
    block_name: Optional[str]


def _point_key(point: Tuple[float, float], tolerance: float) -> Tuple[int, int]:
    if tolerance <= 0:
        return (int(round(point[0] * 1e6)), int(round(point[1] * 1e6)))
    return (
        int(round(point[0] / tolerance)),
        int(round(point[1] / tolerance)),
    )


def _join_lines_to_closed_polylines(
    segments: Sequence[LineSegmentRecord],
    tolerance: float = LINE_JOIN_TOLERANCE,
) -> List[Dict]:
    if not segments:
        return []

    grouped: Dict[Tuple[str, Optional[str]], List[LineSegmentRecord]] = {}
    for seg in segments:
        grouped.setdefault((seg.layer, seg.block_name), []).append(seg)

    merged: List[Dict] = []
    for (layer, block_name), group in grouped.items():
        node_sum: Dict[Tuple[int, int], List[float]] = {}
        adjacency: Dict[Tuple[int, int], List[int]] = {}
        edges: List[Tuple[Tuple[int, int], Tuple[int, int]]] = []
        edge_block_names: List[Optional[str]] = []

        for seg in group:
            n1 = _point_key(seg.start, tolerance)
            n2 = _point_key(seg.end, tolerance)
            if n1 == n2:
                continue
            node_sum.setdefault(n1, [0.0, 0.0, 0.0])
            node_sum.setdefault(n2, [0.0, 0.0, 0.0])
            node_sum[n1][0] += seg.start[0]
            node_sum[n1][1] += seg.start[1]
            node_sum[n1][2] += 1.0
            node_sum[n2][0] += seg.end[0]
            node_sum[n2][1] += seg.end[1]
            node_sum[n2][2] += 1.0
            edge_index = len(edges)
            edges.append((n1, n2))
            edge_block_names.append(seg.block_name)
            adjacency.setdefault(n1, []).append(edge_index)
            adjacency.setdefault(n2, []).append(edge_index)

        if not edges:
            continue

        node_point: Dict[Tuple[int, int], Tuple[float, float]] = {}
        for node, stats in node_sum.items():
            count = stats[2] or 1.0
            node_point[node] = (stats[0] / count, stats[1] / count)

        unvisited = set(range(len(edges)))
        while unvisited:
            first_edge = unvisited.pop()
            start_node, next_node = edges[first_edge]
            loop_nodes = [start_node, next_node]
            prev_node = start_node
            current_node = next_node
            edge_indices = [first_edge]

            while True:
                candidates = [
                    edge_idx for edge_idx in adjacency.get(current_node, []) if edge_idx in unvisited
                ]
                if not candidates:
                    break
                chosen_edge = candidates[0]
                for edge_idx in candidates:
                    n1, n2 = edges[edge_idx]
                    other = n2 if n1 == current_node else n1
                    if other != prev_node:
                        chosen_edge = edge_idx
                        break
                unvisited.remove(chosen_edge)
                n1, n2 = edges[chosen_edge]
                other_node = n2 if n1 == current_node else n1
                edge_indices.append(chosen_edge)
                loop_nodes.append(other_node)
                prev_node, current_node = current_node, other_node
                if current_node == loop_nodes[0]:
                    break

            if current_node != loop_nodes[0]:
                continue
            unique_nodes = loop_nodes[:-1]
            if len(unique_nodes) < 3:
                continue
            points = [
                {"x": node_point[node][0], "y": node_point[node][1]}
                for node in unique_nodes
            ]
            if len(points) < 3:
                continue
            merged.append(
                {
                    "closed": True,
                    "points": points,
                    "layer": layer,
                    "block_name": block_name or next(
                        (
                            edge_block_names[edge_idx]
                            for edge_idx in edge_indices
                            if edge_block_names[edge_idx]
                        ),
                        None,
                    ),
                    "source": "LINE_JOIN",
                }
            )

    return merged


def fit_circle(xs: Sequence[float], ys: Sequence[float]) -> tuple[float, float, float]:
    """Compute best-fit circle for the given coordinates via least squares."""
    if len(xs) != len(ys):
        raise ValueError("xs and ys must have the same length.")
    if len(xs) < 3:
        raise ValueError("At least three points are required to fit a circle.")

    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    A = np.column_stack((x, y, np.ones_like(x)))
    b = x**2 + y**2
    params, *_ = np.linalg.lstsq(A, b, rcond=None)
    a, b_param, c = params
    cx = a / 2.0
    cy = b_param / 2.0
    r_sq = cx * cx + cy * cy + c
    radius = math.sqrt(max(r_sq, 0.0))
    return float(cx), float(cy), float(radius)


def _polygon_area_shoelace(points: Sequence[Tuple[float, float]]) -> float:
    """닫힌 폴리곤의 부호 있는 면적(시계방향이면 음수). 절대값이 실제 면적."""
    if len(points) < 3:
        return 0.0
    n = len(points)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    return abs(area) * 0.5


def _evaluate_polyline_circle(
    points: Sequence[Tuple[float, float]],
    tol: float = POLYLINE_CIRCLE_TOLERANCE,
    relative_tol: float = POLYLINE_CIRCLE_RELATIVE_TOLERANCE,
    min_points: int = MIN_POLYLINE_CIRCLE_POINTS,
    area_ratio_min: float = POLYLINE_CIRCLE_AREA_RATIO_MIN,
) -> Optional[Tuple[float, float, float, float]]:
    """닫힌 폴리라인이 원에 가까우면 (중심, 반지름, 최대오차) 반환. 사각형 등은 면적비로 제외."""
    if np is None:
        return None
    if len(points) < min_points:
        return None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    try:
        cx, cy, radius = fit_circle(xs, ys)
    except (ValueError, np.linalg.LinAlgError):
        return None
    if radius <= 0:
        return None
    residuals = [
        abs(math.hypot(point[0] - cx, point[1] - cy) - radius) for point in points
    ]
    max_error = max(residuals) if residuals else 0.0
    # 절대 오차 이내이거나, 반지름 대비 상대 오차 이내면 통과
    if max_error > tol and (radius <= 0 or max_error / radius > relative_tol):
        return None
    # 사각형·다각형 제외: 폴리곤 면적이 적합원 면적의 비율 이상이어야 함 (직경만 쓰고 면적 필터 아님)
    circle_area = math.pi * radius * radius
    if circle_area <= 0:
        return None
    polygon_area = _polygon_area_shoelace(points)
    if polygon_area < area_ratio_min * circle_area:
        return None  # 네모/삼각형 등 각진 형태는 원으로 보지 않음
    return cx, cy, radius, max_error


def _lwpolyline_points_with_arcs(
    lwpoly: LWPolyline,
    current_transform: Transform2D,
    flatten_distance: float = 0.001,
) -> List[Tuple[float, float]]:
    """
    LWPOLYLINE에서 꼭짓점+호(bulge)를 반영한 경로를 평탄화해 (x,y) 리스트 반환.
    호 세그먼트가 있으면 path.flattening으로 샘플링하고, 없으면 get_points('xy')만 사용.
    반환 좌표는 current_transform이 적용된 월드 좌표.
    """
    out: List[Tuple[float, float]] = []
    if _HAS_PATH and _ezdxf_make_path is not None:
        try:
            path_obj = _ezdxf_make_path(lwpoly)
            for v in path_obj.flattening(flatten_distance, segments=8):
                wx, wy = current_transform.apply(float(v.x), float(v.y))
                out.append((wx, wy))
        except Exception:
            pass
    if len(out) < 2:
        out = []
        for x, y, *_ in lwpoly.get_points("xy"):
            wx, wy = current_transform.apply(x, y)
            out.append((wx, wy))
    return out


def extract_circle_like_polylines(
    dxf_path: str, tol: float = POLYLINE_CIRCLE_TOLERANCE, min_points: int = MIN_POLYLINE_CIRCLE_POINTS
) -> List[Dict[str, Union[str, Tuple[float, float], float]]]:
    """Return circle-like closed LWPOLYLINE entities from the provided DXF path."""
    if np is None:
        global _WARNED_NUMPY
        if not _WARNED_NUMPY:
            print("numpy is not available; skipping circle-like polyline detection.")
            _WARNED_NUMPY = True
        return []
    doc = ezdxf.readfile(dxf_path)
    modelspace = doc.modelspace()
    results: List[Dict[str, Union[str, Tuple[float, float], float]]] = []
    for polyline in modelspace.query("LWPOLYLINE"):
        if not isinstance(polyline, LWPolyline):
            continue
        if not polyline.closed:
            continue
        points = [(x, y) for x, y, *_ in polyline.get_points("xy")]
        circle_fit = _evaluate_polyline_circle(points, tol=tol, min_points=min_points)
        if not circle_fit:
            continue
        cx, cy, radius, max_error = circle_fit
        results.append(
            {
                "handle": polyline.dxf.handle,
                "center": (cx, cy),
                "radius": radius,
                "diameter": radius * 2.0,
                "max_error": max_error,
            }
        )
    return results


@dataclass(frozen=True)
class Transform2D:
    """Simple 2D affine transform helper (rotation + scale + translation)."""

    matrix: Sequence[Sequence[float]]

    @staticmethod
    def identity() -> "Transform2D":
        return Transform2D(((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)))

    def apply(self, x: float, y: float) -> tuple[float, float]:
        m = self.matrix
        world_x = m[0][0] * x + m[0][1] * y + m[0][2]
        world_y = m[1][0] * x + m[1][1] * y + m[1][2]
        return world_x, world_y

    def apply_vector(self, x: float, y: float) -> tuple[float, float]:
        m = self.matrix
        vx = m[0][0] * x + m[0][1] * y
        vy = m[1][0] * x + m[1][1] * y
        return vx, vy

    def scale_factor(self) -> float:
        vx = self.apply_vector(1.0, 0.0)
        vy = self.apply_vector(0.0, 1.0)
        sx = math.hypot(*vx)
        sy = math.hypot(*vy)
        if sx == 0.0 and sy == 0.0:
            return 1.0
        if sx == 0.0:
            return sy
        if sy == 0.0:
            return sx
        return (sx + sy) / 2.0

    def combine(self, other: "Transform2D") -> "Transform2D":
        return Transform2D(_matmul(self.matrix, other.matrix))


def _matmul(a: Sequence[Sequence[float]], b: Sequence[Sequence[float]]) -> tuple[
    tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]
]:
    result = [[0.0, 0.0, 0.0] for _ in range(3)]
    for i in range(3):
        for j in range(3):
            result[i][j] = (
                a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
            )
    return (
        (result[0][0], result[0][1], result[0][2]),
        (result[1][0], result[1][1], result[1][2]),
        (result[2][0], result[2][1], result[2][2]),
    )


def translation(dx: float, dy: float) -> Transform2D:
    return Transform2D(((1.0, 0.0, dx), (0.0, 1.0, dy), (0.0, 0.0, 1.0)))


def scale(sx: float, sy: float) -> Transform2D:
    return Transform2D(((sx, 0.0, 0.0), (0.0, sy, 0.0), (0.0, 0.0, 1.0)))


def rotation(angle_degrees: float) -> Transform2D:
    radians = math.radians(angle_degrees)
    cos_a = math.cos(radians)
    sin_a = math.sin(radians)
    return Transform2D(((cos_a, -sin_a, 0.0), (sin_a, cos_a, 0.0), (0.0, 0.0, 1.0)))


def build_insert_transform(
    insert: Insert,
    block_base: Vec3,
    row_index: int = 0,
    column_index: int = 0,
) -> Transform2D:
    base_point = block_base or Vec3(0.0, 0.0, 0.0)
    sx = insert.dxf.get("xscale", 1.0) or 1.0
    sy = insert.dxf.get("yscale", 1.0) or 1.0
    rotation_deg = insert.dxf.get("rotation", 0.0) or 0.0
    insert_point = Vec3(insert.dxf.insert)
    row_spacing = insert.dxf.get("row_spacing", 0.0) or 0.0
    column_spacing = insert.dxf.get("column_spacing", 0.0) or 0.0
    offset_local = Vec3(column_index * column_spacing, row_index * row_spacing, 0.0)
    scaled_offset = Vec3(offset_local.x * sx, offset_local.y * sy, 0.0)
    angle_rad = math.radians(rotation_deg)
    rotated_offset = Vec3(
        scaled_offset.x * math.cos(angle_rad) - scaled_offset.y * math.sin(angle_rad),
        scaled_offset.x * math.sin(angle_rad) + scaled_offset.y * math.cos(angle_rad),
        0.0,
    )
    insert_point += rotated_offset

    transform = translation(insert_point.x, insert_point.y)
    transform = transform.combine(rotation(rotation_deg))
    transform = transform.combine(scale(sx, sy))
    transform = transform.combine(translation(-base_point.x, -base_point.y))
    return transform


def _entity_bbox_center(entity: Union[Text, MText]) -> Optional[Vec3]:
    try:
        virtual = list(entity.virtual_entities())
        bbox = BoundingBox(virtual)
        if bbox.has_data:
            cx, cy, cz = bbox.center
            return Vec3(cx, cy, cz)
    except Exception:
        return None
    return None


def _fallback_center(
    entity: Union[Text, MText], base_height: float
) -> Vec3:
    width_factor = float(entity.dxf.get("width", 1.0) or 1.0)
    approx_width = max(base_height, len(entity.dxf.text or "") * base_height * CHAR_WIDTH_FACTOR * width_factor)
    offset_x = approx_width / 2.0
    offset_y = base_height / 2.0
    rotation_deg = float(entity.dxf.get("rotation", 0.0) or 0.0)
    angle_rad = math.radians(rotation_deg)
    rotated_offset_x = offset_x * math.cos(angle_rad) - offset_y * math.sin(angle_rad)
    rotated_offset_y = offset_x * math.sin(angle_rad) + offset_y * math.cos(angle_rad)
    insert = Vec3(entity.dxf.insert)
    return Vec3(insert.x + rotated_offset_x, insert.y + rotated_offset_y, insert.z)


def compute_world_text_center(
    entity: Union[Text, MText],
    base_height: float,
    transform: Transform2D,
) -> tuple[float, float]:
    local_center = _entity_bbox_center(entity)
    if local_center is None:
        local_center = _fallback_center(entity, base_height)
    return transform.apply(local_center.x, local_center.y)


def _world_text_baseline_deg(
    entity: Union[Text, MText],
    current_transform: Transform2D,
) -> float:
    """월드 좌표계에서 +X 기준 반시계 방향 각도(도) — INSERT 블록 회전과 로컬 회전을 합성."""
    try:
        dxftype = entity.dxftype()
        if dxftype == "MTEXT":
            td = getattr(entity.dxf, "text_direction", None)
            if td is not None:
                lx = float(td.x)
                ly = float(td.y)
                n = math.hypot(lx, ly)
                if n > 1e-9:
                    vx, vy = current_transform.apply_vector(lx / n, ly / n)
                    return math.degrees(math.atan2(vy, vx))
    except Exception:
        pass
    rot_local = float(entity.dxf.get("rotation", 0.0) or 0.0)
    lr = math.radians(rot_local)
    vx, vy = current_transform.apply_vector(math.cos(lr), math.sin(lr))
    return math.degrees(math.atan2(vy, vx))


def _mtext_plain_content(entity: MText) -> str:
    try:
        return (entity.plain_text() or "").strip()
    except Exception:
        return (getattr(entity, "text", None) or "").strip()


def parse_dxf_entities(
    file_path: str,
    text_height_min: float,
    text_height_max: float,
) -> tuple[List[Dict], List[Dict], List[Dict]]:
    doc = ezdxf.readfile(file_path)
    modelspace = doc.modelspace()
    transform_identity = Transform2D.identity()

    circles: List[Dict] = []
    texts: List[Dict] = []
    polylines: List[Dict] = []
    line_segments: List[LineSegmentRecord] = []
    circle_seq = 1
    text_seq = 1
    poly_seq = 1

    def walk_layout(
        layout: BaseLayout,
        current_transform: Transform2D,
        active_block_name: Optional[str] = None,
        block_stack: Tuple[str, ...] = (),
    ) -> None:
        nonlocal circle_seq, text_seq, poly_seq
        for entity in layout:
            dxftype = entity.dxftype()
            if dxftype == "CIRCLE":
                circle = entity  # type: Circle
                radius = float(circle.dxf.radius or 0.0)
                if radius <= 0.0:
                    continue
                scale_factor = current_transform.scale_factor()
                world_radius = radius * scale_factor
                if world_radius <= 0.0:
                    continue
                diameter = world_radius * 2.0
                center = Vec3(circle.dxf.center)
                world_x, world_y = current_transform.apply(center.x, center.y)
                circles.append(
                    {
                        "id": f"C{circle_seq}",
                        "type": "CIRCLE",
                        "center_x": world_x,
                        "center_y": world_y,
                        "center_z": center.z,
                        "radius": world_radius,
                        "diameter": diameter,
                        "area": math.pi * world_radius * world_radius,
                        "layer": circle.dxf.layer or "0",
                        "block_name": active_block_name,
                        "transformed": current_transform != transform_identity,
                    }
                )
                circle_seq += 1
            elif dxftype in ("TEXT", "MTEXT"):
                if dxftype == "TEXT":
                    text_entity: Union[Text, MText] = entity  # type: ignore
                    base_height = float(text_entity.dxf.height or 0.0)
                    raw_content = (text_entity.dxf.text or "").strip()
                else:
                    text_entity = entity  # type: ignore
                    base_height = float(text_entity.dxf.char_height or 0.0)
                    raw_content = _mtext_plain_content(text_entity)
                if base_height <= 0.0:
                    continue
                insert = Vec3(text_entity.dxf.insert)
                world_insert_x, world_insert_y = current_transform.apply(
                    insert.x, insert.y
                )
                world_height = base_height * current_transform.scale_factor()
                label = pile_label_for_collection(raw_content)
                if not label:
                    continue
                pf_only = foundation_pf_only_flag(raw_content)
                height_ok = text_height_min <= world_height <= text_height_max
                if not height_ok and not pf_only:
                    continue
                world_center_x, world_center_y = compute_world_text_center(
                    text_entity, base_height, current_transform
                )
                row: Dict[str, Any] = {
                    "id": f"T{text_seq}",
                    "type": dxftype,
                    "text": label,
                    "insert_x": world_insert_x,
                    "insert_y": world_insert_y,
                    "insert_z": insert.z,
                    "text_center_x": world_center_x,
                    "text_center_y": world_center_y,
                    "center_x": world_center_x,
                    "center_y": world_center_y,
                    "height": world_height,
                    "rotation_deg": _world_text_baseline_deg(text_entity, current_transform),
                    "layer": text_entity.dxf.layer or "0",
                    "block_name": active_block_name,
                }
                if pf_only:
                    row["foundation_pf_only"] = True
                texts.append(row)
                text_seq += 1
            elif dxftype in ("LWPOLYLINE", "POLYLINE"):
                points: List[Dict[str, float]] = []
                if dxftype == "LWPOLYLINE":
                    lwpoly = entity  # type: LWPolyline
                    if not lwpoly.closed:
                        continue
                    # 호(bulge) 세그먼트가 있으면 경로 평탄화로 원형 인식 가능하게 함
                    xy_tuples = _lwpolyline_points_with_arcs(lwpoly, current_transform)
                    points = [{"x": x, "y": y} for x, y in xy_tuples]
                    layer = lwpoly.dxf.layer or "0"
                else:
                    poly = entity  # type: Polyline
                    if not poly.is_closed:
                        continue
                    for vertex in poly.vertices:
                        location = vertex.dxf.location
                        wx, wy = current_transform.apply(location.x, location.y)
                        points.append({"x": wx, "y": wy})
                    layer = poly.dxf.layer or "0"
                if len(points) >= 3:
                    polylines.append(
                        {
                            "id": f"poly_{poly_seq}",
                            "closed": True,
                            "points": points,
                            "layer": layer,
                        }
                    )
                    poly_seq += 1
                circle_guess = _evaluate_polyline_circle(
                    [(point["x"], point["y"]) for point in points],
                    tol=POLYLINE_CIRCLE_TOLERANCE,
                    min_points=MIN_POLYLINE_CIRCLE_POINTS,
                )
                if circle_guess:
                    cx, cy, radius, max_error = circle_guess
                    circles.append(
                        {
                            "id": f"C{circle_seq}",
                            "type": "CIRCLE",
                            "center_x": cx,
                            "center_y": cy,
                            "center_z": 0.0,
                            "radius": radius,
                            "diameter": radius * 2.0,
                            "area": math.pi * radius * radius,
                            "layer": layer,
                            "block_name": active_block_name,
                            "transformed": True,
                            "source": "POLYLINE",
                            "max_fit_error": max_error,
                        }
                    )
                    circle_seq += 1
            elif dxftype == "LINE":
                line = entity  # type: Line
                start = Vec3(line.dxf.start)
                end = Vec3(line.dxf.end)
                sx, sy = current_transform.apply(start.x, start.y)
                ex, ey = current_transform.apply(end.x, end.y)
                if math.hypot(ex - sx, ey - sy) <= LINE_JOIN_TOLERANCE:
                    continue
                line_segments.append(
                    LineSegmentRecord(
                        start=(sx, sy),
                        end=(ex, ey),
                        layer=line.dxf.layer or "0",
                        block_name=active_block_name,
                    )
                )
            elif dxftype == "INSERT":
                insert = entity  # type: Insert
                block_name = insert.dxf.name
                try:
                    block_layout = doc.blocks.get(block_name)
                except ezdxf.DXFKeyError:
                    continue
                if block_name in block_stack:
                    continue
                block_base = Vec3(block_layout.block.dxf.base_point)
                row_count = max(int(insert.dxf.get("row_count", 1) or 1), 1)
                column_count = max(int(insert.dxf.get("column_count", 1) or 1), 1)
                for row_index in range(row_count):
                    for column_index in range(column_count):
                        insert_transform = build_insert_transform(
                            insert,
                            block_base,
                            row_index=row_index,
                            column_index=column_index,
                        )
                        combined_transform = current_transform.combine(insert_transform)
                        walk_layout(
                            block_layout,
                            combined_transform,
                            active_block_name=block_name,
                            block_stack=block_stack + (block_name,),
                        )

    walk_layout(modelspace, transform_identity, None, ())
    joined_polylines = _join_lines_to_closed_polylines(line_segments)
    for joined in joined_polylines:
        points = joined.get("points") or []
        if len(points) < 3:
            continue
        polylines.append(
            {
                "id": f"poly_{poly_seq}",
                "closed": True,
                "points": points,
                "layer": joined.get("layer") or "0",
                "source": "LINE_JOIN",
            }
        )
        poly_seq += 1

        circle_guess = _evaluate_polyline_circle(
            [(point["x"], point["y"]) for point in points],
            tol=POLYLINE_CIRCLE_TOLERANCE,
            min_points=MIN_POLYLINE_CIRCLE_POINTS,
        )
        if circle_guess:
            cx, cy, radius, max_error = circle_guess
            circles.append(
                {
                    "id": f"C{circle_seq}",
                    "type": "CIRCLE",
                    "center_x": cx,
                    "center_y": cy,
                    "center_z": 0.0,
                    "radius": radius,
                    "diameter": radius * 2.0,
                    "area": math.pi * radius * radius,
                    "layer": joined.get("layer") or "0",
                    "block_name": joined.get("block_name"),
                    "transformed": True,
                    "source": "LINE_JOIN",
                    "max_fit_error": max_error,
                }
            )
            circle_seq += 1

    return circles, texts, polylines


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python dxf_parser.py <path-to-dxf>")
        sys.exit(0)

    target_path = sys.argv[1]
    print(f"Detecting circle-like polylines in {target_path} ...")
    for result in extract_circle_like_polylines(target_path):
        handle = result["handle"]
        center = result["center"]
        radius = result["radius"]
        diameter = result["diameter"]
        max_error = result["max_error"]
        print(
            f"handle={handle} center=({center[0]:.3f}, {center[1]:.3f}) "
            f"radius={radius:.3f} diameter={diameter:.3f} max_error={max_error:.6f}"
        )
