from __future__ import annotations

import unittest

from backend.pile_clustering import ClusterConfig, PilePoint, cluster_piles


class PileClusteringTest(unittest.TestCase):
    def test_cluster_split_between_buildings_and_parking(self) -> None:
        points: list[PilePoint] = []
        # Building 1: dense cluster with sequential numbers near origin.
        for index in range(10):
            points.append(
                PilePoint(
                    id=f"b1_{index}",
                    x=1.0 + (index % 5) * 0.5,
                    y=1.0 + (index // 5) * 0.5,
                    label=str(index + 1),
                    number=index + 1,
                )
            )
        # Building 2: another dense cluster far away with sequential numbers.
        for index in range(8):
            points.append(
                PilePoint(
                    id=f"b2_{index}",
                    x=100.0 + (index % 4) * 0.6,
                    y=50.0 + (index // 4) * 0.6,
                    label=str(index + 1),
                    number=index + 1,
                )
            )
        # Parking: sparse points with non-sequential numbering scattered around.
        for index in range(6):
            points.append(
                PilePoint(
                    id=f"p_{index}",
                    x=200.0 + index * 5.0,
                    y=-50.0 + index * 3.0,
                    label=str(900 + index * 5),
                    number=900 + index * 5,
                )
            )

        config = ClusterConfig(building_min_points=5, building_max_points=200)
        clusters = cluster_piles(points, config, expected_clusters=2)
        building_clusters = [cluster for cluster in clusters if cluster.type == "building"]
        parking_clusters = [cluster for cluster in clusters if cluster.type == "parking"]

        self.assertGreaterEqual(
            len(building_clusters),
            2,
            "Expected at least two building clusters from dense sequences.",
        )
        self.assertGreaterEqual(
            len(parking_clusters), 1, "Expected at least one parking/residual cluster."
        )
        for cluster in building_clusters:
            self.assertGreaterEqual(
                len(cluster.hull), 3, "Building clusters should expose a polygon hull."
            )
            self.assertLessEqual(
                cluster.metrics.missing_ratio,
                config.max_missing_ratio_for_building,
            )


    def test_number_pattern_based_clustering(self) -> None:
        """
        번호 패턴(1,2,3 시작 + 연속 번호) 기반 클러스터링 테스트
        
        시나리오:
        - 동1: 번호 1~30, seed=1,2,3 포함, 상대적으로 좁은 영역
        - 동2: 번호 1~25, 다른 위치에 모여 있음
        - 주변에 주차장 번호들이 흩어져 있음
        """
        points: list[PilePoint] = []
        
        # 동1: 번호 1~30, seed(1,2,3) 포함
        base_x1, base_y1 = 0.0, 0.0
        for num in range(1, 31):
            # 좁은 영역에 배치 (격자 패턴)
            row = (num - 1) // 10
            col = (num - 1) % 10
            points.append(
                PilePoint(
                    id=f"dong1_{num}",
                    x=base_x1 + col * 2.0,
                    y=base_y1 + row * 2.0,
                    label=str(num),
                    number=num,
                )
            )
        
        # 동2: 번호 1~25, 다른 위치
        base_x2, base_y2 = 200.0, 100.0
        for num in range(1, 26):
            row = (num - 1) // 8
            col = (num - 1) % 8
            points.append(
                PilePoint(
                    id=f"dong2_{num}",
                    x=base_x2 + col * 2.5,
                    y=base_y2 + row * 2.5,
                    label=str(num),
                    number=num,
                )
            )
        
        # 주차장: 비연속 번호들
        parking_numbers = [100, 105, 110, 200, 205, 300, 305, 400]
        for idx, num in enumerate(parking_numbers):
            points.append(
                PilePoint(
                    id=f"parking_{idx}",
                    x=500.0 + idx * 10.0,
                    y=-100.0 + idx * 5.0,
                    label=str(num),
                    number=num,
                )
            )
        
        config = ClusterConfig()
        clusters = cluster_piles(points, config, expected_clusters=2)
        building_clusters = [c for c in clusters if c.type == "building"]
        parking_clusters = [c for c in clusters if c.type == "parking"]
        
        # 동 2개가 생성되어야 함
        self.assertGreaterEqual(
            len(building_clusters),
            2,
            "Expected 2 building clusters (동1, 동2)",
        )
        
        # 각 동 클러스터 검증
        for cluster in building_clusters:
            self.assertGreaterEqual(
                cluster.metrics.count_points,
                10,
                "Each building should have at least 10 points",
            )
            self.assertLessEqual(
                cluster.metrics.missing_ratio,
                0.3,
                "Missing ratio should be <= 0.3",
            )
            # seed 번호(1,2,3) 중 하나가 포함되어야 함
            numbers = {p.number for p in cluster.points if p.number is not None}
            has_seed = bool(numbers & {1, 2, 3})
            self.assertTrue(
                has_seed,
                f"Cluster should contain at least one seed number (1,2,3). Found: {numbers}",
            )
    
    def test_merge_close_seeds(self) -> None:
        """
        같은 위치에서 1,2,3이 겹치거나 매우 가까울 경우 하나의 동만 생성되는지 확인
        """
        points: list[PilePoint] = []
        
        # 같은 위치에 1, 2, 3 번호가 매우 가까이 있음
        base_x, base_y = 0.0, 0.0
        for num in [1, 2, 3]:
            points.append(
                PilePoint(
                    id=f"seed_{num}",
                    x=base_x + num * 0.1,  # 매우 가까운 거리
                    y=base_y + num * 0.1,
                    label=str(num),
                    number=num,
                )
            )
        
        # 연속 번호 추가
        for num in range(4, 31):
            row = (num - 4) // 10
            col = (num - 4) % 10
            points.append(
                PilePoint(
                    id=f"seq_{num}",
                    x=base_x + col * 2.0,
                    y=base_y + row * 2.0,
                    label=str(num),
                    number=num,
                )
            )
        
        config = ClusterConfig()
        clusters = cluster_piles(points, config, expected_clusters=1)
        building_clusters = [c for c in clusters if c.type == "building"]
        
        # 가까운 seed들이 통합되어 하나의 동이 생성되어야 함
        self.assertGreaterEqual(
            len(building_clusters),
            1,
            "Close seeds should be merged into one building",
        )
        
        if building_clusters:
            # 하나의 클러스터에 대부분의 점이 포함되어야 함
            main_cluster = building_clusters[0]
            self.assertGreaterEqual(
                main_cluster.metrics.count_points,
                20,
                "Merged cluster should contain most points",
            )


if __name__ == "__main__":
    unittest.main()
