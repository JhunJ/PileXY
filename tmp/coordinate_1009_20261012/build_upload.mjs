import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
process.on('uncaughtException',error=>{console.error(error.message);process.exitCode=1;});

const root = path.dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(await fs.readFile(path.join(root,'normalized.json'),'utf8'));
const outputDir = 'D:/정헌재 선임_2025/건축_BIM/PileXY/outputs/coordinate_1009_20261012_c11d';
const outputPath = path.join(outputDir,'동별수정좌표값1009_파일마스터업로드용.xlsx');
await fs.mkdir(outputDir,{recursive:true});
const workbook = Workbook.create();
for (const source of input.sheets) {
  const sheet = workbook.worksheets.add(source.name.trim());
  const n = source.points.length + 1;
  sheet.getRange(`A1:C${n}`).values = [['번호','X','Y'], ...source.points.map(p=>p.values)];
  sheet.showGridLines = Boolean(source.gridlines);
  const range = sheet.getRange(`A1:C${n}`);
  range.format.font = {name:'맑은 고딕',size:11,color:'#000000'};
  range.format.horizontalAlignment = 'center';
  range.format.verticalAlignment = 'center';
  range.format.rowHeight = 16.5;
  range.format.wrapText = false;
  sheet.getRange(`A1:A${n}`).format.columnWidth = 19.625;
  sheet.getRange(`B1:C${n}`).format.columnWidth = 18;
  sheet.getRange('A1:C1').format.font = {name:'맑은 고딕',size:12,bold:true,color:'#000000'};
  sheet.getRange('A1:C1').format.rowHeight = 25;
  sheet.getRange(`A2:A${n}`).setNumberFormat('0');
  sheet.getRange(`B2:C${n}`).setNumberFormat('0.0000');
  sheet.freezePanes.freezeRows(1);
}
workbook.recalculate();
const results=[];
for (const source of input.sheets) {
  const sheet = workbook.worksheets.getItem(source.name.trim());
  const n = source.points.length + 1;
  const actual=sheet.getRange(`A2:C${n}`).values;
  const expected=source.points.map(p=>p.values);
  if (JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error(`Value mismatch: ${source.name}`);
  const formulas=sheet.getRange(`A1:C${n}`).formulas;
  if (formulas.some(row=>row.some(v=>Boolean(v)))) throw new Error(`Unexpected formula: ${source.name}`);
  const view=await workbook.inspect({kind:'table',sheetId:source.name.trim(),range:'A1:C5',include:'values,formulas',tableMaxRows:5,tableMaxCols:3,maxChars:1500});
  const preview=await workbook.render({sheetName:source.name.trim(),range:'A1:C12',scale:1.5,format:'png'});
  const previewPath=path.join(root,`preview_${source.name.trim()}.png`);
  await fs.writeFile(previewPath,new Uint8Array(await preview.arrayBuffer()));
  results.push({sheet:source.name,count:expected.length,range:`A1:C${n}`,valuesVerified:true,preview:previewPath,inspect:view.ndjson});
}
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},maxChars:2000,summary:'Final error check'});
const xlsx=await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
await fs.writeFile(path.join(root,'build_validation.json'),JSON.stringify({outputPath,results,errors:errors.ndjson},null,2));
console.log(JSON.stringify({outputPath,sheets:results.map(({sheet,count,valuesVerified})=>({sheet,count,valuesVerified})),errors:errors.ndjson}));
