from __future__ import annotations

import io
import math
import re
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


def _excel_cell_preview(value: Any, max_len: int = 48) -> str:
    """건너뜀 목록 등에 넣을 짧은 원문 표시."""
    t = _cell_text(value)
    if len(t) > max_len:
        return f"{t[: max_len - 1]}…"
    return t


def _column_letter(index: int) -> str:
    current = index + 1
    letters: List[str] = []
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def _load_excel_file(file_bytes: bytes) -> pd.ExcelFile:
    try:
        return pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception as exc:
        message = str(exc)
        if "OLE2" in message or "Can't find workbook" in message:
            raise ValueError(
                "이 파일은 엑셀 시트로 열리지 않습니다. "
                "확장자가 xls여도 안에 통합문서가 없거나, 암호가 걸려 있거나, 엑셀이 아닌 파일일 수 있습니다. "
                "엑셀에서 연 다음 Excel 통합 문서(.xlsx)로 다시 저장해 올려 주세요."
            ) from exc
        raise


_HEADER_LABEL_HINTS = (
    "번호",
    "no",
    "num",
    "pile",
    "좌표",
    "coordinate",
    "building",
    "동",
    "x좌표",
    "y좌표",
)


def _row_values_look_like_header(row_values: Sequence[str]) -> bool:
    cells = [str(v or "").strip().lower() for v in row_values if str(v or "").strip()]
    if not cells:
        return False
    for cell in cells:
        for hint in _HEADER_LABEL_HINTS:
            if hint in cell:
                return True
    first = cells[0]
    if first in {"x", "y", "z"}:
        return True
    if len(cells) >= 2 and cells[0] in {"x", "no", "num"} and cells[1] in {"y", "x"}:
        return True
    return False


def _row_values_look_like_pile_data(row_values: Sequence[str]) -> bool:
    if len(row_values) < 3:
        return False
    if _row_values_look_like_header(row_values):
        return False
    number_raw = _cell_text(row_values[0])
    if not number_raw:
        return False
    if _parse_float(row_values[1]) is None or _parse_float(row_values[2]) is None:
        return False
    if re.fullmatch(r"(?i)(T|TC)\d+-\d+", re.sub(r"\s+", "", number_raw)):
        return True
    if re.fullmatch(r"[\d\-]+", re.sub(r"\s+", "", number_raw)):
        return True
    return False


def _suggest_header_row_from_preview(preview_rows_data: List[Dict[str, Any]]) -> int:
    """0 = 헤더 없음(1행부터 데이터). 1 이상 = 해당 행이 컬럼 헤더."""
    if not preview_rows_data:
        return 1
    first_values = preview_rows_data[0].get("values") or []
    if _row_values_look_like_pile_data(first_values):
        for row in preview_rows_data[: min(12, len(preview_rows_data))]:
            values = row.get("values") or []
            if _row_values_look_like_header(values):
                return int(row.get("rowNumber") or 1)
        return 0
    best_header_row = 1
    best_score = -1
    for row in preview_rows_data:
        row_values = row.get("values") or []
        non_empty = sum(1 for value in row_values if _cell_text(value))
        if non_empty > best_score:
            best_score = non_empty
            best_header_row = int(row.get("rowNumber") or 1)
    return best_header_row


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
        for row_index in range(len(df.index)):
            row_values = [_cell_text(value) for value in df.iloc[row_index].tolist()]
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
                "suggestedHeaderRow": _suggest_header_row_from_preview(preview_rows_data),
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


def _normalize_excel_building_key(value: Any) -> str:
    """시트명·동 컬럼과 도면 building_name을 동일 키로 맞춤.

    타워크레인: T4, t 4, T4동, TC4, TC4동 → 호기 숫자 기준으로 T4 로 통일(매칭 텍스트 T4-1 / TC4-1 과 짝).
    """
    text = _normalize_building(value)
    if not text or text == DEFAULT_BUILDING_NAME:
        return text
    compact = re.sub(r"\s+", "", text)
    m_tc = re.match(r"(?i)^TC(\d+)(?:동)?$", compact)
    if m_tc:
        return f"T{int(m_tc.group(1))}"
    m = re.match(r"(?i)^T(\d+)(?:동)?$", compact)
    if m:
        return f"T{int(m.group(1))}"
    # 101 / 101동 등 숫자 동명 통일 — 시트명·윤곽 building_name 표기 차이로 행 전체가 빠지지 않게
    if not _is_parking_building_name(text):
        m_dong = re.match(r"^(\d+)동?$", compact)
        if m_dong:
            return f"{int(m_dong.group(1))}동"
    return text


def _leading_dong_int_from_building_name(value: Any) -> Optional[int]:
    """숫자+동 형태(101동, 10)에서 선행 동 번호만 추출. 타워·주차장 등은 None."""
    text = _normalize_building(value)
    if not text or text == DEFAULT_BUILDING_NAME:
        return None
    compact = re.sub(r"\s+", "", text)
    if re.match(r"(?i)^T\d", compact) or re.match(r"(?i)^TC\d", compact):
        return None
    if _is_parking_building_name(text):
        return None
    m = re.match(r"^(\d+)(?:동)?$", compact)
    if m:
        return int(m.group(1))
    return None


def _is_parking_building_name(value: Any) -> bool:
    text = _normalize_building(value).replace(" ", "").lower()
    if not text:
        return False
    if "주차장" in text:
        return True
    if text.startswith("b") and len(text) >= 2 and text[1:].isdigit():
        return True
    return False


def _single_parking_building_name(
    lookup: Dict[Tuple[str, str], List[Dict[str, Any]]],
) -> Optional[str]:
    names = {
        building_name
        for (building_name, _number) in lookup.keys()
        if _is_parking_building_name(building_name)
    }
    if len(names) != 1:
        return None
    return next(iter(names))


def _normalize_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    raw = re.sub(r"[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+", "-", raw)
    raw = re.sub(r"\s+", "", raw)
    # 타워크레인 T4-1 / TC4-1: 호기는 시트/윤곽(T4)과 맞추고, 번호는 하이픈 뒤(파일 번호)만 사용 — 엑셀 "1"과 동일 키
    tower_m = re.fullmatch(r"(?i)(T|TC)(\d+)-(\d+)", raw)
    if tower_m:
        return str(int(tower_m.group(3)))
    parts = raw.split("-")
    if len(parts) >= 2 and all(p.isdigit() for p in parts):
        if len(parts) >= 3:
            # 8-15-2 → 파일측 토큰 15-2 (동 접두 제거, 프론트 formatDisplayedPileNumber·동-번호 파싱과 동일)
            return "-".join(parts[1:])
        a, b = parts[0], parts[1]
        # 한 자리-한 자리(예: 2-2, 3-5)는 동-번호 분리가 아니라 파일번호 통째 표기로 본다.
        if len(a) == 1 and len(b) == 1:
            return f"{a}-{b}"
        na, nb = int(a), int(b)
        if (len(a) <= 2 or na <= 9) and len(b) >= 2:
            return str(nb)
        if len(b) == 1 and len(a) >= 2:
            return f"{a}-{b}"
        return str(nb)
    hyphen_match = re.fullmatch(r"(\d+)-(\d+)", raw)
    if hyphen_match:
        return str(int(hyphen_match.group(2)))
    if raw.endswith(".0"):
        try:
            return str(int(float(raw)))
        except ValueError:
            return raw
    return raw


def _compact_digit_hyphen_token(value: Any) -> str:
    """번호 셀·매칭텍스트에서 공백·유니코드 대시를 제거한 하이픈 연결 토큰."""
    raw = _cell_text(value)
    if not raw:
        return ""
    t = re.sub(r"[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+", "-", raw)
    return re.sub(r"\s+", "", t)


def _leading_dong_digit_chain_split(compact: str) -> Optional[Tuple[int, str]]:
    """
    전부 숫자인 하이픈 3구간 이상(예: 112-116-2)이면 앞을 동 번호, 뒤를 파일 토큰으로 본다.
    _normalize_number 가 116-2 로 줄인 경우와 짝을 맞춘다.
    """
    if not compact or "-" not in compact:
        return None
    parts = compact.split("-")
    if len(parts) < 3 or not all(p.isdigit() for p in parts):
        return None
    return int(parts[0]), "-".join(parts[1:])


def _dong_building_key_suffixes(dong: int) -> List[str]:
    """엑셀·윤곽에서 흔한 동 표기 — 112동 / 112."""
    return [f"{dong}동", str(dong)]


def _dedupe_pairs(pairs: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    seen = set()
    out: List[Tuple[str, str]] = []
    for bk, pid in pairs:
        t = (bk, pid)
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def _pile_match_lookup_pairs(
    building_name: Any,
    text_raw: Any,
    pile_norm: str,
) -> List[Tuple[str, str]]:
    """(building_key, pile_token) — 도면·엑셀 양쪽에서 동일하게 쓰는 조회 키 별칭.

    - 삼중 번호(112-116-2), 한 자리-한 자리(1-1→뒤 1), 10-1/110-1 축약 등
      프론트 동-번호 집계(parseHyphenPileText)와 같은 축으로 맞춘다.
    - 도면 matched_text·엑셀 번호 열 모두 이 함수를 거쳐 행 단위 1:1 비교가 되게 한다.
    """
    if not pile_norm:
        return []
    base_bn = _normalize_excel_building_key(building_name)
    pairs: List[Tuple[str, str]] = [(base_bn, pile_norm)]
    trip = _leading_dong_digit_chain_split(_compact_digit_hyphen_token(text_raw))
    if trip:
        d0, rest = trip
        if rest == pile_norm:
            for suf in _dong_building_key_suffixes(d0):
                pairs.append((_normalize_excel_building_key(suf), rest))
    compact = _compact_digit_hyphen_token(text_raw)
    mm = re.fullmatch(r"(\d)-(\d)", compact) if compact else None
    if mm:
        suf = mm.group(2)
        if suf:
            pairs.append((base_bn, suf))
    m2 = re.fullmatch(r"(\d+)-(\d+)", compact) if compact else None
    if m2:
        a_digits, b_digits = m2.group(1), m2.group(2)
        if not (len(a_digits) == 1 and len(b_digits) == 1):
            dong_prefix = int(a_digits)
            pile_suffix = str(int(b_digits))
            bd_dong = _leading_dong_int_from_building_name(building_name)
            bd_str = str(bd_dong) if bd_dong is not None else ""

            if bd_dong is not None and bd_dong == dong_prefix:
                pairs.append((base_bn, pile_suffix))
            elif bd_dong is not None and bd_str.endswith(a_digits) and dong_prefix != bd_dong:
                pairs.append((base_bn, pile_suffix))

            if bd_dong is None:
                for suf in _dong_building_key_suffixes(dong_prefix):
                    pairs.append((_normalize_excel_building_key(suf), pile_suffix))
            elif bd_dong == dong_prefix:
                for suf in _dong_building_key_suffixes(dong_prefix):
                    pairs.append((_normalize_excel_building_key(suf), pile_suffix))
            elif bd_dong is not None and bd_str.endswith(a_digits) and dong_prefix != bd_dong:
                for suf in _dong_building_key_suffixes(bd_dong):
                    pairs.append((_normalize_excel_building_key(suf), pile_suffix))
    return _dedupe_pairs(pairs)


def _circle_lookup_entry_pairs(circle: Dict[str, Any]) -> List[Tuple[str, str]]:
    if not isinstance(circle, dict):
        return []
    matched = circle.get("matched_text")
    if not isinstance(matched, dict):
        return []
    pile_norm = _normalize_number(matched.get("text"))
    if not pile_norm:
        return []
    return _pile_match_lookup_pairs(circle.get("building_name"), matched.get("text"), pile_norm)


def _excel_row_lookup_pairs(building_name: str, number_raw: Any, number_norm: str) -> List[Tuple[str, str]]:
    """엑셀 한 행에서 조회할 (동키, 파일토큰) 후보.

    - 번호 열에 T4-1 / TC4-7 처럼 **타워 전체 표기**가 있으면 **호기 T4 + 파일 번호 1**로만 조회한다.
      (시트명이 다른 동이어도 T4호기 1번과 매칭 — 엑셀에 흔한 형식)
    - 그 외에는 도면과 동일한 _pile_match_lookup_pairs 로 동-번호·단순 번호 별칭을 맞춘다.
    """
    raw = str(number_raw or "").strip()
    raw = re.sub(r"[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+", "-", raw)
    raw = re.sub(r"\s+", "", raw)
    tower_m = re.fullmatch(r"(?i)(T|TC)(\d+)-(\d+)", raw)
    if tower_m:
        tower_bn = _normalize_excel_building_key(f"T{int(tower_m.group(2))}")
        pile_tok = str(int(tower_m.group(3)))
        return [(tower_bn, pile_tok)]
    if not number_norm:
        return []
    return _pile_match_lookup_pairs(building_name, number_raw, number_norm)


def _number_aliases(value: Any) -> List[str]:
    normalized = _normalize_number(value)
    if not normalized:
        return []
    # 엑셀/도면 모두 _normalize_number로 동일 정규화 후 비교하므로
    # 별도 별칭 확장은 하지 않고 "좌표번호" 1개 키로만 매칭한다.
    return [normalized]


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
        for bk, pile_token in _circle_lookup_entry_pairs(circle):
            lookup[(bk, pile_token)].append(circle)
    return lookup


def _excel_cad_axis_distance(circle: Dict[str, Any], excel_x: float, excel_y: float) -> float:
    """엑셀 좌표와 CAD 원 중심 거리. 좌표계가 서로 X↔Y이므로 엑셀 X↔CAD Y, 엑셀 Y↔CAD X로 대응."""
    dx = float(circle.get("center_y", 0.0)) - excel_x
    dy = float(circle.get("center_x", 0.0)) - excel_y
    return math.hypot(dx, dy)


def _pick_best_circle(
    lookup: Dict[Tuple[str, str], List[Dict[str, Any]]],
    building_name: str,
    number_raw: Any,
    number_normalized: str,
    x: float,
    y: float,
    *,
    single_parking_building: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    seen: set[str] = set()

    def _append_from_bucket(bucket: List[Dict[str, Any]]) -> None:
        for circle in bucket:
            cid = str(circle.get("id", "") or "")
            key = cid or str(id(circle))
            if key in seen:
                continue
            seen.add(key)
            candidates.append(circle)

    pairs = _excel_row_lookup_pairs(building_name, number_raw, number_normalized)
    for bk, pile_token in pairs:
        _append_from_bucket(lookup.get((bk, pile_token), []))

    if (
        not candidates
        and single_parking_building
        and _is_parking_building_name(_normalize_excel_building_key(building_name))
    ):
        for pile_token in {pid for _bk, pid in pairs}:
            _append_from_bucket(lookup.get((single_parking_building, pile_token), []))
    if not candidates:
        return None
    return min(candidates, key=lambda circle: _excel_cad_axis_distance(circle, x, y))


def _empty_summary() -> Dict[str, int]:
    return {
        "totalRows": 0,
        "skippedRows": 0,
        "skippedMissingNumber": 0,
        "skippedInvalidX": 0,
        "skippedInvalidY": 0,
        "matchBoth": 0,
        "matchOldOnly": 0,
        "matchNewOnly": 0,
        "missingOld": 0,
        "missingNew": 0,
        "missingBoth": 0,
        "coordMismatch": 0,
        "missingExcel": 0,
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


MAX_HEADER_SCAN_ROWS = 120


def _excel_column_letter_to_index(letters: str) -> int:
    """A→0, B→1, …, Z→25, AA→26. 잘못된 문자면 -1."""
    token = str(letters or "").strip().upper()
    if not token:
        return -1
    n = 0
    for ch in token:
        if ch < "A" or ch > "Z":
            return -1
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _norm_header_cell_text(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def _header_markers_complete(markers: Optional[Dict[str, Any]]) -> bool:
    if not markers or not isinstance(markers, dict):
        return False
    for k in ("number", "x", "y"):
        if not str(markers.get(k) or "").strip():
            return False
    return True


def _cell_matches_header_marker(cell: Any, marker: str) -> bool:
    mc = _norm_header_cell_text(marker)
    if not mc:
        return False
    cv = _norm_header_cell_text(cell)
    if not cv:
        return False
    if mc == cv:
        return True
    if mc in cv or cv in mc:
        return True
    if cv.startswith(mc) or mc.startswith(cv):
        return True
    return False


def _find_header_row_0based_by_markers(
    df_raw: pd.DataFrame,
    num_idx: int,
    x_idx: int,
    y_idx: int,
    markers: Dict[str, Any],
    max_scan: int,
) -> Optional[int]:
    """번호/X/Y 열에 지정한 헤더 글자가 같은 행을 찾는다 (0-based)."""
    n_rows = min(max_scan, len(df_raw))
    mk_n = str(markers.get("number") or "").strip()
    mk_x = str(markers.get("x") or "").strip()
    mk_y = str(markers.get("y") or "").strip()
    for r in range(n_rows):
        row = df_raw.iloc[r]
        width = int(row.shape[0])
        def cell_at(i: int) -> Any:
            if i < 0 or i >= width:
                return ""
            return row.iloc[i]

        if (
            _cell_matches_header_marker(cell_at(num_idx), mk_n)
            and _cell_matches_header_marker(cell_at(x_idx), mk_x)
            and _cell_matches_header_marker(cell_at(y_idx), mk_y)
        ):
            return r
    return None


def _read_sheet_dataframe(
    excel_file: pd.ExcelFile,
    *,
    sheet_name: str,
    header_row: int,
) -> pd.DataFrame:
    if header_row < 0:
        raise ValueError("header_row must be 0 or greater.")
    if header_row == 0:
        df = pd.read_excel(
            excel_file,
            sheet_name=sheet_name,
            header=None,
            dtype=object,
        )
        df.columns = [_column_letter(index) for index in range(df.shape[1])]
        return df
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


def _read_sheet_dataframe_with_header_markers(
    excel_file: pd.ExcelFile,
    *,
    sheet_name: str,
    number_column: str,
    x_column: str,
    y_column: str,
    header_row_fallback: int,
    header_markers: Dict[str, Any],
) -> Tuple[pd.DataFrame, int]:
    """
    열 문자(A,B,…)는 동일하고, 시트마다 헤더 행만 다를 때
    번호/X/Y 열에 적힌 헤더 글자로 헤더 행을 찾는다.
    실패 시 header_row_fallback(1-based) 사용.
    """
    hb = max(0, int(header_row_fallback))
    if hb == 0:
        return _read_sheet_dataframe(excel_file, sheet_name=sheet_name, header_row=0), 0
    num_i = _excel_column_letter_to_index(number_column)
    x_i = _excel_column_letter_to_index(x_column)
    y_i = _excel_column_letter_to_index(y_column)
    if min(num_i, x_i, y_i) < 0:
        return _read_sheet_dataframe(excel_file, sheet_name=sheet_name, header_row=hb), hb
    try:
        df_raw = pd.read_excel(
            excel_file,
            sheet_name=sheet_name,
            header=None,
            dtype=object,
            nrows=MAX_HEADER_SCAN_ROWS,
        )
    except Exception:
        return _read_sheet_dataframe(excel_file, sheet_name=sheet_name, header_row=hb), hb
    if df_raw is None or len(df_raw) == 0:
        return _read_sheet_dataframe(excel_file, sheet_name=sheet_name, header_row=hb), hb
    r0 = _find_header_row_0based_by_markers(
        df_raw,
        num_i,
        x_i,
        y_i,
        header_markers,
        len(df_raw),
    )
    if r0 is None:
        return _read_sheet_dataframe(excel_file, sheet_name=sheet_name, header_row=hb), hb
    df = pd.read_excel(
        excel_file,
        sheet_name=sheet_name,
        header=r0,
        dtype=object,
    )
    df.columns = [
        str(column).strip() if str(column).strip() else f"COL_{index + 1}"
        for index, column in enumerate(df.columns)
    ]
    return df, r0 + 1


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
    skipped_details: List[Dict[str, Any]] = []
    single_parking_building_a = _single_parking_building_name(lookup_a)
    single_parking_building_b = _single_parking_building_name(lookup_b)
    excel_pairs = set()
    compared_buildings = {_normalize_excel_building_key(sheet_name)} if building_source_mode == BUILDING_SOURCE_SHEET else set()

    for data_index, row in df.iterrows():
        building_ctx = (
            _cell_text(row.get(resolved_building_column))
            if building_source_mode == BUILDING_SOURCE_COLUMN and resolved_building_column
            else sheet_name
        )
        number_raw = row.get(resolved_number_column)
        number = _normalize_number(number_raw)
        # Presence is based on building/number even when coordinates are invalid.
        # Aggregate across sheets before checking the reverse (drawing -> Excel) direction.
        pairs = _excel_row_lookup_pairs(_normalize_excel_building_key(building_ctx), number_raw, number)
        if number:
            excel_pairs.update(pairs)
            compared_buildings.update(bn for bn, _ in pairs)
            if _is_parking_building_name(_normalize_excel_building_key(building_ctx)):
                for parking in (single_parking_building_a, single_parking_building_b):
                    if parking:
                        compared_buildings.add(parking)
                        excel_pairs.update((parking, token) for _, token in pairs)
        x = _parse_float(row.get(resolved_x_column))
        y = _parse_float(row.get(resolved_y_column))
        excel_row_1based = int(data_index) + header_row + 1
        if not number:
            summary["skippedMissingNumber"] += 1
            summary["skippedRows"] += 1
            skipped_details.append(
                {
                    "sheetName": sheet_name,
                    "excelRow": excel_row_1based,
                    "reason": "missing-number",
                    "buildingContext": building_ctx,
                    "numberRaw": _excel_cell_preview(number_raw),
                    "xRaw": _excel_cell_preview(row.get(resolved_x_column)),
                    "yRaw": _excel_cell_preview(row.get(resolved_y_column)),
                }
            )
            continue
        if x is None:
            summary["skippedInvalidX"] += 1
            summary["skippedRows"] += 1
            skipped_details.append(
                {
                    "sheetName": sheet_name,
                    "excelRow": excel_row_1based,
                    "reason": "invalid-x",
                    "buildingContext": building_ctx,
                    "numberRaw": _excel_cell_preview(number_raw),
                    "xRaw": _excel_cell_preview(row.get(resolved_x_column)),
                    "yRaw": _excel_cell_preview(row.get(resolved_y_column)),
                }
            )
            continue
        if y is None:
            summary["skippedInvalidY"] += 1
            summary["skippedRows"] += 1
            skipped_details.append(
                {
                    "sheetName": sheet_name,
                    "excelRow": excel_row_1based,
                    "reason": "invalid-y",
                    "buildingContext": building_ctx,
                    "numberRaw": _excel_cell_preview(number_raw),
                    "xRaw": _excel_cell_preview(row.get(resolved_x_column)),
                    "yRaw": _excel_cell_preview(row.get(resolved_y_column)),
                }
            )
            continue

        if building_source_mode == BUILDING_SOURCE_COLUMN:
            building_name = _normalize_excel_building_key(row.get(resolved_building_column))
        else:
            building_name = _normalize_excel_building_key(sheet_name)

        summary["totalRows"] += 1

        circle_a = _pick_best_circle(
            lookup_a,
            building_name,
            number_raw,
            number,
            x,
            y,
            single_parking_building=single_parking_building_a,
        )
        circle_b = _pick_best_circle(
            lookup_b,
            building_name,
            number_raw,
            number,
            x,
            y,
            single_parking_building=single_parking_building_b,
        )
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
                    # 표 표시 좌표는 엑셀과 동일한 X,Y 순서로 노출한다.
                    # (CAD center_x/center_y를 그대로 내보내면 축이 반대로 보인다)
                    "x": float(circle_a.get("center_y")),
                    "y": float(circle_a.get("center_x")),
                    "number": _match_number(circle_a),
                    "distance": _excel_cad_axis_distance(circle_a, x, y),
                }
                if circle_a
                else None,
                "newCircle": {
                    "x": float(circle_b.get("center_y")),
                    "y": float(circle_b.get("center_x")),
                    "number": _match_number(circle_b),
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
        "skippedDetails": skipped_details,
        "excelPairs": excel_pairs,
        "comparedBuildings": compared_buildings,
    }


def compare_excel_workbook(
    file_bytes: bytes,
    *,
    sheet_name: Optional[str] = None,
    sheet_names: Optional[Sequence[str]] = None,
    header_row: int,
    header_rows: Optional[Dict[str, int]] = None,
    header_markers: Optional[Dict[str, Any]] = None,
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
    aggregate_skipped: List[Dict[str, Any]] = []
    sheet_summaries: List[Dict[str, Any]] = []
    excel_pairs = set()
    compared_buildings = set()
    building_sheets = {}

    for current_sheet_name in selected_sheet_names:
        effective_header = int(header_row)
        if header_rows and isinstance(header_rows, dict):
            raw_h = header_rows.get(current_sheet_name)
            if raw_h is None:
                raw_h = header_rows.get(str(current_sheet_name))
            if raw_h is not None:
                try:
                    parsed_h = int(raw_h)
                    if parsed_h >= 0:
                        effective_header = parsed_h
                except (TypeError, ValueError):
                    pass
        if _header_markers_complete(header_markers):
            df, detected_header = _read_sheet_dataframe_with_header_markers(
                excel_file,
                sheet_name=current_sheet_name,
                number_column=number_column,
                x_column=x_column,
                y_column=y_column,
                header_row_fallback=effective_header,
                header_markers=header_markers or {},
            )
            effective_header = detected_header
        else:
            df = _read_sheet_dataframe(
                excel_file,
                sheet_name=current_sheet_name,
                header_row=effective_header,
            )
        result = _compare_single_sheet(
            df,
            sheet_name=current_sheet_name,
            header_row=effective_header,
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
                "skippedDetails": result.get("skippedDetails") or [],
            }
        )
        for key, value in result["summary"].items():
            aggregate_summary[key] += int(value or 0)
        aggregate_issues.extend(result["issues"])
        aggregate_skipped.extend(result.get("skippedDetails") or [])
        excel_pairs.update(result["excelPairs"])
        compared_buildings.update(result["comparedBuildings"])
        for building in result["comparedBuildings"]:
            building_sheets.setdefault(building, current_sheet_name)

    missing_excel = {}
    for field, circles in (("oldCircle", circles_a), ("newCircle", circles_b)):
        for circle in circles:
            pairs = set(_circle_lookup_entry_pairs(circle))
            if not pairs or pairs & excel_pairs or not any(bn in compared_buildings for bn, _ in pairs):
                continue
            building = _normalize_excel_building_key(circle.get("building_name"))
            number = _normalize_number(_match_number(circle))
            issue = missing_excel.setdefault((building, number), {
                "status": "missing-excel", "sheetName": building_sheets.get(building, ""), "excelRow": None,
                "buildingName": building, "number": number, "excelX": None, "excelY": None,
                "oldCircle": None, "newCircle": None,
            })
            issue[field] = {"x": float(circle["center_y"]), "y": float(circle["center_x"]),
                            "number": _match_number(circle), "distance": None}
    aggregate_summary["missingExcel"] = len(missing_excel)
    aggregate_issues.extend(missing_excel.values())
    for sheet in sheet_summaries:
        sheet["summary"]["missingExcel"] = sum(issue["sheetName"] == sheet["sheetName"] for issue in missing_excel.values())

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
        "skippedDetails": aggregate_skipped,
        "coordTolerance": coord_tolerance,
    }
