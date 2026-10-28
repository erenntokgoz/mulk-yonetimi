import { expect, test } from "@playwright/test";

test("login form sends credentials through BFF", async ({ page }) => {
  await page.goto("/giris");
  await page.getByRole("textbox", { name: "E-posta" }).fill("owner@example.test");
  await page.getByLabel("Parola").fill("Valid-Password-123!");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "mulk.session")).toBe(true);
});

test("BFF forwards an HttpOnly session cookie and sends it to /me", async ({ page }) => {
  const login = await page.request.post("/api/bff/auth/login", {
    headers: { Origin: "http://127.0.0.1:3109" },
  });
  expect(login.status()).toBe(204);
  const cookie = (await page.context().cookies()).find((item) => item.name === "mulk.session");
  expect(cookie?.httpOnly).toBe(true);
  const me = await page.request.get("/api/bff/me");
  expect(me.status()).toBe(200);
  expect(await me.json()).toEqual({ id: "fixture-user" });
});

test("BFF rejects a foreign Origin before login", async ({ page }) => {
  const response = await page.request.post("/api/bff/auth/login", {
    headers: { Origin: "https://attacker.example" },
  });
  expect(response.status()).toBe(403);
  expect((await page.context().cookies()).some((item) => item.name === "mulk.session")).toBe(false);
});

test("BFF rejects a mutation without Origin", async ({ page }) => {
  const response = await page.request.post("/api/bff/auth/login");
  expect(response.status()).toBe(403);
});

test("BFF forwards logout cookie removal", async ({ page }) => {
  const headers = { Origin: "http://127.0.0.1:3109" };
  expect((await page.request.post("/api/bff/auth/login", { headers })).status()).toBe(204);
  expect((await page.request.post("/api/bff/auth/logout", { headers })).status()).toBe(204);
  expect((await page.request.get("/api/bff/me")).status()).toBe(401);
});
