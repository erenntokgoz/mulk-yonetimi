"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const subscribe = (callback: () => void) => {
  document.addEventListener("mulk-theme-change", callback);
  return () => document.removeEventListener("mulk-theme-change", callback);
};
const getSnapshot = () => document.documentElement.classList.contains("dark");

export function ThemeControl() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => true);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    if (next) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = "light";
    try {
      localStorage.setItem("mulk-theme", next ? "dark" : "light");
    } catch {
      /* kayıt yapılamazsa tema yalnız bu oturumda geçerli kalır */
    }
    document.dispatchEvent(new Event("mulk-theme-change"));
  }

  return (
    <button
      type="button"
      className="ib theme-btn"
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      onClick={toggle}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
