"""
로컬 PileXY 백엔드 orthophoto-preview URL 검증(프론트 buildOrthophotoPreviewImgUrl 과 동일 쿼리).

  set PILEXY_MEISSA_JWT=<Meissa JWT>
  set PILEXY_API_BASE=http://127.0.0.1:3001
  python scripts/test_orthophoto_preview.py --project-id 1586 --snapshot-id 40790

비밀번호는 사용하지 않습니다. JWT는 브라우저 로컬스토리지 pilexy-meissa-access-jwt-v1 등에서 복사.
"""
from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import quote, urlencode


def build_orthophoto_preview_url(
    base: str,
    snapshot_id: str,
    project_id: str,
    access_token: str,
    max_edge: int = 3072,
    preview_fmt: str = "webp",
) -> str:
    edge = max(1024, min(16384, int(max_edge)))
    params = {
        "project_id": str(project_id).strip(),
        "access_token": str(access_token).strip(),
        "max_edge": str(edge),
    }
    pf = str(preview_fmt or "png").lower().strip()
    if pf in ("jpeg", "webp"):
        params["fmt"] = pf
    q = urlencode(params)
    sid = quote(str(snapshot_id).strip(), safe="")
    return f"{base.rstrip('/')}/api/meissa/snapshots/{sid}/orthophoto-preview?{q}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-id", default=os.environ.get("PILEXY_PROJECT_ID", "1586"))
    ap.add_argument("--snapshot-id", default=os.environ.get("PILEXY_SNAPSHOT_ID", "40790"))
    ap.add_argument("--base-url", default=os.environ.get("PILEXY_API_BASE", "http://127.0.0.1:3001"))
    ap.add_argument("--max-edge", type=int, default=2048)
    ap.add_argument("--fmt", default="webp", choices=("png", "jpeg", "webp"))
    ap.add_argument("--timeout", type=float, default=45.0)
    args = ap.parse_args()

    token = (os.environ.get("PILEXY_MEISSA_JWT") or "").strip()
    url = build_orthophoto_preview_url(
        args.base_url,
        args.snapshot_id,
        args.project_id,
        token or "MISSING",
        max_edge=args.max_edge,
        preview_fmt=args.fmt,
    )

    print("Carta 원본 패턴(서버 내부):", end=" ")
    print(
        f"https://cs.carta.is/carta/workspace/"
        f"{str(args.project_id).strip()}/{str(args.snapshot_id).strip()}/export/orthophoto/"
    )
    print("PileXY GET:", url[:100] + ("..." if len(url) > 100 else ""))
    print("full length:", len(url))

    if not token or token == "MISSING":
        print("\nPILEXY_MEISSA_JWT 가 없어 HTTP 요청은 생략합니다.")
        print("브라우저에서 로그인 후 JWT를 환경변수로 넣고 다시 실행하세요.")
        return 1

    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", "pilexy-scripts-test-orthophoto/1")
    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as r:
            body = r.read(256)
            print("\nOK")
            print("  status:", r.status)
            print("  content-type:", r.headers.get("Content-Type"))
            print("  X-Ortho-Source:", r.headers.get("X-Ortho-Source"))
            print("  X-Ortho-Max-Edge:", r.headers.get("X-Ortho-Max-Edge"))
            print("  first bytes:", body[:24])
    except urllib.error.HTTPError as e:
        print("\nHTTPError", e.code)
        try:
            err = e.read().decode("utf-8", errors="replace")[:800]
            print("  body:", err)
        except Exception:
            pass
        return 2
    except Exception as e:
        print("\nFailed:", type(e).__name__, e)
        return 3

    return 0


if __name__ == "__main__":
    sys.exit(main())
