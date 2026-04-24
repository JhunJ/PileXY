"""
BRDS / 바로넷 역프록시 — Playwright 로 수집한 쿠키를 서버에 보관하고,
iframe 이 PileXY 동일 출처 경로만 로드하도록 하여 삽입 iframe 쿠키 제한을 우회한다.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from starlette.datastructures import Headers

logger = logging.getLogger(__name__)

# (path_key, upstream_origin)
ORIGIN_ENTRIES: Tuple[Tuple[str, str], ...] = (
    ("aissvp01", "https://aissvp01.daewooenc.com"),
    ("baronet", "https://baronet.daewooenc.com"),
)

_ORIGIN_MAP = {k: v for k, v in ORIGIN_ENTRIES}
_TTL_SEC = 8 * 3600
_MAX_BODY_BYTES = 32 * 1024 * 1024

_SURF_LOCK = threading.Lock()
_SURF: Dict[str, "_SurfSlot"] = {}


@dataclass
class _SurfSlot:
    cookies: List[Dict[str, Any]]
    created: float


def _prune_unlocked() -> None:
    now = time.time()
    dead = [t for t, s in _SURF.items() if now - s.created > _TTL_SEC]
    for t in dead:
        _SURF.pop(t, None)


def surf_session_put(cookies: List[Dict[str, Any]]) -> str:
    token = secrets.token_urlsafe(32)
    with _SURF_LOCK:
        _prune_unlocked()
        _SURF[token] = _SurfSlot(cookies=list(cookies or []), created=time.time())
    return token


def surf_session_get(token: str) -> Optional[_SurfSlot]:
    with _SURF_LOCK:
        _prune_unlocked()
        return _SURF.get(token or "")


def _apply_cookies(sess: requests.Session, rows: List[Dict[str, Any]]) -> None:
    for c in rows or []:
        name = c.get("name")
        if not name:
            continue
        value = c.get("value") if c.get("value") is not None else ""
        domain = (c.get("domain") or "").strip().lstrip(".") or None
        path = (c.get("path") or "/").strip() or "/"
        try:
            sess.cookies.set(name, str(value), domain=domain, path=path)
        except Exception:
            try:
                sess.cookies.set(name, str(value))
            except Exception:
                pass


def _proxy_prefix(proxy_public_base: str) -> str:
    return f"{proxy_public_base.rstrip('/')}/api/brds/surf/t"


def rewrite_location(loc: str, origin_key: str, proxy_public_base: str) -> str:
    if not loc:
        return loc
    loc = loc.strip()
    pfx = _proxy_prefix(proxy_public_base)
    base = _ORIGIN_MAP.get(origin_key, "")
    if loc.startswith("http://") or loc.startswith("https://"):
        for key, ob in ORIGIN_ENTRIES:
            if loc.startswith(ob):
                tail = loc[len(ob) :].lstrip("/")
                return f"{pfx}/{key}/{tail}"
        return loc
    if loc.startswith("/") and base:
        abs_u = urljoin(f"{base.rstrip('/')}/", loc.lstrip("/"))
        return rewrite_location(abs_u, origin_key, proxy_public_base)
    return loc


def rewrite_html_if_needed(content: bytes, proxy_public_base: str) -> bytes:
    if not content or len(content) > 50 * 1024 * 1024:
        return content
    head = content[:8000].lower()
    if b"<html" not in head and b"<!doctype" not in head:
        return content
    try:
        s = content.decode("utf-8", errors="replace")
    except Exception:
        return content
    pfx = _proxy_prefix(proxy_public_base)
    for key, ob in ORIGIN_ENTRIES:
        host = urlparse(ob).netloc
        s = s.replace(f"https://{host}", f"{pfx}/{key}")
        s = s.replace(f"http://{host}", f"{pfx}/{key}")
        s = s.replace(f"//{host}/", f"/api/brds/surf/t/{key}/")
        s = s.replace(f"//{host}\"", f"/api/brds/surf/t/{key}\"")
        json_pfx = pfx.replace("/", "\\/")
        s = s.replace(f"https:\\/\\/{host}", f"{json_pfx}/{key}")
        s = s.replace(f"http:\\/\\/{host}", f"{json_pfx}/{key}")
    return s.encode("utf-8")


def _pick_forward_headers(h: Headers) -> Dict[str, str]:
    allow = {
        "accept",
        "accept-language",
        "accept-encoding",
        "content-type",
        "cache-control",
        "if-none-match",
        "if-modified-since",
        "range",
        "origin",
        "referer",
    }
    out: Dict[str, str] = {}
    for k, v in h.items():
        if k.lower() in allow and v:
            out[k] = v
    return out


def forward_sync(
    *,
    method: str,
    origin_key: str,
    rel_path: str,
    query: str,
    cookie_rows: List[Dict[str, Any]],
    req_headers: Headers,
    body: bytes,
    verify: bool,
    proxy_public_base: str,
    user_agent: str,
) -> Tuple[int, Dict[str, str], bytes]:
    upstream_base = _ORIGIN_MAP.get(origin_key)
    if not upstream_base:
        raise ValueError("unknown origin_key")
    upstream_url = f"{upstream_base.rstrip('/')}/{rel_path}"
    if query:
        upstream_url = f"{upstream_url}?{query}"

    sess = requests.Session()
    _apply_cookies(sess, cookie_rows)
    hdrs = _pick_forward_headers(req_headers)
    hdrs.setdefault("User-Agent", user_agent)

    m = method.upper()
    if m == "OPTIONS":
        return 204, {"Allow": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS"}, b""

    if body and len(body) > _MAX_BODY_BYTES:
        raise ValueError("body too large")

    r = sess.request(
        m,
        upstream_url,
        headers=hdrs,
        data=body if body else None,
        verify=verify,
        allow_redirects=False,
        timeout=120,
    )
    out_h: Dict[str, str] = {}
    skip = {"transfer-encoding", "connection", "content-encoding"}
    for k, v in r.headers.items():
        lk = k.lower()
        if lk in skip:
            continue
        if lk == "location" and v:
            out_h[k] = rewrite_location(str(v), origin_key, proxy_public_base)
        else:
            out_h[k] = v

    data = r.content or b""
    ct = out_h.get("Content-Type") or r.headers.get("Content-Type") or ""
    if "text/html" in str(ct).lower():
        data = rewrite_html_if_needed(data, proxy_public_base)
        out_h["Content-Length"] = str(len(data))
    return r.status_code, out_h, data


async def handle_tunnel(origin_key: str, full_path: str, request: Request) -> Response:
    from starlette.concurrency import run_in_threadpool

    from .brds_prugio import _USER_AGENT, _ssl_verify

    token = request.cookies.get("pilexy_brds_surf")
    slot = surf_session_get(token or "") if token else None
    if not slot:
        html = (
            "<!doctype html><html><head><meta charset=utf-8>"
            "<title>BRDS</title></head><body style='font-family:sans-serif;padding:1rem'>"
            "BRDS 서핑 세션이 없습니다. PileXY 매뉴얼 탭에서 <strong>로그인</strong>을 먼저 실행하세요."
            "</body></html>"
        )
        return HTMLResponse(html, status_code=401)

    body = await request.body()
    proxy_public_base = str(request.base_url).rstrip("/")

    def _sync() -> Tuple[int, Dict[str, str], bytes]:
        return forward_sync(
            method=request.method,
            origin_key=origin_key,
            rel_path=full_path,
            query=str(request.url.query) if request.url.query else "",
            cookie_rows=slot.cookies,
            req_headers=request.headers,
            body=body,
            verify=_ssl_verify(),
            proxy_public_base=proxy_public_base,
            user_agent=_USER_AGENT,
        )

    try:
        status, hdrs, content = await run_in_threadpool(_sync)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except requests.RequestException as exc:
        logger.warning("BRDS surf upstream failed: %s", exc)
        raise HTTPException(status_code=502, detail="사내 BRDS 서버와 연결하지 못했습니다.") from exc

    return Response(content=content, status_code=status, headers=hdrs)
