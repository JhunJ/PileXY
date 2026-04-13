from __future__ import annotations

import io

import pandas as pd

from backend import construction_reports


def test_normalize_pile_number_pdam_dot_before_dash_and_double_dash():
    assert construction_reports._normalize_pile_number("2.-40") == "40"
    assert construction_reports._normalize_pile_number("4.-12") == "12"
    assert construction_reports._normalize_pile_number("B2--85") == "B2-85"
    assert construction_reports._normalize_pile_number("b2--85") == "B2-85"


def test_two_row_header_pair_hfill_avoids_pile_across_dash_gap():
    """2행 헤더에서 '-' 구간까지 '파일번호'가 가로로 밀려 가짜 열이 생기지 않아야 함."""
    df = pd.DataFrame(
        [
            ["시공일", "파일번호", None, "시공장비"],
            ["미지정", None, "-", None],
        ]
    )
    flat = construction_reports._flatten_header_rows(df, 0, 2)
    assert flat == ["시공일 미지정", "파일번호", "-", "시공장비"]
    assert not any("파일번호 -" in h for h in flat)


def test_header_mapping_rejects_merged_date_location_header():
    assert construction_reports._reject_bad_pdam_header_mapping(
        {"construction_date": "시공일 미지정", "pile_number": "파일번호"}
    )
    assert not construction_reports._reject_bad_pdam_header_mapping(
        {"construction_date": "시공일", "pile_number": "파일번호"}
    )


def test_sequence_no_does_not_alias_pile_number_column():
    headers = ["미지정", "파일번호", "-", "시공장비"]
    resolved = construction_reports._resolve_field_mapping(headers)
    assert resolved.get("pile_number") == "파일번호"
    assert resolved.get("sequence_no") is None


def _sample_workbook_bytes() -> bytes:
    rows = [
        ["번호", "시공일", "시공장비", "파일종류", "시공공법", "시공위치", "파일번호", "파일구분", "", "천공깊이(M)", "관입깊이(M)", "파일잔량(M)", "공삭공(M)"],
        ["", "", "", "", "", "", "", "단본", "합계", "", "", "", ""],
        [1, "2025-09-19", "1호기", "PHC", "T4", "3545동", 136, 5, 5, 3.7, 4.2, 0.8, 0],
        [2, "2025-09-20", "2호기", "SC", "T5", "3546동", 44, 6, 6, 5.0, 5.0, 1.0, 0],
    ]
    dataframe = pd.DataFrame(rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, sheet_name="기록지", header=False, index=False)
    return buffer.getvalue()


def test_parse_construction_workbook_skips_rows_that_echo_column_headers():
    """비항타 등 다른 표에서 열 이름(파일번호·시공장비)이 데이터로 밀려 들어온 행은 제외."""
    rows = [
        ["번호", "시공일", "시공장비", "파일종류", "시공공법", "시공위치", "파일번호", "파일구분", "", "천공깊이(M)", "관입깊이(M)", "파일잔량(M)", "공삭공(M)"],
        ["", "", "", "", "", "", "", "단본", "합계", "", "", "", ""],
        ["", "", "시공장비", "", "", "미지정", "파일번호", "", "", "", "", "", ""],
        [1, "2025-09-19", "1호기", "PHC", "T4", "3545동", 136, 5, 5, 3.7, 4.2, 0.8, 0],
        [2, "2025-09-20", "2호기", "SC", "T5", "3546동", 44, 6, 6, 5.0, 5.0, 1.0, 0],
    ]
    dataframe = pd.DataFrame(rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, sheet_name="기록지", header=False, index=False)
    parsed = construction_reports.parse_construction_workbook(buffer.getvalue(), filename="echo.xlsx")
    assert parsed["summary"]["recordCount"] == 2


def test_parse_construction_workbook_extracts_rows():
    parsed = construction_reports.parse_construction_workbook(
        _sample_workbook_bytes(),
        filename="sample.xlsx",
    )

    assert parsed["summary"]["recordCount"] == 2
    assert parsed["summary"]["sheetCount"] == 1
    assert parsed["summary"]["uniquePileCount"] == 2

    first = parsed["records"][0]
    assert first["construction_date"] == "2025-09-19"
    assert first["equipment"] == "1호기"
    assert first["pile_type"] == "PHC"
    assert first["construction_method"] == "T4"
    assert first["location"] == "3545동"
    assert first["pile_number"] == "136"
    assert first["pile_classification_single"] == 5.0
    assert first["pile_classification_total"] == 5.0
    assert first["penetration_depth"] == 4.2
    assert first["pile_remaining"] == 0.8


def test_import_and_dashboard_match_circles(tmp_path, monkeypatch):
    construction_root = tmp_path / "construction"
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_DIR", str(construction_root))
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_WORKBOOK_DIR", str(construction_root / "workbooks"))
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_DB_PATH", str(construction_root / "construction.sqlite3"))

    imported = construction_reports.import_workbook_bytes(
        _sample_workbook_bytes(),
        filename="sample.xlsx",
        source_type="manual-upload",
    )

    dashboard = construction_reports.build_dashboard(
        imported["dataset"]["id"],
        circles=[
            {
                "id": "C1",
                "building_name": "3545동",
                "matched_text": {"text": "136"},
            },
            {
                "id": "C2",
                "building_name": "3545동",
                "matched_text": {"text": "999"},
            },
        ],
        remaining_threshold=0.9,
    )

    assert dashboard["summary"]["recordCount"] == 2
    assert dashboard["summary"]["uniquePileCount"] == 2
    assert dashboard["summary"]["matchedCircleCount"] == 1
    assert dashboard["summary"]["pendingCircleCount"] == 1
    assert dashboard["summary"]["overThresholdCount"] == 1
    assert dashboard["records"][0]["pile_number"] in {"44", "136"}


def test_delete_dataset_removes_records_and_workbook(tmp_path, monkeypatch):
    construction_root = tmp_path / "construction"
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_DIR", str(construction_root))
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_WORKBOOK_DIR", str(construction_root / "workbooks"))
    monkeypatch.setattr(construction_reports, "CONSTRUCTION_DB_PATH", str(construction_root / "construction.sqlite3"))

    imported = construction_reports.import_workbook_bytes(
        _sample_workbook_bytes(),
        filename="sample.xlsx",
        source_type="manual-upload",
    )
    workbook_files_before = list((construction_root / "workbooks").glob("*"))
    assert len(workbook_files_before) == 1
    assert construction_reports.list_datasets()

    deleted = construction_reports.delete_dataset(imported["dataset"]["id"])

    assert deleted["status"] == "deleted"
    assert deleted["dataset"]["id"] == imported["dataset"]["id"]
    assert construction_reports.list_datasets() == []
    assert list((construction_root / "workbooks").glob("*")) == []


def test_map_records_to_circles_normalizes_location_variants():
    records = [
        {
            "location": "207동",
            "pile_number": "11",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "정T4",
            "pile_remaining": 0.5,
            "penetration_depth": 6.2,
            "boring_depth": 6.2,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "B3-주차장",
            "pile_number": "12",
            "construction_date": "2025-09-19",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.7,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C1", "building_name": "207", "matched_text": {"text": "11"}},
            {"id": "C2", "building_name": "207 동", "matched_text": {"text": "11"}},
            {"id": "C3", "building_name": "B3주차장", "matched_text": {"text": "12"}},
        ],
    )

    assert mapping["matchedCircleCount"] == 3
    assert mapping["pendingCircleCount"] == 0
    assert mapping["circleMappings"][0]["locationNormalized"] == construction_reports._normalize_location("207동")
    assert mapping["circleMappings"][2]["locationNormalized"] == construction_reports._normalize_location("B3")


def test_latest_records_by_pile_merges_pdam_parking_synonyms_when_unified_outline():
    """PDAM에 같은 말뚝이 '주차장' / 'B2주차장'처럼만 다르게 적혀도 pile당 1행으로 묶인다."""
    records = [
        {
            "location": "주차장",
            "pile_number": "100",
            "construction_date": "2025-09-01",
            "row_number": 1,
        },
        {
            "location": "B2주차장",
            "pile_number": "100",
            "construction_date": "2025-09-10",
            "row_number": 2,
        },
    ]
    merged = construction_reports._latest_records_by_pile(records, parking_unified_location="B2")
    assert len(merged) == 1
    assert merged[0]["construction_date"] == "2025-09-10"

    split = construction_reports._latest_records_by_pile(records, parking_unified_location=None)
    assert len(split) == 2


def test_map_records_parking_circle_matches_when_pdam_unified_to_basement():
    """단일 주차장 윤곽으로 PDAM 주차장 기록이 Bn으로 묶일 때, 원이 '주차장'만 있어도 파일번호로 매칭된다."""
    records = [
        {
            "location": "B2주차장",
            "pile_number": "479",
            "construction_date": "2025-09-20",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.1,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[{"id": "C1", "building_name": "주차장", "matched_text": {"text": "479"}}],
        parking_unified_location="B2",
        unify_parking_circle_location=True,
    )
    assert mapping["matchedCircleCount"] == 1
    assert mapping["pendingCircleCount"] == 0
    om = mapping["circleMappings"][0]
    assert om["status"] == "installed"
    assert om["circleLocation"] == "주차장"


def test_record_location_unifies_partial_parking_keywords_when_single_bn_outline():
    """단일 지하주차장 윤곽 통합 시 PDAM 위치에 주차장/주차/지하 표기가 일부만 있어도 Bn 키로 묶는다."""
    cr = construction_reports
    assert cr._record_location_for_pdam_match({"location": "B2지하주차"}, "B2") == "B2"
    assert cr._record_location_for_pdam_match({"location": "지하"}, "B2") == "B2"
    assert cr._record_location_for_pdam_match({"location": "주차"}, "B3") == "B3"


def test_map_records_unified_parking_matches_pdam_with_only_jiha_or_jucha():
    records = [
        {
            "location": "지하주차",
            "pile_number": "12",
            "construction_date": "2025-09-21",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.1,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[{"id": "C1", "building_name": "B2", "matched_text": {"text": "12"}}],
        parking_unified_location="B2",
    )
    assert mapping["matchedCircleCount"] == 1
    assert mapping["circleMappings"][0]["status"] == "installed"


def test_map_records_parking_circle_not_unified_without_parking_unified_location():
    """저장 작업에 주차장 윤곽 통합 맥락이 없으면(parking_unified_location None) '주차장' 원과 Bn PDAM은 부위가 달라 매칭되지 않는다."""
    records = [
        {
            "location": "B2주차장",
            "pile_number": "479",
            "construction_date": "2025-09-20",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.1,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[{"id": "C1", "building_name": "주차장", "matched_text": {"text": "479"}}],
        parking_unified_location=None,
        unify_parking_circle_location=True,
    )
    assert mapping["matchedCircleCount"] == 0
    assert mapping["pendingCircleCount"] == 1
    assert mapping["circleMappings"][0]["status"] == "pending"


def test_map_records_parking_fallback_when_circle_tagged_tower_overlaps_parking():
    """타워 윤곽이 주차보다 우선되어 원 부위가 타워로만 잡혀도, PDAM 주차 행은 Bn으로 묶이면 파일번호로 매칭."""
    records = [
        {
            "location": "주차장",
            "pile_number": "479",
            "construction_date": "2026-04-07",
            "row_number": 39,
            "construction_month": "2026-04",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.3,
            "penetration_depth": 7.7,
            "boring_depth": 7.7,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {
                "id": "C479",
                "building_name": "타워4호기",
                "matched_text": {"text": "479"},
            }
        ],
        parking_unified_location="B2",
    )
    assert mapping["matchedCircleCount"] == 1
    assert mapping["circleMappings"][0]["status"] == "installed"


def test_map_records_outline_geometry_aligns_stale_circle_name_with_pdam():
    """동→지하주차장으로 옮긴 뒤에도 building_name이 동으로 남아 있으면, 윤곽이 없을 때는 주차 PDAM과 엮지 않고(동·주차 혼선 방지), 윤곽 기하로 B2로 보정되면 매칭된다."""
    records = [
        {
            "location": "주차장",
            "pile_number": "479",
            "construction_date": "2026-04-07",
            "row_number": 1,
            "construction_month": "2026-04",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.3,
            "penetration_depth": 7.7,
            "boring_depth": 7.7,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    outline = [
        {
            "name": "B2",
            "kind": "parking",
            "vertices": [
                {"x": 0.0, "y": 0.0},
                {"x": 10.0, "y": 0.0},
                {"x": 10.0, "y": 10.0},
                {"x": 0.0, "y": 10.0},
            ],
        },
    ]
    circles = [
        {
            "id": "C1",
            "building_name": "301동",
            "center_x": 5.0,
            "center_y": 5.0,
            "matched_text": {"text": "479"},
        },
    ]
    without_outline = construction_reports.map_records_to_circles(
        records,
        circles,
        parking_unified_location="B2",
    )
    with_outline = construction_reports.map_records_to_circles(
        records,
        circles,
        parking_unified_location="B2",
        outline_buildings=outline,
    )
    assert without_outline["matchedCircleCount"] == 0
    assert without_outline["pendingCircleCount"] == 1
    assert with_outline["matchedCircleCount"] == 1
    assert without_outline["circleMappings"][0]["circleLocation"] == "301동"
    assert with_outline["circleMappings"][0]["circleLocation"] == "B2"


def test_map_records_parking_unified_주차장_pdam_only_bn_still_matches():
    """지하주차장 윤곽 이름이 '주차장'만일 때 PDAM은 'B2'만 적고 도면은 '주차장'인 경우(청주 등) 부위 키를 맞춘다."""
    records = [
        {
            "location": "B2",
            "pile_number": "479",
            "construction_date": "2025-09-20",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.1,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[{"id": "C1", "building_name": "주차장", "matched_text": {"text": "479"}}],
        parking_unified_location="주차장",
    )
    assert mapping["matchedCircleCount"] == 1
    assert mapping["pendingCircleCount"] == 0
    assert mapping["circleMappings"][0]["status"] == "installed"


def test_map_records_dong_circle_does_not_use_parking_unified_fallback():
    """단일 Bn 통합이 있어도 N동 도면 원은 주차 PDAM(동일 파일번호)으로 폴백 연결하지 않는다."""
    records = [
        {
            "location": "B2",
            "pile_number": "100",
            "construction_date": "2025-09-20",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.1,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[{"id": "C1", "building_name": "108동", "matched_text": {"text": "100"}}],
        parking_unified_location="B2",
    )
    assert mapping["circleMappings"][0]["status"] == "pending"
    assert mapping["circleMappings"][0]["matchType"] == "pending"


def test_map_records_to_circles_does_not_globally_unique_match_across_different_dong():
    """동이 다르면 파일번호가 PDAM 전체에서 유일해도 다른 동 원에 연결하지 않는다."""
    records = [
        {
            "location": "203동",
            "pile_number": "479",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.5,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    circles = [{"id": "C1", "building_name": "210동", "matched_text": {"text": "479"}}]
    mapping = construction_reports.map_records_to_circles(records, circles)
    assert mapping["matchedCircleCount"] == 0
    assert mapping["pendingCircleCount"] == 1
    assert mapping["circleMappings"][0]["matchType"] == "pending"
    assert mapping["circleMappings"][0]["status"] == "pending"


def test_map_records_to_circles_globally_unique_pile_alias_when_non_dong_location_mismatches():
    """N동이 아닌 부위는 PDAM 문자열과 도면 building_name이 달라도 파일번호가 유일하면 연결."""
    records = [
        {
            "location": "발전실",
            "pile_number": "12",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.5,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    circles = [{"id": "C1", "building_name": "제어반실", "matched_text": {"text": "12"}}]
    mapping = construction_reports.map_records_to_circles(records, circles)
    assert mapping["matchedCircleCount"] == 1
    assert mapping["pendingCircleCount"] == 0
    assert mapping["circleMappings"][0]["matchType"] == "globally_unique_pile_alias"
    assert mapping["circleMappings"][0]["status"] == "installed"


def test_map_records_single_parking_unifies_pdam_labels_with_parking_keyword():
    """저장 작업에 지하주차장 윤곽이 1개(B2)일 때 PDAM 'B3주차장' 등도 B2 윤곽 좌표와 매칭."""
    records = [
        {
            "location": "B3주차장",
            "pile_number": "5-1",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.5,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]
    circles = [{"id": "P1", "building_name": "B2", "matched_text": {"text": "5-1"}}]
    mapping = construction_reports.map_records_to_circles(
        records, circles, parking_unified_location="B2"
    )
    assert mapping["matchedCircleCount"] == 1
    assert mapping["circleMappings"][0]["status"] == "installed"


def test_map_records_to_circles_matches_location_prefixed_numbers_and_unspecified_buildings():
    records = [
        {
            "location": "201동",
            "pile_number": "1-53",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.2,
            "penetration_depth": 6.1,
            "boring_depth": 6.1,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "210동",
            "pile_number": "10-7",
            "construction_date": "2025-09-20",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.4,
            "penetration_depth": 5.8,
            "boring_depth": 5.8,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "미지정",
            "pile_number": "900",
            "construction_date": "2025-09-21",
            "row_number": 3,
            "construction_month": "2025-09",
            "equipment": "3호기",
            "pile_type": "SC",
            "construction_method": "T5",
            "pile_remaining": 0.0,
            "penetration_depth": 4.5,
            "boring_depth": 4.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C1", "building_name": "201동", "matched_text": {"text": "53"}},
            {"id": "C2", "building_name": "210 동", "matched_text": {"text": "7"}},
            {"id": "C3", "building_name": "building_8", "matched_text": {"text": "900"}},
        ],
    )

    assert mapping["matchedCircleCount"] == 3
    assert mapping["pendingCircleCount"] == 0
    assert mapping["circleMappings"][0]["locationNormalized"] == construction_reports._normalize_location("201동")
    assert mapping["circleMappings"][1]["locationNormalized"] == construction_reports._normalize_location("210동")
    assert mapping["circleMappings"][2]["circleLocation"] == "미지정"


def test_map_records_to_circles_ignores_dash_prefix_and_prioritizes_location():
    records = [
        {
            "location": "206동",
            "pile_number": "9-128",
            "construction_date": "2025-09-19",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.2,
            "penetration_depth": 6.1,
            "boring_depth": 6.1,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "209동",
            "pile_number": "2-128",
            "construction_date": "2025-09-20",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.4,
            "penetration_depth": 5.8,
            "boring_depth": 5.8,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "B3주차장",
            "pile_number": "7-34",
            "construction_date": "2025-09-21",
            "row_number": 3,
            "construction_month": "2025-09",
            "equipment": "3호기",
            "pile_type": "SC",
            "construction_method": "T5",
            "pile_remaining": 0.0,
            "penetration_depth": 4.5,
            "boring_depth": 4.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C1", "building_name": "206동", "matched_text": {"text": "128"}},
            {"id": "C2", "building_name": "B3", "matched_text": {"text": "34"}},
        ],
    )

    assert mapping["matchedCircleCount"] == 2
    assert mapping["pendingCircleCount"] == 0
    assert mapping["circleMappings"][0]["locationNormalized"] == "206동"
    assert mapping["circleMappings"][1]["locationNormalized"] == "B3"
    assert mapping["circleMappings"][1]["pileNumber"] == "34"


def test_diagnostic_display_pile_number_respects_header_location():
    assert construction_reports._diagnostic_display_key("203동", "3-34") == ("203동", "34")
    assert construction_reports._diagnostic_display_key("B3주차장", "B3-34") == ("B3", "34")
    assert construction_reports._diagnostic_display_key("B3주차장", "3-34") == ("B3", "3-34")
    assert construction_reports._diagnostic_display_key("203동", "3-101") == ("203동", "101")
    assert construction_reports._diagnostic_display_key("203동", "3-102") == ("203동", "102")


def test_map_records_to_circles_does_not_confuse_prefixed_three_digit_numbers():
    records = [
        {
            "location": "203동",
            "pile_number": "3-101",
            "construction_date": "2025-09-21",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.0,
            "penetration_depth": 4.5,
            "boring_depth": 4.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "203동",
            "pile_number": "3-102",
            "construction_date": "2025-09-21",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "pile_remaining": 0.0,
            "penetration_depth": 4.6,
            "boring_depth": 4.6,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C101", "building_name": "203동", "matched_text": {"text": "101"}},
            {"id": "C102", "building_name": "203동", "matched_text": {"text": "102"}},
            {"id": "C1", "building_name": "203동", "matched_text": {"text": "1"}},
            {"id": "C2", "building_name": "203동", "matched_text": {"text": "2"}},
        ],
    )

    mapping_by_circle = {item["circleId"]: item for item in mapping["circleMappings"]}
    assert mapping_by_circle["C101"]["status"] == "installed"
    assert mapping_by_circle["C101"]["pileNumber"] == "101"
    assert mapping_by_circle["C102"]["status"] == "installed"
    assert mapping_by_circle["C102"]["pileNumber"] == "102"
    assert mapping_by_circle["C1"]["status"] == "pending"
    assert mapping_by_circle["C2"]["status"] == "pending"


def test_map_records_to_circles_infers_parking_level_from_equipment_timeline():
    records = [
        {
            "location": "B3주차장",
            "pile_number": "51",
            "construction_date": "2025-09-01",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.2,
            "penetration_depth": 4.8,
            "boring_depth": 4.8,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "주차장",
            "pile_number": "34",
            "construction_date": "2025-09-02",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.1,
            "penetration_depth": 4.9,
            "boring_depth": 4.9,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "B3",
            "pile_number": "52",
            "construction_date": "2025-09-03",
            "row_number": 3,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.0,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "B2",
            "pile_number": "34",
            "construction_date": "2025-09-02",
            "row_number": 4,
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.3,
            "penetration_depth": 4.1,
            "boring_depth": 4.1,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C1", "building_name": "B3", "matched_text": {"text": "34"}},
        ],
    )

    assert mapping["matchedCircleCount"] == 1
    assert mapping["pendingCircleCount"] == 0
    assert mapping["autoMatchedCount"] == 1
    overlay = mapping["circleMappings"][0]
    assert overlay["matchType"] == "inferred_equipment_context"
    assert overlay["locationNormalized"] == "B3"
    assert overlay["sourceLocationNormalized"] == "주차장"
    assert overlay["inferredRecordLocation"] == "B3"
    assert "2호기" in (overlay["inferenceReason"] or "")


def test_map_records_to_circles_relaxes_parking_inference_for_wider_equipment_window():
    records = [
        {
            "location": "B3주차장",
            "pile_number": "81",
            "construction_date": "2025-09-01",
            "row_number": 1,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.2,
            "penetration_depth": 4.8,
            "boring_depth": 4.8,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "주차장",
            "pile_number": "82",
            "construction_date": "2025-09-05",
            "row_number": 2,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.1,
            "penetration_depth": 4.9,
            "boring_depth": 4.9,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "location": "B3",
            "pile_number": "83",
            "construction_date": "2025-09-06",
            "row_number": 3,
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "pile_remaining": 0.0,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    mapping = construction_reports.map_records_to_circles(
        records,
        circles=[
            {"id": "C1", "building_name": "B3", "matched_text": {"text": "82"}},
        ],
    )

    assert mapping["matchedCircleCount"] == 1
    assert mapping["autoMatchedCount"] == 1
    overlay = mapping["circleMappings"][0]
    assert overlay["locationNormalized"] == "B3"
    assert overlay["sourceLocationNormalized"] == "주차장"
    assert overlay["inferredRecordLocation"] == "B3"


def test_build_dashboard_keeps_basement_prefix_variants_separate_in_diagnostics(monkeypatch):
    records = [
        {
            "sheet_name": "기록지",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "203동",
            "pile_number": "3-34",
            "pile_number_sort": 334,
            "pile_remaining": 0.2,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "B3주차장",
            "pile_number": "3-34",
            "pile_number_sort": 334,
            "pile_remaining": 0.2,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3주차장",
            "pile_number": "B3-34",
            "pile_number_sort": 334,
            "pile_remaining": 0.1,
            "penetration_depth": 5.5,
            "boring_depth": 5.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    monkeypatch.setattr(
        construction_reports,
        "_get_dataset",
        lambda dataset_id: {"id": dataset_id, "name": "sample"},
    )
    monkeypatch.setattr(construction_reports, "_list_records", lambda dataset_id: list(records))

    dashboard = construction_reports.build_dashboard(
        "sample-dataset",
        circles=[],
    )

    diagnostics = dashboard["diagnostics"]
    assert diagnostics["summary"]["pdamDuplicateCount"] == 0
    pdam_only_numbers = {
        (item["location"], item.get("displayPileNumber"))
        for item in diagnostics["pdamOnly"]
    }
    assert ("203동", "34") in pdam_only_numbers
    assert ("B3", "3-34") in pdam_only_numbers
    assert ("B3", "34") in pdam_only_numbers


def test_build_dashboard_supports_multi_filters_and_settlement(monkeypatch):
    records = [
        {
            "sheet_name": "기록지",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-08-26",
            "construction_month": "2025-08",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "정T4",
            "location": "207동",
            "pile_number": "11",
            "pile_number_sort": 11,
            "pile_remaining": 0.8,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3-주차장",
            "pile_number": "12",
            "pile_number_sort": 12,
            "pile_remaining": 1.4,
            "penetration_depth": 5.5,
            "boring_depth": 5.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-20",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "정T4",
            "location": "207 동",
            "pile_number": "13",
            "pile_number_sort": 13,
            "pile_remaining": 0.2,
            "penetration_depth": 7.0,
            "boring_depth": 7.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    monkeypatch.setattr(
        construction_reports,
        "_get_dataset",
        lambda dataset_id: {"id": dataset_id, "name": "sample"},
    )
    monkeypatch.setattr(construction_reports, "_list_records", lambda dataset_id: list(records))

    dashboard = construction_reports.build_dashboard(
        "sample-dataset",
        circles=[
            {"id": "C1", "building_name": "207", "matched_text": {"text": "11"}},
            {"id": "C2", "building_name": "207동", "matched_text": {"text": "13"}},
            {"id": "C3", "building_name": "B3주차장", "matched_text": {"text": "12"}},
        ],
        equipments=["1호기", "2호기"],
        methods=["정T4", "DRA"],
        locations=["207동", "B3"],
        remaining_threshold=1.0,
        settlement_month="2025-09",
        settlement_start_day=25,
        settlement_end_day=20,
    )

    assert dashboard["filters"]["applied"]["dateFrom"] == "2025-08-26"
    assert dashboard["filters"]["applied"]["dateTo"] == "2025-09-20"
    assert dashboard["summary"]["matchedCircleCount"] == 3
    assert dashboard["summary"]["overThresholdCount"] == 1
    assert [item["value"] for item in dashboard["filters"]["options"]["locations"]] == ["207동", "B3"]
    assert dashboard["charts"]["byDate"][0]["key"] == "2025-08-26"
    assert dashboard["charts"]["byDate"][0]["weekday"] is not None
    assert dashboard["settlement"]["period"]["startDate"] == "2025-08-25"
    assert dashboard["settlement"]["period"]["endDate"] == "2025-09-20"
    assert dashboard["settlement"]["summary"]["uniquePileCount"] == 3
    assert dashboard["settlement"]["summary"]["totalPenetrationDepth"] == 18.5
    assert dashboard["settlement"]["locationProgress"][0]["progressPercent"] == 100.0


def test_normalize_location_supports_basement_aliases():
    assert construction_reports._normalize_location("지하 2층") == "B2"
    assert construction_reports._normalize_location("지하주차장 B3") == "B3"
    assert construction_reports._normalize_location("B3-주차장") == "B3"
    assert construction_reports._normalize_location("지하주차장") == "B"


def test_normalize_location_supports_tower_korean_and_t_suffix():
    assert construction_reports._normalize_location("타워4호기") == "T4"
    assert construction_reports._normalize_location("타워 4 호기") == "T4"
    assert construction_reports._normalize_location("타워크레인 2") == "T2"
    assert construction_reports._normalize_location("T4") == "T4"
    assert construction_reports._normalize_location("T4호기") == "T4"


def test_settlement_location_progress_keeps_basement_locations_separate(monkeypatch):
    records = [
        {
            "sheet_name": "기록지",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B2주차장",
            "pile_number": "1",
            "pile_number_sort": 1,
            "pile_remaining": 0.2,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3주차장",
            "pile_number": "2",
            "pile_number_sort": 2,
            "pile_remaining": 0.1,
            "penetration_depth": 4.5,
            "boring_depth": 4.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "SC",
            "construction_method": "T4",
            "location": "주차장",
            "pile_number": "3",
            "pile_number_sort": 3,
            "pile_remaining": 0.0,
            "penetration_depth": 4.0,
            "boring_depth": 4.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    monkeypatch.setattr(
        construction_reports,
        "_get_dataset",
        lambda dataset_id: {"id": dataset_id, "name": "sample"},
    )
    monkeypatch.setattr(construction_reports, "_list_records", lambda dataset_id: list(records))

    dashboard = construction_reports.build_dashboard(
        "sample-dataset",
        circles=[
            {"id": "C1", "building_name": "B2", "matched_text": {"text": "1"}},
            {"id": "C2", "building_name": "지하2층", "matched_text": {"text": "9"}},
            {"id": "C3", "building_name": "B3", "matched_text": {"text": "2"}},
            {"id": "C4", "building_name": "B3 주차장", "matched_text": {"text": "8"}},
            {"id": "C5", "building_name": None, "matched_text": {"text": "3"}},
        ],
        settlement_month="2025-09",
        settlement_start_day=1,
        settlement_end_day=30,
    )

    assert dashboard["settlement"]["locationProgress"] == [
        {
            "location": "B2",
            "totalPlannedCount": 2,
            "periodInstalledCount": 1,
            "cumulativeInstalledCount": 1,
            "progressPercent": 50.0,
        },
        {
            "location": "B3",
            "totalPlannedCount": 2,
            "periodInstalledCount": 1,
            "cumulativeInstalledCount": 1,
            "progressPercent": 50.0,
        },
        {
            "location": "미지정",
            "totalPlannedCount": 1,
            "periodInstalledCount": 1,
            "cumulativeInstalledCount": 1,
            "progressPercent": 100.0,
        }
    ]


def test_build_dashboard_normalizes_method_aliases(monkeypatch):
    records = [
        {
            "sheet_name": "기록지",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "PHC",
            "construction_method": "계량 T4",
            "location": "201동",
            "pile_number": "1",
            "pile_number_sort": 1,
            "pile_remaining": 0.3,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "개량T4",
            "location": "201동",
            "pile_number": "2",
            "pile_number_sort": 2,
            "pile_remaining": 0.5,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "1호기",
            "pile_type": "SC",
            "construction_method": "DAR",
            "location": "B3주차장",
            "pile_number": "3",
            "pile_number_sort": 3,
            "pile_remaining": 0.1,
            "penetration_depth": 4.0,
            "boring_depth": 4.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "기록지",
            "row_number": 4,
            "sequence_no": "4",
            "construction_date": "2025-09-04",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "SC",
            "construction_method": "DRA",
            "location": "B3주차장",
            "pile_number": "4",
            "pile_number_sort": 4,
            "pile_remaining": 0.2,
            "penetration_depth": 4.5,
            "boring_depth": 4.5,
            "excavation_depth": 0.0,
            "installed": True,
        },
    ]

    monkeypatch.setattr(
        construction_reports,
        "_get_dataset",
        lambda dataset_id: {"id": dataset_id, "name": "sample"},
    )
    monkeypatch.setattr(construction_reports, "_list_records", lambda dataset_id: list(records))

    dashboard = construction_reports.build_dashboard(
        "sample-dataset",
        methods=["개량T4", "DRA"],
    )

    assert dashboard["filters"]["applied"]["methods"] == ["개량T4", "DRA"]
    assert [item["value"] for item in dashboard["filters"]["options"]["methods"]] == ["DRA", "개량T4"]
    assert {item["key"]: item["uniquePileCount"] for item in dashboard["charts"]["byMethod"]} == {"개량T4": 2, "DRA": 2}
    assert dashboard["records"][0]["construction_method"] in {"개량T4", "DRA"}


def test_apply_filters_includes_parking_rows_when_location_chip_is_unified_basement():
    """PDAM이 '주차장'만 적고 부위 칩은 'B2'일 때, 주차 통합 맥락에서 동일 구역으로 본다."""
    rows = [
        {"location": "주차장", "construction_date": "2026-04-07"},
        {"location": "101동", "construction_date": "2026-04-07"},
    ]
    out = construction_reports._apply_filters(
        rows,
        date_from=None,
        date_to=None,
        month=None,
        locations=["B2"],
        parking_unified_location="B2",
    )
    assert len(out) == 1
    assert out[0]["location"] == "주차장"


def test_dedupe_circles_for_construction_mapping_prefers_circle_with_matched_text():
    a = {"id": "dupA", "center_x": 100.0, "center_y": 200.0, "radius": 0.4, "matched_text": {}}
    b = {
        "id": "dupB",
        "center_x": 100.0,
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "479"},
        "matched_text_id": "T1",
    }
    out, clusters = construction_reports.dedupe_circles_for_construction_mapping([a, b])
    assert len(out) == 1
    assert out[0]["id"] == "dupB"
    assert clusters == {"dupB": ["dupA", "dupB"]}


def test_fan_out_geometry_duplicate_clones_overlay_to_sibling_circle_ids():
    overlays = [{"circleId": "dupB", "status": "installed", "pileNumber": "479"}]
    out = construction_reports._fan_out_circle_mappings_for_geometry_clusters(
        overlays, {"dupB": ["dupA", "dupB"]}
    )
    assert len(out) == 2
    assert {o["circleId"] for o in out} == {"dupA", "dupB"}
    assert all(o.get("pileNumber") == "479" for o in out)
    by_id = {o["circleId"]: o for o in out}
    assert "pdamMappingSourceCircleId" not in by_id["dupB"]
    assert by_id["dupA"].get("pdamMappingSourceCircleId") == "dupB"


def test_dedupe_circles_does_not_merge_same_geometry_different_pile_text():
    a = {
        "id": "a",
        "center_x": 1.0,
        "center_y": 2.0,
        "radius": 0.5,
        "matched_text": {"text": "101"},
    }
    b = {
        "id": "b",
        "center_x": 1.0,
        "center_y": 2.0,
        "radius": 0.5,
        "matched_text": {"text": "102"},
    }
    out, _clusters = construction_reports.dedupe_circles_for_construction_mapping([a, b])
    assert len(out) == 2


def test_dedupe_circles_loose_geometry_matches_exclude_duplicate_option():
    """캔버스 「중복 제외」 켠 경우와 동일하게 미세 오차 좌표를 한 덩어리로 본다."""
    a = {
        "id": "a",
        "center_x": 100.0,
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "479"},
    }
    b = {
        "id": "b",
        "center_x": 100.001,
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "479"},
    }
    strict, _s = construction_reports.dedupe_circles_for_construction_mapping(
        [a, b], exclude_identical_geometry_duplicates=False
    )
    loose, _l = construction_reports.dedupe_circles_for_construction_mapping(
        [a, b], exclude_identical_geometry_duplicates=True
    )
    assert len(strict) == 2
    assert len(loose) == 1


def test_dedupe_circles_loose_geometry_uses_quarter_radius_center_tolerance():
    a = {
        "id": "a",
        "center_x": 100.0,
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "470"},
    }
    b_inside = {
        "id": "b_inside",
        "center_x": 100.09,  # radius(0.4)의 1/4(0.1) 이내
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "470"},
    }
    b_outside = {
        "id": "b_outside",
        "center_x": 100.11,  # radius(0.4)의 1/4(0.1) 초과
        "center_y": 200.0,
        "radius": 0.4,
        "matched_text": {"text": "470"},
    }
    loose_inside, _ = construction_reports.dedupe_circles_for_construction_mapping(
        [a, b_inside], exclude_identical_geometry_duplicates=True
    )
    loose_outside, _ = construction_reports.dedupe_circles_for_construction_mapping(
        [a, b_outside], exclude_identical_geometry_duplicates=True
    )
    assert len(loose_inside) == 1
    assert len(loose_outside) == 2


def test_build_filter_options_excludes_column_header_echo_rows():
    """엑셀 열 이름(시공장비·시공공법·시공위치 등)이 값으로 들어간 행은 필터 칩 집계에서 제외한다."""
    records = [
        {
            "construction_date": "2025-01-01",
            "construction_month": "2025-01",
            "equipment": "시공장비",
            "construction_method": "시공공법",
            "location": "시공위치",
        },
        {
            "construction_date": "2025-01-02",
            "construction_month": "2025-01",
            "equipment": "1호기",
            "construction_method": "DRA",
            "location": "108동",
        },
    ]
    opts = construction_reports._build_filter_options(records)
    assert [x["value"] for x in opts["equipments"]] == ["1호기"]
    assert [x["value"] for x in opts["methods"]] == ["DRA"]
    assert [x["value"] for x in opts["locations"]] == ["108동"]
