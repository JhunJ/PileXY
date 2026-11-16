from backend.pile_clustering import ClusterConfig, PilePoint, cluster_piles


def _sequence(prefix: str, count: int, x: float = 0.0) -> list[PilePoint]:
    return [
        PilePoint(
            id=f"{prefix}_{number}",
            x=x + ((number - 1) % 3) * 0.5,
            y=((number - 1) // 3) * 0.5,
            label=str(number),
            number=number,
        )
        for number in range(1, count + 1)
    ]


def test_default_ten_pile_building_keeps_number_one():
    points = _sequence("building", 10)

    clusters = cluster_piles(points, expected_clusters=1)
    buildings = [cluster for cluster in clusters if cluster.type == "building"]

    assert len(buildings) == 1
    assert {point.id for point in buildings[0].points} == {point.id for point in points}
    assert not [cluster for cluster in clusters if cluster.type == "parking"]


def test_small_explicit_minimum_allows_five_pile_building():
    points = _sequence("small", 5)

    clusters = cluster_piles(points, ClusterConfig(building_min_points=5), expected_clusters=1)
    buildings = [cluster for cluster in clusters if cluster.type == "building"]

    assert len(buildings) == 1
    assert {point.id for point in buildings[0].points} == {point.id for point in points}


def test_small_building_minimum_and_default_threshold_still_apply():
    below_explicit = cluster_piles(_sequence("below", 4), ClusterConfig(building_min_points=5))
    below_default = cluster_piles(_sequence("default", 8))

    assert all(cluster.type == "parking" for cluster in below_explicit)
    assert all(cluster.type == "parking" for cluster in below_default)


def test_separate_small_buildings_each_keep_their_own_number_one():
    first = _sequence("first", 5)
    second = _sequence("second", 5, x=200.0)

    clusters = cluster_piles(first + second, ClusterConfig(building_min_points=5), expected_clusters=2)
    buildings = [cluster for cluster in clusters if cluster.type == "building"]

    assert len(buildings) == 2
    assert {frozenset(point.id for point in cluster.points) for cluster in buildings} == {
        frozenset(point.id for point in first),
        frozenset(point.id for point in second),
    }


def test_seed_three_keeps_both_earlier_start_numbers():
    points = _sequence("building", 12)
    points[0].x, points[0].y = -1.0, 0.0
    points[1].x, points[1].y = 1.0, 0.0
    points[2].x, points[2].y = 0.0, 0.0

    clusters = cluster_piles(points)
    buildings = [cluster for cluster in clusters if cluster.type == "building"]

    assert len(buildings) == 1
    assert {point.id for point in buildings[0].points} == {point.id for point in points}
    assert sum(len(cluster.points) for cluster in clusters) == len(points)


def test_small_building_growth_preserves_distance_limit_and_all_source_points():
    points = _sequence("limited", 5)

    clusters = cluster_piles(
        points,
        ClusterConfig(building_min_points=5),
        max_distance_from_seed=0.2,
    )

    assert all(cluster.type == "parking" for cluster in clusters)
    assert {point.id for cluster in clusters for point in cluster.points} == {point.id for point in points}
    assert sum(len(cluster.points) for cluster in clusters) == len(points)
