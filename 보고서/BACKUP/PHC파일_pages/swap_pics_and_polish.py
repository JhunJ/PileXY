# -*- coding: utf-8 -*-
"""파일마스터 v3형식 문서: 그림 교체 + 잔여 문구 정리 + 스크린샷 검증."""
from __future__ import annotations

import subprocess
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab, Image, ImageDraw, ImageFont

DOC = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_구축적용안_v3형식.hwp")
PILEXY = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_구축적용안_v3형식.hwp")
ASSETS = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages\assets")
SHOT = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages\v3_clone_shots")
V3_CLEAN = ASSETS
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


# 요약/상세에 쓸 이미지 순서 (문서 gso 등장 순에 맞춤, 부족하면 순환)
PIC_CYCLE = [
    ASSETS / "01-coord.png",
    ASSETS / "01-coord.png",
    ASSETS / "ai-01-coord.png",
    ASSETS / "ai-02-pdam.png",
    ASSETS / "ai-04-cadastral.png",
    ASSETS / "ai-05-simul.png",
    ASSETS / "ai-03-meissa.png",
    ASSETS / "ai-06-billing.png",
    ASSETS / "pilexy-cheongju-cieliche.png",
    ASSETS / "01-coord.png",
    ASSETS / "02-pdam.png",
    ASSETS / "03-drone.png",
    ASSETS / "04-jijeok.png",
    ASSETS / "05-simul.png",
    ASSETS / "06-gisung.png",
    ASSETS / "pilexy-cheongju-cieliche-map.png",
    ASSETS / "ai-01-coord.png",
    ASSETS / "ai-02-pdam.png",
    ASSETS / "ai-03-meissa.png",
    ASSETS / "ai-04-cadastral.png",
    ASSETS / "ai-05-simul.png",
    ASSETS / "ai-06-billing.png",
    ASSETS / "pilexy-cheongju-cieliche-canvas.png",
    ASSETS / "01-coord.png",
]

TEXT_FIXES = [
    ("① 좌표 정합 및 검증(4월) ② PDAM 항타 및 검증(5월) ③ 드론·이격 및 검증(6월) ④ 공구별 시공시뮬(7월) 그 외 다수",
     "① 좌표정합 ② PDAM항타 ③ 드론비교 ④ 지적·이격 ⑤ 시공시뮬 ⑥ 기성·자재  (청주씨엘리체 적용중 · PoC 2현장 완료)"),
    ("건축BIM팀/ 2026.08 ~ (베타 운영)", "건축BIM팀 자체개발 / 2026.08 ~ (베타 운영)"),
    ("위치확인 1주일→5~10분·오시공 예방", "위치확인 1주일→5~10분 · 오시공 예방"),
]


def all_replace(hwp, old: str, new: str) -> None:
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("AllReplace", pset.HSet)
    pset.FindString = old
    pset.ReplaceString = new
    pset.IgnoreMessage = 1
    pset.ReplaceMode = 1
    try:
        hwp.HAction.Execute("AllReplace", pset.HSet)
    except Exception as e:
        print("repl err", e)


def swap_pictures(hwp) -> int:
    imgs = [p for p in PIC_CYCLE if p.exists()]
    if not imgs:
        print("no imgs")
        return 0

    # collect gso list first
    gso_list = []
    ctrl = hwp.HeadCtrl
    while ctrl is not None:
        try:
            if ctrl.CtrlID == "gso":
                gso_list.append(ctrl)
            ctrl = ctrl.Next
        except Exception:
            break
    print("gso count", len(gso_list))

    ok_n = 0
    for i, ctrl in enumerate(gso_list):
        img = str(imgs[i % len(imgs)])
        try:
            pos = ctrl.GetAnchorPos(0)
            hwp.SetPosBySet(pos)
        except Exception as e:
            print("pos", i, e)
            continue
        # FindCtrl selects the control at caret
        try:
            hwp.FindCtrl()
        except Exception as e:
            print("FindCtrl", i, e)
        pset = hwp.HParameterSet.HPictureChange
        hwp.HAction.GetDefault("PictureChange", pset.HSet)
        try:
            pset.PicturePath = img
        except Exception:
            pset.HSet.SetItem("PicturePath", img)
        try:
            pset.PictureEmbed = 1
        except Exception:
            try:
                pset.HSet.SetItem("PictureEmbed", 1)
            except Exception:
                pass
        try:
            done = hwp.HAction.Execute("PictureChange", pset.HSet)
            print(i, "PictureChange", done, Path(img).name)
            if done:
                ok_n += 1
        except Exception as e:
            print(i, "err", e)
        # cancel selection
        try:
            hwp.HAction.Run("Cancel")
        except Exception:
            pass
    return ok_n


def screenshot(hwp, name: str, pages: int = 5) -> None:
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
    hwnd, title = wins[0]
    for h, t in wins:
        if "v3형식" in t or "파일마스터" in t or "PHC" in t:
            hwnd, title = h, t
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    try:
        vp = hwp.HParameterSet.HViewProperties
        hwp.HAction.GetDefault("ViewZoom", vp.HSet)
        vp.ZoomType = 0
        vp.ZoomRatio = 55
        hwp.HAction.Execute("ViewZoom", vp.HSet)
    except Exception:
        pass
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.3)
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    for i in range(1, pages + 1):
        img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
        p = SHOT / f"{name}_p{i}.png"
        img.save(p)
        print("SHOT", p.name)
        hwp.HAction.Run("MovePageDown")
        time.sleep(0.35)


def side_by_side_compare() -> None:
    """v3 clean p1 vs clone p1 나란히 저장."""
    a = V3_CLEAN / "v3_clean_p01.png"
    b = SHOT / "final_p1.png"
    if not (a.exists() and b.exists()):
        print("skip compare missing", a.exists(), b.exists())
        return
    im_a = Image.open(a).convert("RGB")
    im_b = Image.open(b).convert("RGB")
    # scale b page area roughly
    h = 800
    im_a = im_a.resize((int(im_a.width * h / im_a.height), h))
    im_b = im_b.resize((int(im_b.width * h / im_b.height), h))
    canvas = Image.new("RGB", (im_a.width + im_b.width + 40, h + 40), (255, 255, 255))
    canvas.paste(im_a, (10, 30))
    canvas.paste(im_b, (im_a.width + 30, 30))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 5), "SAMPLE v3", fill=(0, 0, 180))
    draw.text((im_a.width + 30, 5), "FILEMASTER clone", fill=(180, 0, 0))
    out = SHOT / "compare_p1.png"
    canvas.save(out)
    print("COMPARE", out)


def main() -> None:
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(2)
    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.Open(str(DOC))
    time.sleep(1.2)

    for old, new in TEXT_FIXES:
        all_replace(hwp, old, new)

    n = swap_pictures(hwp)
    print("swapped", n)
    hwp.Save()
    time.sleep(0.6)

    try:
        PILEXY.write_bytes(DOC.read_bytes())
        print("copied pilexy", PILEXY.stat().st_size)
    except Exception as e:
        print("copy", e)

    screenshot(hwp, "final", 5)
    # also save a closer zoom of page1 only
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.2)
    try:
        vp = hwp.HParameterSet.HViewProperties
        hwp.HAction.GetDefault("ViewZoom", vp.HSet)
        vp.ZoomType = 0
        vp.ZoomRatio = 70
        hwp.HAction.Execute("ViewZoom", vp.HSet)
    except Exception:
        pass
    time.sleep(0.3)
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
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.3)
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
    img.save(SHOT / "final_p1.png")
    side_by_side_compare()
    print("DONE")


if __name__ == "__main__":
    main()
