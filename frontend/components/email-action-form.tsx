"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthDone, ErrorNote, Field, SubmitButton } from "@/components/auth-ui";
import styles from "@/components/auth-shell.module.css";

export function EmailActionForm({
  title,
  endpoint,
  sentText,
}: {
  title: string;
  endpoint: string;
  sentText: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error" | "limited">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const email = new FormData(event.currentTarget).get("email");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(response.status === 202 ? "sent" : response.status === 429 ? "limited" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "sent")
    return (
      <AuthShell>
        <AuthDone icon="mail" title="E-postanızı kontrol edin." href="/giris" action="Girişe dön">
          {sentText}
        </AuthDone>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className={styles.title}>{title}</h1>
      <form onSubmit={submit} className={styles.form}>
        <Field id="eposta" label="E-posta">
          <input id="eposta" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={256} className={styles.input} />
        </Field>
        {state === "error" && <ErrorNote>İşlem tamamlanamadı. Daha sonra tekrar deneyin.</ErrorNote>}
        {state === "limited" && <ErrorNote>Çok fazla deneme. Bir dakika sonra tekrar deneyin.</ErrorNote>}
        <SubmitButton busy={state === "pending"}>Bağlantı gönder</SubmitButton>
      </form>
      <p className={styles.foot}>
        <Link href="/giris" className={styles.link}>
          Girişe dön
        </Link>
      </p>
    </AuthShell>
  );
}
