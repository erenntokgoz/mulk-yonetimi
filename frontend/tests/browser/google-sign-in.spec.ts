import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("Google button follows the build flag on login and registration", async ({ page }) => {
  for (const [path, submit] of [["/giris", "Giriş yap"], ["/kayit", "Hesap oluştur"]]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: submit, exact: true })).toBeVisible();
    const googleLink = page.getByRole("link", { name: "Google ile devam et" });
    if (process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1") {
      await expect(googleLink).toHaveAttribute("href", "/api/bff/auth/google?popup=1");
    } else {
      await expect(googleLink).toHaveCount(0);
    }
  }
});

test("login page shows Google callback errors", async ({ page }) => {
  const response = await page.goto("/giris?hata=onay");
  expect(response?.headers()["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  await expect(page.locator("main [role=alert]")).toHaveText(
    "Hesabınız pilot onayı bekliyor. Onaylandıktan sonra giriş yapabilirsiniz.",
  );
  await page.goto("/giris?hata=google");
  await expect(page.locator("main [role=alert]")).toHaveText("Google ile giriş yapılamadı. Tekrar deneyin.");
  await page.goto("/giris?hata=bilinmeyen");
  await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("Google routes fail closed back to the login page without leaving the site", async ({ page }) => {
  // Test sunucusunun kökeni kayıtlı yönlendirme adreslerinden biri değil ve Google ortamı tanımlı değil.
  await page.goto("/api/bff/auth/google?next=%2F%2Fevil.example");
  await expect(page).toHaveURL(/\/giris\?hata=google$/);
  await expect(page.locator("main [role=alert]")).toHaveText("Google ile giriş yapılamadı. Tekrar deneyin.");
  await page.goto("/api/bff/auth/google/callback?state=forged&code=forged");
  await expect(page).toHaveURL(/\/giris\?hata=google$/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "mulk.session")).toBe(false);
});

test("popup callback keeps its opener after a cross-origin OAuth page", async ({ page }) => {
  await page.goto("/giris");
  const origin = new URL(page.url()).origin;
  const callback = new URL("/api/bff/auth/google/callback?state=forged&code=forged", origin);
  const callbackResponse = await page.request.get(callback.href, { maxRedirects: 0 });
  const callbackPolicy = callbackResponse.headers()["cross-origin-opener-policy"];
  const provider = new URL("http://localhost:3111/test-google-authorize");
  const context = page.context();

  await context.route(provider.href, (route) => route.fulfill({
    contentType: "text/html",
    headers: { "Cross-Origin-Opener-Policy": "unsafe-none" },
    body: `<!doctype html><body>OAuth provider<script>addEventListener("load", () => location.replace(${JSON.stringify(callback.href)}));</script></body>`,
  }));
  await context.route(callback.href, (route) => route.fulfill({
    contentType: "text/html",
    headers: { "Cross-Origin-Opener-Policy": callbackPolicy },
    body: "<!doctype html><body><script>document.body.textContent=window.opener?'opener-present':'opener-missing';</script></body>",
  }));

  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    link.target = "mulk-popup-policy-test";
    link.textContent = "Open popup";
    document.body.append(link);
  }, provider.href);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open popup" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toHaveText("opener-present");
  expect(callbackPolicy).toBe("unsafe-none");
  await popup.close();
});
