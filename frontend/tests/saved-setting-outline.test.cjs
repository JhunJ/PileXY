const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('function countSettingOutlineVertices(');
const end = source.indexOf('function readLocalSavedSetting(');
const ctx = vm.createContext({});
vm.runInContext(source.slice(start, end), ctx);

test('outline vertex count ignores name-only buildings', () => {
  assert.equal(ctx.countSettingOutlineVertices({
    buildings: [{ name: '101동', vertices: [] }, { name: '102동', vertices: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }] }],
    filter: { minDiameter: 0.2 },
  }), 3);
});

test('cluster polylines count as outlines when buildings have no vertices', () => {
  assert.equal(ctx.countSettingOutlineVertices({
    buildings: [],
    clusterPolylines: [{ closed: true, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
  }), 3);
});
