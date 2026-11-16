import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = 'D:/정헌재 선임_2025/건축_BIM/PileXY';
const outDir = path.join(root, 'outputs/PHC_20260915/현장피드백_v2');
const data = JSON.parse(await fs.readFile(path.join(outDir, '현장피드백_집계데이터.json'), 'utf8'));
const wb = Workbook.create();
const blue = '#3182F6', navy = '#191F28', pale = '#E8F3FF', gray = '#F2F4F6', white = '#FFFFFF', border = '#D1D6DB';

function title(ws, text, endCol) {
  const r = ws.getRange(`A1:${endCol}2`);
  r.merge(); r.values = [[text]];
  r.format = { fill: blue, font: { name: 'Malgun Gothic', size: 20, bold: true, color: white }, verticalAlignment: 'center', horizontalAlignment: 'left' };
  r.format.rowHeight = 30;
}
function header(range) {
  range.format = { fill: navy, font: { name: 'Malgun Gothic', size: 10, bold: true, color: white }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, borders: { top: {color:border}, bottom:{color:border}, left:{color:border}, right:{color:border} } };
}
function body(range) {
  range.format = { font: { name: 'Malgun Gothic', size: 10, color: navy }, verticalAlignment: 'center', wrapText: true, borders: { top: {color:border}, bottom:{color:border}, left:{color:border}, right:{color:border} } };
}

const s = wb.worksheets.add('요약');
title(s, '파일마스터 현장 피드백 집계', 'G');
s.getRange('A4:G4').values = [['기준일','현장 수','확인 항목','집계 원칙','','','']];
header(s.getRange('A4:G4'));
s.getRange('A5:G5').values = [[data.as_of, data.site_count, data.finding_count, '이미지의 명시 건수 또는 비교표 1행=1건 / 반복 화면은 1회 집계','','','']];
body(s.getRange('A5:G5'));
s.getRange('D5:G5').merge();
s.getRange('A7:G7').values = [['순번','현장','기간','건수','비중','근거','핵심 내용']];
header(s.getRange('A7:G7'));
const sumRows = data.sites.map((x,i) => [i+1,x.site,x.date,x.count,x.count/data.finding_count,x.evidence,x.basis]);
s.getRange(`A8:G${7+sumRows.length}`).values = sumRows; body(s.getRange(`A8:G${7+sumRows.length}`));
s.getRange(`E8:E${7+sumRows.length}`).format.numberFormat = '0.0%';
s.getRange(`A${9+sumRows.length}:G${9+sumRows.length}`).values = [['유형 요약','좌표 불일치',17,'중복(좌표·번호·원)',15,'누락·표기',13]];
s.getRange(`A${9+sumRows.length}:G${9+sumRows.length}`).format = { fill:pale, font:{name:'Malgun Gothic',bold:true,color:navy}, horizontalAlignment:'center', borders:{top:{color:border},bottom:{color:border},left:{color:border},right:{color:border}} };
s.getRange('A:G').format.columnWidth = 14;
s.getRange('B:B').format.columnWidth = 25; s.getRange('C:C').format.columnWidth = 18; s.getRange('F:F').format.columnWidth = 24; s.getRange('G:G').format.columnWidth = 48;
s.freezePanes.freezeRows(7);

const f = wb.worksheets.add('오류목록_45건');
title(f, '현장별 오류·이슈 번호 목록', 'H');
f.getRange('A4:H4').values = [['번호','현장','유형','위치/대상','확인 내용','근거','확실도','비고']]; header(f.getRange('A4:H4'));
const frows = data.findings.map((x,i) => [String(i+1).padStart(2,'0'),x.site,x.category,x.location,x.detail,x.evidence,x.confidence,'']);
f.getRange(`A5:H${4+frows.length}`).values = frows; body(f.getRange(`A5:H${4+frows.length}`));
f.getRange('A:A').format.columnWidth=12; f.getRange('B:B').format.columnWidth=25; f.getRange('C:C').format.columnWidth=16; f.getRange('D:D').format.columnWidth=34; f.getRange('E:E').format.columnWidth=52; f.getRange('F:F').format.columnWidth=12; f.getRange('G:H').format.columnWidth=12;
f.freezePanes.freezeRows(4);

const fb = wb.worksheets.add('바로미_현장의견');
title(fb, '바로미 현장 의견 및 업무 의미', 'E');
fb.getRange('A4:E4').values = [['현장','일자','현장 의견','보고용 해석','근거 위치']]; header(fb.getRange('A4:E4'));
const fbrows = data.feedback.map(x => [x.site,x.date,x.quote,x.meaning,'현장 회신 TXT / Baromi 로컬 저장분']);
fb.getRange(`A5:E${4+fbrows.length}`).values=fbrows; body(fb.getRange(`A5:E${4+fbrows.length}`));
fb.getRange('A:A').format.columnWidth=25; fb.getRange('B:B').format.columnWidth=14; fb.getRange('C:C').format.columnWidth=65; fb.getRange('D:D').format.columnWidth=50; fb.getRange('E:E').format.columnWidth=34;
fb.getRange(`A5:E${4+fbrows.length}`).format.rowHeight=48;

const ev = wb.worksheets.add('근거파일');
title(ev, '근거 이미지 인덱스', 'D');
ev.getRange('A4:D4').values = [['근거번호','파일명','상대경로','설명']]; header(ev.getRange('A4:D4'));
const evrows = data.evidence_files.map((x,i)=>[`E${String(i+1).padStart(2,'0')}`,x,`근거이미지/${x}`,'오류 표시 또는 비교 결과 화면']);
ev.getRange(`A5:D${4+evrows.length}`).values=evrows; body(ev.getRange(`A5:D${4+evrows.length}`));
ev.getRange('A:A').format.columnWidth=12; ev.getRange('B:B').format.columnWidth=44; ev.getRange('C:C').format.columnWidth=60; ev.getRange('D:D').format.columnWidth=34;

wb.recalculate();
const preview = await wb.render({sheetName:'요약', range:'A1:G15', scale:1.4, format:'png'});
await fs.writeFile(path.join(outDir,'현장피드백_엑셀_미리보기.png'), new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(path.join(outDir,'파일마스터_현장별_오류집계_6개현장_45건.xlsx'));
console.log('xlsx created');
