"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type Profile = components["schemas"]["ProfileResponse"];
type Preferences = components["schemas"]["NotificationPreferenceResponse"];

const preferenceFields: Array<[keyof Preferences, string]> = [
  ["rentDueEnabled", "Vade günü hatırlatması"],
  ["overdueRentEnabled", "Gecikmiş kira"],
  ["leaseEndEnabled", "Sözleşme bitişi"],
  ["rentAnniversaryEnabled", "Kira yıl dönümü"],
];

function requestError(status: number, noun: string) {
  if (status === 401) return `${noun} görmek için giriş yapın.`;
  if (status === 502 || status === 503)
    return `${noun} hizmetine şu anda ulaşılamıyor. Bağlantıyı kontrol edip yeniden deneyin.`;
  return `${noun} alınamadı. Yeniden deneyin.`;
}

export function SettingsDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResponse, preferencesResponse] = await Promise.all([
        fetch("/api/bff/me/profile", { cache: "no-store" }),
        fetch("/api/bff/me/notification-preferences", { cache: "no-store" }),
      ]);
      if (!profileResponse.ok) throw new Error(requestError(profileResponse.status, "Profil"));
      if (!preferencesResponse.ok)
        throw new Error(requestError(preferencesResponse.status, "Bildirim tercihleri"));
      const [nextProfile, nextPreferences] = await Promise.all([
        profileResponse.json() as Promise<Profile>,
        preferencesResponse.json() as Promise<Preferences>,
      ]);
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName ?? "");
      setPreferences(nextPreferences);
    } catch (cause) {
      setProfile(null);
      setPreferences(null);
      setError(cause instanceof Error ? cause.message : "Ayarlar alınamadı. Yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/bff/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Profili düzenlemek için giriş yapın."
            : response.status === 400
              ? "Görünen ad 1–200 karakter olmalıdır."
              : requestError(response.status, "Profil"),
        );
      const saved = (await response.json()) as Profile;
      setProfile(saved);
      setDisplayName(saved.displayName ?? "");
      setStatus("Profil kaydedildi.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profil kaydedilemedi.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences) return;
    setSavingPreferences(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/bff/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Bildirim tercihlerini düzenlemek için giriş yapın."
            : response.status === 400
              ? "E-posta bildirimleri için e-posta adresinizi doğrulayın."
              : requestError(response.status, "Bildirim tercihleri"),
        );
      setPreferences((await response.json()) as Preferences);
      setStatus("Bildirim tercihleri kaydedildi.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bildirim tercihleri kaydedilemedi.");
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="settings-title">
      <div>
        <h1 id="settings-title" className="text-2xl font-semibold tracking-tight">
          Ayarlar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil bilgileri ve bildirim tercihleri</p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-card p-4 text-sm"
        >
          <p>{error}</p>
          {error.includes("giriş yapın") && (
            <Link href="/giris" className="underline">
              Giriş yap
            </Link>
          )}
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
            Yeniden dene
          </Button>
        </div>
      )}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {loading && <ListSkeleton label="Ayarlar yükleniyor…" />}
      {!loading && profile && preferences && (
        <>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-lg font-semibold">Profil bilgileri</h2>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                <label className="grid gap-1 text-sm">
                  Görünen ad
                  <input
                    aria-label="Görünen ad"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    minLength={1}
                    maxLength={200}
                    className="h-11 rounded-md border bg-background px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  E-posta adresi
                  <input
                    aria-label="E-posta adresi"
                    value={profile.email ?? ""}
                    readOnly
                    className="h-11 rounded-md border bg-muted px-3"
                  />
                </label>
                <p className="text-sm text-muted-foreground">
                  {profile.emailConfirmed ? "E-posta doğrulandı." : "E-posta doğrulanmadı."}
                </p>
                <Button
                  type="submit"
                  disabled={savingProfile || !displayName.trim()}
                  className="sm:justify-self-end"
                >
                  {savingProfile ? "Kaydediliyor…" : "Profili kaydet"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-lg font-semibold">Bildirim tercihleri</h2>
              <form className="grid gap-4" onSubmit={savePreferences}>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    aria-label="E-posta bildirimleri"
                    checked={preferences.emailEnabled}
                    disabled={!profile.emailConfirmed}
                    onChange={(event) =>
                      setPreferences(
                        (current) => current && { ...current, emailEnabled: event.target.checked },
                      )
                    }
                  />
                  <span>
                    E-posta bildirimleri
                    {!profile.emailConfirmed && (
                      <span className="mt-1 block text-muted-foreground">
                        E-posta doğrulanmadan e-posta bildirimleri açılamaz.
                      </span>
                    )}
                  </span>
                </label>
                {preferenceFields.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={preferences[key]}
                      aria-label={label}
                      onChange={(event) =>
                        setPreferences((current) => current && { ...current, [key]: event.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
                <Button type="submit" disabled={savingPreferences} className="sm:justify-self-end">
                  {savingPreferences ? "Kaydediliyor…" : "Tercihleri kaydet"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
