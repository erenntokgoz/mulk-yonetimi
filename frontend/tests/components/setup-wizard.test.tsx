import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "../../components/setup-wizard";
import { resetSetupProgress } from "../../lib/setup-progress";

type Data = { properties: number; units: number; tenants: number; active: number; draft: number; payments: number };

function stubApi(data: Data) {
  const page = (count: number, size: number, status?: string) => ({
    items: Array.from({ length: Math.min(count, size) }, (_, index) => ({ id: String(index), status })),
    page: 1,
    pageSize: size,
    hasMore: count > size,
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    const size = Number(url.searchParams.get("pageSize") ?? 100);
    let body: unknown = {};
    if (url.pathname.endsWith("/dashboard/summary")) body = { activeProperties: data.properties, totalUnits: data.units };
    if (url.pathname.endsWith("/tenants")) body = page(data.tenants, size);
    if (url.pathname.endsWith("/leases")) body = page(data.active, size, "ACTIVE");
    if (url.pathname.endsWith("/payments")) body = page(data.payments, size);
    return new Response(JSON.stringify(body), { status: 200 });
  }));
}

describe("SetupWizard", () => {
  afterEach(() => {
    cleanup();
    resetSetupProgress();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("links the current step to the form that creates it", async () => {
    stubApi({ properties: 0, units: 0, tenants: 0, active: 0, draft: 0, payments: 0 });
    render(<SetupWizard />);
    const link = await screen.findByRole("link", { name: "Mülk ekle" });
    expect(link.getAttribute("href")).toBe("/portfoy?yeni=mulk");
    expect(screen.queryByText("Tamamlandı")).toBeNull();
  });

  it("summarises finished steps with real counts and points at the next deep link", async () => {
    stubApi({ properties: 3, units: 12, tenants: 9, active: 0, draft: 0, payments: 0 });
    render(<SetupWizard />);
    expect(await screen.findByText("3 mülk")).toBeTruthy();
    expect(screen.getByText("12 bölüm")).toBeTruthy();
    expect(await screen.findByText("9 kiracı")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sözleşme aç" }).getAttribute("href")).toBe("/sozlesmeler?yeni=1");
    expect(screen.getByRole("heading").textContent).toBe("Kuruluma iki adım kaldı.");
  });

  it("marks counts beyond the first page and the first payment step", async () => {
    stubApi({ properties: 1, units: 1, tenants: 140, active: 9, draft: 0, payments: 0 });
    render(<SetupWizard />);
    expect(await screen.findByText("100+ kiracı")).toBeTruthy();
    expect(screen.getByText("9 etkin sözleşme")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tahsilat kaydet" }).getAttribute("href")).toBe("/kira-tahsilatlar?yeni=1");
  });

  it("is hidden once every step is complete", async () => {
    stubApi({ properties: 1, units: 1, tenants: 1, active: 1, draft: 0, payments: 1 });
    const { container } = render(<SetupWizard />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.innerHTML).toBe("");
  });
});
