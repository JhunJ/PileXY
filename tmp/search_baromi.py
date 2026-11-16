import base64, csv, json, sqlite3
from pathlib import Path

SRC = Path(r"C:\Baromi\data\EDC77EE20C1A826CE33ECA898945593B")
OUT = Path(r"D:\정헌재 선임_2025\건축_BIM\PileXY\outputs\PHC_20260915\baromi_work")
OUT.mkdir(parents=True, exist_ok=True)
KEYS = ["파일마스터", "파일 마스터", "중복", "겹", "좌표", "phc", "말뚝", "청주", "센텀", "검암", "프라베뉴", "계양", "천안", "시엘", "써밋", "pdam", "피드백", "시공현황", "시공 현황", "오류", "누락", "검토", "개", "건"]

def dec(value):
    if value is None: return ""
    if isinstance(value, str): value = value.encode("ascii", "ignore")
    try:
        raw = base64.b64decode(value, validate=True)
        return raw.decode("utf-16le", "replace").rstrip("\x00")
    except Exception:
        try: return value.decode("utf-8", "replace")
        except Exception: return str(value)

rooms = {}
c = sqlite3.connect(f"file:{(OUT/'ChatList.edb').as_posix()}?mode=ro", uri=True, timeout=1)
for talkid, title, members in c.execute("select TALKID,TALK_TITLE,MEMBERIDLIST from CHATROOM"):
    rooms[talkid] = {"title":dec(title), "members":dec(members)}
c.close()

hits=[]
errors=[]
for f in SRC.glob("ChatLog_*.edb"):
    try:
        c=sqlite3.connect(f"file:{f.as_posix()}?mode=ro",uri=True,timeout=.2)
        for talkid,msgid,mtype,text,title,sender,date,opt1,opt2,opt3,opt4,opt5 in c.execute(
            "select TALKID,MESSAGEID,MESSAGETYPE,MESSAGETEXT,TALK_TITLE,SENDERID,SAVE_DATE,OPT1,OPT2,OPT3,OPT4,OPT5 from CHATLOG"):
            fields=[dec(x) for x in (text,title,opt1,opt2,opt3,opt4,opt5)]
            hay="\n".join(fields).lower()
            matched=[k for k in KEYS if k.lower() in hay]
            if matched:
                room=rooms.get(talkid,{})
                hits.append({"date":date,"talk_id":talkid,"message_id":msgid,"sender_id":dec(sender),
                    "members":room.get("members",""),"room_title":room.get("title","") or dec(title),
                    "message_type":dec(mtype),"message":fields[0],"attachments":" | ".join(x for x in fields[2:] if x),
                    "matched_keywords":", ".join(matched),"db_file":f.name})
        c.close()
    except Exception as e: errors.append({"file":str(f),"error":str(e)})
hits.sort(key=lambda x:x["date"] or "")
with (OUT/"baromi_관련메시지.csv").open("w",encoding="utf-8-sig",newline="") as fp:
    w=csv.DictWriter(fp,fieldnames=hits[0].keys() if hits else ["date"]);w.writeheader();w.writerows(hits)
(OUT/"baromi_관련메시지.json").write_text(json.dumps(hits,ensure_ascii=False,indent=2),encoding="utf-8")
(OUT/"baromi_읽기오류.json").write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"chat_rooms":len(rooms),"db_files":len(list(SRC.glob('ChatLog_*.edb'))),"hits":len(hits),"errors":len(errors)},ensure_ascii=False))
