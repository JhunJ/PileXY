import sqlite3
from pathlib import Path

p = Path(r"D:\정헌재 선임_2025\건축_BIM\PileXY\outputs\PHC_20260915\baromi_work")
for f in p.glob("*.edb"):
    print("\nFILE", f.name, f.read_bytes()[:32])
    try:
        c = sqlite3.connect(f"file:{f.as_posix()}?mode=ro", uri=True)
        for row in c.execute("select name, sql from sqlite_master where type='table'"):
            print(row)
        if f.name == "ChatList.edb":
            print("ROWS", c.execute("select count(*) from CHATROOM").fetchone())
            for row in c.execute("select TALKID,TALK_TITLE,LAST_SAVEDATE,LAST_MESSAGETEXT,MEMBERIDLIST from CHATROOM order by LAST_SAVEDATE desc"):
                print("ROOM", [repr(x)[:500] for x in row])
        else:
            print("ROWS", c.execute("select count(*) from CHATLOG").fetchone())
            for row in c.execute("select TALKID,MESSAGEID,MESSAGETYPE,MESSAGETEXT,TALK_TITLE,SENDERID,SAVE_DATE from CHATLOG order by SAVE_DATE desc limit 20"):
                print("MSG", [repr(x)[:500] for x in row])
    except Exception as e:
        print(type(e).__name__, e)
