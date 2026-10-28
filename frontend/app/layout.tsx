import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mülk Yönetimi",
  description: "Mülk yönetimi çalışma alanı",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
