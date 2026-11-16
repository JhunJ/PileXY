# -*- coding: utf-8 -*-
"""파일마스터 가로형 보고서 — 도면데이터추출 구축안_v3 형식을 본뜬 초안."""
from __future__ import annotations

import subprocess
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab

OUT_DIR = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
SAVE_PATH = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_구축적용안_가로.hwp")
SAVE_PATH2 = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_구축적용안_가로.hwp")
OUT_DIR.mkdir(parents=True, exist_ok=True)

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


def insert_text(hwp, text: str) -> None:
    pset = hwp.HParameterSet.HInsertText
    hwp.HAction.GetDefault("InsertText", pset.HSet)
    pset.Text = text
    hwp.HAction.Execute("InsertText", pset.HSet)


def para(hwp, text: str = "") -> None:
    if text:
        insert_text(hwp, text)
    hwp.HAction.Run("BreakPara")


def char_shape(hwp, bold=False, height_pt=11, color=None) -> None:
    """color: 0xBBGGRR int or None."""
    act = hwp.CreateAction("CharShape")
    s = act.CreateSet()
    act.GetDefault(s)
    s.SetItem("Bold", bold)
    s.SetItem("Height", int(height_pt * 100))
    if color is not None:
        s.SetItem("TextColor", color)
    act.Execute(s)


def blue_bold(hwp, text: str, height_pt=11) -> None:
    # Hangul TextColor often BGR: blue ~ 0xFF0000 in some builds; use 0xC00000-ish navy/blue
    char_shape(hwp, True, height_pt, 0xC00000)
    insert_text(hwp, text)
    char_shape(hwp, False, 11, 0x000000)


def set_landscape(hwp) -> None:
    try:
        act = hwp.CreateAction("PageSetup")
        s = act.CreateSet()
        act.GetDefault(s)
        # 0 portrait, 1 landscape (Hangul)
        try:
            s.SetItem("PageDirection", 1)
        except Exception:
            pass
        try:
            # alternate key names across versions
            s.SetItem("Landscape", 1)
        except Exception:
            pass
        act.Execute(s)
        print("PageSetup landscape attempted")
    except Exception as e:
        print("PageSetup err", e)
    try:
        pset = hwp.HParameterSet.HSecDef
        hwp.HAction.GetDefault("PageSetup", pset.HSet)
        pset.PageDirection = 1
        hwp.HAction.Execute("PageSetup", pset.HSet)
        print("HSecDef PageDirection=1")
    except Exception as e:
        print("HSecDef err", e)


def make_table(hwp, data, widths, row_h=1400) -> None:
    rows, cols = len(data), len(data[0])
    pset = hwp.HParameterSet.HTableCreation
    hwp.HAction.GetDefault("TableCreate", pset.HSet)
    pset.Rows = rows
    pset.Cols = cols
    pset.WidthType = 2
    pset.HeightType = 0
    pset.CreateItemArray("RowHeight", rows)
    pset.CreateItemArray("ColWidth", cols)
    for i in range(rows):
        pset.RowHeight.SetItem(i, row_h)
    for i in range(cols):
        pset.ColWidth.SetItem(i, widths[i])
    hwp.HAction.Execute("TableCreate", pset.HSet)
    time.sleep(0.15)
    for r in range(rows):
        for c in range(cols):
            text = data[r][c]
            if text:
                act = hwp.CreateAction("CharShape")
                s = act.CreateSet()
                act.GetDefault(s)
                s.SetItem("Height", 850)
                s.SetItem("Bold", r == 0)
                act.Execute(s)
                insert_text(hwp, text)
            if c < cols - 1:
                hwp.HAction.Run("TableRightCell")
            elif r < rows - 1:
                hwp.HAction.Run("TableLowerCell")
                for _ in range(cols - 1):
                    hwp.HAction.Run("TableLeftCell")
    hwp.HAction.Run("Cancel")
    hwp.HAction.Run("MoveDown")
    hwp.HAction.Run("BreakPara")


def page_break(hwp) -> None:
    hwp.HAction.Run("BreakPage")


def screenshot(path: Path, title_hint: str = "파일마스터") -> None:
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
    if not wins:
        return
    hwnd, title = wins[0]
    for h, t in wins:
        if title_hint in t or "PHC" in t or "파일" in t:
            hwnd, title = h, t
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.45)
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
    img.save(path)
    print("SHOT", path.name, title)


def main() -> None:
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(2)

    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception as e:
        print("RegisterModule", e)
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.HAction.Run("FileNew")
    time.sleep(0.8)
    set_landscape(hwp)

    # ===== 요약 페이지 =====
    char_shape(hwp, True, 18)
    para(hwp, "PHC파일 관리시스템(파일마스터) 개발 및 적용(안)")
    char_shape(hwp, False, 11)
    para(hwp, "건축BIM팀 정헌재 선임                                          2026. 08. 12")
    para(hwp, "")
    char_shape(hwp, True, 12, 0xC00000)
    para(hwp, "[요약]")
    char_shape(hwp, False, 11, 0x000000)

    para(hwp, "1. 제 목 : PHC파일 관리시스템(파일마스터) 개발 및 적용(안)")
    insert_text(hwp, "   1) 정 의 : ")
    blue_bold(hwp, "CAD 도면에서 PHC파일 좌표를 자동 추출")
    insert_text(hwp, "하고 설계·시공도면 정합성을 확인하며, ")
    blue_bold(hwp, "PDAM·드론 데이터와 연동")
    insert_text(hwp, "하여 시공현황·기성·자재를 관리하는 ")
    blue_bold(hwp, "WEB/모바일 자체 개발 프로그램")
    para(hwp, "")
    insert_text(hwp, "   2) 목 적 : 말뚝 3~4천 본 위치 대조 ")
    blue_bold(hwp, "1주일 이상 → 5~10분")
    insert_text(hwp, "으로 단축, 오시공·재시공 예방, 현장·본사 ")
    blue_bold(hwp, "동일 WEB 화면")
    para(hwp, "으로 현황 공유")

    para(hwp, "2. 추진 계획")
    para(hwp, "   1) 주관/기간 : 건축BIM팀 자체개발 / 2026.08 ~ (베타 운영)")
    para(hwp, "   2) 적용 : 청주씨엘리체 적용중 · PoC 청주센텀푸르지오자이·풍무역푸르지오더마크 완료")
    para(hwp, "   3) 항목 : ①좌표정합 ②PDAM항타 ③드론 ④지적·이격 ⑤공구별 시공시뮬레이션 ⑥기성·자재")
    para(hwp, "   4) 절차 : 현장 요청 → 현장기술지원 → 건축BIM팀 접수·세팅 → WEB 링크 공유")

    para(hwp, "3. 향후 계획")
    para(hwp, "   1) 클라우드 → 5층 운영서버 이관(디지털개발팀 협의완료), 전사 로그인 정책 반영")
    para(hwp, "   2) 현장 피드백 반영 후 본부 표준절차화 · 타 현장 확대")
    para(hwp, "")

    # 요약용 핵심효과 미니표
    char_shape(hwp, True, 11)
    para(hwp, "■ 핵심 효과(요약)")
    char_shape(hwp, False, 10)
    make_table(
        hwp,
        [
            ["구분", "As-Is", "To-Be"],
            ["위치 확인", "3~4천 본 수작업 대조 (1주일 이상)", "중심점 자동산출·정합 확인 (5~10분)"],
            ["오류 리스크", "좌표 수기오류 → 오시공·마이크로파일/철근보강", "도면·PDAM·드론 한 화면 대조로 조기 발견"],
            ["공유 방식", "종이도면·현장별 시트 분산", "설치 없이 WEB/모바일 동일 화면"],
        ],
        [8000, 20000, 22000],
        1600,
    )

    page_break(hwp)

    # ===== I. 현황·문제점 / 목적·기능 =====
    char_shape(hwp, True, 14, 0xC00000)
    para(hwp, "I. 현황 및 문제점 · 목적 · 기능")
    char_shape(hwp, False, 11, 0x000000)
    para(hwp, "")
    char_shape(hwp, True, 12)
    para(hwp, "1. 현황 및 문제점")
    char_shape(hwp, False, 10)
    make_table(
        hwp,
        [
            ["구분", "현황 및 문제점", "원인", "착안"],
            [
                "1",
                "설계·시공도면 좌표 불일치 (재시공·오시공·지연)",
                "협력사 수기 좌표 / 담당자 처리량 과다",
                "좌표 자동추출·비교",
            ],
            [
                "2",
                "대지경계·흙막이–말뚝 이격 부족 (시공지연)",
                "설계오류 인력확인 곤란",
                "지적·이격 자동검토",
            ],
            [
                "3",
                "도면 변경 빈번 + 종이도면 확인 부담",
                "변경 시 좌표 수기추출 오류",
                "모바일/WEB 자료",
            ],
            [
                "4",
                "PDAM 적용 현황 관리 미흡",
                "시공기록과 도면 연계 부족",
                "PDAM 항타 연동",
            ],
            [
                "5",
                "데이터 분산으로 통합관리 곤란",
                "공구분할·외주(PDAM·드론) 분리",
                "통합관리 화면",
            ],
            [
                "6",
                "기성·자재관리 어려움",
                "입고·시공·높이별 물량 수작업",
                "기성·자재 자동산출",
            ],
            [
                "7",
                "현장별 관리시트 상이",
                "표준 양식 부재",
                "전현장 표준관리",
            ],
        ],
        [3500, 18000, 16000, 12000],
        1350,
    )

    char_shape(hwp, True, 12)
    para(hwp, "2. 목적")
    char_shape(hwp, False, 11)
    para(hwp, "① CAD 좌표 자동추출·비교로 설계·시공도면 정합성 확보")
    para(hwp, "② 도면·PDAM·드론 통합관리로 시공현황 일원화")
    para(hwp, "③ 입고·시공·높이별 기성물량 자동산출로 기성·자재관리 효율화")
    para(hwp, "④ 전현장 표준관리체계 구축 및 모바일/WEB 활용")
    para(hwp, "")
    char_shape(hwp, True, 12)
    para(hwp, "3. 주요기능 및 기대효과")
    char_shape(hwp, False, 11)
    make_table(
        hwp,
        [
            ["기능", "내용", "기대효과"],
            ["① 좌표 정합성", "말뚝 중심점 자동산출, 설계·시공·측량 정합", "1주일→5~10분, 오시공 조기발견"],
            ["② 모바일/WEB", "설치 없이 현장·본사 동일 화면 열람", "종이도면 업무부담 경감"],
            ["③ PDAM 항타", "항타 길이·관입과 PHC 시공길이 대조", "누락·오기록 방지"],
            ["④ 드론(메이샤)", "드론 측량과 도면·시공 데이터 연계", "차이 한눈에 확인"],
            ["⑤ 지적·이격", "대지경계·흙막이–말뚝 이격 검토", "시공지연 예방"],
            ["⑥ 시공 시뮬레이션", "공구별 시공 진행 시뮬레이션", "공정 가시화"],
            ["⑦ 기성·자재", "입고·시공·높이별 물량 자동산출", "기성·자재관리 표준화"],
        ],
        [9000, 22000, 18000],
        1300,
    )

    page_break(hwp)

    # ===== II. 업무시나리오·운영 =====
    char_shape(hwp, True, 14, 0xC00000)
    para(hwp, "II. 업무 시나리오 및 운영 계획")
    char_shape(hwp, False, 11, 0x000000)
    para(hwp, "")
    char_shape(hwp, True, 12)
    para(hwp, "1. 업무 시나리오(요청~열람)")
    char_shape(hwp, False, 11)
    para(hwp, "현장 요청 → 현장기술지원 → 건축BIM팀 접수 → 중심점 산출·정합·WEB 등록 → WEB 링크 열람")
    make_table(
        hwp,
        [
            ["구분", "내용", "비고"],
            ["요청", "현장이 시공용 도면을 현장기술지원에 전달", "창구 일원화"],
            ["접수", "건축BIM팀이 도면·동·층 정보 확인", "당일~1일"],
            ["작업", "말뚝 중심점 산출 → 정합 확인 → WEB 등록", "보통 2~3일"],
            ["전달", "파일마스터 WEB 링크로 현장·본사 열람", "설치 없이 브라우저"],
        ],
        [7000, 28000, 14000],
        1400,
    )
    para(hwp, "※ 시공도면·동·층 정보 누락 시 접수 지연 — 요청 시 필수 첨부")
    para(hwp, "")

    char_shape(hwp, True, 12)
    para(hwp, "2. 운영 계획")
    char_shape(hwp, False, 11)
    para(hwp, "1) 운영 방식 : 베타 버전 (사유 : 전사 로그인 정책 반영 협의중)")
    para(hwp, "2) 주관 : 건축BIM팀")
    para(hwp, "3) 적용 : 청주씨엘리체 적용중 · PoC 2개 현장 완료")
    para(hwp, "4) 고려사항")
    para(hwp, "   ① 클라우드 서버 사용 (추후 5층 운영서버 이관, 디지털개발팀 협의완료)")
    para(hwp, "   ② 로그인 정책 미확정으로 전사 현장 현황 일괄 확인은 제한적")
    para(hwp, "")
    char_shape(hwp, True, 12)
    para(hwp, "3. 적용 효과(현장)")
    char_shape(hwp, False, 11)
    para(hwp, "▪ 위치확인 시간 단축(1주일 이상 → 5~10분)")
    para(hwp, "▪ 오시공 조기 발견 → 마이크로파일·철근 보강 리스크 축소")
    para(hwp, "▪ 지반개량(GEO.D)도 동일 규칙으로 확인 가능")
    para(hwp, "▪ 현장·본사 동일 WEB 화면으로 의사결정 속도 향상")

    page_break(hwp)

    # ===== III·IV 추진·향후 =====
    char_shape(hwp, True, 14, 0xC00000)
    para(hwp, "III. 추진계획")
    char_shape(hwp, False, 11, 0x000000)
    para(hwp, "1. 주관 : 건축BIM팀 자체 개발")
    para(hwp, "2. 기간 : 2026.08 ~ (베타) → 서버이관·로그인정책 확정 후 정식 운영")
    para(hwp, "3. 단계 : ① 자체 PoC  ② 현장 적용(청주씨엘리체 등)  ③ 본부 표준화·확대")
    para(hwp, "4. 개발 경과 : 시스템 구축 2026.08~ / 시범적용 및 피드백 진행")
    para(hwp, "")
    make_table(
        hwp,
        [
            ["단계", "내용", "산출"],
            ["① PoC", "좌표정합·WEB 열람 검증 (PoC 2현장 완료)", "정합결과·WEB주소"],
            ["② 현장적용", "청주씨엘리체 적용, 기능 확대(PDAM·드론·이격·기성)", "현장 피드백"],
            ["③ 본부확대", "표준절차 반영, 타 현장 확산", "운영가이드·접수창구"],
        ],
        [8000, 28000, 14000],
        1500,
    )

    para(hwp, "")
    char_shape(hwp, True, 14, 0xC00000)
    para(hwp, "IV. 향후계획")
    char_shape(hwp, False, 11, 0x000000)
    para(hwp, "1. 서버 이관 : 클라우드 → 5층 운영서버 (디지털개발팀 협의완료)")
    para(hwp, "2. 로그인 정책 : 전사 정책 반영 협의 → 정식 계정/권한 체계 적용")
    para(hwp, "3. 협업 : 디지털전략팀/디지털개발팀과 운영·연계 체계 정비")
    para(hwp, "4. 확산 : 현장 적용 결과를 본부 표준 절차에 반영 후 타 현장 확대")
    para(hwp, "")
    para(hwp, "문의 : 건축BIM팀 (파일마스터 접수·WEB 링크 발급)")

    # save
    for p in [SAVE_PATH, SAVE_PATH2]:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    if SAVE_PATH.exists():
        try:
            SAVE_PATH.unlink()
        except Exception:
            pass

    pset = hwp.HParameterSet.HFileOpenSave
    hwp.HAction.GetDefault("FileSaveAs_S", pset.HSet)
    pset.filename = str(SAVE_PATH)
    pset.Format = "HWP"
    hwp.HAction.Execute("FileSaveAs_S", pset.HSet)
    time.sleep(1.0)
    print("SAVED", SAVE_PATH.exists(), SAVE_PATH.stat().st_size if SAVE_PATH.exists() else 0)

    try:
        if SAVE_PATH.exists() and SAVE_PATH.stat().st_size > 10000:
            SAVE_PATH2.write_bytes(SAVE_PATH.read_bytes())
            print("COPIED", SAVE_PATH2)
    except Exception as e:
        print("copy err", e)

    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    (OUT_DIR / "landscape_report_text.txt").write_text(txt, encoding="utf-8")
    print("TEXT_LEN", len(txt))

    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.3)
    screenshot(OUT_DIR / "landscape_p1.png")
    hwp.HAction.Run("MovePageDown")
    time.sleep(0.35)
    screenshot(OUT_DIR / "landscape_p2.png")
    hwp.HAction.Run("MovePageDown")
    time.sleep(0.35)
    screenshot(OUT_DIR / "landscape_p3.png")
    hwp.HAction.Run("MovePageDown")
    time.sleep(0.35)
    screenshot(OUT_DIR / "landscape_p4.png")
    print("DONE")


if __name__ == "__main__":
    main()
