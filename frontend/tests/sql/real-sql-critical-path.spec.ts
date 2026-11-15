import { expect, test } from "@playwright/test";

const email = process.env.MULK_SQL_E2E_EMAIL;
const password = process.env.MULK_SQL_E2E_PASSWORD;
const frontendOrigin = "http://127.0.0.1:3120";

async function signIn(page: import("@playwright/test").Page) {
  if (!email || !password) throw new Error("MULK_SQL_E2E_EMAIL and MULK_SQL_E2E_PASSWORD must identify the verified SQL test user.");
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel(?:\?|$)/);
  expect((await page.request.get("/api/bff/me")).status()).toBe(200);
}

function date(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function displayDate(value: Date) {
  return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
}

async function postJson(page: import("@playwright/test").Page, path: string, data: object) {
  const response = await page.request.post(path, { headers: { Origin: frontendOrigin }, data });
  expect(response.ok(), `POST ${path} returned ${response.status()}: ${await response.text()}`).toBe(true);
  return response.json();
}

async function createActiveLease(page: import("@playwright/test").Page, suffix: string) {
  const today = new Date();
  const endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const property = await postJson(page, "/api/bff/properties", { name: `SQL Mülk ${suffix}`, address: `Test ${suffix}`, propertyKind: "MULTI_UNIT" });
  const unit = await postJson(page, `/api/bff/properties/${property.id}/units`, { label: `Daire ${suffix}`, usageType: "RESIDENTIAL", doorNumber: null, areaM2: null });
  const tenant = await postJson(page, "/api/bff/tenants", { kind: "PERSON", firstName: `Test${suffix}`, lastName: "Kiracı", email: null, phone: null });
  const lease = await postJson(page, "/api/bff/leases", { unitId: unit.id, tenantId: tenant.id, startDate: date(today), plannedEndDate: date(endDate), dueDay: 1, monthlyAmount: 12000, depositAmount: 0, note: null });
  const activation = await page.request.post(`/api/bff/leases/${lease.id}/activate`, {
    headers: { Origin: frontendOrigin }, data: { version: lease.version }
  });
  expect(activation.status()).toBe(200);
  return { tenant, endDate, unitLabel: `Daire ${suffix}`, tenantLabel: `Test${suffix} Kiracı` };
}

test("verified owner completes property, unit, tenant, and lease onboarding through SQL-backed routes at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const propertyName = `E2E Mülk ${suffix}`;
  const tenantName = `Test${suffix} Kiralama`;
  const today = new Date();
  const endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill(propertyName);
  await page.getByLabel("Adres").fill(`Test adresi ${suffix}`);
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
  await page.getByRole("button", { name: "Birimler" }).click();
  await page.getByLabel("Birim etiketi").fill(`Daire ${suffix}`);
  await page.getByLabel("Kullanım türü").selectOption("RESIDENTIAL");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  await expect(page.getByText(`Daire ${suffix}`, { exact: true })).toBeVisible();

  await page.goto("/kiracilar");
  await page.getByRole("button", { name: "Kiracı ekle" }).click();
  await page.getByLabel("Ad", { exact: true }).fill(`Test${suffix}`);
  await page.getByLabel("Soyad").fill("Kiralama");
  await page.getByRole("button", { name: "Kiracıyı kaydet" }).click();
  await expect(page.getByText(tenantName)).toBeVisible();

  await page.goto("/sozlesmeler");
  await page.getByRole("button", { name: "Sözleşme oluştur" }).click();
  await page.getByLabel("Birim").selectOption({ label: `Daire ${suffix}` });
  await page.getByLabel("Kiracı").selectOption({ label: tenantName });
  await page.getByLabel("Başlangıç tarihi").fill(date(today));
  await page.getByLabel("Planlanan bitiş tarihi").fill(date(endDate));
  await page.getByLabel("Aylık kira (₺)").fill("12000");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByText("Taslak", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Etkinleştir" }).click();
  await page.getByRole("dialog", { name: "Sözleşme etkinleştirilsin mi?" }).getByRole("button", { name: "Etkinleştir" }).click();
  await expect(page.getByText("Etkin", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("owner records a receipt and exports the payment list through SQL-backed routes at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const { tenant } = await createActiveLease(page, suffix);
  await page.goto("/kira-tahsilatlar");
  await page.getByLabel("Kiracı").selectOption({ label: `Test${suffix} Kiracı` });
  await page.getByLabel("Tutar (₺)").fill("12000");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(page.getByText(/12\.000,00 ₺ · Dağıtılan 0,00 ₺ · Bekleyen 12\.000,00 ₺/)).toBeVisible();

  await page.goto("/raporlar");
  const today = new Date();
  const fromDate = `${today.getFullYear()}-01-01`;
  const toDate = date(today);
  await page.getByLabel("Başlangıç tarihi").fill(fromDate);
  await page.getByLabel("Bitiş tarihi").fill(toDate);
  const report = page.getByRole("link", { name: "Tahsilatlar CSV" });
  const expectedHref = `/api/bff/reports/payments.csv?fromDate=${fromDate}&toDate=${toDate}`;
  await expect(report).toHaveAttribute("href", expectedHref);
  // download özniteliği olan bağlantının isteği tarayıcının indirme yöneticisinden geçer ve sayfada response olayı üretmez.
  const downloadPromise = page.waitForEvent("download");
  await report.click();
  const download = await downloadPromise;
  expect(download.url()).toBe(`${frontendOrigin}${expectedHref}`);
  expect(download.suggestedFilename()).toBe("payments.csv");
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const downloadedCsv = Buffer.concat(chunks).toString("utf8");
  expect(downloadedCsv).toContain(tenant.id);
  expect(downloadedCsv).toContain("12000.00");
  const response = await page.request.get(expectedHref);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toContain("payments.csv");
});

test("owner renews an active lease and sees its history through SQL-backed routes at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const { endDate, unitLabel, tenantLabel } = await createActiveLease(page, suffix);
  const renewedEndDate = new Date(endDate.getFullYear() + 1, endDate.getMonth(), endDate.getDate());
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  await page.goto("/sozlesmeler");
  await page.getByRole("heading", { name: `${unitLabel} · ${tenantLabel}` })
    .locator("xpath=../../..").getByRole("button", { name: "Yenile" }).click();
  await page.getByLabel("Yeni bitiş tarihi").fill(date(renewedEndDate));
  await page.getByLabel("Yeni bedelin başlangıcı").fill(date(nextMonth));
  await page.getByLabel("Aylık kira (₺)").fill("13500");
  await page.getByLabel("Gerekçe").fill("SQL E2E dönem yenilemesi");
  await page.getByRole("button", { name: "Yenilemeyi kaydet" }).click();
  await expect(page.getByText(`${displayDate(endDate)} → ${displayDate(renewedEndDate)} · ${displayDate(nextMonth)}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
