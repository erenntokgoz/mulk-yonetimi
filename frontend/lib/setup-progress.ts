"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";

// Kurulum adımları gerçek kayıt sayılarından hesaplanır; sihirbaz, Kurulum düğmesi ve ay kartı aynı sonucu paylaşır.
export type SetupProgress = boolean[];
type Count = { count: number; more: boolean };
export type SetupFacts = {
  properties: number;
  units: number;
  tenants: Count | null;
  activeLeases: Count | null;
  payments: boolean;
};
type SetupState = { progress: SetupProgress; facts: SetupFacts };
type Page = { items?: { status?: string }[]; hasMore?: boolean };

export const setupSteps = [
  { title: "Mülk", action: "Mülk ekle", path: "/portfoy", href: "/portfoy?yeni=mulk" },
  { title: "Bölüm", action: "Daire ekle", path: "/portfoy", href: "/portfoy?yeni=bolum" },
  { title: "Kiracı", action: "Kiracı ekle", path: "/kiracilar", href: "/kiracilar?yeni=1" },
  { title: "Sözleşme", action: "Sözleşme aç", path: "/sozlesmeler", href: "/sozlesmeler?yeni=1" },
  { title: "İlk tahsilat", action: "Tahsilat kaydet", path: "/kira-tahsilatlar", href: "/kira-tahsilatlar?yeni=1" },
] as const;

let current: SetupState | null = null;
let inflight: Promise<SetupState | null> | null = null;
const listeners = new Set<() => void>();

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(url);
  return (await response.json()) as T;
}

const isActive = (lease: { status?: string }) => lease.status === "ACTIVE";
const countOf = (page: Page, filter?: (item: { status?: string }) => boolean): Count => ({
  count: (filter ? (page.items ?? []).filter(filter) : (page.items ?? [])).length,
  more: page.hasMore === true,
});

async function fetchState(): Promise<SetupState> {
  const [summary, tenants, leases, payments] = await Promise.all([
    getJson<{ activeProperties: number | string; totalUnits: number | string }>("/api/bff/dashboard/summary"),
    getJson<Page>("/api/bff/tenants?page=1&pageSize=1"),
    getJson<Page>("/api/bff/leases?status=ACTIVE&page=1&pageSize=1"),
    getJson<Page>("/api/bff/payments?page=1&pageSize=1"),
  ]);
  const progress = [
    Number(summary.activeProperties) > 0,
    Number(summary.totalUnits) > 0,
    (tenants.items?.length ?? 0) > 0,
    (leases.items ?? []).some(isActive),
    (payments.items?.length ?? 0) > 0,
  ];
  const facts: SetupFacts = {
    properties: Number(summary.activeProperties),
    units: Number(summary.totalUnits),
    tenants: null,
    activeLeases: null,
    payments: progress[4],
  };
  // API toplam sayı dönmez; özet için tamamlanan adımların ilk 100 kaydı sayılır, fazlası "100+" olur.
  // Kurulum bittiğinde sihirbaz görünmediği için bu ek istekler yapılmaz.
  if (!progress.every(Boolean)) {
    const [tenantPage, leasePage] = await Promise.all([
      progress[2] ? getJson<Page>("/api/bff/tenants?page=1&pageSize=100") : null,
      progress[3] ? getJson<Page>("/api/bff/leases?status=ACTIVE&page=1&pageSize=100") : null,
    ]);
    facts.tenants = tenantPage && countOf(tenantPage);
    facts.activeLeases = leasePage && countOf(leasePage, isActive);
  }
  return { progress, facts };
}

function publish(next: SetupState | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

function refresh(): Promise<SetupState | null> {
  // Oturum ya da API hatasını sayfalar kendi uyarısıyla gösterir; kurulum sessiz kalır.
  inflight ??= fetchState()
    .then(
      (state) => {
        publish(state);
        return state;
      },
      () => {
        publish(null);
        return null;
      },
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Kayıt ekleyen ya da arşivleyen her başarılı işlemden sonra çağrılır. Açık bir istek işlemden önce başlamış
// olabileceği için onu bekleyip yeniden sorar.
export async function invalidateSetupProgress(): Promise<SetupProgress | null> {
  if (inflight) await inflight;
  return (await refresh())?.progress ?? null;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function useSetupState(): SetupState | null {
  useEffect(() => {
    void refresh();
  }, []);
  return useSyncExternalStore(subscribe, () => current, () => null);
}

export function useSetupProgress(): SetupProgress | null {
  return useSetupState()?.progress ?? null;
}

export function useSetupFacts(): SetupFacts | null {
  return useSetupState()?.facts ?? null;
}

const countText = (value: Count, noun: string) => `${value.more ? `${value.count}+` : value.count} ${noun}`;

// Tamamlanan adımın kısa özeti. Sayı bilinmiyorsa uydurulmaz, yalnız tamamlandığı yazılır.
export function stepSummary(index: number, facts: SetupFacts | null): string {
  if (!facts) return "Tamamlandı";
  switch (index) {
    case 0:
      return `${facts.properties} mülk`;
    case 1:
      return `${facts.units} bölüm`;
    case 2:
      return facts.tenants ? countText(facts.tenants, "kiracı") : "Tamamlandı";
    case 3:
      return facts.activeLeases ? countText(facts.activeLeases, "etkin sözleşme") : "Tamamlandı";
    default:
      return facts.payments ? "İlk tahsilat kaydedildi" : "Tamamlandı";
  }
}

function wizardHidden() {
  try {
    return window.localStorage.getItem("mulk.setup-wizard") === "hidden";
  } catch {
    return false;
  }
}

// Kurulumu etkileyen bir kayıttan sonra başarı mesajını gösterir. Kurulum sürüyorsa mesaj sonraki adıma bağlanır.
// Son adım bu işlemle bittiyse yalnız "Kurulum tamamlandı." gösterilir. Sihirbazı gizleyen kullanıcıya yönlendirme yapılmaz.
export async function announceSetupStep(message: string, pathname: string) {
  const before = current?.progress ?? null;
  const after = await invalidateSetupProgress();
  if (after?.every(Boolean) && before && !before.every(Boolean)) {
    toast.success("Kurulum tamamlandı.");
    return;
  }
  if (!after || after.every(Boolean) || wizardHidden()) {
    toast.success(message);
    return;
  }
  const next = setupSteps[after.findIndex((done) => !done)];
  toast.success(message, {
    action:
      next.path === pathname ? { label: "Kuruluma dön", href: "/panel" } : { label: "Sonraki adım", href: next.href },
  });
}

// Bileşen testleri arasında modül durumunu temizler.
export function resetSetupProgress() {
  inflight = null;
  publish(null);
}
