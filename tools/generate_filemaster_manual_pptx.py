#!/usr/bin/env python3
"""합성 프레임(실제 화면 + 주석)으로 파일 마스터 PPTX 생성."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "docs" / "manual" / "assets" / "ppt-frames"
ORDER = FRAMES / "_slide_order.txt"
OUT = ROOT / "파일마스터_사용자_매뉴얼.pptx"

W = Inches(13.333)
H = Inches(7.5)


def load_order() -> list[str]:
    if ORDER.exists():
        lines = [ln.strip() for ln in ORDER.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if lines:
            return lines
    return ["00-cover", "01-toc", "01-flow", "14-end"]


def main() -> Path:
    subprocess.run([sys.executable, str(ROOT / "tools" / "compose_manual_ppt_frames.py")], check=True)
    slides = load_order()

    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H
    blank = prs.slide_layouts[6]

    for name in slides:
        path = FRAMES / f"{name}.png"
        if not path.exists():
            print(f"  ! missing {name}")
            continue
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(str(path), 0, 0, width=W, height=H)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUT))
    print(f"PPTX: {OUT}  ({len(slides)} slides)")
    return OUT


if __name__ == "__main__":
    main()
