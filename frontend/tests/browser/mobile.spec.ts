import { expect, test, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:5089";
const viewports = [{ width: 375, height: 812 }, { width: 390, height: 844 }];
const dashboardRoutes = ["/panel", "/portfoy", "/kiracilar", "/sozlesmeler", "/kira-tahsilatlar", "/depozitolar", "/giderler", "/belgeler", "/raporlar", "/bildirimler", "/ayarlar"];
const authRoutes = ["/giris", "/kayit", "/parolami-unuttum", "/parola-sifirla", "/dogrula", "/dogrulama-yeniden-gonder"];

async function seed(page: Page) {
  await page.context().addCookies([{ name: "mulk.session", value: "fixture", url: "http://127.0.0.1:3109" }]);
  await page.goto("/giris");
  await page.evaluate(async () => {
    const h = { "Content-Type": "application/json" };
    const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) }).then(r => r.json());
    const property = await post("/api/bff/properties", { name: "Çankaya Residence Blok A", address: "Çankaya Mahallesi, Atatürk Bulvarı No: 125 Daire 14, Ankara", propertyKind: "MULTI_UNIT" });
    const unit = await post(`/api/bff/properties/${property.id}/units`, { label: "Daire 14", usageType: "RESIDENTIAL", doorNumber: "14", areaM2: 96 });
    const tenant = await post("/api/bff/tenants", { firstName: "Ada", lastName: "Yılmaz", email: "ada.yilmaz@example.test", phone: "+90 532 000 00 00" });
    const lease = await post("/api/bff/leases", { unitId: unit.id, tenantId: tenant.id, startDate: "2026-01-01", plannedEndDate: null, dueDay: 1, monthlyAmount: 12000, depositAmount: 24000, note: null });
    await post(`/api/bff/leases/${lease.id}/activate`, { version: lease.version });
    await post("/api/bff/expenses", { propertyId: property.id, category: "MAINTENANCE", amount: 3500, expenseOn: "2026-11-14", note: "Kapı kilidi değişimi" });
  });
}

async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const horizontal = document.documentElement.scrollWidth - width;
    const clipped = [...document.querySelectorAll<HTMLElement>("body *")].filter(el => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(el).position === "fixed") return false;
      if (el.closest(".skip-link, .sr-only, [aria-hidden=true]")) return false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) { if (/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowX)) return false; parent = parent.parentElement; }
      return rect.right > width + 1;
    }).slice(0, 5).map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    const small = [...document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, summary")].filter(el => {
      const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
      if (!rect.width || !rect.height || style.visibility === "hidden" || el.closest(".skip-link, .sr-only")) return false;
      if (el.tagName === "A" && style.display === "inline" && el.closest("p, li, span, label")) return false;
      if (el.matches("input[type=checkbox], input[type=radio]")) { const label = el.closest("label"); const box = (label ?? el).getBoundingClientRect(); return box.height < 44; }
      return rect.height < 43.5 || rect.width < 43.5 && !el.closest("p, li");
    }).slice(0, 8).map(el => `${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}] ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    return { horizontal, clipped, small };
  });
}

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page, request }) => { await page.emulateMedia({ reducedMotion: "reduce" }); await request.post(`${fixture}/reset-data`); });

    test("dashboard routes have no horizontal overflow and 44px tap targets", async ({ page }) => {
      await seed(page);
      const failures: string[] = [];
      for (const path of dashboardRoutes) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(".skeleton")).toHaveCount(0);
        const result = await layoutProblems(page);
        if (result.horizontal > 0 || result.clipped.length || result.small.length) failures.push(`${path}: overflow=${result.horizontal} clipped=${result.clipped.join("|")} small=${result.small.join("|")}`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });

    test("auth routes have no horizontal overflow and 44px tap targets", async ({ page }) => {
      await page.context().clearCookies();
      const failures: string[] = [];
      for (const path of authRoutes) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const result = await layoutProblems(page);
        if (result.horizontal > 0 || result.clipped.length || result.small.length) failures.push(`${path}: overflow=${result.horizontal} clipped=${result.clipped.join("|")} small=${result.small.join("|")}`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });

    for (const theme of ["light", "dark"] as const) {
      test(`mobile menu button shows its icon, opens, closes and restores focus (${theme})`, async ({ page }) => {
        await seed(page);
        await page.addInitScript(saved => localStorage.setItem("mulk-theme", saved), theme);
        await page.goto("/panel");
        const button = page.getByRole("button", { name: "Menüyü aç" });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const icon = await button.locator("svg").boundingBox();
        expect(icon!.width).toBeGreaterThanOrEqual(16);
        expect(icon!.height).toBeGreaterThanOrEqual(16);
        const colors = await button.evaluate(el => ({ icon: getComputedStyle(el.querySelector("svg")!).color, bg: getComputedStyle(document.body).backgroundColor }));
        const luminance = (c: string) => { const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(v => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const [hi, lo] = [luminance(colors.icon), luminance(colors.bg)].sort((a, b) => b - a);
        expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(3);

        await button.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(700);
        const problems = await layoutProblems(page);
        expect(problems.small, problems.small.join(", ")).toEqual([]);
        await expect(dialog.getByRole("link", { name: "Kiracılar" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(button).toBeFocused();

        await button.click();
        await dialog.getByRole("link", { name: "Kiracılar" }).click();
        await expect(page.getByRole("heading", { level: 1, name: "Kiracılar" })).toBeVisible();
        await expect(dialog).toBeHidden();
      });
    }
  });
}
