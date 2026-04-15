from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MatchedText(BaseModel):
    """Information about a TEXT entity matched to a circle."""

    id: str
    text: str
    insert_x: float
    insert_y: float
    insert_z: float
    center_x: float
    center_y: float
    text_center_x: float
    text_center_y: float
    height: float
    distance: float


class CircleRecord(BaseModel):
    """Normalized information about a CIRCLE entity in world coordinates."""

    id: str = Field(..., description="Identifier for the record")
    type: Literal["CIRCLE"] = Field("CIRCLE", description="Entity type")
    center_x: float = Field(..., description="X coordinate in world space")
    center_y: float = Field(..., description="Y coordinate in world space")
    center_z: float = Field(..., description="Z coordinate (if available)")
    radius: float = Field(..., description="Circle radius in drawing units")
    diameter: float = Field(..., description="Circle diameter in drawing units")
    area: float = Field(..., description="Circle area (pi * r짼) in drawing units짼")
    layer: str = Field(..., description="Layer name where the entity lives")
    block_name: Optional[str] = Field(
        None, description="Block name when originating from an INSERT"
    )
    transformed: bool = Field(True, description="Indicates world transform applied")
    matched_text: Optional[MatchedText] = Field(
        default=None, description="Closest numeric TEXT information"
    )
    matched_text_id: Optional[str] = Field(
        default=None, description="Matched TEXT id for quick filtering"
    )
    matched_text_distance: Optional[float] = Field(
        default=None, description="Distance to matched TEXT"
    )
    has_error: bool = Field(False)
    error_codes: List[str] = Field(default_factory=list)
    building_name: Optional[str] = None
    building_seq: Optional[int] = None
    manual_match: Optional[bool] = Field(None, description="?섎룞 留ㅼ묶 ?щ? (???遺덈윭?ㅺ린 ??蹂듭썝??")


class TextRecord(BaseModel):
    """Normalized TEXT entity (numeric-only)."""

    id: str
    type: Literal["TEXT", "MTEXT"]
    text: str
    insert_x: float
    insert_y: float
    insert_z: float
    center_x: float
    center_y: float
    text_center_x: float
    text_center_y: float
    height: float
    rotation_deg: float = Field(
        0.0,
        description="월드 +X 기준 기준선 방향(도), 반시계 — 뷰어 P/F 원본 각도",
    )
    layer: str
    block_name: Optional[str] = None
    matched_circle_ids: List[str] = Field(default_factory=list)
    has_error: bool = Field(False)
    building_name: Optional[str] = None
    foundation_pf_only: bool = Field(
        False,
        description="기초 P/F 표기 — 말뚝 자동매칭 제외, 뷰어 표시용",
    )


class SummaryStats(BaseModel):
    """Aggregate statistics about the filtered result set."""

    total_circles: int
    total_texts: int
    matched_pairs: int
    duplicate_groups: int


class DuplicateDetail(BaseModel):
    """Detailed information per circle inside a duplicate group."""

    id: str
    type: Literal["CIRCLE"] = "CIRCLE"
    layer: str
    block_name: Optional[str] = None
    matched_text: Optional[MatchedText] = None
    has_error: bool = False
    building_name: Optional[str] = None


class CoordinateKey(BaseModel):
    x: float
    y: float


class DuplicateGroup(BaseModel):
    """Grouping of identical coordinates."""

    coord_key: CoordinateKey
    count: int
    circle_ids: List[str]
    details: List[DuplicateDetail]


class FilterSettings(BaseModel):
    """Filter values applied when generating the response."""

    min_diameter: float
    max_diameter: float
    min_area: Optional[float] = None
    max_area: Optional[float] = None
    text_height_min: float
    text_height_max: float
    max_match_distance: float
    text_reference_point: Literal["center", "insert"] = "center"


class BuildingVertex(BaseModel):
    x: float
    y: float


class BuildingDefinition(BaseModel):
    name: str
    kind: Literal["building", "parking", "tower_crane"] = "building"
    slot: Optional[int] = None
    vertices: List[BuildingVertex]
    drilling_start_elevation: Optional[float] = Field(
        default=None,
        description="동·지하주차장 천공시작 레벨(m). 저장 작업 JSON·재수화 시 유지.",
    )
    foundation_top_elevation: Optional[float] = Field(
        default=None,
        description="기초골조 상단레벨(m). 기성 정리표 기본값·저장 작업 JSON에 반영.",
    )


class PolylineRecord(BaseModel):
    id: str
    closed: bool
    points: List[BuildingVertex]
    layer: Optional[str] = None
    cluster_id: Optional[str] = None
    cluster_type: Optional[Literal["building", "parking"]] = None


class PileClusterPoint(BaseModel):
    id: str
    x: float
    y: float
    label: Optional[str] = None
    number: Optional[int] = None


class PileClusterMetrics(BaseModel):
    count_points: int
    min_num: Optional[int]
    max_num: Optional[int]
    range_size: Optional[int]
    missing_count: Optional[int]
    missing_ratio: float
    density: float
    bbox_area: float
    width: float
    height: float


class PileClusterModel(BaseModel):
    id: str
    type: Literal["building", "parking"]
    points: List[PileClusterPoint]
    centroid_x: float
    centroid_y: float
    hull: List[BuildingVertex]
    metrics: PileClusterMetrics
    score: float


class BuildingSummary(BaseModel):
    name: str
    circle_count: int
    text_count: int
    error_count: int


class MatchError(BaseModel):
    """Represents invalid or missing matches."""

    error_type: Literal[
        "TEXT_MULTI_MATCH",
        "TEXT_NO_MATCH",
        "CIRCLE_MULTI_MATCH",
        "CIRCLE_NO_MATCH",
        "MATCH_DISTANCE_EXCEEDED",
        "SAME_BUILDING_NUMBER_DUPLICATE",
    ]
    text_id: Optional[str] = None
    text_value: Optional[str] = None
    circle_ids: List[str] = Field(default_factory=list)
    message: str


class MatchCorrection(BaseModel):
    match_source: Literal["manual_history"]
    circle_id: str
    circle_center_x: float
    circle_center_y: float
    matched_text_id: str
    matched_text_value: str
    building_name: Optional[str] = None
    history_work_id: Optional[str] = None
    history_work_title: Optional[str] = None
    history_project: Optional[str] = None
    history_source_type: Optional[str] = None


class CircleResponse(BaseModel):
    """Payload returned by DXF processing endpoints."""

    summary: SummaryStats
    circles: List[CircleRecord]
    texts: List[TextRecord]
    duplicates: List[DuplicateGroup]
    polylines: List[PolylineRecord] = Field(default_factory=list)
    buildings: List[BuildingDefinition] = Field(default_factory=list)
    pile_clusters: List[PileClusterModel] = Field(default_factory=list)
    cluster_polylines: List[PolylineRecord] = Field(default_factory=list)
    errors: List[MatchError]
    filter: FilterSettings
    building_summary: List[BuildingSummary] = Field(default_factory=list)
    match_corrections: List[MatchCorrection] = Field(default_factory=list)


class BuildingApplyRequest(BaseModel):
    """???뺣낫 ?곸슜. buildings ?꾩닔. circles/texts/polylines ?덉쑝硫??대떦 ?곗씠??湲곗??쇰줈 ?곸슜(?ㅼ쨷 ?ъ슜?????꾩뿭 ?곹깭 ?ㅼ뿼 諛⑹?)."""

    buildings: List[BuildingDefinition]
    circles: Optional[List[Dict[str, Any]]] = None
    texts: Optional[List[Dict[str, Any]]] = None
    polylines: Optional[List[Dict[str, Any]]] = None
    manual_overrides: Optional[Dict[str, str]] = Field(
        None,
        description="?섎룞 留ㅼ묶 留?circle_id?뭪ext_id). ???곸슜 ???쒕쾭 ?꾩뿭 留ㅼ묶怨??숆린?? ?놁쑝硫?湲곗〈 ?숈옉(?쒕쾭 硫붾え由?留??좎?).",
    )


class ManualMatchRequest(BaseModel):
    circle_id: str
    text_id: str
    """?대씪?댁뼵???꾩옱 ?꾪꽣(?좏깮). ?덉쑝硫????붿껌???묐떟???숈씪 ?꾪꽣 ?곸슜."""
    filter: Optional[FilterSettings] = None


class ManualHistoryMatchRefreshRequest(BaseModel):
    """DXF 업로드 없이 수동 매칭 히스토리 재적용/해제(현재 필터·원시 데이터 기준)."""

    project_context: Optional[str] = Field(
        None, description="프로젝트명(히스토리 파일 키). 비우면 기본 프로젝트."
    )
    source_type: Optional[str] = Field(
        None,
        description="현재 작업 구분(시공사 원본/업체 작성). 참고 구분이 비어 있을 때 히스토리 버킷으로 사용.",
    )
    reuse_manual_history: bool = Field(True, description="끄면 히스토리 재적용 없이 자동 매칭만.")
    history_reference_work_id: Optional[str] = Field(
        None,
        description="저장 작업 ID(work_…). 지정 시 해당 저장 버전에 남긴 수동 매칭만 재사용.",
    )
    history_reference_source_type: Optional[str] = Field(
        None,
        description="(레거시) 참고 히스토리 구분. history_reference_work_id가 있으면 무시.",
    )
    circles: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="불러온 작업 등 서버에 DXF가 없을 때 원시 circle 목록(필터 전 스냅샷 권장).",
    )
    texts: Optional[List[Dict[str, Any]]] = None
    buildings: Optional[List[BuildingDefinition]] = None
    polylines: Optional[List[Dict[str, Any]]] = None
    manual_overrides: Optional[Dict[str, str]] = Field(
        None,
        description="세션 수동 매칭 맵. 없으면 circles의 manual_match에서 채움.",
    )
    filter: Optional[FilterSettings] = None
    expected_buildings: Optional[int] = None
    max_distance_from_seed: Optional[float] = None
    merge_seed_distance: Optional[float] = None


class RecomputeRequest(BaseModel):
    """遺덈윭??circles濡??대윭?ㅽ꽣/???ㅺ낸???ш퀎?????ъ슜."""

    circles: List[Dict[str, Any]]
    texts: Optional[List[Dict[str, Any]]] = None
    expected_buildings: int = 1
    max_distance_from_seed: Optional[float] = None
    merge_seed_distance: Optional[float] = None


class ExportFromClientBody(BaseModel):
    """XLSX/CSV ?ㅼ슫濡쒕뱶 ?????ㅺ낸???곸슜???꾩옱 ?붾㈃ ?곗씠??circles/texts/errors/buildings)濡??대낫?닿린."""

    circles: List[Dict[str, Any]] = Field(default_factory=list)
    texts: Optional[List[Dict[str, Any]]] = None
    errors: Optional[List[Dict[str, Any]]] = None
    buildings: Optional[List[Dict[str, Any]]] = None


class ApplyFilterRequest(BaseModel):
    """遺덈윭??circles/texts???꾪꽣 ?곸슜 ??留ㅼ묶쨌?대윭?ㅽ꽣 ?ш퀎?????ъ슜 (遺덈윭?ㅺ린 ???꾪꽣 ?곸슜)."""

    circles: List[Dict[str, Any]]
    texts: Optional[List[Dict[str, Any]]] = None
    min_diameter: Optional[float] = None
    max_diameter: Optional[float] = None
    min_area: Optional[float] = None
    max_area: Optional[float] = None
    text_height_min: Optional[float] = None
    text_height_max: Optional[float] = None
    max_match_distance: Optional[float] = None
    text_reference_point: Optional[Literal["center", "insert"]] = None
    expected_buildings: int = 1
    max_distance_from_seed: Optional[float] = None
    merge_seed_distance: Optional[float] = None
    buildings: Optional[List[BuildingDefinition]] = None
    manual_overrides: Optional[Dict[str, str]] = Field(
        None, description="?섎룞 留ㅼ묶 留?(circle_id -> text_id). 遺덈윭?ㅺ린 ???꾪꽣 ?곸슜 ??蹂듭썝??"
    )


class ConstructionSyncRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(..., alias="userId")
    password: str
    report_page_url: Optional[str] = Field(None, alias="reportPageUrl")
    report_id: Optional[int] = Field(None, alias="reportId")
    source_url: Optional[str] = Field("https://we8104.com/", alias="sourceUrl")
    dataset_name: Optional[str] = Field(None, alias="datasetName")
    project_context: Optional[str] = Field(None, alias="projectContext")


class ConstructionDashboardRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: str = Field(..., alias="datasetId")
    circles: Optional[List[Dict[str, Any]]] = None
    work_id: Optional[str] = Field(None, alias="workId")
    date_from: Optional[str] = Field(None, alias="dateFrom")
    date_to: Optional[str] = Field(None, alias="dateTo")
    month: Optional[str] = None
    equipment: Optional[str] = None
    method: Optional[str] = None
    location: Optional[str] = None
    equipments: List[str] = Field(default_factory=list)
    methods: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    remaining_threshold: Optional[float] = Field(None, alias="remainingThreshold")
    settlement_month: Optional[str] = Field(None, alias="settlementMonth")
    settlement_start_day: Optional[int] = Field(25, alias="settlementStartDay")
    settlement_end_day: Optional[int] = Field(20, alias="settlementEndDay")
    exclude_identical_geometry_duplicates: bool = Field(
        False,
        alias="excludeIdenticalGeometryDuplicates",
        description="캔버스 「동일 좌표·크기 원 중복 제외」와 동일하게 느슨 기하로 원 병합 후 PDAM 매칭",
    )


class MeissaLoginRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: Optional[str] = Field(None, description="Meissa 로그인 이메일")
    password: Optional[str] = Field(None, description="Meissa 비밀번호 (서버에 저장되지 않음)")
    service: str = Field("cloud", description="호환용(클라우드 로그인은 cloud 고정)")
    verification_code: Optional[str] = Field(None, alias="verificationCode", description="2단계 인증 OTP")

    @model_validator(mode="after")
    def _meissa_login_pair(self) -> "MeissaLoginRequest":
        otp = (self.verification_code or "").strip()
        if otp:
            otp = re.sub(r"\s+", "", otp)
            if re.fullmatch(r"\d{6,12}", otp):
                self.verification_code = otp
            else:
                # OTP 입력란이 숨겨진 상태에서 브라우저 자동완성 문자열이 들어온 경우는 2FA 시도로 보지 않는다.
                otp = ""
                self.verification_code = None
        em = (self.email or "").strip()
        pw = self.password if self.password is not None else ""
        if otp:
            if not em or not pw:
                raise ValueError("2단계 인증 시에도 이메일·비밀번호를 함께 보내야 합니다.")
            return self
        if not em or not pw:
            raise ValueError("이메일과 비밀번호를 입력하세요.")
        return self
