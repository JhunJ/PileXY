from __future__ import annotations

from backend import construction_reports


def test_build_dashboard_reports_auto_matches_and_mapping_diagnostics(monkeypatch):
    records = [
        {
            "sheet_name": "record",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "201",
            "pile_number": "1-10",
            "pile_number_sort": 10,
            "pile_remaining": 0.2,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            # B2 행(장비 2)과 동일하면 위치추론이 B2로 붙어 B3 원의 inferred_remaining 매칭이 깨짐
            "equipment": "9",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": construction_reports.UNSPECIFIED_LOCATION,
            "pile_number": "7-34",
            "pile_number_sort": 34,
            "pile_remaining": 0.5,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B2",
            "pile_number": "2-50",
            "pile_number_sort": 50,
            "pile_remaining": 0.1,
            "penetration_depth": 4.0,
            "boring_depth": 4.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 4,
            "sequence_no": "4",
            "construction_date": "2025-09-04",
            "construction_month": "2025-09",
            "equipment": "3",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3",
            "pile_number": "3-50",
            "pile_number_sort": 50,
            "pile_remaining": 0.3,
            "penetration_depth": 4.2,
            "boring_depth": 4.2,
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
            {"id": "C1", "building_name": "201", "matched_text": {"text": "10"}},
            {"id": "C2", "building_name": "B3", "matched_text": {"text": "34"}},
            {"id": "C3", "building_name": "B2", "matched_text": {"text": "50"}},
            {"id": "C4", "building_name": "B2", "matched_text": {"text": "50"}},
            {"id": "C5", "building_name": "building_8", "matched_text": {"text": "999"}},
        ],
    )

    mapping_by_circle = {item["circleId"]: item for item in dashboard["mapping"]["circleMappings"]}
    diagnostics = dashboard["diagnostics"]

    assert dashboard["summary"]["autoMatchedCount"] == 1
    assert mapping_by_circle["C2"]["autoMatched"] is True
    assert mapping_by_circle["C2"]["matchType"] == "inferred_remaining"
    assert diagnostics["summary"] == {
        "autoMatchedCount": 1,
        "projectOnlyCount": 1,
        "pdamOnlyCount": 1,
        "projectDuplicateCount": 1,
        "pdamDuplicateCount": 0,
    }
    assert diagnostics["autoMatched"][0]["pileNumber"] == "34"
    assert diagnostics["pdamOnly"][0]["location"] == "B3"
    assert diagnostics["projectOnly"][0]["pileNumber"] == "999"
    assert diagnostics["pdamOnly"][0]["pileNumber"] == "3-50"
    assert diagnostics["projectDuplicates"][0]["rawPileNumbers"] == ["50"]
    assert diagnostics["projectDuplicates"][0]["circleIds"] == ["C3", "C4"]
    assert diagnostics["pdamDuplicates"] == []


def test_pdam_duplicates_detect_identical_rows_after_latest_dedupe(monkeypatch):
    """동일 시공위치·파일번호가 PDAM에 두 줄이면 pile당 1행(latest)에 합쳐지므로
    중복 진단은 filtered 전체 행을 봐야 잡힌다."""
    records = [
        {
            "sheet_name": "record",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "210동",
            "pile_number": "10-48",
            "pile_number_sort": 48,
            "pile_remaining": 0.2,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "1",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "210동",
            "pile_number": "10-48",
            "pile_number_sort": 48,
            "pile_remaining": 0.3,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
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

    dashboard = construction_reports.build_dashboard("sample-dataset", circles=[])

    assert dashboard["diagnostics"]["summary"]["pdamDuplicateCount"] == 1
    dup = dashboard["diagnostics"]["pdamDuplicates"][0]
    assert dup["location"] == "210동"
    assert dup["pileNumber"] == "48"
    assert dup["count"] == 2


def test_pdam_duplicates_merge_unicode_dash_pile_numbers(monkeypatch):
    records = [
        {
            "sheet_name": "record",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "1",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "210동",
            "pile_number": "10-48",
            "pile_number_sort": 48,
            "pile_remaining": 0.2,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "1",
            "pile_type": "PHC",
            "construction_method": "T4",
            "location": "210동",
            "pile_number": "10\u201348",
            "pile_number_sort": 48,
            "pile_remaining": 0.3,
            "penetration_depth": 6.0,
            "boring_depth": 6.0,
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

    dashboard = construction_reports.build_dashboard("sample-dataset", circles=[])

    assert dashboard["diagnostics"]["summary"]["pdamDuplicateCount"] == 1
    assert dashboard["diagnostics"]["pdamDuplicates"][0]["count"] == 2


def test_mapping_diagnostics_do_not_report_same_display_number_as_pdam_only_when_already_matched(monkeypatch):
    records = [
        {
            "sheet_name": "record",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B2",
            "pile_number": "2-50",
            "pile_number_sort": 50,
            "pile_remaining": 0.1,
            "penetration_depth": 4.0,
            "boring_depth": 4.0,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-04",
            "construction_month": "2025-09",
            "equipment": "3",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B2",
            "pile_number": "50",
            "pile_number_sort": 50,
            "pile_remaining": 0.3,
            "penetration_depth": 4.2,
            "boring_depth": 4.2,
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
            {"id": "C1", "building_name": "B2", "matched_text": {"text": "50"}},
        ],
    )

    diagnostics = dashboard["diagnostics"]

    assert diagnostics["summary"]["pdamOnlyCount"] == 1
    assert diagnostics["summary"]["pdamDuplicateCount"] == 0
    assert diagnostics["pdamOnly"] == [
        {
            "location": "B2",
            "pileNumber": "2-50",
            "displayPileNumber": "2-50",
            "rawPileNumber": "2-50",
            "constructionDate": "2025-09-03",
            "equipment": "2",
            "constructionMethod": "DRA",
            "pileNumberSort": 50,
            "recordRowNumber": 1,
        }
    ]
    assert diagnostics["pdamDuplicates"] == []


def test_build_dashboard_reports_equipment_based_parking_inference(monkeypatch):
    records = [
        {
            "sheet_name": "record",
            "row_number": 1,
            "sequence_no": "1",
            "construction_date": "2025-09-01",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3주차장",
            "pile_number": "51",
            "pile_number_sort": 51,
            "pile_remaining": 0.2,
            "penetration_depth": 4.8,
            "boring_depth": 4.8,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 2,
            "sequence_no": "2",
            "construction_date": "2025-09-02",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "주차장",
            "pile_number": "34",
            "pile_number_sort": 34,
            "pile_remaining": 0.1,
            "penetration_depth": 4.9,
            "boring_depth": 4.9,
            "excavation_depth": 0.0,
            "installed": True,
        },
        {
            "sheet_name": "record",
            "row_number": 3,
            "sequence_no": "3",
            "construction_date": "2025-09-03",
            "construction_month": "2025-09",
            "equipment": "2호기",
            "pile_type": "PHC",
            "construction_method": "DRA",
            "location": "B3",
            "pile_number": "52",
            "pile_number_sort": 52,
            "pile_remaining": 0.0,
            "penetration_depth": 5.0,
            "boring_depth": 5.0,
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
            {"id": "C1", "building_name": "B3", "matched_text": {"text": "34"}},
        ],
    )

    mapping = dashboard["mapping"]["circleMappings"][0]
    diagnostics = dashboard["diagnostics"]["autoMatched"][0]

    assert dashboard["summary"]["autoMatchedCount"] == 1
    assert mapping["matchType"] == "inferred_equipment_context"
    assert diagnostics["recordLocation"] == "B3"
    assert diagnostics["sourceLocation"] == "주차장"
    assert diagnostics["inferredRecordLocation"] == "B3"
    assert "2호기" in (diagnostics["inferenceReason"] or "")
