from __future__ import annotations

import unittest

from backend.main import classify_entities
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


if __name__ == "__main__":
    unittest.main()
