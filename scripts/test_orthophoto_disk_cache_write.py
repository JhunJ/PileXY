"""
정사 디스크 캐시 쓰기 경로 검증(네트워크·JWT 없음).

  python scripts/test_orthophoto_disk_cache_write.py

환경변수 MEISSA_ORTHOPHOTO_DISK_CACHE_DIR 가 있으면 그 경로를 사용합니다.
성공 시 최소 PNG 1장이 해당 폴더에 생성된 뒤 삭제하지 않고 경로를 출력합니다.
"""
from __future__ import annotations

import os
import sys

# 프로젝트 루트
_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# 최소 1x1 PNG (IHDR + IDAT + IEND)
_MIN_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def main() -> int:
    os.chdir(_ROOT)
    from backend.meissa_api import (
        meissa_orthophoto_disk_cache_file_path,
        meissa_orthophoto_resolved_disk_cache_dir,
        meissa_orthophoto_write_disk_cache,
        meissa_orthophoto_write_disk_cache_encoded,
    )

    cache_dir = meissa_orthophoto_resolved_disk_cache_dir()
    print("Resolved cache dir:", cache_dir)

    pid, sid = "test_project", "test_snapshot_ortho_cache"
    edge = 2048
    meissa_orthophoto_write_disk_cache(pid, sid, _MIN_PNG, edge)
    png_path = meissa_orthophoto_disk_cache_file_path(pid, sid, edge)
    ok_png = os.path.isfile(png_path) and os.path.getsize(png_path) >= 64
    print("PNG write path:", png_path)
    print("PNG exists & size ok:", ok_png)

    # WebP 캐시: 더미 바이트(실제 webp가 아니어도 write 함수는 크기만 검사)
    dummy_webp = b"RIFF\x24\x00\x00\x00WEBP" + b"\x00" * 32
    meissa_orthophoto_write_disk_cache_encoded(pid, sid, dummy_webp, edge, "webp")
    from backend.meissa_api import meissa_orthophoto_disk_cache_encoded_file_path

    webp_path = meissa_orthophoto_disk_cache_encoded_file_path(pid, sid, edge, "webp")
    ok_webp = os.path.isfile(webp_path) and os.path.getsize(webp_path) >= 32
    print("WebP path:", webp_path)
    print("WebP exists & size ok:", ok_webp)

    # 테스트 파일 정리(폴더만 검증하면 됨)
    for p in (png_path, webp_path):
        try:
            if os.path.isfile(p):
                os.unlink(p)
        except OSError:
            pass

    if ok_png and ok_webp:
        print("\nOK: disk cache write path works (test files removed).")
        return 0
    print("\nFAIL: missing file or size. Check permissions and MEISSA_ORTHOPHOTO_DISK_CACHE_DIR.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
