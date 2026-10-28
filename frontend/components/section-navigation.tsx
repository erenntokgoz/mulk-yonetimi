"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Building2, FileText, FolderOpen, House, Receipt, Settings, Shield, Users, Wallet } from "lucide-react";
import { sections } from "@/lib/navigation";

const icons = [House, Building2, Users, FileText, Wallet, Shield, Receipt, FolderOpen, BarChart3, Bell, Settings];

export function SectionNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana gezinme" className="grid gap-1">
      {sections.map((section, index) => {
        const Icon = icons[index];
        const active = pathname === section.path;
        return (
          <Link
            key={section.path}
            href={section.path}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {section.title}
          </Link>
        );
      })}
    </nav>
  );
}
