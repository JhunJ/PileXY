/**
 * 브라우저 탭·사용자별로 백엔드 DXF/원 메모리 상태를 맞추기 위한 세션 ID.
 * 모든 /api/* 요청에 X-PileXY-Session 헤더를 붙입니다(기존 동작: 헤더 없으면 서버 default 버킷).
 */
(function () {
  if (typeof window === "undefined") return;
  function getOrCreateSessionId() {
    // localStorage is shared across tabs; sharing it mixed their server-side CAD data.
    return (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 14);
  }

  var SESSION_ID = getOrCreateSessionId();
  window.__PILEXY_SESSION_ID__ = SESSION_ID;
  window.pilexyBeginDrawingSession = function () {
    SESSION_ID = getOrCreateSessionId();
    window.__PILEXY_SESSION_ID__ = SESSION_ID;
    return SESSION_ID;
  };

  function isPilexyApiUrl(urlStr) {
    return String(urlStr || "").indexOf("/api/") >= 0;
  }

  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var u = typeof input === "string" ? input : input && input.url ? input.url : "";
      if (isPilexyApiUrl(u)) {
        init = init ? Object.assign({}, init) : {};
        var headers = new Headers(init.headers || undefined);
        var requestSession = SESSION_ID;
        if (!headers.has("X-PileXY-Session")) headers.set("X-PileXY-Session", requestSession);
        init.headers = headers;
        return _fetch(input, init).then(function (response) {
          if (/\/api\/(?:circles|assign-buildings|buildings\/apply|manual-match|upload-dxf)/.test(u)) {
            var checkSession = function () {
              if (requestSession !== SESSION_ID) throw new Error("도면이 변경되어 이전 요청 결과를 적용하지 않았습니다.");
            };
            checkSession();
            var readJson = response.json.bind(response);
            response.json = function () {
              return readJson().then(function (data) { checkSession(); return data; });
            };
          }
          return response;
        });
      }
    } catch (e) {
      /* fall through */
    }
    return _fetch(input, init);
  };

  if (typeof XMLHttpRequest !== "undefined") {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function () {
      this.__pilexyUrl = arguments[1];
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        var u = String(this.__pilexyUrl || "");
        if (isPilexyApiUrl(u) && !this.__pilexySessionHdr) {
          this.setRequestHeader("X-PileXY-Session", SESSION_ID);
          this.__pilexySessionHdr = true;
        }
      } catch (e) {
        /* ignore */
      }
      return origSend.call(this, body);
    };
  }
})();
