import json, collections, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
data = json.loads((root/'source.json').read_text(encoding='utf-8'))
result=[]
for sheet in data['sheets']:
    points={}
    locations=collections.defaultdict(list)
    duplicates=0
    for c in (0,4,8):
        for r in range(1,sheet['nrows']):
            row=sheet['values'][r]
            record=row[c:c+3]
            if all(v is None for v in record):
                continue
            if len(record)!=3 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in record):
                raise ValueError((sheet['name'],r+1,c+1,'Invalid/incomplete record',record))
            number,x,y=record
            if number!=int(number) or number<=0:
                raise ValueError(('Invalid identifier',sheet['name'],record))
            number=int(number)
            if number in points:
                if points[number]['values'] != [number,x,y]:
                    raise ValueError(('Conflicting coordinates',sheet['name'],number,points[number]['values'],record))
                duplicates+=1
            else:
                points[number]=dict(values=[number,x,y],xfs=sheet['xfs'][r][c:c+3],source_row=r+1,source_col=c+1)
            locations[number].append([r+1,c+1])
    numbers=sorted(points)
    missing=sorted(set(range(1,max(numbers)+1))-set(numbers))
    if missing:
        raise ValueError(('Missing identifiers',sheet['name'],missing))
    item=dict(name=sheet['name'],points=[points[k] for k in numbers],duplicate_count=duplicates,source_count=sum(map(len,locations.values())),gridlines=sheet['gridlines'])
    result.append(item)
    print(json.dumps(dict(sheet=sheet['name'],unique=len(points),duplicates=duplicates,range=[min(numbers),max(numbers)],blank_rows=sum(all(v is None for v in row) for row in sheet['values'])),ensure_ascii=False))
payload=dict(source=data['source'],source_sha256=data['source_sha256'],sheets=result,formats=data['formats'])
(root/'normalized.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')

# Source preview only: render the existing XLS grid without opening Excel.
sheet=data['sheets'][0]
widths=[145,150,150,20,145,150,150,20,145,150,150]
top=42; heights=[54]+[28]*13
img=Image.new('RGB',(sum(widths)+48,top+sum(heights)+20),'white')
d=ImageDraw.Draw(img)
font=ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf',16)
bold=ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf',16)
d.text((22,10),sheet['name'].strip()+'  원본 A1:K14',font=bold,fill='black')
y=top
for r,h in enumerate(heights):
    x=22
    for c,w in enumerate(widths):
        v=sheet['values'][r][c]
        fmt=data['formats'][sheet['xfs'][r][c]]
        fill=tuple(fmt['fill']) if fmt['fill'] else 'white'
        d.rectangle((x,y,x+w,y+h),fill=fill,outline='#cfcfcf')
        if v is not None:
            text=v.strip() if isinstance(v,str) else str(int(v)) if c in (0,4,8) else f'{v:.4f}'
            f=bold if fmt['font']['bold'] else font
            bb=d.multiline_textbbox((0,0),text,font=f)
            tx=x+(w-(bb[2]-bb[0]))/2
            ty=y+(h-(bb[3]-bb[1]))/2-3
            d.multiline_text((tx,ty),text,font=f,fill=tuple(fmt['font']['color'] or [0,0,0]),align='center')
        x+=w
    y+=h
img.save(root/'source_preview.png')
print('Total unique:',sum(len(s['points']) for s in result),'Total identical duplicates:',sum(s['duplicate_count'] for s in result))
