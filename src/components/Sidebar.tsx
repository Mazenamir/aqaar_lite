"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  LogOut,
  UserCheck
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
    <aside className="w-full md:w-20 bg-[#002117] text-white rounded-[28px] md:rounded-[36px] py-6 px-3 flex md:flex-col justify-between items-center shadow-xl shrink-0 z-30 transition-all border border-emerald-950/40 md:self-stretch">
      {/* Top: Brand Logo Circle */}
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/units"
          className="w-12 h-12 rounded-full bg-white text-[#002117] flex items-center justify-center font-bold text-xl shadow-md hover:scale-105 transition-transform"
          title="عقار لايت"
        >
          <Building2 className="w-6 h-6 text-[#064e3b]" />
        </Link>
      </div>

      {/* Middle: Vertical Navigation Icons */}
      <nav className="flex md:flex-col items-center gap-3 my-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === "/units" && pathname === "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.name}
              className={`relative group w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isActive
                  ? "bg-white text-[#003527] shadow-lg shadow-black/20 scale-105"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5" />

              {/* Hover Tooltip (RTL Aware) */}
              <span className="hidden md:group-hover:flex absolute right-16 px-3 py-1.5 rounded-xl bg-[#003527] text-white text-xs font-semibold whitespace-nowrap shadow-xl border border-emerald-700/40 z-50 pointer-events-none animate-in fade-in zoom-in-95">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User Avatar & Logout */}
      <div className="flex md:flex-col items-center gap-3">
        <div
          className="relative group w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shadow-inner border border-emerald-600/30 cursor-pointer"
          title={`${user?.name || "المستخدم"} (${getRoleLabel(user?.role)})`}
        >
          <UserCheck className="w-5 h-5 text-emerald-200" />

          {/* User profile tooltip */}
          <div className="hidden md:group-hover:flex flex-col absolute right-14 bottom-0 p-3 rounded-2xl bg-[#003527] text-white text-xs whitespace-nowrap shadow-2xl border border-emerald-700/40 z-50 pointer-events-none">
            <span className="font-bold">{user?.name || "المستخدم"}</span>
            <span className="text-[10px] text-emerald-300 font-medium">{getRoleLabel(user?.role)}</span>
            <span className="text-[10px] text-emerald-400/80 font-mono mt-0.5">{user?.companyName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="تسجيل الخروج الآمن"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
