from pathlib import Path
import json,zipfile,xml.etree.ElementTree as E
import openpyxl
base=Path(r'D:\정헌재 선임_2025\건축_BIM')
out=Path('tmp/feedback_extract');out.mkdir(parents=True,exist_ok=True)
for p in (base/'현장지원').rglob('*.xlsx'):
 if '파일마스터' not in str(p) or not any(s in p.name for s in ['비교','circles']):continue
 try:w=openpyxl.load_workbook(p,data_only=True,read_only=True)
 except Exception as ex:print('UNREADABLE',str(p),str(ex));continue
 lines=[str(p)]
 for s in w:
  lines.append(f'SHEET {s.title} {s.max_row}x{s.max_column}')
  for i,row in enumerate(s.values):
   if i<18:lines.append(str(row)[:1000])
 (out/(p.stem+'.txt')).write_text('\n'.join(lines),encoding='utf-8')
 print('\n'.join(lines)[:7000])
for p in (base/'파일마스터').glob('*.pptx'):
 if not any(s in p.name for s in ['260424','260423_5']):continue
 z=zipfile.ZipFile(p);lines=[str(p)]
 for n in z.namelist():
  if n.startswith('ppt/slides/slide') and n.endswith('.xml'):
   root=E.fromstring(z.read(n));txt=' '.join(t.text or '' for t in root.iter() if t.tag.endswith('}t'));lines.append(n+' '+txt)
 (out/(p.stem+'.txt')).write_text('\n'.join(lines),encoding='utf-8');print('\n'.join(lines)[:14000])
