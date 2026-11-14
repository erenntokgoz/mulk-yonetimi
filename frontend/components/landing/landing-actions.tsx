"use client";

import Link from "next/link";
import { useSessionState } from "@/lib/session-client";
import styles from "./landing.module.css";

// Oturum bilinene kadar alan boş ama yer ayrılmış; yanlış düğme görünmez, düzen kaymaz.
export function LandingActions({ placement }: { placement: "header" | "hero" }) {
  const [signedIn] = useSessionState();
  const cls = placement === "header" ? styles.actionsHeader : styles.actionsHero;
  if (signedIn === null) return <div className={cls} aria-hidden="true" />;
  if (signedIn) return <div className={cls}><Link href="/panel" className={styles.primary}>Panele git</Link></div>;
  return (
    <div className={cls}>
      <Link href="/giris" className={placement === "header" ? styles.quiet : styles.secondary}>Giriş yap</Link>
      <Link href="/kayit" className={styles.primary}>Hesap oluştur</Link>
    </div>
  );
}
