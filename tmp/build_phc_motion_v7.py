from pathlib import Path
import sys,json,math,subprocess,bisect
import numpy as np
from PIL import Image,ImageDraw
from functools import lru_cache
from build_phc_motion_v5 import f,text,rect,caption,chrome,centerTitle,ease,arrow,BG,INK,GRAY,BLUE
from phc_mesh import box,render

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/PHC_20260916_v7';WORK=OUT/'작업파일';WORK.mkdir(exist_ok=True)
CAP=OUT/'captures';OLD=ROOT/'outputs/PHC_20260915_v2/작업파일_v6'
data=json.loads((OUT/'업체엑셀_원본데이터.json').read_text(encoding='utf-8'))
times=json.loads((CAP/'capture_times.json').read_text());ms=[x['ms'] for x in times]

@lru_cache(150)
def img(p):return Image.open(p).convert('RGB')

def stack(im,cx,cy,color,t):
    faces=[]
    for k in range(7):
        faces+=box(0,k*.17,0,4.2,.09,2.8,[243,248,252] if k<6 else color)
    layer,project=render(faces,angle=.35+.08*math.sin(t*.6),elevation=.70,scale=76,center=(cx,cy),ground=False)
    im.paste(layer,(0,0),layer)
    d=ImageDraw.Draw(im)
    for z in np.linspace(-1.2,1.2,8):
        p=project(np.array([[-1.9,1.075,z],[1.9,1.075,z]]));d.line([tuple(x) for x in p],fill='white',width=2)
    for x in np.linspace(-1.9,1.9,5):
        p=project(np.array([[x,1.075,-1.2],[x,1.075,1.2]]));d.line([tuple(q) for q in p],fill='white',width=2)

def legend(d):
    for x,name,color in [(330,'1호기','#2563eb'),(575,'2호기','#f97316'),(820,'3호기','#16a34a')]:
        d.ellipse((x-66,301,x-44,323),fill=color);text(d,(x-29,311),name,27,'white',anchor='lm')

def frame(kind,t,dur):
    im=Image.new('RGB',(1920,1080),BG);d=ImageDraw.Draw(im)
    if kind=='excel_flow':
        chrome(im,'좌표 비교 · 3D WORKFLOW','비교 과정 개념도')
        centerTitle(im,'엑셀은 많아도, 비교 기준은 하나입니다.','동과 말뚝 번호를 맞추고, X·Y 좌푯값을 비교합니다.')
        stack(im,490,510,[35,164,109],t);stack(im,1430,510,[49,130,246],t+.4)
        d=ImageDraw.Draw(im)
        text(d,(490,620),'업체 좌표 성과표',39,anchor='mm');text(d,(490,672),'동별로 나뉜 많은 엑셀 시트',25,GRAY,anchor='mm')
        text(d,(1430,620),'파일마스터 엑셀',39,anchor='mm');text(d,(1430,672),'도면에서 정리한 기준 좌표',25,GRAY,anchor='mm')
        if t>.6:
            q=ease((t-.6)/.9);arrow(d,(530,720),(530+240*q,720+60*q));arrow(d,(1390,720),(1390-240*q,720+60*q))
        rect(d,(775,716,1145,848),'white',52)
        text(d,(960,759),'같은 말뚝끼리',31,anchor='mm');text(d,(960,804),'X · Y 비교',33,BLUE,anchor='mm')
        if t>2.2:text(d,(960,898),'다른 좌표 · 누락된 번호 확인',28,GRAY,anchor='mm')
        caption(im,'업체가 보낸 엑셀을 파일마스터의 기준 좌표와 비교합니다.')
    elif kind=='vendor_excel':
        chrome(im,'청주센텀자이 · 업체 좌표 성과품','실제 원본 엑셀 시트')
        centerTitle(im,'한 현장의 좌표표만, 1,883행입니다.')
        names=['지하주차장','101동','102동'];part=min(2,int(t/3));name=names[part];local=t-part*3
        sheet=img(str(CAP/f'excel_{name}.png'))
        # Preserve the original workbook's cells, formatting and row numbers.
        sy=int(ease((local-.55)/2.2)*min(2700,sheet.height-565))
        rect(d,(100,275,1152,930),'white',22)
        text(d,(130,304),'측량 성과표 통합3_수정3.xlsx',25,INK,'Medium')
        im.paste(sheet.crop((0,sy,sheet.width,sy+525)),(125,355))
        d=ImageDraw.Draw(im)
        for j,s in enumerate(names):
            x=127+j*230
            rect(d,(x,888,x+210,923),'#E2F5EB' if j==part else '#F2F4F6',7)
            text(d,(x+105,905),s,22,'#137A4C' if j==part else GRAY,anchor='mm')
        text(d,(1235,333),'시트',28,GRAY);text(d,(1230,373),'13개',82)
        text(d,(1235,506),'좌표 데이터',28,GRAY);text(d,(1230,546),'1,883행',82,BLUE)
        text(d,(1235,704),'주차장 · 동별 · 타워크레인',27)
        text(d,(1235,757),'여러 시트에 나뉜 좌표를\n하나씩 대조해야 합니다.',29,GRAY,'Medium')
        caption(im,'주차장부터 동별 말뚝까지, 확인해야 할 좌푯값이 이렇게 많습니다.')
    elif kind in ['status','simulation']:
        chrome(im,'시공 시뮬레이션 · 청주센텀자이','파일마스터 실제 시연')
        centerTitle(im,'날짜를 따라, 현장 전체의 시공 흐름을 봅니다.' if kind=='simulation' else '색으로 호기를 구분하고, 시공 흐름을 확인합니다.')
        if kind=='status':shot=img(str(CAP/'equipment_full.png'))
        else:
            target=min(17700,max(0,(t-.4)/(dur-1.3)*17700))
            idx=min(len(times)-1,bisect.bisect_left(ms,target));shot=img(str(CAP/f'sim_{idx:03d}.png'))
        rect(d,(100,277,1095,935),'#101729',25)
        crop=shot.crop((420,280,920,902))
        im.paste(crop.resize((460,572),Image.Resampling.LANCZOS),(365,347))
        d=ImageDraw.Draw(im);legend(d)
        text(d,(155,877),'현장 전체',22,'#CBD5E1')
        rect(d,(1130,277,1820,935),'white',25)
        text(d,(1170,316),'시공 기간과 재생 화면',30)
        control=shot.crop((1393,291,1871,674))
        im.paste(control.resize((610,489),Image.Resampling.LANCZOS),(1170,369))
        d=ImageDraw.Draw(im)
        text(d,(1475,892),'2026.04.02 → 2026.07.23',27,GRAY,anchor='mm')
        caption(im,'파랑은 1호기, 주황은 2호기, 초록은 3호기입니다.' if kind=='status' else ('날짜가 지나면서, 각 호기가 시공한 위치가 차례로 채워집니다.' if t<8 else '도면 아래쪽까지 함께 보며, 현장 전체의 진행 상황을 확인합니다.'))
    elif kind=='field':
        chrome(im,'시공 시뮬레이션의 활용')
        centerTitle(im,'어디까지 했는지, 다음은 어디인지.','시공 흐름을 함께 보고 다음 작업을 준비합니다.')
        for j,(title,body) in enumerate([('시공 위치 확인','날짜별 진행 구간을 확인합니다.'),('다음 작업 준비','호기별 작업 흐름을 살펴봅니다.'),('현황 공유','현장과 감리가 같은 화면을 봅니다.')]):
            x=100+j*585;dy=int(35*(1-ease((t-j*.2)/.7)))
            rect(d,(x,401+dy,x+550,789+dy),'white',34)
            text(d,(x+45,450+dy),f'0{j+1}',55,BLUE)
            text(d,(x+45,565+dy),title,43)
            text(d,(x+45,659+dy),body,26,GRAY,'Medium')
        caption(im,'시공 현황을 함께 보고, 다음 작업을 준비합니다.')
    return im

new=[('excel_flow',7),('vendor_excel',9),('status',5),('simulation',13),('field',5)]
def previews():
    for kind,dur in new:frame(kind,dur*.48,dur).save(OUT/f'검토_{kind}.jpg')
    frame('simulation',12.5,13).save(OUT/'검토_시뮬레이션완료.jpg')

def encode():
    for kind,dur in new:
        target=WORK/f'{kind}.mp4'
        if target.exists():continue
        print('RENDER',kind,flush=True)
        proc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','24','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',str(target)],stdin=subprocess.PIPE)
        for j in range(dur*24):proc.stdin.write(frame(kind,j/24,dur).tobytes())
        proc.stdin.close()
        if proc.wait():raise RuntimeError(kind)
        print('DONE',kind,flush=True)
    old=json.loads((OLD/'영상_타임라인.json').read_text(encoding='utf-8'))
    timeline=[];clips=[];offset=0;nd=dict(new)
    for row in old:
        k=row['scene']
        if k=='compare':
            for a in ['excel_flow','vendor_excel']:
                clips.append(WORK/f'{a}.mp4');timeline.append({'scene':a,'start':offset,'duration':nd[a]});offset+=nd[a]
        dur=nd.get(k,row['duration']);clips.append((WORK if k in nd else OLD)/f'{k}.mp4')
        timeline.append({'scene':k,'start':offset,'duration':dur});offset+=dur
    concat=WORK/'concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips),encoding='utf-8')
    final=OUT/'파일마스터_PHC소개_v7_엑셀비교_전체현장시뮬레이션_1080p.mp4'
    subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-i',str(ROOT/'outputs/PHC_20260915_v2/작업파일_v4/오리지널_배경음.wav'),'-af',f'afade=t=out:st={offset-2}:d=2','-c:v','copy','-c:a','aac','-b:a','160k','-t',str(offset),'-movflags','+faststart',str(final)],check=True)
    (OUT/'영상_타임라인.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
    print('FINAL',offset,final,flush=True)

if __name__=='__main__':
    previews()
    if '--preview' not in sys.argv:encode()
