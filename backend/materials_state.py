"""프로젝트 단위 자재관리 번들 저장 (construction_reports DB 공용 SQLite)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .construction_reports import _connect, _ensure_storage, _normalize_project_context

def _default_join_length_specs() -> list:
    """단본 이음(총연장 m)별 두 구간(m). 단본 최장 15m 전제로 16~30m까지 조합 가능."""
    return [{"totalM": m, "seg1M": 10, "seg2M": m - 10} for m in range(16, 26)]


DEFAULT_TRUCK_LOAD_RULES = [
    {"lengthM": 5, "piecesPerTruck": 12, "note": ""},
    {"lengthM": 6, "piecesPerTruck": 10, "note": ""},
    {"lengthM": 7, "piecesPerTruck": 7, "note": "톤수 부족 주의"},
    {"lengthM": 8, "piecesPerTruck": 7, "note": ""},
    {"lengthM": 9, "piecesPerTruck": 7, "note": ""},
    {"lengthM": 10, "piecesPerTruck": 6, "note": ""},
    {"lengthM": 11, "piecesPerTruck": 6, "note": ""},
    {"lengthM": 12, "piecesPerTruck": 5, "note": ""},
    {"lengthM": 13, "piecesPerTruck": 5, "note": ""},
    {"lengthM": 14, "piecesPerTruck": 4, "note": ""},
    {"lengthM": 15, "piecesPerTruck": 4, "note": ""},
]

# Φ별 시멘트 소요 (ton/m) — 계획서 샘플 수치
DEFAULT_CEMENT_TON_PER_M = {
    "D300": 0.032,
    "D350": 0.040,
    "D400": 0.044,
    "D450": 0.048,
    "D500": 0.052,
    "D600": 0.064,
}


def default_materials_bundle() -> Dict[str, Any]:
    return {
        "suppliers": [],
        "truckLoadRules": list(DEFAULT_TRUCK_LOAD_RULES),
        "cementPresets": {
            "mode": "tonPerMPhi",
            "tonPerMByPhi": dict(DEFAULT_CEMENT_TON_PER_M),
            "selectedPhi": "D600",
            "detail": {
                "d1M": 0.66,
                "d2M": 0.60,
                "waterCementRatio": 0.83,
                "cementKgPerM3": 880,
                "waterKgPerM3": 730,
            },
        },
        "planByBuilding": {},
        "receipts": [],
        "cementLedger": [],
        "damageReturns": [],
        "manualUsedByLength": {},
        "joinLengthSpecs": _default_join_length_specs(),
        "meta": {"version": 1},
    }


def _ensure_materials_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS materials_state (
            project_context TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )


def get_materials_state(project_context: Optional[str]) -> Dict[str, Any]:
    pc = _normalize_project_context(project_context)
    _ensure_storage()
    conn = _connect()
    try:
        _ensure_materials_table(conn)
        row = conn.execute(
            "SELECT payload_json FROM materials_state WHERE project_context = ?",
            (pc,),
        ).fetchone()
        if not row or not row[0]:
            out = default_materials_bundle()
            out["meta"] = {**(out.get("meta") or {}), "projectContext": pc, "saved": False}
            return out
        try:
            data = json.loads(row[0])
        except json.JSONDecodeError:
            data = default_materials_bundle()
        if not isinstance(data, dict):
            data = default_materials_bundle()
        # 보정: 필수 키
        base = default_materials_bundle()
        for k, v in base.items():
            if k not in data:
                data[k] = v
        if not data.get("truckLoadRules"):
            data["truckLoadRules"] = list(DEFAULT_TRUCK_LOAD_RULES)
        if not data.get("cementPresets") or not isinstance(data.get("cementPresets"), dict):
            data["cementPresets"] = dict(base["cementPresets"])
        for k in ("receipts", "cementLedger", "damageReturns"):
            if not isinstance(data.get(k), list):
                data[k] = []
        if not isinstance(data.get("manualUsedByLength"), dict):
            data["manualUsedByLength"] = {}
        if not isinstance(data.get("planByBuilding"), dict):
            data["planByBuilding"] = {}
        if "joinLengthSpecs" not in data or data.get("joinLengthSpecs") is None:
            data["joinLengthSpecs"] = list(_default_join_length_specs())
        elif not isinstance(data.get("joinLengthSpecs"), list):
            data["joinLengthSpecs"] = list(_default_join_length_specs())
        data["meta"] = {
            **(data.get("meta") or {}),
            "projectContext": pc,
            "saved": True,
        }
        return data
    finally:
        conn.close()


def put_materials_state(project_context: Optional[str], payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    pc = _normalize_project_context(project_context)
    _ensure_storage()
    now = datetime.now(timezone.utc).isoformat()
    # 저장 시 meta 보강
    payload = dict(payload)
    meta_in = payload.get("meta") or {}
    payload["meta"] = {**meta_in, "version": int(meta_in.get("version") or 1), "savedAt": now}
    blob = json.dumps(payload, ensure_ascii=False)
    conn = _connect()
    try:
        _ensure_materials_table(conn)
        conn.execute(
            """
            INSERT INTO materials_state (project_context, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(project_context) DO UPDATE SET
                payload_json = excluded.payload_json,
                updated_at = excluded.updated_at
            """,
            (pc, blob, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_materials_state(pc)
