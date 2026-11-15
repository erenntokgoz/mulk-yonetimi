"use client";

import { useEffect, useSyncExternalStore } from "react";

// Kurulum adımları gerçek kayıt sayılarından hesaplanır; sihirbaz, Kurulum düğmesi ve ay kartı aynı sonucu paylaşır.
export type SetupProgress = boolean[];
type Page = { items?: { status?: string }[] };

let current: SetupProgress | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(url);
  return (await response.json()) as T;
}

async function fetchProgress(): Promise<SetupProgress> {
  const [summary, tenants, leases, payments] = await Promise.all([
    getJson<{ activeProperties: number | string; totalUnits: number | string }>("/api/bff/dashboard/summary"),
    getJson<Page>("/api/bff/tenants?page=1&pageSize=1"),
    getJson<Page>("/api/bff/leases?status=ACTIVE&page=1&pageSize=1"),
    getJson<Page>("/api/bff/payments?page=1&pageSize=1"),
  ]);
  return [
    Number(summary.activeProperties) > 0,
    Number(summary.totalUnits) > 0,
    (tenants.items?.length ?? 0) > 0,
    (leases.items ?? []).some((lease) => lease.status === "ACTIVE"),
    (payments.items?.length ?? 0) > 0,
  ];
}

function publish(next: SetupProgress | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  // Oturum ya da API hatasını genel bakış kendi uyarısıyla gösterir; kurulum sessiz kalır.
  inflight ??= fetchProgress()
    .then(publish, () => publish(null))
    .finally(() => {
      inflight = null;
    });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useSetupProgress(): SetupProgress | null {
  useEffect(() => {
    refresh();
  }, []);
  return useSyncExternalStore(subscribe, () => current, () => null);
}
