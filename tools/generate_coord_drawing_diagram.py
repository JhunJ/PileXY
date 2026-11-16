#!/usr/bin/env python3
"""매뉴얼용 좌표도 규칙 참고 다이어그램 PNG 생성."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "manual" / "assets" / "coord-drawing-guide.png"


def pile(cx: float, cy: float, num: str = "", *, r: float = 5) -> str:
    parts = [
        f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r}" fill="none" stroke="#cbd5e1" stroke-width="1.2"/>'
    ]
    if num:
        parts.append(
            f'<text x="{cx + r + 4:.0f}" y="{cy + 3:.0f}" font-size="8" font-weight="600" '
            f'fill="#e2e8f0" font-family="Pretendard, Malgun Gothic, sans-serif">{num}</text>'
        )
    return "".join(parts)


def foundation_group(
    gx: float, gy: float, w: float, h: float, label: str, pile_xy: list[tuple[float, float]]
) -> str:
    parts = [
        f'<rect x="{gx:.0f}" y="{gy:.0f}" width="{w:.0f}" height="{h:.0f}" '
        f'fill="none" stroke="#2dd4bf" stroke-width="1.3" rx="1"/>',
        f'<text x="{gx + 2:.0f}" y="{gy - 3:.0f}" font-size="7.5" font-weight="700" fill="#5eead4" '
        f'font-family="Pretendard, Malgun Gothic, sans-serif">{label}</text>',
    ]
    for px, py in pile_xy:
        parts.append(pile(gx + px, gy + py))
    return "".join(parts)


def polyline(points: list[tuple[float, float]], *, stroke: str, fill: str = "none") -> str:
    d = "M " + " L ".join(f"{x:.0f},{y:.0f}" for x, y in points) + " Z"
    fill_attr = f' fill="{fill}"' if fill != "none" else ' fill="none"'
    return (
        f'<path d="{d}"{fill_attr} stroke="{stroke}" stroke-width="2" '
        f'stroke-linejoin="miter"/>'
    )


# 수직·수평만 (사선 없음)
B101 = [(0, 0), (118, 0), (118, 68), (46, 68), (46, 112), (0, 112)]
B102 = [(0, 0), (124, 0), (124, 52), (86, 52), (86, 108), (38, 108), (38, 52), (0, 52)]

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 400" width="920" height="400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2ff"/>
    </linearGradient>
  </defs>
  <rect width="920" height="400" fill="url(#bg)" rx="14"/>

  <text x="460" y="26" text-anchor="middle" font-family="Pretendard, Malgun Gothic, sans-serif"
        font-size="16" font-weight="700" fill="#0f172a">좌표도 구성 예시 (참고)</text>
  <text x="460" y="42" text-anchor="middle" font-family="Pretendard, Malgun Gothic, sans-serif"
        font-size="9.5" fill="#64748b">동(수직·수평 꺾인선) · 기초부호 · 기초 윤곽(닫힌 선) · 주차장 말뚝</text>

  <g transform="translate(20,50)">
    <rect width="880" height="36" rx="8" fill="#fff" stroke="#e2e8f0"/>
    <circle cx="24" cy="18" r="4.5" fill="none" stroke="#334155" stroke-width="1.5"/>
    <text x="34" y="22" font-size="9.5" fill="#334155" font-family="Pretendard, Malgun Gothic, sans-serif">말뚝(빈 원+번호)</text>
    <path d="M118 10 L148 10 L148 26 L118 26 Z" fill="none" stroke="#2563eb" stroke-width="1.5"/>
    <text x="156" y="22" font-size="9.5" fill="#334155" font-family="Pretendard, Malgun Gothic, sans-serif">동 윤곽(수직·수평)</text>
    <rect x="268" y="12" width="20" height="14" fill="none" stroke="#2dd4bf" stroke-width="1.2"/>
    <text x="294" y="22" font-size="9.5" fill="#334155" font-family="Pretendard, Malgun Gothic, sans-serif">기초 윤곽(닫힌 선)</text>
    <rect x="410" y="8" width="64" height="20" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="7 4"/>
    <text x="482" y="22" font-size="9.5" fill="#334155" font-family="Pretendard, Malgun Gothic, sans-serif">전체 필지</text>
  </g>

  <g transform="translate(24,96)">
    <rect width="560" height="288" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <rect x="16" y="16" width="528" height="256" rx="4" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-dasharray="9 5"/>
    <text x="26" y="32" font-size="9" fill="#c4b5fd" font-family="Pretendard, Malgun Gothic, sans-serif">전체 필지</text>

    <g transform="translate(40,44)">
      {polyline(B101, stroke="#60a5fa", fill="rgba(37,99,235,.08)")}
      <text x="24" y="58" font-size="11" font-weight="700" fill="#93c5fd" font-family="Pretendard, Malgun Gothic, sans-serif">101동</text>
      {foundation_group(12, 16, 44, 32, "PF1", [(14, 16), (30, 16)])}
      {foundation_group(64, 16, 44, 32, "PF2", [(14, 16), (30, 16)])}
      {foundation_group(12, 68, 44, 32, "PF3", [(14, 16), (30, 16)])}
      {pile(98, 28, "7")}{pile(98, 54, "8")}{pile(98, 88, "9")}
    </g>

    <g transform="translate(198,40)">
      {polyline(B102, stroke="#60a5fa", fill="rgba(37,99,235,.08)")}
      <text x="44" y="48" font-size="11" font-weight="700" fill="#93c5fd" font-family="Pretendard, Malgun Gothic, sans-serif">102동</text>
      {foundation_group(14, 18, 46, 34, "FS1", [(15, 17), (31, 17)])}
      {foundation_group(68, 18, 46, 34, "FS2", [(15, 17), (31, 17)])}
      {foundation_group(40, 66, 46, 34, "PF1", [(15, 17), (31, 17)])}
      {pile(104, 34, "7")}{pile(104, 72, "8")}
    </g>

    <text x="52" y="198" font-size="9" fill="#64748b" font-family="Pretendard, Malgun Gothic, sans-serif">주차장</text>
    {pile(68, 216, "1")}{pile(112, 216, "2")}{pile(156, 216, "3")}{pile(200, 216, "4")}
    {pile(244, 216, "5")}{pile(288, 216, "6")}{pile(332, 216, "7")}
    {pile(156, 252, "8")}{pile(200, 252, "9")}
  </g>

  <g transform="translate(600,96)">
    <rect width="296" height="288" rx="10" fill="#fff1f2" stroke="#f87171" stroke-width="2"/>
    <rect x="0" y="0" width="296" height="32" rx="10" fill="#fecaca"/>
    <rect x="0" y="16" width="296" height="16" fill="#fecaca"/>
    <text x="148" y="22" text-anchor="middle" font-size="12" font-weight="800" fill="#b91c1c" font-family="Pretendard, Malgun Gothic, sans-serif">⚠ 피해야 할 예</text>

    <g transform="translate(12,44)">
      <rect width="272" height="72" rx="7" fill="#fff" stroke="#fecaca"/>
      <circle cx="28" cy="36" r="7" fill="none" stroke="#ef4444" stroke-width="2"/>
      <line x1="21" y1="29" x2="35" y2="43" stroke="#ef4444" stroke-width="1.5"/>
      <line x1="35" y1="29" x2="21" y2="43" stroke="#ef4444" stroke-width="1.5"/>
      <text x="50" y="30" font-size="10" font-weight="700" fill="#991b1b" font-family="Pretendard, Malgun Gothic, sans-serif">말뚝이 아닌 원</text>
      <text x="50" y="46" font-size="9" fill="#64748b" font-family="Pretendard, Malgun Gothic, sans-serif">배관·기호·장식 원 → 오인식</text>
    </g>

    <g transform="translate(12,128)">
      <rect width="272" height="72" rx="7" fill="#fff" stroke="#fecaca"/>
      <circle cx="20" cy="36" r="4" fill="none" stroke="#cbd5e1"/><text x="28" y="39" font-size="5" fill="#e2e8f0">1</text>
      <circle cx="48" cy="36" r="4" fill="none" stroke="#cbd5e1"/><text x="56" y="39" font-size="9.5" fill="#e2e8f0">2</text>
      <circle cx="80" cy="36" r="4" fill="none" stroke="#cbd5e1"/><text x="88" y="39" font-size="6.5" fill="#e2e8f0">3</text>
      <text x="108" y="30" font-size="10" font-weight="700" fill="#991b1b" font-family="Pretendard, Malgun Gothic, sans-serif">번호 크기 제각각</text>
      <text x="108" y="46" font-size="9" fill="#64748b" font-family="Pretendard, Malgun Gothic, sans-serif">번호 텍스트 크기 통일</text>
    </g>

    <g transform="translate(12,212)">
      <rect width="272" height="72" rx="7" fill="#fff" stroke="#fecaca"/>
      <rect x="12" y="18" width="40" height="36" fill="none" stroke="#64748b" stroke-width="1.2"/>
      <rect x="58" y="18" width="40" height="36" fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text x="110" y="30" font-size="10" font-weight="700" fill="#991b1b" font-family="Pretendard, Malgun Gothic, sans-serif">좌표도+작업도면 혼재</text>
      <text x="110" y="46" font-size="9" fill="#64748b" font-family="Pretendard, Malgun Gothic, sans-serif">좌표도 도면 1개만</text>
    </g>
  </g>
</svg>"""


def main() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    svg_path = OUT.with_suffix(".svg")
    svg_path.write_text(SVG, encoding="utf-8")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 920, "height": 400}, device_scale_factor=2)
        page.set_content(
            f"""<!DOCTYPE html><html><body style="margin:0;background:#fff">
            {SVG}
            </body></html>"""
        )
        page.locator("svg").screenshot(path=str(OUT))
        browser.close()

    print(f"OK {OUT}")
    return OUT


if __name__ == "__main__":
    main()
