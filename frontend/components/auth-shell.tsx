import type { ReactNode } from "react";
import Link from "next/link";
import { House } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { GlassSheen } from "@/components/glass-sheen";
import { Orbs } from "@/components/orbs";
import { ThemeControl } from "@/components/theme-control";
import styles from "@/components/auth-shell.module.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Orbs />
      <GlassSheen />
      <div className={styles.grain} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Mülküm ana sayfa">
          <BrandMark size={32} />
          Mülküm
        </Link>
        <div className={styles.actions}>
          <ThemeControl />
          <Link href="/" className={styles.home} aria-label="Ana sayfa">
            <House aria-hidden="true" />
            <span className={styles.homeText}>Ana sayfa</span>
          </Link>
        </div>
      </header>
      <main className={styles.page}>
        <div className={styles.card}>{children}</div>
      </main>
    </>
  );
}
