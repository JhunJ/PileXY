/**
 * Meissa 비교 패널용 경량 3D 미리보기 (Three.js CDN).
 * 위쪽 iframe의 Meissa 공식 3D와 별도로, 여기서는 비교 계산된 도면 원 좌표 + 수치를 색 점으로 표시합니다.
 */

let T = null;
let OrbitControls = null;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let rootEl = null;
let rafId = 0;
let pointsObj = null;
let basePointsObj = null;
let imagePlaneObj = null;
let gridHelper = null;
let resizeObserver = null;
let fallbackCanvas = null;
let fallbackCtx = null;
let useFallback2d = false;
let fallbackZoom = 1;
let fallbackPanX = 0;
let fallbackPanY = 0;
let fallbackDragging = false;
let fallbackDragX = 0;
let fallbackDragY = 0;
let fallbackRotX = -0.45;
let fallbackRotY = 0.65;
let fallbackDragMode = "rotate";
let fallbackPayload = null;
let fallbackHandlers = null;

function disposePoints() {
  if (!scene || !pointsObj) return;
  scene.remove(pointsObj);
  pointsObj.geometry.dispose();
  pointsObj.material.dispose();
  pointsObj = null;
}

function disposeBasePoints() {
  if (!scene || !basePointsObj) return;
  scene.remove(basePointsObj);
  basePointsObj.geometry.dispose();
  basePointsObj.material.dispose();
  basePointsObj = null;
}

function disposeImagePlane() {
  if (!scene || !imagePlaneObj) return;
  scene.remove(imagePlaneObj);
  if (imagePlaneObj.geometry) imagePlaneObj.geometry.dispose();
  const mat = imagePlaneObj.material;
  if (mat) {
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    } else {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  }
  imagePlaneObj = null;
}

function lerpRgb(t, c0, c1) {
  return {
    r: c0.r + (c1.r - c0.r) * t,
    g: c0.g + (c1.g - c0.g) * t,
    b: c0.b + (c1.b - c0.b) * t,
  };
}

function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  const green = { r: 0.13, g: 0.73, b: 0.33 };
  const yellow = { r: 0.92, g: 0.7, b: 0.03 };
  const red = { r: 0.94, g: 0.27, b: 0.27 };
  const c = t < 0.5 ? lerpRgb(t * 2, green, yellow) : lerpRgb((t - 0.5) * 2, yellow, red);
  return [c.r, c.g, c.b];
}

function mixRgb01(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** PDAM 잔량 구간(고정 m): &lt;0.5 · 0.5~1 · 1~2 · ≥2 */
const REMAINING_BAND_RGB = [
  [0.18, 0.55, 0.35],
  [0.52, 0.65, 0.22],
  [0.85, 0.48, 0.12],
  [0.9, 0.22, 0.2],
];

function remainingBandIndex(v) {
  if (!Number.isFinite(v)) return -1;
  if (v < 0.5) return 0;
  if (v < 1) return 1;
  if (v < 2) return 2;
  return 3;
}

function rgbForRemainingBands(v, installed) {
  const idx = remainingBandIndex(v);
  const gray = [0.52, 0.54, 0.57];
  if (idx < 0) {
    if (installed) return [0.06, 0.82, 0.36];
    return gray;
  }
  let rgb = [...REMAINING_BAND_RGB[idx]];
  if (installed) {
    const acc = [0.08, 0.84, 0.38];
    rgb = mixRgb01(rgb, acc, 0.38);
  }
  return rgb;
}

function recordPassesRemainingMinFilter(r, colorMode, minF) {
  if (colorMode === "mz_zone" || colorMode === "ortho_pdam" || colorMode === "plan_dev") return true;
  if (colorMode !== "remaining" || minF == null || !Number.isFinite(minF)) return true;
  const v = r.pileRemaining != null ? Number(r.pileRemaining) : NaN;
  return Number.isFinite(v) && v >= minF;
}

function resolvePlanDevThresholds(okRaw, badRaw) {
  let okM = Number(okRaw);
  let badM = Number(badRaw);
  if (!Number.isFinite(okM) || okM < 0) okM = 0.15;
  if (!Number.isFinite(badM) || badM < 0) badM = 0.35;
  if (badM <= okM) badM = okM + 0.05;
  return { okM, badM };
}

/** @param {Record<string, unknown>} r */
function rgbForPlanDevRecord(r, okM, badM) {
  const gray = [0.55, 0.54, 0.56];
  if (r?.pdamStatus !== "installed") return gray;
  const d = r.planD != null ? Math.abs(Number(r.planD)) : NaN;
  if (!Number.isFinite(d)) return gray;
  if (d <= okM) return [0.12, 0.72, 0.38];
  if (d < badM) return [0.88, 0.62, 0.08];
  return [0.9, 0.22, 0.22];
}

function rgbForMzZoneRecord(r, mzLo, mzHi) {
  const gray = [0.55, 0.54, 0.56];
  if (r?.pdamStatus !== "installed") return gray;
  const v = r.meissaZoneResidual != null ? Number(r.meissaZoneResidual) : NaN;
  if (!Number.isFinite(v)) return gray;
  return heatColor(norm(v, mzLo, mzHi));
}

function remainingLegendLineBase() {
  return "잔량 구간: <0.5 녹 · 0.5~1 황록 · 1~2 주황 · ≥2 적색";
}

function remainingLegendLine(minF) {
  let s = remainingLegendLineBase();
  if (minF != null && Number.isFinite(minF)) s += ` · 표시: 잔량≥${minF}만`;
  return s;
}

/** @param {Record<string, unknown>} r */
function rgbForPdamRecord(r) {
  if (r?.pdamStatus === "installed") return [0.05, 0.86, 0.39];
  if (r?.pdamStatus === "pending") return [0.55, 0.55, 0.58];
  return [0.55, 0.55, 0.58];
}

function extent(nums) {
  const vals = nums.filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  if (!vals.length) return [0, 1];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  return [lo, hi];
}

function norm(v, lo, hi) {
  if (!Number.isFinite(v)) return 0.5;
  if (hi <= lo) return 0.5;
  return (v - lo) / (hi - lo);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function quantile(sortedNums, q) {
  if (!sortedNums.length) return 0;
  const n = sortedNums.length;
  const pos = clamp(q, 0, 1) * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedNums[lo];
  const t = pos - lo;
  return sortedNums[lo] * (1 - t) + sortedNums[hi] * t;
}

function trimOutlierBasePointsWithIndices(points) {
  const entries = [];
  for (let i = 0; i < (points || []).length; i++) {
    const p = points[i];
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    const z = Number(p?.[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    entries.push({ idx: i, p: [x, y, z] });
  }
  if (entries.length < 200) return entries;
  const xs = entries.map((e) => e.p[0]).sort((a, b) => a - b);
  const ys = entries.map((e) => e.p[1]).sort((a, b) => a - b);
  const zs = entries.map((e) => e.p[2]).sort((a, b) => a - b);
  const xLo = quantile(xs, 0.01);
  const xHi = quantile(xs, 0.99);
  const yLo = quantile(ys, 0.01);
  const yHi = quantile(ys, 0.99);
  const zLo = quantile(zs, 0.01);
  const zHi = quantile(zs, 0.99);
  const trimmed = entries.filter((e) => {
    const p = e.p;
    return p[0] >= xLo && p[0] <= xHi && p[1] >= yLo && p[1] <= yHi && p[2] >= zLo && p[2] <= zHi;
  });
  return trimmed.length >= Math.floor(entries.length * 0.6) ? trimmed : entries;
}

function redrawFallbackFromState() {
  if (!fallbackPayload) return;
  drawFallback2d(
    fallbackPayload.records,
    fallbackPayload.basePoints,
    fallbackPayload.basePointColors,
    fallbackPayload.colorMode,
    fallbackPayload.legendEl,
    fallbackPayload.baseResourceCount,
    fallbackPayload.viewMode,
    fallbackPayload.overlay2dMode,
    fallbackPayload.remainingMinFilter,
    fallbackPayload.planDevOkM,
    fallbackPayload.planDevBadM
  );
}

function bindFallbackInteractions() {
  if (!fallbackCanvas || fallbackHandlers) return;
  const getLocal = (evt) => {
    const rect = fallbackCanvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  };
  const onWheel = (evt) => {
    evt.preventDefault();
    const { x, y } = getLocal(evt);
    const prev = fallbackZoom;
    const next = clamp(prev * Math.exp(-evt.deltaY * 0.0012), 0.2, 30);
    if (Math.abs(next - prev) < 1e-6) return;
    const k = next / prev;
    fallbackPanX = x - (x - fallbackPanX) * k;
    fallbackPanY = y - (y - fallbackPanY) * k;
    fallbackZoom = next;
    redrawFallbackFromState();
  };
  const onDown = (evt) => {
    evt.preventDefault();
    fallbackDragging = true;
    fallbackDragX = evt.clientX;
    fallbackDragY = evt.clientY;
    const overlay2dMode = Boolean(fallbackPayload?.overlay2dMode);
    if (overlay2dMode) {
      // 2D 오버레이에서는 회전을 금지하고 이동(팬)만 허용.
      fallbackDragMode = "pan";
    } else {
      fallbackDragMode = evt.shiftKey || evt.button === 1 ? "pan" : "rotate";
    }
  };
  const onMove = (evt) => {
    if (!fallbackDragging) return;
    const dx = evt.clientX - fallbackDragX;
    const dy = evt.clientY - fallbackDragY;
    fallbackDragX = evt.clientX;
    fallbackDragY = evt.clientY;
    if (fallbackDragMode === "pan") {
      fallbackPanX += dx;
      fallbackPanY += dy;
    } else {
      fallbackRotY += dx * 0.008;
      fallbackRotX = clamp(fallbackRotX + dy * 0.006, -1.45, 1.45);
    }
    redrawFallbackFromState();
  };
  const onUp = () => {
    fallbackDragging = false;
  };
  const onDbl = () => {
    fallbackZoom = 1;
    fallbackPanX = 0;
    fallbackPanY = 0;
    fallbackRotX = -0.45;
    fallbackRotY = 0.65;
    redrawFallbackFromState();
  };
  const onCtx = (evt) => evt.preventDefault();
  fallbackHandlers = { onWheel, onDown, onMove, onUp, onDbl };
  fallbackCanvas.addEventListener("wheel", onWheel, { passive: false });
  fallbackCanvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  fallbackCanvas.addEventListener("dblclick", onDbl);
  fallbackCanvas.addEventListener("contextmenu", onCtx);
  fallbackHandlers.onCtx = onCtx;
}

function unbindFallbackInteractions() {
  if (!fallbackCanvas || !fallbackHandlers) return;
  fallbackCanvas.removeEventListener("wheel", fallbackHandlers.onWheel);
  fallbackCanvas.removeEventListener("mousedown", fallbackHandlers.onDown);
  window.removeEventListener("mousemove", fallbackHandlers.onMove);
  window.removeEventListener("mouseup", fallbackHandlers.onUp);
  fallbackCanvas.removeEventListener("dblclick", fallbackHandlers.onDbl);
  fallbackCanvas.removeEventListener("contextmenu", fallbackHandlers.onCtx);
  fallbackHandlers = null;
}

function animate() {
  if (useFallback2d) return;
  rafId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function onResize() {
  if (!rootEl) return;
  if (useFallback2d && fallbackCanvas) {
    const w = Math.max(1, rootEl.clientWidth);
    const h = Math.max(200, rootEl.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fallbackCanvas.width = Math.round(w * dpr);
    fallbackCanvas.height = Math.round(h * dpr);
    fallbackCanvas.style.width = `${w}px`;
    fallbackCanvas.style.height = `${h}px`;
    if (fallbackCtx) fallbackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawFallbackFromState();
    return;
  }
  if (!renderer || !camera) return;
  const w = Math.max(1, rootEl.clientWidth);
  const h = Math.max(200, rootEl.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/**
 * @param {string} rootSelector
 */
export async function ensureInit(rootSelector) {
  if (renderer || fallbackCanvas) return;
  rootEl = document.querySelector(rootSelector);
  if (!rootEl) return;
  try {
    T = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
    ({ OrbitControls } = await import(
      "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"
    ));
  } catch (e) {
    // 사내망/방화벽 등으로 CDN이 막힌 환경을 위해 2D 폴백 렌더 제공.
    useFallback2d = true;
    fallbackZoom = 1;
    fallbackPanX = 0;
    fallbackPanY = 0;
    fallbackRotX = -0.45;
    fallbackRotY = 0.65;
    fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.setAttribute("aria-label", "Meissa 비교 2D 폴백 캔버스");
    fallbackCtx = fallbackCanvas.getContext("2d");
    rootEl.innerHTML = "";
    rootEl.appendChild(fallbackCanvas);
    bindFallbackInteractions();
    resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(rootEl);
    onResize();
    return;
  }

  scene = new T.Scene();
  scene.background = new T.Color(0x0f172a);

  camera = new T.PerspectiveCamera(50, 1, 0.05, 1e7);
  renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rootEl.innerHTML = "";
  rootEl.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  gridHelper = new T.GridHelper(120, 24, 0x475569, 0x1e293b);
  scene.add(gridHelper);

  resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(rootEl);
  onResize();
  animate();
}

function drawFallback2d(
  records,
  basePoints,
  basePointColors,
  colorMode,
  legendEl,
  baseResourceCount,
  viewMode,
  overlay2dMode,
  remainingMinFilter,
  planDevOkM,
  planDevBadM
) {
  if (!rootEl || !fallbackCanvas || !fallbackCtx) return;
  const minRem =
    remainingMinFilter != null && Number.isFinite(Number(remainingMinFilter)) ? Number(remainingMinFilter) : null;
  const { okM: planOkM, badM: planBadM } = resolvePlanDevThresholds(planDevOkM, planDevBadM);
  fallbackPayload = {
    records,
    basePoints,
    basePointColors,
    colorMode,
    legendEl,
    baseResourceCount,
    viewMode,
    overlay2dMode: Boolean(overlay2dMode),
    remainingMinFilter: minRem,
    planDevOkM,
    planDevBadM,
  };
  const w = Math.max(1, rootEl.clientWidth);
  const h = Math.max(200, rootEl.clientHeight);
  const ctx = fallbackCtx;
  ctx.clearRect(0, 0, w, h);
  if (!overlay2dMode) {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
  }

  const list = viewMode === "meissa" ? [] : Array.isArray(records) ? records : [];
  const useBase = viewMode !== "compare";
  const activeBaseEntries = useBase ? trimOutlierBasePointsWithIndices(basePoints || []) : [];
  const activeBasePoints = activeBaseEntries.map((e) => e.p);
  const rawAll = [];
  for (let i = 0; i < activeBasePoints.length; i++) {
    const p = activeBasePoints[i];
    const c = Array.isArray(basePointColors?.[activeBaseEntries[i].idx]) ? basePointColors[activeBaseEntries[i].idx] : null;
    const x = Number(p?.[0]);
    const y = Number(p?.[2]);
    const z = Number(p?.[1]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) rawAll.push({ x, y, z, kind: "base", c });
  }

  const planVals = list.map((r) => (r.planD != null ? Number(r.planD) : NaN));
  const zdVals = list.map((r) => (r.zDelta != null ? Number(r.zDelta) : NaN));
  const remVals = list.map((r) => (r.pileRemaining != null ? Number(r.pileRemaining) : NaN));
  const [pLo, pHi] = extent(planVals);
  const [zLo, zHi] = extent(zdVals);
  const [rLo, rHi] = extent(remVals);
  const mzVals = list.map((r) => (r.meissaZoneResidual != null ? Number(r.meissaZoneResidual) : NaN));
  const [mzLo, mzHi] = extent(mzVals);

  if (overlay2dMode) {
    const planAll = [];
    for (let i = 0; i < activeBasePoints.length; i++) {
      const p = activeBasePoints[i];
      const c = Array.isArray(basePointColors?.[activeBaseEntries[i].idx]) ? basePointColors[activeBaseEntries[i].idx] : null;
      const mx = Number(p?.[0]);
      const my = Number(p?.[1]);
      if (Number.isFinite(mx) && Number.isFinite(my)) planAll.push({ mx, my, kind: "base", c });
    }
    for (const r of list) {
      const mx = Number(r.x);
      const my = Number(r.y);
      if (!Number.isFinite(mx) || !Number.isFinite(my)) continue;
      if (!recordPassesRemainingMinFilter(r, colorMode, minRem)) continue;
      let rgb;
      let radScale = 1;
      if (colorMode === "matched") {
        rgb = r.hasCircle ? [0.2, 0.65, 0.95] : [0.55, 0.55, 0.58];
      } else if (colorMode === "mz_zone") {
        rgb = rgbForMzZoneRecord(r, mzLo, mzHi);
        if (r?.pdamStatus === "installed" && Number.isFinite(Number(r.meissaZoneResidual))) radScale = 1.14;
      } else if (colorMode === "pdam") {
        rgb = rgbForPdamRecord(r);
        if (r?.pdamStatus === "installed") radScale = 1.18;
      } else if (colorMode === "zdelta") {
        const v = r.zDelta != null ? Number(r.zDelta) : NaN;
        rgb = heatColor(Number.isFinite(v) ? norm(v, zLo, zHi) : 0.5);
      } else if (colorMode === "remaining") {
        rgb = rgbForRemainingBands(
          r.pileRemaining != null ? Number(r.pileRemaining) : NaN,
          r?.pdamStatus === "installed"
        );
        if (r?.pdamStatus === "installed") radScale = 1.22;
      } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
        rgb = rgbForPlanDevRecord(r, planOkM, planBadM);
        if (r?.pdamStatus === "installed" && r?.planD != null && Number.isFinite(Number(r.planD))) radScale = 1.18;
      } else {
        const v = r.planD != null ? Number(r.planD) : NaN;
        rgb = heatColor(Number.isFinite(v) ? norm(v, pLo, pHi) : 0.5);
      }
      planAll.push({ mx, my, kind: "cmp", rgb, radScale });
    }
    if (!planAll.length) {
      if (legendEl) legendEl.textContent = "표시할 점이 없습니다.";
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of planAll) {
      minX = Math.min(minX, p.mx);
      maxX = Math.max(maxX, p.mx);
      minY = Math.min(minY, p.my);
      maxY = Math.max(maxY, p.my);
    }
    const pad = 14;
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const sBase = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const s = Math.max(1e-9, sBase * fallbackZoom);
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    for (const p of planAll) {
      p.sx = w * 0.5 + (p.mx - cx) * s + fallbackPanX;
      p.sy = h * 0.5 - (p.my - cy) * s + fallbackPanY;
    }
    for (const p of planAll) {
      if (p.kind !== "base") continue;
      const c = p.c;
      if (Array.isArray(c) && c.length >= 3) {
        const rr = Math.round(clamp(Number(c[0]), 0, 1) * 255);
        const gg = Math.round(clamp(Number(c[1]), 0, 1) * 255);
        const bb = Math.round(clamp(Number(c[2]), 0, 1) * 255);
        ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, 0.88)`;
      } else {
        ctx.fillStyle = "rgba(130, 246, 255, 0.82)";
      }
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of planAll) {
      if (p.kind !== "cmp") continue;
      const [r, g, b] = p.rgb || [0.9, 0.4, 0.3];
      ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.95)`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(2.1, 2.8 * (p.radScale || 1)), 0, Math.PI * 2);
      ctx.fill();
    }
    if (legendEl) {
      const baseLine = activeBasePoints.length
        ? ` · Meissa 원본 ${baseResourceCount}리소스 / ${activeBasePoints.length}점`
        : "";
      if (colorMode === "matched") {
        legendEl.textContent = "파랑: 도면 원 매칭됨 · 회색: 미매칭";
      } else if (colorMode === "mz_zone") {
        legendEl.textContent = `Meissa Z vs 동일 구역 기준 |ΔZ| ${mzLo.toFixed(3)}~${mzHi.toFixed(3)} m · 녹=유사 적=이탈 · 회색=미시공/Z없음`;
      } else if (colorMode === "pdam") {
        legendEl.textContent = "선명한 녹색: PDAM 시공 · 회색: 미시공";
      } else if (colorMode === "zdelta") {
        legendEl.textContent = `Z−지형 ${zLo.toFixed(3)} ~ ${zHi.toFixed(3)} m (녹→적)`;
      } else if (colorMode === "remaining") {
        legendEl.textContent = remainingLegendLine(minRem);
      } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
        legendEl.textContent = `평면·정사 통합: 폴백 캔버스는 평면 |d| ≤${planOkM}m 녹 · ${planOkM}~${planBadM}m 황 · ≥${planBadM}m 적 — RGB 등급·오프셋 표는 2D 정사 패널`;
      } else {
        legendEl.textContent = `평면 편차 ${pLo.toFixed(3)} ~ ${pHi.toFixed(3)} m (녹→적)`;
      }
      legendEl.textContent += `${baseLine} · Canvas 2D 평면(드래그 이동, 휠 확대)`;
    }
    return;
  }

  for (const r of list) {
    const x = Number(r.x);
    const zMap = Number(r.y);
    const zCsv = r.z != null && Number.isFinite(Number(r.z)) ? Number(r.z) : null;
    const tZ = r.terrainZ != null && Number.isFinite(Number(r.terrainZ)) ? Number(r.terrainZ) : null;
    const yUp = zCsv != null ? zCsv : tZ != null ? tZ : 0;
    if (!Number.isFinite(x) || !Number.isFinite(yUp) || !Number.isFinite(zMap)) continue;
    if (!recordPassesRemainingMinFilter(r, colorMode, minRem)) continue;
    let rgb;
    let radScale = 1;
    if (colorMode === "matched") {
      rgb = r.hasCircle ? [0.2, 0.65, 0.95] : [0.55, 0.55, 0.58];
    } else if (colorMode === "mz_zone") {
      rgb = rgbForMzZoneRecord(r, mzLo, mzHi);
      if (r?.pdamStatus === "installed" && Number.isFinite(Number(r.meissaZoneResidual))) radScale = 1.14;
    } else if (colorMode === "pdam") {
      rgb = rgbForPdamRecord(r);
      if (r?.pdamStatus === "installed") radScale = 1.18;
    } else if (colorMode === "zdelta") {
      const v = r.zDelta != null ? Number(r.zDelta) : NaN;
      rgb = heatColor(Number.isFinite(v) ? norm(v, zLo, zHi) : 0.5);
    } else if (colorMode === "remaining") {
      rgb = rgbForRemainingBands(
        r.pileRemaining != null ? Number(r.pileRemaining) : NaN,
        r?.pdamStatus === "installed"
      );
      if (r?.pdamStatus === "installed") radScale = 1.2;
    } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
      rgb = rgbForPlanDevRecord(r, planOkM, planBadM);
      if (r?.pdamStatus === "installed" && r?.planD != null && Number.isFinite(Number(r.planD))) radScale = 1.16;
    } else {
      const v = r.planD != null ? Number(r.planD) : NaN;
      rgb = heatColor(Number.isFinite(v) ? norm(v, pLo, pHi) : 0.5);
    }
    rawAll.push({ x, y: yUp, z: zMap, kind: "cmp", rgb, radScale });
  }

  if (!rawAll.length) {
    if (legendEl) legendEl.textContent = "표시할 점이 없습니다.";
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of rawAll) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ)
  ) {
    if (legendEl) legendEl.textContent = "유효 좌표가 없습니다.";
    return;
  }

  const pad = 18;
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const spanZ = Math.max(1e-6, maxZ - minZ);
  const spanMax = Math.max(spanX, spanY, spanZ);
  const s = Math.max(1e-9, ((Math.min(w, h) - pad * 2) / spanMax) * fallbackZoom);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const sinX = Math.sin(fallbackRotX);
  const cosX = Math.cos(fallbackRotX);
  const sinY = Math.sin(fallbackRotY);
  const cosY = Math.cos(fallbackRotY);
  const focal = 500;
  const cameraDist = Math.max(spanMax * 2.2, 200);

  const projected = rawAll
    .map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dz = p.z - cz;
      const x1 = dx * cosY + dz * sinY;
      const z1 = -dx * sinY + dz * cosY;
      const y2 = dy * cosX - z1 * sinX;
      const z2 = dy * sinX + z1 * cosX;
      const depth = z2 + cameraDist;
      const persp = focal / Math.max(20, depth);
      return {
        ...p,
        sx: w * 0.5 + x1 * s * persp + fallbackPanX,
        sy: h * 0.5 - y2 * s * persp + fallbackPanY,
        depth,
        persp,
      };
    })
    .sort((a, b) => a.depth - b.depth);

  ctx.strokeStyle = "rgba(71,85,105,0.25)";
  ctx.lineWidth = 1;
  const grid = 8;
  for (let i = 1; i < grid; i++) {
    const gx = (w * i) / grid;
    const gy = (h * i) / grid;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  for (const p of projected) {
    if (p.kind !== "base") continue;
    const x = p.sx;
    const y = p.sy;
    const c = p.c;
    if (Array.isArray(c) && c.length >= 3) {
      const rr = Math.round(clamp(Number(c[0]), 0, 1) * 255);
      const gg = Math.round(clamp(Number(c[1]), 0, 1) * 255);
      const bb = Math.round(clamp(Number(c[2]), 0, 1) * 255);
      ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, 0.92)`;
    } else {
      ctx.fillStyle = "rgba(130, 246, 255, 0.86)";
    }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.8, 2.2 * p.persp), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of projected) {
    if (p.kind !== "cmp") continue;
    const x = p.sx;
    const y = p.sy;
    const [r, g, b] = p.rgb || [0.9, 0.4, 0.3];
    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.2, 3.2 * p.persp * (p.radScale || 1)), 0, Math.PI * 2);
    ctx.fill();
  }

  if (legendEl) {
    const baseLine = activeBasePoints.length
      ? ` · Meissa 원본 ${baseResourceCount}리소스 / ${activeBasePoints.length}점`
      : "";
    if (viewMode === "meissa") {
      legendEl.textContent = "Meissa 원본 3D 기준 점군";
    } else if (colorMode === "matched") {
      legendEl.textContent = "파랑: 도면 원 매칭됨 · 회색: 미매칭";
    } else if (colorMode === "mz_zone") {
      legendEl.textContent = `Meissa Z vs 구역 기준 |ΔZ| ${mzLo.toFixed(3)}~${mzHi.toFixed(3)} m · 녹=유사 적=이탈 · 회색=미시공 · 3D 높이=Meissa Z(없으면 도면 Z→지형추정)`;
    } else if (colorMode === "pdam") {
      legendEl.textContent = "선명한 녹색: PDAM 시공 · 회색: 미시공";
    } else if (colorMode === "zdelta") {
      legendEl.textContent = `Z−지형 ${zLo.toFixed(3)} ~ ${zHi.toFixed(3)} m (녹→적)`;
    } else if (colorMode === "remaining") {
      legendEl.textContent = remainingLegendLine(minRem);
    } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
      legendEl.textContent = `평면·정사 통합: 폴백 캔버스는 평면 |d| ≤${planOkM}m 녹 · ${planOkM}~${planBadM}m 황 · ≥${planBadM}m 적 — RGB 등급·오프셋 표는 2D 정사 패널`;
    } else {
      legendEl.textContent = `평면 편차 ${pLo.toFixed(3)} ~ ${pHi.toFixed(3)} m (녹→적)`;
    }
    legendEl.textContent += `${baseLine} · Canvas 3D 폴백(드래그 회전, Shift+드래그 이동, 휠 확대)`;
  }
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @param {{ colorMode?: string, viewMode?: "overlay"|"meissa"|"compare", overlay2dMode?: boolean, legendEl?: HTMLElement|null, basePoints?: Array<[number, number, number]>, basePointColors?: Array<[number,number,number]>, baseResourceCount?: number, obliqueImageMode?: boolean, overlayImageUrl?: string|null, planDevOkM?: number, planDevBadM?: number }} [options]
 */
export function updateRecords(records, options) {
  const colorMode = options?.colorMode || "remaining";
  const viewMode = options?.viewMode || "overlay";
  const overlay2dMode = Boolean(options?.overlay2dMode);
  const obliqueImageMode = Boolean(options?.obliqueImageMode);
  const overlayImageUrl = typeof options?.overlayImageUrl === "string" ? options.overlayImageUrl.trim() : "";
  const legendEl = options?.legendEl || null;
  const basePointsRaw = Array.isArray(options?.basePoints) ? options.basePoints : [];
  const basePointColorsRaw = Array.isArray(options?.basePointColors) ? options.basePointColors : [];
  const baseEntries = overlay2dMode
    ? (basePointsRaw || [])
        .map((p, idx) => ({ idx, p }))
        .filter((e) => Number.isFinite(Number(e?.p?.[0])) && Number.isFinite(Number(e?.p?.[1])) && Number.isFinite(Number(e?.p?.[2])))
    : trimOutlierBasePointsWithIndices(basePointsRaw);
  const basePoints = baseEntries.map((e) => e.p);
  const basePointColors = baseEntries.map((e) => (Array.isArray(basePointColorsRaw[e.idx]) ? basePointColorsRaw[e.idx] : null));
  const baseResourceCount = Number(options?.baseResourceCount) || 0;
  const remainingMinFilter =
    options?.remainingMinFilter != null && Number.isFinite(Number(options.remainingMinFilter))
      ? Number(options.remainingMinFilter)
      : null;
  const { okM: planOkM3d, badM: planBadM3d } = resolvePlanDevThresholds(options?.planDevOkM, options?.planDevBadM);
  if (useFallback2d) {
    drawFallback2d(
      records,
      basePoints,
      basePointColors,
      colorMode,
      legendEl,
      baseResourceCount,
      viewMode,
      overlay2dMode,
      remainingMinFilter,
      options?.planDevOkM,
      options?.planDevBadM
    );
    return;
  }
  if (!T || !scene || !camera || !renderer || !rootEl) {
    if (legendEl) legendEl.textContent = "3D 뷰 초기화 중…";
    return;
  }

  disposePoints();
  disposeBasePoints();
  disposeImagePlane();
  scene.background = overlay2dMode ? null : new T.Color(0x0f172a);
  renderer.setClearAlpha(overlay2dMode ? 0 : 1);

  const list = viewMode === "meissa" ? [] : Array.isArray(records) ? records : [];
  const activeBasePoints = viewMode === "compare" ? [] : basePoints;
  if (!list.length && !activeBasePoints.length) {
    if (legendEl) legendEl.textContent = "표시할 점이 없습니다.";
    return;
  }

  const pos = [];
  const col = [];

  const planVals = list.map((r) => (r.planD != null ? Number(r.planD) : NaN));
  const zdVals = list.map((r) => (r.zDelta != null ? Number(r.zDelta) : NaN));
  const remVals = list.map((r) => (r.pileRemaining != null ? Number(r.pileRemaining) : NaN));
  const mzVals2 = list.map((r) => (r.meissaZoneResidual != null ? Number(r.meissaZoneResidual) : NaN));

  const [pLo, pHi] = extent(planVals);
  const [zLo, zHi] = extent(zdVals);
  const [rLo, rHi] = extent(remVals);
  const [mzLo2, mzHi2] = extent(mzVals2);

  for (const r of list) {
    const x = Number(r.x);
    const yMap = Number(r.y);
    const mzElev = r.meissaZ != null && Number.isFinite(Number(r.meissaZ)) ? Number(r.meissaZ) : null;
    const zCsv = r.z != null && Number.isFinite(Number(r.z)) ? Number(r.z) : null;
    const tZ = r.terrainZ != null && Number.isFinite(Number(r.terrainZ)) ? Number(r.terrainZ) : null;
    /** 색(mz_zone 등)은 Meissa Z 기준인데, 예전에는 도면만 올려 높이가 어긋나 보였음 → 조회 Z 우선 */
    const yUp = overlay2dMode ? 0 : mzElev != null ? mzElev : zCsv != null ? zCsv : tZ != null ? tZ : 0;
    if (!Number.isFinite(x) || !Number.isFinite(yMap)) continue;
    if (!recordPassesRemainingMinFilter(r, colorMode, remainingMinFilter)) continue;

    let rgb;
    if (colorMode === "matched") {
      rgb = r.hasCircle ? [0.2, 0.65, 0.95] : [0.55, 0.55, 0.58];
    } else if (colorMode === "mz_zone") {
      rgb = rgbForMzZoneRecord(r, mzLo2, mzHi2);
    } else if (colorMode === "pdam") {
      rgb = rgbForPdamRecord(r);
    } else if (colorMode === "zdelta") {
      const v = r.zDelta != null ? Number(r.zDelta) : NaN;
      rgb = heatColor(Number.isFinite(v) ? norm(v, zLo, zHi) : 0.5);
    } else if (colorMode === "remaining") {
      rgb = rgbForRemainingBands(
        r.pileRemaining != null ? Number(r.pileRemaining) : NaN,
        r?.pdamStatus === "installed"
      );
    } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
      rgb = rgbForPlanDevRecord(r, planOkM3d, planBadM3d);
    } else {
      const v = r.planD != null ? Number(r.planD) : NaN;
      rgb = heatColor(Number.isFinite(v) ? norm(v, pLo, pHi) : 0.5);
    }
    pos.push(x, yUp, yMap);
    col.push(rgb[0], rgb[1], rgb[2]);
  }

  const cmpGeo =
    pos.length &&
    (() => {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(pos), 3));
      geo.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(col), 3));
      return geo;
    })();
  const cmpMat =
    cmpGeo &&
    new T.PointsMaterial({
      size: overlay2dMode ? 10 : 7,
      sizeAttenuation: false,
      vertexColors: true,
      depthTest: !overlay2dMode,
      transparent: true,
      opacity: 1,
    });

  let baseGeoBuilt = null;
  let baseMatBuilt = null;
  if (activeBasePoints.length) {
    const flat = [];
    const baseCols = [];
    for (let i = 0; i < activeBasePoints.length; i++) {
      const p = activeBasePoints[i];
      flat.push(Number(p[0]), overlay2dMode ? 0 : Number(p[2]), Number(p[1]));
      const c = basePointColors[i];
      if (Array.isArray(c) && c.length >= 3) {
        baseCols.push(clamp(Number(c[0]), 0, 1), clamp(Number(c[1]), 0, 1), clamp(Number(c[2]), 0, 1));
      } else {
        baseCols.push(0.49, 0.91, 1.0);
      }
    }
    baseGeoBuilt = new T.BufferGeometry();
    baseGeoBuilt.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(flat), 3));
    baseGeoBuilt.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(baseCols), 3));
    baseMatBuilt = new T.PointsMaterial({
      size: viewMode === "meissa" ? 4.5 : 3.2,
      sizeAttenuation: true,
      vertexColors: true,
      depthTest: true,
      transparent: true,
      opacity: viewMode === "meissa" ? 0.9 : 0.65,
    });
  }

  // 평면 겹침: 점군(베이스)을 먼저 넣고 비교 점을 나중에 넣어 잔량 색이 위에 그려지게 한다.
  if (overlay2dMode && baseGeoBuilt && cmpGeo) {
    basePointsObj = new T.Points(baseGeoBuilt, baseMatBuilt);
    scene.add(basePointsObj);
    pointsObj = new T.Points(cmpGeo, cmpMat);
    scene.add(pointsObj);
  } else {
    if (cmpGeo && cmpMat) {
      pointsObj = new T.Points(cmpGeo, cmpMat);
      scene.add(pointsObj);
    }
    if (baseGeoBuilt && baseMatBuilt) {
      basePointsObj = new T.Points(baseGeoBuilt, baseMatBuilt);
      scene.add(basePointsObj);
    }
  }

  const boundGeo = pointsObj?.geometry || basePointsObj?.geometry;
  if (!boundGeo) {
    if (legendEl) legendEl.textContent = "유효 좌표가 없습니다.";
    return;
  }
  boundGeo.computeBoundingSphere();
  const c = boundGeo.boundingSphere.center;
  const rad = Math.max(boundGeo.boundingSphere.radius, 8);
  if (obliqueImageMode && overlayImageUrl) {
    const planeSize = Math.max(180, rad * 3.4);
    const geo = new T.PlaneGeometry(planeSize, planeSize);
    const tex = new T.TextureLoader().load(overlayImageUrl);
    if (tex && "colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1));
    const mat = new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.9,
      side: T.DoubleSide,
      depthWrite: false,
    });
    imagePlaneObj = new T.Mesh(geo, mat);
    imagePlaneObj.position.set(c.x, c.y - rad * 0.22, c.z);
    imagePlaneObj.rotation.x = -Math.PI / 2 + 0.5;
    scene.add(imagePlaneObj);
  }
  controls.target.set(c.x, c.y, c.z);
  const dist = rad * 2.4;
  if (overlay2dMode) {
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    camera.up.set(0, 0, -1);
    camera.position.set(c.x, c.y + dist * 1.6, c.z);
  } else {
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons = {
      LEFT: T.MOUSE.ROTATE,
      MIDDLE: T.MOUSE.DOLLY,
      RIGHT: T.MOUSE.PAN,
    };
    controls.touches = {
      ONE: T.TOUCH.ROTATE,
      TWO: T.TOUCH.DOLLY_PAN,
    };
    camera.up.set(0, 1, 0);
    camera.position.set(c.x + dist * 0.85, c.y + dist * 0.55, c.z + dist * 0.85);
  }
  camera.near = Math.max(0.01, dist / 2000);
  camera.far = Math.max(1e4, dist * 50);
  camera.updateProjectionMatrix();
  controls.update();

  if (gridHelper && !overlay2dMode) {
    const gSize = Math.min(Math.max(rad * 4, 80), 2000);
    scene.remove(gridHelper);
    gridHelper.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    gridHelper = new T.GridHelper(gSize, Math.min(48, Math.max(12, Math.round(gSize / 15))), 0x475569, 0x1e293b);
    scene.add(gridHelper);
  } else if (gridHelper && overlay2dMode) {
    scene.remove(gridHelper);
    gridHelper.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    gridHelper = null;
  }
  if (!gridHelper && !overlay2dMode) {
    const gSize = Math.min(Math.max(rad * 4, 80), 2000);
    gridHelper = new T.GridHelper(gSize, Math.min(48, Math.max(12, Math.round(gSize / 15))), 0x475569, 0x1e293b);
    scene.add(gridHelper);
  }

  if (legendEl) {
    const baseLine = activeBasePoints.length
      ? ` · Meissa 원본 ${baseResourceCount}리소스 / ${activeBasePoints.length}점`
      : "";
    if (viewMode === "meissa") {
      legendEl.textContent = "Meissa 원본 3D 기준 점군";
    } else if (colorMode === "matched") {
      legendEl.textContent = "파랑: 도면 원 매칭됨 · 회색: 미매칭";
    } else if (colorMode === "mz_zone") {
      legendEl.textContent = `Meissa Z vs 구역 |ΔZ| ${mzLo2.toFixed(3)}~${mzHi2.toFixed(3)} m · 녹=유사 적=이탈 · 회색=미시공 · 3D높이=Meissa Z 우선`;
    } else if (colorMode === "pdam") {
      legendEl.textContent = "선명한 녹색: PDAM 시공 · 회색: 미시공";
    } else if (colorMode === "zdelta") {
      legendEl.textContent = `Z−지형 ${zLo.toFixed(3)} ~ ${zHi.toFixed(3)} m (녹→적)`;
    } else if (colorMode === "remaining") {
      legendEl.textContent = remainingLegendLine(remainingMinFilter);
    } else if (colorMode === "ortho_pdam" || colorMode === "plan_dev") {
      legendEl.textContent = `평면·정사 통합: 3D는 평면 |d| ≤${planOkM3d}m 녹 · ${planOkM3d}~${planBadM3d}m 황 · ≥${planBadM3d}m 적 — RGB 등급·오프셋 표는 2D 정사 패널`;
    } else {
      legendEl.textContent = `평면 편차 ${pLo.toFixed(3)} ~ ${pHi.toFixed(3)} m (녹→적)`;
    }
    legendEl.textContent += `${baseLine} · Canvas 3D 폴백(드래그 회전, Shift+드래그 이동, 휠 확대)`;
  }
}

export function dispose() {
  cancelAnimationFrame(rafId);
  if (resizeObserver && rootEl) resizeObserver.unobserve(rootEl);
  resizeObserver = null;
  unbindFallbackInteractions();
  if (fallbackCanvas) fallbackCanvas.remove();
  fallbackCanvas = null;
  fallbackCtx = null;
  fallbackZoom = 1;
  fallbackPanX = 0;
  fallbackPanY = 0;
  fallbackRotX = -0.45;
  fallbackRotY = 0.65;
  fallbackDragging = false;
  fallbackPayload = null;
  useFallback2d = false;
  disposePoints();
  disposeBasePoints();
  disposeImagePlane();
  if (gridHelper && scene) {
    scene.remove(gridHelper);
    gridHelper.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    gridHelper = null;
  }
  if (controls) controls.dispose();
  controls = null;
  if (renderer) {
    renderer.dispose();
    renderer.domElement?.remove();
  }
  renderer = null;
  scene = null;
  camera = null;
  rootEl = null;
  T = null;
  OrbitControls = null;
}
