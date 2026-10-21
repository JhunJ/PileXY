const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  let i = source.indexOf('{', start);
  let depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

for (const kind of ['building', 'parking', 'tower_crane']) {
  test(`${kind} applies the loaded drawing filter with its own coordinates`, async () => {
    let sent, synced = false;
    const circles = [{id:'C1', center_x:1.018, center_y:2, radius:.2}];
    const ctx = vm.createContext({
      state: {
        drawingRevision:1,
        loadedWorkId: 'work-1',
        circles,
        texts:[],
        buildings:[{kind, vertices:[{}, {}, {}]}],
        filter:{minDiameter:.2,maxDiameter:.55,textHeightMin:.2,textHeightMax:.5,maxMatchDistance:2},
        clusterPolylines: [],
        rawPolylines: [],
      },
      ensureDrawingReadyForSave:()=>true, normalizeAreaKind:x=>x,
      flushDrillingInputsFromDom(){}, flushFoundationTopInputsFromDom(){}, ensureBuildingsInitialized(){},
      AREA_KIND_BUILDING:'building', AREA_KIND_PARKING:'parking', AREA_KIND_TOWER_CRANE:'tower_crane',
      applyParkingsBtn:{}, applyTowerCranesBtn:{}, applyBuildingsBtn:{},
      serializeBuildingDefinitions:x=>x, computeManualOverridesForSave:()=>({}), API_BASE_URL:'',
      setUploadStatus(){}, parseErrorMessage:e=>e.message, console,
      resolveCirclesTextsForFilterApply: async () => ({ circles, texts: [] }),
      requestRedraw(){},
      syncPendingNamesWithBuildings(){}, renderBuildingTabs(){}, populateBuildingSelect(){},
      fetch:async (_, options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({circles})};},
      handlePayload(data){assert.equal(data.circles, circles);},
      syncCurrentWorkToServer:async()=>{synced=true;return true;},
    });
    vm.runInContext(extractFunction('applyAreaDefinitions'), ctx);
    await ctx.applyAreaDefinitions(kind);
    assert.deepEqual(sent.filter,{min_diameter:.2,max_diameter:.55,text_height_min:.2,
      text_height_max:.5,max_match_distance:2,text_reference_point:'center'});
    assert.equal(sent.circles[0].center_x,1.018);
    assert.equal(synced,true);
  });
}
