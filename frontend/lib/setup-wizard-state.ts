"use client";

import { useSyncExternalStore } from "react";

// "hidden": kullanıcı sihirbazı gizledi, "shown": Kurulum düğmesiyle yeniden açtı, null: otomatik.
export type WizardPreference = "hidden" | "shown" | null;

const storageKey = "mulk.setup-wizard";
const changeEvent = "mulk:setup-wizard";

function read(): WizardPreference {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "hidden" || value === "shown" ? value : null;
  } catch {
    return null;
  }
}

export function setWizardPreference(value: Exclude<WizardPreference, null>) {
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Depolama kapalıysa tercih yalnız bu sayfa ömrü boyunca geçerli olur.
  }
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useWizardPreference(): WizardPreference {
  return useSyncExternalStore(subscribe, read, () => null);
}
