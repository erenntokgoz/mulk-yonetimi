"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribe = (callback: () => void) => {
  document.addEventListener("mulk-theme-change", callback);
  return () => document.removeEventListener("mulk-theme-change", callback);
};
const getSnapshot = () => document.documentElement.classList.contains("dark");

export function ThemeControl() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => true);

  useEffect(() => {
    const saved = localStorage.getItem("mulk-theme");
    const isDark = saved ? saved === "dark" : true;
    document.documentElement.classList.toggle("dark", isDark);
    document.dispatchEvent(new Event("mulk-theme-change"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mulk-theme", next ? "dark" : "light");
    document.dispatchEvent(new Event("mulk-theme-change"));
  }

  return <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"} onClick={toggle}>
    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </Button>;
}
