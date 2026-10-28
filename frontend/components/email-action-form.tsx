"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmailActionForm({ title, endpoint }: { title: string; endpoint: string }) {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const email = new FormData(event.currentTarget).get("email");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setState(response.status === 202 ? "sent" : "error");
    } catch { setState("error"); }
  }
  return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {state === "sent" ? <p role="status">Bu adres için işlem gerekiyorsa bağlantı e-postayla gönderildi.</p> :
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">E-posta<input name="email" type="email" autoComplete="email" required maxLength={256} className="h-11 rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        {state === "error" && <p role="alert" className="text-sm text-destructive">İşlem tamamlanamadı. Daha sonra tekrar deneyin.</p>}
        <Button type="submit" size="lg" disabled={state === "pending"}>Bağlantı gönder</Button>
      </form>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main>;
}
