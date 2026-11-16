from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
from openpyxl import load_workbook

root=Path(__file__).parent
source=json.loads((root/'source.json').read_text(encoding='utf-8'))
validation=json.loads((root/'build_validation.json').read_text(encoding='utf-8'))
output=Path(validation['outputPath'])
workbook=load_workbook(output,read_only=True,data_only=False)
assert workbook.sheetnames==[s['name'].strip() for s in source['sheets']]
totals=[]
for source_sheet in source['sheets']:
    sheet=workbook[source_sheet['name'].strip()]
    expected=set()
    for row in source_sheet['values'][1:]:
        for c in (0,4,8):
            if row[c] is not None:
                expected.add((int(row[c]),row[c+1],row[c+2]))
    values=list(sheet.iter_rows(values_only=True))
    assert values[0]==('번호','X','Y'), (sheet.title,values[0])
    actual=values[1:]
    assert all(len(row)==3 for row in values)
    assert len(actual)==len(expected)
    assert set(actual)==expected
    assert actual==sorted(expected)
    assert all(isinstance(v,(int,float)) for row in actual for v in row)
    assert all(c.data_type=='n' for row in sheet.iter_rows(min_row=2) for c in row)
    totals.append(dict(sheet=sheet.title,count=len(actual),first=actual[0],last=actual[-1]))
workbook.close()
assert sum(t['count'] for t in totals)==1491
assert hashlib.sha256(Path(source['source']).read_bytes()).hexdigest()==source['source_sha256']
report=dict(output=str(output),originalUnchanged=True,total=1491,sheets=totals)
(root/'saved_file_validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))

previews=[(r['sheet'].strip(),Image.open(r['preview']).convert('RGB')) for r in validation['results']]
w=max(im.width for _,im in previews)+24
h=max(im.height for _,im in previews)+50
contact=Image.new('RGB',(w*4,h*2),'#eeeeee')
d=ImageDraw.Draw(contact)
font=ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf',20)
for i,(name,im) in enumerate(previews):
    x=(i%4)*w+12;y=(i//4)*h+12
    d.text((x,y),name,font=font,fill='black')
    contact.paste(im,(x,y+32))
contact.save(root/'all_sheets_preview.png')
