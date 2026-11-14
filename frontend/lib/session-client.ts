"use client";

import { useEffect, useState } from "react";

// Oturum durumu sayfalar arasında paylaşılır; aynı sekmede /api/bff/me tekrar tekrar çağrılmaz.
let sessionState: boolean | null = null;
let sessionRequest: Promise<boolean> | null = null;

function loadSession(): Promise<boolean> {
  sessionRequest ??= fetch("/api/bff/me", { cache: "no-store" }).then((response) => response.ok).catch(() => false)
    .then((ok) => { sessionState = ok; sessionRequest = null; return ok; });
  return sessionRequest;
}

export function setSessionState(ok: boolean) { sessionState = ok; }

/** null: henüz bilinmiyor; true/false: oturum açık/kapalı. */
export function useSessionState() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const apply = (ok: boolean) => { if (active) setSignedIn(ok); };
    if (sessionState !== null) apply(sessionState); else void loadSession().then(apply);
    return () => { active = false; };
  }, []);
  return [signedIn, setSignedIn] as const;
}
