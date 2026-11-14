"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";

function ResetForm() {
  const search = useSearchParams();
  const hasLinkDetails = Boolean(search.get("userId") && search.get("token"));
  const [state, setState] = useState<"idle" | "pending" | "done" | "error" | "limited">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const password = new FormData(event.currentTarget).get("password");
    try {
      const response = await fetch("/api/bff/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: search.get("userId"), token: search.get("token"), password }),
      });
      setState(response.status === 204 ? "done" : response.status === 429 ? "limited" : "error");
    } catch { setState("error"); }
  }
  return <AuthShell><main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">Parola sıfırla</h1>
    {!hasLinkDetails && <p className="text-sm text-muted-foreground">Parola sıfırlama bağlantısı eksik veya geçersiz.</p>}
    {state === "done" ? <p role="status">Parola güncellendi. Giriş yapabilirsiniz.</p> :
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Yeni parola<PasswordInput name="password" autoComplete="new-password" required minLength={6} /></label>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Bağlantı geçersiz veya parola kabul edilmedi.</p>}
        {state === "limited" && <p role="alert" className="text-sm text-destructive">Çok fazla deneme. Bir dakika sonra tekrar deneyin.</p>}
        <Button type="submit" size="lg" disabled={state === "pending" || !hasLinkDetails} className="disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground">Parolayı güncelle</Button>
      </form>}
    {!hasLinkDetails && <Link href="/parolami-unuttum" className="text-sm underline">Yeni sıfırlama bağlantısı isteyin</Link>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main></AuthShell>;
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
