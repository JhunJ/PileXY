from __future__ import annotations

import unittest

from backend.dxf_parser import foundation_pf_only_flag, pile_label_for_collection


class DxfPileLabelCollectionTest(unittest.TestCase):
    def test_numeric_only_unchanged(self) -> None:
        self.assertEqual(pile_label_for_collection("184"), "184")
        self.assertEqual(pile_label_for_collection("4-1"), "4-1")
        self.assertEqual(pile_label_for_collection("12.5"), "12.5")

    def test_tower_t_prefix_collected(self) -> None:
        self.assertEqual(pile_label_for_collection("T4-1"), "T4-1")
        self.assertEqual(pile_label_for_collection("t12-3"), "T12-3")
        self.assertEqual(pile_label_for_collection("T 4 - 1"), "T4-1")
        self.assertEqual(pile_label_for_collection("TC4-1"), "TC4-1")
        self.assertEqual(pile_label_for_collection("tc12-3"), "TC12-3")
        self.assertEqual(pile_label_for_collection("TC 4 - 1"), "TC4-1")

    def test_unicode_hyphen_normalized_for_tower(self) -> None:
        self.assertEqual(pile_label_for_collection("T4\u22121"), "T4-1")
        self.assertEqual(pile_label_for_collection("TC4\u22121"), "TC4-1")

    def test_rejects_non_pile_noise(self) -> None:
        self.assertIsNone(pile_label_for_collection("PHC"))
        self.assertIsNone(pile_label_for_collection("T4-1a"))
        self.assertIsNone(pile_label_for_collection("TC4-1a"))
        self.assertIsNone(pile_label_for_collection("TA-1"))

    def test_foundation_pf_markers_collected(self) -> None:
        self.assertEqual(pile_label_for_collection("P"), "P")
        self.assertEqual(pile_label_for_collection("F-1"), "F-1")
        self.assertEqual(pile_label_for_collection("P-12"), "P-12")
        self.assertTrue(foundation_pf_only_flag("P"))
        self.assertTrue(foundation_pf_only_flag("F-2"))
        self.assertFalse(foundation_pf_only_flag("184"))
        self.assertFalse(foundation_pf_only_flag("T4-1"))
        self.assertFalse(foundation_pf_only_flag("TC4-1"))

    def test_foundation_pf_korean_suffix_collected(self) -> None:
        """P/F 직후 한글(동·구역명)도 기초 표기로 수집 — 일부 현장 DXF."""
        self.assertEqual(pile_label_for_collection("P동"), "P동")
        self.assertEqual(pile_label_for_collection("F기초"), "F기초")
        self.assertTrue(foundation_pf_only_flag("P동"))

    def test_foundation_pf_fullwidth_leading(self) -> None:
        self.assertEqual(pile_label_for_collection("\uff30\uff11"), "Ｐ１")  # Ｐ１
        self.assertTrue(foundation_pf_only_flag("\uff261"))  # Ｆ1

    def test_pf_digit_series_collected(self) -> None:
        """PF1, PF2 형태 — 두 번째 글자 F가 PHC 오탐으로 빠지지 않아야 함."""
        self.assertEqual(pile_label_for_collection("PF1"), "PF1")
        self.assertEqual(pile_label_for_collection("PF2"), "PF2")
        self.assertEqual(pile_label_for_collection("PF2A"), "PF2A")
        self.assertEqual(pile_label_for_collection("pf12"), "pf12")
        self.assertEqual(pile_label_for_collection("PF-2"), "PF-2")
        self.assertEqual(pile_label_for_collection("PF2A-D800"), "PF2A")
        self.assertTrue(foundation_pf_only_flag("PF3"))
        self.assertTrue(foundation_pf_only_flag("PF2A"))
        self.assertTrue(foundation_pf_only_flag("PF2A-D800"))
        self.assertEqual(pile_label_for_collection("\uff30\uff26\uff11"), "\uff30\uff26\uff11")  # ＰＦ１


if __name__ == "__main__":
    unittest.main()
