const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../materials.js'),'utf8');
function setup(bundle={planByBuilding:{'101동':{'10':5}}}) {
  let n=0;
  const ctx=vm.createContext({bundle,rid:()=>`row-${++n}`,buildingNames:()=>['101동'],LENS:[5,10,15],
    getJoinLengthRows:()=>[{key:'J20',totalM:20,seg1M:10,seg2M:10}]});
  for(const name of ['ensurePlanRows','planRows','addPlanRow','movePlanRow','removePlanRow','sortPlanRows',
    'joinSegments','planTotalLen','planTotalLenSplitForSummary','cementPlanWeightedMeter','cementTonEstimatesForMeter','cementEstimatesPair']) {
    const a=source.indexOf(`  function ${name}(`);vm.runInContext(source.slice(a,source.indexOf('\n  }',a)+4),ctx);
  }
  return ctx;
}
test('legacy plans including names absent from the drawing migrate without loss',()=>{
  const ctx=setup({planByBuilding:{'101동':{'10':5},'이전 구역':{'10':3}}});
  assert.equal(ctx.planRows().length,2);assert.equal(ctx.planTotalLen('10'),8);
  ctx.removePlanRow('101동');assert.equal(ctx.planRows().length,1);
  ctx.removePlanRow('이전 구역');assert.equal(ctx.planRows().length,0);
  assert.equal(ctx.planTotalLen('10'),0);
});
test('same-name rows have independent values and propagate through joined lengths and cement',()=>{
  const ctx=setup();const a=ctx.addPlanRow('101동');const b=ctx.addPlanRow('101동',a.id);
  assert.notEqual(a.id,b.id);
  ctx.bundle.planByBuilding[a.id]={'10':2,J20:3};ctx.bundle.planByBuilding[b.id]={'10':4};
  assert.equal(ctx.planTotalLen('10'),11);assert.equal(ctx.planTotalLenSplitForSummary(10),17);
  assert.equal(ctx.cementPlanWeightedMeter(),170);
  assert.equal(ctx.cementEstimatesPair().tonPerMPhi,170*.064);
  a.label='105동(1)';ctx.movePlanRow(a.id,0);
  assert.equal(ctx.planTotalLen('10'),11);
  ctx.removePlanRow(a.id);assert.equal(ctx.planTotalLen('10'),9);assert.equal(ctx.cementPlanWeightedMeter(),90);
  const restored=setup(JSON.parse(JSON.stringify(ctx.bundle)));
  assert.equal(restored.planRows().length,2);assert.equal(restored.planTotalLen('10'),9);
});
test('natural sorting and manual positions preserve row quantities',()=>{
  const ctx=setup({planByBuilding:{},planRows:[]});
  for(const name of ['T10','105동(2)','T2','105동(1)','반력말뚝'])ctx.addPlanRow(name);
  ctx.sortPlanRows('number');assert.equal(ctx.planRows().map(r=>r.label).join(','),'105동(1),105동(2),T2,T10,반력말뚝');
  ctx.sortPlanRows('english');assert.equal(ctx.planRows()[0].label,'T2');
  const id=ctx.planRows()[4].id;ctx.movePlanRow(id,0);assert.equal(ctx.planRows()[0].label,'반력말뚝');
});

test('queued saves preserve newer row edits and keep the captured project',async()=>{
  const sent=[];const pending=[];
  const ctx=vm.createContext({bundle:{planRows:[{id:'a',label:'before'}]},lastMaterialsPc:null,
    projectContext:()=> 'project A',apiBase:()=>'/test',document:{getElementById:()=>null},console,
    fetch:async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>pending.push(resolve));}});
  vm.runInContext('let materialsSaveChain = Promise.resolve();',ctx);
  for(const name of ['persistNow','persistMaterialsSnapshot']) {
    const prefix=name==='persistMaterialsSnapshot'?'  async function ':'  function ';
    const a=source.indexOf(prefix+name+'(');vm.runInContext(source.slice(a,source.indexOf('\n  }',a)+4),ctx);
  }
  const first=ctx.persistNow();await Promise.resolve();
  ctx.bundle.planRows[0].label='after';const second=ctx.persistNow();
  assert.equal(sent.length,1);
  pending.shift()({ok:true,json:async()=>({...sent[0].body,meta:{saved:true}})});
  await first;await Promise.resolve();
  assert.equal(ctx.bundle.planRows[0].label,'after');
  assert.equal(sent.length,2);assert.equal(sent[1].body.planRows[0].label,'after');
  pending.shift()({ok:true,json:async()=>({...sent[1].body,meta:{saved:true}})});
  await second;
  assert.ok(sent.every(x=>x.url.includes('project%20A')));
});


test('editing quantities refreshes dependent views and cement estimates without replacing inputs',()=>{
  const ctx=setup(); const elements=new Map();let summary=0,hint=0;
  ctx.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},querySelector:()=>null};
  ctx.renderSummary=()=>summary++;ctx.renderTruckHint=()=>hint++;ctx.cementIntakeTfTotal=()=>1;
  const a=source.indexOf('  function refreshPlanCalculationViews(');
  vm.runInContext(source.slice(a,source.indexOf('\n  }',a)+4),ctx);
  ctx.bundle.planByBuilding['101동']['10']=20;
  ctx.refreshPlanCalculationViews();
  assert.equal(elements.get('materials-cement-plan-meter').textContent,'200.00');
  assert.equal(elements.get('materials-cement-plan-req').textContent,'12.800');
  assert.equal(elements.get('materials-cement-plan-unordered').textContent,'11.800');
  delete ctx.bundle.planByBuilding['101동']['10'];ctx.refreshPlanCalculationViews();
  assert.equal(elements.get('materials-cement-plan-req').textContent,'0.000');
  assert.equal(elements.get('materials-cement-plan-unordered').textContent,'0.000');
  assert.equal(summary,2);assert.equal(hint,2);
});
