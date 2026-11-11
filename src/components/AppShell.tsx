"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string, href: string) => void;
  breadcrumbTitle?: string;
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-surface">{children}</main>;
  }

  return (
    <div
      className="min-h-screen w-full bg-[#eaefec] flex items-center justify-center p-3 sm:p-5 lg:p-6 relative overflow-hidden font-sans"
    >
      {/* Ambient background pastel shapes (matching mockup corners) */}
      <div className="absolute -top-28 -left-28 w-96 h-96 bg-[#d9f99d]/35 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-[#fed7aa]/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#bbf7d0]/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Rounded Tablet/Dashboard Container (Docked dark sidebar on the left, white canvas on the right) */}
      <div
        dir="ltr"
        className="w-full max-w-[1640px] min-h-[94vh] bg-[#fbfcfd] rounded-[36px] sm:rounded-[44px] lg:rounded-[48px] shadow-[0_25px_80px_-20px_rgba(0,33,23,0.12)] border border-white/80 flex flex-col sm:flex-row relative z-10 overflow-hidden"
      >
        {/* Sleek Docked Capsule Dark Sidebar on the Left */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

        {/* Dashboard Main Workspace on the Right with RTL content */}
        <main
          dir="rtl"
          className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#fbfcfd]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
