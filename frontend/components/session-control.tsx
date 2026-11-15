"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { setSessionState, useSessionState } from "@/lib/session-client";

export function SessionControl() {
  const [signedIn, setSignedIn] = useSessionState();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Sabit boyutlu alan: yükleme -> Giriş/Çıkış geçişi düzeni kaydırmaz.
  if (signedIn === null) return <span aria-hidden="true" className="block h-11" />;
  if (!signedIn)
    return (
      <Link href="/giris" className="me-out" title="Giriş" aria-label="Giriş">
        <LogIn aria-hidden="true" />
        <span className="sidebar-label">Giriş</span>
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
    <button
      type="button"
      className="me-out"
      aria-label="Çıkış yap"
      title="Çıkış yap"
      disabled={busy}
      onClick={() => void logout()}
    >
      <LogOut aria-hidden="true" />
      <span className="sidebar-label">{busy ? "Çıkış yapılıyor…" : "Çıkış yap"}</span>
    </button>
  );
}
