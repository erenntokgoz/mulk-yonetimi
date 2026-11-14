"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setSessionState, useSessionState } from "@/lib/session-client";

export function SessionControl() {
  const [signedIn, setSignedIn] = useSessionState();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Sabit boyutlu alan: yükleme -> Giriş/Çıkış geçişi düzeni kaydırmaz.
  if (signedIn === null)
    return <span aria-hidden="true" className="ml-auto inline-block h-11 w-24 sm:h-10" />;
  if (!signedIn)
    return (
      <Link
        href="/giris"
        className="ml-auto inline-flex h-11 w-24 items-center justify-center rounded-md px-3 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10"
      >
        Giriş
      </Link>
    );
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/bff/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      setSessionState(false);
      setSignedIn(false);
      router.replace("/giris");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      className="ml-auto h-11 min-w-24 sm:h-10"
      disabled={busy}
      onClick={() => void logout()}
    >
      {busy ? "Çıkış yapılıyor…" : "Çıkış yap"}
    </Button>
  );
}
