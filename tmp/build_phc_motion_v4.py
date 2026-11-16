from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageOps,ImageColor
from functools import lru_cache
import math,json,subprocess,sys,wave
import numpy as np
from phc_mesh import render,single,assembly,export_obj

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs/PHC_20260915_v2';OUT.mkdir(exist_ok=True)
WORK=OUT/'작업파일_v4';WORK.mkdir(exist_ok=True);CAP=OUT/'captures'
OLD=ROOT/'outputs/PHC_20260915/captures';AS=ROOT/'docs/manual/assets/screenshots'
W,H,FPS=1920,1080,24
INK='#191F28';GRAY='#6B7684';BLUE='#0064FF';BG='#F2F4F6';PALE='#E8F3FF';RED='#F04452'
@lru_cache(None)
def f(n,weight='Bold'):return ImageFont.truetype(f'C:/Windows/Fonts/Pretendard-{weight}.ttf',int(n))
def text(d,p,s,n=32,col=INK,weight='Bold',anchor=None):
 if '\n' in s:d.multiline_text(p,s,font=f(n,weight),fill=col,spacing=int(n*.28))
 else:d.text(p,s,font=f(n,weight),fill=col,anchor=anchor)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def spring(x):return 1-math.exp(-6*max(0,x))*(math.cos(7*x)+.6*math.sin(7*x))
def rect(d,b,col='white',r=28,outline=None):d.rounded_rectangle(tuple(map(int,b)),r,fill=col,outline=outline,width=2)
def arrow(d,a,b,col=BLUE,width=5):
 d.line((a,b),fill=col,width=width);v=np.array(b)-a;v=v/(np.linalg.norm(v)+1e-9);n=np.array([-v[1],v[0]]);p=np.array(b)
 d.polygon([tuple(p),tuple(p-v*17+n*9),tuple(p-v*17-n*9)],fill=col)
def caption(im,s):
 d=ImageDraw.Draw(im);rect(d,(74,966,1846,1051),'white',25);d.line((104,991,104,1025),fill=BLUE,width=7)
 text(d,(137,994),s,30,weight='Medium')
def chrome(im,label,source=''):
 d=ImageDraw.Draw(im);text(d,(100,55),'파일 마스터',27);text(d,(100,96),label,21,GRAY,'Medium')
 if source:text(d,(1818,65),source,19,GRAY,'Medium',anchor='ra')
def header(im,line1,line2='',t=2):
 d=ImageDraw.Draw(im);dy=int(28*(1-ease(t/.7)))
 text(d,(100,208+dy),line1,76)
 if line2:text(d,(100,311+dy),line2,76,BLUE)
def centerTitle(im,title,sub='',t=2):
 d=ImageDraw.Draw(im);text(d,(960,175+int(25*(1-ease(t/.6)))),title,60,anchor='ma')
 if sub:text(d,(960,256),sub,28,GRAY,'Medium',anchor='ma')
@lru_cache(40)
def image(p):return Image.open(p).convert('RGB')
def photograph(im,p,box,zoom=1,focus=(.5,.5),rounding=22):
 src=image(str(p));x,y,w,h=box;aspect=w/h
 sw,sh=src.size
 if sw/sh>aspect:ch=sh/zoom;cw=ch*aspect
 else:cw=sw/zoom;ch=cw/aspect
 cx=max(cw/2,min(sw-cw/2,focus[0]*sw));cy=max(ch/2,min(sh-ch/2,focus[1]*sh))
 src=src.crop((int(cx-cw/2),int(cy-ch/2),int(cx+cw/2),int(cy+ch/2))).resize((int(w),int(h)),Image.Resampling.LANCZOS)
 mask=Image.new('L',src.size,0);ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),rounding,fill=255)
 im.paste(src,(int(x),int(y)),mask)
def cursor(im,x,y,click=0):
 d=ImageDraw.Draw(im)
 if click>0:
  r=int(16+35*click);d.ellipse((x-r,y-r,x+r,y+r),outline=BLUE,width=5)
 d.polygon([(x,y),(x+3,y+32),(x+11,y+24),(x+19,y+37),(x+26,y+33),(x+18,y+21),(x+31,y+20)],fill='white',outline=INK,width=2)
def tag(d,x,y,s,color=BLUE):
 width=d.textlength(s,font=f(25))+46;rect(d,(x,y,x+width,y+54),PALE,18);text(d,(x+23,y+14),s,25,color)
def mini_plan(d,x,y,w,h,t=0,offset=False):
 rect(d,(x,y,x+w,y+h),'#FFFFFF',25)
 for xx in range(int(x+25),int(x+w),40):d.line((xx,y+22,xx,y+h-22),fill='#EDF1F5',width=1)
 for yy in range(int(y+22),int(y+h),40):d.line((x+25,yy,x+w-25,yy),fill='#EDF1F5',width=1)
 for j in range(12):
  px=x+70+(j%4)*(w-140)/3;py=y+74+(j//4)*(h-148)/2
  bad=j==6;rr=19
  d.ellipse((px-rr,py-rr,px+rr,py+rr),outline=BLUE,width=3)
  text(d,(px,py+30),str(j+1),18,GRAY,'Medium',anchor='ma')
  if offset and bad:
   shift=45*ease(t/1.4);d.ellipse((px+shift-rr,py-rr,px+shift+rr,py+rr),outline=RED,width=4)
   if shift>25:arrow(d,(px+5,py-48),(px+shift-5,py-48),RED,3)
def dataCard(im,x,y,w,h,title,kind,t):
 d=ImageDraw.Draw(im);rect(d,(x+9,y+13,x+w+9,y+h+13),'#E1E8F0',28);rect(d,(x,y,x+w,y+h),'white',28)
 text(d,(x+30,y+27),title,30)
 if kind=='cad':mini_plan(d,x+20,y+95,w-40,h-120,t)
 else:
  headers=['번호','X','Y'] if kind=='excel' else ['시공일','위치','파일']
  rect(d,(x+28,y+100,x+w-28,y+149),PALE,12)
  for j,v in enumerate(headers):text(d,(x+40+j*(w-70)/3,y+115),v,20,GRAY,'Medium')
  for i in range(4):
   yy=y+167+i*55;d.line((x+30,yy+40,x+w-30,yy+40),fill='#EDF1F5',width=2)
   for j,v in enumerate(([str(i+1),'243…','449…'] if kind=='excel' else ['04.02','101동',str(i+1)])):text(d,(x+40+j*(w-70)/3,yy),v,21,GRAY,'Medium')
def flow_dot(d,a,b,q):
 p=np.array(a)+(np.array(b)-a)*q;d.ellipse((p[0]-8,p[1]-8,p[0]+8,p[1]+8),fill=BLUE)

SCENES=[
 ('hook',8,'말뚝의 위치와 번호,','도면과 현장이 같을까요?'),
 ('structure',11,'시공 전에,','말뚝의 번호와 위치를 먼저 맞춰봅니다.'),
 ('mismatch',11,'좌표 하나가 다르면,','확인해야 할 일이 늘어납니다.'),
 ('fragment',9,'도면, 좌표표, 시공기록.','자료는 따로 흩어져 있습니다.'),
 ('flow',10,'그래서, 같은 말뚝을','한 화면에서 맞춰봅니다.'),
 ('brand',5,'파일 마스터','PHC파일 공사관리시스템'),
 ('load',12,'먼저, 현장의 저장 작업을 불러옵니다.','저장 작업을 불러옵니다.'),
 ('issues',12,'겹친 좌표와 번호 누락.','어디가 다른지 바로 확인합니다.'),
 ('compare',10,'제출된 엑셀 좌표도,','같은 번호끼리 비교합니다.'),
 ('status',10,'현장의 기록을 연결하면,','시공현황이 색으로 보입니다.'),
 ('simulation',16,'날짜별로 어디까지 시공했는지 확인합니다.',''),
 ('field',11,'왜 일별로 봐야 할까요?','현장이 알려줬습니다.'),
 ('settlement',11,'좌표에서 시공실적까지.','월별 기성정리로 이어집니다.'),
 ('ending',8,'정확한 좌표에서 시작하는','PHC파일 공사관리'),
]

def frame(kind,t,duration):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 sc=next(s for s in SCENES if s[0]==kind);a,b=sc[2:]
 if kind in ['hook','structure']:
  if kind=='hook':
   chrome(im,'PHC PILE · 3D CONCEPT','설명용 개념 모델')
   header(im,a,b,t);text(d,(108,487),'수천 개의 말뚝을 시공하려면,\n도면과 좌표, 시공기록이 서로 맞아야 합니다.',33,GRAY,'Medium')
   model,_=render(single(),angle=.45+.23*math.sin(t*.45),elevation=.43,scale=110*min(1,max(.01,spring(t/1.2))),center=(1390,550))
   im.paste(model,(0,0),model);d=ImageDraw.Draw(im)
   if t>1.8:tag(d,110,690,'번호');tag(d,255,690,'좌표');tag(d,400,690,'시공기록')
   caption(im,'도면과 시공기록이 같은 말뚝을 가리키는지 확인합니다.')
  else:
   # DC체커처럼 핵심 문장을 한 줄씩 크게 보여주는 타이포그래피 장면.
   chrome(im,'WHY · 시공 전에 확인하는 이유','')
   def reveal(s,y,delay,size,color=INK,weight='Bold'):
    q=ease((t-delay)/.65)
    if q<=0:return
    bg=np.array([242,244,246]);target=np.array(ImageColor.getrgb(color));col=tuple((bg+(target-bg)*q).astype(int))
    text(d,(960,y+int(34*(1-q))),s,size,col,weight,anchor='ma')
   reveal('시공 전에,',285,.55,76)
   reveal('말뚝의 번호와 위치를',435,1.65,94,BLUE)
   reveal('먼저 맞춰봅니다.',600,2.85,82)
   q=ease((t-4.4)/.8)
   if q>0:
    text(d,(960,767+int(18*(1-q))),'도면  ·  좌표표  ·  시공기록',29,GRAY,'Medium',anchor='ma')
 elif kind=='mismatch':
  chrome(im,'WHY · 좌표를 검토하는 이유','설명용 예시 · 실제 현장 수치 아님');centerTitle(im,'좌표 하나가 다르면, 확인해야 할 일이 늘어납니다.','같은 번호의 위치가 도면과 좌표표에서 다르게 표시된다면?',t)
  mini_plan(d,210,365,680,405,t,False);mini_plan(d,1030,365,680,405,t-1,True)
  tag(d,220,300,'도면 좌표');tag(d,1040,300,'제출 좌표')
  for j,label in enumerate(['위치 재확인','도면·성과표 대조','시공 판단 지연']):
   if t>3+j*.5:tag(d,300+j*490,818,label,RED if j==2 else BLUE)
  caption(im,'좌표가 다르면 현장에서 다시 확인해야 합니다. 그래서 시공 전에 비교합니다.')
 elif kind=='fragment':
  chrome(im,'WHY · 분산된 데이터');centerTitle(im,'도면, 좌표표, 시공기록.','흩어진 자료를 사람이 반복해서 맞추고 있습니다.',t)
  for j,(title,kind2) in enumerate([('CAD 좌표도','cad'),('측량 좌표표','excel'),('PDAM 시공기록','pdam')]):
   e=ease((t-j*.28)/.9);xx=140+j*575;yy=355+int(45*(1-e))+int(7*math.sin(t*.9+j));dataCard(im,xx,yy,490,400,title,kind2,t)
   if j<2:
    d=ImageDraw.Draw(im);d.line((xx+508,555,xx+551,555),fill='#AFBAC8',width=3);text(d,(xx+529,599),'?',38,GRAY,anchor='ma')
  d=ImageDraw.Draw(im);text(d,(960,832),'번호 · 좌표 · 위치명 · 시공일을 같은 기준으로',36,anchor='ma')
  caption(im,'도면과 좌표표, 시공기록을 같은 말뚝 번호로 맞춰봐야 합니다.')
 elif kind=='flow':
  chrome(im,'SOLUTION · 파일마스터 업무 흐름');centerTitle(im,'그래서, 같은 말뚝을 한 화면에서 맞춰봅니다.','도면 추출 → 좌표 비교 → 현장 확인 → 시공기록 연결',t)
  # One evolving diagram, no permanent explanatory side panels.
  sources=[('좌표도',420),('좌표표',575),('시공기록',730)]
  for j,(s,y) in enumerate(sources):
   rect(d,(135,y-49,440,y+48),'white',23);text(d,(288,y-17),s,30,anchor='ma');arrow(d,(460,y),(795,575), '#BED3EF',4)
   flow_dot(d,(460,y),(795,575),(max(0,t-1-j*.3)*.33)%1)
  rect(d,(805,425,1185,725),'white',34);text(d,(995,470),'파일 마스터',39,BLUE,anchor='ma')
  for j,s in enumerate(['번호 매칭','좌표 검토','기록 연결']):text(d,(995,545+j*47),s,28,GRAY,'Medium',anchor='ma')
  arrow(d,(1210,575),(1380,575));flow_dot(d,(1210,575),(1380,575),(t*.38)%1)
  rect(d,(1400,425,1770,725),'white',34)
  text(d,(1585,471),'현장 확인',37,anchor='ma')
  for j,s in enumerate(['오류 위치 확인','검토 결과 회신','변경본 재확인']):text(d,(1585,552+j*47),s,27,GRAY,'Medium',anchor='ma')
  if t>4:tag(d,735,815,'검토 결과를 근거와 함께 주고받습니다.')
  caption(im,'번호와 좌표를 비교한 뒤, 다른 부분을 현장과 함께 확인합니다.')
 elif kind=='brand':
  chrome(im,'INTRODUCING')
  model,_=render(single(),angle=.4+t*.1,elevation=.95,scale=55,center=(960,361),ground=False)
  im.paste(model,(0,0),model);d=ImageDraw.Draw(im)
  text(d,(960,610),'파일 마스터',104,BLUE,anchor='ma');text(d,(960,745),'PHC파일 공사관리시스템',35,GRAY,'Medium',anchor='ma')
  text(d,(960,833),'이제, 실제 프로그램에서 보여드리겠습니다.',29,GRAY,'Medium',anchor='ma')
 elif kind=='load':
  chrome(im,'DEMO 01 · 저장 작업 불러오기','실제 프로그램 화면 · 편집·확대');centerTitle(im,'먼저, 현장의 저장 작업을 불러옵니다.','청주센텀자이 → 최신 저장 작업 V4.0',t)
  p=CAP/'access.png' if t<2.6 else CAP/'versions.png' if t<7 else CAP/'loaded.png'
  photograph(im,p,(150,325,1620,590),zoom=1+(.15*ease((t-3)/2) if t<7 else .06),focus=(.5,.48))
  if t<2.6:cursor(im,1450,354, max(0,1-abs(t-2)*3))
  elif t<7:cursor(im,960+230*ease((t-3)/1.5),525+50*ease((t-3)/1.5),max(0,1-abs(t-6)*3))
  caption(im,'현장을 선택하고, 본사에서 준비한 최신 작업을 불러옵니다.')
 elif kind=='issues':
  chrome(im,'DEMO 02 · 좌표·번호 검토','2026.04.07 과거 검토 화면');centerTitle(im,'겹친 좌표와 번호 누락.','검토 목록에서 문제 위치를 도면과 대조합니다.',t)
  p=ROOT.parent/'파일마스터/청주센텀자이/청주센텀자이 오류1.png'
  # Crop just the original program, excluding unrelated desktop chrome.
  src=image(str(p)).crop((0,140,1910,1025));tmp=WORK/'historic_program.png'
  if not tmp.exists():src.save(tmp)
  photograph(im,tmp,(180,325,1560,595),zoom=1+.9*ease((t-3)/3),focus=(.82,.44))
  if t>4:
   rect(d,(220,793,740,886),'white',24);text(d,(251,818),'중복 좌표 2그룹',36,BLUE)
  caption(im,'같은 좌표에 말뚝이 겹친 두 곳을 찾아, 도면과 함께 현장에 전달했습니다.')
 elif kind=='compare':
  chrome(im,'DEMO 03 · 엑셀 좌표 비교','기존 매뉴얼 시연 화면 · 샘플 데이터');centerTitle(im,'제출된 엑셀 좌표도, 같은 번호끼리 비교합니다.','파일 선택 → 동·번호·X·Y 지정 → 비교 실행',t)
  p=AS/'step-version-excel.png' if t<4.5 else AS/'step-version-excel-issues.png'
  photograph(im,p,(145,320,1630,607),zoom=1+.25*ease((t-5)/3),focus=(.62,.66))
  caption(im,'엑셀에서 동, 말뚝 번호, X·Y 좌표 열을 선택하면 다른 항목을 찾아줍니다.')
 elif kind=='status':
  chrome(im,'DEMO 04 · 시공현황','실제 프로그램 · 청주센텀 V4.0');centerTitle(im,'현장의 기록을 연결하면, 시공현황이 색으로 보입니다.','시공일 · 장비 · 공법 · 위치별로 조회',t)
  p=CAP/'status.png' if (CAP/'status.png').exists() else OLD/'03_status.png'
  photograph(im,p,(145,320,1630,607),zoom=1+.15*ease(t/5),focus=(.5,.52))
  caption(im,'PDAM 기록을 연결하면, 시공한 말뚝과 아직 시공하지 않은 말뚝을 볼 수 있습니다.')
 elif kind=='simulation':
  chrome(im,'DEMO 05 · 날짜 시뮬레이션','실제 연속 캡처 · 프로그램 2배속')
  text(d,(100,165),'날짜별로 어디까지 시공했는지 확인합니다.',56)
  seq=sorted(CAP.glob('sim_*.jpg')) or sorted(CAP.glob('sim_*.png')) or sorted(OLD.glob('clean_sim_*.png'))
  j=min(len(seq)-1,int(max(0,t-1)/(duration-2)*(len(seq)-1)))
  # Keep every pixel of the captured viewport: no cover-crop or animated zoom.
  src=image(str(seq[j])); sw,sh=src.size
  scale=min(1690/sw,690/sh); nw,nh=round(sw*scale),round(sh*scale)
  im.paste(src.resize((nw,nh),Image.Resampling.LANCZOS),((W-nw)//2,255+(690-nh)//2))
  caption(im,'‘일별’을 선택해 재생하면, 날짜에 따라 시공한 말뚝의 색이 바뀝니다.')
 elif kind=='field':
  chrome(im,'FIELD FEEDBACK · 왜 일별로 볼까?','2026.05.13 청주센텀 현장 회신');centerTitle(im,'왜 일별로 봐야 할까요?','현장의 시공 기록에는 다음 작업을 위한 정보가 있습니다.',t)
  labels=[('시공 누락 확인','아직 시공하지 않은 말뚝 파악'),('장비 동선 계획','다음 작업 순서와 이동 경로'),('감리 현황 공유','일별 다른 색상으로 현황 전달')]
  for j,(s,sub) in enumerate(labels):
   x=165+j*555;e=ease((t-.5-j*.6)/.8);y=383+int(40*(1-e))
   rect(d,(x,y,x+480,y+370),'white',32)
   # Each graphic explains the actual purpose instead of decorative UI.
   for k in range(9):
    xx=x+137+(k%3)*78;yy=y+58+(k//3)*65;col=BLUE if (k+j)%3 else '#D5DEE8';d.ellipse((xx-13,yy-13,xx+13,yy+13),fill=col)
   if j==0:d.ellipse((x+279,y+175,x+306,y+202),outline=RED,width=5)
   if j==1:
    q=ease((t-2)/2);arrow(d,(x+126,y+55),(x+290,y+55));arrow(d,(x+290,y+55),(x+290,y+183));cursor(im,x+126+164*q,y+61)
   if j==2:
    for k,col in enumerate([BLUE,'#318C83','#9A7AE1']):d.ellipse((x+114+k*86,y+68,x+140+k*86,y+94),fill=col)
   text(d,(x+240,y+243),s,34,anchor='ma');text(d,(x+240,y+305),sub,23,GRAY,'Medium',anchor='ma')
  caption(im,'일별 현황은 빠진 말뚝을 찾고, 다음 작업 동선을 계획하는 데 도움이 됩니다.')
 elif kind=='settlement':
  chrome(im,'DEMO 06 · 기성정리','실제 프로그램 · 저장 작업 기준');centerTitle(im,'좌표에서 시공실적까지, 월별 기성정리로 이어집니다.','기성 기간과 레벨·두께·잔량 조건을 확인합니다.',t)
  p=CAP/'settlement.png' if (CAP/'settlement.png').exists() else OLD/'05_settlement.png'
  photograph(im,p,(145,320,1630,607),zoom=1+.4*ease((t-4)/4),focus=(.7,.55))
  caption(im,'시공기록과 기초 조건을 확인한 뒤, 월별 기성 내역을 정리합니다.')
 elif kind=='ending':
  chrome(im,'PILE MASTER · 건축BIM팀')
  model,_=render(single(),angle=.65+t*.045,elevation=.8,scale=52,center=(960,345),ground=False)
  im.paste(model,(0,0),model);d=ImageDraw.Draw(im)
  text(d,(960,582),'정확한 좌표에서 시작하는',61,anchor='ma');text(d,(960,671),'PHC파일 공사관리',78,BLUE,anchor='ma')
  text(d,(960,790),'도면 검토 → 현장 확인 → 시공현황 → 기성정리',31,GRAY,'Medium',anchor='ma');text(d,(960,880),'pilexy.yeobaekstudio.com',31,BLUE,'Medium',anchor='ma')
 # Short luminous cuts, avoiding static slide fades on every card.
 if t<.18:im=Image.blend(Image.new('RGB',(W,H),BG),im,ease(t/.18))
 if t>duration-.22:im=Image.blend(im,Image.new('RGB',(W,H),BG),ease((t-duration+.22)/.22))
 return im

def previews():
 for kind,dur,*_ in SCENES:frame(kind,min(dur-1,6),dur).save(WORK/f'preview_{kind}.png')
 ps=list(WORK.glob('preview_*.png'));sheet=Image.new('RGB',(1440,math.ceil(len(ps)/3)*295),'white');d=ImageDraw.Draw(sheet)
 for i,p in enumerate(ps):
  sheet.paste(image(str(p)).resize((480,270)),((i%3)*480,(i//3)*295));text(d,((i%3)*480+12,(i//3)*295+272),p.stem,18,GRAY,'Medium')
 sheet.save(OUT/'연출_미리보기.jpg')
 export_obj(single(),WORK/'PHC_중공파일.obj');export_obj(assembly(),WORK/'PHC_기초골조_개념모델.obj')

def soundtrack(duration):
 sr=44100;mix=np.zeros(int(duration*sr)+sr,dtype=np.float32);beat=60/104
 chords=[[57,60,64,69],[53,57,60,65],[60,64,67,72],[55,59,62,67]]
 def note(start,midi,length,amp):
  n=int(length*sr);tt=np.arange(n)/sr;freq=440*2**((midi-69)/12);env=(1-np.exp(-tt*60))*np.exp(-tt*2.0)
  sig=(np.sin(2*np.pi*freq*tt)+.20*np.sin(4*np.pi*freq*tt)+.07*np.sin(6*np.pi*freq*tt))*env*amp;i=int(start*sr)
  if i+n>len(mix):n=len(mix)-i
  if n>0:mix[i:i+n]+=sig[:n]
 for j in range(int(duration/(beat/2))):
  tt=j*beat/2;ch=chords[(j//16)%4];note(tt,ch[j%4]+12,2.2,.047)
  if j%8==0:note(tt,ch[0]-12,3,.055)
 # Soft original composition, no voice or reused reference soundtrack.
 mix=mix[:int(duration*sr)];ramp=np.minimum(1,np.arange(len(mix))/sr/2)*np.minimum(1,(len(mix)-np.arange(len(mix)))/sr/3);mix*=ramp
 stereo=np.stack([mix,mix*.96],axis=1);p=WORK/'오리지널_배경음.wav'
 with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(np.clip(stereo*32767,-32768,32767).astype('<i2').tobytes())
 return p
def encode(only=None):
 clips=[];timeline=[];offset=0
 for kind,dur,a,b in SCENES:
  clip=WORK/f'{kind}.mp4';clips.append(clip);timeline.append({'start':offset,'duration':dur,'scene':kind,'headline':a+' '+b});offset+=dur
  if only and kind not in only:continue
  print('RENDER',kind,flush=True)
  cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',str(clip)]
  proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
  for j in range(dur*FPS):proc.stdin.write(frame(kind,j/FPS,dur).tobytes())
  proc.stdin.close()
  if proc.wait()!=0:raise RuntimeError(kind)
  print('DONE',kind,flush=True)
 concat=WORK/'concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips),encoding='utf-8')
 master=WORK/'영상_무음마스터.mp4';subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(master)],check=True)
 music=soundtrack(offset);out=OUT/'파일마스터_PHC소개_3D시연_토스스타일_v4_1080p.mp4'
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(master),'-i',str(music),'-c:v','copy','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(out)],check=True)
 (OUT/'영상_타임라인.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
 print('FINAL',out,'SECONDS',offset,flush=True)
if __name__=='__main__':
 previews()
 if '--preview' not in sys.argv:encode()
