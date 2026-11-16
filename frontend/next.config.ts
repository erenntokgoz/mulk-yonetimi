import type { NextConfig } from "next";

// Güvenlik başlıkları tüm rotalara uygulanır. script-src bilerek eklenmez:
// Next'in satır içi betikleri CSP ile kırılmasın; yalnız çerçeve, taban URI,
// nesne ve form hedefi kısıtlanır.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Sağlayıcıdan dönen açılır pencere ana pencereyle bağlantısını korur.
        source: "/api/bff/auth/google/callback",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "unsafe-none" }],
      },
    ];
  },
};

export default nextConfig;
