from __future__ import annotations

import unittest

from backend.main import (
    _count_non_foundation_texts,
    build_match_errors,
    compute_building_summary,
)
from backend.models import BuildingDefinition


class FoundationPfExclusionTest(unittest.TestCase):
    def test_build_match_errors_skips_legacy_pf_prefix_text(self) -> None:
        circles = [{"id": "c1", "matched_text_id": "t_num"}]
        texts = [
            {"id": "t_pf", "text": "P-1", "height": 0.8},
            {"id": "t_num", "text": "101", "height": 0.8},
        ]
        errors = build_match_errors(circles, texts, {"t_num": ["c1"]})

        self.assertEqual(errors, [])
        self.assertTrue(texts[0]["foundation_pf_only"])
        self.assertFalse(texts[0]["has_error"])

    def test_compute_building_summary_excludes_pf_texts(self) -> None:
        circles = [{"id": "c1", "building_name": "A동", "has_error": False}]
        texts = [
            {"id": "t_pf", "text": "F2", "building_name": "A동"},
            {"id": "t_num", "text": "12", "building_name": "A동"},
        ]
        buildings = [BuildingDefinition(name="A동", vertices=[])]

        summary_rows = compute_building_summary(circles, texts, buildings)
        by_name = {item.name: item for item in summary_rows}

        self.assertIn("A동", by_name)
        self.assertEqual(by_name["A동"].text_count, 1)

    def test_total_text_count_excludes_pf_prefix_texts(self) -> None:
        texts = [
            {"id": "t1", "text": "P"},
            {"id": "t2", "text": "F-2"},
            {"id": "t3", "text": "33"},
            {"id": "t4", "text": "T4-1"},
        ]

        self.assertEqual(_count_non_foundation_texts(texts), 2)

    def test_build_match_errors_marks_ambiguous_numeric_hyphen(self) -> None:
        circles = [{"id": "c1", "matched_text_id": "t_bad"}]
        texts = [{"id": "t_bad", "text": "250-1", "height": 0.8}]
        errors = build_match_errors(circles, texts, {"t_bad": ["c1"]})

        self.assertTrue(any(e.error_type == "NUMERIC_HYPHEN_FORMAT_INVALID" for e in errors))
        self.assertTrue(texts[0]["has_error"])
        self.assertIn("NUMERIC_HYPHEN_FORMAT_INVALID", circles[0]["error_codes"])

    def test_build_match_errors_keeps_tc_tower_format_valid(self) -> None:
        circles = [{"id": "c1", "matched_text_id": "t_tc"}]
        texts = [{"id": "t_tc", "text": "TC10-1", "height": 0.8}]
        errors = build_match_errors(circles, texts, {"t_tc": ["c1"]})

        self.assertFalse(any(e.error_type == "NUMERIC_HYPHEN_FORMAT_INVALID" for e in errors))
        self.assertFalse(texts[0]["has_error"])


if __name__ == "__main__":
    unittest.main()
