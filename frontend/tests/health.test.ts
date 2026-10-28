import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { getBackendHealth, getBackendBaseUrl } from "../lib/api/health.ts";

const healthy = {
  status: "Healthy",
  checks: [{ name: "sqlserver", status: "Healthy", durationMs: 12, description: null }],
};

async function serve(statusCode: number, body: unknown, run: (url: string) => Promise<void>) {
  const server = createServer((request, response) => {
    if (request.url !== "/health" || request.method !== "GET") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("reads the health endpoint and preserves SQL Server status", async () => {
  await serve(200, healthy, async (url) => {
    assert.deepEqual(await getBackendHealth(url), { kind: "available", health: healthy });
  });
});

test("preserves Unhealthy details from HTTP 503", async () => {
  const health = { status: "Unhealthy", checks: [{ name: "sqlserver", status: "Unhealthy", durationMs: 5, description: "Database unavailable" }] };
  await serve(503, health, async (url) => {
    assert.deepEqual(await getBackendHealth(url), { kind: "available", health });
  });
});

test("preserves Degraded details from HTTP 200", async () => {
  const health = { status: "Degraded", checks: [{ name: "sqlserver", status: "Degraded", durationMs: 15, description: "Slow connection" }] };
  await serve(200, health, async (url) => {
    assert.deepEqual(await getBackendHealth(url), { kind: "available", health });
  });
});

for (const [httpStatus, status] of [[200, "Unhealthy"], [503, "Healthy"], [503, "Degraded"]] as const) {
  test(`rejects inconsistent HTTP ${httpStatus} with ${status} payload`, async () => {
    const health = { status, checks: [{ name: "sqlserver", status, durationMs: 1, description: null }] };
    await serve(httpStatus, health, async (url) => {
      assert.deepEqual(await getBackendHealth(url), { kind: "unavailable", reason: "invalid-response" });
    });
  });
}

test("reports a connection failure without leaking network details", async () => {
  await serve(200, healthy, async () => {});
  // Port 0 cannot be a listening HTTP service.
  assert.deepEqual(await getBackendHealth("http://127.0.0.1:0"), { kind: "unavailable", reason: "network" });
});

test("rejects malformed health payloads instead of reporting healthy", async () => {
  await serve(200, { status: "Healthy", checks: [{ name: "sqlserver", status: "Healthy", durationMs: "12", description: null }] }, async (url) => {
    assert.deepEqual(await getBackendHealth(url), { kind: "unavailable", reason: "invalid-response" });
  });
});

test("rejects unexpected HTTP errors even if the body claims to be healthy", async () => {
  await serve(500, healthy, async (url) => {
    assert.deepEqual(await getBackendHealth(url), { kind: "unavailable", reason: "invalid-response" });
  });
});

test("requires an explicit backend URL and rejects credentials and non-HTTP schemes", () => {
  for (const value of ["", "not a url", "file:///tmp/api", "https://user:secret@example.com", "https://example.com?token=secret", "https://example.com#fragment"]) {
    assert.throws(() => getBackendBaseUrl(value), /BACKEND_BASE_URL/);
  }
  assert.equal(getBackendBaseUrl("http://localhost:5080/"), "http://localhost:5080/");
});
