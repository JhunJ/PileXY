from __future__ import annotations

import importlib
import logging
import os
import re
import subprocess
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests

logger = logging.getLogger(__name__)

_manual_dbg_tls = threading.local()


def _manual_debug_init(active: bool) -> None:
    """매뉴얼 API 디버그 UI용 — 워커 스레드마다 단계 리스트."""
    if active:
        _manual_dbg_tls.rows = []
    elif hasattr(_manual_dbg_tls, "rows"):
        delattr(_manual_dbg_tls, "rows")


def _manual_debug_attach(result: Dict[str, Any]) -> Dict[str, Any]:
    rows = getattr(_manual_dbg_tls, "rows", None)
    if not isinstance(rows, list):
        return result
    out = dict(result)
    out["debugTrace"] = list(rows)
    return out


class BrdsManualUserError(ValueError):
    """HTTP 400 시 프론트 디버그 패널에 debugTrace 를 실을 때 사용."""

    def __init__(self, message: str):
        super().__init__(message)
        raw = getattr(_manual_dbg_tls, "rows", None)
        self.debug_trace: List[Dict[str, Any]] = list(raw) if isinstance(raw, list) else []


class BrdsManualDeferredPlaywright(Exception):
    """requests 단계 이후 Playwright 는 메인에서 asyncio.to_thread(동기 API)로 실행(Windows 루프 subprocess 미지원 회피)."""

    def __init__(
        self,
        *,
        uid: str,
        pw: str,
        sso: str,
        target: str,
        login_only: bool,
        verify: bool,
        fail_if_none_message: str,
        trace_copy: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        super().__init__("deferred_playwright")
        self.uid = uid
        self.pw = pw
        self.sso = sso
        self.target = target
        self.login_only = login_only
        self.verify = verify
        self.fail_if_none_message = fail_if_none_message
        self.trace_copy = list(trace_copy or [])


def _manual_debug_trace_copy() -> List[Dict[str, Any]]:
    rows = getattr(_manual_dbg_tls, "rows", None)
    return list(rows) if isinstance(rows, list) else []


def _manual_debug_resume_on_main_thread(debug_steps: bool, trace_copy: List[Dict[str, Any]]) -> None:
    """스레드풀에서 BrdsManualDeferredPlaywright 로 넘어온 뒤, 메인 스레드에서 디버그 행 이어 붙이기."""
    if debug_steps:
        _manual_dbg_tls.rows = list(trace_copy)
    elif hasattr(_manual_dbg_tls, "rows"):
        delattr(_manual_dbg_tls, "rows")


DEFAULT_BRDS_SSO_ENTRY = "https://baronet.daewooenc.com/login.do"
DEFAULT_BRDS_PRUGIO_PAGE = "https://aissvp01.daewooenc.com/brds/prugio/"

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 PileXY-BrdsManual/1"
)


def _ssl_verify() -> bool:
    v = str(os.environ.get("PILEXY_BRDS_SSL_VERIFY", "1")).strip().lower()
    return v not in ("0", "false", "no", "off")


def _playwright_enabled() -> bool:
    v = str(os.environ.get("PILEXY_BRDS_USE_PLAYWRIGHT", "1")).strip().lower()
    return v not in ("0", "false", "no", "off")


def _playwright_ask_enabled() -> bool:
    """릴레이 없을 때 PRUGio 페이지에서 Playwright 로 질의·답변 수집."""
    v = str(os.environ.get("PILEXY_BRDS_USE_PLAYWRIGHT_ASK", "1")).strip().lower()
    return v not in ("0", "false", "no", "off")


def _purge_playwright_modules() -> None:
    """pip 직후 같은 프로세스에서 재import 되도록 캐시 제거."""
    for k in list(sys.modules):
        if k == "playwright" or k.startswith("playwright."):
            sys.modules.pop(k, None)


def _playwright_package_installed() -> bool:
    """find_spec 만으로는 부족할 수 있음(깨진 설치·하위 모듈 실패). 실제 import 로 검증."""
    try:
        importlib.import_module("playwright.sync_api")
        return True
    except Exception:
        return False


def _auto_install_playwright_browser() -> bool:
    v = str(os.environ.get("PILEXY_BRDS_AUTO_INSTALL_PLAYWRIGHT", "1")).strip().lower()
    return v not in ("0", "false", "no", "off")


_playwright_chromium_install_lock = threading.Lock()
_playwright_chromium_install_finished = False


def ensure_playwright_chromium_installed() -> None:
    """
    (1) 이 프로세스의 Python에 playwright pip 패키지가 없으면 `pip install` 로 설치하고
    (2) `playwright install chromium` 으로 브라우저 바이너리를 준비한다.
    PILEXY_BRDS_AUTO_INSTALL_PLAYWRIGHT=0 이면 전부 생략.
    """
    global _playwright_chromium_install_finished
    if not _auto_install_playwright_browser():
        return
    with _playwright_chromium_install_lock:
        if _playwright_chromium_install_finished:
            return
        try:
            if not _playwright_package_installed():
                logger.info("Playwright pip 패키지 설치 중 (%s -m pip install playwright)…", sys.executable)
                pip_proc = subprocess.run(
                    [sys.executable, "-m", "pip", "install", "playwright>=1.49.0"],
                    timeout=600,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if pip_proc.returncode != 0:
                    logger.warning(
                        "pip install playwright 종료 코드 %s: %s",
                        pip_proc.returncode,
                        (pip_proc.stderr or pip_proc.stdout or "")[:1200],
                    )
                else:
                    logger.info("Playwright pip 패키지 설치 완료")
                importlib.invalidate_caches()
                _purge_playwright_modules()

            logger.info("Playwright Chromium 설치·확인 실행 중 (python -m playwright install chromium)…")
            proc = subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                timeout=900,
                capture_output=True,
                text=True,
                check=False,
            )
            if proc.returncode != 0:
                logger.warning(
                    "playwright install chromium 종료 코드 %s: %s",
                    proc.returncode,
                    (proc.stderr or proc.stdout or "")[:1200],
                )
            else:
                logger.info("Playwright Chromium 설치·확인 완료")
        except subprocess.TimeoutExpired:
            logger.warning("playwright install chromium 시간 초과(900초)")
        except Exception as exc:
            logger.warning("Playwright Chromium 설치 중 오류: %s", exc)
        finally:
            # sync_api import 가 되어야 설치 완료로 간주(다음 요청에서 pip 재시도 가능)
            _playwright_chromium_install_finished = bool(_playwright_package_installed())


def _relay_manual_url() -> str:
    return str(os.environ.get("PILEXY_BRDS_MANUAL_RELAY_URL", "") or os.environ.get("PILEXY_BRDS_RELAY_URL", "")).strip()


def _html_still_login_like(html: str) -> bool:
    t = (html or "").lower()
    if "type=\"password\"" in t or "type='password'" in t:
        return True
    if "name=\"j_password\"" in t or "name='j_password'" in t:
        return True
    if "id=\"loginform\"" in t or "id='loginform'" in t:
        return True
    return False


def _strip_html_to_text(html: str, max_len: int = 120000) -> str:
    if not html:
        return ""
    s = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    s = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", s)
    s = re.sub(r"(?is)<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        s = s[: max_len - 24] + "\n…(이하 생략)…"
    return s


def _parse_first_form(html: str, base_url: str) -> Optional[Tuple[str, str, Dict[str, str]]]:
    lower = html.lower()
    pos = lower.find("<form")
    if pos < 0:
        return None
    end = lower.find("</form>", pos)
    segment = html[pos : end] if end > pos else html[pos : pos + 16000]
    act_m = re.search(r"""(?is)<form[^>]*\saction\s*=\s*["']([^"']*)["']""", segment)
    method_m = re.search(r"""(?is)<form[^>]*\smethod\s*=\s*["']([^"']*)["']""", segment)
    method = (method_m.group(1).strip().lower() if method_m else "get")
    action = act_m.group(1).strip() if act_m else ""
    action_abs = urljoin(base_url, action) if action else base_url

    fields: Dict[str, str] = {}
    for m in re.finditer(r"(?is)<input\b[^>]*>", segment):
        tag = m.group(0)
        nm = re.search(r"""\bname\s*=\s*["']([^"']+)["']""", tag)
        if not nm:
            continue
        name = nm.group(1)
        vm = re.search(r"""\bvalue\s*=\s*["']([^"']*)["']""", tag)
        val = vm.group(1) if vm else ""
        typ_m = re.search(r"""\btype\s*=\s*["']([^"']+)["']""", tag)
        typ = (typ_m.group(1).lower() if typ_m else "text")
        if typ in ("submit", "button", "image", "reset"):
            continue
        fields[name] = val
    if not fields:
        return None
    if method != "post" and re.search(r"""(?is)type\s*=\s*["']password["']""", segment):
        method = "post"
    return method, action_abs, fields


def _inject_login_fields(
    fields: Dict[str, str],
    user_id: str,
    password: str,
    prugio_code: Optional[str],
) -> Dict[str, str]:
    out = dict(fields)
    for k in list(out.keys()):
        lk = k.lower()
        if any(p in lk for p in ("pass", "pwd", "secret", "j_password")):
            out[k] = password
        elif prugio_code and any(
            p in lk for p in ("prugio", "project", "site", "plant", "field", "biz", "const")
        ):
            if "pass" in lk:
                continue
            if not (out.get(k) or "").strip():
                out[k] = prugio_code
        elif any(
            p in lk
            for p in (
                "user",
                "login",
                "email",
                "acct",
                "j_username",
                "userid",
                "user_id",
                "username",
            )
        ):
            if "confirm" in lk or "repeat" in lk:
                continue
            out[k] = user_id
        elif lk in ("id", "uid") and not (out.get(k) or "").strip():
            out[k] = user_id
    return out


def build_brds_sso_iframe_autopost(
    *,
    user_id: str,
    password: str,
    sso_entry_url: Optional[str] = None,
    debug_steps: bool = False,
) -> Dict[str, Any]:
    """
    SSO(바로넷 등) 로그인 페이지를 서버에서 GET 한 뒤 첫 로그인 폼을 파싱·필드에 아이디·비밀번호를 넣어
    클라이언트가 <form target=iframe name> POST 로 제출할 수 있게 action/method/fields 를 돌려준다.
    (브라우저 iframe 컨텍스트에 Set-Cookie 가 붙도록)
    """
    _manual_debug_init(debug_steps)
    uid = (user_id or "").strip()
    pw = password or ""
    if not uid or not pw:
        raise ValueError("아이디와 비밀번호를 입력하세요.")
    if _relay_manual_url():
        return _manual_debug_attach(
            {
                "ok": False,
                "reason": "relay_only",
                "message": "릴레이 전용 설정이라 로그인 폼 HTML을 직접 받을 수 없습니다.",
            }
        )

    verify = _ssl_verify()
    sso = (sso_entry_url or "").strip() or DEFAULT_BRDS_SSO_ENTRY
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        }
    )
    try:
        last = session.get(sso, timeout=30, verify=verify, allow_redirects=True)
        last.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("BRDS SSO GET for iframe autopost failed: %s", exc)
        raise BrdsManualUserError(
            "사내 주소에 연결하지 못했습니다. VPN·사내망을 확인하거나 "
            "자체 서명 인증서라면 서버에 PILEXY_BRDS_SSL_VERIFY=0 을 설정해 보세요."
        ) from exc

    base = _origin_from(last.url or "")
    html = last.text or ""
    if not _html_still_login_like(html):
        return _manual_debug_attach(
            {
                "ok": False,
                "reason": "not_login_page",
                "message": "SSO 페이지에 로그인 폼이 보이지 않습니다. 이미 로그인됐거나 주소가 바뀌었을 수 있습니다.",
            }
        )

    parsed = _parse_first_form(html, last.url or base)
    if not parsed:
        return _manual_debug_attach(
            {
                "ok": False,
                "reason": "no_form",
                "message": "로그인 폼을 HTML에서 찾지 못했습니다.",
            }
        )

    method, action_abs, fields = parsed
    merged = _inject_login_fields(dict(fields), uid, pw, None)
    m_upper = (method or "post").strip().upper()
    if m_upper not in ("GET", "POST"):
        m_upper = "POST"

    return _manual_debug_attach(
        {
            "ok": True,
            "method": m_upper,
            "action": action_abs,
            "fields": merged,
        }
    )


def _try_simple_post_logins(
    session: requests.Session,
    origin: str,
    user_id: str,
    password: str,
    verify: bool,
) -> Optional[requests.Response]:
    payloads: List[Dict[str, str]] = [
        {"userId": user_id, "password": password},
        {"userid": user_id, "password": password},
        {"username": user_id, "password": password},
        {"j_username": user_id, "j_password": password},
        {"loginId": user_id, "loginPwd": password},
        {"id": user_id, "password": password},
    ]
    paths = (
        "/login",
        "/auth/login",
        "/brdss/auth/login",
        "/brdss/login",
        "/brds/login",
        "/api/auth/login",
        "/api/login",
    )
    for path in paths:
        url = urljoin(origin, path)
        for data in payloads:
            try:
                r = session.post(url, data=data, timeout=25, verify=verify, allow_redirects=True)
                if r.ok and not _html_still_login_like(r.text):
                    return r
                if r.ok and len(r.text) < 500 and r.status_code == 200:
                    continue
            except requests.RequestException:
                continue
    return None


def _origin_from(url: str) -> str:
    p = urlparse(url)
    if p.scheme and p.netloc:
        return f"{p.scheme}://{p.netloc}"
    return url


def _pw_keywords_for_doc_search(q: str) -> str:
    """문서 검색창용 짧은 키워드(로그·전송에만 사용, PII 없음)."""
    s = " ".join((q or "").strip().split())
    if len(s) > 96:
        s = s[:96].rsplit(" ", 1)[0]
    return s or "manual"


def _pw_prugio_chat_answer(page: Any, question: str, prugio_target_url: str = "") -> str:
    """PRUGio: (1) 문서 키워드 검색 (2) 채팅 질문 전송 후 AI 말풍선 추출."""
    q = (question or "").strip()
    if not q:
        return ""

    cur_u = page.url or ""
    if "chrome-error" in cur_u or "chromewebdata" in cur_u:
        if (prugio_target_url or "").strip():
            try:
                page.goto((prugio_target_url or "").strip(), wait_until="domcontentloaded", timeout=90_000)
                time.sleep(1.2)
            except Exception:
                return ""
        else:
            return ""

    # 신규대화 클릭은 SPA에서 chrome-error 로 이어진 로그가 있어 비활성화

    kw = _pw_keywords_for_doc_search(q)
    doc_filled = False
    doc_el = None
    for sel in (
        'input[placeholder*="검색" i]',
        'textarea[placeholder*="검색" i]',
        "mat-toolbar input[type='text']",
        "mat-toolbar input:not([type='hidden'])",
        "[class*='search'] input[type='text']",
    ):
        loc = page.locator(sel)
        try:
            if loc.count() == 0:
                continue
            el = loc.first
            if not el.is_visible():
                continue
            el.click(timeout=4000)
            el.fill("", timeout=2000)
            el.fill(kw, timeout=12_000)
            doc_filled = True
            doc_el = el
            break
        except Exception:
            continue
    if doc_filled and doc_el is not None:
        # Enter 는 예외가 거의 없어 첫 순서에 두면 실제 미제출인데 성공으로 끝날 수 있음 → 버튼 탐색 우선
        for via in ("js_ancestor_button", "role_button", "enter"):
            try:
                if via == "js_ancestor_button":
                    clicked = doc_el.evaluate(
                        """el => {
                            let cur = el;
                            for (let d = 0; d < 14 && cur; d++) {
                              const buttons = cur.querySelectorAll('button');
                              for (const b of buttons) {
                                const al = (b.getAttribute('aria-label') || '').toLowerCase();
                                const tt = (b.getAttribute('mattooltip') || '').toLowerCase();
                                const txt = (b.innerText || '').trim().toLowerCase();
                                const mic = b.querySelector('mat-icon');
                                const dmi = ((mic && mic.getAttribute('data-mat-icon-name')) ||
                                  b.getAttribute('data-mat-icon-name') || '').toLowerCase();
                                const t = al + ' ' + tt + ' ' + txt + ' ' + dmi;
                                if (t.includes('search') || t.includes('검색') || dmi === 'search') { b.click(); return 1; }
                              }
                              cur = cur.parentElement;
                            }
                            return 0;
                        }"""
                    )
                    if not clicked:
                        raise RuntimeError("no_ancestor_search_btn")
                elif via == "role_button":
                    page.get_by_role("button", name=re.compile(r"검색|search", re.I)).first.click(timeout=12_000)
                else:
                    doc_el.press("Enter", timeout=5000)
                break
            except Exception:
                continue
        time.sleep(2.2)

    filled = False
    # contenteditable / textbox 먼저(채팅), textarea 는 문서검색일 수 있어 나중·역순
    for sel in (
        "div[contenteditable='true']",
        "div[role='textbox']",
        "textarea:not([readonly])",
        "textarea",
        'input[placeholder*="질문" i]',
        'input[placeholder*="검색" i]',
        'input[placeholder*="search" i]',
        'input[type="text"]',
    ):
        loc = page.locator(sel)
        try:
            n = loc.count()
            for j in range(min(n, 16)):
                el = loc.nth(n - 1 - j)
                try:
                    if not el.is_visible():
                        continue
                    el.click(timeout=4000)
                    try:
                        el.fill("", timeout=3000)
                        el.fill(q, timeout=20_000)
                    except Exception:
                        page.keyboard.press("Control+a")
                        page.keyboard.type(q, delay=12)
                    filled = True
                    break
                except Exception:
                    continue
            if filled:
                break
        except Exception:
            continue

    if not filled:
        return ""

    def _pw_click_composer_send() -> bool:
        """채팅 composer 쪽 전송(문서 검색 send 와 분리)."""
        aria_btns = (
            'button[aria-label*="Send" i]',
            'button[aria-label*="전송" i]',
            'button[aria-label*="보내기" i]',
            'button[mattooltip*="Send" i]',
            'button[mattooltip*="전송" i]',
        )
        for css in aria_btns:
            try:
                bl = page.locator(css)
                if bl.count() == 0:
                    continue
                b = bl.last
                if b.is_visible():
                    b.click(timeout=5000)
                    return True
            except Exception:
                continue
        try:
            comp = page.locator(
                "[class*='composer'] button, [class*='chat-input'] button, .prugio-chat-composer button"
            )
            if comp.count() > 0:
                comp.last.click(timeout=5000)
                return True
        except Exception:
            pass
        for pat in (r"\bsend\b", r"전송", r"보내기"):
            try:
                page.get_by_role("button", name=re.compile(pat, re.I)).last.click(timeout=6000)
                return True
            except Exception:
                continue
        return False

    try:
        page.keyboard.press("Control+Enter")
    except Exception:
        pass
    clicked = _pw_click_composer_send()
    if not clicked:
        for sel in ('button[type="submit"]', 'button:has-text("send")', 'button:has-text("Send")'):
            loc = page.locator(sel)
            try:
                if loc.count() > 0 and loc.last.is_visible():
                    loc.last.click(timeout=5000)
                    clicked = True
                    break
            except Exception:
                continue

    def _pw_is_likely_empty_search_snippet(t: str) -> bool:
        """문서검색 무결과 패널(innerText에 툴바까지 붙는 긴 문자열 포함)."""
        t = (t or "").strip()
        if not t:
            return True
        if "검색 결과가 없습니다" not in t:
            return False
        if "요약" in t:
            return False
        if t.count("|") >= 6 and ("구분" in t or "오차" in t):
            return False
        if any(x in t for x in ("content_copy", "replay", "diversity_3", "원본 질문으로 검색", "다변화")):
            return True
        if len(t) < 520:
            return True
        if "요약" not in t and t.count("|") < 4:
            return True
        return False

    def _pw_pick_best_ai_bubble_text() -> Tuple[str, Dict[str, Any]]:
        """여러 AI 말풍선 중 실제 답변으로 보이는 .prugio-markdown 선택."""
        locs = page.locator(".prugio-chat-bubble-ai .prugio-markdown")
        meta: Dict[str, Any] = {"bubble_md_count": 0, "picked_index": None, "preview": ""}
        try:
            n = locs.count()
        except Exception:
            n = 0
        meta["bubble_md_count"] = n
        best_txt = ""
        best_i: Optional[int] = None
        best_score = -1
        for i in range(n):
            try:
                raw = (locs.nth(i).inner_text(timeout=5000) or "").strip()
            except Exception:
                continue
            if not raw:
                continue
            if _pw_is_likely_empty_search_snippet(raw):
                continue
            score = len(raw)
            if "요약" in raw:
                score += 1200
            if "|" in raw and raw.count("|") >= 6:
                score += 500
            if score > best_score:
                best_score = score
                best_txt = raw
                best_i = i
        if best_txt and best_i is not None:
            meta["picked_index"] = best_i
            meta["preview"] = best_txt[:200].replace("\n", " ")
            return best_txt, meta
        try:
            if n > 0:
                last_raw = (locs.nth(n - 1).inner_text(timeout=5000) or "").strip()
                if not _pw_is_likely_empty_search_snippet(last_raw):
                    meta["picked_index"] = n - 1
                    meta["preview"] = last_raw[:200].replace("\n", " ")
                    return last_raw, meta
                meta["preview"] = last_raw[:120].replace("\n", " ")
        except Exception:
            pass
        bub = page.locator(".prugio-chat-bubble-ai").last
        try:
            if bub.count() > 0:
                fb = (bub.inner_text(timeout=5000) or "").strip()
                if not _pw_is_likely_empty_search_snippet(fb):
                    meta["preview"] = fb[:200].replace("\n", " ")
                    return fb, meta
        except Exception:
            pass
        return "", meta

    prev_txt = ""
    same_rounds = 0
    resubmit_rounds = (2, 5, 8, 12, 16, 20, 25, 30, 35, 40)
    for round_i in range(90):
        time.sleep(1.35)
        txt, pick_meta = _pw_pick_best_ai_bubble_text()
        if round_i in resubmit_rounds and pick_meta.get("bubble_md_count", 0) <= 1:
            _pw_click_composer_send()
        if not txt:
            continue
        if _pw_is_likely_empty_search_snippet(txt):
            prev_txt = ""
            same_rounds = 0
            continue
        if txt == prev_txt:
            same_rounds += 1
            if same_rounds >= 3:
                return txt[:20000]
        else:
            prev_txt = txt
            same_rounds = 0

    out, _ = _pw_pick_best_ai_bubble_text()
    if not out or _pw_is_likely_empty_search_snippet(out):
        tail = _strip_html_to_text(page.content())
        if q in tail:
            parts = tail.rsplit(q, 1)
            if len(parts) > 1 and len(parts[-1].strip()) > 40:
                cand = parts[-1].strip()
                if not _pw_is_likely_empty_search_snippet(cand):
                    out = cand
        if not out or _pw_is_likely_empty_search_snippet(out):
            tail2 = tail[-12000:] if tail else ""
            if tail2 and not _pw_is_likely_empty_search_snippet(tail2):
                out = tail2
    if _pw_is_likely_empty_search_snippet(out or ""):
        out = ""

    return (out or "").strip()[:20000]


def _playwright_brds_login_and_fetch(
    uid: str,
    pw: str,
    sso: str,
    target: str,
    login_only: bool,
    verify: bool,
    chat_question: Optional[str] = None,
    collect_cookies: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    requests 로는 SAML·복잡 폼에 막힐 때, headless Chromium 으로 로그인 후 대상 페이지 HTML 을 가져온다.
    동기 API이므로 호출부에서는 asyncio.to_thread 등으로 이벤트 루프와 분리할 것(Windows).
    """
    if not _playwright_enabled():
        return None
    ensure_playwright_chromium_installed()
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        logger.info("Playwright import 실패 — BRDS 자동 로그인 브라우저 폴백 생략: %s", exc)
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            try:
                context = browser.new_context(
                    ignore_https_errors=not verify,
                    locale="ko-KR",
                    user_agent=_USER_AGENT,
                )
                page = context.new_page()
                page.set_default_timeout(90_000)
                
                page.goto(sso, wait_until="domcontentloaded")
                try:
                    page.wait_for_selector(
                        "input#password, input#id, input[name='j_password'], input[type='password']",
                        timeout=45_000,
                        state="visible",
                    )
                except Exception:
                    time.sleep(1.5)

                user_selectors = (
                    "input#id",
                    'input[name="j_username"]',
                    "input#j_username",
                    'input[name="userId"]',
                    'input[name="userid"]',
                    'input[name="loginId"]',
                    'input[name="username"]',
                    'input[name="id"]',
                    'input[autocomplete="username"]',
                )
                user_filled = False
                for sel in user_selectors:
                    loc = page.locator(sel)
                    try:
                        n = loc.count()
                        for i in range(n):
                            el = loc.nth(i)
                            if el.is_visible():
                                el.fill(uid, timeout=10_000)
                                user_filled = True
                                break
                        if user_filled:
                            break
                    except Exception:
                        continue

                pw_filled = False
                pw_try_selectors = (
                    "input#password",
                    'input[name="j_password"]',
                    "input#ssoPw",
                    'input[type="password"]',
                )
                for sel in pw_try_selectors:
                    loc = page.locator(sel)
                    try:
                        n = loc.count()
                        for i in range(n):
                            el = loc.nth(i)
                            if el.is_visible():
                                el.fill(pw, timeout=10_000)
                                pw_filled = True
                                break
                        if pw_filled:
                            break
                    except Exception:
                        continue
                
                if not pw_filled:
                    logger.warning("Playwright: 비밀번호 입력 필드를 찾지 못했습니다.")
                    return None

                clicked = False
                try:
                    page.get_by_role("button", name=re.compile(r"로그인", re.I)).first.click(timeout=4000)
                    clicked = True
                except Exception:
                    pass
                if not clicked:
                    for sel in ('button[type="submit"]', 'input[type="submit"]'):
                        loc = page.locator(sel)
                        try:
                            if loc.count() > 0 and loc.first.is_visible():
                                loc.first.click(timeout=4000)
                                clicked = True
                                break
                        except Exception:
                            continue
                if not clicked:
                    try:
                        page.keyboard.press("Enter")
                    except Exception:
                        pass

                try:
                    page.wait_for_load_state("load", timeout=90_000)
                except Exception:
                    pass
                time.sleep(1.2)

                html = page.content()
                _sl_after = _html_still_login_like(html)
                
                if _sl_after:
                    logger.warning("Playwright: 제출 후에도 로그인 화면으로 보입니다.")
                    return None

                if login_only and not collect_cookies:
                    return {
                        "ok": True,
                        "loggedIn": True,
                        "source": "playwright",
                        "message": "로그인되었습니다.",
                    }

                page.goto(target, wait_until="domcontentloaded")
                time.sleep(0.9)
                html2 = page.content()
                _sl2 = _html_still_login_like(html2)
                
                if _sl2:
                    logger.warning("Playwright: 대상 URL 접근 후 로그인 화면입니다.")
                    return None
                if collect_cookies:
                    try:
                        raw_cookies = context.cookies()
                    except Exception:
                        raw_cookies = []
                    flat: List[Dict[str, Any]] = []
                    for c in raw_cookies:
                        flat.append(
                            {
                                "name": c.get("name", ""),
                                "value": c.get("value", ""),
                                "domain": c.get("domain", ""),
                                "path": c.get("path", "/"),
                                "expires": c.get("expires", -1),
                                "httpOnly": bool(c.get("httpOnly", False)),
                                "secure": bool(c.get("secure", False)),
                                "sameSite": c.get("sameSite", "Lax"),
                            }
                        )
                    return {
                        "ok": True,
                        "source": "playwright",
                        "exportedCookies": flat,
                        "fetchedUrl": page.url,
                    }
                cq = (chat_question or "").strip()
                if cq and not login_only:
                    ans = _pw_prugio_chat_answer(page, cq, target)
                    return {
                        "ok": True,
                        "source": "playwright",
                        "answer": (ans or "").strip(),
                        "fetchedUrl": page.url,
                    }
                text = _strip_html_to_text(html2)
                if not text:
                    return None
                return {
                    "ok": True,
                    "source": "playwright",
                    "content": text,
                    "contentType": "text/plain",
                    "fetchedUrl": page.url,
                }
            finally:
                browser.close()
    except Exception as exc:
        logger.warning("Playwright BRDS 흐름 실패: %s", exc, exc_info=True)
        return None


def export_brds_cookies_via_playwright(
    user_id: str,
    password: str,
    sso_entry_url: Optional[str] = None,
    target_page_url: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Playwright 로 바로넷·PRUGio 까지 로그인한 뒤 브라우저 쿠키 목록을 반환(역프록시 세션용)."""
    uid = (user_id or "").strip()
    pw = password or ""
    if not uid or not pw:
        return None
    sso = (sso_entry_url or "").strip() or DEFAULT_BRDS_SSO_ENTRY
    target = (target_page_url or "").strip() or DEFAULT_BRDS_PRUGIO_PAGE
    verify = _ssl_verify()
    res = _playwright_brds_login_and_fetch(
        uid,
        pw,
        sso,
        target,
        False,
        verify,
        None,
        collect_cookies=True,
    )
    if not res or not isinstance(res.get("exportedCookies"), list):
        return None
    return list(res["exportedCookies"])


def fetch_brds_prugio_manual(
    *,
    user_id: str,
    password: str,
    sso_entry_url: Optional[str] = None,
    target_page_url: Optional[str] = None,
    login_only: bool = False,
    debug_steps: bool = False,
) -> Dict[str, Any]:
    """
    서버에서 세션을 연 뒤 login_only 이면 로그인 확인만, 아니면 대상 페이지 본문을 텍스트로 반환.
    순서: 릴레이 URL(설정 시) → requests 폼 로그인 → 실패 시 Playwright(Chromium) 브라우저 자동 로그인.
    Playwright 끄기: PILEXY_BRDS_USE_PLAYWRIGHT=0
    """
    uid = (user_id or "").strip()
    pw = password or ""
    if not uid or not pw:
        raise ValueError("아이디와 비밀번호를 입력하세요.")
    _manual_debug_init(debug_steps)

    relay = _relay_manual_url()
    if relay:
        body: Dict[str, Any] = {
            "kind": "login" if login_only else "manual",
            "loginOnly": login_only,
            "userId": uid,
            "password": pw,
            "ssoEntryUrl": (sso_entry_url or "").strip() or DEFAULT_BRDS_SSO_ENTRY,
            "targetPageUrl": (target_page_url or "").strip() or DEFAULT_BRDS_PRUGIO_PAGE,
        }
        try:
            resp = requests.post(relay, json=body, timeout=120, verify=_ssl_verify())
        except requests.RequestException as exc:
            logger.warning("BRDS manual relay failed: %s", exc)
            raise BrdsManualUserError(f"릴레이에 연결하지 못했습니다: {exc}") from exc
        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text[:4000]}
        if resp.status_code >= 400:
            detail = data.get("detail") if isinstance(data, dict) else None
            msg = detail if isinstance(detail, str) else str(data)[:500]
            raise BrdsManualUserError(msg or f"릴레이 HTTP {resp.status_code}")
        if login_only:
            if isinstance(data, dict) and (data.get("loggedIn") or data.get("ok") is True):
                return _manual_debug_attach(
                    {
                        "ok": True,
                        "loggedIn": True,
                        "source": "relay",
                        "message": str(data.get("message") or "로그인되었습니다."),
                    }
                )
            raise BrdsManualUserError(
                str(data.get("detail") or data.get("message") or "릴레이에서 로그인 확인에 실패했습니다.")
            )
        if isinstance(data, dict) and data.get("content"):
            return _manual_debug_attach(
                {
                    "ok": True,
                    "source": "relay",
                    "content": str(data.get("content") or ""),
                    "contentType": str(data.get("contentType") or "text/plain"),
                }
            )
        if isinstance(data, dict) and data.get("answer"):
            return _manual_debug_attach(
                {
                    "ok": True,
                    "source": "relay",
                    "content": str(data.get("answer") or ""),
                    "contentType": "text/plain",
                }
            )
        raise BrdsManualUserError(
            "릴레이 응답에 content(또는 answer) 필드가 없습니다. 릴레이 구현을 확인하세요."
        )

    verify = _ssl_verify()
    sso = (sso_entry_url or "").strip() or DEFAULT_BRDS_SSO_ENTRY
    target = (target_page_url or "").strip() or DEFAULT_BRDS_PRUGIO_PAGE

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        }
    )

    try:
        r0 = session.get(sso, timeout=30, verify=verify, allow_redirects=True)
        r0.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(
            "BRDS SSO GET failed: %s (ssl_verify=%s relay_set=%s)",
            exc,
            verify,
            bool(_relay_manual_url()),
        )
        raise BrdsManualUserError(
            "사내 주소에 연결하지 못했습니다. VPN·사내망을 확인하거나, "
            "자체 서명 인증서라면 서버에 PILEXY_BRDS_SSL_VERIFY=0 을 설정해 보세요."
        ) from exc

    base = _origin_from(r0.url)
    last = r0
    if _html_still_login_like(last.text):
        r_try = _try_simple_post_logins(session, base, uid, pw, verify)
        if r_try is not None:
            last = r_try

    if _html_still_login_like(last.text):
        parsed = _parse_first_form(last.text, last.url or base)
        if parsed:
            method, action_abs, fields = parsed
            merged = _inject_login_fields(fields, uid, pw, None)
            try:
                if method == "post":
                    last = session.post(action_abs, data=merged, timeout=30, verify=verify, allow_redirects=True)
                else:
                    last = session.post(action_abs, data=merged, timeout=30, verify=verify, allow_redirects=True)
                last.raise_for_status()
            except requests.RequestException as exc:
                logger.warning("BRDS form login failed: %s", exc)
                raise BrdsManualUserError(
                    "로그인 폼 전송에 실패했습니다. 사내 SSO 구조가 자동 로그인을 허용하지 않을 수 있습니다."
                ) from exc

    if _html_still_login_like(last.text):
        logger.info(
            "BRDS manual: login page still after requests (relay=%s); trying Playwright",
            bool(_relay_manual_url()),
        )
        if _playwright_enabled():
            ensure_playwright_chromium_installed()
        if _playwright_enabled() and not _playwright_package_installed():
            raise BrdsManualUserError(
                "Playwright 패키지를 자동 설치하지 못했습니다. 네트워크·pip 권한을 확인하거나, "
                "백엔드와 동일한 Python에서 `pip install playwright` 후 `playwright install chromium` 을 실행하세요. "
                "(자동 설치 끄기: PILEXY_BRDS_AUTO_INSTALL_PLAYWRIGHT=0)"
            )
        if not _playwright_enabled():
            pw_res = None
        else:
            raise BrdsManualDeferredPlaywright(
                uid=uid,
                pw=pw,
                sso=sso,
                target=target,
                login_only=login_only,
                verify=verify,
                fail_if_none_message=(
                    "자동 로그인에 실패했습니다. 아이디·비밀번호와 VPN(사내망)을 확인하세요. "
                    "서버에 Playwright가 설치되어 있다면 `playwright install chromium` 실행 여부를 확인해 주세요."
                ),
                trace_copy=_manual_debug_trace_copy(),
            )
        if pw_res is not None:
            return _manual_debug_attach(dict(pw_res))
        raise BrdsManualUserError(
            "자동 로그인에 실패했습니다. 아이디·비밀번호와 VPN(사내망)을 확인하세요. "
            "서버에 Playwright가 설치되어 있다면 `playwright install chromium` 실행 여부를 확인해 주세요."
        )

    if login_only:
        return _manual_debug_attach(
            {
                "ok": True,
                "loggedIn": True,
                "source": "direct",
                "message": "로그인되었습니다.",
            }
        )

    try:
        r_page = session.get(target, timeout=30, verify=verify, allow_redirects=True)
        r_page.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("BRDS prugio page GET failed: %s", exc)
        raise BrdsManualUserError(f"페이지를 불러오지 못했습니다: {exc}") from exc

    if _html_still_login_like(r_page.text):
        logger.info("BRDS manual: target page login-like after session GET; trying Playwright")
        if _playwright_enabled():
            ensure_playwright_chromium_installed()
        if _playwright_enabled() and not _playwright_package_installed():
            raise BrdsManualUserError(
                "Playwright 패키지를 자동 설치하지 못했습니다. 네트워크·pip 권한을 확인하거나, "
                "백엔드와 동일한 Python에서 `pip install playwright` 후 `playwright install chromium` 을 실행하세요. "
                "(자동 설치 끄기: PILEXY_BRDS_AUTO_INSTALL_PLAYWRIGHT=0)"
            )
        if not _playwright_enabled():
            pw_res = None
        else:
            raise BrdsManualDeferredPlaywright(
                uid=uid,
                pw=pw,
                sso=sso,
                target=target,
                login_only=False,
                verify=verify,
                fail_if_none_message=(
                    "매뉴얼 페이지를 열었지만 로그인 화면이 다시 나왔습니다. "
                    "계정 권한·사내망을 확인하거나 Playwright Chromium 설치를 확인해 주세요."
                ),
                trace_copy=_manual_debug_trace_copy(),
            )
        if pw_res is not None:
            return _manual_debug_attach(dict(pw_res))
        raise BrdsManualUserError(
            "매뉴얼 페이지를 열었지만 로그인 화면이 다시 나왔습니다. "
            "계정 권한·사내망을 확인하거나 Playwright Chromium 설치를 확인해 주세요."
        )

    text = _strip_html_to_text(r_page.text)
    if not text:
        raise BrdsManualUserError("페이지는 받았지만 본문 텍스트를 추출하지 못했습니다.")

    return _manual_debug_attach(
        {
            "ok": True,
            "source": "direct",
            "content": text,
            "contentType": "text/plain",
            "fetchedUrl": r_page.url,
        }
    )
