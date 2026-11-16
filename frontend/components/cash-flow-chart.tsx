"use client";

import { useEffect, useRef, useState } from "react";
import type { CashPoint } from "@/lib/overview-data";
import styles from "@/components/overview.module.css";

const trNumber = new Intl.NumberFormat("tr-TR");
const L = 44, B = 26, T = 8, H = 260;

// Ölçek verinin en büyük değerine göre yuvarlanır; 4 eşit aralık okunur kalsın.
function niceCeil(value: number) {
  if (value <= 0) return 1000;
  const raw = value / 4;
  const unit = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * unit >= raw) ?? 10;
  return step * unit * 4;
}

function axisLabel(value: number) {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trNumber.format(value / 1_000_000)}M`;
  if (abs >= 1000) return `${trNumber.format(value / 1000)}b`;
  return trNumber.format(value);
}

// 12 aylık tahsilat, gider ve net çizgisi; ölçek sabit olduğu için aylar arası karşılaştırma bozulmaz.
export function CashFlowChart({ points }: { points: CashPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const months = points.map((point) => point.label);
  const income = points.map((point) => point.income);
  const expense = points.map((point) => point.expense);
  const count = points.length;
  const hi = niceCeil(Math.max(0, ...income, ...expense));
  const lo = Math.min(0, ...points.map((point) => point.income - point.expense));
  const W = width;
  const cw = (W - L) / count;
  const bw = Math.min(16, cw * 0.26);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const cx = (i: number) => L + cw * i + cw / 2;

  let path = "";
  months.forEach((_, i) => {
    const point = [cx(i), y(income[i] - expense[i])];
    if (i === 0) path = `M${point[0]},${point[1]}`;
    else {
      const prev = [cx(i - 1), y(income[i - 1] - expense[i - 1])];
      const mx = (prev[0] + point[0]) / 2;
      path += ` C${mx},${prev[1]} ${mx},${point[1]} ${point[0]},${point[1]}`;
    }
  });

  return (
    <div ref={ref} className={styles.chart}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Son 12 ayın tahsilat, gider ve net tutarı">
          <defs>
            <linearGradient id="gCur" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary-soft)" />
              <stop offset="1" stopColor="var(--brand)" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((g) => {
            const v = lo + ((hi - lo) * g) / 4;
            return (
              <g key={g}>
                <line className={styles["grid-l"]} x1={L} x2={W} y1={y(v)} y2={y(v)} />
                <text className={styles.ax} x={L - 8} y={y(v) + 4} textAnchor="end">
                  {axisLabel(v)}
                </text>
              </g>
            );
          })}
          <g className={styles.bars}>
            {months.map((m, i) => (
              <g key={m}>
                <rect className={i === count - 1 ? styles.barCur : styles.barIn} x={cx(i) - bw - 2} y={y(Math.max(income[i], 0))} width={bw} height={Math.abs(y(0) - y(income[i]))} rx={5} style={{ "--d": i } as React.CSSProperties} />
                <rect className={styles.barOut} x={cx(i) + 2} y={y(Math.max(expense[i], 0))} width={bw} height={Math.abs(y(0) - y(expense[i]))} rx={5} style={{ "--d": i } as React.CSSProperties} />
                <text className={styles.ax} x={cx(i)} y={H - 6} textAnchor="middle">
                  {m}
                </text>
              </g>
            ))}
          </g>
          <path className={`${styles.net} ${styles.netLine}`} d={path} pathLength={1} strokeDasharray={1} />
          {months.map((m, i) => (
            <rect
              key={m}
              x={L + cw * i}
              y={0}
              width={cw}
              height={H - B}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      <div
        className={`${styles.tipc} ${hover !== null ? styles.tipOn : ""}`}
        aria-hidden="true"
        style={hover !== null ? { left: Math.min(Math.max(cx(hover), 90), W - 90), top: y(income[hover]) } : undefined}
      >
        {hover !== null && (
          <>
            <b>{months[hover]}</b>
            <span>
              Tahsilat <em>{trNumber.format(income[hover])} ₺</em>
            </span>
            <span>
              Gider <em>{trNumber.format(expense[hover])} ₺</em>
            </span>
            <span>
              Net <em>{trNumber.format(income[hover] - expense[hover])} ₺</em>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
