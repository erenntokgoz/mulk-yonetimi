import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("operator@example.test");
  await page.getByLabel("Parola").fill("ValidPass123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("link", { name: "Mülküm genel bakış" })).toBeVisible();
}

test("property list loads the record after the first hundred", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/bff/properties?*", async (route) => {
    const requested = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
    const first = (requested - 1) * 100 + 1;
    const items = Array.from({ length: Math.max(0, Math.min(100, 101 - first + 1)) }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(first + index).padStart(12, "0")}`,
      name: `Mülk ${first + index}`, address: "Ankara", propertyKind: "MULTI_UNIT",
      archivedAtUtc: null, version: "AAAAAAAAAAA=",
    }));
    await route.fulfill({ json: { items, page: requested, pageSize: 100, hasMore: requested === 1 } });
  });
  await page.goto("/portfoy");
  await expect(page.getByText("Mülk 100", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Diğer mülkleri yükle" }).click();
  await expect(page.getByText("Mülk 101", { exact: true })).toBeVisible();
});

test("notification list loads the record after the first twenty five", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/bff/notifications?*", async (route) => {
    const requested = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
    const first = (requested - 1) * 25 + 1;
    const items = Array.from({ length: Math.max(0, Math.min(25, 26 - first + 1)) }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(first + index).padStart(12, "0")}`,
      title: `Bildirim ${first + index}`, message: "Vade bilgisi", type: "RENT_DUE",
      createdAtUtc: "2026-11-14T00:00:00Z", readAtUtc: null,
    }));
    await route.fulfill({ json: { items, page: requested, pageSize: 25, hasMore: requested === 1 } });
  });
  await page.goto("/bildirimler");
  await expect(page.getByText("Bildirim 25", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Diğer bildirimleri yükle" }).click();
  await expect(page.getByText("Bildirim 26", { exact: true })).toBeVisible();
});

test("payment tenant picker can reach a tenant after the first hundred", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/bff/tenants?*", async (route) => {
    const requested = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
    const first = (requested - 1) * 100 + 1;
    const items = Array.from({ length: Math.max(0, Math.min(100, 101 - first + 1)) }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(first + index).padStart(12, "0")}`,
      kind: "PERSON", firstName: "Kiracı", lastName: String(first + index), companyName: null,
      phone: null, email: null, archivedAtUtc: null, version: "AAAAAAAAAAA=",
    }));
    await route.fulfill({ json: { items, page: requested, pageSize: 100, hasMore: requested === 1 } });
  });
  await page.goto("/kira-tahsilatlar");
  await page.getByRole("button", { name: "Diğer kiracıları yükle" }).click();
  await expect(page.getByRole("option", { name: "Kiracı 101" })).toHaveCount(1);
});
