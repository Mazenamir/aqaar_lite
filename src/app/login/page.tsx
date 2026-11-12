"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Lock,
  Mail,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  UserCheck,
  Building,
  KeyRound,
  Loader2,
  Calculator
} from "lucide-react";

interface TestAccount {
  label: string;
  name: string;
  email: string;
  role: "COMPANY_ADMIN" | "ACCOUNTANT" | "SALES_AGENT";
}

interface CompanyGroup {
  id: string;
  name: string;
  shortName: string;
  accounts: TestAccount[];
}

const companyGroups: CompanyGroup[] = [
  {
    id: "greenryad",
    name: "شركة الريادة الخضراء",
    shortName: "الريادة الخضراء",
    accounts: [
      {
        label: "مدير الشركة",
        name: "م. عبدالله التميمي",
        email: "admin@greenryad.sa",
        role: "COMPANY_ADMIN",
      },
      {
        label: "محاسب مالي",
        name: "أ. طارق العسيري",
        email: "accountant@greenryad.sa",
        role: "ACCOUNTANT",
      },
      {
        label: "مسؤول مبيعات 1",
        name: "أحمد المنصور",
        email: "agent1@greenryad.sa",
        role: "SALES_AGENT",
      },
      {
        label: "مسؤول مبيعات 2",
        name: "سارة الدوسري",
        email: "agent2@greenryad.sa",
        role: "SALES_AGENT",
      },
    ],
  },
  {
    id: "horizon",
    name: "شركة الأفق للاستثمار العقاري",
    shortName: "شركة الأفق",
    accounts: [
      {
        label: "مدير الشركة",
        name: "م. خالد القحطاني",
        email: "admin@horizon.sa",
        role: "COMPANY_ADMIN",
      },
      {
        label: "محاسب مالي",
        name: "أ. سعد العتيبي",
        email: "accountant@horizon.sa",
        role: "ACCOUNTANT",
      },
      {
        label: "مسؤول مبيعات 1",
        name: "ريم الشمري",
        email: "agent1@horizon.sa",
        role: "SALES_AGENT",
      },
      {
        label: "مسؤول مبيعات 2",
        name: "فيصل الدوسري",
        email: "agent2@horizon.sa",
        role: "SALES_AGENT",
      },
    ],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedCompanyId, setSelectedCompanyId] = useState("greenryad");
  const [email, setEmail] = useState("admin@greenryad.sa");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);
  const [fastLoadingEmail, setFastLoadingEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const currentCompany = companyGroups.find((c) => c.id === selectedCompanyId) || companyGroups[0]!;

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "بيانات الاعتماد غير صحيحة");
        setLoading(false);
        setFastLoadingEmail(null);
        return;
      }

      router.push("/units");
      router.refresh();
    } catch {
      setErrorMsg("فشل الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      setLoading(false);
      setFastLoadingEmail(null);
    }
  };

  const handleFastAccess = async (acc: TestAccount) => {
    setEmail(acc.email);
    setPassword("Password123!");
    setFastLoadingEmail(acc.email);
    await executeLogin(acc.email, "Password123!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  const getRoleIcon = (role: TestAccount["role"]) => {
    switch (role) {
      case "COMPANY_ADMIN":
        return <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />;
      case "ACCOUNTANT":
        return <Calculator className="w-4 h-4 text-emerald-800 shrink-0" />;
      case "SALES_AGENT":
        return <UserCheck className="w-4 h-4 text-emerald-800 shrink-0" />;
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-br from-[#002117] via-[#064e3b] to-[#043327] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans"
    >
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center z-10">
        
        {/* Left Side: Welcome Brand Messaging */}
        <div className="lg:col-span-5 flex flex-col justify-center text-white px-2 sm:px-4 order-2 lg:order-1">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 mb-8 sm:mb-12">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg shadow-black/10">
              <Building2 className="w-6 h-6 text-primary-fixed" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-white font-mono">عقار لايت</span>
              <span className="text-xs text-emerald-200/80 font-medium">نظام المبيعات والأقساط</span>
            </div>
          </div>

          {/* Greeting Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
            أهلاً بك
          </h1>

          {/* Subheading */}
          <h2 className="text-lg sm:text-xl font-semibold text-primary-fixed mb-4">
            نظام إدارة المبيعات العقارية والتحصيل
          </h2>

          {/* Descriptive Body */}
          <p className="text-emerald-100/75 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
            منصة لإدارة الوحدات وحجوزات العملاء، وصياغة واعتماد العقود ومتابعة تحصيل الدفعات والأقساط.
          </p>

          {/* Highlights */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-emerald-100/90 font-medium">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <Building className="w-4 h-4 text-primary-fixed" />
              <span>إدارة الوحدات والمبيعات</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <KeyRound className="w-4 h-4 text-primary-fixed" />
              <span>العقود وجداول الأقساط</span>
            </span>
          </div>
        </div>

        {/* Right Side: Clean White Card */}
        <div className="lg:col-span-7 flex justify-center order-1 lg:order-2">
          <div className="w-full max-w-[490px] bg-white rounded-[32px] sm:rounded-[36px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] p-7 sm:p-10 flex flex-col justify-between border border-white/80 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Card Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#003527] tracking-tight">
                تسجيل الدخول
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1.5">
                أدخل بيانات حسابك للمتابعة
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2.5 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="البريد الإلكتروني"
                    className="w-full h-12 sm:h-13 px-5 bg-gray-50 hover:bg-gray-100/70 text-gray-900 text-sm rounded-2xl outline-none border border-gray-200 focus:border-[#064e3b] focus:bg-white focus:ring-4 focus:ring-[#064e3b]/10 transition-all placeholder:text-gray-400 font-medium text-right"
                  />
                  <Mail className="w-4 h-4 absolute left-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <div className="relative flex items-center">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-full h-12 sm:h-13 px-5 bg-gray-50 hover:bg-gray-100/70 text-gray-900 text-sm rounded-2xl outline-none border border-gray-200 focus:border-[#064e3b] focus:bg-white focus:ring-4 focus:ring-[#064e3b]/10 transition-all placeholder:text-gray-400 font-medium text-right"
                  />
                  <Lock className="w-4 h-4 absolute left-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => alert("يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور.")}
                  className="text-xs text-gray-500 hover:text-[#064e3b] font-medium transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              {/* Primary Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-13 mt-1 rounded-2xl bg-[#064e3b] hover:bg-[#003527] text-white font-bold text-sm shadow-md shadow-[#064e3b]/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowLeft className="w-4 h-4 rtl:rotate-0" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-gray-200"></div>
              <span className="absolute px-3 bg-white text-[11px] font-bold text-gray-500 tracking-normal">
                حسابات تجريبية للاختبار
              </span>
            </div>

            {/* Test Accounts Section */}
            <div className="flex flex-col gap-3">
              {/* Company Selector Tabs */}
              <div className="flex p-1 bg-gray-100 rounded-xl">
                {companyGroups.map((comp) => {
                  const isSelected = selectedCompanyId === comp.id;
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(comp.id)}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white text-[#003527] shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {comp.shortName}
                    </button>
                  );
                })}
              </div>

              {/* 2x2 Account Grid */}
              <div className="grid grid-cols-2 gap-2">
                {currentCompany.accounts.map((acc) => {
                  const isSelected = email === acc.email;
                  const isThisFastLoading = fastLoadingEmail === acc.email;

                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={loading}
                      onClick={() => handleFastAccess(acc)}
                      title={`دخول كـ ${acc.name} (${acc.email})`}
                      className={`h-13 px-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all border cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-emerald-50 border-[#064e3b] text-[#064e3b] font-bold shadow-sm ring-1 ring-[#064e3b]/20"
                          : "bg-gray-50 hover:bg-emerald-50/60 hover:border-emerald-300 border-gray-200 text-gray-700"
                      } disabled:opacity-60`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getRoleIcon(acc.role)}
                        <div className="flex flex-col text-right min-w-0 leading-tight">
                          <span className="truncate text-[11px] font-bold text-gray-900">{acc.label}</span>
                          <span className="truncate text-[10px] text-gray-500 font-normal">{acc.name}</span>
                        </div>
                      </div>

                      {isThisFastLoading && (
                        <Loader2 className="w-3.5 h-3.5 text-[#064e3b] animate-spin shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-400">
              كلمة المرور الموحدة لجميع الحسابات التجريبية: <span className="font-mono font-bold text-gray-600">Password123!</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
