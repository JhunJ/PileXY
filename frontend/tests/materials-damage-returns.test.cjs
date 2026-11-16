const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../materials.js'), 'utf8');
function loadFunction(ctx, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `missing materials function: ${name}`);
  vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), ctx);
}
function setup(damageReturns = [], filter = {}) {
  const ctx = vm.createContext({
    bundle: {damageReturns}, filterMode: 'all', filterMonth: '', filterFrom: '', filterTo: '',
    ...filter,
  });
  for (const name of ['parseDateLoose', 'damageReturnQty', 'damageInFilterRange', 'inFilterRange',
    'pendingOrderQty', 'sumDamageQty']) loadFunction(ctx, name);
  return ctx;
}

test('legacy damage rows retain one piece while explicit zero remains zero', () => {
  const ctx = setup();
  for (const row of [{}, {qty: undefined}, {qty: null}, {qty: ''}, {qty: '  '}]) {
    assert.equal(ctx.damageReturnQty(row), 1);
  }
  for (const qty of [0, '0']) assert.equal(ctx.damageReturnQty({qty}), 0);
  for (const qty of [3, '3', ' 3 ']) assert.equal(ctx.damageReturnQty({qty}), 3);
});

test('invalid, negative and fractional stored quantities do not create damage counts', () => {
  const ctx = setup();
  for (const qty of [-1, '-2', 1.5, '1.5', 'broken', NaN, Infinity, -Infinity,
    true, false, [], [2], {}, Number.MAX_SAFE_INTEGER + 1, '9007199254740992']) {
    assert.equal(ctx.damageReturnQty({qty}), 0, `quantity ${String(qty)}`);
  }
});

test('damage totals sum entered quantities for the requested segment length only', () => {
  const ctx = setup([
    {lengthM: 10, qty: 3}, {lengthM: '10', qty: '2'}, {lengthM: 10},
    {lengthM: 10, qty: 0}, {lengthM: 10, qty: -7}, {lengthM: 10, qty: 2.5},
    {lengthM: 5, qty: 9}, {lengthM: '', qty: 30},
  ]);
  assert.equal(ctx.sumDamageQty(10), 6);
  assert.equal(ctx.sumDamageQty(5), 9);
  assert.equal(ctx.sumDamageQty(15), 0);
});

test('the all-period view preserves undated legacy damage without altering saved rows', () => {
  const rows = [{lengthM: 10}, {lengthM: 10, date: '', qty: 2},
    {lengthM: 10, date: 'invalid', qty: 4}, {lengthM: 10, date: '2025-01-01', qty: 8}];
  const before = JSON.stringify(rows);
  const ctx = setup(rows);
  assert.equal(ctx.sumDamageQty(10), 15);
  assert.equal(JSON.stringify(rows), before);
});

test('a selected month includes only damage dated in that month', () => {
  const ctx = setup([
    {lengthM: 10, date: '2026-10-01', qty: 2},
    {lengthM: 10, date: '2026.10.31', qty: 3},
    {lengthM: 10, date: '26/10/22'},
    {lengthM: 10, date: '2026-09-30', qty: 50},
    {lengthM: 10, date: '2026-11-01', qty: 60},
    {lengthM: 10, qty: 70}, {lengthM: 10, date: 'invalid', qty: 80},
  ], {filterMode: 'month', filterMonth: '2026-10'});
  assert.equal(ctx.sumDamageQty(10), 6);
});

test('date filters reject impossible calendar dates and accept valid leap days', () => {
  const ctx = setup([], {filterMode: 'range', filterFrom: '2024-01-01', filterTo: '2026-12-31'});
  for (const date of ['2026-02-30', '2026-02-29', '2026-10-99', '2026-13-01', '2026-00-10']) {
    assert.equal(ctx.damageInFilterRange(date), false, date);
  }
  assert.equal(ctx.damageInFilterRange('2024-02-29'), true);
});

test('date ranges include both boundaries and exclude dates outside the range', () => {
  const rows = [
    {lengthM: 10, date: '2026-10-09', qty: 100},
    {lengthM: 10, date: '2026-10-10', qty: 2},
    {lengthM: 10, date: '2026/10/15', qty: 3},
    {lengthM: 10, date: '2026-10-20', qty: 5},
    {lengthM: 10, date: '2026-10-21', qty: 200}, {lengthM: 10, qty: 300},
  ];
  const ctx = setup(rows, {filterMode: 'range', filterFrom: '2026-10-10', filterTo: '2026-10-20'});
  assert.equal(ctx.sumDamageQty(10), 10);
  ctx.filterTo = '';
  assert.equal(ctx.sumDamageQty(10), 210);
  ctx.filterFrom = ''; ctx.filterTo = '2026-10-20';
  assert.equal(ctx.sumDamageQty(10), 110);
});

test('choosing a filter mode without an actual date condition keeps all damage', () => {
  const ctx = setup([{lengthM: 10, qty: 3}], {filterMode: 'month'});
  assert.equal(ctx.sumDamageQty(10), 3);
  ctx.filterMode = 'range';
  assert.equal(ctx.sumDamageQty(10), 3);
});

test('damage date filtering does not change the existing receipt handling of missing dates', () => {
  const ctx = setup([], {filterMode: 'month', filterMonth: '2026-10'});
  assert.equal(ctx.damageInFilterRange(''), false);
  assert.equal(ctx.inFilterRange(''), true);
});

test('replacement demand includes damage and offsets already received surplus', () => {
  const ctx = setup();
  assert.equal(ctx.pendingOrderQty(100, 100, 7), 7);
  assert.equal(ctx.pendingOrderQty(100, 80, 7), 27);
  assert.equal(ctx.pendingOrderQty(100, 105, 7), 2);
  assert.equal(ctx.pendingOrderQty(100, 110, 7), 0);
  assert.equal(ctx.pendingOrderQty(100, 80, 0), 20);
});

test('summary stock and unordered demand both use quantities from the active period', () => {
  const ctx = setup([
    {lengthM: 10, date: '2026-10-22', qty: 7},
    {lengthM: 10, date: '2026-09-22', qty: 30},
  ], {filterMode: 'month', filterMonth: '2026-10'});
  const table = {innerHTML: ''};
  Object.assign(ctx, {LENS: [10], document: {getElementById: () => table},
    planTotalLenSplitForSummary: () => 100, sumReceiptQtySplitForSummary: () => 100,
    usedFromPdamLengthSplitForSummary: () => 80});
  loadFunction(ctx, 'renderSummary');
  ctx.renderSummary();
  const cells = [...table.innerHTML.matchAll(/<td(?:\s[^>]*)?>([^<]*)<\/td>/g)].map(m => m[1]);
  assert.deepEqual(cells, ['10m', '100', '100', '80', '7', '13', '7']);
});

test('truck guidance still displays replacement orders when plan and receipts are equal', () => {
  const ctx = setup([{lengthM: 10, date: '2026-10-22', qty: 7}]);
  const hint = {innerHTML: ''};
  Object.assign(ctx, {LENS: [10], document: {getElementById: () => hint},
    planTotalLenSplitForSummary: () => 100, sumReceiptQtySplitForSummary: () => 100,
    truckRuleFor: () => 20, escapeHtml: s => String(s)});
  loadFunction(ctx, 'describeTruckTrips');
  loadFunction(ctx, 'renderTruckHint');
  ctx.renderTruckHint();
  assert.match(hint.innerHTML, /미발주/);
  assert.match(hint.innerHTML, /<strong>7<\/strong>/);
  assert.match(hint.innerHTML, /파손/);
});

function renderSetup(row, inputs = []) {
  const ctx = setup([row]);
  const table = {innerHTML: '', querySelectorAll: selector => selector === 'input[data-dmg]' ? inputs : []};
  let saves = 0, renders = 0;
  Object.assign(ctx, {document: {getElementById: () => table},
    supplierRowToneClass: () => '', escapeHtml: s => String(s ?? ''),
    scheduleSave: () => saves++, fullRender: () => renders++});
  loadFunction(ctx, 'toDateInputValue');
  loadFunction(ctx, 'renderDamage');
  ctx.renderDamage('');
  return {ctx, table, saves: () => saves, renders: () => renders};
}
function input(field, value, type = 'number') {
  const handlers = {};
  return {dataset: {dmg: '0', f: field}, value, type, validity: {valid: true},
    validationMessage: '', addEventListener: (event, handler) => { handlers[event] = handler; },
    setCustomValidity(message) { this.validationMessage = message; },
    reportValidity() { return !this.validationMessage; }, checkValidity() { return !this.validationMessage; },
    change: () => handlers.change()};
}

test('damage inputs display an integer quantity and preserve the legacy one-piece default', () => {
  const f = renderSetup({lengthM: 10, date: '2026-10-22'});
  const quantityInput = f.table.innerHTML.match(/<input\b[^>]*data-f="qty"[^>]*>/)?.[0];
  assert.ok(quantityInput, 'an editable quantity input is rendered');
  assert.match(quantityInput, /type="number"/);
  assert.match(quantityInput, /value="1"/);
  assert.match(quantityInput, /min="0"/);
  assert.match(quantityInput, /step="1"/);
});

test('editing quantity and date keeps the entered values and refreshes saved calculations', () => {
  const row = {lengthM: 10, date: '2026-10-01', qty: 2};
  const qty = input('qty', '5');
  const date = input('date', '2026-10-22', 'date');
  const f = renderSetup(row, [qty, date]);
  qty.change(); date.change();
  assert.equal(row.qty, 5);
  assert.equal(row.date, '2026-10-22');
  assert.equal(f.ctx.sumDamageQty(10), 5);
  assert.equal(f.saves(), 2);
  assert.equal(f.renders(), 2);
});

test('invalid quantity edits cannot overwrite the last valid saved quantity', () => {
  for (const value of ['-1', '1.5', 'invalid', '', '9007199254740992']) {
    const row = {lengthM: 10, qty: 3};
    const qty = input('qty', value);
    const f = renderSetup(row, [qty]);
    qty.change();
    assert.equal(row.qty, 3, `quantity ${value}`);
    assert.equal(f.saves(), 0);
    assert.equal(f.renders(), 0);
  }
});
