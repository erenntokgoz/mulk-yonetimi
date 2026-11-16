import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverviewDashboard } from "../../components/overview-dashboard";

vi.mock("../../components/setup-wizard", () => ({ SetupWizard: () => null }));
vi.mock("../../lib/setup-progress", () => ({ useSetupProgress: () => [true, true, true, true, true] }));

const summary = {
  periodStart: "2026-11-01",
  asOf: "2026-11-14",
  activeProperties: 1,
  totalUnits: 2,
  occupiedUnits: 1,
  vacantUnits: 1,
  periodCharges: "1234.5",
  periodUnpaid: 10000,
  overdueBalance: "0.00",
  recordedExpenses: "2345.67",
  cashFlow: {
    fromDate: "2026-11-01",
    toDate: "2026-11-14",
    propertyId: null,
    unitId: null,
    cashIn: 0,
    allocated: 0,
    unallocated: 0,
    cashOut: 0,
    netOperatingCashFlow: "-1234.56",
  },
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const emptyPage = { items: [], page: 1, pageSize: 100, hasMore: false };

function stubApi(extra: (url: string) => Response | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/dashboard/summary")) return json(summary);
      return extra(url) ?? json(emptyPage);
    }),
  );
}

describe("OverviewDashboard money formatting", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders every amount with Turkish separators", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(summary), { status: 200 })));
    render(<OverviewDashboard />);
    await waitFor(() => expect(screen.getAllByText("1.234,50 ₺")).toHaveLength(2));
    expect(screen.getByText("10.000,00 ₺")).toBeTruthy();
    expect(screen.getByText("2.345,67 ₺")).toBeTruthy();
    expect(screen.getByText("0,00 ₺")).toBeTruthy();
    expect(screen.getByText("-1.234,56 ₺")).toBeTruthy();
  });

  it("shows empty states and no sample data for a new account", async () => {
    stubApi(() => null);
    render(<OverviewDashboard />);
    await waitFor(() => expect(screen.getByText("Geciken kira yok.")).toBeTruthy());
    expect(screen.getByText("Önümüzdeki 14 günde vadesi gelen kira yok.")).toBeTruthy();
    expect(screen.getByText("Son 12 ayda tahsilat ya da gider kaydı yok.")).toBeTruthy();
    expect(screen.queryByText("Selin Kaya")).toBeNull();
  });

  it("lists overdue and upcoming rent charges from the API", async () => {
    const tenant = { id: "t1", kind: "PERSON", firstName: "Ayşe", lastName: "Yılmaz", companyName: null };
    const charge = (id: string, due: string, balance: number, paid: number) => ({
      id, leaseId: "l1", tenantId: "t1", periodStart: due.slice(0, 7) + "-01", dueDate: due,
      amount: balance + paid, paidAmount: paid, balance, status: paid ? "PARTIAL" : "UNPAID", isOverdue: due < "2026-11-14",
    });
    stubApi((url) => {
      if (url.includes("/rent-charges"))
        return json({ ...emptyPage, items: [charge("c1", "2026-11-04", 6500, 1000), charge("c2", "2026-11-20", 14000, 0)] });
      if (url.includes("/tenants")) return json({ ...emptyPage, items: [tenant] });
      if (url.includes("/reports/cashflow")) return json({ cashIn: 5000, cashOut: 1000 });
      return null;
    });
    render(<OverviewDashboard />);
    await waitFor(() => expect(screen.getByText("Vadesi 10 gün önce geçti")).toBeTruthy());
    expect(screen.getByText("Kısmi ödendi")).toBeTruthy();
    expect(screen.getByText("6.500,00 ₺")).toBeTruthy();
    expect(screen.getByText("20 Kasım")).toBeTruthy();
    expect(screen.getByText("6 gün")).toBeTruthy();
    expect(screen.getAllByText("Ayşe Yılmaz").length).toBe(2);
    expect(screen.queryByText("Son 12 ayda tahsilat ya da gider kaydı yok.")).toBeNull();
  });
});

it("states the limits of the rent charge lists", async () => {
  stubApi(() => null);
  render(<OverviewDashboard />);
  await waitFor(() => expect(screen.getByText("Geciken kira yok.")).toBeTruthy());
  expect(screen.getAllByText("Liste, son 24 ay ve gelecek ay için alınan en fazla 500 kayda dayanır.")).toHaveLength(2);
  cleanup();
  vi.unstubAllGlobals();
});


it("shows the authoritative period total even if charge pages are incomplete", async () => {
  stubApi(() => null);
  render(<OverviewDashboard />);
  await waitFor(() => expect(screen.getByText("Bu dönem alacağı")).toBeTruthy());
  expect(screen.getAllByText("1.234,50 ₺")).toHaveLength(2);
  cleanup();
  vi.unstubAllGlobals();
});

