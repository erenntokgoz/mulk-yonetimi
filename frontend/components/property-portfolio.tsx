"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { Building2, LayoutGrid, List, MapPin, Plus, Search } from "lucide-react";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";
import { propertyCreateError, unitCreateError } from "@/lib/api/portfolio-errors";
import { CreateIntent } from "@/components/create-intent";
import { announceSetupStep, invalidateSetupProgress } from "@/lib/setup-progress";
import { toast } from "@/lib/toast";

type Property = components["schemas"]["PropertyResponse"];
type PropertyPage = components["schemas"]["PropertyPage"];
type Unit = components["schemas"]["UnitResponse"];
type UnitPage = components["schemas"]["UnitPage"];
const headers = { "Content-Type": "application/json" };

export function PropertyPortfolio() {
  const [items, setItems] = useState<Property[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [moreProperties, setMoreProperties] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [conflict, setConflict] = useState(false);
  const [unitProperty, setUnitProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitPage, setUnitPage] = useState(1);
  const [moreUnits, setMoreUnits] = useState(false);
  const [unitLoading, setUnitLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [kind, setKind] = useState<components["schemas"]["PropertyKind"]>("MULTI_UNIT");
  const [query, setQuery] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const unitsRef = useRef<HTMLDivElement>(null);
  const unitFormRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirmDialog();
  const needle = query.trim().toLocaleLowerCase("tr");
  const visible = needle
    ? items.filter((item) => `${item.name} ${item.address}`.toLocaleLowerCase("tr").includes(needle))
    : items;
  // Düzenleme formu ve birim paneli listenin üstünde açılır; aşağıdaki bir kayıttan açılınca görünür alana kaydırılır.
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, editing]);
  useEffect(() => {
    if (unitProperty) unitsRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [unitProperty]);
  // Dar ekranlarda tablo yerine kart düzeni kullanılır.
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (window.matchMedia("(max-width: 639px)").matches) setView("cards");
    });
  }, []);
  const load = useCallback(async (showArchived = includeArchived) => {
    setLoading(true);
    try {
      const archivedQuery = showArchived ? "&includeArchived=true" : "";
      const response = await fetch(`/api/bff/properties?page=1&pageSize=100${archivedQuery}`, { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 401 ? "Mülklerinizi görmek için giriş yapın." : "Mülk kayıtları alınamadı.",
        );
      const page = (await response.json()) as PropertyPage;
      setItems(page.items);
      setPropertyPage(1);
      setMoreProperties(page.hasMore);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mülk kayıtları alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);
  async function loadMoreProperties() {
    setLoading(true);
    try {
      const next = propertyPage + 1;
      const archivedQuery = includeArchived ? "&includeArchived=true" : "";
      const response = await fetch(`/api/bff/properties?page=${next}&pageSize=100${archivedQuery}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer mülkler alınamadı.");
      const result = (await response.json()) as PropertyPage;
      setItems((current) => [...current, ...result.items]);
      setPropertyPage(next);
      setMoreProperties(result.hasMore);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Diğer mülkler alınamadı.");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setConflict(false);
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("propertyKind"));
    const payload:
      components["schemas"]["CreatePropertyRequest"] | components["schemas"]["UpdatePropertyRequest"] =
      editing
        ? { name: String(data.get("name")), address: String(data.get("address")), version: editing.version }
        : {
            name: String(data.get("name")),
            address: String(data.get("address")),
            propertyKind: kind as components["schemas"]["PropertyKind"],
            defaultUnitUsageType:
              kind === "SINGLE_UNIT"
                ? (data.get("defaultUnitUsageType") as components["schemas"]["UnitUsageType"])
                : null,
          };
    try {
      const response = await fetch(editing ? `/api/bff/properties/${editing.id}` : "/api/bff/properties", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (response.status === 409 && await propertyCreateError(response) !== "Birim kotası doldu. Mevcut kayıtları görüntüleyebilirsiniz.") {
        setConflict(true);
      }
      if (!response.ok) throw new Error(await propertyCreateError(response));
      const wasEditing = !!editing;
      setOpen(false);
      setEditing(null);
      await load();
      if (wasEditing) toast.success("Mülk güncellendi.");
      else await announceSetupStep("Mülk eklendi.", "/portfoy");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mülk kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function showUnits(property: Property) {
    setUnitProperty(property);
    setUnitLoading(true);
    setError("");
    try {
      const archivedQuery = property.archivedAtUtc ? "&includeArchived=true" : "";
      const response = await fetch(`/api/bff/properties/${property.id}/units?page=1&pageSize=100${archivedQuery}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Birimler alınamadı.");
      const page = (await response.json()) as UnitPage;
      setUnits(page.items);
      setUnitPage(1);
      setMoreUnits(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Birimler alınamadı.");
    } finally {
      setUnitLoading(false);
    }
  }
  async function loadMoreUnits() {
    if (!unitProperty) return;
    setUnitLoading(true);
    try {
      const next = unitPage + 1;
      const archivedQuery = unitProperty.archivedAtUtc ? "&includeArchived=true" : "";
      const response = await fetch(`/api/bff/properties/${unitProperty.id}/units?page=${next}&pageSize=100${archivedQuery}`,
        { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer birimler alınamadı.");
      const result = (await response.json()) as UnitPage;
      setUnits((current) => [...current, ...result.items]);
      setUnitPage(next);
      setMoreUnits(result.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Diğer birimler alınamadı.");
    } finally { setUnitLoading(false); }
  }
  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unitProperty) return;
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch(`/api/bff/properties/${unitProperty.id}/units`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          label: String(data.get("unitLabel")),
          usageType: String(data.get("usageType")) as components["schemas"]["UnitUsageType"],
          doorNumber: String(data.get("doorNumber") || "") || null,
          areaM2: data.get("areaM2") ? Number(data.get("areaM2")) : null,
        }),
      });
      if (!response.ok) throw new Error(await unitCreateError(response));
      form.reset();
      await showUnits(unitProperty);
      await load();
      await announceSetupStep("Birim eklendi.", "/portfoy");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Birim kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }
  async function archiveUnit(unit: Unit) {
    if (!unitProperty) return;
    if ((await ask({ title: `“${unit.label}” birimi arşivlensin mi?`, description: "Arşivlenen birim yeni sözleşmede seçilemez; geçmiş kayıtları korunur.", confirmLabel: "Arşivle" })) === null) return;
    setPending(true);
    try {
      const response = await fetch(`/api/bff/properties/${unitProperty.id}/units/${unit.id}/archive`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(response.status === 409
        ? "Etkin sözleşmesi olan birim arşivlenemez."
        : "Birim arşivlenemedi.");
      await showUnits(unitProperty);
      toast.success("Birim arşivlendi.");
      void invalidateSetupProgress();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Birim arşivlenemedi.");
    } finally {
      setPending(false);
    }
  }
  async function archive(property: Property) {
    if ((await ask({ title: `“${property.name}” mülkü arşivlensin mi?`, description: "Arşivlenen mülk listeden kalkar; geçmiş kayıtları korunur.", confirmLabel: "Arşivle" })) === null) return;
    setPending(true);
    try {
      const response = await fetch(`/api/bff/properties/${property.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ version: property.version }),
      });
      if (response.status === 409) {
        toast.error("Mülk başka bir işlemde değişti. Güncel listeyi yükleyin.", {
          action: { label: "Listeyi yenile", onClick: () => void load() },
        });
        return;
      }
      if (!response.ok) throw new Error("Mülk arşivlenemedi.");
      await load();
      toast.success("Mülk arşivlendi.");
      void invalidateSetupProgress();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Mülk arşivlenemedi.");
    } finally {
      setPending(false);
    }
  }
  // Sihirbaz bağlantısı: "mulk" yeni mülk formunu, "bolum" birimi olmayan ilk etkin mülkün birim formunu açar.
  async function openFromIntent(value: string) {
    if (value === "mulk") {
      setEditing(null);
      setKind("MULTI_UNIT");
      setError("");
      setOpen(true);
      return () => formRef.current?.querySelector<HTMLElement>("input, select") ?? null;
    }
    if (value !== "bolum") return null;
    const candidates = items.filter((item) => !item.archivedAtUtc && item.propertyKind === "MULTI_UNIT");
    let target = candidates[0] ?? items.find((item) => !item.archivedAtUtc) ?? null;
    for (const property of candidates) {
      const response = await fetch(`/api/bff/properties/${property.id}/units?page=1&pageSize=1`, { cache: "no-store" });
      if (!response.ok) break;
      if (!((await response.json()) as UnitPage).items.length) {
        target = property;
        break;
      }
    }
    if (!target) return null;
    setOpen(false);
    await showUnits(target);
    return () => unitFormRef.current?.querySelector<HTMLElement>("input, select") ?? null;
  }
  return (
    <section className="grid gap-5" aria-labelledby="portfolio-title">
      <CreateIntent ready={!loading} onIntent={openFromIntent} />
      <div className="page-heading flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="portfolio-title" className="text-2xl font-semibold tracking-tight">
            Portföy
          </h1>
        </div>
        <Button
          type="button"
          onClick={() => {
            setOpen(!open);
            setEditing(null);
            setKind("MULTI_UNIT");
            setError("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {open ? "Formu kapat" : "Mülk ekle"}
        </Button>
      </div>
      <div className="portfolio-toolbar">
        <span className="portfolio-tab">Gösterilen mülkler {!loading && !error && <span>{visible.length}</span>}</span>
        <label className="portfolio-search relative">
          <span className="sr-only">Mülk ara</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad veya adres"
            className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
            className="h-4 w-4"
          />
          Arşivli mülkleri göster
        </label>
        <div className="view-switch" role="group" aria-label="Portföy görünümü">
          <button
            type="button"
            aria-label="Tablo görünümü"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <List size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Kart görünümü"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
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
                void load();
              }}
            >
              Listeyi yenile
            </Button>
          )}
        </div>
      )}
      {open && (
        <Card ref={formRef}>
          <CardContent className="pt-6">
            <form key={editing?.id ?? "new"} onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <h2 className="text-lg font-semibold sm:col-span-2">{editing ? `${editing.name} · düzenle` : "Yeni mülk"}</h2>
              <label className="grid gap-2 text-sm font-medium">
                Mülk adı
                <input
                  name="name"
                  defaultValue={editing?.name}
                  required
                  maxLength={200}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Adres
                <input
                  name="address"
                  defaultValue={editing?.address}
                  required
                  maxLength={500}
                  className="h-11 rounded-md border bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Mülk türü
                <select
                  disabled={!!editing}
                  name="propertyKind"
                  value={editing ? editing.propertyKind : kind}
                  onChange={(event) => setKind(event.target.value as components["schemas"]["PropertyKind"])}
                  className="h-11 rounded-md border bg-background px-3"
                >
                  <option value="MULTI_UNIT">Çok birimli</option>
                  <option value="SINGLE_UNIT">Tek birimli</option>
                </select>
              </label>
              {!editing && kind === "SINGLE_UNIT" && (
                <label className="grid gap-2 text-sm font-medium">
                  Kullanım türü
                  <select name="defaultUnitUsageType" className="h-11 rounded-md border bg-background px-3">
                    <option value="RESIDENTIAL">Konut</option>
                    <option value="COMMERCIAL">Ticari</option>
                  </select>
                </label>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Kaydet"}
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
      {unitProperty && (
        <Card ref={unitsRef}>
          <CardContent className="grid gap-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{unitProperty.name} · Birimler</h2>
              <Button type="button" variant="outline" onClick={() => setUnitProperty(null)}>
                Kapat
              </Button>
            </div>
            {unitLoading ? (
              <ListSkeleton label="Birimler yükleniyor…" />
            ) : units.length ? (
              <ul className="grid gap-2">
                {units.map((unit) => (
                  <li key={unit.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                    <span className="font-medium">{unit.label}</span>
                    <span className="ml-2 text-muted-foreground">
                      {unit.usageType === "RESIDENTIAL" ? "Konut" : "Ticari"}
                      {unit.doorNumber ? ` · Kapı ${unit.doorNumber}` : ""}
                      {unit.areaM2 ? ` · ${unit.areaM2} m²` : ""}
                    </span>
                    {unit.archivedAtUtc && <span className="ml-2 type-badge">Arşivlendi</span>}
                    {!unit.archivedAtUtc && !unitProperty.archivedAtUtc && <Button type="button" variant="outline" className="ml-auto" disabled={pending}
                      onClick={() => void archiveUnit(unit)}>
                      Arşivle
                    </Button>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Bu mülkte henüz birim yok.</p>
            )}
            {moreUnits && <Button type="button" variant="outline" disabled={unitLoading}
              onClick={() => void loadMoreUnits()}>Diğer birimleri yükle</Button>}
            {unitProperty.propertyKind === "MULTI_UNIT" && (
              <form ref={unitFormRef} onSubmit={createUnit} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                <h3 className="font-medium sm:col-span-2">Birim ekle</h3>
                <label className="grid gap-2 text-sm">
                  Birim etiketi
                  <input
                    name="unitLabel"
                    required
                    maxLength={100}
                    className="h-11 rounded-md border bg-background px-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Kullanım türü
                  <select name="usageType" className="h-11 rounded-md border bg-background px-3">
                    <option value="RESIDENTIAL">Konut</option>
                    <option value="COMMERCIAL">Ticari</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Kapı numarası
                  <input
                    name="doorNumber"
                    maxLength={32}
                    className="h-11 rounded-md border bg-background px-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Alan (m²)
                  <input
                    name="areaM2"
                    type="number"
                    min="0.01"
                    max="9999999.99"
                    step="0.01"
                    className="h-11 rounded-md border bg-background px-3"
                  />
                </label>
                <Button type="submit" disabled={pending} className="sm:col-span-2">
                  {pending ? "Kaydediliyor…" : "Birimi kaydet"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
      {loading ? (
        <Card>
          <CardContent>
            <ListSkeleton label="Mülkler yükleniyor…" />
          </CardContent>
        </Card>
      ) : error && !items.length ? null : visible.length === 0 ? (
        <Card>
          <CardContent className="portfolio-empty">
            <Building2 size={28} aria-hidden="true" />
            <h2 className="font-medium">{needle ? "Aramaya uyan mülk yok" : includeArchived ? "Arşivlenmiş mülk yok" : "Henüz mülk kaydı yok"}</h2>
          </CardContent>
        </Card>
      ) : (
        <div key={view} className="portfolio-view">
          {view === "table" ? (
            <div className="glass-table">
              <table aria-label="Mülk kayıtları">
                <thead>
                  <tr>
                    <th>Mülk</th>
                    <th>Adres</th>
                    <th>Tür</th>
                    <th>
                      <span className="sr-only">İşlemler</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((property) => (
                    <tr key={property.id}>
                      <td>
                        <span className="property-name">
                          <span className="property-icon">
                            <Building2 size={16} aria-hidden="true" />
                          </span>
                          <span>
                            <h2>{property.name}</h2>
                            {property.archivedAtUtc && <span className="type-badge">Arşivlendi</span>}
                            <span className="mobile-address">{property.address}</span>
                          </span>
                        </span>
                      </td>
                      <td className="address-cell">{property.address}</td>
                      <td>
                        <span className="type-badge">
                          {property.propertyKind === "SINGLE_UNIT" ? "Tek birimli" : "Çok birimli"}
                        </span>
                      </td>
                      <td>{actions(property)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="property-grid">
              {visible.map((property) => (
                <Card key={property.id}>
                  <CardContent className="property-tile">
                    <span className="property-icon">
                      <Building2 size={20} aria-hidden="true" />
                    </span>
                    <span className="type-badge">
                      {property.propertyKind === "SINGLE_UNIT" ? "Tek birimli" : "Çok birimli"}
                    </span>
                    <h2 className="font-semibold">{property.name}</h2>
                    {property.archivedAtUtc && <span className="type-badge">Arşivlendi</span>}
                    <p className="property-address">
                      <MapPin size={14} aria-hidden="true" />
                      {property.address}
                    </p>
                    {actions(property)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      {dialog}
      {moreProperties && <Button type="button" variant="outline" disabled={loading}
        onClick={() => void loadMoreProperties()}>Diğer mülkleri yükle</Button>}
    </section>
  );

  function actions(property: Property) {
    return (
      <div className="property-actions">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void showUnits(property)}>
          Birimler
        </Button>
        {!property.archivedAtUtc && <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-label="Mülkü düzenle"
            onClick={() => {
              setEditing(property);
              setKind(property.propertyKind);
              setOpen(true);
              setError("");
            }}
          >
            Düzenle
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-label="Mülkü arşivle"
            onClick={() => void archive(property)}
          >
            Arşivle
          </Button>
        </>}
      </div>
    );
  }
}
