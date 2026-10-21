"""Stateless, guarded outline expansion for a manually added pile."""
from math import atan2, cos, isfinite, pi, sin

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points
from shapely.validation import make_valid

from .models import BuildingDefinition, BuildingVertex

router = APIRouter()


class ExistingPoint(BaseModel):
    id: str
    x: float
    y: float


class OutlineRequest(BaseModel):
    buildings: list[BuildingDefinition]
    target_index: int = Field(ge=0)
    point: BuildingVertex
    radius: float = Field(gt=0, allow_inf_nan=False)
    existing_points: list[ExistingPoint]


def _local_expansions(original: Polygon, point: Point, radius: float):
    """Keep the round local footprint, approximated by a few outer tangents.

    Only the new pile and a narrow connector are added; existing edges are
    never bridged across their full length just to reduce vertex count.
    """
    anchor = nearest_points(original, point)[0]
    angle = atan2(point.y - anchor.y, point.x - anchor.x)
    if anchor.distance(point) > 0:
        connector = LineString([anchor.coords[0], point.coords[0]]).buffer(
            radius * 0.2, cap_style=3, join_style=2)
    else:
        connector = point.buffer(radius * 0.2, resolution=1)
    for sides in (8, 12, 16):
        # Circumscription retains the entire circular footprint; an inscribed
        # polygon or ordinary simplify() could cut into the pile.
        outer_radius = radius * 1.1 / cos(pi / sides)
        enclosure = Polygon([
            (point.x + outer_radius * cos(angle + (2 * i + 1) * pi / sides),
             point.y + outer_radius * sin(angle + (2 * i + 1) * pi / sides))
            for i in range(sides)
        ])
        yield original.union(connector).union(enclosure)


def prepare_outline(payload: OutlineRequest) -> dict:
    if payload.target_index >= len(payload.buildings):
        raise ValueError("선택한 동이 없습니다. 동 목록을 다시 확인하세요.")
    target = payload.buildings[payload.target_index]
    if target.kind != "building" or len(target.vertices) < 3:
        raise ValueError("선택한 동의 윤곽선을 먼저 만들어 주세요.")
    values = [payload.point.x, payload.point.y]
    values += [value for building in payload.buildings for v in building.vertices for value in (v.x, v.y)]
    values += [value for p in payload.existing_points for value in (p.x, p.y)]
    if not all(isfinite(value) for value in values):
        raise ValueError("좌표에 유효하지 않은 값이 있습니다.")
    source = Polygon([(v.x, v.y) for v in target.vertices])
    original = source
    repaired = False
    if not original.is_valid:
        # CAD outlines can contain microscopic crossing slivers. Never discard
        # a meaningful component or choose one side of a genuine bow-tie.
        valid = make_valid(source)
        candidate = source.buffer(0)
        tolerance = max(1e-10, abs(source.area) * 1e-10)
        if (candidate.geom_type == "Polygon" and candidate.is_valid
                and not candidate.interiors
                and valid.symmetric_difference(candidate).area <= tolerance):
            original = candidate
            repaired = True
    if not original.is_valid or original.area <= 0:
        raise ValueError("기존 동 윤곽선이 교차하거나 올바르지 않습니다. 윤곽선을 먼저 확인하세요.")
    point = Point(payload.point.x, payload.point.y)
    # The circumscribed buffer contains the entire pile, not only its center.
    footprint = point.buffer(payload.radius * 1.1, resolution=8)
    expanded = not original.covers(footprint)
    result = original
    if expanded:
        protected = [(Point(p.x, p.y), source.covers(Point(p.x, p.y)))
                     for p in payload.existing_points]
        candidates = []
        for candidate in _local_expansions(original, point, payload.radius):
            if candidate.geom_type != "Polygon" or not candidate.is_valid or candidate.interiors:
                continue
            # Allow only numerical slivers at civil-coordinate magnitudes.
            if original.difference(candidate).area > 1e-8 or footprint.difference(candidate).area > 1e-8:
                continue
            if any(candidate.covers(p) != included for p, included in protected):
                continue
            candidates.append(candidate)
        if not candidates:
            raise ValueError("기존 좌표·번호의 포함 여부를 유지하며 단순한 윤곽을 만들 수 없어 추가하지 않았습니다. 동 윤곽선을 확인하세요.")
        result = min(candidates, key=lambda p: (len(p.exterior.coords), p.area))
    affected = [p.id for p in payload.existing_points
                if source.covers(Point(p.x, p.y)) != result.covers(Point(p.x, p.y))]
    if affected:
        raise ValueError(f"윤곽 조정 시 기존 좌표·번호 {len(affected)}개의 포함 여부가 달라집니다. 다른 파일에 영향을 주므로 추가하지 않았습니다.")
    # Match the existing backend precedence, including original order for ties.
    priorities = {"tower_crane": 0, "building": 1, "parking": 2}
    for index in sorted(range(len(payload.buildings)), key=lambda i: (priorities[payload.buildings[i].kind], i)):
        area = payload.buildings[index]
        if len(area.vertices) < 3:
            continue
        polygon = result if index == payload.target_index else Polygon([(v.x, v.y) for v in area.vertices])
        if not polygon.is_valid:
            raise ValueError("겹침을 검토할 다른 구역 윤곽선이 올바르지 않습니다.")
        if polygon.covers(point):
            if index != payload.target_index:
                raise ValueError(f"해당 위치는 {area.name} 구역에 우선 배정됩니다. 동을 다시 선택하거나 윤곽을 확인하세요.")
            break
    return {"vertices": [{"x": x, "y": y} for x, y in list(result.exterior.coords)[:-1]], "expanded": expanded, "repaired": repaired}


@router.post("/api/manual-pile/outline")
def preview_manual_pile_outline(payload: OutlineRequest):
    try:
        return prepare_outline(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
