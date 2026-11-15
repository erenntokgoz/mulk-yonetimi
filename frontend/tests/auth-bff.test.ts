import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { proxyAuth } from "../lib/api/auth-bff.ts";

async function captureForwardedHeaders(request: Request) {
  const originalFetch = globalThis.fetch;
  let forwarded: Headers | undefined;
  globalThis.fetch = async (_input, init) => {
    forwarded = new Headers(init?.headers);
    return new Response(null, { status: 204 });
  };
  try {
    const response = await proxyAuth(request, "/api/v1/auth/login", true);
    assert.equal(response.status, 204);
    assert.ok(forwarded);
    return forwarded;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("signs the single Vercel client IP and replaces spoofed BFF headers", async () => {
  const previous = {
    origin: process.env.FRONTEND_ORIGIN,
    backend: process.env.BACKEND_BASE_URL,
    key: process.env.BACKEND_RATE_LIMIT_SIGNING_KEY,
    vercel: process.env.VERCEL,
  };
  process.env.FRONTEND_ORIGIN = "https://app.example.test";
  process.env.BACKEND_BASE_URL = "https://api.example.test";
  process.env.BACKEND_RATE_LIMIT_SIGNING_KEY = "test-signing-key-with-at-least-32-bytes";
  process.env.VERCEL = "1";
  try {
    const headers = await captureForwardedHeaders(new Request("https://app.example.test/api/bff/auth/login", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "x-forwarded-for": "198.51.100.24, 10.0.0.2",
        "x-mulk-client-ip": "203.0.113.99",
        "x-mulk-client-ip-signature": "forged",
      },
    }));
    assert.equal(headers.get("x-mulk-client-ip"), "198.51.100.24");
    assert.equal(headers.get("x-mulk-client-ip-signature"), createHmac("sha256", process.env.BACKEND_RATE_LIMIT_SIGNING_KEY!).update("198.51.100.24").digest("hex"));
  } finally {
    if (previous.origin === undefined) delete process.env.FRONTEND_ORIGIN; else process.env.FRONTEND_ORIGIN = previous.origin;
    if (previous.backend === undefined) delete process.env.BACKEND_BASE_URL; else process.env.BACKEND_BASE_URL = previous.backend;
    if (previous.key === undefined) delete process.env.BACKEND_RATE_LIMIT_SIGNING_KEY; else process.env.BACKEND_RATE_LIMIT_SIGNING_KEY = previous.key;
    if (previous.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous.vercel;
  }
});

test("does not trust forwarding headers outside Vercel or without a valid signing key", async () => {
  const previous = {
    origin: process.env.FRONTEND_ORIGIN,
    backend: process.env.BACKEND_BASE_URL,
    key: process.env.BACKEND_RATE_LIMIT_SIGNING_KEY,
    vercel: process.env.VERCEL,
  };
  process.env.FRONTEND_ORIGIN = "https://app.example.test";
  process.env.BACKEND_BASE_URL = "https://api.example.test";
  process.env.BACKEND_RATE_LIMIT_SIGNING_KEY = "short";
  delete process.env.VERCEL;
  try {
    const headers = await captureForwardedHeaders(new Request("https://app.example.test/api/bff/auth/login", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "x-forwarded-for": "198.51.100.24",
        "x-mulk-client-ip": "203.0.113.99",
        "x-mulk-client-ip-signature": "forged",
      },
    }));
    assert.equal(headers.has("x-mulk-client-ip"), false);
    assert.equal(headers.has("x-mulk-client-ip-signature"), false);
  } finally {
    if (previous.origin === undefined) delete process.env.FRONTEND_ORIGIN; else process.env.FRONTEND_ORIGIN = previous.origin;
    if (previous.backend === undefined) delete process.env.BACKEND_BASE_URL; else process.env.BACKEND_BASE_URL = previous.backend;
    if (previous.key === undefined) delete process.env.BACKEND_RATE_LIMIT_SIGNING_KEY; else process.env.BACKEND_RATE_LIMIT_SIGNING_KEY = previous.key;
    if (previous.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous.vercel;
  }
});
