const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../construction.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const a = { startDate: '2026-10-01', endDate: '2026-10-31', rigCount: 3, entries: { A: { status: 'standby' } } };
const b = { ...a, entries: { B: { status: 'normal' } } };

function setup(fetch) {
  const storage = new Map();
  const timers = new Map();
  let timerId = 0;
  const ctx = vm.createContext({
    console, Date, JSON, encodeURIComponent,
    state: { loadedWorkId: 'A-work', loadedWorkMeta: { project: 'A' } },
    constructionState: { billingOperations: plain(a), billingOperationsStorageKey: '', billingOperationsProjectContext: '' },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    constructionBillingFeedback: { textContent: '' },
    API_BASE_URL: 'https://isolated.invalid', fetch,
    BILLING_DEFAULT_RIG_COUNT: 3, BILLING_MAX_RIG_COUNT: 12,
    getConstructionProjectContext: () => ctx.state.loadedWorkMeta.project,
    renderBillingOperationsTable: () => {},
  });
  vm.runInContext('let billingServerSaveTimer = null; let billingServerLoadToken = 0; let billingPendingServerSave = null; let billingServerSaveChain = Promise.resolve(); const billingServerSaveByContext = new Map();', ctx);
  for (const name of ['billingPad2', 'billingDateToken', 'parseBillingDateToken', 'billingMonthRange', 'normalizeBillingRigCount', 'billingStorageKey', 'billingProjectContext', 'normalizeBillingOperations', 'ensureBillingOperationsLoaded', 'saveBillingOperations', 'scheduleBillingServerSave', 'flushBillingServerSave', 'pushBillingOperationsToServer', 'loadBillingOperationsFromServer']) {
    let start = source.indexOf(`  function ${name}(`);
    if (start < 0) start = source.indexOf(`  async function ${name}(`);
    if (start >= 0) vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), ctx);
  }
  storage.set(ctx.billingStorageKey(), JSON.stringify(a));
  ctx.ensureBillingOperationsLoaded();
  function switchToB() {
    ctx.state.loadedWorkId = 'B-work';
    ctx.state.loadedWorkMeta.project = 'B';
    ctx.ensureBillingOperationsLoaded();
  }
  async function runTimers() {
    for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
    await vm.runInContext('billingServerSaveChain', ctx);
  }
  return { ctx, storage, switchToB, runTimers };
}

test('a project without browser or server billing data starts with no previous project entries', async () => {
  const { ctx, switchToB } = setup(async () => ({ ok: true, json: async () => ({ meta: { saved: false } }) }));
  switchToB();
  await ctx.loadBillingOperationsFromServer({ render: false });
  assert.deepEqual(plain(ctx.constructionState.billingOperations.entries), {});
});

test('repeated access to the same work preserves current unsaved entries', () => {
  const { ctx } = setup();
  ctx.constructionState.billingOperations.entries.new = { status: 'rain_all' };
  ctx.ensureBillingOperationsLoaded();
  assert.deepEqual(plain(ctx.constructionState.billingOperations.entries), { ...a.entries, new: { status: 'rain_all' } });
});

test('a delayed billing save retains its original project and cannot replace the next project browser data', async () => {
  let finish;
  const sent = [];
  const { ctx, storage, switchToB, runTimers } = setup((url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return new Promise(resolve => { finish = resolve; });
  });
  ctx.saveBillingOperations();
  switchToB();
  ctx.constructionState.billingOperations = plain(b);
  storage.set(ctx.billingStorageKey(), JSON.stringify(b));
  const saving = runTimers();
  await Promise.resolve();
  assert.equal(sent.length, 1);
  assert.ok(sent[0].url.endsWith('project_context=A'));
  assert.deepEqual(sent[0].body.entries, a.entries);
  finish({ ok: true, json: async () => plain(a) });
  await saving;
  assert.deepEqual(plain(ctx.constructionState.billingOperations.entries), b.entries);
  assert.deepEqual(JSON.parse(storage.get(ctx.billingStorageKey())).entries, b.entries);
});

test('editing a second project does not cancel the first project pending save', async () => {
  const sent = [];
  const { ctx, switchToB, runTimers } = setup(async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => JSON.parse(options.body) };
  });
  ctx.saveBillingOperations();
  switchToB();
  ctx.constructionState.billingOperations = plain(b);
  ctx.saveBillingOperations();
  await runTimers();
  assert.deepEqual(sent.map(x => x.url.split('project_context=')[1]), ['A', 'B']);
  assert.deepEqual(sent.map(x => x.body.entries), [a.entries, b.entries]);
});

test('a late server load cannot overwrite another project or newer edits in the same project', async () => {
  for (const changeProject of [true, false]) {
    let finish;
    const { ctx, switchToB } = setup(() => new Promise(resolve => { finish = resolve; }));
    const loading = ctx.loadBillingOperationsFromServer({ render: false });
    await Promise.resolve();
    if (changeProject) switchToB();
    ctx.constructionState.billingOperations = plain(b);
    finish({ ok: true, json: async () => ({ ...a, meta: { saved: true } }) });
    await loading;
    assert.deepEqual(plain(ctx.constructionState.billingOperations.entries), b.entries);
  }
});

test('save acknowledgements cannot replace edits made while the save was in flight', async () => {
  let finish;
  const { ctx, runTimers } = setup(() => new Promise(resolve => { finish = resolve; }));
  ctx.saveBillingOperations();
  const saving = runTimers();
  await Promise.resolve();
  ctx.constructionState.billingOperations.entries.new = { status: 'rain_all' };
  finish({ ok: true, json: async () => plain(a) });
  await saving;
  assert.ok(ctx.constructionState.billingOperations.entries.new);
});

test('reopening billing waits for its pending save before reading the server copy', async () => {
  let finishSave;
  let server = plain(a);
  const calls = [];
  const { ctx, runTimers } = setup((url, options) => {
    calls.push(options?.method || 'GET');
    if (options?.method === 'PUT') return new Promise(resolve => { finishSave = () => {
      server = JSON.parse(options.body);
      resolve({ ok: true, json: async () => plain(server) });
    }; });
    return Promise.resolve({ ok: true, json: async () => ({ ...server, meta: { saved: true } }) });
  });
  ctx.constructionState.billingOperations.entries.new = { status: 'rain_all' };
  ctx.saveBillingOperations();
  const saving = runTimers();
  await Promise.resolve();
  const loading = ctx.loadBillingOperationsFromServer({ render: false });
  await Promise.resolve();
  assert.deepEqual(calls, ['PUT']);
  finishSave();
  await Promise.all([saving, loading]);
  assert.deepEqual(calls, ['PUT', 'GET']);
  assert.ok(ctx.constructionState.billingOperations.entries.new);
});

test('a failed pending save keeps the browser copy instead of loading an older server copy', async () => {
  const calls = [];
  const { ctx } = setup(async (url, options) => {
    calls.push(options?.method || 'GET');
    return options?.method === 'PUT'
      ? { ok: false, text: async () => 'isolated network failure' }
      : { ok: true, json: async () => ({ ...a, meta: { saved: true } }) };
  });
  ctx.console = { warn: () => {} };
  ctx.constructionState.billingOperations.entries.new = { status: 'rain_all' };
  ctx.saveBillingOperations();
  await ctx.loadBillingOperationsFromServer({ render: false });
  assert.deepEqual(calls, ['PUT']);
  assert.ok(ctx.constructionState.billingOperations.entries.new);
});
