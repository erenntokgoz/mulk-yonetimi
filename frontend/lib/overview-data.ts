// Genel bakış pencere öğelerinin gerçek API yanıtlarından hesaplanan verileri. Para yalnız görüntü için sayıya çevrilir.
import type { components } from "@/lib/api/generated";

type Charge = components["schemas"]["RentChargeResponse"];
type Tenant = components["schemas"]["TenantResponse"];

const shortMonths = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const longMonths = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export type MonthRange = { label: string; from: string; to: string };
export type CashPoint = { label: string; income: number; expense: number };
export type ChargeRow = { id: string; period: string; name: string; text: string; amount: number; tag: string; partial: boolean };
export type MonthBreakdown = { total: number; paid: number; pending: number; late: number };
export type OverviewExtras = { cash: CashPoint[]; charges: Charge[]; names: Map<string, string> };

const pad = (n: number) => String(n).padStart(2, "0");

export function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parts(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

export function addMonths(iso: string, delta: number) {
  const { year, month } = parts(iso);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
}

export function monthName(iso: string) {
  return longMonths[parts(iso).month - 1] ?? "";
}

// Son 12 ay, en yenisi sonda; her ay ilk ve son günüyle raporlanır.
export function monthRanges(periodStart: string, count = 12): MonthRange[] {
  return Array.from({ length: count }, (_, i) => {
    const from = addMonths(periodStart, i - (count - 1));
    const { year, month } = parts(from);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { label: shortMonths[month - 1] ?? "", from, to: `${year}-${pad(month)}-${pad(last)}` };
  });
}

function dayNumber(iso: string) {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round(dayNumber(toIso) - dayNumber(fromIso));
}

export function tenantName(tenant: Tenant) {
  return tenant.kind === "COMPANY"
    ? (tenant.companyName ?? "Şirket")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Kiracı";
}

function toRow(charge: Charge, names: Map<string, string>, text: string, tag: string): ChargeRow {
  return {
    id: charge.id,
    period: shortMonths[parts(charge.periodStart).month - 1] ?? "",
    name: names.get(charge.tenantId) ?? "Kiracı",
    text,
    amount: num(charge.balance),
    tag,
    partial: num(charge.paidAmount) > 0,
  };
}

export function overdueRows(charges: Charge[], names: Map<string, string>, today: string, limit = 5) {
  const rows = charges
    .filter((charge) => charge.isOverdue && num(charge.balance) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    count: rows.length,
    rows: rows.slice(0, limit).map((charge) =>
      toRow(charge, names, `Vadesi ${daysBetween(charge.dueDate, today)} gün önce geçti`, "Gecikti"),
    ),
  };
}

export function upcomingRows(charges: Charge[], names: Map<string, string>, today: string, days = 14, limit = 5) {
  const rows = charges
    .filter((charge) => {
      const left = daysBetween(today, charge.dueDate);
      return left >= 0 && left <= days && num(charge.balance) > 0;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    count: rows.length,
    rows: rows.slice(0, limit).map((charge) => {
      const left = daysBetween(today, charge.dueDate);
      const { day, month } = parts(charge.dueDate);
      return toRow(charge, names, `${day} ${longMonths[month - 1]}`, left === 0 ? "Bugün" : `${left} gün`);
    }),
  };
}

// Kuruş cinsinden toplanır; kayan nokta farkı çubuk oranlarına yansımasın.
export function monthBreakdown(charges: Charge[], periodStart: string): MonthBreakdown | null {
  const month = charges.filter((charge) => charge.periodStart === periodStart);
  if (!month.length) return null;
  const cents = (value: unknown) => Math.round(num(value) * 100);
  const total = month.reduce((sum, charge) => sum + cents(charge.amount), 0);
  const paid = month.reduce((sum, charge) => sum + cents(charge.paidAmount), 0);
  const late = month.reduce((sum, charge) => sum + (charge.isOverdue ? cents(charge.balance) : 0), 0);
  return { total: total / 100, paid: paid / 100, late: late / 100, pending: Math.max(0, total - paid - late) / 100 };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function fetchPages<T>(path: string, query: string, maxPages: number): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const body = (await fetchJson(`${path}?${query}&page=${page}&pageSize=100`)) as { items?: T[]; hasMore?: boolean };
    if (Array.isArray(body.items)) items.push(...body.items);
    if (!body.hasMore) break;
  }
  return items;
}

export async function loadOverviewExtras(periodStart: string): Promise<OverviewExtras> {
  const [cashBodies, charges, tenants] = await Promise.all([
    Promise.all(
      monthRanges(periodStart).map((range) =>
        fetchJson(`/api/bff/reports/cashflow?fromDate=${range.from}&toDate=${range.to}`),
      ),
    ),
    fetchPages<Charge>(
      "/api/bff/rent-charges",
      `startPeriod=${addMonths(periodStart, -24)}&endPeriod=${addMonths(periodStart, 1)}`,
      5,
    ),
    fetchPages<Tenant>("/api/bff/tenants", "includeArchived=true", 3),
  ]);
  const cash = monthRanges(periodStart).map((range, i) => {
    const body = cashBodies[i] as { cashIn?: unknown; cashOut?: unknown };
    return { label: range.label, income: num(body.cashIn), expense: num(body.cashOut) };
  });
  return { cash, charges, names: new Map(tenants.map((tenant) => [tenant.id, tenantName(tenant)])) };
}
