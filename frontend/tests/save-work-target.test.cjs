const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`async function ${name}(`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
class Select {
  constructor() { this.options = []; this.dataset = {}; this.style = {}; }
  set innerHTML(value) { this.options = []; this.current = undefined; }
  appendChild(option) { this.options.push(option); }
  get value() { return this.current ?? this.options[0]?.value ?? ''; }
  set value(value) { this.current = this.options.some(o => o.value === value) ? value : ''; }
  get selectedOptions() { return this.options.filter(o => o.value === this.value).slice(0, 1); }
  addEventListener() {} removeEventListener() {} focus() {}
}
function setup(loadedWorkId) {
  const open = functionSource('openSaveWorkModal');
  const ctx = {};
  for (const name of open.match(/\bsaveWork\w+\b/g)) ctx[name] = null;
  Object.assign(ctx, {
    state: { hasDataset: true, loadedWorkId, lastUploadedFileName: '업성.dwg' },
    DEFAULT_PROJECT_NAME: '기본', DEFAULT_SOURCE_TYPE: 'contractor_original',
    getActiveProjectName: () => '업성', getActiveSourceType: () => 'contractor_original',
    normalizeProjectName: s => s || '기본', normalizeSourceType: s => s || 'contractor_original',
    getSavedWorksList: async () => [
      { id: 'summit', project: '써밋', title: '써밋' },
      { id: 'older', project: '업성', title: '이전 업성' },
      { id: 'loaded', project: '업성', title: '현재 업성' },
    ],
    document: { createElement: () => ({ dataset: {} }) },
    saveWorkOverwriteSelect: new Select(),
    saveWorkModal: { dataset: {}, classList: { add() {} }, setAttribute() {} },
    setUploadStatus: (message) => { ctx.status = message; },
  });
  vm.createContext(ctx);
  const guardStart = source.indexOf('function drawingSaveBlockReason(');
  vm.runInContext(source.slice(guardStart, source.indexOf('function updateDrawingUploadState(', guardStart)), ctx);
  vm.runInContext(open, ctx);
  vm.runInContext(functionSource('submitSaveWorkModal'), ctx);
  return ctx;
}
test('overwrite defaults to the loaded work, excluding other projects and newer list entries', async () => {
  const ctx = setup('loaded');
  await ctx.openSaveWorkModal(true);
  assert.equal(ctx.saveWorkOverwriteSelect.value, 'loaded');
  assert.deepEqual(ctx.saveWorkOverwriteSelect.options.map(o => o.value), ['', 'older', 'loaded']);
});
test('missing loaded target stays unselected and cannot submit', async () => {
  const ctx = setup('missing');
  await ctx.openSaveWorkModal(true);
  assert.equal(ctx.saveWorkOverwriteSelect.value, '');
  await ctx.submitSaveWorkModal();
  assert.match(ctx.status, /선택/);
});
test('changing work while the dialog is open blocks stale submission', async () => {
  const ctx = setup('loaded');
  await ctx.openSaveWorkModal(true);
  ctx.state.loadedWorkId = 'other';
  await ctx.submitSaveWorkModal();
  assert.match(ctx.status, /변경/);
});
