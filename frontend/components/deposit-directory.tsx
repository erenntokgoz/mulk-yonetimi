"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, todayIso } from "@/lib/format";
import { toast } from "@/lib/toast";

type Deposit = components["schemas"]["DepositResponse"];
type Movement = components["schemas"]["DepositMovementResponse"];
type Lease = components["schemas"]["LeaseResponse"];
type Tenant = components["schemas"]["TenantResponse"];
const money = formatMoney;
const today = todayIso;
const key = () => crypto.randomUUID().replaceAll("-", "");
const decimalBody = (v: string) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(v)) throw new Error("Tutarı en çok iki ondalık basamakla girin.");
  return v;
};
function tenantName(tenant: Tenant | undefined) {
  if (!tenant) return "Kiracı";
  return tenant.kind === "COMPANY" ? (tenant.companyName ?? "Şirket") : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();
}

type DepositRequest = { url: string; body: string; key: string; success: string; form: HTMLFormElement };
const movementSuccess: Record<string, string> = {
  HELD: "Depozito tahsilatı kaydedildi.",
  RETURNED: "Depozito iadesi kaydedildi.",
  ADJUSTED: "Depozito düzeltmesi kaydedildi.",
};

export function DepositDirectory() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [depositPage, setDepositPage] = useState(1);
  const [moreDeposits, setMoreDeposits] = useState(false);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leasePage, setLeasePage] = useState(1);
  const [moreLeases, setMoreLeases] = useState(false);
  const [movements, setMovements] = useState<Record<string, Movement[]>>({});
  const [movementPages, setMovementPages] = useState<Record<string, { page: number; hasMore: boolean }>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataError, setDataError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<DepositRequest | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const leaseName = (lease: Lease | undefined) => lease
    ? `${tenantName(tenants.find((tenant) => tenant.id === lease.tenantId))} · ${formatDate(lease.startDate)} başlangıçlı sözleşme`
    : "Sözleşme";
  async function load() {
    setLoading(true);
    try {
      const get = (url: string) => fetch(url, { cache: "no-store" });
      const leasesRequest = get("/api/bff/leases?status=ACTIVE&page=1&pageSize=100");
      // Kiracı adları yalnız etiket içindir; alınamazsa depozito ekranı yine çalışır.
      void get("/api/bff/tenants?page=1&pageSize=100&includeArchived=true")
        .then(async (response) => response.ok ? setTenants(((await response.json()) as { items: Tenant[] }).items) : undefined)
        .catch(() => undefined);
      const d = await get("/api/bff/deposits?page=1&pageSize=100");
      if (!d.ok) {
        void leasesRequest.catch(() => undefined);
        throw new Error(
          d.status === 401 ? "Depozitoları görmek için giriş yapın." : "Depozito verileri alınamadı.",
        );
      }
      const dp = (await d.json()) as { items: Deposit[]; hasMore: boolean };
      // Hareket istekleri sözleşme yanıtını beklemeden, depozito listesi gelir gelmez başlar.
      const movementsRequest = Promise.all(
        dp.items.map(async (x) => {
          const r = await get(`/api/bff/deposits/${x.id}/movements?page=1&pageSize=100`);
          if (!r.ok) throw new Error("Hareket kayıtları alınamadı.");
          return [x.id, (await r.json()) as { items: Movement[]; hasMore: boolean }] as const;
        }),
      );
      const l = await leasesRequest;
      if (!l.ok) {
        void movementsRequest.catch(() => undefined);
        throw new Error(
          l.status === 401 ? "Depozitoları görmek için giriş yapın." : "Depozito verileri alınamadı.",
        );
      }
      const lp = (await l.json()) as { items: Lease[]; hasMore: boolean };
      setDeposits(dp.items);
      setDepositPage(1); setMoreDeposits(dp.hasMore);
      setLeases(lp.items);
      setLeasePage(1); setMoreLeases(lp.hasMore);
      const movementResults = await movementsRequest;
      setMovements(Object.fromEntries(movementResults.map(([id, page]) => [id, page.items])));
      setMovementPages(Object.fromEntries(movementResults.map(([id, page]) =>
        [id, { page: 1, hasMore: page.hasMore }])));
      setError("");
      setDataError("");
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Depozito verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }
  async function loadMore(kind: "leases" | "deposits" | "movements", id?: string) {
    setLoadingMore(true);
    try {
      const next = kind === "leases" ? leasePage + 1 : kind === "deposits" ? depositPage + 1
        : (movementPages[id ?? ""]?.page ?? 1) + 1;
      const path = kind === "movements" ? `deposits/${id}/movements` : kind;
      const query = kind === "leases" ? "&status=ACTIVE" : "";
      const response = await fetch(`/api/bff/${path}?page=${next}&pageSize=100${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer kayıtlar alınamadı.");
      if (kind === "leases") {
        const page = (await response.json()) as { items: Lease[]; hasMore: boolean };
        setLeases((current) => [...current, ...page.items]); setLeasePage(next); setMoreLeases(page.hasMore);
      } else if (kind === "movements" && id) {
        const page = (await response.json()) as { items: Movement[]; hasMore: boolean };
        setMovements((current) => ({ ...current, [id]: [...(current[id] ?? []), ...page.items] }));
        setMovementPages((current) => ({ ...current, [id]: { page: next, hasMore: page.hasMore } }));
      } else {
        const page = (await response.json()) as { items: Deposit[]; hasMore: boolean };
        const nextMovements = await Promise.all(page.items.map(async (deposit) => {
          const result = await fetch(`/api/bff/deposits/${deposit.id}/movements?page=1&pageSize=100`,
            { cache: "no-store" });
          if (!result.ok) throw new Error("Hareket kayıtları alınamadı.");
          return [deposit.id, (await result.json()) as { items: Movement[]; hasMore: boolean }] as const;
        }));
        setDeposits((current) => [...current, ...page.items]);
        setDepositPage(next); setMoreDeposits(page.hasMore);
        setMovements((current) => ({ ...current,
          ...Object.fromEntries(nextMovements.map(([movementId, result]) => [movementId, result.items])) }));
        setMovementPages((current) => ({ ...current,
          ...Object.fromEntries(nextMovements.map(([movementId, result]) =>
            [movementId, { page: 1, hasMore: result.hasMore }])) }));
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer kayıtlar alınamadı."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  async function send(req: DepositRequest) {
    setPending(true);
    setError("");
    try {
      const r = await fetch(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": req.key },
        body: req.body,
      });
      if (!r.ok)
        throw new Error(
          r.status === 409
            ? "Depozito bakiyesi yetersiz veya kayıt çakıştı."
            : "İşlem kaydedilemedi. Aynı istek güvenle yeniden denenebilir.",
        );
      setRetry(null);
      // Form yalnız başarıdan sonra temizlenir; hata olursa girilen bilgiler korunur.
      req.form.reset();
      await load();
      toast.success(req.success);
    } catch (e) {
      setRetry(req);
      setError(e instanceof Error ? e.message : "İşlem kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>, url: string, fields: (d: FormData) => object, success: (d: FormData) => string) {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const data = new FormData(f);
      void send({ url, body: JSON.stringify(fields(data)), key: key(), success: success(data), form: f });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Formu kontrol edin.");
    }
  }
  return (
    <section className="grid gap-5" aria-labelledby="deposit-title">
      <div>
        <h1 id="deposit-title" className="text-2xl font-semibold tracking-tight">
          Depozitolar
        </h1>
      </div>
      {(error || dataError) && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
          {dataError || error}
          {dataError.includes("giriş yapın") && (
            <Link className="ml-3 underline" href="/giris">
              Giriş yap
            </Link>
          )}
          {dataError && (
            <Button type="button" variant="outline" className="ml-3" onClick={() => void load()}>
              Yeniden dene
            </Button>
          )}
          {retry && (
            <Button
              type="button"
              variant="outline"
              className="ml-3"
              disabled={pending}
              onClick={() => void send(retry)}
            >
              Aynı isteği tekrar dene
            </Button>
          )}
        </div>
      )}
      {!dataError && (
        <>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-lg font-semibold">Depozito kaydı</h2>
              {loading ? (
                <ListSkeleton label="Sözleşmeler yükleniyor…" />
              ) : !leases.some((l) => Number(l.depositAmount) > 0 && !deposits.some((x) => x.leaseId === l.id)) ? (
                <p className="text-sm text-muted-foreground">Depozito kaydı açılacak etkin sözleşme yok.</p>
              ) : (
                <form
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(e) =>
                    submit(e, "/api/bff/deposits", (d) => ({
                      leaseId: String(d.get("leaseId")),
                      custodyType: String(d.get("custodyType")),
                      note: String(d.get("note") || "") || null,
                    }), () => "Depozito kaydı açıldı.")
                  }
                >
                  <label className="grid gap-1 text-sm">
                    Etkin sözleşme
                    <select name="leaseId" required className="h-10 w-full min-w-0 rounded border bg-background px-3">
                      {leases
                        .filter(
                          (l) => Number(l.depositAmount) > 0 && !deposits.some((x) => x.leaseId === l.id),
                        )
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {leaseName(l)} · {money(l.depositAmount)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Muhafaza biçimi
                    <select name="custodyType" className="h-10 rounded border bg-background px-3">
                      <option value="OWNER_HELD">Malik tarafından tutuluyor</option>
                      <option value="BANK_BLOCKED">Bankada bloke</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Not
                    <input name="note" maxLength={500} className="h-10 rounded border bg-background px-3" />
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      pending ||
                      !leases.some(
                        (l) => Number(l.depositAmount) > 0 && !deposits.some((x) => x.leaseId === l.id),
                      )
                    }
                    className="self-end"
                  >
                    Kaydı aç
                  </Button>
                </form>
              )}
              {moreLeases && <Button type="button" variant="outline" disabled={loadingMore}
                onClick={() => void loadMore("leases")}>Diğer sözleşmeleri yükle</Button>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-lg font-semibold">Kayıtlı depozitolar</h2>
              {loading ? (
                <ListSkeleton label="Depozitolar yükleniyor…" />
              ) : deposits.length ? (
                <div className="grid gap-3">
                  {deposits.map((d) => (
                    <article key={d.id} className="grid gap-3 rounded-lg border p-4">
                      <h3 className="font-medium">{leaseName(leases.find((lease) => lease.id === d.leaseId))} · {money(d.amountAgreed)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {d.custodyType === "OWNER_HELD" ? "Malik tarafından tutuluyor" : "Bankada bloke"} ·
                        Bakiye {money(d.balance)}
                        {d.note ? ` · ${d.note}` : ""}
                      </p>
                      <form
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
                        onSubmit={(e) =>
                          submit(e, `/api/bff/deposits/${d.id}/movements`, (f) => ({
                            movementOn: String(f.get("movementOn")),
                            movementType: String(f.get("movementType")),
                            amount: decimalBody(String(f.get("amount"))),
                            note: String(f.get("note") || "") || null,
                          }), (f) => movementSuccess[String(f.get("movementType"))] ?? "Depozito hareketi kaydedildi.")
                        }
                      >
                        <label className="grid gap-1 text-sm">
                          Hareket tarihi
                          <input
                            name="movementOn"
                            type="date"
                            required
                            defaultValue={today()}
                            className="h-10 rounded border bg-background px-3"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          Hareket
                          <select name="movementType" className="h-10 rounded border bg-background px-3">
                            <option value="HELD">Depozito alındı</option>
                            <option value="RETURNED">İade edildi</option>
                            <option value="ADJUSTED">Düzeltme</option>
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
                          Not / gerekçe
                          <input
                            name="note"
                            maxLength={500}
                            className="h-10 rounded border bg-background px-3"
                          />
                        </label>
                        <Button type="submit" disabled={pending} className="self-end">
                          Hareketi kaydet
                        </Button>
                      </form>
                      <ul className="grid gap-2 border-t pt-3 sm:grid-cols-2">
                        {(movements[d.id] ?? []).map((m) => (
                          <li key={m.id} className="text-sm">
                            {formatDate(m.movementOn)} ·{" "}
                            {m.movementType === "RETURNED"
                              ? "İade"
                              : m.movementType === "HELD"
                                ? "Alındı"
                                : "Düzeltme"}{" "}
                            · {money(m.amount)}
                            {m.note ? ` · ${m.note}` : ""}
                          </li>
                        ))}
                      </ul>
                      {movementPages[d.id]?.hasMore && <Button type="button" variant="outline" disabled={loadingMore}
                        onClick={() => void loadMore("movements", d.id)}>Diğer hareketleri yükle</Button>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Depozito kaydı yok.</p>
              )}
              {moreDeposits && <Button type="button" variant="outline" disabled={loadingMore}
                onClick={() => void loadMore("deposits")}>Diğer depozitoları yükle</Button>}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
