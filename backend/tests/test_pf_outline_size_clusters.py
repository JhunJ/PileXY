"""P/F 윤곽 크기 군집 — construction.js splitSortedPfAreasIntoSizeClusters 와 동일 규칙."""

from __future__ import annotations


def _median(values: list[float]) -> float:
    a = sorted(v for v in values if v == v)
    if not a:
        return 0.0
    mid = len(a) // 2
    return a[mid] if len(a) % 2 else (a[mid - 1] + a[mid]) / 2


def split_sorted_pf_areas(sorted_areas: list[float], *, abs_floor: float = 0.45, rel_tol: float = 0.18):
    areas = [a for a in sorted_areas if a > 0]
    if not areas:
        return []
    clusters: list[tuple[int, int]] = []
    start = 0
    for i in range(1, len(areas)):
        med = _median(areas[start:i])
        gap = areas[i] - areas[i - 1]
        if areas[i] > med * (1 + rel_tol) and gap >= abs_floor:
            clusters.append((start, i))
            start = i
    clusters.append((start, len(areas)))
    return clusters


def test_same_size_stays_one_cluster():
    areas = [3.125] * 40
    assert split_sorted_pf_areas(areas) == [(0, 40)]


def test_two_foundation_sizes_split():
    areas = [3.125] * 20 + [5.875] * 8
    clusters = split_sorted_pf_areas(areas)
    assert clusters == [(0, 20), (20, 28)]


def test_tiny_gap_does_not_split():
    areas = [3.12, 3.125, 3.13]
    assert split_sorted_pf_areas(areas) == [(0, 3)]
