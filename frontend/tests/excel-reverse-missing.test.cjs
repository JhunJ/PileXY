const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
test('Excel-only absence renders in the summary and missing filter, with no fictitious Excel coordinates',()=>{
  const ctx=vm.createContext({versionCompareExcelSummary:{},versionCompareExcelIssues:{},
    versionCompareExcelIssueFilter:'missing',VERSION_COMPARE_EXCEL_SEVERE_DIFF_THRESHOLD:.1,
    escapeHtml:String,formatCoordNumber:String,formatNumber:x=>x==null?'-':String(x),
    renderVersionCompareExcelSkippedPanel(){},updateVersionCompareExcelDownloadButton(){}});
  const start=source.indexOf('function renderVersionCompareExcelResult(');
  vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),ctx);
  ctx.renderVersionCompareExcelResult({summary:{missingExcel:2},issues:['466','467'].map(number=>({
    status:'missing-excel',sheetName:'101동',buildingName:'101동',number,excelX:null,excelY:null,
    newCircle:{x:472625.4239,y:211632.8889,number,distance:null}}))},{singleVersion:true});
  assert.match(ctx.versionCompareExcelSummary.innerHTML,/엑셀에 없음/);
  assert.match(ctx.versionCompareExcelSummary.innerHTML,/<strong>2<\/strong>/);
  assert.match(ctx.versionCompareExcelIssues.innerHTML,/101동 · 466/);
  assert.match(ctx.versionCompareExcelIssues.innerHTML,/101동 · 467/);
  assert.match(ctx.versionCompareExcelIssues.innerHTML,/엑셀 행 없음/);
});
