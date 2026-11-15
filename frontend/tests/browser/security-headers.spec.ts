import { expect, test } from "@playwright/test";

// Güvenlik başlıkları her rotada aynı kalmalıdır; giriş sayfası hem açık hem kamu rotasıdır.
test("login route serves the security headers", async ({ request }) => {
  const response = await request.get("/giris");
  expect(response.status()).toBeLessThan(500);
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["content-security-policy"]).toBe(
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  );
});
