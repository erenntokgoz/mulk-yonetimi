import { expect, test } from "@playwright/test";
test.use({ video: "on", viewport: { width: 1440, height: 900 } });

test("portfolio view switches without losing records and respects reduced motion", async ({ page }) => {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.route("**/api/bff/properties?*", route => route.fulfill({ json: { items: [
    { id: "reference-test", name: "Görsel test mülkü", address: "Yalnız tarayıcı testi", propertyKind: "MULTI_UNIT", archivedAtUtc: null, version: "AAAAAAAAAAA=" },
  ], page: 1, pageSize: 100, hasMore: false } }));
  await page.goto("/portfoy");
  await expect(page.getByRole("button", { name: "Tablo görünümü" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table")).toContainText("Görsel test mülkü");
  await page.screenshot({ path: "test-results/glass-table-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Kart görünümü" }).click();
  await expect(page.getByRole("button", { name: "Kart görünümü" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Görsel test mülkü" })).toBeVisible();
  await page.screenshot({ path: "test-results/glass-cards-desktop.png", fullPage: true, animations: "disabled" });
  await expect(page.locator("[draggable=true]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Tablo görünümü" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expect(page.locator(".app-shell")).toHaveCSS("padding-left", "0px");
  await expect(page.locator(".workspace")).toHaveCSS("padding-left", "0px");
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, app: [".app-shell", ".workspace", ".workspace-main", ".route-surface"].map(selector => { const element = document.querySelector(selector); const rect = element?.getBoundingClientRect(); return { selector, left: rect?.left, width: rect?.width, paddingLeft: element ? getComputedStyle(element).paddingLeft : "" }; }) }));
  expect(overflow.scroll <= overflow.width, JSON.stringify(overflow)).toBeTruthy();
  await page.screenshot({ path: "test-results/glass-mobile.png", fullPage: true, animations: "disabled" });
});
