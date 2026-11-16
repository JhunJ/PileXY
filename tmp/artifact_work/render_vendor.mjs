import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const out='D:/정헌재 선임_2025/건축_BIM/PileXY/outputs/PHC_20260916_v7';
const data=JSON.parse(await fs.readFile(out+'/업체엑셀_원본데이터.json','utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(data.source));
for(const name of ['지하주차장','101동','102동']) {
 const pic=await wb.render({sheetName:name,range:'A1:E180',scale:1.7});
 await fs.writeFile(out+'/captures/excel_'+name+'.png',new Uint8Array(await pic.arrayBuffer()));
 console.log('RENDERED',name);
}
