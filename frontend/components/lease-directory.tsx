"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type Lease = components["schemas"]["LeaseResponse"];
type LeasePage = components["schemas"]["LeasePage"];
type Property = components["schemas"]["PropertyResponse"];
type Unit = components["schemas"]["UnitResponse"];
type Tenant = components["schemas"]["TenantResponse"];
type Rate = components["schemas"]["LeaseRateResponse"];
type Renewal = components["schemas"]["LeaseRenewalResponse"];
const headers = { "Content-Type": "application/json" };
const dateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const nextMonthStart = () => {
  const now = new Date();
  return dateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));
};
const moneyBody = (body: Record<string, unknown>, fields: string[]) => {
  let json = JSON.stringify(body);
  for (const field of fields) {
    const raw = String(body[field] ?? "").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Tutarı en çok iki ondalık basamakla girin.");
    json = json.replace(`"${field}":${JSON.stringify(raw)}`, `"${field}":${raw}`);
  }
  return json;
};
const showMoney = (value: number | string) => {
  const [integer, fraction = ""] = String(value).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)} ₺`;
};
const leaseStatus: Record<components["schemas"]["LeaseStatus"], string> = {
  DRAFT: "Taslak",
  ACTIVE: "Etkin",
  TERMINATED: "Sonlandırıldı",
};

export function LeaseDirectory() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leasePage, setLeasePage] = useState(1);
  const [moreLeases, setMoreLeases] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [moreProperties, setMoreProperties] = useState(false);
  const [unitPages, setUnitPages] = useState<Record<string, { page: number; hasMore: boolean }>>({});
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantPage, setTenantPage] = useState(1);
  const [moreTenants, setMoreTenants] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [detailId, setDetailId] = useState("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [renewId, setRenewId] = useState("");
  const [rateAmount, setRateAmount] = useState("");
  const [rateReason, setRateReason] = useState("");
  const [terminateId, setTerminateId] = useState("");
  const [rateDate, setRateDate] = useState(nextMonthStart());
  const unitNames = useMemo(() => new Map(units.map((unit) => [unit.id, unit.label])), [units]);
  const tenantNames = useMemo(
    () =>
      new Map(
        tenants.map((tenant) => [
          tenant.id,
          tenant.kind === "COMPANY"
            ? (tenant.companyName ?? "")
            : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim(),
        ]),
      ),
    [tenants],
  );

  async function load() {
    setLoading(true);
    try {
      const [leaseResponse, propertyResponse, tenantResponse] = await Promise.all([
        fetch("/api/bff/leases?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/bff/properties?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/bff/tenants?page=1&pageSize=100", { cache: "no-store" }),
      ]);
      if ([leaseResponse, propertyResponse, tenantResponse].some((response) => !response.ok)) {
        const authFailure = [leaseResponse, propertyResponse, tenantResponse].some(
          (response) => response.status === 401,
        );
        throw new Error(
          authFailure ? "Sözleşmeleri görmek için giriş yapın." : "Sözleşme verileri alınamadı.",
        );
      }
      const [leasePage, propertyPage, tenantPage] = (await Promise.all([
        leaseResponse.json(),
        propertyResponse.json(),
        tenantResponse.json(),
      ])) as [LeasePage, { items: Property[]; hasMore: boolean }, { items: Tenant[]; hasMore: boolean }];
      const activeProperties = propertyPage.items.filter((property) => !property.archivedAtUtc);
      const unitPages = await Promise.all(
        activeProperties.map(async (property) => {
          const response = await fetch(`/api/bff/properties/${property.id}/units?page=1&pageSize=100`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Birim kayıtları alınamadı.");
          return [property.id, (await response.json()) as { items: Unit[]; hasMore: boolean }] as const;
        }),
      );
      setLeases(leasePage.items);
      setLeasePage(1);
      setMoreLeases(leasePage.hasMore);
      setUnits(unitPages.flatMap(([, page]) => page.items.filter((unit) => !unit.archivedAtUtc)));
      setUnitPages(Object.fromEntries(unitPages.map(([id, page]) => [id, { page: 1, hasMore: page.hasMore }])));
      setPropertyPage(1);
      setMoreProperties(propertyPage.hasMore);
      setTenants(tenantPage.items.filter((tenant) => !tenant.archivedAtUtc));
      setTenantPage(1);
      setMoreTenants(tenantPage.hasMore);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sözleşme verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }
  async function loadMoreLeases() {
    setLoadingMore(true);
    try {
      const next = leasePage + 1;
      const response = await fetch(`/api/bff/leases?page=${next}&pageSize=100`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer sözleşmeler alınamadı.");
      const page = (await response.json()) as LeasePage;
      setLeases((current) => [...current, ...page.items]);
      setLeasePage(next);
      setMoreLeases(page.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer sözleşmeler alınamadı."); }
    finally { setLoadingMore(false); }
  }
  async function loadMoreSelections() {
    setLoadingMore(true);
    try {
      const propertyResponse = moreProperties
        ? await fetch(`/api/bff/properties?page=${propertyPage + 1}&pageSize=100`, { cache: "no-store" }) : null;
      const tenantResponse = moreTenants
        ? await fetch(`/api/bff/tenants?page=${tenantPage + 1}&pageSize=100`, { cache: "no-store" }) : null;
      if (propertyResponse && !propertyResponse.ok || tenantResponse && !tenantResponse.ok)
        throw new Error("Diğer seçim kayıtları alınamadı.");
      const properties = propertyResponse ? (await propertyResponse.json()) as { items: Property[]; hasMore: boolean } : null;
      const tenantResult = tenantResponse ? (await tenantResponse.json()) as { items: Tenant[]; hasMore: boolean } : null;
      const nextUnitPages = { ...unitPages };
      const addedUnits: Unit[] = [];
      const targets = [...Object.entries(unitPages).filter(([, state]) => state.hasMore).map(([id, state]) =>
        ({ id, page: state.page + 1 })),
        ...(properties?.items.filter((item) => !item.archivedAtUtc).map((item) => ({ id: item.id, page: 1 })) ?? [])];
      for (const target of targets) {
        const response = await fetch(`/api/bff/properties/${target.id}/units?page=${target.page}&pageSize=100`,
          { cache: "no-store" });
        if (!response.ok) throw new Error("Diğer birimler alınamadı.");
        const result = (await response.json()) as { items: Unit[]; hasMore: boolean };
        addedUnits.push(...result.items.filter((unit) => !unit.archivedAtUtc));
        nextUnitPages[target.id] = { page: target.page, hasMore: result.hasMore };
      }
      if (properties) { setPropertyPage((current) => current + 1); setMoreProperties(properties.hasMore); }
      if (tenantResult) {
        setTenants((current) => [...current, ...tenantResult.items.filter((item) => !item.archivedAtUtc)]);
        setTenantPage((current) => current + 1);
        setMoreTenants(tenantResult.hasMore);
      }
      setUnits((current) => [...current, ...addedUnits]);
      setUnitPages(nextUnitPages);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer seçim kayıtları alınamadı."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const startDate = String(data.get("startDate"));
      const planned = String(data.get("plannedEndDate") || "");
      const payload: components["schemas"]["CreateLeaseRequest"] = {
        unitId: String(data.get("unitId")),
        tenantId: String(data.get("tenantId")),
        startDate,
        plannedEndDate: planned || null,
        dueDay: Number(data.get("dueDay")),
        monthlyAmount: String(data.get("monthlyAmount")),
        depositAmount: String(data.get("depositAmount") || "0"),
        note: String(data.get("note") || "") || null,
      };
      const body = moneyBody(payload, ["monthlyAmount", "depositAmount"]);
      const response = await fetch("/api/bff/leases", { method: "POST", headers, body });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Bu birim için etkin sözleşme çakışması var."
            : "Sözleşme taslağı kaydedilemedi. Bilgileri kontrol edin.",
        );
      setOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sözleşme taslağı kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function activate(lease: Lease) {
    if (!window.confirm("Sözleşme etkinleştirilsin mi?")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/leases/${lease.id}/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ version: lease.version }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Sözleşme veya birim durumu değişti. Listeyi yenileyin."
            : "Sözleşme etkinleştirilemedi.",
        );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sözleşme etkinleştirilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function showRates(leaseId: string) {
    setDetailId(leaseId);
    setError("");
    try {
      const [response, history] = await Promise.all([
        fetch(`/api/bff/leases/${leaseId}/rates`, { cache: "no-store" }),
        fetch(`/api/bff/leases/${leaseId}/renewals`, { cache: "no-store" }),
      ]);
      if (!response.ok || !history.ok) throw new Error("Sözleşme geçmişi alınamadı.");
      setRates((await response.json()) as Rate[]);
      setRenewals((await history.json()) as Renewal[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kira bedeli geçmişi alınamadı.");
    }
  }
  async function renew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lease = leases.find((item) => item.id === renewId);
    if (!lease) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const payload: components["schemas"]["RenewLeaseRequest"] = {
        version: lease.version,
        newEndDate: String(data.get("newEndDate")),
        effectiveFrom: String(data.get("effectiveFrom")),
        monthlyAmount: String(data.get("monthlyAmount")),
        reason: String(data.get("reason")),
      };
      const response = await fetch(`/api/bff/leases/${lease.id}/renewals`, {
        method: "POST", headers, body: moneyBody(payload, ["monthlyAmount"]),
      });
      if (!response.ok) throw new Error(response.status === 409
        ? "Sözleşme veya sonraki dönem kayıtları değişti. Listeyi yenileyin."
        : "Yenileme kaydedilemedi. Tarih ve tutarı kontrol edin.");
      setRenewId("");
      await load();
      await showRates(lease.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Yenileme kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function addRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailId) return;
    setPending(true);
    setError("");
    try {
      const payload: components["schemas"]["CreateLeaseRateRequest"] = {
        effectiveFrom: rateDate,
        monthlyAmount: rateAmount,
        reason: rateReason,
      };
      const body = moneyBody(payload, ["monthlyAmount"]);
      const response = await fetch(`/api/bff/leases/${detailId}/rates`, { method: "POST", headers, body });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Bu tarih için alacak veya bedel kaydı var."
            : "Kira bedeli eklenemedi. Tarih ve tutarı kontrol edin.",
        );
      setRateAmount("");
      setRateReason("");
      await showRates(detailId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kira bedeli eklenemedi.");
    } finally {
      setPending(false);
    }
  }
  async function terminate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const lease = leases.find((item) => item.id === terminateId);
    if (!lease) {
      setPending(false);
      return;
    }
    try {
      const response = await fetch(`/api/bff/leases/${lease.id}/terminate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          version: lease.version,
          terminationDate: data.get("terminationDate"),
          reason: data.get("reason"),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409 ? "Sözleşme değişti. Listeyi yenileyin." : "Sözleşme sonlandırılamadı.",
        );
      setTerminateId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sözleşme sonlandırılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="leases-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="leases-title" className="text-2xl font-semibold tracking-tight">
            Sözleşmeler
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Taslak, etkin ve sonlandırılmış sözleşmeler</p>
        </div>
        <Button
          type="button"
          disabled={!units.length || !tenants.length}
          onClick={() => {
            setOpen(!open);
            setError("");
          }}
        >
          {open ? "Formu kapat" : "Sözleşme oluştur"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
          {error}
        </p>
      )}
      {open && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Birim
                <select name="unitId" required className="h-11 rounded-md border bg-background px-3">
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Kiracı
                <select name="tenantId" required className="h-11 rounded-md border bg-background px-3">
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.kind === "COMPANY"
                        ? tenant.companyName
                        : `${tenant.firstName} ${tenant.lastName}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Başlangıç tarihi
                <input
                  name="startDate"
                  type="date"
                  required
                  defaultValue={dateString(new Date())}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Planlanan bitiş tarihi
                <input
                  name="plannedEndDate"
                  type="date"
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Vade günü
                <input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  required
                  defaultValue="1"
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Aylık kira (₺)
                <input
                  name="monthlyAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Depozito (₺)
                <input
                  name="depositAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0.00"
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Not
                <input name="note" maxLength={1000} className="h-11 rounded-md border bg-background px-3" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending || !units.length || !tenants.length}>
                  {pending ? "Kaydediliyor…" : "Taslağı kaydet"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Vazgeç
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {open && (moreProperties || moreTenants || Object.values(unitPages).some((state) => state.hasMore)) &&
        <Button type="button" variant="outline" disabled={loadingMore}
          onClick={() => void loadMoreSelections()}>Diğer birim ve kiracıları yükle</Button>}
      {terminateId && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={terminate} className="grid gap-4 sm:grid-cols-3">
              <h2 className="font-semibold sm:col-span-3">Sözleşmeyi sonlandır</h2>
              <label className="grid gap-2 text-sm">
                Sonlandırma tarihi
                <input
                  name="terminationDate"
                  type="date"
                  required
                  max={dateString(new Date())}
                  defaultValue={dateString(new Date())}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm sm:col-span-2">
                Gerekçe
                <input
                  name="reason"
                  required
                  maxLength={500}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" disabled={pending}>
                  {pending ? "Kaydediliyor…" : "Sonlandırmayı kaydet"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setTerminateId("")}>
                  Vazgeç
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {renewId && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={renew} className="grid gap-4 sm:grid-cols-2">
              <h2 className="font-semibold sm:col-span-2">Sözleşmeyi yenile</h2>
              <label className="grid gap-2 text-sm">Yeni bitiş tarihi
                <input name="newEndDate" type="date" required min={leases.find((item) => item.id === renewId)?.plannedEndDate ?? undefined}
                  className="h-11 rounded-md border bg-background px-3" />
              </label>
              <label className="grid gap-2 text-sm">Yeni bedelin başlangıcı
                <input name="effectiveFrom" type="date" required min={nextMonthStart()} defaultValue={nextMonthStart()}
                  className="h-11 rounded-md border bg-background px-3" />
              </label>
              <label className="grid gap-2 text-sm">Aylık kira (₺)
                <input name="monthlyAmount" type="number" min="0.01" step="0.01" required
                  className="h-11 rounded-md border bg-background px-3" />
              </label>
              <label className="grid gap-2 text-sm">Gerekçe
                <input name="reason" required maxLength={500} className="h-11 rounded-md border bg-background px-3" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Yenilemeyi kaydet"}</Button>
                <Button type="button" variant="outline" onClick={() => setRenewId("")}>Vazgeç</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <Card>
          <CardContent>
            <ListSkeleton label="Sözleşmeler yükleniyor…" />
          </CardContent>
        </Card>
      ) : !leases.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="font-medium">Sözleşme kaydı yok</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sözleşme oluşturmak için etkin birim ve kiracı kayıtları gerekir.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {leases.map((lease) => (
            <Card key={lease.id}>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">
                      {unitNames.get(lease.unitId) ?? "Birim"} · {tenantNames.get(lease.tenantId) ?? "Kiracı"}
                    </h2>
                    <span className="rounded-full border px-2.5 py-1 text-xs">
                      {leaseStatus[lease.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lease.startDate}
                    {lease.plannedEndDate ? ` – ${lease.plannedEndDate}` : ""} · Vade günü {lease.dueDay}
                  </p>
                  {lease.note && <p className="mt-1 text-sm text-muted-foreground">{lease.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {lease.status === "DRAFT" && (
                    <Button type="button" disabled={pending} onClick={() => void activate(lease)}>
                      Etkinleştir
                    </Button>
                  )}
                  {lease.status === "ACTIVE" && (
                    lease.plannedEndDate && <Button type="button" variant="outline" disabled={pending}
                      onClick={() => setRenewId(lease.id)}>Yenile</Button>
                  )}
                  {lease.status === "ACTIVE" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setTerminateId(lease.id)}
                    >
                      Sonlandır
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => void showRates(lease.id)}>
                    Kira bedelleri
                  </Button>
                </div>
              </CardContent>
              {detailId === lease.id && (
                <CardContent className="grid gap-4 border-t p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Kira bedeli geçmişi</h3>
                    <Button type="button" variant="ghost" onClick={() => setDetailId("")}>
                      Kapat
                    </Button>
                  </div>
                  {rates.length ? (
                    <ul className="grid gap-2">
                      {rates.map((rate) => (
                        <li
                          key={rate.effectiveFrom}
                          className="flex flex-wrap justify-between gap-2 rounded border p-3 text-sm"
                        >
                          <span>
                            {rate.effectiveFrom}
                            {rate.reason ? ` · ${rate.reason}` : ""}
                          </span>
                          <strong>{showMoney(rate.monthlyAmount)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bedel geçmişi alınamadı veya boş.</p>
                  )}
                  {renewals.length > 0 && (
                    <div className="grid gap-2 text-sm">
                      <h4 className="font-medium">Ek protokoller</h4>
                      <ul className="grid gap-2">{renewals.map((item) => (
                        <li key={item.id} className="rounded border p-3">
                          {item.previousEndDate} → {item.newEndDate} · {item.effectiveFrom} · {showMoney(item.monthlyAmount)} · {item.reason}
                        </li>
                      ))}</ul>
                    </div>
                  )}
                  {lease.status === "ACTIVE" && (
                    <form onSubmit={addRate} className="grid gap-3 sm:grid-cols-3">
                      <h4 className="font-medium sm:col-span-3">Yeni bedel ekle</h4>
                      <label className="grid gap-2 text-sm">
                        Başlangıç tarihi
                        <input
                          type="date"
                          required
                          min={nextMonthStart()}
                          value={rateDate}
                          onChange={(event) => setRateDate(event.target.value)}
                          className="h-11 rounded-md border bg-background px-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        Aylık kira (₺)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={rateAmount}
                          onChange={(event) => setRateAmount(event.target.value)}
                          className="h-11 rounded-md border bg-background px-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        Gerekçe
                        <input
                          required
                          maxLength={500}
                          value={rateReason}
                          onChange={(event) => setRateReason(event.target.value)}
                          className="h-11 rounded-md border bg-background px-3"
                        />
                      </label>
                      <Button type="submit" disabled={pending} className="sm:col-span-3">
                        {pending ? "Kaydediliyor…" : "Bedeli kaydet"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      {moreLeases && <Button type="button" variant="outline" disabled={loadingMore}
        onClick={() => void loadMoreLeases()}>Diğer sözleşmeleri yükle</Button>}
    </section>
  );
}
