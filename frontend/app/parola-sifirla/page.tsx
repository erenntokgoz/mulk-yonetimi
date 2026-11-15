"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { AuthDone, ErrorNote, Field, PasswordRules, SubmitButton } from "@/components/auth-ui";
import styles from "@/components/auth-shell.module.css";

function ResetForm() {
  const search = useSearchParams();
  const hasLinkDetails = Boolean(search.get("userId") && search.get("token"));
  const [state, setState] = useState<"idle" | "pending" | "done" | "error" | "limited" | "mismatch">("idle");
  const [password, setPassword] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("password2")) {
      setState("mismatch");
      return;
    }
    setState("pending");
    try {
      const response = await fetch("/api/bff/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: search.get("userId"), token: search.get("token"), password: form.get("password") }),
      });
      setState(response.status === 204 ? "done" : response.status === 429 ? "limited" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done")
    return (
      <AuthShell>
        <AuthDone icon="check" title="Parolanız değişti." href="/giris" action="Giriş yap" primary>
          Artık yeni parolanızla giriş yapabilirsiniz.
        </AuthDone>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className={styles.title}>Yeni parolanızı belirleyin.</h1>
      <form onSubmit={submit} className={styles.form}>
        {!hasLinkDetails && <ErrorNote>Parola sıfırlama bağlantısı eksik veya geçersiz.</ErrorNote>}
        <Field id="yeni-parola" label="Yeni parola">
          <PasswordInput
            id="yeni-parola"
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            aria-describedby="yeni-kurallar"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRules id="yeni-kurallar" value={password} />
        </Field>
        <Field id="yeni-parola-tekrar" label="Yeni parola tekrar">
          <PasswordInput id="yeni-parola-tekrar" name="password2" autoComplete="new-password" required minLength={6} />
        </Field>
        {state === "mismatch" && <ErrorNote>İki parola birbirini tutmuyor.</ErrorNote>}
        {state === "error" && <ErrorNote>Bağlantı geçersiz veya parola kabul edilmedi.</ErrorNote>}
        {state === "limited" && <ErrorNote>Çok fazla deneme. Bir dakika sonra tekrar deneyin.</ErrorNote>}
        <SubmitButton busy={state === "pending"} disabled={!hasLinkDetails} inert>
          Parolayı güncelle
        </SubmitButton>
      </form>
      {!hasLinkDetails && (
        <p className={styles.foot}>
          <Link href="/parolami-unuttum" className={styles.link}>
            Yeni sıfırlama bağlantısı isteyin
          </Link>
        </p>
      )}
      <p className={styles.foot}>
        <Link href="/giris" className={styles.link}>
          Girişe dön
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
