"use client";

import { useEffect, useState } from "react";
import { 
  Home, 
  ChevronLeft, 
  Building
} from "lucide-react";

interface HeaderProps {
  breadcrumbTitle?: string;
}

export function Header({ breadcrumbTitle = "الوحدات العقارية" }: HeaderProps) {
  const [userName, setUserName] = useState("المستخدم");
  const [roleLabel, setRoleLabel] = useState("جاري التحميل...");
  const [companyName, setCompanyName] = useState("الشركة");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUserName(data.user.name);
          setCompanyName(data.user.companyName);
          if (data.user.role === "COMPANY_ADMIN") setRoleLabel("مدير الشركة");
          else if (data.user.role === "ACCOUNTANT") setRoleLabel("محاسب مالي");
          else if (data.user.role === "SALES_AGENT") setRoleLabel("مندوب مبيعات");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 right-72 left-0 h-16 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-8 border-b border-outline-variant/20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs font-semibold">
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="text-on-surface font-semibold">{breadcrumbTitle}</span>
        </div>
      </div>

      {/* Right Section: Tenant Badge & User Profile */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-medium border border-outline-variant/20">
          <Building className="w-4 h-4 text-secondary" />
          <span className="font-semibold">{companyName}</span>
        </div>

        <div className="flex items-center gap-3 pr-2 border-r border-outline-variant/30">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-on-surface">{userName}</span>
            <span className="text-[11px] text-secondary font-medium">{roleLabel}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
            {userName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
