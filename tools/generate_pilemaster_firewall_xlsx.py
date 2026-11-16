"""pilemaster 아웃바운드 허가 목록 xlsx 생성 (일회성 스크립트)."""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pilemaster_outbound_firewall_request.xlsx"

HEADERS = ("순번", "구분", "FQDN", "포트", "프로토콜", "용도", "비고")

ROWS: list[tuple] = [
    (1, "운영 중 지속", "aissvp01.daewooenc.com", 443, "TCP", "BRDS / PRUGio 연동", ""),
    (2, "운영 중 지속", "baronet.daewooenc.com", 443, "TCP", "바로넷 SSO·로그인", ""),
    (3, "운영 중 지속", "platform-api.meissa.ai", 443, "TCP", "Meissa REST API", ""),
    (4, "운영 중 지속", "cloud.meissa.ai", 443, "TCP", "Meissa 웹 로그인·연동", ""),
    (5, "운영 중 지속", "cs.carta.is", 443, "TCP", "Carta orthophoto / DSM", ""),
    (6, "운영 중 지속", "api.vworld.kr", 443, "TCP", "브이월드 WFS·주소 API", ""),
    (7, "운영 중 지속", "we8104.com", 443, "TCP", "시공 보고서 기본 소스", "다른 URL 사용 시 해당 호스트 추가 요청"),
    (8, "운영 중 지속", "cdn.jsdelivr.net", 443, "TCP", "프론트 CDN (xlsx·exceljs·proj4·three.js)", "사용자 PC 브라우저만 사용 시 서버 생략 가능"),
    (9, "운영 중 지속", "www.googletagmanager.com", 443, "TCP", "Google Analytics (gtag)", "위와 동일"),
    (10, "운영 중 지속", "www.google-analytics.com", 443, "TCP", "GA 수집", "위와 동일"),
    (11, "운영 중 지속", "www.gov.kr", 443, "TCP", "정부24 안내 링크", "위와 동일"),
    (12, "운영 중 지속", "region1.v2.argotunnel.com", 7844, "TCP·UDP", "Cloudflare Tunnel", "와일드카드 불가 정책에 맞춘 고정 호스트(공식 문서)"),
    (13, "운영 중 지속", "region2.v2.argotunnel.com", 7844, "TCP·UDP", "Cloudflare Tunnel", "443만으로는 터널 불가 · 7844 필수"),
    (14, "운영 중 지속", "cftunnel.com", 7844, "TCP·UDP", "Tunnel (SNI 엄격 방화벽 시)", "필요 시 IT 확인"),
    (15, "운영 중 지속", "h2.cftunnel.com", 7844, "TCP", "Tunnel (http2)", "필요 시"),
    (16, "운영 중 지속", "quic.cftunnel.com", 7844, "UDP", "Tunnel (QUIC)", "필요 시"),
    (17, "설치·업데이트 시", "pypi.org", 443, "TCP", "pip 메타데이터", ""),
    (18, "설치·업데이트 시", "files.pythonhosted.org", 443, "TCP", "PyPI wheel·소스 다운로드", ""),
    (19, "설치·업데이트 시", "playwright.azureedge.net", 443, "TCP", "Playwright Chromium 바이너리", "차단 로그에 다른 호스트 있으면 추가 요청"),
    (20, "설치·업데이트 시", "cdn.playwright.dev", 443, "TCP", "Playwright Chromium (대안 호스트)", ""),
    (21, "설치·업데이트 시", "storage.googleapis.com", 443, "TCP", "바이너리 등(경로별)", "필요 시"),
    (22, "설치·업데이트 시", "github.com", 443, "TCP", "git clone · pip git · cloudflared 업데이트", "재설치·업데이트 시마다 필요"),
    (23, "설치·업데이트 시", "raw.githubusercontent.com", 443, "TCP", "GitHub raw", ""),
    (24, "설치·업데이트 시", "codeload.github.com", 443, "TCP", "GitHub 아카이브(zip/tarball)", ""),
    (25, "설치·업데이트 시", "objects.githubusercontent.com", 443, "TCP", "GitHub 릴리즈 자산", ""),
    (26, "설치·업데이트 시", "registry.npmjs.org", 443, "TCP", "npm 패키지", "Node.js 사용 시"),
    (27, "설치·업데이트 시", "api.cloudflare.com", 443, "TCP", "cloudflared 업데이트 확인 등", "선택 · 로그 오류 시"),
    (28, "설치·업데이트 시", "update.argotunnel.com", 443, "TCP", "cloudflared 업데이트 확인", "선택"),
]

FILL_HEADER = PatternFill("solid", fgColor="1F4E79")
FILL_OPS = PatternFill("solid", fgColor="D6EAF8")
FILL_INSTALL = PatternFill("solid", fgColor="E2EFDA")
FONT_HEADER = Font(bold=True, color="FFFFFF", size=11)
FONT_BODY = Font(size=10)
FONT_TITLE = Font(bold=True, size=14, color="1F4E79")
THIN = Side(style="thin", color="B4B4B4")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
ALIGN_WRAP = Alignment(wrap_text=True, vertical="top")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def main() -> None:
    wb = Workbook()
    # 요약 시트
    ws0 = wb.active
    ws0.title = "요약"
    ws0["A1"] = "pilemaster 아웃바운드 허가 요청 요약"
    ws0["A1"].font = FONT_TITLE
    ws0.merge_cells("A1:G1")
    ws0["A3"] = "대상 서버"
    ws0["B3"] = "pilemaster (예: 172.20.0.76)"
    ws0["A4"] = "구분"
    ws0["B4"] = "설명"
    ws0["A5"] = "운영 중 지속"
    ws0["B5"] = "Tunnel 7844 포함 · 업무 API · (동일 서버 브라우저 사용 시) CDN·GA"
    ws0["A6"] = "설치·업데이트 시"
    ws0["B6"] = "pip · Playwright Chromium · npm · GitHub · cloudflared 업데이트 확인(선택)"
    ws0["A8"] = "참고"
    ws0["B8"] = "DB는 로컬 SQLite(data/) 복사 이전 · *.cloudflare.com 와일드카드 불가 시 본 문서의 argotunnel.com 호스트 사용"
    ws0["A10"] = "『허가 URL 목록』시트 색"
    ws0["B10"] = "연한 파랑 = 운영 중 지속 · 연한 연두 = 설치·업데이트 시"
    ws0["A10"].font = Font(bold=True)
    ws0["B10"].alignment = ALIGN_WRAP
    for r in range(3, 9):
        ws0[f"A{r}"].font = Font(bold=True)
        ws0[f"A{r}"].alignment = Alignment(vertical="top")
        ws0[f"B{r}"].alignment = ALIGN_WRAP
    ws0.column_dimensions["A"].width = 22
    ws0.column_dimensions["B"].width = 72

    ws = wb.create_sheet("허가 URL 목록", 1)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{len(ROWS) + 1}"

    for col, h in enumerate(HEADERS, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.font = FONT_HEADER
        c.fill = FILL_HEADER
        c.alignment = ALIGN_CENTER
        c.border = BORDER

    for ri, row in enumerate(ROWS, start=2):
        cat = row[1]
        fill = FILL_OPS if cat == "운영 중 지속" else FILL_INSTALL
        for ci, val in enumerate(row, start=1):
            c = ws.cell(row=ri, column=ci, value=val)
            c.font = FONT_BODY
            c.fill = fill
            c.border = BORDER
            if ci in (6, 7):
                c.alignment = ALIGN_WRAP
            elif ci == 1:
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c.alignment = Alignment(vertical="center", wrap_text=ci >= 6)

    widths = (6, 18, 38, 8, 12, 36, 42)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 22

    wb.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
