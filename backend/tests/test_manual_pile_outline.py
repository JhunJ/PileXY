import copy

import pytest
from fastapi import HTTPException
from shapely.geometry import Point, Polygon

from backend.manual_pile_outline import OutlineRequest, prepare_outline, preview_manual_pile_outline


def request_data(point=(12, 5), existing=()):
    return dict(
        buildings=[dict(name="101동", kind="building", vertices=[
            dict(x=0, y=0), dict(x=10, y=0), dict(x=10, y=10), dict(x=0, y=10)
        ])], target_index=0, point=dict(x=point[0], y=point[1]), radius=0.3,
        existing_points=[dict(id=str(i), x=x, y=y) for i, (x, y) in enumerate(existing)],
    )


def test_expansion_contains_pile_and_original_without_broad_convex_hull():
    payload = OutlineRequest(**request_data(existing=[(5, 5), (11, 8), (11, 2)]))
    original = copy.deepcopy(payload)
    result = prepare_outline(payload)
    polygon = Polygon([(v['x'], v['y']) for v in result['vertices']])
    assert result['expanded']
    assert polygon.covers(Point(12, 5).buffer(0.3))
    assert polygon.covers(Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]))
    assert not polygon.covers(Point(11, 8))
    assert len(result['vertices']) <= 18  # A compact local arc plus its narrow connector.
    assert polygon.area - 100 < .7
    # Even empty space away from the new pile must not become a broad wedge.
    assert not polygon.covers(Point(10.5, 6))
    assert payload == original  # Preview never mutates the request/work data.


def test_local_round_extension_avoids_neighbour_captured_by_full_edge():
    result = prepare_outline(OutlineRequest(**request_data(existing=[(11, 7)])))
    polygon = Polygon([(v['x'], v['y']) for v in result['vertices']])
    assert polygon.covers(Point(12, 5).buffer(.3))
    assert not polygon.covers(Point(11, 7))
    assert len(result['vertices']) <= 18


def test_long_edge_does_not_inflate_added_area():
    data = request_data()
    data['buildings'][0]['vertices'] = [dict(x=x, y=y) for x, y in
                                       [(0, -100), (10, -100), (10, 100), (0, 100)]]
    result = prepare_outline(OutlineRequest(**data))
    polygon = Polygon([(v['x'], v['y']) for v in result['vertices']])
    assert polygon.area - 2000 < .7
    assert polygon.covers(Point(12, 5).buffer(.3))
    assert not polygon.covers(Point(10.5, 6))


@pytest.mark.parametrize('existing', [[(11, 5)], [(12, 5.2)]])
def test_capture_of_any_existing_coordinate_or_text_blocks_addition(existing):
    with pytest.raises(ValueError, match='기존 좌표·번호'):
        prepare_outline(OutlineRequest(**request_data(existing=existing)))


def test_inside_pile_keeps_outline():
    assert prepare_outline(OutlineRequest(**request_data(point=(5, 5))))['expanded'] is False


def test_boundary_pile_is_fully_included():
    result = prepare_outline(OutlineRequest(**request_data(point=(10, 5))))
    assert Polygon([(v['x'], v['y']) for v in result['vertices']]).covers(Point(10, 5).buffer(0.3))


def test_higher_priority_area_blocks_selected_building():
    data = request_data(point=(5, 5))
    data['buildings'].append(dict(name='T1', kind='tower_crane', vertices=data['buildings'][0]['vertices']))
    with pytest.raises(ValueError, match='T1'):
        prepare_outline(OutlineRequest(**data))


def test_self_intersecting_outline_rejected():
    data = request_data()
    data['buildings'][0]['vertices'] = [dict(x=x, y=y) for x, y in [(0, 0), (10, 10), (0, 10), (10, 0)]]
    with pytest.raises(ValueError, match='교차'):
        prepare_outline(OutlineRequest(**data))


def test_microscopic_crossing_is_repaired_without_changing_existing_points():
    data = request_data(existing=[(5, 5), (11, 8)])
    # Almost-collinear reversed vertices form a negligible crossing sliver.
    data['buildings'][0]['vertices'] = [dict(x=x, y=y) for x, y in
        [(0, 0), (10, 0), (10, 10), (5, 10), (5.00001, 10.00001), (5.00001, 10), (0, 10)]]
    assert not Polygon([(v['x'], v['y']) for v in data['buildings'][0]['vertices']]).is_valid
    result = prepare_outline(OutlineRequest(**data))
    assert result['repaired']
    polygon = Polygon([(v['x'], v['y']) for v in result['vertices']])
    assert polygon.is_valid
    assert polygon.covers(Point(5, 5))
    assert not polygon.covers(Point(11, 8))


def test_http_validation_failure_is_actionable_and_stateless():
    with pytest.raises(HTTPException) as error:
        preview_manual_pile_outline(OutlineRequest(**request_data(existing=[(11, 5)])))
    assert error.value.status_code == 400
    assert '추가하지 않았습니다' in error.value.detail
