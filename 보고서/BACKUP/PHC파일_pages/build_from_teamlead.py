# -*- coding: utf-8 -*-
"""팀장 피드백(세로본) 논리 중심으로 가로 제출용 보고서 재작성."""
from __future__ import annotations

import subprocess
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab

OUT = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_팀장피드백반영.hwp")
OUT2 = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_팀장피드백반영.hwp")
ASSETS = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages\assets")
SHOT = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages\teamlead_shots")
SHOT.mkdir(parents=True, exist_ok=True)

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
    act = hwp.CreateAction("CharShape")
    s = act.CreateSet()
    act.GetDefault(s)
    s.SetItem("Bold", bold)
    s.SetItem("Height", int(height_pt * 100))
    if color is not None:
        s.SetItem("TextColor", color)
    act.Execute(s)


def heading(hwp, text: str, size=13) -> None:
    char_shape(hwp, True, size, 0xC00000)
    para(hwp, text)
    char_shape(hwp, False, 10.5, 0)


def make_table(hwp, data, widths, row_h=1500) -> None:
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
    time.sleep(0.12)
    for r in range(rows):
        for c in range(cols):
            text = data[r][c]
            if text:
                act = hwp.CreateAction("CharShape")
                s = act.CreateSet()
                act.GetDefault(s)
                s.SetItem("Height", 850 if r else 900)
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


def insert_pic(hwp, path: Path) -> None:
    if not path.exists():
        return
    # PictureChange needs selection; use InsertFile fallback via action name variants
    try:
        pset = hwp.HParameterSet.HPictureChange
        # try insert via Run + path is unreliable; use InsertFile of image? 
        pass
    except Exception:
        pass
    # Use OLE InsertPicture through CreateAction if available
    try:
        act = hwp.CreateAction("InsertPicture")
        if act is None:
            raise RuntimeError("no InsertPicture")
    except Exception:
        # clipboard paste
        try:
            from PIL import Image
            import win32clipboard
            from io import BytesIO

            im = Image.open(path).convert("RGB")
            bio = BytesIO()
            im.save(bio, "BMP")
            data = bio.getvalue()[14:]
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
            win32clipboard.CloseClipboard()
            hwp.HAction.Run("Paste")
            para(hwp, "")
            return
        except Exception as e:
            print("pic fail", path.name, e)
            return


def set_landscape(hwp) -> None:
    for cmd in ["PaperLandscape", "PageLandscape"]:
        try:
            hwp.HAction.Run(cmd)
        except Exception:
            pass
    try:
        pset = hwp.HParameterSet.HSecDef
        hwp.HAction.GetDefault("PageSetup", pset.HSet)
        pset.PageDef.Landscape = 1
        hwp.HAction.Execute("PageSetup", pset.HSet)
    except Exception as e:
        print("land", e)


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
    hwnd, title = wins[0]
    for h, t in wins:
        if "팀장" in t or "피드백" in t or "PHC" in t:
            hwnd, title = h, t
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.45)
    hwp.HAction.Run("MoveDocBegin")
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    for i in range(1, n + 1):
        img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
        p = SHOT / f"{prefix}_p{i}.png"
        img.save(p)
        print("SHOT", p.name, title)
        hwp.HAction.Run("MovePageDown")
        time.sleep(0.35)


def main() -> None:
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(2)

    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.HAction.Run("FileNew")
    time.sleep(0.7)
    set_landscape(hwp)

    # ===== 팀장 피드백 구조 그대로 =====
    char_shape(hwp, True, 16)
    para(hwp, "PHC파일 관리시스템 개발 및 적용(안)")
    char_shape(hwp, False, 10.5)
    para(hwp, "건축BIM팀 정헌재 선임                                                   2026. 08. 12")
    para(hwp, "")

    # 1. 개요 — 팀장 문구 유지, 명칭 명시
    heading(hwp, "1. 개요")
    para(hwp, "시스템명 : PHC파일 관리시스템 (명칭 : 파일마스터)")
    para(
        hwp,
        "PHC파일 좌표 자동 추출 기능으로 설계도면과 시공도면과의 정합성을 확인하고, "
        "PDAM과 연동하여 PHC파일의 시공 현황을 관리하고, 기성 및 자재관리를 할 수 있는 "
        "자체 개발 프로그램으로, 모바일 활용이 가능함.",
    )
    para(hwp, "")

    # 2. 현황 및 문제점 — 팀장 표(현황·원인·착안)가 핵심
    heading(hwp, "2. 현황 및 문제점")
    para(
        hwp,
        "※ 팀장 피드백 핵심: 현황만 나열하지 않고, 원인 → 착안(기능 방향)까지 한 표로 맞춤.",
    )
    make_table(
        hwp,
        [
            ["구분", "현황 및 문제점", "원인", "착안", "비고"],
            [
                "1",
                "설계도면 좌표와 시공도면 좌표 불일치 (재시공, 오시공, 시공지연)",
                "협력사 시공도면 좌표 수기 작성 오류 / 공사 담당자 처리 데이터량 과다",
                "손쉬운 좌표추출 및 비교 필요",
                "",
            ],
            [
                "2",
                "대지경계, 흙막이와 말뚝 이격거리 부족 (시공지연)",
                "설계도면 오류 인력 확인 어려움",
                "지적·이격거리 자동 검토 필요",
                "",
            ],
            [
                "3",
                "빈번한 도면 변경에 따른 시공지연 / 종이도면 확인 업무 부담",
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
        ],
        [3500, 17500, 16000, 11000, 3500],
        1450,
    )

    # 3. 목적 및 기능 — 착안이 목적·기능으로 이어지도록
    heading(hwp, "3. 목적 및 기능")
    char_shape(hwp, True, 11)
    para(hwp, "1) 목적")
    char_shape(hwp, False, 10.5)
    para(hwp, "① CAD도면상 좌표 자동 추출 및 비교를 통한 설계·시공도면 정합성 확보")
    para(hwp, "② 도면, PDAM, 드론 데이터 통합관리를 통한 시공현황 일원화")
    para(hwp, "③ 파일 입고, 시공, 높이별 기성물량 자동 산출을 통한 기성·자재관리 효율화")
    para(hwp, "④ 전현장 표준관리체계 구축 및 모바일 활용 지원")
    para(hwp, "")
    char_shape(hwp, True, 11)
    para(hwp, "2) 주요기능 및 기대효과  (← 2장 착안을 기능으로 구체화)")
    char_shape(hwp, False, 10.5)
    make_table(
        hwp,
        [
            ["착안(피드백)", "주요기능", "기대효과"],
            ["손쉬운 좌표추출 및 비교", "① 좌표 추출·정합", "설계·시공도면 불일치 조기 발견"],
            ["모바일 자료 필요", "② 모바일 좌표기능", "종이도면 확인 부담 경감"],
            ["PDAM 연동 항타관리", "③ PDAM 항타관리", "시공기록과 도면 연계"],
            ["통합관리", "④ 드론데이터 활용", "외주·측량 데이터 일원화"],
            ["지적·이격 자동 검토", "⑤ 지적·이격 검토", "이격 부족으로 인한 시공지연 예방"],
            ["통합관리 / 공정 가시화", "⑥ 공구별 시공 시뮬레이션", "공구 단위 시공 진행 파악"],
            ["기성·자재 자동 산출 / 표준관리", "⑦ 기성·자재관리", "수작업 물량산출·현장별 시트 편차 해소"],
        ],
        [14000, 14000, 16000],
        1350,
    )

    # 화면 예시 (팀장 논리 보강용, 보조)
    para(hwp, "□ 기능 화면 예시(참고)")
    for p in [ASSETS / "01-coord.png", ASSETS / "ai-02-pdam.png"]:
        insert_pic(hwp, p)
    para(hwp, "")

    # 4. 개발 경과 — 팀장 문구 + 시범적용만 보강
    heading(hwp, "4. 개발 경과")
    para(hwp, "1) 시스템 구축 : 2026.08~ (자체개발)")
    para(hwp, "2) 시범적용 및 피드백 : 청주씨엘리체 적용중, PoC 현장 피드백 반영 중")
    para(hwp, "")

    # 5. 운영 계획 — 팀장 피드백 그대로가 핵심
    heading(hwp, "5. 운영 계획")
    para(hwp, "1) 운영 방식 : 베타 버전 (사유 : 전사 로그인 정책 반영 협의중)")
    para(hwp, "2) 주관 : 건축BIM팀 운영")
    para(hwp, "3) 절차 : 현장 요청 > BIM팀 접수 및 세팅 > 현장WEB 공유")
    para(hwp, "4) 고려사항")
    para(hwp, "   ① 클라우드 서버 사용(추후 5층 운영서버 사용, 디지털개발팀 협의완료)")
    para(
        hwp,
        "   ② 로그인 정책 미확정으로 사용 전체 현장 현황 확인 불가피",
    )
    para(hwp, "")

    # 6. 향후 계획 — 팀장이 짧게 남긴 두 축을 운영 고려사항과 연결해 서술
    heading(hwp, "6. 향후 계획")
    para(hwp, "1) 서버 이관 : 클라우드 → 5층 운영서버 (디지털개발팀 협의완료)")
    para(hwp, "2) 로그인 정책 : 전사 로그인 정책 확정·반영 후 정식 운영 및 전체 현장 현황 관리")
    para(hwp, "")

    # 논리 한 줄 요약 (팀장 의도 명시)
    char_shape(hwp, True, 11, 0xC00000)
    para(hwp, "■ 정리(피드백 의도)")
    char_shape(hwp, False, 10.5, 0)
    para(
        hwp,
        "문제(현황) → 왜 생기는지(원인) → 무엇을 만들지(착안) → 목적·기능으로 연결하고, "
        "운영은 베타·로그인·서버 제약을 명확히 한 뒤, 향후 계획으로 서버 이관·로그인 정책을 닫는 구성.",
    )

    # save
    if OUT.exists():
        try:
            OUT.unlink()
        except Exception:
            pass
    pset = hwp.HParameterSet.HFileOpenSave
    hwp.HAction.GetDefault("FileSaveAs_S", pset.HSet)
    pset.filename = str(OUT)
    pset.Format = "HWP"
    hwp.HAction.Execute("FileSaveAs_S", pset.HSet)
    time.sleep(1.0)
    print("SAVED", OUT.exists(), OUT.stat().st_size if OUT.exists() else 0)

    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages\teamlead_report_text.txt").write_text(
        txt, encoding="utf-8"
    )
    print("TEXT_LEN", len(txt))
    print("HAS_TABLE_HINT", "손쉬운 좌표추출" in txt and "베타 버전" in txt)

    if OUT.exists() and OUT.stat().st_size > 8000:
        try:
            OUT2.parent.mkdir(parents=True, exist_ok=True)
            OUT2.write_bytes(OUT.read_bytes())
            print("COPIED", OUT2)
        except Exception as e:
            print("copy", e)

    screenshot(hwp, "teamlead", 3)
    print("DONE")


if __name__ == "__main__":
    main()
