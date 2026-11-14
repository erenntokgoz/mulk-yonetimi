import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mülküm",
  description: "Mülk, kiracı ve kira takibi",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Kayıtlı temayı ilk boyamadan önce uygular; kayıt yoksa koyu tema varsayılandır.
const themeScript = `try{var t=localStorage.getItem("mulk-theme");document.documentElement.classList.toggle("dark",t!=="light");if(localStorage.getItem("mulk-sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
