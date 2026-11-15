import { expect, test } from "@playwright/test";

const dashboardRoutes = [
  ["/panel", "Genel bakış"],
  ["/portfoy", "Portföy"],
  ["/kiracilar", "Kiracılar"],
  ["/sozlesmeler", "Sözleşmeler"],
  ["/kira-tahsilatlar", "Kira ve tahsilatlar"],
  ["/depozitolar", "Depozitolar"],
  ["/giderler", "Giderler"],
  ["/belgeler", "Belgeler"],
  ["/raporlar", "Raporlar"],
  ["/bildirimler", "Bildirimler"],
  ["/ayarlar", "Ayarlar"],
] as const;

const authRoutes = [
  ["/giris", "Hesabınıza girin."],
  ["/kayit", "Hesabınızı oluşturun."],
  ["/parolami-unuttum", "Parolanızı sıfırlayın."],
  ["/parola-sifirla", "Yeni parolanızı belirleyin."],
  ["/dogrula", "E-posta doğrulama"],
  ["/dogrulama-yeniden-gonder", "Doğrulama e-postası"],
] as const;
const protectedRoutes = new Set(dashboardRoutes.filter(([path]) => !["/belgeler", "/bildirimler", "/ayarlar"].includes(path)).map(([path]) => path).concat("/belgeler", "/bildirimler", "/ayarlar"));
const textContrast = (foreground: string, background: string) => {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const [r, g, b] = channels.map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test("captures dashboard screens at desktop and mobile widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [path, title] of dashboardRoutes) {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      if (protectedRoutes.has(path)) await expect(page.locator("main [role=alert]")).toBeVisible();
      else if (path !== "/panel") await expect(page.getByTestId("unavailable-state")).toBeVisible();
      if (path === "/giderler") {
        await expect(page.locator("main [role=alert]")).toContainText("Giderleri görmek için giriş yapın.");
      }
      if (path === "/raporlar") {
        await expect(page.locator("main [role=alert]")).toContainText("Raporları görmek için giriş yapın.");
        await expect(page.locator("main [role=alert] a[href='/giris']")).toBeVisible();
      }
      if (viewport.name === "mobile") {
        await expect(page.locator(".app-shell")).toHaveCSS("padding-left", "0px");
        await expect(page.locator(".workspace")).toHaveCSS("padding-left", "0px");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      }
      await page.screenshot({
        path: `test-results/visual-qa/dashboard-${path === "/panel" ? "overview" : path.slice(1)}-${viewport.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});

test("captures auth screens in light and dark themes at desktop and mobile widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [path, title] of authRoutes) {
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((savedTheme) => localStorage.setItem("mulk-theme", savedTheme), theme);
      for (const viewport of [
        { name: "desktop", width: 1440, height: 1000 },
        { name: "mobile", width: 390, height: 844 },
      ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        expect(await page.locator("html").evaluate(element => element.classList.contains("dark"))).toBe(theme === "dark");
        if (path === "/dogrula") {
          await expect(page.getByText("Doğrulama bağlantısı eksik veya geçersiz.")).toBeVisible();
          await expect(page.getByRole("link", { name: "Yeni doğrulama bağlantısı gönder" })).toBeVisible();
          const button = page.getByRole("button", { name: "E-postayı doğrula" });
          await expect(button).toHaveCSS("opacity", "1");
          const colors = await button.evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
          expect(textContrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
        }
        if (path === "/parola-sifirla") {
          await expect(page.getByText("Parola sıfırlama bağlantısı eksik veya geçersiz.")).toBeVisible();
          await expect(page.getByRole("link", { name: "Yeni sıfırlama bağlantısı isteyin" })).toBeVisible();
          const button = page.getByRole("button", { name: "Parolayı güncelle" });
          await expect(button).toHaveCSS("opacity", "1");
          const colors = await button.evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
          expect(textContrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
        }
        if (viewport.name === "mobile") {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        }
        await page.screenshot({
          path: `test-results/visual-qa/auth-${path.slice(1)}-${theme}-${viewport.name}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});

