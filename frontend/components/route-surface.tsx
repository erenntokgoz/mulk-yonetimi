"use client";

import { usePathname } from "next/navigation";

export function RouteSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="route-surface">{children}</div>;
}
