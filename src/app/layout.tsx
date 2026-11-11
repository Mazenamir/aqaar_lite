import type { Metadata } from "next";
import { Alexandria, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-alexandria",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
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
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${plusJakartaSans.variable}`}>
      <body className="bg-surface font-sans text-on-surface antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
