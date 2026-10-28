import "server-only";
import { getBackendBaseUrl } from "./health";

export async function proxyAuth(request: Request, path: string, mutation: boolean): Promise<Response> {
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (!frontendOrigin) return new Response(null, { status: 503 });

  let expectedOrigin: string;
  try {
    const configured = new URL(frontendOrigin);
    if (!["http:", "https:"].includes(configured.protocol) || configured.username || configured.password ||
        configured.pathname !== "/" || configured.search || configured.hash) throw new Error();
    expectedOrigin = configured.origin;
  } catch {
    return new Response(null, { status: 503 });
  }

  if (mutation && request.headers.get("origin") !== expectedOrigin) {
    return new Response(null, { status: 403 });
  }

  let backendUrl: string;
  try {
    backendUrl = getBackendBaseUrl();
  } catch {
    return new Response(null, { status: 503 });
  }

  const headers = new Headers({ Accept: "application/json" });
  if (mutation) headers.set("Origin", expectedOrigin);
  const cookie = request.headers.get("cookie");
  const contentType = request.headers.get("content-type");
  if (cookie) headers.set("Cookie", cookie);
  if (contentType) headers.set("Content-Type", contentType);

  let upstream: Response;
  try {
    upstream = await fetch(new URL(path, backendUrl), {
      method: request.method,
      headers,
      body: mutation ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) return new Response(null, { status: 502 });
  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("Content-Type", upstreamContentType);
  const retryAfter = upstream.headers.get("retry-after");
  if (upstream.status === 429 && retryAfter) responseHeaders.set("Retry-After", retryAfter);
  for (const setCookie of upstream.headers.getSetCookie()) responseHeaders.append("Set-Cookie", setCookie);
  return new Response(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}
