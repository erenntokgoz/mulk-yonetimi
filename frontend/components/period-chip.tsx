"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const label = () => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date());

// Dönem adı tarayıcı saatinden gelir; sunucu çıktısıyla uyuşmazlık olmasın diye ilk boyamada boş kalır.
export function PeriodChip() {
  const text = useSyncExternalStore(subscribe, label, () => "");
  if (!text) return null;
  return <span className="period-chip">{text}</span>;
}
