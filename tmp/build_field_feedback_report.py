from pathlib import Path
import json, re
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r'D:\정헌재 선임_2025\건축_BIM\PileXY')
OUT = ROOT / 'outputs' / 'PHC_20260915' / '현장피드백_v2'
DATA = json.loads((OUT / '현장피드백_집계데이터.json').read_text(encoding='utf-8'))
DOCX = OUT / '파일마스터_현장피드백_Baromi_확대보고서_6개현장_45건.docx'
FLOW_IMG = OUT / '현장피드백_워크플로우.png'

BLUE = '3182F6'; NAVY = '191F28'; GRAY = 'F2F4F6'; LINE = 'D1D6DB'; PALE = 'E8F3FF'; RED = 'F04452'; WHITE='FFFFFF'

def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); shd = tcPr.find(qn('w:shd'))
    if shd is None: shd = OxmlElement('w:shd'); tcPr.append(shd)
    shd.set(qn('w:fill'), color)

def margins(cell, top=80, start=100, bottom=80, end=100):
    tc = cell._tc; tcPr = tc.get_or_add_tcPr(); tcMar = tcPr.first_child_found_in('w:tcMar')
    if tcMar is None: tcMar = OxmlElement('w:tcMar'); tcPr.append(tcMar)
    for tag,val in [('top',top),('start',start),('bottom',bottom),('end',end)]:
        node = tcMar.find(qn(f'w:{tag}'))
        if node is None: node=OxmlElement(f'w:{tag}'); tcMar.append(node)
        node.set(qn('w:w'), str(val)); node.set(qn('w:type'),'dxa')

def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr(); rep = OxmlElement('w:tblHeader'); rep.set(qn('w:val'),'true'); trPr.append(rep)

def keep_row(row):
    trPr=row._tr.get_or_add_trPr(); cant=OxmlElement('w:cantSplit'); trPr.append(cant)

def text(cell, value, bold=False, color=NAVY, size=8.3, align=None):
    cell.text=''; p=cell.paragraphs[0]
    if align is not None: p.alignment=align
    p.paragraph_format.space_after=Pt(0); p.paragraph_format.space_before=Pt(0)
    r=p.add_run(str(value)); r.bold=bold; r.font.name='Malgun Gothic'; r._element.rPr.rFonts.set(qn('w:eastAsia'),'맑은 고딕'); r.font.size=Pt(size); r.font.color.rgb=RGBColor.from_string(color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER; margins(cell)

def heading(doc, title, kicker=None, new_page=False):
    if kicker:
        p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(3)
        r=p.add_run(kicker.upper()); r.bold=True; r.font.size=Pt(8); r.font.color.rgb=RGBColor.from_string(BLUE)
    p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(8); p.paragraph_format.keep_with_next=True; p.paragraph_format.page_break_before=new_page
    r=p.add_run(title); r.bold=True; r.font.name='Malgun Gothic'; r._element.rPr.rFonts.set(qn('w:eastAsia'),'맑은 고딕'); r.font.size=Pt(18); r.font.color.rgb=RGBColor.from_string(NAVY)

def note(doc, s):
    t=doc.add_table(rows=1, cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False; t.columns[0].width=Cm(17.2)
    c=t.cell(0,0); shade(c, PALE); text(c,s,size=8.5,color=NAVY); doc.add_paragraph().paragraph_format.space_after=Pt(1)

def add_table(doc, headers, rows, widths=None, font=8):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'; t.autofit=False
    for i,h in enumerate(headers): shade(t.rows[0].cells[i],NAVY); text(t.rows[0].cells[i],h,True,WHITE,8,WD_ALIGN_PARAGRAPH.CENTER)
    set_repeat_header(t.rows[0])
    for ri,row in enumerate(rows):
        cells=t.add_row().cells; keep_row(t.rows[-1])
        for i,v in enumerate(row):
            if ri%2: shade(cells[i], 'F8F9FA')
            text(cells[i],v,size=font,align=WD_ALIGN_PARAGRAPH.CENTER if i==0 else WD_ALIGN_PARAGRAPH.LEFT)
    if widths:
        for row in t.rows:
            for i,w in enumerate(widths): row.cells[i].width=Cm(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(2)
    return t

def build_flow_image():
    img=Image.new('RGB',(1800,470),'white'); d=ImageDraw.Draw(img)
    font_path=r'C:\Windows\Fonts\malgun.ttf'; bold_path=r'C:\Windows\Fonts\malgunbd.ttf'
    num=ImageFont.truetype(bold_path,34); label=ImageFont.truetype(bold_path,30); small=ImageFont.truetype(font_path,21)
    centers=[(220,205),(670,205),(1120,205),(1570,205)]
    items=[('01','현장 자료\n수신','도면 · 좌표 · 의견'),('02','PILEMASTER\n검토','좌표 · 번호 · 누락'),('03','오류 항목\n번호화','01 ~ 45'),('04','회신 및\n수정 추적','현장 확인 · 이력 관리')]
    for i,(cx,cy) in enumerate(centers):
        if i<3:
            d.line((cx+132,cy,centers[i+1][0]-145,cy),fill='#B0C8F5',width=14)
            d.polygon([(centers[i+1][0]-145,cy),(centers[i+1][0]-176,cy-22),(centers[i+1][0]-176,cy+22)],fill='#3182F6')
        fill='#3182F6' if i in (0,2) else '#E8F3FF'; textc='white' if i in (0,2) else '#191F28'
        d.ellipse((cx-132,cy-132,cx+132,cy+132),fill=fill,outline='#3182F6',width=5)
        n,l,sub=items[i]
        box=d.textbbox((0,0),n,font=num); d.text((cx-(box[2]-box[0])/2,cy-88),n,font=num,fill=textc)
        box=d.multiline_textbbox((0,0),l,font=label,spacing=4,align='center'); d.multiline_text((cx-(box[2]-box[0])/2,cy-28),l,font=label,fill=textc,spacing=4,align='center')
        box=d.textbbox((0,0),sub,font=small); d.text((cx-(box[2]-box[0])/2,cy+155),sub,font=small,fill='#4E5968')
    img.save(FLOW_IMG)

build_flow_image()
doc=Document(); sec=doc.sections[0]; sec.page_width=Cm(21); sec.page_height=Cm(29.7); sec.top_margin=Cm(1.5); sec.bottom_margin=Cm(1.5); sec.left_margin=Cm(1.7); sec.right_margin=Cm(1.7)
styles=doc.styles
for name in ['Normal','Title','Subtitle']:
    st=styles[name]; st.font.name='Malgun Gothic'; st._element.rPr.rFonts.set(qn('w:eastAsia'),'맑은 고딕'); st.font.color.rgb=RGBColor.from_string(NAVY)
styles['Normal'].font.size=Pt(9); styles['Normal'].paragraph_format.space_after=Pt(5); styles['Normal'].paragraph_format.line_spacing=1.12

# Header/footer
hp=sec.header.paragraphs[0]; hp.alignment=WD_ALIGN_PARAGRAPH.RIGHT
rr=hp.add_run('건축BIM팀  |  파일마스터 현장 피드백'); rr.font.name='Malgun Gothic'; rr.font.size=Pt(8); rr.font.color.rgb=RGBColor.from_string('8B95A1')
fp=sec.footer.paragraphs[0]; fp.alignment=WD_ALIGN_PARAGRAPH.CENTER
fr=fp.add_run('2026. 09. 15   ·   내부 보고용'); fr.font.name='Malgun Gothic'; fr.font.size=Pt(8); fr.font.color.rgb=RGBColor.from_string('8B95A1')

# Cover
p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(42); r=p.add_run('PILEMASTER'); r.bold=True; r.font.size=Pt(10); r.font.color.rgb=RGBColor.from_string(BLUE)
p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(10); p.paragraph_format.space_after=Pt(12)
r=p.add_run('현장 피드백\n확대 분석 보고서'); r.bold=True; r.font.size=Pt(30); r.font.name='Malgun Gothic'; r._element.rPr.rFonts.set(qn('w:eastAsia'),'맑은 고딕'); r.font.color.rgb=RGBColor.from_string(NAVY)
p=doc.add_paragraph('Baromi 대화·첨부 이미지와 현장 지원 자료를 연결한 오류 및 사용 의견 정리')
p.runs[0].font.size=Pt(12); p.runs[0].font.color.rgb=RGBColor.from_string('4E5968')
doc.add_paragraph().paragraph_format.space_after=Pt(8)
t=doc.add_table(rows=1,cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
for i,(n,l) in enumerate([('6','확인 현장'),('45','오류·이슈'),('11','근거 이미지')]):
    c=t.cell(0,i); shade(c, BLUE if i==0 else PALE); text(c,f'{n}\n{l}',True,WHITE if i==0 else NAVY,16,WD_ALIGN_PARAGRAPH.CENTER); c.width=Cm(5.6)
doc.add_paragraph().paragraph_format.space_after=Pt(150)
p=doc.add_paragraph('기준일  2026. 09. 15'); p.runs[0].bold=True; p.runs[0].font.size=Pt(10)
doc.add_page_break()

heading(doc,'한눈에 보는 결과','Executive summary')
p=doc.add_paragraph('로컬에 남은 바로미 첨부 화면과 현장 회신 파일을 현장 폴더의 산출물과 대조했다. 확인된 6개 현장에서 총 45개 오류·이슈를 식별했으며, 각 항목은 추적 가능한 고유 번호를 부여했다.')
p.runs[0].font.size=Pt(10.5)
add_table(doc,['순번','현장','기간','건수','근거'],[[i,x['site'],x['date'],x['count'],x['evidence']] for i,x in enumerate(DATA['sites'],1)],[1.3,6.0,3.1,1.3,5.3],8.3)
note(doc,'집계 기준  |  이미지에 명시된 건수 또는 비교표 1행을 1건으로 계산했다. 같은 오류를 CAD 요약과 비교표가 반복해서 보여주면 한 번만 집계했다.')
heading(doc,'오류 유형과 우선 확인 대상','Issue mix')
add_table(doc,['유형군','건수','비중','보고 해석'],[
    ['좌표 불일치','17','37.8%','시공 기준 좌표와 비교 대상 좌표의 차이'],
    ['중복(좌표·번호·원)','15','33.3%','동일 좌표 또는 번호·도형의 중복'],
    ['누락·표기','13','28.9%','도면·파일·화면의 번호 또는 위치 표기 누락'],
],[4.0,2.0,2.2,8.6],8.5)
p=doc.add_paragraph('청주푸르지오씨엘리체(17건)와 인천계양 A10BL(13건)이 전체의 66.7%를 차지한다. 우선 개선 과제는 좌표 비교 결과의 즉시 가시화, 중복 번호 자동 경고, 도면·엑셀 간 누락 확인이다.')
p.runs[0].font.size=Pt(9.5)

heading(doc,'현장 피드백 처리 흐름','Workflow')
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run().add_picture(str(FLOW_IMG),width=Cm(17.0))

evidence_desc={
 'E01':'중복 좌표 2개 그룹', 'E02':'PDAM 위치 표기 2건', 'E03':'파일 일람 표기 1건',
 'E04':'CAD 요약: 번호·좌표 누락 및 중복', 'E05':'비교표: 좌표 불일치·표시 누락',
 'E06':'CAD 요약: 번호 중복·파일 표시 없음', 'E07':'좌표 차이 비교표 10행',
 'E08':'지하주차장 1250번 부근 표시 누락', 'E09':'번호 누락 및 476·477 중첩',
 'E10':'엑셀 476번의 도면 누락', 'E11':'도면 원(Circle) 중복 5건'
}
site_images={'CJ':['E01','E02','E03'],'CC':['E04','E05'],'IC':['E06','E07'],'CU':['E08'],'GA':['E09','E10'],'SC':['E11']}
ev_map={re.match(r'(E\d\d)',x).group(1):OUT/'근거이미지'/x for x in DATA['evidence_files']}

serial_map = {x['id']: f'{i:02d}' for i, x in enumerate(DATA['findings'], 1)}
for site in DATA['sites']:
    code=site['code']
    heading(doc,site['site'],f"{site['count']} findings",new_page=True)
    p=doc.add_paragraph(site['basis']); p.runs[0].bold=True; p.runs[0].font.size=Pt(10); p.runs[0].font.color.rgb=RGBColor.from_string(BLUE)
    rows=[]
    for x in [q for q in DATA['findings'] if q['id'].startswith(code+'-')]:
        rows.append([serial_map[x['id']],x['category'],x['location'],x['detail'],x['evidence']])
    add_table(doc,['번호','유형','위치/대상','확인 내용','근거'],rows,[1.5,2.3,4.6,7.2,1.2],7.4)
    for idx,eid in enumerate(site_images[code]):
        p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(6); p.paragraph_format.space_after=Pt(3); p.paragraph_format.keep_with_next=True
        r=p.add_run(f'{eid}  {evidence_desc[eid]}'); r.bold=True; r.font.size=Pt(9); r.font.color.rgb=RGBColor.from_string(NAVY)
        p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(ev_map[eid]), width=Cm(16.5))
        if idx < len(site_images[code])-1 and len(site_images[code])>=3: doc.add_page_break()

heading(doc,'바로미 현장 의견','Voice of field',new_page=True)
p=doc.add_paragraph('오류 목록과 함께 사용 맥락을 확인했다. 현장은 시공 누락 확인과 다음 작업 동선 계획에 도움을 받았고, 초기 숙련과 일일 작업현황의 색상 공유를 개선 요구로 제시했다.')
for x in DATA['feedback']:
    t=doc.add_table(rows=2,cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    c=t.cell(0,0); shade(c,BLUE); text(c,f"{x['site']}  ·  {x['date']}",True,WHITE,8.5)
    c=t.cell(1,0); shade(c,'F8F9FA'); text(c,f"“{x['quote']}”\n\n보고 해석  |  {x['meaning']}",False,NAVY,9)
    doc.add_paragraph().paragraph_format.space_after=Pt(2)

doc.save(DOCX)
print(DOCX)
