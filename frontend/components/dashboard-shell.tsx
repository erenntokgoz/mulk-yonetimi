import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { MobileMenu } from "@/components/mobile-menu";
import { SectionNavigation } from "@/components/section-navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SessionControl } from "@/components/session-control";
import { ThemeControl } from "@/components/theme-control";
import { RouteSurface } from "@/components/route-surface";

export function DashboardShell({ children, title = "Genel bakış" }: { children: React.ReactNode; title?: string }) {
  return (
      <div className="app-shell flex min-h-screen w-full flex-col">
        <a href="#main" className="skip-link">İçeriğe geç</a>
        <aside id="app-sidebar" aria-label="Uygulama" className="glass-sidebar fixed z-10 hidden w-56 flex-col lg:flex">
          <div className="sidebar-brand flex h-16 items-center px-4">
            <Link href="/panel" aria-label="Mülküm genel bakış" className="flex min-h-11 items-center gap-3 rounded-md px-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <BrandMark size={30} /><span className="sidebar-label">Mülküm<span className="brand-caption">Portföy ve finans</span></span>
            </Link>
          </div>
          <div className="min-h-0 overflow-y-auto px-3 py-2"><SectionNavigation /></div>
          <div className="sidebar-footer"><span className="sidebar-label text-xs text-muted-foreground">Görünüm</span><ThemeControl /></div>
        </aside>
        <div className="workspace flex min-w-0 flex-1 flex-col">
          <header className="workspace-header sticky top-0 z-30 flex h-16 items-center gap-4 px-4 sm:px-6 lg:static">
            <MobileMenu />
            <SidebarToggle />
            <Breadcrumb aria-label="İçerik yolu" className="hidden md:flex">
              <BreadcrumbList><BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList>
            </Breadcrumb>
            <span className="ml-auto lg:hidden"><ThemeControl /></span>
            <SessionControl />
          </header>
          <main id="main" tabIndex={-1} className="workspace-main grid flex-1 content-start gap-4 p-4 sm:px-6 sm:py-0">
            <RouteSurface>{children}</RouteSurface>
          </main>
        </div>
      </div>
  );
}
