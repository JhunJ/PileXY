const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../materials.js'), 'utf8');
function loadFunction(ctx, name) {
  let start = source.indexOf(`  function ${name}(`);
  if (start < 0) start = source.indexOf(`  async function ${name}(`);
  assert.notEqual(start, -1, name);
  vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), ctx);
}
function setup() {
  let project = 'A';
  const pending = [];
  const mount = {innerHTML: 'previous project inputs'};
  const hint = {textContent: ''};
  const renders = [];
  const timers = new Map();
  let timerId = 0;
  const ctx = vm.createContext({
    projectContext: () => project,
    apiBase: () => 'https://isolated.invalid',
    document: {getElementById: id => id === 'materials-app-mount' ? mount : hint},
    console: {error() {}}, window: {}, LENS: [5, 10, 15],
    ensureJoinLengthSpecs() {}, rid: () => 'fixture-id',
    ensureProjectNameResyncForMaterials() {}, ensureWorkContextMaterialsHook() {},
    fullRender: () => renders.push({project, plan: vm.runInContext('bundle.planByBuilding', ctx)}),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise((resolve, reject) => pending.push({url, options, resolve, reject})),
  });
  vm.runInContext('let bundle=null; let lastMaterialsPc=null; let materialsLoadToken=0; let mounted=false; let saveTimer=null; let pendingMaterialsSave=null; const materialsSaveByProject=new Map(); let materialsSaveChain=Promise.resolve();', ctx);
  for (const name of ['defaultJoinLengthSpecsFromLegacy', 'markMaterialsServerCacheStale', 'scheduleSave', 'flushMaterialsSave', 'persistNow', 'persistMaterialsSnapshot', 'loadBundle', 'init']) loadFunction(ctx, name);
  return {
    ctx, pending, mount, hint, renders,
    switchProject(value) { project = value; ctx.markMaterialsServerCacheStale(); },
    bundle: () => vm.runInContext('bundle', ctx),
    cachedProject: () => vm.runInContext('lastMaterialsPc', ctx),
    setBundle(value) { ctx.fixtureBundle = value; vm.runInContext('bundle=fixtureBundle;', ctx); },
    runTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    saved: () => vm.runInContext('materialsSaveChain', ctx),
  };
}
const response = project => ({ok:true, json:async () => ({planByBuilding:{[project]:{5:1}}, meta:{saved:true}})});

test('late materials response from A cannot overwrite current project B', async () => {
  const f = setup();
  const a = f.ctx.loadBundle();
  await Promise.resolve();
  f.switchProject('B');
  const b = f.ctx.loadBundle();
  await Promise.resolve();
  f.pending[1].resolve(response('B'));
  assert.equal(await b, true);
  f.pending[0].resolve(response('A'));
  assert.equal(await a, false);
  assert.deepEqual(Object.keys(f.bundle().planByBuilding), ['B']);
  assert.equal(f.cachedProject(), 'B');
});

test('late materials failure cannot clear the newer project or its feedback', async () => {
  const f = setup();
  const a = f.ctx.loadBundle();
  await Promise.resolve();
  f.switchProject('B');
  const b = f.ctx.loadBundle();
  await Promise.resolve();
  f.pending[1].resolve(response('B'));
  await b;
  const feedback = f.hint.textContent;
  f.pending[0].reject(new Error('old A connection failed'));
  assert.equal(await a, false);
  assert.deepEqual(Object.keys(f.bundle().planByBuilding), ['B']);
  assert.equal(f.hint.textContent, feedback);
});

test('switching projects invalidates an in-flight load even before the next load starts', async () => {
  const f = setup();
  const a = f.ctx.loadBundle();
  await Promise.resolve();
  f.switchProject('B');
  f.pending[0].resolve(response('A'));
  assert.equal(await a, false);
  assert.equal(f.bundle(), null);
});

test('stale init completion cannot render A or stamp the cache after B has loaded', async () => {
  const f = setup();
  const a = f.ctx.init();
  await Promise.resolve();
  f.switchProject('B');
  const b = f.ctx.init();
  await Promise.resolve();
  f.pending[1].resolve(response('B'));
  await b;
  f.pending[0].resolve(response('A'));
  await a;
  assert.equal(f.renders.length, 1);
  assert.equal(f.renders[0].project, 'B');
  assert.deepEqual(Object.keys(f.renders[0].plan), ['B']);
  assert.equal(f.cachedProject(), 'B');
});

test('a failed load leaves no editable empty bundle that could overwrite saved server data', async () => {
  const f = setup();
  const load = f.ctx.init();
  await Promise.resolve();
  f.pending[0].reject(new Error('network unavailable'));
  await load;
  assert.equal(f.bundle(), null);
  assert.equal(f.cachedProject(), null);
  assert.equal(f.renders.length, 0);
  assert.match(f.mount.innerHTML, /role="alert"/);
});

test('previous-project inputs are removed while the new project is loading', async () => {
  const f = setup();
  const a = f.ctx.loadBundle();
  await Promise.resolve();
  f.pending[0].resolve(response('A'));
  await a;
  f.mount.innerHTML = 'A editable receipt rows';
  f.switchProject('B');
  const b = f.ctx.loadBundle();
  await Promise.resolve();
  assert.equal(f.bundle(), null);
  assert.doesNotMatch(f.mount.innerHTML, /A editable/);
  f.pending[1].resolve(response('B'));
  await b;
});

test('editing B cannot cancel a pending materials save for A', async () => {
  const f = setup();
  f.setBundle({ planByBuilding: { A: { 5: 1 } } });
  f.ctx.scheduleSave();
  f.switchProject('B');
  f.setBundle({ planByBuilding: { B: { 5: 2 } } });
  f.ctx.scheduleSave();
  f.runTimers();
  await Promise.resolve();
  assert.equal(f.pending.length, 1);
  assert.ok(f.pending[0].url.endsWith('project_context=A'));
  assert.deepEqual(JSON.parse(f.pending[0].options.body).planByBuilding, { A: { 5: 1 } });
  f.pending[0].resolve(response('A'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.pending.length, 2);
  assert.ok(f.pending[1].url.endsWith('project_context=B'));
  f.pending[1].resolve(response('B'));
  await f.saved();
});

test('reopening materials waits for a pending save before fetching the server bundle', async () => {
  const f = setup();
  f.setBundle({ planByBuilding: { A: { 5: 9 } } });
  f.ctx.scheduleSave();
  const loading = f.ctx.init();
  await Promise.resolve();
  assert.equal(f.pending.length, 1);
  assert.equal(f.pending[0].options.method, 'PUT');
  f.pending[0].resolve({ ok: true, json: async () => ({ meta: { saved: true } }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.pending.length, 2);
  assert.equal(f.pending[1].options, undefined);
  f.pending[1].resolve({ ok: true, json: async () => ({ planByBuilding: { A: { 5: 9 } }, meta: { saved: true } }) });
  await loading;
  assert.equal(f.bundle().planByBuilding.A[5], 9);
  assert.equal(f.renders.length, 1);
});

test('a failed PUT while reopening preserves the unsaved current project bundle without fetching stale data', async () => {
  const f = setup();
  f.setBundle({ planByBuilding: { A: { 5: 9 } } });
  f.ctx.scheduleSave();
  const loading = f.ctx.init();
  await Promise.resolve();
  f.pending[0].reject(new Error('isolated PUT failure'));
  await loading;
  assert.equal(f.pending.length, 1);
  assert.equal(f.bundle().planByBuilding.A[5], 9);
  assert.equal(f.renders.length, 1);
  assert.match(f.hint.textContent, /서버 저장 실패/);
});

test('late failed A save cannot restore A inputs after switching to B', async () => {
  const f = setup();
  f.setBundle({ planByBuilding: { A: { 5: 9 } } });
  f.ctx.scheduleSave();
  const a = f.ctx.init();
  await Promise.resolve();
  f.switchProject('B');
  const b = f.ctx.init();
  f.pending[0].reject(new Error('old A PUT failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.pending.length, 2);
  f.pending[1].resolve(response('B'));
  await Promise.all([a, b]);
  assert.deepEqual(Object.keys(f.bundle().planByBuilding), ['B']);
  assert.equal(f.renders.length, 1);
});
