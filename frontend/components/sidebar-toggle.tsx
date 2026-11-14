"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribe = (callback: () => void) => {
  document.addEventListener("mulk-sidebar-change", callback);
  return () => document.removeEventListener("mulk-sidebar-change", callback);
};
const getSnapshot = () => document.documentElement.dataset.sidebar === "collapsed";

// Yalnızca ≥1024px'te görünür; durum <html data-sidebar> üzerinden CSS'e ve localStorage'a yazılır.
export function toggleSidebar() {
  const next = !(document.documentElement.dataset.sidebar === "collapsed");
  if (next) document.documentElement.dataset.sidebar = "collapsed"; else delete document.documentElement.dataset.sidebar;
  try { localStorage.setItem("mulk-sidebar", next ? "collapsed" : "expanded"); } catch { /* kayıt yapılamazsa durum yalnız bu oturumda geçerli kalır */ }
  document.dispatchEvent(new Event("mulk-sidebar-change"));
}

export function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const label = collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt";
  return <Button type="button" variant="ghost" size="icon" className="sidebar-toggle hidden h-10 w-10 lg:inline-flex" aria-label={label} title={label} aria-expanded={!collapsed} aria-controls="app-sidebar" aria-keyshortcuts="Control+B Meta+B" onClick={toggleSidebar}>
    {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
  </Button>;
}
