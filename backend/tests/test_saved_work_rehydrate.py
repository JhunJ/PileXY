from __future__ import annotations

import unittest

from backend.main import _rehydrate_saved_work_payload


def _circle(circle_id: str, x: float, y: float, matched_text_id: str, matched_text: str) -> dict:
    return {
        "id": circle_id,
        "center_x": x,
        "center_y": y,
        "center_z": 0.0,
        "radius": 0.3,
        "diameter": 0.6,
        "area": 0.2827433388,
        "layer": "PILE",
        "matched_text_id": matched_text_id,
        "matched_text": {
            "id": matched_text_id,
            "text": matched_text,
            "insert_x": 0.0,
            "insert_y": 0.0,
            "insert_z": 0.0,
            "center_x": 0.0,
            "center_y": 0.0,
            "text_center_x": 0.0,
            "text_center_y": 0.0,
            "height": 0.6,
            "distance": 0.0,
        },
    }


def _text(text_id: str, label: str, x: float, y: float) -> dict:
    return {
        "id": text_id,
        "text": label,
        "insert_x": x - 0.54,
        "insert_y": y - 0.30,
        "insert_z": 0.0,
        "text_center_x": x,
        "text_center_y": y,
        "center_x": x,
        "center_y": y,
        "height": 0.6,
        "layer": "TEXT",
        "type": "TEXT",
    }


class SavedWorkRehydrateTest(unittest.TestCase):
    def test_rehydrates_old_saved_work_with_latest_matching_logic(self) -> None:
        payload = {
            "id": "work_old",
            "title": "old",
            "project": "영통",
            "sourceType": "construction_original",
            "filter": {
                "minDiameter": 0.5,
                "maxDiameter": 0.65,
                "textHeightMin": 0.5,
                "textHeightMax": 1.1,
                "maxMatchDistance": 2.0,
                "textReferencePoint": "center",
            },
            "buildingCount": 1,
            "circles": [
                _circle("C3313", 204231.05555297158, 515156.7541766238, "T313", "154"),
                _circle("C3315", 204232.60984496458, 515158.0128174623, "T2704", "184"),
                _circle("C6337", 204233.78352922216, 515156.56344121514, "T315", "156"),
                _circle("C6356", 204231.94905855408, 515158.828820722, "T314", "155"),
            ],
            "texts": [
                _text("T313", "154", 204230.9251737587, 515157.33447705547),
                _text("T314", "155", 204232.3837092939, 515158.5788743602),
                _text("T315", "156", 204233.6340347208, 515157.1342596436),
                _text("T2704", "184", 204231.6032648563, 515159.29472070816),
            ],
            "buildings": [
                {
                    "name": "205동",
                    "kind": "building",
                    "drilling_start_elevation": 12.345,
                    "foundation_top_elevation": 8.5,
                    "vertices": [
                        {"x": 204229.0, "y": 515155.0},
                        {"x": 204235.0, "y": 515155.0},
                        {"x": 204235.0, "y": 515161.0},
                        {"x": 204229.0, "y": 515161.0},
                    ],
                }
            ],
            "matchCorrections": [],
        }

        rehydrated = _rehydrate_saved_work_payload(payload)
        circle_map = {item["id"]: item for item in rehydrated["circles"]}

        self.assertEqual(circle_map["C3315"]["matched_text"]["text"], "155")
        self.assertEqual(circle_map["C3315"]["matched_text_id"], "T314")
        self.assertEqual(circle_map["C6356"]["matched_text"]["text"], "184")
        self.assertEqual(circle_map["C6356"]["matched_text_id"], "T2704")
        self.assertEqual(rehydrated["filter"]["textReferencePoint"], "center")
        self.assertTrue(all(item.get("building_name") == "205동" for item in rehydrated["circles"]))
        self.assertEqual(len(rehydrated.get("buildings") or []), 1)
        self.assertEqual(rehydrated["buildings"][0].get("drilling_start_elevation"), 12.345)
        self.assertEqual(rehydrated["buildings"][0].get("foundation_top_elevation"), 8.5)


if __name__ == "__main__":
    unittest.main()
