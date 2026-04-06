from unittest.mock import patch

from backend.work_context import apply_manual_history, apply_work_defaults


def test_apply_manual_history_filters_by_reference_work_id():
    circles = [
        {"id": "c1", "center_x": 1.0, "center_y": 2.0, "radius": 0.5, "building_name": "A동"},
        {"id": "c2", "center_x": 10.0, "center_y": 20.0, "radius": 0.5, "building_name": "A동"},
    ]
    texts = [
        {"id": "t1", "text": "P1", "text_center_x": 1.1, "text_center_y": 2.1},
        {"id": "t2", "text": "P2", "text_center_x": 10.1, "text_center_y": 20.1},
    ]
    entries = {
        "1.0|2.0": {
            "circleCoordKey": "1.0|2.0",
            "circleX": 1.0,
            "circleY": 2.0,
            "textValue": "P1",
            "textCenterX": 1.0,
            "textCenterY": 2.0,
            "textInsertX": 1.0,
            "textInsertY": 2.0,
            "workId": "work_aaa",
        },
        "10.0|20.0": {
            "circleCoordKey": "10.0|20.0",
            "circleX": 10.0,
            "circleY": 20.0,
            "textValue": "P2",
            "textCenterX": 10.0,
            "textCenterY": 20.0,
            "textInsertX": 10.0,
            "textInsertY": 20.0,
            "workId": "work_bbb",
        },
    }
    payload = {"project": "테스트", "sourceType": "contractor_original", "entries": entries}

    with patch("backend.work_context.load_manual_history", return_value=payload):
        only_a, _ = apply_manual_history("테스트", "contractor_original", circles, texts, reference_work_id="work_aaa")
        assert only_a == {"c1": "t1"}
        both, _ = apply_manual_history("테스트", "contractor_original", circles, texts, reference_work_id=None)
        assert both == {"c1": "t1", "c2": "t2"}


def test_apply_work_defaults_clears_placeholder_building_names_not_in_building_list():
    payload = {
        "project": "영통",
        "sourceType": "contractor_original",
        "buildings": [
            {"name": "201동"},
            {"name": "202동"},
        ],
        "circles": [
            {"id": "C1", "building_name": "201동", "building_seq": 1},
            {"id": "C2", "building_name": "building_8", "building_seq": 5},
        ],
        "texts": [
            {"id": "T1", "building_name": "202동"},
            {"id": "T2", "building_name": "building_3"},
        ],
    }

    normalized = apply_work_defaults(payload)

    assert normalized["circles"][0]["building_name"] == "201동"
    assert normalized["circles"][1]["building_name"] is None
    assert normalized["circles"][1]["building_seq"] is None
    assert normalized["texts"][0]["building_name"] == "202동"
    assert normalized["texts"][1]["building_name"] is None
