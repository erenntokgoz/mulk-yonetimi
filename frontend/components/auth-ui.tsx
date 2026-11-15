"use client";

import { Suspense, type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Mail } from "lucide-react";
import styles from "@/components/auth-shell.module.css";
import { googleErrorMessage } from "@/lib/login-messages";
import { safeNextPath } from "@/lib/safe-next-path";
import { setSessionState } from "@/lib/session-client";

// Parola kuralları API'deki kimlik politikasıyla aynıdır; yalnız anlık gösterge olup sunucu doğrulaması geçerlidir.
const RULES = [
  { id: "len", text: "En az 6 karakter", test: (p: string) => p.length >= 6 },
  { id: "up", text: "Bir büyük harf", test: (p: string) => /[A-ZÇĞİÖŞÜ]/.test(p) },
  { id: "low", text: "Bir küçük harf", test: (p: string) => /[a-zçğıöşü]/.test(p) },
  { id: "dig", text: "Bir rakam", test: (p: string) => /\d/.test(p) },
  { id: "sym", text: "Bir sembol", test: (p: string) => /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(p) },
];

export function PasswordRules({ id, value }: { id: string; value: string }) {
  return (
    <ul className={styles.rules} id={id}>
      {RULES.map((rule) => (
        <li key={rule.id} className={rule.test(value) ? styles.ok : undefined} data-ok={rule.test(value)}>
          {rule.text}
        </li>
      ))}
    </ul>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

const GOOGLE_START = "/api/bff/auth/google";

type GooglePopupResult =
  | { type: "mulk-google-auth-result"; status: "success"; next: string }
  | { type: "mulk-google-auth-result"; status: "error"; error: string };

function isGooglePopupResult(value: unknown): value is GooglePopupResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return result.type === "mulk-google-auth-result" &&
    ((result.status === "success" && typeof result.next === "string") ||
      (result.status === "error" && typeof result.error === "string" && googleErrorMessage(result.error) !== null));
}

export function GooglePopupLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const router = useRouter();
  const popup = useRef<Window | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!popup.current || event.source !== popup.current || event.origin !== window.location.origin ||
        !isGooglePopupResult(event.data)) return;
      const source = popup.current;
      popup.current = null;
      setPending(false);
      source.close();
      if (event.data.status === "error") {
        setError(googleErrorMessage(event.data.error) ?? googleErrorMessage("google"));
        return;
      }
      setError(null);
      setSessionState(true);
      router.replace(safeNextPath(event.data.next));
      router.refresh();
    };
    const cancelCheck = window.setInterval(() => {
      if (popup.current?.closed) {
        popup.current = null;
        setPending(false);
        setError("Google giriş penceresi kapatıldı. Yeniden deneyin.");
      }
    }, 250);
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(cancelCheck);
      window.removeEventListener("message", onMessage);
      popup.current?.close();
      popup.current = null;
    };
  }, [router]);

  function openPopup(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (popup.current && !popup.current.closed) {
      event.preventDefault();
      popup.current.focus();
      return;
    }
    const opened = window.open(href, "mulk-google-auth", "popup,width=500,height=640,resizable,scrollbars");
    if (!opened) return;
    event.preventDefault();
    popup.current = opened;
    setError(null);
    setPending(true);
  }

  return (
    <>
      <a className={className} href={href} onClick={openPopup} aria-busy={pending || undefined}>
        {children}
      </a>
      {pending && <p role="status" aria-live="polite">Google giriş penceresi açık.</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
    </>
  );
}

function GoogleLink({ next }: { next?: string | null }) {
  const target = safeNextPath(next);
  const query = new URLSearchParams({ popup: "1" });
  if (target !== "/panel") query.set("next", target);
  const href = `${GOOGLE_START}?${query}`;
  return (
    <GooglePopupLink className={`${styles.btn} ${styles.ghost}`} href={href}>
      <svg className={styles.g} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Google ile devam et
    </GooglePopupLink>
  );
}

function GoogleLinkWithNext() {
  return <GoogleLink next={useSearchParams().get("next")} />;
}

// Düğme yalnız NEXT_PUBLIC_GOOGLE_AUTH=1 iken çizilir; giriş sonrası hedef sunucuda yeniden doğrulanır.
export function GoogleButton() {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "1") return null;
  return (
    <>
      <div className={styles.or}>ya da</div>
      <Suspense fallback={<GoogleLink />}>
        <GoogleLinkWithNext />
      </Suspense>
    </>
  );
}

function GoogleSignInErrorNote() {
  const message = googleErrorMessage(useSearchParams().get("hata"));
  return message ? <ErrorNote>{message}</ErrorNote> : null;
}

export function GoogleSignInError() {
  return (
    <Suspense fallback={null}>
      <GoogleSignInErrorNote />
    </Suspense>
  );
}

export function SubmitButton({ busy, children, disabled, inert }: { busy: boolean; children: ReactNode; disabled?: boolean; inert?: boolean }) {
  return (
    <button type="submit" className={`${styles.btn} ${styles.primary} ${inert ? styles.inert : ""}`} disabled={busy || disabled}>
      {busy && <span className={styles.spin} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className={styles.err}>
      {children}
    </div>
  );
}

// Başarı durumu: simge, başlık, kısa sonuç cümlesi ve tek eylem.
export function AuthDone({ icon, title, children, href, action, primary }: { icon: "mail" | "check"; title: string; children: ReactNode; href: string; action: string; primary?: boolean }) {
  return (
    <div className={styles.done} role="status">
      <div className={`${styles.ic} ${icon === "mail" ? styles.mail : ""}`} aria-hidden="true">
        {icon === "mail" ? <Mail /> : <Check />}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{children}</p>
      <Link href={href} className={`${styles.btn} ${primary ? styles.primary : styles.ghost}`}>
        {action}
      </Link>
    </div>
  );
}
