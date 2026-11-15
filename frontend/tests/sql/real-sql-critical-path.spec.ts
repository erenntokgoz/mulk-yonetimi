import { expect, test } from "@playwright/test";

const email = process.env.MULK_SQL_E2E_EMAIL;
const password = process.env.MULK_SQL_E2E_PASSWORD;

test("verified owner creates a property, tenant, active lease, receipt, and renewal through the SQL-backed API", async ({ page }) => {
  if (!email || !password) throw new Error("MULK_SQL_E2E_EMAIL and MULK_SQL_E2E_PASSWORD must identify the verified SQL test user.");

  const suffix = crypto.randomUUID().slice(0, 8);
  const propertyName = `E2E Mülk ${suffix}`;
  const firstName = `Test${suffix}`;
  const today = new Date();
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const renewedEndDate = new Date(endDate.getFullYear() + 1, endDate.getMonth(), endDate.getDate());
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel(?:\?|$)/);
  const session = await page.request.get("/api/bff/me");
  expect(session.status()).toBe(200);

  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill(propertyName);
  await page.getByLabel("Adres").fill(`Test adresi ${suffix}`);
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  const propertyRow = page.getByRole("row").filter({ hasText: propertyName });
  await expect(propertyRow).toBeVisible();
  await propertyRow.getByRole("button", { name: "Birimler" }).click();
  await page.getByLabel("Birim etiketi").fill(`Daire ${suffix}`);
  await page.getByLabel("Kullanım türü").selectOption("RESIDENTIAL");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  await expect(page.getByText(`Daire ${suffix}`, { exact: true })).toBeVisible();

  await page.goto("/kiracilar");
  await page.getByRole("button", { name: "Kiracı ekle" }).click();
  await page.getByLabel("Ad", { exact: true }).fill(firstName);
  await page.getByLabel("Soyad").fill("Kiralama");
  await page.getByRole("button", { name: "Kiracıyı kaydet" }).click();
  await expect(page.getByText(`${firstName} Kiralama`)).toBeVisible();

  await page.goto("/sozlesmeler");
  await page.getByRole("button", { name: "Sözleşme oluştur" }).click();
  await page.getByLabel("Birim").selectOption({ label: `Daire ${suffix}` });
  await page.getByLabel("Kiracı").selectOption({ label: `${firstName} Kiralama` });
  await page.getByLabel("Başlangıç tarihi").fill(date(today));
  await page.getByLabel("Planlanan bitiş tarihi").fill(date(endDate));
  await page.getByLabel("Aylık kira (₺)").fill("12000");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByText("Taslak", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Etkinleştir" }).click();
  await expect(page.getByText("Etkin", { exact: true })).toBeVisible();

  await page.goto("/kira-tahsilatlar");
  await page.getByLabel("Kiracı").selectOption({ label: `${firstName} Kiralama` });
  await page.getByLabel("Tutar (₺)").fill("12000");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(page.getByText(/12\.000,00 ₺ · Dağıtılan 0,00 ₺ · Bekleyen 12\.000,00 ₺/)).toBeVisible();

  await page.goto("/sozlesmeler");
  await page.getByRole("button", { name: "Yenile" }).click();
  await page.getByLabel("Yeni bitiş tarihi").fill(date(renewedEndDate));
  await page.getByLabel("Yeni bedelin başlangıcı").fill(date(nextMonth));
  await page.getByLabel("Aylık kira (₺)").fill("13500");
  await page.getByLabel("Gerekçe").fill("SQL E2E dönem yenilemesi");
  await page.getByRole("button", { name: "Yenilemeyi kaydet" }).click();
  await expect(page.getByText(new RegExp(`${date(endDate)} → ${date(renewedEndDate)} · ${date(nextMonth)}`))).toBeVisible();
});
