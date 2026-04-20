/**
 * 브라우저 탭·사용자별로 백엔드 DXF/원 메모리 상태를 맞추기 위한 세션 ID.
 * 모든 /api/* 요청에 X-PileXY-Session 헤더를 붙입니다(기존 동작: 헤더 없으면 서버 default 버킷).
 */
(function () {
  if (typeof window === "undefined") return;
  var STORAGE_KEY = "pilexy_session_id";

  function getOrCreateSessionId() {
    try {
      var id = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (!id || String(id).trim().length < 8) {
        id =
          (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
          "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 14);
        if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, id);
      }
      return String(id).trim();
    } catch (e) {
      return "default";
    }
  }

  var SESSION_ID = getOrCreateSessionId();
  window.__PILEXY_SESSION_ID__ = SESSION_ID;

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
        if (!headers.has("X-PileXY-Session")) headers.set("X-PileXY-Session", SESSION_ID);
        init.headers = headers;
        return _fetch(input, init);
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
