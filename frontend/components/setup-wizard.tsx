"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setWizardPreference,
  useWizardPreference,
} from "@/lib/setup-wizard-state";

const steps = [
  {
    title: "Mülk ekle",
    detail: "Portföyündeki ilk mülkü kaydet.",
    action: "Mülk ekle",
    href: "/portfoy",
  },
  {
    title: "Bağımsız bölüm ekle",
    detail: "Mülke bağlı bir daire ya da dükkân tanımla.",
    action: "Bölüm ekle",
    href: "/portfoy",
  },
  {
    title: "Kiracı ekle",
    detail: "Kiracının kişi ya da şirket bilgilerini gir.",
    action: "Kiracı ekle",
    href: "/kiracilar",
  },
  {
    title: "Sözleşme oluştur ve etkinleştir",
    detail: "Bölümü ve kiracıyı seçip sözleşmeyi başlat.",
    action: "Sözleşme oluştur",
    href: "/sozlesmeler",
  },
  {
    title: "İlk tahsilatı kaydet",
    detail: "Gelen ilk kira ödemesini gir.",
    action: "Tahsilat ekle",
    href: "/kira-tahsilatlar",
  },
] as const;

type Progress = boolean[];
type Page = { items?: { status?: string }[] };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(url);
  return (await response.json()) as T;
}

async function loadProgress(): Promise<Progress> {
  const [summary, tenants, leases, payments] = await Promise.all([
    getJson<{ activeProperties: number | string; totalUnits: number | string }>(
      "/api/bff/dashboard/summary",
    ),
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

export function SetupWizard() {
  const preference = useWizardPreference();
  const [progress, setProgress] = useState<Progress | null>(null);

  const load = useCallback(async () => {
    try {
      setProgress(await loadProgress());
    } catch {
      // Oturum ya da API hatasını genel bakış kendi uyarısıyla gösterir; sihirbaz sessiz kalır.
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (preference === "hidden") return null;
  if (progress === null) return null;
  const complete = progress.every(Boolean);
  // Hesap kurulmuşsa sihirbaz kendiliğinden açılmaz; yalnız Kurulum düğmesiyle görünür.
  if (complete && preference !== "shown") return null;

  const current = progress.findIndex((done) => !done);
  const doneCount = progress.filter(Boolean).length;

  return (
    <section
      aria-labelledby="setup-wizard-title"
      className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setup-wizard-title" className="text-lg font-semibold">
          Kurulum
          <span className="ml-2 text-sm font-normal tabular-nums">
            {doneCount} / {steps.length}
          </span>
        </h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setWizardPreference("hidden")}
        >
          Sihirbazı gizle
        </Button>
      </div>
      {
        <ol className="grid gap-3">
          {steps.map((step, index) => {
            const done = progress[index];
            const isCurrent = index === current;
            return (
              <li
                key={step.title}
                aria-current={isCurrent ? "step" : undefined}
                className={`grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center ${isCurrent ? "border-primary" : ""}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${done ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {done ? <Check size={14} /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="text-sm">{step.detail}</p>
                    <span className="mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs">
                      {done
                        ? "Tamamlandı"
                        : isCurrent
                          ? "Sıradaki"
                          : "Bekliyor"}
                    </span>
                  </div>
                </div>
                {isCurrent && (
                  <Link
                    href={step.href}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-foreground bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {step.action}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      }
    </section>
  );
}
