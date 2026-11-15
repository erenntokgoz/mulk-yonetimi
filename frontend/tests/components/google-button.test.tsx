import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleButton, GoogleSignInError } from "../../components/auth-ui";
import { loginMessages } from "../../lib/login-messages";

let search = "";
const navigation = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => navigation.router,
}));

describe("Google sign-in button", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
    navigation.router.push.mockReset();
    navigation.router.replace.mockReset();
    navigation.router.refresh.mockReset();
    search = "";
  });

  it("is not rendered without NEXT_PUBLIC_GOOGLE_AUTH=1", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "");
    render(<GoogleButton />);
    expect(screen.queryByRole("link", { name: "Google ile devam et" })).toBeNull();
    expect(screen.queryByText("ya da")).toBeNull();
    cleanup();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "true");
    render(<GoogleButton />);
    expect(screen.queryByRole("link", { name: "Google ile devam et" })).toBeNull();
  });

  it("links to the BFF start route and carries only a safe next path", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href"))
      .toBe("/api/bff/auth/google?popup=1");
    cleanup();
    search = "?next=%2Fkiracilar%3Fdurum%3Daktif";
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href"))
      .toBe("/api/bff/auth/google?popup=1&next=%2Fkiracilar%3Fdurum%3Daktif");
    cleanup();
    search = "?next=%2F%2Fevil.example";
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href"))
      .toBe("/api/bff/auth/google?popup=1");
  });

  it("shows the callback error with the same pending text as password login", () => {
    search = "?hata=onay";
    render(<GoogleSignInError />);
    expect(screen.getByRole("alert").textContent).toBe(loginMessages.pending);
    cleanup();
    search = "?hata=bilinmeyen";
    render(<GoogleSignInError />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not assume a Google-rejected address already has an account", () => {
    search = "?hata=google-hesap";
    render(<GoogleSignInError />);
    expect(screen.getByRole("alert").textContent)
      .toBe("Bu e-posta adresiyle Google girişi kullanılamıyor. E-posta ve parolayla devam edin.");
  });

  it("accepts popup results only from the exact opened window and same origin", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    render(<GoogleButton />);
    const link = screen.getByRole("link", { name: "Google ile devam et" });
    expect(fireEvent.click(link)).toBe(false);
    expect(open).toHaveBeenCalledWith(expect.stringContaining("popup=1"), "mulk-google-auth", expect.any(String));

    const result = { type: "mulk-google-auth-result", status: "success", next: "/kiracilar" };
    act(() => window.dispatchEvent(new MessageEvent("message", {
      data: result,
      origin: "https://evil.example",
      source: popup,
    })));
    act(() => window.dispatchEvent(new MessageEvent("message", {
      data: result,
      origin: window.location.origin,
      source: { closed: false } as Window,
    })));
    expect(navigation.router.replace).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new MessageEvent("message", {
      data: result,
      origin: window.location.origin,
      source: popup,
    })));
    expect(navigation.router.replace).toHaveBeenCalledWith("/kiracilar");
    expect(navigation.router.refresh).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it("keeps the ordinary full-page link when the browser blocks a popup", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<GoogleButton />);
    let preventedByLink = false;
    window.addEventListener("click", (event) => {
      preventedByLink = event.defaultPrevented;
      event.preventDefault();
    }, { once: true });
    fireEvent.click(screen.getByRole("link", { name: "Google ile devam et" }));
    expect(preventedByLink).toBe(false);
    expect(open).toHaveBeenCalledOnce();
  });

  it("shows a popup failure in the main page without exposing a code", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<GoogleButton />);
    fireEvent.click(screen.getByRole("link", { name: "Google ile devam et" }));
    act(() => window.dispatchEvent(new MessageEvent("message", {
      data: { type: "mulk-google-auth-result", status: "error", error: "onay", code: "secret-code" },
      origin: window.location.origin,
      source: popup,
    })));
    expect(screen.getByRole("alert").textContent).toBe("Hesabınız pilot onayı bekliyor. Onaylandıktan sonra giriş yapabilirsiniz.");
    expect(screen.queryByText("secret-code")).toBeNull();
  });

  it("shows an accessible error when the user closes the popup", () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    let closed = false;
    vi.spyOn(window, "open").mockReturnValue({
      get closed() { return closed; },
      close: vi.fn(),
      focus: vi.fn(),
    } as unknown as Window);
    render(<GoogleButton />);
    fireEvent.click(screen.getByRole("link", { name: "Google ile devam et" }));
    closed = true;
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("alert").textContent).toBe("Google giriş penceresi kapatıldı. Yeniden deneyin.");
    vi.useRealTimers();
  });
});
