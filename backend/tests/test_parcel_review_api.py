"""필지 선택(_pick_parcel_polygon) 단위 테스트 — 네트워크 없음."""

from __future__ import annotations

import unittest

try:
    from pyproj import Transformer
except ImportError:  # pragma: no cover
    Transformer = None  # type: ignore[misc, assignment]

try:
    import shapely.geometry  # noqa: F401

    _has_shapely = True
except ImportError:  # pragma: no cover
    _has_shapely = False

try:
    from backend.parcel_review_api import (
        _client_nearby_parcel_rings,
        _parse_vworld_address_payload,
        _pick_parcel_polygon,
    )
except ImportError:  # pragma: no cover
    _pick_parcel_polygon = None  # type: ignore[misc, assignment]
    _client_nearby_parcel_rings = None  # type: ignore[misc, assignment]
    _parse_vworld_address_payload = None  # type: ignore[misc, assignment]


@unittest.skipUnless(
    Transformer is not None
    and _has_shapely
    and _pick_parcel_polygon is not None
    and _client_nearby_parcel_rings is not None,
    "pyproj+shapely required",
)
class ParcelReviewPickTest(unittest.TestCase):
    def setUp(self) -> None:
        self.t_fwd = Transformer.from_crs("EPSG:4326", "EPSG:5186", always_xy=True)

    def _ring_square(self, lon0: float, lat0: float, half: float) -> list[tuple[float, float]]:
        """경도·위도 평면에서 축정렬 정사각형(닫힌 링)."""
        return [
            (lon0 - half, lat0 - half),
            (lon0 + half, lat0 - half),
            (lon0 + half, lat0 + half),
            (lon0 - half, lat0 + half),
            (lon0 - half, lat0 - half),
        ]

    def test_contains_wins_over_closer_ring(self) -> None:
        """쿼리가 안쪽에 들어가는 필지가 있으면, 더 가깝지만 밖에 있는 링보다 우선한다."""
        lon_q, lat_q = 127.5, 36.6
        qx, qy = self.t_fwd.transform(lon_q, lat_q)
        # 큰 링: 쿼리 포함, 면적 큼
        ring_big = self._ring_square(lon_q, lat_q, 0.00025)
        # 작은 링: 쿼리 밖(동쪽으로 치우침)이지만 경계가 쿼리에 더 가까울 수 있음
        ring_small = self._ring_square(lon_q + 0.0004, lat_q, 0.00005)
        polys = [
            (ring_small, {"pnu": "1111111111111111111"}),
            (ring_big, {"pnu": "2222222222222222222"}),
        ]
        ring, pnu, in_ll, in_draw, dbg = _pick_parcel_polygon(
            polys, lon_q, lat_q, float(qx), float(qy), 5186, False
        )
        self.assertEqual(pnu, "2222222222222222222")
        self.assertTrue(in_ll)
        self.assertTrue(in_draw)
        self.assertFalse(dbg.get("fallback_nearest"))

    def test_fallback_nearest_when_outside_all(self) -> None:
        """어느 링에도 포함되지 않으면 가장 가까운 필지로 가며 fallback 플래그가 켜진다."""
        lon_q, lat_q = 127.5, 36.6
        qx, qy = self.t_fwd.transform(lon_q, lat_q)
        # 두 블록 사이에 쿼리: 왼쪽 경계에 더 가깝게 배치
        ring_left = self._ring_square(127.4983, lat_q, 0.00015)
        ring_right = self._ring_square(127.5020, lat_q, 0.00015)
        polys = [
            (ring_right, {"pnu": "RIGHT0000000000000001"}),
            (ring_left, {"pnu": "LEFT0000000000000001"}),
        ]
        ring, pnu, in_ll, in_draw, dbg = _pick_parcel_polygon(
            polys, lon_q, lat_q, float(qx), float(qy), 5186, False
        )
        self.assertFalse(in_ll)
        self.assertFalse(in_draw)
        self.assertTrue(dbg.get("fallback_nearest"))
        self.assertIn("가장 가까운", dbg.get("fallback_explanation", ""))
        self.assertEqual(pnu, "LEFT0000000000000001")
        self.assertIsNotNone(ring)

    def test_client_nearby_parcel_rings_marks_winner(self) -> None:
        """클라이언트용 인접 목록에 is_winner가 들어간다."""
        dbg = {
            "winner_pnu": "B",
            "candidates_ranked": [
                {
                    "pnu": "A",
                    "ring_draw_xy": [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 0.0, "y": 1.0}],
                },
                {
                    "pnu": "B",
                    "ring_draw_xy": [{"x": 10.0, "y": 10.0}, {"x": 11.0, "y": 10.0}, {"x": 10.0, "y": 11.0}],
                },
            ],
        }
        rows = _client_nearby_parcel_rings(dbg)
        self.assertEqual(len(rows), 2)
        self.assertFalse(rows[0]["is_winner"])
        self.assertTrue(rows[1]["is_winner"])

    def test_client_nearby_parcel_rings_only_first_duplicate_pnu_is_winner(self) -> None:
        """같은 winner PNU가 여러 행이어도 is_winner는 첫 행만 True(오버레이 인접 선 유지)."""
        tri = [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 0.0, "y": 1.0}]
        tri2 = [{"x": 2.0, "y": 2.0}, {"x": 3.0, "y": 2.0}, {"x": 2.0, "y": 3.0}]
        dbg = {
            "winner_pnu": "B",
            "candidates_ranked": [
                {"pnu": "B", "ring_draw_xy": tri},
                {"pnu": "B", "ring_draw_xy": tri2},
                {"pnu": "A", "ring_draw_xy": tri},
            ],
        }
        rows = _client_nearby_parcel_rings(dbg)
        self.assertEqual(len(rows), 3)
        self.assertTrue(rows[0]["is_winner"])
        self.assertFalse(rows[1]["is_winner"])
        self.assertFalse(rows[2]["is_winner"])


@unittest.skipUnless(_parse_vworld_address_payload is not None, "parcel_review_api import")
class VworldAddressParseTest(unittest.TestCase):
    def test_parse_ok_list(self) -> None:
        data = {
            "response": {
                "status": "OK",
                "result": [
                    {"zipcode": "13480", "parceladdr": "경기 성남시 지번", "roadaddr": "경기 성남시 도로명"},
                ],
            }
        }
        p = _parse_vworld_address_payload(data)
        self.assertTrue(p["ok"])
        self.assertEqual(p["zipcode"], "13480")
        self.assertIn("도로명", p["summary"])

    def test_parse_not_found(self) -> None:
        data = {"response": {"status": "NOT_FOUND", "text": "없음"}}
        p = _parse_vworld_address_payload(data)
        self.assertFalse(p["ok"])


if __name__ == "__main__":
    unittest.main()
