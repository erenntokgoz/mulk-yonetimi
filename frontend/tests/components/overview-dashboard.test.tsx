import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverviewDashboard } from "../../components/overview-dashboard";

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

describe("OverviewDashboard money formatting", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders every amount with Turkish separators", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(summary), { status: 200 })));
    render(<OverviewDashboard />);
    await waitFor(() => expect(screen.getByText("1.234,50 ₺")).toBeTruthy());
    expect(screen.getByText("10.000,00 ₺")).toBeTruthy();
    expect(screen.getByText("2.345,67 ₺")).toBeTruthy();
    expect(screen.getByText("0,00 ₺")).toBeTruthy();
    expect(screen.getByText("-1.234,56 ₺")).toBeTruthy();
  });
});
