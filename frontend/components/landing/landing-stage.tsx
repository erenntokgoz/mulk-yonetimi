"use client";

import { useEffect, useRef } from "react";
import { startEffects } from "@/components/landing/effects";
import { startScene } from "@/components/landing/scene";
import styles from "@/components/landing/landing.module.css";

// Üç boyutlu sahne ve kaydırma animasyonları yalnız tarayıcıda kurulur. Sahne kurulamazsa (WebGL yok) metin ve bağlantılar aynen çalışır.
export default function LandingStage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const tipTitle = useRef<HTMLDivElement>(null);
  const tipPill = useRef<HTMLSpanElement>(null);
  const tipRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: ReturnType<typeof startScene> | null = null;
    if (canvas.current && labels.current && tip.current && tipTitle.current && tipPill.current && tipRow.current) {
      try {
        scene = startScene({
          canvas: canvas.current,
          labels: labels.current,
          tip: tip.current,
          tipTitle: tipTitle.current,
          tipPill: tipPill.current,
          tipRow: tipRow.current,
          classes: styles,
          reduce,
        });
      } catch {
        scene = null;
        canvas.current.style.display = "none";
      }
    }
    const stopEffects = startEffects({ onRefresh: scene?.measure, reduce });
    return () => {
      stopEffects();
      scene?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className={styles.scene} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div ref={labels} className={styles.labels} aria-hidden="true" />
      <div ref={tip} className={styles.tip} aria-hidden="true">
        <div ref={tipTitle} className={styles.tipT} />
        <span ref={tipPill} className={styles.pill} />
        <div ref={tipRow} className={styles.tipR} />
      </div>
    </>
  );
}
