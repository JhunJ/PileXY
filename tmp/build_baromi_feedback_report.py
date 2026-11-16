from pathlib import Path
from PIL import Image
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(r"D:\정헌재 선임_2025\건축_BIM\PileXY")
OUT=ROOT/'outputs'/'PHC_20260915'/'보고용'
OUT.mkdir(parents=True,exist_ok=True)
SRC=Path(r"D:\정헌재 선임_2025\건축_BIM\파일마스터\청주센텀자이")
IMG1=SRC/'청주센텀자이 오류1.png'
IMG2=SRC/'요청'/'260413_PDAM 위치 표기 오류.png'
IMG3=SRC/'요청'/'260413_파일 일람 표기 실수.png'

# Evidence enlargements preserve source pixels and only crop/resize them.
im=Image.open(IMG1)
im.crop((0,115,1990,1065)).save(OUT/'근거1_프로그램_확대.png')
im.crop((1990,115,3840,1065)).save(OUT/'근거1_CAD_확대.png')

doc=Document()
sec=doc.sections[0]
sec.page_height,sec.page_width=Inches(11.69),Inches(8.27)
sec.top_margin=sec.bottom_margin=Inches(.68)
sec.left_margin=sec.right_margin=Inches(.72)

styles=doc.styles
for name,size,bold in [('Normal',9.5,False),('Title',25,True),('Heading 1',16,True),('Heading 2',12,True)]:
 st=styles[name];st.font.name='Pretendard';st._element.rPr.rFonts.set(qn('w:eastAsia'),'Pretendard');st.font.size=Pt(size);st.font.bold=bold;st.font.color.rgb=RGBColor(0,0,0)
styles['Normal'].paragraph_format.space_after=Pt(6)
styles['Normal'].paragraph_format.line_spacing=1.17
styles['Title'].paragraph_format.space_after=Pt(14)
# Remove the built-in Word Title bottom border so hierarchy is created by spacing only.
title_ppr=styles['Title']._element.get_or_add_pPr()
for node in list(title_ppr.findall(qn('w:pBdr'))):title_ppr.remove(node)
styles['Heading 1'].paragraph_format.space_before=Pt(4);styles['Heading 1'].paragraph_format.space_after=Pt(10)
styles['Heading 2'].paragraph_format.space_before=Pt(8);styles['Heading 2'].paragraph_format.space_after=Pt(6)

def set_cell_shade(cell,fill):
 tcPr=cell._tc.get_or_add_tcPr();shd=OxmlElement('w:shd');shd.set(qn('w:fill'),fill);tcPr.append(shd)
def margins(cell,top=110,start=120,bottom=110,end=120):
 tc=cell._tc.get_or_add_tcPr();m=tc.first_child_found_in('w:tcMar')
 if m is None:m=OxmlElement('w:tcMar');tc.append(m)
 for tag,val in [('top',top),('start',start),('bottom',bottom),('end',end)]:
  n=OxmlElement('w:'+tag);n.set(qn('w:w'),str(val));n.set(qn('w:type'),'dxa');m.append(n)
def borders(table,color='D9D9D9'):
 pr=table._tbl.tblPr;el=pr.first_child_found_in('w:tblBorders')
 if el is None:el=OxmlElement('w:tblBorders');pr.append(el)
 for edge in ('top','left','bottom','right','insideH','insideV'):
  n=OxmlElement('w:'+edge);n.set(qn('w:val'),'single');n.set(qn('w:sz'),'4');n.set(qn('w:color'),color);el.append(n)
def table(headers,rows,widths=None,font=8.5):
 t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False;borders(t)
 for j,h in enumerate(headers):
  c=t.rows[0].cells[j];set_cell_shade(c,'173B6C');margins(c);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
  p=c.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER;r=p.add_run(h);r.bold=True;r.font.color.rgb=RGBColor(255,255,255);r.font.size=Pt(8.5)
 for i,row in enumerate(rows):
  cells=t.add_row().cells
  for j,val in enumerate(row):
   c=cells[j];margins(c);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   if i%2:set_cell_shade(c,'F2F6FB')
   p=c.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER if j<2 else WD_ALIGN_PARAGRAPH.LEFT
   r=p.add_run(str(val));r.font.size=Pt(font)
 if widths:
  for row in t.rows:
   for j,w in enumerate(widths):row.cells[j].width=Inches(w)
 doc.add_paragraph().paragraph_format.space_after=Pt(1)
 return t
def add_meta(text):
 p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.RIGHT;r=p.add_run(text);r.font.size=Pt(8);r.font.color.rgb=RGBColor(98,108,122)
def caption(text):
 p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;r=p.add_run(text);r.font.size=Pt(8);r.font.color.rgb=RGBColor(93,101,112);p.paragraph_format.space_after=Pt(8)
def pb():doc.add_page_break()
def para(text,boldlead=None):
 p=doc.add_paragraph()
 if boldlead:
  r=p.add_run(boldlead);r.bold=True
 p.add_run(text)
 return p

# Cover and decision summary
add_meta('건축BIM팀  2026년 9월 15일 확인 기준')
doc.add_paragraph('PHC파일 현장 피드백 근거 보고',style='Title')
doc.add_paragraph('Baromi 대화와 현장 검토 이미지를 기준으로 오류 발견 내용, 사용 의견, 개선 요구를 정리했습니다. 보고 시에는 검암의 지적 항목 4개와 청주센텀의 중복 좌표 2그룹을 서로 다른 단위로 설명해야 합니다.')
doc.add_heading('확인 결과',level=1)
table(['현장','확인 시점','핵심 결과','근거'],[
 ['검암푸르지오프라베뉴','2026.09.08','지적 항목 4개\n파일 누락 1 + 번호 누락 2 + 번호 중첩 1','Baromi 저장 대화 원문'],
 ['청주센텀푸르지오자이','2026.04.07','중복 좌표 2그룹\n각 그룹의 원 객체 Count 2','파일마스터 검토 화면'],
 ['청주센텀푸르지오자이','2026.04.13','PDAM 위치 오류 표시 2행','현장 표시 이미지'],
 ['청주센텀푸르지오자이','2026.04.13','파일 일람 표기 검토 사례 1이미지','현장 표시 이미지'],
],widths=[1.45,1.0,2.8,1.35])
doc.add_heading('보고 시 해석',level=2)
para('검암의 476번은 파일 누락과 번호 중첩에 함께 등장합니다. 따라서 4개는 회신에 적힌 지적 항목 수이며, 서로 다른 고유 오류 위치가 4곳이라는 의미로 사용하지 않습니다.')
para('청주센텀의 중복 2그룹, PDAM 오류 표시 2행, 파일 일람 사례 1이미지는 집계 단위가 다릅니다. 총 오류 수로 합산하지 않습니다.')

# Baromi workflow
pb();add_meta('근거 1  Baromi 요청과 회신')
doc.add_heading('검암 현장 검토 대화',level=1)
doc.add_paragraph('현장이 좌표표·넘버링 도면·구조자료를 전달하고 본사가 비교 검토한 뒤 오류 내용과 도면을 회신한 과정입니다.')
table(['일시','발신','주고받은 내용','업무 의미'],[
 ['09.07 11:31','오경수','검암 좌표값.xlsx, 파일 넘버링 도면.dwg, 구조일람표.pdf 전달','검토 입력자료 수령'],
 ['09.07 14:15','오경수','파일 넘버링만이라도 검토 가능한지 요청','우선 검토 범위 확정'],
 ['09.07 14:16','정헌재','바로 검토하겠다고 회신','본사 검토 착수'],
 ['09.08 10:19','정헌재','엑셀과 도면의 차이 및 파일 넘버링 도면 회신','오류 근거와 위치 전달'],
],widths=[.85,.8,3.55,1.6])
doc.add_heading('회신에서 확인한 항목',level=2)
table(['번호','유형','확인 수','원문 근거'],[
 ['1','엑셀과 도면의 파일 누락','1항목','엑셀 476번 파일이 도면에 누락'],
 ['2','도면 번호 누락','2건','회신 원문에 번호 누락 2건 명시'],
 ['3','번호 중첩','1건','476번과 477번 번호 중첩'],
],widths=[.55,2.0,1.0,3.25])
para('현장 자료 수령부터 검토 결과 회신까지 약 1일 이내에 진행됐습니다. 회신 이후 현장이 수정본을 적용했는지는 이번 근거에서 확인되지 않습니다.')

# Main screenshot
pb();add_meta('근거 2  청주센텀 파일마스터 검토 화면')
doc.add_heading('중복 좌표를 화면과 도면에서 대조',level=1)
doc.add_picture(str(IMG1),width=Inches(6.75))
caption('그림 1  2026년 4월 7일 파일마스터 화면과 CAD 도면을 나란히 확인한 원본')
table(['화면 표시','확인 수','확인 내용'],[
 ['매칭 에러','전체 4','좌표 미매칭 2건과 거리초과 2건이 표시됨'],
 ['중복 좌표 리스트','2그룹','각 그룹 Count 2, Circle IDs와 연결 번호를 함께 표시'],
 ['CAD 대조','4개 원 객체','겹친 객체를 CAD에서 표시하여 위치를 확인'],
],widths=[1.45,1.15,4.2])
para('이 화면은 2026년 4월 7일의 과거 검토 결과입니다. 현재 저장 프로젝트의 진단 수치로 대체하거나 합산하지 않습니다.')

# Enlargement
pb();add_meta('근거 2  화면 확대')
doc.add_heading('프로그램 목록과 CAD 위치 확인',level=1)
doc.add_picture(str(OUT/'근거1_프로그램_확대.png'),width=Inches(6.4));caption('그림 2  프로그램의 매칭 에러 및 중복 좌표 목록 확대')
doc.add_picture(str(OUT/'근거1_CAD_확대.png'),width=Inches(6.4));caption('그림 3  CAD에서 겹친 객체 위치를 표시한 영역 확대')
para('프로그램은 오류 유형과 Circle ID를 목록으로 제시하고, 검토자는 CAD 원본에서 실제 객체 위치를 대조했습니다. 이 흐름은 자동 검출 결과를 사람이 확인하고 현장에 전달하는 절차를 보여줍니다.')

# Other images
pb();add_meta('근거 3  현장 표시 이미지')
doc.add_heading('PDAM 위치 표기와 파일 일람 검토',level=1)
doc.add_heading('PDAM 위치 표기',level=2)
doc.add_picture(str(IMG2),width=Inches(6.5));caption('그림 4  주차장 8-70과 8-43 기록에 108동 위치 오류를 표시한 이미지')
para('이미지에서 빨간색으로 표시된 기록은 2행입니다. 전체 PDAM 데이터의 오류가 2건이라는 의미가 아니라, 이 이미지에서 확인 가능한 표시 행이 2개라는 의미입니다.')
doc.add_heading('파일 일람 표기',level=2)
doc.add_picture(str(IMG3),width=Inches(4.75));caption('그림 5  P2와 P2F 주변 200번부터 203번 표기 검토 사례')
para('파일 번호 200~203과 P2·P2F 표기가 함께 보이는 검토 사례입니다. 이미지 한 장만으로 오류의 고유 개수를 확정하지 않았습니다.')

# User feedback
pb();add_meta('근거 4  Baromi 현장 의견')
doc.add_heading('현장 사용 의견과 기능 요구',level=1)
doc.add_paragraph('청주센텀 현장이 파일마스터를 사용한 뒤 전달한 의견과 일별 시공 표시가 필요한 이유입니다.')
table(['일시','발신','현장 의견','보고 해석'],[
 ['05.08 16:01','유현수','현장에서 시공현황을 확인하기 용이함','핵심 효용 확인'],
 ['05.08 16:01','유현수','기존 PDAM 사용자는 아직 화면에 익숙하지 않음','초기 교육과 숙련 필요'],
 ['05.13 08:33','한영규','일별 기록으로 시공 누락 파일을 파악','누락 방지 목적'],
 ['05.13 08:33','한영규','일별 기록이 후속 장비 동선 계획에 도움','작업계획 지원'],
 ['05.13 08:33','한영규','감리가 일일 작업현황을 다른 색으로 공유하기를 요청','대외 보고 요구'],
],widths=[.95,.8,3.45,1.6],font=8.2)
doc.add_heading('의견을 기능으로 연결',level=2)
table(['현장 의견','파일마스터에서 연결되는 기능'],[
 ['시공현황 확인이 편리해야 함','도면 위 완료·미시공 좌표와 집계 표시'],
 ['기존 사용자의 숙련이 필요함','현장 교육과 짧은 시연 영상 제공'],
 ['날짜별 누락과 동선을 봐야 함','일별·주별·월별 시공 시뮬레이션'],
 ['감리에게 날짜별 현황을 공유해야 함','시공일 기준 색상 표시와 기간 필터'],
],widths=[3.4,3.4])
para('현장 의견은 기능 만족도와 개선 요구를 함께 보여줍니다. “사용에 문제없음”은 오류가 없다는 의미가 아니라, 공사팀이 업무 흐름에서 사용할 수 있다는 평가입니다.')

# Traceability and conclusion
pb();add_meta('근거 5  출처와 보고 문안')
doc.add_heading('근거 자료 목록',level=1)
table(['구분','자료','확인 내용'],[
 ['Baromi 원문','정헌재-1차 검토결과-2026-09-08_102004.txt','검암 자료 수령, 검토 요청, 지적 항목 4개 회신'],
 ['Baromi 원문','유현수-2026-05-08_160701.txt','시공현황 확인 용이, 초기 숙련 필요'],
 ['Baromi 원문','한영규-2026-05-13_085250.txt','누락 확인, 동선 계획, 감리 색상 구분 요청'],
 ['검토 이미지','청주센텀자이 오류1.png','중복 좌표 2그룹 및 CAD 대조'],
 ['표시 이미지','260413_PDAM 위치 표기 오류.png','위치 오류 표시 2행'],
 ['표시 이미지','260413_파일 일람 표기 실수.png','파일 일람 표기 검토 사례'],
 ['Baromi DB','2026.05.13 정헌재·김인덕 대화','PoC에서 업무용 pilemaster VM으로 전환한 배경'],
],widths=[1.0,3.15,2.65],font=8.0)
doc.add_heading('보고 문안',level=1)
doc.add_paragraph('파일마스터를 활용해 현장에서 전달받은 좌표표와 도면을 비교하고, 파일 누락·번호 누락·번호 중첩·중복 좌표를 확인했습니다. 검암 현장에는 지적 항목 4개를 회신했고, 청주센텀 과거 검토 화면에서는 중복 좌표 2그룹을 확인했습니다. 현장에서는 시공현황 확인이 편리하다고 평가했으며, 일별 기록을 통한 누락 확인과 장비 동선 계획, 감리 공유를 주요 활용 목적으로 제시했습니다.')
doc.add_heading('확인 범위',level=2)
doc.add_paragraph('오류 수는 원문 또는 이미지에 명시된 단위로만 기록했습니다. 검암의 4개 지적 항목과 청주센텀의 2그룹·2행·1이미지는 합산하지 않았습니다. 현장 수정 완료 여부와 청주씨엘리체·인천계양의 확정 오류 수는 별도 확인이 필요합니다.')

# Page numbering field in footer.
for section in doc.sections:
 p=section.footer.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
 r=p.add_run('PHC파일 현장 피드백 근거 보고  |  ');r.font.size=Pt(8);r.font.color.rgb=RGBColor(120,128,138)
 fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');p._p.append(fld)

path=OUT/'PHC파일_현장피드백_Baromi_근거보고서.docx'
doc.save(path)
print(path)
