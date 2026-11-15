import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleButton, GoogleSignInError } from "../../components/auth-ui";
import { loginMessages } from "../../lib/login-messages";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

describe("Google sign-in button", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
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
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href")).toBe("/api/bff/auth/google");
    cleanup();
    search = "?next=%2Fkiracilar%3Fdurum%3Daktif";
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href"))
      .toBe("/api/bff/auth/google?next=%2Fkiracilar%3Fdurum%3Daktif");
    cleanup();
    search = "?next=%2F%2Fevil.example";
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: "Google ile devam et" }).getAttribute("href")).toBe("/api/bff/auth/google");
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
});
