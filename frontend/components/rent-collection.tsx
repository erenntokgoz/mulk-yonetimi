"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type Charge = components["schemas"]["RentChargeResponse"];
type ChargePage = components["schemas"]["RentChargePage"];
type Payment = components["schemas"]["PaymentResponse"];
type PaymentPage = components["schemas"]["PaymentPage"];
type Tenant = components["schemas"]["TenantResponse"];
type PendingRequest = { url: string; body: string; key: string };
const jsonHeaders = { "Content-Type": "application/json" };
const showMoney = (value: number | string) => {
  const [integer, fraction = ""] = String(value).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)} ₺`;
};
function decimalBody<T extends object>(payload: T, field: keyof T & string, allowZero = false) {
  const raw = String((payload as Record<string, unknown>)[field] ?? "").trim();
  if (!(allowZero ? /^(?:0|\d+(?:\.\d{1,2})?)$/ : /^\d+(?:\.\d{1,2})?$/).test(raw))
    throw new Error("Tutarı en çok iki ondalık basamakla girin.");
  return JSON.stringify(payload).replace(`"${field}":${JSON.stringify(raw)}`, `"${field}":${raw}`);
}
function idempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "");
}
function dateInputToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function hasPositiveMoney(value: number | string) {
  return /[1-9]/.test(String(value).replace(/[^0-9]/g, ""));
}
function tenantName(tenant: Tenant) {
  return tenant.kind === "COMPANY"
    ? (tenant.companyName ?? "Şirket")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();
}

export function RentCollection() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [chargePage, setChargePage] = useState(1);
  const [moreCharges, setMoreCharges] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [morePayments, setMorePayments] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantPage, setTenantPage] = useState(1);
  const [moreTenants, setMoreTenants] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [includeClosed, setIncludeClosed] = useState(true);
  const [retry, setRetry] = useState<PendingRequest | null>(null);
  const [correctionId, setCorrectionId] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const tenantNames = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenantName(tenant)])),
    [tenants],
  );

  async function load() {
    setLoading(true);
    try {
      const [chargeResponse, paymentResponse, tenantResponse] = await Promise.all([
        fetch("/api/bff/rent-charges?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/bff/payments?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/bff/tenants?page=1&pageSize=100&includeArchived=true", { cache: "no-store" }),
      ]);
      if ([chargeResponse, paymentResponse, tenantResponse].some((response) => !response.ok)) {
        throw new Error(
          [chargeResponse, paymentResponse, tenantResponse].some((response) => response.status === 401)
            ? "Kira ve tahsilat kayıtlarını görmek için giriş yapın."
            : "Kira ve tahsilat verileri alınamadı.",
        );
      }
      const [chargePage, paymentPage, tenantPage] = (await Promise.all([
        chargeResponse.json(),
        paymentResponse.json(),
        tenantResponse.json(),
      ])) as [ChargePage, PaymentPage, { items: Tenant[]; hasMore: boolean }];
      setCharges(chargePage.items);
      setChargePage(1); setMoreCharges(chargePage.hasMore);
      setPayments(paymentPage.items);
      setPaymentPage(1); setMorePayments(paymentPage.hasMore);
      setTenants(tenantPage.items);
      setTenantPage(1); setMoreTenants(tenantPage.hasMore);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kira ve tahsilat verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }
  async function loadMore(kind: "charges" | "payments" | "tenants") {
    setLoadingMore(true);
    try {
      const next = (kind === "charges" ? chargePage : kind === "payments" ? paymentPage : tenantPage) + 1;
      const path = kind === "charges" ? "rent-charges" : kind;
      const query = kind === "tenants" ? "&includeArchived=true" : "";
      const response = await fetch(`/api/bff/${path}?page=${next}&pageSize=100${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer kayıtlar alınamadı.");
      const result = (await response.json()) as { items: unknown[]; hasMore: boolean };
      if (kind === "charges") {
        setCharges((current) => [...current, ...(result.items as Charge[])]);
        setChargePage(next); setMoreCharges(result.hasMore);
      } else if (kind === "payments") {
        setPayments((current) => [...current, ...(result.items as Payment[])]);
        setPaymentPage(next); setMorePayments(result.hasMore);
      } else {
        setTenants((current) => [...current, ...(result.items as Tenant[])]);
        setTenantPage(next); setMoreTenants(result.hasMore);
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer kayıtlar alınamadı."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function send(request: PendingRequest) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: { ...jsonHeaders, "Idempotency-Key": request.key },
        body: request.body,
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Kayıt çakışması var. Verileri yenileyip işlemi gözden geçirin."
            : response.status === 401
              ? "Oturum süresi dolmuş. Yeniden giriş yapın."
              : "İşlem kaydedilemedi. Aynı isteği güvenle yeniden deneyebilirsiniz.",
        );
      setRetry(null);
      setCorrectionId("");
      setAllocationId("");
      await load();
    } catch (cause) {
      setRetry(request);
      setError(cause instanceof Error ? cause.message : "İşlem kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  function submit(
    event: FormEvent<HTMLFormElement>,
    url: string,
    makeBody: (data: FormData) => string,
    key = idempotencyKey(),
  ) {
    event.preventDefault();
    try {
      void send({ url, key, body: makeBody(new FormData(event.currentTarget)) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Form bilgilerini kontrol edin.");
    }
  }
  async function voidPayment(payment: Payment) {
    const reason = window.prompt("İptal gerekçesi");
    if (!reason?.trim()) return;
    const body = JSON.stringify({
      reason: reason.trim(),
    } satisfies components["schemas"]["VoidPaymentRequest"]);
    await send({ url: `/api/bff/payments/${payment.id}/void`, body, key: idempotencyKey() });
  }

  const visibleCharges = includeClosed ? charges : charges.filter((charge) => charge.status !== "PAID");
  return (
    <section className="grid gap-5" aria-labelledby="rent-collection-title">
      <div>
        <h1 id="rent-collection-title" className="text-2xl font-semibold tracking-tight">
          Kira ve tahsilatlar
        </h1>
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
          <p>{error}</p>
          {retry && (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={pending}
              onClick={() => void send(retry)}
            >
              {pending ? "Tekrar deneniyor…" : "Aynı isteği tekrar dene"}
            </Button>
          )}
        </div>
      )}
      <Card>
        <CardContent className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Alacaklar</h2>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => setIncludeClosed(event.target.checked)}
              />
              Ödenenleri göster
            </label>
          </div>
          {loading ? (
            <ListSkeleton label="Alacaklar yükleniyor…" />
          ) : visibleCharges.length ? (
            <div className="grid gap-3">
              {visibleCharges.map((charge) => (
                <article
                  key={charge.id}
                  className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <h3 className="font-medium">
                      {tenantNames.get(charge.tenantId) ?? "Kiracı"} · {charge.periodStart.slice(0, 7)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vade {charge.dueDate} ·{" "}
                      {charge.status === "PAID"
                        ? "Ödendi"
                        : charge.status === "PARTIAL"
                          ? "Kısmi ödendi"
                          : "Ödenmedi"}
                      {charge.isOverdue ? " · Gecikmiş" : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      Alacak {showMoney(charge.amount)} · Ödenen {showMoney(charge.paidAmount)} · Bakiye{" "}
                      <strong>{showMoney(charge.balance)}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCorrectionId(correctionId === charge.id ? "" : charge.id)}
                    >
                      Düzelt
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAllocationId(allocationId === charge.id ? "" : charge.id)}
                    >
                      Tahsilat dağıt
                    </Button>
                  </div>
                  {correctionId === charge.id && (
                    <form
                      className="grid gap-3 rounded-md bg-muted/40 p-3 sm:col-span-2 sm:grid-cols-[1fr_2fr_auto]"
                      onSubmit={(event) =>
                        submit(event, `/api/bff/rent-charges/${charge.id}/corrections`, (data) =>
                          decimalBody(
                            {
                              amount: String(data.get("amount")),
                              reason: String(data.get("reason")),
                            } satisfies components["schemas"]["CorrectRentChargeRequest"],
                            "amount",
                            true,
                          ),
                        )
                      }
                    >
                      <label className="grid gap-1 text-sm">
                        Yeni tutar (₺)
                        <input
                          name="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          defaultValue={String(charge.amount)}
                          className="h-10 rounded border bg-background px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Gerekçe
                        <input
                          name="reason"
                          required
                          maxLength={500}
                          className="h-10 rounded border bg-background px-3"
                        />
                      </label>
                      <Button type="submit" disabled={pending} className="self-end">
                        Düzeltmeyi kaydet
                      </Button>
                    </form>
                  )}
                  {allocationId === charge.id && (
                    <form
                      className="grid gap-3 rounded-md bg-muted/40 p-3 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]"
                      onSubmit={(event) => {
                        const paymentId = (
                          new FormData(event.currentTarget).get("paymentId") ?? ""
                        ).toString();
                        submit(event, `/api/bff/payments/${paymentId}/allocations`, (data) =>
                          decimalBody(
                            {
                              rentChargeId: charge.id,
                              amount: String(data.get("amount")),
                            } satisfies components["schemas"]["AllocatePaymentRequest"],
                            "amount",
                          ),
                        );
                      }}
                    >
                      <label className="grid gap-1 text-sm">
                        Tahsilat
                        <select name="paymentId" required className="h-10 rounded border bg-background px-3">
                          {payments
                            .filter(
                              (payment) =>
                                payment.tenantId === charge.tenantId &&
                                payment.status === "RECORDED" &&
                                hasPositiveMoney(payment.unallocatedAmount),
                            )
                            .map((payment) => (
                              <option key={payment.id} value={payment.id}>
                                {payment.paidOn} · {showMoney(payment.unallocatedAmount)} bekliyor
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm">
                        Dağıtılacak tutar (₺)
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          defaultValue={String(charge.balance)}
                          className="h-10 rounded border bg-background px-3"
                        />
                      </label>
                      <Button
                        type="submit"
                        disabled={
                          pending ||
                          !payments.some(
                            (payment) =>
                              payment.tenantId === charge.tenantId &&
                              payment.status === "RECORDED" &&
                              hasPositiveMoney(payment.unallocatedAmount),
                          )
                        }
                        className="self-end"
                      >
                        Dağıtımı kaydet
                      </Button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Gösterilecek alacak kaydı yok.</p>
          )}
          {moreCharges && <Button type="button" variant="outline" disabled={loadingMore}
            onClick={() => void loadMore("charges")}>Diğer alacakları yükle</Button>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Tahsilatlar</h2>
          </div>
          <form
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(event) =>
              submit(event, "/api/bff/payments", (data) =>
                decimalBody(
                  {
                    tenantId: String(data.get("tenantId")),
                    paidOn: String(data.get("paidOn")),
                    amount: String(data.get("amount")),
                    method: String(data.get("method")) as components["schemas"]["PaymentMethod"],
                    reference: String(data.get("reference") || "") || null,
                  } satisfies components["schemas"]["CreatePaymentRequest"],
                  "amount",
                ),
              )
            }
          >
            <label className="grid gap-1 text-sm">
              Kiracı
              <select name="tenantId" required className="h-10 rounded border bg-background px-3">
                {tenants
                  .filter((tenant) => !tenant.archivedAtUtc)
                  .map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenantName(tenant)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Ödeme tarihi
              <input
                name="paidOn"
                type="date"
                required
                defaultValue={dateInputToday()}
                className="h-10 rounded border bg-background px-3"
              />
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
              Yöntem
              <select name="method" className="h-10 rounded border bg-background px-3">
                <option value="TRANSFER">Havale/EFT</option>
                <option value="CASH">Nakit</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Referans
              <input name="reference" maxLength={200} className="h-10 rounded border bg-background px-3" />
            </label>
            <Button
              type="submit"
              disabled={pending || !tenants.some((tenant) => !tenant.archivedAtUtc)}
              className="sm:col-span-2 lg:col-span-5"
            >
              Tahsilatı kaydet
            </Button>
          </form>
          {moreTenants && <Button type="button" variant="outline" disabled={loadingMore}
            onClick={() => void loadMore("tenants")}>Diğer kiracıları yükle</Button>}
          {loading ? (
            <ListSkeleton label="Tahsilatlar yükleniyor…" />
          ) : payments.length ? (
            <ul className="grid gap-3">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <h3 className="font-medium">
                      {tenantNames.get(payment.tenantId) ?? "Kiracı"} · {payment.paidOn}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {payment.method === "TRANSFER"
                        ? "Havale/EFT"
                        : payment.method === "CASH"
                          ? "Nakit"
                          : "Diğer"}
                      {payment.reference ? ` · ${payment.reference}` : ""} ·{" "}
                      {payment.status === "VOIDED" ? "İptal edildi" : "Kaydedildi"}
                    </p>
                    <p className="mt-1 text-sm">
                      {showMoney(payment.amount)} · Dağıtılan {showMoney(payment.allocatedAmount)} · Bekleyen{" "}
                      {showMoney(payment.unallocatedAmount)}
                    </p>
                    {payment.voidReason && (
                      <p className="text-sm text-muted-foreground">İptal gerekçesi: {payment.voidReason}</p>
                    )}
                  </div>
                  {payment.status === "RECORDED" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void voidPayment(payment)}
                    >
                      İptal et
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Tahsilat kaydı yok.</p>
          )}
          {morePayments && <Button type="button" variant="outline" disabled={loadingMore}
            onClick={() => void loadMore("payments")}>Diğer tahsilatları yükle</Button>}
        </CardContent>
      </Card>
    </section>
  );
}
