import { defineConfig, devices } from "@playwright/test";

const backendUrl = process.env.MULK_SQL_E2E_API_URL;
if (!backendUrl) throw new Error("MULK_SQL_E2E_API_URL must point to the SQL-backed test API.");

const frontendUrl = "http://127.0.0.1:3120";

export default defineConfig({
  testDir: "./tests/sql",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: frontendUrl,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: "pnpm start -p 3120",
    url: frontendUrl,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      BACKEND_BASE_URL: backendUrl,
      FRONTEND_ORIGIN: frontendUrl,
    },
  },
});
