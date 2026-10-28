import Link from "next/link";
import { Building2 } from "lucide-react";
import { MobileMenu } from "@/components/mobile-menu";
import { SectionNavigation } from "@/components/section-navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";

export function DashboardShell({ children, title = "Genel bakış" }: { children: React.ReactNode; title?: string }) {
  return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <a href="#main" className="skip-link">İçeriğe geç</a>
        <aside aria-label="Uygulama" className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r bg-background sm:flex">
          <div className="flex h-16 items-center border-b px-4">
            <Link href="/" aria-label="Mülk Yönetimi ana sayfa" className="flex min-h-11 items-center gap-3 rounded-md px-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Building2 className="h-5 w-5" aria-hidden="true" /> Mülk Yönetimi
            </Link>
          </div>
          <div className="overflow-y-auto px-3 py-4"><SectionNavigation /></div>
        </aside>
        <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-56">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileMenu />
            <Breadcrumb aria-label="İçerik yolu" className="hidden md:flex">
              <BreadcrumbList><BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList>
            </Breadcrumb>
            <Link href="/giris" className="ml-auto rounded-md px-2 py-2 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Giriş</Link>
          </header>
          <main id="main" tabIndex={-1} className="grid flex-1 content-start gap-4 p-4 sm:px-6 sm:py-0">
            {children}
          </main>
        </div>
      </div>
  );
}
