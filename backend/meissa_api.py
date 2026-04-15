"""
Meissa Platform API 프록시용 클라이언트 (platform-api.meissa.ai).
브라우저 CORS를 피하기 위해 백엔드에서 호출합니다. 자격 증명은 서버에 저장하지 않습니다.
"""

from __future__ import annotations

import base64
import csv
import io
import json
import logging
import math
import os
import re
import shutil
import sys
import tempfile
import struct
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # type: ignore[misc, assignment]

logger = logging.getLogger(__name__)



def _meissa_snapshot_detail_fetch_cap() -> int:
    """목록에 날짜가 없을 때 상세 GET 최대 횟수(존당). 환경변수 MEISSA_SNAPSHOT_DETAIL_MAX."""
    try:
        return max(0, min(500, int(os.environ.get("MEISSA_SNAPSHOT_DETAIL_MAX", "100"))))
    except ValueError:
        return 100


class Meissa2FARequired(Exception):
    """Meissa 계정에 2단계 인증이 필요할 때(웹과 동일하게 OTP 입력 후 재요청)."""


MEISSA_API_ORIGIN = "https://platform-api.meissa.ai"
# 웹 클라우드 로그인(authorize)에서 사용하는 service 값. (/auth/login 의 meissa 와 다름)
MEISSA_CLOUD_SERVICE = "cloud"
DEFAULT_SERVICE = MEISSA_CLOUD_SERVICE
REQUEST_TIMEOUT = (10, 60)
_RESOURCE_LIST_CACHE_TTL_SEC = 45.0
_RESOURCE_LIST_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}

# cloud.meissa.ai 번들(index-*.js)과 동일한 클라이언트측 비밀번호 보호용 키(공개되어 있음).
_MEISSA_AES_KEY = b"meissaCorp0213".ljust(32, b"\x00")

# 일부 WAF/게이트웨이가 python-requests 기본 UA를 거절하는 경우가 있어 브라우저에 가깝게 둡니다.
_MEISSA_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 PileXY-Meissa/1"
)


def _meissa_error_parts(data: Any) -> Tuple[str, str]:
    """응답 JSON에서 (message, error_code) 추출. 중첩 result 형식도 처리."""
    if not isinstance(data, dict):
        return "", ""
    res = data.get("result")
    res_d = res if isinstance(res, dict) else {}
    msg = (
        data.get("detail")
        or data.get("message")
        or res_d.get("message")
        or res_d.get("detail")
        or ""
    )
    if not isinstance(msg, str):
        msg = str(msg)
    code = data.get("error_code") or data.get("errorCode") or res_d.get("error_code") or res_d.get("errorCode") or ""
    if not isinstance(code, str):
        code = str(code) if code is not None else ""
    return msg.strip(), (code or "").strip()


def _meissa_login_user_message(data: Dict[str, Any], fallback_text: str) -> str:
    msg, code = _meissa_error_parts(data)
    if code in ("ER1003", "unauthorized_error"):
        return (
            "Meissa가 이메일 또는 비밀번호를 인증하지 못했습니다. "
            "https://cloud.meissa.ai 웹과 동일한 계정·비밀번호인지 확인하세요. "
            "소셜 로그인만 쓰는 계정은 웹에서 비밀번호를 설정해야 할 수 있습니다."
        )
    if code == "ER3008":
        return (
            "Meissa 서비스 코드 요청이 거절되었습니다(ER3008). "
            "앱을 최신으로 유지하거나 담당자에게 문의하세요."
        )
    base = msg or fallback_text or "로그인 실패"
    return f"{base} ({code})" if code else base


def _meissa_encrypt_password_for_authorize(plain_password: str) -> str:
    """
    웹 번들의 XC() 와 동일: AES-CBC(PKCS7), IV(16바이트)+암호문을 Base64로 전송.
    Crypto 는 지연 import — pycryptodome 미설치 시 상위에서 안내 메시지로 처리.
    """
    try:
        from Crypto.Cipher import AES as _AES
        from Crypto.Util.Padding import pad as _pad
    except ImportError as exc:
        raise ValueError(
            "서버에 pycryptodome 패키지가 없습니다. 백엔드에서 "
            "`pip install -r backend/requirements.txt` (또는 `pip install pycryptodome`) 후 "
            "uvicorn/백엔드 프로세스를 다시 시작하세요."
        ) from exc
    iv = os.urandom(16)
    cipher = _AES.new(_MEISSA_AES_KEY, _AES.MODE_CBC, iv)
    ciphertext = cipher.encrypt(_pad(plain_password.encode("utf-8"), _AES.block_size))
    return base64.b64encode(iv + ciphertext).decode("ascii")


def _unwrap_result(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("result"), dict):
        return payload["result"]
    return payload if isinstance(payload, dict) else {}


def _code_from_block(block: Any) -> Optional[str]:
    if not isinstance(block, dict):
        return None
    code = block.get("authorizeCode") or block.get("authorize_code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    nested = block.get("data")
    if isinstance(nested, dict):
        code = nested.get("authorizeCode") or nested.get("authorize_code")
        if isinstance(code, str) and code.strip():
            return code.strip()
    return None


def _extract_authorize_code(http_body: Dict[str, Any]) -> Optional[str]:
    """
    플랫폼 API는 snake_case(authorize_code)로 줄 수 있고, 웹 번들은 Eo(...,'camel')로만 변환해 씀.
    """
    c = _code_from_block(http_body)
    if c:
        return c
    inner = _unwrap_result(http_body)
    return _code_from_block(inner)


def _has_meissa_2fa_pending(root: Dict[str, Any], inner: Dict[str, Any]) -> bool:
    for block in (root, inner):
        if not isinstance(block, dict):
            continue
        if block.get("verificationExpiredAt") or block.get("verification_expired_at"):
            return True
    return False


def _extract_tokens(data: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    r = _unwrap_result(data)
    access = r.get("access") or r.get("access_token") or r.get("accessToken")
    refresh = r.get("refresh") or r.get("refresh_token") or r.get("refreshToken")
    if isinstance(access, str) and access.strip():
        return access.strip(), (refresh.strip() if isinstance(refresh, str) else None)
    return None, None


def _auth_header(access_token: str) -> Dict[str, str]:
    token = (access_token or "").strip()
    if token.lower().startswith("jwt "):
        return {"Authorization": token}
    return {"Authorization": f"JWT {token}"}


def meissa_login(*, email: str, password: str, service: str = DEFAULT_SERVICE) -> Dict[str, Any]:
    """
    cloud.meissa.ai 와 동일: POST /auth/authorize(암호화 비밀번호, service=cloud) → POST /auth/token(code).
    예전 /auth/login + 평문 + service=meissa 는 ER1003 만 유발하는 경로였습니다.
    """
    # 웹 로그인 폼과 동일하게 이메일 전체 소문자. 비밀번호는 trim 하지 않음.
    email = (email or "").strip().lower()
    password = password or ""
    if not email or not password:
        raise ValueError("이메일과 비밀번호를 입력하세요.")

    _ = service  # API 호환용 인자; authorize 는 클라우드 고정값 사용

    headers = {"Content-Type": "application/json", "User-Agent": _MEISSA_UA, "Accept": "application/json"}
    enc_pw = _meissa_encrypt_password_for_authorize(password)
    auth_url = f"{MEISSA_API_ORIGIN}/auth/authorize"
    auth_json = {
        "email": email,
        "password": enc_pw,
        "service": MEISSA_CLOUD_SERVICE,
        "redirect_uri": "/projects",
    }

    try:
        r1 = requests.post(auth_url, json=auth_json, headers=headers, timeout=REQUEST_TIMEOUT)
    except requests.RequestException as exc:
        logger.exception("Meissa authorize request failed: %s", exc)
        raise ValueError("Meissa 서버에 연결하지 못했습니다.") from exc

    try:
        d1 = r1.json()
    except Exception:
        d1 = {}

    if r1.status_code >= 400:
        logger.info("Meissa authorize rejected: status=%s parts=%s", r1.status_code, _meissa_error_parts(d1))
        raise ValueError(_meissa_login_user_message(d1, r1.text or "로그인 실패"))

    inner = _unwrap_result(d1)
    if _has_meissa_2fa_pending(d1, inner):
        raise Meissa2FARequired()

    auth_code = _extract_authorize_code(d1)
    if not auth_code:
        logger.warning(
            "Meissa authorize 200 but no authorize code; root_keys=%s inner_keys=%s",
            list(d1.keys()) if isinstance(d1, dict) else None,
            list(inner.keys()) if isinstance(inner, dict) else None,
        )
        raise ValueError(
            "Meissa 인증 응답에서 로그인 코드(authorize_code)를 찾지 못했습니다. API 형식이 바뀌었을 수 있습니다."
        )

    token_url = f"{MEISSA_API_ORIGIN}/auth/token"
    try:
        r2 = requests.post(
            token_url,
            json={"grant_type": "authorization_code", "code": auth_code.strip()},
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.exception("Meissa token request failed: %s", exc)
        raise ValueError("Meissa 토큰 요청에 실패했습니다.") from exc

    try:
        d2 = r2.json()
    except Exception:
        d2 = {}

    if r2.status_code >= 400:
        logger.info("Meissa token rejected: status=%s parts=%s", r2.status_code, _meissa_error_parts(d2))
        raise ValueError(_meissa_login_user_message(d2, r2.text or "토큰 발급 실패"))

    access, refresh = _extract_tokens(d2)
    if not access:
        raise ValueError("Meissa 토큰 응답에 액세스 토큰이 없습니다. API 형식이 바뀌었을 수 있습니다.")

    return {"access": access, "refresh": refresh, "raw": d2}


def meissa_login_with_verification(
    *,
    email: str,
    password: str,
    verification_code: str,
    service: str = DEFAULT_SERVICE,
) -> Dict[str, Any]:
    """
    2단계 인증: 웹의 verificationLogin 과 동일하게 authorize 재호출 후
    POST /auth/verification/token (code + verification_code).
    """
    _ = service
    email = (email or "").strip().lower()
    password = password or ""
    vc = (verification_code or "").strip()
    if not email or not password or not vc:
        raise ValueError("이메일·비밀번호·인증코드를 모두 입력하세요.")

    headers = {"Content-Type": "application/json", "User-Agent": _MEISSA_UA, "Accept": "application/json"}
    enc_pw = _meissa_encrypt_password_for_authorize(password)
    auth_json = {
        "email": email,
        "password": enc_pw,
        "service": MEISSA_CLOUD_SERVICE,
        "redirect_uri": "/projects",
    }
    try:
        r1 = requests.post(f"{MEISSA_API_ORIGIN}/auth/authorize", json=auth_json, headers=headers, timeout=REQUEST_TIMEOUT)
    except requests.RequestException as exc:
        logger.exception("Meissa authorize (2FA step) failed: %s", exc)
        raise ValueError("Meissa 서버에 연결하지 못했습니다.") from exc

    try:
        d1 = r1.json()
    except Exception:
        d1 = {}

    if r1.status_code >= 400:
        logger.info("Meissa authorize (2FA step) rejected: status=%s", r1.status_code)
        raise ValueError(_meissa_login_user_message(d1, r1.text or "로그인 실패"))

    auth_code = _extract_authorize_code(d1)
    if not auth_code:
        raise ValueError("인증 단계에서 authorize_code를 받지 못했습니다. 인증코드·비밀번호를 확인하세요.")

    try:
        r2 = requests.post(
            f"{MEISSA_API_ORIGIN}/auth/verification/token",
            json={
                "grant_type": "authorization_code",
                "code": auth_code.strip(),
                "verification_code": vc,
            },
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.exception("Meissa verification/token failed: %s", exc)
        raise ValueError("Meissa 인증 토큰 요청에 실패했습니다.") from exc

    try:
        d2 = r2.json()
    except Exception:
        d2 = {}

    if r2.status_code >= 400:
        logger.info("Meissa verification/token rejected: status=%s parts=%s", r2.status_code, _meissa_error_parts(d2))
        raise ValueError(_meissa_login_user_message(d2, r2.text or "인증코드가 올바르지 않을 수 있습니다."))

    access, refresh = _extract_tokens(d2)
    if not access:
        raise ValueError("Meissa 토큰 응답에 액세스 토큰이 없습니다.")

    return {"access": access, "refresh": refresh, "raw": d2}


def _meissa_get(path: str, access_token: str) -> Any:
    url = f"{MEISSA_API_ORIGIN}{path}"
    try:
        resp = requests.get(
            url,
            headers={
                **_auth_header(access_token),
                "Accept": "application/json",
                "User-Agent": _MEISSA_UA,
            },
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.exception("Meissa GET %s failed: %s", path, exc)
        raise ValueError("Meissa API 요청에 실패했습니다.") from exc

    try:
        data = resp.json()
    except Exception:
        data = {}

    if resp.status_code >= 400:
        detail = data.get("detail") or data.get("message") or resp.text or "요청 실패"
        raise ValueError(str(detail)[:500])

    return data


def _meissa_get_soft(path: str, access_token: str) -> Optional[Any]:
    try:
        return _meissa_get(path, access_token)
    except ValueError:
        logger.info("Meissa GET %s skipped (no access or API error)", path)
        return None


def _meissa_json_request(
    method: str,
    path: str,
    access_token: str,
    *,
    json_body: Optional[Any] = None,
) -> Tuple[int, Dict[str, Any]]:
    """Meissa Platform JSON API. DELETE 는 204 시 빈 dict 반환."""
    url = f"{MEISSA_API_ORIGIN}{path}"
    headers = {
        **_auth_header(access_token),
        "Accept": "application/json",
        "User-Agent": _MEISSA_UA,
    }
    m = method.upper()
    if m in ("POST", "PUT", "PATCH") or json_body is not None:
        headers["Content-Type"] = "application/json"
    try:
        resp = requests.request(
            m,
            url,
            headers=headers,
            json=json_body if m not in ("GET", "DELETE") else None,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.exception("Meissa %s %s failed: %s", method, path, exc)
        raise ValueError("Meissa API 요청에 실패했습니다.") from exc

    try:
        data = resp.json()
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {"_non_dict_body": data}
    return resp.status_code, data


def _meissa_try_extract_zone_id_from_snapshot_payload(payload: Any) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    layers: List[Dict[str, Any]] = [payload, _unwrap_result(payload)]
    for d in layers:
        if not isinstance(d, dict):
            continue
        for k in ("zone_id", "zoneId"):
            v = d.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        z = d.get("zone")
        if isinstance(z, dict):
            zi = z.get("id")
            if zi is not None and str(zi).strip():
                return str(zi).strip()
    return None


_SNAPSHOT_ZONE_RESOLVE_CACHE: Dict[str, Tuple[float, Optional[str]]] = {}
_SNAPSHOT_ZONE_RESOLVE_TTL_SEC = 180.0


def meissa_resolve_zone_id_for_snapshot(
    access_token: str,
    snapshot_id: Any,
    zone_id_hint: Optional[str] = None,
) -> Optional[str]:
    """스냅샷 상세에서 zone id 추출(힌트가 있으면 그대로 사용). nearest-z 다건 호출 시 GET 폭주 방지용 짧은 TTL 캐시."""
    h = (zone_id_hint or "").strip()
    if h:
        return h
    sid = str(snapshot_id).strip()
    if not sid:
        return None
    tok = (access_token or "").strip()
    cache_key = f"{tok[:32]}:{sid}"
    now = time.time()
    cached = _SNAPSHOT_ZONE_RESOLVE_CACHE.get(cache_key)
    if cached is not None and (now - cached[0]) <= _SNAPSHOT_ZONE_RESOLVE_TTL_SEC:
        return cached[1]

    zid_out: Optional[str] = None
    for path in (
        f"/api/v3/snapshots/{sid}",
        f"/api/v4/snapshots/{sid}",
    ):
        raw = _meissa_get_soft(path, access_token)
        zid = _meissa_try_extract_zone_id_from_snapshot_payload(raw)
        if zid:
            zid_out = zid
            break
    _SNAPSHOT_ZONE_RESOLVE_CACHE[cache_key] = (now, zid_out)
    return zid_out


def _meissa_extract_annotation_point_id(data: Any) -> Optional[str]:
    u = _unwrap_result(data) if isinstance(data, dict) else {}
    if not isinstance(u, dict):
        u = data if isinstance(data, dict) else {}
    for k in ("id", "annotation_id", "annotationId", "point_id", "pointId"):
        v = u.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def _meissa_extract_z_from_annotation_tree(obj: Any, depth: int = 0) -> Optional[float]:
    if depth > 14:
        return None
    if isinstance(obj, dict):
        for key in ("z", "Z", "altitude", "elevation", "height", "coord_z", "coordZ"):
            val = obj.get(key)
            if val is None:
                continue
            try:
                fz = float(val)
                if math.isfinite(fz):
                    return fz
            except (TypeError, ValueError):
                continue
        for v in obj.values():
            z = _meissa_extract_z_from_annotation_tree(v, depth + 1)
            if z is not None:
                return z
    elif isinstance(obj, list):
        for it in obj[:240]:
            z = _meissa_extract_z_from_annotation_tree(it, depth + 1)
            if z is not None:
                return z
    return None


def meissa_z_from_point_annotation_probe(
    access_token: str,
    snapshot_id: Any,
    zone_id: Any,
    x: float,
    y: float,
    *,
    cleanup: bool = True,
) -> Dict[str, Any]:
    """
    cloud.meissa.ai 번들(Oo.create)과 동일: POST /api/v3/snapshots/{id}/points
    로 포인트를 만들면 DSM 기준 Z가 채워질 수 있음. 사용 후 DELETE 로 임시 포인트 제거.
    """
    sid = str(snapshot_id).strip()
    zid = str(zone_id).strip()
    sx, sy = float(x), float(y)
    if not sid or not zid:
        return {"ok": False, "message": "snapshot_id와 zone_id가 필요합니다."}
    if not (math.isfinite(sx) and math.isfinite(sy)):
        return {"ok": False, "message": "x, y가 유효한 숫자가 아닙니다."}

    probe_name = "__pilexy_z_probe__"
    bodies: List[Dict[str, Any]] = [
        {"name": probe_name, "positions": [{"x": sx, "y": sy}]},
        {"name": probe_name, "positions": [{"coord_x": sx, "coord_y": sy}]},
        {"name": probe_name, "positions": [{"coordX": sx, "coordY": sy}]},
        {
            "name": probe_name,
            "color": "#FF6B00",
            "status": "DONE",
            "positions": [{"x": sx, "y": sy}],
        },
    ]
    tried: List[Dict[str, Any]] = []
    last_err = ""

    for bi, body in enumerate(bodies):
        path_post = f"/api/v3/snapshots/{sid}/points"
        try:
            status, data = _meissa_json_request("POST", path_post, access_token, json_body=body)
        except ValueError as exc:
            last_err = str(exc)
            tried.append({"bodyIndex": bi, "httpStatus": None, "error": last_err})
            continue

        if status not in (200, 201):
            msg, _code = _meissa_error_parts(data)
            if not msg:
                msg = data.get("detail") if isinstance(data.get("detail"), str) else str(data)[:400]
            last_err = msg or f"HTTP {status}"
            tried.append({"bodyIndex": bi, "httpStatus": status, "message": last_err[:500]})
            continue

        pid = _meissa_extract_annotation_point_id(data)
        z_val = _meissa_extract_z_from_annotation_tree(data)
        if (pid is None or z_val is None) and pid is not None:
            path_read = f"/api/v3/snapshots/{sid}/points/{pid}"
            try:
                _st, read_d = _meissa_json_request("GET", path_read, access_token, json_body=None)
                if _st < 400:
                    if z_val is None:
                        z_val = _meissa_extract_z_from_annotation_tree(read_d)
            except ValueError:
                pass

        cleanup_ok: Optional[bool] = None
        if cleanup and pid:
            path_del = f"/api/v3/zones/{zid}/points/{pid}"
            try:
                dst, _ = _meissa_json_request("DELETE", path_del, access_token, json_body=None)
                cleanup_ok = dst in (200, 204)
                if not cleanup_ok:
                    last_err = (last_err + ";" if last_err else "") + f"삭제 HTTP {dst}"
            except ValueError as exc:
                cleanup_ok = False
                last_err = (last_err + ";" if last_err else "") + f"삭제 실패:{exc}"

        if z_val is None and pid and cleanup:
            tried.append(
                {
                    "bodyIndex": bi,
                    "httpStatus": status,
                    "pointId": pid,
                    "message": "Z 없음(삭제만 수행)",
                    "probeCleanupOk": cleanup_ok,
                }
            )
            continue

        if z_val is not None and math.isfinite(z_val):
            return {
                "ok": True,
                "z": z_val,
                "zSource": "meissa_point_annotation",
                "annotationPointId": pid,
                "probeCleanupOk": cleanup_ok,
                "tried": tried,
                "note": "Meissa 웹과 동일 경로(/snapshots/.../points)로 생성·DSM 샘플 Z 후 임시 포인트 삭제 시도.",
            }

        tried.append(
            {
                "bodyIndex": bi,
                "httpStatus": status,
                "pointId": pid,
                "message": "응답에서 Z를 찾지 못함",
            }
        )

    return {
        "ok": False,
        "message": last_err or "포인트 어노테이션으로 Z를 얻지 못했습니다.",
        "tried": tried,
    }


def meissa_nearest_z_xy_combined(
    access_token: str,
    snapshot_id: Any,
    x: float,
    y: float,
    *,
    zone_id: Optional[str] = None,
    z_source: str = "pointcloud",
    resource_id: Optional[str] = None,
    limit: int = 8000,
    max_phases: int = 4,
) -> Dict[str, Any]:
    """
    z_source: pointcloud | cloud | auto
    auto: zone_id(또는 스냅샷에서 추론한 존)이 있으면 먼저 포인트 어노테이션(DSM) 시도 후, 실패 시 점군 nearest.
    """
    src = (z_source or "pointcloud").strip().lower()
    if src not in ("pointcloud", "cloud", "auto"):
        src = "pointcloud"

    resolved_zone: Optional[str] = None
    cloud_attempt: Optional[Dict[str, Any]] = None
    if src in ("cloud", "auto"):
        resolved_zone = meissa_resolve_zone_id_for_snapshot(access_token, snapshot_id, zone_id)
        if resolved_zone:
            cloud_attempt = meissa_z_from_point_annotation_probe(
                access_token,
                snapshot_id,
                resolved_zone,
                x,
                y,
                cleanup=True,
            )
            if cloud_attempt.get("ok"):
                out = dict(cloud_attempt)
                out["zoneIdUsed"] = resolved_zone
                if src == "auto":
                    out["fallback"] = None
                return out
        if src == "cloud":
            if not resolved_zone:
                return {"ok": False, "message": "zone_id를 알 수 없습니다(스냅샷 상세에도 없음).", "zoneIdUsed": None}
            base = dict(cloud_attempt) if isinstance(cloud_attempt, dict) else {}
            base.setdefault("message", "포인트 어노테이션 Z 실패")
            base["ok"] = False
            base["zoneIdUsed"] = resolved_zone
            return base

    pc = meissa_nearest_z_xy_from_resources(
        access_token,
        snapshot_id,
        x,
        y,
        resource_id=resource_id,
        limit=limit,
        max_phases=max_phases,
    )
    if isinstance(pc, dict):
        pc = dict(pc)
        if pc.get("ok"):
            pc.setdefault("zSource", "pointcloud")
        if src == "auto" and cloud_attempt is not None:
            pc["cloudProbe"] = cloud_attempt
        if src == "auto" and resolved_zone:
            pc["zoneIdUsed"] = resolved_zone
    return pc


def _coerce_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _project_display_name(p: Dict[str, Any], pid: Any) -> str:
    """cloud.meissa.ai 프로젝트 카드는 Q.name 사용."""
    for key in ("name", "title", "projectName", "project_name", "displayName", "display_name"):
        val = p.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return str(pid)


def _snapshot_count_from_project(p: Dict[str, Any]) -> Optional[int]:
    for key in (
        "processedSnapshotCount",
        "processed_snapshot_count",
        "numberOfSnapshots",
        "number_of_snapshots",
        "snapshotCount",
        "snapshot_count",
        "totalSnapshotCount",
        "total_snapshot_count",
    ):
        n = _coerce_int(p.get(key))
        if n is not None:
            return n
    return None


def _project_row_id(p: Dict[str, Any]) -> Any:
    """Meissa 응답은 id 또는 projectId 등으로 올 수 있음."""
    for key in ("id", "projectId", "project_id"):
        v = p.get(key)
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def _normalize_project_row(p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    pid = _project_row_id(p)
    if pid is None:
        return None
    latest = p.get("latestTakeDate") or p.get("latest_take_date")
    latest_str = latest.strip() if isinstance(latest, str) and latest.strip() else None
    return {
        "id": pid,
        "name": _project_display_name(p, pid),
        "snapshotCount": _snapshot_count_from_project(p),
        "latestTakeDate": latest_str,
    }


def _collect_project_dicts_from_tree(obj: Any) -> List[Dict[str, Any]]:
    """GET /api/v4/folder/organization/project/hierarchy 트리에서 프로젝트 객체 수집."""
    found: List[Dict[str, Any]] = []

    def walk(x: Any) -> None:
        if isinstance(x, dict):
            nested = x.get("project")
            if isinstance(nested, dict) and _project_row_id(nested) is not None:
                found.append(nested)
            for arr_key in ("projects", "projectList"):
                al = x.get(arr_key)
                if isinstance(al, list):
                    for it in al:
                        if isinstance(it, dict) and _project_row_id(it) is not None:
                            found.append(it)
            keys = set(x.keys())
            oid = _project_row_id(x)
            if oid is not None and (
                "processedSnapshotCount" in keys
                or "processed_snapshot_count" in keys
                or "latestTakeDate" in keys
                or "latest_take_date" in keys
                or "name" in keys
                or "title" in keys
                or "projectName" in keys
            ):
                found.append(x)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for it in x:
                walk(it)

    walk(obj)
    by_id: Dict[Any, Dict[str, Any]] = {}
    for p in found:
        if not isinstance(p, dict):
            continue
        pid = _project_row_id(p)
        if pid is None:
            continue
        by_id[pid] = p
    return list(by_id.values())


def _project_list_from_management_payload(data_m: Any) -> List[Dict[str, Any]]:
    """
    GET /api/v4/project/management 응답에서 프로젝트 dict 목록 추출.
    웹 번들은 data.result.projectList 를 쓰지만, result 가 배열이거나 키 이름이 바뀐 경우도 처리.
    """
    if not isinstance(data_m, dict):
        return []
    res = data_m.get("result")
    if isinstance(res, list):
        return [p for p in res if isinstance(p, dict)]
    inner: Any = _unwrap_result(data_m)
    if isinstance(inner, list):
        return [p for p in inner if isinstance(p, dict)]
    if not isinstance(inner, dict):
        return []
    for key in ("projectList", "projects", "project_list", "items", "content", "records", "list"):
        pl = inner.get(key)
        if isinstance(pl, list):
            return [p for p in pl if isinstance(p, dict)]
    nested = inner.get("data")
    if isinstance(nested, list):
        return [p for p in nested if isinstance(p, dict)]
    if isinstance(nested, dict):
        for key in ("projectList", "projects", "project_list", "items", "list"):
            pl = nested.get(key)
            if isinstance(pl, list):
                return [p for p in pl if isinstance(p, dict)]
    return []


def _extend_project_dicts_from_nested(d: Dict[str, Any], bucket: List[Dict[str, Any]]) -> None:
    for key in ("projectList", "projects", "project_list", "content", "items", "results", "rows", "records", "list"):
        v = d.get(key)
        if isinstance(v, list):
            for p in v:
                if isinstance(p, dict):
                    bucket.append(p)
    for subkey in ("data", "page", "result"):
        sub = d.get(subkey)
        if isinstance(sub, dict):
            _extend_project_dicts_from_nested(sub, bucket)


def _raw_project_dicts_from_api_payload(data: Any) -> List[Dict[str, Any]]:
    """목록 API 한 번의 JSON에서 프로젝트 후보 dict 를 넓게 수집."""
    if isinstance(data, list):
        return [p for p in data if isinstance(p, dict)]
    if not isinstance(data, dict):
        return []
    bucket: List[Dict[str, Any]] = []
    _extend_project_dicts_from_nested(data, bucket)
    inner = _unwrap_result(data)
    if isinstance(inner, dict):
        _extend_project_dicts_from_nested(inner, bucket)
    return bucket


def meissa_list_projects(access_token: str) -> List[Dict[str, Any]]:
    merged: Dict[Any, Dict[str, Any]] = {}

    management_payload: Optional[Any] = None
    for path in (
        "/api/v4/project/management",
        "/api/v3/projects",
        "/api/v4/projects",
    ):
        raw = _meissa_get_soft(path, access_token)
        if raw is None:
            continue
        if path == "/api/v4/project/management":
            management_payload = raw
        projects = _project_list_from_management_payload(raw) if path == "/api/v4/project/management" else []
        if not projects:
            projects = _raw_project_dicts_from_api_payload(raw)
        for p in projects:
            row = _normalize_project_row(p)
            if row:
                merged[row["id"]] = row
        if path == "/api/v4/project/management" and not projects and isinstance(raw, dict):
            logger.info(
                "Meissa management: no project list parsed; top_keys=%s result_type=%s",
                list(raw.keys())[:20],
                type(raw.get("result")).__name__,
            )

    data_m = management_payload
    data_h = _meissa_get_soft("/api/v4/folder/organization/project/hierarchy", access_token)
    if data_h is not None:
        inner_h = _unwrap_result(data_h)
        for p in _collect_project_dicts_from_tree(inner_h):
            row = _normalize_project_row(p)
            if not row:
                continue
            pid = row["id"]
            if pid in merged:
                cur = merged[pid]
                if cur.get("snapshotCount") is None and row.get("snapshotCount") is not None:
                    cur["snapshotCount"] = row["snapshotCount"]
                if not cur.get("latestTakeDate") and row.get("latestTakeDate"):
                    cur["latestTakeDate"] = row["latestTakeDate"]
                if cur.get("name") == str(pid) and row.get("name") != str(pid):
                    cur["name"] = row["name"]
            else:
                merged[pid] = row

    if not merged and data_m is None and data_h is None:
        raise ValueError(
            "Meissa 프로젝트 API(/api/v4/project/management 등)를 불러오지 못했습니다. "
            "액세스 토큰이 만료됐거나 네트워크·차단 문제일 수 있습니다. 다시 로그인해 보세요."
        )

    return list(merged.values())


def meissa_list_zones(access_token: str, project_id: Any) -> List[Dict[str, Any]]:
    pid = str(project_id).strip()
    if not pid:
        return []
    data = _meissa_get(f"/api/v3/projects/{pid}/zones", access_token)
    if isinstance(data, list):
        zones = data
    else:
        inner = _unwrap_result(data)
        zones = inner.get("results") or inner.get("zones") or inner.get("zoneList") or []
    if not isinstance(zones, list):
        return []
    out: List[Dict[str, Any]] = []
    for z in zones:
        if not isinstance(z, dict):
            continue
        zid = z.get("id")
        if zid is None:
            continue
        out.append(
            {
                "id": zid,
                "name": z.get("name") or z.get("title") or str(zid),
                "raw": z,
            }
        )
    return out


# 드론/현장 스냅샷은 API·버전마다 필드명이 달라질 수 있음 (camel/snake/중첩).
_SNAPSHOT_DATE_KEYS: Tuple[str, ...] = (
    "shotAt",
    "shot_at",
    "shootAt",
    "shoot_at",
    "capturedAt",
    "captured_at",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
    "snapshotDate",
    "snapshot_date",
    "shootingDate",
    "shooting_date",
    "takeDate",
    "take_date",
    "flightDate",
    "flight_date",
    "droneShotAt",
    "drone_shot_at",
    "processedAt",
    "processed_at",
    "startAt",
    "start_at",
    "endAt",
    "end_at",
    "baseDate",
    "base_date",
    "date",
    "shootTime",
    "shoot_time",
    "takenAt",
    "taken_at",
    "displayTakeDate",
    "display_take_date",
    "takeDateText",
    "take_date_text",
    "formattedDate",
    "formatted_date",
    "dateText",
    "date_text",
    "shootDate",
    "shoot_date",
    "photoDate",
    "photo_date",
    "captureDate",
    "capture_date",
    "captured_date",
    "latestTakeDate",
    "latest_take_date",
    "workDate",
    "work_date",
    "missionDate",
    "mission_date",
)

_RE_DATE_ISO_IN_TEXT = re.compile(
    r"(?P<y>\d{4})\s*년\s*(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일"
)
_RE_DATE_DASH = re.compile(r"\b(?P<y>\d{4})[-/](?P<m>\d{1,2})[-/](?P<d>\d{1,2})\b")


def _snapshot_nested_dicts(s: Dict[str, Any]) -> List[Dict[str, Any]]:
    """스냅샷 루트와 흔한 중첩 객체를 합쳐 날짜 필드를 찾는다."""
    layers: List[Dict[str, Any]] = [s]
    for key in (
        "snapshot",
        "data",
        "meta",
        "detail",
        "attributes",
        "drone",
        "flight",
        "info",
        "result",
        "droneSnapshot",
        "drone_snapshot",
        "processing",
        "droneData",
        "drone_data",
        "resource",
    ):
        nested = s.get(key)
        if isinstance(nested, dict):
            layers.append(nested)
    return layers


def _iso_date_from_ts_seconds_kst(ts: float) -> Optional[str]:
    """한국 서비스 기준 촬영일(자정 경계)."""
    if ZoneInfo is None:
        return None
    try:
        dt = datetime.fromtimestamp(ts, tz=ZoneInfo("Asia/Seoul"))
        return dt.strftime("%Y-%m-%d")
    except (OSError, ValueError, OverflowError):
        return None


def _time_hhmm_from_ts_seconds_kst(ts: float) -> str:
    if ZoneInfo is None:
        return ""
    try:
        dt = datetime.fromtimestamp(ts, tz=ZoneInfo("Asia/Seoul"))
        return dt.strftime("%H:%M")
    except (OSError, ValueError, OverflowError):
        return ""


def _date_iso_from_scalar(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str):
        t = v.strip()
        if len(t) >= 10:
            head = t[:10].replace("/", "-")
            if head[4:5] == "-" and head[7:8] == "-":
                try:
                    y, mo, d = int(head[0:4]), int(head[5:7]), int(head[8:10])
                    if 1 <= mo <= 12 and 1 <= d <= 31:
                        return f"{y:04d}-{mo:02d}-{d:02d}"
                except ValueError:
                    pass
        parsed = _date_iso_from_free_text(t)
        if parsed:
            return parsed
    if isinstance(v, (int, float)) and v > 1e11:
        sec = v / 1000.0
        return _iso_date_from_ts_seconds_kst(sec) or _iso_date_from_ts_seconds(sec)
    if isinstance(v, (int, float)) and 1e8 < v < 1e11:
        return _iso_date_from_ts_seconds_kst(float(v)) or _iso_date_from_ts_seconds(float(v))
    return None


def _date_iso_from_free_text(text: str) -> Optional[str]:
    if not text or not isinstance(text, str):
        return None
    m = _RE_DATE_ISO_IN_TEXT.search(text)
    if m:
        y, mo, d = int(m.group("y")), int(m.group("m")), int(m.group("d"))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    m2 = _RE_DATE_DASH.search(text)
    if m2:
        y, mo, d = int(m2.group("y")), int(m2.group("m")), int(m2.group("d"))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


def _snapshot_sort_date(s: Dict[str, Any]) -> str:
    for layer in _snapshot_nested_dicts(s):
        for key in _SNAPSHOT_DATE_KEYS:
            v = layer.get(key)
            if v is None or v == "":
                continue
            return str(v)[:48]
    return ""


def _iso_date_from_ts_seconds(ts: float) -> Optional[str]:
    try:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (OSError, ValueError, OverflowError):
        return None


def _time_hhmm_from_ts_seconds(ts: float) -> str:
    try:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        return dt.strftime("%H:%M")
    except (OSError, ValueError, OverflowError):
        return ""


def _date_iso_from_snapshot(s: Dict[str, Any]) -> Optional[str]:
    for layer in _snapshot_nested_dicts(s):
        for key in _SNAPSHOT_DATE_KEYS:
            d = _date_iso_from_scalar(layer.get(key))
            if d:
                return d
    sk = _snapshot_sort_date(s)
    if isinstance(sk, str) and len(sk) >= 10:
        d = _date_iso_from_scalar(sk)
        if d:
            return d
    for layer in _snapshot_nested_dicts(s):
        for nk in ("name", "title", "description", "label", "memo", "note", "displayName", "display_name"):
            t = layer.get(nk)
            if isinstance(t, str) and t.strip():
                d = _date_iso_from_free_text(t)
                if d:
                    return d
    return None


def _deep_find_date_iso(obj: Any, depth: int = 0, max_depth: int = 10) -> Optional[str]:
    """목록 JSON 어딘가에만 있는 촬영일 문자열/타임스탬프를 재귀 탐색."""
    if depth > max_depth:
        return None
    d = _date_iso_from_scalar(obj)
    if d:
        return d
    if isinstance(obj, str) and len(obj) <= 240:
        hit = _date_iso_from_free_text(obj)
        if hit:
            return hit
    if isinstance(obj, dict):
        for _k, v in obj.items():
            if isinstance(v, str) and len(v) > 800:
                continue
            found = _deep_find_date_iso(v, depth + 1, max_depth)
            if found:
                return found
    if isinstance(obj, list):
        for it in obj[:100]:
            found = _deep_find_date_iso(it, depth + 1, max_depth)
            if found:
                return found
    return None


def _fetch_snapshot_detail_for_date(access_token: str, zid: str, sid: Any) -> Optional[str]:
    """웹 카드의 '2025년 4월 8일' 등이 목록에 없을 때 상세 API에서만 오는 경우."""
    sid_s = str(sid).strip()
    if not sid_s:
        return None
    paths = (
        f"/api/v3/zones/{zid}/snapshots/{sid_s}",
        f"/api/v3/snapshots/{sid_s}",
        f"/api/v4/zones/{zid}/snapshots/{sid_s}",
        f"/api/v4/zones/{zid}/snapshot/{sid_s}",
        f"/api/v4/snapshots/{sid_s}",
        f"/api/v4/snapshot/{sid_s}",
    )
    for path in paths:
        raw = _meissa_get_soft(path, access_token)
        if not isinstance(raw, dict):
            continue
        merged = dict(raw)
        inner = raw.get("result")
        if isinstance(inner, dict):
            merged = _merge_snapshot_dicts_for_date(merged, inner)
        unwrapped = _unwrap_result(raw)
        if isinstance(unwrapped, dict) and unwrapped is not raw:
            merged = _merge_snapshot_dicts_for_date(merged, unwrapped)
        found = _date_iso_from_snapshot(merged) or _deep_find_date_iso(merged)
        if found:
            return found
    return None


def _format_date_label_ko(date_iso: Optional[str]) -> str:
    """cloud.meissa.ai 카드 상단 날짜(예: 2025년 4월 8일)와 동일한 표기."""
    if not date_iso or len(date_iso) < 10:
        return ""
    try:
        y = int(date_iso[0:4])
        mo = int(date_iso[5:7])
        da = int(date_iso[8:10])
        return f"{y}년 {mo}월 {da}일"
    except (ValueError, IndexError):
        return ""


def _snapshot_time_hint(s: Dict[str, Any]) -> str:
    """같은 날 여러 건일 때 옵션 구분용 시각(UTC 기준 HH:mm 또는 문자열 T 이후)."""
    for layer in _snapshot_nested_dicts(s):
        for key in ("shotAt", "shot_at", "shootAt", "shoot_at", "capturedAt", "captured_at", "createdAt", "created_at"):
            v = layer.get(key)
            if isinstance(v, str) and len(v) >= 16:
                part = v[11:16]
                if part and part[2:3] == ":":
                    return part
            if isinstance(v, (int, float)) and v > 1e11:
                sec = v / 1000.0
                t = _time_hhmm_from_ts_seconds_kst(sec) or _time_hhmm_from_ts_seconds(sec)
                if t:
                    return t
            if isinstance(v, (int, float)) and 1e8 < v < 1e11:
                t = _time_hhmm_from_ts_seconds_kst(float(v)) or _time_hhmm_from_ts_seconds(float(v))
                if t:
                    return t
    return ""


def _snapshot_subtitle_from_raw(s: Dict[str, Any], primary_title: str) -> str:
    """웹 본문에 가까운 보조 설명(있을 때만). 제목과 같으면 생략."""
    for key in ("description", "memo", "note", "subTitle", "subtitle", "content", "remark"):
        v = s.get(key)
        if not isinstance(v, str):
            continue
        t = v.strip()
        if t and t != primary_title:
            return t
    return ""


def _snapshot_rows_from_api_payload(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []
    inner = _unwrap_result(data)
    for candidate in (data, inner if isinstance(inner, dict) else {}):
        if not isinstance(candidate, dict):
            continue
        for key in ("results", "snapshots", "snapshotList", "snapshot_list", "content", "items", "list", "data"):
            block = candidate.get(key)
            if isinstance(block, list):
                return [x for x in block if isinstance(x, dict)]
            if isinstance(block, dict) and isinstance(block.get("content"), list):
                return [x for x in block["content"] if isinstance(x, dict)]
    return []


def _merge_snapshot_value_empty(v: Any) -> bool:
    return v is None or v == "" or v == []


def _merge_snapshot_dicts_for_date(base: Dict[str, Any], alt: Dict[str, Any]) -> Dict[str, Any]:
    """alt 에만 있는 날짜·이름 필드를 base에 채운다(드론 스냅샷 v3/v4 차이)."""
    merged = dict(base)
    for k, v in alt.items():
        if not _merge_snapshot_value_empty(merged.get(k)):
            continue
        if not _merge_snapshot_value_empty(v):
            merged[k] = v
    return merged


def meissa_list_snapshots(access_token: str, zone_id: Any) -> List[Dict[str, Any]]:
    zid = str(zone_id).strip()
    if not zid:
        return []
    data = _meissa_get(f"/api/v3/zones/{zid}/snapshots", access_token)
    snaps = _snapshot_rows_from_api_payload(data)
    alt_lists: List[List[Dict[str, Any]]] = []
    for path in (
        f"/api/v4/zones/{zid}/snapshots",
        f"/api/v4/zone/{zid}/snapshots",
        f"/api/v4/zones/{zid}/snapshot/list",
    ):
        raw = _meissa_get_soft(path, access_token)
        if raw is None:
            continue
        rows = _snapshot_rows_from_api_payload(raw)
        if rows:
            alt_lists.append(rows)
    alt_by_id: Dict[Any, Dict[str, Any]] = {}
    for alt in alt_lists:
        for row in alt:
            if not isinstance(row, dict) or row.get("id") is None:
                continue
            sid = row["id"]
            if sid not in alt_by_id:
                alt_by_id[sid] = row
            else:
                alt_by_id[sid] = _merge_snapshot_dicts_for_date(alt_by_id[sid], row)

    seen_ids = {s.get("id") for s in snaps if isinstance(s, dict) and s.get("id") is not None}
    for sid, row in alt_by_id.items():
        if sid not in seen_ids:
            snaps.append(row)
            seen_ids.add(sid)

    prelim: List[Dict[str, Any]] = []
    for s in snaps:
        if not isinstance(s, dict):
            continue
        sid = s.get("id")
        if sid is None:
            continue
        merged = _merge_snapshot_dicts_for_date(s, alt_by_id.get(sid, {}))
        label_date = _snapshot_sort_date(merged)
        name = merged.get("name") or merged.get("title") or label_date or str(sid)
        primary_title = str(name).strip() or str(sid)
        date_iso = _date_iso_from_snapshot(merged) or _deep_find_date_iso(merged)
        prelim.append(
            {
                "merged": merged,
                "sid": sid,
                "primary_title": primary_title,
                "label_date": label_date,
                "date_iso": date_iso,
            }
        )

    cap = _meissa_snapshot_detail_fetch_cap()
    to_detail = [p for p in prelim if not p["date_iso"]][:cap]
    if to_detail:
        workers = min(10, max(1, len(to_detail)))

        def _one(pack: Dict[str, Any]) -> Tuple[Any, Optional[str]]:
            return pack["sid"], _fetch_snapshot_detail_for_date(access_token, zid, pack["sid"])

        patches: Dict[Any, str] = {}
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_one, p) for p in to_detail]
            for fut in as_completed(futures):
                try:
                    sid_got, d_iso = fut.result()
                    if d_iso:
                        patches[sid_got] = d_iso
                except Exception as exc:
                    logger.debug("Meissa snapshot detail fetch failed: %s", exc)
        for p in prelim:
            sid = p["sid"]
            if not p["date_iso"] and sid in patches:
                p["date_iso"] = patches[sid]

    out: List[Dict[str, Any]] = []
    missing_date: List[Any] = []
    sample_keys_no_date: List[str] = []
    for p in prelim:
        merged = p["merged"]
        sid = p["sid"]
        primary_title = p["primary_title"]
        label_date = p["label_date"]
        date_iso = p["date_iso"]
        date_label_ko = _format_date_label_ko(date_iso) if date_iso else ""
        subtitle = _snapshot_subtitle_from_raw(merged, primary_title)
        time_hint = _snapshot_time_hint(merged)
        sort_key = label_date or (date_iso or "") or str(sid)
        if not date_iso:
            missing_date.append(sid)
            if not sample_keys_no_date:
                sample_keys_no_date = [str(k) for k in list(merged.keys())[:25]]
        out.append(
            {
                "id": sid,
                "name": primary_title,
                "dateHint": date_iso,
                "dateLabelKo": date_label_ko or None,
                "timeHint": time_hint or None,
                "subtitle": subtitle or None,
                "sortKey": sort_key,
                "raw": merged,
            }
        )
    if missing_date:
        logger.info(
            "Meissa zone %s: %s snapshots without parseable date (sample ids=%s, sample keys=%s)",
            zid,
            len(missing_date),
            missing_date[:8],
            sample_keys_no_date,
        )
    out.sort(key=lambda x: (x.get("sortKey") or "", str(x.get("id"))), reverse=True)
    return out


def _resource_rows_from_api_payload(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []
    inner = _unwrap_result(data)
    for candidate in (data, inner if isinstance(inner, dict) else {}):
        if not isinstance(candidate, dict):
            continue
        for key in ("results", "resources", "resourceList", "resource_list", "content", "items", "list", "data"):
            block = candidate.get(key)
            if isinstance(block, list):
                return [x for x in block if isinstance(x, dict)]
            if isinstance(block, dict) and isinstance(block.get("content"), list):
                return [x for x in block["content"] if isinstance(x, dict)]
    return []


def _resource_url(r: Dict[str, Any]) -> Optional[str]:
    for key in ("url", "fileUrl", "file_url", "downloadUrl", "download_url", "resourceUrl", "resource_url"):
        v = r.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _resource_name(r: Dict[str, Any], rid: Any) -> str:
    for key in ("name", "title", "filename", "fileName", "resourceName"):
        v = r.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return f"resource-{rid}"


def _resource_type(r: Dict[str, Any]) -> str:
    for key in ("type", "resourceType", "resource_type", "fileType", "file_type"):
        v = r.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return "UNKNOWN"


def _extract_inline_xyz_points(payload: Any, cap: int = 15000) -> List[List[float]]:
    out: List[List[float]] = []
    visited = set()

    def walk(node: Any, depth: int) -> None:
        if len(out) >= cap or depth > 8:
            return
        node_id = id(node)
        if node_id in visited:
            return
        visited.add(node_id)

        if isinstance(node, dict):
            x = node.get("x")
            y = node.get("y")
            z = node.get("z")
            if all(v is not None for v in (x, y, z)):
                try:
                    fx = float(x)
                    fy = float(y)
                    fz = float(z)
                    if all(map(lambda n: abs(n) < 1e12, (fx, fy, fz))):
                        out.append([fx, fy, fz])
                        if len(out) >= cap:
                            return
                except (TypeError, ValueError):
                    pass
            for v in node.values():
                walk(v, depth + 1)
            return

        if isinstance(node, list):
            if len(node) >= 3 and all(isinstance(node[i], (int, float)) for i in (0, 1, 2)):
                try:
                    fx = float(node[0])
                    fy = float(node[1])
                    fz = float(node[2])
                    if all(map(lambda n: abs(n) < 1e12, (fx, fy, fz))):
                        out.append([fx, fy, fz])
                        if len(out) >= cap:
                            return
                except (TypeError, ValueError):
                    pass
            for it in node:
                walk(it, depth + 1)
            return

    walk(payload, 0)
    return out


def meissa_list_snapshot_resources(access_token: str, snapshot_id: Any) -> List[Dict[str, Any]]:
    sid = str(snapshot_id).strip()
    if not sid:
        return []
    token_key = (access_token or "").strip()[:20]
    cache_key = f"{token_key}:{sid}"
    now = time.time()
    cached = _RESOURCE_LIST_CACHE.get(cache_key)
    if cached and (now - cached[0]) <= _RESOURCE_LIST_CACHE_TTL_SEC:
        return cached[1]

    paths = [
        f"/api/v3/snapshots/{sid}/resources",
        f"/api/v4/snapshots/{sid}/resources",
        f"/api/v4/resource/snapshot/{sid}",
    ]
    all_rows: List[Dict[str, Any]] = []
    for path in paths:
        raw = _meissa_get_soft(path, access_token)
        if raw is None:
            continue
        rows = _resource_rows_from_api_payload(raw)
        if rows:
            all_rows.extend(rows)

    if not all_rows:
        return []

    out: List[Dict[str, Any]] = []
    seen = set()
    for r in all_rows:
        rid = r.get("id") or r.get("resourceId") or r.get("resource_id")
        key = str(rid) if rid is not None else f"name:{_resource_name(r, '?')}"
        if key in seen:
            continue
        seen.add(key)
        points = _extract_inline_xyz_points(r, cap=12000)
        out.append(
            {
                "id": rid,
                "name": _resource_name(r, rid),
                "type": _resource_type(r),
                "url": _resource_url(r),
                "inlinePoints": points if points else [],
                "raw": r,
            }
        )
    _RESOURCE_LIST_CACHE[cache_key] = (now, out)
    return out


def _resource_detail_candidates(snapshot_id: str, resource_id: str) -> List[str]:
    return [
        f"/api/v3/snapshots/{snapshot_id}/resources/{resource_id}",
        f"/api/v4/resources/{resource_id}",
        f"/api/v4/resource/{resource_id}",
    ]


def _resource_urls_from_payload(payload: Any) -> List[str]:
    urls: List[str] = []

    def add(v: Any) -> None:
        if isinstance(v, str) and v.strip() and v.strip().startswith("http"):
            u = v.strip()
            if u not in urls:
                urls.append(u)

    if isinstance(payload, dict):
        for key in (
            "url",
            "fileUrl",
            "file_url",
            "downloadUrl",
            "download_url",
            "resourceUrl",
            "resource_url",
            "signedUrl",
            "signed_url",
            "thumbnailUrl",
            "thumbnail_url",
            "thumbUrl",
            "thumb_url",
            "previewUrl",
            "preview_url",
            "imageUrl",
            "image_url",
        ):
            add(payload.get(key))
        for v in payload.values():
            if isinstance(v, dict):
                add(v.get("url"))
                add(v.get("downloadUrl"))
            elif isinstance(v, list):
                for it in v:
                    if isinstance(it, dict):
                        add(it.get("url"))
                        add(it.get("downloadUrl"))
    return urls


def _fetch_resource_bytes(
    url: str, access_token: str, max_bytes: int = 8 * 1024 * 1024
) -> Tuple[bytes, str, int, Optional[int], bool]:
    headers_try = [
        {"Accept": "*/*", "User-Agent": _MEISSA_UA},
        {**_auth_header(access_token), "Accept": "*/*", "User-Agent": _MEISSA_UA},
    ]
    last_err: Optional[Exception] = None
    for headers in headers_try:
        try:
            with requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, stream=True) as resp:
                if resp.status_code >= 400:
                    continue
                chunks: List[bytes] = []
                total = 0
                for chunk in resp.iter_content(chunk_size=65536):
                    if not chunk:
                        continue
                    chunks.append(chunk)
                    total += len(chunk)
                    if total >= max_bytes:
                        break
                body = b"".join(chunks)
                ctype = (resp.headers.get("content-type") or "").lower()
                content_len = None
                try:
                    cl = (resp.headers.get("content-length") or "").strip()
                    content_len = int(cl) if cl else None
                except Exception:
                    content_len = None
                truncated = bool(content_len and total < content_len) or total >= max_bytes
                return body, ctype, total, content_len, truncated
        except Exception as exc:
            last_err = exc
    if last_err:
        raise ValueError(f"리소스 다운로드 실패: {last_err}")
    raise ValueError("리소스 다운로드 실패")


def _fetch_resource_range(url: str, access_token: str, start: int, end: int) -> bytes:
    if start < 0 or end < start:
        return b""
    headers_try = [
        {"Accept": "*/*", "User-Agent": _MEISSA_UA, "Range": f"bytes={start}-{end}"},
        {**_auth_header(access_token), "Accept": "*/*", "User-Agent": _MEISSA_UA, "Range": f"bytes={start}-{end}"},
    ]
    for headers in headers_try:
        try:
            with requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, stream=True) as resp:
                if resp.status_code not in (200, 206):
                    continue
                chunks: List[bytes] = []
                total = 0
                for chunk in resp.iter_content(chunk_size=65536):
                    if not chunk:
                        continue
                    chunks.append(chunk)
                    total += len(chunk)
                    if total > (end - start + 1):
                        break
                body = b"".join(chunks)
                return body[: (end - start + 1)]
        except Exception:
            continue
    return b""


def _las_header_info(body: bytes) -> Optional[Dict[str, Any]]:
    try:
        if len(body) < 227 or not body.startswith(b"LASF"):
            return None
        point_data_offset = struct.unpack_from("<I", body, 96)[0]
        point_format_raw = struct.unpack_from("<B", body, 104)[0]
        point_record_length = struct.unpack_from("<H", body, 105)[0]
        legacy_point_count = struct.unpack_from("<I", body, 107)[0]
        x_scale = struct.unpack_from("<d", body, 131)[0]
        y_scale = struct.unpack_from("<d", body, 139)[0]
        z_scale = struct.unpack_from("<d", body, 147)[0]
        x_offset = struct.unpack_from("<d", body, 155)[0]
        y_offset = struct.unpack_from("<d", body, 163)[0]
        z_offset = struct.unpack_from("<d", body, 171)[0]
        if point_record_length < 12 or point_data_offset <= 0:
            return None
        return {
            "point_data_offset": int(point_data_offset),
            "point_format": int(point_format_raw & 0x3F),
            "point_record_length": int(point_record_length),
            "legacy_point_count": int(legacy_point_count),
            "x_scale": float(x_scale),
            "y_scale": float(y_scale),
            "z_scale": float(z_scale),
            "x_offset": float(x_offset),
            "y_offset": float(y_offset),
            "z_offset": float(z_offset),
        }
    except Exception:
        return None


def _parse_las_records_from_bytes(
    chunk: bytes,
    info: Dict[str, Any],
    limit: int,
    step: int = 1,
) -> Tuple[List[List[float]], List[List[float]]]:
    rec_len = int(info["point_record_length"])
    x_scale = float(info["x_scale"])
    y_scale = float(info["y_scale"])
    z_scale = float(info["z_scale"])
    x_offset = float(info["x_offset"])
    y_offset = float(info["y_offset"])
    z_offset = float(info["z_offset"])
    available_records = len(chunk) // rec_len
    if available_records <= 0:
        return [], []
    pformat = int(info.get("point_format", 0))
    rgb_offset_by_format = {2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30}
    rgb_off = rgb_offset_by_format.get(pformat, -1)
    out: List[List[float]] = []
    cols: List[List[float]] = []
    i = 0
    step = max(1, int(step))
    while i < available_records:
        p0 = i * rec_len
        p1 = p0 + 12
        if p1 > len(chunk):
            break
        try:
            ix, iy, iz = struct.unpack_from("<iii", chunk, p0)
            x = float(ix) * x_scale + x_offset
            y = float(iy) * y_scale + y_offset
            z = float(iz) * z_scale + z_offset
        except Exception:
            i += step
            continue
        if all(abs(v) < 1e12 for v in (x, y, z)):
            out.append([x, y, z])
            # 가능한 경우 LAS RGB를 사용, 없으면 intensity 기반 회색으로 대체
            gray = 0.75
            if p0 + 14 <= len(chunk):
                try:
                    intensity = struct.unpack_from("<H", chunk, p0 + 12)[0]
                    gray = max(0.2, min(1.0, intensity / 65535.0))
                except Exception:
                    pass
            if rgb_off >= 0 and p0 + rgb_off + 6 <= len(chunk):
                try:
                    rr, gg, bb = struct.unpack_from("<HHH", chunk, p0 + rgb_off)
                    cols.append([max(0.0, min(1.0, rr / 65535.0)), max(0.0, min(1.0, gg / 65535.0)), max(0.0, min(1.0, bb / 65535.0))])
                except Exception:
                    cols.append([gray, gray, gray])
            else:
                cols.append([gray, gray, gray])
            if len(out) >= limit:
                break
        i += step
    return out, cols


def _decode_text_bytes(body: bytes) -> Optional[str]:
    for enc in ("utf-8", "utf-8-sig", "cp949", "euc-kr", "latin-1"):
        try:
            return body.decode(enc, errors="strict")
        except Exception:
            continue
    return None


def _sample_points_from_rows(rows: List[List[str]], limit: int) -> List[List[float]]:
    if not rows:
        return []
    header = [c.strip().lower() for c in rows[0]]
    x_idx = y_idx = z_idx = -1
    for i, h in enumerate(header):
        hs = h.replace(" ", "").replace("_", "")
        if x_idx < 0 and hs in ("x", "east", "easting", "lon", "lng"):
            x_idx = i
        if y_idx < 0 and hs in ("y", "north", "northing", "lat"):
            y_idx = i
        if z_idx < 0 and hs in ("z", "elev", "elevation", "height", "alt"):
            z_idx = i
    start = 1 if x_idx >= 0 and y_idx >= 0 and z_idx >= 0 else 0
    if x_idx < 0 or y_idx < 0 or z_idx < 0:
        x_idx, y_idx, z_idx = 0, 1, 2

    out: List[List[float]] = []
    for row in rows[start:]:
        if len(row) <= max(x_idx, y_idx, z_idx):
            continue
        try:
            x = float(str(row[x_idx]).strip())
            y = float(str(row[y_idx]).strip())
            z = float(str(row[z_idx]).strip())
        except Exception:
            continue
        if all(abs(v) < 1e12 for v in (x, y, z)):
            out.append([x, y, z])
            if len(out) >= limit:
                break
    return out


def _parse_points_from_text_body(text: str, limit: int) -> Tuple[List[List[float]], str]:
    # 1) JSON 우선
    try:
        data = json.loads(text)
        pts = _extract_inline_xyz_points(data, cap=limit)
        if pts:
            return pts, "json-inline"
    except Exception:
        pass

    # 2) CSV/TSV
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return [], "empty"
    delim = "\t" if "\t" in lines[0] else ","
    reader = csv.reader(lines, delimiter=delim)
    rows = [r for r in reader]
    pts = _sample_points_from_rows(rows, limit)
    if pts:
        return pts, "csv-tsv"

    # 3) 공백 구분 xyz
    out: List[List[float]] = []
    for ln in lines:
        parts = re.split(r"\s+", ln.strip())
        if len(parts) < 3:
            continue
        try:
            x = float(parts[0])
            y = float(parts[1])
            z = float(parts[2])
        except Exception:
            continue
        if all(abs(v) < 1e12 for v in (x, y, z)):
            out.append([x, y, z])
            if len(out) >= limit:
                break
    return out, "xyz-text"


def _parse_ascii_ply_points(text: str, limit: int) -> List[List[float]]:
    lines = text.splitlines()
    if not lines or not lines[0].strip().lower().startswith("ply"):
        return []
    if not any("format ascii" in ln.lower() for ln in lines[:30]):
        return []
    end_idx = -1
    vertex_count = 0
    prop_names: List[str] = []
    in_vertex = False
    for i, ln in enumerate(lines[:300]):
        low = ln.strip().lower()
        if low.startswith("element vertex "):
            try:
                vertex_count = int(low.split()[-1])
            except Exception:
                vertex_count = 0
            in_vertex = True
            prop_names = []
            continue
        if in_vertex and low.startswith("element ") and not low.startswith("element vertex "):
            in_vertex = False
        if in_vertex and low.startswith("property "):
            parts = low.split()
            if len(parts) >= 3:
                prop_names.append(parts[-1])
        if low == "end_header":
            end_idx = i
            break
    if end_idx < 0:
        return []
    def pidx(name: str) -> int:
        try:
            return prop_names.index(name)
        except ValueError:
            return -1
    xi, yi, zi = pidx("x"), pidx("y"), pidx("z")
    if min(xi, yi, zi) < 0:
        return []
    out: List[List[float]] = []
    start = end_idx + 1
    max_rows = vertex_count if vertex_count > 0 else len(lines) - start
    for ln in lines[start : start + max_rows]:
        parts = re.split(r"\s+", ln.strip())
        if len(parts) <= max(xi, yi, zi):
            continue
        try:
            x = float(parts[xi]); y = float(parts[yi]); z = float(parts[zi])
        except Exception:
            continue
        out.append([x, y, z])
        if len(out) >= limit:
            break
    return out


def _parse_binary_ply_points(body: bytes, limit: int) -> List[List[float]]:
    if not body.startswith(b"ply"):
        return []
    header_end = body.find(b"end_header")
    if header_end < 0:
        return []
    lf_pos = body.find(b"\n", header_end)
    if lf_pos < 0:
        return []
    header_bytes = body[: lf_pos + 1]
    try:
        header_text = header_bytes.decode("ascii", errors="strict")
    except Exception:
        return []

    header_lines = [ln.strip().lower() for ln in header_text.splitlines() if ln.strip()]
    little = "format binary_little_endian 1.0" in header_lines
    big = "format binary_big_endian 1.0" in header_lines
    if not little and not big:
        return []

    type_map = {
        "char": "b",
        "int8": "b",
        "uchar": "B",
        "uint8": "B",
        "short": "h",
        "int16": "h",
        "ushort": "H",
        "uint16": "H",
        "int": "i",
        "int32": "i",
        "uint": "I",
        "uint32": "I",
        "float": "f",
        "float32": "f",
        "double": "d",
        "float64": "d",
    }
    size_map = {"b": 1, "B": 1, "h": 2, "H": 2, "i": 4, "I": 4, "f": 4, "d": 8}

    vertex_count = 0
    in_vertex = False
    props: List[Tuple[str, str]] = []
    for ln in header_lines:
        if ln.startswith("element vertex "):
            try:
                vertex_count = int(ln.split()[-1])
            except Exception:
                vertex_count = 0
            in_vertex = True
            props = []
            continue
        if in_vertex and ln.startswith("element ") and not ln.startswith("element vertex "):
            in_vertex = False
            continue
        if in_vertex and ln.startswith("property "):
            parts = ln.split()
            if len(parts) == 3 and parts[1] in type_map:
                props.append((parts[2], type_map[parts[1]]))
            elif len(parts) >= 4 and parts[1] == "list":
                return []

    if not props or vertex_count <= 0:
        return []
    name_to_idx = {name: i for i, (name, _) in enumerate(props)}
    if not all(k in name_to_idx for k in ("x", "y", "z")):
        return []
    xi, yi, zi = name_to_idx["x"], name_to_idx["y"], name_to_idx["z"]
    fmts = [fmt for _, fmt in props]
    rec_size = sum(size_map[f] for f in fmts)
    if rec_size <= 0:
        return []

    endian = "<" if little else ">"
    start = lf_pos + 1
    max_rows = min(vertex_count, max(0, (len(body) - start) // rec_size))
    out: List[List[float]] = []
    offset = start
    for _ in range(max_rows):
        rec = body[offset : offset + rec_size]
        offset += rec_size
        vals: List[float] = []
        pos = 0
        for f in fmts:
            sz = size_map[f]
            chunk = rec[pos : pos + sz]
            pos += sz
            try:
                vals.append(float(struct.unpack(endian + f, chunk)[0]))
            except Exception:
                vals = []
                break
        if not vals or len(vals) <= max(xi, yi, zi):
            continue
        x = vals[xi]
        y = vals[yi]
        z = vals[zi]
        if all(abs(v) < 1e12 for v in (x, y, z)):
            out.append([x, y, z])
            if len(out) >= limit:
                break
    return out


def _parse_las_laz_points(body: bytes, limit: int) -> Tuple[List[List[float]], str, List[List[float]]]:
    try:
        import laspy  # type: ignore
    except Exception:
        return [], "laspy-missing", []

    try:
        las = laspy.read(io.BytesIO(body))
        xs = las.x
        ys = las.y
        zs = las.z
        n = len(xs)
        if n <= 0:
            return [], "las-empty", []
        step = max(1, n // max(1, limit))
        out: List[List[float]] = []
        cols: List[List[float]] = []
        has_rgb = hasattr(las, "red") and hasattr(las, "green") and hasattr(las, "blue")
        has_intensity = hasattr(las, "intensity")
        for i in range(0, n, step):
            x = float(xs[i])
            y = float(ys[i])
            z = float(zs[i])
            if all(abs(v) < 1e12 for v in (x, y, z)):
                out.append([x, y, z])
                if has_rgb:
                    try:
                        rr = float(las.red[i]); gg = float(las.green[i]); bb = float(las.blue[i])
                        cols.append([max(0.0, min(1.0, rr / 65535.0)), max(0.0, min(1.0, gg / 65535.0)), max(0.0, min(1.0, bb / 65535.0))])
                    except Exception:
                        cols.append([0.78, 0.78, 0.78])
                elif has_intensity:
                    try:
                        it = float(las.intensity[i])
                        g = max(0.2, min(1.0, it / 65535.0))
                        cols.append([g, g, g])
                    except Exception:
                        cols.append([0.78, 0.78, 0.78])
                else:
                    cols.append([0.78, 0.78, 0.78])
                if len(out) >= limit:
                    break
        return out, "las-laz", cols
    except Exception as exc:
        msg = str(exc).strip().replace("\n", " ")
        if len(msg) > 90:
            msg = msg[:90] + "..."
        if not msg:
            msg = "unknown"
        return [], f"las-read-failed:{msg}", []


def _parse_las_partial_points(body: bytes, limit: int) -> Tuple[List[List[float]], str, List[List[float]]]:
    """
    절단(truncated)된 LAS 바이트에서 가능한 범위까지 점군을 복구.
    - LAS 헤더(스케일/오프셋/포인트 오프셋/레코드 길이)를 읽고
    - 완전한 레코드 개수만큼만 int32 XYZ를 샘플링
    """
    try:
        info = _las_header_info(body)
        if not info:
            return [], "las-partial-invalid", []
        point_data_offset = int(info["point_data_offset"])
        point_record_length = int(info["point_record_length"])
        legacy_point_count = int(info["legacy_point_count"])
        if point_record_length < 12:
            return [], "las-partial-rec-too-small", []
        if point_data_offset <= 0 or point_data_offset >= len(body):
            return [], "las-partial-no-point-range", []

        available_bytes = len(body) - point_data_offset
        available_records = max(0, available_bytes // point_record_length)
        if available_records <= 0:
            return [], "las-partial-no-record", []

        total_records = legacy_point_count if legacy_point_count > 0 else available_records
        usable_records = min(total_records, available_records)
        if usable_records <= 0:
            return [], "las-partial-no-usable", []

        step = max(1, usable_records // max(1, limit))
        slice_bytes = body[point_data_offset : point_data_offset + usable_records * point_record_length]
        out, cols = _parse_las_records_from_bytes(slice_bytes, info, limit, step=step)
        if not out:
            return [], "las-partial-empty", []
        return out, "las-partial", cols
    except Exception as exc:
        msg = str(exc).strip().replace("\n", " ")
        if len(msg) > 90:
            msg = msg[:90] + "..."
        return [], f"las-partial-failed:{msg or 'unknown'}", []


def _sample_las_points_via_ranges(
    *,
    url: str,
    access_token: str,
    header_body: bytes,
    content_length: Optional[int],
    limit: int,
    phase: int = 0,
) -> Tuple[List[List[float]], str, List[List[float]]]:
    info = _las_header_info(header_body)
    if not info:
        return [], "las-range-no-header", []
    if not content_length or content_length <= int(info["point_data_offset"]):
        return [], "las-range-no-length", []

    point_data_offset = int(info["point_data_offset"])
    point_record_length = int(info["point_record_length"])
    total_records = max(0, (content_length - point_data_offset) // point_record_length)
    if total_records <= 0:
        return [], "las-range-no-record", []

    chunks = max(8, min(32, max(8, limit // 1200)))
    recs_per_chunk = max(1200, min(18000, int((limit * 1.8) / chunks)))
    chunk_bytes = recs_per_chunk * point_record_length
    out: List[List[float]] = []
    cols: List[List[float]] = []
    for i in range(chunks):
        # 균등분할 대신 황금비 분산으로 파일 전역에서 샘플링 편향을 줄임
        frac = (i * 0.61803398875 + phase * 0.113) % 1.0
        idx = int(frac * max(0, total_records - 1))
        start = point_data_offset + idx * point_record_length
        end = min(content_length - 1, start + chunk_bytes - 1)
        part = _fetch_resource_range(url, access_token, start, end)
        if len(part) < point_record_length:
            continue
        pts, c = _parse_las_records_from_bytes(
            part,
            info,
            limit=max(1, limit - len(out)),
            step=max(1, recs_per_chunk // 1800),
        )
        if pts:
            out.extend(pts)
            cols.extend(c)
            if len(out) >= limit:
                break
    if not out:
        return [], "las-range-empty", []
    return out[:limit], "las-range-sampled", cols[:limit]


def _merge_points_colors(
    p1: List[List[float]],
    c1: List[List[float]],
    p2: List[List[float]],
    c2: List[List[float]],
    limit: int,
) -> Tuple[List[List[float]], List[List[float]]]:
    out_p: List[List[float]] = []
    out_c: List[List[float]] = []
    seen = set()

    def push(pts: List[List[float]], cols: List[List[float]]) -> None:
        for i, p in enumerate(pts):
            if not isinstance(p, list) or len(p) < 3:
                continue
            x = float(p[0]); y = float(p[1]); z = float(p[2])
            key = (round(x, 3), round(y, 3), round(z, 3))
            if key in seen:
                continue
            seen.add(key)
            out_p.append([x, y, z])
            cc = cols[i] if i < len(cols) and isinstance(cols[i], list) and len(cols[i]) >= 3 else [0.78, 0.78, 0.78]
            out_c.append([float(cc[0]), float(cc[1]), float(cc[2])])
            if len(out_p) >= limit:
                return

    push(p1, c1)
    if len(out_p) < limit:
        push(p2, c2)
    return out_p, out_c


def _file_ext_from_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    base = u.split("?", 1)[0].split("#", 1)[0]
    m = re.search(r"\.([A-Za-z0-9]+)$", base)
    return m.group(1).lower() if m else ""


def meissa_sample_resource_points(
    access_token: str,
    snapshot_id: Any,
    resource_id: Any,
    limit: int = 8000,
    phase: int = 0,
) -> Dict[str, Any]:
    sid = str(snapshot_id).strip()
    rid = str(resource_id).strip()
    if not sid or not rid:
        return {"points": [], "resourceId": rid, "parser": "none", "sourceUrl": None}

    resources = meissa_list_snapshot_resources(access_token, sid)
    matched = None
    for r in resources:
        if str(r.get("id")) == rid:
            matched = r
            break
    if matched is None:
        matched = {"id": rid, "name": f"resource-{rid}", "type": "UNKNOWN", "raw": {}}

    inline = _extract_inline_xyz_points(matched.get("raw"), cap=limit)
    if inline:
        return {
            "points": inline,
            "resourceId": rid,
            "name": matched.get("name"),
            "type": matched.get("type"),
            "parser": "inline-json",
            "sourceUrl": _resource_url(matched) if isinstance(matched, dict) else None,
        }

    urls: List[str] = []
    if isinstance(matched, dict):
        urls.extend(_resource_urls_from_payload(matched))
        raw = matched.get("raw")
        if isinstance(raw, dict):
            urls.extend(_resource_urls_from_payload(raw))

    for path in _resource_detail_candidates(sid, rid):
        detail = _meissa_get_soft(path, access_token)
        if detail is None:
            continue
        urls.extend(_resource_urls_from_payload(detail))
        urls.extend(_resource_urls_from_payload(_unwrap_result(detail)))
        inline2 = _extract_inline_xyz_points(detail, cap=limit)
        if inline2:
            return {
                "points": inline2,
                "resourceId": rid,
                "name": matched.get("name"),
                "type": matched.get("type"),
                "parser": "detail-inline-json",
                "sourceUrl": urls[0] if urls else None,
            }

    # dedupe urls
    dedup_urls: List[str] = []
    for u in urls:
        if u not in dedup_urls:
            dedup_urls.append(u)

    parser_hint = "unparsed"
    for url in dedup_urls[:5]:
        ext = _file_ext_from_url(url)
        resource_type = str(matched.get("type") or "").upper() if isinstance(matched, dict) else ""
        is_point_cloudish = ext in ("las", "laz") or ("POINT" in resource_type and "CLOUD" in resource_type)
        if is_point_cloudish:
            # phase 0: 빠른 첫 화면(작은 다운로드), 이후 phase에서 range 샘플로 점진 누적
            if phase <= 0:
                max_bytes = 24 * 1024 * 1024
            elif phase <= 3:
                max_bytes = 4 * 1024 * 1024
            else:
                max_bytes = 2 * 1024 * 1024
        else:
            max_bytes = 12 * 1024 * 1024
        try:
            body, ctype, downloaded_bytes, content_length, truncated = _fetch_resource_bytes(
                url, access_token, max_bytes=max_bytes
            )
        except Exception as exc:
            logger.debug("Meissa resource download failed url=%s err=%s", url, exc)
            continue

        pts_ply_binary = _parse_binary_ply_points(body, limit)
        if pts_ply_binary:
            return {
                "points": pts_ply_binary,
                "resourceId": rid,
                "name": matched.get("name"),
                "type": matched.get("type"),
                "parser": "ply-binary",
                "sourceUrl": url,
                "contentType": ctype,
                "downloadBytes": downloaded_bytes,
                "contentLength": content_length,
                "truncated": truncated,
            }

        if ext in ("las", "laz") or body.startswith(b"LASF") or is_point_cloudish:
            pts_las, las_parser, las_colors = _parse_las_laz_points(body, limit)
            if pts_las:
                return {
                    "points": pts_las,
                    "pointColors": las_colors if las_colors and len(las_colors) == len(pts_las) else [],
                    "resourceId": rid,
                    "name": matched.get("name"),
                    "type": matched.get("type"),
                    "parser": las_parser,
                    "sourceUrl": url,
                    "contentType": ctype,
                    "downloadBytes": downloaded_bytes,
                    "contentLength": content_length,
                    "truncated": truncated,
                }
            if truncated and body.startswith(b"LASF"):
                pts_partial, partial_parser, partial_colors = _parse_las_partial_points(body, limit)
                pts_range: List[List[float]] = []
                range_parser = "las-range-skip"
                range_colors: List[List[float]] = []
                if content_length and content_length > downloaded_bytes * 2:
                    pts_range, range_parser, range_colors = _sample_las_points_via_ranges(
                        url=url,
                        access_token=access_token,
                        header_body=body,
                        content_length=content_length,
                        limit=limit,
                        phase=max(0, int(phase)),
                    )
                if pts_range and pts_partial:
                    merged_p, merged_c = _merge_points_colors(pts_range, range_colors, pts_partial, partial_colors, limit=limit)
                    return {
                        "points": merged_p,
                        "pointColors": merged_c if merged_c and len(merged_c) == len(merged_p) else [],
                        "resourceId": rid,
                        "name": matched.get("name"),
                        "type": matched.get("type"),
                        "parser": "las-range+partial",
                        "sourceUrl": url,
                        "contentType": ctype,
                        "downloadBytes": downloaded_bytes,
                        "contentLength": content_length,
                        "truncated": truncated,
                    }
                if pts_range:
                    return {
                        "points": pts_range,
                        "pointColors": range_colors if range_colors and len(range_colors) == len(pts_range) else [],
                        "resourceId": rid,
                        "name": matched.get("name"),
                        "type": matched.get("type"),
                        "parser": range_parser,
                        "sourceUrl": url,
                        "contentType": ctype,
                        "downloadBytes": downloaded_bytes,
                        "contentLength": content_length,
                        "truncated": truncated,
                    }
                if pts_partial:
                    return {
                        "points": pts_partial,
                        "pointColors": partial_colors if partial_colors and len(partial_colors) == len(pts_partial) else [],
                        "resourceId": rid,
                        "name": matched.get("name"),
                        "type": matched.get("type"),
                        "parser": partial_parser,
                        "sourceUrl": url,
                        "contentType": ctype,
                        "downloadBytes": downloaded_bytes,
                        "contentLength": content_length,
                        "truncated": truncated,
                    }
            if truncated and las_parser.startswith("las-read-failed"):
                parser_hint = f"{las_parser}:download-truncated"
            else:
                parser_hint = las_parser

        text = _decode_text_bytes(body)
        if text is not None:
            pts_ply = _parse_ascii_ply_points(text, limit)
            if pts_ply:
                return {
                    "points": pts_ply,
                    "resourceId": rid,
                    "name": matched.get("name"),
                    "type": matched.get("type"),
                    "parser": "ply-ascii",
                    "sourceUrl": url,
                    "contentType": ctype,
                    "downloadBytes": downloaded_bytes,
                    "contentLength": content_length,
                    "truncated": truncated,
                }
            pts_text, parser_name = _parse_points_from_text_body(text, limit)
            if pts_text:
                return {
                    "points": pts_text,
                    "resourceId": rid,
                    "name": matched.get("name"),
                    "type": matched.get("type"),
                    "parser": parser_name,
                    "sourceUrl": url,
                    "contentType": ctype,
                    "downloadBytes": downloaded_bytes,
                    "contentLength": content_length,
                    "truncated": truncated,
                }

    return {
        "points": [],
        "resourceId": rid,
        "name": matched.get("name"),
        "type": matched.get("type"),
        "parser": parser_hint,
        "sourceUrl": dedup_urls[0] if dedup_urls else None,
    }


def _meissa_resource_is_point_cloud_candidate(row: Dict[str, Any]) -> bool:
    t = str(row.get("type") or "").upper()
    name = str(row.get("name") or "").lower()
    if "POINT" in t and "CLOUD" in t:
        return True
    if "LAS" in t or "LAZ" in t or "POINT_CLOUD" in t.replace(" ", "_"):
        return True
    for ext in (".las", ".laz", ".ply"):
        if ext in name:
            return True
    pts = row.get("inlinePoints")
    return isinstance(pts, list) and len(pts) >= 1


def meissa_nearest_z_xy_from_resources(
    access_token: str,
    snapshot_id: Any,
    x: float,
    y: float,
    *,
    resource_id: Optional[str] = None,
    limit: int = 8000,
    max_phases: int = 4,
) -> Dict[str, Any]:
    """
    스냅샷 포인트클라우드(또는 지정 resource)에서 샘플된 점들 중 (x,y)에 가장 가까운 점의 Z를 반환.
    meissa_sample_resource_points와 동일하게 상한 샘플만 보므로 대용량 LAS에서는 오차 가능.
    x,y는 포인트클라우드와 같은 좌표계여야 한다.
    """
    sx = float(x)
    sy = float(y)
    if not (math.isfinite(sx) and math.isfinite(sy)):
        return {"ok": False, "message": "x, y가 유효한 숫자가 아닙니다."}

    sid = str(snapshot_id).strip()
    resources = meissa_list_snapshot_resources(access_token, sid)
    if not resources:
        return {"ok": False, "message": "스냅샷 리소스 목록이 비어 있습니다."}

    candidates: List[Dict[str, Any]] = []
    rid_filter = (resource_id or "").strip()
    if rid_filter:
        for r in resources:
            if str(r.get("id")) == rid_filter:
                candidates.append(r)
                break
        if not candidates:
            return {"ok": False, "message": f"resource_id={rid_filter} 를 목록에서 찾지 못했습니다."}
    else:
        candidates = [r for r in resources if _meissa_resource_is_point_cloud_candidate(r)]
        if not candidates:
            candidates = list(resources)

    phases = max(1, min(8, int(max_phases)))
    best_d2: Optional[float] = None
    best_z: Optional[float] = None
    best_rid: Optional[str] = None
    best_phase = 0
    best_parser = ""
    tried: List[Dict[str, Any]] = []

    for r in candidates:
        rid = r.get("id")
        if rid is None:
            continue
        rid_s = str(rid)
        for phase in range(phases):
            sample = meissa_sample_resource_points(access_token, sid, rid_s, limit=limit, phase=phase)
            pts = sample.get("points") if isinstance(sample.get("points"), list) else []
            tried.append(
                {
                    "resourceId": rid_s,
                    "phase": phase,
                    "pointCount": len(pts),
                    "parser": sample.get("parser"),
                }
            )
            if not pts:
                break
            for pt in pts:
                if not isinstance(pt, (list, tuple)) or len(pt) < 3:
                    continue
                try:
                    px = float(pt[0])
                    py = float(pt[1])
                    pz = float(pt[2])
                except (TypeError, ValueError):
                    continue
                if not (math.isfinite(px) and math.isfinite(py) and math.isfinite(pz)):
                    continue
                d2 = (px - sx) ** 2 + (py - sy) ** 2
                if best_d2 is None or d2 < best_d2:
                    best_d2 = d2
                    best_z = pz
                    best_rid = rid_s
                    best_phase = phase
                    best_parser = str(sample.get("parser") or "")

    if best_d2 is None or best_z is None:
        return {
            "ok": False,
            "message": "샘플 점에서 유효한 최근접을 찾지 못했습니다. resource_id를 지정하거나 포인트 리소스를 확인하세요.",
            "tried": tried,
        }

    return {
        "ok": True,
        "z": best_z,
        "distancePlanar": math.sqrt(best_d2),
        "resourceId": best_rid,
        "phase": best_phase,
        "parser": best_parser,
        "tried": tried,
        "note": "포인트클라우드와 동일 CRS의 (x,y)여야 합니다. 샘플 상한으로 인해 DSM 픽과 다를 수 있습니다.",
    }


def meissa_get_snapshot_overlay_2d_binary(access_token: str, snapshot_id: Any) -> Dict[str, Any]:
    sid = str(snapshot_id).strip()
    if not sid:
        return {"ok": False, "message": "snapshot_id가 비어 있습니다."}

    resources = meissa_list_snapshot_resources(access_token, sid)
    if not resources:
        return {"ok": False, "message": "리소스가 없습니다."}

    preferred = sorted(
        resources,
        key=lambda r: (
            0
            if "ORTHO" in str(r.get("type", "")).upper()
            else 1
            if "RASTER" in str(r.get("type", "")).upper()
            else 2
        ),
    )
    allowed_ext = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}
    allowed_mime = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"}
    max_attempt_logs = 96
    dropped_attempt_logs = 0
    debug: Dict[str, Any] = {
        "snapshotId": sid,
        "resourceCount": len(resources),
        "resourceCandidates": min(24, len(preferred)),
        "allowedExt": sorted(allowed_ext),
        "allowedMime": sorted(allowed_mime),
        "attempts": [],
    }

    for r in preferred[:24]:
        rid = r.get("id")
        urls: List[str] = []
        urls.extend(_resource_urls_from_payload(r))
        raw = r.get("raw")
        if isinstance(raw, dict):
            urls.extend(_resource_urls_from_payload(raw))
        if rid is not None:
            for path in _resource_detail_candidates(sid, str(rid)):
                d = _meissa_get_soft(path, access_token)
                if d is None:
                    continue
                urls.extend(_resource_urls_from_payload(d))
                urls.extend(_resource_urls_from_payload(_unwrap_result(d)))
        dedup = []
        for u in urls:
            if u not in dedup:
                dedup.append(u)

        for u in dedup[:8]:
            ext = _file_ext_from_url(u)
            attempt: Dict[str, Any] = {
                "resourceId": rid,
                "resourceType": r.get("type"),
                "resourceName": r.get("name"),
                "url": u,
                "ext": ext or None,
            }
            try:
                body, ctype, downloaded, content_len, truncated = _fetch_resource_bytes(
                    u, access_token, max_bytes=96 * 1024 * 1024
                )
            except Exception as exc:
                attempt["ok"] = False
                attempt["error"] = str(exc)[:260] if str(exc) else "download-failed"
                if len(debug["attempts"]) < max_attempt_logs:
                    debug["attempts"].append(attempt)
                else:
                    dropped_attempt_logs += 1
                continue
            mime = (ctype or "").split(";")[0].strip().lower()
            is_allowed = (mime in allowed_mime) or (ext in allowed_ext)
            attempt.update(
                {
                    "ok": True,
                    "contentType": ctype or None,
                    "mime": mime or None,
                    "bytes": downloaded,
                    "contentLength": content_len,
                    "truncated": bool(truncated),
                    "allowed": bool(is_allowed),
                }
            )
            reject_reasons: List[str] = []
            if not is_allowed:
                reject_reasons.append("mime-ext-not-allowed")
            if not body:
                reject_reasons.append("empty-body")
            if truncated:
                reject_reasons.append("download-truncated")
            if reject_reasons:
                attempt["reject"] = ",".join(reject_reasons)
                if len(debug["attempts"]) < max_attempt_logs:
                    debug["attempts"].append(attempt)
                else:
                    dropped_attempt_logs += 1
                continue
            mime_for_data_url = mime if mime in allowed_mime else ("image/jpeg" if ext in {"jpg", "jpeg"} else f"image/{ext}")
            attempt["accept"] = True
            if len(debug["attempts"]) < max_attempt_logs:
                debug["attempts"].append(attempt)
            else:
                dropped_attempt_logs += 1
            if dropped_attempt_logs:
                debug["droppedAttempts"] = dropped_attempt_logs
            return {
                "ok": True,
                "snapshotId": sid,
                "resourceId": rid,
                "resourceType": r.get("type"),
                "resourceName": r.get("name"),
                "sourceUrl": u,
                "contentType": mime_for_data_url,
                "bytes": downloaded,
                "contentLength": content_len,
                "body": body,
                "debug": debug,
            }
    if dropped_attempt_logs:
        debug["droppedAttempts"] = dropped_attempt_logs
    return {
        "ok": False,
        "snapshotId": sid,
        "message": "2D로 표시 가능한 이미지 리소스를 찾지 못했습니다.",
        "debug": debug,
    }


def meissa_get_snapshot_overlay_2d_image(access_token: str, snapshot_id: Any) -> Dict[str, Any]:
    raw = meissa_get_snapshot_overlay_2d_binary(access_token, snapshot_id)
    if not raw.get("ok"):
        return raw
    body = raw.get("body") if isinstance(raw, dict) else None
    if not isinstance(body, (bytes, bytearray)) or not body:
        return {"ok": False, "snapshotId": str(snapshot_id), "message": "2D 이미지 바이트가 비어 있습니다."}
    out = dict(raw)
    out.pop("body", None)
    out["dataUrl"] = f"data:{out.get('contentType','image/png')};base64,{base64.b64encode(bytes(body)).decode('ascii')}"
    return out


def _safe_float(v: Any) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if not (abs(f) < 1e15):
        return None
    return f


def _bbox_from_dict(d: Dict[str, Any]) -> Optional[Dict[str, float]]:
    aliases = {
        "minx": ("minx", "xmin", "left", "west"),
        "miny": ("miny", "ymin", "bottom", "south"),
        "maxx": ("maxx", "xmax", "right", "east"),
        "maxy": ("maxy", "ymax", "top", "north"),
    }
    lower = {str(k).lower(): v for k, v in d.items()}
    vals: Dict[str, float] = {}
    for out_key, keys in aliases.items():
        for k in keys:
            fv = _safe_float(lower.get(k))
            if fv is not None:
                vals[out_key] = fv
                break
    if len(vals) == 4 and vals["maxx"] > vals["minx"] and vals["maxy"] > vals["miny"]:
        return {"minX": vals["minx"], "minY": vals["miny"], "maxX": vals["maxx"], "maxY": vals["maxy"]}
    return None


_RE_EPSG = re.compile(r"epsg[:\s/_-]*(\d{4,6})", re.IGNORECASE)


def _crs_string(v: Any) -> Optional[str]:
    if isinstance(v, int):
        if 1000 <= v <= 999999:
            return f"EPSG:{v}"
        return None
    if not isinstance(v, str):
        return None
    t = v.strip()
    if not t:
        return None
    m = _RE_EPSG.search(t)
    if m:
        return f"EPSG:{m.group(1)}"
    if t.upper().startswith("EPSG:"):
        return t.upper()
    return None


def _collect_overlay_georef_candidates(obj: Any, out: List[Dict[str, Any]], path: str = "root", depth: int = 0) -> None:
    if depth > 8:
        return
    if isinstance(obj, dict):
        bbox = _bbox_from_dict(obj)
        if not bbox:
            for k in ("bbox", "bounds", "extent", "envelope"):
                v = obj.get(k)
                if isinstance(v, dict):
                    bbox = _bbox_from_dict(v)
                    if bbox:
                        break
                if isinstance(v, (list, tuple)) and len(v) == 4:
                    nums = [_safe_float(x) for x in v]
                    if all(n is not None for n in nums):
                        minx, miny, maxx, maxy = nums  # type: ignore[misc]
                        if maxx > minx and maxy > miny:
                            bbox = {"minX": float(minx), "minY": float(miny), "maxX": float(maxx), "maxY": float(maxy)}
                            break
        crs = None
        for k in ("crs", "srs", "projection", "epsg", "coordinateSystem", "coordinate_system"):
            if k in obj:
                crs = _crs_string(obj.get(k))
                if crs:
                    break
        width = _safe_float(obj.get("width") or obj.get("imageWidth") or obj.get("image_width"))
        height = _safe_float(obj.get("height") or obj.get("imageHeight") or obj.get("image_height"))
        if bbox or crs or (width and height):
            cand: Dict[str, Any] = {"path": path}
            if bbox:
                cand["bbox"] = bbox
            if crs:
                cand["crs"] = crs
            if width and width > 0:
                cand["width"] = int(width)
            if height and height > 0:
                cand["height"] = int(height)
            out.append(cand)
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                _collect_overlay_georef_candidates(v, out, f"{path}.{k}", depth + 1)
        return
    if isinstance(obj, list):
        for i, it in enumerate(obj[:80]):
            if isinstance(it, (dict, list)):
                _collect_overlay_georef_candidates(it, out, f"{path}[{i}]", depth + 1)


def meissa_get_snapshot_overlay_2d_georef(access_token: str, snapshot_id: Any) -> Dict[str, Any]:
    sid = str(snapshot_id).strip()
    if not sid:
        return {"ok": False, "snapshotId": sid, "message": "snapshot_id가 비어 있습니다."}
    resources = meissa_list_snapshot_resources(access_token, sid)
    if not resources:
        return {"ok": False, "snapshotId": sid, "message": "리소스가 없습니다."}
    preferred = sorted(
        resources,
        key=lambda r: (
            0 if "ORTHO" in str(r.get("type", "")).upper() else 1 if "RASTER" in str(r.get("type", "")).upper() else 2
        ),
    )
    candidates: List[Dict[str, Any]] = []
    for r in preferred[:24]:
        rid = r.get("id")
        payloads: List[Tuple[str, Any]] = [("resource", r)]
        raw = r.get("raw")
        if isinstance(raw, dict):
            payloads.append(("resource.raw", raw))
        if rid is not None:
            for p in _resource_detail_candidates(sid, str(rid)):
                detail = _meissa_get_soft(p, access_token)
                if detail is None:
                    continue
                payloads.append((f"detail:{p}", detail))
                payloads.append((f"detailResult:{p}", _unwrap_result(detail)))
        for source, payload in payloads:
            tmp: List[Dict[str, Any]] = []
            _collect_overlay_georef_candidates(payload, tmp, path=source)
            for c in tmp:
                c["resourceId"] = rid
                c["resourceType"] = r.get("type")
                c["resourceName"] = r.get("name")
                candidates.append(c)
    if not candidates:
        return {
            "ok": False,
            "snapshotId": sid,
            "message": "overlay 2D georef 후보를 찾지 못했습니다.",
            "candidates": [],
        }
    uniq: Dict[str, Dict[str, Any]] = {}
    for c in candidates:
        bbox = c.get("bbox") or {}
        key = "|".join(
            [
                str(c.get("crs") or ""),
                str(round(float(bbox.get("minX", 0)), 6)),
                str(round(float(bbox.get("minY", 0)), 6)),
                str(round(float(bbox.get("maxX", 0)), 6)),
                str(round(float(bbox.get("maxY", 0)), 6)),
                str(int(c.get("width") or 0)),
                str(int(c.get("height") or 0)),
            ]
        )
        if key not in uniq:
            uniq[key] = c
    dedup = list(uniq.values())
    def score(c: Dict[str, Any]) -> int:
        s = 0
        if isinstance(c.get("bbox"), dict):
            s += 5
        if c.get("crs"):
            s += 3
        if c.get("width") and c.get("height"):
            s += 2
        t = str(c.get("resourceType") or "").upper()
        if "ORTHO" in t:
            s += 2
        elif "RASTER" in t:
            s += 1
        return s
    dedup.sort(key=score, reverse=True)
    best = dedup[0]
    return {
        "ok": True,
        "snapshotId": sid,
        "georef": best,
        "candidates": dedup[:20],
    }


def _meissa_orthophoto_max_download_bytes() -> int:
    """Carta orthophoto.tif 상한. 기본 450MB — 현장 정사가 150MB를 넘는 경우가 많음."""
    try:
        raw_b = (os.environ.get("MEISSA_ORTHOPHOTO_MAX_DOWNLOAD_BYTES") or "").strip()
        if raw_b:
            v = int(raw_b)
            return max(32 * 1024 * 1024, min(3 * 1024 * 1024 * 1024, v))
        mb = int(os.environ.get("MEISSA_ORTHOPHOTO_MAX_DOWNLOAD_MB", "450"))
        return max(64, min(3072, mb)) * 1024 * 1024
    except ValueError:
        return 450 * 1024 * 1024


def _meissa_orthophoto_preview_max_edge() -> int:
    """
    브라우저에 보낼 PNG longest-edge 상한. 기본 4096 — 저사양·프록시 타임아웃 방지(다운로드·디코드 부담 감소).
    고해상도가 필요하면 MEISSA_ORTHOPHOTO_PREVIEW_MAX_EDGE 또는 API 쿼리 max_edge (최대 16384).
    """
    try:
        v = int((os.environ.get("MEISSA_ORTHOPHOTO_PREVIEW_MAX_EDGE") or "4096").strip())
        return max(2048, min(16384, v))
    except ValueError:
        return 4096


def meissa_orthophoto_effective_preview_edge(query_max_edge: Optional[int]) -> int:
    """쿼리 max_edge 가 있으면 우선(1024~16384), 없으면 환경변수 기본."""
    if query_max_edge is not None:
        try:
            v = int(query_max_edge)
            return max(1024, min(16384, v))
        except (TypeError, ValueError):
            pass
    return _meissa_orthophoto_preview_max_edge()


def _meissa_orthophoto_passthrough_max_bytes() -> int:
    """IHDR 패스스루 허용 최대 다운로드 크기(초과 시 Pillow로 edge_lim까지 재샘플·재압축)."""
    try:
        mb = int((os.environ.get("MEISSA_ORTHOPHOTO_PASSTHROUGH_MAX_MB") or "48").strip())
        return max(8, min(180, mb)) * 1024 * 1024
    except ValueError:
        return 48 * 1024 * 1024


def _meissa_orthophoto_export_raw_passthrough_max_bytes() -> int:
    """
    Carta export PNG 를 바이트 그대로 돌려줄 때 허용 최대 크기(기본 220MB).
    MEISSA_ORTHOPHOTO_EXPORT_RAW_MAX_MB 로 조절(최대 450 권장 상한은 ortho 다운로드 cap 과 맞출 것).
    """
    try:
        mb = int((os.environ.get("MEISSA_ORTHOPHOTO_EXPORT_RAW_MAX_MB") or "220").strip())
        return max(48, min(450, mb)) * 1024 * 1024
    except ValueError:
        return 220 * 1024 * 1024


def _meissa_orthophoto_tif_fallback_enabled() -> bool:
    """기본 False: 최대 export PNG 만 사용. TIF 폴백은 MEISSA_ORTHOPHOTO_TIF_FALLBACK=1 일 때만."""
    return (os.environ.get("MEISSA_ORTHOPHOTO_TIF_FALLBACK") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _meissa_orthophoto_resize_export_png_enabled() -> bool:
    """
    True: Carta export orthophoto_*.png 를 서버에서 edge_lim 으로 축소(Pillow).
    기본 False: 다운로드한 PNG 바이트를 디코드 없이 그대로 응답(원본·빠름).
    켜기: MEISSA_ORTHOPHOTO_RESIZE_EXPORT_PNG=1
    """
    return (os.environ.get("MEISSA_ORTHOPHOTO_RESIZE_EXPORT_PNG") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _meissa_orthophoto_export_png_filenames() -> List[str]:
    """
    Carta export/orthophoto 사전 렌더 PNG.
    기본: 가장 큰 orthophoto_25000x.png 만 요청(한 번의 GET, 작은 파일 순회 없음).
    MEISSA_ORTHOPHOTO_EXPORT_PNG_NAMES 로 쉼표 구분 목록 재정의 가능(예: 여러 해상도 폴백).
    """
    raw = (os.environ.get("MEISSA_ORTHOPHOTO_EXPORT_PNG_NAMES") or "").strip()
    if raw:
        return [p.strip() for p in raw.split(",") if p.strip()]
    return ["orthophoto_25000x.png"]


def _meissa_carta_stream_to_tempfile(
    url: str,
    headers: Dict[str, str],
    cap: int,
    suffix: str,
    timeout: Tuple[int, int],
) -> Tuple[str, Any]:
    """
    ("ok", temp_path, total_bytes) 성공
    ("http", status_code) HTTP 오류(본문 미저장)
    ("oversize",) cap 초과
    ("error", msg) 기타 예외
    """
    tpath: Optional[str] = None
    try:
        tf = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        tpath = tf.name
        total = 0
        with requests.get(url, headers=headers, timeout=timeout, stream=True) as resp:
            if resp.status_code >= 400:
                tf.close()
                try:
                    os.unlink(tpath)
                except OSError:
                    pass
                return ("http", int(resp.status_code))
            for chunk in resp.iter_content(chunk_size=262144):
                if not chunk:
                    continue
                tf.write(chunk)
                total += len(chunk)
                if total > cap:
                    tf.close()
                    try:
                        os.unlink(tpath)
                    except OSError:
                        pass
                    return ("oversize",)
        tf.close()
        if total < 32:
            try:
                os.unlink(tpath)
            except OSError:
                pass
            return ("error", "empty-or-tiny-body")
        return ("ok", tpath, total)
    except Exception as exc:
        if tpath:
            try:
                os.unlink(tpath)
            except OSError:
                pass
        return ("error", str(exc)[:400])


def _png_ihdr_dimensions(file_path: str) -> Optional[Tuple[int, int]]:
    """PNG 시그니처+IHDR만 읽어 크기 확인(전체 디코드 없음)."""
    try:
        with open(file_path, "rb") as f:
            if f.read(8) != b"\x89PNG\r\n\x1a\n":
                return None
            chunk_len = int.from_bytes(f.read(4), "big")
            ctype = f.read(4)
            if ctype != b"IHDR" or chunk_len < 13:
                return None
            data = f.read(13)
            if len(data) < 13:
                return None
            w = int.from_bytes(data[0:4], "big")
            h = int.from_bytes(data[4:8], "big")
            if w <= 0 or h <= 0 or w > 65536 or h > 65536:
                return None
            return (w, h)
    except OSError:
        return None


def _meissa_carta_export_head_ok(url: str, headers: Dict[str, str], timeout: Tuple[int, int]) -> bool:
    """
    GET 전 HEAD로 리소스 존재 여부만 확인(404 시 대용량 바디 수신 생략).
    405·네트워크 오류 시 True(곧바로 GET으로 폴백). 끄기: MEISSA_ORTHOPHOTO_SKIP_HEAD=1
    """
    if (os.environ.get("MEISSA_ORTHOPHOTO_SKIP_HEAD") or "").strip().lower() in ("1", "true", "yes", "on"):
        return True
    try:
        r = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)
        sc = int(r.status_code)
        if sc == 200:
            return True
        # 401/403: HEAD 거부·권한 표시만 하고 GET 은 될 수 있음 → GET 시도
        if sc in (404, 410):
            return False
        if sc in (401, 403):
            return True
        if sc == 405:
            return True
        if 300 <= sc < 400:
            return True
        if sc >= 500:
            return True
        return sc < 400
    except requests.RequestException:
        return True


def _meissa_orthophoto_request_headers(access_token: str) -> List[Dict[str, str]]:
    """JWT가 있으면 인증 헤더를 먼저 시도(익명 403/404 라운드트립 감소)."""
    rows: List[Dict[str, str]] = []
    if str(access_token or "").strip():
        rows.append({**_auth_header(access_token), "Accept": "*/*", "User-Agent": _MEISSA_UA})
    rows.append({"Accept": "*/*", "User-Agent": _MEISSA_UA})
    return rows


def _meissa_orthophoto_preview_from_resource_urls(
    access_token: str,
    snapshot_id: str,
    edge_lim: int,
    cap: int,
    pt_cap: int,
    headers_try: List[Dict[str, str]],
    timeout: Tuple[int, int],
) -> Optional[Dict[str, Any]]:
    """
    export/orthophoto 고정 경로가 실패할 때,
    snapshot resources/detail에 담긴 서명 URL(다운로드 버튼 링크)을 추적해 PNG를 가져온다.
    """
    sid = str(snapshot_id).strip()
    if not sid:
        return None
    try:
        resources = meissa_list_snapshot_resources(access_token, sid)
    except Exception:
        resources = []
    if not resources:
        return None

    candidates: List[Tuple[int, str]] = []
    seen_urls: set[str] = set()
    for r in resources[:32]:
        rid = r.get("id")
        name_l = str(r.get("name") or "").lower()
        type_l = str(r.get("type") or "").lower()
        urls: List[str] = []
        urls.extend(_resource_urls_from_payload(r))
        raw = r.get("raw")
        if isinstance(raw, dict):
            urls.extend(_resource_urls_from_payload(raw))
        if rid is not None:
            for path in _resource_detail_candidates(sid, str(rid)):
                d = _meissa_get_soft(path, access_token)
                if d is None:
                    continue
                urls.extend(_resource_urls_from_payload(d))
                urls.extend(_resource_urls_from_payload(_unwrap_result(d)))
        for u in urls:
            us = str(u or "").strip()
            if not us or not us.startswith("http") or us in seen_urls:
                continue
            seen_urls.add(us)
            lu = us.lower()
            score = 0
            if "/export/orthophoto/" in lu:
                score += 40
            if "orthophoto_25000x.png" in lu:
                score += 60
            if "orthophoto" in lu:
                score += 20
            if "signature=" in lu and "expires=" in lu:
                score += 10
            if "orthophoto" in name_l:
                score += 8
            if "ortho" in type_l or "raster" in type_l:
                score += 4
            if score > 0:
                candidates.append((score, us))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)

    for _, url in candidates[:16]:
        for headers in headers_try:
            res = _meissa_carta_stream_to_tempfile(url, headers, cap, ".png", timeout)
            tag = res[0]
            if tag != "ok":
                continue
            path, total = res[1], int(res[2])
            pstr = str(path)
            wh = _png_ihdr_dimensions(pstr)
            preview = _meissa_raster_file_to_preview_png_bytes(
                pstr,
                edge_lim,
                source_label="resource-signed-url",
                png_passthrough=bool(wh and max(wh) <= edge_lim and total <= pt_cap),
            )
            if preview and preview.get("ok"):
                return {
                    "ok": True,
                    "snapshotId": sid,
                    "body": preview["body"],
                    "width": preview["width"],
                    "height": preview["height"],
                    "source": f"{preview.get('source', 'resource-signed-url')}",
                    "sourceUrl": url,
                }
    return None


def _meissa_orthophoto_pillow_resample() -> Any:
    """MEISSA_ORTHOPHOTO_RESAMPLE: quality(기본·LANCZOS)|bicubic|fast — 화질 우선, 속도는 fast."""
    from PIL import Image

    mode = (os.environ.get("MEISSA_ORTHOPHOTO_RESAMPLE") or "quality").strip().lower()
    try:
        R = Image.Resampling  # type: ignore[attr-defined]
        if mode in ("quality", "lanczos", "slow"):
            return R.LANCZOS
        if mode == "bicubic":
            return R.BICUBIC
        return R.BILINEAR
    except AttributeError:
        if mode in ("quality", "lanczos", "slow"):
            return Image.LANCZOS  # type: ignore[attr-defined]
        if mode == "bicubic":
            return Image.BICUBIC  # type: ignore[attr-defined]
        return Image.BILINEAR  # type: ignore[attr-defined]


def _meissa_orthophoto_png_save_kwargs() -> Dict[str, Any]:
    """
    optimize=True 는 대형 PNG에서 수십 초까지 걸릴 수 있음. 기본은 끔 + 낮은 zlib 레벨.
    MEISSA_ORTHOPHOTO_PNG_OPTIMIZE=1 로 켜기, MEISSA_ORTHOPHOTO_PNG_COMPRESS_LEVEL=0~9
    """
    want_opt = (os.environ.get("MEISSA_ORTHOPHOTO_PNG_OPTIMIZE") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    try:
        lvl = int((os.environ.get("MEISSA_ORTHOPHOTO_PNG_COMPRESS_LEVEL") or "4").strip())
    except ValueError:
        lvl = 4
    lvl = max(0, min(9, lvl))
    return {"format": "PNG", "optimize": want_opt, "compress_level": lvl}


def _meissa_orthophoto_png_save_kwargs_for_edge(edge_lim: int) -> Dict[str, Any]:
    """longest edge 가 작은 응답(스플래시·저해상)은 zlib·리샘플 부하를 더 줄인다."""
    kw = _meissa_orthophoto_png_save_kwargs()
    if int(edge_lim) <= 2048:
        kw["optimize"] = False
        kw["compress_level"] = min(int(kw.get("compress_level") or 4), 2)
    return kw


def _meissa_raster_file_to_preview_png_bytes(
    file_path: str,
    edge_lim: int,
    *,
    source_label: str,
    png_passthrough: bool,
    unlink_input: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    임시 파일( PNG 또는 TIF )을 열어 미리보기 PNG 바이트 생성.
    png_passthrough: PNG이고 longest edge <= edge_lim 이면 재인코딩 없이 원본 바이트 반환.
    unlink_input: False면 처리 후에도 입력 파일을 삭제하지 않음(디스크 full 캐시 등).
    """
    try:
        from PIL import Image
    except ImportError:
        return None

    old_max = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = None
    im = None
    try:
        try:
            im = Image.open(file_path)
            if getattr(im, "n_frames", 1) > 1:
                im.seek(0)
            im.load()
        except Exception:
            if unlink_input:
                try:
                    os.unlink(file_path)
                except OSError:
                    pass
            return None

        w, h = im.size
        if (
            png_passthrough
            and file_path.lower().endswith(".png")
            and max(w, h) <= edge_lim
        ):
            try:
                im.close()
            except Exception:
                pass
            im = None
            try:
                with open(file_path, "rb") as rf:
                    body = rf.read()
            finally:
                if unlink_input:
                    try:
                        os.unlink(file_path)
                    except OSError:
                        pass
            if not body or len(body) < 64:
                return None
            return {
                "ok": True,
                "body": body,
                "width": w,
                "height": h,
                "source": source_label,
            }

        try:
            rgba = im.convert("RGBA")
        except Exception:
            try:
                rgba = im.convert("RGB").convert("RGBA")
            except Exception as exc:
                mode_s = str(getattr(im, "mode", "?"))
                try:
                    im.close()
                except Exception:
                    pass
                im = None
                if unlink_input:
                    try:
                        os.unlink(file_path)
                    except OSError:
                        pass
                return {
                    "ok": False,
                    "message": f"이미지 모드 변환 실패({mode_s}): {exc}",
                }

        try:
            im.close()
        except Exception:
            pass
        im = None

        el = int(edge_lim)
        if el <= 2048:
            from PIL import Image as _PIL_Image

            try:
                resample = _PIL_Image.Resampling.BILINEAR  # type: ignore[attr-defined]
            except AttributeError:
                resample = _PIL_Image.BILINEAR  # type: ignore[attr-defined]
        else:
            resample = _meissa_orthophoto_pillow_resample()
        rgba.thumbnail((edge_lim, edge_lim), resample)

        out = io.BytesIO()
        save_kw = _meissa_orthophoto_png_save_kwargs_for_edge(el)
        rgba.save(out, **save_kw)
        png_bytes = out.getvalue()
        if unlink_input:
            try:
                os.unlink(file_path)
            except OSError:
                pass
        return {
            "ok": True,
            "body": png_bytes,
            "width": rgba.width,
            "height": rgba.height,
            "source": source_label,
        }
    except Exception:
        if unlink_input:
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except OSError:
                pass
        return None
    finally:
        Image.MAX_IMAGE_PIXELS = old_max
        if im is not None:
            try:
                im.close()
            except Exception:
                pass


def meissa_get_carta_orthophoto_preview_png(
    access_token: str,
    project_id: Any,
    snapshot_id: Any,
    *,
    max_download_bytes: Optional[int] = None,
    max_edge: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Carta `export/orthophoto/` 에서 기본적으로 **가장 큰 사전 렌더 PNG 한 종류만** JWT로 받습니다.
    `max_edge` 보다 큰 원본은 Pillow로 longest-edge 기준 축소해 응답(미리보기가 수백 MB를 받지 않게 함).
    원본이 `max_edge` 이하이면 IHDR 확인 후 바이트 그대로 반환 가능. 용량 상한은 MEISSA_ORTHOPHOTO_EXPORT_RAW_MAX_MB.
    디스크 full_export 캐시가 있으면 Carta 재다운로드 없이 동일 스냅샷의 다른 max_edge 요청을 처리합니다.
    실패 시 `orthophoto.tif` 폴백은 기본 끔 — `MEISSA_ORTHOPHOTO_TIF_FALLBACK=1` 일 때만 시도.
    다른 PNG 목록·순서는 MEISSA_ORTHOPHOTO_EXPORT_PNG_NAMES. 서버에서 축소 동작을 바꾸려면 MEISSA_ORTHOPHOTO_RESIZE_EXPORT_PNG=1.
    """
    try:
        __import__("PIL.Image", fromlist=["Image"])
    except ImportError:
        return {
            "ok": False,
            "message": "서버에 Pillow가 없습니다. pip install Pillow 후 백엔드를 다시 시작하세요.",
            "snapshotId": str(snapshot_id).strip(),
            "projectId": str(project_id).strip(),
        }

    pid = str(project_id).strip()
    sid = str(snapshot_id).strip()
    if not pid or not sid:
        return {"ok": False, "message": "project_id 또는 snapshot_id가 비어 있습니다.", "snapshotId": sid, "projectId": pid}

    edge_lim = int(max_edge) if max_edge is not None else _meissa_orthophoto_preview_max_edge()

    cap = int(max_download_bytes) if max_download_bytes is not None else _meissa_orthophoto_max_download_bytes()

    resize_export = _meissa_orthophoto_resize_export_png_enabled()
    export_raw_cap = _meissa_orthophoto_export_raw_passthrough_max_bytes()
    pt_cap = _meissa_orthophoto_passthrough_max_bytes()

    headers_try = _meissa_orthophoto_request_headers(access_token)
    last_status: Optional[int] = None
    last_err: Optional[str] = None
    ortho_timeout = (60, 900)
    head_timeout = (5, 20)
    base_export = f"https://cs.carta.is/carta/workspace/{quote(pid, safe='')}/{quote(sid, safe='')}/export/orthophoto/"


    # full_export 디스크 캐시가 있으면 Carta GET 생략(저해상·고해상 재요청 속도).
    if not resize_export:
        cached_full_path = meissa_orthophoto_disk_cache_full_export_path_if_valid(pid, sid)
        if cached_full_path:
            wh_c = _png_ihdr_dimensions(cached_full_path)
            if wh_c:
                try:
                    fsz = os.path.getsize(cached_full_path)
                except OSError:
                    fsz = 0
                if fsz >= 64:
                    if max(wh_c) <= edge_lim and fsz <= export_raw_cap:
                        body_c = b""
                        try:
                            with open(cached_full_path, "rb") as rf:
                                body_c = rf.read()
                        except OSError:
                            body_c = b""
                        if (
                            body_c
                            and len(body_c) > 64
                            and body_c.startswith(b"\x89PNG\r\n\x1a\n")
                        ):
                            return {
                                "ok": True,
                                "snapshotId": sid,
                                "projectId": pid,
                                "body": body_c,
                                "width": wh_c[0],
                                "height": wh_c[1],
                                "source": "disk-cache-full-export",
                                "disk_cache_slot": "full_export",
                            }
                    preview_dc = _meissa_raster_file_to_preview_png_bytes(
                        cached_full_path,
                        edge_lim,
                        source_label="disk-cache-full-export",
                        png_passthrough=bool(max(wh_c) <= edge_lim and fsz <= pt_cap),
                        unlink_input=False,
                    )
                    if preview_dc and preview_dc.get("ok"):
                        return {
                            "ok": True,
                            "snapshotId": sid,
                            "projectId": pid,
                            "body": preview_dc["body"],
                            "width": preview_dc["width"],
                            "height": preview_dc["height"],
                            "source": preview_dc.get("source", "disk-cache-full-export"),
                        }

    for png_name in _meissa_orthophoto_export_png_filenames():
        png_url = f"{base_export}{png_name}"
        for hi, headers in enumerate(headers_try):
            # Carta export URL은 HEAD 가 404 인데 GET 은 200 인 경우가 많아, HEAD 실패 시에도 GET 을 시도한다.
            if not _meissa_carta_export_head_ok(png_url, headers, head_timeout):
                last_status = 404
            res = _meissa_carta_stream_to_tempfile(png_url, headers, cap, ".png", ortho_timeout)
            tag = res[0]
            if tag == "http":
                last_status = int(res[1])
                continue
            if tag == "oversize":
                return {
                    "ok": False,
                    "message": (
                        f"{png_name} 용량이 {cap}바이트 상한을 초과했습니다. "
                        f"환경변수 MEISSA_ORTHOPHOTO_MAX_DOWNLOAD_MB(또는 _BYTES)로 상한을 늘리세요."
                    ),
                    "snapshotId": sid,
                    "projectId": pid,
                }
            if tag == "error":
                last_err = str(res[1])
                continue
            if tag != "ok":
                continue
            path, total = res[1], res[2]
            pstr = str(path)
            wh = _png_ihdr_dimensions(pstr)
            # 기본: 원본 longest edge 가 요청 max_edge 이하일 때만 바이트 그대로 응답. 그렇지 않으면 edge_lim 으로 축소.
            if not resize_export and wh:
                body = b""
                try:
                    with open(pstr, "rb") as rf:
                        body = rf.read()
                except OSError:
                    body = b""
                if (
                    body
                    and len(body) > 64
                    and body.startswith(b"\x89PNG\r\n\x1a\n")
                    and max(wh) <= edge_lim
                    and total <= export_raw_cap
                ):
                    try:
                        os.unlink(pstr)
                    except OSError:
                        pass
                    return {
                        "ok": True,
                        "snapshotId": sid,
                        "projectId": pid,
                        "body": body,
                        "width": wh[0],
                        "height": wh[1],
                        "source": f"export-png:{png_name}",
                        "disk_cache_slot": "full_export",
                    }
            if resize_export and wh and max(wh) <= edge_lim and total <= pt_cap:
                body = b""
                try:
                    with open(pstr, "rb") as rf:
                        body = rf.read()
                except OSError:
                    body = b""
                if body and len(body) > 64:
                    try:
                        os.unlink(pstr)
                    except OSError:
                        pass
                    return {
                        "ok": True,
                        "snapshotId": sid,
                        "projectId": pid,
                        "body": body,
                        "width": wh[0],
                        "height": wh[1],
                        "source": f"export-png:{png_name}",
                    }
            if not meissa_orthophoto_disk_cache_full_export_path_if_valid(pid, sid):
                try:
                    meissa_orthophoto_copy_path_to_full_export_cache(pstr, pid, sid)
                except Exception:
                    pass
            preview = _meissa_raster_file_to_preview_png_bytes(
                pstr,
                edge_lim,
                source_label=f"export-png:{png_name}",
                png_passthrough=bool(resize_export and total <= pt_cap),
            )
            if preview and preview.get("ok"):
                out = {
                    "ok": True,
                    "snapshotId": sid,
                    "projectId": pid,
                    "body": preview["body"],
                    "width": preview["width"],
                    "height": preview["height"],
                    "source": preview.get("source", png_name),
                }
                return out
            if preview and preview.get("ok") is False and preview.get("message"):
                return {
                    "ok": False,
                    "message": str(preview["message"]),
                    "snapshotId": sid,
                    "projectId": pid,
                }

    signed_fallback = _meissa_orthophoto_preview_from_resource_urls(
        access_token,
        sid,
        edge_lim,
        cap,
        pt_cap,
        headers_try,
        ortho_timeout,
    )
    if signed_fallback and signed_fallback.get("ok"):
        out_fb = dict(signed_fallback)
        out_fb["projectId"] = pid
        return out_fb

    if not _meissa_orthophoto_tif_fallback_enabled():
        msg = (
            f"Carta export 최대 PNG({_meissa_orthophoto_export_png_filenames()[0]}) 를 가져오지 못했습니다. "
            f"HTTP {last_status if last_status is not None else 'unknown'}. "
            f"TIF 폴백이 필요하면 MEISSA_ORTHOPHOTO_TIF_FALLBACK=1 을 설정하세요."
        )
        if last_err:
            msg = f"{msg} ({last_err})"
        return {"ok": False, "message": msg, "snapshotId": sid, "projectId": pid}

    tif_url = f"{base_export}orthophoto.tif"

    for hi, headers in enumerate(headers_try):
        if not _meissa_carta_export_head_ok(tif_url, headers, head_timeout):
            last_status = 404
        res = _meissa_carta_stream_to_tempfile(tif_url, headers, cap, ".tif", ortho_timeout)
        tag = res[0]
        if tag == "http":
            last_status = int(res[1])
            continue
        if tag == "oversize":
            return {
                "ok": False,
                "message": (
                    f"orthophoto.tif 용량이 {cap}바이트 상한을 초과했습니다. "
                    f"환경변수 MEISSA_ORTHOPHOTO_MAX_DOWNLOAD_MB(또는 _BYTES)로 상한을 늘리세요."
                ),
                "snapshotId": sid,
                "projectId": pid,
            }
        if tag == "error":
            last_err = str(res[1])
            continue
        if tag != "ok":
            continue
        path, total = res[1], res[2]
        preview = _meissa_raster_file_to_preview_png_bytes(
            str(path),
            edge_lim,
            source_label="orthophoto.tif",
            png_passthrough=False,
        )
        if preview and preview.get("ok"):
            return {
                "ok": True,
                "snapshotId": sid,
                "projectId": pid,
                "body": preview["body"],
                "width": preview["width"],
                "height": preview["height"],
                "source": preview.get("source", "orthophoto.tif"),
            }
        if preview and preview.get("ok") is False and preview.get("message"):
            return {
                "ok": False,
                "message": str(preview["message"]),
                "snapshotId": sid,
                "projectId": pid,
            }

    msg = f"Carta orthophoto(PNG export 또는 .tif) 다운로드 실패(HTTP {last_status if last_status is not None else 'unknown'})"
    if last_err:
        msg = f"{msg}: {last_err}"
    return {"ok": False, "message": msg, "snapshotId": sid, "projectId": pid}


def _meissa_orthophoto_disk_cache_safe_segment(value: Any, max_len: int = 96) -> str:
    t = "".join(c if (c.isalnum() or c in "-_.") else "_" for c in str(value or "").strip())[:max_len]
    return t or "na"


def _meissa_orthophoto_disk_cache_dir() -> str:
    raw = (os.environ.get("MEISSA_ORTHOPHOTO_DISK_CACHE_DIR") or "").strip()
    if raw:
        return os.path.normpath(raw)
    return os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "data", "meissa_orthophoto_cache")
    )


def _meissa_orthophoto_disk_cache_ttl_sec() -> int:
    try:
        v = int((os.environ.get("MEISSA_ORTHOPHOTO_DISK_CACHE_TTL_SEC") or "604800").strip())
        return max(60, min(365 * 86400, v))
    except ValueError:
        return 604800


def _meissa_orthophoto_disk_cache_rev() -> int:
    try:
        return int((os.environ.get("MEISSA_ORTHOPHOTO_DISK_CACHE_REV") or "2").strip())
    except ValueError:
        return 2


def meissa_orthophoto_disk_cache_file_path(project_id: Any, snapshot_id: Any, edge_lim: int) -> str:
    pid = _meissa_orthophoto_disk_cache_safe_segment(project_id)
    sid = _meissa_orthophoto_disk_cache_safe_segment(snapshot_id)
    rev = _meissa_orthophoto_disk_cache_rev()
    name = f"ortho_{pid}_{sid}_e{int(edge_lim)}_r{rev}.png"
    return os.path.join(_meissa_orthophoto_disk_cache_dir(), name)


def meissa_orthophoto_disk_cache_path_if_valid(
    project_id: Any, snapshot_id: Any, edge_lim: Optional[int] = None
) -> Optional[str]:
    """
    TTL 이내·크기 양호한 디스크 캐시 PNG 경로. 없으면 None.
    첫 요청은 Carta→처리 후 저장, 이후 동일 스냅샷은 이 파일만 서빙.
    edge_lim: 미리보기 변 길이(캐시 파일명에 포함). None 이면 환경변수 기본.
    """
    el = int(edge_lim) if edge_lim is not None else _meissa_orthophoto_preview_max_edge()
    el = max(1024, min(16384, el))
    path = meissa_orthophoto_disk_cache_file_path(project_id, snapshot_id, el)
    ttl = _meissa_orthophoto_disk_cache_ttl_sec()
    try:
        st = os.stat(path)
    except OSError:
        return None
    if not os.path.isfile(path) or st.st_size < 64:
        return None
    age = time.time() - st.st_mtime
    if age > ttl:
        return None
    return path


def meissa_orthophoto_disk_cache_best_valid_path_up_to(
    project_id: Any, snapshot_id: Any, max_edge: int
) -> Optional[Tuple[str, int]]:
    """
    요청 max_edge 이하 중, 디스크에 남아 있는 가장 큰 edge 캐시 (경로, edge).
    고해상 요청이 Carta 404 등으로 실패했을 때 저해상 캐시(예: 3072)만 있는 경우에 쓴다.
    """
    try:
        me = int(max_edge)
    except (TypeError, ValueError):
        me = _meissa_orthophoto_preview_max_edge()
    me = max(1024, min(16384, me))
    for el in (16384, 8192, 6144, 4096, 3072, 2048, 1536, 1024):
        if el > me:
            continue
        p = meissa_orthophoto_disk_cache_path_if_valid(project_id, snapshot_id, el)
        if p:
            return (p, el)
    return None


def meissa_orthophoto_write_disk_cache(
    project_id: Any, snapshot_id: Any, body: bytes, edge_lim: Optional[int] = None
) -> None:
    if not body or len(body) < 64:
        return
    el = int(edge_lim) if edge_lim is not None else _meissa_orthophoto_preview_max_edge()
    el = max(1024, min(16384, el))
    path = meissa_orthophoto_disk_cache_file_path(project_id, snapshot_id, el)
    d = os.path.dirname(path)
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        return
    tmp = f"{path}.{os.getpid()}.tmp"
    try:
        with open(tmp, "wb") as wf:
            wf.write(body)
        os.replace(tmp, path)
    except OSError:
        try:
            if os.path.isfile(tmp):
                os.unlink(tmp)
        except OSError:
            pass
        return


def meissa_orthophoto_disk_cache_full_export_file_path(project_id: Any, snapshot_id: Any) -> str:
    pid = _meissa_orthophoto_disk_cache_safe_segment(project_id)
    sid = _meissa_orthophoto_disk_cache_safe_segment(snapshot_id)
    rev = _meissa_orthophoto_disk_cache_rev()
    name = f"ortho_{pid}_{sid}_full_r{rev}.png"
    return os.path.join(_meissa_orthophoto_disk_cache_dir(), name)


def meissa_orthophoto_disk_cache_full_export_path_if_valid(project_id: Any, snapshot_id: Any) -> Optional[str]:
    path = meissa_orthophoto_disk_cache_full_export_file_path(project_id, snapshot_id)
    ttl = _meissa_orthophoto_disk_cache_ttl_sec()
    try:
        st = os.stat(path)
    except OSError:
        return None
    if not os.path.isfile(path) or st.st_size < 64:
        return None
    age = time.time() - st.st_mtime
    if age > ttl:
        return None
    return path


def meissa_orthophoto_write_disk_cache_full_export(project_id: Any, snapshot_id: Any, body: bytes) -> None:
    if not body or len(body) < 64:
        return
    path = meissa_orthophoto_disk_cache_full_export_file_path(project_id, snapshot_id)
    d = os.path.dirname(path)
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        return
    tmp = f"{path}.{os.getpid()}.tmp"
    try:
        with open(tmp, "wb") as wf:
            wf.write(body)
        os.replace(tmp, path)
    except OSError:
        try:
            if os.path.isfile(tmp):
                os.unlink(tmp)
        except OSError:
            pass
        return


def meissa_orthophoto_copy_path_to_full_export_cache(src_path: str, project_id: Any, snapshot_id: Any) -> None:
    """Carta에서 받은 임시 PNG를 full_export 디스크 캐시로 복사(이후 저해상 요청은 네트워크 생략)."""
    if not src_path or not os.path.isfile(src_path):
        return
    try:
        st = os.stat(src_path)
    except OSError:
        return
    if st.st_size < 64:
        return
    path = meissa_orthophoto_disk_cache_full_export_file_path(project_id, snapshot_id)
    d = os.path.dirname(path)
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        return
    tmp = f"{path}.{os.getpid()}.tmp"
    try:
        shutil.copyfile(src_path, tmp)
        os.replace(tmp, path)
    except OSError:
        try:
            if os.path.isfile(tmp):
                os.unlink(tmp)
        except OSError:
            pass
        return


def meissa_orthophoto_full_export_crop_to_png_bytes(
    project_id: Any,
    snapshot_id: Any,
    crop_x: int,
    crop_y: int,
    crop_w: int,
    crop_h: int,
    max_out_edge: int,
) -> Dict[str, Any]:
    """
    디스크에 캐시된 Carta full export PNG 에서 잘라내 max_out_edge 이하로 인코딩.
    full 캐시가 없으면 ok=False, reason=nocache — 프론트는 본페이지 로드 후 재시도.
    """
    pid = str(project_id).strip()
    sid = str(snapshot_id).strip()
    if not pid or not sid:
        return {"ok": False, "message": "project_id 또는 snapshot_id가 비어 있습니다.", "reason": "badid"}

    full_path = meissa_orthophoto_disk_cache_full_export_path_if_valid(pid, sid)
    if not full_path:
        return {
            "ok": False,
            "message": "full 정사 캐시가 아직 없습니다. 전체 미리보기 로드 후 다시 시도하세요.",
            "reason": "nocache",
            "projectId": pid,
            "snapshotId": sid,
        }

    try:
        from PIL import Image
    except ImportError:
        return {"ok": False, "message": "Pillow가 없습니다.", "reason": "nopil"}

    me = max(1024, min(16384, int(max_out_edge)))
    cw = max(1, min(int(crop_w), 8192))
    ch = max(1, min(int(crop_h), 8192))
    # 8192^2 ≈ 67.1M — 이전 56M 한도는 8192×7345 같은 합법 crop 도 404(toobig) 를 냄
    if cw * ch > 72_000_000:
        return {"ok": False, "message": "crop 면적이 너무 큽니다.", "reason": "toobig"}

    im = None
    rgba = None
    try:
        im = Image.open(full_path)
        if getattr(im, "n_frames", 1) > 1:
            im.seek(0)
        im.load()
        W, H = im.size
        if W < 2 or H < 2:
            return {"ok": False, "message": "원본 크기가 유효하지 않습니다.", "reason": "badsize"}

        x0 = max(0, min(W - 1, int(crop_x)))
        y0 = max(0, min(H - 1, int(crop_y)))
        x1 = min(W, x0 + cw)
        y1 = min(H, y0 + ch)
        if x1 <= x0 or y1 <= y0:
            return {"ok": False, "message": "crop 영역이 비어 있습니다.", "reason": "empty"}

        region = im.crop((x0, y0, x1, y1))
        try:
            im.close()
        except Exception:
            pass
        im = None

        try:
            rgba = region.convert("RGBA")
        except Exception:
            try:
                rgba = region.convert("RGB").convert("RGBA")
            except Exception as exc:
                try:
                    region.close()
                except Exception:
                    pass
                return {"ok": False, "message": f"이미지 변환 실패: {exc}", "reason": "convert"}

        try:
            region.close()
        except Exception:
            pass

        resample = _meissa_orthophoto_pillow_resample()
        rgba.thumbnail((me, me), resample)
        ow, oh = rgba.size
        out = io.BytesIO()
        save_kw = _meissa_orthophoto_png_save_kwargs_for_edge(int(max(ow, oh)))
        t0_enc = time.perf_counter()
        rgba.save(out, **save_kw)
        _ = int((time.perf_counter() - t0_enc) * 1000)
        png_bytes = out.getvalue()
        try:
            rgba.close()
        except Exception:
            pass
        rgba = None

        if not png_bytes or len(png_bytes) < 64:
            return {"ok": False, "message": "PNG 인코딩 실패", "reason": "encode"}

        ax = int(x1 - x0)
        ay = int(y1 - y0)
        return {
            "ok": True,
            "snapshotId": sid,
            "projectId": pid,
            "body": png_bytes,
            "width": int(ow),
            "height": int(oh),
            "source": "full-export-crop",
            "full_px_w": int(W),
            "full_px_h": int(H),
            "src_x0": int(x0),
            "src_y0": int(y0),
            "src_w": ax,
            "src_h": ay,
        }
    except Exception as exc:
        return {"ok": False, "message": str(exc)[:400], "reason": "exc"}
    finally:
        if rgba is not None:
            try:
                rgba.close()
            except Exception:
                pass
        if im is not None:
            try:
                im.close()
            except Exception:
                pass


def _meissa_dsm_max_download_bytes() -> int:
    raw = (os.environ.get("MEISSA_DSM_MAX_DOWNLOAD_MB") or "2048").strip()
    try:
        mb = int(raw)
    except ValueError:
        mb = 2048
    return max(64, mb) * 1024 * 1024


def _meissa_dsm_tifffile_max_pixels() -> int:
    raw = (os.environ.get("MEISSA_DSM_TIFFFILE_MAX_PIXELS") or "300000000").strip()
    try:
        return max(10_000_000, int(raw))
    except ValueError:
        return 300_000_000


def _tifffile_tag_value(page: Any, code: int, name: str) -> Any:
    tags = page.tags
    t = None
    for key in (code, name):
        try:
            t = tags[key]
        except (KeyError, TypeError):
            t = None
        if t is not None:
            break
    if t is None and hasattr(tags, "get"):
        t = tags.get(code) or tags.get(name)
    if t is None:
        return None
    return t.value if hasattr(t, "value") else t


def _geotransform_from_tifffile_page(page: Any) -> Optional[Tuple[float, float, float, float, float, float]]:
    """ModelPixelScale(33550) + ModelTiepoint(33922) → GDAL 6-float geotransform."""
    scale = _tifffile_tag_value(page, 33550, "ModelPixelScale")
    tie = _tifffile_tag_value(page, 33922, "ModelTiepoint")
    if scale is None or tie is None:
        return None
    try:
        sx = float(scale[0])
        sy = float(scale[1])
        if len(tie) < 6:
            return None
        i, j = float(tie[0]), float(tie[1])
        X, Y = float(tie[3]), float(tie[4])
    except (TypeError, IndexError, ValueError):
        return None
    gt0 = X - i * sx
    gt3 = Y + j * sy
    gt1 = sx
    gt5 = -sy
    return (gt0, gt1, 0.0, gt3, 0.0, gt5)


def _dsm_sample_rasterio(tpath: str, coords: List[Tuple[float, float]]) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    import rasterio

    results: List[Dict[str, Any]] = []
    crs_hint: Optional[str] = None
    with rasterio.open(tpath) as ds:
        try:
            crs_hint = str(ds.crs) if ds.crs else None
        except Exception:
            crs_hint = None
        nd = ds.nodatavals[0] if ds.nodatavals else None
        sample_xy = [(float(a), float(b)) for a, b in coords]
        sampled = list(ds.sample(sample_xy))
        if len(sampled) != len(coords):
            raise ValueError(f"샘플 개수 불일치: {len(sampled)} != {len(coords)}")
        for i, arr in enumerate(sampled):
            try:
                z = float(arr[0])
                if math.isnan(z):
                    results.append({"ok": False, "message": "NaN(무효 픽셀)", "i": i})
                    continue
                if nd is not None and not math.isnan(float(nd)) and abs(z - float(nd)) < 1e-9:
                    results.append({"ok": False, "message": "nodata", "i": i})
                    continue
                results.append(
                    {
                        "ok": True,
                        "z": z,
                        "distancePlanar": 0.0,
                        "parser": "carta_dsm_geotiff",
                        "resourceId": "export/dsm/dsm.tif",
                        "note": "Carta DSM tif 격자 샘플(rasterio)",
                    }
                )
            except Exception as exc:
                results.append({"ok": False, "message": str(exc)[:200], "i": i})
    return results, crs_hint


def _dsm_sample_tifffile_numpy(tpath: str, coords: List[Tuple[float, float]]) -> Tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    """rasterio 없을 때 tifffile + numpy(GeoTIFF 태그 단순 해석)."""
    try:
        import numpy as np
        import tifffile
    except ImportError as exc:
        return [], None, f"tifffile/numpy 필요: {exc} (pip install tifffile)"

    results: List[Dict[str, Any]] = []
    crs_hint: Optional[str] = None
    try:
        with tifffile.TiffFile(tpath) as tif:
            if not tif.pages:
                return [], None, "TIF 페이지 없음"
            page = tif.pages[0]
            gt = _geotransform_from_tifffile_page(page)
            if gt is None:
                return [], None, "GeoTIFF ModelPixelScale/ModelTiepoint 없음 — pip install rasterio 권장"
            gt0, gt1, gt2, gt3, gt4, gt5 = gt
            try:
                arr = page.asarray()
            except Exception as exc:
                return [], None, f"dsm.tif 디코드 실패: {str(exc)[:200]}"
            if arr.size > _meissa_dsm_tifffile_max_pixels():
                return (
                    [],
                    None,
                    f"래스터 픽셀 수가 상한({_meissa_dsm_tifffile_max_pixels()}) 초과 — rasterio 설치 또는 MEISSA_DSM_TIFFFILE_MAX_PIXELS",
                )
            if arr.ndim == 2:
                band0 = np.asarray(arr, dtype=np.float64)
                h, w = band0.shape
            elif arr.ndim == 3:
                band0 = np.asarray(arr[0], dtype=np.float64)
                h, w = band0.shape
            else:
                return [], None, f"지원하지 않는 래스터 차원: {arr.ndim}"

            det = gt1 * gt5 - gt2 * gt4
            for i, (x, y) in enumerate(coords):
                try:
                    fx, fy = float(x), float(y)
                    if abs(det) < 1e-30:
                        col = (fx - gt0) / gt1
                        row = (fy - gt3) / gt5
                    else:
                        dx, dy = fx - gt0, fy - gt3
                        col = (dx * gt5 - dy * gt2) / det
                        row = (dy * gt1 - dx * gt4) / det
                    ci = int(round(col))
                    ri = int(round(row))
                    if ri < 0 or ri >= h or ci < 0 or ci >= w:
                        results.append({"ok": False, "message": "outside_raster", "i": i})
                        continue
                    z = float(band0[ri, ci])
                    if math.isnan(z):
                        results.append({"ok": False, "message": "NaN(무효 픽셀)", "i": i})
                        continue
                    results.append(
                        {
                            "ok": True,
                            "z": z,
                            "distancePlanar": 0.0,
                            "parser": "carta_dsm_geotiff_tifffile",
                            "resourceId": "export/dsm/dsm.tif",
                            "note": "Carta DSM tif 격자 샘플(tifffile 폴백)",
                        }
                    )
                except Exception as exc:
                    results.append({"ok": False, "message": str(exc)[:200], "i": i})
    except Exception as exc:
        return [], None, str(exc)[:400]
    return results, crs_hint, None


def _meissa_dsm_geo_reader_prereq_error() -> Optional[str]:
    """dsm.tif 를 읽을 rasterio/tifffile 이 없으면 안내(다운로드 전에 호출해 Carta 대역폭 낭비 방지)."""
    try:
        import rasterio  # noqa: F401

        return None
    except ImportError:
        pass
    try:
        import tifffile  # noqa: F401

        return None
    except ImportError as exc:
        py = getattr(sys, "executable", "") or "python"
        return (
            "DSM GeoTIFF 처리에 rasterio 또는 tifffile 이 필요합니다(다운로드 전 검사). "
            f"이 API 프로세스 Python: {py} — 여기서 pip install tifffile (또는 rasterio) 후 재시작. "
            f"({exc})"
        )


def meissa_dsm_z_batch_from_carta_export(
    access_token: str,
    project_id: Any,
    snapshot_id: Any,
    points: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Meissa/Carta 현장상황의 「수치표면모델 → tif 원본」과 동일 계열 URL로 dsm.tif 1회 수신 후,
    각 (x,y) 지점의 고도값을 GeoTIFF 격자에서 샘플합니다(좌표계는 래스터 CRS와 동일해야 함).
    nearest-z 수천 회 호출 대신 백엔드에서 일괄 처리합니다.
    rasterio 가 있으면 우선 사용, 없으면 tifffile+numpy 폴백.
    """
    pid = str(project_id).strip()
    sid = str(snapshot_id).strip()
    if not pid or not sid:
        return {"ok": False, "message": "project_id 또는 snapshot_id가 비어 있습니다.", "results": [], "snapshotId": sid, "projectId": pid}

    if not isinstance(points, list) or not points:
        return {"ok": False, "message": "points 배열이 비어 있습니다.", "results": [], "snapshotId": sid, "projectId": pid}

    max_pts = 8000
    if len(points) > max_pts:
        return {
            "ok": False,
            "message": f"점 개수가 {max_pts}를 초과했습니다.",
            "results": [],
            "snapshotId": sid,
            "projectId": pid,
        }

    coords: List[Tuple[float, float]] = []
    for p in points:
        if not isinstance(p, dict):
            return {"ok": False, "message": "points 항목은 {x,y} 객체여야 합니다.", "results": [], "snapshotId": sid, "projectId": pid}
        try:
            coords.append((float(p["x"]), float(p["y"])))
        except (KeyError, TypeError, ValueError):
            return {"ok": False, "message": "각 point 에 유효한 x, y 숫자가 필요합니다.", "results": [], "snapshotId": sid, "projectId": pid}

    prereq = _meissa_dsm_geo_reader_prereq_error()
    if prereq:
        return {"ok": False, "message": prereq, "results": [], "snapshotId": sid, "projectId": pid}

    url = f"https://cs.carta.is/carta/workspace/{quote(pid, safe='')}/{quote(sid, safe='')}/export/dsm/dsm.tif"
    cap = _meissa_dsm_max_download_bytes()
    headers_try = _meissa_orthophoto_request_headers(access_token)
    ortho_timeout = (120, 3600)
    head_timeout = (5, 30)

    tpath: Optional[str] = None
    last_err: Optional[str] = None
    dl_bytes = 0
    for headers in headers_try:
        _meissa_carta_export_head_ok(url, headers, head_timeout)
        res = _meissa_carta_stream_to_tempfile(url, headers, cap, ".tif", ortho_timeout)
        tag = res[0]
        if tag == "http":
            last_err = f"HTTP {int(res[1])}"
            continue
        if tag == "oversize":
            return {
                "ok": False,
                "message": f"dsm.tif 용량이 {cap}바이트 상한을 초과했습니다. MEISSA_DSM_MAX_DOWNLOAD_MB 로 조정하세요.",
                "results": [],
                "snapshotId": sid,
                "projectId": pid,
            }
        if tag == "error":
            last_err = str(res[1])
            continue
        if tag == "ok":
            tpath = str(res[1])
            dl_bytes = int(res[2])
            break

    if not tpath:
        return {
            "ok": False,
            "message": last_err or "dsm.tif 다운로드 실패(Carta export 경로·권한 확인).",
            "results": [],
            "snapshotId": sid,
            "projectId": pid,
        }

    results: List[Dict[str, Any]] = []
    crs_hint: Optional[str] = None
    err_resp: Optional[Dict[str, Any]] = None

    try:
        try:
            import rasterio  # noqa: F401

            has_rasterio = True
        except ImportError:
            has_rasterio = False

        if has_rasterio:
            try:
                results, crs_hint = _dsm_sample_rasterio(tpath, coords)
            except Exception as exc:
                tf_results, tf_crs, tf_err = _dsm_sample_tifffile_numpy(tpath, coords)
                if tf_err or not tf_results:
                    err_resp = {
                        "ok": False,
                        "message": f"DSM 격자 샘플 실패(rasterio: {str(exc)[:200]}; tifffile: {tf_err or '빈 결과'})",
                        "results": [],
                        "snapshotId": sid,
                        "projectId": pid,
                    }
                else:
                    results, crs_hint = tf_results, tf_crs
        else:
            tf_results, tf_crs, tf_err = _dsm_sample_tifffile_numpy(tpath, coords)
            if tf_err:
                err_resp = {
                    "ok": False,
                    "message": tf_err,
                    "results": [],
                    "snapshotId": sid,
                    "projectId": pid,
                }
            else:
                results, crs_hint = tf_results, tf_crs
    finally:
        try:
            os.unlink(tpath)
        except OSError:
            pass

    if err_resp is not None:
        return err_resp

    ok_n = sum(1 for r in results if r.get("ok"))
    return {
        "ok": True,
        "results": results,
        "snapshotId": sid,
        "projectId": pid,
        "source": "carta:export/dsm/dsm.tif",
        "downloadBytes": dl_bytes,
        "crs": crs_hint,
        "message": f"DSM 샘플 완료: 성공 {ok_n}/{len(coords)}",
    }
