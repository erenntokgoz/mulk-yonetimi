"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth-shell";

function ConfirmForm() {
  const search = useSearchParams();
  const hasLinkDetails = Boolean(search.get("userId") && search.get("token"));
  const [state, setState] = useState<"idle" | "pending" | "done" | "error" | "limited">("idle");
  async function confirm() {
    setState("pending");
    try {
      const response = await fetch("/api/bff/auth/confirm-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: search.get("userId"), token: search.get("token") }),
      });
      setState(response.ok ? "done" : response.status === 429 ? "limited" : "error");
    } catch { setState("error"); }
  }
  return <AuthShell><main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">E-posta doğrulama</h1>
    {!hasLinkDetails && <p className="text-sm text-muted-foreground">Doğrulama bağlantısı eksik veya geçersiz.</p>}
    {state === "done" ? <p role="status">E-posta doğrulandı. Giriş yapabilirsiniz.</p> :
      <><Button type="button" size="lg" onClick={confirm} disabled={state === "pending" || !hasLinkDetails} className="disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground">E-postayı doğrula</Button>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Bağlantı geçersiz veya kullanılmış.</p>}</>}
    {state === "limited" && <p role="alert" className="text-sm text-destructive">Çok fazla deneme. Bir dakika sonra tekrar deneyin.</p>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
    <Link href="/dogrulama-yeniden-gonder" className="text-sm underline">Yeni doğrulama bağlantısı gönder</Link>
  </main></AuthShell>;
}

export default function ConfirmPage() {
  return <Suspense><ConfirmForm /></Suspense>;
}
