# AGENTS.md

## Cursor Cloud specific instructions

### Overview

PileXY is a single-process Python FastAPI application that parses construction DXF drawings and extracts pile coordinates. The backend serves a vanilla HTML/CSS/JS SPA frontend — no separate frontend build step is needed.

### Running the dev server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

The frontend is served automatically at `http://localhost:8001/`.

### Running tests

Tests use Python's built-in `unittest`. No `pytest` is required (though it works if installed).

```bash
python3 -m unittest discover -s backend/tests -v
```

Note: `test_cluster_split_between_buildings_and_parking` has a known pre-existing failure.

### Linting

No linting tool is configured in the repo. `ruff` can be used for ad-hoc checks:

```bash
ruff check backend/
```

### DXF upload API

The `/api/upload-dxf` endpoint reads raw binary body (not multipart form). The `filename` query parameter is required and must end in `.dxf`. Example:

```bash
curl -X POST "http://localhost:8001/api/upload-dxf?filename=test.dxf" \
  --data-binary @path/to/file.dxf \
  -H "Content-Type: application/octet-stream"
```

### External services

- **Meissa API** (`platform-api.meissa.ai`): Optional. Used for drone/3D comparison features. Requires account credentials.
- **Cloudflare Tunnel**: Optional. Only for exposing the local server to the public internet.
- **SQLite**: Embedded; no separate process needed. Used by construction reports module.
