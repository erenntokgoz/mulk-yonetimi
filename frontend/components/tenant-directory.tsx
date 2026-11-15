"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type Tenant = components["schemas"]["TenantResponse"];
type TenantPage = components["schemas"]["TenantPage"];
const headers = { "Content-Type": "application/json" };
const displayName = (tenant: Tenant) =>
  tenant.kind === "COMPANY"
    ? (tenant.companyName ?? "")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

export function TenantDirectory() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [kind, setKind] = useState<components["schemas"]["TenantKind"]>("PERSON");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async (search: string, archived: boolean, requestedPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(requestedPage), pageSize: "100", includeArchived: String(archived) });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/bff/tenants?${params}`, { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 401 ? "Kiracıları görmek için giriş yapın." : "Kiracı kayıtları alınamadı.",
        );
      const page = (await response.json()) as TenantPage;
      setItems((current) => requestedPage === 1 ? page.items : [...current, ...page.items]);
      setCurrentPage(requestedPage);
      setHasMore(page.hasMore);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kiracı kayıtları alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => load("", false));
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setConflict(false);
    setError("");
    const data = new FormData(event.currentTarget);
    const details: components["schemas"]["TenantDetails"] = {
      kind,
      firstName: kind === "PERSON" ? String(data.get("firstName") || "") || null : null,
      lastName: kind === "PERSON" ? String(data.get("lastName") || "") || null : null,
      companyName: kind === "COMPANY" ? String(data.get("companyName") || "") || null : null,
      phone: String(data.get("phone") || "") || null,
      email: String(data.get("email") || "") || null,
    };
    const payload = editing
      ? ({ ...details, version: editing.version } satisfies components["schemas"]["UpdateTenantRequest"])
      : details;
    try {
      const response = await fetch(editing ? `/api/bff/tenants/${editing.id}` : "/api/bff/tenants", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (response.status === 409) {
        setConflict(true);
        throw new Error("Kiracı başka bir işlemde değişti. Güncel kaydı yükleyin.");
      }
      if (!response.ok) throw new Error("Kiracı kaydedilemedi. Bilgileri kontrol edin.");
      setOpen(false);
      setEditing(null);
      await load(query, includeArchived);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kiracı kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function archive(tenant: Tenant) {
    if (!window.confirm(`“${displayName(tenant)}” arşivlensin mi?`)) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/tenants/${tenant.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ version: tenant.version }),
      });
      if (response.status === 409) {
        setConflict(true);
        throw new Error("Kiracı başka bir işlemde değişti. Güncel listeyi yükleyin.");
      }
      if (!response.ok) throw new Error("Kiracı arşivlenemedi.");
      await load(query, includeArchived);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kiracı arşivlenemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="tenants-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="tenants-title" className="text-2xl font-semibold tracking-tight">
            Kiracılar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Kiracı kayıtları</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setKind("PERSON");
            setOpen(!open);
            setError("");
          }}
        >
          {open ? "Formu kapat" : "Kiracı ekle"}
        </Button>
      </div>
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query, includeArchived);
        }}
      >
        <label className="sr-only" htmlFor="tenant-search">
          Kiracı ara
        </label>
        <input
          id="tenant-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={200}
          placeholder="Ad, şirket, telefon veya e-posta"
          className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 sm:max-w-md"
        />
        <Button type="submit" variant="outline">
          Ara
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              setIncludeArchived(event.target.checked);
              void load(query, event.target.checked);
            }}
          />
          Arşivlenenleri göster
        </label>
      </form>
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-card p-4 text-sm">
          <p role="alert">{error}</p>
          {conflict && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConflict(false);
                setOpen(false);
                setEditing(null);
                void load(query, includeArchived);
              }}
            >
              Listeyi yenile
            </Button>
          )}
        </div>
      )}
      {open && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Kiracı türü
                <select
                  name="kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as components["schemas"]["TenantKind"])}
                  className="h-11 rounded-md border bg-background px-3"
                >
                  <option value="PERSON">Kişi</option>
                  <option value="COMPANY">Şirket</option>
                </select>
              </label>
              <p className="self-end pb-3 text-xs text-muted-foreground">
                Türü değiştirmek için ilgili alanları doldurun; boş isteğe bağlı alanlar temizlenir.
              </p>
              <label className="grid gap-2 text-sm font-medium">
                Ad
                <input
                  name="firstName"
                  defaultValue={editing?.firstName ?? ""}
                  required={kind === "PERSON"}
                  maxLength={100}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Soyad
                <input
                  name="lastName"
                  defaultValue={editing?.lastName ?? ""}
                  required={kind === "PERSON"}
                  maxLength={100}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Şirket unvanı
                <input
                  name="companyName"
                  defaultValue={editing?.companyName ?? ""}
                  required={kind === "COMPANY"}
                  maxLength={200}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Telefon
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={editing?.phone ?? ""}
                  maxLength={32}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                E-posta
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={editing?.email ?? ""}
                  maxLength={256}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Kiracıyı kaydet"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                  }}
                >
                  Vazgeç
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <Card>
          <CardContent>
            <ListSkeleton label="Kiracılar yükleniyor…" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="font-medium">Kiracı kaydı bulunamadı</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Arama ölçütlerini değiştirebilir veya kiracı ekleyebilirsiniz.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((tenant) => (
            <Card key={tenant.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="font-semibold">{displayName(tenant)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[tenant.phone, tenant.email].filter(Boolean).join(" · ") ||
                      "İletişim bilgisi girilmemiş"}
                  </p>
                  {tenant.archivedAtUtc && (
                    <span className="mt-2 inline-block rounded border px-2 py-1 text-xs">Arşivlendi</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !!tenant.archivedAtUtc}
                    aria-label="Kiracıyı düzenle"
                    onClick={() => {
                      setEditing(tenant);
                      setKind(tenant.kind);
                      setOpen(true);
                      setError("");
                    }}
                  >
                    Düzenle
                  </Button>
                  {!tenant.archivedAtUtc && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      aria-label="Kiracıyı arşivle"
                      onClick={() => void archive(tenant)}
                    >
                      Arşivle
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {hasMore && <Button type="button" variant="outline" disabled={loading}
        onClick={() => void load(query, includeArchived, currentPage + 1)}>Diğer kiracıları yükle</Button>}
    </section>
  );
}
