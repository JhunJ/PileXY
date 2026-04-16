/**
 * Meissa–PDAM 비교 — 메인 앱 우측 드로어 또는 meissa-compare.html 단독 페이지.
 * Meissa 목록은 백엔드 `/api/meissa/*` 가 platform-api.meissa.ai 를 대리 호출합니다(토큰은 메모리에만).
 */

(function () {
  const API_BASE_URL =
    window.__API_BASE_URL__ ||
    (window.location.origin && window.location.origin !== "null" ? window.location.origin : "");

  /** true 이면 API URL 이 페이지와 다른 출처이어도 orthophoto 를 fetch(blob) 시도 */
  const MEISSA_ORTHO_ALLOW_CROSS_ORIGIN_FETCH =
    typeof window !== "undefined" && window.__MEISSA_ORTHO_ALLOW_CROSS_ORIGIN_FETCH__ === true;

  /** orthophoto URL 이 현재 페이지와 origin 이 다르면 fetch 는 CORS 없이 TypeError Failed to fetch 가 흔함. <img> 는 표시용으로는 동작할 수 있음. */
  function pilexyOrthophotoUrlCrossOrigin(urlStr) {
    try {
      const pageO = window.location.origin;
      if (!pageO || pageO === "null" || /^file:/i.test(pageO)) return false;
      const u = new URL(String(urlStr || "").trim());
      return u.origin !== pageO;
    } catch (_) {
      return false;
    }
  }

  const els = {
    dataset: document.getElementById("meissa-dataset"),
    workId: document.getElementById("meissa-work-id"),
    datePreset: document.getElementById("meissa-date-preset"),
    dateInput: document.getElementById("meissa-date-input"),
    loadOptions: document.getElementById("meissa-load-options"),
    loadPdam: document.getElementById("meissa-load-pdam"),
    pdamStatus: document.getElementById("meissa-pdam-status"),
    meissaEmail: document.getElementById("meissa-email"),
    meissaPassword: document.getElementById("meissa-password"),
    meissaOtpRow: document.getElementById("meissa-otp-row"),
    meissaOtp: document.getElementById("meissa-otp"),
    meissaLoginBtn: document.getElementById("meissa-login-btn"),
    meissaApiStatus: document.getElementById("meissa-api-status"),
    meissaProjectSelect: document.getElementById("meissa-project-select"),
    meissaZoneSelect: document.getElementById("meissa-zone-select"),
    meissaSnapshotSelect: document.getElementById("meissa-snapshot-select"),
    meissaSnapshotYear: document.getElementById("meissa-snapshot-year"),
    meissaSnapshotMonth: document.getElementById("meissa-snapshot-month"),
    meissaSnapshotPreview: document.getElementById("meissa-snapshot-preview"),
    meissaSnapshotPreviewDate: document.getElementById("meissa-snapshot-preview-date"),
    meissaSnapshotPreviewTitle: document.getElementById("meissa-snapshot-preview-title"),
    meissaSnapshotPreviewSub: document.getElementById("meissa-snapshot-preview-sub"),
    projectId: document.getElementById("meissa-project-id"),
    zoneId: document.getElementById("meissa-zone-id"),
    snapshotId: document.getElementById("meissa-snapshot-id"),
    meissaCloud3dFrame: document.getElementById("meissa-cloud-3d-frame"),
    meissaCloud2dImageLocal: document.getElementById("meissa-cloud-2d-image-local"),
    meissaDomOverlayStage:
      document.getElementById("meissa-dom-overlay-stage") ||
      document.getElementById("meissa-2d-url-overlay-wrap"),
    meissaDomOverlayImage:
      document.getElementById("meissa-dom-overlay-image") ||
      document.getElementById("meissa-2d-url-overlay-img"),
    meissaDomOverlayPoints:
      document.getElementById("meissa-dom-overlay-points") ||
      document.getElementById("meissa-2d-url-overlay-points"),
    meissaDomOverlayStatus:
      document.getElementById("meissa-dom-overlay-status") ||
      document.getElementById("meissa-2d-url-overlay-status"),
    meissaCloud3dPlaceholder: document.getElementById("meissa-cloud-3d-placeholder"),
    meissaOpen3dTab: document.getElementById("meissa-open-3d-tab"),
    meissaCloudSessionPrime: document.getElementById("meissa-cloud-session-prime"),
    offsetX: document.getElementById("meissa-offset-x"),
    offsetY: document.getElementById("meissa-offset-y"),
    terrainRadius: document.getElementById("meissa-terrain-radius"),
    fromOpener: document.getElementById("meissa-from-opener"),
    runCompare: document.getElementById("meissa-run-compare"),
    compareStatus: document.getElementById("meissa-compare-status"),
    resultBody: document.getElementById("meissa-result-body"),
    meissa3dColorMode: document.getElementById("meissa-3d-color-mode"),
    meissa3dLegendText: document.getElementById("meissa-3d-legend-text"),
    meissaRemainingMinFilter: document.getElementById("meissa-remaining-min-filter"),
    meissa3dDebugBtn: document.getElementById("meissa-3d-debug-btn"),
    meissa3dDebugText: document.getElementById("meissa-3d-debug-text"),
    meissa2dLoadStatus: document.getElementById("meissa-2d-load-status"),
    meissaZDebugBody: document.getElementById("meissa-z-debug-body"),
    meissaZDebugNote: document.getElementById("meissa-z-debug-note"),
    meissaZoneZSummary: document.getElementById("meissa-zone-z-summary"),
    meissaCompareTierSummary: document.getElementById("meissa-compare-tier-summary"),
    meissaTierFiltersWrap: document.getElementById("meissa-tier-filters"),
  };

  /** 날짜 파싱 불가 스냅샷만 있을 때 년도 셀렉트 값 */
  const MEISSA_SNAPSHOT_NODATE_YEAR = "__nodate__";
  let meissaCascadeUpdating = false;
  /** 단독 페이지 URL `?projectContext=` — 메인 앱에서는 __PILEXY_GET_MEISSA_CONTEXT__.projectContext 우선 */
  let pilexyPdamProjectContextOverride = "";

  let state = {
    circles: [],
    lastDashboard: null,
    /** @type {Array<Record<string, unknown>>} 비교 계산 직후 3D 색상용 */
    lastCompareRecords: [],
    /** @type {Map<string, Record<string, unknown>>} circleId → 마지막 비교 행 */
    meissaCompareByCircleId: new Map(),
    /** @type {[number, number] | null} Meissa Z 구역 편차 색 스케일 */
    meissaZoneResidualExtent: null,
    /** @type {Array<Record<string, unknown>>} 현재 존의 Meissa 스냅샷 목록 */
    meissaSnapshots: [],
    /** @type {Array<Record<string, unknown>>} 현재 스냅샷 리소스 목록 캐시 */
    meissaSnapshotResources: [],
    /** @type {string} 현재 점군 버퍼가 가리키는 snapshot id */
    meissaActiveSnapshotId: "",
    /** @type {Array<[number, number, number]>} Meissa 원본 리소스에서 추출된 3D 포인트 */
    meissaBasePoints: [],
    /** @type {Array<[number, number, number]>} Meissa 원본 포인트 색(RGB 0..1) */
    meissaBasePointColors: [],
    /** @type {number} 마지막 리소스 개수 */
    meissaResourceCount: 0,
    /** @type {string} 마지막 점군 디버그 텍스트 */
    meissaResourceDebugText: "",
    /** @type {string} 2D 로드 실패 시 상태줄에 붙일 힌트(ortho/raw 응답 요약) */
    meissa2dLoadFailHint: "",
    /** circleId → PDAM 매핑 행(status, constructionDate …) — 「PDAM 불러오기」·비교 계산 후 채움 */
    pdamByCircleId: /** @type {Map<string, Record<string, unknown>>} */ (new Map()),
    /** 마지막 비교 시 Meissa nearest-z API 원본 응답 배열(디버그) */
    lastMeissaNearestZResponses: /** @type {Array<Record<string, unknown>|null>} */ ([]),
  };

  /** @type {string|null} Meissa 액세스 JWT — 로그인 시 localStorage(`pilexy-meissa-access-jwt-v1`)에도 저장·복구 */
  let meissaAccess = null;
  /** 새로고침·탭 이탈 시 진행 중 fetch 취소(브라우저가 unload 를 막는 현상 완화) */
  let pilexyUnloadAbort = new AbortController();
  let pilexyPageLeaveHandled = false;
  let meissaProgressiveTimer = null;
  let meissaProgressivePhase = 0;
  let meissaProgressiveRunning = false;
  let meissa2dOverlayBlobUrl = null;
  /** @type {Map<string,string>} snapshotId -> objectURL */
  let meissa2dRawUrlBySnapshot = new Map();
  let meissa2dLoadSeq = 0;
  /** @type {number[]} */
  let meissa2dPendingTimers = [];
  let meissa2dFallbackTileCenter = { x: 894340, y: 641297 };
  let meissa2dViewScale = 1;
  let meissa2dViewTx = 0;
  let meissa2dViewTy = 0;
  /** 비교 표·2D 상단 티어 필터 공통 상태 */
  let meissaTierFilterState = { severe: true, medium: true, similar: true, other: true };
  let meissa2dLastZoomAnchorX = NaN;
  let meissa2dLastZoomAnchorY = NaN;
  let meissa2dDragging = false;
  let meissa2dDragX = 0;
  let meissa2dDragY = 0;
  let meissa2dOverlayHandlersBound = false;
  /** 심플 정사: 첫 프레임(저해상이라도) 디코드된 뒤에는 src 교체 중 complete=false 여도 팬·휠 허용 */
  let meissa2dOrthoInteractReady = false;
  let meissa2dOrthoViewportHiTimer = 0;
  let meissa2dOrthoViewportHiFetchSeq = 0;
  let meissa2dOrthoViewportHiLastKey = "";
  /** @type {{ type: string, left: number, top: number, width: number, height: number, pxScale?: number }|null} */
  let meissa2dOrthoViewportHiLayoutMeta = null;
  /** @type {Record<string, { w: number, h: number }>} 실제 full export 픽셀 — 헤더로 갱신 */
  let meissa2dOrthoFullPxBySnapshot = {};
  /** 뷰포트 crop 타일 캐시(스냅된 full rect 기준) — 팬으로 쌓인 영역은 재요청 없이 합성만 */
  const MEISSA_ORTHOPHOTO_VIEWPORT_TILE_CACHE_MAX = 96;
  /** @type {Map<string, { im: HTMLImageElement, meta: object|null }>} */
  let meissa2dOrthoViewportHiTileCache = new Map();
  /** @type {AbortController|null} */
  let meissa2dOrthoViewportHiAbort = null;
  /** full 캐시 503 연속 시 재시도 간격·횟수 제한 */
  let meissa2dOrthoViewportHi503Streak = 0;
  /** 뷰포트 crop fetch 가 진행 중이면 배지에 「불러오는 중」 표시 */
  let meissa2dOrthoViewportHiFetchInFlight = false;
  /** 메인 8192: HTTP/Image 수신 단계(배지 짧은 문구용 — natural 픽셀만으로는 %가 안 움직임) */
  let meissa2dOrthoMain8192BytesInFlight = false;
  /** 메인 8192: <img> 고해상 src 적용 후 디코드 대기 */
  let meissa2dOrthoMain8192DecodeInFlight = false;
  /** 메인 고해상 fetch 스트림 수신 바이트·총량(Content-Length, 없으면 0) */
  let meissa2dOrthoMain8192DlBytes = 0;
  let meissa2dOrthoMain8192DlTotal = 0;
  /** Image() 폴백 등 길이 미상 시 배지용 느린 진행(0~1) */
  let meissa2dOrthoMain8192DlGhostRatio = 0;
  let meissa2dOrthoMain8192ProbeGhostTimer = 0;
  /** 디코드 단계 % 애니메이션 시작 시각 */
  let meissa2dOrthoMain8192DecodeT0 = 0;
  /** 배지 재구성용(메인 8192 수신 %만 올릴 때 뷰패치 schedule 호출 안 함) */
  let meissa2dOrthoHiBadgeReplay = {
    baseText: "",
    tone: "idle",
    projectId: "",
    sid: "",
    effFullW: 0,
    effFullH: 0,
  };
  let meissa2dOrthoHiBadgeProgTimer = 0;
  /** 메인 8192 fetch 시작 시각 — 본문 바이트 전(TTFB)·blob() 폴백에서도 배지 %가 38에 고정되지 않게 */
  let meissa2dOrthoMain8192FetchStartedAt = 0;
  let meissa2dOrthoMain8192BadgeTicker = 0;
  /** 저해상만 보이는 동안 고해상 대기 — 배지 % 정체 완화용 경과 시각 */
  let meissa2dOrthoHiPendingSince = 0;
  let meissa2dOrthoHiPendingBadgeTicker = 0;
  let meissa2dRecenterTimer = null;
  let meissa2dViewSettleTimer = 0;
  let meissa2dOrthoViewportHiLocalRaf = 0;
  let meissa2dOrthoViewportHiLocalLastLogTs = 0;
  let meissa2dTileState = {
    snapshotId: "",
    projectId: "",
    z: 20,
    centerX: 894340,
    centerY: 641297,
    radius: 2,
  };
  /** @type {Map<string, HTMLImageElement>} */
  let meissa2dTileElementCache = new Map();
  /** @type {Record<string, {x:number,y:number,z:number}>} */
  let meissa2dSnapshotTileHints = {};
  /** @type {Record<string, {fx:number,fy:number,tx:number,ty:number,z:number}>} */
  let meissa2dSnapshotAnchors = {};
  let meissaProj4DefsReady = false;
  /** @type {Map<string, [number, number]>} */
  let meissa2dPointTileCache = new Map();
  let meissa2dPointTileCacheSid = "";
  let meissa2dPointsRaf = 0;
  let meissaDomOverlayRaf = 0;
  let meissaDomOverlayPointers = new Map();
  let meissaDomOverlayScale = 1;
  let meissaDomOverlayTx = 0;
  let meissaDomOverlayTy = 0;
  let meissaDomOverlayPinchLastDist = 0;
  /** @type {Map<string, string>} project:snapshot -> high-res target URL */
  let meissaDomOverlayHiUrlBySnapshot = new Map();
  /** @type {Map<string, string>} project:snapshot -> fast first URL */
  let meissaDomOverlayFastUrlBySnapshot = new Map();
  /** @type {Map<string, boolean>} project:snapshot -> high-res decoded/ready */
  let meissaDomOverlayHiReadyBySnapshot = new Map();
  /** @type {Map<string, number>} project:snapshot -> preload in flight token */
  let meissaDomOverlayHiPreloadInFlight = new Map();
  let meissaDomOverlayHiResolveInFlight = false;
  let meissaDomOverlayHiLastResolveTs = 0;
  const MEISSA_DOM_OVERLAY_HI_URL_REFRESH_MS = 7000;
  /** 실패한 URL은 잠시 재시도를 미뤄 메인 이미지로 안정 폴백한다. */
  const MEISSA_DOM_OVERLAY_BAD_URL_COOLDOWN_MS = 120000;
  /** 대체뷰 고화질 프리로드 타임아웃(ms). */
  const MEISSA_DOM_OVERLAY_HI_PRELOAD_TIMEOUT_MS = 45000;
  /**
   * true(기본): 대체뷰 <img>는 메인 정사(#meissa-cloud-2d-image-local)와 동일한 src만 사용.
   * 별도 버튼 URL 선해결·히든 Image 프리로드·강제 고화질 src 교체를 하지 않아 체감 지연을 줄인다.
   * false: 예전처럼 resolveMeissaOrthoButtonUrls 로 고선명 URL을 대체뷰에 직접 물림(느릴 수 있음).
   * 런타임 끄기: window.__MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE__ = false
   */
  const MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE = (() => {
    try {
      if (typeof window !== "undefined" && window.__MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE__ === false) {
        return false;
      }
    } catch (_) {
      /* ignore */
    }
    return true;
  })();
  /**
   * 대체뷰 orthophoto-preview 응답 포맷: png | jpeg | webp.
   * jpeg/webp 는 API `?fmt=` 로 요청(서버에서 PNG→손실 압축, 전송량 감소). png 는 기존 미러/버튼 URL 로직.
   * 끄고 PNG만: window.__MEISSA_DOM_OVERLAY_PREVIEW_FMT__ = "png"
   */
  const MEISSA_DOM_OVERLAY_PREVIEW_FMT = (() => {
    try {
      const w = typeof window !== "undefined" ? window.__MEISSA_DOM_OVERLAY_PREVIEW_FMT__ : undefined;
      if (w === "png" || w === "jpeg" || w === "webp") return w;
    } catch (_) {
      /* ignore */
    }
    return "png";
  })();
  /** 대체뷰는 고화질 단일 요청을 강제한다(초기 저화질 선표시 생략). */
  const MEISSA_DOM_OVERLAY_SINGLE_HI_EDGE = 16384;
  function meissaDomOverlayUsesLossyApiPreview() {
    if (isMeissa2dButtonUrlOnlySingleMode()) return false;
    const f = String(MEISSA_DOM_OVERLAY_PREVIEW_FMT || "png").toLowerCase();
    return f === "jpeg" || f === "webp";
  }
  /** @type {Map<string, number>} url -> retryAfterTs */
  let meissaDomOverlayBadUrlUntil = new Map();
  /** 대체뷰 orthophoto-preview 응답 헤더 로그(project:snapshot 기준). */
  let meissaDomOverlayHeaderLogBySnapshot = new Map();
  /** 중복 포맷 로그 방지용 시그니처(project:snapshot 기준). */
  let meissaDomOverlayHeaderSigBySnapshot = new Map();
  /** 동일 URL 헤더 재조회 최소 간격(ms). */
  const MEISSA_DOM_OVERLAY_HEADER_PROBE_MIN_INTERVAL_MS = 12000;
  /** 번호/좌표가 잠깐 사라지는 체감을 막기 위해 warmup 생략(항상 정밀 오버레이 렌더). */
  const MEISSA_2D_OVERLAY_WARMUP_MS = 0;
  const MEISSA_2D_OVERLAY_WARMUP_MIN_CIRCLES = 260;
  /** 확대 배율이 충분히 크면 warmup 중에도 라벨/피킹을 유지(줌인 시 좌표 미표시 체감 완화). */
  const MEISSA_2D_OVERLAY_WARMUP_LABELS_SCALE_THRESHOLD = 1.2;
  let meissa2dOverlayWarmUntil = 0;
  /** @type {Array<{x:number,y:number,r:number,circle:Record<string, unknown>,tooltip?:string,fit?:Record<string, unknown>|null}>} */
  let meissa2dPickHits = [];
  /** 말뚝 데이터셋: Ctrl+클릭으로 토글되는 circle id */
  let meissaDatasetSelectedIds = new Set();
  /** @type {HTMLCanvasElement|null} */
  let meissaDatasetCropCanvas = null;
  /** 마우스 호버로 강조할 도면 원 id (노란 링) */
  let meissa2dHoverCircleId = null;
  let meissa2dHoverRaf = 0;
  const MEISSA_2D_HOVER_SUPPRESS_MS_AFTER_ZOOM = 180;
  let meissa2dHoverSuppressUntil = 0;
  /** @type {{ x: number, y: number }|null} */
  let meissa2dPointerDownClient = null;
  let meissa2dIframeFocusHintTimer = 0;
  let meissaCloudMessageBound = false;
  /** iframe(3D) → 부모: 맞춘 도면 원 id (postMessage로만 설정) */
  /** @type {{ circleId: string, until: number }|null} */
  let meissaInboundFocus = null;
  let meissa2dDebugLastGeorefStatsTs = 0;
  /** @type {"meissa"|"file"} Meissa 정사영상 모드 vs 파일 좌표만 미리보기 */
  let meissa2dOverlayMode = "meissa";
  /** intrinsic+georef 대형 정사: 전체 이미지 캔버스 대신 뷰포트 창만 고해상 백킹(확대 시 글자·점 선명) */
  let meissa2dViewportSharpOverlayActive = false;
  /** 원본 이미지가 taint되어 getImageData 실패할 때 뷰포트 hi-canvas 픽셀을 분석용 소스로 사용 */
  let meissa2dOrthoPatchImageSource = null;
  /** taint 대비: same-origin orthophoto-preview 분석용 이미지(표시용과 분리) */
  let meissa2dOrthoAnalysisImage = null;
  let meissa2dOrthoAnalysisImageKey = "";
  let meissa2dOrthoAnalysisImageInFlight = false;
  let meissa2dOrthoAnalysisImageLastFailTs = 0;
  let meissa2dOrthoAnalysisImageFailKey = "";
  let meissa2dOrthoAnalysisImageReqSeq = 0;
  let meissa2dOrthoAnalysisPrimeSig = "";
  let meissa2dOrthoAnalysisPrimeInFlight = false;
  /** 타일 모자이크를 직사각형 뷰에 늘리지 않기 위한 정사각 뷰포트(화면 px) */
  let meissa2dMapViewport = { offX: 0, offY: 0, side: 0 };
  /** @type {Record<string, {crs:string, yMode:"xyz"|"tms"}>} */
  let meissa2dGeoConfigBySnapshot = {};
  /** @type {Record<string, {crs?:string, bbox?:{minX:number,minY:number,maxX:number,maxY:number}, width?:number, height?:number}>} */
  let meissa2dGeorefBySnapshot = {};
  /** 정사 RGB·형태(코어-링) 분석 캐시 — 정사 교체·비교 재계산 시 bump */
  let meissa2dOrthoRgbFitCacheGen = 0;
  /** @type {Map<string, { tier: string, delta?: number|null, darkestNorm?: number, ringAsym?: number }>} */
  let meissa2dOrthoRgbFitCache = new Map();
  /** @type {{ id: string, ts: number, lines: string[] }[]} */
  let meissaOrthoAnalyzeDebugTail = [];
  const MEISSA_ORTHO_ANALYZE_DEBUG_MAX = 48;
  /** ortho_pdam 오버레이 1프레임 진행률(고유 말뚝 id 기준) */
  let meissaOrthoOverlayTargets = 0;
  let meissaOrthoOverlayProcessed = 0;
  /** @type {Set<string>|null} */
  let meissaOrthoOverlayDoneIds = null;
  let meissaOrthoDebugPanelRaf = 0;
  /** 정사·시공 적합도: 캐시 미스 시 메인 스레드에서 즉시 분석하지 않고 유휴 큐로 처리 */
  const meissaOrthoPdamPrefetchQueue = [];
  const meissaOrthoPdamQueuedIds = new Set();
  let meissaOrthoPdamIdleCallbackId = 0;
  let meissaOrthoPdamOverlayFlushRaf = 0;
  function pushMeissaOrthoAnalyzeDebugEntry(entry) {
    if (!entry || !Array.isArray(entry.lines) || !entry.lines.length) return;
    meissaOrthoAnalyzeDebugTail.unshift({
      id: String(entry.id ?? ""),
      ts: Number(entry.ts) || Date.now(),
      lines: entry.lines,
    });
    if (meissaOrthoAnalyzeDebugTail.length > MEISSA_ORTHO_ANALYZE_DEBUG_MAX) {
      meissaOrthoAnalyzeDebugTail.length = MEISSA_ORTHO_ANALYZE_DEBUG_MAX;
    }
    renderMeissaOrthoAnalyzeDebugPanel();
  }

  function renderMeissaOrthoAnalyzeDebugPanel() {
    if (meissaOrthoDebugPanelRaf) return;
    meissaOrthoDebugPanelRaf = requestAnimationFrame(() => {
      meissaOrthoDebugPanelRaf = 0;
      const pre = document.getElementById("meissa-ortho-analyze-debug-text");
      if (!pre) return;
      const pct =
        meissaOrthoOverlayTargets > 0
          ? Math.round(
              (100 * Math.min(meissaOrthoOverlayProcessed, meissaOrthoOverlayTargets)) /
                Math.max(1, meissaOrthoOverlayTargets)
            )
          : 0;
      const header =
        meissaOrthoOverlayTargets > 0
          ? `〔이번 그리기〕 시공 말뚝 평가 ${meissaOrthoOverlayProcessed}/${meissaOrthoOverlayTargets} (${pct}%)\n\n`
          : "";
      if (!meissaOrthoAnalyzeDebugTail.length) {
        pre.textContent =
          header +
          "(아래 블록은 캐시 미스로 이미지 패치를 새로 분석할 때만 쌓입니다. 임계값 변경·정사 재로드로 캐시를 비운 뒤 확인하세요.)";
        return;
      }
      pre.textContent =
        header +
        meissaOrthoAnalyzeDebugTail
          .map(
            (e) =>
              `── 말뚝 id=${e.id} · ${new Date(e.ts).toLocaleString()} ──\n${e.lines.join("\n")}`
          )
          .join("\n\n");
    });
  }
  /** @type {HTMLCanvasElement|null} */
  let meissa2dOrthoPatchCanvas = null;
  /** false: 2D와 3D를 함께 로드(기본). true로 두면 2D만 우선. */
  const MEISSA_2D_PRIORITY_MODE = true;
  /** false: 상단 iframe을 Meissa /3d 뷰어로 연다(기본). true면 스냅샷(2D) URL만 사용. */
  const MEISSA_3D_EXCLUDED = true;
  /** false: 공식 Meissa 화면을 페이지 안 iframe에 띄우지 않고 새 탭 링크만 맞춤(임베드 3D·로그인 뷰 제거). */
  const MEISSA_CLOUD_3D_FRAME_VISIBLE = true;
  /** true: 심플 2D 모드 활성화(대체뷰·정사 이미지 중심). */
  const MEISSA_2D_SIMPLE_ORTHO = true;
  /** true: 심플 모드에서도 타일(피라미드) 우선으로 즉시 표시해 초기 체감속도를 높인다. */
  const MEISSA_2D_SIMPLE_TILE_FIRST_MODE = true;
  /** true: orthophoto-preview 를 max_edge=저해상(3072) 단일만 사용(속도 우선).
   * false(기본): 3072 선표시 뒤 8192로 교체(이중 요청 순차). */
  const MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES = false;
  /** true: 저해상 선표시 없이 고화질(max_edge=8192) 단일 1회만 요청. */
  const MEISSA_ORTHOPHOTO_SINGLE_HIGH_ONLY = true;
  /**
   * true: 정사 로딩을 단일 경로로 고정.
   * Carta 버튼 URL PNG 소스를 서버에서 받아 webp로 변환/캐시한 API만 사용한다.
   */
  const MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP = false;
  const MEISSA_ORTHOPHOTO_UNIFIED_FMT = "webp";
  const MEISSA_ORTHOPHOTO_UNIFIED_EDGE = 16384;
  /** true: 단일 모드에서 orthophoto-preview/API 폴백 없이 "다운로드 버튼 URL"만 사용. */
  const MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY = true;
  /** true면 <img src> 직접 경로 사용, false면 API fetch→blob 경로만 사용(안정 우선). */
  const MEISSA_ORTHOPHOTO_DIRECT_IMG_STREAM = true;
  /** 예전처럼 Authorization(JWT) + project_id만으로 orthophoto-preview 호출(서버 기본 캐시/사이징 경로 우선). */
  const MEISSA_ORTHOPHOTO_USE_LEGACY_API_URL = true;
  /** 저해상 PNG 고정 모드(max_edge). */
  const MEISSA_ORTHOPHOTO_LEGACY_LOW_EDGE = 3072;
  /** 정사 preview 대기 상한(ms) — 지연 시 빠르게 RAW/JSON 폴백으로 넘어가 체감 정지를 줄인다. */
  const MEISSA_ORTHOPHOTO_PREVIEW_FETCH_MS = 18000;
  /** 버튼 URL 단일 모드: 한 URL 다운로드/디코드 최대 대기(ms). 초과 시 멈춤 대신 실패로 전환. */
  const MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_LOAD_TIMEOUT_MS = 95000;
  /** 버튼 URL 단일 모드: 죽은 URL 선별용 짧은 도달성 점검(ms). */
  const MEISSA_ORTHOPHOTO_BUTTON_URL_PROBE_MS = 1300;
  /** 버튼 URL 단일 모드: 실패 시 후보 재시도 최대 횟수(속도·안정 절충). */
  const MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_MAX_TRIES = 3;
  /** true: 정사·시공 적합도에서 RGB/형태 분석 실패를 planD(평면)로 초록 승격하지 않고 미판정으로 유지 */
  const MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS = true;
  /**
   * false(기본): 확대 시 뷰포트 고해상 crop 패치를 사용해 줌 블러를 줄인다.
   * 강제로 끄려면 로드 전에 window.__MEISSA_ORTHO_DISABLE_VIEWPORT_HI__ = true
   */
  const MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI = true;
  /** PDAM 대시보드 POST — 무제한 대기 시 비교 UI가 멈춘 것처럼 보임 */
  const MEISSA_DASHBOARD_FETCH_MS = 180000;
  /** nearest-z 단건 — 한 건이 무한 대기면 전체 워커가 진행 불가 */
  const MEISSA_NEAREST_Z_FETCH_MS = 120000;

  /** 심플 정사: 최초 수신 전에만 휠/드래그 차단. 고해상으로 src 바꿀 때 complete 가 오래 false 라 멈춘 것처럼 보이던 문제 방지 */
  function isMeissa2dOrthoImageStillDecoding() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return false;
    if (meissa2dOrthoInteractReady) return false;
    const img = els.meissaCloud2dImageLocal;
    if (!img) return false;
    const src = img.getAttribute("src");
    if (!src || String(src).trim() === "") return false;
    return !img.complete || img.naturalWidth <= 1 || img.naturalHeight <= 1;
  }
  /** 2D CSS 확대 상한(배율). 타일 모자이크 한계 구간은 MEISSA_2D_ZOOM_MOSAIC_CSS_MAX */
  const MEISSA_2D_ZOOM_MAX_SCALE = 28;
  const MEISSA_2D_ZOOM_MIN_SCALE = 0.22;
  const MEISSA_2D_ZOOM_MOSAIC_CSS_MAX = 5.5;
  /** 정사 letterbox 대비 점 매핑 엄격 클리핑 여유(px). ±2만 쓰면 저해상·부동소수에서 점이 전부 탈락할 수 있음 */
  const MEISSA_2D_IMG_EDGE_MARGIN_CSS = 20;
  /** georef 매핑이 경계에서 과도하게 탈락할 때 사용할 느슨 클리핑 여유(px). */
  const MEISSA_2D_IMG_EDGE_MARGIN_CSS_RELAXED = 220;
  /** false: 스냅샷 선택 시 Meissa 점군 API·누적 로더를 돌리지 않음(정사·2D 점만). 수동 디버그 버튼은 예외. */
  const MEISSA_POINT_CLOUD_AUTOLOAD = false;
  /** Carta/Meissa 타일 z 범위 — 모자이크 휠 줌은 정수 z만 바꾸고 CSS scale은 1로 둔다(구글맵식 격자 정합). */
  const MEISSA_MOSAIC_TILE_Z_MIN = 18;
  const MEISSA_MOSAIC_TILE_Z_MAX = 23;
  const MEISSA_TILE_HINTS_KEY = "pilexy-meissa-tile-hints-v1";

  function isMeissa2dButtonUrlOnlySingleMode() {
    return Boolean(
      MEISSA_2D_SIMPLE_ORTHO &&
        MEISSA_ORTHOPHOTO_SINGLE_HIGH_ONLY &&
        MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY &&
        !MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP
    );
  }
  /** Meissa API JWT — 새로고침·재방문 시 iframe·목록 API 자동 복원(공유 PC에서는 브라우저 로그아웃으로 삭제). */
  const MEISSA_JWT_STORAGE_KEY = "pilexy-meissa-access-jwt-v1";
  /** iframe 에 마지막으로 연 cloud.meissa.ai 경로(쿼리 제외) — 아래에서만 로그인한 경우 쿠키와 함께 재진입 완화. */
  const MEISSA_LAST_CLOUD_PATH_KEY = "pilexy-meissa-last-cloud-path-v1";
  const DEFAULT_FOCUS_TO_TILE_DX = 19190;
  const DEFAULT_FOCUS_TO_TILE_DY = -354790;

  /** Meissa 웹에 입력한 X·Y와 비교점(오프셋 반영 후) 평면거리가 이 값(m) 이내인 1행에만 UI Z를 씀 */

  const MEISSA_CLOUD_ORIGIN = "https://cloud.meissa.ai";
  const MEISSA_CLOUD_LOGIN_URL = `${MEISSA_CLOUD_ORIGIN}/login`;
  const MEISSA_TOKEN_QUERY_KEYS = ["token", "access_token", "accessToken"];

  function cellText(v) {
    if (v == null) return "";
    return String(v).trim();
  }

  /** @param {string} value */
  function normalizePileNumber(value) {
    let text = cellText(value);
    if (!text) return "";
    text = text.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+/g, "-");
    const numTry = parseFloat(text.replace(/,/g, ""));
    if (!Number.isNaN(numTry) && Number.isFinite(numTry)) {
      const r = Math.round(numTry);
      if (Math.abs(numTry - r) < 1e-6) return String(r);
    }
    let compact = text.replace(/\s+/g, "").toUpperCase();
    let m = compact.match(/^\d+\.-(\d+)$/);
    if (m) return String(parseInt(m[1], 10));
    m = compact.match(/^([A-Z]?\d+)--(\d+)$/);
    if (m) return `${m[1]}-${m[2]}`;
    return compact;
  }

  /**
   * CSV 없이 비교할 때: 도면 원 + 매칭된 말뚝 TEXT 기준 점 목록.
   * @param {Array<Record<string, unknown>>} circles
   * @returns {Array<{ pileRaw: string, pileNorm: string, x: number, y: number, z: number|null, circleId: unknown }>}
   */
  function buildComparePointsFromCircles(circles) {
    const pts = [];
    (circles || []).forEach((c) => {
      const pileRaw = c.matched_text?.text;
      if (pileRaw == null || String(pileRaw).trim() === "") return;
      const pileNorm = normalizePileNumber(String(pileRaw));
      if (!pileNorm) return;
      const x = Number(c.center_x);
      const y = Number(c.center_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const z =
        c.center_z != null && Number.isFinite(Number(c.center_z)) ? Number(c.center_z) : null;
      pts.push({
        pileRaw: String(pileRaw).trim(),
        pileNorm,
        x,
        y,
        z,
        circleId: c.id != null ? c.id : null,
      });
    });
    return pts;
  }

  function parseNumber(v) {
    if (v == null) return NaN;
    const s = String(v).replace(/,/g, "").trim();
    if (!s) return NaN;
    return parseFloat(s);
  }

  function median(nums) {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function terrainProxyZ(points, idx, radius) {
    const p = points[idx];
    const zs = [];
    for (let j = 0; j < points.length; j++) {
      if (j === idx) continue;
      const q = points[j];
      if (q.z == null) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= radius && d > 0.001) zs.push(q.z);
    }
    return median(zs);
  }

  function setStatus(el, text, isErr) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("meissa-status--err", Boolean(isErr));
  }

  function detailToMessage(data, fallback) {
    const d = data && data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const parts = d
        .map((x) => (typeof x === "string" ? x : x?.msg || x?.message || ""))
        .filter(Boolean);
      return parts.length ? parts.join("; ") : fallback;
    }
    return fallback;
  }

  /** Cloudflare 5xx: 브라우저·CF는 정상인데 원본(pilexy) 연결이 끊긴 경우 */
  function httpCloudflareOriginErrorMessage(status) {
    const s = Number(status);
    if (s === 520) {
      return "HTTP 520: Cloudflare는 정상이나 원본 서버(pilexy)가 빈 응답·비정상 종료·타임아웃으로 응답했습니다. 백엔드/프록시 로그·CF SSL 모드·origin 타임아웃을 확인하세요. 잠시 후 재시도하세요.";
    }
    if (s === 521) return "HTTP 521: 원본 서버가 꺼져 있거나 거부했습니다.";
    if (s === 522 || s === 523 || s === 524) {
      return `HTTP ${s}: Cloudflare와 원본 사이 연결 시간 초과입니다. 원본 부하·네트워크를 확인하세요.`;
    }
    return "";
  }

  /**
   * @param {HTMLSelectElement|null} el
   * @param {Array<Record<string, unknown>>} items
   * @param {string} placeholder
   * @param {(item: Record<string, unknown>) => string} [labelFn]
   */
  function setMeissaSelect(el, items, placeholder, labelFn) {
    if (!el) return;
    const cur = el.value;
    el.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    el.appendChild(opt0);
    (items || []).forEach((item) => {
      const o = document.createElement("option");
      const v = item.id;
      o.value = v != null ? String(v) : "";
      o.textContent = labelFn ? labelFn(item) : String(item.name ?? v ?? "");
      if (item.dateHint) o.dataset.dateHint = String(item.dateHint);
      el.appendChild(o);
    });
    if (cur && [...el.options].some((x) => x.value === cur)) el.value = cur;
  }

  /** @param {string|unknown} v */
  function parseIsoDate(v) {
    const s = String(v ?? "")
      .trim()
      .slice(0, 10)
      .replace(/\//g, "-");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
  }

  function isoToUtcNoonMs(iso) {
    return new Date(`${iso}T12:00:00Z`).getTime();
  }

  /**
   * PDAM 목록 값 중 target(촬영일) 이하(당일 포함)에서 가장 가까운 날의 option value.
   * 없으면 목록 전체에서 달력상 가장 가까운 날.
   * @param {string} targetIso
   * @param {Array<{ raw: string, iso: string }>} entries
   */
  function pickPdamRawValueOnOrBefore(targetIso, entries) {
    const target = parseIsoDate(targetIso);
    if (!target || !entries.length) return null;
    const byIso = new Map();
    entries.forEach((e) => {
      if (!byIso.has(e.iso)) byIso.set(e.iso, e.raw);
    });
    const sorted = [...byIso.keys()].sort();
    let bestIso = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] <= target) {
        bestIso = sorted[i];
        break;
      }
    }
    if (bestIso) return byIso.get(bestIso) || null;
    let closest = sorted[0];
    let minAbs = Math.abs(isoToUtcNoonMs(sorted[0]) - isoToUtcNoonMs(target));
    for (const iso of sorted) {
      const diff = Math.abs(isoToUtcNoonMs(iso) - isoToUtcNoonMs(target));
      if (diff < minAbs) {
        minAbs = diff;
        closest = iso;
      }
    }
    return byIso.get(closest) || null;
  }

  function getPdamPresetEntries() {
    const sel = els.datePreset;
    if (!sel) return [];
    const out = [];
    for (let i = 0; i < sel.options.length; i++) {
      const o = sel.options[i];
      const raw = (o.value || "").trim();
      if (!raw) continue;
      const iso = parseIsoDate(raw);
      if (iso) out.push({ raw, iso });
    }
    return out;
  }

  /** @param {string|undefined|null} iso */
  function formatDateKoFromIso(iso) {
    const s = iso != null ? String(iso).trim() : "";
    if (s.length < 10) return "날짜 미상";
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(5, 7), 10);
    const d = parseInt(s.slice(8, 10), 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "날짜 미상";
    return `${y}년 ${m}월 ${d}일`;
  }

  /** 제목/메모에 포함된 날짜(드론 스냅샷명 등)에서 YYYY-MM-DD 추출 */
  function extractIsoDateFromText(text) {
    if (text == null || typeof text !== "string") return "";
    const ko = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (ko) {
      const m = ko[2].padStart(2, "0");
      const d = ko[3].padStart(2, "0");
      return `${ko[1]}-${m}-${d}`;
    }
    const dash = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (dash) {
      const m = dash[2].padStart(2, "0");
      const d = dash[3].padStart(2, "0");
      return `${dash[1]}-${m}-${d}`;
    }
    return "";
  }

  /** PDAM dateTo 연동용 YYYY-MM-DD (백엔드 dateHint → sortKey → 제목/부제 텍스트). */
  function effectiveSnapshotDateIso(s) {
    const h = s.dateHint;
    if (h != null && String(h).trim().length >= 10) {
      return String(h).trim().slice(0, 10).replace(/\//g, "-");
    }
    const sk = s.sortKey;
    if (sk != null) {
      const t = String(sk).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
      if (/^\d{4}\/\d{2}\/\d{2}/.test(t)) return t.slice(0, 10).replace(/\//g, "-");
      const fromSk = extractIsoDateFromText(t);
      if (fromSk) return fromSk;
    }
    const fromName = extractIsoDateFromText(s.name != null ? String(s.name) : "");
    if (fromName) return fromName;
    const fromSub = extractIsoDateFromText(s.subtitle != null ? String(s.subtitle) : "");
    if (fromSub) return fromSub;
    return "";
  }

  /** 목록에는 날짜만 보이게. 같은 날 여러 건이면 시각 또는 ID로만 구분. */
  function humanSnapshotListLabel(s, sameDayCount) {
    const iso = effectiveSnapshotDateIso(s);
    const dateKo =
      (s.dateLabelKo != null && String(s.dateLabelKo).trim()) ||
      (iso ? formatDateKoFromIso(iso) : "날짜 미상");
    if (sameDayCount <= 1) return dateKo;
    const th = s.timeHint != null && String(s.timeHint).trim();
    if (th) return `${dateKo} · ${th}`;
    return `${dateKo} · #${s.id}`;
  }

  /** 년·월은 앞 칸에서 고르므로 일 칸에는 일(동일일 다건이면 시각·id)만 표시 */
  function humanSnapshotDayColumnLabel(s, sameDayCount) {
    const dayFromIsoStr = (raw) => {
      const iso = parseIsoDate(raw);
      if (!iso) return null;
      const d = parseInt(iso.slice(8, 10), 10);
      return Number.isFinite(d) ? d : null;
    };
    let dNum = dayFromIsoStr(effectiveSnapshotDateIso(s));
    if (dNum == null && s.dateLabelKo != null && String(s.dateLabelKo).trim()) {
      dNum = dayFromIsoStr(extractIsoDateFromText(String(s.dateLabelKo).trim()));
    }
    if (dNum == null) {
      dNum = dayFromIsoStr(extractIsoDateFromText(s.name != null ? String(s.name) : ""));
    }
    if (dNum == null) {
      dNum = dayFromIsoStr(extractIsoDateFromText(s.subtitle != null ? String(s.subtitle) : ""));
    }
    if (dNum != null) {
      const base = `${dNum}일`;
      if (sameDayCount <= 1) return base;
      const th = s.timeHint != null && String(s.timeHint).trim();
      if (th) return `${base} · ${th}`;
      return `${base} · #${s.id}`;
    }
    const nm = s.name != null && String(s.name).trim();
    if (nm) return nm.length > 28 ? `${nm.slice(0, 28)}…` : nm;
    return `미상 · #${s.id}`;
  }

  function appendSnapshotOption(parent, s, sameDayCount) {
    const o = document.createElement("option");
    o.value = String(s.id);
    o.textContent = humanSnapshotListLabel(s, sameDayCount);
    const iso = effectiveSnapshotDateIso(s);
    if (iso) o.dataset.dateHint = iso;
    if (s.dateLabelKo) o.dataset.dateLabelKo = String(s.dateLabelKo);
    const nm = s.name != null && String(s.name).trim() ? String(s.name).trim() : `스냅샷 ${s.id}`;
    o.dataset.snapshotTitle = nm;
    if (s.subtitle) o.dataset.subtitle = String(s.subtitle);
    parent.appendChild(o);
  }

  function appendSnapshotDayColumnOption(parent, s, sameDayCount) {
    const o = document.createElement("option");
    o.value = String(s.id);
    o.textContent = humanSnapshotDayColumnLabel(s, sameDayCount);
    const iso = effectiveSnapshotDateIso(s);
    if (iso) o.dataset.dateHint = iso;
    if (s.dateLabelKo) o.dataset.dateLabelKo = String(s.dateLabelKo);
    const nm = s.name != null && String(s.name).trim() ? String(s.name).trim() : `스냅샷 ${s.id}`;
    o.dataset.snapshotTitle = nm;
    if (s.subtitle) o.dataset.subtitle = String(s.subtitle);
    parent.appendChild(o);
  }

  /** 프로젝트·존 변경 시 년·월·일 UI 초기화 */
  function resetMeissaSnapshotUi(placeholder) {
    const ph = placeholder || "—";
    const y = els.meissaSnapshotYear;
    const m = els.meissaSnapshotMonth;
    const s = els.meissaSnapshotSelect;
    meissaCascadeUpdating = true;
    [y, m].forEach((el) => {
      if (!el) return;
      el.innerHTML = "";
      const o = document.createElement("option");
      o.value = "";
      o.textContent = ph;
      el.appendChild(o);
      el.disabled = true;
    });
    if (s) {
      s.innerHTML = "";
      const o = document.createElement("option");
      o.value = "";
      o.textContent = ph;
      s.appendChild(o);
      s.disabled = true;
    }
    meissaCascadeUpdating = false;
    updateMeissaSnapshotPreview();
  }

  /**
   * @param {string|undefined|null} explicitPreferred — 스냅샷 id면 복원용으로 년·월·일까지 맞춤. undefined 이면 셀렉트 값만 반영. null 이면 년·월 변경으로 간주(자동 선택 없음)
   * @param {{ suppressDispatch?: boolean }} [opts]
   */
  function rebuildMeissaSnapshotSelect(explicitPreferred, opts) {
    opts = opts || {};
    const suppressDispatch = Boolean(opts.suppressDispatch);
    const yEl = els.meissaSnapshotYear;
    const mEl = els.meissaSnapshotMonth;
    const snapEl = els.meissaSnapshotSelect;
    if (!snapEl) return;

    const hasCascade = Boolean(yEl && mEl);
    const domY = hasCascade ? (yEl.value || "").trim() : "";
    const domM = hasCascade ? (mEl.value || "").trim() : "";

    let preferred = "";
    if (explicitPreferred === undefined) {
      preferred = (snapEl.value || "").trim();
    } else if (explicitPreferred != null && String(explicitPreferred).trim()) {
      preferred = String(explicitPreferred).trim();
    }

    const snaps = state.meissaSnapshots || [];
    const prevSid = (snapEl.value || "").trim();

    if (!hasCascade) {
      snapEl.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = snaps.length ? "날짜 선택" : "존 선택";
      snapEl.appendChild(opt0);
      const sorted = [...snaps].sort((a, b) =>
        String(b.sortKey ?? "").localeCompare(String(a.sortKey ?? ""))
      );
      const byIso = new Map();
      sorted.forEach((s) => {
        const iso = effectiveSnapshotDateIso(s) || "__none__";
        if (!byIso.has(iso)) byIso.set(iso, []);
        byIso.get(iso).push(s);
      });
      const entries = [...byIso.entries()];
      entries.sort((a, b) => {
        const ia = a[0];
        const ib = b[0];
        if (ia === "__none__") return 1;
        if (ib === "__none__") return -1;
        return ib.localeCompare(ia);
      });
      entries.forEach(([iso, items]) => {
        const dateKo =
          iso !== "__none__"
            ? (items[0].dateLabelKo != null && String(items[0].dateLabelKo).trim()
                ? String(items[0].dateLabelKo).trim()
                : formatDateKoFromIso(iso))
            : "날짜 미상";
        const og = document.createElement("optgroup");
        og.label = dateKo;
        snapEl.appendChild(og);
        const n = items.length;
        items.forEach((s) => appendSnapshotOption(og, s, n));
      });
      const cur = preferred || prevSid;
      if (cur && [...snapEl.querySelectorAll("option")].some((x) => x.value === cur)) snapEl.value = cur;
      updateMeissaSnapshotPreview();
      syncMeissa3dEmbed();
      const nextSid = (snapEl.value || "").trim();
      if (!suppressDispatch && nextSid !== prevSid) {
        snapEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    meissaCascadeUpdating = true;

    const dated = [];
    const undated = [];
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      const iso = parseIsoDate(effectiveSnapshotDateIso(s));
      if (iso) dated.push({ snap: s, iso });
      else undated.push(s);
    }

    const yearSet = new Set(dated.map((x) => x.iso.slice(0, 4)));
    const years = [...yearSet].sort((a, b) => b.localeCompare(a));
    if (undated.length) years.push(MEISSA_SNAPSHOT_NODATE_YEAR);

    yEl.innerHTML = "";
    const yPh = document.createElement("option");
    yPh.value = "";
    yPh.textContent = snaps.length ? "년도" : "존 선택";
    yEl.appendChild(yPh);
    years.forEach((yv) => {
      const o = document.createElement("option");
      o.value = yv;
      o.textContent = yv === MEISSA_SNAPSHOT_NODATE_YEAR ? "날짜 미상" : `${yv}년`;
      yEl.appendChild(o);
    });

    let selY = "";
    if (preferred) {
      const ps = snaps.find((x) => String(x.id) === preferred);
      if (ps) {
        const piso = parseIsoDate(effectiveSnapshotDateIso(ps));
        if (piso) selY = piso.slice(0, 4);
        else if (undated.some((u) => String(u.id) === preferred)) selY = MEISSA_SNAPSHOT_NODATE_YEAR;
      }
    }
    if (!selY && domY && (years.includes(domY) || domY === MEISSA_SNAPSHOT_NODATE_YEAR)) selY = domY;
    yEl.value = selY || "";

    const monthVals = [];
    mEl.innerHTML = "";
    const mPh = document.createElement("option");
    mPh.value = "";
    mPh.textContent = !selY || selY === MEISSA_SNAPSHOT_NODATE_YEAR ? "—" : "월";
    mEl.appendChild(mPh);
    if (selY && selY !== MEISSA_SNAPSHOT_NODATE_YEAR) {
      const mset = new Set(dated.filter((x) => x.iso.startsWith(selY)).map((x) => x.iso.slice(5, 7)));
      monthVals.push(...[...mset].sort((a, b) => b.localeCompare(a)));
      monthVals.forEach((mo) => {
        const o = document.createElement("option");
        o.value = mo;
        o.textContent = `${parseInt(mo, 10)}월`;
        mEl.appendChild(o);
      });
    }

    let selM = "";
    if (preferred && selY && selY !== MEISSA_SNAPSHOT_NODATE_YEAR) {
      const ps = snaps.find((x) => String(x.id) === preferred);
      const piso = ps ? parseIsoDate(effectiveSnapshotDateIso(ps)) : null;
      if (piso && piso.startsWith(selY)) selM = piso.slice(5, 7);
    }
    if (!selM && monthVals.includes(domM)) selM = domM;
    mEl.value = selM || "";

    let candidates = [];
    if (selY === MEISSA_SNAPSHOT_NODATE_YEAR) {
      candidates = undated.slice();
    } else if (selY && selM) {
      const prefix = `${selY}-${selM}`;
      candidates = dated.filter((x) => x.iso.startsWith(prefix)).map((x) => x.snap);
    }
    candidates.sort((a, b) => String(b.sortKey ?? "").localeCompare(String(a.sortKey ?? "")));

    const isoToCount = new Map();
    for (let ci = 0; ci < candidates.length; ci++) {
      const s0 = candidates[ci];
      const i0 = parseIsoDate(effectiveSnapshotDateIso(s0)) || "__nodate__";
      isoToCount.set(i0, (isoToCount.get(i0) || 0) + 1);
    }

    snapEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    let phSnap = "존 선택";
    if (snaps.length === 0) phSnap = "존 선택";
    else if (!selY) phSnap = "년도 선택";
    else if (selY === MEISSA_SNAPSHOT_NODATE_YEAR && !candidates.length) phSnap = "없음";
    else if (selY === MEISSA_SNAPSHOT_NODATE_YEAR) phSnap = "일 선택";
    else if (!selM) phSnap = "월 선택";
    else if (!candidates.length) phSnap = "해당 월 없음";
    else phSnap = "일 선택";
    opt0.textContent = phSnap;
    snapEl.appendChild(opt0);

    for (let i = 0; i < candidates.length; i++) {
      const s0 = candidates[i];
      const ik = parseIsoDate(effectiveSnapshotDateIso(s0)) || "__nodate__";
      appendSnapshotDayColumnOption(snapEl, s0, isoToCount.get(ik) || 1);
    }

    yEl.disabled = snaps.length === 0;
    mEl.disabled = !selY || selY === MEISSA_SNAPSHOT_NODATE_YEAR || !monthVals.length;
    snapEl.disabled =
      snaps.length === 0 ||
      !selY ||
      (selY === MEISSA_SNAPSHOT_NODATE_YEAR && !candidates.length) ||
      (selY !== MEISSA_SNAPSHOT_NODATE_YEAR && !selM) ||
      !candidates.length;

    let pick = "";
    if (preferred && candidates.some((c) => String(c.id) === preferred)) pick = preferred;
    snapEl.value = pick;

    meissaCascadeUpdating = false;

    updateMeissaSnapshotPreview();
    syncMeissa3dEmbed();

    const nextSid = (snapEl.value || "").trim();
    if (!suppressDispatch && nextSid !== prevSid) {
      snapEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function updateMeissaSnapshotPreview() {
    const wrap = els.meissaSnapshotPreview;
    if (!wrap) return;
    const sid = (els.meissaSnapshotSelect?.value || "").trim();
    if (!sid) {
      wrap.hidden = true;
      return;
    }
    const snap = (state.meissaSnapshots || []).find((x) => String(x.id) === sid);
    if (!snap) {
      wrap.hidden = true;
      return;
    }
    const iso = effectiveSnapshotDateIso(snap);
    const dateLine =
      (snap.dateLabelKo != null && String(snap.dateLabelKo).trim()) ||
      (iso ? formatDateKoFromIso(iso) : "날짜 없음");
    const titleLine =
      snap.name != null && String(snap.name).trim() ? String(snap.name).trim() : `스냅샷 ${snap.id}`;
    if (els.meissaSnapshotPreviewDate) els.meissaSnapshotPreviewDate.textContent = dateLine;
    if (els.meissaSnapshotPreviewTitle) els.meissaSnapshotPreviewTitle.textContent = titleLine;
    const sub = snap.subtitle != null && String(snap.subtitle).trim() ? String(snap.subtitle).trim() : "";
    if (els.meissaSnapshotPreviewSub) {
      els.meissaSnapshotPreviewSub.textContent = sub;
      els.meissaSnapshotPreviewSub.hidden = !sub;
    }
    wrap.hidden = false;
  }

  function pilexyFetchSignal(extra) {
    const base = pilexyUnloadAbort.signal;
    if (!extra) return base;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
      try {
        return AbortSignal.any([base, extra]);
      } catch (_) {
        /* 일부 환경에서 any() 가 TypeError — 수동 병합으로 폴백 */
      }
    }
    const c = new AbortController();
    const down = () => {
      try {
        c.abort();
      } catch (_) {
        /* ignore */
      }
    };
    if (base.aborted || extra.aborted) down();
    else {
      base.addEventListener("abort", down, { once: true });
      extra.addEventListener("abort", down, { once: true });
    }
    return c.signal;
  }

  /** @param {number} status */
  function meissaHttpError(message, status) {
    const err = new Error(message);
    err.pilexyHttpStatus = status;
    return err;
  }

  async function meissaParseJsonResponse(res) {
    let data = {};
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      data = await res.json().catch(() => ({}));
    } else {
      const raw = await res.text().catch(() => "");
      if (raw && raw.trim().startsWith("{")) {
        try {
          data = JSON.parse(raw);
        } catch (_) {
          /* ignore */
        }
      }
    }
    if (!res.ok) {
      const cfMsg = httpCloudflareOriginErrorMessage(res.status);
      if (cfMsg) throw meissaHttpError(cfMsg, res.status);
      let fb = res.statusText || "요청 실패";
      if (res.status === 502 || res.status === 503) {
        fb =
          "백엔드(또는 프록시) 오류 502/503입니다. PileXY 백엔드가 실행 중인지, 서버에서 pip install pycryptodome 후 재시작했는지 확인하세요.";
      }
      throw meissaHttpError(detailToMessage(data, fb), res.status);
    }
    return data;
  }

  async function meissaJson(path, init) {
    init = init || {};
    const headers = { Accept: "application/json", ...(init.headers || {}) };
    const signal = pilexyFetchSignal(init.signal);
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal });
    return meissaParseJsonResponse(res);
  }

  function normalizeMeissaAccessToken(raw) {
    let t = String(raw || "").trim();
    if (!t) return "";
    if (/^jwt\s+/i.test(t)) t = t.replace(/^jwt\s+/i, "").trim();
    if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, "").trim();
    return t;
  }

  function looksLikeMeissaJwt(token) {
    const t = String(token || "").trim();
    if (t.length < 32) return false;
    const parts = t.split(".");
    if (parts.length !== 3) return false;
    return parts.every((p) => p.length > 1);
  }

  /** JWT payload `exp`(초) → 만료 시각(ms). 파싱 실패·exp 없음 → null */
  function meissaJwtExpiryMs(token) {
    const parts = String(token || "").trim().split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    let payload;
    try {
      payload = JSON.parse(atob(b64));
    } catch (_) {
      return null;
    }
    const exp = payload && payload.exp;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
    return exp * 1000;
  }

  function saveMeissaAccessToStorage(token) {
    const t = normalizeMeissaAccessToken(token);
    if (!t || !looksLikeMeissaJwt(t)) return;
    try {
      localStorage.setItem(MEISSA_JWT_STORAGE_KEY, t);
    } catch (_) {
      /* quota / private mode */
    }
  }

  function clearMeissaAccessFromStorage() {
    try {
      localStorage.removeItem(MEISSA_JWT_STORAGE_KEY);
    } catch (_) {}
  }

  function tryRestoreMeissaJwtFromStorage() {
    let raw = "";
    try {
      raw = localStorage.getItem(MEISSA_JWT_STORAGE_KEY) || "";
    } catch (_) {
      return false;
    }
    const t = normalizeMeissaAccessToken(raw);
    if (!t || !looksLikeMeissaJwt(t)) {
      clearMeissaAccessFromStorage();
      return false;
    }
    const expMs = meissaJwtExpiryMs(t);
    if (expMs != null && Date.now() >= expMs - 30_000) {
      clearMeissaAccessFromStorage();
      return false;
    }
    meissaAccess = t;
    return true;
  }

  /** cloud.meissa.ai URL 중 pathname 만 저장(토큰·쿼리 미저장). */
  function rememberMeissaCloudEmbedPath(urlStr) {
    try {
      const u = new URL(String(urlStr || ""), MEISSA_CLOUD_ORIGIN);
      if (u.origin !== MEISSA_CLOUD_ORIGIN) return;
      const path = u.pathname || "";
      if (!path || path === "/" || path === "/login") return;
      localStorage.setItem(MEISSA_LAST_CLOUD_PATH_KEY, path.slice(0, 700));
    } catch (_) {}
  }

  function getRememberedMeissaCloudPath() {
    try {
      const p = localStorage.getItem(MEISSA_LAST_CLOUD_PATH_KEY);
      if (!p || !p.startsWith("/") || p.startsWith("//")) return "";
      return p.slice(0, 700);
    } catch (_) {
      return "";
    }
  }

  /** Meissa 웹 프로젝트 카드와 동일: 이름 + 현장 개수(processedSnapshotCount) + 최근 촬영일 */
  function formatMeissaProjectOption(p) {
    const name =
      p.name != null && String(p.name).trim() ? String(p.name).trim() : `프로젝트 ${p.id}`;
    const cnt = p.snapshotCount;
    const hasCnt = cnt != null && cnt !== "" && !Number.isNaN(Number(cnt));
    const dateRaw = p.latestTakeDate;
    const date =
      dateRaw != null && String(dateRaw).trim() ? String(dateRaw).trim().slice(0, 10) : "";
    if (hasCnt) {
      const line = `현장 개수: ${cnt}`;
      if (date) return `${name} — ${line}, 최근 촬영 ${date}`;
      return `${name} — ${line}`;
    }
    return `${name} (${p.id})`;
  }

  /**
   * @param {string} statusPrefix 예: 로그인 완료
   * @param {{ clearHiddenIds?: boolean }} [opts] clearHiddenIds=false 이면 URL·숨김 필드에 있던 프로젝트·존·스냅샷 id 유지(복원 시).
   */
  async function populateMeissaProjectListFromAccess(statusPrefix, opts) {
    const clearHiddenIds = opts?.clearHiddenIds !== false;
    if (!meissaAccess) throw new Error("액세스 토큰이 없습니다.");
    const proj = await meissaJson("/api/meissa/projects", {
      headers: { Authorization: `JWT ${meissaAccess}` },
    });
    const projects = Array.isArray(proj.projects) ? proj.projects : [];
    setMeissaSelect(
      els.meissaProjectSelect,
      projects,
      projects.length ? "프로젝트 선택" : "프로젝트 없음",
      (p) => formatMeissaProjectOption(p)
    );
    setMeissaSelect(els.meissaZoneSelect, [], "프로젝트를 선택하세요");
    state.meissaSnapshots = [];
    resetMeissaSnapshotUi("존을 선택하세요");
    if (clearHiddenIds) {
      if (els.zoneId) els.zoneId.value = "";
      if (els.snapshotId) els.snapshotId.value = "";
      if (els.projectId) els.projectId.value = "";
    }
    syncMeissa3dEmbed();
    setStatus(
      els.meissaApiStatus,
      `${statusPrefix} · 프로젝트 ${projects.length}건. 3D는 로그인 토큰으로 자동 연결됩니다. 흰 화면이면 「새 탭에서 선택 3D 열기」 또는 cloud.meissa.ai 웹 로그인 후 새로고침하세요.`
    );
  }

  /** 숨김 필드(projectId·zoneId·snapshotId) 값이 있으면 셀렉트·하위 목록까지 맞춤. */
  async function applyMeissaHiddenIdsToCascade() {
    const hp = (els.projectId?.value || "").trim();
    if (!hp || !meissaAccess) return;
    const sel = els.meissaProjectSelect;
    if (!sel || ![...sel.options].some((o) => o.value === hp)) return;
    sel.value = hp;
    try {
      await loadMeissaZones(hp);
    } catch (_) {
      return;
    }
    const hz = (els.zoneId?.value || "").trim();
    if (!hz || !els.meissaZoneSelect || ![...els.meissaZoneSelect.options].some((o) => o.value === hz)) {
      syncMeissa3dEmbed({ skip2dLoad: true });
      return;
    }
    els.meissaZoneSelect.value = hz;
    try {
      const hs = (els.snapshotId?.value || "").trim();
      await loadMeissaSnapshots(hz, {
        preferredSnapshotId: hs || undefined,
        suppressDispatch: Boolean(hs),
      });
    } catch (_) {
      syncMeissa3dEmbed({ skip2dLoad: true });
      return;
    }
    syncMeissa3dEmbed({ skip2dLoad: true });
  }

  function meissaOtpVisible() {
    const row = els.meissaOtpRow;
    if (!row) return false;
    return row.style.display !== "none";
  }

  function clearMeissaCloudSessionPrime() {
    const el = els.meissaCloudSessionPrime;
    if (!el) return;
    try {
      el.src = "about:blank";
    } catch (_) {}
  }

  /**
   * cloud.meissa.ai 를 숨김 iframe으로 한 번 로드해, URL의 token 쿼리로 웹앱이 세션을 잡도록 시도합니다.
   * (위 API 로그인과 별도 "루트"이지만, 같은 버튼 한 번으로 이어서 실행합니다.)
   */
  function primeMeissaCloudWebSession(accessToken) {
    const el = els.meissaCloudSessionPrime;
    if (!el || !accessToken) return Promise.resolve();
    const baseCandidates = [
      `${MEISSA_CLOUD_ORIGIN}/login`,
      `${MEISSA_CLOUD_ORIGIN}/`,
      `${MEISSA_CLOUD_ORIGIN}/projects`,
    ];
    const candidates = baseCandidates.flatMap((u) => buildTokenizedUrlCandidates(u));
    return candidates
      .reduce((p, url) => p.then(() => loadIframeWithTimeout(el, url, 1300)), Promise.resolve())
      .then(() => {
        el.src = withMeissaAccessTokenQuery(MEISSA_CLOUD_LOGIN_URL);
      });
  }

  async function doMeissaLogin() {
    const email = (els.meissaEmail?.value || "").trim();
    const password = els.meissaPassword?.value || "";
    const otp = (els.meissaOtp?.value || "").trim();
    if (!email || !password) {
      setStatus(els.meissaApiStatus, "이메일과 비밀번호를 입력하세요.", true);
      return;
    }
    if (meissaOtpVisible() && !otp) {
      setStatus(els.meissaApiStatus, "이메일로 받은 인증코드(2단계)를 입력하세요.", true);
      return;
    }
    setStatus(els.meissaApiStatus, "Meissa 로그인 중… (API 토큰)");
    try {
      const body = { email, password, service: "cloud" };
      if (otp) body.verificationCode = otp;
      const data = await meissaJson("/api/meissa/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (data && data.needsVerification) {
        if (els.meissaOtpRow) els.meissaOtpRow.style.display = "";
        if (els.meissaOtp) els.meissaOtp.focus();
        setStatus(
          els.meissaApiStatus,
          "2단계 인증이 필요합니다. 이메일로 받은 코드를 입력한 뒤 다시 「Meissa 로그인」을 누르세요."
        );
        return;
      }
      meissaAccess = normalizeMeissaAccessToken(data.access);
      if (!meissaAccess) throw new Error("액세스 토큰이 없습니다.");
      saveMeissaAccessToStorage(meissaAccess);
      if (els.meissaOtpRow) els.meissaOtpRow.style.display = "none";
      if (els.meissaOtp) els.meissaOtp.value = "";
      setStatus(els.meissaApiStatus, "Meissa 로그인 중… (cloud.meissa.ai 웹 세션)");
      await primeMeissaCloudWebSession(meissaAccess);
      // 가능한 환경(동일 출처 프록시 등)에서는 아래 로그인폼 자동 입력/클릭도 조용히 시도.
      trySubmitMeissaCloudLoginViaIframeDom(true);
      await populateMeissaProjectListFromAccess("로그인 완료");
      const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
      if (sid) {
        try {
          syncMeissa3dEmbed({ skip2dLoad: true });
          if (MEISSA_3D_EXCLUDED) {
            stopMeissaProgressiveLoader();
            state.meissaBasePoints = [];
            state.meissaBasePointColors = [];
            state.meissaSnapshotResources = [];
            state.meissaActiveSnapshotId = "";
            state.meissaResourceCount = 0;
          }
          if (MEISSA_2D_PRIORITY_MODE) {
            await loadMeissa2dOverlayImage(sid);
            stopMeissaProgressiveLoader();
            state.meissaBasePoints = [];
            state.meissaBasePointColors = [];
            state.meissaSnapshotResources = [];
            state.meissaActiveSnapshotId = "";
            state.meissaResourceCount = 0;
            setStatus(els.meissaApiStatus, "2D 우선 로드 완료(3D 자동 로드 일시 중지).");
          } else {
            const p2d = loadMeissa2dOverlayImage(sid);
            const p3d =
              MEISSA_3D_EXCLUDED || !MEISSA_POINT_CLOUD_AUTOLOAD
                ? Promise.resolve(true)
                : (async () => {
                    await loadMeissaSnapshotResources(sid, {
                      debugLabel: "LOGIN-OVERVIEW",
                      maxSampleResources: 1,
                      perResourceLimit: 2500,
                      pointCap: 7000,
                      phase: 0,
                    });
                    startMeissaProgressiveLoader(sid);
                    return true;
                  })();
            await Promise.allSettled([p2d, p3d]);
            if (MEISSA_3D_EXCLUDED || !MEISSA_POINT_CLOUD_AUTOLOAD) {
              stopMeissaProgressiveLoader();
              state.meissaBasePoints = [];
              state.meissaBasePointColors = [];
              state.meissaSnapshotResources = [];
              state.meissaActiveSnapshotId = "";
              state.meissaResourceCount = 0;
              if (!MEISSA_3D_EXCLUDED && !MEISSA_POINT_CLOUD_AUTOLOAD) {
                updateMeissaDebugText("점군 자동 로드 꺼짐. 「Meissa 점군 디버그」로 수동 로드할 수 있습니다.");
              }
            }
          }
          await refreshMeissa3d();
        } catch (_) {
          stopMeissaProgressiveLoader();
          state.meissaBasePoints = [];
          state.meissaBasePointColors = [];
          state.meissaSnapshotResources = [];
          state.meissaActiveSnapshotId = "";
          state.meissaResourceCount = 0;
        }
      }
      if (els.meissaPassword) els.meissaPassword.value = "";
    } catch (e) {
      meissaAccess = null;
      clearMeissaAccessFromStorage();
      stopMeissaProgressiveLoader();
      clearMeissaCloudSessionPrime();
      setStatus(els.meissaApiStatus, e.message || String(e), true);
    }
  }

  async function loadMeissaZones(projectId) {
    if (!meissaAccess || !projectId) return;
    const data = await meissaJson(`/api/meissa/projects/${encodeURIComponent(projectId)}/zones`, {
      headers: { Authorization: `JWT ${meissaAccess}` },
    });
    const zones = Array.isArray(data.zones) ? data.zones : [];
    setMeissaSelect(
      els.meissaZoneSelect,
      zones,
      zones.length ? "존 선택" : "존 없음",
      (z) => `${z.name} (${z.id})`
    );
    state.meissaSnapshots = [];
    resetMeissaSnapshotUi("존을 선택하세요");
  }

  async function loadMeissaSnapshots(zoneId, loadOpts) {
    loadOpts = loadOpts || {};
    if (!meissaAccess || !zoneId) return;
    const data = await meissaJson(`/api/meissa/zones/${encodeURIComponent(zoneId)}/snapshots`, {
      headers: { Authorization: `JWT ${meissaAccess}` },
    });
    const snaps = Array.isArray(data.snapshots) ? data.snapshots : [];
    state.meissaSnapshots = snaps;
    rebuildMeissaSnapshotSelect(loadOpts.preferredSnapshotId, {
      suppressDispatch: Boolean(loadOpts.suppressDispatch),
    });
  }

  function updateMeissaDebugText(text) {
    state.meissaResourceDebugText = String(text || "");
    if (els.meissa3dDebugText) els.meissa3dDebugText.textContent = state.meissaResourceDebugText;
  }

  /** @type {string[]} */
  let meissa2dLoadLogLines = [];

  function clearMeissa2dLoadLog() {
    meissa2dLoadLogLines = [];
    if (els.meissa2dLoadStatus) els.meissa2dLoadStatus.textContent = "2D: 대기 중";
  }

  function pushMeissa2dLoadLine(msg) {
    const t = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    meissa2dLoadLogLines.push(`[${t}] ${msg}`);
    while (meissa2dLoadLogLines.length > 20) meissa2dLoadLogLines.shift();
    if (els.meissa2dLoadStatus) els.meissa2dLoadStatus.textContent = meissa2dLoadLogLines.join("\n");
  }

  /** CSS 줌(scale)에 맞춰 캔버스 백킹 스토어 배율 — 확대 시 점·라벨 흐림 완화(메모리·GPU 한도 내 상향) */
  function meissa2dOverlayPixelScale(w, h) {
    const viewScale = Math.max(
      MEISSA_2D_ZOOM_MIN_SCALE,
      Math.min(MEISSA_2D_ZOOM_MAX_SCALE, Number(meissa2dViewScale) || 1)
    );
    const dpr = Math.min(2.25, window.devicePixelRatio || 1);
    let s = dpr * Math.min(MEISSA_2D_ZOOM_MAX_SCALE, Math.max(1, viewScale));
    const maxBacking = 16384;
    s = Math.min(s, maxBacking / Math.max(1, w), maxBacking / Math.max(1, h), 40);
    return Math.max(dpr * 0.55, s);
  }

  /**
   * 뷰포트 sharp 모드: 캔버스 논리 크기는 이미지 좌표(≈ ww/vs)이고, 화면에는 vs 배로 확대된다.
   * 백킹 스케일을 dpr*vs 수준으로 맞춰야 브라우저가 다시 늘릴 때 말뚝·라벨이 안 뭉개진다(기존 3.15 상한은 고줌에서 치명적).
   */
  function meissa2dOverlayPixelScaleForViewportCanvas(ww, wh, viewScale) {
    const vs = Math.max(
      MEISSA_2D_ZOOM_MIN_SCALE,
      Math.min(MEISSA_2D_ZOOM_MAX_SCALE, Number(viewScale) || 1)
    );
    const dpr = Math.min(2.25, window.devicePixelRatio || 1);
    const wW = Math.max(1, Number(ww) || 1);
    const wH = Math.max(1, Number(wh) || 1);
    let s = dpr * vs;
    const capW = (8192 * vs) / wW;
    const capH = (8192 * vs) / wH;
    s = Math.min(s, capW, capH, 72);
    return Math.max(dpr * 0.95, s);
  }

  /** panzoom CSS scale(확대) — 점·선은 루트와 함께 스케일되므로 역보정해 화면상 크기를 맞춘다 */
  function meissa2dPanzoomScaleSanitized() {
    return Math.max(
      MEISSA_2D_ZOOM_MIN_SCALE,
      Math.min(MEISSA_2D_ZOOM_MAX_SCALE, Number(meissa2dViewScale) || 1)
    );
  }

  function meissa2dOverlayDotRadiusCssPx(baseR) {
    const b = Number.isFinite(Number(baseR)) ? Number(baseR) : 3;
    const vs = meissa2dPanzoomScaleSanitized();
    // 라벨과 동일: 역보정은 b/vs 한 가지. 하한만 너무 작은 점 방지, 상한은 과축소 시에만.
    const r = b / vs;
    return Math.max(0.3, Math.min(18, r));
  }

  function meissa2dOverlayLineWidthCssPx(pxScale, baseW) {
    const ps = Number(pxScale) > 0 ? Number(pxScale) : 1;
    const bw = Number.isFinite(Number(baseW)) ? Number(baseW) : 1.25;
    const vs = meissa2dPanzoomScaleSanitized();
    return Math.max(0.3, bw / (ps * vs));
  }

  function stopMeissaProgressiveLoader() {
    if (meissaProgressiveTimer) {
      try {
        window.clearTimeout(meissaProgressiveTimer);
      } catch (_) {
        /* ignore */
      }
      meissaProgressiveTimer = null;
    }
    meissaProgressivePhase = 0;
    meissaProgressiveRunning = false;
  }

  function startMeissaProgressiveLoader(snapshotId, loaderOptions) {
    loaderOptions = loaderOptions || {};
    if (MEISSA_3D_EXCLUDED) return;
    if (!MEISSA_POINT_CLOUD_AUTOLOAD && !loaderOptions.force) return;
    stopMeissaProgressiveLoader();
    const sid = String(snapshotId || "").trim();
    if (!sid || !meissaAccess) return;
    meissaProgressivePhase = 1;
    const runOnce = async () => {
      const curSid = (els.meissaSnapshotSelect?.value || "").trim();
      if (!curSid || curSid !== sid) {
        stopMeissaProgressiveLoader();
        return;
      }
      if (document.hidden) {
        // 백그라운드 탭에서는 네트워크/렌더 부하를 줄여 새로고침 체감 지연을 방지
        meissaProgressiveTimer = window.setTimeout(runOnce, 2200);
        return;
      }
      if (meissaProgressiveRunning) return;
      if (state.meissaBasePoints.length >= 200000) {
        stopMeissaProgressiveLoader();
        return;
      }
      meissaProgressiveRunning = true;
      try {
        await loadMeissaSnapshotResources(sid, {
          debugLabel: `PROG#${meissaProgressivePhase}`,
          maxSampleResources: 2,
          perResourceLimit: 9000,
          pointCap: 80000,
          incremental: true,
          phase: meissaProgressivePhase,
          resources: state.meissaSnapshotResources,
        });
        if (meissaProgressivePhase <= 10 || meissaProgressivePhase % 3 === 0) {
          await refreshMeissa3d();
        }
        setStatus(
          els.meissaApiStatus,
          `Meissa 점군 누적 로딩 중… phase ${meissaProgressivePhase} · 포인트 ${state.meissaBasePoints.length}개`
        );
        meissaProgressivePhase += 1;
        if (meissaProgressivePhase > 180) stopMeissaProgressiveLoader();
      } catch (_) {
        // 다음 주기 재시도
      } finally {
        meissaProgressiveRunning = false;
        if (meissaProgressiveTimer != null) {
          const delay = meissaProgressivePhase <= 10 ? 700 : 1500;
          meissaProgressiveTimer = window.setTimeout(runOnce, delay);
        }
      }
    };
    meissaProgressiveTimer = window.setTimeout(runOnce, 300);
  }

  function pointTypeScore(resource) {
    const s = `${resource?.type || ""} ${resource?.name || ""}`.toLowerCase();
    let v = 0;
    if (s.includes("point")) v += 5;
    if (s.includes("cloud")) v += 5;
    if (s.includes("ply")) v += 4;
    if (s.includes("csv") || s.includes("xyz") || s.includes("txt")) v += 3;
    if (s.includes("las") || s.includes("laz")) v += 2;
    return v;
  }

  function getFocusBoundsFromFileCoords() {
    const src = [];
    if (Array.isArray(state.circles) && state.circles.length) {
      for (const c of state.circles) {
        const x = Number(c?.center_x);
        const y = Number(c?.center_y);
        if (Number.isFinite(x) && Number.isFinite(y)) src.push([x, y]);
      }
    }
    if (!src.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of src) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const dx = Math.max(1, maxX - minX);
    const dy = Math.max(1, maxY - minY);
    const margin = Math.max(20, Math.min(120, Math.hypot(dx, dy) * 0.2));
    return { minX: minX - margin, maxX: maxX + margin, minY: minY - margin, maxY: maxY + margin };
  }

  function applyFocusFilter(points, colors, pointCap) {
    const b = getFocusBoundsFromFileCoords();
    if (!b || !Array.isArray(points) || !points.length) {
      return { points: [], colors: [], focusedCount: 0, totalCount: points.length, enabled: false };
    }
    const inPts = [];
    const inCols = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = Number(p?.[0]);
      const y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
        inPts.push(p);
        inCols.push(Array.isArray(colors?.[i]) ? colors[i] : [0.53, 0.95, 0.99]);
      }
    }
    return {
      points: inPts.slice(0, pointCap),
      colors: inCols.slice(0, pointCap),
      focusedCount: inPts.length,
      totalCount: points.length,
      enabled: true,
    };
  }

  function pointResourceCandidates(resources) {
    return [...(resources || [])]
      .map((r) => ({ r, score: pointTypeScore(r) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
  }

  async function loadMeissaSnapshotResources(snapshotId, options) {
    options = options || {};
    const maxSampleResources = Number(options.maxSampleResources) || 12;
    const perResourceLimit = Number(options.perResourceLimit) || 8000;
    const debugLabel = options.debugLabel || "AUTO";
    const pointCap = Number(options.pointCap) || 30000;
    const incremental = Boolean(options.incremental);
    const phase = Number(options.phase) || 0;
    const providedResources = Array.isArray(options.resources) ? options.resources : null;
    const sid = String(snapshotId || "").trim();
    if (!meissaAccess || !snapshotId) {
      state.meissaBasePoints = [];
      state.meissaBasePointColors = [];
      state.meissaSnapshotResources = [];
      state.meissaActiveSnapshotId = "";
      state.meissaResourceCount = 0;
      updateMeissaDebugText("토큰/스냅샷이 없어 점군 로드를 건너뜀");
      return;
    }
    if (MEISSA_3D_EXCLUDED) {
      updateMeissaDebugText("[비활성] 점군/3D 로드가 꺼져 있습니다(MEISSA_3D_EXCLUDED).");
      return;
    }
    if (!getFocusBoundsFromFileCoords()) {
      state.meissaBasePoints = [];
      state.meissaBasePointColors = [];
      state.meissaResourceCount = 0;
      updateMeissaDebugText(
        `[${debugLabel}] snapshot=${snapshotId}\n파일좌표(circles)가 없어 로드 중단: 「현재 도면 좌표 가져오기」 먼저 실행하세요.`
      );
      return;
    }
    let resources = providedResources;
    if (!resources) {
      if (state.meissaActiveSnapshotId === sid && Array.isArray(state.meissaSnapshotResources) && state.meissaSnapshotResources.length) {
        resources = state.meissaSnapshotResources;
      } else {
        const data = await meissaJson(`/api/meissa/snapshots/${encodeURIComponent(snapshotId)}/resources`, {
          headers: { Authorization: `JWT ${meissaAccess}` },
        });
        resources = Array.isArray(data.resources) ? data.resources : [];
      }
    }
    state.meissaSnapshotResources = resources;
    if (!incremental) state.meissaActiveSnapshotId = sid;
    const canReuse = incremental && state.meissaActiveSnapshotId === sid;
    const pts = canReuse ? [...(state.meissaBasePoints || [])] : [];
    const ptColors = canReuse ? [...(state.meissaBasePointColors || [])] : [];
    const pointKeySet = new Set(
      pts.map((p) => `${Number(p?.[0]).toFixed(3)}|${Number(p?.[1]).toFixed(3)}|${Number(p?.[2]).toFixed(3)}`)
    );
    const addPoint = (x, y, z, cc) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
      const key = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`;
      if (pointKeySet.has(key)) return false;
      pointKeySet.add(key);
      pts.push([x, y, z]);
      if (Array.isArray(cc) && cc.length >= 3) {
        const cr = Number(cc[0]);
        const cg = Number(cc[1]);
        const cb = Number(cc[2]);
        ptColors.push([
          Number.isFinite(cr) ? Math.max(0, Math.min(1, cr)) : 0.53,
          Number.isFinite(cg) ? Math.max(0, Math.min(1, cg)) : 0.95,
          Number.isFinite(cb) ? Math.max(0, Math.min(1, cb)) : 0.99,
        ]);
      } else {
        ptColors.push([0.53, 0.95, 0.99]);
      }
      return true;
    };
    let inlineCount = 0;
    const debugRows = [];
    if (!incremental) {
      for (const r of resources) {
        const arr = Array.isArray(r.inlinePoints) ? r.inlinePoints : [];
        for (const p of arr) {
          if (!Array.isArray(p) || p.length < 3) continue;
          const x = Number(p[0]);
          const y = Number(p[1]);
          const z = Number(p[2]);
          if (addPoint(x, y, z, [0.53, 0.95, 0.99])) inlineCount += 1;
          if (pts.length >= pointCap) break;
        }
        if (pts.length >= pointCap) break;
      }
    }
    // inline points가 부족하면 리소스 상세 포인트 샘플 API로 보강
    const needMore = pts.length < pointCap;
    if (needMore) {
      const candidates = pointResourceCandidates(resources);
      const ranked = candidates.length ? candidates : [...resources];
      const selected = [];
      if (incremental && ranked.length) {
        const start = Math.max(0, phase % ranked.length);
        for (let i = 0; i < Math.min(maxSampleResources, ranked.length); i++) {
          selected.push(ranked[(start + i) % ranked.length]);
        }
      } else {
        selected.push(...ranked.slice(0, maxSampleResources));
      }
      for (const r of selected) {
        const rid = r?.id;
        if (rid == null) continue;
        try {
          const sample = await meissaJson(
            `/api/meissa/snapshots/${encodeURIComponent(snapshotId)}/resources/${encodeURIComponent(String(rid))}/points?limit=${encodeURIComponent(String(perResourceLimit))}&phase=${encodeURIComponent(String(phase))}`,
            { headers: { Authorization: `JWT ${meissaAccess}` } }
          );
          const arr2 = Array.isArray(sample?.points) ? sample.points : [];
          const c2 = Array.isArray(sample?.pointColors) ? sample.pointColors : [];
          const parser = sample?.parser || "unknown";
          const downloaded = Number(sample?.downloadBytes || 0);
          const contentLength = Number(sample?.contentLength || 0);
          const truncated = Boolean(sample?.truncated);
          debugRows.push({
            rid: String(rid),
            name: String(r?.name || ""),
            type: String(r?.type || ""),
            parser: String(parser),
            count: arr2.length,
            downloaded,
            contentLength,
            truncated,
          });
          for (let ai = 0; ai < arr2.length; ai++) {
            const p = arr2[ai];
            if (!Array.isArray(p) || p.length < 3) continue;
            const x = Number(p[0]);
            const y = Number(p[1]);
            const z = Number(p[2]);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
            const cc = c2.length > ai ? c2[ai] : null;
            addPoint(x, y, z, cc);
            if (pts.length >= pointCap) break;
          }
          if (pts.length >= pointCap) break;
        } catch (e) {
          debugRows.push({
            rid: String(rid),
            name: String(r?.name || ""),
            type: String(r?.type || ""),
            parser: "error",
            count: 0,
            error: e?.message ? String(e.message) : String(e),
          });
        }
      }
    }
    state.meissaBasePoints = pts;
    state.meissaBasePointColors = ptColors.length === pts.length ? ptColors : [];
    const focused = applyFocusFilter(state.meissaBasePoints, state.meissaBasePointColors, pointCap);
    state.meissaBasePoints = focused.points;
    state.meissaBasePointColors = focused.colors;
    state.meissaActiveSnapshotId = sid;
    state.meissaResourceCount = resources.length;
    const parserSummary = {};
    debugRows.forEach((r) => {
      parserSummary[r.parser] = (parserSummary[r.parser] || 0) + 1;
    });
    const summaryText = Object.entries(parserSummary)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    const topRows = debugRows
      .slice(0, 16)
      .map(
        (r) =>
          `- rid=${r.rid} type=${r.type || "-"} parser=${r.parser} points=${r.count}` +
          `${r.downloaded ? ` bytes=${r.downloaded}` : ""}` +
          `${r.contentLength ? `/${r.contentLength}` : ""}` +
          `${r.truncated ? " truncated=Y" : ""}` +
          `${r.error ? ` err=${r.error}` : ""}`
      )
      .join("\n");
    updateMeissaDebugText(
      [
        `[${debugLabel}] snapshot=${snapshotId}`,
        `resources=${resources.length}, inlinePoints=${inlineCount}, mergedPoints=${state.meissaBasePoints.length}, cap=${pointCap}`,
        `strategy=${incremental ? "progressive" : "overview"} phase=${phase}`,
        `focusFilter=${focused.enabled ? "ON" : "OFF"} focused=${focused.focusedCount}/${focused.totalCount}`,
        `sampled=${debugRows.length}, parserSummary=${summaryText || "-"}`,
        "",
        topRows || "- sampled resource log 없음",
      ].join("\n")
    );
  }

  function applyIdsFromMeissaSelects() {
    const pid = (els.meissaProjectSelect?.value || "").trim();
    const zid = (els.meissaZoneSelect?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim();
    if (els.projectId && pid) els.projectId.value = pid;
    if (els.zoneId && zid) els.zoneId.value = zid;
    if (els.snapshotId && sid) els.snapshotId.value = sid;
  }

  /** 선택된 스냅샷의 촬영일(YYYY-MM-DD). data·API·옵션 문구에서 순서대로 추출. */
  function getMeissaSnapshotShootingIso() {
    const sel = els.meissaSnapshotSelect;
    const opt = sel?.selectedOptions?.[0];
    if (!opt?.value) return null;

    let dateHint = opt.dataset?.dateHint;
    if (!dateHint) {
      const snap = (state.meissaSnapshots || []).find((x) => String(x.id) === opt.value);
      if (snap) dateHint = effectiveSnapshotDateIso(snap) || undefined;
    }
    let canonical = dateHint ? parseIsoDate(String(dateHint)) : null;
    if (!canonical) {
      const fromText = extractIsoDateFromText(opt.textContent || "");
      if (fromText) canonical = parseIsoDate(fromText);
    }
    return canonical;
  }

  /**
   * 드론 스냅샷 촬영일 → PDAM 기준일(dateTo) 연동.
   * - 날짜 입력란: 촬영일(드론) 표시.
   * - 기준일 셀렉트: 동일 일이 있으면 선택, 없으면 촬영일 이전(당일 포함) 중 가장 가까운 PDAM 일.
   *   resolvedDateTo()에서 촬영일보다 늦은 셀렉트는 자동 보정합니다.
   */
  function applySnapshotDateHint() {
    const canonical = getMeissaSnapshotShootingIso();
    if (!canonical || !els.dateInput) return;

    els.dateInput.value = canonical;

    const presetEl = els.datePreset;
    if (!presetEl) return;
    const entries = getPdamPresetEntries();
    if (!entries.length) {
      presetEl.value = "";
      return;
    }
    const exact = entries.find((e) => e.iso === canonical);
    if (exact) {
      presetEl.value = exact.raw;
      return;
    }
    const picked = pickPdamRawValueOnOrBefore(canonical, entries);
    if (picked && [...presetEl.options].some((o) => o.value === picked)) presetEl.value = picked;
    else presetEl.value = "";
  }

  const MEISSA_3D_MODULE = "/frontend/meissa-compare-3d.js?v=202603652";

  async function refreshMeissa3d() {
    if (!document.getElementById("meissa-3d-root")) return;
    if (MEISSA_3D_EXCLUDED) {
      if (els.meissa3dLegendText) {
        els.meissa3dLegendText.textContent = "3D·점군 미리보기는 일시 비활성화입니다. 2D 정사·표만 사용합니다.";
      }
      return;
    }
    if (!state.lastCompareRecords.length && !state.meissaBasePoints.length) {
      if (els.meissa3dLegendText)
        els.meissa3dLegendText.textContent = "PDAM 스냅샷 로드·자동 비교 후 도면 원 좌표에 색이 표시됩니다.";
      return;
    }
    normalizeMeissa3dColorModeSelect();
    try {
      const mod = await import(MEISSA_3D_MODULE);
      await mod.ensureInit("#meissa-3d-root");
      const planTh = meissaPlanDeviationThresholds();
      mod.updateRecords(state.lastCompareRecords, {
        colorMode: els.meissa3dColorMode?.value || "remaining",
        viewMode: "overlay",
        overlay2dMode: true,
        obliqueImageMode: false,
        overlayImageUrl: (els.meissaCloud2dImageLocal?.src || "").trim() || null,
        legendEl: els.meissa3dLegendText,
        basePoints: state.meissaBasePoints,
        basePointColors: state.meissaBasePointColors,
        baseResourceCount: state.meissaResourceCount,
        remainingMinFilter: meissaRemainingMinFilterNumber(),
        planDevOkM: planTh.okM,
        planDevBadM: planTh.badM,
      });
      const root3d = document.getElementById("meissa-3d-root");
      if (root3d) root3d.style.pointerEvents = "auto";
      syncMeissaLegendRowVisibility();
    } catch (e) {
      console.warn("meissa 3d preview", e);
      if (els.meissa3dLegendText) {
        els.meissa3dLegendText.textContent =
          "3D 미리보기를 불러오지 못했습니다. 인터넷(CDN) 연결을 확인하세요.";
      }
    }
  }

  function bindMeissaCascade() {
    if (!els.meissaLoginBtn && !els.meissaProjectSelect) return;

    els.meissaLoginBtn?.addEventListener("click", doMeissaLogin);

    els.meissaProjectSelect?.addEventListener("change", async () => {
      const pid = (els.meissaProjectSelect.value || "").trim();
      if (els.projectId && pid) els.projectId.value = pid;
      if (els.zoneId) els.zoneId.value = "";
      if (els.snapshotId) els.snapshotId.value = "";
      setMeissaSelect(els.meissaZoneSelect, [], pid ? "불러오는 중…" : "프로젝트를 선택하세요");
      state.meissaSnapshots = [];
      resetMeissaSnapshotUi(pid ? "불러오는 중…" : "존을 선택하세요");
      syncMeissa3dEmbed();
      if (!pid || !meissaAccess) {
        if (!pid) setMeissaSelect(els.meissaZoneSelect, [], "프로젝트를 선택하세요");
        return;
      }
      try {
        setStatus(els.meissaApiStatus, "존 목록 불러오는 중…");
        await loadMeissaZones(pid);
        const nz = Math.max(0, (els.meissaZoneSelect?.querySelectorAll("option").length || 1) - 1);
        setStatus(els.meissaApiStatus, `존 ${nz}건`);
      } catch (e) {
        setMeissaSelect(els.meissaZoneSelect, [], "불러오지 못함");
        setStatus(els.meissaApiStatus, e.message || String(e), true);
      }
    });

    els.meissaZoneSelect?.addEventListener("change", async () => {
      const zid = (els.meissaZoneSelect.value || "").trim();
      const pid = (els.meissaProjectSelect?.value || "").trim();
      if (els.projectId && pid) els.projectId.value = pid;
      if (els.zoneId && zid) els.zoneId.value = zid;
      if (els.snapshotId) els.snapshotId.value = "";
      state.meissaSnapshots = [];
      resetMeissaSnapshotUi(zid ? "불러오는 중…" : "존을 선택하세요");
      syncMeissa3dEmbed();
      if (!zid || !meissaAccess) {
        if (!zid) resetMeissaSnapshotUi("존을 선택하세요");
        return;
      }
      try {
        setStatus(els.meissaApiStatus, "스냅샷 목록 불러오는 중…");
        await loadMeissaSnapshots(zid);
        const ns = state.meissaSnapshots.length;
        setStatus(els.meissaApiStatus, `스냅샷 ${ns}건`);
      } catch (e) {
        state.meissaSnapshots = [];
        resetMeissaSnapshotUi("불러오지 못함");
        setStatus(els.meissaApiStatus, e.message || String(e), true);
      }
    });

    els.meissaSnapshotYear?.addEventListener("change", () => {
      if (meissaCascadeUpdating) return;
      rebuildMeissaSnapshotSelect(null);
    });
    els.meissaSnapshotMonth?.addEventListener("change", () => {
      if (meissaCascadeUpdating) return;
      rebuildMeissaSnapshotSelect(null);
    });

    els.meissaSnapshotSelect?.addEventListener("change", async () => {
      if (!state.circles?.length) requestCirclesFromMainOrOpener(true);
      applyIdsFromMeissaSelects();
      applySnapshotDateHint();
      updateMeissaSnapshotPreview();
      const sid = (els.meissaSnapshotSelect?.value || "").trim();
      if (sid) {
        setStatus(els.meissaApiStatus, MEISSA_2D_PRIORITY_MODE ? "Meissa 2D 우선 로딩 중…" : "Meissa 2D/3D 동시 로딩 중…");
        syncMeissa3dEmbed({ skip2dLoad: true });
        if (MEISSA_3D_EXCLUDED) {
          stopMeissaProgressiveLoader();
          state.meissaBasePoints = [];
          state.meissaBasePointColors = [];
          state.meissaSnapshotResources = [];
          state.meissaActiveSnapshotId = "";
          state.meissaResourceCount = 0;
        }
        if (MEISSA_2D_PRIORITY_MODE) {
          const t0 = Date.now();
          const imageOk = await loadMeissa2dOverlayImage(sid).catch(() => false);
          stopMeissaProgressiveLoader();
          state.meissaBasePoints = [];
          state.meissaBasePointColors = [];
          state.meissaSnapshotResources = [];
          state.meissaActiveSnapshotId = "";
          state.meissaResourceCount = 0;
          setStatus(
            els.meissaApiStatus,
            imageOk
              ? "2D 우선 로드 완료(3D 자동 로드 중지)."
              : `2D 우선 로드 실패. ${(state.meissa2dLoadFailHint || "").trim()}`.trim(),
            !imageOk
          );
        } else {
          const p2d = loadMeissa2dOverlayImage(sid);
          const p3d =
            MEISSA_3D_EXCLUDED || !MEISSA_POINT_CLOUD_AUTOLOAD
              ? Promise.resolve(true)
              : (async () => {
                  await loadMeissaSnapshotResources(sid, {
                    debugLabel: "AUTO-OVERVIEW",
                    maxSampleResources: 1,
                    perResourceLimit: 2500,
                    pointCap: 7000,
                    phase: 0,
                  });
                  startMeissaProgressiveLoader(sid);
                  return true;
                })();
          const [r2d, r3d] = await Promise.allSettled([p2d, p3d]);
          const imageOk = r2d.status === "fulfilled" ? Boolean(r2d.value) : false;
          const pointsOk = r3d.status === "fulfilled";
          if (pointsOk) {
            if (MEISSA_3D_EXCLUDED || !MEISSA_POINT_CLOUD_AUTOLOAD) {
              stopMeissaProgressiveLoader();
              state.meissaBasePoints = [];
              state.meissaBasePointColors = [];
              state.meissaSnapshotResources = [];
              state.meissaActiveSnapshotId = "";
              state.meissaResourceCount = 0;
            }
            if (MEISSA_3D_EXCLUDED || !MEISSA_POINT_CLOUD_AUTOLOAD) {
              const hint = MEISSA_3D_EXCLUDED ? "점군/3D 비활성화" : "점군 자동 로드 꺼짐(디버그로 수동)";
              setStatus(
                els.meissaApiStatus,
                `${imageOk ? "2D 로드 완료" : "2D 로드 실패"} · ${hint}`,
                !imageOk
              );
            } else {
              setStatus(
                els.meissaApiStatus,
                `${imageOk ? "2D O" : "2D X"} · Meissa 원본 리소스 ${state.meissaResourceCount}건 · 추출 포인트 ${state.meissaBasePoints.length}개`
              );
            }
          } else {
            stopMeissaProgressiveLoader();
            state.meissaBasePoints = [];
            state.meissaBasePointColors = [];
            state.meissaSnapshotResources = [];
            state.meissaActiveSnapshotId = "";
            state.meissaResourceCount = 0;
            const errMsg =
              r3d.status === "rejected"
                ? r3d.reason?.message || String(r3d.reason || "3D 로드 실패")
                : "3D 로드 실패";
            setStatus(els.meissaApiStatus, errMsg, true);
          }
        }
      } else {
        stopMeissaProgressiveLoader();
        state.meissaBasePoints = [];
        state.meissaBasePointColors = [];
        state.meissaSnapshotResources = [];
        state.meissaActiveSnapshotId = "";
        state.meissaResourceCount = 0;
        updateMeissaDebugText("스냅샷 미선택: 점군 로드 없음");
      }
      syncMeissa3dEmbed({ skip2dLoad: true });
      await refreshMeissa3d();
      if ((els.dataset?.value || "").trim()) await loadPdamSnapshot();
    });
  }

  function buildDashboardPayload(overrides) {
    overrides = overrides || {};
    const datasetId = els.dataset?.value || "";
    const workId = (els.workId?.value || "").trim() || null;
    let dateTo;
    if (Object.prototype.hasOwnProperty.call(overrides, "dateTo")) dateTo = overrides.dateTo;
    else dateTo = resolvedDateTo();
    return {
      datasetId,
      circles: state.circles,
      workId,
      dateFrom: null,
      dateTo: dateTo === "" ? null : dateTo,
      month: null,
      equipments: [],
      methods: [],
      locations: [],
      remainingThreshold: null,
      settlementMonth: null,
      settlementStartDay: 25,
      settlementEndDay: 20,
    };
  }

  /**
   * PDAM dateTo. 스냅샷 촬영일(직접 입력)보다 늦은 기준일 셀렉트는 쓰지 않고,
   * 촬영일 이하 목록 중 가장 가까운 값으로 맞춥니다.
   */
  function resolvedDateTo() {
    const inpRaw = (els.dateInput?.value || "").trim();
    const inpIso = inpRaw ? parseIsoDate(inpRaw) : null;
    let fromSelect = els.datePreset?.value?.trim();
    const selIso = fromSelect ? parseIsoDate(fromSelect) : null;

    if (inpIso && selIso && selIso > inpIso) {
      const entries = getPdamPresetEntries();
      const picked = pickPdamRawValueOnOrBefore(inpIso, entries);
      if (picked && [...(els.datePreset?.options || [])].some((o) => o.value === picked)) {
        els.datePreset.value = picked;
        return picked;
      }
      if (els.datePreset) els.datePreset.value = "";
      return inpRaw || null;
    }

    if (fromSelect) return fromSelect;
    return inpRaw || null;
  }

  function pilexyConstructionProjectContextForFetch() {
    try {
      if (typeof window.__PILEXY_GET_MEISSA_CONTEXT__ === "function") {
        const ctx = window.__PILEXY_GET_MEISSA_CONTEXT__();
        const p = String(ctx?.projectContext ?? ctx?.project ?? "").trim();
        if (p) return p;
      }
    } catch (_) {
      /* ignore */
    }
    if (pilexyPdamProjectContextOverride) return pilexyPdamProjectContextOverride;
    if (typeof getActiveProjectName === "function") return getActiveProjectName();
    return "기본";
  }

  async function refreshDatasets() {
    const pc = encodeURIComponent(pilexyConstructionProjectContextForFetch());
    const res = await fetch(`${API_BASE_URL}/api/construction/datasets?project_context=${pc}`, {
      signal: pilexyUnloadAbort.signal,
    });
    const list = await pilexyParseFetchJson(res);
    const arr = Array.isArray(list) ? list : [];
    els.dataset.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = arr.length ? "시공 데이터셋 선택" : "데이터셋 없음";
    els.dataset.appendChild(ph);
    arr.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      const proj = d.projectContext ? ` · ${d.projectContext}` : "";
      o.textContent = `${d.name || d.filename || d.id}${proj}`;
      els.dataset.appendChild(o);
    });
    // 목록은 created_at DESC이므로 첫 항목을 기본(최신 저장 세트)으로 맞춘다.
    const latestDatasetId = arr[0]?.id || "";
    if (latestDatasetId && [...els.dataset.options].some((option) => option.value === latestDatasetId)) {
      els.dataset.value = latestDatasetId;
    } else {
      els.dataset.value = "";
    }
  }

  async function postDashboard(payload) {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/construction/dashboard`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      MEISSA_DASHBOARD_FETCH_MS
    );
    const cfMsg = httpCloudflareOriginErrorMessage(res.status);
    if (cfMsg) throw new Error(cfMsg);
    return pilexyParseFetchJson(res);
  }

  function fillDatePresets(dates) {
    const sel = els.datePreset;
    const cur = sel.value;
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = dates?.length ? "기준일 선택" : "날짜 없음";
    sel.appendChild(opt0);
    (dates || []).forEach((d) => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      sel.appendChild(o);
    });
    applySnapshotDateHint();
    if (!sel.value && cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  async function loadCirclesIfNeeded() {
    if (state.circles.length) return;
    const id = (els.workId?.value || "").trim();
    if (!id) return;
    const res = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(id)}`, {
      signal: pilexyUnloadAbort.signal,
    });
    const data = await pilexyParseFetchJson(res);
    state.circles = Array.isArray(data.circles) ? data.circles : [];
    renderMeissa2dPointsOverlay();
  }

  /** postMessage로 부모에서 도면 원 수신(최대 timeoutMs). __PILEXY_GET_MEISSA_CONTEXT__ 가 있으면 동기 반영만 하고 즉시 반환. */
  function fetchCirclesFromOpenerAsPromise(timeoutMs) {
    const t = Math.max(500, Number(timeoutMs) || 4500);
    if (typeof window.__PILEXY_GET_MEISSA_CONTEXT__ === "function") {
      try {
        const ctx = window.__PILEXY_GET_MEISSA_CONTEXT__();
        state.circles = ctx.circles || [];
        if (ctx.workId && els.workId && !els.workId.value.trim()) els.workId.value = ctx.workId;
        renderMeissa2dPointsOverlay();
      } catch (_) {}
      return Promise.resolve();
    }
    if (!window.opener) return Promise.resolve();
    const origin = window.location.origin;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const onMsg = (ev) => {
        if (ev.origin !== origin) return;
        if (ev.data?.type !== "pilexy-meissa-circles") return;
        window.removeEventListener("message", onMsg);
        const payload = ev.data.payload || {};
        state.circles = payload.circles || [];
        renderMeissa2dPointsOverlay();
        if (payload.workId && els.workId && !els.workId.value.trim()) els.workId.value = payload.workId;
        done();
      };
      window.addEventListener("message", onMsg);
      try {
        window.opener.postMessage({ type: "meissa-request-circles" }, origin);
      } catch (_) {
        window.removeEventListener("message", onMsg);
        done();
        return;
      }
      window.setTimeout(() => {
        window.removeEventListener("message", onMsg);
        done();
      }, t);
    });
  }

  async function ensureCompareCirclesLoaded() {
    if (typeof window.__PILEXY_GET_MEISSA_CONTEXT__ === "function") {
      try {
        const ctx = window.__PILEXY_GET_MEISSA_CONTEXT__();
        state.circles = ctx.circles || [];
        if (ctx.workId && els.workId && !els.workId.value.trim()) els.workId.value = ctx.workId;
        renderMeissa2dPointsOverlay();
      } catch (_) {}
    }
    try {
      await loadCirclesIfNeeded();
    } catch (_) {
      /* 저장 작업 로드 실패 시 부모 창 폴백 허용 */
    }
    if (state.circles?.length) return;
    await fetchCirclesFromOpenerAsPromise(4500);
  }

  async function loadDateOptions() {
    if (!els.dataset.value) {
      setStatus(els.pdamStatus, "데이터셋을 먼저 선택하세요.", true);
      return false;
    }
    setStatus(els.pdamStatus, "날짜 목록을 불러오는 중…");
    try {
      const data = await postDashboard(buildDashboardPayload({ dateTo: null }));
      const dates = data.filters?.options?.dates || [];
      fillDatePresets(dates);
      const bounds = data.filters?.options?.dateBounds;
      if (bounds?.max && !els.dateInput.value) els.dateInput.value = bounds.max;
      setStatus(els.pdamStatus, `날짜 ${dates.length}건 불러옴.`);
      return true;
    } catch (e) {
      setStatus(els.pdamStatus, e.message || String(e), true);
      return false;
    }
  }

  async function loadPdamSnapshot() {
    if (!els.dataset.value) {
      setStatus(els.pdamStatus, "데이터셋을 먼저 선택하세요.", true);
      return;
    }
    const dateTo = resolvedDateTo();
    if (!dateTo) {
      setStatus(els.pdamStatus, "스냅샷 기준일을 선택하거나 입력하세요.", true);
      return;
    }
    setStatus(els.pdamStatus, "PDAM 스냅샷 로드 중…");
    try {
      const data = await postDashboard(buildDashboardPayload({ dateTo }));
      state.lastDashboard = data;
      state.pdamByCircleId = buildMappingByCircleId(data);
      applyDefaultMeissaColorModeFromPdam();
      scheduleRenderMeissa2dPointsOverlay();
      await refreshMeissa3d();
      const s = data.summary || {};
      const basePdamMsg = `기준일 ${dateTo} · 시공행 ${s.recordCount ?? "-"}건 · 좌표 매칭 ${s.matchedCircleCount ?? "-"} / 미시공 ${s.pendingCircleCount ?? "-"}`;
      setStatus(els.pdamStatus, basePdamMsg);
      const zAuto = await maybeAutoFillMeissaUiPlanAfterPdam();
      if (zAuto && zAuto.ok) {
        const zz = typeof zAuto.z === "number" && Number.isFinite(zAuto.z) ? zAuto.z.toFixed(3) : String(zAuto.z ?? "");
        setStatus(els.pdamStatus, `${basePdamMsg} · Meissa Z 자동 ${zz} (X/Y 말뚝 좌표)`);
      } else if (zAuto && zAuto.skipped) {
        /* 로그인·스냅샷·말뚝 없음 등 — PDAM 메시지만 유지 */
      } else if (zAuto && !zAuto.ok && zAuto.message) {
        setStatus(els.pdamStatus, `${basePdamMsg} · Meissa Z 자동 실패: ${zAuto.message}`, true);
      }
      try {
        await runCompare();
      } catch (compareErr) {
        setStatus(
          els.pdamStatus,
          `${basePdamMsg} · 자동 비교 오류: ${compareErr?.message || String(compareErr)}`,
          true
        );
      }
    } catch (e) {
      setStatus(els.pdamStatus, e.message || String(e), true);
    }
  }

  /**
   * PDAM 로드 후: 매칭 말뚝(없으면 첫 비교점) (X,Y)+오프셋으로 nearest-z 1회 조회해 상태줄에 샘플 Z 표시(비교 계산과 별개).
   * @returns {Promise<{ ok: boolean, z?: number, skipped?: boolean, message?: string }>}
   */
  async function maybeAutoFillMeissaUiPlanAfterPdam() {
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    if (!sid || !meissaAccess) {
      return { ok: false, skipped: true, message: "스냅샷 또는 Meissa 로그인 없음" };
    }
    try {
      await loadCirclesIfNeeded();
    } catch (_) {
      return { ok: false, skipped: true, message: "도면 원 로드 실패" };
    }
    const circles = state.circles || [];
    const ox = parseNumber(els.offsetX?.value) || 0;
    const oy = parseNumber(els.offsetY?.value) || 0;
    const pdamMap = state.pdamByCircleId;
    /** @type {{ x: number, y: number }|null} */
    let chosen = null;
    for (const c of circles) {
      const pileRaw = c.matched_text?.text;
      if (pileRaw == null || String(pileRaw).trim() === "") continue;
      const x = Number(c.center_x) + ox;
      const y = Number(c.center_y) + oy;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cid = c.id != null ? String(c.id) : "";
      if (cid && pdamMap && typeof pdamMap.has === "function" && pdamMap.has(cid)) {
        chosen = { x, y };
        break;
      }
    }
    if (!chosen) {
      const pts = buildComparePointsFromCircles(circles).map((p) => ({
        x: p.x + ox,
        y: p.y + oy,
      }));
      if (!pts.length) {
        return { ok: false, skipped: true, message: "말뚝 매칭된 원 없음" };
      }
      chosen = { x: pts[0].x, y: pts[0].y };
    }
    const zidForZ = (els.meissaZoneSelect?.value || "").trim() || (els.zoneId?.value || "").trim();
    const res = await fetchMeissaNearestZSnapshot(sid, chosen.x, chosen.y, zidForZ);
    const zVal = res && res.ok === true ? Number(res.z) : NaN;
    if (!Number.isFinite(zVal)) {
      const msg =
        (res && (res.message || (typeof res.detail === "string" ? res.detail : ""))) || "응답에 Z 없음";
      return { ok: false, message: String(msg).slice(0, 200) };
    }
    return { ok: true, z: zVal, x: chosen.x, y: chosen.y };
  }

  function buildCircleMapByPile(circles) {
    const map = new Map();
    (circles || []).forEach((c) => {
      const key = normalizePileNumber(c.matched_text?.text);
      if (!key) return;
      if (!map.has(key)) map.set(key, c);
    });
    return map;
  }

  /** circle.id → 원 객체 (동일 파일번호가 여러 원일 때 pileNorm 맵만으로는 부족함) */
  function buildCircleMapById(circles) {
    const map = new Map();
    (circles || []).forEach((c) => {
      if (c?.id == null) return;
      map.set(String(c.id), c);
    });
    return map;
  }

  function circleForComparePoint(p, circleById, circleByPile) {
    if (p?.circleId != null) {
      const hit = circleById.get(String(p.circleId));
      if (hit) return hit;
    }
    if (p?.pileNorm) return circleByPile.get(p.pileNorm) || null;
    return null;
  }

  function buildMappingByCircleId(dashboard) {
    const m = new Map();
    const rows = dashboard?.mapping?.circleMappings || [];
    rows.forEach((row) => {
      const cidRaw =
        row?.circleId ??
        row?.circle_id ??
        row?.circleID ??
        row?.circle_id_str ??
        row?.circleIdStr ??
        row?.id;
      if (cidRaw != null && String(cidRaw).trim() !== "") {
        m.set(String(cidRaw), row);
      }
    });
    return m;
  }

  /** 동·레이어(지하주차장 등) 구역 키 — 표·요약에서 탭으로 구분 후 표시 시 " · " 로 치환 */
  function meissaZoneKeyFromCircle(c) {
    const b = String(c?.building_name ?? "").trim() || "(동 미지정)";
    const lyr = String(c?.layer ?? "").trim() || "(층·레이어)";
    return `${b}\t${lyr}`;
  }

  /**
   * 대시보드 매핑 행이 시공으로 Meissa Z 조회할지.
   * status가 pending이면 명시 미시공.
   * 그 외: installed 이거나, 시공일·관입·천공·잔량 중 하나라도 있으면 시공(PDAM에 잔량만 비어 있는 경우 포함).
   */
  function isPdamCircleMappingInstalled(row) {
    if (!row || typeof row !== "object") return false;
    const st = String(row.status ?? row.mappingStatus ?? row.mapping_status ?? "").trim().toLowerCase();
    if (st === "installed" || st === "complete" || st === "done") return true;
    if (st === "pending") return false;
    const dateStr =
      row.constructionDate != null
        ? String(row.constructionDate).trim()
        : row.construction_date != null
          ? String(row.construction_date).trim()
          : "";
    const hasDate = dateStr !== "";
    const remRaw = row.pileRemaining ?? row.pile_remaining ?? row.remain ?? row.remaining;
    const hasRem = remRaw != null && String(remRaw).trim() !== "";
    const penRaw = row.penetrationDepth ?? row.penetration_depth ?? row.penetration;
    const hasPen = penRaw != null && String(penRaw).trim() !== "" && Number.isFinite(Number(penRaw));
    const boreRaw = row.boringDepth ?? row.boring_depth ?? row.boring;
    const hasBore = boreRaw != null && String(boreRaw).trim() !== "" && Number.isFinite(Number(boreRaw));
    if (hasDate) return true;
    if (hasPen || hasBore) return true;
    return hasRem;
  }

  function pointNeedsMeissaZFetch(p, circleByPile, pdamMap, circleById) {
    const cidMap = circleById && typeof circleById.get === "function" ? circleById : new Map();
    const c = circleForComparePoint(p, cidMap, circleByPile);
    if (!c) return false;
    const row = pdamMap.get(String(c.id));
    return isPdamCircleMappingInstalled(row);
  }

  /** Meissa Z 열·툴팁용: API 실패·미시공 스킵 등 */
  function meissaZFetchNoteFromResponse(mzResp, mzOk) {
    if (mzOk) return "";
    if (!mzResp || typeof mzResp !== "object") return "";
    const code = String(mzResp.message || "").trim();
    if (code === "skipped-not-installed") {
      return "PDAM이 시공 완료(installed)가 아니어서 Meissa Z 조회를 하지 않았습니다.";
    }
    const d = mzResp.detail;
    if (typeof d === "string" && d.trim()) return d.trim().slice(0, 280);
    if (code) return code.slice(0, 280);
    return "Meissa Z 조회 실패(응답 없음 또는 ok 아님)";
  }

  function zFetchPriority(p, circleByPile, pdamMap, circleById) {
    const cidMap = circleById && typeof circleById.get === "function" ? circleById : new Map();
    const c = circleForComparePoint(p, cidMap, circleByPile);
    if (!c) return 50;
    const row = pdamMap.get(String(c.id));
    if (!isPdamCircleMappingInstalled(row)) return 40;
    const rem = parseNumber(row?.pileRemaining);
    if (Number.isFinite(rem) && rem <= 1e-6) return 0;
    return 10;
  }

  function sortComparePointsForZFetch(pts, circleByPile, pdamMap, circleById) {
    return [...pts].sort(
      (a, b) =>
        zFetchPriority(a, circleByPile, pdamMap, circleById) -
        zFetchPriority(b, circleByPile, pdamMap, circleById)
    );
  }

  function computeMeissaZoneRefZByZone(records) {
    const byZone = new Map();
    records.forEach((r) => {
      const zk = String(r.zoneKey || "");
      if (!byZone.has(zk)) byZone.set(zk, []);
      byZone.get(zk).push(r);
    });
    const ref = new Map();
    for (const [zk, list] of byZone) {
      const zeroRemZ = list
        .filter(
          (r) =>
            r.pdamStatus === "installed" &&
            r.pileRemaining != null &&
            Math.abs(Number(r.pileRemaining)) < 1e-5 &&
            r.meissaZ != null &&
            Number.isFinite(Number(r.meissaZ))
        )
        .map((r) => Number(r.meissaZ));
      let m = median(zeroRemZ);
      if (m == null) {
        const anyZ = list
          .filter((r) => r.pdamStatus === "installed" && r.meissaZ != null && Number.isFinite(Number(r.meissaZ)))
          .map((r) => Number(r.meissaZ));
        m = median(anyZ);
      }
      ref.set(zk, m);
    }
    return ref;
  }

  function enrichCompareRecordsZoneAndResidual(records) {
    const refMap = computeMeissaZoneRefZByZone(records);
    const residuals = [];
    const out = records.map((r) => {
      const zk = String(r.zoneKey || "");
      const refZ = refMap.get(zk);
      let meissaZoneResidual = null;
      let pdamZVsPeersHint = null;
      if (r.pdamStatus === "installed" && r.meissaZ != null && refZ != null && Number.isFinite(Number(refZ))) {
        meissaZoneResidual = Math.abs(Number(r.meissaZ) - Number(refZ));
        residuals.push(meissaZoneResidual);
      }
      const rem = r.pileRemaining != null ? Number(r.pileRemaining) : NaN;
      if (
        r.pdamStatus === "installed" &&
        Number.isFinite(rem) &&
        rem >= 0.5 &&
        meissaZoneResidual != null &&
        meissaZoneResidual < 0.15
      ) {
        pdamZVsPeersHint = "잔량↑인데 구역 Meissa Z는 기준과 유사 → PDAM 잔량 입력 의심";
      } else if (
        r.pdamStatus === "installed" &&
        Number.isFinite(rem) &&
        Math.abs(rem) < 1e-5 &&
        meissaZoneResidual != null &&
        meissaZoneResidual > 0.25
      ) {
        pdamZVsPeersHint = "잔량0인데 동일 구역 Meissa Z와 차이 큼 → PDAM/도면원·층 정보 의심";
      }
      return { ...r, meissaZoneResidual, pdamZVsPeersHint, meissaZoneRefZ: refZ };
    });
    const lo = residuals.length ? Math.min(...residuals) : 0;
    const hi = residuals.length ? Math.max(...residuals) : 1;
    if (hi - lo < 1e-6) {
      state.meissaZoneResidualExtent = [Math.max(0, lo - 0.05), lo + 0.25];
    } else {
      state.meissaZoneResidualExtent = [lo, hi];
    }
    return out;
  }

  /** 구역별 잔량0 Meissa Z 요약은 UI에서 숨김(비교 로직·표는 그대로). */
  function renderMeissaZoneZSummary() {
    const el = els.meissaZoneZSummary;
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
  }

  function meissaNormResidual01(v, extent) {
    const ex = extent || state.meissaZoneResidualExtent;
    if (!ex || !Number.isFinite(v)) return 0.5;
    const lo = Number(ex[0]);
    const hi = Number(ex[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return 0.5;
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  }

  /** @returns {"severe"|"medium"|"similar"|"other"} */
  function meissaCompareDeltaTier(r) {
    if (String(r?.pdamStatus || "") !== "installed") return "other";
    if (r?.meissaZ == null || !Number.isFinite(Number(r.meissaZ))) return "other";
    const res = r?.meissaZoneResidual != null ? Number(r.meissaZoneResidual) : NaN;
    if (!Number.isFinite(res)) return "other";
    const t = meissaNormResidual01(res, state.meissaZoneResidualExtent);
    if (t < 1 / 3) return "similar";
    if (t < 2 / 3) return "medium";
    return "severe";
  }

  function meissaCompareTierRank(tier) {
    if (tier === "severe") return 3;
    if (tier === "medium") return 2;
    if (tier === "similar") return 1;
    return 0;
  }

  /**
   * 이번 비교에서 구역 대비 |ΔZ|를 정규화(표·2D mz_zone과 동일 extent)해 하·중·상 3분위로 건수 요약.
   */
  function renderMeissaCompareTierSummary(records) {
    const el = els.meissaCompareTierSummary;
    const wrap = els.meissaTierFiltersWrap;
    if (!el) return;
    if (!records?.length) {
      el.textContent = "";
      el.hidden = true;
      if (wrap) wrap.hidden = true;
      return;
    }
    let similar = 0;
    let medium = 0;
    let severe = 0;
    let other = 0;
    for (const r of records) {
      const tier = meissaCompareDeltaTier(r);
      if (tier === "similar") similar += 1;
      else if (tier === "medium") medium += 1;
      else if (tier === "severe") severe += 1;
      else other += 1;
    }
    el.hidden = false;
    el.textContent = `|ΔZ| 군집(이번 계산 구간 기준): 심각 ${severe}건 · 중간 ${medium}건 · 유사 ${similar}건 · 그 외 ${other}건(미시공·Meissa Z 없음·구역 기준 없음 등)`;
    if (wrap) wrap.hidden = false;
    syncMeissaTierFilterUiFromState();
  }

  function meissaZoneLabelPretty(zoneKey) {
    const s = String(zoneKey || "").trim();
    return s ? s.replace(/\t/g, " · ") : "—";
  }

  /** 비교 결과 표 행 배경: 미시공=회색, 시공+Meissa Z 있으면 구역 대비 |ΔZ|에 따라 녹→적 틴트 */
  function meissaCompareResultRowBackground(r) {
    const st = String(r?.pdamStatus || "");
    if (st !== "installed") return "rgba(148, 163, 184, 0.38)";
    const mz = r?.meissaZ != null ? Number(r.meissaZ) : NaN;
    if (!Number.isFinite(mz)) return "rgba(226, 232, 240, 0.65)";
    const res = r?.meissaZoneResidual != null ? Number(r.meissaZoneResidual) : NaN;
    if (!Number.isFinite(res)) return "rgba(241, 245, 249, 0.95)";
    const t = meissaNormResidual01(res, state.meissaZoneResidualExtent);
    const [cr, cg, cb] = meissaHeatRgb01(t);
    return `rgba(${Math.round(cr * 255)}, ${Math.round(cg * 255)}, ${Math.round(cb * 255)}, 0.4)`;
  }

  /** 구역 내 표시 순서: 검토 힌트 → |ΔZ| 큰 시공 → Z 없음 → 정상 → 미시공(맨 뒤) */
  function meissaCompareProblemScore(r) {
    const st = String(r?.pdamStatus || "");
    const hint = String(r?.pdamZVsPeersHint || "").trim();
    const res =
      r?.meissaZoneResidual != null && Number.isFinite(Number(r.meissaZoneResidual))
        ? Number(r.meissaZoneResidual)
        : null;
    const hasMz = r?.meissaZ != null && Number.isFinite(Number(r.meissaZ));

    if (st !== "installed") return -1;

    if (hint) return 1_000_000 + (res != null ? res * 100_000 : 0);

    if (res != null) return 100_000 + res * 10_000;

    if (!hasMz) return 50_000;

    return 0;
  }

  /** 심각→중간→유사→그 외 우선, 그다음 문제 점수·동·구역·파일번호 */
  function meissaSortRecordsForResultTable(records) {
    return [...(records || [])].sort((a, b) => {
      const ta = meissaCompareDeltaTier(a);
      const tb = meissaCompareDeltaTier(b);
      const ra = meissaCompareTierRank(ta);
      const rb = meissaCompareTierRank(tb);
      if (rb !== ra) return rb - ra;

      const sa = meissaCompareProblemScore(a);
      const sb = meissaCompareProblemScore(b);
      if (sb !== sa) return sb - sa;

      const za = String(a.zoneKey ?? "");
      const zb = String(b.zoneKey ?? "");
      const zc = za.localeCompare(zb, "ko");
      if (zc !== 0) return zc;

      return String(a.pileRaw ?? "").localeCompare(String(b.pileRaw ?? ""), "ko", { numeric: true });
    });
  }

  const MEISSA_RESULT_TABLE_COLSPAN = 16;

  function meissaSwitchColorModeToMzZone() {
    if (!els.meissa3dColorMode) return;
    els.meissa3dColorMode.value = "mz_zone";
    syncMeissaLegendRowVisibility();
    scheduleRenderMeissa2dPointsOverlay();
    void refreshMeissa3d();
  }

  function readMeissaTierFilters() {
    return { ...meissaTierFilterState };
  }

  function syncMeissaTierFilterUiFromState() {
    document.querySelectorAll("#meissa-tier-filters").forEach((w) => {
      if (!w) return;
      w.querySelectorAll('input[type="checkbox"][data-meissa-tier]').forEach((inp) => {
        const k = inp.getAttribute("data-meissa-tier");
        if (k && Object.prototype.hasOwnProperty.call(meissaTierFilterState, k)) {
          inp.checked = !!meissaTierFilterState[k];
        }
      });
    });
  }

  function onMeissaTierFilterInputChange(ev) {
    const inp = ev.target;
    if (!inp || inp.type !== "checkbox") return;
    const k = inp.getAttribute("data-meissa-tier");
    if (!k || !Object.prototype.hasOwnProperty.call(meissaTierFilterState, k)) return;
    meissaTierFilterState[k] = !!inp.checked;
    syncMeissaTierFilterUiFromState();
    meissaSwitchColorModeToMzZone();
    refreshMeissaResultTable();
    scheduleRenderMeissa2dPointsOverlay();
  }

  function renderMeissaCompareResultRows(enrichedRecords, circleByPile) {
    const frag = document.createDocumentFragment();
    const filters = readMeissaTierFilters();
    const sorted = meissaSortRecordsForResultTable(enrichedRecords);
    const filtered = sorted.filter((rec) => filters[meissaCompareDeltaTier(rec)]);
    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = MEISSA_RESULT_TABLE_COLSPAN;
      td.className = "meissa-note";
      td.textContent = "선택한 필터에 맞는 행이 없습니다.";
      tr.appendChild(td);
      frag.appendChild(tr);
      return frag;
    }
    for (const rec of filtered) {
      const pileNorm = normalizePileNumber(String(rec.pileRaw || ""));
      let circle = null;
      if (rec.circleId != null) {
        const id = String(rec.circleId);
        for (const c of state.circles || []) {
          if (String(c?.id) === id) {
            circle = c;
            break;
          }
        }
      }
      if (!circle && pileNorm) circle = circleByPile.get(pileNorm);
      const cx = circle ? circle.center_x : "";
      const cy = circle ? circle.center_y : "";
      const planNum = rec.planD != null && Number.isFinite(Number(rec.planD)) ? Number(rec.planD) : null;
      const planDStr =
        planNum != null ? planNum.toFixed(3) : circle ? "0" : "-";
      const mapRow = rec.circleId != null ? state.pdamByCircleId?.get?.(String(rec.circleId)) : null;
      const rx = rec.x != null && Number.isFinite(Number(rec.x)) ? Number(rec.x) : null;
      const ry = rec.y != null && Number.isFinite(Number(rec.y)) ? Number(rec.y) : null;
      const rz = rec.z != null && Number.isFinite(Number(rec.z)) ? Number(rec.z) : null;

      const tr = document.createElement("tr");
      tr.classList.add("meissa-result-data-row");
      tr.style.background = meissaCompareResultRowBackground(rec);
      const fileFx =
        circle && Number.isFinite(Number(circle.center_x)) ? Number(circle.center_x) : null;
      const fileFy =
        circle && Number.isFinite(Number(circle.center_y)) ? Number(circle.center_y) : null;
      const fxUse =
        fileFx != null && fileFy != null
          ? fileFx
          : rx != null && ry != null && Number.isFinite(Number(rx)) && Number.isFinite(Number(ry))
            ? Number(rx)
            : NaN;
      const fyUse =
        fileFx != null && fileFy != null
          ? fileFy
          : rx != null && ry != null && Number.isFinite(Number(rx)) && Number.isFinite(Number(ry))
            ? Number(ry)
            : NaN;
      if (Number.isFinite(fxUse) && Number.isFinite(fyUse)) {
        tr.dataset.fileX = String(fxUse);
        tr.dataset.fileY = String(fyUse);
      }
      const cidForRow = circle?.id != null ? String(circle.id) : rec.circleId != null ? String(rec.circleId) : "";
      if (cidForRow) tr.dataset.meissaCircleId = cidForRow;
      const mzZ = rec.meissaZ != null && Number.isFinite(Number(rec.meissaZ)) ? Number(rec.meissaZ) : null;
      const mzDist = rec.meissaZDist != null && Number.isFinite(Number(rec.meissaZDist)) ? Number(rec.meissaZDist) : null;
      const refZ = rec.meissaZoneRefZ != null && Number.isFinite(Number(rec.meissaZoneRefZ)) ? Number(rec.meissaZoneRefZ) : null;
      const dZ =
        rec.meissaZoneResidual != null && Number.isFinite(Number(rec.meissaZoneResidual))
          ? Number(rec.meissaZoneResidual)
          : null;
      const hint = String(rec.pdamZVsPeersHint || "").trim();

      const cells = [
        meissaZoneLabelPretty(rec.zoneKey),
        rec.pileRaw ?? "",
        rx != null && Number.isFinite(Number(rx)) ? fmt(Number(rx)) : "-",
        ry != null && Number.isFinite(Number(ry)) ? fmt(Number(ry)) : "-",
        rz != null && Number.isFinite(Number(rz)) ? fmt(Number(rz)) : "-",
        circle ? fmt(cx) : "-",
        circle ? fmt(cy) : "-",
        planDStr,
        mzZ != null ? fmt(mzZ) : "-",
        mzDist != null ? fmt(mzDist) : "-",
        refZ != null ? fmt(refZ) : "-",
        dZ != null ? fmt(dZ) : "-",
        mapRow?.pileRemaining != null ? fmt(mapRow.pileRemaining) : rec.pileRemaining != null ? fmt(rec.pileRemaining) : "-",
        hint || "—",
        mapRow?.constructionDate || "-",
        rec.circleId != null ? String(rec.circleId) : "-",
      ];
      const meissaZColIdx = 8;
      cells.forEach((html, i) => {
        const td = document.createElement("td");
        td.className = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(i) ? "num" : "";
        td.textContent = html;
        if (i === meissaZColIdx) {
          const parts = [];
          if (rec.meissaZFetchNote) parts.push(rec.meissaZFetchNote);
          if (mzDist != null) parts.push(`평면거리(샘플) ${fmt(mzDist)} m`);
          td.title = parts.join("\n") || "";
        }
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    }
    return frag;
  }

  function refreshMeissaResultTable() {
    if (!els.resultBody) return;
    const recs = state.lastCompareRecords;
    if (!Array.isArray(recs) || !recs.length) return;
    const circleByPile = buildCircleMapByPile(state.circles);
    const frag = renderMeissaCompareResultRows(recs, circleByPile);
    els.resultBody.innerHTML = "";
    els.resultBody.appendChild(frag);
  }

  function meissaApplyFocusFromCompareTableRow(tr) {
    if (!tr || !tr.classList.contains("meissa-result-data-row")) return;
    meissaSwitchColorModeToMzZone();
    const cid = tr.dataset.meissaCircleId || "";
    if (cid) meissaInboundFocus = { circleId: cid, until: Date.now() + 16000 };
    const fx = parseFloat(tr.dataset.fileX || "");
    const fy = parseFloat(tr.dataset.fileY || "");
    if (Number.isFinite(fx) && Number.isFinite(fy)) meissa2dFocusOnFileCoord(fx, fy, {});
    else scheduleRenderMeissa2dPointsOverlay();
  }

  function bindMeissaResultTableClick() {
    if (!els.resultBody || els.resultBody.dataset.meissaRowClickBound === "1") return;
    els.resultBody.dataset.meissaRowClickBound = "1";
    els.resultBody.addEventListener("click", (ev) => {
      const tr = ev.target?.closest?.("tr.meissa-result-data-row");
      if (!tr) return;
      meissaApplyFocusFromCompareTableRow(tr);
    });
  }

  function meissaHeatRgb01(t) {
    const u = Math.max(0, Math.min(1, Number(t) || 0));
    const lerp = (a, b, x) => a + (b - a) * x;
    const gr = 0.13;
    const gg = 0.73;
    const gb = 0.33;
    const yr = 0.92;
    const yg = 0.7;
    const yb = 0.03;
    const rr = 0.94;
    const rg = 0.27;
    const rb = 0.27;
    if (u < 0.5) {
      const k = u * 2;
      return [lerp(gr, yr, k), lerp(gg, yg, k), lerp(gb, yb, k)];
    }
    const k = (u - 0.5) * 2;
    return [lerp(yr, rr, k), lerp(yg, rg, k), lerp(yb, rb, k)];
  }

  function meissa2dClearPickHits() {
    meissa2dPickHits = [];
  }

  function meissa2dColorModeValue() {
    const v = (els.meissa3dColorMode?.value || "remaining").trim();
    return v === "plan_dev" ? "ortho_pdam" : v;
  }

  function meissaRemainingMinFilterNumber() {
    const el = els.meissaRemainingMinFilter;
    if (!el) return null;
    const v = String(el.value || "").trim();
    if (v === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  /** 평면비교 패널: OK(녹)·큰 이탈(적) 임계값(m). 비교 표의 planD(평면 편차)와 함께 쓴다. */
  function meissaPlanDeviationThresholds() {
    const okEl = document.getElementById("meissa-plan-dev-ok-m");
    const badEl = document.getElementById("meissa-plan-dev-bad-m");
    let okM = okEl ? parseFloat(String(okEl.value || "").trim()) : NaN;
    let badM = badEl ? parseFloat(String(badEl.value || "").trim()) : NaN;
    if (!Number.isFinite(okM) || okM < 0) okM = 0.15;
    if (!Number.isFinite(badM) || badM < 0) badM = 0.35;
    if (badM <= okM) badM = okM + 0.05;
    return { okM, badM };
  }

  function meissaOrthoPdamCancelPrefetch() {
    meissaOrthoPdamPrefetchQueue.length = 0;
    meissaOrthoPdamQueuedIds.clear();
    if (meissaOrthoPdamIdleCallbackId) {
      const c = window.cancelIdleCallback || window.clearTimeout;
      c(meissaOrthoPdamIdleCallbackId);
      meissaOrthoPdamIdleCallbackId = 0;
    }
    if (meissaOrthoPdamOverlayFlushRaf) {
      cancelAnimationFrame(meissaOrthoPdamOverlayFlushRaf);
      meissaOrthoPdamOverlayFlushRaf = 0;
    }
  }

  function meissaFindCircleById(cid) {
    const list = Array.isArray(state.circles) ? state.circles : [];
    const want = String(cid ?? "");
    for (let i = 0; i < list.length; i++) {
      if (String(list[i]?.id ?? "") === want) return list[i];
    }
    return null;
  }

  function bumpMeissa2dOrthoRgbFitCache() {
    meissaOrthoPdamCancelPrefetch();
    meissa2dOrthoRgbFitCacheGen++;
    meissa2dOrthoRgbFitCache.clear();
    meissaOrthoAnalyzeDebugTail = [];
    renderMeissaOrthoAnalyzeDebugPanel();
  }

  /** UI: 더 작은 패치·조금 거친 격자(속도 우선, 정확도는 다소 희생). */
  function meissa2dOrthoFastModeFromUi() {
    const el = document.getElementById("meissa-ortho-fast-mode");
    if (el) return Boolean(el.checked);
    return false;
  }

  /** UI: 정사·시공 적합도 모드에서 도면 중심 ↔ RGB 추정 중심 디버그 선. */
  function meissaOrthoPdamDebugLineFromUi() {
    const el = document.getElementById("meissa-ortho-pdam-debug-line");
    if (el) return Boolean(el.checked);
    return false;
  }

  /** 정사 패치에서 기대하는 말뚝(어두운 코어·비교적 밝은 링) 대비 최소 링−코어 명암차(0~255). */
  function meissa2dOrthoMinDeltaFromUi() {
    const el = document.getElementById("meissa-ortho-delta-min");
    const n = el ? parseFloat(String(el.value || "").trim()) : NaN;
    if (!Number.isFinite(n) || n < 0) return 22;
    return Math.min(90, n);
  }

  /** m 단위 오프셋 표시: 아주 작을 때 toFixed(3)이 전부 0.000으로 보이는 문제 완화 */
  function meissaOrthoFormatOffsetM(m) {
    if (m == null || !Number.isFinite(m)) return "—";
    const a = Math.abs(m);
    if (a < 0.015) return `${m.toFixed(4)}`;
    return `${m.toFixed(3)}`;
  }

  /** localStorage `meissaOrthoDiag`=`1` 일 때만: 미판정·약신뢰 원인을 `window.__MEISSA_ORTHO_DIAG`에 누적(최대 100건). */
  function meissa2dOrthoDiagPush(entry) {
    try {
      if (typeof localStorage === "undefined" || localStorage.getItem("meissaOrthoDiag") !== "1") return;
      const a = (window.__MEISSA_ORTHO_DIAG = window.__MEISSA_ORTHO_DIAG || []);
      a.push({ t: Date.now(), ...entry });
      if (a.length > 100) a.splice(0, a.length - 100);
    } catch (_) {}
  }

  /** 정사 추정 말뚝 중심 vs 도면 중심 오프셋(m) 구간 — 녹/노/주황/적. */
  function meissaOrthoImageOffsetThresholdsM() {
    const gEl = document.getElementById("meissa-ortho-off-green-m");
    const yEl = document.getElementById("meissa-ortho-off-yellow-m");
    const oEl = document.getElementById("meissa-ortho-off-orange-m");
    let gM = gEl ? parseFloat(String(gEl.value || "").trim()) : NaN;
    let yM = yEl ? parseFloat(String(yEl.value || "").trim()) : NaN;
    let oM = oEl ? parseFloat(String(oEl.value || "").trim()) : NaN;
    if (!Number.isFinite(gM) || gM < 0) gM = 0.07;
    if (!Number.isFinite(yM) || yM < 0) yM = 0.15;
    if (!Number.isFinite(oM) || oM < 0) oM = 0.3;
    if (yM <= gM) yM = gM + 0.04;
    if (oM <= yM) oM = yM + 0.06;
    return { greenM: gM, yellowM: yM, orangeM: oM };
  }

  /**
   * georef bbox span + 해당 geo 객체(같은 스냅샷 키 우선, 없으면 프로젝트 내 첫 유효 키).
   * @returns {{ span: { spanX: number, spanY: number }, geo: Record<string, unknown> } | null}
   */
  function meissa2dGeorefSpanGeoPairAny(projectId, sid) {
    const pid = String(projectId || "").trim();
    const sids = String(sid || "").trim();
    const pick = (snapKey) => {
      const geo = meissa2dGeorefBySnapshot[snapKey];
      const bb = geo?.bbox;
      if (!bb) return null;
      const minX = Number(bb.minX);
      const minY = Number(bb.minY);
      const maxX = Number(bb.maxX);
      const maxY = Number(bb.maxY);
      if (!(maxX > minX && maxY > minY)) return null;
      return { span: { spanX: maxX - minX, spanY: maxY - minY }, geo };
    };
    if (pid && sids) {
      const a = pick(`${pid}:${sids}`);
      if (a) return a;
    }
    if (!pid) return null;
    const pref = `${pid}:`;
    for (const k of Object.keys(meissa2dGeorefBySnapshot)) {
      if (!k.startsWith(pref)) continue;
      const a = pick(k);
      if (a) return a;
    }
    return null;
  }

  function meissa2dGeorefSpanMeters(projectId, sid) {
    const p = meissa2dGeorefSpanGeoPairAny(projectId, sid);
    return p ? p.span : null;
  }

  /** 스냅샷 id 불일치 등으로 span 이 비어도, 같은 프로젝트의 다른 georef 키에서 bbox span 을 찾는다. */
  function meissa2dGeorefSpanMetersAny(projectId, sid) {
    return meissa2dGeorefSpanMeters(projectId, sid);
  }

  /**
   * PDAM 정사 오프셋(m)용: 평면 좌표계는 bbox 단위가 이미 m, EPSG:4326(또는 경위도 추정 bbox)은 span을 m 로 환산.
   * 기존에는 도 단위 span을 m 로 착각해 픽셀은 맞는데 offsetM 만 ~0 이 되는 경우가 있었음.
   */
  function meissa2dGeorefSpanWorldMetersAny(projectId, sid) {
    const p = meissa2dGeorefSpanGeoPairAny(projectId, sid);
    if (!p) return null;
    const { span, geo } = p;
    const bb = geo?.bbox;
    if (!bb) return span;
    const rawCrs = normalizeEpsgString(geo?.crs || geo?.projection || "");
    const inferredLatLon =
      Math.abs(Number(bb.minX)) <= 180 &&
      Math.abs(Number(bb.maxX)) <= 180 &&
      Math.abs(Number(bb.minY)) <= 90 &&
      Math.abs(Number(bb.maxY)) <= 90;
    const is4326 = rawCrs === "EPSG:4326" || (!rawCrs && inferredLatLon);
    if (is4326) {
      const lat0 = (Number(bb.minY) + Number(bb.maxY)) * 0.5;
      const rad = (lat0 * Math.PI) / 180;
      const cosLat = Math.min(1, Math.max(0.05, Math.cos(rad)));
      const mPerDegLat = 111320;
      const mPerDegLon = 111320 * cosLat;
      return { spanX: span.spanX * mPerDegLon, spanY: span.spanY * mPerDegLat };
    }
    return span;
  }

  /** 정사·시공 적합도 계산용: UI 오프셋(X,Y)을 파일 좌표에 반영 */
  function meissa2dReadOffsetXY() {
    const ox = parseNumber(els.offsetX?.value) || 0;
    const oy = parseNumber(els.offsetY?.value) || 0;
    return { ox, oy };
  }

  function meissa2dCurrentProjectSnapshotKey() {
    const projectId = (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    if (!projectId || !sid) return "";
    return `${projectId}:${sid}`;
  }

  function meissa2dBuildAnalysisImageCandidates(projectId, sid) {
    const out = [];
    const seen = new Set();
    const push = (url, source) => {
      const s = String(url || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push({ url: s, source: String(source || "") });
    };
    if (!isMeissa2dButtonUrlOnlySingleMode()) {
      push(
        buildOrthophotoPreviewImgUrl(
          sid,
          projectId,
          meissaAccess,
          MEISSA_ORTHOPHOTO_PREVIEW_EDGE
        ),
        "preview"
      );
    }
    push(meissa2dRawUrlBySnapshot.get(String(sid || "").trim()), "raw-cache");
    push(els.meissaCloud2dImageLocal?.getAttribute?.("src"), "img-src");
    return out;
  }

  function meissa2dHasReadyOrthoAnalysisImage() {
    const key = meissa2dCurrentProjectSnapshotKey();
    return Boolean(
      key &&
        meissa2dOrthoAnalysisImage &&
        meissa2dOrthoAnalysisImageKey === key &&
        Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) > 8 &&
        Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) > 8
    );
  }

  /**
   * 이미 화면에 표시·디코드된 정사 이미지를 분석 소스로 우선 채택.
   * 분석용 재요청(CORS/서명만료) 실패로 계산이 멈추는 경우를 줄인다.
   */
  function meissa2dAdoptVisibleOrthoImageForAnalysis(key) {
    if (
      meissa2dOrthoAnalysisImage &&
      meissa2dOrthoAnalysisImageKey === key &&
      Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) > 8 &&
      Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) > 8
    ) {
      return true;
    }
    const imgEl = els.meissaCloud2dImageLocal;
    if (!imgEl) return false;
    if (!hasRenderableOverlayImage(imgEl)) return false;
    if (!useFullGeorefForOverlayImage(imgEl)) return false;
    const nw = Number(imgEl.naturalWidth || 0);
    const nh = Number(imgEl.naturalHeight || 0);
    if (nw <= 8 || nh <= 8) return false;
    if (meissa2dOrthoAnalysisImage === imgEl && meissa2dOrthoAnalysisImageKey === key) return true;
    meissa2dOrthoAnalysisImage = imgEl;
    meissa2dOrthoAnalysisImageKey = key;
    meissa2dOrthoAnalysisImageFailKey = "";
    meissa2dOrthoPatchImageSource = null;
    meissa2dOrthoAnalysisImageInFlight = false;
    bumpMeissa2dOrthoRgbFitCache();
    scheduleRenderMeissa2dPointsOverlay();
    scheduleMeissaOrthoOffsetPanelRefresh(120);
    return true;
  }

  /**
   * 분석용 이미지는 전체 원본 재다운로드 대신 preview(max_edge=3072) blob으로 고정.
   * 고해상 원본(예: 17k x 20k)을 다시 받아 분석 준비하는 비용/지연을 줄인다.
   */
  async function meissa2dPrimeAnalysisImageFromDisplayedSrc(reason) {
    const key = meissa2dCurrentProjectSnapshotKey();
    const imgEl = els.meissaCloud2dImageLocal;
    if (!key || !imgEl) return false;
    if (!hasRenderableOverlayImage(imgEl)) return false;
    if (!useFullGeorefForOverlayImage(imgEl)) return false;
    const srcShown = String(imgEl.currentSrc || imgEl.getAttribute("src") || "").trim();
    if (!srcShown) return false;
    if (srcShown.startsWith("blob:")) {
      return meissa2dAdoptVisibleOrthoImageForAnalysis(key);
    }
    const [projectId, sid] = key.split(":");
    if (!projectId || !sid || !meissaAccess) return false;
    const previewUrl = MEISSA_ORTHOPHOTO_USE_LEGACY_API_URL
      ? buildOrthophotoPreviewApiUrl(sid, projectId, MEISSA_ORTHOPHOTO_LEGACY_LOW_EDGE)
      : buildOrthophotoPreviewImgUrl(
          sid,
          projectId,
          meissaAccess,
          MEISSA_ORTHOPHOTO_PREVIEW_EDGE
        );
    if (!previewUrl) return false;
    const sig = `${key}|preview:${MEISSA_ORTHOPHOTO_PREVIEW_EDGE}`;
    if (
      meissa2dOrthoAnalysisPrimeSig === sig &&
      meissa2dOrthoAnalysisImage &&
      meissa2dOrthoAnalysisImageKey === key &&
      Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) > 8 &&
      Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) > 8
    ) {
      return true;
    }
    if (meissa2dOrthoAnalysisPrimeInFlight) return false;
    meissa2dOrthoAnalysisPrimeInFlight = true;
    try {
      const res = await fetchWithTimeout(
        previewUrl,
        MEISSA_ORTHOPHOTO_USE_LEGACY_API_URL
          ? { method: "GET", headers: { Authorization: `JWT ${meissaAccess}` } }
          : { method: "GET" },
        90000
      );
      if (!res || !res.ok) return false;
      const blob = await res.blob();
      if (!blob || Number(blob.size || 0) <= 32) return false;
      const im = await decodeBlobToImage(blob);
      if (!im || Number(im.naturalWidth || 0) <= 8 || Number(im.naturalHeight || 0) <= 8) return false;
      if (meissa2dCurrentProjectSnapshotKey() !== key) return false;
      meissa2dOrthoAnalysisImage = im;
      meissa2dOrthoAnalysisImageKey = key;
      meissa2dOrthoAnalysisImageFailKey = "";
      meissa2dOrthoPatchImageSource = null;
      meissa2dOrthoAnalysisImageInFlight = false;
      meissa2dOrthoAnalysisPrimeSig = sig;
      bumpMeissa2dOrthoRgbFitCache();
      scheduleRenderMeissa2dPointsOverlay();
      scheduleMeissaOrthoOffsetPanelRefresh(120);
      try {
        pushMeissa2dLoadLine(
          `정사 분석 소스 고정(preview-blob): ${im.naturalWidth}×${im.naturalHeight}${reason ? ` · ${reason}` : ""}`
        );
      } catch (_) {
        /* ignore */
      }
      return true;
    } catch (_) {
      try {
        pushMeissa2dLoadLine("정사 분석 소스 blob 고정 실패 — 현재 표시 이미지로 계속 시도");
      } catch (_) {
        /* ignore */
      }
      return false;
    } finally {
      meissa2dOrthoAnalysisPrimeInFlight = false;
    }
  }

  function meissa2dAdoptHiCanvasPatchSource(reason) {
    if (MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS) return false;
    const hi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
    if (!hi || hi.tagName !== "CANVAS") return false;
    try {
      const hctx = hi.getContext("2d");
      if (!hctx) return false;
      const t = hctx.getImageData(0, 0, 1, 1);
      if (!t || !t.data) return false;
      meissa2dOrthoPatchImageSource = hi;
      void reason;
      return true;
    } catch (_) {
      return false;
    }
  }

  function meissa2dEnsureOrthoAnalysisImage() {
    const key = meissa2dCurrentProjectSnapshotKey();
    if (!key) return;
    if (Date.now() - Number(meissa2dOrthoAnalysisImageLastFailTs || 0) < 1200) return;
    if (meissa2dAdoptVisibleOrthoImageForAnalysis(key)) return;
    if (!meissaAccess) return;
    if (meissa2dOrthoAnalysisImageInFlight) return;
    if (
      meissa2dOrthoAnalysisImage &&
      meissa2dOrthoAnalysisImageKey === key &&
      Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) > 8 &&
      Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) > 8
    ) {
      return;
    }
    const [projectId, sid] = key.split(":");
    if (!projectId || !sid) return;
    const candidates = meissa2dBuildAnalysisImageCandidates(projectId, sid);
    if (!candidates.length) return;
    meissa2dOrthoAnalysisImage = null;
    meissa2dOrthoAnalysisImageKey = "";
    meissa2dOrthoPatchImageSource = null;
    meissa2dOrthoAnalysisImageInFlight = true;
    const reqSeq = ++meissa2dOrthoAnalysisImageReqSeq;
    let idx = 0;
    const tryNext = () => {
      if (reqSeq !== meissa2dOrthoAnalysisImageReqSeq) return;
      if (meissa2dCurrentProjectSnapshotKey() !== key) {
        meissa2dOrthoAnalysisImageInFlight = false;
        return;
      }
      if (idx >= candidates.length) {
        meissa2dOrthoAnalysisImageInFlight = false;
        meissa2dOrthoAnalysisImageLastFailTs = Date.now();
        tryMeissa2dOrthoViewportHiPaintCachedSync();
        const hiAdopted = MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS
          ? false
          : meissa2dAdoptHiCanvasPatchSource("analysis-image-all-failed");
        if (meissa2dOrthoAnalysisImageFailKey !== key) {
          meissa2dOrthoAnalysisImageFailKey = key;
          try {
            pushMeissa2dLoadLine(
              hiAdopted
                ? "정사 분석용 이미지 로드 실패(CORS/URL) — hi-canvas 폴백으로 분석 재시도"
                : "정사 분석용 이미지 로드 실패(CORS/URL) — 미산출(imagedata) 가능"
            );
          } catch (_) {
            /* ignore */
          }
        }
        if (hiAdopted) {
          bumpMeissa2dOrthoRgbFitCache();
          scheduleRenderMeissa2dPointsOverlay();
          scheduleMeissaOrthoOffsetPanelRefresh(120);
        }
        return;
      }
      const cand = candidates[idx++];
      const im = new Image();
      if (!String(cand.url).startsWith("blob:")) im.crossOrigin = "anonymous";
      im.decoding = "async";
      im.onload = () => {
        if (reqSeq !== meissa2dOrthoAnalysisImageReqSeq) return;
        if (meissa2dCurrentProjectSnapshotKey() !== key) {
          meissa2dOrthoAnalysisImageInFlight = false;
          return;
        }
        if (Number(im.naturalWidth || 0) <= 8 || Number(im.naturalHeight || 0) <= 8) {
          tryNext();
          return;
        }
        meissa2dOrthoAnalysisImageInFlight = false;
        meissa2dOrthoAnalysisImage = im;
        meissa2dOrthoAnalysisImageKey = key;
        meissa2dOrthoAnalysisImageFailKey = "";
        bumpMeissa2dOrthoRgbFitCache();
        scheduleRenderMeissa2dPointsOverlay();
        scheduleMeissaOrthoOffsetPanelRefresh(120);
      };
      im.onerror = () => {
        if (reqSeq !== meissa2dOrthoAnalysisImageReqSeq) return;
        if (meissa2dCurrentProjectSnapshotKey() !== key) {
          meissa2dOrthoAnalysisImageInFlight = false;
          return;
        }
        tryNext();
      };
      im.src = cand.url;
    };
    tryNext();
  }

  function meissa2dPickUsablePatchImageSourceForAnalyze(nw, nh) {
    const src = meissa2dOrthoPatchImageSource;
    if (!src) return null;
    const sw = Math.max(1, Math.round(Number(src?.naturalWidth || src?.videoWidth || src?.width || 0)));
    const sh = Math.max(1, Math.round(Number(src?.naturalHeight || src?.videoHeight || src?.height || 0)));
    if (sw <= 8 || sh <= 8) return null;
    // 뷰포트 부분 캔버스(전체 정사보다 훨씬 작음)를 전체 natural 좌표로 오인해 크롭이 틀어지는 경우 방지.
    if (MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS) {
      const rw = sw / Math.max(1, nw);
      const rh = sh / Math.max(1, nh);
      if (rw < 0.94 || rh < 0.94) return null;
    }
    return src;
  }

  /**
   * georef 전역 bbox 기준: 도면 좌표 → 정사 래스터 자연 픽셀(중심 근사).
   * @returns {{ ix: number, iy: number, nw: number, nh: number, nx: number, ny: number } | null}
   */
  function fileCoordToOrthoNaturalPixel(fx, fy) {
    const projectId = (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const imgEl = els.meissaCloud2dImageLocal;
    const geo = meissa2dGeorefBySnapshot[`${projectId}:${sid}`];
    if (!projectId || !sid || !hasRenderableOverlayImage(imgEl) || !geo?.bbox) return null;
    if (!useFullGeorefForOverlayImage(imgEl)) return null;
    const minX = Number(geo.bbox.minX);
    const minY = Number(geo.bbox.minY);
    const maxX = Number(geo.bbox.maxX);
    const maxY = Number(geo.bbox.maxY);
    if (!(maxX > minX && maxY > minY)) return null;
    const { srcCrs, dstCrs } = resolveMeissa2dGeorefCrsPair(geo, projectId, sid);
    const baseX = Number(fx);
    const baseY = Number(fy);
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) return null;
    const { ox, oy } = meissa2dReadOffsetXY();
    const candidates = [{ wx: baseX + ox, wy: baseY + oy }];
    // 오프셋이 과대/오입력된 현장에서는 원좌표 재시도로 no-georef 전량 미산출을 피한다.
    if (Math.abs(ox) > 1e-9 || Math.abs(oy) > 1e-9) {
      candidates.push({ wx: baseX, wy: baseY });
    }
    let nx = NaN;
    let ny = NaN;
    let mapped = false;
    for (const cand of candidates) {
      let wx = Number(cand.wx);
      let wy = Number(cand.wy);
      if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;
      if (srcCrs !== dstCrs && ensureProj4Defs()) {
        try {
          const pp = window.proj4(srcCrs, dstCrs, [wx, wy]);
          wx = Number(pp?.[0]);
          wy = Number(pp?.[1]);
        } catch (_) {
          continue;
        }
      }
      const tx = (wx - minX) / (maxX - minX);
      const ty = (maxY - wy) / (maxY - minY);
      if (tx < -0.03 || tx > 1.03 || ty < -0.03 || ty > 1.03) continue;
      nx = tx;
      ny = ty;
      mapped = true;
      break;
    }
    if (!mapped) return null;
    const nw = Math.round(Number(imgEl.naturalWidth || 0));
    const nh = Math.round(Number(imgEl.naturalHeight || 0));
    if (nw <= 8 || nh <= 8) return null;
    const ix = nx * nw;
    const iy = ny * nh;
    return { ix, iy, nw, nh, nx, ny };
  }

  function ensureMeissa2dOrthoPatchCanvas() {
    if (!meissa2dOrthoPatchCanvas) {
      meissa2dOrthoPatchCanvas = document.createElement("canvas");
      meissa2dOrthoPatchCanvas.width = 400;
      meissa2dOrthoPatchCanvas.height = 400;
    }
    return meissa2dOrthoPatchCanvas;
  }

  /**
   * RGB 채도(max−min) + 휘도 링−코어 대비 + 링 반경 방사 샘플 분산(낮을수록 원대칭)으로 후보 점수.
   * 도면 원 근처 실제 말뚝(중공·캡) 동심원에 맞춤.
   */
  function meissa2dOrthoPileQualityLocal(lum, chroma, sw, sh, px, py, rCore, rRingIn, rRingOut) {
    const rm = rRingOut + 5;
    const x0 = Math.max(0, Math.floor(px - rm));
    const x1 = Math.min(sw - 1, Math.ceil(px + rm));
    const y0 = Math.max(0, Math.floor(py - rm));
    const y1 = Math.min(sh - 1, Math.ceil(py + rm));
    let sc = 0;
    let sr = 0;
    let scc = 0;
    let src = 0;
    let nc = 0;
    let nr = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * sw;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        const d = Math.hypot(dx, dy);
        const idx = row + x;
        const L = lum[idx];
        const c = chroma[idx];
        if (d <= rCore) {
          sc += L;
          scc += c;
          nc++;
        } else if (d >= rRingIn && d <= rRingOut) {
          sr += L;
          src += c;
          nr++;
        }
      }
    }
    if (!nc || !nr) return -Infinity;
    const dL = sr / nr - sc / nc;
    const dC = src / nr - scc / nc;
    const rMid = (rRingIn + rRingOut) * 0.5;
    const nang = 14;
    let sum = 0;
    let sum2 = 0;
    let ncirc = 0;
    for (let k = 0; k < nang; k++) {
      const ang = (k / nang) * Math.PI * 2;
      const xi = Math.floor(px + Math.cos(ang) * rMid);
      const yi = Math.floor(py + Math.sin(ang) * rMid);
      if (xi < 0 || yi < 0 || xi >= sw || yi >= sh) continue;
      const L = lum[yi * sw + xi];
      sum += L;
      sum2 += L * L;
      ncirc++;
    }
    if (ncirc < 6) return -Infinity;
    const vmu = sum / ncirc;
    const varL = Math.max(0, sum2 / ncirc - vmu * vmu);
    return dL + 0.1 * Math.min(40, Math.max(-40, dC)) - 0.042 * varL;
  }

  /** 링−코어 대비만 국소 윈도우에서 계산(조닝 탐색용). */
  function meissa2dOrthoRingCoreDeltaLocal(lum, sw, sh, px, py, rCore, rRingIn, rRingOut, clipOpt) {
    const rm = rRingOut + 5;
    const rCore2 = rCore * rCore;
    const rIn2 = rRingIn * rRingIn;
    const rOut2 = rRingOut * rRingOut;
    const x0 = Math.max(0, Math.floor(px - rm));
    const x1 = Math.min(sw - 1, Math.ceil(px + rm));
    const y0 = Math.max(0, Math.floor(py - rm));
    const y1 = Math.min(sh - 1, Math.ceil(py + rm));
    let sc = 0;
    let sr = 0;
    let nc = 0;
    let nr = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * sw;
      for (let x = x0; x <= x1; x++) {
        if (clipOpt) {
          const dxD = x + 0.5 - clipOpt.cx;
          const dyD = y + 0.5 - clipOpt.cy;
          if (dxD * dxD + dyD * dyD > clipOpt.r2) continue;
        }
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        const d2 = dx * dx + dy * dy;
        const L = lum[row + x];
        if (d2 <= rCore2) {
          sc += L;
          nc++;
        } else if (d2 >= rIn2 && d2 <= rOut2) {
          sr += L;
          nr++;
        }
      }
    }
    if (!nc || !nr) return -Infinity;
    return sr / nr - sc / nc;
  }

  function meissa2dOrthoMeanLumInDisk(lum, sw, sh, px, py, rMax) {
    const r2 = rMax * rMax;
    let s = 0;
    let n = 0;
    const x0 = Math.max(0, Math.floor(px - rMax - 1));
    const x1 = Math.min(sw - 1, Math.ceil(px + rMax + 1));
    const y0 = Math.max(0, Math.floor(py - rMax - 1));
    const y1 = Math.min(sh - 1, Math.ceil(py + rMax + 1));
    for (let y = y0; y <= y1; y++) {
      const row = y * sw;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        if (dx * dx + dy * dy <= r2) {
          s += lum[row + x];
          n++;
        }
      }
    }
    return n ? s / n : 0;
  }

  function meissa2dOrthoRingCoreDeltaAt(lum, sw, sh, px, py, rCore, rRingIn, rRingOut, clipOpt) {
    const d = meissa2dOrthoRingCoreDeltaLocal(lum, sw, sh, px, py, rCore, rRingIn, rRingOut, clipOpt);
    if (!Number.isFinite(d) || d === -Infinity) return { delta: null };
    return { delta: d };
  }

  /** 모드별 ±몇 픽셀 탐색으로 중심 정제(중공=링−코어 대비 최대, 밝은캡=원판 평균 휘도 최대). */
  function meissa2dOrthoRefineCentroid(lum, sw, sh, px0, py0, rCore, rRingIn, rRingOut, mode, refineOpts, clipOpt) {
    const rBright = Math.min(sw, sh) * 0.195;
    const big = Math.min(sw, sh) >= 110;
    const fastRf = Boolean(refineOpts?.fastOrtho);
    const rng =
      mode === "bright" ? 3 : fastRf ? (big ? 3 : 3) : big ? 4 : 4;
    let bestPx = px0;
    let bestPy = py0;
    let bestQ = -1e9;
    for (let oy = -rng; oy <= rng; oy++) {
      for (let ox = -rng; ox <= rng; ox++) {
        const px = px0 + ox;
        const py = py0 + oy;
        if (px < 0.5 || py < 0.5 || px > sw - 0.5 || py > sh - 0.5) continue;
        let q;
        if (mode === "bright") {
          q = meissa2dOrthoMeanLumInDisk(lum, sw, sh, px, py, rBright);
        } else {
          const dl = meissa2dOrthoRingCoreDeltaLocal(lum, sw, sh, px, py, rCore, rRingIn, rRingOut, clipOpt);
          q = Number.isFinite(dl) && dl > -1e6 ? dl : -1e8;
        }
        if (q > bestQ) {
          bestQ = q;
          bestPx = px;
          bestPy = py;
        }
      }
    }
    return { px: bestPx, py: bestPy, q: bestQ };
  }

  /** 휘도 히스토그램(256)으로 분위수 근사 — 전 패치 정렬 O(n log n) 대신 O(n+256). */
  function meissa2dOrthoHistQuantile(hist, n, q) {
    if (!Number.isFinite(n) || n <= 0) return 128;
    const qq = Math.max(0, Math.min(1, q));
    const k = Math.min(n - 1, Math.max(0, Math.floor((n - 1) * qq)));
    let acc = 0;
    for (let b = 0; b < 256; b++) {
      const c = hist[b];
      if (acc + c > k) return b + 0.5;
      acc += c;
    }
    return 254.5;
  }

  /** 국소 최암 주변 어두운 픽셀 가중 소중심 — 도면과 홈이 떨어져 있을 때 추정 중심 보강. */
  function meissa2dOrthoMicroCentroidDarkest(lum, sw, sh, px0, py0, rWin, locMinL, p38v) {
    const thr = Math.min(locMinL + 30, p38v + 16, 250);
    const r2 = rWin * rWin;
    let s = 0;
    let wx = 0;
    let wy = 0;
    const xi0 = Math.max(0, Math.floor(px0 - rWin - 1));
    const xi1 = Math.min(sw - 1, Math.ceil(px0 + rWin + 1));
    const yi0 = Math.max(0, Math.floor(py0 - rWin - 1));
    const yi1 = Math.min(sh - 1, Math.ceil(py0 + rWin + 1));
    for (let y = yi0; y <= yi1; y++) {
      const row = y * sw;
      for (let x = xi0; x <= xi1; x++) {
        const L = lum[row + x];
        if (L > thr) continue;
        const dx = x + 0.5 - px0;
        const dy = y + 0.5 - py0;
        if (dx * dx + dy * dy > r2) continue;
        const w = Math.max(0.05, (thr - L) / 48);
        s += w;
        wx += (x + 0.5) * w;
        wy += (y + 0.5) * w;
      }
    }
    if (s < 1e-6) return null;
    return { px: wx / s, py: wy / s };
  }

  /**
   * RGB: pctBright=S/765, pctDark=1-pctBright.
   * 1) 코어(어두운 원)·링(검은 코어를 두른 밝은 띠)을 반경으로 나눠 각각 날카로운 멱함수로 면적 합산.
   * 2) 코어 픽셀 가중 = 어두움^γ × (1 + k·정규화된 링 밝기) — 개기일식처럼 ‘암부+코로나’가 같이 있을 때만 강함.
   * 3) 코어 팔등분 최소/최대 비율로 상·하현달(한쪽만 어두움) 억제 후 설계 중심 쪽으로 블렌드.
   */
  function meissa2dOrthoRgbEclipseCentroid(data, sw, sh, cx, cy, rCore, rRingIn, rRingOut, rMax) {
    const rm = Math.max(4, Number(rMax) || 0);
    const r2m = rm * rm;
    const rCoreEff = Math.max(2, rCore * 1.12);
    const rCoreEff2 = rCoreEff * rCoreEff;
    const rTot2 = Math.min(rCore * 1.42, rRingIn * 1.08, rm * 0.97);
    const rTot22 = rTot2 * rTot2;
    const rInLo = Math.max(rCore * 0.82, rRingIn * 0.88);
    const rInLo2 = rInLo * rInLo;
    const rOutHi = Math.min(rRingOut * 1.08, rm * 0.99);
    const rOutHi2 = rOutHi * rOutHi;
    const gDark = 2.65;
    const gBright = 2.25;
    const tDark = 0.09;
    const tBright = 0.36;
    let sumRingW = 0;
    let nRing = 0;
    let sumCoreDarkW = 0;
    let nCore = 0;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2m) continue;
        const i4 = (row + x) * 4;
        const R = data[i4];
        const G = data[i4 + 1];
        const B = data[i4 + 2];
        const sum = R + G + B;
        const pctBright = sum / 765;
        const pctDark = 1 - pctBright;
        const mx = Math.max(R, Math.max(G, B)) / 255;
        const mn = Math.min(R, Math.min(G, B)) / 255;
        const sat = Math.max(0, mx - mn);
        const sharpD = Math.pow(Math.max(0, pctDark - tDark), gDark);
        const whiteRim = 0.58 + 0.42 * (1 - Math.min(1, sat * 1.2));
        const sharpB = Math.pow(Math.max(0, pctBright - tBright), gBright) * whiteRim;
        if (d2 >= rInLo2 && d2 <= rOutHi2) {
          sumRingW += sharpB;
          nRing++;
        }
        if (d2 <= rCoreEff2) {
          sumCoreDarkW += sharpD;
          nCore++;
        }
      }
    }
    const meanRing = nRing > 6 ? sumRingW / nRing : 0;
    const meanCoreD = nCore > 4 ? sumCoreDarkW / nCore : 0;
    const ringNorm = meanRing / (meanRing + 0.09);
    const coreNorm = meanCoreD / (meanCoreD + 0.07);
    const eclipseOverlap = Math.min(1, ringNorm * coreNorm * 1.15);
    const kEcl = 2.85;
    const overlapBoost = 0.55 + kEcl * eclipseOverlap;
    const sectorW = new Float32Array(8);
    let s = 0;
    let wx = 0;
    let wy = 0;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > rTot22) continue;
        const i4 = (row + x) * 4;
        const R = data[i4];
        const G = data[i4 + 1];
        const B = data[i4 + 2];
        const sum = R + G + B;
        const pctBright = sum / 765;
        const pctDark = 1 - pctBright;
        const mx = Math.max(R, Math.max(G, B)) / 255;
        const mn = Math.min(R, Math.min(G, B)) / 255;
        const sat = Math.max(0, mx - mn);
        const sharpD = Math.pow(Math.max(0, pctDark - tDark), gDark);
        const whiteRim = 0.58 + 0.42 * (1 - Math.min(1, sat * 1.2));
        const sharpB = Math.pow(Math.max(0, pctBright - tBright), gBright) * whiteRim;
        const contrast = Math.pow(Math.abs(pctDark - pctBright), 1.15);
        let w = sharpD * overlapBoost * (0.72 + 1.55 * contrast);
        if (d2 >= rInLo2 && d2 <= rOutHi2) w += sharpB * 0.22 * eclipseOverlap;
        if (w < 1e-9) continue;
        s += w;
        wx += (x + 0.5) * w;
        wy += (y + 0.5) * w;
        const ang = Math.atan2(dy, dx);
        const oct = ((Math.floor((ang + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8;
        sectorW[oct] += w;
      }
    }
    if (s < 1e-8) return null;
    let px = wx / s;
    let py = wy / s;
    let minS = Infinity;
    let maxS = 0;
    for (let o = 0; o < 8; o++) {
      const v = sectorW[o];
      if (v < minS) minS = v;
      if (v > maxS) maxS = v;
    }
    const crescent = maxS > 1e-6 ? Math.min(1, (minS / maxS) * 2.45) : 1;
    const sym = Math.pow(Math.max(0.22, crescent), 1.15);
    px = sym * px + (1 - sym) * cx;
    py = sym * py + (1 - sym) * cy;
    return {
      px,
      py,
      weightSum: s,
      eclipseOverlap,
      sym,
    };
  }

  /**
   * 도면 말뚝 반경(파일 단위)을 정사 자연 픽셀 거리로 — 패치 좌표와 동일 스케일.
   */
  function meissa2dPileRadiusNaturalPx(circle) {
    const cx = Number(circle?.center_x);
    const cy = Number(circle?.center_y);
    const rad = meissa2dPileRadiusFileUnits(circle);
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(rad) || rad <= 1e-9) return NaN;
    const m0 = fileCoordToOrthoNaturalPixel(cx, cy);
    const mx = fileCoordToOrthoNaturalPixel(cx + rad, cy);
    const my = fileCoordToOrthoNaturalPixel(cx, cy + rad);
    if (!m0 || !mx || !my) return NaN;
    const rx = Math.hypot(mx.ix - m0.ix, mx.iy - m0.iy);
    const ry = Math.hypot(my.ix - m0.ix, my.iy - m0.iy);
    return (rx + ry) * 0.5;
  }

  /**
   * 도면 원(직경)과 실제 말뚝(암부+밝은 띠)의 ‘달/일식’ 겹침 지표.
   * 1) 원 안 휘도·RGB 비율(기존)
   * 2) 패치 전체 암부 덩어리 대비 “도면 원이 암부를 얼마나 덮는지”(초승달↔개기)
   * 3) 암부 가중 중심 주변 밝은 띠(링) 대비 “그 띠가 도면 원 안에 얼마나 들어오는지”
   */
  function meissa2dOrthoFootprintDiskOverlapStats(lum, rgbaData, sw, sh, cx, cy, rDisk, pLo, pHi, spread85v) {
    const r = Math.max(3, Number(rDisk) || 0);
    const r2 = r * r;
    const spr = Number.isFinite(spread85v) ? spread85v : 28;
    let darkThr = Math.min(122, pLo + 8 + Math.min(14, spr * 0.1));
    let brightThr = Math.max(128, pHi - 12 - Math.min(16, spr * 0.06));
    if (brightThr <= darkThr + 10) {
      const mid = (darkThr + brightThr) * 0.5;
      darkThr = mid - 12;
      brightThr = mid + 12;
    }
    let n = 0;
    let nDark = 0;
    let nBright = 0;
    let sumRgbDarkPct = 0;
    let nDarkPatch = 0;
    let nDarkInDisk = 0;
    let nRgbDarkPatch = 0;
    let nRgbDarkInDisk = 0;
    let swDark = 0;
    let wxD = 0;
    let wyD = 0;
    const rgbDarkThr = 0.44;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        const inDisk = d2 <= r2;
        const i = row + x;
        const L = lum[i];
        const i4 = i * 4;
        const srgb = rgbaData[i4] + rgbaData[i4 + 1] + rgbaData[i4 + 2];
        const pctB = srgb / 765;
        const rgbIsDark = pctB < rgbDarkThr;
        if (inDisk) {
          n++;
          sumRgbDarkPct += (1 - pctB) * 100;
          if (L <= darkThr) nDark++;
          else if (L >= brightThr) nBright++;
        }
        if (L <= darkThr) {
          nDarkPatch++;
          if (inDisk) nDarkInDisk++;
          const w = Math.max(0.15, darkThr - L);
          swDark += w;
          wxD += (x + 0.5) * w;
          wyD += (y + 0.5) * w;
        }
        if (rgbIsDark) {
          nRgbDarkPatch++;
          if (inDisk) nRgbDarkInDisk++;
        }
      }
    }
    if (n < 1) return null;
    const nMid = Math.max(0, n - nDark - nBright);
    const darkLumPct = (100 * nDark) / n;
    const brightLumPct = (100 * nBright) / n;
    const midLumPct = (100 * nMid) / n;
    const avgRgbDarkPct = sumRgbDarkPct / n;
    const geomOverlap = Math.sqrt(Math.max(0, darkLumPct) * Math.max(0, brightLumPct));
    const cxD = swDark > 1e-3 ? wxD / swDark : cx;
    const cyD = swDark > 1e-3 ? wyD / swDark : cy;
    const useDesignForRim = nDarkPatch < 16 || swDark < 2.5;
    const cxR = useDesignForRim ? cx : cxD;
    const cyR = useDesignForRim ? cy : cyD;
    const rIn = Math.max(2.2, r * 0.14);
    const rOut = Math.min(Math.hypot(sw, sh) * 0.49, Math.max(r * 1.05, rIn + 4));
    const rIn2 = rIn * rIn;
    const rOut2 = rOut * rOut;
    let nRimPatch = 0;
    let nRimInDesign = 0;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const i = row + x;
        const L = lum[i];
        if (L < brightThr) continue;
        const dxR = x + 0.5 - cxR;
        const dyR = y + 0.5 - cyR;
        const d2R = dxR * dxR + dyR * dyR;
        if (d2R < rIn2 || d2R > rOut2) continue;
        nRimPatch++;
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) nRimInDesign++;
      }
    }
    const darkMoonLumPct = nDarkPatch > 0 ? (100 * nDarkInDisk) / nDarkPatch : 0;
    const darkMoonRgbPct = nRgbDarkPatch > 0 ? (100 * nRgbDarkInDisk) / nRgbDarkPatch : 0;
    const rimMoonPct = nRimPatch > 0 ? (100 * nRimInDesign) / nRimPatch : 0;
    const eclipseHarmonyPct = Math.sqrt(Math.max(0, darkMoonLumPct) * Math.max(0, rimMoonPct));
    const centroidOffPx = Math.hypot(cxD - cx, cyD - cy);
    return {
      rDiskPx: r,
      nDisk: n,
      darkLumPct,
      brightLumPct,
      midLumPct,
      avgRgbDarkPct,
      avgRgbBrightPct: 100 - avgRgbDarkPct,
      geomOverlap,
      darkMoonLumPct,
      darkMoonRgbPct,
      rimMoonPct,
      eclipseHarmonyPct,
      nDarkPatch,
      nRimPatch,
      centroidOffPx,
      rimCenterIsDesign: useDesignForRim,
      darkThr,
      brightThr,
    };
  }

  /**
   * 도면 원 안쪽(~78%) 휘도만으로 캡(저대비) 추정 — 밝은 띠 게이트·중심 오프셋과 독립.
   * @param {{ capNIn: number, capMeanL: number, capStdL: number, capRangeL: number, capMinL: number, openHoleInCenter?: boolean, spread85: number, stdL: number, deltaEff: number, capVeryDarkFrac?: number, capCoreVeryDarkFrac?: number } | null | undefined} d
   */
  function meissa2dOrthoDiskCapFromMetrics(d, minDU) {
    if (!d || d.openHoleInCenter) return false;
    const minD = Number.isFinite(minDU) && minDU > 1e-6 ? minDU : 4;
    /** 안쪽·중심부에 아주 검은 픽셀이 거의 없음 → 캡(단일 암점은 capMinL만 낮아도 통과) */
    if (
      d.capNIn >= 14 &&
      Number.isFinite(d.capVeryDarkFrac) &&
      d.capVeryDarkFrac <= 0.042 &&
      (d.capMinL >= 72 ||
        (d.capVeryDarkFrac <= 0.02 && d.capMinL >= 55) ||
        (d.capVeryDarkFrac <= 0.028 && d.capMinL >= 62)) &&
      (!Number.isFinite(d.capCoreVeryDarkFrac) || d.capCoreVeryDarkFrac <= 0.11)
    ) {
      return true;
    }
    if (d.capNIn >= 12 && d.capStdL <= 21 && d.capRangeL <= 58 && d.capMinL >= 60 && d.deltaEff <= 8.2) {
      if (d.capMeanL >= 84 || (d.capMeanL >= 72 && d.capStdL <= 16)) return true;
    }
    if (d.capNIn >= 10 && d.capStdL <= 17 && d.capMeanL >= 95 && d.capRangeL <= 50) return true;
    if (
      d.capNIn >= 12 &&
      d.spread85 <= 30 &&
      d.stdL <= 36 &&
      d.deltaEff <= minD * 0.58 &&
      d.capMinL >= 55 &&
      d.capRangeL <= 62
    )
      return true;
    return false;
  }

  /**
   * 정사 패치: 도면 중심과 겹친 검은 코어 + 코어 바깥 이중(어깨·링 내·링 외) 밝은 띠,
   * 그리고 공식 링 바깥쪽 원 오프셋(확장 고리)까지 봐서 중첩·인접 검은 영역에도 밝은 띠를 판별.
   * 밝은 띠가 없으면 미판정(no-bright-rim).
   * @param {Record<string, unknown>|null|undefined} circleOpt 도면 원 직경→원내 겹침 % 산출용
   */
  function meissa2dAnalyzeOrthoPatchAtNatural(nat, imgEl, circleOpt) {
    const { ix, iy, nw, nh } = nat;
    const pr = Math.max(12, Math.min(48, Math.round(Math.min(nw, nh) * 0.02)));
    /** 도면 말뚝 반경→정사 px 한 덩어리만(이웃 말뚝 배제). 반경은 도면에 항상 있다고 가정. */
    const fastOrtho = meissa2dOrthoFastModeFromUi();
    const diamCap = fastOrtho
      ? Math.min(236, nw, nh, Math.max(148, pr * 2 + 84))
      : Math.min(320, nw, nh, Math.max(196, pr * 2 + 120));
    const pilePatchMargin = 1.44;
    let diam = diamCap;
    if (circleOpt) {
      const rFileP = meissa2dPileRadiusFileUnits(circleOpt);
      if (!Number.isFinite(rFileP) || rFileP <= 1e-9) {
        return { delta: null, reason: "no-drawing-radius", validDetection: false };
      }
      const rNatPile = meissa2dPileRadiusNaturalPx(circleOpt);
      if (!Number.isFinite(rNatPile) || rNatPile <= 1.5) {
        return { delta: null, reason: "radius-to-ortho-px", validDetection: false };
      }
      const sideFromPile = Math.ceil(2 * rNatPile * pilePatchMargin);
      diam = Math.max(64, Math.min(diamCap, sideFromPile, nw, nh));
    }
    const half = Math.floor(diam / 2);
    let sx = Math.floor(ix - half);
    let sy = Math.floor(iy - half);
    sx = Math.max(0, Math.min(sx, nw - diam));
    sy = Math.max(0, Math.min(sy, nh - diam));
    const sw = Math.min(diam, nw - sx);
    const sh = Math.min(diam, nh - sy);
    if (sw < 10 || sh < 10) return { delta: null, reason: "patch", validDetection: false };
    const cnv = ensureMeissa2dOrthoPatchCanvas();
    if (cnv.width < sw || cnv.height < sh) {
      cnv.width = sw;
      cnv.height = sh;
    }
    const pctx = cnv.getContext("2d");
    if (!pctx) return { delta: null, validDetection: false };
    const patchSrc = meissa2dPickUsablePatchImageSourceForAnalyze(nw, nh);
    const srcEl =
      (meissa2dOrthoAnalysisImage &&
        meissa2dOrthoAnalysisImageKey === meissa2dCurrentProjectSnapshotKey() &&
        Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) > 8 &&
        Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) > 8
        ? meissa2dOrthoAnalysisImage
        : null) ||
      patchSrc ||
      imgEl;
    if (!srcEl) return { delta: null, reason: "analysis-image-missing", validDetection: false };
    const srcW = Math.max(
      1,
      Math.round(Number(srcEl?.naturalWidth || srcEl?.videoWidth || srcEl?.width || nw))
    );
    const srcH = Math.max(
      1,
      Math.round(Number(srcEl?.naturalHeight || srcEl?.videoHeight || srcEl?.height || nh))
    );
    const kx = srcW / Math.max(1, nw);
    const ky = srcH / Math.max(1, nh);
    const sxSrc = Math.max(0, Math.min(srcW - 1, Math.floor(sx * kx)));
    const sySrc = Math.max(0, Math.min(srcH - 1, Math.floor(sy * ky)));
    const swSrc = Math.max(1, Math.min(srcW - sxSrc, Math.ceil(sw * kx)));
    const shSrc = Math.max(1, Math.min(srcH - sySrc, Math.ceil(sh * ky)));
    try {
      pctx.drawImage(srcEl, sxSrc, sySrc, swSrc, shSrc, 0, 0, sw, sh);
    } catch (_) {
      return { delta: null, reason: "taint", validDetection: false };
    }
    let im;
    try {
      im = pctx.getImageData(0, 0, sw, sh);
    } catch (_) {
      // 원본 이미지가 CORS taint일 때, same-origin 뷰포트 hi-canvas를 1회 폴백 소스로 시도.
      if (!MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS) {
        try {
          const hi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
          if (hi && hi.tagName === "CANVAS") {
            const hctx = hi.getContext("2d");
            if (hctx) {
              const t = hctx.getImageData(0, 0, 1, 1);
              if (t && t.data) {
                meissa2dOrthoPatchImageSource = hi;
                pctx.clearRect(0, 0, sw, sh);
                pctx.drawImage(hi, sx, sy, sw, sh, 0, 0, sw, sh);
                im = pctx.getImageData(0, 0, sw, sh);
              }
            }
          }
        } catch (_) {
          // ignore and keep original imagedata failure
        }
      }
      if (!im) {
        return { delta: null, reason: "imagedata", validDetection: false };
      }
    }
    const data = im.data;
    const cx = ix - sx + 0.5;
    const cy = iy - sy + 0.5;
    const rNatDesign = circleOpt ? meissa2dPileRadiusNaturalPx(circleOpt) : NaN;
    const useDesignDisk =
      Boolean(circleOpt) && Number.isFinite(rNatDesign) && rNatDesign > 2;
    const rClip = useDesignDisk
      ? Math.max(2.2, Math.min(rNatDesign, cx - 0.5, sw - cx - 0.5, cy - 0.5, sh - cy - 0.5))
      : Infinity;
    const rClip2 = rClip * rClip;
    const orthoClipOpt = useDesignDisk ? { cx, cy, r2: rClip2 } : null;
    /** 도면 원 안에서만: 코어 → 어깨 → 링(2분할) → 확장(3차·바깥 띠) 순으로 rClip 비율 배치 */
    const rCore = useDesignDisk
      ? Math.max(2.0, rClip * 0.17)
      : Math.max(2.2, Math.min(sw, sh) * 0.1);
    const rRingIn = useDesignDisk
      ? Math.max(rCore * 1.2 + 0.5, rClip * 0.3)
      : rCore * 1.4;
    const rRingOut = useDesignDisk
      ? Math.max(rRingIn + 2.5, rClip * 0.72)
      : Math.min(Math.min(sw, sh) * 0.36, Math.hypot(sw, sh) * 0.26);
    const rRingMid = rRingIn + (rRingOut - rRingIn) * 0.46;
    const rRingMid2 = rRingMid * rRingMid;
    /** 공식 링 바깥 확장 고리(3차 밝은 띠) — 반드시 도면 원(rClip) 안에 남김 */
    const rExtOut = useDesignDisk
      ? Math.max(rRingOut + 1, Math.min(rClip - 0.35, rClip * 0.96, Math.min(cx, sw - cx, cy, sh - cy) - 1))
      : Math.min(
          Math.min(sw, sh) * 0.46,
          Math.hypot(sw, sh) * 0.33,
          Math.min(cx, sw - cx, cy, sh - cy) - 1.5
        );
    const rCore2 = rCore * rCore;
    const rCoreDisk2 = (rCore * 1.18) * (rCore * 1.18);
    const rRingIn2 = rRingIn * rRingIn;
    const rRingOut2 = rRingOut * rRingOut;
    const rExtEff = Math.max(rRingOut + 0.5, rExtOut);
    const rExtOut2 = rExtEff * rExtEff;
    let rLoc = Math.max(rCore * 4.5, Math.min(sw, sh) * 0.14);
    if (useDesignDisk) rLoc = Math.min(rLoc, rClip);
    const rLoc2 = rLoc * rLoc;
    /** 도면 원의 안쪽(가장자리 흙/링 제외)만으로 캡(균일 덮개) 판별 — 번호·가장자리 영향 완화 */
    const rCapInner = useDesignDisk ? Math.max(3.5, rClip * 0.78) : 0;
    const rCapInner2 = rCapInner * rCapInner;
    let capNIn = 0;
    let capSumL = 0;
    let capSumL2 = 0;
    let capMinL = 255;
    let capMaxL = 0;
    let sumC = 0;
    let nC = 0;
    let sumR = 0;
    let nR = 0;
    /** 코어와 공식 링 사이 어깨(첫 번째 밝은 띠) — 중첩 검은 영역에도 도움 */
    let sumRimShoulder = 0;
    let nRimShoulder = 0;
    /** 공식 링 안쪽 절반(두 번째 밝은 띠 · 안쪽 오프셋) */
    let sumRimInner = 0;
    let nRimInner = 0;
    /** 공식 링 바깥 절반(세 번째 밝은 띠 · 바깥 오프셋) */
    let sumRimOuter = 0;
    let nRimOuter = 0;
    /** 공식 링(rRingOut) 바깥 확장 고리 — 원을 한 번 더 밀어 낸 샘플 */
    let sumRimExt = 0;
    let nRimExt = 0;
    let minL = 255;
    let minDx = 0;
    let minDy = 0;
    /** 도면 중심 코어 반경 안의 최저 휘도(전역 최암점과 별개 — 가장자리 그림자 오판 방지) */
    let minLDiskCore = 255;
    const sectorSums = [0, 0, 0, 0, 0, 0, 0, 0];
    const sectorNs = [0, 0, 0, 0, 0, 0, 0, 0];
    const pixCount = sw * sh;
    let nClip = 0;
    const lum = new Float32Array(pixCount);
    const lumHist = new Uint32Array(256);
    let sumL = 0;
    let sumL2 = 0;
    let locMinDx = 0;
    let locMinDy = 0;
    let locMinL = 255;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const i4 = (row + x) * 4;
        const r = data[i4];
        const g = data[i4 + 1];
        const b = data[i4 + 2];
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        const idx = row + x;
        lum[idx] = L;
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        const inDesignDisk = !useDesignDisk || d2 <= rClip2;
        if (inDesignDisk) {
          nClip++;
          sumL += L;
          sumL2 += L * L;
          const hb = Math.min(255, Math.max(0, Math.round(L)));
          lumHist[hb]++;
        }
        if (inDesignDisk && d2 <= rCapInner2) {
          capNIn++;
          capSumL += L;
          capSumL2 += L * L;
          if (L < capMinL) capMinL = L;
          if (L > capMaxL) capMaxL = L;
        }
        if (inDesignDisk && L < minL) {
          minL = L;
          minDx = dx;
          minDy = dy;
        }
        if (inDesignDisk && d2 <= rCoreDisk2) {
          if (L < minLDiskCore) minLDiskCore = L;
        }
        if (inDesignDisk && d2 <= rLoc2 && L < locMinL) {
          locMinL = L;
          locMinDx = dx;
          locMinDy = dy;
        }
        if (inDesignDisk && d2 <= rCore2) {
          sumC += L;
          nC++;
        } else if (inDesignDisk && d2 > rCore2 && d2 < rRingIn2) {
          sumRimShoulder += L;
          nRimShoulder++;
        } else if (inDesignDisk && d2 >= rRingIn2 && d2 <= rRingOut2) {
          sumR += L;
          nR++;
          if (d2 <= rRingMid2) {
            sumRimInner += L;
            nRimInner++;
          } else {
            sumRimOuter += L;
            nRimOuter++;
          }
          const ang = Math.atan2(dy, dx);
          let si = Math.floor((ang + Math.PI) / (Math.PI / 4));
          if (si > 7) si = 7;
          if (si < 0) si = 0;
          sectorSums[si] += L;
          sectorNs[si]++;
        } else if (inDesignDisk && d2 > rRingOut2 && d2 <= rExtOut2) {
          sumRimExt += L;
          nRimExt++;
        }
      }
    }
    if (useDesignDisk && nClip < 12) {
      return { delta: null, reason: "design-disk-pixels", validDetection: false };
    }
    const pixHist = useDesignDisk ? nClip : pixCount;
    const mCore = nC ? sumC / nC : 128;
    const mRing = nR ? sumR / nR : mCore;
    const delta = mRing - mCore;
    const pxDarkest = cx + locMinDx;
    const pyDarkest = cy + locMinDy;
    let deltaAtDarkest = meissa2dOrthoRingCoreDeltaLocal(
      lum,
      sw,
      sh,
      pxDarkest,
      pyDarkest,
      rCore,
      rRingIn,
      rRingOut,
      orthoClipOpt
    );
    if (!Number.isFinite(deltaAtDarkest) || deltaAtDarkest < -200) deltaAtDarkest = delta;
    const deltaEff = Math.max(delta, deltaAtDarkest);
    /** 링 평균 − 패치 최암(구멍 깊이 대 주변) — 도면이 구멍 옆일 때 도움 */
    const holeSurroundLift = nR > 0 && Number.isFinite(locMinL) ? mRing - locMinL : 0;
    const maxR = Math.max(rCore, rRingOut);
    const darkestNorm = Math.hypot(minDx, minDy) / Math.max(1e-6, maxR);
    const secMeans = sectorSums.map((s, j) => (sectorNs[j] ? s / sectorNs[j] : null)).filter((v) => v != null);
    let ringAsym = 0;
    if (secMeans.length >= 4) {
      const mean = secMeans.reduce((a, b) => a + b, 0) / secMeans.length;
      ringAsym = Math.sqrt(secMeans.reduce((a, b) => a + (b - mean) * (b - mean), 0) / secMeans.length);
    }
    let ringSectorSpread = 0;
    let ringBrightestAboveCore = 0;
    if (secMeans.length >= 3) {
      ringSectorSpread = Math.max(...secMeans) - Math.min(...secMeans);
      ringBrightestAboveCore = Math.max(...secMeans) - mCore;
    }
    const p38 = meissa2dOrthoHistQuantile(lumHist, pixHist, 0.38);
    const p45 = meissa2dOrthoHistQuantile(lumHist, pixHist, 0.45);
    const p50 = meissa2dOrthoHistQuantile(lumHist, pixHist, 0.5);
    const p56 = meissa2dOrthoHistQuantile(lumHist, pixHist, 0.56);
    const p85 = meissa2dOrthoHistQuantile(lumHist, pixHist, 0.85);
    const spread85 = p85 - p50;
    const meanL = sumL / pixHist;
    const stdL = Math.sqrt(Math.max(0, sumL2 / pixHist - meanL * meanL));
    /** 안쪽(~78%)·중심(~38%r) 원에서 capDarkThr 미만 픽셀 비율 — 구멍(아주 검은 부위) 유무 */
    const capDarkThr = useDesignDisk
      ? Math.min(86, Math.max(50, Math.min(p38 + 16, p50 - 20)))
      : 70;
    const rCapCore = useDesignDisk ? Math.max(2.8, rClip * 0.38) : 0;
    const rCapCore2 = rCapCore * rCapCore;
    let capVeryDarkN = 0;
    let capCoreN = 0;
    let capCoreVeryDarkN = 0;
    if (useDesignDisk && capNIn >= 8) {
      for (let yi = 0; yi < sh; yi++) {
        const row = yi * sw;
        for (let xi = 0; xi < sw; xi++) {
          const dx = xi + 0.5 - cx;
          const dy = yi + 0.5 - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 > rCapInner2) continue;
          const L = lum[row + xi];
          if (L < capDarkThr) capVeryDarkN++;
          if (d2 <= rCapCore2) {
            capCoreN++;
            if (L < capDarkThr) capCoreVeryDarkN++;
          }
        }
      }
    }
    const capVeryDarkFrac = capNIn > 0 ? capVeryDarkN / capNIn : 1;
    const capCoreVeryDarkFrac = capCoreN > 0 ? capCoreVeryDarkN / capCoreN : 0;
    const searchR = useDesignDisk ? Math.min(rClip, sw, sh) * 0.48 : Math.min(sw, sh) * 0.5;
    const searchR2 = searchR * searchR;
    const patchArea = useDesignDisk && nClip > 0 ? nClip : pixCount;
    const rFootDisk = useDesignDisk
      ? rClip
      : Math.max(
          5,
          Math.min(
            Math.hypot(sw, sh) * 0.45,
            Number.isFinite(rNatDesign) && rNatDesign > 2 ? rNatDesign : Math.min(sw, sh) * 0.11
          )
        );
    const footprintOverlap = meissa2dOrthoFootprintDiskOverlapStats(
      lum,
      data,
      sw,
      sh,
      cx,
      cy,
      rFootDisk,
      p38,
      p85,
      spread85
    );

    const minDUiGate = meissa2dOrthoMinDeltaFromUi();
    const cxI = Math.max(0, Math.min(sw - 1, Math.floor(cx)));
    const cyI = Math.max(0, Math.min(sh - 1, Math.floor(cy)));
    const Lcen = lum[cyI * sw + cxI];
    const LcenRobust = Math.min(
      Lcen,
      cxI > 0 ? lum[cyI * sw + (cxI - 1)] : Lcen,
      cxI + 1 < sw ? lum[cyI * sw + (cxI + 1)] : Lcen,
      cyI > 0 ? lum[(cyI - 1) * sw + cxI] : Lcen,
      cyI + 1 < sh ? lum[(cyI + 1) * sw + cxI] : Lcen
    );
    const distLocalDarkest = Math.hypot(locMinDx, locMinDy);
    const darkPeakNearDesign = distLocalDarkest <= rCore * 1.95;
    const centerInDarkInterior =
      minLDiskCore <= p50 + 18 &&
      (LcenRobust <= p50 + 26 || mCore <= p56 + 4 || minLDiskCore <= p45 + 14);
    const passDarkOverlap =
      darkPeakNearDesign ||
      centerInDarkInterior ||
      (delta >= 1.15 && minLDiskCore <= p50 + 36) ||
      (delta >= 0.85 && minLDiskCore <= p45 + 22 && LcenRobust <= p50 + 32) ||
      (deltaEff >= 1.95 && distLocalDarkest <= rLoc * 1.08 && locMinL <= p50 + 30) ||
      (holeSurroundLift >= 9 && distLocalDarkest <= Math.max(rLoc, rCore * 3.4)) ||
      (holeSurroundLift >= 6.5 && deltaEff >= 1.05 && locMinL <= p56 + 8) ||
      (distLocalDarkest >= rCore * 1.02 &&
        holeSurroundLift >= 6.2 &&
        locMinL <= p52 + 26 &&
        distLocalDarkest <= rLoc * 1.25) ||
      (darkestNorm >= 0.3 &&
        darkestNorm <= 0.9 &&
        holeSurroundLift >= 7 &&
        locMinL <= p50 + 30);
    const mShoulder = nRimShoulder > 4 ? sumRimShoulder / nRimShoulder : NaN;
    const mRi = nRimInner > 4 ? sumRimInner / nRimInner : NaN;
    const mRo = nRimOuter > 4 ? sumRimOuter / nRimOuter : NaN;
    const dSh = Number.isFinite(mShoulder) ? mShoulder - mCore : -1e6;
    const dRi = Number.isFinite(mRi) ? mRi - mCore : -1e6;
    const dRo = Number.isFinite(mRo) ? mRo - mCore : -1e6;
    const mExt = nRimExt > 7 ? sumRimExt / nRimExt : NaN;
    const dExt = Number.isFinite(mExt) ? mExt - mCore : -1e6;
    const tR = Math.max(3.85, minDUiGate * 0.178);
    const tWeak = Math.max(2.55, minDUiGate * 0.128);
    const nearRimOk = Math.max(dSh, dRi, dRo);
    const rimLiftForFaint = Math.max(nearRimOk, Number.isFinite(mExt) ? dExt : -1e6, holeSurroundLift);
    const faintGlob = deltaEff < Math.max(1.72, minDUiGate * 0.118);
    const holeStrongSkipFaint =
      holeSurroundLift >= 11 ||
      (locMinL <= p45 + 14 && holeSurroundLift >= 8) ||
      (distLocalDarkest >= 2.6 && holeSurroundLift >= 8.5 && locMinL <= p50 + 20) ||
      (darkestNorm >= 0.35 && darkestNorm <= 0.86 && holeSurroundLift >= 7.2);
    const faintPile =
      !holeStrongSkipFaint && faintGlob && rimLiftForFaint < Math.max(1.32, minDUiGate * 0.074);
    const passBrightRim =
      deltaEff >= Math.max(4.75, minDUiGate * 0.215) ||
      (dRi >= tR * 0.44 && dRo >= tR * 0.44 && (dSh >= tWeak * 0.88 || nRimShoulder <= 8)) ||
      (dSh >= tR * 0.74 && (dRi >= tR * 0.32 || dRo >= tR * 0.32)) ||
      (dRi >= tR * 0.8 && dRo >= tR * 0.72) ||
      (dExt >= tR * 0.42 &&
        nearRimOk >= tWeak * 0.64 &&
        (dRi >= tWeak * 0.48 || dRo >= tWeak * 0.48 || dSh >= tWeak * 0.48)) ||
      (deltaEff >= 3.35 &&
        nearRimOk >= tWeak * 0.84 &&
        (dRi >= tWeak * 0.34 || dRo >= tWeak * 0.34 || dSh >= tWeak * 0.34)) ||
      (Number.isFinite(mExt) &&
        dExt >= tWeak * 0.82 &&
        deltaEff >= 2.75 &&
        (dRi >= tWeak * 0.32 || dRo >= tWeak * 0.32 || nearRimOk >= tWeak * 0.8)) ||
      (deltaEff >= 2.65 && nearRimOk >= tWeak * 0.9) ||
      (Number.isFinite(mExt) && dExt >= tWeak * 0.68 && deltaEff >= 2.35) ||
      (deltaEff >= 1.25 && rimLiftForFaint >= 0.82) ||
      (ringSectorSpread >= 10.5 && ringBrightestAboveCore >= 4.8 && holeSurroundLift >= 6.5) ||
      (deltaEff >= 1.05 && ringSectorSpread >= 12.5 && nearRimOk >= tWeak * 0.52) ||
      (holeSurroundLift >= 12 && nearRimOk >= tWeak * 0.58 && deltaEff >= 0.65) ||
      (holeSurroundLift >= 6.2 && locMinL <= p50 + 30 && (ringSectorSpread >= 4.5 || nearRimOk >= tWeak * 0.36)) ||
      (holeSurroundLift >= 11.5 && locMinL <= p48 + 24) ||
      (distLocalDarkest >= 2.8 && holeSurroundLift >= 7.8 && locMinL <= p46 + 26) ||
      (useDesignDisk &&
        nR >= 8 &&
        deltaEff >= 1.35 &&
        (dRi >= tWeak * 0.36 || dSh >= tWeak * 0.42) &&
        (dRo >= tWeak * 0.22 || nRimOuter >= 4 || nRimExt >= 5)) ||
      (useDesignDisk && nRimExt >= 6 && dExt >= tWeak * 0.34 && deltaEff >= 1.85);
    /** 원 내 휘도 분포가 평탄하고 링−코어 대비가 약하면 캡(덮개)으로 간주 */
    const capMeanL = capNIn > 0 ? capSumL / capNIn : 0;
    const capStdL =
      capNIn > 1 ? Math.sqrt(Math.max(0, capSumL2 / capNIn - capMeanL * capMeanL)) : 0;
    const capRangeL = capNIn > 0 ? capMaxL - capMinL : 255;
    /**
     * 구멍형: 최저 1픽셀만 어둡고(측점·그림자) 나머지는 밝은 경우는 제외.
     * 아주 검은 픽셀 비율이 일정 이상일 때만 막힌 구멍으로 본다.
     */
    const openHoleInCenter =
      useDesignDisk &&
      capNIn >= 12 &&
      (capVeryDarkFrac > 0.072 ||
        (capCoreN >= 10 && capCoreVeryDarkFrac > 0.14) ||
        (capMinL < 52 && capVeryDarkFrac > 0.042 && capRangeL > 44) ||
        (capMinL < 46 && capVeryDarkFrac > 0.028 && capRangeL > 50));
    /** 암부 포획처럼 아주 검은 영역 비율이 극히 낮으면 캡(측점만 어두운 경우 포함) */
    const capLikelyNoVeryDark =
      useDesignDisk &&
      !openHoleInCenter &&
      capNIn >= 14 &&
      capVeryDarkFrac <= 0.032 &&
      (capCoreN < 9 || capCoreVeryDarkFrac <= 0.09) &&
      (capVeryDarkFrac <= 0.018 || capMinL >= 66);
    /** 안쪽 78% 원이 밝고 평탄(캡·덮개) */
    const capInteriorUniform =
      useDesignDisk &&
      !openHoleInCenter &&
      capNIn >= 14 &&
      capStdL <= 19 &&
      capRangeL <= 52 &&
      (capMinL >= 68 || (capVeryDarkFrac <= 0.022 && capMinL >= 58)) &&
      (capMeanL >= 94 || (capMeanL >= 82 && capStdL <= 13.5)) &&
      deltaEff <= 6.5;
    const capInteriorBrightFlat =
      useDesignDisk &&
      !openHoleInCenter &&
      capNIn >= 12 &&
      capStdL <= 15 &&
      capMeanL >= 108 &&
      capRangeL <= 44 &&
      capMinL >= 85;
    const diskCap =
      useDesignDisk && capNIn >= 10
        ? {
            capNIn,
            capMeanL,
            capStdL,
            capRangeL,
            capMinL,
            openHoleInCenter: !!openHoleInCenter,
            spread85,
            stdL,
            deltaEff,
            capDarkThr,
            capVeryDarkN,
            capVeryDarkFrac,
            capCoreN,
            capCoreVeryDarkFrac,
          }
        : null;
    const pileCappedLikely =
      useDesignDisk &&
      !openHoleInCenter &&
      (capLikelyNoVeryDark ||
        (nClip >= 14 &&
          (capInteriorUniform ||
            capInteriorBrightFlat ||
            (spread85 <= 22 &&
              stdL <= 28 &&
              deltaEff <= 4.8 &&
              mRing - minLDiskCore <= 20 &&
              (minLDiskCore >= p45 - 14 || capMeanL >= 108) &&
              p85 - p38 <= 50))) ||
        (nClip >= 12 && diskCap && meissa2dOrthoDiskCapFromMetrics(diskCap, minDUiGate)));
    const orthoRejectBase = [
      useDesignDisk
        ? `도면 원(r≈${rClip.toFixed(1)}px) 안만 집계 · 1코어·2링(내/외)·3확장 띠 · 패치 ${sw}×${sh}px · 중심 (${cx.toFixed(2)},${cy.toFixed(2)})`
        : `패치 ${sw}×${sh}px · 도면중심 (${cx.toFixed(2)},${cy.toFixed(2)}) · 검은코어+이중 밝은띠(어깨·링내·링외·바깥오프셋)로 말뚝 형태 확인`,
    ];
    if (pileCappedLikely) {
      const capDx = Math.max(-rCore * 2.2, Math.min(rCore * 2.2, Number.isFinite(locMinDx) ? locMinDx : 0));
      const capDy = Math.max(-rCore * 2.2, Math.min(rCore * 2.2, Number.isFinite(locMinDy) ? locMinDy : 0));
      const capCx = cx + capDx;
      const capCy = cy + capDy;
      return {
        delta: Math.max(0, Number.isFinite(deltaEff) ? deltaEff * 0.12 : 0),
        darkestNorm: Math.min(0.22, darkestNorm),
        ringAsym,
        darkWeightSum: patchArea * 0.055,
        brightWeightSum: 0,
        ringWeightSum: 0,
        textureWeightSum: 0,
        edgeWeightSum: 0,
        centroidPx: capCx,
        centroidPy: capCy,
        patchDistDesignPx: Math.hypot(capDx, capDy),
        detectMode: "capped",
        detectionScore: 0.41,
        validDetection: true,
        orthoSkipReason: undefined,
        pileCapped: true,
        sx,
        sy,
        sw,
        sh,
        spread85,
        stdL,
        footprintOverlap,
        diskCap,
        debugLines: [
          ...orthoRejectBase,
          `캡 추정: 아주검음(<${capDarkThr.toFixed(0)}) ${(100 * capVeryDarkFrac).toFixed(1)}% · 중심부 ${(100 * capCoreVeryDarkFrac).toFixed(1)}% · 안쪽${(rCapInner / Math.max(1e-6, rClip) * 100).toFixed(0)}%원 meanL=${capMeanL.toFixed(1)} σ=${capStdL.toFixed(1)}`,
        ],
      };
    }
    if (faintPile) {
      return {
        delta,
        darkestNorm,
        ringAsym,
        darkWeightSum: 0,
        brightWeightSum: 0,
        ringWeightSum: 0,
        textureWeightSum: 0,
        edgeWeightSum: 0,
        centroidPx: null,
        centroidPy: null,
        patchDistDesignPx: null,
        detectMode: "dark",
        detectionScore: 0,
        validDetection: false,
        orthoSkipReason: "faint-ring-delta",
        sx,
        sy,
        sw,
        sh,
        spread85,
        stdL,
        footprintOverlap,
        debugLines: [
          ...orthoRejectBase,
          `미판정: 유효Δ·띠 부족(Δ도면=${delta.toFixed(1)} Δ암부=${deltaEff.toFixed(1)} vs ${Math.max(1.72, minDUiGate * 0.118).toFixed(1)} · 홈대비=${holeSurroundLift.toFixed(1)} · 띠max=${rimLiftForFaint.toFixed(1)})`,
        ],
        diskCap,
      };
    }
    if (!passDarkOverlap) {
      return {
        delta,
        darkestNorm,
        ringAsym,
        darkWeightSum: 0,
        brightWeightSum: 0,
        ringWeightSum: 0,
        textureWeightSum: 0,
        edgeWeightSum: 0,
        centroidPx: null,
        centroidPy: null,
        patchDistDesignPx: null,
        detectMode: "dark",
        detectionScore: 0,
        validDetection: false,
        orthoSkipReason: "no-dark-hole-at-design",
        sx,
        sy,
        sw,
        sh,
        spread85,
        stdL,
        footprintOverlap,
        debugLines: [
          ...orthoRejectBase,
          `미판정: 암부겹침 부족 · 국소최암 ${distLocalDarkest.toFixed(1)}px · Δ도면=${delta.toFixed(1)} Δ암부=${deltaEff.toFixed(1)} · 홈대비=${holeSurroundLift.toFixed(1)} · 디스크최저 ${minLDiskCore.toFixed(0)}`,
        ],
        diskCap,
      };
    }
    if (!passBrightRim) {
      if (diskCap && meissa2dOrthoDiskCapFromMetrics(diskCap, minDUiGate)) {
        const capDx = Math.max(-rCore * 2.2, Math.min(rCore * 2.2, Number.isFinite(locMinDx) ? locMinDx : 0));
        const capDy = Math.max(-rCore * 2.2, Math.min(rCore * 2.2, Number.isFinite(locMinDy) ? locMinDy : 0));
        const capCx = cx + capDx;
        const capCy = cy + capDy;
        return {
          delta: Math.max(0, Number.isFinite(deltaEff) ? deltaEff * 0.12 : 0),
          darkestNorm: Math.min(0.22, darkestNorm),
          ringAsym,
          darkWeightSum: patchArea * 0.055,
          brightWeightSum: 0,
          ringWeightSum: 0,
          textureWeightSum: 0,
          edgeWeightSum: 0,
          centroidPx: capCx,
          centroidPy: capCy,
          patchDistDesignPx: Math.hypot(capDx, capDy),
          detectMode: "capped",
          detectionScore: 0.41,
          validDetection: true,
          orthoSkipReason: undefined,
          pileCapped: true,
          sx,
          sy,
          sw,
          sh,
          spread85,
          stdL,
          footprintOverlap,
          diskCap,
          debugLines: [
            ...orthoRejectBase,
            `캡(밝은띠 미통과 구출): 안쪽원 σ=${capStdL.toFixed(1)} 범위=${capRangeL.toFixed(0)} meanL=${capMeanL.toFixed(1)}`,
          ],
        };
      }
      return {
        delta,
        darkestNorm,
        ringAsym,
        darkWeightSum: 0,
        brightWeightSum: 0,
        ringWeightSum: 0,
        textureWeightSum: 0,
        edgeWeightSum: 0,
        centroidPx: null,
        centroidPy: null,
        patchDistDesignPx: null,
        detectMode: "dark",
        detectionScore: 0,
        validDetection: false,
        orthoSkipReason: "no-bright-rim",
        sx,
        sy,
        sw,
        sh,
        spread85,
        stdL,
        footprintOverlap,
        debugLines: [
          ...orthoRejectBase,
          `미판정: 밝은 띠(링) 패턴 부족 — Δ도면=${delta.toFixed(1)} Δ암부=${deltaEff.toFixed(1)} · 섹편차=${ringSectorSpread.toFixed(1)} · 어깨Δ=${Number.isFinite(mShoulder) ? dSh.toFixed(1) : "—"} · 링내Δ=${Number.isFinite(mRi) ? dRi.toFixed(1) : "—"} · 링외Δ=${Number.isFinite(mRo) ? dRo.toFixed(1) : "—"} · 바깥Δ=${Number.isFinite(mExt) ? dExt.toFixed(1) : "—"}`,
        ],
        diskCap,
      };
    }

    const ax = distLocalDarkest > 2.15 ? pxDarkest : cx;
    const ay = distLocalDarkest > 2.15 ? pyDarkest : cy;
    let swtD = 0;
    let wxD = 0;
    let wyD = 0;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const i = row + x;
        const L = lum[i];
        const dxC = x + 0.5 - cx;
        const dyC = y + 0.5 - cy;
        if (useDesignDisk && dxC * dxC + dyC * dyC > rClip2) continue;
        const dx = x + 0.5 - ax;
        const dy = y + 0.5 - ay;
        const r2 = dx * dx + dy * dy;
        if (r2 > searchR2) continue;
        const wDark = Math.max(0, (p38 - L) / 50);
        swtD += wDark;
        wxD += (x + 0.5) * wDark;
        wyD += (y + 0.5) * wDark;
      }
    }
    let dPx = swtD > 1e-8 ? wxD / swtD : cx;
    let dPy = swtD > 1e-8 ? wyD / swtD : cy;
    let rgbCentroidNote = "";
    const rgbDiskR = Math.min(
      searchR,
      Math.max(rCore * 3.6, rLoc * 0.92, 22),
      useDesignDisk ? rClip : 1e9
    );
    const rgbCent = meissa2dOrthoRgbEclipseCentroid(
      data,
      sw,
      sh,
      cx,
      cy,
      rCore,
      rRingIn,
      rRingOut,
      rgbDiskR
    );
    if (rgbCent && rgbCent.weightSum > patchArea * 4.5e-4) {
      dPx = rgbCent.px;
      dPy = rgbCent.py;
      rgbCentroidNote = ` · 일식겹침RGB(${rgbCent.px.toFixed(1)},${rgbCent.py.toFixed(1)}) ov=${rgbCent.eclipseOverlap.toFixed(2)} sym=${rgbCent.sym.toFixed(2)}`;
    }
    const dqSeed = meissa2dOrthoRingCoreDeltaLocal(
      lum,
      sw,
      sh,
      dPx,
      dPy,
      rCore,
      rRingIn,
      rRingOut,
      orthoClipOpt
    );
    const dFeat = Math.max(delta, deltaEff, Number.isFinite(dqSeed) ? dqSeed : delta);
    const darkScore =
      Math.min(1, swtD / (patchArea * 0.1)) *
      (dFeat > 10 ? Math.min(1, dFeat / 32) : dFeat > 5 ? 0.42 : dFeat > 2 ? 0.22 : 0.11);
    const WIN_MIN = fastOrtho ? 0.118 : 0.142;
    let validDetection = darkScore >= WIN_MIN;
    let orthoSkipReason;
    if (!validDetection) orthoSkipReason = "dark-weight-weak";
    const swtRescueMin = patchArea * (fastOrtho ? 0.012 : 0.015);
    const rimRescue =
      rimLiftForFaint >= Math.max(1.78, minDUiGate * 0.098) &&
      deltaEff >= Math.max(2.05, minDUiGate * 0.098);
    let rescuedDark = false;
    if (!validDetection && rimRescue && swtD >= swtRescueMin) {
      validDetection = true;
      orthoSkipReason = undefined;
      rescuedDark = true;
    }
    const debugLines = [
      ...orthoRejectBase,
      `통과: ${darkPeakNearDesign ? "국소최암 근접" : "코어에 암부"} · Δ도면=${delta.toFixed(1)} Δ암부=${deltaEff.toFixed(1)} 홈대비=${holeSurroundLift.toFixed(1)} · 띠Δ 어깨=${Number.isFinite(mShoulder) ? dSh.toFixed(1) : "—"} 링내=${Number.isFinite(mRi) ? dRi.toFixed(1) : "—"} 링외=${Number.isFinite(mRo) ? dRo.toFixed(1) : "—"} · 암부 swt=${swtD.toFixed(0)} · score=${darkScore.toFixed(3)}${rescuedDark ? " · 구출:띠·Δ" : ""}${rgbCentroidNote}`,
    ];
    const refineFast = { fastOrtho };
    const rqNeed = fastOrtho ? 1.78 : 1.96;
    const rqMin = fastOrtho ? 1.62 : 1.82;
    let refined = meissa2dOrthoRefineCentroid(
      lum,
      sw,
      sh,
      dPx,
      dPy,
      rCore,
      rRingIn,
      rRingOut,
      "dark",
      refineFast,
      orthoClipOpt
    );
    if (!Number.isFinite(refined.q) || refined.q < rqNeed) {
      refined = meissa2dOrthoRefineCentroid(
        lum,
        sw,
        sh,
        cx,
        cy,
        rCore,
        rRingIn,
        rRingOut,
        "dark",
        refineFast,
        orthoClipOpt
      );
    }
    let centroidPx = refined.px;
    let centroidPy = refined.py;
    if (!Number.isFinite(refined.q) || refined.q < rqMin) {
      const qCx = meissa2dOrthoRingCoreDeltaLocal(lum, sw, sh, cx, cy, rCore, rRingIn, rRingOut, orthoClipOpt);
      const qSeed = Number.isFinite(dqSeed) ? dqSeed : -Infinity;
      const rqRef = Number.isFinite(refined.q) ? refined.q : -Infinity;
      const qRescueThr = fastOrtho ? 1.72 : 1.9;
      const qBest = Math.max(rqRef, qCx, qSeed, Number.isFinite(deltaAtDarkest) ? deltaAtDarkest : -Infinity);
      const refinedPass =
        qBest >= qRescueThr && rimLiftForFaint >= Math.max(1.68, minDUiGate * 0.092);
      if (refinedPass) {
        const seedDist = Math.hypot(dPx - cx, dPy - cy);
        const ringOkAtDesign = qCx >= rqRef - 1e-3;
        if (ringOkAtDesign && seedDist <= 1.65) {
          centroidPx = cx;
          centroidPy = cy;
        } else if (seedDist > 2.8) {
          centroidPx = dPx;
          centroidPy = dPy;
        } else {
          centroidPx = refined.px;
          centroidPy = refined.py;
        }
        if (!validDetection && swtD >= patchArea * 0.01) {
          validDetection = true;
          orthoSkipReason = undefined;
        }
        const qCxStr = Number.isFinite(qCx) ? qCx.toFixed(2) : "—";
        debugLines.push(
          `정제완화: refineQ<${rqMin} → qBest=${Number.isFinite(qBest) ? qBest.toFixed(2) : "—"} · q도면중심=${qCxStr} · 중심(${centroidPx.toFixed(1)},${centroidPy.toFixed(1)})`
        );
      } else {
        validDetection = false;
        if (!orthoSkipReason) orthoSkipReason = "refine-weak";
      }
    }
    const dAtDet = meissa2dOrthoRingCoreDeltaAt(
      lum,
      sw,
      sh,
      centroidPx,
      centroidPy,
      rCore,
      rRingIn,
      rRingOut,
      orthoClipOpt
    );
    let deltaAtDetect =
      dAtDet.delta != null && Number.isFinite(dAtDet.delta) ? dAtDet.delta : delta;
    debugLines.push(
      `결과 검은코어만 · 중심 (${centroidPx.toFixed(2)},${centroidPy.toFixed(2)}) 도면대비 ${Math.hypot(centroidPx - cx, centroidPy - cy).toFixed(2)}px · Δ=${deltaAtDetect.toFixed(2)} refineQ=${Number.isFinite(refined.q) ? refined.q.toFixed(2) : "—"}`
    );

    if (
      !validDetection &&
      Number.isFinite(deltaAtDetect) &&
      Math.max(deltaAtDetect, deltaEff) >= Math.max(1.65, minDUiGate * 0.078) &&
      rimLiftForFaint >= Math.max(1.22, minDUiGate * 0.068) &&
      swtD >= patchArea * 0.006
    ) {
      validDetection = true;
      orthoSkipReason = undefined;
      debugLines.push(
        `구출:말미(Δ·띠·swt) Δ=${deltaAtDetect.toFixed(1)} 띠max=${rimLiftForFaint.toFixed(1)} swt=${swtD.toFixed(0)}`
      );
    }
    if (!validDetection && holeSurroundLift >= 6.8 && locMinL <= p50 + 32) {
      const rMic = Math.max(rCore * 1.55, Math.min(sw, sh) * 0.108);
      const mic = meissa2dOrthoMicroCentroidDarkest(lum, sw, sh, pxDarkest, pyDarkest, rMic, locMinL, p38);
      if (mic) {
        centroidPx = mic.px;
        centroidPy = mic.py;
        const dMic = meissa2dOrthoRingCoreDeltaAt(
          lum,
          sw,
          sh,
          centroidPx,
          centroidPy,
          rCore,
          rRingIn,
          rRingOut,
          orthoClipOpt
        );
        if (dMic.delta != null && Number.isFinite(dMic.delta)) deltaAtDetect = dMic.delta;
        validDetection = true;
        orthoSkipReason = undefined;
        debugLines.push(
          `구출:홈미세중심 도면대비 ${Math.hypot(centroidPx - cx, centroidPy - cy).toFixed(2)}px`
        );
      }
    }
    /** 가중·정제 중심이 도면에서 멀리 치우쳤는데, 국소 최암(홈)은 도면 근처면 후자를 채택(옆 그림자·비대칭 띠 편향 완화). */
    if (validDetection) {
      const distW = Math.hypot(centroidPx - cx, centroidPy - cy);
      const distD = Math.hypot(pxDarkest - cx, pyDarkest - cy);
      if (distW > 10 && distD + 4 < distW && distD < rLoc * 1.25 && locMinL <= p50 + 32) {
        const qD = meissa2dOrthoRingCoreDeltaLocal(
          lum,
          sw,
          sh,
          pxDarkest,
          pyDarkest,
          rCore,
          rRingIn,
          rRingOut,
          orthoClipOpt
        );
        const qC = meissa2dOrthoRingCoreDeltaLocal(
          lum,
          sw,
          sh,
          centroidPx,
          centroidPy,
          rCore,
          rRingIn,
          rRingOut,
          orthoClipOpt
        );
        if (Number.isFinite(qD) && qD > -1e5 && (!Number.isFinite(qC) || qD >= qC - 0.6)) {
          centroidPx = pxDarkest;
          centroidPy = pyDarkest;
          const dFix = meissa2dOrthoRingCoreDeltaAt(
            lum,
            sw,
            sh,
            centroidPx,
            centroidPy,
            rCore,
            rRingIn,
            rRingOut,
            orthoClipOpt
          );
          if (dFix.delta != null && Number.isFinite(dFix.delta)) deltaAtDetect = dFix.delta;
          debugLines.push(
            `중심보정:국소최암 채택(가중 ${distW.toFixed(1)}px → 최암 ${distD.toFixed(1)}px · 링Δ ${Number.isFinite(qD) ? qD.toFixed(2) : "—"})`
          );
        }
      }
    }
    /**
     * PDAM 도면 전제: 정사에서 실제 홈은 도면 중심과 가깝다.
     * 1) 검출이 멀리 가면 방사 클램프(허용 반경 타이트).
     * 2) 도면 위치에서 링−코어 Δ가 이미 버틸 만하면, 남은 어긋남은 검출 오판으로 보고 도면 중심으로 고정.
     */
    if (validDetection) {
      const patchMin = Math.min(sw, sh);
      const maxDrift = Math.min(22, Math.max(10, patchMin * 0.12));
      const rdx = centroidPx - cx;
      const rdy = centroidPy - cy;
      const rdBeforeClamp = Math.hypot(rdx, rdy);
      let rdAfter = rdBeforeClamp;
      if (rdBeforeClamp > maxDrift && rdBeforeClamp > 1e-6) {
        const s = maxDrift / rdBeforeClamp;
        centroidPx = cx + rdx * s;
        centroidPy = cy + rdy * s;
        rdAfter = maxDrift;
        const dCl = meissa2dOrthoRingCoreDeltaAt(
          lum,
          sw,
          sh,
          centroidPx,
          centroidPy,
          rCore,
          rRingIn,
          rRingOut,
          orthoClipOpt
        );
        if (dCl.delta != null && Number.isFinite(dCl.delta)) deltaAtDetect = dCl.delta;
        debugLines.push(
          `도면근접제한: 검출을 도면대비 ≤${maxDrift.toFixed(0)}px 로 클램프(원거리 ${rdBeforeClamp.toFixed(1)}px)`
        );
      }
      const qDesign = meissa2dOrthoRingCoreDeltaLocal(lum, sw, sh, cx, cy, rCore, rRingIn, rRingOut, orthoClipOpt);
      const minQDesign = fastOrtho ? 1.58 : 1.74;
      const qDetectedNow = meissa2dOrthoRingCoreDeltaLocal(
        lum,
        sw,
        sh,
        centroidPx,
        centroidPy,
        rCore,
        rRingIn,
        rRingOut,
        orthoClipOpt
      );
      if (
        Number.isFinite(qDesign) &&
        qDesign > -1e5 &&
        qDesign >= minQDesign &&
        (!Number.isFinite(qDetectedNow) || qDesign >= qDetectedNow + 0.85) &&
        rdAfter > 11
      ) {
        // 기존 "완전 중심 고정(=오프셋 0)" 대신, 설계 중심 쪽으로만 부분 보정해 0 쏠림을 방지.
        const keepDriftPx = Math.min(6.5, Math.max(2.8, patchMin * 0.04));
        const pull = Math.max(keepDriftPx, Math.min(rdAfter, keepDriftPx));
        const ux = rdAfter > 1e-6 ? (centroidPx - cx) / rdAfter : 0;
        const uy = rdAfter > 1e-6 ? (centroidPy - cy) / rdAfter : 0;
        centroidPx = cx + ux * pull;
        centroidPy = cy + uy * pull;
        const d0 = meissa2dOrthoRingCoreDeltaAt(
          lum,
          sw,
          sh,
          centroidPx,
          centroidPy,
          rCore,
          rRingIn,
          rRingOut,
          orthoClipOpt
        );
        if (d0.delta != null && Number.isFinite(d0.delta)) deltaAtDetect = d0.delta;
        const rdPulled = Math.hypot(centroidPx - cx, centroidPy - cy);
        debugLines.push(
          `도면중심보정: 도면 링Δ=${qDesign.toFixed(2)}(검출 ${Number.isFinite(qDetectedNow) ? qDetectedNow.toFixed(2) : "—"}) · ${rdAfter.toFixed(1)}px → ${rdPulled.toFixed(1)}px`
        );
      }
    }
    const patchDistDesignPx = Math.hypot(centroidPx - cx, centroidPy - cy);
    return {
      delta: deltaAtDetect,
      darkestNorm,
      ringAsym,
      darkWeightSum: swtD,
      brightWeightSum: 0,
      ringWeightSum: 0,
      textureWeightSum: 0,
      edgeWeightSum: 0,
      centroidPx,
      centroidPy,
      patchDistDesignPx,
      detectMode: "dark",
      detectionScore: darkScore,
      validDetection,
      orthoSkipReason,
      sx,
      sy,
      sw,
      sh,
      spread85,
      stdL,
      footprintOverlap,
      diskCap,
      debugLines,
    };
  }

  function meissaOrthoDetectModeLabelKo(mode) {
    if (mode === "dark") return "검은코어";
    if (mode === "bright") return "밝은캡";
    if (mode === "capped") return "캡(저대비)";
    if (mode === "ring") return "밝은링";
    if (mode === "edge") return "링경계";
    if (mode === "texture") return "저대비";
    return "";
  }

  function meissa2dBuildPlanFallbackFitById(id, reason, extras) {
    if (MEISSA_ORTHO_PDAM_STRICT_IMAGE_ANALYSIS) {
      const rr = String(reason || "").trim().toLowerCase();
      if (
        rr &&
        rr !== "not-installed" &&
        rr !== "plan" &&
        rr !== "plan-fallback"
      ) {
        return null;
      }
    }
    const rec = state.meissaCompareByCircleId?.get?.(String(id ?? ""));
    const planDAbs = rec?.planD != null ? Math.abs(Number(rec.planD)) : NaN;
    if (!Number.isFinite(planDAbs)) return null;
    const { greenM, yellowM, orangeM } = meissaOrthoImageOffsetThresholdsM();
    let tier = "red";
    if (planDAbs <= greenM) tier = "ok";
    else if (planDAbs <= yellowM) tier = "yellow";
    else if (planDAbs <= orangeM) tier = "orange";
    return {
      tier,
      delta: Number.isFinite(Number(extras?.delta)) ? Number(extras.delta) : null,
      offsetM: planDAbs,
      patchDistDesignPx: Number.isFinite(Number(extras?.patchDistDesignPx))
        ? Number(extras.patchDistDesignPx)
        : null,
      ringAsym: Number.isFinite(Number(extras?.ringAsym)) ? Number(extras.ringAsym) : undefined,
      darkestNorm: Number.isFinite(Number(extras?.darkestNorm)) ? Number(extras.darkestNorm) : undefined,
      detectMode: "plan-fallback",
      detectionScore: Number.isFinite(Number(extras?.detectionScore)) ? Number(extras.detectionScore) : undefined,
      offsetEstimateFallback: true,
      reason: `fallback:${String(reason || "plan").trim() || "plan"}`,
      footprintOverlap: extras?.footprintOverlap ?? null,
      pileCapped: false,
      diskCap: extras?.diskCap ?? null,
    };
  }

  const MEISSA_ORTHO_GEOM_DEDUP_EPS = 1e-4;

  function meissa2dCircleGeomDedupKey(circle) {
    const cx = Number(circle?.center_x ?? circle?.centerX);
    const cy = Number(circle?.center_y ?? circle?.centerY);
    const rad = meissa2dPileRadiusFileUnits(circle);
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(rad) || rad <= 0) return "";
    const q = (v) => Math.round(v / MEISSA_ORTHO_GEOM_DEDUP_EPS);
    return `${q(cx)}:${q(cy)}:${q(rad)}`;
  }

  function meissa2dOrthoCirclePriorityScore(circle) {
    const id = String(circle?.id ?? "");
    const row = state.pdamByCircleId?.get?.(id);
    let score = 0;
    if (isPdamCircleMappingInstalled(row)) score += 200;
    if (row) score += 40;
    if (circle?.matched_text_id != null && String(circle.matched_text_id).trim() !== "") score += 24;
    if (circle?.matched_text?.text != null && String(circle.matched_text.text).trim() !== "") score += 16;
    if (Number.isFinite(Number(circle?.center_x)) && Number.isFinite(Number(circle?.center_y))) score += 6;
    if (Number.isFinite(meissa2dPileRadiusFileUnits(circle))) score += 6;
    return score;
  }

  function meissa2dDedupCirclesForOrthoPdam(circles) {
    const src = Array.isArray(circles) ? circles : [];
    if (!src.length) return src;
    const pickedByGeom = new Map();
    const out = [];
    for (const c of src) {
      const key = meissa2dCircleGeomDedupKey(c);
      if (!key) {
        out.push(c);
        continue;
      }
      const prev = pickedByGeom.get(key);
      if (!prev) {
        pickedByGeom.set(key, c);
        out.push(c);
        continue;
      }
      const prevScore = meissa2dOrthoCirclePriorityScore(prev);
      const nowScore = meissa2dOrthoCirclePriorityScore(c);
      if (nowScore > prevScore) {
        const idx = out.indexOf(prev);
        if (idx >= 0) out[idx] = c;
        pickedByGeom.set(key, c);
      }
    }
    return out;
  }

  /** ortho_pdam 툴팁: 원 내부 비율 + 패치 전체 암부/밝은띠 대비 도면 원 포획(달·일식). */
  function meissaOrthoFootprintOverlapTooltipLines(fp) {
    if (!fp || !Number.isFinite(fp.darkLumPct)) return "";
    const rimNote = fp.rimCenterIsDesign ? "띠추정:도면중심" : "띠추정:암부가중중심";
    return `\n도면 원 안 (r≈${fp.rDiskPx.toFixed(0)}px · ${fp.nDisk}화소)\n  휘도: 암 ${fp.darkLumPct.toFixed(0)}% · 밝 ${fp.brightLumPct.toFixed(0)}% · 중간 ${fp.midLumPct.toFixed(0)}%\n  RGB 평균: 어두움 ${fp.avgRgbDarkPct.toFixed(0)}% · 밝음 ${fp.avgRgbBrightPct.toFixed(0)}% · 원내√(암×밝) ${fp.geomOverlap.toFixed(0)}%\n달·일식 겹침 (전체 패치 기준)\n  암부 포획(휘도): ${fp.darkMoonLumPct.toFixed(0)}% — 패치 안 모든 암픽셀 중 도면 원에 들어온 비율(개기에 가까울수록 ↑)\n  암부 포획(RGB): ${fp.darkMoonRgbPct.toFixed(0)}% — S/765 < 44% 인 픽셀 기준\n  밝은 띠 포획: ${fp.rimMoonPct.toFixed(0)}% — ${rimNote} 환의 밝은 픽셀 중 원 안 비율\n  종합 √(암×림) ${fp.eclipseHarmonyPct.toFixed(0)}% · 암중심↔도면 ${fp.centroidOffPx.toFixed(1)}px · 암 ${fp.nDarkPatch}px 림 ${fp.nRimPatch}px`;
  }

  /**
   * 정사 패치 분석 후 캐시에 저장(동기). 유휴 프리패치·forceSync 경로에서만 호출.
   * @param {Record<string, unknown>} circle
   * @param {string} id
   * @param {string} ck
   * @param {{ ix: number, iy: number, nw: number, nh: number }} nat
   */
  function meissa2dComputeOrthoPdamRgbFitSyncFromNat(_circle, id, ck, nat) {
    const row = state.pdamByCircleId?.get?.(id);
    if (!isPdamCircleMappingInstalled(row)) {
      const miss = { tier: "na", delta: null, offsetM: null, reason: "not-installed" };
      meissa2dOrthoRgbFitCache.set(ck, miss);
      return miss;
    }
    const projectId = (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const { ix, iy, nw, nh } = nat;
    const span = meissa2dGeorefSpanWorldMetersAny(projectId, sid);
    const img = els.meissaCloud2dImageLocal;
    const an = meissa2dAnalyzeOrthoPatchAtNatural(nat, img, _circle);
    if (Array.isArray(an.debugLines) && an.debugLines.length) {
      const tot = Math.max(1, meissaOrthoOverlayTargets);
      const pct = Math.round((100 * meissaOrthoOverlayProcessed) / tot);
      pushMeissaOrthoAnalyzeDebugEntry({
        id,
        ts: Date.now(),
        lines: [
          `오버레이 진행: ${meissaOrthoOverlayProcessed}/${meissaOrthoOverlayTargets} (${pct}%) · 신규 분석(캐시 미스)`,
          ...an.debugLines,
        ],
      });
    }
    if (an.reason || an.delta == null) {
      const outFallback = meissa2dBuildPlanFallbackFitById(id, an.reason || "analyze", {
        delta: null,
        patchDistDesignPx: null,
        footprintOverlap: null,
      });
      if (outFallback) {
        meissa2dOrthoRgbFitCache.set(ck, outFallback);
        return outFallback;
      }
      const miss = {
        tier: "na",
        delta: null,
        offsetM: null,
        reason: an.reason || "analyze",
        footprintOverlap: an.footprintOverlap ?? null,
      };
      meissa2dOrthoRgbFitCache.set(ck, miss);
      return miss;
    }
    const minD = meissa2dOrthoMinDeltaFromUi();
    if (an.validDetection === false) {
      meissa2dOrthoDiagPush({
        id,
        phase: "valid-false",
        reason: an.orthoSkipReason || "low-confidence",
        delta: an.delta,
        detectionScore: an.detectionScore,
        ringAsym: an.ringAsym,
        darkestNorm: an.darkestNorm,
      });
      const outFallback = meissa2dBuildPlanFallbackFitById(id, an.orthoSkipReason || "low-confidence", {
        delta: an.delta,
        patchDistDesignPx: an.patchDistDesignPx ?? null,
        ringAsym: an.ringAsym,
        darkestNorm: an.darkestNorm,
        detectionScore: an.detectionScore,
        footprintOverlap: an.footprintOverlap ?? null,
        diskCap: an.diskCap ?? null,
      });
      if (outFallback) {
        meissa2dOrthoRgbFitCache.set(ck, outFallback);
        return outFallback;
      }
      const miss = {
        tier: "na",
        delta: an.delta,
        offsetM: null,
        reason: an.orthoSkipReason || "low-confidence",
        ringAsym: an.ringAsym,
        darkestNorm: an.darkestNorm,
        detectMode: an.detectMode,
        detectionScore: an.detectionScore,
        footprintOverlap: an.footprintOverlap ?? null,
      };
      meissa2dOrthoRgbFitCache.set(ck, miss);
      return miss;
    }
    let offsetM = null;
    let offsetFallback = false;
    if (an.sx != null && an.centroidPx != null && Number.isFinite(nw) && nw > 0 && Number.isFinite(nh) && nh > 0) {
      /** 패치 내 도면 중심 = analyze 의 cx,cy 와 동일 (픽셀 중심). */
      const cxPatch = ix - an.sx + 0.5;
      const cyPatch = iy - an.sy + 0.5;
      const dIx = an.centroidPx - cxPatch;
      const dIy = an.centroidPy - cyPatch;
      const spanUse = span;
      if (spanUse) {
        const dWx = (dIx / nw) * spanUse.spanX;
        const dWy = (-dIy / nh) * spanUse.spanY;
        offsetM = Math.hypot(dWx, dWy);
      } else if (an.patchDistDesignPx != null && Number.isFinite(an.patchDistDesignPx)) {
        /** bbox span 조회 실패 시: 픽셀 거리 × 대각 화소 해상도(가정 100m×100m 타일)으로 대략 m — 회색(na) 방지 */
        const fbM = 100;
        offsetM = an.patchDistDesignPx * Math.hypot(fbM / nw, fbM / nh);
        offsetFallback = true;
      }
    }

    if (offsetM == null || !Number.isFinite(offsetM)) {
      const miss = {
        tier: "na",
        delta: an.delta,
        offsetM: null,
        reason: "offset",
        detectMode: an.detectMode,
        footprintOverlap: an.footprintOverlap ?? null,
      };
      meissa2dOrthoRgbFitCache.set(ck, miss);
      return miss;
    }
    const { greenM, yellowM, orangeM } = meissaOrthoImageOffsetThresholdsM();
    let tier = "red";
    if (offsetM <= greenM) tier = "ok";
    else if (offsetM <= yellowM) tier = "yellow";
    else if (offsetM <= orangeM) tier = "orange";
    const patchDistPx =
      an.patchDistDesignPx != null && Number.isFinite(an.patchDistDesignPx) ? an.patchDistDesignPx : null;
    const nearDesignPx = patchDistPx != null && patchDistPx <= 3.5;
    if (tier === "ok" && patchDistPx != null && patchDistPx >= 17) tier = "yellow";
    const patchArea = Math.max(1, (an.sw || 0) * (an.sh || 0));
    const wtMin = patchArea * 0.035;
    const mode = an.detectMode || "dark";
    if (mode === "dark") {
      if (
        !nearDesignPx &&
        an.delta < minD * 0.11 &&
        (an.darkWeightSum || 0) < wtMin * 0.88
      ) {
        if (tier === "ok") tier = "yellow";
      } else if (
        tier === "ok" &&
        !nearDesignPx &&
        (an.delta < minD * 0.52 || an.ringAsym > 19 || an.darkestNorm > 0.7)
      ) {
        tier = "yellow";
      }
      if (offsetFallback && tier === "ok") tier = "yellow";
    } else if (mode === "bright") {
      if (tier === "ok" && (an.spread85 < 10 || (an.detectionScore || 0) < 0.28)) tier = "yellow";
    } else if (mode === "capped") {
      // 캡(저대비)은 구멍형보다 중심 추정 신뢰가 낮아 "양호" 고정 오판을 줄이기 위해 최소 yellow로 제한.
      if (tier === "ok") tier = "yellow";
      if ((an.spread85 || 0) > 28 && tier === "yellow") tier = "orange";
    } else if (mode === "ring" || mode === "edge") {
      if (tier === "ok" && (an.ringAsym > 18 || an.delta > minD * 1.2)) tier = "yellow";
    } else if (mode === "texture") {
      if (tier === "ok" && ((an.stdL || 0) < 7 || (an.detectionScore || 0) < 0.3)) tier = "yellow";
      if ((an.detectionScore || 0) < 0.24) tier = "na";
    }
    /**
     * 심각(red)은 Δ·도면대비 px가 모두 “강한 증거”일 때만 유지.
     * Δ가 UI 최소의 ~2/3 미만이거나, 화면상 어긋남이 수십 px 수준인데 Δ가 아직 여유 있으면
     * 중심·m 환산을 과신하지 않고 경고로 내림(표시 m·px는 그대로).
     */
    if (mode === "dark" && Number.isFinite(an.delta) && minD > 1e-6) {
      const ringRel = an.delta / minD;
      const pxM = patchDistPx != null && Number.isFinite(patchDistPx) ? patchDistPx : null;
      const relaxRedToOrange =
        tier === "red" &&
        (ringRel < 0.68 ||
          (pxM != null && pxM <= 48 && ringRel < 0.82));
      if (relaxRedToOrange) tier = "orange";
      if (ringRel < 0.3 && tier === "orange") tier = "yellow";
    }
    /** 원내 저대비(캡)인데 링·중심 추정만 나빠 빨강/주황이 되는 경우 상한 */
    const inferredCap =
      an.pileCapped === true ||
      an.detectMode === "capped" ||
      ((an.detectMode === "dark" || !an.detectMode) &&
        an.diskCap &&
        meissa2dOrthoDiskCapFromMetrics(an.diskCap, minD));
    if (inferredCap && (tier === "red" || tier === "orange")) {
      tier = "yellow";
    }
    const out = {
      tier,
      delta: an.delta,
      offsetM,
      patchDistDesignPx: an.patchDistDesignPx ?? null,
      ringAsym: an.ringAsym,
      darkestNorm: an.darkestNorm,
      darkWeightSum: an.darkWeightSum,
      detectMode:
        inferredCap && (an.detectMode === "dark" || an.detectMode === "capped" || !an.detectMode)
          ? "capped"
          : an.detectMode,
      detectionScore: an.detectionScore,
      offsetEstimateFallback: offsetFallback,
      /**
       * 도면 중심 자연픽셀(ix,iy) 대비 검출 중심 오프셋을 0~1 정규화로 저장.
       * 정사 해상도/URL이 바뀌어도 디버그 선이 튀지 않게, 그릴 때마다 nat을 다시 구해 복원한다.
       */
      detectDeltaNormX:
        an.sx != null &&
        an.centroidPx != null &&
        Number.isFinite(an.centroidPx) &&
        Number.isFinite(nw) &&
        nw > 0
          ? (an.sx + an.centroidPx - ix) / nw
          : null,
      detectDeltaNormY:
        an.sy != null &&
        an.centroidPy != null &&
        Number.isFinite(an.centroidPy) &&
        Number.isFinite(nh) &&
        nh > 0
          ? (an.sy + an.centroidPy - iy) / nh
          : null,
      footprintOverlap: an.footprintOverlap ?? null,
      pileCapped: inferredCap,
      diskCap: an.diskCap ?? null,
    };
    meissa2dOrthoRgbFitCache.set(ck, out);
    return out;
  }

  function meissaOrthoPdamEnqueue(id) {
    const sid = String(id ?? "");
    if (!sid || meissaOrthoPdamQueuedIds.has(sid)) return;
    meissaOrthoPdamQueuedIds.add(sid);
    meissaOrthoPdamPrefetchQueue.push(sid);
    scheduleMeissaOrthoPdamPrefetch();
  }

  function scheduleMeissaOrthoPdamPrefetch() {
    meissa2dEnsureOrthoAnalysisImage();
    if (meissaOrthoPdamIdleCallbackId) return;
    meissaOrthoPdamIdleCallbackId = window.setTimeout(() => {
      meissaOrthoPdamIdleCallbackId = 0;
      let slice = 0;
      const maxPerSlice = meissa2dDragging ? 4 : 32;
      const budgetMs = meissa2dDragging ? 6 : 24;
      const t0 = (typeof performance !== "undefined" && performance.now)
        ? performance.now()
        : Date.now();
      let anyComputed = false;
      while (meissaOrthoPdamPrefetchQueue.length > 0 && slice < maxPerSlice) {
        const nid = meissaOrthoPdamPrefetchQueue.shift();
        meissaOrthoPdamQueuedIds.delete(nid);
        const c = meissaFindCircleById(nid);
        if (c) {
          const ck = `${meissa2dOrthoRgbFitCacheGen}:${nid}`;
          if (!meissa2dOrthoRgbFitCache.has(ck)) {
            const nat = fileCoordToOrthoNaturalPixel(c?.center_x, c?.center_y);
            if (nat) {
              meissa2dComputeOrthoPdamRgbFitSyncFromNat(c, nid, ck, nat);
              anyComputed = true;
            }
          }
        }
        slice++;
        const tn = (typeof performance !== "undefined" && performance.now)
          ? performance.now()
          : Date.now();
        if (tn - t0 >= budgetMs) break;
      }
      if (meissaOrthoPdamPrefetchQueue.length > 0) {
        const delay = meissa2dDragging ? 24 : 4;
        meissaOrthoPdamIdleCallbackId = window.setTimeout(() => {
          meissaOrthoPdamIdleCallbackId = 0;
          scheduleMeissaOrthoPdamPrefetch();
        }, delay);
      }
      if (anyComputed && !meissaOrthoPdamOverlayFlushRaf) {
        meissaOrthoPdamOverlayFlushRaf = requestAnimationFrame(() => {
          meissaOrthoPdamOverlayFlushRaf = 0;
          scheduleRenderMeissa2dPointsOverlay();
          if (!meissa2dDragging) {
            const hasAnalysis = meissa2dHasReadyOrthoAnalysisImage();
            scheduleMeissaOrthoOffsetPanelRefresh(hasAnalysis ? 320 : 560);
          }
        });
      }
    }, 0);
  }

  /**
   * PDAM 시공 말뚝만: 정사에서 어두운 코어 가중 centroid vs 도면 중심 오프셋(m) + 링·코어 특징.
   * tier: ok | yellow | orange | red | na
   * @param {Record<string, unknown>|null|undefined} circle
   * @param {{ forceSync?: boolean }} [opts] 툴팁 등 즉시 값이 필요할 때만 true
   */
  function meissa2dGetOrthoPdamRgbFit(circle, opts) {
    const forceSync = Boolean(opts?.forceSync);
    meissa2dEnsureOrthoAnalysisImage();
    const id = String(circle?.id ?? "");
    if (!id) return { tier: "na", delta: null, offsetM: null };
    let row = state.pdamByCircleId?.get?.(id);
    if (!row && state.pdamByCircleId?.size) {
      const idNum = Number(id);
      if (Number.isFinite(idNum)) {
        row = state.pdamByCircleId.get(String(idNum));
      }
      if (!row) {
        row =
          state.pdamByCircleId.get(String(id).trim()) ||
          state.pdamByCircleId.get(String(id).replace(/^0+/, "")) ||
          null;
      }
    }
    if (!isPdamCircleMappingInstalled(row)) {
      return { tier: "na", delta: null, offsetM: null, reason: "not-installed" };
    }
    if (meissaOrthoOverlayDoneIds && !meissaOrthoOverlayDoneIds.has(id)) {
      meissaOrthoOverlayDoneIds.add(id);
      meissaOrthoOverlayProcessed++;
      renderMeissaOrthoAnalyzeDebugPanel();
    }
    const ck = `${meissa2dOrthoRgbFitCacheGen}:${id}`;
    const hit = meissa2dOrthoRgbFitCache.get(ck);
    if (hit) {
      if (
        (hit.offsetM != null && Number.isFinite(Number(hit.offsetM))) ||
        (hit.tier && hit.tier !== "na")
      ) {
        return hit;
      }
      const r = String(hit.reason || "");
      const shouldPromoteFromPlan =
        r === "imagedata" ||
        r === "taint" ||
        r === "analysis-image-loading" ||
        r === "analysis-image-missing" ||
        r === "analyze" ||
        r === "offset" ||
        r === "low-confidence";
      if (shouldPromoteFromPlan) {
        const outFallback = meissa2dBuildPlanFallbackFitById(id, r || "cached-na", {
          delta: hit.delta,
          patchDistDesignPx: hit.patchDistDesignPx,
          ringAsym: hit.ringAsym,
          darkestNorm: hit.darkestNorm,
          detectionScore: hit.detectionScore,
          footprintOverlap: hit.footprintOverlap,
          diskCap: hit.diskCap,
        });
        if (outFallback) {
          meissa2dOrthoRgbFitCache.set(ck, outFallback);
          return outFallback;
        }
      }
      if (hit.reason !== "no-georef") return hit;
      // georef/offset 상태가 뒤늦게 안정되면 기존 no-georef 캐시를 재평가해 복구한다.
      const natRetry = fileCoordToOrthoNaturalPixel(circle?.center_x, circle?.center_y);
      if (!natRetry) return hit;
      meissa2dOrthoRgbFitCache.delete(ck);
      if (!forceSync) {
        meissaOrthoPdamEnqueue(id);
        return { tier: "na", delta: null, offsetM: null, reason: "pending" };
      }
      return meissa2dComputeOrthoPdamRgbFitSyncFromNat(circle, id, ck, natRetry);
    }
    const nat = fileCoordToOrthoNaturalPixel(circle?.center_x, circle?.center_y);
    if (!nat) {
      const outFallback = meissa2dBuildPlanFallbackFitById(id, "no-georef", {});
      if (outFallback) return outFallback;
      return { tier: "na", delta: null, offsetM: null, reason: "no-georef" };
    }
    if (!forceSync) {
      meissaOrthoPdamEnqueue(id);
      const outFallback = meissa2dBuildPlanFallbackFitById(id, "pending", {});
      if (outFallback) return outFallback;
      return { tier: "na", delta: null, offsetM: null, reason: "pending" };
    }
    if (
      (!meissa2dOrthoAnalysisImage ||
        meissa2dOrthoAnalysisImageKey !== meissa2dCurrentProjectSnapshotKey() ||
        Number(meissa2dOrthoAnalysisImage.naturalWidth || 0) <= 8 ||
        Number(meissa2dOrthoAnalysisImage.naturalHeight || 0) <= 8) &&
      !meissa2dOrthoAnalysisImageInFlight
    ) {
      meissa2dEnsureOrthoAnalysisImage();
      meissaOrthoPdamEnqueue(id);
      const outFallback = meissa2dBuildPlanFallbackFitById(id, "analysis-image-loading", {});
      if (outFallback) {
        meissa2dOrthoRgbFitCache.set(ck, outFallback);
        return outFallback;
      }
      return { tier: "na", delta: null, offsetM: null, reason: "analysis-image-loading" };
    }
    return meissa2dComputeOrthoPdamRgbFitSyncFromNat(circle, id, ck, nat);
  }

  function meissa2dCirclePassesRemainingFilter(circle) {
    const mode = meissa2dColorModeValue();
    if (mode === "mz_zone" || mode === "ortho_pdam") return true;
    if (mode !== "remaining") return true;
    const minR = meissaRemainingMinFilterNumber();
    if (minR == null) return true;
    const row = state.pdamByCircleId?.get?.(String(circle?.id ?? ""));
    const raw = row?.pileRemaining;
    const n = raw != null && String(raw).trim() !== "" ? parseFloat(String(raw).replace(/,/g, "")) : NaN;
    return Number.isFinite(n) && n >= minR;
  }

  /** 예전 점 색 옵션(plan·zdelta 등) 제거 후에도 복원된 폼 값이 남으면 잔량으로 맞춤 */
  function normalizeMeissa3dColorModeSelect() {
    const el = els.meissa3dColorMode;
    if (!el) return;
    let v = String(el.value || "").trim();
    if (v === "plan_dev") v = "ortho_pdam";
    if (v === "remaining" || v === "mz_zone" || v === "ortho_pdam") {
      el.value = v;
      return;
    }
    el.value = "remaining";
  }

  function syncMeissaLegendRowVisibility() {
    const modeRaw = (els.meissa3dColorMode?.value || "").trim();
    const mode = modeRaw === "plan_dev" ? "ortho_pdam" : modeRaw;
    const isRem = mode === "remaining";
    const isMz = mode === "mz_zone";
    const isOrthoPdam = mode === "ortho_pdam";
    const grad = document.getElementById("meissa-3d-legend-row-gradient");
    const bands = document.getElementById("meissa-3d-legend-row-bands");
    const fl = document.getElementById("meissa-remaining-filter-label");
    if (grad) grad.style.display = isMz ? "flex" : "none";
    if (bands) bands.style.display = isRem ? "flex" : "none";
    if (fl) fl.style.display = isRem ? "inline-flex" : "none";
    if (grad && isMz) {
      const lo = document.querySelector("#meissa-3d-legend-row-gradient .meissa-note:first-of-type");
      const hi = document.querySelector("#meissa-3d-legend-row-gradient .meissa-note:last-of-type");
      if (lo) lo.textContent = "구역 Z 유사(녹)";
      if (hi) hi.textContent = "구역 Z 이탈(적)";
    } else if (grad && !isRem) {
      const lo = document.querySelector("#meissa-3d-legend-row-gradient .meissa-note:first-of-type");
      const hi = document.querySelector("#meissa-3d-legend-row-gradient .meissa-note:last-of-type");
      if (lo) lo.textContent = "낮음";
      if (hi) hi.textContent = "높음";
    }
    if (els.meissa3dLegendText && isOrthoPdam) {
      const { greenM, yellowM, orangeM } = meissaOrthoImageOffsetThresholdsM();
      const dot = (c) => `<span style="color:${c};font-weight:800" aria-hidden="true">●</span>`;
      els.meissa3dLegendText.innerHTML = [
        `<div class="meissa-legend-ortho-pdam-block" role="group" aria-label="2D 점 색 범례">`,
        `<div class="meissa-legend-ortho-pdam-line">`,
        `<div class="meissa-legend-ortho-pdam-v">`,
        `<span class="meissa-legend-ortho-pdam-desc">정사↔도면 m </span>`,
        `${dot("#16a34a")}≤${greenM} ${dot("#ca8a04")}${greenM}–${yellowM} ${dot("#ea580c")}${yellowM}–${orangeM} ${dot("#dc2626")}>${orangeM}`,
        `</div></div>`,
        `<div class="meissa-legend-ortho-pdam-line">`,
        `<div class="meissa-legend-ortho-pdam-v">`,
        `${dot("#8b5cf6")}캡·덮힘`,
        `</div></div>`,
        `</div>`,
      ].join("");
    }
  }

  /** PDAM 잔량 구간(고정 m): &lt;0.5 · 0.5~1 · 1~2 · ≥2 — meissa-compare-3d.js 와 동일 기준 */
  function meissaRemainingBandIndex(n) {
    if (!Number.isFinite(n)) return -1;
    if (n < 0.5) return 0;
    if (n < 1) return 1;
    if (n < 2) return 2;
    return 3;
  }

  const MEISSA_REMAINING_BAND_FILL = ["#2e7d4a", "#6b8e23", "#d97706", "#dc2626"];
  const MEISSA_REMAINING_BAND_STROKE = [
    "rgba(20, 83, 45, 0.95)",
    "rgba(84, 105, 30, 0.95)",
    "rgba(154, 52, 18, 0.95)",
    "rgba(127, 29, 29, 0.95)",
  ];

  function pdamMapHasPileRemaining() {
    let found = false;
    state.pdamByCircleId?.forEach((row) => {
      if (row?.pileRemaining != null && String(row.pileRemaining).trim() !== "") found = true;
    });
    return found;
  }

  /** PDAM에 잔량 숫자가 있으면 점 색 기준을 잔량으로 맞춘다(사용자가 다른 옵션을 고른 뒤에는 change 핸들러가 유지). */
  function applyDefaultMeissaColorModeFromPdam() {
    if (!pdamMapHasPileRemaining() || !els.meissa3dColorMode) return;
    els.meissa3dColorMode.value = "remaining";
  }

  /** CAD에서 불러온 말뚝: 직경(diameter)이 있으면 반지름=직경/2, 없으면 circle.radius */
  function meissa2dPileRadiusFileUnits(circle) {
    const d = Number(circle?.diameter);
    if (Number.isFinite(d) && d > 0) return d * 0.5;
    const r = Number(circle?.radius);
    if (Number.isFinite(r) && r > 0) return r;
    return NaN;
  }

  /**
   * 파일 좌표에서 반지름 r(도면 단위)를 화면 px로: 중심에서 +r, +r 로 두 축 오프셋 후 평균.
   * bbox 선형 스케일만 쓰는 것보다 proj4 변환 시 국소 스케일에 가깝다.
   */
  function meissa2dPileRadiusPxFromOffsets(mapPx, cx, cy, radFile) {
    const r = Number(radFile);
    if (!Number.isFinite(r) || r <= 1e-9) return NaN;
    const m0 = mapPx(Number(cx), Number(cy));
    if (!m0 || !Number.isFinite(m0.px) || !Number.isFinite(m0.py)) return NaN;
    const mx = mapPx(Number(cx) + r, Number(cy));
    const my = mapPx(Number(cx), Number(cy) + r);
    if (!mx || !my) return NaN;
    const rx = Math.hypot(mx.px - m0.px, mx.py - m0.py);
    const ry = Math.hypot(my.px - m0.px, my.py - m0.py);
    return (rx + ry) * 0.5;
  }

  /** rgba 문자열의 알파만 바꿈(PDAM 잔량·시공 색을 직경 원에도 쓸 때). */
  function meissa2dAdjustRgbaAlpha(rgbaStr, alpha) {
    const s = String(rgbaStr || "").trim();
    const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
    return s;
  }

  /** 잔량·PDAM 시공 여부 모드일 때 직경 원·중심에 색을 입힌다(기본 지도 모드는 캐드 스타일 유지). */
  function meissa2dFootprintUsesPdamTint() {
    const m = meissa2dColorModeValue();
    return m === "remaining" || m === "mz_zone" || m === "ortho_pdam";
  }

  /**
   * 말뚝 직경 원: 기본은 캐드(얇은 링·연한 채움). PDAM/잔량 모드에서는 점 색과 맞춘 채움·테두리.
   * @param {Record<string, unknown>|null|undefined} paint meissa2dDotPaintForCircle 결과
   */
  function meissa2dDrawPileFootprintDisk(ctx, px, py, rPx, maxRPx, paint) {
    if (!Number.isFinite(rPx) || rPx < 0.12) return;
    if (Number.isFinite(maxRPx) && maxRPx > 0 && rPx > maxRPx) return;
    const vs = meissa2dPanzoomScaleSanitized();
    const lineW = Math.max(0.4, 0.95 / vs);
    const tint = meissa2dFootprintUsesPdamTint() && paint && paint.fill;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, rPx, 0, Math.PI * 2);
    if (tint) {
      ctx.fillStyle = meissa2dAdjustRgbaAlpha(paint.fill, 0.58);
      ctx.fill();
      ctx.strokeStyle = paint.stroke || "rgba(30, 41, 59, 0.55)";
    } else {
      ctx.fillStyle = "rgba(241, 245, 249, 0.04)";
      ctx.fill();
      ctx.strokeStyle = "rgba(147, 197, 253, 0.88)";
    }
    ctx.lineWidth = lineW;
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 도면에 저장된 반경(radius / diameter→r)을 맵 좌표로 환산한 크기의 옅은 점선 원(실제 스케일).
   * rPx는 meissa2dPileRadiusPxFromOffsets 등과 같은 콘텐츠(px) 반경.
   */
  function meissa2dDrawPileFileRadiusDashedCircle(ctx, px, py, rPx, maxRPx) {
    if (!Number.isFinite(rPx) || rPx < 0.45) return;
    let r = rPx;
    if (Number.isFinite(maxRPx) && maxRPx > 0 && r > maxRPx) r = maxRPx;
    const vs = meissa2dPanzoomScaleSanitized();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.36)";
    ctx.lineWidth = Math.max(0.26, 0.48 / vs);
    const on = Math.max(3.2, 5 / vs);
    const off = Math.max(2.2, 3.8 / vs);
    ctx.setLineDash([on, off]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * 정사 위 말뚝 중심: 기본(지도) 모드는 흰 원+테두리.
   * PDAM 잔량·시공 모드는 흰 바탕을 쓰지 않고 잔량/미시공 색을 본체 채움으로 쓴다.
   */
  function meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, hasFoot) {
    const vs = meissa2dPanzoomScaleSanitized();
    const lw = Math.max(0.32, 0.78 / vs);
    const tintFoot = meissa2dFootprintUsesPdamTint();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    if (tintFoot && paint && paint.fill) {
      ctx.fillStyle = meissa2dAdjustRgbaAlpha(paint.fill, 0.88);
      ctx.strokeStyle = paint.stroke || (hasFoot ? "rgba(15, 23, 42, 0.62)" : "rgba(30, 41, 59, 0.58)");
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.strokeStyle = hasFoot ? "rgba(51, 65, 85, 0.52)" : "rgba(71, 85, 105, 0.55)";
    }
    ctx.lineWidth = lw;
    ctx.fill();
    ctx.stroke();
    if (!tintFoot && paint && paint.fill) {
      const ir = dotR * 0.36;
      if (ir > 0.28) {
        ctx.beginPath();
        ctx.arc(px, py, ir, 0, Math.PI * 2);
        ctx.fillStyle = meissa2dAdjustRgbaAlpha(paint.fill, 0.32);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function markMeissa2dOverlayWarmup() {
    const until = Date.now() + MEISSA_2D_OVERLAY_WARMUP_MS;
    if (until > meissa2dOverlayWarmUntil) meissa2dOverlayWarmUntil = until;
  }

  function meissa2dHexToRgba(hex, alpha) {
    const s = String(hex || "")
      .replace("#", "")
      .trim();
    if (s.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
    const n = parseInt(s, 16);
    if (!Number.isFinite(n)) return `rgba(148, 163, 184, ${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  /** 툴팁·라벨용: 동·레이어(지하주차장 등)·블록명을 괄호 한 줄로 */
  function meissa2dFormatCircleLocationBracket(circle) {
    const parts = [];
    const b = String(circle?.building_name ?? "").trim();
    const lyr = String(circle?.layer ?? "").trim();
    const blk = String(circle?.block_name ?? "").trim();
    if (b) parts.push(b);
    if (lyr) parts.push(lyr);
    if (blk && blk !== b) parts.push(blk);
    if (!parts.length) return "";
    return `(${parts.join(" · ")})`;
  }

  /**
   * 도면 폴리라인을 2D 오버레이에 그린다. mapFn은 파일 좌표 → 캔버스 px (실패 시 null).
   */
  function meissa2dDrawPolylinesMapped(ctx, polylines, mapFn, opts) {
    const list = Array.isArray(polylines) ? polylines : [];
    if (!list.length || typeof mapFn !== "function") return;
    const lineWidth = Number(opts?.lineWidth) > 0 ? Number(opts.lineWidth) : 1;
    const strokeStyle = opts?.strokeStyle || "rgba(148, 163, 184, 0.28)";
    const dash = Array.isArray(opts?.dash) ? opts.dash : [];
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    for (const polyline of list) {
      if (!polyline || !Array.isArray(polyline.points) || polyline.points.length < 2) continue;
      const closed = polyline.closed !== false;
      let started = false;
      ctx.beginPath();
      for (const pt of polyline.points) {
        const m = mapFn(Number(pt.x), Number(pt.y));
        if (!m || !Number.isFinite(m.px) || !Number.isFinite(m.py)) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(m.px, m.py);
          started = true;
        } else {
          ctx.lineTo(m.px, m.py);
        }
      }
      if (!started) continue;
      if (closed) ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 비교 표 planD(평면 편차)만으로 점 색. 정사·시공 통합 모드에서 RGB 등급이 없을 때 폴백. */
  function meissa2dDotPaintPlanDeviationFromRec(rec) {
    const grayUnavail = "rgba(148, 163, 184, 0.34)";
    const grayStroke = "rgba(71, 85, 105, 0.5)";
    if (!rec || rec.planD == null || !Number.isFinite(Number(rec.planD))) {
      return { fill: grayUnavail, stroke: grayStroke, dotRScale: 1 };
    }
    const { okM, badM } = meissaPlanDeviationThresholds();
    const d = Math.abs(Number(rec.planD));
    if (d <= okM) {
      return { fill: "rgba(45, 170, 108, 0.44)", stroke: "rgba(4, 120, 87, 0.52)", dotRScale: 1.12 };
    }
    if (d < badM) {
      return { fill: "rgba(217, 119, 6, 0.42)", stroke: "rgba(154, 52, 18, 0.52)", dotRScale: 1.2 };
    }
    return { fill: "rgba(220, 38, 38, 0.46)", stroke: "rgba(127, 29, 29, 0.55)", dotRScale: 1.28 };
  }

  function meissa2dDotPaintForCircle(circle, orthoFitOverride) {
    const mode = meissa2dColorModeValue();
    const row = state.pdamByCircleId?.get?.(String(circle?.id ?? ""));
    const installed = isPdamCircleMappingInstalled(row);
    const neutralFill = "rgba(156, 166, 184, 0.38)";
    const neutralStroke = "rgba(51, 65, 85, 0.48)";
    const grayUnavail = "rgba(148, 163, 184, 0.34)";
    const grayStroke = "rgba(71, 85, 105, 0.5)";
    if (mode === "ortho_pdam") {
      /** 미시공은 RGB·평면 폴백 없이 회색(시공 말뚝만 정사 적합도 색). */
      if (!installed) {
        return { fill: grayUnavail, stroke: grayStroke, dotRScale: 1 };
      }
      const fit = orthoFitOverride || meissa2dGetOrthoPdamRgbFit(circle, { forceSync: false });
      if (fit.reason === "pending") {
        return {
          fill: "rgba(148, 186, 222, 0.38)",
          stroke: "rgba(71, 105, 138, 0.52)",
          dotRScale: 1.04,
        };
      }
      // 정사·시공 적합도에서는 미판정을 planD(평면) 색으로 폴백하면 "초록으로 계산됨"처럼 보일 수 있다.
      if (fit.tier === "na") return { fill: grayUnavail, stroke: grayStroke, dotRScale: 1 };
      /** 캡(저대비) 말뚝은 등급(초록/노랑/주황)과 관계없이 보라로 표시 */
      if (
        fit.pileCapped &&
        (fit.tier === "ok" || fit.tier === "yellow" || fit.tier === "orange")
      ) {
        const rs = fit.tier === "ok" ? 1.08 : fit.tier === "yellow" ? 1.12 : 1.16;
        return {
          fill: "rgba(167, 139, 250, 0.42)",
          stroke: "rgba(91, 33, 182, 0.55)",
          dotRScale: rs,
        };
      }
      if (fit.tier === "red") {
        return { fill: "rgba(220, 38, 38, 0.48)", stroke: "rgba(127, 29, 29, 0.58)", dotRScale: 1.28 };
      }
      if (fit.tier === "orange") {
        return { fill: "rgba(234, 88, 12, 0.44)", stroke: "rgba(154, 52, 18, 0.55)", dotRScale: 1.22 };
      }
      if (fit.tier === "yellow") {
        return { fill: "rgba(202, 138, 4, 0.42)", stroke: "rgba(113, 63, 18, 0.52)", dotRScale: 1.14 };
      }
      return { fill: "rgba(45, 170, 108, 0.44)", stroke: "rgba(4, 120, 87, 0.52)", dotRScale: 1.12 };
    }

    if (mode === "mz_zone") {
      if (!installed) {
        return { fill: grayUnavail, stroke: grayStroke, dotRScale: 1 };
      }
      if (
        !rec ||
        rec.meissaZ == null ||
        rec.meissaZoneResidual == null ||
        !Number.isFinite(Number(rec.meissaZoneResidual))
      ) {
        return { fill: grayUnavail, stroke: grayStroke, dotRScale: 1 };
      }
      const t = meissaNormResidual01(Number(rec.meissaZoneResidual), state.meissaZoneResidualExtent);
      const rgb = meissaHeatRgb01(t);
      const fill = `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, 0.44)`;
      const stroke = `rgba(${Math.round(rgb[0] * 140 + 50)}, ${Math.round(rgb[1] * 140 + 40)}, ${Math.round(rgb[2] * 140 + 45)}, 0.58)`;
      return { fill, stroke, dotRScale: 1.16 };
    }
    if (mode === "remaining") {
      const raw = row?.pileRemaining;
      const n = raw != null && String(raw).trim() !== "" ? parseFloat(String(raw).replace(/,/g, "")) : NaN;

      if (!state.pdamByCircleId || state.pdamByCircleId.size === 0) {
        return { fill: neutralFill, stroke: neutralStroke, dotRScale: 1 };
      }
      if (!Number.isFinite(n)) {
        if (installed) {
          return {
            fill: "rgba(52, 211, 153, 0.44)",
            stroke: "rgba(4, 120, 87, 0.52)",
            dotRScale: 1.28,
          };
        }
        return { fill: neutralFill, stroke: neutralStroke, dotRScale: 1 };
      }
      const bi = meissaRemainingBandIndex(n);
      if (bi < 0) {
        return { fill: neutralFill, stroke: neutralStroke, dotRScale: installed ? 1.15 : 1 };
      }
      const fillHex = MEISSA_REMAINING_BAND_FILL[bi] || "#94a3b8";
      const strokeStr = MEISSA_REMAINING_BAND_STROKE[bi] || neutralStroke;
      const fill = meissa2dHexToRgba(fillHex, 0.4);
      const stroke = String(strokeStr).replace(/0\.95\)/, "0.48)");
      return { fill, stroke, dotRScale: installed ? 1.24 : 1 };
    }
    return { fill: neutralFill, stroke: neutralStroke, dotRScale: 1 };
  }

  function meissa2dBuildPickTooltip(circle, orthoFitOverride) {
    const labelRaw = String(circle?.matched_text?.text ?? "").trim() || "(번호 없음)";
    const bracket = meissa2dFormatCircleLocationBracket(circle);
    const label = bracket ? `${labelRaw}\n${bracket}` : labelRaw;
    const cx = Number(circle?.center_x);
    const cy = Number(circle?.center_y);
    const cz = circle?.center_z != null && Number.isFinite(Number(circle.center_z)) ? Number(circle.center_z) : null;
    const row = state.pdamByCircleId?.get?.(String(circle?.id ?? ""));
    let pdamLine = "";
    if (row && state.pdamByCircleId?.size) {
      pdamLine = isPdamCircleMappingInstalled(row)
        ? `PDAM: 시공${row.constructionDate ? ` (${row.constructionDate})` : ""}`
        : "PDAM: 미시공";
      if (row.pileRemaining != null && String(row.pileRemaining).trim() !== "") {
        pdamLine += `\nPDAM 잔량: ${row.pileRemaining}`;
      }
    }
    const cmp = state.meissaCompareByCircleId?.get?.(String(circle?.id ?? ""));
    const tipMode = meissa2dColorModeValue();
    if (cmp && tipMode === "mz_zone") {
      if (cmp.zoneKey) pdamLine += `\n구역: ${String(cmp.zoneKey).replace(/\t/g, " · ")}`;
      if (cmp.meissaZ != null && Number.isFinite(Number(cmp.meissaZ))) pdamLine += `\nMeissa Z: ${Number(cmp.meissaZ).toFixed(3)}`;
      if (cmp.meissaZoneRefZ != null && Number.isFinite(Number(cmp.meissaZoneRefZ)))
        pdamLine += `\n구역 기준 Z: ${Number(cmp.meissaZoneRefZ).toFixed(3)}`;
      if (cmp.meissaZoneResidual != null && Number.isFinite(Number(cmp.meissaZoneResidual)))
        pdamLine += `\n구역 대비 |ΔZ|: ${Number(cmp.meissaZoneResidual).toFixed(3)} m`;
      if (cmp.pdamZVsPeersHint) pdamLine += `\n※ ${cmp.pdamZVsPeersHint}`;
    }
    if (cmp && tipMode === "ortho_pdam" && cmp.planD != null && Number.isFinite(Number(cmp.planD))) {
      pdamLine += `\n평면 편차: ${Number(cmp.planD).toFixed(3)} m`;
    }
    if (tipMode === "ortho_pdam") {
      const fit = orthoFitOverride || meissa2dGetOrthoPdamRgbFit(circle, { forceSync: false });
      if (
        fit?.tier === "na" &&
        (fit.reason === "not-installed" || fit.reason === "pending" || fit.reason === "analysis-image-loading")
      ) {
        const hardFallback = meissa2dBuildPlanFallbackFitById(String(circle?.id ?? ""), fit.reason || "soft-na", {});
        if (hardFallback) {
          fit.tier = hardFallback.tier;
          fit.offsetM = hardFallback.offsetM;
          fit.reason = hardFallback.reason;
          fit.detectMode = fit.detectMode || hardFallback.detectMode;
        }
      }
      if (fit.offsetM != null && Number.isFinite(fit.offsetM)) {
        pdamLine += `\n정사 추정 중심 오프셋: ${meissaOrthoFormatOffsetM(fit.offsetM)} m`;
        if (fit.patchDistDesignPx != null && Number.isFinite(fit.patchDistDesignPx)) {
          pdamLine += ` (도면대비 ${fit.patchDistDesignPx.toFixed(2)} px)`;
        }
      } else if (fit.tier === "na") {
        if (fit.reason === "pending") pdamLine += `\n정사 추정 오프셋: 계산 중…`;
        else pdamLine += `\n정사 추정 오프셋: (미산출)`;
      }
      if (fit.delta != null && Number.isFinite(fit.delta)) {
        pdamLine += `\n코어·링 명암차: ${fit.delta.toFixed(1)}`;
      }
      const dm = meissaOrthoDetectModeLabelKo(fit.detectMode);
      if (dm) pdamLine += `\n정사 검출: ${dm}`;
      if (fit.tier && fit.tier !== "na") pdamLine += `\n등급: ${meissaOrthoOffsetTierLabelKo(fit.tier)}`;
      if (fit.tier === "na" && fit.reason) pdamLine += ` (${fit.reason})`;
      pdamLine += meissaOrthoFootprintOverlapTooltipLines(fit.footprintOverlap);
    }
    const coordLine = `도면 X,Y,Z: ${Number.isFinite(cx) ? cx.toFixed(3) : "-"}, ${Number.isFinite(cy) ? cy.toFixed(3) : "-"}, ${cz != null ? cz.toFixed(3) : "-"}`;
    return [label, coordLine, pdamLine].filter(Boolean).join("\n");
  }

  function meissa2dPushPickHit(px, py, hitR, circle, orthoFitOverride) {
    meissa2dPickHits.push({
      x: px,
      y: py,
      r: Math.max(6, hitR),
      circle,
      fit: orthoFitOverride || null,
    });
  }

  function meissa2dClearExpiredInboundFocus() {
    if (meissaInboundFocus && Date.now() > meissaInboundFocus.until) meissaInboundFocus = null;
  }

  function meissaInboundPickTolerance(circles) {
    const b = getFileCoordBoundsFromCircles(circles);
    if (!b || b.n < 1) return 1;
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-9);
    return Math.max(span * 0.003, 0.05);
  }

  function meissa2dShouldHighlightCircle(circle) {
    meissa2dClearExpiredInboundFocus();
    if (!meissaInboundFocus || !circle) return false;
    return String(circle.id ?? "") === String(meissaInboundFocus.circleId);
  }

  function meissa2dDrawInboundFocusRing(ctx, px, py, dotR) {
    void dotR;
    const vs = meissa2dPanzoomScaleSanitized();
    const rOuter = 7.2 / vs;
    const rInner = 5 / vs;
    const lwO = Math.max(0.5, 1.45 / vs);
    const lwI = Math.max(0.4, 1.05 / vs);
    ctx.save();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.42)";
    ctx.lineWidth = lwO;
    ctx.beginPath();
    ctx.arc(px, py, rOuter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
    ctx.lineWidth = lwI;
    ctx.beginPath();
    ctx.arc(px, py, rInner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function meissa2dShouldShowPickHoverOrInboundRing(circle) {
    if (meissa2dShouldHighlightCircle(circle)) return true;
    if (meissa2dHoverCircleId == null || !circle) return false;
    return String(circle.id ?? "") === String(meissa2dHoverCircleId);
  }

  function meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, circle) {
    if (meissa2dShouldShowPickHoverOrInboundRing(circle)) meissa2dDrawInboundFocusRing(ctx, px, py, dotR);
  }

  function scheduleMeissa2dHoverRedraw() {
    if (meissa2dHoverRaf) cancelAnimationFrame(meissa2dHoverRaf);
    meissa2dHoverRaf = requestAnimationFrame(() => {
      meissa2dHoverRaf = 0;
      scheduleRenderMeissa2dPointsOverlay();
    });
  }

  function meissa2dSuppressHoverFor(ms) {
    const until = Date.now() + Math.max(0, Number(ms) || 0);
    if (until > meissa2dHoverSuppressUntil) meissa2dHoverSuppressUntil = until;
  }

  function setMeissa2dHoverPickFromBest(best) {
    if (Date.now() < meissa2dHoverSuppressUntil) return;
    const next = best?.circle != null ? String(best.circle.id ?? "") : "";
    const cur = meissa2dHoverCircleId == null ? "" : String(meissa2dHoverCircleId);
    if (cur === next) return;
    meissa2dHoverCircleId = next || null;
    scheduleMeissa2dHoverRedraw();
  }

  /**
   * cloud.meissa.ai 가 3D 피킹 시 부모로 보내는 메시지(동일 출처 + 아래 형식일 때만 처리).
   * 예: window.parent.postMessage({ type: "pilexy-3d-pick", center_x, center_y }, "https://…부모원본…");
   * 또는 circleId: PileXY 도면 원 id와 동일한 문자열.
   */
  function isMeissaInboundPickPayload(data) {
    if (!data || typeof data !== "object") return false;
    if (data.pilexyMeissaPick === true) return true;
    const t = String(data.type || "");
    return t === "pilexy-3d-pick" || t === "pilexy-from-3d";
  }

  function applyMeissaInboundFocusFromIframeData(data) {
    const circlesBase = Array.isArray(state.circles) ? state.circles : [];
    const circles =
      meissa2dColorModeValue() === "ortho_pdam"
        ? meissa2dDedupCirclesForOrthoPdam(circlesBase)
        : circlesBase;
    if (!circles.length) return;
    const cidRaw = data.circleId ?? data.circle_id ?? data.circleID;
    if (cidRaw != null && String(cidRaw).trim() !== "") {
      const cid = String(cidRaw);
      const hit = circles.find((c) => String(c?.id ?? "") === cid);
      if (hit) {
        meissaInboundFocus = { circleId: cid, until: Date.now() + 16000 };
        scheduleRenderMeissa2dPointsOverlay();
        return;
      }
    }
    const x = Number(data.center_x ?? data.fileX ?? data.planX ?? data.file_coord_x);
    const y = Number(data.center_y ?? data.fileY ?? data.planY ?? data.file_coord_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    let best = null;
    let bestD = Infinity;
    for (const c of circles) {
      const cx = Number(c?.center_x);
      const cy = Number(c?.center_y);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    const tol = meissaInboundPickTolerance(circles);
    if (best && Math.sqrt(bestD) <= tol) {
      meissaInboundFocus = { circleId: String(best.id), until: Date.now() + 16000 };
      scheduleRenderMeissa2dPointsOverlay();
    }
  }

  function bindMeissaCloudInboundMessages() {
    if (meissaCloudMessageBound) return;
    meissaCloudMessageBound = true;
    window.addEventListener("message", (ev) => {
      try {
        if (!ev || ev.origin !== MEISSA_CLOUD_ORIGIN) return;
        const data = ev.data;
        if (!data || typeof data !== "object") return;
        if (data.source === "pilexy") return;
        if (!isMeissaInboundPickPayload(data)) return;
        applyMeissaInboundFocusFromIframeData(data);
      } catch (_) {
        // ignore
      }
    });
  }

  function meissa2dDrawCircleLabel(ctx, px, py, circle, _circleCount) {
    const label = String(circle?.matched_text?.text ?? "").trim();
    if (!label) return;
    const vs = meissa2dPanzoomScaleSanitized();
    void _circleCount;
    // 캔버스 좌표는 panzoom 루트의 scale(vs)와 함께 커지므로, 글자는 (목표 화면 px)/vs 로 그려야 화면에서 일정함.
    // 예전 Math.max(4, …) 최소값 때문에 확대 시 4*vs 로 비정상 커지는 문제가 있었음.
    const targetScreenCssPx = 11.5;
    const fsCanvas = Math.max(0.65, targetScreenCssPx / vs);
    const off = Math.max(1.25, 5 / vs);
    const lw = Math.max(0.25, 2.2 / vs);
    ctx.save();
    ctx.font = `${fsCanvas}px ui-monospace, Consolas, "Courier New", monospace`;
    ctx.textBaseline = "bottom";
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.58)";
    ctx.strokeText(label, px + off, py - off);
    ctx.fillStyle = "rgba(248, 250, 252, 0.88)";
    ctx.fillText(label, px + off, py - off);
    ctx.restore();
  }

  function ensureMeissa2dOverlayTooltip() {
    let el = document.getElementById("meissa-2d-overlay-tooltip");
    if (!el) {
      el = document.createElement("div");
      el.id = "meissa-2d-overlay-tooltip";
      el.style.cssText =
        "position:fixed;z-index:9999;max-width:15rem;padding:3px 6px;border-radius:4px;font:10px/1.25 system-ui,sans-serif;white-space:pre-wrap;pointer-events:none;display:none;background:rgba(15,23,42,0.92);color:#cbd5e1;border:1px solid rgba(148,163,184,0.28);box-shadow:0 2px 10px rgba(0,0,0,0.28)";
      document.body.appendChild(el);
    } else {
      el.style.maxWidth = "15rem";
      el.style.padding = "3px 6px";
      el.style.fontSize = "10px";
      el.style.lineHeight = "1.25";
      el.style.borderRadius = "4px";
    }
    return el;
  }

  function setMeissa2dOverlayTooltip(text, clientX, clientY, show) {
    const el = ensureMeissa2dOverlayTooltip();
    if (!show) {
      el.style.display = "none";
      return;
    }
    el.textContent = text;
    el.style.display = "block";
    const pad = 14;
    let left = clientX + pad;
    let top = clientY + pad;
    const rw = el.getBoundingClientRect();
    if (left + rw.width > window.innerWidth - 8) left = Math.max(8, clientX - rw.width - pad);
    if (top + rw.height > window.innerHeight - 8) top = Math.max(8, clientY - rw.height - pad);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function contentCoordsFromMeissaOverlay(clientX, clientY) {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return null;
    const ptr = meissa2dOverlayPointerInContent(wrap, clientX, clientY);
    const s = Math.max(0.001, Number(meissa2dViewScale) || 1);
    return { x: (ptr.x - meissa2dViewTx) / s, y: (ptr.y - meissa2dViewTy) / s };
  }

  /**
   * 2D에서 말뚝(원)을 짧게 클릭하면 상단 Meissa iframe에 postMessage로 좌표를 보냅니다.
   * cloud.meissa.ai 가 이 메시지를 처리하지 않으면 3D 뷰는 바뀌지 않으며(교차 출처·비공개 API),
   * 이 경우에도 iframe 테두리만 잠시 강조합니다.
   */
  function tryMeissaCoordHintFromOverlay(clientX, clientY) {
    const iframeEl = els.meissaCloud3dFrame;
    if (!iframeEl) return;
    const cc = contentCoordsFromMeissaOverlay(clientX, clientY);
    if (!cc) return;
    let best = null;
    let bestD = 1e9;
    for (const h of meissa2dPickHits) {
      const d = Math.hypot(cc.x - h.x, cc.y - h.y);
      if (d <= h.r && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best?.circle) return;
    const c = best.circle;
    const fx = Number(c.center_x);
    const fy = Number(c.center_y);
    const fz = c.center_z != null && Number.isFinite(Number(c.center_z)) ? Number(c.center_z) : null;
    const label = String(c?.matched_text?.text ?? "").trim();
    const payload = {
      source: "pilexy",
      type: "pilexy-focus-plan",
      x: Number.isFinite(fx) ? fx : null,
      y: Number.isFinite(fy) ? fy : null,
      z: fz,
      label: label || null,
    };
    try {
      const win = iframeEl.contentWindow;
      if (win && typeof win.postMessage === "function") {
        win.postMessage(payload, MEISSA_CLOUD_ORIGIN);
      }
    } catch (_) {}
    iframeEl.classList.add("meissa-cloud-3d-frame--focus-hint");
    if (meissa2dIframeFocusHintTimer) window.clearTimeout(meissa2dIframeFocusHintTimer);
    meissa2dIframeFocusHintTimer = window.setTimeout(() => {
      iframeEl.classList.remove("meissa-cloud-3d-frame--focus-hint");
      meissa2dIframeFocusHintTimer = 0;
    }, 900);
    try {
      iframeEl.focus({ preventScroll: true });
    } catch (_) {}
  }

  function meissaZDebugNowStamp() {
    const d = new Date();
    return `${d.toLocaleTimeString("ko-KR", { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  }

  /** nearest-z 진행 로그를 즉시 화면에 반영(긴 await 동안에도 텍스트 보이게) */
  function syncMeissaZPipelineToDom(zPipe) {
    const lines = Array.isArray(zPipe) ? zPipe : [];
    const text = lines.join("\n");
    const liveEl = document.getElementById("meissa-z-debug-live");
    if (liveEl) {
      liveEl.textContent = text.trim()
        ? text
        : "PDAM 스냅샷을 로드하면 자동으로 비교·Meissa Z(nearest-z) 로그가 여기에 쌓입니다.";
    }
  }

  async function runCompare() {
    setStatus(els.compareStatus, "");
    /** @type {string[]} */
    const zPipe = [];
    const zLog = (msg) => {
      zPipe.push(`[${meissaZDebugNowStamp()}] ${msg}`);
      syncMeissaZPipelineToDom(zPipe);
    };
    zLog("비교 계산 시작");

    const datasetId = els.dataset?.value;
    if (!datasetId) {
      zLog("중단: 데이터셋 미선택");
      renderMeissaZDebugPanel([], [], "—", "데이터셋을 선택한 뒤 PDAM 스냅샷을 로드하세요.", zPipe);
      setStatus(els.compareStatus, "데이터셋을 선택하세요.", true);
      return;
    }
    zLog(`데이터셋 선택됨 (id 길이 ${String(datasetId).length})`);
    const dateTo = resolvedDateTo();
    if (!dateTo) {
      zLog("중단: 스냅샷 기준일(dateTo) 없음");
      renderMeissaZDebugPanel([], [], "—", "기준일을 지정한 뒤 다시 실행하세요.", zPipe);
      setStatus(els.compareStatus, "스냅샷 기준일을 지정하세요.", true);
      return;
    }
    zLog(`PDAM 기준일 dateTo=${dateTo}`);

    await ensureCompareCirclesLoaded();
    zLog(`도면 원 ${state.circles?.length ?? 0}개 (비교 전 동기화 후)`);

    const ox = parseNumber(els.offsetX?.value) || 0;
    const oy = parseNumber(els.offsetY?.value) || 0;
    const radius = parseNumber(els.terrainRadius?.value) || 12;
    zLog(`오프셋 X=${ox}, Y=${oy} · 지형 반경=${radius}`);

    const ptsFromCircles = buildComparePointsFromCircles(state.circles).map((p) => ({
      ...p,
      x: p.x + ox,
      y: p.y + oy,
    }));
    let pts = ptsFromCircles;
    if (!pts.length) {
      zLog(`중단: 비교 점 0건 (도면 원 ${state.circles?.length ?? 0}개, 말뚝 매칭 필요)`);
      renderMeissaZDebugPanel(
        [],
        [],
        "—",
        "비교할 점이 없습니다. 메인 도면에서 말뚝이 매칭된 원이 있는지 확인하세요.",
        zPipe
      );
      setStatus(
        els.compareStatus,
        "비교할 점이 없습니다. 메인 도면의 말뚝 매칭 원을 확인하세요.",
        true
      );
      return;
    }
    zLog(`비교 점 ${pts.length}건 (오프셋 반영 후 첫 점 X=${pts[0].x}, Y=${pts[0].y}, 파일=${pts[0].pileRaw ?? "?"})`);

    setStatus(els.compareStatus, "PDAM과 맞추는 중…");
    zLog("PDAM 대시보드 API 호출 전 · loadCirclesIfNeeded …");
    renderMeissaZDebugPanel([], [], "—", "PDAM·Meissa Z 처리 중…(아래 로그 참고)", zPipe);
    try {
      await loadCirclesIfNeeded();
      zLog(`도면 원 ${state.circles.length}개 (loadCirclesIfNeeded 후)`);
      if (!state.circles.length) {
        zLog("중단: circles 배열 비어 있음");
        renderMeissaZDebugPanel(
          pts,
          [],
          "—",
          "도면 원이 비어 있어 PDAM 비교를 중단했습니다.",
          zPipe
        );
        setStatus(els.compareStatus, "도면 원(circles)이 비어 있습니다. 부모 창에서 도면 원을 받아 오세요.", true);
        return;
      }
      const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
      /** @type {Array<Record<string, unknown>>} */
      let meissaNearestResponses = [];
      let meissaZSkipHint = "";
      let zidForNearestZ = "";
      let willRunNearestZ = false;
      if (!sid) {
        meissaZSkipHint = "촬영일(스냅샷)이 없어 Meissa 점군 Z 조회를 건너뜁니다.";
        zLog("nearest-z 건너뜀: 스냅샷 ID 없음(셀렉트·hidden 입력 확인)");
      } else if (!meissaAccess) {
        meissaZSkipHint = "Meissa 로그인이 없어 점군 Z 조회를 건너뜁니다.";
        zLog("nearest-z 건너뜀: Meissa JWT 없음(로그인 또는 저장된 토큰 확인)");
      } else {
        willRunNearestZ = true;
        zidForNearestZ =
          (els.meissaZoneSelect?.value || "").trim() ||
          (els.zoneId?.value || "").trim();
        const tokLen = String(meissaAccess).length;
        const pidPreview = (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
        zLog(
          `Z 조회 예정: DSM tif 일괄(우선) 또는 nearest-z 폴백 · snapshotId=${sid}, projectId=${pidPreview || "(없으면 DSM 생략)"}, zoneId=${zidForNearestZ || "auto"}, 점 ${pts.length}건`
        );
        const sampleQ = new URLSearchParams({
          x: String(pts[0].x),
          y: String(pts[0].y),
          limit: "8000",
          max_phases: "4",
        });
        if (zidForNearestZ) sampleQ.set("zone_id", zidForNearestZ);
        const samplePath = `/api/meissa/snapshots/${encodeURIComponent(sid)}/nearest-z?${sampleQ.toString()}`;
        zLog(`nearest-z 폴백 시 URL 예시(1번 점): ${API_BASE_URL || "(origin)"}${samplePath}`);
      }

      const tSeq0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      zLog("① POST 대시보드(시공 집계) …");
      setStatus(els.compareStatus, "PDAM 대시보드 불러오는 중…");
      const data = await postDashboard(buildDashboardPayload({ dateTo }));
      const tDashDone = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      zLog(`① 대시보드 완료: ${((tDashDone - tSeq0) / 1000).toFixed(2)}s`);

      const pdamEarly = buildMappingByCircleId(data);
      const circleByPileForZ = buildCircleMapByPile(state.circles);
      const circleByIdForZ = buildCircleMapById(state.circles);
      pts = sortComparePointsForZFetch(pts, circleByPileForZ, pdamEarly, circleByIdForZ);
      zLog("Z 조회 순서: PDAM 시공·잔량0 우선 정렬(동일 구역 내 우선 처리)");

      /** @type {Array<Record<string, unknown>>} */
      let zArr = [];
      let dbgNeedZCount = -1;
      let dbgSubPtsLen = -1;
      if (willRunNearestZ && sid && meissaAccess) {
        const needZ = pts.map((p) => pointNeedsMeissaZFetch(p, circleByPileForZ, pdamEarly, circleByIdForZ));
        const subPts = pts.filter((_, i) => needZ[i]);
        dbgNeedZCount = needZ.filter(Boolean).length;
        dbgSubPtsLen = subPts.length;
        const nSkip = pts.length - subPts.length;
        if (nSkip > 0) zLog(`② Meissa Z 생략 ${nSkip}건(미시공) · API 대상 ${subPts.length}건`);
        if (subPts.length === 0) {
          zLog("② Meissa Z: 시공(installed) 말뚝 없음 — API 호출 없음");
          zArr = needZ.map(() => ({ ok: false, message: "skipped-not-installed" }));
        } else {
          setStatus(els.compareStatus, `Meissa Z 조회 중… (${subPts.length}건, 미시공 제외)`);
          const tZ0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const projectIdForZ =
            (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
          /** @type {Array<Record<string, unknown>>} */
          let subZArr = [];
          let usedDsmBatch = false;
          if (projectIdForZ) {
            zLog(
              `② Carta DSM 일괄 · ${subPts.length}건(시공만) — nearest-z ${subPts.length}회 대비 1회 다운로드`
            );
            try {
              const dsm = await fetchMeissaDsmZBatch(sid, projectIdForZ, subPts);
              const results = Array.isArray(dsm.results) ? dsm.results : [];
              if (dsm.ok !== false && results.length === subPts.length) {
                subZArr = results;
                usedDsmBatch = true;
                const tZ1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
                const okN = subZArr.filter((r) => r && r.ok === true).length;
                zLog(
                  `② DSM 일괄 완료: ${((tZ1 - tZ0) / 1000).toFixed(2)}s · 성공 ${okN}/${subPts.length} · ${String(dsm.message || "").slice(0, 120)}`
                );
                if (dsm.crs) zLog(`DSM 래스터 CRS: ${dsm.crs}`);
              } else {
                zLog(
                  `② DSM 일괄 불가: ${String(dsm.message || "응답 없음").slice(0, 200)} → nearest-z 폴백`
                );
              }
            } catch (e) {
              zLog(`② DSM 예외: ${String(e?.message || e).slice(0, 160)} → nearest-z 폴백`);
            }
          } else {
            zLog("② DSM 건너뜀: 프로젝트 ID 없음 → nearest-z만 사용");
          }
          if (!usedDsmBatch) {
            zLog(
              `② nearest-z 시작 · ${subPts.length}건 · 동시 4 · 단건 타임아웃 ${Math.round(MEISSA_NEAREST_Z_FETCH_MS / 1000)}s`
            );
            let lastZProg = 0;
            subZArr = await fetchMeissaNearestZBatch(sid, subPts, 4, zidForNearestZ, (done, total) => {
              if (done === 0) {
                zLog(`nearest-z 워커 실행(동시 4)`);
                return;
              }
              const step = total > 800 ? 250 : total > 200 ? 100 : 25;
              if (done === total || done - lastZProg >= step) {
                lastZProg = done;
                zLog(`nearest-z 진행 ${done}/${total}`);
              }
            });
            const tZ1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
            const okN = subZArr.filter((r) => r && r.ok === true).length;
            const failN = subZArr.length - okN;
            zLog(`② nearest-z 완료: ${((tZ1 - tZ0) / 1000).toFixed(2)}s · 성공 ${okN}/${subPts.length} · 실패 ${failN}`);
            if (failN > 0) {
              const samples = [];
              subZArr.forEach((r, i) => {
                if (r && r.ok) return;
                const msg = r && (r.message || r.detail) ? String(r.message || r.detail) : "ok 아님";
                if (samples.length < 6) samples.push(`#${i + 1}:${msg.slice(0, 120)}`);
              });
              zLog(`실패 샘플: ${samples.join(" | ")}`);
            }
            const firstOk = subZArr.find((r) => r && r.ok === true);
            if (firstOk) {
              zLog(
                `첫 성공 샘플 키: ${Object.keys(firstOk).slice(0, 12).join(", ")}${Object.keys(firstOk).length > 12 ? "…" : ""}`
              );
            }
          } else {
            const failN = subZArr.filter((r) => !r || r.ok !== true).length;
            if (failN > 0) {
              const samples = [];
              subZArr.forEach((r, i) => {
                if (r && r.ok) return;
                const msg = r && (r.message || r.detail) ? String(r.message || r.detail) : "ok 아님";
                if (samples.length < 6) samples.push(`#${i + 1}:${msg.slice(0, 120)}`);
              });
              zLog(`DSM 샘플 실패 건 ${failN} · 샘플: ${samples.join(" | ")}`);
            }
            const firstOk = subZArr.find((r) => r && r.ok === true);
            if (firstOk) {
              zLog(
                `첫 성공 샘플 키: ${Object.keys(firstOk).slice(0, 12).join(", ")}${Object.keys(firstOk).length > 12 ? "…" : ""}`
              );
            }
          }
          let si = 0;
          zArr = needZ.map((nz) => (nz ? subZArr[si++] : { ok: false, message: "skipped-not-installed" }));
        }
      }

      const tSeq1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      zLog(`PDAM→Z 순차 처리 끝: 총 ${((tSeq1 - tSeq0) / 1000).toFixed(2)}s`);
      const zArrRaw = Array.isArray(zArr) ? zArr : [];
      meissaNearestResponses = zArrRaw;
      state.lastDashboard = data;
      state.pdamByCircleId = buildMappingByCircleId(data);
      const circles = state.circles;
      const circleByPile = buildCircleMapByPile(circles);
      const circleById = buildCircleMapById(circles);
      const mappingByCircle = state.pdamByCircleId;
      state.lastMeissaNearestZResponses = meissaNearestResponses;

      const compareRecords = [];
      pts.forEach((p, idx) => {
        const circle = circleForComparePoint(p, circleById, circleByPile);
        const terrainZ = p.z != null ? terrainProxyZ(pts, idx, radius) : null;
        const zDelta = p.z != null && terrainZ != null ? p.z - terrainZ : null;
        let planNum = null;
        let mapRow = null;
        if (circle) {
          const cx = circle.center_x;
          const cy = circle.center_y;
          planNum = Math.hypot(p.x - cx, p.y - cy);
          mapRow = mappingByCircle.get(String(circle.id)) || null;
        }
        const remRaw = mapRow?.pileRemaining;
        const remNum = remRaw != null && remRaw !== "" ? parseNumber(remRaw) : NaN;
        const mzResp = meissaNearestResponses[idx];
        const mzOk = mzResp && mzResp.ok === true;
        const mzZ = mzOk && Number.isFinite(Number(mzResp.z)) ? Number(mzResp.z) : null;
        const mzDist = mzOk && Number.isFinite(Number(mzResp.distancePlanar)) ? Number(mzResp.distancePlanar) : null;
        const mzNote = meissaZFetchNoteFromResponse(mzResp, mzOk);
        compareRecords.push({
          pileRaw: p.pileRaw,
          x: p.x,
          y: p.y,
          z: p.z,
          planD: planNum,
          terrainZ,
          zDelta,
          meissaZ: mzZ,
          meissaZDist: mzDist,
          meissaZFetchNote: mzNote || null,
          pileRemaining: Number.isFinite(remNum) ? remNum : null,
          hasCircle: Boolean(circle),
          pdamStatus: isPdamCircleMappingInstalled(mapRow) ? "installed" : mapRow?.status || null,
          circleId: circle?.id || null,
          zoneKey: circle ? meissaZoneKeyFromCircle(circle) : "",
        });
      });
      const enrichedRecords = enrichCompareRecordsZoneAndResidual(compareRecords);
      state.lastCompareRecords = enrichedRecords;
      bumpMeissa2dOrthoRgbFitCache();
      state.meissaCompareByCircleId = new Map(
        enrichedRecords
          .filter((r) => r.circleId != null && String(r.circleId).trim() !== "")
          .map((r) => [String(r.circleId), r])
      );
      renderMeissaZoneZSummary(enrichedRecords);
      renderMeissaCompareTierSummary(enrichedRecords);
      const frag = renderMeissaCompareResultRows(enrichedRecords, circleByPile);
      if (els.resultBody) {
        els.resultBody.innerHTML = "";
        els.resultBody.appendChild(frag);
      } else {
        zLog("경고: #meissa-result-body 없음 — 비교 표는 생략, Z 디버그만 갱신");
      }
      zLog("비교 표·디버그 테이블 갱신 완료");
      renderMeissaZDebugPanel(pts, meissaNearestResponses, sid || "—", meissaZSkipHint, zPipe);
      const mzOkCount = meissaNearestResponses.filter((r) => r && r.ok).length;
      const statusExtra =
        sid && meissaAccess
          ? ` Meissa Z 성공 ${mzOkCount}/${pts.length}건.`
          : meissaZSkipHint
            ? ` ${meissaZSkipHint}`
            : "";
      setStatus(els.compareStatus, `행 ${pts.length}건 계산 완료.${statusExtra}`);
      scheduleRenderMeissa2dPointsOverlay();
      await refreshMeissa3d();
    } catch (e) {
      const errMsg = e?.message || String(e);
      zLog(`예외: ${errMsg}`);
      renderMeissaZoneZSummary([]);
      renderMeissaCompareTierSummary([]);
      const sidErr = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim() || "—";
      renderMeissaZDebugPanel(
        Array.isArray(pts) && pts.length ? pts : [],
        state.lastMeissaNearestZResponses || [],
        sidErr,
        `비교 중 오류: ${errMsg}`,
        zPipe
      );
      setStatus(els.compareStatus, errMsg, true);
    }
  }

  function fmt(n) {
    if (n == null || Number.isNaN(n)) return "-";
    if (typeof n === "number") return Number.isInteger(n) ? String(n) : n.toFixed(3);
    return String(n);
  }

  /** Carta export/dsm/dsm.tif 1회 + 서버에서 좌표 일괄 샘플(nearest-z N회 대체). */
  async function fetchMeissaDsmZBatch(snapshotId, projectId, points) {
    const sid = String(snapshotId || "").trim();
    const pid = String(projectId || "").trim();
    if (!sid || !pid || !meissaAccess) {
      return { ok: false, results: [], message: "스냅샷·프로젝트·JWT 필요" };
    }
    const path = `/api/meissa/snapshots/${encodeURIComponent(sid)}/dsm-z-batch?${new URLSearchParams({
      project_id: pid,
    })}`;
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}${path}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `JWT ${meissaAccess}`,
          },
          body: JSON.stringify({
            points: (points || []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
          }),
        },
        3600000
      );
      return await meissaParseJsonResponse(res);
    } catch (e) {
      return { ok: false, results: [], message: e?.message || String(e) };
    }
  }

  /**
   * /api/meissa/.../nearest-z — zoneIdForZ 가 있으면 Meissa 포인트 어노테이션(DSM) Z를 먼저 시도 후 점군 폴백.
   * @returns {Promise<Record<string, unknown>>}
   */
  async function fetchMeissaNearestZSnapshot(snapshotId, x, y, zoneIdForZ) {
    const sid = String(snapshotId || "").trim();
    if (!sid || !meissaAccess) {
      return { ok: false, message: "Meissa 로그인 또는 스냅샷 ID 없음" };
    }
    const xn = Number(x);
    const yn = Number(y);
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) {
      return { ok: false, message: "좌표 숫자 아님" };
    }
    const q = new URLSearchParams({
      x: String(xn),
      y: String(yn),
      limit: "8000",
      max_phases: "4",
    });
    const zZ = String(zoneIdForZ || "").trim();
    if (zZ) q.set("zone_id", zZ);
    const path = `/api/meissa/snapshots/${encodeURIComponent(sid)}/nearest-z?${q.toString()}`;
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}${path}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `JWT ${meissaAccess}`,
          },
        },
        MEISSA_NEAREST_Z_FETCH_MS
      );
      return await meissaParseJsonResponse(res);
    } catch (e) {
      return { ok: false, message: e?.message || String(e) };
    }
  }

  /**
   * @param {string} snapshotId
   * @param {Array<{ x: number, y: number }>} points
   * @param {number} [concurrency]
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  /**
   * @param {(done: number, total: number) => void} [onProgress]
   */
  async function fetchMeissaNearestZBatch(snapshotId, points, concurrency, zoneIdForZ, onProgress) {
    const n = points.length;
    if (!n) return [];
    const out = /** @type {Array<Record<string, unknown>>} */ (new Array(n));
    let next = 0;
    let doneCount = 0;
    if (typeof onProgress === "function") {
      try {
        onProgress(0, n);
      } catch (_) {
        /* ignore */
      }
    }
    const workers = Math.max(1, Math.min(Number(concurrency) || 4, n));
    async function worker() {
      while (true) {
        const i = next;
        next += 1;
        if (i >= n) break;
        out[i] = await fetchMeissaNearestZSnapshot(snapshotId, points[i].x, points[i].y, zoneIdForZ);
        doneCount += 1;
        if (typeof onProgress === "function") {
          try {
            onProgress(doneCount, n);
          } catch (_) {
            /* ignore */
          }
        }
      }
    }
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return out;
  }

  /**
   * @param {Array<{ pileRaw?: string, x: number, y: number }>} pts
   * @param {Array<Record<string, unknown>>} responses
   * @param {string} snapshotId
   * @param {string} [skipReason]
   * @param {string[]|null|undefined} [pipelineLines] 비교 계산 단계 로그(상단 설명 아래 pre)
   */
  function scrollMeissaZDebugIntoView() {
    const det = document.getElementById("meissa-z-debug-details");
    if (!det) return;
    try {
      det.open = true;
    } catch (_) {
      try {
        det.setAttribute("open", "");
      } catch (_) {
        /* ignore */
      }
    }
    const run = () => {
      try {
        det.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch (_) {
        /* ignore */
      }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  function renderMeissaZDebugPanel(pts, responses, snapshotId, skipReason, pipelineLines) {
    const tbody = els.meissaZDebugBody || document.getElementById("meissa-z-debug-body");
    const noteEl = els.meissaZDebugNote || document.getElementById("meissa-z-debug-note");
    const liveEl = document.getElementById("meissa-z-debug-live");
    if (liveEl && pipelineLines != null) {
      const pipeFull = Array.isArray(pipelineLines) ? pipelineLines.join("\n") : String(pipelineLines || "");
      liveEl.textContent = pipeFull.trim()
        ? pipeFull
        : "PDAM 스냅샷을 로드하면 자동으로 비교·Meissa Z(nearest-z) 로그가 여기에 쌓입니다.";
    }
    if (!tbody) return;
    tbody.innerHTML = "";
    if (noteEl) {
      const intro =
        "PDAM 스냅샷 로드 후 자동 비교 시 Meissa에서 Z를 조회합니다. 평면거리는 비교 (X,Y)와 샘플 위치의 수평거리(m)이며, 0에 가깝면 근처 격자/점에서 읽은 값입니다. 로그인·촬영일(스냅샷) 필요, 좌표계는 Meissa와 동일해야 합니다.";
      if (skipReason) {
        noteEl.textContent = `${intro}\n\n현재: ${skipReason}`;
      } else {
        noteEl.textContent = `${intro}\n\n스냅샷 ${snapshotId}: nearest-z ${pts.length}건 (존 선택 시 DSM→점군 순). 아래 표는 건별 샘플 요약입니다.`;
      }
    }
    if (skipReason && (!responses || !responses.length)) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.className = "meissa-note";
      td.textContent = skipReason;
      tr.appendChild(td);
      tbody.appendChild(tr);
      scrollMeissaZDebugIntoView();
      return;
    }
    pts.forEach((p, idx) => {
      const r = responses[idx] || {};
      const ok = Boolean(r.ok);
      const tr = document.createElement("tr");
      const mz = ok && Number.isFinite(Number(r.z)) ? Number(r.z) : null;
      const md = ok && Number.isFinite(Number(r.distancePlanar)) ? Number(r.distancePlanar) : null;
      const cells = [
        String(p.pileRaw ?? ""),
        fmt(p.x),
        fmt(p.y),
        mz != null ? fmt(mz) : "-",
        md != null ? fmt(md) : "-",
        ok ? String(r.parser || "") : "-",
        ok ? String(r.resourceId ?? "") : "-",
        ok ? String(r.note || "").trim() || "—" : String(r.message || r.detail || "실패"),
      ];
      cells.forEach((text, i) => {
        const td = document.createElement("td");
        if ([1, 2, 3, 4].includes(i)) td.className = "num";
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    scrollMeissaZDebugIntoView();
  }

  function requestCirclesFromMainOrOpener(silent) {
    const isSilent = Boolean(silent);
    if (!isSilent) setStatus(els.compareStatus, "");
    if (typeof window.__PILEXY_GET_MEISSA_CONTEXT__ === "function") {
      try {
        const ctx = window.__PILEXY_GET_MEISSA_CONTEXT__();
        state.circles = ctx.circles || [];
        renderMeissa2dPointsOverlay();
        if (ctx.workId && els.workId && !els.workId.value.trim()) els.workId.value = ctx.workId;
        if (!isSilent) setStatus(els.compareStatus, `도면 원 ${state.circles.length}개 반영.`);
      } catch (e) {
        if (!isSilent) setStatus(els.compareStatus, e.message || String(e), true);
      }
      return;
    }
    if (!window.opener) {
      if (!isSilent) {
        setStatus(
          els.compareStatus,
          "메인 「파일 마스터」 페이지에서 드론(3D) 비교를 열거나, 단독 창이면 부모 탭에서 이 페이지를 연 뒤 다시 시도하세요.",
          true
        );
      }
      return;
    }
    const origin = window.location.origin;
    let done = false;
    const onMsg = (ev) => {
      if (ev.origin !== origin) return;
      if (ev.data?.type !== "pilexy-meissa-circles") return;
      done = true;
      window.removeEventListener("message", onMsg);
      const payload = ev.data.payload || {};
      state.circles = payload.circles || [];
      renderMeissa2dPointsOverlay();
      if (payload.workId && els.workId && !els.workId.value.trim()) els.workId.value = payload.workId;
      if (!isSilent) setStatus(els.compareStatus, `원 ${state.circles.length}개 수신.`);
    };
    window.addEventListener("message", onMsg);
    try {
      window.opener.postMessage({ type: "meissa-request-circles" }, origin);
    } catch (e) {
      window.removeEventListener("message", onMsg);
      if (!isSilent) setStatus(els.compareStatus, "postMessage 실패: " + (e.message || String(e)), true);
      return;
    }
    setTimeout(() => {
      if (done) return;
      window.removeEventListener("message", onMsg);
      if (!isSilent) setStatus(els.compareStatus, "응답 시간 초과. 메인 창이 같은 주소인지 확인하세요.", true);
    }, 4000);
  }

  function withMeissaAccessTokenQuery(url, key) {
    const t = (meissaAccess || "").trim();
    if (!t) return url;
    const sep = String(url).includes("?") ? "&" : "?";
    const queryKey = key || "token";
    return `${url}${sep}${encodeURIComponent(queryKey)}=${encodeURIComponent(t)}`;
  }

  function buildTokenizedUrlCandidates(baseUrl) {
    return MEISSA_TOKEN_QUERY_KEYS.map((k) => withMeissaAccessTokenQuery(baseUrl, k));
  }

  function loadIframeWithTimeout(iframe, url, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        iframe.removeEventListener("load", onLoad);
        resolve();
      };
      const onLoad = () => finish();
      iframe.addEventListener("load", onLoad);
      iframe.src = url;
      window.setTimeout(finish, timeoutMs);
    });
  }

  /** React/MUI 제어 input에 값을 넣을 때 native setter + input 이벤트 */
  function setReactControlledInput(el, value) {
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * 아래 iframe 안 Meissa 로그인 폼에 위에서 입력한 이메일·비밀번호를 넣고 로그인 버튼을 누릅니다.
   * cloud.meissa.ai 는 다른 출처이면 브라우저가 document 접근을 막아 대부분 환경에서는 동작하지 않습니다.
   * (개발용·동일 출처 프록시 등 예외에서만 성공 가능)
   */
  function trySubmitMeissaCloudLoginViaIframeDom(silent) {
    const email = (els.meissaEmail?.value || "").trim();
    const password = els.meissaPassword?.value || "";
    if (!email || !password) {
      if (!silent) setStatus(els.meissaApiStatus, "먼저 위에 이메일·비밀번호를 입력하세요.", true);
      return false;
    }
    const iframe = els.meissaCloud3dFrame;
    if (!iframe?.contentWindow) {
      if (!silent) setStatus(els.meissaApiStatus, "아래 Meissa 영역(iframe)이 없습니다.", true);
      return false;
    }
    let doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (err) {
      if (!silent) {
        setStatus(
          els.meissaApiStatus,
          "다른 사이트(cloud.meissa.ai) iframe 안의 입력칸에는 보안 정책 때문에 이 페이지에서 접근할 수 없습니다. 자동 로그인 토큰 방식을 사용합니다.",
          true
        );
      }
      return false;
    }
    const em =
      doc.querySelector('input[type="email"]') ||
      doc.querySelector('input[name="email"]') ||
      doc.querySelector('input[autocomplete="username"]') ||
      doc.querySelector('input[autocomplete="email"]');
    const pw =
      doc.querySelector("#outlined-password") ||
      doc.querySelector('input[name="password"]') ||
      doc.querySelector('input[type="password"]');
    const btn =
      doc.querySelector('[data-cy="loginButton"]') ||
      doc.querySelector('button[type="submit"]');
    if (!em || !pw || !btn) {
      if (!silent) {
        setStatus(
          els.meissaApiStatus,
          "아래 화면에서 로그인 필드를 찾지 못했습니다. 로딩 후 다시 시도하거나 자동 토큰 로그인을 사용하세요.",
          true
        );
      }
      return false;
    }
    setReactControlledInput(em, email);
    setReactControlledInput(pw, password);
    btn.click();
    if (!silent) setStatus(els.meissaApiStatus, "아래 Meissa 로그인 폼에 값을 넣고 로그인을 눌렀습니다.");
    return true;
  }

  /**
   * Meissa 웹앱은 일부 API와 동일하게 URL 쿼리 `token`(액세스 JWT)으로 인증할 수 있습니다.
   * 위에서 로그인해 받은 토큰을 3D 경로에 붙이면 iframe·새 탭 모두 별도 웹 로그인 없이 열리는 경우가 많습니다.
   * (토큰이 주소에 노출되므로 이 링크는 공유하지 마세요.)
   */
  function buildMeissaCloud3dUrl(projectId, zoneId, snapshotId) {
    const base = `${MEISSA_CLOUD_ORIGIN}/projects/${encodeURIComponent(projectId)}/zones/${encodeURIComponent(zoneId)}/snapshots/${encodeURIComponent(snapshotId)}/3d`;
    return withMeissaAccessTokenQuery(base);
  }

  /** 3D 뷰어(/3d) 없이 스냅샷 페이지만 연다. */
  function buildMeissaCloudSnapshotUrl(projectId, zoneId, snapshotId) {
    const base = `${MEISSA_CLOUD_ORIGIN}/projects/${encodeURIComponent(projectId)}/zones/${encodeURIComponent(zoneId)}/snapshots/${encodeURIComponent(snapshotId)}`;
    return withMeissaAccessTokenQuery(base);
  }

  function buildMeissaCartaTileUrl(projectId, snapshotId, z, x, y) {
    return `https://cs.carta.is/carta/workspace/${encodeURIComponent(String(projectId || "").trim())}/${encodeURIComponent(String(snapshotId || "").trim())}/universal/orthophoto/${encodeURIComponent(String(z))}/${encodeURIComponent(String(x))}/${encodeURIComponent(String(y))}.png`;
  }

  function clearMeissa2dPendingTimers() {
    if (!Array.isArray(meissa2dPendingTimers) || !meissa2dPendingTimers.length) return;
    meissa2dPendingTimers.forEach((id) => {
      try {
        window.clearTimeout(id);
      } catch (_) {
        // ignore
      }
    });
    meissa2dPendingTimers = [];
  }

  function activeSnapshotIdNow() {
    return (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
  }

  function isMeissa2dLoadCurrent(seq, sid) {
    return Number(seq) === Number(meissa2dLoadSeq) && String(activeSnapshotIdNow()) === String(sid || "");
  }

  function setMeissa2dRawUrlForSnapshot(sid, nextUrl) {
    const key = String(sid || "").trim();
    const u = String(nextUrl || "").trim();
    if (!key || !u) return;
    const prev = meissa2dRawUrlBySnapshot.get(key);
    if (prev && prev !== u && String(prev).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(prev);
      } catch (_) {
        // ignore revoke failure
      }
    }
    meissa2dRawUrlBySnapshot.set(key, u);
    meissa2dOverlayBlobUrl = u;
  }

  /** 정사 미리보기: <img src> 용(Authorization 대신 access_token 쿼리). maxEdge 생략 시 16384. */
  function buildOrthophotoPreviewImgUrl(snapshotId, projectId, accessToken, maxEdge, previewFmt) {
    const e = Number(maxEdge);
    const edge =
      Number.isFinite(e) && e >= 1024 ? Math.min(16384, Math.round(e)) : 16384;
    const params = new URLSearchParams({
      project_id: String(projectId || "").trim(),
      access_token: normalizeMeissaAccessToken(accessToken),
      max_edge: String(edge),
    });
    const pf = String(previewFmt || "png").toLowerCase();
    if (pf === "jpeg" || pf === "webp") {
      params.set("fmt", pf);
    }
    return `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(String(snapshotId).trim())}/orthophoto-preview?${params}`;
  }

  /** 백엔드 대리호출 URL(JWT 헤더). 예전 버전과 동일하게 max_edge 생략 가능. */
  function buildOrthophotoPreviewApiUrl(snapshotId, projectId, maxEdge) {
    const params = new URLSearchParams({
      project_id: String(projectId || "").trim(),
    });
    if (Number.isFinite(Number(maxEdge)) && Number(maxEdge) > 0) {
      params.set("max_edge", String(Math.round(Number(maxEdge))));
    }
    return `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(String(snapshotId).trim())}/orthophoto-preview?${params}`;
  }

  /**
   * 고해상 orthophoto max_edge 기본 8192. 브라우저 디코드 실패가 잦으면 로드 전
   * window.__MEISSA_ORTHO_FULL_MAX_EDGE__ = 6144 또는 4096
   */
  const MEISSA_ORTHOPHOTO_FULL_MAX_EDGE = (() => {
    try {
      const w =
        typeof window !== "undefined" ? Number(window.__MEISSA_ORTHO_FULL_MAX_EDGE__) : NaN;
      if (Number.isFinite(w) && w >= 2048) return Math.min(16384, Math.round(w));
    } catch (_) {
      /* ignore */
    }
    return 8192;
  })();
  /** 팬 중 매 프레임 fetch 방지 — 멈춘 뒤 한 번만 요청 */
  /** 팬·휠 연속 시 fetch 남발 방지 — 캐시 히트는 별도 즉시 경로 */
  const MEISSA_ORTHOPHOTO_VIEWPORT_HI_DEBOUNCE_MS = 72;
  /** full 픽셀 crop 을 그리드에 맞춤 — 살짝 움직여도 같은 타일이면 캐시 히트 */
  const MEISSA_ORTHOPHOTO_VIEWPORT_CROP_SNAP_PX = 512;
  /**
   * 첫 페인트용 저해상(본 화질보다 작게). max_edge=1024 는 일부 환경에서 첫 요청 타임아웃·프록시 제한으로
   * <img> error 가 나는 사례가 있어 2048 로 둠(여전히 3072 본편보다 가볍고 빠름).
   */
  const MEISSA_ORTHOPHOTO_SPLASH_EDGE = 2048;
  /** 본 화면용 저해상 — 고해상 비활성(MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES) 시에만 단독 로드 */
  const MEISSA_ORTHOPHOTO_PREVIEW_EDGE = 3072;
  /**
   * 고해상 orthophoto Image 폴백: 8192 실패 시 낮은 max_edge 순. 마지막에 PREVIEW_EDGE(3072) 포함 —
   * 서버가 고해상만 404이고 저해상 캐시만 있을 때 3/3 재시도까지 모두 실패하던 구멍을 막음.
   */
  const MEISSA_ORTHOPHOTO_FULL_IMAGE_FALLBACK_EDGES = [6144, 4096, MEISSA_ORTHOPHOTO_PREVIEW_EDGE];
  /** 확대 뷰 crop 패치 — base 정사보다 더 높은 edge를 허용해 줌 선명도 확보 */
  const MEISSA_ORTHOPHOTO_VIEWPORT_HI_EDGE = 16384;
  /** 고해상 orthophoto-preview GET — PNG가 커서 여유 있게 둠 */
  const MEISSA_ORTHOPHOTO_HIGH_FETCH_MS = 600000;
  /**
   * true(기본): 출처 같을 때 fetch→blob 먼저 시도. 실패 시 Image 폴백.
   * API 가 다른 출처면 fetch 를 안 하고 Image 만 씀( Failed to fetch 회피 ). 강제 fetch 는
   * window.__MEISSA_ORTHO_ALLOW_CROSS_ORIGIN_FETCH__ = true (서버 CORS 필수).
   * Image 만 쓰려면 window.__MEISSA_ORTHO_MAIN_HIGH_USE_FETCH__ = false.
   */
  const MEISSA_ORTHOPHOTO_MAIN_HIGH_USE_FETCH =
    typeof window === "undefined" || window.__MEISSA_ORTHO_MAIN_HIGH_USE_FETCH__ !== false;
  /** overlay-2d-image/raw 단계 타임아웃(ms). 속도 우선(빠른 폴백) */
  const MEISSA_OVERLAY_2D_RAW_FETCH_MS = 22000;
  /** overlay-2d-image(JSON/dataUrl) 단계 타임아웃(ms). */
  const MEISSA_OVERLAY_2D_JSON_FETCH_MS = 18000;

  /** orthophoto-preview URL이 세션 캐시에 있어도 재사용하면 안 되는 저해상 tier(확대해도 번짐). */
  function meissa2dOrthophotoUrlIsSubFullTier(url) {
    const s = String(url || "");
    if (!s.includes("/orthophoto-preview")) return false;
    try {
      const q = s.includes("?") ? s.slice(s.indexOf("?")) : "";
      const sp = new URLSearchParams(q);
      const me = Number(sp.get("max_edge"));
      if (!Number.isFinite(me)) return false;
      return me < MEISSA_ORTHOPHOTO_FULL_MAX_EDGE;
    } catch (_) {
      return /[?&]max_edge=(6144|4096|3072|2048|1024)\b/.test(s);
    }
  }

  /** 버튼 URL(export/orthophoto) 계열은 모바일 브라우저 내부 다운샘플로 줌 블러를 유발하기 쉬움. */
  function meissa2dOrthophotoUrlIsButtonExport(url) {
    const s = String(url || "").trim().toLowerCase();
    if (!s) return false;
    return s.includes("/export/orthophoto/") || /orthophoto_\d+x\.png/.test(s);
  }

  function meissa2dSignedUrlIsExpired(url) {
    const s = String(url || "").trim();
    if (!s || s.startsWith("blob:") || s.startsWith("data:")) return false;
    try {
      const u = new URL(s, window.location.origin);
      const expRaw = (u.searchParams.get("Expires") || "").trim();
      if (!/^\d+$/.test(expRaw)) return false;
      const exp = Number(expRaw);
      if (!Number.isFinite(exp) || exp <= 0) return false;
      const nowSec = Math.floor(Date.now() / 1000);
      return nowSec >= exp - 10;
    } catch (_) {
      return false;
    }
  }

  function stopOrthoHiPendingBadgeTicker() {
    if (meissa2dOrthoHiPendingBadgeTicker) {
      try {
        window.clearInterval(meissa2dOrthoHiPendingBadgeTicker);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoHiPendingBadgeTicker = 0;
    }
  }

  function startOrthoHiPendingBadgeTicker() {
    if (meissa2dOrthoHiPendingBadgeTicker) return;
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    meissa2dOrthoHiPendingBadgeTicker = window.setInterval(() => {
      try {
        const wrap = document.querySelector(".meissa-2d-overlay-wrap");
        if (!wrap || !wrap.classList.contains("meissa-2d-ortho-hi-pending")) {
          stopOrthoHiPendingBadgeTicker();
          return;
        }
        applyReplayMeissa2dOrthoHiBadgeNow();
      } catch (_) {
        /* ignore */
      }
    }, 420);
  }

  function meissa2dOrthoApplyWrapLoadingPhase(phase) {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return;
    wrap.classList.remove("meissa-2d-ortho-loading", "meissa-2d-ortho-hi-pending");
    if (phase === "loading") {
      meissa2dOrthoHiPendingSince = 0;
      stopOrthoHiPendingBadgeTicker();
      wrap.classList.add("meissa-2d-ortho-loading");
    } else if (phase === "hi-pending") {
      wrap.classList.add("meissa-2d-ortho-hi-pending");
      if (meissa2dOrthoHiPendingSince <= 0) meissa2dOrthoHiPendingSince = Date.now();
      startOrthoHiPendingBadgeTicker();
    } else {
      meissa2dOrthoHiPendingSince = 0;
      stopOrthoHiPendingBadgeTicker();
    }
  }

  function meissa2dOrthoTierFromImgSrc(imgSrc) {
    const u = String(imgSrc || "");
    try {
      const q = u.includes("?") ? u.slice(u.indexOf("?")) : "";
      const me = Number(new URLSearchParams(q).get("max_edge"));
      if (Number.isFinite(me) && me >= MEISSA_ORTHOPHOTO_FULL_MAX_EDGE) return "full";
    } catch (_) {
      /* ignore */
    }
    return "preview";
  }

  function meissa2dOrthoMaxEdgeFromImgSrc(imgSrc) {
    const u = String(imgSrc || "");
    try {
      const q = u.includes("?") ? u.slice(u.indexOf("?")) : "";
      const me = Number(new URLSearchParams(q).get("max_edge"));
      return Number.isFinite(me) ? me : NaN;
    } catch (_) {
      return NaN;
    }
  }

  /** URL 쿼리(max_edge) 또는 파일명(orthophoto_25000x.png)에서 기대 장변(px) 추정 */
  function meissa2dOrthoNominalLongEdgeFromImgSrc(imgSrc) {
    const me = meissa2dOrthoMaxEdgeFromImgSrc(imgSrc);
    if (Number.isFinite(me) && me > 0) return me;
    const u = String(imgSrc || "");
    const m = u.match(/orthophoto_(\d+)x\.png/i);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  /** 메인 <img>가 잘못된 캐시 엔트리를 물지 않게(고해상 URL만) */
  function withOrthophotoImgCacheBust(url) {
    const s = String(url || "").trim();
    if (!s.includes("/orthophoto-preview")) return s;
    try {
      const u = new URL(s, window.location.origin);
      u.searchParams.set("_pilexy_img", String(Date.now()));
      return u.toString();
    } catch (_) {
      return `${s}${s.includes("?") ? "&" : "?"}_pilexy_img=${Date.now()}`;
    }
  }

  function maybeWarnOrthophotoPixelMismatch(imgEl) {
    const nw = Number(imgEl?.naturalWidth || 0);
    const nh = Number(imgEl?.naturalHeight || 0);
    if (nw <= 1 || nh <= 1) return;
    const me = meissa2dOrthoMaxEdgeFromImgSrc(imgEl.src);
    if (!Number.isFinite(me) || me < MEISSA_ORTHOPHOTO_FULL_MAX_EDGE) return;
    const longEdge = Math.max(nw, nh);
    if (longEdge < 5500) {
      pushMeissa2dLoadLine(
        `※ 정사: URL은 max_edge=${me} 인데 디코드 픽셀은 ${nw}×${nh} 입니다. 브라우저/중간 캐시가 저해상만 쓴 것일 수 있습니다. 강력 새로고침(Ctrl+F5) 또는 시크릿 창으로 다시 열어 보세요.`
      );
    }
  }

  /** 정사: natural 픽셀 크기로 두고 부모 panzoom matrix로만 축소·확대(100% 박스에 넣으면 고해상이 뭉개짐) */
  function applyMeissa2dIntrinsicImgLayout(img) {
    if (!img) return;
    /* loadSeq 만으로 이전 로드 무효화. activeSnapshotIdNow() 는 셀렉트·숨은 필드 타이밍 차로 레이아웃 전체 스킵(가로 띠) 유발할 수 있어 쓰지 않음 */
    if (img.__pilexyOrthoBindSeq != null && Number(img.__pilexyOrthoBindSeq) !== Number(meissa2dLoadSeq)) {
      return;
    }
    const rawW = Math.round(Number(img.naturalWidth || 0));
    const rawH = Math.round(Number(img.naturalHeight || 0));
    if (rawW <= 1 || rawH <= 1) return;
    const bindSeq0 = img.__pilexyOrthoBindSeq;
    const bindSid0 = img.__pilexyOrthoBindSid != null ? String(img.__pilexyOrthoBindSid) : null;
    const nw = Math.max(1, rawW);
    const nh = Math.max(1, rawH);
    const ar = nw / nh;
    /*
     * 디코드 직후·손상 응답 등으로 세로가 비정상적으로 작으면 CSS 박스가 ‘맨 위 가로 띠’만 보이듯 깨짐.
     * 잠시 100% 박스로 두고 다음 프레임에 natural 이 안정화되면 intrinsic 재적용.
     */
    if (nw > 200 && (nh < 48 || ar > 10)) {
      img.style.inset = "0";
      img.style.left = "0";
      img.style.top = "0";
      img.style.right = "auto";
      img.style.bottom = "auto";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.maxWidth = "";
      img.style.maxHeight = "";
      if (img.__pilexyOrthoIntrinsicRetryPending) return;
      img.__pilexyOrthoIntrinsicRetryPending = true;
      const retry = () => {
        img.__pilexyOrthoIntrinsicRetryPending = false;
        try {
          if (
            bindSeq0 != null &&
            bindSid0 != null &&
            (Number(img.__pilexyOrthoBindSeq) !== Number(bindSeq0) ||
              String(img.__pilexyOrthoBindSid || "") !== bindSid0)
          ) {
            return;
          }
          if (!img.parentNode || img.getAttribute("data-meissa-2d-intrinsic-layout") !== "1") return;
          const w2 = Math.max(1, Math.round(Number(img.naturalWidth || 0)));
          const h2 = Math.max(1, Math.round(Number(img.naturalHeight || 0)));
          const ar2 = w2 / h2;
          if (w2 > 200 && (h2 < 48 || ar2 > 10)) {
            const n = Number(img.__pilexyOrthoIntrinsicTimerRetries || 0);
            if (n < 12) {
              img.__pilexyOrthoIntrinsicTimerRetries = n + 1;
              window.setTimeout(() => {
                try {
                  if (
                    bindSeq0 != null &&
                    bindSid0 != null &&
                    (Number(img.__pilexyOrthoBindSeq) !== Number(bindSeq0) ||
                      String(img.__pilexyOrthoBindSid || "") !== bindSid0)
                  ) {
                    return;
                  }
                  applyMeissa2dIntrinsicImgLayout(img);
                } catch (_) {
                  /* ignore */
                }
              }, 160 + n * 180);
            }
            return;
          }
          img.__pilexyOrthoIntrinsicTimerRetries = 0;
          applyMeissa2dIntrinsicImgLayout(img);
          if (MEISSA_2D_SIMPLE_ORTHO) {
            syncMeissa2dSquareMapFrameLayout();
            meissa2dFitIntrinsicOrthoPanToWrap();
          }
        } catch (_) {
          /* ignore */
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(retry);
      });
      return;
    }
    img.style.inset = "auto";
    img.style.left = "0";
    img.style.top = "0";
    img.style.right = "auto";
    img.style.bottom = "auto";
    img.style.width = `${nw}px`;
    img.style.height = `${nh}px`;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
  }

  /** decode 완료 후 레이아웃(대형 PNG 가 intrinsic 치수가 늦게 안정되는 환경 완화) */
  function meissa2dAfterOrthoImgDecodeLayout(imgEl, loadSeq, sid, fn) {
    if (!imgEl || typeof fn !== "function") return;
    const ok = () => isMeissa2dLoadCurrent(loadSeq, sid);
    const run = () => {
      if (!ok()) return;
      try {
        fn();
      } catch (_) {
        /* ignore */
      }
    };
    try {
      const p = imgEl.decode && imgEl.decode();
      if (p && typeof p.then === "function") {
        p.then(run).catch(run);
        return;
      }
    } catch (_) {
      /* decode 지원 안 함·거부 */
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }

  function meissa2dFitIntrinsicOrthoPanToWrap() {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    const img = els.meissaCloud2dImageLocal;
    if (!wrap || !img) return;
    if (img.getAttribute("data-meissa-2d-intrinsic-layout") !== "1") return;
    const nw = Number(img.naturalWidth || 0);
    const nh = Number(img.naturalHeight || 0);
    if (nw <= 1 || nh <= 1) return;
    const ww = Math.max(1, wrap.clientWidth);
    const wh = Math.max(1, wrap.clientHeight);
    const margin = 0.98;
    const sFit = Math.min((ww * margin) / nw, (wh * margin) / nh);
    const s = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, Math.min(MEISSA_2D_ZOOM_MAX_SCALE, sFit));
    meissa2dViewScale = s;
    meissa2dViewTx = (ww - s * nw) * 0.5;
    meissa2dViewTy = (wh - s * nh) * 0.5;
    applyMeissa2dViewTransform();
  }

  /** 메인 정사 intrinsic 픽셀만 바뀔 때(3072→8192 등) 현재 화면 기준점(마지막 줌 앵커 또는 중심)이 가리키는 지리·배율 유지 */
  function meissa2dPreserveViewAfterOrthoIntrinsicChange(prevW, prevH, nw, nh) {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) {
      return;
    }
    if (prevW < 32 || prevH < 32 || nw < 32 || nh < 32) {
      return;
    }
    const rx = prevW / nw;
    const ry = prevH / nh;
    const logEps = 1e-5;
    if (Math.abs(Math.log(rx)) < logEps && Math.abs(Math.log(ry)) < logEps) {
      return;
    }
    const { w: ww, h: wh } = getOverlayWrapSize();
    const refX = Number.isFinite(meissa2dLastZoomAnchorX) ? meissa2dLastZoomAnchorX : ww * 0.5;
    const refY = Number.isFinite(meissa2dLastZoomAnchorY) ? meissa2dLastZoomAnchorY : wh * 0.5;
    const lx = (refX - meissa2dViewTx) / meissa2dViewScale;
    const ly = (refY - meissa2dViewTy) / meissa2dViewScale;
    const nxc = lx / prevW;
    const nyc = ly / prevH;
    const ixn = nxc * nw;
    const iyn = nyc * nh;
    const rUniform = Math.sqrt(Math.max(1e-12, rx * ry));
    const s0 = meissa2dViewScale;
    const s1 = meissa2dViewScale * rUniform;
    meissa2dViewScale = s1;
    meissa2dViewTx = refX - s1 * ixn;
    meissa2dViewTy = refY - s1 * iyn;
    applyMeissa2dViewTransform({ redrawOverlay: false });
    try {
      const refLabel = Number.isFinite(meissa2dLastZoomAnchorX) ? "앵커" : "중심";
      pushMeissa2dLoadLine(
        `정사: 해상도 전환 후 뷰 유지(${refLabel}·줌 보정 ×${rUniform.toFixed(4)})`
      );
    } catch (_) {
      /* ignore */
    }
  }

  function fitMeissa2dSimpleOrthoIntrinsicView() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    const img = els.meissaCloud2dImageLocal;
    if (!img) return;
    const nw = Number(img.naturalWidth || 0);
    const nh = Number(img.naturalHeight || 0);
    if (nw <= 1 || nh <= 1) return;
    ensureMeissa2dPanZoomRoot();
    img.setAttribute("data-meissa-2d-intrinsic-layout", "1");
    try {
      img.__pilexyOrthoIntrinsicTimerRetries = 0;
    } catch (_) {
      /* ignore */
    }
    img.style.position = "absolute";
    img.style.zIndex = "1";
    applyMeissa2dIntrinsicImgLayout(img);
    meissa2dFitIntrinsicOrthoPanToWrap();
  }

  /**
   * orthoParallelResult 가 이미 ok 인데 고해상으로 src 교체 직후에는 complete 가 잠시 false →
   * 저해상이 정상인데도 「img 로드 실패」로 RAW 폴백하는 레이스를 막기 위해 디코드 대기.
   * @returns {Promise<boolean>}
   */
  function waitMeissa2dImgDecodeReady(imgEl, loadSeq, sid, timeoutMs) {
    const ms = Math.max(3000, Number(timeoutMs) || 180000);
    return new Promise((resolve) => {
      if (!imgEl) {
        resolve(false);
        return;
      }
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        resolve(true);
        return;
      }
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        try {
          window.clearTimeout(tm);
        } catch (_) {
          /* ignore */
        }
        try {
          imgEl.removeEventListener("load", onLoad);
          imgEl.removeEventListener("error", onErr);
        } catch (_) {
          /* ignore */
        }
        resolve(Boolean(ok));
      };
      const onLoad = () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return finish(false);
        if (imgEl.naturalWidth > 0) finish(true);
      };
      const onErr = () => finish(false);
      const tm = window.setTimeout(() => finish(false), ms);
      imgEl.addEventListener("load", onLoad);
      imgEl.addEventListener("error", onErr);
    });
  }

  /**
   * 저해상은 <img src> 로 즉시 요청하고, 고해상 fetch·Image 는 저해상 수신(또는 저해상 오류) 이후에만 시작해
   * 동일 API에 대한 이중 대용량 요청으로 인한 지연·524 를 줄입니다.
   * 고해상이 먼저 도착하면 대기열에 두었다가 저해상 첫 디코드 후에만 메인 src 를 바꿉니다.
   * urlSplash: dual 이 아닐 때만 — 초저해상으로 먼저 그린 뒤 urlLow 로 교체(체감 즉시 로드).
   */
  function waitMeissa2dOrthoImage(imgEl, urlLow, loadSeq, sid, urlHigh, urlSplash) {
    try {
      if (typeof imgEl.__pilexyOrthoCleanup === "function") imgEl.__pilexyOrthoCleanup();
    } catch (_) {
      /* ignore */
    }
    imgEl.__pilexyOrthoCleanup = null;
    try {
      imgEl.__pilexyOrthoBindSeq = loadSeq;
      imgEl.__pilexyOrthoBindSid = String(sid || "").trim();
    } catch (_) {
      /* ignore */
    }

    const low = String(urlLow || "").trim();
    const high = String(urlHigh || "").trim();
    const dual = Boolean(high && high !== low) && !MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES;
    const splashUrl = String(urlSplash || "").trim();
    const useSplash = Boolean(!dual && splashUrl && splashUrl !== low);
    let splashErrFallbackLow = useSplash ? low : "";
    /** 스플래시 성공 후에만 본 해상도로 한 번 더 교체 */
    let splashUpgradePending = useSplash;
    if (MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES && high && high !== low) {
      try {
        pushMeissa2dLoadLine("정사: 고해상 로드 비활성 — 첫(저해상) 이미지로만 매칭·RGB 분석");
      } catch (_) {
        /* ignore */
      }
    }
    meissa2dOrthoInteractReady = false;
    meissa2dOrthoMain8192BytesInFlight = false;
    meissa2dOrthoMain8192DecodeInFlight = false;
    meissa2dOrthoMain8192DlBytes = 0;
    meissa2dOrthoMain8192DlTotal = 0;
    meissa2dOrthoMain8192DlGhostRatio = 0;
    meissa2dOrthoMain8192DecodeT0 = 0;
    if (meissa2dOrthoMain8192ProbeGhostTimer) {
      try {
        window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoMain8192ProbeGhostTimer = 0;
    }
    if (meissa2dOrthoHiBadgeProgTimer) {
      try {
        window.clearTimeout(meissa2dOrthoHiBadgeProgTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoHiBadgeProgTimer = 0;
    }
    meissa2dOrthoMain8192FetchStartedAt = 0;
    if (meissa2dOrthoMain8192BadgeTicker) {
      try {
        window.clearInterval(meissa2dOrthoMain8192BadgeTicker);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoMain8192BadgeTicker = 0;
    }
    meissa2dOrthoHiPendingSince = 0;
    stopOrthoHiPendingBadgeTicker();
    return new Promise((resolve) => {
      let settled = false;
      let lowFailed = false;
      let lowDecodeRepairAttempts = 0;
      let highProbeFailed = false;
      let highImageProbeStarted = false;
      /** 메인 img 가 고해상(URL 또는 blob) 로드 중이면 true */
      let mainLoadingHigh = false;
      let firstDecodeDone = false;
      let lowStallTimer = 0;
      /** 고해상 fetch/Image 가 저해상보다 먼저 끝나면 blob·URL 을 여기 두었다가, 저해상 첫 디코드(또는 저해상 실패) 후에만 메인 img 에 적용 */
      let pendingHighBlob = null;
      let pendingHighUrl = null;
      /** 저·고해상 orthophoto-preview 동시 호출 시 원본(동일 호스트) 대기열에 걸려 둘 다 늦어지는 경우가 많아, 고해상은 한 번만·저해상 이후에 시작 */
      let highPrefetchStarted = false;
      let detach = () => {};

      const effectiveOrthoTier = () => {
        if (imgEl.getAttribute("data-meissa-2d-ortho-blob-tier") === "1") return "full";
        return meissa2dOrthoTierFromImgSrc(imgEl.src);
      };

      const cleanupListeners = () => {
        if (lowStallTimer) {
          try {
            window.clearTimeout(lowStallTimer);
          } catch (_) {
            /* ignore */
          }
          lowStallTimer = 0;
        }
        try {
          detach();
        } catch (_) {
          /* ignore */
        }
        detach = () => {};
        try {
          imgEl.removeAttribute("data-meissa-2d-ortho-blob-tier");
        } catch (_) {
          /* ignore */
        }
        pendingHighBlob = null;
        pendingHighUrl = null;
        try {
          imgEl.__pilexyOrthoCleanup = null;
        } catch (_) {
          /* ignore */
        }
      };

      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (lowStallTimer) {
          try {
            window.clearTimeout(lowStallTimer);
          } catch (_) {
            /* ignore */
          }
          lowStallTimer = 0;
        }
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
          meissa2dOrthoApplyWrapLoadingPhase("idle");
          cleanupListeners();
          resolve({ ok: false, stale: true });
          return;
        }
        if (!ok) meissa2dOrthoApplyWrapLoadingPhase("idle");
        resolve({ ok: Boolean(ok) });
      };

      let lastLoggedFullOrthoDims = "";

      const syncTierAndOverlay = () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
        try {
          const tier = effectiveOrthoTier();
          imgEl.setAttribute("data-meissa-2d-ortho-tier", tier);
          if (tier === "full") meissa2dOrthoApplyWrapLoadingPhase("idle");
          else if (dual && !highProbeFailed) meissa2dOrthoApplyWrapLoadingPhase("hi-pending");
          else meissa2dOrthoApplyWrapLoadingPhase("idle");
          if (tier === "full" && imgEl.naturalWidth > 1 && imgEl.naturalHeight > 1) {
            maybeWarnOrthophotoPixelMismatch(imgEl);
            const dimK = `${imgEl.naturalWidth}x${imgEl.naturalHeight}`;
            if (dimK !== lastLoggedFullOrthoDims) {
              lastLoggedFullOrthoDims = dimK;
              pushMeissa2dLoadLine(
                `정사: 고해상 화면 반영(메인 이미지 디코드) ${imgEl.naturalWidth}×${imgEl.naturalHeight}px`
              );
            }
          }
        } catch (_) {
          /* ignore */
        }
        scheduleRenderMeissa2dPointsOverlay();
      };

      const maybeDetachAfterPaint = () => {
        if (!dual) {
          cleanupListeners();
          return;
        }
        const tier = effectiveOrthoTier();
        if (tier === "full" || highProbeFailed) cleanupListeners();
      };

      const flushPendingHigh = () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
        if (!firstDecodeDone && !lowFailed) return false;
        if (pendingHighBlob) {
          const blob = pendingHighBlob;
          pendingHighBlob = null;
          pendingHighUrl = null;
          if (!blob || blob.size < 32) return false;
          const objUrl = URL.createObjectURL(blob);
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
            try {
              URL.revokeObjectURL(objUrl);
            } catch (_) {
              /* ignore */
            }
            return false;
          }
          setMeissa2dRawUrlForSnapshot(String(sid).trim(), objUrl);
          mainLoadingHigh = true;
          meissa2dOrthoMain8192BytesInFlight = false;
          meissa2dOrthoMain8192DecodeInFlight = true;
          meissa2dOrthoMain8192DecodeT0 = Date.now();
          try {
            scheduleMeissa2dOrthoViewportHiFetch();
          } catch (_) {
            /* ignore */
          }
          try {
            const ow = Number(imgEl.naturalWidth || 0);
            const oh = Number(imgEl.naturalHeight || 0);
            if (ow > 1 && oh > 1) imgEl._pilexyOrthoPrevNatural = { w: ow, h: oh };
          } catch (_) {
            /* ignore */
          }
          imgEl.setAttribute("data-meissa-2d-ortho-blob-tier", "1");
          imgEl.src = objUrl;
          pushMeissa2dLoadLine(
            `정사: 고해상 PNG 적용(${(blob.size / (1024 * 1024)).toFixed(1)}MB) — 디코드·화면 반영 중…`
          );
          return true;
        }
        if (pendingHighUrl) {
          const url = pendingHighUrl;
          pendingHighUrl = null;
          try {
            imgEl.removeAttribute("data-meissa-2d-ortho-blob-tier");
            setMeissa2dRawUrlForSnapshot(String(sid).trim(), url);
            const hiForImg = withOrthophotoImgCacheBust(url);
            mainLoadingHigh = true;
            meissa2dOrthoMain8192BytesInFlight = false;
            meissa2dOrthoMain8192DecodeInFlight = true;
            meissa2dOrthoMain8192DecodeT0 = Date.now();
            try {
              scheduleMeissa2dOrthoViewportHiFetch();
            } catch (_) {
              /* ignore */
            }
            try {
              const ow = Number(imgEl.naturalWidth || 0);
              const oh = Number(imgEl.naturalHeight || 0);
              if (ow > 1 && oh > 1) imgEl._pilexyOrthoPrevNatural = { w: ow, h: oh };
            } catch (_) {
              /* ignore */
            }
            imgEl.src = hiForImg;
            pushMeissa2dLoadLine("정사: 고해상 URL 적용 — 디코드·화면 반영 중…");
          } catch (_) {
            mainLoadingHigh = false;
            meissa2dOrthoMain8192DecodeInFlight = false;
            meissa2dOrthoMain8192DecodeT0 = 0;
            try {
              scheduleMeissa2dOrthoViewportHiFetch();
            } catch (_2) {
              /* ignore */
            }
            highProbeFailed = true;
            pushMeissa2dLoadLine("정사: 고해상 URL 적용 실패 — 저해상 유지");
            if (lowFailed) {
              meissa2dOrthoApplyWrapLoadingPhase("idle");
              if (!settled) finish(false);
              cleanupListeners();
            } else if (imgEl.complete && imgEl.naturalWidth > 0) {
              meissa2dOrthoApplyWrapLoadingPhase("idle");
              cleanupListeners();
            }
          }
          return true;
        }
        return false;
      };

      const queueHighBlob = (blob) => {
        if (!blob || blob.size < 32) return false;
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
        pendingHighBlob = blob;
        pendingHighUrl = null;
        if (flushPendingHigh()) return true;
        pushMeissa2dLoadLine(
          "정사: 고해상 PNG 수신 완료 — 저해상이 먼저 표시된 뒤 고해상으로 전환합니다"
        );
        return true;
      };

      /** @param {boolean} [fromFetchFailure] false 이면 fetch 없이 곧바로 Image(주 경로) */
      const startHighProbeImage = (fromFetchFailure) => {
        if (!dual || highImageProbeStarted) return;
        highImageProbeStarted = true;
        meissa2dOrthoMain8192BytesInFlight = true;
        meissa2dOrthoMain8192DlBytes = 0;
        meissa2dOrthoMain8192DlTotal = 0;
        meissa2dOrthoMain8192DlGhostRatio = 0;
        meissa2dOrthoMain8192FetchStartedAt = Date.now();
        if (meissa2dOrthoViewportHiAbort) {
          try {
            meissa2dOrthoViewportHiAbort.abort();
          } catch (_) {
            /* ignore */
          }
          meissa2dOrthoViewportHiAbort = null;
        }
        if (meissa2dOrthoMain8192ProbeGhostTimer) {
          try {
            window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
          } catch (_) {
            /* ignore */
          }
          meissa2dOrthoMain8192ProbeGhostTimer = 0;
        }
        meissa2dOrthoMain8192ProbeGhostTimer = window.setInterval(() => {
          if (!meissa2dOrthoMain8192BytesInFlight) {
            try {
              window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
            } catch (_) {
              /* ignore */
            }
            meissa2dOrthoMain8192ProbeGhostTimer = 0;
            return;
          }
          meissa2dOrthoMain8192DlGhostRatio = Math.min(0.82, meissa2dOrthoMain8192DlGhostRatio + 0.03);
          try {
            scheduleMeissa2dOrthoViewportHiFetch();
          } catch (_) {
            /* ignore */
          }
        }, 400);
        try {
          scheduleMeissa2dOrthoViewportHiFetch();
        } catch (_) {
          /* ignore */
        }
        pushMeissa2dLoadLine(
          fromFetchFailure === false
            ? `정사: 고해상(Image) 수신 시작(max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE}${MEISSA_ORTHOPHOTO_FULL_IMAGE_FALLBACK_EDGES.length ? ` · 실패 시 ${MEISSA_ORTHOPHOTO_FULL_IMAGE_FALLBACK_EDGES.join("/")} 재시도` : ""})`
            : `정사: 고해상 fetch 실패 → Image 로드 폴백(max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE})`
        );
        const pid =
          (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
        const urlTryList = [high];
        if (pid && meissaAccess && sid) {
          for (const fe of MEISSA_ORTHOPHOTO_FULL_IMAGE_FALLBACK_EDGES) {
            try {
              const u = buildOrthophotoPreviewImgUrl(sid, pid, meissaAccess, fe);
              if (u && urlTryList.indexOf(u) < 0) urlTryList.push(u);
            } catch (_) {
              /* ignore */
            }
          }
        }
        const finishHighProbeAllFailed = () => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (meissa2dOrthoMain8192ProbeGhostTimer) {
            try {
              window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
            } catch (_) {
              /* ignore */
            }
            meissa2dOrthoMain8192ProbeGhostTimer = 0;
          }
          meissa2dOrthoMain8192DlGhostRatio = 0;
          meissa2dOrthoMain8192BytesInFlight = false;
          meissa2dOrthoMain8192FetchStartedAt = 0;
          try {
            scheduleMeissa2dOrthoViewportHiFetch();
          } catch (_) {
            /* ignore */
          }
          highProbeFailed = true;
          pushMeissa2dLoadLine(
            "정사: 고해상(Image) 전 단계 실패 — 저해상만 사용(메모리·네트워크·PNG 한도 가능)"
          );
          if (lowFailed) {
            meissa2dOrthoApplyWrapLoadingPhase("idle");
            if (!settled) finish(false);
            cleanupListeners();
          } else if (imgEl.complete && imgEl.naturalWidth > 0) {
            meissa2dOrthoApplyWrapLoadingPhase("idle");
            cleanupListeners();
          }
        };
        const finishHighProbeSuccess = (probe, chosenUrl) => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (meissa2dOrthoMain8192ProbeGhostTimer) {
            try {
              window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
            } catch (_) {
              /* ignore */
            }
            meissa2dOrthoMain8192ProbeGhostTimer = 0;
          }
          meissa2dOrthoMain8192DlGhostRatio = 0;
          meissa2dOrthoMain8192BytesInFlight = false;
          meissa2dOrthoMain8192FetchStartedAt = 0;
          try {
            scheduleMeissa2dOrthoViewportHiFetch();
          } catch (_) {
            /* ignore */
          }
          pushMeissa2dLoadLine(
            `정사: 고해상 Image 프리로드 ${probe.naturalWidth}×${probe.naturalHeight}px`
          );
          pendingHighUrl = chosenUrl;
          if (!flushPendingHigh()) {
            pushMeissa2dLoadLine("정사: 고해상 Image 준비됨 — 저해상 선표시 후 메인에 적용합니다");
          }
        };
        const attemptHighImageProbe = (idx) => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (idx >= urlTryList.length) {
            finishHighProbeAllFailed();
            return;
          }
          if (idx > 0) {
            pushMeissa2dLoadLine(
              `정사: 고해상 Image ${idx + 1}/${urlTryList.length}단계(낮은 max_edge) 재시도`
            );
          }
          const probe = new Image();
          probe.onload = () => {
            finishHighProbeSuccess(probe, urlTryList[idx]);
          };
          probe.onerror = () => {
            attemptHighImageProbe(idx + 1);
          };
          try {
            probe.src = withOrthophotoImgCacheBust(urlTryList[idx]);
          } catch (_) {
            probe.onerror();
          }
        };
        attemptHighImageProbe(0);
      };

      const runPrefetchHigh = () => {
        if (!dual) return;
        if (meissa2dOrthoMain8192ProbeGhostTimer) {
          try {
            window.clearInterval(meissa2dOrthoMain8192ProbeGhostTimer);
          } catch (_) {
            /* ignore */
          }
          meissa2dOrthoMain8192ProbeGhostTimer = 0;
        }
        if (!MEISSA_ORTHOPHOTO_MAIN_HIGH_USE_FETCH) {
          startHighProbeImage(false);
          return;
        }
        if (
          pilexyOrthophotoUrlCrossOrigin(high) &&
          !MEISSA_ORTHO_ALLOW_CROSS_ORIGIN_FETCH
        ) {
          try {
            pushMeissa2dLoadLine(
              "정사: 페이지·API 출처가 달라 fetch 는 보통 실패합니다. Image 로 고해상 수신합니다(팬·줌과 무관)."
            );
          } catch (_) {
            /* ignore */
          }
          startHighProbeImage(false);
          return;
        }
        meissa2dOrthoMain8192BytesInFlight = true;
        meissa2dOrthoMain8192DlBytes = 0;
        meissa2dOrthoMain8192DlTotal = 0;
        meissa2dOrthoMain8192DlGhostRatio = 0;
        meissa2dOrthoMain8192FetchStartedAt = Date.now();
        if (meissa2dOrthoViewportHiAbort) {
          try {
            meissa2dOrthoViewportHiAbort.abort();
          } catch (_) {
            /* ignore */
          }
          meissa2dOrthoViewportHiAbort = null;
        }
        if (meissa2dOrthoMain8192BadgeTicker) {
          try {
            window.clearInterval(meissa2dOrthoMain8192BadgeTicker);
          } catch (_) {
            /* ignore */
          }
          meissa2dOrthoMain8192BadgeTicker = 0;
        }
        meissa2dOrthoMain8192BadgeTicker = window.setInterval(() => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (!meissa2dOrthoMain8192BytesInFlight) {
            try {
              window.clearInterval(meissa2dOrthoMain8192BadgeTicker);
            } catch (_) {
              /* ignore */
            }
            meissa2dOrthoMain8192BadgeTicker = 0;
            return;
          }
          try {
            applyReplayMeissa2dOrthoHiBadgeNow();
          } catch (_) {
            /* ignore */
          }
        }, 420);
        try {
          scheduleMeissa2dOrthoViewportHiFetch();
        } catch (_) {
          /* ignore */
        }
        pushMeissa2dLoadLine(
          `정사: 고해상(max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE}) fetch 시작(저해상 처리 후·백엔드 부하 분산)`
        );
        void (async () => {
          try {
            const blob = await fetchOrthoMainHighBlobWithProgress(
              high,
              MEISSA_ORTHOPHOTO_HIGH_FETCH_MS,
              (received, total) => {
                if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
                meissa2dOrthoMain8192DlBytes = received;
                meissa2dOrthoMain8192DlTotal = total;
                try {
                  resyncMeissa2dOrthoHiBadgeFromMain8192Progress();
                } catch (_) {
                  /* ignore */
                }
              }
            );
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            if (meissa2dOrthoMain8192BadgeTicker) {
              try {
                window.clearInterval(meissa2dOrthoMain8192BadgeTicker);
              } catch (_) {
                /* ignore */
              }
              meissa2dOrthoMain8192BadgeTicker = 0;
            }
            meissa2dOrthoMain8192BytesInFlight = false;
            meissa2dOrthoMain8192FetchStartedAt = 0;
            meissa2dOrthoMain8192DlBytes = blob.size;
            meissa2dOrthoMain8192DlTotal = Math.max(meissa2dOrthoMain8192DlTotal, blob.size);
            try {
              applyReplayMeissa2dOrthoHiBadgeNow();
            } catch (_) {
              /* ignore */
            }
            try {
              scheduleMeissa2dOrthoViewportHiFetch();
            } catch (_) {
              /* ignore */
            }
            if (!queueHighBlob(blob)) throw new Error("empty-blob");
          } catch (_) {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            if (meissa2dOrthoMain8192BadgeTicker) {
              try {
                window.clearInterval(meissa2dOrthoMain8192BadgeTicker);
              } catch (_3) {
                /* ignore */
              }
              meissa2dOrthoMain8192BadgeTicker = 0;
            }
            meissa2dOrthoMain8192BytesInFlight = false;
            meissa2dOrthoMain8192FetchStartedAt = 0;
            meissa2dOrthoMain8192DlBytes = 0;
            meissa2dOrthoMain8192DlTotal = 0;
            try {
              scheduleMeissa2dOrthoViewportHiFetch();
            } catch (_2) {
              /* ignore */
            }
            startHighProbeImage(true);
          }
        })();
      };

      const scheduleHighPrefetchOnce = () => {
        if (!dual || highPrefetchStarted) return;
        highPrefetchStarted = true;
        runPrefetchHigh();
      };

      const onImgLoad = () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
        markMeissa2dOverlayWarmup();
        const nowW = Number(imgEl.naturalWidth || 0);
        const nowH = Number(imgEl.naturalHeight || 0);
        if (nowW <= 0) return;
        const nowAr = nowH > 0 ? nowW / nowH : Number.POSITIVE_INFINITY;
        const suspiciousDecode = nowW > 200 && (nowH < 48 || nowAr > 10);
        if (!mainLoadingHigh && suspiciousDecode && lowDecodeRepairAttempts < 1 && low) {
          lowDecodeRepairAttempts += 1;
          scheduleHighPrefetchOnce();
          try {
            const repairedLow = withOrthophotoImgCacheBust(low);
            setMeissa2dRawUrlForSnapshot(String(sid).trim(), repairedLow);
            imgEl.src = repairedLow;
            pushMeissa2dLoadLine(
              "정사: 저해상 디코드 비율이 비정상이라 재요청합니다(깨짐 복구 시도 1/1)"
            );
          } catch (_) {
            /* ignore */
          }
          return;
        }
        meissa2dOrthoInteractReady = true;
        if (!firstDecodeDone) {
          firstDecodeDone = true;
          syncTierAndOverlay();
          finish(true);
          maybeDetachAfterPaint();
          flushPendingHigh();
          scheduleHighPrefetchOnce();
        if (MEISSA_2D_SIMPLE_ORTHO) {
          meissa2dAfterOrthoImgDecodeLayout(imgEl, loadSeq, sid, () => {
            bumpMeissa2dOrthoRgbFitCache();
            syncMeissa2dSquareMapFrameLayout();
            fitMeissa2dSimpleOrthoIntrinsicView();
          });
        }
        if (splashUpgradePending && low) {
            splashUpgradePending = false;
            splashErrFallbackLow = "";
            try {
              const w0 = Number(imgEl.naturalWidth || 0);
              const h0 = Number(imgEl.naturalHeight || 0);
              if (w0 > 1 && h0 > 1) imgEl._pilexyOrthoPrevNatural = { w: w0, h: h0 };
            } catch (_) {
              /* ignore */
            }
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
                try {
                  setMeissa2dRawUrlForSnapshot(String(sid).trim(), low);
                  imgEl.src = low;
                  pushMeissa2dLoadLine(
                    `정사: 본 해상도(max_edge=${MEISSA_ORTHOPHOTO_PREVIEW_EDGE}) 로 전환 중`
                  );
                } catch (_) {
                  /* ignore */
                }
              });
            });
          }
          return;
        }
        mainLoadingHigh = false;
        meissa2dOrthoMain8192DecodeInFlight = false;
        meissa2dOrthoMain8192DecodeT0 = 0;
        try {
          scheduleMeissa2dOrthoViewportHiFetch();
        } catch (_) {
          /* ignore */
        }
        syncTierAndOverlay();
        maybeDetachAfterPaint();
        if (MEISSA_2D_SIMPLE_ORTHO) {
          meissa2dAfterOrthoImgDecodeLayout(imgEl, loadSeq, sid, () => {
            bumpMeissa2dOrthoRgbFitCache();
            try {
              const prev = imgEl._pilexyOrthoPrevNatural;
              if (prev && prev.w > 1 && prev.h > 1) {
                delete imgEl._pilexyOrthoPrevNatural;
                const nw = Number(imgEl.naturalWidth || 0);
                const nh = Number(imgEl.naturalHeight || 0);
                if (nw > 1 && nh > 1) {
                  meissa2dPreserveViewAfterOrthoIntrinsicChange(prev.w, prev.h, nw, nh);
                }
              }
            } catch (_) {
              /* ignore */
            }
            syncMeissa2dSquareMapFrameLayout();
            scheduleMeissa2dOrthoViewportHiFetch();
          });
        }
      };

      const onImgErr = () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
        if (!firstDecodeDone && splashErrFallbackLow) {
          const failedSplashUrl = String(imgEl.currentSrc || imgEl.src || "").trim();
          const next = splashErrFallbackLow;
          splashErrFallbackLow = "";
          splashUpgradePending = false;
          try {
            setMeissa2dRawUrlForSnapshot(String(sid).trim(), next);
            imgEl.src = next;
            pushMeissa2dLoadLine("정사: 즉시 미리(<img>) 실패 → 본 해상도 URL 로 재시도");
            void (async () => {
              if (!failedSplashUrl || !meissaAccess) return;
              try {
                const tok = normalizeMeissaAccessToken(meissaAccess);
                const hdr = {};
                if (tok) hdr.Authorization = `JWT ${tok}`;
                const r = await fetch(failedSplashUrl, { method: "GET", headers: hdr, credentials: "same-origin" });
                const ct = String(r.headers.get("content-type") || "").slice(0, 48);
                const cl = r.headers.get("content-length");
                if (r.ok) {
                  pushMeissa2dLoadLine(
                    `정사: 미리보기 진단 HTTP ${r.status} · ${ct || "no content-type"}${cl ? ` · ${cl}b` : ""}`
                  );
                } else {
                  const snippet = (await r.text()).replace(/\s+/g, " ").slice(0, 140);
                  pushMeissa2dLoadLine(
                    `정사: 미리보기 진단 HTTP ${r.status} · ${ct || "-"} · ${snippet || "(빈 본문)"}`
                  );
                }
              } catch (ex) {
                pushMeissa2dLoadLine(
                  `정사: 미리보기 진단 fetch 실패: ${String(ex?.message || ex).slice(0, 120)}`
                );
              }
            })();
          } catch (_) {
            meissa2dOrthoApplyWrapLoadingPhase("idle");
            if (!settled) finish(false);
            cleanupListeners();
          }
          return;
        }
        if (dual && mainLoadingHigh) {
          highProbeFailed = true;
          mainLoadingHigh = false;
          meissa2dOrthoMain8192DecodeInFlight = false;
          meissa2dOrthoMain8192DecodeT0 = 0;
          try {
            scheduleMeissa2dOrthoViewportHiFetch();
          } catch (_) {
            /* ignore */
          }
          pushMeissa2dLoadLine("정사: 고해상 디코드 실패 — 저해상으로 복귀");
          try {
            imgEl.removeAttribute("data-meissa-2d-ortho-blob-tier");
            const lowBust = withOrthophotoImgCacheBust(low);
            setMeissa2dRawUrlForSnapshot(String(sid).trim(), lowBust);
            imgEl.src = lowBust;
          } catch (_) {
            meissa2dOrthoApplyWrapLoadingPhase("idle");
            if (!settled) finish(false);
            cleanupListeners();
          }
          return;
        }
        lowFailed = true;
        if (dual) {
          scheduleHighPrefetchOnce();
          flushPendingHigh();
        }
        if (!dual) {
          meissa2dOrthoApplyWrapLoadingPhase("idle");
          finish(false);
          cleanupListeners();
        } else if (highProbeFailed) {
          meissa2dOrthoApplyWrapLoadingPhase("idle");
          finish(false);
          cleanupListeners();
        }
      };

      const onLoad = onImgLoad;
      const onErr = onImgErr;
      imgEl.addEventListener("load", onLoad);
      imgEl.addEventListener("error", onErr);
      detach = () => {
        imgEl.removeEventListener("load", onLoad);
        imgEl.removeEventListener("error", onErr);
      };
      imgEl.__pilexyOrthoCleanup = cleanupListeners;

      meissa2dOrthoApplyWrapLoadingPhase("loading");
      pushMeissa2dLoadLine(
        useSplash
          ? `정사: 즉시 미리(max_edge=${MEISSA_ORTHOPHOTO_SPLASH_EDGE}) → 본 화질(max_edge=${MEISSA_ORTHOPHOTO_PREVIEW_EDGE})`
          : dual
            ? `정사: 저해상(max_edge=${MEISSA_ORTHOPHOTO_PREVIEW_EDGE}) 먼저 수신 → 이어서 고해상(max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE})`
            : `정사: orthophoto-preview 로드 (max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE})`
      );
      try {
        imgEl.removeAttribute("data-meissa-2d-ortho-blob-tier");
        const startSrc = useSplash ? splashUrl : low;
        setMeissa2dRawUrlForSnapshot(String(sid).trim(), startSrc);
        imgEl.src = startSrc;
      } catch (_) {
        meissa2dOrthoApplyWrapLoadingPhase("idle");
        finish(false);
        cleanupListeners();
        return;
      }

      lowStallTimer = window.setTimeout(() => {
        lowStallTimer = 0;
        if (settled || !isMeissa2dLoadCurrent(loadSeq, sid)) return;
        if (imgEl.complete && imgEl.naturalWidth > 0) return;
        pushMeissa2dLoadLine(
          "정사: orthophoto-preview PNG 수신이 120초 넘게 지연됩니다(서버·네트워크). 아직 로딩 중일 수 있으니 잠시만 두세요. 2D 팬/줌과 무관합니다."
        );
      }, 120000);
    });
  }

  function ensureMeissa2dPanZoomRoot() {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return null;
    let root = document.getElementById("meissa-2d-panzoom-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "meissa-2d-panzoom-root";
      root.className = "meissa-2d-panzoom-root";
      wrap.insertBefore(root, wrap.firstChild);
      const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
      const img = els.meissaCloud2dImageLocal;
      const pts = document.getElementById("meissa-cloud-2d-points-overlay");
      if (mosaic && mosaic.parentNode === wrap) root.appendChild(mosaic);
      if (img && img.parentNode === wrap) root.appendChild(img);
      if (pts && pts.parentNode === wrap) root.appendChild(pts);
    }
    return root;
  }

  function ensureMeissa2dMosaicLayer() {
    const root = ensureMeissa2dPanZoomRoot();
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!root || !wrap) return null;
    let layer = document.getElementById("meissa-cloud-2d-mosaic-local");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "meissa-cloud-2d-mosaic-local";
      layer.className = "meissa-cloud-2d-mosaic-local";
      root.appendChild(layer);
    } else if (layer.parentNode !== root) {
      root.appendChild(layer);
    }
    return layer;
  }

  function ensureMeissa2dPointsOverlayLayer() {
    const root = ensureMeissa2dPanZoomRoot();
    if (!root) return null;
    let layer = document.getElementById("meissa-cloud-2d-points-overlay");
    if (!layer) {
      layer = document.createElement("canvas");
      layer.id = "meissa-cloud-2d-points-overlay";
      layer.className = "meissa-cloud-2d-points-overlay";
      root.appendChild(layer);
    } else if (layer.parentNode !== root) {
      root.appendChild(layer);
    }
    return layer;
  }

  function ensureMeissa2dOrthoHiBadge() {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return null;
    let el = document.getElementById("meissa-2d-ortho-hi-badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "meissa-2d-ortho-hi-badge";
      el.className = "meissa-2d-ortho-hi-badge";
      el.setAttribute("aria-live", "polite");
      el.style.cssText = [
        "position:absolute",
        "top:8px",
        "right:8px",
        "z-index:12",
        "max-width:min(92%,22rem)",
        "padding:6px 10px",
        "border-radius:6px",
        "font:11px/1.35 system-ui,sans-serif",
        "pointer-events:none",
        "box-shadow:0 1px 6px rgba(0,0,0,.2)",
        "border:1px solid rgba(148,163,184,.45)",
        "background:rgba(15,23,42,.88)",
        "color:#e2e8f0",
        "white-space:pre-line",
        "display:none",
      ].join(";");
      wrap.appendChild(el);
    }
    try {
      const pos = window.getComputedStyle(wrap).position;
      if (pos === "static") wrap.style.position = "relative";
    } catch (_) {
      wrap.style.position = "relative";
    }
    return el;
  }

  /**
   * @param {string} text 빈 문자열이면 숨김
   * @param {"idle"|"load"|"ok"|"wait"|"err"} [tone]
   */
  function setMeissa2dOrthoHiBadge(text, tone) {
    const el = ensureMeissa2dOrthoHiBadge();
    if (!el) return;
    const t = String(text || "").trim();
    if (!t) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.textContent = t;
    el.style.display = "block";
    const border =
      tone === "load"
        ? "1px solid rgba(96,165,250,.65)"
        : tone === "ok"
          ? "1px solid rgba(52,211,153,.55)"
          : tone === "wait"
            ? "1px solid rgba(251,191,36,.55)"
            : tone === "err"
              ? "1px solid rgba(248,113,113,.6)"
              : "1px solid rgba(148,163,184,.45)";
    el.style.border = border;
  }

  function sumCachedOrthoViewportTileAreaForSnapshot(projectId, sid) {
    const prefix = `${String(projectId).trim()}:${String(sid).trim()}:`;
    let sumPx = 0;
    let nTiles = 0;
    for (const [key, entry] of meissa2dOrthoViewportHiTileCache) {
      if (!String(key).startsWith(prefix)) continue;
      let cw = entry?.cw;
      let ch = entry?.ch;
      if (!(cw > 0 && ch > 0)) {
        const p = parseCropFromOrthoViewportTileCacheKey(key);
        if (p) {
          cw = p.cw;
          ch = p.ch;
        }
      }
      if (cw > 0 && ch > 0) {
        sumPx += cw * ch;
        nTiles += 1;
      }
    }
    return { sumPx, nTiles };
  }

  function orthoViewportHiApproxCoveragePct(projectId, sid, effFullW, effFullH) {
    const { sumPx, nTiles } = sumCachedOrthoViewportTileAreaForSnapshot(projectId, sid);
    const denom = Math.max(1, Number(effFullW) * Number(effFullH));
    const pct = Math.min(100, Math.round((100 * sumPx) / denom));
    return { pct, nTiles, sumPx };
  }

  /** 배지용: 메인 8192 백그라운드 — 수신 바이트·디코드 단계를 %로(짧은 한 줄) */
  function orthoMain8192BackgroundBadgeLine(img, wrapEl) {
    if (!MEISSA_2D_SIMPLE_ORTHO) return "";
    if (MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES) return "고화질 · —";
    const nw = Math.round(Number(img?.naturalWidth || 0));
    const nh = Math.round(Number(img?.naturalHeight || 0));
    const longE = Math.max(nw, nh, 1);
    const target = MEISSA_ORTHOPHOTO_FULL_MAX_EDGE;
    const wrap = wrapEl || document.querySelector(".meissa-2d-overlay-wrap");
    const hiPending = Boolean(wrap?.classList?.contains("meissa-2d-ortho-hi-pending"));
    const tier = String(img?.getAttribute?.("data-meissa-2d-ortho-tier") || "");
    const upgradedPastPreview =
      longE > MEISSA_ORTHOPHOTO_PREVIEW_EDGE + 64 &&
      !meissa2dOrthoMain8192BytesInFlight &&
      !meissa2dOrthoMain8192DecodeInFlight &&
      !hiPending;
    const done = tier === "full" || longE >= target * 0.82 || upgradedPastPreview;
    const base = Math.min(91, Math.round((100 * longE) / target));
    let pct;
    if (done && !meissa2dOrthoMain8192DecodeInFlight) pct = 100;
    else if (meissa2dOrthoMain8192DecodeInFlight) {
      if (meissa2dOrthoMain8192DecodeT0 > 0) {
        const dt = Math.min(1, (Date.now() - meissa2dOrthoMain8192DecodeT0) / 2800);
        pct = Math.min(99, Math.round(92 + 7 * dt));
      } else {
        pct = 96;
      }
    } else if (
      hiPending &&
      !meissa2dOrthoMain8192BytesInFlight &&
      !meissa2dOrthoMain8192DecodeInFlight &&
      meissa2dOrthoMain8192DlTotal > 0 &&
      meissa2dOrthoMain8192DlBytes >= meissa2dOrthoMain8192DlTotal - 2
    ) {
      pct = 93;
    } else if (meissa2dOrthoMain8192BytesInFlight) {
      let dl01 = 0;
      if (meissa2dOrthoMain8192DlTotal > 0) {
        dl01 = Math.min(1, meissa2dOrthoMain8192DlBytes / meissa2dOrthoMain8192DlTotal);
      } else if (meissa2dOrthoMain8192DlBytes > 0) {
        dl01 = 1 - Math.exp(-meissa2dOrthoMain8192DlBytes / (16 * 1024 * 1024));
      } else {
        dl01 = meissa2dOrthoMain8192DlGhostRatio;
      }
      if (meissa2dOrthoMain8192FetchStartedAt > 0) {
        const sec = (Date.now() - meissa2dOrthoMain8192FetchStartedAt) / 1000;
        const ttfbBump = Math.min(0.22, sec / 60);
        const stallBump = Math.min(0.45, Math.max(0, sec - 3) / 140);
        let mono = Math.max(ttfbBump, stallBump);
        /* blob() 는 중간 onProgress 없음 → dl01 이 ~0.35 부근에서 멈춰 57%처럼 보임. 용량·경과로 단조 상승만 보조. */
        const totalB = meissa2dOrthoMain8192DlTotal;
        const gotB = meissa2dOrthoMain8192DlBytes;
        const weakBytes =
          totalB <= 0 || (totalB > 0 && gotB < Math.max(65536, totalB * 0.02));
        if (weakBytes) {
          const mbGuess = totalB > 0 ? totalB / (1024 * 1024) : 48;
          const etaSec = Math.min(900, Math.max(100, 35 + mbGuess * 26));
          mono = Math.max(mono, Math.min(0.92, Math.pow(Math.min(sec / etaSec, 1), 0.62)));
        }
        dl01 = Math.max(dl01, mono);
      }
      pct = Math.min(91, Math.round(base + dl01 * Math.max(1, 91 - base)));
    } else if (hiPending) {
      /* fetch 전·blob() 대기 등 bytesInFlight 가 아닐 때 base(예: 3072/8192≈38%, 4096/8192=50%)에 멈춘 것처럼 보임 → 경과 시간으로 완만히 상승 */
      let p = base;
      if (meissa2dOrthoHiPendingSince > 0) {
        const sec = (Date.now() - meissa2dOrthoHiPendingSince) / 1000;
        const creep = Math.min(32, 32 * Math.pow(Math.min(sec / 100, 1), 0.62));
        p = Math.min(88, Math.round(base + creep));
      }
      pct = p;
    } else {
      pct = Math.min(100, Math.round((100 * longE) / target));
    }
    const line =
      done && !meissa2dOrthoMain8192DecodeInFlight
        ? "고화질 완료"
        : `고화질 불러오는 중 · ${pct}%`;
    return line;
  }

  function buildMeissa2dOrthoHiBadgeText(baseText, projectId, sid, effFullW, effFullH) {
    const img = els.meissaCloud2dImageLocal;
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    const lines = [];
    if (MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI) {
      if (MEISSA_2D_SIMPLE_ORTHO && img) {
        const ml = orthoMain8192BackgroundBadgeLine(img, wrap);
        if (ml) lines.push(ml);
      }
      return lines.filter(Boolean).join("\n");
    }
    const bt = String(baseText || "").trim();
    if (bt) lines.push(bt);
    if (MEISSA_2D_SIMPLE_ORTHO && img) {
      const ml = orthoMain8192BackgroundBadgeLine(img, wrap);
      if (ml) lines.push(ml);
    }
    if (meissa2dOrthoViewportHiRedundantWithMainImg(img)) {
      lines.push(
        meissa2dOrthoViewportHiFetchInFlight
          ? "뷰패치: 메인과 동일 해상도 · 디코드 마무리"
          : "뷰패치: 고화질 전체와 동일 · 오버레이 생략"
      );
      return lines.filter(Boolean).join("\n");
    }
    const pid = String(projectId || "").trim();
    const sidv = String(sid || "").trim();
    const efW = Number(effFullW);
    const efH = Number(effFullH);
    if (!pid || !sidv || !(efW > 0) || !(efH > 0)) {
      if (meissa2dOrthoViewportHiFetchInFlight) lines.push("뷰패치: 불러오는 중…");
      return lines.filter(Boolean).join("\n");
    }
    const { nTiles } = orthoViewportHiApproxCoveragePct(pid, sidv, efW, efH);
    lines.push(
      `뷰패치 캐시 ${nTiles}장${meissa2dOrthoViewportHiFetchInFlight ? " · 패치 수신 중" : ""}`
    );
    return lines.filter(Boolean).join("\n");
  }

  function setMeissa2dOrthoHiBadgeForViewportHi(baseText, tone, ctx) {
    try {
      meissa2dOrthoHiBadgeReplay = {
        baseText: String(baseText || ""),
        tone: tone || "idle",
        projectId: String(ctx?.projectId || "").trim(),
        sid: String(ctx?.sid || "").trim(),
        effFullW: Number(ctx?.effFullW) || 0,
        effFullH: Number(ctx?.effFullH) || 0,
      };
    } catch (_) {
      /* ignore */
    }
    const t = buildMeissa2dOrthoHiBadgeText(
      baseText,
      ctx?.projectId,
      ctx?.sid,
      ctx?.effFullW,
      ctx?.effFullH
    );
    setMeissa2dOrthoHiBadge(t, tone);
  }

  /** 메인 8192 수신 바이트만 바뀐 뒤 배지만 갱신(뷰패치 schedule 호출 금지 → 타이머 기아 방지) */
  function applyReplayMeissa2dOrthoHiBadgeNow() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    const r = meissa2dOrthoHiBadgeReplay;
    const pid =
      String(r.projectId || "").trim() ||
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    const sidv =
      String(r.sid || "").trim() ||
      (els.meissaSnapshotSelect?.value || "").trim() ||
      (els.snapshotId?.value || "").trim();
    const efW = Number(r.effFullW) > 0 ? Number(r.effFullW) : 0;
    const efH = Number(r.effFullH) > 0 ? Number(r.effFullH) : 0;
    const t = buildMeissa2dOrthoHiBadgeText(String(r.baseText || ""), pid, sidv, efW, efH);
    setMeissa2dOrthoHiBadge(t, r.tone || "idle");
  }

  function resyncMeissa2dOrthoHiBadgeFromMain8192Progress() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    if (meissa2dOrthoHiBadgeProgTimer) {
      try {
        window.clearTimeout(meissa2dOrthoHiBadgeProgTimer);
      } catch (_) {
        /* ignore */
      }
    }
    meissa2dOrthoHiBadgeProgTimer = window.setTimeout(() => {
      meissa2dOrthoHiBadgeProgTimer = 0;
      try {
        applyReplayMeissa2dOrthoHiBadgeNow();
      } catch (_) {
        /* ignore */
      }
    }, 130);
  }

  function clearMeissa2dOrthoViewportHi() {
    if (meissa2dOrthoViewportHiLocalRaf) {
      try {
        window.cancelAnimationFrame(meissa2dOrthoViewportHiLocalRaf);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiLocalRaf = 0;
    }
    meissa2dOrthoViewportHiLocalLastLogTs = 0;
    meissa2dOrthoViewportHi503Streak = 0;
    meissa2dOrthoViewportHiFetchInFlight = false;
    if (meissa2dOrthoHiBadgeProgTimer) {
      try {
        window.clearTimeout(meissa2dOrthoHiBadgeProgTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoHiBadgeProgTimer = 0;
    }
    meissa2dOrthoHiBadgeReplay = {
      baseText: "",
      tone: "idle",
      projectId: "",
      sid: "",
      effFullW: 0,
      effFullH: 0,
    };
    setMeissa2dOrthoHiBadge("", "idle");
    if (meissa2dOrthoViewportHiTimer) {
      try {
        window.clearTimeout(meissa2dOrthoViewportHiTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiTimer = 0;
    }
    if (meissa2dViewSettleTimer) {
      try {
        window.clearTimeout(meissa2dViewSettleTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dViewSettleTimer = 0;
    }
    if (meissa2dOrthoViewportHiAbort) {
      try {
        meissa2dOrthoViewportHiAbort.abort();
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiAbort = null;
    }
    meissa2dOrthoViewportHiLastKey = "";
    meissa2dOrthoViewportHiLayoutMeta = null;
    meissa2dOrthoPatchImageSource = null;
    meissa2dOrthoAnalysisImage = null;
    meissa2dOrthoAnalysisImageKey = "";
    meissa2dOrthoAnalysisImageInFlight = false;
    meissa2dOrthoAnalysisImageFailKey = "";
    meissa2dOrthoAnalysisImageReqSeq++;
    meissa2dOrthoAnalysisPrimeSig = "";
    meissa2dOrthoAnalysisPrimeInFlight = false;
    const hi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
    if (hi) {
      if (hi.tagName === "CANVAS") {
        try {
          const ctx = hi.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, hi.width, hi.height);
        } catch (_) {
          /* ignore */
        }
      } else {
        hi.onload = null;
        hi.onerror = null;
        hi.removeAttribute("src");
      }
      hi.style.display = "none";
    }
  }

  /** 뷰패치만 끄고 배지(replay·고화질 줄)는 건드리지 않음 */
  function shutdownMeissa2dOrthoViewportHiOnly() {
    if (meissa2dOrthoViewportHiLocalRaf) {
      try {
        window.cancelAnimationFrame(meissa2dOrthoViewportHiLocalRaf);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiLocalRaf = 0;
    }
    meissa2dOrthoViewportHiLocalLastLogTs = 0;
    meissa2dOrthoViewportHi503Streak = 0;
    meissa2dOrthoViewportHiFetchInFlight = false;
    if (meissa2dOrthoViewportHiTimer) {
      try {
        window.clearTimeout(meissa2dOrthoViewportHiTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiTimer = 0;
    }
    if (meissa2dViewSettleTimer) {
      try {
        window.clearTimeout(meissa2dViewSettleTimer);
      } catch (_) {
        /* ignore */
      }
      meissa2dViewSettleTimer = 0;
    }
    if (meissa2dOrthoViewportHiAbort) {
      try {
        meissa2dOrthoViewportHiAbort.abort();
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiAbort = null;
    }
    meissa2dOrthoViewportHiLastKey = "";
    meissa2dOrthoViewportHiLayoutMeta = null;
    meissa2dOrthoPatchImageSource = null;
    meissa2dOrthoAnalysisImage = null;
    meissa2dOrthoAnalysisImageKey = "";
    meissa2dOrthoAnalysisImageInFlight = false;
    meissa2dOrthoAnalysisImageFailKey = "";
    meissa2dOrthoAnalysisImageReqSeq++;
    meissa2dOrthoAnalysisPrimeSig = "";
    meissa2dOrthoAnalysisPrimeInFlight = false;
    try {
      clearMeissa2dOrthoViewportHiTileCache();
    } catch (_) {
      /* ignore */
    }
    const hi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
    if (hi) {
      if (hi.tagName === "CANVAS") {
        try {
          const ctx = hi.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, hi.width, hi.height);
        } catch (_) {
          /* ignore */
        }
      } else {
        hi.onload = null;
        hi.onerror = null;
        hi.removeAttribute("src");
      }
      hi.style.display = "none";
    }
  }

  function ensureMeissa2dOrthoViewportHiCanvas() {
    const root = ensureMeissa2dPanZoomRoot();
    if (!root) return null;
    let el = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
    if (!el || el.tagName !== "CANVAS") {
      if (el && el.parentNode) {
        try {
          el.remove();
        } catch (_) {
          /* ignore */
        }
      }
      el = document.createElement("canvas");
      el.id = "meissa-cloud-2d-ortho-viewport-hi";
      el.className = "meissa-cloud-2d-ortho-viewport-hi";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:absolute;pointer-events:none;z-index:2;display:none;image-rendering:auto;";
      const pts = document.getElementById("meissa-cloud-2d-points-overlay");
      if (pts && pts.parentNode === root) root.insertBefore(el, pts);
      else root.appendChild(el);
    } else if (el.parentNode !== root) {
      const pts = document.getElementById("meissa-cloud-2d-points-overlay");
      if (pts && pts.parentNode === root) root.insertBefore(el, pts);
      else root.appendChild(el);
    }
    return el;
  }

  /**
   * 버튼 URL 단일 모드 전용: orthophoto-preview 네트워크 없이
   * 현재 메인 <img>에서 보이는 영역만 고해상 캔버스로 즉시 재표본화한다.
   * (CSS transform에 고정된 저해상 텍스처가 확대되는 느낌을 줄임)
   */
  function renderMeissa2dOrthoViewportHiFromMainImageLocal() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    const img = els.meissaCloud2dImageLocal;
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!img || !wrap || !hasRenderableOverlayImage(img)) {
      const hi0 = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (hi0) hi0.style.display = "none";
      return;
    }
    if (img.getAttribute("data-meissa-2d-intrinsic-layout") !== "1") {
      const hi0 = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (hi0) hi0.style.display = "none";
      return;
    }
    const nw = Math.round(Number(img.naturalWidth || 0));
    const nh = Math.round(Number(img.naturalHeight || 0));
    if (nw < 32 || nh < 32) {
      const hi0 = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (hi0) hi0.style.display = "none";
      return;
    }
    const sPan = meissa2dPanzoomScaleSanitized();
    const tx = Number(meissa2dViewTx) || 0;
    const ty = Number(meissa2dViewTy) || 0;
    const ww = Math.max(1, Number(wrap.clientWidth || 1));
    const wh = Math.max(1, Number(wrap.clientHeight || 1));
    const viewLeft = -tx / sPan;
    const viewTop = -ty / sPan;
    const viewW = Math.max(1, ww / sPan);
    const viewH = Math.max(1, wh / sPan);
    const ix0 = Math.max(0, Math.floor(viewLeft));
    const iy0 = Math.max(0, Math.floor(viewTop));
    const ix1 = Math.min(nw, Math.ceil(viewLeft + viewW));
    const iy1 = Math.min(nh, Math.ceil(viewTop + viewH));
    const visW = Math.max(1, ix1 - ix0);
    const visH = Math.max(1, iy1 - iy0);
    if (visW < 8 || visH < 8) {
      const hi0 = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (hi0) hi0.style.display = "none";
      return;
    }
    const vpPx = meissa2dOverlayPixelScaleForViewportCanvas(ww, wh, sPan);
    const cnv = ensureMeissa2dOrthoViewportHiCanvas();
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    const bw = Math.max(1, Math.round(visW * vpPx));
    const bh = Math.max(1, Math.round(visH * vpPx));
    if (cnv.width !== bw || cnv.height !== bh) {
      cnv.width = bw;
      cnv.height = bh;
    }
    meissa2dOrthoViewportHiLayoutMeta = {
      type: "local-main-image",
      left: ix0,
      top: iy0,
      width: visW,
      height: visH,
      pxScale: vpPx,
    };
    cnv.style.display = "block";
    cnv.style.position = "absolute";
    cnv.style.zIndex = "2";
    syncMeissa2dOrthoViewportHiLayout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(vpPx, 0, 0, vpPx, 0, 0);
    const prevSmooth = ctx.imageSmoothingEnabled;
    let prevQuality = "low";
    try {
      if ("imageSmoothingQuality" in ctx) prevQuality = ctx.imageSmoothingQuality;
    } catch (_) {
      /* ignore */
    }
    ctx.imageSmoothingEnabled = true;
    try {
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, ix0, iy0, visW, visH, 0, 0, visW, visH);
    } finally {
      ctx.imageSmoothingEnabled = prevSmooth;
      try {
        if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = prevQuality;
      } catch (_) {
        /* ignore */
      }
    }
    const now = Date.now();
    if (now - Number(meissa2dOrthoViewportHiLocalLastLogTs || 0) > 1200) {
      meissa2dOrthoViewportHiLocalLastLogTs = now;
      pushMeissa2dLoadLine(
        `정사: 줌 캔버스 재갱신 view ${Math.round(visW)}×${Math.round(visH)} · back ${bw}×${bh} · scale×${sPan.toFixed(2)}`
      );
    }
  }

  function scheduleMeissa2dOrthoViewportHiFromMainImageLocal() {
    if (!isMeissa2dButtonUrlOnlySingleMode()) return;
    if (meissa2dOrthoViewportHiLocalRaf) return;
    meissa2dOrthoViewportHiLocalRaf = window.requestAnimationFrame(() => {
      meissa2dOrthoViewportHiLocalRaf = 0;
      if (!isMeissa2dButtonUrlOnlySingleMode()) return;
      renderMeissa2dOrthoViewportHiFromMainImageLocal();
    });
  }

  function syncMeissa2dOrthoViewportHiLayout() {
    const hi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
    if (!hi || hi.style.display === "none" || hi.tagName !== "CANVAS") return;
    const m = meissa2dOrthoViewportHiLayoutMeta;
    if (!m || !Number.isFinite(m.left)) return;
    hi.style.left = `${m.left}px`;
    hi.style.top = `${m.top}px`;
    hi.style.width = `${Math.max(1, m.width)}px`;
    hi.style.height = `${Math.max(1, m.height)}px`;
  }

  /** 메인 <img>가 이미 full max_edge 급이면 crop 캔버스는 이중 합성으로 깨짐·번짐만 유발 */
  function meissa2dOrthoViewportHiRedundantWithMainImg(imgEl) {
    if (!imgEl || !MEISSA_2D_SIMPLE_ORTHO || MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES) return false;
    const srcKind = getMeissa2dImageDataSource(imgEl);
    // 버튼 URL(export PNG)은 모바일 브라우저에서 내부 다운샘플될 수 있어
    // naturalWidth가 커도 뷰포트 패치 fetch를 유지한다.
    if (srcKind === "orthophoto-button-url" || srcKind === "orthophoto-export") return false;
    const nw = Math.round(Number(imgEl.naturalWidth || 0));
    const nh = Math.round(Number(imgEl.naturalHeight || 0));
    if (nw < 32 || nh < 32) return false;
    return Math.max(nw, nh) >= MEISSA_ORTHOPHOTO_FULL_MAX_EDGE * 0.82;
  }

  function snapOrthoViewportCropToGrid(cx0, cy0, cw0, ch0, effW, effH, snapPx) {
    const g = Math.max(64, Math.min(2048, Math.round(Number(snapPx) || 512)));
    const x0 = Math.max(0, Math.floor(cx0 / g) * g);
    const y0 = Math.max(0, Math.floor(cy0 / g) * g);
    const x1 = Math.min(Number(effW), cx0 + cw0);
    const y1 = Math.min(Number(effH), cy0 + ch0);
    let w = Math.min(8192, x1 - x0);
    let h = Math.min(8192, y1 - y0);
    if (w < 1 || h < 1) return { cx: cx0, cy: cy0, cw: cw0, ch: ch0 };
    return { cx: x0, cy: y0, cw: Math.max(1, w), ch: Math.max(1, h) };
  }

  function viewportOrthoHiTileCacheKey(projectId, sid, cx, cy, cw, ch, edge) {
    return `${String(projectId).trim()}:${String(sid).trim()}:${cx},${cy},${cw},${ch}:${edge}`;
  }

  function parseCropFromOrthoViewportTileCacheKey(key) {
    const m = String(key).match(/(\d+),(\d+),(\d+),(\d+)(?=:|\s*$)/);
    if (!m) return null;
    return { cx: +m[1], cy: +m[2], cw: +m[3], ch: +m[4] };
  }

  function viewportOrthoHiTileCacheTouch(key) {
    const v = meissa2dOrthoViewportHiTileCache.get(key);
    if (!v) return null;
    meissa2dOrthoViewportHiTileCache.delete(key);
    meissa2dOrthoViewportHiTileCache.set(key, v);
    return v;
  }

  function viewportOrthoHiTileCacheStore(key, im, meta, cropOpt) {
    let cx;
    let cy;
    let cw;
    let ch;
    if (
      cropOpt &&
      Number.isFinite(cropOpt.cx) &&
      Number.isFinite(cropOpt.cy) &&
      Number.isFinite(cropOpt.cw) &&
      Number.isFinite(cropOpt.ch)
    ) {
      cx = cropOpt.cx;
      cy = cropOpt.cy;
      cw = cropOpt.cw;
      ch = cropOpt.ch;
    } else {
      const p = parseCropFromOrthoViewportTileCacheKey(key);
      if (p) {
        cx = p.cx;
        cy = p.cy;
        cw = p.cw;
        ch = p.ch;
      }
    }
    if (meissa2dOrthoViewportHiTileCache.has(key)) {
      meissa2dOrthoViewportHiTileCache.delete(key);
    }
    while (meissa2dOrthoViewportHiTileCache.size >= MEISSA_ORTHOPHOTO_VIEWPORT_TILE_CACHE_MAX) {
      const k0 = meissa2dOrthoViewportHiTileCache.keys().next().value;
      meissa2dOrthoViewportHiTileCache.delete(k0);
    }
    meissa2dOrthoViewportHiTileCache.set(key, { im, meta, cx, cy, cw, ch });
  }

  function clearMeissa2dOrthoViewportHiTileCache() {
    try {
      meissa2dOrthoViewportHiTileCache.clear();
    } catch (_) {
      /* ignore */
    }
  }

  function scheduleMeissa2dOrthoViewportHiFetch() {
    if (!MEISSA_2D_SIMPLE_ORTHO) return;
    if (isMeissa2dButtonUrlOnlySingleMode()) {
      scheduleMeissa2dOrthoViewportHiFromMainImageLocal();
      return;
    }
    if (MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI) {
      shutdownMeissa2dOrthoViewportHiOnly();
      try {
        applyReplayMeissa2dOrthoHiBadgeNow();
      } catch (_) {
        /* ignore */
      }
      return;
    }
    const img0 = els.meissaCloud2dImageLocal;
    const _nw0 = Math.round(Number(img0?.naturalWidth || 0));
    const _nh0 = Math.round(Number(img0?.naturalHeight || 0));
    const _red = meissa2dOrthoViewportHiRedundantWithMainImg(img0);
    if (_red) {
      clearMeissa2dOrthoViewportHi();
      return;
    }
    tryMeissa2dOrthoViewportHiPaintCachedSync();
    const resPeek = computeMeissa2dOrthoViewportHiFrameResult();
    if (
      resPeek.t === "ok" &&
      meissa2dOrthoViewportHiTileCache.has(resPeek.fr.tileKey) &&
      !meissa2dOrthoViewportHiFetchInFlight
    ) {
      void runMeissa2dOrthoViewportHiFetch();
    }
    /* 메인 전체 8192/이미지 폴백 수신 중에는 뷰포트 crop 네트워크 요청을 유예(대역·연결 풀·서버 부하 간섭 완화). 캐시 히트·합성은 위에서 이미 처리. */
    if (
      meissa2dOrthoMain8192BytesInFlight &&
      resPeek.t === "ok" &&
      !meissa2dOrthoViewportHiTileCache.has(resPeek.fr.tileKey)
    ) {
      if (meissa2dOrthoViewportHiTimer) {
        try {
          window.clearTimeout(meissa2dOrthoViewportHiTimer);
        } catch (_) {
          /* ignore */
        }
        meissa2dOrthoViewportHiTimer = 0;
      }
      return;
    }
    if (meissa2dOrthoViewportHiTimer) {
      try {
        window.clearTimeout(meissa2dOrthoViewportHiTimer);
      } catch (_) {
        /* ignore */
      }
    }
    meissa2dOrthoViewportHiTimer = window.setTimeout(() => {
      meissa2dOrthoViewportHiTimer = 0;
      void runMeissa2dOrthoViewportHiFetch();
    }, MEISSA_ORTHOPHOTO_VIEWPORT_HI_DEBOUNCE_MS);
  }

  function parseOrthoCropResponseHeaders(res) {
    try {
      const h = res.headers;
      const fullW = parseInt(String(h.get("X-Ortho-Full-W") || ""), 10);
      const fullH = parseInt(String(h.get("X-Ortho-Full-H") || ""), 10);
      const srcX0 = parseInt(String(h.get("X-Ortho-Src-X0") || ""), 10);
      const srcY0 = parseInt(String(h.get("X-Ortho-Src-Y0") || ""), 10);
      const srcW = parseInt(String(h.get("X-Ortho-Src-W") || ""), 10);
      const srcH = parseInt(String(h.get("X-Ortho-Src-H") || ""), 10);
      if (!(fullW > 0 && fullH > 0 && srcW > 0 && srcH > 0)) return null;
      if (!(Number.isFinite(srcX0) && srcX0 >= 0 && Number.isFinite(srcY0) && srcY0 >= 0)) return null;
      return { fullW, fullH, srcX0, srcY0, srcW, srcH };
    } catch (_) {
      return null;
    }
  }

  function decodeBlobToImage(blob) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => {
        try {
          URL.revokeObjectURL(u);
        } catch (_) {
          /* ignore */
        }
        resolve(im);
      };
      im.onerror = () => {
        try {
          URL.revokeObjectURL(u);
        } catch (_) {
          /* ignore */
        }
        reject(new Error("decode"));
      };
      im.src = u;
    });
  }

  /**
   * 뷰포트 정사 패치 전용: 사진 기반 정사 이미지는 최근접(보간 끔)으로 확대하면
   * 줌 중 계단·깨짐이 도드라진다. 확대/축소 비율에 맞춰 스무딩을 켜서 시각 품질을 우선한다.
   */
  function drawOrthoTilePatch(ctx, im, iw, ih, dx, dy, dw, dh) {
    const prevS = ctx.imageSmoothingEnabled;
    let prevQ = "low";
    try {
      if ("imageSmoothingQuality" in ctx) prevQ = ctx.imageSmoothingQuality;
    } catch (_) {
      /* ignore */
    }
    const scaleX = Math.max(1e-6, Number(dw) / Math.max(1, Number(iw) || 1));
    const scaleY = Math.max(1e-6, Number(dh) / Math.max(1, Number(ih) || 1));
    const isUpscale = scaleX > 1.03 || scaleY > 1.03;
    ctx.imageSmoothingEnabled = true;
    try {
      if ("imageSmoothingQuality" in ctx) {
        ctx.imageSmoothingQuality = isUpscale ? "high" : "medium";
      }
      ctx.drawImage(im, 0, 0, iw, ih, dx, dy, dw, dh);
    } finally {
      ctx.imageSmoothingEnabled = prevS;
      try {
        if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = prevQ;
      } catch (_) {
        /* ignore */
      }
    }
  }

  /** 캐시에 쌓인 타일만 미리보기 좌표계에서 겹치는 만큼 합성 — 이미 받은 영역은 재요청 없음 */
  function paintOrthoViewportHiCompositeCachedTiles(
    cnv,
    ctx,
    vpPx,
    ix0,
    iy0,
    visW,
    visH,
    nw,
    nh,
    effFullW,
    effFullH
  ) {
    const bvW = Math.max(1, Math.round(visW * vpPx));
    const bvH = Math.max(1, Math.round(visH * vpPx));
    if (cnv.width !== bvW || cnv.height !== bvH) {
      cnv.width = bvW;
      cnv.height = bvH;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bvW + 2, bvH + 2);
    }
    ctx.setTransform(vpPx, 0, 0, vpPx, 0, 0);
    const pairs = Array.from(meissa2dOrthoViewportHiTileCache.entries());
    const efW = Number(effFullW) > 0 ? effFullW : nw;
    const efH = Number(effFullH) > 0 ? effFullH : nh;
    let drew = 0;
    const vx0 = ix0;
    const vy0 = iy0;
    const vx1 = ix0 + visW;
    const vy1 = iy0 + visH;
    for (const [key, entry] of pairs) {
      const im = entry?.im;
      if (!im) continue;
      const iw0 = Math.max(1, im.naturalWidth || im.width);
      const ih0 = Math.max(1, im.naturalHeight || im.height);
      const metaHdr = entry?.meta;
      let pl;
      let pt;
      let pw;
      let ph;
      if (metaHdr && metaHdr.fullW > 0 && metaHdr.fullH > 0) {
        pl = metaHdr.srcX0 * (nw / metaHdr.fullW);
        pt = metaHdr.srcY0 * (nh / metaHdr.fullH);
        pw = metaHdr.srcW * (nw / metaHdr.fullW);
        ph = metaHdr.srcH * (nh / metaHdr.fullH);
      } else if (
        Number.isFinite(entry.cx) &&
        Number.isFinite(entry.cy) &&
        Number.isFinite(entry.cw) &&
        Number.isFinite(entry.ch) &&
        entry.cw > 0 &&
        entry.ch > 0
      ) {
        pl = (entry.cx * nw) / efW;
        pt = (entry.cy * nh) / efH;
        pw = (entry.cw * nw) / efW;
        ph = (entry.ch * nh) / efH;
      } else {
        const p = parseCropFromOrthoViewportTileCacheKey(key);
        if (!p || p.cw < 1 || p.ch < 1) continue;
        pl = (p.cx * nw) / efW;
        pt = (p.cy * nh) / efH;
        pw = (p.cw * nw) / efW;
        ph = (p.ch * nh) / efH;
      }
      const tx0 = pl;
      const ty0 = pt;
      const tx1 = pl + pw;
      const ty1 = pt + ph;
      if (tx1 <= vx0 || ty1 <= vy0 || tx0 >= vx1 || ty0 >= vy1) continue;
      const dx = pl - ix0;
      const dy = pt - iy0;
      drawOrthoTilePatch(ctx, im, iw0, ih0, dx, dy, Math.max(1, pw), Math.max(1, ph));
      viewportOrthoHiTileCacheTouch(key);
      drew += 1;
    }
    return drew;
  }

  /**
   * 뷰포트 고해상 타일·레이아웃 계산. pan/zoom 직후 캐시 즉시 페인트와 디바운스 fetch 가 공유.
   * @returns {{ t: "noop" } | { t: "clear" } | { t: "ok", fr: Record<string, unknown> }}
   */
  function computeMeissa2dOrthoViewportHiFrameResult() {
    if (!MEISSA_2D_SIMPLE_ORTHO || !meissaAccess) return { t: "noop" };
    if (MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI) return { t: "noop" };
    const img = els.meissaCloud2dImageLocal;
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!img || !wrap || !hasRenderableOverlayImage(img)) {
      return { t: "clear" };
    }
    if (img.getAttribute("data-meissa-2d-intrinsic-layout") !== "1") return { t: "noop" };
    const sid =
      (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    if (!sid || !projectId) return { t: "noop" };
    const snapKey = `${projectId}:${sid}`;
    const geo = meissa2dGeorefBySnapshot[snapKey];
    if (!geo?.bbox) return { t: "noop" };
    if (!useFullGeorefForOverlayImage(img)) return { t: "noop" };

    const nw = Math.round(Number(img.naturalWidth || 0));
    const nh = Math.round(Number(img.naturalHeight || 0));
    if (nw < 32 || nh < 32) return { t: "noop" };
    if (meissa2dOrthoViewportHiRedundantWithMainImg(img)) {
      setMeissa2dOrthoHiBadge("", "idle");
      return { t: "clear" };
    }

    let guessFullW = Number(geo.width);
    let guessFullH = Number(geo.height);
    const srcKind = getMeissa2dImageDataSource(img);
    const nominalLong = meissa2dOrthoNominalLongEdgeFromImgSrc(img?.src || "");
    const geoHasLarger =
      Number.isFinite(guessFullW) &&
      Number.isFinite(guessFullH) &&
      guessFullW > nw * 1.12 &&
      guessFullH > nh * 1.12;
    if (!geoHasLarger) {
      if (srcKind === "orthophoto-button-url" || srcKind === "orthophoto-export") {
        const targetLong = Number.isFinite(nominalLong)
          ? nominalLong
          : Math.max(MEISSA_ORTHOPHOTO_FULL_MAX_EDGE * 2, Math.max(nw, nh));
        const ar = nw / Math.max(1, nh);
        if (ar >= 1) {
          guessFullW = Math.min(56000, Math.max(nw, targetLong));
          guessFullH = Math.min(56000, Math.max(nh, Math.round(guessFullW / Math.max(1e-9, ar))));
        } else {
          guessFullH = Math.min(56000, Math.max(nh, targetLong));
          guessFullW = Math.min(56000, Math.max(nw, Math.round(guessFullH * ar)));
        }
      } else {
        if (nw > MEISSA_ORTHOPHOTO_FULL_MAX_EDGE + 256) {
          setMeissa2dOrthoHiBadge("", "idle");
          return { t: "clear" };
        }
        guessFullW = Math.min(56000, Math.max(nw * 4, nw));
        guessFullH = Math.min(56000, Math.round(nh * (guessFullW / Math.max(nw, 1))));
      }
    }
    const cached = meissa2dOrthoFullPxBySnapshot[snapKey];
    let effFullW = Number(cached?.w) > 0 ? Number(cached.w) : guessFullW;
    let effFullH = Number(cached?.h) > 0 ? Number(cached.h) : guessFullH;
    if (!(effFullW > 0 && effFullH > 0)) return { t: "noop" };
    const scaleUpX = effFullW / nw;
    const scaleUpY = effFullH / nh;
    if (scaleUpX < 1.08 && scaleUpY < 1.08) {
      setMeissa2dOrthoHiBadge("", "idle");
      return { t: "clear" };
    }

    const sPan = meissa2dPanzoomScaleSanitized();
    const tx = Number(meissa2dViewTx) || 0;
    const ty = Number(meissa2dViewTy) || 0;
    const { w: ww, h: wh } = getOverlayWrapSize();
    const viewLeft = -tx / sPan;
    const viewTop = -ty / sPan;
    const viewW = Math.max(1, ww / sPan);
    const viewH = Math.max(1, wh / sPan);

    const ix0 = Math.max(0, Math.floor(viewLeft));
    const iy0 = Math.max(0, Math.floor(viewTop));
    const ix1 = Math.min(nw, Math.ceil(viewLeft + viewW));
    const iy1 = Math.min(nh, Math.ceil(viewTop + viewH));
    const visW = Math.max(1, ix1 - ix0);
    const visH = Math.max(1, iy1 - iy0);
    if (visW < 8 || visH < 8) {
      return { t: "clear" };
    }

    const vpPx = meissa2dOverlayPixelScaleForViewportCanvas(ww, wh, sPan);

    let cx = Math.max(0, Math.floor(ix0 * scaleUpX));
    let cy = Math.max(0, Math.floor(iy0 * scaleUpY));
    let cw = Math.min(effFullW - cx, Math.ceil(visW * scaleUpX) + 2);
    let ch = Math.min(effFullH - cy, Math.ceil(visH * scaleUpY) + 2);
    cw = Math.min(8192, Math.max(1, cw));
    ch = Math.min(8192, Math.max(1, ch));
    if (effFullW - cx < 1 || effFullH - cy < 1) {
      return { t: "clear" };
    }
    const snapped = snapOrthoViewportCropToGrid(
      cx,
      cy,
      cw,
      ch,
      effFullW,
      effFullH,
      MEISSA_ORTHOPHOTO_VIEWPORT_CROP_SNAP_PX
    );
    cx = snapped.cx;
    cy = snapped.cy;
    cw = snapped.cw;
    ch = snapped.ch;

    const tileKey = viewportOrthoHiTileCacheKey(
      projectId,
      sid,
      cx,
      cy,
      cw,
      ch,
      MEISSA_ORTHOPHOTO_VIEWPORT_HI_EDGE
    );
    const reqKey = `${tileKey}:vp${Math.round(vpPx * 100)}`;

    return {
      t: "ok",
      fr: {
        nw,
        nh,
        ix0,
        iy0,
        visW,
        visH,
        vpPx,
        cx,
        cy,
        cw,
        ch,
        tileKey,
        reqKey,
        projectId,
        sid,
        snapKey,
        effFullW,
        effFullH,
        scaleUpX,
        scaleUpY,
      },
    };
  }

  /** 디바운스 대기 없이 타일 캐시가 있으면 즉시 페인트 — 줌/팬 중 레이아웃·합성 어긋남 완화 */
  function tryMeissa2dOrthoViewportHiPaintCachedSync() {
    if (MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI) return;
    const res = computeMeissa2dOrthoViewportHiFrameResult();
    if (res.t !== "ok") return;
    const fr = res.fr;
    const cnv = ensureMeissa2dOrthoViewportHiCanvas();
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    meissa2dOrthoViewportHiLayoutMeta = {
      type: "grid",
      left: fr.ix0,
      top: fr.iy0,
      width: fr.visW,
      height: fr.visH,
      pxScale: fr.vpPx,
    };
    cnv.style.display = "block";
    cnv.style.position = "absolute";
    cnv.style.zIndex = "2";
    const nDraw = paintOrthoViewportHiCompositeCachedTiles(
      cnv,
      ctx,
      fr.vpPx,
      fr.ix0,
      fr.iy0,
      fr.visW,
      fr.visH,
      fr.nw,
      fr.nh,
      fr.effFullW,
      fr.effFullH
    );
    if (nDraw < 1) return;
    try {
      if (meissa2dOrthoViewportHiAbort) {
        meissa2dOrthoViewportHiAbort.abort();
      }
    } catch (_) {
      /* ignore */
    }
    meissa2dOrthoViewportHiAbort = null;
    syncMeissa2dOrthoViewportHiLayout();
    meissa2dOrthoViewportHiLastKey = fr.reqKey;
    meissa2dOrthoViewportHi503Streak = 0;
    setMeissa2dOrthoHiBadgeForViewportHi(
      `패치 캐시 ${nDraw}장 · ${Math.round(fr.visW)}×${Math.round(fr.visH)}`,
      "ok",
      { projectId: fr.projectId, sid: fr.sid, effFullW: fr.effFullW, effFullH: fr.effFullH }
    );
  }

  async function runMeissa2dOrthoViewportHiFetch() {
    if (MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI) return;
    const res = computeMeissa2dOrthoViewportHiFrameResult();
    if (res.t === "noop") return;
    if (res.t === "clear") {
      clearMeissa2dOrthoViewportHi();
      return;
    }
    const fr = res.fr;
    const nw = fr.nw;
    const nh = fr.nh;
    const ix0 = fr.ix0;
    const iy0 = fr.iy0;
    const visW = fr.visW;
    const visH = fr.visH;
    const vpPx = fr.vpPx;
    const cx = fr.cx;
    const cy = fr.cy;
    const cw = fr.cw;
    const ch = fr.ch;
    const tileKey = fr.tileKey;
    const reqKey = fr.reqKey;
    const projectId = fr.projectId;
    const sid = fr.sid;
    const snapKey = fr.snapKey;
    const effFullW = fr.effFullW;
    const effFullH = fr.effFullH;
    const badgeCtx = { projectId, sid, effFullW, effFullH };

    const cnv = ensureMeissa2dOrthoViewportHiCanvas();
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    if (!ctx) {
      setMeissa2dOrthoHiBadge("고해상 캔버스 오류", "err");
      return;
    }

    meissa2dOrthoViewportHiLayoutMeta = {
      type: "grid",
      left: ix0,
      top: iy0,
      width: visW,
      height: visH,
      pxScale: vpPx,
    };
    cnv.style.display = "block";
    cnv.style.position = "absolute";
    cnv.style.zIndex = "2";
    syncMeissa2dOrthoViewportHiLayout();

    const nComposite = paintOrthoViewportHiCompositeCachedTiles(
      cnv,
      ctx,
      vpPx,
      ix0,
      iy0,
      visW,
      visH,
      nw,
      nh,
      effFullW,
      effFullH
    );
    const primaryCached = meissa2dOrthoViewportHiTileCache.has(tileKey);
    if (primaryCached) {
      try {
        if (meissa2dOrthoViewportHiAbort) {
          meissa2dOrthoViewportHiAbort.abort();
        }
      } catch (_) {
        /* ignore */
      }
      meissa2dOrthoViewportHiAbort = null;
      syncMeissa2dOrthoViewportHiLayout();
      meissa2dOrthoViewportHiLastKey = reqKey;
      meissa2dOrthoViewportHi503Streak = 0;
      meissa2dOrthoViewportHiFetchInFlight = false;
      const bw = Math.max(1, Math.round(visW * vpPx));
      const bh = Math.max(1, Math.round(visH * vpPx));
      setMeissa2dOrthoHiBadgeForViewportHi(
        `패치 캐시 ${nComposite}장 · ${Math.round(visW)}×${Math.round(visH)}`,
        "ok",
        badgeCtx
      );
      pushMeissa2dLoadLine(
        `정사 고해상(뷰포트) 캐시(합성 ${nComposite}장) 현재 crop=${cx},${cy} ${cw}×${ch} · 백킹${bw}×${bh} · 네트워크 생략`
      );
      return;
    }

    meissa2dOrthoViewportHiFetchInFlight = true;
    setMeissa2dOrthoHiBadgeForViewportHi("고해상(확대 영역) 불러오는 중…", "load", badgeCtx);
    pushMeissa2dLoadLine(
      `정사 고해상(뷰포트) 요청 crop=${cx},${cy} ${cw}×${ch} · max_edge=${MEISSA_ORTHOPHOTO_VIEWPORT_HI_EDGE} · 원본 ${effFullW}×${effFullH}`
    );

    meissa2dOrthoViewportHiFetchSeq += 1;
    const fetchId = meissa2dOrthoViewportHiFetchSeq;
    if (meissa2dOrthoViewportHiAbort) {
      try {
        meissa2dOrthoViewportHiAbort.abort();
      } catch (_) {
        /* ignore */
      }
    }
    meissa2dOrthoViewportHiAbort = new AbortController();
    const acSignal = meissa2dOrthoViewportHiAbort.signal;

    const rawTok = normalizeMeissaAccessToken(meissaAccess);
    /** @type {Record<string,string>} */
    const fetchHdr = {};
    if (rawTok) fetchHdr.Authorization = `JWT ${rawTok}`;

    try {
      if (fetchId !== meissa2dOrthoViewportHiFetchSeq) return;
      const u = new URL(
        `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/orthophoto-preview`
      );
      u.searchParams.set("project_id", projectId);
      u.searchParams.set("max_edge", String(MEISSA_ORTHOPHOTO_VIEWPORT_HI_EDGE));
      u.searchParams.set("crop_x", String(cx));
      u.searchParams.set("crop_y", String(cy));
      u.searchParams.set("crop_w", String(cw));
      u.searchParams.set("crop_h", String(ch));
      try {
        const tokQ = normalizeMeissaAccessToken(meissaAccess);
        if (tokQ) u.searchParams.set("access_token", tokQ);
      } catch (_) {
        /* ignore */
      }

      const res = await fetch(u.toString(), {
        method: "GET",
        headers: fetchHdr,
        signal: acSignal,
        credentials: "same-origin",
      });
      if (fetchId !== meissa2dOrthoViewportHiFetchSeq) return;
      if (res.status === 503) {
        meissa2dOrthoViewportHi503Streak += 1;
        const delay = Math.min(14000, 500 + meissa2dOrthoViewportHi503Streak * 650);
        clearMeissa2dOrthoViewportHi();
        if (meissa2dOrthoViewportHi503Streak <= 24) {
          setMeissa2dOrthoHiBadgeForViewportHi(
            `고해상 대기: 원본 캐시 생성 중… (${meissa2dOrthoViewportHi503Streak})`,
            "wait",
            badgeCtx
          );
          pushMeissa2dLoadLine(
            `정사 고해상: 서버 원본 캐시 없음(503) · ${meissa2dOrthoViewportHi503Streak}회째 · ${Math.round(delay / 1000)}초 뒤 재시도`
          );
          window.setTimeout(() => scheduleMeissa2dOrthoViewportHiFetch(), delay);
        } else {
          pushMeissa2dLoadLine(
            "정사 고해상: 원본 캐시가 계속 없습니다. 스냅샷을 다시 선택하거나 백엔드를 확인하세요."
          );
          setMeissa2dOrthoHiBadge("고해상 불가 · 원본 캐시 없음", "err");
        }
        return;
      }
      if (!res.ok) {
        pushMeissa2dLoadLine(`정사 고해상 실패 HTTP ${res.status} (fetch)`);
        setMeissa2dOrthoHiBadge(`고해상 실패 HTTP ${res.status}`, "err");
        clearMeissa2dOrthoViewportHi();
        return;
      }
      const metaHdr = parseOrthoCropResponseHeaders(res);
      const blob = await res.blob();
      if (fetchId !== meissa2dOrthoViewportHiFetchSeq) return;
      if (!blob || blob.size < 64) {
        pushMeissa2dLoadLine("정사 고해상: 응답 본문이 비어 있음");
        setMeissa2dOrthoHiBadge("고해상 응답 없음", "err");
        clearMeissa2dOrthoViewportHi();
        return;
      }
      if (metaHdr) {
        meissa2dOrthoFullPxBySnapshot[snapKey] = { w: metaHdr.fullW, h: metaHdr.fullH };
      }
      let im;
      try {
        im = await decodeBlobToImage(blob);
      } catch (_) {
        setMeissa2dOrthoHiBadge("고해상 디코드 실패", "err");
        pushMeissa2dLoadLine("정사 고해상: 패치 이미지 디코드 오류");
        clearMeissa2dOrthoViewportHi();
        return;
      }
      if (fetchId !== meissa2dOrthoViewportHiFetchSeq) return;
      const iw = Math.max(1, im.naturalWidth || im.width);
      const ih = Math.max(1, im.naturalHeight || im.height);
      try {
        viewportOrthoHiTileCacheStore(tileKey, im, metaHdr, { cx, cy, cw, ch });
        paintOrthoViewportHiCompositeCachedTiles(
          cnv,
          ctx,
          vpPx,
          ix0,
          iy0,
          visW,
          visH,
          nw,
          nh,
          effFullW,
          effFullH
        );
      } catch (_) {
        setMeissa2dOrthoHiBadge("고해상 합성 실패", "err");
        clearMeissa2dOrthoViewportHi();
        return;
      }

      meissa2dOrthoViewportHi503Streak = 0;
      meissa2dOrthoViewportHiLastKey = reqKey;
      const bvW = Math.max(1, Math.round(visW * vpPx));
      const bvH = Math.max(1, Math.round(visH * vpPx));
      meissa2dOrthoViewportHiFetchInFlight = false;
      setMeissa2dOrthoHiBadgeForViewportHi(
        `패치 ${Math.round(visW)}×${Math.round(visH)} · ${bvW}×${bvH}px`,
        "ok",
        badgeCtx
      );
      pushMeissa2dLoadLine(
        `정사 고해상(뷰포트) 표시 뷰${Math.round(visW)}×${Math.round(visH)}rpx 백킹${bvW}×${bvH}px(vp×${vpPx.toFixed(2)}) · 디코드 ${iw}×${ih} · 전송 ${(blob.size / (1024 * 1024)).toFixed(2)}MB`
      );
    } catch (e) {
      if (e && e.name === "AbortError") {
        return;
      }
      pushMeissa2dLoadLine(`정사 고해상 예외: ${String(e?.message || e).slice(0, 120)}`);
      setMeissa2dOrthoHiBadge("고해상 요청 오류", "err");
      clearMeissa2dOrthoViewportHi();
    } finally {
      meissa2dOrthoViewportHiFetchInFlight = false;
    }
  }

  function ensureProj4Defs() {
    const p4 = window.proj4;
    if (!p4) return false;
    if (meissaProj4DefsReady) return true;
    try {
      if (!p4.defs("EPSG:5186")) {
        p4.defs(
          "EPSG:5186",
          "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs"
        );
      }
      if (!p4.defs("EPSG:5179")) {
        p4.defs(
          "EPSG:5179",
          "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs"
        );
      }
      if (!p4.defs("EPSG:5188")) {
        p4.defs(
          "EPSG:5188",
          "+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs"
        );
      }
      if (!p4.defs("EPSG:5187")) {
        p4.defs(
          "EPSG:5187",
          "+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs"
        );
      }
      meissaProj4DefsReady = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function tileYByMode(tileYxyz, n, yMode) {
    const mode = String(yMode || "tms").toLowerCase();
    if (mode === "xyz") return tileYxyz;
    // XYZ(상->하) -> TMS(하->상): discrete index 기준 (n-1 - y)
    // 연속 좌표에서도 같은 기준을 써야 1타일 오프셋이 생기지 않는다.
    return (n - 1) - tileYxyz;
  }

  function getGeoConfig(projectId, snapshotId) {
    const pid = String(projectId || "").trim();
    const sid = String(snapshotId || "").trim();
    const key = `${pid}:${sid}`;
    const g = meissa2dGeoConfigBySnapshot[key];
    return g || { crs: "EPSG:5186", yMode: "tms" };
  }

  function normalizeEpsgString(v) {
    const t = String(v || "").trim();
    if (!t) return "";
    const m = t.match(/epsg[:\s/_-]*(\d{4,6})/i);
    if (m) return `EPSG:${m[1]}`;
    if (/^EPSG:\d{4,6}$/i.test(t)) return t.toUpperCase();
    return "";
  }

  /**
   * 정사 georef bbox CRS와 도면(center_x/y) CRS를 맞춘다.
   * Meissa 메타의 crs(예: EPSG:5188)와 타일 추정 getGeoConfig(기본 5186)가 다르면
   * proj4(5186→5188)가 도면 좌표에 잘못 적용되어 수 m 단위로 밀릴 수 있다.
   * 한국 평면 투영(georef에 명시된 경우)은 bbox와 동일 CRS로 도면 좌표를 본다.
   */
  function resolveMeissa2dGeorefCrsPair(geo, projectId, snapshotId) {
    const geoCrs = normalizeEpsgString(geo?.crs || geo?.projection || "");
    const guessed =
      normalizeEpsgString(getGeoConfig(projectId, snapshotId).crs || "") || "EPSG:5186";
    const dstCrs = geoCrs || guessed;
    let srcCrs = guessed;
    if (geoCrs === "EPSG:4326") {
      srcCrs = guessed;
    } else if (geoCrs) {
      const koreanProjected = (c) =>
        /^EPSG:517[89]$/.test(c) || /^EPSG:518[0-9]$/.test(c) || /^EPSG:516[78]$/.test(c);
      if (koreanProjected(geoCrs)) {
        srcCrs = geoCrs;
      }
    }
    return { srcCrs, dstCrs };
  }

  function getDisplayedImageRectInWrap(imgEl, wrapEl) {
    const wrapW = Math.max(1, Number(wrapEl?.clientWidth || 1));
    const wrapH = Math.max(1, Number(wrapEl?.clientHeight || 1));
    const iw = Math.max(1, Number(imgEl?.naturalWidth || 0));
    const ih = Math.max(1, Number(imgEl?.naturalHeight || 0));
    if (iw <= 1 || ih <= 1) {
      return { x: 0, y: 0, w: wrapW, h: wrapH };
    }
    if (imgEl && imgEl.getAttribute("data-meissa-2d-intrinsic-layout") === "1") {
      return { x: 0, y: 0, w: iw, h: ih };
    }
    // styles.css: object-fit: contain
    const k = Math.min(wrapW / iw, wrapH / ih);
    const w = iw * k;
    const h = ih * k;
    const x = (wrapW - w) * 0.5;
    const y = (wrapH - h) * 0.5;
    return { x, y, w, h };
  }

  /**
   * 정사영상 점·배경 정합: 모자이크/타일과 동일한 meissa2dMapViewport 정사각 안에서 object-fit:contain 레터박스를 수식으로 맞춘다.
   * (img.clientRect + offsetLeft 조합은 offsetParent/반올림과 어긋날 수 있음)
   */
  function getMeissa2dOrthoLetterboxInPan(imgEl) {
    const pan = document.getElementById("meissa-2d-panzoom-root");
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    const box = pan || wrap;
    if (MEISSA_2D_SIMPLE_ORTHO && box) {
      return getDisplayedImageRectInWrap(imgEl, box);
    }
    const pw = Math.max(1, Number(pan?.clientWidth || 1));
    const ph = Math.max(1, Number(pan?.clientHeight || 1));
    const mv = meissa2dMapViewport;
    const side = mv.side > 0 ? mv.side : Math.min(pw, ph);
    const offX = mv.side > 0 ? mv.offX : (pw - side) / 2;
    const offY = mv.side > 0 ? mv.offY : (ph - side) / 2;
    if (!imgEl) return { x: offX, y: offY, w: side, h: side };
    const iw = Number(imgEl.naturalWidth || 0);
    const ih = Number(imgEl.naturalHeight || 0);
    if (iw < 2 || ih < 2) return { x: offX, y: offY, w: side, h: side };
    const k = Math.min(side / iw, side / ih);
    const w = iw * k;
    const h = ih * k;
    const x = offX + (side - w) * 0.5;
    const y = offY + (side - h) * 0.5;
    return { x, y, w, h };
  }

  function hasRenderableOverlayImage(imgEl) {
    if (!imgEl) return false;
    if (String(imgEl.style.display || "") === "none") return false;
    const src = String(imgEl.getAttribute("src") || "").trim();
    if (!src) return false;
    if (imgEl.complete) return Number(imgEl.naturalWidth || 0) > 0 && Number(imgEl.naturalHeight || 0) > 0;
    return true;
  }

  /** @returns {string} */
  function getMeissa2dImageDataSource(imgEl) {
    const a = String(imgEl?.getAttribute?.("data-meissa-2d-source") || "").trim();
    if (a) return a;
    const src = String(imgEl?.getAttribute?.("src") || "").trim();
    if (!src) return "";
    try {
      const u = new URL(src, window.location.origin);
      const p = String(u.pathname || "").toLowerCase();
      // 슬리피 타일 경로 (/universal/orthophoto/{z}/{x}/{y}.png)만 타일로 본다.
      if (p.includes("/universal/orthophoto/")) return "carta-tile";
      // export/orthophoto/{filename}.png 는 전체 정사 이미지다(타일 아님).
      if (p.includes("/export/orthophoto/")) return "orthophoto-export";
    } catch (_) {
      const low = src.toLowerCase();
      if (low.includes("/universal/orthophoto/")) return "carta-tile";
      if (low.includes("/export/orthophoto/")) return "orthophoto-export";
    }
    return "";
  }

  /**
   * Meissa georef bbox는 "전체 정사영상" 기준이다. Carta 폴백으로 256px 단일 타일만 올라온 경우
   * 같은 bbox로 정규화하면 좌표·비율이 전부 깨진다 → georef 분기를 쓰지 않는다.
   */
  function useFullGeorefForOverlayImage(imgEl) {
    const s = getMeissa2dImageDataSource(imgEl);
    if (s === "carta-tile") return false;
    if (
      s === "orthophoto-tif" ||
      s === "orthophoto-preview" ||
      s === "raw" ||
      s === "raw-cache" ||
      s === "data-url" ||
      s === "orthophoto-export" ||
      s === "orthophoto-button-url"
    ) {
      return true;
    }
    const iw = Number(imgEl?.naturalWidth || 0);
    const ih = Number(imgEl?.naturalHeight || 0);
    /** 저해상 프리뷰도 전역 bbox letterbox면 georef 매핑 가능. 예전: 512 미만이면 분기 스킵 → 심플 모드에서 점 0개 */
    if (iw >= 32 && ih >= 32) return true;
    return iw > 512 || ih > 512;
  }

  /** Slippy map Web Mercator: 북쪽이 yFraction 작음 (XYZ). */
  function webMercatorFractionalYToLat(yFraction, z) {
    const zi = Math.max(0, Math.floor(Number(z) || 0));
    const n = Math.pow(2, zi);
    const y = Math.max(0, Math.min(n, Number(yFraction) || 0));
    const nPi = Math.PI - (2 * Math.PI * y) / n;
    return (Math.atan(Math.sinh(nPi)) * 180) / Math.PI;
  }

  /**
   * Carta orthophoto URL에 쓰는 정수 타일 인덱스(tx,ty)의 WGS84 경계.
   * ty는 detectGeoConfig에서 쓰는 yMode(TMS/XYZ)와 동일한 인덱스 체계.
   */
  function cartaTileIndexToLonLatBounds(tx, ty, z, yMode) {
    const zi = Math.max(0, Math.floor(Number(z) || 0));
    const n = Math.pow(2, zi);
    const xi = Math.floor(Number(tx) || 0);
    const yi = Math.floor(Number(ty) || 0);
    let yXyz = yi;
    if (String(yMode || "tms").toLowerCase() === "tms") {
      yXyz = n - 1 - yi;
    }
    const minLon = (xi / n) * 360 - 180;
    const maxLon = ((xi + 1) / n) * 360 - 180;
    const maxLat = webMercatorFractionalYToLat(yXyz, zi);
    const minLat = webMercatorFractionalYToLat(yXyz + 1, zi);
    return { minLon, maxLon, minLat, maxLat };
  }

  async function loadMeissa2dGeoref(snapshotId, projectId) {
    const sid = String(snapshotId || "").trim();
    const pid = String(projectId || "").trim();
    if (!sid || !pid || !meissaAccess) return null;
    const key = `${pid}:${sid}`;
    if (meissa2dGeorefBySnapshot[key]) return meissa2dGeorefBySnapshot[key];
    try {
      const data = await meissaJson(`/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-georef`, {
        headers: { Authorization: `JWT ${meissaAccess}` },
      });
      const g = data?.ok && data?.georef && typeof data.georef === "object" ? data.georef : null;
      const rawCrs = normalizeEpsgString(g?.crs || g?.projection || "");
      const bbox = g?.bbox && typeof g.bbox === "object" ? g.bbox : null;
      const bboxObj =
        bbox &&
        Number.isFinite(Number(bbox.minX)) &&
        Number.isFinite(Number(bbox.minY)) &&
        Number.isFinite(Number(bbox.maxX)) &&
        Number.isFinite(Number(bbox.maxY))
          ? {
              minX: Number(bbox.minX),
              minY: Number(bbox.minY),
              maxX: Number(bbox.maxX),
              maxY: Number(bbox.maxY),
            }
          : undefined;
      const inferredLonLat =
        Boolean(
          bboxObj &&
            Math.abs(Number(bboxObj.minX)) <= 180 &&
            Math.abs(Number(bboxObj.maxX)) <= 180 &&
            Math.abs(Number(bboxObj.minY)) <= 90 &&
            Math.abs(Number(bboxObj.maxY)) <= 90
        );
      const crs = rawCrs || (inferredLonLat ? "EPSG:4326" : "");
      const out = {
        crs: crs || undefined,
        bbox: bboxObj,
        width: Number.isFinite(Number(g?.width)) ? Number(g.width) : undefined,
        height: Number.isFinite(Number(g?.height)) ? Number(g.height) : undefined,
      };
      meissa2dGeorefBySnapshot[key] = out;
      // georef가 늦게 도착하면 기존 no-georef/na 캐시가 남아 미판정 고정될 수 있다.
      bumpMeissa2dOrthoRgbFitCache();
      scheduleRenderMeissa2dPointsOverlay();
      scheduleMeissaOrthoOffsetPanelRefresh();
      return out;
    } catch (_) {
      return null;
    }
  }

  function projectFileCoordToLonLat(fileX, fileY, crs) {
    const x = Number(fileX);
    const y = Number(fileY);
    const c = String(crs || "EPSG:5186");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!ensureProj4Defs()) return null;
    try {
      const ll = window.proj4(c, "EPSG:4326", [x, y]);
      const lon = Number(ll?.[0]);
      const lat = Number(ll?.[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat <= -85.0512 || lat >= 85.0512) return null;
      return { lon, lat };
    } catch (_) {
      return null;
    }
  }

  function fileCoordToTileXY(fileX, fileY, z, options) {
    const x = Number(fileX);
    const y = Number(fileY);
    const zi = Math.max(0, Number(z) || 0);
    const opt = options || {};
    const crs = String(opt.crs || "EPSG:5186");
    const yMode = String(opt.yMode || "tms");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const ll = projectFileCoordToLonLat(x, y, crs);
    if (!ll) return null;
    const n = Math.pow(2, zi);
    const tileX = ((ll.lon + 180) / 360) * n;
    const latRad = (ll.lat * Math.PI) / 180;
    const tileYxyz = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const tileY = tileYByMode(tileYxyz, n, yMode);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
    return { x: tileX, y: tileY };
  }

  async function detectGeoConfigForSnapshot(projectId, snapshotId) {
    const pid = String(projectId || "").trim();
    const sid = String(snapshotId || "").trim();
    const key = `${pid}:${sid}`;
    if (!pid || !sid) return getGeoConfig(pid, sid);
    if (meissa2dGeoConfigBySnapshot[key]) return meissa2dGeoConfigBySnapshot[key];
    const focus = getFocusCenterFromFileCoords();
    if (!focus) {
      meissa2dGeoConfigBySnapshot[key] = { crs: "EPSG:5186", yMode: "tms" };
      return meissa2dGeoConfigBySnapshot[key];
    }
    const georef = meissa2dGeorefBySnapshot[key];
    const preferredCrs = normalizeEpsgString(georef?.crs || "");
    const crsPool = [];
    if (preferredCrs) crsPool.push(preferredCrs);
    crsPool.push("EPSG:5186", "EPSG:5179");
    const uniqCrs = [];
    const seenCrs = new Set();
    crsPool.forEach((c) => {
      if (!c || seenCrs.has(c)) return;
      seenCrs.add(c);
      uniqCrs.push(c);
    });
    const cands = [];
    uniqCrs.forEach((c) => {
      cands.push({ crs: c, yMode: "tms" });
      cands.push({ crs: c, yMode: "xyz" });
    });
    let best = cands[0];
    let bestScore = -1;
    for (const c of cands) {
      const t = fileCoordToTileXY(focus.x, focus.y, 20, c);
      if (!t) continue;
      const bx = Math.round(t.x);
      const by = Math.round(t.y);
      const probes = [
        [0, 0],
        [1, 0],
        [0, 1],
      ];
      let score = 0;
      for (const [dx, dy] of probes) {
        const ok = await probeImageUrl(buildMeissaCartaTileUrl(pid, sid, 20, bx + dx, by + dy), 450);
        if (ok) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    meissa2dGeoConfigBySnapshot[key] = best;
    return best;
  }

  function syncCurrentSnapshotAnchorWithFocus(projectId, snapshotId) {
    const pid = String(projectId || "").trim();
    const sid = String(snapshotId || "").trim();
    if (!pid || !sid) return;
    const key = `${pid}:${sid}`;
    const anchor = meissa2dSnapshotAnchors[key];
    const focusNow = getFocusCenterFromFileCoords();
    if (!anchor || !focusNow) return;
    const hint = meissa2dSnapshotTileHints[key];
    if (hint && Number.isFinite(Number(hint.x)) && Number.isFinite(Number(hint.y))) {
      // 스냅샷별 타일 기준점은 고정하고, 파일 기준점만 현재 circles 중심으로 동기화
      anchor.fx = Number(focusNow.x);
      anchor.fy = Number(focusNow.y);
      anchor.tx = Number(hint.x);
      anchor.ty = Number(hint.y);
      anchor.z = Number.isFinite(Number(hint.z)) ? Number(hint.z) : Number(anchor.z || 20);
    }
  }

  function metersPerTileAt(tileY, z) {
    const zi = Math.max(0, Number(z) || 0);
    const n = Math.pow(2, zi);
    const yy = Math.max(0, Math.min(n - 1, Number(tileY) || 0));
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (yy + 0.5)) / n)));
    const metersPerPixel = (156543.03392804097 * Math.cos(latRad)) / n;
    return Math.max(0.01, metersPerPixel * 256);
  }

  function getOverlayWrapSize() {
    const pan = document.getElementById("meissa-2d-panzoom-root");
    const box = pan || document.querySelector(".meissa-2d-overlay-wrap");
    const w = Math.max(1, Number(box?.clientWidth || 1));
    const h = Math.max(1, Number(box?.clientHeight || 1));
    return { w, h };
  }

  /** wrap 테두리 밖 좌표를 쓰면 screenToTile·줌 앵커가 세로/가로로 살짝 어긋난다 */
  function meissa2dOverlayPointerInContent(wrapEl, clientX, clientY) {
    const r = wrapEl.getBoundingClientRect();
    const lx = clientX - r.left - Number(wrapEl.clientLeft || 0);
    const ly = clientY - r.top - Number(wrapEl.clientTop || 0);
    return { x: lx, y: ly };
  }

  /** 모자이크와 정사영상 img를 같은 정사각 프레임에 두어 점·배경 기준을 일치 */
  function syncMeissa2dSquareMapFrameLayout() {
    const { w: pw, h: ph } = getOverlayWrapSize();
    const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
    const img = els.meissaCloud2dImageLocal;
    if (MEISSA_2D_SIMPLE_ORTHO && !MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY) {
      const mapSideSimple = Math.min(pw, ph);
      const mOffXSimple = (pw - mapSideSimple) / 2;
      const mOffYSimple = (ph - mapSideSimple) / 2;
      meissa2dMapViewport = { offX: mOffXSimple, offY: mOffYSimple, side: mapSideSimple };
      if (mosaic) {
        mosaic.style.position = "absolute";
        mosaic.style.inset = "auto";
        mosaic.style.left = `${mOffXSimple}px`;
        mosaic.style.top = `${mOffYSimple}px`;
        mosaic.style.width = `${mapSideSimple}px`;
        mosaic.style.height = `${mapSideSimple}px`;
      }
      if (img) {
        img.style.position = "absolute";
        if (
          img.getAttribute("data-meissa-2d-intrinsic-layout") === "1" &&
          Number(img.naturalWidth || 0) > 1 &&
          Number(img.naturalHeight || 0) > 1
        ) {
          applyMeissa2dIntrinsicImgLayout(img);
        } else {
          img.style.inset = "auto";
          img.style.left = `${mOffXSimple}px`;
          img.style.top = `${mOffYSimple}px`;
          img.style.width = `${mapSideSimple}px`;
          img.style.height = `${mapSideSimple}px`;
        }
      }
      return;
    }
    const mapSide = Math.min(pw, ph);
    const mOffX = (pw - mapSide) / 2;
    const mOffY = (ph - mapSide) / 2;
    meissa2dMapViewport = { offX: mOffX, offY: mOffY, side: mapSide };
    [mosaic, img].forEach((el) => {
      if (!el) return;
      el.style.position = "absolute";
      el.style.inset = "auto";
      el.style.left = `${mOffX}px`;
      el.style.top = `${mOffY}px`;
      el.style.width = `${mapSide}px`;
      el.style.height = `${mapSide}px`;
    });
  }

  function getMeissa2dSquareMapLayout(w, h) {
    const pw = Math.max(1, Number(w) || 1);
    const ph = Math.max(1, Number(h) || 1);
    const mv = meissa2dMapViewport;
    const side = mv.side > 0 ? mv.side : Math.min(pw, ph);
    const offX = mv.side > 0 ? mv.offX : (pw - side) / 2;
    const offY = mv.side > 0 ? mv.offY : (ph - side) / 2;
    return { offX, offY, side };
  }

  function screenToTile(screenX, screenY, tx, ty, scale, ts, w, h) {
    const span = Math.max(1, Number(ts?.radius || 0) * 2 + 1);
    const minTileX = Number(ts.centerX) - Number(ts.radius || 0);
    const maxTileY = Number(ts.centerY) + Number(ts.radius || 0);
    const lx = (Number(screenX) - Number(tx || 0)) / Math.max(1e-9, Number(scale) || 1);
    const ly = (Number(screenY) - Number(ty || 0)) / Math.max(1e-9, Number(scale) || 1);
    const { offX, offY, side } = getMeissa2dSquareMapLayout(w, h);
    const relX = lx - offX;
    const relY = ly - offY;
    const tileX = minTileX + (relX / Math.max(1e-9, side)) * span;
    const tileY = maxTileY - (relY / Math.max(1e-9, side)) * span;
    return { tileX, tileY };
  }

  function tileToLocalPx(tileX, tileY, ts, w, h) {
    const span = Math.max(1, Number(ts?.radius || 0) * 2 + 1);
    const minTileX = Number(ts.centerX) - Number(ts.radius || 0);
    const maxTileY = Number(ts.centerY) + Number(ts.radius || 0);
    const { offX, offY, side } = getMeissa2dSquareMapLayout(w, h);
    const nx = (Number(tileX) - minTileX) / span;
    const ny = (maxTileY - Number(tileY)) / span;
    return { x: offX + nx * side, y: offY + ny * side };
  }

  function buildProjectedAnchorCalibrator(anchor, z) {
    if (!anchor) return null;
    const ax = Number(anchor.fx);
    const ay = Number(anchor.fy);
    const az = Number(anchor.z || 20);
    const atx = Number(anchor.tx);
    const aty = Number(anchor.ty);
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(atx) || !Number.isFinite(aty)) return null;
    const pid =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const g = getGeoConfig(pid, sid);
    const pf = fileCoordToTileXY(ax, ay, z, g);
    if (!pf) return null;
    const eps = 5;
    const px = fileCoordToTileXY(ax + eps, ay, z, g);
    const py = fileCoordToTileXY(ax, ay + eps, z, g);
    if (!px || !py) return null;
    const dtxDx = (Number(px.x) - Number(pf.x)) / eps;
    const dtyDy = (Number(py.y) - Number(pf.y)) / eps;
    const expected = 1 / metersPerTileAt(Number(pf.y), z);
    const sx = expected / Math.max(1e-9, Math.abs(dtxDx));
    const sy = expected / Math.max(1e-9, Math.abs(dtyDy));
    const zFactor = Math.pow(2, z - az);
    const atxNow = atx * zFactor;
    const atyNow = aty * zFactor;
    return {
      pfX: Number(pf.x),
      pfY: Number(pf.y),
      atxNow,
      atyNow,
      sx: Math.max(0.5, Math.min(2.2, sx)),
      sy: Math.max(0.5, Math.min(2.2, sy)),
    };
  }

  function getFileCoordBoundsFromCircles(circles) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let n = 0;
    for (const c of circles || []) {
      const x = Number(c?.center_x);
      const y = Number(c?.center_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n += 1;
    }
    if (n === 0) return null;
    return { minX, maxX, minY, maxY, n };
  }

  /**
   * Meissa/타일 없이 도면 원(center_x, center_y)만으로 2D 뷰어에 배치 확인.
   * 파일 Y가 증가할수록 화면 위쪽(북쪽 느낌)으로 올라가게 매핑한다.
   * @param {{ overlayOnOrtho?: boolean }} [opts] true면 정사 위에 얹음(불투명 배경·격자·미리보기 문구 생략).
   */
  function renderMeissa2dPointsOverlayInFileSpace(ctx, wrapW, wrapH, circles, pixelScale, opts) {
    const onOrtho = Boolean(opts?.overlayOnOrtho);
    const deferHeavyOverlay = Boolean(opts?.deferHeavyOverlay);
    const getOrthoFit = typeof opts?.getOrthoFit === "function" ? opts.getOrthoFit : null;
    const ps = Number(pixelScale) > 0 ? Number(pixelScale) : 1;
    const lw = meissa2dOverlayLineWidthCssPx(ps, 1.15);
    const b = getFileCoordBoundsFromCircles(circles);
    ctx.save();
    if (!onOrtho) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
      ctx.fillRect(0, 0, wrapW, wrapH);
    }
    if (!b) {
      if (!onOrtho) {
        ctx.fillStyle = "#fca5a5";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("도면 원에 유효한 center_x / center_y가 없습니다.", 10, 22);
      }
      ctx.restore();
      return;
    }
    const pad = 0.12;
    const spanX = Math.max(b.maxX - b.minX, 1e-9);
    const spanY = Math.max(b.maxY - b.minY, 1e-9);
    const cx = (b.minX + b.maxX) * 0.5;
    const cy = (b.minY + b.maxY) * 0.5;
    const sx = spanX * (1 + 2 * pad);
    const sy = spanY * (1 + 2 * pad);
    const minXP = cx - sx * 0.5;
    const maxXP = cx + sx * 0.5;
    const minYP = cy - sy * 0.5;
    const maxYP = cy + sy * 0.5;
    const unit = Math.min(wrapW / sx, wrapH / sy);
    const offX = (wrapW - sx * unit) * 0.5;
    const offY = (wrapH - sy * unit) * 0.5;
    const mapX = (x) => offX + (Number(x) - minXP) * unit;
    const mapY = (y) => offY + (maxYP - Number(y)) * unit;
    if (!onOrtho) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("파일 좌표 미리보기 (Meissa 프로젝트·촬영일 선택 전)", 10, 18);
      ctx.fillText(
        `n=${b.n}  X[${b.minX.toFixed(3)} … ${b.maxX.toFixed(3)}]  Y[${b.minY.toFixed(3)} … ${b.maxY.toFixed(3)}]`,
        10,
        34
      );
      ctx.strokeStyle = "rgba(51, 65, 85, 0.85)";
      ctx.lineWidth = lw;
      for (let i = 1; i < 5; i++) {
        const gx = (i / 5) * wrapW;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, wrapH);
        ctx.stroke();
        const gy = (i / 5) * wrapH;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(wrapW, gy);
        ctx.stroke();
      }
    }
    ctx.lineWidth = lw;
    const rawPlF = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
    const clPlF = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
    meissa2dDrawPolylinesMapped(ctx, rawPlF, (fx, fy) => {
      const x = Number(fx);
      const y = Number(fy);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { px: mapX(x), py: mapY(y) };
    }, {
      lineWidth: Math.max(0.35, lw * 0.88),
      strokeStyle: "rgba(148, 163, 184, 0.24)",
      dash: [10, 6],
    });
    meissa2dDrawPolylinesMapped(ctx, clPlF, (fx, fy) => {
      const x = Number(fx);
      const y = Number(fy);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { px: mapX(x), py: mapY(y) };
    }, {
      lineWidth: Math.max(0.45, lw * 1.05),
      strokeStyle: "rgba(186, 230, 253, 0.34)",
      dash: [6, 5],
    });
    for (const c of circles) {
      if (!meissa2dCirclePassesRemainingFilter(c)) continue;
      const x = Number(c?.center_x);
      const y = Number(c?.center_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const px = mapX(x);
      const py = mapY(y);
      const rad = meissa2dPileRadiusFileUnits(c);
      const maxRF = Math.max(wrapW, wrapH) * 0.49;
      let rPx = NaN;
      if (Number.isFinite(rad) && rad > 1e-6) {
        rPx = Math.abs(rad) * unit;
      }
      const fit = meissa2dColorModeValue() === "ortho_pdam" && getOrthoFit ? getOrthoFit(c) : null;
      const paint = meissa2dDotPaintForCircle(c, fit);
      const hasFoot = Number.isFinite(rPx) && rPx >= 0.12 && rPx < maxRF;
      if (hasFoot) {
        meissa2dDrawPileFootprintDisk(ctx, px, py, rPx, maxRF, paint);
      }
      if (Number.isFinite(rad) && rad > 1e-6 && Number.isFinite(rPx)) {
        meissa2dDrawPileFileRadiusDashedCircle(ctx, px, py, rPx, maxRF);
      }
      const dotBaseF = hasFoot ? 1.25 : Math.max(2.4, Math.min(5.2, Math.floor(Math.sqrt(b.n) * 0.35)));
      const dotR = meissa2dOverlayDotRadiusCssPx(dotBaseF) * (paint.dotRScale || 1);
      meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, hasFoot);
      meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, c);
      if (!deferHeavyOverlay) {
        meissa2dPushPickHit(px, py, Math.max(dotR + 6, hasFoot ? rPx * 0.55 : 0), c, fit);
      }
      if (meissaDatasetSelectedIds.has(String(c?.id ?? ""))) {
        meissaDatasetDrawSelectionRing(ctx, px, py, pixelScale, hasFoot, rPx, dotR);
      }
    }
    if (!deferHeavyOverlay) {
      for (const c of circles) {
        if (!meissa2dCirclePassesRemainingFilter(c)) continue;
        const x = Number(c?.center_x);
        const y = Number(c?.center_y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const px = mapX(x);
        const py = mapY(y);
        meissa2dDrawCircleLabel(ctx, px, py, c, circles.length);
      }
    }
    ctx.restore();
  }

  /**
   * 도면 파일 좌표 → 2D 오버레이 캔버스 좌표(팬줌 전, contentCoordsFromMeissaOverlay와 동일 기준).
   * renderMeissa2dPointsOverlay 분기와 동일한 식을 유지할 것.
   */
  function meissa2dComputeFileToContentPx(fx, fy) {
    const fxx = Number(fx);
    const fyy = Number(fy);
    if (!Number.isFinite(fxx) || !Number.isFinite(fyy)) return null;
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return null;
    const pan = document.getElementById("meissa-2d-panzoom-root");
    const sizeBox = pan || wrap;
    const w = Math.max(1, sizeBox.clientWidth);
    const h = Math.max(1, sizeBox.clientHeight);
    const circles = Array.isArray(state.circles) ? state.circles : [];
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const sid =
      (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    if (!projectId || !sid) {
      const b = getFileCoordBoundsFromCircles(circles);
      if (!b) return null;
      const pad = 0.12;
      const spanX = Math.max(b.maxX - b.minX, 1e-9);
      const spanY = Math.max(b.maxY - b.minY, 1e-9);
      const cx0 = (b.minX + b.maxX) * 0.5;
      const cy0 = (b.minY + b.maxY) * 0.5;
      const sx = spanX * (1 + 2 * pad);
      const sy = spanY * (1 + 2 * pad);
      const minXP = cx0 - sx * 0.5;
      const maxXP = cx0 + sx * 0.5;
      const minYP = cy0 - sy * 0.5;
      const maxYP = cy0 + sy * 0.5;
      const unit = Math.min(w / sx, h / sy);
      const offX = (w - sx * unit) * 0.5;
      const offY = (h - sy * unit) * 0.5;
      const px = offX + (fxx - minXP) * unit;
      const py = offY + (maxYP - fyy) * unit;
      return { px, py };
    }
    syncMeissa2dSquareMapFrameLayout();
    const ts = meissa2dTileState;
    const geo = meissa2dGeorefBySnapshot[`${projectId}:${sid}`];
    const imgEl = els.meissaCloud2dImageLocal;
    const imageVisible = hasRenderableOverlayImage(imgEl);
    const hasGeoBbox = Boolean(
      geo &&
        geo.bbox &&
        Number.isFinite(Number(geo.bbox.minX)) &&
        Number.isFinite(Number(geo.bbox.minY)) &&
        Number.isFinite(Number(geo.bbox.maxX)) &&
        Number.isFinite(Number(geo.bbox.maxY)) &&
        Number(geo.bbox.maxX) > Number(geo.bbox.minX) &&
        Number(geo.bbox.maxY) > Number(geo.bbox.minY)
    );
    if (imageVisible && hasGeoBbox && useFullGeorefForOverlayImage(imgEl)) {
      const imgRect = getMeissa2dOrthoLetterboxInPan(imgEl);
      const { srcCrs, dstCrs } = resolveMeissa2dGeorefCrsPair(geo, projectId, sid);
      const minX = Number(geo.bbox.minX);
      const minY = Number(geo.bbox.minY);
      const maxX = Number(geo.bbox.maxX);
      const maxY = Number(geo.bbox.maxY);
      const mapFileToGeorefPx = (ffx, ffy, loose) => {
        const baseX = Number(ffx);
        const baseY = Number(ffy);
        if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) return null;
        const { ox, oy } = meissa2dReadOffsetXY();
        const candidates = [{ wx: baseX + ox, wy: baseY + oy }];
        if (Math.abs(ox) > 1e-9 || Math.abs(oy) > 1e-9) candidates.push({ wx: baseX, wy: baseY });
        for (const cand of candidates) {
          let wx = Number(cand.wx);
          let wy = Number(cand.wy);
          if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;
          if (srcCrs !== dstCrs && ensureProj4Defs()) {
            try {
              const pp = window.proj4(srcCrs, dstCrs, [wx, wy]);
              wx = Number(pp?.[0]);
              wy = Number(pp?.[1]);
            } catch (_) {
              continue;
            }
          }
          const nx = (wx - minX) / Math.max(1e-9, maxX - minX);
          const ny = (maxY - wy) / Math.max(1e-9, maxY - minY);
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
          const px = imgRect.x + nx * imgRect.w;
          const py = imgRect.y + ny * imgRect.h;
          if (!loose) {
            const ax0 = imgRect.x;
            const ay0 = imgRect.y;
            if (
              px < ax0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
              px > ax0 + imgRect.w + MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
              py < ay0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
              py > ay0 + imgRect.h + MEISSA_2D_IMG_EDGE_MARGIN_CSS
            ) {
              continue;
            }
          }
          return { px, py, nx, ny };
        }
        return null;
      };
      const m = mapFileToGeorefPx(fxx, fyy, false);
      return m ? { px: m.px, py: m.py } : null;
    }
    if (MEISSA_2D_SIMPLE_ORTHO && !isMosaicActive()) return null;
    if (imageVisible && getMeissa2dImageDataSource(imgEl) === "carta-tile") {
      const snapKey = `${projectId}:${sid}`;
      const hint = meissa2dSnapshotTileHints[snapKey];
      const g = getGeoConfig(projectId, sid);
      const tz = Number.isFinite(Number(hint?.z)) ? Math.floor(Number(hint.z)) : Number(ts?.z || 20);
      const txi = Number(hint?.x);
      const tyi = Number(hint?.y);
      if (hint && Number.isFinite(txi) && Number.isFinite(tyi) && tz >= 0) {
        const bounds = cartaTileIndexToLonLatBounds(txi, tyi, tz, g.yMode);
        const spanLon = bounds.maxLon - bounds.minLon;
        const spanLat = bounds.maxLat - bounds.minLat;
        if (spanLon > 1e-12 && spanLat > 1e-12) {
          const imgRect = getMeissa2dOrthoLetterboxInPan(imgEl);
          const srcCrsTile = g.crs || "EPSG:5186";
          const mapFileToCartaPx = (ffx, ffy, loose) => {
            const fx0 = Number(ffx);
            const fy0 = Number(ffy);
            if (!Number.isFinite(fx0) || !Number.isFinite(fy0)) return null;
            const ll = projectFileCoordToLonLat(fx0, fy0, srcCrsTile);
            if (!ll) return null;
            const nx = (ll.lon - bounds.minLon) / spanLon;
            const ny = (bounds.maxLat - ll.lat) / spanLat;
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
            const ax0 = imgRect.x;
            const ay0 = imgRect.y;
            const px = ax0 + nx * imgRect.w;
            const py = ay0 + ny * imgRect.h;
            if (!loose) {
              if (
                px < ax0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                px > ax0 + imgRect.w + MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                py < ay0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                py > ay0 + imgRect.h + MEISSA_2D_IMG_EDGE_MARGIN_CSS
              ) {
                return null;
              }
            }
            return { px, py };
          };
          const m = mapFileToCartaPx(fxx, fyy, false);
          return m ? { px: m.px, py: m.py } : null;
        }
      }
    }
    syncCurrentSnapshotAnchorWithFocus(projectId, sid);
    const anchor = meissa2dSnapshotAnchors[`${projectId}:${sid}`];
    const z = Number(ts?.z || 20);
    const calibrator = buildProjectedAnchorCalibrator(anchor, z);
    const calibKey = calibrator
      ? `${Number(calibrator.atxNow).toFixed(3)}|${Number(calibrator.atyNow).toFixed(3)}|${Number(calibrator.sx).toFixed(4)}|${Number(calibrator.sy).toFixed(4)}`
      : "raw";
    const centerX = Number(ts?.centerX);
    const centerY = Number(ts?.centerY);
    const radius = Number(ts?.radius || 0);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radius)) return null;
    const span = radius * 2 + 1;
    const minTileX = centerX - radius;
    const maxTileX = centerX + radius;
    const minTileY = centerY - radius;
    const maxTileY = centerY + radius;
    const mapFileToTileOverlayPx = (ffx, ffy, loose) => {
      const x = Number(ffx);
      const y = Number(ffy);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      let ttx;
      let tty;
      const pKey = `${sid}:${z}:${calibKey}:${x.toFixed(3)}:${y.toFixed(3)}`;
      const cached = meissa2dPointTileCache.get(pKey);
      if (cached) {
        ttx = Number(cached[0]);
        tty = Number(cached[1]);
      } else {
        const g2 = getGeoConfig(projectId, sid);
        const projected = fileCoordToTileXY(x, y, z, g2);
        if (projected) {
          ttx = Number(projected.x);
          tty = Number(projected.y);
          meissa2dPointTileCache.set(pKey, [Number(ttx), Number(tty)]);
        } else if (anchor) {
          const anchorZ = Number(anchor.z || 20);
          const zoomFactor = Math.pow(2, Math.max(-2, Math.min(2, z - anchorZ)));
          const meterToTileAtAnchor = 1 / metersPerTileAt(Number(anchor.ty), anchorZ);
          const dxMeters = x - Number(anchor.fx);
          const dyMeters = y - Number(anchor.fy);
          ttx = Number(anchor.tx) + dxMeters * meterToTileAtAnchor * zoomFactor;
          tty = Number(anchor.ty) - dyMeters * meterToTileAtAnchor * zoomFactor;
        } else {
          return null;
        }
      }
      if (!loose && (ttx < minTileX || ttx > maxTileX || tty < minTileY || tty > maxTileY)) return null;
      const nx = (ttx - minTileX + 0.5) / span;
      const ny = (maxTileY - tty + 0.5) / span;
      const { offX, offY, side } = getMeissa2dSquareMapLayout(w, h);
      const px = offX + nx * side;
      const py = offY + ny * side;
      return { px, py };
    };
    const m0 = mapFileToTileOverlayPx(fxx, fyy, false);
    return m0 ? { px: m0.px, py: m0.py } : null;
  }

  function meissa2dFocusOnFileCoord(fx, fy, options) {
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return;
    const pan = document.getElementById("meissa-2d-panzoom-root");
    const sizeBox = pan || wrap;
    const vw = Math.max(1, sizeBox.clientWidth);
    const vh = Math.max(1, sizeBox.clientHeight);
    const pt = meissa2dComputeFileToContentPx(fx, fy);
    if (!pt || !Number.isFinite(pt.px) || !Number.isFinite(pt.py)) return;
    const cx = vw * 0.5;
    const cy = vh * 0.5;
    let s = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, Number(meissa2dViewScale) || 1);
    if (options?.zoom !== false) {
      const target = Math.max(s, 2.35);
      const cap = isMosaicActive() ? MEISSA_2D_ZOOM_MOSAIC_CSS_MAX : MEISSA_2D_ZOOM_MAX_SCALE;
      s = Math.min(cap, target);
    }
    meissa2dViewScale = s;
    meissa2dViewTx = cx - s * pt.px;
    meissa2dViewTy = cy - s * pt.py;
    applyMeissa2dViewTransform();
  }

  function renderMeissa2dPointsOverlay() {
    const layer = ensureMeissa2dPointsOverlayLayer();
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!layer || !wrap) return;
    const canvas = /** @type {HTMLCanvasElement} */ (layer);
    const pan = document.getElementById("meissa-2d-panzoom-root");
    const sizeBox = pan || wrap;
    let w = Math.max(1, sizeBox.clientWidth);
    let h = Math.max(1, sizeBox.clientHeight);
    let pxScale = meissa2dOverlayPixelScale(w, h);
    const aw = Math.max(1, Math.round(w * pxScale));
    const ah = Math.max(1, Math.round(h * pxScale));
    if (canvas.width !== aw || canvas.height !== ah) {
      canvas.width = aw;
      canvas.height = ah;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    meissa2dClearPickHits();
    meissa2dClearExpiredInboundFocus();
    const circles = Array.isArray(state.circles) ? state.circles : [];
    const overlayWarm =
      Date.now() < meissa2dOverlayWarmUntil && circles.length >= MEISSA_2D_OVERLAY_WARMUP_MIN_CIRCLES;
    const effectiveOverlayWarm = false;
    const renderFitCache = new Map();
    const getOrthoFitForRender = (circle) => {
      if (meissa2dColorModeValue() !== "ortho_pdam") return null;
      const id = String(circle?.id ?? "");
      if (!id) return null;
      if (renderFitCache.has(id)) return renderFitCache.get(id);
      const fit = meissa2dGetOrthoPdamRgbFit(circle, { forceSync: false });
      renderFitCache.set(id, fit);
      return fit;
    };
    if (!circles.length) {
      meissa2dViewportSharpOverlayActive = false;
      meissaOrthoOverlayDoneIds = null;
      meissaOrthoOverlayTargets = 0;
      meissaOrthoOverlayProcessed = 0;
      renderMeissaOrthoAnalyzeDebugPanel();
      return;
    }
    meissaOrthoOverlayTargets = 0;
    meissaOrthoOverlayProcessed = 0;
    if (meissa2dColorModeValue() === "ortho_pdam" && state.pdamByCircleId?.size) {
      meissaOrthoOverlayDoneIds = new Set();
      for (const c of circles) {
        const row = state.pdamByCircleId.get(String(c?.id ?? ""));
        if (isPdamCircleMappingInstalled(row)) meissaOrthoOverlayTargets++;
      }
    } else {
      meissaOrthoOverlayDoneIds = null;
    }
    renderMeissaOrthoAnalyzeDebugPanel();
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const useFilePreviewOnly = !projectId || !sid;
    if (useFilePreviewOnly) {
      meissa2dViewportSharpOverlayActive = false;
      if (meissa2dOverlayMode !== "file") {
        meissa2dOverlayMode = "file";
        setMeissa2dLayerVisibility({ showMosaic: false, showImage: false });
      }
      renderMeissa2dPointsOverlayInFileSpace(ctx, w, h, circles, pxScale, {
        deferHeavyOverlay: overlayWarm,
        getOrthoFit: getOrthoFitForRender,
      });
      return;
    }
    {
      meissa2dViewportSharpOverlayActive = false;
      const vw0 = w;
      const vh0 = h;
      const imgI = els.meissaCloud2dImageLocal;
      const geoI = meissa2dGeorefBySnapshot[`${projectId}:${sid}`];
      const hasGbI = Boolean(
        geoI &&
          geoI.bbox &&
          Number.isFinite(Number(geoI.bbox.minX)) &&
          Number.isFinite(Number(geoI.bbox.minY)) &&
          Number.isFinite(Number(geoI.bbox.maxX)) &&
          Number.isFinite(Number(geoI.bbox.maxY)) &&
          Number(geoI.bbox.maxX) > Number(geoI.bbox.minX) &&
          Number(geoI.bbox.maxY) > Number(geoI.bbox.minY)
      );
      const nwI = Math.round(Number(imgI?.naturalWidth || 0));
      const nhI = Math.round(Number(imgI?.naturalHeight || 0));
      const bigIntrinsic = nwI > 1 && nhI > 1 && nwI * nhI >= 1_200_000;
      const useVpSharp =
        MEISSA_2D_SIMPLE_ORTHO &&
        !isMosaicActive() &&
        imgI &&
        imgI.getAttribute("data-meissa-2d-intrinsic-layout") === "1" &&
        hasRenderableOverlayImage(imgI) &&
        hasGbI &&
        useFullGeorefForOverlayImage(imgI) &&
        bigIntrinsic;

      if (useVpSharp) {
        meissa2dViewportSharpOverlayActive = true;
        const sPan = meissa2dPanzoomScaleSanitized();
        const tx = Number(meissa2dViewTx) || 0;
        const ty = Number(meissa2dViewTy) || 0;
        const ww = vw0;
        const wh = vh0;
        const viewW = Math.max(1, ww / sPan);
        const viewH = Math.max(1, wh / sPan);
        const viewLeft = -tx / sPan;
        const viewTop = -ty / sPan;
        w = viewW;
        h = viewH;
        pxScale = meissa2dOverlayPixelScaleForViewportCanvas(ww, wh, sPan);
        const awI = Math.max(1, Math.round(w * pxScale));
        const ahI = Math.max(1, Math.round(h * pxScale));
        if (canvas.width !== awI || canvas.height !== ahI) {
          canvas.width = awI;
          canvas.height = ahI;
        }
        canvas.style.left = `${viewLeft}px`;
        canvas.style.top = `${viewTop}px`;
        canvas.style.width = `${viewW}px`;
        canvas.style.height = `${viewH}px`;
        canvas.style.maxWidth = "none";
        canvas.style.maxHeight = "none";
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.setTransform(pxScale, 0, 0, pxScale, -viewLeft * pxScale, -viewTop * pxScale);
      } else {
        canvas.style.left = "0px";
        canvas.style.top = "0px";
        if (
          MEISSA_2D_SIMPLE_ORTHO &&
          imgI &&
          imgI.getAttribute("data-meissa-2d-intrinsic-layout") === "1" &&
          hasRenderableOverlayImage(imgI) &&
          hasGbI &&
          useFullGeorefForOverlayImage(imgI) &&
          nwI > 1 &&
          nhI > 1 &&
          (nwI !== vw0 || nhI !== vh0)
        ) {
          w = Math.max(1, nwI);
          h = Math.max(1, nhI);
          pxScale = meissa2dOverlayPixelScale(w, h);
          const awI = Math.max(1, Math.round(w * pxScale));
          const ahI = Math.max(1, Math.round(h * pxScale));
          if (canvas.width !== awI || canvas.height !== ahI) {
            canvas.width = awI;
            canvas.height = ahI;
          }
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
          ctx.clearRect(0, 0, w, h);
        }
      }
    }
    if (meissa2dOverlayMode !== "meissa") {
      meissa2dOverlayMode = "meissa";
    }
    syncMeissa2dSquareMapFrameLayout();
    const ts = meissa2dTileState;
    const geo = meissa2dGeorefBySnapshot[`${projectId}:${sid}`];
    const imgEl = els.meissaCloud2dImageLocal;
    const imageVisible = hasRenderableOverlayImage(imgEl);
    const orthoHasSrc = Boolean(String(imgEl?.getAttribute?.("src") || "").trim());
    const hasGeoBbox =
      Boolean(
        geo &&
          geo.bbox &&
          Number.isFinite(Number(geo.bbox.minX)) &&
          Number.isFinite(Number(geo.bbox.minY)) &&
          Number.isFinite(Number(geo.bbox.maxX)) &&
          Number.isFinite(Number(geo.bbox.maxY)) &&
          Number(geo.bbox.maxX) > Number(geo.bbox.minX) &&
          Number(geo.bbox.maxY) > Number(geo.bbox.minY)
      );
    if (imageVisible && hasGeoBbox && useFullGeorefForOverlayImage(imgEl)) {
      const imgRect = getMeissa2dOrthoLetterboxInPan(imgEl);
      const { srcCrs, dstCrs } = resolveMeissa2dGeorefCrsPair(geo, projectId, sid);
      const minX = Number(geo.bbox.minX);
      const minY = Number(geo.bbox.minY);
      const maxX = Number(geo.bbox.maxX);
      const maxY = Number(geo.bbox.maxY);
      const nowTs = Date.now();
      const shouldLogStats = nowTs - Number(meissa2dDebugLastGeorefStatsTs || 0) > 900;
      let statCount = 0;
      let statOut = 0;
      let statMinNx = Number.POSITIVE_INFINITY;
      let statMaxNx = Number.NEGATIVE_INFINITY;
      let statMinNy = Number.POSITIVE_INFINITY;
      let statMaxNy = Number.NEGATIVE_INFINITY;
      ctx.lineWidth = meissa2dOverlayLineWidthCssPx(pxScale, 1.25);
      const mapFileToGeorefPx = (fx, fy, loose) => {
        const baseX = Number(fx);
        const baseY = Number(fy);
        if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) return null;
        const { ox, oy } = meissa2dReadOffsetXY();
        const candidates = [{ wx: baseX + ox, wy: baseY + oy }];
        if (Math.abs(ox) > 1e-9 || Math.abs(oy) > 1e-9) candidates.push({ wx: baseX, wy: baseY });
        for (const cand of candidates) {
          let wx = Number(cand.wx);
          let wy = Number(cand.wy);
          if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;
          if (srcCrs !== dstCrs && ensureProj4Defs()) {
            try {
              const pp = window.proj4(srcCrs, dstCrs, [wx, wy]);
              wx = Number(pp?.[0]);
              wy = Number(pp?.[1]);
            } catch (_) {
              continue;
            }
          }
          const nx = (wx - minX) / Math.max(1e-9, maxX - minX);
          const ny = (maxY - wy) / Math.max(1e-9, maxY - minY);
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
          const px = imgRect.x + nx * imgRect.w;
          const py = imgRect.y + ny * imgRect.h;
          if (!loose) {
            const ax0 = imgRect.x;
            const ay0 = imgRect.y;
            const clipMargin = loose
              ? MEISSA_2D_IMG_EDGE_MARGIN_CSS_RELAXED
              : MEISSA_2D_IMG_EDGE_MARGIN_CSS;
            if (
              px < ax0 - clipMargin ||
              px > ax0 + imgRect.w + clipMargin ||
              py < ay0 - clipMargin ||
              py > ay0 + imgRect.h + clipMargin
            ) {
              continue;
            }
          }
          return { px, py, nx, ny };
        }
        return null;
      };
      const rawPl = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
      const clPl = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
      meissa2dDrawPolylinesMapped(ctx, rawPl, (fx, fy) => mapFileToGeorefPx(fx, fy, true), {
        lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 0.95),
        strokeStyle: "rgba(148, 163, 184, 0.22)",
        dash: [10, 6],
      });
      meissa2dDrawPolylinesMapped(ctx, clPl, (fx, fy) => mapFileToGeorefPx(fx, fy, true), {
        lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 1.12),
        strokeStyle: "rgba(186, 230, 253, 0.32)",
        dash: [6, 5],
      });
      const sxWorld = imgRect.w / Math.max(1e-9, maxX - minX);
      const syWorld = imgRect.h / Math.max(1e-9, maxY - minY);
      const georefDrawItems = [];
      const georefPointByKey = new Map();
      const georefCircleDrawKey = (c) => {
        const id = String(c?.id ?? "").trim();
        if (id) return `id:${id}`;
        const fx = Number(c?.center_x);
        const fy = Number(c?.center_y);
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) return "";
        return `xy:${fx.toFixed(3)}:${fy.toFixed(3)}`;
      };
      let dbgGeorefDrawn = 0;
      let dbgGeorefFiltered = 0;
      let dbgGeorefNullMap = 0;
      circles.forEach((c) => {
        if (!meissa2dCirclePassesRemainingFilter(c)) return;
        dbgGeorefFiltered += 1;
        const m = mapFileToGeorefPx(c?.center_x, c?.center_y, false);
        if (!m) {
          dbgGeorefNullMap += 1;
          return;
        }
        dbgGeorefDrawn += 1;
        const { px, py, nx, ny } = m;
        if (shouldLogStats) {
          statCount += 1;
          statMinNx = Math.min(statMinNx, nx);
          statMaxNx = Math.max(statMaxNx, nx);
          statMinNy = Math.min(statMinNy, ny);
          statMaxNy = Math.max(statMaxNy, ny);
          if (nx < -0.1 || nx > 1.1 || ny < -0.1 || ny > 1.1) statOut += 1;
        }
        const cx = Number(c?.center_x);
        const cy = Number(c?.center_y);
        const rad = meissa2dPileRadiusFileUnits(c);
        const maxR = Math.max(imgRect.w, imgRect.h) * 0.49;
        let rPx = NaN;
        if (Number.isFinite(rad) && rad > 1e-6) {
          if (srcCrs === dstCrs) {
            // 동일 CRS인 경우 선형 축척으로 반경을 즉시 환산(매 점 3회 map 호출 제거)
            rPx = Math.abs(rad) * (sxWorld + syWorld) * 0.5;
          } else {
            const mapL = (fx, fy) => mapFileToGeorefPx(fx, fy, true);
            rPx = meissa2dPileRadiusPxFromOffsets(mapL, cx, cy, rad);
            if (!Number.isFinite(rPx)) {
              rPx = Math.abs(rad) * (sxWorld + syWorld) * 0.5;
            }
          }
        }
        const fit = getOrthoFitForRender(c);
        const paint = meissa2dDotPaintForCircle(c, fit);
        const hasFoot = Number.isFinite(rPx) && rPx >= 0.12 && rPx < maxR;
        if (hasFoot) {
          meissa2dDrawPileFootprintDisk(ctx, px, py, rPx, maxR, paint);
        }
        if (Number.isFinite(rad) && rad > 1e-6 && Number.isFinite(rPx)) {
          meissa2dDrawPileFileRadiusDashedCircle(ctx, px, py, rPx, maxR);
        }
        const dotBase = hasFoot ? 1.25 : 2.6;
        const dotR = meissa2dOverlayDotRadiusCssPx(dotBase) * (paint.dotRScale || 1);
        meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, hasFoot);
        meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, c);
        if (!effectiveOverlayWarm) {
          meissa2dPushPickHit(px, py, Math.max(dotR + 6, hasFoot ? rPx * 0.55 : 0), c, fit);
        }
        if (meissaDatasetSelectedIds.has(String(c?.id ?? ""))) {
          meissaDatasetDrawSelectionRing(ctx, px, py, pxScale, hasFoot, rPx, dotR);
        }
        const k = georefCircleDrawKey(c);
        if (k) georefPointByKey.set(k, { px, py });
        georefDrawItems.push({ c, px, py });
      });
      if (dbgGeorefFiltered >= 40 && dbgGeorefDrawn <= 1 && dbgGeorefNullMap >= dbgGeorefFiltered * 0.9) {
        // 확대/오프셋 경계 케이스에서 strict 클립이 전량 탈락하면 느슨 매핑으로 한번 더 시도한다.
        circles.forEach((c) => {
          if (!meissa2dCirclePassesRemainingFilter(c)) return;
          const mLoose = mapFileToGeorefPx(c?.center_x, c?.center_y, true);
          if (!mLoose) return;
          const key = georefCircleDrawKey(c);
          if (key && georefPointByKey.has(key)) return;
          const { px, py } = mLoose;
          const fit = getOrthoFitForRender(c);
          const paint = meissa2dDotPaintForCircle(c, fit);
          const dotR = meissa2dOverlayDotRadiusCssPx(2.15) * (paint.dotRScale || 1);
          meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, false);
          meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, c);
          if (!effectiveOverlayWarm) {
            meissa2dPushPickHit(px, py, Math.max(dotR + 8, 12), c, fit);
            meissa2dDrawCircleLabel(ctx, px, py, c, circles.length);
          }
        });
      }
      if (
        meissa2dColorModeValue() === "ortho_pdam" &&
        meissaOrthoPdamDebugLineFromUi() &&
        state.pdamByCircleId?.size &&
        meissa2dHasReadyOrthoAnalysisImage()
      ) {
        ctx.save();
        ctx.lineWidth = meissa2dOverlayLineWidthCssPx(pxScale, 2.05);
        ctx.strokeStyle = "rgba(192, 38, 211, 0.9)";
        ctx.fillStyle = "rgba(6, 182, 212, 0.92)";
        ctx.setLineDash([6, 5]);
        circles.forEach((c) => {
          if (!meissa2dCirclePassesRemainingFilter(c)) return;
          const row = state.pdamByCircleId?.get?.(String(c?.id ?? ""));
          if (!isPdamCircleMappingInstalled(row)) return;
          const fit = getOrthoFitForRender(c);
          if (fit?.reason === "pending" || fit?.tier === "na") return;
          const ndx = fit?.detectDeltaNormX;
          const ndy = fit?.detectDeltaNormY;
          if (ndx == null || ndy == null || !Number.isFinite(Number(ndx)) || !Number.isFinite(Number(ndy))) return;
          const natNow = fileCoordToOrthoNaturalPixel(c?.center_x, c?.center_y);
          if (!natNow || natNow.nw <= 8 || natNow.nh <= 8) return;
          const dnx = natNow.ix + Number(ndx) * natNow.nw;
          const dny = natNow.iy + Number(ndy) * natNow.nh;
          const nwr = Math.max(1e-6, natNow.nw);
          const nhr = Math.max(1e-6, natNow.nh);
          if (dnx < -0.1 * nwr || dnx > nwr * 1.1 || dny < -0.1 * nhr || dny > nhr * 1.1) return;
          const k = georefCircleDrawKey(c);
          const mD = (k && georefPointByKey.get(k)) || mapFileToGeorefPx(c?.center_x, c?.center_y, false);
          if (!mD) return;
          const pxDet = imgRect.x + (dnx / nwr) * imgRect.w;
          const pyDet = imgRect.y + (dny / nhr) * imgRect.h;
          ctx.beginPath();
          ctx.moveTo(mD.px, mD.py);
          ctx.lineTo(pxDet, pyDet);
          ctx.stroke();
          const dotDbg = meissa2dOverlayDotRadiusCssPx(1.15);
          ctx.beginPath();
          ctx.arc(pxDet, pyDet, dotDbg, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (!effectiveOverlayWarm) {
        georefDrawItems.forEach((it) => {
          meissa2dDrawCircleLabel(ctx, it.px, it.py, it.c, circles.length);
        });
      }
      if (shouldLogStats && statCount > 0) {
        const mapNullRatePct = dbgGeorefFiltered > 0 ? (100 * dbgGeorefNullMap) / dbgGeorefFiltered : 0;
        if (mapNullRatePct >= 85) {
          pushMeissa2dLoadLine(
            `정사 georef map 낮은 적중률: drawn ${dbgGeorefDrawn}/${dbgGeorefFiltered} · null ${(mapNullRatePct).toFixed(0)}%`
          );
        }
        meissa2dDebugLastGeorefStatsTs = nowTs;
      }
      return;
    }
    if (MEISSA_2D_SIMPLE_ORTHO && !isMosaicActive()) {
      const overlayOnOrthoEff = imageVisible || orthoHasSrc;
      renderMeissa2dPointsOverlayInFileSpace(ctx, w, h, circles, pxScale, {
        overlayOnOrtho: overlayOnOrthoEff,
        deferHeavyOverlay: overlayWarm,
        getOrthoFit: getOrthoFitForRender,
      });
      ctx.save();
      ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
      ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
      ctx.font = "12px system-ui, sans-serif";
      const hint =
        !imageVisible || !hasGeoBbox
          ? "심플 모드: 정사·georef 없음 → 도면 파일 좌표로만 표시(정사와 어긋날 수 있음)"
          : "심플 모드: 정사 매핑 실패 구간 — 도면 좌표 폴백(정사와 위치 다를 수 있음)";
      ctx.fillText(hint, 8, 22);
      ctx.restore();
      return;
    }
    // Carta 단일 타일(256px) 배경: 전체 ortho bbox가 아니라 "그 타일"의 Web Mercator 범위로만 매핑
    if (imageVisible && getMeissa2dImageDataSource(imgEl) === "carta-tile") {
      const snapKey = `${projectId}:${sid}`;
      const hint = meissa2dSnapshotTileHints[snapKey];
      const g = getGeoConfig(projectId, sid);
      const tz = Number.isFinite(Number(hint?.z)) ? Math.floor(Number(hint.z)) : Number(ts?.z || 20);
      const txi = Number(hint?.x);
      const tyi = Number(hint?.y);
      if (hint && Number.isFinite(txi) && Number.isFinite(tyi) && tz >= 0) {
        const bounds = cartaTileIndexToLonLatBounds(txi, tyi, tz, g.yMode);
        const spanLon = bounds.maxLon - bounds.minLon;
        const spanLat = bounds.maxLat - bounds.minLat;
        if (spanLon > 1e-12 && spanLat > 1e-12) {
          const imgRect = getMeissa2dOrthoLetterboxInPan(imgEl);
          const srcCrsTile = g.crs || "EPSG:5186";
          ctx.lineWidth = meissa2dOverlayLineWidthCssPx(pxScale, 1.25);
          const mapFileToCartaPx = (fx, fy, loose) => {
            const fxx = Number(fx);
            const fyy = Number(fy);
            if (!Number.isFinite(fxx) || !Number.isFinite(fyy)) return null;
            const ll = projectFileCoordToLonLat(fxx, fyy, srcCrsTile);
            if (!ll) return null;
            const nx = (ll.lon - bounds.minLon) / spanLon;
            const ny = (bounds.maxLat - ll.lat) / spanLat;
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
            const ax0 = imgRect.x;
            const ay0 = imgRect.y;
            const px = ax0 + nx * imgRect.w;
            const py = ay0 + ny * imgRect.h;
            if (!loose) {
              if (
                px < ax0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                px > ax0 + imgRect.w + MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                py < ay0 - MEISSA_2D_IMG_EDGE_MARGIN_CSS ||
                py > ay0 + imgRect.h + MEISSA_2D_IMG_EDGE_MARGIN_CSS
              ) {
                return null;
              }
            }
            return { px, py };
          };
          const rawPlC = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
          const clPlC = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
          meissa2dDrawPolylinesMapped(ctx, rawPlC, (fx, fy) => mapFileToCartaPx(fx, fy, true), {
            lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 0.95),
            strokeStyle: "rgba(148, 163, 184, 0.22)",
            dash: [10, 6],
          });
          meissa2dDrawPolylinesMapped(ctx, clPlC, (fx, fy) => mapFileToCartaPx(fx, fy, true), {
            lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 1.12),
            strokeStyle: "rgba(186, 230, 253, 0.32)",
            dash: [6, 5],
          });
          circles.forEach((c) => {
            if (!meissa2dCirclePassesRemainingFilter(c)) return;
            const fx = Number(c?.center_x);
            const fy = Number(c?.center_y);
            if (!Number.isFinite(fx) || !Number.isFinite(fy)) return;
            const m0 = mapFileToCartaPx(fx, fy, false);
            if (!m0) return;
            const { px, py } = m0;
            const rad = meissa2dPileRadiusFileUnits(c);
            const maxRc = Math.max(imgRect.w, imgRect.h) * 0.49;
            const mapLC = (xx, yy) => mapFileToCartaPx(xx, yy, true);
            let rPx = Number.isFinite(rad) && rad > 1e-6
              ? meissa2dPileRadiusPxFromOffsets(mapLC, fx, fy, rad)
              : NaN;
            if (!Number.isFinite(rPx) && Number.isFinite(rad) && rad > 1e-6) {
              const m1 = mapFileToCartaPx(fx + rad, fy, true);
              if (m1) rPx = Math.hypot(m1.px - px, m1.py - py);
            }
            const fit = getOrthoFitForRender(c);
            const paint = meissa2dDotPaintForCircle(c, fit);
            const hasFoot = Number.isFinite(rPx) && rPx >= 0.12 && rPx < maxRc;
            if (hasFoot) {
              meissa2dDrawPileFootprintDisk(ctx, px, py, rPx, maxRc, paint);
            }
            if (Number.isFinite(rad) && rad > 1e-6 && Number.isFinite(rPx)) {
              meissa2dDrawPileFileRadiusDashedCircle(ctx, px, py, rPx, maxRc);
            }
            const dotBaseC = hasFoot ? 1.25 : 2.6;
            const dotR = meissa2dOverlayDotRadiusCssPx(dotBaseC) * (paint.dotRScale || 1);
            meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, hasFoot);
            meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, c);
            if (!effectiveOverlayWarm) {
              meissa2dPushPickHit(px, py, Math.max(dotR + 6, hasFoot ? rPx * 0.55 : 0), c, fit);
            }
          });
          if (!effectiveOverlayWarm) {
            circles.forEach((c) => {
              if (!meissa2dCirclePassesRemainingFilter(c)) return;
              const fx = Number(c?.center_x);
              const fy = Number(c?.center_y);
              if (!Number.isFinite(fx) || !Number.isFinite(fy)) return;
              const m = mapFileToCartaPx(fx, fy, false);
              if (!m) return;
              meissa2dDrawCircleLabel(ctx, m.px, m.py, c, circles.length);
            });
          }
          return;
        }
      }
    }
    syncCurrentSnapshotAnchorWithFocus(projectId, sid);
    const anchor = meissa2dSnapshotAnchors[`${projectId}:${sid}`];
    const z = Number(ts?.z || 20);
    const calibrator = buildProjectedAnchorCalibrator(anchor, z);
    const calibKey = calibrator
      ? `${Number(calibrator.atxNow).toFixed(3)}|${Number(calibrator.atyNow).toFixed(3)}|${Number(calibrator.sx).toFixed(4)}|${Number(calibrator.sy).toFixed(4)}`
      : "raw";
    const centerX = Number(ts?.centerX);
    const centerY = Number(ts?.centerY);
    const radius = Number(ts?.radius || 0);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radius)) return;
    const span = radius * 2 + 1;
    const minTileX = centerX - radius;
    const maxTileX = centerX + radius;
    const minTileY = centerY - radius;
    const maxTileY = centerY + radius;
    ctx.lineWidth = meissa2dOverlayLineWidthCssPx(pxScale, 1.25);
    const mapFileToTileOverlayPx = (fx, fy, loose) => {
      const x = Number(fx);
      const y = Number(fy);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      let tx;
      let ty;
      const pKey = `${sid}:${z}:${calibKey}:${x.toFixed(3)}:${y.toFixed(3)}`;
      const cached = meissa2dPointTileCache.get(pKey);
      if (cached) {
        tx = Number(cached[0]);
        ty = Number(cached[1]);
      } else {
        const g = getGeoConfig(projectId, sid);
        const projected = fileCoordToTileXY(x, y, z, g);
        if (projected) {
          tx = Number(projected.x);
          ty = Number(projected.y);
          meissa2dPointTileCache.set(pKey, [Number(tx), Number(ty)]);
        } else if (anchor) {
          const anchorZ = Number(anchor.z || 20);
          const zoomFactor = Math.pow(2, Math.max(-2, Math.min(2, z - anchorZ)));
          const meterToTileAtAnchor = 1 / metersPerTileAt(Number(anchor.ty), anchorZ);
          const dxMeters = x - Number(anchor.fx);
          const dyMeters = y - Number(anchor.fy);
          tx = Number(anchor.tx) + dxMeters * meterToTileAtAnchor * zoomFactor;
          ty = Number(anchor.ty) - dyMeters * meterToTileAtAnchor * zoomFactor;
        } else {
          return null;
        }
      }
      if (!loose && (tx < minTileX || tx > maxTileX || ty < minTileY || ty > maxTileY)) return null;
      const nx = (tx - minTileX + 0.5) / span;
      const ny = (maxTileY - ty + 0.5) / span;
      const { offX, offY, side } = getMeissa2dSquareMapLayout(w, h);
      const px = offX + nx * side;
      const py = offY + ny * side;
      return { px, py };
    };
    const rawPlT = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
    const clPlT = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
    meissa2dDrawPolylinesMapped(ctx, rawPlT, (fx, fy) => mapFileToTileOverlayPx(fx, fy, true), {
      lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 0.95),
      strokeStyle: "rgba(148, 163, 184, 0.22)",
      dash: [10, 6],
    });
    meissa2dDrawPolylinesMapped(ctx, clPlT, (fx, fy) => mapFileToTileOverlayPx(fx, fy, true), {
      lineWidth: meissa2dOverlayLineWidthCssPx(pxScale, 1.12),
      strokeStyle: "rgba(186, 230, 253, 0.32)",
      dash: [6, 5],
    });
    circles.forEach((c) => {
      if (!meissa2dCirclePassesRemainingFilter(c)) return;
      const x = Number(c?.center_x);
      const y = Number(c?.center_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const m0 = mapFileToTileOverlayPx(x, y, false);
      if (!m0) return;
      const { px, py } = m0;
      const rad = meissa2dPileRadiusFileUnits(c);
      const maxRt = Math.max(w, h) * 0.49;
      const mapLT = (xx, yy) => mapFileToTileOverlayPx(xx, yy, true);
      let rPx = Number.isFinite(rad) && rad > 1e-6
        ? meissa2dPileRadiusPxFromOffsets(mapLT, x, y, rad)
        : NaN;
      if (!Number.isFinite(rPx) && Number.isFinite(rad) && rad > 1e-6) {
        const m1 = mapFileToTileOverlayPx(x + rad, y, true);
        if (m1) rPx = Math.hypot(m1.px - px, m1.py - py);
      }
      const fit = getOrthoFitForRender(c);
      const paint = meissa2dDotPaintForCircle(c, fit);
      const hasFoot = Number.isFinite(rPx) && rPx >= 0.12 && rPx < maxRt;
      if (hasFoot) {
        meissa2dDrawPileFootprintDisk(ctx, px, py, rPx, maxRt, paint);
      }
      if (Number.isFinite(rad) && rad > 1e-6 && Number.isFinite(rPx)) {
        meissa2dDrawPileFileRadiusDashedCircle(ctx, px, py, rPx, maxRt);
      }
      const dotBaseT = hasFoot ? 1.25 : 2.6;
      const dotR = meissa2dOverlayDotRadiusCssPx(dotBaseT) * (paint.dotRScale || 1);
      meissa2dDrawOrthoPileCenter(ctx, px, py, dotR, paint, hasFoot);
      meissa2dMaybeDrawInboundFocusOnCircle(ctx, px, py, dotR, c);
      if (!effectiveOverlayWarm) {
        meissa2dPushPickHit(px, py, Math.max(dotR + 6, hasFoot ? rPx * 0.55 : 0), c, fit);
      }
    });
    if (!effectiveOverlayWarm) {
      circles.forEach((c) => {
        if (!meissa2dCirclePassesRemainingFilter(c)) return;
        const x = Number(c?.center_x);
        const y = Number(c?.center_y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const m = mapFileToTileOverlayPx(x, y, false);
        if (!m) return;
        meissa2dDrawCircleLabel(ctx, m.px, m.py, c, circles.length);
      });
    }
  }

  function scheduleRenderMeissa2dPointsOverlay() {
    if (meissa2dPointsRaf) cancelAnimationFrame(meissa2dPointsRaf);
    meissa2dPointsRaf = requestAnimationFrame(() => {
      meissa2dPointsRaf = 0;
      renderMeissa2dPointsOverlay();
      scheduleRenderMeissaDomOverlay();
      if (meissa2dColorModeValue() === "ortho_pdam" && !meissa2dDragging) {
        const hasAnalysis = meissa2dHasReadyOrthoAnalysisImage();
        scheduleMeissaOrthoOffsetPanelRefresh(hasAnalysis ? 320 : 520);
      }
    });
  }

  function meissaDomOverlayCurrentSnapshotKey() {
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const sid =
      (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    if (!projectId || !sid) return "";
    return `${projectId}:${sid}`;
  }

  function meissaDomOverlayCurrentPreferredHiUrl() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return "";
    const raw = String(meissaDomOverlayHiUrlBySnapshot.get(key) || "").trim();
    if (!raw) return "";
    if (meissaDomOverlayUrlInCooldown(raw)) return "";
    return raw;
  }

  function meissaDomOverlayCurrentFastUrl() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return "";
    const raw = String(meissaDomOverlayFastUrlBySnapshot.get(key) || "").trim();
    if (!raw) return "";
    if (meissaDomOverlayUrlInCooldown(raw)) return "";
    return raw;
  }

  function meissaDomOverlayDesiredHiUrl() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return "";
    const cached = String(meissaDomOverlayHiUrlBySnapshot.get(key) || "").trim();
    return cached;
  }

  function meissaDomOverlayIsHiReadyForCurrent() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return false;
    return Boolean(meissaDomOverlayHiReadyBySnapshot.get(key));
  }

  function meissaDomOverlayMarkHiReadyForCurrent(flag) {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return;
    meissaDomOverlayHiReadyBySnapshot.set(key, Boolean(flag));
  }

  function meissaDomOverlayMarkHiReadyByKey(key, flag) {
    const k = String(key || "").trim();
    if (!k) return;
    meissaDomOverlayHiReadyBySnapshot.set(k, Boolean(flag));
  }

  function meissaDomOverlayBuildFastFirstUrl(ordered) {
    const list = Array.isArray(ordered) ? ordered : [];
    if (!list.length) return "";
    const scored = list
      .map((u) => {
        const s = String(u || "").trim();
        const edge = Math.round(Number(meissa2dOrthoNominalLongEdgeFromImgSrc(s)) || 0);
        const score = Number(_scoreMeissaOrthoButtonUrl(s)) || 0;
        return { s, edge, score };
      })
      .filter((x) => !!x.s && !meissaDomOverlayUrlInCooldown(x.s))
      .sort((a, b) => {
        const aClass = a.edge >= 12000 ? 0 : a.edge >= 7000 ? 1 : 2;
        const bClass = b.edge >= 12000 ? 0 : b.edge >= 7000 ? 1 : 2;
        if (aClass !== bClass) return aClass - bClass;
        if (aClass === 0 && bClass === 0) {
          // 고해상 클래스에서는 너무 큰 파일(25k)보다 12k를 우선해 first paint를 빠르게 만든다.
          const aBias = a.edge >= 24000 ? 1 : 0;
          const bBias = b.edge >= 24000 ? 1 : 0;
          if (aBias !== bBias) return aBias - bBias;
        }
        if (aClass === 1 && bClass === 1) {
          // 중간 클래스는 7k를 우선.
          const ad = Math.abs(a.edge - 7000);
          const bd = Math.abs(b.edge - 7000);
          if (ad !== bd) return ad - bd;
        }
        if (a.edge !== b.edge) return a.edge - b.edge;
        return b.score - a.score;
      });
    return String(scored[0]?.s || "").trim();
  }

  function meissaDomOverlayFastUrl() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return "";
    const fast = String(meissaDomOverlayFastUrlBySnapshot.get(key) || "").trim();
    if (!fast || meissaDomOverlayUrlInCooldown(fast)) return "";
    return fast;
  }

  function meissaDomOverlayUrlInCooldown(url) {
    const s = String(url || "").trim();
    if (!s) return false;
    const until = Number(meissaDomOverlayBadUrlUntil.get(s) || 0);
    if (!(until > Date.now())) {
      if (until > 0) meissaDomOverlayBadUrlUntil.delete(s);
      return false;
    }
    return true;
  }

  function markMeissaDomOverlayUrlFailed(url) {
    const s = String(url || "").trim();
    if (!s) return;
    meissaDomOverlayBadUrlUntil.set(
      s,
      Date.now() + Math.max(20000, Number(MEISSA_DOM_OVERLAY_BAD_URL_COOLDOWN_MS) || 120000)
    );
  }

  function meissaDomOverlayCurrentRequestedFmt() {
    if (!meissaDomOverlayUsesLossyApiPreview()) return "png";
    const f = String(MEISSA_DOM_OVERLAY_PREVIEW_FMT || "webp").toLowerCase();
    return f === "jpeg" || f === "webp" ? f : "webp";
  }

  function meissaDomOverlaySetFormatAttrsOnImage(info) {
    const domImg = els.meissaDomOverlayImage;
    if (!domImg || !info || typeof info !== "object") return;
    const encodedAs = String(info.encodedAs || "").trim().toLowerCase();
    const source = String(info.source || "").trim();
    const requestedFmt = String(info.requestedFmt || "").trim().toLowerCase();
    const convertStatus = String(info.convertStatus || "").trim().toLowerCase();
    if (requestedFmt) domImg.setAttribute("data-ortho-requested-fmt", requestedFmt);
    if (encodedAs) domImg.setAttribute("data-ortho-encoded-as", encodedAs);
    if (source) domImg.setAttribute("data-ortho-source", source);
    if (convertStatus) domImg.setAttribute("data-ortho-convert-status", convertStatus);
  }

  async function meissaDomOverlayProbeFormatHeaders(src) {
    const key = meissaDomOverlayCurrentSnapshotKey();
    const u = String(src || "").trim();
    if (!key || !u) return;
    if (!u.includes("/orthophoto-preview")) {
      const info = {
        url: u,
        requestedFmt: "png",
        encodedAs: "png",
        source: "button-url",
        convertStatus: "none",
        httpStatus: 0,
        probe: "skip-non-preview",
        ts: Date.now(),
      };
      meissaDomOverlayHeaderLogBySnapshot.set(key, info);
      meissaDomOverlaySetFormatAttrsOnImage(info);
      return;
    }
    const prev = meissaDomOverlayHeaderLogBySnapshot.get(key);
    const now = Date.now();
    if (
      prev &&
      String(prev.url || "").trim() === u &&
      now - Number(prev.ts || 0) < MEISSA_DOM_OVERLAY_HEADER_PROBE_MIN_INTERVAL_MS
    ) {
      meissaDomOverlaySetFormatAttrsOnImage(prev);
      return;
    }
    let requestedFmt = meissaDomOverlayCurrentRequestedFmt();
    try {
      const parsed = new URL(u, window.location.href);
      const qFmt = String(parsed.searchParams.get("fmt") || "").trim().toLowerCase();
      if (qFmt === "png" || qFmt === "jpeg" || qFmt === "webp") requestedFmt = qFmt;
    } catch (_) {
      /* ignore */
    }
    let encodedAs = "";
    let source = "";
    let httpStatus = 0;
    let probe = "none";
    let convertStatus = "unknown";
    try {
      let res = await fetch(u, { method: "HEAD", cache: "no-store" });
      if (Number(res.status) === 405 || Number(res.status) === 501) {
        probe = "get-fallback";
        try {
          res = await fetch(u, {
            method: "GET",
            cache: "no-store",
            headers: { Range: "bytes=0-0" },
          });
          try {
            if (res?.body && typeof res.body.cancel === "function") {
              res.body.cancel();
            }
          } catch (_) {
            /* ignore */
          }
        } catch (_) {
          res = null;
        }
      }
      if (!res) throw new Error("probe-response-empty");
      httpStatus = Number(res.status) || 0;
      if (probe !== "get-fallback") probe = "head";
      if (res.ok) {
        encodedAs = String(res.headers.get("X-Ortho-Encoded-As") || "").trim().toLowerCase();
        source = String(res.headers.get("X-Ortho-Source") || "").trim();
        const reqHdr = String(res.headers.get("X-Ortho-Requested-Fmt") || "").trim().toLowerCase();
        if (reqHdr === "png" || reqHdr === "jpeg" || reqHdr === "webp") requestedFmt = reqHdr;
        if (!encodedAs) {
          const ct = String(res.headers.get("Content-Type") || "").toLowerCase();
          if (ct.includes("image/webp")) encodedAs = "webp";
          else if (ct.includes("image/jpeg")) encodedAs = "jpeg";
          else if (ct.includes("image/png")) encodedAs = "png";
        }
      }
    } catch (_) {
      probe = "head-error";
    }
    if (requestedFmt === "jpeg" || requestedFmt === "webp") {
      if (encodedAs === requestedFmt) convertStatus = "ok";
      else if (encodedAs) convertStatus = "mismatch";
    } else if (requestedFmt === "png") {
      if (!encodedAs || encodedAs === "png") convertStatus = "ok";
      else convertStatus = "mismatch";
    }
    const info = {
      url: u,
      requestedFmt: requestedFmt || "unknown",
      encodedAs: encodedAs || "unknown",
      source: source || "unknown",
      convertStatus,
      httpStatus,
      probe,
      ts: now,
    };
    meissaDomOverlayHeaderLogBySnapshot.set(key, info);
    meissaDomOverlaySetFormatAttrsOnImage(info);
    const sig = `${info.requestedFmt}|${info.encodedAs}|${info.convertStatus}|${info.source}|${info.httpStatus}|${u}`;
    if (String(meissaDomOverlayHeaderSigBySnapshot.get(key) || "") !== sig) {
      meissaDomOverlayHeaderSigBySnapshot.set(key, sig);
      pushMeissa2dLoadLine(
        `대체 뷰 포맷검증: req=${info.requestedFmt} · encoded=${info.encodedAs} · convert=${info.convertStatus} · source=${info.source} · HTTP ${info.httpStatus || "?"} (${info.probe})`
      );
    }
  }

  function bindMeissaDomOverlayImageFallback() {
    const domImg = els.meissaDomOverlayImage;
    if (!domImg || domImg.dataset.meissaDomOverlayImgBound === "1") return;
    domImg.dataset.meissaDomOverlayImgBound = "1";
    domImg.addEventListener("error", () => {
      const failed = String(domImg.currentSrc || domImg.getAttribute("src") || "").trim();
      markMeissaDomOverlayUrlFailed(failed);
      const hiNow = meissaDomOverlayCurrentPreferredHiUrl();
      if (failed && hiNow && failed === hiNow) {
        meissaDomOverlayMarkHiReadyForCurrent(false);
      }
      const status = els.meissaDomOverlayStatus;
      if (status) status.textContent = "대체 뷰: 고화질 URL 로드 실패 → 기본 이미지로 전환 중...";
      scheduleRenderMeissaDomOverlay();
    });
    domImg.addEventListener("load", () => {
      const loaded = String(domImg.currentSrc || domImg.getAttribute("src") || "").trim();
      if (loaded) meissaDomOverlayBadUrlUntil.delete(loaded);
      const hiNow = meissaDomOverlayCurrentPreferredHiUrl();
      if (loaded && hiNow && loaded === hiNow) {
        meissaDomOverlayMarkHiReadyForCurrent(true);
      }
      void meissaDomOverlayProbeFormatHeaders(loaded);
      scheduleRenderMeissaDomOverlay();
    });
  }

  function meissaDomOverlayEnsureHiPreload() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key) return;
    const hiUrl = meissaDomOverlayCurrentPreferredHiUrl();
    if (!hiUrl || meissaDomOverlayIsHiReadyForCurrent()) return;
    const inFlight = Number(meissaDomOverlayHiPreloadInFlight.get(key) || 0);
    if (inFlight) return;
    const token = Date.now();
    meissaDomOverlayHiPreloadInFlight.set(key, token);
    const im = new Image();
    im.onload = () => {
      if (Number(meissaDomOverlayHiPreloadInFlight.get(key) || 0) !== token) return;
      meissaDomOverlayHiPreloadInFlight.delete(key);
      meissaDomOverlayHiReadyBySnapshot.set(key, true);
      scheduleRenderMeissaDomOverlay();
    };
    im.onerror = () => {
      if (Number(meissaDomOverlayHiPreloadInFlight.get(key) || 0) !== token) return;
      meissaDomOverlayHiPreloadInFlight.delete(key);
      markMeissaDomOverlayUrlFailed(hiUrl);
      scheduleRenderMeissaDomOverlay();
    };
    try {
      im.decoding = "async";
    } catch (_) {
      /* ignore */
    }
    try {
      im.loading = "eager";
    } catch (_) {
      /* ignore */
    }
    try {
      im.fetchPriority = "high";
    } catch (_) {
      /* ignore */
    }
    im.src = hiUrl;
  }

  async function ensureMeissaDomOverlayHiUrl() {
    const key = meissaDomOverlayCurrentSnapshotKey();
    if (!key || !meissaAccess) return;
    const now = Date.now();
    const cachedHi = String(meissaDomOverlayHiUrlBySnapshot.get(key) || "").trim();
    if (
      cachedHi &&
      !meissaDomOverlayUrlInCooldown(cachedHi) &&
      now - Number(meissaDomOverlayHiLastResolveTs || 0) < MEISSA_DOM_OVERLAY_HI_URL_REFRESH_MS
    ) {
      meissaDomOverlayEnsureHiPreload();
      return;
    }
    if (meissaDomOverlayHiResolveInFlight) return;
    const [projectId, sid] = key.split(":");
    if (!projectId || !sid) return;
    meissaDomOverlayHiResolveInFlight = true;
    meissaDomOverlayHiLastResolveTs = now;
    try {
      const urls = await resolveMeissaOrthoButtonUrls(sid, projectId);
      const ordered = Array.isArray(urls)
        ? urls.map((u) => String(u || "").trim()).filter(Boolean)
        : [];
      if (!ordered.length) return;
      const filtered = ordered.filter((url) => !meissaDomOverlayUrlInCooldown(url));
      const hiBest = String(pickBestMeissaOrthoButtonUrlForSharpness(filtered) || "").trim();
      const fastBest = hiBest;
      if (hiBest) {
        const prev = String(meissaDomOverlayHiUrlBySnapshot.get(key) || "").trim();
        meissaDomOverlayHiUrlBySnapshot.set(key, hiBest);
        if (!prev || prev !== hiBest) {
          meissaDomOverlayHiReadyBySnapshot.set(key, false);
        }
      }
      if (fastBest) {
        meissaDomOverlayFastUrlBySnapshot.set(key, fastBest);
      } else if (hiBest) {
        meissaDomOverlayFastUrlBySnapshot.set(key, hiBest);
      }
      meissaDomOverlayEnsureHiPreload();
    } catch (_) {
      /* ignore */
    } finally {
      meissaDomOverlayHiResolveInFlight = false;
    }
  }

  function syncMeissaDomOverlayImageFromMain() {
    const domImg = els.meissaDomOverlayImage;
    const mainImg = els.meissaCloud2dImageLocal;
    if (!domImg || !mainImg) return false;
    bindMeissaDomOverlayImageFallback();
    const domFmt = String(MEISSA_DOM_OVERLAY_PREVIEW_FMT || "png").toLowerCase();
    const mainSrcEarly = String(mainImg.getAttribute("src") || "").trim();
    let src = "";
    if (domFmt === "jpeg" || domFmt === "webp") {
      const projectId =
        (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
      const sid =
        (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
      if (projectId && sid && meissaAccess) {
        const edge = Math.min(16384, Math.max(1024, Math.round(MEISSA_DOM_OVERLAY_SINGLE_HI_EDGE)));
        src = buildOrthophotoPreviewImgUrl(sid, projectId, meissaAccess, edge, domFmt);
      }
    }
    if (src && meissaDomOverlayUrlInCooldown(src)) {
      src = "";
    }
    if (!src) {
      if (MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE) {
        src = mainSrcEarly;
      } else {
        const hiUrl = meissaDomOverlayCurrentPreferredHiUrl();
        src = hiUrl;
        if (!src) {
          src = mainSrcEarly;
        }
      }
    }
    if (!src) {
      try {
        domImg.removeAttribute("src");
      } catch (_) {
        /* ignore */
      }
      return false;
    }
    if (String(domImg.getAttribute("src") || "").trim() !== src) {
      try {
        domImg.removeAttribute("data-ortho-encoded-as");
        domImg.removeAttribute("data-ortho-source");
        domImg.removeAttribute("data-ortho-requested-fmt");
        domImg.removeAttribute("data-ortho-convert-status");
        domImg.src = src;
      } catch (_) {
        return false;
      }
    }
    void meissaDomOverlayProbeFormatHeaders(src);
    return true;
  }

  function meissaDomOverlayBackgroundEdge() {
    const domImg = els.meissaDomOverlayImage;
    if (!domImg) return 0;
    const srcNow = String(domImg.currentSrc || domImg.getAttribute("src") || "").trim();
    const nowEdge = Math.round(Number(meissa2dOrthoNominalLongEdgeFromImgSrc(srcNow)) || 0);
    if (nowEdge > 0) return nowEdge;
    const nw = Math.round(Number(domImg.naturalWidth || 0));
    const nh = Math.round(Number(domImg.naturalHeight || 0));
    return Math.max(nw, nh, 0);
  }

  function meissaDomOverlayCurrentSourceEdgeHint() {
    const domImg = els.meissaDomOverlayImage;
    const srcNow = String(domImg?.currentSrc || domImg?.src || "").trim();
    const edge = Math.round(Number(meissa2dOrthoNominalLongEdgeFromImgSrc(srcNow)) || 0);
    return edge > 0 ? edge : 0;
  }

  /**
   * 대체 뷰: URL 이미지 + DOM 좌표 오버레이.
   * 기존 캔버스 렌더와 독립적으로 좌표를 얹어, 이미지 로드가 되는 순간 빠르게 가시화한다.
   */
  function renderMeissaDomOverlay() {
    const stage = els.meissaDomOverlayStage;
    const domImg = els.meissaDomOverlayImage;
    const pointsLayer = els.meissaDomOverlayPoints;
    const status = els.meissaDomOverlayStatus;
    const mainImg = els.meissaCloud2dImageLocal;
    if (!stage || !domImg || !pointsLayer || !mainImg) return;
    if (!MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE && !meissaDomOverlayUsesLossyApiPreview()) {
      void ensureMeissaDomOverlayHiUrl();
    }
    const hasMain = hasRenderableOverlayImage(mainImg);
    const synced = syncMeissaDomOverlayImageFromMain();
    if (!hasMain || !synced) {
      pointsLayer.replaceChildren();
      if (status) status.textContent = "대체 뷰: 표시 가능한 URL 이미지가 아직 없습니다.";
      return;
    }
    const domDecoded =
      Number(domImg.naturalWidth || 0) > 1 &&
      Number(domImg.naturalHeight || 0) > 1 &&
      hasRenderableOverlayImage(domImg);
    if (!domDecoded) {
      pointsLayer.replaceChildren();
      if (status) status.textContent = "대체 뷰: 배경 이미지 로드/폴백 대기 중...";
      return;
    }
    if (!MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE && !meissaDomOverlayUsesLossyApiPreview()) {
      const hiResolved = String(meissaDomOverlayCurrentPreferredHiUrl() || "").trim();
      const domSrcNow = String(domImg.currentSrc || domImg.getAttribute("src") || "").trim();
      if (hiResolved && domSrcNow !== hiResolved) {
        try {
          domImg.src = hiResolved;
        } catch (_) {
          /* ignore */
        }
      }
    }
    const domRect = getDisplayedImageRectInWrap(domImg, stage);
    if (!(domRect.w > 2 && domRect.h > 2)) {
      pointsLayer.replaceChildren();
      if (status) status.textContent = "대체 뷰: 이미지 디코드 대기 중...";
      return;
    }
    const mainRect = getMeissa2dOrthoLetterboxInPan(mainImg);
    if (!(mainRect.w > 2 && mainRect.h > 2)) {
      pointsLayer.replaceChildren();
      if (status) status.textContent = "대체 뷰: 좌표 정합 대기 중...";
      return;
    }
    const circles = Array.isArray(state.circles) ? state.circles : [];
    const showLabels = circles.length <= 180 && meissaDomOverlayScale <= 3.2;
    const frag = document.createDocumentFragment();
    let shown = 0;
    const mapMainPxToDom = (mx, my) => {
      const nx = (Number(mx) - mainRect.x) / Math.max(1e-9, mainRect.w);
      const ny = (Number(my) - mainRect.y) / Math.max(1e-9, mainRect.h);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      if (nx < -0.2 || nx > 1.2 || ny < -0.2 || ny > 1.2) return null;
      return { px: domRect.x + nx * domRect.w, py: domRect.y + ny * domRect.h };
    };
    for (const c of circles) {
      if (!meissa2dCirclePassesRemainingFilter(c)) continue;
      const m = meissa2dComputeFileToContentPx(c?.center_x, c?.center_y);
      if (!m || !Number.isFinite(m.px) || !Number.isFinite(m.py)) continue;
      const center = mapMainPxToDom(m.px, m.py);
      if (!center) continue;
      const marker = document.createElement("div");
      marker.className = "meissa-dom-overlay-dot";
      const inv = 1 / Math.max(0.35, meissaDomOverlayScale);
      const sizePx = Math.max(1.8, Math.min(10, 5.2 * inv));
      marker.style.setProperty("--dot-size", `${sizePx}px`);
      marker.style.left = `${center.px}px`;
      marker.style.top = `${center.py}px`;
      marker.title = `ID ${String(c?.id ?? "")} · (${Number(c?.center_x || 0).toFixed(3)}, ${Number(c?.center_y || 0).toFixed(3)})`;
      frag.appendChild(marker);
      if (showLabels) {
        const lb = document.createElement("div");
        lb.className = "meissa-dom-overlay-label";
        lb.style.left = `${center.px}px`;
        lb.style.top = `${center.py}px`;
        const inv = 1 / Math.max(1, meissaDomOverlayScale);
        lb.style.transform = `translate(6px, -10px) scale(${inv.toFixed(3)})`;
        lb.style.transformOrigin = "0 0";
        lb.textContent = String(c?.id ?? "");
        frag.appendChild(lb);
      }
      shown += 1;
    }
    pointsLayer.replaceChildren(frag);
    if (status) {
      const domSrc = String(domImg.currentSrc || domImg.src || "").trim();
      void meissaDomOverlayProbeFormatHeaders(domSrc);
      const edge = meissaDomOverlayCurrentSourceEdgeHint();
      const hiHint = edge > 0 ? `URL 이미지(장변≈${edge}px)` : "URL 이미지";
      let qualityTag = "";
      if (meissaDomOverlayUsesLossyApiPreview()) {
        const f = String(MEISSA_DOM_OVERLAY_PREVIEW_FMT || "jpeg").toUpperCase();
        qualityTag = `API ${f} 응답(단일 고화질 요청)`;
      } else if (MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE) {
        qualityTag = "메인 뷰와 동일 소스(별도 고화질 선해결 없음)";
      } else {
        const hiResolved = String(meissaDomOverlayCurrentPreferredHiUrl() || "").trim();
        qualityTag = hiResolved ? "고화질 URL 직접 표시" : "고화질 URL 준비 중";
      }
      const key = meissaDomOverlayCurrentSnapshotKey();
      const hdr = key ? meissaDomOverlayHeaderLogBySnapshot.get(key) : null;
      const requestedFmt = String(
        domImg.getAttribute("data-ortho-requested-fmt") || hdr?.requestedFmt || "unknown"
      ).trim();
      const encodedAs = String(
        domImg.getAttribute("data-ortho-encoded-as") || hdr?.encodedAs || "unknown"
      ).trim();
      const source = String(domImg.getAttribute("data-ortho-source") || hdr?.source || "unknown").trim();
      const convertStatus = String(
        domImg.getAttribute("data-ortho-convert-status") || hdr?.convertStatus || "unknown"
      ).trim();
      status.textContent =
        `대체 뷰: ${hiHint} · ${qualityTag} · 좌표 ${shown}개 표시` +
        `${showLabels ? " (번호 포함)" : " (번호는 생략 · 점만 표시)"}\n` +
        `포맷로그: req=${requestedFmt || "unknown"} · encoded=${encodedAs || "unknown"} · convert=${convertStatus || "unknown"} · source=${source || "unknown"} · src=${domSrc ? "set" : "empty"}`;
    }
  }

  function scheduleRenderMeissaDomOverlay() {
    if (meissaDomOverlayRaf) cancelAnimationFrame(meissaDomOverlayRaf);
    meissaDomOverlayRaf = requestAnimationFrame(() => {
      meissaDomOverlayRaf = 0;
      renderMeissaDomOverlay();
    });
  }

  function applyMeissaDomOverlayTransform() {
    const img = els.meissaDomOverlayImage;
    const pts = els.meissaDomOverlayPoints;
    const tf = `matrix(${meissaDomOverlayScale},0,0,${meissaDomOverlayScale},${meissaDomOverlayTx},${meissaDomOverlayTy})`;
    if (img) {
      img.style.transformOrigin = "0 0";
      img.style.transform = tf;
    }
    if (pts) {
      pts.style.transformOrigin = "0 0";
      pts.style.transform = tf;
    }
  }

  function resetMeissaDomOverlayTransform() {
    meissaDomOverlayScale = 1;
    meissaDomOverlayTx = 0;
    meissaDomOverlayTy = 0;
    meissaDomOverlayPinchLastDist = 0;
    applyMeissaDomOverlayTransform();
  }

  function bindMeissaDomOverlayInteractions() {
    const stage = els.meissaDomOverlayStage;
    if (!stage || stage.dataset.meissaDomOverlayBound === "1") return;
    stage.dataset.meissaDomOverlayBound = "1";
    stage.style.touchAction = "none";
    stage.style.cursor = "grab";

    const pointerInStage = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const zoomAt = (nextScale, sx, sy) => {
      const prev = meissaDomOverlayScale;
      const n = Math.max(0.35, Math.min(12, Number(nextScale) || 1));
      if (Math.abs(n - prev) < 1e-8) return;
      const k = n / prev;
      meissaDomOverlayTx = sx - (sx - meissaDomOverlayTx) * k;
      meissaDomOverlayTy = sy - (sy - meissaDomOverlayTy) * k;
      meissaDomOverlayScale = n;
      applyMeissaDomOverlayTransform();
      scheduleRenderMeissaDomOverlay();
    };

    stage.addEventListener(
      "wheel",
      (evt) => {
        evt.preventDefault();
        const p = pointerInStage(evt.clientX, evt.clientY);
        const next = meissaDomOverlayScale * Math.exp(-evt.deltaY * 0.0012);
        zoomAt(next, p.x, p.y);
      },
      { passive: false }
    );

    stage.addEventListener("pointerdown", (evt) => {
      meissaDomOverlayPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      try {
        stage.setPointerCapture(evt.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (meissaDomOverlayPointers.size === 1) {
        stage.style.cursor = "grabbing";
        stage.classList.add("is-panning");
      } else if (meissaDomOverlayPointers.size >= 2) {
        const pts = [...meissaDomOverlayPointers.values()];
        meissaDomOverlayPinchLastDist = Math.max(
          1,
          Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        );
      }
      evt.preventDefault();
    });

    stage.addEventListener("pointermove", (evt) => {
      if (!meissaDomOverlayPointers.has(evt.pointerId)) return;
      const prev = meissaDomOverlayPointers.get(evt.pointerId);
      meissaDomOverlayPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      if (meissaDomOverlayPointers.size >= 2) {
        const pts = [...meissaDomOverlayPointers.values()];
        const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        const ratio = dist / Math.max(1, meissaDomOverlayPinchLastDist || dist);
        meissaDomOverlayPinchLastDist = dist;
        const mid = pointerInStage((pts[0].x + pts[1].x) * 0.5, (pts[0].y + pts[1].y) * 0.5);
        zoomAt(meissaDomOverlayScale * ratio, mid.x, mid.y);
      } else if (meissaDomOverlayPointers.size === 1 && prev) {
        meissaDomOverlayTx += evt.clientX - prev.x;
        meissaDomOverlayTy += evt.clientY - prev.y;
        applyMeissaDomOverlayTransform();
        scheduleRenderMeissaDomOverlay();
      }
      evt.preventDefault();
    });

    const onPointerUp = (evt) => {
      if (meissaDomOverlayPointers.has(evt.pointerId)) {
        meissaDomOverlayPointers.delete(evt.pointerId);
      }
      try {
        stage.releasePointerCapture(evt.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (meissaDomOverlayPointers.size < 2) meissaDomOverlayPinchLastDist = 0;
      if (meissaDomOverlayPointers.size === 0) {
        stage.style.cursor = "grab";
        stage.classList.remove("is-panning");
      }
    };
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("pointerleave", onPointerUp);

    stage.addEventListener("dblclick", () => {
      resetMeissaDomOverlayTransform();
    });
  }

  let meissaOrthoPanelTimer = 0;

  function meissaOrthoOffsetTierSortKey(tier) {
    if (tier === "red") return 0;
    if (tier === "orange") return 1;
    if (tier === "yellow") return 2;
    if (tier === "ok") return 3;
    return 4;
  }

  function meissaOrthoOffsetTierLabelKo(tier) {
    if (tier === "red") return "심각";
    if (tier === "orange") return "경고";
    if (tier === "yellow") return "주의";
    if (tier === "ok") return "양호";
    return "미판정";
  }

  /** 정사·도면 오프셋 표 행 배경(data-meissa-ortho-paint) — 2D 점 색과 동일 체계 */
  function meissaOrthoOffsetRowPaintKey(fit) {
    if (!fit) return "na";
    if (fit.reason === "pending") return "pending";
    if (fit.tier === "na") return "na";
    if (
      fit.pileCapped === true &&
      (fit.tier === "ok" || fit.tier === "yellow" || fit.tier === "orange")
    ) {
      return "capped";
    }
    const t = fit.tier;
    if (t === "red" || t === "orange" || t === "yellow" || t === "ok") return t;
    return "na";
  }

  function meissaOrthoOffsetFilterAllows(tier) {
    const id =
      tier === "red"
        ? "meissa-ortho-filter-red"
        : tier === "orange"
          ? "meissa-ortho-filter-orange"
          : tier === "yellow"
            ? "meissa-ortho-filter-yellow"
            : tier === "ok"
              ? "meissa-ortho-filter-ok"
              : "meissa-ortho-filter-na";
    const el = document.getElementById(id);
    if (!el) return true;
    return Boolean(el.checked);
  }

  function renderMeissaOrthoOffsetPanel() {
    meissa2dEnsureOrthoAnalysisImage();
    const wrap = document.getElementById("meissa-ortho-offset-wrap");
    const tbody = document.getElementById("meissa-ortho-offset-body");
    if (!wrap || !tbody) return;
    const mapHint = document.getElementById("meissa-ortho-offset-mapmode-hint");
    if (mapHint) mapHint.hidden = meissa2dColorModeValue() === "ortho_pdam";
    const circlesRaw = Array.isArray(state.circles) ? state.circles : [];
    const circles =
      meissa2dColorModeValue() === "ortho_pdam"
        ? meissa2dDedupCirclesForOrthoPdam(circlesRaw)
        : circlesRaw;
    const rows = [];
    let pendingCount = 0;
    let anyInstalled = false;
    circles.forEach((c) => {
      const prow = state.pdamByCircleId?.get?.(String(c?.id ?? ""));
      if (!isPdamCircleMappingInstalled(prow)) return;
      anyInstalled = true;
      const fit = meissa2dGetOrthoPdamRgbFit(c, { forceSync: false });
      if (fit?.reason === "pending") pendingCount++;
      const rec = state.meissaCompareByCircleId?.get?.(String(c?.id ?? ""));
      const label = String(c?.matched_text?.text ?? "").trim() || "—";
      const fx = Number(c?.center_x);
      const fy = Number(c?.center_y);
      rows.push({
        circle: c,
        fit,
        rec,
        label,
        fx,
        fy,
        sortKey: meissaOrthoOffsetTierSortKey(fit.tier),
        offsetM: fit.offsetM,
        planD: rec?.planD != null ? Number(rec.planD) : null,
      });
    });
    if (!anyInstalled) {
      tbody.textContent = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "meissa-note";
      td.style.padding = "0.5rem 0.35rem";
      td.textContent =
        "PDAM에서 시공으로 매핑된 말뚝이 없으면 행이 비어 있습니다. 시공 말뚝이 있으면 정사 RGB 추정 오프셋·등급이 표에 채워집니다. 위 색 범례는 맵 점·표 행에 공통입니다.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      wrap.hidden = false;
      return;
    }
    rows.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      const ao = Number.isFinite(a.offsetM) ? a.offsetM : -1;
      const bo = Number.isFinite(b.offsetM) ? b.offsetM : -1;
      return bo - ao;
    });
    tbody.textContent = "";
    rows.forEach((r) => {
      if (!meissaOrthoOffsetFilterAllows(r.fit.tier)) return;
      const tr = document.createElement("tr");
      tr.className = "meissa-ortho-offset-row";
      tr.dataset.meissaCircleId = String(r.circle?.id ?? "");
      tr.dataset.fileX = Number.isFinite(r.fx) ? String(r.fx) : "";
      tr.dataset.fileY = Number.isFinite(r.fy) ? String(r.fy) : "";
      tr.dataset.meissaOrthoTier = r.fit.tier;
      tr.dataset.meissaOrthoPaint = meissaOrthoOffsetRowPaintKey(r.fit);
      const td0 = document.createElement("td");
      td0.textContent = meissaOrthoOffsetTierLabelKo(r.fit.tier);
      const td1 = document.createElement("td");
      td1.textContent = r.label;
      const td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent =
        r.fit.offsetM != null && Number.isFinite(r.fit.offsetM)
          ? `${meissaOrthoFormatOffsetM(r.fit.offsetM)}${
              r.fit.patchDistDesignPx != null && Number.isFinite(r.fit.patchDistDesignPx)
                ? ` (${r.fit.patchDistDesignPx.toFixed(1)}px)`
                : ""
            }`
          : "—";
      const td3 = document.createElement("td");
      td3.className = "num";
      td3.textContent = r.planD != null && Number.isFinite(r.planD) ? r.planD.toFixed(3) : "—";
      const td4 = document.createElement("td");
      td4.className = "meissa-note";
      td4.style.fontSize = "0.78rem";
      const bits = [];
      if (r.fit.delta != null && Number.isFinite(r.fit.delta)) bits.push(`명암차 ${r.fit.delta.toFixed(0)}`);
      const dmk = meissaOrthoDetectModeLabelKo(r.fit.detectMode);
      if (dmk) bits.push(dmk);
      if (r.fit.reason) bits.push(String(r.fit.reason));
      if (r.fit.offsetEstimateFallback) bits.push("m 대략(가정)");
      const fp = r.fit.footprintOverlap;
      if (fp && Number.isFinite(fp.darkLumPct)) {
        bits.push(
          `일식 암포획${fp.darkMoonLumPct.toFixed(0)}% RGB${fp.darkMoonRgbPct.toFixed(0)}% 림${fp.rimMoonPct.toFixed(0)}% √${fp.eclipseHarmonyPct.toFixed(0)}%`
        );
        bits.push(`원내 암${fp.darkLumPct.toFixed(0)}% 밝${fp.brightLumPct.toFixed(0)}%`);
      }
      td4.textContent = bits.join(" · ") || "—";
      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      tbody.appendChild(tr);
    });
    wrap.hidden = false;
    if (pendingCount > 0 && !meissa2dDragging) {
      scheduleMeissaOrthoOffsetPanelRefresh(120);
    }
  }

  function scheduleMeissaOrthoOffsetPanelRefresh(delayMs) {
    if (meissaOrthoPanelTimer) return;
    const wait = Math.max(90, Number(delayMs) || 320);
    meissaOrthoPanelTimer = window.setTimeout(() => {
      meissaOrthoPanelTimer = 0;
      renderMeissaOrthoOffsetPanel();
    }, wait);
  }

  /** 휠/핀치 연속 입력 중에는 transform만 갱신하고, 멈춘 뒤 1회 정밀 렌더/패치 요청 */
  function scheduleMeissa2dViewSettleRefresh(delayMs) {
    const wait = Math.max(36, Number(delayMs) || 96);
    if (meissa2dViewSettleTimer) {
      try {
        window.clearTimeout(meissa2dViewSettleTimer);
      } catch (_) {
        /* ignore */
      }
    }
    meissa2dViewSettleTimer = window.setTimeout(() => {
      meissa2dViewSettleTimer = 0;
      if (meissa2dDragging) return;
      applyMeissa2dViewTransform();
    }, wait);
  }

  function bindMeissaOrthoOffsetPanel() {
    const tbody = document.getElementById("meissa-ortho-offset-body");
    if (!tbody || tbody.dataset.meissaOrthoBound === "1") return;
    tbody.dataset.meissaOrthoBound = "1";
    tbody.addEventListener("click", (ev) => {
      const tr = ev.target?.closest?.("tr.meissa-ortho-offset-row");
      if (!tr) return;
      const cid = tr.dataset.meissaCircleId || "";
      if (cid) meissaInboundFocus = { circleId: cid, until: Date.now() + 16000 };
      const fx = parseFloat(tr.dataset.fileX || "");
      const fy = parseFloat(tr.dataset.fileY || "");
      if (Number.isFinite(fx) && Number.isFinite(fy)) meissa2dFocusOnFileCoord(fx, fy, {});
      else scheduleRenderMeissa2dPointsOverlay();
    });
    ["meissa-ortho-filter-red", "meissa-ortho-filter-orange", "meissa-ortho-filter-yellow", "meissa-ortho-filter-ok", "meissa-ortho-filter-na"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => renderMeissaOrthoOffsetPanel());
    });
  }

  function onMeissa2dOverlayImgDecoded() {
    meissa2dOrthoInteractReady = true;
    void meissa2dPrimeAnalysisImageFromDisplayedSrc("overlay-decoded");
    bumpMeissa2dOrthoRgbFitCache();
    if (MEISSA_2D_SIMPLE_ORTHO) {
      syncMeissa2dSquareMapFrameLayout();
      const img = els.meissaCloud2dImageLocal;
      /** intrinsic 이미 켜진 뒤 디코드면 전체 맞춤(fit) 호출 시 뷰가 리셋됨 — 레이아웃만 동기화 */
      if (img && img.getAttribute("data-meissa-2d-intrinsic-layout") !== "1") {
        fitMeissa2dSimpleOrthoIntrinsicView();
      }
    }
    scheduleRenderMeissa2dPointsOverlay();
  }

  function renderMeissa2dMosaic(snapshotId, options) {
    if (MEISSA_2D_SIMPLE_ORTHO && !MEISSA_2D_SIMPLE_TILE_FIRST_MODE) return false;
    const sid = String(snapshotId || "").trim();
    if (!sid) return false;
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    if (!projectId) return false;
    const layer = ensureMeissa2dMosaicLayer();
    if (!layer) return false;
    const z = Number(options?.z) || 20;
    const requestedRadius = Math.max(0, Number(options?.radius) || 1);
    const prevSameSnapshot =
      String(meissa2dTileState.snapshotId || "") === sid &&
      String(meissa2dTileState.projectId || "") === String(projectId) &&
      Number(meissa2dTileState.z || 0) === z;
    // 확대/이동 중 주변이 사라지는 느낌을 줄이기 위해 반경은 같은 스냅샷+z에서는 줄이지 않는다.
    const radius = prevSameSnapshot
      ? Math.max(Number(meissa2dTileState.radius || 0), requestedRadius)
      : requestedRadius;
    let cx =
      Number.isFinite(Number(options?.centerX)) ? Number(options.centerX) : Number(meissa2dFallbackTileCenter?.x);
    let cy =
      Number.isFinite(Number(options?.centerY)) ? Number(options.centerY) : Number(meissa2dFallbackTileCenter?.y);
    if (Number.isFinite(cx) && Number.isFinite(cy) && cx < 400000 && z >= 20) {
      cx = Math.round(cx * 4);
      cy = Math.round(cy * 4);
    }
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      cx = 894340;
      cy = 641297;
    }
    const span = radius * 2 + 1;
    syncMeissa2dSquareMapFrameLayout();
    layer.style.gridTemplateColumns = `repeat(${span}, 1fr)`;
    const nextChildren = [];
    for (let dy = radius; dy >= -radius; dy--) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = Math.round(cx + dx);
        const ty = Math.round(cy + dy);
        const tileKey = `${projectId}:${sid}:${z}:${tx}:${ty}`;
        let im = meissa2dTileElementCache.get(tileKey);
        if (!im) {
          im = document.createElement("img");
          im.className = "meissa-cloud-2d-mosaic-tile";
          im.loading = "eager";
          im.decoding = "async";
          im.alt = "";
          im.style.visibility = "hidden";
          im.onload = () => {
            im.style.visibility = "visible";
          };
          im.onerror = () => {
            // 깨진 이미지 아이콘이 보이지 않도록 숨김
            im.style.visibility = "hidden";
          };
          // 타일 캐시를 살려 이동/재렌더 시 재다운로드를 줄임
          im.src = buildMeissaCartaTileUrl(projectId, sid, z, tx, ty);
          meissa2dTileElementCache.set(tileKey, im);
        }
        nextChildren.push(im);
      }
    }
    layer.replaceChildren(...nextChildren);
    // 메모리 상한 방지(최근 타일은 유지)
    if (meissa2dTileElementCache.size > 5000) {
      const keep = new Set(nextChildren);
      for (const [k, v] of meissa2dTileElementCache.entries()) {
        if (keep.has(v)) continue;
        meissa2dTileElementCache.delete(k);
        if (meissa2dTileElementCache.size <= 3500) break;
      }
    }
    layer.hidden = false;
    meissa2dTileState = {
      snapshotId: sid,
      projectId: String(projectId),
      z,
      centerX: cx,
      centerY: cy,
      radius,
    };
    renderMeissa2dPointsOverlay();
    return true;
  }

  function setMeissa2dLayerVisibility(opts) {
    const o = { ...(opts || {}) };
    if (MEISSA_2D_SIMPLE_ORTHO && !MEISSA_2D_SIMPLE_TILE_FIRST_MODE) o.showMosaic = false;
    const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
    const img = els.meissaCloud2dImageLocal;
    if (mosaic) mosaic.hidden = !o.showMosaic;
    if (img) {
      img.style.display = o.showImage ? "block" : "none";
    }
    scheduleRenderMeissa2dPointsOverlay();
  }

  function isMosaicActive() {
    const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
    return Boolean(mosaic && mosaic.hidden !== true);
  }

  function applyMeissa2dViewTransform(options) {
    let redrawOverlay = options?.redrawOverlay !== false;
    // matrix(a,b,c,d,e,f): x' = a*x + c*y + e, y' = b*x + d*y + f
    const tf = `matrix(${meissa2dViewScale},0,0,${meissa2dViewScale},${meissa2dViewTx},${meissa2dViewTy})`;
    const pan = document.getElementById("meissa-2d-panzoom-root");
    if (pan) {
      pan.style.transform = tf;
      pan.style.willChange = MEISSA_2D_SIMPLE_ORTHO ? "auto" : "transform";
      const img = els.meissaCloud2dImageLocal;
      if (img) img.style.transform = "";
      const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
      if (mosaic) mosaic.style.transform = "";
      const points = document.getElementById("meissa-cloud-2d-points-overlay");
      if (points) points.style.transform = "";
      const orthoHi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (orthoHi) orthoHi.style.transform = "";
    } else {
      const img = els.meissaCloud2dImageLocal;
      if (img) img.style.transform = tf;
      const mosaic = document.getElementById("meissa-cloud-2d-mosaic-local");
      if (mosaic) mosaic.style.transform = tf;
      const points = document.getElementById("meissa-cloud-2d-points-overlay");
      if (points) points.style.transform = tf;
      const orthoHi = document.getElementById("meissa-cloud-2d-ortho-viewport-hi");
      if (orthoHi) orthoHi.style.transform = tf;
    }
    if (redrawOverlay) scheduleRenderMeissa2dPointsOverlay();
    if (MEISSA_2D_SIMPLE_ORTHO) {
      if (redrawOverlay) {
        tryMeissa2dOrthoViewportHiPaintCachedSync();
        syncMeissa2dOrthoViewportHiLayout();
        scheduleMeissa2dOrthoViewportHiFetch();
      } else {
        // 드래그 중에는 transform만 갱신하고 고해상 패치 재계산/요청은 멈춰 체감 버벅임을 줄인다.
        syncMeissa2dOrthoViewportHiLayout();
        if (isMeissa2dButtonUrlOnlySingleMode()) {
          scheduleMeissa2dOrthoViewportHiFromMainImageLocal();
        }
      }
    }
  }

  function computeMosaicRadiusForScale(scale) {
    const { w, h } = getOverlayWrapSize();
    const side = Math.min(Math.max(1, w), Math.max(1, h));
    const s = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, Number(scale) || 1);
    // CSS scale↑ → 로컬에서 보이는 영역은 1/s로 줄어듦 → 같은 화면을 채우려면 타일 격자 반경을 키워야 함
    // (기존: tilePx=256*s 로 need가 s와 반비례해 확대 시 타일이 부족했음)
    const minCells = Math.ceil(5 * s);
    const fromSide = Math.ceil((side * s) / 200);
    const cells = Math.max(minCells, fromSide, 9);
    let r = Math.floor((cells - 1) / 2) + 3;
    const zoomBoost = 1 + 0.12 * Math.max(0, s - 1);
    r = Math.ceil(r * zoomBoost);
    return Math.max(8, Math.min(45, r));
  }

  function desiredTileZoomFromScale(scale, currentZ) {
    const s = Math.max(0.2, Number(scale) || 1);
    const z = Number(currentZ) || 20;
    // 히스테리시스: 경계 근처에서 z 단계가 튀지 않게 한다.
    if (z === 23) {
      if (s < 2.7) return 22;
      return 23;
    }
    if (z === 22) {
      if (s < 2.7) return 21;
      if (s >= 3.8) return 23;
      return 22;
    }
    if (z === 21) {
      if (s < 0.85) return 20;
      if (s >= 3.8) return 22;
      return 21;
    }
    if (s >= 4.2) return 23;
    if (s >= 1.9) return 21;
    return 20;
  }

  function resetMeissa2dViewTransform() {
    if (MEISSA_2D_SIMPLE_ORTHO && !MEISSA_2D_SIMPLE_TILE_FIRST_MODE) {
      return;
    }
    meissa2dViewScale = 1;
    meissa2dViewTx = 0;
    meissa2dViewTy = 0;
    applyMeissa2dViewTransform();
  }

  function scheduleMeissa2dRecenterRefresh(allowPanShift, allowZoomStep) {
    if (MEISSA_2D_SIMPLE_ORTHO && !MEISSA_2D_SIMPLE_TILE_FIRST_MODE) return;
    if (meissa2dRecenterTimer) window.clearTimeout(meissa2dRecenterTimer);
    const delay = allowPanShift ? 40 : meissa2dViewScale >= 1.7 ? 120 : 180;
    meissa2dRecenterTimer = window.setTimeout(() => {
      const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
      if (!sid || String(meissa2dTileState.snapshotId) !== sid) return;
      // 큰 원본(raw) 이미지가 있으면 타일 재중심 로직을 끈다(줌/팬 튐 완화).
      if (meissa2dRawUrlBySnapshot.has(sid)) {
        return;
      }
      const imgRecenter = els.meissaCloud2dImageLocal;
      if (!isMosaicActive() && hasRenderableOverlayImage(imgRecenter)) {
        // 정지 배경(raw/carta/data-url)만 켜진 상태: 휠로 타일 z/중심을 바꾸면 CSS 줌과 어긋남
        return;
      }
      let scale = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, meissa2dViewScale);
      let centerX = Number(meissa2dTileState.centerX);
      let centerY = Number(meissa2dTileState.centerY);
      let z = Number(meissa2dTileState.z || 20);
      const zState0 = Number(meissa2dTileState.z || 20);
      const rState0 = Number(meissa2dTileState.radius || 0);
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
      const { w: wrapW, h: wrapH } = getOverlayWrapSize();
      const refScreenX = Number.isFinite(meissa2dLastZoomAnchorX) ? meissa2dLastZoomAnchorX : wrapW * 0.5;
      const refScreenY = Number.isFinite(meissa2dLastZoomAnchorY) ? meissa2dLastZoomAnchorY : wrapH * 0.5;
      const refTileBefore = screenToTile(
        refScreenX,
        refScreenY,
        meissa2dViewTx,
        meissa2dViewTy,
        meissa2dViewScale,
        meissa2dTileState,
        wrapW,
        wrapH
      );
      const prevZ = z;
      const targetZ = allowZoomStep ? desiredTileZoomFromScale(scale, prevZ) : prevZ;
      let refTileXAfter = Number(refTileBefore.tileX);
      let refTileYAfter = Number(refTileBefore.tileY);
      if (targetZ !== z) {
        const factor = Math.pow(2, targetZ - z);
        centerX = Math.round(centerX * factor);
        centerY = Math.round(centerY * factor);
        refTileXAfter *= factor;
        refTileYAfter *= factor;
        // z 레벨이 바뀌어도 현재 보이는 위치/배율이 튀지 않게 보정
        scale = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, scale / factor);
        meissa2dViewScale = scale;
        z = targetZ;
      }
      let radius = computeMosaicRadiusForScale(scale);
      // z 한 단계 올릴 때 타일 반경이 compute(줄어든 CSS scale)만 따라가면 격자가 급격히 작아져 화면이 비어 보인다 → 이전 반경 승계
      if (targetZ > zState0) {
        radius = Math.max(radius, Math.min(45, rState0 * 2 + 1));
      } else if (targetZ < zState0) {
        radius = Math.max(radius, Math.max(8, Math.floor(rState0 / 2)));
      } else if (targetZ === zState0) {
        // 같은 z: 1~2단계 반경 변화는 앵커 재보정 연속 호출만 유발 → 히스테리시스
        if (radius < rState0 && radius >= rState0 - 2) radius = rState0;
      }
      if (radius !== Number(meissa2dTileState.radius || 0) || targetZ !== Number(meissa2dTileState.z || 20)) {
        const tsAfter = {
          centerX,
          centerY,
          radius,
        };
        const localAfter = tileToLocalPx(refTileXAfter, refTileYAfter, tsAfter, wrapW, wrapH);
        meissa2dViewTx = refScreenX - localAfter.x * scale;
        meissa2dViewTy = refScreenY - localAfter.y * scale;
        renderMeissa2dMosaic(sid, {
          z: targetZ,
          radius,
          centerX,
          centerY,
        });
        meissa2dFallbackTileCenter = { x: centerX, y: centerY };
        applyMeissa2dViewTransform();
        return;
      }
      if (allowPanShift) {
        const spanPan = radius * 2 + 1;
        const { side: sidePan } = getMeissa2dSquareMapLayout(wrapW, wrapH);
        const cellLocal = sidePan / Math.max(1, spanPan);
        const tilePxScreen = Math.max(12, cellLocal * scale);
        // thresh(0.92*tp)와 보정량(tp) 불일치 + 1타일 캡은 누적 오차로 "좌표가 계속 새는" 현상 유발 → tp 기준 trunc로 정합
        let shiftX = Math.trunc(meissa2dViewTx / tilePxScreen);
        let shiftY = Math.trunc(meissa2dViewTy / tilePxScreen);
        const cap = 24;
        shiftX = Math.max(-cap, Math.min(cap, shiftX));
        shiftY = Math.max(-cap, Math.min(cap, shiftY));
        if (shiftX !== 0 || shiftY !== 0) {
          const centerBeforeX = centerX;
          const centerBeforeY = centerY;
          centerX -= shiftX;
          // 타일 Y축(위쪽이 큰 값) 방향 보정
          centerY += shiftY;
          const txBefore = Number(meissa2dViewTx || 0);
          const tyBefore = Number(meissa2dViewTy || 0);
          meissa2dViewTx -= shiftX * tilePxScreen;
          meissa2dViewTy -= shiftY * tilePxScreen;
          renderMeissa2dMosaic(sid, {
            z: targetZ,
            radius,
            centerX,
            centerY,
          });
          meissa2dFallbackTileCenter = { x: centerX, y: centerY };
          applyMeissa2dViewTransform();
        }
      }
    }, delay);
  }

  /**
   * 타일 모자이크: 휠 = 정수 z만 ±1 (슬리피 맵 격자). 커서 아래 연속 타일좌표를 유지하고 CSS scale은 1로 고정한다.
   * @returns {boolean} 적용함
   */
  function applyMeissa2dMosaicWheelZoomToCursor(refSx, refSy, zoomIn) {
    syncMeissa2dSquareMapFrameLayout();
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    if (!sid || !projectId) {
      return false;
    }
    const ts = meissa2dTileState;
    if (String(ts.snapshotId || "").trim() && String(ts.snapshotId) !== sid) {
      return false;
    }
    const z0 = Math.max(
      MEISSA_MOSAIC_TILE_Z_MIN,
      Math.min(MEISSA_MOSAIC_TILE_Z_MAX, Math.floor(Number(ts.z || 20)))
    );
    const newZ = zoomIn ? z0 + 1 : z0 - 1;
    if (newZ < MEISSA_MOSAIC_TILE_Z_MIN || newZ > MEISSA_MOSAIC_TILE_Z_MAX) {
      return false;
    }
    if (meissa2dRecenterTimer) {
      window.clearTimeout(meissa2dRecenterTimer);
      meissa2dRecenterTimer = null;
    }
    const { w: wrapW, h: wrapH } = getOverlayWrapSize();
    const anchor = screenToTile(
      refSx,
      refSy,
      meissa2dViewTx,
      meissa2dViewTy,
      meissa2dViewScale,
      ts,
      wrapW,
      wrapH
    );
    const factor = Math.pow(2, newZ - z0);
    const aX = Number(anchor.tileX) * factor;
    const aY = Number(anchor.tileY) * factor;
    const cx = Math.round(aX);
    const cy = Math.round(aY);
    const rState0 = Number(ts.radius || 0);
    let radius = computeMosaicRadiusForScale(1);
    if (newZ > z0) radius = Math.max(radius, Math.min(45, rState0 * 2 + 1));
    else radius = Math.max(radius, Math.max(8, Math.floor(rState0 / 2)));
    const tsAfter = { centerX: cx, centerY: cy, radius };
    const localAfter = tileToLocalPx(aX, aY, tsAfter, wrapW, wrapH);
    meissa2dViewScale = 1;
    meissa2dViewTx = refSx - localAfter.x;
    meissa2dViewTy = refSy - localAfter.y;
    meissa2dLastZoomAnchorX = refSx;
    meissa2dLastZoomAnchorY = refSy;
    renderMeissa2dMosaic(sid, { z: newZ, centerX: cx, centerY: cy, radius });
    applyMeissa2dViewTransform();
    return true;
  }

  /** 메타데이터 Form 전송용 JSON(비유한 숫자·undefined 제거). */
  function meissaDatasetJsonForFormMetadata(meta) {
    try {
      return JSON.stringify(meta, (_k, v) => {
        if (typeof v === "number" && !Number.isFinite(v)) return null;
        if (v === undefined) return null;
        return v;
      });
    } catch (e) {
      const q = meta?.quality;
      const cid = meta?.circleId;
      return JSON.stringify({
        quality: q,
        circleId: cid,
        source: "meissa-compare-ui",
        metaSerializeError: String(e?.message || e),
      });
    }
  }

  function meissaDatasetApiBase() {
    const u = String(API_BASE_URL || "").trim();
    if (u) return u.replace(/\/$/, "");
    const o = window.location?.origin;
    if (o && o !== "null") return String(o).replace(/\/$/, "");
    return "";
  }

  /** 도면 원보다 바깥으로 얼마나 더 잘라낼지(반경 대비 %). */
  function meissaDatasetGetCropMarginPct() {
    const el = document.getElementById("meissa-dataset-crop-margin-pct");
    let p = el ? Number(el.value) : 22;
    if (!Number.isFinite(p)) p = 22;
    return Math.max(0, Math.min(120, Math.round(p)));
  }

  function meissaDatasetCropCanvasEnsure() {
    if (!meissaDatasetCropCanvas) meissaDatasetCropCanvas = document.createElement("canvas");
    return meissaDatasetCropCanvas;
  }

  function meissaDatasetCaptureOrthoPatchForCircle(circle) {
    return new Promise((resolve) => {
      const img = els.meissaCloud2dImageLocal;
      if (!hasRenderableOverlayImage(img) || !useFullGeorefForOverlayImage(img)) {
        resolve({ error: "정사 이미지·전역 georef가 필요합니다." });
        return;
      }
      const fx = Number(circle?.center_x);
      const fy = Number(circle?.center_y);
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
        resolve({ error: "도면 중심 좌표 없음" });
        return;
      }
      const nat = fileCoordToOrthoNaturalPixel(fx, fy);
      if (!nat || nat.nw <= 8 || nat.nh <= 8) {
        resolve({ error: "정사 픽셀 매핑 실패(지오레프·스냅샷 확인)" });
        return;
      }
      const { ix, iy, nw, nh } = nat;
      const rFile = meissa2dPileRadiusFileUnits(circle);
      if (!Number.isFinite(rFile) || rFile <= 1e-9) {
        resolve({ error: "도면에 말뚝 반경/직경이 없습니다." });
        return;
      }
      const rNatPile = meissa2dPileRadiusNaturalPx(circle);
      if (!Number.isFinite(rNatPile) || rNatPile <= 1.5) {
        resolve({ error: "도면 반경을 정사 픽셀로 환산하지 못했습니다." });
        return;
      }
      const margin = 1 + meissaDatasetGetCropMarginPct() / 100;
      let half = Math.ceil(rNatPile * margin);
      const cropMode = "file_radius";
      const halfMax = Math.max(16, Math.floor(Math.min(nw, nh) * 0.5) - 2);
      half = Math.max(20, Math.min(half, halfMax));
      const diam = half * 2;
      let sx = Math.floor(ix - half);
      let sy = Math.floor(iy - half);
      sx = Math.max(0, Math.min(sx, nw - diam));
      sy = Math.max(0, Math.min(sy, nh - diam));
      const sw = Math.min(diam, nw - sx);
      const sh = Math.min(diam, nh - sy);
      if (sw < 8 || sh < 8) {
        resolve({ error: "크롭 영역이 너무 작음" });
        return;
      }
      const cnv = meissaDatasetCropCanvasEnsure();
      cnv.width = sw;
      cnv.height = sh;
      const pctx = cnv.getContext("2d");
      if (!pctx) {
        resolve({ error: "canvas" });
        return;
      }
      try {
        pctx.clearRect(0, 0, sw, sh);
        pctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        /** 도면에 그린 말뚝 원(rNatPile) 밖은 투명 — 데이터셋·학습이 원 영역만 보게 함 */
        const cxLoc = ix - sx + 0.5;
        const cyLoc = iy - sy + 0.5;
        pctx.globalCompositeOperation = "destination-in";
        pctx.beginPath();
        pctx.arc(cxLoc, cyLoc, rNatPile, 0, Math.PI * 2);
        pctx.closePath();
        pctx.fill();
        pctx.globalCompositeOperation = "source-over";
      } catch (err) {
        resolve({ error: String(err?.message || err) });
        return;
      }
      cnv.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ error: "PNG 인코딩 실패" });
            return;
          }
          resolve({
            blob,
            cropMeta: {
              naturalSx: sx,
              naturalSy: sy,
              naturalSw: sw,
              naturalSh: sh,
              centerIx: ix,
              centerIy: iy,
              orthoNw: nw,
              orthoNh: nh,
              patchHalfPx: half,
              cropMode,
              pileRadiusFile: Number.isFinite(rFile) ? rFile : null,
              pileRadiusNaturalPx: Number.isFinite(rNatPile) ? rNatPile : null,
              cropMarginPct: meissaDatasetGetCropMarginPct(),
              maskDisk: true,
              maskRadiusNaturalPx: rNatPile,
              maskCenterInCrop: { x: ix - sx + 0.5, y: iy - sy + 0.5 },
            },
          });
        },
        "image/png",
        0.92
      );
    });
  }

  function meissaDatasetTogglePickAt(clientX, clientY) {
    const cc = contentCoordsFromMeissaOverlay(clientX, clientY);
    if (!cc) return;
    let best = null;
    let bestD = 1e9;
    for (const h of meissa2dPickHits) {
      const d = Math.hypot(cc.x - h.x, cc.y - h.y);
      if (d <= h.r && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best?.circle) return;
    const id = String(best.circle.id ?? "");
    if (!id) return;
    if (meissaDatasetSelectedIds.has(id)) meissaDatasetSelectedIds.delete(id);
    else meissaDatasetSelectedIds.add(id);
    meissaDatasetRefreshToolbar();
    scheduleRenderMeissa2dPointsOverlay();
  }

  function meissaDatasetRefreshToolbar() {
    const st = document.getElementById("meissa-dataset-status");
    if (!st) return;
    if (meissaDatasetSelectedIds.size) {
      st.textContent = `선택 ${meissaDatasetSelectedIds.size}개`;
      return;
    }
    const t = String(st.textContent || "");
    if (t.startsWith("선택 ")) st.textContent = "";
  }

  async function meissaDatasetSaveSelectedWithQuality(quality, extra) {
    const allowed =
      quality === "ok" ||
      quality === "mid" ||
      quality === "bad" ||
      quality === "other" ||
      quality === "cap_ok" ||
      quality === "cap_mid" ||
      quality === "cap_bad";
    if (!allowed) return;
    const ids = [...meissaDatasetSelectedIds];
    const st = document.getElementById("meissa-dataset-status");
    if (!ids.length) {
      if (st) st.textContent = "먼저 Ctrl+클릭으로 말뚝을 선택하세요.";
      return;
    }
    const otherInput = document.getElementById("meissa-dataset-other-label");
    let inferenceTargetLabel = "";
    if (quality === "other") {
      const raw =
        extra && typeof extra.inferenceTargetLabel === "string"
          ? extra.inferenceTargetLabel
          : otherInput
            ? String(otherInput.value || "")
            : "";
      inferenceTargetLabel = raw.trim().slice(0, 200);
      if (!inferenceTargetLabel) {
        if (st) st.textContent = "기타 저장: 분류 이름을 입력하세요.";
        return;
      }
    }
    const base = meissaDatasetApiBase();
    const url = `${base || ""}/api/pile-dataset/crops`.replace(/^\/\//, "/");
    const projectId = (els.meissaProjectSelect?.value || "").trim() || (els.projectId?.value || "").trim();
    const snapshotId = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const workId = (els.workId?.value || "").trim();
    if (st) st.textContent = `업로드 중… (${ids.length}개) → ${url}`;
    /** @type {string[]} */
    const errLines = [];
    let ok = 0;
    let err = 0;
    for (const id of ids) {
      const c = (state.circles || []).find((x) => String(x?.id ?? "") === id);
      if (!c) {
        err++;
        errLines.push(`id ${id}: 원 데이터 없음`);
        continue;
      }
      const cap = await meissaDatasetCaptureOrthoPatchForCircle(c);
      if (cap.error || !cap.blob) {
        err++;
        errLines.push(`#${id}: ${cap.error || "PNG 없음"}`);
        continue;
      }
      const pileLabel = String(c?.matched_text?.text ?? "").trim();
      const fit = meissa2dGetOrthoPdamRgbFit(c, { forceSync: true });
      const meta = {
        quality,
        circleId: id,
        pileLabel,
        centerX: Number(c.center_x),
        centerY: Number(c.center_y),
        centerZ: c.center_z != null && Number.isFinite(Number(c.center_z)) ? Number(c.center_z) : null,
        radius: meissa2dPileRadiusFileUnits(c),
        projectId,
        snapshotId,
        workId: workId || null,
        source: "meissa-compare-ui",
        footprintOverlap: fit?.footprintOverlap ?? null,
        orthoPdamTier: fit?.tier ?? null,
        orthoPdamOffsetM: fit?.offsetM ?? null,
        orthoPdamDetectMode: fit?.detectMode ?? null,
        orthoPileCapped: fit?.pileCapped === true,
        pileDatasetFamily:
          quality === "cap_ok" || quality === "cap_mid" || quality === "cap_bad"
            ? "cap"
            : quality === "other"
              ? "other"
              : "general",
        crop: cap.cropMeta,
      };
      if (quality === "other") meta.inferenceTargetLabel = inferenceTargetLabel;
      const form = new FormData();
      form.append("metadata", meissaDatasetJsonForFormMetadata(meta));
      form.append("image", cap.blob, `pile_${id}.png`);
      try {
        const res = await fetch(url, {
          method: "POST",
          body: form,
          signal: pilexyUnloadAbort.signal,
        });
        const txt = await res.text();
        if (!res.ok) {
          err++;
          errLines.push(`#${id}: HTTP ${res.status} ${txt.slice(0, 220)}`);
          continue;
        }
        ok++;
      } catch (e) {
        err++;
        const msg = e?.message || String(e);
        errLines.push(`#${id}: ${msg}`);
        console.warn("pile-dataset save", e);
      }
    }
    meissaDatasetSelectedIds.clear();
    if (st) {
      const hint = errLines.length ? ` · ${errLines.slice(0, 3).join(" | ")}` : "";
      const baseHint = base ? "" : " (API 주소 비어 있음—페이지와 백엔드가 같은 호스트인지 확인)";
      st.textContent = `저장: 성공 ${ok} · 실패 ${err}${baseHint}${hint}`;
    }
    scheduleRenderMeissa2dPointsOverlay();
  }

  async function meissaDatasetResetServer() {
    const st = document.getElementById("meissa-dataset-status");
    if (!window.confirm("서버의 data/pile_dataset/crops 이미지와 index.jsonl을 모두 삭제합니다. 계속할까요?")) return;
    const base = meissaDatasetApiBase();
    const url = `${base || ""}/api/pile-dataset/reset`.replace(/^\/\//, "/");
    if (st) st.textContent = `초기화 요청… ${url}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: pilexyUnloadAbort.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (st) st.textContent = `초기화 실패 HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`;
        return;
      }
      if (st) {
        const n = data?.removedImageFiles ?? "?";
        const es = Array.isArray(data?.errors) && data.errors.length ? ` ${data.errors.join("; ")}` : "";
        st.textContent = `데이터셋 초기화 완료(삭제 이미지 ${n}개)${es}`;
      }
    } catch (e) {
      if (st) st.textContent = `초기화 실패: ${e?.message || e} — 백엔드 실행·URL 확인`;
    }
  }

  /** UTF-8 문자열의 SHA-256 16진 문자열 (비밀번호는 저장하지 않고 해시만 비교) */
  async function meissaDatasetSha256HexUtf8(text) {
    const enc = new TextEncoder();
    const buf = enc.encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(hashBuf);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }

  /** 말뚝 데이터셋 패널 비밀번호의 SHA-256(hex). 평문은 저장소에 넣지 않음. */
  const MEISSA_PILE_DATASET_PANEL_PW_SHA256 =
    "78ffc9f4c8443a8d427a25bda271011fd9ff7c8b034142361bc450de6cfc6ef8";
  const MEISSA_PILE_DATASET_UNLOCK_KEY = "meissaPileDatasetPanelUnlocked";

  function meissaDatasetPanelBindPasswordGate() {
    const det = document.getElementById("meissa-dataset-details");
    const sum = det?.querySelector("summary.meissa-dataset-details-summary");
    if (!det || !sum) return;
    sum.addEventListener(
      "click",
      (ev) => {
        if (det.open) return;
        if (sessionStorage.getItem(MEISSA_PILE_DATASET_UNLOCK_KEY) === "1") return;
        ev.preventDefault();
        const entered = window.prompt("말뚝 데이터셋 영역 비밀번호를 입력하세요.");
        if (entered === null) return;
        if (!globalThis.crypto?.subtle) {
          window.alert("이 브라우저에서는 암호 검증(SHA-256)을 지원하지 않습니다.");
          return;
        }
        void (async () => {
          try {
            const hex = await meissaDatasetSha256HexUtf8(entered);
            if (hex === MEISSA_PILE_DATASET_PANEL_PW_SHA256) {
              sessionStorage.setItem(MEISSA_PILE_DATASET_UNLOCK_KEY, "1");
              det.open = true;
            } else {
              window.alert("비밀번호가 올바르지 않습니다.");
            }
          } catch (_) {
            window.alert("비밀번호 확인 중 오류가 났습니다.");
          }
        })();
      },
      true
    );
  }

  function meissaDatasetBindToolbar() {
    meissaDatasetPanelBindPasswordGate();
    document.getElementById("meissa-dataset-clear")?.addEventListener("click", () => {
      meissaDatasetSelectedIds.clear();
      const st = document.getElementById("meissa-dataset-status");
      if (st) st.textContent = "선택 해제됨";
      scheduleRenderMeissa2dPointsOverlay();
    });
    document.getElementById("meissa-dataset-save-ok")?.addEventListener("click", () => {
      meissaDatasetSaveSelectedWithQuality("ok");
    });
    document.getElementById("meissa-dataset-save-mid")?.addEventListener("click", () => {
      meissaDatasetSaveSelectedWithQuality("mid");
    });
    document.getElementById("meissa-dataset-save-bad")?.addEventListener("click", () => {
      meissaDatasetSaveSelectedWithQuality("bad");
    });
    document.getElementById("meissa-dataset-save-other")?.addEventListener("click", () => {
      const el = document.getElementById("meissa-dataset-other-label");
      const inferenceTargetLabel = el ? String(el.value || "").trim() : "";
      meissaDatasetSaveSelectedWithQuality("other", { inferenceTargetLabel });
    });
    document.getElementById("meissa-dataset-reset-server")?.addEventListener("click", () => {
      meissaDatasetResetServer();
    });
  }

  function meissaDatasetDrawSelectionRing(ctx, px, py, pxScale, hasFoot, rPx, dotR) {
    ctx.save();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
    ctx.lineWidth = meissa2dOverlayLineWidthCssPx(pxScale, 2.35);
    ctx.setLineDash([5, 4]);
    const ringR =
      hasFoot && Number.isFinite(rPx) && rPx >= 0.12 ? rPx + Math.max(5, rPx * 0.08) : Math.max(dotR + 12, 18);
    ctx.beginPath();
    ctx.arc(px, py, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function bindMeissa2dOverlayInteractions() {
    if (meissa2dOverlayHandlersBound) return;
    const wrap = document.querySelector(".meissa-2d-overlay-wrap");
    if (!wrap) return;
    /** @type {Map<number, { x: number, y: number }>} pointerId → 최신 client 좌표 */
    const meissa2dActivePointers = new Map();
    let meissa2dPinchLastDist = 0;
    let meissa2dGestureHadMultiPointer = false;
    const onWheel = (evt) => {
      evt.preventDefault();
      meissa2dSuppressHoverFor(MEISSA_2D_HOVER_SUPPRESS_MS_AFTER_ZOOM);
      if (MEISSA_2D_SIMPLE_ORTHO && !isMosaicActive() && isMeissa2dOrthoImageStillDecoding()) {
        return;
      }
      const ptr = meissa2dOverlayPointerInContent(wrap, evt.clientX, evt.clientY);
      const refSx = ptr.x;
      const refSy = ptr.y;
      if (isMosaicActive()) {
        const zoomIn = evt.deltaY < 0;
        if (applyMeissa2dMosaicWheelZoomToCursor(refSx, refSy, zoomIn)) {
          return;
        }
        // z 한계 등: 타일 z는 유지하고 CSS 배율만 조절(무응답·이미지 사라진 것처럼 보이는 현상 방지)
        const prev = meissa2dViewScale;
        const next = Math.max(
          MEISSA_2D_ZOOM_MIN_SCALE,
          Math.min(MEISSA_2D_ZOOM_MOSAIC_CSS_MAX, prev * Math.exp(-evt.deltaY * 0.0012))
        );
        if (Math.abs(next - prev) < 1e-6) return;
        meissa2dLastZoomAnchorX = refSx;
        meissa2dLastZoomAnchorY = refSy;
        const k = next / prev;
        meissa2dViewTx = refSx - (refSx - meissa2dViewTx) * k;
        meissa2dViewTy = refSy - (refSy - meissa2dViewTy) * k;
        meissa2dViewScale = next;
        applyMeissa2dViewTransform({ redrawOverlay: false });
        scheduleMeissa2dViewSettleRefresh(96);
        // 지연 recenter는 경계 CSS 줌과 섞이면 다시 어긋날 수 있어 여기서는 호출하지 않음
        return;
      }
      const prev = meissa2dViewScale;
      const next = Math.max(
        MEISSA_2D_ZOOM_MIN_SCALE,
        Math.min(MEISSA_2D_ZOOM_MAX_SCALE, prev * Math.exp(-evt.deltaY * 0.0012))
      );
      if (Math.abs(next - prev) < 1e-6) return;
      meissa2dLastZoomAnchorX = refSx;
      meissa2dLastZoomAnchorY = refSy;
      const k = next / prev;
      meissa2dViewTx = refSx - (refSx - meissa2dViewTx) * k;
      meissa2dViewTy = refSy - (refSy - meissa2dViewTy) * k;
      meissa2dViewScale = next;
      applyMeissa2dViewTransform({ redrawOverlay: false });
      scheduleMeissa2dViewSettleRefresh(96);
    };
    const onPointerDown = (evt) => {
      if (evt.pointerType === "mouse" && evt.button !== 0) return;
      if (meissa2dViewSettleTimer) {
        try {
          window.clearTimeout(meissa2dViewSettleTimer);
        } catch (_) {
          /* ignore */
        }
        meissa2dViewSettleTimer = 0;
      }
      meissa2dActivePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      try {
        wrap.setPointerCapture(evt.pointerId);
      } catch (_) {
        /* 일부 환경에서 실패 무시 */
      }
      if (meissa2dActivePointers.size === 2) {
        meissa2dGestureHadMultiPointer = true;
        meissa2dDragging = false;
        meissa2dPointerDownClient = null;
        wrap.classList.remove("meissa-2d-overlay-wrap--dragging");
        const pts = [...meissa2dActivePointers.values()];
        const pd = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        meissa2dPinchLastDist = Math.max(pd, 12);
        evt.preventDefault();
        return;
      }
      if (meissa2dActivePointers.size === 1) {
        if (MEISSA_2D_SIMPLE_ORTHO && !isMosaicActive() && isMeissa2dOrthoImageStillDecoding()) {
          meissa2dActivePointers.delete(evt.pointerId);
          try {
            wrap.releasePointerCapture(evt.pointerId);
          } catch (_) {}
          evt.preventDefault();
          return;
        }
        meissa2dDragging = true;
        meissa2dPointerDownClient = { x: evt.clientX, y: evt.clientY };
        meissa2dDragX = evt.clientX;
        meissa2dDragY = evt.clientY;
        meissa2dLastZoomAnchorX = NaN;
        meissa2dLastZoomAnchorY = NaN;
        wrap.classList.add("meissa-2d-overlay-wrap--dragging");
        evt.preventDefault();
      }
    };
    const onPointerMove = (evt) => {
      if (!meissa2dActivePointers.has(evt.pointerId)) return;
      meissa2dActivePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      if (meissa2dActivePointers.size >= 2) {
        meissa2dSuppressHoverFor(MEISSA_2D_HOVER_SUPPRESS_MS_AFTER_ZOOM);
        if (MEISSA_2D_SIMPLE_ORTHO && !isMosaicActive() && isMeissa2dOrthoImageStillDecoding()) return;
        const pts = [...meissa2dActivePointers.values()];
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1e-3) return;
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        const ptr = meissa2dOverlayPointerInContent(wrap, midX, midY);
        const refSx = ptr.x;
        const refSy = ptr.y;
        const ratio = dist / Math.max(meissa2dPinchLastDist, 1e-6);
        meissa2dPinchLastDist = dist;
        const prev = meissa2dViewScale;
        let next = prev * ratio;
        const cap = isMosaicActive() ? MEISSA_2D_ZOOM_MOSAIC_CSS_MAX : MEISSA_2D_ZOOM_MAX_SCALE;
        next = Math.max(MEISSA_2D_ZOOM_MIN_SCALE, Math.min(cap, next));
        if (Math.abs(next - prev) < 1e-8) return;
        const k = next / prev;
        meissa2dViewTx = refSx - (refSx - meissa2dViewTx) * k;
        meissa2dViewTy = refSy - (refSy - meissa2dViewTy) * k;
        meissa2dViewScale = next;
        meissa2dLastZoomAnchorX = refSx;
        meissa2dLastZoomAnchorY = refSy;
        applyMeissa2dViewTransform({ redrawOverlay: false });
        scheduleMeissa2dViewSettleRefresh(84);
        return;
      }
      if (!meissa2dDragging) return;
      meissa2dSuppressHoverFor(90);
      const pdx = evt.clientX - meissa2dDragX;
      const pdy = evt.clientY - meissa2dDragY;
      meissa2dDragX = evt.clientX;
      meissa2dDragY = evt.clientY;
      meissa2dViewTx += pdx;
      meissa2dViewTy += pdy;
      applyMeissa2dViewTransform({ redrawOverlay: false });
    };
    const onPointerUp = (evt) => {
      const had = meissa2dActivePointers.has(evt.pointerId);
      if (had) {
        try {
          wrap.releasePointerCapture(evt.pointerId);
        } catch (_) {}
        meissa2dActivePointers.delete(evt.pointerId);
      }
      if (meissa2dActivePointers.size === 1 && meissa2dGestureHadMultiPointer) {
        const rem = [...meissa2dActivePointers.values()][0];
        meissa2dDragging = true;
        meissa2dDragX = rem.x;
        meissa2dDragY = rem.y;
        meissa2dPointerDownClient = { x: rem.x, y: rem.y };
        wrap.classList.add("meissa-2d-overlay-wrap--dragging");
        meissa2dPinchLastDist = 0;
        return;
      }
      if (meissa2dActivePointers.size === 0) {
        meissa2dPinchLastDist = 0;
        const wasDragging = meissa2dDragging;
        const from = meissa2dPointerDownClient;
        const pinchGesture = meissa2dGestureHadMultiPointer;
        meissa2dPointerDownClient = null;
        meissa2dDragging = false;
        wrap.classList.remove("meissa-2d-overlay-wrap--dragging");
        meissa2dGestureHadMultiPointer = false;
        const tapOk =
          wasDragging &&
          from &&
          !pinchGesture &&
          !(evt.pointerType === "mouse" && evt.button !== 0);
        if (tapOk) {
          const moved = Math.hypot(evt.clientX - from.x, evt.clientY - from.y);
          if (moved < 6) {
            if (evt.pointerType === "mouse" && (evt.ctrlKey || evt.metaKey))
              meissaDatasetTogglePickAt(evt.clientX, evt.clientY);
            else tryMeissaCoordHintFromOverlay(evt.clientX, evt.clientY);
          }
        }
        if (wasDragging && MEISSA_2D_SIMPLE_ORTHO) {
          // 드래그 중 생략했던 고해상 패치/오버레이 갱신을 손을 뗀 시점에 1회만 반영
          applyMeissa2dViewTransform();
        }
        if (isMosaicActive()) scheduleMeissa2dRecenterRefresh(true, false);
      }
    };
    const onDbl = (evt) => {
      evt.preventDefault();
      if (MEISSA_2D_SIMPLE_ORTHO) {
        const im = els.meissaCloud2dImageLocal;
        if (
          im &&
          im.getAttribute("data-meissa-2d-intrinsic-layout") === "1" &&
          Number(im.naturalWidth || 0) > 1 &&
          Number(im.naturalHeight || 0) > 1
        ) {
          meissa2dFitIntrinsicOrthoPanToWrap();
          return;
        }
      }
      resetMeissa2dViewTransform();
    };
    wrap.addEventListener(
      "mousemove",
      (evt) => {
        if (Date.now() < meissa2dHoverSuppressUntil) {
          setMeissa2dOverlayTooltip("", 0, 0, false);
          return;
        }
        if (meissa2dDragging) {
          setMeissa2dOverlayTooltip("", 0, 0, false);
          setMeissa2dHoverPickFromBest(null);
          return;
        }
        const cc = contentCoordsFromMeissaOverlay(evt.clientX, evt.clientY);
        if (!cc) return;
        let best = null;
        let bestD = 1e9;
        for (const h of meissa2dPickHits) {
          const d = Math.hypot(cc.x - h.x, cc.y - h.y);
          if (d <= h.r && d < bestD) {
            bestD = d;
            best = h;
          }
        }
        if (best) {
          if (!best.tooltip) best.tooltip = meissa2dBuildPickTooltip(best.circle, best.fit);
          setMeissa2dOverlayTooltip(best.tooltip || "", evt.clientX, evt.clientY, true);
          setMeissa2dHoverPickFromBest(best);
        } else {
          setMeissa2dOverlayTooltip("", 0, 0, false);
          setMeissa2dHoverPickFromBest(null);
        }
      },
      { passive: true }
    );
    wrap.addEventListener("mouseleave", () => {
      setMeissa2dOverlayTooltip("", 0, 0, false);
      setMeissa2dHoverPickFromBest(null);
    });
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    wrap.addEventListener("mouseleave", () => {
      if (!meissa2dDragging) return;
      meissa2dPointerDownClient = null;
      meissa2dDragging = false;
      wrap.classList.remove("meissa-2d-overlay-wrap--dragging");
      scheduleMeissa2dViewSettleRefresh(64);
      if (isMosaicActive()) scheduleMeissa2dRecenterRefresh(true, false);
    });
    wrap.addEventListener("dblclick", onDbl);
    const orthoImg = els.meissaCloud2dImageLocal;
    if (orthoImg && MEISSA_2D_SIMPLE_ORTHO) {
      orthoImg.addEventListener(
        "load",
        () => {
          if (!MEISSA_2D_SIMPLE_ORTHO) return;
          markMeissa2dOverlayWarmup();
          const nw = Number(orthoImg.naturalWidth || 0);
          const nh = Number(orthoImg.naturalHeight || 0);
          if (nw <= 1 || nh <= 1) return;
          meissa2dOrthoInteractReady = true;
          /* 저해상→고해상 src 교체 시 reset/fit 을 호출하면 preserveView 직후 뷰가 통째로 틀어짐 */
          syncMeissa2dSquareMapFrameLayout();
          tryMeissa2dOrthoViewportHiPaintCachedSync();
          window.setTimeout(() => {
            if (!meissa2dDragging) scheduleMeissa2dOrthoViewportHiFetch();
          }, 180);
          scheduleRenderMeissa2dPointsOverlay();
        },
        { passive: true }
      );
    }
    meissa2dOverlayHandlersBound = true;
  }

  function getFocusCenterFromFileCoords() {
    const b = getFocusBoundsFromFileCoords();
    if (!b) return null;
    const x = (Number(b.minX) + Number(b.maxX)) * 0.5;
    const y = (Number(b.minY) + Number(b.maxY)) * 0.5;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function focusToTileCenter(projectId, z) {
    const focus = getFocusCenterFromFileCoords();
    if (!focus) return null;
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const g = getGeoConfig(projectId, sid);
    const projected = fileCoordToTileXY(focus.x, focus.y, z, g);
    if (projected) {
      return {
        x: Math.round(projected.x),
        y: Math.round(projected.y),
      };
    }
    const hint = readMeissaTileHint(projectId);
    const zoomFactor = Number(z) >= 21 ? 2 : 1;
    if (hint?.dx != null && hint?.dy != null) {
      return {
        x: Math.round(focus.x + hint.dx * zoomFactor),
        y: Math.round(focus.y + hint.dy * zoomFactor),
      };
    }
    return {
      x: Math.round(focus.x + DEFAULT_FOCUS_TO_TILE_DX * zoomFactor),
      y: Math.round(focus.y + DEFAULT_FOCUS_TO_TILE_DY * zoomFactor),
    };
  }

  function readMeissaTileHint(projectId) {
    try {
      const raw = localStorage.getItem(MEISSA_TILE_HINTS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const row = obj?.[String(projectId)];
      if (!row || typeof row !== "object") return null;
      const x = Number(row.x);
      const y = Number(row.y);
      const dx = Number(row.dx);
      const dy = Number(row.dy);
      return {
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null,
        z: Number.isFinite(Number(row.z)) ? Number(row.z) : null,
        dx: Number.isFinite(dx) ? dx : null,
        dy: Number.isFinite(dy) ? dy : null,
      };
    } catch (_) {
      return null;
    }
  }

  function saveMeissaTileHint(projectId, tileX, tileY, tileZ) {
    try {
      const pid = String(projectId || "").trim();
      if (!pid) return;
      const tx = Number(tileX);
      const ty = Number(tileY);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      const focus = getFocusCenterFromFileCoords();
      const raw = localStorage.getItem(MEISSA_TILE_HINTS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[pid] = {
        x: tx,
        y: ty,
        z: Number.isFinite(Number(tileZ)) ? Number(tileZ) : 20,
        dx: focus ? tx - focus.x : null,
        dy: focus ? ty - focus.y : null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(MEISSA_TILE_HINTS_KEY, JSON.stringify(obj));
    } catch (_) {
      // ignore localStorage failure
    }
  }

  function candidateTileCenters(projectId, options) {
    const o = options || {};
    const strictAbsolute = Boolean(o.strictAbsolute);
    const out = [];
    const pushCenter = (x, y) => {
      const xi = Math.round(Number(x));
      const yi = Math.round(Number(y));
      if (!Number.isFinite(xi) || !Number.isFinite(yi)) return;
      out.push([xi, yi]);
    };
    const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
    const hint = readMeissaTileHint(projectId);
    const focus = getFocusCenterFromFileCoords();
    if (focus) {
      const g = getGeoConfig(projectId, sid);
      const p20 = fileCoordToTileXY(focus.x, focus.y, 20, g);
      if (p20) pushCenter(p20.x, p20.y);
    }
    if (strictAbsolute) {
      const uniqOnly = [];
      const seenOnly = new Set();
      for (const c of out) {
        const key = `${c[0]}|${c[1]}`;
        if (seenOnly.has(key)) continue;
        seenOnly.add(key);
        uniqOnly.push(c);
      }
      return uniqOnly;
    }
    if (
      Number.isFinite(Number(meissa2dFallbackTileCenter?.x)) &&
      Number.isFinite(Number(meissa2dFallbackTileCenter?.y))
    ) {
      pushCenter(meissa2dFallbackTileCenter.x, meissa2dFallbackTileCenter.y);
    }
    if (hint?.x != null && hint?.y != null) {
      if (hint?.z != null && hint.z >= 20 && hint.x < 400000) pushCenter(hint.x * 4, hint.y * 4);
      else pushCenter(hint.x, hint.y);
    }
    if (focus) {
      if (hint?.dx != null && hint?.dy != null) {
        pushCenter(focus.x + hint.dx, focus.y + hint.dy);
      }
      pushCenter(focus.x + DEFAULT_FOCUS_TO_TILE_DX, focus.y + DEFAULT_FOCUS_TO_TILE_DY);
    }
    pushCenter(894340, 641297);
    const uniq = [];
    const seen = new Set();
    for (const c of out) {
      const key = `${c[0]}|${c[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(c);
    }
    return uniq;
  }

  function probeImageUrl(url, timeoutMs) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        img.onload = null;
        img.onerror = null;
        resolve(Boolean(ok));
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      window.setTimeout(() => finish(false), Math.max(1200, Number(timeoutMs) || 3200));
      img.src = `${url}${String(url).includes("?") ? "&" : "?"}t=${Date.now()}`;
    });
  }

  async function fetchWithTimeout(url, init, timeoutMs) {
    const ms = Math.max(500, Number(timeoutMs) || 3500);
    const ctrl = new AbortController();
    const signal = pilexyFetchSignal(ctrl.signal);
    const tm = window.setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...(init || {}), signal });
    } finally {
      window.clearTimeout(tm);
    }
  }

  function logOrthoMainHighFetchFailure(e) {
    try {
      const name = e && e.name ? String(e.name) : "";
      const msg = e && e.message != null ? String(e.message).trim() : "";
      const detail = msg ? `${name || "Error"}: ${msg}` : name || String(e);
      if (name === "AbortError") {
        pushMeissa2dLoadLine("정사: 고해상 fetch 중단(타임아웃 또는 페이지 이탈)");
      } else if (name === "TypeError" && String(msg).toLowerCase().includes("failed to fetch")) {
        pushMeissa2dLoadLine(
          `정사: 고해상 fetch 실패 — ${detail}(헤더 OK 뒤 본문(~100MB) 수신 중 끊김이면 Wi‑Fi·VPN·회사 프록시·백엔드 읽기 제한이 흔함 · Image 폴백)`
        );
      } else {
        pushMeissa2dLoadLine(`정사: 고해상 fetch 실패 — ${detail}`);
      }
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * 메인 고해상 PNG: 헤더 후 res.blob()으로 본문 수신(브라우저 네이티브 경로).
   * ReadableStream 수동 read()는 일부 환경에서 대용량 시 정지하는 사례가 있어 사용하지 않음.
   * onProgress: 헤더 직후 (0,total), 완료 시 (size,total). 중간 바이트 콜백은 없음(blob() 한 번에 읽음).
   */
  async function fetchOrthoMainHighBlobWithProgressInner(url, timeoutMs, onProgress) {
    const ms = Math.max(500, Number(timeoutMs) || 3500);
    const u0 = String(url || "").trim();
    if (!u0) throw new Error("empty-url");
    const u = u0.includes("/orthophoto-preview") ? withOrthophotoImgCacheBust(u0) : u0;
    const ctrl = new AbortController();
    const signal = pilexyFetchSignal(ctrl.signal);
    const t0 = Date.now();
    const tm = window.setTimeout(() => ctrl.abort(), ms);
    /* <img> 와 동일하게 access_token 은 URL 쿼리에만 두고, Authorization 은 넣지 않음(교차 출처·프리플라이트에서 Failed to fetch 유발 사례). */
    try {
      const res = await fetch(u, { method: "GET", signal });
      if (!res.ok) throw new Error(String(res.status));
      const clHdr =
        res.headers && typeof res.headers.get === "function"
          ? res.headers.get("content-length")
          : "";
      const cl = parseInt(String(clHdr || ""), 10);
      const total = Number.isFinite(cl) && cl > 0 ? cl : 0;
      try {
        pushMeissa2dLoadLine(
          `정사: 고해상 응답 헤더 OK(HTTP ${res.status})${total ? ` · 약 ${(total / 1048576).toFixed(1)}MB` : ""}`
        );
      } catch (_) {
        /* ignore */
      }
      if (typeof onProgress === "function") {
        try {
          onProgress(0, total);
        } catch (_) {
          /* ignore */
        }
      }
      const b = await res.blob();
      try {
        pushMeissa2dLoadLine(
          `정사: 고해상 본문 수신 완료 ${(b.size / 1048576).toFixed(1)}MB · ${Date.now() - t0}ms`
        );
      } catch (_) {
        /* ignore */
      }
      if (typeof onProgress === "function") {
        try {
          onProgress(b.size, total || b.size);
        } catch (_) {
          /* ignore */
        }
      }
      return b;
    } finally {
      try {
        window.clearTimeout(tm);
      } catch (_) {
        /* ignore */
      }
    }
  }

  /** 대용량 PNG는 본문 수신 중 연결 끊김(Failed to fetch)이 잦아 짧게 재시도 후 Image 폴백으로 넘김 */
  async function fetchOrthoMainHighBlobWithProgress(url, timeoutMs, onProgress) {
    const u0 = String(url || "").trim();
    if (!u0) throw new Error("empty-url");
    const maxNetRetries = 2;
    let lastErr = null;
    for (let attempt = 0; attempt <= maxNetRetries; attempt++) {
      if (attempt > 0) {
        const wait = attempt === 1 ? 1300 : 2800;
        try {
          pushMeissa2dLoadLine(
            `정사: 고해상 본문 수신 끊김 → ${Math.round(wait / 100) / 10}s 후 재시도 (${attempt + 1}/${maxNetRetries + 1})`
          );
        } catch (_) {
          /* ignore */
        }
        await new Promise((r) => window.setTimeout(r, wait));
      }
      try {
        return await fetchOrthoMainHighBlobWithProgressInner(url, timeoutMs, onProgress);
      } catch (e) {
        lastErr = e;
        const name = e && e.name ? String(e.name) : "";
        const msg = e && e.message != null ? String(e.message).trim() : "";
        const isAbort = name === "AbortError";
        const isNetFail =
          name === "TypeError" && String(msg).toLowerCase().includes("failed to fetch");
        if (isAbort || !isNetFail || attempt >= maxNetRetries) {
          logOrthoMainHighFetchFailure(e);
          throw e;
        }
      }
    }
    logOrthoMainHighFetchFailure(lastErr);
    throw lastErr || new Error("fetch-failed");
  }

  function collectMeissaHttpUrlsFromPayload(node, out, depth) {
    if (!node || depth > 7) return;
    if (Array.isArray(node)) {
      for (const it of node) collectMeissaHttpUrlsFromPayload(it, out, depth + 1);
      return;
    }
    if (typeof node === "string") {
      const s = node.trim();
      if (s.startsWith("http")) out.add(s);
      return;
    }
    if (typeof node !== "object") return;
    for (const v of Object.values(node)) {
      if (typeof v === "string") {
        const s = v.trim();
        if (s.startsWith("http")) out.add(s);
      } else if (v && typeof v === "object") {
        collectMeissaHttpUrlsFromPayload(v, out, depth + 1);
      }
    }
  }

  function normalizeMeissaSignedUrl(rawUrl) {
    const s0 = String(rawUrl || "").trim();
    if (!s0) return "";
    let s = s0;
    if (s.includes("&amp;")) s = s.replace(/&amp;/gi, "&");
    if (s.includes("&#38;")) s = s.replace(/&#38;/g, "&");
    if (s.includes("&#x26;")) s = s.replace(/&#x26;/gi, "&");
    return s;
  }

  function meissaSignedUrlExpiresInSec(url) {
    const s = String(url || "").trim();
    if (!s) return NaN;
    try {
      const u = new URL(s, window.location.origin);
      const expRaw = (u.searchParams.get("Expires") || "").trim();
      if (!/^\d+$/.test(expRaw)) return NaN;
      const exp = Number(expRaw);
      if (!Number.isFinite(exp) || exp <= 0) return NaN;
      return exp - Math.floor(Date.now() / 1000);
    } catch (_) {
      return NaN;
    }
  }

  function buildCartaOrthoDirectUrl(projectId, snapshotId, fileName) {
    const pid = String(projectId || "").trim();
    const sid = String(snapshotId || "").trim();
    const fn = String(fileName || "").trim();
    if (!pid || !sid || !fn) return "";
    const tok = normalizeMeissaAccessToken(meissaAccess);
    const base = `https://cs.carta.is/carta/workspace/${encodeURIComponent(pid)}/${encodeURIComponent(sid)}/export/orthophoto/${encodeURIComponent(fn)}`;
    if (!tok) return base;
    return `${base}?access_token=${encodeURIComponent(tok)}`;
  }

  function _scoreMeissaOrthoButtonUrl(url) {
    const s = String(url || "").trim();
    const lu = s.toLowerCase();
    let score = 0;
    if (lu.includes("/export/orthophoto/")) score += 50;
    // 버튼 URL은 디코더 안정성이 높은 PNG만 우선한다.
    if (!/\.png(?:\?|$)/i.test(lu)) return -1000;
    // 품질 우선: 확대 선명도를 위해 장변이 큰 정사 PNG를 더 높게 점수화.
    if (lu.includes("orthophoto_25000x.png")) score += 360;
    else if (lu.includes("orthophoto_12000x.png")) score += 240;
    else if (lu.includes("orthophoto_7000x.png")) score += 150;
    else if (lu.includes("orthophoto_700x.png")) score += 80;
    else if (lu.includes("orthophoto")) {
      score += 10;
    }
    const nominalEdge = meissa2dOrthoNominalLongEdgeFromImgSrc(s);
    if (Number.isFinite(nominalEdge) && nominalEdge > 0) {
      // 파일명·쿼리에 장변 정보가 있으면 최종 선택에서 해상도 우선이 되도록 보너스 부여.
      score += Math.min(520, Math.round(nominalEdge / 60));
    }
    if (lu.includes("signature=") && lu.includes("expires=")) score += 30;
    const remain = meissaSignedUrlExpiresInSec(s);
    if (Number.isFinite(remain)) {
      if (remain < 20) score -= 400;
      else if (remain < 90) score -= 120;
    }
    return score;
  }

  function pickMeissaOrthoButtonUrls(resources) {
    const rows = Array.isArray(resources) ? resources : [];
    const urlSet = new Set();
    for (const r of rows.slice(0, 48)) {
      collectMeissaHttpUrlsFromPayload(r, urlSet, 0);
      if (r && typeof r === "object" && r.raw && typeof r.raw === "object") {
        collectMeissaHttpUrlsFromPayload(r.raw, urlSet, 0);
      }
    }
    const urls = Array.from(urlSet);
    if (!urls.length) return [];
    const scored = urls
      .map((u) => {
        const s = normalizeMeissaSignedUrl(u);
        const score = _scoreMeissaOrthoButtonUrl(s);
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.s);
  }

  function pickBestMeissaOrthoButtonUrlForSharpness(urls) {
    const list = Array.isArray(urls) ? urls : [];
    let best = "";
    let bestEdge = -1;
    let bestScore = -Infinity;
    for (const raw of list) {
      const s = normalizeMeissaSignedUrl(raw);
      if (!s) continue;
      const edge = Number(meissa2dOrthoNominalLongEdgeFromImgSrc(s)) || 0;
      const score = Number(_scoreMeissaOrthoButtonUrl(s)) || 0;
      if (
        edge > bestEdge + 1e-6 ||
        (Math.abs(edge - bestEdge) <= 1e-6 && score > bestScore)
      ) {
        best = s;
        bestEdge = edge;
        bestScore = score;
      }
    }
    return best;
  }

  async function resolveMeissaOrthoButtonUrls(snapshotId, projectId) {
    const sid = String(snapshotId || "").trim();
    const pid = String(projectId || "").trim();
    if (!sid || !meissaAccess) return [];
    let resources = [];
    try {
      if (
        state.meissaActiveSnapshotId === sid &&
        Array.isArray(state.meissaSnapshotResources) &&
        state.meissaSnapshotResources.length
      ) {
        resources = state.meissaSnapshotResources;
      } else {
        const data = await meissaJson(`/api/meissa/snapshots/${encodeURIComponent(sid)}/resources`, {
          headers: { Authorization: `JWT ${meissaAccess}` },
        });
        resources = Array.isArray(data?.resources) ? data.resources : [];
      }
    } catch (_) {
      resources = [];
    }
    const fromResources = pickMeissaOrthoButtonUrls(resources);
    const guessed = [
      buildCartaOrthoDirectUrl(pid, sid, "orthophoto_7000x.png"),
      buildCartaOrthoDirectUrl(pid, sid, "orthophoto_12000x.png"),
      buildCartaOrthoDirectUrl(pid, sid, "orthophoto_25000x.png"),
      buildCartaOrthoDirectUrl(pid, sid, "orthophoto_700x.png"),
    ].filter(Boolean);
    const all = [];
    const seen = new Set();
    for (const u of [...guessed, ...fromResources]) {
      const s = normalizeMeissaSignedUrl(u);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      all.push(s);
    }
    all.sort((a, b) => _scoreMeissaOrthoButtonUrl(b) - _scoreMeissaOrthoButtonUrl(a));
    return all;
  }

  async function loadMeissa2dSingleHighFromButtonUrl(imgEl, signedUrl, loadSeq, sid, options) {
    if (!imgEl) return { ok: false };
    if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
    const src = normalizeMeissaSignedUrl(signedUrl);
    if (!src) return { ok: false };
    const timeoutMs = Math.max(
      20000,
      Number(options?.timeoutMs) || MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_LOAD_TIMEOUT_MS
    );
    meissa2dOrthoApplyWrapLoadingPhase("loading");
    meissa2dOrthoInteractReady = false;
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
      const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      pushMeissa2dLoadLine(`정사: 버튼 URL 다운로드 진행중… ${sec}s 경과`);
    }, 5000);
    try {
      const remainSec = meissaSignedUrlExpiresInSec(src);
      if (Number.isFinite(remainSec)) {
        pushMeissa2dLoadLine(
          `정사: 버튼 URL 만료까지 약 ${Math.max(0, Math.round(remainSec))}s`
        );
      }
      pushMeissa2dLoadLine("정사: 버튼 URL 응답 대기 중(브라우저 직접 다운로드)");
      const reqSetAt = Date.now();
      const timeoutMs = Math.max(25000, Number(MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_LOAD_TIMEOUT_MS) || 95000);
      const decoded = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            window.clearTimeout(tm);
          } catch (_) {
            /* ignore */
          }
          try {
            imgEl.removeEventListener("load", onLoad);
            imgEl.removeEventListener("error", onErr);
          } catch (_) {
            /* ignore */
          }
          resolve(Boolean(ok));
        };
        const onLoad = () => finish(Number(imgEl.naturalWidth || 0) > 0);
        const onErr = () => finish(false);
        const tm = window.setTimeout(() => {
          try {
            pushMeissa2dLoadLine(
              `정사: 버튼 URL 다운로드 제한시간(${Math.round(timeoutMs / 1000)}s) 초과 — 현재 요청 중단 후 실패 처리`
            );
          } catch (_) {
            /* ignore */
          }
          try {
            imgEl.src = "";
          } catch (_) {
            /* ignore */
          }
          finish(false);
        }, timeoutMs);
        imgEl.addEventListener("load", onLoad);
        imgEl.addEventListener("error", onErr);
        try {
          setMeissa2dRawUrlForSnapshot(String(sid).trim(), src);
          imgEl.setAttribute("data-meissa-2d-ortho-tier", "full");
          imgEl.setAttribute("data-meissa-2d-source", "orthophoto-button-url");
          imgEl.src = src;
        } catch (_) {
          finish(false);
        }
      });
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
      if (!decoded) {
        pushMeissa2dLoadLine(
          `정사: 버튼 URL 로드는 시도했지만 화면 디코드에 실패했습니다.${src.includes("&amp;") ? " (URL 인코딩 문자열 확인 필요: &amp;)" : ""}`
        );
        meissa2dOrthoApplyWrapLoadingPhase("idle");
        return { ok: false };
      }
      pushMeissa2dLoadLine(
        `정사: 버튼 URL 응답+디코드 완료 ${Math.max(1, Math.round((Date.now() - reqSetAt) / 1000))}s`
      );
      meissa2dOrthoInteractReady = true;
      meissa2dOrthoApplyWrapLoadingPhase("idle");
      const srcKind = getMeissa2dImageDataSource(imgEl) || "unknown";
      const georefMode = useFullGeorefForOverlayImage(imgEl) ? "full" : "tile";
      pushMeissa2dLoadLine(
        `정사: 버튼 URL 화면 반영 완료 ${Math.round(Number(imgEl.naturalWidth || 0))}×${Math.round(Number(imgEl.naturalHeight || 0))}`
      );
      pushMeissa2dLoadLine(`정사: 소스 판별 ${srcKind} · georef ${georefMode}`);
      void meissa2dPrimeAnalysisImageFromDisplayedSrc("button-url");
      return { ok: true };
    } finally {
      try {
        window.clearInterval(ticker);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function loadMeissa2dSingleHighFromUnifiedApi(imgEl, apiUrl, loadSeq, sid, options) {
    if (!imgEl) return { ok: false };
    if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
    const src = String(apiUrl || "").trim();
    if (!src) return { ok: false };
    const timeoutMs = Math.max(30000, Number(options?.timeoutMs) || 180000);
    meissa2dOrthoApplyWrapLoadingPhase("loading");
    meissa2dOrthoInteractReady = false;
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
      const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      pushMeissa2dLoadLine(`정사: 단일 WEBP 다운로드 진행중… ${sec}s 경과`);
    }, 5000);
    try {
      pushMeissa2dLoadLine("정사: 단일 WEBP 응답 대기 중(브라우저 직접 다운로드)");
      const reqSetAt = Date.now();
      const decoded = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            window.clearTimeout(tm);
          } catch (_) {
            /* ignore */
          }
          try {
            imgEl.removeEventListener("load", onLoad);
            imgEl.removeEventListener("error", onErr);
          } catch (_) {
            /* ignore */
          }
          resolve(Boolean(ok));
        };
        const onLoad = () => finish(Number(imgEl.naturalWidth || 0) > 0);
        const onErr = () => finish(false);
        const tm = window.setTimeout(() => {
          try {
            pushMeissa2dLoadLine(
              `정사: 단일 WEBP 제한시간(${Math.round(timeoutMs / 1000)}s) 초과 — 현재 요청 중단`
            );
          } catch (_) {
            /* ignore */
          }
          finish(false);
        }, timeoutMs);
        imgEl.addEventListener("load", onLoad);
        imgEl.addEventListener("error", onErr);
        try {
          setMeissa2dRawUrlForSnapshot(String(sid || "").trim(), src);
          imgEl.setAttribute("data-meissa-2d-ortho-tier", "full");
          imgEl.setAttribute("data-meissa-2d-source", "orthophoto-preview");
          imgEl.src = src;
        } catch (_) {
          finish(false);
        }
      });
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
      if (!decoded) {
        pushMeissa2dLoadLine("정사: 단일 WEBP 로드는 시도했지만 화면 디코드에 실패했습니다.");
        meissa2dOrthoApplyWrapLoadingPhase("idle");
        return { ok: false };
      }
      pushMeissa2dLoadLine(
        `정사: 단일 WEBP 응답+디코드 완료 ${Math.max(1, Math.round((Date.now() - reqSetAt) / 1000))}s`
      );
      meissa2dOrthoInteractReady = true;
      meissa2dOrthoApplyWrapLoadingPhase("idle");
      pushMeissa2dLoadLine(
        `정사: 단일 WEBP 화면 반영 완료 ${Math.round(Number(imgEl.naturalWidth || 0))}×${Math.round(Number(imgEl.naturalHeight || 0))}`
      );
      return { ok: true };
    } finally {
      try {
        window.clearInterval(ticker);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function loadMeissa2dSingleHighWithProgress(imgEl, urlHigh, loadSeq, sid) {
    if (!imgEl) return { ok: false };
    if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
    meissa2dOrthoApplyWrapLoadingPhase("loading");
    meissa2dOrthoInteractReady = false;
    const highUrl = String(urlHigh || "").trim();
    if (!highUrl) return { ok: false };
    const startedAt = Date.now();
    let tick = 0;
    const ticker = window.setInterval(() => {
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
      tick += 1;
      const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      pushMeissa2dLoadLine(`정사: 고화질 다운로드 진행중… ${sec}s 경과`);
      if (tick >= 120) {
        try {
          window.clearInterval(ticker);
        } catch (_) {
          /* ignore */
        }
      }
    }, 5000);
    try {
      const blob = await fetchOrthoMainHighBlobWithProgress(
        highUrl,
        MEISSA_ORTHOPHOTO_HIGH_FETCH_MS,
        () => {}
      );
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
      if (!blob || blob.size < 32) return { ok: false };
      pushMeissa2dLoadLine(
        `정사: 다운로드 완료 ${(blob.size / (1024 * 1024)).toFixed(1)}MB · 화면 반영 중…`
      );
      const objUrl = URL.createObjectURL(blob);
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
        try {
          URL.revokeObjectURL(objUrl);
        } catch (_) {
          /* ignore */
        }
        return { ok: false, stale: true };
      }
      setMeissa2dRawUrlForSnapshot(String(sid).trim(), objUrl);
      imgEl.setAttribute("data-meissa-2d-ortho-blob-tier", "1");
      imgEl.setAttribute("data-meissa-2d-ortho-tier", "full");
      const decoded = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            window.clearTimeout(tm);
          } catch (_) {
            /* ignore */
          }
          try {
            imgEl.removeEventListener("load", onLoad);
            imgEl.removeEventListener("error", onErr);
          } catch (_) {
            /* ignore */
          }
          resolve(Boolean(ok));
        };
        const onLoad = () => finish(Number(imgEl.naturalWidth || 0) > 0);
        const onErr = () => finish(false);
        const tm = window.setTimeout(() => finish(false), 180000);
        imgEl.addEventListener("load", onLoad);
        imgEl.addEventListener("error", onErr);
        try {
          imgEl.src = objUrl;
        } catch (_) {
          finish(false);
        }
      });
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return { ok: false, stale: true };
      if (!decoded) {
        pushMeissa2dLoadLine("정사: 다운로드는 완료됐지만 화면 디코드에 실패했습니다.");
        meissa2dOrthoApplyWrapLoadingPhase("idle");
        return { ok: false };
      }
      meissa2dOrthoInteractReady = true;
      meissa2dOrthoApplyWrapLoadingPhase("idle");
      pushMeissa2dLoadLine(
        `정사: 화면 반영 완료 ${Math.round(Number(imgEl.naturalWidth || 0))}×${Math.round(Number(imgEl.naturalHeight || 0))}`
      );
      return { ok: true };
    } catch (_) {
      meissa2dOrthoApplyWrapLoadingPhase("idle");
      return { ok: false };
    } finally {
      try {
        window.clearInterval(ticker);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function firstReachableTile(candidates, options) {
    const timeoutMs = Math.max(400, Number(options?.timeoutMs) || 900);
    const batchSize = Math.max(1, Number(options?.batchSize) || 6);
    const maxChecks = Math.max(1, Number(options?.maxChecks) || candidates.length || 1);
    let idx = 0;
    let checked = 0;
    while (idx < candidates.length && checked < maxChecks) {
      const batch = candidates.slice(idx, idx + batchSize);
      idx += batchSize;
      checked += batch.length;
      const winner = await new Promise((resolve) => {
        let left = batch.length;
        let done = false;
        if (!left) {
          resolve(null);
          return;
        }
        batch.forEach((c) => {
          probeImageUrl(c.url, timeoutMs)
            .then((ok) => {
              if (done) return;
              if (ok) {
                done = true;
                resolve(c);
                return;
              }
              left -= 1;
              if (left <= 0 && !done) resolve(null);
            })
            .catch(() => {
              left -= 1;
              if (left <= 0 && !done) resolve(null);
            });
        });
      });
      if (winner) return winner;
    }
    return null;
  }

  async function loadMeissa2dOverlayByCartaTileFallback(snapshotId, options) {
    options = options || {};
    const img = els.meissaCloud2dImageLocal;
    if (!img) return false;
    const sid = String(snapshotId || "").trim();
    if (!sid) return false;
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    if (!projectId) return false;
    const z = 20;
    const centerList = candidateTileCenters(projectId, { strictAbsolute: Boolean(options?.strictAbsolute) });
    const offsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
      [3, 0],
      [-3, 0],
      [0, 3],
      [0, -3],
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
      [5, 0],
      [-5, 0],
      [0, 5],
      [0, -5],
    ];
    const candidates = [];
    for (const [cx, cy] of centerList) {
      for (const [dx, dy] of offsets) {
        const tx = cx + dx;
        const ty = cy + dy;
        candidates.push({
          x: tx,
          y: ty,
          z,
          url: buildMeissaCartaTileUrl(projectId, sid, z, tx, ty),
        });
      }
    }
    const winner = await firstReachableTile(candidates, options);
    if (winner) {
      meissa2dFallbackTileCenter = { x: winner.x, y: winner.y };
      if (!options?.strictAbsolute) saveMeissaTileHint(projectId, winner.x, winner.y, winner.z);
      meissa2dSnapshotTileHints[`${projectId}:${sid}`] = {
        x: Number(winner.x),
        y: Number(winner.y),
        z: Number(winner.z || 20),
      };
      const focus = getFocusCenterFromFileCoords();
      if (focus) {
        meissa2dSnapshotAnchors[`${projectId}:${sid}`] = {
          fx: Number(focus.x),
          fy: Number(focus.y),
          tx: Number(winner.x),
          ty: Number(winner.y),
          z: Number(winner.z || 20),
        };
      }
      // 기준 타일이 잡히면 주변 타일까지 즉시 다시 깔아서 "일부만 보임"을 줄인다.
      renderMeissa2dMosaic(sid, { z: winner.z || 20, radius: 3, centerX: winner.x, centerY: winner.y });
      img.src = winner.url;
      img.setAttribute("data-meissa-2d-ok", "1");
      img.setAttribute("data-meissa-2d-source", "carta-tile");
      updateMeissaDebugText(
        `${state.meissaResourceDebugText || ""}\n[2D] fallback=carta-tile snapshot=${sid} z=${winner.z} x=${winner.x} y=${winner.y}`
      );
      return true;
    }
    return false;
  }

  function summarizeOverlay2dDebug(debugObj) {
    const d = debugObj && typeof debugObj === "object" ? debugObj : null;
    if (!d) return "";
    const attempts = Array.isArray(d.attempts) ? d.attempts : [];
    const top = attempts.slice(0, 10);
    const rows = top.map((a, i) => {
      const rid = a?.resourceId != null ? `rid=${a.resourceId}` : "rid=-";
      const typ = a?.resourceType ? `type=${a.resourceType}` : "type=-";
      const ext = a?.ext ? `ext=${a.ext}` : "ext=-";
      const mime = a?.mime || a?.contentType || "-";
      const b = Number(a?.bytes || 0);
      const cl = Number(a?.contentLength || 0);
      const trunc = a?.truncated ? "Y" : "N";
      const rej = a?.reject || a?.error || (a?.accept ? "accepted" : "-");
      return `${i + 1}) ${rid} ${typ} ${ext} mime=${mime} bytes=${b}${cl ? `/${cl}` : ""} trunc=${trunc} reason=${rej}`;
    });
    const dropped = Number(d?.droppedAttempts || 0);
    if (dropped > 0) rows.push(`... (${dropped}개 시도 로그 생략)`);
    return rows.join("\n");
  }

  async function warmMeissaDomOverlayTilePath(snapshotId) {
    const sid = String(snapshotId || "").trim();
    if (!sid) return false;
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    if (!projectId || !meissaAccess) return false;
    try {
      const centers = candidateTileCenters(projectId, { strictAbsolute: true });
      const [cx, cy] = centers[0] || [];
      if (!Number.isFinite(Number(cx)) || !Number.isFinite(Number(cy))) return false;
      const z = 20;
      const candidates = [
        { url: buildMeissaCartaTileUrl(projectId, sid, z, Math.round(Number(cx)), Math.round(Number(cy))) },
        { url: buildMeissaCartaTileUrl(projectId, sid, z, Math.round(Number(cx) + 1), Math.round(Number(cy))) },
        { url: buildMeissaCartaTileUrl(projectId, sid, z, Math.round(Number(cx)), Math.round(Number(cy) + 1)) },
      ].filter((c) => String(c.url || "").trim());
      const winner = await firstReachableTile(candidates, {
        timeoutMs: 900,
        batchSize: 3,
        maxChecks: 3,
      });
      return Boolean(winner?.url);
    } catch (_) {
      return false;
    }
  }

  async function loadMeissa2dOverlayImage(snapshotId) {
    const img = els.meissaCloud2dImageLocal;
    if (!img) return false;
    clearMeissa2dLoadLog();
    pushMeissa2dLoadLine("2D 배경 로드 시작");
    pushMeissa2dLoadLine(
      `로더모드 direct=${MEISSA_ORTHOPHOTO_DIRECT_IMG_STREAM ? "on" : "off"} · singleHigh=${MEISSA_ORTHOPHOTO_SINGLE_HIGH_ONLY ? "on" : "off"} · unifiedWebp=${MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP ? "on" : "off"} · buttonOnly=${MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY ? "on" : "off"} · highRes=${MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES ? "off" : "on"} · viewportHi=${MEISSA_ORTHOPHOTO_DISABLE_VIEWPORT_HI ? "off" : "on"}`
    );
    const perfStartedAt = Date.now();
    let perfLastAt = perfStartedAt;
    let perfDoneOnce = false;
    const perfSteps = [];
    const perfMark = (label) => {
      const now = Date.now();
      const delta = now - perfLastAt;
      const total = now - perfStartedAt;
      perfLastAt = now;
      perfSteps.push({ label: String(label || ""), delta, total });
      pushMeissa2dLoadLine(
        `[성능] ${String(label || "step")} +${(delta / 1000).toFixed(1)}s (누적 ${(total / 1000).toFixed(1)}s)`
      );
    };
    const perfDone = (status) => {
      if (perfDoneOnce) return;
      perfDoneOnce = true;
      const totalMs = Date.now() - perfStartedAt;
      const top = [...perfSteps].sort((a, b) => b.delta - a.delta).slice(0, 3);
      const topText = top.length
        ? top.map((x) => `${x.label}:${(x.delta / 1000).toFixed(1)}s`).join(" | ")
        : "표시 단계 없음";
      pushMeissa2dLoadLine(
        `[성능] ${String(status || "종료")} · 총 ${(totalMs / 1000).toFixed(1)}s · 병목 ${topText}`
      );
    };
    const sid = String(snapshotId || "").trim();
    void warmMeissaDomOverlayTilePath(sid);
    pushMeissa2dLoadLine(sid ? `스냅샷 ${sid}` : "스냅샷 미선택");
    if (String(meissa2dPointTileCacheSid) !== sid) {
      meissa2dPointTileCache.clear();
      meissa2dPointTileCacheSid = sid;
    } else if (meissa2dPointTileCache.size > 120000) {
      meissa2dPointTileCache.clear();
    }
    meissa2dLoadSeq += 1;
    const loadSeq = meissa2dLoadSeq;
    clearMeissa2dOrthoViewportHi();
    clearMeissa2dOrthoViewportHiTileCache();
    clearMeissa2dPendingTimers();
    try {
      img.__pilexyOrthoBindSeq = loadSeq;
      img.__pilexyOrthoBindSid = String(sid || "").trim();
      img.removeAttribute("data-meissa-2d-intrinsic-layout");
      img.__pilexyOrthoIntrinsicRetryPending = false;
      img.__pilexyOrthoIntrinsicTimerRetries = 0;
      meissa2dOrthoApplyWrapLoadingPhase("loading");
    } catch (_) {
      /* ignore */
    }
    const projectId =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    // 대체뷰: 예전 모드에서만 별도 고화질 버튼 URL을 선해결(JPEG/WebP 대체뷰는 API fmt 로 처리).
    if (
      MEISSA_2D_SIMPLE_ORTHO &&
      projectId &&
      sid &&
      meissaAccess &&
      !MEISSA_DOM_OVERLAY_MIRROR_MAIN_IMAGE &&
      !meissaDomOverlayUsesLossyApiPreview()
    ) {
      void ensureMeissaDomOverlayHiUrl();
    }
    const snapKey = `${projectId}:${sid}`;
    const hasUsableGeoref = () => {
      const gg = meissa2dGeorefBySnapshot[snapKey];
      const bb = gg?.bbox;
      return Boolean(
        bb &&
          Number.isFinite(Number(bb.minX)) &&
          Number.isFinite(Number(bb.minY)) &&
          Number.isFinite(Number(bb.maxX)) &&
          Number.isFinite(Number(bb.maxY)) &&
          Number(bb.maxX) > Number(bb.minX) &&
          Number(bb.maxY) > Number(bb.minY)
      );
    };
    const preferGeorefImage = () => Boolean(hasUsableGeoref());
    const applyPreferred2dVisibility = () => {
      const hasImg = hasRenderableOverlayImage(img);
      if (MEISSA_2D_SIMPLE_ORTHO) {
        // 심플 모드도 타일 피라미드를 기본 표시로 사용한다.
        setMeissa2dLayerVisibility({ showMosaic: true, showImage: hasImg });
        return;
      }
      if (preferGeorefImage()) {
        setMeissa2dLayerVisibility({ showMosaic: !hasImg, showImage: hasImg });
      } else {
        setMeissa2dLayerVisibility({ showMosaic: true, showImage: false });
      }
    };
    /** 옛날 흐름처럼: 심플 모드에서는 orthophoto 요청을 지오 조회 전에 선시작(병렬) */
    let orthoPrecachePromise = null;
    if (MEISSA_2D_SIMPLE_ORTHO && projectId && sid && meissaAccess) {
      try {
        if (!isMeissa2dButtonUrlOnlySingleMode() && !MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP) {
          const orthoUrlParallel = MEISSA_ORTHOPHOTO_USE_LEGACY_API_URL
            ? buildOrthophotoPreviewApiUrl(sid, projectId, MEISSA_ORTHOPHOTO_LEGACY_LOW_EDGE)
            : buildOrthophotoPreviewApiUrl(sid, projectId, MEISSA_ORTHOPHOTO_FULL_MAX_EDGE);
          orthoPrecachePromise = fetchWithTimeout(
            orthoUrlParallel,
            { headers: { Authorization: `JWT ${meissaAccess}` } },
            MEISSA_ORTHOPHOTO_PREVIEW_FETCH_MS
          );
          pushMeissa2dLoadLine("정사 서버 요청 선시작(지오 조회와 병렬)");
        } else if (MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP) {
          pushMeissa2dLoadLine("정사 단일 경로: 버튼 PNG→서버 WEBP 캐시 API만 사용");
        } else {
          pushMeissa2dLoadLine("버튼 URL 단일 모드: orthophoto-preview 선요청 생략");
        }
      } catch (_) {
        orthoPrecachePromise = null;
      }
    }
    if (!sid || !meissaAccess) {
      pushMeissa2dLoadLine("중단: 스냅샷 또는 JWT 없음");
      perfDone("중단(스냅샷/JWT 없음)");
      clearMeissa2dOrthoViewportHi();
      meissa2dOrthoInteractReady = false;
      img.removeAttribute("src");
      setMeissa2dLayerVisibility({ showMosaic: false, showImage: false });
      return false;
    }
    state.meissa2dLoadFailHint = "";
    // 이미 큰 원본을 받은 스냅샷이라도 좌표 정합/디테일 갱신은 타일 모자이크를 기준으로 유지한다.
    let cachedRaw = meissa2dRawUrlBySnapshot.get(sid);
    if (cachedRaw && meissa2dOrthophotoUrlIsButtonExport(cachedRaw)) {
      pushMeissa2dLoadLine("세션 캐시(raw) 버튼 URL은 줌 블러 가능성이 있어 재요청합니다.");
      try {
        meissa2dRawUrlBySnapshot.delete(sid);
      } catch (_) {
        /* ignore */
      }
      cachedRaw = null;
    }
    if (cachedRaw && meissa2dOrthophotoUrlIsSubFullTier(cachedRaw)) {
      pushMeissa2dLoadLine(
        `세션 캐시가 저해상(max_edge<${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE}) URL이라 무시하고 고해상으로 다시 받습니다.`
      );
      try {
        meissa2dRawUrlBySnapshot.delete(sid);
      } catch (_) {
        /* ignore */
      }
      cachedRaw = null;
    }
    if (cachedRaw && meissa2dImageLikelyDownsampledByBrowser(cachedRaw, img)) {
      pushMeissa2dLoadLine(
        "세션 캐시(raw) 이미지가 URL 기대 해상도 대비 낮게 디코드되어 재요청합니다(줌 블러 완화)."
      );
      try {
        meissa2dRawUrlBySnapshot.delete(sid);
      } catch (_) {
        /* ignore */
      }
      cachedRaw = null;
    }
    if (cachedRaw && meissa2dSignedUrlIsExpired(cachedRaw)) {
      pushMeissa2dLoadLine("세션 캐시(raw) URL 만료(Expires)로 재요청합니다.");
      try {
        meissa2dRawUrlBySnapshot.delete(sid);
      } catch (_) {
        /* ignore */
      }
      cachedRaw = null;
    }
    if (cachedRaw) {
      pushMeissa2dLoadLine("이번 세션 캐시(raw) URL 재사용");
      perfMark("세션 캐시 URL 재사용");
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
      img.onload = onMeissa2dOverlayImgDecoded;
      const cachedDecoded = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            window.clearTimeout(tm);
          } catch (_) {
            /* ignore */
          }
          try {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onErr);
          } catch (_) {
            /* ignore */
          }
          resolve(Boolean(ok));
        };
        const onLoad = () => finish(Number(img.naturalWidth || 0) > 0);
        const onErr = () => finish(false);
        const tm = window.setTimeout(() => finish(false), 15000);
        img.addEventListener("load", onLoad);
        img.addEventListener("error", onErr);
        try {
          img.src = cachedRaw;
        } catch (_) {
          finish(false);
        }
      });
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
      if (!cachedDecoded) {
        pushMeissa2dLoadLine("세션 캐시(raw) 로드 실패(만료/깨짐 가능) → 캐시 폐기 후 재요청");
        try {
          meissa2dRawUrlBySnapshot.delete(sid);
        } catch (_) {
          /* ignore */
        }
        try {
          img.removeAttribute("src");
          img.setAttribute("data-meissa-2d-ok", "0");
        } catch (_) {
          /* ignore */
        }
        cachedRaw = null;
      } else {
        img.setAttribute("data-meissa-2d-ok", "1");
        img.setAttribute("data-meissa-2d-source", "raw-cache");
      }
    }
    if (cachedRaw) {
      meissa2dEnsureOrthoAnalysisImage();
      if (!projectId) return false;
      const snapKey = `${projectId}:${sid}`;
      const snapHint = meissa2dSnapshotTileHints[snapKey];
      const fc = focusToTileCenter(projectId, Number(meissa2dTileState.z || 20));
      if (fc) meissa2dFallbackTileCenter = { x: Number(fc.x), y: Number(fc.y) };
      else if (snapHint && Number.isFinite(Number(snapHint.x)) && Number.isFinite(Number(snapHint.y))) {
        meissa2dFallbackTileCenter = { x: Number(snapHint.x), y: Number(snapHint.y) };
      }
      if (!MEISSA_2D_SIMPLE_ORTHO) {
        const r = computeMosaicRadiusForScale(1);
        renderMeissa2dMosaic(sid, { z: Number(meissa2dTileState.z || 20), radius: r });
      } else {
        syncMeissa2dSquareMapFrameLayout();
      }
      applyPreferred2dVisibility();
      pushMeissa2dLoadLine("캐시 경로 완료 · 뷰 리셋");
      if (!MEISSA_2D_SIMPLE_ORTHO) {
        resetMeissa2dViewTransform();
      } else {
        scheduleMeissa2dOrthoViewportHiFetch();
      }
      perfDone("완료(세션 캐시)");
      return true;
    }

    let orthoImgLoadPromise = null;
    let buttonOnlyAllowFallbackViews = false;
    if (MEISSA_2D_SIMPLE_ORTHO && projectId && sid && meissaAccess && MEISSA_ORTHOPHOTO_DIRECT_IMG_STREAM) {
      try {
        img.removeAttribute("data-meissa-2d-ortho-tier");
      } catch (_) {
        // ignore
      }
      try {
        img.decoding = "async";
        img.loading = "eager";
      } catch (_) {
        // ignore
      }
      try {
        img.fetchPriority = "high";
      } catch (_) {
        /* ignore */
      }
      const urlPreviewTier = buildOrthophotoPreviewImgUrl(
        sid,
        projectId,
        meissaAccess,
        MEISSA_ORTHOPHOTO_PREVIEW_EDGE
      );
      const urlHiOnly = buildOrthophotoPreviewImgUrl(
        sid,
        projectId,
        meissaAccess,
        MEISSA_ORTHOPHOTO_FULL_MAX_EDGE
      );
      const urlSplashTier = buildOrthophotoPreviewImgUrl(
        sid,
        projectId,
        meissaAccess,
        MEISSA_ORTHOPHOTO_SPLASH_EDGE
      );
      if (MEISSA_ORTHOPHOTO_DISABLE_HIGH_RES) {
        orthoImgLoadPromise = waitMeissa2dOrthoImage(
          img,
          urlPreviewTier,
          loadSeq,
          sid,
          urlPreviewTier,
          ""
        );
        pushMeissa2dLoadLine(
          `정사: 단일 요청 max_edge=${MEISSA_ORTHOPHOTO_PREVIEW_EDGE} (고해상 비활성)`
        );
      } else if (MEISSA_ORTHOPHOTO_SINGLE_HIGH_ONLY) {
        if (MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP) {
          const unifiedWebpUrl = buildOrthophotoPreviewImgUrl(
            sid,
            projectId,
            meissaAccess,
            MEISSA_ORTHOPHOTO_UNIFIED_EDGE,
            MEISSA_ORTHOPHOTO_UNIFIED_FMT
          );
          orthoImgLoadPromise = loadMeissa2dSingleHighFromUnifiedApi(
            img,
            unifiedWebpUrl,
            loadSeq,
            sid,
            { timeoutMs: MEISSA_ORTHOPHOTO_HIGH_FETCH_MS }
          );
          pushMeissa2dLoadLine(
            `정사: 단일 요청(버튼 PNG→서버 ${String(MEISSA_ORTHOPHOTO_UNIFIED_FMT || "webp").toUpperCase()} 캐시 · max_edge=${MEISSA_ORTHOPHOTO_UNIFIED_EDGE})`
          );
        } else {
          perfMark("버튼 URL 조회 시작");
          const signedOrthoUrls = await resolveMeissaOrthoButtonUrls(sid, projectId);
          perfMark("버튼 URL 조회 완료");
          const orderedCandidates = Array.isArray(signedOrthoUrls)
            ? signedOrthoUrls.map((u) => String(u || "").trim()).filter(Boolean)
            : [];
          let tryUrls = [];
          if (orderedCandidates.length) {
            try {
              const probePool = orderedCandidates
                .slice(0, Math.min(6, orderedCandidates.length))
                .map((url) => ({ url }));
              const winner = await firstReachableTile(probePool, {
                timeoutMs: MEISSA_ORTHOPHOTO_BUTTON_URL_PROBE_MS,
                batchSize: Math.min(3, probePool.length || 1),
                maxChecks: probePool.length || 1,
              });
              const wu = String(winner?.url || "").trim();
              if (wu) {
                tryUrls.push(wu);
                pushMeissa2dLoadLine("정사: 버튼 URL 선확인 성공(빠른 응답 URL 우선 사용)");
              }
            } catch (_) {
              // ignore probe failures; keep ordered fallback list
            }
            for (const u of orderedCandidates) {
              if (!u || tryUrls.includes(u)) continue;
              tryUrls.push(u);
              if (tryUrls.length >= Math.max(1, MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_MAX_TRIES)) break;
            }
          }
          if (tryUrls.length) {
            orthoImgLoadPromise = (async () => {
              for (let i = 0; i < tryUrls.length; i++) {
                const u = String(tryUrls[i] || "").trim();
                if (!u) continue;
                const fn = (() => {
                  try {
                    const p = new URL(u, window.location.origin).pathname || "";
                    const idx = p.lastIndexOf("/");
                    return idx >= 0 ? p.slice(idx + 1) : p;
                  } catch (_) {
                    return "orthophoto";
                  }
                })();
                const expectedEdge = Math.round(Number(meissa2dOrthoNominalLongEdgeFromImgSrc(u)) || 0);
                pushMeissa2dLoadLine(
                  `정사: 버튼 URL 시도 ${i + 1}/${tryUrls.length} (${fn || "orthophoto"}${expectedEdge > 0 ? ` · 기대 장변≈${expectedEdge}px` : ""})`
                );
                const r = await loadMeissa2dSingleHighFromButtonUrl(img, u, loadSeq, sid, {
                  timeoutMs:
                    i === 0
                      ? MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_LOAD_TIMEOUT_MS
                      : Math.max(26000, Math.round(MEISSA_ORTHOPHOTO_BUTTON_URL_SINGLE_LOAD_TIMEOUT_MS * 0.55)),
                });
                if (r && r.ok) return r;
              }
              return { ok: false, message: "button-url-all-candidates-failed" };
            })();
            pushMeissa2dLoadLine(
              `정사: 단일 요청(버튼 URL 후보 ${tryUrls.length}개 내 순차 재시도 · orthophoto-preview 미사용)`
            );
          } else if (MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY) {
            orthoImgLoadPromise = Promise.resolve({ ok: false, message: "button-url-not-found" });
            pushMeissa2dLoadLine("정사: 버튼 URL(orthophoto_25000x.png)을 찾지 못해 중단");
          } else {
            orthoImgLoadPromise = loadMeissa2dSingleHighWithProgress(img, urlHiOnly, loadSeq, sid);
            pushMeissa2dLoadLine(
              `정사: 단일 요청 max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE} (고화질 단일 모드)`
            );
          }
        }
      } else {
        orthoImgLoadPromise = waitMeissa2dOrthoImage(
          img,
          urlPreviewTier,
          loadSeq,
          sid,
          urlHiOnly,
          urlSplashTier
        );
        pushMeissa2dLoadLine(
          `정사: 선표시 max_edge=${MEISSA_ORTHOPHOTO_SPLASH_EDGE} → 본 max_edge=${MEISSA_ORTHOPHOTO_PREVIEW_EDGE} → 이어서 고해상 max_edge=${MEISSA_ORTHOPHOTO_FULL_MAX_EDGE}`
        );
      }
    }
    let orthoParallelResult = { ok: false, skip: true };
    if (projectId && sid) {
      try {
        const buttonOnlyMode = isMeissa2dButtonUrlOnlySingleMode();
        if (buttonOnlyMode && orthoImgLoadPromise) {
          const parts = await Promise.all([
            loadMeissa2dGeoref(sid, projectId).catch(() => {}),
            detectGeoConfigForSnapshot(projectId, sid).catch(() => {}),
            orthoImgLoadPromise,
          ]);
          orthoParallelResult = parts[2] && typeof parts[2] === "object" ? parts[2] : { ok: false };
          perfMark("georef·지오설정·버튼URL 병렬 완료");
          if (!orthoParallelResult?.ok) {
            buttonOnlyAllowFallbackViews = false;
            pushMeissa2dLoadLine("정사: 버튼 URL 단일 경로 실패 — 추가 폴백 없이 중단합니다.");
          }
        } else {
          const oP = orthoImgLoadPromise || Promise.resolve({ ok: false, skip: true });
          const parts = await Promise.all([
            loadMeissa2dGeoref(sid, projectId).catch(() => {}),
            detectGeoConfigForSnapshot(projectId, sid).catch(() => {}),
            oP,
          ]);
          orthoParallelResult = parts[2] && typeof parts[2] === "object" ? parts[2] : { ok: false };
          perfMark("georef·지오설정·정사 병렬 완료");
        }
      } catch (_) {
        // ignore
      }
    }
    pushMeissa2dLoadLine("georef·지오설정 조회 완료");

    if (!MEISSA_2D_SIMPLE_ORTHO) {
      resetMeissa2dViewTransform();
    }
    if (MEISSA_2D_SIMPLE_ORTHO) {
      scheduleMeissa2dOrthoViewportHiFetch();
    }
    let quickMosaic = false;
    const enableTileMosaicNow =
      !MEISSA_2D_SIMPLE_ORTHO || (MEISSA_2D_SIMPLE_ORTHO && MEISSA_2D_SIMPLE_TILE_FIRST_MODE);
    if (enableTileMosaicNow) {
      const snapHint = meissa2dSnapshotTileHints[snapKey];
      const focusCenter = focusToTileCenter(projectId, 20);
      const focusNow = getFocusCenterFromFileCoords();
      if (focusNow && !meissa2dSnapshotAnchors[snapKey] && snapHint) {
        meissa2dSnapshotAnchors[snapKey] = {
          fx: Number(focusNow.x),
          fy: Number(focusNow.y),
          tx: Number(snapHint.x),
          ty: Number(snapHint.y),
          z: Number(snapHint.z || 20),
        };
      }
      if (focusCenter) {
        meissa2dFallbackTileCenter = { x: Number(focusCenter.x), y: Number(focusCenter.y) };
      } else if (snapHint && Number.isFinite(Number(snapHint.x)) && Number.isFinite(Number(snapHint.y))) {
        meissa2dFallbackTileCenter = { x: Number(snapHint.x), y: Number(snapHint.y) };
      }
      const baseRadius = computeMosaicRadiusForScale(Math.max(1, Number(meissa2dViewScale) || 1));
      quickMosaic = Boolean(renderMeissa2dMosaic(sid, { z: 20, radius: baseRadius }));
      if (quickMosaic) {
        pushMeissa2dLoadLine("타일 모자이크(저해상) 선표시");
        applyPreferred2dVisibility();
        meissa2dPendingTimers.push(
          window.setTimeout(() => {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            renderMeissa2dMosaic(sid, { z: 20, radius: Math.min(14, baseRadius + 2) });
          }, 250)
        );
        meissa2dPendingTimers.push(
          window.setTimeout(() => {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            renderMeissa2dMosaic(sid, { z: 20, radius: Math.min(14, baseRadius + 3) });
          }, 900)
        );
        meissa2dPendingTimers.push(
          window.setTimeout(() => {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            renderMeissa2dMosaic(sid, { z: 20, radius: Math.min(14, baseRadius + 4) });
          }, 1800)
        );
      }
    } else {
      syncMeissa2dSquareMapFrameLayout();
      pushMeissa2dLoadLine("심플 모드: 레이아웃 동기화");
    }
    // Carta export orthophoto.tif → PNG. 심플 모드에서는 georef 없어도 시도(이미지만이라도 표시).
    let orthophotoOk = false;
    let orthophotoHttpStatus = null;
    let orthophotoErrSnip = "";
    const tryOrtho = Boolean(projectId && sid && (MEISSA_2D_SIMPLE_ORTHO || preferGeorefImage()));
    if (tryOrtho) {
      const simpleOrthoDirect =
        Boolean(MEISSA_2D_SIMPLE_ORTHO && orthoImgLoadPromise);
      if (simpleOrthoDirect) {
        pushMeissa2dLoadLine(
          "※ 정사: 서버 PNG를 브라우저가 직접 수신(추가 blob·재다운로드 없음)."
        );
        try {
          let displayReady =
            orthoParallelResult.ok &&
            isMeissa2dLoadCurrent(loadSeq, sid) &&
            img.complete &&
            img.naturalWidth > 0;
          if (
            !displayReady &&
            orthoParallelResult.ok &&
            !orthoParallelResult.stale &&
            isMeissa2dLoadCurrent(loadSeq, sid)
          ) {
            pushMeissa2dLoadLine("정사: 디코드 대기(고해상 전환 중일 수 있음)…");
            displayReady = await waitMeissa2dImgDecodeReady(img, loadSeq, sid, 180000);
          }
          if (displayReady && orthoParallelResult.ok && isMeissa2dLoadCurrent(loadSeq, sid)) {
            orthophotoOk = true;
            orthophotoHttpStatus = 200;
            img.setAttribute("data-meissa-2d-ok", "1");
            img.setAttribute("data-meissa-2d-source", "orthophoto-preview");
            meissa2dEnsureOrthoAnalysisImage();
            scheduleRenderMeissa2dPointsOverlay();
            {
              const tier = String(img.getAttribute("data-meissa-2d-ortho-tier") || "");
              if (tier === "preview") {
                pushMeissa2dLoadLine(
                  `정사: 미리보기만 반영된 상태 ${img.naturalWidth}×${img.naturalHeight} · 원본은 수신 후 로그·화면이 갱신됩니다`
                );
              } else {
                pushMeissa2dLoadLine(
                  `정사: 표시 완료 · ${img.naturalWidth}×${img.naturalHeight} (직접 로드)`
                );
              }
            }
          } else if (orthoParallelResult.stale) {
            pushMeissa2dLoadLine("정사: 스냅샷이 바뀌어 로드 결과를 건너뜀");
          } else {
            const nwRec = Number(img?.naturalWidth || 0);
            const nhRec = Number(img?.naturalHeight || 0);
            const imgDecodedOk =
              isMeissa2dLoadCurrent(loadSeq, sid) && nwRec > 1 && nhRec > 1;
            if (imgDecodedOk) {
              if (!orthoParallelResult.ok) {
                pushMeissa2dLoadLine(
                  "정사: 로드 플래그와 디코드 불일치 — 화면 정사 픽셀을 유지합니다(저해상·고해상 전환 레이스)"
                );
              }
              orthophotoOk = true;
              orthophotoHttpStatus = 200;
              img.setAttribute("data-meissa-2d-ok", "1");
              img.setAttribute("data-meissa-2d-source", "orthophoto-preview");
              meissa2dEnsureOrthoAnalysisImage();
              scheduleRenderMeissa2dPointsOverlay();
              pushMeissa2dLoadLine(
                `정사: 심플 표시 복구 ${nwRec}×${nhRec} (직접 로드·저해상 유지 가능)`
              );
            } else {
              orthophotoErrSnip = "img load error or empty";
              if (MEISSA_ORTHOPHOTO_UNIFIED_SERVER_WEBP) {
                pushMeissa2dLoadLine("정사: 단일 WEBP 로드 실패");
              } else {
                pushMeissa2dLoadLine("정사 <img> 로드 실패 · 폴백 시도");
              }
            }
          }
        } catch (e) {
          orthophotoErrSnip = e?.message || String(e);
          pushMeissa2dLoadLine(`정사 처리 예외: ${orthophotoErrSnip.slice(0, 100)}`);
        }
      } else {
        pushMeissa2dLoadLine("정사 orthophoto-preview 요청(fetch)…");
        pushMeissa2dLoadLine(
          "※ georef 경로: 서버 PNG 수신 후 blob 으로 표시합니다."
        );
        const orthoWaitStarted = Date.now();
        const orthoWaitTimer = window.setInterval(() => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
            clearInterval(orthoWaitTimer);
            return;
          }
          const sec = Math.round((Date.now() - orthoWaitStarted) / 1000);
          pushMeissa2dLoadLine(
            `정사 응답 대기 ${sec}s — 백엔드 로그·네트워크를 확인하거나 잠시만 기다려 주세요`
          );
        }, 35000);
        try {
          const orthoUrl = MEISSA_ORTHOPHOTO_USE_LEGACY_API_URL
            ? buildOrthophotoPreviewApiUrl(sid, projectId, MEISSA_ORTHOPHOTO_LEGACY_LOW_EDGE)
            : buildOrthophotoPreviewApiUrl(sid, projectId, MEISSA_ORTHOPHOTO_FULL_MAX_EDGE);
          const orthoRes = orthoPrecachePromise
            ? await orthoPrecachePromise
            : await fetchWithTimeout(
                orthoUrl,
                { headers: { Authorization: `JWT ${meissaAccess}` } },
                MEISSA_ORTHOPHOTO_PREVIEW_FETCH_MS
              );
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
          orthophotoHttpStatus = orthoRes.status;
          if (orthoRes.ok) {
            const blob = await orthoRes.blob();
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
            if (blob && blob.size > 32) {
              const objUrl = URL.createObjectURL(blob);
              if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
                URL.revokeObjectURL(objUrl);
                return false;
              }
              setMeissa2dRawUrlForSnapshot(sid, objUrl);
              img.src = objUrl;
              img.onload = onMeissa2dOverlayImgDecoded;
              img.setAttribute("data-meissa-2d-ok", "1");
              img.setAttribute("data-meissa-2d-source", "orthophoto-preview");
              meissa2dEnsureOrthoAnalysisImage();
              orthophotoOk = true;
              pushMeissa2dLoadLine(
                `정사 PNG 수신 ${(blob.size / (1024 * 1024)).toFixed(1)}MB · 이미지 적용`
              );
            } else {
              orthophotoErrSnip = `empty-blob size=${blob?.size || 0}`;
              pushMeissa2dLoadLine(`정사 PNG 빈 응답 (${orthophotoErrSnip})`);
            }
          } else {
            try {
              const j = await orthoRes.json();
              const d = j?.detail;
              orthophotoErrSnip =
                typeof d === "object" && d != null
                  ? JSON.stringify(d).slice(0, 320)
                  : String(d || j?.message || "").slice(0, 220);
            } catch (_) {
              orthophotoErrSnip = `http ${orthoRes.status}`;
            }
            pushMeissa2dLoadLine(
              `정사 PNG 실패 HTTP ${orthoRes.status} · ${orthophotoErrSnip.slice(0, 72)}`
            );
          }
        } catch (e) {
          orthophotoErrSnip = e?.message || String(e);
          pushMeissa2dLoadLine(`정사 PNG 예외: ${orthophotoErrSnip.slice(0, 100)}`);
        } finally {
          clearInterval(orthoWaitTimer);
        }
      }
    } else {
      pushMeissa2dLoadLine(
        !projectId
          ? "정사 PNG 미시도(프로젝트 미선택)"
          : "정사 PNG 미시도(georef 없음 · 타일/RAW 폴백)"
      );
    }
    if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
    if (!orthophotoOk && isMeissa2dButtonUrlOnlySingleMode()) {
      pushMeissa2dLoadLine("중단: 단일 버튼 URL 경로 실패(orthophoto-preview/RAW/JSON/Carta 폴백 미사용)");
      perfDone("실패(단일 버튼 URL 경로)");
      return false;
    }
    if (
      !orthophotoOk &&
      MEISSA_2D_SIMPLE_ORTHO &&
      projectId &&
      sid &&
      !isMeissa2dButtonUrlOnlySingleMode() &&
      !MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY
    ) {
      pushMeissa2dLoadLine("정사: orthophoto-preview 실패 → 버튼 URL 고화질 폴백 시도");
      try {
        const signedOrthoUrls = await resolveMeissaOrthoButtonUrls(sid, projectId);
        const tries = Array.isArray(signedOrthoUrls) ? signedOrthoUrls.slice(0, 8) : [];
        for (let i = 0; i < tries.length; i++) {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
          const u = String(tries[i] || "").trim();
          if (!u) continue;
          const fn = (() => {
            try {
              const p = new URL(u, window.location.origin).pathname || "";
              const idx = p.lastIndexOf("/");
              return idx >= 0 ? p.slice(idx + 1) : p;
            } catch (_) {
              return "orthophoto";
            }
          })();
          pushMeissa2dLoadLine(`정사: 버튼 URL 폴백 ${i + 1}/${tries.length} (${fn || "orthophoto"})`);
          const r = await loadMeissa2dSingleHighFromButtonUrl(img, u, loadSeq, sid);
          if (r && r.ok && isMeissa2dLoadCurrent(loadSeq, sid)) {
            orthophotoOk = true;
            orthophotoHttpStatus = 200;
            img.setAttribute("data-meissa-2d-ok", "1");
            img.setAttribute("data-meissa-2d-source", "orthophoto-button-url");
            meissa2dEnsureOrthoAnalysisImage();
            scheduleRenderMeissa2dPointsOverlay();
            pushMeissa2dLoadLine(
              `정사: 버튼 URL 폴백 성공 · ${Math.round(Number(img.naturalWidth || 0))}×${Math.round(Number(img.naturalHeight || 0))}`
            );
            break;
          }
        }
      } catch (e) {
        pushMeissa2dLoadLine(`정사: 버튼 URL 폴백 예외 ${String(e?.message || e).slice(0, 90)}`);
      }
    }
    if (orthophotoOk) {
      perfMark("정사 렌더 준비 완료");
      syncMeissa2dSquareMapFrameLayout();
      applyPreferred2dVisibility();
      {
        const tier = String(img.getAttribute("data-meissa-2d-ortho-tier") || "");
        if (tier === "preview") {
          pushMeissa2dLoadLine(
            "※ 원본(고해상) PNG 수신 중 — 완료 시 「완료: 정사 PNG 배경(원본 해상도)」가 이어집니다"
          );
        } else {
          pushMeissa2dLoadLine("완료: 정사 PNG 배경");
        }
      }
      perfDone("완료(정사)");
      return true;
    }
    if (isMeissa2dButtonUrlOnlySingleMode() || MEISSA_ORTHOPHOTO_BUTTON_URL_ONLY) {
      pushMeissa2dLoadLine("중단: 버튼 URL 고화질 단일 경로 실패(다른 경로 미사용)");
      setMeissa2dLayerVisibility({ showMosaic: false, showImage: false });
      perfDone("실패(버튼 URL 단일 경로)");
      return false;
    }
    if (MEISSA_2D_SIMPLE_ORTHO) {
      pushMeissa2dLoadLine("심플: overlay-2d-image/raw 시도");
      syncMeissa2dSquareMapFrameLayout();
      let rawHttpStatus = 0;
      let rawErrSnip = "";
      let overlayOk = false;
      let overlayMsg = "";
      pushMeissa2dLoadLine("심플: overlay-2d-image(JSON·dataUrl) 조회");
      const rawPromise = fetchWithTimeout(
        `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-image/raw`,
        { headers: { Authorization: `JWT ${meissaAccess}` } },
        MEISSA_OVERLAY_2D_RAW_FETCH_MS
      );
      const jsonPromise = fetchWithTimeout(
        `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-image`,
        { headers: { Authorization: `JWT ${meissaAccess}` } },
        MEISSA_OVERLAY_2D_JSON_FETCH_MS
      );
      try {
        const res = await rawPromise;
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
        rawHttpStatus = res.status;
        if (res.ok) {
          const blob = await res.blob();
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
          if (blob && blob.size) {
            const objUrl = URL.createObjectURL(blob);
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
              URL.revokeObjectURL(objUrl);
              return false;
            }
            setMeissa2dRawUrlForSnapshot(sid, objUrl);
            img.src = objUrl;
            img.onload = onMeissa2dOverlayImgDecoded;
            img.setAttribute("data-meissa-2d-ok", "1");
            img.setAttribute("data-meissa-2d-source", "raw");
            applyPreferred2dVisibility();
            pushMeissa2dLoadLine("완료: RAW 바이너리 이미지");
            return true;
          }
          rawErrSnip = `raw blob empty size=${blob?.size || 0}`;
        } else {
          try {
            const j = await res.json();
            const d = j?.detail;
            rawErrSnip =
              typeof d === "object" && d != null
                ? JSON.stringify(d).slice(0, 320)
                : String(d || j?.message || "").slice(0, 220);
          } catch (_) {
            rawErrSnip = `http ${res.status}`;
          }
        }
      } catch (e) {
        rawErrSnip = e?.message || String(e);
        pushMeissa2dLoadLine(`심플 RAW 예외(JSON·dataUrl 폴백 계속): ${String(rawErrSnip).slice(0, 90)}`);
      }
      try {
        const jsonRes = await jsonPromise;
        const data = await pilexyParseFetchJson(jsonRes);
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
        overlayOk = Boolean(data?.ok);
        overlayMsg = String(data?.message || "").slice(0, 240);
        const u = data?.ok && typeof data?.dataUrl === "string" ? data.dataUrl : "";
        if (u) {
          img.src = u;
          img.onload = onMeissa2dOverlayImgDecoded;
          img.setAttribute("data-meissa-2d-ok", "1");
          img.setAttribute("data-meissa-2d-source", "data-url");
          applyPreferred2dVisibility();
          pushMeissa2dLoadLine("완료: JSON dataUrl 이미지");
          return true;
        }
      } catch (e) {
        overlayMsg = e?.message || String(e);
        updateMeissaDebugText(`[2D 심플] JSON 로드 예외: ${overlayMsg}`);
        pushMeissa2dLoadLine(`심플 JSON 예외: ${String(overlayMsg).slice(0, 80)}`);
      }
      pushMeissa2dLoadLine("심플: orthophoto·RAW·JSON 실패 → Carta 타일 직접 폴백(cs.carta.is)");
      try {
        img.onload = onMeissa2dOverlayImgDecoded;
        const tileOk = await loadMeissa2dOverlayByCartaTileFallback(sid, {
          timeoutMs: 3200,
          batchSize: 8,
          maxChecks: 40,
          strictAbsolute: false,
        });
        if (tileOk && isMeissa2dLoadCurrent(loadSeq, sid)) {
          syncMeissa2dSquareMapFrameLayout();
          applyPreferred2dVisibility();
          meissa2dOrthoInteractReady = true;
          pushMeissa2dLoadLine("완료: Carta 타일 폴백(현장 일부 타일 · 정사 전체 아님)");
          scheduleRenderMeissa2dPointsOverlay();
          return true;
        }
      } catch (e2) {
        pushMeissa2dLoadLine(`심플 타일 폴백 예외: ${String(e2?.message || e2).slice(0, 72)}`);
      }
      meissa2dOrthoInteractReady = false;
      img.removeAttribute("src");
      img.setAttribute("data-meissa-2d-ok", "0");
      applyPreferred2dVisibility();
      const orthoPart = tryOrtho
        ? `ortho HTTP ${orthophotoHttpStatus ?? "-"} ${orthophotoErrSnip ? orthophotoErrSnip.slice(0, 140) : orthophotoOk ? "ok" : ""}`
        : "ortho skipped(no projectId/sid)";
      const hint = `raw ${rawHttpStatus} ${rawErrSnip.slice(0, 100)} | json ok=${overlayOk} ${overlayMsg.slice(0, 80)} | ${orthoPart}`;
      state.meissa2dLoadFailHint = hint.slice(0, 420);
      pushMeissa2dLoadLine(`심플 전체 실패 · ${hint.slice(0, 140)}`);
      updateMeissaDebugText(
        `${state.meissaResourceDebugText || ""}\n[2D 심플] snapshot=${sid} 실패.\n${hint}`
      );
      return false;
    }
    // 속도 우선: 빠른 타일 폴백을 먼저 시도해 화면을 즉시 채운다.
    pushMeissa2dLoadLine("Carta 단일 타일 빠른 폴백 탐색…");
    const quickFallbackOk = await loadMeissa2dOverlayByCartaTileFallback(sid, {
      timeoutMs: 700,
      batchSize: 6,
      maxChecks: 18,
      strictAbsolute: true,
    });
    if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
    if (quickFallbackOk) {
      pushMeissa2dLoadLine("타일 폴백 성공 · 고해상 RAW는 백그라운드 시도");
      applyPreferred2dVisibility();
      if (!quickMosaic) {
        renderMeissa2dMosaic(sid, {
          z: 20,
          radius: 5,
          centerX: meissa2dFallbackTileCenter.x,
          centerY: meissa2dFallbackTileCenter.y,
        });
        applyPreferred2dVisibility();
      }
      // 고해상도 원본 로드는 백그라운드로 천천히 시도 (실패해도 현재 화면 유지)
      meissa2dPendingTimers.push(window.setTimeout(async () => {
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
        try {
          const resBg = await fetchWithTimeout(
            `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-image/raw`,
            { headers: { Authorization: `JWT ${meissaAccess}` } },
            12000
          );
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (!resBg.ok) return;
          const blobBg = await resBg.blob();
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          if (!blobBg || !blobBg.size) return;
          const objUrl = URL.createObjectURL(blobBg);
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
            URL.revokeObjectURL(objUrl);
            return;
          }
          setMeissa2dRawUrlForSnapshot(sid, objUrl);
          img.src = objUrl;
          img.onload = onMeissa2dOverlayImgDecoded;
          img.setAttribute("data-meissa-2d-ok", "1");
          img.setAttribute("data-meissa-2d-source", "raw");
          applyPreferred2dVisibility();
        } catch (_) {
          // keep fast fallback image
        }
      }, 0));
      return true;
    }
    pushMeissa2dLoadLine("타일 폴백 실패 · RAW 직접 요청");
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-image/raw`,
        { headers: { Authorization: `JWT ${meissaAccess}` } },
        10000
      );
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
      if (res.ok) {
        const blob = await res.blob();
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
        const objUrl = URL.createObjectURL(blob);
        if (!isMeissa2dLoadCurrent(loadSeq, sid)) {
          URL.revokeObjectURL(objUrl);
          return false;
        }
        setMeissa2dRawUrlForSnapshot(sid, objUrl);
        img.src = objUrl;
        img.onload = onMeissa2dOverlayImgDecoded;
        img.setAttribute("data-meissa-2d-ok", "1");
        img.setAttribute("data-meissa-2d-source", "raw");
        applyPreferred2dVisibility();
        pushMeissa2dLoadLine("완료: RAW 이미지(표준 경로)");
        return true;
      }
      let rawErrorMessage = `raw-endpoint status=${res.status}`;
      let rawDebugSummary = "";
      try {
        const rawPayload = await res.json();
        const detail = rawPayload?.detail;
        if (typeof detail === "string" && detail.trim()) rawErrorMessage = detail.trim();
        else if (detail && typeof detail === "object") {
          const msg = detail?.message ? String(detail.message).trim() : "";
          if (msg) rawErrorMessage = msg;
          rawDebugSummary = summarizeOverlay2dDebug(detail?.debug);
        } else if (rawPayload?.message) {
          rawErrorMessage = String(rawPayload.message);
        }
      } catch (_) {
        // ignore parse failure
      }
      pushMeissa2dLoadLine("RAW 실패 · overlay-2d-image(JSON) 시도");
      const jsonRes = await fetchWithTimeout(
        `${API_BASE_URL}/api/meissa/snapshots/${encodeURIComponent(sid)}/overlay-2d-image`,
        { headers: { Authorization: `JWT ${meissaAccess}` } },
        MEISSA_OVERLAY_2D_JSON_FETCH_MS
      );
      const data = await pilexyParseFetchJson(jsonRes);
      if (!isMeissa2dLoadCurrent(loadSeq, sid)) return false;
      const u = data?.ok && typeof data?.dataUrl === "string" ? data.dataUrl : "";
      if (u) {
        img.src = u;
        img.onload = onMeissa2dOverlayImgDecoded;
        img.setAttribute("data-meissa-2d-ok", "1");
        img.setAttribute("data-meissa-2d-source", "data-url");
        applyPreferred2dVisibility();
        pushMeissa2dLoadLine("완료: dataUrl 이미지");
        return true;
      } else {
        pushMeissa2dLoadLine("JSON에 dataUrl 없음 · 타일 폴백 재시도");
        const fallbackOk = await loadMeissa2dOverlayByCartaTileFallback(sid, {
          timeoutMs: 850,
          batchSize: 6,
          maxChecks: 24,
          strictAbsolute: true,
        });
        if (!fallbackOk) {
          meissa2dOrthoInteractReady = false;
          img.removeAttribute("src");
          img.setAttribute("data-meissa-2d-ok", "0");
          setMeissa2dLayerVisibility({ showMosaic: quickMosaic, showImage: false });
          const apiDebugSummary = summarizeOverlay2dDebug(data?.debug);
          updateMeissaDebugText(
            `${state.meissaResourceDebugText || ""}\n[2D] 이미지 로드 실패: snapshot=${sid}\n- raw: ${rawErrorMessage}\n${rawDebugSummary ? `${rawDebugSummary}\n` : ""}- overlay-2d-image: dataUrl 없음\n${apiDebugSummary ? `${apiDebugSummary}\n` : ""}- carta fallback: 실패`
          );
          // 느린 전면 대기 대신, 넓은 범위 탐색은 백그라운드로 전환
          meissa2dPendingTimers.push(window.setTimeout(() => {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            loadMeissa2dOverlayByCartaTileFallback(sid, {
              timeoutMs: 1500,
              batchSize: 8,
              maxChecks: 120,
              strictAbsolute: false,
            }).then((ok2) => {
              if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
              if (ok2) {
                setStatus(els.meissaApiStatus, "2D 배경을 백그라운드 탐색으로 찾았습니다.");
              }
            });
          }, 0));
        }
        if (fallbackOk) applyPreferred2dVisibility();
        return fallbackOk;
      }
    } catch (e) {
      const fallbackOk = await loadMeissa2dOverlayByCartaTileFallback(sid, {
        timeoutMs: 850,
        batchSize: 6,
        maxChecks: 24,
        strictAbsolute: true,
      });
      if (!fallbackOk) {
        meissa2dOrthoInteractReady = false;
        img.removeAttribute("src");
        img.setAttribute("data-meissa-2d-ok", "0");
        setMeissa2dLayerVisibility({ showMosaic: quickMosaic, showImage: false });
        updateMeissaDebugText(
          `${state.meissaResourceDebugText || ""}\n[2D] 이미지 로드 예외: snapshot=${sid}\n- error: ${e?.message || e || "unknown"}\n- carta fallback: 실패`
        );
        meissa2dPendingTimers.push(window.setTimeout(() => {
          if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
          loadMeissa2dOverlayByCartaTileFallback(sid, {
            timeoutMs: 1500,
            batchSize: 8,
            maxChecks: 120,
            strictAbsolute: false,
          }).then((ok2) => {
            if (!isMeissa2dLoadCurrent(loadSeq, sid)) return;
            if (ok2) {
              setStatus(els.meissaApiStatus, "2D 배경을 백그라운드 탐색으로 찾았습니다.");
            }
          });
        }, 0));
      }
      if (fallbackOk) applyPreferred2dVisibility();
      return fallbackOk;
    }
  }

  /**
   * 아래 iframe: 미로그인 시 항상 Meissa 웹 로그인 화면 → 위 버튼으로 API 로그인 성공 시 토큰 URL로 같은 방식 전환.
   * 프로젝트·존·스냅샷까지 고르면 해당 3D 뷰로 이동.
   */
  function syncMeissa3dEmbed(options) {
    const opts = options || {};
    applyIdsFromMeissaSelects();
    const p =
      (els.meissaProjectSelect?.value || "").trim() ||
      (els.projectId?.value || "").trim();
    const z =
      (els.meissaZoneSelect?.value || "").trim() ||
      (els.zoneId?.value || "").trim();
    const s =
      (els.meissaSnapshotSelect?.value || "").trim() ||
      (els.snapshotId?.value || "").trim();

    const iframe = els.meissaCloud3dFrame;
    const ph = els.meissaCloud3dPlaceholder;
    const tab = els.meissaOpen3dTab;

    const hasToken = Boolean((meissaAccess || "").trim());
    let targetUrl;
    /** @type {"login"|"app"|"3d"} */
    let mode;
    if (p && z && s) {
      if (MEISSA_3D_EXCLUDED) {
        targetUrl = buildMeissaCloudSnapshotUrl(p, z, s);
        mode = "app";
      } else {
        targetUrl = buildMeissaCloud3dUrl(p, z, s);
        mode = "3d";
      }
    } else if (hasToken) {
      targetUrl = withMeissaAccessTokenQuery(MEISSA_CLOUD_LOGIN_URL);
      mode = "app";
    } else {
      targetUrl = MEISSA_CLOUD_LOGIN_URL;
      mode = "login";
    }

    if (mode === "login" && !hasToken) {
      const memPath = getRememberedMeissaCloudPath();
      if (memPath) {
        targetUrl = `${MEISSA_CLOUD_ORIGIN}${memPath}`;
        mode = "app";
      }
    }

    if (iframe) {
      const wrap = iframe.closest(".meissa-cloud-3d-wrap");
      if (!MEISSA_CLOUD_3D_FRAME_VISIBLE) {
        iframe.setAttribute("data-meissa-embed-url", "");
        if ((iframe.getAttribute("src") || "").trim() !== "about:blank") iframe.src = "about:blank";
        iframe.style.display = "none";
        if (wrap) {
          wrap.hidden = true;
          wrap.setAttribute("aria-hidden", "true");
        }
      } else {
        const prev = iframe.getAttribute("data-meissa-embed-url");
        if (prev !== targetUrl) {
          iframe.setAttribute("data-meissa-embed-url", targetUrl);
          iframe.src = targetUrl;
        }
        if (mode !== "login" || hasToken) {
          rememberMeissaCloudEmbedPath(targetUrl);
        }
        iframe.style.display = "block";
        if (wrap) {
          wrap.hidden = false;
          wrap.setAttribute("aria-hidden", "false");
        }
        if (mode === "login") iframe.title = "Meissa 클라우드 로그인";
        else if (mode === "3d") iframe.title = "Meissa 3D 뷰어";
        else if (p && z && s && MEISSA_3D_EXCLUDED) iframe.title = "Meissa 스냅샷(3D 뷰어 제외)";
        else iframe.title = "Meissa 클라우드";
      }
    }
    if (s && !opts.skip2dLoad) loadMeissa2dOverlayImage(s);
    if (ph) ph.style.display = "none";

    if (tab) {
      if (mode === "3d") {
        tab.href = targetUrl;
        tab.textContent = "새 탭에서 선택 3D 열기";
      } else if (p && z && s && MEISSA_3D_EXCLUDED) {
        tab.href = targetUrl;
        tab.textContent = "새 탭에서 스냅샷 열기(3D 뷰어 제외)";
      } else if (mode === "app") {
        tab.href = targetUrl;
        tab.textContent = "새 탭에서 클라우드 열기";
      } else {
        tab.href = MEISSA_CLOUD_LOGIN_URL;
        tab.textContent = "새 탭에서 로그인 열기";
      }
      tab.hidden = false;
    }
  }

  function initFromQuery() {
    const q = new URLSearchParams(window.location.search);
    pilexyPdamProjectContextOverride = (q.get("projectContext") || "").trim();
    const w = q.get("workId");
    if (w && els.workId) els.workId.value = w;
    const qp = q.get("projectId");
    const qz = q.get("zoneId");
    const qs = q.get("snapshotId");
    if (qp && els.projectId) els.projectId.value = qp;
    if (qz && els.zoneId) els.zoneId.value = qz;
    if (qs && els.snapshotId) els.snapshotId.value = qs;
    if (!qp && !qz && !qs && !document.getElementById("meissa-email")) {
      if (els.projectId && !(els.projectId.value || "").trim()) els.projectId.value = "473";
      if (els.zoneId && !(els.zoneId.value || "").trim()) els.zoneId.value = "343";
      if (els.snapshotId && !(els.snapshotId.value || "").trim()) els.snapshotId.value = "26798";
    }
    syncMeissa3dEmbed();
  }

  async function boot() {
    tryRestoreMeissaJwtFromStorage();
    if ((meissaAccess || "").trim()) void primeMeissaCloudWebSession(meissaAccess);
    initFromQuery();
    try {
      await refreshDatasets();
      setStatus(
        els.pdamStatus,
        (els.dataset?.value || "").trim()
          ? "최신 데이터셋을 자동 선택했습니다. 날짜 목록을 불러오세요."
          : "데이터셋을 고른 뒤 날짜 목록을 불러오세요."
      );
    } catch (e) {
      setStatus(els.pdamStatus, e.message || String(e), true);
    }

    els.loadOptions?.addEventListener("click", loadDateOptions);
    els.loadPdam?.addEventListener("click", loadPdamSnapshot);

    els.dataset?.addEventListener("change", async () => {
      state.pdamByCircleId = new Map();
      if (!(els.dataset?.value || "").trim()) return;
      const ok = await loadDateOptions();
      if (ok) await loadPdamSnapshot();
    });
    els.fromOpener?.addEventListener("click", () => requestCirclesFromMainOrOpener(false));
    document.addEventListener("pilexy-meissa-drawer-open", () => {
      refreshDatasets().catch(() => {});
      void (async () => {
        tryRestoreMeissaJwtFromStorage();
        if (meissaAccess) {
          const sel = els.meissaProjectSelect;
          const projectOptionCount = sel ? [...sel.options].filter((o) => o.value).length : 0;
          if (projectOptionCount === 0) {
            try {
              await populateMeissaProjectListFromAccess("저장된 로그인", { clearHiddenIds: false });
              await applyMeissaHiddenIdsToCascade();
            } catch (e) {
              const st = Number(e?.pilexyHttpStatus);
              if (st === 401 || st === 403) {
                meissaAccess = null;
                clearMeissaAccessFromStorage();
                setStatus(els.meissaApiStatus, "Meissa 로그인이 만료되었습니다. 다시 로그인하세요.", true);
              } else {
                setStatus(
                  els.meissaApiStatus,
                  `Meissa 목록을 불러오지 못했습니다(${e.message || String(e)}). 네트워크 확인 후 잠시 뒤 다시 여세요.`,
                  true
                );
              }
            }
          }
        }
        syncMeissa3dEmbed();
      })();
    });

    function pilexyOnPageLeave() {
      if (pilexyPageLeaveHandled) return;
      pilexyPageLeaveHandled = true;
      try {
        pilexyUnloadAbort.abort();
      } catch (_) {
        /* ignore */
      }
      pilexyUnloadAbort = new AbortController();
      try {
        stopMeissaProgressiveLoader();
      } catch (_) {
        /* ignore */
      }
      try {
        clearMeissa2dPendingTimers();
      } catch (_) {
        /* ignore */
      }
      meissa2dLoadSeq += 1;
      try {
        const img2d = els.meissaCloud2dImageLocal;
        if (img2d && typeof img2d.__pilexyOrthoCleanup === "function") img2d.__pilexyOrthoCleanup();
      } catch (_) {
        /* ignore */
      }
      try {
        meissa2dIframeFocusHintTimer && window.clearTimeout(meissa2dIframeFocusHintTimer);
        meissa2dIframeFocusHintTimer = 0;
      } catch (_) {
        /* ignore */
      }
    }

    /* 이탈 정리는 pagehide 만(실제 문서 내릴 때). beforeunload 에서 abort 하면 ‘떠나기’ 취소 후에도 요청이 끊김 */
    window.addEventListener("pagehide", () => {
      pilexyOnPageLeave();
    });
    window.addEventListener("pageshow", (ev) => {
      if (ev.persisted) {
        pilexyPageLeaveHandled = false;
        pilexyUnloadAbort = new AbortController();
        tryRestoreMeissaJwtFromStorage();
        if ((meissaAccess || "").trim()) void primeMeissaCloudWebSession(meissaAccess);
        syncMeissa3dEmbed();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopMeissaProgressiveLoader();
      } else {
        if (MEISSA_3D_EXCLUDED || MEISSA_2D_PRIORITY_MODE || !MEISSA_POINT_CLOUD_AUTOLOAD) return;
        const sid = (els.meissaSnapshotSelect?.value || "").trim();
        if (
          sid &&
          meissaAccess &&
          state.meissaBasePoints.length > 0 &&
          state.meissaBasePoints.length < 80000
        ) {
          startMeissaProgressiveLoader(sid);
        }
      }
    });
    els.runCompare?.addEventListener("click", runCompare);
    bindMeissaCascade();
    if (meissaAccess) {
      try {
        await populateMeissaProjectListFromAccess("저장된 로그인 복원", { clearHiddenIds: false });
        await applyMeissaHiddenIdsToCascade();
      } catch (e) {
        const st = Number(e?.pilexyHttpStatus);
        if (st === 401 || st === 403) {
          meissaAccess = null;
          clearMeissaAccessFromStorage();
          syncMeissa3dEmbed();
          setStatus(
            els.meissaApiStatus,
            `저장된 Meissa 로그인이 만료되었습니다(${e.message || String(e)}). 위에서 다시 로그인하세요.`,
            true
          );
        } else {
          syncMeissa3dEmbed();
          setStatus(
            els.meissaApiStatus,
            `저장된 로그인은 유지됩니다. 프로젝트 목록만 불러오지 못했습니다(${e.message || String(e)}). 드론 패널을 다시 열거나 새로고침해 보세요.`,
            true
          );
        }
      }
    } else {
      syncMeissa3dEmbed();
    }
    bindMeissa2dOverlayInteractions();
    bindMeissaDomOverlayInteractions();
    bindMeissaDomOverlayImageFallback();
    meissaDatasetBindToolbar();
    bindMeissaCloudInboundMessages();
    if (!state.circles?.length) requestCirclesFromMainOrOpener(true);
    scheduleRenderMeissa2dPointsOverlay();

    els.datePreset?.addEventListener("change", () => {
      if (els.datePreset.value) els.dateInput.value = els.datePreset.value;
    });
    els.dateInput?.addEventListener("change", () => {
      const v = els.dateInput.value;
      if (v && [...els.datePreset.options].some((o) => o.value === v)) els.datePreset.value = v;
    });

    els.meissa3dColorMode?.addEventListener("change", () => {
      syncMeissaLegendRowVisibility();
      scheduleRenderMeissa2dPointsOverlay();
      refreshMeissa3d();
      renderMeissaOrthoOffsetPanel();
    });
    els.meissaRemainingMinFilter?.addEventListener("change", () => {
      scheduleRenderMeissa2dPointsOverlay();
      refreshMeissa3d();
    });
    document.getElementById("meissa-plan-dev-ok-m")?.addEventListener("input", () => {
      syncMeissaLegendRowVisibility();
      scheduleRenderMeissa2dPointsOverlay();
      refreshMeissa3d();
    });
    document.getElementById("meissa-plan-dev-bad-m")?.addEventListener("input", () => {
      syncMeissaLegendRowVisibility();
      scheduleRenderMeissa2dPointsOverlay();
      refreshMeissa3d();
    });
    document.getElementById("meissa-ortho-delta-min")?.addEventListener("input", () => {
      bumpMeissa2dOrthoRgbFitCache();
      syncMeissaLegendRowVisibility();
      scheduleRenderMeissa2dPointsOverlay();
      refreshMeissa3d();
    });
    ["meissa-ortho-off-green-m", "meissa-ortho-off-yellow-m", "meissa-ortho-off-orange-m"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        bumpMeissa2dOrthoRgbFitCache();
        syncMeissaLegendRowVisibility();
        scheduleRenderMeissa2dPointsOverlay();
        refreshMeissa3d();
      });
    });
    document.getElementById("meissa-ortho-fast-mode")?.addEventListener("change", () => {
      bumpMeissa2dOrthoRgbFitCache();
      scheduleRenderMeissa2dPointsOverlay();
      scheduleMeissaOrthoOffsetPanelRefresh();
    });
    document.getElementById("meissa-ortho-pdam-debug-line")?.addEventListener("change", () => {
      bumpMeissa2dOrthoRgbFitCache();
      scheduleRenderMeissa2dPointsOverlay();
      scheduleMeissaOrthoOffsetPanelRefresh();
    });
    [els.offsetX, els.offsetY].forEach((el) => {
      el?.addEventListener("input", () => {
        bumpMeissa2dOrthoRgbFitCache();
        scheduleRenderMeissa2dPointsOverlay();
        scheduleMeissaOrthoOffsetPanelRefresh();
      });
    });
    els.meissa3dDebugBtn?.addEventListener("click", async () => {
      if (MEISSA_3D_EXCLUDED) {
        setStatus(els.meissaApiStatus, "점군/3D는 현재 비활성화(MEISSA_3D_EXCLUDED)입니다.");
        updateMeissaDebugText("[비활성] 점군 디버그는 MEISSA_3D_EXCLUDED 가 false 일 때만 동작합니다.");
        return;
      }
      const sid = (els.meissaSnapshotSelect?.value || "").trim() || (els.snapshotId?.value || "").trim();
      if (!sid) {
        updateMeissaDebugText("디버그 실패: 스냅샷을 먼저 선택하세요.");
        return;
      }
      try {
        stopMeissaProgressiveLoader();
        setStatus(els.meissaApiStatus, "점군 디버그 실행 중…");
        await loadMeissaSnapshotResources(sid, {
          debugLabel: "MANUAL",
          maxSampleResources: 24,
          perResourceLimit: 30000,
          pointCap: 100000,
        });
        await refreshMeissa3d();
        startMeissaProgressiveLoader(sid, { force: true });
        setStatus(
          els.meissaApiStatus,
          `디버그 완료 · 리소스 ${state.meissaResourceCount}건 · 포인트 ${state.meissaBasePoints.length}개`
        );
      } catch (e) {
        setStatus(els.meissaApiStatus, e.message || String(e), true);
      }
    });
    if (els.meissa3dLegendText && !els.meissa3dLegendText.textContent) {
      els.meissa3dLegendText.textContent = "PDAM 스냅샷 로드·자동 비교 후 도면 원 좌표에 색이 표시됩니다.";
    }
    normalizeMeissa3dColorModeSelect();
    syncMeissaLegendRowVisibility();
    document.querySelectorAll("#meissa-tier-filters").forEach((w) => {
      w?.addEventListener("change", onMeissaTierFilterInputChange);
    });
    syncMeissaTierFilterUiFromState();
    bindMeissaResultTableClick();
    bindMeissaOrthoOffsetPanel();
    renderMeissaOrthoOffsetPanel();
    renderMeissaOrthoAnalyzeDebugPanel();
    if (els.meissa3dDebugText && !els.meissa3dDebugText.textContent) {
      els.meissa3dDebugText.textContent = "아직 디버그 실행 전입니다.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
