"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function ResetForm() {
  const search = useSearchParams();
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
  return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">Parola sıfırla</h1>
    {state === "done" ? <p role="status">Parola güncellendi. Giriş yapabilirsiniz.</p> :
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Yeni parola<input name="password" type="password" autoComplete="new-password" required minLength={6} className="h-11 rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Bağlantı geçersiz veya parola kabul edilmedi.</p>}
        {state === "limited" && <p role="alert" className="text-sm text-destructive">Çok fazla deneme. Bir dakika sonra tekrar deneyin.</p>}
        <Button type="submit" size="lg" disabled={state === "pending" || !search.get("userId") || !search.get("token")}>Parolayı güncelle</Button>
      </form>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main>;
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
