"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type NotificationItem = components["schemas"]["NotificationItem"];
type NotificationPage = components["schemas"]["NotificationPage"];

export function NotificationDirectory() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async (requestedPage = 1) => {
    setLoading(true);
    setError("");
    setLoadFailed(false);
    try {
      const query = new URLSearchParams({ page: String(requestedPage), pageSize: "25", unreadOnly: String(unreadOnly) });
      const response = await fetch(`/api/bff/notifications?${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Bildirimleri görmek için giriş yapın."
            : response.status === 502 || response.status === 503
              ? "Bildirim hizmetine şu anda ulaşılamıyor. Bağlantıyı kontrol edip yeniden deneyin."
              : "Bildirimler alınamadı. Yeniden deneyin.",
        );
      }
      const page = (await response.json()) as NotificationPage;
      setItems((current) => requestedPage === 1 ? page.items : [...current, ...page.items]);
      setCurrentPage(requestedPage);
      setHasMore(page.hasMore);
    } catch (cause) {
      if (requestedPage === 1) { setItems([]); setLoadFailed(true); }
      setError(cause instanceof Error ? cause.message : "Bildirimler alınamadı. Yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function markRead(item: NotificationItem) {
    setBusyId(item.id);
    setStatus("");
    setError("");
    try {
      const response = await fetch(`/api/bff/notifications/${encodeURIComponent(item.id)}/read`, {
        method: "PATCH",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Bildirimi güncellemek için giriş yapın."
            : "Bildirim okundu olarak işaretlenemedi.",
        );
      setStatus("Bildirim okundu olarak işaretlendi.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bildirim güncellenemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/bff/notifications", { method: "POST" });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Bildirimleri güncellemek için giriş yapın."
            : "Bildirimler okundu olarak işaretlenemedi.",
        );
      setStatus("Bildirimler okundu olarak işaretlendi.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bildirimler güncellenemedi.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="notifications-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="notifications-title" className="text-2xl font-semibold tracking-tight">
            Bildirimler
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Vade, gecikme ve sözleşme hatırlatmaları</p>
        </div>
        {!loadFailed && (
          <Button
            type="button"
            variant="outline"
            disabled={loading || markingAll || items.every((item) => item.readAtUtc)}
            onClick={() => void markAllRead()}
          >
            {markingAll ? "Güncelleniyor…" : "Tümünü okundu işaretle"}
          </Button>
        )}
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
      {!loadFailed && (
        <Card>
          <CardContent className="grid gap-4 p-5">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
              />
              Yalnızca okunmamış
            </label>
            {loading ? (
              <ListSkeleton label="Bildirimler yükleniyor…" />
            ) : items.length ? (
              <ul className="grid gap-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
                  >
                    <div>
                      <h2 className="font-medium">{item.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <time dateTime={item.createdAtUtc}>
                          {new Date(item.createdAtUtc).toLocaleString("tr-TR")}
                        </time>
                      </p>
                    </div>
                    {item.readAtUtc ? (
                      <span className="text-xs text-muted-foreground">Okundu</span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === item.id}
                        onClick={() => void markRead(item)}
                      >
                        Okundu işaretle
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {unreadOnly ? "Okunmamış bildirim yok." : "Görüntülenecek bildirim yok."}
              </p>
            )}
            {hasMore && !loading && <Button type="button" variant="outline"
              onClick={() => void load(currentPage + 1)}>Diğer bildirimleri yükle</Button>}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
