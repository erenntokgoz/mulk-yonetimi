"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { AuthDone, ErrorNote, Field, GoogleButton, PasswordRules, SubmitButton } from "@/components/auth-ui";
import styles from "@/components/auth-shell.module.css";

const passwordMessages: Record<string, string> = {
  PasswordTooShort: "Parola en az 6 karakter olmalı.",
  PasswordRequiresNonAlphanumeric: "Parola en az bir sembol içermeli.",
  PasswordRequiresDigit: "Parola en az bir rakam içermeli.",
  PasswordRequiresUpper: "Parola en az bir büyük harf içermeli.",
  PasswordRequiresLower: "Parola en az bir küçük harf içermeli.",
};

export default function RegisterPage() {
  const [state, setState] = useState<
    "idle" | "pending" | "sent" | "error" | "limited" | "unavailable" | "invalid"
  >("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/bff/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: form.get("accountName"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (response.status === 400) {
        const body: unknown = await response.json().catch(() => null);
        const codes =
          body && typeof body === "object" && Array.isArray((body as { errors?: unknown }).errors)
            ? (body as { errors: unknown[] }).errors
            : [];
        const found = codes
          .map((code) => (typeof code === "string" ? passwordMessages[code] : undefined))
          .filter((m): m is string => Boolean(m));
        setMessages(found);
        setState(found.length ? "invalid" : "error");
        return;
      }
      setSentTo(String(form.get("email") ?? ""));
      setState(
        response.status === 202
          ? "sent"
          : response.status === 429
            ? "limited"
            : response.status === 503
              ? "unavailable"
              : "error",
      );
    } catch {
      setState("error");
    }
  }
  if (state === "sent")
    return (
      <AuthShell>
        <AuthDone icon="mail" title="E-postanızı doğrulayın." href="/giris" action="Girişe dön">
          <b>{sentTo}</b> adresine bir bağlantı gönderdik. Bağlantıya tıkladığınızda hesabınız onay sırasına girer.
        </AuthDone>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className={styles.title}>Hesabınızı oluşturun.</h1>
      <form onSubmit={submit} className={styles.form}>
        <Field id="kayit-hesap" label="Hesap adı">
          <input id="kayit-hesap" name="accountName" autoComplete="organization" required maxLength={200} className={styles.input} />
        </Field>
        <Field id="kayit-email" label="E-posta">
          <input id="kayit-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={256} className={styles.input} />
        </Field>
        <Field id="kayit-parola" label="Parola">
          <PasswordInput
            id="kayit-parola"
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            aria-describedby="kayit-kurallar"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRules id="kayit-kurallar" value={password} />
        </Field>
        {state === "error" && <ErrorNote>Kayıt tamamlanamadı. Bilgileri ve e-posta hizmetini kontrol edip tekrar deneyin.</ErrorNote>}
        {state === "invalid" && (
          <ErrorNote>
            <ul>
              {messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </ErrorNote>
        )}
        {state === "unavailable" && <ErrorNote>E-posta gönderimi şu anda kullanılamıyor. Daha sonra tekrar deneyin.</ErrorNote>}
        {state === "limited" && <ErrorNote>Çok fazla deneme. Bir dakika sonra tekrar deneyin.</ErrorNote>}
        <SubmitButton busy={state === "pending"}>{state === "pending" ? "Kaydediliyor…" : "Hesap oluştur"}</SubmitButton>
        <GoogleButton />
      </form>
      <p className={styles.foot}>
        Hesabınız var mı?{" "}
        <Link className={styles.link} href="/giris">
          Giriş yapın
        </Link>
      </p>
    </AuthShell>
  );
}
