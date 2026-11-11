"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbTitle?: string;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-surface">{children}</main>;
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#eaefec] flex items-center justify-center p-2 sm:p-4 lg:p-6 relative overflow-hidden font-sans"
    >
      {/* Ambient background pastel shapes (like in the mockup corners) */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#d9f99d]/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#fed7aa]/35 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Rounded Tablet/Dashboard Container */}
      <div className="w-full max-w-[1640px] min-h-[94vh] bg-[#fbfcfd] rounded-[32px] sm:rounded-[40px] lg:rounded-[48px] shadow-[0_20px_70px_-15px_rgba(0,0,0,0.07)] p-3 sm:p-5 lg:p-6 border border-white/80 flex flex-col md:flex-row gap-5 relative z-10">
        {/* Sleek Capsule Dark Sidebar */}
        <Sidebar />

        {/* Dashboard Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
