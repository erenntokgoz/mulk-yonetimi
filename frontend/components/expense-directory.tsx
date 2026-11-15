"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";
type Expense = components["schemas"]["ExpenseResponse"];
type Property = components["schemas"]["PropertyResponse"];
type Unit = components["schemas"]["UnitResponse"];
const money = (v: number | string) => {
  const [integer, fraction = ""] = String(v).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)} ₺`;
};
const today = () => new Date().toLocaleDateString("en-CA");
const key = () => crypto.randomUUID().replaceAll("-", "");
function bodyMoney(body: object, value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Tutarı en çok iki ondalık basamakla girin.");
  return JSON.stringify(body).replace(`"amount":"${value}"`, `"amount":${value}`);
}
const labels: Record<components["schemas"]["ExpenseCategory"], string> = {
  MAINTENANCE: "Bakım",
  DUES: "Aidat",
  TAX: "Vergi",
  INSURANCE: "Sigorta",
  OTHER: "Diğer",
};
export function ExpenseDirectory() {
  const [items, setItems] = useState<Expense[]>([]);
  const [expensePage, setExpensePage] = useState(1);
  const [moreExpenses, setMoreExpenses] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [moreProperties, setMoreProperties] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitPages, setUnitPages] = useState<Record<string, { page: number; hasMore: boolean }>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ fromDate: "", toDate: "" });
  const [retry, setRetry] = useState<{ url: string; body: string; key: string } | null>(null);
  const load = useCallback(
    async function load() {
      setLoading(true);
      try {
        const [e, p] = await Promise.all([
          fetch(
            `/api/bff/expenses?page=1&pageSize=100${filters.fromDate ? `&fromDate=${filters.fromDate}` : ""}${filters.toDate ? `&toDate=${filters.toDate}` : ""}`,
            { cache: "no-store" },
          ),
          fetch("/api/bff/properties?page=1&pageSize=100", { cache: "no-store" }),
        ]);
        if (!e.ok || !p.ok)
          throw new Error(
            e.status === 401 || p.status === 401
              ? "Giderleri görmek için giriş yapın."
              : "Gider verileri alınamadı.",
          );
        const [ep, pp] = (await Promise.all([e.json(), p.json()])) as [
          { items: Expense[]; hasMore: boolean },
          { items: Property[]; hasMore: boolean },
        ];
        setItems(ep.items);
        setExpensePage(1); setMoreExpenses(ep.hasMore);
        const active = pp.items.filter((x) => !x.archivedAtUtc);
        setProperties(active);
        setPropertyPage(1); setMoreProperties(pp.hasMore);
        const up = await Promise.all(
          active.map(async (x) => {
            const r = await fetch(`/api/bff/properties/${x.id}/units?page=1&pageSize=100`, {
              cache: "no-store",
            });
            if (!r.ok) throw new Error("Birimler alınamadı.");
            return [x.id, (await r.json()) as { items: Unit[]; hasMore: boolean }] as const;
          }),
        );
        setUnits(up.flatMap(([, page]) => page.items.filter((item) => !item.archivedAtUtc)));
        setUnitPages(Object.fromEntries(up.map(([id, page]) => [id, { page: 1, hasMore: page.hasMore }])));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gider verileri alınamadı.");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );
  async function loadMoreExpenses() {
    setLoadingMore(true);
    try {
      const next = expensePage + 1;
      const response = await fetch(`/api/bff/expenses?page=${next}&pageSize=100${filters.fromDate ? `&fromDate=${filters.fromDate}` : ""}${filters.toDate ? `&toDate=${filters.toDate}` : ""}`,
        { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer giderler alınamadı.");
      const result = (await response.json()) as { items: Expense[]; hasMore: boolean };
      setItems((current) => [...current, ...result.items]);
      setExpensePage(next); setMoreExpenses(result.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer giderler alınamadı."); }
    finally { setLoadingMore(false); }
  }
  async function loadMoreSelections() {
    setLoadingMore(true);
    try {
      const response = moreProperties ? await fetch(`/api/bff/properties?page=${propertyPage + 1}&pageSize=100`,
        { cache: "no-store" }) : null;
      if (response && !response.ok) throw new Error("Diğer mülkler alınamadı.");
      const result = response ? (await response.json()) as { items: Property[]; hasMore: boolean } : null;
      const addedProperties = result?.items.filter((item) => !item.archivedAtUtc) ?? [];
      const targets = [...Object.entries(unitPages).filter(([, state]) => state.hasMore).map(([id, state]) =>
        ({ id, page: state.page + 1 })), ...addedProperties.map((item) => ({ id: item.id, page: 1 }))];
      const nextUnitPages = { ...unitPages };
      const addedUnits: Unit[] = [];
      for (const target of targets) {
        const unitResponse = await fetch(`/api/bff/properties/${target.id}/units?page=${target.page}&pageSize=100`,
          { cache: "no-store" });
        if (!unitResponse.ok) throw new Error("Diğer birimler alınamadı.");
        const page = (await unitResponse.json()) as { items: Unit[]; hasMore: boolean };
        addedUnits.push(...page.items.filter((item) => !item.archivedAtUtc));
        nextUnitPages[target.id] = { page: target.page, hasMore: page.hasMore };
      }
      if (result) {
        setProperties((current) => [...current, ...addedProperties]);
        setPropertyPage((current) => current + 1); setMoreProperties(result.hasMore);
      }
      setUnits((current) => [...current, ...addedUnits]); setUnitPages(nextUnitPages);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer seçim kayıtları alınamadı."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [filters, load]);
  async function send(r: { url: string; body: string; key: string }) {
    setPending(true);
    setError("");
    try {
      const x = await fetch(r.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": r.key },
        body: r.body,
      });
      if (!x.ok)
        throw new Error(
          x.status === 409
            ? "Kayıt çakışması. Verileri yenileyip tekrar deneyin."
            : "Gider kaydedilemedi; aynı istek güvenle yeniden denenebilir.",
        );
      setRetry(null);
      await load();
    } catch (e) {
      setRetry(r);
      setError(e instanceof Error ? e.message : "Gider kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const propertyId = String(f.get("propertyId"));
      const unit = String(f.get("unitId") || "");
      const amount = String(f.get("amount"));
      void send({
        url: "/api/bff/expenses",
        key: key(),
        body: bodyMoney(
          {
            propertyId,
            unitId: unit || null,
            category: String(f.get("category")),
            amount,
            expenseOn: String(f.get("expenseOn")),
            paidOn: String(f.get("paidOn") || "") || null,
            note: String(f.get("note") || "") || null,
          },
          amount,
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Formu kontrol edin.");
    }
  }
  async function voidExpense(x: Expense) {
    const reason = window.prompt("İptal gerekçesi");
    if (!reason?.trim()) return;
    setPending(true);
    try {
      const r = await fetch(`/api/bff/expenses/${x.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!r.ok) throw new Error("Gider iptal edilemedi.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gider iptal edilemedi.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="grid gap-5" aria-labelledby="expense-title">
      <div>
        <h1 id="expense-title" className="text-2xl font-semibold tracking-tight">
          Giderler
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Mülk ve bağımsız bölüm gider kayıtları</p>
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
          {retry && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => void send(retry)}>
              Aynı isteği tekrar dene
            </Button>
          )}
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
            Yeniden dene
          </Button>
        </div>
      )}
      {!error && (
        <>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-lg font-semibold">Gider kaydı</h2>
              {properties.length ? (
                <>
                <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
                  <label className="grid gap-1 text-sm">
                    Mülk
                    <select name="propertyId" required className="h-10 rounded border bg-background px-3">
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Bağımsız bölüm
                    <select name="unitId" className="h-10 rounded border bg-background px-3">
                      <option value="">Mülk geneli</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Kategori
                    <select name="category" className="h-10 rounded border bg-background px-3">
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Tutar (₺)
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className="h-10 rounded border bg-background px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Gider tarihi
                    <input
                      name="expenseOn"
                      type="date"
                      required
                      defaultValue={today()}
                      className="h-10 rounded border bg-background px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Ödeme tarihi
                    <input name="paidOn" type="date" className="h-10 rounded border bg-background px-3" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Not
                    <input name="note" maxLength={500} className="h-10 rounded border bg-background px-3" />
                  </label>
                  <Button type="submit" disabled={pending} className="self-end">
                    Gideri kaydet
                  </Button>
                </form>
                {(moreProperties || Object.values(unitPages).some((state) => state.hasMore)) &&
                  <Button type="button" variant="outline" disabled={loadingMore}
                    onClick={() => void loadMoreSelections()}>Diğer mülk ve birimleri yükle</Button>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Önce portföye bir mülk ekleyin.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-lg font-semibold">Gider kayıtları</h2>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    Başlangıç
                    <input
                      aria-label="Başlangıç tarihi"
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters((x) => ({ ...x, fromDate: e.target.value }))}
                      className="h-10 rounded border bg-background px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Bitiş
                    <input
                      aria-label="Bitiş tarihi"
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters((x) => ({ ...x, toDate: e.target.value }))}
                      className="h-10 rounded border bg-background px-3"
                    />
                  </label>
                </div>
              </div>
              {loading ? (
                <ListSkeleton label="Giderler yükleniyor…" />
              ) : items.length ? (
                <ul className="grid gap-3">
                  {items.map((x) => (
                    <li
                      key={x.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <h3 className="font-medium">
                          {labels[x.category]} · {money(x.amount)}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {properties.find((p) => p.id === x.propertyId)?.name ?? "Mülk"} · {x.expenseOn}
                          {x.paidOn ? ` · Ödendi ${x.paidOn}` : " · Ödenmedi"} ·{" "}
                          {x.status === "VOIDED" ? "İptal edildi" : "Kaydedildi"}
                        </p>
                        {x.voidReason && (
                          <p className="text-sm text-muted-foreground">Gerekçe: {x.voidReason}</p>
                        )}
                      </div>
                      {x.status === "RECORDED" && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={() => voidExpense(x)}
                        >
                          İptal et
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Bu tarih aralığında gider kaydı yok.
                </p>
              )}
              {moreExpenses && <Button type="button" variant="outline" disabled={loadingMore}
                onClick={() => void loadMoreExpenses()}>Diğer giderleri yükle</Button>}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
