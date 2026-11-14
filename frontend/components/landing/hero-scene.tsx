"use client";

import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

const LAYERS = 14;

// Marka işaretinin ("iki çatı M") izometrik, katman katman çıkıntılı hali. Yalnızca CSS 3B dönüşümü kullanır.
// Ekran dışındayken veya sekme gizliyken animasyon duraklar; azaltılmış harekette sabit durur (CSS).
export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    const sync = () => el.toggleAttribute("data-paused", !visible || document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div ref={ref} className={styles.scene} aria-hidden="true" data-testid="hero-scene">
      <div className={styles.stage}>
        <div className={styles.plate} />
        {Array.from({ length: LAYERS }, (_, i) => (
          <svg
            key={i}
            viewBox="0 0 64 64"
            className={styles.layer}
            style={{ "--i": i } as React.CSSProperties}
          >
            <path d="M12 48 L12 27 L22 17 L32 27 L42 17 L52 27 L52 48" />
            {i === LAYERS - 1 && <path d="M32 27 L32 48" className={styles.topCore} />}
          </svg>
        ))}
      </div>
    </div>
  );
}
