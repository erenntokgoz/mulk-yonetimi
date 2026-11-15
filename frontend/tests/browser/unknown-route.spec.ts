import { expect, test } from "@playwright/test";

test("unknown section returns a real 404 without a session", async ({ page, context }) => {
  await context.clearCookies();
  const response = await page.goto("/bulunmayan-bolum");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
});
