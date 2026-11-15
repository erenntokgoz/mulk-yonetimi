"use client";

import dynamic from "next/dynamic";

// Ağır paketler (three, gsap, lenis) sunucuda çizilmez ve ilk HTML'i büyütmez.
const LandingStage = dynamic(() => import("@/components/landing/landing-stage"), { ssr: false });

export function LandingClient() {
  return <LandingStage />;
}
