"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SessionControl() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    void fetch("/api/bff/me", { cache: "no-store" }).then((response) => setSignedIn(response.ok)).catch(() => setSignedIn(false));
  }, []);
  if (!signedIn) return <Link href="/giris" className="ml-auto inline-flex min-h-11 items-center rounded-md px-3 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Giriş</Link>;
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/bff/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      setSignedIn(false); router.replace("/giris"); router.refresh();
    } finally { setBusy(false); }
  }
  return <Button type="button" variant="ghost" className="ml-auto h-11 sm:h-10" disabled={busy} onClick={() => void logout()}>{busy ? "Çıkış yapılıyor…" : "Çıkış yap"}</Button>;
}
