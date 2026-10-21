"""Read-only comparison of every saved version with provided, same-named CAD sources."""
import sys,json,gzip,hashlib,math
from pathlib import Path
from collections import defaultdict,Counter
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scripts.audit_cad_coordinates import parse_source,OUT
from scipy.spatial import cKDTree

def source_data(path):
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 caches=list(OUT.glob("*/"+digest+".json.gz"))
 if caches:return json.load(gzip.open(caches[0],"rt",encoding="utf8")),digest
 return parse_source("all-versions-"+digest[:12],path)

def compare(saved,raw):
 f=saved.get("filter") or {}
 low=f.get("minDiameter",0);high=f.get("maxDiameter",float("inf"))
 eligible=[c for c in raw["circles"] if low-1e-9<=2*c["radius"]<=high+1e-9]
 groups=defaultdict(list)
 for i,c in enumerate(eligible):groups[round(c["radius"],6)].append((i,c))
 trees={r:cKDTree([(c["center_x"],c["center_y"]) for _,c in cs]) for r,cs in groups.items()}
 used=set();missing=[];distances=[]
 for c in saved["circles"]:
  r=round(c["radius"],6)
  ids=trees[r].query_ball_point([c["center_x"],c["center_y"]],.0001) if r in trees else []
  candidates=[groups[r][j] for j in ids if groups[r][j][0] not in used]
  if not candidates:
   nearest=None
   if r in trees:
    distance,j=trees[r].query([c["center_x"],c["center_y"]]);n=groups[r][j][1]
    nearest={"distance":float(distance),"x":n["center_x"],"y":n["center_y"]}
   missing.append({"id":c["id"],"number":(c.get("matched_text") or {}).get("text"),"building":c.get("building_name"),"layer":c.get("layer"),"x":c["center_x"],"y":c["center_y"],"nearest":nearest});continue
  i,n=min(candidates,key=lambda t:math.hypot(t[1]["center_x"]-c["center_x"],t[1]["center_y"]-c["center_y"]))
  used.add(i);distances.append(math.hypot(n["center_x"]-c["center_x"],n["center_y"]-c["center_y"]))
 return {"savedCount":len(saved["circles"]),"cadEligible":len(eligible),"matched":len(used),"savedUnmatched":missing,"cadUnmatched":len(eligible)-len(used),"maxMatchedDifference":max(distances,default=0)}

def main():
 files=defaultdict(list)
 for folder in ROOT.iterdir():
  if folder.is_dir() and folder.name not in {"data","backend","frontend",".git",".cursor","tools","scripts","logs"}:
   for p in folder.rglob("*"):
    if p.is_file() and p.suffix.lower() in {".dwg",".dxf"}:files[p.name].append(p)
 reports=[]
 for entry in json.loads((ROOT/"data/saved_works/index.json").read_text(encoding="utf8")):
  savedpath=ROOT/"data/saved_works"/(entry["id"]+".json")
  saved=json.loads(savedpath.read_text(encoding="utf8"))
  report={k:entry.get(k) for k in ["id","project","title","timestamp","sourceFileName"]}
  report["savedFileSha256"]=hashlib.sha256(savedpath.read_bytes()).hexdigest()
  paths=files.get(entry.get("sourceFileName"),[])
  report["comparisons"]=[]
  for path in paths:
   raw,digest=source_data(path)
   result=compare(saved,raw)
   report["comparisons"].append({"source":str(path),"sha256":digest,**result})
   print(entry["id"],"matched",result["matched"],"saved",result["savedCount"],"extra CAD",result["cadUnmatched"],flush=True)
  if not paths:report["status"]="source-not-provided"
  else:report["status"]="checked"
  reports.append(report)
  (OUT/"all-saved-versions-audit.json").write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding="utf8")
 print("TOTAL",len(reports),Counter(r["status"] for r in reports),flush=True)
if __name__=="__main__":main()
