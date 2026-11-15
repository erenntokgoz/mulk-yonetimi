import { expect, test } from "@playwright/test";

test.describe("tanıtım sayfası (oturumsuz)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("oturum olmadan açılır ve giriş/kayıt bağlantıları doğru yere gider", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kiralarınızı tek yerden takip edin.");
    await expect(page.locator("canvas")).toBeAttached();
    const login = page.getByRole("link", { name: "Giriş yap" }).first();
    const register = page.getByRole("link", { name: "Hesap oluştur" }).first();
    await expect(login).toHaveAttribute("href", "/giris");
    await expect(register).toHaveAttribute("href", "/kayit");
    await expect(page.getByRole("link", { name: "Panele git" })).toHaveCount(0);
    await register.click();
    await expect(page).toHaveURL(/\/kayit$/);
  });

  test("/panel oturum yokken girişe yönlendirir", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/giris\?next=%2Fpanel$/);
  });

  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    for (const theme of ["light", "dark"] as const) {
      test(`yatay taşma yok ${viewport.width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.addInitScript((saved) => localStorage.setItem("mulk-theme", saved), theme);
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.locator("html").evaluate((el) => el.classList.contains("dark"))).toBe(theme === "dark");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        await expect(page.getByRole("button", { name: theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç" })).toBeVisible();
      });
    }
  }
});

test("oturum açıkken tanıtım sayfası Panele git gösterir", async ({ page }) => {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.goto("/");
  const link = page.getByRole("link", { name: "Panele git" }).first();
  await expect(link).toHaveAttribute("href", "/panel");
  await expect(page.getByRole("link", { name: "Hesap oluştur" })).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(/\/panel$/);
});
