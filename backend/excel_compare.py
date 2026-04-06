from __future__ import annotations

import io
import math
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd

PREVIEW_ROWS = 12
PREVIEW_COLS = 8
DEFAULT_BUILDING_NAME = "미지정"
BUILDING_SOURCE_SHEET = "sheet"
BUILDING_SOURCE_COLUMN = "column"


def _cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def _column_letter(index: int) -> str:
    current = index + 1
    letters: List[str] = []
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def _load_excel_file(file_bytes: bytes) -> pd.ExcelFile:
    return pd.ExcelFile(io.BytesIO(file_bytes))


def inspect_excel_workbook(
    file_bytes: bytes,
    *,
    preview_rows: int = PREVIEW_ROWS,
    preview_cols: int = PREVIEW_COLS,
) -> Dict[str, Any]:
    excel_file = _load_excel_file(file_bytes)
    sheets: List[Dict[str, Any]] = []
    for sheet_name in excel_file.sheet_names:
        df = pd.read_excel(
            excel_file,
            sheet_name=sheet_name,
            header=None,
            nrows=preview_rows,
            dtype=object,
        )
        df = df.iloc[:, :preview_cols]
        preview_rows_data: List[Dict[str, Any]] = []
        best_header_row = 1
        best_score = -1
        for row_index in range(len(df.index)):
            row_values = [_cell_text(value) for value in df.iloc[row_index].tolist()]
            non_empty = sum(1 for value in row_values if value)
            if non_empty > best_score:
                best_score = non_empty
                best_header_row = row_index + 1
            preview_rows_data.append(
                {
                    "rowNumber": row_index + 1,
                    "values": row_values,
                }
            )
        sheets.append(
            {
                "name": sheet_name,
                "columnLetters": [_column_letter(i) for i in range(df.shape[1])],
                "suggestedHeaderRow": best_header_row,
                "preview": preview_rows_data,
            }
        )
    return {
        "sheetNames": excel_file.sheet_names,
        "sheets": sheets,
    }


def _normalize_building(value: Any) -> str:
    text = str(value or "").strip()
    return text or DEFAULT_BUILDING_NAME


def _normalize_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.endswith(".0"):
        try:
            return str(int(float(raw)))
        except ValueError:
            return raw
    return raw


def _number_aliases(value: Any) -> List[str]:
    normalized = _normalize_number(value)
    if not normalized:
        return []
    aliases = [normalized]
    if "-" not in normalized:
        return aliases
    suffix = _normalize_number(normalized.rsplit("-", 1)[-1])
    if suffix and suffix != normalized:
        aliases.insert(0, suffix)
    return aliases


def _parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _resolve_column_name(columns: Sequence[str], spec: Optional[str]) -> Optional[str]:
    token = str(spec or "").strip()
    if not token:
        return None
    lowered = token.lower()
    for column in columns:
        if str(column).strip() == token:
            return str(column)
    for column in columns:
        if str(column).strip().lower() == lowered:
            return str(column)
    if token.isalpha():
        column_index = 0
        for ch in token.upper():
            column_index = column_index * 26 + (ord(ch) - 64)
        column_index -= 1
        if 0 <= column_index < len(columns):
            return str(columns[column_index])
    return None


def _match_number(circle: Dict[str, Any]) -> str:
    matched = circle.get("matched_text") if isinstance(circle, dict) else None
    if not isinstance(matched, dict):
        return ""
    return _normalize_number(matched.get("text"))


def _build_circle_lookup(circles: Iterable[Dict[str, Any]]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    lookup: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for circle in circles or []:
        if not isinstance(circle, dict):
            continue
        building_name = _normalize_building(circle.get("building_name"))
        for alias in _number_aliases(_match_number(circle)):
            lookup[(building_name, alias)].append(circle)
    return lookup


def _excel_cad_axis_distance(circle: Dict[str, Any], excel_x: float, excel_y: float) -> float:
    """엑셀 좌표와 CAD 원 중심 거리. 좌표계가 서로 X↔Y이므로 엑셀 X↔CAD Y, 엑셀 Y↔CAD X로 대응."""
    dx = float(circle.get("center_y", 0.0)) - excel_x
    dy = float(circle.get("center_x", 0.0)) - excel_y
    return math.hypot(dx, dy)


def _pick_best_circle(
    lookup: Dict[Tuple[str, str], List[Dict[str, Any]]],
    building_name: str,
    number: str,
    x: float,
    y: float,
) -> Optional[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for alias in _number_aliases(number):
        candidates.extend(lookup.get((_normalize_building(building_name), alias), []))
    if not candidates:
        return None
    return min(candidates, key=lambda circle: _excel_cad_axis_distance(circle, x, y))


def _empty_summary() -> Dict[str, int]:
    return {
        "totalRows": 0,
        "skippedRows": 0,
        "matchBoth": 0,
        "matchOldOnly": 0,
        "matchNewOnly": 0,
        "missingOld": 0,
        "missingNew": 0,
        "missingBoth": 0,
        "coordMismatch": 0,
    }


def _resolve_building_source_mode(
    building_source_mode: Optional[str],
    use_sheet_name_as_building: Optional[bool],
) -> str:
    mode = str(building_source_mode or "").strip().lower()
    if mode in {BUILDING_SOURCE_SHEET, BUILDING_SOURCE_COLUMN}:
        return mode
    if use_sheet_name_as_building is None:
        return BUILDING_SOURCE_SHEET
    return BUILDING_SOURCE_SHEET if use_sheet_name_as_building else BUILDING_SOURCE_COLUMN


def _read_sheet_dataframe(
    excel_file: pd.ExcelFile,
    *,
    sheet_name: str,
    header_row: int,
) -> pd.DataFrame:
    if header_row < 1:
        raise ValueError("header_row must be 1 or greater.")
    df = pd.read_excel(
        excel_file,
        sheet_name=sheet_name,
        header=header_row - 1,
        dtype=object,
    )
    df.columns = [
        str(column).strip() if str(column).strip() else f"COL_{index + 1}"
        for index, column in enumerate(df.columns)
    ]
    return df


def _compare_single_sheet(
    df: pd.DataFrame,
    *,
    sheet_name: str,
    header_row: int,
    number_column: str,
    x_column: str,
    y_column: str,
    building_column: Optional[str],
    building_source_mode: str,
    lookup_a: Dict[Tuple[str, str], List[Dict[str, Any]]],
    lookup_b: Dict[Tuple[str, str], List[Dict[str, Any]]],
    coord_tolerance: float,
) -> Dict[str, Any]:
    resolved_number_column = _resolve_column_name(df.columns, number_column)
    resolved_x_column = _resolve_column_name(df.columns, x_column)
    resolved_y_column = _resolve_column_name(df.columns, y_column)
    resolved_building_column = _resolve_column_name(df.columns, building_column)

    if not resolved_number_column or not resolved_x_column or not resolved_y_column:
        raise ValueError("number/x/y column could not be resolved from the selected sheet.")
    if building_source_mode == BUILDING_SOURCE_COLUMN and not resolved_building_column:
        raise ValueError("building column could not be resolved from the selected sheet.")

    summary = _empty_summary()
    issues: List[Dict[str, Any]] = []

    for data_index, row in df.iterrows():
        number = _normalize_number(row.get(resolved_number_column))
        x = _parse_float(row.get(resolved_x_column))
        y = _parse_float(row.get(resolved_y_column))
        if not number or x is None or y is None:
            summary["skippedRows"] += 1
            continue

        if building_source_mode == BUILDING_SOURCE_COLUMN:
            building_name = _normalize_building(row.get(resolved_building_column))
        else:
            building_name = _normalize_building(sheet_name)

        summary["totalRows"] += 1

        circle_a = _pick_best_circle(lookup_a, building_name, number, x, y)
        circle_b = _pick_best_circle(lookup_b, building_name, number, x, y)
        match_a = circle_a is not None and _excel_cad_axis_distance(circle_a, x, y) <= coord_tolerance
        match_b = circle_b is not None and _excel_cad_axis_distance(circle_b, x, y) <= coord_tolerance

        if match_a and match_b:
            summary["matchBoth"] += 1
            continue
        if match_a:
            summary["matchOldOnly"] += 1
            status = "match-old-only"
        elif match_b:
            summary["matchNewOnly"] += 1
            status = "match-new-only"
        elif circle_a is None and circle_b is None:
            summary["missingBoth"] += 1
            status = "missing-both"
        elif circle_a is None:
            summary["missingOld"] += 1
            status = "missing-old"
        elif circle_b is None:
            summary["missingNew"] += 1
            status = "missing-new"
        else:
            summary["coordMismatch"] += 1
            status = "coord-mismatch"

        issues.append(
            {
                "status": status,
                "sheetName": sheet_name,
                "excelRow": int(data_index) + header_row + 1,
                "buildingName": building_name,
                "number": number,
                "excelX": x,
                "excelY": y,
                "oldCircle": {
                    "x": float(circle_a.get("center_x")),
                    "y": float(circle_a.get("center_y")),
                    "distance": _excel_cad_axis_distance(circle_a, x, y),
                }
                if circle_a
                else None,
                "newCircle": {
                    "x": float(circle_b.get("center_x")),
                    "y": float(circle_b.get("center_y")),
                    "distance": _excel_cad_axis_distance(circle_b, x, y),
                }
                if circle_b
                else None,
            }
        )

    return {
        "sheetName": sheet_name,
        "headerRow": header_row,
        "buildingSourceMode": building_source_mode,
        "resolvedColumns": {
            "building": resolved_building_column if building_source_mode == BUILDING_SOURCE_COLUMN else None,
            "number": resolved_number_column,
            "x": resolved_x_column,
            "y": resolved_y_column,
        },
        "summary": summary,
        "issues": issues,
    }


def compare_excel_workbook(
    file_bytes: bytes,
    *,
    sheet_name: Optional[str] = None,
    sheet_names: Optional[Sequence[str]] = None,
    header_row: int,
    building_column: Optional[str],
    number_column: str,
    x_column: str,
    y_column: str,
    building_source_mode: Optional[str] = None,
    use_sheet_name_as_building: Optional[bool] = None,
    circles_a: List[Dict[str, Any]],
    circles_b: List[Dict[str, Any]],
    coord_tolerance: float = 0.01,
) -> Dict[str, Any]:
    excel_file = _load_excel_file(file_bytes)
    requested_sheet_names = list(sheet_names or ([sheet_name] if sheet_name else []))
    selected_sheet_names = [name for name in requested_sheet_names if name]
    if not selected_sheet_names:
        raise ValueError("At least one sheet must be selected.")

    missing_sheet_names = [name for name in selected_sheet_names if name not in excel_file.sheet_names]
    if missing_sheet_names:
        raise ValueError(f"Selected sheet(s) not found: {', '.join(missing_sheet_names)}")

    resolved_building_source_mode = _resolve_building_source_mode(
        building_source_mode,
        use_sheet_name_as_building,
    )

    lookup_a = _build_circle_lookup(circles_a)
    lookup_b = _build_circle_lookup(circles_b)

    aggregate_summary = _empty_summary()
    aggregate_issues: List[Dict[str, Any]] = []
    sheet_summaries: List[Dict[str, Any]] = []

    for current_sheet_name in selected_sheet_names:
        df = _read_sheet_dataframe(
            excel_file,
            sheet_name=current_sheet_name,
            header_row=header_row,
        )
        result = _compare_single_sheet(
            df,
            sheet_name=current_sheet_name,
            header_row=header_row,
            number_column=number_column,
            x_column=x_column,
            y_column=y_column,
            building_column=building_column,
            building_source_mode=resolved_building_source_mode,
            lookup_a=lookup_a,
            lookup_b=lookup_b,
            coord_tolerance=coord_tolerance,
        )
        sheet_summaries.append(
            {
                "sheetName": result["sheetName"],
                "headerRow": result["headerRow"],
                "buildingSourceMode": result["buildingSourceMode"],
                "resolvedColumns": result["resolvedColumns"],
                "summary": result["summary"],
            }
        )
        for key, value in result["summary"].items():
            aggregate_summary[key] += int(value or 0)
        aggregate_issues.extend(result["issues"])

    return {
        "sheetName": selected_sheet_names[0],
        "sheetNames": selected_sheet_names,
        "headerRow": header_row,
        "buildingSourceMode": resolved_building_source_mode,
        "resolvedColumns": {
            "building": building_column if resolved_building_source_mode == BUILDING_SOURCE_COLUMN else None,
            "number": number_column,
            "x": x_column,
            "y": y_column,
        },
        "sheetSummaries": sheet_summaries,
        "summary": aggregate_summary,
        "issues": aggregate_issues,
        "coordTolerance": coord_tolerance,
    }
