"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Users, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  LogOut,
  User,
  Home,
  Clock,
  Calendar
} from "lucide-react";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "COMPANY_ADMIN" | "SALES_AGENT" | "ACCOUNTANT";
  companyName: string;
}

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string, href: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
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
    { id: "units", name: "الوحدات العقارية", href: "/units", icon: Home },
    { id: "clients", name: "إدارة العملاء", href: "/clients", icon: Users },
    { id: "reservations", name: "إدارة الحجوزات", href: "/reservations", icon: Clock },
    { id: "contracts", name: "العقود والاتفاقيات", href: "/contracts", icon: FileText },
    { id: "installments", name: "جدول الأقساط", href: "/installments", icon: Calendar },
    { id: "payments", name: "المدفوعات والتحصيل", href: "/payments", icon: CreditCard },
    ...(user?.role === "COMPANY_ADMIN"
      ? [{ id: "audit", name: "سجل العمليات والرقابة", href: "/audit", icon: ShieldCheck }]
      : []),
  ];

  return (
    <aside className="w-full sm:w-[84px] sm:min-w-[84px] bg-[#002117] text-white py-6 sm:py-8 flex sm:flex-col justify-between items-center shrink-0 z-30 transition-all select-none self-stretch">
      {/* Top: Geometric Polygon / Emerald Emblem (Mockup logo style) */}
      <div className="flex flex-col items-center px-3">
        <Link
          href="/units"
          onClick={(e) => {
            if (onTabChange) {
              e.preventDefault();
              onTabChange("units", "/units");
            }
          }}
          className="w-12 h-12 rounded-full bg-[#031810] border border-emerald-500/20 flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
          title="عقار لايت"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 3.3L17.5 8 12 11.4 6.5 8 12 5.3zm-6 4.4l5 3.1v5.9l-5-3.1v-5.9zm7 9v-5.9l5-3.1v5.9l-5 3.1z" />
          </svg>
        </Link>
      </div>

      {/* Middle: Navigation Items with Dribbble Scooped Tab Wave Curve */}
      <nav className="w-full flex sm:flex-col items-center gap-1.5 my-auto py-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab
            ? activeTab === item.id
            : pathname === item.href || (item.href === "/units" && pathname === "/");

          if (isActive) {
            return (
              <div
                key={item.href}
                className="relative w-full flex items-center justify-center sm:justify-end my-1"
              >
                {/* Active White Tab that merges into main content on the right */}
                <div className="relative w-full h-14 flex items-center justify-center bg-[#fbfcfd] sm:rounded-l-[28px] sm:rounded-r-none z-20">
                  {/* Icon centered inside the white scooped tab */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#002117] hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6 text-[#002117]" />
                  </div>

                  {/* Top concave fillet (scoop curve) */}
                  <svg
                    className="hidden sm:block absolute -top-6 right-0 w-6 h-6 pointer-events-none fill-[#fbfcfd]"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24,0 C24,13.255 13.255,24 0,24 H24 V0 Z" />
                  </svg>

                  {/* Bottom concave fillet (scoop curve) */}
                  <svg
                    className="hidden sm:block absolute -bottom-6 right-0 w-6 h-6 pointer-events-none fill-[#fbfcfd]"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24,24 C24,10.745 13.255,0 0,0 H24 V24 Z" />
                  </svg>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (onTabChange) {
                  e.preventDefault();
                  onTabChange(item.id, item.href);
                }
              }}
              title={item.name}
              className="relative group w-12 h-12 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <Icon className="w-5 h-5" />

              {/* Tooltip on hover */}
              <span className="hidden sm:group-hover:flex absolute left-20 px-3 py-1.5 rounded-xl bg-[#003527] text-white text-xs font-semibold whitespace-nowrap shadow-xl border border-emerald-700/40 z-50 pointer-events-none animate-in fade-in zoom-in-95 font-sans">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User Avatar & Logout */}
      <div className="flex sm:flex-col items-center gap-3 px-3">
        <div
          className="relative group w-10 h-10 rounded-full bg-white text-[#002117] flex items-center justify-center font-bold text-xs shadow-md border-2 border-emerald-400/40 cursor-pointer"
          title={`${user?.name || "المستخدم"} (${getRoleLabel(user?.role)})`}
        >
          <User className="w-5 h-5 text-[#002117]" />
          {/* Active status indicator dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#002117] rounded-full"></span>

          {/* User profile tooltip */}
          <div className="hidden sm:group-hover:flex flex-col absolute left-14 bottom-0 p-3 rounded-2xl bg-[#003527] text-white text-xs whitespace-nowrap shadow-2xl border border-emerald-700/40 z-50 pointer-events-none font-sans">
            <span className="font-bold">{user?.name || "المستخدم"}</span>
            <span className="text-[10px] text-emerald-300 font-medium">{getRoleLabel(user?.role)}</span>
            <span className="text-[10px] text-emerald-400/80 font-mono mt-0.5">{user?.companyName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="تسجيل الخروج الآمن"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
