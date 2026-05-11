/**
 * 자재관리: 프로젝트 단위 번들 + 입고 대시보드 + 동×길이 매트릭스 + 집계 + 시멘트 + PDAM 요약
 * 전제: app.js 가 먼저 로드되어 state, serializeBuildingDefinitions 사용 가능
 * 저장 키: 상단 #project-name-input 값(비면 전용 __materials_empty__ — 불러온 작업 메타와 섞이지 않게 함)
 */
(function () {
  const MATERIALS_EMPTY_PROJECT_KEY = "__materials_empty__";
  const LENS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  /** 단본(한 구간) 최대 길이(m) — 이음은 두 구간 합이 총연장 */
  const LENS_MAX_SINGLE_M = 15;

  function defaultJoinLengthSpecsFromLegacy() {
    const out = [];
    for (let m = 16; m <= 25; m += 1) {
      out.push({ totalM: m, seg1M: 10, seg2M: m - 10 });
    }
    return out;
  }

  function clampSegM(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return 0;
    return Math.max(1, Math.min(LENS_MAX_SINGLE_M, v));
  }

  function normalizeJoinSpec(raw) {
    const totalM = Math.round(Number(raw && raw.totalM));
    if (!Number.isFinite(totalM) || totalM < 16 || totalM > 30) return null;
    let seg1M = Math.round(Number(raw.seg1M));
    let seg2M = Math.round(Number(raw.seg2M));
    if (!Number.isFinite(seg1M) || !Number.isFinite(seg2M)) {
      seg1M = Math.min(LENS_MAX_SINGLE_M, Math.max(1, totalM - 10));
      seg2M = totalM - seg1M;
    }
    if (seg1M < 1) seg1M = 1;
    if (seg1M > LENS_MAX_SINGLE_M) seg1M = LENS_MAX_SINGLE_M;
    seg2M = totalM - seg1M;
    if (seg2M < 1 || seg2M > LENS_MAX_SINGLE_M) return null;
    if (seg1M + seg2M !== totalM) return null;
    return { totalM, seg1M, seg2M };
  }

  function ensureJoinLengthSpecs(b) {
    if (!b) return;
    if (b.joinLengthSpecs == null || b.joinLengthSpecs === undefined) {
      b.joinLengthSpecs = defaultJoinLengthSpecsFromLegacy();
      return;
    }
    if (!Array.isArray(b.joinLengthSpecs)) {
      b.joinLengthSpecs = defaultJoinLengthSpecsFromLegacy();
      return;
    }
    if (b.joinLengthSpecs.length === 0) return;
    const seen = new Set();
    const norm = [];
    b.joinLengthSpecs.forEach((raw) => {
      const n = normalizeJoinSpec(raw);
      if (!n || seen.has(n.totalM)) return;
      seen.add(n.totalM);
      norm.push(n);
    });
    if (!norm.length) {
      b.joinLengthSpecs = defaultJoinLengthSpecsFromLegacy();
      return;
    }
    norm.sort((a, c) => a.totalM - c.totalM);
    b.joinLengthSpecs = norm;
  }

  function getJoinLengthRows() {
    if (!bundle) return [];
    ensureJoinLengthSpecs(bundle);
    const arr = bundle.joinLengthSpecs;
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => ({
      key: `J${s.totalM}`,
      totalM: s.totalM,
      seg1M: s.seg1M,
      seg2M: s.seg2M,
      label: `${s.seg1M}+${s.seg2M}`,
    }));
  }

  function joinPlanKey(totalM) {
    return `J${Math.round(Number(totalM)) || 0}`;
  }

  function stripJoinPlanKey(jkey) {
    const plans = bundle.planByBuilding || {};
    Object.keys(plans).forEach((b) => {
      if (plans[b] && Object.prototype.hasOwnProperty.call(plans[b], jkey)) delete plans[b][jkey];
    });
    (bundle.receipts || []).forEach((r) => {
      if (r.qtyByLength && Object.prototype.hasOwnProperty.call(r.qtyByLength, jkey)) delete r.qtyByLength[jkey];
    });
  }

  function applyJoinSegEdit(totalM, part, rawVal) {
    ensureJoinLengthSpecs(bundle);
    const s = bundle.joinLengthSpecs.find((x) => x.totalM === totalM);
    if (!s) return;
    let seg1 = s.seg1M;
    let seg2 = s.seg2M;
    const v = clampSegM(rawVal);
    if (part === "1") {
      seg1 = v;
      seg2 = totalM - seg1;
      if (seg2 < 1) {
        seg2 = 1;
        seg1 = totalM - 1;
      }
      if (seg2 > LENS_MAX_SINGLE_M) {
        seg2 = LENS_MAX_SINGLE_M;
        seg1 = totalM - seg2;
      }
    } else {
      seg2 = v;
      seg1 = totalM - seg2;
      if (seg1 < 1) {
        seg1 = 1;
        seg2 = totalM - 1;
      }
      if (seg1 > LENS_MAX_SINGLE_M) {
        seg1 = LENS_MAX_SINGLE_M;
        seg2 = totalM - seg1;
      }
    }
    if (seg1 < 1 || seg2 < 1 || seg1 > LENS_MAX_SINGLE_M || seg2 > LENS_MAX_SINGLE_M) return;
    s.seg1M = seg1;
    s.seg2M = seg2;
    bundle.joinLengthSpecs.sort((a, c) => a.totalM - c.totalM);
  }

  let bundle = null;
  let lastMaterialsPc = null;
  let filterMode = "all";
  let filterMonth = "";
  let filterFrom = "";
  let filterTo = "";
  let mounted = false;
  let saveTimer = null;
  let projectNameResyncHooked = false;
  let workContextMaterialsHooked = false;

  function markMaterialsServerCacheStale() {
    lastMaterialsPc = null;
  }

  function ensureWorkContextMaterialsHook() {
    if (workContextMaterialsHooked) return;
    workContextMaterialsHooked = true;
    window.addEventListener("pilexy:work-context-changed", () => {
      markMaterialsServerCacheStale();
      const panel = document.getElementById("materials-panel");
      if (panel && panel.classList.contains("open")) {
        void init();
      }
    });
  }

  function apiBase() {
    const b = typeof API_BASE_URL !== "undefined" ? String(API_BASE_URL).trim() : "";
    return b.replace(/\/$/, "");
  }

  /**
   * 서버 materials_state.project_context
   * - 우선 상단 프로젝트명 입력란
   * - 비어 있어도 **현재 불러온 작업**이 있으면 메타의 project만 사용(불러오기 직후 입력 미동기화 대비)
   * - 그 외에는 이전 프로젝트와 섞이지 않도록 __materials_empty__
   */
  function projectContext() {
    const inp = typeof document !== "undefined" ? document.getElementById("project-name-input") : null;
    const raw = inp ? String(inp.value || "").trim() : "";
    if (raw) {
      if (typeof normalizeProjectName === "function") return normalizeProjectName(raw);
      return raw;
    }
    if (typeof state !== "undefined" && state.loadedWorkId && state.loadedWorkMeta) {
      const mp = String(state.loadedWorkMeta.project || "").trim();
      if (mp) {
        if (typeof normalizeProjectName === "function") return normalizeProjectName(mp);
        return mp;
      }
    }
    return MATERIALS_EMPTY_PROJECT_KEY;
  }

  function ensureProjectNameResyncForMaterials() {
    if (projectNameResyncHooked) return;
    const inp = document.getElementById("project-name-input");
    if (!inp) return;
    projectNameResyncHooked = true;
    const resyncIfMaterialsOpen = () => {
      const panel = document.getElementById("materials-panel");
      if (!panel || !panel.classList.contains("open")) return;
      markMaterialsServerCacheStale();
      void init();
    };
    inp.addEventListener("change", resyncIfMaterialsOpen);
    inp.addEventListener("blur", resyncIfMaterialsOpen);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function rid() {
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function buildingNames() {
    try {
      if (typeof serializeBuildingDefinitions === "function" && typeof state !== "undefined" && Array.isArray(state.buildings)) {
        return serializeBuildingDefinitions(state.buildings)
          .map((b) => String(b?.name || "").trim())
          .filter(Boolean);
      }
    } catch (e) {
      /* ignore */
    }
    return [];
  }

  function parseDateLoose(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const m = s.match(/(\d{4})[\.\/-](\d{1,2})[\.\/-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    const m2 = s.match(/(\d{2})[\.\/](\d{1,2})[\.\/](\d{1,2})/);
    if (m2) {
      const y = Number(m2[1]) > 50 ? 1900 + Number(m2[1]) : 2000 + Number(m2[1]);
      return `${y}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
    }
    return null;
  }

  function toDateInputValue(raw) {
    const s = String(raw || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return parseDateLoose(raw) || "";
  }

  function isoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function inFilterRange(iso) {
    if (filterMode === "all") return true;
    const d = parseDateLoose(iso);
    if (!d) return true;
    if (filterMode === "month") {
      if (!filterMonth) return true;
      return d.startsWith(filterMonth);
    }
    if (filterMode === "range") {
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      return true;
    }
    return true;
  }

  function ensureSupplierSelectOptions() {
    const list = Array.isArray(bundle.suppliers) ? bundle.suppliers : [];
    return list.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || s.id)}</option>`).join("");
  }

  function truckRuleFor(len) {
    const rules = Array.isArray(bundle.truckLoadRules) ? bundle.truckLoadRules : [];
    const hit = rules.find((r) => Number(r.lengthM) === len);
    return hit && Number.isFinite(Number(hit.piecesPerTruck)) ? Number(hit.piecesPerTruck) : null;
  }

  function sumReceiptQty(len) {
    let n = 0;
    (bundle.receipts || []).forEach((r) => {
      if (!inFilterRange(r.requestDate) && !inFilterRange(r.arrivalDate)) return;
      const q = r.qtyByLength && r.qtyByLength[String(len)];
      n += Number(q) || 0;
    });
    return n;
  }

  /** 기간 필터가 적용된 입고 행만 집계: 업체별 길이(m)당 본수·총본·총연장(m) */
  function aggregateReceiptsBySupplier() {
    const resolveName = (id) => {
      const raw = String(id ?? "").trim();
      if (!raw) return "(미지정)";
      const s = (bundle.suppliers || []).find((x) => String(x.id) === raw);
      return s ? String(s.name || raw).trim() || raw : raw;
    };
    const byId = new Map();
    (bundle.receipts || []).forEach((r) => {
      if (!inFilterRange(r.requestDate) && !inFilterRange(r.arrivalDate)) return;
      const sid = String(r.supplierId ?? "").trim();
      if (!byId.has(sid)) {
        byId.set(sid, { supplierId: sid, name: resolveName(sid), qty: {}, totalPieces: 0, totalM: 0 });
      }
      const row = byId.get(sid);
      const segQty = {};
      LENS.forEach((L) => {
        const k = String(L);
        const qb = Number(r.qtyByLength && r.qtyByLength[k]) || 0;
        segQty[k] = qb;
        if (qb) {
          row.totalPieces += qb;
          row.totalM += qb * L;
        }
      });
      getJoinLengthRows().forEach(({ key, totalM, seg1M, seg2M }) => {
        const q = Number(r.qtyByLength && r.qtyByLength[key]) || 0;
        if (!q) return;
        row.totalPieces += q;
        row.totalM += q * totalM;
        const a = seg1M;
        const b = seg2M;
        segQty[String(a)] = (segQty[String(a)] || 0) + q;
        segQty[String(b)] = (segQty[String(b)] || 0) + q;
      });
      LENS.forEach((L) => {
        const k = String(L);
        const qCell = segQty[k] || 0;
        if (!qCell) return;
        row.qty[k] = (row.qty[k] || 0) + qCell;
      });
    });
    return Array.from(byId.values())
      .filter((x) => x.totalPieces > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  function sumDamageQty(len) {
    let n = 0;
    (bundle.damageReturns || []).forEach((d) => {
      if (Number(d.lengthM) !== len) return;
      n += 1;
    });
    return n;
  }

  function planTotalLen(lenKey) {
    let n = 0;
    const plans = bundle.planByBuilding || {};
    Object.keys(plans).forEach((b) => {
      const cell = plans[b] && plans[b][lenKey];
      n += Number(cell) || 0;
    });
    return n;
  }

  function pdamCtx() {
    if (typeof window.pilexyGetMaterialsPdamContext === "function") {
      return window.pilexyGetMaterialsPdamContext();
    }
    return {
      totalInstalled: 0,
      installedByLocation: {},
      circleMappings: [],
      usedByLength: {},
      usedInstalledWithoutLength: 0,
    };
  }

  function usedFromPdamLength(lenKey) {
    const p = pdamCtx();
    const m = p.usedByLength;
    if (!m || typeof m !== "object") return 0;
    const n = Number(m[String(lenKey)]);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * 단본 이음(J총연장) 본수를 설정된 두 구간(m)으로 나눠 합산.
   * 길이별 요약·입고(업체)·상차 힌트 표시용. 가중 연장(m)·시멘트 tf는 이음 총연장을 그대로 쓰는 로직과 별개.
   */
  function planTotalLenSplitForSummary(L) {
    const len = Number(L);
    if (!Number.isFinite(len)) return 0;
    let n = planTotalLen(String(len));
    getJoinLengthRows().forEach((j) => {
      const q = planTotalLen(j.key);
      if (!q) return;
      const a = j.seg1M;
      const b = j.seg2M;
      if (a === len) n += q;
      if (b === len) n += q;
    });
    return n;
  }

  function sumReceiptQtySplitForSummary(L) {
    const len = Number(L);
    if (!Number.isFinite(len)) return 0;
    let n = sumReceiptQty(len);
    (bundle.receipts || []).forEach((r) => {
      if (!inFilterRange(r.requestDate) && !inFilterRange(r.arrivalDate)) return;
      getJoinLengthRows().forEach((j) => {
        const q = Number(r.qtyByLength && r.qtyByLength[j.key]) || 0;
        if (!q) return;
        const a = j.seg1M;
        const b = j.seg2M;
        if (a === len) n += q;
        if (b === len) n += q;
      });
    });
    return n;
  }

  function usedFromPdamLengthSplitForSummary(L) {
    const len = Number(L);
    if (!Number.isFinite(len)) return 0;
    let n = usedFromPdamLength(String(len));
    getJoinLengthRows().forEach((j) => {
      const q = usedFromPdamLength(j.key);
      if (!q) return;
      const a = j.seg1M;
      const b = j.seg2M;
      if (a === len) n += q;
      if (b === len) n += q;
    });
    return n;
  }

  /** 계획 본수×길이 가중 연장(m) */
  function cementPlanWeightedMeter() {
    let totalMeter = 0;
    LENS.forEach((L) => {
      const k = String(L);
      const q = planTotalLen(k);
      totalMeter += q * L;
    });
    getJoinLengthRows().forEach(({ key, totalM: joinM }) => {
      const q = planTotalLen(key);
      totalMeter += q * joinM;
    });
    return totalMeter;
  }

  /** PDAM 길이별 사용 본수×길이 가중 연장(m) */
  function cementPdamWeightedMeter() {
    let totalMeter = 0;
    LENS.forEach((L) => {
      totalMeter += usedFromPdamLength(String(L)) * L;
    });
    getJoinLengthRows().forEach(({ key, totalM: joinM }) => {
      totalMeter += usedFromPdamLength(key) * joinM;
    });
    return totalMeter;
  }

  /** 가중 연장(m)에 대해 Φ별 ton/m·상세 tf 동시 계산 */
  function cementTonEstimatesForMeter(rawMeter) {
    const presets = bundle.cementPresets || {};
    const m0 = Number(rawMeter);
    const totalMeter = Number.isFinite(m0) && m0 >= 0 ? m0 : 0;
    const phi = presets.selectedPhi || "D600";
    const table = presets.tonPerMByPhi || {};
    let tonPerM = Number(table[phi]);
    if (!Number.isFinite(tonPerM)) tonPerM = 0.064;
    const tonPerMPhi = totalMeter * tonPerM;
    const d = presets.detail || {};
    const d1 = Number(d.d1M) || 0.66;
    const d2 = Number(d.d2M) || 0.6;
    const ann = (Math.PI * (d1 * d1 - d2 * d2)) / 4;
    const vol = ann * totalMeter;
    const ckg = (Number(d.cementKgPerM3) || 880) * vol;
    const detailTf = ckg / 1000;
    return { totalMeter, tonPerMPhi, detailTf };
  }

  /** 계획 기준 — 시멘트 설정 카드와 동일 */
  function cementEstimatesPair() {
    return cementTonEstimatesForMeter(cementPlanWeightedMeter());
  }

  /** 행별 입고(tf) — 예전 데이터는 발주·반입 중 채워진 쪽을 사용, 이후에는 동일 값으로 유지 */
  function cementLedgerRowIntakeTf(c) {
    if (!c) return 0;
    const r = Number(c.receiptTf);
    const o = Number(c.orderTf);
    const rOk = Number.isFinite(r);
    const oOk = Number.isFinite(o);
    if (rOk && r !== 0) return r;
    if (oOk && o !== 0) return o;
    if (rOk) return r;
    if (oOk) return o;
    return 0;
  }

  /** 시멘트 벌크 표·요약용 입고(tf) 합계 (발주·반입 통합) */
  function cementIntakeTfTotal() {
    return (bundle.cementLedger || []).reduce((a, r) => a + cementLedgerRowIntakeTf(r), 0);
  }

  /** fullRender 전 스크롤 스냅샷(우측 aside·본문·넓은 표 셸은 innerHTML 후 노드가 바뀌므로 좌표만 보관) */
  function captureMaterialsPanelScroll() {
    const body = document.querySelector("#materials-panel .materials-panel-body");
    const aside = document.querySelector("#materials-panel .materials-grid__aside");
    const settingsShell = document.querySelector("#materials-panel .materials-table-shell--settings");
    const truckShell = document.querySelector("#materials-panel .materials-table-shell--truck");
    const cementBulkShell = document.querySelector("#materials-panel .materials-table-shell--cement-bulk");
    const wideShells = Array.from(
      document.querySelectorAll("#materials-panel .materials-table-shell--wide, #materials-panel .materials-table-shell--supplier-rcpt"),
    ).map((el) => ({
      top: el.scrollTop,
      left: el.scrollLeft,
    }));
    return {
      body: body ? { top: body.scrollTop, left: body.scrollLeft } : null,
      aside: aside ? { top: aside.scrollTop, left: aside.scrollLeft } : null,
      settingsShell: settingsShell ? { top: settingsShell.scrollTop, left: settingsShell.scrollLeft } : null,
      truckShell: truckShell ? { top: truckShell.scrollTop, left: truckShell.scrollLeft } : null,
      cementBulkShell: cementBulkShell ? { top: cementBulkShell.scrollTop, left: cementBulkShell.scrollLeft } : null,
      wideShells,
      winY: window.scrollY,
      winX: window.scrollX,
    };
  }

  function restoreMaterialsPanelScroll(snap) {
    if (!snap) return;
    const body = document.querySelector("#materials-panel .materials-panel-body");
    if (body && snap.body) {
      body.scrollTop = snap.body.top;
      body.scrollLeft = snap.body.left;
    }
    const aside = document.querySelector("#materials-panel .materials-grid__aside");
    if (aside && snap.aside) {
      aside.scrollTop = snap.aside.top;
      aside.scrollLeft = snap.aside.left;
    }
    const settingsShell = document.querySelector("#materials-panel .materials-table-shell--settings");
    if (settingsShell && snap.settingsShell) {
      settingsShell.scrollTop = snap.settingsShell.top;
      settingsShell.scrollLeft = snap.settingsShell.left;
    }
    const truckShell = document.querySelector("#materials-panel .materials-table-shell--truck");
    if (truckShell && snap.truckShell) {
      truckShell.scrollTop = snap.truckShell.top;
      truckShell.scrollLeft = snap.truckShell.left;
    }
    const cementBulkShell = document.querySelector("#materials-panel .materials-table-shell--cement-bulk");
    if (cementBulkShell && snap.cementBulkShell) {
      cementBulkShell.scrollTop = snap.cementBulkShell.top;
      cementBulkShell.scrollLeft = snap.cementBulkShell.left;
    }
    const wides = Array.from(
      document.querySelectorAll("#materials-panel .materials-table-shell--wide, #materials-panel .materials-table-shell--supplier-rcpt"),
    );
    (snap.wideShells || []).forEach((pos, i) => {
      const el = wides[i];
      if (el && pos) {
        el.scrollTop = pos.top;
        el.scrollLeft = pos.left;
      }
    });
    if (Math.abs(window.scrollY - snap.winY) > 1 || Math.abs(window.scrollX - snap.winX) > 1) {
      window.scrollTo(snap.winX, snap.winY);
    }
  }

  function fullRender() {
    const mount = document.getElementById("materials-app-mount");
    if (!mount || !bundle) return;
    ensureJoinLengthSpecs(bundle);

    const detailsWasOpen = Boolean(mount.querySelector(".materials-details")?.open);
    const elCollapsePlan = mount.querySelector("#materials-collapse-plan");
    const elCollapseJoin = mount.querySelector("#materials-collapse-join");
    const collapsePlanOpen = elCollapsePlan ? elCollapsePlan.open : true;
    const collapseJoinOpen = elCollapseJoin ? elCollapseJoin.open : false;
    const scrollSnap = captureMaterialsPanelScroll();

    const supOpts = ensureSupplierSelectOptions();
    const bnames = buildingNames();
    const pd = pdamCtx();
    const pdamOrphan = Number(pd.usedInstalledWithoutLength) || 0;
    const pdamOrphanLine =
      pdamOrphan > 0
        ? ` <span class="materials-pdam-orphan-inline">(시공 완료인데 파일구분(단본·합계)이 없어 길이별에 못 넣은 본수: <strong>${pdamOrphan}</strong>본)</span>`
        : "";
    const namesHtml = bnames.length
      ? bnames.map((n) => `<span class="materials-building-badge" role="listitem">${escapeHtml(n)}</span>`).join("")
      : `<span class="materials-building-badge materials-building-badge--muted" role="listitem">(프로젝트에 동·주차장 윤곽이 없습니다. 동 설정 후 저장하세요.)</span>`;

    const cementEst = cementEstimatesPair();
    const cementMode = bundle.cementPresets?.mode === "detail" ? "detail" : "tonPerMPhi";
    const reqTon = cementMode === "detail" ? cementEst.detailTf : cementEst.tonPerMPhi;
    const intakeTfTotal = cementIntakeTfTotal();
    const unOrd = Math.max(0, reqTon - intakeTfTotal);
    const cementPdamEst = cementTonEstimatesForMeter(cementPdamWeightedMeter());
    const pdamCementReqTon = cementMode === "detail" ? cementPdamEst.detailTf : cementPdamEst.tonPerMPhi;
    const cementBulkRemainTf = intakeTfTotal - pdamCementReqTon;
    const cementPdamModeLabel = cementMode === "detail" ? "상세" : "Φ별 ton/m";
    const cementRemainClass = cementBulkRemainTf < -0.0005 ? "materials-cement-remain--warn" : "";

    mount.innerHTML = `
<div class="materials-shell">
<div class="materials-toolbar">
  <div class="materials-filter-group">
    <div class="materials-filter-item">
      <span class="materials-filter-label">기간</span>
      <select id="materials-filter-mode" class="save-work-select" aria-label="기간 필터 방식">
        <option value="all" ${filterMode === "all" ? "selected" : ""}>전체</option>
        <option value="month" ${filterMode === "month" ? "selected" : ""}>월</option>
        <option value="range" ${filterMode === "range" ? "selected" : ""}>기간</option>
      </select>
    </div>
    <div id="materials-filter-month-wrap" class="materials-filter-item ${filterMode === "month" ? "" : "hidden"}">
      <span class="materials-filter-label">대상 월</span>
      <input type="month" id="materials-filter-month" class="save-work-input" value="${escapeHtml(filterMonth)}" aria-label="집계할 월" />
    </div>
    <div id="materials-filter-range-wrap" class="materials-filter-item materials-range-wrap ${filterMode === "range" ? "" : "hidden"}">
      <span class="materials-filter-label">시작</span>
      <input type="date" id="materials-filter-from" class="save-work-input" value="${escapeHtml(filterFrom)}" aria-label="기간 시작" />
      <span class="materials-range-tilde">~</span>
      <span class="materials-filter-label">종료</span>
      <input type="date" id="materials-filter-to" class="save-work-input" value="${escapeHtml(filterTo)}" aria-label="기간 종료" />
    </div>
  </div>
  <div class="materials-toolbar-actions">
    <button type="button" class="header-construction-btn" id="materials-btn-save">서버에 저장</button>
    <span id="materials-save-hint" class="materials-save-hint" aria-live="polite"></span>
  </div>
</div>

<details class="materials-details">
  <summary>업체·상차·시멘트 설정</summary>
  <div class="materials-settings-stack">
    <div class="materials-cardish materials-cardish--dataset">
      <h4 class="materials-h4">PDAM 시공 데이터셋</h4>
      <p class="construction-placeholder-hint materials-dataset-hint">저장 작업을 불러온 뒤 목록에서 고르고 <strong>불러오기</strong>를 누르면 길이별 요약·시멘트·상차 힌트에 반영됩니다. (시공현황과 동일 데이터셋)</p>
      <div class="materials-dataset-row">
        <select id="materials-dataset-select" class="save-work-select" aria-label="시공 데이터셋 선택"></select>
        <button type="button" class="header-construction-btn materials-dataset-apply-btn" id="materials-dataset-apply" disabled>불러오기</button>
      </div>
      <div class="materials-dataset-actions">
        <button type="button" class="ghost" id="materials-dataset-refresh">목록 새로고침</button>
      </div>
      <p id="materials-dataset-status" class="materials-dataset-status" aria-live="polite"></p>
    </div>
    <div class="materials-cardish materials-cardish--suppliers">
      <h4 class="materials-h4">발주 업체</h4>
      <div class="materials-table-shell materials-table-shell--settings">
        <table class="construction-records-table materials-mini-table materials-suppliers-table">
          <thead><tr><th>업체</th><th>담당</th><th>전화</th><th>주소</th><th title="거리(km)">km</th><th title="현장까지 소요">ETA</th><th></th></tr></thead>
          <tbody id="materials-tbody-suppliers"></tbody>
        </table>
      </div>
      <button type="button" class="ghost" id="materials-add-supplier">업체 추가</button>
    </div>
    <div class="materials-settings-row2">
      <div class="materials-cardish materials-cardish--truck">
        <h4 class="materials-h4">파일 상차 기준 (1단 기준)</h4>
        <div class="materials-table-shell materials-table-shell--truck">
          <table class="construction-records-table materials-mini-table materials-truck-table">
            <thead><tr><th title="길이(m)">m</th><th title="상차 본수">본수</th><th>비고</th></tr></thead>
            <tbody id="materials-tbody-truck"></tbody>
          </table>
        </div>
      </div>
      <div class="materials-cardish materials-cardish--cement">
        <h4 class="materials-h4">시멘트 계수</h4>
        <div class="materials-cement-fields">
          <label class="materials-field-label"><span class="materials-field-name">기준 Φ (ton/m)</span>
            <select id="materials-cement-phi" class="save-work-select materials-field-control">${["D300", "D350", "D400", "D450", "D500", "D600"]
              .map((p) => `<option value="${p}" ${(bundle.cementPresets?.selectedPhi || "D600") === p ? "selected" : ""}>${p}</option>`)
              .join("")}</select>
          </label>
        </div>
        <div class="materials-cement-pick-row" role="group" aria-label="필요 시멘트 산식 선택">
          <button type="button" class="materials-cement-pick${cementMode === "tonPerMPhi" ? " materials-cement-pick--selected" : ""}" id="materials-cement-pick-ton" data-cement-pick="tonPerMPhi" aria-pressed="${cementMode === "tonPerMPhi" ? "true" : "false"}">
            <span class="materials-cement-pick-title">Φ별 ton/m</span>
            <span class="materials-cement-pick-val">${cementEst.tonPerMPhi.toFixed(3)} <span class="materials-cement-pick-unit">tf</span></span>
            ${cementMode === "tonPerMPhi" ? '<span class="materials-cement-pick-badge">요약·미발주에 적용</span>' : '<span class="materials-cement-pick-hint">클릭하여 선택</span>'}
          </button>
          <button type="button" class="materials-cement-pick${cementMode === "detail" ? " materials-cement-pick--selected" : ""}" id="materials-cement-pick-detail" data-cement-pick="detail" aria-pressed="${cementMode === "detail" ? "true" : "false"}" title="단면적×연장×1m³당 시멘트(kg)">
            <span class="materials-cement-pick-title">상세(kg/m³)</span>
            <span class="materials-cement-pick-val">${cementEst.detailTf.toFixed(3)} <span class="materials-cement-pick-unit">tf</span></span>
            ${cementMode === "detail" ? '<span class="materials-cement-pick-badge">요약·미발주에 적용</span>' : '<span class="materials-cement-pick-hint">클릭하여 선택</span>'}
          </button>
        </div>
        <p class="construction-placeholder-hint materials-cement-req-line">계획 반영 연장(m) 약 <strong>${cementEst.totalMeter.toFixed(2)}</strong> m · 적용값 <strong id="materials-cement-req">${reqTon.toFixed(3)}</strong> tf</p>
      </div>
    </div>
  </div>
</details>

<div class="materials-grid">
  <div class="materials-grid__main">
    <section class="materials-block materials-block--wide">
      <details class="materials-collapse" id="materials-collapse-plan"${collapsePlanOpen ? " open" : ""}>
        <summary class="materials-collapse-summary">
          <span class="materials-collapse-title" title="동×길이 계획 본수">동별 계획</span>
        </summary>
        <div class="materials-collapse-panel">
          <div class="materials-table-shell materials-table-shell--wide materials-table-shell--matrix">
            <table class="construction-records-table materials-matrix" id="materials-table-matrix">
              <thead id="materials-thead-matrix"></thead>
              <tbody id="materials-tbody-matrix"></tbody>
            </table>
          </div>
        </div>
      </details>
    </section>

    <section class="materials-block materials-block--wide">
      <details class="materials-collapse" id="materials-collapse-join"${collapseJoinOpen ? " open" : ""}>
        <summary class="materials-collapse-summary">
          <span class="materials-collapse-title" title="16m를 넘는 파일 단본(한 본 연장)을 쓸 때, PDAM·입고 집계에 맞게 두 구간(m)으로 나누는 규격">단본 이음 규격</span>
          <span class="materials-collapse-subhint">· 16m 초과 말뚝을 파일 단본으로 쓸 때만 필요 — 연장을 두 구간으로 어떻게 쪼갤지 정합니다</span>
        </summary>
        <div class="materials-collapse-panel">
          <div class="materials-join-manager-wrap" id="materials-join-manager-wrap"></div>
        </div>
      </details>
    </section>

    <section class="materials-block materials-block--wide">
      <h3 class="materials-h3" title="발주요청·입고·업체별 본수">입고·발주</h3>
      <p class="construction-placeholder-hint materials-block-intro-hint">날짜는 달력으로 선택 · 길이 열은 숫자만 · 행 추가 후 <strong>직전 행 복사</strong>로 비슷한 입고를 빠르게 넣을 수 있습니다.</p>
      <div class="materials-table-shell materials-table-shell--wide">
        <table class="construction-records-table materials-wide-table materials-receipt-table" id="materials-table-receipts">
          <thead id="materials-thead-receipts"></thead>
          <tbody id="materials-tbody-receipts"></tbody>
        </table>
      </div>
      <div class="materials-receipt-actions">
        <button type="button" class="ghost" id="materials-add-receipt">입고 행 추가</button>
        <button type="button" class="ghost" id="materials-copy-last-receipt" title="마지막 입고 행을 통째로 복사합니다">직전 행 복사</button>
      </div>
    </section>
  </div>

  <aside class="materials-grid__aside" aria-label="동·요약·부가">
    <section class="materials-block">
      <h3 class="materials-h3" title="윤곽·동 설정과 동일 소스">동 목록</h3>
      <div class="materials-building-badges" role="list">${namesHtml}</div>
    </section>

    <section class="materials-block">
      <h3 class="materials-h3" title="길이별 집계">길이별 요약</h3>
      <p class="construction-placeholder-hint materials-block-intro-hint">반입=기간 내 입고 합 · 사용=PDAM 시공 완료(단본·합계 m) · 미발주=계획−반입 · 단본 이음=규격의 두 구간(m)으로 총연장 본수를 길이 열에 나눔${pdamOrphanLine}</p>
      <div class="materials-table-shell">
        <table class="construction-records-table materials-summary-table">
          <thead><tr><th>길이</th><th>계획</th><th>반입</th><th title="PDAM 시공 완료 본수(파일구분 단본 또는 합계 m)">사용</th><th title="파손·반출 합">파손</th><th>재고</th><th title="계획−반입">미발주</th></tr></thead>
          <tbody id="materials-tbody-summary"></tbody>
        </table>
      </div>
    </section>

    <section class="materials-block">
      <h3 class="materials-h3" title="입고·발주 표와 동일 기간 필터">업체별 말뚝·파일 발주 현황</h3>
      <div class="materials-table-shell materials-table-shell--supplier-rcpt">
        <table class="construction-records-table materials-supplier-rcpt-table" id="materials-table-by-supplier">
          <thead id="materials-thead-by-supplier"></thead>
          <tbody id="materials-tbody-by-supplier"></tbody>
        </table>
      </div>
    </section>

    <section class="materials-block">
      <h3 class="materials-h3">파손·반출</h3>
      <div class="materials-table-shell">
        <table class="construction-records-table materials-damage-table">
          <thead class="materials-compact-thead"><tr><th class="materials-damage-th-idx" title="순번">#</th><th class="materials-damage-th-date">일자</th><th>업체</th><th title="길이(m)">m</th><th>비고</th><th class="materials-damage-th-del" scope="col" title="행 삭제"><span aria-hidden="true">×</span></th></tr></thead>
          <tbody id="materials-tbody-damage"></tbody>
        </table>
      </div>
      <button type="button" class="ghost" id="materials-add-damage">행 추가</button>
    </section>

    <section class="materials-block">
      <h3 class="materials-h3" title="시멘트 벌크 발주·현장 반입">시멘트 벌크</h3>
      <div class="materials-cement-bulk-board" role="region" aria-label="시멘트 벌크 PDAM 기준 요약">
        <div class="materials-cement-bulk-strip">
          <p class="materials-cement-bulk-strip-title">PDAM 시공 · 길이별 사용 기준</p>
          <dl class="materials-cement-bulk-kv">
            <div class="materials-cement-bulk-kv-row">
              <dt title="PDAM 시공 완료 기준, 길이(m)×본수(및 단본 이음 총연장)를 합산한 값">시공 연장 합계(m)</dt>
              <dd><strong>${cementPdamEst.totalMeter.toFixed(2)}</strong> m</dd>
            </div>
            <div class="materials-cement-bulk-kv-row">
              <dt>예상 시멘트</dt>
              <dd><span class="materials-cement-bulk-mode">${escapeHtml(cementPdamModeLabel)}</span> <strong>${pdamCementReqTon.toFixed(3)}</strong> tf</dd>
            </div>
          </dl>
        </div>
        <div class="materials-cement-bulk-strip materials-cement-bulk-strip--calc">
          <p class="materials-cement-bulk-strip-title">입고 누적 대비 잔량</p>
          <dl class="materials-cement-bulk-kv">
            <div class="materials-cement-bulk-kv-row">
              <dt>입고 누적</dt>
              <dd><strong>${intakeTfTotal.toFixed(3)}</strong> tf</dd>
            </div>
            <div class="materials-cement-bulk-kv-row">
              <dt>위 예상</dt>
              <dd><strong>${pdamCementReqTon.toFixed(3)}</strong> tf</dd>
            </div>
            <div class="materials-cement-bulk-kv-row materials-cement-bulk-kv-row--emph">
              <dt title="입고 누적 − 위 예상">잔량</dt>
              <dd><strong class="${cementRemainClass}">${cementBulkRemainTf.toFixed(3)}</strong> tf</dd>
            </div>
          </dl>
          <p class="materials-cement-bulk-foot">벌크 입고 누적에서 PDAM 기준 예상 사용량을 뺀 값입니다.</p>
        </div>
      </div>
      <div class="materials-cement-summary-strip" role="note" aria-label="시멘트 누적 요약">
        <table class="materials-cement-summary-table">
          <tbody>
            <tr>
              <th scope="row">입고 누적</th>
              <td><strong class="materials-cement-summary-num">${intakeTfTotal.toFixed(3)}</strong><span class="materials-cement-summary-unit"> tf</span></td>
            </tr>
            <tr>
              <th scope="row">필요<span class="materials-cement-summary-sub">(추정)</span></th>
              <td><strong class="materials-cement-summary-num">${reqTon.toFixed(3)}</strong><span class="materials-cement-summary-unit"> tf</span></td>
            </tr>
            <tr class="materials-cement-summary-row--em">
              <th scope="row">미발주<span class="materials-cement-summary-sub" title="필요(추정) − 입고 누적">(필요−입고)</span></th>
              <td><strong class="materials-cement-summary-num">${unOrd.toFixed(3)}</strong><span class="materials-cement-summary-unit"> tf</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="materials-cement-ledger-stack">
        <div class="materials-table-shell materials-table-shell--cement-bulk">
          <table class="construction-records-table materials-cement-table">
            <thead class="materials-compact-thead"><tr><th class="materials-cement-th-idx" scope="col" title="순번">#</th><th title="발주 요청일">요청</th><th title="현장 입고일">입고일</th><th title="해당 행 시멘트 입고량(tf)">입고(tf)</th><th title="위에서부터 이 행까지 입고(tf) 합">입고누계</th><th>비고</th><th class="materials-cement-th-del" scope="col" title="행 삭제"><span aria-hidden="true">×</span></th></tr></thead>
            <tbody id="materials-tbody-cement"></tbody>
          </table>
        </div>
        <button type="button" class="ghost" id="materials-add-cement">행 추가</button>
      </div>
    </section>

    <section class="materials-block materials-block--pdam">
      <h3 class="materials-h3">PDAM 연동 요약</h3>
      <p class="materials-pdam-blurb">시공 완료(PDAM·시공현황과 동일 기간) 총 <strong>${pd.totalInstalled || 0}</strong>본 · 위치별:
        ${Object.keys(pd.installedByLocation || {})
          .map((k) => `${escapeHtml(k)} ${pd.installedByLocation[k]}본`)
          .join(" · ") || "(데이터 없음 — 시공현황에서 데이터셋 적용 후 확인)"}
      </p>
    </section>

    <section class="materials-block">
      <h3 class="materials-h3" title="기간 입고·적재 기준으로 차수별 본수, 계획 대비 미발주 안내">상차 힌트</h3>
      <div id="materials-truck-hint" class="materials-truck-hint-root" role="region" aria-label="길이별 상차·미발주 힌트"></div>
    </section>
  </aside>
</div>
</div>
`;

    renderSuppliers();
    renderTruckRules();
    renderReceiptsHeadAndBody(supOpts);
    renderMatrix(bnames);
    renderJoinLengthManager();
    wireJoinLengthManager();
    renderSummary();
    renderSupplierReceiptAgg();
    renderDamage(supOpts);
    renderCement();
    renderTruckHint();

    wireToolbar();
    wireMaterialsDatasetControls();

    const detAfter = mount.querySelector(".materials-details");
    if (detAfter) {
      detAfter.open = detailsWasOpen;
      detAfter.addEventListener("toggle", () => {
        if (detAfter.open) void refreshMaterialsDatasetSelect();
      });
    }

    const restoreScroll = () => restoreMaterialsPanelScroll(scrollSnap);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScroll();
        window.setTimeout(restoreScroll, 0);
        window.setTimeout(restoreScroll, 50);
      });
    });
  }

  function renderSuppliers() {
    const tb = document.getElementById("materials-tbody-suppliers");
    if (!tb) return;
    tb.innerHTML = (bundle.suppliers || [])
      .map(
        (s, i) => `
      <tr data-supplier-idx="${i}">
        <td><input class="save-work-input" data-k="name" value="${escapeHtml(s.name)}" /></td>
        <td><input class="save-work-input" data-k="contact" value="${escapeHtml(s.contact)}" /></td>
        <td><input class="save-work-input" data-k="phone" value="${escapeHtml(s.phone)}" /></td>
        <td><input class="save-work-input" data-k="address" value="${escapeHtml(s.address)}" /></td>
        <td><input class="save-work-input" type="number" step="0.1" data-k="distanceKm" value="${Number(s.distanceKm) || 0}" /></td>
        <td><input class="save-work-input" data-k="etaText" value="${escapeHtml(s.etaText)}" /></td>
        <td><button type="button" class="ghost materials-row-del" data-del-supplier="${i}">삭제</button></td>
      </tr>`,
      )
      .join("");
    tb.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const tr = inp.closest("tr");
        const idx = Number(tr?.dataset?.supplierIdx);
        const k = inp.dataset.k;
        if (!bundle.suppliers[idx]) return;
        bundle.suppliers[idx][k] = inp.type === "number" ? Number(inp.value) : inp.value;
        scheduleSave();
        fullRender();
      });
    });
    tb.querySelectorAll("[data-del-supplier]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del-supplier"));
        bundle.suppliers.splice(i, 1);
        scheduleSave();
        fullRender();
      });
    });
  }

  function ensureReceiptQtyKeys(r) {
    if (!r) return;
    if (!r.qtyByLength) r.qtyByLength = {};
    LENS.forEach((L) => {
      const k = String(L);
      if (r.qtyByLength[k] == null) r.qtyByLength[k] = 0;
    });
    getJoinLengthRows().forEach((j) => {
      if (r.qtyByLength[j.key] == null) r.qtyByLength[j.key] = 0;
    });
  }

  function receiptRowTotalPieces(r) {
    if (!r) return 0;
    let n = 0;
    LENS.forEach((L) => {
      n += Number(r.qtyByLength && r.qtyByLength[String(L)]) || 0;
    });
    getJoinLengthRows().forEach((j) => {
      n += Number(r.qtyByLength && r.qtyByLength[j.key]) || 0;
    });
    return n;
  }

  function receiptPasteColumnsSpec() {
    const cols = [
      { kind: "date", f: "requestDate" },
      { kind: "date", f: "arrivalDate" },
      { kind: "supplier", f: "supplierId" },
      { kind: "int", f: "amTrucks" },
      { kind: "int", f: "pmTrucks" },
    ];
    LENS.forEach((L) => cols.push({ kind: "qty", key: String(L) }));
    getJoinLengthRows().forEach((j) => cols.push({ kind: "qty", key: j.key }));
    cols.push({ kind: "note", f: "note" });
    return cols;
  }

  function getReceiptPasteStartColIndex(activeEl) {
    if (!activeEl || !activeEl.dataset) return -1;
    const f = activeEl.dataset.f;
    if (f === "requestDate") return 0;
    if (f === "arrivalDate") return 1;
    if (f === "supplierId") return 2;
    if (f === "amTrucks") return 3;
    if (f === "pmTrucks") return 4;
    if (activeEl.dataset.len != null) {
      const k = String(activeEl.dataset.len);
      return receiptPasteColumnsSpec().findIndex((c) => c.kind === "qty" && c.key === k);
    }
    if (activeEl.dataset.join != null) {
      const k = String(activeEl.dataset.join);
      return receiptPasteColumnsSpec().findIndex((c) => c.kind === "qty" && c.key === k);
    }
    if (f === "note") return receiptPasteColumnsSpec().findIndex((c) => c.kind === "note");
    return -1;
  }

  function matchSupplierIdFromPaste(text) {
    const t = String(text ?? "").trim();
    if (!t) return "";
    const list = bundle.suppliers || [];
    const byId = list.find((s) => String(s.id) === t);
    if (byId) return String(byId.id);
    const exact = list.find((s) => String(s.name || "").trim() === t);
    if (exact) return String(exact.id);
    const low = t.toLowerCase();
    const loose = list.find((s) => String(s.name || "").toLowerCase().includes(low) || low.includes(String(s.name || "").toLowerCase()));
    return loose ? String(loose.id) : "";
  }

  function parsePastedReceiptDate(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const lo = parseDateLoose(s);
    if (lo) return lo;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const n = Number(s);
    if (Number.isFinite(n) && n > 20000 && n < 65000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + Math.round(n) * 86400000);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      }
    }
    return "";
  }

  function applyReceiptPasteOneCell(r, col, raw) {
    const rawStr = String(raw ?? "");
    if (col.kind === "note") {
      const v = rawStr.replace(/\r/g, "").replace(/^\uFEFF/, "").trim();
      if (v === String(r.note ?? "")) return false;
      r.note = v;
      return true;
    }
    if (col.kind === "supplier") {
      const id = matchSupplierIdFromPaste(rawStr);
      if (!id || id === String(r.supplierId ?? "")) return false;
      r.supplierId = id;
      return true;
    }
    if (col.kind === "date") {
      const v = parsePastedReceiptDate(rawStr);
      if (!v || v === String(r[col.f] ?? "")) return false;
      r[col.f] = v;
      return true;
    }
    if (col.kind === "int") {
      const v = parseMatrixPasteCell(rawStr);
      if (v === null) return false;
      const cur = Number(r[col.f]) || 0;
      if (v === cur) return false;
      r[col.f] = v;
      return true;
    }
    if (col.kind === "qty") {
      const v = parseMatrixPasteCell(rawStr);
      if (v === null) return false;
      if (!r.qtyByLength) r.qtyByLength = {};
      if (Number(r.qtyByLength[col.key]) === v) return false;
      r.qtyByLength[col.key] = v;
      return true;
    }
    return false;
  }

  function onReceiptsTablePaste(e) {
    const tbody = e.currentTarget;
    if (!(tbody instanceof HTMLElement) || tbody.id !== "materials-tbody-receipts") return;
    const text = e.clipboardData?.getData("text/plain");
    if (!text || !matrixPasteLooksLikeGrid(text)) return;
    const active = document.activeElement;
    if (!tbody.contains(active)) return;
    const startCol = getReceiptPasteStartColIndex(active);
    if (startCol < 0) return;
    const startRcpt = Number(active.dataset?.rcpt);
    if (!Number.isFinite(startRcpt)) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = matrixPasteTrimTrailingEmptyCols(parseExcelPastedGrid(text));
    const spec = receiptPasteColumnsSpec();
    let changed = false;
    grid.forEach((pasteRow, dr) => {
      const ri = startRcpt + dr;
      const r = bundle.receipts[ri];
      if (!r) return;
      ensureReceiptQtyKeys(r);
      if (!Array.isArray(pasteRow)) return;
      pasteRow.forEach((cell, dc) => {
        const ci = startCol + dc;
        if (ci >= spec.length) return;
        if (applyReceiptPasteOneCell(r, spec[ci], cell)) changed = true;
      });
    });
    if (changed) {
      scheduleSave();
      fullRender();
    }
  }

  function supplierRowToneClass(supplierId) {
    const raw = String(supplierId ?? "").trim();
    if (!raw) return "materials-rcpt-sup--na";
    const idx = (bundle.suppliers || []).findIndex((s) => String(s.id) === raw);
    if (idx < 0) return "materials-rcpt-sup--na";
    return `materials-rcpt-sup--${idx % 8}`;
  }

  function renderTruckRules() {
    const tb = document.getElementById("materials-tbody-truck");
    if (!tb) return;
    tb.innerHTML = (bundle.truckLoadRules || [])
      .map(
        (r, i) => `
      <tr data-truck-idx="${i}">
        <td>${escapeHtml(r.lengthM)}</td>
        <td><input class="save-work-input" type="number" min="1" step="1" data-k="piecesPerTruck" value="${Number(r.piecesPerTruck) || ""}" /></td>
        <td><input class="save-work-input" data-k="note" value="${escapeHtml(r.note)}" /></td>
      </tr>`,
      )
      .join("");
    tb.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const tr = inp.closest("tr");
        const idx = Number(tr?.dataset?.truckIdx);
        const k = inp.dataset.k;
        const row = bundle.truckLoadRules[idx];
        if (!row) return;
        row[k] = inp.type === "number" ? Number(inp.value) : inp.value;
        scheduleSave();
        fullRender();
      });
    });
  }

  function renderReceiptsHeadAndBody(supOpts) {
    const thead = document.getElementById("materials-thead-receipts");
    const tbody = document.getElementById("materials-tbody-receipts");
    if (!thead || !tbody) return;
    const joinRows = getJoinLengthRows();
    const nLen = LENS.length;
    const nJoin = joinRows.length;
    const lenGroup = `<th colspan="${nLen + nJoin}" class="materials-rcpt-len-group" title="5~15m 및 단본 이음(J총연장) 본수">본수 (m)</th>`;
    const lenSub =
      LENS.map((L) => `<th class="materials-len-col" title="${L}m">${L}</th>`).join("") +
      joinRows
        .map(
          (j) =>
            `<th class="materials-len-col materials-len-col--join" title="단본 이음 ${j.totalM}m (${j.label})">${escapeHtml(j.key)}</th>`,
        )
        .join("");
    thead.innerHTML = `<tr>
      <th rowspan="2" title="순번">#</th>
      <th rowspan="2" title="발주요청일">요청</th>
      <th rowspan="2" title="입고일">입고</th>
      <th rowspan="2" title="발주 업체">업체</th>
      <th rowspan="2" title="오전 대수">오전</th>
      <th rowspan="2" title="오후 대수">오후</th>
      ${lenGroup}
      <th rowspan="2" class="materials-rcpt-th-sum" title="이 행 길이·이음 본수 합계">Σ</th>
      <th rowspan="2" title="비고">메모</th>
      <th rowspan="2" class="materials-th-del" title="행 삭제">삭제</th>
    </tr><tr>${lenSub}</tr>`;
    tbody.innerHTML = (bundle.receipts || [])
      .map((r, i) => {
        if (!inFilterRange(r.requestDate) && !inFilterRange(r.arrivalDate)) return "";
        ensureReceiptQtyKeys(r);
        const supClass = supplierRowToneClass(r.supplierId);
        const qcells = LENS.map((L) => {
          const v = Number(r.qtyByLength && r.qtyByLength[String(L)]) || 0;
          const fill = v > 0 ? " materials-rcpt-qty-td--filled" : "";
          return `<td class="materials-rcpt-qty-td${fill}"><input type="number" min="0" step="1" class="save-work-input materials-cell-inp" data-rcpt="${i}" data-len="${L}" value="${v}" /></td>`;
        }).join("");
        const jcells = joinRows
          .map((j) => {
            const v = Number(r.qtyByLength && r.qtyByLength[j.key]) || 0;
            const fill = v > 0 ? " materials-rcpt-qty-td--filled" : "";
            return `<td class="materials-rcpt-qty-td materials-rcpt-qty-td--join${fill}"><input type="number" min="0" step="1" class="save-work-input materials-cell-inp" data-rcpt="${i}" data-join="${escapeHtml(j.key)}" value="${v}" title="${j.totalM}m 이음" /></td>`;
          })
          .join("");
        const rowSum = receiptRowTotalPieces(r);
        return `<tr class="materials-rcpt-row ${supClass}">
          <td>${i + 1}</td>
          <td><input type="date" class="save-work-input materials-date-inp" data-rcpt="${i}" data-f="requestDate" value="${escapeHtml(toDateInputValue(r.requestDate))}" /></td>
          <td><input type="date" class="save-work-input materials-date-inp" data-rcpt="${i}" data-f="arrivalDate" value="${escapeHtml(toDateInputValue(r.arrivalDate))}" /></td>
          <td class="materials-rcpt-td-supplier"><select class="save-work-select" data-rcpt="${i}" data-f="supplierId">${supOpts}</select></td>
          <td><input type="number" min="0" class="save-work-input materials-am-pm-inp" data-rcpt="${i}" data-f="amTrucks" value="${Number(r.amTrucks) || 0}" /></td>
          <td><input type="number" min="0" class="save-work-input materials-am-pm-inp" data-rcpt="${i}" data-f="pmTrucks" value="${Number(r.pmTrucks) || 0}" /></td>
          ${qcells}
          ${jcells}
          <td class="materials-rcpt-row-sum" title="이 행 본수 합(5~15m + 이음)"><span class="materials-rcpt-row-sum-num">${rowSum}</span></td>
          <td><input class="save-work-input" data-rcpt="${i}" data-f="note" value="${escapeHtml(r.note)}" /></td>
          <td><button type="button" class="ghost" data-del-rcpt="${i}">삭제</button></td>
        </tr>`;
      })
      .join("");
    tbody.querySelectorAll("select[data-rcpt]").forEach((sel) => {
      sel.value = bundle.receipts[Number(sel.dataset.rcpt)]?.supplierId || "";
      sel.addEventListener("change", () => {
        const i = Number(sel.dataset.rcpt);
        bundle.receipts[i].supplierId = sel.value;
        scheduleSave();
        fullRender();
      });
    });
    tbody.querySelectorAll("input[data-rcpt]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.rcpt);
        const row = bundle.receipts[i];
        if (!row) return;
        if (inp.dataset.len) {
          if (!row.qtyByLength) row.qtyByLength = {};
          row.qtyByLength[String(inp.dataset.len)] = Number(inp.value) || 0;
        } else if (inp.dataset.join) {
          if (!row.qtyByLength) row.qtyByLength = {};
          row.qtyByLength[String(inp.dataset.join)] = Number(inp.value) || 0;
        } else if (inp.dataset.f) {
          row[inp.dataset.f] = inp.type === "number" ? Number(inp.value) : inp.value;
        }
        scheduleSave();
        fullRender();
      });
    });
    tbody.querySelectorAll("[data-del-rcpt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del-rcpt"));
        bundle.receipts.splice(i, 1);
        scheduleSave();
        fullRender();
      });
    });
    tbody.addEventListener("paste", onReceiptsTablePaste, true);
  }

  function matrixColumnKeys() {
    return [...LENS.map((L) => String(L)), ...getJoinLengthRows().map((j) => j.key)];
  }

  function parseExcelPastedGrid(text) {
    const raw = String(text ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    let lines = raw.split("\n");
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    if (!lines.length) return [];
    return lines.map((line) => line.split("\t"));
  }

  /** 붙여넣기 한 칸: 비어 있거나 숫자가 아니면 null(해당 칸은 건너뜀 — 엑셀 병합·동 이름 열 등). */
  function parseMatrixPasteCell(cell) {
    const t = String(cell ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(/,/g, "");
    if (t === "") return null;
    if (t === "-") return 0;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }

  /** 엑셀에서 동명+숫자 블록을 통째로 복사했을 때, 맨 왼열이 전부 비숫자이면 숫자 열만 남긴다. */
  function matrixPasteStripLeadingLabelColumn(grid, startColIdx) {
    if (startColIdx !== 0 || !Array.isArray(grid) || !grid.length) return grid;
    const firstAllSkippable = grid.every((row) => {
      if (!row || !row.length) return true;
      return parseMatrixPasteCell(row[0]) === null;
    });
    const hasSecondColNumber = grid.some((row) => row && row.length > 1 && parseMatrixPasteCell(row[1]) !== null);
    if (!firstAllSkippable || !hasSecondColNumber) return grid;
    return grid.map((row) => (Array.isArray(row) && row.length ? row.slice(1) : row));
  }

  /** 행마다 끝의 빈 칸만 제거(탭만 많이 붙은 경우 열 밀림 완화). */
  function matrixPasteTrimTrailingEmptyCols(grid) {
    if (!Array.isArray(grid) || !grid.length) return grid;
    let maxCol = 0;
    grid.forEach((row) => {
      if (!Array.isArray(row)) return;
      maxCol = Math.max(maxCol, row.length);
    });
    let last = maxCol - 1;
    while (last >= 0) {
      const any = grid.some((row) => {
        const c = row && row[last];
        return String(c ?? "").trim() !== "";
      });
      if (any) break;
      last -= 1;
    }
    const keep = last + 1;
    if (keep <= 0) return grid;
    return grid.map((row) => (Array.isArray(row) ? row.slice(0, keep) : row));
  }

  function matrixPasteLooksLikeGrid(text) {
    return /\t|\n|\r/.test(String(text || ""));
  }

  function applyExcelPasteToMatrix(startInp, grid) {
    const startB = startInp.getAttribute("data-plan-b");
    const startK = startInp.getAttribute("data-plan-k");
    const columnsOrder = matrixColumnKeys();
    const rowsOrder = buildingNames().length ? buildingNames() : ["(동 없음)"];
    const startRowIdx = rowsOrder.indexOf(startB);
    const startColIdx = columnsOrder.indexOf(startK);
    if (startRowIdx < 0 || startColIdx < 0) return false;
    let g = matrixPasteTrimTrailingEmptyCols(grid.map((row) => (Array.isArray(row) ? row.slice() : row)));
    g = matrixPasteStripLeadingLabelColumn(g, startColIdx);
    let changed = false;
    g.forEach((pasteRow, dr) => {
      const r = startRowIdx + dr;
      if (r >= rowsOrder.length) return;
      const bname = rowsOrder[r];
      if (bname === "(동 없음)") return;
      if (!Array.isArray(pasteRow)) return;
      pasteRow.forEach((rawCell, dc) => {
        const c = startColIdx + dc;
        if (c >= columnsOrder.length) return;
        const key = columnsOrder[c];
        const v = parseMatrixPasteCell(rawCell);
        if (v === null) return;
        if (!bundle.planByBuilding[bname]) bundle.planByBuilding[bname] = {};
        const prev = Number(bundle.planByBuilding[bname][key]) || 0;
        if (prev !== v) changed = true;
        bundle.planByBuilding[bname][key] = v;
      });
    });
    return changed;
  }

  /** 엑셀 병합 등으로 빈 칸이 끼어 있어도, 읽는 순서(행→열)로 숫자만 모아 연속 채우기에 사용 */
  function flattenPasteGridDense(grid) {
    const out = [];
    (grid || []).forEach((row) => {
      if (!Array.isArray(row)) return;
      row.forEach((cell) => {
        const v = parseMatrixPasteCell(cell);
        if (v !== null) out.push(v);
      });
    });
    return out;
  }

  /** 시작 칸부터 행 우선 순서로 flat 값을 한 칸씩 채움(병합·빈 칸 무시한 순서 붙여넣기) */
  function applyDensePasteToMatrix(startInp, flatValues) {
    if (!flatValues || !flatValues.length) return false;
    const columnsOrder = matrixColumnKeys();
    const rowsOrder = buildingNames().length ? buildingNames() : ["(동 없음)"];
    const startB = startInp.getAttribute("data-plan-b");
    const startK = startInp.getAttribute("data-plan-k");
    const startRowIdx = rowsOrder.indexOf(startB);
    const startColIdx = columnsOrder.indexOf(startK);
    if (startRowIdx < 0 || startColIdx < 0) return false;
    let vi = 0;
    let changed = false;
    for (let r = startRowIdx; r < rowsOrder.length && vi < flatValues.length; r += 1) {
      const bname = rowsOrder[r];
      if (bname === "(동 없음)") continue;
      const c0 = r === startRowIdx ? startColIdx : 0;
      for (let c = c0; c < columnsOrder.length && vi < flatValues.length; c += 1) {
        const key = columnsOrder[c];
        const v = flatValues[vi];
        vi += 1;
        if (!bundle.planByBuilding[bname]) bundle.planByBuilding[bname] = {};
        const prev = Number(bundle.planByBuilding[bname][key]) || 0;
        if (prev !== v) changed = true;
        bundle.planByBuilding[bname][key] = v;
      }
    }
    return changed;
  }

  function renderMatrix(bnames) {
    const thead = document.getElementById("materials-thead-matrix");
    const tbody = document.getElementById("materials-tbody-matrix");
    const tbl = document.getElementById("materials-table-matrix");
    if (!thead || !tbody) return;
    const joinRows = getJoinLengthRows();
    const joinTh = joinRows
      .map((j) => {
        const tm = Number(j.totalM);
        const s1 = Number(j.seg1M);
        const s2 = Number(j.seg2M);
        return `<th class="materials-matrix-col--join" scope="col" title="단본 이음 ${tm}m (${s1}+${s2}) — 구간은 표 아래에서 수정">${tm}m</th>`;
      })
      .join("");
    const lenTh = LENS.map((L) => `<th title="${L}m">${L}</th>`).join("");
    thead.innerHTML = `<tr><th title="동·주차장">동</th>${lenTh}${joinTh}<th>합계</th></tr>`;
    const nDataCols = LENS.length + joinRows.length;
    if (tbl) {
      tbl.querySelector("colgroup")?.remove();
      const cg = document.createElement("colgroup");
      const cDong = document.createElement("col");
      cDong.className = "materials-matrix-col-dong";
      cg.appendChild(cDong);
      const wEdge = 6.5;
      const cSum = document.createElement("col");
      cSum.className = "materials-matrix-col-sum";
      if (nDataCols === 0) {
        cDong.style.width = "50%";
        cSum.style.width = "50%";
      } else {
        const wEach = (100 - 2 * wEdge) / nDataCols;
        for (let i = 0; i < nDataCols; i += 1) {
          const c = document.createElement("col");
          c.className = "materials-matrix-col-data";
          c.style.width = `${wEach}%`;
          cg.appendChild(c);
        }
        cDong.style.width = `${wEdge}%`;
        cSum.style.width = `${wEdge}%`;
      }
      cg.appendChild(cSum);
      tbl.insertBefore(cg, thead);
    }
    const rows = bnames.length ? bnames : ["(동 없음)"];
    const ncol = LENS.length + joinRows.length;
    const colByLen = {};
    LENS.forEach((L) => {
      colByLen[String(L)] = 0;
    });
    const colByJoin = {};
    joinRows.forEach(({ key }) => {
      colByJoin[key] = 0;
    });
    let grand = 0;
    tbody.innerHTML = rows
      .map((bname, ri) => {
        const plan = (bundle.planByBuilding && bundle.planByBuilding[bname]) || {};
        let rowSum = 0;
        const tds = LENS.map((L, ci) => {
          const v = Number(plan[String(L)]) || 0;
          rowSum += v;
          colByLen[String(L)] += v;
          const dis = bname === "(동 없음)" ? "disabled" : "";
          const fill = v > 0 ? " materials-matrix-qty-td--filled" : "";
          return `<td class="materials-matrix-qty-td${fill}"><input type="number" min="0" class="save-work-input materials-cell-inp materials-matrix-qty-inp" data-plan-b="${escapeHtml(bname)}" data-plan-k="${L}" data-matrix-r="${ri}" data-matrix-c="${ci}" value="${v}" ${dis} /></td>`;
        }).join("");
        const jtds = joinRows.map(({ key }, ji) => {
          const v = Number(plan[key]) || 0;
          rowSum += v;
          colByJoin[key] += v;
          const dis = bname === "(동 없음)" ? "disabled" : "";
          const ci = LENS.length + ji;
          const fill = v > 0 ? " materials-matrix-qty-td--filled materials-matrix-qty-td--join-filled" : "";
          return `<td class="materials-matrix-col--join materials-matrix-qty-td${fill}"><input type="number" min="0" class="save-work-input materials-cell-inp materials-matrix-qty-inp" data-plan-b="${escapeHtml(bname)}" data-plan-k="${escapeHtml(key)}" data-matrix-r="${ri}" data-matrix-c="${ci}" value="${v}" ${dis} /></td>`;
        }).join("");
        grand += rowSum;
        return `<tr><th>${escapeHtml(bname)}</th>${tds}${jtds}<td class="materials-matrix-row-sum">${rowSum}</td></tr>`;
      })
      .join("");
    const lenTotCells = LENS.map((L) => `<td class="materials-matrix-total-cell">${colByLen[String(L)]}</td>`).join("");
    const joinTotCells = joinRows.map(
      ({ key }) => `<td class="materials-matrix-total-cell materials-matrix-col--join">${colByJoin[key]}</td>`,
    ).join("");
    tbody.innerHTML += `<tr class="materials-total-row"><th>합계</th>${lenTotCells}${joinTotCells}<td class="materials-matrix-total-cell materials-matrix-grand-total">${grand}</td></tr>`;

    tbody.querySelectorAll("input[data-plan-b]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const b = inp.getAttribute("data-plan-b");
        const k = inp.getAttribute("data-plan-k");
        if (!bundle.planByBuilding[b]) bundle.planByBuilding[b] = {};
        bundle.planByBuilding[b][k] = Number(inp.value) || 0;
        scheduleSave();
        fullRender();
      });
    });

    const matrixInputs = Array.from(tbody.querySelectorAll("tr:not(.materials-total-row) input[data-plan-b][data-plan-k]:not(:disabled)"));
    const matrixCells = matrixInputs.map((inp) => ({
      inp,
      r: Number(inp.getAttribute("data-matrix-r")) || 0,
      c: Number(inp.getAttribute("data-matrix-c")) || 0,
    }));
    const maxMatrixR = rows.length - 1;

    function matrixNavRight(i) {
      const { r, c } = matrixCells[i];
      if (c + 1 < ncol) {
        const j = matrixCells.findIndex((x) => x.r === r && x.c === c + 1);
        if (j >= 0) return j;
      }
      for (let r2 = r + 1; r2 <= maxMatrixR; r2 += 1) {
        const j = matrixCells.findIndex((x) => x.r === r2 && x.c === 0);
        if (j >= 0) return j;
      }
      return null;
    }
    function matrixNavLeft(i) {
      const { r, c } = matrixCells[i];
      if (c > 0) {
        const j = matrixCells.findIndex((x) => x.r === r && x.c === c - 1);
        if (j >= 0) return j;
      }
      for (let r2 = r - 1; r2 >= 0; r2 -= 1) {
        const j = matrixCells.findIndex((x) => x.r === r2 && x.c === ncol - 1);
        if (j >= 0) return j;
      }
      return null;
    }
    function matrixNavDown(i) {
      const { r, c } = matrixCells[i];
      for (let r2 = r + 1; r2 <= maxMatrixR; r2 += 1) {
        const j = matrixCells.findIndex((x) => x.r === r2 && x.c === c);
        if (j >= 0) return j;
      }
      return null;
    }
    function matrixNavUp(i) {
      const { r, c } = matrixCells[i];
      for (let r2 = r - 1; r2 >= 0; r2 -= 1) {
        const j = matrixCells.findIndex((x) => x.r === r2 && x.c === c);
        if (j >= 0) return j;
      }
      return null;
    }

    let matrixAnchorIdx = null;
    let matrixEndIdx = null;
    let matrixSkipFocusReset = false;

    function matrixSelectionRect() {
      if (matrixAnchorIdx == null || matrixEndIdx == null) return null;
      const a = matrixCells[matrixAnchorIdx];
      const b = matrixCells[matrixEndIdx];
      if (!a || !b) return null;
      return {
        r0: Math.min(a.r, b.r),
        r1: Math.max(a.r, b.r),
        c0: Math.min(a.c, b.c),
        c1: Math.max(a.c, b.c),
      };
    }

    function matrixPaintSelection() {
      const rect = matrixSelectionRect();
      matrixCells.forEach(({ inp, r, c }) => {
        const td = inp.closest("td");
        if (!td) return;
        td.classList.remove("materials-matrix-td--selected");
        if (!rect) return;
        if (r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1) td.classList.add("materials-matrix-td--selected");
      });
    }

    matrixCells.forEach((cell, idx) => {
      const { inp } = cell;
      inp.addEventListener("mousedown", (e) => {
        if (e.shiftKey && matrixAnchorIdx != null) {
          matrixEndIdx = idx;
          matrixSkipFocusReset = true;
        } else {
          matrixAnchorIdx = idx;
          matrixEndIdx = idx;
        }
        matrixPaintSelection();
      });
      inp.addEventListener("focus", () => {
        if (matrixSkipFocusReset) {
          matrixSkipFocusReset = false;
          return;
        }
        matrixAnchorIdx = idx;
        matrixEndIdx = idx;
        matrixPaintSelection();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
          const rect = matrixSelectionRect();
          if (!rect) return;
          const lines = [];
          for (let r = rect.r0; r <= rect.r1; r += 1) {
            const cols = [];
            for (let c = rect.c0; c <= rect.c1; c += 1) {
              const found = matrixCells.find((x) => x.r === r && x.c === c);
              cols.push(found ? String(found.inp.value || "") : "");
            }
            lines.push(cols.join("\t"));
          }
          e.preventDefault();
          void navigator.clipboard.writeText(lines.join("\n"));
          return;
        }
        if (e.shiftKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          const from = matrixEndIdx != null ? matrixEndIdx : idx;
          let ni = null;
          if (e.key === "ArrowRight") ni = matrixNavRight(from);
          else if (e.key === "ArrowLeft") ni = matrixNavLeft(from);
          else if (e.key === "ArrowDown") ni = matrixNavDown(from);
          else if (e.key === "ArrowUp") ni = matrixNavUp(from);
          if (ni != null) {
            matrixEndIdx = ni;
            matrixPaintSelection();
            matrixSkipFocusReset = true;
            matrixCells[ni].inp.focus();
            const el = matrixCells[ni].inp;
            if (typeof el.select === "function") el.select();
          }
          return;
        }
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          let ni = null;
          if (e.key === "ArrowRight") ni = matrixNavRight(idx);
          else if (e.key === "ArrowLeft") ni = matrixNavLeft(idx);
          else if (e.key === "ArrowDown") ni = matrixNavDown(idx);
          else if (e.key === "ArrowUp") ni = matrixNavUp(idx);
          if (ni != null) {
            matrixCells[ni].inp.focus();
            matrixAnchorIdx = ni;
            matrixEndIdx = ni;
            matrixPaintSelection();
            const el = matrixCells[ni].inp;
            if (typeof el.select === "function") el.select();
          }
          return;
        }
        if (e.key === "Tab") {
          const next = e.shiftKey ? matrixNavLeft(idx) : matrixNavRight(idx);
          if (next != null) {
            e.preventDefault();
            matrixCells[next].inp.focus();
            matrixAnchorIdx = next;
            matrixEndIdx = next;
            matrixPaintSelection();
            const el = matrixCells[next].inp;
            if (typeof el.select === "function") el.select();
          }
        } else if (e.key === "Enter") {
          const next = e.shiftKey ? matrixNavUp(idx) : matrixNavDown(idx);
          if (next != null) {
            e.preventDefault();
            matrixCells[next].inp.focus();
            matrixAnchorIdx = next;
            matrixEndIdx = next;
            matrixPaintSelection();
            const el = matrixCells[next].inp;
            if (typeof el.select === "function") el.select();
          }
        }
      });
    });

    if (tbl) {
      tbl.addEventListener(
        "paste",
        (e) => {
          const t = e.target;
          if (!(t instanceof HTMLInputElement)) return;
          if (!t.hasAttribute("data-plan-b") || !t.hasAttribute("data-plan-k")) return;
          if (t.disabled) return;
          const clip = e.clipboardData?.getData("text/plain");
          if (!clip || !matrixPasteLooksLikeGrid(clip)) return;
          e.preventDefault();
          e.stopPropagation();
          const grid = parseExcelPastedGrid(clip);
          if (!grid.length) return;
          const r0 = t.getAttribute("data-matrix-r");
          const c0 = t.getAttribute("data-matrix-c");
          let g = matrixPasteTrimTrailingEmptyCols(grid.map((row) => (Array.isArray(row) ? row.slice() : row)));
          const colsOrder = matrixColumnKeys();
          const sc = colsOrder.indexOf(t.getAttribute("data-plan-k") || "");
          if (sc >= 0) g = matrixPasteStripLeadingLabelColumn(g, sc);
          const flat = flattenPasteGridDense(g);
          const changed = flat.length > 0 ? applyDensePasteToMatrix(t, flat) : applyExcelPasteToMatrix(t, g);
          if (changed) scheduleSave();
          fullRender();
          if (r0 != null && c0 != null) {
            queueMicrotask(() => {
              const again = document.querySelector(`#materials-table-matrix input[data-matrix-r="${r0}"][data-matrix-c="${c0}"]:not(:disabled)`);
              again?.focus();
              if (again && typeof again.select === "function") again.select();
            });
          }
        },
        true,
      );
    }
  }

  function renderJoinLengthManager() {
    const wrap = document.getElementById("materials-join-manager-wrap");
    if (!wrap) return;
    ensureJoinLengthSpecs(bundle);
    const specs = Array.isArray(bundle.joinLengthSpecs) ? bundle.joinLengthSpecs : [];
    const rows =
      specs.length > 0
        ? specs
            .map((s) => {
              const tm = s.totalM;
              const s1 = s.seg1M;
              const s2 = s.seg2M;
              return `<tr>
          <th scope="row">${tm}m <span class="materials-join-key-hint">(${escapeHtml(String(s1))}+${escapeHtml(String(s2))})</span></th>
          <td><input type="number" min="1" max="15" step="1" class="save-work-input materials-join-panel-seg" data-join-panel-total="${tm}" data-join-part="1" value="${s1}" title="첫 구간(m)" /></td>
          <td><input type="number" min="1" max="15" step="1" class="save-work-input materials-join-panel-seg" data-join-panel-total="${tm}" data-join-part="2" value="${s2}" title="둘째 구간(m)" /></td>
          <td class="materials-join-panel-del-cell"><button type="button" class="ghost materials-join-panel-del" data-join-panel-remove="${tm}" aria-label="이 이음 규격 삭제" title="삭제">×</button></td>
        </tr>`;
            })
            .join("")
        : `<tr><td colspan="4" class="materials-join-panel-empty">등록된 단본 이음이 없습니다. 아래에서 열을 추가하세요.</td></tr>`;
    wrap.innerHTML = `
      <div class="materials-join-manager" role="region" aria-label="단본 이음 규격 편집">
        <p class="materials-join-manager-desc">16m 이상은 두 구간(m)으로 나누어 길이별 요약·입고 집계에 반영됩니다. 동별 계획 표에는 <strong>총연장 열</strong>만 두고, 구간 조합은 여기서만 수정합니다.</p>
        <div class="materials-join-panel-table-shell">
          <table class="construction-records-table materials-join-panel-table">
            <thead><tr><th scope="col">총연장</th><th scope="col">구간1 (m)</th><th scope="col">구간2 (m)</th><th scope="col" class="materials-join-panel-th-del">삭제</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="materials-join-panel-add">
          <span class="materials-join-add-label">열 추가</span>
          <input type="number" id="materials-join-add-total" class="save-work-input materials-join-add-inp" min="16" max="30" step="1" placeholder="총 m" title="이음 총연장(m)" />
          <input type="number" id="materials-join-add-s1" class="save-work-input materials-join-add-inp" min="1" max="15" step="1" placeholder="구간1" title="첫 구간(m) — 비우면 자동" />
          <button type="button" class="ghost" id="materials-join-add-btn">추가</button>
        </div>
      </div>
    `;
  }

  function wireJoinLengthManager() {
    const wrap = document.getElementById("materials-join-manager-wrap");
    if (wrap) {
      wrap.querySelectorAll(".materials-join-panel-seg").forEach((inp) => {
        inp.addEventListener("change", () => {
          const tm = Number(inp.getAttribute("data-join-panel-total"));
          const part = inp.getAttribute("data-join-part") || "1";
          applyJoinSegEdit(tm, part, inp.value);
          scheduleSave();
          fullRender();
        });
      });
      wrap.querySelectorAll(".materials-join-panel-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tm = Number(btn.getAttribute("data-join-panel-remove"));
          if (!Number.isFinite(tm) || tm < 16) return;
          ensureJoinLengthSpecs(bundle);
          const jk = joinPlanKey(tm);
          bundle.joinLengthSpecs = bundle.joinLengthSpecs.filter((x) => x.totalM !== tm);
          stripJoinPlanKey(jk);
          scheduleSave();
          fullRender();
        });
      });
    }
    document.getElementById("materials-join-add-btn")?.addEventListener("click", () => {
      const ti = document.getElementById("materials-join-add-total");
      const s1i = document.getElementById("materials-join-add-s1");
      if (!ti || !s1i) return;
      const totalM = Math.round(Number(ti.value));
      let seg1M = Math.round(Number(s1i.value));
      if (!Number.isFinite(totalM) || totalM < 16 || totalM > 30) return;
      if (!Number.isFinite(seg1M) || seg1M < 1 || seg1M > LENS_MAX_SINGLE_M) {
        seg1M = Math.min(LENS_MAX_SINGLE_M, Math.max(1, totalM - 10));
      }
      const spec = normalizeJoinSpec({ totalM, seg1M, seg2M: totalM - seg1M });
      if (!spec) return;
      ensureJoinLengthSpecs(bundle);
      if (bundle.joinLengthSpecs.some((x) => x.totalM === spec.totalM)) return;
      bundle.joinLengthSpecs.push(spec);
      bundle.joinLengthSpecs.sort((a, b) => a.totalM - b.totalM);
      ti.value = "";
      s1i.value = "";
      scheduleSave();
      fullRender();
    });
  }

  function renderSummary() {
    const tb = document.getElementById("materials-tbody-summary");
    if (!tb) return;
    const rows = [];
    LENS.forEach((L) => {
      const k = String(L);
      const plan = planTotalLenSplitForSummary(L);
      const recv = sumReceiptQtySplitForSummary(L);
      const used = usedFromPdamLengthSplitForSummary(L);
      const dmg = sumDamageQty(L);
      const stock = recv - used - dmg;
      const unord = Math.max(0, plan - recv);
      rows.push(
        `<tr><td>${L}m</td><td>${plan}</td><td>${recv}</td><td class="materials-used-pdam">${used}</td><td>${dmg}</td><td>${stock}</td><td>${unord}</td></tr>`,
      );
    });
    tb.innerHTML = rows.join("");
  }

  function renderSupplierReceiptAgg() {
    const thead = document.getElementById("materials-thead-by-supplier");
    const tbody = document.getElementById("materials-tbody-by-supplier");
    if (!thead || !tbody) return;
    const rows = aggregateReceiptsBySupplier();
    const lenTh = LENS.map((L) => `<th title="${L}m">${L}</th>`).join("");
    thead.innerHTML = `<tr><th class="materials-srcpt-th-name" scope="col">업체</th>${lenTh}<th class="materials-srcpt-num materials-srcpt-th-total-p" scope="col" title="본수 합계">Σ본</th><th class="materials-srcpt-num materials-srcpt-th-total-m" scope="col" title="본수×길이 합계(m)">총M</th></tr>`;

    const nCol = 1 + LENS.length + 2;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${nCol}">필터 기간에 해당하는 입고 본수가 없습니다.</td></tr>`;
      return;
    }
    const grandQty = {};
    LENS.forEach((L) => {
      grandQty[String(L)] = 0;
    });
    let sumPieces = 0;
    let sumM = 0;
    const bodyRows = rows
      .map((r) => {
        sumPieces += r.totalPieces;
        sumM += r.totalM;
        const lenCells = LENS.map((L) => {
          const k = String(L);
          const v = r.qty[k] || 0;
          grandQty[k] += v;
          return `<td class="materials-srcpt-num">${v}</td>`;
        }).join("");
        return `<tr><th scope="row" class="materials-srcpt-name">${escapeHtml(r.name)}</th>${lenCells}<td class="materials-srcpt-num materials-srcpt-total-p">${r.totalPieces}</td><td class="materials-srcpt-num materials-srcpt-total-m">${r.totalM.toFixed(1)}</td></tr>`;
      })
      .join("");
    const grandLenCells = LENS.map((L) => `<td class="materials-srcpt-num">${grandQty[String(L)]}</td>`).join("");
    const grandRow = `<tr class="materials-total-row"><th scope="row" class="materials-srcpt-name">합계</th>${grandLenCells}<td class="materials-srcpt-num materials-srcpt-total-p">${sumPieces}</td><td class="materials-srcpt-num materials-srcpt-total-m">${sumM.toFixed(1)}</td></tr>`;
    tbody.innerHTML = bodyRows + grandRow;
  }

  function renderDamage(supOpts) {
    const tb = document.getElementById("materials-tbody-damage");
    if (!tb) return;
    tb.innerHTML = (bundle.damageReturns || [])
      .map(
        (d, i) => {
          const supClass = supplierRowToneClass(d.supplierId);
          const lenRaw = d.lengthM;
          const lenDisp =
            lenRaw === "" || lenRaw === null || lenRaw === undefined || (typeof lenRaw === "number" && !Number.isFinite(lenRaw))
              ? ""
              : String(lenRaw);
          return `
      <tr class="materials-damage-row ${supClass}">
        <td>${i + 1}</td>
        <td class="materials-damage-td-date"><input type="date" class="save-work-input materials-date-inp materials-damage-date-inp" data-dmg="${i}" data-f="date" value="${escapeHtml(toDateInputValue(d.date))}" /></td>
        <td class="materials-damage-td-supplier"><select class="save-work-select" data-dmg="${i}" data-f="supplierId">${supOpts}</select></td>
        <td><input type="number" class="save-work-input" data-dmg="${i}" data-f="lengthM" value="${escapeHtml(lenDisp)}" step="1" min="0" placeholder="" /></td>
        <td><input class="save-work-input" data-dmg="${i}" data-f="note" value="${escapeHtml(d.note)}" /></td>
        <td class="materials-damage-td-del"><button type="button" class="ghost materials-damage-del-btn" data-del-dmg="${i}" aria-label="이 행 삭제" title="삭제">×</button></td>
      </tr>`;
        },
      )
      .join("");
    tb.querySelectorAll("select[data-dmg]").forEach((sel) => {
      sel.value = bundle.damageReturns[Number(sel.dataset.dmg)]?.supplierId || "";
      sel.addEventListener("change", () => {
        bundle.damageReturns[Number(sel.dataset.dmg)].supplierId = sel.value;
        scheduleSave();
        fullRender();
      });
    });
    tb.querySelectorAll("input[data-dmg]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.dmg);
        const row = bundle.damageReturns[i];
        if (!row) return;
        const f = inp.dataset.f;
        if (inp.type === "number" && f === "lengthM" && String(inp.value).trim() === "") {
          row.lengthM = "";
        } else if (inp.type === "number") {
          row[f] = Number(inp.value) || 0;
        } else {
          row[f] = inp.value;
        }
        scheduleSave();
        fullRender();
      });
    });
    tb.querySelectorAll("[data-del-dmg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del-dmg"));
        bundle.damageReturns.splice(i, 1);
        scheduleSave();
        fullRender();
      });
    });
  }

  function renderCement() {
    const tb = document.getElementById("materials-tbody-cement");
    if (!tb) return;
    const ledger = bundle.cementLedger || [];
    let run = 0;
    tb.innerHTML = ledger
      .map((c, i) => {
        const v = cementLedgerRowIntakeTf(c);
        run += v;
        const vDisp = Number.isFinite(v) ? v : 0;
        return `
      <tr>
        <td class="materials-cement-td-idx">${i + 1}</td>
        <td><input type="date" class="save-work-input materials-date-inp" data-cem="${i}" data-f="requestDate" value="${escapeHtml(toDateInputValue(c.requestDate))}" /></td>
        <td><input type="date" class="save-work-input materials-date-inp" data-cem="${i}" data-f="arrivalDate" value="${escapeHtml(toDateInputValue(c.arrivalDate))}" /></td>
        <td><input type="number" step="0.001" class="save-work-input" data-cem="${i}" data-f="intakeTf" value="${vDisp}" /></td>
        <td class="materials-cement-td-cum" title="1행부터 이 행까지 입고(tf) 합"><span class="materials-cement-cum-val">${run.toFixed(3)}</span><span class="materials-cement-cum-unit"> tf</span></td>
        <td><input class="save-work-input" data-cem="${i}" data-f="note" value="${escapeHtml(c.note)}" /></td>
        <td class="materials-cement-td-del"><button type="button" class="ghost materials-cement-del-btn" data-del-cem="${i}" aria-label="이 행 삭제" title="삭제">×</button></td>
      </tr>`;
      })
      .join("");
    tb.querySelectorAll("input[data-cem]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.cem);
        const c = bundle.cementLedger[i];
        if (!c) return;
        if (inp.dataset.f === "intakeTf") {
          const n = inp.type === "number" ? Number(inp.value) || 0 : 0;
          c.orderTf = n;
          c.receiptTf = n;
        } else {
          c[inp.dataset.f] = inp.type === "number" ? Number(inp.value) : inp.value;
        }
        scheduleSave();
        fullRender();
      });
    });
    tb.querySelectorAll("[data-del-cem]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del-cem"));
        bundle.cementLedger.splice(i, 1);
        scheduleSave();
        fullRender();
      });
    });
  }

  /** q본을 per본/차로 나눌 때 차수별 실을 본수 문장 */
  function describeTruckTrips(q, per) {
    const parts = [];
    let remaining = q;
    let trip = 1;
    while (remaining > 0) {
      const n = Math.min(per, remaining);
      parts.push(`${trip}차 ${n}본`);
      remaining -= n;
      trip += 1;
    }
    const total = parts.length;
    return `${parts.join(", ")} · 총 ${total}회 상차`;
  }

  function renderTruckHint() {
    const el = document.getElementById("materials-truck-hint");
    if (!el) return;
    const sections = [];
    LENS.forEach((L) => {
      const k = String(L);
      const q = sumReceiptQtySplitForSummary(L);
      const plan = planTotalLenSplitForSummary(L);
      const unord = Math.max(0, plan - q);
      if (!q && !unord) return;
      const per = truckRuleFor(L);
      const rows = [];
      if (q > 0) {
        rows.push(`<tr><th scope="row">기간 입고</th><td><strong>${q}</strong>본</td></tr>`);
        if (!per) {
          rows.push(
            `<tr><th scope="row">적재 기준</th><td class="materials-truck-hint-warn">파일 상차 기준표에 <strong>${L}</strong>m 행이 없습니다.</td></tr>`,
          );
        } else {
          rows.push(`<tr><th scope="row">적재 기준</th><td><strong>${per}</strong>본/차</td></tr>`);
          rows.push(
            `<tr><th scope="row">상차 배차</th><td>${escapeHtml(describeTruckTrips(q, per))}</td></tr>`,
          );
        }
      } else {
        rows.push(`<tr><th scope="row">기간 입고</th><td><strong>0</strong>본</td></tr>`);
      }
      if (unord > 0) {
        rows.push(
          `<tr class="materials-truck-hint-row--unord"><th scope="row">미발주</th><td>계획 <strong>${plan}</strong>본 − 반입 <strong>${q}</strong>본 = <strong>${unord}</strong>본 → 추가 발주·입고 필요</td></tr>`,
        );
      }
      sections.push(
        `<section class="materials-truck-hint-block" aria-labelledby="materials-truck-hint-len-${L}">
          <h4 class="materials-truck-hint-len" id="materials-truck-hint-len-${L}">${L}m</h4>
          <table class="materials-truck-hint-table">
            <tbody>${rows.join("")}</tbody>
          </table>
        </section>`,
      );
    });
    el.innerHTML = sections.length
      ? `<div class="materials-truck-hint-stack">${sections.join("")}</div>`
      : `<p class="materials-truck-hint-empty">(기간 내 해당 길이 입고·미발주 모두 없음)</p>`;
  }

  async function refreshMaterialsDatasetSelect() {
    const sel = document.getElementById("materials-dataset-select");
    const status = document.getElementById("materials-dataset-status");
    const btn = document.getElementById("materials-dataset-apply");
    if (!sel || !btn) return;

    const fn = window.pilexyFetchConstructionDatasetsList;
    if (typeof fn !== "function") {
      sel.innerHTML = '<option value="">시공 모듈을 불러오지 못했습니다</option>';
      sel.disabled = true;
      btn.disabled = true;
      if (status) status.textContent = "";
      return;
    }

    sel.disabled = true;
    btn.disabled = true;
    if (status) status.textContent = "목록 불러오는 중…";
    try {
      const res = await fn();
      if (!res.ok) {
        sel.innerHTML =
          res.code === "need_work"
            ? '<option value="">저장 작업·좌표를 불러온 뒤 선택하세요</option>'
            : '<option value="">목록을 불러올 수 없습니다</option>';
        if (status) {
          status.textContent = res.code === "need_work" ? "도면이 있는 저장 작업이 있어야 합니다." : "";
        }
        return;
      }
      sel.innerHTML = "";
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = res.datasets.length ? "시공 데이터셋 선택" : "불러온 데이터셋 없음";
      sel.appendChild(ph);
      res.datasets.forEach((d) => {
        const o = document.createElement("option");
        o.value = d.id;
        const when = d.createdAt ? new Date(d.createdAt).toLocaleString("ko-KR") : "";
        o.textContent = when ? `${d.name} · ${when}` : d.name;
        sel.appendChild(o);
      });
      if (res.activeId && [...sel.options].some((o) => o.value === res.activeId)) {
        sel.value = res.activeId;
      }
      if (status) {
        status.textContent = res.datasets.length ? "" : "시공현황에서 PDAM 동기화 또는 기록지 엑셀을 올리면 여기에 표시됩니다.";
      }
    } catch (e) {
      console.error(e);
      sel.innerHTML = '<option value="">목록 로드 실패</option>';
      if (status) status.textContent = "네트워크·서버를 확인하세요.";
    } finally {
      sel.disabled = false;
      btn.disabled = !sel.value;
    }
  }

  function wireMaterialsDatasetControls() {
    const sel = document.getElementById("materials-dataset-select");
    const btn = document.getElementById("materials-dataset-apply");
    const refBtn = document.getElementById("materials-dataset-refresh");
    if (!sel || !btn) return;
    sel.addEventListener("change", () => {
      btn.disabled = !sel.value;
    });
    btn.addEventListener("click", async () => {
      const id = sel.value;
      if (!id) return;
      const status = document.getElementById("materials-dataset-status");
      btn.disabled = true;
      sel.disabled = true;
      if (status) status.textContent = "데이터 적용 중…";
      try {
        const applyFn = window.pilexyApplyConstructionDatasetForMaterials;
        if (typeof applyFn !== "function") throw new Error("missing_apply");
        const r = await applyFn(id);
        if (!r.ok) {
          if (status) status.textContent = r.error || "적용에 실패했습니다.";
        } else {
          if (status) status.textContent = "반영되었습니다.";
          markMaterialsServerCacheStale();
          fullRender();
        }
      } catch (err) {
        console.error(err);
        if (status) status.textContent = "적용에 실패했습니다.";
      } finally {
        sel.disabled = false;
        btn.disabled = !sel.value;
      }
    });
    refBtn?.addEventListener("click", () => {
      void refreshMaterialsDatasetSelect();
    });
    void refreshMaterialsDatasetSelect();
  }

  function wireToolbar() {
    const mode = document.getElementById("materials-filter-mode");
    if (mode) {
      mode.value = filterMode;
      mode.addEventListener("change", () => {
        filterMode = mode.value;
        fullRender();
      });
    }
    const mwrap = document.getElementById("materials-filter-month-wrap");
    const mi = document.getElementById("materials-filter-month");
    if (filterMode === "month") mwrap && mwrap.classList.remove("hidden");
    else mwrap && mwrap.classList.add("hidden");
    if (mi) {
      mi.addEventListener("change", () => {
        filterMonth = mi.value;
        fullRender();
      });
    }
    const rwrap = document.getElementById("materials-filter-range-wrap");
    const f0 = document.getElementById("materials-filter-from");
    const f1 = document.getElementById("materials-filter-to");
    if (filterMode === "range") rwrap && rwrap.classList.remove("hidden");
    else rwrap && rwrap.classList.add("hidden");
    if (f0)
      f0.addEventListener("change", () => {
        filterFrom = f0.value;
        fullRender();
      });
    if (f1)
      f1.addEventListener("change", () => {
        filterTo = f1.value;
        fullRender();
      });

    document.getElementById("materials-btn-save")?.addEventListener("click", () => void persistNow());

    document.getElementById("materials-add-supplier")?.addEventListener("click", () => {
      bundle.suppliers.push({ id: rid(), name: "새 업체", contact: "", phone: "", address: "", distanceKm: 0, etaText: "" });
      fullRender();
    });
    document.getElementById("materials-add-receipt")?.addEventListener("click", () => {
      const q = {};
      LENS.forEach((L) => {
        q[String(L)] = 0;
      });
      getJoinLengthRows().forEach((j) => {
        q[j.key] = 0;
      });
      bundle.receipts.push({
        id: rid(),
        requestDate: isoToday(),
        arrivalDate: "",
        supplierId: (bundle.suppliers[0] && bundle.suppliers[0].id) || "",
        amTrucks: 0,
        pmTrucks: 0,
        qtyByLength: q,
        note: "",
      });
      fullRender();
    });
    document.getElementById("materials-copy-last-receipt")?.addEventListener("click", () => {
      const arr = bundle.receipts || [];
      if (!arr.length) return;
      const src = arr[arr.length - 1];
      const q = {};
      LENS.forEach((L) => {
        const k = String(L);
        q[k] = Number(src.qtyByLength && src.qtyByLength[k]) || 0;
      });
      getJoinLengthRows().forEach((j) => {
        q[j.key] = Number(src.qtyByLength && src.qtyByLength[j.key]) || 0;
      });
      arr.push({
        id: rid(),
        requestDate: src.requestDate || isoToday(),
        arrivalDate: src.arrivalDate || "",
        supplierId: src.supplierId || ((bundle.suppliers[0] && bundle.suppliers[0].id) || ""),
        amTrucks: Number(src.amTrucks) || 0,
        pmTrucks: Number(src.pmTrucks) || 0,
        qtyByLength: q,
        note: src.note || "",
      });
      scheduleSave();
      fullRender();
    });
    document.getElementById("materials-add-damage")?.addEventListener("click", () => {
      bundle.damageReturns.push({
        id: rid(),
        date: "",
        supplierId: "",
        lengthM: "",
        note: "",
      });
      scheduleSave();
      fullRender();
    });
    document.getElementById("materials-add-cement")?.addEventListener("click", () => {
      bundle.cementLedger.push({ id: rid(), requestDate: "", arrivalDate: "", orderTf: 0, receiptTf: 0, note: "" });
      fullRender();
    });

    document.querySelectorAll("[data-cement-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-cement-pick");
        if (v !== "detail" && v !== "tonPerMPhi") return;
        if (!bundle.cementPresets) bundle.cementPresets = {};
        bundle.cementPresets.mode = v;
        scheduleSave();
        fullRender();
      });
    });
    document.getElementById("materials-cement-phi")?.addEventListener("change", (e) => {
      bundle.cementPresets.selectedPhi = e.target.value;
      scheduleSave();
      fullRender();
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persistNow(), 900);
  }

  async function persistNow() {
    const hint = document.getElementById("materials-save-hint");
    const base = apiBase();
    if (!base) {
      if (hint) hint.textContent = "API 주소 없음 — 저장 생략";
      return;
    }
    try {
      const pc = encodeURIComponent(projectContext());
      const res = await fetch(`${base}/api/materials/state?project_context=${pc}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      bundle = data;
      lastMaterialsPc = projectContext();
      if (hint) hint.textContent = "저장됨";
    } catch (err) {
      console.error(err);
      if (hint) hint.textContent = "저장 실패";
    }
  }

  async function loadBundle() {
    const base = apiBase();
    const hint = document.getElementById("materials-save-hint");
    if (!base) {
      bundle = window.__pilexyMaterialsFallbackBundle || null;
      if (bundle) ensureJoinLengthSpecs(bundle);
      if (!bundle) {
        if (hint) hint.textContent = "API 없음 — 로컬만(새로고침 시 초기화)";
        bundle = {
          suppliers: [],
          truckLoadRules: LENS.map((L) => ({ lengthM: L, piecesPerTruck: 6, note: "" })),
          cementPresets: { mode: "tonPerMPhi", tonPerMByPhi: {}, selectedPhi: "D600", detail: {} },
          planByBuilding: {},
          receipts: [],
          cementLedger: [],
          damageReturns: [],
          manualUsedByLength: {},
          joinLengthSpecs: defaultJoinLengthSpecsFromLegacy(),
          meta: {},
        };
      }
      return;
    }
    try {
      const pc = encodeURIComponent(projectContext());
      const res = await fetch(`${base}/api/materials/state?project_context=${pc}`);
      if (!res.ok) throw new Error(await res.text());
      bundle = await res.json();
      ensureJoinLengthSpecs(bundle);
      if (bundle.cementPresets && bundle.cementPresets.mode !== "detail" && bundle.cementPresets.mode !== "tonPerMPhi") {
        bundle.cementPresets.mode = "tonPerMPhi";
      }
      (bundle.suppliers || []).forEach((s) => {
        if (!s.id) s.id = rid();
      });
      (bundle.receipts || []).forEach((r) => {
        if (!r.id) r.id = rid();
        if (!r.qtyByLength) {
          r.qtyByLength = {};
          LENS.forEach((L) => {
            r.qtyByLength[String(L)] = 0;
          });
        }
      });
      (bundle.damageReturns || []).forEach((d) => {
        if (!d.id) d.id = rid();
      });
      (bundle.cementLedger || []).forEach((c) => {
        if (!c.id) c.id = rid();
      });
      if (hint) hint.textContent = bundle.meta && bundle.meta.saved ? "서버에서 불러옴" : "새 프로젝트 번들";
    } catch (err) {
      console.error(err);
      if (hint) hint.textContent = "불러오기 실패";
      bundle = {
        suppliers: [],
        truckLoadRules: [],
        cementPresets: {},
        planByBuilding: {},
        receipts: [],
        cementLedger: [],
        damageReturns: [],
        manualUsedByLength: {},
        joinLengthSpecs: defaultJoinLengthSpecsFromLegacy(),
        meta: {},
      };
    }
  }

  async function init() {
    const mount = document.getElementById("materials-app-mount");
    if (!mount) return;
    ensureProjectNameResyncForMaterials();
    ensureWorkContextMaterialsHook();
    const pc = projectContext();
    if (lastMaterialsPc !== pc || bundle == null) {
      await loadBundle();
    }
    lastMaterialsPc = pc;
    // 1차: 번들만으로 UI를 먼저 그림. PDAM 대시보드(원 매칭·길이별 사용)는 네트워크+서버 집계가 길어 백그라운드에서 채운 뒤 2차 fullRender.
    try {
      fullRender();
    } catch (err) {
      console.error(err);
      mount.innerHTML =
        '<div class="materials-shell"><p class="materials-open-error" role="alert">자재 화면을 그리는 중 오류가 났습니다. 개발자 도구 콘솔을 확인하세요.</p></div>';
    }
    mounted = true;
    if (typeof window.pilexyEnsureConstructionDashboardForMaterials === "function") {
      void (async () => {
        try {
          await window.pilexyEnsureConstructionDashboardForMaterials();
          requestAnimationFrame(() => {
            try {
              fullRender();
            } catch (e) {
              console.error(e);
            }
          });
        } catch (err) {
          console.error(err);
        }
      })();
    }
  }

  window.pilexyMaterialsInit = init;
  window.pilexyMaterialsMarkServerCacheStale = markMaterialsServerCacheStale;
  window.pilexyMaterialsRefreshIfOpen = async function pilexyMaterialsRefreshIfOpen() {
    const mount = document.getElementById("materials-app-mount");
    if (!mount) return;
    const pc = projectContext();
    if (lastMaterialsPc !== pc || bundle == null) {
      await loadBundle();
    }
    lastMaterialsPc = pc;
    if (!bundle) return;
    fullRender();
  };
})();
