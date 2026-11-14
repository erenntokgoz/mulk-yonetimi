import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { ThemeControl } from "@/components/theme-control";
import styles from "@/components/auth-shell.module.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <div className={styles.theme}><ThemeControl /></div>
    <aside className={styles.brand} aria-label="Mülk Yönetimi">
      <div className={styles.identity}><span className={styles.mark}><Building2 size={18} aria-hidden="true" /></span><span>Mülk Yönetimi</span></div>
      <div className={styles.drawing} aria-hidden="true">
        <svg viewBox="0 0 480 390" role="presentation">
          <path d="M42 76h136v64h74V76h186v235H321v-62h-69v93H42z" />
          <path d="M61 95h99v27h111V95h147v197H340v-62H234v93H61z" className={styles.soft} />
          <path d="M178 76v64m74-64v64m69 109v62m-87-62v62M42 202h69v-62m0 0v-45m116 45v67m0 0h74m-74 0v-67" />
          <path d="M127 140h32m-32 0v38m106 24v-32m0 32h-39m126-94v47m0 0h46" className={styles.accent} />
          <path d="M42 54V36h18m360 0h18v18M42 333v18h18m360 0h18v-18" className={styles.soft} />
          <circle cx="127" cy="140" r="3" className={styles.accent} /><circle cx="233" cy="202" r="3" className={styles.accent} />
          <line x1="42" y1="24" x2="438" y2="24" className={styles.soft} /><line x1="24" y1="76" x2="24" y2="311" className={styles.soft} />
          <path d="M215 17l8 7-8 7m-183 99 7 8 7-8" className={styles.soft} />
        </svg>
      </div>
      <div className={styles.caption}><strong>Mülk kayıtları, tek bir yerde.</strong><span>Portföyünüze güvenli erişim için hesabınızla devam edin.</span></div>
    </aside>
    <div className={styles.formRegion}>{children}</div>
  </div>;
}
