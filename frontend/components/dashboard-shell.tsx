import Link from "next/link";
import { Building2, House } from "lucide-react";
import { MobileMenu } from "@/components/mobile-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <a href="#main" className="skip-link">İçeriğe geç</a>
        <aside aria-label="Uygulama" className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
          <nav aria-label="Ana gezinme" className="flex flex-col items-center gap-4 px-2 sm:py-5">
            <Link href="/" aria-label="Mülk Yönetimi ana sayfa" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:h-8 md:w-8">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" aria-current="page" className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground md:h-8 md:w-8">
                  <House className="h-5 w-5" aria-hidden="true" /><span className="sr-only">Genel bakış</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Genel bakış</TooltipContent>
            </Tooltip>
          </nav>
        </aside>
        <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileMenu />
            <Breadcrumb aria-label="İçerik yolu" className="hidden md:flex">
              <BreadcrumbList><BreadcrumbItem><BreadcrumbPage>Genel bakış</BreadcrumbPage></BreadcrumbItem></BreadcrumbList>
            </Breadcrumb>
            <span className="ml-auto text-sm text-muted-foreground">Mülk Yönetimi</span>
          </header>
          <main id="main" tabIndex={-1} className="grid flex-1 content-start gap-4 p-4 sm:px-6 sm:py-0">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
