# -*- coding: utf-8 -*-
"""Replace pipe-text table with a real Hangul table, then screenshot."""
from __future__ import annotations

import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab

DOC = Path(r"C:\Users\AN-WKS\Desktop\PHC_PileMaster.hwp")
OUT_DIR = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
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


DATA = [
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


def find_hwp_window():
    wins = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def foreach(hwnd, _lp):
        if not user32.IsWindowVisible(hwnd):
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        if n == 0:
            return True
        title = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, title, n + 1)
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        if "HwpApp" in cls.value:
            wins.append((hwnd, title.value))
        return True

    user32.EnumWindows(foreach, 0)
    if not wins:
        raise RuntimeError("no hwp window")
    for h, t in wins:
        if "PHC_PileMaster" in t:
            return h, t
    return wins[0]


def screenshot(path: Path) -> None:
    hwnd, title = find_hwp_window()
    user32.ShowWindow(hwnd, 9)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    img = ImageGrab.grab(
        bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True
    )
    img.save(path)
    print("SHOT", path.name, title)


def insert_text(hwp, text: str) -> None:
    pset = hwp.HParameterSet.HInsertText
    hwp.HAction.GetDefault("InsertText", pset.HSet)
    pset.Text = text
    hwp.HAction.Execute("InsertText", pset.HSet)


def find_replace(hwp, old: str, new: str) -> None:
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("AllReplace", pset.HSet)
    pset.FindString = old
    pset.ReplaceString = new
    pset.IgnoreFindString = 0
    pset.IgnoreReplaceString = 0
    pset.Direction = 0
    pset.MatchCase = 0
    pset.AllWordForms = 0
    pset.SeveralWords = 0
    pset.UseWildCards = 0
    pset.WholeWordOnly = 0
    pset.AutoSpell = 0
    pset.ReplaceMode = 1
    pset.IgnoreMessage = 1
    pset.HangingPunct = 0
    try:
        hwp.HAction.Execute("AllReplace", pset.HSet)
    except Exception as e:
        print("AllReplace err", e)


def delete_paragraph_with_text(hwp, needle: str) -> bool:
    """Find needle, select whole para, delete."""
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("RepeatFind", pset.HSet)
    pset.FindString = needle
    pset.IgnoreMessage = 1
    pset.Direction = 0
    try:
        ok = hwp.HAction.Execute("RepeatFind", pset.HSet)
    except Exception as e:
        print("find err", needle[:20], e)
        return False
    if not ok:
        return False
    hwp.HAction.Run("MoveSelLineBegin")
    hwp.HAction.Run("MoveSelLineEnd")
    # extend to include paragraph break
    hwp.HAction.Run("MoveSelRight")
    hwp.HAction.Run("Delete")
    return True


def create_and_fill_table(hwp) -> None:
    rows, cols = len(DATA), 5
    # A4 usable ~ 150mm -> ~42500 HWPUNIT; distribute columns
    widths = [4500, 16000, 14000, 11000, 4000]  # sum 49500 ~ slightly wide, ok
    pset = hwp.HParameterSet.HTableCreation
    hwp.HAction.GetDefault("TableCreate", pset.HSet)
    pset.Rows = rows
    pset.Cols = cols
    pset.WidthType = 2  # absolute
    pset.HeightType = 0  # auto / distribute
    pset.CreateItemArray("RowHeight", rows)
    pset.CreateItemArray("ColWidth", cols)
    for i in range(rows):
        pset.RowHeight.SetItem(i, 1200)
    for i in range(cols):
        pset.ColWidth.SetItem(i, widths[i])
    hwp.HAction.Execute("TableCreate", pset.HSet)
    time.sleep(0.2)

    # Fill using TableCellAddress style via InitScan? Prefer TableRightCell carefully.
    for r in range(rows):
        for c in range(cols):
            text = DATA[r][c]
            if text:
                # smaller font inside table
                act = hwp.CreateAction("CharShape")
                s = act.CreateSet()
                act.GetDefault(s)
                s.SetItem("Height", 900)  # 9pt
                s.SetItem("Bold", True if r == 0 else False)
                act.Execute(s)
                insert_text(hwp, text)
            if c < cols - 1:
                hwp.HAction.Run("TableRightCell")
            else:
                if r < rows - 1:
                    # next row first cell
                    hwp.HAction.Run("TableLowerCell")
                    for _ in range(cols - 1):
                        hwp.HAction.Run("TableLeftCell")

    # Exit table to body after last cell
    hwp.HAction.Run("TableCellBlockRow")  # may select row
    hwp.HAction.Run("Cancel")
    hwp.HAction.Run("MoveDown")
    hwp.HAction.Run("BreakPara")


def main() -> None:
    import subprocess

    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(2)

    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception as e:
        print("RegisterModule", e)
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.Open(str(DOC))
    time.sleep(1.2)

    # Delete each pipe-table line (from bottom-ish content markers)
    needles = [
        "7 | 현장별 관리시트 상이",
        "6 | 기성관리 어려움",
        "5 | 분산된 데이터로 관리 어려움",
        "4 | PDAM 적용 현황 관리 미흡",
        "3 | 빈번한 도면 변경에 따른 시공지연",
        "2 | 대지경계, 흙막이와 말뚝 이격거리 부족",
        "1 | 설계도면 좌표와 시공도면 좌표 불일치",
        "[표] 구분 | 현황 및 문제점",
    ]
    hwp.HAction.Run("MoveDocBegin")
    for needle in needles:
        # search from beginning each time
        hwp.HAction.Run("MoveDocBegin")
        deleted = delete_paragraph_with_text(hwp, needle)
        print("delete", needle[:24], deleted)
        time.sleep(0.05)

    # Place caret after "2. 현황 및 문제점"
    hwp.HAction.Run("MoveDocBegin")
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("RepeatFind", pset.HSet)
    pset.FindString = "2. 현황 및 문제점"
    pset.IgnoreMessage = 1
    hwp.HAction.Execute("RepeatFind", pset.HSet)
    hwp.HAction.Run("MoveLineEnd")
    hwp.HAction.Run("BreakPara")

    create_and_fill_table(hwp)

    # Save
    hwp.Save()
    time.sleep(0.8)
    # also saveas to phc_out
    out2 = Path(r"C:\Users\AN-WKS\Desktop\phc_out\PHC_PileMaster.hwp")
    try:
        pset = hwp.HParameterSet.HFileOpenSave
        hwp.HAction.GetDefault("FileSaveAs_S", pset.HSet)
        pset.filename = str(out2)
        pset.Format = "HWP"
        hwp.HAction.Execute("FileSaveAs_S", pset.HSet)
        print("SaveAs", out2.exists(), out2.stat().st_size if out2.exists() else 0)
    except Exception as e:
        print("SaveAs err", e)

    # Verify: GetTextFile should still have content; table cells included
    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    (OUT_DIR / "after_table_text.txt").write_text(txt, encoding="utf-8")
    print("TEXT_LEN", len(txt))
    print("HAS_PIPE_HEADER", "[표] 구분" in txt)
    print("HAS_CELL", "손쉬운 좌표추출" in txt)

    # Screenshot top then around table
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.3)
    try:
        vp = hwp.HParameterSet.HViewProperties
        hwp.HAction.GetDefault("ViewZoom", vp.HSet)
        vp.ZoomType = 0
        vp.ZoomRatio = 70
        hwp.HAction.Execute("ViewZoom", vp.HSet)
    except Exception:
        pass

    # find table section
    hwp.HAction.Run("MoveDocBegin")
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("RepeatFind", pset.HSet)
    pset.FindString = "2. 현황 및 문제점"
    pset.IgnoreMessage = 1
    hwp.HAction.Execute("RepeatFind", pset.HSet)
    time.sleep(0.3)
    screenshot(OUT_DIR / "table_ok_p1.png")
    hwp.HAction.Run("MovePageDown")
    time.sleep(0.3)
    screenshot(OUT_DIR / "table_ok_p2.png")
    print("DONE")


if __name__ == "__main__":
    main()
