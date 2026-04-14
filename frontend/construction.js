(function () {
  const constructionDrawer = document.getElementById("construction-drawer");
  const constructionFoundationThicknessBtn = document.getElementById("construction-foundation-thickness-btn");
  const constructionStatusBtn = document.getElementById("construction-status-btn");
  const constructionSettlementBtn = document.getElementById("construction-settlement-btn");

  if (!constructionDrawer || !constructionFoundationThicknessBtn || !constructionStatusBtn || !constructionSettlementBtn) {
    return;
  }

  /** 슬라이더(0–FOUNDATION_AREA_SLIDER_MAX)는 boundMin~boundMax 면적에 선형 매핑. `polygonArea`(도면 좌표²)와 동일 스케일이어야 함. */
  const FOUNDATION_AREA_ABS_MAX = Number.MAX_SAFE_INTEGER;
  const FOUNDATION_AREA_SLIDER_MAX = 100;

  constructionDrawer.innerHTML = `
    <div class="construction-drawer-header">
      <div>
        <strong id="construction-drawer-title">시공현황</strong>
        <p class="construction-drawer-subtitle">PDAM 기록지를 현재 프로젝트와 연결해서 시공 흐름과 월별 기성까지 확인합니다.</p>
      </div>
      <button type="button" id="construction-drawer-close" class="ghost">닫기</button>
    </div>
    <div class="construction-tab-strip" role="tablist" aria-label="시공 패널 탭">
      <button type="button" class="construction-tab" data-tab="settings">설정</button>
      <button type="button" class="construction-tab is-active" data-tab="status">시공현황</button>
      <button type="button" class="construction-tab" data-tab="settlement">기성정리</button>
    </div>
    <div class="construction-drawer-body">
      <section class="construction-section construction-tab-panel" data-panel="settings">
        <div class="construction-section-title">
          <span>공통 설정</span>
          <small>로그인 정보와 데이터셋은 시공현황/기성정리에서 함께 사용됩니다.</small>
        </div>
        <div class="construction-context-grid">
          <article class="construction-context-card">
            <span>현재 프로젝트</span>
            <strong id="construction-project-name">-</strong>
            <small id="construction-project-meta">불러온 프로젝트 기준으로 자동 연결됩니다.</small>
          </article>
          <article class="construction-context-card">
            <span>현재 작업</span>
            <strong id="construction-work-title">-</strong>
            <small id="construction-work-meta">저장 작업이 없으면 현재 화면 좌표를 사용합니다.</small>
          </article>
        </div>
        <div class="construction-sync-grid">
          <label>PDAM ID<input type="text" id="construction-user-id" class="save-work-input" placeholder="we8104 아이디" autocomplete="username" /></label>
          <label>비밀번호<input type="password" id="construction-password" class="save-work-input" placeholder="we8104 비밀번호" autocomplete="current-password" /></label>
        </div>
        <div class="construction-report-advanced">
          <button type="button" id="construction-report-fields-toggle" class="construction-report-toggle" aria-expanded="false" aria-controls="construction-report-fields">보고서 URL / Report ID 펼치기</button>
          <div id="construction-report-fields" class="construction-sync-grid construction-sync-grid--report" hidden>
            <label>보고서 페이지 URL<input type="text" id="construction-report-page-url" class="save-work-input" placeholder="예: https://we8104.com/..." /></label>
            <label>Report ID<input type="number" id="construction-report-id" class="save-work-input" placeholder="예: 323" /></label>
          </div>
        </div>
        <div class="construction-sync-actions">
          <button type="button" id="construction-sync-btn" class="header-construction-btn">PDAM 동기화</button>
          <button type="button" id="construction-upload-btn" class="ghost">엑셀 직접 불러오기</button>
          <input type="file" id="construction-upload-input" accept=".xlsx,.xls,.xlsm" hidden />
        </div>
        <div class="construction-section-title construction-section-title--compact">
          <span>데이터셋</span>
          <small>현재 프로젝트(상단 프로젝트명)에만 저장·목록이 묶입니다. 다른 프로젝트의 PDAM은 여기서 보이지 않습니다.</small>
        </div>
        <div class="construction-dataset-row">
          <select id="construction-dataset-select" class="save-work-select" aria-label="시공 데이터셋 선택"></select>
          <button type="button" id="construction-dataset-apply" class="construction-dataset-btn construction-dataset-btn--apply">적용</button>
          <button type="button" id="construction-dataset-delete" class="construction-dataset-btn construction-dataset-btn--delete">삭제</button>
        </div>
        <div class="construction-dataset-clear-row">
          <button type="button" id="construction-dataset-clear-overlay" class="construction-dataset-clear-btn">PDAM 색상 설정 해제</button>
        </div>
        <div id="construction-sync-status" class="construction-sync-status" aria-live="polite"></div>
      </section>
      <section class="construction-section construction-tab-panel is-active" data-panel="status">
        <div class="construction-section-title">
          <div class="construction-section-title-row">
            <span>시공 필터</span>
            <small class="soft-liability-note soft-liability-note--compact"><span aria-hidden="true">※</span>책임은 사용자에게 있습니다.</small>
          </div>
          <small>색상 기준과 기간을 먼저 정하고, 장비/공법/위치는 배지로 여러 개 선택할 수 있습니다.</small>
        </div>
        <div class="construction-filter-stack">
          <section class="construction-filter-card">
            <div class="construction-filter-card-title">
              <span>색상 및 잔량 기준 선택</span>
              <small>좌표 색상 방식과 잔량 기준을 먼저 정합니다.</small>
            </div>
            <div class="construction-filter-grid construction-filter-grid--appearance">
              <label>
                좌표 색상
                <select id="construction-overlay-mode" class="save-work-select">
                  <option value="status">박음 / 미시공</option>
                  <option value="date">시공일</option>
                  <option value="equipment">장비</option>
                  <option value="method">공법</option>
                </select>
              </label>
              <label>잔량 기준 (m)<input type="number" id="construction-remaining-threshold" class="save-work-input" step="0.1" value="0" /></label>
            </div>
          </section>
          <section class="construction-filter-card">
            <div class="construction-filter-card-title">
              <span>기간 설정</span>
              <small id="construction-date-range-note">데이터 범위를 불러오는 중입니다.</small>
            </div>
            <div class="construction-filter-grid construction-filter-grid--period">
              <label>월 빠른선택<select id="construction-month" class="save-work-select"></select></label>
              <label>주 빠른선택<select id="construction-week" class="save-work-select"></select></label>
              <label>시작일<select id="construction-date-from" class="save-work-select"></select></label>
              <label>종료일<select id="construction-date-to" class="save-work-select"></select></label>
            </div>
            <div class="construction-playback-panel">
              <div class="construction-playback-copy">
                <span>날짜 시뮬레이션</span>
                <small>선택한 기간 안에서 일별, 주별, 월별 순서로 좌표가 회색에서 색상으로 바뀝니다.</small>
              </div>
              <div class="construction-segmented" role="tablist" aria-label="시공일 시뮬레이션 기준">
                <button type="button" class="construction-segmented-btn is-active" data-playback-mode="month">월별</button>
                <button type="button" class="construction-segmented-btn" data-playback-mode="week">주별</button>
                <button type="button" class="construction-segmented-btn" data-playback-mode="day">일별</button>
              </div>
              <div class="construction-playback-actions">
                <label class="construction-playback-speed">
                  <span>배속</span>
                  <select id="construction-playback-speed" class="save-work-select">
                    <option value="0.5">0.5x</option>
                    <option value="1" selected>1x</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                  </select>
                </label>
                <button type="button" id="construction-playback-btn" class="ghost">시뮬레이션 시작</button>
                <span id="construction-playback-status" class="construction-playback-status">재생 준비 중</span>
              </div>
            </div>
          </section>
        </div>
        <div class="construction-chip-section"><span>장비</span><div id="construction-equipment-chips" class="construction-chip-group"></div></div>
        <div class="construction-chip-section"><span>공법</span><div id="construction-method-chips" class="construction-chip-group"></div></div>
        <div class="construction-chip-section"><span>위치</span><div id="construction-location-chips" class="construction-chip-group"></div></div>
        <div class="construction-filter-actions">
          <button type="button" id="construction-apply-btn" class="header-construction-btn">현황 적용</button>
          <button type="button" id="construction-reset-btn" class="ghost">필터 초기화</button>
        </div>
        <section class="construction-summary-grid" id="construction-summary-grid">
          <article class="construction-summary-card"><span>자동 매칭</span><strong id="construction-summary-auto-matched">-</strong></article>
          <article class="construction-summary-card"><span>시공 기록</span><strong id="construction-summary-records">-</strong></article>
          <article class="construction-summary-card"><span>고유 파일</span><strong id="construction-summary-unique">-</strong></article>
          <article class="construction-summary-card"><span>PDAM 시공 파일</span><strong id="construction-summary-installed-piles">-</strong></article>
          <article class="construction-summary-card"><span>시공완료 좌표</span><strong id="construction-summary-matched">-</strong></article>
          <article class="construction-summary-card"><span>미시공 좌표</span><strong id="construction-summary-pending">-</strong></article>
          <article class="construction-summary-card"><span>총 잔량 (m)</span><strong id="construction-summary-remaining">-</strong></article>
          <article class="construction-summary-card"><span>기준 초과</span><strong id="construction-summary-threshold">-</strong></article>
        </section>
        <div class="construction-section-title construction-section-title--compact">
          <span>좌표 색상 범례</span>
          <small>메인 좌표 캔버스와 같은 색으로 반영됩니다.</small>
        </div>
        <div id="construction-legend" class="construction-legend"></div>
        <div id="construction-diagnostic-overview" class="construction-diagnostic-overview"></div>
        <div class="construction-chart-grid construction-chart-grid--status">
          <div class="construction-chart-card construction-chart-card--wide"><h3>시공일 흐름</h3><div id="construction-chart-by-date" class="construction-line-chart"></div></div>
          <div class="construction-chart-card"><h3>월별 흐름</h3><div id="construction-chart-by-month" class="construction-bar-chart"></div></div>
          <div class="construction-chart-card"><h3>장비별</h3><div id="construction-chart-by-equipment" class="construction-bar-chart"></div></div>
          <div class="construction-chart-card"><h3>공법별</h3><div id="construction-chart-by-method" class="construction-bar-chart"></div></div>
        </div>
        <div class="construction-chart-card construction-chart-card--full"><h3>공법 x 파일종류 매트릭스</h3><div id="construction-method-matrix" class="construction-matrix"></div></div>
      </section>
        <div class="construction-chart-card construction-chart-card--full"><h3>자동 매칭 확인</h3><div id="construction-auto-matched-table" class="construction-diagnostic-host"></div></div>
        <div class="construction-chart-card construction-chart-card--full"><h3>PDAM / 프로젝트 비교</h3><div id="construction-diagnostic-issues" class="construction-diagnostic-host"></div></div>
      <section class="construction-section construction-tab-panel" data-panel="settlement">
        <div class="construction-section-title">
          <div class="construction-section-title-row">
            <span>월별 기성 기준</span>
            <small class="soft-liability-note soft-liability-note--compact"><span aria-hidden="true">※</span>책임은 사용자에게 있습니다.</small>
          </div>
          <small>기본은 전달 25일 ~ 선택월 20일입니다. 필요하면 월과 일자를 직접 바꿀 수 있습니다.</small>
        </div>
        <div class="construction-filter-grid construction-filter-grid--settlement">
          <label>기준 월<select id="construction-settlement-month" class="save-work-select"></select></label>
          <label>시작일<input type="number" id="construction-settlement-start-day" class="save-work-input" min="1" max="31" value="25" /></label>
          <label>종료일<input type="number" id="construction-settlement-end-day" class="save-work-input" min="1" max="31" value="20" /></label>
          <div class="construction-range-note" id="construction-settlement-period-note">기성 범위를 계산하는 중입니다.</div>
        </div>
        <div class="construction-filter-actions">
          <button type="button" id="construction-settlement-apply-btn" class="header-construction-btn construction-settlement-primary-btn">기성 다시 계산</button>
          <button type="button" id="construction-settlement-preview-btn" class="ghost">선택 월 시공만 보기</button>
        </div>
        <section class="construction-summary-grid construction-summary-grid--settlement">
          <article class="construction-summary-card construction-summary-card--period"><span>기성 기간</span><strong id="construction-settlement-period">-</strong></article>
          <article class="construction-summary-card"><span>월 고유 파일</span><strong id="construction-settlement-unique">-</strong></article>
          <article class="construction-summary-card"><span>항타 길이 합계 (m)</span><strong id="construction-settlement-penetration">-</strong></article>
          <article class="construction-summary-card"><span>월 잔량 합계 (m)</span><strong id="construction-settlement-remaining">-</strong></article>
          <article class="construction-summary-card"><span>잔량 기준 초과</span><strong id="construction-settlement-threshold">-</strong></article>
        </section>
        <div class="construction-chart-card construction-chart-card--full"><h3>월별 시공 흐름</h3><div id="construction-chart-settlement-flow" class="construction-line-chart"></div></div>
        <div class="construction-chart-card construction-chart-card--full">
          <div class="construction-settlement-records-head">
            <div class="construction-settlement-records-head-left">
              <h3 class="construction-settlement-records-title">기성 정리표</h3>
              <p class="construction-settlement-records-hint">기초골조 상단레벨은 메인 화면 동·주차장 설정에서 위치별 기본값을 넣을 수 있고, 표에서는 행별로 덮어쓸 수 있습니다. 두께 등 나머지는 표에서 입력합니다.</p>
            </div>
            <div class="construction-settlement-records-head-actions">
              <span id="construction-settlement-records-copy-feedback" class="construction-records-copy-feedback" aria-live="polite"></span>
              <button type="button" id="construction-settlement-records-copy-btn" class="construction-records-copy-btn" title="표 내용을 복사하면 엑셀에 붙여넣을 수 있습니다" aria-label="기성 정리표 엑셀용 복사">
              <svg class="construction-records-copy-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
              <button type="button" id="construction-settlement-records-xlsx-btn" class="construction-records-copy-btn" title="화면과 같은 열·헤더 형식으로 XLSX 파일을 저장합니다" aria-label="기성 정리표 엑셀 다운로드">
              <svg class="construction-records-copy-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            </div>
          </div>
          <div class="construction-settlement-manual-settings">
            <label>버림콘 두께 (m)<input type="number" id="construction-settlement-blinding-thickness" class="save-work-input" step="0.01" value="0.06" /></label>
            <label>두부정리 상단레벨 (m)<input type="number" id="construction-settlement-head-trim-level" class="save-work-input" step="0.01" value="0.16" /></label>
            <label>잔량기준 (m)<input type="number" id="construction-settlement-remaining-base" class="save-work-input" step="0.01" value="0.5" /></label>
            <button type="button" id="construction-settlement-manual-apply-btn" class="ghost">설정 적용</button>
          </div>
          <div class="construction-records-wrapper">
            <table class="construction-records-table construction-records-table--settlement-detail" id="construction-settlement-records-table">
              <thead><tr>
                <th>시공일</th><th>장비</th><th>파일종류</th><th>공법</th><th>위치</th><th>파일번호</th>
                <th title="천공시작 지반고">천공시작<br>지반고</th><th>관입깊이</th>
                <th class="construction-records-th-long" title="최종파일근입하단레벨 (천공시작지반고 − 관입깊이)">파일근입<br>하단레벨<br><span class="construction-records-th-sub">(시작−관입)</span></th>
                <th>파일잔량</th><th>공삭공<br><span class="construction-records-th-sub">(별도 기성)</span></th>
                <th title="기초골조 상단 레벨">기초골조<br>상단레벨</th><th title="기초골조 두께">기초골조<br>두께</th><th title="버림콘크리트 두께">버림콘<br>두께</th><th id="construction-settlement-head-trim-header" title="두부정리 상단 레벨">두부정리<br>상단레벨<br><span class="construction-records-th-sub">(0.16m)</span></th>
                <th title="최종근입(기성최종길이)">최종근입<br><span class="construction-records-th-sub">(기성최종길이)</span></th><th id="construction-settlement-target-penetration-header" title="최종근입 + 잔량기준">최종근입+잔량기준<br><span class="construction-records-th-sub">(0.50m)</span></th><th title="원래길이 - (최종근입 + 잔량기준)">잔량<br><span class="construction-records-th-sub">(원래−공제)</span></th><th>비고</th>
              </tr></thead>
              <tbody id="construction-records-body"><tr><td colspan="19" class="empty-row">기성 데이터를 불러오면 정리표가 표시됩니다.</td></tr></tbody>
            </table>
          </div>
          <div id="construction-settlement-length-summary" class="construction-settlement-length-summary">
            <div class="empty-row">기성 데이터를 불러오면 길이 합계가 표시됩니다.</div>
          </div>
        </div>
        <div class="construction-chart-card construction-chart-card--full">
          <h3>공법별 월 정리</h3>
          <div class="construction-records-wrapper">
            <table class="construction-records-table construction-summary-table">
              <thead><tr><th>공법</th><th>고유 파일</th><th>항타 길이 합계</th><th>최종근입량 합계</th><th>잔량 합계</th><th>평균 잔량</th></tr></thead>
              <tbody id="construction-settlement-method-body"><tr><td colspan="6" class="empty-row">월별 공법 정리가 표시됩니다.</td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="construction-chart-card construction-chart-card--full">
          <h3>부위별 진행 현황</h3>
          <div class="construction-records-wrapper">
            <table class="construction-records-table construction-summary-table">
              <thead><tr><th>부위</th><th>월 시공</th><th>누적 시공</th><th>프로젝트 총 파일</th><th>진행률</th></tr></thead>
              <tbody id="construction-settlement-location-body"><tr><td colspan="5" class="empty-row">부위별 진행률이 표시됩니다.</td></tr></tbody>
            </table>
          </div>
        </div>
      </section>
      <section class="construction-section construction-tab-panel" data-panel="foundation-thickness">
        <div class="construction-section-title">
          <div class="construction-section-title-row">
            <span>기초골조 두께 관리</span>
            <small class="soft-liability-note soft-liability-note--compact"><span aria-hidden="true">※</span>입력 단위는 mm, 기성 계산 반영은 m로 자동 변환됩니다.</small>
          </div>
          <small>파일 단위 두께를 폴리라인 내부/외부 및 다중 선택으로 일괄 적용할 수 있습니다.</small>
        </div>
        <div class="construction-foundation-toolbar">
          <span class="construction-foundation-toolbar-note">목록에서 동/지하주차장의 내부·외부 항목을 클릭하면 즉시 선택됩니다.</span>
        </div>
        <div class="construction-foundation-control-panel">
          <div class="construction-foundation-area-filter">
            <span class="construction-foundation-area-filter-title">면적 기준 (area 범위)</span>
            <div class="construction-foundation-area-range-wrap">
              <span id="construction-foundation-area-min-label" class="construction-foundation-area-end">최소 -</span>
              <div class="construction-foundation-area-range">
                <span id="construction-foundation-area-active" class="construction-foundation-area-active" aria-hidden="true"></span>
                <input type="range" id="construction-foundation-area-min" class="construction-foundation-area-range-input construction-foundation-area-range-input--min" min="0" max="100" step="1" value="15" />
                <input type="range" id="construction-foundation-area-max" class="construction-foundation-area-range-input construction-foundation-area-range-input--max" min="0" max="100" step="1" value="85" />
              </div>
              <span id="construction-foundation-area-max-label" class="construction-foundation-area-end">최대 -</span>
            </div>
            <div id="construction-foundation-area-values" class="construction-range-note">기준 면적을 계산하는 중입니다.</div>
          </div>
          <div class="construction-foundation-mode-row">
            <label><input type="checkbox" id="construction-foundation-multi-select" checked /> 다중선택</label>
            <label><input type="checkbox" id="construction-foundation-window-select" /> 윈도우선택 <small class="construction-foundation-mode-hint">휠 이동</small></label>
            <label><input type="checkbox" id="construction-foundation-polyline-auto-select" checked /> 폴리라인 클릭 시 내부 자동선택</label>
          </div>
          <div class="construction-foundation-pf-height-band">
            <div class="construction-foundation-pf-height-title">P/F 글자 높이</div>
            <div class="construction-foundation-pf-height-radios" role="radiogroup" aria-label="P/F 글자 높이 매칭 구간">
              <label><input type="radio" name="construction-pf-height-band" value="large" /> 큰 글자만</label>
              <label><input type="radio" name="construction-pf-height-band" value="small" checked /> 작은 글자만</label>
            </div>
          </div>
          <div id="construction-foundation-pf-height-hint" class="construction-range-note construction-foundation-pf-height-hint"></div>
          <div class="construction-foundation-quick-actions">
            <button type="button" id="construction-foundation-clear-selection" class="ghost">선택 해제</button>
            <button type="button" id="construction-foundation-undo" class="ghost" title="Ctrl+Z">실행 취소</button>
            <button type="button" id="construction-foundation-redo" class="ghost" title="Ctrl+Y">다시 실행</button>
            <button type="button" id="construction-foundation-reset-all" class="ghost">데이터 초기화</button>
          </div>
          <div class="construction-foundation-mode-row construction-foundation-overlay-toggles">
            <span class="construction-foundation-area-filter-title">캔버스 숫자 표시</span>
            <label><input type="checkbox" id="construction-foundation-overlay-thickness" checked /> 기초두께(mm)</label>
            <label><input type="checkbox" id="construction-foundation-overlay-drill" /> 천공(m)</label>
            <label><input type="checkbox" id="construction-foundation-overlay-top" /> 기초상단(m)</label>
            <button type="button" id="construction-foundation-overlay-all" class="ghost construction-foundation-overlay-all-btn">가시성 전체</button>
          </div>
          <div class="construction-foundation-mode-row construction-foundation-overlay-toggles">
            <span class="construction-foundation-area-filter-title">캔버스 면적으로 보기(해치)</span>
            <label><input type="checkbox" id="construction-foundation-hatch-thickness" checked /> 기초두께(mm)</label>
            <label><input type="checkbox" id="construction-foundation-hatch-drill" /> 천공(m)</label>
            <label><input type="checkbox" id="construction-foundation-hatch-top" /> 기초상단(m)</label>
            <button type="button" id="construction-foundation-hatch-all" class="ghost construction-foundation-overlay-all-btn">가시성 전체</button>
          </div>
          <div class="construction-foundation-building-levels">
            <div class="construction-foundation-area-filter-title">다른 저장 버전에서 불러오기</div>
            <p class="muted construction-foundation-preset-hint">같은 프로젝트의 다른 저장 버전을 고른 뒤 불러오기를 누르면, 그 버전에 있던 말뚝별 두께·천공·기초상·피트 오프셋과 동·주차장 윤곽별 천공·기초상 레벨을 <strong>현재 화면에 덮어씁니다</strong>(말뚝 id·윤곽 이름이 맞는 항목만).</p>
            <div class="construction-foundation-preset-work-row">
              <label class="construction-foundation-preset-select-label">저장 버전
                <select id="construction-foundation-preset-work" class="save-work-select">
                  <option value="">저장 작업(버전) 선택</option>
                </select>
              </label>
              <button type="button" id="construction-foundation-preset-load" class="ghost construction-foundation-preset-import-btn">선택 버전에서 불러오기</button>
            </div>
          </div>
          <div class="construction-foundation-apply-row">
            <label>천공시작 (m)<input type="number" id="construction-foundation-drill-m" class="save-work-input" step="any" placeholder="다른 버전·직접 입력" /></label>
            <button type="button" id="construction-foundation-clear-drill-selection" class="ghost">선택 값 삭제</button>
            <button type="button" id="construction-foundation-apply-drill" class="header-construction-btn">선택 항목 적용</button>
          </div>
          <div class="construction-foundation-apply-row">
            <label>기초상단 (m)<input type="number" id="construction-foundation-top-m" class="save-work-input" step="any" placeholder="다른 버전·직접 입력" /></label>
            <button type="button" id="construction-foundation-clear-top-selection" class="ghost">선택 값 삭제</button>
            <button type="button" id="construction-foundation-apply-top" class="header-construction-btn">선택 항목 적용</button>
          </div>
          <div class="construction-foundation-apply-row">
            <label>기초골조 두께 (mm)<input type="number" id="construction-foundation-thickness-mm" class="save-work-input" min="0" step="1" placeholder="예: 700" /></label>
            <button type="button" id="construction-foundation-clear-selection-values" class="ghost">선택 값 삭제</button>
            <button type="button" id="construction-foundation-apply-selection" class="header-construction-btn">선택 항목 적용</button>
          </div>
          <div class="construction-foundation-apply-row">
            <label class="construction-foundation-label-stack construction-foundation-elevator-pit-label">
              <span class="construction-foundation-label-stack-text">엘레베이터 피트 오프셋 (mm)</span>
              <input type="number" id="construction-foundation-elevator-pit-offset-mm" class="save-work-input" min="0" step="1" placeholder="예: 1200" title="엘레베이터 피트 오프셋 (mm)" />
            </label>
            <button type="button" id="construction-foundation-clear-elevator-pit" class="ghost">피트 값 삭제</button>
            <button type="button" id="construction-foundation-apply-elevator-pit" class="header-construction-btn">엘레베이터 피트 설정</button>
          </div>
        </div>
        <div class="construction-chart-card construction-chart-card--full construction-foundation-pf-merge-card">
          <div class="construction-foundation-pf-merge-section">
            <h3 class="construction-foundation-pf-merge-title">P/F 위치 텍스트 ↔ 닫힌 폴리선</h3>
            <p class="construction-foundation-viewer-guide">위에서 큰 글자 또는 작은 글자 한쪽만 골라 매칭합니다. 같은 P/F 표기(예 F1)마다 버튼 하나로 묶입니다.</p>
            <div id="construction-foundation-pf-list" class="construction-foundation-list"></div>
          </div>
          <div class="construction-foundation-pf-merge-section construction-foundation-pf-merge-section--split">
            <h3 class="construction-foundation-pf-merge-title">근접·표기 불일치 (2M) <span class="construction-pf-mismatch-badge">검토 권장</span></h3>
            <p class="construction-foundation-viewer-guide">각 큰 글자마다 <strong>지리상 가장 가까운 작은 글자</strong>가 다른 표기일 때만 표시합니다. 한도는 도면 단위 기준으로 m 도면≈2, mm 도면≈2000(둘 다 약 2m). 거리 열은 도면 단위 그대로입니다. 좌표는 <strong>가능하면 글자 중심</strong>(text_center), 없으면 삽입점입니다. 행을 누르면 두 위치로 이동합니다.</p>
            <div id="construction-foundation-pf-proximity-review" class="construction-foundation-proximity-review"></div>
          </div>
        </div>
        <div id="construction-foundation-summary" class="construction-range-note">아래 목록에서 내부/외부를 선택하세요.</div>
        <div class="construction-chart-card construction-chart-card--full">
          <h3>동/지하주차장 선택 목록</h3>
          <p class="construction-foundation-viewer-guide">항목을 누르면 캐드뷰어에서 바로 선택 표시됩니다.</p>
          <label class="construction-foundation-inline-option">
            <input type="checkbox" id="construction-foundation-exclude-with-thickness" />
            기초골조 두께 값 있는 객체 선택 제외
          </label>
          <div id="construction-foundation-parking-count-filters" class="construction-foundation-subgroup-row"></div>
          <div id="construction-foundation-polyline-list" class="construction-foundation-list"></div>
        </div>
        <div class="construction-chart-card construction-chart-card--full">
          <h3>선택 요약</h3>
          <div id="construction-foundation-pile-list" class="construction-foundation-list"></div>
        </div>
      </section>
    </div>
  `;

  const q = (selector) => constructionDrawer.querySelector(selector);
  const qa = (selector) => Array.from(constructionDrawer.querySelectorAll(selector));
  const escape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const numberFormatter = typeof formatNumber === "function" ? formatNumber : (value) => (value === null || value === undefined || Number.isNaN(Number(value)) ? "-" : Number(value).toFixed(3).replace(/\.?0+$/, ""));
  const errorMessage = (error) => (typeof parseErrorMessage === "function" ? parseErrorMessage(error) : (error instanceof Error ? error.message : String(error || "알 수 없는 오류")));

  const constructionDrawerTitle = q("#construction-drawer-title");
  const constructionDrawerSubtitle = q(".construction-drawer-subtitle");
  const constructionDrawerClose = q("#construction-drawer-close");
  const constructionTabStrip = q(".construction-tab-strip");
  const constructionTabButtons = qa(".construction-tab");
  const constructionTabPanels = qa(".construction-tab-panel");
  const constructionUserId = q("#construction-user-id");
  const constructionPassword = q("#construction-password");
  const constructionReportPageUrl = q("#construction-report-page-url");
  const constructionReportId = q("#construction-report-id");
  const constructionReportFieldsToggle = q("#construction-report-fields-toggle");
  const constructionReportFields = q("#construction-report-fields");
  const constructionSyncBtn = q("#construction-sync-btn");
  const constructionUploadBtn = q("#construction-upload-btn");
  const constructionUploadInput = q("#construction-upload-input");
  const constructionSyncStatus = q("#construction-sync-status");
  const constructionDatasetSelect = q("#construction-dataset-select");
  const constructionDatasetApply = q("#construction-dataset-apply");
  const constructionDatasetDelete = q("#construction-dataset-delete");
  const constructionDatasetClearOverlay = q("#construction-dataset-clear-overlay");
  const constructionDateFrom = q("#construction-date-from");
  const constructionDateTo = q("#construction-date-to");
  const constructionMonth = q("#construction-month");
  const constructionWeek = q("#construction-week");
  const constructionPlaybackModeButtons = qa("[data-playback-mode]");
  const constructionPlaybackSpeed = q("#construction-playback-speed");
  const constructionPlaybackBtn = q("#construction-playback-btn");
  const constructionPlaybackStatus = q("#construction-playback-status");
  const constructionEquipmentChips = q("#construction-equipment-chips");
  const constructionMethodChips = q("#construction-method-chips");
  const constructionLocationChips = q("#construction-location-chips");
  const constructionRemainingThreshold = q("#construction-remaining-threshold");
  const constructionOverlayMode = q("#construction-overlay-mode");
  const constructionApplyBtn = q("#construction-apply-btn");
  const constructionResetBtn = q("#construction-reset-btn");
  const constructionDateRangeNote = q("#construction-date-range-note");
  const constructionLegend = q("#construction-legend");
  const constructionSummaryRecords = q("#construction-summary-records");
  const constructionSummaryUnique = q("#construction-summary-unique");
  const constructionSummaryInstalledPiles = q("#construction-summary-installed-piles");
  const constructionSummaryMatched = q("#construction-summary-matched");
  const constructionSummaryAutoMatched = q("#construction-summary-auto-matched");
  const constructionSummaryPending = q("#construction-summary-pending");
  const constructionSummaryRemaining = q("#construction-summary-remaining");
  const constructionSummaryThreshold = q("#construction-summary-threshold");
  const constructionDiagnosticOverview = q("#construction-diagnostic-overview");
  const constructionChartByDate = q("#construction-chart-by-date");
  const constructionChartByMonth = q("#construction-chart-by-month");
  const constructionChartByEquipment = q("#construction-chart-by-equipment");
  const constructionChartByMethod = q("#construction-chart-by-method");
  const constructionMethodMatrix = q("#construction-method-matrix");
  const constructionAutoMatchedTable = q("#construction-auto-matched-table");
  const constructionDiagnosticIssues = q("#construction-diagnostic-issues");
  const constructionSettlementMonth = q("#construction-settlement-month");
  const constructionSettlementStartDay = q("#construction-settlement-start-day");
  const constructionSettlementEndDay = q("#construction-settlement-end-day");
  const constructionSettlementApplyBtn = q("#construction-settlement-apply-btn");
  const constructionSettlementPreviewBtn = q("#construction-settlement-preview-btn");
  const constructionSettlementPeriodNote = q("#construction-settlement-period-note");
  const constructionSettlementPeriod = q("#construction-settlement-period");
  const constructionSettlementUnique = q("#construction-settlement-unique");
  const constructionSettlementPenetration = q("#construction-settlement-penetration");
  const constructionSettlementRemaining = q("#construction-settlement-remaining");
  const constructionSettlementThreshold = q("#construction-settlement-threshold");
  const constructionChartSettlementFlow = q("#construction-chart-settlement-flow");
  const constructionRecordsBody = q("#construction-records-body");
  const constructionSettlementRecordsCopyBtn = q("#construction-settlement-records-copy-btn");
  const constructionSettlementRecordsXlsxBtn = q("#construction-settlement-records-xlsx-btn");
  const constructionSettlementBlindingThickness = q("#construction-settlement-blinding-thickness");
  const constructionSettlementHeadTrimLevel = q("#construction-settlement-head-trim-level");
  const constructionSettlementRemainingBase = q("#construction-settlement-remaining-base");
  const constructionSettlementHeadTrimHeader = q("#construction-settlement-head-trim-header");
  const constructionSettlementTargetPenetrationHeader = q("#construction-settlement-target-penetration-header");
  const constructionSettlementManualApplyBtn = q("#construction-settlement-manual-apply-btn");
  const constructionSettlementRecordsCopyFeedback = q("#construction-settlement-records-copy-feedback");
  let settlementCopyFeedbackTimer = null;
  const constructionSettlementMethodBody = q("#construction-settlement-method-body");
  const constructionSettlementLocationBody = q("#construction-settlement-location-body");
  const constructionSettlementLengthSummary = q("#construction-settlement-length-summary");
  const constructionFoundationMultiSelect = q("#construction-foundation-multi-select");
  const constructionFoundationWindowSelect = q("#construction-foundation-window-select");
  const constructionFoundationPolylineAutoSelect = q("#construction-foundation-polyline-auto-select");
  const constructionFoundationOverlayThickness = q("#construction-foundation-overlay-thickness");
  const constructionFoundationOverlayDrill = q("#construction-foundation-overlay-drill");
  const constructionFoundationOverlayTop = q("#construction-foundation-overlay-top");
  const constructionFoundationOverlayAll = q("#construction-foundation-overlay-all");
  const constructionFoundationHatchThickness = q("#construction-foundation-hatch-thickness");
  const constructionFoundationHatchDrill = q("#construction-foundation-hatch-drill");
  const constructionFoundationHatchTop = q("#construction-foundation-hatch-top");
  const constructionFoundationHatchAll = q("#construction-foundation-hatch-all");
  const constructionFoundationPfList = q("#construction-foundation-pf-list");
  const constructionFoundationPfHeightHint = q("#construction-foundation-pf-height-hint");
  const constructionFoundationPfProximityReview = q("#construction-foundation-pf-proximity-review");
  const constructionFoundationUndo = q("#construction-foundation-undo");
  const constructionFoundationRedo = q("#construction-foundation-redo");
  const constructionFoundationAreaMin = q("#construction-foundation-area-min");
  const constructionFoundationAreaMax = q("#construction-foundation-area-max");
  const constructionFoundationAreaActive = q("#construction-foundation-area-active");
  const constructionFoundationAreaMinLabel = q("#construction-foundation-area-min-label");
  const constructionFoundationAreaMaxLabel = q("#construction-foundation-area-max-label");
  const constructionFoundationAreaValues = q("#construction-foundation-area-values");
  const constructionFoundationThicknessMm = q("#construction-foundation-thickness-mm");
  const constructionFoundationDrillM = q("#construction-foundation-drill-m");
  const constructionFoundationTopM = q("#construction-foundation-top-m");
  const constructionFoundationPresetWork = q("#construction-foundation-preset-work");
  const constructionFoundationPresetLoad = q("#construction-foundation-preset-load");
  const constructionFoundationElevatorPitOffsetMm = q("#construction-foundation-elevator-pit-offset-mm");
  const constructionFoundationApplySelection = q("#construction-foundation-apply-selection");
  const constructionFoundationClearSelectionValues = q("#construction-foundation-clear-selection-values");
  const constructionFoundationApplyDrill = q("#construction-foundation-apply-drill");
  const constructionFoundationClearDrillSelection = q("#construction-foundation-clear-drill-selection");
  const constructionFoundationApplyTop = q("#construction-foundation-apply-top");
  const constructionFoundationClearTopSelection = q("#construction-foundation-clear-top-selection");
  const constructionFoundationApplyElevatorPit = q("#construction-foundation-apply-elevator-pit");
  const constructionFoundationClearElevatorPit = q("#construction-foundation-clear-elevator-pit");
  const constructionFoundationClearSelection = q("#construction-foundation-clear-selection");
  const constructionFoundationResetAll = q("#construction-foundation-reset-all");
  const constructionFoundationSummary = q("#construction-foundation-summary");
  const constructionFoundationParkingCountFilters = q("#construction-foundation-parking-count-filters");
  const constructionFoundationPolylineList = q("#construction-foundation-polyline-list");
  const constructionFoundationPileList = q("#construction-foundation-pile-list");
  const constructionFoundationExcludeWithThickness = q("#construction-foundation-exclude-with-thickness");
  const constructionProjectName = q("#construction-project-name");
  const constructionProjectMeta = q("#construction-project-meta");
  const constructionWorkTitle = q("#construction-work-title");
  const constructionWorkMeta = q("#construction-work-meta");
  const constructionStatusPanel = q('[data-panel="status"]');
  const constructionAutoMatchedCard = constructionAutoMatchedTable?.closest(".construction-chart-card");
  const constructionDiagnosticIssuesCard = constructionDiagnosticIssues?.closest(".construction-chart-card");
  if (constructionStatusPanel && constructionAutoMatchedCard && !constructionStatusPanel.contains(constructionAutoMatchedCard)) {
    constructionStatusPanel.appendChild(constructionAutoMatchedCard);
  }
  if (constructionStatusPanel && constructionDiagnosticIssuesCard && !constructionStatusPanel.contains(constructionDiagnosticIssuesCard)) {
    constructionStatusPanel.appendChild(constructionDiagnosticIssuesCard);
  }

  const constructionState = state.construction || (state.construction = {
    activeDatasetId: "",
    datasets: [],
    dashboard: null,
    activeTab: "status",
    overlayMode: "status",
    overlayMap: new Map(),
    viewerOverlayEnabled: true,
    legendItems: [],
    legendFilterKey: "",
    selectedEquipments: [],
    selectedMethods: [],
    selectedLocations: [],
    selectedWeek: "",
    weekOptions: [],
    settlementPreviewOnly: false,
    lastSettlementRecordRows: [],
    settlementManualByKey: {},
    settlementDefaults: { blindingThickness: 0.06, headTrimTopLevel: 0.16, remainingBase: 0.5 },
    dateGrouping: "month",
    playbackSpeed: 1,
    playbackSteps: [],
    playbackStepLookup: new Map(),
    playbackStepIndex: null,
    playbackRunning: false,
    playbackRaf: null,
    playbackLastFrameAt: 0,
    renderFrameToken: 0,
    playbackPathFrameToken: -1,
    isOpen: false,
    foundationThicknessByPileId: state.foundationThicknessByPileId && typeof state.foundationThicknessByPileId === "object"
      ? { ...state.foundationThicknessByPileId }
      : {},
    foundationPitOffsetByPileId: state.foundationPitOffsetByPileId && typeof state.foundationPitOffsetByPileId === "object"
      ? { ...state.foundationPitOffsetByPileId }
      : {},
    drillingStartByPileId: state.drillingStartByPileId && typeof state.drillingStartByPileId === "object"
      ? { ...state.drillingStartByPileId }
      : {},
    foundationTopByPileId: state.foundationTopByPileId && typeof state.foundationTopByPileId === "object"
      ? { ...state.foundationTopByPileId }
      : {},
    foundationSelectedCircleIds: new Set(),
    foundationSelectedPolylineIds: new Set(),
    foundationFilteredPolylineIds: new Set(),
    foundationSelectedSubgroupKeys: new Set(),
    foundationSuppressedCircleIds: new Set(),
    foundationSuppressedPolylineIds: new Set(),
    foundationPreviewCircleIds: new Set(),
    foundationParkingCountFilter: "all",
    foundationAreaMinValue: null,
    foundationAreaMaxValue: null,
    foundationAreaBoundMin: 0,
    foundationAreaBoundMax: 0,
    foundationAreaMinPos: 15,
    foundationAreaMaxPos: 85,
    foundationAreaRefreshRaf: null,
    foundationMultiSelect: true,
    foundationWindowSelect: false,
    foundationPolylineAutoSelect: true,
    foundationOverlayShowThickness: true,
    foundationOverlayShowDrill: false,
    foundationOverlayShowFoundationTop: false,
    foundationHatchShowThickness: true,
    foundationHatchShowDrill: false,
    foundationHatchShowFoundationTop: false,
    foundationExcludeWithThickness: false,
    foundationSelectedPfKeys: new Set(),
    foundationHistoryPast: [],
    foundationHistoryFuture: [],
    foundationPfMatchCacheKey: "",
    foundationPfMatchCache: [],
    foundationPfConsensusMismatchCount: 0,
    foundationPfLabelCandidatesRef: null,
    foundationPfLabelCandidates: null,
    /** 1 = text_center 우선 좌표로 후보 캐시 */
    foundationPfLabelXYMode: 0,
    pfHeightBandMode: "small",
    foundationPolylineIdLookupKey: "",
    foundationPolylineIdLookup: null,
    foundationWindowRect: null,
    foundationDragStart: null,
    foundationDragging: false,
    foundationClickStart: null,
    foundationDidDrag: false,
    foundationStandaloneMode: false,
    foundationGroupsInitialized: false,
    foundationSelectablePolylineCacheKey: "",
    foundationSelectablePolylineCache: [],
    foundationBackgroundPolylineCacheKey: "",
    foundationBackgroundPolylineCache: [],
    foundationGroupItemsCacheKey: "",
    foundationGroupItemsCache: [],
    foundationTwinCircleIdsLookupKey: "",
    foundationTwinCircleIdsLookupRef: null,
    foundationTwinCircleIdsLookup: null,
    foundationHatchInsideCacheKey: "",
    foundationHatchInsideCirclesRef: null,
    foundationHatchInsideRows: [],
  });
  if (!constructionState.settlementManualByKey || typeof constructionState.settlementManualByKey !== "object") {
    constructionState.settlementManualByKey = {};
  }
  if (!constructionState.settlementDefaults || typeof constructionState.settlementDefaults !== "object") {
    constructionState.settlementDefaults = { blindingThickness: 0.06, headTrimTopLevel: 0.16, remainingBase: 0.5 };
  }
  if (!Number.isFinite(Number(constructionState.settlementDefaults.blindingThickness))) {
    constructionState.settlementDefaults.blindingThickness = 0.06;
  }
  if (!Number.isFinite(Number(constructionState.settlementDefaults.headTrimTopLevel))) {
    constructionState.settlementDefaults.headTrimTopLevel = 0.16;
  }
  if (!Number.isFinite(Number(constructionState.settlementDefaults.remainingBase))) {
    constructionState.settlementDefaults.remainingBase = 0.5;
  }
  if (!constructionState.foundationThicknessByPileId || typeof constructionState.foundationThicknessByPileId !== "object") {
    constructionState.foundationThicknessByPileId = {};
  }
  if (!constructionState.foundationPitOffsetByPileId || typeof constructionState.foundationPitOffsetByPileId !== "object") {
    constructionState.foundationPitOffsetByPileId = {};
  }
  if (!constructionState.drillingStartByPileId || typeof constructionState.drillingStartByPileId !== "object") {
    constructionState.drillingStartByPileId = {};
  }
  if (!constructionState.foundationTopByPileId || typeof constructionState.foundationTopByPileId !== "object") {
    constructionState.foundationTopByPileId = {};
  }
  constructionState.foundationMultiSelect = constructionState.foundationMultiSelect !== false;
  constructionState.foundationWindowSelect = Boolean(constructionState.foundationWindowSelect);
  constructionState.foundationPolylineAutoSelect = constructionState.foundationPolylineAutoSelect !== false;
  if (typeof constructionState.foundationOverlayShowThickness !== "boolean") {
    const legacy = constructionState.foundationShowOverlay;
    constructionState.foundationOverlayShowThickness = legacy !== false;
  }
  constructionState.foundationOverlayShowThickness = constructionState.foundationOverlayShowThickness !== false;
  constructionState.foundationOverlayShowDrill = Boolean(constructionState.foundationOverlayShowDrill);
  constructionState.foundationOverlayShowFoundationTop = Boolean(constructionState.foundationOverlayShowFoundationTop);
  constructionState.foundationHatchShowThickness = constructionState.foundationHatchShowThickness !== false;
  constructionState.foundationHatchShowDrill = Boolean(constructionState.foundationHatchShowDrill);
  constructionState.foundationHatchShowFoundationTop = Boolean(constructionState.foundationHatchShowFoundationTop);
  constructionState.foundationExcludeWithThickness = Boolean(constructionState.foundationExcludeWithThickness);
  if (constructionState.pfHeightBandMode !== "large" && constructionState.pfHeightBandMode !== "small") {
    constructionState.pfHeightBandMode = "small";
  }
  if (!(constructionState.foundationSelectedPfKeys instanceof Set)) {
    constructionState.foundationSelectedPfKeys = new Set();
  }
  if (!Array.isArray(constructionState.foundationHistoryPast)) {
    constructionState.foundationHistoryPast = [];
  }
  if (!Array.isArray(constructionState.foundationHistoryFuture)) {
    constructionState.foundationHistoryFuture = [];
  }
  if (!(constructionState.foundationSelectedCircleIds instanceof Set)) {
    constructionState.foundationSelectedCircleIds = new Set();
  }
  if (!(constructionState.foundationSelectedPolylineIds instanceof Set)) {
    constructionState.foundationSelectedPolylineIds = new Set();
  }
  if (!(constructionState.foundationFilteredPolylineIds instanceof Set)) {
    constructionState.foundationFilteredPolylineIds = new Set();
  }
  if (!(constructionState.foundationSelectedSubgroupKeys instanceof Set)) {
    constructionState.foundationSelectedSubgroupKeys = new Set();
  }
  if (!(constructionState.foundationSuppressedCircleIds instanceof Set)) {
    constructionState.foundationSuppressedCircleIds = new Set();
  }
  if (!(constructionState.foundationSuppressedPolylineIds instanceof Set)) {
    constructionState.foundationSuppressedPolylineIds = new Set();
  }
  constructionState.foundationParkingCountFilter = String(constructionState.foundationParkingCountFilter || "all");
  constructionState.foundationAreaMinValue = Number.isFinite(Number(constructionState.foundationAreaMinValue))
    ? Number(constructionState.foundationAreaMinValue)
    : null;
  constructionState.foundationAreaMaxValue = Number.isFinite(Number(constructionState.foundationAreaMaxValue))
    ? Number(constructionState.foundationAreaMaxValue)
    : null;
  constructionState.foundationAreaMinPos = Number.isFinite(Number(constructionState.foundationAreaMinPos))
    ? Number(constructionState.foundationAreaMinPos)
    : 15;
  constructionState.foundationAreaMaxPos = Number.isFinite(Number(constructionState.foundationAreaMaxPos))
    ? Number(constructionState.foundationAreaMaxPos)
    : 85;
  if (constructionState.foundationAreaMinPos > FOUNDATION_AREA_SLIDER_MAX) {
    constructionState.foundationAreaMinPos = Math.round(constructionState.foundationAreaMinPos / 10);
  }
  if (constructionState.foundationAreaMaxPos > FOUNDATION_AREA_SLIDER_MAX) {
    constructionState.foundationAreaMaxPos = Math.round(constructionState.foundationAreaMaxPos / 10);
  }
  constructionState.foundationAreaMinPos = Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, constructionState.foundationAreaMinPos));
  constructionState.foundationAreaMaxPos = Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, constructionState.foundationAreaMaxPos));
  if (constructionState.foundationAreaMaxPos - constructionState.foundationAreaMinPos < 2) {
    constructionState.foundationAreaMaxPos = Math.min(FOUNDATION_AREA_SLIDER_MAX, constructionState.foundationAreaMinPos + 2);
    if (constructionState.foundationAreaMaxPos - constructionState.foundationAreaMinPos < 2) {
      constructionState.foundationAreaMinPos = Math.max(0, constructionState.foundationAreaMaxPos - 2);
    }
  }
  if (!(constructionState.foundationPreviewCircleIds instanceof Set)) {
    constructionState.foundationPreviewCircleIds = new Set();
  }
  constructionState.foundationGroupsInitialized = Boolean(constructionState.foundationGroupsInitialized);

  const palette = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#0f766e", "#7c3aed", "#0891b2", "#ca8a04", "#db2777", "#4f46e5"];
  const statusColors = { installed: "#16a34a", pending: "#94a3b8" };
  const neutralCategoryColor = "#cbd5e1";
  const neutralCategories = new Set(["미시공", "미분류", "미지정", "일자미지정"]);

  function hasSavedWorkContext() {
    const hasCircles = Array.isArray(state.circles) && state.circles.length > 0;
    const hasProjectContext = Boolean(
      state.loadedWorkId
      || state.loadedWorkMeta?.project
      || state.loadedProjectName
      || (typeof getActiveProjectName === "function" && getActiveProjectName()),
    );
    return hasCircles && hasProjectContext;
  }

  function hexToRgba(hex, alpha) {
    const value = (hex || "").replace("#", "");
    if (value.length !== 6) return `rgba(37,99,235,${alpha})`;
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function formatMetric(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    return Number(value).toFixed(digits).replace(/\.?0+$/, "");
  }

  function roundMetricValue(value, digits = 3) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const factor = 10 ** digits;
    return Math.round(numeric * factor) / factor;
  }

  function formatDateWithWeekday(dateValue) {
    if (!dateValue) return "-";
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][parsed.getDay()];
    return `${dateValue} (${weekday})`;
  }

  function formatCompactDate(dateValue) {
    if (!dateValue) return "-";
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) return String(dateValue);
    return `${parts[1]}.${parts[2]}`;
  }

  function formatDisplayedPileNumber(value) {
    const text = String(value ?? "").trim();
    if (!text) return "-";
    if (!text.includes("-")) return text;
    const parts = text.split("-").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || text;
  }

  function formatLineChartLabel(row, labelField = "label") {
    const key = String(row?.key ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return formatCompactDate(key);
    if (/^\d{4}-\d{2}$/.test(key)) return `${key.slice(5, 7)}월`;

    const raw = String(row?.[labelField] ?? row?.label ?? row?.key ?? "-");
    const weekdayTrimmed = raw.replace(/\s*\([^)]+\)\s*$/u, "");
    if (weekdayTrimmed.length <= 12) return weekdayTrimmed;
    return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
  }

  function parseIsoDate(dateValue) {
    if (!dateValue) return null;
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) return null;
    const [year, month, day] = parts.map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function toIsoDate(dateObject) {
    if (!(dateObject instanceof Date) || Number.isNaN(dateObject.getTime())) return "";
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, "0");
    const day = String(dateObject.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfWeek(dateObject) {
    const cloned = new Date(dateObject.getFullYear(), dateObject.getMonth(), dateObject.getDate());
    const weekday = cloned.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    cloned.setDate(cloned.getDate() + diff);
    return cloned;
  }

  function endOfWeek(dateObject) {
    const cloned = startOfWeek(dateObject);
    cloned.setDate(cloned.getDate() + 6);
    return cloned;
  }

  function formatLegendDay(dateValue) {
    if (!dateValue) return "일자미지정";
    const parsed = parseIsoDate(dateValue);
    if (!parsed) return String(dateValue);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][parsed.getDay()];
    return `${formatCompactDate(dateValue)} (${weekday})`;
  }

  function buildWeekOptions(dates, monthValue) {
    if (!monthValue) return [];
    const monthDates = (dates || []).filter((value) => String(value).startsWith(monthValue)).sort();
    if (!monthDates.length) return [];

    const [yearText, monthText] = String(monthValue).split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return [];

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const grouped = new Map();

    monthDates.forEach((dateValue) => {
      const parsed = parseIsoDate(dateValue);
      if (!parsed) return;
      const rawStart = startOfWeek(parsed);
      const rawEnd = endOfWeek(parsed);
      const key = toIsoDate(rawStart);
      if (grouped.has(key)) return;

      const rangeStart = rawStart < monthStart ? monthStart : rawStart;
      const rangeEnd = rawEnd > monthEnd ? monthEnd : rawEnd;
      const index = grouped.size + 1;
      grouped.set(key, {
        key,
        value: `${toIsoDate(rangeStart)}|${toIsoDate(rangeEnd)}`,
        startDate: toIsoDate(rangeStart),
        endDate: toIsoDate(rangeEnd),
        label: `${index}주차 · ${formatCompactDate(toIsoDate(rangeStart))} ~ ${formatCompactDate(toIsoDate(rangeEnd))}`,
      });
    });

    return Array.from(grouped.values());
  }

  function refreshWeekSelect(appliedDateFrom = null, appliedDateTo = null) {
    const selectedMonth = constructionMonth.value || constructionState.dashboard?.filters?.applied?.month || "";
    constructionState.weekOptions = buildWeekOptions(constructionState.dashboard?.filters?.options?.dates || [], selectedMonth);
    fillSelect(
      constructionWeek,
      constructionState.weekOptions,
      null,
      selectedMonth ? "전체 주차" : "월 먼저 선택",
      (optionItem) => ({ value: optionItem.value, label: optionItem.label }),
    );

    const matchedFromRange = constructionState.weekOptions.find(
      (option) => option.startDate === appliedDateFrom && option.endDate === appliedDateTo,
    );
    if (constructionState.selectedWeek && constructionState.weekOptions.some((option) => option.value === constructionState.selectedWeek)) {
      constructionWeek.value = constructionState.selectedWeek;
    } else if (matchedFromRange) {
      constructionWeek.value = matchedFromRange.value;
      constructionState.selectedWeek = matchedFromRange.value;
    } else {
      constructionWeek.value = "";
      constructionState.selectedWeek = "";
    }
    constructionWeek.disabled = !selectedMonth || !constructionState.weekOptions.length;
  }

  function getWeekOptionForDate(dateValue) {
    return constructionState.weekOptions.find((option) => dateValue >= option.startDate && dateValue <= option.endDate) || null;
  }

  function getDateGroupingLabel(grouping) {
    if (grouping === "day") return "일별";
    if (grouping === "week") return "주별";
    return "월별";
  }

  function getDateBoundsRange() {
    const bounds = constructionState.dashboard?.filters?.options?.dateBounds || {};
    return {
      min: constructionDateFrom.value || bounds.min || "",
      max: constructionDateTo.value || bounds.max || "",
    };
  }

  function buildDateGroupingEntry(dateValue, grouping = constructionState.dateGrouping) {
    if (!dateValue) return null;
    const parsed = parseIsoDate(dateValue);
    if (!parsed) return null;
    if (grouping === "day") {
      return {
        key: dateValue,
        label: formatLegendDay(dateValue),
        sortKey: dateValue,
      };
    }
    if (grouping === "week") {
      const range = getDateBoundsRange();
      const minDate = parseIsoDate(range.min);
      const maxDate = parseIsoDate(range.max);
      let startDate = startOfWeek(parsed);
      let endDate = endOfWeek(parsed);
      if (minDate && startDate < minDate) startDate = minDate;
      if (maxDate && endDate > maxDate) endDate = maxDate;
      const startIso = toIsoDate(startDate);
      const endIso = toIsoDate(endDate);
      return {
        key: `${startIso}|${endIso}`,
        label: `${formatCompactDate(startIso)} ~ ${formatCompactDate(endIso)}`,
        sortKey: startIso,
        startDate: startIso,
        endDate: endIso,
      };
    }
    const monthKey = String(dateValue).slice(0, 7);
    return {
      key: monthKey,
      label: monthKey,
      sortKey: monthKey,
    };
  }

  function getPlayableDates() {
    const bounds = getDateBoundsRange();
    const sourceRows = Array.isArray(constructionState.dashboard?.charts?.byDate)
      ? constructionState.dashboard.charts.byDate
      : [];
    const sourceDates = sourceRows
      .filter((row) => {
        const dateValue = row?.key;
        if (!dateValue) return false;
        if (bounds.min && dateValue < bounds.min) return false;
        if (bounds.max && dateValue > bounds.max) return false;
        const activityCount = Math.max(
          Number(row?.recordCount) || 0,
          Number(row?.uniquePileCount) || 0,
          Number(row?.installedPileCount) || 0,
        );
        return activityCount > 0;
      })
      .map((row) => row.key);
    const fallbackDates = constructionState.dashboard?.filters?.options?.dates || [];
    const allDates = Array.from(new Set((sourceRows.length ? sourceDates : fallbackDates).filter(Boolean))).sort();
    return allDates.filter((dateValue) => {
      if (bounds.min && dateValue < bounds.min) return false;
      if (bounds.max && dateValue > bounds.max) return false;
      return true;
    });
  }

  function buildPlaybackSteps(grouping = constructionState.dateGrouping) {
    const grouped = new Map();
    getPlayableDates().forEach((dateValue) => {
      const entry = buildDateGroupingEntry(dateValue, grouping);
      if (!entry || grouped.has(entry.key)) return;
      grouped.set(entry.key, entry);
    });
    return Array.from(grouped.values()).sort((left, right) => String(left.sortKey || left.key).localeCompare(String(right.sortKey || right.key)));
  }

  function syncPlaybackModeButtons() {
    constructionPlaybackModeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.playbackMode === constructionState.dateGrouping);
    });
  }

  function hasPlaybackFrame() {
    return constructionState.overlayMode === "date"
      && constructionState.playbackStepIndex !== null
      && constructionState.playbackSteps.length > 0;
  }

  function updatePlaybackStatus() {
    if (!constructionPlaybackStatus || !constructionPlaybackBtn) return;
    if (!constructionState.playbackSteps.length || constructionState.playbackStepIndex === null) {
      constructionPlaybackStatus.textContent = `${getDateGroupingLabel(constructionState.dateGrouping)} 재생 준비`;
      constructionPlaybackBtn.textContent = "시뮬레이션 시작";
      return;
    }
    const total = constructionState.playbackSteps.length;
    if (constructionState.playbackRunning && constructionState.playbackStepIndex < 0) {
      constructionPlaybackStatus.textContent = `재생 대기 · ${getDateGroupingLabel(constructionState.dateGrouping)} 0/${total} · ${constructionState.playbackSteps[0]?.label || "-"}`;
      constructionPlaybackBtn.textContent = "시뮬레이션 중지";
      return;
    }
    const safeIndex = Math.max(0, Math.min(total - 1, constructionState.playbackStepIndex));
    const currentStep = constructionState.playbackSteps[safeIndex];
    const prefix = constructionState.playbackRunning ? "재생 중" : "재생 완료";
    const speedLabel = `${Number(constructionState.playbackSpeed || 1)}x`;
    constructionPlaybackStatus.textContent = `${prefix} · ${getDateGroupingLabel(constructionState.dateGrouping)} ${safeIndex + 1}/${total} · ${currentStep?.label || "-"} · ${speedLabel}`;
    constructionPlaybackBtn.textContent = constructionState.playbackRunning ? "시뮬레이션 중지" : "다시 재생";
  }

  function updateSettlementPreviewButton() {
    if (!constructionSettlementPreviewBtn) return;
    constructionSettlementPreviewBtn.classList.toggle("is-active", constructionState.settlementPreviewOnly);
    constructionSettlementPreviewBtn.textContent = constructionState.settlementPreviewOnly ? "선택 월 시공만 보는 중" : "선택 월 시공만 보기";
  }

  function syncReportFieldsToggle() {
    if (!constructionReportFieldsToggle || !constructionReportFields) return;
    const isExpanded = !constructionReportFields.hidden;
    constructionReportFieldsToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    constructionReportFieldsToggle.textContent = isExpanded ? "보고서 URL / Report ID 닫기" : "보고서 URL / Report ID 펼치기";
  }

  function toggleReportFields() {
    if (!constructionReportFields) return;
    constructionReportFields.hidden = !constructionReportFields.hidden;
    syncReportFieldsToggle();
  }

  function applyOverlayVisibilityFilters() {
    rebuildLegend();
    renderLegend();
    updateSettlementPreviewButton();
    updateCircleTable();
    requestRedraw();
  }

  function clearPlaybackState({ redraw = true } = {}) {
    if (constructionState.playbackRaf) {
      window.cancelAnimationFrame(constructionState.playbackRaf);
      constructionState.playbackRaf = null;
    }
    constructionState.playbackRunning = false;
    constructionState.playbackSteps = [];
    constructionState.playbackStepLookup = new Map();
    constructionState.playbackStepIndex = null;
    constructionState.playbackLastFrameAt = 0;
    updatePlaybackStatus();
    if (redraw) {
      rebuildLegend();
      renderLegend();
      updateCircleTable();
      requestRedraw();
    }
  }

  function stepPlaybackFrame() {
    if (!constructionState.playbackSteps.length) return;
    const nextIndex = constructionState.playbackStepIndex == null ? -1 : constructionState.playbackStepIndex + 1;
    if (nextIndex >= constructionState.playbackSteps.length) {
      constructionState.playbackStepIndex = constructionState.playbackSteps.length - 1;
      constructionState.playbackRunning = false;
      if (constructionState.playbackRaf) {
        window.cancelAnimationFrame(constructionState.playbackRaf);
        constructionState.playbackRaf = null;
      }
      updatePlaybackStatus();
      rebuildLegend();
      renderLegend();
      updateCircleTable();
      requestRedraw();
      return;
    }
    constructionState.playbackStepIndex = nextIndex;
    updatePlaybackStatus();
    requestRedraw();
  }

  function getPlaybackStepDurationMs() {
    const speed = Math.max(0.25, Number(constructionState.playbackSpeed) || 1);
    return Math.max(80, Math.round(720 / speed));
  }

  function schedulePlaybackFrame(timestamp) {
    if (!constructionState.playbackRunning) {
      constructionState.playbackRaf = null;
      return;
    }
    if (!constructionState.playbackLastFrameAt) {
      constructionState.playbackLastFrameAt = timestamp;
    }
    const elapsed = timestamp - constructionState.playbackLastFrameAt;
    if (elapsed >= getPlaybackStepDurationMs()) {
      constructionState.playbackLastFrameAt = timestamp;
      stepPlaybackFrame();
    }
    if (constructionState.playbackRunning) {
      constructionState.playbackRaf = window.requestAnimationFrame(schedulePlaybackFrame);
    } else {
      constructionState.playbackRaf = null;
    }
  }

  function startPlayback() {
    if (!constructionState.dashboard) {
      setSyncStatus("먼저 시공 데이터를 불러오세요.", true);
      return;
    }
    const steps = buildPlaybackSteps(constructionState.dateGrouping);
    if (!steps.length) {
      setSyncStatus("선택한 기간에 시공일 데이터가 없습니다.", true);
      return;
    }
    if (constructionState.playbackRaf) {
      window.cancelAnimationFrame(constructionState.playbackRaf);
      constructionState.playbackRaf = null;
    }
    if (constructionOverlayMode.value !== "date") {
      constructionOverlayMode.value = "date";
      constructionState.overlayMode = "date";
    }
    constructionState.playbackSteps = steps;
    constructionState.playbackStepLookup = new Map(steps.map((step, index) => [step.key, index]));
    constructionState.playbackStepIndex = -1;
    constructionState.playbackRunning = true;
    constructionState.playbackLastFrameAt = 0;
    updatePlaybackStatus();
    rebuildLegend();
    renderLegend();
    updateCircleTable();
    requestRedraw();
    stepPlaybackFrame();
    constructionState.playbackRaf = window.requestAnimationFrame(schedulePlaybackFrame);
  }

  function togglePlayback() {
    if (constructionState.playbackRunning) {
      clearPlaybackState();
      return;
    }
    startPlayback();
  }

  function setDateGrouping(grouping, { resetPlayback = true } = {}) {
    const nextGrouping = ["day", "week", "month"].includes(grouping) ? grouping : "month";
    constructionState.dateGrouping = nextGrouping;
    syncPlaybackModeButtons();
    if (resetPlayback) {
      clearPlaybackState({ redraw: false });
    }
    rebuildLegend();
    renderLegend();
    updatePlaybackStatus();
    updateCircleTable();
    requestRedraw();
  }

  function getPlaybackOverlayStage(overlay) {
    if (!hasPlaybackFrame() || !overlay?.constructionDate || overlay?.status !== "installed") return null;
    const entry = buildDateGroupingEntry(overlay.constructionDate, constructionState.dateGrouping);
    if (!entry) return "outside";
    const stepIndex = constructionState.playbackStepLookup.get(entry.key);
    if (stepIndex === undefined) return "outside";
    if (stepIndex === constructionState.playbackStepIndex) return "current";
    return stepIndex < constructionState.playbackStepIndex ? "past" : "future";
  }

  function resolveDateOverlayCategory(overlay) {
    const dateValue = overlay?.constructionDate;
    if (!dateValue) return "일자미지정";
    return buildDateGroupingEntry(dateValue, constructionState.dateGrouping)?.label || "일자미지정";
  }

  function renderSettlementPeriod(period) {
    if (!period?.month && !period?.startDate && !period?.endDate) {
      constructionSettlementPeriod.textContent = "-";
      return;
    }
    const monthLabel = escape(period?.month ? `${period.month} 기성` : "기성");
    const rangeLabel = escape(
      period?.startDate && period?.endDate
        ? `${formatCompactDate(period.startDate)} ~ ${formatCompactDate(period.endDate)}`
        : "-"
    );
    constructionSettlementPeriod.innerHTML = `<span class="construction-period-month">${monthLabel}</span><span class="construction-period-range">${rangeLabel}</span>`;
  }

  function overlayStatusLabel(status) {
    const s = String(status ?? "").trim().toLowerCase();
    if (s === "installed") return "시공완료";
    return "미시공";
  }

  function normalizeOverlayCategory(category) {
    if (category === null || category === undefined) return "미지정";
    const text = String(category).trim();
    if (!text) return "미지정";
    if (text === "pending") return "미시공";
    if (text === "installed") return "시공완료";
    if (["미시공", "미분류", "미지정", "일자미지정"].includes(text)) return text;
    return text;
  }

  function isNeutralCategory(category) {
    return neutralCategories.has(normalizeOverlayCategory(category));
  }

  function isPlaybackEquipmentMode() {
    return constructionState.overlayMode === "date" && hasPlaybackFrame();
  }

  function getOverlayCategory(overlay) {
    if (!overlay) return null;
    if (constructionState.overlayMode !== "status" && overlay.status !== "installed") return "미시공";
    if (constructionState.overlayMode === "date") {
      if (isPlaybackEquipmentMode()) return normalizeOverlayCategory(overlay.equipment || "");
      return normalizeOverlayCategory(resolveDateOverlayCategory(overlay));
    }
    if (constructionState.overlayMode === "equipment") return normalizeOverlayCategory(overlay.equipment || "미지정");
    if (constructionState.overlayMode === "method") return normalizeOverlayCategory(overlay.constructionMethod || "미분류");
    return normalizeOverlayCategory(overlay.status || "pending");
  }

  function isOverlayInSettlementPeriod(overlay) {
    const startDate = constructionState.dashboard?.settlement?.period?.startDate;
    const endDate = constructionState.dashboard?.settlement?.period?.endDate;
    const dateValue = overlay?.constructionDate;
    if (!overlay || overlay.status !== "installed") return false;
    if (!startDate || !endDate || !dateValue) return false;
    return dateValue >= startDate && dateValue <= endDate;
  }

  function getOverlayLegendKey(overlay) {
    if (!overlay) return "";
    const playbackStage = getPlaybackOverlayStage(overlay);
    if (constructionState.overlayMode !== "status" && (playbackStage === "future" || playbackStage === "outside")) {
      return "__playback-waiting__";
    }
    // status 모드 범례 키는 rebuildLegend와 동일하게 installed / pending (한글 표기와 혼동 방지)
    if (constructionState.overlayMode === "status") {
      return overlay.status === "installed" ? "installed" : "pending";
    }
    return getOverlayCategory(overlay) || "";
  }

  function matchesLegendFilter(overlay) {
    if (!constructionState.legendFilterKey) return true;
    return getOverlayLegendKey(overlay) === constructionState.legendFilterKey;
  }

  function matchesSettlementPreview(overlay) {
    if (!constructionState.settlementPreviewOnly) return true;
    return isOverlayInSettlementPeriod(overlay);
  }

  function isOverlayVisible(overlay) {
    if (!overlay) return false;
    if (!isViewerOverlayEnabled()) return true;
    return matchesLegendFilter(overlay) && matchesSettlementPreview(overlay);
  }

  function rebuildLegend() {
    const overlays = Array.from(constructionState.overlayMap.values());
    if (constructionState.overlayMode === "status") {
      constructionState.legendItems = [
        { key: "installed", label: "시공완료", color: statusColors.installed },
        { key: "pending", label: "미시공", color: statusColors.pending },
      ];
      if (constructionState.legendFilterKey && !constructionState.legendItems.some((item) => item.key === constructionState.legendFilterKey)) {
        constructionState.legendFilterKey = "";
      }
      return;
    }
    const values = [];
    overlays.forEach((overlay) => {
      const category = getOverlayCategory(overlay);
      if (category && !values.includes(category)) values.push(category);
    });
    const neutralValues = values.filter((value) => isNeutralCategory(value)).sort((a, b) => String(a).localeCompare(String(b)));
    const orderedDateValues = constructionState.overlayMode === "date" && !isPlaybackEquipmentMode()
      ? buildPlaybackSteps(constructionState.dateGrouping).map((step) => step.label).filter((label) => values.includes(label))
      : [];
    const orderedEquipmentValues = isPlaybackEquipmentMode()
      ? (constructionState.dashboard?.charts?.byEquipment || []).map((row) => row?.key).filter((key) => values.includes(key))
      : [];
    const fallbackColoredValues = values.filter((value) => !isNeutralCategory(value) && !orderedDateValues.includes(value) && !orderedEquipmentValues.includes(value)).sort((a, b) => String(a).localeCompare(String(b)));
    const coloredValues = isPlaybackEquipmentMode()
      ? [...orderedEquipmentValues, ...fallbackColoredValues]
      : (constructionState.overlayMode === "date"
        ? [...orderedDateValues, ...fallbackColoredValues]
        : fallbackColoredValues);
    constructionState.legendItems = [
      ...(hasPlaybackFrame() ? [{ key: "__playback-waiting__", label: "재생 대기", color: "#dbe2ea" }] : []),
      ...neutralValues.map((value) => ({ key: value, label: value, color: neutralCategoryColor })),
      ...coloredValues.map((value, index) => ({ key: value, label: value, color: palette[index % palette.length] })),
    ];
    if (constructionState.legendFilterKey && !constructionState.legendItems.some((item) => item.key === constructionState.legendFilterKey)) {
      constructionState.legendFilterKey = "";
    }
  }

  function getLegendColor(category) {
    const found = constructionState.legendItems.find((item) => item.key === category);
    return found ? found.color : statusColors.pending;
  }

  function getOverlayColor(overlay) {
    if (!overlay) return null;
    if (constructionState.overlayMode === "status") return statusColors[overlay.status] || statusColors.pending;
    const legendKey = getOverlayLegendKey(overlay);
    if (legendKey === "__playback-waiting__") return "#dbe2ea";
    return getLegendColor(legendKey || getOverlayCategory(overlay));
  }

  function isViewerOverlayEnabled() {
    if (constructionState.activeTab === "foundation-thickness") {
      return false;
    }
    return constructionState.viewerOverlayEnabled && constructionState.overlayMap.size > 0;
  }

  function getConstructionOverlay(circleOrId) {
    const circleId = typeof circleOrId === "string" ? circleOrId : circleOrId?.id;
    if (!circleId) return null;
    return constructionState.overlayMap.get(circleId) || null;
  }

  function shouldDrawPlaybackPaths() {
    return isViewerOverlayEnabled()
      && hasPlaybackFrame()
      && constructionState.dateGrouping === "day";
  }

  function buildPlaybackPathGroups() {
    if (!shouldDrawPlaybackPaths()) return [];
    const visibleCircles = getVisibleCircles();
    if (!visibleCircles.length) return [];
    const groups = new Map();

    visibleCircles.forEach((circle) => {
      const overlay = getConstructionOverlay(circle);
      if (!overlay || overlay.status !== "installed" || !isOverlayVisible(overlay)) return;
      const stage = getPlaybackOverlayStage(overlay);
      if (stage !== "past" && stage !== "current") return;
      const equipmentKey = normalizeOverlayCategory(overlay.equipment || "미지정");
      const bucket = groups.get(equipmentKey) || [];
      bucket.push({
        circle,
        overlay,
        stage,
        sortDate: overlay.constructionDate || "",
        sortRow: Number(overlay.recordRowNumber) || 0,
        sortLocation: overlay.circleLocation || circle.building_name || "",
        sortPileNumber: overlay.pileNumber || "",
      });
      groups.set(equipmentKey, bucket);
    });

    return Array.from(groups.entries())
      .map(([key, points]) => ({
        key,
        points: points.sort((left, right) => (
          String(left.sortDate).localeCompare(String(right.sortDate))
          || left.sortRow - right.sortRow
          || String(left.sortLocation).localeCompare(String(right.sortLocation))
          || String(left.sortPileNumber).localeCompare(String(right.sortPileNumber))
        )),
      }))
      .filter((group) => group.points.length >= 2);
  }

  function drawPlaybackPathsOncePerFrame() {
    if (!shouldDrawPlaybackPaths()) return;
    if (constructionState.playbackPathFrameToken === constructionState.renderFrameToken) return;
    constructionState.playbackPathFrameToken = constructionState.renderFrameToken;

    const groups = buildPlaybackPathGroups();
    if (!groups.length) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    groups.forEach((group) => {
      const color = getOverlayColor(group.points[group.points.length - 1]?.overlay) || getLegendColor(group.key);
      if (!color) return;

      ctx.beginPath();
      group.points.forEach((point, index) => {
        const canvasPoint = worldToCanvas(point.circle.center_x, point.circle.center_y);
        if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
        else ctx.lineTo(canvasPoint.x, canvasPoint.y);
      });
      ctx.strokeStyle = hexToRgba(color, 0.28);
      ctx.lineWidth = 2;
      ctx.stroke();

      const currentStartIndex = group.points.findIndex((point) => point.stage === "current");
      if (currentStartIndex >= 0) {
        const highlightedPoints = group.points.slice(Math.max(0, currentStartIndex - 1));
        if (highlightedPoints.length >= 2) {
          ctx.beginPath();
          highlightedPoints.forEach((point, index) => {
            const canvasPoint = worldToCanvas(point.circle.center_x, point.circle.center_y);
            if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
            else ctx.lineTo(canvasPoint.x, canvasPoint.y);
          });
          ctx.strokeStyle = hexToRgba(color, 0.68);
          ctx.lineWidth = 3.2;
          ctx.stroke();
        }
      }
    });
    ctx.restore();
  }

  function renderLegend() {
    if (!isViewerOverlayEnabled() && constructionState.overlayMap.size) {
      constructionLegend.innerHTML = '<span class="construction-legend-item construction-legend-item--notice">PDAM 색상 표시가 해제되어 있습니다. 데이터셋에서 다시 적용하면 색상 보기가 돌아옵니다.</span>';
      return;
    }
    if (!constructionState.legendItems.length) {
      constructionLegend.innerHTML = '<span class="construction-legend-item">시공 데이터를 연결하면 범례가 표시됩니다.</span>';
      return;
    }
    constructionLegend.innerHTML = constructionState.legendItems.map((item) => `
      <button
        type="button"
        class="construction-legend-item${constructionState.legendFilterKey === item.key ? " is-active" : ""}"
        data-legend-key="${escape(item.key)}"
        title="${escape(item.label)}만 보기"
      >
        <i class="construction-legend-swatch" style="background:${item.color}"></i>
        <span>${escape(item.label)}</span>
      </button>
    `).join("");
  }

  function isFoundationLabelVizEnabled() {
    return state.showFoundationLabelViz !== false;
  }

  function isPfPolyLinkVizEnabled() {
    return state.showPfPolyLinkViz !== false;
  }

  function polylineVerticesCentroid(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return null;
    let sx = 0;
    let sy = 0;
    vertices.forEach((v) => {
      sx += Number(v.x);
      sy += Number(v.y);
    });
    const n = vertices.length;
    return { x: sx / n, y: sy / n };
  }

  /** 매칭·연결선: 삽입점보다 글자 중심(text_center) 우선 */
  function getPfTextWorldXYFromTextRecord(t) {
    const tx = Number(t?.text_center_x ?? t?.insert_x ?? t?.center_x);
    const ty = Number(t?.text_center_y ?? t?.insert_y ?? t?.center_y);
    return { x: tx, y: ty };
  }

  /** 폴리 밖에 있는 P/F일 때 이 거리(월드) 이상이면 연결선 미표시 — 원거리 허브 연결 완화(mm 도면 가정) */
  const PF_LINK_MAX_DIST_WHEN_OUTSIDE_POLY = 680;

  /**
   * P/F 좌표계 추정: 글자 높이 중앙값이 작으면 m 단위, 크면 mm 단위로 본다.
   * (m 도면에서 2000을 쓰면 2000m 한도가 되어 근접 표가 쏟아짐)
   */
  function getPfSpatialUnitsLikelyMeters() {
    const cands = getPfTextCandidatesCached();
    if (!cands?.length) return false;
    const hs = cands.map((c) => Number(c.textHeight) || 0).filter((h) => h > 0);
    if (!hs.length) return false;
    hs.sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)];
    return med < 45;
  }

  /** 큰↔작 짝·근접 검토 거리 상한(월드 단위: m 도면≈2, mm 도면≈2000≈2m) */
  function getPfLargeSmallPairDistanceCapWorld() {
    return getPfSpatialUnitsLikelyMeters() ? 2 : 2000;
  }

  /** P/F 텍스트 기준점 ↔ 윤곽 무게중심(점선) · 파일(실선) — 뷰포트·파일 필터·배치 스트로크로 부하 최소화 */
  function drawPfPolyAndFileLinkLines() {
    if (!isPfPolyLinkVizEnabled()) return;
    if (typeof view !== "undefined" && view.scale < 0.028) return;
    const rows = getPfPolylineMatchGroups();
    if (!rows.length) return;
    const polyById = new Map(
      getBackgroundPolylinesForClick().map((p) => [String(p.id), p]),
    );
    const visibleIds =
      typeof getVisibleCircles === "function"
        ? new Set(getVisibleCircles().map((c) => String(c.id)))
        : null;
    const vp = typeof getViewportWorldRect === "function" ? getViewportWorldRect() : null;
    const padWorld = vp && typeof view !== "undefined" && Number.isFinite(view.scale) ? 72 / view.scale : 0;
    const nearVp = (wx, wy) => {
      if (!vp || !Number.isFinite(wx) || !Number.isFinite(wy)) return true;
      return (
        wx >= vp.minX - padWorld
        && wx <= vp.maxX + padWorld
        && wy >= vp.minY - padWorld
        && wy <= vp.maxY + padWorld
      );
    };

    const dashedCanvas = [];
    const solidCanvas = [];

    rows.forEach((row) => {
      const t = state.textMap?.get(String(row.textId));
      if (!t) return;
      const { x: ix, y: iy } = getPfTextWorldXYFromTextRecord(t);
      if (!Number.isFinite(ix) || !Number.isFinite(iy)) return;
      const cnx = row.outlineCentroidX;
      const cny = row.outlineCentroidY;
      const filteredCircles = (row.circleIds || []).filter((cid) => !visibleIds || visibleIds.has(String(cid)));

      let show = nearVp(ix, iy);
      if (!show && Number.isFinite(cnx) && Number.isFinite(cny)) show = nearVp(cnx, cny);
      if (!show) {
        for (let fi = 0; fi < filteredCircles.length; fi += 1) {
          const c = state.circleMap?.get(filteredCircles[fi]);
          if (c && nearVp(Number(c.center_x), Number(c.center_y))) {
            show = true;
            break;
          }
        }
      }
      if (!show) return;

      const rowPoly = polyById.get(String(row.polylineId));
      const verts = rowPoly?.vertices;
      const textInsidePoly =
        verts
        && verts.length >= 3
        && typeof pointInPolygon === "function"
        && pointInPolygon({ x: ix, y: iy }, verts);

      function linkAllowed(wx, wy) {
        if (!Number.isFinite(wx) || !Number.isFinite(wy)) return false;
        if (textInsidePoly) return true;
        return Math.hypot(ix - wx, iy - wy) < PF_LINK_MAX_DIST_WHEN_OUTSIDE_POLY;
      }

      const start = worldToCanvas(ix, iy);
      if (Number.isFinite(cnx) && Number.isFinite(cny) && linkAllowed(cnx, cny)) {
        dashedCanvas.push([start, worldToCanvas(cnx, cny)]);
      }
      filteredCircles.forEach((cid) => {
        const c = state.circleMap?.get(cid);
        if (!c) return;
        const wx = Number(c.center_x);
        const wy = Number(c.center_y);
        if (!linkAllowed(wx, wy)) return;
        solidCanvas.push([start, worldToCanvas(wx, wy)]);
      });
    });

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dashedCanvas.length) {
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.35;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "rgba(45, 212, 191, 0.82)";
      ctx.beginPath();
      dashedCanvas.forEach(([a, b]) => {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (solidCanvas.length) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
      ctx.beginPath();
      solidCanvas.forEach(([a, b]) => {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 동일 center에 서로 다른 circle id가 여러 개인 도면(동일 좌표 중첩)에서 링·숫자가 겹쳐 보이는 것을 막기 위한 월드 키. */
  function foundationOverlayWorldPosKey(circle) {
    const x = Number(circle?.center_x);
    const y = Number(circle?.center_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return `${Math.round(x * 100) / 100}_${Math.round(y * 100) / 100}`;
  }

  function circlesMatchFoundationDuplicatePolicy(a, b) {
    if (!a || !b) return false;
    if (typeof geometryMatchesCoLocatedDupPolicy === "function") {
      try {
        return Boolean(geometryMatchesCoLocatedDupPolicy(a, b));
      } catch (_error) {
        // ignore and fallback to strict key match
      }
    }
    const ak = foundationOverlayWorldPosKey(a);
    const bk = foundationOverlayWorldPosKey(b);
    return Boolean(ak && bk && ak === bk);
  }

  function getFoundationTwinCircleIdsLookup() {
    const circles = Array.isArray(state.circles) ? state.circles : [];
    const excludeLoose = Boolean(state.filter?.excludeIdenticalGeometryDuplicates);
    const key = `${circles.length}|${excludeLoose}`;
    if (
      constructionState.foundationTwinCircleIdsLookupKey === key
      && constructionState.foundationTwinCircleIdsLookupRef === circles
      && constructionState.foundationTwinCircleIdsLookup
    ) {
      return constructionState.foundationTwinCircleIdsLookup;
    }
    const n = circles.length;
    const parent = circles.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (i, j) => {
      const pi = find(i);
      const pj = find(j);
      if (pi !== pj) parent[pi] = pj;
    };
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (!circlesMatchFoundationDuplicatePolicy(circles[i], circles[j])) continue;
        union(i, j);
      }
    }
    const groups = new Map();
    for (let i = 0; i < n; i += 1) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      const idKey = String(circles[i]?.id ?? "").trim();
      if (idKey) groups.get(root).push(idKey);
    }
    const lookup = new Map();
    groups.forEach((idKeys) => {
      const uniq = Array.from(new Set(idKeys)).sort((a, b) => a.localeCompare(b, "en"));
      if (!uniq.length) return;
      uniq.forEach((idKey) => lookup.set(idKey, uniq));
    });
    constructionState.foundationTwinCircleIdsLookupKey = key;
    constructionState.foundationTwinCircleIdsLookupRef = circles;
    constructionState.foundationTwinCircleIdsLookup = lookup;
    return lookup;
  }

  function getFoundationTwinCircleIds(circleId) {
    const idKey = String(circleId ?? "").trim();
    if (!idKey) return [];
    const lookup = getFoundationTwinCircleIdsLookup();
    return lookup.get(idKey) || [idKey];
  }

  function expandFoundationCircleIdsWithTwins(circleIds) {
    const out = new Set();
    (Array.isArray(circleIds) ? circleIds : []).forEach((circleId) => {
      const twins = getFoundationTwinCircleIds(circleId);
      if (!twins.length) return;
      twins.forEach((id) => out.add(String(id)));
    });
    return Array.from(out);
  }

  /** slot: "ring" | "label" — 같은 좌표에서 링 한 번·라벨 한 번만. */
  function consumeFoundationOverlaySlot(circle, slot) {
    const posKey = foundationOverlayWorldPosKey(circle);
    if (!posKey) return true;
    const guard = constructionState.foundationOverlayWorldPosGuard;
    if (!guard) return true;
    const k = `${slot}:${posKey}`;
    if (guard.has(k)) return false;
    guard.add(k);
    return true;
  }

  function numericFromPerPileMapWithTwins(map, circleId) {
    if (!map || circleId == null) return null;
    const selfKey = String(circleId).trim();
    const direct = toFiniteNumberOrNull(map[circleId] ?? map[selfKey]);
    if (direct != null) return direct;
    const twins = getFoundationTwinCircleIds(circleId);
    for (let i = 0; i < twins.length; i += 1) {
      const twinKey = String(twins[i] ?? "").trim();
      if (!twinKey || twinKey === selfKey) continue;
      const value = toFiniteNumberOrNull(map[twinKey]);
      if (value != null) return value;
    }
    return null;
  }

  function pileNumericFromMap(map, circleId) {
    return numericFromPerPileMapWithTwins(map, circleId);
  }

  /** 동일 좌표 다중 말뚝일 때 누구 링/라벨을 먼저 그릴지 — 말뚝별 입력·선택이 보이게 한다. */
  function scoreCircleForFoundationOverlayPriority(circle) {
    const id = circle?.id;
    if (id == null) return 0;
    let s = 0;
    if (pileNumericFromMap(constructionState.foundationTopByPileId, id) != null) s += 1000;
    if (pileNumericFromMap(constructionState.drillingStartByPileId, id) != null) s += 500;
    if (pileNumericFromMap(constructionState.foundationThicknessByPileId, id) != null) s += 300;
    if (pileNumericFromMap(constructionState.foundationPitOffsetByPileId, id) != null) s += 100;
    if (state.manualSelection?.circleId === id) s += 50;
    if (typeof hoveredCircleId !== "undefined" && hoveredCircleId === id) s += 40;
    if (state.highlightedCircleIds?.has?.(id)) s += 10;
    return s;
  }

  function sortCirclesForFoundationOverlay(circles) {
    if (!Array.isArray(circles) || circles.length <= 1) return circles;
    const buckets = new Map();
    const order = [];
    circles.forEach((circle, i) => {
      const pk = foundationOverlayWorldPosKey(circle);
      const bk = pk != null ? pk : `__solo:${String(circle?.id)}:${i}`;
      if (!buckets.has(bk)) {
        buckets.set(bk, []);
        order.push(bk);
      }
      buckets.get(bk).push(circle);
    });
    return order.flatMap((bk) => {
      const arr = buckets.get(bk);
      if (!arr || arr.length <= 1) return arr || [];
      return [...arr].sort((a, b) => {
        const ds = scoreCircleForFoundationOverlayPriority(b) - scoreCircleForFoundationOverlayPriority(a);
        if (ds !== 0) return ds;
        return String(a.id).localeCompare(String(b.id), "en");
      });
    });
  }

  drawCanvas = function drawCanvasWithConstruction() {
    const { width, height } = typeof getCanvasSize === "function"
      ? getCanvasSize()
      : { width: Number(canvas?.width) || 0, height: Number(canvas?.height) || 0 };
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    if (!state.hasDataset || !(state.circles || []).length) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText("Upload a DXF to visualize", width / 2, height / 2);
      return;
    }
    constructionState.renderFrameToken += 1;
    constructionState.playbackPathFrameToken = -1;
    constructionState.foundationOverlayWorldPosGuard = new Set();
    const prevGetVisibleCircles = typeof getVisibleCircles === "function" ? getVisibleCircles : null;
    if (prevGetVisibleCircles) {
      getVisibleCircles = function getVisibleCirclesFoundationOverlayOrder() {
        return sortCirclesForFoundationOverlay(prevGetVisibleCircles());
      };
    }
    try {
      drawPolylineHints();
      drawBuildings();
      drawFoundationAreaHatches();
      drawAreaCreationPreview();
      const circles = getVisibleCircles();
      const duplicateCircleIds = typeof getDuplicateCircleIds === "function" ? getDuplicateCircleIds() : new Set();
      if (state.showCircles) {
        circles.forEach((circle) => drawCircle(circle, duplicateCircleIds));
      }
      if (state.showPoints) {
        circles.forEach((circle) => drawCirclePoint(circle));
      }
      if (typeof drawDuplicateLabels === "function") {
        drawDuplicateLabels(circles, duplicateCircleIds);
      }
      if (state.showTextLabels) {
        drawTextLabels();
      }
      if (state.showMatchLines) {
        drawCircleToNumberMatchLines(circles);
      }
      drawTooltip();
    } finally {
      if (prevGetVisibleCircles) getVisibleCircles = prevGetVisibleCircles;
    }
    drawPfPolyAndFileLinkLines();
    if (isFoundationTabActive()) {
      const manualPolylineIds = constructionState.foundationSelectedPolylineIds || new Set();
      const filteredPolylineIds = constructionState.foundationFilteredPolylineIds || new Set();
      const highlightPolylineIds = new Set([
        ...Array.from(manualPolylineIds),
        ...Array.from(filteredPolylineIds),
      ]);
      if (highlightPolylineIds.size) {
        const lookup = getFoundationPolylineIdLookup();
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#22d3ee";
        ctx.setLineDash([]);
        Array.from(highlightPolylineIds).forEach((polylineId) => {
          const polyline = lookup.get(polylineId);
          if (!polyline || !Array.isArray(polyline.vertices) || polyline.vertices.length < 3) return;
          ctx.beginPath();
          polyline.vertices.forEach((vertex, index) => {
            const p = worldToCanvas(vertex.x, vertex.y);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        });
        ctx.restore();
      }
    }
    if (
      constructionState.foundationWindowSelect
      && constructionState.foundationWindowRect
      && isFoundationTabActive()
    ) {
      const rect = constructionState.foundationWindowRect;
      const minX = Math.min(rect.startX, rect.endX);
      const minY = Math.min(rect.startY, rect.endY);
      const width = Math.abs(rect.endX - rect.startX);
      const height = Math.abs(rect.endY - rect.startY);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#2563eb";
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.lineWidth = 1.4;
      ctx.fillRect(minX, minY, width, height);
      ctx.strokeRect(minX, minY, width, height);
      ctx.restore();
    }
  };

  const originalDrawCircle = drawCircle;
  drawCircle = function drawCircleWithConstruction(circle, duplicateCircleIds) {
    drawPlaybackPathsOncePerFrame();
    const overlay = getConstructionOverlay(circle);
    if (!overlay || !isViewerOverlayEnabled()) {
      originalDrawCircle(circle, duplicateCircleIds);
      if (constructionState.foundationSelectedCircleIds.has(circle.id)) {
        const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
        const radius = Math.max(0.5, circle.radius * view.scale);
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const isPreviewOnly = constructionState.foundationPreviewCircleIds.has(circle.id)
        && !constructionState.foundationSelectedCircleIds.has(circle.id);
      if (isPreviewOnly) {
        const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
        const radius = Math.max(0.5, circle.radius * view.scale);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius + 2.2, 0, Math.PI * 2);
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
      if (isFoundationLabelVizEnabled() && constructionState.foundationOverlayShowThickness !== false) {
        const mm = getFoundationThicknessMm(circle.id);
        if (Number.isFinite(mm) && consumeFoundationOverlaySlot(circle, "ring")) {
          const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
          const radius = Math.max(0.5, circle.radius * view.scale);
          const color = getFoundationThicknessColor(mm);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }
      return;
    }
    if (!isOverlayVisible(overlay)) {
      return;
    }
    const color = getOverlayColor(overlay);
    const playbackStage = getPlaybackOverlayStage(overlay);
    const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
    const radius = Math.max(0.5, circle.radius * view.scale);
    const isHighlighted = state.highlightedCircleIds.has(circle.id);
    const isManualSelected = state.manualSelection.circleId === circle.id;
    const isDuplicate = duplicateCircleIds && duplicateCircleIds.has(circle.id);
    const fillAlpha = playbackStage === "future" || playbackStage === "outside"
      ? 0.16
      : playbackStage === "current"
        ? 0.44
        : playbackStage === "past"
          ? 0.22
          : (overlay.status === "pending" ? 0.16 : 0.28);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, fillAlpha);
    ctx.fill();

    if (isDuplicate && !circle.has_error) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = isHighlighted ? "#facc15" : "#fb923c";
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = circle.has_error
        ? "#f97316"
        : isHighlighted
          ? "#facc15"
          : (playbackStage === "future" || playbackStage === "outside" ? "#cbd5e1" : color);
    }
    ctx.lineWidth = isManualSelected ? 4 : playbackStage === "current" ? 2.4 : isHighlighted ? 2 : 1.35;
    ctx.stroke();
    ctx.setLineDash([]);

    if (isManualSelected) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (constructionState.foundationSelectedCircleIds.has(circle.id)) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const originalDrawCirclePoint = drawCirclePoint;
  drawCirclePoint = function drawCirclePointWithConstruction(circle) {
    drawPlaybackPathsOncePerFrame();
    const overlay = getConstructionOverlay(circle);
    if (!overlay || !isViewerOverlayEnabled()) {
      originalDrawCirclePoint(circle);
      if (isFoundationLabelVizEnabled()) {
        const labelParts = buildFoundationCanvasLabelParts(circle);
        if (labelParts.length && view.scale >= 0.45 && consumeFoundationOverlaySlot(circle, "label")) {
          const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
          drawFoundationCanvasLabelStack(circle, x, y, labelParts);
        }
      }
      return;
    }
    if (!isOverlayVisible(overlay)) {
      return;
    }
    const { x, y } = worldToCanvas(circle.center_x, circle.center_y);
    const isHighlighted = state.highlightedCircleIds.has(circle.id) || hoveredCircleId === circle.id;
    const isManualSelected = state.manualSelection.circleId === circle.id;
    const playbackStage = getPlaybackOverlayStage(overlay);
    const pointRadius = isManualSelected ? 5 : playbackStage === "current" ? 4.4 : 3;
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = circle.has_error
      ? "#fb7185"
      : isHighlighted
        ? "#facc15"
        : (playbackStage === "future" || playbackStage === "outside" ? "#dbe2ea" : getOverlayColor(overlay));
    ctx.fill();
    if (isManualSelected) {
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (playbackStage === "future" || playbackStage === "outside") {
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (playbackStage === "current") {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (isFoundationLabelVizEnabled()) {
      const labelParts = buildFoundationCanvasLabelParts(circle);
      if (labelParts.length && view.scale >= 0.45 && consumeFoundationOverlaySlot(circle, "label")) {
        drawFoundationCanvasLabelStack(circle, x, y, labelParts);
      }
    }
  };

  const originalDrawTooltip = drawTooltip;
  drawTooltip = function drawTooltipWithConstruction() {
    originalDrawTooltip();
    if (!isViewerOverlayEnabled()) return;
    if (!hoveredCircleId || tooltip.classList.contains("hidden")) return;
    const overlay = getConstructionOverlay(hoveredCircleId);
    if (!overlay || !isOverlayVisible(overlay)) return;
    const lines = [
      `상태 ${overlayStatusLabel(overlay.status)}`,
      overlay.constructionDate ? `시공일 ${overlay.constructionDate}` : null,
      overlay.equipment ? `장비 ${overlay.equipment}` : null,
      overlay.constructionMethod ? `공법 ${overlay.constructionMethod}` : null,
      overlay.pileRemaining != null ? `잔량 ${formatMetric(overlay.pileRemaining, 2)} m` : null,
      isFoundationLabelVizEnabled() && Number.isFinite(getFoundationThicknessMm(hoveredCircleId))
        ? `기초골조 두께 ${Math.round(getFoundationThicknessMm(hoveredCircleId))} mm`
        : null,
    ].filter(Boolean);
    if (!lines.length) return;
    tooltip.innerHTML += `<br /><span>${lines.join("<br />")}</span>`;
  };

  const originalHandleCanvasMouseDown = handleCanvasMouseDown;
  const originalHandleCanvasMouseMove = handleCanvasMouseMove;
  const originalHandleCanvasMouseUp = handleCanvasMouseUp;
  const originalHandleCanvasDoubleClick = handleCanvasDoubleClick;

  function isFoundationTabActive() {
    return constructionState.activeTab === "foundation-thickness" && constructionState.isOpen;
  }

  function pickPolylineAtCanvasPoint(canvasX, canvasY) {
    const world = canvasToWorld(canvasX, canvasY);
    const list = getBackgroundPolylinesForClick().map((row) => ({
      ...row,
      area: polygonArea(row.vertices),
    }));
    const candidates = list.filter((row) => pointInPolygon(world, row.vertices));
    if (!candidates.length) return null;
    const band = getCurrentAreaRange(list);
    const inBand = candidates.filter((row) => row.area >= band.min && row.area <= band.max);
    const target = inBand.length ? inBand : candidates;
    target.sort((a, b) => {
      if (Boolean(a.isRawClosed) !== Boolean(b.isRawClosed)) {
        return a.isRawClosed ? -1 : 1;
      }
      if (Math.abs(a.area - b.area) > 1e-6) return a.area - b.area;
      const scoreA = Math.abs(Math.log((a.area || 1) / (band.mode || a.area || 1)));
      const scoreB = Math.abs(Math.log((b.area || 1) / (band.mode || b.area || 1)));
      if (Math.abs(scoreA - scoreB) > 1e-6) return scoreA - scoreB;
      return String(a.id).localeCompare(String(b.id));
    });
    return target[0] || null;
  }

  function getBackgroundPolylinesForClick() {
    const source = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
    const fallback = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
    const effectiveSource = source.length ? source : fallback;
    const cacheKey = `${source.length}|${fallback.length}|${effectiveSource.length}`;
    if (constructionState.foundationBackgroundPolylineCacheKey === cacheKey) {
      return constructionState.foundationBackgroundPolylineCache;
    }
    const rows = [];
    effectiveSource.forEach((polyline, index) => {
      const rawPoints = (Array.isArray(polyline?.points) ? polyline.points : [])
        .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
        .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
      const vertices = buildNormalizedPolylineVertices(polyline);
      if (!isFoundationOutlineVerticesUsable(vertices)) return;
      let isRawClosed = false;
      if (rawPoints.length >= 4) {
        const first = rawPoints[0];
        const last = rawPoints[rawPoints.length - 1];
        const closeDistance = Math.hypot(first.x - last.x, first.y - last.y);
        const xs = rawPoints.map((v) => v.x);
        const ys = rawPoints.map((v) => v.y);
        const span = Math.max(
          (Math.max(...xs) - Math.min(...xs)) || 0,
          (Math.max(...ys) - Math.min(...ys)) || 0,
          1,
        );
        const closureTol = span * 0.02;
        isRawClosed = closeDistance < 1e-6 || closeDistance <= closureTol;
      }
      const id = String(polyline?.id || polyline?.cluster_id || `polyline-${index + 1}`);
      rows.push({ id, vertices, isRawClosed });
    });
    constructionState.foundationBackgroundPolylineCacheKey = cacheKey;
    constructionState.foundationBackgroundPolylineCache = rows;
    return rows;
  }

  /** draw 루프에서 매 프레임 Map 생성 방지 */
  function getFoundationPolylineIdLookup() {
    const polys = getBackgroundPolylinesForClick();
    const k = constructionState.foundationBackgroundPolylineCacheKey || String(polys.length);
    if (constructionState.foundationPolylineIdLookupKey === k && constructionState.foundationPolylineIdLookup) {
      return constructionState.foundationPolylineIdLookup;
    }
    const m = new Map(polys.map((p) => [p.id, p]));
    constructionState.foundationPolylineIdLookupKey = k;
    constructionState.foundationPolylineIdLookup = m;
    return m;
  }

  function collectAreaStats(rows) {
    const areas = (rows || [])
      .map((row) => Number(row?.area))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    if (!areas.length) {
      return { mode: 0, minArea: 0, maxArea: 0 };
    }
    const minArea = areas[0];
    const maxArea = areas[areas.length - 1];
    let mode = areas[Math.floor(areas.length / 2)];
    if (areas.length >= 4 && maxArea > minArea) {
      const bins = Math.max(8, Math.min(18, Math.floor(Math.sqrt(areas.length)) + 6));
      const logMin = Math.log(minArea);
      const logMax = Math.log(maxArea);
      const span = Math.max(1e-9, logMax - logMin);
      const counts = Array.from({ length: bins }, () => 0);
      areas.forEach((area) => {
        const pos = (Math.log(area) - logMin) / span;
        const idx = Math.max(0, Math.min(bins - 1, Math.floor(pos * bins)));
        counts[idx] += 1;
      });
      let peak = 0;
      for (let i = 1; i < counts.length; i += 1) {
        if (counts[i] > counts[peak]) peak = i;
      }
      const left = logMin + (span * peak) / bins;
      const right = logMin + (span * (peak + 1)) / bins;
      mode = Math.exp((left + right) / 2);
    }
    return { mode, minArea, maxArea };
  }

  function getCurrentAreaRange(rows) {
    const stats = collectAreaStats(rows);
    const minArea = stats.minArea || 0;
    const maxArea = stats.maxArea || 0;
    if (!(maxArea > minArea)) {
      return { ...stats, min: minArea, max: maxArea };
    }
    // 중요: rows는 그룹별 부분집합일 수 있으므로, 여기서 전역 slider 상태를
    // 부분집합 min/max로 재클램프하면 최대값이 13처럼 점점 줄어든다.
    // 전역 bound가 있으면 그것을 우선 사용하고, 없을 때만 rows 통계를 fallback으로 쓴다.
    const globalMin = Number(constructionState.foundationAreaBoundMin);
    const globalMax = Number(constructionState.foundationAreaBoundMax);
    const clampMin = Number.isFinite(globalMin) ? globalMin : minArea;
    const clampMax = Number.isFinite(globalMax) && globalMax > clampMin ? globalMax : maxArea;
    let selectedMin = Number(constructionState.foundationAreaMinValue);
    let selectedMax = Number(constructionState.foundationAreaMaxValue);
    if (!Number.isFinite(selectedMin)) selectedMin = clampMin;
    if (!Number.isFinite(selectedMax)) selectedMax = clampMax;
    selectedMin = Math.max(clampMin, Math.min(clampMax, selectedMin));
    selectedMax = Math.max(clampMin, Math.min(clampMax, selectedMax));
    if (selectedMax < selectedMin) selectedMax = selectedMin;
    return {
      ...stats,
      min: selectedMin,
      max: selectedMax,
    };
  }

  function toggleFoundationPolylineSelection(polylineId) {
    if (!polylineId) return false;
    if (!constructionState.foundationMultiSelect) {
      if (
        constructionState.foundationSelectedPolylineIds.size === 1
        && constructionState.foundationSelectedPolylineIds.has(polylineId)
      ) {
        constructionState.foundationSelectedPolylineIds.clear();
        return false;
      }
      constructionState.foundationSelectedPolylineIds = new Set([polylineId]);
      return true;
    }
    if (constructionState.foundationSelectedPolylineIds.has(polylineId)) {
      constructionState.foundationSelectedPolylineIds.delete(polylineId);
      return false;
    } else {
      constructionState.foundationSelectedPolylineIds.add(polylineId);
      return true;
    }
  }

  function toggleFoundationPolylineGroupSelection(polyline) {
    if (!polyline?.id) return { selected: false, twinIds: [] };
    const twinIds = getPolylineTwinIdsByInsideSet(polyline);
    const selectedSet = constructionState.foundationSelectedPolylineIds || new Set();
    const effectiveIds = getEffectiveCircleIdsForPolylineToggle(polyline);
    const allInsideAlreadySelected = effectiveIds.length > 0
      && effectiveIds.every((id) => constructionState.foundationSelectedCircleIds.has(id));
    const anySelected = twinIds.some((id) => selectedSet.has(id));
    // 이미 내부 객체가 모두 선택된 상태에서 폴리라인만 미선택이면, 첫 클릭은 "선택"이 아니라 "해제"가 기대 동작이다.
    const selected = !(anySelected || allInsideAlreadySelected);
    if (!constructionState.foundationMultiSelect) {
      constructionState.foundationSelectedPolylineIds = selected ? new Set(twinIds) : new Set();
    } else if (selected) {
      twinIds.forEach((id) => selectedSet.add(id));
    } else {
      twinIds.forEach((id) => selectedSet.delete(id));
    }
    return { selected, twinIds };
  }

  function toggleFoundationCircleSelection(circleId) {
    if (!circleId) return false;
    if (!constructionState.foundationMultiSelect) {
      if (
        constructionState.foundationSelectedCircleIds.size === 1
        && constructionState.foundationSelectedCircleIds.has(circleId)
      ) {
        constructionState.foundationSelectedCircleIds.clear();
        return false;
      }
      constructionState.foundationSelectedCircleIds = new Set([circleId]);
      return true;
    }
    if (constructionState.foundationSelectedCircleIds.has(circleId)) {
      constructionState.foundationSelectedCircleIds.delete(circleId);
      return false;
    } else {
      constructionState.foundationSelectedCircleIds.add(circleId);
      return true;
    }
  }

  function getCirclesInsidePolylineForCurrentScope(polyline) {
    if (!polyline?.vertices?.length) return [];
    return (state.circles || []).filter((circle) => (
      pointInVertices(circle, polyline.vertices) && isNumberMatchedCircle(circle)
    ));
  }

  function isNumberMatchedCircle(circle) {
    const text = String(circle?.matched_text?.text ?? "").trim();
    return text.length > 0;
  }

  function isStrictNumberMatchedCircle(circle) {
    const textId = String(circle?.matched_text_id ?? circle?.matched_text?.id ?? "").trim();
    return textId.length > 0 && circle?.has_error !== true;
  }

  function getEffectiveCircleIdsForPolylineToggle(polyline) {
    const insideIds = getCirclesInsidePolylineForCurrentScope(polyline).map((circle) => circle.id);
    if (!polyline?.vertices?.length || insideIds.length <= 1) return insideIds;
    const remaining = new Set(insideIds);
    const parentArea = polygonArea(polyline.vertices);
    const epsilon = 1e-6;
    const children = getBackgroundPolylinesForClick().filter((candidate) => {
      if (!candidate || candidate.id === polyline.id || !Array.isArray(candidate.vertices) || candidate.vertices.length < 3) return false;
      const area = polygonArea(candidate.vertices);
      if (!(area + epsilon < parentArea)) return false;
      return candidate.vertices.every((vertex) => pointInPolygon(vertex, polyline.vertices));
    });
    children.forEach((child) => {
      getCirclesInsidePolylineForCurrentScope(child).forEach((circle) => remaining.delete(circle.id));
    });
    const result = Array.from(remaining);
    return result;
  }

  function getPolylineTwinIdsByInsideSet(polyline) {
    if (!polyline?.id) return [];
    const baseInside = new Set(getCirclesInsidePolylineForCurrentScope(polyline).map((circle) => circle.id));
    if (!baseInside.size) return [String(polyline.id)];
    const rows = getBackgroundPolylinesForClick();
    const twins = rows.filter((row) => {
      const ids = getCirclesInsidePolylineForCurrentScope(row).map((circle) => circle.id);
      if (ids.length !== baseInside.size) return false;
      return ids.every((id) => baseInside.has(id));
    }).map((row) => String(row.id));
    return twins.length ? twins : [String(polyline.id)];
  }

  function getContainingPolylineIdsForCircle(circle) {
    if (!circle) return [];
    const polylines = getBackgroundPolylinesForClick();
    return polylines
      .filter((polyline) => pointInVertices(circle, polyline.vertices))
      .map((polyline) => polyline.id);
  }

  function pickPrimaryContainingPolyline(circle, fallbackPolyline) {
    if (!circle) return null;
    const rows = getBackgroundPolylinesForClick()
      .filter((polyline) => pointInVertices(circle, polyline.vertices))
      .map((polyline) => ({ polyline, area: polygonArea(polyline.vertices) }))
      .sort((a, b) => a.area - b.area);
    const smallest = rows[0]?.polyline || null;
    const chosen = fallbackPolyline?.id ? fallbackPolyline : smallest;
    return chosen;
  }

  function syncContainingPolylineHighlightFromCircle(circle) {
    if (!circle) return;
    const containingPolylines = getBackgroundPolylinesForClick()
      .filter((polyline) => pointInVertices(circle, polyline.vertices));
    containingPolylines.forEach((polyline) => {
      const insideIds = getCirclesInsidePolylineForCurrentScope(polyline).map((row) => row.id);
      if (!insideIds.length) return;
      const allSelected = insideIds.every((id) => constructionState.foundationSelectedCircleIds.has(id));
      if (allSelected) {
        constructionState.foundationSelectedPolylineIds.add(polyline.id);
        constructionState.foundationSuppressedPolylineIds.delete(polyline.id);
      } else {
        constructionState.foundationSelectedPolylineIds.delete(polyline.id);
        if (constructionState.foundationSelectedSubgroupKeys?.size) {
          constructionState.foundationSuppressedPolylineIds.add(polyline.id);
        }
      }
    });
  }

  function selectCirclesFromPolyline(polyline) {
    const inside = getEffectiveCircleIdsForPolylineToggle(polyline);
    if (!constructionState.foundationMultiSelect) {
      constructionState.foundationSelectedCircleIds = new Set(inside.slice(0, 1));
    } else {
      inside.forEach((id) => constructionState.foundationSelectedCircleIds.add(id));
    }
  }

  function deselectCirclesFromPolyline(polyline) {
    const inside = getEffectiveCircleIdsForPolylineToggle(polyline);
    inside.forEach((id) => constructionState.foundationSelectedCircleIds.delete(id));
  }

  function pickCirclesInWindowRect(rect) {
    beforeFoundationMutation();
    const minX = Math.min(rect.startX, rect.endX);
    const maxX = Math.max(rect.startX, rect.endX);
    const minY = Math.min(rect.startY, rect.endY);
    const maxY = Math.max(rect.startY, rect.endY);
    // 윈도우 선택은 필터 미리보기와 무관하게 CAD 화면 기준으로 전체 객체에서 선택한다.
    const candidates = Array.isArray(state.circles) ? state.circles : [];
    const selected = candidates
      .filter((circle) => {
        const cx = Number(circle?.center_x);
        const cy = Number(circle?.center_y);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
        const canvasPoint = worldToCanvas(cx, cy);
        const rawRadius = Number.isFinite(Number(circle?.radius))
          ? Number(circle.radius)
          : (Number.isFinite(Number(circle?.diameter)) ? Number(circle.diameter) / 2 : 0);
        const pxPerWorld = Math.abs(Number(viewport.scale) || 1);
        const radiusPx = Math.max(0, rawRadius * pxPerWorld);
        // 원 윤곽 전체가 사각형 범위에 들어온 경우만 포함한다.
        return (
          canvasPoint.x - radiusPx >= minX
          && canvasPoint.x + radiusPx <= maxX
          && canvasPoint.y - radiusPx >= minY
          && canvasPoint.y + radiusPx <= maxY
        );
      })
      .map((circle) => circle.id);
    const selectedCircleMap = new Map(candidates.map((circle) => [circle.id, circle]));
    let matchedCount = 0;
    let unmatchedCount = 0;
    selected.forEach((id) => {
      const circle = selectedCircleMap.get(id);
      if (isNumberMatchedCircle(circle)) matchedCount += 1;
      else unmatchedCount += 1;
    });
    const strictMatchedCount = selected.filter((id) => isStrictNumberMatchedCircle(selectedCircleMap.get(id))).length;
    const strictUnmatchedIds = selected.filter((id) => !isStrictNumberMatchedCircle(selectedCircleMap.get(id)));
    // #region agent log
    fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM2',location:'construction.js:pickCirclesInWindowRect',message:'window-picked circles match status',data:{selectedCount:selected.length,matchedCount,unmatchedCount,strictMatchedCount,strictUnmatchedCount:strictUnmatchedIds.length,sampleUnmatched:selected.filter((id)=>!isNumberMatchedCircle(selectedCircleMap.get(id))).slice(0,10),sampleStrictUnmatched:strictUnmatchedIds.slice(0,10)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const prevSelectedSet = constructionState.foundationSelectedCircleIds || new Set();
    const selectedSet = new Set(selected);
    let overlapCount = 0;
    selectedSet.forEach((id) => {
      if (prevSelectedSet.has(id)) overlapCount += 1;
    });
    if (!constructionState.foundationMultiSelect) {
      constructionState.foundationSelectedCircleIds = new Set(selected.slice(0, 1));
    } else {
      const selectedCount = selectedSet.size;
      const allAlreadySelected = selectedCount > 0 && overlapCount === selectedCount;
      if (allAlreadySelected) {
        selected.forEach((id) => constructionState.foundationSelectedCircleIds.delete(id));
        if (constructionState.foundationSelectedSubgroupKeys?.size) {
          selected.forEach((id) => constructionState.foundationSuppressedCircleIds.add(id));
        }
      } else {
        selected.forEach((id) => constructionState.foundationSelectedCircleIds.add(id));
        if (constructionState.foundationSelectedSubgroupKeys?.size) {
          selected.forEach((id) => constructionState.foundationSuppressedCircleIds.delete(id));
        }
      }
    }
    const circleById = new Map((state.circles || []).map((circle) => [circle.id, circle]));
    selected.forEach((id) => {
      const circle = circleById.get(id);
      if (circle) syncContainingPolylineHighlightFromCircle(circle);
    });
  }

  function handleFoundationSingleClickAtCanvas(upX, upY) {
    beforeFoundationMutation();
    const polyline = pickPolylineAtCanvasPoint(upX, upY);
    const pickedCircle = pickCircle(upX, upY);
    if (pickedCircle) {
      if (constructionState.foundationPolylineAutoSelect) {
        const targetPolyline = pickPrimaryContainingPolyline(pickedCircle, polyline);
        if (targetPolyline) {
          const { selected, twinIds } = toggleFoundationPolylineGroupSelection(targetPolyline);
          setSyncStatus(selected ? "폴리라인을 선택했습니다." : "폴리라인 선택을 해제했습니다.");
          const insideCircles = getCirclesInsidePolylineForCurrentScope(targetPolyline);
          const insideMatched = insideCircles.filter((circle) => isNumberMatchedCircle(circle)).length;
          const insideUnmatched = insideCircles.length - insideMatched;
          // #region agent log
          fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM1',location:'construction.js:handleFoundationSingleClickAtCanvas:autoSelectPolyline',message:'polyline toggle inside circles match status',data:{polylineId:String(targetPolyline.id||''),selected:Boolean(selected),insideCount:insideCircles.length,insideMatched,insideUnmatched,twinIds:twinIds.slice(0,8)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (selected) selectCirclesFromPolyline(targetPolyline);
          else deselectCirclesFromPolyline(targetPolyline);
          if (constructionState.foundationSelectedSubgroupKeys?.size) {
            const insideIds = getCirclesInsidePolylineForCurrentScope(targetPolyline).map((row) => row.id);
            if (selected) {
              twinIds.forEach((id) => constructionState.foundationSuppressedPolylineIds.delete(id));
              insideIds.forEach((id) => constructionState.foundationSuppressedCircleIds.delete(id));
            } else {
              twinIds.forEach((id) => constructionState.foundationSuppressedPolylineIds.add(id));
              insideIds.forEach((id) => constructionState.foundationSuppressedCircleIds.add(id));
            }
          }
        } else {
          const selected = toggleFoundationCircleSelection(pickedCircle.id);
          if (constructionState.foundationSelectedSubgroupKeys?.size) {
            if (selected) constructionState.foundationSuppressedCircleIds.delete(pickedCircle.id);
            else constructionState.foundationSuppressedCircleIds.add(pickedCircle.id);
          }
          syncContainingPolylineHighlightFromCircle(pickedCircle);
        }
      } else {
        const selected = toggleFoundationCircleSelection(pickedCircle.id);
        if (constructionState.foundationSelectedSubgroupKeys?.size) {
          if (selected) constructionState.foundationSuppressedCircleIds.delete(pickedCircle.id);
          else constructionState.foundationSuppressedCircleIds.add(pickedCircle.id);
        }
        syncContainingPolylineHighlightFromCircle(pickedCircle);
      }
    } else if (polyline) {
      const { selected, twinIds } = toggleFoundationPolylineGroupSelection(polyline);
      setSyncStatus(selected ? "폴리라인을 선택했습니다." : "폴리라인 선택을 해제했습니다.");
      const insideCircles = getCirclesInsidePolylineForCurrentScope(polyline);
      const insideMatched = insideCircles.filter((circle) => isNumberMatchedCircle(circle)).length;
      const insideUnmatched = insideCircles.length - insideMatched;
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM1',location:'construction.js:handleFoundationSingleClickAtCanvas:polylinePath',message:'direct polyline toggle inside circles match status',data:{polylineId:String(polyline.id||''),selected:Boolean(selected),insideCount:insideCircles.length,insideMatched,insideUnmatched,twinIds:twinIds.slice(0,8)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // 자동선택 ON일 때만 폴리라인 내부 객체를 함께 토글한다.
      if (constructionState.foundationPolylineAutoSelect) {
        if (selected) selectCirclesFromPolyline(polyline);
        else deselectCirclesFromPolyline(polyline);
      }
      if (constructionState.foundationSelectedSubgroupKeys?.size) {
        const insideIds = getCirclesInsidePolylineForCurrentScope(polyline).map((circle) => circle.id);
        if (selected) {
          twinIds.forEach((id) => constructionState.foundationSuppressedPolylineIds.delete(id));
          insideIds.forEach((id) => constructionState.foundationSuppressedCircleIds.delete(id));
        } else {
          twinIds.forEach((id) => constructionState.foundationSuppressedPolylineIds.add(id));
          insideIds.forEach((id) => constructionState.foundationSuppressedCircleIds.add(id));
        }
      }
    }
    const selectedCircleMap = new Map((state.circles || []).map((circle) => [circle.id, circle]));
    const selectedIds = Array.from(constructionState.foundationSelectedCircleIds || []);
    const selectedStrictUnmatched = selectedIds.filter((id) => !isStrictNumberMatchedCircle(selectedCircleMap.get(id)));
    // #region agent log
    fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM4',location:'construction.js:handleFoundationSingleClickAtCanvas:postSelection',message:'selected set strict-match status after single click flow',data:{selectedCount:selectedIds.length,strictUnmatchedCount:selectedStrictUnmatched.length,sampleStrictUnmatched:selectedStrictUnmatched.slice(0,10).map((id)=>{const circle=selectedCircleMap.get(id);return{id:String(id||''),has_error:Boolean(circle?.has_error),matched_text_id:String(circle?.matched_text_id??circle?.matched_text?.id??''),matched_text:String(circle?.matched_text?.text??'')};})},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    refreshFoundationPanel();
    requestRedraw();
  }

  handleCanvasMouseDown = function handleCanvasMouseDownWithFoundation(event) {
    if (!isFoundationTabActive()) {
      originalHandleCanvasMouseDown(event);
      return;
    }
    const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
    if (constructionState.foundationWindowSelect && event.button === 0) {
      constructionState.foundationDragging = true;
      constructionState.foundationDragStart = { x: offsetX, y: offsetY };
      constructionState.foundationWindowRect = { startX: offsetX, startY: offsetY, endX: offsetX, endY: offsetY };
      requestRedraw();
      return;
    }
    if (constructionState.foundationWindowSelect && event.button === 1) {
      originalHandleCanvasMouseDown(event);
      return;
    }
    if (event.button === 0) {
      // 좌클릭 드래그 팬을 유지하기 위해 mousedown에서는 팬 시작만 위임하고,
      // mouseup에서 클릭(짧은 이동)일 때만 선택 처리한다.
      constructionState.foundationClickStart = { x: offsetX, y: offsetY };
      constructionState.foundationDidDrag = false;
      originalHandleCanvasMouseDown(event);
      return;
    }
    originalHandleCanvasMouseDown(event);
  };

  handleCanvasMouseMove = function handleCanvasMouseMoveWithFoundation(event) {
    if (
      isFoundationTabActive()
      && constructionState.foundationWindowSelect
      && constructionState.foundationDragging
      && constructionState.foundationWindowRect
    ) {
      const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
      constructionState.foundationWindowRect.endX = offsetX;
      constructionState.foundationWindowRect.endY = offsetY;
      requestRedraw();
      return;
    }
    if (isFoundationTabActive() && constructionState.foundationClickStart) {
      const { x: offsetX, y: offsetY } = getCanvasCoordsFromEvent(event);
      const dx = offsetX - constructionState.foundationClickStart.x;
      const dy = offsetY - constructionState.foundationClickStart.y;
      if (dx * dx + dy * dy > 25) {
        constructionState.foundationDidDrag = true;
      }
    }
    originalHandleCanvasMouseMove(event);
  };

  handleCanvasMouseUp = function handleCanvasMouseUpWithFoundation(event) {
    if (
      isFoundationTabActive()
      && constructionState.foundationWindowSelect
      && constructionState.foundationDragging
      && constructionState.foundationWindowRect
    ) {
      const rect = constructionState.foundationWindowRect;
      const width = Math.abs(rect.endX - rect.startX);
      const height = Math.abs(rect.endY - rect.startY);
      const isClickLike = width < 4 && height < 4;
      const clickX = rect.endX;
      const clickY = rect.endY;
      constructionState.foundationDragging = false;
      if (isClickLike) {
        handleFoundationSingleClickAtCanvas(clickX, clickY);
      } else {
        pickCirclesInWindowRect(constructionState.foundationWindowRect);
      }
      constructionState.foundationWindowRect = null;
      constructionState.foundationClickStart = null;
      constructionState.foundationDidDrag = false;
      if (!isClickLike) {
        refreshFoundationPanel();
        requestRedraw();
      }
      return;
    }
    if (
      isFoundationTabActive()
      && !constructionState.foundationWindowSelect
      && event?.button === 0
      && constructionState.foundationClickStart
      && !constructionState.foundationDidDrag
    ) {
      const { x: upX, y: upY } = getCanvasCoordsFromEvent(event);
      handleFoundationSingleClickAtCanvas(upX, upY);
    }
    constructionState.foundationClickStart = null;
    constructionState.foundationDidDrag = false;
    originalHandleCanvasMouseUp(event);
  };

  handleCanvasDoubleClick = function handleCanvasDoubleClickWithFoundation(event) {
    if (isFoundationTabActive()) return;
    originalHandleCanvasDoubleClick(event);
  };

  updateCircleTable = function updateCircleTableWithConstruction() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const raw = getVisibleCircles();
    const circles = raw.filter((circle) => {
      const overlay = getConstructionOverlay(circle);
      return !overlay || isOverlayVisible(overlay);
    }).sort((a, b) => {
      const buildingA = (a.building_name || "").trim() || "\uFFFF";
      const buildingB = (b.building_name || "").trim() || "\uFFFF";
      if (buildingA !== buildingB) return buildingA.localeCompare(buildingB);
      const numA = getMatchedTextNumber(a.matched_text?.text);
      const numB = getMatchedTextNumber(b.matched_text?.text);
      const sortA = Number.isInteger(numA) && numA >= 1 ? numA : Infinity;
      const sortB = Number.isInteger(numB) && numB >= 1 ? numB : Infinity;
      if (sortA !== sortB) return sortA - sortB;
      return (a.matched_text?.text ?? "").toString().localeCompare((b.matched_text?.text ?? "").toString());
    });

    if (!circles.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 13;
      cell.className = "empty-row";
      cell.textContent = state.hasDataset ? "현재 필터에 맞는 Circle이 없습니다." : "Upload a DXF file to inspect circles.";
      row.appendChild(cell);
      fragment.appendChild(row);
    } else {
      circles.forEach((circle) => {
        const overlay = getConstructionOverlay(circle);
        const row = document.createElement("tr");
        const matchedTextCellClass = !circle.matched_text ? " cell-unmatched-text" : "";
        const areaVal = circle.area != null ? numberFormatter(circle.area) : (circle.radius != null ? numberFormatter(Math.PI * circle.radius * circle.radius) : "-");
        row.innerHTML = `
          <td>${escape(circle.building_name || "-")}</td>
          <td class="matched-text-cell${matchedTextCellClass}">${escape(circle.matched_text?.text ?? "-")}</td>
          <td>${escape(circle.id)}</td>
          <td>${numberFormatter(circle.center_y)}</td>
          <td>${numberFormatter(circle.center_x)}</td>
          <td>${numberFormatter(circle.radius)}</td>
          <td>${numberFormatter(circle.diameter)}</td>
          <td>${areaVal}</td>
          <td>${escape(circle.layer || "-")}</td>
          <td>${escape(circle.block_name || "-")}</td>
          <td>${overlayStatusLabel(overlay?.status)}</td>
          <td>${overlay?.constructionDate || "-"}</td>
          <td>${overlay?.pileRemaining != null ? formatMetric(overlay.pileRemaining, 2) : "-"}</td>
        `;
        row.addEventListener("mouseenter", () => {
          hoveredCircleId = circle.id;
          updateTooltipPosition();
          requestRedraw();
        });
        row.addEventListener("mouseleave", () => {
          hoveredCircleId = null;
          hideTooltip();
          requestRedraw();
        });
        row.addEventListener("click", () => setManualCircleSelection(circle.id, true));
        fragment.appendChild(row);
      });
    }
    tableBody.appendChild(fragment);
    updateBuildingSeqSummary();
  };

  function setSyncStatus(message, isError = false) {
    constructionSyncStatus.textContent = message || "";
    constructionSyncStatus.style.color = isError ? "#dc2626" : "#475569";
  }

  function setDrawerTitle(tab) {
    const titles = { settings: "설정", status: "시공현황", settlement: "기성정리", "foundation-thickness": "기초골조 두께" };
    const subtitles = {
      settings: "PDAM 기록지를 현재 프로젝트와 연결해서 시공 흐름과 월별 기성까지 확인합니다.",
      status: "PDAM 기록지를 현재 프로젝트와 연결해서 시공 흐름과 월별 기성까지 확인합니다.",
      settlement: "PDAM 기록지를 현재 프로젝트와 연결해서 시공 흐름과 월별 기성까지 확인합니다.",
      "foundation-thickness": "기초 골조 두께를 지정해서 기성에 연동합니다.",
    };
    constructionDrawerTitle.textContent = titles[tab] || "시공현황";
    if (constructionDrawerSubtitle) {
      constructionDrawerSubtitle.textContent = subtitles[tab] || subtitles.status;
    }
  }

  function applyDrawerLayoutMode() {
    const foundationOnly = Boolean(constructionState.foundationStandaloneMode);
    if (constructionTabStrip) {
      constructionTabStrip.style.display = foundationOnly ? "none" : "";
    }
    constructionDrawer.classList.toggle("construction-drawer--foundation-only", foundationOnly);
  }

  function disableViewerOverlay(message) {
    if (!constructionState.overlayMap.size) {
      setSyncStatus("해제할 PDAM 색상 정보가 없습니다.", true);
      return;
    }
    clearPlaybackState({ redraw: false });
    constructionState.viewerOverlayEnabled = false;
    constructionState.legendFilterKey = "";
    constructionState.settlementPreviewOnly = false;
    rebuildLegend();
    renderLegend();
    updateSettlementPreviewButton();
    updateCircleTable();
    requestRedraw();
    updateDatasetActionButtons();
    if (message) setSyncStatus(message);
  }

  function enableViewerOverlay(message) {
    constructionState.viewerOverlayEnabled = true;
    rebuildLegend();
    renderLegend();
    updateCircleTable();
    requestRedraw();
    updateDatasetActionButtons();
    if (message) setSyncStatus(message);
  }

  function updateDatasetActionButtons() {
    const hasSelection = Boolean(constructionDatasetSelect?.value);
    const hasViewerOverlay = isViewerOverlayEnabled();
    if (constructionDatasetApply) constructionDatasetApply.disabled = !hasSelection;
    if (constructionDatasetDelete) constructionDatasetDelete.disabled = !hasSelection;
    if (constructionDatasetClearOverlay) constructionDatasetClearOverlay.disabled = !hasViewerOverlay;
  }

  function setConstructionTab(tab) {
    constructionState.activeTab = tab;
    setDrawerTitle(tab);
    constructionTabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
    constructionTabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tab));
    if (tab === "foundation-thickness") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshFoundationPanel();
          requestRedraw();
        });
      });
    }
  }

  function openConstructionDrawer(tab, options = {}) {
    constructionState.isOpen = true;
    constructionState.foundationStandaloneMode = Boolean(
      options?.foundationStandaloneMode && (tab === "foundation-thickness"),
    );
    applyDrawerLayoutMode();
    constructionDrawer.classList.add("open");
    constructionDrawer.setAttribute("aria-hidden", "false");
    setConstructionTab(tab || constructionState.activeTab || "status");
  }

  function closeConstructionDrawer() {
    clearPlaybackState({ redraw: false });
    constructionState.isOpen = false;
    constructionDrawer.classList.remove("open");
    constructionDrawer.setAttribute("aria-hidden", "true");
  }

  function fillSelect(select, options, value, placeholder, mapOption) {
    if (!select) return;
    select.innerHTML = "";
    if (placeholder !== null) {
      const base = document.createElement("option");
      base.value = "";
      base.textContent = placeholder;
      select.appendChild(base);
    }
    (options || []).forEach((optionItem) => {
      const optionData = mapOption ? mapOption(optionItem) : { value: optionItem, label: optionItem };
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    });
    if (value && [...select.options].some((option) => option.value === value)) {
      select.value = value;
    } else if (!value && placeholder === null && select.options.length) {
      select.value = select.options[0].value;
    }
  }

  function renderChipGroup(container, items, selectedValues, category) {
    if (!container) return;
    const selected = new Set(selectedValues || []);
    const chips = [`<button type="button" class="construction-chip${selected.size === 0 ? " is-active" : ""}" data-chip-category="${category}" data-chip-value="">전체</button>`];
    (items || []).forEach((item) => {
      const active = selected.has(item.value);
      const aliases = Array.isArray(item.aliases) && item.aliases.length > 1 ? item.aliases.join(", ") : "";
      chips.push(`
        <button type="button" class="construction-chip${active ? " is-active" : ""}" data-chip-category="${category}" data-chip-value="${escape(item.value)}" title="${escape(aliases || item.label)}">
          <span>${escape(item.label)}</span><small>${item.count ?? ""}</small>
        </button>
      `);
    });
    container.innerHTML = chips.join("");
  }

  function renderBarChart(target, rows, color, labelField = "key", valueField = "uniquePileCount") {
    if (!target) return;
    if (!rows || !rows.length) {
      target.innerHTML = '<div class="empty-row">데이터 없음</div>';
      return;
    }
    const max = Math.max(...rows.map((row) => Number(row[valueField] ?? 0)), 1);
    target.innerHTML = rows.map((row) => {
      const value = Number(row[valueField] ?? 0);
      const label = row[labelField] ?? row.key ?? "-";
      const width = Math.max(4, (value / max) * 100);
      return `<div class="construction-bar-row"><span class="construction-bar-label">${escape(label)}</span><span class="construction-bar-track"><span class="construction-bar-fill" style="width:${width}%;background:${color}"></span></span><span class="construction-bar-value">${value}</span></div>`;
    }).join("");
  }

  function renderLineChart(target, rows, valueField, toneClass) {
    if (!target) return;
    if (!rows || !rows.length) {
      target.innerHTML = '<div class="empty-row">데이터 없음</div>';
      return;
    }
    const values = rows.map((row) => Number(row[valueField] ?? 0));
    const max = Math.max(...values, 1);
    const width = 840;
    const rotateLabels = rows.length > 8;
    const height = rotateLabels ? 236 : 220;
    const left = 30;
    const right = 18;
    const top = 18;
    const bottom = rotateLabels ? 64 : 48;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const stepX = rows.length === 1 ? 0 : chartWidth / (rows.length - 1);
    const points = rows.map((row, index) => {
      const value = Number(row[valueField] ?? 0);
      const x = left + (stepX * index);
      const y = top + chartHeight - ((value / max) * chartHeight);
      return { x, y, label: formatLineChartLabel(row), value };
    });
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const area = `${path} L ${points[points.length - 1].x.toFixed(2)} ${top + chartHeight} L ${points[0].x.toFixed(2)} ${top + chartHeight} Z`;
    const targetLabelCount = rows.length > 32 ? 6 : rows.length > 18 ? 7 : rows.length > 10 ? 8 : rows.length;
    const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(1, targetLabelCount)));
    const labelY = rotateLabels ? height - 10 : height - 16;
    target.innerHTML = `
      <div class="construction-line-chart-shell ${toneClass || ""}">
        <svg viewBox="0 0 ${width} ${height}" class="construction-line-chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="construction-line-fill-${toneClass || "base"}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="rgba(37, 99, 235, 0.28)"></stop>
              <stop offset="100%" stop-color="rgba(37, 99, 235, 0.04)"></stop>
            </linearGradient>
          </defs>
          <line x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" class="construction-line-axis"></line>
          <path d="${area}" fill="url(#construction-line-fill-${toneClass || "base"})"></path>
          <path d="${path}" class="construction-line-path"></path>
          ${points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" class="construction-line-point"></circle>`).join("")}
          ${points.map((point, index) => {
            if (index !== 0 && index !== points.length - 1 && index % labelEvery !== 0) return "";
            return rotateLabels
              ? `<text x="${point.x.toFixed(2)}" y="${labelY}" class="construction-line-label" text-anchor="end" transform="rotate(-32 ${point.x.toFixed(2)} ${labelY})">${escape(point.label)}</text>`
              : `<text x="${point.x.toFixed(2)}" y="${labelY}" class="construction-line-label" text-anchor="middle">${escape(point.label)}</text>`;
          }).join("")}
        </svg>
        <div class="construction-line-chart-caption"><span>최대 ${max}개</span><span>${rows.length}개 구간</span></div>
      </div>
    `;
  }

  function renderMethodMatrix(matrix) {
    if (!constructionMethodMatrix) return;
    if (!matrix || !matrix.rows?.length || !matrix.columns?.length) {
      constructionMethodMatrix.innerHTML = '<div class="empty-row">매트릭스 데이터 없음</div>';
      return;
    }
    const lookup = new Map((matrix.cells || []).map((cell) => [`${cell.row}__${cell.column}`, cell]));
    const body = matrix.rows.map((row) => {
      const cells = matrix.columns.map((column) => {
        const cell = lookup.get(`${row}__${column}`) || { count: 0, totalPenetrationDepth: 0 };
        return `<td class="${cell.count ? "" : "is-empty"}"><strong>${cell.count}</strong><br /><small>항타 ${formatMetric(cell.totalPenetrationDepth, 1)}</small></td>`;
      }).join("");
      return `<tr><th>${escape(row)}</th>${cells}</tr>`;
    }).join("");
    constructionMethodMatrix.innerHTML = `<table><thead><tr><th>공법 \\ 파일종류</th>${matrix.columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderDiagnosticTable(columns, rows, emptyMessage) {
    if (!rows || !rows.length) {
      return `<div class="empty-row">${escape(emptyMessage)}</div>`;
    }
    const head = columns.map((column) => `<th>${escape(column.label)}</th>`).join("");
    const body = rows.map((row) => `<tr>${columns.map((column) => {
      const raw = typeof column.render === "function" ? column.render(row) : row?.[column.key];
      const value = raw === null || raw === undefined || raw === "" ? "-" : raw;
      return `<td>${escape(String(value))}</td>`;
    }).join("")}</tr>`).join("");
    return `
      <div class="construction-records-wrapper">
        <table class="construction-records-table construction-summary-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function renderConstructionDiagnostics(diagnostics) {
    if (constructionDiagnosticOverview) {
      const summary = diagnostics?.summary;
      const cards = summary
        ? [
          { label: "자동 매칭", value: summary.autoMatchedCount ?? 0 },
          { label: "프로젝트만", value: summary.projectOnlyCount ?? 0 },
          { label: "PDAM만", value: summary.pdamOnlyCount ?? 0 },
          { label: "프로젝트 중복", value: summary.projectDuplicateCount ?? 0 },
          { label: "PDAM 중복", value: summary.pdamDuplicateCount ?? 0 },
          { label: "숫자 오류", value: summary.parkingPileFormatIssueCount ?? 0 },
        ]
        : [];
      constructionDiagnosticOverview.innerHTML = cards.length
        ? cards.map((card) => `<article class="construction-summary-card construction-summary-card--diagnostic"><span>${escape(card.label)}</span><strong>${escape(String(card.value))}</strong></article>`).join("")
        : "";
    }

    if (constructionAutoMatchedTable) {
      constructionAutoMatchedTable.innerHTML = renderDiagnosticTable(
        [
          { label: "좌표 위치", key: "circleLocation" },
          { label: "PDAM 위치", key: "recordLocation" },
          { label: "원본 위치", key: "sourceLocation" },
          { label: "파일번호", render: (row) => formatDisplayedPileNumber(row?.pileNumber) },
          { label: "시공일", key: "constructionDate" },
          { label: "호기", key: "equipment" },
          { label: "공법", key: "constructionMethod" },
          { label: "추론 근거", key: "inferenceReason" },
        ],
        diagnostics?.autoMatched || [],
        "자동 추론 매칭이 없습니다.",
      );
    }

    if (constructionDiagnosticIssues) {
      const projectOnly = renderDiagnosticTable(
        [
          { label: "위치", key: "location" },
          { label: "파일번호", render: (row) => formatDisplayedPileNumber(row?.pileNumber) },
        ],
        diagnostics?.projectOnly || [],
        "프로젝트만 있는 좌표가 없습니다.",
      );
      const pdamOnly = renderDiagnosticTable(
        [
          { label: "위치", key: "location" },
          { label: "파일번호", render: (row) => row?.displayPileNumber || formatDisplayedPileNumber(row?.pileNumber) },
          { label: "시공일", key: "constructionDate" },
          { label: "호기", key: "equipment" },
        ],
        diagnostics?.pdamOnly || [],
        "PDAM만 있는 파일이 없습니다.",
      );
      const projectDuplicates = renderDiagnosticTable(
        [
          { label: "위치", key: "location" },
          { label: "파일번호", render: (row) => formatDisplayedPileNumber(row?.pileNumber) },
          { label: "원문 번호", render: (row) => (row?.rawPileNumbers || []).join(", ") },
          { label: "중복 수", key: "count" },
          { label: "좌표 ID", render: (row) => (row?.circleIds || []).join(", ") },
        ],
        diagnostics?.projectDuplicates || [],
        "프로젝트 중복이 없습니다.",
      );
      const pdamDuplicates = renderDiagnosticTable(
        [
          { label: "위치", render: (row) => row?.location || (row?.locations || []).join(", ") },
          { label: "파일번호", render: (row) => row?.displayPileNumber || formatDisplayedPileNumber(row?.pileNumber) },
          { label: "원문 번호", render: (row) => (row?.rawPileNumbers || []).join(", ") },
          { label: "중복 수", key: "count" },
          { label: "시공일", render: (row) => (row?.constructionDates || []).join(", ") },
        ],
        diagnostics?.pdamDuplicates || [],
        "PDAM 중복이 없습니다.",
      );
      const parkingPileFormatIssues = renderDiagnosticTable(
        [
          { label: "위치(원문)", key: "rawLocation" },
          {
            label: "파일번호",
            render: (row) => {
              const raw = row?.rawPileNumber ?? row?.pileNumber;
              const text = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
              return text || "-";
            },
          },
          { label: "시공일", key: "constructionDate" },
          { label: "호기", key: "equipment" },
          { label: "공법", key: "constructionMethod" },
          { label: "비고", key: "issueDetail" },
        ],
        diagnostics?.parkingPileFormatIssues || [],
        "해당 사항이 없습니다.",
      );
      constructionDiagnosticIssues.innerHTML = `
        <div class="construction-diagnostic-stack">
          <section class="construction-diagnostic-section construction-diagnostic-section--collapsible">
            <details class="construction-diagnostic-details">
              <summary class="construction-diagnostic-details-summary"><span class="construction-diagnostic-details-title">프로젝트만 남은 좌표</span></summary>
              <div class="construction-diagnostic-details-panel">${projectOnly}</div>
            </details>
          </section>
          <section class="construction-diagnostic-section"><h4>PDAM만 남은 파일</h4>${pdamOnly}</section>
          <section class="construction-diagnostic-section"><h4>프로젝트 중복</h4>${projectDuplicates}</section>
          <section class="construction-diagnostic-section"><h4>PDAM 중복</h4>${pdamDuplicates}</section>
          <section class="construction-diagnostic-section"><h4>숫자 오류</h4>${parkingPileFormatIssues}</section>
        </div>
      `;
    }
  }

  function normConstructionLoc(value) {
    return typeof normalizeConstructionLocationValue === "function"
      ? normalizeConstructionLocationValue(value)
      : String(value ?? "").trim() || "미지정";
  }

  /** backend construction_reports._saved_work_parking_unify_context 와 동일 */
  function getSingleParkingOutlineNorm() {
    const buildings = state.buildings || [];
    const parkingOnly = buildings.filter(
      (b) => String(b?.kind || "building").trim().toLowerCase() === "parking",
    );
    if (parkingOnly.length !== 1) return null;
    return normConstructionLoc(parkingOnly[0]?.name);
  }

  function pdamLocationTextMentionsParking(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return false;
    const compact = raw.replace(/[\s_\-()/]+/g, "");
    if (compact.includes("주차장")) return true;
    if (compact.includes("주차")) return true;
    if (compact.includes("지하")) return true;
    return false;
  }

  /** backend _location_kind_and_number 대응 (정규화된 위치 문자열 기준) */
  function locationKindAndNumber(value) {
    const location = normConstructionLoc(value);
    let m = /^B(\d+)$/.exec(location);
    if (m) return { kind: "basement", n: parseInt(m[1], 10) };
    if (location === "B") return { kind: "basement", n: null };
    m = /^(\d+)동$/.exec(location);
    if (m) return { kind: "dong", n: parseInt(m[1], 10) };
    if (location === "미지정") return { kind: "unspecified", n: null };
    return { kind: "other", n: null };
  }

  /**
   * backend _record_location_for_pdam_match 와 동일.
   * 단일 지하주차장 윤곽일 때 PDAM·도면 부위 키를 Bn으로 맞춘다 (기성정리 기초골조 기본값 연동용).
   */
  function recordLocationForPdamMatch(locationRaw, parkingUnified) {
    if (!parkingUnified) return normConstructionLoc(locationRaw);
    if (pdamLocationTextMentionsParking(locationRaw)) return parkingUnified;
    const norm = normConstructionLoc(locationRaw);
    if (normConstructionLoc(parkingUnified) === "주차장") {
      const { kind } = locationKindAndNumber(locationRaw);
      if (kind === "basement") return parkingUnified;
    }
    return norm;
  }

  function normLocationForBuildingSettingsLookup(raw) {
    return recordLocationForPdamMatch(raw, getSingleParkingOutlineNorm());
  }

  function buildAverageZByNormalizedLocation() {
    const sum = new Map();
    const count = new Map();
    (state.circles || []).forEach((c) => {
      const z = c.center_z;
      if (!Number.isFinite(Number(z))) return;
      const loc = normConstructionLoc(c.building_name);
      const n = Number(z);
      sum.set(loc, (sum.get(loc) || 0) + n);
      count.set(loc, (count.get(loc) || 0) + 1);
    });
    const avg = new Map();
    sum.forEach((s, loc) => {
      const cnt = count.get(loc) || 1;
      avg.set(loc, s / cnt);
    });
    const parkingUnified = getSingleParkingOutlineNorm();
    if (parkingUnified) {
      const a = avg.get("주차장");
      const b = avg.get(parkingUnified);
      if (Number.isFinite(a) && !Number.isFinite(b)) avg.set(parkingUnified, a);
      if (Number.isFinite(b) && !Number.isFinite(a)) avg.set("주차장", b);
    }
    return avg;
  }

  function findDrillingOverrideForNormLocation(normLoc) {
    for (const b of state.buildings || []) {
      if (!b?.name) continue;
      if (normConstructionLoc(b.name) === normLoc) {
        const v = toFiniteNumberOrNull(b.drilling_start_elevation);
        if (v != null) return v;
      }
    }
    return null;
  }

  function findFoundationTopOverrideForNormLocation(normLoc) {
    for (const b of state.buildings || []) {
      if (!b?.name) continue;
      if (normConstructionLoc(b.name) === normLoc) {
        const v = toFiniteNumberOrNull(b.foundation_top_elevation);
        if (v != null) return v;
      }
    }
    return null;
  }

  function resolveDrillingStartElevation(recordLocation, avgMap, parkingUnified) {
    const norm = recordLocationForPdamMatch(recordLocation, parkingUnified);
    const override = findDrillingOverrideForNormLocation(norm);
    if (override != null) {
      return { value: override, basis: "천공시작 입력고" };
    }
    const z = avgMap.get(norm);
    if (Number.isFinite(z)) {
      return { value: z, basis: "시작 지반고(좌표 평균 Z)" };
    }
    return { value: null, basis: null };
  }

  /** 이름 매칭 후, 백엔드와 동일하게 타워 > 일반동 > 지하주차장 순으로 윤곽 안을 본다. */
  function findBuildingOutlineContainingCircle(circle) {
    const normLoc = normConstructionLoc(circle?.building_name);
    let matched = (state.buildings || []).find((building) => normConstructionLoc(building?.name) === normLoc);
    if (!matched && circle && typeof pointInPolygon === "function") {
      const cx = Number(circle.center_x);
      const cy = Number(circle.center_y);
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        const pt = { x: cx, y: cy };
        const outlinePriority = (kindRaw) => {
          const k = String(kindRaw || "building").trim().toLowerCase();
          if (k === "tower_crane" || k === "tower-crane" || k === "tower") return 0;
          if (k === "parking") return 2;
          return 1;
        };
        const indexed = (state.buildings || []).map((b, i) => ({ b, i }));
        indexed.sort((a, b) => {
          const d = outlinePriority(a.b?.kind) - outlinePriority(b.b?.kind);
          return d !== 0 ? d : a.i - b.i;
        });
        for (const { b: building } of indexed) {
          const verts = building?.vertices;
          if (!Array.isArray(verts) || verts.length < 3) continue;
          const poly = verts.map((v) => ({ x: Number(v.x), y: Number(v.y) }));
          if (pointInPolygon(pt, poly)) {
            matched = building;
            break;
          }
        }
      }
    }
    return matched || null;
  }

  function getCircleAreaKind(circle) {
    const matched = findBuildingOutlineContainingCircle(circle);
    const rawKind = String(matched?.kind || "building").trim().toLowerCase();
    return rawKind === "parking" ? "parking" : "building";
  }

  /**
   * 기초골조 목록 묶음용: building_name만 쓰면 윤곽 안인데 미할당·불일치인 파일이 전부「미지정」으로 쌓인다.
   * 설정된 동·주차장 이름과 일치하면 그걸 쓰고, 아니면 윤곽(중심점)으로 구역을 정한다.
   */
  function resolveFoundationGroupLocationNorm(circle) {
    const nameNorm = normConstructionLoc(circle?.building_name);
    const explicitHit = nameNorm && nameNorm !== "미지정"
      ? (state.buildings || []).find((b) => normConstructionLoc(b?.name) === nameNorm)
      : null;
    if (explicitHit) {
      return nameNorm;
    }
    const outlineHit = findBuildingOutlineContainingCircle(circle);
    if (outlineHit?.name) {
      return normConstructionLoc(outlineHit.name);
    }
    return nameNorm;
  }

  function buildNormalizedPolylineVertices(polyline) {
    const points = Array.isArray(polyline?.points) ? polyline.points : [];
  let vertices = points
      .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
      .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
    if (vertices.length < 3) return [];
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
  const closeDistance = Math.hypot(first.x - last.x, first.y - last.y);
  if (closeDistance < 1e-6) {
      vertices.pop();
    }
  // 깨진 선분/미세 오차로 닫힘이 살짝 어긋난 경우를 복원
  if (vertices.length >= 4 && closeDistance >= 1e-6) {
    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    const span = Math.max(
      (Math.max(...xs) - Math.min(...xs)) || 0,
      (Math.max(...ys) - Math.min(...ys)) || 0,
      1,
    );
    const closureTol = span * 0.02;
    if (closeDistance <= closureTol) {
      vertices[vertices.length - 1] = { ...vertices[0] };
      vertices.pop();
    }
  }
  // 연속 공선 점은 제거해서 4선분 사각형 복원을 돕는다.
  if (vertices.length > 4) {
    const simplified = [];
    const isCollinear = (a, b, c) => {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;
      const cross = Math.abs(abx * bcy - aby * bcx);
      const scale = Math.max(1, Math.hypot(abx, aby) * Math.hypot(bcx, bcy));
      return cross / scale < 0.01;
    };
    vertices.forEach((point) => {
      simplified.push(point);
      while (simplified.length >= 3) {
        const n = simplified.length;
        if (isCollinear(simplified[n - 3], simplified[n - 2], simplified[n - 1])) {
          simplified.splice(n - 2, 1);
        } else {
          break;
        }
      }
    });
    vertices = simplified;
  }
  if (!isClosedRectangleVertices(vertices)) {
    const inferred = inferOpenRectangleVertices(vertices);
    if (inferred) return inferred;
  }
    return vertices;
  }

function isClosedRectangleVertices(vertices) {
  if (!Array.isArray(vertices) || vertices.length !== 4) return false;
  const edges = [];
  for (let i = 0; i < 4; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 4];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const length = Math.hypot(edge.x, edge.y);
    if (!Number.isFinite(length) || length < 1e-6) return false;
    edges.push({ ...edge, length });
  }
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const rightTol = 0.02;
  const cos01 = Math.abs(dot(edges[0], edges[1]) / (edges[0].length * edges[1].length));
  const cos12 = Math.abs(dot(edges[1], edges[2]) / (edges[1].length * edges[2].length));
  const cos23 = Math.abs(dot(edges[2], edges[3]) / (edges[2].length * edges[3].length));
  const cos30 = Math.abs(dot(edges[3], edges[0]) / (edges[3].length * edges[0].length));
  if (cos01 > rightTol || cos12 > rightTol || cos23 > rightTol || cos30 > rightTol) return false;
  const parallelTol = 0.02;
  const cos02 = Math.abs(dot(edges[0], edges[2]) / (edges[0].length * edges[2].length));
  const cos13 = Math.abs(dot(edges[1], edges[3]) / (edges[1].length * edges[3].length));
  if (Math.abs(1 - cos02) > parallelTol || Math.abs(1 - cos13) > parallelTol) return false;
  return true;
}

function inferOpenRectangleVertices(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const vecLen = (u) => Math.hypot(u.x, u.y);
  const pointToSegmentDistance = (px, py, ax, ay, bx, by) => {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq <= 1e-12) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const qx = ax + abx * t;
    const qy = ay + aby * t;
    return Math.hypot(px - qx, py - qy);
  };
  const distanceToPerimeter = (point, rectVertices) => {
    let minDist = Infinity;
    for (let i = 0; i < rectVertices.length; i += 1) {
      const a = rectVertices[i];
      const b = rectVertices[(i + 1) % rectVertices.length];
      const d = pointToSegmentDistance(point.x, point.y, a.x, a.y, b.x, b.y);
      if (d < minDist) minDist = d;
    }
    return minDist;
  };
  for (let i = 0; i <= vertices.length - 3; i += 1) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const c = vertices[i + 2];
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const lenBA = vecLen(ba);
    const lenBC = vecLen(bc);
    if (lenBA < 1e-6 || lenBC < 1e-6) continue;
    const rightCos = Math.abs(dot(ba, bc) / (lenBA * lenBC));
    if (rightCos > 0.08) continue;
    const d = { x: a.x + (c.x - b.x), y: a.y + (c.y - b.y) };
    const candidate = [a, b, c, d];
    if (!isClosedRectangleVertices(candidate)) continue;
    const scale = Math.max(lenBA, lenBC, 1);
    const perimeterTol = scale * 0.12;
    const allNearPerimeter = vertices.every((point) => distanceToPerimeter(point, candidate) <= perimeterTol);
    if (!allNearPerimeter) continue;
    return candidate;
  }
  return null;
}

  function polygonArea(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < vertices.length; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  /** 기초/P/F용 닫힌 외곽 — 직사각형만이 아니라 삼각형·다각형도 허용(면적>0) */
  function isFoundationOutlineVerticesUsable(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return false;
    const area = polygonArea(vertices);
    return Number.isFinite(area) && area > 1e-10;
  }

  function getSelectablePolylines() {
    // 사용자가 말한 "배경 점선 폴리라인" = drawPolylineHints()의 rawPolylines
    const source = Array.isArray(state.rawPolylines) ? state.rawPolylines : [];
    const fallback = Array.isArray(state.clusterPolylines) ? state.clusterPolylines : [];
    const effectiveSource = source.length ? source : fallback;
    const cacheKey = `${source.length}|${fallback.length}|${effectiveSource.length}|${(state.circles || []).length}`;
    if (constructionState.foundationSelectablePolylineCacheKey === cacheKey) {
      return constructionState.foundationSelectablePolylineCache;
    }
    const usable = [];
    effectiveSource.forEach((polyline, index) => {
      const vertices = buildNormalizedPolylineVertices(polyline);
      if (!isFoundationOutlineVerticesUsable(vertices)) return;
      const area = polygonArea(vertices);
      if (!Number.isFinite(area) || area <= 0) return;
      const id = String(polyline?.id || polyline?.cluster_id || `polyline-${index + 1}`);
      usable.push({
        id,
        label: `${id} (${vertices.length}점)`,
        vertices,
      });
    });
    constructionState.foundationSelectablePolylineCacheKey = cacheKey;
    constructionState.foundationSelectablePolylineCache = usable;
    return usable;
  }

  function pointInVertices(circle, vertices) {
    if (!circle || !Array.isArray(vertices) || vertices.length < 3) return false;
    const cx = Number(circle.center_x);
    const cy = Number(circle.center_y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
    if (!pointInPolygon({ x: cx, y: cy }, vertices)) return false;
    const rawRadius = Number.isFinite(Number(circle.radius))
      ? Number(circle.radius)
      : (Number.isFinite(Number(circle.diameter)) ? Number(circle.diameter) / 2 : 0);
    const radius = Math.max(0, rawRadius || 0);
    if (radius <= 0) return true;
    const pointToSegmentDistance = (px, py, ax, ay, bx, by) => {
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const abLenSq = abx * abx + aby * aby;
      if (abLenSq <= 1e-12) return Math.hypot(px - ax, py - ay);
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
      const qx = ax + abx * t;
      const qy = ay + aby * t;
      return Math.hypot(px - qx, py - qy);
    };
    let minEdgeDistance = Infinity;
    for (let i = 0; i < vertices.length; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      const dist = pointToSegmentDistance(cx, cy, Number(a.x), Number(a.y), Number(b.x), Number(b.y));
      if (dist < minEdgeDistance) minEdgeDistance = dist;
    }
  // CAD 오차/깨진 경계 보정을 위해 반지름 95%까지는 내부로 허용
  return minEdgeDistance + 1e-6 >= radius * 0.95;
  }

  function getBasementCountBucket(count) {
    if ([2, 3, 4, 5].includes(count)) return String(count);
    return "other";
  }

  function getFoundationGroupItems() {
    const buildingKindSig = (state.buildings || [])
      .map((b) => `${String(b?.kind || "").trim()}:${normConstructionLoc(b?.name)}`)
      .sort()
      .join(";");
    const cacheKey = `${(state.circles || []).length}|${(state.buildings || []).length}|${buildingKindSig}|${(state.rawPolylines || []).length}|${(state.clusterPolylines || []).length}|${Number(constructionState.foundationAreaMinValue ?? -1)}|${Number(constructionState.foundationAreaMaxValue ?? -1)}`;
    if (constructionState.foundationGroupItemsCacheKey === cacheKey) {
      return constructionState.foundationGroupItemsCache;
    }
    const targetKinds = new Set(["building", "parking"]);
    const circles = (state.circles || []).filter((circle) => (
      targetKinds.has(getCircleAreaKind(circle)) && isNumberMatchedCircle(circle)
    ));
    // 클릭 선택 경로와 동일한 폴리라인 집합을 사용해 필터 결과 불일치를 줄인다.
    const polylines = getBackgroundPolylinesForClick();
    const byNormName = new Map();
    const displayNameByNorm = new Map();
    const kindByNorm = new Map();

    (state.buildings || []).forEach((building) => {
      const norm = normConstructionLoc(building?.name);
      if (!norm || norm === "미지정") return;
      const kind = String(building?.kind || "building").trim().toLowerCase() === "parking" ? "parking" : "building";
      if (!targetKinds.has(kind)) return;
      byNormName.set(norm, []);
      displayNameByNorm.set(norm, String(building?.name || "").trim() || "미지정");
      kindByNorm.set(norm, kind);
    });
    circles.forEach((circle) => {
      const norm = resolveFoundationGroupLocationNorm(circle);
      const kind = getCircleAreaKind(circle);
      if (!targetKinds.has(kind)) return;
      if (!byNormName.has(norm)) {
        byNormName.set(norm, []);
        const labelFromOutline = (state.buildings || []).find((b) => normConstructionLoc(b?.name) === norm);
        displayNameByNorm.set(
          norm,
          (labelFromOutline?.name && String(labelFromOutline.name).trim())
            || String(circle?.building_name || "").trim()
            || "미지정",
        );
        kindByNorm.set(norm, kind);
      }
      byNormName.get(norm).push(circle);
    });

    const groups = [];
    byNormName.forEach((groupCircles, normName) => {
      const kind = kindByNorm.get(normName) || "building";
      const polylineScores = polylines.map((polyline) => ({
        polyline,
        inside: groupCircles.filter((circle) => pointInVertices(circle, polyline.vertices)),
        area: polygonArea(polyline.vertices),
      })).filter((entry) => entry.inside.length > 0)
        .sort((a, b) => b.inside.length - a.inside.length);
      const band = getCurrentAreaRange(polylineScores);
      const balanced = polylineScores.filter((entry) => entry.area >= band.min && entry.area <= band.max);
      const ranked = balanced.sort((a, b) => {
        const scoreA = Math.abs(Math.log((a.area || 1) / (band.mode || a.area || 1)));
        const scoreB = Math.abs(Math.log((b.area || 1) / (band.mode || b.area || 1)));
        if (Math.abs(scoreA - scoreB) > 1e-6) return scoreA - scoreB;
        if (b.inside.length !== a.inside.length) return b.inside.length - a.inside.length;
        return String(a.polyline.id).localeCompare(String(b.polyline.id));
      });
      // 유사 폴리라인이 많은 현장에서 상위 일부만 쓰면 내부/외부 필터 누락이 생길 수 있어
      // 현재 면적 밴드 기준의 전체 후보를 반영한다.
      const selectedPolylineEntries = ranked;
      const insideIds = new Set();
      selectedPolylineEntries.forEach((entry) => entry.inside.forEach((circle) => insideIds.add(circle.id)));
      const circleIds = groupCircles.map((circle) => circle.id);
      const outsideIds = circleIds.filter((id) => !insideIds.has(id));
      const groupKey = `${kind}:${normName}`;
      groups.push({
        key: groupKey,
        normName,
        displayName: displayNameByNorm.get(normName) || normName || "미지정",
        kind,
        kindLabel: kind === "parking" ? "지하주차장" : "동",
        circleIds,
        insideIds: Array.from(insideIds),
        outsideIds,
        polylineIds: selectedPolylineEntries.map((entry) => entry.polyline.id),
      });
    });
    const sorted = groups.sort((a, b) => (
      a.kindLabel.localeCompare(b.kindLabel)
      || a.displayName.localeCompare(b.displayName)
    ));
    constructionState.foundationGroupItemsCacheKey = cacheKey;
    constructionState.foundationGroupItemsCache = sorted;
    return sorted;
  }

  function getFilteredFoundationCircles() {
    const groups = getFoundationGroupItems();
    const subgroupKeys = constructionState.foundationSelectedSubgroupKeys || new Set();
    const suppressedCircleIds = constructionState.foundationSuppressedCircleIds || new Set();
    const suppressedPolylineIds = constructionState.foundationSuppressedPolylineIds || new Set();
    const ids = new Set();
    const polylineIds = new Set();
    groups.forEach((group) => {
      const insideKey = `${group.key}:inside`;
      const outsideKey = `${group.key}:outside`;
      const specifiedKey = `${group.key}:specified`;
      const unspecifiedKey = `${group.key}:unspecified`;
      if (group.kind === "parking") {
        const bucket = getBasementCountBucket(group.insideIds.length);
        const filter = constructionState.foundationParkingCountFilter || "all";
        if (filter !== "all" && bucket !== filter) return;
      }
      if (subgroupKeys.has(insideKey)) {
        group.insideIds.forEach((id) => ids.add(id));
        group.polylineIds.forEach((id) => polylineIds.add(id));
      }
      if (subgroupKeys.has(outsideKey)) {
        group.outsideIds.forEach((id) => ids.add(id));
        // 외부 선택은 파일 선택 범위만 의미하고, 폴리라인 강조 대상은 아니다.
      }
      if (subgroupKeys.has(specifiedKey)) {
        group.circleIds.forEach((id) => {
          if (Number.isFinite(getFoundationThicknessMm(id))) ids.add(id);
        });
      }
      if (subgroupKeys.has(unspecifiedKey)) {
        group.circleIds.forEach((id) => {
          if (!Number.isFinite(getFoundationThicknessMm(id))) ids.add(id);
        });
      }
    });
    if (subgroupKeys.size) {
      suppressedCircleIds.forEach((id) => ids.delete(id));
      suppressedPolylineIds.forEach((id) => polylineIds.delete(id));
    } else {
      // 필터 비활성 상태에서는 수동 제외 오버라이드를 유지할 필요가 없다.
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
    }
    // 필터 폴리라인 집합은 별도 보관하고, 실제 "강조"는 수동 클릭 선택 집합을 유지한다.
    constructionState.foundationFilteredPolylineIds = polylineIds;
    const filteredCircles = (state.circles || []).filter((circle) => (
      ids.has(circle.id) && isNumberMatchedCircle(circle)
    ));
    const matchedCount = filteredCircles.filter((circle) => isNumberMatchedCircle(circle)).length;
    const unmatchedCount = filteredCircles.length - matchedCount;
    const strictMatchedCount = filteredCircles.filter((circle) => isStrictNumberMatchedCircle(circle)).length;
    const strictUnmatched = filteredCircles.filter((circle) => !isStrictNumberMatchedCircle(circle));
    // #region agent log
    fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM3',location:'construction.js:getFilteredFoundationCircles',message:'filter result circles match status',data:{subgroupCount:subgroupKeys.size,filteredCount:filteredCircles.length,matchedCount,unmatchedCount,strictMatchedCount,strictUnmatchedCount:strictUnmatched.length,sampleUnmatched:filteredCircles.filter((circle)=>!isNumberMatchedCircle(circle)).slice(0,10).map((circle)=>String(circle.id||'')),sampleStrictUnmatched:strictUnmatched.slice(0,10).map((circle)=>({id:String(circle?.id||''),has_error:Boolean(circle?.has_error),matched_text_id:String(circle?.matched_text_id??circle?.matched_text?.id??''),matched_text:String(circle?.matched_text?.text??'')}))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return filteredCircles;
  }

  function getFoundationThicknessMm(circleId) {
    return numericFromPerPileMapWithTwins(constructionState.foundationThicknessByPileId, circleId);
  }

  /** 구역(정규화 위치명)별로 이미 지정된 두께 중 건수가 가장 많은 mm (기초골조 탭 불러오기용). */
  function getDominantThicknessMmForNorm(normName) {
    const groups = getFoundationGroupItems();
    const g = groups.find((x) => x.normName === normName);
    if (!g || !Array.isArray(g.circleIds) || !g.circleIds.length) return null;
    const counts = new Map();
    g.circleIds.forEach((id) => {
      const mm = getFoundationThicknessMm(id);
      if (!Number.isFinite(mm)) return;
      const r = Math.round(mm);
      counts.set(r, (counts.get(r) || 0) + 1);
    });
    if (!counts.size) return null;
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  }

  function getFoundationPitOffsetM(circleId) {
    return numericFromPerPileMapWithTwins(constructionState.foundationPitOffsetByPileId, circleId);
  }

  /** circleMap 키가 숫자/문자 혼용일 때 조회 실패 방지 */
  function getCircleFromMapById(circleId) {
    const m = state.circleMap;
    if (!m || circleId == null) return null;
    if (m.has(circleId)) return m.get(circleId);
    const s = String(circleId);
    if (m.has(s)) return m.get(s);
    const n = Number(s);
    if (Number.isFinite(n) && m.has(n)) return m.get(n);
    return null;
  }

  /**
   * 동·주차장 천공/기초상 기본값 조회용 정규 위치.
   * building_name 만 쓰면 윤곽 안인데 이름이 안 맞는 말뚝은 주차장 설정을 못 읽는다.
   * 기초 목록·기성표와 동일하게 resolveFoundationGroupLocationNorm(윤곽 포함) 후 단일주차장 PDAM 통합을 적용한다.
   */
  function normForBuildingSettingsFromCircle(circle) {
    if (!circle) return null;
    const locNorm = resolveFoundationGroupLocationNorm(circle);
    return normLocationForBuildingSettingsLookup(locNorm);
  }

  /** 말뚝별 값이 있으면 우선, 없으면 동·주차장 설정(윤곽) 값. */
  function getDrillingElevationMForCircle(circleId) {
    const direct = numericFromPerPileMapWithTwins(constructionState.drillingStartByPileId, circleId);
    if (direct != null) return direct;
    const circle = getCircleFromMapById(circleId);
    const norm = normForBuildingSettingsFromCircle(circle);
    return norm == null ? null : findDrillingOverrideForNormLocation(norm);
  }

  function getFoundationTopElevationMForCircle(circleId) {
    const direct = numericFromPerPileMapWithTwins(constructionState.foundationTopByPileId, circleId);
    if (direct != null) return direct;
    const circle = getCircleFromMapById(circleId);
    const norm = normForBuildingSettingsFromCircle(circle);
    return norm == null ? null : findFoundationTopOverrideForNormLocation(norm);
  }

  function getFoundationThicknessColor(mm) {
    if (!Number.isFinite(mm)) return "#94a3b8";
    if (mm < 500) return "#0ea5e9";
    if (mm < 800) return "#22c55e";
    if (mm < 1200) return "#f59e0b";
    return "#ef4444";
  }

  function isFoundationHatchLayerEnabled() {
    return Boolean(
      constructionState.foundationHatchShowThickness
      || constructionState.foundationHatchShowDrill
      || constructionState.foundationHatchShowFoundationTop,
    );
  }

  function roundFoundationMetricValue(metricKey, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (metricKey === "thickness") return Math.round(numeric);
    return Math.round(numeric * 1000) / 1000;
  }

  function getFoundationMetricValueForCircle(metricKey, circleId) {
    if (metricKey === "thickness") return roundFoundationMetricValue(metricKey, getFoundationThicknessMm(circleId));
    if (metricKey === "drill") return roundFoundationMetricValue(metricKey, getDrillingElevationMForCircle(circleId));
    if (metricKey === "top") return roundFoundationMetricValue(metricKey, getFoundationTopElevationMForCircle(circleId));
    return null;
  }

  function getFoundationMetricValueKey(metricKey, value) {
    if (!Number.isFinite(Number(value))) return "";
    if (metricKey === "thickness") return String(Math.round(Number(value)));
    return Number(value).toFixed(3).replace(/\.?0+$/, "");
  }

  function hashFoundationValueKey(valueKey) {
    let hash = 0;
    for (let i = 0; i < valueKey.length; i += 1) {
      hash = (hash * 31 + valueKey.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function getFoundationHatchColor(metricKey, valueKey) {
    const palettes = {
      thickness: ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#ec4899"],
      drill: ["#0284c7", "#0d9488", "#7c3aed", "#ea580c", "#16a34a", "#db2777", "#2563eb", "#f59e0b"],
      top: ["#15803d", "#1d4ed8", "#0f766e", "#be123c", "#6d28d9", "#c2410c", "#0ea5e9", "#65a30d"],
    };
    const palette = palettes[metricKey] || palettes.thickness;
    const idx = hashFoundationValueKey(`${metricKey}:${valueKey}`) % palette.length;
    return palette[idx];
  }

  function drawHatchPolygonsByColor(polygonsByColor, fillAlpha) {
    polygonsByColor.forEach((verticesList, color) => {
      if (!Array.isArray(verticesList) || !verticesList.length) return;
      ctx.save();
      ctx.beginPath();
      verticesList.forEach((vertices) => {
        if (!Array.isArray(vertices) || vertices.length < 3) return;
        vertices.forEach((vertex, index) => {
          const p = worldToCanvas(vertex.x, vertex.y);
          if (index === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
      });
      ctx.fillStyle = hexToRgba(color, fillAlpha);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHatchCirclesByColor(circlesByColor, fillAlpha) {
    circlesByColor.forEach((circleList, color) => {
      if (!Array.isArray(circleList) || !circleList.length) return;
      ctx.save();
      ctx.beginPath();
      circleList.forEach((circle) => {
        const cx = Number(circle?.center_x);
        const cy = Number(circle?.center_y);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        const rawRadius = Number.isFinite(Number(circle?.radius))
          ? Number(circle.radius)
          : (Number.isFinite(Number(circle?.diameter)) ? Number(circle.diameter) / 2 : 0);
        const hatchRadius = Math.max(0.5, rawRadius * 2.5);
        const center = worldToCanvas(cx, cy);
        ctx.moveTo(center.x + hatchRadius * view.scale, center.y);
        ctx.arc(center.x, center.y, hatchRadius * view.scale, 0, Math.PI * 2);
      });
      ctx.fillStyle = hexToRgba(color, fillAlpha);
      ctx.fill();
      ctx.restore();
    });
  }

  function getFoundationHatchInsideRows() {
    const polylines = getBackgroundPolylinesForClick();
    const circlesRef = Array.isArray(state.circles) ? state.circles : [];
    if (!polylines.length || !circlesRef.length) return [];
    const key = `${constructionState.foundationBackgroundPolylineCacheKey}|${polylines.length}|${circlesRef.length}`;
    if (
      constructionState.foundationHatchInsideCacheKey === key
      && constructionState.foundationHatchInsideCirclesRef === circlesRef
      && Array.isArray(constructionState.foundationHatchInsideRows)
    ) {
      return constructionState.foundationHatchInsideRows;
    }
    const rows = [];
    const signatureSeen = new Set();
    polylines.forEach((polyline) => {
      const insideIds = getEffectiveCircleIdsForPolylineToggle(polyline)
        .map((id) => String(id))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "en"));
      if (!insideIds.length) return;
      const signature = insideIds.join("|");
      if (!signature || signatureSeen.has(signature)) return;
      signatureSeen.add(signature);
      rows.push({
        polylineId: polyline.id,
        insideIds,
      });
    });
    constructionState.foundationHatchInsideCacheKey = key;
    constructionState.foundationHatchInsideCirclesRef = circlesRef;
    constructionState.foundationHatchInsideRows = rows;
    return rows;
  }

  function drawFoundationMetricHatchLayer(metricKey) {
    const lookup = getFoundationPolylineIdLookup();
    const hatchRows = getFoundationHatchInsideRows();
    if (!hatchRows.length && !(state.circles || []).length) return;
    const polygonFillByColor = new Map();
    const circleFillByColor = new Map();
    const circlesAlreadyPainted = new Set();
    hatchRows.forEach((row) => {
      const insideRows = row.insideIds
        .map((circleId) => getCircleFromMapById(circleId))
        .filter((circle) => circle && isNumberMatchedCircle(circle));
      if (!insideRows.length) return;
      const valueKeys = [];
      insideRows.forEach((circle) => {
        const value = getFoundationMetricValueForCircle(metricKey, circle.id);
        const valueKey = getFoundationMetricValueKey(metricKey, value);
        if (valueKey) valueKeys.push(valueKey);
      });
      const hasAllFinite = valueKeys.length === insideRows.length;
      const uniqueValueKeys = new Set(valueKeys);
      const polylineRow = lookup.get(row.polylineId);
      if (hasAllFinite && uniqueValueKeys.size === 1 && polylineRow?.vertices?.length >= 3) {
        const valueKey = valueKeys[0];
        const color = getFoundationHatchColor(metricKey, valueKey);
        if (!polygonFillByColor.has(color)) polygonFillByColor.set(color, []);
        polygonFillByColor.get(color).push(polylineRow.vertices);
        insideRows.forEach((circle) => circlesAlreadyPainted.add(String(circle.id)));
        return;
      }
      insideRows.forEach((circle) => {
        const idKey = String(circle.id);
        if (!idKey || circlesAlreadyPainted.has(idKey)) return;
        const value = getFoundationMetricValueForCircle(metricKey, circle.id);
        const valueKey = getFoundationMetricValueKey(metricKey, value);
        if (!valueKey) return;
        const color = getFoundationHatchColor(metricKey, valueKey);
        if (!circleFillByColor.has(color)) circleFillByColor.set(color, []);
        circleFillByColor.get(color).push(circle);
        circlesAlreadyPainted.add(idKey);
      });
    });
    (state.circles || []).forEach((circle) => {
      const idKey = String(circle?.id ?? "");
      if (!idKey || circlesAlreadyPainted.has(idKey)) return;
      if (!isNumberMatchedCircle(circle)) return;
      const value = getFoundationMetricValueForCircle(metricKey, circle.id);
      const valueKey = getFoundationMetricValueKey(metricKey, value);
      if (!valueKey) return;
      const color = getFoundationHatchColor(metricKey, valueKey);
      if (!circleFillByColor.has(color)) circleFillByColor.set(color, []);
      circleFillByColor.get(color).push(circle);
      circlesAlreadyPainted.add(idKey);
    });
    const layerAlpha = metricKey === "thickness" ? 0.24 : 0.2;
    drawHatchPolygonsByColor(polygonFillByColor, layerAlpha);
    drawHatchCirclesByColor(circleFillByColor, layerAlpha);
  }

  function drawFoundationAreaHatches() {
    if (!isFoundationHatchLayerEnabled()) return;
    const metrics = [];
    if (constructionState.foundationHatchShowThickness) metrics.push("thickness");
    if (constructionState.foundationHatchShowDrill) metrics.push("drill");
    if (constructionState.foundationHatchShowFoundationTop) metrics.push("top");
    if (!metrics.length) return;
    metrics.forEach((metricKey) => drawFoundationMetricHatchLayer(metricKey));
  }

  function applyFoundationThicknessToCircles(circleIds, mmValue) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    if (!ids.length) return;
    if (!Number.isFinite(mmValue) || mmValue < 0) return;
    ids.forEach((circleId) => {
      constructionState.foundationThicknessByPileId[circleId] = Math.round(mmValue);
    });
    state.foundationThicknessByPileId = { ...constructionState.foundationThicknessByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function clearFoundationThicknessForCircles(circleIds) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    ids.forEach((circleId) => {
      delete constructionState.foundationThicknessByPileId[circleId];
    });
    state.foundationThicknessByPileId = { ...constructionState.foundationThicknessByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function applyFoundationPitOffsetToCircles(circleIds, offsetM) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    if (!ids.length) return;
    if (!Number.isFinite(offsetM) || offsetM < 0) return;
    ids.forEach((circleId) => {
      if (offsetM <= 0) {
        delete constructionState.foundationPitOffsetByPileId[circleId];
      } else {
        constructionState.foundationPitOffsetByPileId[circleId] = Number(offsetM);
      }
    });
    state.foundationPitOffsetByPileId = { ...constructionState.foundationPitOffsetByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function clearFoundationPitOffsetForCircles(circleIds) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    ids.forEach((circleId) => {
      delete constructionState.foundationPitOffsetByPileId[circleId];
    });
    state.foundationPitOffsetByPileId = { ...constructionState.foundationPitOffsetByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function applyDrillingStartToCircles(circleIds, mValue) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    if (!ids.length) return;
    if (!Number.isFinite(mValue)) return;
    ids.forEach((circleId) => {
      constructionState.drillingStartByPileId[circleId] = Number(mValue);
    });
    state.drillingStartByPileId = { ...constructionState.drillingStartByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function clearDrillingStartForCircles(circleIds) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    ids.forEach((circleId) => {
      delete constructionState.drillingStartByPileId[circleId];
    });
    state.drillingStartByPileId = { ...constructionState.drillingStartByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function applyFoundationTopElevationToCircles(circleIds, mValue) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    if (!ids.length) return;
    if (!Number.isFinite(mValue)) return;
    ids.forEach((circleId) => {
      constructionState.foundationTopByPileId[circleId] = Number(mValue);
    });
    state.foundationTopByPileId = { ...constructionState.foundationTopByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function clearFoundationTopElevationForCircles(circleIds) {
    const ids = expandFoundationCircleIdsWithTwins(circleIds);
    ids.forEach((circleId) => {
      delete constructionState.foundationTopByPileId[circleId];
    });
    state.foundationTopByPileId = { ...constructionState.foundationTopByPileId };
    rerenderSettlementTableFromState();
    requestRedraw();
  }

  function persistFoundationSettings(statusMessage) {
    if (typeof syncCurrentWorkToServer !== "function") return;
    syncCurrentWorkToServer(statusMessage)
      .then((ok) => {
        if (!ok) {
          setSyncStatus("프로젝트/작업 컨텍스트가 없어 설정을 서버에 저장하지 못했습니다.", true);
        }
      })
      .catch((error) => {
        setSyncStatus(errorMessage(error), true);
      });
  }

  function updateFoundationPreviewSelection() {
    const ids = constructionState.foundationExcludeWithThickness
      ? getFoundationListSelectableCircleIds()
      : getFilteredFoundationCircles().map((circle) => circle.id);
    constructionState.foundationPreviewCircleIds = new Set(ids);
    if (constructionState.foundationExcludeWithThickness) {
      const excluded = ids.filter((id) => Number.isFinite(getFoundationThicknessMm(id)));
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT6',location:'construction.js:updateFoundationPreviewSelection',message:'preview still includes thickness-valued circles',data:{excludeWithThickness:Boolean(constructionState.foundationExcludeWithThickness),previewCount:ids.length,previewExcludedCount:excluded.length,samplePreviewExcluded:excluded.slice(0,10)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  }

  function getFoundationListSelectableCircleIds() {
    const circles = getFilteredFoundationCircles();
    if (!constructionState.foundationExcludeWithThickness) {
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT2',location:'construction.js:getFoundationListSelectableCircleIds:noExclude',message:'exclude toggle off; all filtered circles selectable',data:{excludeWithThickness:Boolean(constructionState.foundationExcludeWithThickness),filteredCount:circles.length,thicknessMappedCount:circles.filter((c)=>Number.isFinite(getFoundationThicknessMm(c.id))).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return circles.map((circle) => circle.id);
    }
    const selectable = circles
      .filter((circle) => !Number.isFinite(getFoundationThicknessMm(circle.id)))
      .map((circle) => circle.id);
    // #region agent log
    fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT1',location:'construction.js:getFoundationListSelectableCircleIds:excludeOn',message:'exclude toggle on; thickness-valued circles removed',data:{excludeWithThickness:Boolean(constructionState.foundationExcludeWithThickness),filteredCount:circles.length,selectableCount:selectable.length,excludedCount:circles.length-selectable.length,sampleExcluded:circles.filter((c)=>Number.isFinite(getFoundationThicknessMm(c.id))).slice(0,8).map((c)=>String(c.id||''))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return selectable;
  }

  function renderFoundationSelectionSummary() {
    if (!constructionFoundationSummary) return;
    const allFiltered = getFilteredFoundationCircles();
    const thicknessSpecified = allFiltered.filter((c) => Number.isFinite(getFoundationThicknessMm(c.id))).length;
    const thicknessUnset = allFiltered.length - thicknessSpecified;
    const filteredCount = constructionState.foundationExcludeWithThickness ? thicknessUnset : allFiltered.length;
    const selected = constructionState.foundationSelectedCircleIds ? constructionState.foundationSelectedCircleIds.size : 0;
    const subgroupCount = constructionState.foundationSelectedSubgroupKeys ? constructionState.foundationSelectedSubgroupKeys.size : 0;
    const polylineCount = constructionState.foundationSelectedPolylineIds ? constructionState.foundationSelectedPolylineIds.size : 0;
    constructionFoundationSummary.textContent = `선택 항목 ${subgroupCount}개 · 폴리라인 ${polylineCount}개 · 선택 대상 ${filteredCount}개 · 현재 선택 파일 ${selected}개 · 두께 지정 ${thicknessSpecified} · 미지정 ${thicknessUnset}`;
  }

  function renderFoundationPolylineList() {
    if (!constructionFoundationPolylineList) return;
    const groups = getFoundationGroupItems();
    if (!groups.length) {
      constructionFoundationPolylineList.innerHTML = '<div class="empty-row">동/지하주차장 분류 항목이 없습니다.</div>';
      return;
    }
    const byKind = {
      building: groups.filter((group) => group.kind === "building"),
      parking: groups.filter((group) => group.kind === "parking"),
    };
    const renderKindRows = (kindRows, kindClass) => kindRows.map((group) => {
      const insideKey = `${group.key}:inside`;
      const outsideKey = `${group.key}:outside`;
      const specifiedKey = `${group.key}:specified`;
      const unspecifiedKey = `${group.key}:unspecified`;
      const insideChecked = constructionState.foundationSelectedSubgroupKeys?.has(insideKey);
      const outsideChecked = constructionState.foundationSelectedSubgroupKeys?.has(outsideKey);
      const specifiedChecked = constructionState.foundationSelectedSubgroupKeys?.has(specifiedKey);
      const unspecifiedChecked = constructionState.foundationSelectedSubgroupKeys?.has(unspecifiedKey);
      const ids = group.circleIds || [];
      let thicknessSpecified = 0;
      ids.forEach((id) => {
        if (Number.isFinite(getFoundationThicknessMm(id))) thicknessSpecified += 1;
      });
      const thicknessUnset = ids.length - thicknessSpecified;
      return `<label class="construction-foundation-list-item ${kindClass}">
        <div class="construction-foundation-group-header">
          <span class="construction-foundation-group-name">${escape(group.displayName)}</span>
          <span class="construction-foundation-group-thickness-stats">지정 ${thicknessSpecified} · 미지정 ${thicknessUnset}</span>
        </div>
        <div class="construction-foundation-subgroup-row">
          <button type="button" class="ghost foundation-scope-btn foundation-scope-btn--inside${insideChecked ? " is-active" : ""}" data-foundation-subgroup-key="${escape(insideKey)}" title="내부 선택">
            <span>내부 ${group.insideIds.length}</span>
          </button>
          <button type="button" class="ghost foundation-scope-btn foundation-scope-btn--outside${outsideChecked ? " is-active" : ""}" data-foundation-subgroup-key="${escape(outsideKey)}" title="외부 선택">
            <span>외부 ${group.outsideIds.length}</span>
          </button>
          <button type="button" class="ghost foundation-scope-btn foundation-scope-btn--specified${specifiedChecked ? " is-active" : ""}" data-foundation-subgroup-key="${escape(specifiedKey)}" title="두께 지정 말뚝만 선택">
            <span>지정 ${thicknessSpecified}</span>
          </button>
          <button type="button" class="ghost foundation-scope-btn foundation-scope-btn--unspecified${unspecifiedChecked ? " is-active" : ""}" data-foundation-subgroup-key="${escape(unspecifiedKey)}" title="두께 미지정 말뚝만 선택">
            <span>미지정 ${thicknessUnset}</span>
          </button>
        </div>
      </label>`;
    }).join("");
    constructionFoundationPolylineList.innerHTML = `
      <div class="construction-foundation-legend">
        <span class="foundation-kind-chip foundation-kind-chip--building">동</span>
        <span class="foundation-kind-chip foundation-kind-chip--parking">지하주차장</span>
        <span class="foundation-scope-chip foundation-scope-chip--inside">내부</span>
        <span class="foundation-scope-chip foundation-scope-chip--outside">외부</span>
      </div>
      <section class="foundation-kind-section">
        <h4 class="foundation-kind-title foundation-kind-title--building">동</h4>
        <div class="foundation-kind-grid">${renderKindRows(byKind.building, "foundation-kind-item--building") || '<div class="empty-row">항목 없음</div>'}</div>
      </section>
      <section class="foundation-kind-section">
        <h4 class="foundation-kind-title foundation-kind-title--parking">지하주차장</h4>
        <div class="foundation-kind-grid">${renderKindRows(byKind.parking, "foundation-kind-item--parking") || '<div class="empty-row">항목 없음</div>'}</div>
      </section>
    `;
  }

  function renderFoundationParkingCountFilters() {
    if (!constructionFoundationParkingCountFilters) return;
    const groups = getFoundationGroupItems();
    if (!groups.length) {
      constructionFoundationParkingCountFilters.innerHTML = "";
      return;
    }
    constructionFoundationParkingCountFilters.innerHTML = [
      '<button type="button" class="ghost" data-foundation-bulk-scope="inside">폴리라인 내부 전체선택</button>',
      '<button type="button" class="ghost" data-foundation-bulk-scope="outside">폴리라인 외부 전체선택</button>',
    ].join("");
  }

  function renderFoundationPileList() {
    if (!constructionFoundationPileList) return;
    const selectedIds = Array.from(constructionState.foundationSelectedCircleIds || []);
    if (!selectedIds.length) {
      constructionFoundationPileList.innerHTML = '<div class="empty-row">캐드 뷰어에서 객체를 선택하면 요약이 표시됩니다.</div>';
      return;
    }
    const rowsByGroup = new Map();
    selectedIds.forEach((id) => {
      const circle = state.circleMap?.get(id);
      if (!circle) return;
      const kind = getCircleAreaKind(circle);
      const normName = resolveFoundationGroupLocationNorm(circle);
      const labelFromOutline = (state.buildings || []).find((b) => normConstructionLoc(b?.name) === normName);
      const displayName = (labelFromOutline?.name && String(labelFromOutline.name).trim())
        || String(circle?.building_name || "").trim()
        || "미지정";
      const rowKey = `${kind}:${normName}`;
      if (!rowsByGroup.has(rowKey)) {
        rowsByGroup.set(rowKey, {
          key: rowKey,
          kind,
          label: displayName,
          count: 0,
          thicknessValues: new Set(),
        });
      }
      const row = rowsByGroup.get(rowKey);
      row.count += 1;
      const mm = getFoundationThicknessMm(id);
      if (Number.isFinite(mm)) row.thicknessValues.add(Math.round(mm));
    });

    const summaryRows = Array.from(rowsByGroup.values())
      .map((row) => {
        let valueLabel = "미입력";
        if (row.thicknessValues.size === 1) {
          valueLabel = `${Array.from(row.thicknessValues)[0]} mm`;
        } else if (row.thicknessValues.size > 1) {
          valueLabel = `혼합 (${row.thicknessValues.size}종)`;
        }
        return {
          kind: row.kind,
          label: row.label,
          count: row.count,
          valueLabel,
        };
      })
      .sort((a, b) => (
        (a.kind || "").localeCompare(b.kind || "")
        || (a.label || "").localeCompare(b.label || "")
      ));

    if (!summaryRows.length) {
      constructionFoundationPileList.innerHTML = '<div class="empty-row">현재 선택된 객체 요약을 계산할 수 없습니다.</div>';
      return;
    }

    constructionFoundationPileList.innerHTML = summaryRows.map((row) => (
      `<div class="construction-foundation-list-item ${row.kind === "parking" ? "foundation-kind-item--parking" : "foundation-kind-item--building"}">
        <span class="construction-foundation-group-name">${escape(row.label)}</span>
        <span class="construction-foundation-summary-line">
          <span>선택 ${row.count}개 · 두께 ${escape(row.valueLabel)}</span>
        </span>
      </div>`
    )).join("");
  }

  function syncFoundationControlValues() {
    if (constructionFoundationMultiSelect) constructionFoundationMultiSelect.checked = Boolean(constructionState.foundationMultiSelect);
    if (constructionFoundationWindowSelect) constructionFoundationWindowSelect.checked = Boolean(constructionState.foundationWindowSelect);
    if (constructionFoundationPolylineAutoSelect) constructionFoundationPolylineAutoSelect.checked = Boolean(constructionState.foundationPolylineAutoSelect);
    if (constructionFoundationOverlayThickness) {
      constructionFoundationOverlayThickness.checked = constructionState.foundationOverlayShowThickness !== false;
    }
    if (constructionFoundationOverlayDrill) {
      constructionFoundationOverlayDrill.checked = Boolean(constructionState.foundationOverlayShowDrill);
    }
    if (constructionFoundationOverlayTop) {
      constructionFoundationOverlayTop.checked = Boolean(constructionState.foundationOverlayShowFoundationTop);
    }
    if (constructionFoundationHatchThickness) {
      constructionFoundationHatchThickness.checked = constructionState.foundationHatchShowThickness !== false;
    }
    if (constructionFoundationHatchDrill) {
      constructionFoundationHatchDrill.checked = Boolean(constructionState.foundationHatchShowDrill);
    }
    if (constructionFoundationHatchTop) {
      constructionFoundationHatchTop.checked = Boolean(constructionState.foundationHatchShowFoundationTop);
    }
    if (constructionFoundationExcludeWithThickness) constructionFoundationExcludeWithThickness.checked = Boolean(constructionState.foundationExcludeWithThickness);
    qa('input[name="construction-pf-height-band"]').forEach((radio) => {
      radio.checked = radio.value === (constructionState.pfHeightBandMode || "small");
    });
    if (constructionFoundationAreaMin) constructionFoundationAreaMin.value = String(Math.round(Number(constructionState.foundationAreaMinPos || 0)));
    if (constructionFoundationAreaMax) constructionFoundationAreaMax.value = String(Math.round(Number(constructionState.foundationAreaMaxPos || FOUNDATION_AREA_SLIDER_MAX)));
    if (constructionFoundationAreaMinLabel) {
      constructionFoundationAreaMinLabel.textContent = `최소 ${formatFoundationAreaRangePos(constructionState.foundationAreaMinPos)}`;
    }
    if (constructionFoundationAreaMaxLabel) {
      constructionFoundationAreaMaxLabel.textContent = `최대 ${formatFoundationAreaRangePos(constructionState.foundationAreaMaxPos)}`;
    }
    updateFoundationAreaRangeVisual();
  }

  function sliderPosToArea(pos) {
    const minBound = Number(constructionState.foundationAreaBoundMin) || 0;
    const maxBound = Number(constructionState.foundationAreaBoundMax) || minBound;
    const span = Math.max(1, maxBound - minBound);
    const normalized = Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, Number(pos) || 0)) / FOUNDATION_AREA_SLIDER_MAX;
    return minBound + span * normalized;
  }

  function areaToSliderPos(area) {
    const minBound = Number(constructionState.foundationAreaBoundMin) || 0;
    const maxBound = Number(constructionState.foundationAreaBoundMax) || minBound;
    const span = Math.max(1, maxBound - minBound);
    const value = Number.isFinite(Number(area)) ? Number(area) : minBound;
    const normalized = (value - minBound) / span;
    return Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, normalized * FOUNDATION_AREA_SLIDER_MAX));
  }

  function syncFoundationAreaValuesFromPos() {
    constructionState.foundationAreaMinValue = sliderPosToArea(constructionState.foundationAreaMinPos);
    constructionState.foundationAreaMaxValue = sliderPosToArea(constructionState.foundationAreaMaxPos);
    if (constructionState.foundationAreaMaxValue < constructionState.foundationAreaMinValue) {
      const temp = constructionState.foundationAreaMinValue;
      constructionState.foundationAreaMinValue = constructionState.foundationAreaMaxValue;
      constructionState.foundationAreaMaxValue = temp;
    }
  }

  function updateFoundationAreaRangeVisual() {
    if (!constructionFoundationAreaActive || !constructionFoundationAreaMin || !constructionFoundationAreaMax) return;
    const minPos = Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, Number(constructionState.foundationAreaMinPos) || 0));
    const maxPos = Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, Number(constructionState.foundationAreaMaxPos) || FOUNDATION_AREA_SLIDER_MAX));
    const left = (Math.min(minPos, maxPos) / FOUNDATION_AREA_SLIDER_MAX) * 100;
    const right = (Math.max(minPos, maxPos) / FOUNDATION_AREA_SLIDER_MAX) * 100;
    constructionFoundationAreaActive.style.left = `${left}%`;
    constructionFoundationAreaActive.style.width = `${Math.max(0, right - left)}%`;
  }

  function getFoundationAreaMinGapArea() {
    const minBound = Number(constructionState.foundationAreaBoundMin) || 0;
    const maxBound = Number(constructionState.foundationAreaBoundMax) || 0;
    const span = Math.max(1, maxBound - minBound);
    return Math.max(1, span * 0.02);
  }

  function getFoundationAreaMinGapPos() {
    return Math.max(1, Math.round(FOUNDATION_AREA_SLIDER_MAX * 0.02));
  }

  function invalidateFoundationGroupCache() {
    constructionState.foundationGroupItemsCacheKey = "";
    constructionState.foundationGroupItemsCache = [];
    constructionState.foundationPfMatchCacheKey = "";
    constructionState.foundationPfMatchCache = [];
    constructionState.foundationPfConsensusMismatchCount = 0;
    constructionState.foundationPfLabelCandidatesRef = null;
    constructionState.foundationPfLabelCandidates = null;
    constructionState.foundationPfLabelXYMode = 0;
    constructionState.foundationPolylineIdLookupKey = "";
    constructionState.foundationPolylineIdLookup = null;
  }

  function distancePointToClosedPolygon(pt, vertices) {
    if (!pt || !Array.isArray(vertices) || vertices.length < 3) return Infinity;
    if (typeof pointInPolygon === "function" && pointInPolygon(pt, vertices)) return 0;
    let minD = Infinity;
    for (let i = 0; i < vertices.length; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      const d = typeof pointToSegmentDistance === "function"
        ? pointToSegmentDistance(pt, a, b)
        : Infinity;
      if (d < minD) minD = d;
    }
    return minD;
  }

  function medianSortedNumeric(values) {
    const a = values.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  /** P/F 텍스트 높이 중앙값 — 큰 글자(≥) / 작은 글자(&lt;) 구분 */
  function getPfHeightSplitThreshold() {
    const cands = getPfTextCandidatesCached();
    const hs = cands.map((c) => Number(c.textHeight) || 0);
    const pos = hs.filter((h) => h > 0);
    if (pos.length) return medianSortedNumeric(pos);
    return medianSortedNumeric(hs);
  }

  /**
   * P/F 후보(양수 높이만)를 높이값 기준 두 그룹으로 나눔.
   * 1) 정렬 후 인접 높이 차이가 가장 큰 지점에서 자름(자연스러운 두 덩어리).
   * 2) 간격이 전체 범위 대비 너무 작으면(거의 동일 높이) 높이 중앙값으로 작/큰 구분.
   * 3) 그래도 한쪽이 비면 개수 절반으로 자름.
   * 높이 0·미기록은 항상 작은 쪽에만 둔다.
   */
  function getPfRankHeightBandIdSets(candidatesAll) {
    const pos = [];
    candidatesAll.forEach((c) => {
      const h = Number(c.textHeight) || 0;
      if (h > 0) pos.push(c);
    });
    pos.sort((a, b) => {
      const ha = Number(a.textHeight) || 0;
      const hb = Number(b.textHeight) || 0;
      if (ha !== hb) return ha - hb;
      return String(a.id).localeCompare(String(b.id));
    });
    const n = pos.length;
    let smallPosIds = new Set();
    let largePosIds = new Set();

    if (n === 0) {
      // only below
    } else if (n === 1) {
      const id = pos[0].id;
      smallPosIds.add(id);
      largePosIds.add(id);
    } else {
      const heights = pos.map((c) => Number(c.textHeight) || 0);
      const range = heights[n - 1] - heights[0];
      let splitAfter = -1;
      let bestGap = -1;
      for (let i = 0; i < n - 1; i += 1) {
        const gap = heights[i + 1] - heights[i];
        if (gap > bestGap) {
          bestGap = gap;
          splitAfter = i;
        }
      }
      const useGap =
        Number.isFinite(range)
        && range > 0
        && bestGap >= range * 0.03
        && splitAfter >= 0
        && splitAfter < n - 1;

      if (useGap) {
        pos.slice(0, splitAfter + 1).forEach((c) => smallPosIds.add(c.id));
        pos.slice(splitAfter + 1).forEach((c) => largePosIds.add(c.id));
      } else if (!Number.isFinite(range) || range <= 0) {
        pos.forEach((c) => {
          smallPosIds.add(c.id);
          largePosIds.add(c.id);
        });
      } else {
        const medianH = medianSortedNumeric(heights);
        const low = [];
        const high = [];
        pos.forEach((c) => {
          const h = Number(c.textHeight) || 0;
          if (h <= medianH) low.push(c);
          else high.push(c);
        });
        if (!high.length || !low.length) {
          const mid = Math.floor(n / 2);
          pos.slice(0, mid).forEach((c) => smallPosIds.add(c.id));
          pos.slice(mid).forEach((c) => largePosIds.add(c.id));
        } else {
          low.forEach((c) => smallPosIds.add(c.id));
          high.forEach((c) => largePosIds.add(c.id));
        }
      }
    }

    const smallIds = new Set();
    const largeIds = new Set();
    candidatesAll.forEach((c) => {
      const h = Number(c.textHeight) || 0;
      if (h <= 0) {
        smallIds.add(c.id);
      } else if (smallPosIds.has(c.id) && largePosIds.has(c.id)) {
        smallIds.add(c.id);
        largeIds.add(c.id);
      } else if (smallPosIds.has(c.id)) {
        smallIds.add(c.id);
      } else if (largePosIds.has(c.id)) {
        largeIds.add(c.id);
      } else {
        smallIds.add(c.id);
      }
    });
    return { smallIds, largeIds };
  }

  /** 동일 표기(P1 등) 중복 삽입(폴리 안·밖) 구분용 정규화 */
  function normalizePfLabelKey(text) {
    return String(text ?? "")
      .replace(/\s+/g, "")
      .replace(/[，,]/g, "")
      .toUpperCase();
  }

  /** 윤곽 안 P/F 삽입점만 집계(말뚝·파일번호 데이터는 사용하지 않음). */
  function getPfInsideLabelSupportMap(poly, allCandidates) {
    const counts = new Map();
    if (!poly?.vertices || typeof pointInPolygon !== "function" || !Array.isArray(allCandidates)) {
      return counts;
    }
    for (let i = 0; i < allCandidates.length; i += 1) {
      const c = allCandidates[i];
      if (!pointInPolygon({ x: c.x, y: c.y }, poly.vertices)) continue;
      const nk = normalizePfLabelKey(c.text);
      if (!nk) continue;
      counts.set(nk, (counts.get(nk) || 0) + 1);
    }
    return counts;
  }

  /**
   * 윤곽 안 표기별 점수 — 큰 글자(높이 밴드)는 같은 개수라도 더 반영(현장에서 큰 표기가 구역명에 가깝다고 보는 경우).
   */
  function getPfInsideLabelWeightedScores(poly, allCandidates, largeIds) {
    const scores = new Map();
    if (!poly?.vertices || typeof pointInPolygon !== "function" || !Array.isArray(allCandidates)) {
      return scores;
    }
    const wLarge = 2.85;
    const wSmall = 1;
    for (let i = 0; i < allCandidates.length; i += 1) {
      const c = allCandidates[i];
      if (!pointInPolygon({ x: c.x, y: c.y }, poly.vertices)) continue;
      const nk = normalizePfLabelKey(c.text);
      if (!nk) continue;
      const w = largeIds.has(c.id) ? wLarge : wSmall;
      scores.set(nk, (scores.get(nk) || 0) + w);
    }
    return scores;
  }

  /** 무게중심에 가장 가까운 반대 밴드(큰↔작) 라벨 표기 — 큰 글자만 밖에 있어도 구역명 후보로 쓴다. */
  function getPfNearestOppositeBandNkToCentroid(poly, candidatesAll, smallIds, largeIds, band) {
    if (!poly?.vertices || !Array.isArray(candidatesAll)) return null;
    const cen = polylineVerticesCentroid(poly.vertices);
    if (!cen || !Number.isFinite(cen.x) || !Number.isFinite(cen.y)) return null;
    const oppSet = band === "small" ? largeIds : smallIds;
    const baseMax = getPfMatchMaxDistanceForPolyline(poly.vertices);
    const pairCap = getPfLargeSmallPairDistanceCapWorld();
    const mUnit = getPfSpatialUnitsLikelyMeters();
    const floorD = mUnit ? 0.06 : 115;
    const maxD = Math.min(pairCap, Math.max(floorD, baseMax * 1.05));
    let bestNk = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const c = candidatesAll[i];
      if (!oppSet.has(c.id)) continue;
      const nk = normalizePfLabelKey(c.text);
      if (!nk) continue;
      const d = Math.hypot(c.x - cen.x, c.y - cen.y);
      if (d >= maxD || d >= bestDist) continue;
      bestDist = d;
      bestNk = nk;
    }
    return bestNk ? { nk: bestNk, dist: bestDist } : null;
  }

  /** 윤곽 안 작은 글자(높이 밴드)만 표기별 개수 */
  function getPfInsideSmallNkCounts(poly, candidatesAll, smallIds) {
    const counts = new Map();
    if (!poly?.vertices || typeof pointInPolygon !== "function" || !Array.isArray(candidatesAll)) {
      return counts;
    }
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const c = candidatesAll[i];
      if (!smallIds.has(c.id)) continue;
      if (!pointInPolygon({ x: c.x, y: c.y }, poly.vertices)) continue;
      const nk = normalizePfLabelKey(c.text);
      if (!nk) continue;
      counts.set(nk, (counts.get(nk) || 0) + 1);
    }
    return counts;
  }

  /**
   * 가중 윤곽 안 점수 + (가능하면) 윤곽 안 작은 글자 표기 최우선 + 같은 표기 큰 글자 보너스.
   * 무게중심에 가까운 "다른" 큰 글자(P2E)가 더 가깝다고 P2C(작) 합의를 빼앗지 않게 한다.
   */
  function resolvePfConsensusNkForPoly(poly, candidatesAll, smallIds, largeIds, band) {
    const weighted = getPfInsideLabelWeightedScores(poly, candidatesAll, largeIds);
    const merged = new Map();
    weighted.forEach((v, nk) => merged.set(nk, v));

    const smallInside = getPfInsideSmallNkCounts(poly, candidatesAll, smallIds);
    let smallDomNk = null;
    let smallDomCnt = 0;
    smallInside.forEach((cnt, nk) => {
      if (cnt > smallDomCnt) {
        smallDomCnt = cnt;
        smallDomNk = nk;
      }
    });

    if (smallDomNk && smallDomCnt >= 1) {
      merged.set(smallDomNk, (merged.get(smallDomNk) || 0) + 5.2);
      const cen = polylineVerticesCentroid(poly.vertices);
      if (cen && Number.isFinite(cen.x) && Number.isFinite(cen.y)) {
        const baseMax = getPfMatchMaxDistanceForPolyline(poly.vertices);
        const pairCap = getPfLargeSmallPairDistanceCapWorld();
        const mUnit = getPfSpatialUnitsLikelyMeters();
        const minLarge = mUnit ? 0.1 : 190;
        const maxLarge = Math.min(pairCap, Math.max(minLarge, baseMax * 1.5));
        let bestD = Infinity;
        for (let i = 0; i < candidatesAll.length; i += 1) {
          const c = candidatesAll[i];
          if (!largeIds.has(c.id)) continue;
          if (normalizePfLabelKey(c.text) !== smallDomNk) continue;
          const d = Math.hypot(c.x - cen.x, c.y - cen.y);
          if (d < maxLarge && d < bestD) bestD = d;
        }
        if (bestD < Infinity) {
          merged.set(smallDomNk, (merged.get(smallDomNk) || 0) + 2.4);
        }
      }
    } else {
      const anchor = getPfNearestOppositeBandNkToCentroid(poly, candidatesAll, smallIds, largeIds, band);
      if (anchor?.nk) {
        const bonus = Math.min(3.6, 1.9 + 520 / (120 + anchor.dist));
        merged.set(anchor.nk, (merged.get(anchor.nk) || 0) + bonus);
      }
    }

    if (!merged.size) return null;
    let topNk = null;
    let topScore = -Infinity;
    merged.forEach((score, nk) => {
      if (score > topScore) {
        topScore = score;
        topNk = nk;
      } else if (score === topScore && topNk != null && nk.localeCompare(topNk) < 0) {
        topNk = nk;
      }
    });
    return topNk || null;
  }

  function getPolylineBBoxDiag(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return { dx: 1, dy: 1, diag: 1 };
    const xs = vertices.map((v) => Number(v.x));
    const ys = vertices.map((v) => Number(v.y));
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    const diag = Math.hypot(dx, dy) || Math.max(dx, dy, 1);
    return { dx, dy, diag };
  }

  // 절대 크기 giant 판정(상대 분포 비교 사용 안 함)
  const PF_GIANT_POLY_ABS_MAX_SIDE_M = 80;
  const PF_GIANT_POLY_ABS_MAX_SIDE_MM = 80000;
  const PF_GIANT_POLY_ABS_MIN_AREA_M2 = 1200;
  const PF_GIANT_POLY_ABS_MIN_AREA_MM2 = 1200000000; // 1200 m^2

  /**
   * 절대 면적/변 길이로 "사이트 외곽급 거대 윤곽" 판정.
   * (분포 기반 상대 비교는 사용하지 않는다.)
   */
  function computePfGiantPolylineIdSet(polys) {
    const out = new Set();
    if (!Array.isArray(polys) || !polys.length) return out;
    const inMeters = getPfSpatialUnitsLikelyMeters();
    const areaThreshold = inMeters ? PF_GIANT_POLY_ABS_MIN_AREA_M2 : PF_GIANT_POLY_ABS_MIN_AREA_MM2;
    const sideThreshold = inMeters ? PF_GIANT_POLY_ABS_MAX_SIDE_M : PF_GIANT_POLY_ABS_MAX_SIDE_MM;
    for (let i = 0; i < polys.length; i += 1) {
      const p = polys[i];
      if (!p?.vertices || p.vertices.length < 3) continue;
      const area = polygonArea(p.vertices);
      if (!Number.isFinite(area) || area <= 0) continue;
      const xs = p.vertices.map((v) => Number(v.x));
      const ys = p.vertices.map((v) => Number(v.y));
      const side = Math.max(
        (Math.max(...xs) - Math.min(...xs)) || 0,
        (Math.max(...ys) - Math.min(...ys)) || 0,
      );
      if (area >= areaThreshold || side >= sideThreshold) {
        out.add(String(p.id));
      }
    }
    return out;
  }

  const PF_GIANT_TEXT_ABS_HEIGHT_M = 1.2;
  const PF_GIANT_TEXT_ABS_HEIGHT_MM = 1200;

  /**
   * 절대 글자 높이(TEXT height)로 giant 텍스트 판정.
   * (분포 기반 상대 비교는 사용하지 않는다.)
   */
  function computePfGiantTextIdSet(cands) {
    const out = new Set();
    if (!Array.isArray(cands) || !cands.length) return out;
    const inMeters = getPfSpatialUnitsLikelyMeters();
    const threshold = inMeters ? PF_GIANT_TEXT_ABS_HEIGHT_M : PF_GIANT_TEXT_ABS_HEIGHT_MM;
    cands.forEach((c) => {
      const id = String(c?.id ?? "");
      const h = Number(c?.textHeight) || 0;
      if (!id || !Number.isFinite(h) || h <= 0) return;
      if (h >= threshold) out.add(id);
    });
    return out;
  }

  /** 같은 윤곽 안에서 P/F 기준점에서 비정상적으로 먼 말뚝(파일) 연결 제거 — 폴리 크기 대비 캡 + 군집 */
  function filterPfCircleIdsByAnchorCluster(circleIds, anchorX, anchorY, vertices) {
    if (!Array.isArray(circleIds) || !circleIds.length) return circleIds;
    if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return circleIds;
    const { dx, dy, diag } = getPolylineBBoxDiag(vertices);
    const bboxCap = Math.min(Math.max(diag * 0.52, Math.max(dx, dy) * 0.44, 125), 880);
    const items = [];
    for (let i = 0; i < circleIds.length; i += 1) {
      const c = state.circleMap?.get(String(circleIds[i]));
      if (!c) continue;
      const d = Math.hypot(Number(c.center_x) - anchorX, Number(c.center_y) - anchorY);
      if (Number.isFinite(d)) items.push({ id: circleIds[i], d });
    }
    let pool = items.filter((x) => x.d <= bboxCap);
    if (!pool.length) pool = items.slice();

    if (pool.length === 2) {
      const a = pool[0].d <= pool[1].d ? pool[0] : pool[1];
      const b = pool[0].d > pool[1].d ? pool[0] : pool[1];
      if (b.d > Math.max(a.d * 5, 95) && b.d > a.d + 180) return [a.id];
      return [a.id, b.id];
    }
    pool.sort((a, b) => a.d - b.d);
    const mid = Math.floor(pool.length / 2);
    const med = pool.length % 2 ? pool[mid].d : (pool[mid - 1].d + pool[mid].d) / 2;
    const cap = Math.max(med * 2.35, 48);
    const out = pool.filter((x) => x.d <= cap).map((x) => x.id);
    if (out.length) return out;
    pool.sort((a, b) => a.d - b.d);
    return [pool[0].id];
  }

  /** 닫힌 윤곽마다 허용 최대 거리 — 가까운 라벨만(윤곽 크기에 비례, 절대 상한 낮음) */
  function getPfMatchMaxDistanceForPolyline(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return 120;
    const xs = vertices.map((v) => Number(v.x));
    const ys = vertices.map((v) => Number(v.y));
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    const side = Math.max(dx, dy, 1);
    const diag = Math.hypot(dx, dy) || side;
    const cap = Math.min(Math.max(side * 0.05, diag * 0.035), 220);
    return Math.max(35, Math.min(cap, 260));
  }

  const PF_CANDIDATE_GRID_CELL = 180;

  function buildPfCandidateGrid(candidates) {
    const buckets = new Map();
    candidates.forEach((cand, idx) => {
      const cx = Math.floor(cand.x / PF_CANDIDATE_GRID_CELL);
      const cy = Math.floor(cand.y / PF_CANDIDATE_GRID_CELL);
      const key = `${cx},${cy}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(idx);
    });
    return buckets;
  }

  /** 폴리 바운딩 + pad 안에 들어올 수 있는 후보만 (전체 스캔 방지) */
  function collectCandidateIndicesNearPoly(buckets, vertices, pad) {
    const xs = vertices.map((v) => Number(v.x));
    const ys = vertices.map((v) => Number(v.y));
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const cs = PF_CANDIDATE_GRID_CELL;
    const i0 = Math.floor(minX / cs);
    const i1 = Math.floor(maxX / cs);
    const j0 = Math.floor(minY / cs);
    const j1 = Math.floor(maxY / cs);
    const seen = new Set();
    const out = [];
    for (let ix = i0; ix <= i1; ix += 1) {
      for (let iy = j0; iy <= j1; iy += 1) {
        const list = buckets.get(`${ix},${iy}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k += 1) {
          const idx = list[k];
          if (!seen.has(idx)) {
            seen.add(idx);
            out.push(idx);
          }
        }
      }
    }
    return out;
  }

  function isPfLocationLabelText(text) {
    const s = String(text ?? "").trim();
    if (!s || s.length > 220) return false;
    return /[PFpf]/.test(s);
  }

  /** 서버에서 foundation_pf_only 로 표시된 P/F 또는(구데이터) 문자열에 P/F 가 포함된 텍스트 */
  function isPfPositionLabelTextRecord(t) {
    if (!t || typeof t !== "object") return false;
    if (t.foundation_pf_only === true) return true;
    return isPfLocationLabelText(String(t.text ?? ""));
  }

  /** P/F 라벨만 수집. `state.texts` 배열 참조가 바뀔 때만 다시 스캔(대용량 도면에서 전체 텍스트 반복 순회 방지). */
  function getPfTextCandidatesCached() {
    const texts = Array.isArray(state.texts) ? state.texts : [];
    if (
      constructionState.foundationPfLabelCandidatesRef === texts
      && Array.isArray(constructionState.foundationPfLabelCandidates)
      && constructionState.foundationPfLabelXYMode === 1
    ) {
      return constructionState.foundationPfLabelCandidates;
    }
    const out = [];
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      const { x: tx, y: ty } = getPfTextWorldXYFromTextRecord(t);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      if (!isPfPositionLabelTextRecord(t)) continue;
      out.push({
        id: String(t.id),
        text: String(t.text ?? ""),
        x: tx,
        y: ty,
        textHeight: Number(t.height) || Number(t.text_height) || 0,
        pfOnly: Boolean(t.foundation_pf_only),
      });
    }
    constructionState.foundationPfLabelCandidatesRef = texts;
    constructionState.foundationPfLabelCandidates = out;
    constructionState.foundationPfLabelXYMode = 1;
    return out;
  }

  /**
   * 선택한 높이 구간 안에서만 비교.
   * 링(바깥 안·안쪽 밖)에 있는 글자가 안쪽 윤곽에만 가깝다고 잘못 붙는 것을 막기 위해
   * 삽입점이 해당 윤곽 닫힌선 안(포함)인지를 거리보다 먼저 본다.
   */
  function comparePfMatchCandidates(a, b) {
    if (Boolean(a?.inside) !== Boolean(b?.inside)) {
      return a.inside ? -1 : 1;
    }
    const eps = 1e-6;
    const ad = Number(a.distance);
    const bd = Number(b.distance);
    if (Math.abs(ad - bd) > eps) return ad - bd;
    const ac = Number(a.dCen) || 0;
    const bc = Number(b.dCen) || 0;
    return ac - bc;
  }

  /**
   * 행(윤곽)마다 서로 다른 열(텍스트 id) 하나씩 — 총비용 최소 (n ≤ m).
   * cp-algorithms assignment (min cost).
   */
  function hungarianMinCostRectangular(cost) {
    const n = cost.length;
    if (!n) return [];
    const m = cost[0].length;
    if (m < n) throw new Error("hungarianMinCostRectangular: need m >= n");
    const INF = 1e18;
    const u = new Float64Array(n + 1);
    const v = new Float64Array(m + 1);
    const p = new Int32Array(m + 1);
    const way = new Int32Array(m + 1);
    for (let i = 1; i <= n; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(m + 1);
      for (let t = 0; t <= m; t += 1) minv[t] = INF;
      const used = new Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = INF;
        let j1 = 0;
        for (let j = 1; j <= m; j += 1) {
          if (!used[j]) {
            const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
            if (cur < minv[j]) {
              minv[j] = cur;
              way[j] = j0;
            }
            if (minv[j] < delta) {
              delta = minv[j];
              j1 = j;
            }
          }
        }
        for (let j = 0; j <= m; j += 1) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0);
    }
    const ans = new Array(n).fill(-1);
    for (let j = 1; j <= m; j += 1) {
      if (p[j] !== 0) {
        ans[p[j] - 1] = j - 1;
      }
    }
    return ans;
  }

  const PF_GLOBAL_ASSIGN_INF = 1e12;
  /** 전역 배정에서 합의 표기와 다른 후보에 가하는 비용 — 거리만으로는 F6↔F11 등이 뒤바뀌는 경우 완화 */
  const PF_GLOBAL_CONSENSUS_MISMATCH_PENALTY = 380;
  /** 삽입점이 윤곽 밖이면 기하 거리에 가산 — 전역 배정·스왑이 '가까운 밖'보다 '포함 안'을 우선하도록 함 */
  const PF_MATCH_OUTSIDE_POLYLINE_EXTRA_COST = 2e6;

  function getPfEffectiveMatchCost(sc) {
    if (!sc || !Number.isFinite(Number(sc.distance))) return Infinity;
    const d = Number(sc.distance);
    return sc.inside ? d : d + PF_MATCH_OUTSIDE_POLYLINE_EXTRA_COST;
  }

  /**
   * 윤곽별 허용 후보(geoSorted)로 비용행렬을 만들고, 전역 최소비용으로 텍스트 id 를 한 번에 배정.
   * 서로 다른 id 를 쓰는 완전 매칭이 불가하면 null (호출부에서 그리디로 폴백).
   */
  function tryPfGlobalMinCostAssignment(jobs) {
    const n = jobs.length;
    if (n === 0) return { assignment: [], usedTextIds: new Set() };

    const colIds = [];
    const seen = new Set();
    for (let ji = 0; ji < n; ji += 1) {
      const list = jobs[ji].geoSorted || [];
      for (let k = 0; k < list.length; k += 1) {
        const id = list[k].cand.id;
        if (!seen.has(id)) {
          seen.add(id);
          colIds.push(id);
        }
      }
    }
    const m = colIds.length;
    if (m < n) return null;

    const cost = [];
    for (let i = 0; i < n; i += 1) {
      const row = new Array(m);
      const list = jobs[i].geoSorted || [];
      const scoreById = new Map();
      for (let k = 0; k < list.length; k += 1) {
        const sc = list[k];
        scoreById.set(sc.cand.id, sc);
      }
      const consensusNk = jobs[i].consensusNk;
      for (let j = 0; j < m; j += 1) {
        const sc = scoreById.get(colIds[j]);
        if (!sc || !Number.isFinite(Number(sc.distance))) {
          row[j] = PF_GLOBAL_ASSIGN_INF;
          continue;
        }
        const d = getPfEffectiveMatchCost(sc);
        let pen = 0;
        if (consensusNk) {
          let nk = null;
          for (let k = 0; k < list.length; k += 1) {
            if (list[k].cand.id === colIds[j]) {
              nk = normalizePfLabelKey(list[k].cand.text);
              break;
            }
          }
          if (nk && nk !== consensusNk) pen = PF_GLOBAL_CONSENSUS_MISMATCH_PENALTY;
        }
        row[j] = d + pen;
      }
      cost.push(row);
    }

    for (let i = 0; i < n; i += 1) {
      let ok = false;
      for (let j = 0; j < m; j += 1) {
        if (cost[i][j] < PF_GLOBAL_ASSIGN_INF * 0.5) {
          ok = true;
          break;
        }
      }
      if (!ok) return null;
    }

    let colForRow;
    try {
      colForRow = hungarianMinCostRectangular(cost);
    } catch {
      return null;
    }

    const assignment = new Array(n).fill(null);
    const usedTextIds = new Set();
    for (let i = 0; i < n; i += 1) {
      const j = colForRow[i];
      if (j < 0 || j >= m) return null;
      const cst = cost[i][j];
      if (!Number.isFinite(cst) || cst >= PF_GLOBAL_ASSIGN_INF * 0.5) return null;
      const candId = colIds[j];
      const list = jobs[i].geoSorted || [];
      let sc = null;
      for (let k = 0; k < list.length; k += 1) {
        if (list[k].cand.id === candId) {
          sc = list[k];
          break;
        }
      }
      if (!sc) return null;
      assignment[i] = { sc, baselineDist: sc.distance };
      usedTextIds.add(candId);
    }
    if (usedTextIds.size !== n) return null;
    return { assignment, usedTextIds };
  }

  /** 같은 표기의 큰글자/작은글자(반대 밴드)가 이 윤곽 무게중심 근처에 있으면 짝이 맞는 후보로 본다. */
  function hasPfOppositeBandPartnerNearPoly(nk, poly, band, candidatesAll, smallIds, largeIds) {
    return Number.isFinite(getOppositeBandPartnerDistToCentroid(nk, poly, band, candidatesAll, smallIds, largeIds));
  }

  /** 같은 표기·반대 밴드 후보까지의 직선 거리(큰↔작 짝 밀착도, 기초 텍스트만). */
  function getPfNearestOppositeBandPartnerDist(sc, band, candidatesAll, smallIds, largeIds) {
    if (!sc?.cand || !Array.isArray(candidatesAll)) return Infinity;
    const nk = normalizePfLabelKey(sc.cand.text);
    if (!nk) return Infinity;
    const oppSet = band === "small" ? largeIds : smallIds;
    let minD = Infinity;
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const c = candidatesAll[i];
      if (!oppSet.has(c.id)) continue;
      if (normalizePfLabelKey(c.text) !== nk) continue;
      const d = Math.hypot(c.x - sc.cand.x, c.y - sc.cand.y);
      if (d < minD) minD = d;
    }
    const cap = getPfLargeSmallPairDistanceCapWorld();
    return minD <= cap ? minD : Infinity;
  }

  /** 반대 밴드·같은 표기 후보가 윤곽 무게중심까지의 최소 거리(없으면 Infinity). */
  function getOppositeBandPartnerDistToCentroid(nk, poly, band, candidatesAll, smallIds, largeIds) {
    if (!nk || !poly?.vertices || !Array.isArray(candidatesAll)) return Infinity;
    const oppSet = band === "small" ? largeIds : smallIds;
    const cen = polylineVerticesCentroid(poly.vertices);
    if (!cen || !Number.isFinite(cen.x) || !Number.isFinite(cen.y)) return Infinity;
    const maxPair = getPfLargeSmallPairDistanceCapWorld();
    let minD = Infinity;
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const c = candidatesAll[i];
      if (!oppSet.has(c.id)) continue;
      if (normalizePfLabelKey(c.text) !== nk) continue;
      const d = Math.hypot(c.x - cen.x, c.y - cen.y);
      if (d < minD) minD = d;
    }
    return minD <= maxPair ? minD : Infinity;
  }

  /**
   * 후보 정렬: 큰 글자 모드면 윤곽 안 작은 글과 같은 표기인 큰 글을 거리보다 우선.
   * 그다음 윤곽까지 기하 거리 → 합의 표기·윤곽 내 다수·큰↔작 짝.
   */
  function sortPfCandidatesGeoFirst(
    ranked,
    pfInsideSupport,
    consensusNk,
    poly,
    band,
    candidatesAll,
    smallIds,
    largeIds,
    insideSmallDominantNk,
  ) {
    return ranked.slice().sort((a, b) => {
      if (band === "large" && insideSmallDominantNk) {
        const na = normalizePfLabelKey(a.cand.text);
        const nb = normalizePfLabelKey(b.cand.text);
        const ma = na === insideSmallDominantNk ? 1 : 0;
        const mb = nb === insideSmallDominantNk ? 1 : 0;
        if (ma !== mb) return mb - ma;
      }
      const da = Number(a.distance);
      const db = Number(b.distance);
      if (Math.abs(da - db) > 1e-3) return comparePfMatchCandidates(a, b);
      const na = normalizePfLabelKey(a.cand.text);
      const nb = normalizePfLabelKey(b.cand.text);
      const ma = consensusNk && na === consensusNk ? 1 : 0;
      const mb = consensusNk && nb === consensusNk ? 1 : 0;
      if (ma !== mb) return mb - ma;
      const sa = pfInsideSupport.get(na) || 0;
      const sb = pfInsideSupport.get(nb) || 0;
      if (sa !== sb) return sb - sa;
      const pa = getPfNearestOppositeBandPartnerDist(a, band, candidatesAll, smallIds, largeIds);
      const pb = getPfNearestOppositeBandPartnerDist(b, band, candidatesAll, smallIds, largeIds);
      if (Number.isFinite(pa) && Number.isFinite(pb) && Math.abs(pa - pb) > 1e-4) {
        return pa - pb;
      }
      const ha = hasPfOppositeBandPartnerNearPoly(na, poly, band, candidatesAll, smallIds, largeIds) ? 1 : 0;
      const hb = hasPfOppositeBandPartnerNearPoly(nb, poly, band, candidatesAll, smallIds, largeIds) ? 1 : 0;
      if (ha !== hb) return hb - ha;
      const dca = getOppositeBandPartnerDistToCentroid(na, poly, band, candidatesAll, smallIds, largeIds);
      const dcb = getOppositeBandPartnerDistToCentroid(nb, poly, band, candidatesAll, smallIds, largeIds);
      if (Number.isFinite(dca) && Number.isFinite(dcb) && ha && hb && Math.abs(dca - dcb) > 1e-4) {
        return dca - dcb;
      }
      return comparePfMatchCandidates(a, b);
    });
  }

  /** 1차 할당: geo 순에서 아직 안 쓴 text id */
  function pickFirstUnusedPfGeoSorted(geoSorted, usedTextIds) {
    for (let k = 0; k < geoSorted.length; k += 1) {
      const sc = geoSorted[k];
      if (!usedTextIds.has(sc.cand.id)) return sc;
    }
    return null;
  }

  /** 안쪽 닫힌선이 바깥 닫힌선 내부에 중첩되는지(중심점 기준). */
  function isInnerClosedPolylineNestedInOuter(innerVerts, outerVerts) {
    if (!Array.isArray(innerVerts) || innerVerts.length < 3 || !Array.isArray(outerVerts) || outerVerts.length < 3) {
      return false;
    }
    if (typeof pointInPolygon !== "function") return false;
    const c = polylineVerticesCentroid(innerVerts);
    if (!c || !Number.isFinite(c.x)) return false;
    return pointInPolygon({ x: c.x, y: c.y }, outerVerts);
  }

  /**
   * 삽입점이 속한 가장 작은 닫힌 윤곽(owner)에만 P/F를 붙인다.
   * 링(큰 기초판 안·안쪽 기둥·작은 윤곽 밖)에 있는 글자는 owner가 바깥 윤곽뿐이므로,
   * 예전처럼 안쪽 윤곽에도 후보를 열어 두면 가까운 안쪽 폴리선으로만 잘못 붙는다.
   */
  function pfOwnerAllowsCandForPoly(cand, poly, ownerPolylineIdByPfCandId, polyById) {
    if (!cand || !poly?.vertices || !polyById) return false;
    if (typeof pointInPolygon === "function" && pointInPolygon({ x: cand.x, y: cand.y }, poly.vertices)) {
      return true;
    }
    const oid = ownerPolylineIdByPfCandId.get(cand.id);
    if (oid == null || oid === String(poly.id)) return true;
    return false;
  }

  /**
   * 거대 외곽(giant) 안의 작은 P/F 후보는 기본적으로 제외하지만,
   * 바깥 판 안에 기둥·작은 구멍 폴리선이 여러 개 있어 링 영역에 라벨이 있는 경우(기초판)는 유지한다.
   * (단순 사이트 외곽만 있는 경우는 제외 유지)
   */
  function pfKeepSmallCandidateDespiteGiantOwner(cand, ownerId, polysSorted, polyById) {
    const outer = polyById.get(String(ownerId));
    if (!outer?.vertices || typeof pointInPolygon !== "function") return false;
    const pt = { x: cand.x, y: cand.y };
    if (!pointInPolygon(pt, outer.vertices)) return false;
    const oa = polygonArea(outer.vertices);
    if (!(oa > 0)) return false;

    const nested = [];
    for (let i = 0; i < polysSorted.length; i += 1) {
      const p = polysSorted[i];
      if (String(p.id) === String(outer.id)) continue;
      const a = polygonArea(p.vertices);
      if (a >= oa - 1e-3) continue;
      if (!isInnerClosedPolylineNestedInOuter(p.vertices, outer.vertices)) continue;
      nested.push({ p, a });
    }
    if (!nested.length) return false;

    const TINY_FRAC = 0.028;
    const SMALL_FRAC = 0.085;
    const hasTinyHole = nested.some((x) => x.a <= oa * TINY_FRAC);
    const smallOnes = nested.filter((x) => x.a <= oa * SMALL_FRAC);
    const multiSmallPlate = smallOnes.length >= 2;
    const singleModestHole = nested.length === 1 && nested[0].a <= oa * 0.058;

    if (!hasTinyHole && !multiSmallPlate && !singleModestHole) return false;

    for (let i = 0; i < nested.length; i += 1) {
      if (pointInPolygon(pt, nested[i].p.vertices)) return false;
    }
    return true;
  }

  /** 인접 윤곽끼리 배정을 바꿔 총 거리가 줄면 교환(P2C↔P2E 뺏기 완화) */
  function tryImprovePfAssignmentsByPairwiseSwap(jobs, assignment, ownerPolylineIdByPfCandId, polyById) {
    let changed = true;
    let guard = 0;
    while (changed && guard < 16) {
      changed = false;
      guard += 1;
      for (let i = 0; i < jobs.length; i += 1) {
        for (let j = i + 1; j < jobs.length; j += 1) {
          const ai = assignment[i];
          const aj = assignment[j];
          if (!ai?.sc || !aj?.sc) continue;
          const pi = jobs[i].poly;
          const pj = jobs[j].poly;
          if (
            !pfOwnerAllowsCandForPoly(aj.sc.cand, pi, ownerPolylineIdByPfCandId, polyById)
            || !pfOwnerAllowsCandForPoly(ai.sc.cand, pj, ownerPolylineIdByPfCandId, polyById)
          ) {
            continue;
          }
          const sii = scorePfCandidateForPoly(aj.sc.cand, pi.vertices);
          const sjj = scorePfCandidateForPoly(ai.sc.cand, pj.vertices);
          const s0i = scorePfCandidateForPoly(ai.sc.cand, pi.vertices);
          const s0j = scorePfCandidateForPoly(aj.sc.cand, pj.vertices);
          if (
            getPfEffectiveMatchCost(sii) + getPfEffectiveMatchCost(sjj)
            < getPfEffectiveMatchCost(s0i) + getPfEffectiveMatchCost(s0j) - 0.25
          ) {
            const t = assignment[i];
            assignment[i] = assignment[j];
            assignment[j] = t;
            changed = true;
          }
        }
      }
    }
  }

  /**
   * 합의 표기로 살짝 멀어져도 되나, 큰↔작 짝이 너무 나빠지거나 다른 윤곽 배정이 크게 악화되면 스왑/승급 취소.
   */
  function refinePfPolylineAssignments(
    jobs,
    assignment,
    usedTextIds,
    ownerPolylineIdByPfCandId,
    band,
    candidatesAll,
    smallIds,
    largeIds,
    polyById,
  ) {
    const SAME_NK_SLACK = 88;
    const PAIR_REGRESS_LIMIT = 360;
    const SWAP_DIST_REGRESS = 118;

    function pairSc(sc) {
      return getPfNearestOppositeBandPartnerDist(sc, band, candidatesAll, smallIds, largeIds);
    }

    let changed = true;
    let guard = 0;
    while (changed && guard < 10) {
      changed = false;
      guard += 1;
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        const cur = assignment[i];
        if (!cur || !job.consensusNk) continue;
        const nk = normalizePfLabelKey(cur.sc.cand.text);
        if (nk === job.consensusNk) continue;

        const pool = job.fullSorted || job.geoSorted;
        const alt = pool.find((sc) => {
          if (normalizePfLabelKey(sc.cand.text) !== job.consensusNk) return false;
          if (!pfOwnerAllowsCandForPoly(sc.cand, job.poly, ownerPolylineIdByPfCandId, polyById)) return false;
          return sc.distance <= cur.sc.distance + SAME_NK_SLACK;
        });
        if (!alt) continue;

        const pCur = pairSc(cur.sc);
        const pAlt = pairSc(alt);
        if (Number.isFinite(pCur) && Number.isFinite(pAlt) && pAlt > pCur + PAIR_REGRESS_LIMIT) {
          continue;
        }

        const holderIdx = assignment.findIndex((a, j) => a && j !== i && a.sc.cand.id === alt.cand.id);

        if (holderIdx < 0) {
          usedTextIds.delete(cur.sc.cand.id);
          usedTextIds.add(alt.cand.id);
          assignment[i] = { sc: alt, baselineDist: cur.baselineDist };
          changed = true;
          continue;
        }

        const jobO = jobs[holderIdx];
        const curO = assignment[holderIdx];
        if (!curO) continue;

        const candMine = cur.sc.cand;
        const candO = alt.cand;

        if (!pfOwnerAllowsCandForPoly(candMine, jobO.poly, ownerPolylineIdByPfCandId, polyById)) continue;
        if (!pfOwnerAllowsCandForPoly(candO, job.poly, ownerPolylineIdByPfCandId, polyById)) continue;

        const newI = scorePfCandidateForPoly(candO, job.poly.vertices);
        const newO = scorePfCandidateForPoly(candMine, jobO.poly.vertices);
        if (newI.distance > job.maxD || newO.distance > jobO.maxD) continue;
        if (newI.distance > cur.baselineDist + SWAP_DIST_REGRESS) continue;
        if (newO.distance > curO.baselineDist + SWAP_DIST_REGRESS) continue;

        const pOldI = pairSc(cur.sc);
        const pOldO = pairSc(curO.sc);
        const pNewI = pairSc(newI);
        const pNewO = pairSc(newO);
        if (
          Number.isFinite(pOldI)
          && Number.isFinite(pOldO)
          && Number.isFinite(pNewI)
          && Number.isFinite(pNewO)
          && pNewI + pNewO > pOldI + pOldO + PAIR_REGRESS_LIMIT
        ) {
          continue;
        }

        assignment[i] = { sc: newI, baselineDist: cur.baselineDist };
        assignment[holderIdx] = { sc: newO, baselineDist: curO.baselineDist };
        changed = true;
      }
    }
  }

  function scorePfCandidateForPoly(cand, vertices) {
    const d = distancePointToClosedPolygon({ x: cand.x, y: cand.y }, vertices);
    const inside =
      typeof pointInPolygon === "function" && pointInPolygon({ x: cand.x, y: cand.y }, vertices);
    const cen = polylineVerticesCentroid(vertices);
    const dCen =
      cen && Number.isFinite(cen.x) && Number.isFinite(cen.y)
        ? Math.hypot(cand.x - cen.x, cand.y - cen.y)
        : Infinity;
    return { cand, distance: d, inside: !!inside, dCen };
  }

  /**
   * 동일 표기(PF1)가 도면에 여러 TEXT로 반복되면, 각 윤곽이 가장 가까운 PF1 id만 골라
   * PF2·PF3 같은 다른 표기 id가 한 윤곽에도 배정되지 않을 수 있다.
   * 후보에 있으면서 아직 배정되지 않은 표기는, 허용 거리 안에서 가장 가까운 윤곽 하나에 붙인다(다른 표기와 윤곽 충돌 시 거리 짧은 순).
   */
  function supplementMissingPfNormalizedLabelAssignments(
    jobs,
    assignment,
    usedTextIds,
    ownerPolylineIdByPfCandId,
    candidatesAll,
    polyById,
  ) {
    const nkSeen = new Set();
    for (let ji = 0; ji < assignment.length; ji += 1) {
      const slot = assignment[ji];
      if (slot?.sc?.cand?.text) nkSeen.add(normalizePfLabelKey(slot.sc.cand.text));
    }

    const byNk = new Map();
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const c = candidatesAll[i];
      const nk = normalizePfLabelKey(c.text);
      if (!nk) continue;
      if (!byNk.has(nk)) byNk.set(nk, []);
      byNk.get(nk).push(c);
    }

    const missing = Array.from(byNk.keys())
      .filter((nk) => !nkSeen.has(nk))
      .sort((a, b) => a.localeCompare(b, "ko"));
    if (!missing.length) return;

    const claimedJi = new Set();
    missing.forEach((nk) => {
      const cands = byNk.get(nk) || [];
      let best = null;
      cands.forEach((cand) => {
        for (let ji = 0; ji < jobs.length; ji += 1) {
          if (claimedJi.has(ji)) continue;
          const job = jobs[ji];
          if (!pfOwnerAllowsCandForPoly(cand, job.poly, ownerPolylineIdByPfCandId, polyById)) continue;
          const sc = scorePfCandidateForPoly(cand, job.poly.vertices);
          if (sc.distance > job.maxD) continue;
          const eff = getPfEffectiveMatchCost(sc);
          if (
            !best
            || eff < best.dist
            || (Math.abs(eff - best.dist) < 1e-6 && ji < best.ji)
          ) {
            best = { ji, sc, cand, dist: eff };
          }
        }
      });
      if (!best) return;
      const old = assignment[best.ji];
      if (old?.sc?.cand?.id) usedTextIds.delete(old.sc.cand.id);
      assignment[best.ji] = { sc: best.sc, baselineDist: best.sc.distance };
      usedTextIds.add(best.cand.id);
      claimedJi.add(best.ji);
    });
  }

  /** 닫힌 폴리라인마다 가장 가까운 P/F 텍스트를 붙입니다. 면적 작은 윤곽(안쪽)부터 확정해 중첩 시 바깥 윤곽이 안쪽 라벨을 가져가지 않게 합니다. */
  function getPfPolylineMatchGroups() {
    const polys = getBackgroundPolylinesForClick();
    const band = constructionState.pfHeightBandMode === "large" ? "large" : "small";
    const rawPfCandidates = getPfTextCandidatesCached();
    const giantTextIdSet = computePfGiantTextIdSet(rawPfCandidates);
    const pfCandidates = rawPfCandidates.filter((c) => !giantTextIdSet.has(String(c.id)));
    const { smallIds, largeIds } = getPfRankHeightBandIdSets(pfCandidates);
    const bandIdSet = band === "large" ? largeIds : smallIds;
    const giantTextSig = Array.from(giantTextIdSet).sort().join(",");
    const pfMetaSig = pfCandidates
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(
        (c) =>
          `${c.id}:${String(c.text)}:${c.pfOnly ? 1 : 0}:${(Number(c.textHeight) || 0).toFixed(4)}@${(Number(c.x) || 0).toFixed(2)},${(Number(c.y) || 0).toFixed(2)}`,
      )
      .join("|");
    const polyIdsSig = polys
      .map((p) => String(p.id))
      .sort()
      .join("\x1e");
    const cacheKey = `pfpl37|${constructionState.foundationBackgroundPolylineCacheKey || ""}|${polys.length}|${polyIdsSig}|${band}|${giantTextSig}|${pfMetaSig}`;
    if (constructionState.foundationPfMatchCacheKey === cacheKey) {
      return constructionState.foundationPfMatchCache;
    }
    const polysSorted = polys
      .filter((p) => p?.vertices?.length >= 3)
      .map((p) => ({ poly: p, area: polygonArea(p.vertices) }))
      .sort((a, b) => {
        const EPS = 1e-3;
        if (Math.abs(a.area - b.area) > EPS) return a.area - b.area;
        const ca = polylineVerticesCentroid(a.poly.vertices);
        const cb = polylineVerticesCentroid(b.poly.vertices);
        const pa = ca && Number.isFinite(ca.x) ? ca.x + ca.y : 0;
        const pb = cb && Number.isFinite(cb.x) ? cb.x + cb.y : 0;
        if (Math.abs(pa - pb) > 1e-4) return pa - pb;
        return String(a.poly.id).localeCompare(String(b.poly.id));
      })
      .map((row) => row.poly);
    const polyById = new Map();
    polysSorted.forEach((p) => polyById.set(String(p.id), p));
    const areaOutlines = (state.buildings || []).filter((b) => Array.isArray(b?.vertices) && b.vertices.length >= 3);
    function resolveAreaKindByPoint(pt) {
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y) || typeof pointInPolygon !== "function") return "outside";
      for (let i = 0; i < areaOutlines.length; i += 1) {
        const b = areaOutlines[i];
        const verts = b.vertices.map((v) => ({ x: Number(v.x), y: Number(v.y) }));
        if (verts.length < 3) continue;
        if (!pointInPolygon(pt, verts)) continue;
        const k = String(b.kind || "building").trim().toLowerCase();
        if (k === "parking") return "parking";
        return "building";
      }
      return "outside";
    }
    const polyAreaKindById = new Map();
    for (let i = 0; i < polysSorted.length; i += 1) {
      const p = polysSorted[i];
      const cen = polylineVerticesCentroid(p.vertices);
      const kind = resolveAreaKindByPoint(cen || { x: NaN, y: NaN });
      polyAreaKindById.set(String(p.id), kind);
    }
    const giantPolylineIdSet = computePfGiantPolylineIdSet(polysSorted);
    // 사이트 외곽처럼 비정상적으로 큰 닫힌 윤곽은 P/F 매칭 자체에서 제외한다.
    // (큰 글자 모드에서 F13A/F12A 같은 라벨이 외곽과 직접 묶이는 오매칭 방지)
    const polysForMatching = polysSorted.filter(
      (p) => !giantPolylineIdSet.has(String(p.id)),
    );
    const effectivePolysForMatching = polysForMatching;
    /** 삽입점이 속한 면적 최소 닫힌 윤곽(가장 안쪽 영역) — 인접·바깥 윤곽이 안쪽 라벨을 가로채지 않게 함 */
    const ownerPolylineIdByPfCandId = new Map();
    if (typeof pointInPolygon === "function") {
      for (let ci = 0; ci < pfCandidates.length; ci += 1) {
        const c = pfCandidates[ci];
        let ownerId = null;
        for (let pi = 0; pi < polysSorted.length; pi += 1) {
          const p = polysSorted[pi];
          if (pointInPolygon({ x: c.x, y: c.y }, p.vertices)) {
            ownerId = String(p.id);
            break;
          }
        }
        ownerPolylineIdByPfCandId.set(c.id, ownerId);
      }
    }
    let candidatesAll = pfCandidates.filter((c) => {
      if (!smallIds.has(c.id)) return true;
      const oid = ownerPolylineIdByPfCandId.get(c.id);
      if (oid != null && giantPolylineIdSet.has(oid)) {
        const ownerAreaKind = polyAreaKindById.get(String(oid));
        if (ownerAreaKind === "parking" || ownerAreaKind === "building") {
          return true;
        }
        if (pfKeepSmallCandidateDespiteGiantOwner(c, oid, polysSorted, polyById)) {
          return true;
        }
        return false;
      }
      return true;
    });
    // 사이트 외곽(거대 폴리) 안의 작은 P/F만 전부 제외되면 후보가 0이 될 수 있음 → 풍무 등에서 PF1~3이 안 잡히는 경우 방지.
    if (!candidatesAll.length && pfCandidates.length) {
      candidatesAll = pfCandidates;
    }
    let candidates = candidatesAll.filter((c) => bandIdSet.has(c.id));
    // 높이 밴드(작은/큰)만 잡히면 후보가 0이 될 수 있음(예: 양수 높이 P/F가 1개뿐이면 전부 '큰' 쪽만).
    // 풍무 등 PF1·PF2만 있는 도면에서 '작은 글자만' 선택 시 목록이 통째로 비는 것을 막는다.
    if (!candidates.length && candidatesAll.length) {
      candidates = candidatesAll;
    }
    const candGrid = buildPfCandidateGrid(candidates);
    const jobs = [];
    effectivePolysForMatching.forEach((poly) => {
      const baseMax = getPfMatchMaxDistanceForPolyline(poly.vertices);
      const maxD =
        band === "small"
          ? Math.max(30, Math.min(baseMax * 0.68, 165))
          : Math.min(baseMax, 215);
      const nearIdx = collectCandidateIndicesNearPoly(candGrid, poly.vertices, maxD);
      const byNorm = new Map();
      for (let ni = 0; ni < nearIdx.length; ni += 1) {
        const cand = candidates[nearIdx[ni]];
        if (!cand) continue;
        if (!pfOwnerAllowsCandForPoly(cand, poly, ownerPolylineIdByPfCandId, polyById)) continue;
        const sc = scorePfCandidateForPoly(cand, poly.vertices);
        if (sc.distance > maxD) continue;
        const nk = normalizePfLabelKey(cand.text);
        const prev = byNorm.get(nk);
        if (!prev || comparePfMatchCandidates(sc, prev) < 0) {
          byNorm.set(nk, sc);
        }
      }
      const rawRanked = Array.from(byNorm.values());
      if (!rawRanked.length) return;

      const pfInsideSupport = getPfInsideLabelSupportMap(poly, candidatesAll);
      const consensusNk = resolvePfConsensusNkForPoly(poly, candidatesAll, smallIds, largeIds, band);
      const smallNkMap = getPfInsideSmallNkCounts(poly, candidatesAll, smallIds);
      let insideSmallDominantNk = null;
      let smBest = 0;
      smallNkMap.forEach((cnt, nk) => {
        if (cnt > smBest) {
          smBest = cnt;
          insideSmallDominantNk = nk;
        }
      });
      const fullSorted = sortPfCandidatesGeoFirst(
        rawRanked,
        pfInsideSupport,
        consensusNk,
        poly,
        band,
        candidatesAll,
        smallIds,
        largeIds,
        insideSmallDominantNk,
      );
      const insideRanked = rawRanked.filter((sc) => sc.inside);
      const geoSorted =
        insideRanked.length > 0
          ? sortPfCandidatesGeoFirst(
              insideRanked,
              pfInsideSupport,
              consensusNk,
              poly,
              band,
              candidatesAll,
              smallIds,
              largeIds,
              insideSmallDominantNk,
            )
          : fullSorted;
      jobs.push({
        poly,
        maxD,
        geoSorted,
        fullSorted,
        consensusNk,
        pfInsideSupport,
        hasInsideSmallCandidate: insideRanked.length > 0,
      });
    });

    const usedTextIds = new Set();
    const assignment = new Array(jobs.length).fill(null);
    const global = tryPfGlobalMinCostAssignment(jobs);
    if (global) {
      for (let ji = 0; ji < jobs.length; ji += 1) {
        assignment[ji] = global.assignment[ji];
      }
      global.usedTextIds.forEach((id) => usedTextIds.add(id));
    } else {
      // 텍스트 id 는 도면 전체에서 한 번씩만 쓰므로, 면적 오름차순(작은 폴리 먼저)이면
      // 기둥·작은 구멍이 PF1~3 을 먼저 가져가 지하주차장 큰 판이 비는 경우가 많다 → 큰 윤곽부터 배정.
      const greedyOrder = jobs
        .map((job, ji) => ({ ji, area: polygonArea(job.poly.vertices) }))
        .sort((a, b) => a.area - b.area);
      greedyOrder.forEach(({ ji }) => {
        const job = jobs[ji];
        const best = pickFirstUnusedPfGeoSorted(job.geoSorted, usedTextIds);
        if (!best) return;
        usedTextIds.add(best.cand.id);
        assignment[ji] = { sc: best, baselineDist: best.distance };
      });
    }

    refinePfPolylineAssignments(
      jobs,
      assignment,
      usedTextIds,
      ownerPolylineIdByPfCandId,
      band,
      candidatesAll,
      smallIds,
      largeIds,
      polyById,
    );

    tryImprovePfAssignmentsByPairwiseSwap(jobs, assignment, ownerPolylineIdByPfCandId, polyById);

    supplementMissingPfNormalizedLabelAssignments(
      jobs,
      assignment,
      usedTextIds,
      ownerPolylineIdByPfCandId,
      candidatesAll,
      polyById,
    );

    const rows = [];
    let consensusMismatchCount = 0;
    jobs.forEach((job, ji) => {
      const slot = assignment[ji];
      if (!slot) return;
      const best = slot.sc;
      if (job.consensusNk && normalizePfLabelKey(best.cand.text) !== job.consensusNk) {
        consensusMismatchCount += 1;
      }
      const poly = job.poly;
      const polylineId = String(poly.id);
      let inside = getEffectiveCircleIdsForPolylineToggle(poly);
      if (inside.length > 1) {
        inside = filterPfCircleIdsByAnchorCluster(inside, best.cand.x, best.cand.y, poly.vertices);
      }
      const labelTrim = String(best.cand.text ?? "").trim();
      const cen0 = polylineVerticesCentroid(poly.vertices);
      rows.push({
        pfKey: `pfpoly:${polylineId}`,
        polylineId,
        textId: best.cand.id,
        label: best.cand.text,
        clusterLabel: labelTrim || "P/F",
        polylineIds: [polylineId],
        circleIds: inside,
        minDistance: best.distance,
        area: polygonArea(poly.vertices),
        outlineCentroidX: cen0 && Number.isFinite(cen0.x) ? cen0.x : null,
        outlineCentroidY: cen0 && Number.isFinite(cen0.y) ? cen0.y : null,
      });
    });
    rows.sort((a, b) => {
      const c = a.clusterLabel.localeCompare(b.clusterLabel, "ko");
      if (c !== 0) return c;
      if (b.area !== a.area) return b.area - a.area;
      return a.polylineId.localeCompare(b.polylineId);
    });
    constructionState.foundationPfMatchCacheKey = cacheKey;
    constructionState.foundationPfMatchCache = rows;
    constructionState.foundationPfConsensusMismatchCount = consensusMismatchCount;
    return rows;
  }

  /** 같은 P/F 표기(clusterLabel)별로 윤곽·파일 id 를 합친 목록(버튼 1개 = 전체 선택) */
  function getPfAggregatesByClusterLabel() {
    const rows = getPfPolylineMatchGroups();
    const byLabel = new Map();
    rows.forEach((row) => {
      const label = row.clusterLabel;
      if (!byLabel.has(label)) {
        byLabel.set(label, {
          clusterLabel: label,
          polylineIdSet: new Set(),
          circleIdSet: new Set(),
          textIdSet: new Set(),
          minDistance: Infinity,
        });
      }
      const agg = byLabel.get(label);
      row.polylineIds.forEach((id) => agg.polylineIdSet.add(id));
      row.circleIds.forEach((id) => agg.circleIdSet.add(id));
      agg.textIdSet.add(row.textId);
      if (Number.isFinite(row.minDistance) && row.minDistance < agg.minDistance) {
        agg.minDistance = row.minDistance;
      }
    });
    return Array.from(byLabel.values())
      .filter((a) => a.circleIdSet.size > 0)
      .map((a) => ({
        clusterLabel: a.clusterLabel,
        textIds: Array.from(a.textIdSet),
        polylineIds: Array.from(a.polylineIdSet),
        circleIds: Array.from(a.circleIdSet),
        minDistance: Number.isFinite(a.minDistance) ? a.minDistance : 0,
        outlineCount: a.polylineIdSet.size,
        pfKey: `pfgrp:${encodeURIComponent(a.clusterLabel)}`,
      }))
      .sort((x, y) => x.clusterLabel.localeCompare(y.clusterLabel, "ko"));
  }

  function cloneSet(iter) {
    return new Set(Array.from(iter || []));
  }

  function snapshotFoundationStateForHistory() {
    return {
      thickness: { ...constructionState.foundationThicknessByPileId },
      pit: { ...constructionState.foundationPitOffsetByPileId },
      drillingPile: { ...constructionState.drillingStartByPileId },
      foundationTopPile: { ...constructionState.foundationTopByPileId },
      selectedCircles: cloneSet(constructionState.foundationSelectedCircleIds),
      selectedPolylines: cloneSet(constructionState.foundationSelectedPolylineIds),
      subgroupKeys: cloneSet(constructionState.foundationSelectedSubgroupKeys),
      pfKeys: cloneSet(constructionState.foundationSelectedPfKeys),
      suppressedCircles: cloneSet(constructionState.foundationSuppressedCircleIds),
      suppressedPolylines: cloneSet(constructionState.foundationSuppressedPolylineIds),
      buildings: (state.buildings || []).map((b) => ({
        drill: b?.drilling_start_elevation,
        top: b?.foundation_top_elevation,
      })),
    };
  }

  function applyFoundationHistorySnapshot(snap) {
    if (!snap) return;
    constructionState.foundationThicknessByPileId = { ...snap.thickness };
    state.foundationThicknessByPileId = { ...snap.thickness };
    constructionState.foundationPitOffsetByPileId = { ...snap.pit };
    state.foundationPitOffsetByPileId = { ...snap.pit };
    constructionState.drillingStartByPileId = { ...(snap.drillingPile || {}) };
    state.drillingStartByPileId = { ...(snap.drillingPile || {}) };
    constructionState.foundationTopByPileId = { ...(snap.foundationTopPile || {}) };
    state.foundationTopByPileId = { ...(snap.foundationTopPile || {}) };
    constructionState.foundationSelectedCircleIds = cloneSet(snap.selectedCircles);
    constructionState.foundationSelectedPolylineIds = cloneSet(snap.selectedPolylines);
    constructionState.foundationSelectedSubgroupKeys = cloneSet(snap.subgroupKeys);
    constructionState.foundationSelectedPfKeys = cloneSet(snap.pfKeys);
    constructionState.foundationSuppressedCircleIds = cloneSet(snap.suppressedCircles);
    constructionState.foundationSuppressedPolylineIds = cloneSet(snap.suppressedPolylines);
    const buildings = state.buildings || [];
    (snap.buildings || []).forEach((row, i) => {
      const b = buildings[i];
      if (!b || !row) return;
      if (row.drill == null || row.drill === "") delete b.drilling_start_elevation;
      else b.drilling_start_elevation = Number(row.drill);
      if (row.top == null || row.top === "") delete b.foundation_top_elevation;
      else b.foundation_top_elevation = Number(row.top);
    });
    if (typeof renderPendingNameEditor === "function") {
      renderPendingNameEditor();
    }
    rerenderSettlementTableFromState();
    invalidateFoundationGroupCache();
    refreshFoundationPanel();
    requestRedraw();
  }

  function beforeFoundationMutation() {
    const snap = snapshotFoundationStateForHistory();
    constructionState.foundationHistoryPast.push(snap);
    if (constructionState.foundationHistoryPast.length > 60) {
      constructionState.foundationHistoryPast.shift();
    }
    constructionState.foundationHistoryFuture.length = 0;
  }

  function undoFoundationStep() {
    const past = constructionState.foundationHistoryPast;
    if (!past.length) return;
    constructionState.foundationHistoryFuture.push(snapshotFoundationStateForHistory());
    const prev = past.pop();
    applyFoundationHistorySnapshot(prev);
    setSyncStatus("실행 취소했습니다.");
  }

  function redoFoundationStep() {
    const future = constructionState.foundationHistoryFuture;
    if (!future.length) return;
    constructionState.foundationHistoryPast.push(snapshotFoundationStateForHistory());
    const next = future.pop();
    applyFoundationHistorySnapshot(next);
    setSyncStatus("다시 실행했습니다.");
  }

  /** 캔버스 라벨: 항목별 색·줄 분리용 */
  function buildFoundationCanvasLabelParts(circle) {
    const showT = constructionState.foundationOverlayShowThickness !== false;
    const showD = Boolean(constructionState.foundationOverlayShowDrill);
    const showF = Boolean(constructionState.foundationOverlayShowFoundationTop);
    if (!showT && !showD && !showF) return [];
    const mm = getFoundationThicknessMm(circle.id);
    const drill = getDrillingElevationMForCircle(circle.id);
    const top = getFoundationTopElevationMForCircle(circle.id);
    const pitOffsetM = getFoundationPitOffsetM(circle.id);
    const allThree = showT && showD && showF;
    const parts = [];
    if (showT) {
      if (Number.isFinite(mm)) {
        let chunk = String(Math.round(mm));
        if (Number.isFinite(pitOffsetM) && pitOffsetM > 0) {
          chunk += ` (${formatMetric(pitOffsetM, 3)}m)`;
        }
        parts.push({ text: chunk, fillStyle: getFoundationThicknessColor(mm) });
      } else if (allThree) {
        parts.push({ text: "—", fillStyle: "#64748b" });
      }
    }
    if (showD) {
      if (Number.isFinite(drill)) {
        parts.push({ text: formatMetric(drill, 3), fillStyle: "#0369a1" });
      } else if (allThree) {
        parts.push({ text: "—", fillStyle: "#64748b" });
      }
    }
    if (showF) {
      if (Number.isFinite(top)) {
        parts.push({ text: formatMetric(top, 3), fillStyle: "#15803d" });
      } else if (allThree) {
        parts.push({ text: "—", fillStyle: "#64748b" });
      }
    }
    return parts;
  }

  function buildFoundationCanvasLabel(circle) {
    const parts = buildFoundationCanvasLabelParts(circle);
    return parts.length ? parts.map((p) => p.text).join(", ") : "";
  }

  function drawFoundationCanvasLabelStack(circle, canvasX, canvasY, parts) {
    if (!parts.length) return;
    const rawRadius = Number(circle?.radius);
    const zoom = Number.isFinite(Number(view.scale)) ? Number(view.scale) : 1;
    const radiusPx = Number.isFinite(rawRadius) ? Math.max(2, rawRadius * zoom) : 2;
    const fontPx = Math.max(12, Math.min(15, Math.round(12 + Math.log2(Math.max(zoom, 0.5)))));
    const lineHeight = fontPx + 4;
    const textPadX = 6;
    const textPadY = 5;
    const textLayerGap = state.showTextLabels !== false ? 22 : 10;
    const anchorLift = state.showTextLabels !== false ? 24 : 14;
    const canvasSize = typeof getCanvasSize === "function"
      ? getCanvasSize()
      : { width: Number(canvas?.width) || 0, height: Number(canvas?.height) || 0 };
    const viewportPadding = 24;
    if (
      canvasX < -viewportPadding
      || canvasX > canvasSize.width + viewportPadding
      || canvasY < -viewportPadding
      || canvasY > canvasSize.height + viewportPadding
    ) {
      return;
    }
    ctx.save();
    ctx.font = `600 ${fontPx}px "Segoe UI", sans-serif`;
    const widths = parts.map((part) => ctx.measureText(part.text).width);
    const boxWidth = Math.ceil((widths.length ? Math.max(...widths) : 0) + textPadX * 2);
    const boxHeight = Math.ceil(parts.length * lineHeight + textPadY * 2 - 2);
    let boxX = canvasX - boxWidth / 2;
    let boxY = canvasY - anchorLift - boxHeight;
    const maxBoxX = Math.max(4, canvasSize.width - boxWidth - 4);
    boxX = Math.max(4, Math.min(boxX, maxBoxX));
    if (boxY < 4) {
      boxY = Math.min(canvasSize.height - boxHeight - 4, canvasY + Math.min(24, radiusPx + 8));
    }
    boxY = Math.max(4, Math.min(boxY, canvasSize.height - boxHeight - 4));
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    parts.forEach((part, i) => {
      const textY = boxY + textPadY + i * lineHeight;
      const textX = boxX + textPadX;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.92)";
      ctx.strokeText(part.text, textX, textY);
      ctx.fillStyle = part.fillStyle;
      ctx.fillText(part.text, textX, textY);
    });
    ctx.restore();
  }

  function scheduleFoundationAreaRefresh() {
    if (constructionState.foundationAreaRefreshRaf) {
      window.cancelAnimationFrame(constructionState.foundationAreaRefreshRaf);
      constructionState.foundationAreaRefreshRaf = null;
    }
    constructionState.foundationAreaRefreshRaf = window.requestAnimationFrame(() => {
      constructionState.foundationAreaRefreshRaf = null;
      invalidateFoundationGroupCache();
      refreshFoundationPanel();
      requestRedraw();
    });
  }

  function formatAreaValue(value) {
    if (!Number.isFinite(value)) return "-";
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${Math.round(value)}`;
  }

  /** 면적 기준 UI: 슬라이더와 동일한 0~FOUNDATION_AREA_SLIDER_MAX 눈금 */
  function formatFoundationAreaRangePos(pos) {
    const n = Math.round(Number(pos) || 0);
    return String(Math.max(0, Math.min(FOUNDATION_AREA_SLIDER_MAX, n)));
  }

  function renderFoundationAreaBandInfo() {
    if (!constructionFoundationAreaValues) return;
    const rows = getSelectablePolylines().map((polyline) => ({
      area: polygonArea(polyline.vertices),
    }));
    const stats = collectAreaStats(rows);
    if (!Number.isFinite(stats.mode) || stats.mode <= 0) {
      constructionFoundationAreaValues.textContent = "면적 기준을 계산할 수 없습니다.";
      return;
    }
    const baseMin = 1;
    constructionState.foundationAreaBoundMin = Math.min(baseMin, stats.minArea);
    const boundedMax = Math.min(
      stats.maxArea,
      FOUNDATION_AREA_ABS_MAX,
    );
    constructionState.foundationAreaBoundMax = boundedMax;
    const defaultMin = Math.max(baseMin, stats.minArea);
    const defaultMax = boundedMax;
    if (!Number.isFinite(constructionState.foundationAreaMinValue)) {
      constructionState.foundationAreaMinValue = defaultMin;
    }
    if (!Number.isFinite(constructionState.foundationAreaMaxValue)) {
      constructionState.foundationAreaMaxValue = defaultMax;
    }
    constructionState.foundationAreaMinValue = Math.max(constructionState.foundationAreaBoundMin, Math.min(boundedMax, Number(constructionState.foundationAreaMinValue)));
    constructionState.foundationAreaMaxValue = Math.max(constructionState.foundationAreaBoundMin, Math.min(boundedMax, Number(constructionState.foundationAreaMaxValue)));
    const minGap = getFoundationAreaMinGapArea();
    if (constructionState.foundationAreaMaxValue - constructionState.foundationAreaMinValue < minGap) {
      const mid = (constructionState.foundationAreaMaxValue + constructionState.foundationAreaMinValue) / 2;
      constructionState.foundationAreaMinValue = Math.max(constructionState.foundationAreaBoundMin, mid - minGap / 2);
      constructionState.foundationAreaMaxValue = Math.min(boundedMax, constructionState.foundationAreaMinValue + minGap);
      if (constructionState.foundationAreaMaxValue - constructionState.foundationAreaMinValue < minGap) {
        constructionState.foundationAreaMinValue = Math.max(constructionState.foundationAreaBoundMin, constructionState.foundationAreaMaxValue - minGap);
      }
    }
    constructionState.foundationAreaMinPos = areaToSliderPos(constructionState.foundationAreaMinValue);
    constructionState.foundationAreaMaxPos = areaToSliderPos(constructionState.foundationAreaMaxValue);
    const posGap = getFoundationAreaMinGapPos();
    if (constructionState.foundationAreaMaxPos - constructionState.foundationAreaMinPos < posGap) {
      constructionState.foundationAreaMaxPos = Math.min(FOUNDATION_AREA_SLIDER_MAX, constructionState.foundationAreaMinPos + posGap);
      if (constructionState.foundationAreaMaxPos - constructionState.foundationAreaMinPos < posGap) {
        constructionState.foundationAreaMinPos = Math.max(0, constructionState.foundationAreaMaxPos - posGap);
      }
      syncFoundationAreaValuesFromPos();
    }
    const modePos = areaToSliderPos(stats.mode);
    constructionFoundationAreaValues.textContent =
      `중심 ${formatFoundationAreaRangePos(modePos)} · 최소 ${formatFoundationAreaRangePos(constructionState.foundationAreaMinPos)} · 최대 ${formatFoundationAreaRangePos(constructionState.foundationAreaMaxPos)}`;
  }

  function normalizePresetProjectKey(p) {
    return String(p ?? "").trim().toLowerCase();
  }

  function getPresetCurrentProjectKey() {
    const p = state.loadedWorkMeta?.project
      || (typeof getActiveProjectName === "function" ? getActiveProjectName() : null)
      || state.loadedProjectName
      || "";
    return String(p).trim();
  }

  function savedWorkTsForPreset(item) {
    const d = item?.timestamp ? new Date(item.timestamp).getTime() : 0;
    return Number.isFinite(d) ? d : 0;
  }

  function filterWorksForPresetDropdown(list) {
    const cur = normalizePresetProjectKey(getPresetCurrentProjectKey());
    let rows = (list || []).filter((it) => it && it.id);
    if (cur) {
      rows = rows.filter((it) => normalizePresetProjectKey(it.project) === cur);
    }
    const selfId = state.loadedWorkId;
    if (selfId) {
      rows = rows.filter((it) => it.id !== selfId);
    }
    return rows.sort((a, b) => savedWorkTsForPreset(b) - savedWorkTsForPreset(a));
  }

  async function fetchSavedWorksListForPreset() {
    const response = await fetch(`${API_BASE_URL}/api/saved-works`);
    if (!response.ok) return [];
    const list = await response.json();
    return Array.isArray(list) ? list : [];
  }

  function getSourceTypeLabelForPreset(st) {
    const raw = String(st || "").trim().toLowerCase();
    if (raw === "contractor_original" || raw === "원도급") return "원도급";
    if (raw === "design" || raw === "설계") return "설계";
    return raw || "—";
  }

  async function fetchSavedWorkPayloadById(workId) {
    if (!workId) return null;
    const response = await fetch(`${API_BASE_URL}/api/saved-works/${encodeURIComponent(workId)}`);
    if (typeof pilexyParseFetchJson === "function") {
      return pilexyParseFetchJson(response);
    }
    if (!response.ok) throw new Error(response.statusText || "저장 작업을 불러오지 못했습니다.");
    return response.json();
  }

  /** 다른 저장 버전 JSON → 현재 말뚝 id에 맞는 항목만 병합 */
  function mergePerPileFoundationMapsFromPayload(payload) {
    const circleIds = new Set((state.circles || []).map((c) => c?.id).filter(Boolean));
    let nThick = 0;
    let nDrill = 0;
    let nTop = 0;
    let nPit = 0;
    const thickSrc = payload?.foundationThicknessByPileId;
    if (thickSrc && typeof thickSrc === "object") {
      Object.entries(thickSrc).forEach(([id, v]) => {
        if (!circleIds.has(id)) return;
        if (Number.isFinite(Number(v)) && Number(v) >= 0) {
          constructionState.foundationThicknessByPileId[id] = Math.round(Number(v));
          nThick += 1;
        }
      });
    }
    const drillSrc = payload?.drillingStartByPileId;
    if (drillSrc && typeof drillSrc === "object") {
      Object.entries(drillSrc).forEach(([id, v]) => {
        if (!circleIds.has(id)) return;
        const parsed = toFiniteNumberOrNull(v);
        if (parsed != null) {
          constructionState.drillingStartByPileId[id] = parsed;
          nDrill += 1;
        }
      });
    }
    const topSrc = payload?.foundationTopByPileId;
    if (topSrc && typeof topSrc === "object") {
      Object.entries(topSrc).forEach(([id, v]) => {
        if (!circleIds.has(id)) return;
        const parsed = toFiniteNumberOrNull(v);
        if (parsed != null) {
          constructionState.foundationTopByPileId[id] = parsed;
          nTop += 1;
        }
      });
    }
    const pitSrc = payload?.foundationPitOffsetByPileId;
    if (pitSrc && typeof pitSrc === "object") {
      Object.entries(pitSrc).forEach(([id, v]) => {
        if (!circleIds.has(id)) return;
        if (Number.isFinite(Number(v)) && Number(v) >= 0) {
          constructionState.foundationPitOffsetByPileId[id] = Number(v);
          nPit += 1;
        }
      });
    }
    state.foundationThicknessByPileId = { ...constructionState.foundationThicknessByPileId };
    state.drillingStartByPileId = { ...constructionState.drillingStartByPileId };
    state.foundationTopByPileId = { ...constructionState.foundationTopByPileId };
    state.foundationPitOffsetByPileId = { ...constructionState.foundationPitOffsetByPileId };
    return { nThick, nDrill, nTop, nPit };
  }

  /** 저장 버전의 buildings → 현재 state.buildings 에 이름이 같은 윤곽에 천공·기초상 반영 */
  function mergeBuildingElevationsFromPayload(payload) {
    const src = Array.isArray(payload?.buildings) ? payload.buildings : [];
    const targets = state.buildings || [];
    let n = 0;
    src.forEach((sb) => {
      const name = String(sb?.name || "").trim();
      if (!name) return;
      const norm = normConstructionLoc(name);
      const t = targets.find((b) => normConstructionLoc(b?.name) === norm);
      if (!t) return;
      const d = sb?.drilling_start_elevation;
      const f = sb?.foundation_top_elevation;
      if (d == null || d === "") {
        delete t.drilling_start_elevation;
      } else if (Number.isFinite(Number(d))) {
        t.drilling_start_elevation = Number(d);
      }
      if (f == null || f === "") {
        delete t.foundation_top_elevation;
      } else if (Number.isFinite(Number(f))) {
        t.foundation_top_elevation = Number(f);
      }
      n += 1;
    });
    return n;
  }

  async function refreshFoundationPresetWorkSelect() {
    if (!constructionFoundationPresetWork) return;
    const prev = constructionFoundationPresetWork.value;
    try {
      const list = await fetchSavedWorksListForPreset();
      const rows = filterWorksForPresetDropdown(list);
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "저장 작업(버전) 선택";
      constructionFoundationPresetWork.replaceChildren(opt0);
      rows.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = String(item.id);
        const title = String(item.title || "").trim() || "(제목 없음)";
        const proj = String(item.project || "").trim() || "—";
        const st = getSourceTypeLabelForPreset(item.sourceType);
        const d = savedWorkTsForPreset(item);
        const dateStr = d ? new Date(d).toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }) : "";
        opt.textContent = `${proj} · ${title} · ${st}${dateStr ? ` · ${dateStr}` : ""}`;
        constructionFoundationPresetWork.appendChild(opt);
      });
      const keep = prev && [...constructionFoundationPresetWork.options].some((o) => o.value === prev);
      if (keep) {
        constructionFoundationPresetWork.value = prev;
      }
    } catch (e) {
      setSyncStatus(errorMessage(e), true);
    }
  }

  function refreshFoundationPanel() {
    void refreshFoundationPresetWorkSelect();
    // 면적 슬라이더·bound를 먼저 맞춘 뒤 그룹을 계산해야 `getCurrentAreaRange`와 실제 polygonArea가 같은 스케일이다.
    renderFoundationAreaBandInfo();
    const groups = getFoundationGroupItems();
    if (!constructionState.foundationGroupsInitialized && groups.length) {
      constructionState.foundationGroupsInitialized = true;
    }
    syncFoundationControlValues();
    renderPfHeightBandHint();
    updateFoundationPreviewSelection();
    renderFoundationParkingCountFilters();
    if (isFoundationTabActive()) {
      renderFoundationPfList();
      renderFoundationPfProximityReview();
      renderFoundationPolylineList();
      renderFoundationPileList();
      renderFoundationSelectionSummary();
    }
  }

  function applyPfGroupKeyToggle(key) {
    const raw = String(key || "");
    const groups = getPfPolylineMatchGroups();
    let g = null;
    if (raw.startsWith("pfgrp:")) {
      let label;
      try {
        label = decodeURIComponent(raw.slice("pfgrp:".length));
      } catch (e) {
        return;
      }
      const agg = getPfAggregatesByClusterLabel().find((row) => row.clusterLabel === label);
      if (agg) {
        g = {
          pfKey: agg.pfKey,
          circleIds: agg.circleIds,
          polylineIds: agg.polylineIds,
        };
      }
    } else if (raw.startsWith("pfpoly:")) {
      const polylineId = raw.replace(/^pfpoly:/, "");
      const row = groups.find((r) => r.polylineId === polylineId);
      if (row) {
        g = { pfKey: row.pfKey, circleIds: row.circleIds, polylineIds: row.polylineIds };
      }
    } else if (raw.startsWith("pf:")) {
      const textId = raw.replace(/^pf:/, "");
      const row = groups.find((r) => r.textId === textId);
      if (row) {
        g = { pfKey: row.pfKey, circleIds: row.circleIds, polylineIds: row.polylineIds };
      }
    }
    if (!g) return;
    beforeFoundationMutation();
    constructionState.foundationSelectedSubgroupKeys.clear();
    const pfKey = g.pfKey;
    const ids = g.circleIds.filter((circleId) => {
      const circle = state.circleMap?.get(circleId);
      if (!circle || !isNumberMatchedCircle(circle)) return false;
      if (constructionState.foundationExcludeWithThickness && Number.isFinite(getFoundationThicknessMm(circleId))) {
        return false;
      }
      return true;
    });

    const sel = constructionState.foundationSelectedCircleIds;
    const pfKeys = constructionState.foundationSelectedPfKeys;
    const allThisSelected =
      ids.length > 0
      && ids.every((id) => sel.has(id))
      && pfKeys.has(pfKey);

    if (allThisSelected) {
      ids.forEach((id) => sel.delete(id));
      pfKeys.delete(pfKey);
      const nextPoly = new Set(constructionState.foundationSelectedPolylineIds || []);
      (g.polylineIds || []).forEach((pid) => nextPoly.delete(String(pid)));
      constructionState.foundationSelectedPolylineIds = nextPoly;
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
      refreshFoundationPanel();
      requestRedraw();
      return;
    }

    if (!constructionState.foundationMultiSelect) {
      constructionState.foundationSelectedCircleIds = new Set(ids);
      constructionState.foundationSelectedPfKeys = new Set(ids.length ? [pfKey] : []);
      constructionState.foundationSelectedPolylineIds = new Set(g.polylineIds || []);
    } else {
      ids.forEach((id) => sel.add(id));
      if (ids.length) {
        pfKeys.add(pfKey);
      }
      const nextPoly = new Set(constructionState.foundationSelectedPolylineIds || []);
      (g.polylineIds || []).forEach((pid) => nextPoly.add(String(pid)));
      constructionState.foundationSelectedPolylineIds = nextPoly;
    }
    constructionState.foundationSuppressedCircleIds.clear();
    constructionState.foundationSuppressedPolylineIds.clear();
    refreshFoundationPanel();
    requestRedraw();
  }

  function pfMaxSepLargeSmallPair(L, S, maxCap) {
    const ha = Number(L.h) + Number(S.h);
    if (getPfSpatialUnitsLikelyMeters()) {
      const hx = ha * 4;
      return Math.max(0.02, Math.min(maxCap, Math.max(hx, 0.18)));
    }
    return Math.max(100, Math.min(maxCap, Math.max(ha * 4, 240)));
  }

  function buildPfLargeSmallRow(L, S, sep) {
    return {
      idLarge: L.id,
      idSmall: S.id,
      labelLarge: L.rawLabel || "—",
      labelSmall: S.rawLabel || "—",
      hLarge: L.h,
      hSmall: S.h,
      distance: sep,
      xLarge: L.x,
      yLarge: L.y,
      xSmall: S.x,
      ySmall: S.y,
    };
  }

  /**
   * 각 큰 글자에 대해 지리상 가장 가까운 작은 글자가 다른 표기인 경우만(근접 오인 검토).
   */
  function getPfLargeSmallGeomCrossNkRows() {
    const threshold = getPfHeightSplitThreshold();
    const items = getPfTextCandidatesCached().map((c) => {
      const h = Number(c.textHeight) || 0;
      return {
        id: c.id,
        rawLabel: String(c.text ?? "").trim(),
        x: c.x,
        y: c.y,
        h,
        isLarge: h >= threshold,
      };
    });
    const larges = items.filter((it) => it.isLarge);
    const smalls = items.filter((it) => !it.isLarge);
    if (!larges.length || !smalls.length) {
      return [];
    }

    const MAX_SEP_CAP = getPfLargeSmallPairDistanceCapWorld();
    const cellSize = Math.max(MAX_SEP_CAP, 1e-9);
    const gridSpan = Math.max(2, Math.min(30, Math.ceil(MAX_SEP_CAP / cellSize) + 3));
    const bucketSmall = new Map();
    smalls.forEach((s, si) => {
      const k = `${Math.floor(s.x / cellSize)},${Math.floor(s.y / cellSize)}`;
      if (!bucketSmall.has(k)) bucketSmall.set(k, []);
      bucketSmall.get(k).push(si);
    });

    const nearestCrossNk = [];
    for (let li = 0; li < larges.length; li += 1) {
      const L = larges[li];
      const nkl = normalizePfLabelKey(L.rawLabel);
      const ix = Math.floor(L.x / cellSize);
      const iy = Math.floor(L.y / cellSize);
      let bestS = null;
      let bestSep = Infinity;
      for (let dx = -gridSpan; dx <= gridSpan; dx += 1) {
        for (let dy = -gridSpan; dy <= gridSpan; dy += 1) {
          const list = bucketSmall.get(`${ix + dx},${iy + dy}`);
          if (!list) continue;
          for (let k = 0; k < list.length; k += 1) {
            const S = smalls[list[k]];
            const sep = Math.hypot(L.x - S.x, L.y - S.y);
            const maxSep = pfMaxSepLargeSmallPair(L, S, MAX_SEP_CAP);
            if (sep > maxSep) continue;
            if (sep < bestSep) {
              bestSep = sep;
              bestS = S;
            }
          }
        }
      }
      if (!bestS || !Number.isFinite(bestSep)) continue;
      const nks = normalizePfLabelKey(bestS.rawLabel);
      if (!nkl || !nks || nkl === nks) continue;
      nearestCrossNk.push(buildPfLargeSmallRow(L, bestS, bestSep));
    }
    const capWorld = getPfLargeSmallPairDistanceCapWorld();
    const filtered = nearestCrossNk.filter((r) => r.distance <= capWorld + 1e-9);
    filtered.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > 1e-6) return a.distance - b.distance;
      return String(a.idLarge).localeCompare(String(b.idLarge));
    });

    return filtered;
  }

  function renderPfHeightBandHint() {
    if (!constructionFoundationPfHeightHint) return;
    const th = getPfHeightSplitThreshold();
    constructionFoundationPfHeightHint.textContent =
      `매칭: 양수 높이 P/F만 모아 높이 순으로 두 그룹(작은/큰)으로 나눕니다. 인접 높이 차이가 가장 큰 지점을 우선 경계로 쓰고, 차이가 거의 없으면 높이 중앙값으로 나눕니다. 전부 같은 높이면 양쪽 밴드에 모두 포함됩니다. 높이 미기록(0)은 항상 작은 쪽. 선택 밴드에 아무도 없으면 전체 P/F로 매칭합니다. 근접 검토 표는 중앙값 ${formatMetric(th, 3)} 기준입니다.`;
  }

  function renderFoundationPfProximityReview() {
    if (!constructionFoundationPfProximityReview) return;
    const rows = getPfLargeSmallGeomCrossNkRows();
    const crossNkCount = rows.length;
    const consensusMismatchCount = Number(constructionState.foundationPfConsensusMismatchCount) || 0;
    const capW = getPfLargeSmallPairDistanceCapWorld();
    const unitHint = getPfSpatialUnitsLikelyMeters() ? `m 도면·한도 ${capW}` : `mm 도면·한도 ${capW}`;
    const summaryLine = `<p class="construction-foundation-viewer-guide construction-pf-proximity-summary">요약: 근접·표기 다른 쌍 <strong>${crossNkCount}</strong>건 · P/F 윤곽 합의와 배정 불일치 <strong>${consensusMismatchCount}</strong>건 <span class="construction-pf-proximity-unit-hint">(${unitHint})</span></p>`;
    if (!rows.length) {
      constructionFoundationPfProximityReview.innerHTML =
        `${summaryLine}<div class="empty-row muted construction-pf-proximity-empty">가깝지만 표기가 다른 큰·작 쌍이 없습니다 (2M 이내).</div>`;
      return;
    }
    const body = rows
      .map(
        (r) =>
          `<tr class="construction-pf-mismatch-row construction-pf-mismatch-row--geom-cross" tabindex="0" role="button" data-ax="${r.xLarge}" data-ay="${r.yLarge}" data-bx="${r.xSmall}" data-by="${r.ySmall}" data-id-a="${escape(r.idLarge)}" data-id-b="${escape(r.idSmall)}">` +
          `<td>${escape(r.labelLarge)}</td><td>${formatMetric(r.hLarge, 3)}</td>` +
          `<td>${escape(r.labelSmall)}</td><td>${formatMetric(r.hSmall, 3)}</td><td>${formatMetric(r.distance, 2)}</td></tr>`,
      )
      .join("");
    constructionFoundationPfProximityReview.innerHTML =
      `${summaryLine}<div class="construction-records-wrapper"><table class="construction-pf-proximity-table construction-records-table construction-summary-table"><thead><tr><th>큰 글자</th><th>큰 h</th><th>작은 글자</th><th>작은 h</th><th>거리</th></tr></thead><tbody>${body}</tbody></table></div>` +
      '<p class="construction-foundation-viewer-guide construction-pf-mismatch-foot">행을 누르면 두 라벨 위치로 이동합니다.</p>';
  }

  /** P/F 묶음에 속한 파일(말뚝) id 기준, 기초두께(mm)별 건수 요약 — 근접 메타 옆 표시용 */
  function summarizePfCircleIdsThicknessCounts(circleIds) {
    const byMm = new Map();
    let missing = 0;
    (circleIds || []).forEach((cid) => {
      const mm = getFoundationThicknessMm(cid);
      if (!Number.isFinite(mm)) {
        missing += 1;
        return;
      }
      const r = Math.round(mm);
      byMm.set(r, (byMm.get(r) || 0) + 1);
    });
    const parts = Array.from(byMm.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([mm, n]) => `${mm}mm×${n}`);
    if (missing) parts.push(`미입력×${missing}`);
    return parts.join(" · ");
  }

  function renderFoundationPfList() {
    if (!constructionFoundationPfList) return;
    const aggregates = getPfAggregatesByClusterLabel();
    if (!aggregates.length) {
      constructionFoundationPfList.innerHTML = '<div class="empty-row">P/F 텍스트와 짝지어진 닫힌 폴리선이 없습니다.</div>';
      return;
    }
    const selected = constructionState.foundationSelectedPfKeys || new Set();
    constructionFoundationPfList.innerHTML = `<div class="foundation-pf-aggregate-list">${aggregates.map((agg) => {
      const active = selected.has(agg.pfKey);
      const dist = formatMetric(agg.minDistance, 2);
      const title = agg.clusterLabel === "P/F" ? "P/F (표기 없음)" : escape(agg.clusterLabel);
      const thickSummary = summarizePfCircleIdsThicknessCounts(agg.circleIds);
      const thickHtml = thickSummary ? ` · 두께 ${escape(thickSummary)}` : "";
      return `<button type="button" class="ghost foundation-pf-item foundation-pf-item--aggregate${active ? " is-active" : ""}" data-foundation-pf-key="${escape(agg.pfKey)}">
        <span class="foundation-pf-label">${title}</span>
        <span class="foundation-pf-meta">윤곽 ${agg.outlineCount}개 · 파일 ${agg.circleIds.length} · 근접 ${dist}${thickHtml}</span>
      </button>`;
    }).join("")}</div>`;
  }

  function escapeTsvCell(value) {
    const s = String(value ?? "");
    if (/[\t\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function copyTextViaExecCommand(text) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error("execCommand copy failed"));
    });
  }

  function copyTextWithFallback(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).catch(() => copyTextViaExecCommand(text));
    }
    return copyTextViaExecCommand(text);
  }

  function showSettlementCopyFeedback(message, isError = false) {
    if (!constructionSettlementRecordsCopyFeedback) return;
    if (settlementCopyFeedbackTimer) {
      window.clearTimeout(settlementCopyFeedbackTimer);
      settlementCopyFeedbackTimer = null;
    }
    constructionSettlementRecordsCopyFeedback.textContent = message;
    constructionSettlementRecordsCopyFeedback.classList.toggle("is-error", Boolean(isError));
    if (!message) return;
    settlementCopyFeedbackTimer = window.setTimeout(() => {
      constructionSettlementRecordsCopyFeedback.textContent = "";
      constructionSettlementRecordsCopyFeedback.classList.remove("is-error");
      settlementCopyFeedbackTimer = null;
    }, 3500);
  }

  function normalizePileToken(value) {
    return String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();
  }

  /** 동일 위치·같은 파일번호로 말뚝이 여러 개일 때 PDAM 행에 연결할 circle id — 기초·천공 등 값이 있는 쪽을 우선한다. */
  function settlementCircleLinkScore(circleId) {
    if (circleId == null || circleId === "") return -1;
    let s = 0;
    if (pileNumericFromMap(constructionState.foundationThicknessByPileId, circleId) != null) s += 100;
    if (pileNumericFromMap(constructionState.foundationTopByPileId, circleId) != null) s += 50;
    if (pileNumericFromMap(constructionState.drillingStartByPileId, circleId) != null) s += 30;
    if (pileNumericFromMap(constructionState.foundationPitOffsetByPileId, circleId) != null) s += 10;
    return s;
  }

  function mergeSettlementCircleId(prevId, nextId) {
    if (nextId == null || nextId === "") return prevId;
    if (prevId == null || prevId === "") return nextId;
    const sp = settlementCircleLinkScore(prevId);
    const sn = settlementCircleLinkScore(nextId);
    if (sn > sp) return nextId;
    if (sp > sn) return prevId;
    return String(prevId).localeCompare(String(nextId), "en") <= 0 ? prevId : nextId;
  }

  /** 말뚝별 매칭 텍스트에서 파일번호 토큰 (없으면 빈 집합). */
  function pileKeysFromCircleMatchedText(circle) {
    const mt = String(circle?.matched_text?.text || "").trim();
    const keys = new Set();
    if (!mt) return keys;
    const pileKeyDisplay = normalizePileToken(formatDisplayedPileNumber(mt));
    const pileKeyRaw = normalizePileToken(mt);
    const invalid = new Set(["", "-", "—"]);
    if (pileKeyDisplay && !invalid.has(pileKeyDisplay)) keys.add(pileKeyDisplay);
    if (pileKeyRaw && pileKeyRaw !== pileKeyDisplay && !invalid.has(pileKeyRaw)) keys.add(pileKeyRaw);
    return keys;
  }

  /**
   * PDAM 행 ↔ 도면 말뚝 연결.
   * 동일/근접 좌표(중복 지오메트리)로 원이 여러 개인 경우 번호 텍스트·두께 입력이 서로 다른 id에 분산될 수 있다.
   * 중복 제외 정책(엄격/느슨)과 같은 클러스터로 파일번호를 합쳐, 번호 없는 원도 `위치|470`에 mergeSettlementCircleId로 묶는다.
   */
  function buildCircleLookupByLocationAndPile() {
    const lookup = new Map();
    const parkingUnified = getSingleParkingOutlineNorm();
    const circles = state.circles || [];
    const byPos = new Map();
    circles.forEach((c) => {
      const idKey = String(c?.id ?? "").trim();
      if (!idKey) return;
      const twins = getFoundationTwinCircleIds(idKey);
      const clusterKey = twins.length ? twins[0] : idKey;
      if (!byPos.has(clusterKey)) byPos.set(clusterKey, []);
      byPos.get(clusterKey).push(c);
    });
    byPos.forEach((group) => {
      const unionPileKeys = new Set();
      group.forEach((c) => {
        pileKeysFromCircleMatchedText(c).forEach((k) => unionPileKeys.add(k));
      });
      if (!unionPileKeys.size) return;
      group.forEach((circle) => {
        const resolvedLoc = resolveFoundationGroupLocationNorm(circle);
        const locFromResolved = recordLocationForPdamMatch(resolvedLoc, parkingUnified);
        const locFromBuildingName = recordLocationForPdamMatch(circle?.building_name, parkingUnified);
        const locKeys = new Set();
        if (locFromResolved) locKeys.add(locFromResolved);
        if (locFromBuildingName && locFromBuildingName !== locFromResolved) {
          locKeys.add(locFromBuildingName);
        }
        locKeys.forEach((lk) => {
          unionPileKeys.forEach((pk) => {
            const k = `${lk}|${pk}`;
            lookup.set(k, mergeSettlementCircleId(lookup.get(k), circle.id));
          });
        });
      });
    });
    return lookup;
  }

  function buildSettlementRecordsRows(records) {
    const parkingUnified = getSingleParkingOutlineNorm();
    const avgMap = buildAverageZByNormalizedLocation();
    const circleLookup = buildCircleLookupByLocationAndPile();
    const normalizeToken = (value) => String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();
    const isHeaderLikeRecord = (record) => {
      if (!record || typeof record !== "object") return false;
      const d = normalizeToken(record.construction_date);
      const e = normalizeToken(record.equipment);
      const p = normalizeToken(record.pile_type);
      const m = normalizeToken(record.construction_method);
      const l = normalizeToken(record.location);
      const n = normalizeToken(record.pile_number);
      let score = 0;
      if (d.includes("시공일")) score += 1;
      if (e.includes("장비")) score += 1;
      if (p.includes("파일종류")) score += 1;
      if (m.includes("공법")) score += 1;
      if (l.includes("위치")) score += 1;
      if (n.includes("파일번호")) score += 1;
      return score >= 4;
    };
    return (records || []).filter((record) => !isHeaderLikeRecord(record)).map((record) => {
      const locKey = recordLocationForPdamMatch(record.location, parkingUnified);
      const pileKey = normalizePileToken(formatDisplayedPileNumber(record.pile_number));
      const pileKeyRaw = normalizePileToken(record.pile_number);
      const locNormRaw = normConstructionLoc(record.location);
      let circleId =
        circleLookup.get(`${locKey}|${pileKey}`)
        || (pileKeyRaw && pileKeyRaw !== pileKey ? circleLookup.get(`${locKey}|${pileKeyRaw}`) : null)
        || (locNormRaw && locNormRaw !== locKey ? circleLookup.get(`${locNormRaw}|${pileKey}`) : null)
        || (locNormRaw && locNormRaw !== locKey && pileKeyRaw && pileKeyRaw !== pileKey
          ? circleLookup.get(`${locNormRaw}|${pileKeyRaw}`)
          : null)
        || null;
      const { value: resolvedStart, basis } = resolveDrillingStartElevation(record.location, avgMap, parkingUnified);
      let startEl = resolvedStart;
      let startElBasis = basis;
      if (circleId) {
        const pileDr = numericFromPerPileMapWithTwins(constructionState.drillingStartByPileId, circleId);
        if (pileDr != null) {
          startEl = pileDr;
          startElBasis = "말뚝별 천공시작";
        }
      }
      const pen = record.penetration_depth;
      let finalTip = null;
      let finalDetail = "";
      if (Number.isFinite(startEl) && Number.isFinite(Number(pen))) {
        finalTip = startEl - Number(pen);
        finalDetail = `천공시작지반고 ${formatMetric(startEl, 3)} − 관입깊이 ${formatMetric(pen, 2)}`;
      }
      return { record: { ...record, circle_id: circleId }, startEl, startElBasis, finalTip, finalDetail };
    });
  }

  function getSettlementHeadTrimConfiguredLabel() {
    const { headTrimTopLevel } = getSettlementDefaults();
    return `${formatMetric(headTrimTopLevel, 2)}m`;
  }

  function getSettlementRemainingBaseConfiguredLabel() {
    const { remainingBase } = getSettlementDefaults();
    return `${formatMetric(remainingBase, 2)}m`;
  }

  function getSettlementTableHeaderLabels() {
    return [
      "시공일",
      "장비",
      "파일종류",
      "공법",
      "위치",
      "파일번호",
      "천공시작 지반고",
      "관입깊이",
      "파일근입 하단레벨 (시작−관입)",
      "파일잔량",
      "공삭공(별도 기성)",
      "기초골조 상단레벨",
      "기초골조 두께",
      "버림콘크리트 두께",
      `두부정리 상단레벨(${getSettlementHeadTrimConfiguredLabel()})`,
      "최종근입(기성최종길이)",
      `최종근입+잔량기준(${getSettlementRemainingBaseConfiguredLabel()})`,
      "잔량(원래−공제)",
      "비고",
    ];
  }

  function getSettlementTableHeaderXlsx() {
    return [
      "시공일",
      "장비",
      "파일종류",
      "공법",
      "위치",
      "파일번호",
      "천공시작\n지반고",
      "관입깊이",
      "파일근입\n하단레벨\n(시작−관입)",
      "파일잔량",
      "공삭공\n(별도 기성)",
      "기초골조\n상단레벨",
      "기초골조\n두께",
      "버림콘\n두께",
      `두부정리\n상단레벨\n(${getSettlementHeadTrimConfiguredLabel()})`,
      "최종근입\n(기성최종길이)",
      `최종근입+잔량기준\n(${getSettlementRemainingBaseConfiguredLabel()})`,
      "잔량\n(원래−공제)",
      "비고",
    ];
  }

  function toFiniteNumberOrNull(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function getSettlementDefaults() {
    const raw = constructionState.settlementDefaults || {};
    const blindingThickness = Number.isFinite(Number(raw.blindingThickness)) ? Number(raw.blindingThickness) : 0.06;
    const headTrimTopLevel = Number.isFinite(Number(raw.headTrimTopLevel)) ? Number(raw.headTrimTopLevel) : 0.16;
    const remainingBase = Number.isFinite(Number(raw.remainingBase)) ? Number(raw.remainingBase) : 0.5;
    return { blindingThickness, headTrimTopLevel, remainingBase };
  }

  function computeSettlementLengthMetrics({ penetrationDepth, pileRemaining, finalPenetration, remainingBase }) {
    const hasOriginalLength = Number.isFinite(penetrationDepth) && Number.isFinite(pileRemaining);
    const originalLength = hasOriginalLength ? penetrationDepth + pileRemaining : null;
    const targetLength = Number.isFinite(finalPenetration) && Number.isFinite(remainingBase)
      ? finalPenetration + remainingBase
      : null;
    const leftoverRaw = Number.isFinite(originalLength) && Number.isFinite(targetLength)
      ? originalLength - targetLength
      : null;
    const leftoverPositive = Number.isFinite(leftoverRaw) ? Math.max(leftoverRaw, 0) : null;
    return { originalLength, targetLength, leftoverRaw, leftoverPositive };
  }

  function buildSettlementRowKey(enriched, rowIndex) {
    const r = enriched?.record || {};
    const parkingUnified = getSingleParkingOutlineNorm();
    const parts = [
      r.id ?? "",
      r.construction_date ?? "",
      recordLocationForPdamMatch(r.location, parkingUnified),
      r.pile_number ?? "",
      r.equipment ?? "",
      r.construction_method ?? "",
      r.pile_type ?? "",
    ];
    const key = parts.join("|");
    return key || `settlement-row-${rowIndex}`;
  }

  function computeSettlementFinalPenetration({ foundationTop, foundationThickness, blindingThickness, fileTip }) {
    if (!Number.isFinite(foundationTop)) return null;
    if (!Number.isFinite(foundationThickness)) return null;
    if (!Number.isFinite(blindingThickness)) return null;
    if (!Number.isFinite(fileTip)) return null;
    return (foundationTop - foundationThickness - blindingThickness) - fileTip;
  }

  function settlementRecordRowData(enriched, rowIndex) {
    const { record, startEl, finalTip } = enriched;
    const strOrDash = (v) => {
      if (v == null) return "-";
      const s = String(v).trim();
      return s || "-";
    };
    const rowKey = buildSettlementRowKey(enriched, rowIndex);
    const manual = constructionState.settlementManualByKey?.[rowKey] || {};
    const parkingUnified = getSingleParkingOutlineNorm();
    const normLoc = recordLocationForPdamMatch(record.location, parkingUnified);
    const buildingFoundationTop = findFoundationTopOverrideForNormLocation(normLoc);
    let foundationTop;
    let foundationTopCellTitle = "";
    if (Object.prototype.hasOwnProperty.call(manual, "foundationTop")) {
      foundationTop = toFiniteNumberOrNull(manual.foundationTop);
    } else {
      const cid = record?.circle_id || record?.circleId || "";
      const pileTopOv = cid ? numericFromPerPileMapWithTwins(constructionState.foundationTopByPileId, cid) : null;
      if (pileTopOv != null) {
        foundationTop = pileTopOv;
        foundationTopCellTitle = "말뚝별 기초골조 상단레벨";
      } else {
        foundationTop =
          buildingFoundationTop != null && Number.isFinite(buildingFoundationTop) ? buildingFoundationTop : null;
        if (foundationTop != null && Number.isFinite(foundationTop)) {
          foundationTopCellTitle = "동·주차장 설정의 기초골조 상단레벨 기본값";
        }
      }
    }
    const foundationThicknessFromMapMm = getFoundationThicknessMm(record?.circle_id || record?.circleId || "");
    const foundationThicknessDefaultM = Number.isFinite(foundationThicknessFromMapMm)
      ? Number(foundationThicknessFromMapMm) / 1000
      : null;
    const elevatorPitOffsetM = getFoundationPitOffsetM(record?.circle_id || record?.circleId || "");
    const foundationThickness = Object.prototype.hasOwnProperty.call(manual, "foundationThickness")
      ? toFiniteNumberOrNull(manual.foundationThickness)
      : foundationThicknessDefaultM;
    const { blindingThickness, headTrimTopLevel, remainingBase } = getSettlementDefaults();
    const adjustedFoundationTop = Number.isFinite(foundationTop) && Number.isFinite(elevatorPitOffsetM)
      ? foundationTop - elevatorPitOffsetM
      : foundationTop;
    const computedHeadTrimTopLevel = Number.isFinite(adjustedFoundationTop)
      && Number.isFinite(foundationThickness)
      && Number.isFinite(blindingThickness)
      ? adjustedFoundationTop - foundationThickness - blindingThickness
      : null;
    const finalPenetration = computeSettlementFinalPenetration({
      foundationTop: adjustedFoundationTop,
      foundationThickness,
      blindingThickness,
      fileTip: toFiniteNumberOrNull(finalTip),
    });
    const lengthMetrics = computeSettlementLengthMetrics({
      penetrationDepth: toFiniteNumberOrNull(record.penetration_depth),
      pileRemaining: toFiniteNumberOrNull(record.pile_remaining),
      finalPenetration,
      remainingBase,
    });
    const remark = Number.isFinite(elevatorPitOffsetM) && elevatorPitOffsetM > 0
      ? `엘레베이터 피트(${formatMetric(elevatorPitOffsetM, 3)}m)`
      : "";
    const cells = [
      formatDateWithWeekday(record.construction_date),
      strOrDash(record.equipment),
      strOrDash(record.pile_type),
      strOrDash(record.construction_method),
      strOrDash(record.location),
      formatDisplayedPileNumber(record.pile_number),
      startEl != null ? formatMetric(startEl, 3) : "-",
      record.penetration_depth != null ? formatMetric(record.penetration_depth, 2) : "-",
      finalTip != null ? formatMetric(finalTip, 3) : "-",
      record.pile_remaining != null ? formatMetric(record.pile_remaining, 2) : "-",
      record.excavation_depth != null ? formatMetric(record.excavation_depth, 2) : "-",
      foundationTop != null ? formatMetric(foundationTop, 3) : "",
      foundationThickness != null ? formatMetric(foundationThickness, 3) : "",
      formatMetric(blindingThickness, 2),
      computedHeadTrimTopLevel != null ? formatMetric(computedHeadTrimTopLevel, 3) : "",
      finalPenetration != null ? formatMetric(finalPenetration, 3) : "",
      lengthMetrics.targetLength != null ? formatMetric(lengthMetrics.targetLength, 3) : "",
      lengthMetrics.leftoverPositive != null ? formatMetric(lengthMetrics.leftoverPositive, 3) : "",
      remark,
    ];
    return {
      rowKey,
      foundationTop,
      foundationTopCellTitle,
      foundationThickness,
      blindingThickness,
      headTrimTopLevel,
      computedHeadTrimTopLevel,
      finalPenetration,
      remainingBase,
      originalLength: lengthMetrics.originalLength,
      targetLength: lengthMetrics.targetLength,
      leftoverLengthRaw: lengthMetrics.leftoverRaw,
      leftoverLengthPositive: lengthMetrics.leftoverPositive,
      elevatorPitOffsetM,
      remark,
      cells,
    };
  }

  function refreshSettlementHeadTrimHeader() {
    if (!constructionSettlementHeadTrimHeader) return;
    const configured = getSettlementHeadTrimConfiguredLabel();
    constructionSettlementHeadTrimHeader.innerHTML = `두부정리<br>상단레벨<br><span class="construction-records-th-sub">(${configured})</span>`;
    if (constructionSettlementTargetPenetrationHeader) {
      const remainingBaseLabel = getSettlementRemainingBaseConfiguredLabel();
      constructionSettlementTargetPenetrationHeader.innerHTML = `최종근입+잔량기준<br><span class="construction-records-th-sub">(${remainingBaseLabel})</span>`;
    }
  }

  function settlementRecordRowPlainCells(enriched, rowIndex) {
    return settlementRecordRowData(enriched, rowIndex).cells;
  }

  function syncSettlementSettingInputsFromState() {
    const { blindingThickness, headTrimTopLevel, remainingBase } = getSettlementDefaults();
    if (constructionSettlementBlindingThickness) constructionSettlementBlindingThickness.value = String(blindingThickness);
    if (constructionSettlementHeadTrimLevel) constructionSettlementHeadTrimLevel.value = String(headTrimTopLevel);
    if (constructionSettlementRemainingBase) constructionSettlementRemainingBase.value = String(remainingBase);
    refreshSettlementHeadTrimHeader();
  }

  function rerenderSettlementTableFromState() {
    const records = (constructionState.lastSettlementRecordRows || []).map((item) => item?.record).filter(Boolean);
    if (!records.length) return;
    renderRecordsTable(records);
  }

  function applySettlementManualSettings() {
    const blinding = toFiniteNumberOrNull(constructionSettlementBlindingThickness?.value);
    const headTrim = toFiniteNumberOrNull(constructionSettlementHeadTrimLevel?.value);
    const remainingBase = toFiniteNumberOrNull(constructionSettlementRemainingBase?.value);
    if (blinding == null || headTrim == null || remainingBase == null) {
      const errMsg = "버림콘 두께, 두부정리 상단레벨, 잔량기준은 숫자로 입력해주세요.";
      setSyncStatus(errMsg, true);
      showSettlementCopyFeedback(errMsg, true);
      syncSettlementSettingInputsFromState();
      return;
    }
    constructionState.settlementDefaults = {
      blindingThickness: blinding,
      headTrimTopLevel: headTrim,
      remainingBase,
    };
    rerenderSettlementTableFromState();
    const okMsg = "설정값을 기성 정리표에 적용했습니다.";
    setSyncStatus(okMsg, false);
    showSettlementCopyFeedback(okMsg, false);
  }

  async function copySettlementRecordsToClipboard() {
    const rows = constructionState.lastSettlementRecordRows || [];
    if (!rows.length) {
      const msg = "복사할 기성 정리표 데이터가 없습니다.";
      setSyncStatus(msg, true);
      showSettlementCopyFeedback(msg, true);
      return;
    }
    const lines = [getSettlementTableHeaderLabels().map(escapeTsvCell).join("\t")];
    rows.forEach((enriched, rowIndex) => {
      lines.push(settlementRecordRowPlainCells(enriched, rowIndex).map(escapeTsvCell).join("\t"));
    });
    const tsv = `${lines.join("\n")}\n`;
    try {
      await copyTextWithFallback(tsv);
      const okMsg = "복사되었습니다. 엑셀에 붙여넣기 하세요.";
      setSyncStatus(okMsg, false);
      showSettlementCopyFeedback(okMsg, false);
    } catch (err) {
      console.error(err);
      const errMsg = "복사에 실패했습니다. 브라우저 권한 또는 보안 연결(HTTPS)을 확인하세요.";
      setSyncStatus(errMsg, true);
      showSettlementCopyFeedback(errMsg, true);
    }
  }

  function sanitizeDownloadFileBase(name) {
    const s = String(name || "").trim() || "기성정리표";
    return s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80);
  }

  function formatGapjiMonthTitle(monthPart) {
    const text = String(monthPart || "").trim();
    const m = text.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return `${Number(m[2])}월 기성 정리`;
    const m2 = text.match(/^(\d{1,2})$/);
    if (m2) return `${Number(m2[1])}월 기성 정리`;
    return text ? `${text} 기성 정리` : "기성 정리";
  }

  function appendGapjiWorksheet(workbook, summaryRows, monthPart, detailSheetName, detailLastRow) {
    const ws = workbook.addWorksheet("갑지");
    const methodSet = new Set();
    summaryRows.forEach((row) => {
      Object.keys(row.methodTotals || {}).forEach((method) => methodSet.add(method));
    });
    const methods = Array.from(methodSet).sort((a, b) => a.localeCompare(b, "ko"));
    const headers = ["동/지하주차장", "시공본수", ...methods, "근입량 합계"];
    const colCount = headers.length;

    ws.addRow([formatGapjiMonthTitle(monthPart)]);
    if (colCount > 1) ws.mergeCells(1, 1, 1, colCount);
    ws.addRow(headers);

    summaryRows.forEach((row) => {
      const methodValues = methods.map((method) => row.methodTotals[method] ?? 0);
      ws.addRow([row.location, row.count, ...methodValues, row.totalFinalPenetration]);
    });

    const totalMethodTotals = methods.map(
      (method) => summaryRows.reduce((sum, row) => sum + (Number(row.methodTotals[method]) || 0), 0),
    );
    const totalCount = summaryRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    const totalPenetration = summaryRows.reduce((sum, row) => sum + (Number(row.totalFinalPenetration) || 0), 0);
    ws.addRow(["합계", totalCount, ...totalMethodTotals, totalPenetration]);

    const titleRow = ws.getRow(1);
    titleRow.height = 28;
    titleRow.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
    titleRow.alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };

    const thinBorder = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };

    const headerRowIdx = 2;
    const dataStart = 3;
    const totalRowIdx = ws.rowCount;

    for (let c = 1; c <= colCount; c += 1) {
      const cell = ws.getRow(headerRowIdx).getCell(c);
      cell.font = { bold: true, color: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder;
      if (c <= 2) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      } else if (c === colCount) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
      }
    }

    for (let r = dataStart; r <= totalRowIdx; r += 1) {
      for (let c = 1; c <= colCount; c += 1) {
        const cell = ws.getRow(r).getCell(c);
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" };
        if (r === totalRowIdx) {
          cell.font = { bold: true, color: { argb: "FF111827" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        }
        if (c >= 3) cell.numFmt = "#,##0.000";
        if (c === 2) cell.numFmt = "#,##0";
      }
    }

    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 10;
    for (let c = 3; c < colCount; c += 1) {
      ws.getColumn(c).width = 13;
    }
    ws.getColumn(colCount).width = 14;

    const summaryLabelRow = ws.rowCount + 2;
    ws.getCell(summaryLabelRow, 1).value = "전체 잔량 합계 (m)";
    if (Number.isFinite(Number(detailLastRow)) && Number(detailLastRow) >= 2) {
      const safeSheetName = String(detailSheetName || "기성정리표").replace(/'/g, "''");
      ws.getCell(summaryLabelRow, 2).value = {
        formula: `IFERROR(SUM('${safeSheetName}'!R2:R${Number(detailLastRow)}),0)`,
      };
    } else {
      ws.getCell(summaryLabelRow, 2).value = 0;
    }
    ws.mergeCells(summaryLabelRow, 2, summaryLabelRow, colCount);
    ws.getRow(summaryLabelRow).height = 22;
    ws.getCell(summaryLabelRow, 1).font = { bold: true, color: { argb: "FF0F172A" } };
    ws.getCell(summaryLabelRow, 2).font = { bold: true, color: { argb: "FF0F172A" } };
    ws.getCell(summaryLabelRow, 1).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(summaryLabelRow, 2).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(summaryLabelRow, 2).numFmt = "#,##0.000";
    ws.getCell(summaryLabelRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    ws.getCell(summaryLabelRow, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    ws.getCell(summaryLabelRow, 1).border = thinBorder;
    ws.getCell(summaryLabelRow, 2).border = thinBorder;
  }

  async function downloadSettlementRecordsXlsx() {
    const rows = constructionState.lastSettlementRecordRows || [];
    if (!rows.length) {
      const msg = "다운로드할 기성 정리표 데이터가 없습니다.";
      setSyncStatus(msg, true);
      showSettlementCopyFeedback(msg, true);
      return;
    }
    const EXCELJS_GLOBAL = typeof globalThis !== "undefined" && globalThis.ExcelJS;
    if (!EXCELJS_GLOBAL || typeof EXCELJS_GLOBAL.Workbook !== "function") {
      const errMsg = "엑셀 라이브러리를 불러오지 못했습니다. 페이지를 새로고침 후 다시 시도하세요.";
      setSyncStatus(errMsg, true);
      showSettlementCopyFeedback(errMsg, true);
      return;
    }
    try {
      const wb = new EXCELJS_GLOBAL.Workbook();
      const ws = wb.addWorksheet("기성정리표");
      ws.columns = getSettlementTableHeaderXlsx().map((header) => ({ header, width: 14 }));
      ws.getRow(1).height = 52;
      const summaryByLocation = new Map();
      const parkingUnifiedXlsx = getSingleParkingOutlineNorm();
      rows.forEach((enriched, rowIndex) => {
        const rowData = settlementRecordRowData(enriched, rowIndex);
        const startElevation = Number.isFinite(Number(enriched?.startEl)) ? Number(enriched.startEl) : null;
        const penetrationDepth = Number.isFinite(Number(enriched?.record?.penetration_depth))
          ? Number(enriched.record.penetration_depth)
          : null;
        const pileRemaining = Number.isFinite(Number(enriched?.record?.pile_remaining))
          ? Number(enriched.record.pile_remaining)
          : null;
        const excavationDepth = Number.isFinite(Number(enriched?.record?.excavation_depth))
          ? Number(enriched.record.excavation_depth)
          : null;
        const remainingBaseExpr = Number(rowData.remainingBase || 0).toFixed(6);
        const added = ws.addRow([
          rowData.cells[0],
          rowData.cells[1],
          rowData.cells[2],
          rowData.cells[3],
          rowData.cells[4],
          rowData.cells[5],
          startElevation,
          penetrationDepth,
          null,
          pileRemaining,
          excavationDepth,
          rowData.foundationTop,
          rowData.foundationThickness,
          rowData.blindingThickness,
          null,
          null,
          null,
          null,
          rowData.remark || "",
        ]);
        added.getCell(9).value = {
          formula: `IFERROR(IF(OR(G${added.number}="",H${added.number}=""),"",ROUND(G${added.number}-H${added.number},3)),"")`,
        };
        const pitOffset = Number.isFinite(Number(rowData.elevatorPitOffsetM)) ? Number(rowData.elevatorPitOffsetM) : 0;
        const pitOffsetExpr = pitOffset.toFixed(6);
        added.getCell(15).value = {
          formula: `IFERROR(IF(OR(L${added.number}="",M${added.number}="",N${added.number}="",I${added.number}=""),"",ROUND(L${added.number}-${pitOffsetExpr}-M${added.number}-N${added.number},3)),"")`,
        };
        added.getCell(16).value = {
          formula: `IFERROR(IF(OR(L${added.number}="",M${added.number}="",N${added.number}="",I${added.number}=""),"",ROUND((L${added.number}-${pitOffsetExpr}-M${added.number}-N${added.number})-I${added.number},3)),"")`,
        };
        added.getCell(17).value = {
          formula: `IFERROR(IF(P${added.number}="","",ROUND(P${added.number}+${remainingBaseExpr},3)),"")`,
        };
        added.getCell(18).value = {
          formula: `IFERROR(IF(OR(H${added.number}="",J${added.number}="",Q${added.number}=""),"",ROUND(MAX(0,(H${added.number}+J${added.number})-Q${added.number}),3)),"")`,
        };

        const location = recordLocationForPdamMatch(enriched?.record?.location, parkingUnifiedXlsx);
        const method = String(enriched?.record?.construction_method || "미분류").trim() || "미분류";
        const finalPenetration = roundMetricValue(rowData.finalPenetration, 3);
        if (!summaryByLocation.has(location)) {
          summaryByLocation.set(location, {
            location,
            count: 0,
            methodTotals: {},
            totalFinalPenetration: 0,
          });
        }
        const bucket = summaryByLocation.get(location);
        bucket.count += 1;
        bucket.methodTotals[method] = (bucket.methodTotals[method] || 0) + (Number.isFinite(finalPenetration) ? finalPenetration : 0);
        bucket.totalFinalPenetration += Number.isFinite(finalPenetration) ? finalPenetration : 0;
      });
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      const thinBorder = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
      for (let r = 1; r <= ws.rowCount; r += 1) {
        const row = ws.getRow(r);
        for (let c = 1; c <= 19; c += 1) {
          const cell = row.getCell(c);
          cell.border = thinBorder;
          if (r === 1) {
            cell.font = { bold: true, color: { argb: "FF1E3A8A" } };
            cell.fill = headerFill;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          } else {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            if (c === 16 || c === 17 || c === 18) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
            }
          }
        }
      }
      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 11;
      ws.getColumn(3).width = 11;
      ws.getColumn(4).width = 11;
      ws.getColumn(5).width = 10;
      ws.getColumn(6).width = 11;
      ws.getColumn(7).width = 12;
      ws.getColumn(8).width = 10;
      ws.getColumn(9).width = 14;
      ws.getColumn(10).width = 10;
      ws.getColumn(11).width = 9;
      ws.getColumn(12).width = 13;
      ws.getColumn(13).width = 11;
      ws.getColumn(14).width = 11;
      ws.getColumn(15).width = 13;
      ws.getColumn(16).width = 14;
      ws.getColumn(17).width = 14;
      ws.getColumn(18).width = 14;
      ws.getColumn(19).width = 20;
      const monthPart = constructionSettlementMonth?.value?.trim();
      const detailLastRow = ws.rowCount;
      const summaryRows = Array.from(summaryByLocation.values()).sort((a, b) => a.location.localeCompare(b.location, "ko"));
      appendGapjiWorksheet(wb, summaryRows, monthPart, ws.name, detailLastRow);
      const base = monthPart ? `기성정리표_${monthPart}` : "기성정리표";
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeDownloadFileBase(base)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const okMsg = "XLSX로 저장되었습니다.";
      setSyncStatus(okMsg, false);
      showSettlementCopyFeedback(okMsg, false);
    } catch (err) {
      console.error(err);
      const errMsg = "파일 저장에 실패했습니다.";
      setSyncStatus(errMsg, true);
      showSettlementCopyFeedback(errMsg, true);
    }
  }

  function renderRecordsTable(records) {
    if (!constructionRecordsBody) return;
    if (!records || !records.length) {
      constructionState.lastSettlementRecordRows = [];
      renderSettlementLengthSummary([]);
      constructionRecordsBody.innerHTML =
        '<tr><td colspan="19" class="empty-row">기성 데이터가 없습니다.</td></tr>';
      return;
    }
    const enriched = buildSettlementRecordsRows(records);
    constructionState.lastSettlementRecordRows = enriched;
    renderSettlementLengthSummary(enriched);
    constructionRecordsBody.innerHTML = enriched
      .map((rowEnriched, rowIndex) => {
        const rowData = settlementRecordRowData(rowEnriched, rowIndex);
        const { cells } = rowData;
        const { startElBasis, finalDetail } = rowEnriched;
        const startTitle = [startElBasis].filter(Boolean).join(" · ");
        const finalTitle = finalDetail || "천공시작지반고 − 관입깊이 (값 없음 시 계산 생략)";
        const ph = (i) =>
          `<td class="construction-records-placeholder">${cells[i] === "" ? " " : escape(cells[i])}</td>`;
        const fixed = (i) =>
          `<td>${cells[i] === "" ? " " : escape(cells[i])}</td>`;
        const rowKeyAttr = encodeURIComponent(rowData.rowKey);
        const editable = (field, value, cellTitle = "") =>
          `<td class="construction-records-editable" contenteditable="true" data-manual-field="${field}" data-row-key="${rowKeyAttr}"${cellTitle ? ` title="${escape(cellTitle)}"` : ""}>${value === "" ? " " : escape(value)}</td>`;
        return `<tr>
        <td>${escape(cells[0])}</td>
        <td>${escape(cells[1])}</td>
        <td>${escape(cells[2])}</td>
        <td>${escape(cells[3])}</td>
        <td>${escape(cells[4])}</td>
        <td>${escape(cells[5])}</td>
        <td title="${escape(startTitle)}">${escape(cells[6])}</td>
        <td>${escape(cells[7])}</td>
        <td title="${escape(finalTitle)}">${escape(cells[8])}</td>
        <td>${escape(cells[9])}</td>
        <td>${escape(cells[10])}</td>
        ${editable("foundationTop", cells[11], rowData.foundationTopCellTitle || "")}${editable("foundationThickness", cells[12])}${fixed(13)}${fixed(14)}
        <td${cells[15] === "" ? ' class="construction-records-placeholder"' : ""}>${cells[15] === "" ? " " : escape(cells[15])}</td>
        <td${cells[16] === "" ? ' class="construction-records-placeholder"' : ""}>${cells[16] === "" ? " " : escape(cells[16])}</td>
        <td${cells[17] === "" ? ' class="construction-records-placeholder"' : ""}>${cells[17] === "" ? " " : escape(cells[17])}</td>
        <td${cells[18] === "" ? ' class="construction-records-placeholder"' : ""}>${cells[18] === "" ? " " : escape(cells[18])}</td>
      </tr>`;
      })
      .join("");
  }

  function renderSettlementLengthSummary(enrichedRows) {
    if (!constructionSettlementLengthSummary) return;
    if (!Array.isArray(enrichedRows) || !enrichedRows.length) {
      constructionSettlementLengthSummary.innerHTML =
        '<div class="empty-row">기성 데이터를 불러오면 길이 합계가 표시됩니다.</div>';
      return;
    }
    const round3 = (value) => {
      if (!Number.isFinite(Number(value))) return null;
      return Math.round(Number(value) * 1000) / 1000;
    };
    let originalTotal = 0;
    let targetTotal = 0;
    let leftoverTotal = 0;
    let validCount = 0;
    let remainingBase = null;
    enrichedRows.forEach((enriched, rowIndex) => {
      const rowData = settlementRecordRowData(enriched, rowIndex);
      if (remainingBase == null && Number.isFinite(Number(rowData.remainingBase))) {
        remainingBase = Number(rowData.remainingBase);
      }
      const originalRounded = round3(rowData.originalLength);
      const targetRounded = round3(rowData.targetLength);
      const leftoverRounded = round3(rowData.leftoverLengthPositive);
      if (!Number.isFinite(originalRounded) || !Number.isFinite(targetRounded)) return;
      validCount += 1;
      originalTotal += originalRounded;
      targetTotal += targetRounded;
      if (Number.isFinite(leftoverRounded)) {
        leftoverTotal += leftoverRounded;
      } else {
        leftoverTotal += Math.max(originalRounded - targetRounded, 0);
      }
    });
    if (!validCount) {
      constructionSettlementLengthSummary.innerHTML =
        '<div class="empty-row">원래길이(관입깊이+파일잔량) 계산 가능한 데이터가 없습니다.</div>';
      return;
    }
    const baseText = Number.isFinite(Number(remainingBase)) ? formatMetric(remainingBase, 2) : "0.50";
    constructionSettlementLengthSummary.innerHTML = `<table class="construction-records-table construction-summary-table construction-settlement-length-summary-table">
      <thead><tr><th>계산대상(본)</th><th>원래길이 합계<br><span class="construction-records-th-sub">(관입깊이+파일잔량)</span></th><th>공제값 합계<br><span class="construction-records-th-sub">(최종근입+잔량기준 ${escape(baseText)}m)</span></th><th>남은 길이 합계<br><span class="construction-records-th-sub">(원래길이−공제값, 0 이상)</span></th></tr></thead>
      <tbody><tr><td>${validCount}</td><td>${formatMetric(originalTotal, 3)}</td><td>${formatMetric(targetTotal, 3)}</td><td>${formatMetric(leftoverTotal, 3)}</td></tr></tbody>
    </table>`;
  }

  function buildSettlementMethodSummaryRows() {
    const enrichedRows = constructionState.lastSettlementRecordRows || [];
    const byMethod = new Map();
    enrichedRows.forEach((enriched, rowIndex) => {
      const methodKey = String(enriched?.record?.construction_method || "미분류").trim() || "미분류";
      if (!byMethod.has(methodKey)) {
        byMethod.set(methodKey, {
          key: methodKey,
          uniquePileCount: 0,
          totalPenetrationDepth: 0,
          totalRemaining: 0,
          remainingCount: 0,
          totalFinalPenetration: 0,
        });
      }
      const bucket = byMethod.get(methodKey);
      bucket.uniquePileCount += 1;
      const penetration = roundMetricValue(enriched?.record?.penetration_depth, 3);
      if (Number.isFinite(penetration)) bucket.totalPenetrationDepth += penetration;
      const remaining = roundMetricValue(enriched?.record?.pile_remaining, 3);
      if (Number.isFinite(remaining)) {
        bucket.totalRemaining += remaining;
        bucket.remainingCount += 1;
      }
      const rowData = settlementRecordRowData(enriched, rowIndex);
      const finalPen = roundMetricValue(rowData?.finalPenetration, 3);
      if (Number.isFinite(finalPen)) bucket.totalFinalPenetration += finalPen;
    });
    return Array.from(byMethod.values())
      .sort((a, b) => a.key.localeCompare(b.key, "ko"))
      .map((row) => ({
        ...row,
        avgRemaining: row.remainingCount ? row.totalRemaining / row.remainingCount : null,
      }));
  }

  function renderSettlementMethodTable() {
    if (!constructionSettlementMethodBody) return;
    const rows = buildSettlementMethodSummaryRows();
    if (!rows.length) {
      constructionSettlementMethodBody.innerHTML = '<tr><td colspan="6" class="empty-row">월별 공법 정리 데이터가 없습니다.</td></tr>';
      return;
    }
    constructionSettlementMethodBody.innerHTML = rows
      .map((row) => {
        return `<tr><td>${escape(row.key)}</td><td>${row.uniquePileCount ?? 0}</td><td>${formatMetric(row.totalPenetrationDepth, 3)}</td><td>${formatMetric(row.totalFinalPenetration, 3)}</td><td>${formatMetric(row.totalRemaining, 3)}</td><td>${row.avgRemaining != null ? formatMetric(row.avgRemaining, 3) : "-"}</td></tr>`;
      })
      .join("");
  }

  function renderSettlementLocationTable(rows) {
    if (!constructionSettlementLocationBody) return;
    if (!rows || !rows.length) {
      constructionSettlementLocationBody.innerHTML = '<tr><td colspan="5" class="empty-row">부위별 진행 현황이 없습니다.</td></tr>';
      return;
    }
    constructionSettlementLocationBody.innerHTML = rows.map((row) => `<tr><td>${escape(row.location || "미지정")}</td><td>${row.periodInstalledCount ?? 0}</td><td>${row.cumulativeInstalledCount ?? 0}</td><td>${row.totalPlannedCount ?? "-"}</td><td>${row.progressPercent != null ? `${formatMetric(row.progressPercent, 1)}%` : "-"}</td></tr>`).join("");
  }

  function renderProjectContext() {
    const eligible = hasSavedWorkContext();
    const projectName = eligible
      ? (state.loadedWorkMeta?.project || (typeof getActiveProjectName === "function" ? getActiveProjectName() : (state.loadedProjectName || "기본")))
      : "-";
    const sourceType = state.loadedWorkMeta?.sourceType || state.loadedProjectSourceType || "contractor_original";
    const workTitle = eligible
      ? (state.loadedWorkMeta?.title || state.loadedProjectName || "현재 화면 데이터")
      : "작업/프로젝트 데이터 필요";
    constructionProjectName.textContent = projectName || "-";
    constructionProjectMeta.textContent = eligible
      ? `소스: ${sourceType}${state.circles?.length ? ` · 좌표 ${state.circles.length}개` : ""} · PDAM 데이터셋은 이 프로젝트에만 연결됩니다.`
      : "불러온 작업 또는 신규 저장한 작업을 기준으로 PDAM을 자동 매칭합니다.";
    constructionWorkTitle.textContent = workTitle;
    constructionWorkMeta.textContent = eligible
      ? (state.loadedWorkId ? `작업 ID: ${state.loadedWorkId}` : "작업 ID 없이 현재 화면 좌표 기준")
      : "프로젝트 또는 작업을 불러오고 파일 좌표가 있어야 활성화됩니다.";
  }

  function clearDashboardView(message = "데이터셋을 선택하면 시공 데이터가 표시됩니다.") {
    clearPlaybackState({ redraw: false });
    constructionState.dashboard = null;
    constructionState.overlayMap = new Map();
    constructionState.viewerOverlayEnabled = false;
    constructionState.legendItems = [];
    constructionState.legendFilterKey = "";
    constructionState.selectedEquipments = [];
    constructionState.selectedMethods = [];
    constructionState.selectedLocations = [];
    constructionState.settlementPreviewOnly = false;

    fillSelect(constructionDateFrom, [], null, null);
    fillSelect(constructionDateTo, [], null, null);
    fillSelect(constructionMonth, [], null, "전체 기간");
    fillSelect(constructionWeek, [], null, "월 먼저 선택");
    fillSelect(constructionSettlementMonth, [], null, null);
    constructionWeek.disabled = true;

    renderChipGroup(constructionEquipmentChips, [], [], "equipments");
    renderChipGroup(constructionMethodChips, [], [], "methods");
    renderChipGroup(constructionLocationChips, [], [], "locations");

    constructionDateRangeNote.textContent = message;
    updatePlaybackStatus();
    updateSettlementPreviewButton();
    constructionSettlementPeriod.textContent = "-";
    constructionSettlementPeriodNote.textContent = "기성 범위를 계산하지 못했습니다.";
    constructionSummaryRecords.textContent = "-";
    constructionSummaryUnique.textContent = "-";
    if (constructionSummaryInstalledPiles) constructionSummaryInstalledPiles.textContent = "-";
    constructionSummaryMatched.textContent = "-";
    if (constructionSummaryAutoMatched) constructionSummaryAutoMatched.textContent = "-";
    constructionSummaryPending.textContent = "-";
    constructionSummaryRemaining.textContent = "-";
    constructionSummaryThreshold.textContent = "-";
    constructionSettlementUnique.textContent = "-";
    constructionSettlementPenetration.textContent = "-";
    constructionSettlementRemaining.textContent = "-";
    constructionSettlementThreshold.textContent = "-";

    renderLegend();
    renderBarChart(constructionChartByMonth, [], "");
    renderBarChart(constructionChartByEquipment, [], "");
    renderBarChart(constructionChartByMethod, [], "");
    renderLineChart(constructionChartByDate, [], "uniquePileCount", "tone-status");
    renderLineChart(constructionChartSettlementFlow, [], "uniquePileCount", "tone-settlement");
    renderMethodMatrix(null);
    renderConstructionDiagnostics(null);
    renderRecordsTable([]);
    renderSettlementMethodTable();
    renderSettlementLocationTable([]);

    renderProjectContext();
    updateDatasetActionButtons();
    refreshFoundationPanel();
    updateCircleTable();
    requestRedraw();
  }

  function updateConstructionButtonsState() {
    const enabled = hasSavedWorkContext();
    [constructionFoundationThicknessBtn, constructionStatusBtn, constructionSettlementBtn].forEach((button) => {
      button.disabled = !enabled;
      button.title = enabled ? "" : "프로젝트/작업 불러오기 + 파일 좌표가 필요합니다.";
    });
    if (!enabled && constructionState.isOpen) {
      closeConstructionDrawer();
    }
    renderProjectContext();
  }

  function renderDashboard(dashboard) {
    clearPlaybackState({ redraw: false });
    constructionState.dashboard = dashboard;
    constructionState.overlayMap = new Map(((dashboard?.mapping?.circleMappings) || []).map((item) => [item.circleId, item]));
    constructionState.activeDatasetId = dashboard?.dataset?.id || constructionState.activeDatasetId;
    if (constructionDatasetSelect && constructionState.activeDatasetId && [...constructionDatasetSelect.options].some((option) => option.value === constructionState.activeDatasetId)) {
      constructionDatasetSelect.value = constructionState.activeDatasetId;
    }
    constructionState.selectedEquipments = [...(dashboard?.filters?.applied?.equipments || [])];
    constructionState.selectedMethods = [...(dashboard?.filters?.applied?.methods || [])];
    constructionState.selectedLocations = [...(dashboard?.filters?.applied?.locations || [])];
    constructionState.overlayMode = constructionOverlayMode.value || "status";

    fillSelect(constructionDateFrom, dashboard?.filters?.options?.dates || [], dashboard?.filters?.applied?.dateFrom, null);
    fillSelect(constructionDateTo, dashboard?.filters?.options?.dates || [], dashboard?.filters?.applied?.dateTo, null);
    fillSelect(constructionMonth, dashboard?.filters?.options?.months || [], dashboard?.filters?.applied?.month, "전체 기간");
    refreshWeekSelect(dashboard?.filters?.applied?.dateFrom, dashboard?.filters?.applied?.dateTo);
    fillSelect(constructionSettlementMonth, dashboard?.filters?.options?.months || [], dashboard?.filters?.applied?.settlementMonth, null);

    constructionRemainingThreshold.value = dashboard?.filters?.applied?.remainingThreshold ?? constructionRemainingThreshold.value;
    constructionSettlementStartDay.value = dashboard?.filters?.applied?.settlementStartDay ?? constructionSettlementStartDay.value;
    constructionSettlementEndDay.value = dashboard?.filters?.applied?.settlementEndDay ?? constructionSettlementEndDay.value;

    renderChipGroup(constructionEquipmentChips, dashboard?.filters?.options?.equipments || [], constructionState.selectedEquipments, "equipments");
    renderChipGroup(constructionMethodChips, dashboard?.filters?.options?.methods || [], constructionState.selectedMethods, "methods");
    renderChipGroup(constructionLocationChips, dashboard?.filters?.options?.locations || [], constructionState.selectedLocations, "locations");

    const dateBounds = dashboard?.filters?.options?.dateBounds || {};
    constructionDateRangeNote.textContent = dateBounds.min && dateBounds.max ? `데이터 ${dateBounds.min} ~ ${dateBounds.max}` : "날짜 범위를 불러오지 못했습니다.";

    updatePlaybackStatus();
    rebuildLegend();
    renderLegend();

    constructionSummaryRecords.textContent = dashboard?.summary?.recordCount ?? "-";
    constructionSummaryUnique.textContent = dashboard?.summary?.uniquePileCount ?? "-";
    if (constructionSummaryInstalledPiles) {
      constructionSummaryInstalledPiles.textContent = dashboard?.summary?.installedPileCount ?? "-";
    }
    constructionSummaryMatched.textContent = dashboard?.summary?.matchedCircleCount ?? "-";
    if (constructionSummaryAutoMatched) constructionSummaryAutoMatched.textContent = dashboard?.summary?.autoMatchedCount ?? "-";
    constructionSummaryPending.textContent = dashboard?.summary?.pendingCircleCount ?? "-";
    constructionSummaryRemaining.textContent = dashboard?.summary?.totalRemaining != null ? formatMetric(dashboard.summary.totalRemaining, 2) : "-";
    constructionSummaryThreshold.textContent = dashboard?.summary?.overThresholdCount ?? "-";

    renderLineChart(constructionChartByDate, dashboard?.charts?.byDate || [], "uniquePileCount", "tone-status");
    renderBarChart(constructionChartByMonth, dashboard?.charts?.byMonth || [], "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)");
    renderBarChart(constructionChartByEquipment, dashboard?.charts?.byEquipment || [], "linear-gradient(90deg, #f97316 0%, #fb923c 100%)");
    renderBarChart(constructionChartByMethod, dashboard?.charts?.byMethod || [], "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)");
    renderMethodMatrix(dashboard?.charts?.methodMatrix);
    renderConstructionDiagnostics(dashboard?.diagnostics || null);

    const settlement = dashboard?.settlement || {};
    renderSettlementPeriod(settlement?.period);
    constructionSettlementUnique.textContent = settlement?.summary?.uniquePileCount ?? "-";
    constructionSettlementPenetration.textContent = settlement?.summary?.totalPenetrationDepth != null ? formatMetric(settlement.summary.totalPenetrationDepth, 2) : "-";
    constructionSettlementRemaining.textContent = settlement?.summary?.totalRemaining != null ? formatMetric(settlement.summary.totalRemaining, 2) : "-";
    constructionSettlementThreshold.textContent = settlement?.summary?.overThresholdCount ?? "-";
    constructionSettlementPeriodNote.textContent = settlement?.period?.startDate && settlement?.period?.endDate ? `${settlement.period.startDate} ~ ${settlement.period.endDate}` : "기성 범위를 계산하지 못했습니다.";
    renderLineChart(constructionChartSettlementFlow, settlement?.dailyFlow || [], "uniquePileCount", "tone-settlement");
    renderRecordsTable(settlement?.records || []);
    renderSettlementMethodTable();
    renderSettlementLocationTable(settlement?.locationProgress || []);

    renderProjectContext();
    updateSettlementPreviewButton();
    updateDatasetActionButtons();
    refreshFoundationPanel();
    updateCircleTable();
    requestRedraw();
  }

  function getConstructionProjectContext() {
    return typeof getActiveProjectName === "function" ? getActiveProjectName() : "기본";
  }

  function collectDashboardPayload() {
    const rawCircles = Array.isArray(state.circles) && state.circles.length ? state.circles : [];
    // 전체 원을 보냄 — 서버가 기하 병합 후 매칭하고, 겹치는 형제 원 id마다 오버레이를 복제한다.
    return {
      datasetId: constructionDatasetSelect.value || constructionState.activeDatasetId,
      circles: rawCircles,
      excludeIdenticalGeometryDuplicates: !!(state.filter && state.filter.excludeIdenticalGeometryDuplicates),
      workId: state.loadedWorkId || null,
      dateFrom: constructionDateFrom.value || null,
      dateTo: constructionDateTo.value || null,
      month: constructionMonth.value || null,
      equipments: [...constructionState.selectedEquipments],
      methods: [...constructionState.selectedMethods],
      locations: [...constructionState.selectedLocations],
      remainingThreshold: constructionRemainingThreshold.value ? Number(constructionRemainingThreshold.value) : null,
      settlementMonth: constructionSettlementMonth.value || null,
      settlementStartDay: constructionSettlementStartDay.value ? Number(constructionSettlementStartDay.value) : 25,
      settlementEndDay: constructionSettlementEndDay.value ? Number(constructionSettlementEndDay.value) : 20,
    };
  }

  async function refreshDatasets(preferredId) {
    const pc = encodeURIComponent(getConstructionProjectContext());
    const response = await fetch(`${API_BASE_URL}/api/construction/datasets?project_context=${pc}`);
    const payload = await pilexyParseFetchJson(response);
    constructionState.datasets = Array.isArray(payload) ? payload : [];
    constructionDatasetSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = constructionState.datasets.length ? "시공 데이터셋 선택" : "불러온 데이터셋 없음";
    constructionDatasetSelect.appendChild(placeholder);
    constructionState.datasets.forEach((dataset) => {
      const option = document.createElement("option");
      option.value = dataset.id;
      const proj = dataset.projectContext ? ` · ${dataset.projectContext}` : "";
      option.textContent = `${dataset.name || dataset.filename || dataset.id}${proj} (${dataset.createdAt ? new Date(dataset.createdAt).toLocaleString("ko-KR") : ""})`;
      constructionDatasetSelect.appendChild(option);
    });
    // 기본값은 "현재 프로젝트의 최신 저장 데이터셋"으로 맞춘다.
    const latestDatasetId = constructionState.datasets[0]?.id || "";
    const targetId = [preferredId, latestDatasetId]
      .find((candidate) => candidate && [...constructionDatasetSelect.options].some((option) => option.value === candidate)) || "";
    if (targetId) {
      constructionDatasetSelect.value = targetId;
      constructionState.activeDatasetId = targetId;
    } else {
      constructionDatasetSelect.value = "";
      constructionState.activeDatasetId = "";
    }
    updateDatasetActionButtons();
  }

  async function refreshDashboard() {
    const payload = collectDashboardPayload();
    if (!payload.datasetId) {
      clearDashboardView();
      setSyncStatus("먼저 시공 데이터셋을 선택하세요.", true);
      return;
    }
    constructionState.activeDatasetId = payload.datasetId;
    setSyncStatus("시공 데이터를 불러오는 중입니다.");
    const response = await fetch(`${API_BASE_URL}/api/construction/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await pilexyParseFetchJson(response);
    renderDashboard(data);
    setSyncStatus("시공 데이터가 갱신되었습니다.");
  }

  async function deleteSelectedDataset() {
    const datasetId = constructionDatasetSelect.value || constructionState.activeDatasetId;
    if (!datasetId) {
      setSyncStatus("삭제할 시공 데이터셋을 먼저 선택하세요.", true);
      return;
    }
    const dataset = constructionState.datasets.find((item) => item.id === datasetId);
    const datasetLabel = dataset?.name || dataset?.filename || datasetId;
    if (!window.confirm(`선택한 시공 데이터셋을 삭제할까요?\n${datasetLabel}`)) return;

    if (constructionDatasetApply) constructionDatasetApply.disabled = true;
    if (constructionDatasetDelete) constructionDatasetDelete.disabled = true;
    setSyncStatus("시공 데이터셋을 삭제하는 중입니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/api/construction/datasets/${encodeURIComponent(datasetId)}`, {
        method: "DELETE",
      });
      await pilexyParseFetchJson(response);

      const nextDataset = constructionState.datasets.find((item) => item.id !== datasetId);
      constructionState.activeDatasetId = nextDataset?.id || "";
      await refreshDatasets(constructionState.activeDatasetId);

      if (constructionState.activeDatasetId) {
        setSyncStatus(`데이터셋 삭제 완료: ${datasetLabel}`);
        await refreshDashboard();
      } else {
        clearDashboardView("데이터셋이 없습니다. 새로 동기화하거나 엑셀을 불러오세요.");
        setSyncStatus(`데이터셋 삭제 완료: ${datasetLabel}`);
      }
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    } finally {
      updateDatasetActionButtons();
    }
  }

  async function syncFromPdam() {
    const userId = (constructionUserId.value || "").trim();
    const password = constructionPassword.value || "";
    if (!userId || !password) {
      setSyncStatus("PDAM 아이디와 비밀번호를 입력하세요.", true);
      return;
    }
    constructionSyncBtn.disabled = true;
    setSyncStatus("PDAM 로그인과 기록지 동기화를 진행하는 중입니다.");
    try {
      const reportPageUrl = (constructionReportPageUrl?.value || "").trim();
      const ridRaw = constructionReportId?.value;
      const reportId =
        ridRaw === "" || ridRaw === null || ridRaw === undefined ? null : Number(ridRaw);
      const body = {
        userId,
        password,
        sourceUrl: "https://we8104.com/",
        projectContext: getConstructionProjectContext(),
      };
      if (reportPageUrl) body.reportPageUrl = reportPageUrl;
      if (Number.isFinite(reportId)) body.reportId = reportId;
      const response = await fetch(`${API_BASE_URL}/api/construction/sync-pdam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await pilexyParseFetchJson(response);
      await refreshDatasets(data?.dataset?.id);
      if (data?.dataset?.id) constructionDatasetSelect.value = data.dataset.id;
      await refreshDashboard();
      enableViewerOverlay(`동기화 완료: ${data?.dataset?.name || data?.dataset?.id}`);
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    } finally {
      constructionSyncBtn.disabled = false;
    }
  }

  async function importWorkbookFile(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_context", getConstructionProjectContext());
    setSyncStatus("엑셀 업로드와 시공기록 추출을 진행하는 중입니다.");
    try {
      const response = await fetch(`${API_BASE_URL}/api/construction/import-workbook`, { method: "POST", body: formData });
      const data = await pilexyParseFetchJson(response);
      await refreshDatasets(data?.dataset?.id);
      if (data?.dataset?.id) constructionDatasetSelect.value = data.dataset.id;
      await refreshDashboard();
      enableViewerOverlay(`불러오기 완료: ${data?.dataset?.name || file.name}`);
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    } finally {
      constructionUploadInput.value = "";
    }
  }

  function resetFilters() {
    clearPlaybackState({ redraw: false });
    constructionState.selectedEquipments = [];
    constructionState.selectedMethods = [];
    constructionState.selectedLocations = [];
    constructionState.selectedWeek = "";
    constructionState.legendFilterKey = "";
    constructionState.settlementPreviewOnly = false;
    if (constructionState.dashboard?.filters?.options?.dateBounds?.min) constructionDateFrom.value = constructionState.dashboard.filters.options.dateBounds.min;
    if (constructionState.dashboard?.filters?.options?.dateBounds?.max) constructionDateTo.value = constructionState.dashboard.filters.options.dateBounds.max;
    constructionMonth.value = "";
    refreshWeekSelect();
    constructionOverlayMode.value = "status";
    constructionRemainingThreshold.value = "0";
    if (constructionState.dashboard?.filters?.applied?.settlementMonth) constructionSettlementMonth.value = constructionState.dashboard.filters.applied.settlementMonth;
    constructionSettlementStartDay.value = "25";
    constructionSettlementEndDay.value = "20";
    updateSettlementPreviewButton();
    rebuildLegend();
    renderLegend();
  }

  function toggleSelection(listName, value) {
    if (!value) {
      constructionState[listName] = [];
      return;
    }
    const list = constructionState[listName];
    constructionState[listName] = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function applyMonthPreset() {
    clearPlaybackState({ redraw: false });
    const selectedMonth = constructionMonth.value;
    const dates = constructionState.dashboard?.filters?.options?.dates || [];
    constructionState.selectedWeek = "";
    refreshWeekSelect();
    if (!selectedMonth) {
      const bounds = constructionState.dashboard?.filters?.options?.dateBounds || {};
      if (bounds.min) constructionDateFrom.value = bounds.min;
      if (bounds.max) constructionDateTo.value = bounds.max;
      return;
    }
    const monthDates = dates.filter((value) => String(value).startsWith(selectedMonth));
    if (monthDates.length) {
      constructionDateFrom.value = monthDates[0];
      constructionDateTo.value = monthDates[monthDates.length - 1];
    }
  }

  function applyWeekPreset() {
    clearPlaybackState({ redraw: false });
    const selectedMonth = constructionMonth.value;
    constructionState.selectedWeek = constructionWeek.value || "";
    if (!selectedMonth) {
      constructionState.selectedWeek = "";
      refreshWeekSelect();
      return;
    }

    const dates = constructionState.dashboard?.filters?.options?.dates || [];
    const monthDates = dates.filter((value) => String(value).startsWith(selectedMonth));
    if (!monthDates.length) return;

    if (!constructionState.selectedWeek) {
      constructionDateFrom.value = monthDates[0];
      constructionDateTo.value = monthDates[monthDates.length - 1];
      return;
    }

    const selectedOption = constructionState.weekOptions.find((option) => option.value === constructionState.selectedWeek);
    if (!selectedOption) return;
    constructionDateFrom.value = selectedOption.startDate;
    constructionDateTo.value = selectedOption.endDate;
  }

  async function ensureDatasetsAndDashboard() {
    if (!hasSavedWorkContext()) {
      throw new Error("시공현황과 기성정리는 저장한 작업 또는 불러온 작업을 기준으로만 사용할 수 있습니다.");
    }
    await refreshDatasets();
    if (constructionDatasetSelect.value || constructionState.activeDatasetId) {
      await refreshDashboard();
    } else {
      clearDashboardView("데이터셋이 없습니다. 새로 동기화하거나 엑셀을 불러오세요.");
    }
    renderProjectContext();
  }

  constructionFoundationThicknessBtn.addEventListener("click", async () => {
    openConstructionDrawer("foundation-thickness", { foundationStandaloneMode: true });
    try {
      await ensureDatasetsAndDashboard();
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionStatusBtn.addEventListener("click", async () => {
    openConstructionDrawer("status", { foundationStandaloneMode: false });
    try {
      await ensureDatasetsAndDashboard();
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionSettlementBtn.addEventListener("click", async () => {
    openConstructionDrawer("settlement", { foundationStandaloneMode: false });
    try {
      await ensureDatasetsAndDashboard();
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionDrawerClose.addEventListener("click", closeConstructionDrawer);
  constructionTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      constructionState.foundationStandaloneMode = false;
      applyDrawerLayoutMode();
      setConstructionTab(button.dataset.tab);
      renderProjectContext();
    });
  });

  constructionDatasetApply.addEventListener("click", async () => {
    try {
      await refreshDashboard();
      enableViewerOverlay("PDAM 색상 보기를 적용했습니다.");
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionDatasetDelete.addEventListener("click", async () => {
    await deleteSelectedDataset();
  });

  if (constructionDatasetClearOverlay) {
    constructionDatasetClearOverlay.addEventListener("click", () => {
      disableViewerOverlay("PDAM 색상 보기를 해제하고 원래 도면 색상으로 돌렸습니다.");
    });
  }

  constructionDatasetSelect.addEventListener("change", async () => {
    constructionState.activeDatasetId = constructionDatasetSelect.value;
    updateDatasetActionButtons();
    if (!constructionState.activeDatasetId) {
      clearDashboardView();
      return;
    }
    setSyncStatus("데이터셋을 선택했습니다. 적용 버튼으로 반영하세요.");
  });

  constructionApplyBtn.addEventListener("click", async () => {
    try {
      await refreshDashboard();
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionSettlementApplyBtn.addEventListener("click", async () => {
    try {
      await refreshDashboard();
    } catch (error) {
      setSyncStatus(errorMessage(error), true);
    }
  });

  constructionSettlementPreviewBtn.addEventListener("click", () => {
    constructionState.settlementPreviewOnly = !constructionState.settlementPreviewOnly;
    applyOverlayVisibilityFilters();
  });
  syncSettlementSettingInputsFromState();
  if (constructionSettlementManualApplyBtn) {
    constructionSettlementManualApplyBtn.addEventListener("click", () => {
      applySettlementManualSettings();
    });
  }
  [constructionSettlementBlindingThickness, constructionSettlementHeadTrimLevel, constructionSettlementRemainingBase].forEach((input) => {
    if (!input) return;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySettlementManualSettings();
      }
    });
  });
  if (constructionRecordsBody) {
    constructionRecordsBody.addEventListener("keydown", (event) => {
      const cell = event.target?.closest("td[data-manual-field]");
      if (!cell) return;
      if (event.key === "Enter") {
        event.preventDefault();
        cell.blur();
      }
    });
    constructionRecordsBody.addEventListener("focusout", (event) => {
      const cell = event.target?.closest("td[data-manual-field]");
      if (!cell) return;
      const rowKey = decodeURIComponent(cell.dataset.rowKey || "");
      const field = cell.dataset.manualField || "";
      if (!rowKey || !["foundationTop", "foundationThickness"].includes(field)) return;
      const raw = String(cell.textContent || "").replace(/\s+/g, " ").trim();
      const parsed = toFiniteNumberOrNull(raw);
      if (raw && parsed == null) {
        const errMsg = "기초골조 값은 숫자로 입력해주세요.";
        setSyncStatus(errMsg, true);
        showSettlementCopyFeedback(errMsg, true);
        rerenderSettlementTableFromState();
        return;
      }
      const prev = constructionState.settlementManualByKey?.[rowKey] || {};
      const next = { ...prev, [field]: parsed };
      if (next.foundationTop == null && next.foundationThickness == null) {
        delete constructionState.settlementManualByKey[rowKey];
      } else {
        constructionState.settlementManualByKey[rowKey] = next;
      }
      rerenderSettlementTableFromState();
    });
  }

  if (constructionSettlementRecordsCopyBtn) {
    constructionSettlementRecordsCopyBtn.addEventListener("click", () => {
      copySettlementRecordsToClipboard().catch((err) => {
        console.error(err);
        const errMsg = "복사 중 오류가 발생했습니다.";
        setSyncStatus(errMsg, true);
        showSettlementCopyFeedback(errMsg, true);
      });
    });
  }
  if (constructionSettlementRecordsXlsxBtn) {
    constructionSettlementRecordsXlsxBtn.addEventListener("click", () => {
      downloadSettlementRecordsXlsx().catch((err) => {
        console.error(err);
        const errMsg = "엑셀 다운로드 중 오류가 발생했습니다.";
        setSyncStatus(errMsg, true);
        showSettlementCopyFeedback(errMsg, true);
      });
    });
  }

  if (constructionFoundationMultiSelect) {
    constructionFoundationMultiSelect.addEventListener("change", () => {
      constructionState.foundationMultiSelect = Boolean(constructionFoundationMultiSelect.checked);
    });
  }
  qa('input[name="construction-pf-height-band"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      constructionState.pfHeightBandMode = radio.value === "large" ? "large" : "small";
      invalidateFoundationGroupCache();
      refreshFoundationPanel();
      requestRedraw();
    });
  });
  if (constructionFoundationWindowSelect) {
    constructionFoundationWindowSelect.addEventListener("change", () => {
      constructionState.foundationWindowSelect = Boolean(constructionFoundationWindowSelect.checked);
      constructionState.foundationWindowRect = null;
      constructionState.foundationDragging = false;
      requestRedraw();
    });
  }
  if (constructionFoundationPolylineAutoSelect) {
    constructionFoundationPolylineAutoSelect.addEventListener("change", () => {
      constructionState.foundationPolylineAutoSelect = Boolean(constructionFoundationPolylineAutoSelect.checked);
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationAreaMin) {
    constructionFoundationAreaMin.addEventListener("input", () => {
      const minBound = Number(constructionFoundationAreaMin.min) || 0;
      const maxBound = Number(constructionFoundationAreaMin.max) || FOUNDATION_AREA_SLIDER_MAX;
      const value = Math.max(minBound, Math.min(maxBound, Number(constructionFoundationAreaMin.value) || minBound));
      const minGap = getFoundationAreaMinGapPos();
      const maxAllowed = Math.max(minBound, Number(constructionState.foundationAreaMaxPos) - minGap);
      constructionState.foundationAreaMinPos = Math.min(value, maxAllowed);
      syncFoundationAreaValuesFromPos();
      syncFoundationControlValues();
      renderFoundationAreaBandInfo();
      scheduleFoundationAreaRefresh();
    });
  }
  if (constructionFoundationAreaMax) {
    constructionFoundationAreaMax.addEventListener("input", () => {
      const minBound = Number(constructionFoundationAreaMax.min) || 0;
      const maxBound = Number(constructionFoundationAreaMax.max) || FOUNDATION_AREA_SLIDER_MAX;
      const value = Math.max(minBound, Math.min(maxBound, Number(constructionFoundationAreaMax.value) || maxBound));
      const minGap = getFoundationAreaMinGapPos();
      const minAllowed = Math.min(maxBound, Number(constructionState.foundationAreaMinPos) + minGap);
      constructionState.foundationAreaMaxPos = Math.max(value, minAllowed);
      syncFoundationAreaValuesFromPos();
      syncFoundationControlValues();
      renderFoundationAreaBandInfo();
      scheduleFoundationAreaRefresh();
    });
  }
  function syncFoundationOverlayCheckboxesFromState() {
    constructionState.foundationOverlayShowThickness = constructionFoundationOverlayThickness
      ? Boolean(constructionFoundationOverlayThickness.checked)
      : true;
    constructionState.foundationOverlayShowDrill = Boolean(constructionFoundationOverlayDrill?.checked);
    constructionState.foundationOverlayShowFoundationTop = Boolean(constructionFoundationOverlayTop?.checked);
  }
  function syncFoundationHatchCheckboxesFromState() {
    constructionState.foundationHatchShowThickness = constructionFoundationHatchThickness
      ? Boolean(constructionFoundationHatchThickness.checked)
      : true;
    constructionState.foundationHatchShowDrill = Boolean(constructionFoundationHatchDrill?.checked);
    constructionState.foundationHatchShowFoundationTop = Boolean(constructionFoundationHatchTop?.checked);
  }
  if (constructionFoundationOverlayThickness) {
    constructionFoundationOverlayThickness.addEventListener("change", () => {
      syncFoundationOverlayCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationOverlayDrill) {
    constructionFoundationOverlayDrill.addEventListener("change", () => {
      syncFoundationOverlayCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationOverlayTop) {
    constructionFoundationOverlayTop.addEventListener("change", () => {
      syncFoundationOverlayCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationOverlayAll) {
    constructionFoundationOverlayAll.addEventListener("click", () => {
      if (constructionFoundationOverlayThickness) constructionFoundationOverlayThickness.checked = true;
      if (constructionFoundationOverlayDrill) constructionFoundationOverlayDrill.checked = true;
      if (constructionFoundationOverlayTop) constructionFoundationOverlayTop.checked = true;
      syncFoundationOverlayCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationHatchThickness) {
    constructionFoundationHatchThickness.addEventListener("change", () => {
      syncFoundationHatchCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationHatchDrill) {
    constructionFoundationHatchDrill.addEventListener("change", () => {
      syncFoundationHatchCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationHatchTop) {
    constructionFoundationHatchTop.addEventListener("change", () => {
      syncFoundationHatchCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationHatchAll) {
    constructionFoundationHatchAll.addEventListener("click", () => {
      if (constructionFoundationHatchThickness) constructionFoundationHatchThickness.checked = true;
      if (constructionFoundationHatchDrill) constructionFoundationHatchDrill.checked = true;
      if (constructionFoundationHatchTop) constructionFoundationHatchTop.checked = true;
      syncFoundationHatchCheckboxesFromState();
      requestRedraw();
    });
  }
  if (constructionFoundationExcludeWithThickness) {
    constructionFoundationExcludeWithThickness.addEventListener("change", () => {
      constructionState.foundationExcludeWithThickness = Boolean(constructionFoundationExcludeWithThickness.checked);
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT3',location:'construction.js:excludeToggle:change',message:'exclude-with-thickness toggle changed',data:{checked:Boolean(constructionFoundationExcludeWithThickness.checked)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });
  }
  if (constructionFoundationClearSelection) {
    constructionFoundationClearSelection.addEventListener("click", () => {
      beforeFoundationMutation();
      constructionState.foundationSelectedCircleIds.clear();
      constructionState.foundationSelectedPolylineIds.clear();
      constructionState.foundationFilteredPolylineIds.clear();
      constructionState.foundationSelectedSubgroupKeys.clear();
      constructionState.foundationSelectedPfKeys.clear();
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
      refreshFoundationPanel();
      requestRedraw();
    });
  }
  if (constructionFoundationUndo) {
    constructionFoundationUndo.addEventListener("click", () => undoFoundationStep());
  }
  if (constructionFoundationRedo) {
    constructionFoundationRedo.addEventListener("click", () => redoFoundationStep());
  }
  if (constructionFoundationResetAll) {
    constructionFoundationResetAll.addEventListener("click", () => {
      const answer = window.prompt("초기화를 진행하려면 아래 문구를 정확히 입력하세요.\n\n초기화하겠습니다", "");
      if (answer !== "초기화하겠습니다") {
        setSyncStatus("초기화가 취소되었습니다. (문구 불일치)", true);
        return;
      }
      beforeFoundationMutation();
      // '설정'이 아닌 입력한 두께/피트 데이터만 초기화
      constructionState.foundationThicknessByPileId = {};
      state.foundationThicknessByPileId = {};
      constructionState.foundationPitOffsetByPileId = {};
      state.foundationPitOffsetByPileId = {};
      constructionState.drillingStartByPileId = {};
      state.drillingStartByPileId = {};
      constructionState.foundationTopByPileId = {};
      state.foundationTopByPileId = {};
      rerenderSettlementTableFromState();
      refreshFoundationPanel();
      requestRedraw();
      setSyncStatus("말뚝별 천공·기초상·두께·엘레베이터 피트 데이터를 초기화했습니다.");
      persistFoundationSettings("기초 탭 말뚝별 수치 초기화 저장");
    });
  }
  if (constructionFoundationPolylineList) {
    constructionFoundationPolylineList.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-foundation-subgroup-key]");
      if (!button) return;
      const key = button.dataset.foundationSubgroupKey || "";
      if (!key) return;
      beforeFoundationMutation();
      constructionState.foundationSelectedPfKeys.clear();
      const wasSelected = constructionState.foundationSelectedSubgroupKeys.has(key);
      if (!constructionState.foundationMultiSelect) {
        constructionState.foundationSelectedSubgroupKeys = wasSelected ? new Set() : new Set([key]);
      } else if (wasSelected) {
        constructionState.foundationSelectedSubgroupKeys.delete(key);
      } else {
        constructionState.foundationSelectedSubgroupKeys.add(key);
      }
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
      const ids = getFoundationListSelectableCircleIds();
      constructionState.foundationSelectedCircleIds = new Set(ids);
      const selectedSet = constructionState.foundationSelectedCircleIds || new Set();
      const leaked = Array.from(selectedSet).filter((id) => Number.isFinite(getFoundationThicknessMm(id)));
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT4',location:'construction.js:polylineList:subgroupClick',message:'subgroup selection applied to selectedCircleIds',data:{excludeWithThickness:Boolean(constructionState.foundationExcludeWithThickness),selectedCount:constructionState.foundationSelectedCircleIds.size,subgroupCount:constructionState.foundationSelectedSubgroupKeys.size,selectedLeakedCount:leaked.length,sampleSelectedLeaked:leaked.slice(0,10)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      refreshFoundationPanel();
      requestRedraw();
    });
  }
  if (constructionFoundationParkingCountFilters) {
    constructionFoundationParkingCountFilters.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-foundation-bulk-scope]");
      if (!button) return;
      beforeFoundationMutation();
      constructionState.foundationSelectedPfKeys.clear();
      const scope = String(button.dataset.foundationBulkScope || "inside");
      const groups = getFoundationGroupItems();
      const targetKeys = groups.map((group) => `${group.key}:${scope === "outside" ? "outside" : "inside"}`);
      const currentKeys = constructionState.foundationSelectedSubgroupKeys || new Set();
      const allAlreadySelected = targetKeys.length > 0 && targetKeys.every((key) => currentKeys.has(key));
      const nextKeys = new Set(currentKeys);
      if (allAlreadySelected) {
        targetKeys.forEach((key) => nextKeys.delete(key));
      } else {
        targetKeys.forEach((key) => nextKeys.add(key));
      }
      constructionState.foundationSelectedSubgroupKeys = nextKeys;
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
      const ids = getFoundationListSelectableCircleIds();
      constructionState.foundationSelectedCircleIds = new Set(ids);
      const selectedSet = constructionState.foundationSelectedCircleIds || new Set();
      const leaked = Array.from(selectedSet).filter((id) => Number.isFinite(getFoundationThicknessMm(id)));
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'exclude-thickness-filter',hypothesisId:'FT5',location:'construction.js:parkingCountFilters:bulkClick',message:'bulk inside/outside selection applied',data:{scope:String(scope||''),excludeWithThickness:Boolean(constructionState.foundationExcludeWithThickness),selectedCount:constructionState.foundationSelectedCircleIds.size,subgroupCount:constructionState.foundationSelectedSubgroupKeys.size,selectedLeakedCount:leaked.length,sampleSelectedLeaked:leaked.slice(0,10)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      refreshFoundationPanel();
      requestRedraw();
    });
  }
  if (constructionFoundationPfList) {
    constructionFoundationPfList.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-foundation-pf-key]");
      if (!button) return;
      const key = button.dataset.foundationPfKey || "";
      if (!key) return;
      applyPfGroupKeyToggle(key);
    });
  }
  if (constructionFoundationPfProximityReview) {
    const goMismatchRow = (row) => {
      if (!row || !row.classList?.contains("construction-pf-mismatch-row")) return;
      const ax = Number(row.dataset.ax);
      const ay = Number(row.dataset.ay);
      const bx = Number(row.dataset.bx);
      const by = Number(row.dataset.by);
      const idA = row.dataset.idA || "";
      const idB = row.dataset.idB || "";
      if (typeof focusPfLabelMismatchPair === "function") {
        focusPfLabelMismatchPair(ax, ay, bx, by, idA, idB);
      }
    };
    constructionFoundationPfProximityReview.addEventListener("click", (event) => {
      const row = event.target?.closest?.(".construction-pf-mismatch-row");
      goMismatchRow(row);
    });
    constructionFoundationPfProximityReview.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target?.closest?.(".construction-pf-mismatch-row");
      if (!row) return;
      event.preventDefault();
      goMismatchRow(row);
    });
  }
  if (constructionFoundationApplySelection) {
    constructionFoundationApplySelection.addEventListener("click", () => {
      const mm = toFiniteNumberOrNull(constructionFoundationThicknessMm?.value);
      if (!Number.isFinite(mm) || mm < 0) {
        setSyncStatus("두께(mm)는 0 이상의 숫자로 입력해주세요.", true);
        return;
      }
      beforeFoundationMutation();
      const selectedIds = Array.from(constructionState.foundationSelectedCircleIds || []);
      const selectedCircleMap = new Map((state.circles || []).map((circle) => [circle.id, circle]));
      const strictUnmatched = selectedIds.filter((id) => !isStrictNumberMatchedCircle(selectedCircleMap.get(id)));
      // #region agent log
      fetch('http://127.0.0.1:7512/ingest/ab35833f-68d6-43c0-89a1-1aba808f42af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'659c65'},body:JSON.stringify({sessionId:'659c65',runId:'number-match-selection',hypothesisId:'NM5',location:'construction.js:applySelection:click',message:'apply thickness target strict-match status',data:{selectedCount:selectedIds.length,strictUnmatchedCount:strictUnmatched.length,sampleStrictUnmatched:strictUnmatched.slice(0,10).map((id)=>{const circle=selectedCircleMap.get(id);return{id:String(id||''),has_error:Boolean(circle?.has_error),matched_text_id:String(circle?.matched_text_id??circle?.matched_text?.id??''),matched_text:String(circle?.matched_text?.text??'')};}),inputMm:mm},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      applyFoundationThicknessToCircles(selectedIds, mm);
      setSyncStatus(`선택 ${constructionState.foundationSelectedCircleIds.size}개에 ${Math.round(mm)} mm 적용 완료`);
      persistFoundationSettings("기초골조 두께 설정 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationApplyDrill) {
    constructionFoundationApplyDrill.addEventListener("click", () => {
      const m = toFiniteNumberOrNull(constructionFoundationDrillM?.value);
      if (!Number.isFinite(m)) {
        setSyncStatus("천공시작(m)은 숫자로 입력해주세요.", true);
        return;
      }
      beforeFoundationMutation();
      const selectedIds = Array.from(constructionState.foundationSelectedCircleIds || []);
      applyDrillingStartToCircles(selectedIds, m);
      setSyncStatus(`선택 ${selectedIds.length}개에 천공시작 ${formatMetric(m, 3)} m 적용 완료`);
      persistFoundationSettings("말뚝별 천공시작 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationClearDrillSelection) {
    constructionFoundationClearDrillSelection.addEventListener("click", () => {
      beforeFoundationMutation();
      const ids = Array.from(constructionState.foundationSelectedCircleIds || []);
      clearDrillingStartForCircles(ids);
      setSyncStatus(`선택 ${ids.length}개 말뚝별 천공 값을 삭제했습니다. (동 설정값으로 표시)`);
      persistFoundationSettings("말뚝별 천공시작 삭제 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationApplyTop) {
    constructionFoundationApplyTop.addEventListener("click", () => {
      const m = toFiniteNumberOrNull(constructionFoundationTopM?.value);
      if (!Number.isFinite(m)) {
        setSyncStatus("기초상단(m)은 숫자로 입력해주세요.", true);
        return;
      }
      beforeFoundationMutation();
      const selectedIds = Array.from(constructionState.foundationSelectedCircleIds || []);
      applyFoundationTopElevationToCircles(selectedIds, m);
      setSyncStatus(`선택 ${selectedIds.length}개에 기초상단 ${formatMetric(m, 3)} m 적용 완료`);
      persistFoundationSettings("말뚝별 기초상단 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationClearTopSelection) {
    constructionFoundationClearTopSelection.addEventListener("click", () => {
      beforeFoundationMutation();
      const ids = Array.from(constructionState.foundationSelectedCircleIds || []);
      clearFoundationTopElevationForCircles(ids);
      setSyncStatus(`선택 ${ids.length}개 말뚝별 기초상단 값을 삭제했습니다. (동 설정값으로 표시)`);
      persistFoundationSettings("말뚝별 기초상단 삭제 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationPresetLoad) {
    constructionFoundationPresetLoad.addEventListener("click", () => {
      void (async () => {
        const workId = constructionFoundationPresetWork?.value;
        if (!workId) {
          setSyncStatus("저장 버전을 선택해주세요.", true);
          return;
        }
        let payload;
        try {
          payload = await fetchSavedWorkPayloadById(workId);
        } catch (e) {
          setSyncStatus(errorMessage(e), true);
          return;
        }
        if (!payload || typeof payload !== "object") {
          setSyncStatus("저장 데이터를 불러오지 못했습니다.", true);
          return;
        }
        beforeFoundationMutation();
        const pile = mergePerPileFoundationMapsFromPayload(payload);
        const nBld = mergeBuildingElevationsFromPayload(payload);
        if (typeof renderPendingNameEditor === "function") {
          renderPendingNameEditor();
        }
        rerenderSettlementTableFromState();
        invalidateFoundationGroupCache();
        persistFoundationSettings("다른 저장 버전 기초 설정 병합");
        refreshFoundationPanel();
        requestRedraw();
        setSyncStatus(
          `선택 버전 반영: 말뚝 두께 ${pile.nThick}·천공 ${pile.nDrill}·기초상 ${pile.nTop}·피트 ${pile.nPit}건, 동 윤곽 ${nBld}곳 천공·기초상 병합`,
        );
      })();
    });
  }
  if (constructionFoundationClearSelectionValues) {
    constructionFoundationClearSelectionValues.addEventListener("click", () => {
      beforeFoundationMutation();
      const ids = Array.from(constructionState.foundationSelectedCircleIds || []);
      clearFoundationThicknessForCircles(ids);
      setSyncStatus(`선택 ${ids.length}개 두께 값을 삭제했습니다.`);
      persistFoundationSettings("기초골조 두께 설정 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationApplyElevatorPit) {
    constructionFoundationApplyElevatorPit.addEventListener("click", () => {
      const offsetMm = toFiniteNumberOrNull(constructionFoundationElevatorPitOffsetMm?.value);
      if (!Number.isFinite(offsetMm) || offsetMm < 0) {
        setSyncStatus("엘레베이터 피트 오프셋(mm)은 0 이상의 숫자로 입력해주세요.", true);
        return;
      }
      beforeFoundationMutation();
      const offsetM = Number(offsetMm) / 1000;
      const ids = Array.from(constructionState.foundationSelectedCircleIds || []);
      applyFoundationPitOffsetToCircles(ids, offsetM);
      setSyncStatus(`선택 ${ids.length}개에 엘레베이터 피트 ${Math.round(offsetMm)}mm 적용 완료`);
      persistFoundationSettings("엘레베이터 피트 설정 저장");
      refreshFoundationPanel();
    });
  }
  if (constructionFoundationClearElevatorPit) {
    constructionFoundationClearElevatorPit.addEventListener("click", () => {
      beforeFoundationMutation();
      const ids = Array.from(constructionState.foundationSelectedCircleIds || []);
      clearFoundationPitOffsetForCircles(ids);
      setSyncStatus(`선택 ${ids.length}개 엘레베이터 피트 값을 삭제했습니다.`);
      persistFoundationSettings("엘레베이터 피트 설정 저장");
      refreshFoundationPanel();
    });
  }
  constructionResetBtn.addEventListener("click", () => {
    resetFilters();
    if (constructionState.activeDatasetId) {
      refreshDashboard().catch((error) => setSyncStatus(errorMessage(error), true));
    }
  });

  constructionSyncBtn.addEventListener("click", syncFromPdam);
  constructionUploadBtn.addEventListener("click", () => constructionUploadInput.click());
  constructionUploadInput.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    importWorkbookFile(file);
  });
  if (constructionReportFieldsToggle) {
    constructionReportFieldsToggle.addEventListener("click", toggleReportFields);
  }
  syncReportFieldsToggle();

  constructionOverlayMode.addEventListener("change", () => {
    constructionState.overlayMode = constructionOverlayMode.value || "status";
    if (constructionState.overlayMode !== "date") {
      clearPlaybackState({ redraw: false });
    }
    constructionState.legendFilterKey = "";
    updatePlaybackStatus();
    applyOverlayVisibilityFilters();
  });

  constructionMonth.addEventListener("change", applyMonthPreset);
  constructionWeek.addEventListener("change", applyWeekPreset);
  constructionDateFrom.addEventListener("change", () => clearPlaybackState());
  constructionDateTo.addEventListener("change", () => clearPlaybackState());
  constructionPlaybackSpeed.addEventListener("change", () => {
    constructionState.playbackSpeed = Math.max(0.25, Number(constructionPlaybackSpeed.value) || 1);
    updatePlaybackStatus();
  });
  constructionPlaybackModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDateGrouping(button.dataset.playbackMode);
    });
  });
  constructionPlaybackBtn.addEventListener("click", togglePlayback);

  [constructionEquipmentChips, constructionMethodChips, constructionLocationChips].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-chip-category]");
      if (!button) return;
      const category = button.dataset.chipCategory;
      const value = button.dataset.chipValue || "";
      if (category === "equipments") toggleSelection("selectedEquipments", value);
      if (category === "methods") toggleSelection("selectedMethods", value);
      if (category === "locations") toggleSelection("selectedLocations", value);
      renderChipGroup(constructionEquipmentChips, constructionState.dashboard?.filters?.options?.equipments || [], constructionState.selectedEquipments, "equipments");
      renderChipGroup(constructionMethodChips, constructionState.dashboard?.filters?.options?.methods || [], constructionState.selectedMethods, "methods");
      renderChipGroup(constructionLocationChips, constructionState.dashboard?.filters?.options?.locations || [], constructionState.selectedLocations, "locations");
    });
  });

  constructionLegend.addEventListener("click", (event) => {
    const button = event.target.closest("[data-legend-key]");
    if (!button) return;
    const key = button.dataset.legendKey || "";
    constructionState.legendFilterKey = constructionState.legendFilterKey === key ? "" : key;
    renderLegend();
    updateCircleTable();
    requestRedraw();
  });

  window.addEventListener("pilexy:work-context-changed", () => {
    constructionState.foundationThicknessByPileId = state.foundationThicknessByPileId && typeof state.foundationThicknessByPileId === "object"
      ? { ...state.foundationThicknessByPileId }
      : {};
    constructionState.foundationPitOffsetByPileId = state.foundationPitOffsetByPileId && typeof state.foundationPitOffsetByPileId === "object"
      ? { ...state.foundationPitOffsetByPileId }
      : {};
    constructionState.drillingStartByPileId = state.drillingStartByPileId && typeof state.drillingStartByPileId === "object"
      ? { ...state.drillingStartByPileId }
      : {};
    constructionState.foundationTopByPileId = state.foundationTopByPileId && typeof state.foundationTopByPileId === "object"
      ? { ...state.foundationTopByPileId }
      : {};
    constructionState.foundationSelectedCircleIds.clear();
    constructionState.foundationSelectedPolylineIds.clear();
    constructionState.foundationFilteredPolylineIds.clear();
    constructionState.foundationSelectedSubgroupKeys.clear();
    constructionState.foundationSelectedPfKeys.clear();
    constructionState.foundationSuppressedCircleIds.clear();
    constructionState.foundationSuppressedPolylineIds.clear();
    constructionState.foundationPreviewCircleIds.clear();
    constructionState.foundationGroupsInitialized = false;
    constructionState.foundationSelectablePolylineCacheKey = "";
    constructionState.foundationSelectablePolylineCache = [];
    constructionState.foundationBackgroundPolylineCacheKey = "";
    constructionState.foundationBackgroundPolylineCache = [];
    constructionState.foundationGroupItemsCacheKey = "";
    constructionState.foundationGroupItemsCache = [];
    constructionState.foundationAreaMinValue = null;
    constructionState.foundationAreaMaxValue = null;
    constructionState.foundationAreaMinPos = 15;
    constructionState.foundationAreaMaxPos = 85;
    constructionState.foundationAreaBoundMin = 0;
    constructionState.foundationAreaBoundMax = 0;
    // DXF 로드 직후 등 대량 텍스트에서 패널 전체 갱신이 메인 스레드를 오래 잡지 않게 한 틀 뒤 실행
    requestAnimationFrame(() => {
      refreshFoundationPanel();
      updateConstructionButtonsState();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (!isFoundationTabActive()) return;
    const tag = (e.target && e.target.tagName) || "";
    const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;
    if (e.key === "Escape" && !inField) {
      e.preventDefault();
      beforeFoundationMutation();
      constructionState.foundationSelectedCircleIds.clear();
      constructionState.foundationSelectedPolylineIds.clear();
      constructionState.foundationFilteredPolylineIds.clear();
      constructionState.foundationSelectedSubgroupKeys.clear();
      constructionState.foundationSelectedPfKeys.clear();
      constructionState.foundationSuppressedCircleIds.clear();
      constructionState.foundationSuppressedPolylineIds.clear();
      constructionState.foundationWindowRect = null;
      constructionState.foundationDragging = false;
      refreshFoundationPanel();
      requestRedraw();
      return;
    }
    if (inField) return;
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      undoFoundationStep();
    }
    if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
      e.preventDefault();
      redoFoundationStep();
    }
  });

  renderProjectContext();
  updateConstructionButtonsState();
  updateDatasetActionButtons();
  updateSettlementPreviewButton();
  constructionState.playbackSpeed = Math.max(0.25, Number(constructionPlaybackSpeed?.value) || 1);
  syncPlaybackModeButtons();
  updatePlaybackStatus();
  rebuildLegend();
  renderLegend();
  applyDrawerLayoutMode();
  refreshFoundationPanel();
})();
