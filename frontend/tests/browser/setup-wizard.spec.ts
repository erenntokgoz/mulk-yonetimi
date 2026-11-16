import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("empty account shows the wizard with step 1 current and a working link", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await signIn(page);
  const wizard = page.getByRole("region", { name: /Kurulum/ });
  await expect(wizard).toBeVisible();
  const current = wizard.locator('li[aria-current="step"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Mülk ekle");
  await expect(wizard.getByText("Tamamlandı")).toHaveCount(0);
  const link = current.getByRole("link", { name: "Mülk ekle" });
  expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(43.5);
  await expect(link).toHaveAttribute("href", "/portfoy?yeni=mulk");
  await link.click();
  await expect(page).toHaveURL(/\/portfoy$/);
  await expect(page.getByLabel("Mülk adı")).toBeFocused();
});

test("wizard advances from real records and hide persists until Kurulum reopens it", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await signIn(page);
  await page.goto("/portfoy");
  await page.getByRole("button", { name: "Mülk ekle" }).click();
  await page.getByLabel("Mülk adı").fill("Kule");
  await page.getByLabel("Adres").fill("Ankara");
  await page.getByLabel("Mülk türü").selectOption("MULTI_UNIT");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.goto("/panel");
  const wizard = page.getByRole("region", { name: /Kurulum/ });
  await expect(wizard.locator('li[aria-current="step"]')).toContainText(
    "Daire ekle",
  );
  await expect(wizard.locator("li").first()).toContainText("1 mülk");

  await wizard.getByRole("button", { name: "Sihirbazı gizle" }).click();
  await expect(wizard).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Genel bakış" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /Kurulum/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Kurulum" }).click();
  await expect(page.getByRole("region", { name: /Kurulum/ })).toBeVisible();
});

test("wizard fits a 375px screen", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5089/reset-data");
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  await expect(page.getByRole("region", { name: /Kurulum/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
