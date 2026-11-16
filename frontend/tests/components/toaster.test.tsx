import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../../components/ui/toaster";
import { resetToasts, toast, toastExitMs } from "../../lib/toast";

describe("Toaster", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToasts();
  });
  afterEach(() => {
    act(() => resetToasts());
    cleanup();
    vi.useRealTimers();
  });

  it("announces success politely and errors assertively without moving focus", () => {
    const { container } = render(
      <>
        <button type="button">Kaydet</button>
        <Toaster />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Kaydet" });
    trigger.focus();
    act(() => {
      toast.success("Mülk eklendi.", { action: { label: "Sonraki adım", href: "/portfoy?yeni=bolum" } });
      toast.error("Mülk arşivlenemedi.");
    });
    const polite = container.querySelector('[aria-live="polite"]');
    const assertive = container.querySelector('[aria-live="assertive"]');
    expect(polite?.textContent).toBe("Mülk eklendi. Sonraki adım bağlantısı var.");
    expect(assertive?.textContent).toBe("Mülk arşivlenemedi.");
    expect(polite?.textContent).not.toContain("gizle");
    expect(document.activeElement).toBe(trigger);
    const region = screen.getByRole("region", { name: "İşlem mesajları" });
    expect(region.querySelectorAll("[data-toast-id]")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Sonraki adım" }).getAttribute("href")).toBe("/portfoy?yeni=bolum");
    expect(screen.getAllByRole("button", { name: "Mesajı gizle" })).toHaveLength(2);
  });

  it("closes with the close button and with Escape, and pauses while hovered", () => {
    render(<Toaster />);
    act(() => {
      toast.success("Belge yüklendi.");
      toast.info("Tahsilat dosyası indiriliyor.");
    });
    const first = screen.getByText("Belge yüklendi.", { selector: ".toast-message" }).closest("[data-toast-id]") as HTMLElement;
    fireEvent.mouseEnter(first);
    act(() => vi.advanceTimersByTime(10_000));
    expect(first.dataset.closing).toBeUndefined();
    expect(screen.queryByText("Tahsilat dosyası indiriliyor.", { selector: ".toast-message" })).toBeNull();
    fireEvent.mouseLeave(first);

    const close = screen.getAllByRole("button", { name: "Mesajı gizle" })[0];
    close.focus();
    fireEvent.keyDown(close, { key: "Escape" });
    act(() => vi.advanceTimersByTime(toastExitMs));
    expect(screen.queryByText("Belge yüklendi.", { selector: ".toast-message" })).toBeNull();
  });

  it("runs a button action and dismisses the toast", () => {
    const retry = vi.fn();
    render(<Toaster />);
    act(() => {
      toast.error("Tahsilat iptal edilemedi.", { action: { label: "Tekrar dene", onClick: retry } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(retry).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(toastExitMs));
    expect(screen.queryByText("Tahsilat iptal edilemedi.", { selector: ".toast-message" })).toBeNull();
  });
});
