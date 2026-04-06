from __future__ import annotations

import io

import pandas as pd

from backend import construction_reports


def test_normalize_pile_number_pdam_dot_before_dash_and_double_dash():
    assert construction_reports._normalize_pile_number("2.-40") == "40"
    assert construction_reports._normalize_pile_number("4.-12") == "12"
    assert construction_reports._normalize_pile_number("B2--85") == "B2-85"
    assert construction_reports._normalize_pile_number("b2--85") == "B2-85"


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
