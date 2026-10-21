const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../materials.js'),'utf8');
function setup(){
 const ctx=vm.createContext({LENS_MAX_SINGLE_M:15,LENS:[5,6,7,8,9,10,11,12,13,14,15],bundle:{joinLengthSpecs:[],planRows:[{id:'a',label:'A'}],planByBuilding:{a:{J34:2}},receipts:[{qtyByLength:{J34:3}}]},buildingNames:()=>[],inFilterRange:()=>true,sumReceiptQty:()=>0,usedFromPdamLength:k=>k==='J34'?4:0});
 for(const name of ['defaultJoinLengthSpecsFromLegacy','suggestedJoinSpec','joinSegments','normalizeJoinSpec','validateJoinInputs','ensureJoinLengthSpecs','getJoinLengthRows','ensurePlanRows','planRows','planTotalLen','planTotalLenSplitForSummary','sumReceiptQtySplitForSummary','usedFromPdamLengthSplitForSummary','cementPlanWeightedMeter']){
  const a=source.indexOf('  function '+name+'(');vm.runInContext(source.slice(a,source.indexOf('\n  }',a)+4),ctx);
 }return ctx;
}
test('34m three-segment specs survive reload and count repeated segment lengths in plan, receipt and usage',()=>{
 const c=setup();c.bundle.joinLengthSpecs=[c.normalizeJoinSpec({totalM:34,seg1M:12,seg2M:11,seg3M:11})];
 c.bundle=JSON.parse(JSON.stringify(c.bundle));c.ensureJoinLengthSpecs(c.bundle);
 assert.equal(c.getJoinLengthRows()[0].label,'12+11+11');assert.equal(c.planTotalLenSplitForSummary(11),4);assert.equal(c.planTotalLenSplitForSummary(12),2);
 assert.equal(c.sumReceiptQtySplitForSummary(11),6);assert.equal(c.usedFromPdamLengthSplitForSummary(11),8);assert.equal(c.cementPlanWeightedMeter(),68);
});
test('two/three segments validate exact sums without silently changing entered lengths',()=>{
 const c=setup();assert.equal(c.normalizeJoinSpec({totalM:34,seg1M:15,seg2M:19}),null);
 assert.equal(c.normalizeJoinSpec({totalM:34,seg1M:12,seg2M:11,seg3M:10}),null);
 assert.ok(c.validateJoinInputs(34,2,[15,19]));assert.ok(c.validateJoinInputs(34,3,[12,11,10]));
 assert.equal(c.validateJoinInputs(34,3,[12,11,11]),'');assert.ok(c.normalizeJoinSpec({totalM:25,seg1M:10,seg2M:15}));
 for(let m=16;m<=34;m++){const s=c.suggestedJoinSpec(m);assert.ok(c.normalizeJoinSpec(s));assert.equal(c.joinSegments(s).reduce((a,b)=>a+b,0),m);}
 assert.equal(c.suggestedJoinSpec(34,2),null);assert.ok(c.suggestedJoinSpec(25,3));
});
