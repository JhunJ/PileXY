import re
from pathlib import Path
import os
p = Path(os.environ.get("TEMP", "/tmp")) / "meissa-index.js"
s = p.read_text(encoding="utf-8", errors="ignore")
for pat in ["auth/token", "auth/login", "result.access", "access_token", '"access"', "refresh_token"]:
    i = s.find(pat)
    if i != -1:
        print(pat, "->", s[i : i + 120].replace("\n", " "))
