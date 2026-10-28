"use client";

import Link from "next/link";
import { Building2, House, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 sm:hidden" aria-label="Menüyü aç">
          <PanelLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[85vw]">
        <SheetTitle className="mb-7 flex items-center gap-3"><Building2 className="h-5 w-5" aria-hidden="true" /> Ana menü</SheetTitle>
        <SheetDescription className="sr-only">Uygulama sayfalarında gezinin.</SheetDescription>
        <nav aria-label="Ana gezinme" className="grid gap-2">
          <Link href="/" aria-current="page" className="flex min-h-11 items-center gap-4 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground">
            <House className="h-5 w-5" aria-hidden="true" /> Genel bakış
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
