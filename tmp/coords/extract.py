import pdfplumber, re, json
from pathlib import Path
p=pdfplumber.open(r'D:/정헌재 선임_2025/건축_BIM/현장지원/써밋클라비온_260902_파일마스터/신길10구역측량자료_서울종합측량/새 폴더/붙임2. 지번별조서.pdf')
rows={}; counts=[]
for page in p.pages:
    t=''.join(chr(ord(c)-61440) if 61440<=ord(c)<61696 else c for c in page.extract_text())
    matches=re.findall(r'(1-\d+)\s+(\d+)\s+(\d{6}\.\d{2})\s+(\d{6}\.\d{2})',t)
    assert len(matches)==len(re.findall(r'\d{6}\.\d{2}',t))//2
    counts.append(len(matches))
    for id,seq,x,y in matches:
        val=[id,float(x),float(y)]
        assert id not in rows or rows[id]==val,(id,rows.get(id),val)
        rows[id]=val
assert set(rows)=={f'1-{i}' for i in range(1,175)}
Path('tmp/coords/rows.json').write_text(json.dumps(sorted(rows.values(),key=lambda r:int(r[0].split('-')[1]))),encoding='utf-8')
print({'page_counts':counts,'total':sum(counts),'unique':len(rows),'conflicts':0})
