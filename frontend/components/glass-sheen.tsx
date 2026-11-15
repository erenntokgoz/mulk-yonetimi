"use client";

import { useEffect } from "react";

// Cam yüzeylerdeki parıltı imleci izler; tek dinleyici belge düzeyinde bağlanır, kart başına dinleyici gerekmez.
export function GlassSheen() {
  useEffect(() => {
    let frame = 0;
    function onMove(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".glass, .bg-card, .glass-table") : null;
      if (!target) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        target.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    }
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
