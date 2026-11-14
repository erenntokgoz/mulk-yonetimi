import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("klavye kısayolları 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Ctrl+B kenar çubuğunu değiştirir, metin alanında çalışmaz; Ctrl+K aramaya odaklanır ve geri döner", async ({ page }) => {
    await page.goto("/panel");
    await expect(page.getByRole("button", { name: "Kenar çubuğunu daralt" })).toHaveAttribute("aria-keyshortcuts", "Control+B Meta+B");
    const search = page.getByRole("searchbox", { name: "Menüde ara" });
    await expect(search).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    await page.keyboard.press("Control+b");
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    await page.keyboard.press("Control+b");
    await expect(page.locator("html")).not.toHaveAttribute("data-sidebar", "collapsed");

    const toggle = page.getByRole("button", { name: "Kenar çubuğunu daralt" });
    await toggle.focus();
    await page.keyboard.press("Control+k");
    await expect(search).toBeFocused();
    await page.keyboard.press("Control+b");
    await expect(page.locator("html")).not.toHaveAttribute("data-sidebar", "collapsed");
    await page.keyboard.press("Control+k");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(search).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
  });
});

test.describe("klavye kısayolları 375px", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("Ctrl+B çekmeceyi açıp kapatır; Ctrl+K çekmeceyi açıp aramaya odaklanır", async ({ page }) => {
    await page.goto("/panel");
    const hamburger = page.getByRole("button", { name: "Menüyü aç" });
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("link", { name: "Portföy" }).focus();
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await hamburger.focus();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    const search = page.getByRole("dialog").getByRole("searchbox", { name: "Menüde ara" });
    await expect(search).toBeFocused();
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(hamburger).toBeFocused();
  });
});
