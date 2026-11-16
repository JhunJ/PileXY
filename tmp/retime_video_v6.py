from pathlib import Path
import subprocess,json

root=Path(__file__).resolve().parents[1]
out=root/'outputs/PHC_20260915_v2'; source=out/'작업파일_v5'; work=out/'작업파일_v6';work.mkdir(exist_ok=True)
# Source endpoint retains each meaningful interaction; trim idle tails first.
edits=[('hook',7.7,5.5),('structure',7,5.5),('mismatch',9,7),('fragment',8,6),('flow',8.5,6.5),('brand',4.6,3),('load',11.7,8),('issues',10.5,8),('compare',9.7,7),('status',9.7,7),('simulation',15.8,11),('field',9.2,7),('settlement',10.7,8),('ending',6,4.5)]
timeline=[];offset=0;clips=[]
for kind,end,duration in edits:
    clip=work/f'{kind}.mp4';clips.append(clip)
    timeline.append({'scene':kind,'start':offset,'duration':duration,'source_end':end});offset+=duration
    print('EDIT',kind,flush=True)
    vf=f'trim=start=0:end={end},setpts=(PTS-STARTPTS)*{duration/end},fps=24,fade=t=out:st={duration-.10}:d=0.10:color=0xF2F4F6'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(source/f'{kind}.mp4'),'-vf',vf,'-t',str(duration),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',str(clip)],check=True)
concat=work/'concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips),encoding='utf-8')
final=out/'파일마스터_PHC소개_3D시연_토스스타일_v6_빠른호흡_1080p.mp4'
music=out/'작업파일_v4/오리지널_배경음.wav'
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-i',str(music),'-af',f'afade=t=out:st={offset-2}:d=2','-c:v','copy','-c:a','aac','-b:a','160k','-t',str(offset),'-movflags','+faststart',str(final)],check=True)
(work/'영상_타임라인.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
print('FINAL',offset,final,flush=True)
