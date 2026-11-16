"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { ErrorNote, Field, GoogleButton, GoogleSignInError, SubmitButton } from "@/components/auth-ui";
import { loginMessages, loginStatusMessage } from "@/lib/login-messages";
import { safeNextPath } from "@/lib/safe-next-path";
import { setSessionState } from "@/lib/session-client";
import styles from "@/components/auth-shell.module.css";

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
        setError(loginStatusMessage(response.status));
        return;
      }
      setSessionState(true);
      router.push(safeNextPath(new URLSearchParams(window.location.search).get("next")));
      router.refresh();
    } catch {
      setError(loginMessages.offline);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Hesabınıza girin.</h1>
      <form onSubmit={submit} className={styles.form}>
        <Field id="giris-email" label="E-posta">
          <input id="giris-email" name="email" type="email" autoComplete="username" inputMode="email" required maxLength={256} className={styles.input} />
        </Field>
        <div className={styles.field}>
          <div className={styles.lblrow}>
            <label className={styles.label} htmlFor="giris-parola">
              Parola
            </label>
            <Link href="/parolami-unuttum" className={styles.link}>
              Parolamı unuttum
            </Link>
          </div>
          <PasswordInput id="giris-parola" name="password" autoComplete="current-password" required />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : <GoogleSignInError />}
        <SubmitButton busy={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</SubmitButton>
        <GoogleButton />
      </form>
      <p className={styles.foot}>
        Hesabınız yok mu?{" "}
        <Link className={styles.link} href="/kayit">
          Hesap oluşturun
        </Link>
      </p>
    </AuthShell>
  );
}
