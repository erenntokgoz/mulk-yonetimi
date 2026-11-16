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
import {
  loadOverviewExtras,
  monthName,
  overdueRows,
  upcomingRows,
  type ChargeRow,
  type OverviewExtras,
} from "@/lib/overview-data";
import styles from "@/components/overview.module.css";

type Summary = components["schemas"]["DashboardSummary"];
// Tutarlar tr-TR yerel biçimiyle gösterilir (binlik nokta, ondalık virgül); API ondalık metin de dönebilir.
const trMoney = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number | string) => `${trMoney.format(Number(v))} ₺`;
const lira = (v: number) => `${trMoney.format(v)} ₺`;
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

function WidgetState({ loading, error, empty, onRetry }: { loading: boolean; error: boolean; empty: string; onRetry: () => void }) {
  if (loading) return <ListSkeleton label="Yükleniyor…" />;
  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 p-2 text-sm">
        <p>Veriler alınamadı.</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Yeniden dene
        </Button>
      </div>
    );
  return <p className="p-2 text-sm text-muted-foreground">{empty}</p>;
}

function ChargeList({ rows, tone }: { rows: ChargeRow[]; tone: string }) {
  return (
    <ul className={styles.list}>
      {rows.map((item) => (
        <li key={item.id}>
          <span className={styles.unit}>{item.period}</span>
          <div>
            <b>{item.name}</b>
            <small>{item.text}</small>
          </div>
          <div className={styles.amt}>
            <b className="num">{lira(item.amount)}</b>
            <span className={`${styles.pill} ${item.tag === "Gecikti" && item.partial ? styles.partial : tone}`}>
              {item.tag === "Gecikti" && item.partial ? "Kısmi ödendi" : item.tag}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OverviewDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filled, setFilled] = useState(false);
  const [extras, setExtras] = useState<OverviewExtras | null>(null);
  const [extrasError, setExtrasError] = useState(false);
  const [extrasTry, setExtrasTry] = useState(0);
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
  const retryExtras = () => {
    setExtrasError(false);
    setExtrasTry((n) => n + 1);
  };
  const periodStart = data?.periodStart;
  useEffect(() => {
    if (!periodStart) return;
    let active = true;
    loadOverviewExtras(periodStart).then(
      (result) => active && setExtras(result),
      () => {
        if (!active) return;
        setExtras(null);
        setExtrasError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [periodStart, extrasTry]);
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
  const today = data?.asOf ?? "";
  const names = extras?.names ?? new Map<string, string>();
  const overdue = extras ? overdueRows(extras.charges, names, today) : null;
  const upcoming = extras ? upcomingRows(extras.charges, names, today) : null;
  const hasCash = extras?.cash.some((point) => point.income > 0 || point.expense > 0) ?? false;

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
                    <h2 id="month-title">{monthName(data.periodStart)} özeti</h2>
                    <p>Bu dönem alacağı</p>
                    <div className={styles.monthV}><b className="num">{money(data.periodCharges)}</b></div>
                    <p>Ödenmemiş bakiye: {money(data.periodUnpaid)}</p>
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
              {extras && hasCash ? (
                <CashFlowChart points={extras.cash} />
              ) : (
                <WidgetState loading={!extras && !extrasError} error={extrasError} onRetry={retryExtras} empty="Son 12 ayda tahsilat ya da gider kaydı yok." />
              )}
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
              <p className="text-sm text-muted-foreground">Liste, son 24 ay ve gelecek ay için alınan en fazla 500 kayda dayanır.</p>
              {overdue && overdue.rows.length ? <ChargeList rows={overdue.rows} tone={styles.late} /> : (
                <WidgetState loading={!extras && !extrasError} error={extrasError} onRetry={retryExtras} empty="Geciken kira yok." />
              )}
            </section>

            <section className={`bg-card ${styles.panel} ${styles.c5} rv`} style={delay(10)} aria-labelledby="soon-title">
              <div className={styles.ph}>
                <h2 id="soon-title">Yaklaşan vadeler</h2>
                <Link href="/kira-tahsilatlar">Tümü</Link>
              </div>
              <p className="text-sm text-muted-foreground">Liste, son 24 ay ve gelecek ay için alınan en fazla 500 kayda dayanır.</p>
              {upcoming && upcoming.rows.length ? <ChargeList rows={upcoming.rows} tone={styles.soon} /> : (
                <WidgetState loading={!extras && !extrasError} error={extrasError} onRetry={retryExtras} empty="Önümüzdeki 14 günde vadesi gelen kira yok." />
              )}
            </section>
          </div>
        )
      )}
    </section>
  );
}

