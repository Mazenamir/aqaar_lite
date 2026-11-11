import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
});

export const metadata: Metadata = {
  title: "عقار لايت | نظام بيع الوحدات العقارية بالتقسيط",
  description: "نظام عقار لايت المطور لشركة الريادة الخضراء - إدارة الوحدات والعملاء والعقود بالتقسيط",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable}>
      <body className="bg-surface font-sans text-on-surface antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
