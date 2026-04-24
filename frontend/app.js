
const BRDS_DEFAULT_SSO_URL = "https://baronet.daewooenc.com/login.do";
const BRDS_DEFAULT_TARGET_PAGE_URL = "https://aissvp01.daewooenc.com/brds/prugio/";

const BRDS_PRESET_QUESTIONS = {
  1: "말뚝공사 오시공 시 보강방법과 시공 절차를 알려주세요.",
  2: "파일 항타기(항타 작업)와의 이격 거리는 얼마나 되어야 하는지, 그리고 오시공의 정의는 무엇인지 설명해 주세요.",
};

const API_BASE_URL =
  window.__API_BASE_URL__ ||
  (window.location.origin && window.location.origin !== "null" ? window.location.origin : "");

const PhaseMessages = {
  idle: "Ready.",
  uploading: "Uploading CAD file...",
  parsing: "Parsing CAD file... (다른 사용자 업로드 시 잠시 걸릴 수 있습니다)",
  matching: "Matching circles and texts...",
  duplicates: "Building duplicate index...",
  ready: "Ready.",
  error: "Upload failed.",
};

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("dxf-file");
const selectedFileName = document.getElementById("selected-file-name");
const uploadButton = document.getElementById("upload-button");
const uploadStatus = document.getElementById("upload-status");
const progressWrapper = document.getElementById("upload-progress");
const progressFill = document.getElementById("upload-progress-fill");
const progressLabel = document.getElementById("upload-progress-label");
const filterMinInput = document.getElementById("filter-min");
const filterMaxInput = document.getElementById("filter-max");
const filterHeightMinInput = document.getElementById("filter-height-min");
const filterHeightMaxInput = document.getElementById("filter-height-max");
const filterDistanceInput = document.getElementById("filter-match-distance");
const filterPileNumberHyphenInput = document.getElementById("filter-pile-number-hyphen");
const filterExcludeIdenticalGeometryDuplicatesInput = document.getElementById(
  "filter-exclude-identical-geometry-duplicates",
);
const filterTowerCraneNumberInput = document.getElementById("filter-tower-crane-number-format");
const buildingSeqSummaryHead = document.getElementById("building-seq-summary-head");
const buildingSeqSummaryHint = document.getElementById("building-seq-summary-hint");
const applyFilterBtn = document.getElementById("apply-filter");
const tableBody = document.getElementById("circles-table-body");
const duplicatesTableBody = document.getElementById("duplicates-table-body");
const errorsTableBody = document.getElementById("errors-table-body");
const summaryTotalCircles = document.getElementById("summary-total-circles");
const summaryTotalTexts = document.getElementById("summary-total-texts");
const summaryMatched = document.getElementById("summary-matched");
const summaryDuplicateGroups = document.getElementById("summary-duplicates");
const duplicatesCount = document.getElementById("duplicates-count");
const errorsCount = document.getElementById("errors-count");
const errorsTypeFiltersContainer = document.getElementById("errors-type-filters");
const togglePointsInput = document.getElementById("toggle-points");
const toggleCirclesInput = document.getElementById("toggle-circles");
const toggleTextsInput = document.getElementById("toggle-texts");
const toggleMatchLinesInput = document.getElementById("toggle-match-lines");
const toggleFoundationLabelVizInput = document.getElementById("toggle-foundation-label-viz");
const togglePfPolyLinkVizInput = document.getElementById("toggle-pf-poly-link-viz");
const toggleFoundationAreaHatchVizInput = document.getElementById("toggle-foundation-area-hatch-viz");
const toggleBuildingHatchInput = document.getElementById("toggle-building-hatch");
const toggleParkingHatchInput = document.getElementById("toggle-parking-hatch");
const toggleTowerCraneHatchInput = document.getElementById("toggle-tower-crane-hatch");
const downloadCsvBtn = document.getElementById("download-csv");
const downloadXlsxBtn = document.getElementById("download-xlsx");
const canvas = document.getElementById("circle-canvas");
const canvasSearchToggleBtn = document.getElementById("canvas-search-toggle");
const canvasSearchPanel = document.getElementById("canvas-search-panel");
const canvasSearchModeButtons = Array.from(document.querySelectorAll("[data-canvas-search-mode]"));
const canvasSearchModePanels = Array.from(document.querySelectorAll("[data-canvas-search-panel]"));
const canvasSearchIdInput = document.getElementById("canvas-search-id-input");
const canvasSearchGroupSelect = document.getElementById("canvas-search-group-select");
const canvasSearchGroupNumberInput = document.getElementById("canvas-search-group-number-input");
const canvasSearchApplyBtn = document.getElementById("canvas-search-apply");
const tooltip = document.getElementById("canvas-tooltip");
const canvasModeHint = document.getElementById("canvas-mode-hint");
const buildingCountInput = document.getElementById("building-count");
const buildingNameEditor = document.getElementById("building-name-editor");
const parkingCountInput = document.getElementById("parking-count");
const parkingNameEditor = document.getElementById("parking-name-editor");
const towerCraneCountInput = document.getElementById("tower-crane-count");
const towerCraneNameEditor = document.getElementById("tower-crane-name-editor");
const toggleAreaListFocusInput = document.getElementById("toggle-area-list-focus");
const addBuildingNameBtn = document.getElementById("add-building-name");
const addParkingNameBtn = document.getElementById("add-parking-name");
const addTowerCraneNameBtn = document.getElementById("add-tower-crane-name");
const toggleBuildingNameListExpandBtn = document.getElementById("toggle-building-name-list-expand");
const toggleParkingNameListExpandBtn = document.getElementById("toggle-parking-name-list-expand");
const toggleTowerCraneNameListExpandBtn = document.getElementById("toggle-tower-crane-name-list-expand");
const applyBuildingNamesBtn = document.getElementById("apply-building-names");
const applyParkingNamesBtn = document.getElementById("apply-parking-names");
const applyTowerCraneNamesBtn = document.getElementById("apply-tower-crane-names");
const applyBuildingCountBtn = document.getElementById("apply-building-count");
const applyParkingCountBtn = document.getElementById("apply-parking-count");
const applyTowerCraneCountBtn = document.getElementById("apply-tower-crane-count");
const generateBuildingsBtn = document.getElementById("generate-buildings");
const toggleEditBuildingsBtn = document.getElementById("toggle-edit-buildings");
const toggleEditParkingsBtn = document.getElementById("toggle-edit-parkings");
const toggleEditTowerCranesBtn = document.getElementById("toggle-edit-tower-cranes");
const canvasToggleEditBuildingsBtn = document.getElementById("canvas-toggle-edit-buildings");
const generateBuildingOutlinesBtn = document.getElementById("generate-building-outlines");
const applyBuildingsBtn = document.getElementById("apply-buildings");
const applyParkingsBtn = document.getElementById("apply-parkings");
const applyTowerCranesBtn = document.getElementById("apply-tower-cranes");
const saveBuildingDrillingBtn = document.getElementById("save-building-drilling-btn");
const saveParkingDrillingBtn = document.getElementById("save-parking-drilling-btn");
const saveTowerCraneDrillingBtn = document.getElementById("save-tower-crane-drilling-btn");
const buildingTabsContainer = document.getElementById("building-tabs");
const manualCircleValue = document.getElementById("manual-circle-value");
const manualTextValue = document.getElementById("manual-text-value");
const manualPickCircleBtn = document.getElementById("manual-pick-circle");
const manualPickTextBtn = document.getElementById("manual-pick-text");
const manualApplyBtn = document.getElementById("manual-apply");
const manualClearBtn = document.getElementById("manual-clear");
const manualRemoveLinkBtn = document.getElementById("manual-remove-link");
const maxDistanceSeedInput = document.getElementById("max-distance-seed");
const mergeSeedDistanceInput = document.getElementById("merge-seed-distance");
const toggleClusteringSettingsBtn = document.getElementById("toggle-clustering-settings");
const clusteringSettingsContent = document.getElementById("clustering-settings-content");
const applyClusteringSettingsBtn = document.getElementById("apply-clustering-settings");
const buildingSelect = document.getElementById("building-select");
const projectNameInput = document.getElementById("project-name-input");
const projectSourceTypeSelect = document.getElementById("project-source-type-select");
const saveProjectBtn = document.getElementById("save-project-btn");
const updateProjectBtn = document.getElementById("update-project-btn");
const refreshProjectListBtn = document.getElementById("refresh-project-list-btn");
const settingsContextSelect = document.getElementById("settings-context-select");
const projectList = document.getElementById("project-list");
const saveWorkBtn = document.getElementById("save-work-btn");
const saveWorkUpdateBtn = document.getElementById("save-work-update-btn");
const saveWorkModal = document.getElementById("save-work-modal");
const saveWorkModalTitle = document.getElementById("save-work-modal-title");
const saveWorkOverwriteSection = document.getElementById("save-work-overwrite-section");
const saveWorkOverwriteSelect = document.getElementById("save-work-overwrite-select");
const saveWorkProjectSelect = document.getElementById("save-work-project-select");
const saveWorkProjectCustomWrap = document.getElementById("save-work-project-custom-wrap");
const saveWorkProjectCustom = document.getElementById("save-work-project-custom");
const saveWorkSourceTypeSelect = document.getElementById("save-work-source-type-select");
const saveWorkTitleInput = document.getElementById("save-work-title-input");
const saveWorkAuthorSelect = document.getElementById("save-work-author-select");
const saveWorkAuthorCustomWrap = document.getElementById("save-work-author-custom-wrap");
const saveWorkAuthorCustom = document.getElementById("save-work-author-custom");
const saveWorkOriginFilename = document.getElementById("save-work-origin-filename");
const saveWorkModalCancel = document.getElementById("save-work-modal-cancel");
const saveWorkModalSubmit = document.getElementById("save-work-modal-submit");
const loadWorkBtn = document.getElementById("load-work-btn");
const loadWorkListPanel = document.getElementById("load-work-list-panel");
const loadWorkProjects = document.getElementById("load-work-projects");
const loadWorkItemsLabel = document.getElementById("load-work-items-label");
const loadWorkSourceFilters = document.getElementById("load-work-source-filters");
const loadWorkList = document.getElementById("load-work-list");
const loadWorkListRefresh = document.getElementById("load-work-list-refresh");
const loadWorkListClose = document.getElementById("load-work-list-close");
const loadWorkProjectSearch = document.getElementById("load-work-project-search");
const loadWorkVersionSearch = document.getElementById("load-work-version-search");
const headerWorkContextEl = document.getElementById("header-work-context");
const gaSetupTriggerBtn = document.getElementById("ga-setup-trigger");
const meissaProjectSelect = document.getElementById("meissa-project-select");
const meissaProjectIdInput = document.getElementById("meissa-project-id");

const LOAD_WORK_FAV_PROJECTS_KEY = "pilexy:load-fav-projects";
const LOAD_WORK_FAV_WORK_IDS_KEY = "pilexy:load-fav-work-ids";
const SETTINGS_CONTEXT_STORAGE_KEY = "pilexy:outline-settings-context";
const GA_MEASUREMENT_ID_STORAGE_KEY = "pilexy:ga-measurement-id";
const VERSION_COMPARE_EXCEL_CACHE_KEY = "pilexy:version-compare-excel-result-v1";
let gaBootstrapped = false;

function normalizeGaMeasurementId(value) {
  return String(value || "").trim();
}

function readStoredGaMeasurementId() {
  try {
    return normalizeGaMeasurementId(localStorage.getItem(GA_MEASUREMENT_ID_STORAGE_KEY));
  } catch {
    return "";
  }
}

function saveGaMeasurementId(value) {
  const next = normalizeGaMeasurementId(value);
  if (!next) return;
  try {
    localStorage.setItem(GA_MEASUREMENT_ID_STORAGE_KEY, next);
  } catch (_) {}
}

function ensureGoogleAnalyticsScript(measurementId) {
  if (!measurementId) return;
  if (document.querySelector('script[data-pilexy-ga-script="1"]')) return;
  const script = document.createElement("script");
  script.async = true;
  script.dataset.pilexyGaScript = "1";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function ensureGoogleAnalyticsGtag() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  return window.gtag;
}

function applyGoogleAnalyticsMeasurementId(measurementId, { notify = true } = {}) {
  const next = normalizeGaMeasurementId(measurementId);
  if (!next) return false;
  ensureGoogleAnalyticsScript(next);
  const gtag = ensureGoogleAnalyticsGtag();
  if (!gaBootstrapped) {
    gtag("js", new Date());
    gaBootstrapped = true;
  }
  gtag("config", next, { send_page_view: false });
  saveGaMeasurementId(next);
  if (notify) {
    alert(`구글 애널리틱스 설정 완료: ${next}`);
  }
  return true;
}

function initGoogleAnalyticsFromStorage() {
  const stored = readStoredGaMeasurementId();
  if (!stored) return;
  applyGoogleAnalyticsMeasurementId(stored, { notify: false });
}

/** GA4 가상 페이지뷰 — SPA 구간·드로어 전환용 (`construction.js` 등에서 호출) */
function pilexySendVirtualPageView(pagePath, pageTitle) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}

window.pilexySendVirtualPageView = pilexySendVirtualPageView;

function handleGaSetupTrigger() {
  alert("반가워요! 😊✨");
}

function loadFavoriteProjectNames() {
  try {
    const raw = localStorage.getItem(LOAD_WORK_FAV_PROJECTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveFavoriteProjectNames(names) {
  try {
    localStorage.setItem(LOAD_WORK_FAV_PROJECTS_KEY, JSON.stringify(names));
  } catch (_) {}
}

function loadFavoriteWorkIds() {
  try {
    const raw = localStorage.getItem(LOAD_WORK_FAV_WORK_IDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x) : [];
  } catch {
    return [];
  }
}

function saveFavoriteWorkIds(ids) {
  try {
    localStorage.setItem(LOAD_WORK_FAV_WORK_IDS_KEY, JSON.stringify(ids));
  } catch (_) {}
}

function toggleFavoriteProjectName(name) {
  const list = loadFavoriteProjectNames();
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1);
  else list.push(name);
  saveFavoriteProjectNames(list);
}

function toggleFavoriteWorkId(id) {
  if (!id) return;
  const list = loadFavoriteWorkIds();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  saveFavoriteWorkIds(list);
}

function loadWorkSearchNorm(s) {
  return (s || "").trim().toLowerCase();
}

function closeLoadWorkListPanel() {
  if (loadWorkListPanel) {
    loadWorkListPanel.classList.remove("open");
    loadWorkListPanel.setAttribute("aria-hidden", "true");
  }
  if (loadWorkBtn) loadWorkBtn.focus({ preventScroll: true });
}

function openLoadWorkListPanel() {
  if (loadWorkListPanel) {
    loadWorkListPanel.classList.add("open");
    loadWorkListPanel.setAttribute("aria-hidden", "false");
    loadWorkListPanel.focus({ preventScroll: true });
  }
}

const versionCompareBtn = document.getElementById("version-compare-btn");
const meissaCompareBtn = document.getElementById("meissa-compare-btn");
const meissaDrawer = document.getElementById("meissa-drawer");
const meissaDrawerClose = document.getElementById("meissa-drawer-close");
const versionComparePanel = document.getElementById("version-compare-panel");
const versionCompareClose = document.getElementById("version-compare-close");
const versionCompareProject = document.getElementById("version-compare-project");
const versionCompareOldSource = document.getElementById("version-compare-old-source");
const versionCompareOld = document.getElementById("version-compare-old");
const versionCompareNewSource = document.getElementById("version-compare-new-source");
const versionCompareNew = document.getElementById("version-compare-new");
const versionCompareApply = document.getElementById("version-compare-apply");
const versionCompareExcelToggle = document.getElementById("version-compare-excel-toggle");
const versionCompareSummaryBody = document.getElementById("version-compare-summary-body");
const versionCompareCanvas = document.getElementById("version-compare-canvas");
const versionCompareTooltip = document.getElementById("version-compare-tooltip");
const versionCompareDetailPlaceholder = document.getElementById("version-compare-detail-placeholder");
const versionCompareDetailContent = document.getElementById("version-compare-detail-content");
const versionCompareListOnlyOld = document.getElementById("version-compare-list-only-old");
const versionCompareListOnlyNew = document.getElementById("version-compare-list-only-new");
const versionCompareListCoordChanged = document.getElementById("version-compare-list-coord-changed");
const versionCompareExcelModal = document.getElementById("version-compare-excel-modal");
const versionCompareExcelBackdrop = versionCompareExcelModal?.querySelector(".version-compare-excel-backdrop");
const versionCompareExcelModalClose = document.getElementById("version-compare-excel-modal-close");
const versionCompareExcelFile = document.getElementById("version-compare-excel-file");
const versionCompareExcelInspect = document.getElementById("version-compare-excel-inspect");
const versionCompareExcelSheet = document.getElementById("version-compare-excel-sheet");
const versionCompareExcelSheetTabs = document.getElementById("version-compare-excel-sheet-tabs");
const versionCompareExcelHeaderRow = document.getElementById("version-compare-excel-header-row");
const versionCompareExcelBuildingColumn = document.getElementById("version-compare-excel-building-column");
const versionCompareExcelNumberColumn = document.getElementById("version-compare-excel-number-column");
const versionCompareExcelXColumn = document.getElementById("version-compare-excel-x-column");
const versionCompareExcelYColumn = document.getElementById("version-compare-excel-y-column");
const versionCompareExcelUseSheetBuilding = document.getElementById("version-compare-excel-use-sheet-building");
const versionCompareExcelApply = document.getElementById("version-compare-excel-apply");
const versionCompareExcelFieldButtons = document.getElementById("version-compare-excel-field-buttons");
const versionCompareExcelSelectionSummary = document.getElementById("version-compare-excel-selection-summary");
const versionCompareExcelStatus = document.getElementById("version-compare-excel-status");
const versionCompareExcelPreview = document.getElementById("version-compare-excel-preview");
const versionCompareExcelSummary = document.getElementById("version-compare-excel-summary");
const versionCompareExcelIssues = document.getElementById("version-compare-excel-issues");
const matchCorrectionsCount = document.getElementById("match-corrections-count");
const matchCorrectionsList = document.getElementById("match-corrections-list");
const manualHistoryReuseToggle = document.getElementById("manual-history-reuse-toggle");
const manualHistoryReferenceWorkSelect = document.getElementById("manual-history-reference-work-select");
const manualHistoryMatchApplyBtn = document.getElementById("manual-history-match-apply");

const versionCompareSelectorGrid = versionComparePanel?.querySelector(".version-compare-selector-grid");
const versionCompareOldCard = versionCompareOld?.closest(".version-compare-select-card");
const versionCompareNewCard = versionCompareNew?.closest(".version-compare-select-card");
if (versionCompareSelectorGrid && versionCompareOldCard && versionCompareNewCard && versionCompareSelectorGrid.children[1] === versionCompareOldCard) {
  versionCompareSelectorGrid.insertBefore(versionCompareNewCard, versionCompareOldCard);
}

const versionCompareExcelLegacySheetBuildingOption = versionCompareExcelUseSheetBuilding?.closest(".version-compare-excel-checkbox");
const versionCompareExcelToolbar = versionCompareExcelApply?.closest(".version-compare-excel-toolbar");
if (versionCompareExcelToolbar && !document.getElementById("version-compare-excel-building-source")) {
  const sourcePicker = document.createElement("div");
  sourcePicker.className = "version-compare-excel-source-picker";
  sourcePicker.innerHTML = `
    <span>동명 방식</span>
    <div id="version-compare-excel-building-source" class="version-compare-excel-building-source">
      <button type="button" class="is-active" data-building-source-mode="sheet">시트명 동으로 사용</button>
      <button type="button" data-building-source-mode="column">헤더에서 동 선택</button>
    </div>
  `;
  versionCompareExcelToolbar.insertBefore(sourcePicker, versionCompareExcelApply);
}
if (versionCompareExcelLegacySheetBuildingOption) {
  versionCompareExcelLegacySheetBuildingOption.hidden = true;
}

const versionCompareExcelBuildingSource = document.getElementById("version-compare-excel-building-source");

const ctx = canvas.getContext("2d");

/** 버전 비교용 뷰 상태 (메인 캔버스와 분리) */
const compareView = { scale: 1, offsetX: 0, offsetY: 0 };
/** 버전 비교 결과 캐시 (클릭 시 상세 표시용) */
let versionCompareState = { versionA: null, versionB: null, diff: null };
/** 버전 비교 패널: 저장된 작업 전체 목록 (프로젝트 선택 시 필터링용) */
let versionCompareWorksList = [];
/** 버전 비교 캔버스 팬 상태 */
let compareIsPanning = false;
let comparePanStart = { x: 0, y: 0 };
let compareDidPan = false;
/** 버전 비교 캔버스 핀치 줌 상태 */
let compareIsPinching = false;
let comparePinchStartDist = 0;
let comparePinchWorldAnchor = null;
let comparePinchStartScale = 1;

const DEFAULT_FILTER = {
  minDiameter: 0.5,
  maxDiameter: 0.65,
  textHeightMin: 0.4,
  textHeightMax: 1.1,
  maxMatchDistance: 2,
  /** 매칭 텍스트를 `동키-번호`로 읽고 번호는 − 뒤만 사용 (예: 1-12) */
  pileNumberHyphenFormat: false,
  /** 중심·반지름이 같은 원끼리는 겹침 중복으로 묶지 않음 (DXF상 동일 위치 중복 엔티티 등) */
  excludeIdenticalGeometryDuplicates: true,
  /** T/TC4-1 형식: T/TC=타워크레인, 4=호기, 뒤=파일번호 (동-번호와 동시 가능 — 매칭마다 T/TC 형식 우선) */
  towerCraneNumberFormat: false,
};

const DEFAULT_PROJECT_NAME = "기본";
const DEFAULT_SOURCE_TYPE = "contractor_original";
const LOAD_WORK_SOURCE_ALL = "__all__";
const SOURCE_TYPE_OPTIONS = [
  { value: "contractor_original", label: "시공사 원본" },
  { value: "vendor_prepared", label: "업체 작성" },
];
const VERSION_COMPARE_EXCEL_FIELDS = [
  { key: "building", label: "동", description: "동 컬럼", keywords: ["동", "building", "dong"], fallbackIndex: 0 },
  { key: "number", label: "번호", description: "번호 컬럼", keywords: ["번호", "no", "num", "pile"], fallbackIndex: 1 },
  { key: "x", label: "X", description: "X 좌표", keywords: ["x좌표", "x coordinate", "coord x", "x"], fallbackIndex: 2 },
  { key: "y", label: "Y", description: "Y 좌표", keywords: ["y좌표", "y coordinate", "coord y", "y"], fallbackIndex: 3 },
];

const buildingPalette = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const AREA_KIND_BUILDING = "building";
const AREA_KIND_PARKING = "parking";
/** 지하주차장(Bn)과 동일 슬롯·네모 생성 패턴, 라벨은 Tn */
const AREA_KIND_TOWER_CRANE = "tower_crane";

const state = {
  circles: [],
  texts: [],
  duplicates: [],
  errors: [],
  polylines: [],
  clusterPolylines: [],
  rawPolylines: [],
  pileClusters: [],
  summary: null,
  buildings: [],
  pendingNames: [],
  pendingParkingNames: [],
  pendingTowerCraneNames: [],
  hasDataset: false,
  filter: { ...DEFAULT_FILTER },
  circleMap: new Map(),
  textMap: new Map(),
  highlightedCircleIds: new Set(),
  highlightedTextIds: new Set(),
  buildingSummary: [],
  showPoints: true,
  showCircles: true,
  showTextLabels: true,
  showMatchLines: true,
  /** 캔버스: 말뚝 주변 기초 수치 글자·두께 링 등 (번호–파일 연결선과 별도) */
  showFoundationLabelViz: false,
  /** P/F 삽입점 ↔ 닫힌 윤곽(중심)·윤곽 내 파일 연결선 */
  showPfPolyLinkViz: false,
  showBuildingHatch: false,
  showParkingHatch: false,
  showTowerCraneHatch: false,
  manualSelection: { circleId: "", textId: "" },
  manualPickMode: null,
  buildingEditMode: false,
  enableAreaListHitFocus: false,
  activeBuildingFilter: "ALL",
  /** 매칭 에러 테이블: 에러 타입별 필터 (ALL | error_type) */
  activeErrorTypeFilter: "ALL",
  draggingVertex: null,
  areaRectCreate: null,
  /** 수동 동 윤곽: 폴리라인 다중 선택 후 최외곽선 생성 — { order, selectedIds: Set<string> } */
  buildingOutlinePickMode: null,
  buildingOutlinePickClick: null,
  /** 흙막이 참조 폴리라인 다중 선택 — { selectedIds: Set<string> } (열림·닫힘 모두) */
  retainingWallPickMode: null,
  retainingWallPickClick: null,
  /** 흙막이 거리 계산 결과 행 (렌더·표 클릭용) */
  retainingWallComputedRows: [],
  retainingWallResultsContext: null,
  retainingWallStatusPrefix: "",
  /** 거리 계산 결과 전체에 대해 캔버스 거리선·원 강조 */
  retainingWallVizAllEnabled: false,
  /** 필지 검토 오버레이: { siteRing, parcelRing, encroachmentRings } — 좌표는 도면 월드 */
  parcelReviewViz: null,
  /** 경계점 좌표등록부 등 사용자 입력 링(도면 m) + 표시 옵션 */
  parcelReviewLxRegister: {
    ring: null,
    showOutline: true,
    showFill: false,
    showVertices: true,
    showEncroachment: true,
    useAsReference: false,
  },
  /** 캔버스 클릭으로 고른 필지: { pnu, isWinner } | null */
  parcelReviewSelection: null,
  /** 대지·필지 꼭짓점·쿼리점 호버 시 도면 좌표(선분 위 연속 호버 없음) — 시공 패널 체크박스와 동기 */
  parcelReviewCoordProbe: true,
  /** 마우스 근접 시 표시할 점(도면 m) + 툴팁 위치 */
  parcelReviewCoordHover: null,
  /** 쿼리점 클릭으로 고정한 좌표 안내(null이면 미고정) */
  parcelReviewCoordPinned: null,
  /** 동별 클러스터 윤곽 자동생성 — 이름 목록 순서와 동일 */
  autoBuildingOutlineByOrder: [],
  lastUploadedFileName: "",
  /** 불러오기 시점의 원본 circles/texts. 필터 적용 시 항상 이 기준으로 재적용 (필터할 때마다 이전 결과에서 다시 필터하지 않음). */
  sourceCircles: null,
  sourceTexts: null,
  /** 동 이름 목록에서 캔버스 해치 클릭 등으로 강조된 행 인덱스 */
  highlightedBuildingNameIndex: -1,
  /** 불러온 작업 ID (수동 매칭 적용 시 해당 저장 항목 자동 갱신용) */
  loadedWorkId: null,
  /** 불러온 작업의 수동 매칭 맵 (circle_id -> text_id). 불러오기 후 필터 적용 시 서버로 전달해 복원 */
  manualOverrides: {},
  matchCorrections: [],
  /** 불러온 작업 메타 (title, project, author, sourceType) - 자동 갱신 시 유지 */
  loadedWorkMeta: null,
  /** 설정 불러오기로 불러온 프로젝트명·버전 (수정 시 해당 버전만 덮어쓰기) */
  loadedProjectName: null,
  loadedProjectVersionId: null,
  loadedProjectSourceType: DEFAULT_SOURCE_TYPE,
  /** 윤곽 없는 행 전용: 천공시작 입력고 (이름 적용 시 building 으로 병합) */
  pendingDrillingElevationsBuilding: [],
  pendingDrillingElevationsParking: [],
  pendingDrillingElevationsTowerCrane: [],
  /** 윤곽 없는 행 전용: 기초골조 상단레벨(m) — 기성 정리표 기본값 */
  pendingFoundationTopBuilding: [],
  pendingFoundationTopParking: [],
  pendingFoundationTopTowerCrane: [],
  /** 파일 단위 기초골조 두께(mm) 맵 */
  foundationThicknessByPileId: {},
  /** 파일 단위 엘레베이터 피트 오프셋(m) 맵 */
  foundationPitOffsetByPileId: {},
  /** 말뚝별 천공시작(m) — 동 설정보다 우선 */
  drillingStartByPileId: {},
  /** 말뚝별 기초상단(m) — 동 설정보다 우선 */
  foundationTopByPileId: {},
  /** 수동 매칭 히스토리 자동 재사용 (끄고 적용 시 히스토리만 제거, 세션 수동 매칭은 유지) */
  reuseManualHistory: false,
  /** 저장 작업 ID(work_…). 재사용 시 참고할 버전(하나만) */
  manualHistoryReferenceWorkId: null,
  settingsContextProject: "",
  settingsContextProjectId: "",
};

function ensureAutoBuildingOutlineFlagsLength() {
  const names = getAreaNames(AREA_KIND_BUILDING);
  if (!Array.isArray(state.autoBuildingOutlineByOrder)) {
    state.autoBuildingOutlineByOrder = [];
  }
  const arr = state.autoBuildingOutlineByOrder;
  while (arr.length < names.length) arr.push(false);
  if (arr.length > names.length) arr.length = names.length;
}

function isAutoBuildingOutlineAtOrder(order) {
  ensureAutoBuildingOutlineFlagsLength();
  return Boolean(state.autoBuildingOutlineByOrder[order]);
}

function hasAnyAutoBuildingOutlineFromClusters() {
  ensureAutoBuildingOutlineFlagsLength();
  return state.autoBuildingOutlineByOrder.some(Boolean);
}

/** 저장본 clustering 또는 최상위 배열에서 동별 자동생성 플래그 복원 */
function applyLoadedAutoBuildingOutlineOrderPayload(clustering, topLevelOrder) {
  if (Array.isArray(topLevelOrder)) {
    state.autoBuildingOutlineByOrder = topLevelOrder.map(Boolean);
    ensureAutoBuildingOutlineFlagsLength();
    return;
  }
  if (!clustering || typeof clustering !== "object") {
    ensureAutoBuildingOutlineFlagsLength();
    return;
  }
  if (Array.isArray(clustering.autoBuildingOutlineByOrder)) {
    state.autoBuildingOutlineByOrder = clustering.autoBuildingOutlineByOrder.map(Boolean);
    ensureAutoBuildingOutlineFlagsLength();
    return;
  }
  const namesLen = Math.max(1, getAreaNames(AREA_KIND_BUILDING).length);
  const legacy = clustering.autoBuildingOutlineFromClusters;
  state.autoBuildingOutlineByOrder = Array.from({ length: namesLen }, () => legacy !== false);
  ensureAutoBuildingOutlineFlagsLength();
}

function formatLoadedProjectVersionLabel(versionId) {
  const vid = versionId != null ? String(versionId) : "";
  if (!vid || vid === "legacy") return "기존";
  const n = Number(vid);
  if (Number.isFinite(n) && n > 1e11) {
    const d = new Date(n);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
    }
  }
  return vid;
}

function updateHeaderWorkContextLabel() {
  if (!headerWorkContextEl) return;
  let text = "";
  let titleAttr = "";
  if (state.loadedWorkId && state.loadedWorkMeta) {
    const p = String(state.loadedWorkMeta.project || "").trim() || DEFAULT_PROJECT_NAME;
    const t = String(state.loadedWorkMeta.title || "").trim();
    text = t ? `${p} · ${t}` : p;
    titleAttr = "불러온 작업 버전: 프로젝트(그룹) · 버전 제목";
  } else if (state.loadedProjectName) {
    const p = String(state.loadedProjectName).trim();
    const v = formatLoadedProjectVersionLabel(state.loadedProjectVersionId);
    text = `${p} · ${v}`;
    titleAttr = "불러온 동·지하층 윤곽 설정: 설정명 · 저장 시각";
  }
  if (text) {
    headerWorkContextEl.textContent = text;
    headerWorkContextEl.classList.remove("hidden");
    headerWorkContextEl.title = titleAttr;
  } else {
    headerWorkContextEl.textContent = "";
    headerWorkContextEl.classList.add("hidden");
    headerWorkContextEl.removeAttribute("title");
  }
}

function notifyWorkContextChanged() {
  // 저장된 작업/프로젝트를 불러온 직후에는 해당 컨텍스트를 윤곽 설정 목록에 즉시 반영한다.
  // 수동으로 선택해 둔 드롭다운 값보다 "방금 불러온 프로젝트"를 우선한다.
  if (state.loadedWorkMeta?.project) {
    persistSettingsContext(state.loadedWorkMeta.project, state.settingsContextProjectId || "");
  } else if (state.loadedProjectName) {
    persistSettingsContext(state.loadedProjectName, state.settingsContextProjectId || "");
  }
  window.dispatchEvent(new CustomEvent("pilexy:work-context-changed", {
    detail: {
      loadedWorkId: state.loadedWorkId,
      loadedWorkMeta: state.loadedWorkMeta,
      loadedProjectName: state.loadedProjectName,
      hasDataset: state.hasDataset,
      circleCount: Array.isArray(state.circles) ? state.circles.length : 0,
    },
  }));
  updateHeaderWorkContextLabel();
  renderProjectList();
}

function normalizeAreaKind(value) {
  const v = String(value || "").trim().toLowerCase();
  if (
    v === AREA_KIND_PARKING ||
    v === "basement" ||
    v === "underground_parking" ||
    v === "underground-parking" ||
    v === "undergroundparking" ||
    v === "parking_lot" ||
    v === "parkinglot"
  ) {
    return AREA_KIND_PARKING;
  }
  if (v === AREA_KIND_TOWER_CRANE || v === "tower" || v === "tower-crane" || v === "tower_crane") {
    return AREA_KIND_TOWER_CRANE;
  }
  return AREA_KIND_BUILDING;
}

/** kind 필드가 building 으로만 남아 있어도 이름이 Bn·Tn 이면 지하/타워로 취급 (구버전·외부 JSON 호환). */
function resolveBuildingOutlineKind(building) {
  let k = normalizeAreaKind(building?.kind);
  if (k !== AREA_KIND_BUILDING) return k;
  const raw = String(building?.name || "").trim();
  if (!raw) return k;
  const compact = raw.replace(/[\s_\-()/]+/g, "");
  if (/^b\d+$/i.test(compact)) return AREA_KIND_PARKING;
  if (/^t\d+$/i.test(compact)) return AREA_KIND_TOWER_CRANE;
  if (/(지하주차장|지하주차)/.test(raw) || /^지하\s*\d+\s*층/.test(raw)) return AREA_KIND_PARKING;
  return k;
}

function isSlotAreaKind(kind) {
  const k = normalizeAreaKind(kind);
  return k === AREA_KIND_PARKING || k === AREA_KIND_TOWER_CRANE;
}

function getDefaultAreaName(kind, index) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return `B${index + 1}`;
  if (k === AREA_KIND_TOWER_CRANE) return `T${index + 1}`;
  return `동 ${index + 1}`;
}

function getParkingAreaNumber(value, fallbackIndex = 0) {
  const digits = String(value ?? "").match(/\d+/);
  return digits?.[0] || String(fallbackIndex + 1);
}

function normalizeParkingAreaName(value, fallbackIndex = 0) {
  return `B${getParkingAreaNumber(value, fallbackIndex)}`;
}

function normalizeTowerAreaName(value, fallbackIndex = 0) {
  return `T${getParkingAreaNumber(value, fallbackIndex)}`;
}

/** PDAM 시공위치·좌표 building_name 과 동일 규칙 (백엔드 construction_reports._normalize_location 대응) */
function normalizeConstructionLocationValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "미지정";
  const rawCompact = text.replace(/[\s_\-()/]+/g, "");
  const compact = rawCompact.toUpperCase();
  const placeholders = new Set(["", "-", "시공위치", "위치", "미지정", "N/A", "NA"]);
  if (!compact || placeholders.has(rawCompact) || placeholders.has(compact)) return "미지정";
  if (/^BUILDING\d+$/.test(compact)) return "미지정";

  const basementMatch = compact.match(/B(\d+)/);
  if (basementMatch) return `B${parseInt(basementMatch[1], 10)}`;
  if (rawCompact.includes("지하")) {
    const digits = rawCompact.match(/\d+/g);
    if (digits && digits.length) return `B${parseInt(digits[0], 10)}`;
    return "B";
  }
  if (compact === "B" || compact.startsWith("B")) return "B";

  const towerPlain = compact.match(/^T(\d+)$/i);
  if (towerPlain) return `T${parseInt(towerPlain[1], 10)}`;
  const twKoLoc = String(text).match(/(?:타워크레인|타워)\s*(\d+)/i);
  if (twKoLoc) return `T${parseInt(twKoLoc[1], 10)}`;
  const towerSuffix = compact.match(/T(\d+)/i);
  if (towerSuffix) return `T${parseInt(towerSuffix[1], 10)}`;

  const dongMatch = compact.match(/^(\d+)(?:동)?$/);
  if (dongMatch) return `${parseInt(dongMatch[1], 10)}동`;
  if (compact.includes("동")) {
    const digits = compact.match(/\d+/g);
    if (digits && digits.length) return `${parseInt(digits[0], 10)}동`;
  }
  const digitsOnly = compact.match(/^\d+$/);
  if (digitsOnly) return `${parseInt(digitsOnly[0], 10)}동`;
  if (rawCompact.includes("주차장")) return "주차장";
  return compact;
}

function normalizeAreaNameForSearch(value) {
  const raw = String(value || "").trim();
  if (!raw) return "미지정";
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!compact || compact === "-" || compact === "UNASSIGNED" || compact === "미할당" || compact === "미지정") {
    return "미지정";
  }
  const basementMatch = compact.match(/(?:지하|B)(\d+)/i);
  if (basementMatch) {
    return `B${parseInt(basementMatch[1], 10)}`;
  }
  const towerMatch = compact.match(/^T(\d+)$/);
  if (towerMatch) {
    return `T${parseInt(towerMatch[1], 10)}`;
  }
  const twKoSearch = String(raw).match(/(?:타워크레인|타워)\s*(\d+)/i);
  if (twKoSearch) {
    return `T${parseInt(twKoSearch[1], 10)}`;
  }
  const buildingMatch = compact.match(/^(\d+)(?:동)?$/);
  if (buildingMatch) {
    return `${parseInt(buildingMatch[1], 10)}동`;
  }
  return compact;
}

/** 캔버스 검색 그룹·동 이름 목록 정렬 공통 (이미 normalizeAreaNameForSearch 된 키) */
function compareNormalizedAreaSearchKeys(valueA, valueB) {
  const dongA = valueA.match(/^(\d+)동$/);
  const dongB = valueB.match(/^(\d+)동$/);
  if (dongA && dongB) return Number(dongA[1]) - Number(dongB[1]);
  if (dongA) return -1;
  if (dongB) return 1;
  const basementA = valueA.match(/^B(\d+)$/);
  const basementB = valueB.match(/^B(\d+)$/);
  if (basementA && basementB) return Number(basementA[1]) - Number(basementB[1]);
  if (basementA) return -1;
  if (basementB) return 1;
  const towerA = valueA.match(/^T(\d+)$/);
  const towerB = valueB.match(/^T(\d+)$/);
  if (towerA && towerB) return Number(towerA[1]) - Number(towerB[1]);
  if (towerA) return -1;
  if (towerB) return 1;
  if (valueA === "미지정" && valueB !== "미지정") return 1;
  if (valueB === "미지정" && valueA !== "미지정") return -1;
  return valueA.localeCompare(valueB, "ko");
}

function compareDongListNameSortKey(aRaw, bRaw) {
  return compareNormalizedAreaSearchKeys(
    normalizeAreaNameForSearch(aRaw),
    normalizeAreaNameForSearch(bRaw),
  );
}

function normalizeSearchNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits) {
    return String(parseInt(digits, 10));
  }
  return raw.replace(/\s+/g, "").toUpperCase();
}

function getCircleSearchNumberTokens(circle) {
  const tokens = new Set();
  const raw = String(circle?.matched_text?.text || "").trim();
  if (!raw) return tokens;
  tokens.add(raw.replace(/\s+/g, "").toUpperCase());
  const digits = normalizeSearchNumber(raw);
  if (digits) tokens.add(digits);
  const eff = getEffectivePileSequenceNumber(raw);
  if (Number.isInteger(eff) && eff >= 1) tokens.add(String(eff));
  return tokens;
}

function normalizeCanvasSearchId(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCircleIdTokens(circle) {
  const raw = String(circle?.id || "").trim();
  const tokens = new Set();
  if (!raw) return tokens;
  tokens.add(raw.toUpperCase());
  const digits = normalizeCanvasSearchId(raw);
  if (digits) tokens.add(digits);
  return tokens;
}

function getCanvasSearchMode() {
  const active = canvasSearchModeButtons.find((button) => button.classList.contains("is-active"));
  return active?.dataset.canvasSearchMode || "circle-id";
}

function setCanvasSearchMode(mode) {
  const nextMode = mode === "group-number" ? "group-number" : "circle-id";
  canvasSearchModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.canvasSearchMode === nextMode);
  });
  canvasSearchModePanels.forEach((panel) => {
    panel.hidden = panel.dataset.canvasSearchPanel !== nextMode;
  });
  if (canvasSearchPanel) {
    canvasSearchPanel.dataset.mode = nextMode;
  }
}

function getCanvasSearchFocusTarget() {
  return getCanvasSearchMode() === "group-number" ? canvasSearchGroupNumberInput : canvasSearchIdInput;
}

function sanitizeNumericInput(input) {
  if (!input) return;
  const digits = String(input.value || "").replace(/\D/g, "");
  if (input.value !== digits) {
    input.value = digits;
  }
}

function sortCanvasSearchGroups(values) {
  return [...values].sort((a, b) => {
    const valueA = normalizeAreaNameForSearch(a);
    const valueB = normalizeAreaNameForSearch(b);
    return compareNormalizedAreaSearchKeys(valueA, valueB);
  });
}

function getConfiguredCanvasSearchGroups() {
  const groups = new Set();
  const addGroupValue = (value) => {
    const normalized = normalizeAreaNameForSearch(value);
    if (normalized && normalized !== "미지정") {
      groups.add(normalized);
    }
  };
  [
    ...getAreaNames(AREA_KIND_BUILDING),
    ...getAreaNames(AREA_KIND_PARKING),
    ...getAreaNames(AREA_KIND_TOWER_CRANE),
    ...(state.buildings || []).map((building) => building?.name),
  ].forEach(addGroupValue);
  (state.circles || []).forEach((circle) => addGroupValue(circle?.building_name));
  return sortCanvasSearchGroups(groups);
}

function resolveCircleCanvasSearchGroup(circle, configuredGroupsSet = null) {
  const configured = configuredGroupsSet || new Set(getConfiguredCanvasSearchGroups());
  const normalized = normalizeAreaNameForSearch(circle?.building_name);
  return configured.has(normalized) ? normalized : "미지정";
}

function populateCanvasSearchGroupOptions() {
  if (!canvasSearchGroupSelect) return;
  const previousValue = canvasSearchGroupSelect.value;
  const configuredGroups = getConfiguredCanvasSearchGroups();
  const configuredSet = new Set(configuredGroups);
  const hasUnspecified = state.circles.some((circle) => resolveCircleCanvasSearchGroup(circle, configuredSet) === "미지정");
  const groups = hasUnspecified || !configuredGroups.length
    ? [...configuredGroups, "미지정"]
    : configuredGroups;
  canvasSearchGroupSelect.innerHTML = groups
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  if (!groups.length) {
    canvasSearchGroupSelect.innerHTML = '<option value="미지정">미지정</option>';
    canvasSearchGroupSelect.disabled = true;
    return;
  }
  canvasSearchGroupSelect.disabled = false;
  canvasSearchGroupSelect.value = groups.includes(previousValue) ? previousValue : groups[0];
}

function parseCanvasSearchTerm(term) {
  const raw = String(term || "").trim();
  if (!raw) return null;
  const areaNumberMatch = raw.match(/^(.+?)(?:\s*[-/]\s*|\s+)([A-Za-z]?\d+)\s*$/);
  if (areaNumberMatch) {
    return {
      mode: "area-number",
      area: normalizeAreaNameForSearch(areaNumberMatch[1]),
      number: normalizeSearchNumber(areaNumberMatch[2]),
      raw,
    };
  }
  return {
    mode: "circle-id",
    raw,
    normalizedId: raw.toLowerCase(),
  };
}

function buildAreaNameListFromEntries(kind, areaEntries = []) {
  const normalizedKind = normalizeAreaKind(kind);
  if (!Array.isArray(areaEntries) || !areaEntries.length) {
    return [];
  }
  if (isSlotAreaKind(normalizedKind)) {
    const len = getSlotAreaListSpan(normalizedKind, areaEntries);
    return Array.from({ length: len }, (_, order) => {
      const matchedEntry = areaEntries.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order);
      const raw = matchedEntry?.building?.name || getDefaultAreaName(normalizedKind, order);
      return normalizedKind === AREA_KIND_PARKING
        ? normalizeParkingAreaName(raw, order)
        : normalizeTowerAreaName(raw, order);
    });
  }
  return areaEntries.map((entry, order) => entry.building.name || getDefaultAreaName(normalizedKind, order));
}

function getAreaNames(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return state.pendingParkingNames;
  if (k === AREA_KIND_TOWER_CRANE) return state.pendingTowerCraneNames;
  return state.pendingNames;
}

function setAreaNames(kind, names) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) {
    state.pendingParkingNames = (Array.isArray(names) ? names : []).map((name, index) =>
      normalizeParkingAreaName(name, index),
    );
  } else if (k === AREA_KIND_TOWER_CRANE) {
    state.pendingTowerCraneNames = (Array.isArray(names) ? names : []).map((name, index) =>
      normalizeTowerAreaName(name, index),
    );
  } else {
    state.pendingNames = names;
  }
}

function getAreaCountInput(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return parkingCountInput;
  if (k === AREA_KIND_TOWER_CRANE) return towerCraneCountInput;
  return buildingCountInput;
}

function getAreaEditorElement(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return parkingNameEditor;
  if (k === AREA_KIND_TOWER_CRANE) return towerCraneNameEditor;
  return buildingNameEditor;
}

const NAME_LIST_EXPAND_LS_BUILDING = "pilexy:nameListExpandBuilding";
const NAME_LIST_EXPAND_LS_PARKING = "pilexy:nameListExpandParking";
const NAME_LIST_EXPAND_LS_TOWER = "pilexy:nameListExpandTower";

function getNameListExpandStorageKey(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return NAME_LIST_EXPAND_LS_PARKING;
  if (k === AREA_KIND_TOWER_CRANE) return NAME_LIST_EXPAND_LS_TOWER;
  return NAME_LIST_EXPAND_LS_BUILDING;
}

function readNameListExpanded(kind) {
  const key = getNameListExpandStorageKey(kind);
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeNameListExpanded(kind, expanded) {
  const key = getNameListExpandStorageKey(kind);
  try {
    localStorage.setItem(key, expanded ? "1" : "0");
  } catch (_) {}
}

function applyNameListExpandState(kind, expanded) {
  const normalized = normalizeAreaKind(kind);
  const editor = getAreaEditorElement(normalized);
  if (!editor) return;
  const panel = editor.closest(".building-names-panel");
  if (expanded) {
    panel?.classList.add("building-names-panel--name-list-expanded");
    editor.classList.add("building-name-editor--expanded");
  } else {
    panel?.classList.remove("building-names-panel--name-list-expanded");
    editor.classList.remove("building-name-editor--expanded");
  }
}

function syncNameListExpandButton(kind) {
  const normalized = normalizeAreaKind(kind);
  const btn =
    normalized === AREA_KIND_PARKING
      ? toggleParkingNameListExpandBtn
      : normalized === AREA_KIND_TOWER_CRANE
        ? toggleTowerCraneNameListExpandBtn
        : toggleBuildingNameListExpandBtn;
  if (!btn) return;
  btn.textContent = readNameListExpanded(normalized) ? "목록 접기" : "목록 펼치기";
}

function initNameListExpandFromStorage() {
  applyNameListExpandState(AREA_KIND_BUILDING, readNameListExpanded(AREA_KIND_BUILDING));
  applyNameListExpandState(AREA_KIND_PARKING, readNameListExpanded(AREA_KIND_PARKING));
  applyNameListExpandState(AREA_KIND_TOWER_CRANE, readNameListExpanded(AREA_KIND_TOWER_CRANE));
  syncNameListExpandButton(AREA_KIND_BUILDING);
  syncNameListExpandButton(AREA_KIND_PARKING);
  syncNameListExpandButton(AREA_KIND_TOWER_CRANE);
}

function toggleNameListExpanded(kind) {
  const normalized = normalizeAreaKind(kind);
  const next = !readNameListExpanded(normalized);
  writeNameListExpanded(normalized, next);
  applyNameListExpandState(normalized, next);
  syncNameListExpandButton(normalized);
}

function getAreaLabel(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return "지하주차장";
  if (k === AREA_KIND_TOWER_CRANE) return "타워크레인";
  return "동";
}

function normalizeAreaDefinitions(buildings = []) {
  const counters = {
    [AREA_KIND_BUILDING]: 0,
    [AREA_KIND_PARKING]: 0,
    [AREA_KIND_TOWER_CRANE]: 0,
  };
  return (Array.isArray(buildings) ? buildings : []).map((building) => {
    const kind = resolveBuildingOutlineKind(building);
    const order = counters[kind];
    counters[kind] += 1;
    const slot = Number.isFinite(Number(building?.slot)) ? Math.round(Number(building.slot)) : undefined;
    const fallbackIndex = isSlotAreaKind(kind) && Number.isFinite(slot) ? slot : order;
    const {
      drilling_start_elevation: _ignoredDrill,
      foundation_top_elevation: _ignoredFound,
      ...buildingRest
    } = building || {};
    const numDrill = parsePastedLevelToken(building?.drilling_start_elevation);
    const numFound = parsePastedLevelToken(building?.foundation_top_elevation);
    return {
      ...buildingRest,
      kind,
      slot,
      name:
        kind === AREA_KIND_PARKING
          ? normalizeParkingAreaName(building?.name, fallbackIndex)
          : kind === AREA_KIND_TOWER_CRANE
            ? normalizeTowerAreaName(building?.name, fallbackIndex)
            : String(building?.name || "").trim() || getDefaultAreaName(kind, order),
      vertices: Array.isArray(building?.vertices)
        ? building.vertices.map((vertex) => ({
            x: Number(vertex.x),
            y: Number(vertex.y),
          }))
        : [],
      ...(numDrill !== undefined ? { drilling_start_elevation: numDrill } : {}),
      ...(numFound !== undefined ? { foundation_top_elevation: numFound } : {}),
    };
  });
}

function serializeBuildingDefinitions(buildings = state.buildings) {
  const counters = {
    [AREA_KIND_BUILDING]: 0,
    [AREA_KIND_PARKING]: 0,
    [AREA_KIND_TOWER_CRANE]: 0,
  };
  return (Array.isArray(buildings) ? buildings : [])
    .filter((building) => Array.isArray(building?.vertices) && building.vertices.length >= 3)
    .map((building) => {
      const kind = resolveBuildingOutlineKind(building);
      const order = counters[kind];
      counters[kind] += 1;
      const slot = Number(building?.slot);
      const fallbackIndex = isSlotAreaKind(kind) && Number.isFinite(slot) ? Math.round(slot) : order;
      const numDrill = parsePastedLevelToken(building?.drilling_start_elevation);
      const numFound = parsePastedLevelToken(building?.foundation_top_elevation);
      return {
        name:
          kind === AREA_KIND_PARKING
            ? normalizeParkingAreaName(building?.name, fallbackIndex)
            : kind === AREA_KIND_TOWER_CRANE
              ? normalizeTowerAreaName(building?.name, fallbackIndex)
              : String(building?.name || "").trim() || getDefaultAreaName(kind, order),
        kind,
        slot: Number.isFinite(slot) ? Math.round(slot) : undefined,
        vertices: (building.vertices || []).map((vertex) => ({
          x: Number(vertex.x),
          y: Number(vertex.y),
        })),
        ...(numDrill !== undefined ? { drilling_start_elevation: numDrill } : {}),
        ...(numFound !== undefined ? { foundation_top_elevation: numFound } : {}),
      };
    });
}

function getAreasByKind(kind, buildings = state.buildings) {
  const targetKind = normalizeAreaKind(kind);
  const result = [];
  (Array.isArray(buildings) ? buildings : []).forEach((building, actualIndex) => {
    if (resolveBuildingOutlineKind(building) !== targetKind) return;
    result.push({ actualIndex, order: result.length, building });
  });
  return result;
}

function getAreaSlot(entry, fallbackOrder = 0) {
  const raw = Number(entry?.building?.slot);
  return Number.isFinite(raw) ? raw : fallbackOrder;
}

/** 슬롯 기반 구역(지하주차장·타워크레인): 폴리곤 개수와 slot 범위 중 큰 값 */
function getSlotAreaListSpan(kind, areas = getAreasByKind(kind)) {
  if (!Array.isArray(areas) || !areas.length) return 0;
  const maxSlot = Math.max(...areas.map((entry, order) => getAreaSlot(entry, order)));
  return Math.max(areas.length, maxSlot + 1);
}

function getParkingAreaListSpan(areas) {
  return getSlotAreaListSpan(AREA_KIND_PARKING, areas);
}

function setAreasByKind(kind, nextAreas) {
  const normalizedKind = normalizeAreaKind(kind);
  const normalizedAreas = normalizeAreaDefinitions(
    (Array.isArray(nextAreas) ? nextAreas : []).map((area) => ({
      ...area,
      kind: normalizedKind,
    })),
  );
  if (isSlotAreaKind(normalizedKind)) {
    normalizedAreas.sort((left, right) => {
      const leftSlot = Number(left?.slot);
      const rightSlot = Number(right?.slot);
      const safeLeft = Number.isFinite(leftSlot) ? leftSlot : 0;
      const safeRight = Number.isFinite(rightSlot) ? rightSlot : 0;
      return safeLeft - safeRight;
    });
  }
  const buildingAreas =
    normalizedKind === AREA_KIND_BUILDING
      ? normalizedAreas
      : getAreasByKind(AREA_KIND_BUILDING).map((entry) => entry.building);
  const parkingAreas =
    normalizedKind === AREA_KIND_PARKING
      ? normalizedAreas
      : getAreasByKind(AREA_KIND_PARKING).map((entry) => entry.building);
  const towerAreas =
    normalizedKind === AREA_KIND_TOWER_CRANE
      ? normalizedAreas
      : getAreasByKind(AREA_KIND_TOWER_CRANE).map((entry) => entry.building);
  state.buildings = [...buildingAreas, ...parkingAreas, ...towerAreas];
}

function syncAreaCountInputs() {
  if (buildingCountInput) {
    const areasLen = getAreasByKind(AREA_KIND_BUILDING).length;
    const namesLen = getAreaNames(AREA_KIND_BUILDING).length;
    buildingCountInput.value = Math.max(1, areasLen, namesLen);
  }
  if (parkingCountInput) {
    const span = getSlotAreaListSpan(AREA_KIND_PARKING);
    const namesLen = getAreaNames(AREA_KIND_PARKING).length;
    parkingCountInput.value = Math.max(0, span, namesLen);
  }
  if (towerCraneCountInput) {
    const span = getSlotAreaListSpan(AREA_KIND_TOWER_CRANE);
    const namesLen = getAreaNames(AREA_KIND_TOWER_CRANE).length;
    towerCraneCountInput.value = Math.max(0, span, namesLen);
  }
}

function getConfiguredAreaCount(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const minimum = isSlotAreaKind(normalizedKind) ? 0 : 1;
  const input = getAreaCountInput(normalizedKind);
  const parsed = Number(input?.value);
  if (Number.isFinite(parsed)) {
    return Math.max(minimum, Math.round(parsed));
  }
  const areasLen = getAreasByKind(normalizedKind).length;
  const namesLen = getAreaNames(normalizedKind).length;
  return Math.max(minimum, areasLen, namesLen);
}

function normalizeProjectName(value) {
  return (String(value || "").trim() || DEFAULT_PROJECT_NAME);
}

function normalizeSourceType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return DEFAULT_SOURCE_TYPE;
  if (raw === "vendor_prepared" || raw === "vendor" || raw === "partner" || raw === "outsourced" || raw === "업체 작성") {
    return "vendor_prepared";
  }
  return "contractor_original";
}

function getSourceTypeLabel(value) {
  const normalized = normalizeSourceType(value);
  const match = SOURCE_TYPE_OPTIONS.find((item) => item.value === normalized);
  return match ? match.label : SOURCE_TYPE_OPTIONS[0].label;
}

function getSourceTypeBadgeHtml(value, extraClass = "") {
  const normalized = normalizeSourceType(value);
  const className = ["source-type-badge", extraClass].filter(Boolean).join(" ");
  const fullLabel = getSourceTypeLabel(normalized);
  let label = fullLabel;
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width: 767px)").matches
  ) {
    if (normalized === "contractor_original") label = "시";
    else if (normalized === "vendor_prepared") label = "업";
  }
  const titleAttr = ` title="${escapeHtml(fullLabel)}"`;
  const ariaAttr = ` aria-label="${escapeHtml(fullLabel)}"`;
  return `<span class="${className}" data-source-type="${normalized}"${titleAttr}${ariaAttr}>${escapeHtml(label)}</span>`;
}

function setProjectContext(projectName, sourceType) {
  const normalizedProject = normalizeProjectName(projectName);
  const normalizedSourceType = normalizeSourceType(sourceType);
  if (projectNameInput) {
    projectNameInput.value = normalizedProject;
  }
  if (projectSourceTypeSelect) {
    projectSourceTypeSelect.value = normalizedSourceType;
  }
  state.loadedProjectSourceType = normalizedSourceType;
}

function getActiveProjectName() {
  if (projectNameInput && String(projectNameInput.value || "").trim()) {
    return normalizeProjectName(projectNameInput.value);
  }
  if (state.loadedWorkMeta?.project) {
    return normalizeProjectName(state.loadedWorkMeta.project);
  }
  if (state.loadedProjectName) {
    return normalizeProjectName(state.loadedProjectName);
  }
  return DEFAULT_PROJECT_NAME;
}

/**
 * 동·지하층 윤곽 설정 저장 범위를 현재 "작업 프로젝트" 기준으로 분리한다.
 * - 작업 불러오기 메타(project)가 있으면 최우선
 * - 없으면 불러오기 패널의 프로젝트 필터 선택값 사용
 * - 둘 다 없으면 기본 컨텍스트
 */
function getCurrentSettingsContextProject() {
  const selectedContext = readSettingsContextSelection();
  if (selectedContext) return selectedContext.project;
  syncSettingsContextFromUi();
  if (state.settingsContextProjectId && state.settingsContextProject) return state.settingsContextProject;
  if (state.settingsContextProject) return state.settingsContextProject;
  if (state.loadedWorkMeta?.project) {
    return normalizeProjectName(state.loadedWorkMeta.project);
  }
  return DEFAULT_PROJECT_NAME;
}

function normalizeSettingsContextProjectId(value) {
  return String(value || "").trim();
}

function getCurrentSettingsContextProjectId() {
  const selectedContext = readSettingsContextSelection();
  if (selectedContext) return selectedContext.projectId;
  syncSettingsContextFromUi();
  if (state.settingsContextProjectId) return state.settingsContextProjectId;
  const hiddenId = normalizeSettingsContextProjectId(meissaProjectIdInput?.value);
  if (hiddenId) return hiddenId;
  const selectedId = normalizeSettingsContextProjectId(meissaProjectSelect?.value);
  if (selectedId) return selectedId;
  return "";
}

function persistSettingsContext(projectName, projectId) {
  const payload = {
    project: projectName ? normalizeProjectName(projectName) : "",
    projectId: normalizeSettingsContextProjectId(projectId),
  };
  state.settingsContextProject = payload.project;
  state.settingsContextProjectId = payload.projectId;
  try {
    localStorage.setItem(SETTINGS_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function restoreSettingsContext() {
  try {
    const raw = localStorage.getItem(SETTINGS_CONTEXT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.settingsContextProject = parsed?.project ? normalizeProjectName(parsed.project) : "";
    state.settingsContextProjectId = normalizeSettingsContextProjectId(parsed?.projectId);
  } catch (_) {
    state.settingsContextProject = "";
    state.settingsContextProjectId = "";
  }
}

function syncSettingsContextFromUi() {
  const pid = normalizeSettingsContextProjectId(meissaProjectIdInput?.value || meissaProjectSelect?.value);
  if (!pid) return;
  let pname = "";
  if (meissaProjectSelect && meissaProjectSelect.selectedIndex >= 0) {
    const option = meissaProjectSelect.options[meissaProjectSelect.selectedIndex];
    const label = option ? String(option.textContent || "").trim() : "";
    if (label && label !== "프로젝트 선택") pname = normalizeProjectName(label);
  }
  if (!pname) pname = state.settingsContextProject || "";
  persistSettingsContext(pname, pid);
}

function buildSettingsContextOptionValue(projectName, projectId) {
  return JSON.stringify({
    project: normalizeProjectName(projectName),
    projectId: normalizeSettingsContextProjectId(projectId),
  });
}

function readSettingsContextSelection() {
  if (!settingsContextSelect) return null;
  const raw = String(settingsContextSelect.value || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const project = parsed?.project ? normalizeProjectName(parsed.project) : "";
    if (!project) return null;
    return {
      project,
      projectId: normalizeSettingsContextProjectId(parsed?.projectId),
    };
  } catch (_) {
    return null;
  }
}

function renderSettingsContextSelect(list) {
  if (!settingsContextSelect) return;
  const currentSelection = readSettingsContextSelection();
  const currentValue = currentSelection
    ? buildSettingsContextOptionValue(currentSelection.project, currentSelection.projectId)
    : "";

  const contextMap = new Map();
  function addContext(project, projectId) {
    const pid = normalizeSettingsContextProjectId(projectId);
    const pname = project ? normalizeProjectName(project) : "";
    if (!pname && !pid) return;
    const projectLabel = pname || (pid ? `프로젝트 ${pid}` : "");
    if (!projectLabel) return;
    const key = pid ? `id:${pid}` : `name:${projectLabel}`;
    if (contextMap.has(key)) return;
    contextMap.set(key, { project: projectLabel, projectId: pid });
  }
  if (meissaProjectSelect) {
    const skipLabels = new Set(["프로젝트 선택", "프로젝트 없음"]);
    for (const opt of meissaProjectSelect.options) {
      const projectId = normalizeSettingsContextProjectId(opt.value);
      if (!projectId) continue;
      const label = String(opt.textContent || "").trim();
      if (!label || skipLabels.has(label)) continue;
      addContext(label, projectId);
    }
  }
  (Array.isArray(list) ? list : []).forEach((item) => {
    const project = item?.contextProject ? normalizeProjectName(item.contextProject) : "";
    const projectId = normalizeSettingsContextProjectId(item?.contextProjectId);
    if (!project) return;
    addContext(project, projectId);
  });

  const sorted = [...contextMap.values()].sort((a, b) => {
    const na = `${a.project}${a.projectId ? ` (${a.projectId})` : ""}`;
    const nb = `${b.project}${b.projectId ? ` (${b.projectId})` : ""}`;
    return na.localeCompare(nb, "ko");
  });

  settingsContextSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "프로젝트 선택";
  settingsContextSelect.appendChild(placeholder);

  sorted.forEach((ctx) => {
    const option = document.createElement("option");
    option.value = buildSettingsContextOptionValue(ctx.project, ctx.projectId);
    option.textContent = ctx.projectId ? `${ctx.project} (${ctx.projectId})` : ctx.project;
    settingsContextSelect.appendChild(option);
  });

  const persistedValue = state.settingsContextProject
    ? buildSettingsContextOptionValue(state.settingsContextProject, state.settingsContextProjectId)
    : "";
  // 불러오기/저장으로 갱신된 최신 컨텍스트를 수동 선택보다 우선 적용한다.
  const preferred = [persistedValue, currentValue].find(
    (value) => value && [...settingsContextSelect.options].some((opt) => opt.value === value),
  );
  settingsContextSelect.value = preferred || "";
}

function getActiveSourceType() {
  if (projectSourceTypeSelect && projectSourceTypeSelect.value) {
    return normalizeSourceType(projectSourceTypeSelect.value);
  }
  if (state.loadedWorkMeta?.sourceType) {
    return normalizeSourceType(state.loadedWorkMeta.sourceType);
  }
  if (state.loadedProjectSourceType) {
    return normalizeSourceType(state.loadedProjectSourceType);
  }
  return DEFAULT_SOURCE_TYPE;
}

function appendManualHistoryQueryParams(params) {
  if (!params) return;
  params.set("reuse_manual_history", state.reuseManualHistory ? "true" : "false");
  if (state.reuseManualHistory && state.manualHistoryReferenceWorkId) {
    params.set("manual_history_reference_work_id", state.manualHistoryReferenceWorkId);
  }
}

function syncManualHistoryReuseControlsFromState() {
  if (manualHistoryReuseToggle) {
    manualHistoryReuseToggle.checked = Boolean(state.reuseManualHistory);
  }
  if (manualHistoryReferenceWorkSelect) {
    manualHistoryReferenceWorkSelect.disabled = !state.reuseManualHistory;
    const wid = state.manualHistoryReferenceWorkId || "";
    if (wid && [...manualHistoryReferenceWorkSelect.options].some((o) => o.value === wid)) {
      manualHistoryReferenceWorkSelect.value = wid;
    } else if (!wid) {
      manualHistoryReferenceWorkSelect.value = "";
    }
  }
}

function readManualHistoryReuseControlsToState() {
  if (manualHistoryReuseToggle) {
    state.reuseManualHistory = Boolean(manualHistoryReuseToggle.checked);
  }
  if (manualHistoryReferenceWorkSelect && !manualHistoryReferenceWorkSelect.disabled) {
    const v = String(manualHistoryReferenceWorkSelect.value || "").trim();
    state.manualHistoryReferenceWorkId = v || null;
  }
}

/** 수동 매칭 히스토리 재적용 API 본문 (불러온 작업은 circles/texts로 서버 원시 데이터 동기화) */
function buildManualHistoryRefreshRequestBody() {
  const baseCircles =
    state.sourceCircles && state.sourceCircles.length > 0 ? state.sourceCircles : state.circles;
  const baseTexts =
    state.sourceCircles && state.sourceCircles.length > 0 ? state.sourceTexts || [] : state.texts;
  const fv = state.filter || DEFAULT_FILTER;
  const body = {
    project_context: getActiveProjectName(),
    source_type: getActiveSourceType(),
    reuse_manual_history: state.reuseManualHistory,
    history_reference_work_id:
      state.reuseManualHistory && state.manualHistoryReferenceWorkId ? state.manualHistoryReferenceWorkId : null,
    history_reference_source_type: null,
  };
  if (baseCircles && baseCircles.length > 0) {
    body.circles = baseCircles;
    body.texts = Array.isArray(baseTexts) ? baseTexts : [];
    body.filter = {
      min_diameter: fv.minDiameter,
      max_diameter: fv.maxDiameter,
      min_area: null,
      max_area: null,
      text_height_min: fv.textHeightMin,
      text_height_max: fv.textHeightMax,
      max_match_distance: fv.maxMatchDistance,
      text_reference_point: fv.textReferencePoint || "center",
    };
    body.expected_buildings = getDesiredBuildingCount();
    body.max_distance_from_seed = getClusteringSetting("maxDistanceFromSeed", 30);
    body.merge_seed_distance = getClusteringSetting("mergeSeedDistance", 20);
    if (state.buildings && state.buildings.length > 0) {
      body.buildings = serializeBuildingDefinitions(state.buildings);
    }
    const mergedMo = {};
    const mo = state.manualOverrides || {};
    (baseCircles || []).forEach((c) => {
      if (!c.matched_text_id) return;
      if (c.manual_match === true || mo[c.id] === c.matched_text_id) {
        mergedMo[c.id] = c.matched_text_id;
      }
    });
    if (Object.keys(mergedMo).length > 0) {
      body.manual_overrides = mergedMo;
    }
    if (state.rawPolylines && state.rawPolylines.length > 0) {
      body.polylines = state.rawPolylines;
    }
  }
  return body;
}

async function applyManualHistoryMatchSettings() {
  readManualHistoryReuseControlsToState();
  if (!state.hasDataset) {
    setUploadStatus("먼저 DXF를 업로드하거나 작업을 불러오세요.", true);
    return;
  }
  if (state.reuseManualHistory && !state.manualHistoryReferenceWorkId) {
    setUploadStatus("수동 매칭 재사용을 켠 상태에서는 참고할 저장 작업 버전을 하나 선택하세요.", true);
    return;
  }
  const originalLabel = manualHistoryMatchApplyBtn ? manualHistoryMatchApplyBtn.textContent : "";
  if (manualHistoryMatchApplyBtn) {
    manualHistoryMatchApplyBtn.disabled = true;
    manualHistoryMatchApplyBtn.textContent = "적용 중…";
  }
  try {
    setPhase("matching", 40);
    setUploadStatus("수동 매칭 히스토리 설정 적용 중…");
    const body = buildManualHistoryRefreshRequestBody();
    const response = await fetch(`${API_BASE_URL}/api/circles/refresh-manual-history-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.detail || payload?.message || response.statusText;
      const msg = typeof detail === "string" ? detail : "요청 실패";
      throw new Error(msg);
    }
    handlePayload(payload);
    setPhase("ready", 100);
    setTimeout(() => setPhase("idle"), 400);
    setUploadStatus(
      state.reuseManualHistory
        ? "히스토리 기준으로 수동 매칭을 다시 적용했습니다."
        : "히스토리 재사용 없이 매칭을 다시 계산했습니다.",
    );
  } catch (e) {
    console.error(e);
    setPhase("error");
    setUploadStatus(parseErrorMessage(e), true);
  } finally {
    if (manualHistoryMatchApplyBtn) {
      manualHistoryMatchApplyBtn.disabled = false;
      manualHistoryMatchApplyBtn.textContent = originalLabel || "적용";
    }
  }
}

function renderMatchCorrectionsPanel() {
  if (!matchCorrectionsList || !matchCorrectionsCount) return;
  const items = Array.isArray(state.matchCorrections) ? state.matchCorrections : [];
  matchCorrectionsCount.textContent = `${items.length}건`;
  if (!items.length) {
    matchCorrectionsList.innerHTML = '<div class="empty-row">아직 자동 재적용된 수동 매칭이 없습니다.</div>';
    return;
  }
  matchCorrectionsList.innerHTML = items
    .map((item) => {
      const circleId = item.circle_id || "";
      const textId = item.matched_text_id || "";
      const buildingName = item.building_name || "미할당";
      const sourceLabel = getSourceTypeLabel(item.history_source_type);
      const origin = item.history_work_title || item.history_project || "이전 저장본";
      return `
        <button type="button" class="match-correction-item" data-circle-id="${escapeHtml(circleId)}" data-text-id="${escapeHtml(textId)}">
          <div class="match-correction-item-top">
            <strong>${escapeHtml(buildingName)} · ${escapeHtml(item.matched_text_value || "-")}</strong>
            <span>${escapeHtml(circleId)}</span>
          </div>
          <div class="match-correction-item-meta">
            <span>좌표 (${formatNumber(item.circle_center_x)}, ${formatNumber(item.circle_center_y)})</span>
            <span>${escapeHtml(sourceLabel)} · ${escapeHtml(origin)}</span>
          </div>
        </button>
      `;
    })
    .join("");
  matchCorrectionsList.querySelectorAll(".match-correction-item").forEach((button) => {
    button.addEventListener("click", () => {
      const circleId = button.getAttribute("data-circle-id") || "";
      const textId = button.getAttribute("data-text-id") || "";
      state.highlightedCircleIds = new Set(circleId ? [circleId] : []);
      state.highlightedTextIds = new Set(textId ? [textId] : []);
      if (circleId) {
        focusOnCircles([circleId]);
      } else {
        requestRedraw();
      }
    });
  });
}

const view = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function getCanvasSize() {
  const width = canvasDisplayWidth || canvas.clientWidth || canvas.width || 1024;
  const height = canvasDisplayHeight || canvas.clientHeight || canvas.height || 640;
  return { width, height };
}

/** 마우스 이벤트를 캔버스 논리 좌표(0~width, 0~height)로 변환. 줌/레이아웃과 무관하게 히트 감지 정확도 보정 */
function getCanvasCoordsFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const { width, height } = getCanvasSize();
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}

/** 터치 이벤트를 마우스 이벤트와 호환되는 객체로 변환 (clientX, clientY 포함) */
function touchToMouseLike(touchEvent, useChangedTouches) {
  const t = useChangedTouches && touchEvent.changedTouches && touchEvent.changedTouches[0]
    ? touchEvent.changedTouches[0]
    : (touchEvent.touches && touchEvent.touches[0] ? touchEvent.touches[0] : null);
  if (!t) return null;
  return { clientX: t.clientX, clientY: t.clientY, button: 0 };
}

/** 두 터치 사이 거리와 캔버스 좌표상 중심 반환 (메인 캔버스) */
function getPinchStateMain(touches) {
  if (!touches || touches.length < 2) return null;
  const rect = canvas.getBoundingClientRect();
  const { width, height } = getCanvasSize();
  const t0 = touches[0], t1 = touches[1];
  const clientX = (t0.clientX + t1.clientX) / 2, clientY = (t0.clientY + t1.clientY) / 2;
  const centerX = ((clientX - rect.left) / rect.width) * width;
  const centerY = ((clientY - rect.top) / rect.height) * height;
  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  return { centerX, centerY, dist };
}

let canvasRect = canvas.getBoundingClientRect();
let isPanning = false;
let panStart = { x: 0, y: 0 };
let mouseDownPos = null;
/** 핀치 줌 상태 (두 손가락 확대/축소) */
let isPinching = false;
let pinchStartDist = 0;
let pinchStartCenter = null;
let pinchStartScale = 1;
let pinchWorldAnchor = null;
const VIEW_SCALE_MIN = 0.1;
const VIEW_SCALE_MAX = 500;

/** 휠 deltaY를 픽셀 단위로 근사(deltaMode 보정). CAD 뷰어류와 비슷한 커서 기준 줌에 사용. */
function wheelDeltaYPixels(event, referenceHeightPx) {
  let dy = Number(event.deltaY) || 0;
  if (event.deltaMode === 1) dy *= 16;
  else if (event.deltaMode === 2) dy *= Math.max(320, referenceHeightPx || 400);
  return dy;
}

/** Y축 반전 월드(도면) 좌표계: 포인터 아래 월드점을 고정한 채 scale만 변경 */
function zoomViewAtCanvasPoint(viewRef, width, height, canvasX, canvasY, nextScale, scaleMin, scaleMax) {
  const lo = scaleMin ?? VIEW_SCALE_MIN;
  const hi = scaleMax ?? VIEW_SCALE_MAX;
  const clamped = Math.max(lo, Math.min(hi, nextScale));
  if (Math.abs(clamped - viewRef.scale) < 1e-12) return;
  const worldBefore = {
    x: (canvasX - width / 2) / viewRef.scale + viewRef.offsetX,
    y: (height / 2 - canvasY) / viewRef.scale + viewRef.offsetY,
  };
  viewRef.scale = clamped;
  const worldAfter = {
    x: (canvasX - width / 2) / viewRef.scale + viewRef.offsetX,
    y: (height / 2 - canvasY) / viewRef.scale + viewRef.offsetY,
  };
  viewRef.offsetX += worldBefore.x - worldAfter.x;
  viewRef.offsetY += worldBefore.y - worldAfter.y;
}

let hoveredCircleId = null;
let tooltipMouseClientX = 0;
let tooltipMouseClientY = 0;
let canvasDisplayWidth = 0;
let canvasDisplayHeight = 0;
let canvasPixelRatio = window.devicePixelRatio || 1;
let needsRedraw = true;
let rafHandle = null;

function openMeissaCompareDrawer() {
  if (!meissaDrawer) return;
  const widInput = document.getElementById("meissa-work-id");
  if (widInput && state.loadedWorkId && !widInput.value.trim()) {
    widInput.value = state.loadedWorkId;
  }
  meissaDrawer.classList.add("open");
  meissaDrawer.setAttribute("aria-hidden", "false");
  pilexySendVirtualPageView("/pilexy/drone-compare", "드론(3D) · PDAM 비교");
  document.dispatchEvent(new CustomEvent("pilexy-meissa-drawer-open"));
}

function closeMeissaCompareDrawer() {
  if (!meissaDrawer) return;
  meissaDrawer.classList.remove("open");
  meissaDrawer.setAttribute("aria-hidden", "true");
}

/** DXF 업로드·파싱 완료 또는 작업 불러오기 후에만 드론(3D) 비교 헤더 버튼 활성화 */
function syncMeissaCompareBtnEnabled() {
  if (!meissaCompareBtn) return;
  const ok = Boolean(state.hasDataset);
  meissaCompareBtn.disabled = !ok;
  meissaCompareBtn.title = ok ? "" : "DXF 업로드 또는 작업 불러오기 후 사용할 수 있습니다.";
}

function init() {
  if (!uploadForm) return;
  restoreSettingsContext();
  initGoogleAnalyticsFromStorage();
  pilexySendVirtualPageView("/pilexy/main", "파일 마스터 · 메인");
  window.__PILEXY_GET_MEISSA_CONTEXT__ = function pilexyGetMeissaContext() {
    return {
      circles: (state.circles || []).map((c) => ({
        id: c.id,
        center_x: c.center_x,
        center_y: c.center_y,
        center_z: c.center_z,
        radius: c.radius,
        diameter: c.diameter,
        building_name: c.building_name,
        layer: c.layer,
        matched_text: c.matched_text ? { text: c.matched_text.text } : null,
      })),
      workId: state.loadedWorkId || null,
      projectContext: getActiveProjectName(),
    };
  };
  updateUploadButtonState();
  renderPendingNameEditor();
  updateSummaryCards();
  updateCircleTable();
  updateDuplicatesTable();
  updateErrorsTable();
  renderBuildingTabs();
  populateBuildingSelect();
  updateManualSelectionDisplay();
  updateManualPickButtonStyles();
  renderMatchCorrectionsPanel();
  syncManualHistoryReuseControlsFromState();
  initClusteringSettings();
  updateCircleTable();
  reconcileProjectList();
  renderProjectList();
  updateProjectButtonState();
  renderLoadWorkList();
  setPhase("idle");
  setCanvasSearchMode("circle-id");
  populateCanvasSearchGroupOptions();
  bindEvents();
  handleResize();
  updateCanvasModeHint();
  updateCanvasSearchAvailability();
  syncMeissaCompareBtnEnabled();
  initNameListExpandFromStorage();
  syncBuildingOutlineAutoUi();
  requestRedraw();
}

/**
 * 클러스터링 설정 패널 초기화
 */
function initClusteringSettings() {
  if (clusteringSettingsContent) {
    clusteringSettingsContent.style.display = "none";
  }
  if (toggleClusteringSettingsBtn) {
    toggleClusteringSettingsBtn.textContent = "펼치기";
  }
}

function bindEvents() {
  if (gaSetupTriggerBtn) {
    gaSetupTriggerBtn.addEventListener("click", handleGaSetupTrigger);
  }
  uploadForm.addEventListener("submit", handleUpload);
  fileInput.addEventListener("change", () => {
    updateUploadButtonState();
    if (!fileInput.files?.[0] || uploadButton.disabled) return;
    const filterValues = getFilterValuesFromInputs();
    if (!filterValues) return;
    handleUpload({ preventDefault() {} });
  });
  applyFilterBtn.addEventListener("click", applyFilterFromPanel);
  if (filterPileNumberHyphenInput) {
    filterPileNumberHyphenInput.addEventListener("change", () => {
      const h = !!filterPileNumberHyphenInput.checked;
      state.filter = {
        ...state.filter,
        pileNumberHyphenFormat: h,
      };
      if (state.circles?.length) {
        refreshMatchDerivedUIState();
        updateCircleTable();
      } else {
        updateBuildingSeqSummary();
      }
    });
  }
  if (filterTowerCraneNumberInput) {
    filterTowerCraneNumberInput.addEventListener("change", () => {
      const t = !!filterTowerCraneNumberInput.checked;
      state.filter = {
        ...state.filter,
        towerCraneNumberFormat: t,
      };
      if (state.circles?.length) {
        refreshMatchDerivedUIState();
        updateCircleTable();
      } else {
        updateBuildingSeqSummary();
      }
    });
  }
  if (filterExcludeIdenticalGeometryDuplicatesInput) {
    filterExcludeIdenticalGeometryDuplicatesInput.addEventListener("change", () => {
      state.filter = {
        ...state.filter,
        excludeIdenticalGeometryDuplicates: !!filterExcludeIdenticalGeometryDuplicatesInput.checked,
      };
      if (state.circles?.length) {
        refreshMatchDerivedUIState();
        updateDuplicatesTable();
        updateSummaryCards();
        requestRedraw();
      }
    });
  }
  if (manualHistoryReuseToggle) {
    manualHistoryReuseToggle.addEventListener("change", () => {
      readManualHistoryReuseControlsToState();
      syncManualHistoryReuseControlsFromState();
    });
  }
  if (manualHistoryReferenceWorkSelect) {
    manualHistoryReferenceWorkSelect.addEventListener("change", () => {
      readManualHistoryReuseControlsToState();
    });
  }
  if (manualHistoryMatchApplyBtn) {
    manualHistoryMatchApplyBtn.addEventListener("click", () => applyManualHistoryMatchSettings());
  }
  downloadCsvBtn.addEventListener("click", () => triggerDownload("csv"));
  downloadXlsxBtn.addEventListener("click", () => triggerDownload("xlsx"));
  if (canvasSearchToggleBtn) {
    canvasSearchToggleBtn.addEventListener("click", () => toggleCanvasSearchPanel());
  }
  if (canvasSearchApplyBtn) {
    canvasSearchApplyBtn.addEventListener("click", runCanvasSearch);
  }
  canvasSearchModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCanvasSearchMode(button.dataset.canvasSearchMode || "circle-id");
      window.requestAnimationFrame(() => getCanvasSearchFocusTarget()?.focus());
    });
  });
  [canvasSearchIdInput, canvasSearchGroupNumberInput].forEach((input) => {
    input?.addEventListener("input", () => sanitizeNumericInput(input));
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runCanvasSearch();
      } else if (event.key === "Escape") {
        event.preventDefault();
        toggleCanvasSearchPanel(false);
      }
    });
  });

  togglePointsInput.addEventListener("change", (event) => {
    state.showPoints = event.target.checked;
    requestRedraw();
  });
  toggleCirclesInput.addEventListener("change", (event) => {
    state.showCircles = event.target.checked;
    requestRedraw();
  });
  toggleTextsInput.addEventListener("change", (event) => {
    state.showTextLabels = event.target.checked;
    requestRedraw();
  });
  if (toggleMatchLinesInput) {
    toggleMatchLinesInput.checked = state.showMatchLines !== false;
    toggleMatchLinesInput.addEventListener("change", (event) => {
      state.showMatchLines = event.target.checked;
      requestRedraw();
    });
  }
  if (toggleFoundationLabelVizInput) {
    toggleFoundationLabelVizInput.checked = state.showFoundationLabelViz !== false;
    toggleFoundationLabelVizInput.addEventListener("change", (event) => {
      state.showFoundationLabelViz = event.target.checked;
      requestRedraw();
    });
  }
  if (togglePfPolyLinkVizInput) {
    togglePfPolyLinkVizInput.checked = state.showPfPolyLinkViz !== false;
    togglePfPolyLinkVizInput.addEventListener("change", (event) => {
      state.showPfPolyLinkViz = event.target.checked;
      requestRedraw();
    });
  }
  if (toggleFoundationAreaHatchVizInput) {
    toggleFoundationAreaHatchVizInput.checked = Boolean(state.construction?.foundationAreaHatchVisible);
    toggleFoundationAreaHatchVizInput.addEventListener("change", (event) => {
      if (!state.construction) state.construction = {};
      state.construction.foundationAreaHatchVisible = event.target.checked;
      const panelHatchBtn = document.getElementById("construction-foundation-hatch-visibility");
      if (panelHatchBtn) {
        const hatchOn = Boolean(state.construction.foundationAreaHatchVisible);
        panelHatchBtn.textContent = hatchOn ? "가시성 끄기" : "가시성 켜기";
        panelHatchBtn.title = hatchOn
          ? "캔버스 면적 해치를 숨깁니다 (지표 선택은 유지됩니다)."
          : "면적 해치를 다시 표시합니다.";
        panelHatchBtn.setAttribute("aria-pressed", hatchOn ? "false" : "true");
      }
      requestRedraw();
    });
  }
  if (toggleBuildingHatchInput) {
    toggleBuildingHatchInput.checked = state.showBuildingHatch !== false;
    toggleBuildingHatchInput.addEventListener("change", (event) => {
      state.showBuildingHatch = event.target.checked;
      requestRedraw();
    });
  }
  if (toggleParkingHatchInput) {
    toggleParkingHatchInput.checked = state.showParkingHatch !== false;
    toggleParkingHatchInput.addEventListener("change", (event) => {
      state.showParkingHatch = event.target.checked;
      requestRedraw();
    });
  }
  if (toggleTowerCraneHatchInput) {
    toggleTowerCraneHatchInput.checked = state.showTowerCraneHatch !== false;
    toggleTowerCraneHatchInput.addEventListener("change", (event) => {
      state.showTowerCraneHatch = event.target.checked;
      requestRedraw();
    });
  }
  if (toggleAreaListFocusInput) {
    toggleAreaListFocusInput.checked = Boolean(state.enableAreaListHitFocus);
    toggleAreaListFocusInput.addEventListener("change", (event) => {
      state.enableAreaListHitFocus = Boolean(event.target.checked);
    });
  }

  manualPickCircleBtn.addEventListener("click", () => activateManualPick("circle"));
  manualPickTextBtn.addEventListener("click", () => activateManualPick("text"));
  manualApplyBtn.addEventListener("click", handleManualApply);
  manualClearBtn.addEventListener("click", handleManualClear);
  manualRemoveLinkBtn.addEventListener("click", handleManualRemoveLink);

  addBuildingNameBtn.addEventListener("click", handleAddBuildingName);
  if (toggleBuildingNameListExpandBtn) {
    toggleBuildingNameListExpandBtn.addEventListener("click", () => toggleNameListExpanded(AREA_KIND_BUILDING));
  }
  applyBuildingNamesBtn.addEventListener("click", handleApplyBuildingNames);
  if (applyBuildingCountBtn) applyBuildingCountBtn.addEventListener("click", handleApplyBuildingCount);
  if (toggleEditBuildingsBtn) toggleEditBuildingsBtn.addEventListener("click", toggleBuildingEditMode);
  if (toggleEditParkingsBtn) toggleEditParkingsBtn.addEventListener("click", toggleBuildingEditMode);
  if (toggleEditTowerCranesBtn) toggleEditTowerCranesBtn.addEventListener("click", toggleBuildingEditMode);
  if (canvasToggleEditBuildingsBtn) canvasToggleEditBuildingsBtn.addEventListener("click", toggleBuildingEditMode);
  if (generateBuildingOutlinesBtn) generateBuildingOutlinesBtn.addEventListener("click", handleGenerateBuildingOutlines);
  applyBuildingsBtn.addEventListener("click", handleApplyBuildings);
  if (applyParkingsBtn) applyParkingsBtn.addEventListener("click", handleApplyParkings);
  if (applyTowerCranesBtn) applyTowerCranesBtn.addEventListener("click", handleApplyTowerCranes);
  if (saveBuildingDrillingBtn) {
    saveBuildingDrillingBtn.addEventListener("click", () => {
      void handleSaveDrillingElevations(AREA_KIND_BUILDING);
    });
  }
  if (saveParkingDrillingBtn) {
    saveParkingDrillingBtn.addEventListener("click", () => {
      void handleSaveDrillingElevations(AREA_KIND_PARKING);
    });
  }
  if (saveTowerCraneDrillingBtn) {
    saveTowerCraneDrillingBtn.addEventListener("click", () => {
      void handleSaveDrillingElevations(AREA_KIND_TOWER_CRANE);
    });
  }
  buildingCountInput.addEventListener("change", handleBuildingCountChange);
  if (parkingCountInput) parkingCountInput.addEventListener("change", handleParkingCountChange);
  if (towerCraneCountInput) towerCraneCountInput.addEventListener("change", handleTowerCraneCountChange);
  if (toggleParkingNameListExpandBtn) {
    toggleParkingNameListExpandBtn.addEventListener("click", () => toggleNameListExpanded(AREA_KIND_PARKING));
  }
  if (toggleTowerCraneNameListExpandBtn) {
    toggleTowerCraneNameListExpandBtn.addEventListener("click", () =>
      toggleNameListExpanded(AREA_KIND_TOWER_CRANE),
    );
  }
  if (addParkingNameBtn) addParkingNameBtn.addEventListener("click", handleAddParkingName);
  if (addTowerCraneNameBtn) addTowerCraneNameBtn.addEventListener("click", handleAddTowerCraneName);
  if (applyParkingNamesBtn) applyParkingNamesBtn.addEventListener("click", handleApplyParkingNames);
  if (applyTowerCraneNamesBtn) applyTowerCraneNamesBtn.addEventListener("click", handleApplyTowerCraneNames);
  if (applyParkingCountBtn) applyParkingCountBtn.addEventListener("click", handleApplyParkingCount);
  if (applyTowerCraneCountBtn) applyTowerCraneCountBtn.addEventListener("click", handleApplyTowerCraneCount);
  
  toggleClusteringSettingsBtn.addEventListener("click", toggleClusteringSettings);
  applyClusteringSettingsBtn.addEventListener("click", handleApplyClusteringSettings);
  document.addEventListener("keydown", (e) => {
    if (!state.buildingOutlinePickMode) return;
    if (e.key === "Enter") {
      e.preventDefault();
      confirmBuildingOutlinePolylinePick();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelBuildingOutlinePolylinePick();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!state.retainingWallPickMode) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancelRetainingWallPickMode();
      setUploadStatus("흙막이 라인 선택을 종료했습니다.");
      updateCanvasModeHint();
      requestRedraw();
    }
  });

  const rwSelectBtn = document.getElementById("retaining-wall-select-btn");
  const rwClearBtn = document.getElementById("retaining-wall-clear-btn");
  const rwComputeBtn = document.getElementById("retaining-wall-compute-btn");
  if (rwSelectBtn) rwSelectBtn.addEventListener("click", () => beginRetainingWallLinePick());
  if (rwClearBtn) {
    rwClearBtn.addEventListener("click", () => {
      if (state.retainingWallPickMode?.selectedIds) {
        state.retainingWallPickMode.selectedIds.clear();
        setUploadStatus("흙막이 라인 선택을 모두 해제했습니다.");
        updateCanvasModeHint();
        requestRedraw();
      }
      const rwRes = document.getElementById("retaining-wall-results");
      const rwSt = document.getElementById("retaining-wall-status");
      if (rwRes) rwRes.innerHTML = "";
      if (rwSt) rwSt.textContent = "";
      state.retainingWallComputedRows = [];
      state.retainingWallResultsContext = null;
      state.retainingWallStatusPrefix = "";
      clearRetainingWallViz();
      requestRedraw();
    });
  }
  if (rwComputeBtn) rwComputeBtn.addEventListener("click", () => computeRetainingWallDistancesForPiles());
  const rwResultsEl = document.getElementById("retaining-wall-results");
  if (rwResultsEl && !rwResultsEl.dataset.rwUiBound) {
    rwResultsEl.dataset.rwUiBound = "1";
    rwResultsEl.addEventListener("click", handleRetainingWallResultsClick);
  }
  const rwPanelBody = document.querySelector(".retaining-wall-panel-body");
  if (rwPanelBody && !rwPanelBody.dataset.rwModeBound) {
    rwPanelBody.dataset.rwModeBound = "1";
    rwPanelBody.addEventListener("change", (e) => {
      if (e.target?.name === "retaining-wall-dist-mode" && state.retainingWallComputedRows?.length) {
        renderRetainingWallResultsTable();
        requestRedraw();
      }
      if (e.target?.id === "retaining-wall-viz-all") {
        state.retainingWallVizAllEnabled = !!e.target.checked;
        requestRedraw();
      }
    });
  }

  const brdsPresetBtns = document.querySelectorAll("button[data-brds-preset]");
  brdsPresetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-brds-preset");
      const ta = document.getElementById("header-brds-extra-question");
      const text = BRDS_PRESET_QUESTIONS[key];
      if (ta && text) {
        const cur = (ta.value || "").trim();
        ta.value = cur ? `${cur}\n\n${text}` : text;
      }
    });
  });
  const brdsSubmitBtn = document.getElementById("header-brds-submit-btn");
  if (brdsSubmitBtn) {
    brdsSubmitBtn.addEventListener("click", () => void submitBrdsPrugioQuestion());
  }

  if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", handleSaveProject);
  }
  if (updateProjectBtn) {
    updateProjectBtn.addEventListener("click", handleUpdateProject);
  }
  if (projectNameInput) {
    projectNameInput.addEventListener("input", updateProjectButtonState);
    projectNameInput.addEventListener("blur", updateProjectButtonState);
  }
  if (projectSourceTypeSelect) {
    projectSourceTypeSelect.addEventListener("change", () => {
      state.loadedProjectSourceType = normalizeSourceType(projectSourceTypeSelect.value);
      updateProjectButtonState();
    });
  }
  if (meissaProjectSelect) {
    meissaProjectSelect.addEventListener("change", () => {
      syncSettingsContextFromUi();
      renderProjectList();
    });
  }
  if (meissaProjectIdInput) {
    meissaProjectIdInput.addEventListener("change", () => {
      syncSettingsContextFromUi();
      renderProjectList();
    });
  }
  if (settingsContextSelect) {
    settingsContextSelect.addEventListener("change", () => {
      const selected = readSettingsContextSelection();
      if (selected) persistSettingsContext(selected.project, selected.projectId);
      renderProjectList();
    });
  }
  if (refreshProjectListBtn) {
    refreshProjectListBtn.addEventListener("click", () => {
      reconcileProjectList();
      renderProjectList();
      updateProjectButtonState();
    });
  }

  if (saveWorkBtn) {
    saveWorkBtn.addEventListener("click", () => openSaveWorkModal(false));
  }
  if (saveWorkUpdateBtn) {
    saveWorkUpdateBtn.addEventListener("click", () => openSaveWorkModal(true));
  }
  if (saveWorkModalCancel) {
    saveWorkModalCancel.addEventListener("click", closeSaveWorkModal);
  }
  if (saveWorkModalSubmit) {
    saveWorkModalSubmit.addEventListener("click", submitSaveWorkModal);
  }
  if (saveWorkProjectSelect) {
    saveWorkProjectSelect.addEventListener("change", () => {
      const isCustom = saveWorkProjectSelect.value === SAVE_WORK_PROJECT_CUSTOM_VALUE;
      if (saveWorkProjectCustomWrap) saveWorkProjectCustomWrap.style.display = isCustom ? "block" : "none";
      if (isCustom && saveWorkProjectCustom) saveWorkProjectCustom.focus();
    });
  }
  if (saveWorkAuthorSelect) {
    saveWorkAuthorSelect.addEventListener("change", () => {
      const isCustom = saveWorkAuthorSelect.value === SAVE_WORK_AUTHOR_CUSTOM_VALUE;
      if (saveWorkAuthorCustomWrap) saveWorkAuthorCustomWrap.style.display = isCustom ? "block" : "none";
      if (isCustom && saveWorkAuthorCustom) saveWorkAuthorCustom.focus();
    });
  }
  if (saveWorkOverwriteSelect) {
    saveWorkOverwriteSelect.addEventListener("change", async () => {
      const id = (saveWorkOverwriteSelect.value || "").trim();
      if (!id) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (saveWorkTitleInput) saveWorkTitleInput.value = (data.title || "").trim() || "";
        const proj = (data.project || "").trim() || "기본";
        const sourceType = normalizeSourceType(data.sourceType);
        if (saveWorkProjectSelect) {
          if ([...saveWorkProjectSelect.options].some((o) => o.value === proj)) saveWorkProjectSelect.value = proj;
          else saveWorkProjectSelect.value = SAVE_WORK_PROJECT_CUSTOM_VALUE;
          if (saveWorkProjectCustom) saveWorkProjectCustom.value = proj;
          if (saveWorkProjectCustomWrap) saveWorkProjectCustomWrap.style.display = saveWorkProjectSelect.value === SAVE_WORK_PROJECT_CUSTOM_VALUE ? "block" : "none";
        }
        if (saveWorkSourceTypeSelect) {
          saveWorkSourceTypeSelect.value = sourceType;
        }
        const auth = (data.author || "").trim() || "";
        if (saveWorkAuthorSelect) {
          if ([...saveWorkAuthorSelect.options].some((o) => o.value === auth)) saveWorkAuthorSelect.value = auth;
          else {
            saveWorkAuthorSelect.value = SAVE_WORK_AUTHOR_CUSTOM_VALUE;
            if (saveWorkAuthorCustom) saveWorkAuthorCustom.value = auth;
            if (saveWorkAuthorCustomWrap) saveWorkAuthorCustomWrap.style.display = "block";
          }
        }
      } catch (_) {}
    });
  }
  if (saveWorkModal) {
    const backdrop = saveWorkModal.querySelector(".save-work-modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeSaveWorkModal);
    saveWorkModal.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && saveWorkModal.classList.contains("open")) {
        e.preventDefault();
        submitSaveWorkModal();
      }
    });
  }
  if (loadWorkBtn) {
    loadWorkBtn.addEventListener("click", async () => {
      openLoadWorkListPanel();
      await renderLoadWorkList();
    });
  }
  if (loadWorkListRefresh) {
    loadWorkListRefresh.addEventListener("click", () => renderLoadWorkList());
  }
  if (loadWorkListClose) {
    loadWorkListClose.addEventListener("click", () => closeLoadWorkListPanel());
  }
  if (loadWorkListPanel) {
    const loadBackdrop = loadWorkListPanel.querySelector(".load-work-modal-backdrop");
    if (loadBackdrop) loadBackdrop.addEventListener("click", () => closeLoadWorkListPanel());
    loadWorkListPanel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLoadWorkListPanel();
    });
  }
  if (loadWorkProjectSearch) {
    loadWorkProjectSearch.addEventListener("input", () => renderLoadWorkProjects());
  }
  if (loadWorkVersionSearch) {
    loadWorkVersionSearch.addEventListener("input", () => renderLoadWorkItems(selectedLoadProject));
  }

  if (versionCompareBtn) {
    versionCompareBtn.addEventListener("click", openVersionComparePanel);
  }
  if (meissaCompareBtn) {
    meissaCompareBtn.addEventListener("click", openMeissaCompareDrawer);
  }
  if (meissaDrawerClose) {
    meissaDrawerClose.addEventListener("click", closeMeissaCompareDrawer);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !meissaDrawer?.classList.contains("open")) return;
    closeMeissaCompareDrawer();
  });
  if (versionCompareClose) {
    versionCompareClose.addEventListener("click", closeVersionComparePanel);
  }
  if (versionCompareProject) {
    versionCompareProject.addEventListener("change", () => {
      fillVersionCompareOldNewByProject(versionCompareProject.value || "");
      resetVersionCompareExcelCompareResult();
      void restoreVersionCompareExcelResultFromCache();
    });
  }
  if (versionCompareOldSource) {
    versionCompareOldSource.addEventListener("change", () => {
      updateVersionCompareVersionOptions("old");
      resetVersionCompareExcelCompareResult();
    });
  }
  if (versionCompareNewSource) {
    versionCompareNewSource.addEventListener("change", () => {
      updateVersionCompareVersionOptions("new");
      resetVersionCompareExcelCompareResult();
    });
  }
  if (versionCompareOld) {
    versionCompareOld.addEventListener("change", resetVersionCompareExcelCompareResult);
  }
  if (versionCompareNew) {
    versionCompareNew.addEventListener("change", resetVersionCompareExcelCompareResult);
  }
  if (versionCompareApply) {
    versionCompareApply.addEventListener("click", runVersionCompare);
  }
  if (versionCompareExcelToggle) {
    versionCompareExcelToggle.addEventListener("click", () => {
      openVersionCompareExcelModal();
      if (!versionCompareExcelInspection) {
        resetVersionCompareExcelInspectState();
      }
    });
  }
  if (versionCompareExcelInspect) {
    versionCompareExcelInspect.addEventListener("click", inspectVersionCompareExcelFile);
  }
  if (versionCompareExcelBuildingSource) {
    versionCompareExcelBuildingSource.querySelectorAll("[data-building-source-mode]").forEach((button) => {
      button.addEventListener("click", () => setVersionCompareExcelBuildingSourceMode(button.dataset.buildingSourceMode || "sheet"));
    });
  }
  if (versionCompareExcelSheet) {
    versionCompareExcelSheet.addEventListener("change", () => handleVersionCompareExcelSheetChange(versionCompareExcelSheet.value));
  }
  if (versionCompareExcelHeaderRow) {
    versionCompareExcelHeaderRow.addEventListener("input", () => {
      setVersionCompareExcelHeaderRow(versionCompareExcelHeaderRow.value);
      resetVersionCompareExcelCompareResult();
    });
  }
  if (versionCompareExcelApply) {
    versionCompareExcelApply.addEventListener("click", runVersionCompareExcelCompare);
  }
  if (versionCompareExcelIssues) {
    versionCompareExcelIssues.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const filterBtn = target.closest("[data-vc-excel-filter]");
      if (!(filterBtn instanceof HTMLElement)) return;
      const nextFilter = String(filterBtn.dataset.vcExcelFilter || "all");
      if (!nextFilter || versionCompareExcelIssueFilter === nextFilter) return;
      versionCompareExcelIssueFilter = nextFilter;
      if (versionCompareExcelLastResult) {
        renderVersionCompareExcelResult(versionCompareExcelLastResult, versionCompareExcelLastRenderOptions);
      }
    });
  }
  if (versionCompareExcelFile) {
    versionCompareExcelFile.addEventListener("change", async () => {
      resetVersionCompareExcelInspectState();
      resetVersionCompareExcelCompareResult();
      if (versionCompareExcelFile.files?.length) {
        setVersionCompareExcelStatus("새 엑셀 파일을 확인하는 중입니다.");
        openVersionCompareExcelModal();
        await inspectVersionCompareExcelFile();
        await restoreVersionCompareExcelResultFromCache();
      } else {
        setVersionCompareExcelStatus("");
      }
    });
  }
  if (versionCompareExcelModalClose) {
    versionCompareExcelModalClose.addEventListener("click", closeVersionCompareExcelModal);
  }
  if (versionCompareExcelBackdrop) {
    versionCompareExcelBackdrop.addEventListener("click", closeVersionCompareExcelModal);
  }
  if (versionCompareExcelModal) {
    versionCompareExcelModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeVersionCompareExcelModal();
      }
    });
  }
  if (versionCompareCanvas) {
    versionCompareCanvas.addEventListener("mousedown", handleVersionCompareCanvasMouseDown);
    versionCompareCanvas.addEventListener("mousemove", handleVersionCompareCanvasMouseMove);
    versionCompareCanvas.addEventListener("mouseup", handleVersionCompareCanvasMouseUp);
    versionCompareCanvas.addEventListener("mouseleave", handleVersionCompareCanvasMouseLeave);
    versionCompareCanvas.addEventListener("wheel", handleVersionCompareCanvasWheel, { passive: false });
    versionCompareCanvas.addEventListener("click", handleVersionCompareCanvasClick);
    versionCompareCanvas.addEventListener("touchstart", handleVersionCompareCanvasTouchStart, { passive: true });
    versionCompareCanvas.addEventListener("touchmove", handleVersionCompareCanvasTouchMove, { passive: false });
    versionCompareCanvas.addEventListener("touchend", handleVersionCompareCanvasTouchEnd, { passive: true });
    versionCompareCanvas.addEventListener("touchcancel", handleVersionCompareCanvasTouchEnd, { passive: true });
  }

  window.addEventListener("resize", handleResize);

  canvas.addEventListener("mousedown", handleCanvasMouseDown);
  canvas.addEventListener("mousemove", handleCanvasMouseMove);
  canvas.addEventListener("mouseup", handleCanvasMouseUp);
  canvas.addEventListener("mouseleave", handleCanvasMouseUp);
  canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
  canvas.addEventListener("dblclick", handleCanvasDoubleClick);
  // 모바일 터치 팬/드래그 지원
  canvas.addEventListener("touchstart", handleCanvasTouchStart, { passive: true });
  canvas.addEventListener("touchmove", handleCanvasTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleCanvasTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", handleCanvasTouchEnd, { passive: true });

  syncBuildingEditModeButtons();
  updateHeaderWorkContextLabel();
}

function appendBrdsManualContent(block) {
  const el = document.getElementById("header-brds-manual-content");
  if (!el || block == null) return;
  const piece = String(block).trim();
  if (!piece) return;
  const cur = (el.value || "").trim();
  el.value = cur ? `${cur}\n\n---\n\n${piece}` : piece;
}

function getBrdsManualEmbedIframe() {
  return document.getElementById("construction-brds-manual-iframe");
}

function setBrdsManualEmbedSrcFromPath(iframePath) {
  const el = getBrdsManualEmbedIframe();
  if (!el || !iframePath) return false;
  const raw = String(API_BASE_URL || "").trim();
  const base = (raw ? raw.replace(/\/$/, "") : window.location.origin.replace(/\/$/, ""));
  const p = String(iframePath).startsWith("/") ? String(iframePath) : `/${iframePath}`;
  el.src = `${base}${p}`;
  return true;
}

function navigateBrdsManualEmbedTo(absUrl) {
  const el = getBrdsManualEmbedIframe();
  if (!el || !absUrl) return;
  try {
    const u = new URL(absUrl);
    u.searchParams.set("_pilexy_ts", String(Date.now()));
    el.src = u.toString();
  } catch {
    const s = String(absUrl);
    const sep = s.includes("?") ? "&" : "?";
    el.src = `${s}${sep}_pilexy_ts=${Date.now()}`;
  }
}

/** 시공 매뉴얼 iframe 수동 이동: "sso" = 바로넷, 그 외 = 푸르지오 매뉴얼 */
function navigateBrdsManualEmbed(kind) {
  if (kind === "sso") {
    navigateBrdsManualEmbedTo(BRDS_DEFAULT_SSO_URL);
    return;
  }
  navigateBrdsManualEmbedTo(BRDS_DEFAULT_TARGET_PAGE_URL);
}

/** 최상위 창에서 BRDS 열기 — iframe 보다 로그인·세션 유지에 유리 */
function openBrdsUrlInNewWindow(kind) {
  const url = kind === "sso" ? BRDS_DEFAULT_SSO_URL : BRDS_DEFAULT_TARGET_PAGE_URL;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    /* noop */
  }
}

function setBrdsLoginFeedback(message, state) {
  const el = document.getElementById("header-brds-login-feedback");
  if (!el) return;
  el.textContent = message ?? "";
  if (state === "ok") {
    el.dataset.state = "ok";
  } else if (state === "err") {
    el.dataset.state = "err";
  } else {
    el.removeAttribute("data-state");
  }
}

function parseBrdsHttpDetail(data, fallback) {
  const d = data?.detail ?? data?.message ?? fallback;
  let msg = "요청 실패";
  if (typeof d === "string") msg = d;
  else if (d && typeof d === "object" && !Array.isArray(d) && typeof d.message === "string") msg = d.message;
  else if (Array.isArray(d)) msg = d.map((x) => (x && typeof x === "object" && x.msg ? x.msg : String(x))).join("; ");
  else if (d != null) msg = String(d);
  return msg;
}

function renderBrdsManualDebugTrace(payload) {
  const pre = document.getElementById("header-brds-debug-trace");
  if (!pre) return;
  const rows = Array.isArray(payload)
    ? payload
    : payload?.debugTrace || (payload?.detail && typeof payload.detail === "object" ? payload.detail.debugTrace : null);
  if (!Array.isArray(rows) || !rows.length) {
    pre.textContent = "(단계 로그 없음 — 위 체크박스로 수집 켜기)";
    return;
  }
  pre.textContent = rows
    .map((r, i) => {
      const loc = r.location ?? "";
      const hid = r.hypothesisId ?? "";
      const msg = r.message ?? "";
      const ts = r.timestamp != null ? new Date(Number(r.timestamp)).toISOString() : "";
      const dataStr = r.data && Object.keys(r.data).length ? JSON.stringify(r.data) : "";
      return `${i + 1}. [${ts}] ${loc}${hid ? " ·" + hid : ""} — ${msg}${dataStr ? "\n   " + dataStr : ""}`;
    })
    .join("\n\n");
}

async function postBrdsPrugioManualApi({ userId, password, loginOnly }) {
  const debugSteps = document.getElementById("header-brds-debug-steps")?.checked !== false;
  const res = await fetch(`${API_BASE_URL}/api/brds/prugio-manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      password,
      ssoEntryUrl: BRDS_DEFAULT_SSO_URL,
      targetPageUrl: BRDS_DEFAULT_TARGET_PAGE_URL,
      loginOnly: !!loginOnly,
      debugSteps,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = parseBrdsHttpDetail(data, res.statusText);
    const err = new Error(msg);
    const det = data?.detail;
    if (det && typeof det === "object" && Array.isArray(det.debugTrace)) {
      err.debugTrace = det.debugTrace;
    }
    renderBrdsManualDebugTrace(data);
    throw err;
  }
  renderBrdsManualDebugTrace(data);
  return data;
}

/** 서버가 파싱한 SSO 폼을 iframe 이름으로 제출(로그인 쿠키를 iframe 컨텍스트에 남기기 위함) */
function submitBrdsSsoFormIntoIframe(payload) {
  if (!payload?.ok || !payload.action || !payload.fields || typeof payload.fields !== "object") return false;
  const iframeName = "pilexy-brds-manual-embed";
  const form = document.createElement("form");
  const method = String(payload.method || "POST").toUpperCase();
  form.method = method === "GET" ? "GET" : "POST";
  form.action = String(payload.action);
  form.target = iframeName;
  form.enctype = "application/x-www-form-urlencoded";
  form.setAttribute("accept-charset", "UTF-8");
  form.style.cssText =
    "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;height:0;width:0;overflow:hidden";
  for (const [k, v] of Object.entries(payload.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v ?? "");
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    setTimeout(() => {
      try {
        form.remove();
      } catch {
        /* noop */
      }
    }, 4000);
  }
  return true;
}

async function postBrdsSurfSessionApi({ userId, password }) {
  const res = await fetch(`${API_BASE_URL}/api/brds/surf-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      userId,
      password,
      ssoEntryUrl: BRDS_DEFAULT_SSO_URL,
      targetPageUrl: BRDS_DEFAULT_TARGET_PAGE_URL,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = parseBrdsHttpDetail(data, res.statusText);
    throw new Error(msg);
  }
  return data;
}

async function postBrdsSsoIframeAutopostApi({ userId, password }) {
  const debugSteps = document.getElementById("header-brds-debug-steps")?.checked !== false;
  const res = await fetch(`${API_BASE_URL}/api/brds/sso-iframe-autopost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      password,
      ssoEntryUrl: BRDS_DEFAULT_SSO_URL,
      debugSteps,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = parseBrdsHttpDetail(data, res.statusText);
    const err = new Error(msg);
    const det = data?.detail;
    if (det && typeof det === "object" && Array.isArray(det.debugTrace)) {
      err.debugTrace = det.debugTrace;
    }
    renderBrdsManualDebugTrace(data);
    throw err;
  }
  renderBrdsManualDebugTrace(data);
  return data;
}

async function postBrdsPrugioAskApi({ userId, password, question }) {
  const res = await fetch(`${API_BASE_URL}/api/brds/prugio-ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      password,
      question,
      ssoEntryUrl: BRDS_DEFAULT_SSO_URL,
      targetPageUrl: BRDS_DEFAULT_TARGET_PAGE_URL,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data?.detail || data?.message || res.statusText;
    throw new Error(typeof d === "string" ? d : "요청 실패");
  }
  return data;
}

async function fetchBrdsManualLogin(triggerBtn) {
  const userId = document.getElementById("header-brds-user-id")?.value?.trim() ?? "";
  const password = document.getElementById("header-brds-password")?.value ?? "";
  if (!userId || !password) {
    setBrdsLoginFeedback("아이디와 비밀번호를 입력하세요.", "err");
    return;
  }
  setBrdsLoginFeedback("로그인 확인 중…");
  const orig = triggerBtn?.textContent;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "처리 중…";
  }
  try {
    const data = await postBrdsPrugioManualApi({ userId, password, loginOnly: true });
    const okLine =
      data.message || (data.loggedIn ? "로그인에 성공했습니다." : "서버에서 로그인 응답을 받았습니다.");

    let iframeNote = "";
    try {
      const surf = await postBrdsSurfSessionApi({ userId, password });
      if (surf?.ok && surf.iframePath && setBrdsManualEmbedSrcFromPath(surf.iframePath)) {
        iframeNote = " 아래 iframe 은 서버 역프록시로 BRDS 를 열었습니다(세션은 서버에 보관).";
      } else {
        throw new Error("surf");
      }
    } catch (surfErr) {
      console.warn(surfErr);
      try {
        const auto = await postBrdsSsoIframeAutopostApi({ userId, password });
        if (auto?.ok && auto.action && auto.fields && submitBrdsSsoFormIntoIframe(auto)) {
          iframeNote = " 아래 iframe 에 바로넷 로그인 폼을 제출했습니다.";
        } else {
          navigateBrdsManualEmbed("sso");
          iframeNote = auto?.message
            ? ` iframe 은 바로넷 로그인 화면으로 열었습니다. (${auto.message})`
            : " iframe 은 바로넷 로그인 화면으로 열었습니다.";
        }
      } catch (inner) {
        console.warn(inner);
        navigateBrdsManualEmbed("sso");
        iframeNote = " iframe 은 바로넷 로그인 화면으로 열었습니다. (역프록시·자동 폼 실패)";
      }
    }

    setBrdsLoginFeedback(`${okLine}${iframeNote}`, "ok");
    setUploadStatus("로그인 확인됨");
  } catch (e) {
    console.error(e);
    const msg = parseErrorMessage(e);
    setBrdsLoginFeedback(msg, "err");
    setUploadStatus(msg, true);
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = orig || "로그인";
    }
  }
}

async function fetchBrdsPrugioManual(triggerBtn) {
  const userId = document.getElementById("header-brds-user-id")?.value?.trim() ?? "";
  const password = document.getElementById("header-brds-password")?.value ?? "";
  const statusEl = document.getElementById("header-brds-status");
  const manualEl = document.getElementById("header-brds-manual-content");
  if (!userId || !password) {
    if (statusEl) statusEl.textContent = "매뉴얼을 가져오려면 아이디와 비밀번호를 입력하세요.";
    return;
  }
  if (statusEl) statusEl.textContent = "로그인 후 매뉴얼 본문을 가져오는 중…";
  const orig = triggerBtn?.textContent;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "불러오는 중…";
  }
  try {
    const data = await postBrdsPrugioManualApi({ userId, password, loginOnly: false });
    if (manualEl && data.content != null) manualEl.value = String(data.content);
    if (statusEl) {
      let msg =
        data.source === "relay"
          ? "릴레이로 매뉴얼 본문을 받았습니다."
          : "서버 세션으로 로그인한 뒤 페이지 본문을 텍스트로 변환했습니다.";
      if (data.fetchedUrl) msg += ` URL: ${data.fetchedUrl}`;
      statusEl.textContent = msg;
    }
    setUploadStatus("매뉴얼 본문을 불러왔습니다.");
  } catch (e) {
    console.error(e);
    const msg = parseErrorMessage(e);
    if (statusEl) statusEl.textContent = msg;
    setUploadStatus(msg, true);
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = orig || "매뉴얼 불러오기";
    }
  }
}

/** 매뉴얼 본문 + 기본 질문 ①②를 순서대로 요청합니다. */
async function runBrdsManualAutoPipeline(triggerBtn) {
  const userId = document.getElementById("header-brds-user-id")?.value?.trim() ?? "";
  const password = document.getElementById("header-brds-password")?.value ?? "";
  const statusEl = document.getElementById("header-brds-status");
  const manualEl = document.getElementById("header-brds-manual-content");
  const extraTa = document.getElementById("header-brds-extra-question");
  if (!userId || !password) {
    if (statusEl) statusEl.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }
  const orig = triggerBtn?.textContent;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "진행 중…";
  }
  const bodyParts = [];
  try {
    if (statusEl) statusEl.textContent = "매뉴얼 본문을 가져오는 중…";
    const manualData = await postBrdsPrugioManualApi({ userId, password, loginOnly: false });
    if (manualData.content != null && String(manualData.content).trim()) {
      bodyParts.push(`【매뉴얼 본문】\n${String(manualData.content).trim()}`);
    }

    const presetKeys = ["1", "2"];
    for (let i = 0; i < presetKeys.length; i += 1) {
      const key = presetKeys[i];
      const qtext = BRDS_PRESET_QUESTIONS[key];
      if (!qtext) continue;
      if (statusEl) statusEl.textContent = `기본 질문 ${i + 1}/${presetKeys.length} 전송 중…`;
      if (extraTa) extraTa.value = qtext;
      const askData = await postBrdsPrugioAskApi({ userId, password, question: qtext });
      let answerPart = "";
      if (askData.ok && askData.answer != null && String(askData.answer).length) {
        answerPart = String(askData.answer);
      } else if (askData.ok && askData.answer != null && !String(askData.answer).length && askData.raw) {
        answerPart =
          typeof askData.raw === "string" ? askData.raw : JSON.stringify(askData.raw, null, 2);
      } else {
        answerPart = askData.message || "(자동 답변 없음)";
      }
      bodyParts.push(`【질문 ${key}】\n${qtext}\n\n【답변】\n${answerPart}`);
    }
    if (manualEl) manualEl.value = bodyParts.join("\n\n---\n\n");
    if (statusEl) {
      statusEl.textContent = "매뉴얼과 기본 질문 처리를 마쳤습니다.";
    }
    setUploadStatus("매뉴얼·질문 자동 실행 완료");
  } catch (e) {
    console.error(e);
    const msg = parseErrorMessage(e);
    if (statusEl) statusEl.textContent = msg;
    setUploadStatus(msg, true);
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = orig || "한 번에 가져오기";
    }
  }
}

window.pilexyFetchBrdsPrugioManual = fetchBrdsPrugioManual;
window.pilexyFetchBrdsManualLogin = fetchBrdsManualLogin;
window.pilexyRunBrdsManualAutoPipeline = runBrdsManualAutoPipeline;
window.pilexyNavigateBrdsManualEmbed = navigateBrdsManualEmbed;
window.pilexyOpenBrdsUrlInNewWindow = openBrdsUrlInNewWindow;

async function submitBrdsPrugioQuestion() {
  const userId = document.getElementById("header-brds-user-id")?.value?.trim() ?? "";
  const password = document.getElementById("header-brds-password")?.value ?? "";
  const extra = document.getElementById("header-brds-extra-question")?.value?.trim() ?? "";
  const statusEl = document.getElementById("header-brds-status");
  const manualEl = document.getElementById("header-brds-manual-content");
  if (!extra) {
    if (statusEl) statusEl.textContent = "질문 내용을 입력하거나 프리셋 버튼으로 채우세요.";
    return;
  }
  if (!userId || !password) {
    if (statusEl) statusEl.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }
  if (statusEl) statusEl.textContent = "요청 중…";
  try {
    const res = await fetch(`${API_BASE_URL}/api/brds/prugio-ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        password,
        question: extra,
        ssoEntryUrl: BRDS_DEFAULT_SSO_URL,
        targetPageUrl: BRDS_DEFAULT_TARGET_PAGE_URL,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data?.detail || data?.message || res.statusText;
      throw new Error(typeof d === "string" ? d : "요청 실패");
    }
    if (data.ok && data.answer != null && String(data.answer).length) {
      appendBrdsManualContent(`【질문】\n${extra}\n\n【답변】\n${String(data.answer)}`);
      if (statusEl) statusEl.textContent = data.relay ? "릴레이에서 답변을 받았습니다." : "답변을 받았습니다.";
      return;
    }
    if (data.ok && data.answer != null && !String(data.answer).length && data.raw) {
      const rawBlock =
        typeof data.raw === "string" ? data.raw : JSON.stringify(data.raw, null, 2);
      appendBrdsManualContent(`【질문】\n${extra}\n\n【응답】\n${rawBlock}`);
      if (statusEl) statusEl.textContent = "릴레이 응답을 그대로 붙였습니다.";
      return;
    }
    const msg =
      data.message || "자동 답변 없음: 사내 릴레이가 없거나 응답에 답변 필드가 없습니다. 서버 설정을 확인하세요.";
    if (statusEl) statusEl.textContent = msg;
    if (manualEl && !manualEl.value.trim() && data.ssologin_url) {
      manualEl.placeholder = `웹에 로그인한 뒤 내용을 복사해 여기에 붙여넣으세요.\n${data.ssologin_url}`;
    }
  } catch (e) {
    console.error(e);
    if (statusEl) statusEl.textContent = parseErrorMessage(e);
  }
}

function syncViewerToolbarDetailsOpen() {
  const el = document.getElementById("viewer-toolbar-details");
  if (!el) return;
  const wide = window.matchMedia("(min-width: 768px)").matches;
  if (wide) {
    el.open = true;
  }
}

function handleResize() {
  const parent = canvas.parentElement;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
  const vw = window.innerWidth || document.documentElement.clientWidth || 800;
  const parentRect = parent ? parent.getBoundingClientRect() : null;
  const rawW =
    parentRect && parentRect.width > 0 ? parentRect.width : vw * 0.65;
  const minW = vw <= 640 ? 80 : 520;
  const width = Math.max(minW, Math.floor(Math.min(rawW, vw - 16)));
  const minH = vw <= 640 ? 200 : 540;
  let height;
  if (parentRect && parentRect.height > 100) {
    height = Math.max(minH, Math.floor(parentRect.height));
  } else {
    height = Math.max(minH, viewportHeight - 220);
  }
  canvasDisplayWidth = width;
  canvasDisplayHeight = height;
  const ratio = window.devicePixelRatio || 1;
  canvasPixelRatio = ratio;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  canvasRect = canvas.getBoundingClientRect();
  syncViewerToolbarDetailsOpen();
  requestRedraw();
}



function requestRedraw() {
  needsRedraw = true;
  if (rafHandle) return;
  rafHandle = window.requestAnimationFrame(() => {
    rafHandle = null;
    if (needsRedraw) {
      needsRedraw = false;
      drawCanvas();
    }
  });
}
function updateUploadButtonState() {
  uploadButton.disabled = !fileInput.files || fileInput.files.length === 0;
  if (selectedFileName) {
    const file = fileInput.files && fileInput.files[0];
    selectedFileName.textContent = file ? file.name : "선택된 DXF/DWG 파일 없음";
  }
}

function updateCanvasSearchAvailability() {
  const canSearch = state.hasDataset && state.circles.length > 0;
  if ((!state.hasDataset || !state.circles.length) && canvasSearchPanel) {
    canvasSearchPanel.hidden = true;
    canvasSearchToggleBtn?.classList.remove("is-active");
    canvasSearchToggleBtn?.setAttribute("aria-expanded", "false");
  }
  if (canvasSearchToggleBtn) {
    canvasSearchToggleBtn.disabled = !canSearch && !!canvasSearchPanel?.hidden;
  }
  populateCanvasSearchGroupOptions();
}

function toggleCanvasSearchPanel(forceOpen = null) {
  if (!canvasSearchPanel || !canvasSearchToggleBtn) return;
  const shouldOpen = forceOpen == null ? canvasSearchPanel.hidden : Boolean(forceOpen);
  if (shouldOpen && (!state.hasDataset || !state.circles.length)) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  canvasSearchPanel.hidden = !shouldOpen;
  canvasSearchToggleBtn.classList.toggle("is-active", shouldOpen);
  canvasSearchToggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  if (shouldOpen) {
    populateCanvasSearchGroupOptions();
    window.requestAnimationFrame(() => getCanvasSearchFocusTarget()?.focus());
  } else {
    canvasSearchToggleBtn.focus({ preventScroll: true });
  }
}

function scrollCircleRowIntoView(circleId) {
  if (!tableBody || !circleId) return;
  const rows = tableBody.querySelectorAll("tr[data-circle-id]");
  const row = [...rows].find((item) => item.dataset.circleId === circleId);
  if (!row) return;
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function applyCanvasSearchResult(circleIds, summaryLabel) {
  const ids = circleIds.filter((id) => state.circleMap.has(id));
  if (!ids.length) {
    state.highlightedCircleIds.clear();
    updateCircleTable();
    requestRedraw();
    setUploadStatus(`${summaryLabel} 검색 결과가 없습니다.`, true);
    return;
  }
  state.activeBuildingFilter = "ALL";
  renderBuildingTabs();
  setHighlightedCircles(ids, true);
  updateCircleTable();
  scrollCircleRowIntoView(ids[0]);
  setUploadStatus(ids.length === 1 ? `${summaryLabel} 좌표를 찾았습니다.` : `${summaryLabel} 좌표 ${ids.length}개를 찾았습니다.`);
}

function runCanvasSearch() {
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  const searchMode = getCanvasSearchMode();
  if (searchMode === "group-number") {
    if (canvasSearchGroupSelect?.disabled) {
      setUploadStatus("선택할 그룹이 없습니다.", true);
      return;
    }
    const rawGroupValue = String(canvasSearchGroupSelect?.value || "").trim();
    const area = normalizeAreaNameForSearch(rawGroupValue);
    const number = normalizeSearchNumber(canvasSearchGroupNumberInput?.value || "");
    if (!rawGroupValue || !number) {
      setUploadStatus("그룹을 고르고 번호를 입력하세요.", true);
      (rawGroupValue ? canvasSearchGroupNumberInput : canvasSearchGroupSelect)?.focus();
      return;
    }
    const configuredGroups = new Set(getConfiguredCanvasSearchGroups());
    const matches = state.circles
      .filter((circle) => resolveCircleCanvasSearchGroup(circle, configuredGroups) === area)
      .filter((circle) => getCircleSearchNumberTokens(circle).has(number))
      .map((circle) => circle.id);
    applyCanvasSearchResult(matches, `${area}-${number}`);
    return;
  }

  const searchId = normalizeCanvasSearchId(canvasSearchIdInput?.value || "");
  if (!searchId) {
    setUploadStatus("좌표 ID 숫자를 입력하세요.", true);
    canvasSearchIdInput?.focus();
    return;
  }
  const exactMatches = state.circles
    .filter((circle) => normalizeCircleIdTokens(circle).has(searchId))
    .map((circle) => circle.id);
  if (exactMatches.length) {
    applyCanvasSearchResult(exactMatches, `좌표 ID ${searchId}`);
    return;
  }
  const partialMatches = state.circles
    .filter((circle) => String(circle.id || "").replace(/\D/g, "").includes(searchId))
    .map((circle) => circle.id);
  applyCanvasSearchResult(partialMatches, `좌표 ID ${searchId}`);
}

function setPhase(phase, progress = null) {
  state.phase = phase;
  const label = PhaseMessages[phase] || "Working...";
  const progressText =
    progress !== null && Number.isFinite(progress) ? `${label} (${progress}%)` : label;
  progressLabel.textContent = progressText;
  // idle / ready 는 작업 종료 상태 → 상단 진행바·스피너 숨김 (ready 에 100% 를 넘겨도 계속 보이던 문제 방지)
  const workFinished = phase === "idle" || phase === "ready";
  progressWrapper.classList.toggle("visible", !workFinished);
  const isIndeterminate = progress === null || Number.isNaN(progress);
  progressWrapper.classList.toggle("indeterminate", isIndeterminate);
  if (!isIndeterminate) {
    progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  } else {
    progressFill.style.width = "40%";
  }
}

function setUploadStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.style.color = isError ? "#dc2626" : "inherit";
}

function setVersionCompareExcelStatus(message, isError = false) {
  if (!versionCompareExcelStatus) return;
  versionCompareExcelStatus.textContent = message || "";
  versionCompareExcelStatus.dataset.state = isError ? "error" : "normal";
}

function tryParseJson(content) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

const CHUNK_SIZE = 1024 * 1024; // 1 MB (Cloudflare Tunnel 등에서 한 번에 넘어가는 크기)
const CHUNKED_UPLOAD_THRESHOLD = 3 * 1024 * 1024; // 3 MB 이상이면 청크 업로드 사용

function buildUploadUrl(filterValues, expectedBuildings, filename) {
  const params = new URLSearchParams();
  params.set("min_diameter", String(filterValues.minDiameter));
  params.set("max_diameter", String(filterValues.maxDiameter));
  params.set("text_height_min", String(filterValues.textHeightMin));
  params.set("text_height_max", String(filterValues.textHeightMax));
  params.set("max_match_distance", String(filterValues.maxMatchDistance));
  if (expectedBuildings != null && expectedBuildings !== "") params.set("expected_buildings", String(expectedBuildings));
  params.set("filename", filename);
  params.set("project_context", getActiveProjectName());
  params.set("source_type", getActiveSourceType());
  appendManualHistoryQueryParams(params);
  return `${API_BASE_URL}/api/upload-dxf?${params.toString()}`;
}

function buildChunkUrl(uploadId, chunkIndex, totalChunks, filename, filterValues, expectedBuildings) {
  const params = new URLSearchParams();
  params.set("upload_id", uploadId);
  params.set("chunk_index", String(chunkIndex));
  params.set("total_chunks", String(totalChunks));
  params.set("filename", filename);
  params.set("min_diameter", String(filterValues.minDiameter));
  params.set("max_diameter", String(filterValues.maxDiameter));
  params.set("text_height_min", String(filterValues.textHeightMin));
  params.set("text_height_max", String(filterValues.textHeightMax));
  params.set("max_match_distance", String(filterValues.maxMatchDistance));
  if (expectedBuildings != null && expectedBuildings !== "") params.set("expected_buildings", String(expectedBuildings));
  params.set("project_context", getActiveProjectName());
  params.set("source_type", getActiveSourceType());
  appendManualHistoryQueryParams(params);
  return `${API_BASE_URL}/api/upload-dxf-chunk?${params.toString()}`;
}

async function sendChunkedUploadRequest(file, filterValues, expectedBuildings) {
  const uploadId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const blob = file.slice(start, end);
    const url = buildChunkUrl(uploadId, i, totalChunks, file.name, filterValues, expectedBuildings);
    const percent = Math.min(90, Math.round(((i + 1) / totalChunks) * 90));
    setPhase("uploading", percent);
    const res = await fetch(url, { method: "POST", body: blob });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err && err.detail) || res.statusText || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.circles !== undefined) {
      return data;
    }
  }
  throw new Error("청크 업로드 완료 후 응답을 받지 못했습니다.");
}

function sendUploadRequest(file, filterValues, expectedBuildings) {
  const url = buildUploadUrl(filterValues, expectedBuildings, file.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let parsingPhaseTimer = null;

    const clearParsingTimer = () => {
      if (parsingPhaseTimer) {
        clearTimeout(parsingPhaseTimer);
        parsingPhaseTimer = null;
      }
    };

    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.timeout = 300000;

    xhr.ontimeout = () => {
      clearParsingTimer();
      reject(new Error("업로드 시간이 초과되었습니다. 서버가 응답하지 않거나 파일이 너무 큽니다."));
    };

    xhr.upload.addEventListener("progress", (event) => {
      clearParsingTimer();
      if (!event.lengthComputable) {
        setPhase("uploading", null);
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      setPhase("uploading", Math.min(90, Math.max(0, percent)));
    });

    xhr.onerror = () => {
      clearParsingTimer();
      reject(new Error(`네트워크 오류가 발생했습니다. 백엔드 서버(${API_BASE_URL})가 실행 중인지 확인하세요.`));
    };

    xhr.onload = () => {
      clearParsingTimer();
      const isSuccess = xhr.status >= 200 && xhr.status < 300;
      let data;
      try {
        data = xhr.response ?? tryParseJson(xhr.responseText);
      } catch (e) {
        data = null;
      }
      if (isSuccess) {
        resolve(data || {});
        return;
      }
      const detail =
        (data && typeof data === "object" && (data.detail || data.message)) ||
        xhr.responseText ||
        `Upload failed (${xhr.status})`;
      reject(new Error(typeof detail === "string" ? detail : "Upload failed."));
    };

    try {
      xhr.send(file);
      parsingPhaseTimer = setTimeout(() => {
        parsingPhaseTimer = null;
        if (xhr.readyState !== 4) setPhase("parsing", null);
      }, 1500);
    } catch (error) {
      clearParsingTimer();
      reject(new Error(`요청 전송 실패: ${error.message}`));
    }
  });
}

function sendVersionCompareExcelRequest(formData, callbacks = {}) {
  const { onUploadProgress, onProcessing } = callbacks;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processingNotified = false;

    const notifyProcessing = () => {
      if (processingNotified) return;
      processingNotified = true;
      if (typeof onProcessing === "function") onProcessing();
    };

    xhr.open("POST", `${API_BASE_URL}/api/excel/compare`);
    xhr.responseType = "json";
    xhr.timeout = 600000;

    xhr.ontimeout = () => {
      reject(new Error("엑셀 비교 시간이 초과되었습니다. 파일이 크거나 서버 응답이 지연되고 있습니다."));
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        if (typeof onUploadProgress === "function") onUploadProgress(null);
        return;
      }
      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      if (typeof onUploadProgress === "function") onUploadProgress(percent);
    });

    xhr.upload.addEventListener("load", () => {
      notifyProcessing();
    });

    xhr.onerror = () => {
      reject(new Error(`네트워크 오류가 발생했습니다. 백엔드 서버(${API_BASE_URL})가 실행 중인지 확인하세요.`));
    };

    xhr.onload = () => {
      notifyProcessing();
      const isSuccess = xhr.status >= 200 && xhr.status < 300;
      let data;
      try {
        data = xhr.response ?? tryParseJson(xhr.responseText);
      } catch (error) {
        data = null;
      }
      if (isSuccess) {
        resolve(data || {});
        return;
      }
      const detail =
        (data && typeof data === "object" && (data.detail || data.message)) ||
        xhr.responseText ||
        `Upload failed (${xhr.status})`;
      reject(new Error(typeof detail === "string" ? detail : "엑셀 비교 요청에 실패했습니다."));
    };

    try {
      xhr.send(formData);
    } catch (error) {
      reject(new Error(`요청 전송 실패: ${error.message}`));
    }
  });
}

async function handleUpload(event) {
  event.preventDefault();
  if (!fileInput.files || !fileInput.files[0]) {
    setUploadStatus("DXF/DWG 파일을 선택하세요.", true);
    return;
  }
  readManualHistoryReuseControlsToState();
  if (state.reuseManualHistory && !state.manualHistoryReferenceWorkId) {
    setUploadStatus("수동 매칭 재사용을 켠 상태에서는 참고할 저장 작업 버전을 하나 선택하세요.", true);
    return;
  }
  const filterValues = getFilterValuesFromInputs();
  if (!filterValues) return;
  const file = fileInput.files[0];
  const useChunked = file.size > CHUNKED_UPLOAD_THRESHOLD;
  try {
    uploadButton.disabled = true;
    setPhase("uploading", 0);
    setUploadStatus(useChunked ? "Uploading CAD file (chunked)..." : "Uploading CAD file...");
    
    const payload = useChunked
      ? await sendChunkedUploadRequest(file, filterValues, getDesiredBuildingCount())
      : await sendUploadRequest(file, filterValues, getDesiredBuildingCount());
    setPhase("matching", 95);
    setUploadStatus("Processing CAD file...");
    handlePayload(payload);
    // 클라이언트 전용 옵션(동-번호·타워·동일 기하 중복 제외)은 서버 filter에 없음 → 체크박스 기준으로 확정 후 파생 상태 재계산
    state.filter.pileNumberHyphenFormat = !!filterValues.pileNumberHyphenFormat;
    state.filter.towerCraneNumberFormat = !!filterValues.towerCraneNumberFormat;
    state.filter.excludeIdenticalGeometryDuplicates = !!filterValues.excludeIdenticalGeometryDuplicates;
    if (state.circles.length) {
      refreshMatchDerivedUIState();
    }
    updateFilterInputs(state.filter);
    updateSummaryCards();
    updateCircleTable();
    updateDuplicatesTable();
    updateErrorsTable();
    requestRedraw();
    state.sourceCircles = null;
    state.sourceTexts = null;
    state.loadedWorkId = null;
    state.manualOverrides = {};
    state.loadedWorkMeta = null;
    notifyWorkContextChanged();
    setPhase("ready", 100);
    setTimeout(() => setPhase("idle"), 600);
    state.lastUploadedFileName = file ? file.name : "";
    if (state.circles?.length > 0) {
      setUploadStatus("처리 완료. CSV/XLSX 다운로드 버튼을 눌러 저장할 수 있습니다.");
    } else {
      setUploadStatus("CAD 처리 완료. 현재 필터에 맞는 원이 없습니다.");
    }
    fileInput.value = "";
    updateUploadButtonState();
  } catch (error) {
    setPhase("error");
    const errorMsg = parseErrorMessage(error);
    setUploadStatus(errorMsg, true);
    // 에러 메시지에 서버 상태 안내 추가
    if (errorMsg.includes("Network") || errorMsg.includes("timeout") || errorMsg.includes("fetch")) {
      setTimeout(() => {
        setUploadStatus(`${errorMsg}\n백엔드 서버(${API_BASE_URL})가 실행 중인지 확인하세요.`, true);
      }, 100);
    }
  } finally {
    uploadButton.disabled = false;
  }
}

function getDesiredBuildingCount() {
  const inputValue = Number(buildingCountInput.value);
  if (Number.isFinite(inputValue) && inputValue > 0) {
    return Math.round(inputValue);
  }
  const fallback =
    state.pendingNames.length ||
    getAreasByKind(AREA_KIND_BUILDING).length ||
    state.clusterPolylines.length ||
    1;
  return Math.max(1, Math.round(fallback));
}

async function refreshClustersForCount(expectedCount, showStatus = true, finalizePhase = true) {
  if (!state.hasDataset) return null;
  const desired = Math.max(1, Math.round(expectedCount || getDesiredBuildingCount()));
  const params = new URLSearchParams({
    min_diameter: state.filter?.minDiameter ?? DEFAULT_FILTER.minDiameter,
    max_diameter: state.filter?.maxDiameter ?? DEFAULT_FILTER.maxDiameter,
    text_height_min: state.filter?.textHeightMin ?? DEFAULT_FILTER.textHeightMin,
    text_height_max: state.filter?.textHeightMax ?? DEFAULT_FILTER.textHeightMax,
    max_match_distance: state.filter?.maxMatchDistance ?? DEFAULT_FILTER.maxMatchDistance,
    expected_buildings: desired,
    max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
    merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
  });
  try {
    if (showStatus) {
      setPhase("matching", 35);
      setUploadStatus("Recomputing building clusters...");
    }
    const loadedWorkRawPresent =
      Array.isArray(state.sourceCircles) && state.sourceCircles.length > 0;
    let response;
    let payload;
    if (loadedWorkRawPresent && state.circles.length > 0) {
      // 불러온 작업 후에는 서버 GET이 다른 DXF 캐시를 줄 수 있음 → 현재 화면 circles로 클러스터만 재계산
      response = await fetch(`${API_BASE_URL}/api/circles/recompute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circles: state.circles,
          texts: state.texts,
          expected_buildings: desired,
          max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
          merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      payload = await response.json();
    } else {
      response = await fetch(`${API_BASE_URL}/api/circles?${params.toString()}`);
      payload = await response.json();
      if (response.ok && (!payload.circles || payload.circles.length === 0) && state.circles.length > 0) {
        response = await fetch(`${API_BASE_URL}/api/circles/recompute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            circles: state.circles,
            texts: state.texts,
            expected_buildings: desired,
            max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
            merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
          }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        payload = await response.json();
      } else if (!response.ok) {
        throw new Error(await response.text());
      }
    }
    handlePayload(payload);
    if (showStatus) {
      if (finalizePhase) {
        setUploadStatus("Building clusters updated.");
        setPhase("ready", 100);
        setTimeout(() => setPhase("idle"), 400);
      } else {
        setUploadStatus("Building clusters ready. Generating buildings...");
      }
    }
    return payload;
  } catch (error) {
    console.error(error);
    if (showStatus) {
      setUploadStatus(parseErrorMessage(error), true);
      setPhase("error");
    }
    return null;
  }
}

function getFilterValuesFromInputs() {
  const minDiameter = Number(filterMinInput.value);
  const maxDiameter = Number(filterMaxInput.value);
  const textHeightMin = Number(filterHeightMinInput.value);
  const textHeightMax = Number(filterHeightMaxInput.value);
  const maxMatchDistance = Number(filterDistanceInput.value);
  const textReferencePoint = document.querySelector('input[name="text-reference-point"]:checked')?.value || "center";
  if ([minDiameter, maxDiameter, textHeightMin, textHeightMax, maxMatchDistance].some((v) => Number.isNaN(v))) {
    setUploadStatus("Please enter valid numeric filter values.", true);
    return null;
  }
  if (minDiameter >= maxDiameter) {
    setUploadStatus("직경 최소는 직경 최대보다 작아야 합니다.", true);
    return null;
  }
  if (textHeightMin >= textHeightMax) {
    setUploadStatus("글자 크기 최소는 글자 크기 최대보다 작아야 합니다.", true);
    return null;
  }
  if (maxMatchDistance <= 0) {
    setUploadStatus("Match distance must be positive.", true);
    return null;
  }
  const towerCraneNumberFormat = !!(filterTowerCraneNumberInput && filterTowerCraneNumberInput.checked);
  const pileNumberHyphenFormat = !!(filterPileNumberHyphenInput && filterPileNumberHyphenInput.checked);

  return {
    minDiameter,
    maxDiameter,
    textHeightMin,
    textHeightMax,
    maxMatchDistance,
    textReferencePoint,
    pileNumberHyphenFormat,
    towerCraneNumberFormat,
    excludeIdenticalGeometryDuplicates: !!(
      filterExcludeIdenticalGeometryDuplicatesInput && filterExcludeIdenticalGeometryDuplicatesInput.checked
    ),
  };
}

/** 필터 적용 시 서버로 넘길 수동 매칭: circle에 manual_match === true 인 것만 (잘못된 자동 매칭 고정 방지) */
function buildManualOverridesForApplyFilter(circles) {
  const merged = {};
  (circles || []).forEach((c) => {
    if (!c || !c.matched_text_id) return;
    if (c.manual_match === true) {
      merged[c.id] = c.matched_text_id;
    }
  });
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * apply-filter에 쓸 원시 circles/texts.
 * - 불러오기 직후 스냅샷(sourceCircles) 우선
 * - 없고 loadedWorkId만 있으면 서버에서 작업 JSON을 한 번 더 받아 복구(스냅샷도 메모리에 저장)
 */
async function resolveCirclesTextsForFilterApply() {
  if (Array.isArray(state.sourceCircles) && state.sourceCircles.length > 0) {
    return {
      circles: state.sourceCircles,
      texts: state.sourceTexts || [],
    };
  }
  if (state.loadedWorkId) {
    const r = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(state.loadedWorkId)}`);
    if (!r.ok) {
      throw new Error((await r.text()) || "저장 작업을 불러오지 못했습니다.");
    }
    const data = await r.json();
    const c = Array.isArray(data.circles) ? data.circles : [];
    const t = Array.isArray(data.texts) ? data.texts : [];
    if (!c.length) {
      throw new Error("저장 작업에 circle 데이터가 없습니다.");
    }
    state.sourceCircles = JSON.parse(JSON.stringify(c));
    state.sourceTexts = t.length ? JSON.parse(JSON.stringify(t)) : [];
    return { circles: state.sourceCircles, texts: state.sourceTexts };
  }
  return null;
}

async function applyFilterFromPanel() {
  if (!state.hasDataset) {
    setUploadStatus("Upload a DXF first.", true);
    return;
  }
  const filterValues = getFilterValuesFromInputs();
  if (!filterValues) return;
  
  // 필터 적용 버튼 비활성화
  applyFilterBtn.disabled = true;
  const originalText = applyFilterBtn.textContent;
  applyFilterBtn.textContent = "적용 중...";
  
  const params = new URLSearchParams({
    min_diameter: filterValues.minDiameter,
    max_diameter: filterValues.maxDiameter,
    text_height_min: filterValues.textHeightMin,
    text_height_max: filterValues.textHeightMax,
    max_match_distance: filterValues.maxMatchDistance,
    text_reference_point: filterValues.textReferencePoint,
    expected_buildings: getDesiredBuildingCount(),
    max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
    merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
  });
  try {
    // 진행률 표시 시작
    setPhase("matching", 20);
    setUploadStatus("필터 적용 및 결과 재계산 중...");

    setPhase("matching", 45);
    const clientSnapshot = await resolveCirclesTextsForFilterApply();
    const useClientApplyFilter = clientSnapshot !== null;
    const baseCirclesForFilter = useClientApplyFilter
      ? clientSnapshot.circles
      : state.circles;
    const baseTextsForFilter = useClientApplyFilter
      ? clientSnapshot.texts
      : state.texts;

    setPhase("matching", 50);
    let response;
    let payload;

    if (useClientApplyFilter) {
      setUploadStatus("화면 작업 데이터 기준으로 필터·매칭 재계산 중...");
      response = await fetch(`${API_BASE_URL}/api/circles/apply-filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circles: baseCirclesForFilter,
          texts: baseTextsForFilter,
          min_diameter: filterValues.minDiameter,
          max_diameter: filterValues.maxDiameter,
          text_height_min: filterValues.textHeightMin,
          text_height_max: filterValues.textHeightMax,
          max_match_distance: filterValues.maxMatchDistance,
          text_reference_point: filterValues.textReferencePoint,
          expected_buildings: getDesiredBuildingCount(),
          max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
          merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
          buildings: state.buildings && state.buildings.length > 0
            ? serializeBuildingDefinitions(state.buildings)
            : undefined,
          manual_overrides: buildManualOverridesForApplyFilter(baseCirclesForFilter),
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      payload = await response.json();
    } else {
      response = await fetch(`${API_BASE_URL}/api/circles?${params.toString()}`);
      payload = await response.json();
      const hadCirclesBefore = state.circles.length > 0;
      const gotEmptyFromServer = response.ok && (!payload.circles || payload.circles.length === 0);

      if (gotEmptyFromServer && hadCirclesBefore) {
        setUploadStatus("현재 화면 데이터 기준으로 필터 적용 중...");
        response = await fetch(`${API_BASE_URL}/api/circles/apply-filter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            circles: baseCirclesForFilter,
            texts: baseTextsForFilter,
            min_diameter: filterValues.minDiameter,
            max_diameter: filterValues.maxDiameter,
            text_height_min: filterValues.textHeightMin,
            text_height_max: filterValues.textHeightMax,
            max_match_distance: filterValues.maxMatchDistance,
            text_reference_point: filterValues.textReferencePoint,
            expected_buildings: getDesiredBuildingCount(),
            max_distance_from_seed: getClusteringSetting("maxDistanceFromSeed", 30),
            merge_seed_distance: getClusteringSetting("mergeSeedDistance", 20),
            buildings: state.buildings && state.buildings.length > 0
              ? serializeBuildingDefinitions(state.buildings)
              : undefined,
            manual_overrides: buildManualOverridesForApplyFilter(baseCirclesForFilter),
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        payload = await response.json();
      } else if (!response.ok) {
        throw new Error(await response.text());
      }
    }

    // 결과 처리
    setPhase("matching", 80);
    setUploadStatus("결과 데이터 처리 중...");
    setPhase("matching", 95);
    handlePayload(payload);
    state.filter.pileNumberHyphenFormat = !!filterValues.pileNumberHyphenFormat;
    state.filter.towerCraneNumberFormat = !!filterValues.towerCraneNumberFormat;
    state.filter.excludeIdenticalGeometryDuplicates = !!filterValues.excludeIdenticalGeometryDuplicates;
    if (state.circles.length) {
      refreshMatchDerivedUIState();
    }
    updateFilterInputs(state.filter);

    updateSummaryCards();
    updateCircleTable();
    updateDuplicatesTable();
    updateErrorsTable();
    renderBuildingTabs();
    requestRedraw();

    setPhase("ready", 100);
    setTimeout(() => setPhase("idle"), 600);
    setUploadStatus(`필터가 적용되었습니다. (Circle: ${payload.circles?.length || 0}개)`);
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    // 버튼 상태 복원
    applyFilterBtn.disabled = false;
    applyFilterBtn.textContent = originalText;
  }
}
function handlePayload(payload) {
  if (saveWorkBtn) saveWorkBtn.disabled = false;
  if (saveWorkUpdateBtn) saveWorkUpdateBtn.disabled = false;
  state.summary = payload.summary || null;
  state.buildingSummary = Array.isArray(payload.building_summary) ? payload.building_summary : [];
  state.circles = Array.isArray(payload.circles) ? payload.circles : [];
  state.texts = Array.isArray(payload.texts) ? payload.texts : [];
  state.duplicates = Array.isArray(payload.duplicates) ? payload.duplicates : [];
  state.errors = Array.isArray(payload.errors) ? payload.errors : [];
  state.matchCorrections = Array.isArray(payload.match_corrections)
    ? payload.match_corrections
    : Array.isArray(payload.matchCorrections)
    ? payload.matchCorrections
    : [];
  const clusterPolylines = Array.isArray(payload.cluster_polylines)
    ? payload.cluster_polylines
    : [];
  const payloadRaw = Array.isArray(payload.polylines) ? payload.polylines : [];
  state.clusterPolylines = clusterPolylines;
  // 참고용 폴리라인: 응답에 polylines가 있으면 반영, 없/비어 있으면 필터 적용 후에도 기존 유지(뒤에 계속 보이게)
  state.rawPolylines = payloadRaw.length > 0 ? payloadRaw : (state.rawPolylines || []);
  state.polylines = clusterPolylines.length ? clusterPolylines : state.rawPolylines;
  state.pileClusters = Array.isArray(payload.pile_clusters) ? payload.pile_clusters : [];
  state.buildings = normalizeAreaDefinitions(Array.isArray(payload.buildings) ? payload.buildings : []);
  state.circleMap = new Map(state.circles.map((circle) => [circle.id, circle]));
  state.textMap = new Map(state.texts.map((text) => [text.id, text]));
  state.foundationThicknessByPileId = Object.fromEntries(
    Object.entries(state.foundationThicknessByPileId || {}).filter(([circleId, value]) => (
      state.circleMap.has(circleId) && Number.isFinite(Number(value)) && Number(value) >= 0
    )).map(([circleId, value]) => [circleId, Math.round(Number(value))]),
  );
  state.foundationPitOffsetByPileId = Object.fromEntries(
    Object.entries(state.foundationPitOffsetByPileId || {}).filter(([circleId, value]) => (
      state.circleMap.has(circleId) && Number.isFinite(Number(value)) && Number(value) >= 0
    )).map(([circleId, value]) => [circleId, Number(value)]),
  );
  state.drillingStartByPileId = Object.fromEntries(
    Object.entries(state.drillingStartByPileId || {}).filter(([circleId, value]) => (
      state.circleMap.has(circleId) && Number.isFinite(Number(value))
    )).map(([circleId, value]) => [circleId, Number(value)]),
  );
  state.foundationTopByPileId = Object.fromEntries(
    Object.entries(state.foundationTopByPileId || {}).filter(([circleId, value]) => (
      state.circleMap.has(circleId) && Number.isFinite(Number(value))
    )).map(([circleId, value]) => [circleId, Number(value)]),
  );
  rebuildManualOverridesFromCircles();
  const prevPileHyphen = state.filter?.pileNumberHyphenFormat;
  const prevTowerCrane = state.filter?.towerCraneNumberFormat;
  const prevExcludeIdenticalGeom = state.filter?.excludeIdenticalGeometryDuplicates;
  state.filter = normalizeFilter(payload.filter);
  const pf = payload.filter;
  if (
    pf == null ||
    typeof pf !== "object" ||
    (pf.pile_number_hyphen_format === undefined && pf.pileNumberHyphenFormat === undefined)
  ) {
    state.filter.pileNumberHyphenFormat = !!prevPileHyphen;
  }
  if (
    pf == null ||
    typeof pf !== "object" ||
    (pf.tower_crane_number_format === undefined && pf.towerCraneNumberFormat === undefined)
  ) {
    state.filter.towerCraneNumberFormat = !!prevTowerCrane;
  }
  if (
    pf == null ||
    typeof pf !== "object" ||
    (pf.exclude_identical_geometry_duplicates === undefined &&
      pf.excludeIdenticalGeometryDuplicates === undefined)
  ) {
    // 백엔드 filter에 해당 필드가 없을 때만 세션 값 유지. prev가 없으면 !!undefined → false로
    // normalizeFilter 기본(true)을 덮어써 체크 UI와 불일치·동일 기하 중복 제외 실패가 난다.
    if (prevExcludeIdenticalGeom !== undefined) {
      state.filter.excludeIdenticalGeometryDuplicates = !!prevExcludeIdenticalGeom;
    }
  }
  state.hasDataset = true;
  if (typeof window.pilexySetParcelReviewViz === "function") window.pilexySetParcelReviewViz(null);
  state.activeBuildingFilter = "ALL";
  state.highlightedCircleIds.clear();
  resetManualSelection();
  state.areaRectCreate = null;
  const payloadBuildingAreas = getAreasByKind(AREA_KIND_BUILDING, state.buildings);
  const payloadParkingAreas = getAreasByKind(AREA_KIND_PARKING, state.buildings);
  state.pendingNames = payloadBuildingAreas.length
    ? buildAreaNameListFromEntries(AREA_KIND_BUILDING, payloadBuildingAreas)
    : state.pendingNames.length
    ? state.pendingNames
    : [];
  setAreaNames(
    AREA_KIND_PARKING,
    payloadParkingAreas.length
      ? buildAreaNameListFromEntries(AREA_KIND_PARKING, payloadParkingAreas)
      : state.pendingParkingNames.length
      ? state.pendingParkingNames
      : [],
  );
  const payloadTowerAreas = getAreasByKind(AREA_KIND_TOWER_CRANE, state.buildings);
  setAreaNames(
    AREA_KIND_TOWER_CRANE,
    payloadTowerAreas.length
      ? buildAreaNameListFromEntries(AREA_KIND_TOWER_CRANE, payloadTowerAreas)
      : state.pendingTowerCraneNames.length
      ? state.pendingTowerCraneNames
      : [],
  );
  ensureBuildingsInitialized();
  // spinbox 값을 먼저 맞춰 두어 syncPendingNamesForKind가 오래된 입력값으로 이름 행을 늘리지 않게 함
  syncAreaCountInputs();
  syncPendingNamesWithBuildings();
  syncAreaCountInputs();

  if (state.circles.length) {
    state.errors = buildErrorsFromCirclesAndTexts(state.circles, state.texts);
    state.duplicates = [
      ...buildDuplicatesFromCircles(state.circles),
      ...buildSameBuildingNumberDuplicateGroups(state.circles),
    ];
    if (state.summary && typeof state.summary === "object") {
      state.summary.total_texts = countMatchableTexts(state.texts);
      state.summary.duplicate_groups = state.duplicates.length;
    }
  }

  // 디버깅: 데이터 상태 확인
  console.debug("[handlePayload] 데이터 상태:", {
    circles: state.circles.length,
    texts: state.texts.length,
    buildings: state.buildings.length,
    activeFilter: state.activeBuildingFilter
  });
  
  updateSummaryCards();
  updateFilterInputs(state.filter);
  updateCanvasSearchAvailability();
  syncMeissaCompareBtnEnabled();
  if (typeof window.pilexyUpdateConstructionButtonsState === "function") window.pilexyUpdateConstructionButtonsState();
  updateCircleTable();
  updateDuplicatesTable();
  updateErrorsTable();
  renderBuildingTabs();
  populateBuildingSelect();
  renderPendingNameEditor();
  renderMatchCorrectionsPanel();
  fitViewToData();
  requestRedraw();
}

function normalizeFilter(filter = {}) {
  const rawHyphen =
    filter.pile_number_hyphen_format ?? filter.pileNumberHyphenFormat ?? DEFAULT_FILTER.pileNumberHyphenFormat;
  const rawTower =
    filter.tower_crane_number_format ?? filter.towerCraneNumberFormat ?? DEFAULT_FILTER.towerCraneNumberFormat;
  const hyphenOn =
    rawHyphen === true || rawHyphen === 1 || rawHyphen === "1" || String(rawHyphen).toLowerCase() === "true";
  const towerOn =
    rawTower === true || rawTower === 1 || rawTower === "1" || String(rawTower).toLowerCase() === "true";
  return {
    minDiameter: Number(filter.min_diameter ?? filter.minDiameter ?? DEFAULT_FILTER.minDiameter),
    maxDiameter: Number(filter.max_diameter ?? filter.maxDiameter ?? DEFAULT_FILTER.maxDiameter),
    textHeightMin: Number(filter.text_height_min ?? filter.textHeightMin ?? DEFAULT_FILTER.textHeightMin),
    textHeightMax: Number(filter.text_height_max ?? filter.textHeightMax ?? DEFAULT_FILTER.textHeightMax),
    maxMatchDistance: Number(
      filter.max_match_distance ?? filter.maxMatchDistance ?? DEFAULT_FILTER.maxMatchDistance,
    ),
    textReferencePoint: filter.text_reference_point ?? filter.textReferencePoint ?? "center",
    pileNumberHyphenFormat: hyphenOn,
    towerCraneNumberFormat: towerOn,
    excludeIdenticalGeometryDuplicates: (() => {
      const raw =
        filter.exclude_identical_geometry_duplicates ?? filter.excludeIdenticalGeometryDuplicates;
      if (raw === undefined || raw === null) {
        return DEFAULT_FILTER.excludeIdenticalGeometryDuplicates;
      }
      return raw === true || raw === 1 || raw === "1" || String(raw).toLowerCase() === "true";
    })(),
  };
}

function updateFilterInputs(filter) {
  if (!filter) return;
  filterMinInput.value = Number(filter.minDiameter).toString();
  filterMaxInput.value = Number(filter.maxDiameter).toString();
  filterHeightMinInput.value = Number(filter.textHeightMin).toString();
  filterHeightMaxInput.value = Number(filter.textHeightMax).toString();
  filterDistanceInput.value = Number(filter.maxMatchDistance).toString();

  // 텍스트 기준점 복원
  if (filter.textReferencePoint) {
    const radioInput = document.querySelector(`input[name="text-reference-point"][value="${filter.textReferencePoint}"]`);
    if (radioInput) {
      radioInput.checked = true;
    }
  }
  if (filterPileNumberHyphenInput) {
    filterPileNumberHyphenInput.checked = !!filter.pileNumberHyphenFormat;
  }
  if (filterExcludeIdenticalGeometryDuplicatesInput) {
    filterExcludeIdenticalGeometryDuplicatesInput.checked = !!filter.excludeIdenticalGeometryDuplicates;
  }
  if (filterTowerCraneNumberInput) {
    filterTowerCraneNumberInput.checked = !!filter.towerCraneNumberFormat;
  }
}

function updateSummaryCards() {
  if (!state.summary) {
    summaryTotalCircles.textContent = "0";
    summaryTotalTexts.textContent = "0";
    summaryMatched.textContent = "0";
    summaryDuplicateGroups.textContent = "0";
    return;
  }
  summaryTotalCircles.textContent = state.summary.total_circles ?? "0";
  summaryTotalTexts.textContent = state.summary.total_texts ?? "0";
  summaryMatched.textContent = state.summary.matched_pairs ?? "0";
  summaryDuplicateGroups.textContent = state.summary.duplicate_groups ?? "0";
}

function updateCircleTable() {
  if (!tableBody) {
    console.error("tableBody element not found");
    return;
  }
  
  tableBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const raw = getVisibleCircles();
  // 정렬: 1. Building 2. Matched TEXT 숫자 오름차순
  const buildingNameOrder = getConfiguredBuildingNameOrder();
  const circles = [...raw].sort((a, b) => {
    const buildingA = (a.building_name || "").trim() || "\uFFFF";
    const buildingB = (b.building_name || "").trim() || "\uFFFF";
    if (buildingA !== buildingB) {
      return compareBuildingNamesByConfiguration(buildingA, buildingB, buildingNameOrder);
    }
    const numA = getEffectivePileSequenceNumber(a.matched_text?.text);
    const numB = getEffectivePileSequenceNumber(b.matched_text?.text);
    const sortA = Number.isInteger(numA) && numA >= 1 ? numA : Infinity;
    const sortB = Number.isInteger(numB) && numB >= 1 ? numB : Infinity;
    if (sortA !== sortB) return sortA - sortB;
    return (a.matched_text?.text ?? "").toString().localeCompare((b.matched_text?.text ?? "").toString());
  });

  // 디버깅: Circle 데이터 확인
  if (state.hasDataset) {
    console.debug(`[파일 목록] 전체: ${state.circles.length}, 표시: ${circles.length}, 필터: ${state.activeBuildingFilter}`);
  }
  
  if (!circles.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.className = "empty-row";
    if (state.hasDataset) {
      if (state.circles.length === 0) {
        cell.textContent = "Circle 데이터가 없습니다. DXF 파일을 확인하세요.";
      } else {
        cell.textContent = `현재 필터에 맞는 Circle이 없습니다. (전체: ${state.circles.length}개)`;
      }
    } else {
      cell.textContent = "Upload a DXF file to inspect circles.";
    }
    row.appendChild(cell);
    fragment.appendChild(row);
  } else {
    circles.forEach((circle) => {
      const row = document.createElement("tr");
      row.dataset.circleId = circle.id;
      if (circle.has_error) {
        row.classList.add("error-row");
      }
      if (state.highlightedCircleIds.has(circle.id)) {
        row.classList.add("circle-row--highlighted");
      }
      const matchedTextCellClass = !circle.matched_text ? " cell-unmatched-text" : "";
      const areaVal = circle.area != null ? formatNumber(circle.area) : (circle.radius != null ? formatNumber(Math.PI * circle.radius * circle.radius) : "—");
      row.innerHTML = `
        <td>${circle.building_name || "-"}</td>
        <td class="matched-text-cell${matchedTextCellClass}">${circle.matched_text?.text ?? "—"}</td>
        <td>${circle.id}</td>
        <td>${formatNumber(circle.center_y)}</td>
        <td>${formatNumber(circle.center_x)}</td>
        <td>${formatNumber(circle.radius)}</td>
        <td>${formatNumber(circle.diameter)}</td>
        <td>${areaVal}</td>
        <td>${circle.layer || "-"}</td>
        <td>${circle.block_name || "-"}</td>
      `;
      row.addEventListener("mouseenter", () => {
        hoveredCircleId = circle.id;
        updateTooltipPosition();
        requestRedraw();
      });
      row.addEventListener("mouseleave", () => {
        hoveredCircleId = null;
        drawTooltip();
        requestRedraw();
      });
      row.addEventListener("click", () => {
        setManualCircleSelection(circle.id, true);
      });
      fragment.appendChild(row);
    });
  }
  tableBody.appendChild(fragment);
  updateBuildingSeqSummary();
}

/**
 * Matched TEXT에서 숫자 추출 (예: "C5291" → 5291)
 */
function getMatchedTextNumber(matchedText) {
  if (matchedText == null || matchedText === "") return NaN;
  const s = normalizePileTextHyphens(String(matchedText).trim());
  if (s.includes("-")) return NaN;
  const digits = s.replace(/\D/g, "");
  return digits.length ? parseInt(digits, 10) : NaN;
}

function normalizePileTextHyphens(value) {
  return String(value ?? "").replace(/\u2212|\u2013|\u2014/g, "-");
}

/** 첫 번째 `-` 기준: 앞쪽 숫자=동키, 뒤쪽 첫 숫자 그룹=파일 번호 */
function parseHyphenPileText(matchedText) {
  const s = normalizePileTextHyphens(String(matchedText ?? "").replace(/\s+/g, "")).trim();
  /** T/TC4-1 형은 타워(호기-파일). 앞에 T/TC 없이 4-1만 있으면 동-번호 */
  if (/^(?:T|TC)\d+-\d+$/i.test(s)) {
    return { hasHyphen: false, dongKey: null, seqNum: NaN };
  }
  const idx = s.indexOf("-");
  if (idx < 0) return { hasHyphen: false, dongKey: null, seqNum: NaN };
  const leftDigits = s.slice(0, idx).replace(/\D/g, "");
  const rightRaw = s.slice(idx + 1);
  const rm = rightRaw.match(/\d+/);
  const dongKey = leftDigits.length ? parseInt(leftDigits, 10) : null;
  const seqNum = rm ? parseInt(rm[0], 10) : NaN;
  return { hasHyphen: true, dongKey, seqNum };
}

/** 예: T4-1, TC4-1 — 앞에 T/TC가 있을 때만 타워(호기-번호). 4-1만 있으면 타워가 아님(동-번호) */
function parseTowerCranePileText(matchedText) {
  const noSpace = String(matchedText ?? "").replace(/\s+/g, "");
  const s = normalizePileTextHyphens(noSpace);
  const m = s.match(/^(T|TC)(\d+)-(\d+)$/i);
  if (!m) return { isTower: false, prefix: null, craneNum: null, seqNum: NaN };
  const prefix = m[1].toUpperCase();
  const craneNum = parseInt(m[2], 10);
  const seqNum = parseInt(m[3], 10);
  const ok =
    Number.isInteger(craneNum) && craneNum >= 1 && Number.isInteger(seqNum) && seqNum >= 1;
  return {
    isTower: ok,
    prefix: ok ? prefix : null,
    craneNum: ok ? craneNum : null,
    seqNum: ok ? seqNum : NaN,
  };
}

function extractLeadingIntFromAreaName(buildingName) {
  const m = String(buildingName ?? "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

/**
 * 하이픈 앞 동키 k와 윤곽 동명의 숫자 B(예: 101동→101) 대응.
 * B≥100이면 끝 두 자리만 본다: 101·201·301·1101 모두 k=1과 1-xx 형으로 매칭(B%100===k).
 * 두 자리 이하 동명은 전번 일치·앞자리 일치(11동↔1-)·십의 자리 일치(25동↔2) 등 보조 규칙.
 */
function dongKeyMatchesBuildingName(dongKey, buildingName) {
  if (dongKey == null || !Number.isFinite(dongKey) || dongKey < 0) return true;
  const raw = String(buildingName ?? "").trim();
  if (!raw || raw === "미할당") return true;
  const B = extractLeadingIntFromAreaName(raw);
  if (!Number.isFinite(B)) return false;
  const k = Math.trunc(dongKey);
  if (B === k) return true;
  if (B >= 100) {
    if (B % 100 === k) return true;
  }
  const bStr = String(B);
  const kStr = String(k);
  if (B < 100 && bStr.startsWith(kStr)) return true;
  if (B >= 10 && B <= 99 && Math.floor(B / 10) === k) return true;
  return false;
}

/**
 * 파일 번호(시퀀스) 추출: Tn-m 형(T 접두)은 항상 −뒤 번호, 그다음 동-번호(하이픈) 옵션, 그다음 일반 하이픈(4-1→1), 아니면 전체 숫자.
 */
function getEffectivePileSequenceNumber(matchedText) {
  const t0 = parseTowerCranePileText(matchedText);
  if (t0.isTower) return t0.seqNum;
  const towerOn = !!state.filter?.towerCraneNumberFormat;
  const hyphenOn = !!state.filter?.pileNumberHyphenFormat;
  if (hyphenOn) {
    const p = parseHyphenPileText(matchedText);
    if (p.hasHyphen && Number.isInteger(p.seqNum) && p.seqNum >= 1) {
      return p.seqNum;
    }
    const fallback = getMatchedTextNumber(matchedText);
    if (Number.isInteger(fallback) && fallback >= 1) return fallback;
    return NaN;
  }
  const pPlain = parseHyphenPileText(matchedText);
  if (pPlain.hasHyphen && Number.isInteger(pPlain.seqNum) && pPlain.seqNum >= 1) {
    return pPlain.seqNum;
  }
  if (towerOn) {
    const fallback = getMatchedTextNumber(matchedText);
    if (Number.isInteger(fallback) && fallback >= 1) return fallback;
    return NaN;
  }
  return getMatchedTextNumber(matchedText);
}

/**
 * 동·미지정 내 번호 중복 판별용 키.
 * 동-번호 모드에서 하이픈이 있으면 `동명\\0동키-뒤숫자`로 구분 (10-7 과 11-7이 뒤 7만으로 묶이지 않게).
 */
function getSameBuildingNumberGroupKey(circle) {
  const bname = (circle.building_name || "").trim() || "미할당";
  const mt = circle.matched_text?.text;
  const tFirst = parseTowerCranePileText(mt);
  if (tFirst.isTower) {
    return `${bname}\0TC${tFirst.craneNum}-${tFirst.seqNum}`;
  }
  if (state.filter?.pileNumberHyphenFormat) {
    const p = parseHyphenPileText(mt);
    if (p.hasHyphen && Number.isInteger(p.seqNum) && p.seqNum >= 1) {
      const dk = p.dongKey != null ? p.dongKey : "X";
      return `${bname}\0${dk}-${p.seqNum}`;
    }
  }
  const num = getEffectivePileSequenceNumber(mt);
  if (!Number.isInteger(num) || num < 1) return null;
  return `${bname}\0${num}`;
}

function getSameBuildingDuplicateDisplayLabel(circle) {
  const mt = circle.matched_text?.text;
  const t0 = parseTowerCranePileText(mt);
  if (t0.isTower) return `${t0.prefix || "TC"}${t0.craneNum}-${t0.seqNum}`;
  if (state.filter?.pileNumberHyphenFormat) {
    const p = parseHyphenPileText(mt);
    if (p.hasHyphen && Number.isInteger(p.seqNum) && p.seqNum >= 1) {
      return p.dongKey != null ? `${p.dongKey}-${p.seqNum}` : `?-${p.seqNum}`;
    }
  }
  const n = getEffectivePileSequenceNumber(mt);
  return Number.isInteger(n) ? String(n) : "?";
}

/** 타워 전용 버킷 → 요약 행 (TC_X 비포함: 순수 T형식만) */
function towerBucketsMapToSummaryRows(byKey) {
  const result = [];
  [...byKey.entries()]
    .sort(([ka], [kb]) => ka.localeCompare(kb))
    .forEach(([, bucket]) => {
      const { buildingName, craneNum, numSet, pileCount, invalidFormatCount } = bucket;
      if (!numSet.size) {
        result.push({
          buildingName,
          craneNum,
          towerColumnLabel: null,
          maxNum: 0,
          missing: [],
          pileCount,
          mismatchCount: 0,
          invalidFormatCount,
          hyphenMode: false,
          towerMode: true,
        });
        return;
      }
      const maxNum = Math.max(...numSet);
      const missing = [];
      for (let n = 1; n <= maxNum; n++) {
        if (!numSet.has(n)) missing.push(n);
      }
      result.push({
        buildingName,
        craneNum,
        towerColumnLabel: null,
        maxNum,
        missing,
        pileCount,
        mismatchCount: 0,
        invalidFormatCount,
        hyphenMode: false,
        towerMode: true,
      });
    });
  return result;
}

/**
 * 동-번호 집계만 (hyphen 플래그에 따라 하이픈/전체 숫자 처리) — 동일 로직 재사용
 */
function computeHyphenStyleBuildingSummary(hyphen) {
  const byBuilding = new Map();
  state.circles.forEach((c) => {
    const name = (c.building_name || "").trim() || "미할당";
    if (!byBuilding.has(name)) {
      byBuilding.set(name, { numSet: new Set(), pileCount: 0, mismatchCount: 0, invalidFormatCount: 0 });
    }
    const bucket = byBuilding.get(name);
    const mt = c.matched_text?.text;
    const hasMatch = c.matched_text_id != null && c.matched_text_id !== "";
    if (hyphen) {
      const p = parseHyphenPileText(mt);
      if (!hasMatch) return;
      if (!p.hasHyphen) {
        const fb = getMatchedTextNumber(mt);
        if (Number.isInteger(fb) && fb >= 1) {
          bucket.numSet.add(fb);
          bucket.pileCount += 1;
        } else {
          bucket.invalidFormatCount += 1;
        }
        return;
      }
      if (!Number.isInteger(p.seqNum) || p.seqNum < 1) {
        const fb = getMatchedTextNumber(mt);
        if (Number.isInteger(fb) && fb >= 1) {
          bucket.numSet.add(fb);
          bucket.pileCount += 1;
        } else {
          bucket.invalidFormatCount += 1;
        }
        return;
      }
      if (p.dongKey != null && !dongKeyMatchesBuildingName(p.dongKey, name)) {
        bucket.mismatchCount += 1;
      }
      bucket.numSet.add(p.seqNum);
      bucket.pileCount += 1;
      return;
    }
    const num = getMatchedTextNumber(mt);
    if (Number.isInteger(num) && num >= 1) {
      bucket.numSet.add(num);
      bucket.pileCount += 1;
    }
  });
  const result = [];
  const names = [...byBuilding.keys()].sort((a, b) => (a === "미할당" ? 1 : b === "미할당" ? -1 : a.localeCompare(b)));
  names.forEach((buildingName) => {
    const { numSet, pileCount, mismatchCount, invalidFormatCount } = byBuilding.get(buildingName);
    if (!numSet.size) {
      result.push({
        buildingName,
        craneNum: null,
        maxNum: 0,
        missing: [],
        pileCount,
        mismatchCount: hyphen ? mismatchCount : 0,
        invalidFormatCount: hyphen ? invalidFormatCount : 0,
        hyphenMode: hyphen,
        towerMode: false,
      });
      return;
    }
    const maxNum = Math.max(...numSet);
    const missing = [];
    for (let n = 1; n <= maxNum; n++) {
      if (!numSet.has(n)) missing.push(n);
    }
    result.push({
      buildingName,
      craneNum: null,
      maxNum,
      missing,
      pileCount,
      mismatchCount: hyphen ? mismatchCount : 0,
      invalidFormatCount: hyphen ? invalidFormatCount : 0,
      hyphenMode: hyphen,
      towerMode: false,
    });
  });
  return result;
}

/** 타워 + 동-번호 동시: T형식 매칭은 타워 집계, 나머지는 동-번호 집계 */
function computeBuildingSeqSummaryTowerAndHyphenTogether() {
  const byKey = new Map();
  state.circles.forEach((c) => {
    const mt = c.matched_text?.text;
    const t = parseTowerCranePileText(mt);
    if (!t.isTower) return;
    const name = (c.building_name || "").trim() || "미할당";
    const hasMatch = c.matched_text_id != null && c.matched_text_id !== "";
    const rowKey = `${name}\0TC${t.craneNum}`;
    if (!byKey.has(rowKey)) {
      byKey.set(rowKey, {
        buildingName: name,
        craneNum: t.craneNum,
        numSet: new Set(),
        pileCount: 0,
        invalidFormatCount: 0,
      });
    }
    const bucket = byKey.get(rowKey);
    if (!hasMatch) return;
    bucket.numSet.add(t.seqNum);
    bucket.pileCount += 1;
  });
  const towerRows = towerBucketsMapToSummaryRows(byKey);

  const byBuilding = new Map();
  state.circles.forEach((c) => {
    const mt = c.matched_text?.text;
    if (parseTowerCranePileText(mt).isTower) return;
    const name = (c.building_name || "").trim() || "미할당";
    if (!byBuilding.has(name)) {
      byBuilding.set(name, { numSet: new Set(), pileCount: 0, mismatchCount: 0, invalidFormatCount: 0 });
    }
    const bucket = byBuilding.get(name);
    const hasMatch = c.matched_text_id != null && c.matched_text_id !== "";
    const p = parseHyphenPileText(mt);
    if (!hasMatch) return;
    if (!p.hasHyphen) {
      const fb = getMatchedTextNumber(mt);
      if (Number.isInteger(fb) && fb >= 1) {
        bucket.numSet.add(fb);
        bucket.pileCount += 1;
      } else {
        bucket.invalidFormatCount += 1;
      }
      return;
    }
    if (!Number.isInteger(p.seqNum) || p.seqNum < 1) {
      const fb = getMatchedTextNumber(mt);
      if (Number.isInteger(fb) && fb >= 1) {
        bucket.numSet.add(fb);
        bucket.pileCount += 1;
      } else {
        bucket.invalidFormatCount += 1;
      }
      return;
    }
    if (p.dongKey != null && !dongKeyMatchesBuildingName(p.dongKey, name)) {
      bucket.mismatchCount += 1;
    }
    bucket.numSet.add(p.seqNum);
    bucket.pileCount += 1;
  });
  const hyphenRows = [];
  const names = [...byBuilding.keys()].sort((a, b) => (a === "미할당" ? 1 : b === "미할당" ? -1 : a.localeCompare(b)));
  names.forEach((buildingName) => {
    const { numSet, pileCount, mismatchCount, invalidFormatCount } = byBuilding.get(buildingName);
    if (!numSet.size) {
      hyphenRows.push({
        buildingName,
        craneNum: null,
        maxNum: 0,
        missing: [],
        pileCount,
        mismatchCount,
        invalidFormatCount,
        hyphenMode: true,
        towerMode: false,
      });
      return;
    }
    const maxNum = Math.max(...numSet);
    const missing = [];
    for (let n = 1; n <= maxNum; n++) {
      if (!numSet.has(n)) missing.push(n);
    }
    hyphenRows.push({
      buildingName,
      craneNum: null,
      maxNum,
      missing,
      pileCount,
      mismatchCount,
      invalidFormatCount,
      hyphenMode: true,
      towerMode: false,
    });
  });
  return [...towerRows, ...hyphenRows];
}

/**
 * 동별(미할당 포함) Matched TEXT 숫자 기준 범위(1~최대값)와 빠진 숫자 계산
 * 타워크레인 모드: 동·호기(Tn)별로 − 뒤 번호 집계. 동-번호 모드: 동키·형식 등.
 */
function computeBuildingSeqSummary() {
  if (!state.circles || !state.circles.length) return [];
  const tower = !!state.filter?.towerCraneNumberFormat;
  const hyphen = !!state.filter?.pileNumberHyphenFormat;
  if (tower && hyphen) {
    return computeBuildingSeqSummaryTowerAndHyphenTogether();
  }
  if (tower) {
    const byKey = new Map();
    state.circles.forEach((c) => {
      const name = (c.building_name || "").trim() || "미할당";
      const mt = c.matched_text?.text;
      const hasMatch = c.matched_text_id != null && c.matched_text_id !== "";
      const t = parseTowerCranePileText(mt);
      const p = parseHyphenPileText(mt);
      let rowKey;
      let craneNum = null;
      let towerColumnLabel = null;
      if (t.isTower) {
        rowKey = `${name}\0TC${t.craneNum}`;
        craneNum = t.craneNum;
      } else if (p.hasHyphen && Number.isInteger(p.seqNum) && p.seqNum >= 1) {
        const dk = p.dongKey != null ? p.dongKey : "X";
        rowKey = `${name}\0HY\0${dk}`;
        towerColumnLabel = p.dongKey != null ? `동${p.dongKey}` : "동-번호";
      } else {
        rowKey = `${name}\0TC_X`;
      }
      if (!byKey.has(rowKey)) {
        byKey.set(rowKey, {
          buildingName: name,
          craneNum,
          towerColumnLabel,
          numSet: new Set(),
          pileCount: 0,
          invalidFormatCount: 0,
          mismatchCount: 0,
        });
      }
      const bucket = byKey.get(rowKey);
      if (!hasMatch) return;
      if (t.isTower) {
        bucket.numSet.add(t.seqNum);
        bucket.pileCount += 1;
        return;
      }
      if (p.hasHyphen && Number.isInteger(p.seqNum) && p.seqNum >= 1) {
        if (p.dongKey != null && !dongKeyMatchesBuildingName(p.dongKey, name)) {
          bucket.mismatchCount += 1;
        }
        bucket.numSet.add(p.seqNum);
        bucket.pileCount += 1;
        return;
      }
      const fb = getMatchedTextNumber(mt);
      if (Number.isInteger(fb) && fb >= 1) {
        bucket.numSet.add(fb);
        bucket.pileCount += 1;
      } else {
        bucket.invalidFormatCount += 1;
      }
    });
    const result = [];
    [...byKey.entries()]
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .forEach(([, bucket]) => {
        const { buildingName, craneNum, towerColumnLabel, numSet, pileCount, invalidFormatCount, mismatchCount } = bucket;
        if (!numSet.size) {
          result.push({
            buildingName,
            craneNum,
            towerColumnLabel,
            maxNum: 0,
            missing: [],
            pileCount,
            mismatchCount: mismatchCount || 0,
            invalidFormatCount,
            hyphenMode: false,
            towerMode: true,
          });
          return;
        }
        const maxNum = Math.max(...numSet);
        const missing = [];
        for (let n = 1; n <= maxNum; n++) {
          if (!numSet.has(n)) missing.push(n);
        }
        result.push({
          buildingName,
          craneNum,
          towerColumnLabel,
          maxNum,
          missing,
          pileCount,
          mismatchCount: mismatchCount || 0,
          invalidFormatCount,
          hyphenMode: false,
          towerMode: true,
        });
      });
    return result;
  }

  return computeHyphenStyleBuildingSummary(hyphen);
}

function updateBuildingSeqSummary() {
  const tbody = document.getElementById("building-seq-summary-body");
  if (!tbody) return;
  const tower = !!state.filter?.towerCraneNumberFormat;
  const hyphen = !!state.filter?.pileNumberHyphenFormat;
  if (buildingSeqSummaryHint) {
    buildingSeqSummaryHint.style.display = tower || hyphen ? "block" : "none";
    if (tower && hyphen) {
      buildingSeqSummaryHint.textContent =
        "T4-1/TC4-1(T/TC 접두)만 타워 호기 집계, 4-1처럼 T/TC 없는 하이픈은 동-번호(앞=동키)로 집계합니다.";
    } else if (tower) {
      buildingSeqSummaryHint.textContent =
        "T4-1/TC4-1만 타워(호기−파일). 4-1 형식은 동-번호(앞 숫자=동키, −뒤=파일 번호)로 집계합니다.";
    } else if (hyphen) {
      buildingSeqSummaryHint.textContent =
        "동-번호 형식: 하이픈 앞은 동키, 뒤는 파일 번호만 사용합니다.";
    }
  }
  if (buildingSeqSummaryHead) {
    if (tower) {
      buildingSeqSummaryHead.innerHTML = `<tr>
      <th>Building (윤곽)</th>
      <th>타워<br /><small style="font-weight:400">호기</small></th>
      <th>본수<br /><small style="font-weight:400">−뒤 유효</small></th>
      <th>범위<br /><small style="font-weight:400">−뒤만</small></th>
      <th>빠진/형식</th>
    </tr>`;
    } else {
      buildingSeqSummaryHead.innerHTML = hyphen
        ? `<tr>
      <th>Building (윤곽)</th>
      <th>본수<br /><small style="font-weight:400">−뒤 유효</small></th>
      <th>범위<br /><small style="font-weight:400">−뒤만</small></th>
      <th>빠진 번호<br /><small style="font-weight:400">−뒤만</small></th>
      <th>동키↔동명</th>
    </tr>`
        : `<tr>
      <th>Building</th>
      <th>본수</th>
      <th>범위 (1 ~ 최대값)</th>
      <th>빠진 숫자</th>
    </tr>`;
    }
  }
  tbody.innerHTML = "";
  const rows = computeBuildingSeqSummary();
  const colSpan = tower || hyphen ? 5 : 4;
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colSpan;
    cell.className = "empty-row";
    cell.textContent = state.hasDataset ? "동별 데이터가 없습니다." : "DXF를 업로드하면 동별 번호 현황이 표시됩니다.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  const bothTowerAndHyphen = tower && hyphen;
  let hyphenSectionInserted = false;
  rows.forEach(
    ({
      buildingName,
      craneNum,
      towerColumnLabel = null,
      maxNum,
      missing,
      pileCount,
      mismatchCount,
      invalidFormatCount,
      hyphenMode,
      towerMode,
    }) => {
      if (bothTowerAndHyphen && hyphenMode && !hyphenSectionInserted) {
        hyphenSectionInserted = true;
        const sep = document.createElement("tr");
        sep.innerHTML = `<td colspan="5" style="font-weight:600;background:rgba(148,163,184,0.12)">동-번호 형식 (T 접두 없는 하이픈 매칭)</td>`;
        fragment.appendChild(sep);
      }
      const row = document.createElement("tr");
      const rangeText = maxNum >= 1 ? `1 ~ ${maxNum}` : "—";
      const missingText = missing.length ? missing.join(", ") : "—";
      if (towerMode) {
        const craneLabel =
          craneNum != null ? `T${craneNum}` : towerColumnLabel != null ? towerColumnLabel : "기타";
        const tailParts = [];
        if (invalidFormatCount > 0) tailParts.push(`T형식 외 ${invalidFormatCount}`);
        if ((mismatchCount || 0) > 0) tailParts.push(`동키↔동명 ${mismatchCount}`);
        const tailCell =
          tailParts.length > 0
            ? `${escapeHtml(missingText)} · ${tailParts.join(" · ")}`
            : escapeHtml(missingText);
        row.innerHTML = `
      <td>${escapeHtml(buildingName)}</td>
      <td>${escapeHtml(craneLabel)}</td>
      <td>${pileCount}</td>
      <td>${rangeText}</td>
      <td>${tailCell}</td>
    `;
      } else if (hyphenMode) {
        let dongCell = "—";
        if (mismatchCount > 0 || invalidFormatCount > 0) {
          const parts = [];
          if (mismatchCount > 0) parts.push(`불일치 ${mismatchCount}`);
          if (invalidFormatCount > 0) parts.push(`−형식 ${invalidFormatCount}`);
          dongCell = parts.join(" · ");
        } else {
          dongCell = "OK";
        }
        if (bothTowerAndHyphen) {
          row.innerHTML = `
      <td>${escapeHtml(buildingName)}</td>
      <td>동-번호</td>
      <td>${pileCount}</td>
      <td>${rangeText}</td>
      <td>${escapeHtml(missingText)} · ${escapeHtml(dongCell)}</td>
    `;
        } else {
          row.innerHTML = `
      <td>${escapeHtml(buildingName)}</td>
      <td>${pileCount}</td>
      <td>${rangeText}</td>
      <td>${escapeHtml(missingText)}</td>
      <td>${escapeHtml(dongCell)}</td>
    `;
        }
      } else {
        row.innerHTML = `
      <td>${escapeHtml(buildingName)}</td>
      <td>${pileCount}</td>
      <td>${rangeText}</td>
      <td>${escapeHtml(missingText)}</td>
    `;
      }
      fragment.appendChild(row);
    },
  );
  tbody.appendChild(fragment);
}

function updateDuplicatesTable() {
  duplicatesTableBody.innerHTML = "";
  duplicatesCount.textContent = state.duplicates.length.toString();
  if (!state.duplicates.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-row";
    cell.textContent = "중복 좌표가 없습니다.";
    row.appendChild(cell);
    duplicatesTableBody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  state.duplicates.forEach((group) => {
    const row = document.createElement("tr");
    const button = document.createElement("button");
    button.textContent = "보기";
    button.className = "ghost";
    button.addEventListener("click", () => {
      setHighlightedCircles(group.circle_ids, true);
    });
    const matchedTexts = group.details
      .map((detail) => detail.matched_text?.text)
      .filter(Boolean)
      .join(", ");
    row.innerHTML = `
      <td>${formatNumber(group.coord_key.y)}</td>
      <td>${formatNumber(group.coord_key.x)}</td>
      <td>${group.count}</td>
      <td>${group.circle_ids.join(", ")}</td>
      <td>${matchedTexts || "-"}</td>
      <td></td>
    `;
    row.lastElementChild.appendChild(button);
    fragment.appendChild(row);
  });
  duplicatesTableBody.appendChild(fragment);
}

const ERROR_TYPE_LABELS = {
  TEXT_NO_MATCH: "텍스트 미매칭",
  TEXT_MULTI_MATCH: "텍스트 중복매칭",
  CIRCLE_NO_MATCH: "좌표 미매칭",
  MATCH_DISTANCE_EXCEEDED: "거리초과",
  SAME_BUILDING_NUMBER_DUPLICATE: "동·미지정 내 번호중복",
  TEXT_DONG_BUILDING_MISMATCH: "동키↔윤곽 동명 불일치",
  NUMERIC_HYPHEN_FORMAT_INVALID: "숫자 포맷 에러",
};

const COORD_PRECISION = 6;

function foundationPfOnlyFromTextValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-");
  const compact = normalized.replace(/\s+/g, "");
  if (!compact) return false;
  if (/^[0-9.\-]+$/.test(compact)) return false;
  if (/^(?:T|TC)(\d+)-(\d+)$/i.test(compact)) return false;
  const c0 = compact[0]?.toUpperCase();
  if (c0 !== "P" && c0 !== "F") return false;
  if (compact.length === 1) return true;
  const c1 = compact[1];
  return c1 === "-" || c1 === "." || /\d/.test(c1);
}

function isFoundationPfOnlyTextRecord(text) {
  if (!text || typeof text !== "object") return false;
  if (text.foundation_pf_only === true) return true;
  return foundationPfOnlyFromTextValue(text.text);
}

function isAmbiguousNumericHyphenText(value) {
  const compact = normalizePileTextHyphens(String(value ?? "").trim()).replace(/\s+/g, "");
  if (!compact) return false;
  if (/^(?:T|TC)\d+-\d+$/i.test(compact)) return false;
  return /^\d{3,}-\d+$/.test(compact);
}

function countMatchableTexts(texts) {
  return (texts || []).reduce((count, text) => (
    isFoundationPfOnlyTextRecord(text) ? count : count + 1
  ), 0);
}

/** 불러온 circles/texts만으로 에러 목록 재계산 및 각 circle/text에 has_error 반영 (불러오기 시 저장에 에러가 없을 때 사용) */
function buildErrorsFromCirclesAndTexts(circles, texts) {
  const errors = [];
  const textToCircleIds = new Map();
  circles.forEach((c) => {
    let tid = c.matched_text_id;
    if ((tid == null || tid === "") && c.matched_text && c.matched_text.id != null && c.matched_text.id !== "") {
      tid = c.matched_text.id;
      c.matched_text_id = tid;
    }
    if (tid == null || tid === "") return;
    const key = String(tid);
    if (!textToCircleIds.has(key)) textToCircleIds.set(key, []);
    textToCircleIds.get(key).push(c.id);
  });
  (texts || []).forEach((text) => {
    if (isFoundationPfOnlyTextRecord(text)) {
      text.foundation_pf_only = true;
      text.matched_circle_ids = [];
      text.has_error = false;
      return;
    }
    const circleIds = textToCircleIds.get(String(text.id)) || [];
    text.matched_circle_ids = circleIds;
    let hasError = false;
    if (isAmbiguousNumericHyphenText(text.text)) {
      hasError = true;
      errors.push({
        error_type: "NUMERIC_HYPHEN_FORMAT_INVALID",
        text_id: text.id,
        text_value: text.text,
        circle_ids: circleIds,
        message: `TEXT ${text.text} has ambiguous numeric hyphen format (expected pure number).`,
      });
    }
    if (circleIds.length > 1) {
      hasError = true;
      errors.push({
        error_type: "TEXT_MULTI_MATCH",
        text_id: text.id,
        text_value: text.text,
        circle_ids: circleIds,
        message: `TEXT ${text.text} matches ${circleIds.length} circles.`,
      });
    } else if (circleIds.length === 0) {
      hasError = true;
      errors.push({
        error_type: "TEXT_NO_MATCH",
        text_id: text.id,
        text_value: text.text,
        circle_ids: [],
        message: `TEXT ${text.text} has no matching circle.`,
      });
    }
    text.has_error = hasError;
  });
  circles.forEach((circle) => {
    const codes = [];
    let ctid = circle.matched_text_id;
    if ((ctid == null || ctid === "") && circle.matched_text && circle.matched_text.id != null) {
      ctid = circle.matched_text.id;
      circle.matched_text_id = ctid;
    }
    const tidKey = ctid != null && ctid !== "" ? String(ctid) : "";
    const linkedCircleIds = tidKey ? textToCircleIds.get(tidKey) || [] : [];
    if (linkedCircleIds.length > 1) codes.push("TEXT_MULTI_MATCH");
    if (isAmbiguousNumericHyphenText(circle.matched_text?.text)) {
      codes.push("NUMERIC_HYPHEN_FORMAT_INVALID");
    }
    if (circle.match_distance_exceeded && circle.manual_match !== true) {
      codes.push("MATCH_DISTANCE_EXCEEDED");
      errors.push({
        error_type: "MATCH_DISTANCE_EXCEEDED",
        text_id: null,
        text_value: null,
        circle_ids: [circle.id],
        message: "Matched TEXT exceeds the allowed distance threshold.",
      });
    }
    if (!ctid) {
      if (!hasSameGeometryCircleWithMatchedText(circle, circles)) {
        codes.push("CIRCLE_NO_MATCH");
        errors.push({
          error_type: "CIRCLE_NO_MATCH",
          text_id: null,
          text_value: null,
          circle_ids: [circle.id],
          message: `Circle ${circle.id} has no matching TEXT.`,
        });
      }
    }
    circle.has_error = codes.length > 0;
    circle.error_codes = codes;
  });
  appendSameBuildingNumberErrors(circles, errors);
  appendHyphenDongBuildingMismatchErrors(circles, errors);
  return errors;
}

/** 동-번호 모드: 텍스트 앞 동키가 윤곽선으로 정해진 동명과 맞지 않을 때 */
function appendHyphenDongBuildingMismatchErrors(circles, errors) {
  if (!state.filter?.pileNumberHyphenFormat) return;
  (circles || []).forEach((c) => {
    let tid = c.matched_text_id;
    if ((tid == null || tid === "") && c.matched_text && c.matched_text.id != null && c.matched_text.id !== "") {
      tid = c.matched_text.id;
    }
    if (tid == null || tid === "") return;
    const mt = c.matched_text?.text;
    if (parseTowerCranePileText(mt).isTower) return;
    const p = parseHyphenPileText(mt);
    if (!p.hasHyphen || p.dongKey == null) return;
    const bname = (c.building_name || "").trim() || "미할당";
    if (dongKeyMatchesBuildingName(p.dongKey, bname)) return;
    errors.push({
      error_type: "TEXT_DONG_BUILDING_MISMATCH",
      text_id: c.matched_text?.id ?? null,
      text_value: c.matched_text?.text ?? null,
      circle_ids: [c.id],
      message: `텍스트 동키(${p.dongKey})와 윤곽 동명 "${bname}"이(가) 맞지 않습니다.`,
    });
    const codes = c.error_codes ? [...c.error_codes] : [];
    if (!codes.includes("TEXT_DONG_BUILDING_MISMATCH")) codes.push("TEXT_DONG_BUILDING_MISMATCH");
    c.error_codes = codes;
    c.has_error = true;
  });
}

/** 같은 동(미할당 포함)에서 매칭 번호가 동일한 좌표가 2개 이상이면 에러·has_error 반영 */
function appendSameBuildingNumberErrors(circles, errors) {
  const groups = new Map();
  (circles || []).forEach((c) => {
    let tid = c.matched_text_id;
    if ((tid == null || tid === "") && c.matched_text && c.matched_text.id != null && c.matched_text.id !== "") {
      tid = c.matched_text.id;
    }
    if (tid == null || tid === "") return;
    const key = getSameBuildingNumberGroupKey(c);
    if (key == null) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  groups.forEach((items) => {
    if (items.length < 2) return;
    let siteCount = items.length;
    if (state.filter?.excludeIdenticalGeometryDuplicates) {
      const clusters = clusterCirclesByCoLocatedGeometryPolicy(items);
      if (clusters.length < 2) return;
      siteCount = clusters.length;
    }
    const display = getSameBuildingDuplicateDisplayLabel(items[0]);
    const bname = (items[0].building_name || "").trim() || "미할당";
    items.forEach((c) => {
      const codes = c.error_codes ? [...c.error_codes] : [];
      if (!codes.includes("SAME_BUILDING_NUMBER_DUPLICATE")) codes.push("SAME_BUILDING_NUMBER_DUPLICATE");
      c.error_codes = codes;
      c.has_error = true;
    });
    errors.push({
      error_type: "SAME_BUILDING_NUMBER_DUPLICATE",
      text_id: null,
      text_value: display,
      circle_ids: items.map((c) => c.id),
      message: `"${bname}"(동)에서 파일번호 ${display}이(가) ${siteCount}개 좌표에 중복되었습니다.`,
    });
  });
}

/** 동·미지정 내 동일 말뚝 번호 중복 그룹(좌표는 그룹 중심) — 겹침 중복과 별도 */
function buildSameBuildingNumberDuplicateGroups(circles) {
  const groups = new Map();
  (circles || []).forEach((c) => {
    if (c.matched_text_id == null || c.matched_text_id === "") return;
    const key = getSameBuildingNumberGroupKey(c);
    if (key == null) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  const cx = (c) => c.center_x ?? c.centerX;
  const cy = (c) => c.center_y ?? c.centerY;
  const out = [];
  groups.forEach((items) => {
    if (items.length < 2) return;
    let siteCount = items.length;
    if (state.filter?.excludeIdenticalGeometryDuplicates) {
      const clusters = clusterCirclesByCoLocatedGeometryPolicy(items);
      if (clusters.length < 2) return;
      siteCount = clusters.length;
    }
    const ax = items.reduce((s, c) => s + cx(c), 0) / items.length;
    const ay = items.reduce((s, c) => s + cy(c), 0) / items.length;
    out.push({
      coord_key: { x: ax, y: ay },
      count: siteCount,
      circle_ids: items.map((i) => i.id ?? i._id),
      details: items.map((item) => ({
        id: item.id,
        layer: item.layer,
        block_name: item.block_name,
        matched_text: item.matched_text || null,
        has_error: item.has_error || false,
      })),
    });
  });
  return out;
}

/**
 * circles/texts 현재 값으로 에러·중복 그룹·요약 카운트를 다시 맞춤.
 * 수동 매칭/해제 직후 payload 일부만 반영되거나 로컬 폴백 시 다른 항목의 has_error·중복 표시가 남는 것을 방지.
 */
function refreshMatchDerivedUIState() {
  if (!state.circles?.length) return;
  state.errors = buildErrorsFromCirclesAndTexts(state.circles, state.texts);
  const geoDup = buildDuplicatesFromCircles(state.circles);
  const numDup = buildSameBuildingNumberDuplicateGroups(state.circles);
  state.duplicates = [...geoDup, ...numDup];
  if (state.summary && typeof state.summary === "object") {
    state.summary.total_texts = countMatchableTexts(state.texts);
    state.summary.matched_pairs = state.circles.filter((c) => c.matched_text_id).length;
    state.summary.duplicate_groups = state.duplicates.length;
  }
}

/** 파일 좌표에서 중심·반지름이 실질적으로 동일한 원인지 (완전 겹침 엔티티 중복 판별). DXF 부동소수 반올림을 넉넉히 허용 */
const SAME_FILE_CIRCLE_GEOMETRY_EPS = 1e-4;

function sameFileCircleGeometry(a, b) {
  const cx = (c) => Number(c.center_x ?? c.centerX ?? 0);
  const cy = (c) => Number(c.center_y ?? c.centerY ?? 0);
  const r = (c) => Number(c.radius ?? (c.diameter != null ? c.diameter / 2 : 0));
  return (
    Math.abs(cx(a) - cx(b)) <= SAME_FILE_CIRCLE_GEOMETRY_EPS &&
    Math.abs(cy(a) - cy(b)) <= SAME_FILE_CIRCLE_GEOMETRY_EPS &&
    Math.abs(r(a) - r(b)) <= SAME_FILE_CIRCLE_GEOMETRY_EPS
  );
}

/**
 * strict 보다 약간 넓게 동일 파일 중복으로 간주(DXF 반올림). `geometryMatchesCoLocatedDupPolicy` 안에서만 쓰는 보조.
 */
function sameFileCircleGeometryLoose(a, b) {
  const cx = (c) => Number(c.center_x ?? c.centerX ?? 0);
  const cy = (c) => Number(c.center_y ?? c.centerY ?? 0);
  const rad = (c) => Number(c.radius ?? (c.diameter != null ? c.diameter / 2 : 0));
  const ra = rad(a);
  const rb = rad(b);
  if (ra <= 0 || rb <= 0) return false;
  const dx = cx(a) - cx(b);
  const dy = cy(a) - cy(b);
  const centerDistance = Math.hypot(dx, dy);
  const dr = Math.abs(ra - rb);
  const minRadius = Math.min(ra, rb);
  // 「중복 제외」 켜짐: 중심이 파일 반지름의 1/4 이내로 이동한 약한 오차는 동일 심볼로 간주한다.
  const centerTol = Math.max(SAME_FILE_CIRCLE_GEOMETRY_EPS * 16, minRadius * 0.25);
  // 반지름은 '동일 크기' 전제를 유지하되 도면 반올림 오차를 위해 소폭 허용.
  const rTol = Math.max(SAME_FILE_CIRCLE_GEOMETRY_EPS * 10, minRadius * 0.1);
  return centerDistance <= centerTol && dr <= rTol;
}

/**
 * 「동일 좌표·크기 원은 중복 제외」옵션에 따른 동일 말뚝 심볼 판정(겹침 중복·미매칭 완화 모두 동일 기준).
 * 켜짐: 느슨한 기준 / 꺼짐: 엄격한 기준
 */
function geometryMatchesCoLocatedDupPolicy(a, b) {
  if (state.filter?.excludeIdenticalGeometryDuplicates) {
    return sameFileCircleGeometryLoose(a, b);
  }
  return sameFileCircleGeometry(a, b);
}

/**
 * 동일 말뚝 심볼(geometryMatchesCoLocatedDupPolicy)끼리 union-find로 묶은 클러스터.
 * 「동일 좌표·크기 원 중복 제외」 시 동·번호 중복이 겹침 엔티티만으로 불어나지 않게 할 때 사용.
 */
function clusterCirclesByCoLocatedGeometryPolicy(circles) {
  const n = circles.length;
  if (n === 0) return [];
  if (n === 1) return [[circles[0]]];
  const parent = circles.map((_, i) => i);
  const find = (i) => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i, j) => {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (geometryMatchesCoLocatedDupPolicy(circles[i], circles[j])) union(i, j);
    }
  }
  const comp = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!comp.has(r)) comp.set(r, []);
    comp.get(r).push(circles[i]);
  }
  return [...comp.values()];
}

/** 겹침 중복 Union-Find에 넣을 쌍인지(옵션과 일관되게) */
function shouldUnionGeometricDuplicatePair(a, b) {
  // 「동일 좌표·크기 원은 중복 제외」: 이 목록은 엄격 동일 기하(이중 엔티티)만 묶는다.
  // 느슨 판정이 실패하고 엄격만 맞는 경우까지 union 되면 캔버스·요약에 '중복'이 남는다.
  if (state.filter?.excludeIdenticalGeometryDuplicates) {
    return false;
  }
  return sameFileCircleGeometry(a, b);
}

/**
 * 동일 기하의 다른 원에 이미 TEXT가 매칭되어 있으면 이 원은 좌표 미매칭(CIRCLE_NO_MATCH)으로 보지 않음.
 * 기준은 geometryMatchesCoLocatedDupPolicy 와 동일.
 */
function hasSameGeometryCircleWithMatchedText(circle, circles) {
  if (!circles?.length) return false;
  for (let i = 0; i < circles.length; i++) {
    const o = circles[i];
    if (!o || o.id === circle.id) continue;
    if (!geometryMatchesCoLocatedDupPolicy(circle, o)) continue;
    let oid = o.matched_text_id;
    if ((oid == null || oid === "") && o.matched_text && o.matched_text.id != null && o.matched_text.id !== "") {
      oid = o.matched_text.id;
    }
    if (oid != null && oid !== "") return true;
  }
  return false;
}

/** 불러온 circles만으로 좌표 겹침 중복 그룹 재계산 — 동일 위치·동일 반지름(이중 엔티티)만 묶음 */
function buildDuplicatesFromCircles(circles) {
  const cx = (c) => c.center_x ?? c.centerX;
  const cy = (c) => c.center_y ?? c.centerY;
  const n = circles.length;
  const parent = circles.map((_, i) => i);
  const find = (i) => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i, j) => {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!shouldUnionGeometricDuplicatePair(circles[i], circles[j])) continue;
      union(i, j);
    }
  }
  const comp = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!comp.has(root)) comp.set(root, []);
    comp.get(root).push(circles[i]);
  }
  const duplicates = [];
  comp.forEach((items) => {
    if (items.length < 2) return;
    const first = items[0];
    duplicates.push({
      coord_key: { x: cx(first), y: cy(first) },
      count: items.length,
      circle_ids: items.map((i) => i.id ?? i._id),
      details: items.map((item) => ({
        id: item.id,
        layer: item.layer,
        block_name: item.block_name,
        matched_text: item.matched_text || null,
        has_error: item.has_error || false,
      })),
    });
  });
  return duplicates;
}

/** 에러 목록을 기준으로 각 circle/text에 has_error 동기화 (불러온 데이터에 has_error가 없을 때) */
function syncHasErrorFromErrors(circles, texts, errors) {
  const circleIdsInError = new Set();
  const textIdsInError = new Set();
  errors.forEach((err) => {
    if (err.text_id) textIdsInError.add(err.text_id);
    (err.circle_ids || []).forEach((cid) => circleIdsInError.add(cid));
  });
  circles.forEach((c) => {
    c.has_error = circleIdsInError.has(c.id);
    if (c.has_error && !c.error_codes) c.error_codes = [];
  });
  (texts || []).forEach((t) => {
    t.has_error = textIdsInError.has(t.id);
  });
}

function updateErrorsTable() {
  errorsTableBody.innerHTML = "";
  errorsCount.textContent = state.errors.length.toString();

  const typeCounts = new Map();
  state.errors.forEach((err) => {
    const t = err.error_type || "UNKNOWN";
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  });

  if (errorsTypeFiltersContainer) {
    errorsTypeFiltersContainer.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = `전체 (${state.errors.length})`;
    allBtn.classList.toggle("active", state.activeErrorTypeFilter === "ALL");
    allBtn.addEventListener("click", () => {
      state.activeErrorTypeFilter = "ALL";
      updateErrorsTable();
    });
    errorsTypeFiltersContainer.appendChild(allBtn);
    [...typeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([type, count]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${ERROR_TYPE_LABELS[type] || type} (${count})`;
      btn.classList.toggle("active", state.activeErrorTypeFilter === type);
      btn.addEventListener("click", () => {
        state.activeErrorTypeFilter = type;
        updateErrorsTable();
      });
      errorsTypeFiltersContainer.appendChild(btn);
    });
  }

  const filteredErrors =
    state.activeErrorTypeFilter === "ALL"
      ? state.errors
      : state.errors.filter((e) => (e.error_type || "") === state.activeErrorTypeFilter);

  if (!filteredErrors.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-row";
    cell.textContent = state.errors.length
      ? `해당 타입 에러가 없습니다. (필터: ${ERROR_TYPE_LABELS[state.activeErrorTypeFilter] || state.activeErrorTypeFilter})`
      : "매칭 에러가 없습니다.";
    row.appendChild(cell);
    errorsTableBody.appendChild(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredErrors.forEach((error) => {
    const row = document.createElement("tr");
    const button = document.createElement("button");
    button.textContent = "보기";
    button.className = "ghost";
    button.addEventListener("click", () => {
      if (error.text_id) {
        setManualTextSelection(error.text_id);
      }
      if (Array.isArray(error.circle_ids) && error.circle_ids.length) {
        setManualCircleSelection(error.circle_ids[0] || "", false);
        setHighlightedCircles(error.circle_ids, true);
      } else if (error.text_id) {
        focusOnText(error.text_id);
      } else {
        requestRedraw();
      }
    });
    const typeLabel = ERROR_TYPE_LABELS[error.error_type] || error.error_type || "-";
    const errorType = error.error_type || "";
    row.innerHTML = `
      <td><span class="error-type-badge" role="button" tabindex="0" data-error-type="${errorType.replace(/"/g, "&quot;")}" title="클릭 시 이 타입만 필터">${typeLabel}</span></td>
      <td>${error.text_id || "-"}</td>
      <td>${error.text_value || "-"}</td>
      <td>${error.circle_ids.join(", ") || "-"}</td>
      <td></td>
    `;
    const badge = row.querySelector(".error-type-badge");
    if (badge) {
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        state.activeErrorTypeFilter = errorType;
        updateErrorsTable();
      });
      badge.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          state.activeErrorTypeFilter = errorType;
          updateErrorsTable();
        }
      });
    }
    row.lastElementChild.appendChild(button);
    fragment.appendChild(row);
  });
  errorsTableBody.appendChild(fragment);
}

function createDefaultBuildingPolygon(segmentIndex = 0, totalSegments = 1) {
  const bounds = computeBounds();
  if (!bounds) {
    const size = 100;
    return [
      { x: -size, y: -size },
      { x: size, y: -size },
      { x: size, y: size },
      { x: -size, y: size },
    ];
  }
  const padding = Math.max((bounds.maxY - bounds.minY) * 0.05, 200);
  const span = bounds.maxX - bounds.minX || 1;
  const segmentWidth = span / totalSegments;
  const minX = bounds.minX + segmentWidth * segmentIndex;
  const maxX = segmentIndex === totalSegments - 1 ? bounds.maxX : minX + segmentWidth;
  return [
    { x: minX - padding, y: bounds.minY - padding },
    { x: maxX + padding, y: bounds.minY - padding },
    { x: maxX + padding, y: bounds.maxY + padding },
    { x: minX - padding, y: bounds.maxY + padding },
  ];
}

function createDefaultParkingPolygon(segmentIndex = 0, totalSegments = 1) {
  const bounds = computeBounds();
  if (!bounds) {
    return createDefaultBuildingPolygon(segmentIndex, totalSegments);
  }
  const padding = Math.max((bounds.maxY - bounds.minY) * 0.03, 120);
  const height = Math.max((bounds.maxY - bounds.minY) * 0.18, 220);
  const span = bounds.maxX - bounds.minX || 1;
  const segmentWidth = span / Math.max(1, totalSegments);
  const minX = bounds.minX + segmentWidth * segmentIndex;
  const maxX = segmentIndex === totalSegments - 1 ? bounds.maxX : minX + segmentWidth;
  const top = bounds.minY - padding;
  const bottom = top - height;
  return [
    { x: minX - padding, y: bottom },
    { x: maxX + padding, y: bottom },
    { x: maxX + padding, y: top },
    { x: minX - padding, y: top },
  ];
}

function buildRectangleVertices(startPoint, endPoint) {
  const minX = Math.min(startPoint.x, endPoint.x);
  const maxX = Math.max(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const maxY = Math.max(startPoint.y, endPoint.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function beginParkingRectangleCreation(order) {
  state.areaRectCreate = {
    kind: AREA_KIND_PARKING,
    order,
    startWorld: null,
    currentWorld: null,
  };
  state.buildingEditMode = true;
  syncBuildingEditModeButtons();
  updateCanvasModeHint();
  setUploadStatus("캔버스에서 좌상단과 우하단을 차례로 클릭해 지하주차장 네모를 만드세요.");
  requestRedraw();
}

function beginTowerCraneRectangleCreation(order) {
  state.areaRectCreate = {
    kind: AREA_KIND_TOWER_CRANE,
    order,
    startWorld: null,
    currentWorld: null,
  };
  state.buildingEditMode = true;
  syncBuildingEditModeButtons();
  updateCanvasModeHint();
  setUploadStatus("캔버스에서 좌상단과 우하단을 차례로 클릭해 타워크레인 네모를 만드세요.");
  requestRedraw();
}

function upsertAreaPolygonByOrder(kind, order, vertices) {
  const normalizedKind = normalizeAreaKind(kind);
  const currentAreas = getAreasByKind(normalizedKind).map((entry) => entry.building);
  const nextAreas = [...currentAreas];
  const areaName = getAreaNames(normalizedKind)[order] || getDefaultAreaName(normalizedKind, order);
  const nextArea = {
    ...(nextAreas[order] || {}),
    kind: normalizedKind,
    slot: order,
    name: areaName,
    vertices,
  };
  if (order < nextAreas.length) {
    nextAreas[order] = nextArea;
  } else {
    while (nextAreas.length < order) {
      nextAreas.push({
        kind: normalizedKind,
        name: getAreaNames(normalizedKind)[nextAreas.length] || getDefaultAreaName(normalizedKind, nextAreas.length),
        vertices: [],
      });
    }
    nextAreas.push(nextArea);
  }
  setAreasByKind(normalizedKind, nextAreas.filter((area) => Array.isArray(area.vertices) && area.vertices.length >= 3));
  syncPendingNamesWithBuildings();
  const areaEntries = getAreasByKind(normalizedKind);
  const highlightedEntry = areaEntries.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order);
  state.highlightedBuildingNameIndex = highlightedEntry?.actualIndex ?? -1;
  renderPendingNameEditor();
  renderBuildingTabs();
  populateBuildingSelect();
  requestRedraw();
}

function ensureBuildingsInitialized() {
  ensureAreaDefinitionsInitialized(AREA_KIND_BUILDING);
}

function ensureAreaDefinitionsInitialized(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  let names = [...getAreaNames(normalizedKind)];
  if (!names.length) {
    if (normalizedKind === AREA_KIND_BUILDING) {
      names = [getDefaultAreaName(normalizedKind, 0)];
      setAreaNames(normalizedKind, names);
    } else {
      syncAreaCountInputs();
      return;
    }
  }

  const areas = getAreasByKind(normalizedKind);
  if (areas.length) {
    setAreasByKind(
      normalizedKind,
      areas.map((entry, order) => ({
        ...entry.building,
        kind: normalizedKind,
        name: entry.building.name || names[order] || getDefaultAreaName(normalizedKind, order),
      })),
    );
    syncPendingNamesWithBuildings();
    return;
  }

  const count = names.length;
  let generated = [];
  if (normalizedKind === AREA_KIND_BUILDING) {
    ensureAutoBuildingOutlineFlagsLength();
    const anyAuto = names.some((_, i) => isAutoBuildingOutlineAtOrder(i));
    if (!anyAuto) {
      setAreasByKind(AREA_KIND_BUILDING, []);
      syncPendingNamesWithBuildings();
      return;
    }
    const usablePolylines = (Array.isArray(state.clusterPolylines) ? state.clusterPolylines : []).filter(
      (polyline) =>
        polyline.closed !== false &&
        Array.isArray(polyline.points) &&
        polyline.points.length >= 3,
    );
    generated = names.map((name, index) => {
      if (!isAutoBuildingOutlineAtOrder(index)) {
        return {
          kind: normalizedKind,
          name: name || getDefaultAreaName(normalizedKind, index),
          vertices: [],
        };
      }
      const source = usablePolylines[index % Math.max(1, usablePolylines.length)];
      const vertices =
        source && Array.isArray(source.points) && source.points.length >= 3
          ? source.points.map((point) => ({ x: point.x, y: point.y }))
          : createDefaultBuildingPolygon(index, count);
      return {
        kind: normalizedKind,
        name: name || getDefaultAreaName(normalizedKind, index),
        vertices,
      };
    });
  } else {
    generated = names.map((name, index) => ({
      kind: normalizedKind,
      name: name || getDefaultAreaName(normalizedKind, index),
      vertices: createDefaultParkingPolygon(index, count),
    }));
  }
  setAreasByKind(normalizedKind, generated);
  syncPendingNamesWithBuildings();
}

function getPendingDrillingElevationsArray(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return state.pendingDrillingElevationsParking;
  if (k === AREA_KIND_TOWER_CRANE) return state.pendingDrillingElevationsTowerCrane;
  return state.pendingDrillingElevationsBuilding;
}

function ensurePendingDrillingElevationsLength(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const names = getAreaNames(normalizedKind);
  const arr = getPendingDrillingElevationsArray(normalizedKind);
  while (arr.length < names.length) arr.push(null);
  if (arr.length > names.length) arr.length = names.length;
}

function getPendingFoundationTopArray(kind) {
  const k = normalizeAreaKind(kind);
  if (k === AREA_KIND_PARKING) return state.pendingFoundationTopParking;
  if (k === AREA_KIND_TOWER_CRANE) return state.pendingFoundationTopTowerCrane;
  return state.pendingFoundationTopBuilding;
}

function ensurePendingFoundationTopLength(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const names = getAreaNames(normalizedKind);
  const arr = getPendingFoundationTopArray(normalizedKind);
  while (arr.length < names.length) arr.push(null);
  if (arr.length > names.length) arr.length = names.length;
}

function buildingVerticesFingerprint(building) {
  const verts = building?.vertices;
  if (!Array.isArray(verts) || !verts.length) return "";
  return verts.map((p) => `${Number(p.x)}:${Number(p.y)}`).join("|");
}

/** 동 이름 목록·state.buildings(동 구간) 순서를 표시 이름(203동 숫자 순 등)에 맞춤 */
function sortBuildingAreasByDisplayName() {
  const buildingEntries = getAreasByKind(AREA_KIND_BUILDING);
  if (buildingEntries.length < 2) {
    syncPendingNamesWithBuildings();
    return;
  }
  let names = [...getAreaNames(AREA_KIND_BUILDING)];
  while (names.length < buildingEntries.length) {
    names.push(
      buildingEntries[names.length]?.building?.name ||
        getDefaultAreaName(AREA_KIND_BUILDING, names.length),
    );
  }
  ensurePendingDrillingElevationsLength(AREA_KIND_BUILDING);
  ensurePendingFoundationTopLength(AREA_KIND_BUILDING);
  const drilling = [...state.pendingDrillingElevationsBuilding];
  const foundationTopPend = [...state.pendingFoundationTopBuilding];

  const m = buildingEntries.length;
  const headNames = names.slice(0, m);
  const tailNames = names.slice(m);

  const labels = buildingEntries.map((entry, order) => {
    const n = headNames[order];
    return (n != null && String(n).trim() !== "" ? String(n).trim() : (entry.building.name || "")).trim();
  });

  const indices = buildingEntries.map((_, i) => i);
  indices.sort((i, j) => compareDongListNameSortKey(labels[i], labels[j]));

  if (indices.every((v, i) => v === i)) {
    syncPendingNamesWithBuildings();
    return;
  }

  const prevHighlightB =
    state.highlightedBuildingNameIndex >= 0 ? state.buildings[state.highlightedBuildingNameIndex] : null;
  const prevSelB = state.selectedBuildingIndex >= 0 ? state.buildings[state.selectedBuildingIndex] : null;
  const fpHighlight =
    prevHighlightB && normalizeAreaKind(prevHighlightB.kind) === AREA_KIND_BUILDING
      ? buildingVerticesFingerprint(prevHighlightB)
      : "";
  const fpSel = prevSelB ? buildingVerticesFingerprint(prevSelB) : "";

  const sortedBuildings = indices.map((i) => {
    const b = buildingEntries[i].building;
    const nm = labels[i];
    if (nm) b.name = nm;
    return b;
  });
  setAreasByKind(AREA_KIND_BUILDING, sortedBuildings);

  const sortedHead = indices.map((i, k) => {
    const raw = headNames[i];
    if (raw != null && String(raw).trim() !== "") return String(raw).trim();
    return sortedBuildings[k].name || getDefaultAreaName(AREA_KIND_BUILDING, k);
  });
  setAreaNames(AREA_KIND_BUILDING, [...sortedHead, ...tailNames]);

  state.pendingDrillingElevationsBuilding = indices.map((i) => drilling[i] ?? null);
  state.pendingFoundationTopBuilding = indices.map((i) => foundationTopPend[i] ?? null);
  ensurePendingDrillingElevationsLength(AREA_KIND_BUILDING);
  ensurePendingFoundationTopLength(AREA_KIND_BUILDING);

  syncPendingNamesWithBuildings();

  if (fpHighlight) {
    const idx = state.buildings.findIndex(
      (b) =>
        normalizeAreaKind(b.kind) === AREA_KIND_BUILDING && buildingVerticesFingerprint(b) === fpHighlight,
    );
    state.highlightedBuildingNameIndex = idx >= 0 ? idx : -1;
  }
  if (fpSel) {
    const idx = state.buildings.findIndex((b) => buildingVerticesFingerprint(b) === fpSel);
    if (idx >= 0) state.selectedBuildingIndex = idx;
  }
}

function syncPendingNamesWithBuildings() {
  syncPendingNamesForKind(AREA_KIND_BUILDING);
  syncPendingNamesForKind(AREA_KIND_PARKING);
  syncPendingNamesForKind(AREA_KIND_TOWER_CRANE);
  syncAreaCountInputs();
  ensurePendingDrillingElevationsLength(AREA_KIND_BUILDING);
  ensurePendingDrillingElevationsLength(AREA_KIND_PARKING);
  ensurePendingDrillingElevationsLength(AREA_KIND_TOWER_CRANE);
  ensurePendingFoundationTopLength(AREA_KIND_BUILDING);
  ensurePendingFoundationTopLength(AREA_KIND_PARKING);
  ensurePendingFoundationTopLength(AREA_KIND_TOWER_CRANE);
}

function syncPendingNamesForKind(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const areas = getAreasByKind(normalizedKind);
  let names = [...getAreaNames(normalizedKind)];
  if (!names.length && areas.length) {
    if (isSlotAreaKind(normalizedKind)) {
      const maxSlot = Math.max(...areas.map((entry, order) => getAreaSlot(entry, order)));
      names = Array.from({ length: maxSlot + 1 }, (_, order) => {
        const matchedEntry = areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order);
        return matchedEntry?.building?.name || getDefaultAreaName(normalizedKind, order);
      });
    } else {
      names = areas.map((entry, order) => entry.building.name || getDefaultAreaName(normalizedKind, order));
    }
  }
  if (!names.length && normalizedKind === AREA_KIND_BUILDING) {
    names = [getDefaultAreaName(normalizedKind, 0)];
  }
  // 동: 폴리곤은 아직 1개인데 입력/이름 목록만 늘린 경우(동 개수 적용 전) 이름을 유지해야 함.
  const requiredLength =
    isSlotAreaKind(normalizedKind) && areas.length
      ? getSlotAreaListSpan(normalizedKind, areas)
      : normalizedKind === AREA_KIND_BUILDING
        ? Math.max(areas.length, getConfiguredAreaCount(AREA_KIND_BUILDING))
        : areas.length;
  while (requiredLength && names.length < requiredLength) {
    const matchedEntry = isSlotAreaKind(normalizedKind)
      ? areas.find((entry, order) => getAreaSlot(entry, order) === names.length)
      : areas[names.length];
    names.push(matchedEntry?.building?.name || getDefaultAreaName(normalizedKind, names.length));
  }
  if (normalizedKind === AREA_KIND_BUILDING && requiredLength && names.length > requiredLength) {
    names = names.slice(0, requiredLength);
  }
  setAreaNames(normalizedKind, names);
}

/** 동·주차장 설정(state.buildings 배열)에 나타나는 순서 — 이름별 첫 인덱스 */
function getConfiguredBuildingNameOrder() {
  const nameOrder = new Map();
  (state.buildings || []).forEach((building, idx) => {
    const name = building?.name?.trim();
    if (name && !nameOrder.has(name)) nameOrder.set(name, idx);
  });
  return nameOrder;
}

/** 동 이름 비교: 설정 순서 우선, 동순위·미정은 가나다 */
function compareBuildingNamesByConfiguration(nameA, nameB, nameOrder) {
  const a = (nameA || "").trim() || "\uFFFF";
  const b = (nameB || "").trim() || "\uFFFF";
  const ia = nameOrder.has(a) ? nameOrder.get(a) : Number.MAX_SAFE_INTEGER;
  const ib = nameOrder.has(b) ? nameOrder.get(b) : Number.MAX_SAFE_INTEGER;
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, "ko");
}

function computeBuildingStats() {
  const allowedNames = new Set(
    (state.buildings || [])
      .map((building) => building?.name?.trim())
      .filter((name) => !!name)
  );
  const stats = {
    total: state.circles.length,
    errors: state.circles.filter((circle) => circle.has_error).length,
    unassigned: 0,
    perBuilding: new Map(Array.from(allowedNames).map((name) => [name, 0])),
  };
  state.circles.forEach((circle) => {
    const name = circle.building_name?.trim();
    if (name && allowedNames.has(name)) {
      stats.perBuilding.set(name, (stats.perBuilding.get(name) || 0) + 1);
    } else {
      stats.unassigned += 1;
    }
  });
  return stats;
}

function renderBuildingTabs() {
  buildingTabsContainer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const stats = computeBuildingStats();
  const allowedFilters = new Set(["ALL", "ERRORS", "UNASSIGNED"]);
  stats.perBuilding.forEach((_, name) => allowedFilters.add(name));
  if (!allowedFilters.has(state.activeBuildingFilter)) {
    state.activeBuildingFilter = "ALL";
  }
  fragment.appendChild(createBuildingFilterButton("ALL", "전체", stats.total));
  fragment.appendChild(createBuildingFilterButton("ERRORS", "매칭에러", stats.errors));
  fragment.appendChild(
    createBuildingFilterButton("UNASSIGNED", "미할당", stats.unassigned),
  );
  if (stats.perBuilding.size) {
    const nameOrder = getConfiguredBuildingNameOrder();
    const buildingEntries = [...stats.perBuilding.entries()].sort((a, b) =>
      compareBuildingNamesByConfiguration(a[0], b[0], nameOrder),
    );
    buildingEntries.forEach(([name, count]) => {
      fragment.appendChild(createBuildingFilterButton(name, name, count));
    });
  }
  buildingTabsContainer.appendChild(fragment);
}

function createBuildingFilterButton(value, label, count = null) {
  const button = document.createElement("button");
  button.textContent =
    count !== null && count !== undefined ? `${label} (${count})` : label;
  button.disabled = !state.hasDataset && value !== "ALL";
  if (state.activeBuildingFilter === value) {
    button.classList.add("active");
  }
  button.addEventListener("click", () => {
    if (button.disabled || state.activeBuildingFilter === value) {
      return;
    }
    state.activeBuildingFilter = value;
    updateCircleTable();
    requestRedraw();
    renderBuildingTabs();
  });
  return button;
}

function populateBuildingSelect() {
  if (!buildingSelect) return;
  buildingSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "영역을 생성한 뒤 선택하세요";
  buildingSelect.appendChild(defaultOption);
  state.buildings.forEach((building, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = building.name || getDefaultAreaName(normalizeAreaKind(building?.kind), index);
    if (state.selectedBuildingIndex === index) {
      option.selected = true;
    }
    buildingSelect.appendChild(option);
  });
  if (state.selectedBuildingIndex >= state.buildings.length) {
    state.selectedBuildingIndex = -1;
  }
}

function handleAddBuildingName() {
  // 동 개수 입력을 1 올린 뒤 change와 동일한 경로로만 처리(이름만 push하면 spinbox·동기화와 어긋날 수 있음)
  const next = getConfiguredAreaCount(AREA_KIND_BUILDING) + 1;
  if (buildingCountInput) {
    buildingCountInput.value = String(next);
    handleBuildingCountChange();
  } else {
    ensurePendingNameCount(AREA_KIND_BUILDING, next);
    ensurePendingDrillingElevationsLength(AREA_KIND_BUILDING);
    syncAreaCountInputs();
    renderPendingNameEditor();
  }
}

function handleAddParkingName() {
  handleAddAreaName(AREA_KIND_PARKING);
}

function handleAddTowerCraneName() {
  handleAddAreaName(AREA_KIND_TOWER_CRANE);
}

function handleAddAreaName(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  if (normalizedKind === AREA_KIND_BUILDING) {
    handleAddBuildingName();
    return;
  }
  const nextNames = [...getAreaNames(normalizedKind)];
  nextNames.push(getDefaultAreaName(normalizedKind, nextNames.length));
  setAreaNames(normalizedKind, nextNames);
  ensurePendingDrillingElevationsLength(normalizedKind);
  syncAreaCountInputs();
  renderPendingNameEditor();
}

function renderPendingNameEditor() {
  renderAreaNameEditor(AREA_KIND_BUILDING);
  renderAreaNameEditor(AREA_KIND_PARKING);
  renderAreaNameEditor(AREA_KIND_TOWER_CRANE);
}

/** 천공·기초 셀 우하단 엑셀식 채우기 핸들 */
function createNameEditorFillHandle(column, order) {
  const fillHandle = document.createElement("span");
  fillHandle.className = "name-editor-fill-handle";
  fillHandle.title =
    column === "drill"
      ? "세로로 끌어 천공시작 값을 아래·위 행에 복사합니다"
      : "세로로 끌어 기초상단 값을 아래·위 행에 복사합니다";
  fillHandle.dataset.fillColumn = column;
  fillHandle.dataset.fillOrder = String(order);
  fillHandle.setAttribute("role", "presentation");
  fillHandle.setAttribute("aria-hidden", "true");
  return fillHandle;
}

function renderAreaNameEditor(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const editor = getAreaEditorElement(normalizedKind);
  if (!editor) return;

  if (normalizedKind === AREA_KIND_BUILDING) {
    const ae = document.activeElement;
    const typing = ae && editor.contains(ae) && ae.tagName === "INPUT";
    if (!typing) {
      sortBuildingAreasByDisplayName();
    }
  }

  const names = getAreaNames(normalizedKind);
  const areas = getAreasByKind(normalizedKind);
  editor.innerHTML = "";
  if (!names.length) {
    const message = document.createElement("p");
    message.className = "empty-row";
    message.textContent = `${getAreaLabel(normalizedKind)} 이름이 없습니다.`;
    editor.appendChild(message);
    return;
  }

  const table = document.createElement("table");
  table.className = "name-editor-table";
  const thead = document.createElement("thead");
  const headTr = document.createElement("tr");
  const thLabels = [];
  if (normalizedKind === AREA_KIND_BUILDING) {
    thLabels.push({
      text: "",
      className: "name-editor-table__th name-editor-table__th--building-auto",
      title: "동별 클러스터 자동생성(목록 위 「자동생성」 열)",
    });
  }
  thLabels.push(
    { text: "번호", className: "name-editor-table__th name-editor-table__th--num", title: "" },
    {
      text:
        normalizedKind === AREA_KIND_BUILDING
          ? "동 이름"
          : normalizedKind === AREA_KIND_PARKING
            ? "주차장 이름"
            : "호기 번호",
      className: "name-editor-table__th name-editor-table__th--name",
      title: "",
    },
    { text: "천공시작", className: "name-editor-table__th name-editor-table__th--drill", title: "천공시작 레벨(m)" },
    {
      text: "기초상단",
      className: "name-editor-table__th name-editor-table__th--foundation",
      title: "기초골조 상단레벨(m) — 기성 정리표 기본값",
    },
    { text: "설정", className: "name-editor-table__th name-editor-table__th--actions", title: "" },
  );
  thLabels.forEach(({ text, className, title }) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = className;
    th.textContent = text;
    if (title) th.title = title;
    headTr.appendChild(th);
  });
  thead.appendChild(headTr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  names.forEach((name, order) => {
    const areaEntry = isSlotAreaKind(normalizedKind)
      ? areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order) || null
      : areas[order] || null;
    const actualIndex = areaEntry?.actualIndex ?? null;
    const outlinePickingThis =
      normalizedKind === AREA_KIND_BUILDING &&
      state.buildingOutlinePickMode &&
      state.buildingOutlinePickMode.order === order;
    const row = document.createElement("tr");
    row.className =
      "name-editor-row" +
      (actualIndex !== null && state.highlightedBuildingNameIndex === actualIndex
        ? " name-editor-row--selected"
        : "") +
      (outlinePickingThis ? " name-editor-row--outline-picking" : "");
    if (actualIndex !== null) {
      row.setAttribute("data-building-index", String(actualIndex));
    }
    const tdNum = document.createElement("td");
    tdNum.className = "name-editor-table__td name-editor-table__td--num";
    const label = document.createElement("span");
    label.className = "name-editor-label";
    label.textContent = `#${order + 1}`;
    tdNum.appendChild(label);
    const valueWrap = document.createElement("div");
    valueWrap.className = "name-editor-value";
    const input = document.createElement("input");
    if (isSlotAreaKind(normalizedKind)) {
      const prefix = document.createElement("span");
      prefix.className = "name-editor-prefix";
      prefix.textContent = normalizedKind === AREA_KIND_PARKING ? "B" : "T";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.value = getParkingAreaNumber(name, order);
      input.addEventListener("input", () => {
        const digits = input.value.replace(/\D+/g, "");
        input.value = digits;
        const nextNames = [...getAreaNames(normalizedKind)];
        nextNames[order] =
          normalizedKind === AREA_KIND_PARKING
            ? normalizeParkingAreaName(digits, order)
            : normalizeTowerAreaName(digits, order);
        setAreaNames(normalizedKind, nextNames);
      });
      valueWrap.appendChild(prefix);
    } else {
      input.value = name;
      input.addEventListener("input", () => {
        const nextNames = [...getAreaNames(normalizedKind)];
        nextNames[order] = input.value.trim();
        setAreaNames(normalizedKind, nextNames);
      });
      input.addEventListener("blur", () => {
        if (normalizedKind !== AREA_KIND_BUILDING) return;
        setTimeout(() => {
          if (buildingNameEditor?.contains(document.activeElement)) return;
          sortBuildingAreasByDisplayName();
          renderPendingNameEditor();
          populateBuildingSelect();
          renderBuildingTabs();
          requestRedraw();
        }, 0);
      });
    }
    valueWrap.appendChild(input);

    const tdName = document.createElement("td");
    tdName.className = "name-editor-table__td name-editor-table__td--name";
    tdName.appendChild(valueWrap);

    const drillInput = document.createElement("input");
    drillInput.type = "number";
    drillInput.step = "any";
    drillInput.className = "name-editor-drill-input";
    drillInput.dataset.drillingKind = normalizedKind;
    drillInput.dataset.drillingOrder = String(order);
    drillInput.placeholder = "레벨";
    drillInput.title =
      "천공시작 레벨(m). 비우면 해당 동·주차장·타워크레인에 배정된 좌표의 평균 Z를 시작 지반고로 사용합니다.";
    const drillingDisplayValue = (() => {
      if (actualIndex !== null) {
        const v = state.buildings[actualIndex]?.drilling_start_elevation;
        if (Number.isFinite(Number(v))) return String(v);
      }
      ensurePendingDrillingElevationsLength(normalizedKind);
      const p = getPendingDrillingElevationsArray(normalizedKind)[order];
      if (Number.isFinite(Number(p))) return String(p);
      return "";
    })();
    drillInput.value = drillingDisplayValue;
    drillInput.addEventListener("change", () => {
      const raw = drillInput.value.trim();
      const parsed = raw === "" ? null : Number(raw);
      const num = Number.isFinite(parsed) ? parsed : null;
      applyDrillingAtOrder(normalizedKind, order, num);
    });

    const foundationInput = document.createElement("input");
    foundationInput.type = "number";
    foundationInput.step = "any";
    foundationInput.className = "name-editor-drill-input name-editor-foundation-top-input";
    foundationInput.dataset.foundationKind = normalizedKind;
    foundationInput.dataset.foundationOrder = String(order);
    foundationInput.placeholder = "레벨";
    foundationInput.title =
      "기초골조 상단레벨(m). 기성 정리표의 해당 위치 행에 기본으로 채워집니다. 비우면 표에서만 수동 입력합니다.";
    const foundationDisplayValue = (() => {
      if (actualIndex !== null) {
        const v = state.buildings[actualIndex]?.foundation_top_elevation;
        if (Number.isFinite(Number(v))) return String(v);
      }
      ensurePendingFoundationTopLength(normalizedKind);
      const p = getPendingFoundationTopArray(normalizedKind)[order];
      if (Number.isFinite(Number(p))) return String(p);
      return "";
    })();
    foundationInput.value = foundationDisplayValue;
    foundationInput.addEventListener("change", () => {
      const raw = foundationInput.value.trim();
      const parsed = raw === "" ? null : Number(raw);
      const num = Number.isFinite(parsed) ? parsed : null;
      applyFoundationAtOrder(normalizedKind, order, num);
    });

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className =
      "ghost" +
      (normalizedKind === AREA_KIND_BUILDING && outlinePickingThis ? " name-editor-btn--outline-confirm" : "");
    if (normalizedKind === AREA_KIND_BUILDING) {
      if (isAutoBuildingOutlineAtOrder(order)) {
        createBtn.textContent = "보기";
        createBtn.disabled = actualIndex === null;
      } else {
        createBtn.textContent = outlinePickingThis ? "확인" : "생성";
        createBtn.disabled = !state.hasDataset;
      }
    } else {
      createBtn.textContent = isSlotAreaKind(normalizedKind) ? "생성" : "보기";
      createBtn.disabled = false;
    }
    createBtn.addEventListener("click", () => {
      if (normalizedKind === AREA_KIND_PARKING) {
        beginParkingRectangleCreation(order);
        return;
      }
      if (normalizedKind === AREA_KIND_TOWER_CRANE) {
        beginTowerCraneRectangleCreation(order);
        return;
      }
      if (normalizedKind === AREA_KIND_BUILDING && !isAutoBuildingOutlineAtOrder(order)) {
        if (outlinePickingThis) {
          confirmBuildingOutlinePolylinePick();
        } else {
          beginBuildingOutlinePolylinePick(order);
        }
        return;
      }
      if (actualIndex !== null) focusOnBuilding(actualIndex);
    });
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "ghost";
    viewBtn.textContent = "보기";
    viewBtn.disabled = actualIndex === null;
    viewBtn.addEventListener("click", () => {
      if (actualIndex !== null) focusOnBuilding(actualIndex);
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ghost";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => {
      const nextNames = [...getAreaNames(normalizedKind)];
      nextNames.splice(order, 1);
      setAreaNames(normalizedKind, nextNames);
      const pend = getPendingDrillingElevationsArray(normalizedKind);
      if (order >= 0 && order < pend.length) pend.splice(order, 1);
      const pendFound = getPendingFoundationTopArray(normalizedKind);
      if (order >= 0 && order < pendFound.length) pendFound.splice(order, 1);
      if (actualIndex !== null) {
        setAreasByKind(
          normalizedKind,
          areas
            .filter((entry) => entry.actualIndex !== actualIndex)
            .map((entry) => entry.building),
        );
        if (state.highlightedBuildingNameIndex === actualIndex) {
          state.highlightedBuildingNameIndex = -1;
        }
      }
      syncAreaCountInputs();
      syncPendingNamesWithBuildings();
      renderPendingNameEditor();
      renderBuildingTabs();
      populateBuildingSelect();
      requestRedraw();
    });
    const actionGroup = document.createElement("div");
    actionGroup.className = "name-editor-actions";
    actionGroup.appendChild(createBtn);
    if (isSlotAreaKind(normalizedKind)) {
      actionGroup.appendChild(viewBtn);
    }
    actionGroup.appendChild(removeBtn);

    const tdDrill = document.createElement("td");
    tdDrill.className = "name-editor-table__td name-editor-table__td--drill name-editor-level-cell";
    tdDrill.dataset.levelColumn = "drill";
    tdDrill.appendChild(drillInput);
    tdDrill.appendChild(createNameEditorFillHandle("drill", order));
    const tdFound = document.createElement("td");
    tdFound.className = "name-editor-table__td name-editor-table__td--foundation name-editor-level-cell";
    tdFound.dataset.levelColumn = "foundation";
    tdFound.appendChild(foundationInput);
    tdFound.appendChild(createNameEditorFillHandle("foundation", order));
    const tdAct = document.createElement("td");
    tdAct.className = "name-editor-table__td name-editor-table__td--actions";
    tdAct.appendChild(actionGroup);

    if (normalizedKind === AREA_KIND_BUILDING) {
      const tdBuildingAuto = document.createElement("td");
      tdBuildingAuto.className = "name-editor-table__td name-editor-table__td--building-auto";
      const autoCb = document.createElement("input");
      autoCb.type = "checkbox";
      autoCb.className = "name-editor-building-auto-cb";
      autoCb.dataset.buildingAutoOrder = String(order);
      autoCb.checked = isAutoBuildingOutlineAtOrder(order);
      autoCb.title = "이 동만 클러스터 폴리라인으로 윤곽 자동 생성";
      autoCb.addEventListener("change", () => {
        ensureAutoBuildingOutlineFlagsLength();
        state.autoBuildingOutlineByOrder[order] = autoCb.checked;
        if (autoCb.checked && state.buildingOutlinePickMode?.order === order) {
          state.buildingOutlinePickMode = null;
          state.buildingOutlinePickClick = null;
          updateCanvasModeHint();
        }
        syncBuildingOutlineAutoUi();
        renderPendingNameEditor();
      });
      tdBuildingAuto.appendChild(autoCb);
      row.appendChild(tdBuildingAuto);
    }
    row.appendChild(tdNum);
    row.appendChild(tdName);
    row.appendChild(tdDrill);
    row.appendChild(tdFound);
    row.appendChild(tdAct);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  editor.appendChild(table);
  ensureNameEditorPasteHandler(editor, normalizedKind);
  ensureNameEditorFillDragHandler(editor);
}

function applyDrillingAtOrder(normalizedKind, order, num) {
  ensurePendingDrillingElevationsLength(normalizedKind);
  const pend = getPendingDrillingElevationsArray(normalizedKind);
  const areas = getAreasByKind(normalizedKind);
  const areaEntry = isSlotAreaKind(normalizedKind)
    ? areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order) || null
    : areas[order] || null;
  const actualIndex = areaEntry?.actualIndex ?? null;
  if (actualIndex !== null) {
    const b = state.buildings[actualIndex];
    if (num == null) delete b.drilling_start_elevation;
    else b.drilling_start_elevation = num;
    pend[order] = null;
  } else {
    pend[order] = num;
  }
}

function applyFoundationAtOrder(normalizedKind, order, num) {
  ensurePendingFoundationTopLength(normalizedKind);
  const pend = getPendingFoundationTopArray(normalizedKind);
  const areas = getAreasByKind(normalizedKind);
  const areaEntry = isSlotAreaKind(normalizedKind)
    ? areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order) || null
    : areas[order] || null;
  const actualIndex = areaEntry?.actualIndex ?? null;
  if (actualIndex !== null) {
    const b = state.buildings[actualIndex];
    if (num == null) delete b.foundation_top_elevation;
    else b.foundation_top_elevation = num;
    pend[order] = null;
  } else {
    pend[order] = num;
  }
}

function parsePastedLevelToken(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function nameEditorLevelPasteHandler(e) {
  const editor = e.currentTarget;
  const normalizedKind = normalizeAreaKind(editor?.dataset?.nameEditorKind || "");
  if (!editor || !normalizedKind) return;
  const target = e.target;
  if (!target || target.tagName !== "INPUT") return;
  const isFoundationCol = target.classList.contains("name-editor-foundation-top-input");
  const isDrillCol = target.classList.contains("name-editor-drill-input") && !isFoundationCol;
  if (!isDrillCol && !isFoundationCol) return;

  const text = e.clipboardData?.getData("text/plain");
  if (text == null || text === "") return;
  const lines = String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return;
  if (lines.length === 1 && !lines[0].includes("\t")) return;

  e.preventDefault();
  e.stopPropagation();

  const names = getAreaNames(normalizedKind);
  const startOrder = Number(isFoundationCol ? target.dataset.foundationOrder : target.dataset.drillingOrder);
  if (!Number.isFinite(startOrder) || startOrder < 0) return;

  lines.forEach((line, j) => {
    const rowOrder = startOrder + j;
    if (rowOrder < 0 || rowOrder >= names.length) return;
    const parts = line.split("\t").map((p) => p.trim());
    const n0 = parsePastedLevelToken(parts[0]);
    const n1 = parts.length >= 2 ? parsePastedLevelToken(parts[1]) : null;
    if (isDrillCol) {
      if (parts.length >= 2) {
        applyDrillingAtOrder(normalizedKind, rowOrder, n0);
        applyFoundationAtOrder(normalizedKind, rowOrder, n1);
      } else {
        applyDrillingAtOrder(normalizedKind, rowOrder, n0);
      }
    } else if (parts.length >= 2) {
      applyDrillingAtOrder(normalizedKind, rowOrder, n0);
      applyFoundationAtOrder(normalizedKind, rowOrder, n1);
    } else {
      applyFoundationAtOrder(normalizedKind, rowOrder, n0);
    }
  });

  renderPendingNameEditor();
  renderBuildingTabs();
  populateBuildingSelect();
  requestRedraw();
}

function ensureNameEditorPasteHandler(editor, normalizedKind) {
  if (!editor) return;
  editor.dataset.nameEditorKind = normalizeAreaKind(normalizedKind);
  if (editor.dataset.pilexyLevelPasteBound === "1") return;
  editor.dataset.pilexyLevelPasteBound = "1";
  editor.addEventListener("paste", nameEditorLevelPasteHandler, true);
}

let nameEditorFillDragSession = null;

function findNameEditorFillEndOrder(editor, clientY) {
  const rows = [...editor.querySelectorAll("tbody tr.name-editor-row")];
  if (!rows.length) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].getBoundingClientRect();
    const cy = (r.top + r.bottom) / 2;
    const d = Math.abs(clientY - cy);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function nameEditorFillClearPreview(editor) {
  editor?.querySelectorAll("td.name-editor-fill-preview").forEach((td) => td.classList.remove("name-editor-fill-preview"));
}

function nameEditorFillSetPreview(editor, column, lo, hi) {
  nameEditorFillClearPreview(editor);
  const rows = editor.querySelectorAll("tbody tr.name-editor-row");
  for (let o = lo; o <= hi; o++) {
    const row = rows[o];
    if (!row) continue;
    const td = row.querySelector(`td[data-level-column="${column}"]`);
    if (td) td.classList.add("name-editor-fill-preview");
  }
}

function nameEditorFillCommit(session, endOrder) {
  const { kind, column, startOrder, sourceRaw, editor } = session;
  const lo = Math.min(startOrder, endOrder);
  const hi = Math.max(startOrder, endOrder);
  nameEditorFillClearPreview(editor);
  if (lo === hi) return;
  const num = parsePastedLevelToken(sourceRaw);
  for (let o = lo; o <= hi; o++) {
    if (column === "drill") applyDrillingAtOrder(kind, o, num);
    else applyFoundationAtOrder(kind, o, num);
  }
  renderPendingNameEditor();
  renderBuildingTabs();
  populateBuildingSelect();
  requestRedraw();
}

function nameEditorFillPointerDown(e) {
  const handle = e.target.closest(".name-editor-fill-handle");
  if (!handle || !e.isPrimary) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const editor = e.currentTarget;
  const normalizedKind = normalizeAreaKind(editor?.dataset?.nameEditorKind || "");
  if (!normalizedKind) return;
  const column = handle.dataset.fillColumn;
  if (column !== "drill" && column !== "foundation") return;
  const startOrder = Number(handle.dataset.fillOrder);
  if (!Number.isFinite(startOrder) || startOrder < 0) return;
  const td = handle.closest("td");
  if (!td) return;
  const input =
    column === "foundation"
      ? td.querySelector("input.name-editor-foundation-top-input")
      : td.querySelector("input.name-editor-drill-input:not(.name-editor-foundation-top-input)");
  const sourceRaw = input ? String(input.value ?? "") : "";

  e.preventDefault();
  e.stopPropagation();

  try {
    handle.setPointerCapture(e.pointerId);
  } catch (_) {}

  nameEditorFillDragSession = {
    kind: normalizedKind,
    column,
    startOrder,
    sourceRaw,
    editor,
    pointerId: e.pointerId,
    handleEl: handle,
    lastEnd: startOrder,
  };
  nameEditorFillSetPreview(editor, column, startOrder, startOrder);

  let finished = false;
  const finish = (ev) => {
    if (finished) return;
    if (!nameEditorFillDragSession || ev.pointerId !== nameEditorFillDragSession.pointerId) return;
    finished = true;
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", finish);
    handle.removeEventListener("lostpointercapture", finish);
    try {
      handle.releasePointerCapture(ev.pointerId);
    } catch (_) {}

    const sess = nameEditorFillDragSession;
    nameEditorFillDragSession = null;
    if (!sess) return;

    const endOrder = findNameEditorFillEndOrder(sess.editor, ev.clientY);
    nameEditorFillCommit(sess, endOrder);
  };

  const onMove = (ev) => {
    if (!nameEditorFillDragSession || ev.pointerId !== nameEditorFillDragSession.pointerId) return;
    const endOrder = findNameEditorFillEndOrder(editor, ev.clientY);
    if (endOrder === nameEditorFillDragSession.lastEnd) return;
    nameEditorFillDragSession.lastEnd = endOrder;
    const lo = Math.min(startOrder, endOrder);
    const hi = Math.max(startOrder, endOrder);
    nameEditorFillSetPreview(editor, column, lo, hi);
  };

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
}

function ensureNameEditorFillDragHandler(editor) {
  if (!editor || editor.dataset.pilexyFillDragBound === "1") return;
  editor.dataset.pilexyFillDragBound = "1";
  editor.addEventListener("pointerdown", nameEditorFillPointerDown, true);
}

/**
 * 이름 목록에 보이는 천공시작 입력란 값을 모두 읽어 state 에 반영합니다.
 * (change 이벤트 없이 입력만 한 경우 대비)
 * @returns {number} 처리한 입력 칸 수
 */
function flushDrillingInputsFromDom(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const editor = getAreaEditorElement(normalizedKind);
  if (!editor) return 0;
  const inputs = editor.querySelectorAll("input.name-editor-drill-input:not(.name-editor-foundation-top-input)");
  let count = 0;
  inputs.forEach((input) => {
    const dk = input.dataset.drillingKind;
    if (dk && dk !== normalizedKind) return;
    const order = Number(input.dataset.drillingOrder);
    if (!Number.isFinite(order) || order < 0) {
      return;
    }
    const areas = getAreasByKind(normalizedKind);
    const areaEntry = isSlotAreaKind(normalizedKind)
      ? areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order) || null
      : areas[order] || null;
    const actualIndex = areaEntry?.actualIndex ?? null;
    const raw = String(input.value ?? "").trim();
    const parsed = raw === "" ? null : Number(raw);
    const num = Number.isFinite(parsed) ? parsed : null;
    ensurePendingDrillingElevationsLength(normalizedKind);
    const pend = getPendingDrillingElevationsArray(normalizedKind);
    if (actualIndex !== null) {
      const b = state.buildings[actualIndex];
      if (num == null) delete b.drilling_start_elevation;
      else b.drilling_start_elevation = num;
      pend[order] = null;
    } else {
      pend[order] = num;
    }
    count += 1;
  });
  return count;
}

function flushFoundationTopInputsFromDom(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const editor = getAreaEditorElement(normalizedKind);
  if (!editor) return 0;
  const inputs = editor.querySelectorAll("input.name-editor-foundation-top-input");
  let count = 0;
  inputs.forEach((input) => {
    const fk = input.dataset.foundationKind;
    if (fk && fk !== normalizedKind) return;
    const order = Number(input.dataset.foundationOrder);
    if (!Number.isFinite(order) || order < 0) {
      return;
    }
    const areas = getAreasByKind(normalizedKind);
    const areaEntry = isSlotAreaKind(normalizedKind)
      ? areas.find((entry, entryOrder) => getAreaSlot(entry, entryOrder) === order) || null
      : areas[order] || null;
    const actualIndex = areaEntry?.actualIndex ?? null;
    const raw = String(input.value ?? "").trim();
    const parsed = raw === "" ? null : Number(raw);
    const num = Number.isFinite(parsed) ? parsed : null;
    ensurePendingFoundationTopLength(normalizedKind);
    const pend = getPendingFoundationTopArray(normalizedKind);
    if (actualIndex !== null) {
      const b = state.buildings[actualIndex];
      if (num == null) delete b.foundation_top_elevation;
      else b.foundation_top_elevation = num;
      pend[order] = null;
    } else {
      pend[order] = num;
    }
    count += 1;
  });
  return count;
}

/**
 * 천공·기초골조 상단 입력 확정: DOM → state, 윤곽이 있으면 이름 적용과 동일 병합, 불러온 작업이면 PUT 저장 시도.
 */
async function handleSaveDrillingElevations(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const label =
    normalizedKind === AREA_KIND_PARKING
      ? "지하주차장"
      : normalizedKind === AREA_KIND_TOWER_CRANE
        ? "타워크레인"
        : "동";
  const names = getAreaNames(normalizedKind);
  if (!names.length) {
    setUploadStatus(`${label} 이름 목록이 없습니다.`, true);
    return;
  }
  const flushedDrill = flushDrillingInputsFromDom(normalizedKind);
  const flushedFound = flushFoundationTopInputsFromDom(normalizedKind);
  if (flushedDrill === 0 && flushedFound === 0) {
    setUploadStatus(
      "천공시작·기초상단 입력란을 찾지 못했습니다. 동 설정 패널을 연 뒤 다시 눌러 주세요. (페이지를 예전에 연 상태면 새로고침 후 시도)",
      true,
    );
    return;
  }
  const areas = getAreasByKind(normalizedKind);
  if (areas.length) {
    handleApplyAreaNames(normalizedKind);
  } else {
    syncPendingNamesWithBuildings();
    renderPendingNameEditor();
    renderBuildingTabs();
    populateBuildingSelect();
    requestRedraw();
  }
  notifyWorkContextChanged();

  if (state.loadedWorkId) {
    if (state.hasDataset && Array.isArray(state.circles) && state.circles.length) {
      const ok = await syncCurrentWorkToServer(`${label} 천공·기초 상단`);
      if (ok) return;
      setUploadStatus(
        `${label} 천공·기초 상단 값은 화면에 반영되었습니다. 서버 저장에 실패했으면 상단「수정 저장」으로 다시 저장하세요.`,
        true,
      );
      return;
    }
    setUploadStatus(
      `${label} 천공·기초 상단 값은 화면에만 반영되었습니다. DXF 좌표 작업을 불러온 뒤 이 버튼을 다시 누르거나「수정 저장」으로 파일에 남기세요.`,
      false,
    );
    return;
  }
  setUploadStatus(
    `${label} 천공·기초 상단 값을 반영했습니다. 이후「작업 저장」으로 파일에 포함하세요.`,
    false,
  );
}

function handleApplyBuildingNames() {
  handleApplyAreaNames(AREA_KIND_BUILDING);
}

function handleApplyParkingNames() {
  handleApplyAreaNames(AREA_KIND_PARKING);
}

function handleApplyTowerCraneNames() {
  handleApplyAreaNames(AREA_KIND_TOWER_CRANE);
}

function handleApplyAreaNames(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  const areas = getAreasByKind(normalizedKind);
  const names = getAreaNames(normalizedKind);
  if (!names.length) return;
  if (!areas.length) {
    syncAreaCountInputs();
    renderPendingNameEditor();
    return;
  }
  const pendingDrilling = getPendingDrillingElevationsArray(normalizedKind);
  const pendingFound = getPendingFoundationTopArray(normalizedKind);
  setAreasByKind(
    normalizedKind,
    areas.map((entry, order) => {
      const slot = isSlotAreaKind(normalizedKind) ? getAreaSlot(entry, order) : order;
      const fromBuilding = entry.building?.drilling_start_elevation;
      const fromPending = pendingDrilling[slot];
      let drilling;
      const fromBuildingDrill = parsePastedLevelToken(fromBuilding);
      const fromPendingDrill = parsePastedLevelToken(fromPending);
      if (fromBuildingDrill != null) drilling = fromBuildingDrill;
      else if (fromPendingDrill != null) drilling = fromPendingDrill;
      else drilling = undefined;
      const fromBuildingFound = entry.building?.foundation_top_elevation;
      const fromPendingFound = pendingFound[slot];
      let foundationTopElev;
      const fromBuildingTop = parsePastedLevelToken(fromBuildingFound);
      const fromPendingTop = parsePastedLevelToken(fromPendingFound);
      if (fromBuildingTop != null) foundationTopElev = fromBuildingTop;
      else if (fromPendingTop != null) foundationTopElev = fromPendingTop;
      else foundationTopElev = undefined;
      const merged = {
        ...entry.building,
        kind: normalizedKind,
        slot,
        name: names[slot] || entry.building.name || getDefaultAreaName(normalizedKind, slot),
      };
      delete merged.drilling_start_elevation;
      if (drilling !== undefined) merged.drilling_start_elevation = drilling;
      delete merged.foundation_top_elevation;
      if (foundationTopElev !== undefined) merged.foundation_top_elevation = foundationTopElev;
      return merged;
    }),
  );
  syncPendingNamesWithBuildings();
  renderBuildingTabs();
  populateBuildingSelect();
  renderPendingNameEditor();
  requestRedraw();
}

function handleBuildingCountChange() {
  handleAreaCountChange(AREA_KIND_BUILDING);
}

function handleParkingCountChange() {
  handleAreaCountChange(AREA_KIND_PARKING);
}

function handleTowerCraneCountChange() {
  handleAreaCountChange(AREA_KIND_TOWER_CRANE);
}

function handleAreaCountChange(kind) {
  const input = getAreaCountInput(kind);
  const minimum = isSlotAreaKind(kind) ? 0 : 1;
  const desired = Math.max(minimum, Number(input?.value));
  if (Number.isNaN(desired)) return;
  ensurePendingNameCount(kind, desired);
  renderPendingNameEditor();
  if (isSlotAreaKind(kind)) {
    renderBuildingTabs();
    populateBuildingSelect();
    requestRedraw();
  }
}

function ensurePendingNameCount(kind, desired) {
  const normalizedKind = normalizeAreaKind(kind);
  const minimum = isSlotAreaKind(normalizedKind) ? 0 : 1;
  const target = Math.max(minimum, desired || minimum);
  const names = [...getAreaNames(normalizedKind)];
  while (names.length < target) {
    names.push(getDefaultAreaName(normalizedKind, names.length));
  }
  if (names.length > target) {
    names.length = target;
  }
  setAreaNames(normalizedKind, names);
  if (isSlotAreaKind(normalizedKind)) {
    const nextAreas = getAreasByKind(normalizedKind)
      .filter((entry, order) => getAreaSlot(entry, order) < target)
      .map((entry) => entry.building);
    setAreasByKind(normalizedKind, nextAreas);
  }
  if (normalizedKind === AREA_KIND_BUILDING) {
    const entries = getAreasByKind(AREA_KIND_BUILDING);
    if (entries.length > target) {
      const nextAreas = entries.slice(0, target).map((entry) => entry.building);
      setAreasByKind(AREA_KIND_BUILDING, nextAreas);
      state.highlightedBuildingNameIndex = -1;
      state.selectedBuildingIndex = -1;
    }
  }
  ensurePendingDrillingElevationsLength(normalizedKind);
  if (normalizedKind === AREA_KIND_BUILDING) {
    ensureAutoBuildingOutlineFlagsLength();
  }
  syncAreaCountInputs();
}

function syncBuildingEditModeButtons() {
  const label = state.buildingEditMode ? "편집 모드 ON" : "편집 모드 OFF";
  if (toggleEditBuildingsBtn) toggleEditBuildingsBtn.textContent = label;
  if (toggleEditParkingsBtn) toggleEditParkingsBtn.textContent = label;
  if (toggleEditTowerCranesBtn) toggleEditTowerCranesBtn.textContent = label;
  if (canvasToggleEditBuildingsBtn) canvasToggleEditBuildingsBtn.textContent = label;
}

function toggleBuildingEditMode() {
  state.buildingEditMode = !state.buildingEditMode;
  if (!state.buildingEditMode && state.areaRectCreate) {
    state.areaRectCreate = null;
  }
  if (!state.buildingEditMode && state.buildingOutlinePickMode) {
    state.buildingOutlinePickMode = null;
    state.buildingOutlinePickClick = null;
  }
  syncBuildingEditModeButtons();
  updateCanvasModeHint();
  requestRedraw();
}

function canvasHintUsesTouchUi() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 767px)").matches
  );
}

function pilexyMobileCompactUi() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width: 767px)").matches
  );
}

/**
 * 캔버스 우측 편집모드/화면이동 안내 문구 갱신
 */
function updateCanvasModeHint() {
  if (!canvasModeHint) return;
  const touchUi = canvasHintUsesTouchUi();
  if (state.areaRectCreate) {
    const { order, startWorld, kind: rectKind } = state.areaRectCreate;
    const rk = normalizeAreaKind(rectKind);
    const name =
      getAreaNames(rk)[order] || getDefaultAreaName(rk, order);
    canvasModeHint.textContent = startWorld
      ? `${name} 네모 생성: 우하단 점을 클릭하세요`
      : `${name} 네모 생성: 좌상단 점을 클릭하세요`;
    return;
  }
  if (state.retainingWallPickMode) {
    const n = state.retainingWallPickMode.selectedIds?.size ?? 0;
    canvasModeHint.textContent = `흙막이 라인: 폴리라인(열림·닫힘) 클릭으로 선택·해제 (${n}개). Esc 로 종료 후 「거리 계산」을 누르세요.`;
    return;
  }
  if (state.buildingOutlinePickMode) {
    const ord = state.buildingOutlinePickMode.order;
    const nm =
      getAreaNames(AREA_KIND_BUILDING)[ord] || getDefaultAreaName(AREA_KIND_BUILDING, ord);
    const n = state.buildingOutlinePickMode.selectedIds?.size ?? 0;
    canvasModeHint.textContent = `${nm} 동 윤곽: 폴리라인을 클릭해 선택·해제 (${n}개). 설정 열 「확인」· Enter 로 완료 · Esc 취소`;
    return;
  }
  if (state.buildingEditMode) {
    canvasModeHint.textContent = touchUi
      ? ""
      : "편집모드 작동중\n\n화면 이동: 휠 가운데 버튼\n(휠 가운데 버튼으로 이동)";
  } else {
    canvasModeHint.textContent = touchUi ? "" : "화면 이동: 좌측 마우스 클릭·드래그";
  }
}

function getBuildingOutlinePolylineSourceList() {
  const raw = Array.isArray(state.rawPolylines) && state.rawPolylines.length ? state.rawPolylines : [];
  const fallback = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
  const source = raw.length ? raw : fallback;
  return source.map((polyline, index) => {
    const points = (Array.isArray(polyline?.points) ? polyline.points : [])
      .filter((pt) => Number.isFinite(Number(pt?.x)) && Number.isFinite(Number(pt?.y)))
      .map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }));
    const id = String(polyline?.id ?? polyline?.cluster_id ?? `polyline-${index}`);
    return { id, points, closed: polyline?.closed !== false };
  });
}

function isPolylineClosedRough(points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const d = Math.hypot(first.x - last.x, first.y - last.y);
  if (d < 1e-6) return true;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs) || 0,
    Math.max(...ys) - Math.min(...ys) || 0,
    1,
  );
  return d <= span * 0.02;
}

function convexHull2d(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const uniq = [];
  const seen = new Set();
  points.forEach((p) => {
    const k = `${p.x.toFixed(8)}\u0001${p.y.toFixed(8)}`;
    if (seen.has(k)) return;
    seen.add(k);
    uniq.push({ x: p.x, y: p.y });
  });
  if (uniq.length <= 2) return uniq;
  const pts = [...uniq].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function buildBuildingOutlineVerticesFromSelection(selectedIds) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (!ids.size) return null;
  const list = getBuildingOutlinePolylineSourceList().filter((row) => ids.has(row.id));
  if (!list.length) return null;
  if (list.length === 1 && list[0].points.length >= 3) {
    const pts = list[0].points;
    if (list[0].closed !== false || isPolylineClosedRough(pts)) {
      const out = pts.map((p) => ({ x: p.x, y: p.y }));
      if (isPolylineClosedRough(out)) out.pop();
      return out.length >= 3 ? out : null;
    }
  }
  const all = [];
  list.forEach((row) => {
    row.points.forEach((p) => all.push(p));
    for (let i = 0; i < row.points.length - 1; i++) {
      const a = row.points[i];
      const b = row.points[i + 1];
      const steps = Math.min(12, Math.max(3, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 800)));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        all.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  });
  const hull = convexHull2d(all);
  return hull.length >= 3 ? hull : null;
}

function pickBuildingOutlinePolylineIdAtCanvas(canvasX, canvasY) {
  const world = canvasToWorld(canvasX, canvasY);
  const tol = Math.max(6 / view.scale, 0.05);
  let bestId = null;
  let bestD = Infinity;
  getBuildingOutlinePolylineSourceList().forEach((row) => {
    if (row.points.length < 2) return;
    for (let i = 0; i < row.points.length - 1; i++) {
      const d = pointToSegmentDistance(world, row.points[i], row.points[i + 1]);
      if (d < bestD && d <= tol) {
        bestD = d;
        bestId = row.id;
      }
    }
    if (row.points.length >= 3) {
      const a = row.points[row.points.length - 1];
      const b = row.points[0];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) {
        const d = pointToSegmentDistance(world, a, b);
        if (d < bestD && d <= tol) {
          bestD = d;
          bestId = row.id;
        }
      }
    }
  });
  return bestId;
}

/** 텍스트 높이·원 직경으로 m 도면 vs mm 도면 추정(기초 탭 P/F 로직과 유사) */
function getDrawingLikelyMeters() {
  const texts = state.texts || [];
  const hs = texts.map((t) => Number(t.height)).filter((h) => Number.isFinite(h) && h > 0);
  if (hs.length) {
    hs.sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)];
    if (med < 45) return true;
    if (med >= 200) return false;
  }
  const circ = state.circles || [];
  const ds = circ.map((c) => Number(c.diameter)).filter((x) => Number.isFinite(x) && x > 0);
  if (ds.length) {
    ds.sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)];
    if (med < 2.5) return true;
    if (med > 80) return false;
  }
  return true;
}

/** 도면 1 단위를 실제 m로 환산(추정 단위 기준) */
function worldDistanceToPhysicalMeters(worldDist) {
  if (!Number.isFinite(worldDist)) return NaN;
  return getDrawingLikelyMeters() ? worldDist : worldDist * 0.001;
}

function physicalMeterThresholds() {
  const m = getDrawingLikelyMeters();
  return { world1: m ? 1 : 1000, world2: m ? 2 : 2000, unitLabel: m ? "m(도면)" : "mm(도면)" };
}

/** 흙막이 거리·선택용: raw 우선, 없으면 cluster. 열림·닫힘(또는 좌표상 닫힌 형태) 모두 포함. */
function getRetainingWallPolylineRows() {
  const raw = Array.isArray(state.rawPolylines) && state.rawPolylines.length ? state.rawPolylines : [];
  const cluster = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
  const source = raw.length ? raw : cluster;
  const fromCluster = !raw.length;
  return source
    .map((polyline, index) => {
      const points = (Array.isArray(polyline?.points) ? polyline.points : [])
        .filter((pt) => Number.isFinite(Number(pt?.x)) && Number.isFinite(Number(pt?.y)))
        .map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }));
      if (points.length < 2) return null;
      const id = String(
        polyline?.id ??
          polyline?.cluster_id ??
          (fromCluster ? `cluster-open-${index}` : `polyline-${index}`),
      );
      const explicitClosed = polyline?.closed !== false;
      const closed = explicitClosed || isPolylineClosedRough(points);
      return { id, points, closed };
    })
    .filter(Boolean);
}

function pickRetainingWallPolylineIdAtCanvas(canvasX, canvasY) {
  const world = canvasToWorld(canvasX, canvasY);
  const tol = Math.max(6 / view.scale, 0.05);
  let bestId = null;
  let bestD = Infinity;
  getRetainingWallPolylineRows().forEach((row) => {
    if (row.points.length < 2) return;
    for (let i = 0; i < row.points.length - 1; i += 1) {
      const d = pointToSegmentDistance(world, row.points[i], row.points[i + 1]);
      if (d < bestD && d <= tol) {
        bestD = d;
        bestId = row.id;
      }
    }
    if (row.closed && row.points.length >= 3) {
      const a = row.points[row.points.length - 1];
      const b = row.points[0];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) {
        const d = pointToSegmentDistance(world, a, b);
        if (d < bestD && d <= tol) {
          bestD = d;
          bestId = row.id;
        }
      }
    }
  });
  return bestId;
}

function cancelRetainingWallPickMode() {
  state.retainingWallPickMode = null;
  state.retainingWallPickClick = null;
}

function beginRetainingWallLinePick() {
  if (state.buildingOutlinePickMode) {
    setUploadStatus("동 윤곽 폴리라인 선택을 먼저 완료하거나 Esc로 취소하세요.", true);
    return;
  }
  if (!state.hasDataset) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  if (!getRetainingWallPolylineRows().length) {
    setUploadStatus("선택할 폴리라인(LWPOLYLINE 등)이 없습니다.", true);
    return;
  }
  state.retainingWallPickMode = { selectedIds: new Set() };
  state.retainingWallPickClick = null;
  updateCanvasModeHint();
  setUploadStatus("흙막이 기준 폴리라인(열림·닫힘)을 클릭해 선택합니다. 여러 개 선택 가능. Esc 로 종료.");
  requestRedraw();
}

function getRetainingWallDistanceMode() {
  const el = document.querySelector('input[name="retaining-wall-dist-mode"]:checked');
  return el?.value === "edge" ? "edge" : "center";
}

function clearRetainingWallViz() {
  state.retainingWallVizAllEnabled = false;
  const vizAll = document.getElementById("retaining-wall-viz-all");
  if (vizAll) vizAll.checked = false;
}

function isRetainingWallVizHighlightCircle(circleId) {
  if (!state.retainingWallVizAllEnabled) return false;
  return (state.retainingWallComputedRows || []).some((r) => r.circleId === circleId);
}

function focusRetainingWallResultRow(row) {
  if (!row || !Number.isFinite(row.x) || !Number.isFinite(row.y)) return;
  const r = Number(row.radiusWorld) || 0;
  const qx = row.qx;
  const qy = row.qy;
  if (!Number.isFinite(qx) || !Number.isFinite(qy)) return;
  const wdist = Number(row.worldDist);
  const pad = Math.max(r * 1.8, Number.isFinite(wdist) ? wdist * 3.5 : 0, 1.5);
  const dq = Math.hypot(row.x - qx, row.y - qy);
  const half = Math.max(dq / 2 + r + pad, r * 3.5, 2.5);
  const cx = (row.x + qx) / 2;
  const cy = (row.y + qy) / 2;
  fitViewToBounds({
    minX: cx - half,
    maxX: cx + half,
    minY: cy - half,
    maxY: cy + half,
  });
  requestRedraw();
}

function handleRetainingWallResultsClick(e) {
  const tr = e.target.closest("tr.retaining-wall-data-row");
  if (!tr) return;
  const idx = Number(tr.dataset.rwIndex);
  const row = state.retainingWallComputedRows?.[idx];
  if (!row) return;
  focusRetainingWallResultRow(row);
}

function renderRetainingWallResultsTable() {
  const resultsEl = document.getElementById("retaining-wall-results");
  const statusEl = document.getElementById("retaining-wall-status");
  const rows = state.retainingWallComputedRows || [];
  const ctxInfo = state.retainingWallResultsContext;
  const unitLabel = ctxInfo?.unitLabel ?? "m(도면)";
  const mode = getRetainingWallDistanceMode();
  const physKey = mode === "edge" ? "physEdgeM" : "physM";
  const sorted = [...rows].sort((a, b) => a[physKey] - b[physKey]);
  const within1 = sorted.filter((r) => r[physKey] <= 1 + 1e-9);
  const within2only = sorted.filter((r) => r[physKey] > 1 + 1e-9 && r[physKey] <= 2 + 1e-9);
  const modeNote =
    mode === "edge"
      ? "1m/2m 구간·정렬: 원 외곽(중심 거리 − 반지름) 기준. 중심·외곽 열은 모두 표시됩니다."
      : "1m/2m 구간·정렬: 파일 중심～선분 최단거리 기준.";
  const fmt = (r) => {
    const i = r.rowIndex;
    return `<tr class="retaining-wall-data-row" data-rw-index="${i}" title="행 클릭: 캔버스를 이 파일 근처로 이동">
      <td>${escapeHtml(String(r.label))}</td>
      <td>${r.x.toFixed(3)}</td>
      <td>${r.y.toFixed(3)}</td>
      <td>${r.physM.toFixed(3)}</td>
      <td>${r.physEdgeM.toFixed(3)}</td>
      <td>${escapeHtml(String(r.polyId))}</td>
      <td>${r.segIndex}</td>
    </tr>`;
  };
  if (resultsEl) {
    resultsEl.innerHTML = `
      <p class="retaining-wall-unit-note">중심 거리: 중심에서 폴리 세그먼트까지 최단거리. 외곽 거리: max(0, 중심거리−반지름)을 실측 ${unitLabel}로 환산 · ${modeNote}</p>
      <h4 class="retaining-wall-subh">1m 이내 (${within1.length}건)</h4>
      <table class="retaining-wall-table">
        <thead><tr><th>파일/라벨</th><th>X</th><th>Y</th><th>중심(m)</th><th>외곽(m)</th><th>폴리 ID</th><th>세그</th></tr></thead>
        <tbody>${
          within1.length ? within1.map(fmt).join("") : '<tr><td colspan="7" class="empty-row">없음</td></tr>'
        }</tbody>
      </table>
      <h4 class="retaining-wall-subh">1m 초과 ~ 2m 이내 (${within2only.length}건)</h4>
      <table class="retaining-wall-table">
        <thead><tr><th>파일/라벨</th><th>X</th><th>Y</th><th>중심(m)</th><th>외곽(m)</th><th>폴리 ID</th><th>세그</th></tr></thead>
        <tbody>${
          within2only.length ? within2only.map(fmt).join("") : '<tr><td colspan="7" class="empty-row">없음</td></tr>'
        }</tbody>
      </table>
    `;
  }
  if (statusEl) {
    const prefix = state.retainingWallStatusPrefix || "";
    statusEl.textContent = `${prefix}${prefix ? " · " : ""}1m 이내 ${within1.length}건 · 1~2m ${within2only.length}건`;
  }
}

/** 흙막이 거리 시각화: 측정선 위 m 단위 라벨(배경 포함) */
function drawRetainingWallDistanceLabel(canvasX, canvasY, physM, physEdgeM, p0, p1) {
  const line1 = `중심 ${Number(physM).toFixed(3)} m`;
  const line2 = `외곽 ${Number(physEdgeM).toFixed(3)} m`;
  const lines = [line1, line2];
  const pad = 4;
  const lineHeight = 13;
  const font = "11px 'Malgun Gothic','Segoe UI',sans-serif";
  ctx.save();
  ctx.font = font;
  let maxW = 0;
  lines.forEach((ln) => {
    maxW = Math.max(maxW, ctx.measureText(ln).width);
  });
  const w = maxW + pad * 2;
  const h = lines.length * lineHeight + pad * 2;
  let ox = 0;
  let oy = 0;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const nlen = Math.hypot(dx, dy);
  if (nlen > 1e-3) {
    const nx = (-dy / nlen) * 16;
    const ny = (dx / nlen) * 16;
    ox = nx;
    oy = ny;
  }
  const cx = canvasX + ox;
  const cy = canvasY + oy;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.strokeStyle = "rgba(45, 212, 191, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x0, y0, w, h, 5);
  } else {
    ctx.rect(x0, y0, w, h);
  }
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((ln, i) => {
    ctx.fillStyle = i === 0 ? "#f8fafc" : "rgba(226, 232, 240, 0.92)";
    ctx.fillText(ln, cx, y0 + pad + lineHeight * (i + 0.5));
  });
  ctx.restore();
}

function drawRetainingWallVizLinks() {
  if (!state.retainingWallVizAllEnabled) return;
  const rows = state.retainingWallComputedRows || [];
  if (!rows.length) return;
  const mode = getRetainingWallDistanceMode();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  rows.forEach((row) => {
    if (!row || !Number.isFinite(row.qx)) return;
    const px = row.x;
    const py = row.y;
    const qx = row.qx;
    const qy = row.qy;
    const r = Number(row.radiusWorld) || 0;
    const dx = qx - px;
    const dy = qy - py;
    const len = Math.hypot(dx, dy);
    let x0 = px;
    let y0 = py;
    if (mode === "edge" && len > 1e-9 && r > 1e-9) {
      x0 = px + (dx / len) * r;
      y0 = py + (dy / len) * r;
    }
    const p0 = worldToCanvas(x0, y0);
    const p1 = worldToCanvas(qx, qy);
    if (Number.isFinite(row.ax) && Number.isFinite(row.ay) && Number.isFinite(row.bx) && Number.isFinite(row.by)) {
      const sa = worldToCanvas(row.ax, row.ay);
      const sb = worldToCanvas(row.bx, row.by);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.88)";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "rgba(45, 212, 191, 0.95)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(45, 212, 191, 0.98)";
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const mcx = (p0.x + p1.x) / 2;
    const mcy = (p0.y + p1.y) / 2;
    drawRetainingWallDistanceLabel(mcx, mcy, row.physM, row.physEdgeM, p0, p1);
  });
  ctx.restore();
}

function computeRetainingWallDistancesForPiles() {
  const statusEl = document.getElementById("retaining-wall-status");
  const resultsEl = document.getElementById("retaining-wall-results");
  clearRetainingWallViz();
  const rows = getRetainingWallPolylineRows();
  if (!rows.length) {
    state.retainingWallComputedRows = [];
    state.retainingWallResultsContext = null;
    state.retainingWallStatusPrefix = "";
    if (statusEl) statusEl.textContent = "폴리라인이 없습니다.";
    if (resultsEl) resultsEl.innerHTML = "";
    return;
  }
  const mode = state.retainingWallPickMode;
  const selected = mode?.selectedIds instanceof Set ? mode.selectedIds : null;
  let useRows = rows;
  let prefix = "";
  if (selected && selected.size) {
    const filtered = rows.filter((r) => selected.has(r.id));
    if (filtered.length) {
      useRows = filtered;
      prefix = `선택 ${selected.size}개 중 ${filtered.length}개 라인을 사용합니다.`;
    } else {
      prefix = "선택과 일치하는 폴리선이 없어 전체 폴리선을 사용합니다.";
    }
  } else {
    prefix = "선택 없음: 모든 폴리선을 기준으로 계산합니다.";
  }
  state.retainingWallStatusPrefix = prefix;
  const segments = [];
  useRows.forEach((row) => {
    const n = row.points.length;
    for (let i = 0; i < n - 1; i += 1) {
      const a = row.points[i];
      const b = row.points[i + 1];
      segments.push({ polyId: row.id, segIndex: i, ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
    if (row.closed && n >= 3) {
      const a = row.points[n - 1];
      const b = row.points[0];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) {
        segments.push({ polyId: row.id, segIndex: n - 1, ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
    }
  });
  if (!segments.length) {
    state.retainingWallComputedRows = [];
    state.retainingWallResultsContext = null;
    if (statusEl) statusEl.textContent = `${prefix} · 선분이 없습니다.`;
    if (resultsEl) resultsEl.innerHTML = "";
    return;
  }
  const { world1, world2, unitLabel } = physicalMeterThresholds();
  state.retainingWallResultsContext = { unitLabel, world1, world2 };
  const circles = getVisibleCircles();
  const out = [];
  circles.forEach((c) => {
    const px = Number(c.center_x);
    const py = Number(c.center_y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const radiusWorld = Number(c.radius ?? (Number(c.diameter) / 2)) || 0;
    let bestW = Infinity;
    let bestSeg = null;
    segments.forEach((seg) => {
      const d = pointToSegmentDistance(
        { x: px, y: py },
        { x: seg.ax, y: seg.ay },
        { x: seg.bx, y: seg.by },
      );
      if (d < bestW) {
        bestW = d;
        bestSeg = seg;
      }
    });
    if (!bestSeg || !Number.isFinite(bestW)) return;
    const physM = worldDistanceToPhysicalMeters(bestW);
    if (!Number.isFinite(physM) || physM > worldDistanceToPhysicalMeters(world2) + 1e-9) return;
    const q = closestPointOnSegment(
      { x: px, y: py },
      { x: bestSeg.ax, y: bestSeg.ay },
      { x: bestSeg.bx, y: bestSeg.by },
    );
    const worldEdgeDist = Math.max(0, bestW - radiusWorld);
    const physEdgeM = worldDistanceToPhysicalMeters(worldEdgeDist);
    const label =
      (c.matched_text && String(c.matched_text.text)) || String(c.id || "").slice(0, 12);
    out.push({
      circleId: c.id,
      label,
      x: px,
      y: py,
      radiusWorld,
      worldDist: bestW,
      physM,
      physEdgeM,
      polyId: bestSeg.polyId,
      segIndex: bestSeg.segIndex,
      ax: bestSeg.ax,
      ay: bestSeg.ay,
      bx: bestSeg.bx,
      by: bestSeg.by,
      qx: q.x,
      qy: q.y,
    });
  });
  out.forEach((row, i) => {
    row.rowIndex = i;
  });
  state.retainingWallComputedRows = out;
  renderRetainingWallResultsTable();
  requestRedraw();
}

function beginBuildingOutlinePolylinePick(order) {
  if (state.retainingWallPickMode) {
    setUploadStatus("흙막이 라인 선택을 먼저 Esc로 종료하세요.", true);
    return;
  }
  if (!state.hasDataset) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  state.buildingOutlinePickMode = {
    order,
    selectedIds: new Set(),
  };
  state.buildingOutlinePickClick = null;
  state.buildingEditMode = true;
  syncBuildingEditModeButtons();
  updateCanvasModeHint();
  setUploadStatus("동 윤곽: 도면 폴리라인을 클릭해 선택·해제합니다. 같은 행 설정의 「확인」 또는 Enter로 완료, Esc로 취소합니다.");
  renderPendingNameEditor();
  requestRedraw();
}

function cancelBuildingOutlinePolylinePick() {
  state.buildingOutlinePickMode = null;
  state.buildingOutlinePickClick = null;
  updateCanvasModeHint();
  setUploadStatus("동 윤곽 선택을 취소했습니다.");
  renderPendingNameEditor();
  requestRedraw();
}

function confirmBuildingOutlinePolylinePick() {
  const mode = state.buildingOutlinePickMode;
  if (!mode) return;
  const vertices = buildBuildingOutlineVerticesFromSelection(mode.selectedIds);
  if (!vertices || vertices.length < 3) {
    setUploadStatus("폴리라인을 하나 이상 선택한 뒤 확정하세요.", true);
    return;
  }
  const order = mode.order;
  state.buildingOutlinePickMode = null;
  state.buildingOutlinePickClick = null;
  upsertAreaPolygonByOrder(AREA_KIND_BUILDING, order, vertices);
  updateCanvasModeHint();
  const name =
    getAreaNames(AREA_KIND_BUILDING)[order] || getDefaultAreaName(AREA_KIND_BUILDING, order);
  setUploadStatus(`${name} 동 윤곽선을 생성했습니다. 편집 모드에서 절점을 조정할 수 있습니다.`);
  renderPendingNameEditor();
  requestRedraw();
}

/**
 * 동 개수만큼 클러스터 재계산 후 폴리라인 → 동(건물) 정의로 변환하여 상태만 갱신.
 * @param {number} count - 동 개수
 * @param {boolean} showStatus - 진행 메시지 표시 여부
 * @returns {{ success: boolean, generated: Array } | null}
 */
async function applyBuildingCountFromClusters(count, showStatus = true) {
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return null;
  }
  const desired = Math.max(1, Math.round(count || getConfiguredAreaCount(AREA_KIND_BUILDING)));

  if (showStatus) {
    setPhase("matching", 10);
    setUploadStatus("클러스터 재계산 중...");
  }
  const refreshed = await refreshClustersForCount(desired, showStatus, false);
  if (!refreshed) return null;

  ensurePendingNameCount(AREA_KIND_BUILDING, desired);
  renderPendingNameEditor();
  ensureAutoBuildingOutlineFlagsLength();

  const names = getAreaNames(AREA_KIND_BUILDING).slice(0, desired);
  const anyAuto = names.some((_, i) => isAutoBuildingOutlineAtOrder(i));

  if (!anyAuto) {
    if (showStatus) {
      setPhase("matching", 60);
      setUploadStatus("동 목록만 반영했습니다. 자동생성을 켠 동은 없습니다. 나머지는 「생성」으로 윤곽을 지정하세요.");
    }
    syncPendingNamesWithBuildings();
    syncAreaCountInputs();
    populateBuildingSelect();
    renderBuildingTabs();
    renderPendingNameEditor();
    requestRedraw();
    return { success: true, generated: getAreasByKind(AREA_KIND_BUILDING).map((e) => e.building) };
  }

  if (showStatus) {
    setPhase("matching", 60);
    setUploadStatus("폴리라인으로 동 생성 중...");
  }

  const availablePolylines = state.clusterPolylines || [];
  const closedPolylines = availablePolylines.filter(
    (polyline) =>
      polyline.closed !== false &&
      Array.isArray(polyline.points) &&
      polyline.points.length >= 3,
  );

  const existingAreas = getAreasByKind(AREA_KIND_BUILDING);
  const generated = names.map((name, index) => {
    if (!isAutoBuildingOutlineAtOrder(index)) {
      const ex = existingAreas[index];
      if (ex?.building?.vertices?.length >= 3) {
        return {
          ...ex.building,
          kind: AREA_KIND_BUILDING,
          name: name || getDefaultAreaName(AREA_KIND_BUILDING, index),
        };
      }
      return {
        kind: AREA_KIND_BUILDING,
        name: name || getDefaultAreaName(AREA_KIND_BUILDING, index),
        vertices: [],
      };
    }
    const source = index < closedPolylines.length ? closedPolylines[index] : null;
    const vertices =
      source && Array.isArray(source.points) && source.points.length >= 3
        ? source.points.map((point) => ({ x: point.x, y: point.y }))
        : createDefaultBuildingPolygon(index, desired);
    return {
      kind: AREA_KIND_BUILDING,
      name: name || getDefaultAreaName(AREA_KIND_BUILDING, index),
      vertices,
    };
  });

  setAreasByKind(AREA_KIND_BUILDING, generated);
  syncPendingNamesWithBuildings();
  syncAreaCountInputs();
  populateBuildingSelect();
  renderBuildingTabs();
  renderPendingNameEditor();
  requestRedraw();
  return { success: true, generated };
}

/** 동 개수 적용: 동 개수 밑 버튼 — 클러스터 기반으로 동만 생성(백엔드 적용 없음) */
async function handleApplyBuildingCount() {
  if (applyBuildingCountBtn && applyBuildingCountBtn.disabled) return;
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  if (applyBuildingCountBtn) {
    applyBuildingCountBtn.disabled = true;
    applyBuildingCountBtn.textContent = "적용 중...";
  }
  try {
    const count = getConfiguredAreaCount(AREA_KIND_BUILDING);
    const result = await applyBuildingCountFromClusters(count, true);
    if (result) {
      setPhase("ready", 100);
      if (hasAnyAutoBuildingOutlineFromClusters()) {
        setUploadStatus(`동 ${result.generated.length}개 반영했습니다. (자동생성 켠 동은 클러스터 윤곽 적용)`);
      } else {
        setUploadStatus("동 개수·이름 목록을 반영했습니다. 자동생성을 켠 동이 없으면 「생성」으로 윤곽을 지정하세요.");
      }
      setTimeout(() => setPhase("idle"), 600);
    }
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (applyBuildingCountBtn) {
      applyBuildingCountBtn.disabled = false;
      applyBuildingCountBtn.textContent = "동 개수 적용";
    }
  }
}

/** 동 윤곽선 생성: 편집모드 OFF 옆 버튼 — 클러스터 폴리라인으로 동 윤곽선만 생성 */
async function handleApplyParkingCount() {
  if (applyParkingCountBtn && applyParkingCountBtn.disabled) return;
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  if (applyParkingCountBtn) {
    applyParkingCountBtn.disabled = true;
    applyParkingCountBtn.textContent = "적용 중...";
  }
  try {
    const count = getConfiguredAreaCount(AREA_KIND_PARKING);
    ensurePendingNameCount(AREA_KIND_PARKING, count);
    renderPendingNameEditor();
    renderBuildingTabs();
    populateBuildingSelect();
    requestRedraw();
    setPhase("ready", 100);
    setUploadStatus(`지하주차장 목록 ${count}개를 준비했습니다. 각 행의 네모 생성으로 위치를 직접 지정하세요.`);
    setTimeout(() => setPhase("idle"), 600);
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (applyParkingCountBtn) {
      applyParkingCountBtn.disabled = false;
      applyParkingCountBtn.textContent = "지하주차장 개수 적용";
    }
  }
}

async function handleApplyTowerCraneCount() {
  if (applyTowerCraneCountBtn && applyTowerCraneCountBtn.disabled) return;
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  if (applyTowerCraneCountBtn) {
    applyTowerCraneCountBtn.disabled = true;
    applyTowerCraneCountBtn.textContent = "적용 중...";
  }
  try {
    const count = getConfiguredAreaCount(AREA_KIND_TOWER_CRANE);
    ensurePendingNameCount(AREA_KIND_TOWER_CRANE, count);
    renderPendingNameEditor();
    renderBuildingTabs();
    populateBuildingSelect();
    requestRedraw();
    setPhase("ready", 100);
    setUploadStatus(`타워크레인 목록 ${count}개를 준비했습니다. 각 행의 네모 생성으로 위치를 직접 지정하세요.`);
    setTimeout(() => setPhase("idle"), 600);
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (applyTowerCraneCountBtn) {
      applyTowerCraneCountBtn.disabled = false;
      applyTowerCraneCountBtn.textContent = "타워크레인 개수 적용";
    }
  }
}

async function handleGenerateBuildingOutlines() {
  if (generateBuildingOutlinesBtn && generateBuildingOutlinesBtn.disabled) return;
  if (!hasAnyAutoBuildingOutlineFromClusters()) {
    setUploadStatus("동 행에서 자동생성을 하나 이상 켜거나, 각 동 「생성」으로 폴리라인을 지정하세요.", true);
    return;
  }
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  if (generateBuildingOutlinesBtn) {
    generateBuildingOutlinesBtn.disabled = true;
    generateBuildingOutlinesBtn.textContent = "생성 중...";
  }
  try {
    const count = getConfiguredAreaCount(AREA_KIND_BUILDING);
    const result = await applyBuildingCountFromClusters(count, true);
    if (result) {
      setPhase("ready", 100);
      setUploadStatus(`동 윤곽선 ${result.generated.length}개 생성되었습니다.`);
      setTimeout(() => setPhase("idle"), 600);
    }
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (generateBuildingOutlinesBtn) {
      generateBuildingOutlinesBtn.disabled = false;
      generateBuildingOutlinesBtn.textContent = "동 윤곽선 생성";
    }
  }
}

/**
 * 동 자동생성: 개수 적용 + 동 정보 API 적용까지 한 번에 수행
 */
async function handleGenerateBuildings() {
  if (generateBuildingsBtn.disabled) return;
  if (!hasAnyAutoBuildingOutlineFromClusters()) {
    setUploadStatus("동 행에서 자동생성을 켜거나 각 동 윤곽을 만든 뒤 「동 정보 적용」을 사용하세요.", true);
    return;
  }
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }

  generateBuildingsBtn.disabled = true;
  const originalText = generateBuildingsBtn.textContent;
  generateBuildingsBtn.textContent = "Generating...";
  setPhase("matching", 10);
  setUploadStatus("동 자동 생성 중...");

  try {
    const count = getConfiguredAreaCount(AREA_KIND_BUILDING);
    const result = await applyBuildingCountFromClusters(count, true);
    if (!result) {
      throw new Error("Failed to refresh clusters for buildings.");
    }
    const { generated } = result;

    setPhase("matching", 80);
    setUploadStatus("동 정보 적용 중...");
    try {
      const parkingAreas = getAreasByKind(AREA_KIND_PARKING).map((entry) => entry.building);
      const towerAreas = getAreasByKind(AREA_KIND_TOWER_CRANE).map((entry) => entry.building);
      const applyPayload = {
        buildings: serializeBuildingDefinitions([...generated, ...parkingAreas, ...towerAreas]),
      };
      const applyResponse = await fetch(`${API_BASE_URL}/api/assign-buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyPayload),
      });

      if (applyResponse.ok) {
        const applyData = await applyResponse.json();
        handlePayload(applyData);
        if (applyData.buildings && Array.isArray(applyData.buildings) && applyData.buildings.length > 0) {
          state.buildings = normalizeAreaDefinitions(applyData.buildings);
          syncPendingNamesWithBuildings();
          renderBuildingTabs();
          populateBuildingSelect();
        }
        updateCircleTable();
        requestRedraw();
        setPhase("ready", 100);
        setUploadStatus(`동 ${generated.length}개 자동 생성 및 적용 완료.`);
      } else {
        const errorText = await applyResponse.text();
        console.warn("Building apply failed:", errorText);
        setPhase("ready", 100);
        setUploadStatus(`동 ${generated.length}개 생성됨. (적용 실패: ${errorText})`);
      }
    } catch (applyError) {
      console.warn("Automatic building apply failed:", applyError);
      setPhase("ready", 100);
      setUploadStatus(`동 ${generated.length}개 생성됨. (적용 실패: ${applyError.message})`);
    }
    setTimeout(() => setPhase("idle"), 600);
    requestRedraw();
  } catch (error) {
    console.error(error);
    setPhase("error");
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    generateBuildingsBtn.disabled = false;
    generateBuildingsBtn.textContent = originalText;
  }
}

async function handleApplyBuildings() {
  await applyAreaDefinitions(AREA_KIND_BUILDING);
}

async function handleApplyParkings() {
  await applyAreaDefinitions(AREA_KIND_PARKING);
}

async function handleApplyTowerCranes() {
  await applyAreaDefinitions(AREA_KIND_TOWER_CRANE);
}

async function applyAreaDefinitions(kind) {
  const normalizedKind = normalizeAreaKind(kind);
  // 입력란 포커스가 남아 change 이벤트가 누락되는 모바일 케이스를 방지한다.
  flushDrillingInputsFromDom(normalizedKind);
  flushFoundationTopInputsFromDom(normalizedKind);
  if (normalizedKind === AREA_KIND_BUILDING) {
    ensureBuildingsInitialized();
  }

  const label =
    normalizedKind === AREA_KIND_PARKING
      ? "지하주차장"
      : normalizedKind === AREA_KIND_TOWER_CRANE
        ? "타워크레인"
        : "동";
  const button =
    normalizedKind === AREA_KIND_PARKING
      ? applyParkingsBtn
      : normalizedKind === AREA_KIND_TOWER_CRANE
        ? applyTowerCranesBtn
        : applyBuildingsBtn;
  const serializedBuildings = serializeBuildingDefinitions(state.buildings);
  const targetAreas = serializedBuildings.filter((area) => normalizeAreaKind(area.kind) === normalizedKind);
  if (!targetAreas.length) {
    const message =
      normalizedKind === AREA_KIND_PARKING
        ? "지하주차장 폴리라인을 먼저 생성하세요."
        : normalizedKind === AREA_KIND_TOWER_CRANE
          ? "타워크레인 폴리라인을 먼저 생성하세요."
          : "적용할 동 정의가 없습니다.";
    setUploadStatus(message, true);
    return;
  }
  if (!state.circles || state.circles.length === 0) {
    setUploadStatus(`${label} 정보를 적용하려면 먼저 DXF를 업로드하거나 작업(불러오기)을 불러오세요.`, true);
    return;
  }

  const payload = {
    buildings: serializedBuildings,
    circles: state.circles && state.circles.length ? state.circles : undefined,
    texts: state.texts && state.texts.length ? state.texts : undefined,
    polylines:
      state.rawPolylines && state.rawPolylines.length ? state.rawPolylines : undefined,
    manual_overrides: computeManualOverridesForSave(),
  };

  if (button) button.disabled = true;
  try {
    setUploadStatus(`${label} 정보 적용 중...`);
    const response = await fetch(`${API_BASE_URL}/api/assign-buildings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();

    if (!data.circles || !Array.isArray(data.circles) || data.circles.length === 0) {
      if (data.buildings && Array.isArray(data.buildings)) {
        state.buildings = normalizeAreaDefinitions(data.buildings);
        syncPendingNamesWithBuildings();
        renderBuildingTabs();
        populateBuildingSelect();
      }
      setUploadStatus(`${label} 정보가 적용되었지만 Circle 데이터를 업데이트할 수 없습니다.`, true);
      return;
    }

    handlePayload(data);
    const successMessage = `${label} 정보를 적용했습니다. (${data.circles.length}개 Circle)`;
    const synced = await syncCurrentWorkToServer(successMessage);
    if (!synced) {
      setUploadStatus(`${successMessage} (서버 동기화 실패 — 연결을 확인하세요)`, true);
    }
  } catch (error) {
    console.error(error);
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (button) button.disabled = false;
  }
}
function setHighlightedCircles(circleIds = [], focus = false) {
  state.highlightedCircleIds = new Set(circleIds.filter((id) => state.circleMap.has(id)));
  if (focus && state.highlightedCircleIds.size) {
    focusOnCircles([...state.highlightedCircleIds]);
  }
  requestRedraw();
}

function focusOnCircles(circleIds) {
  const targets = circleIds
    .map((id) => state.circleMap.get(id))
    .filter((circle) => circle);
  if (!targets.length) return;
  fitViewToData(targets);
}

/** 텍스트 기준점을 화면 중앙에 두고 적절히 확대 (텍스트 미매칭 등 circle_ids 없는 에러용) */
function focusOnText(textId) {
  const text = textId ? state.textMap.get(textId) : null;
  if (!text) return;
  const cx = text.text_center_x ?? text.center_x;
  const cy = text.text_center_y ?? text.center_y;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
  const h = Number(text.height);
  const half = Math.max(Number.isFinite(h) && h > 0 ? h * 2.5 : 0, 3);
  fitViewToBounds({
    minX: cx - half,
    maxX: cx + half,
    minY: cy - half,
    maxY: cy + half,
  });
  requestRedraw();
}

/** 기초 패널: 근접한 서로 다른 P/F 표기 쌍으로 뷰 이동·텍스트 강조 */
function focusPfLabelMismatchPair(ax, ay, bx, by, textIdA, textIdB) {
  const aX = Number(ax);
  const aY = Number(ay);
  const bX = Number(bx);
  const bY = Number(by);
  if (![aX, aY, bX, bY].every((v) => Number.isFinite(v))) return;
  const sep = Math.hypot(bX - aX, bY - aY);
  const pad = Math.max(2, sep * 0.35, 5);
  fitViewToBounds({
    minX: Math.min(aX, bX) - pad,
    maxX: Math.max(aX, bX) + pad,
    minY: Math.min(aY, bY) - pad,
    maxY: Math.max(aY, bY) + pad,
  });
  state.highlightedTextIds = new Set([String(textIdA || ""), String(textIdB || "")].filter((id) => id.length));
  requestRedraw();
}

function computeBounds(targets = null) {
  const circles = targets || state.circles;
  if (!circles.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  circles.forEach((circle) => {
    minX = Math.min(minX, circle.center_x - circle.radius);
    maxX = Math.max(maxX, circle.center_x + circle.radius);
    minY = Math.min(minY, circle.center_y - circle.radius);
    maxY = Math.max(maxY, circle.center_y + circle.radius);
  });
  return { minX, maxX, minY, maxY };
}

function fitViewToData(targets = null) {
  const bounds = computeBounds(targets);
  if (!bounds) return;
  fitViewToBounds(bounds);
}

function computeBoundsFromVertices(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  vertices.forEach((v) => {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  });
  return { minX, maxX, minY, maxY };
}

function fitViewToBounds(bounds) {
  if (!bounds) return;
  const padding = 40;
  const { width, height } = getCanvasSize();
  const innerWidth = Math.max(10, width - padding * 2);
  const innerHeight = Math.max(10, height - padding * 2);
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  const scaleX = innerWidth / spanX;
  const scaleY = innerHeight / spanY;
  let nextScale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(nextScale) || nextScale <= 0) nextScale = VIEW_SCALE_MIN;
  view.scale = Math.max(VIEW_SCALE_MIN, Math.min(VIEW_SCALE_MAX, nextScale));
  view.offsetX = (bounds.minX + bounds.maxX) / 2;
  view.offsetY = (bounds.minY + bounds.maxY) / 2;
}

/** 동·지하·타워 윤곽(표시 옵션·종류 일치) 영역 클릭 시 buildings 인덱스 반환. 캔버스 좌표 사용. */
function hitTestBuildingFill(canvasX, canvasY) {
  const world = canvasToWorld(canvasX, canvasY);
  const kindPriority = [AREA_KIND_BUILDING, AREA_KIND_PARKING, AREA_KIND_TOWER_CRANE];
  for (const kind of kindPriority) {
    for (let i = state.buildings.length - 1; i >= 0; i--) {
      const building = state.buildings[i];
      if (!building || resolveBuildingOutlineKind(building) !== kind) continue;
      if (!Array.isArray(building.vertices) || building.vertices.length < 3) continue;
      const bKind = resolveBuildingOutlineKind(building);
      const hatchOn =
        bKind === AREA_KIND_BUILDING
          ? state.showBuildingHatch
          : bKind === AREA_KIND_PARKING
            ? state.showParkingHatch
            : state.showTowerCraneHatch;
      if (!hatchOn && !state.buildingEditMode) continue;
      if (pointInPolygon(world, building.vertices)) return i;
    }
  }
  return -1;
}

function shouldScrollAreaListOnCanvasClick(buildingIndex) {
  return Boolean(state.enableAreaListHitFocus);
}

function pointInPolygon(point, vertices) {
  const { x, y } = point;
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 동 이름 목록에서 해당 인덱스 행으로 스크롤하고 강조 */
function scrollToBuildingInList(buildingIndex) {
  if (buildingIndex < 0 || buildingIndex >= state.buildings.length) return;
  state.highlightedBuildingNameIndex = buildingIndex;
  const row =
    buildingNameEditor?.querySelector(`[data-building-index="${buildingIndex}"]`) ||
    parkingNameEditor?.querySelector(`[data-building-index="${buildingIndex}"]`) ||
    towerCraneNameEditor?.querySelector(`[data-building-index="${buildingIndex}"]`);
  if (row) {
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    document.querySelectorAll(".building-name-editor .name-editor-row").forEach((r) => r.classList.remove("name-editor-row--selected"));
    row.classList.add("name-editor-row--selected");
  }
  requestRedraw();
}

/** 해당 동 윤곽선으로 뷰 줌/이동 */
function focusOnBuilding(buildingIndex) {
  const building = state.buildings[buildingIndex];
  if (!building || !Array.isArray(building.vertices) || building.vertices.length < 3) return;
  const bounds = computeBoundsFromVertices(building.vertices);
  if (bounds) fitViewToBounds(bounds);
  requestRedraw();
}

function worldToCanvas(x, y) {
  const { width, height } = getCanvasSize();
  return {
    x: (x - view.offsetX) * view.scale + width / 2,
    y: height / 2 - (y - view.offsetY) * view.scale,
  };
}

function canvasToWorld(x, y) {
  const { width, height } = getCanvasSize();
  return {
    x: (x - width / 2) / view.scale + view.offsetX,
    y: (height / 2 - y) / view.scale + view.offsetY,
  };
}

/** 현재 캔버스에 보이는 월드 축정렬 영역(팬·줌 반영) — 가시성 컬링용 */
function getViewportWorldRect() {
  const { width, height } = getCanvasSize();
  const c1 = canvasToWorld(0, 0);
  const c2 = canvasToWorld(width, 0);
  const c3 = canvasToWorld(width, height);
  const c4 = canvasToWorld(0, height);
  const xs = [c1.x, c2.x, c3.x, c4.x];
  const ys = [c1.y, c2.y, c3.y, c4.y];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * 동일 circle id 가 배열에 두 번 들어오면 circleMap 과 달리 그리기 루프에서 말뚝·라벨이 겹쳐 그려진다.
 * (설정 병합·재계산 등으로 중복이 생길 수 있음) — 화면용 목록에서는 id 기준 첫 항목만 유지한다.
 */
function dedupeCirclesById(circles) {
  if (!Array.isArray(circles) || circles.length <= 1) return circles || [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < circles.length; i += 1) {
    const c = circles[i];
    const id = c && c.id;
    if (id == null || id === "") {
      out.push(c);
      continue;
    }
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * 필터 조건에 맞는 파일 목록 반환
 * 
 * 파일 목록이 항상 표시되도록 보장
 */
function getVisibleCircles() {
  if (!state.circles || !Array.isArray(state.circles)) {
    console.debug("[getVisibleCircles] state.circles가 없거나 배열이 아닙니다:", state.circles);
    return [];
  }

  let list;
  if (state.activeBuildingFilter === "ALL") {
    list = state.circles;
  } else if (state.activeBuildingFilter === "ERRORS") {
    list = state.circles.filter((circle) => circle.has_error);
  } else if (state.activeBuildingFilter === "UNASSIGNED") {
    list = state.circles.filter((circle) => !circle.building_name || circle.building_name === "");
  } else {
    // 특정 동 필터
    list = state.circles.filter(
      (circle) => circle.building_name === state.activeBuildingFilter,
    );
  }
  const out = dedupeCirclesById(list);
  if (
    state.activeBuildingFilter !== "ALL"
    && state.activeBuildingFilter !== "ERRORS"
    && state.activeBuildingFilter !== "UNASSIGNED"
  ) {
    console.debug(`[getVisibleCircles] 필터 "${state.activeBuildingFilter}": ${out.length}개 Circle`);
  }
  return out;
}

function getVisibleTexts() {
  if (state.activeBuildingFilter === "ALL") {
    return state.texts;
  }
  if (state.activeBuildingFilter === "ERRORS") {
    const textIdsFromErrors = new Set(
      state.errors
        .map((error) => error.text_id)
        .filter((textId) => typeof textId === "string" && textId.length),
    );
    state.circles.forEach((circle) => {
      if (circle.has_error && circle.matched_text_id) {
        textIdsFromErrors.add(circle.matched_text_id);
      }
    });
    return state.texts.filter(
      (text) => text.has_error || textIdsFromErrors.has(text.id),
    );
  }
  if (state.activeBuildingFilter === "UNASSIGNED") {
    return state.texts.filter((text) => !text.building_name);
  }
  const allowedCircleTextIds = new Set(
    state.circles
      .filter((circle) => circle.building_name === state.activeBuildingFilter)
      .map((circle) => circle.matched_text_id)
      .filter((value) => typeof value === "string"),
  );
  return state.texts.filter(
    (text) =>
      text.building_name === state.activeBuildingFilter ||
      allowedCircleTextIds.has(text.id),
  );
}

/** 기초 글자·기초 수치 오버레이 표시 (construction.js 의 isFoundationLabelVizEnabled 와 동일) */
function isFoundationGlyphLayerEnabled() {
  return state.showFoundationLabelViz !== false;
}

/** 매칭된 번호 텍스트 월드 좌표 — matched_text 또는 textMap 보강 */
function resolveCircleMatchedTextWorldPoint(circle) {
  const mt = circle.matched_text;
  if (mt != null) {
    const x = Number(mt.text_center_x);
    const y = Number(mt.text_center_y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  const tid = circle.matched_text_id;
  if (tid != null && tid !== "" && state.textMap?.has(String(tid))) {
    const t = state.textMap.get(String(tid));
    const x = Number(t?.text_center_x ?? t?.center_x);
    const y = Number(t?.text_center_y ?? t?.center_y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  return null;
}

/** 말뚝(원) 중심 ↔ 매칭 번호 텍스트 — 가시 영역 근처만, 스타일별 배치 스트로크 */
function drawCircleToNumberMatchLines(circles) {
  const vp = getViewportWorldRect();
  const pad = 56 / view.scale;
  const near = (wx, wy) =>
    Number.isFinite(wx)
    && Number.isFinite(wy)
    && wx >= vp.minX - pad
    && wx <= vp.maxX + pad
    && wy >= vp.minY - pad
    && wy <= vp.maxY + pad;
  const okSegs = [];
  const errSegs = [];
  circles.forEach((circle) => {
    const endW = resolveCircleMatchedTextWorldPoint(circle);
    if (!endW) return;
    const cx = Number(circle.center_x);
    const cy = Number(circle.center_y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    if (!near(cx, cy) && !near(endW.x, endW.y)) return;
    const start = worldToCanvas(cx, cy);
    const end = worldToCanvas(endW.x, endW.y);
    if (circle.has_error === true) errSegs.push([start, end]);
    else okSegs.push([start, end]);
  });
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  if (okSegs.length) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(147, 197, 253, 0.95)";
    ctx.beginPath();
    okSegs.forEach(([s, e]) => {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    });
    ctx.stroke();
  }
  if (errSegs.length) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(251, 146, 60, 0.98)";
    ctx.beginPath();
    errSegs.forEach(([s, e]) => {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

function drawCanvas() {
  const { width, height } = getCanvasSize();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);
  const parcelOverlay =
    state.parcelReviewViz != null
    || pilexyParcelReviewVizHasGeometry(state.parcelReviewViz)
    || pilexyParcelReviewLxUserHasGeometry();
  if ((!state.hasDataset || !state.circles.length) && !parcelOverlay) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "16px 'Segoe UI'";
    ctx.textAlign = "center";
    ctx.fillText("Upload a DXF to visualize", width / 2, height / 2);
    return;
  }
  if (state.hasDataset && state.circles.length) {
    drawPolylineHints();
    drawBuildings();
    drawAreaCreationPreview();
    const circles = getVisibleCircles();
    const duplicateCircleIds = getDuplicateCircleIds();
    if (state.showCircles) {
      circles.forEach((circle) => drawCircle(circle, duplicateCircleIds));
    }
    if (state.showPoints) {
      circles.forEach((circle) => drawCirclePoint(circle));
    }
    drawDuplicateLabels(circles, duplicateCircleIds);
    if (state.showTextLabels) {
      drawTextLabels();
    }
    if (state.showMatchLines) {
      drawCircleToNumberMatchLines(circles);
    }
    drawRetainingWallVizLinks();
  }
  drawParcelReviewViz();
  drawTooltip();
}

function pilexyParcelReviewLxUserHasGeometry() {
  const r = state.parcelReviewLxRegister?.ring;
  return pilexyNormalizeParcelRingPoints(r).length >= 2;
}

window.pilexyParcelReviewLxUserHasGeometry = pilexyParcelReviewLxUserHasGeometry;

function pilexyParcelReviewVizHasGeometry(payload) {
  if (!payload) return false;
  const showCad = payload.showCadastralMap !== false;
  const showLot = payload.showParcelLot !== false;
  const nPts = (ring) => pilexyNormalizeParcelRingPoints(ring).length;
  const hasLine = (ring) => nPts(ring) >= 2;
  const hasPoly = (ring) => nPts(ring) >= 3;
  const nearbyOk =
    showLot &&
    payload.showNearbyParcels !== false &&
    (payload.nearbyParcelRings || []).some((n) => n && hasPoly(n.ring));
  const bonbunOk =
    showCad &&
    Array.isArray(payload.cadastralBonbunRings) &&
    (payload.cadastralBonbunRings || []).some((r) => hasLine(r));
  const parcelOk = showLot && hasPoly(payload.parcelRing);
  const base =
    parcelOk ||
    hasLine(payload.siteRing) ||
    (payload.encroachmentRings || []).some(hasPoly) ||
    nearbyOk ||
    bonbunOk;
  if (base) return true;
  const sel = state.parcelReviewSelection;
  if (showLot && sel && String(sel.pnu || "").trim()) {
    const r = ringForParcelReviewSelection(payload, sel);
    return Array.isArray(r) && pilexyNormalizeParcelRingPoints(r).length >= 2;
  }
  if (
    payload.queryPoint
    && Number.isFinite(Number(payload.queryPoint.x))
    && Number.isFinite(Number(payload.queryPoint.y))
  ) {
    return true;
  }
  if (
    Array.isArray(payload.lxRegisterEncroachmentRings)
    && payload.lxRegisterEncroachmentRings.some((r) => hasPoly(r))
    && state.parcelReviewLxRegister?.showEncroachment !== false
  ) {
    return true;
  }
  return false;
}

function pilexySetParcelReviewCanvasBadge(visible) {
  const badge = document.getElementById("parcel-review-canvas-badge");
  if (!badge) return;
  badge.classList.toggle("hidden", !visible);
}

function pilexySetParcelReviewViz(payload) {
  if (!payload) {
    state.parcelReviewViz = null;
    state.parcelReviewSelection = null;
    state.parcelReviewCoordHover = null;
    state.parcelReviewCoordPinned = null;
    pilexySetParcelReviewCanvasBadge(pilexyParcelReviewLxUserHasGeometry());
    requestRedraw();
    return;
  }
  state.parcelReviewSelection = null;
  state.parcelReviewCoordHover = null;
  state.parcelReviewCoordPinned = null;
  state.parcelReviewViz = {
    siteRing: pilexyParcelVizRingFromPayload(payload.siteRing, 2),
    parcelRing: pilexyParcelVizRingFromPayload(payload.parcelRing, 3),
    encroachmentRings: (Array.isArray(payload.encroachmentRings) ? payload.encroachmentRings : [])
      .map((r) => pilexyParcelVizRingFromPayload(r, 3))
      .filter((r) => r.length >= 3),
    nearbyParcelRings: (Array.isArray(payload.nearbyParcelRings) ? payload.nearbyParcelRings : [])
      .filter((n) => n)
      .map((n) => ({ ...n, ring: pilexyParcelVizRingFromPayload(n.ring, 3) }))
      .filter((n) => n.ring.length >= 3),
    cadastralBonbunRings: (Array.isArray(payload.cadastralBonbunRings) ? payload.cadastralBonbunRings : [])
      .map((r) => pilexyParcelVizRingFromPayload(r, 2))
      .filter((r) => r.length >= 2),
    winnerPnu: payload.winnerPnu != null ? String(payload.winnerPnu) : "",
    showCadastralMap: payload.showCadastralMap !== false,
    showParcelLot: payload.showParcelLot !== false,
    showNearbyParcels: payload.showNearbyParcels !== false,
    debugShowNearbyRingVertices: payload.debugShowNearbyRingVertices === true,
    queryPoint:
      payload.queryPoint &&
      Number.isFinite(Number(payload.queryPoint.x)) &&
      Number.isFinite(Number(payload.queryPoint.y))
        ? { x: Number(payload.queryPoint.x), y: Number(payload.queryPoint.y) }
        : null,
    lxRegisterEncroachmentRings: (Array.isArray(payload.lxRegisterEncroachmentRings)
      ? payload.lxRegisterEncroachmentRings
      : []
    )
      .map((r) => pilexyParcelVizRingFromPayload(r, 3))
      .filter((r) => r.length >= 3),
  };
  pilexySetParcelReviewCanvasBadge(
    pilexyParcelReviewVizHasGeometry(payload) || pilexyParcelReviewLxUserHasGeometry(),
  );
  requestRedraw();
}

window.pilexySetParcelReviewViz = pilexySetParcelReviewViz;

/**
 * GeoJSON Polygon 등에서 링이 [[x,y],...] 형태로 한 겹 이상 더 감싸져 온 경우를 펼침.
 * (한 요소만 있고 그 안이 꼭짓점 배열이면 그 안을 사용)
 */
function pilexyUnwrapParcelRingPointList(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return ring;
  let r = ring;
  for (let guard = 0; guard < 6; guard += 1) {
    if (r.length !== 1 || !Array.isArray(r[0])) break;
    const inner = r[0];
    if (!Array.isArray(inner) || inner.length < 2) break;
    const first = inner[0];
    const arrPair =
      Array.isArray(first) &&
      first.length >= 2 &&
      Number.isFinite(Number(first[0])) &&
      Number.isFinite(Number(first[1]));
    const objPt =
      first &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      Number.isFinite(Number(first.x)) &&
      Number.isFinite(Number(first.y));
    if (!arrPair && !objPt) break;
    r = inner;
  }
  return r;
}

/** 필지 링을 {x,y}[] 로 통일(배열 점·닫힘 중복 제거). 그리기·줌·히트 공통 */
function pilexyNormalizeParcelRingPoints(ring) {
  if (!Array.isArray(ring)) return [];
  const r0 = pilexyUnwrapParcelRingPointList(ring);
  const out = [];
  for (let i = 0; i < r0.length; i += 1) {
    const p = r0[i];
    let x;
    let y;
    if (Array.isArray(p) && p.length >= 2) {
      x = Number(p[0]);
      y = Number(p[1]);
    } else if (p && typeof p === "object") {
      x = Number(p.x);
      y = Number(p.y);
    } else {
      continue;
    }
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-5) out.pop();
  }
  return out;
}

/** 오버레이 state에 넣을 링: 정규화 후 최소 꼭짓점 수 충족 시에만 반환 */
function pilexyParcelVizRingFromPayload(ring, minPts) {
  const pts = pilexyNormalizeParcelRingPoints(ring);
  return pts.length >= minPts ? pts : [];
}

window.pilexyNormalizeParcelRingPoints = pilexyNormalizeParcelRingPoints;

function worldVertsForParcelHit(ring) {
  return pilexyNormalizeParcelRingPoints(ring);
}

function minCanvasDistanceToClosedRing(canvasX, canvasY, ring) {
  const pts = pilexyNormalizeParcelRingPoints(ring);
  if (pts.length < 2) return Infinity;
  const n = pts.length;
  const dupClose =
    n >= 2 &&
    Math.hypot(pts[0].x - pts[n - 1].x, pts[0].y - pts[n - 1].y) <
      1e-4 * Math.max(1, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
  const edgeCount = dupClose ? n - 1 : n;
  const pt = { x: canvasX, y: canvasY };
  let minD = Infinity;
  for (let i = 0; i < edgeCount; i += 1) {
    const j = (i + 1) % n;
    const a = worldToCanvas(pts[i].x, pts[i].y);
    const b = worldToCanvas(pts[j].x, pts[j].y);
    const d = pointToSegmentDistance(pt, a, b);
    if (d < minD) minD = d;
  }
  return minD;
}

/** 캔버스 좌표에서 필지 링(승자 링 우선, 그다음 인접 역순) 픽 */
function pickParcelReviewRingAtCanvas(canvasX, canvasY) {
  const viz = state.parcelReviewViz;
  if (!viz) return null;
  const wPt = canvasToWorld(canvasX, canvasY);
  const tol = Math.max(12, 4 * (Number(view.scale) > 0 ? view.scale : 1));

  if (viz.showParcelLot !== false && Array.isArray(viz.parcelRing) && viz.parcelRing.length >= 3) {
    const verts = worldVertsForParcelHit(viz.parcelRing);
    if (verts.length >= 3) {
      const inside = pointInPolygon(wPt, verts);
      const edge = minCanvasDistanceToClosedRing(canvasX, canvasY, viz.parcelRing);
      if (inside || edge <= tol) {
        return { pnu: String(viz.winnerPnu || ""), isWinner: true };
      }
    }
  }

  if (viz.showParcelLot === false || viz.showNearbyParcels === false) return null;
  const list = [...(viz.nearbyParcelRings || [])].reverse();
  for (let i = 0; i < list.length; i += 1) {
    const it = list[i];
    if (!it || it.isWinner === true) continue;
    const r = it.ring;
    if (!Array.isArray(r) || r.length < 3) continue;
    const verts = worldVertsForParcelHit(r);
    if (verts.length < 3) continue;
    const inside = pointInPolygon(wPt, verts);
    const edge = minCanvasDistanceToClosedRing(canvasX, canvasY, r);
    if (inside || edge <= tol) {
      return { pnu: String(it.pnu || ""), isWinner: false };
    }
  }
  return null;
}

/* 쿼리점·꼭짓점만(선을 따라 연속 호버 없음) — 캔버스 px 허용 */
const PARCEL_COORD_QUERY_PX = 18;
const PARCEL_COORD_VERTEX_PX = 16;
const PARCEL_COORD_VERTEX_SELECTED_PX = 22;

function canvasLogicalToClient(canvasX, canvasY) {
  const rect = canvas.getBoundingClientRect();
  const { width, height } = getCanvasSize();
  if (!(width > 0) || !(height > 0)) return { clientX: rect.left, clientY: rect.top };
  return {
    clientX: rect.left + (canvasX / width) * rect.width,
    clientY: rect.top + (canvasY / height) * rect.height,
  };
}

function pickParcelReviewQueryPointCanvas(canvasX, canvasY) {
  const viz = state.parcelReviewViz;
  if (!viz?.queryPoint) return false;
  const qx = Number(viz.queryPoint.x);
  const qy = Number(viz.queryPoint.y);
  if (!Number.isFinite(qx) || !Number.isFinite(qy)) return false;
  const c = worldToCanvas(qx, qy);
  return Math.hypot(c.x - canvasX, c.y - canvasY) <= PARCEL_COORD_QUERY_PX;
}

function pilexyParcelReviewRingsForCoordProbe(viz) {
  const rows = [];
  if (!viz) {
    const lxOnly = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
    if (lxOnly.length >= 3) {
      rows.push({ ring: lxOnly, label: "경계점 좌표등록부(입력)" });
    }
    return rows;
  }
  if (Array.isArray(viz.siteRing) && pilexyNormalizeParcelRingPoints(viz.siteRing).length >= 2) {
    rows.push({ ring: viz.siteRing, label: "대지 외곽" });
  }
  if (
    viz.showParcelLot !== false &&
    Array.isArray(viz.parcelRing) &&
    viz.parcelRing.length >= 3
  ) {
    rows.push({ ring: viz.parcelRing, label: "연속지적(승자) 필지" });
  }
  if (viz.showParcelLot !== false && viz.showNearbyParcels !== false) {
    (viz.nearbyParcelRings || []).forEach((n) => {
      if (n && n.isWinner !== true && Array.isArray(n.ring) && n.ring.length >= 2) {
        const pnu = String(n.pnu || "").trim();
        rows.push({ ring: n.ring, label: pnu ? `인접 후보 PNU ${pnu}` : "인접 후보" });
      }
    });
  }
  (viz.encroachmentRings || []).forEach((r, idx) => {
    if (Array.isArray(r) && r.length >= 2) rows.push({ ring: r, label: `필지 밖·침범 ${idx + 1}` });
  });
  const lxUserRing = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
  if (lxUserRing.length >= 3) {
    rows.push({ ring: lxUserRing, label: "경계점 좌표등록부(입력)" });
  }
  (viz.lxRegisterEncroachmentRings || []).forEach((r, idx) => {
    if (Array.isArray(r) && r.length >= 2) {
      rows.push({ ring: r, label: `등록부 기준 대지 초과 ${idx + 1}` });
    }
  });
  if (viz.showCadastralMap !== false) {
    (viz.cadastralBonbunRings || []).forEach((r, idx) => {
      if (Array.isArray(r) && pilexyNormalizeParcelRingPoints(r).length >= 2) {
        rows.push({ ring: r, label: `지적 본번 경계 ${idx + 1}` });
      }
    });
  }
  return rows;
}

/**
 * 대지·필지·쿼리점: 꼭짓점(절곡점)과 쿼리점에만 도면 m 좌표(선분 위 연속 호버 없음).
 * 우선순위: 거리 짧음 → 동거리면 쿼리 > 선택 링 꼭짓점 > 기타 꼭짓점
 */
function pickParcelReviewCoordHoverModel(canvasX, canvasY, clientX, clientY) {
  const viz = state.parcelReviewViz;
  if (!viz && !pilexyParcelReviewLxUserHasGeometry()) return null;
  const sel = state.parcelReviewSelection;
  const selRing =
    viz && sel && String(sel.pnu || "").trim() !== "" ? ringForParcelReviewSelection(viz, sel) : null;
  const isSelRing = (ring) => Boolean(selRing && ring === selRing);
  const cands = [];

  if (viz && viz.queryPoint) {
    const qx = Number(viz.queryPoint.x);
    const qy = Number(viz.queryPoint.y);
    if (Number.isFinite(qx) && Number.isFinite(qy)) {
      const c = worldToCanvas(qx, qy);
      const d = Math.hypot(c.x - canvasX, c.y - canvasY);
      if (d <= PARCEL_COORD_QUERY_PX) {
        cands.push({
          d,
          z: 0,
          model: {
            wx: qx,
            wy: qy,
            lines: ["검토 쿼리점 (도면 m)", `X ${formatNumber(qx)} · Y ${formatNumber(qy)}`],
            clientX,
            clientY,
          },
        });
      }
    }
  }

  const tryVertex = (wx, wy, edgeLabel, onSelectedRing) => {
    const cc = worldToCanvas(wx, wy);
    const d = Math.hypot(cc.x - canvasX, cc.y - canvasY);
    const tol = onSelectedRing ? PARCEL_COORD_VERTEX_SELECTED_PX : PARCEL_COORD_VERTEX_PX;
    if (d > tol) return;
    const z = onSelectedRing ? 1 : 2;
    const suffix = onSelectedRing ? " (선택·꼭짓점)" : " (꼭짓점)";
    cands.push({
      d,
      z,
      model: {
        wx,
        wy,
        lines: [edgeLabel, `X ${formatNumber(wx)} · Y ${formatNumber(wy)}${suffix}`],
        clientX,
        clientY,
      },
    });
  };

  const tryRingVerticesOnly = (ring, edgeLabel) => {
    const onSel = isSelRing(ring);
    const pts = pilexyNormalizeParcelRingPoints(ring);
    const n = pts.length;
    if (n < 2) return;
    for (let i = 0; i < n; i += 1) {
      tryVertex(pts[i].x, pts[i].y, edgeLabel, onSel);
    }
  };

  pilexyParcelReviewRingsForCoordProbe(viz).forEach((row) => tryRingVerticesOnly(row.ring, row.label));

  if (!cands.length) return null;
  cands.sort((u, v) => (u.d !== v.d ? u.d - v.d : u.z - v.z));
  return cands[0].model;
}

function pilexyPinnedParcelQueryCoordModel() {
  const viz = state.parcelReviewViz;
  const pin = state.parcelReviewCoordPinned;
  if (!viz || !pin || pin.kind !== "query" || !viz.queryPoint) return null;
  const q = viz.queryPoint;
  const wx = Number(q.x);
  const wy = Number(q.y);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  const c = worldToCanvas(wx, wy);
  const cl = canvasLogicalToClient(c.x + 12, c.y - 18);
  return {
    wx,
    wy,
    lines: ["검토 쿼리점 (고정)", `X ${formatNumber(wx)} · Y ${formatNumber(wy)}`],
    clientX: cl.clientX,
    clientY: cl.clientY,
  };
}

function pilexyParcelReviewCoordTooltipModel() {
  if (
    !state.parcelReviewCoordProbe
    || (!state.parcelReviewViz && !pilexyParcelReviewLxUserHasGeometry())
  ) {
    return null;
  }
  const h = state.parcelReviewCoordHover;
  if (h) return h;
  return pilexyPinnedParcelQueryCoordModel();
}

function pilexySetParcelReviewCoordProbe(enabled) {
  state.parcelReviewCoordProbe = Boolean(enabled);
  if (!state.parcelReviewCoordProbe) {
    state.parcelReviewCoordHover = null;
    state.parcelReviewCoordPinned = null;
  }
  requestRedraw();
}

window.pilexySetParcelReviewCoordProbe = pilexySetParcelReviewCoordProbe;

function pilexyParcelReviewLxRegisterApplyParsedRing(points) {
  const pts = pilexyNormalizeParcelRingPoints(points);
  if (!state.parcelReviewLxRegister) return false;
  state.parcelReviewLxRegister.ring = pts.length >= 3 ? pts : null;
  pilexySetParcelReviewCanvasBadge(
    (state.parcelReviewViz && pilexyParcelReviewVizHasGeometry(state.parcelReviewViz))
      || pilexyParcelReviewLxUserHasGeometry(),
  );
  requestRedraw();
  return pts.length >= 3;
}

function pilexyParcelReviewLxRegisterClearRing() {
  if (!state.parcelReviewLxRegister) return;
  state.parcelReviewLxRegister.ring = null;
  if (state.parcelReviewViz) state.parcelReviewViz.lxRegisterEncroachmentRings = [];
  pilexySetParcelReviewCanvasBadge(
    state.parcelReviewViz != null && pilexyParcelReviewVizHasGeometry(state.parcelReviewViz),
  );
  requestRedraw();
}

function pilexyParcelReviewLxRegisterSetOptions(partial) {
  if (!state.parcelReviewLxRegister || !partial || typeof partial !== "object") return;
  Object.assign(state.parcelReviewLxRegister, partial);
  requestRedraw();
}

function pilexyGetParcelReviewLxRegisterVerticesForApi() {
  const pts = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
  if (pts.length < 3) return [];
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

window.pilexyParcelReviewLxRegisterApplyParsedRing = pilexyParcelReviewLxRegisterApplyParsedRing;
window.pilexyParcelReviewLxRegisterClearRing = pilexyParcelReviewLxRegisterClearRing;
window.pilexyParcelReviewLxRegisterSetOptions = pilexyParcelReviewLxRegisterSetOptions;
window.pilexyGetParcelReviewLxRegisterVerticesForApi = pilexyGetParcelReviewLxRegisterVerticesForApi;

function pilexyGetParcelReviewLxRegisterUseReference() {
  return Boolean(state.parcelReviewLxRegister?.useAsReference);
}

window.pilexyGetParcelReviewLxRegisterUseReference = pilexyGetParcelReviewLxRegisterUseReference;

function pilexyClearParcelReviewSelection() {
  state.parcelReviewSelection = null;
  requestRedraw();
}

window.pilexyClearParcelReviewSelection = pilexyClearParcelReviewSelection;

/** PNU 비교(공백·숫자만 추출 일치로 JSON 숫자 정밀도·표기 차이 완화) */
function pilexyParcelPnuMatch(a, b) {
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();
  if (sa !== "" && sb !== "" && sa === sb) return true;
  const da = sa.replace(/\D/g, "");
  const db = sb.replace(/\D/g, "");
  return da.length > 0 && da === db;
}

function ringForParcelReviewSelection(viz, sel) {
  if (!sel || sel.pnu == null || String(sel.pnu).trim() === "") return null;
  const want = String(sel.pnu).trim();
  if (sel.isWinner === true && Array.isArray(viz.parcelRing) && viz.parcelRing.length >= 3) {
    return viz.parcelRing;
  }
  if (pilexyParcelPnuMatch(viz.winnerPnu, want) && Array.isArray(viz.parcelRing) && viz.parcelRing.length >= 3) {
    return viz.parcelRing;
  }
  const row = (viz.nearbyParcelRings || []).find((it) => it && pilexyParcelPnuMatch(it.pnu, want));
  if (row && Array.isArray(row.ring) && row.ring.length >= 3) return row.ring;
  return null;
}

/** 단일 링(필지)에 맞춰 도면 뷰 확대·이동 */
function pilexyFocusParcelReviewRingOnCanvas(ring) {
  const pts = pilexyNormalizeParcelRingPoints(ring);
  if (pts.length < 2) return;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  if (xs.length < 1) return;
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 38;
    maxX += 38;
  }
  if (minY === maxY) {
    minY -= 38;
    maxY += 38;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const padX = Math.max(spanX * 0.12, 10);
  const padY = Math.max(spanY * 0.12, 10);
  fitViewToBounds({ minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY });
  requestRedraw();
}

window.pilexyFocusParcelReviewRingOnCanvas = pilexyFocusParcelReviewRingOnCanvas;

/** 필지 검토 패널 등에서 PNU로 선택(도면 하이라이트·이벤트 동일). opts.focus === true 이면 해당 링으로 줌. */
function pilexySetParcelReviewSelection(opts) {
  const pnuStr = String(opts && opts.pnu != null ? opts.pnu : "").trim();
  if (!pnuStr) return;
  const viz = state.parcelReviewViz;
  if (!viz) return;
  const isWinner = Boolean(opts && opts.isWinner);
  const sel = { pnu: pnuStr, isWinner };
  const ring = ringForParcelReviewSelection(viz, sel);
  const ringNorm = pilexyNormalizeParcelRingPoints(ring);
  if (!Array.isArray(ring) || ringNorm.length < 2) return;
  state.parcelReviewSelection = sel;
  setUploadStatus(`필지 선택: PNU ${pnuStr}${isWinner ? " (연속지적 승자)" : " (인접 후보)"}`);
  try {
    window.dispatchEvent(
      new CustomEvent("pilexy-parcel-review-select", { detail: { pnu: pnuStr, isWinner } }),
    );
  } catch (_) {
    /* ignore */
  }
  if (opts && opts.focus === true) {
    pilexyFocusParcelReviewRingOnCanvas(ring);
  } else {
    requestRedraw();
  }
}

window.pilexySetParcelReviewSelection = pilexySetParcelReviewSelection;

/** 쿼리점 기준 maxM 이내에 링 꼭짓점이 하나라도 있으면 true(필터·디버그용). */
function pilexyParcelRingHasVertexWithinM(ring, qx, qy, maxM) {
  const pts = pilexyNormalizeParcelRingPoints(ring);
  if (pts.length < 1) return false;
  if (!Number.isFinite(qx) || !Number.isFinite(qy) || !(maxM > 0)) return true;
  const r2 = maxM * maxM;
  for (let i = 0; i < pts.length; i += 1) {
    const x = pts[i].x;
    const y = pts[i].y;
    const dx = x - qx;
    const dy = y - qy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

const PARCEL_NEARBY_FIT_RADIUS_M = 280;
/** 인접 링이 많을 때 맞춤 bbox가 과대해지면 scale이 너무 작아져 오버레이가 안 보이는 것처럼 느껴짐 → 이 스팬 초과 시 대지·선택필지·쿼리만으로 재맞춤 */
const PARCEL_OVERLAY_VIEW_MAX_SPAN_M = 3200;
window.pilexyParcelNearFitRadiusM = PARCEL_NEARBY_FIT_RADIUS_M;
window.pilexyParcelRingHasVertexWithinM = pilexyParcelRingHasVertexWithinM;

/** 필지 검토 오버레이가 보이도록 도면 뷰(줌·팬)를 맞춤 */
function pilexyFocusParcelReviewOnCanvas(payload) {
  const pay = payload || {};
  if (!pilexyParcelReviewVizHasGeometry(pay) && !pilexyParcelReviewLxUserHasGeometry()) return;
  const showLot = pay.showParcelLot !== false;
  const showCad = pay.showCadastralMap !== false;
  const xs = [];
  const ys = [];
  const addRing = (ring) => {
    pilexyNormalizeParcelRingPoints(ring).forEach((p) => {
      xs.push(p.x);
      ys.push(p.y);
    });
  };
  if (showLot) addRing(pay.parcelRing);
  addRing(pay.siteRing);
  (pay.encroachmentRings || []).forEach(addRing);
  if (showCad) (pay.cadastralBonbunRings || []).forEach(addRing);
  if (showLot && pay.showNearbyParcels !== false) {
    (pay.nearbyParcelRings || []).forEach((n) => {
      if (!n || !Array.isArray(n.ring)) return;
      addRing(n.ring);
    });
  }
  if (pay.queryPoint && Number.isFinite(pay.queryPoint.x) && Number.isFinite(pay.queryPoint.y)) {
    xs.push(pay.queryPoint.x);
    ys.push(pay.queryPoint.y);
  }
  const lxUserFocus = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
  if (lxUserFocus.length >= 2) addRing(lxUserFocus);
  (pay.lxRegisterEncroachmentRings || []).forEach(addRing);
  if (xs.length < 1) return;
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 28;
    maxX += 28;
  }
  if (minY === maxY) {
    minY -= 28;
    maxY += 28;
  }
  let spanX = maxX - minX || 1;
  let spanY = maxY - minY || 1;
  let viewFitTightOnly = false;
  if (spanX > PARCEL_OVERLAY_VIEW_MAX_SPAN_M || spanY > PARCEL_OVERLAY_VIEW_MAX_SPAN_M) {
    viewFitTightOnly = true;
    xs.length = 0;
    ys.length = 0;
    if (showLot) addRing(pay.parcelRing);
    addRing(pay.siteRing);
    (pay.encroachmentRings || []).forEach(addRing);
    if (showCad) (pay.cadastralBonbunRings || []).forEach(addRing);
    if (pay.queryPoint && Number.isFinite(pay.queryPoint.x) && Number.isFinite(pay.queryPoint.y)) {
      xs.push(pay.queryPoint.x);
      ys.push(pay.queryPoint.y);
    }
    if (lxUserFocus.length >= 2) addRing(lxUserFocus);
    (pay.lxRegisterEncroachmentRings || []).forEach(addRing);
    if (xs.length < 1) return;
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
    if (minX === maxX) {
      minX -= 28;
      maxX += 28;
    }
    if (minY === maxY) {
      minY -= 28;
      maxY += 28;
    }
    spanX = maxX - minX || 1;
    spanY = maxY - minY || 1;
  }
  const padX = Math.max(spanX * 0.14, 12);
  const padY = Math.max(spanY * 0.14, 12);
  fitViewToBounds({ minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY });
  requestRedraw();
}

window.pilexyFocusParcelReviewOnCanvas = pilexyFocusParcelReviewOnCanvas;

/**
 * 인접 링·대지·선택 필지·쿼리점으로 뷰를 맞춤.
 * WFS 후보가 넓게 퍼지면 bbox 스팬이 수 km가 되어 scale이 극소 → 오버레이가 안 보이는 것처럼 보이므로,
 * 스팬이 PARCEL_OVERLAY_VIEW_MAX_SPAN_M 을 넘으면 맞춤만 대지·선택 필지·쿼리로 좁힘(그리기는 전부 유지).
 */
function pilexyFocusParcelReviewNearbyOnCanvas(payload) {
  if (!payload) return;
  const showLot = payload.showParcelLot !== false;
  const showCad = payload.showCadastralMap !== false;
  const xs = [];
  const ys = [];
  const addRing = (ring) => {
    pilexyNormalizeParcelRingPoints(ring).forEach((p) => {
      xs.push(p.x);
      ys.push(p.y);
    });
  };
  const nearbyOn = showLot && payload.showNearbyParcels !== false;
  const nearby = Array.isArray(payload.nearbyParcelRings) ? payload.nearbyParcelRings : [];
  if (nearbyOn && nearby.length) {
    nearby.forEach((n) => {
      if (!n || !Array.isArray(n.ring) || n.ring.length < 2) return;
      addRing(n.ring);
    });
  }
  addRing(payload.siteRing);
  if (showLot) addRing(payload.parcelRing);
  if (showCad) (payload.cadastralBonbunRings || []).forEach(addRing);
  if (payload.queryPoint && Number.isFinite(Number(payload.queryPoint.x)) && Number.isFinite(Number(payload.queryPoint.y))) {
    xs.push(Number(payload.queryPoint.x));
    ys.push(Number(payload.queryPoint.y));
  }
  const lxUserNearby = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
  if (lxUserNearby.length >= 2) addRing(lxUserNearby);
  (payload.lxRegisterEncroachmentRings || []).forEach(addRing);
  if (xs.length < 2) {
    pilexyFocusParcelReviewOnCanvas(payload);
    return;
  }
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 42;
    maxX += 42;
  }
  if (minY === maxY) {
    minY -= 42;
    maxY += 42;
  }
  let spanX = maxX - minX || 1;
  let spanY = maxY - minY || 1;
  let viewFitTightOnly = false;
  if (spanX > PARCEL_OVERLAY_VIEW_MAX_SPAN_M || spanY > PARCEL_OVERLAY_VIEW_MAX_SPAN_M) {
    viewFitTightOnly = true;
    xs.length = 0;
    ys.length = 0;
    addRing(payload.siteRing);
    if (showLot) addRing(payload.parcelRing);
    if (showCad) (payload.cadastralBonbunRings || []).forEach(addRing);
    if (payload.queryPoint && Number.isFinite(Number(payload.queryPoint.x)) && Number.isFinite(Number(payload.queryPoint.y))) {
      xs.push(Number(payload.queryPoint.x));
      ys.push(Number(payload.queryPoint.y));
    }
    if (lxUserNearby.length >= 2) addRing(lxUserNearby);
    (payload.lxRegisterEncroachmentRings || []).forEach(addRing);
    if (xs.length < 2) {
      pilexyFocusParcelReviewOnCanvas(payload);
      return;
    }
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
    if (minX === maxX) {
      minX -= 42;
      maxX += 42;
    }
    if (minY === maxY) {
      minY -= 42;
      maxY += 42;
    }
    spanX = maxX - minX || 1;
    spanY = maxY - minY || 1;
  }
  const padFrac = 0.045;
  const padX = Math.max(spanX * padFrac, 6);
  const padY = Math.max(spanY * padFrac, 6);
  fitViewToBounds({ minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY });
  requestRedraw();
}

window.pilexyFocusParcelReviewNearbyOnCanvas = pilexyFocusParcelReviewNearbyOnCanvas;

function drawParcelReviewViz() {
  const lxOpt = state.parcelReviewLxRegister;
  const rawViz = state.parcelReviewViz;
  if (!rawViz && !pilexyParcelReviewLxUserHasGeometry()) return;
  const viz = rawViz || {
    siteRing: [],
    parcelRing: [],
    encroachmentRings: [],
    nearbyParcelRings: [],
    cadastralBonbunRings: [],
    winnerPnu: "",
    showCadastralMap: false,
    showParcelLot: false,
    showNearbyParcels: false,
    debugShowNearbyRingVertices: false,
    queryPoint: null,
    lxRegisterEncroachmentRings: [],
  };
  const hasNearby =
    viz.showParcelLot !== false &&
    viz.showNearbyParcels !== false &&
    (viz.nearbyParcelRings || []).some((n) => n && pilexyNormalizeParcelRingPoints(n.ring).length >= 2);
  const bonbunData = (viz.cadastralBonbunRings || []).some(
    (r) => Array.isArray(r) && pilexyNormalizeParcelRingPoints(r).length >= 2,
  );
  const hasBonbun = bonbunData && viz.showCadastralMap !== false;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  function ringAreaWorld(ring) {
    const pts = pilexyNormalizeParcelRingPoints(ring);
    if (pts.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const j = (i + 1) % pts.length;
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      if (![xi, yi, xj, yj].every((v) => Number.isFinite(v))) return 0;
      a += xi * yj - xj * yi;
    }
    return Math.abs(a / 2);
  }

  /** drawBuildings 와 동일: 월드 꼭짓점 → worldToCanvas → path (중첩 save/캔버스 finite 필터 없음) */
  function strokeParcelRingWorld(ring, strokeStyle, lineWidth, lineDash, globalAlpha) {
    const pts = pilexyNormalizeParcelRingPoints(ring);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, index) => {
      const c = worldToCanvas(p.x, p.y);
      if (index === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.setLineDash(lineDash || []);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = globalAlpha == null ? 1 : globalAlpha;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function fillParcelRingWorld(ring, fillStyle, globalAlpha) {
    const pts = pilexyNormalizeParcelRingPoints(ring);
    if (pts.length < 3) return;
    ctx.beginPath();
    pts.forEach((p, index) => {
      const c = worldToCanvas(p.x, p.y);
      if (index === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.globalAlpha = globalAlpha == null ? 1 : globalAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** 탭/캔버스 선택 링: 동 편집 꼭짓점처럼 보이도록 흰 외곽 + 노란 점선 + 꼭짓점 점 */
  function drawParcelSelectionHighlightWorld(ring) {
    const pts = pilexyNormalizeParcelRingPoints(ring);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const c = worldToCanvas(p.x, p.y);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    pts.forEach((p, i) => {
      const c = worldToCanvas(p.x, p.y);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(250, 204, 21, 1)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p) => {
      const c = worldToCanvas(p.x, p.y);
      ctx.beginPath();
      ctx.fillStyle = "rgba(250, 204, 21, 0.98)";
      ctx.strokeStyle = "rgba(120, 53, 15, 0.95)";
      ctx.lineWidth = 1.2;
      ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  const encRings = (viz.encroachmentRings || []).filter((r) => Array.isArray(r) && r.length >= 3);
  let mainEnc = null;
  let mainEncArea = 0;
  encRings.forEach((ring) => {
    const ar = ringAreaWorld(ring);
    if (ar > mainEncArea) {
      mainEncArea = ar;
      mainEnc = ring;
    }
  });

  /* 0) 필지 밖(침범): 동 윤곽 해치(drawBuildings)처럼 낮은 알파 면 + 얇은 스트로크 */
  if (mainEnc && mainEncArea > 0) {
    fillParcelRingWorld(mainEnc, "rgba(239, 68, 68, 0.42)", 1);
    strokeParcelRingWorld(mainEnc, "rgba(127, 29, 29, 0.95)", 1.8, [], 1);
    encRings.forEach((ring) => {
      if (ring === mainEnc) return;
      const ar = ringAreaWorld(ring);
      if (ar < mainEncArea * 0.08) return;
      fillParcelRingWorld(ring, "rgba(248, 113, 113, 0.14)", 1);
      strokeParcelRingWorld(ring, "rgba(220, 38, 38, 0.75)", 1.2, [6, 4], 0.9);
    });
  }

  /* 1) 대지 외곽: 주차장 윤곽(drawBuildings dashed)과 유사 — 주황 점선 */
  strokeParcelRingWorld(viz.siteRing, "rgba(253, 224, 71, 0.92)", 1.2, [10, 6], 0.88);

  /* 1b) 등록부 기준: 대지에서 등록부를 뺀 초과 영역(서버 Shapely) */
  if (
    lxOpt
    && lxOpt.showEncroachment !== false
    && Array.isArray(viz.lxRegisterEncroachmentRings)
    && viz.lxRegisterEncroachmentRings.length
  ) {
    viz.lxRegisterEncroachmentRings.forEach((ring) => {
      if (!Array.isArray(ring) || ring.length < 3) return;
      fillParcelRingWorld(ring, "rgba(234, 88, 12, 0.26)", 1);
      strokeParcelRingWorld(ring, "rgba(180, 52, 6, 0.92)", 1.55, [7, 5], 0.95);
    });
  }

  /* 2) WFS 인접: 실선만(면 없음), 동 팔레트처럼 고정 두께 + 다각형 겹침 완화 알파 — 「필지 표시」꺼지면 후보도 숨김 */
  if (viz.showParcelLot !== false && viz.showNearbyParcels !== false) {
    (viz.nearbyParcelRings || []).forEach((item) => {
      if (!item || item.isWinner === true) return;
      const r = item.ring;
      if (!Array.isArray(r) || r.length < 3) return;
      strokeParcelRingWorld(r, "rgba(232, 121, 249, 0.95)", 1.15, [], 0.58);
    });
    if (viz.debugShowNearbyRingVertices) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      (viz.nearbyParcelRings || []).forEach((item) => {
        if (!item || item.isWinner === true) return;
        const pts = pilexyNormalizeParcelRingPoints(item.ring);
        pts.forEach((p) => {
          const c = worldToCanvas(p.x, p.y);
          ctx.beginPath();
          ctx.fillStyle = "rgba(232, 121, 249, 0.92)";
          ctx.strokeStyle = "rgba(76, 29, 149, 0.55)";
          ctx.lineWidth = 1;
          ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
      ctx.restore();
    }
  }

  /* 3) 선택 필지(연속지적): 동 건물 해치와 유사한 낮은 알파 면 + 윤곽선 */
  if (viz.showParcelLot !== false && Array.isArray(viz.parcelRing) && viz.parcelRing.length >= 3) {
    fillParcelRingWorld(viz.parcelRing, "rgba(34, 197, 94, 0.1)", 1);
    strokeParcelRingWorld(viz.parcelRing, "rgba(74, 222, 128, 0.9)", 1.25, [], 0.82);
    strokeParcelRingWorld(viz.parcelRing, "rgba(22, 163, 74, 0.98)", 1.65, [], 1);
  }

  /* 3b) 지적 본번 경계(VWorld WFS): 선택 필지 윤곽 위에도 보이게 하늘 점선 */
  if (viz.showCadastralMap !== false) {
    (viz.cadastralBonbunRings || []).forEach((ring) => {
      if (!Array.isArray(ring) || pilexyNormalizeParcelRingPoints(ring).length < 2) return;
      strokeParcelRingWorld(ring, "rgba(56, 189, 248, 0.92)", 1.2, [5, 4], 0.88);
    });
  }

  /* 3c) 경계점 좌표등록부(사용자 입력, 도면 m) — 청록 */
  const lxUserPts = pilexyNormalizeParcelRingPoints(lxOpt?.ring);
  if (lxOpt && lxUserPts.length >= 3) {
    if (lxOpt.showFill) {
      fillParcelRingWorld(lxUserPts, "rgba(6, 182, 212, 0.1)", 1);
    }
    if (lxOpt.showOutline !== false) {
      strokeParcelRingWorld(lxUserPts, "rgba(8, 145, 178, 0.98)", 2.1, [4, 3], 0.92);
    }
    if (lxOpt.showVertices !== false) {
      lxUserPts.forEach((p) => {
        const c = worldToCanvas(p.x, p.y);
        ctx.beginPath();
        ctx.fillStyle = "rgba(165, 243, 252, 0.95)";
        ctx.strokeStyle = "rgba(21, 94, 117, 0.9)";
        ctx.lineWidth = 1.1;
        ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  /* 4) 쿼리점(말뚝 중앙값 등): 노란 점 */
  if (viz.queryPoint && Number.isFinite(viz.queryPoint.x) && Number.isFinite(viz.queryPoint.y)) {
    const { x, y } = worldToCanvas(viz.queryPoint.x, viz.queryPoint.y);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
    ctx.strokeStyle = "rgba(120, 53, 15, 0.88)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* 5) 탭/캔버스에서 고른 필지: 초록 면 위에서도 보이게 흰 외곽 + 노란 점선 + 꼭짓점(필지·후보 레이어가 켜져 있을 때만) */
  const sel = state.parcelReviewSelection;
  if (viz.showParcelLot !== false && sel && String(sel.pnu || "").trim() !== "") {
    const hiRing = ringForParcelReviewSelection(viz, sel);
    if (hiRing && pilexyNormalizeParcelRingPoints(hiRing).length >= 2) {
      drawParcelSelectionHighlightWorld(hiRing);
    }
  }

  /* 좌하단 범례(우측 패널에 가리지 않음) */
  const { width, height } = getCanvasSize();
  const pad = 10;
  const rowH = 18;
  ctx.save();
  ctx.font = "13px 'Segoe UI', 'Malgun Gothic', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const rows = [];
  if (hasNearby) {
    rows.push({
      c: "rgba(232, 121, 249, 0.96)",
      t: "자홍 실선 = WFS 인접 필지 후보(면 제거·겹침 시 가림 방지)",
    });
  }
  if (hasBonbun) {
    rows.push({
      c: "rgba(56, 189, 248, 0.96)",
      t: "하늘 점선 = 지적 본번 경계(WFS 본번)",
    });
  }
  const lxU = pilexyNormalizeParcelRingPoints(state.parcelReviewLxRegister?.ring);
  if (lxU.length >= 3 && state.parcelReviewLxRegister?.showOutline !== false) {
    rows.push({
      c: "rgba(8, 145, 178, 0.96)",
      t: "청록 점선 = 경계점 좌표등록부(입력)",
    });
  }
  if (
    (viz.lxRegisterEncroachmentRings || []).some((r) => pilexyNormalizeParcelRingPoints(r).length >= 3)
    && state.parcelReviewLxRegister?.showEncroachment !== false
  ) {
    rows.push({
      c: "rgba(234, 88, 12, 0.96)",
      t: "주황 영역 = 등록부 기준 대지 초과(대지−등록부)",
    });
  }
  rows.push(
    { c: "rgba(250, 204, 21, 1)", t: "노란 점 = 쿼리점(검토 기준)" },
    { c: "rgba(74, 222, 128, 0.95)", t: "초록 = 선택 필지(가장 유리한 후보)" },
    { c: "rgba(251, 191, 36, 1)", t: "주황 점선 = 대지 외곽" },
    { c: "rgba(254, 202, 202, 1)", t: "붉은 영역 = 필지 밖" },
  );
  const boxW = 312;
  const boxH = rowH * rows.length + pad * 2;
  /* 우측 패널에 가리지 않도록 좌하단 */
  const x0 = pad;
  const y0 = height - boxH - pad;
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x0, y0, boxW, boxH, 6);
  } else {
    ctx.rect(x0, y0, boxW, boxH);
  }
  ctx.fill();
  ctx.stroke();
  rows.forEach((row, i) => {
    const cy = y0 + pad + rowH * i + rowH / 2;
    ctx.fillStyle = row.c;
    ctx.fillRect(x0 + pad, cy - 5, 12, 10);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(row.t, x0 + pad + 18, cy);
  });
  ctx.restore();
  ctx.restore();
}

function drawPolylineHints() {
  const raw = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
  const cluster = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
  const pickIds = state.buildingOutlinePickMode?.selectedIds;

  function drawPolylineList(polylines, strokeStyle, lineWidth, lineDash, globalAlpha) {
    if (!polylines.length) return;
    ctx.save();
    if (globalAlpha != null) ctx.globalAlpha = globalAlpha;
    ctx.strokeStyle = strokeStyle;
    ctx.setLineDash(lineDash || []);
    ctx.lineWidth = lineWidth ?? 1.5;
    polylines.forEach((polyline) => {
      if (polyline.closed === false) return;
      if (!Array.isArray(polyline.points) || polyline.points.length < 2) return;
      ctx.beginPath();
      polyline.points.forEach((point, index) => {
        const { x, y } = worldToCanvas(point.x, point.y);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawOpenPolylineStroke(polyline, strokeStyle, lineWidth, lineDash) {
    if (!Array.isArray(polyline.points) || polyline.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.setLineDash(lineDash || []);
    ctx.lineWidth = lineWidth ?? 1.2;
    ctx.beginPath();
    polyline.points.forEach((point, index) => {
      const { x, y } = worldToCanvas(point.x, point.y);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // 1) 원이 아닌 기본 폴리라인: 참고용으로만 뒤에 연하게 표시 (선택 불가)
  drawPolylineList(raw, "rgba(148, 163, 184, 0.35)", 1, [8, 6], 0.9);
  // 2) 클러스터(동) 폴리라인: 기존처럼 선만 표시 (실제 선택/편집은 drawBuildings의 동으로)
  drawPolylineList(cluster, "rgba(148, 163, 184, 0.9)", 1.5, [6, 4], 1);

  const rwIds = state.retainingWallPickMode?.selectedIds;
  if (state.retainingWallPickMode) {
    getRetainingWallPolylineRows().forEach((row) => {
      const sel = rwIds && rwIds.has(row.id);
      const stroke = sel ? "rgba(45, 212, 191, 0.98)" : "rgba(148, 163, 184, 0.55)";
      if (row.closed) {
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.setLineDash(sel ? [] : [6, 4]);
        ctx.lineWidth = sel ? 2.4 : 1.1;
        ctx.beginPath();
        row.points.forEach((point, i) => {
          const { x, y } = worldToCanvas(point.x, point.y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else {
        drawOpenPolylineStroke({ points: row.points }, stroke, sel ? 2.4 : 1.1, sel ? [] : [6, 4]);
      }
    });
  } else if (state.buildingOutlinePickMode && raw.length) {
    raw.forEach((polyline, index) => {
      if (polyline.closed !== false) return;
      if (!Array.isArray(polyline.points) || polyline.points.length < 2) return;
      const id = String(polyline?.id ?? polyline?.cluster_id ?? `polyline-${index}`);
      const selBuilding = pickIds && pickIds.has(id);
      const stroke = selBuilding ? "rgba(250, 204, 21, 0.95)" : "rgba(148, 163, 184, 0.55)";
      drawOpenPolylineStroke(polyline, stroke, selBuilding ? 2.4 : 1.1, selBuilding ? [] : [6, 4]);
    });
  }

  if (state.buildingOutlinePickMode && pickIds && pickIds.size && raw.length) {
    raw.forEach((polyline, index) => {
      if (polyline.closed === false) return;
      const id = String(polyline?.id ?? polyline?.cluster_id ?? `polyline-${index}`);
      if (!pickIds.has(id)) return;
      if (!Array.isArray(polyline.points) || polyline.points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([]);
      ctx.beginPath();
      polyline.points.forEach((point, i) => {
        const { x, y } = worldToCanvas(point.x, point.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });
  }
}

function drawBuildings() {
  if (!state.buildings.length) return;
  state.buildings.forEach((building, index) => {
    if (!Array.isArray(building.vertices) || building.vertices.length < 3) return;
    const kind = resolveBuildingOutlineKind(building);
    const hatchOn =
      kind === AREA_KIND_BUILDING
        ? state.showBuildingHatch
        : kind === AREA_KIND_PARKING
          ? state.showParkingHatch
          : state.showTowerCraneHatch;
    if (!hatchOn && !state.buildingEditMode) return;

    ctx.beginPath();
    const color = buildingPalette[index % buildingPalette.length];
    building.vertices.forEach((vertex, vertexIndex) => {
      const point = worldToCanvas(vertex.x, vertex.y);
      if (vertexIndex === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.setLineDash(kind === AREA_KIND_BUILDING ? [] : [10, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = state.buildingEditMode ? 2.4 : 1;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    if (hatchOn) {
      ctx.globalAlpha = kind === AREA_KIND_BUILDING ? 0.08 : 0.05;
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    const centroid = building.vertices.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    centroid.x /= building.vertices.length;
    centroid.y /= building.vertices.length;
    const screen = worldToCanvas(centroid.x, centroid.y);
    ctx.fillStyle =
      kind === AREA_KIND_PARKING ? "#7c2d12" : kind === AREA_KIND_TOWER_CRANE ? "#5b21b6" : "#ff5252";
    ctx.font = "20px 'Segoe UI'";
    ctx.textAlign = "center";
    ctx.fillText(building.name || getDefaultAreaName(kind, index), screen.x, screen.y);
    if (state.buildingEditMode) {
      building.vertices.forEach((vertex) => {
        const point = worldToCanvas(vertex.x, vertex.y);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
    }
  });
}

/** 저장/불러오기 payload의 duplicates 배열을 정규화 (circle_ids/circleIds 등 호환) */
function drawAreaCreationPreview() {
  if (!state.areaRectCreate?.startWorld) return;
  const endWorld = state.areaRectCreate.currentWorld || state.areaRectCreate.startWorld;
  const vertices = buildRectangleVertices(state.areaRectCreate.startWorld, endWorld);
  if (!vertices.length) return;

  ctx.beginPath();
  vertices.forEach((vertex, index) => {
    const point = worldToCanvas(vertex.x, vertex.y);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#22c55e";
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function normalizeDuplicatesFromPayload(duplicates) {
  if (!Array.isArray(duplicates) || !duplicates.length) return duplicates;
  return duplicates.map((g) => {
    const ids = g.circle_ids || g.circleIds || [];
    return { ...g, circle_ids: Array.isArray(ids) ? ids : [] };
  });
}

/** state.duplicates에서 중복 그룹에 포함된 circle id 집합 */
function getDuplicateCircleIds() {
  const set = new Set();
  (state.duplicates || []).forEach((g) => {
    const ids = g.circle_ids || g.circleIds || [];
    (Array.isArray(ids) ? ids : []).forEach((id) => set.add(id));
  });
  return set;
}

function drawCircle(circle, duplicateCircleIds) {
  const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
  const radius = Math.max(0.5, circle.radius * view.scale);
  const isHighlighted = state.highlightedCircleIds.has(circle.id);
  const isRwViz = isRetainingWallVizHighlightCircle(circle.id);
  const isManualSelected = state.manualSelection.circleId === circle.id;
  const isDuplicate = duplicateCircleIds && duplicateCircleIds.has(circle.id);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (isDuplicate && !circle.has_error) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = isRwViz ? "#2dd4bf" : isHighlighted ? "#facc15" : "#fb923c";
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = circle.has_error
      ? "#f97316"
      : isRwViz
        ? "#2dd4bf"
        : isHighlighted
          ? "#facc15"
          : "#38bdf8";
  }
  ctx.lineWidth = isManualSelected ? 4 : isRwViz ? 3 : isHighlighted ? 2 : 1;
  ctx.stroke();
  ctx.setLineDash([]);
  if (isManualSelected) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawCirclePoint(circle) {
  const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
  const isRwViz = isRetainingWallVizHighlightCircle(circle.id);
  const isHighlighted =
    state.highlightedCircleIds.has(circle.id) || hoveredCircleId === circle.id || isRwViz;
  const isManualSelected = state.manualSelection.circleId === circle.id;
  const pointRadius = isManualSelected ? 5 : 3;
  ctx.beginPath();
  ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
  ctx.fillStyle = circle.has_error ? "#fb7185" : isHighlighted ? "#facc15" : "#f8fafc";
  ctx.fill();
  if (isManualSelected) {
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** 중복 좌표인 원의 파일 좌표(중심) 근처에 '중복' 라벨 표기 */
function drawDuplicateLabels(circles, duplicateCircleIds) {
  if (!duplicateCircleIds || !duplicateCircleIds.size) return;
  ctx.save();
  ctx.font = "14px 'Malgun Gothic', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(251, 146, 60, 0.95)";
  circles.forEach((circle) => {
    if (!duplicateCircleIds.has(circle.id)) return;
    const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
    ctx.fillText("중복", x, y + 8);
  });
  ctx.restore();
}

function drawTextLabels() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const texts = getVisibleTexts();
  texts.forEach((text) => {
    const isHighlighted = state.highlightedTextIds.has(text.id);
    const isUnmatched = text.has_error;
    const isPfFoundation = text.foundation_pf_only === true;
    if (isPfFoundation) {
      if (!isFoundationGlyphLayerEnabled()) {
        return;
      }
      const ix = Number(text.insert_x);
      const iy = Number(text.insert_y);
      const cx = Number(text.text_center_x ?? text.center_x);
      const cy = Number(text.text_center_y ?? text.center_y);
      const useInsert = Number.isFinite(ix) && Number.isFinite(iy);
      const { x, y } = worldToCanvas(useInsert ? ix : cx, useInsert ? iy : cy);
      const h = Number(text.height);
      const fontPx = Math.max(4, (Number.isFinite(h) && h > 0 ? h : 1) * view.scale);
      const rotDeg = Number(text.rotation_deg);
      const rad = (Number.isFinite(rotDeg) ? rotDeg : 0) * (Math.PI / 180);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-rad);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `bold ${fontPx}px ui-monospace, Consolas, "Segoe UI", sans-serif`;
      ctx.lineWidth = Math.max(1, fontPx * 0.18);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeText(text.text, 0, 0);
      ctx.fillStyle = isHighlighted ? "#facc15" : "#a7f3d0";
      ctx.fillText(text.text, 0, 0);
      ctx.restore();
    } else if (isUnmatched) {
      const { x, y } = worldToCanvas(text.text_center_x, text.text_center_y);
      const labelY = y - 12;
      ctx.font = "bold 13px 'Segoe UI'";
      ctx.strokeStyle = "rgba(194, 65, 12, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(text.text, x, labelY);
      ctx.fillStyle = isHighlighted ? "#facc15" : "#f97316";
      ctx.fillText(text.text, x, labelY);
    } else {
      const { x, y } = worldToCanvas(text.text_center_x, text.text_center_y);
      const labelY = y - 12;
      ctx.font = "12px 'Segoe UI'";
      ctx.fillStyle = isHighlighted ? "#facc15" : "#cbd5f5";
      ctx.fillText(text.text, x, labelY);
    }
  });
}
function drawTooltip() {
  const parcelCoord = pilexyParcelReviewCoordTooltipModel();
  if (!hoveredCircleId) {
    if (parcelCoord && Array.isArray(parcelCoord.lines) && parcelCoord.lines.length) {
      tooltip.style.left = `${parcelCoord.clientX + 6}px`;
      tooltip.style.top = `${parcelCoord.clientY + 6}px`;
      tooltip.innerHTML = parcelCoord.lines.map((ln) => `<span>${escapeHtml(String(ln))}</span>`).join("<br/>");
      tooltip.classList.remove("hidden");
      return;
    }
    hideTooltip();
    return;
  }
  const circle = state.circleMap.get(hoveredCircleId);
  if (!circle) {
    if (parcelCoord && Array.isArray(parcelCoord.lines) && parcelCoord.lines.length) {
      tooltip.style.left = `${parcelCoord.clientX + 6}px`;
      tooltip.style.top = `${parcelCoord.clientY + 6}px`;
      tooltip.innerHTML = parcelCoord.lines.map((ln) => `<span>${escapeHtml(String(ln))}</span>`).join("<br/>");
      tooltip.classList.remove("hidden");
      return;
    }
    hideTooltip();
    return;
  }
  tooltip.style.left = `${tooltipMouseClientX + 4}px`;
  tooltip.style.top = `${tooltipMouseClientY + 4}px`;
  const displayNumber = getCircleDisplayNumber(circle);
  const areaInfo = getCircleAreaClassification(circle);
  const numberLabel = displayNumber ? `번호 ${displayNumber}` : "번호 미확인";
  const areaStr = circle.area != null ? formatNumber(circle.area) : (circle.radius != null ? formatNumber(Math.PI * circle.radius * circle.radius) : "");
  const compact = pilexyMobileCompactUi();
  if (compact) {
    tooltip.innerHTML = `<strong>${numberLabel}</strong> · ${areaInfo.label}<br />좌표: ${formatNumber(circle.center_x)}, ${formatNumber(circle.center_y)}`;
  } else {
    const geomLine = `Φ ${formatNumber(circle.diameter)} / R ${formatNumber(circle.radius)}${areaStr ? ` / 면적 ${areaStr}` : ""}`;
    tooltip.innerHTML = `<strong>${numberLabel}</strong> · ${areaInfo.label}<br />${geomLine}<br />좌표: ${formatNumber(circle.center_x)}, ${formatNumber(circle.center_y)}`;
  }
  tooltip.classList.remove("hidden");
}

function getCircleAreaClassification(circle) {
  const normalized = normalizeAreaNameForSearch(circle?.building_name);
  const tower = normalized.match(/^T(\d+)$/);
  if (tower) {
    return { kind: AREA_KIND_TOWER_CRANE, label: `타워크레인 ${parseInt(tower[1], 10)}호기` };
  }
  const basement = normalized.match(/^B(\d+)$/);
  if (basement) {
    return { kind: AREA_KIND_PARKING, label: `지하주차장 지하 ${parseInt(basement[1], 10)}층` };
  }
  const building = normalized.match(/^(\d+)동$/);
  if (building) {
    return { kind: AREA_KIND_BUILDING, label: `${parseInt(building[1], 10)}동` };
  }
  if (normalized === "미지정") {
    return { kind: "unspecified", label: "미지정" };
  }
  return { kind: AREA_KIND_BUILDING, label: circle?.building_name || normalized || "미지정" };
}

function getRawMatchedTextFromCircle(circle) {
  const direct = String(circle?.matched_text?.text || "").trim();
  if (direct) return direct;
  const tid = circle?.matched_text_id;
  if (tid != null && tid !== "" && state.textMap?.has(String(tid))) {
    const text = state.textMap.get(String(tid));
    const viaMap = String(text?.text || "").trim();
    if (viaMap) return viaMap;
  }
  return "";
}

function resolveCircleMatchedTextWithDuplicateFallback(circle) {
  const direct = getRawMatchedTextFromCircle(circle);
  if (direct) return direct;
  const circles = state.circles || [];
  for (let i = 0; i < circles.length; i += 1) {
    const candidate = circles[i];
    if (!candidate || candidate.id === circle?.id) continue;
    if (!geometryMatchesCoLocatedDupPolicy(circle, candidate)) continue;
    const raw = getRawMatchedTextFromCircle(candidate);
    if (raw) return raw;
  }
  return "";
}

function getCircleDisplayNumber(circle) {
  const raw = resolveCircleMatchedTextWithDuplicateFallback(circle);
  if (!raw) return null;
  const tower = parseTowerCranePileText(raw);
  if (tower.isTower) return String(tower.seqNum);
  const hyphen = parseHyphenPileText(raw);
  if (hyphen.hasHyphen && Number.isInteger(hyphen.seqNum) && hyphen.seqNum >= 1) {
    return String(hyphen.seqNum);
  }
  const number = getMatchedTextNumber(raw);
  return Number.isInteger(number) && number >= 1 ? String(number) : raw;
}

function updateTooltipPosition() {
  if (hoveredCircleId || pilexyParcelReviewCoordTooltipModel()) {
    drawTooltip();
  }
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

function handleCanvasMouseDown(event) {
  const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
  const { button } = event;
  const construction = state?.construction || null;
  if (state.areaRectCreate && (button === 0 || button === undefined)) {
    const world = canvasToWorld(offsetX, offsetY);
    if (!state.areaRectCreate.startWorld) {
      state.areaRectCreate.startWorld = world;
      state.areaRectCreate.currentWorld = world;
      updateCanvasModeHint();
      requestRedraw();
      return;
    }
    const vertices = buildRectangleVertices(state.areaRectCreate.startWorld, world);
    upsertAreaPolygonByOrder(state.areaRectCreate.kind, state.areaRectCreate.order, vertices);
    const name =
      getAreaNames(state.areaRectCreate.kind)[state.areaRectCreate.order] ||
      getDefaultAreaName(state.areaRectCreate.kind, state.areaRectCreate.order);
    state.areaRectCreate = null;
    updateCanvasModeHint();
    setUploadStatus(`${name} 네모를 생성했습니다. 편집 모드에서 절점을 추가로 조정할 수 있습니다.`);
    requestRedraw();
    return;
  }
  if (state.retainingWallPickMode && (button === 0 || button === undefined)) {
    state.retainingWallPickClick = { x: offsetX, y: offsetY, moved: false };
    return;
  }
  if (state.buildingOutlinePickMode && (button === 0 || button === undefined)) {
    state.buildingOutlinePickClick = { x: offsetX, y: offsetY, moved: false };
    return;
  }
  if (state.buildingEditMode) {
    const hit = hitTestVertex(offsetX, offsetY);
    if (hit) {
      state.draggingVertex = hit;
      return;
    }
    if (button === 0) return;
    if (button === 1) {
      isPanning = true;
      panStart = { x: offsetX, y: offsetY };
    }
    return;
  }
  if (state.manualPickMode === "circle" || state.manualPickMode === "text") {
    handleManualPick(offsetX, offsetY);
    return;
  }
  if (button === 1) {
    isPanning = true;
    panStart = { x: offsetX, y: offsetY };
    mouseDownPos = null;
    if (typeof event?.preventDefault === "function") event.preventDefault();
    return;
  }
  if (button === 0) {
    mouseDownPos = { x: offsetX, y: offsetY };
    isPanning = true;
    panStart = { x: offsetX, y: offsetY };
  }
}

function handleCanvasMouseMove(event) {
  const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
  if (state.buildingOutlinePickClick) {
    const s = state.buildingOutlinePickClick;
    const dx = offsetX - s.x;
    const dy = offsetY - s.y;
    if (dx * dx + dy * dy > 25) s.moved = true;
  }
  if (state.retainingWallPickClick) {
    const s = state.retainingWallPickClick;
    const dx = offsetX - s.x;
    const dy = offsetY - s.y;
    if (dx * dx + dy * dy > 25) s.moved = true;
  }
  if (state.areaRectCreate?.startWorld) {
    state.areaRectCreate.currentWorld = canvasToWorld(offsetX, offsetY);
    requestRedraw();
    return;
  }
  if (state.buildingEditMode && state.draggingVertex !== null) {
    const building = state.buildings[state.draggingVertex.buildingIndex];
    if (building) {
      const world = canvasToWorld(offsetX, offsetY);
      building.vertices[state.draggingVertex.vertexIndex] = { x: world.x, y: world.y };
      requestRedraw();
    }
    return;
  }
  if (isPanning) {
    const dx = offsetX - panStart.x;
    const dy = offsetY - panStart.y;
    view.offsetX -= dx / view.scale;
    view.offsetY += dy / view.scale;
    panStart = { x: offsetX, y: offsetY };
    requestRedraw();
    return;
  }
  const circle = pickCircle(offsetX, offsetY);
  hoveredCircleId = circle?.id || null;
  if (hoveredCircleId) {
    state.parcelReviewCoordHover = null;
    tooltipMouseClientX = event.clientX;
    tooltipMouseClientY = event.clientY;
  } else if (
    state.parcelReviewCoordProbe
    && (state.parcelReviewViz || pilexyParcelReviewLxUserHasGeometry())
  ) {
    state.parcelReviewCoordHover = pickParcelReviewCoordHoverModel(
      offsetX,
      offsetY,
      event.clientX,
      event.clientY,
    );
  } else {
    state.parcelReviewCoordHover = null;
  }
  requestRedraw();
}

function handleCanvasMouseUp(event) {
  const wasPanning = isPanning;
  isPanning = false;
  state.draggingVertex = null;
  if (state.areaRectCreate) {
    mouseDownPos = null;
    return;
  }
  if (
    state.retainingWallPickMode
    && state.retainingWallPickClick
    && (event?.button === 0 || event?.button === undefined)
  ) {
    const start = state.retainingWallPickClick;
    state.retainingWallPickClick = null;
    if (!start.moved) {
      const { x: upX, y: upY } = getCanvasCoordsFromEvent(event);
      const id = pickRetainingWallPolylineIdAtCanvas(upX, upY);
      if (id && state.retainingWallPickMode) {
        if (state.retainingWallPickMode.selectedIds.has(id)) {
          state.retainingWallPickMode.selectedIds.delete(id);
        } else {
          state.retainingWallPickMode.selectedIds.add(id);
        }
        const n = state.retainingWallPickMode.selectedIds.size;
        setUploadStatus(n ? `흙막이 후보 라인 ${n}개 선택됨.` : "선택을 모두 해제했습니다.");
        updateCanvasModeHint();
      } else {
        setUploadStatus("폴리라인 선에 가깝게 클릭하세요.", true);
      }
      requestRedraw();
    }
    mouseDownPos = null;
    return;
  }
  if (
    state.buildingOutlinePickMode
    && state.buildingOutlinePickClick
    && (event?.button === 0 || event?.button === undefined)
  ) {
    const start = state.buildingOutlinePickClick;
    state.buildingOutlinePickClick = null;
    if (!start.moved) {
      const { x: upX, y: upY } = getCanvasCoordsFromEvent(event);
      const id = pickBuildingOutlinePolylineIdAtCanvas(upX, upY);
      if (id && state.buildingOutlinePickMode) {
        if (state.buildingOutlinePickMode.selectedIds.has(id)) {
          state.buildingOutlinePickMode.selectedIds.delete(id);
        } else {
          state.buildingOutlinePickMode.selectedIds.add(id);
        }
        const n = state.buildingOutlinePickMode.selectedIds.size;
        setUploadStatus(
          n ? `폴리라인 ${n}개 선택됨. Enter로 확정하세요.` : "폴리라인을 선택해 주세요.",
        );
        updateCanvasModeHint();
      } else {
        setUploadStatus("선에 가깝게 클릭해 폴리라인을 선택하세요.", true);
      }
      requestRedraw();
    }
    mouseDownPos = null;
    return;
  }
  if (
    event
    && mouseDownPos
    && (event?.button === 0 || event?.button === undefined)
    && !state.buildingEditMode
    && !state.retainingWallPickMode
    && !state.buildingOutlinePickMode
    && state.manualPickMode !== "circle"
    && state.manualPickMode !== "text"
    && state.parcelReviewViz != null
  ) {
    const { x: upX, y: upY } = getCanvasCoordsFromEvent(event);
    const dx = upX - mouseDownPos.x;
    const dy = upY - mouseDownPos.y;
    if (dx * dx + dy * dy < 25) {
      if (state.parcelReviewCoordProbe && pickParcelReviewQueryPointCanvas(upX, upY)) {
        state.parcelReviewCoordPinned =
          state.parcelReviewCoordPinned?.kind === "query" ? null : { kind: "query" };
        setUploadStatus(
          state.parcelReviewCoordPinned
            ? "검토 쿼리점 좌표를 툴팁에 고정했습니다. 노란 점을 다시 클릭하면 해제합니다."
            : "쿼리점 좌표 고정을 해제했습니다.",
        );
        requestRedraw();
        mouseDownPos = null;
        return;
      }
      const hit = pickParcelReviewRingAtCanvas(upX, upY);
      if (hit && String(hit.pnu || "").trim() !== "") {
        state.parcelReviewSelection = { pnu: String(hit.pnu), isWinner: Boolean(hit.isWinner) };
        setUploadStatus(`필지 선택: PNU ${hit.pnu}${hit.isWinner ? " (연속지적 승자)" : " (인접 후보)"}`);
        try {
          window.dispatchEvent(
            new CustomEvent("pilexy-parcel-review-select", { detail: { pnu: hit.pnu, isWinner: hit.isWinner } }),
          );
        } catch (_) {
          /* ignore */
        }
        requestRedraw();
        mouseDownPos = null;
        return;
      }
      const hadSel = state.parcelReviewSelection != null;
      state.parcelReviewSelection = null;
      if (hadSel) {
        try {
          window.dispatchEvent(new CustomEvent("pilexy-parcel-review-select", { detail: { cleared: true } }));
        } catch (_) {
          /* ignore */
        }
        requestRedraw();
      }
    }
  }
  if (event && mouseDownPos && !state.buildingEditMode && state.buildings.length > 0) {
    const { x: upX, y: upY } = getCanvasCoordsFromEvent(event);
    const dx = upX - mouseDownPos.x;
    const dy = upY - mouseDownPos.y;
    if (dx * dx + dy * dy < 25) {
      const buildingIndex = hitTestBuildingFill(upX, upY);
      if (buildingIndex >= 0 && shouldScrollAreaListOnCanvasClick(buildingIndex)) {
        scrollToBuildingInList(buildingIndex);
      }
    }
  }
  mouseDownPos = null;
}

function handleCanvasTouchStart(e) {
  if (!e.touches || e.touches.length === 0) return;
  if (e.touches.length >= 2) {
    isPinching = true;
    isPanning = false;
    const pinch = getPinchStateMain(e.touches);
    if (pinch) {
      pinchStartDist = pinch.dist;
      pinchStartCenter = { x: pinch.centerX, y: pinch.centerY };
      pinchStartScale = view.scale;
      pinchWorldAnchor = canvasToWorld(pinch.centerX, pinch.centerY);
    }
    return;
  }
  if (e.touches.length === 1) {
    isPinching = false;
    const ev = touchToMouseLike(e, false);
    if (ev) handleCanvasMouseDown(ev);
  }
}

function handleCanvasTouchMove(e) {
  if (!e.touches || e.touches.length === 0) return;
  if (e.touches.length >= 2 && isPinching && pinchWorldAnchor) {
    e.preventDefault();
    const pinch = getPinchStateMain(e.touches);
    if (!pinch || pinchStartDist <= 0) return;
    const scaleFactor = pinch.dist / pinchStartDist;
    const newScale = Math.max(VIEW_SCALE_MIN, Math.min(VIEW_SCALE_MAX, pinchStartScale * scaleFactor));
    view.scale = newScale;
    view.offsetX = pinchWorldAnchor.x - (pinch.centerX - getCanvasSize().width / 2) / view.scale;
    view.offsetY = pinchWorldAnchor.y - (getCanvasSize().height / 2 - pinch.centerY) / view.scale;
    requestRedraw();
    return;
  }
  if (e.touches.length === 1) {
    if (isPinching) {
      isPinching = false;
      const ev = touchToMouseLike(e, false);
      if (ev) {
        const { x, y } = getCanvasCoordsFromEvent(ev);
        panStart = { x, y };
        isPanning = true;
      }
    }
    const ev = touchToMouseLike(e, false);
    if (ev) {
      handleCanvasMouseMove(ev);
      if (isPanning) e.preventDefault();
    }
  }
}

function handleCanvasTouchEnd(e) {
  if (e.touches.length === 2) return;
  if (e.touches.length < 2) isPinching = false;
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  if (e.touches.length === 0) {
    const ev = touchToMouseLike(e, true);
    if (ev) handleCanvasMouseUp(ev);
  }
}

function handleCanvasWheel(event) {
  event.preventDefault();
  const { width, height } = getCanvasSize();
  const dy = wheelDeltaYPixels(event, height);
  const { x: mouseX, y: mouseY } = getCanvasCoordsFromEvent(event);
  const nextScale = view.scale * Math.exp(-dy * 0.0012);
  zoomViewAtCanvasPoint(view, width, height, mouseX, mouseY, nextScale, VIEW_SCALE_MIN, VIEW_SCALE_MAX);
  requestRedraw();
}

function handleCanvasDoubleClick(event) {
  if (state.areaRectCreate) return;
  if (state.buildingOutlinePickMode) return;
  if (state.retainingWallPickMode) return;
  if (!state.buildingEditMode) return;
  const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
  const hit = hitTestVertex(offsetX, offsetY);
  if (hit) {
    const building = state.buildings[hit.buildingIndex];
    if (building?.vertices?.length > 3) {
      building.vertices.splice(hit.vertexIndex, 1);
    }
  } else {
    const world = canvasToWorld(offsetX, offsetY);
    const closest = findClosestBuildingEdge(world, 30);
    if (closest) {
      const building = state.buildings[closest.buildingIndex];
      if (building?.vertices) {
        if (building.vertices.length < 2) {
          building.vertices.push(world);
        } else {
          building.vertices.splice(closest.insertIndex + 1, 0, world);
        }
      }
    }
  }
  requestRedraw();
}
function hitTestVertex(offsetX, offsetY) {
  let closest = null;
  const threshold = 18;
  state.buildings.forEach((building, buildingIndex) => {
    if (!building || !Array.isArray(building.vertices)) return;
    building.vertices.forEach((vertex, vertexIndex) => {
      const point = worldToCanvas(vertex.x, vertex.y);
      const distance = Math.hypot(point.x - offsetX, point.y - offsetY);
      if (distance <= threshold && (!closest || distance < closest.distance)) {
        closest = { buildingIndex, vertexIndex, distance };
      }
    });
  });
  return closest;
}

function findClosestEdgeIndex(vertices, point) {
  let closestIndex = 0;
  let minDistance = Infinity;
  vertices.forEach((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const distance = pointToSegmentDistance(point, vertex, next);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
}

/**
 * 클릭 위치에서 가장 가까운 동(건물)의 변(edge)을 찾는다.
 * @param {Object} worldPoint - 월드 좌표 { x, y }
 * @param {number} pixelThreshold - 허용 거리(픽셀). 이 거리 안의 동 라인만 대상.
 * @returns {{ buildingIndex: number, insertIndex: number } | null}
 */
function findClosestBuildingEdge(worldPoint, pixelThreshold) {
  const threshold = (pixelThreshold ?? 30) / view.scale;
  let best = null;
  state.buildings.forEach((building, buildingIndex) => {
    if (!building?.vertices?.length) return;
    if (building.vertices.length < 2) return;
    const insertIndex = findClosestEdgeIndex(building.vertices, worldPoint);
    const start = building.vertices[insertIndex];
    const end = building.vertices[(insertIndex + 1) % building.vertices.length];
    const distance = pointToSegmentDistance(worldPoint, start, end);
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { buildingIndex, insertIndex, distance };
    }
  });
  return best ? { buildingIndex: best.buildingIndex, insertIndex: best.insertIndex } : null;
}

function closestPointOnSegment(point, start, end) {
  const ax = start.x;
  const ay = start.y;
  const bx = end.x;
  const by = end.y;
  const px = point.x;
  const py = point.y;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const magnitude = abx * abx + aby * aby || 1;
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / magnitude));
  return { x: ax + abx * t, y: ay + aby * t, t };
}

function pointToSegmentDistance(point, start, end) {
  const q = closestPointOnSegment(point, start, end);
  return Math.hypot(point.x - q.x, point.y - q.y);
}

function pickCircle(offsetX, offsetY, pixelTolerance = 20) {
  for (let index = state.circles.length - 1; index >= 0; index -= 1) {
    const circle = state.circles[index];
    const screen = worldToCanvas(circle.center_x, circle.center_y);
    const distance = Math.hypot(screen.x - offsetX, screen.y - offsetY);
    if (distance <= pixelTolerance) {
      return circle;
    }
  }
  return null;
}

function pickText(offsetX, offsetY, pixelTolerance = 20) {
  for (let index = state.texts.length - 1; index >= 0; index -= 1) {
    const text = state.texts[index];
    if (text.foundation_pf_only === true) {
      const ix = Number(text.insert_x);
      const iy = Number(text.insert_y);
      const cx = Number(text.text_center_x ?? text.center_x);
      const cy = Number(text.text_center_y ?? text.center_y);
      const wx = Number.isFinite(ix) ? ix : cx;
      const wy = Number.isFinite(iy) ? iy : cy;
      const h = Number(text.height) || 1;
      const wlen = String(text.text || "").length;
      const lenWorld = Math.max(h * Math.max(wlen, 1) * 0.62, h * 1.2);
      const rotDeg = Number(text.rotation_deg);
      const wr = (Number.isFinite(rotDeg) ? rotDeg : 0) * (Math.PI / 180);
      const start = worldToCanvas(wx, wy);
      const end = worldToCanvas(wx + lenWorld * Math.cos(wr), wy + lenWorld * Math.sin(wr));
      const dSeg = pointToSegmentDistance({ x: offsetX, y: offsetY }, start, end);
      const tol = Math.max(pixelTolerance, h * view.scale * 0.55);
      if (dSeg <= tol) {
        return text;
      }
      continue;
    }
    const screen = worldToCanvas(text.text_center_x, text.text_center_y);
    const distance = Math.hypot(screen.x - offsetX, screen.y - offsetY);
    if (distance <= pixelTolerance) {
      return text;
    }
  }
  return null;
}

function handleManualPick(offsetX, offsetY) {
  if (state.manualPickMode === "circle") {
    const circle = pickCircle(offsetX, offsetY, 34);
    if (circle) {
      setManualCircleSelection(circle.id, false);
    }
    return;
  }
  if (state.manualPickMode === "text") {
    const text = pickText(offsetX, offsetY, 38);
    if (text) {
      setManualTextSelection(text.id);
    }
  }
}

function updateManualPickButtonStyles() {
  manualPickCircleBtn.classList.toggle("ghost", state.manualPickMode !== "circle");
  manualPickTextBtn.classList.toggle("ghost", state.manualPickMode !== "text");
}

function activateManualPick(mode) {
  if (!state.hasDataset) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }
  state.manualPickMode = state.manualPickMode === mode ? null : mode;
  updateManualPickButtonStyles();
}

function updateManualSelectionDisplay() {
  manualCircleValue.textContent = state.manualSelection.circleId || "-";
  if (state.manualSelection.textId) {
    const record = state.textMap.get(state.manualSelection.textId);
    manualTextValue.textContent = record
      ? `${state.manualSelection.textId} (${record.text})`
      : state.manualSelection.textId;
  } else {
    manualTextValue.textContent = "-";
  }
}

function setManualCircleSelection(circleId, focusCircle = false) {
  state.manualSelection.circleId = circleId || "";
  state.manualPickMode = null;
  updateManualSelectionDisplay();
  updateManualPickButtonStyles();
  if (circleId) {
    setHighlightedCircles([circleId], focusCircle);
  } else {
    state.highlightedCircleIds.clear();
  }
  requestRedraw();
}

function setManualTextSelection(textId) {
  state.manualSelection.textId = textId || "";
  state.manualPickMode = null;
  if (textId) {
    state.highlightedTextIds = new Set([textId]);
  } else {
    state.highlightedTextIds.clear();
  }
  updateManualSelectionDisplay();
  updateManualPickButtonStyles();
  requestRedraw();
}

function resetManualSelection() {
  state.manualSelection = { circleId: "", textId: "" };
  state.manualPickMode = null;
  state.highlightedCircleIds.clear();
  state.highlightedTextIds.clear();
  updateManualSelectionDisplay();
  updateManualPickButtonStyles();
  requestRedraw();
}

function handleManualClear() {
  resetManualSelection();
  requestRedraw();
}

/**
 * 수동 매칭 적용 핸들러
 * 
 * 요구사항:
 * - 매칭 적용 후 화면 컨텍스트(스크롤, 필터, 선택) 유지
 * - 부분 업데이트로 연속성 보장
 */
async function handleManualApply() {
  const { circleId, textId } = state.manualSelection;
  if (!circleId || !textId) {
    setUploadStatus("좌표와 텍스트를 모두 선택하세요.", true);
    return;
  }

  const prevManualOverridesForSync = { ...state.manualOverrides };
  const preMatchCircleFp = fingerprintMapFromCircles(state.circles);

  // 현재 상태 저장 (화면 컨텍스트 유지용)
  const currentScrollPosition = window.scrollY;
  const currentBuildingFilter = state.activeBuildingFilter;
  const currentHighlightedCircles = new Set(state.highlightedCircleIds);
  const currentHighlightedTexts = new Set(state.highlightedTextIds);
  
  const btn = manualApplyBtn;
  if (btn) btn.disabled = true;
  try {
    setUploadStatus("매칭 적용 중...");
    const body = {
      circle_id: circleId,
      text_id: textId,
      filter: {
        min_diameter: state.filter.minDiameter,
        max_diameter: state.filter.maxDiameter,
        text_height_min: state.filter.textHeightMin,
        text_height_max: state.filter.textHeightMax,
        max_match_distance: state.filter.maxMatchDistance,
        text_reference_point: state.filter.textReferencePoint || "center",
      },
    };
    const response = await fetch(`${API_BASE_URL}/api/manual-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const payload = await response.json();

    const payloadHasCircles = Array.isArray(payload.circles) && payload.circles.length > 0;
    const hadCircles = state.circles.length > 0;

    if (payloadHasCircles) {
      // 서버가 정상적으로 circles를 돌려주면 그대로 반영
      state.circles = payload.circles;
      state.circleMap = new Map(state.circles.map((c) => [c.id, c]));
      if (payload.texts) {
        state.texts = Array.isArray(payload.texts) ? payload.texts : [];
        state.textMap = new Map(state.texts.map((t) => [t.id, t]));
      }
    } else if (hadCircles) {
      // 서버가 빈 배열을 준 경우(불러오기 후 등): 기존 화면 유지, 선택한 매칭만 로컬 반영
      const circle = state.circleMap.get(circleId);
      const text = state.textMap.get(textId);
      if (circle && text) {
        const dx = (circle.center_x || 0) - (text.text_center_x ?? text.center_x ?? 0);
        const dy = (circle.center_y || 0) - (text.text_center_y ?? text.center_y ?? 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        circle.matched_text = {
          id: text.id,
          text: text.text,
          insert_x: text.insert_x,
          insert_y: text.insert_y,
          insert_z: text.insert_z ?? 0,
          center_x: text.center_x ?? text.text_center_x,
          center_y: text.center_y ?? text.text_center_y,
          text_center_x: text.text_center_x ?? text.center_x,
          text_center_y: text.text_center_y ?? text.center_y,
          height: text.height,
          distance,
        };
        circle.matched_text_id = text.id;
        circle.matched_text_distance = distance;
        circle.has_error = false;
        circle.error_codes = [];
        circle.manual_match = true;
        text.has_error = false;
      }
      if (payload.summary) state.summary = payload.summary;
    } else {
      if (payload.circles) {
        state.circles = Array.isArray(payload.circles) ? payload.circles : [];
        state.circleMap = new Map(state.circles.map((c) => [c.id, c]));
      }
      if (payload.texts) {
        state.texts = Array.isArray(payload.texts) ? payload.texts : [];
        state.textMap = new Map(state.texts.map((t) => [t.id, t]));
      }
    }

    if (payload.summary) state.summary = payload.summary;

    rebuildManualOverridesFromCircles();
    refreshMatchDerivedUIState();

    state.activeBuildingFilter = currentBuildingFilter;
    state.highlightedCircleIds = currentHighlightedCircles;
    state.highlightedTextIds = currentHighlightedTexts;

    updateSummaryCards();
    updateCircleTable();
    updateDuplicatesTable();
    updateErrorsTable();
    renderBuildingTabs();

    requestAnimationFrame(() => {
      window.scrollTo(0, currentScrollPosition);
    });

    requestRedraw();

    const changedCircleIdsForSave = collectCircleIdsWithDifferentFingerprint(
      preMatchCircleFp,
      state.circles
    );
    const synced = await syncManualMatchDeltaToServer(
      prevManualOverridesForSync,
      "매칭이 적용되었습니다.",
      changedCircleIdsForSave
    );
    if (!synced) {
      setUploadStatus("매칭이 적용되었습니다. (서버 동기화 실패 — 연결을 확인하세요)", true);
    }

    // 선택 상태는 유지 (handleManualClear 호출 안 함)
    // 사용자가 계속 작업할 수 있도록 선택 상태 유지
  } catch (error) {
    console.error(error);
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * 수동 매칭 해체 핸들러
 * 
 * 요구사항:
 * - 매칭을 실제로 해제
 * - 화면 컨텍스트(스크롤, 필터, 선택) 유지
 * - 부분 업데이트로 연속성 보장
 */
async function handleManualRemoveLink() {
  const { circleId } = state.manualSelection;
  if (!circleId) {
    setUploadStatus("매칭을 삭제할 좌표를 선택하세요.", true);
    return;
  }

  const prevManualOverridesForSync = { ...state.manualOverrides };
  const preRemoveCircleFp = fingerprintMapFromCircles(state.circles);

  // 현재 상태 저장 (화면 컨텍스트 유지용)
  const currentScrollPosition = window.scrollY;
  const currentBuildingFilter = state.activeBuildingFilter;
  const btn = manualRemoveLinkBtn;
  if (btn) btn.disabled = true;
  try {
    setUploadStatus("매칭 해제 중...");
    const response = await fetch(`${API_BASE_URL}/api/manual-match/${circleId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const payload = await response.json();

    const payloadHasCircles = Array.isArray(payload.circles) && payload.circles.length > 0;
    const hadCircles = state.circles.length > 0;

    if (payloadHasCircles) {
      state.circles = payload.circles;
      state.circleMap = new Map(state.circles.map((c) => [c.id, c]));
      if (payload.texts) {
        state.texts = Array.isArray(payload.texts) ? payload.texts : [];
        state.textMap = new Map(state.texts.map((t) => [t.id, t]));
      }
    } else if (hadCircles) {
      const circle = state.circleMap.get(circleId);
      if (circle) {
        const prevTextId = circle.matched_text_id;
        circle.matched_text = null;
        circle.matched_text_id = null;
        circle.matched_text_distance = null;
        circle.manual_match = false;
        circle.has_error = true;
        circle.error_codes = ["CIRCLE_NO_MATCH"];
        if (prevTextId) {
          const text = state.textMap.get(prevTextId);
          const othersWithSameText = state.circles.filter((c) => c.matched_text_id === prevTextId);
          if (text) {
            text.has_error = othersWithSameText.length === 0;
          }
          if (othersWithSameText.length === 1) {
            const soleCircle = othersWithSameText[0];
            soleCircle.has_error = false;
            soleCircle.error_codes = [];
          }
          if (othersWithSameText.length <= 1) {
            state.errors = state.errors.filter((err) => !(err.error_type === "TEXT_MULTI_MATCH" && err.text_id === prevTextId));
          }
        }
        state.errors = state.errors.filter((err) => !(Array.isArray(err.circle_ids) && err.circle_ids.includes(circleId)));
        state.errors.push({
          error_type: "CIRCLE_NO_MATCH",
          text_id: null,
          text_value: null,
          circle_ids: [circleId],
          message: `Circle ${circleId} has no matching TEXT.`,
        });
        if (state.summary && typeof state.summary.matched_pairs === "number") {
          state.summary.matched_pairs = state.circles.filter((c) => c.matched_text_id).length;
        }
      }
      if (payload.summary) state.summary = payload.summary;
    } else {
      if (payload.circles) {
        state.circles = Array.isArray(payload.circles) ? payload.circles : [];
        state.circleMap = new Map(state.circles.map((c) => [c.id, c]));
      }
      if (payload.texts) {
        state.texts = Array.isArray(payload.texts) ? payload.texts : [];
        state.textMap = new Map(state.texts.map((t) => [t.id, t]));
      }
    }

    if (payload.summary && payloadHasCircles) state.summary = payload.summary;

    rebuildManualOverridesFromCircles();
    refreshMatchDerivedUIState();

    state.activeBuildingFilter = currentBuildingFilter;

    updateSummaryCards();
    updateCircleTable();
    updateDuplicatesTable();
    updateErrorsTable();
    renderBuildingTabs();

    requestAnimationFrame(() => {
      window.scrollTo(0, currentScrollPosition);
    });

    requestRedraw();

    const changedCircleIdsForSave = collectCircleIdsWithDifferentFingerprint(
      preRemoveCircleFp,
      state.circles
    );
    const synced = await syncManualMatchDeltaToServer(
      prevManualOverridesForSync,
      "매칭이 해제되었습니다.",
      changedCircleIdsForSave
    );
    if (!synced) {
      setUploadStatus("매칭이 해제되었습니다. (서버 동기화 실패 — 연결을 확인하세요)", true);
    }
  } catch (error) {
    console.error(error);
    setUploadStatus(parseErrorMessage(error), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function triggerDownload(format) {
  if (!state.hasDataset) {
    setUploadStatus("다운로드 전에 DXF를 업로드하세요.", true);
    return false;
  }
  if (!state.circles || state.circles.length === 0) {
    setUploadStatus("다운로드할 좌표 데이터가 없습니다.", true);
    return false;
  }
  // 동 윤곽선 적용된 현재 화면 데이터로 내보내기 (POST)
  const params = new URLSearchParams({ format });
  if (downloadCsvBtn) downloadCsvBtn.disabled = true;
  if (downloadXlsxBtn) downloadXlsxBtn.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/circles/export?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circles: state.circles,
        texts: state.texts || [],
        errors: state.errors || [],
        buildings: serializeBuildingDefinitions(state.buildings || []),
      }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "csv" ? "circles.csv" : "circles.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error(error);
    setUploadStatus(parseErrorMessage(error), true);
    return false;
  } finally {
    if (downloadCsvBtn) downloadCsvBtn.disabled = false;
    if (downloadXlsxBtn) downloadXlsxBtn.disabled = false;
  }
}

function parseErrorMessage(error) {
  if (typeof error === "string") return error;
  if (error?.message) {
    const parsed = tryParseJson(error.message);
    if (parsed && typeof parsed === "object" && (parsed.detail || parsed.message)) {
      return parsed.detail || parsed.message;
    }
    return error.message;
  }
  return "Unexpected error";
}

function formatNumber(value, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(fractionDigits);
}

/**
 * 클러스터링 설정값을 읽어옵니다.
 */
function getClusteringSetting(key, defaultValue) {
  switch (key) {
    case "maxDistanceFromSeed":
      return Number(maxDistanceSeedInput?.value) || 30;
    case "mergeSeedDistance":
      return Number(mergeSeedDistanceInput?.value) || 20;
    default:
      return defaultValue;
  }
}

function syncBuildingOutlineAutoUi() {
  if (generateBuildingOutlinesBtn) {
    generateBuildingOutlinesBtn.style.display = hasAnyAutoBuildingOutlineFromClusters() ? "" : "none";
  }
}

/**
 * 클러스터링 설정 패널 토글
 */
function toggleClusteringSettings() {
  const isVisible = clusteringSettingsContent.style.display !== "none";
  clusteringSettingsContent.style.display = isVisible ? "none" : "block";
  toggleClusteringSettingsBtn.textContent = isVisible ? "펼치기" : "접기";
}

/**
 * 클러스터링 설정 적용 및 재계산
 */
async function handleApplyClusteringSettings() {
  if (!state.hasDataset || !state.circles.length) {
    setUploadStatus("DXF 데이터가 필요합니다.", true);
    return;
  }

  const count = Math.max(
    1,
    getConfiguredAreaCount(AREA_KIND_BUILDING),
  );

  const btn = applyClusteringSettingsBtn;
  if (btn) btn.disabled = true;
  try {
    const refreshed = await refreshClustersForCount(count, true);
    if (refreshed) {
      setUploadStatus("클러스터링 설정이 적용되었습니다.");
      requestRedraw();
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * 작업 저장/불러오기 (맨 위 저장·불러오기 버튼)
 * - 제목: 업로드한 DXF 파일명 (또는 저장 시점 기본 제목)
 * - 날짜·일시 저장
 * - 설정값: 객체(파일) 높낮이, 텍스트 높낮이, 동 윤곽선(클러스터링) 설정 포함
 */

/** 중앙 저장 API: 목록 조회 */
async function getSavedWorksList() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saved-works`);
    if (!response.ok) throw new Error(response.statusText);
    const list = await response.json();
    return Array.isArray(list) ? list.map(normalizeSavedWorkItem) : [];
  } catch (e) {
    console.error("저장 목록 읽기 실패:", e);
    return [];
  }
}

/** 불러오기 패널: 캐시 및 선택된 프로젝트 */
let savedWorksCache = [];
let selectedLoadProject = null;
let selectedLoadSourceType = LOAD_WORK_SOURCE_ALL;
let versionCompareExcelInspection = null;
let versionCompareExcelSelectionState = {
  activeField: "building",
  selectedSheets: [],
  buildingSourceMode: "sheet",
  /** 시트명 → 헤더 행(1-based). 시트마다 레이아웃이 다를 때 비교 시 각각 적용 */
  headerRowBySheet: {},
  /** 번호/X/Y 열 헤더 셀에 보이는 글자 — 시트마다 헤더 행을 이 글자로 자동 탐지 */
  headerMarkers: { number: "", x: "", y: "" },
};
let versionCompareExcelIssueFilter = "all";
let versionCompareExcelLastResult = null;
let versionCompareExcelLastRenderOptions = {};
const VERSION_COMPARE_EXCEL_SEVERE_DIFF_THRESHOLD = 0.75;
setVersionCompareExcelBuildingSourceMode(versionCompareExcelSelectionState.buildingSourceMode, { updateSuggestions: false });

function normalizeLoadWorkProjectName(item) {
  return normalizeProjectName(item?.project);
}

function normalizeSavedWorkItem(item) {
  return {
    ...item,
    project: normalizeProjectName(item?.project),
    sourceType: normalizeSourceType(item?.sourceType),
  };
}

function getLoadWorkSourceTypes(projectName) {
  if (!projectName) return [];
  const seen = new Set();
  savedWorksCache.forEach((item) => {
    if (normalizeLoadWorkProjectName(item) !== projectName) return;
    seen.add(normalizeSourceType(item.sourceType));
  });
  return SOURCE_TYPE_OPTIONS.filter((option) => seen.has(option.value));
}

function savedWorkTimestampMs(item) {
  if (!item || !item.timestamp) return 0;
  const d = new Date(item.timestamp);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function maxTimestampForProjectInList(projectName, worksList) {
  let max = 0;
  for (const item of worksList) {
    if (normalizeLoadWorkProjectName(item) === projectName) {
      const t = savedWorkTimestampMs(item);
      if (t > max) max = t;
    }
  }
  return max;
}

function maxTimestampForLoadWorkProject(projectName) {
  return maxTimestampForProjectInList(projectName, savedWorksCache);
}

function formatLoadWorkPanelDate(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pruneLoadWorkFavorites() {
  const nameSet = new Set(savedWorksCache.map(normalizeLoadWorkProjectName));
  const favP = loadFavoriteProjectNames();
  const nextP = favP.filter((n) => nameSet.has(n));
  if (nextP.length !== favP.length) saveFavoriteProjectNames(nextP);

  const idSet = new Set(savedWorksCache.map((i) => i.id).filter(Boolean));
  const favW = loadFavoriteWorkIds();
  const nextW = favW.filter((id) => idSet.has(id));
  if (nextW.length !== favW.length) saveFavoriteWorkIds(nextW);
}

function savedWorkMatchesVersionSearch(item, qNorm) {
  if (!qNorm) return true;
  const blob = [
    item.title,
    item.author,
    item.sourceFileName,
    getSourceTypeLabel(item.sourceType),
    item.id,
    savedWorkTimestampMs(item) ? formatLoadWorkPanelDate(savedWorkTimestampMs(item)) : "",
  ]
    .filter((x) => x != null && String(x).length)
    .join("\u0000")
    .toLowerCase();
  return blob.includes(qNorm);
}

async function refetchLoadWorkCache() {
  savedWorksCache = (await getSavedWorksList()).map(normalizeSavedWorkItem);
  pruneLoadWorkFavorites();
  rebuildManualHistoryReferenceWorkSelectOptions();
  return savedWorksCache;
}

/** 수동 매칭 재사용: 저장 작업 목록으로 참고 버전 셀렉트 채움 */
function rebuildManualHistoryReferenceWorkSelectOptions() {
  if (!manualHistoryReferenceWorkSelect) return;
  const prev = state.manualHistoryReferenceWorkId;
  const list = Array.isArray(savedWorksCache) ? savedWorksCache : [];
  manualHistoryReferenceWorkSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— 저장 작업 버전 선택 —";
  manualHistoryReferenceWorkSelect.appendChild(ph);
  const sorted = [...list].sort((a, b) => savedWorkTimestampMs(b) - savedWorkTimestampMs(a));
  sorted.forEach((item) => {
    if (!item || !item.id) return;
    const opt = document.createElement("option");
    opt.value = item.id;
    const title = String(item.title || "").trim() || "(제목 없음)";
    const d = formatLoadWorkPanelDate(savedWorkTimestampMs(item));
    const st = getSourceTypeLabel(item.sourceType);
    opt.textContent = `${item.project} · ${title} · ${st}${d ? " · " + d : ""}`;
    manualHistoryReferenceWorkSelect.appendChild(opt);
  });
  const pick =
    (prev && sorted.some((i) => i.id === prev) && prev) ||
    (state.loadedWorkId && sorted.some((i) => i.id === state.loadedWorkId) && state.loadedWorkId) ||
    "";
  if (pick) {
    state.manualHistoryReferenceWorkId = pick;
    manualHistoryReferenceWorkSelect.value = pick;
  } else {
    state.manualHistoryReferenceWorkId = null;
    manualHistoryReferenceWorkSelect.value = "";
  }
  manualHistoryReferenceWorkSelect.disabled = !state.reuseManualHistory;
}

/**
 * 수동 매칭 플래그: 저장 JSON에 명시된 manual_match === true 만 유지.
 * (manualOverrides와 matched_text_id만 일치한다고 수동 처리하면 잘못된 자동 매칭이 필터 적용 후에도 고정됨)
 */
function syncManualMatchFlagsAfterLoad() {
  const apply = (c) => {
    if (c && c.manual_match !== true) {
      c.manual_match = false;
    }
  };
  (state.circles || []).forEach(apply);
  if (state.sourceCircles) state.sourceCircles.forEach(apply);
}

/** circles 기준으로 수동 매칭 맵 갱신(수동 적용/해제 직후) */
function rebuildManualOverridesFromCircles() {
  const next = {};
  (state.circles || []).forEach((c) => {
    if (c.matched_text_id && c.manual_match === true) {
      next[c.id] = c.matched_text_id;
    }
  });
  state.manualOverrides = next;
}

/** 저장 직전: manual_match 플래그 + 기존 맵을 합쳐 누락 방지 */
function computeManualOverridesForSave() {
  const next = {};
  (state.circles || []).forEach((c) => {
    if (c.matched_text_id && c.manual_match === true) {
      next[c.id] = c.matched_text_id;
    }
  });
  Object.entries(state.manualOverrides || {}).forEach(([cid, tid]) => {
    if (next[cid]) return;
    const c = state.circleMap.get(cid);
    if (c && c.matched_text_id === tid) next[cid] = tid;
  });
  return next;
}

/** 현재 화면 상태 + 설정값을 저장용 객체로 수집 */
function collectCurrentStateForSave() {
  const filterValues = getFilterValuesFromInputs();
  const filter = filterValues
    ? {
        minDiameter: filterValues.minDiameter,
        maxDiameter: filterValues.maxDiameter,
        textHeightMin: filterValues.textHeightMin,
        textHeightMax: filterValues.textHeightMax,
        maxMatchDistance: filterValues.maxMatchDistance,
        textReferencePoint: filterValues.textReferencePoint,
        pileNumberHyphenFormat: !!filterValues.pileNumberHyphenFormat,
        towerCraneNumberFormat: !!filterValues.towerCraneNumberFormat,
        excludeIdenticalGeometryDuplicates: !!filterValues.excludeIdenticalGeometryDuplicates,
      }
    : { ...state.filter };

  const manualOverrides = computeManualOverridesForSave();
  state.manualOverrides = manualOverrides;

  return {
    title: state.lastUploadedFileName || `저장_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`,
    sourceFileName: state.lastUploadedFileName || null,
    project: getActiveProjectName(),
    sourceType: getActiveSourceType(),
    timestamp: new Date().toISOString(),
    filter,
    clustering: {
      maxDistanceFromSeed: getClusteringSetting("maxDistanceFromSeed", 30),
      mergeSeedDistance: getClusteringSetting("mergeSeedDistance", 20),
      autoBuildingOutlineByOrder: [...(state.autoBuildingOutlineByOrder || [])],
    },
    autoBuildingOutlineByOrder: [...(state.autoBuildingOutlineByOrder || [])],
    summary: state.summary,
    buildingSummary: state.buildingSummary || [],
    circles: state.circles,
    texts: state.texts,
    duplicates: state.duplicates,
    errors: state.errors,
    clusterPolylines: state.clusterPolylines || [],
    rawPolylines: state.rawPolylines || [],
    pileClusters: state.pileClusters || [],
    buildings: serializeBuildingDefinitions(state.buildings || []),
    pendingNames: [...(state.pendingNames || [])],
    pendingParkingNames: [...(state.pendingParkingNames || [])],
    pendingTowerCraneNames: [...(state.pendingTowerCraneNames || [])],
    pendingDrillingElevationsBuilding: [...(state.pendingDrillingElevationsBuilding || [])],
    pendingDrillingElevationsParking: [...(state.pendingDrillingElevationsParking || [])],
    pendingDrillingElevationsTowerCrane: [...(state.pendingDrillingElevationsTowerCrane || [])],
    pendingFoundationTopBuilding: [...(state.pendingFoundationTopBuilding || [])],
    pendingFoundationTopParking: [...(state.pendingFoundationTopParking || [])],
    pendingFoundationTopTowerCrane: [...(state.pendingFoundationTopTowerCrane || [])],
    foundationThicknessByPileId: { ...(state.foundationThicknessByPileId || {}) },
    foundationPitOffsetByPileId: { ...(state.foundationPitOffsetByPileId || {}) },
    drillingStartByPileId: { ...(state.drillingStartByPileId || {}) },
    foundationTopByPileId: { ...(state.foundationTopByPileId || {}) },
    buildingCount: getConfiguredAreaCount(AREA_KIND_BUILDING),
    parkingAreaCount: getConfiguredAreaCount(AREA_KIND_PARKING),
    towerAreaCount: getConfiguredAreaCount(AREA_KIND_TOWER_CRANE),
    manualOverrides,
    matchCorrections: state.matchCorrections || [],
  };
}

function cloneForSaveJson(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** 수동 매칭 1회 적용·해제 시 디스크에 반영할 원만 골라내기 위한 비교용 지문 */
function circleMatchSaveFingerprint(c) {
  if (!c || !c.id) return "";
  const ec = Array.isArray(c.error_codes) ? [...c.error_codes].sort().join("\u0001") : "";
  return JSON.stringify({
    mid: c.matched_text_id ?? null,
    mm: c.manual_match === true,
    he: !!c.has_error,
    ec,
    mxd: c.match_distance_exceeded === true,
    mtxt: c.matched_text
      ? { id: c.matched_text.id, d: c.matched_text.distance ?? null }
      : null,
  });
}

function fingerprintMapFromCircles(circles) {
  const m = new Map();
  (circles || []).forEach((c) => {
    if (c && c.id) m.set(c.id, circleMatchSaveFingerprint(c));
  });
  return m;
}

function collectCircleIdsWithDifferentFingerprint(prevFpMap, circles) {
  const ids = new Set();
  (circles || []).forEach((c) => {
    if (!c || !c.id) return;
    if (prevFpMap.get(c.id) !== circleMatchSaveFingerprint(c)) ids.add(c.id);
  });
  return ids;
}

/**
 * 수동 매칭 직후 서버 동기화. 불러온 작업(loadedWorkId)이면 PATCH로 변경분만 전송해 대용량 PUT을 피한다.
 * @param {Record<string, string>} prevManualOverrides
 * @param {string} statusMessage
 * @param {Set<string>} [changedCircleIds] - 이번 API 응답으로 달라진 원 id(없으면 manualOverrides 맵 diff만 사용)
 * @returns {Promise<boolean>}
 */
async function syncManualMatchDeltaToServer(prevManualOverrides, statusMessage, changedCircleIds) {
  if (!state.hasDataset || !state.circles?.length) return false;

  const newMo = computeManualOverridesForSave();
  state.manualOverrides = newMo;

  if (!state.loadedWorkId) {
    return syncCurrentWorkToServer(statusMessage);
  }

  const prev = prevManualOverrides && typeof prevManualOverrides === "object" ? prevManualOverrides : {};
  const patchIds = new Set();
  if (changedCircleIds instanceof Set) {
    changedCircleIds.forEach((id) => patchIds.add(id));
  }
  for (const k of new Set([...Object.keys(prev), ...Object.keys(newMo)])) {
    if (prev[k] !== newMo[k]) patchIds.add(k);
  }

  const circlePatches = (state.circles || [])
    .filter((c) => patchIds.has(c.id))
    .map((c) => cloneForSaveJson(c));

  try {
    const body = {
      manualOverrides: newMo,
      circlePatches,
      summary: state.summary,
      sourceType: state.loadedWorkMeta?.sourceType || getActiveSourceType(),
    };
    if (state.loadedWorkMeta && state.loadedWorkMeta.author != null && String(state.loadedWorkMeta.author).trim() !== "") {
      body.author = String(state.loadedWorkMeta.author).trim();
    }
    const res = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(state.loadedWorkId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (statusMessage) setUploadStatus(`${statusMessage} 서버에 저장했습니다.`);
      return true;
    }
    console.warn("수동 매칭 증분 저장 실패:", res.status);
    return syncCurrentWorkToServer(statusMessage);
  } catch (e) {
    console.warn("수동 매칭 증분 저장 예외:", e);
    return syncCurrentWorkToServer(statusMessage);
  }
}

/**
 * 현재 화면을 서버 중앙 저장소에 맞춤. 불러온 작업 ID가 없으면 POST로 새 작업을 만들고 ID를 붙인 뒤 이후부터 PUT.
 * @param {string} statusMessage - 성공 시 "… 서버에 저장했습니다." 앞부분
 * @returns {Promise<boolean>}
 */
async function syncCurrentWorkToServer(statusMessage) {
  if (!state.hasDataset || !state.circles?.length) return false;
  try {
    const saveData = collectCurrentStateForSave();
    if (state.loadedWorkMeta) {
      saveData.title = state.loadedWorkMeta.title || saveData.title;
      saveData.project = state.loadedWorkMeta.project || saveData.project || DEFAULT_PROJECT_NAME;
      saveData.sourceType = state.loadedWorkMeta.sourceType || saveData.sourceType || DEFAULT_SOURCE_TYPE;
      if (state.loadedWorkMeta.author != null && String(state.loadedWorkMeta.author).trim() !== "") {
        saveData.author = String(state.loadedWorkMeta.author).trim();
      }
    }

    if (state.loadedWorkId) {
      const res = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(state.loadedWorkId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveData),
      });
      if (res.ok) {
        const entry = await res.json().catch(() => ({}));
        state.loadedWorkMeta = {
          title: entry.title || saveData.title,
          project: entry.project || saveData.project || DEFAULT_PROJECT_NAME,
          author: (entry.author && String(entry.author).trim()) || saveData.author || "",
          sourceType: entry.sourceType || saveData.sourceType || DEFAULT_SOURCE_TYPE,
        };
        setProjectContext(state.loadedWorkMeta.project, state.loadedWorkMeta.sourceType);
        if (statusMessage) setUploadStatus(`${statusMessage} 서버에 저장했습니다.`);
        return true;
      }
      console.warn("저장 작업 PUT 실패:", res.status);
      return false;
    }

    const titleTrim = (saveData.title || "").trim();
    if (!titleTrim) {
      saveData.title = (state.lastUploadedFileName || "").trim() || `자동저장_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    }
    saveData.project = (saveData.project || "").trim() || DEFAULT_PROJECT_NAME;
    saveData.sourceType = saveData.sourceType || DEFAULT_SOURCE_TYPE;

    const res = await fetch(`${API_BASE_URL}/api/saved-works`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveData),
    });
    if (!res.ok) {
      console.warn("저장 작업 POST 실패:", res.status);
      return false;
    }
    const entry = await res.json();
    state.loadedWorkId = entry.id;
    state.loadedWorkMeta = {
      title: entry.title || saveData.title,
      project: entry.project || saveData.project || DEFAULT_PROJECT_NAME,
      author: (entry.author && String(entry.author).trim()) || "",
      sourceType: entry.sourceType || saveData.sourceType || DEFAULT_SOURCE_TYPE,
    };
    setProjectContext(state.loadedWorkMeta.project, state.loadedWorkMeta.sourceType);
    notifyWorkContextChanged();
    if (statusMessage) setUploadStatus(`${statusMessage} 서버에 저장했습니다(새 작업).`);
    if (saveWorkBtn) saveWorkBtn.disabled = false;
    if (saveWorkUpdateBtn) saveWorkUpdateBtn.disabled = false;
    return true;
  } catch (e) {
    console.warn("서버 동기화 예외:", e);
    return false;
  }
}

const SAVE_WORK_PROJECT_CUSTOM_VALUE = "__custom__";
const SAVE_WORK_AUTHOR_CUSTOM_VALUE = "__author_custom__";

/** 작업 저장 모달에서 선택된 프로젝트명 반환 (드롭다운 또는 직접입력) */
function getSaveWorkProjectValue() {
  if (saveWorkProjectSelect && saveWorkProjectSelect.value === SAVE_WORK_PROJECT_CUSTOM_VALUE) {
    const custom = (saveWorkProjectCustom && saveWorkProjectCustom.value || "").trim();
    return custom || DEFAULT_PROJECT_NAME;
  }
  return (saveWorkProjectSelect && saveWorkProjectSelect.value) || DEFAULT_PROJECT_NAME;
}

/** 작업 저장 모달에서 선택된 작성자 반환 (드롭다운 또는 직접입력) */
function getSaveWorkAuthorValue() {
  if (saveWorkAuthorSelect && saveWorkAuthorSelect.value === SAVE_WORK_AUTHOR_CUSTOM_VALUE) {
    return (saveWorkAuthorCustom && saveWorkAuthorCustom.value || "").trim();
  }
  return (saveWorkAuthorSelect && saveWorkAuthorSelect.value) || "";
}

/** 저장 모달 열기. isOverwrite: true면 수정 저장(덮어쓰기) 모드 */
async function openSaveWorkModal(isOverwrite = false) {
  if (!state.hasDataset) {
    setUploadStatus("저장할 데이터가 없습니다. DXF를 업로드한 뒤 저장하세요.", true);
    return;
  }
  if (saveWorkOverwriteSection) saveWorkOverwriteSection.style.display = isOverwrite ? "block" : "none";
  if (saveWorkModalSubmit) saveWorkModalSubmit.textContent = isOverwrite ? "덮어쓰기" : "저장";
  if (saveWorkModalTitle) {
    saveWorkModalTitle.textContent = isOverwrite ? "작업 버전 수정 저장" : "작업 버전 신규 저장";
  }

  const defaultTitle = state.lastUploadedFileName || `저장_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  if (saveWorkTitleInput) saveWorkTitleInput.value = defaultTitle;
  if (saveWorkSourceTypeSelect) {
    saveWorkSourceTypeSelect.value = getActiveSourceType();
  }

  if (isOverwrite && saveWorkOverwriteSelect) {
    saveWorkOverwriteSelect.innerHTML = "";
    saveWorkOverwriteSelect.removeEventListener("change", saveWorkOverwriteSelect._overwriteChange);
    try {
      const list = await getSavedWorksList();
      // await 이후 한 번 더 비움: 연속으로 모달이 열리면 이전 비동기 호출이 나중에 끝나며 옵션이 이중으로 붙는 것을 방지
      saveWorkOverwriteSelect.innerHTML = "";
      list.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id || "";
        opt.dataset.project = normalizeProjectName(item.project);
        opt.dataset.title = (item.title || "").trim() || "이름 없음";
        opt.dataset.sourceType = normalizeSourceType(item.sourceType);
        opt.textContent = (item.title || item.id) + (item.timestamp ? " · " + new Date(item.timestamp).toLocaleString("ko-KR") : "");
        saveWorkOverwriteSelect.appendChild(opt);
      });
      if (list.length === 0) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "저장된 작업이 없습니다.";
        saveWorkOverwriteSelect.appendChild(empty);
      }
      function syncOverwriteFormFromSelection() {
        const opt = saveWorkOverwriteSelect.selectedOptions && saveWorkOverwriteSelect.selectedOptions[0];
        if (opt && opt.value) {
          if (saveWorkTitleInput) {
            saveWorkTitleInput.value = opt.dataset.title || "";
            saveWorkTitleInput.disabled = true;
          }
          const proj = opt.dataset.project || DEFAULT_PROJECT_NAME;
          if (saveWorkProjectSelect) {
            if (![...saveWorkProjectSelect.options].some((o) => o.value === proj)) {
              const newOpt = document.createElement("option");
              newOpt.value = proj;
              newOpt.textContent = proj;
              saveWorkProjectSelect.insertBefore(newOpt, saveWorkProjectSelect.lastElementChild);
            }
            saveWorkProjectSelect.value = proj;
            saveWorkProjectSelect.disabled = true;
            if (saveWorkProjectCustomWrap) saveWorkProjectCustomWrap.style.display = "none";
          }
          if (saveWorkSourceTypeSelect) {
            saveWorkSourceTypeSelect.value = normalizeSourceType(opt.dataset.sourceType);
            saveWorkSourceTypeSelect.disabled = true;
          }
        }
      }
      saveWorkOverwriteSelect._overwriteChange = syncOverwriteFormFromSelection;
      saveWorkOverwriteSelect.addEventListener("change", syncOverwriteFormFromSelection);
      syncOverwriteFormFromSelection();
    } catch (_) {
      const err = document.createElement("option");
      err.value = "";
      err.textContent = "목록을 불러올 수 없습니다.";
      saveWorkOverwriteSelect.appendChild(err);
    }
  } else {
    if (saveWorkTitleInput) saveWorkTitleInput.disabled = false;
    if (saveWorkProjectSelect) saveWorkProjectSelect.disabled = false;
    if (saveWorkSourceTypeSelect) saveWorkSourceTypeSelect.disabled = false;
  }

  if (saveWorkAuthorSelect) {
    let authorList = [];
    try {
      authorList = await getSavedWorksList();
    } catch (_) {}
    saveWorkAuthorSelect.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "선택 (없음)";
    saveWorkAuthorSelect.appendChild(optEmpty);
    const authorSet = new Set();
    (authorList.map((item) => (item.author || "").trim()).filter(Boolean)).forEach((a) => authorSet.add(a));
    [...authorSet].sort().forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      saveWorkAuthorSelect.appendChild(opt);
    });
    const optCustom = document.createElement("option");
    optCustom.value = SAVE_WORK_AUTHOR_CUSTOM_VALUE;
    optCustom.textContent = "기타 (직접 입력)";
    saveWorkAuthorSelect.appendChild(optCustom);
    saveWorkAuthorSelect.value = "";
  }
  if (saveWorkAuthorCustomWrap) saveWorkAuthorCustomWrap.style.display = "none";
  if (saveWorkAuthorCustom) saveWorkAuthorCustom.value = "";

  if (saveWorkProjectSelect) {
    let projectList = [];
    try {
      projectList = await getSavedWorksList();
    } catch (_) {}
    const set = new Set([DEFAULT_PROJECT_NAME]);
    projectList.map((item) => normalizeProjectName(item.project)).filter(Boolean).forEach((p) => set.add(p));
    const projects = [...set].sort();
    saveWorkProjectSelect.innerHTML = "";
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      saveWorkProjectSelect.appendChild(opt);
    });
    const optCustom = document.createElement("option");
    optCustom.value = SAVE_WORK_PROJECT_CUSTOM_VALUE;
    optCustom.textContent = "기타 (직접 입력)";
    saveWorkProjectSelect.appendChild(optCustom);
    const activeProject = getActiveProjectName();
    if ([...saveWorkProjectSelect.options].some((option) => option.value === activeProject)) {
      saveWorkProjectSelect.value = activeProject;
    } else {
      saveWorkProjectSelect.value = SAVE_WORK_PROJECT_CUSTOM_VALUE;
      if (saveWorkProjectCustom) saveWorkProjectCustom.value = activeProject;
      if (saveWorkProjectCustomWrap) saveWorkProjectCustomWrap.style.display = "block";
    }
    if (isOverwrite && typeof saveWorkOverwriteSelect._overwriteChange === "function") {
      saveWorkOverwriteSelect._overwriteChange();
    }
  }
  if (saveWorkProjectSelect && saveWorkProjectSelect.value !== SAVE_WORK_PROJECT_CUSTOM_VALUE) {
    if (saveWorkProjectCustomWrap) saveWorkProjectCustomWrap.style.display = "none";
    if (saveWorkProjectCustom) saveWorkProjectCustom.value = "";
  }

  if (saveWorkOriginFilename) {
    saveWorkOriginFilename.textContent = state.lastUploadedFileName ? state.lastUploadedFileName : "—";
  }
  if (saveWorkModal) {
    saveWorkModal.classList.add("open");
    saveWorkModal.setAttribute("aria-hidden", "false");
    saveWorkModal.dataset.saveMode = isOverwrite ? "overwrite" : "new";
  }
  if (isOverwrite && saveWorkOverwriteSelect && saveWorkOverwriteSelect.options.length) {
    saveWorkOverwriteSelect.focus();
  } else if (saveWorkProjectSelect) {
    saveWorkProjectSelect.focus();
  }
}

function closeSaveWorkModal() {
  if (saveWorkModal) {
    saveWorkModal.classList.remove("open");
    saveWorkModal.setAttribute("aria-hidden", "true");
  }
  if (saveWorkModalTitle) saveWorkModalTitle.textContent = "작업 버전 저장";
}

/** 저장 모달에서 저장 실행: 신규면 POST, 수정 저장이면 PUT */
async function submitSaveWorkModal() {
  const isOverwrite = saveWorkModal && saveWorkModal.dataset.saveMode === "overwrite";
  const overwriteId = isOverwrite && saveWorkOverwriteSelect ? (saveWorkOverwriteSelect.value || "").trim() : "";

  if (isOverwrite && !overwriteId) {
    setUploadStatus("덮어쓸 작업 버전을 선택하세요.", true);
    if (saveWorkOverwriteSelect) saveWorkOverwriteSelect.focus();
    return;
  }

  let title;
  let project;
  let sourceType;
  if (isOverwrite && saveWorkOverwriteSelect) {
    const opt = saveWorkOverwriteSelect.selectedOptions && saveWorkOverwriteSelect.selectedOptions[0];
    title = (opt && opt.dataset.title) ? opt.dataset.title.trim() : "";
    project = (opt && opt.dataset.project) ? normalizeProjectName(opt.dataset.project) : DEFAULT_PROJECT_NAME;
    sourceType = (opt && opt.dataset.sourceType) ? normalizeSourceType(opt.dataset.sourceType) : DEFAULT_SOURCE_TYPE;
  } else {
    title = saveWorkTitleInput ? (saveWorkTitleInput.value || "").trim() : "";
    project = getSaveWorkProjectValue();
    sourceType = normalizeSourceType(saveWorkSourceTypeSelect?.value);
  }
  if (!title) {
    setUploadStatus("제목을 입력하세요.", true);
    if (saveWorkTitleInput) saveWorkTitleInput.focus();
    return;
  }
  const author = getSaveWorkAuthorValue();
  const data = collectCurrentStateForSave();
  data.title = title;
  data.project = project;
  data.sourceType = sourceType;
  data.author = author || undefined;
  data.sourceFileName = state.lastUploadedFileName || undefined;

  const submitBtn = saveWorkModalSubmit;
  const headerSaveBtn = saveWorkBtn;
  const headerUpdateBtn = saveWorkUpdateBtn;
  const wasDisabled = submitBtn && submitBtn.disabled;
  if (submitBtn && !wasDisabled) {
    submitBtn.disabled = true;
    submitBtn.textContent = isOverwrite ? "덮어쓰는 중..." : "저장 중...";
  }
  if (headerSaveBtn && !headerSaveBtn.disabled) headerSaveBtn.disabled = true;
  if (headerUpdateBtn && !headerUpdateBtn.disabled) headerUpdateBtn.disabled = true;

  try {
    const url = isOverwrite
      ? `${API_BASE_URL}/api/saved-works/${encodeURIComponent(overwriteId)}`
      : `${API_BASE_URL}/api/saved-works`;
    const method = isOverwrite ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || response.statusText);
    }
    const entry = await response.json().catch(() => ({}));
    state.loadedWorkId = entry.id || overwriteId || state.loadedWorkId;
    if (state.loadedWorkId) {
      state.manualHistoryReferenceWorkId = state.loadedWorkId;
    }
    state.loadedWorkMeta = {
      title: entry.title || data.title,
      project: entry.project || data.project || DEFAULT_PROJECT_NAME,
      author: (entry.author && String(entry.author).trim()) || data.author || "",
      sourceType: entry.sourceType || data.sourceType || DEFAULT_SOURCE_TYPE,
    };
    setProjectContext(state.loadedWorkMeta.project, state.loadedWorkMeta.sourceType);
    notifyWorkContextChanged();
    await refetchLoadWorkCache();
    closeSaveWorkModal();
    setUploadStatus(
      isOverwrite ? `"${title}"(이)가 덮어쓰기 되었습니다.` : `"${title}" 저장되었습니다. (${new Date().toLocaleString("ko-KR")})`
    );
    closeLoadWorkListPanel();
    if (headerSaveBtn) headerSaveBtn.disabled = true;
    if (headerUpdateBtn) headerUpdateBtn.disabled = true;
  } catch (e) {
    console.error(isOverwrite ? "작업 덮어쓰기 실패:" : "작업 저장 실패:", e);
    setUploadStatus(isOverwrite ? "덮어쓰기에 실패했습니다." : "저장에 실패했습니다. 서버 연결을 확인하세요.", true);
    if (headerSaveBtn) headerSaveBtn.disabled = false;
    if (headerUpdateBtn) headerUpdateBtn.disabled = false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isOverwrite ? "덮어쓰기" : "저장";
    }
  }
}

/** 저장된 작업 불러오기 (중앙 저장소에서 조회). loadBtn: 클릭한 불러오기 버튼(작업 중 비활성화용). */
async function handleLoadWork(id, loadBtn) {
  if (!id) return;
  if (loadBtn) loadBtn.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(id)}`);
    if (!response.ok) {
      setUploadStatus("해당 저장 데이터를 찾을 수 없습니다.", true);
      return;
    }
    const data = await response.json();
    if (loadBtn) loadBtn.disabled = false;
    loadBtn = null;

    state.lastUploadedFileName = data.sourceFileName || data.title || "";

    state.summary = data.summary || null;
    state.buildingSummary = Array.isArray(data.buildingSummary) ? data.buildingSummary : [];
    state.circles = Array.isArray(data.circles) ? data.circles : [];
    state.texts = Array.isArray(data.texts) ? data.texts : [];
    state.duplicates = normalizeDuplicatesFromPayload(Array.isArray(data.duplicates) ? data.duplicates : []);
    state.errors = Array.isArray(data.errors) ? data.errors : [];
    state.clusterPolylines = Array.isArray(data.clusterPolylines) ? data.clusterPolylines : [];
    state.rawPolylines = Array.isArray(data.rawPolylines) ? data.rawPolylines : [];
    state.pileClusters = Array.isArray(data.pileClusters) ? data.pileClusters : [];
    state.polylines = state.clusterPolylines.length ? state.clusterPolylines : state.rawPolylines;
    state.sourceCircles = state.circles.length ? JSON.parse(JSON.stringify(state.circles)) : null;
    state.sourceTexts = state.texts.length ? JSON.parse(JSON.stringify(state.texts)) : null;
    state.matchCorrections = Array.isArray(data.matchCorrections)
      ? data.matchCorrections
      : Array.isArray(data.match_corrections)
      ? data.match_corrections
      : [];
    state.buildings = normalizeAreaDefinitions(Array.isArray(data.buildings) ? data.buildings : []);
    state.pendingNames = Array.isArray(data.pendingNames) ? [...data.pendingNames] : [];
    state.pendingDrillingElevationsBuilding = Array.isArray(data.pendingDrillingElevationsBuilding)
      ? data.pendingDrillingElevationsBuilding.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.pendingDrillingElevationsParking = Array.isArray(data.pendingDrillingElevationsParking)
      ? data.pendingDrillingElevationsParking.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.pendingDrillingElevationsTowerCrane = Array.isArray(data.pendingDrillingElevationsTowerCrane)
      ? data.pendingDrillingElevationsTowerCrane.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.pendingFoundationTopBuilding = Array.isArray(data.pendingFoundationTopBuilding)
      ? data.pendingFoundationTopBuilding.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.pendingFoundationTopParking = Array.isArray(data.pendingFoundationTopParking)
      ? data.pendingFoundationTopParking.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.pendingFoundationTopTowerCrane = Array.isArray(data.pendingFoundationTopTowerCrane)
      ? data.pendingFoundationTopTowerCrane.map((v) =>
          v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v),
        )
      : [];
    state.foundationThicknessByPileId = data.foundationThicknessByPileId && typeof data.foundationThicknessByPileId === "object"
      ? Object.fromEntries(
          Object.entries(data.foundationThicknessByPileId).filter(
            ([circleId, value]) => circleId && Number.isFinite(Number(value)) && Number(value) >= 0,
          ).map(([circleId, value]) => [circleId, Math.round(Number(value))]),
        )
      : {};
    state.foundationPitOffsetByPileId = data.foundationPitOffsetByPileId && typeof data.foundationPitOffsetByPileId === "object"
      ? Object.fromEntries(
          Object.entries(data.foundationPitOffsetByPileId).filter(
            ([circleId, value]) => circleId && Number.isFinite(Number(value)) && Number(value) >= 0,
          ).map(([circleId, value]) => [circleId, Number(value)]),
        )
      : {};
    state.drillingStartByPileId = data.drillingStartByPileId && typeof data.drillingStartByPileId === "object"
      ? Object.fromEntries(
          Object.entries(data.drillingStartByPileId).filter(
            ([circleId, value]) => circleId && Number.isFinite(Number(value)),
          ).map(([circleId, value]) => [circleId, Number(value)]),
        )
      : {};
    state.foundationTopByPileId = data.foundationTopByPileId && typeof data.foundationTopByPileId === "object"
      ? Object.fromEntries(
          Object.entries(data.foundationTopByPileId).filter(
            ([circleId, value]) => circleId && Number.isFinite(Number(value)),
          ).map(([circleId, value]) => [circleId, Number(value)]),
        )
      : {};
    setAreaNames(
      AREA_KIND_PARKING,
      Array.isArray(data.pendingParkingNames) && data.pendingParkingNames.length
        ? [...data.pendingParkingNames]
        : buildAreaNameListFromEntries(AREA_KIND_PARKING, getAreasByKind(AREA_KIND_PARKING, state.buildings)),
    );
    setAreaNames(
      AREA_KIND_TOWER_CRANE,
      Array.isArray(data.pendingTowerCraneNames) && data.pendingTowerCraneNames.length
        ? [...data.pendingTowerCraneNames]
        : buildAreaNameListFromEntries(AREA_KIND_TOWER_CRANE, getAreasByKind(AREA_KIND_TOWER_CRANE, state.buildings)),
    );
    state.filter = normalizeFilter(data.filter || {});
    state.circleMap = new Map(state.circles.map((c) => [c.id, c]));
    state.textMap = new Map(state.texts.map((t) => [t.id, t]));
    state.hasDataset = true;
    state.activeBuildingFilter = "ALL";
    state.highlightedCircleIds.clear();
    state.highlightedTextIds.clear();
    state.loadedWorkId = id;
    state.manualHistoryReferenceWorkId = id;
    state.manualOverrides = (data.manualOverrides && typeof data.manualOverrides === "object")
      ? { ...data.manualOverrides }
      : {};

    syncManualMatchFlagsAfterLoad();

    if (state.circles.length > 0) {
      // 저장된 errors는 circles/texts와 불일치할 수 있음(수동 매칭 후 PATCH로 errors만 비운 경우 등) → 항상 현재 데이터 기준으로 재계산
      state.errors = buildErrorsFromCirclesAndTexts(state.circles, state.texts);
      refreshMatchDerivedUIState();
      if (!state.summary) state.summary = {};
      state.summary.total_texts = countMatchableTexts(state.texts || []);
      if (!state.summary || typeof state.summary.matched_pairs !== "number") {
        if (!state.summary) state.summary = {};
        state.summary.total_circles = state.summary.total_circles ?? state.circles.length;
        state.summary.matched_pairs = state.circles.filter((c) => c.matched_text_id).length;
        state.summary.duplicate_groups = state.summary.duplicate_groups ?? state.duplicates.length;
      }
    }

    state.loadedWorkMeta = {
      title: data.title || state.lastUploadedFileName || "저장",
      project: normalizeProjectName(data.project),
      author: data.author || "",
      sourceType: normalizeSourceType(data.sourceType),
    };
    setProjectContext(state.loadedWorkMeta.project, state.loadedWorkMeta.sourceType);
    notifyWorkContextChanged();
    resetManualSelection();
    state.areaRectCreate = null;
    if (saveWorkBtn) saveWorkBtn.disabled = false;
    if (saveWorkUpdateBtn) saveWorkUpdateBtn.disabled = false;

    updateFilterInputs(state.filter);
    if (maxDistanceSeedInput && data.clustering) {
      maxDistanceSeedInput.value = data.clustering.maxDistanceFromSeed ?? 30;
    }
    if (mergeSeedDistanceInput && data.clustering) {
      mergeSeedDistanceInput.value = data.clustering.mergeSeedDistance ?? 20;
    }
    if (buildingCountInput) {
      buildingCountInput.value =
        data.buildingCount || getAreasByKind(AREA_KIND_BUILDING).length || 1;
    }
    if (parkingCountInput) {
      parkingCountInput.value =
        data.parkingAreaCount || getAreasByKind(AREA_KIND_PARKING).length || 0;
    }
    if (towerCraneCountInput) {
      towerCraneCountInput.value =
        data.towerAreaCount || getAreasByKind(AREA_KIND_TOWER_CRANE).length || 0;
    }
    applyLoadedAutoBuildingOutlineOrderPayload(data.clustering, data.autoBuildingOutlineByOrder);
    syncBuildingOutlineAutoUi();
    ensurePendingNameCount(AREA_KIND_PARKING, getConfiguredAreaCount(AREA_KIND_PARKING));
    ensurePendingNameCount(AREA_KIND_TOWER_CRANE, getConfiguredAreaCount(AREA_KIND_TOWER_CRANE));
    syncPendingNamesWithBuildings();

    updateSummaryCards();
    updateCircleTable();
    updateDuplicatesTable();
    updateErrorsTable();
    renderBuildingTabs();
    populateBuildingSelect();
    renderPendingNameEditor();
    renderMatchCorrectionsPanel();
    await refetchLoadWorkCache();
    syncManualHistoryReuseControlsFromState();
    updateCanvasSearchAvailability();
    syncMeissaCompareBtnEnabled();
    fitViewToData();
    requestRedraw();

    setUploadStatus(`"${data.title}" 불러왔습니다. (${data.timestamp ? new Date(data.timestamp).toLocaleString("ko-KR") : ""})`);
    closeLoadWorkListPanel();
  } catch (e) {
    console.error("불러오기 실패:", e);
    setUploadStatus("불러오기에 실패했습니다. 서버 연결을 확인하세요.", true);
  } finally {
    if (loadBtn) loadBtn.disabled = false;
  }
}

async function handleDeleteSavedWork(id, event) {
  if (event) event.stopPropagation();
  try {
    const response = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    await refetchLoadWorkCache();
    renderLoadWorkItems(selectedLoadProject);
    setUploadStatus("저장 항목이 삭제되었습니다.");
  } catch (e) {
    setUploadStatus("삭제에 실패했습니다.", true);
  }
}

function appendLoadWorkProjectRow(container, name) {
  const isFav = loadFavoriteProjectNames().includes(name);
  const row = document.createElement("div");
  row.setAttribute("role", "button");
  row.tabIndex = 0;
  row.className = "load-work-project-item" + (selectedLoadProject === name ? " selected" : "");
  const latestMs = maxTimestampForLoadWorkProject(name);
  const latestStr = latestMs ? formatLoadWorkPanelDate(latestMs) : "";
  row.innerHTML = `
    <button type="button" class="load-work-fav-btn" aria-label="${isFav ? "프로젝트 즐겨찾기 해제" : "프로젝트 즐겨찾기"}" aria-pressed="${isFav}">${isFav ? "★" : "☆"}</button>
    <div class="load-work-project-item-inner">
      <span class="load-work-project-name">${escapeHtml(name)}</span>
      ${latestStr ? `<span class="load-work-project-latest">최근 ${escapeHtml(latestStr)}</span>` : ""}
    </div>`;
  const favBtn = row.querySelector(".load-work-fav-btn");
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavoriteProjectName(name);
    renderLoadWorkProjects();
  });
  row.addEventListener("click", () => {
    selectedLoadProject = name;
    selectedLoadSourceType = LOAD_WORK_SOURCE_ALL;
    if (loadWorkItemsLabel) loadWorkItemsLabel.textContent = `작업 버전 · ${name}`;
    renderLoadWorkProjects();
    renderLoadWorkSourceFilters(name);
    renderLoadWorkItems(name);
  });
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      row.click();
    }
  });
  container.appendChild(row);
}

/** 프로젝트 목록 렌더 (검색·즐겨찾기 구역) */
function renderLoadWorkProjects() {
  if (!loadWorkProjects) return;
  loadWorkProjects.innerHTML = "";
  const projectNames = [...new Set(savedWorksCache.map(normalizeLoadWorkProjectName))];
  projectNames.sort((a, b) => maxTimestampForLoadWorkProject(b) - maxTimestampForLoadWorkProject(a));
  const favSet = new Set(loadFavoriteProjectNames());
  const favNames = projectNames.filter((n) => favSet.has(n));
  const restNames = projectNames.filter((n) => !favSet.has(n));
  const q = loadWorkSearchNorm(loadWorkProjectSearch && loadWorkProjectSearch.value);
  const matchName = (n) => !q || n.toLowerCase().includes(q);
  const favFiltered = favNames.filter(matchName);
  const restFiltered = restNames.filter(matchName);

  if (favFiltered.length === 0 && restFiltered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "load-work-empty";
    empty.style.padding = "0.75rem";
    empty.style.fontSize = "0.85rem";
    empty.textContent = projectNames.length ? "검색 결과가 없습니다." : "저장된 프로젝트가 없습니다.";
    loadWorkProjects.appendChild(empty);
    return;
  }

  const addHeading = (text) => {
    const h = document.createElement("div");
    h.className = "load-work-list-section-title";
    h.textContent = text;
    loadWorkProjects.appendChild(h);
  };

  if (favFiltered.length) {
    addHeading("즐겨찾기");
    favFiltered.forEach((name) => appendLoadWorkProjectRow(loadWorkProjects, name));
  }
  if (restFiltered.length) {
    if (favFiltered.length) addHeading("전체");
    restFiltered.forEach((name) => appendLoadWorkProjectRow(loadWorkProjects, name));
  }
}

function renderLoadWorkSourceFilters(projectName) {
  if (!loadWorkSourceFilters) return;
  loadWorkSourceFilters.innerHTML = "";
  if (!projectName) return;
  const types = getLoadWorkSourceTypes(projectName);
  const options = [{ value: LOAD_WORK_SOURCE_ALL, label: "전체" }, ...types];
  if (!options.some((option) => option.value === selectedLoadSourceType)) {
    selectedLoadSourceType = LOAD_WORK_SOURCE_ALL;
  }
  const fragment = document.createDocumentFragment();
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "load-work-project-chip" + (selectedLoadSourceType === option.value ? " selected" : "");
    button.textContent = option.label;
    button.addEventListener("click", () => {
      selectedLoadSourceType = option.value;
      renderLoadWorkSourceFilters(projectName);
      renderLoadWorkItems(projectName);
    });
    fragment.appendChild(button);
  });
  loadWorkSourceFilters.appendChild(fragment);
}

function createLoadWorkListItemElement(item) {
  const dateMs = savedWorkTimestampMs(item);
  const dateStr = dateMs ? formatLoadWorkPanelDate(dateMs) : "—";
  const titleDisplay = escapeHtml(item.title || "이름 없음");
  const sourceBadge = getSourceTypeBadgeHtml(item.sourceType, "load-work-item-badge");
  const subParts = [`Circle ${item.circleCount ?? 0}개 · 동 ${item.buildingCount ?? 0}개`];
  if (item.author) subParts.push(escapeHtml(item.author));
  if (item.sourceFileName) subParts.push(`원본 ${escapeHtml(item.sourceFileName)}`);
  const subLine = subParts.join(" · ");
  const isFav = loadFavoriteWorkIds().includes(item.id);

  const el = document.createElement("div");
  el.className = "load-work-item";
  el.dataset.workId = item.id;
  el.innerHTML = `
    <div class="load-work-item-row">
        <div class="load-work-item-main">
          <div class="load-work-item-top">
            <button type="button" class="load-work-fav-btn" data-load-fav-version aria-label="${isFav ? "작업 버전 즐겨찾기 해제" : "작업 버전 즐겨찾기"}" aria-pressed="${isFav}">${isFav ? "★" : "☆"}</button>
            <div class="load-work-item-top-middle">
              ${sourceBadge}
              <div class="load-work-title-edit">
                <strong class="load-work-title load-work-title-text">${titleDisplay}</strong>
                <button type="button" class="ghost load-work-edit-title-btn" aria-label="제목 수정">제목 수정</button>
              </div>
            </div>
          <time class="load-work-item-date"${dateMs && item.timestamp ? ` datetime="${escapeHtml(String(item.timestamp))}"` : ""}>${escapeHtml(dateStr)}</time>
        </div>
        <div class="load-work-item-sub">${subLine}</div>
      </div>
      <div class="load-work-item-actions">
        <button type="button" class="ghost load-work-load-btn">불러오기</button>
        <button type="button" class="ghost load-work-delete-btn">삭제</button>
      </div>
    </div>
    <div class="load-work-delete-confirm" aria-hidden="true">
      <p class="load-work-delete-hint">아래에 <strong>삭제하겠습니다</strong> 를 입력한 뒤 삭제 버튼을 누르세요.</p>
      <div class="load-work-delete-confirm-row">
        <input type="text" class="load-work-delete-input" placeholder="삭제하겠습니다" autocomplete="off" />
        <button type="button" class="load-work-delete-confirm-btn" disabled>삭제</button>
        <button type="button" class="ghost load-work-delete-cancel-btn">취소</button>
      </div>
      <p class="load-work-delete-error hidden" role="alert"></p>
    </div>
  `;

  const favBtn = el.querySelector("[data-load-fav-version]");
  if (favBtn) {
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteWorkId(item.id);
      renderLoadWorkItems(selectedLoadProject);
    });
  }

  const titleWrap = el.querySelector(".load-work-title-edit");
  const editBtn = el.querySelector(".load-work-edit-title-btn");
  if (editBtn && titleWrap) {
    editBtn.addEventListener("click", () => {
      const strong = titleWrap.querySelector(".load-work-title-text");
      if (!strong) return;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "load-work-title-input-inline";
      input.value = item.title || "";
      input.setAttribute("maxlength", "200");
      strong.replaceWith(input);
      input.focus();
      editBtn.style.display = "none";
      const commit = () => {
        const newTitle = (input.value || "").trim() || "이름 없음";
        input.replaceWith(strong);
        strong.textContent = newTitle;
        editBtn.style.display = "";
        patchSavedWorkTitle(item.id, newTitle).then(() => {
          refetchLoadWorkCache().then(() => renderLoadWorkItems(selectedLoadProject));
        }).catch(() => {
          refetchLoadWorkCache().then(() => renderLoadWorkItems(selectedLoadProject));
        });
      };
      input.addEventListener("blur", commit, { once: true });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.removeEventListener("blur", commit);
          commit();
        }
      });
    });
  }
  el.querySelector(".load-work-load-btn").addEventListener("click", (e) => handleLoadWork(item.id, e.currentTarget));

  const deleteBtn = el.querySelector(".load-work-delete-btn");
  const deleteConfirmBlock = el.querySelector(".load-work-delete-confirm");
  const deleteInput = el.querySelector(".load-work-delete-input");
  const deleteConfirmBtn = el.querySelector(".load-work-delete-confirm-btn");
  const deleteCancelBtn = el.querySelector(".load-work-delete-cancel-btn");
  const deleteError = el.querySelector(".load-work-delete-error");

  const DELETE_CONFIRM_TEXT = "삭제하겠습니다";

  function toggleDeleteConfirm(show) {
    const isOpen = deleteConfirmBlock.getAttribute("aria-hidden") !== "true";
    if (show == null) show = !isOpen;
    if (show) {
      deleteConfirmBlock.classList.add("open");
      deleteConfirmBlock.setAttribute("aria-hidden", "false");
      deleteInput.value = "";
      deleteConfirmBtn.disabled = true;
      deleteError.classList.add("hidden");
      deleteError.textContent = "";
      deleteInput.focus();
    } else {
      deleteConfirmBlock.classList.remove("open");
      deleteConfirmBlock.setAttribute("aria-hidden", "true");
    }
  }

  function updateConfirmButton() {
    const ok = deleteInput.value.trim() === DELETE_CONFIRM_TEXT;
    deleteConfirmBtn.disabled = !ok;
    deleteError.classList.add("hidden");
    deleteError.textContent = "";
  }

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDeleteConfirm(true);
  });

  deleteInput.addEventListener("input", updateConfirmButton);
  deleteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (deleteConfirmBtn.disabled) {
        deleteError.textContent = "삭제하겠습니다 를 입력하세요.";
        deleteError.classList.remove("hidden");
      } else {
        deleteConfirmBtn.click();
      }
    }
  });

  deleteConfirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (deleteConfirmBtn.disabled) {
      deleteError.textContent = "삭제하겠습니다 를 입력하세요.";
      deleteError.classList.remove("hidden");
      return;
    }
    toggleDeleteConfirm(false);
    handleDeleteSavedWork(item.id, e);
  });

  deleteCancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDeleteConfirm(false);
  });

  return el;
}

/** 특정 프로젝트의 작업 목록만 렌더 (검색·즐겨찾기 구역) */
function renderLoadWorkItems(projectName) {
  if (!loadWorkList) return;
  if (loadWorkVersionSearch) loadWorkVersionSearch.disabled = !projectName;
  loadWorkList.innerHTML = "";
  const list = projectName
    ? savedWorksCache.filter((item) => {
        if (normalizeLoadWorkProjectName(item) !== projectName) return false;
        if (selectedLoadSourceType === LOAD_WORK_SOURCE_ALL) return true;
        return normalizeSourceType(item.sourceType) === selectedLoadSourceType;
      })
    : [];
  list.sort((a, b) => savedWorkTimestampMs(b) - savedWorkTimestampMs(a));

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "load-work-empty";
    empty.textContent = projectName ? "이 프로젝트에 저장된 작업이 없습니다." : "프로젝트를 선택하세요.";
    loadWorkList.appendChild(empty);
    return;
  }

  const favIds = new Set(loadFavoriteWorkIds());
  const favItems = list.filter((i) => favIds.has(i.id));
  const restItems = list.filter((i) => !favIds.has(i.id));
  const q = loadWorkSearchNorm(loadWorkVersionSearch && loadWorkVersionSearch.value);
  const favF = favItems.filter((i) => savedWorkMatchesVersionSearch(i, q));
  const restF = restItems.filter((i) => savedWorkMatchesVersionSearch(i, q));

  if (favF.length === 0 && restF.length === 0) {
    const empty = document.createElement("div");
    empty.className = "load-work-empty";
    empty.style.padding = "0.75rem";
    empty.textContent = "검색 결과가 없습니다.";
    loadWorkList.appendChild(empty);
    return;
  }

  const addHeading = (text) => {
    const h = document.createElement("div");
    h.className = "load-work-list-section-title";
    h.textContent = text;
    return h;
  };

  const fragment = document.createDocumentFragment();
  if (favF.length) {
    fragment.appendChild(addHeading("즐겨찾기"));
    favF.forEach((item) => fragment.appendChild(createLoadWorkListItemElement(item)));
  }
  if (restF.length) {
    if (favF.length) fragment.appendChild(addHeading("전체"));
    restF.forEach((item) => fragment.appendChild(createLoadWorkListItemElement(item)));
  }
  loadWorkList.appendChild(fragment);
}

/** 불러오기 패널 열 때: 목록 조회 후 프로젝트 목록 표시 */
async function renderLoadWorkList() {
  const btn = loadWorkListRefresh;
  if (btn) btn.disabled = true;
  try {
    if (loadWorkList) loadWorkList.innerHTML = "<div class=\"load-work-empty\">목록 불러오는 중...</div>";
    if (loadWorkProjects) loadWorkProjects.innerHTML = "";
    if (loadWorkItemsLabel) loadWorkItemsLabel.textContent = "작업 버전 · 왼쪽에서 프로젝트(버전 그룹)를 선택하세요";
    await refetchLoadWorkCache();
    selectedLoadProject = null;
    selectedLoadSourceType = LOAD_WORK_SOURCE_ALL;
    renderLoadWorkProjects();
    renderLoadWorkSourceFilters(null);
    if (loadWorkList) {
      loadWorkList.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "load-work-empty";
      empty.textContent = savedWorksCache.length ? "왼쪽에서 프로젝트를 선택하세요." : "저장된 작업이 없습니다.";
      loadWorkList.appendChild(empty);
    }
    if (loadWorkVersionSearch) loadWorkVersionSearch.disabled = true;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** 저장된 작업 제목(·작성자) PATCH */
async function patchSavedWorkTitle(id, title, author) {
  const body = { title };
  if (author !== undefined) body.author = author;
  const response = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 버전 비교: 동 그룹 키 (미할당 통일)
 */
function getBuildingKey(circleOrName) {
  if (circleOrName && typeof circleOrName === "object" && "building_name" in circleOrName) {
    const name = circleOrName.building_name;
    return name && String(name).trim() ? String(name).trim() : "미할당";
  }
  return circleOrName && String(circleOrName).trim() ? String(circleOrName).trim() : "미할당";
}

/**
 * 버전 비교: circle의 매칭 넘버 (matched_text.text)
 */
function getMatchNumber(circle) {
  const mt = circle && circle.matched_text;
  if (!mt) return null;
  const t = mt.text;
  return t !== undefined && t !== null ? String(t).trim() : null;
}

const COORD_EPS = 1e-4;

function coordsEqual(ax, ay, bx, by) {
  return Math.abs(ax - bx) < COORD_EPS && Math.abs(ay - by) < COORD_EPS;
}

/**
 * 두 버전 데이터로 동별·매칭넘버별 diff 생성
 * 반환: { byGroup: { 동이름: [ { status, circleA, circleB, number, buildingKey } ] }, allItems: [] }
 * status: "same" | "only-old" | "only-new" | "coord-changed"
 */
function buildVersionDiff(versionA, versionB) {
  const circlesA = Array.isArray(versionA.circles) ? versionA.circles : [];
  const circlesB = Array.isArray(versionB.circles) ? versionB.circles : [];
  const byGroup = {};
  const allItems = [];

  function ensureGroup(key) {
    if (!byGroup[key]) byGroup[key] = [];
    return byGroup[key];
  }

  const keyA = (c) => `${getBuildingKey(c)}|${getMatchNumber(c) ?? ""}`;
  const groupCirclesByKey = (circles) => {
    const map = new Map();
    circles.forEach((c) => {
      const k = keyA(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    });
    return map;
  };

  const mapA = groupCirclesByKey(circlesA);
  const mapB = groupCirclesByKey(circlesB);
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  allKeys.forEach((key) => {
    const listA = mapA.get(key) || [];
    const listB = mapB.get(key) || [];
    const buildingKey = key.split("|")[0];
    const number = key.split("|")[1] || null;

    const usedB = new Set();
    listA.forEach((circleA) => {
      let bestB = null;
      let bestDist = Infinity;
      listB.forEach((circleB, idx) => {
        if (usedB.has(idx)) return;
        const dx = circleB.center_x - circleA.center_x;
        const dy = circleB.center_y - circleA.center_y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestB = { circle: circleB, idx };
        }
      });
      if (bestB) {
        usedB.add(bestB.idx);
        const circleB = bestB.circle;
        const sameCoord = coordsEqual(
          circleA.center_x,
          circleA.center_y,
          circleB.center_x,
          circleB.center_y,
        );
        const status = sameCoord ? "same" : "coord-changed";
        const item = { status, circleA, circleB, number, buildingKey };
        ensureGroup(buildingKey).push(item);
        allItems.push(item);
      } else {
        const item = { status: "only-old", circleA, circleB: null, number, buildingKey };
        ensureGroup(buildingKey).push(item);
        allItems.push(item);
      }
    });
    listB.forEach((circleB, idx) => {
      if (usedB.has(idx)) return;
      const item = { status: "only-new", circleA: null, circleB, number, buildingKey };
      ensureGroup(buildingKey).push(item);
      allItems.push(item);
    });
  });

  return { byGroup, allItems };
}

/**
 * 동별 객체 수·텍스트 수 집계 (circle 기준, 텍스트는 해당 동 circle에 매칭된 개수)
 */
function countByBuilding(data) {
  const circleByBuilding = {};
  const textByBuilding = {};
  const circles = Array.isArray(data.circles) ? data.circles : [];
  circles.forEach((c) => {
    const key = getBuildingKey(c);
    circleByBuilding[key] = (circleByBuilding[key] || 0) + 1;
    if (c.matched_text_id) {
      textByBuilding[key] = (textByBuilding[key] || 0) + 1;
    }
  });
  Object.keys(circleByBuilding).forEach((k) => {
    if (!textByBuilding[k]) textByBuilding[k] = 0;
  });
  return { circleByBuilding, textByBuilding };
}

function openVersionComparePanel() {
  if (!versionComparePanel) return;
  versionComparePanel.classList.add("open");
  versionComparePanel.setAttribute("aria-hidden", "false");
  closeVersionCompareExcelModal();
  if (!versionCompareExcelInspection) {
    resetVersionCompareExcelInspectState();
  }
  resetVersionCompareExcelCompareResult();
  populateVersionCompareSelects();
  pilexySendVirtualPageView("/pilexy/version-compare", "버전 비교");
}

function closeVersionComparePanel() {
  if (!versionComparePanel) return;
  versionComparePanel.classList.remove("open");
  versionComparePanel.setAttribute("aria-hidden", "true");
  closeVersionCompareExcelModal();
}

const VERSION_COMPARE_CURRENT_VALUE = "__current__";

function getVersionCompareSourceTypes(projectName) {
  if (!projectName) return [];
  const normalizedProject = normalizeProjectName(projectName);
  const seen = new Set();
  versionCompareWorksList.forEach((item) => {
    if (normalizeLoadWorkProjectName(item) !== normalizedProject) return;
    seen.add(normalizeSourceType(item.sourceType));
  });
  if (state.hasDataset && getActiveProjectName() === normalizedProject) {
    seen.add(getActiveSourceType());
  }
  return SOURCE_TYPE_OPTIONS.filter((option) => seen.has(option.value));
}

function currentVersionCompareContextMatches(projectName, sourceType) {
  return (
    state.hasDataset &&
    getActiveProjectName() === normalizeProjectName(projectName) &&
    getActiveSourceType() === normalizeSourceType(sourceType)
  );
}

function populateVersionCompareSourceSelect(selectEl, projectName, preferredSourceType) {
  if (!selectEl) return DEFAULT_SOURCE_TYPE;
  selectEl.innerHTML = "";
  const options = getVersionCompareSourceTypes(projectName);
  const safeOptions = options.length
    ? options
    : SOURCE_TYPE_OPTIONS.filter((option) => option.value === DEFAULT_SOURCE_TYPE);
  safeOptions.forEach((option) => {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    selectEl.appendChild(el);
  });
  const preferred = normalizeSourceType(preferredSourceType);
  const nextValue = [...selectEl.options].some((option) => option.value === preferred)
    ? preferred
    : (selectEl.options[0]?.value || DEFAULT_SOURCE_TYPE);
  selectEl.value = nextValue;
  return nextValue;
}

function buildVersionCompareVersionLabel(item) {
  const dateLabel = item.timestamp ? new Date(item.timestamp).toLocaleString("ko-KR") : "";
  return (item.title || item.id) + (dateLabel ? ` (${dateLabel})` : "");
}

function updateVersionCompareVersionOptions(side, preferredValue = null) {
  const sourceSelect = side === "old" ? versionCompareOldSource : versionCompareNewSource;
  const versionSelect = side === "old" ? versionCompareOld : versionCompareNew;
  if (!versionSelect) return;
  const projectName = normalizeProjectName(versionCompareProject?.value || getActiveProjectName());
  versionSelect.innerHTML = "";
  if (!projectName) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "프로젝트를 선택하세요.";
    versionSelect.appendChild(empty);
    return;
  }
  const sourceType = normalizeSourceType(sourceSelect?.value || getActiveSourceType());
  const items = versionCompareWorksList
    .filter((item) => normalizeLoadWorkProjectName(item) === projectName && normalizeSourceType(item.sourceType) === sourceType)
    .sort((a, b) => savedWorkTimestampMs(b) - savedWorkTimestampMs(a));
  if (currentVersionCompareContextMatches(projectName, sourceType)) {
    const option = document.createElement("option");
    option.value = VERSION_COMPARE_CURRENT_VALUE;
    option.textContent = "현재 화면";
    versionSelect.appendChild(option);
  }
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = buildVersionCompareVersionLabel(item);
    versionSelect.appendChild(option);
  });
  if (!versionSelect.options.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "선택 가능한 버전 없음";
    versionSelect.appendChild(empty);
    return;
  }
  const defaultValue = side === "new" && currentVersionCompareContextMatches(projectName, sourceType)
    ? VERSION_COMPARE_CURRENT_VALUE
    : versionSelect.options[0].value;
  const nextValue = [...versionSelect.options].some((option) => option.value === preferredValue)
    ? preferredValue
    : defaultValue;
  versionSelect.value = nextValue;
}

function fillVersionCompareOldNewByProject(projectName) {
  if (!versionCompareOld || !versionCompareNew) return;
  const normalizedProject = projectName ? normalizeProjectName(projectName) : "";
  if (!normalizedProject) {
    [versionCompareOldSource, versionCompareNewSource, versionCompareOld, versionCompareNew].forEach((selectEl) => {
      if (!selectEl) return;
      selectEl.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "프로젝트를 선택하세요.";
      selectEl.appendChild(empty);
    });
    return;
  }
  const preferredSourceType = getActiveProjectName() === normalizedProject ? getActiveSourceType() : null;
  const oldSourceValue = populateVersionCompareSourceSelect(
    versionCompareOldSource,
    normalizedProject,
    versionCompareOldSource?.value || preferredSourceType,
  );
  const newSourceValue = populateVersionCompareSourceSelect(
    versionCompareNewSource,
    normalizedProject,
    versionCompareNewSource?.value || preferredSourceType || oldSourceValue,
  );
  updateVersionCompareVersionOptions("old", versionCompareOld?.value || null);
  updateVersionCompareVersionOptions(
    "new",
    currentVersionCompareContextMatches(normalizedProject, newSourceValue)
      ? VERSION_COMPARE_CURRENT_VALUE
      : versionCompareNew?.value || null,
  );
}

async function populateVersionCompareSelects() {
  versionCompareWorksList = await getSavedWorksList();
  if (!versionCompareProject) return;
  const projectSet = new Set(versionCompareWorksList.map(normalizeLoadWorkProjectName));
  if (state.hasDataset) {
    projectSet.add(getActiveProjectName());
  }
  const projectNames = [...projectSet];
  projectNames.sort((a, b) => maxTimestampForProjectInList(b, versionCompareWorksList) - maxTimestampForProjectInList(a, versionCompareWorksList));
  const previousValue = versionCompareProject.value || "";
  versionCompareProject.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "프로젝트 선택";
  versionCompareProject.appendChild(empty);
  projectNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    versionCompareProject.appendChild(option);
  });
  const activeProject = getActiveProjectName();
  if ([...versionCompareProject.options].some((option) => option.value === activeProject)) {
    versionCompareProject.value = activeProject;
  } else if ([...versionCompareProject.options].some((option) => option.value === previousValue)) {
    versionCompareProject.value = previousValue;
  } else {
    versionCompareProject.value = "";
  }
  fillVersionCompareOldNewByProject(versionCompareProject.value || "");
}

async function getVersionData(optionValue) {
  if (optionValue === VERSION_COMPARE_CURRENT_VALUE) {
    return collectCurrentStateForSave();
  }
  const response = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(optionValue)}`);
  if (!response.ok) throw new Error("저장된 작업을 불러올 수 없습니다.");
  return response.json();
}

function getSelectedVersionCompareLabel(side) {
  const sourceSelect = side === "old" ? versionCompareOldSource : versionCompareNewSource;
  const versionSelect = side === "old" ? versionCompareOld : versionCompareNew;
  const versionLabel = versionSelect?.selectedOptions?.[0]?.textContent?.trim() || (side === "old" ? "이전 버전" : "현재 버전");
  return `${getSourceTypeLabel(sourceSelect?.value)} · ${versionLabel}`;
}

async function resolveVersionCompareSelection(options = {}) {
  const { singleVersion = false } = options;
  if (!versionCompareOld || !versionCompareNew) {
    throw new Error("버전 비교 UI를 찾을 수 없습니다.");
  }
  const newVal = versionCompareNew.value;
  if (singleVersion) {
    if (!newVal) {
      throw new Error("현재 버전을 선택하세요.");
    }
    const currentVersion = await getVersionData(newVal);
    const currentLabel = getSelectedVersionCompareLabel("new");
    return {
      versionA: currentVersion,
      versionB: currentVersion,
      labels: {
        current: currentLabel,
        old: currentLabel,
        new: currentLabel,
      },
      singleVersion: true,
    };
  }
  const oldVal = versionCompareOld.value;
  if (!oldVal || !newVal) {
    throw new Error("이전 버전과 현재 버전을 모두 선택하세요.");
  }
  const [versionA, versionB] = await Promise.all([
    getVersionData(oldVal),
    getVersionData(newVal),
  ]);
  return {
    versionA,
    versionB,
    labels: {
      old: getSelectedVersionCompareLabel("old"),
      new: getSelectedVersionCompareLabel("new"),
    },
    singleVersion: false,
  };
}

function openVersionCompareExcelModal() {
  if (!versionCompareExcelModal) return;
  versionCompareExcelModal.classList.add("open");
  versionCompareExcelModal.setAttribute("aria-hidden", "false");
  updateVersionCompareExcelApplyState();
  versionCompareExcelModal.focus({ preventScroll: true });
  void restoreVersionCompareExcelResultFromCache();
}

function closeVersionCompareExcelModal() {
  if (!versionCompareExcelModal) return;
  versionCompareExcelModal.classList.remove("open");
  versionCompareExcelModal.setAttribute("aria-hidden", "true");
}

function getVersionCompareExcelCacheProjectName() {
  const selected = normalizeProjectName(versionCompareProject?.value || "");
  return selected || normalizeProjectName(getActiveProjectName());
}

function getVersionCompareExcelFileSignature(file) {
  if (!file) return "";
  const name = String(file.name || "").trim();
  const size = Number(file.size || 0);
  if (!name) return "";
  return `${name}::${size}`;
}

function buildVersionCompareExcelCacheLookupKey(file) {
  const project = getVersionCompareExcelCacheProjectName();
  const signature = getVersionCompareExcelFileSignature(file);
  if (!project || !signature) return "";
  return `${project}::${signature}`;
}

function readVersionCompareExcelCacheMap() {
  try {
    const raw = localStorage.getItem(VERSION_COMPARE_EXCEL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeVersionCompareExcelCacheMap(cacheMap) {
  try {
    localStorage.setItem(VERSION_COMPARE_EXCEL_CACHE_KEY, JSON.stringify(cacheMap || {}));
  } catch (_) {}
}

function saveVersionCompareExcelResultCache(result, renderOptions = {}) {
  const file = versionCompareExcelFile?.files?.[0];
  const lookupKey = buildVersionCompareExcelCacheLookupKey(file);
  if (!lookupKey) return;
  const cacheMap = readVersionCompareExcelCacheMap();
  cacheMap[lookupKey] = {
    savedAt: new Date().toISOString(),
    result,
    options: renderOptions,
  };
  writeVersionCompareExcelCacheMap(cacheMap);
}

async function fetchVersionCompareExcelResultFromServer(file) {
  const projectName = getVersionCompareExcelCacheProjectName();
  const fileSignature = getVersionCompareExcelFileSignature(file);
  if (!projectName || !fileSignature) return null;
  const params = new URLSearchParams();
  params.set("project_context", projectName);
  params.set("file_signature", fileSignature);
  const response = await fetch(`${API_BASE_URL}/api/excel/compare-cache?${params.toString()}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`서버 저장 비교 결과 조회 실패 (${response.status})`);
  }
  const data = await response.json();
  if (!data || typeof data !== "object" || !data.result || typeof data.result !== "object") {
    return null;
  }
  return data;
}

async function fetchLatestVersionCompareExcelResultFromServer() {
  const projectName = getVersionCompareExcelCacheProjectName();
  if (!projectName) return null;
  const params = new URLSearchParams();
  params.set("project_context", projectName);
  const response = await fetch(`${API_BASE_URL}/api/excel/compare-cache/latest?${params.toString()}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`서버 최신 비교 결과 조회 실패 (${response.status})`);
  }
  const data = await response.json();
  if (!data || typeof data !== "object" || !data.result || typeof data.result !== "object") {
    return null;
  }
  return data;
}

async function restoreVersionCompareExcelResultFromCache() {
  const file = versionCompareExcelFile?.files?.[0];
  const lookupKey = buildVersionCompareExcelCacheLookupKey(file);
  if (!lookupKey) {
    try {
      const latest = await fetchLatestVersionCompareExcelResultFromServer();
      if (!latest?.result) return false;
      const renderOptions = {
        singleVersion: true,
        targetLabel: getSelectedVersionCompareLabel("new"),
      };
      renderVersionCompareExcelResult(latest.result, renderOptions);
      setVersionCompareExcelStatus("서버에 저장된 최근 엑셀 비교 결과를 불러왔습니다.");
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }
  const cacheMap = readVersionCompareExcelCacheMap();
  const hit = cacheMap[lookupKey];
  if (hit && hit.result) {
    renderVersionCompareExcelResult(hit.result, hit.options || {});
    setVersionCompareExcelStatus("이전에 저장된 엑셀 비교 결과를 불러왔습니다.");
    return true;
  }
  try {
    const serverHit = await fetchVersionCompareExcelResultFromServer(file);
    if (!serverHit?.result) return false;
    const renderOptions = {
      singleVersion: true,
      targetLabel: getSelectedVersionCompareLabel("new"),
    };
    renderVersionCompareExcelResult(serverHit.result, renderOptions);
    saveVersionCompareExcelResultCache(serverHit.result, renderOptions);
    setVersionCompareExcelStatus("서버에 저장된 엑셀 비교 결과를 불러왔습니다.");
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

function makeExcelColumnLetter(index) {
  let current = Number(index) + 1;
  if (!Number.isFinite(current) || current <= 0) return "";
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function getVersionCompareExcelFieldMeta(fieldKey) {
  return VERSION_COMPARE_EXCEL_FIELDS.find((item) => item.key === fieldKey) || VERSION_COMPARE_EXCEL_FIELDS[0];
}

function getVersionCompareExcelFieldInput(fieldKey) {
  switch (fieldKey) {
    case "building":
      return versionCompareExcelBuildingColumn;
    case "number":
      return versionCompareExcelNumberColumn;
    case "x":
      return versionCompareExcelXColumn;
    case "y":
      return versionCompareExcelYColumn;
    default:
      return null;
  }
}

function ensureVersionCompareExcelSelectionState() {
  if (!versionCompareExcelSelectionState || typeof versionCompareExcelSelectionState !== "object") {
    versionCompareExcelSelectionState = {
      activeField: "building",
      selectedSheets: [],
      buildingSourceMode: "sheet",
      headerRowBySheet: {},
    };
  }
  if (!Array.isArray(versionCompareExcelSelectionState.selectedSheets)) {
    versionCompareExcelSelectionState.selectedSheets = [];
  }
  if (!versionCompareExcelSelectionState.headerRowBySheet || typeof versionCompareExcelSelectionState.headerRowBySheet !== "object") {
    versionCompareExcelSelectionState.headerRowBySheet = {};
  }
  if (!versionCompareExcelSelectionState.headerMarkers || typeof versionCompareExcelSelectionState.headerMarkers !== "object") {
    versionCompareExcelSelectionState.headerMarkers = { number: "", x: "", y: "" };
  }
  if (!["sheet", "column"].includes(versionCompareExcelSelectionState.buildingSourceMode)) {
    versionCompareExcelSelectionState.buildingSourceMode = versionCompareExcelUseSheetBuilding?.checked ? "sheet" : "column";
  }
  if (!versionCompareExcelSelectionState.activeField) {
    versionCompareExcelSelectionState.activeField = "building";
  }
}

function getVersionCompareExcelBuildingSourceMode() {
  ensureVersionCompareExcelSelectionState();
  return versionCompareExcelSelectionState.buildingSourceMode;
}

function getVersionCompareExcelAssignableFields() {
  const mode = getVersionCompareExcelBuildingSourceMode();
  return VERSION_COMPARE_EXCEL_FIELDS.filter((field) => !(mode === "sheet" && field.key === "building"));
}

function getVersionCompareExcelSelectedSheetNames() {
  ensureVersionCompareExcelSelectionState();
  return versionCompareExcelSelectionState.selectedSheets.filter((sheetName) => typeof sheetName === "string" && sheetName);
}

function updateVersionCompareExcelApplyState({ busy = false } = {}) {
  if (!versionCompareExcelApply) return;
  versionCompareExcelApply.disabled = Boolean(busy);
}

function setVersionCompareExcelBuildingSourceMode(mode, { updateSuggestions = true } = {}) {
  ensureVersionCompareExcelSelectionState();
  const nextMode = mode === "column" ? "column" : "sheet";
  versionCompareExcelSelectionState.buildingSourceMode = nextMode;
  if (versionCompareExcelUseSheetBuilding) {
    versionCompareExcelUseSheetBuilding.checked = nextMode === "sheet";
  }
  if (versionCompareExcelBuildingSource) {
    versionCompareExcelBuildingSource.querySelectorAll("[data-building-source-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.buildingSourceMode === nextMode);
    });
  }
  if (nextMode === "sheet") {
    if (versionCompareExcelBuildingColumn) versionCompareExcelBuildingColumn.value = "";
    if (versionCompareExcelSelectionState.activeField === "building") {
      versionCompareExcelSelectionState.activeField = "number";
    }
  } else if (updateSuggestions) {
    const sheetInfo = getVersionCompareSelectedSheetInfo();
    if (sheetInfo && !String(versionCompareExcelBuildingColumn?.value || "").trim()) {
      if (versionCompareExcelBuildingColumn) {
        versionCompareExcelBuildingColumn.value = guessExcelColumnSpec(sheetInfo, getVersionCompareExcelFieldMeta("building").keywords, getVersionCompareExcelFieldMeta("building").fallbackIndex);
      }
    }
  }
  renderVersionCompareExcelFieldButtons();
  renderVersionCompareExcelSelectionSummary();
  renderVersionCompareExcelPreview();
  resetVersionCompareExcelCompareResult();
}

function getVersionCompareExcelColumnLetter(sheetInfo, columnIndex) {
  if (sheetInfo?.columnLetters?.[columnIndex]) {
    return sheetInfo.columnLetters[columnIndex];
  }
  return makeExcelColumnLetter(columnIndex);
}

function getVersionCompareExcelHeaderRowNumber(sheetInfo) {
  const name = sheetInfo?.name;
  ensureVersionCompareExcelSelectionState();
  const stored = name && Object.prototype.hasOwnProperty.call(versionCompareExcelSelectionState.headerRowBySheet, name)
    ? versionCompareExcelSelectionState.headerRowBySheet[name]
    : null;
  if (stored != null) {
    const n = Number(stored);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  const fallback = Number(sheetInfo?.suggestedHeaderRow) || 1;
  const rowNumber = Number(versionCompareExcelHeaderRow?.value);
  return Number.isFinite(rowNumber) && rowNumber > 0 ? Math.trunc(rowNumber) : fallback;
}

function getVersionCompareExcelHeaderRowValues(sheetInfo) {
  const headerRowNumber = getVersionCompareExcelHeaderRowNumber(sheetInfo);
  const headerRow = (sheetInfo?.preview || []).find((row) => row.rowNumber === headerRowNumber);
  return Array.isArray(headerRow?.values) ? headerRow.values : [];
}

/** 현재 시트·헤더 행·열 지정으로 번호/X/Y 열 헤더 셀 글자를 저장 — 서버에서 시트마다 동일 글자 행을 찾음 */
function syncVersionCompareExcelHeaderMarkersFromSelection() {
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  ensureVersionCompareExcelSelectionState();
  if (!sheetInfo) return;
  const headers = getVersionCompareExcelHeaderRowValues(sheetInfo);
  ["number", "x", "y"].forEach((key) => {
    const input = getVersionCompareExcelFieldInput(key);
    const spec = String(input?.value || "").trim();
    if (!spec) return;
    const idx = findVersionCompareExcelColumnIndex(sheetInfo, spec);
    if (idx >= 0 && headers[idx] != null && String(headers[idx]).trim() !== "") {
      versionCompareExcelSelectionState.headerMarkers[key] = String(headers[idx]).trim();
    }
  });
}

function resetVersionCompareExcelFieldValues() {
  getVersionCompareExcelAssignableFields().forEach((field) => {
    const input = getVersionCompareExcelFieldInput(field.key);
    if (input) {
      input.value = "";
    }
  });
}

function resetVersionCompareExcelInspectState() {
  versionCompareExcelInspection = null;
    versionCompareExcelSelectionState = {
      activeField: "building",
      selectedSheets: [],
      buildingSourceMode: versionCompareExcelUseSheetBuilding?.checked ? "sheet" : "column",
      headerRowBySheet: {},
      headerMarkers: { number: "", x: "", y: "" },
    };
  if (versionCompareExcelSheet) {
    versionCompareExcelSheet.innerHTML = "";
    versionCompareExcelSheet.value = "";
  }
  if (versionCompareExcelHeaderRow) {
    versionCompareExcelHeaderRow.value = "1";
  }
  resetVersionCompareExcelFieldValues();
  setVersionCompareExcelBuildingSourceMode(versionCompareExcelSelectionState.buildingSourceMode, { updateSuggestions: false });
  renderVersionCompareExcelSheetTabs();
  renderVersionCompareExcelFieldButtons();
  renderVersionCompareExcelSelectionSummary();
  if (versionCompareExcelPreview) {
    versionCompareExcelPreview.innerHTML = '<div class="empty-row">엑셀 파일을 선택하면 샘플이 여기에 표시됩니다.</div>';
  }
  updateVersionCompareExcelApplyState();
}

function resetVersionCompareExcelCompareResult() {
  versionCompareExcelIssueFilter = "all";
  versionCompareExcelLastResult = null;
  versionCompareExcelLastRenderOptions = {};
  if (versionCompareExcelSummary) {
    versionCompareExcelSummary.innerHTML = "";
  }
  if (versionCompareExcelIssues) {
    versionCompareExcelIssues.innerHTML = "";
  }
  updateVersionCompareExcelApplyState();
}

function getVersionCompareSelectedSheetInfo() {
  if (!versionCompareExcelInspection || !Array.isArray(versionCompareExcelInspection.sheets)) return null;
  const sheetName = versionCompareExcelSheet?.value || versionCompareExcelInspection.sheetNames?.[0];
  return versionCompareExcelInspection.sheets.find((sheet) => sheet.name === sheetName) || null;
}

function guessExcelColumnSpec(sheetInfo, keywords, fallbackIndex) {
  if (!sheetInfo) return "";
  const values = getVersionCompareExcelHeaderRowValues(sheetInfo);
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  for (let i = 0; i < values.length; i += 1) {
    const value = String(values[i] || "").trim();
    if (!value) continue;
    const lowered = value.toLowerCase();
    if (loweredKeywords.some((keyword) => lowered.includes(keyword))) {
      return getVersionCompareExcelColumnLetter(sheetInfo, i);
    }
  }
  return getVersionCompareExcelColumnLetter(sheetInfo, fallbackIndex);
}

function applyVersionCompareExcelSuggestions(sheetInfo) {
  if (!sheetInfo) return;
  getVersionCompareExcelAssignableFields().forEach((field) => {
    const input = getVersionCompareExcelFieldInput(field.key);
    if (input) {
      input.value = guessExcelColumnSpec(sheetInfo, field.keywords, field.fallbackIndex);
    }
  });
  if (getVersionCompareExcelBuildingSourceMode() === "sheet" && versionCompareExcelBuildingColumn) {
    versionCompareExcelBuildingColumn.value = "";
  }
}

function findVersionCompareExcelColumnIndex(sheetInfo, spec) {
  const normalized = String(spec || "").trim();
  if (!normalized) return -1;
  const letters = sheetInfo?.columnLetters || [];
  const upper = normalized.toUpperCase();
  const letterIndex = letters.findIndex((letter) => String(letter || "").toUpperCase() === upper);
  if (letterIndex >= 0) return letterIndex;
  const headerValues = getVersionCompareExcelHeaderRowValues(sheetInfo).map((value) => String(value || "").trim().toLowerCase());
  return headerValues.findIndex((value) => value && value === normalized.toLowerCase());
}

function getVersionCompareExcelAssignedFieldKeysByIndex(sheetInfo, columnIndex) {
  return getVersionCompareExcelAssignableFields().filter((field) => {
    const input = getVersionCompareExcelFieldInput(field.key);
    return findVersionCompareExcelColumnIndex(sheetInfo, input?.value) === columnIndex;
  }).map((field) => field.key);
}

function getVersionCompareExcelPrimaryAssignedField(sheetInfo, columnIndex) {
  return getVersionCompareExcelAssignedFieldKeysByIndex(sheetInfo, columnIndex)[0] || "";
}

function getVersionCompareExcelSelectionDetails(sheetInfo, fieldKey) {
  const meta = getVersionCompareExcelFieldMeta(fieldKey);
  if (fieldKey === "building" && getVersionCompareExcelBuildingSourceMode() === "sheet") {
    return { meta, text: "시트명 사용", letter: "", header: "", locked: true };
  }
  const input = getVersionCompareExcelFieldInput(fieldKey);
  const spec = String(input?.value || "").trim();
  if (!spec) {
    return { meta, text: "미지정", letter: "", header: "", locked: false };
    if (fieldKey === "building" && versionCompareExcelUseSheetBuilding?.checked) {
      return { meta, text: "시트명 사용", letter: "", header: "" };
    }
    return { meta, text: "미지정", letter: "", header: "" };
  }
  const columnIndex = findVersionCompareExcelColumnIndex(sheetInfo, spec);
  const headerValues = getVersionCompareExcelHeaderRowValues(sheetInfo);
  const letter = columnIndex >= 0 ? getVersionCompareExcelColumnLetter(sheetInfo, columnIndex) : spec.toUpperCase();
  const header = columnIndex >= 0 ? String(headerValues[columnIndex] || "").trim() : "";
  const text = header ? header : `${letter} 컬럼`;
  return { meta, text, letter, header };
}

function renderVersionCompareExcelFieldButtons() {
  if (!versionCompareExcelFieldButtons) return;
  ensureVersionCompareExcelSelectionState();
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  versionCompareExcelFieldButtons.innerHTML = VERSION_COMPARE_EXCEL_FIELDS.map((field) => {
    const detail = getVersionCompareExcelSelectionDetails(sheetInfo, field.key);
    const isActive = versionCompareExcelSelectionState.activeField === field.key;
    const isAssigned = detail.locked || detail.text !== "미지정";
    return `
      <button
        type="button"
        class="version-compare-excel-field-btn${isActive ? " is-active" : ""}${isAssigned ? " is-assigned" : ""}${detail.locked ? " is-disabled" : ""}"
        data-field="${field.key}"
        ${detail.locked ? "disabled" : ""}
      >
        <strong>${escapeHtml(field.label)}</strong>
        <small>${escapeHtml(detail.text)}</small>
      </button>
    `;
  }).join("");
  versionCompareExcelFieldButtons.querySelectorAll("button[data-field]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      setVersionCompareExcelActiveField(button.dataset.field || "building");
    });
  });
}

function renderVersionCompareExcelSelectionSummary() {
  if (!versionCompareExcelSelectionSummary) return;
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  const headerRowNumber = getVersionCompareExcelHeaderRowNumber(sheetInfo);
  const selectedSheets = getVersionCompareExcelSelectedSheetNames();
  const buildingSourceLabel = getVersionCompareExcelBuildingSourceMode() === "sheet" ? "시트명 동으로 사용" : "헤더에서 동 선택";
  const metaHtml = `
    <div class="version-compare-excel-selection-item">
      <strong>사용 시트</strong>
      <span class="version-compare-excel-selection-value">
        <span class="version-compare-excel-selection-badge">${selectedSheets.length}</span>
        ${escapeHtml(selectedSheets.join(", ") || "선택 없음")}
      </span>
    </div>
    <div class="version-compare-excel-selection-item">
      <strong>동명 방식</strong>
      <span class="version-compare-excel-selection-value">${escapeHtml(buildingSourceLabel)}</span>
    </div>
  `;
  const headerRowHtml = `
    <div class="version-compare-excel-selection-item">
      <strong>헤더 행</strong>
      <span class="version-compare-excel-selection-value">
        <span class="version-compare-excel-selection-badge">${headerRowNumber}행</span>
        행 번호 클릭으로 변경
      </span>
    </div>
  `;
  ensureVersionCompareExcelSelectionState();
  const hm = versionCompareExcelSelectionState.headerMarkers || {};
  const hmOk = Boolean(hm.number && hm.x && hm.y);
  const headerMarkerHtml = hmOk
    ? `
    <div class="version-compare-excel-selection-item">
      <strong>헤더 찾기</strong>
      <span class="version-compare-excel-selection-value" title="각 시트에서 아래 글자가 동시에 나타나는 행을 헤더로 사용합니다.">
        헤더명 기준 자동 · 번호 ${escapeHtml(hm.number)} · X ${escapeHtml(hm.x)} · Y ${escapeHtml(hm.y)}
      </span>
    </div>`
    : "";
  const fieldHtml = VERSION_COMPARE_EXCEL_FIELDS.map((field) => {
    const detail = getVersionCompareExcelSelectionDetails(sheetInfo, field.key);
    const badge = detail.letter
      ? `<span class="version-compare-excel-selection-badge">${escapeHtml(detail.letter)}</span>`
      : "";
    return `
      <div class="version-compare-excel-selection-item">
        <strong>${escapeHtml(field.description)}</strong>
        <span class="version-compare-excel-selection-value">${badge}${escapeHtml(detail.text)}</span>
      </div>
    `;
  }).join("");
  versionCompareExcelSelectionSummary.innerHTML = headerRowHtml + metaHtml + headerMarkerHtml + fieldHtml;
}

function renderVersionCompareExcelSheetTabs() {
  if (!versionCompareExcelSheetTabs) return;
  ensureVersionCompareExcelSelectionState();
  const sheetNames = versionCompareExcelInspection?.sheetNames || [];
  if (!sheetNames.length) {
    versionCompareExcelSheetTabs.innerHTML = '<div class="empty-row">샘플을 불러오면 시트 목록이 표시됩니다.</div>';
    return;
  }
  const selected = versionCompareExcelSheet?.value || sheetNames[0];
  const selectedSheets = new Set(getVersionCompareExcelSelectedSheetNames());
  versionCompareExcelSheetTabs.innerHTML = sheetNames.map((sheetName) => `
    <div class="version-compare-excel-sheet-row${sheetName === selected ? " is-active" : ""}">
      <label class="version-compare-excel-sheet-check">
        <input type="checkbox" data-sheet-enabled="${escapeHtml(sheetName)}" ${selectedSheets.has(sheetName) ? "checked" : ""} />
        <span>${escapeHtml(sheetName)}</span>
      </label>
      <button
        type="button"
        class="version-compare-excel-sheet-tab${sheetName === selected ? " is-active" : ""}"
        data-sheet="${escapeHtml(sheetName)}"
      >
        보기
      </button>
    </div>
  `).join("");
  versionCompareExcelSheetTabs.querySelectorAll("button[data-sheet]").forEach((button) => {
    button.addEventListener("click", () => handleVersionCompareExcelSheetChange(button.dataset.sheet || ""));
  });
  versionCompareExcelSheetTabs.querySelectorAll("input[data-sheet-enabled]").forEach((input) => {
    input.addEventListener("change", () => {
      ensureVersionCompareExcelSelectionState();
      const sheetName = input.dataset.sheetEnabled || "";
      const enabled = new Set(getVersionCompareExcelSelectedSheetNames());
      if (input.checked) enabled.add(sheetName);
      else enabled.delete(sheetName);
      versionCompareExcelSelectionState.selectedSheets = sheetNames.filter((name) => enabled.has(name));
      renderVersionCompareExcelSheetTabs();
      renderVersionCompareExcelSelectionSummary();
      resetVersionCompareExcelCompareResult();
    });
  });
  return;
  versionCompareExcelSheetTabs.innerHTML = sheetNames.map((sheetName) => `
    <button
      type="button"
      class="version-compare-excel-sheet-tab${sheetName === selected ? " is-active" : ""}"
      data-sheet="${escapeHtml(sheetName)}"
    >
      ${escapeHtml(sheetName)}
    </button>
  `).join("");
  versionCompareExcelSheetTabs.querySelectorAll("button[data-sheet]").forEach((button) => {
    button.addEventListener("click", () => handleVersionCompareExcelSheetChange(button.dataset.sheet || ""));
  });
}

function setVersionCompareExcelActiveField(fieldKey) {
  ensureVersionCompareExcelSelectionState();
  const requested = getVersionCompareExcelFieldMeta(fieldKey).key;
  const assignable = getVersionCompareExcelAssignableFields();
  versionCompareExcelSelectionState.activeField = assignable.some((field) => field.key === requested)
    ? requested
    : (assignable[0]?.key || "number");
  renderVersionCompareExcelFieldButtons();
  renderVersionCompareExcelPreview();
}

function setVersionCompareExcelHeaderRow(rowNumber, options = {}) {
  const { applySuggestions = false } = options;
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  const nextRow = Math.max(1, Number(rowNumber) || Number(sheetInfo?.suggestedHeaderRow) || 1);
  if (sheetInfo?.name) {
    ensureVersionCompareExcelSelectionState();
    versionCompareExcelSelectionState.headerRowBySheet[sheetInfo.name] = nextRow;
  }
  if (versionCompareExcelHeaderRow) {
    versionCompareExcelHeaderRow.value = String(nextRow);
  }
  if (applySuggestions) {
    applyVersionCompareExcelSuggestions(sheetInfo);
  }
  renderVersionCompareExcelFieldButtons();
  renderVersionCompareExcelSelectionSummary();
  renderVersionCompareExcelPreview();
}

function handleVersionCompareExcelSheetChange(sheetName, options = {}) {
  const { applySuggestions = false } = options;
  if (!versionCompareExcelSheet) return;
  const nextSheetName = sheetName || versionCompareExcelInspection?.sheetNames?.[0] || "";
  versionCompareExcelSheet.value = nextSheetName;
  renderVersionCompareExcelSheetTabs();
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  ensureVersionCompareExcelSelectionState();
  const saved = sheetInfo?.name != null ? versionCompareExcelSelectionState.headerRowBySheet[sheetInfo.name] : null;
  const rowToUse =
    saved != null && Number(saved) > 0
      ? Number(saved)
      : sheetInfo?.suggestedHeaderRow || 1;
  setVersionCompareExcelHeaderRow(rowToUse, { applySuggestions });
  resetVersionCompareExcelCompareResult();
}

function setVersionCompareExcelField(fieldKey, columnIndex) {
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  if (!sheetInfo || columnIndex < 0) return;
  const letter = getVersionCompareExcelColumnLetter(sheetInfo, columnIndex);
  VERSION_COMPARE_EXCEL_FIELDS.forEach((field) => {
    const input = getVersionCompareExcelFieldInput(field.key);
    if (!input) return;
    if (field.key === fieldKey) {
      input.value = letter;
      return;
    }
    if (String(input.value || "").trim().toUpperCase() === letter.toUpperCase()) {
      input.value = "";
    }
  });
  const nextField = getVersionCompareExcelAssignableFields().find((field) => {
    const input = getVersionCompareExcelFieldInput(field.key);
    return !(input?.value || "").trim();
  });
  versionCompareExcelSelectionState.activeField = nextField ? nextField.key : fieldKey;
  renderVersionCompareExcelFieldButtons();
  renderVersionCompareExcelSelectionSummary();
  renderVersionCompareExcelPreview();
  resetVersionCompareExcelCompareResult();
}

function renderVersionCompareExcelPreview() {
  if (!versionCompareExcelPreview) return;
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  if (!sheetInfo) {
    versionCompareExcelPreview.innerHTML = '<div class="empty-row">샘플을 불러오면 엑셀 내용이 여기 표시됩니다.</div>';
    return;
  }
  const selectedHeaderRow = getVersionCompareExcelHeaderRowNumber(sheetInfo);
  const headerCells = (sheetInfo.columnLetters || []).map((letter) => `<th>${escapeHtml(letter)}</th>`).join("");
  const bodyRows = (sheetInfo.preview || []).map((row) => {
    const isHeaderRow = row.rowNumber === selectedHeaderRow;
    const rowClass = isHeaderRow ? ' class="is-header-row"' : "";
    const cells = (row.values || []).map((value, columnIndex) => {
      const assignedField = getVersionCompareExcelPrimaryAssignedField(sheetInfo, columnIndex);
      const assignedMeta = assignedField ? getVersionCompareExcelFieldMeta(assignedField) : null;
      const classes = [];
      if (isHeaderRow) classes.push("is-clickable");
      if (assignedField) {
        classes.push("is-assigned", `is-assigned-${assignedField}`);
      }
      if (assignedField === versionCompareExcelSelectionState.activeField) {
        classes.push("is-active-target");
      }
      const badge = assignedMeta
        ? `<span class="version-compare-excel-cell-badge">${escapeHtml(assignedMeta.label)}</span>`
        : "";
      return `
        <td class="${classes.join(" ")}" ${isHeaderRow ? `data-column-index="${columnIndex}"` : ""}>
          ${escapeHtml(String(value || ""))}${badge}
        </td>
      `;
    }).join("");
    return `
      <tr${rowClass}>
        <th class="row-index">
          <button type="button" class="version-compare-excel-row-button${isHeaderRow ? " is-selected" : ""}" data-row-number="${row.rowNumber}">
            ${row.rowNumber}
          </button>
        </th>
        ${cells}
      </tr>
    `;
  }).join("");
  versionCompareExcelPreview.innerHTML = `
    <div class="version-compare-excel-preview-header">
      <div>
        <strong>${escapeHtml(sheetInfo.name)}</strong>
        <div class="version-compare-excel-preview-meta">
          <span>추천 헤더 ${sheetInfo.suggestedHeaderRow}행</span>
          <span>현재 헤더 ${selectedHeaderRow}행</span>
          <span>활성 선택 ${escapeHtml(getVersionCompareExcelFieldMeta(versionCompareExcelSelectionState.activeField).description)}</span>
        </div>
      </div>
    </div>
    <p class="version-compare-excel-preview-tip">1. 왼쪽 행 번호를 눌러 헤더 행을 정합니다. 2. 파란 강조 대상 항목을 고른 뒤 헤더 셀을 클릭하면 컬럼이 지정됩니다. 번호·X·Y 헤더 글자가 모두 잡히면 시트마다 그 글자가 있는 행을 자동으로 찾습니다.</p>
    <div class="version-compare-excel-table-wrap">
      <table class="version-compare-excel-table">
        <thead>
          <tr><th class="row-index">행</th>${headerCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
  versionCompareExcelPreview.querySelectorAll("button[data-row-number]").forEach((button) => {
    button.addEventListener("click", () => {
      setVersionCompareExcelHeaderRow(button.dataset.rowNumber);
      resetVersionCompareExcelCompareResult();
    });
  });
  versionCompareExcelPreview.querySelectorAll("td[data-column-index]").forEach((cell) => {
    cell.addEventListener("click", () => {
      setVersionCompareExcelField(
        versionCompareExcelSelectionState.activeField,
        Number(cell.dataset.columnIndex),
      );
    });
  });
  syncVersionCompareExcelHeaderMarkersFromSelection();
}

async function inspectVersionCompareExcelFile() {
  const file = versionCompareExcelFile?.files?.[0];
  if (!file) {
    setUploadStatus("비교할 엑셀 파일을 선택하세요.", true);
    setVersionCompareExcelStatus("비교할 엑셀 파일을 선택하세요.", true);
    return;
  }
  openVersionCompareExcelModal();
  const button = versionCompareExcelInspect;
  if (button) button.disabled = true;
  setVersionCompareExcelStatus("엑셀 샘플을 읽는 중입니다.");
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/excel/inspect`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    versionCompareExcelInspection = await response.json();
    const headerRowBySheetInit = {};
    (versionCompareExcelInspection.sheets || []).forEach((sh) => {
      if (sh?.name) {
        headerRowBySheetInit[sh.name] = Math.max(1, Number(sh.suggestedHeaderRow) || 1);
      }
    });
    versionCompareExcelSelectionState = {
      activeField: getVersionCompareExcelBuildingSourceMode() === "sheet" ? "number" : "building",
      selectedSheets: [...(versionCompareExcelInspection.sheetNames || [])],
      buildingSourceMode: getVersionCompareExcelBuildingSourceMode(),
      headerRowBySheet: headerRowBySheetInit,
      headerMarkers: { number: "", x: "", y: "" },
    };
    if (versionCompareExcelSheet) {
      versionCompareExcelSheet.innerHTML = "";
      (versionCompareExcelInspection.sheetNames || []).forEach((sheetName) => {
        const option = document.createElement("option");
        option.value = sheetName;
        option.textContent = sheetName;
        versionCompareExcelSheet.appendChild(option);
      });
    }
    const firstSheetName = versionCompareExcelInspection.sheetNames?.[0] || "";
    if (versionCompareExcelSheet) {
      versionCompareExcelSheet.value = firstSheetName;
    }
    renderVersionCompareExcelSheetTabs();
    setVersionCompareExcelBuildingSourceMode(versionCompareExcelSelectionState.buildingSourceMode, { updateSuggestions: false });
    handleVersionCompareExcelSheetChange(firstSheetName, { applySuggestions: true });
    setUploadStatus("엑셀 샘플을 불러왔습니다.");
    setVersionCompareExcelStatus("엑셀 샘플을 불러왔습니다.");
  } catch (error) {
    console.error(error);
    const message = parseErrorMessage(error) || "엑셀 샘플 확인에 실패했습니다.";
    setUploadStatus(message, true);
    setVersionCompareExcelStatus(message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderVersionCompareExcelResult(result, options = {}) {
  if (!versionCompareExcelSummary || !versionCompareExcelIssues) return;
  versionCompareExcelLastResult = result;
  versionCompareExcelLastRenderOptions = { ...options };
  const summary = result.summary || {};
  const sheetSummaries = Array.isArray(result.sheetSummaries) ? result.sheetSummaries : [];
  const labels = result.versionLabels || { old: "이전 버전", new: "현재 버전" };
  const singleVersion = Boolean(options.singleVersion);
  const targetLabel = options.targetLabel || labels.new || "현재 버전";
  const cards = singleVersion
    ? [
      { label: "엑셀 유효 행", value: summary.totalRows ?? 0 },
      { label: "건너뜀", value: summary.skippedRows ?? 0 },
      { label: `${targetLabel} 일치`, value: summary.matchBoth ?? 0 },
      { label: `${targetLabel} 누락`, value: summary.missingBoth ?? 0 },
      { label: "좌표 불일치", value: summary.coordMismatch ?? 0 },
    ]
    : [
      { label: "엑셀 유효 행", value: summary.totalRows ?? 0 },
      { label: "건너뜀", value: summary.skippedRows ?? 0 },
      { label: "양쪽 일치", value: summary.matchBoth ?? 0 },
      { label: `${labels.old}만 일치`, value: summary.matchOldOnly ?? 0 },
      { label: `${labels.new}만 일치`, value: summary.matchNewOnly ?? 0 },
      { label: `${labels.old} 누락`, value: summary.missingOld ?? 0 },
      { label: `${labels.new} 누락`, value: summary.missingNew ?? 0 },
      { label: "양쪽 누락", value: summary.missingBoth ?? 0 },
      { label: "좌표 불일치", value: summary.coordMismatch ?? 0 },
    ];
  versionCompareExcelSummary.innerHTML = `
    <div class="version-compare-excel-summary-grid">
      ${cards.map((card) => `
        <div class="version-compare-excel-summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${card.value}</strong>
        </div>
      `).join("")}
    </div>
    ${sheetSummaries.length > 1 ? `
      <div class="version-compare-excel-sheet-summary-list">
        ${sheetSummaries.map((sheet) => `
          <div class="version-compare-excel-sheet-summary-item">
            <strong>${escapeHtml(sheet.sheetName || "-")}</strong>
            <span>유효 ${sheet.summary?.totalRows ?? 0}</span>
            <span>${singleVersion ? "일치" : "양쪽"} ${sheet.summary?.matchBoth ?? 0}</span>
            ${singleVersion
              ? `<span>누락 ${sheet.summary?.missingBoth ?? 0}</span>`
              : `<span>${escapeHtml(labels.old)}만 ${sheet.summary?.matchOldOnly ?? 0}</span><span>${escapeHtml(labels.new)}만 ${sheet.summary?.matchNewOnly ?? 0}</span>`}
            <span>불일치 ${sheet.summary?.coordMismatch ?? 0}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  const statusLabel = singleVersion
    ? {
      "match-both": `${targetLabel} 일치`,
      "match-old-only": `${targetLabel} 일치`,
      "match-new-only": `${targetLabel} 일치`,
      "missing-both": `${targetLabel} 누락`,
      "missing-old": `${targetLabel} 누락`,
      "missing-new": `${targetLabel} 누락`,
      "coord-mismatch": "좌표 불일치",
    }
    : {
      "match-old-only": `${labels.old}만 일치`,
      "match-new-only": `${labels.new}만 일치`,
      "missing-both": "양쪽 누락",
      "missing-old": `${labels.old} 누락`,
      "missing-new": `${labels.new} 누락`,
      "coord-mismatch": "좌표 불일치",
    };
  const issues = Array.isArray(result.issues) ? result.issues : [];
  if (!issues.length) {
    versionCompareExcelIssues.innerHTML = '<div class="empty-row">불일치 항목이 없습니다.</div>';
    return;
  }
  const pickIssueDistance = (issue) => {
    if (issue?.newCircle?.distance != null && Number.isFinite(Number(issue.newCircle.distance))) {
      return Number(issue.newCircle.distance);
    }
    if (issue?.oldCircle?.distance != null && Number.isFinite(Number(issue.oldCircle.distance))) {
      return Number(issue.oldCircle.distance);
    }
    return null;
  };
  const issueFilterType = (issue) => {
    const status = String(issue?.status || "");
    if (status === "coord-mismatch") {
      const dist = pickIssueDistance(issue);
      if (dist != null && dist >= VERSION_COMPARE_EXCEL_SEVERE_DIFF_THRESHOLD) return "big-diff";
      return "small-diff";
    }
    if (status.startsWith("missing-")) return "missing";
    return "other";
  };
  const filterCounts = { all: issues.length, "big-diff": 0, "small-diff": 0, missing: 0 };
  issues.forEach((issue) => {
    const t = issueFilterType(issue);
    if (Object.prototype.hasOwnProperty.call(filterCounts, t)) filterCounts[t] += 1;
  });
  const allowedFilters = new Set(["all", "big-diff", "small-diff", "missing"]);
  if (!allowedFilters.has(versionCompareExcelIssueFilter)) versionCompareExcelIssueFilter = "all";
  const filteredIssues = issues.filter((issue) => {
    if (versionCompareExcelIssueFilter === "all") return true;
    return issueFilterType(issue) === versionCompareExcelIssueFilter;
  });
  const issueColumns = singleVersion
    ? `<th>${escapeHtml(targetLabel)}</th>`
    : `<th>${escapeHtml(labels.old)}</th><th>${escapeHtml(labels.new)}</th>`;
  const filterBadges = [
    { key: "all", label: "전체", count: filterCounts.all },
    { key: "big-diff", label: "차이 큰거", count: filterCounts["big-diff"] },
    { key: "small-diff", label: "차이 작은거", count: filterCounts["small-diff"] },
    { key: "missing", label: "누락", count: filterCounts.missing },
  ];
  versionCompareExcelIssues.innerHTML = `
    <div class="version-compare-excel-issue-filters">
      ${filterBadges.map((badge) => `
        <button
          type="button"
          class="version-compare-excel-issue-filter${versionCompareExcelIssueFilter === badge.key ? " is-active" : ""}"
          data-vc-excel-filter="${badge.key}"
        >
          ${escapeHtml(badge.label)} <span>${badge.count}</span>
        </button>
      `).join("")}
    </div>
    <div class="version-compare-excel-table-wrap">
      <table class="version-compare-excel-table">
        <thead>
          <tr>
            <th>시트명 · 비교 번호</th>
            <th>상태</th>
            <th>동</th>
            <th>엑셀 좌표</th>
            ${issueColumns}
          </tr>
        </thead>
        <tbody>
          ${filteredIssues.map((issue) => {
            const status = String(issue?.status || "");
            const dist = pickIssueDistance(issue);
            const rowClass =
              status === "coord-mismatch"
                ? dist != null && dist >= VERSION_COMPARE_EXCEL_SEVERE_DIFF_THRESHOLD
                  ? "is-severe-mismatch"
                  : "is-mismatch"
                : status.startsWith("missing-")
                  ? "is-missing"
                  : "";
            return `
            <tr class="${rowClass}">
              <td>${escapeHtml(issue.sheetName || "-")} · ${escapeHtml(issue.number || "-")}</td>
              <td>${escapeHtml(statusLabel[issue.status] || issue.status || "-")}</td>
              <td>${escapeHtml(issue.buildingName || "-")}</td>
              <td>${formatNumber(issue.excelX)}, ${formatNumber(issue.excelY)}</td>
              ${singleVersion
                ? `<td>${(issue.newCircle || issue.oldCircle) ? `${formatNumber((issue.newCircle || issue.oldCircle).x)}, ${formatNumber((issue.newCircle || issue.oldCircle).y)} (${formatNumber((issue.newCircle || issue.oldCircle).distance, 3)}) · 번호 ${(issue.newCircle || issue.oldCircle).number ?? "-"}` : "-"}</td>`
                : `<td>${issue.oldCircle ? `${formatNumber(issue.oldCircle.x)}, ${formatNumber(issue.oldCircle.y)} (${formatNumber(issue.oldCircle.distance, 3)}) · 번호 ${issue.oldCircle.number ?? "-"}` : "-"}</td><td>${issue.newCircle ? `${formatNumber(issue.newCircle.x)}, ${formatNumber(issue.newCircle.y)} (${formatNumber(issue.newCircle.distance, 3)}) · 번호 ${issue.newCircle.number ?? "-"}` : "-"}</td>`}
            </tr>
          `;
          }).join("")}
          ${!filteredIssues.length ? `
            <tr>
              <td colspan="${singleVersion ? 5 : 6}" class="version-compare-excel-issues-empty">선택한 필터에 해당하는 항목이 없습니다.</td>
            </tr>
          ` : ""}
        </tbody>
      </table>
    </div>
  `;
}

async function runVersionCompareExcelCompare() {
  const file = versionCompareExcelFile?.files?.[0];
  if (!file) {
    setUploadStatus("비교할 엑셀 파일을 선택하세요.", true);
    setVersionCompareExcelStatus("비교할 엑셀 파일을 선택하세요.", true);
    return;
  }
  if (!versionCompareExcelInspection) {
    await inspectVersionCompareExcelFile();
    if (!versionCompareExcelInspection) return;
  }
  const sheetInfo = getVersionCompareSelectedSheetInfo();
  if (!sheetInfo) {
    setUploadStatus("비교할 시트를 선택하세요.", true);
    setVersionCompareExcelStatus("비교할 시트를 선택하세요.", true);
    return;
  }
  const numberColumn = String(versionCompareExcelNumberColumn?.value || "").trim();
  const xColumn = String(versionCompareExcelXColumn?.value || "").trim();
  const yColumn = String(versionCompareExcelYColumn?.value || "").trim();
  const buildingColumn = String(versionCompareExcelBuildingColumn?.value || "").trim();
  const buildingSourceMode = getVersionCompareExcelBuildingSourceMode();
  const selectedSheetNames = getVersionCompareExcelSelectedSheetNames();
  if (!numberColumn || !xColumn || !yColumn) {
    setUploadStatus("번호, X, Y 컬럼은 헤더 셀 클릭으로 먼저 지정하세요.", true);
    setVersionCompareExcelStatus("번호, X, Y 컬럼을 먼저 지정하세요.", true);
    return;
  }
  if (!selectedSheetNames.length) {
    setUploadStatus("비교에 사용할 시트를 1개 이상 체크하세요.", true);
    setVersionCompareExcelStatus("비교에 사용할 시트를 1개 이상 체크하세요.", true);
    return;
  }
  if (!buildingColumn && buildingSourceMode !== "sheet") {
    setUploadStatus("동 컬럼을 지정하거나 시트명을 동으로 사용하는 옵션을 켜세요.", true);
    setVersionCompareExcelStatus("동 컬럼을 지정하거나 시트명 동 사용을 선택하세요.", true);
    return;
  }
  updateVersionCompareExcelApplyState({ busy: true });
  const originalLabel = versionCompareExcelApply?.textContent || "엑셀 비교 실행";
  try {
    if (versionCompareExcelApply) versionCompareExcelApply.textContent = "비교 중...";
    setUploadStatus("엑셀 비교 대상을 준비하는 중...");
    setVersionCompareExcelStatus("현재 버전 좌표를 준비하는 중입니다.");
    const { versionA, versionB, labels, singleVersion } = await resolveVersionCompareSelection({ singleVersion: true });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sheet_name", sheetInfo.name);
    formData.append("sheet_names_json", JSON.stringify(selectedSheetNames));
    formData.append("header_row", String(getVersionCompareExcelHeaderRowNumber(sheetInfo)));
    const inspectSheets = versionCompareExcelInspection?.sheets || [];
    const headerRowsPayload = {};
    selectedSheetNames.forEach((sheetNm) => {
      const sInf = inspectSheets.find((s) => s.name === sheetNm);
      headerRowsPayload[sheetNm] = getVersionCompareExcelHeaderRowNumber(
        sInf || { name: sheetNm, suggestedHeaderRow: 1 },
      );
    });
    formData.append("header_rows_json", JSON.stringify(headerRowsPayload));
    ensureVersionCompareExcelSelectionState();
    syncVersionCompareExcelHeaderMarkersFromSelection();
    const hm = versionCompareExcelSelectionState.headerMarkers || {};
    if (hm.number && hm.x && hm.y) {
      formData.append(
        "header_markers_json",
        JSON.stringify({ number: hm.number, x: hm.x, y: hm.y }),
      );
    }
    formData.append("number_column", numberColumn);
    formData.append("x_column", xColumn);
    formData.append("y_column", yColumn);
    formData.append(
      "version_a_circles_file",
      new Blob([JSON.stringify(versionA.circles || [])], { type: "application/json" }),
      "version-a-circles.json",
    );
    formData.append(
      "version_b_circles_file",
      new Blob([JSON.stringify(versionB.circles || [])], { type: "application/json" }),
      "version-b-circles.json",
    );
    formData.append("version_a_label", labels.current || labels.old);
    formData.append("version_b_label", labels.current || labels.new);
    formData.append("project_context", getVersionCompareExcelCacheProjectName());
    formData.append("file_signature", getVersionCompareExcelFileSignature(file));
    formData.append("building_source_mode", buildingSourceMode);
    formData.append("use_sheet_name_as_building", buildingSourceMode === "sheet" ? "true" : "false");
    if (buildingColumn && buildingSourceMode !== "sheet") {
      formData.append("building_column", buildingColumn);
    }
    setVersionCompareExcelStatus("엑셀 비교 파일 업로드를 시작합니다.");
    const result = await sendVersionCompareExcelRequest(formData, {
      onUploadProgress: (percent) => {
        if (percent === null) {
          setVersionCompareExcelStatus("엑셀 비교 파일 업로드 중입니다...");
          return;
        }
        setVersionCompareExcelStatus(`엑셀 비교 파일 업로드 중... ${percent}%`);
      },
      onProcessing: () => {
        setVersionCompareExcelStatus("서버에서 좌표를 비교하는 중입니다.");
        setUploadStatus("엑셀 좌표 비교 중...");
      },
    });
    renderVersionCompareExcelResult(result, {
      singleVersion,
      targetLabel: labels.current || labels.new,
    });
    saveVersionCompareExcelResultCache(result, {
      singleVersion,
      targetLabel: labels.current || labels.new,
    });
    openVersionCompareExcelModal();
    setUploadStatus("엑셀 좌표 비교를 완료했습니다.");
    setVersionCompareExcelStatus("엑셀 좌표 비교를 완료했습니다.");
  } catch (error) {
    console.error(error);
    const message = parseErrorMessage(error) || "엑셀 좌표 비교에 실패했습니다.";
    setUploadStatus(message, true);
    setVersionCompareExcelStatus(message, true);
  } finally {
    if (versionCompareExcelApply) versionCompareExcelApply.textContent = originalLabel;
    updateVersionCompareExcelApplyState();
  }
}

function runVersionCompare() {
  if (versionCompareDetailPlaceholder) versionCompareDetailPlaceholder.classList.remove("hidden");
  if (versionCompareDetailContent) {
    versionCompareDetailContent.classList.add("hidden");
    versionCompareDetailContent.innerHTML = "";
  }
  const btn = versionCompareApply;
  if (btn) btn.disabled = true;
  setUploadStatus("버전 비교 중...");
  (async () => {
    try {
      const { versionA, versionB, labels } = await resolveVersionCompareSelection();
      const diff = buildVersionDiff(versionA, versionB);
      versionCompareState = { versionA, versionB, diff, labels };
      renderVersionCompareSummary(versionA, versionB, diff);
      renderVersionCompareLists(diff);
      fitVersionCompareView(versionA, versionB);
      drawVersionCompareCanvas(diff);
      setUploadStatus("버전 비교 완료.");
    } catch (e) {
      console.error(e);
      setUploadStatus(parseErrorMessage(e) || "버전 비교에 실패했습니다.", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  })();
}

/**
 * 이전만 / 현재만 / 좌표변경 목록을 우측 패널에 채움
 */
function renderVersionCompareLists(diff) {
  if (!diff || !diff.allItems) return;
  const statusToId = {
    "only-old": versionCompareListOnlyOld,
    "only-new": versionCompareListOnlyNew,
    "coord-changed": versionCompareListCoordChanged,
  };
  const items = diff.allItems;
  ["only-old", "only-new", "coord-changed"].forEach((status) => {
    const ul = statusToId[status];
    if (!ul) return;
    const listItems = items.filter((it) => it.status === status);
    if (!listItems.length) {
      ul.innerHTML = '<li class="version-compare-list-empty">없음</li>';
      return;
    }
    ul.innerHTML = listItems
      .map((item, idx) => {
        const circle = item.circleA || item.circleB;
        const num = item.number != null ? String(item.number) : "-";
        const x = circle ? formatNumber(circle.center_x) : "-";
        const y = circle ? formatNumber(circle.center_y) : "-";
        const globalIndex = items.indexOf(item);
        return `<li data-index="${globalIndex}" title="클릭 시 상세 비교">동 ${escapeHtml(item.buildingKey)} · 번호 ${escapeHtml(num)} · (${x}, ${y})</li>`;
      })
      .join("");
    ul.querySelectorAll("li[data-index]").forEach((li) => {
      li.addEventListener("click", () => {
        const index = parseInt(li.getAttribute("data-index"), 10);
        const item = items[index];
        if (item) {
          showVersionCompareDetail(item);
          const circle = item.circleA || item.circleB;
          if (circle && typeof circle.center_x === "number" && typeof circle.center_y === "number") {
            focusVersionCompareOn(circle.center_x, circle.center_y);
          }
        }
      });
    });
  });
}

function renderVersionCompareSummary(versionA, versionB, diff) {
  if (!versionCompareSummaryBody) return;
  const countA = countByBuilding(versionA);
  const countB = countByBuilding(versionB);
  const allBuildings = new Set([
    ...Object.keys(countA.circleByBuilding),
    ...Object.keys(countB.circleByBuilding),
  ]);
  const sorted = [...allBuildings].sort((a, b) => {
    if (a === "미할당") return 1;
    if (b === "미할당") return -1;
    return String(a).localeCompare(String(b));
  });
  versionCompareSummaryBody.innerHTML = sorted
    .map((buildingKey) => {
      const cA = countA.circleByBuilding[buildingKey] || 0;
      const cB = countB.circleByBuilding[buildingKey] || 0;
      const tA = countA.textByBuilding[buildingKey] || 0;
      const tB = countB.textByBuilding[buildingKey] || 0;
      const cDiff = cB - cA;
      const tDiff = tB - tA;
      const hasDiff = cDiff !== 0 || tDiff !== 0;
      const rowClass = hasDiff ? "version-compare-row-diff" : "version-compare-row-same";
      const cDiffClass = cDiff > 0 ? "diff-plus" : cDiff < 0 ? "diff-minus" : "";
      const tDiffClass = tDiff > 0 ? "diff-plus" : tDiff < 0 ? "diff-minus" : "";
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(buildingKey)}</td>
          <td>${cA}</td>
          <td>${cB}</td>
          <td class="${cDiffClass}">${cDiff >= 0 ? "+" : ""}${cDiff}</td>
          <td>${tA}</td>
          <td>${tB}</td>
          <td class="${tDiffClass}">${tDiff >= 0 ? "+" : ""}${tDiff}</td>
        </tr>
      `;
    })
    .join("");
}

function getVersionCompareCanvasSize() {
  if (!versionCompareCanvas) return { width: 0, height: 0 };
  const w = versionCompareCanvas.clientWidth || 640;
  const h = versionCompareCanvas.clientHeight || 320;
  return { width: w, height: h };
}

function computeBoundsForCompare(versionA, versionB) {
  const circles = [
    ...(Array.isArray(versionA.circles) ? versionA.circles : []),
    ...(Array.isArray(versionB.circles) ? versionB.circles : []),
  ];
  if (!circles.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  circles.forEach((c) => {
    minX = Math.min(minX, c.center_x - (c.radius || 0));
    maxX = Math.max(maxX, c.center_x + (c.radius || 0));
    minY = Math.min(minY, c.center_y - (c.radius || 0));
    maxY = Math.max(maxY, c.center_y + (c.radius || 0));
  });
  return { minX, maxX, minY, maxY };
}

function fitVersionCompareView(versionA, versionB) {
  const bounds = computeBoundsForCompare(versionA, versionB);
  if (!bounds || !versionCompareCanvas) return;
  const { width, height } = getVersionCompareCanvasSize();
  const padding = 40;
  const innerW = Math.max(10, width - padding * 2);
  const innerH = Math.max(10, height - padding * 2);
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  compareView.scale = Math.min(innerW / spanX, innerH / spanY);
  compareView.offsetX = (bounds.minX + bounds.maxX) / 2;
  compareView.offsetY = (bounds.minY + bounds.maxY) / 2;
  const ratio = window.devicePixelRatio || 1;
  versionCompareCanvas.width = Math.round(width * ratio);
  versionCompareCanvas.height = Math.round(height * ratio);
  versionCompareCanvas.style.width = width + "px";
  versionCompareCanvas.style.height = height + "px";
  const ctx = versionCompareCanvas.getContext("2d");
  if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function worldToCompareCanvas(x, y) {
  const { width, height } = getVersionCompareCanvasSize();
  return {
    x: (x - compareView.offsetX) * compareView.scale + width / 2,
    y: height / 2 - (y - compareView.offsetY) * compareView.scale,
  };
}

/** 해당 월드 좌표를 캔버스 중앙에 두고 확대 */
function focusVersionCompareOn(worldX, worldY) {
  compareView.offsetX = worldX;
  compareView.offsetY = worldY;
  const { width, height } = getVersionCompareCanvasSize();
  const span = 40;
  compareView.scale = Math.min(width, height) / span;
  compareView.scale = Math.max(0.5, Math.min(500, compareView.scale));
  if (versionCompareState && versionCompareState.diff) {
    drawVersionCompareCanvas(versionCompareState.diff);
  }
}

function drawVersionCompareCanvas(diff) {
  if (!versionCompareCanvas || !diff) return;
  const ctx = versionCompareCanvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = getVersionCompareCanvasSize();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);
  const items = diff.allItems || [];
  const order = ["same", "only-old", "only-new", "coord-changed"];
  const colors = { same: "#9ca3af", "only-old": "#22c55e", "only-new": "#dc2626", "coord-changed": "#f97316" };
  order.forEach((status) => {
    items
      .filter((it) => it.status === status)
      .forEach((it) => {
        const circle = it.circleA || it.circleB;
        if (!circle) return;
        const { x, y } = worldToCompareCanvas(circle.center_x, circle.center_y);
        const r = Math.max(2, (circle.radius || 0.2) * compareView.scale);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colors[status] || "#9ca3af";
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
  });
}

function compareCanvasToWorld(clientX, clientY) {
  if (!versionCompareCanvas) return null;
  const rect = versionCompareCanvas.getBoundingClientRect();
  const canvasPixelX = clientX - rect.left;
  const canvasPixelY = clientY - rect.top;
  const { width, height } = getVersionCompareCanvasSize();
  return {
    x: (canvasPixelX - width / 2) / compareView.scale + compareView.offsetX,
    y: (height / 2 - canvasPixelY) / compareView.scale + compareView.offsetY,
  };
}

function findClosestCompareItem(worldX, worldY) {
  const state = versionCompareState;
  if (!state || !state.diff || !state.diff.allItems) return null;
  let best = null;
  let bestDist = Infinity;
  const hitRadiusPx = 10;
  const hitRadius = hitRadiusPx / compareView.scale;
  state.diff.allItems.forEach((item) => {
    const circle = item.circleA || item.circleB;
    if (!circle) return;
    const dx = circle.center_x - worldX;
    const dy = circle.center_y - worldY;
    const d = dx * dx + dy * dy;
    if (d < bestDist && d <= hitRadius * hitRadius) {
      bestDist = d;
      best = item;
    }
  });
  return best;
}

/** 터치 이벤트를 버전 비교 캔버스용 이벤트 객체(offsetX, offsetY, clientX, clientY)로 변환 */
function versionCompareTouchToEvent(touchEvent, useChangedTouches) {
  const t = useChangedTouches && touchEvent.changedTouches && touchEvent.changedTouches[0]
    ? touchEvent.changedTouches[0]
    : (touchEvent.touches && touchEvent.touches[0] ? touchEvent.touches[0] : null);
  if (!t || !versionCompareCanvas) return null;
  const rect = versionCompareCanvas.getBoundingClientRect();
  return {
    clientX: t.clientX,
    clientY: t.clientY,
    offsetX: t.clientX - rect.left,
    offsetY: t.clientY - rect.top,
  };
}

/** 버전 비교 캔버스: 두 터치 거리와 중심(offset 좌표) 반환 */
function getPinchStateCompare(touches) {
  if (!touches || touches.length < 2 || !versionCompareCanvas) return null;
  const rect = versionCompareCanvas.getBoundingClientRect();
  const t0 = touches[0], t1 = touches[1];
  const centerOffsetX = (t0.clientX + t1.clientX) / 2 - rect.left;
  const centerOffsetY = (t0.clientY + t1.clientY) / 2 - rect.top;
  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  return { centerOffsetX, centerOffsetY, dist };
}

function handleVersionCompareCanvasMouseDown(event) {
  if (!versionCompareState || !versionCompareState.diff) return;
  compareIsPanning = true;
  compareDidPan = false;
  comparePanStart.x = event.offsetX;
  comparePanStart.y = event.offsetY;
  if (versionCompareCanvas) versionCompareCanvas.classList.add("panning");
}

function handleVersionCompareCanvasTouchStart(e) {
  if (!e.touches || e.touches.length === 0) return;
  if (e.touches.length >= 2 && versionCompareState && versionCompareState.diff) {
    compareIsPinching = true;
    compareIsPanning = false;
    const pinch = getPinchStateCompare(e.touches);
    if (pinch) {
      const { width, height } = getVersionCompareCanvasSize();
      comparePinchStartDist = pinch.dist;
      comparePinchStartScale = compareView.scale;
      comparePinchWorldAnchor = {
        x: (pinch.centerOffsetX - width / 2) / compareView.scale + compareView.offsetX,
        y: (height / 2 - pinch.centerOffsetY) / compareView.scale + compareView.offsetY,
      };
    }
    return;
  }
  if (e.touches.length === 1) {
    compareIsPinching = false;
    const ev = versionCompareTouchToEvent(e, false);
    if (ev) handleVersionCompareCanvasMouseDown(ev);
  }
}

function handleVersionCompareCanvasTouchMove(e) {
  if (!e.touches || e.touches.length === 0) return;
  if (e.touches.length >= 2 && compareIsPinching && versionCompareState && versionCompareState.diff && comparePinchWorldAnchor) {
    e.preventDefault();
    const pinch = getPinchStateCompare(e.touches);
    if (!pinch || comparePinchStartDist <= 0) return;
    const { width, height } = getVersionCompareCanvasSize();
    const scaleFactor = pinch.dist / comparePinchStartDist;
    const newScale = Math.max(0.1, Math.min(500, comparePinchStartScale * scaleFactor));
    compareView.scale = newScale;
    compareView.offsetX = comparePinchWorldAnchor.x - (pinch.centerOffsetX - width / 2) / compareView.scale;
    compareView.offsetY = comparePinchWorldAnchor.y - (height / 2 - pinch.centerOffsetY) / compareView.scale;
    drawVersionCompareCanvas(versionCompareState.diff);
    return;
  }
  if (e.touches.length === 1) {
    compareIsPinching = false;
    const ev = versionCompareTouchToEvent(e, false);
    if (ev) {
      handleVersionCompareCanvasMouseMove(ev);
      if (compareIsPanning) e.preventDefault();
    }
  }
}

function handleVersionCompareCanvasTouchEnd(e) {
  if (e.touches.length < 2) compareIsPinching = false;
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  if (e.touches.length === 0) handleVersionCompareCanvasMouseUp();
}

function handleVersionCompareCanvasMouseUp() {
  compareIsPanning = false;
  if (versionCompareCanvas) versionCompareCanvas.classList.remove("panning");
  setTimeout(() => { compareDidPan = false; }, 0);
}

function handleVersionCompareCanvasMouseLeave() {
  if (versionCompareTooltip) versionCompareTooltip.classList.add("hidden");
  compareIsPanning = false;
  if (versionCompareCanvas) versionCompareCanvas.classList.remove("panning");
}

function handleVersionCompareCanvasWheel(event) {
  if (!versionCompareState || !versionCompareState.diff) return;
  event.preventDefault();
  const rect = versionCompareCanvas.getBoundingClientRect();
  const { width, height } = getVersionCompareCanvasSize();
  const canvasX = ((event.clientX - rect.left) / (rect.width || 1)) * width;
  const canvasY = ((event.clientY - rect.top) / (rect.height || 1)) * height;
  const dy = wheelDeltaYPixels(event, height);
  const nextScale = compareView.scale * Math.exp(-dy * 0.0012);
  zoomViewAtCanvasPoint(compareView, width, height, canvasX, canvasY, nextScale, 0.1, 500);
  drawVersionCompareCanvas(versionCompareState.diff);
}

/** 선택한 비교 항목을 상세 패널에 표시 (캔버스/목록 클릭 공용) */
function showVersionCompareDetail(item) {
  const ph = versionCompareDetailPlaceholder;
  const content = versionCompareDetailContent;
  if (!ph || !content) return;
  ph.classList.add("hidden");
  content.classList.remove("hidden");
  const numA = item.circleA ? getMatchNumber(item.circleA) : null;
  const numB = item.circleB ? getMatchNumber(item.circleB) : null;
  const coordA = item.circleA
    ? `(${formatNumber(item.circleA.center_x)}, ${formatNumber(item.circleA.center_y)})`
    : "-";
  const coordB = item.circleB
    ? `(${formatNumber(item.circleB.center_x)}, ${formatNumber(item.circleB.center_y)})`
    : "-";
  const numberChanged = numA !== numB;
  const coordChanged =
    item.circleA &&
    item.circleB &&
    !coordsEqual(
      item.circleA.center_x,
      item.circleA.center_y,
      item.circleB.center_x,
      item.circleB.center_y,
    );
  let html = "";
  html += '<div class="detail-row">이전: 번호 ' + (numA != null ? escapeHtml(String(numA)) : "없음") + ", 좌표 " + coordA + "</div>";
  html += '<div class="detail-row">현재: 번호 ' + (numB != null ? escapeHtml(String(numB)) : "없음") + ", 좌표 " + coordB + "</div>";
  if (numberChanged) html += '<div class="detail-row number-changed">넘버가 변경되었습니다.</div>';
  if (coordChanged) html += '<div class="detail-row coord-changed">좌표가 변경되었습니다.</div>';
  content.innerHTML = html;
}

function handleVersionCompareCanvasClick(event) {
  if (compareDidPan) return;
  const state = versionCompareState;
  if (!state || !state.diff) return;
  const world = compareCanvasToWorld(event.clientX, event.clientY);
  if (!world) return;
  const item = findClosestCompareItem(world.x, world.y);
  if (!item) return;
  showVersionCompareDetail(item);
}

function handleVersionCompareCanvasMouseMove(event) {
  if (compareIsPanning && versionCompareState && versionCompareState.diff) {
    const dx = event.offsetX - comparePanStart.x;
    const dy = event.offsetY - comparePanStart.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) compareDidPan = true;
    compareView.offsetX -= dx / compareView.scale;
    compareView.offsetY += dy / compareView.scale;
    comparePanStart.x = event.offsetX;
    comparePanStart.y = event.offsetY;
    drawVersionCompareCanvas(versionCompareState.diff);
    return;
  }
  if (!versionCompareTooltip) return;
  const world = compareCanvasToWorld(event.clientX, event.clientY);
  if (!world) {
    versionCompareTooltip.classList.add("hidden");
    return;
  }
  const item = findClosestCompareItem(world.x, world.y);
  if (!item) {
    versionCompareTooltip.classList.add("hidden");
    return;
  }
  const circle = item.circleA || item.circleB;
  const num = getMatchNumber(circle);
  const statusLabel = { same: "동일", "only-old": "이전만", "only-new": "현재만", "coord-changed": "좌표 변경" }[item.status];
  versionCompareTooltip.textContent = `번호 ${num ?? "-"} · ${statusLabel}`;
  const wrapper = versionCompareCanvas && versionCompareCanvas.closest(".version-compare-canvas-wrapper");
  if (wrapper) {
    const rect = wrapper.getBoundingClientRect();
    versionCompareTooltip.style.left = (event.clientX - rect.left + 12) + "px";
    versionCompareTooltip.style.top = (event.clientY - rect.top + 12) + "px";
  }
  versionCompareTooltip.classList.remove("hidden");
}

/**
 * 프로젝트 저장/불러오기 관련 함수들
 */

const STORAGE_KEY_PROJECTS = "pilexy_projects";
const PROJECT_KEY_PREFIX = "pilexy_project_";
const PROJECT_KEY_VERSION_SEP = "::";

/** 프로젝트 키 생성: 프로젝트명과 버전별로 고유 */
function getProjectStorageKey(projectName, versionId) {
  return PROJECT_KEY_PREFIX + projectName + PROJECT_KEY_VERSION_SEP + versionId;
}

/** 키에서 프로젝트명·버전Id 파싱. 반환: { name, versionId } 또는 null */
function parseProjectKey(key) {
  if (!key || !key.startsWith(PROJECT_KEY_PREFIX)) return null;
  const suffix = key.slice(PROJECT_KEY_PREFIX.length);
  const lastSep = suffix.lastIndexOf(PROJECT_KEY_VERSION_SEP);
  if (lastSep === -1) {
    return { name: suffix, versionId: "legacy" };
  }
  return {
    name: suffix.slice(0, lastSep),
    versionId: suffix.slice(lastSep + PROJECT_KEY_VERSION_SEP.length),
  };
}

function normalizeProjectRecord(record) {
  return {
    ...record,
    name: normalizeProjectName(record?.name || record?.projectName),
    versionId: record?.versionId != null ? String(record.versionId) : "legacy",
    sourceType: normalizeSourceType(record?.sourceType),
    contextProject: record?.contextProject ? normalizeProjectName(record.contextProject) : "",
    contextProjectId: normalizeSettingsContextProjectId(record?.contextProjectId),
  };
}

/** "현장명 (473)" 과 작업 메타의 "현장명" 을 같은 불러오기 컨텍스트로 본다. */
function settingsContextProjectBaseLabel(name) {
  const s = normalizeProjectName(name);
  const m = s.match(/^(.*)\s+\(\d+\)\s*$/);
  return m ? m[1].trim() : s;
}

function settingsContextNamesLooselyMatch(a, b) {
  const na = normalizeProjectName(a);
  const nb = normalizeProjectName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ba = settingsContextProjectBaseLabel(na);
  const bb = settingsContextProjectBaseLabel(nb);
  if (ba && bb && ba === bb) return true;
  return na === bb || nb === ba;
}

function isProjectRecordInSettingsContext(project, contextProject, contextProjectId) {
  const normalizedRecordId = normalizeSettingsContextProjectId(project?.contextProjectId);
  const normalizedTargetId = normalizeSettingsContextProjectId(contextProjectId);
  const recProj = project?.contextProject;
  if (normalizedTargetId && normalizedRecordId) {
    return normalizedRecordId === normalizedTargetId;
  }
  if (normalizedTargetId && !normalizedRecordId) {
    return settingsContextNamesLooselyMatch(recProj, contextProject);
  }
  if (!normalizedTargetId && normalizedRecordId) {
    return settingsContextNamesLooselyMatch(recProj, contextProject);
  }
  return settingsContextNamesLooselyMatch(recProj, contextProject);
}

function getVisibleProjectListByContext(list) {
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  const items = Array.isArray(list) ? list : [];
  const hasExplicitContext = Boolean(
    contextProjectId ||
    (contextProject && normalizeProjectName(contextProject) !== DEFAULT_PROJECT_NAME),
  );
  if (!hasExplicitContext) return [];
  return items.filter((project) => {
    if (!project?.contextProject && !project?.contextProjectId) return false;
    return isProjectRecordInSettingsContext(project, contextProject, contextProjectId);
  });
}

/**
 * localStorage에 있는 개별 프로젝트 키들로 목록 복구 (목록이 비었거나 누락된 항목 보정)
 * 프로젝트별 버전 단위로 항목을 나눔.
 */
function reconcileProjectList() {
  const list = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const parsed = parseProjectKey(key);
      if (!parsed || !parsed.name) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        const versionId = data.versionId != null ? String(data.versionId) : parsed.versionId;
        list.push({
          name: data.projectName || parsed.name,
          versionId,
          timestamp: data.timestamp || new Date().toISOString(),
          buildingCount: data.buildingCount != null ? data.buildingCount : (data.buildings && data.buildings.length) || 0,
          sourceType: normalizeSourceType(data.sourceType),
          contextProject: data.contextProject ? normalizeProjectName(data.contextProject) : "",
          contextProjectId: normalizeSettingsContextProjectId(data.contextProjectId),
        });
      } catch (_) { /* 항목 파싱 실패 시 스킵 */ }
    }
    if (list.length > 0) {
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      saveProjectList(list);
    }
  } catch (e) {
    console.error("프로젝트 목록 복구 실패:", e);
  }
}

/**
 * 프로젝트 목록 가져오기 (비어 있으면 localStorage 키 스캔으로 복구)
 */
function getProjectList() {
  try {
    let stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
    let list = [];
    if (stored) {
      const parsed = JSON.parse(stored);
      list = Array.isArray(parsed) ? parsed : [];
    }
    if (list.length === 0) {
      reconcileProjectList();
      stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        list = Array.isArray(parsed) ? parsed : [];
      }
    }
    return list.map(normalizeProjectRecord);
  } catch (error) {
    console.error("프로젝트 목록 읽기 실패:", error);
    reconcileProjectList();
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (!stored) return [];
      const list = JSON.parse(stored);
      return (Array.isArray(list) ? list : []).map(normalizeProjectRecord);
    } catch (_) {
      return [];
    }
  }
}

/**
 * 프로젝트 목록 저장
 */
function saveProjectList(list) {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify((list || []).map(normalizeProjectRecord)));
    return true;
  } catch (error) {
    console.error("프로젝트 목록 저장 실패:", error);
    return false;
  }
}

/**
 * 수정 버튼 활성화: 설정 불러오기로 불러온 프로젝트가 있을 때만 활성화 (해당 버전 덮어쓰기)
 */
function updateProjectButtonState() {
  if (!updateProjectBtn || !projectNameInput) return;
  const hasLoaded = state.loadedProjectName && state.loadedProjectVersionId;
  updateProjectBtn.disabled = !hasLoaded;
}

/**
 * 프로젝트 저장 (로컬 + 서버)
 */
async function handleSaveProject() {
  if (!state.hasDataset || !state.buildings.length) {
    setUploadStatus("저장할 동 정보가 없습니다. 동을 먼저 생성하세요.", true);
    return;
  }

  const rawProjectName = (projectNameInput?.value || "").trim();
  const sourceType = getActiveSourceType();
  if (!rawProjectName) {
    setUploadStatus("설정명을 입력하세요.", true);
    if (projectNameInput) {
      projectNameInput.focus();
    }
    return;
  }
  const projectName = normalizeProjectName(rawProjectName);
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  persistSettingsContext(contextProject, contextProjectId);

  // 현재 필터 입력값 가져오기 (텍스트 기준점 포함)
  const currentFilterValues = getFilterValuesFromInputs();
  if (!currentFilterValues) {
    setUploadStatus("필터 값이 유효하지 않습니다. 필터 설정을 확인하세요.", true);
    return;
  }

  // 저장할 데이터 구성 (동 윤곽선·클러스터 폴리라인 포함 — 버전별 복원용, id 보강으로 서버 검증 통과)
  const versionId = Date.now().toString();
  const clusterPolylinesForSave = Array.isArray(state.clusterPolylines) && state.clusterPolylines.length > 0
    ? state.clusterPolylines.map((p, i) => ({
        id: p.id || `poly_${i}`,
        closed: p.closed !== false,
        points: (p.points || []).map((pt) => ({ x: pt.x, y: pt.y })),
      }))
    : undefined;
  const projectData = {
    projectName,
    versionId,
    contextProject,
    contextProjectId,
    sourceType,
    timestamp: new Date().toISOString(),
    buildings: serializeBuildingDefinitions(state.buildings),
    clusterPolylines: clusterPolylinesForSave,
    pendingNames: [...state.pendingNames],
    pendingParkingNames: [...(state.pendingParkingNames || [])],
    pendingTowerCraneNames: [...(state.pendingTowerCraneNames || [])],
    filter: {
      minDiameter: currentFilterValues.minDiameter,
      maxDiameter: currentFilterValues.maxDiameter,
      textHeightMin: currentFilterValues.textHeightMin,
      textHeightMax: currentFilterValues.textHeightMax,
      maxMatchDistance: currentFilterValues.maxMatchDistance,
      textReferencePoint: currentFilterValues.textReferencePoint,
      pileNumberHyphenFormat: !!currentFilterValues.pileNumberHyphenFormat,
      towerCraneNumberFormat: !!currentFilterValues.towerCraneNumberFormat,
      excludeIdenticalGeometryDuplicates: !!currentFilterValues.excludeIdenticalGeometryDuplicates,
    },
    buildingCount: getAreasByKind(AREA_KIND_BUILDING).length,
    parkingAreaCount: getAreasByKind(AREA_KIND_PARKING).length,
    towerAreaCount: getAreasByKind(AREA_KIND_TOWER_CRANE).length,
  };

  const btn = saveProjectBtn;
  if (btn) btn.disabled = true;
  try {
    const projectKey = getProjectStorageKey(projectName, versionId);
    // 목록에 추가하기 전에 목록을 먼저 가져옴 (저장 후 getProjectList 시 reconcileProjectList가 새 키를 포함해 중복 항목이 생기는 것 방지)
    const projectList = getProjectList();
    localStorage.setItem(projectKey, JSON.stringify(projectData));

    const projectInfo = {
      name: projectName,
      versionId,
      contextProject,
      contextProjectId,
      timestamp: projectData.timestamp,
      buildingCount: projectData.buildingCount,
      sourceType,
    };
    projectList.push(projectInfo);
    projectList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    saveProjectList(projectList);
    renderProjectList();

    // 서버에도 설정 저장 (필터·동 외곽)
    try {
      const res = await fetch(`${API_BASE_URL}/api/saved-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn("설정 서버 저장 실패:", errText);
        setUploadStatus(`윤곽 설정 "${projectName}"이(가) 로컬에 저장되었습니다. (서버 저장 실패)`);
      } else {
        setUploadStatus(`윤곽 설정 "${projectName}"이(가) 저장되었습니다.`);
      }
    } catch (serverErr) {
      console.warn("설정 서버 저장 실패:", serverErr);
      setUploadStatus(`윤곽 설정 "${projectName}"이(가) 로컬에 저장되었습니다. (서버 연결 실패)`);
    }
    setProjectContext(projectName, sourceType);
    state.loadedProjectName = projectName;
    state.loadedProjectVersionId = versionId;
    state.loadedProjectSourceType = sourceType;
    updateProjectButtonState();
    notifyWorkContextChanged();
  } catch (error) {
    console.error("프로젝트 저장 실패:", error);
    setUploadStatus("윤곽 설정 저장에 실패했습니다.", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * 프로젝트 수정 (불러온 버전에 현재 상태 덮어쓰기 — 동 윤곽선·클러스터 포함, 서버에도 반영)
 */
async function handleUpdateProject() {
  const rawProjectName = (projectNameInput?.value || "").trim();
  const sourceType = getActiveSourceType();
  if (!rawProjectName) {
    setUploadStatus("수정할 설정명을 입력하세요.", true);
    if (projectNameInput) projectNameInput.focus();
    return;
  }
  const projectName = normalizeProjectName(rawProjectName);
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  persistSettingsContext(contextProject, contextProjectId);
  const versionId = state.loadedProjectVersionId || (() => {
    const list = getProjectList();
    const found = list.find((p) => p.name === projectName);
    return found ? found.versionId : null;
  })();
  if (!versionId) {
    setUploadStatus(`"${projectName}" 설정을 불러온 뒤 수정하세요.`, true);
    return;
  }
  if (!state.hasDataset || !state.buildings.length) {
    setUploadStatus("저장할 동 정보가 없습니다. 동을 먼저 생성하세요.", true);
    return;
  }
  const currentFilterValues = getFilterValuesFromInputs();
  if (!currentFilterValues) {
    setUploadStatus("필터 값이 유효하지 않습니다. 필터 설정을 확인하세요.", true);
    return;
  }
  const clusterPolylinesForUpdate = Array.isArray(state.clusterPolylines) && state.clusterPolylines.length > 0
    ? state.clusterPolylines.map((p, i) => ({
        id: p.id || `poly_${i}`,
        closed: p.closed !== false,
        points: (p.points || []).map((pt) => ({ x: pt.x, y: pt.y })),
      }))
    : undefined;
  const projectData = {
    projectName,
    versionId,
    contextProject,
    contextProjectId,
    sourceType,
    timestamp: new Date().toISOString(),
    buildings: serializeBuildingDefinitions(state.buildings),
    clusterPolylines: clusterPolylinesForUpdate,
    pendingNames: [...state.pendingNames],
    pendingParkingNames: [...(state.pendingParkingNames || [])],
    pendingTowerCraneNames: [...(state.pendingTowerCraneNames || [])],
    filter: {
      minDiameter: currentFilterValues.minDiameter,
      maxDiameter: currentFilterValues.maxDiameter,
      textHeightMin: currentFilterValues.textHeightMin,
      textHeightMax: currentFilterValues.textHeightMax,
      maxMatchDistance: currentFilterValues.maxMatchDistance,
      textReferencePoint: currentFilterValues.textReferencePoint,
      pileNumberHyphenFormat: !!currentFilterValues.pileNumberHyphenFormat,
      towerCraneNumberFormat: !!currentFilterValues.towerCraneNumberFormat,
      excludeIdenticalGeometryDuplicates: !!currentFilterValues.excludeIdenticalGeometryDuplicates,
    },
    buildingCount: getAreasByKind(AREA_KIND_BUILDING).length,
    parkingAreaCount: getAreasByKind(AREA_KIND_PARKING).length,
    towerAreaCount: getAreasByKind(AREA_KIND_TOWER_CRANE).length,
  };
  const btn = updateProjectBtn;
  if (btn) btn.disabled = true;
  try {
    const oldKey = state.loadedProjectName && state.loadedProjectVersionId
      ? getProjectStorageKey(state.loadedProjectName, state.loadedProjectVersionId)
      : getProjectStorageKey(projectName, versionId);
    const newKey = getProjectStorageKey(projectName, versionId);
    localStorage.setItem(newKey, JSON.stringify(projectData));
    if (oldKey !== newKey) localStorage.removeItem(oldKey);

    try {
      const res = await fetch(`${API_BASE_URL}/api/saved-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      if (!res.ok) console.warn("설정 수정 서버 저장 실패:", await res.text());
    } catch (_) {}

    const projectListArr = getProjectList();
    const existingIndex = projectListArr.findIndex(
      (p) =>
        p.name === (state.loadedProjectName || projectName) &&
        (p.versionId || "legacy") === versionId &&
        isProjectRecordInSettingsContext(p, contextProject, contextProjectId),
    );
    const projectInfo = {
      name: projectName,
      versionId,
      contextProject,
      contextProjectId,
      timestamp: projectData.timestamp,
      buildingCount: projectData.buildingCount,
      sourceType,
    };
    if (existingIndex >= 0) {
      projectListArr[existingIndex] = projectInfo;
    } else {
      const byKey = projectListArr.findIndex((p) => getProjectStorageKey(p.name, p.versionId) === newKey);
      if (byKey >= 0) projectListArr[byKey] = projectInfo;
      else projectListArr.push(projectInfo);
    }
    projectListArr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    saveProjectList(projectListArr);
    state.loadedProjectName = projectName;
    state.loadedProjectVersionId = versionId;
    state.loadedProjectSourceType = sourceType;
    setProjectContext(projectName, sourceType);
    renderProjectList();
    setUploadStatus(`윤곽 설정 "${projectName}"이(가) 수정(덮어쓰기)되었습니다.`);
    updateProjectButtonState();
    notifyWorkContextChanged();
  } catch (error) {
    console.error("프로젝트 수정 실패:", error);
    setUploadStatus("윤곽 설정 수정에 실패했습니다.", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * 프로젝트 불러오기 (프로젝트명 + 버전별로 고유하게 복원, 동 윤곽선·클러스터 포함)
 */
function handleLoadProject(projectName, versionId) {
  if (!projectName) return;
  const vid = versionId != null ? String(versionId) : "legacy";
  const projectKey = getProjectStorageKey(projectName, vid);
  const legacyKey = vid === "legacy" ? PROJECT_KEY_PREFIX + projectName : null;
  try {
    let stored = localStorage.getItem(projectKey);
    let usedLegacyKey = false;
    if (!stored && legacyKey) {
      stored = localStorage.getItem(legacyKey);
      usedLegacyKey = !!stored;
    }
    if (!stored) {
      setUploadStatus(`윤곽 설정 "${projectName}"을(를) 찾을 수 없습니다.`, true);
      return;
    }

    const projectData = JSON.parse(stored);
    if (usedLegacyKey && legacyKey) {
      projectData.versionId = "legacy";
      const newKey = getProjectStorageKey(projectData.projectName || projectName, "legacy");
      localStorage.setItem(newKey, JSON.stringify(projectData));
      localStorage.removeItem(legacyKey);
    }

    if (projectNameInput) projectNameInput.value = projectData.projectName || projectName;
    if (projectSourceTypeSelect) {
      projectSourceTypeSelect.value = normalizeSourceType(projectData.sourceType);
    }
    const previousLoadedWorkProject = state.loadedWorkMeta?.project || "";
    state.loadedProjectName = projectData.projectName || projectName;
    state.loadedProjectVersionId = projectData.versionId != null ? String(projectData.versionId) : vid;
    state.loadedProjectSourceType = normalizeSourceType(projectData.sourceType);
    // 프로젝트(윤곽 설정) 전환 시 이전 "작업 버전" 원본 스냅샷이 남아 있으면
    // apply-filter가 다른 프로젝트의 원본 circles/texts를 재사용할 수 있으므로 초기화한다.
    state.sourceCircles = null;
    state.sourceTexts = null;
    state.loadedWorkId = null;
    state.loadedWorkMeta = null;
    state.manualOverrides = {};
    state.manualHistoryReferenceWorkId = null;
    persistSettingsContext(projectData.contextProject || previousLoadedWorkProject, projectData.contextProjectId || "");
    updateProjectButtonState();

    // 동 윤곽선(클러스터 폴리라인) 복원 — 비어 있으면 이전 프로젝트 잔상 제거
    if (projectData.clusterPolylines && Array.isArray(projectData.clusterPolylines) && projectData.clusterPolylines.length > 0) {
      state.clusterPolylines = projectData.clusterPolylines.map((p, i) => ({
        id: p.id != null ? String(p.id) : `poly_${i}`,
        closed: p.closed !== false,
        points: (p.points || []).map((pt) => ({ x: Number(pt.x), y: Number(pt.y) })),
        layer: p.layer != null && String(p.layer).trim() ? String(p.layer) : "building",
        cluster_type:
          p.cluster_type != null && String(p.cluster_type).trim()
            ? String(p.cluster_type)
            : p.clusterType != null && String(p.clusterType).trim()
              ? String(p.clusterType)
              : "building",
      }));
    } else {
      state.clusterPolylines = [];
    }
    state.polylines = state.clusterPolylines.length ? state.clusterPolylines : state.rawPolylines;

    // 건물 정보 복원
    if (projectData.buildings && Array.isArray(projectData.buildings)) {
      state.buildings = normalizeAreaDefinitions(projectData.buildings);
    }

    if (projectData.pendingNames && Array.isArray(projectData.pendingNames)) {
      state.pendingNames = [...projectData.pendingNames];
    }
    setAreaNames(
      AREA_KIND_PARKING,
      projectData.pendingParkingNames && Array.isArray(projectData.pendingParkingNames)
        ? [...projectData.pendingParkingNames]
        : buildAreaNameListFromEntries(AREA_KIND_PARKING, getAreasByKind(AREA_KIND_PARKING, state.buildings)),
    );
    setAreaNames(
      AREA_KIND_TOWER_CRANE,
      projectData.pendingTowerCraneNames && Array.isArray(projectData.pendingTowerCraneNames)
        ? [...projectData.pendingTowerCraneNames]
        : buildAreaNameListFromEntries(AREA_KIND_TOWER_CRANE, getAreasByKind(AREA_KIND_TOWER_CRANE, state.buildings)),
    );

    if (projectData.filter) {
      state.filter = normalizeFilter(projectData.filter);
      updateFilterInputs(state.filter);
    }

    if (projectData.clustering) {
      if (maxDistanceSeedInput) {
        maxDistanceSeedInput.value = projectData.clustering.maxDistanceFromSeed ?? 30;
      }
      if (mergeSeedDistanceInput) {
        mergeSeedDistanceInput.value = projectData.clustering.mergeSeedDistance ?? 20;
      }
    }

    if (projectData.buildingCount) {
      buildingCountInput.value = projectData.buildingCount;
    }
    if (parkingCountInput) {
      const savedParkingCount = Number(projectData.parkingAreaCount);
      if (Number.isFinite(savedParkingCount)) {
        parkingCountInput.value = Math.max(0, savedParkingCount);
      } else {
        parkingCountInput.value =
          getAreasByKind(AREA_KIND_PARKING).length || getAreaNames(AREA_KIND_PARKING).length || 0;
      }
      ensurePendingNameCount(AREA_KIND_PARKING, getConfiguredAreaCount(AREA_KIND_PARKING));
    }
    if (towerCraneCountInput) {
      const savedTowerCount = Number(projectData.towerAreaCount);
      if (Number.isFinite(savedTowerCount)) {
        towerCraneCountInput.value = Math.max(0, savedTowerCount);
      } else {
        towerCraneCountInput.value =
          getAreasByKind(AREA_KIND_TOWER_CRANE).length || getAreaNames(AREA_KIND_TOWER_CRANE).length || 0;
      }
      ensurePendingNameCount(AREA_KIND_TOWER_CRANE, getConfiguredAreaCount(AREA_KIND_TOWER_CRANE));
    }

    applyLoadedAutoBuildingOutlineOrderPayload(
      projectData.clustering,
      projectData.autoBuildingOutlineByOrder,
    );
    syncBuildingOutlineAutoUi();

    syncPendingNamesWithBuildings();
    renderPendingNameEditor();
    renderBuildingTabs();
    populateBuildingSelect();
    state.areaRectCreate = null;
    requestRedraw();

    setUploadStatus(`윤곽 설정 "${projectData.projectName || projectName}"을(를) 불러왔습니다.`);
    notifyWorkContextChanged();
  } catch (error) {
    console.error("프로젝트 불러오기 실패:", error);
    setUploadStatus("윤곽 설정 불러오기에 실패했습니다.", true);
  }
}

/**
 * 프로젝트 이름 수정 (해당 버전만 이름 변경)
 */
function handleRenameProject(oldName, newName, versionId) {
  const trimmed = (newName || "").trim();
  if (!trimmed) {
    setUploadStatus("설정명을 입력하세요.", true);
    return;
  }
  if (trimmed === oldName) {
    renderProjectList();
    return;
  }
  const vid = versionId != null ? String(versionId) : "legacy";
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  const projectList = getProjectList();
  if (
    projectList.some(
      (p) =>
        p.name === trimmed &&
        p.versionId === vid &&
        isProjectRecordInSettingsContext(p, contextProject, contextProjectId),
    )
  ) {
    setUploadStatus(`이미 "${trimmed}" 이름의 같은 버전이 있습니다.`, true);
    return;
  }
  try {
    const oldKey = getProjectStorageKey(oldName, vid);
    const legacyKey = vid === "legacy" ? PROJECT_KEY_PREFIX + oldName : null;
    let stored = localStorage.getItem(oldKey);
    if (!stored && legacyKey) stored = localStorage.getItem(legacyKey);
    if (!stored) {
      setUploadStatus(`윤곽 설정 "${oldName}"을(를) 찾을 수 없습니다.`, true);
      renderProjectList();
      return;
    }
    const projectData = JSON.parse(stored);
    projectData.projectName = trimmed;
    projectData.timestamp = new Date().toISOString();
    const newKey = getProjectStorageKey(trimmed, vid);
    localStorage.setItem(newKey, JSON.stringify(projectData));
    localStorage.removeItem(oldKey);
    if (legacyKey && legacyKey !== oldKey) localStorage.removeItem(legacyKey);
    const list = getProjectList();
    const idx = list.findIndex((p) => (p.name === oldName && p.versionId === vid) || getProjectStorageKey(p.name, p.versionId) === oldKey);
    if (idx >= 0) {
      list[idx] = { ...list[idx], name: trimmed, versionId: vid };
      saveProjectList(list);
    }
    if (state.loadedProjectName === oldName && state.loadedProjectVersionId === vid) {
      state.loadedProjectName = trimmed;
      if (projectNameInput) {
        projectNameInput.value = trimmed;
      }
      notifyWorkContextChanged();
    }
    renderProjectList();
    setUploadStatus(`설정명이 "${trimmed}"(으)로 변경되었습니다.`);
  } catch (error) {
    console.error("프로젝트 이름 수정 실패:", error);
    setUploadStatus("설정명 수정에 실패했습니다.", true);
    renderProjectList();
  }
}

/**
 * 프로젝트 삭제
 */
function handleDeleteProject(projectName, event, versionId) {
  if (event) {
    event.stopPropagation();
  }
  const vid = versionId != null ? String(versionId) : "legacy";
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  if (!confirm(`윤곽 설정 "${projectName}"의 이 저장본을 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const projectKey = getProjectStorageKey(projectName, vid);
    const legacyKey = vid === "legacy" ? PROJECT_KEY_PREFIX + projectName : null;
    localStorage.removeItem(projectKey);
    if (legacyKey) localStorage.removeItem(legacyKey);

    const list = getProjectList();
    const filtered = list.filter(
      (p) =>
        !(
          p.name === projectName &&
          (p.versionId || "legacy") === vid &&
          isProjectRecordInSettingsContext(p, contextProject, contextProjectId)
        ),
    );
    saveProjectList(filtered);
    if (projectNameInput && projectNameInput.value === projectName && state.loadedProjectVersionId === vid) {
      projectNameInput.value = "";
      state.loadedProjectName = null;
      state.loadedProjectVersionId = null;
      state.loadedProjectSourceType = DEFAULT_SOURCE_TYPE;
      if (projectSourceTypeSelect) {
        projectSourceTypeSelect.value = DEFAULT_SOURCE_TYPE;
      }
    }
    renderProjectList();
    updateProjectButtonState();
    notifyWorkContextChanged();
    setUploadStatus(`윤곽 설정 "${projectName}"이(가) 삭제되었습니다.`);
  } catch (error) {
    console.error("프로젝트 삭제 실패:", error);
    setUploadStatus("윤곽 설정 삭제에 실패했습니다.", true);
  }
}

/**
 * 프로젝트 목록 렌더링
 */
function renderProjectList() {
  if (!projectList) return;

  const allProjects = getProjectList();
  renderSettingsContextSelect(allProjects);
  const contextProject = getCurrentSettingsContextProject();
  const contextProjectId = getCurrentSettingsContextProjectId();
  const hasExplicitContext = Boolean(
    contextProjectId ||
    (contextProject && normalizeProjectName(contextProject) !== DEFAULT_PROJECT_NAME),
  );
  const projects = getVisibleProjectListByContext(allProjects);
  projectList.innerHTML = "";

  if (!hasExplicitContext) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-row";
    emptyMsg.textContent = "상단에서 불러오기 프로젝트를 선택하면 해당 저장된 윤곽 설정만 표시됩니다.";
    projectList.appendChild(emptyMsg);
    return;
  }

  if (projects.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-row";
    emptyMsg.textContent = "저장된 윤곽 설정이 없습니다.";
    projectList.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();
  projects.forEach((project) => {
    const item = document.createElement("div");
    item.className = "project-item";
    const date = new Date(project.timestamp);
    const dateStr = date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    item.innerHTML = `
      <div class="project-item-info">
        <strong class="project-item-name">${escapeHtml(project.name)}</strong>
        <div class="project-item-badges">
          ${getSourceTypeBadgeHtml(project.sourceType, "project-item-badge")}
        </div>
        <span class="project-meta">동 ${project.buildingCount || 0}개 · ${dateStr}</span>
      </div>
      <div class="project-item-actions">
        <button type="button" class="ghost project-rename-btn" aria-label="이름 수정">수정</button>
        <button type="button" class="ghost project-load-btn">불러오기</button>
        <button type="button" class="ghost project-delete-btn">삭제</button>
      </div>
    `;

    const nameEl = item.querySelector(".project-item-name");
    const renameBtn = item.querySelector(".project-rename-btn");
    const loadBtn = item.querySelector(".project-load-btn");
    const deleteBtn = item.querySelector(".project-delete-btn");

    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "project-item-name-input";
      input.value = project.name;
      input.setAttribute("maxlength", "100");
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const newName = (input.value || "").trim();
        input.replaceWith(nameEl);
        nameEl.textContent = newName || project.name;
        if (newName && newName !== project.name) {
          handleRenameProject(project.name, newName, project.versionId || "legacy");
        }
      };
      input.addEventListener("blur", commit, { once: true });
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
        if (ev.key === "Escape") {
          input.replaceWith(nameEl);
          nameEl.textContent = project.name;
        }
      });
    });
    loadBtn.addEventListener("click", () => handleLoadProject(project.name, project.versionId || "legacy"));
    deleteBtn.addEventListener("click", (e) => handleDeleteProject(project.name, e, project.versionId || "legacy"));

    fragment.appendChild(item);
  });

  projectList.appendChild(fragment);
  updateProjectButtonState();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
