import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:5089/state";

for (const [state, label] of [
  ["Healthy", "Çalışıyor"],
  ["Degraded", "Kısıtlı çalışıyor"],
  ["Unhealthy", "Hizmet kullanılamıyor"],
  ["Disconnected", "Bağlantı kurulamadı"],
] as const) {
  test(`renders ${state} service status accessibly`, async ({ page, request }) => {
    expect((await request.post(fixtureUrl, { data: state })).ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Genel bakış" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(label);
    if (state !== "Disconnected") {
      await expect(page.getByText("SQL Server", { exact: true })).toBeVisible();
      await expect(page.locator("dd")).toHaveText(label);
    } else {
      await expect(page.getByText(/Hizmet durumu alınamadı/)).toBeVisible();
    }
  });
}

test("shows configuration failure without exposing server details", async ({ page }) => {
  await page.goto("http://127.0.0.1:3110");
  await expect(page.getByRole("status")).toHaveText("Bağlantı kurulamadı");
  await expect(page.getByText(/Hizmet bağlantısı yapılandırılmamış/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("BACKEND_BASE_URL");
});

test("keyboard skip link focuses main, then refresh retrieves changed status", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Çalışıyor");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "İçeriğe geç" });
  await expect(skipLink).toBeFocused();
  const bounds = await skipLink.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Durumu yenile" })).toBeFocused();
  expect((await request.post(fixtureUrl, { data: "Unhealthy" })).ok()).toBeTruthy();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Hizmet kullanılamıyor");
});

test("mobile shell keeps navigation and refresh usable without horizontal overflow", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Durumu yenile" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("reference desktop shell uses 56px sidebar and compact breadcrumb header", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Uygulama" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(56);
  await expect(page.getByRole("navigation", { name: "İçerik yolu" })).toBeVisible();
});

test("reference mobile menu opens with keyboard and closes with Escape", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menüyü aç" });
  await expect(menu).toBeVisible();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Ana menü" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ana menü" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
