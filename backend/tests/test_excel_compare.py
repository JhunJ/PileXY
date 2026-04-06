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
    assert result["summary"]["matchBoth"] == 2
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
