"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, CreditCard, FileText, FolderPlus, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/generated";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { SetupWizard } from "@/components/setup-wizard";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useSetupProgress } from "@/lib/setup-progress";
import { mockMonth, mockOverdue, mockUpcoming } from "@/lib/overview-mock";
import styles from "@/components/overview.module.css";

type Summary = components["schemas"]["DashboardSummary"];
// Tutarlar tr-TR yerel biçimiyle gösterilir (binlik nokta, ondalık virgül); API ondalık metin de dönebilir.
const trMoney = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number | string) => `${trMoney.format(Number(v))} ₺`;
const trInt = new Intl.NumberFormat("tr-TR");
const lira = (v: number) => `${trInt.format(v)} ₺`;
const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

const kpis = [
  { key: "periodCharges", label: "Dönem alacağı", tone: styles.tPri, icon: CalendarDays },
  { key: "periodUnpaid", label: "Ödenmemiş bakiye", tone: styles.tPar, icon: Clock },
  { key: "overdueBalance", label: "Gecikmiş bakiye", tone: styles.tLate, icon: TriangleAlert },
  { key: "recordedExpenses", label: "Kaydedilen gider", tone: styles.tExp, icon: Wallet },
] as const;

const quick = [
  { label: "Tahsilat kaydet", href: "/kira-tahsilatlar", color: "var(--paid)", icon: CreditCard },
  { label: "Gider ekle", href: "/giderler", color: "var(--expense)", icon: Wallet },
  { label: "Sözleşme aç", href: "/sozlesmeler", color: "var(--primary-soft)", icon: FileText },
  { label: "Belge yükle", href: "/belgeler", color: "var(--partial)", icon: FolderPlus },
] as const;

export function OverviewDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filled, setFilled] = useState(false);
  const progress = useSetupProgress();
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
  useEffect(() => {
    if (!data) return;
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, [data]);

  const setupDone = progress !== null && progress.every(Boolean);
  const total = Number(data?.totalUnits ?? 0);
  const occupied = Number(data?.occupiedUnits ?? 0);
  const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const circumference = 2 * Math.PI * 74;

  return (
    <section className="grid gap-4" aria-labelledby="overview-title">
      <h1 id="overview-title" className="sr-only">
        Genel bakış
      </h1>
      <SetupWizard />
      {error && (
        <div role="alert" className="bg-card flex flex-wrap items-center gap-3 p-4 text-sm">
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
          <div className={styles.grid}>
            {setupDone && (
              <section className={`bg-card ${styles.panel} ${styles.c12} rv`} style={delay(2)} aria-labelledby="month-title">
                <div className={styles.month}>
                  <div>
                    <h2 id="month-title">{mockMonth.title}</h2>
                    <div className={styles.monthV}>
                      <b className="num">{lira(mockMonth.paid)}</b>
                      <span className="num">/ {lira(mockMonth.total)}</span>
                    </div>
                    <div className={styles.stack} role="img" aria-label={`Ödenen ${lira(mockMonth.paid)}, kısmi ${lira(mockMonth.partial)}, geciken ${lira(mockMonth.late)}`}>
                      <i style={{ "--w": `${(mockMonth.paid / mockMonth.total) * 100}%`, background: "var(--paid)" } as React.CSSProperties} />
                      <i style={{ "--w": `${(mockMonth.partial / mockMonth.total) * 100}%`, background: "var(--partial)" } as React.CSSProperties} />
                      <i style={{ "--w": `${(mockMonth.late / mockMonth.total) * 100}%`, background: "var(--late)" } as React.CSSProperties} />
                    </div>
                    <div className={styles.keys}>
                      <span><i style={{ background: "var(--paid)" }} />Ödendi<b className="num">{lira(mockMonth.paid)}</b></span>
                      <span><i style={{ background: "var(--partial)" }} />Kısmi<b className="num">{lira(mockMonth.partial)}</b></span>
                      <span><i style={{ background: "var(--late)" }} />Gecikti<b className="num">{lira(mockMonth.late)}</b></span>
                    </div>
                  </div>
                  <div className={styles.qa}>
                    {quick.map(({ label, href, color, icon: Icon }) => (
                      <Link key={label} href={href} className={styles.q}>
                        <span className={styles.qi} style={{ "--c": color } as React.CSSProperties}>
                          <Icon aria-hidden="true" />
                        </span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {kpis.map(({ key, label, tone, icon: Icon }, index) => (
              <article key={key} className={`bg-card ${styles.kpi} ${tone} ${styles.c3} rv`} style={delay(3 + index)}>
                <i className={styles.glowDot} />
                <div className={styles.kpiLbl}>
                  <span className={styles.kpiIc}>
                    <Icon aria-hidden="true" />
                  </span>
                  {label}
                </div>
                <div className={`${styles.kpiV} num`}>{money(data[key] as number | string)}</div>
              </article>
            ))}

            <section className={`bg-card ${styles.panel} ${styles.c8} rv`} style={delay(7)} aria-labelledby="cf-title">
              <div className={styles.ph}>
                <h2 id="cf-title">Nakit akışı</h2>
                <div className={styles.legend}>
                  <span><i style={{ background: "var(--brand)" }} />Tahsilat</span>
                  <span><i style={{ background: "var(--expense)" }} />Gider</span>
                  <span><i style={{ background: "var(--paid)" }} />Net</span>
                </div>
              </div>
              <CashFlowChart />
              <div className={styles.cfNow}>
                <h3>Cari ay nakit akışı</h3>
                <p className="num">{money(data.cashFlow.netOperatingCashFlow)}</p>
              </div>
            </section>

            <section className={`bg-card ${styles.panel} ${styles.c4} rv`} style={delay(8)} aria-labelledby="occ-title">
              <div className={styles.ph}>
                <h2 id="occ-title">Doluluk</h2>
                <Link href="/portfoy">Portföy</Link>
              </div>
              <div className={styles.occ}>
                <div className={styles.donut}>
                  <svg viewBox="0 0 180 180" aria-hidden="true">
                    <circle className={styles.donutBg} cx="90" cy="90" r="74" />
                    <circle
                      className={styles.donutFg}
                      cx="90"
                      cy="90"
                      r="74"
                      strokeDasharray={circumference}
                      strokeDashoffset={filled ? circumference * (1 - percent / 100) : circumference}
                    />
                  </svg>
                  <div className={styles.donutC}>
                    <div>
                      <b className="num">%{percent}</b>
                      <small>dolu</small>
                    </div>
                  </div>
                </div>
                <dl className={styles.occRows}>
                  {[
                    ["Etkin mülk", data.activeProperties],
                    ["Bağımsız bölüm", data.totalUnits],
                    ["Dolu bölüm", data.occupiedUnits],
                    ["Boş bölüm", data.vacantUnits],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt>{label}</dt>
                      <dd className="num">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section className={`bg-card ${styles.panel} ${styles.c7} rv`} style={delay(9)} aria-labelledby="late-title">
              <div className={styles.ph}>
                <h2 id="late-title">Geciken kiralar</h2>
                <Link href="/kira-tahsilatlar">Tümü</Link>
              </div>
              <ul className={styles.list}>
                {mockOverdue.map((item) => (
                  <li key={item.unit}>
                    <span className={styles.unit}>{item.unit}</span>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.since}</small>
                    </div>
                    <div className={styles.amt}>
                      <b className="num">{lira(item.amount)}</b>
                      <span className={`${styles.pill} ${item.status === "late" ? styles.late : styles.partial}`}>
                        {item.status === "late" ? "Gecikti" : "Kısmi ödendi"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`bg-card ${styles.panel} ${styles.c5} rv`} style={delay(10)} aria-labelledby="soon-title">
              <div className={styles.ph}>
                <h2 id="soon-title">Yaklaşan vadeler</h2>
                <Link href="/kira-tahsilatlar">Tümü</Link>
              </div>
              <ul className={styles.list}>
                {mockUpcoming.map((item) => (
                  <li key={item.unit}>
                    <span className={styles.unit}>{item.unit}</span>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.due}</small>
                    </div>
                    <div className={styles.amt}>
                      <b className="num">{lira(item.amount)}</b>
                      <span className={`${styles.pill} ${styles.soon}`}>{item.inDays} gün</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )
      )}
    </section>
  );
}
