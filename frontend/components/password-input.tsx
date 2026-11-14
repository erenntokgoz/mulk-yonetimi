"use client";

import { ComponentProps, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<ComponentProps<"input">, "type">;

// The toggle's name comes from sr-only text, not aria-label, so getByLabel("Parola") still resolves to the input only.
export function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`h-11 w-full rounded-md border bg-background px-3 pr-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      />
      <button
        type="button"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">{visible ? "Parolayı gizle" : "Parolayı göster"}</span>
      </button>
    </span>
  );
}
