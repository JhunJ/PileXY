from __future__ import annotations

import hashlib
import io
import json
import os
import re
import sqlite3
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urljoin

import pandas as pd
import requests

HEADER_SCAN_ROWS = 8
MAX_RECORDS_IN_RESPONSE = 600
MAX_DIAGNOSTIC_ITEMS = 200

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONSTRUCTION_DIR = os.path.join(PROJECT_ROOT, "data", "construction")
CONSTRUCTION_WORKBOOK_DIR = os.path.join(CONSTRUCTION_DIR, "workbooks")
CONSTRUCTION_DB_PATH = os.path.join(CONSTRUCTION_DIR, "construction_reports.sqlite3")
SAVED_WORKS_DIR = os.path.join(PROJECT_ROOT, "data", "saved_works")

HEADER_ALIASES: Dict[str, Sequence[str]] = {
    "sequence_no": ("번호",),
    "construction_date": ("시공일", "시공일자", "시공날짜"),
    "equipment": ("시공장비", "장비"),
    "pile_type": ("파일종류", "파일 종류", "파일형식"),
    "construction_method": ("시공공법", "시공 공법", "공법"),
    "location": ("시공위치", "시공 위치", "위치", "동"),
    "pile_number": ("파일번호", "파일 번호", "파일no", "파일 no", "pile no", "pile number"),
    "pile_diameter": ("파일규격", "파일규격d", "파일규격(d)", "직경"),
    "pile_classification_single": ("파일구분단본", "파일구분 단본", "단본"),
    "pile_classification_total": ("파일구분합계", "파일구분 합계", "합계"),
    "boring_depth": ("천공깊이", "천공깊이m", "천공깊이(m)"),
    "penetration_depth": ("관입깊이", "관입깊이m", "관입깊이(m)"),
    "pile_remaining": ("파일잔량", "파일잔량m", "파일잔량(m)", "잔량"),
    "excavation_depth": ("공삭공", "공삭공m", "공삭공(m)"),
    "hammer_weight": ("헤머무게", "해머무게", "헤머무게ton", "해머무게ton"),
    "drop_height": ("낙하고", "낙하고m", "낙하고(m)"),
    "management_limit_mm": ("관리기준", "관리기준mm", "관리기준(mm)"),
    "auto_1": ("관입량자동측정1회", "1회"),
    "auto_2": ("관입량자동측정2회", "2회"),
    "auto_3": ("관입량자동측정3회", "3회"),
    "auto_4": ("관입량자동측정4회", "4회"),
    "auto_5": ("관입량자동측정5회", "5회"),
    "average_penetration": ("평균관입",),
    "total_penetration": ("총관입량",),
    "notes": ("비고", "메모"),
}

REQUIRED_IMPORT_FIELDS = ("construction_date", "location", "pile_number")
OPTIONAL_IMPORT_FIELDS = (
    "equipment",
    "pile_type",
    "construction_method",
    "penetration_depth",
    "pile_remaining",
)

DOWNLOAD_PATH_GUESSES = (
    "/report/download/all/excel?constructionIdx={report_id}",
    "/downloadAllReport?reportId={report_id}",
    "/downloadAllReport?seq={report_id}",
    "/downloadAllReport?idx={report_id}",
    "/downloadAllReport/{report_id}",
    "/report/downloadAllReport?reportId={report_id}",
    "/report/downloadAllReport?seq={report_id}",
    "/report/downloadAllReport?idx={report_id}",
    "/report/excelDownloadAll?reportId={report_id}",
    "/excel/downloadAllReport?reportId={report_id}",
    "/new/report/downloadAllReport?reportId={report_id}",
)


def _normalize_project_context(value: Optional[str]) -> str:
    text = (value or "").strip()
    return text or "기본"


def _migrate_construction_datasets_columns(conn: sqlite3.Connection) -> None:
    rows = conn.execute("PRAGMA table_info(construction_datasets)").fetchall()
    col_names = {row[1] for row in rows}
    if "project_context" in col_names:
        return
    conn.execute("ALTER TABLE construction_datasets ADD COLUMN project_context TEXT")
    conn.execute(
        "UPDATE construction_datasets SET project_context = ? WHERE project_context IS NULL",
        ("기본",),
    )
    conn.commit()


def _ensure_storage() -> None:
    os.makedirs(CONSTRUCTION_WORKBOOK_DIR, exist_ok=True)
    conn = sqlite3.connect(CONSTRUCTION_DB_PATH)
    try:
        conn.executescript(
            """
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS construction_datasets (
                id TEXT PRIMARY KEY,
                dataset_name TEXT,
                source_type TEXT NOT NULL,
                source_url TEXT,
                report_id INTEGER,
                login_user TEXT,
                filename TEXT,
                file_path TEXT,
                workbook_sha256 TEXT NOT NULL,
                created_at TEXT NOT NULL,
                total_records INTEGER NOT NULL,
                unique_piles INTEGER NOT NULL,
                sheet_count INTEGER NOT NULL,
                metadata_json TEXT
            );

            CREATE TABLE IF NOT EXISTS construction_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                sheet_name TEXT,
                row_number INTEGER,
                sequence_no TEXT,
                construction_date TEXT,
                construction_month TEXT,
                equipment TEXT,
                pile_type TEXT,
                construction_method TEXT,
                location TEXT,
                pile_number TEXT,
                pile_number_sort INTEGER,
                pile_diameter TEXT,
                pile_classification_single REAL,
                pile_classification_total REAL,
                boring_depth REAL,
                penetration_depth REAL,
                pile_remaining REAL,
                excavation_depth REAL,
                hammer_weight REAL,
                drop_height REAL,
                management_limit_mm REAL,
                auto_1 REAL,
                auto_2 REAL,
                auto_3 REAL,
                auto_4 REAL,
                auto_5 REAL,
                average_penetration REAL,
                total_penetration REAL,
                notes TEXT,
                installed INTEGER NOT NULL DEFAULT 0,
                raw_json TEXT,
                FOREIGN KEY(dataset_id) REFERENCES construction_datasets(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_construction_records_dataset
                ON construction_records(dataset_id);
            CREATE INDEX IF NOT EXISTS idx_construction_records_pile
                ON construction_records(dataset_id, pile_number);
            CREATE INDEX IF NOT EXISTS idx_construction_records_date
                ON construction_records(dataset_id, construction_date);
            """
        )
        _migrate_construction_datasets_columns(conn)
    finally:
        conn.close()


def _connect() -> sqlite3.Connection:
    _ensure_storage()
    conn = sqlite3.connect(CONSTRUCTION_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    return text


def _normalize_alias_token(value: Any) -> str:
    text = _cell_text(value).lower()
    if not text:
        return ""
    text = text.replace("㎜", "mm")
    text = text.replace("ｍ", "m")
    text = re.sub(r"[\s/_\-]+", "", text)
    text = re.sub(r"[()\[\]{}.:·,]", "", text)
    return text


NORMALIZED_HEADER_ALIASES = {
    key: tuple(_normalize_alias_token(alias) for alias in aliases)
    for key, aliases in HEADER_ALIASES.items()
}

_HEADER_ALIAS_TOKENS_BY_FIELD = {
    field: frozenset(_normalize_alias_token(a) for a in aliases)
    for field, aliases in HEADER_ALIASES.items()
}


def _cell_matches_column_header_echo(value: Any, field: str) -> bool:
    """셀 값이 해당 열의 표준 한글/영문 열명과 동일하면(헤더가 데이터로 밀린 행)."""
    token = _normalize_alias_token(value)
    if not token:
        return False
    return token in _HEADER_ALIAS_TOKENS_BY_FIELD.get(field, frozenset())


def _excel_data_row_matches_column_header_echo(mapping: Dict[str, str], row: Any) -> bool:
    """파싱 중: 파일번호·시공장비·시공일 등 열 이름이 그대로 값으로 들어온 행은 스킵."""
    for key in ("pile_number", "equipment", "construction_date"):
        col = mapping.get(key)
        if not col:
            continue
        try:
            if hasattr(row, "index") and col not in row.index:
                continue
            raw = row[col]
        except (KeyError, TypeError, ValueError):
            raw = row.get(col) if hasattr(row, "get") else None
        if _cell_matches_column_header_echo(raw, key):
            return True
    return False


def _record_looks_like_imported_column_header_echo(record: Dict[str, Any]) -> bool:
    """DB에 이미 들어간 동일 패턴 행(재가공·진단에서 제외)."""
    if _cell_matches_column_header_echo(record.get("pile_number"), "pile_number"):
        return True
    if _cell_matches_column_header_echo(record.get("equipment"), "equipment"):
        return True
    if _cell_matches_column_header_echo(record.get("construction_date"), "construction_date"):
        return True
    if _cell_matches_column_header_echo(record.get("construction_method"), "construction_method"):
        return True
    if _cell_matches_column_header_echo(record.get("location"), "location"):
        return True
    return False


def _without_header_echo_records(records: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [r for r in records if not _record_looks_like_imported_column_header_echo(r)]


def _dedupe_headers(headers: Sequence[str]) -> List[str]:
    counts: Dict[str, int] = defaultdict(int)
    result: List[str] = []
    for idx, header in enumerate(headers, start=1):
        base = header.strip() or f"COL_{idx}"
        counts[base] += 1
        result.append(base if counts[base] == 1 else f"{base}_{counts[base]}")
    return result


def _ffill_header_cells(values: Sequence[Any]) -> List[str]:
    result: List[str] = []
    previous = ""
    for raw in values:
        text = _cell_text(raw)
        if text:
            previous = text
            result.append(text)
        else:
            result.append(previous)
    return result


def _header_subrow_placeholder(value: str) -> bool:
    """2행째 헤더가 구분선·빈칸만 있으면 위 행 가로 전파(병합 추정)에서 제외."""
    t = _cell_text(value)
    if not t:
        return True
    if len(t) == 1 and t in {"-", "－", "—", "…", "*"}:
        return True
    if t in {"-", "－", "—", "…", "N/A", "NA", "#"}:
        return True
    return False


def _pair_hfill_top_header_row(top: List[str], bottom: List[str]) -> List[str]:
    """2행 헤더에서만: 윗행 빈 칸이 아래 행에 실제 부제(단본·합계 등)가 있을 때만 옆 열 값을 전파.

    예전에는 행마다 무조건 가로 ffill 해서 '파일번호'가 빈 칸까지 밀려
    '파일번호 -', '시공장비 -' 같은 가짜 열이 생겼고, 항타가 아닌 표가 고득점을 받을 수 있었다."""
    width = max(len(top), len(bottom))
    out = list(top) + [""] * max(0, width - len(top))
    bot = list(bottom) + [""] * max(0, width - len(bottom))
    for i in range(width):
        if out[i]:
            continue
        prev = out[i - 1] if i > 0 else ""
        sub = bot[i]
        if _header_subrow_placeholder(sub):
            continue
        if prev:
            out[i] = prev
    return out


def _flatten_header_rows(raw_df: pd.DataFrame, start_row: int, levels: int) -> List[str]:
    rows: List[List[str]] = []
    for offset in range(levels):
        if start_row + offset >= len(raw_df.index):
            break
        rows.append([_cell_text(x) for x in raw_df.iloc[start_row + offset].tolist()])
    if not rows:
        return []
    if len(rows) == 2:
        rows[0] = _pair_hfill_top_header_row(rows[0], rows[1])
    elif len(rows) == 1:
        rows[0] = _ffill_header_cells(rows[0])
    width = max(len(row) for row in rows)
    flattened: List[str] = []
    for col_idx in range(width):
        parts: List[str] = []
        for row in rows:
            value = row[col_idx] if col_idx < len(row) else ""
            if value and (not parts or parts[-1] != value):
                parts.append(value)
        flattened.append(" ".join(parts).strip() or f"COL_{col_idx + 1}")
    return _dedupe_headers(flattened)


def _resolve_field_mapping(headers: Sequence[str]) -> Dict[str, str]:
    normalized_headers = {_normalize_alias_token(header): header for header in headers}
    resolved: Dict[str, str] = {}

    def best_header_for_aliases(field: str, aliases: Sequence[str]) -> Optional[str]:
        for alias in aliases:
            if alias in normalized_headers:
                return normalized_headers[alias]
        for alias in aliases:
            for normalized, header in normalized_headers.items():
                if normalized.startswith(alias) or alias in normalized:
                    if (
                        field == "sequence_no"
                        and alias == "번호"
                        and "파일" in normalized
                    ):
                        continue
                    return header
        return None

    for field, aliases in NORMALIZED_HEADER_ALIASES.items():
        header = best_header_for_aliases(field, aliases)
        if header:
            resolved[field] = header
    return resolved


def _header_match_score(headers: Sequence[str]) -> Tuple[int, Dict[str, str]]:
    mapping = _resolve_field_mapping(headers)
    required = sum(1 for key in REQUIRED_IMPORT_FIELDS if mapping.get(key))
    optional = sum(1 for key in OPTIONAL_IMPORT_FIELDS if mapping.get(key))
    return required * 100 + optional * 10, mapping


def _reject_bad_pdam_header_mapping(mapping: Dict[str, str]) -> bool:
    """가로 ffill·행 병합 오류로 '시공일 미지정', '파일번호 -' 같은 비정상 열이 잡히면 제외."""
    cd = mapping.get("construction_date")
    if cd and "미지정" in _cell_text(cd):
        return True
    pn = mapping.get("pile_number")
    if pn:
        raw = _cell_text(pn)
        if "파일번호" in raw and " -" in raw:
            return True
    return False


def _detect_sheet_layout(excel_file: pd.ExcelFile, sheet_name: str) -> Optional[Dict[str, Any]]:
    preview = pd.read_excel(
        excel_file,
        sheet_name=sheet_name,
        header=None,
        dtype=object,
        nrows=HEADER_SCAN_ROWS,
    )
    best: Optional[Dict[str, Any]] = None
    for start_row in range(min(HEADER_SCAN_ROWS, len(preview.index))):
        for levels in (2, 1):
            headers = _flatten_header_rows(preview, start_row, levels)
            score, mapping = _header_match_score(headers)
            if score < 200 or "pile_number" not in mapping:
                continue
            if _reject_bad_pdam_header_mapping(mapping):
                continue
            candidate = {
                "header_row": start_row,
                "header_levels": levels,
                "headers": headers,
                "mapping": mapping,
                "score": score,
            }
            if best is None or candidate["score"] > best["score"]:
                best = candidate
    return best


def _parse_excel_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)) and not pd.isna(value):
        if 30000 <= float(value) <= 60000:
            return (datetime(1899, 12, 30) + timedelta(days=float(value))).date().isoformat()
    text = _cell_text(value)
    if not text:
        return None
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date().isoformat()


def _parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text = _cell_text(value)
    if not text:
        return None
    text = text.replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def _normalize_text_value(value: Any) -> Optional[str]:
    text = _cell_text(value)
    return text or None


def _normalize_construction_method(value: Any) -> Optional[str]:
    text = _cell_text(value)
    if not text:
        return None

    canonical_text = re.sub(r"\s+", "", text).upper()
    compact = re.sub(r"[\s_\-()/]+", "", text).upper()
    aliases = {
        "개량T4": "개량T4",
        "계량T4": "개량T4",
        "DRA": "DRA",
        "DAR": "DRA",
    }
    return aliases.get(compact, canonical_text or None)


def _normalize_pile_number(value: Any) -> str:
    text = _cell_text(value)
    if not text:
        return ""
    # 엑셀·한글에서 흔한 대시/마이너스(예: U+2013)를 ASCII 하이픈으로 통일
    text = re.sub(r"[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+", "-", text)
    try:
        numeric = float(text.replace(",", ""))
        if numeric.is_integer():
            return str(int(numeric))
    except ValueError:
        pass
    compact = re.sub(r"\s+", "", text).upper()
    # PDAM 입력 오타: "2.-40", "4.-12" → 하이픈 뒤 파일 번호만 사용
    m_dot_dash = re.fullmatch(r"\d+\.-(\d+)", compact)
    if m_dot_dash:
        return str(int(m_dot_dash.group(1)))
    # "B2--85" 등 이중 하이픈 → "B2-85"로 통일 (접두-접미 분리·별칭과 호환)
    m_double_dash = re.fullmatch(r"([A-Z]?\d+)--(\d+)", compact)
    if m_double_dash:
        return f"{m_double_dash.group(1)}-{m_double_dash.group(2)}"
    return compact


def _normalize_location(value: Any) -> str:
    text = _cell_text(value)
    if not text:
        return ""
    return re.sub(r"\s+", "", text).upper()


def _pile_sort_value(pile_number: str) -> Optional[int]:
    if not pile_number:
        return None
    digits = re.sub(r"\D", "", pile_number)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _record_installed(record: Dict[str, Any]) -> bool:
    """PDAM 행에 시공이 실제로 찍혔는지(일자·관입·천공·잔량 등). 좌표 매칭 '시공완료'와 동일 기준."""
    return bool(
        record.get("construction_date")
        or record.get("penetration_depth") is not None
        or record.get("total_penetration") is not None
        or record.get("average_penetration") is not None
        or record.get("boring_depth") is not None
        or record.get("excavation_depth") is not None
        or record.get("pile_remaining") is not None
    )


def parse_construction_workbook(file_bytes: bytes, *, filename: Optional[str] = None) -> Dict[str, Any]:
    excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
    parsed_records: List[Dict[str, Any]] = []
    sheet_summaries: List[Dict[str, Any]] = []

    for sheet_name in excel_file.sheet_names:
        layout = _detect_sheet_layout(excel_file, sheet_name)
        if not layout:
            continue

        df = pd.read_excel(
            excel_file,
            sheet_name=sheet_name,
            header=None,
            skiprows=layout["header_row"] + layout["header_levels"],
            dtype=object,
        )
        headers = _dedupe_headers(layout["headers"][: df.shape[1]])
        if len(headers) < df.shape[1]:
            headers.extend(f"COL_{index + 1}" for index in range(len(headers), df.shape[1]))
        df.columns = headers[: df.shape[1]]
        df = df.dropna(how="all")
        df = df[[column for column in df.columns if not df[column].isna().all()]]

        mapping = _resolve_field_mapping(df.columns)
        if "pile_number" not in mapping:
            continue

        sheet_count_before = len(parsed_records)
        for row_idx, row in df.iterrows():
            pile_number = _normalize_pile_number(row.get(mapping["pile_number"]))
            if not pile_number:
                continue
            if _excel_data_row_matches_column_header_echo(mapping, row):
                continue
            construction_date = (
                _parse_excel_date(row.get(mapping["construction_date"]))
                if mapping.get("construction_date")
                else None
            )
            record = {
                "sheet_name": sheet_name,
                "row_number": int(row_idx) + layout["header_row"] + layout["header_levels"] + 1,
                "sequence_no": _normalize_text_value(row.get(mapping["sequence_no"])) if mapping.get("sequence_no") else None,
                "construction_date": construction_date,
                "construction_month": construction_date[:7] if construction_date else None,
                "equipment": _normalize_text_value(row.get(mapping["equipment"])) if mapping.get("equipment") else None,
                "pile_type": _normalize_text_value(row.get(mapping["pile_type"])) if mapping.get("pile_type") else None,
                "construction_method": _normalize_construction_method(row.get(mapping["construction_method"])) if mapping.get("construction_method") else None,
                "location": _normalize_text_value(row.get(mapping["location"])) if mapping.get("location") else None,
                "pile_number": pile_number,
                "pile_number_sort": _pile_sort_value(pile_number),
                "pile_diameter": _normalize_text_value(row.get(mapping["pile_diameter"])) if mapping.get("pile_diameter") else None,
                "pile_classification_single": _parse_float(row.get(mapping["pile_classification_single"])) if mapping.get("pile_classification_single") else None,
                "pile_classification_total": _parse_float(row.get(mapping["pile_classification_total"])) if mapping.get("pile_classification_total") else None,
                "boring_depth": _parse_float(row.get(mapping["boring_depth"])) if mapping.get("boring_depth") else None,
                "penetration_depth": _parse_float(row.get(mapping["penetration_depth"])) if mapping.get("penetration_depth") else None,
                "pile_remaining": _parse_float(row.get(mapping["pile_remaining"])) if mapping.get("pile_remaining") else None,
                "excavation_depth": _parse_float(row.get(mapping["excavation_depth"])) if mapping.get("excavation_depth") else None,
                "hammer_weight": _parse_float(row.get(mapping["hammer_weight"])) if mapping.get("hammer_weight") else None,
                "drop_height": _parse_float(row.get(mapping["drop_height"])) if mapping.get("drop_height") else None,
                "management_limit_mm": _parse_float(row.get(mapping["management_limit_mm"])) if mapping.get("management_limit_mm") else None,
                "auto_1": _parse_float(row.get(mapping["auto_1"])) if mapping.get("auto_1") else None,
                "auto_2": _parse_float(row.get(mapping["auto_2"])) if mapping.get("auto_2") else None,
                "auto_3": _parse_float(row.get(mapping["auto_3"])) if mapping.get("auto_3") else None,
                "auto_4": _parse_float(row.get(mapping["auto_4"])) if mapping.get("auto_4") else None,
                "auto_5": _parse_float(row.get(mapping["auto_5"])) if mapping.get("auto_5") else None,
                "average_penetration": _parse_float(row.get(mapping["average_penetration"])) if mapping.get("average_penetration") else None,
                "total_penetration": _parse_float(row.get(mapping["total_penetration"])) if mapping.get("total_penetration") else None,
                "notes": _normalize_text_value(row.get(mapping["notes"])) if mapping.get("notes") else None,
            }
            record["installed"] = _record_installed(record)
            parsed_records.append(record)

        sheet_summaries.append(
            {
                "name": sheet_name,
                "records": len(parsed_records) - sheet_count_before,
                "headerRow": layout["header_row"] + 1,
                "headerLevels": layout["header_levels"],
                "detectedColumns": mapping,
            }
        )

    if not parsed_records:
        raise ValueError("엑셀에서 시공기록 형식을 찾지 못했습니다.")

    unique_piles = {
        (_normalize_location(record.get("location")), record["pile_number"])
        for record in parsed_records
        if record.get("pile_number")
    }
    return {
        "filename": filename,
        "records": parsed_records,
        "sheets": sheet_summaries,
        "summary": {
            "recordCount": len(parsed_records),
            "sheetCount": len(sheet_summaries),
            "uniquePileCount": len(unique_piles),
        },
    }


def _safe_filename(name: Optional[str]) -> str:
    base = os.path.basename(name or "construction_report.xlsx").strip() or "construction_report.xlsx"
    base = re.sub(r"[^\w.\-가-힣]", "_", base)
    return base


def import_workbook_bytes(
    file_bytes: bytes,
    *,
    filename: Optional[str],
    source_type: str,
    source_url: Optional[str] = None,
    report_id: Optional[int] = None,
    login_user: Optional[str] = None,
    dataset_name: Optional[str] = None,
    project_context: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _ensure_storage()
    parsed = parse_construction_workbook(file_bytes, filename=filename)
    dataset_id = f"construction_{uuid.uuid4().hex[:12]}"
    safe_name = _safe_filename(filename)
    _, ext = os.path.splitext(safe_name)
    ext = ext or ".xlsx"
    workbook_path = os.path.join(CONSTRUCTION_WORKBOOK_DIR, f"{dataset_id}{ext}")
    with open(workbook_path, "wb") as workbook_file:
        workbook_file.write(file_bytes)

    metadata = {
        "sheets": parsed["sheets"],
        "importSummary": parsed["summary"],
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    sha256 = hashlib.sha256(file_bytes).hexdigest()
    created_at = _utc_now_iso()
    dataset_label = (dataset_name or os.path.splitext(safe_name)[0]).strip() or dataset_id
    project_ctx = _normalize_project_context(project_context)

    conn = _connect()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO construction_datasets (
                    id, dataset_name, source_type, source_url, report_id, login_user,
                    filename, file_path, workbook_sha256, created_at,
                    total_records, unique_piles, sheet_count, metadata_json, project_context
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dataset_id,
                    dataset_label,
                    source_type,
                    source_url,
                    report_id,
                    login_user,
                    safe_name,
                    workbook_path,
                    sha256,
                    created_at,
                    parsed["summary"]["recordCount"],
                    parsed["summary"]["uniquePileCount"],
                    parsed["summary"]["sheetCount"],
                    json.dumps(metadata, ensure_ascii=False),
                    project_ctx,
                ),
            )
            conn.executemany(
                """
                INSERT INTO construction_records (
                    dataset_id, sheet_name, row_number, sequence_no, construction_date, construction_month,
                    equipment, pile_type, construction_method, location, pile_number, pile_number_sort,
                    pile_diameter, pile_classification_single, pile_classification_total,
                    boring_depth, penetration_depth, pile_remaining, excavation_depth, hammer_weight,
                    drop_height, management_limit_mm, auto_1, auto_2, auto_3, auto_4, auto_5,
                    average_penetration, total_penetration, notes, installed, raw_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        dataset_id,
                        record["sheet_name"],
                        record["row_number"],
                        record.get("sequence_no"),
                        record.get("construction_date"),
                        record.get("construction_month"),
                        record.get("equipment"),
                        record.get("pile_type"),
                        record.get("construction_method"),
                        record.get("location"),
                        record.get("pile_number"),
                        record.get("pile_number_sort"),
                        record.get("pile_diameter"),
                        record.get("pile_classification_single"),
                        record.get("pile_classification_total"),
                        record.get("boring_depth"),
                        record.get("penetration_depth"),
                        record.get("pile_remaining"),
                        record.get("excavation_depth"),
                        record.get("hammer_weight"),
                        record.get("drop_height"),
                        record.get("management_limit_mm"),
                        record.get("auto_1"),
                        record.get("auto_2"),
                        record.get("auto_3"),
                        record.get("auto_4"),
                        record.get("auto_5"),
                        record.get("average_penetration"),
                        record.get("total_penetration"),
                        record.get("notes"),
                        1 if record.get("installed") else 0,
                        json.dumps(record, ensure_ascii=False),
                    )
                    for record in parsed["records"]
                ],
            )
    finally:
        conn.close()

    return {
        "dataset": {
            "id": dataset_id,
            "name": dataset_label,
            "sourceType": source_type,
            "sourceUrl": source_url,
            "reportId": report_id,
            "loginUser": login_user,
            "filename": safe_name,
            "createdAt": created_at,
            "totalRecords": parsed["summary"]["recordCount"],
            "uniquePileCount": parsed["summary"]["uniquePileCount"],
            "sheetCount": parsed["summary"]["sheetCount"],
            "projectContext": project_ctx,
        },
        "import": parsed["summary"],
        "sheets": parsed["sheets"],
    }


def list_datasets(project_context: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = _connect()
    try:
        if project_context is None:
            rows = conn.execute(
                """
                SELECT id, dataset_name, source_type, source_url, report_id, login_user,
                       filename, created_at, total_records, unique_piles, sheet_count,
                       project_context
                FROM construction_datasets
                ORDER BY created_at DESC
                """
            ).fetchall()
        else:
            pc = _normalize_project_context(project_context)
            rows = conn.execute(
                """
                SELECT id, dataset_name, source_type, source_url, report_id, login_user,
                       filename, created_at, total_records, unique_piles, sheet_count,
                       project_context
                FROM construction_datasets
                WHERE IFNULL(project_context, '기본') = ?
                ORDER BY created_at DESC
                """,
                (pc,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "name": row["dataset_name"],
                "sourceType": row["source_type"],
                "sourceUrl": row["source_url"],
                "reportId": row["report_id"],
                "loginUser": row["login_user"],
                "filename": row["filename"],
                "createdAt": row["created_at"],
                "totalRecords": row["total_records"],
                "uniquePileCount": row["unique_piles"],
                "sheetCount": row["sheet_count"],
                "projectContext": row["project_context"] or "기본",
            }
            for row in rows
        ]
    finally:
        conn.close()


def delete_dataset(dataset_id: str) -> Dict[str, Any]:
    conn = _connect()
    workbook_path: Optional[str] = None
    deleted_info: Optional[Dict[str, Any]] = None
    try:
        row = conn.execute(
            """
            SELECT id, dataset_name, filename, file_path
            FROM construction_datasets
            WHERE id = ?
            """,
            (dataset_id,),
        ).fetchone()
        if not row:
            raise ValueError("시공기록 데이터셋을 찾지 못했습니다.")

        workbook_path = row["file_path"]
        deleted_info = {
            "id": row["id"],
            "name": row["dataset_name"],
            "filename": row["filename"],
        }
        with conn:
            conn.execute("DELETE FROM construction_datasets WHERE id = ?", (dataset_id,))
    finally:
        conn.close()

    if workbook_path and os.path.isfile(workbook_path):
        try:
            os.remove(workbook_path)
        except OSError:
            pass

    return {
        "status": "deleted",
        "dataset": deleted_info or {"id": dataset_id},
    }


def _get_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    try:
        row = conn.execute(
            """
            SELECT id, dataset_name, source_type, source_url, report_id, login_user,
                   filename, created_at, total_records, unique_piles, sheet_count, metadata_json
            FROM construction_datasets
            WHERE id = ?
            """,
            (dataset_id,),
        ).fetchone()
        if not row:
            return None
        metadata = {}
        if row["metadata_json"]:
            try:
                metadata = json.loads(row["metadata_json"])
            except json.JSONDecodeError:
                metadata = {}
        return {
            "id": row["id"],
            "name": row["dataset_name"],
            "sourceType": row["source_type"],
            "sourceUrl": row["source_url"],
            "reportId": row["report_id"],
            "loginUser": row["login_user"],
            "filename": row["filename"],
            "createdAt": row["created_at"],
            "totalRecords": row["total_records"],
            "uniquePileCount": row["unique_piles"],
            "sheetCount": row["sheet_count"],
            "metadata": metadata,
        }
    finally:
        conn.close()


def _list_records(dataset_id: str) -> List[Dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT sheet_name, row_number, sequence_no, construction_date, construction_month,
                   equipment, pile_type, construction_method, location, pile_number, pile_number_sort,
                   pile_diameter, pile_classification_single, pile_classification_total,
                   boring_depth, penetration_depth, pile_remaining, excavation_depth, hammer_weight,
                   drop_height, management_limit_mm, auto_1, auto_2, auto_3, auto_4, auto_5,
                   average_penetration, total_penetration, notes, installed
            FROM construction_records
            WHERE dataset_id = ?
            ORDER BY construction_date ASC, sheet_name ASC, row_number ASC
            """,
            (dataset_id,),
        ).fetchall()
        return [
            {
                "sheet_name": row["sheet_name"],
                "row_number": row["row_number"],
                "sequence_no": row["sequence_no"],
                "construction_date": row["construction_date"],
                "construction_month": row["construction_month"],
                "equipment": row["equipment"],
                "pile_type": row["pile_type"],
                "construction_method": row["construction_method"],
                "location": row["location"],
                "pile_number": row["pile_number"],
                "pile_number_sort": row["pile_number_sort"],
                "pile_diameter": row["pile_diameter"],
                "pile_classification_single": row["pile_classification_single"],
                "pile_classification_total": row["pile_classification_total"],
                "boring_depth": row["boring_depth"],
                "penetration_depth": row["penetration_depth"],
                "pile_remaining": row["pile_remaining"],
                "excavation_depth": row["excavation_depth"],
                "hammer_weight": row["hammer_weight"],
                "drop_height": row["drop_height"],
                "management_limit_mm": row["management_limit_mm"],
                "auto_1": row["auto_1"],
                "auto_2": row["auto_2"],
                "auto_3": row["auto_3"],
                "auto_4": row["auto_4"],
                "auto_5": row["auto_5"],
                "average_penetration": row["average_penetration"],
                "total_penetration": row["total_penetration"],
                "notes": row["notes"],
                "installed": bool(row["installed"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def _apply_filters(
    records: Iterable[Dict[str, Any]],
    *,
    date_from: Optional[str],
    date_to: Optional[str],
    month: Optional[str],
    equipment: Optional[str],
    method: Optional[str],
    location: Optional[str],
) -> List[Dict[str, Any]]:
    equipment = (equipment or "").strip()
    method = (method or "").strip()
    location = (location or "").strip()
    month = (month or "").strip()
    filtered: List[Dict[str, Any]] = []
    for record in records:
        rec_date = record.get("construction_date")
        if date_from and rec_date and rec_date < date_from:
            continue
        if date_to and rec_date and rec_date > date_to:
            continue
        if month and (record.get("construction_month") or "") != month:
            continue
        if equipment and equipment != "ALL" and (record.get("equipment") or "") != equipment:
            continue
        if method and method != "ALL" and (record.get("construction_method") or "") != method:
            continue
        if location and location != "ALL" and (record.get("location") or "") != location:
            continue
        filtered.append(record)
    return filtered


def _record_key(record: Dict[str, Any]) -> Tuple[str, str]:
    return (_normalize_location(record.get("location")), _normalize_pile_number(record.get("pile_number")))


def _record_dedupe_key_for_latest(
    record: Dict[str, Any],
    *,
    parking_unified_location: Optional[str] = None,
) -> Tuple[str, str]:
    """pile당 최신 1행을 고를 때 쓰는 키.

    `parking_unified_location`이 있으면 `_record_location_for_pdam_match`와 동일하게 묶는다.
    그렇지 않으면 PDAM에 같은 말뚝이 '주차장' / 'B2주차장' 등으로만 다르게 적혀도
    서로 다른 키로 남아, 매칭 인덱스(B2)와 불일치·후보 중복으로 일부 좌표만 안 맞는 현상이 난다."""
    pile = _normalize_pile_number(record.get("pile_number"))
    if parking_unified_location is None:
        return (_normalize_location(record.get("location")), pile)
    return (_record_location_for_pdam_match(record, parking_unified_location), pile)


def _latest_records_by_pile(
    records: Iterable[Dict[str, Any]],
    *,
    parking_unified_location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    best: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for record in records:
        key = _record_dedupe_key_for_latest(record, parking_unified_location=parking_unified_location)
        existing = best.get(key)
        current_rank = (record.get("construction_date") or "", int(record.get("row_number") or 0))
        existing_rank = (
            (existing.get("construction_date") or "", int(existing.get("row_number") or 0))
            if existing
            else ("", -1)
        )
        if existing is None or current_rank >= existing_rank:
            best[key] = record
    return list(best.values())


def _group_summary(records: Iterable[Dict[str, Any]], key_name: str) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in records:
        key = record.get(key_name) or "미분류"
        grouped[key].append(record)
    summaries: List[Dict[str, Any]] = []
    for key, items in grouped.items():
        latest = _latest_records_by_pile(items)
        remaining_values = [item["pile_remaining"] for item in latest if item.get("pile_remaining") is not None]
        summaries.append(
            {
                "key": key,
                "recordCount": len(items),
                "uniquePileCount": len(latest),
                "installedPileCount": sum(1 for item in latest if item.get("installed")),
                "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
                "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
            }
        )
    summaries.sort(key=lambda item: item["key"])
    return summaries


def _build_date_series(records: Iterable[Dict[str, Any]], key_name: str, remaining_threshold: Optional[float]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in records:
        key = record.get(key_name) or "미입력"
        grouped[key].append(record)
    result: List[Dict[str, Any]] = []
    for key, items in grouped.items():
        latest = _latest_records_by_pile(items)
        remaining_values = [item["pile_remaining"] for item in latest if item.get("pile_remaining") is not None]
        over_threshold = 0
        if remaining_threshold is not None:
            over_threshold = sum(
                1
                for item in latest
                if item.get("pile_remaining") is not None and float(item["pile_remaining"]) >= remaining_threshold
            )
        result.append(
            {
                "key": key,
                "recordCount": len(items),
                "uniquePileCount": len(latest),
                "installedPileCount": sum(1 for item in latest if item.get("installed")),
                "pendingPileCount": sum(1 for item in latest if not item.get("installed")),
                "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
                "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                "overThresholdCount": over_threshold,
            }
        )
    result.sort(key=lambda item: item["key"])
    return result


def _build_method_matrix(records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    latest = _latest_records_by_pile(records)
    methods = sorted({item.get("construction_method") or "미분류" for item in latest})
    pile_types = sorted({item.get("pile_type") or "미분류" for item in latest})
    cells: List[Dict[str, Any]] = []
    for method in methods:
        for pile_type in pile_types:
            cell_records = [
                item
                for item in latest
                if (item.get("construction_method") or "미분류") == method
                and (item.get("pile_type") or "미분류") == pile_type
            ]
            remaining_values = [item["pile_remaining"] for item in cell_records if item.get("pile_remaining") is not None]
            cells.append(
                {
                    "row": method,
                    "column": pile_type,
                    "count": len(cell_records),
                    "installedCount": sum(1 for item in cell_records if item.get("installed")),
                    "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                }
            )
    return {"rows": methods, "columns": pile_types, "cells": cells}


def _load_saved_work_circles(work_id: str) -> Optional[List[Dict[str, Any]]]:
    safe_id = re.sub(r"[^\w\-]", "", work_id)
    path = os.path.join(SAVED_WORKS_DIR, f"{safe_id}.json")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)
    circles = data.get("circles")
    return circles if isinstance(circles, list) else None


def _load_saved_work_buildings(work_id: str) -> Optional[List[Dict[str, Any]]]:
    safe_id = re.sub(r"[^\w\-]", "", work_id)
    path = os.path.join(SAVED_WORKS_DIR, f"{safe_id}.json")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)
    buildings = data.get("buildings")
    return buildings if isinstance(buildings, list) else None


def _point_in_polygon_xy(x: float, y: float, vertices: Sequence[Tuple[float, float]]) -> bool:
    """classify_entities / main.point_in_polygon 과 동일한 포함 판정."""
    inside = False
    n = len(vertices)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = vertices[i]
        xj, yj = vertices[j]
        intersects = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def _building_outline_vertices_xy(building: Dict[str, Any]) -> List[Tuple[float, float]]:
    verts = building.get("vertices")
    if not isinstance(verts, list) or len(verts) < 3:
        return []
    out: List[Tuple[float, float]] = []
    for v in verts:
        if not isinstance(v, dict) or "x" not in v or "y" not in v:
            return []
        try:
            out.append((float(v["x"]), float(v["y"])))
        except (TypeError, ValueError):
            return []
    return out


def _outline_priority_for_hit_test(kind_raw: Any) -> int:
    """main.classify_entities 와 동일: 타워(0) < 일반동(1) < 주차(2)."""
    k = _normalize_building_outline_kind(kind_raw)
    if k == "tower_crane":
        return 0
    if k == "parking":
        return 2
    return 1


def _resolve_circle_building_name_from_outlines(
    circle: Dict[str, Any],
    buildings: Optional[Sequence[Dict[str, Any]]],
) -> Optional[str]:
    """원 중심이 들어간 저장 윤곽의 이름을 쓴다(동→지하주차장 변경 후 circle.building_name 이 남은 경우)."""
    if not buildings:
        return None
    try:
        x = float(circle.get("center_x"))
        y = float(circle.get("center_y"))
    except (TypeError, ValueError):
        return None
    indexed = list(enumerate(buildings))
    indexed.sort(key=lambda it: (_outline_priority_for_hit_test(it[1].get("kind")), it[0]))
    for _, building in indexed:
        poly = _building_outline_vertices_xy(building)
        if len(poly) < 3:
            continue
        if _point_in_polygon_xy(x, y, poly):
            raw = _cell_text(building.get("name"))
            return raw if raw else None
    return None


def _circle_effective_building_label(
    circle: Dict[str, Any],
    outline_buildings: Optional[Sequence[Dict[str, Any]]],
) -> Any:
    resolved = _resolve_circle_building_name_from_outlines(circle, outline_buildings)
    if resolved is not None:
        return resolved
    return circle.get("building_name")


def _normalize_building_outline_kind(value: Any) -> str:
    return str(value or "building").strip().lower()


def _saved_work_parking_unify_context(
    buildings: Optional[Sequence[Dict[str, Any]]],
) -> Tuple[Optional[str], bool]:
    """저장 작업 좌표에 지하주차장(parking) 윤곽이 정확히 1개일 때만 (Bn 등 정규화값, True).

    층(윤곽)이 2개 이상이면 PDAM·좌표를 Bn 하나로 묶지 않는다."""
    if not buildings:
        return None, False
    parking_only = [b for b in buildings if _normalize_building_outline_kind(b.get("kind")) == "parking"]
    if len(parking_only) != 1:
        return None, False
    return _normalize_location(parking_only[0].get("name")), True


def _single_parking_outline_normalized(buildings: Optional[Sequence[Dict[str, Any]]]) -> Optional[str]:
    """지하주차장 윤곽이 정확히 1개일 때만 그 동명 정규화값(B2 등)."""
    loc, _ = _saved_work_parking_unify_context(buildings)
    return loc


def _pdam_location_text_mentions_parking(value: Any) -> bool:
    """PDAM 위치에 주차·지하 관련 표기가 있으면 True. 단일 지하주차장 윤곽 통합 시 Bn으로 묶는 데 쓴다."""
    raw = _cell_text(value)
    if not raw:
        return False
    compact = re.sub(r"[\s_\-()/]+", "", raw)
    if "주차장" in compact:
        return True
    if "주차" in compact:
        return True
    if "지하" in compact:
        return True
    return False


def _record_location_for_pdam_match(record: Dict[str, Any], parking_unified: Optional[str]) -> str:
    if not parking_unified:
        return _normalize_location(record.get("location"))
    if _pdam_location_text_mentions_parking(record.get("location")):
        return parking_unified
    norm = _normalize_location(record.get("location"))
    # 저장 윤곽 이름이 '주차장'뿐일 때(_normalize_location → '주차장') PDAM은 'B2'만 적는 경우가 있어
    # 도면 쪽 '주차장'·'B2'와 키가 어긋난다. 단일 주차 윤곽 맥락에서는 Bn도 그 구역으로 묶는다.
    if _normalize_location(parking_unified) == "주차장":
        loc_kind, _ = _location_kind_and_number(norm)
        if loc_kind == "basement":
            return parking_unified
    return norm


def _circle_location_for_pdam_match(
    circle: Dict[str, Any],
    parking_unified: Optional[str],
    *,
    unify_parking_circle_location: bool = False,
) -> str:
    """도면 `building_name`을 PDAM `location`과 **같은 규칙**으로 맞춘다.

    저장 작업에 지하주차장 윤곽이 1개일 때만 `parking_unified`(Bn)가 넘어오며,
    그때는 `_record_location_for_pdam_match`와 동일하게 '주차장'·'B2주차장' 등을 Bn으로 통일한다.
    (예전에는 `unify_parking_circle_location`만 켤 때만 묶어 PDAM과 키가 어긋나는 경우가 있었다.)
    `unify_parking_circle_location`은 호환용으로만 남기며 위치 계산에는 쓰지 않는다."""
    if parking_unified is None:
        return _normalize_location(circle.get("building_name"))
    return _record_location_for_pdam_match({"location": circle.get("building_name")}, parking_unified)


def _circle_number(circle: Dict[str, Any]) -> str:
    matched = circle.get("matched_text")
    if isinstance(matched, dict):
        return _normalize_pile_number(matched.get("text"))
    return ""


def _circle_center_radius_xy(circle: Dict[str, Any]) -> Tuple[float, float, float]:
    try:
        cx = float(circle.get("center_x") or 0)
        cy = float(circle.get("center_y") or 0)
        r = float(circle.get("radius") or (float(circle.get("diameter") or 0) / 2.0))
    except (TypeError, ValueError):
        return (0.0, 0.0, 0.0)
    return (cx, cy, r)


def _circles_strict_same_file_geometry(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """frontend `sameFileCircleGeometry` 와 동일(엄격, EPS=1e-4). DXF 이중 엔티티 병합용."""
    ax, ay, ra = _circle_center_radius_xy(a)
    bx, by, rb = _circle_center_radius_xy(b)
    eps = 1e-4
    return abs(ax - bx) <= eps and abs(ay - by) <= eps and abs(ra - rb) <= eps


def _circles_loose_same_file_geometry(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """frontend `sameFileCircleGeometryLoose` 와 동일. 「동일 좌표·크기 원 중복 제외」 켠 경우와 맞춤."""
    ax, ay, ra = _circle_center_radius_xy(a)
    bx, by, rb = _circle_center_radius_xy(b)
    if ra <= 0 or rb <= 0:
        return False
    eps = 1e-4
    dcx = abs(ax - bx)
    dcy = abs(ay - by)
    dr = abs(ra - rb)
    mn = min(ra, rb)
    center_tol = max(eps * 8, mn * 0.0035)
    r_tol = max(eps * 5, mn * 0.0025)
    return dcx <= center_tol and dcy <= center_tol and dr <= r_tol


def _circle_mapping_priority_score(circle: Dict[str, Any]) -> int:
    s = 0
    mt = circle.get("matched_text")
    if isinstance(mt, dict) and _cell_text(mt.get("text")):
        s += 4
    mtid = circle.get("matched_text_id")
    if mtid is not None and str(mtid).strip():
        s += 2
    if _cell_text(circle.get("building_name")):
        s += 1
    return s


def _pile_key_for_geom_dedup(circle: Dict[str, Any]) -> str:
    return _circle_number(circle) or ""


def _should_merge_geometry_duplicate_pair(
    a: Dict[str, Any],
    b: Dict[str, Any],
    *,
    exclude_identical_geometry_duplicates: bool,
) -> bool:
    """캔버스 옵션과 동일: 끄면 엄격 기하, 켜면 느슨 기하로 동일 말둑 심볼로 본다."""
    same_geom = (
        _circles_loose_same_file_geometry(a, b)
        if exclude_identical_geometry_duplicates
        else _circles_strict_same_file_geometry(a, b)
    )
    if not same_geom:
        return False
    ka = _pile_key_for_geom_dedup(a)
    kb = _pile_key_for_geom_dedup(b)
    if ka and kb and ka != kb:
        return False
    return True


def _fan_out_circle_mappings_for_geometry_clusters(
    overlays: List[Dict[str, Any]],
    rep_to_cluster: Dict[str, List[str]],
) -> List[Dict[str, Any]]:
    """대표 원에만 매핑된 PDAM 오버레이를, 기하 병합으로 빠진 동일 위치 형제 원 id에도 복제한다."""
    if not rep_to_cluster:
        return overlays
    out: List[Dict[str, Any]] = []
    for ov in overlays:
        cid = str(ov.get("circleId") or "")
        cluster = rep_to_cluster.get(cid)
        if not cluster or len(cluster) <= 1:
            out.append(ov)
            continue
        rep_id = cid
        for sid in cluster:
            dup = dict(ov)
            dup["circleId"] = sid
            if sid != rep_id:
                dup["pdamMappingSourceCircleId"] = rep_id
            else:
                dup.pop("pdamMappingSourceCircleId", None)
            out.append(dup)
    return out


def dedupe_circles_for_construction_mapping(
    circles: Sequence[Dict[str, Any]],
    *,
    exclude_identical_geometry_duplicates: bool = False,
) -> Tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
    """동일 기하(옵션에 따라 엄격/느슨)이고 말뚝 키가 같거나 한쪽만 비어 있으면 하나로 합친다.

    반환 두 번째 값: 대표 원 id → 병합에 포함된 모든 원 id(정렬, 대표 포함).
    시공 매칭은 대표 원 하나로만 수행하고, 응답 오버레이는 `_fan_out_circle_mappings_for_geometry_clusters`로 형제에 복제한다.
    """
    if len(circles) < 2:
        return list(circles), {}
    n = len(circles)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        pi, pj = find(i), find(j)
        if pi != pj:
            parent[pj] = pi

    for i in range(n):
        for j in range(i + 1, n):
            if _should_merge_geometry_duplicate_pair(
                circles[i],
                circles[j],
                exclude_identical_geometry_duplicates=exclude_identical_geometry_duplicates,
            ):
                union(i, j)

    groups: Dict[int, List[int]] = {}
    for i in range(n):
        r = find(i)
        groups.setdefault(r, []).append(i)

    clusters: Dict[str, List[str]] = {}
    out: List[Dict[str, Any]] = []
    for root in sorted(groups.keys()):
        idxs = groups[root]
        best_idx = min(
            idxs,
            key=lambda ii: (
                -_circle_mapping_priority_score(circles[ii]),
                str(circles[ii].get("id") or ""),
            ),
        )
        rep = circles[best_idx]
        member_ids = sorted({str(circles[i].get("id") or "") for i in idxs} - {""})
        rep_id = str(rep.get("id") or "")
        out.append(rep)
        if rep_id and len(member_ids) > 1:
            clusters[rep_id] = sorted(member_ids)
    return out, clusters


def build_dashboard(
    dataset_id: str,
    *,
    circles: Optional[Sequence[Dict[str, Any]]] = None,
    work_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[str] = None,
    equipment: Optional[str] = None,
    method: Optional[str] = None,
    location: Optional[str] = None,
    remaining_threshold: Optional[float] = None,
    exclude_identical_geometry_duplicates: bool = False,
) -> Dict[str, Any]:
    dataset = _get_dataset(dataset_id)
    if not dataset:
        raise ValueError("시공기록 데이터셋을 찾지 못했습니다.")

    all_records = _list_records(dataset_id)
    filtered_records = _apply_filters(
        all_records,
        date_from=date_from,
        date_to=date_to,
        month=month,
        equipment=equipment,
        method=method,
        location=location,
    )
    parking_unified_location: Optional[str] = None
    unify_parking_circle_location = False
    saved_buildings: Optional[List[Dict[str, Any]]] = None
    if work_id:
        saved_buildings = _load_saved_work_buildings(work_id)
        parking_unified_location, unify_parking_circle_location = _saved_work_parking_unify_context(saved_buildings)

    latest_records = _without_header_echo_records(
        _latest_records_by_pile(filtered_records, parking_unified_location=parking_unified_location)
    )
    if circles is None and work_id:
        circles = _load_saved_work_circles(work_id)
    circles, geom_clusters = dedupe_circles_for_construction_mapping(
        list(circles or []),
        exclude_identical_geometry_duplicates=exclude_identical_geometry_duplicates,
    )

    remaining_values = [record["pile_remaining"] for record in latest_records if record.get("pile_remaining") is not None]
    over_threshold_count = 0
    if remaining_threshold is not None:
        over_threshold_count = sum(
            1
            for record in latest_records
            if record.get("pile_remaining") is not None and float(record["pile_remaining"]) >= remaining_threshold
        )

    mapping = (
        map_records_to_circles(
            latest_records,
            circles,
            parking_unified_location=parking_unified_location,
            unify_parking_circle_location=unify_parking_circle_location,
            outline_buildings=saved_buildings,
        )
        if circles
        else {
            "circleMappings": [],
            "matchedCircleCount": None,
            "pendingCircleCount": None,
            "unmatchedRecordCount": None,
        }
    )
    if mapping.get("circleMappings") is not None:
        mapping["circleMappings"] = _fan_out_circle_mappings_for_geometry_clusters(
            list(mapping["circleMappings"]),
            geom_clusters,
        )

    records_for_grid = sorted(
        latest_records,
        key=lambda record: (
            record.get("construction_date") or "",
            record.get("location") or "",
            record.get("pile_number_sort") if record.get("pile_number_sort") is not None else 10**9,
            record.get("pile_number") or "",
        ),
    )[:MAX_RECORDS_IN_RESPONSE]

    return {
        "dataset": dataset,
        "filters": {
            "applied": {
                "dateFrom": date_from,
                "dateTo": date_to,
                "month": month,
                "equipment": equipment,
                "method": method,
                "location": location,
                "remainingThreshold": remaining_threshold,
            },
            "options": _build_filter_options(all_records),
        },
        "summary": {
            "recordCount": len(filtered_records),
            "uniquePileCount": len(latest_records),
            "installedPileCount": sum(1 for record in latest_records if record.get("installed")),
            "matchedCircleCount": mapping["matchedCircleCount"],
            "pendingCircleCount": mapping["pendingCircleCount"],
            "unmatchedRecordCount": mapping["unmatchedRecordCount"],
            "autoMatchedCount": mapping.get("autoMatchedCount", 0),
            "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
            "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
            "overThresholdCount": over_threshold_count,
        },
        "charts": {
            "byDate": _build_date_series(filtered_records, "construction_date", remaining_threshold),
            "byMonth": _build_date_series(filtered_records, "construction_month", remaining_threshold),
            "byEquipment": _group_summary(filtered_records, "equipment"),
            "byMethod": _group_summary(filtered_records, "construction_method"),
            "methodMatrix": _build_method_matrix(filtered_records),
        },
        "records": records_for_grid,
        "mapping": mapping,
    }


WEEKDAY_LABELS = ("월", "화", "수", "목", "금", "토", "일")
LOCATION_PLACEHOLDERS = {"", "-", "시공위치", "위치", "미지정", "N/A", "NA"}


def _normalize_location(value: Any) -> str:
    text = _cell_text(value)
    if not text:
        return "미지정"
    raw_compact = re.sub(r"[\s_\-()/]+", "", text)
    compact = raw_compact.upper()
    if not compact or compact in LOCATION_PLACEHOLDERS:
        return "미지정"
    if re.fullmatch(r"BUILDING\d+", compact):
        return "미지정"

    basement_match = re.search(r"B(\d+)", compact)
    if basement_match:
        return f"B{int(basement_match.group(1))}"
    if "지하" in raw_compact:
        basement_digits = re.findall(r"\d+", raw_compact)
        if basement_digits:
            return f"B{int(basement_digits[0])}"
        return "B"
    if compact == "B" or compact.startswith("B"):
        return "B"

    tower_plain = re.fullmatch(r"T(\d+)", compact, flags=re.IGNORECASE)
    if tower_plain:
        return f"T{int(tower_plain.group(1))}"
    tw_ko = re.search(r"(?:타워크레인|타워)\s*(\d+)", text, flags=re.IGNORECASE)
    if tw_ko:
        return f"T{int(tw_ko.group(1))}"
    tower_embed = re.search(r"(?i)T\s*(\d+)", compact)
    if tower_embed:
        return f"T{int(tower_embed.group(1))}"

    dong_match = re.match(r"^(\d+)(?:동)?$", compact)
    if dong_match:
        return f"{int(dong_match.group(1))}동"

    if "동" in compact:
        digits = re.findall(r"\d+", compact)
        if digits:
            return f"{int(digits[0])}동"

    digits_only = re.fullmatch(r"\d+", compact)
    if digits_only:
        return f"{int(digits_only.group(0))}동"

    if "주차장" in compact:
        return "주차장"

    return compact


UNSPECIFIED_LOCATION = _normalize_location("")


def _date_bounds(records: Iterable[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    dates = sorted(record.get("construction_date") for record in records if record.get("construction_date"))
    if not dates:
        return None, None
    return dates[0], dates[-1]


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _coerce_int(value: Optional[int], default: int, minimum: int, maximum: int) -> int:
    try:
        number = int(value if value is not None else default)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def _shift_month(year: int, month: int, delta: int) -> Tuple[int, int]:
    raw_month = month + delta
    while raw_month <= 0:
        raw_month += 12
        year -= 1
    while raw_month > 12:
        raw_month -= 12
        year += 1
    return year, raw_month


def _last_day_of_month(year: int, month: int) -> int:
    next_year, next_month = _shift_month(year, month, 1)
    return (date(next_year, next_month, 1) - timedelta(days=1)).day


def _build_settlement_period(
    months: Sequence[str],
    settlement_month: Optional[str],
    settlement_start_day: Optional[int],
    settlement_end_day: Optional[int],
) -> Dict[str, Any]:
    available_months = sorted(month for month in months if month)
    resolved_month = settlement_month if settlement_month in available_months else (available_months[-1] if available_months else None)
    start_day = _coerce_int(settlement_start_day, 25, 1, 31)
    end_day = _coerce_int(settlement_end_day, 20, 1, 31)
    if not resolved_month:
        return {
            "month": None,
            "startDay": start_day,
            "endDay": end_day,
            "startDate": None,
            "endDate": None,
            "label": None,
        }

    year, month = (int(part) for part in resolved_month.split("-", 1))
    start_year, start_month = (year, month)
    if end_day < start_day:
        start_year, start_month = _shift_month(year, month, -1)

    start_day = min(start_day, _last_day_of_month(start_year, start_month))
    end_day = min(end_day, _last_day_of_month(year, month))
    start_date = date(start_year, start_month, start_day)
    end_date = date(year, month, end_day)
    return {
        "month": resolved_month,
        "startDay": start_day,
        "endDay": end_day,
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "label": f"{resolved_month} 기성 ({start_date.isoformat()} ~ {end_date.isoformat()})",
    }


def _merge_filter_values(
    single: Optional[str],
    multi: Optional[Sequence[str]],
    *,
    normalizer=None,
) -> List[str]:
    merged: List[str] = []
    for raw in [single, *(multi or [])]:
        text = _cell_text(raw)
        if not text or text.upper() == "ALL":
            continue
        value = normalizer(text) if normalizer else text
        if value and value not in merged:
            merged.append(value)
    return merged


def _normalize_dashboard_record(record: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(record)
    normalized["construction_method"] = _normalize_construction_method(record.get("construction_method"))
    return normalized


def _apply_filters(
    records: Iterable[Dict[str, Any]],
    *,
    date_from: Optional[str],
    date_to: Optional[str],
    month: Optional[str],
    equipment: Optional[str] = None,
    method: Optional[str] = None,
    location: Optional[str] = None,
    equipments: Optional[Sequence[str]] = None,
    methods: Optional[Sequence[str]] = None,
    locations: Optional[Sequence[str]] = None,
    parking_unified_location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    equipment_values = set(_merge_filter_values(equipment, equipments))
    method_values = set(_merge_filter_values(method, methods, normalizer=_normalize_construction_method))
    location_values = set(_merge_filter_values(location, locations, normalizer=_normalize_location))
    month = _cell_text(month)

    filtered: List[Dict[str, Any]] = []
    for record in records:
        rec_date = record.get("construction_date")
        if date_from and rec_date and rec_date < date_from:
            continue
        if date_to and rec_date and rec_date > date_to:
            continue
        if month and (record.get("construction_month") or "") != month:
            continue
        if equipment_values and (record.get("equipment") or "") not in equipment_values:
            continue
        if method_values and (_normalize_construction_method(record.get("construction_method")) or "") not in method_values:
            continue
        if location_values:
            nl = _normalize_location(record.get("location"))
            ok_loc = nl in location_values
            if not ok_loc and parking_unified_location:
                mapped = _record_location_for_pdam_match(record, parking_unified_location)
                ok_loc = mapped in location_values
            if not ok_loc:
                continue
        filtered.append(record)
    return filtered


_OPTION_HEADER_ECHO_FIELD = {
    "equipment": "equipment",
    "construction_method": "construction_method",
    "location": "location",
}


def _option_items(
    records: Iterable[Dict[str, Any]],
    key_name: str,
    *,
    normalizer=None,
    sort_key=None,
) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    echo_field = _OPTION_HEADER_ECHO_FIELD.get(key_name)
    for record in records:
        raw_value = _cell_text(record.get(key_name))
        if not raw_value:
            continue
        if echo_field and _cell_matches_column_header_echo(raw_value, echo_field):
            continue
        value = normalizer(raw_value) if normalizer else raw_value
        if not value:
            continue
        bucket = grouped.setdefault(
            value,
            {"value": value, "label": value, "count": 0, "aliases": set()},
        )
        bucket["count"] += 1
        bucket["aliases"].add(raw_value)

    items = []
    for bucket in grouped.values():
        items.append(
            {
                "value": bucket["value"],
                "label": bucket["label"],
                "count": bucket["count"],
                "aliases": sorted(bucket["aliases"]),
            }
        )
    items.sort(key=sort_key or (lambda item: item["label"]))
    return items


def _location_option_sort(item: Dict[str, Any]) -> Tuple[int, Any, str]:
    value = item["value"]
    dong_match = re.fullmatch(r"(\d+)동", value)
    if dong_match:
        return (0, int(dong_match.group(1)), value)
    tower_match = re.fullmatch(r"T(\d+)", value, flags=re.IGNORECASE)
    if tower_match:
        return (2, int(tower_match.group(1)), value)
    basement_match = re.fullmatch(r"B(\d+)", value)
    if basement_match:
        return (3, int(basement_match.group(1)), value)
    if value == "B":
        return (3, 9999, value)
    if value == "주차장":
        return (4, 0, value)
    if value == "미지정":
        return (9, 0, value)
    return (5, 0, value)


def _build_filter_options(records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    record_list = _without_header_echo_records(list(records))
    min_date, max_date = _date_bounds(record_list)
    dates = sorted({record.get("construction_date") for record in record_list if record.get("construction_date")})
    months = sorted({record.get("construction_month") for record in record_list if record.get("construction_month")})
    return {
        "dateBounds": {"min": min_date, "max": max_date},
        "dates": dates,
        "months": months,
        "equipments": _option_items(record_list, "equipment"),
        "methods": _option_items(record_list, "construction_method", normalizer=_normalize_construction_method),
        "locations": _option_items(record_list, "location", normalizer=_normalize_location, sort_key=_location_option_sort),
    }


def _group_summary(records: Iterable[Dict[str, Any]], key_name: str) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in records:
        if key_name == "construction_method":
            key = _normalize_construction_method(record.get(key_name)) or "미분류"
        else:
            key = _cell_text(record.get(key_name)) or "미분류"
        grouped[key].append(record)
    summaries: List[Dict[str, Any]] = []
    for key, items in grouped.items():
        latest = _latest_records_by_pile(items)
        remaining_values = [item["pile_remaining"] for item in latest if item.get("pile_remaining") is not None]
        penetration_values = [item["penetration_depth"] for item in latest if item.get("penetration_depth") is not None]
        summaries.append(
            {
                "key": key,
                "recordCount": len(items),
                "uniquePileCount": len(latest),
                "installedPileCount": sum(1 for item in latest if item.get("installed")),
                "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
                "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                "totalPenetrationDepth": round(sum(penetration_values), 3) if penetration_values else 0.0,
            }
        )
    summaries.sort(key=lambda item: item["key"])
    return summaries


def _build_date_series(
    records: Iterable[Dict[str, Any]],
    key_name: str,
    remaining_threshold: Optional[float],
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in records:
        key = record.get(key_name) or "미입력"
        grouped[key].append(record)

    result: List[Dict[str, Any]] = []
    if key_name == "construction_date" and start_date and end_date:
        start_dt = _parse_iso_date(start_date)
        end_dt = _parse_iso_date(end_date)
        cursor = start_dt
        while cursor and end_dt and cursor <= end_dt:
            key = cursor.isoformat()
            items = grouped.get(key, [])
            latest = _latest_records_by_pile(items)
            remaining_values = [item["pile_remaining"] for item in latest if item.get("pile_remaining") is not None]
            over_threshold = 0
            if remaining_threshold is not None:
                over_threshold = sum(
                    1
                    for item in latest
                    if item.get("pile_remaining") is not None and float(item["pile_remaining"]) >= remaining_threshold
                )
            result.append(
                {
                    "key": key,
                    "label": f"{cursor.month:02d}.{cursor.day:02d} ({WEEKDAY_LABELS[cursor.weekday()]})",
                    "weekday": WEEKDAY_LABELS[cursor.weekday()],
                    "recordCount": len(items),
                    "uniquePileCount": len(latest),
                    "installedPileCount": sum(1 for item in latest if item.get("installed")),
                    "pendingPileCount": sum(1 for item in latest if not item.get("installed")),
                    "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
                    "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                    "overThresholdCount": over_threshold,
                }
            )
            cursor += timedelta(days=1)
        return result

    for key, items in sorted(grouped.items(), key=lambda item: item[0]):
        latest = _latest_records_by_pile(items)
        remaining_values = [item["pile_remaining"] for item in latest if item.get("pile_remaining") is not None]
        over_threshold = 0
        if remaining_threshold is not None:
            over_threshold = sum(
                1
                for item in latest
                if item.get("pile_remaining") is not None and float(item["pile_remaining"]) >= remaining_threshold
            )
        result.append(
            {
                "key": key,
                "label": key,
                "weekday": None,
                "recordCount": len(items),
                "uniquePileCount": len(latest),
                "installedPileCount": sum(1 for item in latest if item.get("installed")),
                "pendingPileCount": sum(1 for item in latest if not item.get("installed")),
                "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
                "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                "overThresholdCount": over_threshold,
            }
        )
    return result


def _build_method_matrix(records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    latest = _latest_records_by_pile(records)
    methods = sorted({_normalize_construction_method(item.get("construction_method")) or "미분류" for item in latest})
    pile_types = sorted({_cell_text(item.get("pile_type")) or "미분류" for item in latest})
    cells: List[Dict[str, Any]] = []
    for method in methods:
        for pile_type in pile_types:
            cell_records = [
                item
                for item in latest
                if (_normalize_construction_method(item.get("construction_method")) or "미분류") == method
                and (_cell_text(item.get("pile_type")) or "미분류") == pile_type
            ]
            remaining_values = [item["pile_remaining"] for item in cell_records if item.get("pile_remaining") is not None]
            penetration_values = [item["penetration_depth"] for item in cell_records if item.get("penetration_depth") is not None]
            cells.append(
                {
                    "row": method,
                    "column": pile_type,
                    "count": len(cell_records),
                    "installedCount": sum(1 for item in cell_records if item.get("installed")),
                    "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
                    "totalPenetrationDepth": round(sum(penetration_values), 3) if penetration_values else 0.0,
                }
            )
    return {"rows": methods, "columns": pile_types, "cells": cells}


def _location_score(circle_location: str, record_location: str) -> int:
    if not circle_location or not record_location:
        return 0
    if circle_location == record_location:
        return 4

    circle_is_basement = circle_location.startswith("B")
    record_is_basement = record_location.startswith("B")
    if circle_is_basement != record_is_basement:
        return 0

    circle_digits = re.sub(r"\D", "", circle_location)
    record_digits = re.sub(r"\D", "", record_location)
    if circle_digits and circle_digits == record_digits:
        if circle_location.endswith("동") and record_location.endswith("동"):
            return 3
        return 2

    if circle_location in record_location or record_location in circle_location:
        return 1
    return 0


def _location_kind_and_number(value: Any) -> Tuple[str, Optional[int]]:
    location = _normalize_location(value)
    basement_match = re.fullmatch(r"B(\d+)", location)
    if basement_match:
        return "basement", int(basement_match.group(1))
    if location == "B":
        return "basement", None

    dong_match = re.fullmatch(r"(\d+)동", location)
    if dong_match:
        return "dong", int(dong_match.group(1))

    if location == "미지정":
        return "unspecified", None
    return "other", None


def _split_prefixed_pile_number(value: Any) -> Tuple[str, Optional[str], Optional[str]]:
    pile_number = _normalize_pile_number(value)
    if not pile_number:
        return "", None, None
    match = re.fullmatch(r"([A-Z]?\d+)-(\d+)", pile_number)
    if not match:
        return pile_number, None, None
    prefix, suffix = match.groups()
    suffix_value = _normalize_pile_number(suffix)
    if not suffix_value:
        return pile_number, None, None
    return pile_number, _normalize_pile_number(prefix), suffix_value


def _pile_number_aliases(value: Any, *, location: Any = None) -> List[str]:
    pile_number, _prefix, suffix = _split_prefixed_pile_number(value)
    if not pile_number:
        return []

    aliases = [pile_number]
    if not suffix:
        return aliases
    if suffix == pile_number:
        return aliases
    return [suffix, *aliases]


def _dedupe_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique_records: List[Dict[str, Any]] = []
    seen_keys: set[Tuple[str, str]] = set()
    for record in records:
        key = _record_key(record)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        unique_records.append(record)
    return unique_records


GENERIC_LOCATION_INFERENCE_TARGETS = {UNSPECIFIED_LOCATION, "주차장", "B"}
PARKING_INFERENCE_MAX_DAY_GAP = 5
PARKING_INFERENCE_DAY_SCORE = {
    0: 9,
    1: 7,
    2: 5,
    3: 3,
    4: 2,
    5: 1,
}


def _is_parking_like_placeholder_location(value: Any) -> bool:
    normalized = _normalize_location(value)
    if normalized in GENERIC_LOCATION_INFERENCE_TARGETS:
        return True
    raw_text = _cell_text(value)
    if not raw_text:
        return False
    compact = re.sub(r"[\s_\-()/]+", "", raw_text)
    return "주차장" in compact or "지하" in compact


def _allow_globally_unique_pile_alias_fallback(
    *,
    circle_location_display: Any,
    circle_kind: str,
    parking_unified_location: Optional[str],
) -> bool:
    """PDAM 시공위치 키가 어긋날 때만 전역 유일 파일번호로 한 번 더 연결한다.

    `N동` 도면은 동 구분이 필수라서(같은 파일번호가 여러 동에 존재할 수 있음) 전역 유일 폴백을 쓰지 않는다.
    지하주차(Bn)·주차장 추론 경로는 건드리지 않는다.
    """
    if circle_kind == "dong":
        return False
    if circle_kind == "basement":
        return False
    if parking_unified_location is None and _is_parking_like_placeholder_location(circle_location_display):
        return False
    return True


def _candidate_match_location(
    record: Dict[str, Any],
    location_inference: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    *,
    circle_location: Optional[str] = None,
) -> str:
    raw_location = _normalize_location(record.get("location"))
    if location_inference:
        inferred = location_inference.get(_record_key(record))
        if inferred and inferred.get("matchLocation"):
            inferred_norm = _normalize_location(inferred.get("matchLocation"))
            if (
                circle_location
                and _location_score(circle_location, inferred_norm) <= 0
                and raw_location in GENERIC_LOCATION_INFERENCE_TARGETS
            ):
                return raw_location
            return inferred_norm
    return raw_location


def _build_location_inference(
    records: Sequence[Dict[str, Any]],
) -> Dict[Tuple[str, str], Dict[str, Any]]:
    inference: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for record in records:
        normalized_location = _normalize_location(record.get("location"))
        location_kind, location_number = _location_kind_and_number(normalized_location)
        if location_kind == "dong" or (location_kind == "basement" and location_number is not None):
            continue
        if not _is_parking_like_placeholder_location(record.get("location")):
            continue

        equipment = _cell_text(record.get("equipment"))
        construction_date = _parse_iso_date(record.get("construction_date"))
        if not equipment or not construction_date:
            continue

        method = _normalize_construction_method(record.get("construction_method"))
        row_number = int(record.get("row_number") or 0)
        scores: Dict[str, int] = defaultdict(int)
        support_counts: Dict[str, int] = defaultdict(int)
        evidence: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for neighbor in records:
            if neighbor is record:
                continue
            if _cell_text(neighbor.get("equipment")) != equipment:
                continue
            neighbor_location = _normalize_location(neighbor.get("location"))
            neighbor_kind, neighbor_number = _location_kind_and_number(neighbor_location)
            if neighbor_kind != "basement" or neighbor_number is None:
                continue
            neighbor_date = _parse_iso_date(neighbor.get("construction_date"))
            if not neighbor_date:
                continue

            day_gap = abs((neighbor_date - construction_date).days)
            if day_gap > PARKING_INFERENCE_MAX_DAY_GAP:
                continue

            score = PARKING_INFERENCE_DAY_SCORE.get(day_gap, 0)
            neighbor_row_number = int(neighbor.get("row_number") or 0)
            if day_gap == 0 and row_number and neighbor_row_number and abs(neighbor_row_number - row_number) <= 5:
                score += 2
            if method and method == _normalize_construction_method(neighbor.get("construction_method")):
                score += 1

            scores[neighbor_location] += score
            support_counts[neighbor_location] += 1
            if len(evidence[neighbor_location]) < 3:
                evidence[neighbor_location].append(
                    {
                        "constructionDate": neighbor.get("construction_date"),
                        "location": neighbor_location,
                        "equipment": equipment,
                        "rowNumber": neighbor.get("row_number"),
                    }
                )

        if not scores:
            continue

        ranked = sorted(
            scores.items(),
            key=lambda item: (item[1], _location_option_sort({"value": item[0]})),
            reverse=True,
        )
        top_location, top_score = ranked[0]
        second_location = ranked[1][0] if len(ranked) > 1 else None
        second_score = ranked[1][1] if len(ranked) > 1 else 0
        top_support = support_counts.get(top_location, 0)
        second_support = support_counts.get(second_location or "", 0)
        minimum_score = 7 if normalized_location == UNSPECIFIED_LOCATION else 4
        if top_score < minimum_score:
            continue
        if top_score == second_score and top_support <= second_support:
            continue
        if top_score == second_score and top_support == second_support == 0:
            continue

        evidence_items = evidence.get(top_location, [])
        evidence_summary = ", ".join(
            f"{item['constructionDate']} {item['location']}"
            for item in evidence_items
            if item.get("constructionDate") and item.get("location")
        )
        inference[_record_key(record)] = {
            "matchLocation": top_location,
            "sourceLocation": normalized_location,
            "basis": "equipment_date_basement_context",
            "score": top_score,
            "secondScore": second_score,
            "reason": (
                f"{equipment} 주변 시공 흐름 기준 {top_location} 우세"
                + (f" · 근거 {top_support}건" if top_support else "")
                + (f" ({evidence_summary})" if evidence_summary else "")
            ),
            "evidence": evidence_items,
        }

    return inference


def _scoring_match_location(
    record: Dict[str, Any],
    location_inference: Optional[Dict[Tuple[str, str], Dict[str, Any]]],
    circle_location: str,
    parking_unified_location: Optional[str],
) -> str:
    raw_location = _normalize_location(record.get("location"))
    pdam_key = (
        _record_location_for_pdam_match(record, parking_unified_location)
        if parking_unified_location
        else raw_location
    )
    if not location_inference:
        return pdam_key
    inferred = location_inference.get(_record_key(record))
    if inferred and inferred.get("matchLocation"):
        inferred_norm = _normalize_location(inferred.get("matchLocation"))
        if (
            circle_location
            and _location_score(circle_location, inferred_norm) <= 0
            and raw_location in GENERIC_LOCATION_INFERENCE_TARGETS
        ):
            return pdam_key
        return inferred_norm
    return pdam_key


def _candidate_rank(
    circle_location: str,
    record: Dict[str, Any],
    location_inference: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    parking_unified_location: Optional[str] = None,
) -> Tuple[int, int, int, int, str, int]:
    match_location = _scoring_match_location(
        record, location_inference, circle_location, parking_unified_location
    )
    raw_location = _normalize_location(record.get("location"))
    inferred = location_inference.get(_record_key(record)) if location_inference else None
    return (
        _location_score(circle_location, match_location),
        1 if match_location == circle_location else 0,
        1 if inferred and inferred.get("matchLocation") == circle_location else 0,
        1 if raw_location == UNSPECIFIED_LOCATION else 0,
        record.get("construction_date") or "",
        int(record.get("row_number") or 0),
    )


def _has_clear_best_candidate(
    circle_location: str,
    candidates: Iterable[Dict[str, Any]],
    location_inference: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    parking_unified_location: Optional[str] = None,
) -> bool:
    ranked = sorted(
        _dedupe_records(candidates),
        key=lambda record: _candidate_rank(
            circle_location, record, location_inference, parking_unified_location
        ),
        reverse=True,
    )
    if not ranked:
        return False

    top = ranked[0]
    top_location = _scoring_match_location(
        top, location_inference, circle_location, parking_unified_location
    )
    circle_kind, _circle_number = _location_kind_and_number(circle_location)
    if circle_location == UNSPECIFIED_LOCATION:
        candidate_locations = {
            _scoring_match_location(record, location_inference, circle_location, parking_unified_location)
            for record in ranked
        }
        return len(ranked) == 1 or len(candidate_locations) == 1
    if _location_score(circle_location, top_location) <= 0 and not (circle_kind != "dong" and top_location == UNSPECIFIED_LOCATION):
        return False
    if len(ranked) == 1:
        return True
    return _candidate_rank(circle_location, ranked[0], location_inference, parking_unified_location) > _candidate_rank(
        circle_location, ranked[1], location_inference, parking_unified_location
    )


def _display_pile_number(value: Any, *, location: Any = None) -> str:
    aliases = _pile_number_aliases(value, location=location)
    if aliases:
        return aliases[0]
    return _normalize_pile_number(value)


def _circle_display_pile_number(circle: Dict[str, Any]) -> str:
    return _display_pile_number(_circle_number(circle), location=circle.get("building_name"))


def _diagnostic_display_pile_number(value: Any, *, location: Any = None) -> str:
    pile_number, prefix_token, suffix = _split_prefixed_pile_number(value)
    if not pile_number or not prefix_token or not suffix:
        return pile_number

    prefix_location = _normalize_location(prefix_token)
    normalized_location = _normalize_location(location)
    basement_match = re.fullmatch(r"B(\d+)", normalized_location)
    if basement_match:
        if prefix_location == normalized_location:
            return suffix
        return pile_number

    location_digits = re.sub(r"\D", "", normalized_location)
    if location_digits and normalized_location != UNSPECIFIED_LOCATION and not normalized_location.startswith("B"):
        short_digits = str(int(location_digits) % 100)
        if prefix_token in {location_digits, short_digits} or prefix_location in {
            normalized_location,
            f"{int(location_digits)}동",
            f"{int(short_digits)}동",
        }:
            return suffix
        return pile_number

    return _display_pile_number(pile_number, location=location)


def _mapping_overlay_payload(
    circle: Dict[str, Any],
    circle_location: str,
    pile_number: str,
    matched_record: Optional[Dict[str, Any]],
    *,
    match_type: str,
    auto_matched: bool,
    location_inference: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    matched_location = (
        _normalize_location(location_inference.get("matchLocation"))
        if location_inference and location_inference.get("matchLocation")
        else _normalize_location(matched_record.get("location")) if matched_record else circle_location
    )
    source_location = _normalize_location(matched_record.get("location")) if matched_record else None
    pdam_complete = bool(matched_record and _record_installed(matched_record))
    return {
        "circleId": circle.get("id"),
        "status": "installed" if pdam_complete else "pending",
        "pdamRecordComplete": pdam_complete,
        "matchType": match_type,
        "autoMatched": auto_matched,
        "pileNumber": _display_pile_number(pile_number, location=circle_location) or None,
        "circleLocation": circle_location,
        "circleLocationKind": _location_kind_and_number(circle_location)[0],
        "constructionDate": matched_record.get("construction_date") if matched_record else None,
        "constructionMonth": matched_record.get("construction_month") if matched_record else None,
        "equipment": matched_record.get("equipment") if matched_record else None,
        "pileType": matched_record.get("pile_type") if matched_record else None,
        "constructionMethod": _normalize_construction_method(matched_record.get("construction_method")) if matched_record else None,
        "location": matched_record.get("location") if matched_record else None,
        "locationNormalized": matched_location,
        "sourceLocationNormalized": source_location,
        "matchedRecordPileNumber": matched_record.get("pile_number") if matched_record else None,
        "matchedRecordDisplayPileNumber": _display_pile_number(matched_record.get("pile_number"), location=matched_record.get("location")) if matched_record else None,
        "pileRemaining": matched_record.get("pile_remaining") if matched_record else None,
        "penetrationDepth": matched_record.get("penetration_depth") if matched_record else None,
        "boringDepth": matched_record.get("boring_depth") if matched_record else None,
        "excavationDepth": matched_record.get("excavation_depth") if matched_record else None,
        "recordRowNumber": matched_record.get("row_number") if matched_record else None,
        "inferredRecordLocation": matched_location if location_inference and matched_location != source_location else None,
        "inferenceBasis": location_inference.get("basis") if location_inference else None,
        "inferenceReason": location_inference.get("reason") if location_inference else None,
        "inferenceEvidence": location_inference.get("evidence") if location_inference else None,
    }


def _diagnostic_display_key(location: Any, pile_number: Any) -> Tuple[str, str]:
    return (
        _normalize_location(location),
        _diagnostic_display_pile_number(pile_number, location=location),
    )


def _diagnostic_sort_key(
    *,
    location: Any,
    pile_number: Any,
    pile_number_sort: Any = None,
    construction_date: Optional[str] = None,
) -> Tuple[Tuple[int, Any, str], int, str, int]:
    try:
        sort_number = int(pile_number_sort) if pile_number_sort is not None else None
    except (TypeError, ValueError):
        sort_number = None
    if sort_number is None:
        sort_number = _pile_sort_value(_cell_text(pile_number)) if pile_number is not None else None
    if sort_number is None:
        sort_number = 10**9
    parsed_date = _parse_iso_date(construction_date)
    date_rank = -parsed_date.toordinal() if parsed_date else 0
    normalized_location = _normalize_location(location)
    return (
        _location_option_sort({"value": normalized_location}),
        sort_number,
        _cell_text(pile_number),
        date_rank,
    )


def _select_circle_record(
    circle_location: str,
    candidates: Iterable[Dict[str, Any]],
    location_inference: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    parking_unified_location: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    unique_candidates = _dedupe_records(candidates)
    if not unique_candidates:
        return None

    ranked = sorted(
        unique_candidates,
        key=lambda record: _candidate_rank(
            circle_location, record, location_inference, parking_unified_location
        ),
        reverse=True,
    )
    top = ranked[0]
    top_location = _scoring_match_location(
        top, location_inference, circle_location, parking_unified_location
    )
    circle_kind, _circle_number = _location_kind_and_number(circle_location)

    if circle_location == UNSPECIFIED_LOCATION:
        candidate_locations = {
            _scoring_match_location(record, location_inference, circle_location, parking_unified_location)
            for record in ranked
        }
        if len(ranked) == 1 or len(candidate_locations) == 1:
            return top
        return None

    if _location_score(circle_location, top_location) > 0:
        return top
    if circle_kind != "dong" and top_location == UNSPECIFIED_LOCATION:
        return top
    return None


def map_records_to_circles(
    records: Iterable[Dict[str, Any]],
    circles: Sequence[Dict[str, Any]],
    *,
    parking_unified_location: Optional[str] = None,
    unify_parking_circle_location: bool = False,
    outline_buildings: Optional[Sequence[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    latest_records = _latest_records_by_pile(records, parking_unified_location=parking_unified_location)
    location_inference = _build_location_inference(latest_records)
    exact_lookup: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    by_number: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in latest_records:
        record_location = _record_location_for_pdam_match(record, parking_unified_location)
        for alias in _pile_number_aliases(record.get("pile_number"), location=record_location):
            exact_lookup[(record_location, alias)].append(record)
            by_number[alias].append(record)

    overlays: List[Dict[str, Any]] = []
    matched_record_keys: set[Tuple[str, str]] = set()
    installed_count = 0
    pending_count = 0
    unresolved_circles: List[Dict[str, Any]] = []

    for circle in circles:
        effective_label = _circle_effective_building_label(circle, outline_buildings)
        circle_for_match = dict(circle)
        circle_for_match["building_name"] = effective_label
        pile_number = _circle_number(circle)
        circle_location_display = _normalize_location(
            effective_label if effective_label is not None else circle.get("building_name")
        )
        circle_location = _circle_location_for_pdam_match(
            circle_for_match,
            parking_unified_location,
            unify_parking_circle_location=unify_parking_circle_location,
        )
        circle_kind, _circle_number_value = _location_kind_and_number(circle_location)
        matched_record: Optional[Dict[str, Any]] = None
        match_type = "pending"
        circle_aliases = (
            _pile_number_aliases(pile_number, location=circle_location_display) if pile_number else []
        )
        scoring_circle_location = circle_location

        if pile_number:
            exact_candidates: List[Dict[str, Any]] = []
            for alias in circle_aliases:
                exact_candidates.extend(exact_lookup.get((circle_location, alias), []))
            exact_candidates = _dedupe_records(exact_candidates)
            # 타워크레인 윤곽이 주차장보다 우선(classify_entities)되어, 겹치는 좌표는
            # building_name이 타워로 잡히고 PDAM(주차장→Bn) 인덱스 키와 어긋날 수 있다.
            # 단일 주차 통합이 있을 때만: 부위 불일치로 후보가 없으면 통합 부위+파일번호로 한 번 더 본다.
            # N동 도면은 주차 PDAM과 키가 달라도 여기서 엮지 않는다(주차 번호가 동에 붙는 오류 방지).
            if (
                not exact_candidates
                and parking_unified_location
                and circle_kind != "dong"
                and _normalize_location(parking_unified_location) != circle_location
            ):
                parking_loc = _normalize_location(parking_unified_location)
                fallback: List[Dict[str, Any]] = []
                for alias in circle_aliases:
                    fallback.extend(exact_lookup.get((parking_loc, alias), []))
                fallback = _dedupe_records(fallback)
                if len(fallback) == 1:
                    exact_candidates = fallback
                    scoring_circle_location = parking_loc
            if _has_clear_best_candidate(
                scoring_circle_location, exact_candidates, location_inference, parking_unified_location
            ):
                matched_record = _select_circle_record(
                    scoring_circle_location, exact_candidates, location_inference, parking_unified_location
                )
                if matched_record:
                    match_type = "exact"
        # 부위 문자열이 도면·PDAM에서 어긋나 exact 가 비어도, 최신 PDAM 행 중 해당 번호가
        # 전체에서 단 하나뿐이면 연결한다(예: 단일 479 행이 있는데 위치 키만 불일치).
        if (
            not matched_record
            and pile_number
            and circle_aliases
            and _allow_globally_unique_pile_alias_fallback(
                circle_location_display=circle_location_display,
                circle_kind=circle_kind,
                parking_unified_location=parking_unified_location,
            )
        ):
            for alias in circle_aliases:
                alias_hits: List[Dict[str, Any]] = []
                for record in latest_records:
                    ploc = _record_location_for_pdam_match(record, parking_unified_location)
                    for a in _pile_number_aliases(record.get("pile_number"), location=ploc):
                        if a == alias:
                            alias_hits.append(record)
                            break
                alias_hits = _dedupe_records(alias_hits)
                if len(alias_hits) == 1:
                    matched_record = alias_hits[0]
                    match_type = "globally_unique_pile_alias"
                    break
        if matched_record:
            matched_record_keys.add(
                _record_dedupe_key_for_latest(matched_record, parking_unified_location=parking_unified_location)
            )
            if _record_installed(matched_record):
                installed_count += 1
            else:
                pending_count += 1
        else:
            pending_count += 1
            unresolved_circles.append(
                {
                    "circle": circle,
                    "circleLocation": circle_location,
                    "circleKind": circle_kind,
                    "pileNumber": pile_number,
                    "aliases": circle_aliases,
                }
            )

        overlays.append(
            _mapping_overlay_payload(
                circle,
                circle_location_display,
                pile_number,
                matched_record,
                match_type=match_type,
                auto_matched=False,
                location_inference=location_inference.get(_record_key(matched_record)) if matched_record else None,
            )
        )

    inferable_records: List[Dict[str, Any]] = [
        record
        for record in latest_records
        if _record_dedupe_key_for_latest(record, parking_unified_location=parking_unified_location)
        not in matched_record_keys
        and _location_kind_and_number(record.get("location"))[0] != "dong"
    ]
    inferable_lookup: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in inferable_records:
        ploc = _record_location_for_pdam_match(record, parking_unified_location)
        for alias in _pile_number_aliases(record.get("pile_number"), location=ploc):
            inferable_lookup[alias].append(record)

    overlay_index = {item.get("circleId"): index for index, item in enumerate(overlays)}
    consumed_inferred_keys: set[Tuple[str, str]] = set()
    unresolved_circles.sort(
        key=lambda item: (
            0 if item["circleKind"] == "basement" else 1 if item["circleKind"] == "unspecified" else 2,
            item["circleLocation"],
            item["pileNumber"] or "",
        )
    )
    for item in unresolved_circles:
        if item["circleKind"] == "dong" or not item["aliases"]:
            continue
        candidate_records: List[Dict[str, Any]] = []
        for alias in item["aliases"]:
            candidate_records.extend(
                record
                for record in inferable_lookup.get(alias, [])
                if _record_dedupe_key_for_latest(record, parking_unified_location=parking_unified_location)
                not in consumed_inferred_keys
            )
        if not _has_clear_best_candidate(
            item["circleLocation"], candidate_records, location_inference, parking_unified_location
        ):
            continue
        matched_record = _select_circle_record(
            item["circleLocation"], candidate_records, location_inference, parking_unified_location
        )
        if not matched_record:
            continue
        _inf_key = _record_dedupe_key_for_latest(
            matched_record, parking_unified_location=parking_unified_location
        )
        consumed_inferred_keys.add(_inf_key)
        matched_record_keys.add(_inf_key)
        if _record_installed(matched_record):
            installed_count += 1
            pending_count = max(0, pending_count - 1)
        overlay_position = overlay_index.get(item["circle"].get("id"))
        if overlay_position is not None:
            inference_info = location_inference.get(_record_key(matched_record))
            circle_display = _normalize_location(item["circle"].get("building_name"))
            overlays[overlay_position] = _mapping_overlay_payload(
                item["circle"],
                circle_display,
                item["pileNumber"],
                matched_record,
                match_type="inferred_equipment_context" if inference_info else "inferred_remaining",
                auto_matched=True,
                location_inference=inference_info,
            )

    return {
        "circleMappings": overlays,
        "matchedCircleCount": installed_count,
        "pendingCircleCount": pending_count,
        "unmatchedRecordCount": len(latest_records) - len(matched_record_keys),
        "autoMatchedCount": sum(
            1 for item in overlays if item.get("autoMatched") and item.get("status") == "installed"
        ),
    }


def _parking_location_dong_hyphen_pile_format_issue(record: Dict[str, Any]) -> bool:
    """시공위치가 '주차장'으로만 적혀 있는데 파일번호가 동-번호 형식(예: 8-12)인 경우 오입력 의심."""
    if _normalize_location(record.get("location")) != "주차장":
        return False
    raw = _cell_text(record.get("pile_number"))
    if not raw:
        return False
    t = re.sub(r"[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+", "-", raw.strip())
    if re.match(r"(?i)^[BbT]", t):
        return False
    return bool(re.match(r"^\d{1,3}\s*-\s*\d+$", t))


def _build_mapping_diagnostics(
    circles: Sequence[Dict[str, Any]],
    latest_records: Sequence[Dict[str, Any]],
    mapping: Dict[str, Any],
    *,
    records_for_pdam_duplicates: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    overlays = list(mapping.get("circleMappings") or [])
    auto_matched = [
        {
            "circleId": item.get("circleId"),
            "circleLocation": item.get("circleLocation"),
            "recordLocation": item.get("locationNormalized"),
            "sourceLocation": item.get("sourceLocationNormalized") or item.get("locationNormalized"),
            "inferredRecordLocation": item.get("inferredRecordLocation"),
            "pileNumber": item.get("pileNumber"),
            "constructionDate": item.get("constructionDate"),
            "equipment": item.get("equipment"),
            "constructionMethod": item.get("constructionMethod"),
            "matchType": item.get("matchType"),
            "inferenceReason": item.get("inferenceReason"),
        }
        for item in overlays
        if item.get("autoMatched") and item.get("status") == "installed"
    ]
    auto_matched.sort(
        key=lambda item: (
            item.get("constructionDate") or "",
            item.get("circleLocation") or "",
            item.get("pileNumber") or "",
        ),
        reverse=True,
    )

    overlay_by_circle_id = {item.get("circleId"): item for item in overlays if item.get("circleId")}
    project_only = []
    for circle in circles:
        overlay = overlay_by_circle_id.get(circle.get("id")) or {}
        if overlay.get("status") == "installed":
            continue
        if overlay.get("recordRowNumber") is not None or overlay.get("matchedRecordPileNumber") is not None:
            continue
        project_only.append(
            {
                "circleId": circle.get("id"),
                "location": _normalize_location(circle.get("building_name")),
                "pileNumber": _circle_display_pile_number(circle) or None,
            }
        )
    project_only.sort(
        key=lambda item: _diagnostic_sort_key(
            location=item.get("location"),
            pile_number=item.get("pileNumber"),
        )
    )

    matched_record_display_keys = {
        _diagnostic_display_key(
            item.get("locationNormalized") or item.get("location"),
            item.get("matchedRecordPileNumber") or item.get("matchedRecordDisplayPileNumber"),
        )
        for item in overlays
        if item.get("status") == "installed"
        and (item.get("matchedRecordDisplayPileNumber") or item.get("matchedRecordPileNumber"))
    }
    pdam_only_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for record in latest_records:
        display_key = _diagnostic_display_key(record.get("location"), record.get("pile_number"))
        if not display_key[1] or display_key in matched_record_display_keys:
            continue
        existing = pdam_only_lookup.get(display_key)
        current_rank = (record.get("construction_date") or "", int(record.get("row_number") or 0))
        existing_rank = (
            (existing.get("constructionDate") or "", int(existing.get("recordRowNumber") or 0))
            if existing
            else ("", -1)
        )
        if existing is None or current_rank >= existing_rank:
            pdam_only_lookup[display_key] = {
                "location": display_key[0],
                "pileNumber": record.get("pile_number") or None,
                "displayPileNumber": display_key[1] or None,
                "rawPileNumber": record.get("pile_number") or None,
                "constructionDate": record.get("construction_date"),
                "equipment": record.get("equipment"),
                "constructionMethod": _normalize_construction_method(record.get("construction_method")),
                "pileNumberSort": record.get("pile_number_sort"),
                "recordRowNumber": record.get("row_number"),
            }
    pdam_only = list(pdam_only_lookup.values())
    pdam_only.sort(
        key=lambda item: _diagnostic_sort_key(
            location=item.get("location"),
            pile_number=item.get("pileNumber"),
            pile_number_sort=item.get("pileNumberSort"),
            construction_date=item.get("constructionDate"),
        )
    )

    project_duplicates_lookup: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for circle in circles:
        display_number = _circle_display_pile_number(circle)
        location = _normalize_location(circle.get("building_name"))
        if not display_number:
            continue
        project_duplicates_lookup[(location, display_number)].append(circle)
    project_duplicates = [
        {
            "location": location,
            "pileNumber": pile_number,
            "count": len(group),
            "circleIds": [item.get("id") for item in group],
            "rawPileNumbers": sorted({_circle_number(item) for item in group if _circle_number(item)}),
        }
        for (location, pile_number), group in project_duplicates_lookup.items()
        if len(group) > 1
    ]
    project_duplicates.sort(
        key=lambda item: _diagnostic_sort_key(
            location=item.get("location"),
            pile_number=item.get("pileNumber"),
        )
    )

    pdam_duplicates_lookup: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    # pile당 최신 1행(latest_records)이 아니라 필터 구간 전체 행을 본다. 동일 위치·파일번호가
    # 여러 줄이면 latest에서 1줄로 합쳐져 중복 진단이 빠지는 문제를 막는다.
    for record in records_for_pdam_duplicates:
        display_key = _diagnostic_display_key(record.get("location"), record.get("pile_number"))
        if not display_key[1]:
            continue
        pdam_duplicates_lookup[display_key].append(record)
    pdam_duplicates = []
    for (location, pile_number), group in pdam_duplicates_lookup.items():
        if len(group) <= 1:
            continue
        pdam_duplicates.append(
            {
                "location": location,
                "pileNumber": pile_number,
                "displayPileNumber": pile_number,
                "count": len(group),
                "locations": [location],
                "rawPileNumbers": sorted({_normalize_pile_number(item.get("pile_number")) for item in group if item.get("pile_number")}),
                "constructionDates": sorted({item.get("construction_date") for item in group if item.get("construction_date")}),
                "equipments": sorted({item.get("equipment") for item in group if item.get("equipment")}),
            }
        )
    pdam_duplicates.sort(
        key=lambda item: (
            -int(item.get("count") or 0),
            _diagnostic_sort_key(
                location=item.get("location"),
                pile_number=item.get("pileNumber"),
            ),
        )
    )

    parking_pile_format_issues: List[Dict[str, Any]] = []
    for record in records_for_pdam_duplicates:
        if not _parking_location_dong_hyphen_pile_format_issue(record):
            continue
        pile_raw = _cell_text(record.get("pile_number"))
        parking_pile_format_issues.append(
            {
                "rawLocation": _cell_text(record.get("location")),
                "locationNormalized": _normalize_location(record.get("location")),
                "pileNumber": pile_raw,
                "rawPileNumber": pile_raw,
                "constructionDate": record.get("construction_date"),
                "equipment": record.get("equipment"),
                "constructionMethod": _normalize_construction_method(record.get("construction_method")),
                "recordRowNumber": record.get("row_number"),
                "issueType": "숫자 오류",
                "issueDetail": "시공위치가 주차장인데 파일번호가 동-번호(예: 8-12) 형식입니다. 지하구역은 B2-번호, B2--번호 등으로 맞추는지 확인하세요.",
            }
        )
    parking_pile_format_issues.sort(
        key=lambda item: (
            item.get("constructionDate") or "",
            int(item.get("recordRowNumber") or 0),
            item.get("pileNumber") or "",
        )
    )

    return {
        "summary": {
            "autoMatchedCount": len(auto_matched),
            "projectOnlyCount": len(project_only),
            "pdamOnlyCount": len(pdam_only),
            "projectDuplicateCount": len(project_duplicates),
            "pdamDuplicateCount": len(pdam_duplicates),
            "parkingPileFormatIssueCount": len(parking_pile_format_issues),
        },
        "autoMatched": auto_matched[:MAX_DIAGNOSTIC_ITEMS],
        "projectOnly": project_only[:MAX_DIAGNOSTIC_ITEMS],
        "pdamOnly": pdam_only[:MAX_DIAGNOSTIC_ITEMS],
        "projectDuplicates": project_duplicates[:MAX_DIAGNOSTIC_ITEMS],
        "pdamDuplicates": pdam_duplicates[:MAX_DIAGNOSTIC_ITEMS],
        "parkingPileFormatIssues": parking_pile_format_issues[:MAX_DIAGNOSTIC_ITEMS],
    }


def _circle_location_totals(circles: Sequence[Dict[str, Any]]) -> Dict[str, int]:
    totals: Dict[str, int] = defaultdict(int)
    for circle in circles:
        totals[_location_progress_bucket(circle.get("building_name"))] += 1
    return totals


def _location_progress_bucket(value: Any) -> str:
    """부위별 진행: 동·지하(B)·타워(Tn) 단위로 묶음. 타워는 호기별 T1, T2 …"""
    normalized = _normalize_location(value)
    if re.fullmatch(r"\d+동", normalized):
        return normalized
    if re.fullmatch(r"B\d*", normalized):
        return normalized
    tower_full = re.fullmatch(r"T(\d+)", normalized, flags=re.IGNORECASE)
    if tower_full:
        return f"T{int(tower_full.group(1))}"
    tower_sub = re.search(r"(?i)T\s*(\d+)", normalized)
    if tower_sub:
        return f"T{int(tower_sub.group(1))}"
    tw_ko = re.search(r"(?:타워크레인|타워)\s*(\d+)", str(normalized), flags=re.IGNORECASE)
    if tw_ko:
        return f"T{int(tw_ko.group(1))}"
    return "미지정"


def _build_location_progress(
    circles: Sequence[Dict[str, Any]],
    settlement_latest: Sequence[Dict[str, Any]],
    cumulative_latest: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    planned_totals = _circle_location_totals(circles)
    period_counts: Dict[str, int] = defaultdict(int)
    cumulative_counts: Dict[str, int] = defaultdict(int)

    for record in settlement_latest:
        period_counts[_location_progress_bucket(record.get("location"))] += 1
    for record in cumulative_latest:
        cumulative_counts[_location_progress_bucket(record.get("location"))] += 1

    keys = set(planned_totals) | set(period_counts) | set(cumulative_counts)
    rows: List[Dict[str, Any]] = []
    for key in keys:
        total_planned = planned_totals.get(key)
        cumulative_installed = cumulative_counts.get(key, 0)
        progress_percent = None
        if total_planned:
            progress_percent = round((cumulative_installed / total_planned) * 100, 1)
        rows.append(
            {
                "location": key,
                "totalPlannedCount": total_planned,
                "periodInstalledCount": period_counts.get(key, 0),
                "cumulativeInstalledCount": cumulative_installed,
                "progressPercent": progress_percent,
            }
        )
    rows.sort(key=lambda item: _location_option_sort({"value": item["location"]}))
    return rows


def _build_settlement_summary(
    records: Sequence[Dict[str, Any]],
    circles: Sequence[Dict[str, Any]],
    *,
    settlement_month: Optional[str],
    settlement_start_day: Optional[int],
    settlement_end_day: Optional[int],
    remaining_threshold: Optional[float],
) -> Dict[str, Any]:
    months = sorted({record.get("construction_month") for record in records if record.get("construction_month")})
    period = _build_settlement_period(months, settlement_month, settlement_start_day, settlement_end_day)
    start_date = period.get("startDate")
    end_date = period.get("endDate")

    if not start_date or not end_date:
        return {
            "period": period,
            "summary": {
                "recordCount": 0,
                "uniquePileCount": 0,
                "totalPenetrationDepth": 0.0,
                "totalRemaining": 0.0,
                "overThresholdCount": 0,
            },
            "dailyFlow": [],
            "byMethod": [],
            "locationProgress": [],
            "records": [],
        }

    period_records = _apply_filters(records, date_from=start_date, date_to=end_date, month=None)
    period_latest = _latest_records_by_pile(period_records)
    cumulative_records = _apply_filters(records, date_from=None, date_to=end_date, month=None)
    cumulative_latest = _latest_records_by_pile(cumulative_records)

    penetration_values = [record["penetration_depth"] for record in period_latest if record.get("penetration_depth") is not None]
    remaining_values = [record["pile_remaining"] for record in period_latest if record.get("pile_remaining") is not None]
    over_threshold_count = 0
    if remaining_threshold is not None:
        over_threshold_count = sum(
            1
            for record in period_latest
            if record.get("pile_remaining") is not None and float(record["pile_remaining"]) >= remaining_threshold
        )

    period_records_grid = sorted(
        period_latest,
        key=lambda record: (
            record.get("construction_date") or "",
            _normalize_location(record.get("location")),
            record.get("pile_number_sort") if record.get("pile_number_sort") is not None else 10**9,
            record.get("pile_number") or "",
        ),
    )[:MAX_RECORDS_IN_RESPONSE]

    return {
        "period": period,
        "summary": {
            "recordCount": len(period_records),
            "uniquePileCount": len(period_latest),
            "totalPenetrationDepth": round(sum(penetration_values), 3) if penetration_values else 0.0,
            "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
            "overThresholdCount": over_threshold_count,
        },
        "dailyFlow": _build_date_series(
            period_records,
            "construction_date",
            remaining_threshold,
            start_date=start_date,
            end_date=end_date,
        ),
        "byMethod": _group_summary(period_records, "construction_method"),
        "locationProgress": _build_location_progress(circles, period_latest, cumulative_latest),
        "records": period_records_grid,
    }


def build_dashboard(
    dataset_id: str,
    *,
    circles: Optional[Sequence[Dict[str, Any]]] = None,
    work_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    month: Optional[str] = None,
    equipment: Optional[str] = None,
    method: Optional[str] = None,
    location: Optional[str] = None,
    equipments: Optional[Sequence[str]] = None,
    methods: Optional[Sequence[str]] = None,
    locations: Optional[Sequence[str]] = None,
    remaining_threshold: Optional[float] = None,
    settlement_month: Optional[str] = None,
    settlement_start_day: Optional[int] = 25,
    settlement_end_day: Optional[int] = 20,
    exclude_identical_geometry_duplicates: bool = False,
) -> Dict[str, Any]:
    dataset = _get_dataset(dataset_id)
    if not dataset:
        raise ValueError("시공기록 데이터셋을 찾지 못했습니다.")

    all_records = [_normalize_dashboard_record(record) for record in _list_records(dataset_id)]
    filter_options = _build_filter_options(all_records)
    resolved_date_from = date_from or filter_options["dateBounds"]["min"]
    resolved_date_to = date_to or filter_options["dateBounds"]["max"]

    parking_unified_location: Optional[str] = None
    unify_parking_circle_location = False
    saved_buildings: Optional[List[Dict[str, Any]]] = None
    if work_id:
        saved_buildings = _load_saved_work_buildings(work_id)
        parking_unified_location, unify_parking_circle_location = _saved_work_parking_unify_context(saved_buildings)

    category_filtered_records = _apply_filters(
        all_records,
        date_from=None,
        date_to=None,
        month=None,
        equipment=equipment,
        method=method,
        location=location,
        equipments=equipments,
        methods=methods,
        locations=locations,
        parking_unified_location=parking_unified_location,
    )
    filtered_records = _apply_filters(
        category_filtered_records,
        date_from=resolved_date_from,
        date_to=resolved_date_to,
        month=month,
    )

    latest_records = _without_header_echo_records(
        _latest_records_by_pile(filtered_records, parking_unified_location=parking_unified_location)
    )
    # 원↔PDAM 매칭은 날짜·월 필터를 적용하지 않은 최신 행 풀을 쓴다.
    # (기간을 좁혔을 때 시공 기록이 필터 밖으로 빠져 미시공으로만 보이는 문제 방지)
    latest_records_for_mapping = _without_header_echo_records(
        _latest_records_by_pile(category_filtered_records, parking_unified_location=parking_unified_location)
    )

    if circles is None and work_id:
        circles = _load_saved_work_circles(work_id)
    circles, geom_clusters = dedupe_circles_for_construction_mapping(
        list(circles or []),
        exclude_identical_geometry_duplicates=exclude_identical_geometry_duplicates,
    )

    remaining_values = [record["pile_remaining"] for record in latest_records if record.get("pile_remaining") is not None]
    over_threshold_count = 0
    if remaining_threshold is not None:
        over_threshold_count = sum(
            1
            for record in latest_records
            if record.get("pile_remaining") is not None and float(record["pile_remaining"]) >= remaining_threshold
        )

    mapping = (
        map_records_to_circles(
            latest_records_for_mapping,
            circles,
            parking_unified_location=parking_unified_location,
            unify_parking_circle_location=unify_parking_circle_location,
            outline_buildings=saved_buildings,
        )
        if circles
        else {
            "circleMappings": [],
            "matchedCircleCount": None,
            "pendingCircleCount": None,
            "unmatchedRecordCount": None,
        }
    )
    if mapping.get("circleMappings") is not None:
        mapping["circleMappings"] = _fan_out_circle_mappings_for_geometry_clusters(
            list(mapping["circleMappings"]),
            geom_clusters,
        )

    records_for_grid = sorted(
        latest_records,
        key=lambda record: (
            record.get("construction_date") or "",
            _normalize_location(record.get("location")),
            record.get("pile_number_sort") if record.get("pile_number_sort") is not None else 10**9,
            record.get("pile_number") or "",
        ),
    )[:MAX_RECORDS_IN_RESPONSE]

    settlement = _build_settlement_summary(
        category_filtered_records,
        circles,
        settlement_month=settlement_month,
        settlement_start_day=settlement_start_day,
        settlement_end_day=settlement_end_day,
        remaining_threshold=remaining_threshold,
    )

    return {
        "dataset": dataset,
        "filters": {
            "applied": {
                "dateFrom": resolved_date_from,
                "dateTo": resolved_date_to,
                "month": month,
                "equipment": equipment,
                "method": _normalize_construction_method(method) if method else method,
                "location": location,
                "equipments": _merge_filter_values(equipment, equipments),
                "methods": _merge_filter_values(method, methods, normalizer=_normalize_construction_method),
                "locations": _merge_filter_values(location, locations, normalizer=_normalize_location),
                "remainingThreshold": remaining_threshold,
                "settlementMonth": settlement["period"]["month"],
                "settlementStartDay": settlement["period"]["startDay"],
                "settlementEndDay": settlement["period"]["endDay"],
                "excludeIdenticalGeometryDuplicates": exclude_identical_geometry_duplicates,
            },
            "options": filter_options,
        },
        "summary": {
            "recordCount": len(filtered_records),
            "uniquePileCount": len(latest_records),
            "installedPileCount": sum(1 for record in latest_records if record.get("installed")),
            "matchedCircleCount": mapping["matchedCircleCount"],
            "pendingCircleCount": mapping["pendingCircleCount"],
            "unmatchedRecordCount": mapping["unmatchedRecordCount"],
            "autoMatchedCount": mapping.get("autoMatchedCount", 0),
            "totalRemaining": round(sum(remaining_values), 3) if remaining_values else 0.0,
            "avgRemaining": round(sum(remaining_values) / len(remaining_values), 3) if remaining_values else None,
            "overThresholdCount": over_threshold_count,
        },
        "charts": {
            "byDate": _build_date_series(
                filtered_records,
                "construction_date",
                remaining_threshold,
                start_date=resolved_date_from,
                end_date=resolved_date_to,
            ),
            "byMonth": _build_date_series(filtered_records, "construction_month", remaining_threshold),
            "byEquipment": _group_summary(filtered_records, "equipment"),
            "byMethod": _group_summary(filtered_records, "construction_method"),
            "methodMatrix": _build_method_matrix(filtered_records),
        },
        "records": records_for_grid,
        "mapping": mapping,
        "diagnostics": _build_mapping_diagnostics(
            circles,
            latest_records_for_mapping,
            mapping,
            records_for_pdam_duplicates=filtered_records,
        ),
        "settlement": settlement,
    }


def _looks_like_excel_response(response: requests.Response) -> bool:
    content_type = (response.headers.get("Content-Type") or "").lower()
    disposition = (response.headers.get("Content-Disposition") or "").lower()
    content = response.content[:8]
    return (
        "sheet" in content_type
        or "excel" in content_type
        or ".xlsx" in disposition
        or ".xls" in disposition
        or content.startswith(b"PK")
    )


def _html_contains_login_form(html: str) -> bool:
    lowered = html.lower()
    return 'id="loginform"' in lowered or ('name="userid"' in lowered and 'name="password"' in lowered)


def _extract_report_id_from_html(html: str) -> Optional[int]:
    match = re.search(r"downloadAllReport\((\d+)\)", html)
    if not match:
        return None
    return int(match.group(1))


def _extract_download_candidates_from_js(js_body: str, arg_name: str, report_id: int, base_url: str) -> List[str]:
    candidates: List[str] = []
    patterns = (
        re.compile(rf"['\"]([^'\"]+)['\"]\s*\+\s*{re.escape(arg_name)}\s*\+\s*['\"]([^'\"]*)['\"]"),
        re.compile(rf"['\"]([^'\"]+)['\"]\s*\+\s*{re.escape(arg_name)}\b"),
    )
    for pattern in patterns:
        for match in pattern.finditer(js_body):
            prefix = match.group(1)
            suffix = match.group(2) if match.lastindex and match.lastindex > 1 else ""
            candidates.append(urljoin(base_url, f"{prefix}{report_id}{suffix}"))

    direct_url_pattern = re.compile(r"(?:location\.href|window\.open|window\.location(?:\.href)?)\s*(?:=|\()\s*['\"]([^'\"]*(?:download|excel)[^'\"]*)['\"]")
    for match in direct_url_pattern.finditer(js_body):
        candidates.append(urljoin(base_url, match.group(1)))

    return candidates


def _extract_download_candidates(html: str, base_url: str, report_id: Optional[int]) -> List[str]:
    scripts = "\n".join(re.findall(r"<script[^>]*>(.*?)</script>", html, flags=re.S | re.I))
    resolved_report_id = report_id if report_id is not None else _extract_report_id_from_html(html)
    candidates: List[str] = []

    if resolved_report_id is not None:
        body_match = re.search(
            r"function\s+downloadAllReport\s*\(\s*(\w+)\s*\)\s*\{(?P<body>.*?)\}",
            scripts,
            re.S,
        )
        if body_match:
            candidates.extend(
                _extract_download_candidates_from_js(
                    body_match.group("body"),
                    body_match.group(1),
                    resolved_report_id,
                    base_url,
                )
            )
        for template in DOWNLOAD_PATH_GUESSES:
            candidates.append(urljoin(base_url, template.format(report_id=resolved_report_id)))

    deduped: List[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        deduped.append(candidate)
    return deduped


def _response_filename(response: requests.Response, fallback: str) -> str:
    disposition = response.headers.get("Content-Disposition") or ""
    match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disposition, re.I)
    if match:
        return match.group(1).strip()
    return fallback


def sync_pdam_workbook(
    *,
    user_id: str,
    password: str,
    report_page_url: Optional[str] = None,
    report_id: Optional[int] = None,
    source_url: str = "https://we8104.com/",
    dataset_name: Optional[str] = None,
    project_context: Optional[str] = None,
) -> Dict[str, Any]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
            "Referer": source_url,
        }
    )

    root_response = session.get(source_url, timeout=20)
    root_response.raise_for_status()

    login_url = urljoin(source_url, "/login")
    login_response = session.post(
        login_url,
        data={"userId": user_id, "password": password},
        timeout=20,
    )
    login_response.raise_for_status()
    if _html_contains_login_form(login_response.text):
        raise ValueError("PDAM 로그인에 실패했습니다. 아이디/비밀번호를 확인하세요.")

    page_response = login_response
    if report_page_url:
        page_response = session.get(report_page_url, timeout=20)
        page_response.raise_for_status()

    candidates = _extract_download_candidates(
        page_response.text,
        page_response.url or source_url,
        report_id,
    )
    if not candidates:
        raise ValueError(
            "로그인은 되었지만 '기록지 전체 출력' 다운로드 주소를 자동으로 찾지 못했습니다. 보고서 페이지 URL을 입력하거나 엑셀 직접 불러오기를 사용하세요."
        )

    last_error: Optional[str] = None
    for candidate in candidates:
        response = session.get(candidate, timeout=30)
        if _looks_like_excel_response(response):
            filename = _response_filename(response, f"pdam_report_{report_id or 'latest'}.xlsx")
            result = import_workbook_bytes(
                response.content,
                filename=filename,
                source_type="pdam-sync",
                source_url=page_response.url or report_page_url or source_url,
                report_id=report_id or _extract_report_id_from_html(page_response.text),
                login_user=user_id,
                dataset_name=dataset_name,
                project_context=project_context,
                extra_metadata={
                    "downloadUrl": candidate,
                    "candidateCount": len(candidates),
                },
            )
            result["download"] = {
                "url": candidate,
                "filename": filename,
                "resolvedReportId": report_id or _extract_report_id_from_html(page_response.text),
            }
            return result
        last_error = response.headers.get("Content-Type") or "unknown response"

    raise ValueError(
        f"다운로드 후보를 찾았지만 엑셀 응답을 받지 못했습니다. 마지막 응답 타입: {last_error}. 엑셀 직접 불러오기를 사용해 주세요."
    )
