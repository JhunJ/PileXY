from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Iterable, Literal, Optional, Sequence, Tuple

import numpy as np

logger = logging.getLogger(__name__)

try:  # pragma: no cover - fallback for environments without scikit-learn
    from sklearn.cluster import DBSCAN
    from sklearn.neighbors import NearestNeighbors
except Exception:  # pragma: no cover
    DBSCAN = None  # type: ignore
    NearestNeighbors = None  # type: ignore


START_NUMBERS = {1, 2, 3}
MAX_NUMBER_GAP_FOR_SEQUENCE = 30

# 번호 패턴 기반 클러스터링 설정값
MIN_POINTS_FOR_BUILDING = 10
MAX_MISSING_RATIO = 0.3
MAX_RANGE_FOR_BUILDING = 200
MERGE_SEED_DISTANCE = 20.0  # 같은 위치의 seed를 통합하는 거리 threshold
MAX_DISTANCE_FROM_SEED = 30.0  # seed로부터 최대 거리
MAX_CLUSTER_SIZE = 500  # 클러스터 최대 크기
MAX_MISSING_COUNT = 3  # 연속으로 못 찾은 번호 개수 (중단 조건)


@dataclass
class ClusterConfig:
    dbscan_min_samples: int = 4
    dbscan_eps_factor: float = 2.5
    max_range_for_building: int = 200
    max_missing_ratio_for_building: float = 0.3
    building_min_density_quantile: float = 0.5
    merge_building_centroid_distance_factor: float = 1.5
    min_start_number_for_building: int = 5
    building_score_threshold: float = 0.6
    building_min_points: int = 80
    building_max_points: int = 200
    building_max_span_ratio: float = 0.4
    building_max_area_ratio: float = 0.25


@dataclass
class PilePoint:
    id: str
    x: float
    y: float
    label: Optional[str] = None
    number: Optional[int] = None
    layer: Optional[str] = None


@dataclass
class ClusterMetrics:
    count_points: int
    min_num: Optional[int]
    max_num: Optional[int]
    range_size: Optional[int]
    missing_count: Optional[int]
    missing_ratio: float
    density: float
    bbox_area: float
    width: float
    height: float
    min_x: float
    max_x: float
    min_y: float
    max_y: float


@dataclass
class PileCluster:
    id: str
    type: Literal["building", "parking"]
    points: list[PilePoint]
    centroid: Tuple[float, float]
    hull: list[Tuple[float, float]]
    metrics: ClusterMetrics
    score: float


@dataclass
class _ClusterCandidate:
    id: str
    points: list[PilePoint]
    centroid: Tuple[float, float]
    metrics: ClusterMetrics
    hull: list[Tuple[float, float]]
    score: float = 0.0
    cluster_type: Literal["building", "parking"] = "parking"


def cluster_piles(
    points: Sequence[PilePoint],
    config: Optional[ClusterConfig] = None,
    expected_clusters: Optional[int] = None,
    max_distance_from_seed: Optional[float] = None,
    merge_seed_distance: Optional[float] = None,
) -> list[PileCluster]:
    """
    Cluster pile coordinates into building/parking groups.
    
    우선순위:
    1. 번호 패턴 기반 클러스터링 (1,2,3 시작 + 연속 번호)
    2. 기존 DBSCAN 기반 클러스터링 (fallback)
    """
    config = config or ClusterConfig()
    if not points:
        return []
    
    # 번호 패턴 기반 클러스터링 시도
    numbered_points = [p for p in points if p.number is not None]
    if len(numbered_points) >= MIN_POINTS_FOR_BUILDING:
        try:
            number_based_clusters = _cluster_by_number_pattern(
                numbered_points,
                points,
                expected_clusters,
                config,
                max_distance_from_seed=max_distance_from_seed,
                merge_seed_distance=merge_seed_distance,
            )
            if number_based_clusters:
                logger.info(
                    "Number-based clustering produced %d building clusters",
                    sum(1 for c in number_based_clusters if c.type == "building"),
                )
                return number_based_clusters
        except Exception:
            logger.warning("Number-based clustering failed, falling back to DBSCAN", exc_info=True)
    
    # Fallback: 기존 DBSCAN 기반 클러스터링
    return _cluster_by_dbscan(points, config, expected_clusters)


def _cluster_by_number_pattern(
    numbered_points: list[PilePoint],
    all_points: Sequence[PilePoint],
    expected_clusters: Optional[int],
    config: ClusterConfig,
    max_distance_from_seed: Optional[float] = None,
    merge_seed_distance: Optional[float] = None,
) -> list[PileCluster]:
    """
    번호 패턴 기반 클러스터링 알고리즘
    
    알고리즘:
    1. 번호 1,2,3을 가진 점들을 seed 후보로 수집
    2. 공간적으로 가까운 seed 통합
    3. 각 seed에서 연속된 번호를 따라가며 클러스터 생성
    4. 클러스터 유효성 체크
    5. 동 개수 제한 적용
    """
    # 1. 전처리: 번호가 있는 점들만 사용
    points_by_number: dict[int, list[PilePoint]] = {}
    for point in numbered_points:
        if point.number is not None:
            points_by_number.setdefault(point.number, []).append(point)
    
    # 2. Seed 후보 수집 (번호 1,2,3)
    seed_candidates: list[PilePoint] = []
    for number in START_NUMBERS:
        if number in points_by_number:
            seed_candidates.extend(points_by_number[number])
    
    if not seed_candidates:
        logger.debug("No seed points found (numbers 1, 2, 3)")
        return []
    
    # 3. Seed 정리: 공간적으로 가까운 seed 통합
    merge_dist = merge_seed_distance if merge_seed_distance is not None else MERGE_SEED_DISTANCE
    seeds = _merge_close_seeds(seed_candidates, merge_dist)
    logger.debug("Merged %d seed candidates into %d seeds", len(seed_candidates), len(seeds))
    
    # 4. 각 seed 기준으로 클러스터 생성
    building_candidates: list[_ClusterCandidate] = []
    used_point_ids: set[str] = set()
    
    max_dist = max_distance_from_seed if max_distance_from_seed is not None else MAX_DISTANCE_FROM_SEED
    
    for seed_index, seed in enumerate(seeds):
        cluster_points = _grow_cluster_from_seed(
            seed, points_by_number, used_point_ids, all_points, max_dist
        )
        if cluster_points:
            candidate = _build_candidate(f"building_seed_{seed_index + 1}", cluster_points)
            used_point_ids.update(p.id for p in cluster_points)
            building_candidates.append(candidate)
    
    # 5. 클러스터 유효성 체크
    valid_buildings = [
        c for c in building_candidates
        if _is_valid_building_cluster(c, config)
    ]
    
    # 6. 동 개수 제한 적용
    if expected_clusters and expected_clusters > 0:
        valid_buildings = _select_top_buildings(valid_buildings, expected_clusters)
    
    # 7. 나머지 점들을 주차장으로 분류
    used_ids = set()
    for building in valid_buildings:
        used_ids.update(p.id for p in building.points)
    
    remaining_points = [p for p in all_points if p.id not in used_ids]
    parking_clusters: list[PileCluster] = []
    if remaining_points:
        parking_candidate = _build_candidate("parking_remaining", remaining_points)
        parking_clusters.append(
            PileCluster(
                id="parking_remaining",
                type="parking",
                points=parking_candidate.points,
                centroid=parking_candidate.centroid,
                hull=parking_candidate.hull,
                metrics=parking_candidate.metrics,
                score=0.0,
            )
        )
    
    # 8. 결과 구성
    result: list[PileCluster] = []
    for index, candidate in enumerate(valid_buildings, start=1):
        result.append(
            PileCluster(
                id=f"building_{index}",
                type="building",
                points=candidate.points,
                centroid=candidate.centroid,
                hull=candidate.hull,
                metrics=candidate.metrics,
                score=1.0,  # 번호 패턴 기반이므로 높은 점수
            )
        )
    
    result.extend(parking_clusters)
    return result


def _cluster_by_dbscan(
    points: Sequence[PilePoint],
    config: ClusterConfig,
    expected_clusters: Optional[int],
) -> list[PileCluster]:
    """기존 DBSCAN 기반 클러스터링 (fallback)"""
    coords = np.array([[point.x, point.y] for point in points], dtype=float)
    dataset_bounds = _compute_dataset_bounds(points)
    eps = max(_estimate_dbscan_eps(coords), 1.0) * config.dbscan_eps_factor
    labels = _run_dbscan(coords, eps, config.dbscan_min_samples)
    clusters_by_label: dict[int, list[PilePoint]] = {}
    for label, point in zip(labels, points):
        if label == -1:
            continue
        clusters_by_label.setdefault(label, []).append(point)
    candidates: list[_ClusterCandidate] = []
    for seq, (label, members) in enumerate(clusters_by_label.items(), start=1):
        if not members:
            continue
        candidates.append(_build_candidate(f"cluster_{seq}", members))

    noise_points = [point for label, point in zip(labels, points) if label == -1]
    if noise_points:
        candidates.append(_build_candidate("cluster_noise", noise_points))

    if not candidates:
        candidates.append(_build_candidate("cluster_1", list(points)))

    density_threshold = _density_threshold(
        (candidate.metrics.density for candidate in candidates),
        config.building_min_density_quantile,
    )
    logger.debug(
        "DBSCAN clustering: %d candidates, density threshold %.4f",
        len(candidates),
        density_threshold,
    )
    for candidate in candidates:
        candidate.score = _score_candidate(
            candidate.metrics, density_threshold, config, dataset_bounds, candidate.points
        )
        candidate.cluster_type = (
            "building" if candidate.score >= config.building_score_threshold else "parking"
        )

    building_candidates = [c for c in candidates if c.cluster_type == "building"]
    parking_candidates = [c for c in candidates if c.cluster_type != "building"]
    merge_distance = eps * config.merge_building_centroid_distance_factor
    merged_buildings = _merge_buildings(
        building_candidates, merge_distance, density_threshold, config, dataset_bounds
    )
    building_clusters, parking_clusters = _adjust_building_cluster_count(
        merged_buildings,
        parking_candidates,
        expected_clusters,
        density_threshold,
        config,
        dataset_bounds,
    )
    building_clusters = sorted(
        building_clusters,
        key=lambda cluster: (round(cluster.centroid[0], 3), -round(cluster.centroid[1], 3)),
    )
    parking_clusters = sorted(
        parking_clusters,
        key=lambda cluster: (round(cluster.centroid[0], 3), -round(cluster.centroid[1], 3)),
    )

    result: list[PileCluster] = []
    for index, cluster in enumerate(building_clusters, start=1):
        cluster_id = cluster.id if cluster.id.startswith("building") else f"building_{index}"
        result.append(
            PileCluster(
                id=cluster_id,
                type="building",
                points=cluster.points,
                centroid=cluster.centroid,
                hull=cluster.hull,
                metrics=cluster.metrics,
                score=cluster.score,
            )
        )
    for index, cluster in enumerate(parking_clusters, start=1):
        cluster_id = cluster.id if cluster.id.startswith("parking") else f"parking_{index}"
        result.append(
            PileCluster(
                id=cluster_id,
                type="parking",
                points=cluster.points,
                centroid=cluster.centroid,
                hull=cluster.hull,
                metrics=cluster.metrics,
                score=cluster.score,
            )
        )
    return result


def _estimate_dbscan_eps(coords: np.ndarray) -> float:
    if not len(coords):
        return 1.0
    if len(coords) < 2:
        return 1.0
    if NearestNeighbors is not None and len(coords) >= 2:
        neighbors = NearestNeighbors(
            n_neighbors=min(4, len(coords)), algorithm="auto"
        ).fit(coords)
        distances, _ = neighbors.kneighbors(coords)
        nearest = distances[:, 1]  # distance to the closest other point
    else:
        nearest = []
        for i in range(len(coords)):
            min_dist = math.inf
            for j in range(len(coords)):
                if i == j:
                    continue
                dx = coords[i][0] - coords[j][0]
                dy = coords[i][1] - coords[j][1]
                dist = math.hypot(dx, dy)
                if dist < min_dist:
                    min_dist = dist
            if math.isfinite(min_dist):
                nearest.append(min_dist)
        nearest = np.array(nearest or [1.0], dtype=float)
    median = float(np.median(nearest))
    if median <= 0 or not math.isfinite(median):
        span_x = float(np.max(coords[:, 0]) - np.min(coords[:, 0]) if len(coords) else 1.0)
        span_y = float(np.max(coords[:, 1]) - np.min(coords[:, 1]) if len(coords) else 1.0)
        return max(math.hypot(span_x, span_y) / max(10, len(coords)), 1.0)
    return median


def _run_dbscan(coords: np.ndarray, eps: float, min_samples: int) -> np.ndarray:
    if DBSCAN is None:
        logger.info("DBSCAN unavailable; using fallback clustering implementation.")
        return _simple_dbscan(coords, eps, min_samples)
    if len(coords) < max(min_samples, 2):
        logger.info(
            "Insufficient points for DBSCAN (%d); treating as single cluster",
            len(coords),
        )
        return np.zeros(len(coords), dtype=int)
    model = DBSCAN(eps=eps, min_samples=min_samples)
    labels = model.fit_predict(coords)
    return labels


def _build_candidate(candidate_id: str, members: list[PilePoint]) -> _ClusterCandidate:
    centroid = _compute_centroid(members)
    metrics = _compute_metrics(members)
    hull = _compute_hull(members, metrics)
    return _ClusterCandidate(candidate_id, members, centroid, metrics, hull)


def _compute_centroid(points: Sequence[PilePoint]) -> Tuple[float, float]:
    if not points:
        return 0.0, 0.0
    sx = sum(point.x for point in points)
    sy = sum(point.y for point in points)
    return sx / len(points), sy / len(points)


def _compute_metrics(points: Sequence[PilePoint]) -> ClusterMetrics:
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)
    width = max(max_x - min_x, 1.0)
    height = max(max_y - min_y, 1.0)
    bbox_area = width * height
    numbers = sorted({point.number for point in points if point.number is not None})
    min_num = numbers[0] if numbers else None
    max_num = numbers[-1] if numbers else None
    range_size = max_num - min_num + 1 if numbers else None
    missing_count = range_size - len(numbers) if range_size is not None else None
    missing_ratio = (
        (missing_count or 0) / max(range_size or 1, 1) if numbers else 1.0
    )
    density = len(points) / bbox_area if bbox_area > 0 else 0.0
    return ClusterMetrics(
        count_points=len(points),
        min_num=min_num,
        max_num=max_num,
        range_size=range_size,
        missing_count=missing_count,
        missing_ratio=missing_ratio,
        density=density,
        bbox_area=bbox_area,
        width=width,
        height=height,
        min_x=min_x,
        max_x=max_x,
        min_y=min_y,
        max_y=max_y,
    )


def _compute_dataset_bounds(points: Sequence[PilePoint]) -> dict:
    if not points:
        return {"min_x": 0.0, "max_x": 0.0, "min_y": 0.0, "max_y": 0.0, "width": 0.0, "height": 0.0, "area": 0.0}
    xs = [point.x for point in points]
    ys = [point.y for point in points]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)
    width = max(max_x - min_x, 0.0)
    height = max(max_y - min_y, 0.0)
    area = width * height
    return {
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "width": width,
        "height": height,
        "area": area,
    }


def _compute_hull(
    points: Sequence[PilePoint], metrics: ClusterMetrics
) -> list[Tuple[float, float]]:
    coords = [(point.x, point.y) for point in points]
    if len(coords) >= 3:
        return _convex_hull(coords)
    padding = max(metrics.width, metrics.height, 1.0) * 0.1
    return [
        (metrics.min_x - padding, metrics.min_y - padding),
        (metrics.max_x + padding, metrics.min_y - padding),
        (metrics.max_x + padding, metrics.max_y + padding),
        (metrics.min_x - padding, metrics.max_y + padding),
    ]


def _convex_hull(points: Iterable[Tuple[float, float]]) -> list[Tuple[float, float]]:
    unique = sorted(set(points))
    if len(unique) <= 1:
        return unique

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[Tuple[float, float]] = []
    for point in unique:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)

    upper: list[Tuple[float, float]] = []
    for point in reversed(unique):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)

    hull = lower[:-1] + upper[:-1]
    return hull or unique


def _density_threshold(values: Iterable[float], quantile: float) -> float:
    densities = [value for value in values if math.isfinite(value) and value > 0]
    if not densities:
        return 0.0
    q = min(max(quantile, 0.0), 1.0)
    return float(np.quantile(densities, q))


def _count_start_numbers(points: Sequence[PilePoint]) -> int:
    return sum(1 for point in points if point.number in START_NUMBERS)


def _score_candidate(
    metrics: ClusterMetrics,
    density_threshold: float,
    config: ClusterConfig,
    dataset_bounds: dict,
    points: Sequence[PilePoint],
) -> float:
    if metrics.count_points < config.building_min_points:
        return 0.0
    if metrics.count_points > config.building_max_points:
        return 0.0
    if _count_start_numbers(points) == 0:
        return 0.0
    dataset_width = dataset_bounds["width"]
    dataset_height = dataset_bounds["height"]
    dataset_area = dataset_bounds["area"]
    if dataset_width > 0 and metrics.width > dataset_width * config.building_max_span_ratio:
        return 0.0
    if dataset_height > 0 and metrics.height > dataset_height * config.building_max_span_ratio:
        return 0.0
    if dataset_area > 0 and metrics.bbox_area > dataset_area * config.building_max_area_ratio:
        return 0.0
    score_components = []
    if metrics.min_num is not None:
        score_components.append(
            1.0 if metrics.min_num <= config.min_start_number_for_building else 0.0
        )
    if metrics.range_size is not None:
        score_components.append(
            1.0 if metrics.range_size <= config.max_range_for_building else 0.0
        )
    score_components.append(
        1.0 if metrics.missing_ratio <= config.max_missing_ratio_for_building else 0.0
    )
    if density_threshold > 0.0:
        score_components.append(
            1.0 if metrics.density >= density_threshold else 0.0
        )
    if not score_components:
        return 0.0
    return sum(score_components) / len(score_components)


def _merge_buildings(
    candidates: Sequence[_ClusterCandidate],
    max_distance: float,
    density_threshold: float,
    config: ClusterConfig,
    dataset_bounds: dict,
) -> list[_ClusterCandidate]:
    if not candidates:
        return []
    if len(candidates) == 1:
        return list(candidates)
    visited: set[int] = set()
    merged: list[_ClusterCandidate] = []
    for index, candidate in enumerate(candidates):
        if index in visited:
            continue
        group_points = list(candidate.points)
        visited.add(index)
        queue = [index]
        while queue:
            current = queue.pop()
            for other_index, other in enumerate(candidates):
                if other_index in visited:
                    continue
                if _centroid_distance(candidates[current], other) <= max_distance:
                    visited.add(other_index)
                    queue.append(other_index)
                    group_points.extend(other.points)
        merged_candidate = _build_candidate(
            f"building_{len(merged) + 1}", group_points
        )
        merged_candidate.score = _score_candidate(
            merged_candidate.metrics,
            density_threshold,
            config,
            dataset_bounds,
            merged_candidate.points,
        )
        merged_candidate.cluster_type = "building"
        logger.debug(
            "Merged building cluster %s: %d points, score=%.2f",
            merged_candidate.id,
            merged_candidate.metrics.count_points,
            merged_candidate.score,
        )
        merged.append(merged_candidate)
    return merged


def _centroid_distance(a: _ClusterCandidate, b: _ClusterCandidate) -> float:
    return math.hypot(a.centroid[0] - b.centroid[0], a.centroid[1] - b.centroid[1])


def _simple_dbscan(coords: np.ndarray, eps: float, min_samples: int) -> np.ndarray:
    if len(coords) == 0:
        return np.array([], dtype=int)
    labels = np.full(len(coords), -1, dtype=int)
    visited = np.zeros(len(coords), dtype=bool)
    cluster_id = 0

    for index in range(len(coords)):
        if visited[index]:
            continue
        visited[index] = True
        neighbors = _neighbors_within(coords, index, eps)
        if len(neighbors) < min_samples:
            continue
        labels[index] = cluster_id
        seeds = set(neighbors)
        seeds.discard(index)
        while seeds:
            current = seeds.pop()
            if not visited[current]:
                visited[current] = True
                current_neighbors = _neighbors_within(coords, current, eps)
                if len(current_neighbors) >= min_samples:
                    seeds.update(current_neighbors)
            if labels[current] == -1:
                labels[current] = cluster_id
        cluster_id += 1
    if cluster_id == 0:
        return np.zeros(len(coords), dtype=int)
    return labels


def _neighbors_within(coords: np.ndarray, index: int, eps: float) -> list[int]:
    diffs = coords - coords[index]
    distances = np.sqrt(np.sum(diffs * diffs, axis=1))
    return [idx for idx, distance in enumerate(distances) if distance <= eps]


def _adjust_building_cluster_count(
    buildings: Sequence[_ClusterCandidate],
    parking: Sequence[_ClusterCandidate],
    expected_clusters: Optional[int],
    density_threshold: float,
    config: ClusterConfig,
    dataset_bounds: dict,
) -> tuple[list[_ClusterCandidate], list[_ClusterCandidate]]:
    building_list = list(buildings)
    parking_list = list(parking)
    if not expected_clusters or expected_clusters <= 0:
        return building_list, parking_list
    if building_list:
        logger.debug(
            "Initial building clusters: %d, expected: %d",
            len(building_list),
            expected_clusters,
        )
    if len(building_list) > expected_clusters:
        building_list.sort(
            key=lambda cluster: (
                _count_start_numbers(cluster.points),
                cluster.score,
                cluster.metrics.count_points,
            ),
            reverse=True,
        )
        keep = building_list[:expected_clusters]
        demoted = building_list[expected_clusters:]
        for item in demoted:
            item.cluster_type = "parking"
            parking_list.append(item)
        building_list = keep
    if len(building_list) < expected_clusters:
        index = 0
        while (
            index < len(building_list) and len(building_list) < expected_clusters
        ):
            candidate = building_list[index]
            splits = _split_candidate_by_number_resets(
                candidate,
                expected_clusters - len(building_list) + 1,
                density_threshold,
                config,
                dataset_bounds,
            )
            if len(splits) <= 1:
                index += 1
                continue
            building_list.pop(index)
            inserted = 0
            for split in splits:
                if split.cluster_type == "building":
                    building_list.insert(index, split)
                    index += 1
                    inserted += 1
                else:
                    parking_list.append(split)
            if inserted == 0:
                # No valid building splits; prevent infinite loop
                index += 1
        if len(building_list) < expected_clusters:
            logger.debug(
                "Could not reach expected buildings (%d vs %d).",
                len(building_list),
                expected_clusters,
            )
    return building_list, parking_list


def _split_candidate_by_number_resets(
    candidate: _ClusterCandidate,
    limit: int,
    density_threshold: float,
    config: ClusterConfig,
    dataset_bounds: dict,
) -> list[_ClusterCandidate]:
    if limit <= 0:
        return [candidate]
    numbered = [point for point in candidate.points if point.number is not None]
    if len(numbered) < config.building_min_points:
        return [candidate]
    numbered.sort(key=lambda point: (point.number or 0, point.id))
    segments: list[list[str]] = []
    current: list[str] = []
    prev_num: Optional[int] = None
    for point in numbered:
        number = point.number
        if number is None:
            continue
        if not current:
            current.append(point.id)
            prev_num = number
            continue
        reset = False
        if number in START_NUMBERS and prev_num is not None and prev_num >= 5:
            reset = True
        elif prev_num is not None and number < prev_num:
            reset = True
        elif prev_num is not None and abs(number - prev_num) > MAX_NUMBER_GAP_FOR_SEQUENCE:
            reset = True
        if reset:
            segments.append(current)
            current = [point.id]
        else:
            current.append(point.id)
        prev_num = number
    if current:
        segments.append(current)
    if len(segments) <= 1:
        return [candidate]
    remaining_points = list(candidate.points)
    new_candidates: list[_ClusterCandidate] = []
    used_segments = 0
    for seq_index, seq_ids in enumerate(segments):
        if used_segments >= limit:
            break
        selected_points, remaining_points = _extract_segment_points(seq_ids, remaining_points)
        if not selected_points:
            continue
        new_candidate = _build_candidate(
            f"{candidate.id}_seq{seq_index + 1}",
            selected_points,
        )
        new_candidate.score = _score_candidate(
            new_candidate.metrics,
            density_threshold,
            config,
            dataset_bounds,
            new_candidate.points,
        )
        new_candidate.cluster_type = (
            "building" if new_candidate.score >= config.building_score_threshold else "parking"
        )
        new_candidates.append(new_candidate)
        used_segments += 1
    if remaining_points:
        residual = _build_candidate(f"{candidate.id}_residual", remaining_points)
        residual.score = _score_candidate(
            residual.metrics,
            density_threshold,
            config,
            dataset_bounds,
            residual.points,
        )
        residual.cluster_type = (
            "building" if residual.score >= config.building_score_threshold else "parking"
        )
        new_candidates.append(residual)
    return new_candidates if new_candidates else [candidate]


def _extract_segment_points(
    segment_ids: Sequence[str], points: Sequence[PilePoint]
) -> tuple[list[PilePoint], list[PilePoint]]:
    selected: list[PilePoint] = []
    remaining: list[PilePoint] = []
    selected_numbers: list[int] = []
    id_set = set(segment_ids)
    for point in points:
        if point.id in id_set:
            selected.append(point)
            if point.number is not None:
                selected_numbers.append(point.number)
        else:
            remaining.append(point)
    if not selected_numbers:
        return [], list(points)
    min_num = min(selected_numbers)
    max_num = max(selected_numbers)
    final_selected = list(selected)
    final_remaining: list[PilePoint] = []
    for point in remaining:
        number = point.number
        if number is not None and min_num <= number <= max_num:
            final_selected.append(point)
        else:
            final_remaining.append(point)
    return final_selected, final_remaining


def _merge_close_seeds(seeds: list[PilePoint], max_distance: float) -> list[PilePoint]:
    """
    공간적으로 가까운 seed들을 통합합니다.
    
    같은 위치나 매우 가까운 위치에 있는 1,2,3 번호의 seed는 하나로 통합합니다.
    """
    if not seeds:
        return []
    
    merged: list[PilePoint] = []
    used: set[int] = set()
    
    for i, seed in enumerate(seeds):
        if i in used:
            continue
        
        # 이 seed와 가까운 다른 seed들을 찾아서 그룹화
        group = [seed]
        used.add(i)
        
        for j, other in enumerate(seeds):
            if j in used or j == i:
                continue
            
            distance = math.hypot(seed.x - other.x, seed.y - other.y)
            if distance <= max_distance:
                group.append(other)
                used.add(j)
        
        # 그룹의 중심점을 seed로 사용
        if len(group) == 1:
            merged.append(group[0])
        else:
            # 여러 seed가 가까이 있으면 중심점 계산
            avg_x = sum(p.x for p in group) / len(group)
            avg_y = sum(p.y for p in group) / len(group)
            # 가장 가까운 점을 대표 seed로 선택
            closest = min(group, key=lambda p: math.hypot(p.x - avg_x, p.y - avg_y))
            merged.append(closest)
    
    return merged


def _grow_cluster_from_seed(
    seed: PilePoint,
    points_by_number: dict[int, list[PilePoint]],
    used_point_ids: set[str],
    all_points: Sequence[PilePoint],
    max_distance: float = MAX_DISTANCE_FROM_SEED,
) -> list[PilePoint]:
    """
    Seed에서 시작해서 연속된 번호를 따라가며 클러스터를 생성합니다.
    
    알고리즘:
    1. seed의 번호를 start_no로 설정
    2. current_no = start_no부터 시작
    3. while 루프로 다음 번호들을 찾아감:
       - current_no를 가진 pile들 중 seed와 가까운 순서대로 정렬
       - 아직 사용되지 않은 pile 중 seed와의 거리가 threshold 이하인 것 선택
       - 가장 가까운 pile 하나를 클러스터에 추가
       - current_no += 1
    4. 중단 조건:
       - 해당 번호를 가진 pile이 없거나
       - 연속해서 MAX_MISSING_COUNT번 못 찾았을 때
       - 클러스터 크기가 MAX_CLUSTER_SIZE 초과
    """
    cluster_points: list[PilePoint] = []
    if seed.id in used_point_ids:
        return cluster_points
    
    # seed의 번호 확인
    start_no = seed.number
    if start_no is None or start_no not in START_NUMBERS:
        return cluster_points
    
    cluster_points.append(seed)
    used_point_ids.add(seed.id)
    
    current_no = start_no
    missing_count = 0
    
    while missing_count < MAX_MISSING_COUNT and len(cluster_points) < MAX_CLUSTER_SIZE:
        current_no += 1
        
        # 해당 번호를 가진 pile들 찾기
        candidates = points_by_number.get(current_no, [])
        if not candidates:
            missing_count += 1
            continue
        
        # 아직 사용되지 않고 seed와 가까운 pile 찾기
        available = [
            p for p in candidates
            if p.id not in used_point_ids
        ]
        
        if not available:
            missing_count += 1
            continue
        
        # seed와의 거리 계산 및 정렬
        distances = [
            (p, math.hypot(p.x - seed.x, p.y - seed.y))
            for p in available
        ]
        distances.sort(key=lambda x: x[1])
        
        # threshold 이내의 가장 가까운 pile 선택
        selected = None
        for point, distance in distances:
            if distance <= max_distance:
                selected = point
                break
        
        if selected:
            cluster_points.append(selected)
            used_point_ids.add(selected.id)
            missing_count = 0  # 찾았으므로 누락 카운트 리셋
        else:
            missing_count += 1
    
    return cluster_points


def _is_valid_building_cluster(candidate: _ClusterCandidate, config: ClusterConfig) -> bool:
    """
    클러스터가 유효한 동(건물)인지 판정합니다.
    
    조건:
    - count_points >= MIN_POINTS_FOR_BUILDING
    - missing_ratio <= MAX_MISSING_RATIO
    - range_size <= MAX_RANGE_FOR_BUILDING
    """
    metrics = candidate.metrics
    
    # 최소 점 개수 체크
    if metrics.count_points < MIN_POINTS_FOR_BUILDING:
        return False
    
    # 누락률 체크
    if metrics.missing_ratio > MAX_MISSING_RATIO:
        return False
    
    # 범위 크기 체크
    if metrics.range_size is not None and metrics.range_size > MAX_RANGE_FOR_BUILDING:
        return False
    
    return True


def _select_top_buildings(
    buildings: list[_ClusterCandidate],
    expected_count: int,
) -> list[_ClusterCandidate]:
    """
    동 개수 제한에 맞게 상위 N개 동을 선택합니다.
    
    정렬 기준:
    1. count_points (점 개수)
    2. range_size (번호 범위)
    """
    if len(buildings) <= expected_count:
        return buildings
    
    # 점 개수와 범위 크기를 기준으로 정렬
    sorted_buildings = sorted(
        buildings,
        key=lambda c: (
            c.metrics.count_points,
            c.metrics.range_size or 0,
        ),
        reverse=True,
    )
    
    return sorted_buildings[:expected_count]
