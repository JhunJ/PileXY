import os
from pathlib import Path
t = Path(os.environ["TEMP"]) / "meissa-index.js"
s = t.read_text(encoding="utf-8", errors="ignore")
needle = 'sle.post'
i = 0
n = 0
while n < 15:
    j = s.find(needle, i)
    if j == -1:
        break
    print(s[j : j + 250].replace("\n", " "))
    i = j + 10
    n += 1
