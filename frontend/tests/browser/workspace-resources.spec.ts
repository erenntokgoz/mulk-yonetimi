import { expect, test } from "@playwright/test";

const profile = { displayName: "Test kullanıcı", email: "test@example.test", emailConfirmed: false };
const preferences = {
  emailEnabled: false,
  rentDueEnabled: true,
  overdueRentEnabled: true,
  leaseEndEnabled: true,
  rentAnniversaryEnabled: true,
};

test("settings loads profile and preferences and saves each through the BFF", async ({ page }) => {
  let savedProfile = { ...profile };
  let savedPreferences = { ...preferences };
  await page.route("**/api/bff/me/profile", async route => {
    if (route.request().method() === "PUT") savedProfile = route.request().postDataJSON();
    await route.fulfill({ json: savedProfile });
  });
  await page.route("**/api/bff/me/notification-preferences", async route => {
    if (route.request().method() === "PUT") savedPreferences = route.request().postDataJSON();
    await route.fulfill({ json: savedPreferences });
  });

  await page.goto("/ayarlar");
  await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
  await expect(page.getByLabel("E-posta adresi")).toHaveValue(profile.email);
  await expect(page.getByLabel("E-posta bildirimleri")).toBeDisabled();
  await page.getByLabel("Görünen ad").fill("Yeni ad");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(page.locator("[data-toast-live=polite]")).toContainText("Profil kaydedildi.");
  await expect(page.locator(".toaster").getByText("Profil kaydedildi.")).toBeVisible();
  expect(savedProfile).toEqual({ displayName: "Yeni ad" });
  await page.getByLabel("Vade günü hatırlatması").uncheck();
  await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(page.locator("[data-toast-live=polite]")).toContainText("Bildirim tercihleri kaydedildi.");
  expect(savedPreferences.rentDueEnabled).toBe(false);
});

test("notifications filters unread items, marks one read, and marks all read", async ({ page }) => {
  const items = [
    { id: "notification-1", type: "RENT_DUE", title: "Kira vadesi yaklaşıyor", message: "1. bölüm", createdAtUtc: "2026-11-14T08:00:00Z", readAtUtc: null },
    { id: "notification-2", type: "LEASE_END", title: "Sözleşme bitişi", message: "2. bölüm", createdAtUtc: "2026-11-13T08:00:00Z", readAtUtc: "2026-11-13T09:00:00Z" },
  ];
  let readAll = false;
  await page.route("**/api/bff/notifications**", async route => {
    const request = route.request();
    if (request.method() === "POST") {
      readAll = true;
      for (const item of items) item.readAtUtc ??= "2026-11-14T10:00:00Z";
      await route.fulfill({ status: 204, body: "" });
    } else if (request.url().includes("/read")) {
      const id = request.url().split("/").at(-2);
      const item = items.find(entry => entry.id === id);
      if (item) item.readAtUtc = "2026-11-14T10:00:00Z";
      await route.fulfill({ status: 204, body: "" });
    } else {
      const unreadOnly = new URL(request.url()).searchParams.get("unreadOnly") === "true";
      await route.fulfill({ json: { items: items.filter(item => !unreadOnly || !item.readAtUtc), page: 1, pageSize: 25, hasMore: false } });
    }
  });

  await page.goto("/bildirimler");
  await expect(page.getByRole("heading", { level: 1, name: "Bildirimler" })).toBeVisible();
  await expect(page.getByText("Kira vadesi yaklaşıyor")).toBeVisible();
  await expect(page.getByText("Sözleşme bitişi")).toBeVisible();
  await page.getByRole("checkbox", { name: "Yalnızca okunmamış" }).check();
  await expect(page.getByText("Sözleşme bitişi")).toHaveCount(0);
  await page.getByRole("button", { name: "Okundu işaretle", exact: true }).click();
  await expect(page.getByText("Okunmamış bildirim yok.")).toBeVisible();
  items.push({ id: "notification-3", type: "RENT_DUE", title: "Yeni vade bildirimi", message: "3. bölüm", createdAtUtc: "2026-11-14T10:00:00Z", readAtUtc: null });
  await page.getByRole("checkbox", { name: "Yalnızca okunmamış" }).uncheck();
  await expect(page.getByText("Yeni vade bildirimi")).toBeVisible();
  await page.getByRole("button", { name: "Tümünü okundu işaretle" }).click();
  await expect(page.locator(".toaster").getByText("Bildirimler okundu olarak işaretlendi.")).toBeVisible();
  expect(readAll).toBe(true);
});

test("documents upload through a signed intent, complete, download, and soft delete", async ({ page }) => {
  let documents: Array<Record<string, unknown>> = [];
  const lifecycle: string[] = [];
  await page.route("**/api/bff/properties?**", route => route.fulfill({ json: {
    items: [{ id: "property-1", name: "Test mülk", address: "Test adres", propertyKind: "MULTI_UNIT", archivedAtUtc: null, version: "AAAAAAAAB9E=" }],
    page: 1, pageSize: 25, hasMore: false,
  } }));
  await page.route("**/api/bff/documents**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/upload-intents")) {
      lifecycle.push("intent");
      expect(request.postDataJSON()).toMatchObject({ propertyId: "property-1", unitId: null, leaseId: null, originalName: "test.pdf", contentType: "application/pdf" });
      await route.fulfill({ status: 201, json: { id: "document-1", uploadUrl: "https://storage.example.test/upload", expiresAtUtc: "2026-11-14T10:05:00Z", contentType: "application/pdf", requiredHeaders: { "Content-Type": "application/pdf" } } });
    } else if (url.pathname.endsWith("/complete")) {
      lifecycle.push("complete");
      documents = [{ id: "document-1", propertyId: "property-1", unitId: null, leaseId: null, originalName: "test.pdf", contentType: "application/pdf", sizeBytes: 12, status: "ACTIVE", createdAtUtc: "2026-11-14T10:00:00Z", completedAtUtc: "2026-11-14T10:01:00Z" }];
      await route.fulfill({ json: documents[0] });
    } else if (url.pathname.endsWith("/download-url")) {
      lifecycle.push("download-url");
      await route.fulfill({ json: { downloadUrl: "https://storage.example.test/download", expiresAtUtc: "2026-11-14T10:02:00Z" } });
    } else if (request.method() === "DELETE") {
      lifecycle.push("delete");
      documents = [];
      await route.fulfill({ status: 204, body: "" });
    } else {
      await route.fulfill({ json: { items: documents, page: 1, pageSize: 25, hasMore: false } });
    }
  });
  await page.route("https://storage.example.test/upload", route => {
    lifecycle.push("put");
    expect(route.request().method()).toBe("PUT");
    expect(route.request().headers()["content-type"]).toBe("application/pdf");
    return route.fulfill({ status: 200, body: "" });
  });
  await page.context().route("https://storage.example.test/download", route => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "Content-Disposition": "attachment; filename*=UTF-8''test.pdf" }, body: "%PDF-1.4 test" }));

  await page.goto("/belgeler");
  await expect(page.getByRole("heading", { level: 1, name: "Belgeler" })).toBeVisible();
  await page.getByRole("combobox", { name: "Mülk" }).selectOption("property-1");
  await page.getByLabel("Dosya").setInputFiles({ name: "test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByRole("button", { name: "Dosyayı yükle" }).click();
  await expect(page.getByText("test.pdf")).toBeVisible();
  await expect(page.locator(".toaster").getByText("Belge yüklendi.")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir test.pdf" }).click();
  const download = await downloadPromise;
  expect(download.url()).toBe("https://storage.example.test/download");
  expect(download.suggestedFilename()).toBe("test.pdf");
  await expect(page).toHaveURL(/\/belgeler$/);
  await page.getByRole("button", { name: "Belgeyi sil test.pdf" }).click();
  await page.getByRole("dialog", { name: /test\.pdf.*kaldırılsın mı/ }).getByRole("button", { name: "Belgeyi kaldır" }).click();
  await expect(page.getByText("Henüz belge yok.")).toBeVisible();
  await expect(page.locator(".toaster").getByText("Belge kaldırıldı.")).toBeVisible();
  expect(lifecycle).toEqual(["intent", "put", "complete", "download-url", "delete"]);
});

test("documents disclose missing R2 configuration and never claim a failed upload succeeded", async ({ page }) => {
  await page.route("**/api/bff/properties?**", route => route.fulfill({ json: {
    items: [{ id: "property-1", name: "Test mülk", address: "Test adres", propertyKind: "MULTI_UNIT", archivedAtUtc: null, version: "AAAAAAAAB9E=" }],
    page: 1, pageSize: 25, hasMore: false,
  } }));
  await page.route("**/api/bff/documents**", async route => {
    if (route.request().url().endsWith("/upload-intents")) await route.fulfill({ status: 503, json: { title: "Storage is not configured" } });
    else await route.fulfill({ json: { items: [], page: 1, pageSize: 25, hasMore: false } });
  });
  await page.goto("/belgeler");
  await page.getByRole("combobox", { name: "Mülk" }).selectOption("property-1");
  await page.getByLabel("Dosya").setInputFiles({ name: "test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByRole("button", { name: "Dosyayı yükle" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("Dosya depolama hizmeti kullanılamıyor");
  await expect(page.getByText("Henüz belge yok.")).toBeVisible();
  await expect(page.getByText("test.pdf")).toHaveCount(0);
});



test("notifications show only the error, not an empty list, when loading fails", async ({ page }) => {
  await page.route("**/api/bff/notifications**", route => route.fulfill({ status: 401 }));
  await page.goto("/bildirimler");
  await expect(page.getByText("Bildirimleri görmek için giriş yapın.")).toBeVisible();
  await expect(page.getByText("Görüntülenecek bildirim yok.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tümünü okundu işaretle" })).toHaveCount(0);
});
