import base64, sqlite3, sys
from pathlib import Path

def dec(v):
    if v is None:return ""
    if isinstance(v,str):v=v.encode('ascii','ignore')
    try:return base64.b64decode(v,validate=True).decode('utf-16le','replace').rstrip('\x00')
    except:return str(v)

f=Path(sys.argv[1])
c=sqlite3.connect(f"file:{f.as_posix()}?mode=ro",uri=True)
for row in c.execute("select SAVE_DATE,SENDERID,MESSAGETYPE,MESSAGETEXT,OPT1,OPT2,OPT3,OPT4,OPT5 from CHATLOG order by SAVE_DATE"):
    vals=[dec(x) for x in row]
    extra=' | '.join(x for x in vals[4:] if x and not x.startswith('TalkFont'))
    print(f"{vals[0]}\t{vals[1]}\t{vals[3]}" + (f"\t[{extra}]" if extra else ""))
