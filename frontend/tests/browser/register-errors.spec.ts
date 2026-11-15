import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function fill(page: import("@playwright/test").Page) {
  await page.goto("/kayit");
  await page.getByLabel("Hesap adı").fill("Test Hesabı");
  await page.getByLabel("E-posta").fill("kullanici@example.com");
  await page.getByLabel("Parola").fill("abcdef");
}

test("shows the live password rules linked to the field", async ({ page }) => {
  await page.goto("/kayit");
  const rules = page.getByRole("list").filter({ hasText: "En az 6 karakter" });
  await expect(rules).toBeVisible();
  const id = await rules.getAttribute("id");
  await expect(page.getByLabel("Parola")).toHaveAttribute("aria-describedby", new RegExp(id!));
  await expect(rules.locator('[data-ok="true"]')).toHaveCount(0);
  await page.getByLabel("Parola").fill("Abc12!");
  await expect(rules.locator('[data-ok="true"]')).toHaveCount(5);
});

test("lists the failed password rules on 400", async ({ page }) => {
  await page.route("**/api/bff/auth/register", route => route.fulfill({
    status: 400,
    json: { errors: ["PasswordRequiresNonAlphanumeric", "PasswordRequiresDigit", "PasswordRequiresUpper"] },
  }));
  await fill(page);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  const alert = page.locator("main [role=alert]");
  await expect(alert).toContainText("Parola en az bir sembol içermeli.");
  await expect(alert).toContainText("Parola en az bir rakam içermeli.");
  await expect(alert).toContainText("Parola en az bir büyük harf içermeli.");
});

test("reports unavailable email delivery on 503", async ({ page }) => {
  await page.route("**/api/bff/auth/register", route => route.fulfill({ status: 503 }));
  await fill(page);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("E-posta gönderimi şu anda kullanılamıyor.");
});

for (const path of ["/giris", "/kayit"]) {
  test(`password visibility toggle works on ${path}`, async ({ page }) => {
    await page.goto(path);
    const input = page.getByLabel("Parola");
    await expect(input).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Parolayı göster" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Parolayı gizle" }).click();
    await expect(input).toHaveAttribute("type", "password");
  });
}
