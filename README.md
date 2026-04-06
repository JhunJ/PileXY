# 파일 좌표 추출 도구

FastAPI + ezdxf powers the backend and a vanilla HTML/CSS/JS SPA handles the UI. Upload a DXF to parse CIRCLE + numeric TEXT entities, convert them into world coordinates (including INSERT transforms), match each circle to its nearest numeric label, visualize everything on a 2D canvas, inspect duplicate groups, and download CSV/XLSX reports.

## Project Layout

```
project-root/
├── backend/
│   ├── main.py          # FastAPI app + filters + exports
│   ├── dxf_parser.py    # ezdxf loader (CIRCLE + TEXT + transforms)
│   ├── models.py        # Pydantic response models
│   └── requirements.txt # Backend dependencies
├── frontend/
│   ├── index.html       # Single-page UI
│   ├── app.js           # Upload/filter/viewer/duplicate/download logic
│   └── styles.css       # UI styling
└── README.md
```

## Backend

1. Install dependencies (recommend venv):
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run FastAPI (CORS enabled):
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
   ```
3. Key endpoints
   - `POST /api/upload-dxf` – multipart form with `file`, `min_diameter`, `max_diameter`, `text_height_min`, `text_height_max`. Parses DXF, filters entities, matches circles↔texts, detects duplicates, and returns summary/circles/texts/duplicates/filter information.
   - `GET /api/circles` – re-run server-side filters on the last uploaded DXF without re-uploading.
   - `GET /api/circles/export?format=csv|xlsx` – exports the filtered set (duplicate coordinates collapsed to a single representative row).

**대용량 DXF 업로드 시 1%에서 멈출 때 (리버스 프록시 사용 시)**  
nginx 등으로 백엔드를 감싼 경우, 업로드 본문이 버퍼링되어 1~2MB만 전달된 뒤 멈출 수 있습니다. `server { ... }` 블록 안에 다음을 추가한 뒤 nginx를 재시작하세요.
```nginx
proxy_request_buffering off;
```

Notes:
- TEXT parsing happens only for numeric strings whose final world-space height falls within **0.5 ~ 1.1** (default, adjustable via API params and UI inputs).
- Circle↔text matching uses a spatial hash grid for near-neighbor lookups, so large drawings stay responsive.
- Duplicate detection is dictionary-based on rounded (x, y) keys to keep it O(n).

## Frontend

If you have a separate frontend, set `window.__API_BASE_URL__` to your backend URL before loading `frontend/app.js`.
If frontend and backend are served from the same domain, the app will use the current site origin automatically.
If you open `http://127.0.0.1:8001/`, the backend will now serve `frontend/index.html` directly.

## Cloudflare Tunnel

Use this when the backend runs on your own machine but you want the public domain `https://pilexy.yeobaekstudio.com/` to reach it directly.

1. Install `cloudflared` on the machine running this project.
2. Log in once with your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```
3. Create a tunnel and note its name/ID:
   ```bash
   cloudflared tunnel create pilexy
   ```
4. Point the tunnel to the local backend using `cloudflared-config.yml`.
5. In Cloudflare Zero Trust, map `pilexy.yeobaekstudio.com` to that tunnel.
6. Run the tunnel alongside the local backend:
   ```bash
   cloudflared tunnel run pilexy
   ```

This makes the public domain forward to `http://localhost:8001`, so the browser can keep calling the same origin without hardcoded localhost URLs.

**대용량 DXF(약 3MB 초과) 업로드:** Cloudflare Tunnel은 요청 본문을 한 번에 스트리밍하지 않고 버퍼링할 수 있어, 126MB 같은 파일을 한 번에 올리면 1% 근처에서 멈출 수 있습니다. 이 경우 앱이 자동으로 **청크 업로드**(1MB 단위로 잘라 여러 요청 전송)를 사용하므로, `https://pilexy.yeobaekstudio.com` 에서도 대용량 파일이 완료까지 진행됩니다.

## Cloudflare Worker Proxy

The Worker approach is still useful if your backend is hosted elsewhere, but for a local machine the Tunnel setup above is the easiest.

## Implementation Notes

- Block INSERTs account for translation/rotation/scale and array offsets before any filtering or matching.
- TEXT labels render at their world insert point with a slight offset so they stay readable; toggles are provided for text labels, points, circles, and match lines.
- Match lines visually confirm the server-side CIRCLE↔TEXT pairing; unmatched circles render in a contrasting color for easy debugging.
- CSV outputs include extra metadata: matched text value/height plus duplicate counts and ID lists.
