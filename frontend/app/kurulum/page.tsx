import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { serverGet } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Mülk", action: "Mülk ekle", href: "/portfoy", detail: "Mülkün adını ve adresini kaydedin." },
  { title: "Birim", action: "Birim ekle", href: "/portfoy", detail: "Mülk kartındaki Birimler bölümünden bağımsız bölüm ekleyin." },
  { title: "Kiracı", action: "Kiracı ekle", href: "/kiracilar", detail: "Kiracının kişi veya şirket bilgilerini kaydedin." },
  { title: "Sözleşme", action: "Sözleşme oluştur", href: "/sozlesmeler", detail: "Birimi ve kiracıyı seçip sözleşme taslağını kaydedin." },
] as const;

export default async function SetupPage() {
  let completed: boolean[] | null = null;
  try {
    const [summary, tenants, leases] = await Promise.all([
      serverGet("/api/v1/dashboard/summary"),
      serverGet("/api/v1/tenants", { page: 1, pageSize: 1 }),
      serverGet("/api/v1/leases", { page: 1, pageSize: 1 }),
    ]);
    completed = [Number(summary.activeProperties) > 0, Number(summary.totalUnits) > 0,
      tenants.items.length > 0, leases.items.length > 0];
  } catch {
    // API error details stay on the server; no step is guessed.
  }
  const next = completed?.findIndex((done) => !done) ?? -1;
  return (
    <DashboardShell title="İlk kurulum">
      <section className="grid gap-5" aria-labelledby="setup-title">
        <div>
          <h1 id="setup-title" className="text-2xl font-semibold">İlk kurulum</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mülk, birim, kiracı ve sözleşme kayıtlarını sırayla oluşturun.</p>
        </div>
        {completed === null ? (
          <div role="alert" className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
            Kurulum durumu alınamadı. Oturumu ve bağlantıyı kontrol edip sayfayı yenileyin.
          </div>
        ) : (
          <>
            <ol className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-lg border bg-card p-5">
                  <p className="text-xs text-muted-foreground">{index + 1}. adım · {completed[index]
                    ? "Tamamlandı" : index === next ? "Sıradaki adım" : "Bekliyor"}</p>
                  <h2 className="mt-2 font-semibold">{step.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                  {index === next && <Link href={step.href} className="mt-3 inline-flex min-h-11 items-center rounded-md border px-4 text-sm underline">
                    {step.action}
                  </Link>}
                </li>
              ))}
            </ol>
            {next === -1 && <p role="status" className="rounded-lg border bg-card p-4 text-sm">
              Temel kayıtlar mevcut. <Link href="/panel" className="underline">Genel bakışa dön</Link>
            </p>}
          </>
        )}
      </section>
    </DashboardShell>
  );
}
