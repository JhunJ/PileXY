const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../materials.js'), 'utf8');
function paste(text, row='A', col='6', initial={}) {
  const bundle = {planByBuilding:initial};
  const ctx = vm.createContext({bundle, matrixColumnKeys:()=>['6','7','8','9'],planRows:()=>['A','B','C','D'].map(id=>({id,label:id}))});
  for (const name of ['parseExcelPastedGrid','parseMatrixPasteCell','applyExcelPasteToMatrix']) {
    const start=source.indexOf(`  function ${name}(`);
    vm.runInContext(source.slice(start,source.indexOf('\n  }',start)+4),ctx);
  }
  ctx.applyExcelPasteToMatrix({getAttribute:key=>key==='data-plan-b'?row:col},ctx.parseExcelPastedGrid(text));
  return bundle.planByBuilding;
}
test('rectangular paste preserves two rows and three columns from an offset cell',()=>{
  const result=paste('1\t2\t3\r\n4\t5\t6\r\n','B','7');
  assert.equal(result.B['7'],1);assert.equal(result.B['9'],3);
  assert.equal(result.C['7'],4);assert.equal(result.C['9'],6);
  assert.equal(result.C['6'],undefined);
});
test('vertical paste stays vertical and horizontal overflow does not wrap',()=>{
  const vertical=paste('1\n2\n3','A','8');
  assert.equal(vertical.A['8'],1);assert.equal(vertical.B['8'],2);assert.equal(vertical.C['8'],3);
  const horizontal=paste('1\t2\t3','A','9');
  assert.equal(horizontal.A['9'],1);assert.equal(horizontal.B,undefined);
});
test('leading and interior blanks retain their positions and leave existing cells unchanged',()=>{
  const result=paste('\t10\t\t20\n\t30\t\t40','A','6',{A:{'6':99,'8':88}});
  assert.equal(result.A['6'],99);assert.equal(result.A['7'],10);assert.equal(result.A['8'],88);
  assert.equal(result.A['9'],20);assert.equal(result.B['7'],30);assert.equal(result.B['9'],40);
});
