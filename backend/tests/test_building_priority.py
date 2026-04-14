from __future__ import annotations

import unittest

from backend.main import classify_entities, _sanitize_reference_polylines
from backend.models import BuildingDefinition, BuildingVertex


class BuildingPriorityTest(unittest.TestCase):
    def test_building_area_wins_over_overlapping_parking_area(self) -> None:
        parking = BuildingDefinition(
            name="B2",
            kind="parking",
            vertices=[
                BuildingVertex(x=0, y=0),
                BuildingVertex(x=10, y=0),
                BuildingVertex(x=10, y=10),
                BuildingVertex(x=0, y=10),
            ],
        )
        building = BuildingDefinition(
            name="201동",
            kind="building",
            vertices=[
                BuildingVertex(x=1, y=1),
                BuildingVertex(x=4, y=1),
                BuildingVertex(x=4, y=4),
                BuildingVertex(x=1, y=4),
            ],
        )
        circles = [
            {"id": "circle_building", "center_x": 2.0, "center_y": 2.0},
            {"id": "circle_parking", "center_x": 8.0, "center_y": 8.0},
        ]
        texts = [
            {"id": "text_building", "text_center_x": 2.5, "text_center_y": 2.5},
            {"id": "text_parking", "text_center_x": 8.5, "text_center_y": 8.5},
        ]

        classify_entities(circles, texts, [parking, building])

        self.assertEqual(circles[0]["building_name"], "201동")
        self.assertEqual(circles[1]["building_name"], "B2")
        self.assertEqual(texts[0]["building_name"], "201동")
        self.assertEqual(texts[1]["building_name"], "B2")

    def test_tower_crane_wins_over_overlapping_parking(self) -> None:
        parking = BuildingDefinition(
            name="B2",
            kind="parking",
            vertices=[
                BuildingVertex(x=0, y=0),
                BuildingVertex(x=10, y=0),
                BuildingVertex(x=10, y=10),
                BuildingVertex(x=0, y=10),
            ],
        )
        tower = BuildingDefinition(
            name="T1",
            kind="tower_crane",
            vertices=[
                BuildingVertex(x=3, y=3),
                BuildingVertex(x=7, y=3),
                BuildingVertex(x=7, y=7),
                BuildingVertex(x=3, y=7),
            ],
        )
        circles = [{"id": "c_in_both", "center_x": 5.0, "center_y": 5.0}]
        texts = [{"id": "t_in_both", "text_center_x": 5.2, "text_center_y": 5.2}]
        classify_entities(circles, texts, [parking, tower])
        self.assertEqual(circles[0]["building_name"], "T1")
        self.assertEqual(texts[0]["building_name"], "T1")

    def test_fallback_polylines_ignore_oversized_outline(self) -> None:
        circles = [
            {"id": "c1", "center_x": 3.0, "center_y": 3.0},
            {"id": "c2", "center_x": 7.0, "center_y": 7.0},
        ]
        texts = [
            {"id": "t1", "text_center_x": 3.2, "text_center_y": 3.2},
            {"id": "t2", "text_center_x": 6.8, "text_center_y": 6.8},
        ]
        polylines = [
            {
                "id": "poly_huge",
                "closed": True,
                "points": [
                    {"x": -100.0, "y": -100.0},
                    {"x": 100.0, "y": -100.0},
                    {"x": 100.0, "y": 100.0},
                    {"x": -100.0, "y": 100.0},
                ],
            },
            {
                "id": "poly_target",
                "closed": True,
                "points": [
                    {"x": 0.0, "y": 0.0},
                    {"x": 10.0, "y": 0.0},
                    {"x": 10.0, "y": 10.0},
                    {"x": 0.0, "y": 10.0},
                ],
            },
        ]

        classify_entities(circles, texts, [], polylines)

        self.assertEqual(circles[0]["building_name"], "poly_target")
        self.assertEqual(circles[1]["building_name"], "poly_target")
        self.assertEqual(texts[0]["building_name"], "poly_target")
        self.assertEqual(texts[1]["building_name"], "poly_target")

    def test_fallback_polylines_only_oversized_outline_leaves_unassigned(self) -> None:
        circles = [
            {"id": "c1", "center_x": 1.0, "center_y": 1.0},
            {"id": "c2", "center_x": 4.0, "center_y": 4.0},
        ]
        texts = [
            {"id": "t1", "text_center_x": 1.1, "text_center_y": 1.1},
            {"id": "t2", "text_center_x": 3.9, "text_center_y": 3.9},
        ]
        polylines = [
            {
                "id": "poly_huge",
                "closed": True,
                "points": [
                    {"x": -100.0, "y": -100.0},
                    {"x": 100.0, "y": -100.0},
                    {"x": 100.0, "y": 100.0},
                    {"x": -100.0, "y": 100.0},
                ],
            }
        ]

        classify_entities(circles, texts, [], polylines)

        self.assertIsNone(circles[0]["building_name"])
        self.assertIsNone(circles[1]["building_name"])
        self.assertIsNone(texts[0]["building_name"])
        self.assertIsNone(texts[1]["building_name"])

    def test_sanitize_reference_polylines_drops_oversized_closed_shapes(self) -> None:
        circles = [
            {"id": "c1", "center_x": 0.0, "center_y": 0.0},
            {"id": "c2", "center_x": 10.0, "center_y": 10.0},
        ]
        polylines = [
            {
                "id": "poly_huge",
                "closed": True,
                "points": [
                    {"x": -100.0, "y": -100.0},
                    {"x": 100.0, "y": -100.0},
                    {"x": 100.0, "y": 100.0},
                    {"x": -100.0, "y": 100.0},
                ],
            },
            {
                "id": "poly_ok",
                "closed": True,
                "points": [
                    {"x": -1.0, "y": -1.0},
                    {"x": 11.0, "y": -1.0},
                    {"x": 11.0, "y": 11.0},
                    {"x": -1.0, "y": 11.0},
                ],
            },
        ]

        sanitized = _sanitize_reference_polylines(polylines, circles)
        ids = {item.get("id") for item in sanitized}
        self.assertNotIn("poly_huge", ids)
        self.assertIn("poly_ok", ids)


if __name__ == "__main__":
    unittest.main()
