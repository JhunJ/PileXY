const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function extract(name, async = false) {
  const start = source.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function setup(send) {
  const old = { id: 'C1', center_x: 1, center_y: 2 };
  const ctx = {
    state: { hasDataset: true, loadedWorkId: 'old', loadedWorkMeta: {title: 'old'},
      circles: [old], sourceCircles: [old], sourceTexts: [], manualOverrides: {C1: 'T1'},
      filter: {}, lastUploadedFileName: 'old.dwg', drawingUploadStatus: 'ready' },
    fileInput: {files: [{name: 'new.dwg', size: 1}]},
    uploadButton: {disabled: false}, saveWorkBtn: {}, saveWorkUpdateBtn: {}, saveWorkModalSubmit: {},
    document: {getElementById: () => null, createElement: () => ({setAttribute() {}})}, uploadForm: {appendChild() {}},
    window: {pilexyBeginDrawingSession() {}}, CHUNKED_UPLOAD_THRESHOLD: 3000000,
    readManualHistoryReuseControlsToState() {}, getFilterValuesFromInputs: () => ({}),
    getDesiredBuildingCount: () => 1, sendUploadRequest: send, closeSaveWorkModal() {},
    setPhase() {}, setUploadStatus(s) {ctx.status = s;}, parseErrorMessage: e => e.message,
    setTimeout() {}, handlePayload(p) {ctx.state.circles = p.circles; ctx.state.texts = p.texts;},
    refreshMatchDerivedUIState() {}, updateFilterInputs() {}, updateSummaryCards() {},
    updateCircleTable() {}, updateDuplicatesTable() {}, updateErrorsTable() {}, requestRedraw() {},
    notifyWorkContextChanged() {}, updateUploadButtonState() {}, console,
  };
  vm.createContext(ctx);
  for (const name of ['drawingSaveBlockReason', 'ensureDrawingReadyForSave', 'updateDrawingUploadState', 'collectCurrentStateForSave']) {
    vm.runInContext(extract(name), ctx);
  }
  for (const name of ['handleUpload', 'submitSaveWorkModal', 'syncCurrentWorkToServer', 'syncManualMatchDeltaToServer', 'triggerDownload']) {
    vm.runInContext(extract(name, true), ctx);
  }
  return ctx;
}
test('failed upload after loading old work blocks manual save, autosave, snapshot and export', async () => {
  const ctx = setup(async () => {throw Error('response lost');});
  await ctx.handleUpload({preventDefault() {}});
  assert.equal(ctx.state.loadedWorkId, 'old');
  assert.equal(ctx.state.drawingUploadStatus, 'failed');
  assert.equal(ctx.saveWorkBtn.disabled, true);
  assert.equal(ctx.saveWorkUpdateBtn.disabled, true);
  assert.throws(() => ctx.collectCurrentStateForSave(), /업로드가 완료되지/);
  await ctx.submitSaveWorkModal();
  await ctx.triggerDownload('xlsx');
  assert.equal(await ctx.syncCurrentWorkToServer(), false);
  assert.equal(await ctx.syncManualMatchDeltaToServer({}), false);
});
test('pending upload blocks saving and duplicate upload; successful retry discards old snapshot and ID', async () => {
  let resolve, calls = 0;
  const ctx = setup(() => {calls++; return new Promise(r => {resolve = r;});});
  const promise = ctx.handleUpload({preventDefault() {}});
  assert.equal(ctx.state.drawingUploadStatus, 'pending');
  assert.throws(() => ctx.collectCurrentStateForSave(), /진행 중/);
  await ctx.handleUpload({preventDefault() {}});
  assert.equal(calls, 1);
  resolve({circles: [{id: 'C1', center_x: 1.018}], texts: [], source_metadata: {filename: 'new.dwg', sha256: 'abc'}});
  await promise;
  assert.equal(ctx.state.circles[0].center_x, 1.018);
  assert.equal(ctx.state.loadedWorkId, null);
  assert.equal(ctx.state.sourceCircles, null);
  assert.equal(ctx.state.sourceTexts, null);
  assert.equal(ctx.state.sourceMetadata.sha256, 'abc');
  assert.equal(ctx.state.drawingUploadStatus, 'ready');
  assert.equal(ctx.saveWorkBtn.disabled, false);
});
test('invalid response and UI failure cannot leave saving enabled', async () => {
  for (const payload of [{}, {circles: [], texts: [], source_metadata: {filename: 'wrong.dwg'}}]) {
    const ctx = setup(async () => payload);
    await ctx.handleUpload({preventDefault() {}});
    assert.equal(ctx.state.drawingUploadStatus, 'failed');
    assert.equal(ctx.saveWorkBtn.disabled, true);
  }
  const ctx = setup(async () => ({circles: [], texts: []}));
  ctx.handlePayload = () => {throw Error('render failed');};
  await ctx.handleUpload({preventDefault() {}});
  assert.equal(ctx.state.drawingUploadStatus, 'failed');
  assert.equal(ctx.state.loadedWorkId, null);
});
test('tabs and new drawing sessions are isolated, late geometry responses are rejected', async () => {
  const script = fs.readFileSync(path.join(__dirname, '../pilexy-session.js'), 'utf8');
  const storage = {getItem: () => 'old-shared-session', setItem() {}};
  let resolve;
  function tab() {
    const window = {localStorage: storage, fetch: () => new Promise(r => {resolve = r;})};
    vm.runInNewContext(script, {window, Headers, crypto: require('node:crypto').webcrypto});
    return window;
  }
  const a = tab(), b = tab();
  assert.notEqual(a.__PILEXY_SESSION_ID__, b.__PILEXY_SESSION_ID__);
  const request = a.fetch('/api/circles');
  const oldSession = a.__PILEXY_SESSION_ID__;
  a.pilexyBeginDrawingSession();
  assert.notEqual(a.__PILEXY_SESSION_ID__, oldSession);
  resolve({json: async () => ({circles: []})});
  await assert.rejects(request, /도면이 변경/);
  const headersReceived = a.fetch('/api/assign-buildings');
  resolve({json: () => new Promise(r => {resolve = r;})});
  const response = await headersReceived;
  const body = response.json();
  a.pilexyBeginDrawingSession();
  resolve({circles: []});
  await assert.rejects(body, /도면이 변경/);
});

test('a late saved-work snapshot cannot restore old coordinates after a new upload', async () => {
  let resolve;
  const ctx = setup(async () => ({circles: [{id: 'C1', center_x: 1.018}], texts: []}));
  ctx.state.sourceCircles = null;
  ctx.fetch = () => new Promise(r => {resolve = r;});
  ctx.API_BASE_URL = '';
  vm.runInContext(extract('resolveCirclesTextsForFilterApply', true), ctx);
  const pending = ctx.resolveCirclesTextsForFilterApply();
  await ctx.handleUpload({preventDefault() {}});
  resolve({ok: true, json: async () => ({circles: [{id: 'C1', center_x: 1}], texts: []})});
  await assert.rejects(pending, /도면이 변경/);
  assert.equal(ctx.state.sourceCircles, null);
  assert.equal(ctx.state.circles[0].center_x, 1.018);
});

test('upload then filter and save snapshot keep new coordinates, including reused circle IDs', async () => {
  const ctx = setup(async () => ({circles: [{id: 'C1', center_x: 1.018}], texts: [],
    source_metadata: {filename: 'new.dwg', sha256: 'new-source'}}));
  Object.assign(ctx, {
    API_BASE_URL: '', URLSearchParams, applyFilterBtn: {}, getClusteringSetting: (_, v) => v,
    renderBuildingTabs() {}, computeManualOverridesForSave: () => ({}),
    getActiveProjectName: () => 'new project', getActiveSourceType: () => 'pile',
    serializeBuildingDefinitions: x => x, getConfiguredAreaCount: () => 1,
    AREA_KIND_BUILDING: 'building', AREA_KIND_PARKING: 'parking', AREA_KIND_TOWER_CRANE: 'tower',
  });
  for (const name of ['resolveCirclesTextsForFilterApply', 'applyFilterFromPanel']) {
    vm.runInContext(extract(name, true), ctx);
  }
  ctx.fetch = async url => {
    assert.ok(url.startsWith('/api/circles?'), 'must not fetch or apply the previous saved-work snapshot');
    return {ok: true, json: async () => ({circles: [{id: 'C1', center_x: 1.018}], texts: []})};
  };
  await ctx.handleUpload({preventDefault() {}});
  await ctx.applyFilterFromPanel();
  const saved = ctx.collectCurrentStateForSave();
  assert.equal(saved.circles[0].center_x, 1.018);
  assert.equal(saved.sourceMetadata.sha256, 'new-source');
  assert.equal(saved.project, 'new project');
  assert.equal(ctx.state.loadedWorkId, null);
});

test('filters cannot run against old screen data during a pending or failed upload', async () => {
  const ctx = setup(async () => ({}));
  vm.runInContext(extract('applyFilterFromPanel', true), ctx);
  for (const status of ['pending', 'failed']) {
    ctx.state.drawingUploadStatus = status;
    await ctx.applyFilterFromPanel();
    assert.equal(ctx.state.circles[0].center_x, 1);
  }
});
