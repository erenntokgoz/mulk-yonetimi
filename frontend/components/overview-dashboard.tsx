"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { SetupWizard } from "@/components/setup-wizard";
import { ListSkeleton } from "@/components/ui/skeleton";
type Summary = components["schemas"]["DashboardSummary"];
// Tutarlar tr-TR yerel biçimiyle gösterilir (binlik nokta, ondalık virgül); API ondalık metin de dönebilir.
const trMoney = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number | string) => `${trMoney.format(Number(v))} ₺`;
export function OverviewDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/bff/dashboard/summary", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          r.status === 401 ? "Genel bakışı görmek için giriş yapın." : "Portföy ve finans özeti alınamadı.",
        );
      setData((await r.json()) as Summary);
      setError("");
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Özet alınamadı.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  return (
    <section className="grid gap-5" aria-labelledby="overview-title">
      <div>
        <h1 id="overview-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Genel bakış
        </h1>
      </div>
      <SetupWizard />
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
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
            Yeniden dene
          </Button>
        </div>
      )}
      {loading ? (
        <ListSkeleton label="Özet yükleniyor…" />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Etkin mülk", data.activeProperties],
                ["Bağımsız bölüm", data.totalUnits],
                ["Dolu bölüm", data.occupiedUnits],
                ["Boş bölüm", data.vacantUnits],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="grid gap-4 p-5">
                <h2 className="text-lg font-semibold">Cari ay · {data.periodStart}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Dönem alacağı", data.periodCharges],
                    ["Ödenmemiş bakiye", data.periodUnpaid],
                    ["Gecikmiş bakiye", data.overdueBalance],
                    ["Kaydedilen gider", data.recordedExpenses],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold">{money(value as number | string)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-3 p-5">
                <h2 className="text-lg font-semibold">Cari ay nakit akışı</h2>
                <p className="text-2xl font-semibold">{money(data.cashFlow.netOperatingCashFlow)}</p>
              </CardContent>
            </Card>
          </>
        )
      )}
    </section>
  );
}
