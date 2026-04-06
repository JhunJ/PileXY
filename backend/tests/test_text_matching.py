from __future__ import annotations

import unittest

from backend.main import (
    _prune_pairwise_swap_manual_overrides,
    match_texts_to_circles,
)


def _circle(circle_id: str, x: float, y: float, diameter: float = 0.6) -> dict:
    return {
        "id": circle_id,
        "center_x": x,
        "center_y": y,
        "source": "CIRCLE",
        "diameter": diameter,
        "radius": diameter / 2.0,
    }


def _text(text_id: str, label: str, x: float, y: float) -> dict:
    return {
        "id": text_id,
        "text": label,
        "insert_x": x,
        "insert_y": y,
        "insert_z": 0.0,
        "text_center_x": x,
        "text_center_y": y,
        "height": 1.0,
    }


class TextMatchingTest(unittest.TestCase):
    def test_uses_minimum_total_distance_for_conflicting_candidates(self) -> None:
        circles = [
            _circle("circle_upper", 0.0, 0.9),
            _circle("circle_lower", 0.0, -1.5),
        ]
        texts = [
            _text("text_155", "155", 0.0, 0.0),
            _text("text_184", "184", 0.0, 2.0),
        ]

        matched_count, _links = match_texts_to_circles(
            circles,
            texts,
            max_match_distance=5.0,
        )

        self.assertEqual(matched_count, 2)
        self.assertEqual(circles[0]["matched_text"]["text"], "184")
        self.assertEqual(circles[1]["matched_text"]["text"], "155")
        self.assertLess(
            circles[0]["matched_text_distance"] + circles[1]["matched_text_distance"],
            3.0,
        )

    def test_adjacent_grid_cells_include_both_texts_for_global_optimum(self) -> None:
        """
        격자(400) 기준으로 184가 인접 셀에만 있을 때, 첫 셀에서 조기 종료하면
        한 원은 가까운 155만 보고 전역 최적(합 거리 최소)이 깨진다.
        """
        circles = [
            _circle("c_up", 1198.0, 0.9),
            _circle("c_lo", 1198.0, -1.5),
        ]
        texts = [
            _text("t155", "155", 1195.0, 0.0),
            _text("t184", "184", 1202.0, 2.0),
        ]
        matched_count, _links = match_texts_to_circles(
            circles,
            texts,
            max_match_distance=6.0,
        )
        self.assertEqual(matched_count, 2)
        self.assertEqual(circles[0]["matched_text"]["text"], "184")
        self.assertEqual(circles[1]["matched_text"]["text"], "155")
        total = circles[0]["matched_text_distance"] + circles[1]["matched_text_distance"]
        self.assertLess(total, 7.6)

    def test_label_direction_bias_adaptive_pref(self) -> None:
        """컴포넌트 내 최근접 후보 방향으로 추정한 대세 축이, 거리가 애매할 때 반대편 텍스트보다 그 방향을 선호."""
        circles = [
            _circle("c1", 0.0, 0.0),
            _circle("c2", 0.08, 0.0),
        ]
        texts = [
            _text("t_nw", "301", -0.75, 1.28),
            # 두 원 모두 최근접은 t_nw가 되도록 동쪽 텍스트는 더 멀게
            _text("t_e", "302", 2.5, 0.0),
        ]
        matched_count, _links = match_texts_to_circles(
            circles,
            texts,
            max_match_distance=3.0,
        )
        self.assertEqual(matched_count, 2)
        self.assertEqual(circles[0]["matched_text"]["text"], "301")
        self.assertEqual(circles[1]["matched_text"]["text"], "302")

    def test_prune_adjacent_manual_overrides_when_swap_reduces_distance(self) -> None:
        """인접 두 원이 잘못 수동 잠금되면 교환 시 거리 합이 줄므로 잠금 제거 후 자동 매칭."""
        circles = [
            _circle("C3315", 204232.60984496458, 515158.0128174623),
            _circle("C6356", 204231.94905855408, 515158.828820722),
        ]
        texts = [
            _text("T314", "155", 204232.3837092939, 515158.5788743602),
            _text("T2704", "184", 204231.6032648563, 515159.29472070816),
        ]
        text_lookup = {t["id"]: t for t in texts}
        mo = {"C3315": "T2704", "C6356": "T314"}
        pruned = _prune_pairwise_swap_manual_overrides(
            circles,
            text_lookup,
            mo,
            "center",
            max_center_separation=3.0,
            min_improvement=0.04,
        )
        self.assertEqual(pruned, {})
        n, _links = match_texts_to_circles(
            circles, texts, max_match_distance=2.0, overrides=pruned
        )
        self.assertEqual(n, 2)
        cm = {c["id"]: c for c in circles}
        self.assertEqual(cm["C3315"]["matched_text"]["text"], "155")
        self.assertEqual(cm["C6356"]["matched_text"]["text"], "184")


if __name__ == "__main__":
    unittest.main()
