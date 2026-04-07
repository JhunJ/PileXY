"""
말뚝 정사 패치 데이터셋: 브라우저에서 크롭 PNG + 메타데이터(품질 라벨) 업로드 저장.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/api/pile-dataset", tags=["pile-dataset"])

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROPS_DIR = os.path.join(_ROOT, "data", "pile_dataset", "crops")
INDEX_PATH = os.path.join(_ROOT, "data", "pile_dataset", "index.jsonl")
_MAX_BYTES = 32 * 1024 * 1024


def _ensure_dirs() -> None:
    os.makedirs(CROPS_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)


@router.post("/crops")
async def pile_dataset_save_crop(
    image: UploadFile = File(...),
    metadata: str = Form(...),
) -> Dict[str, Any]:
    _ensure_dirs()
    try:
        meta: Dict[str, Any] = json.loads(metadata)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"metadata JSON 오류: {e}") from e
    q = meta.get("quality")
    _QUALITY = ("ok", "mid", "bad", "other")
    _LEGACY = ("cap_ok", "cap_mid", "cap_bad")
    if q not in _QUALITY and q not in _LEGACY:
        raise HTTPException(
            status_code=400,
            detail="quality는 ok, mid, bad, other(또는 레거시 cap_ok, cap_mid, cap_bad) 중 하나여야 합니다.",
        )
    if q == "other":
        raw_label = (meta.get("inferenceTargetLabel") or meta.get("qualityCustomLabel") or "").strip()
        if not raw_label:
            raise HTTPException(
                status_code=400,
                detail='quality가 other일 때 metadata에 inferenceTargetLabel(또는 qualityCustomLabel) 문자열이 필요합니다.',
            )
        if len(raw_label) > 200:
            raise HTTPException(status_code=400, detail="inferenceTargetLabel은 200자 이내여야 합니다.")
    body = await image.read()
    if not body:
        raise HTTPException(status_code=400, detail="이미지가 비었습니다.")
    if len(body) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="이미지가 너무 큽니다.")
    uid = uuid.uuid4().hex[:12]
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    safe = re.sub(r"[^\w\-.]", "_", str(meta.get("circleId") or "unknown"))[:48]
    fn = f"{ts}_{q}_{safe}_{uid}.png"
    path = os.path.join(CROPS_DIR, fn)
    with open(path, "wb") as f:
        f.write(body)
    saved_at = datetime.now(timezone.utc).isoformat()
    entry = {**meta, "savedFile": fn, "savedAtUtc": saved_at}
    with open(INDEX_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"ok": True, "file": fn, "relativePath": f"data/pile_dataset/crops/{fn}"}


@router.post("/reset")
def pile_dataset_reset() -> Dict[str, Any]:
    """crops 폴더의 이미지와 index.jsonl 삭제(누적 데이터셋 초기화)."""
    _ensure_dirs()
    removed = 0
    errors: list[str] = []
    try:
        for name in os.listdir(CROPS_DIR):
            low = name.lower()
            if not (low.endswith(".png") or low.endswith(".jpg") or low.endswith(".webp")):
                continue
            fp = os.path.join(CROPS_DIR, name)
            try:
                if os.path.isfile(fp):
                    os.remove(fp)
                    removed += 1
            except OSError as e:
                errors.append(f"{name}: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if os.path.isfile(INDEX_PATH):
        try:
            os.remove(INDEX_PATH)
        except OSError as e:
            errors.append(f"index: {e}")
    return {"ok": True, "removedImageFiles": removed, "errors": errors}
