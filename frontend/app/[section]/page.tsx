import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { findSection, sections } from "@/lib/navigation";

export function generateStaticParams() {
  return sections
    .filter((section) => section.path !== "/panel" && section.path !== "/kurulum")
    .map((section) => ({ section: section.path.slice(1) }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = findSection(`/${slug}`);
  if (!section || section.path === "/panel") notFound();

  const content = await renderSection(section.path);
  if (!content) notFound();

  return <DashboardShell title={section.title}>{content}</DashboardShell>;
}

// Her bölüm yalnızca kendi bileşenini yükler; tek bir paket tüm bölümleri taşımaz.
async function renderSection(path: string) {
  switch (path) {
    case "/portfoy": {
      const { PropertyPortfolio } = await import("@/components/property-portfolio");
      return <PropertyPortfolio />;
    }
    case "/kiracilar": {
      const { TenantDirectory } = await import("@/components/tenant-directory");
      return <TenantDirectory />;
    }
    case "/sozlesmeler": {
      const { LeaseDirectory } = await import("@/components/lease-directory");
      return <LeaseDirectory />;
    }
    case "/kira-tahsilatlar": {
      const { RentCollection } = await import("@/components/rent-collection");
      return <RentCollection />;
    }
    case "/depozitolar": {
      const { DepositDirectory } = await import("@/components/deposit-directory");
      return <DepositDirectory />;
    }
    case "/giderler": {
      const { ExpenseDirectory } = await import("@/components/expense-directory");
      return <ExpenseDirectory />;
    }
    case "/raporlar": {
      const { ReportDashboard } = await import("@/components/report-dashboard");
      return <ReportDashboard />;
    }
    case "/ayarlar": {
      const { SettingsDashboard } = await import("@/components/settings-dashboard");
      return <SettingsDashboard />;
    }
    case "/bildirimler": {
      const { NotificationDirectory } = await import("@/components/notification-directory");
      return <NotificationDirectory />;
    }
    case "/belgeler": {
      const { DocumentLibrary } = await import("@/components/document-library");
      return <DocumentLibrary />;
    }
    default:
      return null;
  }
}
