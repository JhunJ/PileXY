const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function compare(oldCircles, newCircles) {
  const body = { innerHTML: '' };
  const ctx = vm.createContext({ versionCompareSummaryBody: body, escapeHtml: String });
  const helpers = source.slice(source.indexOf('function getBuildingKey('), source.indexOf('function openVersionComparePanel('));
  const start = source.indexOf('function renderVersionCompareSummary(');
  vm.runInContext(helpers + '\n' + source.slice(start, source.indexOf('\n}', start) + 2), ctx);
  const oldVersion = { circles: oldCircles };
  const newVersion = { circles: newCircles };
  const diff = ctx.buildVersionDiff(oldVersion, newVersion);
  ctx.renderVersionCompareSummary(oldVersion, newVersion, diff);
  return { html: body.innerHTML, diff };
}

const circle = (number, x, id) => ({
  id: id || undefined,
  building_name: '109동',
  center_x: x,
  center_y: 2,
  matched_text_id: String(number),
  matched_text: { text: String(number) },
});

test('same counts with an 18mm coordinate change highlight the row and show the change', () => {
  const { html } = compare([circle(249, 1)], [circle(249, 1.018)]);
  assert.match(html, /version-compare-row-diff/);
  assert.deepEqual([...html.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(m => m[1]),
    ['109동', '1', '1', '+0', '1', '1', '+0', '0', '0', '1']);
});

test('replacement with equal counts shows both removed and added entries', () => {
  const { html, diff } = compare([circle(249, 1)], [circle(250, 1)]);
  assert.match(html, /version-compare-row-diff/);
  assert.deepEqual([...html.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(m => m[1]).slice(-3), ['1', '1', '0']);
  assert.equal(diff.allItems.filter((i) => i.status === 'only-old').length, 1);
  assert.equal(diff.allItems.filter((i) => i.status === 'only-new').length, 1);
  assert.equal(diff.allItems.find((i) => i.status === 'only-old').number, '249');
  assert.equal(diff.allItems.find((i) => i.status === 'only-new').number, '250');
});

test('unchanged coordinates keep the unchanged row style', () => {
  assert.match(compare([circle(249, 1)], [circle(249, 1)]).html, /version-compare-row-same/);
});

test('same pile number matches across regenerated circle ids', () => {
  const { diff } = compare(
    [circle(200, 1, 'C12751')],
    [circle(200, 1.002, 'C9766')],
  );
  assert.equal(diff.allItems.length, 1);
  assert.equal(diff.allItems[0].status, 'coord-changed');
  assert.equal(diff.allItems[0].number, '200');
});

test('reused circle id with a different pile number is not treated as the same object', () => {
  const { diff } = compare(
    [circle(206, 1, 'C9766')],
    [circle(200, 9, 'C9766')],
  );
  assert.equal(diff.allItems.filter((i) => i.status === 'only-old').map((i) => i.number).join(','), '206');
  assert.equal(diff.allItems.filter((i) => i.status === 'only-new').map((i) => i.number).join(','), '200');
});

test('unmatched circles are not treated as removed number-coordinate pairs', () => {
  const { diff } = compare(
    [{ id: 'bare', building_name: '109동', center_x: 1, center_y: 2 }],
    [],
  );
  assert.equal(diff.allItems.length, 0);
});

test('match number falls back to texts lookup by matched_text_id', () => {
  const body = { innerHTML: '' };
  const ctx = vm.createContext({ versionCompareSummaryBody: body, escapeHtml: String });
  const helpers = source.slice(source.indexOf('function getBuildingKey('), source.indexOf('function openVersionComparePanel('));
  vm.runInContext(helpers, ctx);
  const oldVersion = {
    circles: [{ id: 'a', building_name: '101동', center_x: 1, center_y: 2, matched_text_id: 't1' }],
    texts: [{ id: 't1', text: '12' }],
  };
  const newVersion = {
    circles: [{ id: 'a', building_name: '101동', center_x: 1, center_y: 2, matched_text_id: 't1' }],
    texts: [{ id: 't1', text: '12' }],
  };
  const diff = ctx.buildVersionDiff(oldVersion, newVersion);
  assert.equal(diff.allItems[0].status, 'same');
  assert.equal(diff.allItems[0].number, '12');
});
