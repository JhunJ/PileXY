import os,re
from pathlib import Path
s = Path(os.environ["TEMP"]) / "meissa-index.js"
t = s.read_text(encoding="utf-8", errors="ignore")
for pat in [r"/api/v4/project/\$\{[^}]+\}(?!/resource)", r'Te\.get\("/api/v4/project/']:
    pass
paths = sorted(set(re.findall(r'"/api/v4/project/[^"]+"', t)))
for p in paths[:40]:
    print(p)
