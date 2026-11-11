"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbTitle?: string;
}

export function AppShell({ children, breadcrumbTitle }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-surface">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <Header breadcrumbTitle={breadcrumbTitle} />
      <main className="pr-72 pt-16 min-h-screen px-8 py-6">
        {children}
      </main>
    </div>
  );
}
