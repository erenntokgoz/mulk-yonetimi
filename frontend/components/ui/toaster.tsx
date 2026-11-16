"use client";

import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { getServerToasts, getToasts, subscribe, toast, type ToastItem, type ToastKind } from "@/lib/toast";

const icons: Record<ToastKind, typeof Info> = { success: CircleCheck, error: CircleAlert, info: Info };
const swipeThreshold = 72;

// Görsel yığın odak almadan klavyeyle gezilebilir; ekran okuyucu duyurusu ayrı canlı bölgelerden yalnız mesaj metniyle yapılır.
export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getServerToasts);
  const returnFocus = useRef<HTMLElement | null>(null);
  const stack = useRef<HTMLDivElement>(null);
  const polite = toasts.filter((item) => item.kind !== "error" && !item.closing);
  const assertive = toasts.filter((item) => item.kind === "error" && !item.closing);

  function close(item: ToastItem) {
    const container = stack.current;
    const hadFocus = !!container?.querySelector(`[data-toast-id="${item.id}"]`)?.contains(document.activeElement);
    toast.dismiss(item.id);
    if (!hadFocus || !container) return;
    // Kapatılan mesaj odaktaysa odak sıradaki mesaja, yoksa mesajlara girmeden önceki yere döner.
    const next = [...container.querySelectorAll<HTMLElement>("[data-toast-id]")].find(
      (element) => element.dataset.toastId !== item.id && element.dataset.closing !== "true",
    );
    const target = next?.querySelector<HTMLElement>("[data-toast-close]") ?? returnFocus.current;
    target?.focus({ preventScroll: true });
  }

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="false" data-toast-live="polite">
        {polite.map((item) => (
          <p key={item.id}>{announcement(item)}</p>
        ))}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="false" data-toast-live="assertive">
        {assertive.map((item) => (
          <p key={item.id}>{announcement(item)}</p>
        ))}
      </div>
      <section
        ref={stack}
        aria-label="İşlem mesajları"
        className="toaster"
        onFocusCapture={(event) => {
          const from = event.relatedTarget;
          if (from instanceof HTMLElement && !stack.current?.contains(from)) returnFocus.current = from;
        }}
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => close(item)} />
        ))}
      </section>
    </>
  );
}

function announcement(item: ToastItem) {
  return item.action ? `${item.message} ${item.action.label} bağlantısı var.` : item.message;
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = icons[item.kind];
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; dx: number; pointer: number } | null>(null);
  const hovered = useRef(false);
  const focused = useRef(false);

  useEffect(() => () => toast.resume(item.id), [item.id]);

  function sync() {
    if (hovered.current || focused.current) toast.pause(item.id);
    else toast.resume(item.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    drag.current = { x: event.clientX, dx: 0, pointer: event.pointerId };
    toast.pause(item.id);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId || !card.current) return;
    state.dx = event.clientX - state.x;
    card.current.style.setProperty("--swipe", `${state.dx}px`);
    card.current.dataset.swiping = "true";
  }

  function onPointerEnd() {
    const state = drag.current;
    drag.current = null;
    if (!state || !card.current) return;
    delete card.current.dataset.swiping;
    if (Math.abs(state.dx) >= swipeThreshold) {
      card.current.dataset.swiped = state.dx > 0 ? "right" : "left";
      onClose();
      return;
    }
    card.current.style.removeProperty("--swipe");
    sync();
  }

  return (
    <div
      ref={card}
      className="toast glass"
      data-kind={item.kind}
      data-toast-id={item.id}
      data-closing={item.closing ? "true" : undefined}
      onKeyDown={onKeyDown}
      onMouseEnter={() => {
        hovered.current = true;
        sync();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        sync();
      }}
      onFocus={() => {
        focused.current = true;
        sync();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        sync();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="toast-message">{item.message}</p>
      {item.action &&
        (item.action.href ? (
          <Link href={item.action.href} className="toast-action" onClick={onClose}>
            {item.action.label}
          </Link>
        ) : (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              item.action?.onClick?.();
              onClose();
            }}
          >
            {item.action.label}
          </button>
        ))}
      <button type="button" className="toast-close" aria-label="Mesajı gizle" data-toast-close onClick={onClose}>
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
