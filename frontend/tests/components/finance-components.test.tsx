import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RentCollection } from "../../components/rent-collection";
import { LeaseDirectory } from "../../components/lease-directory";

// Sihirbaz bağlantısını okuyan dinleyici uygulama yönlendiricisi ister; bileşen testinde boş adresle çalışır.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const tenantId = "11111111-1111-4111-8111-111111111111";
const propertyId = "22222222-2222-4222-8222-222222222222";
const unitId = "33333333-3333-4333-8333-333333333333";
const leaseId = "44444444-4444-4444-8444-444444444444";
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 100, hasMore: false });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const tenant = {
  id: tenantId,
  kind: "PERSON",
  firstName: "Ada",
  lastName: "Test",
  companyName: null,
  email: null,
  phone: null,
  archivedAtUtc: null,
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RentCollection", () => {
  it("submits a payment with decimal precision and idempotency key, then renders the saved balance", async () => {
    const savedPayment = {
      id: "55555555-5555-4555-8555-555555555555",
      tenantId,
      paidOn: "2026-11-15",
      amount: 12345.67,
      method: "TRANSFER",
      reference: null,
      status: "RECORDED",
      allocatedAmount: 2345.67,
      unallocatedAmount: 10000,
      voidedAtUtc: null,
      voidReason: null,
      allocations: [],
    };
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.startsWith("/api/bff/rent-charges")) return response(page([]));
      if (path.startsWith("/api/bff/tenants")) return response(page([tenant]));
      if (path.startsWith("/api/bff/payments") && init?.method === "POST") {
        return response(savedPayment, 201);
      }
      if (path.startsWith("/api/bff/payments")) return response(page([savedPayment]));
      throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${path}`);
    });

    render(<RentCollection />);
    const amount = await screen.findByLabelText("Tutar (₺)");
    fireEvent.change(amount, { target: { value: "12345.67" } });
    fireEvent.click(screen.getByRole("button", { name: "Tahsilatı kaydet" }));

    await screen.findByText(/Dağıtılan 2\.345,67 ₺ · Bekleyen 10\.000,00 ₺/);
    const post = fetchMock.mock.calls.find(([url, init]) => String(url) === "/api/bff/payments" && init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ tenantId, amount: 12345.67, method: "TRANSFER" });
    expect(new Headers(post?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("LeaseDirectory", () => {
  it("submits the renewal effective date and rent, then displays the new term", async () => {
    let renewed = false;
    const lease = () => ({
      id: leaseId,
      unitId,
      tenantId,
      status: "ACTIVE",
      startDate: "2026-01-01",
      plannedEndDate: renewed ? "2100-12-31" : "2099-12-31",
      terminationDate: null,
      dueDay: 1,
      depositAmount: 0,
      note: null,
      terminationReason: null,
      version: renewed ? "Ag==" : "AQ==",
    });
    const fetchMock = vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.startsWith("/api/bff/leases/") && path.endsWith("/renewals") && init?.method === "POST") {
        renewed = true;
        return response({ id: "66666666-6666-4666-8666-666666666666" }, 201);
      }
      if (path.startsWith("/api/bff/leases/") && path.endsWith("/renewals")) return response([]);
      if (path.startsWith("/api/bff/leases/") && path.endsWith("/rates")) return response([]);
      if (path.startsWith("/api/bff/leases")) return response(page([lease()]));
      if (path.startsWith("/api/bff/properties/") && path.includes("/units?")) return response(page([{ id: unitId, propertyId, label: "Daire 2", usageType: "RESIDENTIAL", doorNumber: null, areaM2: null, isDefault: false, archivedAtUtc: null }]));
      if (path.startsWith("/api/bff/properties")) return response(page([{ id: propertyId, name: "Test mülk", address: "Ankara", propertyKind: "MULTI_UNIT", archivedAtUtc: null }]));
      if (path.startsWith("/api/bff/tenants")) return response(page([tenant]));
      throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${path}`);
    });

    render(<LeaseDirectory />);
    const leaseHeading = await screen.findByRole("heading", { name: "Daire 2 · Ada Test" });
    const leaseCard = leaseHeading.parentElement?.parentElement?.parentElement;
    expect(leaseCard).toBeTruthy();
    fireEvent.click(within(leaseCard as HTMLElement).getByRole("button", { name: "Yenile" }));
    fireEvent.change(screen.getByLabelText("Yeni bitiş tarihi"), { target: { value: "2100-12-31" } });
    fireEvent.change(screen.getByLabelText("Yeni bedelin başlangıcı"), { target: { value: "2100-01-01" } });
    fireEvent.change(screen.getByLabelText("Aylık kira (₺)"), { target: { value: "13500.00" } });
    fireEvent.change(screen.getByLabelText("Gerekçe"), { target: { value: "Yıllık artış" } });
    fireEvent.click(screen.getByRole("button", { name: "Yenilemeyi kaydet" }));

    await waitFor(() => expect(screen.getByText(/Başlangıç 01\.01\.2026 · Planlanan bitiş 31\.12\.2100/)).toBeTruthy());
    const post = fetchMock.mock.calls.find(([url, init]) => String(url) === `/api/bff/leases/${leaseId}/renewals` && init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ version: "AQ==", newEndDate: "2100-12-31", effectiveFrom: "2100-01-01", monthlyAmount: 13500, reason: "Yıllık artış" });
  });
});
