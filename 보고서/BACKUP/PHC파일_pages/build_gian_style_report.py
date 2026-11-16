# -*- coding: utf-8 -*-
"""기안 폴더(사전검토서·기획안) 서식을 반영한 PHC파일마스터 가로 보고서 생성.

DOCX로 표 헤더/색/정렬을 정확히 맞춘 뒤 Hangul에서 HWP로 저장한다.
"""
from __future__ import annotations

import subprocess
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
from docx.shared import Cm, Pt, RGBColor, Twips
from PIL import ImageGrab
import win32com.client

OUT_DIR = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
DOCX = OUT_DIR / "PHC파일_관리시스템_파일마스터_기안서식.docx"
HWP = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_기안서식.hwp")
HWP2 = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_기안서식.hwp")
SHOT = OUT_DIR / "gian_style_shots"
SHOT.mkdir(parents=True, exist_ok=True)

# 기안 샘플 색 (BIM 통합운영 가로안 + 사전검토서 표)
NAVY = "1F4E79"
TITLE_BAR = "D6EAF8"  # 연한 하늘색 제목바
AUTH_BAR = "1F4E79"  # 남색 작성자바
HEADER_TEAL = "D6EAEA"  # 가로 기안 표 헤더 (연청록)
HEADER_GRAY = "D9D9D9"  # 사전검토서 표 헤더
ACCENT_BLUE = RGBColor(0x1F, 0x4E, 0x79)
BLACK = RGBColor(0x00, 0x00, 0x00)

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


def set_run_font(run, size=10.5, bold=False, color=None, name="맑은 고딕"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def shade_cell(cell, hex_color: str) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag == qn("w:shd"):
            tcPr.remove(child)
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{hex_color}"/>'))


def set_cell_borders(cell, color="808080", sz="4") -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag == qn("w:tcBorders"):
            tcPr.remove(child)
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), sz)
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tcPr.append(borders)


def set_cell_margins(cell, top=40, bottom=40, left=60, right=60) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag == qn("w:tcMar"):
            tcPr.remove(child)
    mar = OxmlElement("w:tcMar")
    for name, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{name}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tcPr.append(mar)


def clear_cell(cell) -> None:
    cell.text = ""


def write_cell(
    cell,
    text: str,
    *,
    bold=False,
    size=9,
    align="center",
    color=None,
    fill=None,
    font="맑은 고딕",
) -> None:
    clear_cell(cell)
    if fill:
        shade_cell(cell, fill)
    set_cell_borders(cell)
    set_cell_margins(cell)
    align_enum = {
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }[align]
    lines = text.split("\n") if text else [""]
    for i, line in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.alignment = align_enum
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.1
        run = p.add_run(line)
        set_run_font(run, size=size, bold=bold, color=color or BLACK, name=font)
    cell.vertical_alignment = 1  # center


def add_para(doc, text="", *, size=10.5, bold=False, color=None, align="left", space_after=4):
    p = doc.add_paragraph()
    p.alignment = {
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }[align]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.2
    if text:
        run = p.add_run(text)
        set_run_font(run, size=size, bold=bold, color=color)
    return p


def add_mixed_para(doc, parts, *, size=10.5, space_after=3):
    """parts: list of (text, bold, color|None)"""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.2
    for text, bold, color in parts:
        run = p.add_run(text)
        set_run_font(run, size=size, bold=bold, color=color)
    return p


def section_heading(doc, text: str) -> None:
    add_para(doc, text, size=12, bold=True, color=ACCENT_BLUE, space_after=6)


def make_table(doc, data, col_widths_cm, header_fill=HEADER_TEAL, header_white=False):
    rows, cols = len(data), len(data[0])
    table = doc.add_table(rows=rows, cols=cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for i, w in enumerate(col_widths_cm):
        for row in table.rows:
            row.cells[i].width = Cm(w)
    for r, row_data in enumerate(data):
        for c, val in enumerate(row_data):
            is_header = r == 0
            # 구분/번호 열·짧은 열은 가운데, 서술 열은 좌측
            align = "center"
            if not is_header and c in (1, 2, 3) and cols >= 4:
                align = "left"
            if not is_header and cols == 3 and c >= 0:
                align = "left" if c > 0 else "center"
            write_cell(
                table.rows[r].cells[c],
                val,
                bold=is_header or (c == 0 and not is_header and cols >= 4),
                size=8.5 if cols >= 4 else 9,
                align=align if not is_header else "center",
                color=RGBColor(0xFF, 0xFF, 0xFF) if (is_header and header_white) else BLACK,
                fill=header_fill if is_header else None,
            )
    # 표 뒤 여백
    add_para(doc, "", space_after=2)
    return table


def build_docx() -> Path:
    doc = Document()
    section = doc.sections[0]
    # 기안 폴더 사전검토서 주류 = 세로 A4
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.5)

    # 외곽 느낌: 제목바 + 작성자바 (기안 가로/사전검토서 공통 패턴)
    title_tbl = doc.add_table(rows=1, cols=1)
    title_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = title_tbl.rows[0].cells[0]
    c.width = Cm(17.2)
    write_cell(
        c,
        "PHC파일 관리시스템 개발 및 적용(안)",
        bold=True,
        size=15,
        align="center",
        fill=TITLE_BAR,
    )
    set_cell_borders(c, color=NAVY, sz="12")

    auth = doc.add_table(rows=1, cols=2)
    auth.alignment = WD_TABLE_ALIGNMENT.CENTER
    left, right = auth.rows[0].cells
    left.width = Cm(8.6)
    right.width = Cm(8.6)
    write_cell(left, "건축BIM팀 정헌재 선임", bold=True, size=10, align="left", color=RGBColor(0xFF, 0xFF, 0xFF), fill=AUTH_BAR)
    write_cell(right, "2026. 08. 12", bold=True, size=10, align="right", color=RGBColor(0xFF, 0xFF, 0xFF), fill=AUTH_BAR)
    set_cell_borders(left, color=NAVY, sz="4")
    set_cell_borders(right, color=NAVY, sz="4")
    add_para(doc, "", space_after=6)

    # 요약 배지 + 한 줄
    badge = doc.add_table(rows=1, cols=2)
    b0, b1 = badge.rows[0].cells
    b0.width = Cm(1.6)
    b1.width = Cm(15.6)
    write_cell(b0, "요약", bold=True, size=9, color=RGBColor(0xFF, 0xFF, 0xFF), fill=NAVY)
    write_cell(
        b1,
        "현황→원인→착안을 표로 정리하고, 목적·기능으로 연결한 뒤 베타 운영(로그인·서버) 제약과 향후 이관·정책으로 마무리",
        size=9.5,
        align="left",
        fill="EEF5FA",
    )
    add_para(doc, "", space_after=4)

    # 1. 개요
    section_heading(doc, "1. 개요")
    add_mixed_para(
        doc,
        [
            ("시스템명 : ", False, None),
            ("PHC파일 관리시스템 (명칭 : 파일마스터)", True, ACCENT_BLUE),
        ],
    )
    add_para(
        doc,
        "PHC파일 좌표 자동 추출 기능으로 설계도면과 시공도면과의 정합성을 확인하고, "
        "PDAM과 연동하여 PHC파일의 시공 현황을 관리하고, 기성 및 자재관리를 할 수 있는 "
        "자체 개발 프로그램으로, 모바일 활용이 가능함.",
        size=10.5,
        space_after=8,
    )

    # 2. 현황 및 문제점
    section_heading(doc, "2. 현황 및 문제점")
    add_para(
        doc,
        "※ 현황만 나열하지 않고, 원인 → 착안(기능 방향)까지 한 표로 정리",
        size=9,
        color=RGBColor(0x66, 0x66, 0x66),
        space_after=4,
    )
    status_rows = [
        ["구분", "현황 및 문제점", "원인", "착안", "비고"],
        [
            "1",
            "설계도면 좌표와 시공도면 좌표 불일치\n(재시공, 오시공, 시공지연)",
            "협력사 시공도면 좌표 수기 작성 오류\n/ 공사 담당자 처리 데이터량 과다",
            "손쉬운 좌표추출 및 비교 필요",
            "",
        ],
        [
            "2",
            "대지경계, 흙막이와 말뚝 이격거리 부족\n(시공지연)",
            "설계도면 오류 인력 확인 어려움",
            "지적·이격거리 자동 검토 필요",
            "",
        ],
        [
            "3",
            "빈번한 도면 변경에 따른 시공지연\n/ 종이도면 확인 업무 부담",
            "도면 변경 시 좌표 수기 추출로 오류",
            "모바일 자료 필요",
            "",
        ],
        [
            "4",
            "PDAM 적용 현황 관리 미흡",
            "시공 데이터와 도면 데이터 연계 부족",
            "PDAM 연동 항타관리",
            "",
        ],
        [
            "5",
            "분산된 데이터로 관리 어려움",
            "공구 분할, 외주 데이터(PDAM, 드론)",
            "통합관리",
            "",
        ],
        [
            "6",
            "기성관리 어려움",
            "입고·시공·높이별 물량 산출 수작업",
            "기성·자재 자동 산출",
            "",
        ],
        [
            "7",
            "현장별 관리시트 상이",
            "표준 관리양식 부재",
            "전현장 표준관리체계",
            "",
        ],
    ]
    make_table(doc, status_rows, [1.1, 5.0, 4.6, 3.8, 1.5], header_fill=HEADER_TEAL)

    # 3. 목적 및 기능
    section_heading(doc, "3. 목적 및 기능")
    add_para(doc, "1) 목적", size=11, bold=True, space_after=3)
    for line in [
        "① CAD도면상 좌표 자동 추출 및 비교를 통한 설계·시공도면 정합성 확보",
        "② 도면, PDAM, 드론 데이터 통합관리를 통한 시공현황 일원화",
        "③ 파일 입고, 시공, 높이별 기성물량 자동 산출을 통한 기성·자재관리 효율화",
        "④ 전현장 표준관리체계 구축 및 모바일 활용 지원",
    ]:
        add_para(doc, line, size=10, space_after=2)

    add_para(doc, "2) 주요기능 및 기대효과", size=11, bold=True, space_after=3)
    add_para(doc, "※ 2장 착안을 기능·효과로 구체화", size=9, color=RGBColor(0x66, 0x66, 0x66), space_after=3)
    func_rows = [
        ["착안", "주요기능", "기대효과"],
        ["손쉬운 좌표추출 및 비교", "① 좌표 추출·정합", "설계·시공도면 불일치 조기 발견"],
        ["모바일 자료 필요", "② 모바일 좌표기능", "종이도면 확인 부담 경감"],
        ["PDAM 연동 항타관리", "③ PDAM 항타관리", "시공기록과 도면 연계"],
        ["통합관리", "④ 드론데이터 활용", "외주·측량 데이터 일원화"],
        ["지적·이격 자동 검토", "⑤ 지적·이격 검토", "이격 부족으로 인한 시공지연 예방"],
        ["통합관리 / 공정 가시화", "⑥ 공구별 시공 시뮬레이션", "공구 단위 시공 진행 파악"],
        ["기성·자재 자동 산출 / 표준관리", "⑦ 기성·자재관리", "수작업 물량산출·현장별 시트 편차 해소"],
    ]
    make_table(doc, func_rows, [5.2, 5.2, 5.6], header_fill=HEADER_GRAY)

    # 4. 개발 경과
    section_heading(doc, "4. 개발 경과")
    add_mixed_para(
        doc,
        [
            ("1) 시스템 구축 : ", False, None),
            ("2026.08~", True, ACCENT_BLUE),
            (" (자체개발)", False, None),
        ],
    )
    add_para(doc, "2) 시범적용 및 피드백 : 청주씨엘리체 적용중, PoC 현장 피드백 반영 중", size=10.5, space_after=8)

    # 5. 운영 계획 — 사전검토서식 2열 정보표 + 불릿
    section_heading(doc, "5. 운영 계획")
    ops = [
        ["항목", "내용"],
        ["운영 방식", "베타 버전 (사유 : 전사 로그인 정책 반영 협의중)"],
        ["주관", "건축BIM팀 운영"],
        ["절차", "현장 요청  →  BIM팀 접수 및 세팅  →  현장WEB 공유"],
        [
            "고려사항",
            "① 클라우드 서버 사용 (추후 5층 운영서버 사용, 디지털개발팀 협의완료)\n"
            "② 로그인 정책 미확정으로 사용 전체 현장 현황 확인 불가피",
        ],
    ]
    make_table(doc, ops, [3.0, 13.0], header_fill=HEADER_TEAL)

    # 6. 향후 계획
    section_heading(doc, "6. 향후 계획")
    future = [
        ["구분", "계획", "비고"],
        ["서버 이관", "클라우드 → 5층 운영서버", "디지털개발팀 협의완료"],
        ["로그인 정책", "전사 로그인 정책 확정·반영 후 정식 운영", "전체 현장 현황 관리"],
    ]
    make_table(doc, future, [3.0, 9.0, 4.0], header_fill=HEADER_GRAY)

    # 정리
    wrap = doc.add_table(rows=1, cols=1)
    wc = wrap.rows[0].cells[0]
    write_cell(
        wc,
        "정리 : 문제(현황) → 원인 → 착안 → 목적·기능 연결 / 운영은 베타·로그인·서버 제약 명시 / 향후 = 서버 이관·로그인 정책",
        size=9.5,
        bold=True,
        align="left",
        fill="FFF2CC",
    )
    set_cell_borders(wc, color="BF8F00", sz="8")

    if DOCX.exists():
        try:
            DOCX.unlink()
        except Exception:
            pass
    doc.save(str(DOCX))
    print("DOCX", DOCX, DOCX.stat().st_size)
    return DOCX


def convert_to_hwp(docx: Path):
    """DOCX(기안 표 서식)를 한글에서 열어 HWP로 저장. 기안 폴더 주류는 세로 사전검토서."""
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(1.5)
    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.Open(str(docx))
    time.sleep(1.5)

    # 사전검토서형 세로 A4 (PaperLandscape Run은 토글이라 사용 금지)
    try:
        pset = hwp.HParameterSet.HSecDef
        hwp.HAction.GetDefault("PageSetup", pset.HSet)
        pset.PageDef.Landscape = 0
        pset.PageDef.PaperWidth = 59528
        pset.PageDef.PaperHeight = 84189
        mm = lambda x: int(x * 283.465)
        pset.PageDef.LeftMargin = mm(18)
        pset.PageDef.RightMargin = mm(18)
        pset.PageDef.TopMargin = mm(15)
        pset.PageDef.BottomMargin = mm(15)
        hwp.HAction.Execute("PageSetup", pset.HSet)
    except Exception as e:
        print("pagesetup", e)

    for path in (HWP, HWP2):
        if path.exists():
            try:
                path.unlink()
            except Exception:
                pass
    try:
        hwp.SaveAs(str(HWP), "HWP")
    except Exception:
        ps = hwp.HParameterSet.HFileOpenSave
        hwp.HAction.GetDefault("FileSaveAs_S", ps.HSet)
        ps.filename = str(HWP)
        ps.Format = "HWP"
        hwp.HAction.Execute("FileSaveAs_S", ps.HSet)
    time.sleep(1.0)
    print("HWP", HWP.exists(), HWP.stat().st_size if HWP.exists() else 0)
    if HWP.exists():
        try:
            HWP2.parent.mkdir(parents=True, exist_ok=True)
            HWP2.write_bytes(HWP.read_bytes())
            print("COPIED", HWP2)
        except Exception as e:
            print("copy", e)

    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    (OUT_DIR / "gian_style_text.txt").write_text(txt, encoding="utf-8")
    print("TEXT_LEN", len(txt), "OK", "파일마스터" in txt and "착안" in txt and "베타" in txt)

    screenshot(hwp, "gian", 2)
    return hwp


def screenshot(hwp, prefix: str, n: int = 3) -> None:
    wins = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _lp):
        if not user32.IsWindowVisible(hwnd):
            return True
        ln = user32.GetWindowTextLengthW(hwnd)
        if not ln:
            return True
        t = ctypes.create_unicode_buffer(ln + 1)
        user32.GetWindowTextW(hwnd, t, ln + 1)
        c = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, c, 256)
        if "HwpApp" in c.value:
            wins.append((hwnd, t.value))
        return True

    user32.EnumWindows(cb, 0)
    if not wins:
        return
    hwnd, title = wins[0]
    for h, t in wins:
        if "기안" in t or "PHC" in t or "파일" in t:
            hwnd, title = h, t
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    try:
        hwp.HAction.Run("MoveDocBegin")
    except Exception:
        pass
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    for i in range(1, n + 1):
        img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
        p = SHOT / f"{prefix}_p{i}.png"
        img.save(p)
        print("SHOT", p.name, title)
        try:
            hwp.HAction.Run("MovePageDown")
        except Exception:
            pass
        time.sleep(0.4)


def main() -> None:
    docx = build_docx()
    hwp = convert_to_hwp(docx)
    print("DONE")
    # leave Hangul open for user review; still quit to avoid lock? keep open
    # hwp.Quit()


if __name__ == "__main__":
    main()
