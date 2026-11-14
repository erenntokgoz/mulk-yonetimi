"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";

const passwordMessages: Record<string, string> = {
  PasswordTooShort: "Parola en az 6 karakter olmalı.",
  PasswordRequiresNonAlphanumeric: "Parola en az bir sembol içermeli.",
  PasswordRequiresDigit: "Parola en az bir rakam içermeli.",
  PasswordRequiresUpper: "Parola en az bir büyük harf içermeli.",
  PasswordRequiresLower: "Parola en az bir küçük harf içermeli.",
};

export default function RegisterPage() {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error" | "limited" | "unavailable" | "invalid">("idle");
  const [messages, setMessages] = useState<string[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/bff/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName: form.get("accountName"), email: form.get("email"), password: form.get("password") }),
      });
      if (response.status === 400) {
        const body: unknown = await response.json().catch(() => null);
        const codes = body && typeof body === "object" && Array.isArray((body as { errors?: unknown }).errors) ? (body as { errors: unknown[] }).errors : [];
        const found = codes.map(code => (typeof code === "string" ? passwordMessages[code] : undefined)).filter((m): m is string => Boolean(m));
        setMessages(found);
        setState(found.length ? "invalid" : "error");
        return;
      }
      setState(response.status === 202 ? "sent" : response.status === 429 ? "limited" : response.status === 503 ? "unavailable" : "error");
    } catch { setState("error"); }
  }
  return <AuthShell><main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">Hesap oluştur</h1>
    {state === "sent" ? <p role="status">E-posta adresinize gönderilen doğrulama bağlantısını açın.</p> :
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Hesap adı<input name="accountName" required maxLength={200} className="h-11 rounded-md border px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">E-posta<input name="email" type="email" autoComplete="email" required maxLength={256} className="h-11 rounded-md border px-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Parola<PasswordInput name="password" autoComplete="new-password" required minLength={6} aria-describedby="password-hint" /><span id="password-hint" className="text-xs font-normal text-muted-foreground">En az 6 karakter; büyük harf, küçük harf, rakam ve sembol içermeli.</span></label>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Kayıt tamamlanamadı. Bilgileri ve e-posta hizmetini kontrol edip tekrar deneyin.</p>}
        {state === "invalid" && <ul role="alert" className="list-disc pl-5 text-sm text-destructive">{messages.map(m => <li key={m}>{m}</li>)}</ul>}
        {state === "unavailable" && <p role="alert" className="text-sm text-destructive">E-posta gönderimi şu anda kullanılamıyor. Daha sonra tekrar deneyin.</p>}
        {state === "limited" && <p role="alert" className="text-sm text-destructive">Çok fazla deneme. Bir dakika sonra tekrar deneyin.</p>}
        <Button type="submit" size="lg" disabled={state === "pending"}>{state === "pending" ? "Kaydediliyor…" : "Hesap oluştur"}</Button>
      </form>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main></AuthShell>;
}
