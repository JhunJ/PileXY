# -*- coding: utf-8 -*-
"""
파일마스터 임원용 가로 보고서 (4쪽 압축).
서식: 가로형 구축안(바로빔 통합운영 / 도면데이터추출 v3) — 세로 사전검토서 아님.
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
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
from docx.shared import Cm, Pt, RGBColor
from PIL import ImageGrab
import win32com.client

OUT = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
ASSETS = OUT / "assets" / "thumb"
DOCX = OUT / "PHC파일_관리시스템_파일마스터_임원용_가로.docx"
HWP = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_임원용_가로.hwp")
HWP2 = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_임원용_가로.hwp")
SHOT = OUT / "exec_land_shots"
SHOT.mkdir(parents=True, exist_ok=True)

NAVY, TITLE_BAR, TEAL, GRAY, SOFT, YELLOW = "1F4E79", "D6EAF8", "D6EAEA", "D9D9D9", "EEF5FA", "FFF2CC"
BLUE, BLACK, WHITE = RGBColor(0x1F, 0x4E, 0x79), RGBColor(0, 0, 0), RGBColor(0xFF, 0xFF, 0xFF)

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()


class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long), ("right", ctypes.c_long), ("bottom", ctypes.c_long)]


def set_run_font(run, size=10, bold=False, color=None, name="맑은 고딕"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def shade_cell(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag == qn("w:shd"):
            tcPr.remove(child)
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{hex_color}"/>'))


def set_cell_borders(cell, color="808080", sz="4"):
    tcPr = cell._tc.get_or_add_tcPr()
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


def write_cell(cell, text, *, bold=False, size=8.5, align="center", color=None, fill=None):
    cell.text = ""
    if fill:
        shade_cell(cell, fill)
    set_cell_borders(cell)
    ae = {"center": WD_ALIGN_PARAGRAPH.CENTER, "left": WD_ALIGN_PARAGRAPH.LEFT, "right": WD_ALIGN_PARAGRAPH.RIGHT}[align]
    for i, line in enumerate((text or "").split("\n")):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.alignment = ae
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        set_run_font(p.add_run(line), size=size, bold=bold, color=color or BLACK)
    cell.vertical_alignment = 1


def para(doc, text="", *, size=10, bold=False, color=None, after=2):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.1
    if text:
        set_run_font(p.add_run(text), size=size, bold=bold, color=color)
    return p


def mixed(doc, parts, *, size=10, after=2):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.1
    for text, bold, color in parts:
        set_run_font(p.add_run(text), size=size, bold=bold, color=color)
    return p


def heading(doc, text):
    para(doc, text, size=12, bold=True, color=BLUE, after=3)


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def header_block(doc, title):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.rows[0].cells[0]
    c.width = Cm(26.8)
    write_cell(c, title, bold=True, size=15, fill=TITLE_BAR)
    set_cell_borders(c, color=NAVY, sz="12")
    a = doc.add_table(rows=1, cols=2)
    a.alignment = WD_TABLE_ALIGNMENT.CENTER
    L, R = a.rows[0].cells
    L.width = Cm(13.4)
    R.width = Cm(13.4)
    write_cell(L, "건축BIM팀 정헌재 선임", bold=True, size=9.5, align="left", color=WHITE, fill=NAVY)
    write_cell(R, "2026. 08. 12", bold=True, size=9.5, align="right", color=WHITE, fill=NAVY)
    para(doc, "", after=2)


def summary_badge(doc, text):
    t = doc.add_table(rows=1, cols=2)
    b0, b1 = t.rows[0].cells
    b0.width = Cm(1.4)
    b1.width = Cm(25.4)
    write_cell(b0, "요약", bold=True, size=9, color=WHITE, fill=NAVY)
    write_cell(b1, text, size=9, align="left", fill=SOFT)
    para(doc, "", after=2)


def make_table(doc, data, widths, header_fill=TEAL, left_cols=None, size=8):
    left_cols = left_cols or set()
    table = doc.add_table(rows=len(data), cols=len(data[0]))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for i, w in enumerate(widths):
        for row in table.rows:
            row.cells[i].width = Cm(w)
    for r, row in enumerate(data):
        for c, val in enumerate(row):
            is_h = r == 0
            write_cell(
                table.rows[r].cells[c],
                val,
                bold=is_h or (c == 0 and not is_h),
                size=size,
                align="center" if is_h or c not in left_cols else "left",
                fill=header_fill if is_h else None,
            )
    para(doc, "", after=1)
    return table


def add_pics_row(doc, items, pic_w=5.8):
    exist = [(p, cap) for p, cap in items if Path(p).exists()]
    if not exist:
        return
    n = len(exist)
    t = doc.add_table(rows=2, cols=n)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    w = 26.8 / n
    for i, (path, cap) in enumerate(exist):
        cell = t.rows[0].cells[i]
        cell.width = Cm(w)
        cell.text = ""
        set_cell_borders(cell, color="BFBFBF", sz="4")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        try:
            p.add_run().add_picture(str(path), width=Cm(pic_w))
        except Exception as e:
            print("pic", e)
        write_cell(t.rows[1].cells[i], cap, bold=True, size=7.5, fill=GRAY)
    para(doc, "", after=2)


def build_docx():
    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
    sec.left_margin = sec.right_margin = Cm(1.35)
    sec.top_margin = sec.bottom_margin = Cm(0.9)

    # ===== P1 =====
    header_block(doc, "PHC파일 관리시스템(파일마스터) 개발 및 현장 적용(안)")
    summary_badge(
        doc,
        "말뚝 3~4천 본 위치확인 1주일↑ → 5~10분 자동정합. 설계·시공·PDAM·드론 통합 WEB. "
        "PoC 2현장 완료·청주씨엘리체 적용중. 베타 운영 → 서버이관·로그인정책 반영 후 정식·확산.",
    )
    heading(doc, "1. 배경 및 목적")
    mixed(
        doc,
        [
            ("1) 정의 : ", True, None),
            ("CAD에서 PHC파일 좌표 자동추출·비교", True, BLUE),
            (" + PDAM·드론·지적 연동으로 시공현황·기성·자재 관리하는 ", False, None),
            ("자체개발 WEB(파일마스터)", True, BLUE),
            (". 설치 없이 브라우저·모바일 열람.", False, None),
        ],
    )
    para(doc, "2) 추진 필요성", size=10.5, bold=True, after=1)
    for s in [
        "① 현장당 말뚝 3~4천 본 위치확인에 1주일↑ → 도면변경·공기압박 시 오류 확대",
        "② 좌표·이격 오류 사후발견 시 오시공 → 마이크로파일·철근보강 등 원가·공기 손실",
        "③ 설계 / PDAM 항타 / 드론정사 분산 → 정합·공정·기성을 한눈에 판단 곤란",
        "④ 현장별 관리시트 상이 → 본부 표준 품질·물량관리 한계",
    ]:
        para(doc, s, size=9.5, after=1)

    para(doc, "3) 핵심효과 · 적용현황", size=10.5, bold=True, after=1)
    make_table(
        doc,
        [
            ["구분", "AS-IS", "TO-BE", "의미"],
            ["위치·정합", "1주일↑ 수작업", "5~10분 자동", "공기·인력"],
            ["오시공·이격", "사후 보강·재시공", "조기발견·사전차단", "품질·원가"],
            ["데이터", "도면·항타·드론 분리", "한 화면 통합", "의사결정"],
            ["공유", "파일·버전 혼선", "WEB 동일화면", "확산용이"],
            ["기성·자재", "수작업 집계", "높이별 자동산출", "정산신뢰"],
        ],
        [3.0, 6.2, 6.8, 7.8],
        left_cols={1, 2, 3},
        size=8,
    )
    make_table(
        doc,
        [
            ["주관", "시범적용", "PoC 완료", "확산단계"],
            [
                "건축BIM팀\n자체개발·운영",
                "청주씨엘리체\n적용중",
                "청주센텀푸르지오자이\n풍무역푸르지오더마크",
                "① PoC → ② 현장적용\n→ ③ 본부·전사 확대",
            ],
        ],
        [5.5, 5.5, 8.0, 7.8],
        header_fill=GRAY,
        size=8,
    )

    # ===== P2 =====
    page_break(doc)
    header_block(doc, "PHC파일 관리시스템(파일마스터) 개발 및 현장 적용(안)")
    heading(doc, "2. 현황 · 원인 · 착안")
    make_table(
        doc,
        [
            ["구분", "현황 및 문제점", "원인", "착안(기능)", "비고"],
            ["1", "설계·시공도면 좌표 불일치(재시공·오시공·지연)", "수기좌표 오류 / 처리량 과다", "좌표 자동추출·비교", "핵심"],
            ["2", "대지경계·흙막이-말뚝 이격 부족", "설계오류 인력확인 한계", "지적·이격 자동검토", "리스크"],
            ["3", "도면변경 빈발 / 종이도면 확인 부담", "변경 시 수기 재추출 오류", "WEB·모바일 자료", ""],
            ["4", "PDAM 적용현황 관리 미흡", "시공기록↔도면 연계 부족", "PDAM 연동 항타관리", ""],
            ["5", "분산 데이터로 통합관리 곤란", "공구분할·외주(PDAM·드론)", "통합 관제 화면", ""],
            ["6", "기성·자재관리 어려움", "입고·시공·높이별 수작업", "기성·자재 자동산출", ""],
            ["7", "현장별 관리시트 상이", "표준 양식·절차 부재", "전현장 표준체계", "확산"],
        ],
        [1.2, 8.2, 6.5, 5.2, 2.0],
        left_cols={1, 2, 3},
        size=7.5,
    )
    heading(doc, "3. 목적 및 주요기능")
    para(
        doc,
        "① 설계·시공 정합성 사전확보  ② 도면·PDAM·드론 일원화  ③ 기성·자재 자동산출  ④ 표준절차·모바일 확산",
        size=9.5,
        after=2,
    )
    make_table(
        doc,
        [
            ["착안", "기능", "기대효과"],
            ["좌표 자동추출·비교", "① 좌표 추출·정합", "3~4천 본 확인 1주일↑→5~10분, 불일치 조기발견"],
            ["WEB·모바일", "② WEB/모바일 열람", "현장·본사 동일화면, 버전혼선 해소"],
            ["PDAM 연동", "③ PDAM 항타관리", "시공길이·관입과 도면위치 대조, 누락방지"],
            ["통합 관제", "④ 드론 정사 중첩", "측량정합 즉시확인, 이슈 조기공유"],
            ["지적·이격", "⑤ 지적·이격 검토", "시공불가 구간 사전파악, 재시공 리스크 완화"],
            ["공정 가시화", "⑥ 공구별 시공시뮬", "투입순서·진도공유, 간섭·누락 사전점검"],
            ["기성 자동화", "⑦ 기성·자재관리", "높이별 기성 자동, 정산·보고 신뢰도 향상"],
        ],
        [5.0, 5.5, 13.3],
        header_fill=GRAY,
        left_cols={0, 1, 2},
        size=7.5,
    )
    para(doc, "□ 기능 화면 예시", size=9.5, bold=True, after=1)
    add_pics_row(
        doc,
        [
            (ASSETS / "01-coord.png", "① 좌표 정합"),
            (ASSETS / "02-pdam.png", "② PDAM 항타"),
            (ASSETS / "03-drone.png", "③ 드론 중첩"),
            (ASSETS / "06-gisung.png", "⑦ 기성·자재"),
        ],
        pic_w=5.5,
    )

    # ===== P3 =====
    page_break(doc)
    header_block(doc, "PHC파일 관리시스템(파일마스터) 개발 및 현장 적용(안)")
    heading(doc, "4. 개발 경과")
    make_table(
        doc,
        [
            ["단계", "기간", "주요 성과", "검증"],
            ["① 기획·요건", "2026.상반기", "페인포인트 정리, 현황-원인-착안 구조화", "요건정의"],
            ["② 핵심개발", "2026.06~08", "좌표·PDAM·드론·이격·시뮬·기성 모듈 WEB 구현", "파일마스터"],
            ["③ PoC", "2026.07~08", "청주센텀푸르지오자이 · 풍무역푸르지오더마크 완료", "정합·열람"],
            ["④ 시범적용", "2026.08~(진행)", "청주씨엘리체 적용중, 현장피드백 반영", "실무적합성"],
            ["⑤ 운영정비", "진행중", "요청창구·WEB공유 절차 정착, 베타운영", "운영체계"],
        ],
        [3.0, 3.3, 12.5, 5.0],
        left_cols={2, 3},
        size=7.5,
    )
    para(doc, "처리흐름: 현장 요청 → 현장기술지원 → 건축BIM팀 접수·세팅(통상 2~3일) → WEB 링크 열람", size=9, after=2)
    make_table(
        doc,
        [
            ["요청", "접수", "작업", "전달"],
            [
                "현장: 시공도면·동·층\n정보 전달(필수)",
                "BIM팀: 범위확인\n당일~1일",
                "중심점산출→정합→\nWEB등록 (2~3일)",
                "현장·본사:\nWEB 동일화면 즉시열람",
            ],
        ],
        [6.7, 6.7, 6.7, 6.7],
        header_fill=GRAY,
        size=7.5,
    )

    heading(doc, "5. 운영 계획 (베타)")
    make_table(
        doc,
        [
            ["항목", "내용", "비고"],
            ["운영방식", "베타 버전", "전사 로그인 정책 반영 협의중"],
            ["주관", "건축BIM팀 (접수·세팅·WEB 발급)", "창구 일원화"],
            ["절차", "현장 요청 → BIM팀 접수·세팅 → WEB 공유", "설치 불필요"],
            ["서버", "클라우드 사용중 → 5층 운영서버 이관", "디지털개발팀 협의완료"],
            ["제약", "로그인 정책 미확정", "전체현장 일괄관제는 정식화 이후"],
        ],
        [3.2, 13.5, 7.1],
        left_cols={1, 2},
        size=8,
    )

    # ===== P4 =====
    page_break(doc)
    header_block(doc, "PHC파일 관리시스템(파일마스터) 개발 및 현장 적용(안)")
    heading(doc, "6. 향후 계획 (단계별 로드맵)")
    para(doc, "베타 검증 → 인프라·계정 정식화 → 본부 표준절차로 확산", size=9.5, after=2)
    make_table(
        doc,
        [
            ["Phase", "목표", "주요 과제", "완료 기준", "시점(안)"],
            ["P1 안정화", "시범품질 고정", "청주씨엘리체 피드백·사용성 보완", "실무사용 정착", "2026.08~09"],
            ["P2 인프라", "운영 내재화", "클라우드→5층 서버 이관, 백업·권한", "이관·장애대응", "디지털개발팀 협의일정"],
            ["P3 계정", "정식 로그인", "전사 로그인정책 확정·권한분리", "전체현장 관제가능", "정책 확정 후"],
            ["P4 확산", "본부·전사 표준", "요청~WEB 표준업무화, 타현장 확대", "매뉴얼·교육·확대", "P3 이후"],
        ],
        [2.6, 3.5, 8.2, 5.5, 4.0],
        left_cols={1, 2, 3},
        size=7.5,
    )
    para(doc, "1) 서버 이관 : 클라우드 → 5층 운영서버 (디지털개발팀 협의완료), 중단 최소화·백업·권한 점검 병행", size=9.5, after=1)
    para(doc, "2) 로그인·정식운영 : 전사 로그인정책 반영 후 베타 종료 → 전체현장 현황 일괄관제·본부 표준관리 가능", size=9.5, after=1)
    para(
        doc,
        "3) 업무확산 : 청주씨엘리체 결과를 「현장→기술지원→BIM팀→WEB」 표준에 반영, 좌표·항타·드론·지적·기성 범위 순차 확대",
        size=9.5,
        after=3,
    )

    box = doc.add_table(rows=1, cols=1)
    write_cell(
        box.rows[0].cells[0],
        "보고 요지(임원)\n"
        "① 말뚝 정합·오시공·분산데이터 리스크를 자체개발로 해결 중 — PoC 2현장 완료, 시범적용 진행\n"
        "② 정량효과: 위치확인 1주일↑ → 5~10분, WEB으로 현장·본사 동일화면\n"
        "③ 현행 베타(로그인 협의) · 5층 서버이관 협의완료 → 정책 확정 후 정식·전사 확산\n"
        "④ 요청: 시범적용·서버이관·로그인정책 일정에 대한 추진 지속",
        size=9,
        bold=True,
        align="left",
        fill=YELLOW,
    )
    set_cell_borders(box.rows[0].cells[0], color="BF8F00", sz="10")
    para(doc, "※ PoC=개념검증, PDAM=항타시공기록, GEO.D=지반개량", size=7.5, color=RGBColor(0x66, 0x66, 0x66), after=0)

    if DOCX.exists():
        try:
            DOCX.unlink()
        except Exception:
            pass
    doc.save(str(DOCX))
    print("DOCX", DOCX.stat().st_size)
    return DOCX


def convert_hwp(docx: Path):
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(1.5)
    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.Open(str(docx))
    time.sleep(1.6)

    pset = hwp.HParameterSet.HSecDef
    hwp.HAction.GetDefault("PageSetup", pset.HSet)
    pset.PageDef.Landscape = 1
    pset.PageDef.PaperWidth = 59528
    pset.PageDef.PaperHeight = 84189
    mm = lambda x: int(x * 283.465)
    pset.PageDef.LeftMargin = mm(11)
    pset.PageDef.RightMargin = mm(11)
    pset.PageDef.TopMargin = mm(9)
    pset.PageDef.BottomMargin = mm(9)
    hwp.HAction.Execute("PageSetup", pset.HSet)
    print("LAND", pset.PageDef.Landscape)

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
    print("HWP", HWP.stat().st_size if HWP.exists() else 0)

    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    (OUT / "exec_land_text.txt").write_text(txt, encoding="utf-8")
    print("TEXT", len(txt), "5~10분" in txt, "Phase" in txt or "P1" in txt)

    if HWP.exists():
        HWP2.parent.mkdir(parents=True, exist_ok=True)
        HWP2.write_bytes(HWP.read_bytes())
        print("COPIED", HWP2)

    # screenshots from doc begin
    wins = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _lp):
        if not user32.IsWindowVisible(hwnd):
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        if not n:
            return True
        t = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, t, n + 1)
        c = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, c, 256)
        if "HwpApp" in c.value:
            wins.append((hwnd, t.value))
        return True

    user32.EnumWindows(cb, 0)
    hwnd = wins[0][0]
    for h, t in wins:
        if "임원" in t or "PHC" in t:
            hwnd = h
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    try:
        hwp.HAction.Run("ViewZoomFitWidth")
    except Exception:
        pass
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.3)
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    for i in range(1, 5):
        img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
        p = SHOT / f"exec_p{i}.png"
        img.save(p)
        print("SHOT", p.name)
        hwp.HAction.Run("MovePageDown")
        time.sleep(0.35)
    return hwp


def main():
    convert_hwp(build_docx())
    print("DONE")


if __name__ == "__main__":
    main()
