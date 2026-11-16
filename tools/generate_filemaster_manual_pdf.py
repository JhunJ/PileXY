#!/usr/bin/env python3
"""파일 마스터 현장용 사용자 매뉴얼 PDF."""

from __future__ import annotations

import base64
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "manual" / "assets" / "screenshots"
MANUAL_ASSETS = ROOT / "docs" / "manual" / "assets"
COORD_DIAGRAM = MANUAL_ASSETS / "coord-drawing-guide.png"
HTML_OUT = ROOT / "docs" / "manual" / "manual.html"
PDF_OUT = ROOT / "파일마스터_사용자_매뉴얼.pdf"
ACCESS_URL = "https://pilexy.yeobaekstudio.com/"
PDAM_URL = "https://we8104.com/login"

# 본사(건축BIM팀)에서 수집·등록하는 자료
HQ_MATERIALS = [
    ("좌표·말뚝", "최신 좌표도 · 지하 말뚝 계획도(평면)", "본사 등록"),
    ("구조", "평면·단면 구조계획도 · 구조 일반평면도(지하주차장, 동 — 기초레벨 파악용) · 단면상세도 · 코어단면도", "본사 등록"),
    ("구조", "구조부재일람표 (특히 기초 · 바닥 슬라브)", "본사 등록"),
    ("타워", "타워도면 (두께·위치 표시)", "본사 등록"),
    ("측량", "현황 측량 성과품 (측량업체 측량 정보 — 전체 필지 비교용)", "현장 → 본사 전달"),
]

FIELD_DELIVERY = [
    ("도면", "시공사·설계사 최신 도면(CAD)", "도면 수령 시", "본사(건축BIM팀) 담당자"),
    ("측량", "현황 측량 성과품 (측량업체 자료)", "수령 시", "전체 필지 비교·검토용"),
    ("변경", "도면 변경·추가분", "변경 발생 시", "본사 전달 또는 현장 직접 업로드"),
]

HQ_SETUP = [
    "도면 수령 · DXF/DWG 업로드 · 좌표·동·윤곽 설정",
    "작업 버전 저장 (프로젝트·구분·제목)",
    "PDAM 계정 연동 · 데이터셋 초기 세팅",
    "기초골조 두께 · 동별 기본값 입력",
]

FIELD_DAILY = [
    "접속 후 본사 세팅 작업 「불러오기」",
    "PDAM 동기화 (자동 연동 — 별도 엑셀 전달 불필요)",
    "시공현황 · 시뮬레이션으로 진행 확인",
    "기성정리 · 자재관리 · 필지·버전 검토",
    "도면 변경 시 본사 전달 또는 현장에서 직접 업로드 → 버전 저장",
]

TOC_GROUPS = [
    ("시작하기", "start", [
        ("intro", "접속 · 프로그램 개요"),
        ("mobile", "모바일에서 좌표 확인"),
    ]),
    ("준비 · 자료", "prep", [
        ("materials", "필요 자료 · 도면 전달"),
        ("coord-drawing-guide", "좌표도 (참고 예시)"),
        ("workflow", "본사 vs 현장 흐름"),
    ]),
    ("교육", "train", [
        ("training", "1 · 2 · 3차 교육"),
    ]),
    ("현장 사용법", "field", [
        ("field-guide", "화면별 사용법 — 개요"),
        ("guide-load", "접속 · 작업 불러오기"),
        ("guide-design", "설계 검토 (필지 · 흙막이)"),
        ("guide-pdam", "PDAM 연동"),
        ("guide-status", "시공현황 · 시뮬레이션"),
        ("guide-settlement", "기성정리"),
        ("guide-materials", "자재관리"),
        ("guide-billing", "정산관리"),
        ("guide-version", "버전 · 엑셀 비교"),
    ]),
    ("부록", "append", [
        ("appendix", "접속 · 면책"),
        ("revision-history", "수정 이력"),
    ]),
]

# (수정 내용, 버전, 담당자, 수정일) — 신규 이력은 아래에 추가
REVISION_HISTORY = [
    ("최초 작성 — 현장용 사용자 매뉴얼 발행", "1.0", "건축BIM팀 정헌재 선임", "2026.05.28"),
    ("좌표도 (참고 예시) 페이지 추가", "1.1", "건축BIM팀 정헌재 선임", "2026.05.28"),
]

# 좌표도 포함 항목 (표 1)
COORD_DRAWING_ITEMS = [
    ("필지 윤곽", "전체 필지 경계", "동·주차장 등을 모두 포함"),
    ("동 윤곽", "101동, 102동 …", "수직·수평으로만 꺾인 폴리라인"),
    ("말뚝", "빈 원 + 번호", "동·주차장 등. 번호는 원 밖 텍스트, 주차장은 윤곽 없음"),
    ("기초 윤곽", "닫힌 선", "말뚝 주위 기초 윤곽(닫힌 폴리라인). 일부만 있어도 참고 가능"),
    ("기초부호", "PF1, FS1 …", "기초 윤곽 근처 텍스트 표기"),
]

# 좌표도 작성 규칙 (표 2)
COORD_DRAWING_RULES = [
    (
        "좌표도에 도면 1개만",
        "CAD 파일에는 좌표도 도면 1개만 넣습니다. 작업용 별도 도면이 함께 있으면 말뚝·기호가 여러 객체로 오인식될 수 있습니다.",
    ),
    (
        "번호·좌표 표기",
        "말뚝 번호 텍스트 크기를 통일합니다. 동-번호 형식이면 동에는 실제 동 번호를 쓰고, 번호만 표기해도 됩니다. 좌표 값은 숫자로 표기합니다(영문·기호 지양).",
    ),
    (
        "말뚝 외 원 없음",
        "말뚝 이외의 원(배관·기호·장식 등)은 두지 않는 것이 좋습니다.",
    ),
    (
        "기초부호 표기",
        "PF1, FS1 등 기초부호 텍스트를 기초 윤곽 근처에 표기하면 기초 유형 구분에 도움이 됩니다.",
    ),
    (
        "좌표 정확도",
        "말뚝 좌표는 정확해야 합니다. 보통 메이샤(Meissa) 업로드 좌표도와 유사한 형식·정밀도를 권장합니다.",
    ),
]

TRAINING_ROWS = [
    ("1차", "공사 · 공무", "파일공사 1개월 전",
     ["전체 개념 설명 및 현장 뷰어 활용법 교육", "향후 일정 및 협업 체계 가이드 제공"]),
    ("2차", "지정공사 담당", "파일공사 착수 전",
     ["자재/도면/기성 실무 관리 및 데이터 관리", "착수 임박 시점의 현장 밀착형 직무 교육"]),
    ("옵션", "지정공사 담당", "파일공사 1개월 후",
     ["실무 사용 의견 수렴 및 애로사항 파악", "시스템 기능 개선 및 활용도 제고"]),
]


def ensure_coord_diagram() -> None:
    subprocess.run([sys.executable, str(ROOT / "tools" / "generate_coord_drawing_diagram.py")], check=False)


def asset_image(path: Path, alt: str, *, caption: str = "", css_class: str = "shot") -> str:
    if not path.exists():
        return f"""<div class="shot-missing">
  <span class="shot-missing-icon">!</span>
  <strong>{alt}</strong>
  <p>다이어그램({path.name}) 생성 중입니다.</p>
</div>"""
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    cap = caption or alt
    return f"""<figure class="figure">
  <img class="{css_class}" src="data:image/png;base64,{data}" alt="{alt}" />
  <figcaption><strong>{alt}</strong><span>{cap}</span></figcaption>
</figure>"""


def build_coord_tables_html() -> str:
    item_rows = "".join(
        f"<tr><td>{cat}</td><td>{what}</td><td>{note}</td></tr>"
        for cat, what, note in COORD_DRAWING_ITEMS
    )
    rule_rows = "".join(
        f'<tr><td class="coord-no">{i})</td><td class="coord-item">{title}</td><td>{body}</td></tr>'
        for i, (title, body) in enumerate(COORD_DRAWING_RULES, 1)
    )
    return f"""<div class="coord-tables">
<table class="data-table data-table-coord">
  <caption>포함 항목</caption>
  <thead><tr><th>구분</th><th>표기</th><th>설명</th></tr></thead>
  <tbody>{item_rows}</tbody>
</table>
<table class="data-table data-table-coord data-table-coord-rules">
  <caption>작성 규칙</caption>
  <thead><tr><th>No.</th><th>항목</th><th>상세</th></tr></thead>
  <tbody>{rule_rows}</tbody>
</table>
</div>"""


def ensure_screenshots() -> None:
    required = [
        "00-main-clean.png", "03-construction-status.png", "step-settlement-xlsx-preview.png",
        "step-retaining-btn.png", "08-billing-panel.png", "step-version-excel.png",
        "step-materials-cement.png",
    ]
    if all((SHOTS / n).exists() for n in required):
        return
    subprocess.run([sys.executable, str(ROOT / "tools" / "capture_manual_screenshots.py")], check=False)


def shot(name: str, alt: str, *, hero: bool = False, small: bool = False, caption: str = "",
         excel_preview: bool = False) -> str:
    path = SHOTS / f"{name}.png"
    if not path.exists():
        return f"""<div class="shot-missing">
  <span class="shot-missing-icon">!</span>
  <strong>{alt}</strong>
  <p>스크린샷({name}.png)을 생성 중입니다. capture 스크립트를 실행해 주세요.</p>
</div>"""
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    if hero:
        cls = "shot hero"
    elif excel_preview or "xlsx-preview" in name:
        cls = "shot excel-preview"
    elif small:
        cls = "shot small"
    else:
        cls = "shot"
    cap = caption or alt
    return f"""<figure class="figure">
  <img class="{cls}" src="data:image/png;base64,{data}" alt="{alt}" />
  <figcaption><strong>{alt}</strong><span>{cap}</span></figcaption>
</figure>"""


def guide_block(
    title: str,
    steps: list[tuple[str, str, str, str]],
    *,
    new_page: bool = False,
    anchor_id: str = "",
) -> str:
    """steps: (screenshot_name, step_title, description, image_caption)"""
    page_cls = " guide-block-page" if new_page else ""
    id_attr = f' id="{anchor_id}"' if anchor_id else ""
    parts = [f'<div class="guide-block{page_cls}"{id_attr}>']
    parts.append(f'<div class="guide-block-head"><h3 class="guide-title">{title}</h3>')

    def step_html(i: int, img: str, stitle: str, desc: str, img_cap: str) -> str:
        cap = img_cap or desc.replace("<strong>", "").replace("</strong>", "")
        if img:
            is_excel = "xlsx-preview" in img
            img_html = shot(img, stitle, small=not is_excel, caption=cap, excel_preview=is_excel)
        else:
            img_html = ""
        return f"""<div class="guide-step">
  <div class="guide-step-head"><span class="guide-num">{i}</span><strong>{stitle}</strong></div>
  <p>{desc}</p>
  {img_html}
</div>"""

    if steps:
        parts.append(step_html(1, *steps[0]))
    parts.append("</div>")
    for i, step in enumerate(steps[1:], 2):
        parts.append(step_html(i, *step))
    parts.append("</div>")
    return "\n".join(parts)


def build_toc_html() -> str:
    parts: list[str] = []
    for group_name, group_id, items in TOC_GROUPS:
        cards = "".join(
            f'<a class="toc-item{" toc-item-sub" if sid.startswith("guide-") else ""}" href="#{sid}">'
            f'<span class="toc-dot"></span>{title}</a>'
            for sid, title in items
        )
        parts.append(f"""<div class="toc-group toc-group-{group_id}">
  <div class="toc-group-head">{group_name}</div>
  <div class="toc-items">{cards}</div>
</div>""")
    return "\n".join(parts)


def build_material_tables() -> tuple[str, str]:
    delivery_rows = "".join(
        f"<tr><td>{cat}</td><td>{item}</td><td>{when}</td><td>{to}</td></tr>"
        for cat, item, when, to in FIELD_DELIVERY
    )
    hq_rows = "".join(
        f"<tr><td>{cat}</td><td>{item}</td><td>{note}</td></tr>"
        for cat, item, note in HQ_MATERIALS
    )
    delivery = f"""<table class="data-table">
  <caption>현장 → 본사 전달 자료</caption>
  <thead><tr><th>구분</th><th>항목</th><th>시점</th><th>전달처</th></tr></thead>
  <tbody>{delivery_rows}</tbody>
</table>"""
    hq = f"""<table class="data-table data-table-hq">
  <caption>본사(건축BIM팀) 수집 · 등록 자료</caption>
  <thead><tr><th>구분</th><th>항목</th><th>비고</th></tr></thead>
  <tbody>{hq_rows}</tbody>
</table>"""
    return delivery, hq


def build_revision_html() -> str:
    rows = "".join(
        f"<tr><td>{summary}</td><td class=\"rev-version\">{version}</td>"
        f"<td>{author}</td><td class=\"rev-date\">{rev_date}</td></tr>"
        for summary, version, author, rev_date in REVISION_HISTORY
    )
    return f"""<table class="data-table data-table-revision">
  <caption>매뉴얼 수정 이력</caption>
  <thead><tr><th>수정 내용</th><th>V</th><th>담당자</th><th>수정일</th></tr></thead>
  <tbody>{rows}</tbody>
</table>"""


def build_training_html() -> str:
    rows: list[str] = []
    for phase, target, timing, bullets in TRAINING_ROWS:
        badge_cls = {"1차": "badge-1", "2차": "badge-2", "옵션": "badge-opt"}.get(phase, "")
        bullets_html = "".join(f"<li>{b}</li>" for b in bullets)
        rows.append(f"""<tr>
  <td><span class="train-badge {badge_cls}">{phase}</span></td>
  <td class="train-target">{target}</td>
  <td class="train-timing">{timing}</td>
  <td><ul class="train-list">{bullets_html}</ul></td>
</tr>""")
    return f"""<table class="train-table">
  <thead><tr><th>구분</th><th>대상</th><th>시기</th><th>주요 교육 내용</th></tr></thead>
  <tbody>{"".join(rows)}</tbody>
</table>"""


def build_html() -> str:
    today = date.today().strftime("%Y.%m.%d")
    toc_html = build_toc_html()
    delivery_table, hq_table = build_material_tables()
    hq_setup = "".join(f"<li>{x}</li>" for x in HQ_SETUP)
    field_list = "".join(f"<li>{x}</li>" for x in FIELD_DAILY)
    training_html = build_training_html()
    revision_html = build_revision_html()
    coord_rules_html = build_coord_tables_html()
    coord_diagram_html = asset_image(
        COORD_DIAGRAM,
        "좌표도 구성 예시",
        caption="동(수직·수평) · 기초부호 · 기초 윤곽(닫힌 선) · 주차장 말뚝",
        css_class="shot coord-diagram",
    )

    field_guides = (
        guide_block("접속 · 작업 불러오기", [
            ("01-access-main", "브라우저 접속",
             f"주소창에 <strong>{ACCESS_URL}</strong> 입력 후 접속합니다.",
             "파일 마스터 접속 화면 — 별도 설치 없이 브라우저에서 실행"),
            ("step-load-btn", "「불러오기」",
             "상단 <strong>작업 버전 → 불러오기</strong>를 클릭합니다. (본사에서 세팅·저장해 둔 작업을 불러옵니다)",
             "상단 「불러오기」 버튼 위치 (주황 테두리)"),
            ("step-load-panel", "프로젝트·버전 선택",
             "좌측에서 해당 프로젝트를 고르고, 우측 목록에서 최신 버전을 확인합니다.",
             "불러오기 패널 — 프로젝트 검색·버전 목록"),
            ("step-load-select", "「불러오기」 실행",
             "해당 버전 오른쪽 <strong>불러오기</strong> 버튼을 누르면 도면·좌표·동 설정이 화면에 적용됩니다.",
             "선택한 버전의 「불러오기」 실행"),
            ("00-main-clean", "메인 화면",
             "캔버스에 말뚝 좌표가 표시됩니다. 확대·이동으로 현장 배치를 확인할 수 있습니다.",
             "작업 불러온 후 메인 화면 — 캔버스 전체 확인"),
        ], anchor_id="guide-load")
        + guide_block("설계 검토 (필지 · 흙막이)", [
            ("step-parcel-btn", "「필지 검토」",
             "상단 <strong>시공 → 필지 검토</strong>에서 지적·필지·좌표등록부를 확인합니다. (PDAM과 별개)",
             "필지 검토 버튼"),
            ("06-parcel-review", "필지·침범 확인",
             "메인 캔버스 항목의 <strong>필지 검토 뷰어 표시</strong> 체크박스를 켠 뒤, 말뚝 군집과 필지 경계·좌표등록부를 겹쳐 <strong>침범 여부</strong>를 검토합니다.",
             "필지 검토 뷰어 표시 ON — 필지·좌표등록부 겹침 검토"),
            ("step-retaining-btn", "흙막이 라인 열기",
             "캔버스 <strong>좌측 하단</strong> 「흙막이 라인(캐드 폴리선)」 — <strong>검토할 때만</strong> 열어 사용합니다.",
             "캔버스 좌측 하단 흙막이 버튼"),
            ("step-retaining-open", "폴리라인 선택",
             "「선택」 후 도면에서 흙막이 폴리라인을 클릭해 지정합니다.",
             "흙막이 패널 — 선택·거리 계산"),
            ("09-retaining-wall", "거리 계산 · 결과",
             "「거리 계산」으로 말뚝과 흙막이 이격 거리를 확인합니다. 검토 후 패널을 닫으면 다른 화면에 영향 없습니다.",
             "이격 거리 결과 · 캔버스 반영"),
        ], new_page=True, anchor_id="guide-design")
        + guide_block("PDAM 연동", [
            ("10-pdam-login", "PDAM 시스템 (참고)",
             "아래 화면은 we8104.com의 <strong>PDAM</strong> 시공 기록 시스템입니다. "
             "파일 마스터에서는 이 사이트에 직접 로그인하지 않으며, "
             "아래 <strong>설정</strong> 탭에서 ID·PW를 입력해 연동합니다.",
             "PDAM 시스템 화면 (참고 — 로그인은 파일 마스터 설정 탭에서)"),
            ("step-status-btn", "「시공현황」 열기",
             "상단 <strong>시공 → 시공현황</strong>을 클릭합니다.",
             "상단 시공현황 버튼"),
            ("step-pdam-tab", "설정 탭",
             "패널 상단 <strong>설정</strong> 탭으로 이동합니다.",
             "시공현황 패널 — 설정 탭"),
            ("04-pdam-settings", "PDAM 계정 · 로그인",
             "설정 탭에서 PDAM <strong>ID · PW</strong>를 입력합니다. (현장 계정 사용 — 변경 시 본사(건축BIM팀) 문의)",
             "설정 탭 — PDAM ID · 비밀번호 입력 (여기서 로그인 연동)"),
            ("step-pdam-sync", "PDAM 동기화",
             "<strong>PDAM 동기화</strong> 버튼으로 we8104 기록지를 자동 가져옵니다. 별도 엑셀 전달은 필요 없습니다.",
             "PDAM 동기화 버튼 — 클릭 시 기록지 자동 수집"),
        ], new_page=True, anchor_id="guide-pdam")
        + guide_block("시공현황 · 시뮬레이션", [
            ("03-construction-status", "시공현황 패널",
             "시공현황 탭에서 색상·기간·장비 필터를 설정합니다.",
             "시공현황 탭 — 필터·차트·날짜 범위 설정"),
            ("step-status-apply", "현황 적용",
             "조건 설정 후 <strong>현황 적용</strong>을 누르면 캔버스에 박음/미시공 색상이 반영됩니다.",
             "현황 적용 버튼 — 캔버스 색상 반영"),
            ("step-playback", "시뮬레이션",
             "<strong>시뮬레이션</strong>으로 날짜별 시공 진행을 재생·확인할 수 있습니다.",
             "시뮬레이션 재생 — 날짜별 진행 확인"),
        ], new_page=True, anchor_id="guide-status")
        + guide_block("기성정리", [
            ("step-settlement-btn", "「기성정리」",
             "상단 <strong>시공 → 기성정리</strong>를 클릭합니다.",
             "기성정리 탭 진입"),
            ("05-settlement", "기성표 확인",
             "기준 월을 선택하고 기성 내역을 표에서 확인합니다.",
             "기성 정리표 — 월별 박음·미시공 집계"),
            ("step-settlement-calc", "기성 다시 계산",
             "<strong>기성 다시 계산</strong>으로 표를 갱신합니다.",
             "기성 다시 계산 버튼"),
            ("step-settlement-xlsx", "기성정리표 XLSX 다운로드",
             "표 하단 <strong>기성 정리표 엑셀 다운로드</strong>로 XLSX를 저장합니다.",
             "엑셀 다운로드 버튼"),
            ("step-settlement-xlsx-preview", "엑셀 수식 확인",
             "다운로드 XLSX 상단 구간 — 버림콘 두께·기성 집계 <strong>수식</strong> (엑셀 수식 표시 모드)",
             "기성정리표 엑셀 — 수식 일부 확대"),
        ], new_page=True, anchor_id="guide-settlement")
        + guide_block("자재관리", [
            ("step-materials-btn", "「자재관리」",
             "상단 <strong>자재관리</strong>를 클릭합니다.",
             "자재관리 버튼"),
            ("08-materials", "동별 계획 · 매트릭스",
             "좌측 <strong>동별 계획</strong> 매트릭스에서 길이별 계획·입고·사용을 확인합니다.",
             "자재관리 — 동별·길이별 매트릭스"),
            ("step-materials-summary", "길이별 요약 (우측)",
             "우측 <strong>길이별 요약</strong> — 계획·반입·사용(PDAM)·파손·재고·미발주.",
             "길이별 요약 표"),
            ("step-materials-supplier", "업체별 발주 현황",
             "우측 <strong>업체별 말뚝·파일 발주 현황</strong> — 공장별 반입·발주 집계.",
             "업체별 발주·반입"),
            ("step-materials-receipts", "자재 입고",
             "좌측 <strong>입고·발주</strong> 표에서 일자별 반입 내역을 입력·관리합니다.",
             "입고·발주 입력"),
            ("step-materials-damage", "파손 · 반출",
             "우측 <strong>파손·반출</strong> — 파손 본수·길이를 기록합니다.",
             "파손·반출 표"),
            ("step-materials-cement", "시멘트 벌크",
             "우측 <strong>시멘트 벌크</strong> — PDAM 시공 기준 예상 시멘트·입고 누적·잔량.",
             "시멘트 벌크 — 발주·입고·잔량"),
        ], new_page=True, anchor_id="guide-materials")
        + guide_block("정산관리", [
            ("step-billing-btn", "「정산관리」",
             "상단 <strong>정산관리</strong>를 클릭합니다.",
             "정산관리 버튼"),
            ("08-billing-panel", "항타기 운용 현황",
             "기간·호기 수를 설정하고 일별 항타기 운용(가동·휴무·우천 등)을 표에서 입력·확인합니다.",
             "정산관리 — 일별 항타기 운용 표"),
        ], new_page=True, anchor_id="guide-billing")
        + guide_block("버전 · 엑셀 비교", [
            ("step-version-btn", "「버전 비교」",
             "상단 <strong>비교 → 버전 비교</strong>를 클릭합니다.",
             "버전 비교 버튼"),
            ("07-version-compare", "버전 선택 · 비교 적용",
             "이전/현재 버전을 각각 선택하고 <strong>비교 적용</strong>을 누르면 동별 요약·캔버스에 변경 말뚝이 표시됩니다.",
             "버전 비교 적용 결과 — 동별 요약·캔버스"),
            ("step-version-excel", "업체 엑셀 비교",
             "「업체 엑셀 비교」로 시공사 좌표 엑셀과 도면 버전을 대조합니다.",
             "엑셀 좌표 비교 모달"),
            ("step-version-excel-issues", "엑셀 비교 결과",
             "누락·좌표 불일치·건너뛴 행을 표로 확인하고 XLSX로 내보낼 수 있습니다.",
             "엑셀 비교 — 불일치 목록"),
        ], new_page=True, anchor_id="guide-version")
    )

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>파일 마스터 현장 매뉴얼</title>
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  :root {{
    --ink:#0f172a; --soft:#475569; --muted:#94a3b8;
    --brand:#0d9488; --brand-2:#ccfbf1; --line:#e2e8f0;
    --bg:#f8fafc; --hq:#eff6ff; --hq-line:#bfdbfe;
    --field:#ecfdf5; --field-line:#6ee7b7; --field-accent:#0f766e;
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{
    font-family:Pretendard,'Malgun Gothic',sans-serif;
    color:var(--ink); font-size:10pt; line-height:1.65;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }}
  @page {{ size:A4; margin:14mm 13mm 16mm; }}
  .cover {{
    break-after:page; min-height:255mm;
    background:linear-gradient(145deg,#0f172a,#115e59 55%,#14b8a6);
    color:#fff; padding:18mm 16mm; display:flex; flex-direction:column;
  }}
  .cover-kicker {{ display:inline-flex; gap:8px; font-size:9pt; background:rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.2); border-radius:999px; padding:6px 14px; width:fit-content; }}
  .cover h1 {{ font-size:30pt; font-weight:800; margin:10mm 0 4mm; }}
  .cover p {{ color:rgba(255,255,255,.88); font-size:11pt; max-width:130mm; word-break:keep-all; line-break:strict; }}
  .cover-url {{ margin-top:5mm; padding:10px 14px; background:rgba(255,255,255,.1); border-radius:10px; font-size:10pt; }}
  .cover-url strong {{ color:#99f6e4; }}
  .cover .figure {{ margin-top:6mm; border-radius:14px; overflow:hidden; }}
  .cover .figure img {{ width:100%; display:block; border:none; }}
  .cover-foot {{ margin-top:auto; font-size:9pt; color:rgba(255,255,255,.6); display:flex; justify-content:space-between; }}

  .toc-page {{ break-after:page; padding:4mm 0; }}
  .toc-page h2 {{ font-size:22pt; font-weight:800; margin-bottom:3mm; }}
  .toc-groups {{ display:flex; flex-direction:column; gap:14px; }}
  .toc-group {{
    break-inside:avoid; border-radius:14px; overflow:hidden;
    border:1px solid var(--line); margin-bottom:2mm;
  }}
  .toc-group-head {{
    padding:11px 16px; font-size:9pt; font-weight:800; letter-spacing:.05em;
  }}
  .toc-group-start {{ border-left:5px solid #0d9488; background:#f0fdfa; }}
  .toc-group-start .toc-group-head {{ background:#ccfbf1; color:#0f766e; }}
  .toc-group-start .toc-dot {{ background:#0d9488; }}
  .toc-group-prep {{ border-left:5px solid #2563eb; background:#eff6ff; }}
  .toc-group-prep .toc-group-head {{ background:#dbeafe; color:#1d4ed8; }}
  .toc-group-prep .toc-dot {{ background:#2563eb; }}
  .toc-group-train {{ border-left:5px solid #d97706; background:#fffbeb; }}
  .toc-group-train .toc-group-head {{ background:#fef3c7; color:#b45309; }}
  .toc-group-train .toc-dot {{ background:#d97706; }}
  .toc-group-field {{ border-left:5px solid #7c3aed; background:#f5f3ff; }}
  .toc-group-field .toc-group-head {{ background:#ede9fe; color:#6d28d9; }}
  .toc-group-field .toc-dot {{ background:#7c3aed; }}
  .toc-group-append {{ border-left:5px solid #64748b; background:#f8fafc; }}
  .toc-group-append .toc-group-head {{ background:#e2e8f0; color:#475569; }}
  .toc-group-append .toc-dot {{ background:#64748b; }}
  .toc-items {{ display:grid; grid-template-columns:1fr 1fr; gap:0; background:#fff; }}
  .toc-item {{
    display:flex; align-items:center; gap:8px; padding:11px 16px;
    text-decoration:none; color:var(--ink); font-size:9.5pt; font-weight:600;
    border-top:1px solid var(--line); break-inside:avoid;
  }}
  .toc-item:nth-child(odd) {{ border-right:1px solid var(--line); }}
  .toc-item-sub {{ padding-left:26px; font-size:9pt; font-weight:500; color:var(--soft); }}
  .toc-item-sub .toc-dot {{ width:5px; height:5px; opacity:.75; }}
  .toc-dot {{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }}

  .chapter {{ break-before:page; padding-top:2mm; }}
  .eyebrow {{ font-size:8pt; font-weight:700; color:var(--brand); letter-spacing:.1em; }}
  .chapter h2 {{ font-size:18pt; font-weight:800; margin:2mm 0 3mm; }}
  .lead {{ color:var(--soft); font-size:10.5pt; margin-bottom:5mm; word-break:keep-all; line-break:strict; }}
  p {{ color:var(--soft); margin-bottom:3mm; }}

  .data-table {{
    width:100%; border-collapse:separate; border-spacing:0; margin:4mm 0 5mm;
    font-size:8.5pt; break-inside:avoid; border:1px solid var(--line); border-radius:12px; overflow:hidden;
  }}
  .data-table caption {{
    caption-side:top; text-align:left; font-weight:800; font-size:9.5pt;
    color:var(--ink); padding:0 0 6px 2px;
  }}
  .data-table-hq caption {{ color:#1d4ed8; }}
  .data-table th {{
    background:#f1f5f9; color:var(--ink); padding:9px 11px;
    border-bottom:1px solid var(--line); text-align:left; font-size:8pt;
  }}
  .data-table-hq th {{ background:var(--hq); color:#1e40af; }}
  .data-table-revision caption {{ color:#6d28d9; }}
  .data-table-revision th {{ background:#f5f3ff; color:#5b21b6; }}
  .data-table-revision .rev-version {{ text-align:center; font-weight:700; white-space:nowrap; }}
  .data-table-revision .rev-date {{ text-align:center; white-space:nowrap; }}
  .data-table td {{
    padding:9px 11px; border-bottom:1px solid var(--line);
    vertical-align:top; color:var(--soft);
  }}
  .data-table tr:last-child td {{ border-bottom:none; }}
  .data-table td:first-child {{ font-weight:700; color:var(--ink); white-space:nowrap; width:14%; }}

  .split-workflow {{
    display:grid; grid-template-columns:1.25fr 0.75fr; gap:12px; margin:4mm 0;
  }}
  .card {{
    border-radius:14px; padding:14px 16px; break-inside:avoid;
  }}
  .card-field {{
    background:var(--field); border:2px solid var(--field-line);
    box-shadow:0 4px 14px rgba(15,118,110,.08);
  }}
  .card-field .card-label {{
    display:inline-block; font-size:7.5pt; font-weight:800; letter-spacing:.08em;
    color:#fff; background:var(--field-accent); border-radius:999px; padding:4px 10px; margin-bottom:8px;
  }}
  .card-field h3 {{ font-size:12pt; color:var(--field-accent); margin-bottom:8px; }}
  .card-field ul {{ padding-left:16px; font-size:9.5pt; color:#134e4a; }}
  .card-field li {{ margin-bottom:4px; font-weight:500; }}
  .card-hq {{
    background:var(--hq); border:1px solid var(--hq-line); opacity:.95;
  }}
  .card-hq .card-label {{
    display:inline-block; font-size:7.5pt; font-weight:700; letter-spacing:.06em;
    color:#1d4ed8; background:#dbeafe; border-radius:999px; padding:4px 10px; margin-bottom:8px;
  }}
  .card-hq h3 {{ font-size:10pt; color:#1e40af; margin-bottom:6px; }}
  .card-hq ul {{ padding-left:16px; font-size:8.5pt; color:var(--soft); }}
  .card-hq li {{ margin-bottom:3px; }}

  .train-table {{
    width:100%; border-collapse:separate; border-spacing:0; margin:4mm 0;
    font-size:8.5pt; break-inside:avoid; border:1px solid var(--line); border-radius:14px; overflow:hidden;
  }}
  .train-table th {{
    background:linear-gradient(180deg,#f8fafc,#f1f5f9); color:var(--ink);
    padding:10px 12px; border-bottom:2px solid var(--line); text-align:left; font-size:8pt;
  }}
  .train-table td {{ padding:12px; border-bottom:1px solid var(--line); vertical-align:top; color:var(--soft); }}
  .train-table tr:last-child td {{ border-bottom:none; }}
  .train-badge {{
    display:inline-block; font-weight:800; font-size:8pt; padding:5px 10px; border-radius:8px; white-space:nowrap;
  }}
  .badge-1 {{ background:#dbeafe; color:#1d4ed8; }}
  .badge-2 {{ background:#ccfbf1; color:#0f766e; }}
  .badge-opt {{ background:#fef3c7; color:#b45309; }}
  .train-target {{ font-weight:700; color:var(--ink); }}
  .train-timing {{ color:var(--muted); font-size:8pt; white-space:nowrap; }}
  .train-list {{ padding-left:14px; margin:0; }}
  .train-list li {{ margin-bottom:3px; }}

  .figure {{ margin:4mm 0; break-inside:avoid; page-break-inside:avoid; }}
  .figure img.shot {{
    width:100%; min-height:40mm; max-height:105mm; object-fit:contain; object-position:top center;
    border:1px solid var(--line); border-radius:10px; background:#fff; display:block;
  }}
  .figure img.shot.excel-preview {{ max-height:55mm; min-height:28mm; }}
  .figure img.shot.small {{ max-height:88mm; }}
  .figure img.shot.hero {{ max-height:95mm; }}
  .figure img.coord-diagram {{ max-height:68mm; min-height:44mm; }}
  .chapter-coord {{ break-inside:avoid; page-break-inside:avoid; }}
  .chapter-coord h2 {{ font-size:16pt; margin-bottom:2mm; }}
  .chapter-coord .lead {{ font-size:9.5pt; margin-bottom:2mm; line-height:1.45; }}
  .chapter-coord .figure {{ margin:2mm 0; }}
  .chapter-coord .figure img.coord-diagram {{ max-height:46mm; min-height:0; }}
  .chapter-coord figcaption {{ margin-top:1.5mm; padding:4px 6px; font-size:7pt; }}
  .chapter-coord .coord-tables {{
    display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-top:2mm; break-inside:avoid;
  }}
  .chapter-coord .data-table-coord {{ margin:0; font-size:7.6pt; }}
  .chapter-coord .data-table-coord caption {{ padding:6px 8px; font-size:8pt; }}
  .chapter-coord .data-table-coord th {{ padding:5px 7px; font-size:7.5pt; }}
  .chapter-coord .data-table-coord td {{ padding:5px 7px; }}
  .chapter-coord .foot {{ margin-top:3mm; padding-top:2mm; }}
  .data-table-coord {{ margin-top:3mm; font-size:8.3pt; }}
  .data-table-coord caption {{ color:#0f766e; font-weight:800; }}
  .data-table-coord th {{ background:#f0fdfa; color:#0f766e; }}
  .data-table-coord-rules {{ margin-top:4mm; }}
  .data-table-coord-rules caption {{ color:#1d4ed8; }}
  .data-table-coord-rules th {{ background:#eff6ff; color:#1d4ed8; }}
  .data-table-coord .coord-no {{
    width:8mm; text-align:center; font-weight:800; color:var(--brand); white-space:nowrap;
  }}
  .data-table-coord .coord-item {{ width:28mm; font-weight:700; color:var(--ink); white-space:nowrap; }}
  .data-table-coord td:last-child {{ line-height:1.5; word-break:keep-all; }}
  figcaption {{
    margin-top:3mm; padding:6px 8px; text-align:left; font-size:8pt; color:var(--soft);
    background:var(--bg); border-radius:8px; border-left:3px solid var(--brand); line-height:1.5;
  }}
  figcaption strong {{ display:block; color:var(--ink); font-size:8.5pt; margin-bottom:2px; }}
  figcaption span {{ color:var(--muted); font-size:7.5pt; }}
  .shot-missing {{
    padding:16px; border:2px dashed #fca5a5; border-radius:10px; background:#fef2f2;
    text-align:center; color:#991b1b; font-size:8.5pt; margin:3mm 0;
  }}
  .shot-missing-icon {{
    display:inline-block; width:24px; height:24px; line-height:24px; border-radius:50%;
    background:#ef4444; color:#fff; font-weight:800; margin-bottom:4px;
  }}
  .mobile-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:4mm 0; }}
  .mobile-tip {{ font-size:9pt; color:var(--soft); }}
  .mobile-tip li {{ margin-bottom:3px; }}

  .guide-block {{ margin:5mm 0; }}
  .guide-block-page {{ break-before:page; page-break-before:always; padding-top:2mm; }}
  .guide-block-head {{ break-inside:avoid; page-break-inside:avoid; }}
  .guide-title {{ font-size:11pt; font-weight:800; margin-bottom:3mm; padding-bottom:2mm; border-bottom:2px solid var(--brand); }}
  .guide-step {{ margin-bottom:4mm; break-inside:avoid; }}
  .guide-step-head {{ display:flex; align-items:center; gap:8px; margin-bottom:2mm; }}
  .guide-num {{ width:22px; height:22px; border-radius:50%; background:var(--brand-2); color:#0f766e;
    font-weight:800; font-size:8pt; display:flex; align-items:center; justify-content:center; flex-shrink:0; }}
  .guide-step p {{ font-size:9pt; margin-bottom:2mm; }}

  .note {{
    background:#f0fdf4; border:1px solid #bbf7d0; border-left:4px solid var(--brand);
    border-radius:10px; padding:10px 12px; margin:4mm 0; font-size:9pt; color:#065f46; break-inside:avoid;
  }}
  .foot {{ margin-top:6mm; padding-top:3mm; border-top:1px solid var(--line);
    font-size:8pt; color:var(--muted); display:flex; justify-content:space-between; }}
  .card-plain {{ background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }}
  .card-plain h3 {{ font-size:10pt; margin-bottom:4px; }}
</style>
</head>
<body>

<section class="cover">
  <div class="cover-kicker">● 현장 사용자 매뉴얼</div>
  <h1>파일 마스터</h1>
  <p>본사(건축BIM팀)에서 세팅한 작업을 불러와 시공현황·기성·자재·검토를 수행하는<br /><strong>현장 담당자용</strong> 가이드입니다.</p>
  <div class="cover-url"><strong>접속</strong> {ACCESS_URL}</div>
  {shot("00-main-clean", "좌표 확인 메인 화면", hero=True, caption="작업 불러온 후 — 말뚝 좌표·동별 구분 확인")}
  <div class="cover-foot"><span>건축BIM팀 · 현장용</span><span>{today}</span></div>
</section>

<section class="toc-page">
  <h2>목차</h2>
  <p class="lead">현장에서는 「불러오기 → PDAM 동기화 → 시공현황·기성」 순서를 중심으로 보시면 됩니다.</p>
  <div class="toc-groups">{toc_html}</div>
</section>

<article class="chapter" id="intro">
  <div class="eyebrow">01 · 시작</div>
  <h2>접속 · 프로그램 개요</h2>
  <p class="lead">별도 설치 없이 브라우저로 접속합니다. 도면 업로드·좌표 세팅은 <strong>주로 본사(건축BIM팀)</strong>에서 진행하며, 도면 변경이 급할 때는<br /><strong>현장에서 직접 업로드</strong>할 수도 있습니다.</p>
  <div class="note"><strong>현장 역할</strong> — 본사가 저장해 둔 작업을 불러와 PDAM 연동·시공 확인·기성·검토를 수행합니다. 도면 변경 시 본사 협의 또는 현장 업로드 후 버전 저장·불러오기를 진행합니다.</div>
  {shot("00-main-clean", "작업 불러온 후 메인 화면", caption="캔버스에서 좌표·동·필터 확인")}
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>01</span></div>
</article>

<article class="chapter" id="mobile">
  <div class="eyebrow">01 · 시작</div>
  <h2>모바일에서 좌표 확인</h2>
  <p class="lead">스마트폰 브라우저에서도 동일 주소로 접속해 본사 세팅 작업을 불러오면 <strong>현장에서 좌표 확인</strong>이 가능합니다.</p>
  <div class="note"><strong>접속 주소</strong> — PC와 동일: {ACCESS_URL}</div>
  <ul class="mobile-tip">
    <li>Chrome · Safari 등 모바일 브라우저에서 위 주소 입력</li>
    <li>상단 <strong>불러오기</strong> → 프로젝트 선택 → 최신 버전 불러오기</li>
    <li>두 손가락 핀치로 확대/축소, 드래그로 화면 이동 — 말뚝 번호·좌표 확인</li>
    <li>캔버스에서 <strong>말뚝을 누르면</strong> 좌표·번호가 표시됩니다</li>
    <li>PDAM 동기화·기성 등 상세 작업은 PC 사용을 권장합니다</li>
  </ul>
  <div class="mobile-grid">
    {shot("mobile-access", "모바일 접속", small=True, caption="스마트폰 브라우저 접속 화면")}
    {shot("mobile-loaded", "모바일 캔버스", small=True, caption="불러온 후 캔버스에서 말뚝 배치 확인")}
    {shot("mobile-coord-tooltip", "모바일 좌표 툴팁", small=True, caption="캔버스에서 말뚝을 누르면 좌표·번호 확인")}
  </div>
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>01-2</span></div>
</article>

<article class="chapter" id="materials">
  <div class="eyebrow">02 · 준비</div>
  <h2>필요 자료 · 도면 전달</h2>
  <p class="lead">자료 수집·파일 마스터 등록은 <strong>본사(건축BIM팀)</strong>에서 진행합니다. 현장에서는 도면·자료를 수령할 때 아래 표 기준으로 전달해 주세요.</p>
  {delivery_table}
  {hq_table}
  <div class="note">PDAM 시공 기록은 we8104.com과 <strong>자동 연동</strong>됩니다. 별도 기록지 엑셀을 현장에서 전달할 필요는 없습니다.</div>
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>02</span></div>
</article>

<article class="chapter chapter-coord" id="coord-drawing-guide">
  <div class="eyebrow">02 · 준비</div>
  <h2>좌표도 (참고 예시)</h2>
  <p class="lead">본사(건축BIM팀) 전달·등록 좌표도(CAD)는 아래 예시·표 기준을 따르면 분석·매칭이 원활합니다.</p>
  {coord_diagram_html}
  {coord_rules_html}
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>02-2</span></div>
</article>

<article class="chapter" id="workflow">
  <div class="eyebrow">03 · 흐름</div>
  <h2>본사 세팅 vs 현장 사용</h2>
  <p class="lead">도면 변경은 본사 세팅이 일반적이나, 필요 시 현장에서도 DXF/DWG를 업로드할 수 있습니다.</p>
  <div class="split-workflow">
    <div class="card card-field">
      <span class="card-label">현장 담당 · 매일</span>
      <h3>현장 — 일상 사용</h3>
      <ul>{field_list}</ul>
    </div>
    <div class="card card-hq">
      <span class="card-label">참고</span>
      <h3>본사(건축BIM팀) — 사전 세팅</h3>
      <ul>{hq_setup}</ul>
    </div>
  </div>
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>03</span></div>
</article>

<article class="chapter" id="training">
  <div class="eyebrow">04 · 교육</div>
  <h2>1 · 2 · 3차 교육</h2>
  <p class="lead">파일공사 일정에 맞춰 단계별 교육을 진행합니다.</p>
  {training_html}
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>04</span></div>
</article>

<article class="chapter" id="field-guide">
  <div class="eyebrow">05 · 현장</div>
  <h2>화면별 사용법</h2>
  {field_guides}
  <div class="foot"><span>파일 마스터 현장 매뉴얼</span><span>05</span></div>
</article>

<article class="chapter" id="appendix">
  <div class="eyebrow">06 · 부록</div>
  <h2>접속 · 면책</h2>
  <div class="card-plain"><h3>파일 마스터</h3><p>{ACCESS_URL}</p></div>
  <div class="note" style="margin-top:5mm;background:#fffbeb;border-color:#fde68a;color:#92400e">
    <strong>면책</strong> 시공·측량·설계 판단의 최종 책임은 사용자 및 프로젝트 규정에 따릅니다.
  </div>
  <div class="foot"><span>파일 마스터 · {today}</span><span>06</span></div>
</article>

<article class="chapter" id="revision-history">
  <div class="eyebrow">07 · 부록</div>
  <h2>수정 이력</h2>
  <p class="lead">매뉴얼 변경 사항을 버전별로 기록·관리합니다. 수정 시 아래 표에 행을 추가합니다.</p>
  {revision_html}
  <div class="foot"><span>파일 마스터 · {today}</span><span>07</span></div>
</article>

</body></html>"""


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(html_path.as_uri(), wait_until="networkidle", timeout=120_000)
        page.pdf(path=str(pdf_path), format="A4", print_background=True,
                 margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        browser.close()


def main() -> Path:
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    ensure_screenshots()
    ensure_coord_diagram()
    html = build_html()
    HTML_OUT.write_text(html, encoding="utf-8")
    html_to_pdf(HTML_OUT, PDF_OUT)
    print(f"HTML: {HTML_OUT}")
    print(f"PDF:  {PDF_OUT}")
    return PDF_OUT


if __name__ == "__main__":
    main()
