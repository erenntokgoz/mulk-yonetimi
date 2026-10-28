"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/bff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "E-posta veya parola hatalı." :
          response.status === 403 ? "Hesap erişimi kullanılamıyor. E-posta doğrulamasını ve hesap durumunu kontrol edin." :
          "Giriş yapılamadı. Daha sonra tekrar deneyin.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. Daha sonra tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div><h1 className="text-2xl font-semibold">Giriş</h1><p className="mt-2 text-sm text-muted-foreground">Mülk Yönetimi hesabınızla devam edin.</p></div>
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">E-posta
          <input name="email" type="email" autoComplete="username" required maxLength={256} className="h-11 rounded-md border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="grid gap-2 text-sm font-medium">Parola
          <input name="password" type="password" autoComplete="current-password" required className="h-11 rounded-md border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</Button>
      </form>
      <Link href="/" className="text-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Genel bakış</Link>
    </main>
  );
}
