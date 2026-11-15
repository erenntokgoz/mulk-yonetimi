import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:5089/state";

test("dashboard does not show service health panels", async ({ page }) => {
  await page.goto("/panel");
  await expect(page.getByRole("heading", { level: 1, name: "Genel bakış" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sistem durumu" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Hizmet kontrolleri" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("BACKEND_BASE_URL");
});

test("keyboard skip link focuses main", async ({ page }) => {
  await page.goto("/panel");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "İçeriğe geç" });
  await expect(skipLink).toBeFocused();
  const bounds = await skipLink.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("mobile shell keeps navigation usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/panel");
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("desktop shell uses text navigation and breadcrumb header", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/panel");
  const sidebar = page.getByRole("complementary", { name: "Uygulama" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(264);
  await expect(page.getByRole("navigation", { name: "İçerik yolu" })).toBeVisible();
});

test("section navigation groups links and filters them by label", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Disconnected" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/panel");
  const nav = page.getByRole("navigation", { name: "Ana gezinme" });
  await expect(nav.getByText("MÜLK YÖNETİMİ", { exact: true })).toBeVisible();
  await expect(nav.getByText("FİNANS", { exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Menüde ara" });
  await search.fill("kira");
  await expect(nav.getByRole("link", { name: "Kira ve tahsilatlar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Portföy" })).toHaveCount(0);
  await search.fill("eşleşmeyen bölüm");
  await expect(nav.getByRole("status")).toHaveText("Eşleşen bölüm yok.");
  await search.clear();
  await expect(nav.getByRole("link", { name: "Portföy" })).toBeVisible();
  await page.getByRole("navigation", { name: "İçerik yolu" }).click();
  await page.screenshot({ path: "frontend-theme-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  const mobileNav = page.getByRole("dialog", { name: "Ana menü" }).getByRole("navigation", { name: "Ana gezinme" });
  await expect(mobileNav.getByRole("searchbox", { name: "Menüde ara" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("dashboard shows real portfolio summary", async ({ page }) => {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/panel");
  await expect(page.getByRole("heading", { level: 1, name: "Genel bakış" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cari ay nakit akışı" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect(page.getByRole("main").locator(":scope > div")).toHaveCSS("opacity", "1");
});

test("reference mobile menu opens with keyboard and closes with Escape", async ({ page, request }) => {
  expect((await request.post(fixtureUrl, { data: "Healthy" })).ok()).toBeTruthy();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/panel");
  const menu = page.getByRole("button", { name: "Menüyü aç" });
  await expect(menu).toBeVisible();
  await menu.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Ana menü" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ana menü" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

const connectedSections = [
  ["belgeler", "Belgeler", "Belgeleri görmek için giriş yapın."],
  ["bildirimler", "Bildirimler", "Bildirimleri görmek için giriş yapın."],
  ["ayarlar", "Ayarlar", "Profil görmek için giriş yapın."],
] as const;

test("documents, notifications, and settings show API sign-in states without placeholder data", async ({ page }) => {
  for (const [path, title, message] of connectedSections) {
    await page.goto(`/${path}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main [role=alert]")).toContainText(message);
    await expect(page.locator("main [role=alert] a[href='/giris']")).toBeVisible();
    await expect(page.getByTestId("unavailable-state")).toHaveCount(0);
  }
  await page.goto("/bilinmeyen");
  await expect(page.getByRole("heading", { level: 1, name: "Sayfa bulunamadı" })).toBeVisible();
});

test("rent charges and payments load from the API and idempotent actions can be retried", async ({ page }) => {
  await page.request.post("http://127.0.0.1:5089/reset-data");
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("fixture@example.test");
  await page.getByLabel("Parola").fill("FixturePass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL("/panel");
  const setup = await page.evaluate(async () => {
    const headers = { "Content-Type": "application/json" };
    const propertyResponse = await fetch("/api/bff/properties", { method: "POST", headers, body: JSON.stringify({ name: "Test mülk", address: "Test adres", propertyKind: "MULTI_UNIT", defaultUnitUsageType: null }) });
    const property = await propertyResponse.json();
    const unitResponse = await fetch(`/api/bff/properties/${property.id}/units`, { method: "POST", headers, body: JSON.stringify({ label: "1", usageType: "RESIDENTIAL", doorNumber: null, areaM2: null }) });
    const unit = await unitResponse.json();
    const tenantResponse = await fetch("/api/bff/tenants", { method: "POST", headers, body: JSON.stringify({ kind: "PERSON", firstName: "Ada", lastName: "Yılmaz", companyName: null, phone: null, email: null }) });
    const tenant = await tenantResponse.json();
    const leaseResponse = await fetch("/api/bff/leases", { method: "POST", headers, body: JSON.stringify({ unitId: unit.id, tenantId: tenant.id, startDate: "2026-01-01", plannedEndDate: null, dueDay: 1, monthlyAmount: 12500, depositAmount: 0, note: null }) });
    const lease = await leaseResponse.json();
    await fetch(`/api/bff/leases/${lease.id}/activate`, { method: "POST", headers, body: JSON.stringify({ version: lease.version }) });
    return { tenantId: tenant.id };
  });
  expect(setup.tenantId).toBeTruthy();
  await page.goto("/kira-tahsilatlar");
  await expect(page.getByRole("heading", { name: "Alacaklar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ada Yılmaz · 2026-01/ })).toBeVisible();
  await page.request.post("http://127.0.0.1:5089/finance-fail-once");
  await page.getByLabel("Tutar (₺)").fill("12500.00");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(page.getByRole("button", { name: "Aynı isteği tekrar dene" })).toBeVisible();
  await page.getByRole("button", { name: "Aynı isteği tekrar dene" }).click();
  await expect.poll(async () => (await (await page.request.get("http://127.0.0.1:5089/finance-retry-verified")).json()).verified).toBe(true);
  await expect(page.getByText(/Dağıtılan 0,00 ₺ · Bekleyen 12\.500,00 ₺/)).toBeVisible();
  await page.getByRole("button", { name: "Tahsilat dağıt" }).click();
  await page.getByRole("button", { name: "Dağıtımı kaydet" }).click();
  await expect(page.getByText("Vade 2026-01-01 · Ödendi")).toBeVisible();
  await expect(page.getByText("Alacak 12.500,00 ₺ · Ödenen 12.500,00 ₺ · Bakiye", { exact: false })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept("Test iptali"));
  await page.getByRole("button", { name: "İptal et" }).click();
  await expect(page.getByText("İptal edildi")).toBeVisible();
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
  await page.goto("/panel");
  await expect(page.locator("body")).not.toContainText("Mülklerinizi yöneteceğiniz çalışma alanına hoş geldiniz");
});

test("theme control switches between dark and light and persists", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("theme-test-init")) {
      localStorage.removeItem("mulk-theme");
      sessionStorage.setItem("theme-test-init", "1");
    }
  });
  await page.goto("/panel");
  const root = page.locator("html");
  await expect(root).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Açık temaya geç" }).click();
  await expect(root).not.toHaveClass(/dark/);
  await expect(page.locator("main .bg-card").first()).toHaveCSS("opacity", "1");
  await expect(page.locator("main .bg-card").first()).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  await page.screenshot({ path: "frontend-theme-light.png", fullPage: true });
  await page.reload();
  await expect(root).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Koyu temaya geç" })).toBeVisible();
});

test("authentication screens expose the same theme control", async ({ page }) => {
  for (const path of ["/giris", "/kayit", "/parolami-unuttum", "/parola-sifirla", "/dogrula", "/dogrulama-yeniden-gonder"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Açık temaya geç" })).toBeVisible();
  }
});

test("theme motion respects reduced-motion preference", async ({ page }) => {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/panel");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(5, 7, 12)");
  const card = page.getByRole("heading", { name: "Cari ay nakit akışı" });
  await expect(card).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("animation-duration", "1e-05s");
});

test("portfolio creates and archives a property through the BFF", async ({ page }) => {
  await page.request.post("http://127.0.0.1:5089/reset-data");
  await page.request.post("http://127.0.0.1:5089/properties-delay", { data: "450" });
  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill("owner@example.test");
  await page.getByLabel("Parola").fill("Valid-Password-123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.goto("/portfoy");
  await expect(page.getByText("Henüz mülk kaydı yok")).toBeVisible();
  await page.request.post("http://127.0.0.1:5089/properties-delay", { data: "0" });
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill("Ev");
  await page.getByLabel("Adres").fill("İstanbul");
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ev", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Birimler" }).click();
  await expect(page.getByText("Bu mülkte henüz birim yok.")).toBeVisible();
  await page.getByLabel("Birim etiketi").fill("Daire 1");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  await expect(page.getByText("Daire 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();
  await page.getByRole("button", { name: "Mülkü düzenle" }).click();
  await page.getByLabel("Mülk adı").fill("Daire");
  await page.getByLabel("Adres").fill("Kadıköy");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Daire", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mülkü düzenle" }).click();
  await page.getByLabel("Mülk adı").fill("Conflict");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("başka bir işlemde değişti");
  await page.getByRole("button", { name: "Listeyi yenile" }).click();
  await expect(page.getByText("Daire", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Mülkü arşivle" }).click();
  await expect(page.getByText("Daire", { exact: true })).toHaveCount(0);
});

test("portfolio explains that authentication is required when the API returns 401", async ({ page }) => {
  await page.goto("/portfoy");
  await expect(page.locator("p[role=alert]")).toContainText("Mülklerinizi görmek için giriş yapın.");
});

test("tenant directory creates, edits, handles a version conflict, and archives", async ({ page }) => {
  await page.request.post("http://127.0.0.1:5089/reset-data");
  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill("owner@example.test");
  await page.getByLabel("Parola").fill("Valid-Password-123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.goto("/kiracilar");
  await expect(page.getByText("Kiracı kaydı bulunamadı")).toBeVisible();
  await page.getByRole("button", { name: "Kiracı ekle" }).click();
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Kiracıyı kaydet" }).click();
  await expect(page.getByText("Ayşe Yılmaz")).toBeVisible();
  await page.getByRole("button", { name: "Kiracıyı düzenle" }).click();
  await page.getByLabel("Soyad").fill("Demir");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Ayşe Demir")).toBeVisible();
  await page.getByRole("button", { name: "Kiracıyı düzenle" }).click();
  await page.getByLabel("E-posta").fill("conflict@example.test");
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("başka bir işlemde değişti");
  await page.getByRole("button", { name: "Listeyi yenile" }).click();
  await expect(page.getByText("Ayşe Demir")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Kiracıyı arşivle" }).click();
  await expect(page.getByText("Ayşe Demir")).toHaveCount(0);
  await page.getByLabel("Arşivlenenleri göster").check();
  await expect(page.getByText("Ayşe Demir")).toBeVisible();
});

test("lease workflow creates a draft, activates it, records a rate, and terminates", async ({ page }) => {
  await page.request.post("http://127.0.0.1:5089/reset-data");
  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill("owner@example.test");
  await page.getByLabel("Parola").fill("Valid-Password-123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect.poll(async () => (await page.request.get("/api/bff/me")).status()).toBe(200);
  const propertyResponse = await page.evaluate(async () => {
    const response = await fetch("/api/bff/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Sözleşme mülkü", address: "İstanbul", propertyKind: "MULTI_UNIT", defaultUnitUsageType: null }) });
    return { status: response.status, body: await response.text() };
  });
  expect(propertyResponse.status).toBe(201);
  const property = JSON.parse(propertyResponse.body);
  const unitResponse = await page.evaluate(async (id) => {
    const response = await fetch(`/api/bff/properties/${id}/units`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Daire 2", usageType: "RESIDENTIAL", doorNumber: null, areaM2: 85 }) });
    return { status: response.status, body: await response.text() };
  }, property.id);
  expect(unitResponse.status).toBe(201);
  const unit = JSON.parse(unitResponse.body);
  const tenantResponse = await page.evaluate(async () => {
    const response = await fetch("/api/bff/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "PERSON", firstName: "Deniz", lastName: "Kaya", companyName: null, phone: null, email: null }) });
    return { status: response.status, body: await response.text() };
  });
  expect(tenantResponse.status).toBe(201);
  const tenant = JSON.parse(tenantResponse.body);

  await page.goto("/sozlesmeler");
  await page.getByRole("button", { name: "Sözleşme oluştur" }).click();
  await page.getByLabel("Birim").selectOption(unit.id);
  await page.getByLabel("Kiracı").selectOption(tenant.id);
  await page.getByLabel("Aylık kira (₺)").fill("12500.50");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByText("Taslak", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Etkinleştir" }).click();
  await expect(page.getByText("Etkin", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kira bedelleri" }).first().click();
  await expect(page.getByText("12.500,50 ₺")).toBeVisible();
  await page.getByLabel("Aylık kira (₺)").fill("13000.00");
  await page.getByLabel("Gerekçe").fill("Dönem güncellemesi");
  await page.getByRole("button", { name: "Bedeli kaydet" }).click();
  await expect(page.getByText("13.000,00 ₺")).toBeVisible();
  await page.getByRole("button", { name: "Sonlandır" }).click();
  await page.locator('form').filter({ has: page.getByRole("button", { name: "Sonlandırmayı kaydet" }) }).getByLabel("Gerekçe").fill("Sözleşme sona erdi");
  await page.getByRole("button", { name: "Sonlandırmayı kaydet" }).click();
  await expect(page.getByText("Sonlandırıldı", { exact: true })).toBeVisible();
});



