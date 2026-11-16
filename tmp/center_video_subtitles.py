from pathlib import Path
import importlib.util, shutil, subprocess
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=root/'tmp/build_phc_motion_v4.py'
s=source.read_text(encoding='utf-8').replace("WORK=OUT/'작업파일_v4'", "WORK=OUT/'작업파일_v5'").replace('토스스타일_v4_1080p.mp4','토스스타일_v5_1080p.mp4')
old=""" d=ImageDraw.Draw(im);rect(d,(74,966,1846,1051),'white',25);d.line((104,991,104,1025),fill=BLUE,width=7)
 text(d,(137,994),s,30,weight='Medium')"""
new=""" d=ImageDraw.Draw(im)
 width=min(1772,int(d.textlength(s,font=f(30,'Medium')))+88)
 rect(d,((W-width)/2,966,(W+width)/2,1051),'white',25)
 text(d,(W/2,1008),s,30,weight='Medium',anchor='mm')"""
assert old in s
s=s.replace(old,new)
v5=root/'tmp/build_phc_motion_v5.py'; v5.write_text(s,encoding='utf-8')
spec=importlib.util.spec_from_file_location('v5',v5);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
oldwork=m.OUT/'작업파일_v4'; original=m.caption
clips=[]
for kind,duration,*_ in m.SCENES:
    captured=[]
    def record(im,txt):
        captured.append(txt); original(im,txt)
    m.caption=record
    preview=m.frame(kind,6 if duration>7 else duration-1,duration)
    preview.save(m.WORK/f'preview_{kind}.png')
    clip=m.WORK/f'{kind}.mp4'; clips.append(clip)
    if not captured:
        shutil.copy2(oldwork/f'{kind}.mp4',clip); continue
    base=Image.new('RGB',(1920,1080),m.BG); original(base,captured[0]); strip=m.WORK/f'subtitle_{kind}.png';base.crop((0,966,1920,1080)).save(strip)
    print('CENTER',kind,flush=True)
    filt=f'[1:v]format=rgb24,fade=t=in:st=0:d=0.18:color=0xF2F4F6,fade=t=out:st={duration-.22}:d=0.22:color=0xF2F4F6[sub];[0:v][sub]overlay=0:966:shortest=1[v]'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(oldwork/f'{kind}.mp4'),'-loop','1','-framerate','24','-i',str(strip),'-filter_complex',filt,'-map','[v]','-t',str(duration),'-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',str(clip)],check=True)
concat=m.WORK/'concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips),encoding='utf-8')
out=m.OUT/'파일마스터_PHC소개_3D시연_토스스타일_v5_1080p.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-i',str(oldwork/'오리지널_배경음.wav'),'-c:v','copy','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(out)],check=True)
print(out,flush=True)
