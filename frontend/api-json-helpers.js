/**
 * fetch Response 본문을 한 번만 읽고 JSON으로 파싱합니다.
 * HTML 오류 페이지·SPA 폴백이 와서 JSON.parse가 "<!DOCTYPE"에서 실패할 때,
 * 브라우저 기본 SyntaxError 대신 원인 안내를 던집니다.
 * @param {Response} response
 * @returns {Promise<Record<string, unknown>|Array<unknown>>}
 */
async function pilexyParseFetchJson(response) {
  const text = await response.text();
  const trimmed = text.trim();
  let data = null;
  if (trimmed) {
    const looksHtml = trimmed[0] === "<" || /^<!?doctype/i.test(trimmed);
    if (looksHtml) {
      const origin =
        typeof window !== "undefined" && window.location && window.location.origin !== "null"
          ? window.location.origin
          : "";
      throw new Error(
        `서버가 JSON 대신 HTML을 반환했습니다(HTTP ${response.status}). ` +
          `PileXY 백엔드가 실행 중인지 확인하고, 브라우저 주소(${origin || "현재 탭"})에서 /api 요청이 백엔드로 가는지(프록시·포트) 확인하세요.`
      );
    }
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      const msg = e && e.message ? String(e.message) : "JSON 파싱 실패";
      throw new Error(msg);
    }
  } else {
    data = {};
  }
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && data !== null && ("detail" in data || "message" in data)
        ? data.detail ?? data.message
        : null;
    const fallback = trimmed.slice(0, 200) || response.statusText || "요청 실패";
    const piece = detail != null ? (typeof detail === "string" ? detail : JSON.stringify(detail)) : fallback;
    throw new Error(piece);
  }
  return data;
}

if (typeof window !== "undefined") {
  window.pilexyParseFetchJson = pilexyParseFetchJson;
}
