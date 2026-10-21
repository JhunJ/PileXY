from __future__ import annotations

import asyncio
import copy

import pytest

from backend import main
from backend.models import ApplyFilterRequest, BuildingDefinition


def _circle(circle_id="C1", *, x=2.0, y=2.0, override="102동") -> dict:
    return {
        "id": circle_id,
        "center_x": x,
        "center_y": y,
        "center_z": 0.0,
        "radius": 0.3,
        "diameter": 0.6,
        "layer": "PILE",
        "building_name_override": override,
    }


def _text(text_id="manual_label_C1", *, label="T4-1", height=0.6) -> dict:
    return {
        "id": text_id,
        "text": label,
        "text_center_x": 2.0,
        "text_center_y": 2.0,
        "center_x": 2.0,
        "center_y": 2.0,
        "insert_x": 2.0,
        "insert_y": 2.0,
        "insert_z": 0.0,
        "height": height,
        "layer": "MANUAL",
        "type": "TEXT",
    }


def _building(name="101동", *, kind="building", vertices=True) -> BuildingDefinition:
    return BuildingDefinition(
        name=name,
        kind=kind,
        vertices=[{"x": 0, "y": 0}, {"x": 10, "y": 0},
                  {"x": 10, "y": 10}, {"x": 0, "y": 10}] if vertices else [],
    )


@pytest.fixture(autouse=True)
def isolated_workspace():
    token = main._circle_workspace_ctx.set(main.CircleWorkspace())
    try:
        yield
    finally:
        main._circle_workspace_ctx.reset(token)


def _request(*, override="102동", height=0.6, max_diameter=0.65) -> ApplyFilterRequest:
    return ApplyFilterRequest(
        circles=[_circle(override=override)],
        texts=[_text(height=height)],
        buildings=[_building(), _building("102동", vertices=False)],
        manual_overrides={"C1": "manual_label_C1"},
        min_diameter=0.5,
        max_diameter=max_diameter,
        text_height_min=0.5,
        text_height_max=1.1,
        max_match_distance=2.0,
    )


def test_apply_filter_keeps_edited_number_and_explicit_building_without_changing_geometry():
    request = _request()
    before = copy.deepcopy(request.circles)

    result = asyncio.run(main.apply_filter_to_circles(request))

    pile = result.circles[0]
    assert pile.building_name == "102동"
    assert pile.building_name_override == "102동"
    assert pile.matched_text.text == "T4-1"
    assert pile.manual_match is True
    assert result.texts[0].building_name == "102동"
    assert (pile.id, pile.center_x, pile.center_y, pile.radius, pile.diameter) == (
        "C1", 2.0, 2.0, 0.3, 0.6
    )
    assert request.circles == before
    summary = {row.name: row for row in result.building_summary}
    assert summary["102동"].circle_count == 1
    assert summary["102동"].text_count == 1
    assert summary["101동"].circle_count == 0


def test_saved_work_rehydrate_round_trip_keeps_edit_and_does_not_mutate_payload():
    result = asyncio.run(main.apply_filter_to_circles(_request()))
    payload = {
        "id": "in_memory_edit",
        "title": "Selected pile edit",
        "project": "기본",
        "sourceType": "contractor_original",
        "circles": [row.model_dump() for row in result.circles],
        "texts": [row.model_dump() for row in result.texts],
        "buildings": [row.model_dump() for row in result.buildings],
        "filter": main._serialize_filter_for_saved_work(result.filter),
        "manualOverrides": {"C1": "manual_label_C1"},
        "buildingCount": 2,
    }
    before = copy.deepcopy(payload)

    restored = main._rehydrate_saved_work_payload(payload)

    assert payload == before
    assert restored["circles"][0]["building_name_override"] == "102동"
    assert restored["circles"][0]["building_name"] == "102동"
    assert restored["circles"][0]["matched_text"]["text"] == "T4-1"
    assert restored["circles"][0]["manual_match"] is True
    assert restored["texts"][0]["building_name"] == "102동"
    assert restored["buildings"][1]["vertices"] == []


@pytest.mark.parametrize("override", [None, "", "deleted-building", "   "])
def test_missing_empty_or_deleted_override_falls_back_to_automatic_geometry(override):
    result = asyncio.run(main.apply_filter_to_circles(_request(override=override)))
    assert result.circles[0].building_name == "101동"
    assert result.circles[0].building_name_override == override
    assert result.texts[0].building_name == "101동"


def test_override_assigns_circle_and_private_label_when_no_polygons_exist():
    circles = [_circle()]
    circles[0]["matched_text_id"] = "manual_label_C1"
    texts = [_text()]

    main.classify_entities(circles, texts, [_building("102동", vertices=False)])

    assert circles[0]["building_name"] == "102동"
    assert circles[0]["building_seq"] == 1
    assert texts[0]["building_name"] == "102동"


def test_shared_text_keeps_automatic_building_when_one_owner_has_an_override():
    circles = [_circle(), _circle("C2", x=2.5, override=None)]
    for circle in circles:
        circle["matched_text_id"] = "shared"
    texts = [_text("shared")]
    texts[0]["matched_circle_ids"] = ["C1", "C2"]

    main.classify_entities(circles, texts, [_building(), _building("102동", vertices=False)])

    assert circles[0]["building_name"] == "102동"
    assert circles[1]["building_name"] == "101동"
    assert texts[0]["building_name"] == "101동"


def test_text_with_additional_link_does_not_follow_single_visible_owner_override():
    circles = [_circle()]
    circles[0]["matched_text_id"] = "shared"
    texts = [_text("shared")]
    texts[0]["matched_circle_ids"] = ["C1", "hidden_other_circle"]

    main.classify_entities(circles, texts, [_building(), _building("102동", vertices=False)])

    assert circles[0]["building_name"] == "102동"
    assert texts[0]["building_name"] == "101동"


@pytest.mark.parametrize("override", [None, ""])
def test_automatic_tower_building_parking_priority_is_unchanged(override):
    parking = _building("B2", kind="parking")
    building = _building()
    tower = _building("T1", kind="tower_crane")
    circles = [_circle(override=override)]
    texts = [_text()]
    main.classify_entities(circles, texts, [parking, building, tower])
    assert circles[0]["building_name"] == "T1"
    assert texts[0]["building_name"] == "T1"
    main.classify_entities(circles, texts, [parking, building])
    assert circles[0]["building_name"] == "101동"
    main.classify_entities(circles, texts, [parking])
    assert circles[0]["building_name"] == "B2"


def test_edited_label_survives_text_height_filter_change():
    result = asyncio.run(main.apply_filter_to_circles(_request(height=0.1)))
    assert result.circles[0].matched_text.text == "T4-1"
    assert result.circles[0].manual_match is True
    assert result.texts[0].id == "manual_label_C1"


def test_manual_label_does_not_bypass_circle_diameter_filter():
    result = asyncio.run(main.apply_filter_to_circles(_request(height=0.1, max_diameter=0.55)))
    assert result.circles == []
    assert result.texts == []


def test_unpinned_text_still_uses_text_height_filter():
    request = _request(height=0.1)
    request.manual_overrides = {}
    result = asyncio.run(main.apply_filter_to_circles(request))
    assert result.circles[0].matched_text is None
    assert result.texts == []


@pytest.mark.parametrize("second_locked", [False, True])
def test_editing_one_circle_with_shared_label_preserves_other_circle_after_filter_and_load(second_locked):
    circles = [_circle(override=None), _circle("C2", x=2.5, override=None)]
    old_text = _text("shared-original", label="12")
    old_text["matched_circle_ids"] = ["C1", "C2"]
    for circle in circles:
        circle["matched_text_id"] = old_text["id"]
        circle["matched_text"] = copy.deepcopy(old_text)

    # The frontend gives the selected circle a private label and removes only
    # its link from the shared original; the other circle and label stay intact.
    edited_text = _text("manual-text-edit-new", label="T4-1")
    edited_text["matched_circle_ids"] = ["C1"]
    circles[0]["matched_text_id"] = edited_text["id"]
    circles[0]["matched_text"] = copy.deepcopy(edited_text)
    circles[0]["building_name_override"] = "102동"
    circles[0]["manual_match"] = True
    old_text["matched_circle_ids"] = ["C2"]
    manual_overrides = {"C1": edited_text["id"]}
    if second_locked:
        manual_overrides["C2"] = old_text["id"]

    request = _request()
    request.circles = circles
    request.texts = [old_text, edited_text]
    request.manual_overrides = manual_overrides
    result = asyncio.run(main.apply_filter_to_circles(request))
    filtered = {circle.id: circle for circle in result.circles}
    assert filtered["C1"].matched_text_id == "manual-text-edit-new"
    assert filtered["C1"].matched_text.text == "T4-1"
    assert filtered["C1"].building_name == "102동"
    assert filtered["C2"].matched_text_id == "shared-original"
    assert filtered["C2"].matched_text.text == "12"
    assert filtered["C2"].building_name == "101동"

    restored = main._rehydrate_saved_work_payload({
        "id": "shared_label_edit_in_memory",
        "title": "Shared label edit",
        "project": "기본",
        "sourceType": "contractor_original",
        "circles": [circle.model_dump() for circle in result.circles],
        "texts": [text.model_dump() for text in result.texts],
        "buildings": [building.model_dump() for building in result.buildings],
        "filter": main._serialize_filter_for_saved_work(result.filter),
        "manualOverrides": manual_overrides,
    })
    loaded = {circle["id"]: circle for circle in restored["circles"]}
    assert loaded["C1"]["matched_text_id"] == "manual-text-edit-new"
    assert loaded["C1"]["matched_text"]["text"] == "T4-1"
    assert loaded["C1"]["building_name"] == "102동"
    assert loaded["C1"]["building_name_override"] == "102동"
    assert loaded["C2"]["matched_text_id"] == "shared-original"
    assert loaded["C2"]["matched_text"]["text"] == "12"
    assert loaded["C2"]["building_name"] == "101동"
    assert loaded["C2"]["building_name_override"] is None
