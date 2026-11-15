import Link from "next/link";
import { Bell } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { GlassSheen } from "@/components/glass-sheen";
import { MobileMenu } from "@/components/mobile-menu";
import { Orbs } from "@/components/orbs";
import { PeriodChip } from "@/components/period-chip";
import { SectionNavigation } from "@/components/section-navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ShellShortcuts } from "@/components/shell-shortcuts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SessionControl } from "@/components/session-control";
import { ThemeControl } from "@/components/theme-control";
import { SetupButton } from "@/components/setup-button";
import { RouteSurface } from "@/components/route-surface";

export function DashboardShell({
  children,
  title = "Genel bakış",
  period = false,
}: {
  children: React.ReactNode;
  title?: string;
  period?: boolean;
}) {
  return (
    <div className="app-shell flex min-h-screen w-full flex-col">
      <Orbs />
      <GlassSheen />
      <ShellShortcuts />
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <aside
        id="app-sidebar"
        aria-label="Uygulama"
        className="glass glass-sidebar hidden lg:flex"
      >
        <div className="sidebar-brand flex items-center">
          <Link
            href="/panel"
            aria-label="Mülküm genel bakış"
            className="flex min-h-11 items-center gap-3 rounded-md"
          >
            <BrandMark size={32} />
            <span className="sidebar-label">Mülküm</span>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <SectionNavigation />
        </div>
        <div className="sidebar-footer">
          <SessionControl />
        </div>
      </aside>
      <div className="workspace flex min-w-0 flex-1 flex-col">
        <header className="workspace-header glass sticky top-3 z-30 flex items-center">
          <MobileMenu />
          <SidebarToggle />
          <Breadcrumb aria-label="İçerik yolu" className="hidden md:flex">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {period && <PeriodChip />}
          <div className="ml-auto flex items-center gap-2">
            <ThemeControl />
            <Link href="/bildirimler" className="ib" aria-label="Bildirimler" title="Bildirimler">
              <Bell aria-hidden="true" />
            </Link>
            <SetupButton />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="workspace-main grid flex-1 content-start gap-4">
          <RouteSurface>{children}</RouteSurface>
        </main>
      </div>
    </div>
  );
}
