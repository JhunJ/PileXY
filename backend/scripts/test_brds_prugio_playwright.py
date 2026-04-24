r"""
PRUGio Playwright smoke test. Set env vars only.

PowerShell:
  Set-Location d:\PileXY\backend
  $env:PILEXY_BRDS_TEST_USER='id'
  $env:PILEXY_BRDS_TEST_PASSWORD='pw'
  python -u scripts\test_brds_prugio_playwright.py

(4) 다음 줄이 안 나와도 정상입니다. 브라우저 로그인·PRUGio·채팅 대기는 2~10분 걸릴 수 있습니다.
15초마다 (4b) 경과 시간이 찍힙니다.
"""

from __future__ import annotations

import os
import sys
import threading
import traceback

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


_console_utf8_done = False


def _emit(msg: str) -> None:
    global _console_utf8_done
    if not _console_utf8_done:
        for stream in (sys.stdout, sys.stderr):
            try:
                if hasattr(stream, "reconfigure"):
                    stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
        _console_utf8_done = True
    print(msg, flush=True)


def main() -> int:
    import time

    _emit(f"[pilexy] (0) main entry python={sys.executable}")
    _emit(f"[pilexy] (1) cwd={os.getcwd()}")
    uid = os.environ.get("PILEXY_BRDS_TEST_USER", "").strip()
    pw = os.environ.get("PILEXY_BRDS_TEST_PASSWORD", "")
    q = (
        os.environ.get("PILEXY_BRDS_TEST_QUESTION")
        or "말뚝공사 오시공 시 보강방법을 한 문단으로 요약해 주세요."
    ).strip()
    _emit(f"[pilexy] (2) env USER_SET={bool(uid)} PASS_SET={bool(pw)} QUESTION_LEN={len(q)}")
    if not uid or not pw:
        _emit("SKIP: set PILEXY_BRDS_TEST_USER and PILEXY_BRDS_TEST_PASSWORD (new shell = set again)")
        return 0

    _emit("[pilexy] (3) importing brds_prugio...")
    try:
        from brds_prugio import (  # noqa: E402
            DEFAULT_BRDS_PRUGIO_PAGE,
            DEFAULT_BRDS_SSO_ENTRY,
            _playwright_brds_login_and_fetch,
            _ssl_verify,
        )
    except Exception as exc:
        _emit(f"[pilexy] import FAIL {type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1
    _emit("[pilexy] (4) Playwright run start (often 2-10 min: login + PRUGio + chat wait)...")

    stop_hb = threading.Event()
    hb_t0 = time.perf_counter()

    def _heartbeat() -> None:
        interval = 15.0
        while not stop_hb.wait(interval):
            sec = time.perf_counter() - hb_t0
            _emit(f"[pilexy] (4b) still running ... {sec:.0f}s (no crash; Playwright is busy)")

    hb = threading.Thread(target=_heartbeat, daemon=True)
    hb.start()
    t0 = time.perf_counter()
    try:
        out = _playwright_brds_login_and_fetch(
            uid,
            pw,
            DEFAULT_BRDS_SSO_ENTRY,
            DEFAULT_BRDS_PRUGIO_PAGE,
            False,
            _ssl_verify(),
            q,
        )
    except Exception as exc:
        _emit(f"[pilexy] Playwright EXC {type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1
    finally:
        stop_hb.set()
    elapsed = time.perf_counter() - t0
    _emit(f"[pilexy] (5) Playwright done in {elapsed:.1f}s")
    if out is None:
        _emit("FAIL: returned None. Check backend logs and BRDS_* env (VPN, credentials).")
        return 1
    if not isinstance(out, dict):
        _emit(f"FAIL: bad return type {type(out).__name__}")
        return 1
    _emit(f"ok={out.get('ok')} source={out.get('source')} keys={sorted(out.keys())}")
    ans = out.get("answer")
    if ans is not None and str(ans).strip():
        _emit("ANSWER_PREVIEW:\n" + str(ans).strip()[:1200])
        return 0
    c = out.get("content")
    if c:
        _emit("CONTENT_PREVIEW:\n" + str(c).strip()[:800])
        return 0
    _emit(f"FAIL payload keys only: {list(out.keys())}")
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        raise SystemExit(1) from None
