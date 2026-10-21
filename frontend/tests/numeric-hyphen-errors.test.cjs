const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('function buildErrorsFromCirclesAndTexts(');
const ctx = vm.createContext({
  isFoundationPfOnlyTextRecord: () => false,
  hasSameGeometryCircleWithMatchedText: () => false,
  appendSameBuildingNumberErrors() {},
  appendHyphenDongBuildingMismatchErrors() {},
});
vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), ctx);

test('loading supported building-number labels clears legacy numeric format errors', () => {
  for (const label of ['101-1', '250-1', '101–1', '101 - 1', 'TC10-1']) {
    const circles = [{ id: 'c1', matched_text_id: 't1', matched_text: { id: 't1', text: label },
      has_error: true, error_codes: ['NUMERIC_HYPHEN_FORMAT_INVALID'] }];
    const texts = [{ id: 't1', text: label, has_error: true }];
    assert.equal(ctx.buildErrorsFromCirclesAndTexts(circles, texts).length, 0);
    assert.equal(circles[0].has_error, false);
    assert.equal(circles[0].error_codes.length, 0);
    assert.equal(texts[0].has_error, false);
  }
});

test('supported labels still report missing and duplicate matches', () => {
  const texts = [{ id: 't1', text: '101-1' }];
  assert.equal(ctx.buildErrorsFromCirclesAndTexts([], texts)[0].error_type, 'TEXT_NO_MATCH');
  const circles = ['c1', 'c2'].map(id => ({ id, matched_text_id: 't1' }));
  assert.equal(ctx.buildErrorsFromCirclesAndTexts(circles, texts)[0].error_type, 'TEXT_MULTI_MATCH');
  assert.ok(circles.every(c => c.has_error));
});
