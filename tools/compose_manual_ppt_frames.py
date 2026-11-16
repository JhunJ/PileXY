#!/usr/bin/env python3
"""실제 스크린샷 + 세련된 주석 프레임 합성 (PPT용)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "manual" / "assets" / "screenshots"
DIVS = ROOT / "docs" / "manual" / "assets" / "ppt-dividers"
OUT = ROOT / "docs" / "manual" / "assets" / "ppt-frames"

W, H = 1920, 1080
M = 56

# palette
TEAL = (13, 148, 136)
TEAL_DK = (15, 118, 110)
TEAL_LT = (240, 253, 250)
INK = (15, 23, 42)
SOFT = (71, 85, 105)
MUTED = (148, 163, 184)
HAIR = (226, 232, 240)
WHITE = (255, 255, 255)
BG = (250, 251, 252)
NAVY = (15, 23, 42)
PAPER = (255, 255, 255)


def font(size: int, bold: bool = False):
    paths = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\malgun.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def shadow_card(base: Image.Image, box, *, radius=24, blur=18, alpha=40):
    """Soft drop shadow under a rounded card region."""
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x0 + 6, y0 + 10, x1 + 6, y1 + 14), radius=radius, fill=(15, 23, 42, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    out = base.convert("RGBA")
    out = Image.alpha_composite(out, layer)
    return out.convert("RGB")


def rr(draw, box, fill, *, r=20, outline=None, w=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)


def txt(draw, xy, text, fnt, fill=INK):
    draw.text(xy, text, font=fnt, fill=fill)


def wrap(draw, text: str, fnt, max_w: int) -> list[str]:
    lines = []
    for para in text.split("\n"):
        cur = ""
        for ch in para:
            test = cur + ch
            if draw.textlength(test, font=fnt) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = ch
        lines.append(cur)
    return lines


def fit(img: Image.Image, mw: int, mh: int) -> Image.Image:
    sw, sh = img.size
    s = min(mw / sw, mh / sh)
    return img.resize((max(1, int(sw * s)), max(1, int(sh * s))), Image.Resampling.LANCZOS)


def paste_fit(canvas: Image.Image, img: Image.Image, box):
    x0, y0, x1, y1 = box
    fitted = fit(img, x1 - x0, y1 - y0)
    canvas.paste(fitted, (x0 + (x1 - x0 - fitted.width) // 2, y0 + (y1 - y0 - fitted.height) // 2))


def load_shot(name: str) -> Image.Image:
    p = SHOTS / f"{name}.png"
    if not p.exists():
        im = Image.new("RGB", (1600, 1000), BG)
        d = ImageDraw.Draw(im)
        txt(d, (40, 40), f"missing {name}", font(24), MUTED)
        return im
    return Image.open(p).convert("RGB")


def eyebrow(draw, x, y, label):
    """작은 대문자 라벨 — pill/칩 대신 타이포만."""
    f = font(14, True)
    txt(draw, (x, y), label.upper(), f, TEAL)
    # underline accent
    tw = draw.textlength(label.upper(), font=f)
    draw.rectangle((x, y + 22, x + min(36, tw), y + 25), fill=TEAL)


def step_block(draw, x, y, w, n, text):
    """행 카드 + 타이포 번호 (원/배지 없음)."""
    f_num = font(18, True)
    f_body = font(20)
    lines = wrap(draw, text, f_body, w - 96)
    h = max(64, 20 + len(lines) * 28)
    rr(draw, (x, y, x + w, y + h), BG, r=14)
    label = f"{n:02d}"
    txt(draw, (x + 20, y + 18), label, f_num, TEAL)
    # thin divider between number and text
    draw.line((x + 62, y + 16, x + 62, y + h - 16), fill=HAIR, width=1)
    for i, line in enumerate(lines):
        txt(draw, (x + 78, y + 18 + i * 28), line, f_body, INK)
    return h + 12


def frame_cover() -> Image.Image:
    canvas = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 6, H), fill=TEAL)

    shot = fit(load_shot("00-main-clean"), 1000, 640)
    canvas = shadow_card(canvas, (W - shot.width - 90, 170, W - 70, 170 + shot.height + 20), radius=16, blur=22, alpha=55)
    draw = ImageDraw.Draw(canvas)
    rr(draw, (W - shot.width - 82, 178, W - 78, 178 + shot.height + 16), (30, 41, 59), r=14)
    canvas.paste(shot, (W - shot.width - 74, 186))

    draw = ImageDraw.Draw(canvas)
    eyebrow(draw, 72, 200, "현장 사용자 매뉴얼")
    txt(draw, (72, 250), "파일 마스터", font(68, True), WHITE)
    body = "본사 세팅 작업을 불러와\n시공현황 · 기성 · 자재 · 검토를 수행하는\n현장 담당자용 가이드"
    for i, line in enumerate(wrap(draw, body, font(26), 640)):
        txt(draw, (72, 380 + i * 40), line, font(26), (203, 213, 225))

    rr(draw, (72, 560, 700, 632), (30, 41, 59), r=12)
    txt(draw, (96, 580), "접속  https://pilexy.yeobaekstudio.com/", font(22, True), (153, 246, 228))
    txt(draw, (72, 980), "건축BIM팀   ·   기능 순서 01 → 08", font(20), MUTED)
    return canvas


def load_div(name: str) -> Image.Image:
    p = DIVS / f"{name}.png"
    if not p.exists():
        im = Image.new("RGB", (1600, 900), (30, 41, 59))
        d = ImageDraw.Draw(im)
        txt(d, (40, 40), f"missing {name}", font(24), MUTED)
        return im
    return Image.open(p).convert("RGB")


def frame_toc(entries: list[tuple[str, str, int]]) -> Image.Image:
    """목차 — 준비 우선, 큰 글씨 + 페이지 번호."""
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)
    eyebrow(draw, M, 36, "Contents")
    txt(draw, (M, 82), "목차", font(56, True), INK)
    txt(draw, (M, 158), "준비 → ①~⑧ 순서로 따라가면 됩니다.", font(24), SOFT)
    draw.line((M, 208, W - M, 208), fill=HAIR, width=1)

    # single-column list for clarity (준비 first)
    y = 240
    f_num = font(30, True)
    f_title = font(32, True)
    f_page = font(28, True)
    row_h = 68
    for num, title, page in entries:
        # row background for prep
        if num == "준비":
            rr(draw, (M, y - 6, W - M, y + 52), TEAL_LT, r=12)
        txt(draw, (M + 12, y + 6), num, f_num, TEAL)
        num_w = max(100, int(draw.textlength(num, font=f_num) + 28))
        txt(draw, (M + num_w, y + 4), title, f_title, INK)
        page_s = str(page)
        pw = draw.textlength(page_s, font=f_page)
        page_x = W - M - 24 - pw
        title_end = M + num_w + draw.textlength(title, font=f_title) + 20
        dx = title_end
        while dx < page_x - 16:
            draw.ellipse((dx, y + 24, dx + 3, y + 27), fill=MUTED)
            dx += 14
        txt(draw, (page_x, y + 6), page_s, f_page, SOFT)
        y += row_h

    txt(draw, (M, H - 52), "페이지는 PPT 슬라이드 번호입니다.", font(16), MUTED)
    return canvas


def frame_flow(items: list[tuple[str, str, str, int]]) -> Image.Image:
    """한눈에 보기 — 실제 화면 썸네일 + 페이지 번호."""
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)
    eyebrow(draw, M, 32, "Overview")
    txt(draw, (M, 76), "한눈에 보기 — 실제 화면", font(40, True), INK)
    txt(draw, (M, 132), "각 카드는 실제 캡처입니다. 오른쪽 숫자가 해당 간지 페이지입니다.", font(20), SOFT)

    # 3 columns x 3 rows (9 items: 준비 + 01~08)
    cols, rows = 3, 3
    gap_x, gap_y = 22, 18
    x0, y0 = M, 180
    area_w = W - 2 * M
    area_h = H - y0 - 48
    cw = (area_w - gap_x * (cols - 1)) // cols
    ch = (area_h - gap_y * (rows - 1)) // rows

    for i, (num, title, shot, page) in enumerate(items):
        col, row = i % cols, i // cols
        x = x0 + col * (cw + gap_x)
        y = y0 + row * (ch + gap_y)
        canvas = shadow_card(canvas, (x, y, x + cw, y + ch), radius=16, blur=12, alpha=22)
        draw = ImageDraw.Draw(canvas)
        rr(draw, (x, y, x + cw, y + ch), WHITE, r=16, outline=HAIR, w=1)
        # header strip
        txt(draw, (x + 16, y + 12), num, font(18, True), TEAL)
        txt(draw, (x + 90, y + 10), title, font(20, True), INK)
        page_s = f"p.{page}"
        pw = draw.textlength(page_s, font=font(16, True))
        txt(draw, (x + cw - 16 - pw, y + 14), page_s, font(16, True), MUTED)
        # screenshot area
        rr(draw, (x + 12, y + 48, x + cw - 12, y + ch - 12), BG, r=10)
        paste_fit(canvas, load_shot(shot), (x + 16, y + 52, x + cw - 16, y + ch - 16))
    return canvas


def frame_divider(*, num: str, title: str, subtitle: str = "", art_name: str = "div-01-load") -> Image.Image:
    """기능 앞 간지 — AI 일러스트 + 쉬운 설명 (실화면 아님)."""
    art = load_div(art_name)
    # full-bleed art, darkened left for text
    canvas = Image.new("RGB", (W, H), NAVY)
    fitted = fit(art, W, H)
    canvas.paste(fitted, ((W - fitted.width) // 2, (H - fitted.height) // 2))
    # left readable panel
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, 760, H), fill=(15, 23, 42, 210))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 6, H), fill=TEAL)

    label = f"{int(num):02d}" if num.isdigit() else num
    txt(draw, (M + 16, 260), label, font(96, True), TEAL)
    txt(draw, (M + 16, 390), title, font(52, True), WHITE)
    if subtitle:
        for i, line in enumerate(wrap(draw, subtitle, font(24), 620)):
            txt(draw, (M + 16, 480 + i * 36), line, font(24), (203, 213, 225))
    txt(draw, (M + 16, H - 70), "파일 마스터  ·  현장 사용자 매뉴얼", font(18), MUTED)
    return canvas


def plain(text: str) -> str:
    """매뉴얼 HTML 태그 제거."""
    import re
    t = re.sub(r"<[^>]+>", "", text)
    return t.replace("&nbsp;", " ").strip()


def frame_step(
    *,
    section: str,
    step_i: int,
    step_n: int,
    title: str,
    body: str,
    shot_name: str,
    caption: str = "",
) -> Image.Image:
    """매뉴얼 단계별 1장 — 큰 실제 화면 + 순서 설명."""
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)

    eyebrow(draw, M, 28, section)
    # STEP X / N
    badge = f"{step_i:02d}  /  {step_n:02d}"
    txt(draw, (M, 68), badge, font(22, True), TEAL)
    txt(draw, (M + 160, 62), title, font(34, True), INK)
    draw.line((M, 118, W - M, 118), fill=HAIR, width=1)

    # body text strip
    y = 136
    for i, line in enumerate(wrap(draw, plain(body), font(22), W - 2 * M)):
        if i >= 3:
            break
        txt(draw, (M, y + i * 30), line, font(22), SOFT)
    text_h = min(3, len(wrap(draw, plain(body), font(22), W - 2 * M))) * 30
    shot_top = 136 + text_h + 24

    # large screenshot card
    rx0, ry0, rx1, ry1 = M, shot_top, W - M, H - 56
    canvas = shadow_card(canvas, (rx0, ry0, rx1, ry1), radius=16, blur=12, alpha=20)
    draw = ImageDraw.Draw(canvas)
    rr(draw, (rx0, ry0, rx1, ry1), WHITE, r=16, outline=HAIR, w=1)
    label = caption or "실제 화면"
    txt(draw, (rx0 + 20, ry0 + 14), plain(label), font(14, True), MUTED)
    paste_fit(canvas, load_shot(shot_name), (rx0 + 14, ry0 + 42, rx1 - 14, ry1 - 14))
    return canvas


def steps_slides(prefix: str, section: str, steps: list[tuple[str, str, str, str]]) -> list[tuple[str, object]]:
    """(shot, title, body, caption) → 순서 슬라이드 목록."""
    n = len(steps)
    out = []
    for i, (shot, title, body, caption) in enumerate(steps, 1):
        name = f"{prefix}-s{i:02d}"
        out.append((
            name,
            lambda shot=shot, title=title, body=body, caption=caption, i=i, n=n, section=section: frame_step(
                section=section,
                step_i=i,
                step_n=n,
                title=title,
                body=body,
                shot_name=shot,
                caption=caption,
            ),
        ))
    return out


def frame_mobile() -> Image.Image:
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)
    eyebrow(draw, M, 36, "02  Mobile")
    txt(draw, (M, 80), "모바일에서 좌표 확인", font(36, True), INK)
    txt(draw, (M, 136), "실제 모바일 화면 — 말뚝을 누르면 좌표·번호가 표시됩니다.", font(20), SOFT)
    draw.line((M, 180, W - M, 180), fill=HAIR, width=1)

    cards = [
        ("mobile-access", "01", "접속", "브라우저 주소 입력"),
        ("mobile-loaded", "02", "불러오기", "프로젝트 · 버전"),
        ("mobile-coord-tooltip", "03", "말뚝 누르기", "좌표 · 번호 확인"),
    ]
    cw = 570
    gap = 28
    for i, (name, num, title, desc) in enumerate(cards):
        x = M + i * (cw + gap)
        y = 210
        canvas = shadow_card(canvas, (x, y, x + cw, y + 790), radius=18, blur=14, alpha=24)
        draw = ImageDraw.Draw(canvas)
        rr(draw, (x, y, x + cw, y + 790), WHITE, r=18, outline=HAIR)
        txt(draw, (x + 28, y + 24), num, font(18, True), TEAL)
        draw.line((x + 68, y + 26, x + 68, y + 50), fill=HAIR, width=1)
        txt(draw, (x + 82, y + 22), title, font(24, True), INK)
        txt(draw, (x + 28, y + 62), desc, font(17), SOFT)
        paste_fit(canvas, load_shot(name), (x + 36, y + 110, x + cw - 36, y + 750))
    return canvas


def frame_materials() -> Image.Image:
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)
    eyebrow(draw, M, 36, "Prep")
    txt(draw, (M, 80), "필요 자료 · 도면 전달", font(36, True), INK)
    txt(draw, (M, 136), "자료 수집·등록은 본사. 현장은 수령 시 아래 기준으로 전달합니다.", font(20), SOFT)
    draw.line((M, 180, W - M, 180), fill=HAIR, width=1)

    lx0, ly0 = M, 210
    lx1, ly1 = 900, H - 48
    canvas = shadow_card(canvas, (lx0, ly0, lx1, ly1), radius=18, blur=14, alpha=24)
    draw = ImageDraw.Draw(canvas)
    rr(draw, (lx0, ly0, lx1, ly1), WHITE, r=18, outline=HAIR)
    txt(draw, (lx0 + 36, ly0 + 28), "현장 → 본사 전달", font(20, True), INK)
    rows = [
        ("도면", "시공사·설계사 최신 도면(CAD)", "도면 수령 시"),
        ("측량", "현황 측량 성과품", "수령 시"),
        ("변경", "도면 변경·추가분", "변경 발생 시"),
    ]
    y = ly0 + 84
    for cat, item, when in rows:
        rr(draw, (lx0 + 28, y, lx1 - 28, y + 130), BG, r=14)
        txt(draw, (lx0 + 52, y + 28), cat, font(18, True), TEAL)
        draw.line((lx0 + 120, y + 30, lx0 + 120, y + 100), fill=HAIR, width=1)
        txt(draw, (lx0 + 140, y + 28), item, font(22), INK)
        txt(draw, (lx0 + 140, y + 72), when, font(17), MUTED)
        y += 148

    rx0, ry0, rx1, ry1 = 928, 210, W - M, H - 48
    canvas = shadow_card(canvas, (rx0, ry0, rx1, ry1), radius=18, blur=14, alpha=24)
    draw = ImageDraw.Draw(canvas)
    rr(draw, (rx0, ry0, rx1, ry1), WHITE, r=18, outline=HAIR)
    txt(draw, (rx0 + 24, ry0 + 22), "실제 메인 화면", font(13, True), MUTED)
    draw.line((rx0 + 24, ry0 + 50, rx1 - 24, ry0 + 50), fill=HAIR, width=1)
    paste_fit(canvas, load_shot("00-main-clean"), (rx0 + 16, ry0 + 62, rx1 - 16, ry1 - 16))
    return canvas


def frame_end() -> Image.Image:
    canvas = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 8, H), fill=TEAL)
    shot = fit(load_shot("00-main-clean"), 960, 540)
    faded = shot.point(lambda p: int(p * 0.22))
    canvas.paste(faded, ((W - shot.width) // 2, 100))
    draw = ImageDraw.Draw(canvas)
    msg = "문의는 본사(건축BIM팀)으로"
    tw = draw.textlength(msg, font=font(40, True))
    txt(draw, ((W - tw) / 2, 560), msg, font(40, True), WHITE)
    url = "https://pilexy.yeobaekstudio.com/"
    tw = draw.textlength(url, font=font(24, True))
    txt(draw, ((W - tw) / 2, 630), url, font(24, True), (153, 246, 228))
    tip = "기능 순서  ① → ⑧"
    tw = draw.textlength(tip, font=font(22))
    txt(draw, ((W - tw) / 2, 720), tip, font(22), MUTED)
    return canvas


def build_all() -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)

    # 매뉴얼(PDF)과 동일한 단계별 실제 화면 순서
    LOAD_STEPS = [
        ("01-access-main", "브라우저 접속",
         "주소창에 https://pilexy.yeobaekstudio.com/ 입력 후 접속합니다.",
         "파일 마스터 접속 화면 — 별도 설치 없이 브라우저에서 실행"),
        ("step-load-btn", "「불러오기」",
         "상단 작업 버전 → 불러오기를 클릭합니다. (본사에서 세팅·저장해 둔 작업을 불러옵니다)",
         "상단 「불러오기」 버튼 위치"),
        ("step-load-panel", "프로젝트·버전 선택",
         "좌측에서 해당 프로젝트를 고르고, 우측 목록에서 최신 버전을 확인합니다.",
         "불러오기 패널 — 프로젝트 검색·버전 목록"),
        ("step-load-select", "「불러오기」 실행",
         "해당 버전 오른쪽 불러오기 버튼을 누르면 도면·좌표·동 설정이 화면에 적용됩니다.",
         "선택한 버전의 「불러오기」 실행"),
        ("00-main-clean", "메인 화면",
         "캔버스에 말뚝 좌표가 표시됩니다. 확대·이동으로 현장 배치를 확인할 수 있습니다.",
         "작업 불러온 후 메인 화면 — 캔버스 전체 확인"),
    ]
    COORDS_STEPS = [
        ("00-main-clean", "메인 화면 · 좌표",
         "캔버스에 말뚝 좌표가 표시됩니다. 드래그로 이동·휠로 확대/축소합니다.",
         "메인 화면 — 말뚝 좌표 확인"),
        ("mobile-coord-tooltip", "모바일 말뚝 확인",
         "스마트폰에서도 같은 주소로 접속해 말뚝을 누르면 좌표·번호를 확인할 수 있습니다.",
         "모바일 — 말뚝 터치 시 좌표·번호"),
    ]
    PARCEL_STEPS = [
        ("step-parcel-btn", "「필지 검토」",
         "상단 시공 → 필지 검토에서 지적·필지·좌표등록부를 확인합니다. (PDAM과 별개)",
         "필지 검토 버튼"),
        ("06-parcel-review", "필지·침범 확인",
         "메인 캔버스 항목의 필지 검토 뷰어 표시 체크박스를 켠 뒤, 말뚝과 필지 경계·좌표등록부를 겹쳐 침범 여부를 검토합니다.",
         "필지 검토 뷰어 표시 ON — 겹침 검토"),
        ("step-retaining-btn", "흙막이 라인 열기",
         "캔버스 좌측 하단 「흙막이 라인」 — 검토할 때만 열어 사용합니다.",
         "캔버스 좌측 하단 흙막이 버튼"),
        ("step-retaining-open", "폴리라인 선택",
         "「선택」 후 도면에서 흙막이 폴리라인을 클릭해 지정합니다.",
         "흙막이 패널 — 선택·거리 계산"),
        ("09-retaining-wall", "거리 계산 · 결과",
         "「거리 계산」으로 말뚝과 흙막이 이격 거리를 확인합니다. 검토 후 패널을 닫습니다.",
         "이격 거리 결과 · 캔버스 반영"),
    ]
    PDAM_STEPS = [
        ("10-pdam-login", "PDAM 시스템 (참고)",
         "아래는 we8104 PDAM 시공 기록 시스템입니다. 파일 마스터에서는 이 사이트에 직접 로그인하지 않고, 설정 탭에서 ID·PW를 입력해 연동합니다.",
         "PDAM 시스템 화면 (참고)"),
        ("step-status-btn", "「시공현황」 열기",
         "상단 시공 → 시공현황을 클릭합니다.",
         "상단 시공현황 버튼"),
        ("step-pdam-tab", "설정 탭",
         "패널 상단 설정 탭으로 이동합니다.",
         "시공현황 패널 — 설정 탭"),
        ("04-pdam-settings", "PDAM 계정 · 로그인",
         "설정 탭에서 PDAM ID · PW를 입력합니다. (현장 계정 — 변경 시 본사 문의)",
         "설정 탭 — PDAM ID · 비밀번호"),
        ("step-pdam-sync", "PDAM 동기화",
         "PDAM 동기화 버튼으로 we8104 기록지를 자동 가져옵니다. 별도 엑셀 전달은 필요 없습니다.",
         "PDAM 동기화 — 기록지 자동 수집"),
    ]
    STATUS_STEPS = [
        ("03-construction-status", "시공현황 패널",
         "시공현황 탭에서 색상·기간·장비 필터를 설정합니다.",
         "시공현황 탭 — 필터·차트·날짜 범위"),
        ("step-status-apply", "현황 적용",
         "조건 설정 후 현황 적용을 누르면 캔버스에 박음/미시공 색상이 반영됩니다.",
         "현황 적용 — 캔버스 색상 반영"),
        ("step-playback", "시뮬레이션",
         "시뮬레이션으로 날짜별 시공 진행을 재생·확인할 수 있습니다.",
         "시뮬레이션 재생 — 날짜별 진행"),
    ]
    SETTLEMENT_STEPS = [
        ("step-settlement-btn", "「기성정리」",
         "상단 시공 → 기성정리를 클릭합니다.",
         "기성정리 탭 진입"),
        ("05-settlement", "기성표 확인",
         "기준 월을 선택하고 기성 내역을 표에서 확인합니다.",
         "기성 정리표 — 월별 집계"),
        ("step-settlement-calc", "기성 다시 계산",
         "기성 다시 계산으로 표를 갱신합니다.",
         "기성 다시 계산 버튼"),
        ("step-settlement-xlsx", "기성정리표 XLSX",
         "표 하단 기성 정리표 엑셀 다운로드로 XLSX를 저장합니다.",
         "엑셀 다운로드 버튼"),
        ("step-settlement-xlsx-preview", "엑셀 수식 확인",
         "다운로드 XLSX 상단 — 버림콘 두께·기성 집계 수식 (엑셀 수식 표시 모드)",
         "기성정리표 엑셀 — 수식 일부"),
    ]
    MATERIALS_STEPS = [
        ("step-materials-btn", "「자재관리」",
         "상단 자재관리를 클릭합니다.",
         "자재관리 버튼"),
        ("08-materials", "동별 계획 · 매트릭스",
         "좌측 동별 계획 매트릭스에서 길이별 계획·입고·사용을 확인합니다.",
         "자재관리 — 동별·길이별 매트릭스"),
        ("step-materials-summary", "길이별 요약",
         "우측 길이별 요약 — 계획·반입·사용(PDAM)·파손·재고·미발주.",
         "길이별 요약 표"),
        ("step-materials-supplier", "업체별 발주 현황",
         "우측 업체별 말뚝·파일 발주 현황 — 공장별 반입·발주 집계.",
         "업체별 발주·반입"),
        ("step-materials-receipts", "자재 입고",
         "좌측 입고·발주 표에서 일자별 반입 내역을 입력·관리합니다.",
         "입고·발주 입력"),
        ("step-materials-damage", "파손 · 반출",
         "우측 파손·반출 — 파손 본수·길이를 기록합니다.",
         "파손·반출 표"),
        ("step-materials-cement", "시멘트 벌크",
         "우측 시멘트 벌크 — PDAM 시공 기준 예상 시멘트·입고 누적·잔량.",
         "시멘트 벌크 — 발주·입고·잔량"),
    ]
    BILLING_STEPS = [
        ("step-billing-btn", "「정산관리」",
         "상단 정산관리를 클릭합니다.",
         "정산관리 버튼"),
        ("08-billing-panel", "항타기 운용 현황",
         "기간·호기 수를 설정하고 일별 항타기 운용(가동·휴무·우천 등)을 표에서 입력·확인합니다.",
         "정산관리 — 일별 항타기 운용 표"),
    ]
    VERSION_STEPS = [
        ("step-version-btn", "「버전 비교」",
         "상단 비교 → 버전 비교를 클릭합니다.",
         "버전 비교 버튼"),
        ("step-version-select", "버전 선택",
         "이전/현재 버전을 각각 선택합니다.",
         "이전·현재 버전 선택"),
        ("step-version-apply", "비교 적용",
         "비교 적용을 누르면 동별 요약·캔버스에 변경 말뚝이 표시됩니다.",
         "비교 적용"),
        ("07-version-compare", "비교 결과",
         "동별 요약과 캔버스에서 변경·이동 말뚝을 확인합니다.",
         "버전 비교 결과 — 동별 요약·캔버스"),
        ("step-version-excel", "업체 엑셀 비교",
         "「업체 엑셀 비교」로 시공사 좌표 엑셀과 도면 버전을 대조합니다.",
         "엑셀 좌표 비교 모달"),
        ("step-version-excel-issues", "엑셀 비교 결과",
         "누락·좌표 불일치·건너뛴 행을 표로 확인하고 XLSX로 내보낼 수 있습니다.",
         "엑셀 비교 — 불일치 목록"),
    ]

    ordered: list[tuple[str, object]] = [
        ("00-cover", frame_cover),
        ("d-prep", lambda: frame_divider(
            num="준비", title="필요 자료",
            subtitle="현장 → 본사로 전달하는 도면·측량 자료 기준입니다.",
            art_name="div-prep",
        )),
        ("05-materials", frame_materials),
        ("d01-load", lambda: frame_divider(
            num="1", title="불러오기",
            subtitle="매뉴얼 순서대로 실제 화면을 따라가면 됩니다.",
            art_name="div-01-load",
        )),
        *steps_slides("02-load", "01  불러오기", LOAD_STEPS),
        ("d02-coords", lambda: frame_divider(
            num="2", title="좌표 확인",
            subtitle="메인·모바일에서 말뚝 좌표·번호를 확인합니다.",
            art_name="div-02-coords",
        )),
        *steps_slides("03-coords", "02  좌표 확인", COORDS_STEPS),
        ("04-mobile", frame_mobile),
        ("d03-parcel", lambda: frame_divider(
            num="3", title="필지 검토",
            subtitle="필지 경계·침범과 흙막이 이격을 순서대로 검토합니다.",
            art_name="div-03-parcel",
        )),
        *steps_slides("06-parcel", "03  필지 · 흙막이", PARCEL_STEPS),
        ("d04-pdam", lambda: frame_divider(
            num="4", title="PDAM 연동",
            subtitle="설정 탭에서 로그인하고 기록지를 자동 수집합니다.",
            art_name="div-04-pdam",
        )),
        *steps_slides("08-pdam", "04  PDAM 연동", PDAM_STEPS),
        ("d05-status", lambda: frame_divider(
            num="5", title="시공현황",
            subtitle="현황 색상과 날짜별 시뮬레이션을 순서대로 확인합니다.",
            art_name="div-05-status",
        )),
        *steps_slides("09-status", "05  시공현황", STATUS_STEPS),
        ("d06-settlement", lambda: frame_divider(
            num="6", title="기성정리",
            subtitle="기성 표 확인 · 재계산 · 엑셀 저장 순서로 진행합니다.",
            art_name="div-06-settlement",
        )),
        *steps_slides("10-settlement", "06  기성정리", SETTLEMENT_STEPS),
        ("d07-mat", lambda: frame_divider(
            num="7", title="자재 · 정산",
            subtitle="자재관리와 항타기 정산을 매뉴얼 순서대로 진행합니다.",
            art_name="div-07-mat",
        )),
        *steps_slides("11-mat", "07  자재관리", MATERIALS_STEPS),
        *steps_slides("12-billing", "07  정산관리", BILLING_STEPS),
        ("d08-version", lambda: frame_divider(
            num="8", title="버전 비교",
            subtitle="버전 선택 · 비교 · 엑셀 대조를 순서대로 진행합니다.",
            art_name="div-08-version",
        )),
        *steps_slides("13-version", "08  버전 비교", VERSION_STEPS),
        ("14-end", frame_end),
    ]

    names = ["00-cover", "01-toc", "01-flow"] + [n for n, _ in ordered[1:]]
    page_of = {name: i + 1 for i, name in enumerate(names)}

    toc_entries = [
        ("준비", "필요 자료 · 도면 전달", page_of["d-prep"]),
        ("01", "불러오기", page_of["d01-load"]),
        ("02", "좌표 확인", page_of["d02-coords"]),
        ("03", "필지 검토", page_of["d03-parcel"]),
        ("04", "PDAM 연동", page_of["d04-pdam"]),
        ("05", "시공현황", page_of["d05-status"]),
        ("06", "기성정리", page_of["d06-settlement"]),
        ("07", "자재 · 정산", page_of["d07-mat"]),
        ("08", "버전 비교", page_of["d08-version"]),
    ]
    flow_items = [
        ("준비", "필요 자료", "00-main-clean", page_of["d-prep"]),
        ("01", "불러오기", "step-load-panel", page_of["d01-load"]),
        ("02", "좌표 확인", "00-main-clean", page_of["d02-coords"]),
        ("03", "필지 검토", "06-parcel-review", page_of["d03-parcel"]),
        ("04", "PDAM", "04-pdam-settings", page_of["d04-pdam"]),
        ("05", "시공현황", "03-construction-status", page_of["d05-status"]),
        ("06", "기성정리", "05-settlement", page_of["d06-settlement"]),
        ("07", "자재·정산", "08-materials", page_of["d07-mat"]),
        ("08", "버전 비교", "07-version-compare", page_of["d08-version"]),
    ]

    specs: list[tuple[str, object]] = [
        ordered[0],
        ("01-toc", lambda: frame_toc(toc_entries)),
        ("01-flow", lambda: frame_flow(flow_items)),
        *ordered[1:],
    ]

    order_path = OUT / "_slide_order.txt"
    order_path.write_text("\n".join(n for n, _ in specs) + "\n", encoding="utf-8")

    paths = []
    for name, fn in specs:
        img = fn()
        path = OUT / f"{name}.png"
        img.save(path, "PNG", optimize=True)
        print(f"  OK {path.name}  (p.{page_of.get(name, '?')})")
        paths.append(path)
    return paths


if __name__ == "__main__":
    print(f"OUT: {OUT}")
    build_all()
    print("Done.")
