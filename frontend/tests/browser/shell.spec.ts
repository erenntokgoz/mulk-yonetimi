import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const luminance = (c: string) => {
  const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const bg = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe("masaüstü 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("kenar çubuğu daralır, genişler, durumu hatırlar ve çekmece açılmaz", async ({ page }) => {
    await page.goto("/panel");
    const sidebar = page.locator("#app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeHidden();
    const toggle = page.getByRole("button", { name: "Kenar çubuğunu daralt" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");
    const wide = (await sidebar.boundingBox())!.width;
    await toggle.click();
    await expect(page.getByRole("button", { name: "Kenar çubuğunu genişlet" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
    await expect(sidebar.getByRole("link", { name: "Portföy" })).toBeVisible();
    const box = (await sidebar.boundingBox())!;
    expect((await page.locator("main").boundingBox())!.x).toBeGreaterThanOrEqual(box.x + box.width);
    await page.reload();
    await expect(page.getByRole("button", { name: "Kenar çubuğunu genişlet" })).toBeVisible();
    await page.getByRole("button", { name: "Kenar çubuğunu genişlet" }).click();
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(wide - 2);
    expect((await page.locator("main").boundingBox())!.x).toBeGreaterThanOrEqual(wide);
  });
});

for (const width of [768, 375]) {
  test.describe(`${width}px: yalnız hamburger ve çekmece`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("kenar çubuğu gizli, çekmece scrim ile açılır, odak içeride kalır, Escape ve scrim kapatır", async ({ page }) => {
      await page.goto("/panel");
      await expect(page.locator("#app-sidebar")).toBeHidden();
      await expect(page.getByRole("button", { name: /Kenar çubuğunu/ })).toBeHidden();
      const hamburger = page.getByRole("button", { name: "Menüyü aç" });
      await expect(hamburger).toHaveAttribute("aria-controls", /.+/);
      await hamburger.click();
      await expect(page.locator("button[aria-label=\"Menüyü aç\"]")).toHaveAttribute("aria-expanded", "true");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.locator("[data-scrim]")).toBeVisible();
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await hamburger.click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(width - 5, 450);
      await expect(dialog).toBeHidden();
    });

    for (const theme of ["light", "dark"] as const) {
      test(`menü, içerik ve kartlar aynı temayı kullanır (${theme})`, async ({ page }) => {
        await page.addInitScript((saved) => localStorage.setItem("mulk-theme", saved), theme);
        await page.goto("/panel");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const light = theme === "light";
        const toggleName = light ? "Koyu temaya geç" : "Açık temaya geç";
        await expect(page.getByRole("button", { name: toggleName })).toBeVisible();
        await page.getByRole("button", { name: "Menüyü aç" }).click();
        for (const selector of ["[role=dialog]", "body", "main .bg-card"]) {
          expect(luminance(await bg(page, selector)) > 0.4, `${theme} ${selector}`).toBe(light);
        }
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: toggleName }).click();
        await page.getByRole("button", { name: "Menüyü aç" }).click();
        for (const selector of ["[role=dialog]", "body", "main .bg-card"]) {
          expect(luminance(await bg(page, selector)) > 0.4, `${selector} sonrası`).toBe(!light);
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: light ? "Açık temaya geç" : "Koyu temaya geç" })).toHaveCount(1);
      });
    }
  });
}
