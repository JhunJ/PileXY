const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// Execute production functions without booting the page or duplicating their logic.
function loadFunction(context, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const end = source.indexOf('\n}', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const square = (offset) => [{ x: offset, y: 0 }, { x: offset + 1, y: 0 }, { x: offset + 1, y: 1 }, { x: offset, y: 1 }];

function placementContext() {
  const context = vm.createContext({ resolveBuildingOutlineKind: (area) => area.kind });
  loadFunction(context, 'pointInPolygon');
  loadFunction(context, 'resolveManualPilePlacement');
  return context;
}
const referencePiles = [
  { id: 'a', center_x: 200000, center_y: 500000, diameter: 0.6 },
  { id: 'b', center_x: 200010, center_y: 500010, diameter: 0.8 },
];
test('three inputs infer nearby diameter and containing area with tower/building/parking priority', () => {
  const context = placementContext();
  const vertices = [{ x: 199999, y: 499999 }, { x: 200020, y: 499999 }, { x: 200020, y: 500020 }, { x: 199999, y: 500020 }];
  const areas = ['parking', 'building', 'tower_crane'].map((kind) => ({ kind, name: kind, vertices }));
  const result = context.resolveManualPilePlacement({ number: '15', x: 500009, y: 200009 }, referencePiles, areas);
  assert.equal(result.swapped, false);
  assert.equal(result.diameter, 0.8);
  assert.equal(result.buildingName, 'tower_crane');
  assert.equal(result.z, 0);
});
test('clearly reversed civil coordinates are swapped before placement', () => {
  const context = placementContext();
  const result = context.resolveManualPilePlacement({ x: 200001, y: 500001 }, referencePiles, []);
  assert.equal(result.swapped, true);
  assert.equal(result.x, 500001);
  assert.equal(result.y, 200001);
  assert.equal(result.diameter, 0.6);
  assert.equal(result.buildingName, null);
});
test('ambiguous or distant coordinates are not silently swapped', () => {
  const context = placementContext();
  const symmetric = [{ center_x: 100, center_y: 101, diameter: 0.6 }];
  assert.equal(context.resolveManualPilePlacement({ x: 100, y: 101 }, symmetric, []).swapped, false);
  assert.equal(context.resolveManualPilePlacement({ x: 900000, y: 800000 }, referencePiles, []).swapped, false);
  assert.throws(() => context.resolveManualPilePlacement({ x: 1, y: 2 }, [], []), /먼저 불러오세요/);
});

test('manual pile maps civil axes, preserves precision, and creates a reciprocal manual match', () => {
  const context = vm.createContext({});
  loadFunction(context, 'buildManualPileRecords');
  const { circle, text } = context.buildManualPileRecords({ number: 'T4-1', x: '123.456789', y: '-456.789123', z: '0', diameter: '0.6', buildingName: 'T4' }, [], [], 'test');
  assert.equal(circle.center_x, -456.789123);
  assert.equal(circle.center_y, 123.456789);
  assert.equal(circle.radius, 0.3);
  assert.equal(circle.manual_match, true);
  assert.equal(circle.matched_text_id, text.id);
  assert.equal(text.matched_circle_ids[0], circle.id);
  assert.equal(circle.building_name, 'T4');
  assert.deepEqual(plain(circle), JSON.parse(JSON.stringify(circle)));
});

test('invalid and duplicate coordinate input cannot create a pile', () => {
  const context = vm.createContext({});
  loadFunction(context, 'buildManualPileRecords');
  const input = { number: '12', x: '0', y: '0', z: '0', diameter: '0.6' };
  for (const patch of [{ x: '' }, { y: 'Infinity' }, { diameter: '-1' }, { number: '<img>' }, { number: '0' }]) {
    assert.throws(() => context.buildManualPileRecords({ ...input, ...patch }, [], [], 'test'));
  }
  assert.throws(() => context.buildManualPileRecords(input, [{ center_x: 0, center_y: 0 }], [], 'test'), /같은 좌표/);
});

function areaContext() {
  const context = vm.createContext({
    state: { buildings: [] }, AREA_KIND_BUILDING: 'building', AREA_KIND_PARKING: 'parking', AREA_KIND_TOWER_CRANE: 'tower_crane',
    normalizeAreaKind: (kind) => kind,
    resolveBuildingOutlineKind: (area) => area.kind,
    isSlotAreaKind: (kind) => kind !== 'building',
    getAreaNames: (kind) => [kind + '0', kind + '1', kind + '2'],
    getDefaultAreaName: (kind, index) => kind + index,
    normalizeParkingAreaName: (name) => name,
    normalizeTowerAreaName: (name) => name,
    parsePastedLevelToken: (value) => value == null ? null : Number(value),
    syncPendingNamesWithBuildings() {}, renderPendingNameEditor() {}, renderBuildingTabs() {}, populateBuildingSelect() {}, requestRedraw() {},
  });
  for (const name of ['normalizeAreaDefinitions', 'getAreasByKind', 'getAreaSlot', 'setAreasByKind', 'serializeBuildingDefinitions', 'upsertAreaPolygonByOrder']) loadFunction(context, name);
  return context;
}

for (const kind of ['building', 'parking', 'tower_crane']) {
  test(`${kind}: reverse creation and editing preserve other outlines and elevations, including save/load`, () => {
    const context = areaContext();
    context.state.buildings.push({ kind: kind === 'parking' ? 'tower_crane' : 'parking', slot: 0, name: 'other', vertices: square(100) });
    for (const order of [2, 0, 1]) context.upsertAreaPolygonByOrder(kind, order, square(order * 10));
    let areas = context.getAreasByKind(kind);
    assert.equal(areas.length, 3);
    for (const order of [0, 1, 2]) assert.deepEqual(plain(areas.find((row) => row.building.slot === order).building.vertices), square(order * 10));
    areas.find((row) => row.building.slot === 1).building.drilling_start_elevation = 7.5;
    context.state.buildings = context.normalizeAreaDefinitions(plain(context.serializeBuildingDefinitions()));
    context.upsertAreaPolygonByOrder(kind, 1, square(50));
    areas = context.getAreasByKind(kind);
    assert.equal(areas.length, 3);
    assert.equal(areas.find((row) => row.building.slot === 1).building.drilling_start_elevation, 7.5);
    assert.deepEqual(plain(areas.find((row) => row.building.slot === 2).building.vertices), square(20));
    assert.deepEqual(plain(context.state.buildings.find((area) => area.name === 'other').vertices), square(100));
  });
}

test('uncreated building rows survive serialization before creating earlier rows', () => {
  const context = areaContext();
  context.upsertAreaPolygonByOrder('building', 2, square(20));
  context.state.buildings = context.normalizeAreaDefinitions(plain(context.serializeBuildingDefinitions()));
  context.upsertAreaPolygonByOrder('building', 0, square(0));
  assert.equal(context.state.buildings.length, 3);
  assert.deepEqual(plain(context.state.buildings[2].vertices), square(20));
});

test('legacy null slots fall back to their original order', () => {
  const context = areaContext();
  assert.equal(context.getAreaSlot({ building: { slot: null } }, 2), 2);
  assert.equal(context.normalizeAreaDefinitions([{ kind: 'parking', slot: null, vertices: square(0) }])[0].slot, undefined);
});

test('deleting a selected pile removes source/filter data and per-pile values without touching other piles', () => {
  const state = {
    manualSelection: { circleId: 'manual-circle-a' },
    circles: [
      { id: 'manual-circle-a', matched_text_id: 'shared', matched_text: { id: 'shared', text: '1' } },
      { id: 'b', matched_text_id: 'shared' },
    ],
    texts: [{ id: 'manual-text-a', matched_circle_ids: [] }, { id: 'shared', matched_circle_ids: ['manual-circle-a', 'b'] }],
    manualOverrides: { 'manual-circle-a': 'shared', b: 'shared' },
    foundationThicknessByPileId: { 'manual-circle-a': 600, b: 800 },
    foundationPitOffsetByPileId: { 'manual-circle-a': 1 },
    drillingStartByPileId: { 'manual-circle-a': 2 },
    foundationTopByPileId: { 'manual-circle-a': 3 },
    matchCorrections: [{ circle_id: 'manual-circle-a' }, { circle_id: 'b' }],
  };
  state.sourceCircles = structuredClone(state.circles);
  state.sourceTexts = structuredClone(state.texts);
  state.circleMap = new Map(state.circles.map((circle) => [circle.id, circle]));
  const context = vm.createContext({ state, document: { getElementById: () => ({ classList: { remove() {} } }) },
    resetManualSelection() { state.manualSelection = { circleId: '', textId: '' }; },
    buildErrorsFromCirclesAndTexts: () => [], countMatchableTexts: (texts) => texts.length,
  });
  for (const name of ['refreshMatchDerivedUIState', 'updateSummaryCards', 'updateCircleTable', 'updateDuplicatesTable', 'updateErrorsTable', 'renderBuildingTabs', 'renderMatchCorrectionsPanel', 'updateCanvasSearchAvailability', 'syncMeissaCompareBtnEnabled', 'notifyWorkContextChanged', 'requestRedraw']) context[name] = () => {};
  loadFunction(context, 'removePileFromDataset');
  loadFunction(context, 'handleDeleteSelectedPile');
  context.handleDeleteSelectedPile();
  assert.deepEqual(plain(state.sourceCircles).map((circle) => circle.id), ['b']);
  assert.deepEqual(plain(state.texts), [{ id: 'shared', matched_circle_ids: ['b'] }]);
  assert.deepEqual(plain(state.sourceTexts), plain(state.texts));
  assert.deepEqual(state.foundationThicknessByPileId, { b: 800 });
  assert.deepEqual(state.manualOverrides, { b: 'shared' });
  assert.equal(state.circleMap.has('manual-circle-a'), false);
  assert.deepEqual(plain(state.matchCorrections), [{ circle_id: 'b' }]);
  state.manualSelection.circleId = 'b';
  context.handleDeleteSelectedPile();
  assert.equal(state.sourceCircles.length, 0);
  assert.equal(state.sourceTexts.length, 0);
  assert.equal(state.texts.length, 0);
  assert.equal(state.summary.total_circles, 0);
  assert.equal(state.summary.matched_pairs, 0);
});

test('an intentionally empty source snapshot never reloads deleted coordinates from the saved work', async () => {
  const context = vm.createContext({ state: { sourceCircles: [], sourceTexts: [], loadedWorkId: 'saved' }, fetch() { throw new Error('must not fetch deleted data'); } });
  loadFunction(context, 'resolveCirclesTextsForFilterApply');
  assert.deepEqual(plain(await context.resolveCirclesTextsForFilterApply()), { circles: [], texts: [] });
});

test('rejected outline validation leaves both the pile data and selected building unchanged', async () => {
  const state = { circles: referencePiles, texts: [], buildings: [{ kind: 'building', name: '101동', vertices: square(0) }], filter: {} };
  const before = JSON.stringify(state);
  const elements = Object.fromEntries(Object.entries({ number: '15', x: '500002', y: '200002', building: '0' })
    .map(([key, value]) => [`manual-pile-${key}`, { value }]));
  elements['manual-pile-status'] = { classList: { remove() {}, add() {} } };
  const submit = { disabled: false };
  const context = placementContext();
  Object.assign(context, { state, AREA_KIND_BUILDING: 'building', API_BASE_URL: '',
    document: { getElementById: (id) => elements[id], querySelector: () => submit },
    crypto: { randomUUID: () => 'test' }, getSameBuildingNumberGroupKey: () => null,
    fetch: async () => ({ ok: false, json: async () => ({ detail: '기존 좌표에 영향이 있어 중단합니다.' }) }),
  });
  loadFunction(context, 'buildManualPileRecords');
  loadFunction(context, 'handleAddManualPile');
  await context.handleAddManualPile({ preventDefault() {} });
  assert.equal(JSON.stringify(state), before);
  assert.match(elements['manual-pile-status'].textContent, /영향/);
  assert.equal(submit.disabled, false);
});
