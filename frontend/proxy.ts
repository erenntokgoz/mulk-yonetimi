import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic check only: the API still authorizes every request and returns 401 for invalid or expired sessions.
const SESSION_COOKIE = "mulk.session";
const PUBLIC_PATHS = new Set(["/giris", "/kayit", "/dogrula", "/dogrulama-yeniden-gonder", "/parolami-unuttum", "/parola-sifirla"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL("/giris", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
