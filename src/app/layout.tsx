import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ar" dir="rtl">
      <body className="bg-surface font-sans text-on-surface antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
