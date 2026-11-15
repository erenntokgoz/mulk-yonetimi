"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";
type CashFlow = components["schemas"]["CashFlowResponse"];
type Property = components["schemas"]["PropertyResponse"];
const money = (v: number | string | null) => {
  if (v === null) return "Kapsam dışı";
  const [integer, fraction = ""] = String(v).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)} ₺`;
};
const date = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function ReportDashboard() {
  const [range, setRange] = useState({
    fromDate: `${date(new Date()).slice(0, 4)}-01-01`,
    toDate: date(new Date()),
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [moreProperties, setMoreProperties] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [flow, setFlow] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const exportQuery = new URLSearchParams({ fromDate: range.fromDate, toDate: range.toDate });
  if (propertyId) exportQuery.set("propertyId", propertyId);
  if (unitId) exportQuery.set("unitId", unitId);
  useEffect(() => {
    void fetch("/api/bff/properties?page=1&pageSize=100", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Mülk listesi alınamadı.");
        const p = (await r.json()) as { items: Property[]; hasMore: boolean };
        setProperties(p.items.filter((x) => !x.archivedAtUtc));
        setMoreProperties(p.hasMore);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Mülk listesi alınamadı."));
  }, []);
  async function loadMoreProperties() {
    setLoadingMore(true);
    try {
      const next = propertyPage + 1;
      const response = await fetch(`/api/bff/properties?page=${next}&pageSize=100`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer mülkler alınamadı.");
      const result = (await response.json()) as { items: Property[]; hasMore: boolean };
      setProperties((current) => [...current, ...result.items.filter((item) => !item.archivedAtUtc)]);
      setPropertyPage(next); setMoreProperties(result.hasMore);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer mülkler alınamadı."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => {
    let active = true;
    const q = new URLSearchParams({ fromDate: range.fromDate, toDate: range.toDate });
    if (propertyId) q.set("propertyId", propertyId);
    if (unitId) q.set("unitId", unitId);
    void fetch(`/api/bff/reports/cashflow?${q}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 401
              ? "Raporları görmek için giriş yapın."
              : "Nakit akışı alınamadı. Filtreleri kontrol edin.",
          );
        return (await r.json()) as CashFlow;
      })
      .then((data) => {
        if (active) {
          setFlow(data);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setFlow(null);
          setError(e instanceof Error ? e.message : "Rapor alınamadı.");
          setLoading(false);
        }
      })
      .finally(() => {});
    return () => {
      active = false;
    };
  }, [range, propertyId, unitId]);
  return (
    <section className="grid gap-5" aria-labelledby="reports-title">
      <div>
        <h1 id="reports-title" className="text-2xl font-semibold tracking-tight">
          Raporlar
        </h1>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-card p-4 text-sm"
        >
          <p>{error}</p>
          {error.includes("giriş yapın") && (
            <Link className="underline" href="/giris">
              Giriş yap
            </Link>
          )}
        </div>
      )}
      <Card>
        <CardContent className="grid gap-4 p-5">
          <h2 className="text-lg font-semibold">Nakit akışı</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm">
              Başlangıç tarihi
              <input
                aria-label="Başlangıç tarihi"
                type="date"
                value={range.fromDate}
                onChange={(e) => setRange((x) => ({ ...x, fromDate: e.target.value }))}
                className="h-10 rounded border bg-background px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Bitiş tarihi
              <input
                aria-label="Bitiş tarihi"
                type="date"
                value={range.toDate}
                onChange={(e) => setRange((x) => ({ ...x, toDate: e.target.value }))}
                className="h-10 rounded border bg-background px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Mülk
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId("");
                }}
                className="h-10 rounded border bg-background px-3"
              >
                <option value="">Tüm portföy</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Birim UUID
              <input
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                aria-label="Birim UUID"
                placeholder="İsteğe bağlı"
                className="h-10 rounded border bg-background px-3"
              />
            </label>
          </div>
          {moreProperties && <Button type="button" variant="outline" disabled={loadingMore}
            onClick={() => void loadMoreProperties()}>Diğer mülkleri yükle</Button>}
          {flow && !error && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="lg"><a href={`/api/bff/reports/cashflow.csv?${exportQuery}`} download="cashflow.csv">Nakit akışı CSV</a></Button>
              <Button asChild variant="outline" size="lg"><a href={`/api/bff/reports/payments.csv?${exportQuery}`} download="payments.csv">Tahsilatlar CSV</a></Button>
            </div>
          )}
        </CardContent>
      </Card>
      {loading && <ListSkeleton label="Rapor yükleniyor…" />}
      {!loading && flow && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Tahsilatlar", flow.cashIn],
            ["Alacaklara dağıtılan", flow.allocated],
            ["Dağıtılmamış tahsilat", flow.unallocated],
            ["Ödenmiş giderler", flow.cashOut],
            ["Net işletme nakit akışı", flow.netOperatingCashFlow],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-5">
                <h2 className="text-sm text-muted-foreground">{label}</h2>
                <p className="mt-2 text-2xl font-semibold">{money(value as number | string | null)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {flow && (
        <p className="text-xs text-muted-foreground">
          {flow.fromDate} – {flow.toDate}
        </p>
      )}
    </section>
  );
}
