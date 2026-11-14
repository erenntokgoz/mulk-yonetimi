"use client";

import { useEffect, useState } from "react";
import { MOBILE_MENU_EVENT, takeReturnFocus } from "@/components/shell-shortcuts";
import { Menu } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SectionNavigation } from "@/components/section-navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<boolean | "toggle">).detail;
      setOpen((current) => (detail === "toggle" ? !current : detail));
    };
    document.addEventListener(MOBILE_MENU_EVENT, onEvent);
    return () => document.removeEventListener(MOBILE_MENU_EVENT, onEvent);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="h-11 w-11 lg:hidden" aria-label="Menüyü aç">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" onCloseAutoFocus={(event) => { const target = takeReturnFocus(); if (target) { event.preventDefault(); target.focus(); } }}className="mobile-sheet w-72 max-w-[85vw] overflow-y-auto">
        <SheetTitle className="mb-7 flex items-center gap-3"><BrandMark size={24} /> Ana menü</SheetTitle>
        <SheetDescription className="sr-only">Uygulama sayfalarında gezinin.</SheetDescription>
        <SectionNavigation onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
