import base64,csv,sqlite3,json
from pathlib import Path
ROOT=Path(r"C:\Baromi\data")
OUT=Path(r"D:\정헌재 선임_2025\건축_BIM\PileXY\outputs\PHC_20260915\baromi_work\baromi_전체계정_핵심메시지.csv")
KEYS=['파일마스터','파일 마스터','pilemaster','pile master','중복','겹치','좌표','phc','말뚝','청주센텀','청주 센텀','검암','프라베뉴','계양','천안','시엘','써밋클라비온','pdam','시공현황']
def dec(v):
 if v is None:return ''
 if isinstance(v,str):v=v.encode('ascii','ignore')
 try:return base64.b64decode(v,validate=True).decode('utf-16le','replace').rstrip('\0')
 except:return ''
hits=[];errs=[]
for folder in ROOT.iterdir():
 if not folder.is_dir():continue
 rooms={}
 chatlist=folder/'ChatList.edb'
 if chatlist.exists():
  try:
   # Live files can be locked; room/member data is optional.
   c=sqlite3.connect(f'file:{chatlist.as_posix()}?mode=ro',uri=True,timeout=.1)
   rooms={r[0]:dec(r[2]) for r in c.execute('select TALKID,TALK_TITLE,MEMBERIDLIST from CHATROOM')};c.close()
  except Exception:pass
 for f in folder.glob('ChatLog_*.edb'):
  try:
   c=sqlite3.connect(f'file:{f.as_posix()}?mode=ro',uri=True,timeout=.1)
   for talkid,msgid,text,title,sender,date,*opts in c.execute('select TALKID,MESSAGEID,MESSAGETEXT,TALK_TITLE,SENDERID,SAVE_DATE,OPT1,OPT2,OPT3,OPT4,OPT5 from CHATLOG'):
    fields=[dec(x) for x in [text,title,*opts]];hay='\n'.join(fields).lower();matched=[k for k in KEYS if k.lower() in hay]
    if matched:hits.append({'date':date,'account':folder.name,'talk_id':talkid,'sender_id':dec(sender),'members':rooms.get(talkid,''),'message':fields[0],'attachments':' | '.join(x for x in fields[2:] if x),'keywords':', '.join(matched),'source_db':str(f)})
   c.close()
  except Exception as e:errs.append((str(f),str(e)))
hits.sort(key=lambda x:x['date'] or '')
with OUT.open('w',encoding='utf-8-sig',newline='') as fp:
 w=csv.DictWriter(fp,fieldnames=hits[0].keys() if hits else ['date']);w.writeheader();w.writerows(hits)
print(json.dumps({'profiles':len([p for p in ROOT.iterdir() if p.is_dir()]),'hits':len(hits),'errors':len(errs)},ensure_ascii=False))
