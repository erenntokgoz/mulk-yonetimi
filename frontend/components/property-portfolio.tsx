"use client";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { Building2, LayoutGrid, List, MapPin, Plus } from "lucide-react";

type Property = components["schemas"]["PropertyResponse"];
type PropertyPage = components["schemas"]["PropertyPage"];
type Unit = components["schemas"]["UnitResponse"];
type UnitPage = components["schemas"]["UnitPage"];
const headers = { "Content-Type": "application/json" };

export function PropertyPortfolio() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [conflict, setConflict] = useState(false);
  const [unitProperty, setUnitProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitLoading, setUnitLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/bff/properties?page=1&pageSize=100", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Mülklerinizi görmek için giriş yapın." : "Mülk kayıtları alınamadı.");
      const page = await response.json() as PropertyPage;
      setItems(page.items); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mülk kayıtları alınamadı."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setConflict(false);
    const data = new FormData(event.currentTarget); const kind = String(data.get("propertyKind"));
    const payload: components["schemas"]["CreatePropertyRequest"] | components["schemas"]["UpdatePropertyRequest"] = editing
      ? { name: String(data.get("name")), address: String(data.get("address")), version: editing.version }
      : { name: String(data.get("name")), address: String(data.get("address")), propertyKind: kind as components["schemas"]["PropertyKind"], defaultUnitUsageType: kind === "SINGLE_UNIT" ? data.get("defaultUnitUsageType") as components["schemas"]["UnitUsageType"] : null };
    try {
      const response = await fetch(editing ? `/api/bff/properties/${editing.id}` : "/api/bff/properties", { method: editing ? "PATCH" : "POST", headers, body: JSON.stringify(payload) });
      if (response.status === 409) { setConflict(true); throw new Error("Mülk başka bir işlemde değişti. Güncel sürümü yükleyip tekrar deneyin."); }
      if (!response.ok) throw new Error("Mülk kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.");
      setOpen(false); setEditing(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mülk kaydedilemedi."); }
    finally { setPending(false); }
  }
  async function showUnits(property: Property) {
    setUnitProperty(property); setUnitLoading(true); setError("");
    try {
      const response = await fetch(`/api/bff/properties/${property.id}/units?page=1&pageSize=100`, { cache: "no-store" });
      if (!response.ok) throw new Error("Birimler alınamadı.");
      const page = await response.json() as UnitPage; setUnits(page.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Birimler alınamadı."); }
    finally { setUnitLoading(false); }
  }
  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!unitProperty) return;
    setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/bff/properties/${unitProperty.id}/units`, { method: "POST", headers, body: JSON.stringify({
        label: String(data.get("unitLabel")), usageType: String(data.get("usageType")) as components["schemas"]["UnitUsageType"], doorNumber: String(data.get("doorNumber") || "") || null,
        areaM2: data.get("areaM2") ? Number(data.get("areaM2")) : null,
      }) });
      if (!response.ok) throw new Error(response.status === 409 ? "Bu mülke birim eklenemedi." : "Birim kaydedilemedi. Bilgileri kontrol edin.");
      await showUnits(unitProperty); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Birim kaydedilemedi."); }
    finally { setPending(false); }
  }
  async function archive(property: Property) {
    if (!window.confirm(`“${property.name}” mülkü arşivlensin mi?`)) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/bff/properties/${property.id}`, { method: "POST", headers, body: JSON.stringify({ version: property.version }) });
      if (response.status === 409) { setConflict(true); throw new Error("Mülk başka bir işlemde değişti. Güncel listeyi yükleyin."); }
      if (!response.ok) throw new Error("Mülk arşivlenemedi.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mülk arşivlenemedi."); }
    finally { setPending(false); }
  }
  return <section className="grid gap-5" aria-labelledby="portfolio-title">
    <div className="page-heading flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">MÜLK YÖNETİMİ</p><h1 id="portfolio-title" className="text-2xl font-semibold tracking-tight">Portföy</h1><p className="mt-1 text-sm text-muted-foreground">Mülk kayıtları ve bağımsız bölümler</p></div><Button type="button" onClick={() => { setOpen(!open); setEditing(null); setError(""); }}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />{open ? "Formu kapat" : "Mülk ekle"}</Button></div>
    <div className="portfolio-toolbar"><span className="portfolio-tab">Tüm mülkler {!loading && !error && <span>{items.length}</span>}</span><div className="view-switch" role="group" aria-label="Portföy görünümü"><button type="button" aria-label="Tablo görünümü" aria-pressed={view === "table"} onClick={() => setView("table")}><List size={16} aria-hidden="true" /></button><button type="button" aria-label="Kart görünümü" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid size={16} aria-hidden="true" /></button></div></div>
    {error && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-card p-4 text-sm"><p role="alert">{error}</p>{conflict && <Button type="button" variant="outline" onClick={() => { setConflict(false); setOpen(false); setEditing(null); void load(); }}>Listeyi yenile</Button>}</div>}
    {open && <Card><CardContent className="pt-6"><form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium">Mülk adı<input name="name" defaultValue={editing?.name} required maxLength={200} className="h-11 rounded-md border bg-background px-3" /></label>
      <label className="grid gap-2 text-sm font-medium">Adres<input name="address" defaultValue={editing?.address} required maxLength={500} className="h-11 rounded-md border bg-background px-3" /></label>
      <label className="grid gap-2 text-sm font-medium">Mülk türü<select disabled={!!editing} name="propertyKind" className="h-11 rounded-md border bg-background px-3"><option value="MULTI_UNIT">Çok birimli</option><option value="SINGLE_UNIT">Tek birimli</option></select></label>
      <label className="grid gap-2 text-sm font-medium">Varsayılan birim kullanım türü<select name="defaultUnitUsageType" className="h-11 rounded-md border bg-background px-3"><option value="RESIDENTIAL">Konut</option><option value="COMMERCIAL">Ticari</option></select><span className="text-xs font-normal text-muted-foreground">Yalnız tek birimli mülklerde kullanılır.</span></label>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Kaydet"}</Button><Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Vazgeç</Button></div>
    </form></CardContent></Card>}
    {unitProperty && <Card><CardContent className="grid gap-5 p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{unitProperty.name} · Birimler</h2><Button type="button" variant="outline" onClick={() => setUnitProperty(null)}>Kapat</Button></div>
      {unitLoading ? <p role="status" className="text-sm text-muted-foreground">Birimler yükleniyor…</p> : units.length ? <ul className="grid gap-2">{units.map((unit) => <li key={unit.id} className="rounded-md border p-3 text-sm"><span className="font-medium">{unit.label}</span><span className="ml-2 text-muted-foreground">{unit.usageType === "RESIDENTIAL" ? "Konut" : "Ticari"}{unit.doorNumber ? ` · Kapı ${unit.doorNumber}` : ""}{unit.areaM2 ? ` · ${unit.areaM2} m²` : ""}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Bu mülkte henüz birim yok.</p>}
      {unitProperty.propertyKind === "MULTI_UNIT" && <form onSubmit={createUnit} className="grid gap-3 border-t pt-4 sm:grid-cols-2"><h3 className="font-medium sm:col-span-2">Birim ekle</h3><label className="grid gap-2 text-sm">Birim etiketi<input name="unitLabel" required maxLength={100} className="h-11 rounded-md border bg-background px-3" /></label><label className="grid gap-2 text-sm">Kullanım türü<select name="usageType" className="h-11 rounded-md border bg-background px-3"><option value="RESIDENTIAL">Konut</option><option value="COMMERCIAL">Ticari</option></select></label><label className="grid gap-2 text-sm">Kapı numarası<input name="doorNumber" maxLength={32} className="h-11 rounded-md border bg-background px-3" /></label><label className="grid gap-2 text-sm">Alan (m²)<input name="areaM2" type="number" min="0.01" max="9999999.99" step="0.01" className="h-11 rounded-md border bg-background px-3" /></label><Button type="submit" disabled={pending} className="sm:col-span-2">{pending ? "Kaydediliyor…" : "Birimi kaydet"}</Button></form>}
    </CardContent></Card>}
    {loading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground" role="status">Mülkler yükleniyor…</CardContent></Card>
      : error && !items.length ? null : items.length === 0 ? <Card><CardContent className="portfolio-empty"><Building2 size={28} aria-hidden="true" /><h2 className="font-medium">Henüz mülk kaydı yok</h2><p className="mt-2 text-sm text-muted-foreground">Portföyünüze eklemek için “Mülk ekle” seçeneğini kullanın.</p></CardContent></Card>
        : <div key={view} className="portfolio-view">
          {view === "table" ? <div className="glass-table"><table aria-label="Mülk kayıtları"><thead><tr><th>Mülk</th><th>Adres</th><th>Tür</th><th><span className="sr-only">İşlemler</span></th></tr></thead><tbody>{items.map(property => <tr key={property.id}><td><span className="property-name"><span className="property-icon"><Building2 size={16} aria-hidden="true" /></span><span><h2>{property.name}</h2><span className="mobile-address">{property.address}</span></span></span></td><td className="address-cell">{property.address}</td><td><span className="type-badge">{property.propertyKind === "SINGLE_UNIT" ? "Tek birimli" : "Çok birimli"}</span></td><td>{actions(property)}</td></tr>)}</tbody></table></div>
          : <div className="property-grid">{items.map(property => <Card key={property.id}><CardContent className="property-tile"><span className="property-icon"><Building2 size={20} aria-hidden="true" /></span><span className="type-badge">{property.propertyKind === "SINGLE_UNIT" ? "Tek birimli" : "Çok birimli"}</span><h2 className="font-semibold">{property.name}</h2><p className="property-address"><MapPin size={14} aria-hidden="true" />{property.address}</p>{actions(property)}</CardContent></Card>)}</div>}
        </div>}
  </section>;

  function actions(property: Property) {
    return <div className="property-actions"><Button type="button" variant="outline" disabled={pending} onClick={() => void showUnits(property)}>Birimler</Button><Button type="button" variant="outline" disabled={pending} aria-label="Mülkü düzenle" onClick={() => { setEditing(property); setOpen(true); setError(""); }}>Düzenle</Button><Button type="button" variant="outline" disabled={pending} aria-label="Mülkü arşivle" onClick={() => void archive(property)}>Arşivle</Button></div>;
  }
}
