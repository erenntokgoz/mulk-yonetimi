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

test("desktop shell uses text navigation and breadcrumb header", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Uygulama" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(224);
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

const sections = [
  ["portfoy", "Portföy"],
  ["kiracilar", "Kiracılar"],
  ["sozlesmeler", "Sözleşmeler"],
  ["kira-tahsilatlar", "Kira ve tahsilatlar"],
  ["depozitolar", "Depozitolar"],
  ["giderler", "Giderler"],
  ["belgeler", "Belgeler"],
  ["raporlar", "Raporlar"],
  ["bildirimler", "Bildirimler"],
  ["ayarlar", "Ayarlar"],
] as const;

test("core pages show unavailable states without placeholder data", async ({ page }) => {
  for (const [path, title] of sections) {
    await page.goto(`/${path}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByTestId("unavailable-state")).toContainText("şu anda kullanıma açık değil");
    await expect(page.locator("main button")).toHaveCount(0);
  }
  await page.goto("/bilinmeyen");
  await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
});

test("desktop and mobile navigation open core pages and mark the active route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/portfoy");
  const desktopNav = page.getByRole("navigation", { name: "Ana gezinme" });
  await expect(desktopNav.getByRole("link", { name: "Portföy" })).toHaveAttribute("aria-current", "page");
  await desktopNav.getByRole("link", { name: "Kiracılar" }).click();
  await expect(page).toHaveURL(/\/kiracilar$/);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("dialog", { name: "Ana menü" }).getByRole("link", { name: "Sözleşmeler" }).click();
  await expect(page).toHaveURL(/\/sozlesmeler$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("dashboard has no generic welcome copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText("Mülklerinizi yöneteceğiniz çalışma alanına hoş geldiniz");
});
