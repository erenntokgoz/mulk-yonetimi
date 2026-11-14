"use client";

import { useState } from "react";
import { Building2, PanelLeft } from "lucide-react";
import { SectionNavigation } from "@/components/section-navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 sm:hidden" aria-label="Menüyü aç">
          <PanelLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[85vw] overflow-y-auto">
        <SheetTitle className="mb-7 flex items-center gap-3"><Building2 className="h-5 w-5" aria-hidden="true" /> Ana menü</SheetTitle>
        <SheetDescription className="sr-only">Uygulama sayfalarında gezinin.</SheetDescription>
        <SectionNavigation onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
