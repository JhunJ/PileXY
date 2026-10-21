const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function context(circles, loose) {
  const ctx = vm.createContext({ state: { circles, filter: { excludeIdenticalGeometryDuplicates: loose } }, SAME_FILE_CIRCLE_GEOMETRY_EPS: 1e-4 });
  for (const name of ['sameFileCircleGeometry', 'sameFileCircleGeometryLoose', 'geometryMatchesCoLocatedDupPolicy', 'forEachNearbyGeometryPair', 'clusterCirclesByCoLocatedGeometryPolicy']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), ctx);
  }
  return ctx;
}
for (const loose of [false, true]) {
  test(`spatial broad phase preserves every matching pair, loose=${loose}`, () => {
    let seed = 72;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const circles = Array.from({ length: 250 }, (_, i) => ({ id: String(i), center_x: random() * 10 - 5, center_y: random() * 10 - 5, radius: .2 + random() }));
    circles.push(...[-.010001, -.01, -.009999, 0, .0001, .0002, .075].map((x, i) => ({ id: `edge${i}`, center_x: x, center_y: 0, radius: .3 })));
    const ctx = context(circles, loose);
    const expected = [], actual = [];
    for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
      if (ctx.geometryMatchesCoLocatedDupPolicy(circles[i], circles[j])) expected.push(`${i}:${j}`);
    }
    ctx.forEachNearbyGeometryPair(circles, (i, j) => {
      if (ctx.geometryMatchesCoLocatedDupPolicy(circles[i], circles[j])) actual.push(`${i}:${j}`);
    });
    assert.deepEqual(actual.sort(), expected.sort());
  });
}
module.exports = { context };
