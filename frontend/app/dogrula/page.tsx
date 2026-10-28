"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function ConfirmForm() {
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  async function confirm() {
    setState("pending");
    try {
      const response = await fetch("/api/bff/auth/confirm-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: search.get("userId"), token: search.get("token") }),
      });
      setState(response.ok ? "done" : "error");
    } catch { setState("error"); }
  }
  return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">E-posta doğrulama</h1>
    {state === "done" ? <p role="status">E-posta doğrulandı. Giriş yapabilirsiniz.</p> :
      <><Button type="button" size="lg" onClick={confirm} disabled={state === "pending" || !search.get("userId") || !search.get("token")}>E-postayı doğrula</Button>
        {state === "error" && <p role="alert" className="text-sm text-destructive">Bağlantı geçersiz veya kullanılmış.</p>}</>}
    <Link href="/giris" className="text-sm underline">Giriş</Link>
  </main>;
}

export default function ConfirmPage() {
  return <Suspense><ConfirmForm /></Suspense>;
}
