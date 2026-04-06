import os
from pathlib import Path
s = Path(os.environ["TEMP"]) / "meissa-index.js"
t = s.read_text(encoding="utf-8", errors="ignore")
for needle in ["post(\"/auth", "post(`/auth", "post('/auth", "login\"", "password\""]:
    i = 0
    while True:
        j = t.find(needle, i)
        if j == -1:
            break
        print(t[j : j + 180].replace("\n", " "))
        i = j + 1
        if i > j + 500000:
            break
    print("---")
