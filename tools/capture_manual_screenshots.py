#!/usr/bin/env python3
"""매뉴얼용 화면 캡처 — 버튼 하이라이트 + 단계별 스크린샷."""

from __future__ import annotations

import io
import os
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright, TimeoutError as PWTimeout

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "manual" / "assets" / "screenshots"
ASSETS = OUT.parent
OUT.mkdir(parents=True, exist_ok=True)

PILEXY = os.environ.get("PILEXY_MANUAL_URL", "https://pilexy.yeobaekstudio.com/")
if not PILEXY.endswith("/"):
    PILEXY += "/"
PDAM = "https://we8104.com/login"
VIEWPORT = {"width": 1440, "height": 900}
PROJECT_SEARCH = "청주"

COORD_SAMPLE_XLSX = ASSETS / "coordinate_compare_sample.xlsx"


def clear_highlights(page: Page) -> None:
    page.evaluate(
        """() => {
        document.querySelectorAll('[data-manual-hl]').forEach(el => {
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.style.boxShadow = '';
          el.removeAttribute('data-manual-hl');
        });
        const badge = document.getElementById('manual-step-badge');
        if (badge) badge.remove();
      }"""
    )


def highlight(page: Page, selector: str, label: str = "") -> bool:
    clear_highlights(page)
    ok = page.evaluate(
        """({ sel, label }) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.setAttribute('data-manual-hl', '1');
        el.style.outline = '3px solid #f59e0b';
        el.style.outlineOffset = '3px';
        el.style.boxShadow = '0 0 0 6px rgba(245,158,11,.25)';
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (label) {
          let b = document.getElementById('manual-step-badge');
          if (!b) {
            b = document.createElement('div');
            b.id = 'manual-step-badge';
            b.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);'
              + 'z-index:99999;background:#0f172a;color:#fff;padding:8px 16px;border-radius:999px;'
              + 'font:600 13px Pretendard,Malgun Gothic,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.3);';
            document.body.appendChild(b);
          }
          b.textContent = label;
        }
        return true;
      }""",
        {"sel": selector, "label": label},
    )
    time.sleep(0.4)
    return bool(ok)


def shot(page: Page, name: str, selector: str | None = None, label: str = "", *, hide_tooltip: bool = True) -> Path:
    if hide_tooltip:
        hide_canvas_tooltip(page)
    if selector:
        highlight(page, selector, label)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  OK {path.name}")
    clear_highlights(page)
    return path


def shot_plain(page: Page, name: str, *, hide_tooltip: bool = True) -> Path:
    if hide_tooltip:
        hide_canvas_tooltip(page)
    clear_highlights(page)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  OK {path.name} (plain)")
    return path


def close_retaining_wall(page: Page) -> None:
    try:
        page.evaluate(
            """() => {
            const el = document.getElementById('retaining-wall-details');
            if (el) el.open = false;
          }"""
        )
    except Exception:
        pass
    time.sleep(0.25)


def hide_canvas_tooltip(page: Page) -> None:
    page.evaluate(
        """() => {
        const t = document.getElementById('canvas-tooltip');
        if (t) {
          t.classList.add('hidden');
          t.style.display = 'none';
          t.textContent = '';
        }
      }"""
    )
    page.mouse.move(8, 8)
    time.sleep(0.25)


def prepare_canvas_for_shot(page: Page) -> None:
    """캔버스 툴팁·흙막이만 정리 (시공 패널은 유지)."""
    hide_canvas_tooltip(page)
    close_retaining_wall(page)


def close_overlay_panels(page: Page) -> None:
    """자재·버전·정산 등 오버레이만 닫기 (시공 드로어 유지)."""
    close_retaining_wall(page)
    for sel in ("#materials-panel-close", "#version-compare-close",
                "#version-compare-excel-modal-close", "#billing-panel-close"):
        try:
            page.locator(sel).click(timeout=1200, force=True)
        except Exception:
            pass
    page.keyboard.press("Escape")
    time.sleep(0.4)
    hide_canvas_tooltip(page)


def close_all_panels(page: Page) -> None:
    close_overlay_panels(page)
    try:
        page.locator("#construction-drawer-close").click(timeout=1500, force=True)
    except Exception:
        pass
    page.keyboard.press("Escape")
    time.sleep(0.4)
    hide_canvas_tooltip(page)


def ensure_clean_canvas(page: Page) -> None:
    close_all_panels(page)


def load_saved_work(page: Page, project: str = PROJECT_SEARCH, *, panel_open: bool = False) -> bool:
    if not panel_open:
        page.locator("#load-work-btn").click()
        page.wait_for_selector("#load-work-list-panel.open", timeout=15_000)
        time.sleep(1)
    page.locator("#load-work-project-search").fill(project)
    time.sleep(0.6)
    if page.locator(".load-work-project-item").count() == 0:
        print(f"  ! 프로젝트 없음: {project}")
        return False
    page.locator(".load-work-project-item").first.click()
    time.sleep(0.8)
    if page.locator(".load-work-load-btn").count() == 0:
        print("  ! 작업 버전 없음")
        return False
    page.locator(".load-work-load-btn").first.click()
    try:
        page.wait_for_function(
            "() => !document.getElementById('construction-status-btn')?.disabled",
            timeout=180_000,
        )
    except PWTimeout:
        page.wait_for_timeout(8000)
    page.keyboard.press("Escape")
    time.sleep(1.5)
    return True


def ensure_coordinate_sample_xlsx() -> Path:
    if COORD_SAMPLE_XLSX.exists():
        return COORD_SAMPLE_XLSX
    try:
        import pandas as pd
    except ImportError:
        return COORD_SAMPLE_XLSX
    rows = [
        ["동", "번호", "X", "Y"],
        ["101", 1, 242638.0, 449340.0],
        ["101", 2, 242640.5, 449342.0],
        ["102", 3, 242650.0, 449350.0],
    ]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame(rows).to_excel(writer, sheet_name="좌표", header=False, index=False)
    COORD_SAMPLE_XLSX.write_bytes(buffer.getvalue())
    print(f"  OK {COORD_SAMPLE_XLSX.name} (generated)")
    return COORD_SAMPLE_XLSX


def screenshot_settlement_xlsx(xlsx_path: Path, png_out: Path) -> bool:
    """Excel 수식 표시 — 상단 일부만 캡처."""
    try:
        import win32com.client  # type: ignore
        from PIL import ImageGrab  # type: ignore
    except ImportError:
        print("  ! Excel screenshot: pywin32/Pillow 필요")
        return False
    if not xlsx_path.exists():
        return False
    excel = win32com.client.gencache.EnsureDispatch("Excel.Application")
    excel.Visible = True
    excel.DisplayAlerts = False
    wb = None
    try:
        wb = excel.Workbooks.Open(str(xlsx_path.resolve()))
        ws = wb.Worksheets(1)
        ws.Activate()
        excel.ActiveWindow.DisplayFormulas = True
        excel.ActiveWindow.Zoom = 115
        rng = ws.Range("A1:H14")
        rng.Select()
        rng.CopyPicture(Appearance=1, Format=2)
        time.sleep(0.9)
        img = ImageGrab.grabclipboard()
        if img is None:
            print("  ! Excel screenshot: clipboard empty")
            return False
        w, h = img.size
        max_w, max_h = 1100, 520
        scale = min(max_w / w, max_h / h, 1.0)
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)))
        png_out.parent.mkdir(parents=True, exist_ok=True)
        img.save(str(png_out))
        print(f"  OK {png_out.name} (excel crop)")
        return True
    finally:
        if wb is not None:
            wb.Close(False)
        excel.Quit()


def capture_settlement_xlsx(page: Page) -> None:
    prepare_canvas_for_shot(page)
    shot(page, "step-settlement-xlsx", "#construction-settlement-records-xlsx-btn", "")
    xlsx_path = ASSETS / "settlement_sample.xlsx"
    try:
        with page.expect_download(timeout=30_000) as dl_info:
            page.locator("#construction-settlement-records-xlsx-btn").click(timeout=10_000)
        download = dl_info.value
        download.save_as(str(xlsx_path))
        print("  OK settlement_sample.xlsx")
        if not screenshot_settlement_xlsx(xlsx_path, OUT / "step-settlement-xlsx-preview.png"):
            shot(page, "step-settlement-xlsx-preview", "#construction-settlement-records-table", "")
    except Exception as e:
        print(f"  ! settlement xlsx: {type(e).__name__}")
        if xlsx_path.exists() and not (OUT / "step-settlement-xlsx-preview.png").exists():
            screenshot_settlement_xlsx(xlsx_path, OUT / "step-settlement-xlsx-preview.png")
        elif not (OUT / "step-settlement-xlsx-preview.png").exists():
            shot(page, "step-settlement-xlsx-preview", "#construction-settlement-records-table", "")


def close_construction_drawer(page: Page) -> None:
    try:
        page.locator("#construction-drawer-close").click(timeout=2000, force=True)
    except Exception:
        pass
    page.keyboard.press("Escape")
    time.sleep(0.5)


def capture_retaining_wall(page: Page) -> None:
    ensure_clean_canvas(page)
    page.locator(".canvas-wrapper").scroll_into_view_if_needed()
    time.sleep(0.4)
    close_retaining_wall(page)
    shot(page, "step-retaining-btn", ".canvas-wrapper .retaining-wall-summary", "")
    page.locator("#retaining-wall-details summary").click(force=True)
    time.sleep(0.7)
    shot(page, "step-retaining-open", "#retaining-wall-details[open]", "")
    try:
        page.locator("#retaining-wall-select-btn").click(timeout=5000)
        time.sleep(0.4)
        canvas = page.locator("#circle-canvas").first
        box = canvas.bounding_box()
        if box:
            page.mouse.click(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.55)
            time.sleep(0.5)
        page.locator("#retaining-wall-compute-btn").click(timeout=5000)
        time.sleep(1.2)
    except Exception:
        pass
    shot(page, "09-retaining-wall", "#retaining-wall-details[open]", "")
    close_retaining_wall(page)


def capture_parcel_review(page: Page) -> None:
    ensure_clean_canvas(page)
    shot(page, "step-parcel-btn", "#construction-parcel-review-btn", "")
    page.locator("#construction-parcel-review-btn").click(timeout=10_000)
    time.sleep(2)
    try:
        viewer_cb = page.locator("#construction-parcel-main-canvas-viewer")
        if viewer_cb.count():
            viewer_cb.check(force=True)
            time.sleep(1.5)
    except Exception:
        pass
    prepare_canvas_for_shot(page)
    shot(page, "06-parcel-review", "#construction-drawer", "")
    close_construction_drawer(page)


def open_construction_drawer(page: Page, tab: str = "status") -> None:
    """시공 드로어 열기 + 탭 선택 (status | settings | settlement)."""
    try:
        drawer = page.locator("#construction-drawer.open")
        if drawer.count() == 0:
            page.locator("#construction-status-btn").click(timeout=10_000)
            page.wait_for_selector("#construction-drawer.open", timeout=15_000)
            time.sleep(1.5)
        page.locator(f'.construction-tab[data-tab="{tab}"]').click(timeout=5_000)
        time.sleep(1.2)
    except Exception as e:
        print(f"  ! open_construction_drawer({tab}): {type(e).__name__}")


def capture_construction_status(page: Page) -> None:
    close_overlay_panels(page)
    open_construction_drawer(page, "status")
    try:
        page.locator("#construction-apply-btn").click(timeout=8_000)
        time.sleep(2)
    except Exception:
        pass
    prepare_canvas_for_shot(page)
    shot(page, "03-construction-status", "#construction-chart-by-date", "")
    shot(page, "step-status-apply", "#construction-apply-btn", "")
    shot(page, "step-playback", ".construction-playback-panel", "")


def capture_construction_pdam(page: Page) -> None:
    close_overlay_panels(page)
    open_construction_drawer(page, "settings")
    prepare_canvas_for_shot(page)
    shot(page, "step-pdam-tab", '.construction-tab[data-tab="settings"]', "")
    shot(page, "04-pdam-settings", "#construction-sync-grid", "")
    shot(page, "step-pdam-sync", "#construction-sync-btn", "")


def capture_construction_settlement(page: Page) -> None:
    open_construction_drawer(page, "settlement")
    prepare_canvas_for_shot(page)
    shot(page, "step-settlement-btn", '.construction-tab[data-tab="settlement"]', "")
    try:
        page.locator("#construction-settlement-apply-btn").click(timeout=10_000)
        time.sleep(2.5)
    except Exception:
        pass
    shot(page, "05-settlement", "#construction-settlement-records-table", "")
    shot(page, "step-settlement-calc", "#construction-settlement-apply-btn", "")
    capture_settlement_xlsx(page)


def capture_version_compare(page: Page) -> None:
    close_all_panels(page)
    shot(page, "step-version-btn", "#version-compare-btn", "")
    page.locator("#version-compare-btn").click(timeout=5_000)
    time.sleep(1.5)
    try:
        page.wait_for_selector("#version-compare-panel.open", timeout=10_000)
    except PWTimeout:
        pass
    try:
        page.wait_for_function(
            """() => {
            const o = document.getElementById('version-compare-old');
            const n = document.getElementById('version-compare-new');
            return o && n && o.options.length >= 2 && n.options.length >= 1;
          }""",
            timeout=30_000,
        )
        old_n = page.locator("#version-compare-old option").count()
        new_n = page.locator("#version-compare-new option").count()
        page.locator("#version-compare-old").select_option(
            index=min(1, max(0, old_n - 1))
        )
        page.locator("#version-compare-new").select_option(index=0 if new_n > 0 else 0)
        page.locator("#version-compare-apply").click(timeout=20_000)
        page.wait_for_function(
            """() => {
            const body = document.getElementById('version-compare-summary-body');
            return body && body.querySelectorAll('tr').length > 0;
          }""",
            timeout=30_000,
        )
        time.sleep(1.5)
    except Exception as e:
        print(f"  ! version compare apply: {type(e).__name__}")
    hide_canvas_tooltip(page)
    shot(page, "07-version-compare", "#version-compare-panel", "")

    sample = ensure_coordinate_sample_xlsx()
    try:
        page.locator("#version-compare-excel-toggle").click(timeout=5_000)
        time.sleep(0.8)
        page.locator("#version-compare-excel-file").set_input_files(str(sample.resolve()))
        page.locator("#version-compare-excel-inspect").click(timeout=10_000)
        time.sleep(2.5)
        page.locator("#version-compare-excel-apply").click(timeout=30_000)
        time.sleep(3)
        shot(page, "step-version-excel", "#version-compare-excel-modal.open", "")
        shot(page, "step-version-excel-issues", "#version-compare-excel-issues", "")
    except Exception as e:
        print(f"  ! version excel: {type(e).__name__}")

    page.locator("#version-compare-excel-modal-close").click(timeout=3_000, force=True)
    time.sleep(0.4)
    page.locator("#version-compare-close").click(timeout=3_000, force=True)
    time.sleep(0.5)


def capture_billing(page: Page) -> None:
    close_all_panels(page)
    shot(page, "step-billing-btn", "#header-billing-btn", "")
    page.locator("#header-billing-btn").click(timeout=10_000)
    time.sleep(2)
    try:
        page.locator("#construction-billing-apply-range").click(timeout=5_000)
        time.sleep(1.5)
    except Exception:
        pass
    hide_canvas_tooltip(page)
    shot(page, "08-billing-panel", "#construction-billing-body", "")
    try:
        with page.expect_download(timeout=30_000) as dl_info:
            page.locator("#construction-billing-xlsx-btn").click(timeout=5_000)
        dl_info.value.save_as(str(ASSETS / "billing_sample.xlsx"))
        print("  OK billing_sample.xlsx")
    except Exception:
        pass
    page.locator("#billing-panel-close").click(timeout=3_000, force=True)
    time.sleep(0.5)


def capture_materials(page: Page) -> None:
    ensure_clean_canvas(page)
    shot(page, "step-materials-btn", "#header-materials-btn", "")
    page.locator("#header-materials-btn").click(timeout=10_000)
    time.sleep(2.5)
    shot(page, "08-materials", "#materials-panel", "")
    shot(page, "step-materials-matrix", "#materials-table-matrix", "")

    aside = page.locator(".materials-grid__aside")
    if aside.count():
        page.evaluate(
            """() => {
            const a = document.querySelector('.materials-grid__aside');
            if (a) a.scrollTop = 0;
          }"""
        )
        time.sleep(0.3)
        shot(page, "step-materials-summary", ".materials-summary-table", "")

        page.evaluate(
            """() => {
            const el = document.querySelector('#materials-table-by-supplier');
            el?.scrollIntoView({ block: 'center' });
          }"""
        )
        time.sleep(0.4)
        shot(page, "step-materials-supplier", "#materials-table-by-supplier", "")

        page.evaluate(
            """() => {
            const el = document.querySelector('.materials-damage-table');
            el?.scrollIntoView({ block: 'center' });
          }"""
        )
        time.sleep(0.4)
        shot(page, "step-materials-damage", ".materials-damage-table", "")

        page.evaluate(
            """() => {
            const el = document.querySelector('.materials-table-shell--cement-bulk');
            el?.scrollIntoView({ block: 'center' });
          }"""
        )
        time.sleep(0.4)
        shot(page, "step-materials-cement", ".materials-table-shell--cement-bulk", "")

        page.evaluate(
            """() => {
            const el = document.querySelector('#materials-tbody-receipts');
            el?.closest('.materials-block')?.scrollIntoView({ block: 'start' });
          }"""
        )
        time.sleep(0.4)
        shot(page, "step-materials-receipts", "#materials-tbody-receipts", "")

    page.locator("#materials-panel-close").click(timeout=3_000)
    time.sleep(0.5)


def capture_pilexy(page: Page) -> None:
    page.set_viewport_size(VIEWPORT)
    try:
        page.goto(PILEXY, wait_until="networkidle", timeout=120_000)
    except PWTimeout:
        page.goto(PILEXY, wait_until="domcontentloaded", timeout=60_000)
        time.sleep(3)
    time.sleep(1)
    shot_plain(page, "01-access-main")

    shot(page, "step-load-btn", "#load-work-btn", "")
    page.locator("#load-work-btn").click()
    page.wait_for_selector("#load-work-list-panel.open")
    time.sleep(0.8)
    shot(page, "step-load-panel", "#load-work-list-panel", "")
    page.locator("#load-work-project-search").fill(PROJECT_SEARCH)
    time.sleep(0.5)
    page.locator(".load-work-project-item").first.click()
    time.sleep(0.5)
    shot(page, "step-load-select", ".load-work-load-btn", "")

    if not load_saved_work(page, panel_open=True):
        return

    shot_plain(page, "00-main-clean")
    shot_plain(page, "02-main-loaded")

    capture_parcel_review(page)
    capture_retaining_wall(page)

    shot(page, "step-status-btn", "#construction-status-btn", "")
    capture_construction_pdam(page)
    capture_construction_status(page)
    capture_construction_settlement(page)
    close_construction_drawer(page)

    capture_materials(page)
    capture_billing(page)
    capture_version_compare(page)


def capture_mobile(browser) -> None:
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
    )
    page = ctx.new_page()
    try:
        try:
            page.goto(PILEXY, wait_until="networkidle", timeout=120_000)
        except PWTimeout:
            page.goto(PILEXY, wait_until="domcontentloaded", timeout=60_000)
            time.sleep(3)
        time.sleep(1)
        shot_plain(page, "mobile-access")
        page.locator("#load-work-btn").click(timeout=10_000)
        page.wait_for_selector("#load-work-list-panel.open", timeout=15_000)
        time.sleep(0.8)
        page.locator("#load-work-project-search").fill(PROJECT_SEARCH)
        time.sleep(0.5)
        page.locator(".load-work-project-item").first.click()
        time.sleep(0.5)
        page.locator(".load-work-load-btn").first.click()
        try:
            page.wait_for_function(
                "() => !document.getElementById('construction-status-btn')?.disabled",
                timeout=180_000,
            )
        except PWTimeout:
            page.wait_for_timeout(8000)
        page.keyboard.press("Escape")
        time.sleep(1.5)
        shot_plain(page, "mobile-loaded")
        try:
            canvas = page.locator("#circle-canvas").first
            box = canvas.bounding_box()
            shown = False
            if box:
                for fx, fy in ((0.48, 0.52), (0.42, 0.58), (0.55, 0.45), (0.38, 0.50)):
                    page.mouse.move(
                        box["x"] + box["width"] * fx,
                        box["y"] + box["height"] * fy,
                    )
                    time.sleep(0.4)
                    tip = page.locator("#canvas-tooltip")
                    if tip.count() and tip.is_visible():
                        shown = True
                        break
            if not shown:
                page.evaluate(
                    """() => {
                    const t = document.getElementById('canvas-tooltip');
                    const canvas = document.getElementById('circle-canvas');
                    if (!t || !canvas) return;
                    const rect = canvas.getBoundingClientRect();
                    t.classList.remove('hidden');
                    t.style.display = 'block';
                    t.style.left = `${rect.left + rect.width * 0.35}px`;
                    t.style.top = `${rect.top + rect.height * 0.42}px`;
                    t.innerHTML = '<strong>번호 140-2</strong> · 111동<br />좌표: 242638.14, 449340.01';
                  }"""
                )
                time.sleep(0.3)
            page.evaluate(
                """() => {
                const btn = document.getElementById('load-work-btn');
                btn?.blur();
                if (btn) {
                  btn.style.outline = 'none';
                  btn.style.boxShadow = 'none';
                  btn.style.background = 'rgba(255, 255, 255, 0.06)';
                  btn.style.border = 'none';
                }
                if (document.activeElement && document.activeElement !== document.body) {
                  document.activeElement.blur();
                }
              }"""
            )
            try:
                canvas = page.locator("#circle-canvas").first
                box = canvas.bounding_box()
                if box:
                    page.mouse.click(box["x"] + 8, box["y"] + 8)
                    time.sleep(0.2)
            except Exception:
                pass
            clear_highlights(page)
            shot_plain(page, "mobile-coord-tooltip", hide_tooltip=False)
        except Exception:
            pass
    finally:
        ctx.close()


def capture_pdam(page: Page) -> None:
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(PDAM, wait_until="networkidle", timeout=60_000)
    time.sleep(1)
    shot(page, "10-pdam-login", "a[href*='login'], .login, form", "")


def main() -> None:
    print(f"URL: {PILEXY}")
    print(f"Project: {PROJECT_SEARCH}")
    print(f"Output: {OUT}\n")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(device_scale_factor=1.25, locale="ko-KR")
        page = ctx.new_page()
        try:
            capture_pilexy(page)
        except Exception as e:
            print(f"  ! pilexy error: {type(e).__name__}: {e!s}".encode("ascii", "replace").decode())
        try:
            capture_mobile(browser)
        except Exception as e:
            print(f"  ! mobile error: {type(e).__name__}: {e!s}".encode("ascii", "replace").decode())
        try:
            capture_pdam(page)
        except Exception as e:
            print(f"  ! pdam error: {type(e).__name__}: {e!s}".encode("ascii", "replace").decode())
        browser.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
