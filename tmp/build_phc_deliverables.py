from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import subprocess,json,html,base64,csv
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/PHC_20260915';OUT.mkdir(parents=True,exist_ok=True)
CAP=OUT/'captures'; FR=OUT/'frames'; FR.mkdir(exist_ok=True)
BASE=Path(r'D:\정헌재 선임_2025\건축_BIM')
FONT=r'C:\Windows\Fonts\malgun.ttf'; BOLD=r'C:\Windows\Fonts\malgunbd.ttf'
def font(n,b=False):return ImageFont.truetype(BOLD if b else FONT,n)
def txt(d,xy,s,n=30,fill='#213549',b=False):d.text(xy,s,font=font(n,b),fill=fill,spacing=14)
def fit(im,box):return ImageOps.contain(im,box,Image.Resampling.LANCZOS)
def shot(name):return CAP/name
def asset(name):return ROOT/'docs/manual/assets'/name
old=Image.open(BASE/'파일마스터/청주센텀자이/청주센텀자이 오류1.png').convert('RGB')
old.crop((1260,250,1920,840)).save(CAP/'historical_duplicates.png')
intro=Image.open(asset('source/파일마스터_내부설명자료_260424_032.png')).convert('RGB')
# Existing reference slide is used as an illustration, never as field evidence.
intro.crop((0,0,intro.width,intro.height)).save(CAP/'pile_illustration.png')
scenes=[
 ('PHC PILE MANAGEMENT','PHC파일 공사의 시작, 정확한 좌표부터', '파일 마스터', ['좌표 검토에서 시공현황과 기성정리까지','건축BIM팀 · 프로그램 소개 및 현장 시연'],shot('04_clean_canvas.png'),10,'실제 프로그램 화면 · 청주센텀자이'),
 ('01  PHC파일 공사','말뚝 번호와 위치가 공사 데이터의 기준입니다','PHC파일 공사란?', ['지반 속 말뚝이 상부 구조물의 하중을 지지합니다.','도면의 번호·좌표가 현장 기록과 연결되어야 합니다.'],shot('pile_illustration.png'),11,'기존 파일마스터 설명자료 · 개념 설명'),
 ('02  업무의 어려움','도면, 좌표표, 시공기록을 서로 맞춰야 합니다','확인이 필요한 차이', ['좌표가 겹치거나 번호가 빠진 도면','도면과 제출 엑셀의 누락·좌표 차이','PDAM의 위치명·번호 표기 차이'],asset('issues-ui.png'),11,'설명용 예시 화면 · 현장 발견 건수 집계에서 제외'),
 ('03  운영 흐름','현장 자료 → 본사 검토 → 회신 → 변경본 확인','본사와 현장이 함께', ['현장: 최신 CAD·좌표성과표·구조자료 전달','본사: 추출·비교 후 오류 위치와 근거 회신','현장: 도면 확인·수정본 전달·시공기록 활용'],asset('flow_overview.png'),12,'파일마스터 운영자료를 바탕으로 구성'),
 ('04  실제 프로그램 시연','프로젝트와 작업 버전을 선택합니다','저장 작업 불러오기', ['파일마스터 접속 → 상단 「불러오기」','프로젝트 선택 → 검토할 작업 버전 선택','도면 변경 이력을 버전별로 남깁니다.'],shot('01_versions.png'),10,'2026.09.15 직접 실행·캡처'),
 ('05  좌표 데이터 확인','도면의 말뚝과 번호를 한 화면에서 확인합니다','번호와 중심좌표', ['원과 번호 텍스트를 매칭해 목록으로 정리','동·주차장·타워크레인 영역을 구분','필터 조건과 도면 번호 형식을 먼저 확인'],shot('02_loaded.png'),12,'실제 저장 작업 V3.1.3 · 과거 발견 건수와 별개'),
 ('06  중복 검토 사례','겹친 좌표는 도면에서 위치를 확인합니다','청주센텀 검토 화면', ['과거 검토 화면에 중복 좌표 2그룹 표시','각 그룹에는 원 객체 2개가 포함','발견 항목을 도면과 대조하여 현장에 전달'],shot('historical_duplicates.png'),11,'2026.04.07 과거 화면 · 수정 완료 여부는 별도 확인'),
 ('07  현장 회신 사례','검암 현장에 누락·중첩 항목을 회신했습니다','2026.09.08  1차 검토', ['엑셀의 476번 파일: 도면 누락 1항목','도면 번호 누락: 2항목','476·477 번호 중첩: 1항목'],None,12,'저장된 바로미 대화 원문 · 총 4개 지적 항목'),
 ('08  PDAM 시공 기록','시공기록을 좌표와 연결해 현황을 확인합니다','시공현황', ['시공일·장비·공법·위치별 필터','시공완료와 미시공 좌표를 색상으로 구분','매칭되지 않은 기록은 별도 목록에서 검토'],shot('03_status.png'),11,'실제 청주센텀 데이터 · 진단 수치는 확정 오류 건수가 아닙니다.'),
 ('09  시공일 시뮬레이션','날짜별 시공 흐름을 색상으로 확인합니다','일별 순서 재생', ['시공현황 → 좌표 색상 「시공일」','「일별」과 배속 선택 → 시뮬레이션 시작','시공 누락 확인·동선 계획·일일 현황 공유'],shot('clean_sim_000.png'),13,'실제 프로그램 연속 캡처 · 4배속 재생'),
 ('10  현장이 요청한 활용','일별 구분이 필요한 이유를 현장에 물었습니다','청주센텀 현장 피드백', ['시공 누락된 파일을 파악하는 데 활용','다음 작업의 장비 동선 계획에 활용','감리 요청에 따라 일별 다른 색으로 공유'],shot('clean_sim_044.png'),11,'2026.05.13 저장된 현장 회신'),
 ('11  월별 기성정리','기간과 레벨 조건을 확인해 기성을 정리합니다','기성정리', ['기준 월·시작일·종료일 확인','기초 상단·두께·잔량 조건을 검토','시공 데이터와 계산 결과를 표로 확인'],shot('05_settlement.png'),12,'2026.09.15 실제 실행 화면 · 화면 값은 해당 저장 작업 기준'),
 ('12  현장 적용','익숙한 기록을 연결하고 반복 확인을 줄입니다','교육과 함께 정착', ['「시공현황 체크가 용이함」 — 현장 회신','기존 PDAM 사용자에게는 숙련 시간 필요','작업 버전과 조회 방법을 현장 교육에 포함'],asset('feedback_cheongju.png'),10,'2026.05.08 유현수 회신 + 2026.04.22 교육 후 회신'),
 ('FILE MASTER','정확한 좌표에서 이어지는 PHC파일 공사관리','파일 마스터', ['현장 자료 검토 · 번호와 좌표 확인','시공현황 · 날짜 시뮬레이션 · 기성정리','pilexy.yeobaekstudio.com'],shot('04_clean_canvas.png'),10,'건축BIM팀 · 내레이션 없는 소개 영상'),
]
def render_scene(i,sc,photo=None):
 tag,title,left,bullets,p,duration,note=sc
 im=Image.new('RGB',(1920,1080),'#F3F5F7');d=ImageDraw.Draw(im)
 d.rectangle((0,0,1920,12),fill='#256893');txt(d,(76,42),'파일 마스터  |  PHC파일 공사관리',24,b=True)
 txt(d,(1450,46),f'{i+1:02d} / {len(scenes):02d}',23,fill='#688092')
 txt(d,(76,112),tag,23,fill='#39778D',b=True);txt(d,(76,157),title,48,b=True)
 d.rounded_rectangle((68,270,650,918),radius=24,fill='white',outline='#DFE5EA',width=2)
 txt(d,(104,315),left,34,b=True)
 yy=400
 for k,s in enumerate(bullets):
  d.ellipse((106,yy+6,140,yy+40),fill='#2C718F');txt(d,(115,yy+7),str(k+1),20,fill='white',b=True)
  # Wrap Korean by measured width.
  chunks=[];line=''
  for c in s:
   if d.textlength(line+c,font=font(27))>450:chunks.append(line);line=c
   else:line+=c
  chunks.append(line)
  for l in chunks:txt(d,(158,yy),l,27);yy+=44
  yy+=37
 d.rounded_rectangle((686,270,1850,918),radius=24,fill='white',outline='#DFE5EA',width=2)
 if photo is not None or p:
  pic=Image.open(photo or p).convert('RGB')
  src=Path(photo or p)
  if src.parent==CAP and pic.height>800 and pic.width<1500:
   pic=pic.crop((0,220,pic.width,pic.height-20))
  pic=fit(pic,(1110,610));im.paste(pic,(1268-pic.width//2,594-pic.height//2))
 else:
  txt(d,(760,340),'검암푸르지오프라베뉴',36,b=True)
  for y,n,s in [(445,'1','엑셀–도면 누락'),(570,'2','도면 번호 누락'),(695,'1','476·477 번호 중첩')]:
   d.rounded_rectangle((754,y-5,1780,y+95),radius=16,fill='#EDF4F7');txt(d,(794,y),n,58,fill='#236789',b=True);txt(d,(914,y+20),s,34,b=True)
  txt(d,(770,833),'4개 지적 항목 · 고유 오류 위치 수와는 다를 수 있습니다.',25,fill='#6F7B88')
 d.rectangle((0,954,1920,1080),fill='#16364F');txt(d,(76,977),note,24,fill='#DAE8EF');txt(d,(76,1021),'도면 검토와 현장 기록을 하나의 흐름으로 연결합니다.',27,fill='white',b=True)
 return im
manifest=[]
for i,sc in enumerate(scenes):
 p=FR/f'scene_{i:02d}.png';render_scene(i,sc).save(p);manifest.append({'scene':i+1,'duration':sc[5],'title':sc[1],'source':str(sc[4]),'note':sc[6]})
 if i==9:
  for j,pic in enumerate(sorted(CAP.glob('clean_sim_*.png'))):render_scene(i,sc,pic).save(FR/f'anim_{j:03d}.png')
(OUT/'영상_구성_근거.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# Report and source ledger. Items and groups are deliberately not collapsed into one count.
rows=[['검암푸르지오프라베뉴','2026-09-08','엑셀–도면 파일 누락','1','지적 항목','엑셀 476번 파일 도면 누락','바로미 저장 텍스트','현장 수정 완료 미확인'],['검암푸르지오프라베뉴','2026-09-08','도면 번호 누락','2','지적 항목','회신 원문에 2건 명시','바로미 저장 텍스트','번호별 위치는 DWG 대조 필요'],['검암푸르지오프라베뉴','2026-09-08','번호 중첩','1','지적 항목','476·477 번호 중첩','바로미 저장 텍스트','476번 누락 항목과 영향 위치 중복 가능'],['청주센텀푸르지오자이','2026-04-07','중복 좌표','2','그룹','화면의 중복 좌표 리스트 2, 각 Count 2','청주센텀자이 오류1.png','동일 객체 제외 조건·수정 완료 여부 별도 확인'],['청주센텀푸르지오자이','2026-04-13','PDAM 위치 표기 차이','2','표시된 기록 행','주차장 표기 8-70·8-43에 108동 오류 표시','260413_PDAM 위치 표기 오류.png','이미지에 표시된 행만 계산, 전체 건수 아님'],['청주센텀푸르지오자이','2026-04-13','파일 일람 표기 실수','1','검토 사례 이미지','P2·P2F 주변 번호 200~203 이미지','260413_파일 일람 표기 실수.png','오류의 고유 개수는 이미지로 확정 불가']]
with (OUT/'현장피드백_근거목록.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['현장','자료일','분류','확인 수','집계 단위','근거 내용','자료','확인 범위']);w.writerows(rows)
sources=[BASE/'현장지원/검암푸르지오프라베뉴/정헌재-1차 검토결과-2026-09-08_102004.txt',BASE/'파일마스터/청주센텀자이/청주센텀자이 오류1.png',BASE/'파일마스터/청주센텀자이/요청/260413_PDAM 위치 표기 오류.png',BASE/'파일마스터/청주센텀자이/요청/260413_파일 일람 표기 실수.png']+list((BASE/'파일마스터/청주센텀자이/현장 회신/260508 회신_260513 회신_피드백').glob('*.txt'))
links=''.join(f'<li><a href="{p.as_uri()}">{html.escape(p.name)}</a></li>' for p in sources)
def embed(p):return 'data:image/png;base64,'+base64.b64encode(Path(p).read_bytes()).decode()
table=''.join('<tr>'+''.join('<td>'+html.escape(c)+'</td>' for c in [r[0],r[2],r[3]+' '+r[4],r[5]])+'</tr>' for r in rows)
report=f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>PHC파일 현장 피드백</title><style>
body{{font:15px/1.65 'Malgun Gothic',sans-serif;color:#213549;background:#edf1f4;margin:0}}main{{max-width:1080px;margin:30px auto;background:white;padding:48px 56px}}h1{{font-size:30px;margin:10px 0}}h2{{font-size:20px;border-left:5px solid #2c718f;padding-left:12px;margin-top:28px}}small,.muted{{color:#667988}}table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{border:1px solid #d8e1e8;padding:10px;text-align:left}}th{{background:#eaf1f5}}.cards{{display:flex;gap:16px}}.card{{flex:1;padding:18px;background:#edf5f8;border-radius:12px}}.num{{font-size:32px;font-weight:bold;color:#256789}}.note{{background:#f6f0e3;padding:14px;border-radius:8px}}.evidence{{display:flex;gap:18px;align-items:center}}.evidence img{{max-width:48%;max-height:350px;object-fit:contain}}a{{color:#216886}}@media print{{body{{background:white}}main{{margin:0;padding:15mm;max-width:none}}.appendix{{page-break-before:always}}}}
</style><main><small>첨부 2 · 건축BIM팀 · 2026.09.15 자료 확인 기준</small><h1>PHC파일 공사관리시스템 현장 피드백</h1><p>현장이 제공한 좌표도·성과표·시공기록을 비교하고, 오류 위치와 근거를 회신하는 방식으로 현장을 지원합니다. 아래 수치는 원문 메시지 또는 검토 화면에서 확인한 범위입니다.</p>
<div class="cards"><div class="card">검암프라베뉴 · 1차 검토<div class="num">4개 지적 항목</div>파일 누락 1 + 번호 누락 2 + 번호 중첩 1</div><div class="card">청주센텀 · 과거 검토 화면<div class="num">중복 좌표 2그룹</div>그룹마다 원 객체 2개 · 2026.04.07 화면</div></div>
<h2>현장과 주고받은 검토 흐름</h2><p><b>자료 요청 → 현장 자료 수령 → 번호·좌표·기록 비교 → 오류 내용과 도면 회신 → 변경본 확인</b></p><p>검암은 9월 7일 좌표 엑셀·넘버링 도면·구조일람표를 전달하고 넘버링 검토를 요청했습니다. 9월 8일 본사가 파일 누락·번호 누락·번호 중첩을 회신했습니다. 회신 이후의 수정 완료를 증명하는 자료는 이번 확인 범위에 없습니다.</p>
<h2>현장별 발견·검토 근거</h2><table><thead><tr><th>현장</th><th>유형</th><th>확인 수와 단위</th><th>확인 내용</th></tr></thead><tbody>{table}</tbody></table><p class="note">검암의 4개는 회신에 적힌 지적 항목 수입니다. 476번은 누락과 중첩 항목에 함께 등장하므로 고유 오류 위치 수로 단정하지 않습니다. 청주센텀의 중복 그룹·기록 행·사례 이미지는 서로 다른 단위이므로 합산하지 않습니다.</p>
<h2>현장 사용 의견과 개선 요구</h2><p><b>청주센텀 · 2026.05.08:</b> 공사팀 피드백 취합 결과 시공현황 체크가 용이하다고 회신했습니다. 기존 PDAM 사용자가 새 화면에 익숙해지는 숙련 시간은 필요하다고 했습니다.</p><p><b>청주센텀 · 2026.05.13:</b> 일별 시공 표시의 목적은 시공 누락 파일 확인, 후속 작업 동선 계획, 감리 요청에 따른 일일 작업현황의 색상 구분·공유였습니다. 5월 12일 넘버링 도면·측량성과표 전달, 본사의 활용 목적 질문, 다음 날 현장 설명이 남아 있습니다.</p>
<h2>추가 확인이 필요한 현장</h2><p>청주씨엘리체와 인천계양 A-10BL에는 좌표비교 결과 파일이 있으나 일부 파일이 일반 XLSX 형식으로 열리지 않아 결과 건수를 검증하지 못했습니다. 천안업성에는 누락번호 표기 도면이 있으며, 써밋클라비온에는 좌표·넘버링 도면 수령 및 버전 이력이 있으나 확정 발견 건수는 확인되지 않았습니다. 바로미 앱의 추가 대화는 현재 도구에서 직접 접근할 수 없었습니다. 미확인 수치를 0건으로 처리하지 않았습니다.</p>
<section class="appendix"><h2>근거 이미지와 원문 자료</h2><div class="evidence"><img src="{embed(CAP/'historical_duplicates.png')}"><img src="{embed(BASE/'파일마스터/청주센텀자이/요청/260413_PDAM 위치 표기 오류.png')}"></div><ol>{links}</ol><h2>현재 프로그램 수치의 해석</h2><p>9월 15일 청주센텀 V3.1.3 작업을 불러와 시연했습니다. 시공현황에는 프로젝트만 140, PDAM만 31, 자동 매칭 9가 표시됐습니다. 이는 선택한 도면 버전·시공 데이터·명칭 매칭 조건에 따른 진단 결과이며, 과거 현장에서 찾아낸 확정 오류 건수로 집계하지 않았습니다.</p><h2>소개 영상</h2><p>첨부 3 · <a href="파일마스터_PHC소개_시연_1080p.mp4">파일마스터 PHC파일 소개·시연 영상</a> · 내레이션 없음. 저장 작업 불러오기, 좌표 검토, 시공현황, 실제 날짜 시뮬레이션 연속 캡처, 기성정리 화면을 포함합니다. DC체커 v38과 공사일보 교육영상의 밝은 배경·단계형 자막 구성을 참고했습니다.</p></section></main></html>'''
(OUT/'현장피드백_정리.html').write_text(report,encoding='utf-8')
(OUT/'확인범위_및_추가자료.md').write_text('''# PHC파일 현장 피드백 확인 범위

완료: 자료 폴더 및 저장된 바로미 원문 확인, 검암 4개 지적 항목과 청주센텀 중복 2그룹 근거 정리, 현장 활용 의견 정리, 실제 웹 프로그램 시연 화면 확보와 내레이션 없는 영상 제작.

미완료: 바로미 앱 안의 추가 중복 개수 메시지 확인, 읽히지 않은 청주씨엘리체·인천계양 결과 파일 건수 검증, 현장별 고유 오류 및 수정 완료 건수 확정. 현재 연결된 UI 도구는 Windows 메신저를 제공하지 않습니다. 파일 보안 설정은 변경하지 않았습니다.

추가로 필요한 원문: 현장명·검토 날짜·중복 개수·누락 개수가 포함된 바로미 대화 내보내기 또는 해당 부분 캡처. 청주씨엘리체·인천계양 좌표비교 결과의 요약/오류 목록을 읽을 수 있는 PDF나 CSV로 제공하면 같은 보고서에 집계를 추가할 수 있습니다.

검암의 4개 지적 항목은 영향 위치의 고유 개수가 아닙니다. 청주센텀은 2그룹, 기록 행 2개, 사례 이미지 1개를 다른 단위로 관리하여 합산하지 않았습니다.
''',encoding='utf-8')
print('Rendered',len(scenes),'scenes; report authored',flush=True)
clips=[]
for i,sc in enumerate(scenes):
 clip=FR/f'clip_{i:02d}.mp4';dur=sc[5]
 if i==9:inp=['-framerate','8','-stream_loop','-1','-i',str(FR/'anim_%03d.png')]
 else:inp=['-loop','1','-framerate','24','-i',str(FR/f'scene_{i:02d}.png')]
 cmd=['ffmpeg','-y','-v','error',*inp,'-t',str(dur),'-vf',f'fps=24,fade=t=in:st=0:d=0.3,fade=t=out:st={dur-.3}:d=0.3','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-an',str(clip)]
 subprocess.run(cmd,check=True);clips.append(clip);print('Encoded',i+1,flush=True)
concat=FR/'concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips),encoding='utf-8')
video=OUT/'파일마스터_PHC소개_시연_1080p.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(video)],check=True)
print('VIDEO',video,flush=True)
