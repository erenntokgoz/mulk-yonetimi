import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3109",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    // Stale session cookie: passes the proxy's presence check while the fixture API still answers 401,
    // matching an expired real session. Tests that need a valid session set value "fixture"; auth-guard.spec.ts clears it.
    storageState: { cookies: [{ name: "mulk.session", value: "stale", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }], origins: [] },
  },
  webServer: [
    { command: "node tests/browser/health-server.mjs", port: 5089 },
    {
      command: "pnpm start -p 3109",
      port: 3109,
      env: { BACKEND_BASE_URL: "http://127.0.0.1:5089", FRONTEND_ORIGIN: "http://127.0.0.1:3109" },
    },
    {
      command: "pnpm start -p 3110",
      port: 3110,
      env: { BACKEND_BASE_URL: "" },
    },
  ],
});
