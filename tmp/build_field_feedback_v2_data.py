import json
import shutil
from pathlib import Path

ROOT = Path(r"D:\정헌재 선임_2025\건축_BIM\PileXY")
OUT = ROOT / "outputs" / "PHC_20260915" / "현장피드백_v2"
EVID = OUT / "근거이미지"
EVID.mkdir(parents=True, exist_ok=True)

evidence_sources = {
    "E01_청주센텀_중복좌표.png": Path(r"D:\정헌재 선임_2025\건축_BIM\파일마스터\청주센텀자이\청주센텀자이 오류1.png"),
    "E02_청주센텀_PDAM위치.png": Path(r"D:\정헌재 선임_2025\건축_BIM\파일마스터\청주센텀자이\요청\260413_PDAM 위치 표기 오류.png"),
    "E03_청주센텀_파일일람.png": Path(r"D:\정헌재 선임_2025\건축_BIM\파일마스터\청주센텀자이\요청\260413_파일 일람 표기 실수.png"),
    "E04_청주씨엘리체_CAD요약.jpg": Path(r"C:\Baromi\temp\ClipBoard_0825170203791.jpg"),
    "E05_청주씨엘리체_비교표.jpg": Path(r"C:\Baromi\temp\ClipBoard_0825170222580.jpg"),
    "E06_인천계양_CAD요약.jpg": Path(r"C:\Baromi\temp\ClipBoard_0826165927627.jpg"),
    "E07_인천계양_비교표.jpg": Path(r"C:\Baromi\temp\ClipBoard_0826165853069.jpg"),
    "E08_천안업성_표시누락.jpg": Path(r"C:\Baromi\temp\ClipBoard_0831124700630.jpg"),
    "E09_검암_CAD요약.jpg": Path(r"C:\Baromi\temp\260907142959.jpg"),
    "E10_검암_비교표.jpg": Path(r"C:\Baromi\temp\ClipBoard_0907161345991.jpg"),
    "E11_써밋클라비온_중복.jpg": Path(r"C:\Baromi\temp\ClipBoard_0909091938076.jpg"),
}
for name, src in evidence_sources.items():
    shutil.copy2(src, EVID / name)

sites = [
    {"code":"CJ","site":"청주센텀푸르지오자이","date":"2026-04-07~05-13","count":5,"basis":"프로그램 중복좌표 2그룹, PDAM 위치 2행, 파일일람 표기 1영역","evidence":"E01~E03 / Baromi 회신 2건"},
    {"code":"CC","site":"청주푸르지오씨엘리체","date":"2026-08-25","count":17,"basis":"좌표 불일치 7행, 화면·번호 누락 5건, 좌표 중복 5건","evidence":"E04~E05"},
    {"code":"IC","site":"인천계양 A10BL","date":"2026-08-26","count":13,"basis":"좌표 불일치 10행, 1004동 112번 중복 2건, 1009동 1번 표시 누락 1건","evidence":"E06~E07"},
    {"code":"CU","site":"천안 업성푸르지오 레이크시티 1단지","date":"2026-08-31","count":1,"basis":"지하주차장 1250번 부근 파일표시 누락 1건","evidence":"E08"},
    {"code":"GA","site":"검암 푸르지오 프라베뉴","date":"2026-09-07~09-08","count":4,"basis":"엑셀 476번 도면 누락 1건, 번호 누락 2건, 476·477 번호 중첩 1건","evidence":"E09~E10 / Baromi 대화 내보내기"},
    {"code":"SC","site":"써밋클라비온(신길10구역)","date":"2026-09-09","count":5,"basis":"도면 원(Circle) 중복 표기 5건","evidence":"E11"},
]

findings = []
def add(site, no, category, location, detail, evidence, confidence="확정"):
    findings.append({"id":f"{site}-{no:02d}","site":next(s["site"] for s in sites if s["code"]==site),"category":category,"location":location,"detail":detail,"evidence":evidence,"confidence":confidence})

add("CJ",1,"중복좌표","지하주차장 / 좌표 Y 449313.80, X 242764.44","Circle C4137·C4138, 매칭번호 163, Count 2","E01")
add("CJ",2,"중복좌표","지하주차장 / 좌표 Y 449462.60, X 242666.65","Circle C4236·C4237, 매칭번호 120, Count 2","E01")
add("CJ",3,"PDAM 위치표기","8-70","주차장으로 표기되었으나 108동 위치로 검토 표시","E02")
add("CJ",4,"PDAM 위치표기","8-43","주차장으로 표기된 위치 오류 행","E02")
add("CJ",5,"파일일람 표기","P2/P2F, 200~203번","P2와 P2F 표기가 겹쳐 번호 판독이 혼동되는 영역","E03")

for i,(loc,dist) in enumerate([("107동 206번",1.250),("107동 207번",1.250),("110동 31번",2.685),("110동 32번",1.250),("110동 33번",3.769),("공동시설 165번",3.550),("공동시설 166번",3.550)],1):
    add("CC",i,"좌표 불일치",loc,f"엑셀 좌표와 도면 좌표 거리 차이 {dist:.3f} m","E05")
add("CC",8,"표시 누락","109동 60번","시공사 원본에는 있으나 현재 화면에서 누락","E05")
for no,num in enumerate([110,111,145,224],9): add("CC",no,"표시 누락",f"지하주차장 {num}번","시공사 원본에는 있으나 현재 화면에서 누락","E04/E05")
for no in range(13,18): add("CC",no,"중복좌표",f"도면 지시 위치 {no-12}","좌표 중복오류로 표시된 5개 위치 중 1개","E04","위치표시 확정")

for i,(loc,dist) in enumerate([("1002동 50번",0.029),("1002동 80번",0.025),("1003동 35번",0.020),("1004동 72번",0.056),("1005동 14번",0.024),("1005동 35번",0.033),("1005동 70번",0.026),("1006동 209번",0.021),("B11 205번",0.033),("B11 614번",0.015)],1):
    add("IC",i,"좌표 불일치",loc,f"엑셀 좌표와 시공사 원본 좌표 차이 {dist:.3f} m","E07")
add("IC",11,"번호 중복","1004동 112번 / 중복 객체 1","동일 번호가 2건 존재","E06")
add("IC",12,"번호 중복","1004동 112번 / 중복 객체 2","동일 번호가 2건 존재","E06")
add("IC",13,"파일표시 누락","1009동 1번","도면에 파일표시 없음","E06")

add("CU",1,"파일표시 누락","지하주차장 1250번 부근","좌표표 인근 도면에서 파일표시 없음","E08")

add("GA",1,"도면 누락","지하주차장 476번","엑셀에는 있으나 도면에 누락","E10/Baromi")
add("GA",2,"번호 누락","도면 지시 위치 1","도면 파일 객체의 번호 누락","E09/Baromi")
add("GA",3,"번호 누락","도면 지시 위치 2","도면 파일 객체의 번호 누락","E09/Baromi")
add("GA",4,"번호 중첩","476번·477번","두 번호 표기가 겹침","E09/Baromi")

for no in range(1,6): add("SC",no,"원(Circle) 중복",f"도면 지시 위치 {no}","중복 원으로 표시된 5개 위치 중 1개","E11","위치표시 확정")

assert sum(s["count"] for s in sites) == 45
assert len(findings) == 45

feedback = [
    {"site":"청주센텀푸르지오자이","date":"2026-05-08","speaker":"유현수","quote":"현장에서 시공현황 체크하는 것이 용이함. 기존 PDAM을 쓰다 보니 아직 익숙하지 않음. 전반적으로 사용하는 데는 문제없음.","meaning":"현황 확인 효율은 긍정적이며 초기 숙련 지원 필요"},
    {"site":"청주센텀푸르지오자이","date":"2026-05-13","speaker":"한영규","quote":"일별 기록표기는 시공 누락 파일 파악과 추후 동선 계획에 도움이 되며, 감리도 일일 작업현황별 다른 색 표기를 원함.","meaning":"일자별 시뮬레이션과 색상 구분의 현장 활용 근거"},
    {"site":"검암 푸르지오 프라베뉴","date":"2026-09-07","speaker":"오경수","quote":"파일 넘버링만이라도 검토가 가능한지 요청. 좌표값, 넘버링 도면, 구조일람표를 송부.","meaning":"현장이 직접 자료를 제공하고 넘버링 검토를 요청"},
    {"site":"검암 푸르지오 프라베뉴","date":"2026-09-08","speaker":"정헌재","quote":"엑셀 476번 파일 도면 누락, 도면 번호누락 2건, 476·477 번호 중첩 1건을 회신.","meaning":"요청 다음 날 4개 오류를 번호화해 회신"},
]

payload={"as_of":"2026-09-15","site_count":len(sites),"finding_count":len(findings),"sites":sites,"findings":findings,"feedback":feedback,"evidence_files":list(evidence_sources)}
(OUT/"현장피드백_집계데이터.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
print(OUT/"현장피드백_집계데이터.json")
