"use client";

import { usePathname, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { setWizardPreference } from "@/lib/setup-wizard-state";

export function SetupButton() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        setWizardPreference("shown");
        if (pathname !== "/panel") router.push("/panel");
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ClipboardList size={16} aria-hidden="true" />
      Kurulum
    </button>
  );
}
