import os,re
from pathlib import Path
s = Path(os.environ["TEMP"]) / "meissa-index.js"
t = s.read_text(encoding="utf-8", errors="ignore")
paths = set(re.findall(r"Te\.get\(`(/api/[^`]+)`", t))
paths |= set(re.findall(r'Te\.get\("(/api/[^"]+)"', t))
for p in sorted(paths):
    if "snapshot" in p.lower() or "zone" in p.lower() and "project" in p:
        print(p)
