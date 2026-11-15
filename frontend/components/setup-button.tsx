"use client";

import { usePathname, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setWizardPreference, useWizardPreference } from "@/lib/setup-wizard-state";
import { useSetupProgress } from "@/lib/setup-progress";

// Düğme yalnız kurulum bitmemişse ve sihirbaz gizlenmişse görünür; kurulum bitince kalkar.
export function SetupButton() {
  const pathname = usePathname();
  const router = useRouter();
  const preference = useWizardPreference();
  const progress = useSetupProgress();
  if (progress === null || progress.every(Boolean) || preference !== "hidden") return null;
  return (
    <Button
      type="button"
      variant="default"
      onClick={() => {
        setWizardPreference("shown");
        if (pathname !== "/panel") router.push("/panel");
      }}
    >
      <ClipboardList size={16} aria-hidden="true" />
      Kurulum
    </Button>
  );
}
