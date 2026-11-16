# -*- coding: utf-8 -*-
"""Build PHC proposal in Hangul via COM, then screenshot pages."""
from __future__ import annotations

import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab

OUT_DIR = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
OUT_HWPX = Path(r"C:\Users\AN-WKS\Desktop\PHC_PileMaster.hwpx")
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


def find_hwp_windows():
    wins = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def foreach(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True
        title = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title, length + 1)
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        if "HwpApp" in cls.value:
            wins.append((hwnd, title.value))
        return True

    user32.EnumWindows(foreach, 0)
    return wins


def screenshot_foreground(path: Path, prefer_substr: str | None = None) -> Path:
    wins = find_hwp_windows()
    if not wins:
        raise RuntimeError("No Hangul window found")
    hwnd, title = wins[0]
    if prefer_substr:
        for h, t in wins:
            if prefer_substr in t:
                hwnd, title = h, t
                break
    user32.ShowWindow(hwnd, 9)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.6)
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    img = ImageGrab.grab(
        bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True
    )
    img.save(path)
    print(f"SHOT {path.name} | {img.size} | {title}")
    return path


def insert_text(hwp, text: str) -> None:
    pset = hwp.HParameterSet.HInsertText
    hwp.HAction.GetDefault("InsertText", pset.HSet)
    pset.Text = text
    hwp.HAction.Execute("InsertText", pset.HSet)


def para(hwp, text: str = "") -> None:
    if text:
        insert_text(hwp, text)
    hwp.HAction.Run("BreakPara")


def char_shape(hwp, bold: bool = False, height_pt: float = 11) -> None:
    act = hwp.CreateAction("CharShape")
    s = act.CreateSet()
    act.GetDefault(s)
    s.SetItem("Bold", bold)
    s.SetItem("Height", int(height_pt * 100))
    act.Execute(s)


def heading(hwp, text: str) -> None:
    char_shape(hwp, True, 12)
    para(hwp, text)
    char_shape(hwp, False, 11)


def create_table(hwp, rows: int, cols: int, widths: list[int]) -> None:
    pset = hwp.HParameterSet.HTableCreation
    hwp.HAction.GetDefault("TableCreate", pset.HSet)
    pset.Rows = rows
    pset.Cols = cols
    pset.WidthType = 2
    pset.HeightType = 1
    pset.CreateItemArray("RowHeight", rows)
    pset.CreateItemArray("ColWidth", cols)
    for i in range(rows):
        pset.RowHeight.SetItem(i, 1800)
    for i in range(cols):
        pset.ColWidth.SetItem(i, widths[i])
    hwp.HAction.Execute("TableCreate", pset.HSet)


def fill_table(hwp, data: list[list[str]]) -> None:
    rows = len(data)
    cols = len(data[0])
    for r in range(rows):
        for c in range(cols):
            text = data[r][c]
            if text:
                insert_text(hwp, text)
            if c < cols - 1:
                hwp.HAction.Run("TableRightCell")
            elif r < rows - 1:
                # go to next row first cell
                hwp.HAction.Run("TableLowerCell")
                for _ in range(cols - 1):
                    hwp.HAction.Run("TableLeftCell")
    # leave table
    hwp.HAction.Run("Cancel")
    hwp.HAction.Run("MoveDown")
    hwp.HAction.Run("BreakPara")


def main() -> None:
    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception as e:
        print("RegisterModule:", e)

    hwp.XHwpWindows.Item(0).Visible = True
    hwp.HAction.Run("FileNew")
    time.sleep(0.8)

    # Title
    char_shape(hwp, True, 16)
    para(hwp, "PHC파일 관리시스템 개발 및 적용(안)")
    char_shape(hwp, False, 11)
    para(hwp, "")

    heading(hwp, "1. 개요")
    para(hwp, "시스템명 : PHC파일 관리시스템 (명칭 : 파일마스터)")
    para(
        hwp,
        "PHC파일 좌표 자동 추출 기능으로 설계도면과 시공도면과의 정합성을 확인하고, "
        "PDAM과 연동하여 PHC파일의 시공 현황을 관리하고, 기성 및 자재관리를 할 수 있는 "
        "자체 개발 프로그램으로, 모바일 활용이 가능함.",
    )
    para(hwp, "")

    heading(hwp, "2. 현황 및 문제점")

    table = [
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
    ]
    create_table(hwp, 8, 5, [3500, 14500, 14000, 11000, 4000])
    fill_table(hwp, table)

    heading(hwp, "3. 목적 및 기능")
    para(hwp, "1) 목적")
    para(hwp, "① CAD도면상 좌표 자동 추출 및 비교를 통한 설계·시공도면 정합성 확보")
    para(hwp, "② 도면, PDAM, 드론 데이터 통합관리를 통한 시공현황 일원화")
    para(hwp, "③ 파일 입고, 시공, 높이별 기성물량 자동 산출을 통한 기성·자재관리 효율화")
    para(hwp, "④ 전현장 표준관리체계 구축 및 모바일 활용 지원")
    para(hwp, "2) 주요기능 및 기대효과")
    para(hwp, "① 좌표 추출 : CAD 도면에서 PHC파일 좌표를 자동 추출하고 설계·시공도면 간 정합성을 비교")
    para(hwp, "② 모바일 좌표기능 : 현장 모바일에서 좌표·도면 자료를 확인하고 업무 부담을 경감")
    para(hwp, "③ PDAM 항타관리 : PDAM 연동으로 PHC파일 시공(항타) 현황을 관리")
    para(hwp, "④ 드론데이터 활용 : 드론 측량 데이터와 도면·시공 데이터를 연계하여 현황 파악")
    para(hwp, "⑤ 지적, 이격 검토 : 대지경계·흙막이와 말뚝 이격거리를 검토하여 시공지연 예방")
    para(hwp, "⑥ 공구별 시공 시뮬레이션 : 공구 단위 시공 진행을 시뮬레이션하여 공정 관리")
    para(hwp, "⑦ 기성·자재관리 : 파일 입고·시공·높이별 기성물량을 자동 산출하여 관리")
    para(hwp, "")

    heading(hwp, "4. 개발 경과")
    para(hwp, "1) 시스템 구축 : 2026.08~ (자체개발)")
    para(hwp, "2) 시범적용 및 피드백")
    para(hwp, "")

    heading(hwp, "5. 운영 계획")
    para(hwp, "1) 운영 방식 : 베타 버전 (사유 : 전사 로그인 정책 반영 협의중)")
    para(hwp, "2) 주관 : 건축BIM팀 운영")
    para(hwp, "3) 절차 : 현장 요청 > BIM팀 접수 및 세팅 > 현장WEB 공유")
    para(hwp, "4) 고려사항")
    para(hwp, "① 클라우드 서버 사용(추후 5층 운영서버 사용, 디지털개발팀 협의완료)")
    para(hwp, "② 로그인 정책 미확정으로 사용 전체 현장 현황 확인 불가피")
    para(hwp, "")

    heading(hwp, "6. 향후 계획")
    para(hwp, "1) 서버 이관")
    para(hwp, "2) 로그인 정책")

    # Save
    if OUT_HWPX.exists():
        OUT_HWPX.unlink()
    pset = hwp.HParameterSet.HFileOpenSave
    hwp.HAction.GetDefault("FileSaveAs_S", pset.HSet)
    pset.filename = str(OUT_HWPX)
    pset.Format = "HWPX"
    hwp.HAction.Execute("FileSaveAs_S", pset.HSet)
    time.sleep(1.0)
    print("SAVED", OUT_HWPX, OUT_HWPX.exists(), OUT_HWPX.stat().st_size if OUT_HWPX.exists() else 0)

    # Screenshot page 1
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.4)
    screenshot_foreground(OUT_DIR / "verify_p1.png", "PHC_PileMaster")

    # Page down for more pages
    for i in range(2, 6):
        hwp.HAction.Run("MovePageDown")
        time.sleep(0.5)
        screenshot_foreground(OUT_DIR / f"verify_p{i}.png", "PHC_PileMaster")

    # Extract plain text via selection for sanity
    hwp.HAction.Run("MoveDocBegin")
    hwp.HAction.Run("SelectAll")
    try:
        txt = hwp.GetTextFile("TEXT", "")
        Path(OUT_DIR / "verify_text.txt").write_text(txt or "", encoding="utf-8")
        print("TEXT_LEN", len(txt or ""))
        print((txt or "")[:500])
    except Exception as e:
        print("GetTextFile err", e)
    hwp.HAction.Run("Cancel")
    print("DONE")


if __name__ == "__main__":
    main()
