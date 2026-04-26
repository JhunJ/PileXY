"""경계점 좌표등록부 서버 저장 로직 — httpx 없이 순수 함수만 검증."""

from __future__ import annotations

import unittest

try:
    from backend import main as main_mod
except ImportError:  # pragma: no cover
    main_mod = None  # type: ignore[misc, assignment]


@unittest.skipUnless(main_mod is not None, "backend.main required")
class ParcelLxRegisterSanitizeTest(unittest.TestCase):
    def test_sanitize_filters_invalid_rows(self) -> None:
        fn = getattr(main_mod, "_sanitize_parcel_lx_register_payload", None)
        self.assertIsNotNone(fn)
        out = fn(
            {
                "version": 2,
                "rowCount": 99,
                "completeRows": [
                    {"x": "1", "y": "2"},
                    {"x": "", "y": "3"},
                    {"x": "bad", "y": "1"},
                ],
            }
        )
        self.assertEqual(out["version"], 2)
        self.assertEqual(out["rowCount"], 99)
        self.assertEqual(len(out["completeRows"]), 1)
        self.assertEqual(out["completeRows"][0]["x"], "1")

    def test_scope_key_uses_project_name_ignores_meissa_id(self) -> None:
        key_fn = getattr(main_mod, "_parcel_lx_register_scope_key", None)
        self.assertIsNotNone(key_fn)
        a = key_fn("meissa-id-a", "동일현장", None)
        b = key_fn("meissa-id-b", "동일현장", None)
        self.assertEqual(a, b, "같은 프로젝트명이면 Meissa ID가 달라도 동일 키")
        c = key_fn("any-id", "다른현장", None)
        self.assertNotEqual(a, c)
