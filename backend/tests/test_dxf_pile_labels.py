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

    def test_unicode_hyphen_normalized_for_tower(self) -> None:
        self.assertEqual(pile_label_for_collection("T4\u22121"), "T4-1")

    def test_rejects_non_pile_noise(self) -> None:
        self.assertIsNone(pile_label_for_collection("PHC"))
        self.assertIsNone(pile_label_for_collection("T4-1a"))
        self.assertIsNone(pile_label_for_collection("TA-1"))

    def test_foundation_pf_markers_collected(self) -> None:
        self.assertEqual(pile_label_for_collection("P"), "P")
        self.assertEqual(pile_label_for_collection("F-1"), "F-1")
        self.assertEqual(pile_label_for_collection("P-12"), "P-12")
        self.assertTrue(foundation_pf_only_flag("P"))
        self.assertTrue(foundation_pf_only_flag("F-2"))
        self.assertFalse(foundation_pf_only_flag("184"))
        self.assertFalse(foundation_pf_only_flag("T4-1"))


if __name__ == "__main__":
    unittest.main()
