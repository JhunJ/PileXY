import sys, json, hashlib, collections
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'pydeps'))
import xlrd

source = Path(r'D:\정헌재 선임_2025\건축_BIM\현장지원\써밋클라비온_파일마스터4_261012\동별수정좌표값1009.xls')
book = xlrd.open_workbook(str(source), formatting_info=True, on_demand=True)
sheets = []
for sheet in book.sheets():
    values = [[sheet.cell_value(r,c) if sheet.cell_type(r,c) not in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK) else None for c in range(sheet.ncols)] for r in range(sheet.nrows)]
    types = [[sheet.cell_type(r,c) for c in range(sheet.ncols)] for r in range(sheet.nrows)]
    xfs = [[sheet.cell_xf_index(r,c) for c in range(sheet.ncols)] for r in range(sheet.nrows)]
    obj = dict(name=sheet.name, nrows=sheet.nrows, ncols=sheet.ncols, visibility=sheet.visibility, values=values, types=types, xfs=xfs, merged=sheet.merged_cells, gridlines=sheet.show_grid_lines,
               columns={str(k):dict(width=v.width,hidden=v.hidden,xf_index=v.xf_index) for k,v in sheet.colinfo_map.items()},
               rows={str(k):dict(height=v.height,hidden=v.hidden) for k,v in sheet.rowinfo_map.items()})
    sheets.append(obj)
    nonempty = [[r+1, [[c+1,v] for c,v in enumerate(row) if v is not None]] for r,row in enumerate(values) if any(v is not None for v in row)]
    print(json.dumps(dict(name=sheet.name, rows=sheet.nrows, cols=sheet.ncols, visibility=sheet.visibility, merged=sheet.merged_cells, top=nonempty[:9],bottom=nonempty[-4:],types=dict(collections.Counter(t for row in types for t in row))),ensure_ascii=False))
formats=[]
for xf in book.xf_list:
    font=book.font_list[xf.font_index]
    formats.append(dict(number_format=book.format_map[xf.format_key].format_str,font=dict(name=font.name,size=font.height/20,bold=font.bold,color=book.colour_map.get(font.colour_index)),alignment=dict(hor=xf.alignment.hor_align,vert=xf.alignment.vert_align,wrap=xf.alignment.text_wrapped),fill=book.colour_map.get(xf.background.pattern_colour_index)))
payload=dict(source=str(source),source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),sheets=sheets,formats=formats)
(Path(__file__).parent/'source.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print('Source extraction saved; source SHA256:',payload['source_sha256'])
