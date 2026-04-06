import re
from pathlib import Path
p = Path(__import__("os").environ.get("TEMP", "/tmp")) / "meissa-index.js"
s = p.read_text(encoding="utf-8", errors="ignore")
for m in re.finditer(r"/auth/[a-zA-Z0-9/_-]+", s):
    if m.group() not in ("/auth/",):
        print(m.group())
