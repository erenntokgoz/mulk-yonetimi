"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { setWizardPreference, useWizardPreference } from "@/lib/setup-wizard-state";
import { useSetupProgress } from "@/lib/setup-progress";
import styles from "@/components/overview.module.css";

const steps = [
  { title: "Mülk", action: "Mülk ekle", href: "/portfoy" },
  { title: "Bölüm", action: "Daire ekle", href: "/portfoy" },
  { title: "Kiracı", action: "Kiracı ekle", href: "/kiracilar" },
  { title: "Sözleşme", action: "Sözleşme aç", href: "/sozlesmeler" },
  { title: "İlk tahsilat", action: "Tahsilat kaydet", href: "/kira-tahsilatlar" },
] as const;

const heading = [
  "",
  "Kuruluma bir adım kaldı.",
  "Kuruluma iki adım kaldı.",
  "Kuruluma üç adım kaldı.",
  "Kuruluma dört adım kaldı.",
  "Kurulumla başlayalım.",
];

export function SetupWizard() {
  const preference = useWizardPreference();
  const progress = useSetupProgress();

  if (progress === null || preference === "hidden" || progress.every(Boolean)) return null;

  const current = progress.findIndex((done) => !done);
  const doneCount = progress.filter(Boolean).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <section aria-labelledby="setup-wizard-title" className={`glass ${styles.panel} ${styles.wizard} rv`} style={{ "--i": 2 } as React.CSSProperties}>
      <button type="button" className={`ib ${styles.wizardClose}`} aria-label="Sihirbazı gizle" onClick={() => setWizardPreference("hidden")}>
        <X aria-hidden="true" />
      </button>
      <div className={styles.wizardGrid}>
        <div>
          <h2 id="setup-wizard-title" className={styles.wizardTitle}>
            {heading[steps.length - doneCount]}
          </h2>
          <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Kurulum ilerlemesi">
            <i style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.barMeta}>
            <span className="num">
              {doneCount} / {steps.length}
            </span>
            <span className="num">%{percent}</span>
          </div>
        </div>
        <ol className={styles.steps}>
          {steps.map((step, index) => {
            const done = progress[index];
            const isCurrent = index === current;
            return (
              <li key={step.title} className={done ? styles.stepOk : undefined} aria-current={isCurrent ? "step" : undefined}>
                <span className={styles.stepNo} aria-hidden="true">
                  {done ? <Check size={14} /> : index + 1}
                </span>
                <b>{step.title}</b>
                {done && <small>Tamamlandı</small>}
                {isCurrent && (
                  <Link href={step.href} className={styles.stepGo}>
                    {step.action}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
