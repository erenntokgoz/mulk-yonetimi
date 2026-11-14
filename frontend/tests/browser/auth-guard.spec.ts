import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

for (const path of ["/", "/portfoy", "/belgeler"]) {
  test(`redirects ${path} to login without a session`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/giris\\?next=${encodeURIComponent(path).replace(/[/]/g, "\\/")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const path of ["/giris", "/kayit", "/parolami-unuttum"]) {
  test(`keeps public page ${path} reachable without a session`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test("returns 401 JSON from the BFF instead of redirecting API calls", async ({ request }) => {
  const response = await request.get("/api/bff/properties");
  expect(response.status()).not.toBe(307);
});

test("login sends the user back to the requested page", async ({ page }) => {
  await page.route("**/api/bff/auth/login", async route => {
    await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: new URL(page.url()).origin }]);
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto("/giris?next=%2Fportfoy");
  await page.getByLabel("E-posta").fill("owner@example.test");
  await page.getByLabel("Parola").fill("Correct-Password-123!");
  await page.getByRole("button", { name: /Giriş yap/ }).click();
  await expect(page).toHaveURL(/\/portfoy$/);
});

test("ignores an off-site next parameter after login", async ({ page }) => {
  await page.route("**/api/bff/auth/login", async route => {
    await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: new URL(page.url()).origin }]);
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto("/giris?next=%2F%2Fevil.example.test");
  await page.getByLabel("E-posta").fill("owner@example.test");
  await page.getByLabel("Parola").fill("Correct-Password-123!");
  await page.getByRole("button", { name: /Giriş yap/ }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});
