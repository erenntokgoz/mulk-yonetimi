import { expect, test } from "@playwright/test";

test("first setup shows the next real record to create", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.goto("/kurulum");
  await expect(page.getByRole("heading", { name: "İlk kurulum" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mülk ekle" })).toHaveAttribute("href", "/portfoy");
  await expect(page.getByText("Sıradaki adım")).toHaveCount(1);
});

test("setup advances through property, unit and tenant records", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill("Kule");
  await page.getByLabel("Adres").fill("Ankara");
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.goto("/kurulum");
  await expect(page.getByRole("link", { name: "Birim ekle" })).toBeVisible();
  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Birimler" }).click();
  await page.getByLabel("Birim etiketi").fill("Daire 1");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  await page.goto("/kurulum");
  await expect(page.getByRole("link", { name: "Kiracı ekle" })).toBeVisible();
  await page.goto("/kiracilar");
  await page.getByRole("button", { name: /Kiracı ekle/ }).click();
  await page.getByLabel("Ad", { exact: true }).fill("Ada");
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Kiracıyı kaydet" }).click();
  await page.goto("/kurulum");
  await expect(page.getByRole("link", { name: "Sözleşme oluştur" })).toBeVisible();
});
