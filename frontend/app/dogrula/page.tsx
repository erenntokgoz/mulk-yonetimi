"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthDone, ErrorNote } from "@/components/auth-ui";
import styles from "@/components/auth-shell.module.css";

function ConfirmForm() {
  const search = useSearchParams();
  const hasLinkDetails = Boolean(search.get("userId") && search.get("token"));
  const [state, setState] = useState<"idle" | "pending" | "done" | "error" | "limited">("idle");
  async function confirm() {
    setState("pending");
    try {
      const response = await fetch("/api/bff/auth/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: search.get("userId"), token: search.get("token") }),
      });
      setState(response.ok ? "done" : response.status === 429 ? "limited" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done")
    return (
      <AuthShell>
        <AuthDone icon="check" title="E-posta doğrulandı." href="/giris" action="Giriş yap" primary>
          Hesabınız onaylandıktan sonra giriş yapabilirsiniz.
        </AuthDone>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className={styles.title}>E-posta doğrulama</h1>
      <div className={styles.form}>
        {!hasLinkDetails && <ErrorNote>Doğrulama bağlantısı eksik veya geçersiz.</ErrorNote>}
        <button
          type="button"
          onClick={confirm}
          disabled={state === "pending" || !hasLinkDetails}
          className={`${styles.btn} ${styles.primary} ${styles.inert}`}
        >
          E-postayı doğrula
        </button>
        {state === "error" && <ErrorNote>Bağlantı geçersiz veya kullanılmış.</ErrorNote>}
        {state === "limited" && <ErrorNote>Çok fazla deneme. Bir dakika sonra tekrar deneyin.</ErrorNote>}
      </div>
      <p className={styles.foot}>
        <Link href="/giris" className={styles.link}>
          Girişe dön
        </Link>
      </p>
      <p className={styles.foot}>
        <Link href="/dogrulama-yeniden-gonder" className={styles.link}>
          Yeni doğrulama bağlantısı gönder
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}
