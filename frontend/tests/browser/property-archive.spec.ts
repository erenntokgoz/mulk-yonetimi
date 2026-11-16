import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:5089";

test.beforeEach(async ({ request }) => { await request.post(`${fixture}/reset-data`); });

test("archived properties remain available for read-only details and units", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("link", { name: "Mülküm genel bakış" })).toBeVisible();

  const name = "Arşiv sonrası erişim";
  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill(name);
  await page.getByLabel("Adres").fill("İstanbul");
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  const property = page.getByRole("row").filter({ hasText: name });
  await expect(property).toBeVisible();
  await property.getByRole("button", { name: "Birimler" }).click();
  await page.getByLabel("Birim etiketi").fill("Daire 1");
  await page.getByRole("button", { name: "Birimi kaydet" }).click();
  await expect(page.getByText("Daire 1", { exact: true })).toBeVisible();
  const unit = page.locator("li").filter({ hasText: "Daire 1" });
  await unit.getByRole("button", { name: "Arşivle" }).click();
  const unitArchiveDialog = page.getByRole("dialog", { name: /birimi arşivlensin mi/ });
  await unitArchiveDialog.getByRole("button", { name: "Arşivle" }).click();
  await expect(page.getByText("Daire 1", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kapat" }).click();

  await property.getByRole("button", { name: "Mülkü arşivle" }).click();
  await page.getByRole("dialog", { name: /mülkü arşivlensin mi/ }).getByRole("button", { name: "Arşivle" }).click();
  await expect(property).toHaveCount(0);

  await page.getByLabel("Arşivli mülkleri göster").check();
  const archivedProperty = page.getByRole("row").filter({ hasText: name });
  await expect(archivedProperty).toContainText("Arşivlendi");
  await expect(archivedProperty.getByRole("button", { name: "Mülkü düzenle" })).toHaveCount(0);
  await expect(archivedProperty.getByRole("button", { name: "Mülkü arşivle" })).toHaveCount(0);
  await archivedProperty.getByRole("button", { name: "Birimler" }).click();
  await expect(page.getByRole("heading", { name: `${name} · Birimler` })).toBeVisible();
  await expect(page.getByText("Daire 1", { exact: true })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Daire 1" })).toContainText("Arşivlendi");
});
