"use client";

import { ComponentProps, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "@/components/auth-shell.module.css";

type Props = Omit<ComponentProps<"input">, "type">;

// The toggle's name comes from sr-only text, not aria-label, so getByLabel("Parola") still resolves to the input only.
export function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <span className={styles.inp}>
      <input {...props} type={visible ? "text" : "password"} className={`${styles.input} ${className}`} />
      <button type="button" aria-pressed={visible} onClick={() => setVisible((v) => !v)} className={styles.eye}>
        <Icon aria-hidden="true" />
        <span className="sr-only">{visible ? "Parolayı gizle" : "Parolayı göster"}</span>
      </button>
    </span>
  );
}
