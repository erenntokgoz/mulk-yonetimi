import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { UnavailableSection } from "@/components/unavailable-section";
import { findSection, sections } from "@/lib/navigation";

export function generateStaticParams() {
  return sections.filter((section) => section.path !== "/").map((section) => ({ section: section.path.slice(1) }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = findSection(`/${slug}`);
  if (!section || section.path === "/") notFound();

  return (
    <DashboardShell title={section.title}>
      <h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
      <UnavailableSection message={section.unavailable} />
    </DashboardShell>
  );
}
