from __future__ import annotations

import hashlib
import json
import math
import os
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_PROJECT_NAME = "기본"
DEFAULT_SOURCE_TYPE = "contractor_original"
SOURCE_TYPE_LABELS = {
    "contractor_original": "시공사 원본",
    "vendor_prepared": "업체 작성",
}
SOURCE_TYPE_ALIASES = {
    "contractor_original": "contractor_original",
    "contractor": "contractor_original",
    "construction_original": "contractor_original",
    "source": "contractor_original",
    "origin": "contractor_original",
    "vendor_prepared": "vendor_prepared",
    "vendor": "vendor_prepared",
    "partner": "vendor_prepared",
    "outsourced": "vendor_prepared",
}
HISTORY_COORD_PRECISION = 4
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANUAL_MATCH_HISTORY_DIR = os.path.join(PROJECT_ROOT, "data", "manual_match_history")
PLACEHOLDER_BUILDING_NAME_PATTERN = re.compile(r"(?i)^building(?:_seed)?_\d+$")


def normalize_project_name(value: Any) -> str:
    return (str(value or "").strip() or DEFAULT_PROJECT_NAME)


def normalize_source_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in SOURCE_TYPE_ALIASES:
        return SOURCE_TYPE_ALIASES[raw]
    if raw == "시공사 원본":
        return "contractor_original"
    if raw == "업체 작성":
        return "vendor_prepared"
    return DEFAULT_SOURCE_TYPE


def source_type_label(value: Any) -> str:
    return SOURCE_TYPE_LABELS.get(normalize_source_type(value), SOURCE_TYPE_LABELS[DEFAULT_SOURCE_TYPE])


def is_placeholder_building_name(value: Any) -> bool:
    name = str(value or "").strip()
    return bool(name) and bool(PLACEHOLDER_BUILDING_NAME_PATTERN.fullmatch(name))


def sanitize_work_building_names(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    item = dict(data or {})
    buildings = item.get("buildings")
    valid_names = {
        str(building.get("name") or "").strip()
        for building in buildings
        if isinstance(building, dict) and str(building.get("name") or "").strip()
    } if isinstance(buildings, list) else set()

    for key in ("circles", "texts"):
        entities = item.get(key)
        if not isinstance(entities, list):
            continue
        sanitized_entities: List[Dict[str, Any]] = []
        for entity in entities:
            if not isinstance(entity, dict):
                sanitized_entities.append(entity)
                continue
            normalized_entity = dict(entity)
            building_name = str(normalized_entity.get("building_name") or "").strip()
            if building_name and building_name not in valid_names and is_placeholder_building_name(building_name):
                normalized_entity["building_name"] = None
                if "building_seq" in normalized_entity:
                    normalized_entity["building_seq"] = None
            sanitized_entities.append(normalized_entity)
        item[key] = sanitized_entities
    return item


def apply_work_defaults(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    item = sanitize_work_building_names(data)
    item["project"] = normalize_project_name(item.get("project"))
    item["sourceType"] = normalize_source_type(item.get("sourceType"))
    return item


def apply_setting_defaults(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    item = dict(data or {})
    item["name"] = normalize_project_name(item.get("name"))
    item["projectName"] = normalize_project_name(item.get("projectName") or item.get("name"))
    item["sourceType"] = normalize_source_type(item.get("sourceType"))
    item["contextProject"] = normalize_project_name(item.get("contextProject")) if str(item.get("contextProject") or "").strip() else ""
    item["contextProjectId"] = str(item.get("contextProjectId") or "").strip()
    return item


def _ensure_history_dir() -> None:
    os.makedirs(MANUAL_MATCH_HISTORY_DIR, exist_ok=True)


def _history_file_path(project_name: str, source_type: str) -> str:
    raw = f"{normalize_project_name(project_name)}::{normalize_source_type(source_type)}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return os.path.join(MANUAL_MATCH_HISTORY_DIR, f"{digest}.json")


def load_manual_history(project_name: str, source_type: str) -> Dict[str, Any]:
    path = _history_file_path(project_name, source_type)
    if not os.path.isfile(path):
        return {
            "project": normalize_project_name(project_name),
            "sourceType": normalize_source_type(source_type),
            "entries": {},
        }
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    payload["project"] = normalize_project_name(payload.get("project") or project_name)
    payload["sourceType"] = normalize_source_type(payload.get("sourceType") or source_type)
    entries = payload.get("entries")
    payload["entries"] = entries if isinstance(entries, dict) else {}
    return payload


def _write_manual_history(project_name: str, source_type: str, payload: Dict[str, Any]) -> None:
    _ensure_history_dir()
    path = _history_file_path(project_name, source_type)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _round_coord(value: Any) -> float:
    try:
        return round(float(value), HISTORY_COORD_PRECISION)
    except (TypeError, ValueError):
        return 0.0


def _circle_coord_key(circle: Dict[str, Any]) -> str:
    return f"{_round_coord(circle.get('center_x'))}|{_round_coord(circle.get('center_y'))}"


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_text_value(value: Any) -> str:
    return str(value or "").strip()


def build_manual_history_entries(
    circles: List[Dict[str, Any]],
    texts: List[Dict[str, Any]],
    manual_overrides: Dict[str, str],
    *,
    project_name: str,
    source_type: str,
    work_id: Optional[str] = None,
    work_title: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    if not circles or not texts or not manual_overrides:
        return {}
    circle_lookup = {
        str(circle.get("id")): circle
        for circle in circles
        if isinstance(circle, dict) and circle.get("id") is not None
    }
    text_lookup = {
        str(text.get("id")): text
        for text in texts
        if isinstance(text, dict) and text.get("id") is not None
    }
    entries: Dict[str, Dict[str, Any]] = {}
    normalized_project = normalize_project_name(project_name)
    normalized_source_type = normalize_source_type(source_type)
    for circle_id, text_id in manual_overrides.items():
        circle = circle_lookup.get(str(circle_id))
        text = text_lookup.get(str(text_id))
        if not circle or not text:
            continue
        text_value = _normalize_text_value(text.get("text"))
        if not text_value:
            continue
        coord_key = _circle_coord_key(circle)
        entries[coord_key] = {
            "circleCoordKey": coord_key,
            "circleX": _safe_float(circle.get("center_x")),
            "circleY": _safe_float(circle.get("center_y")),
            "radius": _safe_float(circle.get("radius")),
            "buildingName": circle.get("building_name"),
            "textValue": text_value,
            "textCenterX": _safe_float(text.get("text_center_x", text.get("center_x"))),
            "textCenterY": _safe_float(text.get("text_center_y", text.get("center_y"))),
            "textInsertX": _safe_float(text.get("insert_x", text.get("center_x"))),
            "textInsertY": _safe_float(text.get("insert_y", text.get("center_y"))),
            "workId": work_id,
            "workTitle": work_title,
            "timestamp": timestamp,
            "project": normalized_project,
            "sourceType": normalized_source_type,
        }
    return entries


def update_manual_history(
    project_name: str,
    source_type: str,
    *,
    circles: List[Dict[str, Any]],
    texts: List[Dict[str, Any]],
    manual_overrides: Optional[Dict[str, str]],
    work_id: Optional[str] = None,
    work_title: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    overrides = {
        str(k): str(v)
        for k, v in (manual_overrides or {}).items()
        if k is not None and v is not None
    }
    if not overrides:
        return load_manual_history(project_name, source_type)
    payload = load_manual_history(project_name, source_type)
    entries = payload.get("entries") or {}
    entries.update(
        build_manual_history_entries(
            circles,
            texts,
            overrides,
            project_name=project_name,
            source_type=source_type,
            work_id=work_id,
            work_title=work_title,
            timestamp=timestamp,
        )
    )
    payload["project"] = normalize_project_name(project_name)
    payload["sourceType"] = normalize_source_type(source_type)
    payload["updatedAt"] = timestamp
    payload["entries"] = entries
    _write_manual_history(project_name, source_type, payload)
    return payload


def _history_text_distance(entry: Dict[str, Any], text: Dict[str, Any]) -> float:
    center_dx = _safe_float(text.get("text_center_x", text.get("center_x"))) - _safe_float(entry.get("textCenterX"))
    center_dy = _safe_float(text.get("text_center_y", text.get("center_y"))) - _safe_float(entry.get("textCenterY"))
    insert_dx = _safe_float(text.get("insert_x", text.get("center_x"))) - _safe_float(entry.get("textInsertX"))
    insert_dy = _safe_float(text.get("insert_y", text.get("center_y"))) - _safe_float(entry.get("textInsertY"))
    return min(math.hypot(center_dx, center_dy), math.hypot(insert_dx, insert_dy))


def apply_manual_history(
    project_name: str,
    source_type: str,
    circles: List[Dict[str, Any]],
    texts: List[Dict[str, Any]],
    reference_work_id: Optional[str] = None,
) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    if not circles or not texts:
        return {}, []
    ref_wid = str(reference_work_id or "").strip() or None
    payload = load_manual_history(project_name, source_type)
    raw_entries = payload.get("entries") or {}
    if not raw_entries:
        return {}, []

    texts_by_value: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for text in texts:
        if not isinstance(text, dict):
            continue
        text_value = _normalize_text_value(text.get("text"))
        if text_value:
            texts_by_value[text_value].append(text)

    used_history_keys: set[str] = set()
    used_text_ids: set[str] = set()
    overrides: Dict[str, str] = {}
    corrections: List[Dict[str, Any]] = []

    for circle in circles:
        if not isinstance(circle, dict) or circle.get("id") is None:
            continue
        coord_key = _circle_coord_key(circle)
        entry = raw_entries.get(coord_key)
        if not isinstance(entry, dict) or coord_key in used_history_keys:
            continue
        if ref_wid is not None:
            ew = str(entry.get("workId") or "").strip()
            if ew != ref_wid:
                continue
        target_value = _normalize_text_value(entry.get("textValue"))
        candidates = [
            text
            for text in texts_by_value.get(target_value, [])
            if str(text.get("id")) not in used_text_ids
        ]
        if not candidates:
            continue
        best_text = min(candidates, key=lambda item: _history_text_distance(entry, item))
        best_text_id = str(best_text.get("id"))
        circle_id = str(circle.get("id"))
        overrides[circle_id] = best_text_id
        used_text_ids.add(best_text_id)
        used_history_keys.add(coord_key)
        corrections.append(
            {
                "match_source": "manual_history",
                "circle_id": circle_id,
                "circle_center_x": _safe_float(circle.get("center_x")),
                "circle_center_y": _safe_float(circle.get("center_y")),
                "matched_text_id": best_text_id,
                "matched_text_value": target_value,
                "building_name": circle.get("building_name"),
                "history_work_id": entry.get("workId"),
                "history_work_title": entry.get("workTitle"),
                "history_project": normalize_project_name(project_name),
                "history_source_type": normalize_source_type(source_type),
            }
        )
    return overrides, corrections
