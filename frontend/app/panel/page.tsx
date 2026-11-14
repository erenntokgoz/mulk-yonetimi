import { DashboardShell } from "@/components/dashboard-shell";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { getBackendHealth, type HealthResult, type HealthStatus } from "@/lib/api/health";

export const dynamic = "force-dynamic";

const statusLabels: Record<HealthStatus, string> = {
  Healthy: "Çalışıyor",
  Degraded: "Kısıtlı çalışıyor",
  Unhealthy: "Hizmet kullanılamıyor",
};

const checkLabels: Record<string, string> = {
  sqlserver: "Veritabanı",
  outbox: "E-posta kuyruğu",
};

export default async function PanelPage() {
  return <DashboardShell><OverviewDashboard /><SystemHealth /></DashboardShell>;
}

async function SystemHealth() {
  let result: HealthResult | null = null;
  try {
    result = await getBackendHealth();
  } catch {
    // Configuration details stay on the server.
  }
  const report = result?.kind === "available" ? result.health : null;
  const status = report ? statusLabels[report.status] : "Bağlantı kurulamadı";
  const detail = !result
    ? "Hizmet bağlantısı yapılandırılmamış. Sistem yöneticisiyle iletişime geçin."
    : result.kind === "unavailable"
      ? "Hizmet durumu alınamadı. Bir süre sonra sayfayı yenileyerek tekrar deneyin."
      : null;

  return (
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Sistem sağlığı">
        <section aria-label="Sistem durumu" className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Sistem durumu</h2>
          <div role="status" className="mt-2 flex items-center gap-3 text-sm font-medium"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${report?.status === "Healthy" ? "bg-emerald-400" : "bg-amber-400"}`} />{status}</div>
          {detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>}
          <form action="/panel" method="get" className="mt-3"><button type="submit" className="text-xs underline">Durumu yenile</button></form>
        </section>
        <section aria-label="Hizmet kontrolleri" className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Hizmet kontrolleri</h2>
          <div className="mt-2">
              {report ? report.checks.length ? <dl className="divide-y divide-border text-sm">{report.checks.map((check, index) => <div key={`${check.name}-${index}`} className="grid gap-1 py-4"><div className="flex items-center justify-between gap-4"><dt>{checkLabels[check.name] ?? "Diğer hizmet"}</dt><dd className="font-medium">{statusLabels[check.status]}</dd></div><p className="text-xs text-muted-foreground">Yanıt süresi: {Math.round(check.durationMs)} ms</p>{check.description && <p className="text-xs text-muted-foreground">{check.description}</p>}</div>)}</dl> : <p className="text-sm text-muted-foreground">İzlenecek hizmet yok.</p> : <p className="text-sm text-muted-foreground">Hizmet bilgisi alınamadı.</p>}
          </div>
        </section>
      </section>
  );
}
