"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error" | "limited">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/bff/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName: form.get("accountName"), email: form.get("email"), password: form.get("password") }),
      });
      setState(response.status === 202 ? "sent" : response.status === 429 ? "limited" : "error");
    } catch { setState("error"); }
  }
  return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">Hesap oluştur</h1>
    {state === "sent" ? <p role="status">E-posta adresinize gönderilen doğrulama bağlantısını açın.</p> :
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Hesap adı<input name="accountName" required maxLength={200} className="h-11 rounded-md border px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">E-posta<input name="email" type="email" autoComplete="email" required maxLength={256} className="h-11 rounded-md border px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Parola<input name="password" type="password" autoComplete="new-password" required minLength={6} className="h-11 rounded-md border px-3" /></label>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Kayıt tamamlanamadı. Bilgileri ve e-posta hizmetini kontrol edip tekrar deneyin.</p>}
        {state === "limited" && <p role="alert" className="text-sm text-destructive">Çok fazla deneme. Bir dakika sonra tekrar deneyin.</p>}
        <Button type="submit" size="lg" disabled={state === "pending"}>{state === "pending" ? "Kaydediliyor…" : "Hesap oluştur"}</Button>
      </form>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main>;
}
