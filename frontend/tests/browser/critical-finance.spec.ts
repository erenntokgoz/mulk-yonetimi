import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:5089";

async function createActiveLease(page: import("@playwright/test").Page) {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.goto("/giris");
  return page.evaluate(async () => {
    const headers = { "Content-Type": "application/json" };
    const post = (path: string, body: unknown) => fetch(path, { method: "POST", headers, body: JSON.stringify(body) }).then(response => response.json());
    const property = await post("/api/bff/properties", { name: "Kule", address: "Ankara", propertyKind: "MULTI_UNIT" });
    const unit = await post(`/api/bff/properties/${property.id}/units`, { label: "2", usageType: "RESIDENTIAL", doorNumber: null, areaM2: null });
    const tenant = await post("/api/bff/tenants", { firstName: "Ada", lastName: "Yılmaz", email: null, phone: null });
    const lease = await post("/api/bff/leases", { unitId: unit.id, tenantId: tenant.id, startDate: "2026-01-01", plannedEndDate: "2026-12-31", dueDay: 1, monthlyAmount: 12000, depositAmount: 0, note: null });
    await post(`/api/bff/leases/${lease.id}/activate`, { version: lease.version });
    return { lease, tenant };
  });
}

test.beforeEach(async ({ request }) => { await request.post(`${fixture}/reset-data`); });

test("records a rent receipt and updates the visible unallocated balance", async ({ page }) => {
  const { tenant } = await createActiveLease(page);
  await page.goto("/kira-tahsilatlar");
  await page.getByLabel("Tutar (₺)").fill("12000");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(page.getByText(/12\.000,00 ₺ · Dağıtılan 0,00 ₺ · Bekleyen 12\.000,00 ₺/)).toBeVisible();
  expect(tenant.id).toBeTruthy();
});

test("renews an active lease and shows its recorded history", async ({ page }) => {
  await createActiveLease(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/sozlesmeler");
  await page.getByRole("button", { name: "Yenile" }).click();
  const form = page.getByRole("heading", { name: "Sözleşmeyi yenile" }).locator(".." );
  await page.getByLabel("Yeni bitiş tarihi").fill("2027-12-31");
  await page.getByLabel("Yeni bedelin başlangıcı").fill("2027-01-01");
  await page.getByLabel("Aylık kira (₺)").fill("13500");
  await page.getByLabel("Gerekçe").fill("Yıllık yenileme");
  await expect(form).toHaveScreenshot("lease-renewal-form-mobile.png");
  await page.getByRole("button", { name: "Yenilemeyi kaydet" }).click();
  await expect(page.getByText(/2026-12-31 → 2027-12-31 · 2027-01-01/)).toBeVisible();
});
