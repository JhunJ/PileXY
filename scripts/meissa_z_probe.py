#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Meissa Z 탐색 도구.

1) platform-api.meissa.ai 에 대해 문서화되지 않은 후보 경로들의 HTTP 상태 확인
   (토큰 없으면 대부분 401 — 엔드포인트 존재 여부 힌트용).

2) MEISSA_JWT 가 있고 --x/--y 를 주면 meissa_nearest_z_xy_from_resources 로
   포인트클라우드 샘플 기반 최근접 Z 시도.

환경 변수: MEISSA_JWT 또는 MEISSA_TOKEN (PileXY Meissa 로그인 access JWT)

예:
  backend\\.venv\\Scripts\\python.exe scripts\\meissa_z_probe.py --snapshot 6154 --zone 343 --point 758497
  backend\\.venv\\Scripts\\python.exe scripts\\meissa_z_probe.py --snapshot 6154 --x 200000 --y 500000
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def _origin() -> str:
    return (os.environ.get("MEISSA_API_ORIGIN") or "https://platform-api.meissa.ai").rstrip("/")


def _probe_paths(zone: str, snapshot: str, point: str) -> list[tuple[str, str]]:
    z, s, p = str(zone), str(snapshot), str(point)
    return [
        ("snapshot resources v3", f"/api/v3/snapshots/{s}/resources"),
        ("snapshot resources v4", f"/api/v4/snapshots/{s}/resources"),
        ("zone snapshot", f"/api/v3/zones/{z}/snapshots/{s}"),
        ("guess annotation", f"/api/v3/zones/{z}/annotations/{p}"),
        ("guess snapshot annotation", f"/api/v3/snapshots/{s}/annotations/{p}"),
        ("guess sub-resource point", f"/api/v3/snapshots/{s}/sub-tasks/{p}"),
        ("guess point marker", f"/api/v3/zones/{z}/snapshots/{s}/points/{p}"),
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="Meissa API Z/포인트 관련 프로브")
    ap.add_argument("--zone", default=os.environ.get("MEISSA_PROBE_ZONE", "343"))
    ap.add_argument("--snapshot", default=os.environ.get("MEISSA_PROBE_SNAPSHOT", "6154"))
    ap.add_argument("--point", default=os.environ.get("MEISSA_PROBE_POINT", "758497"))
    ap.add_argument("--x", type=float, default=None, help="nearest-z 시도 시 평면 X")
    ap.add_argument("--y", type=float, default=None, help="nearest-z 시도 시 평면 Y")
    ap.add_argument("--resource-id", default=None)
    ap.add_argument("--limit", type=int, default=8000)
    ap.add_argument("--max-phases", type=int, default=4)
    args = ap.parse_args()

    try:
        import requests
    except ImportError:
        print("requests 패키지가 필요합니다. backend .venv Python으로 실행하세요.", file=sys.stderr)
        return 1

    token = (os.environ.get("MEISSA_JWT") or os.environ.get("MEISSA_TOKEN") or "").strip()
    origin = _origin()
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 PileXY-meissa-z-probe/1",
    }
    if token:
        headers["Authorization"] = f"JWT {token}"

    print("=== (1) 후보 GET 경로 HTTP 상태 ===")
    print(f"origin={origin} token={'있음' if token else '없음(401 예상)'}")
    for label, path in _probe_paths(args.zone, args.snapshot, args.point):
        url = f"{origin}{path}"
        try:
            r = requests.get(url, headers=headers, timeout=25)
            ct = (r.headers.get("content-type") or "").split(";")[0].strip()
            snippet = ""
            if "json" in ct.lower() and r.text:
                try:
                    data = r.json()
                    snippet = json.dumps(data, ensure_ascii=False)[:240]
                except Exception:
                    snippet = r.text[:240]
            else:
                snippet = (r.text or "")[:240]
            print(f"  [{r.status_code}] {label}: {path}")
            if snippet:
                print(f"       → {snippet}")
        except requests.RequestException as exc:
            print(f"  [err] {label}: {path} — {exc}")

    if args.x is not None and args.y is not None:
        print("\n=== (2) 포인트 샘플 nearest-z (meissa_nearest_z_xy_from_resources) ===")
        if not token:
            print("MEISSA_JWT 가 없어 건너뜁니다.")
            return 0
        backend_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend"))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        try:
            from meissa_api import meissa_nearest_z_xy_from_resources
        except ImportError:
            print(f"meissa_api import 실패. cwd/backend 경로 확인: {backend_dir}", file=sys.stderr)
            return 1
        out = meissa_nearest_z_xy_from_resources(
            token,
            args.snapshot,
            args.x,
            args.y,
            resource_id=args.resource_id,
            limit=args.limit,
            max_phases=args.max_phases,
        )
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        print("\n=== (2) nearest-z ===")
        print("--x, --y 를 주면 포인트클라우드 샘플로 최근접 Z를 시도합니다 (MEISSA_JWT 필요).")

    print(
        "\n번들 요약: cloud.meissa.ai 웹은 zPosition 문자열로 DSM 밖이면 Z를 못 읽는다고 안내합니다. "
        "임의 (x,y)→Z 단일 REST는 메인 번들에 명확히 노출되어 있지 않습니다."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
