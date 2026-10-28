import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackendHealth, type HealthResult, type HealthStatus } from "@/lib/api/health";

export const dynamic = "force-dynamic";

const statusLabels: Record<HealthStatus, string> = {
  Healthy: "Çalışıyor",
  Degraded: "Kısıtlı çalışıyor",
  Unhealthy: "Hizmet kullanılamıyor",
};

export default async function Home() {
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
    <DashboardShell>
      <h1 className="text-2xl font-semibold tracking-tight">Genel bakış</h1>
      <Card className="w-full max-w-3xl">
        <CardHeader><CardTitle>Sistem durumu</CardTitle><CardDescription>Uygulama hizmeti ve veritabanı bağlantısı</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div role="status" className="flex items-center gap-2 text-lg font-medium"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${report?.status === "Healthy" ? "bg-green-700" : "bg-amber-700"}`} />{status}</div>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          {report && <dl className="border-t text-sm">{report.checks.map((check, index) => <div key={`${check.name}-${index}`} className="flex justify-between gap-4 border-b py-3"><dt>{check.name === "sqlserver" ? "SQL Server" : "Bağlı hizmet"}</dt><dd className="font-medium">{statusLabels[check.status]}</dd></div>)}</dl>}
        </CardContent>
        <CardFooter className="border-t pt-5"><form action="/" method="get"><Button type="submit" variant="outline">Durumu yenile</Button></form></CardFooter>
      </Card>
    </DashboardShell>
  );
}
