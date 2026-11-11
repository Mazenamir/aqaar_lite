"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  LogOut
} from "lucide-react";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "COMPANY_ADMIN" | "SALES_AGENT" | "ACCOUNTANT";
  companyName: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      router.push("/login");
    }
  };

  const getRoleLabel = (role?: string) => {
    if (role === "COMPANY_ADMIN") return "مدير الشركة";
    if (role === "ACCOUNTANT") return "محاسب مالي";
    if (role === "SALES_AGENT") return "مندوب مبيعات";
    return "مستخدم";
  };

  const navigationItems = [
    { name: "الوحدات العقارية", href: "/units", icon: Building2 },
    { name: "إدارة العملاء", href: "/clients", icon: Users },
    { name: "العقود والأقساط", href: "/contracts", icon: FileText },
    { name: "المدفوعات والتحصيل", href: "/payments", icon: CreditCard },
    ...(user?.role === "COMPANY_ADMIN"
      ? [{ name: "سجل العمليات والرقابة", href: "/audit", icon: ShieldCheck }]
      : []),
  ];

  return (
    <aside className="fixed right-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-l border-outline-variant/30">
      <div className="flex flex-col">
        {/* Logo & Brand Header */}
        <div className="p-6 flex items-center gap-3 bg-surface-container-lowest border-b border-surface-container-low">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary font-bold text-lg shadow-sm">
            ع
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-primary tracking-tight">عقار لايت</span>
            <span className="text-xs text-on-surface-variant font-medium">
              {user?.companyName || "إدارة المبيعات والأقساط"}
            </span>
          </div>
        </div>

        {/* Current Role Card */}
        <div className="px-4 py-3">
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
              <div className="flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">الدور الحالي</span>
                <span className="text-xs text-on-surface font-semibold">{getRoleLabel(user?.role)}</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed-dim text-primary font-bold font-mono">
              RBAC
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 px-3 mt-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/units" && pathname === "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary-container text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-on-primary" : "text-on-surface-variant"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Logout */}
      <div className="p-4 flex flex-col gap-2 bg-surface-container-lowest border-t border-surface-container-low">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse"></span>
            <span className="text-xs text-on-surface-variant font-medium">نظام متصل وموثق</span>
          </div>
          <span className="font-mono text-xs text-on-surface-variant">v2.4</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-error text-xs font-semibold rounded-xl hover:bg-error-container hover:text-on-error transition-all text-right w-full"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج الآمن</span>
        </button>
      </div>
    </aside>
  );
}
