const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadFunction(context, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing production function ${name}`);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const end = source.indexOf('\n}', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}

function editorContext(overrides = {}) {
  const context = vm.createContext({ state: { filter: {} }, structuredClone,
    AREA_KIND_BUILDING: 'building', AREA_KIND_PARKING: 'parking', AREA_KIND_TOWER_CRANE: 'tower_crane',
    ...overrides });
  for (const name of [
    'normalizeAreaKind', 'resolveBuildingOutlineKind', 'getDefaultAreaName', 'resolveManualPileEditBuilding',
    'normalizePileTextHyphens', 'getMatchedTextNumber', 'parseHyphenPileText',
    'parseTowerCranePileText', 'getEffectivePileSequenceNumber',
    'getSameBuildingNumberGroupKey', 'buildManualPileEditRecords',
    'applyManualPileEditToDataset',
  ]) loadFunction(context, name);
  return context;
}

function fixture() {
  const text = {
    id: 'text-a', type: 'TEXT', text: '12', insert_x: 200001.25, insert_y: 500002.75,
    insert_z: 1.25, center_x: 200001.5, center_y: 500002.5,
    text_center_x: 200001.5, text_center_y: 500002.5, height: 0.25,
    rotation_deg: 30, layer: 'PILE_NUMBER', block_name: 'block-a',
    matched_circle_ids: ['circle-a'], has_error: false, building_name: '101동',
  };
  const circle = {
    id: 'circle-a', type: 'CIRCLE', center_x: 200000.123456, center_y: 500000.654321,
    center_z: 3.2, radius: 0.3, diameter: 0.6, area: Math.PI * 0.3 * 0.3,
    layer: 'PILE', block_name: 'block-a', transformed: true,
    matched_text: { ...text, distance: 2.3 }, matched_text_id: text.id,
    matched_text_distance: 2.3, manual_match: false,
    building_name: '101동', building_seq: 12, has_error: false, error_codes: [],
  };
  return { circle, text };
}

const geometryKeys = [
  'id', 'type', 'center_x', 'center_y', 'center_z', 'radius', 'diameter', 'area',
  'layer', 'block_name', 'transformed',
];
const editInput = {
  number: '15', buildingName: '102동', buildingNameOverride: '102동', textHeight: 0.3,
};

test('number and building edits need no coordinates and preserve the selected pile geometry', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const before = JSON.stringify({ circle, text, editInput });
  const edit = context.buildManualPileEditRecords(circle, editInput, [circle], [text], 'edit-a');
  for (const key of geometryKeys) assert.equal(edit.circle[key], circle[key], key);
  assert.equal(edit.circle.building_name, '102동');
  assert.equal(edit.circle.building_name_override, '102동');
  assert.equal(edit.circle.manual_match, true);
  assert.equal(edit.circle.matched_text.text, '15');
  assert.equal(edit.circle.matched_text_id, text.id);
  assert.equal(edit.text.id, text.id);
  assert.equal(edit.previousTextId, text.id);
  for (const key of ['insert_x', 'insert_y', 'insert_z', 'text_center_x', 'text_center_y']) {
    assert.equal(edit.text[key], text[key], key);
  }
  assert.equal(JSON.stringify({ circle, text, editInput }), before, 'builder must not mutate input data');
});

test('a shared label gets a private text without renaming another pile', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const other = { ...structuredClone(circle), id: 'circle-b', center_x: circle.center_x + 1 };
  text.matched_circle_ids.push(other.id);
  const before = JSON.stringify({ circle, text, other });
  const edit = context.buildManualPileEditRecords(circle, editInput, [circle, other], [text], 'private');
  assert.notEqual(edit.text.id, text.id);
  assert.equal(edit.previousTextId, text.id);
  assert.equal(edit.text.text, '15');
  assert.equal(edit.text.text_center_x, circle.center_x);
  assert.equal(edit.text.text_center_y, circle.center_y);
  assert.equal(edit.circle.matched_text_distance, 0);
  assert.deepEqual(plain(edit.text.matched_circle_ids), [circle.id]);
  assert.equal(JSON.stringify({ circle, text, other }), before);
});

test('a hidden manual override referencing the label also prevents an in-place rename', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const edit = context.buildManualPileEditRecords(circle, editInput, [circle], [text], 'hidden', {
    [circle.id]: text.id, 'hidden-circle': text.id,
  });
  assert.notEqual(edit.text.id, text.id);
  assert.equal(text.text, '12');
});

test('an unmatched pile receives a manual label without changing its coordinates', () => {
  const context = editorContext();
  const { circle } = fixture();
  Object.assign(circle, { matched_text: null, matched_text_id: null, matched_text_distance: null });
  const edit = context.buildManualPileEditRecords(circle, editInput, [circle], [], 'unmatched');
  assert.equal(edit.circle.id, circle.id);
  assert.equal(edit.circle.center_x, circle.center_x);
  assert.equal(edit.circle.center_y, circle.center_y);
  assert.equal(edit.circle.matched_text_id, edit.text.id);
  assert.equal(edit.circle.manual_match, true);
  assert.equal(edit.text.text, '15');
});

test('invalid numbers and same-building duplicates are rejected atomically, excluding the selected pile', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const ownInput = { ...editInput, number: '12', buildingName: '101동', buildingNameOverride: null };
  assert.doesNotThrow(() => context.buildManualPileEditRecords(circle, ownInput, [circle], [text], 'same'));
  for (const number of ['', '0', '<img>', '1'.repeat(41)]) {
    const before = JSON.stringify({ circle, text });
    assert.throws(() => context.buildManualPileEditRecords(circle, { ...editInput, number }, [circle], [text], 'invalid'));
    assert.equal(JSON.stringify({ circle, text }), before);
  }
  const other = { ...structuredClone(circle), id: 'circle-b', building_name: '102동', matched_text: { id: 'text-b', text: '15' }, matched_text_id: 'text-b' };
  const before = JSON.stringify({ circle, text, other });
  assert.throws(() => context.buildManualPileEditRecords(circle, editInput, [circle, other], [text], 'duplicate'), /이미|중복/);
  assert.equal(JSON.stringify({ circle, text, other }), before);
  other.building_name = '103동';
  assert.doesNotThrow(() => context.buildManualPileEditRecords(circle, editInput, [circle, other], [text], 'other-building'));
});

test('production tower number normalization prevents equivalent duplicate labels', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const other = { id: 'tower-other', building_name: 'T4', matched_text_id: 'tower-text', matched_text: { id: 'tower-text', text: 'TC4-01' } };
  assert.throws(() => context.buildManualPileEditRecords(circle, {
    ...editInput, number: 'T4-1', buildingName: 'T4', buildingNameOverride: 'T4',
  }, [circle, other], [text], 'tower-duplicate'), /이미|중복/);
});

test('applying an edit detaches only the selected pile from a shared label and retains source data', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const other = { ...structuredClone(circle), id: 'circle-b' };
  text.matched_circle_ids.push(other.id);
  const circles = [circle, other];
  const texts = [text];
  const sourceCircles = structuredClone(circles);
  const sourceTexts = structuredClone(texts);
  const before = JSON.stringify({ circles, texts, sourceCircles, sourceTexts });
  const edit = context.buildManualPileEditRecords(circle, editInput, circles, texts, 'applied');
  const visible = context.applyManualPileEditToDataset(edit, circle.id, circles, texts);
  const raw = context.applyManualPileEditToDataset(edit, circle.id, sourceCircles, sourceTexts);
  assert.deepEqual(plain(raw), plain(visible), 'filter source must retain exactly the same edit');
  assert.equal(visible.circles.length, 2);
  assert.equal(visible.texts.length, 2);
  assert.deepEqual(plain(visible.circles.find((item) => item.id === other.id)), other);
  assert.equal(visible.texts.find((item) => item.id === text.id).text, '12');
  assert.deepEqual(plain(visible.texts.find((item) => item.id === text.id).matched_circle_ids), [other.id]);
  assert.equal(visible.circles.find((item) => item.id === circle.id).building_name_override, '102동');
  assert.equal(visible.circles.find((item) => item.id === circle.id).matched_text_id, edit.text.id);
  assert.equal(JSON.stringify({ circles, texts, sourceCircles, sourceTexts }), before);
});

test('applying an unshared label edit replaces its canonical text instead of duplicating it', () => {
  const context = editorContext();
  const { circle, text } = fixture();
  const edit = context.buildManualPileEditRecords(circle, editInput, [circle], [text], 'reuse');
  const result = context.applyManualPileEditToDataset(edit, circle.id, [circle], [text]);
  assert.equal(result.texts.length, 1);
  assert.equal(result.texts[0].id, text.id);
  assert.equal(result.texts[0].text, '15');
  assert.deepEqual(plain(result.texts[0].matched_circle_ids), [circle.id]);
});

function uiContext({ coordinateInputs = true } = {}) {
  const { circle, text } = fixture();
  const state = {
    circles: [circle], texts: [text], sourceCircles: [structuredClone(circle)],
    sourceTexts: [structuredClone(text)], circleMap: new Map([[circle.id, circle]]),
    textMap: new Map([[text.id, text]]), buildings: [{ kind: 'building', name: '102동', vertices: [] }],
    manualSelection: { circleId: circle.id, textId: text.id }, manualPileEditCircleId: '',
    manualOverrides: {}, filter: {}, summary: {},
    matchCorrections: [{ circle_id: circle.id }, { circle_id: 'other' }],
  };
  const classes = new Set();
  const elements = Object.fromEntries([
    'title', 'coordinates', 'add-help', 'edit-help', 'new', 'number', 'building', 'status',
    ...(coordinateInputs ? ['x', 'y'] : []),
  ].map((name) => [`manual-pile-${name}`, { hidden: false, disabled: false, required: true, value: '',
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
  }]));
  const submit = { disabled: false, textContent: '파일 추가' };
  const context = editorContext({ state, document: {
    getElementById: (id) => elements[id] || null,
    querySelector: () => submit,
  }, crypto: { randomUUID: () => 'handler' }, saveWorkBtn: { disabled: true }, saveWorkUpdateBtn: { disabled: true } });
  for (const name of [
    'populateManualPileBuildingSelect', 'refreshMatchDerivedUIState', 'refreshManualPileBuildingSummary',
    'updateSummaryCards', 'updateCircleTable', 'updateDuplicatesTable', 'updateErrorsTable',
    'renderBuildingTabs', 'renderMatchCorrectionsPanel', 'updateCanvasSearchAvailability',
    'syncMeissaCompareBtnEnabled', 'updateManualSelectionDisplay', 'notifyWorkContextChanged', 'requestRedraw',
  ]) context[name] = () => {};
  loadFunction(context, 'updateManualPileEditorSelection');
  loadFunction(context, 'handleEditSelectedPile');
  loadFunction(context, 'resolveCirclesTextsForFilterApply');
  return { context, state, elements, submit, classes, circle, text };
}

test('selecting a pile removes coordinate requirements and returning to add mode restores them', () => {
  const { context, state, elements, submit } = uiContext();
  context.updateManualPileEditorSelection();
  assert.equal(elements['manual-pile-coordinates'].hidden, true);
  for (const axis of ['x', 'y']) {
    assert.equal(elements[`manual-pile-${axis}`].disabled, true);
    assert.equal(elements[`manual-pile-${axis}`].required, false);
  }
  assert.equal(elements['manual-pile-number'].value, '12');
  assert.equal(elements['manual-pile-new'].hidden, false);
  assert.match(submit.textContent, /수정/);
  elements['manual-pile-number'].value = 'typed-but-not-applied';
  context.updateManualPileEditorSelection();
  assert.equal(elements['manual-pile-number'].value, 'typed-but-not-applied', 'UI refresh must not overwrite an in-progress edit');
  state.manualSelection.circleId = '';
  context.updateManualPileEditorSelection();
  assert.equal(elements['manual-pile-coordinates'].hidden, false);
  for (const axis of ['x', 'y']) {
    assert.equal(elements[`manual-pile-${axis}`].disabled, false);
    assert.equal(elements[`manual-pile-${axis}`].required, true);
    assert.equal(elements[`manual-pile-${axis}`].value, '');
  }
  assert.equal(elements['manual-pile-number'].value, '');
  assert.equal(elements['manual-pile-new'].hidden, true);
  assert.equal(state.manualPileEditCircleId, '');
  assert.match(submit.textContent, /추가/);
});

for (const coordinateInputs of [true, false]) {
  test(`edit handler works with ${coordinateInputs ? 'empty' : 'absent'} coordinate inputs and a named building without an outline`, async () => {
    const { context, state, elements, submit, classes, circle } = uiContext({ coordinateInputs });
    const oldGeometry = Object.fromEntries(geometryKeys.map((key) => [key, circle[key]]));
    elements['manual-pile-number'].value = '15';
    elements['manual-pile-building'].value = '0';
    let prevented = false;
    await context.handleEditSelectedPile({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(classes.has('is-error'), false, elements['manual-pile-status'].textContent);
    assert.equal(state.circles[0].matched_text.text, '15');
    assert.equal(state.circles[0].building_name_override, '102동');
    for (const key of geometryKeys) assert.equal(state.circles[0][key], oldGeometry[key], key);
    assert.deepEqual(plain(state.sourceCircles), plain(state.circles));
    assert.deepEqual(plain(state.sourceTexts), plain(state.texts));
    const sourceForFilter = await context.resolveCirclesTextsForFilterApply();
    assert.equal(sourceForFilter.circles, state.sourceCircles);
    assert.equal(sourceForFilter.texts, state.sourceTexts);
    assert.equal(state.manualOverrides[circle.id], state.circles[0].matched_text_id);
    assert.equal(state.circleMap.get(circle.id), state.circles[0]);
    assert.deepEqual(plain(state.matchCorrections), [{ circle_id: 'other' }]);
    assert.equal(context.saveWorkBtn.disabled, false);
    assert.equal(context.saveWorkUpdateBtn.disabled, false);
    assert.equal(submit.disabled, false);
    assert.match(elements['manual-pile-status'].textContent, /수정|저장/);
  });
}

test('a hidden source pile with a duplicate number prevents all edit handler data changes', async () => {
  const { context, state, elements, submit, classes } = uiContext();
  state.sourceCircles.push({ ...structuredClone(state.circles[0]), id: 'hidden-pile',
    matched_text_id: 'hidden-text', matched_text: { id: 'hidden-text', text: '15' }, building_name: '102동' });
  state.sourceTexts.push({ ...structuredClone(state.texts[0]), id: 'hidden-text', text: '15', matched_circle_ids: ['hidden-pile'] });
  elements['manual-pile-number'].value = '15';
  elements['manual-pile-building'].value = '0';
  const before = JSON.stringify(state);
  await context.handleEditSelectedPile({ preventDefault() {} });
  assert.equal(JSON.stringify(state), before);
  assert.equal(classes.has('is-error'), true);
  assert.match(elements['manual-pile-status'].textContent, /이미|중복/);
  assert.equal(submit.disabled, false);
});

test('pending building assignment creates ordered name-only placeholders and preserves other area kinds', () => {
  const context = editorContext();
  const buildings = [
    { kind: 'parking', name: 'B1', slot: 0, vertices: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] },
    { kind: 'building', name: '101동', slot: 0, vertices: [] },
    { kind: 'building', name: 'T1', slot: 0, vertices: [] },
  ];
  const pendingNames = ['101동', '102동', '103동'];
  const before = JSON.stringify({ buildings, pendingNames });
  const result = context.resolveManualPileEditBuilding('pending-building:2', buildings, pendingNames);
  assert.equal(result.target.name, '103동');
  assert.equal(result.buildings.length, 5);
  assert.deepEqual(plain(result.buildings.slice(0, 3)), buildings);
  assert.deepEqual(plain(result.buildings.slice(3)), [
    { kind: 'building', slot: 1, vertices: [], name: '102동' },
    { kind: 'building', slot: 2, vertices: [], name: '103동' },
  ]);
  assert.equal(JSON.stringify({ buildings, pendingNames }), before);
});

test('an unnamed pending building uses its configured order without making an outline', () => {
  const context = editorContext();
  const result = context.resolveManualPileEditBuilding('pending-building:1', [], ['101동', '']);
  assert.equal(result.target.name, '동 2');
  assert.deepEqual(plain(result.buildings.map((item) => ({ slot: item.slot, vertices: item.vertices }))), [
    { slot: 0, vertices: [] }, { slot: 1, vertices: [] },
  ]);
});

test('the edit handler assigns a pending building on a fresh drawing without creating geometry', async () => {
  const { context, state, elements, classes } = uiContext({ coordinateInputs: false });
  state.buildings = [];
  state.pendingNames = ['101동', '102동'];
  elements['manual-pile-number'].value = '15';
  elements['manual-pile-building'].value = 'pending-building:1';
  const geometry = Object.fromEntries(geometryKeys.map((key) => [key, state.circles[0][key]]));
  await context.handleEditSelectedPile({ preventDefault() {} });
  assert.equal(classes.has('is-error'), false, elements['manual-pile-status'].textContent);
  assert.equal(state.circles[0].building_name, '102동');
  assert.equal(state.circles[0].building_name_override, '102동');
  for (const key of geometryKeys) assert.equal(state.circles[0][key], geometry[key], key);
  assert.deepEqual(plain(state.buildings), [
    { kind: 'building', slot: 0, vertices: [], name: '101동' },
    { kind: 'building', slot: 1, vertices: [], name: '102동' },
  ]);
  assert.deepEqual(plain(state.sourceCircles), plain(state.circles));
});

for (const failure of ['invalid selection', 'invalid number', 'duplicate number']) {
  test(`${failure} does not materialize pending buildings or change pile data`, async () => {
    const { context, state, elements, classes, submit } = uiContext();
    state.buildings = [];
    state.pendingNames = ['101동', '102동'];
    elements['manual-pile-building'].value = failure === 'invalid selection' ? 'pending-building:99' : 'pending-building:1';
    elements['manual-pile-number'].value = failure === 'invalid number' ? '0' : '15';
    if (failure === 'duplicate number') {
      state.sourceCircles.push({ ...structuredClone(state.circles[0]), id: 'hidden-pile', building_name: '102동',
        matched_text_id: 'hidden-text', matched_text: { id: 'hidden-text', text: '15' } });
    }
    const before = JSON.stringify(state);
    await context.handleEditSelectedPile({ preventDefault() {} });
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.buildings.length, 0);
    assert.equal(classes.has('is-error'), true);
    assert.equal(submit.disabled, false);
  });
}
