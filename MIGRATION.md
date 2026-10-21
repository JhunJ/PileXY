# 파일 마스터를 다른 Windows PC로 옮기기

코드 저장소를 받는 것만으로는 기존 작업이 복원되지 않습니다. `data/`는 Git에서 제외되어 있으므로 **비공개 GitHub 백업 Release의 전체 분할 파일과 manifest**를 함께 받아 복원해야 합니다. 인증 설정은 암호화되어 있으며 **별도로 보관한 복구 키**가 있어야 사용할 수 있습니다.

## 이번 백업의 범위

백업 시점 작업 폴더에 **남아 있는** 코드·문서·로그와 `data/` 전체(저장 작업·윤곽 설정·시공 DB·시공 원본 엑셀·수동 매칭 이력·토지대장·복구 자료·남아 있는 기존 백업)를 포함합니다. 이전 준비 중 사용자가 삭제한 현장별 원본 CAD 폴더·정사영상 캐시·이전 백업은 되살리지 않습니다. SQLite는 온라인 백업 API로 일관된 사본을 만듭니다. Git 이력, Python 가상환경 등 제외된 파일은 manifest의 `exclusions`에서 확인할 수 있습니다. 코드 이력은 원래 GitHub 코드 저장소에서 받습니다.

`.env`, Meissa 테스트 자격 증명, 전용 Cloudflare 터널 토큰, 기존 예약 작업 XML 등은 `private-config/private-config.sealed` 안에 암호화합니다. **복구 키는 GitHub에 올리지 않습니다.** Release와 키를 같이 보관하면 그 둘에 접근하는 사람이 인증 설정을 복호화할 수 있습니다.

2026-10-22 이전 점검 기준 서버 저장본은 작업 버전 65개(현장 10개), 시공 데이터셋 91개, 시공 행 64,283개입니다. 실제 백업 기준 파일 목록과 크기는 `migration-manifest.json`을 기준으로 합니다.

## 이전 PC를 분리하기 전

1. 열어 둔 파일 마스터에서 진행 중인 도면은 **신규 저장/수정 저장**, 윤곽 설정은 **설정 저장/수정**을 마칩니다. 서버 저장 실패 메시지가 있는 데이터는 해당 브라우저에만 남을 수 있습니다.
2. 새 백업을 만든 뒤 코드 push와 비공개 Release 업로드 완료 및 검증 결과를 확인합니다. 백업이 끝난 뒤 변경한 작업은 다음 백업에만 들어갑니다.
3. 별도 복구 키 파일을 USB 등 다음 PC에서 접근 가능한 곳에 복사합니다. 기존 PC에만 키를 두지 마세요.
4. 새 PC의 로컬 복원이 확인될 때까지 기존 PC의 `D:\PileXY`는 보관합니다.

도면 업로드 직후의 서버 메모리, 저장하지 않은 편집, 브라우저 로그인 쿠키는 디스크 백업으로 복원할 수 없습니다. 이번 작업에서 기존 사용자 브라우저 탭에 접근할 수 없어 브라우저 전용 저장 상태는 자동 수집하지 못했습니다. 서버 저장을 마친 작업·설정·자재/기성 상태는 `data/`에 들어 있습니다.

## 새 PC에서 복원

Python 3.12를 설치합니다. `py -3.12 --version`으로 확인한 뒤 복호화 라이브러리를 준비합니다.

```powershell
py -3.12 -m pip install pycryptodome
```

비공개 GitHub 백업 Release에서 다음 파일을 **같은 다운로드 폴더**에 모두 받습니다.

- `migration-manifest.json`
- `migration.zip.part001`부터 마지막 part까지 전부
- 복원 실행용 `restore_migration.ps1`(Release에 없으면 코드 저장소의 `scripts/restore_migration.ps1`)

전체 `migration.zip`도 받았다면 part를 합치는 단계는 생략됩니다. 분할 파일 각각은 최대 1,500 MiB입니다. 다운로드 공간, 합친 ZIP, 복원된 폴더가 동시에 필요하므로 새 PC에 여유 공간을 충분히 확보합니다. 다운로드 폴더와 복원 대상은 분리합니다.

가능하면 기존과 같은 **`D:\PileXY`**로 복원합니다. D: 드라이브가 없으면 `C:\PileXY` 등을 지정해도 복원 스크립트가 시공 DB의 엑셀 경로를 새 위치로 바꿉니다. **대상 폴더는 없거나 비어 있어야 합니다.** 이미 clone한 코드 폴더 위에는 덮어쓰지 않습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\이전자료\restore_migration.ps1" `
  -ManifestPath "C:\이전자료\migration-manifest.json" `
  -TargetRoot "D:\PileXY" `
  -KeyFile "E:\별도보관\pilexy-migration-recovery-key.txt"
```

`py` 실행기가 없거나 다른 Python을 쓰면 `-PythonExecutable "C:\Python312\python.exe"`를 추가합니다. 스크립트는 분할 파일·합친 ZIP·각 파일의 SHA-256과 ZIP CRC를 검사한 뒤 복원하고, 시공 DB 무결성과 엑셀 원본 존재 여부를 확인합니다. 실패하면 일부 복원 폴더를 남겨 원인을 확인할 수 있도록 합니다. 원본 PC나 기존 폴더를 삭제하지 않습니다.

복구 키를 지정하면 `.env`와 테스트 설정을 제자리로 복원합니다. 복호화한 인증 자료와 예약 작업 XML은 현재 사용자 전용 `%LOCALAPPDATA%\PileXY\Migration\<고유 ID>`에 남습니다. 위치는 실행 결과와 `D:\PileXY\migration-restore-report.json`에 기록합니다. 예약 작업·터널·DNS는 자동으로 켜지지 않습니다.

## 로컬 실행 확인

Python 가상환경은 PC에 종속되므로 새로 만듭니다.

```powershell
Set-Location D:\PileXY
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv\Scripts\python.exe -m playwright install chromium
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 3001
```

브라우저에서 `http://127.0.0.1:3001/`을 열어 현장 목록, 저장 도면, 윤곽, 시공 기록, 자재·기성 상태를 확인합니다. DWG 직접 업로드를 사용하려면 새 PC에도 ODA File Converter를 설치해야 합니다. DXF 파일에는 필요하지 않습니다. VWorld는 복원한 `.env`를 사용하고, Meissa/PDAM/BRDS 등 만료된 로그인은 새 PC에서 다시 로그인합니다.

## 같은 공개 도메인으로 전환

현재 운영 주소는 `pilexy.yeobaekstudio.com`이고 전용 Cloudflare 터널은 새 PC의 `http://127.0.0.1:3001`을 향해야 합니다. `cloudflared-config.yml`에 적힌 `pilexy1.yeobaekstudio.com:8001` 경로와 혼동하지 마세요. 토큰 방식 터널의 공개 호스트 설정은 Cloudflare 관리 화면에 있습니다.

1. 새 PC에 Cloudflare 공식 `cloudflared`를 설치합니다. 기본 스크립트 경로는 `C:\Program Files (x86)\cloudflared\cloudflared.exe`입니다.
2. 기존 PC에서 예약 작업 **PileXY Cloudflare Tunnel**을 중지하거나 기존 PC를 끕니다. 서로 다른 데이터 사본을 가진 두 PC의 연결을 같은 터널에 동시에 두면 요청이 두 PC로 나뉠 수 있습니다. 이 PC의 다른 도메인용 공유 Cloudflared 서비스는 별도입니다.
3. 새 PC의 로컬 서버가 3001 포트로 정상 실행 중인지 확인합니다.
4. 복호화 자료 폴더의 전용 토큰으로 다음 명령을 실행합니다. 토큰 내용은 명령행에 붙여 넣지 않습니다.

```powershell
Set-Location D:\PileXY
.\scripts\setup_cloudflare_tunnel.ps1 `
  -TokenFile "$env:LOCALAPPDATA\PileXY\Migration\<고유 ID>\cloudflare\tunnel-token.txt"
```

설치 경로가 다르면 `-CloudflaredPath`를 지정합니다. 이 명령은 토큰을 현재 사용자 전용 위치로 저장하고 **PileXY Cloudflare Tunnel** 로그인 예약 작업을 등록·시작합니다. 기존과 같은 전용 터널을 이어 쓰면 도메인을 새로 구입할 필요가 없습니다. 최종적으로 공개 도메인에서 저장 작업이 정상 보이는지 확인합니다.

## 자동 실행과 향후 동기화

옮겨 온 예약 작업 XML은 참고용입니다. 이전 사용자 계정과 절대 경로를 그대로 가져와 자동 등록하지 않습니다. 새 PC에서 다음 명령으로 백엔드 **PileXY Backend** 로그인 예약 작업과 매일 백업 작업을 등록합니다. 백엔드는 기본적으로 로컬 `127.0.0.1:3001`에서 실행됩니다.

```powershell
.\scripts\setup_backend_task.ps1
.\scripts\setup_auto_backup_tasks.ps1 -RetentionDays 30
```

기존 `backup_now.ps1`의 매일 백업은 핵심 작업 폴더 일부만 압축합니다. 이번과 같은 전체 PC 이전용 백업은 `scripts/migration_archive.py`를 사용해야 합니다. 임시 PC에서 새 작업을 한 뒤 원래 PC로 돌아올 때도 **임시 PC의 최신 전체 백업을 다시 생성·복원**합니다. Git push만으로 시공 DB와 도면 작업 데이터가 동기화되지는 않습니다.

복원 ZIP에는 `.git`이 들어 있지 않습니다. 앞으로 코드 변경도 GitHub에 올릴 때는 복원 폴더를 기존 원격 저장소와 연결합니다. 아래 명령은 서버 저장 데이터를 덮어쓰지 않고 현재 파일을 유지한 채 Git 기준 이력만 연결합니다.

```powershell
git -C D:\PileXY init
git -C D:\PileXY remote add origin https://github.com/JhunJ/PileXY.git
git -C D:\PileXY fetch origin
git -C D:\PileXY reset --mixed origin/main
git -C D:\PileXY branch -M main
git -C D:\PileXY status --short
```

이번 이전 준비에서 기존 백엔드 테스트는 187개 통과·기존 실패 3개, 프론트엔드 테스트는 68개 통과였습니다. 이전 자체의 검증은 별도로 manifest 파일별 SHA-256·ZIP CRC·SQLite 무결성으로 수행합니다.

## 브라우저에만 남은 설정이 있을 때

서버 저장 실패로 남은 윤곽·기성 캐시와 즐겨찾기를 꼭 옮겨야 하면 기존 PC의 파일 마스터 페이지에서 개발자 도구 콘솔로 앱 전용 localStorage를 내려받을 수 있습니다. 로그인 토큰을 포함할 수 있으므로 이 파일도 공개 저장소에 올리지 않습니다.

```javascript
const entries = Object.fromEntries(Object.keys(localStorage)
  .filter(k => /^pilexy/i.test(k) || k === 'meissaOrthoDiag')
  .map(k => [k, localStorage.getItem(k)]));
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([JSON.stringify({origin: location.origin, entries})], {type: 'application/json'}));
link.download = 'pilexy-browser-storage.json';
link.click();
URL.revokeObjectURL(link.href);
```

새 PC에서 같은 도메인을 연 뒤, 콘솔에서 아래 코드를 실행하고 위 파일을 선택하면 해당 앱 키만 가져옵니다. 서버에 더 최신 작업이 있다면 기존 캐시를 가져오지 않는 편이 좋습니다.

```javascript
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = '.json';
picker.onchange = async () => {
  const data = JSON.parse(await picker.files[0].text());
  if (data.origin !== location.origin) throw new Error('내보낸 도메인과 현재 도메인이 다릅니다.');
  for (const [key, value] of Object.entries(data.entries || {})) {
    if ((/^pilexy/i.test(key) || key === 'meissaOrthoDiag') && typeof value === 'string') localStorage.setItem(key, value);
  }
  console.log('앱 설정을 가져왔습니다. 페이지를 새로 여세요.');
};
picker.click();
```
