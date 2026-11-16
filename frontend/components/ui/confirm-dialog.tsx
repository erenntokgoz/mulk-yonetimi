"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** Verilirse onay öncesi zorunlu gerekçe alanı gösterilir ve girilen metin döner. */
  reasonLabel?: string;
  destructive?: boolean;
};

type Request = ConfirmOptions & { resolve: (value: string | null) => void };

// Tarayıcının confirm/prompt pencereleri yerine erişilebilir onay penceresi.
// ask() vazgeçildiğinde null, onaylandığında gerekçe metnini (gerekçe yoksa boş metin) döner.
export function useConfirmDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const [reason, setReason] = useState("");
  const settled = useRef(false);

  const ask = useCallback((options: ConfirmOptions) => new Promise<string | null>((resolve) => {
    settled.current = false;
    setReason("");
    setRequest({ ...options, resolve });
  }), []);

  function close(value: string | null) {
    if (!request || settled.current) return;
    settled.current = true;
    request.resolve(value);
    setRequest(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request?.reasonLabel && !reason.trim()) return;
    close(request?.reasonLabel ? reason.trim() : "");
  }

  const dialog = (
    <DialogPrimitive.Root open={!!request} onOpenChange={(open) => { if (!open) close(null); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-scrim="" className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content className="confirm-dialog">
          {request && (
            <form onSubmit={submit} className="grid gap-5">
              <DialogPrimitive.Title className="text-lg font-semibold leading-snug">{request.title}</DialogPrimitive.Title>
              {request.description ? (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">{request.description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{request.confirmLabel}</DialogPrimitive.Description>
              )}
              {request.reasonLabel && (
                <label className="grid gap-2 text-sm font-medium">
                  {request.reasonLabel}
                  <textarea
                    name="reason"
                    required
                    autoFocus
                    maxLength={500}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-base sm:text-sm"
                  />
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => close(null)}>
                  Vazgeç
                </Button>
                <Button type="submit" variant={request.destructive ? "destructive" : "default"} autoFocus={!request.reasonLabel}
                  disabled={!!request.reasonLabel && !reason.trim()}>
                  {request.confirmLabel}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );

  return { ask, dialog };
}
