export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const backendOrigin = env.BACKEND_ORIGIN;

    if (!backendOrigin) {
      return new Response("Missing BACKEND_ORIGIN", { status: 500 });
    }

    const backendUrl = new URL(request.url);
    backendUrl.protocol = new URL(backendOrigin).protocol;
    backendUrl.host = new URL(backendOrigin).host;

    if (url.pathname.startsWith("/api/")) {
      backendUrl.pathname = url.pathname;
      backendUrl.search = url.search;

      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", url.host);
      headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

      return fetch(backendUrl.toString(), {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "follow",
      });
    }

    return fetch(request);
  },
};
