from pathlib import Path
from openpyxl import load_workbook
import json
root=Path(r'D:\정헌재 선임_2025\건축_BIM')
p=root/'파일마스터/청주센텀자이/현장 회신/260508 회신_260513 회신_피드백/260424 파일추가) 측량 성과표 통합3_수정3.xlsx'
w=load_workbook(p,read_only=True,data_only=True)
result={'source':str(p),'sheets':[]}
for s in w:
    rows=[]
    for i,r in enumerate(s.iter_rows(values_only=True),1):
        if len(r)>=4 and isinstance(r[2],(int,float)) and isinstance(r[3],(int,float)) and r[2]>10000 and r[3]>10000:
            rows.append({'excel_row':i,'values':[str(v) if v is not None else '' for v in r[:5]]})
    result['sheets'].append({'name':s.title,'max_row':s.max_row,'count':len(rows),'rows':rows})
result['coordinate_rows']=sum(s['count'] for s in result['sheets'])
out=Path('outputs/PHC_20260916_v7');out.mkdir(exist_ok=True)
(out/'업체엑셀_원본데이터.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='sheets'},ensure_ascii=False))
print(json.dumps([{k:v for k,v in s.items() if k!='rows'} for s in result['sheets']],ensure_ascii=False))
