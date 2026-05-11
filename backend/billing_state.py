"""프로젝트 단위 정산관리 운용 현황 저장."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .construction_reports import _connect, _ensure_storage, _normalize_project_context


def default_billing_bundle() -> Dict[str, Any]:
    return {
        "startDate": "",
        "endDate": "",
        "rigCount": 3,
        "entries": {},
        "meta": {"version": 1},
    }


def _ensure_billing_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_state (
            project_context TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )


def _normalize_payload(payload: Dict[str, Any], project_context: str, *, saved: bool) -> Dict[str, Any]:
    base = default_billing_bundle()
    data = dict(payload) if isinstance(payload, dict) else {}
    for key, value in base.items():
        if key not in data:
            data[key] = value
    if not isinstance(data.get("entries"), dict):
        data["entries"] = {}
    try:
        rig_count = int(data.get("rigCount") or 3)
    except (TypeError, ValueError):
        rig_count = 3
    data["rigCount"] = min(12, max(1, rig_count))
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    data["meta"] = {**meta, "version": int(meta.get("version") or 1), "projectContext": project_context, "saved": saved}
    return data


def get_billing_state(project_context: Optional[str]) -> Dict[str, Any]:
    pc = _normalize_project_context(project_context)
    _ensure_storage()
    conn = _connect()
    try:
        _ensure_billing_table(conn)
        row = conn.execute("SELECT payload_json FROM billing_state WHERE project_context = ?", (pc,)).fetchone()
        if not row or not row[0]:
            return _normalize_payload(default_billing_bundle(), pc, saved=False)
        try:
            data = json.loads(row[0])
        except json.JSONDecodeError:
            data = default_billing_bundle()
        return _normalize_payload(data, pc, saved=True)
    finally:
        conn.close()


def put_billing_state(project_context: Optional[str], payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    pc = _normalize_project_context(project_context)
    _ensure_storage()
    now = datetime.now(timezone.utc).isoformat()
    data = _normalize_payload(payload, pc, saved=True)
    data["meta"] = {**(data.get("meta") or {}), "savedAt": now}
    blob = json.dumps(data, ensure_ascii=False)
    conn = _connect()
    try:
        _ensure_billing_table(conn)
        conn.execute(
            """
            INSERT INTO billing_state (project_context, payload_json, updated_at)
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
    return get_billing_state(pc)
