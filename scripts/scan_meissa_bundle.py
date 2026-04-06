"""Scan cloud.meissa.ai main bundle for API paths (download index-LasqyPy-*.js first)."""
import re
import sys
from collections import Counter

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else ""
    if not path:
        print("Usage: python scan_meissa_bundle.py <path-to-index-*.js>")
        return
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            s = f.read()
    except OSError as exc:
        print("Cannot read:", exc)
        return
    for pat in (
        r'baseURL:\s*"([^"]+)"',
        r"baseURL:\s*'([^']+)'",
        r'baseURL:\s*([a-zA-Z0-9_$.]+)',
    ):
        m = re.search(pat, s)
        if m:
            print("baseURL match:", pat, "->", m.group(1)[:200])
            break
    else:
        print("baseURL: not found with simple patterns")

    api_paths = re.findall(r"/api/v[34]/[a-zA-Z0-9_./{}$-]+", s)
    print("unique /api/v3|v4 paths (count):", len(set(api_paths)))
    for p, n in Counter(api_paths).most_common(25):
        print(n, p)

    for kw in ("dsm", "DSM", "elevation", "height", "zPosition", "point-detail", "subTask"):
        if kw in s:
            print("keyword found:", kw)
    # Paths that look like z/elevation sampling
    zpaths = [p for p in set(api_paths) if any(x in p.lower() for x in ("dsm", "elev", "height", "z", "terrain", "surface"))]
    print("--- z-ish paths ---")
    for p in sorted(zpaths)[:40]:
        print(p)

    # Snippets: axios Te.get/post near "dsm" or "DSM" or "elevation"
    low = s.lower()
    keys = ("dsm", "elevation", "heightat", "height_at", "sampleheight", "terrain")
    for k in keys:
        i = 0
        found = 0
        while found < 3 and i < len(low):
            j = low.find(k, i)
            if j < 0:
                break
            a = max(0, j - 120)
            b = min(len(s), j + 200)
            snippet = s[a:b].replace("\n", " ")
            if "Te." in snippet or "/api/" in snippet:
                print("--- snippet ---", k, "...", snippet)
                found += 1
            i = j + len(k)


if __name__ == "__main__":
    main()
