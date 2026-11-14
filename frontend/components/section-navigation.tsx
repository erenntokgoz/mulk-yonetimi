"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Building2, FileText, FolderOpen, House, Receipt, Search, Settings, Shield, Users, Wallet } from "lucide-react";
import { sections } from "@/lib/navigation";

const icons = {
  "/": House, "/portfoy": Building2, "/kiracilar": Users, "/sozlesmeler": FileText,
  "/kira-tahsilatlar": Wallet, "/depozitolar": Shield, "/giderler": Receipt,
  "/belgeler": FolderOpen, "/raporlar": BarChart3, "/bildirimler": Bell, "/ayarlar": Settings,
} as const;

export function SectionNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const filtered = sections.filter((section) => section.title.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));
    return Array.from(new Set(filtered.map((section) => section.group))).map((group) => ({ group, items: filtered.filter((section) => section.group === group) }));
  }, [query]);

  return (
    <nav aria-label="Ana gezinme" className="reference-nav grid gap-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" aria-label="Menüde ara" placeholder="Menüde ara" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      {groups.map(({ group, items }) => (
        <section key={group} aria-label={group} className="grid gap-1">
          <h2 className="px-3 pb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{group}</h2>
          {items.map((section) => {
            const Icon = icons[section.path];
            const active = pathname === section.path;
            return <Link key={section.path} href={section.path} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgb(37_99_235/28%)]" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{section.title}</Link>;
          })}
        </section>
      ))}
      {!groups.length && <p role="status" className="px-3 text-sm text-muted-foreground">Eşleşen bölüm yok.</p>}
    </nav>
  );
}
