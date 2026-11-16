import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Mülküm",
  description: "Mülkünüzü, kiracınızı ve her ayın kirasını tek hesapta tutarsınız. Kira gecikirse size e-posta gelir.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Kayıtlı temayı ilk boyamadan önce uygular; kayıt yoksa koyu tema varsayılandır.
const themeScript = `try{var t=localStorage.getItem("mulk-theme");var d=document.documentElement;d.classList.toggle("dark",t!=="light");if(t==="light")d.dataset.theme="light";else delete d.dataset.theme;if(localStorage.getItem("mulk-sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
