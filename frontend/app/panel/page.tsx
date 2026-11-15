import { DashboardShell } from "@/components/dashboard-shell";
import { OverviewDashboard } from "@/components/overview-dashboard";

export const dynamic = "force-dynamic";

export default function PanelPage() {
  return (
    <DashboardShell period>
      <OverviewDashboard />
    </DashboardShell>
  );
}
