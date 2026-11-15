import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { finishGoogleSignIn, startGoogleSignIn } from "../lib/api/google-auth.ts";
import { safeNextPath } from "../lib/safe-next-path.ts";

const env = {
  GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret-value",
  FRONTEND_ORIGIN: "http://localhost:3000",
  BACKEND_BASE_URL: "https://api.example.test",
};
const keys = [...Object.keys(env), "VERCEL"] as const;
let saved: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

function mockFetch(apiStatus = 204) {
  calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({ id_token: "google-id-token", access_token: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url === "https://api.example.test/api/v1/auth/google")
      return new Response(null, {
        status: apiStatus,
        headers: apiStatus === 204 ? { "Set-Cookie": "mulk.session=api-session; Path=/; HttpOnly; SameSite=Lax" } : {},
      });
    throw new Error(`unexpected fetch ${url}`);
  };
}

beforeEach(() => {
  saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  delete process.env.VERCEL;
  mockFetch();
});

afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  globalThis.fetch = originalFetch;
});

function start(next?: string, origin = "http://localhost:3000") {
  const url = new URL("/api/bff/auth/google", origin);
  if (next !== undefined) url.searchParams.set("next", next);
  const response = startGoogleSignIn(new Request(url));
  const setCookie = response.headers.getSetCookie();
  return { response, location: response.headers.get("location") ?? "", setCookie, cookie: setCookie[0]?.split(";")[0] ?? "" };
}

function callback(cookie: string, params: Record<string, string>, origin = "http://localhost:3000", now?: number) {
  const url = new URL("/api/bff/auth/google/callback", origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return finishGoogleSignIn(new Request(url, { headers: cookie ? { cookie } : {} }), now);
}

function assertFlowCookieCleared(response: Response) {
  assert.ok(response.headers.getSetCookie().some((value) => value.startsWith("mulk.google=;") && value.includes("Max-Age=0")));
}

test("start redirects to Google with PKCE S256, state, nonce and a sealed short-lived cookie", () => {
  const { response, location, setCookie } = start("/kiracilar");
  assert.equal(response.status, 303);
  const google = new URL(location);
  assert.equal(google.origin + google.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(google.searchParams.get("client_id"), env.GOOGLE_CLIENT_ID);
  assert.equal(google.searchParams.get("redirect_uri"), "http://localhost:3000/api/bff/auth/google/callback");
  assert.equal(google.searchParams.get("response_type"), "code");
  assert.equal(google.searchParams.get("scope"), "openid email profile");
  assert.equal(google.searchParams.get("prompt"), "select_account");
  assert.equal(google.searchParams.get("code_challenge_method"), "S256");
  assert.match(google.searchParams.get("code_challenge") ?? "", /^[A-Za-z0-9_-]{43}$/);
  const state = google.searchParams.get("state") ?? "";
  const nonce = google.searchParams.get("nonce") ?? "";
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(state, nonce);
  assert.equal(setCookie.length, 1);
  const attributes = setCookie[0].split(";").map((part) => part.trim());
  assert.ok(attributes[0].startsWith("mulk.google="));
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/api/bff/auth/google", "Max-Age=600"])
    assert.ok(attributes.includes(attribute), attribute);
  assert.ok(!setCookie[0].includes(state) && !setCookie[0].includes(nonce) && !setCookie[0].includes("kiracilar"));
  assert.ok(!location.includes(env.GOOGLE_CLIENT_SECRET));
});

test("start only builds redirect URIs for the registered origins", () => {
  const production = start(undefined, "https://mulkum-beta.vercel.app");
  assert.equal(new URL(production.location).searchParams.get("redirect_uri"),
    "https://mulkum-beta.vercel.app/api/bff/auth/google/callback");
  for (const origin of ["https://mulkum-git-preview.vercel.app", "http://127.0.0.1:3000", "https://evil.example"]) {
    const rejected = start("/kiracilar", origin);
    assert.equal(rejected.response.status, 303);
    assert.equal(rejected.location, "/giris?hata=google&next=%2Fkiracilar");
    assert.equal(rejected.setCookie.length, 0);
  }
});

test("start fails closed without the Google client secret", () => {
  delete process.env.GOOGLE_CLIENT_SECRET;
  const { location, setCookie } = start();
  assert.equal(location, "/giris?hata=google");
  assert.equal(setCookie.length, 0);
});

test("callback rejects a state mismatch without exchanging the code", async () => {
  const { cookie } = start("/kiracilar");
  const response = await callback(cookie, { state: "attacker-state", code: "attacker-code" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/giris?hata=google");
  assertFlowCookieCleared(response);
  assert.ok(!response.headers.getSetCookie().some((value) => value.startsWith("mulk.session=")));
  assert.equal(calls.length, 0);
});

test("callback rejects a missing, tampered, expired or foreign-origin flow", async () => {
  const { cookie, location } = start();
  const state = new URL(location).searchParams.get("state")!;
  const value = cookie.slice("mulk.google=".length);
  const tampered = `mulk.google=${value.slice(0, 20)}${value[20] === "A" ? "B" : "A"}${value.slice(21)}`;
  const attempts = [
    callback("", { state, code: "code" }),
    callback(tampered, { state, code: "code" }),
    callback(cookie, { state, code: "code" }, "http://localhost:3000", Date.now() + 601_000),
    callback(cookie, { state, code: "code" }, "https://mulkum-beta.vercel.app"),
    callback(cookie, { state, error: "access_denied" }),
    callback(cookie, { state }),
  ];
  for (const response of await Promise.all(attempts)) {
    assert.equal(response.headers.get("location"), "/giris?hata=google");
    assertFlowCookieCleared(response);
  }
  assert.equal(calls.length, 0);
});

test("callback exchanges the code with PKCE, sends the nonce to the API and keeps its session cookie", async () => {
  const { cookie, location } = start("/kiracilar?durum=aktif");
  const google = new URL(location);
  const response = await callback(cookie, { state: google.searchParams.get("state")!, code: "auth-code" });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/kiracilar?durum=aktif");
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.includes("mulk.session=api-session; Path=/; HttpOnly; SameSite=Lax"));
  assertFlowCookieCleared(response);

  assert.equal(calls.length, 2);
  const exchange = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(exchange.get("code"), "auth-code");
  assert.equal(exchange.get("grant_type"), "authorization_code");
  assert.equal(exchange.get("client_id"), env.GOOGLE_CLIENT_ID);
  assert.equal(exchange.get("client_secret"), env.GOOGLE_CLIENT_SECRET);
  assert.equal(exchange.get("redirect_uri"), "http://localhost:3000/api/bff/auth/google/callback");
  assert.equal(createHash("sha256").update(exchange.get("code_verifier") ?? "").digest("base64url"),
    google.searchParams.get("code_challenge"));

  const api = calls[1];
  assert.equal(api.url, "https://api.example.test/api/v1/auth/google");
  const apiHeaders = new Headers(api.init?.headers);
  assert.equal(apiHeaders.get("origin"), "http://localhost:3000");
  assert.equal(apiHeaders.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(api.init?.body)), { idToken: "google-id-token", nonce: google.searchParams.get("nonce") });
});

test("callback maps API refusals to login page errors and keeps the safe next path", async () => {
  const expectations: [number, string][] = [
    [423, "onay"],
    [409, "google-hesap"],
    [403, "erisim"],
    [429, "sinir"],
    [401, "google"],
    [503, "google"],
  ];
  for (const [status, code] of expectations) {
    mockFetch(status);
    const { cookie, location } = start("/kiracilar");
    const response = await callback(cookie, { state: new URL(location).searchParams.get("state")!, code: "auth-code" });
    assert.equal(response.headers.get("location"), `/giris?hata=${code}&next=%2Fkiracilar`);
    assert.ok(!response.headers.getSetCookie().some((value) => value.startsWith("mulk.session=")));
  }
});

test("next cannot redirect off-site after Google sign-in", async () => {
  const hostile = [
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example/panel",
    "javascript:alert(1)",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\\evil.example",
    "panel",
    "",
  ];
  for (const next of hostile) {
    assert.equal(safeNextPath(next), "/panel", JSON.stringify(next));
    mockFetch();
    const { cookie, location } = start(next);
    const response = await callback(cookie, { state: new URL(location).searchParams.get("state")!, code: "auth-code" });
    assert.equal(response.headers.get("location"), "/panel", JSON.stringify(next));
  }
  assert.equal(safeNextPath(null), "/panel");
  assert.equal(safeNextPath("/kiracilar?durum=aktif#liste"), "/kiracilar?durum=aktif#liste");
  // Nokta bölütleri aynı kökende kalır; tarayıcı bunu bu sitenin "//evil.example" yoluna çözer.
  assert.equal(new URL(safeNextPath("/.//evil.example"), "https://mulkum-beta.vercel.app").origin,
    "https://mulkum-beta.vercel.app");
});
