import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { safeNextPath } from "../safe-next-path.ts";
import { configuredFrontendOrigin, setSignedClientIp } from "./auth-bff.ts";
import { getBackendBaseUrl } from "./health.ts";

// Google Console'a kayıtlı yönlendirme adresleri yalnız bu iki kökendedir; önizleme alan adları bilerek reddedilir.
export const GOOGLE_REDIRECT_ORIGINS = ["https://mulkum-beta.vercel.app", "http://localhost:3000"] as const;
export const GOOGLE_FLOW_COOKIE = "mulk.google";
export const GOOGLE_START_PATH = "/api/bff/auth/google";
export const GOOGLE_CALLBACK_PATH = "/api/bff/auth/google/callback";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FLOW_SECONDS = 600;
const COOKIE_AAD = Buffer.from("mulk.google.flow.v1");

export type GoogleSignInError = "google" | "onay" | "erisim" | "sinir" | "google-hesap";

type Flow = { state: string; nonce: string; verifier: string; next: string; origin: string; expiresAt: number; popup?: boolean };
type PopupResult =
  | { type: "mulk-google-auth-result"; status: "success"; next: string }
  | { type: "mulk-google-auth-result"; status: "error"; error: GoogleSignInError };

function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function redirectOrigin(request: Request): string | null {
  const origin = new URL(request.url).origin;
  return (GOOGLE_REDIRECT_ORIGINS as readonly string[]).includes(origin) ? origin : null;
}

function random(): string {
  return randomBytes(32).toString("base64url");
}

// Akış çerezi istemcide okunamaz ve değiştirilemez: anahtar istemci sırrından HKDF ile ayrı amaçla türetilir.
function flowKey(clientSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", clientSecret, "mulk.google.flow", "aes-256-gcm", 32));
}

function seal(flow: Flow, clientSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", flowKey(clientSecret), iv);
  cipher.setAAD(COOKIE_AAD);
  const body = Buffer.concat([cipher.update(JSON.stringify(flow), "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

function open(value: string | null, clientSecret: string): Flow | null {
  if (!value || value.length > 4096) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", flowKey(clientSecret), raw.subarray(0, 12));
    decipher.setAAD(COOKIE_AAD);
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const text = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
    const flow: unknown = JSON.parse(text);
    if (!flow || typeof flow !== "object") return null;
    const { state, nonce, verifier, next, origin, expiresAt, popup } = flow as Record<string, unknown>;
    if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string" ||
      typeof next !== "string" || typeof origin !== "string" || typeof expiresAt !== "number" ||
      (popup !== undefined && typeof popup !== "boolean")) return null;
    return { state, nonce, verifier, next, origin, expiresAt, popup: popup === true };
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function flowCookie(value: string, maxAge: number): string {
  return `${GOOGLE_FLOW_COOKIE}=${value}; Path=${GOOGLE_START_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Uygulama içi yönlendirmeler göreli tutulur; tarayıcı bunları geçerli kökene göre çözer.
function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function failureLocation(error: GoogleSignInError, next: string): string {
  const query = new URLSearchParams({ hata: error });
  if (next !== "/panel") query.set("next", next);
  return `/giris?${query}`;
}

function popupResult(result: PopupResult, fallback: string, cookies: string[]): Response {
  const json = JSON.stringify(result).replace(/</g, "\\u003c");
  const encodedFallback = fallback.replaceAll("&", "&amp;").replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google girişi</title></head><body><p>Google girişi tamamlanıyor…</p><script type="application/json" id="google-result">${json}</script><div id="google-fallback" data-redirect="${encodedFallback}"></div><script>(()=>{const result=JSON.parse(document.getElementById("google-result").textContent||"{}");if(window.opener&&!window.opener.closed){window.opener.postMessage(result,location.origin);window.close();return}location.replace(document.getElementById("google-fallback").dataset.redirect||"/giris")})()</script></body></html>`;
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(html, { status: 200, headers });
}

function failure(error: GoogleSignInError, next: string, cookies: string[], popup = false): Response {
  const location = failureLocation(error, next);
  if (popup) return popupResult({ type: "mulk-google-auth-result", status: "error", error }, location, cookies);
  return redirect(location, cookies);
}

export function startGoogleSignIn(request: Request): Response {
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const popup = new URL(request.url).searchParams.get("popup") === "1";
  const config = googleConfig();
  const origin = redirectOrigin(request);
  if (!config || !origin) return failure("google", next, [], popup);

  const verifier = random();
  const flow: Flow = {
    state: random(),
    nonce: random(),
    verifier,
    next,
    origin,
    expiresAt: Date.now() + FLOW_SECONDS * 1000,
    popup,
  };
  const authorize = new URL(AUTHORIZE_URL);
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: origin + GOOGLE_CALLBACK_PATH,
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return redirect(authorize.href, [flowCookie(seal(flow, config.clientSecret), FLOW_SECONDS)]);
}

const statusErrors: Record<number, GoogleSignInError> = { 403: "erisim", 409: "google-hesap", 423: "onay", 429: "sinir" };

export async function finishGoogleSignIn(request: Request, now = Date.now()): Promise<Response> {
  const config = googleConfig();
  // Akış çerezi her sonuçta silinir; aynı state ikinci kez kullanılamaz.
  const cleared = [flowCookie("", 0)];
  const flow = config ? open(readCookie(request, GOOGLE_FLOW_COOKIE), config.clientSecret) : null;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (!config || !flow)
    return failure("google", "/panel", cleared);
  const next = safeNextPath(flow.next);
  const origin = redirectOrigin(request);
  const popup = flow.popup === true && origin === flow.origin;
  if (flow.expiresAt < now || !state || !safeEqual(state, flow.state))
    return failure("google", next, cleared, popup);
  const code = url.searchParams.get("code");
  const frontendOrigin = configuredFrontendOrigin();
  if (!origin || origin !== flow.origin || url.searchParams.has("error") || !code || code.length > 2048 || !frontendOrigin)
    return failure("google", next, cleared, popup);

  let backendUrl: string;
  try {
    backendUrl = getBackendBaseUrl();
  } catch {
    return failure("google", next, cleared, popup);
  }

  let idToken: unknown;
  try {
    const token = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: origin + GOOGLE_CALLBACK_PATH,
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!token.ok) return failure("google", next, cleared, popup);
    const body: unknown = await token.json();
    idToken = body && typeof body === "object" ? (body as { id_token?: unknown }).id_token : undefined;
  } catch {
    return failure("google", next, cleared, popup);
  }
  if (typeof idToken !== "string" || !idToken) return failure("google", next, cleared, popup);

  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json", Origin: frontendOrigin });
  setSignedClientIp(request, headers);
  let upstream: Response;
  try {
    upstream = await fetch(new URL("/api/v1/auth/google", backendUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ idToken, nonce: flow.nonce }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return failure("google", next, cleared, popup);
  }
  if (upstream.status !== 204) return failure(statusErrors[upstream.status] ?? "google", next, cleared, popup);
  const sessionCookies = [...cleared, ...upstream.headers.getSetCookie()];
  if (popup) return popupResult({ type: "mulk-google-auth-result", status: "success", next }, next, sessionCookies);
  return redirect(next, sessionCookies);
}
