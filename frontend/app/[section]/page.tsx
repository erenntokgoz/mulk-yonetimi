import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { findSection, sections } from "@/lib/navigation";
import { PropertyPortfolio } from "@/components/property-portfolio";
import { TenantDirectory } from "@/components/tenant-directory";
import { LeaseDirectory } from "@/components/lease-directory";
import { RentCollection } from "@/components/rent-collection";
import { DepositDirectory } from "@/components/deposit-directory";
import { ExpenseDirectory } from "@/components/expense-directory";
import { ReportDashboard } from "@/components/report-dashboard";
import { SettingsDashboard } from "@/components/settings-dashboard";
import { NotificationDirectory } from "@/components/notification-directory";
import { DocumentLibrary } from "@/components/document-library";

export function generateStaticParams() {
  return sections.filter((section) => section.path !== "/").map((section) => ({ section: section.path.slice(1) }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = findSection(`/${slug}`);
  if (!section || section.path === "/") notFound();

  const content = section.path === "/portfoy" ? <PropertyPortfolio />
    : section.path === "/kiracilar" ? <TenantDirectory />
      : section.path === "/sozlesmeler" ? <LeaseDirectory />
        : section.path === "/kira-tahsilatlar" ? <RentCollection />
          : section.path === "/depozitolar" ? <DepositDirectory />
            : section.path === "/giderler" ? <ExpenseDirectory />
              : section.path === "/raporlar" ? <ReportDashboard />
                : section.path === "/ayarlar" ? <SettingsDashboard />
                  : section.path === "/bildirimler" ? <NotificationDirectory />
                    : section.path === "/belgeler" ? <DocumentLibrary />
                      : notFound();

  return <DashboardShell title={section.title}>{content}</DashboardShell>;
}
