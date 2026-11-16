# -*- coding: utf-8 -*-
"""v3 통과본 HWP를 복제해 서식 유지 + 파일마스터 내용/이미지로 치환."""
from __future__ import annotations

import shutil
import subprocess
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

import win32com.client
from PIL import ImageGrab

SAMPLE = next(Path(r"D:\정헌재 선임_2025\건축_BIM\시스템").rglob("*v3_260319*.hwp"))
OUT_DIR = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_pages")
ASSETS = OUT_DIR / "assets"
DESK = Path(r"C:\Users\AN-WKS\Desktop\PHC파일_관리시스템_파일마스터_구축적용안_v3형식.hwp")
PILEXY = Path(r"d:\정헌재 선임_2025\건축_BIM\PileXY\보고서\PHC파일_관리시스템_파일마스터_구축적용안_v3형식.hwp")
SHOT_DIR = OUT_DIR / "v3_clone_shots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


REPLACES = [
    # 제목/메타
    ("도면 데이터 추출 활용 시스템 구축(안)", "PHC파일 관리시스템(파일마스터) 개발 및 적용(안)"),
    ("도면 데이터 추출 시스템 구축(안)", "PHC파일 관리시스템(파일마스터) 개발 및 적용(안)"),
    ("도면 데이터 추출 활용 시스템", "PHC파일 관리시스템(파일마스터)"),
    ("2026. 03. 20", "2026. 08. 12"),
    ("2026.03 ~ 2026.12", "2026.08 ~ (베타 운영)"),
    ("2026.03~2026.12", "2026.08~(베타)"),
    # 요약 정의/목적
    (
        "캐드(CAD) 도면의 정보를 데이터로 전환하는 시스템. 도면의 형상 정보를 문자 형태로 저장",
        "CAD 도면에서 PHC파일 좌표를 자동 추출·비교하고 PDAM·드론과 연동하여 시공현황·기성·자재를 관리하는 WEB/모바일 시스템",
    ),
    (
        "캐드(CAD) 도면 정보를 데이터로 전환하는 시스템. 도면의 형상 정보를 문자 데이터로 전환하여 저장",
        "CAD 도면에서 PHC파일 좌표를 자동 추출·비교하고 PDAM·드론과 연동하여 시공현황·기성·자재를 관리하는 WEB/모바일 시스템",
    ),
    (
        "도면 작업 중 단순 반복적인 초급 기술자의 업무를 경감(도면 검토 및 작성, 현장 기성 물량 산출 등)",
        "말뚝 3~4천 본 위치 대조(1주일 이상)를 5~10분으로 단축하고 오시공·재시공을 예방하며 현장·본사 동일 WEB 화면으로 공유",
    ),
    (
        "도면 작업 중 단순 반복적인 초급 기술자의 업무를 경감(도면 검토 및 작성, 기성 물량 산출 등)",
        "말뚝 3~4천 본 위치 대조(1주일 이상)를 5~10분으로 단축하고 오시공·재시공을 예방하며 현장·본사 동일 WEB 화면으로 공유",
    ),
    ("초급 기술자의 업무를 경감", "위치확인 1주일→5~10분·오시공 예방"),
    ("도면의 정보를 데이터로 전환", "PHC 좌표 자동추출·정합 확인"),
    ("도면 정보를 데이터로 전환", "PHC 좌표 자동추출·정합 확인"),
    # 단계 라벨
    ("1단계: 도면데이터 추출 시스템", "1단계: 파일마스터 좌표추출·정합"),
    ("2단계: 도면데이터 활용", "2단계: 시공·드론·기성 통합활용"),
    ("파일위치 자동추출", "좌표 정합성"),
    ("구조일람 자동추출", "지적·이격 검토"),
    ("창호정보 자동추출", "PDAM 항타관리"),
    ("3D 모델링 자동화", "공구별 시공시뮬"),
    ("커플러 추출", "드론 비교"),
    ("거푸집 검토", "기성·자재"),
    ("타설 물량 산출", "WEB 열람"),
    ("액세스 로드", "모바일 확인"),
    # 추진 항목
    (
        "① 파일 위치 추출 및 검증(4월) ② 창호 정보 추출 및 검증(5월) ③ 구조 일람 추출 및 검증(6월) ④ 3D 모델링 자동화(7월) 그 외 다수",
        "① 좌표정합 ② PDAM항타 ③ 드론비교 ④ 지적·이격 ⑤ 시공시뮬 ⑥ 기성·자재  (청주씨엘리체 적용중·PoC 2현장 완료)",
    ),
    (
        "① 파일 위치 추출 및 검증(4월) ② 창호 정보 추출 및 검증(5월) ③ 구조 일람 추출 및 검증(6월), ④ 3D 모델링 자동화(7월), 그 외 다수",
        "① 좌표정합 ② PDAM항타 ③ 드론비교 ④ 지적·이격 ⑤ 시공시뮬 ⑥ 기성·자재",
    ),
    # 향후
    (
        "형태로 현장 시범적용 후 전사 시스템 연계 추진(디지털전략팀/ 디지털개발팀)",
        "현장 시범적용(청주씨엘리체) 후 서버이관·로그인정책 반영 및 본부 확대(디지털전략팀/디지털개발팀)",
    ),
    (
        "PoC형태로 현장 피드백후 전사 시스템 연계 추진(디지털전략팀/ 개발팀)",
        "현장 피드백 반영 후 서버이관·로그인정책 확정 및 본부 표준절차화(디지털전략팀/개발팀)",
    ),
    (
        "안정적 운영을 위한 협업 체계 구축(디지털전략팀/ 디지털개발팀/ 외부협력사)",
        "클라우드→5층 운영서버 이관·전사 로그인 정책 반영 및 협업체계 구축(디지털전략팀/디지털개발팀)",
    ),
    # I 섹션
    ("웹 서버 기반의 도면 데이터 관리 시스템", "웹 서버 기반의 PHC파일(파일마스터) 관리 시스템"),
    ("1. 도면 표시", "1. 도면·좌표 표시"),
    ("2. 도면 관리", "2. 도면·버전 관리"),
    ("3. 정보 추출", "3. 좌표·시공 추출"),
    ("4. 정보 관리", "4. 기성·자재 관리"),
    ("캐드 도면 확인", "좌표점·윤곽 표시"),
    ("도면 편집", "버전 비교·편집"),
    ("캐드 도면 업로드", "DXF/DWG 업로드"),
    ("도면 이력 및 버전 관리", "시공도면 버전 관리"),
    ("캐드 도면 데이터 추출", "말뚝 중심점 자동추출"),
    ("공종별 데이터 사용", "PDAM·드론 연계"),
    ("도면 객체 속성", "파일 속성·이격"),
    ("수정 내용 관리", "기성·자재 산출"),
    # II 활용 - 파일마스터 블록 강화 / 타 항목 치환
    ("1) 파일 위치 추출 및 검토(가칭 파일 마스터)", "1) 좌표 정합성(파일마스터 핵심)"),
    ("1) 파일 위치 추출 및 파일(Pile) 시공 마스터", "1) 좌표 정합성(파일마스터 핵심)"),
    ("단순 반복 작업으로 시간 소요가 큼(평균 2일)", "말뚝 3~4천 본 위치 대조에 1주일 이상 소요"),
    ("좌표 누락 및 오입력 리스크 큼", "좌표 오류 시 오시공 → 마이크로파일·철근 보강"),
    ("캐드 데이터를 활용하여 PHC 파일 중심 좌표 자동 추출", "도면에서 말뚝 중심점 자동 산출·설계·시공 정합 확인"),
    ("파일 위치 좌표 변경 이력 관리", "시공도면 버전 비교 및 변경 이력 관리"),
    ("파일의 좌표 자동 추출(약 10분)", "위치 확인 1주일 이상 → 5~10분"),
    ("파일의 좌표 자동 추출(약 10초)", "위치 확인 1주일 이상 → 5~10분"),
    ("좌표누락 및 오입력 방지", "오시공 조기 발견·보강 리스크 축소"),
    ("2) 창호 정보 추출 및 검토(가칭 창호 마스터)", "2) PDAM 항타관리"),
    ("2) 창호 정보 추출 및 창호(Window) 시공 마스터", "2) PDAM 항타관리"),
    ("창호 발주 및 개폐 방향 검토 수작업", "PHC 시공길이·공삭공을 도면과 따로 확인"),
    ("창호 발주 및 자재 물량 검토 수작업", "PHC 시공길이·관입 기록을 도면과 따로 확인"),
    ("창호 발주 및 검토 오류 리스크", "시공길이 누락·오기록 리스크"),
    ("캐드 데이터를 활용하여 창호 데이터 자동 추출", "PDAM 항타 길이·관입과 말뚝 위치를 한 화면에서 대조"),
    ("발주 및 검토 자동화", "시공기록과 도면 정합으로 누락·오기록 방지"),
    ("창호 데이터 자동 추출(약 10분)", "항타·시공길이 대조 자동화"),
    ("창호 데이터 자동 추출(약 10초)", "항타·시공길이 대조 자동화"),
    ("창호 발주 및 검토 오류 제거", "시공길이 누락·오기록 방지"),
    ("3) 구조 일람 추출 및 검토(가칭 일람 마스터)", "3) 드론·지적·이격 검토"),
    ("구조 및 마감 부재 일람 과다(1PJ 벽체 기준 약 3천개)", "설계·시공실적·드론 측량이 분산되어 차이 확인 곤란"),
    ("도면 수정시 일람 변경내역 파악이 어려움", "대지경계·흙막이–말뚝 이격 인력확인 어려움"),
    ("캐드 데이터를 추출하여 구조 일람 자동 추출", "드론(메이샤) 측량과 도면·시공 데이터를 한 화면 연계"),
    ("도면 수정시 일람 변경 이력 관리", "지적·이격거리 자동 검토로 시공지연 예방"),
    ("일람 누락 및 오입력 방지", "측량·도면 차이 한눈에 확인"),
    ("구조 일람 변경사항 자동 체크", "이격 부족 구간 조기 파악"),
    ("BIM 부재 일람 모델링 시간 단축(2시간 → 10분)", "현장·본사 동일 화면으로 의사결정 가속"),
    ("4) 도면 기반 3D 모델링 자동화", "4) 시공 시뮬레이션·기성·자재관리"),
    ("3D 모델링 소요시간이 과다", "공구별 시공 진행 파악 및 기성물량 수작업"),
    ("시공 및 견적 기준이 상시 변경", "현장별 관리시트 상이·표준양식 부재"),
    ("외주 수행 과정의 오류 발생 리스크", "입고·시공·높이별 물량 산출 오류 리스크"),
    ("도면의 공통점을 활용하여 모델링 자동화", "공구별 시공 시뮬레이션 및 기성물량 자동 산출"),
    ("인력 의존형 업무를 시스템 기반 업무로 전환", "WEB/모바일로 전현장 표준관리체계 적용"),
    ("3D 모델링 작업 생산성 향상", "공정 가시화·기성·자재 표준화"),
    ("모델링 용역 단가 절감", "현장별 시트 편차 해소"),
    # 추진/일정 라벨
    ("파일 위치 추출", "좌표 정합"),
    ("창호 정보 추출", "PDAM 항타"),
    ("구조 일람 추출", "드론·이격"),
    ("3D 자동화 모델링", "시공시뮬·기성"),
    ("3D 모델링 자동화", "시공시뮬·기성"),
    ("자체 PoC", "자체 PoC"),
    ("본부 배포", "본부 확대"),
]


def all_replace(hwp, old: str, new: str) -> None:
    pset = hwp.HParameterSet.HFindReplace
    hwp.HAction.GetDefault("AllReplace", pset.HSet)
    pset.FindString = old
    pset.ReplaceString = new
    pset.IgnoreMessage = 1
    pset.ReplaceMode = 1
    pset.MatchCase = 0
    pset.WholeWordOnly = 0
    pset.UseWildCards = 0
    try:
        hwp.HAction.Execute("AllReplace", pset.HSet)
    except Exception as e:
        print("replace fail", old[:24], e)


def list_ctrls(hwp):
    items = []
    ctrl = hwp.HeadCtrl
    while ctrl is not None:
        try:
            items.append((ctrl.CtrlID, ctrl))
        except Exception:
            break
        try:
            ctrl = ctrl.Next
        except Exception:
            break
    return items


def replace_pictures(hwp, image_paths: list[Path]) -> int:
    """문서 내 그림(gso/pic)을 순서대로 교체."""
    imgs = [p for p in image_paths if p.exists()]
    if not imgs:
        return 0
    replaced = 0
    idx = 0
    ctrl = hwp.HeadCtrl
    while ctrl is not None and idx < len(imgs):
        cid = ""
        try:
            cid = ctrl.CtrlID
        except Exception:
            break
        next_ctrl = None
        try:
            next_ctrl = ctrl.Next
        except Exception:
            next_ctrl = None
        if cid in ("gso", "pic", "Gso", "Pic"):
            try:
                # select control
                hwp.SelectCtrl(ctrl) if hasattr(hwp, "SelectCtrl") else None
            except Exception:
                pass
            try:
                # set position by finding
                hwp.SetPosBySet(ctrl.GetAnchorPos(0)) if hasattr(ctrl, "GetAnchorPos") else None
            except Exception:
                pass
            # delete selected ctrl via action
            try:
                hwp.HAction.Run("Delete")
            except Exception:
                try:
                    hwp.HAction.Run("Erase")
                except Exception:
                    pass
            # insert picture
            try:
                pset = hwp.HParameterSet.HInsertPicture
                hwp.HAction.GetDefault("InsertPicture", pset.HSet)
                pset.FileName = str(imgs[idx])
                try:
                    pset.Embedded = 1
                except Exception:
                    pass
                try:
                    pset.overwriteFile = 1
                except Exception:
                    pass
                hwp.HAction.Execute("InsertPicture", pset.HSet)
                print("pic", idx, imgs[idx].name)
                replaced += 1
                idx += 1
            except Exception as e:
                print("insert pic err", e)
                idx += 1
        ctrl = next_ctrl
    return replaced


def insert_picture_at_end(hwp, path: Path) -> None:
    hwp.HAction.Run("MoveDocEnd")
    pset = hwp.HParameterSet.HInsertPicture
    hwp.HAction.GetDefault("InsertPicture", pset.HSet)
    pset.FileName = str(path)
    try:
        pset.Embedded = 1
    except Exception:
        pass
    hwp.HAction.Execute("InsertPicture", pset.HSet)


def screenshot_pages(hwp, prefix: str, n: int = 6) -> None:
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
        if "파일마스터" in t or "v3형식" in t or "PHC" in t:
            hwnd, title = h, t
            break
    user32.ShowWindow(hwnd, 3)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    try:
        vp = hwp.HParameterSet.HViewProperties
        hwp.HAction.GetDefault("ViewZoom", vp.HSet)
        vp.ZoomType = 0
        vp.ZoomRatio = 60
        hwp.HAction.Execute("ViewZoom", vp.HSet)
    except Exception:
        pass
    hwp.HAction.Run("MoveDocBegin")
    time.sleep(0.3)
    r = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    for i in range(1, n + 1):
        img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
        p = SHOT_DIR / f"{prefix}_p{i}.png"
        img.save(p)
        print("SHOT", p.name, title)
        hwp.HAction.Run("MovePageDown")
        time.sleep(0.35)


def main() -> None:
    subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
    time.sleep(2)

    if DESK.exists():
        DESK.unlink()
    shutil.copy2(SAMPLE, DESK)
    print("COPIED template", SAMPLE, "->", DESK, DESK.stat().st_size)

    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception as e:
        print("reg", e)
    hwp.XHwpWindows.Item(0).Visible = True
    hwp.Open(str(DESK))
    time.sleep(1.5)

    # ensure landscape flag
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
        print("landscape", e)

    print("replacing texts", len(REPLACES))
    for old, new in REPLACES:
        all_replace(hwp, old, new)

    # ctrl inventory
    ctrls = list_ctrls(hwp)
    from collections import Counter

    print("CTRLS", Counter(c[0] for c in ctrls))

    # picture replace order matching summary/feature visuals
    pics = [
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
    ]
    n = replace_pictures(hwp, pics)
    print("replaced pics", n)

    hwp.Save()
    time.sleep(0.8)

    # verify text
    hwp.HAction.Run("SelectAll")
    txt = hwp.GetTextFile("TEXT", "") or ""
    hwp.HAction.Run("Cancel")
    (OUT_DIR / "v3_clone_text.txt").write_text(txt, encoding="utf-8")
    print("TEXT_LEN", len(txt))
    print("HAS_TITLE", "파일마스터" in txt)
    print("HAS_OLD_TITLE", "도면 데이터 추출 활용 시스템 구축(안)" in txt)
    print("HAS_5_10", "5~10분" in txt or "5~10" in txt)

    # binary copy to pilexy
    try:
        PILEXY.parent.mkdir(parents=True, exist_ok=True)
        PILEXY.write_bytes(DESK.read_bytes())
        print("COPIED", PILEXY, PILEXY.stat().st_size)
    except Exception as e:
        print("pilexy copy", e)

    screenshot_pages(hwp, "clone", 6)
    print("DONE")


if __name__ == "__main__":
    main()
