from __future__ import annotations

import io

import pandas as pd

from backend.excel_compare import compare_excel_workbook, inspect_excel_workbook


def build_workbook_bytes() -> bytes:
    summary_rows = [
        ["building", "number", "X", "Y"],
        ["201", 1, 10.0, 20.0],
        ["201", 2, 15.0, 25.0],
    ]
    sheet_named_rows = [
        ["building", "number", "X", "Y"],
        ["202", 3, 30.0, 40.0],
        ["202", 4, 50.0, 60.0],
        ["202", 5, None, 70.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(summary_rows).to_excel(writer, sheet_name="Summary", header=False, index=False)
        pd.DataFrame(sheet_named_rows).to_excel(writer, sheet_name="202", header=False, index=False)
    return buffer.getvalue()


def test_inspect_excel_workbook_returns_preview_for_all_sheets() -> None:
    result = inspect_excel_workbook(build_workbook_bytes())

    assert result["sheetNames"] == ["Summary", "202"]
    assert len(result["sheets"]) == 2
    assert result["sheets"][0]["columnLetters"][:4] == ["A", "B", "C", "D"]
    assert result["sheets"][0]["suggestedHeaderRow"] == 1
    assert result["sheets"][1]["preview"][0]["values"][:4] == ["building", "number", "X", "Y"]


def test_compare_excel_workbook_supports_multi_sheet_selection() -> None:
    # CAD center_x/center_y는 도면 좌표; 엑셀 X,Y와 축이 바뀌므로 비교 시 (엑셀X↔CAD Y), (엑셀Y↔CAD X).
    circles_a = [
        {"building_name": "201", "matched_text": {"text": "1"}, "center_x": 20.0, "center_y": 10.0},
        {"building_name": "202", "matched_text": {"text": "3"}, "center_x": 40.0, "center_y": 30.0},
        {"building_name": "202", "matched_text": {"text": "4"}, "center_x": 60.5, "center_y": 50.5},
    ]
    circles_b = [
        {"building_name": "201", "matched_text": {"text": "1"}, "center_x": 20.0, "center_y": 10.0},
        {"building_name": "201", "matched_text": {"text": "2"}, "center_x": 25.0, "center_y": 15.0},
        {"building_name": "202", "matched_text": {"text": "3"}, "center_x": 40.0, "center_y": 30.0},
        {"building_name": "202", "matched_text": {"text": "4"}, "center_x": 60.5, "center_y": 49.5},
    ]

    result = compare_excel_workbook(
        build_workbook_bytes(),
        sheet_names=["Summary", "202"],
        header_row=1,
        building_column="A",
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="column",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["sheetNames"] == ["Summary", "202"]
    assert result["summary"]["totalRows"] == 4
    assert result["summary"]["skippedRows"] == 1
    assert result["summary"]["skippedMissingNumber"] == 0
    assert result["summary"]["skippedInvalidX"] == 1
    assert result["summary"]["skippedInvalidY"] == 0
    assert result["summary"]["matchBoth"] == 2
    skipped = result.get("skippedDetails") or []
    assert len(skipped) == 1
    assert skipped[0]["reason"] == "invalid-x"
    assert skipped[0]["sheetName"] == "202"
    assert result["summary"]["matchNewOnly"] == 1
    assert result["summary"]["coordMismatch"] == 1
    assert len(result["sheetSummaries"]) == 2
    assert [issue["status"] for issue in result["issues"]] == ["match-new-only", "coord-mismatch"]


def test_compare_excel_workbook_can_use_sheet_name_as_building() -> None:
    circles_a = [
        {"building_name": "202", "matched_text": {"text": "3"}, "center_x": 40.0, "center_y": 30.0},
    ]
    circles_b = [
        {"building_name": "202", "matched_text": {"text": "3"}, "center_x": 40.0, "center_y": 30.0},
        {"building_name": "202", "matched_text": {"text": "4"}, "center_x": 60.0, "center_y": 50.0},
    ]

    result = compare_excel_workbook(
        build_workbook_bytes(),
        sheet_names=["202"],
        header_row=1,
        building_column=None,
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["buildingSourceMode"] == "sheet"
    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 1
    assert result["summary"]["matchNewOnly"] == 1


def test_compare_excel_workbook_treats_hyphen_number_as_suffix_sequence() -> None:
    """번호 열이 한 자리-한 자리(1-1)일 때 통째 토큰으로 도면과 맞춘다."""
    rows = [
        ["building", "number", "X", "Y"],
        ["101동", "1-1", 449236.09, 242709.76],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="Summary", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {"building_name": "101동", "matched_text": {"text": "1-1"}, "center_x": 242709.76, "center_y": 449236.09},
    ]
    circles_b = [
        {"building_name": "101동", "matched_text": {"text": "1-1"}, "center_x": 242709.76, "center_y": 449236.09},
    ]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["Summary"],
        header_row=1,
        building_column="A",
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="column",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.2,
    )

    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1
    assert result["summary"]["coordMismatch"] == 0


def test_normalize_number_triple_hyphen_pile_suffix() -> None:
    from backend.excel_compare import _normalize_number

    assert _normalize_number("8-15-2") == "15-2"
    assert _normalize_number("8-15") == "15"
    assert _normalize_number("15-2") == "15-2"
    assert _normalize_number("112-116-2") == "116-2"
    assert _normalize_number("2-2") == "2-2"
    assert _normalize_number("3-5") == "3-5"


def test_compare_excel_triple_pile_matches_sheet_dong_and_split_number() -> None:
    """도면 112-116-2 ↔ 엑셀 시트 112동 + 번호 116-2 (버전비교 업체 엑셀)."""
    rows = [
        ["num", "X", "Y"],
        ["116-2", 200.0, 100.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="112동", header=False, index=False)
    workbook = buffer.getvalue()

    circle = {
        "id": "c1",
        "building_name": "112동",
        "matched_text": {"text": "112-116-2"},
        "center_x": 100.0,
        "center_y": 200.0,
    }
    result = compare_excel_workbook(
        workbook,
        sheet_names=["112동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[circle],
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_triple_in_number_cell_with_sheet_dong() -> None:
    """번호 열에 112-116-2 통째, 시트명 112동."""
    rows = [
        ["num", "X", "Y"],
        ["112-116-2", 200.0, 100.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="112동", header=False, index=False)
    workbook = buffer.getvalue()

    circle = {
        "id": "c3",
        "building_name": "112동",
        "matched_text": {"text": "112-116-2"},
        "center_x": 100.0,
        "center_y": 200.0,
    }
    result = compare_excel_workbook(
        workbook,
        sheet_names=["112동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[circle],
        coord_tolerance=0.2,
    )
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_triple_pile_circle_unassigned_dong_still_matches() -> None:
    """윤곽이 미지정이어도 매칭텍스트 동접두(112-116-2)로 112동 시트와 맞춤."""
    rows = [
        ["num", "X", "Y"],
        ["116-2", 200.0, 100.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="112동", header=False, index=False)
    workbook = buffer.getvalue()

    circle = {
        "id": "c2",
        "building_name": "미지정",
        "matched_text": {"text": "112-116-2"},
        "center_x": 100.0,
        "center_y": 200.0,
    }
    result = compare_excel_workbook(
        workbook,
        sheet_names=["112동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[circle],
        coord_tolerance=0.2,
    )
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_workbook_matches_only_same_coordinate_number() -> None:
    rows = [
        ["building", "number", "X", "Y"],
        ["101동", "1", 100.0, 200.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="Summary", header=False, index=False)
    workbook = buffer.getvalue()

    # 번호 3이 좌표상 더 가까워도, 번호 1과만 매칭되어야 한다.
    circles_a = [
        {"building_name": "101동", "matched_text": {"text": "1"}, "center_x": 200.3, "center_y": 100.3},
        {"building_name": "101동", "matched_text": {"text": "3"}, "center_x": 200.0, "center_y": 100.0},
    ]
    circles_b = [
        {"building_name": "101동", "matched_text": {"text": "1"}, "center_x": 200.3, "center_y": 100.3},
        {"building_name": "101동", "matched_text": {"text": "3"}, "center_x": 200.0, "center_y": 100.0},
    ]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["Summary"],
        header_row=1,
        building_column="A",
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="column",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.1,
    )

    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["coordMismatch"] == 1
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["status"] == "coord-mismatch"
    assert issue["number"] == "1"
    assert issue["newCircle"]["number"] == "1"


def test_compare_excel_workbook_sheet_parking_name_maps_to_single_parking_outline() -> None:
    rows = [
        ["number", "X", "Y"],
        ["7", 300.0, 400.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="B2", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {"building_name": "지하주차장", "matched_text": {"text": "7"}, "center_x": 400.0, "center_y": 300.0},
    ]
    circles_b = [
        {"building_name": "지하주차장", "matched_text": {"text": "7"}, "center_x": 400.0, "center_y": 300.0},
    ]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["B2"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1
    assert result["summary"]["missingBoth"] == 0


def test_compare_excel_workbook_issue_circle_coordinates_follow_excel_xy_order() -> None:
    rows = [
        ["building", "number", "X", "Y"],
        ["101동", "1", 449236.09, 242709.76],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="Summary", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        # CAD center_x/center_y 기준
        {"building_name": "101동", "matched_text": {"text": "1"}, "center_x": 242709.70, "center_y": 449236.08},
    ]
    circles_b = [
        {"building_name": "101동", "matched_text": {"text": "1"}, "center_x": 242709.70, "center_y": 449236.08},
    ]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["Summary"],
        header_row=1,
        building_column="A",
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="column",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["summary"]["coordMismatch"] == 1
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["status"] == "coord-mismatch"
    # 응답 좌표 표시는 엑셀과 같은 X,Y 순서(= CAD center_y, center_x)
    assert issue["newCircle"]["x"] == 449236.08
    assert issue["newCircle"]["y"] == 242709.70


def test_compare_excel_workbook_tower_crane_sheet_matches_t_suffix_pile_text() -> None:
    """시트 T4 + 엑셀 번호 1 ↔ 도면 T4 + 매칭 텍스트 T4-1(타워 파일 번호)"""
    rows = [
        ["number", "X", "Y"],
        [1, 100.0, 200.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="T4", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {"building_name": "T4", "matched_text": {"text": "T4-1"}, "center_x": 200.0, "center_y": 100.0},
    ]
    circles_b = [
        {"building_name": "T4", "matched_text": {"text": "T4-1"}, "center_x": 200.0, "center_y": 100.0},
    ]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["T4"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_tower_sheet_name_t4dong_matches() -> None:
    """시트명이 T4동 일 때도 도면 T4 + T4-1 과 맞춤."""
    rows = [["number", "X", "Y"], [1, 100.0, 200.0]]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="T4동", header=False, index=False)
    workbook = buffer.getvalue()
    circle = {"building_name": "T4", "matched_text": {"text": "T4-1"}, "center_x": 200.0, "center_y": 100.0}
    result = compare_excel_workbook(
        workbook,
        sheet_names=["T4동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[{**circle}],
        coord_tolerance=0.01,
    )
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_tower_tc_sheet_and_tc_text_match_t_building() -> None:
    """시트 TC4 / 매칭 TC4-1 ↔ 도면 building T4(호기 동일)."""
    rows = [["number", "X", "Y"], [1, 100.0, 200.0]]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="TC4", header=False, index=False)
    workbook = buffer.getvalue()
    circle = {"building_name": "T4", "matched_text": {"text": "TC4-1"}, "center_x": 200.0, "center_y": 100.0}
    result = compare_excel_workbook(
        workbook,
        sheet_names=["TC4"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[{**circle}],
        coord_tolerance=0.01,
    )
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_tower_excel_number_tc4_dash_1_column() -> None:
    """번호 열에 TC4-1 통째로 적은 경우(동 컬럼 T4 또는 시트 T4)."""
    rows = [["building", "number", "X", "Y"], ["T4", "TC4-1", 100.0, 200.0]]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="Summary", header=False, index=False)
    workbook = buffer.getvalue()
    circle = {"building_name": "T4", "matched_text": {"text": "T4-1"}, "center_x": 200.0, "center_y": 100.0}
    result = compare_excel_workbook(
        workbook,
        sheet_names=["Summary"],
        header_row=1,
        building_column="A",
        number_column="B",
        x_column="C",
        y_column="D",
        building_source_mode="column",
        circles_a=[circle],
        circles_b=[{**circle}],
        coord_tolerance=0.01,
    )
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_tower_number_column_t4_dash_n_matches_even_if_sheet_name_unrelated() -> None:
    """번호 열이 T4-1… 형태면 시트명이 타워와 달라도 T4 호기 + 파일 번호로 조회."""
    rows = [["n", "X", "Y"], ["T4-1", 100.0, 200.0], ["T4-2", 101.0, 201.0]]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="좌표표", header=False, index=False)
    workbook = buffer.getvalue()
    circles_a = [
        {"id": "a1", "building_name": "T4", "matched_text": {"text": "T4-1"}, "center_x": 200.0, "center_y": 100.0},
        {"id": "a2", "building_name": "T4", "matched_text": {"text": "T4-2"}, "center_x": 201.0, "center_y": 101.0},
    ]
    circles_b = [{**c} for c in circles_a]
    result = compare_excel_workbook(
        workbook,
        sheet_names=["좌표표"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 2


def test_normalize_excel_building_key_tower_variants() -> None:
    from backend.excel_compare import _normalize_excel_building_key

    assert _normalize_excel_building_key("T4") == "T4"
    assert _normalize_excel_building_key("T4동") == "T4"
    assert _normalize_excel_building_key("t 4 동") == "T4"
    assert _normalize_excel_building_key("TC4") == "T4"
    assert _normalize_excel_building_key("TC4동") == "T4"


def test_compare_excel_matches_cad_digit_hyphen_display_to_plain_pile_numbers() -> None:
    """CAD 1-1·1-2 표기(101동 1번·2번) ↔ 엑셀 시트 101동 + 번호 열 1·2."""
    rows = [
        ["num", "X", "Y"],
        ["1", 449236.08, 242709.70],
        ["2", 449233.90, 242710.11],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="101동", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {
            "id": "a1",
            "building_name": "101동",
            "matched_text": {"text": "1-1"},
            "center_x": 242709.70,
            "center_y": 449236.08,
        },
        {
            "id": "a2",
            "building_name": "101동",
            "matched_text": {"text": "1-2"},
            "center_x": 242710.11,
            "center_y": 449233.90,
        },
    ]
    circles_b = [{**c} for c in circles_a]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["101동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 2
    assert result["summary"]["missingBoth"] == 0


def test_compare_excel_matches_cad_dong_hyphen_pile_display_10_1_style() -> None:
    """CAD 10-1·10-2(10동 1번·2번) ↔ 엑셀 시트 10동 + 번호 1·2."""
    rows = [
        ["num", "X", "Y"],
        ["1", 100.0, 200.0],
        ["2", 101.0, 201.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="10동", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {
            "id": "t1",
            "building_name": "10동",
            "matched_text": {"text": "10-1"},
            "center_x": 200.0,
            "center_y": 100.0,
        },
        {
            "id": "t2",
            "building_name": "10동",
            "matched_text": {"text": "10-2"},
            "center_x": 201.0,
            "center_y": 101.0,
        },
    ]
    circles_b = [{**c} for c in circles_a]

    result = compare_excel_workbook(
        workbook,
        sheet_names=["10동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 2


def test_compare_excel_matches_cad_10_1_when_circle_building_unassigned() -> None:
    """building_name 미지정이어도 매칭 텍스트 10-1로 시트 10동 + 번호 1과 맞춤."""
    rows = [
        ["num", "X", "Y"],
        ["1", 100.0, 200.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="10동", header=False, index=False)
    workbook = buffer.getvalue()

    circle = {
        "id": "u1",
        "building_name": "미지정",
        "matched_text": {"text": "10-1"},
        "center_x": 200.0,
        "center_y": 100.0,
    }

    result = compare_excel_workbook(
        workbook,
        sheet_names=["10동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[{**circle}],
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_110dong_matches_cad_display_10_1_style() -> None:
    """110동 + 표기 10-1(끝 두 자리+말뚝번호) ↔ 엑셀 시트 110동 + 번호 1."""
    rows = [
        ["num", "X", "Y"],
        ["1", 449399.10, 242575.60],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="110동", header=False, index=False)
    workbook = buffer.getvalue()

    circle = {
        "id": "h1",
        "building_name": "110동",
        "matched_text": {"text": "10-1"},
        "center_x": 242575.60,
        "center_y": 449399.10,
    }

    result = compare_excel_workbook(
        workbook,
        sheet_names=["110동"],
        header_row=1,
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=[circle],
        circles_b=[{**circle}],
        coord_tolerance=0.2,
    )
    assert result["summary"]["totalRows"] == 1
    assert result["summary"]["matchBoth"] == 1


def test_compare_excel_truncated_two_digit_dong_prefix_for_111_through_114() -> None:
    """111~114동: 화면 앞 두 자리(11,12,13,14)+말뚝번호 ↔ 시트 전체 동명 + 단순 번호."""
    for dong_label, pile_text in (
        ("111동", "11-1"),
        ("112동", "12-1"),
        ("113동", "13-1"),
        ("114동", "14-1"),
    ):
        rows = [["num", "X", "Y"], ["1", 100.0, 200.0]]
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            pd.DataFrame(rows).to_excel(writer, sheet_name=dong_label, header=False, index=False)
        workbook = buffer.getvalue()
        circle = {
            "id": dong_label,
            "building_name": dong_label,
            "matched_text": {"text": pile_text},
            "center_x": 200.0,
            "center_y": 100.0,
        }
        result = compare_excel_workbook(
            workbook,
            sheet_names=[dong_label],
            header_row=1,
            building_column=None,
            number_column="A",
            x_column="B",
            y_column="C",
            building_source_mode="sheet",
            circles_a=[circle],
            circles_b=[{**circle}],
            coord_tolerance=0.2,
        )
        assert result["summary"]["totalRows"] == 1, dong_label
        assert result["summary"]["matchBoth"] == 1, dong_label


def test_compare_excel_workbook_uses_per_sheet_header_rows() -> None:
    """시트마다 헤더 행이 다를 때 header_rows로 각각 적용"""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(
            [
                ["no", "x", "y"],
                [1, 10.0, 20.0],
            ]
        ).to_excel(writer, sheet_name="A", header=False, index=False)
        pd.DataFrame(
            [
                ["title"],
                ["no", "x", "y"],
                [1, 30.0, 40.0],
            ]
        ).to_excel(writer, sheet_name="B", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {"building_name": "A", "matched_text": {"text": "1"}, "center_x": 20.0, "center_y": 10.0},
        {"building_name": "B", "matched_text": {"text": "1"}, "center_x": 40.0, "center_y": 30.0},
    ]
    circles_b = circles_a

    result = compare_excel_workbook(
        workbook,
        sheet_names=["A", "B"],
        header_row=1,
        header_rows={"A": 1, "B": 2},
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 2


def test_compare_excel_workbook_header_markers_find_header_row_per_sheet() -> None:
    """헤더 글자(번호/X/Y)가 같으면 시트마다 헤더 행 위치가 달라도 자동 매칭"""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(
            [
                ["no", "x", "y"],
                [1, 10.0, 20.0],
            ]
        ).to_excel(writer, sheet_name="A", header=False, index=False)
        pd.DataFrame(
            [
                ["title"],
                [""],
                ["no", "x", "y"],
                [1, 30.0, 40.0],
            ]
        ).to_excel(writer, sheet_name="B", header=False, index=False)
    workbook = buffer.getvalue()

    circles_a = [
        {"building_name": "A", "matched_text": {"text": "1"}, "center_x": 20.0, "center_y": 10.0},
        {"building_name": "B", "matched_text": {"text": "1"}, "center_x": 40.0, "center_y": 30.0},
    ]
    circles_b = circles_a

    result = compare_excel_workbook(
        workbook,
        sheet_names=["A", "B"],
        header_row=1,
        header_rows={"A": 1, "B": 1},
        header_markers={"number": "no", "x": "x", "y": "y"},
        building_column=None,
        number_column="A",
        x_column="B",
        y_column="C",
        building_source_mode="sheet",
        circles_a=circles_a,
        circles_b=circles_b,
        coord_tolerance=0.01,
    )

    assert result["summary"]["totalRows"] == 2
    assert result["summary"]["matchBoth"] == 2
