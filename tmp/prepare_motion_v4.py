from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'outputs/PHC_20260915_v2/작업파일/build_phc_motion_v3.py'
s=p.read_text(encoding='utf-8')
s=s.replace("WORK=OUT/'작업파일'", "WORK=OUT/'작업파일_v4'")
s=s.replace('토스스타일_v3_1080p.mp4','토스스타일_v4_1080p.mp4')
s=s.replace("    d.line((665,824,1255,824),fill='#D5DDE7',width=2)\n    dotx=665+590*((t-4.4)/max(.1,duration-5.0)%1);d.ellipse((dotx-7,817,dotx+7,831),fill=BLUE)\n",'')
changes={
'말뚝 하나의 위치.':'말뚝의 위치와 번호,',
'수천 개 말뚝의 번호와 좌표.\\n도면, 측량, 시공기록이 서로 맞아야 합니다.':'수천 개의 말뚝을 시공하려면,\\n도면과 좌표, 시공기록이 서로 맞아야 합니다.',
'말뚝 하나의 위치와 번호를, 도면부터 시공기록까지 같은 기준으로 확인합니다.':'도면과 시공기록이 같은 말뚝을 가리키는지 확인합니다.',
'좌표의 차이는 추가 확인과 도면 대조로 이어집니다. 시공 전에 찾아내는 이유입니다.':'좌표가 다르면 현장에서 다시 확인해야 합니다. 그래서 시공 전에 비교합니다.',
'자료를 받는 것만으로는 충분하지 않습니다. 같은 말뚝인지 서로 비교해야 합니다.':'도면과 좌표표, 시공기록을 같은 말뚝 번호로 맞춰봐야 합니다.',
'자료를 번호와 좌표로 연결하고, 차이가 있는 위치를 현장과 함께 확인합니다.':'번호와 좌표를 비교한 뒤, 다른 부분을 현장과 함께 확인합니다.',
'프로젝트와 작업 버전부터.':'먼저, 현장의 저장 작업을 불러옵니다.',
'현장 담당자는 본사에서 세팅한 프로젝트와 작업 버전을 불러와 확인합니다.':'현장을 선택하고, 본사에서 준비한 최신 작업을 불러옵니다.',
'과거 검토 화면의 중복 좌표 2그룹. 목록과 도면을 함께 확인해 현장에 전달했습니다.':'같은 좌표에 말뚝이 겹친 두 곳을 찾아, 도면과 함께 현장에 전달했습니다.',
'동·번호와 X·Y 좌표 컬럼을 지정해 비교하고, 차이가 있는 항목을 목록으로 확인합니다.':'엑셀에서 동, 말뚝 번호, X·Y 좌표 열을 선택하면 다른 항목을 찾아줍니다.',
'PDAM 시공기록을 연결하고, 조건을 선택해 시공완료와 미시공 좌표를 확인합니다.':'PDAM 기록을 연결하면, 시공한 말뚝과 아직 시공하지 않은 말뚝을 볼 수 있습니다.',
'날짜를 따라, 시공 흐름이 보입니다.':'날짜별로 어디까지 시공했는지 확인합니다.',
'시공현황에서 「시공일」·「일별」을 선택하면, 날짜 순서대로 좌표 색상이 바뀝니다.':'‘일별’을 선택해 재생하면, 날짜에 따라 시공한 말뚝의 색이 바뀝니다.',
'현장은 일별 구분을 시공 누락 확인, 장비 동선 계획, 감리 현황 공유에 활용한다고 했습니다.':'일별 현황은 빠진 말뚝을 찾고, 다음 작업 동선을 계획하는 데 도움이 됩니다.',
'시공기록과 기초 조건을 함께 검토해 월별 기성 내역과 계산 결과를 정리합니다.':'시공기록과 기초 조건을 확인한 뒤, 월별 기성 내역을 정리합니다.',
'FILE MASTER · 건축BIM팀':'PILE MASTER · 건축BIM팀',
}
for a,b in changes.items():
    assert a in s,a
    s=s.replace(a,b)
old="  photograph(im,seq[j],(115,258,1690,678),zoom=1.06,focus=(.5,.58))"
new="""  # Keep every pixel of the captured viewport: no cover-crop or animated zoom.
  src=image(str(seq[j])); sw,sh=src.size
  scale=min(1690/sw,690/sh); nw,nh=round(sw*scale),round(sh*scale)
  im.paste(src.resize((nw,nh),Image.Resampling.LANCZOS),((W-nw)//2,255+(690-nh)//2))"""
assert old in s
s=s.replace(old,new)
(root/'tmp/build_phc_motion_v4.py').write_text(s,encoding='utf-8')
print('v4 source ready')
