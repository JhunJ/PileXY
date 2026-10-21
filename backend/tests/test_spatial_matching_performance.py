import random

import pytest

from backend.main import (GRID_CELL_SIZE, build_text_spatial_index,
                          gather_text_candidates, build_duplicate_groups, _circles_overlap)


@pytest.mark.parametrize('reference', ['center', 'insert'])
def test_nearby_candidates_match_legacy_including_ties_and_empty_neighborhood(reference):
    rng = random.Random(71)
    texts = [dict(id=str(i), text_center_x=rng.uniform(-800, 800),
                  text_center_y=rng.uniform(-800, 800), insert_x=rng.uniform(-800, 800),
                  insert_y=rng.uniform(-800, 800)) for i in range(600)]
    texts += [dict(id=f'tie{i}', text_center_x=x, text_center_y=y, insert_x=x, insert_y=y)
              for i, (x, y) in enumerate([(1, 0), (-1, 0), (0, -1), (0, 1)])]
    for distance in (1, 10, GRID_CELL_SIZE):
        index = build_text_spatial_index(texts, GRID_CELL_SIZE, reference)
        nearby = build_text_spatial_index(texts, distance, reference)
        order = {t['id']: i for i, t in enumerate(texts)}
        for x, y in [(0, 0), (400, 400), (-400, -400), (10000, 10000)]:
            circle = dict(center_x=x, center_y=y)
            old = gather_text_candidates(circle, index, texts, distance, reference)
            new = gather_text_candidates(circle, index, texts, distance, reference,
                                         nearby_index=nearby, text_order=order)
            assert new == old


def test_overlap_sweep_matches_all_pairs_with_varying_radii_and_chains():
    rng = random.Random(81)
    circles = [dict(id=str(i), center_x=rng.uniform(-20, 20), center_y=rng.uniform(-20, 20),
                    radius=rng.choice([0, .3, 1, 5]), layer='PILE') for i in range(200)]
    circles += [dict(id=f'chain{i}', center_x=i, center_y=100, radius=.5, layer='PILE') for i in range(8)]
    components = [{c['id']} for c in circles]
    for i, a in enumerate(circles):
        for b in circles[i+1:]:
            if _circles_overlap(a, b):
                ca = next(c for c in components if a['id'] in c)
                cb = next(c for c in components if b['id'] in c)
                if ca is not cb:
                    ca.update(cb)
                    components.remove(cb)
    expected = {frozenset(c) for c in components if len(c) > 1}
    assert {frozenset(g.circle_ids) for g in build_duplicate_groups(circles)} == expected
