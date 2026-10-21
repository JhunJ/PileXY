import asyncio
import pytest
from backend import main
from backend.models import BuildingApplyRequest, FilterSettings


@pytest.mark.parametrize('kind', ['building', 'parking', 'tower_crane'])
@pytest.mark.parametrize('stale_filter', [False, True])
def test_saved_work_area_apply_uses_client_filter_in_new_or_stale_session(kind, stale_filter):
    filters = FilterSettings(min_diameter=.2, max_diameter=.55,
        text_height_min=.2, text_height_max=.5, max_match_distance=2)
    ws = main.CircleWorkspace()
    if stale_filter:
        ws.current_filters = FilterSettings(min_diameter=.5, max_diameter=.65,
            text_height_min=.4, text_height_max=1.1, max_match_distance=2)
    token = main._circle_workspace_ctx.set(ws)
    try:
        request = BuildingApplyRequest(
            buildings=[{'name': 'Test', 'kind': kind, 'vertices': [
                {'x': 0, 'y': 0}, {'x': 3, 'y': 0}, {'x': 3, 'y': 3}, {'x': 0, 'y': 3}]}],
            circles=[{'id': 'C1', 'center_x': 1, 'center_y': 1, 'radius': .2}],
            texts=[{'id': 'T1', 'text': '1', 'center_x': 1, 'center_y': 1,
                    'insert_x': 1, 'insert_y': 1, 'height': .3}],
            manual_overrides={}, filter=filters)
        result = asyncio.run(main.assign_buildings(request))
        assert len(result.circles) == 1
        assert len(result.texts) == 1
        assert result.circles[0].center_x == 1
        assert result.circles[0].center_y == 1
        assert result.circles[0].building_name == 'Test'
        assert result.filter == filters
    finally:
        main._circle_workspace_ctx.reset(token)
