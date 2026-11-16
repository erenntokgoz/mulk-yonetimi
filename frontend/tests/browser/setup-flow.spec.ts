import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

const toaster = (page: Page) => page.locator(".toaster");

test("each wizard step opens its form, the toast links onward, and setup completes", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await signIn(page);
  const wizard = page.getByRole("region", { name: /Kurulum/ });

  await wizard.getByRole("link", { name: "Mülk ekle" }).click();
  await expect(page).toHaveURL(/\/portfoy$/);
  await expect(page.getByLabel("Mülk adı")).toBeFocused();
  await page.getByLabel("Mülk adı").fill("Kule");
  await page.getByLabel("Adres").fill("Ankara");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("[data-toast-live=polite]")).toContainText("Mülk eklendi.");
  await toaster(page).getByRole("link", { name: "Kuruluma dön" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(wizard.locator("li").nth(0)).toContainText("1 mülk");
  await expect(wizard.locator('li[aria-current="step"]')).toContainText("Bölüm");

  await wizard.getByRole("link", { name: "Daire ekle" }).click();
  await expect(page.getByLabel("Birim etiketi")).toBeFocused();
  await page.getByLabel("Birim etiketi").fill("Daire 1");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  const next = toaster(page).getByRole("link", { name: "Sonraki adım" });
  await expect(next).toHaveAttribute("href", "/kiracilar?yeni=1");
  await next.click();
  await expect(page).toHaveURL(/\/kiracilar$/);
  await expect(page.getByLabel("Kiracı türü")).toBeFocused();
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Kiracıyı kaydet" }).click();
  await expect(toaster(page).getByText("Kiracı eklendi.")).toBeVisible();
  await toaster(page).getByRole("link", { name: "Sonraki adım" }).click();

  await expect(page).toHaveURL(/\/sozlesmeler$/);
  await expect(page.getByLabel("Birim")).toBeFocused();
  await page.getByLabel("Aylık kira (₺)").fill("12500");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(toaster(page).getByText("Sözleşme taslağı kaydedildi.")).toBeVisible();
  await expect(toaster(page).getByRole("link", { name: "Kuruluma dön" })).toBeVisible();
  await page.getByRole("button", { name: "Etkinleştir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Etkinleştir" }).click();
  await expect(toaster(page).getByText("Sözleşme etkinleştirildi.")).toBeVisible();
  await toaster(page).locator("[data-kind=success]").filter({ hasText: "Sözleşme etkinleştirildi." })
    .getByRole("link", { name: "Sonraki adım" }).click();

  await expect(page).toHaveURL(/\/kira-tahsilatlar$/);
  await expect(page.getByRole("form", { name: "Tahsilat kaydı" }).getByLabel("Kiracı")).toBeFocused();
  await page.getByRole("form", { name: "Tahsilat kaydı" }).getByLabel("Tutar (₺)").fill("12500");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(toaster(page).getByText("Kurulum tamamlandı.")).toBeVisible();
  await expect(toaster(page).getByText("Tahsilat kaydedildi.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kurulum" })).toHaveCount(0);

  await page.goto("/panel");
  await expect(page.locator("#month-title")).toBeVisible();
  await expect(page.getByRole("region", { name: /Kurulum/ })).toHaveCount(0);
});

test("wizard summaries come from real records", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await signIn(page);
  await page.evaluate(async () => {
    const headers = { "Content-Type": "application/json" };
    const property = await (await fetch("/api/bff/properties", { method: "POST", headers, body: JSON.stringify({ name: "A", address: "B", propertyKind: "MULTI_UNIT", defaultUnitUsageType: null }) })).json();
    for (const label of ["1", "2", "3"])
      await fetch(`/api/bff/properties/${property.id}/units`, { method: "POST", headers, body: JSON.stringify({ label, usageType: "RESIDENTIAL", doorNumber: null, areaM2: null }) });
    for (const firstName of ["Ada", "Can"])
      await fetch("/api/bff/tenants", { method: "POST", headers, body: JSON.stringify({ kind: "PERSON", firstName, lastName: "Y", companyName: null, phone: null, email: null }) });
  });
  await page.reload();
  const steps = page.getByRole("region", { name: /Kurulum/ }).locator("li");
  await expect(steps.nth(0)).toContainText("1 mülk");
  await expect(steps.nth(1)).toContainText("3 bölüm");
  await expect(steps.nth(2)).toContainText("2 kiracı");
  await expect(steps.nth(3)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(3).getByRole("link", { name: "Sözleşme aç" })).toHaveAttribute("href", "/sozlesmeler?yeni=1");
});

test("a failed row action shows an assertive error toast that can be dismissed", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await signIn(page);
  await page.evaluate(() => fetch("/api/bff/properties", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Kule", address: "Ankara", propertyKind: "MULTI_UNIT", defaultUnitUsageType: null }) }));
  await page.route("**/api/bff/properties/*", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.fallback());
  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülkü arşivle" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Arşivle" }).click();
  await expect(page.locator("[data-toast-live=assertive]")).toContainText("Mülk arşivlenemedi.");
  const card = toaster(page).locator("[data-kind=error]");
  await expect(card).toContainText("Mülk arşivlenemedi.");
  await expect(page.locator("p[role=alert]")).toHaveCount(0);
  await card.getByRole("button", { name: "Mesajı gizle" }).focus();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(page.getByText("Kule", { exact: true }).first()).toBeVisible();
});
