"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

const testAccounts = [
  { label: "مدير شركة الرياض", email: "admin@riyadh.sa", role: "COMPANY_ADMIN", company: "شركة الرياض" },
  { label: "محاسب شركة الرياض", email: "acc@riyadh.sa", role: "ACCOUNTANT", company: "شركة الرياض" },
  { label: "مندوب مبيعات 1 (الرياض)", email: "agent1@riyadh.sa", role: "SALES_AGENT", company: "شركة الرياض" },
  { label: "مندوب مبيعات 2 (الرياض)", email: "agent2@riyadh.sa", role: "SALES_AGENT", company: "شركة الرياض" },
  { label: "مدير ديار نجد (Tenant 2)", email: "admin@najd.sa", role: "COMPANY_ADMIN", company: "ديار نجد" },
  { label: "مندوب ديار نجد (Tenant 2)", email: "agent1@najd.sa", role: "SALES_AGENT", company: "ديار نجد" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agent1@riyadh.sa");
  const [password, setPassword] = useState("Password@123");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSelectAccount = (acc: typeof testAccounts[0]) => {
    setEmail(acc.email);
    setPassword("Password@123");
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "بيانات الاعتماد غير صحيحة");
        setLoading(false);
        return;
      }

      router.push("/units");
      router.refresh();
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-surface-container-lowest rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-outline-variant/20">
        
        {/* Form Experience (7 cols) */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
          <div>
            {/* Brand Logo Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-xl shadow-sm">
                  ع
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-primary tracking-tight">عقار لايت</span>
                  <span className="text-xs text-on-surface-variant font-medium">شركة الريادة الخضراء</span>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                Multi-Tenant v2.4
              </span>
            </div>

            {/* Title */}
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-on-surface mb-1">تسجيل الدخول للنظام</h1>
              <p className="text-xs text-on-surface-variant">
                أدخل بيانات حسابك المعتمد أو اختر أحد الحسابات التجريبية الجاهزة للاختبار:
              </p>
            </div>

            {/* Test Accounts Quick Pickers (Mandated by PDF) */}
            <div className="mb-5">
              <span className="text-[11px] font-bold text-on-surface-variant mb-2 block">
                حسابات Seed التجريبية السريعة (اختر للتعبئة التلقائية):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {testAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className={`p-2 text-right rounded-xl text-[11px] font-medium transition-all border ${
                      email === acc.email
                        ? "bg-secondary-container text-on-secondary-container border-primary-container font-bold shadow-sm"
                        : "bg-surface-container-low hover:bg-surface-container text-on-surface border-transparent"
                    }`}
                  >
                    <div className="truncate">{acc.label}</div>
                    <div className="text-[9px] text-on-surface-variant opacity-80">{acc.company}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">البريد الإلكتروني</label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pr-10 pl-4 bg-surface-container-low text-on-surface text-xs rounded-xl border border-outline-variant/30 focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none font-mono"
                    placeholder="user@riyadh.sa"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">كلمة المرور</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pr-10 pl-4 bg-surface-container-low text-on-surface text-xs rounded-xl border border-outline-variant/30 focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span>جاري التحقق والمصادقة...</span>
                ) : (
                  <>
                    <span>دخول آمن للنظام العقاري</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-surface-container-low text-[11px] text-on-surface-variant flex items-center justify-between">
            <span>نظام عقار لايت - شركة الريادة الخضراء</span>
            <span className="flex items-center gap-1 text-secondary font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              جلسات مشفرة HttpOnly
            </span>
          </div>
        </div>

        {/* Brand Showcase (5 cols) */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-10 bg-gradient-to-br from-primary via-primary-container to-primary text-on-primary overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 backdrop-blur-md">
              الرياض - المملكة العربية السعودية
            </span>
            <Building2 className="w-5 h-5 opacity-80" />
          </div>

          <div className="relative z-10 my-auto flex flex-col gap-6">
            <div>
              <span className="text-secondary-fixed text-xs font-bold tracking-wide uppercase">
                منصة المبيعات والأقساط العقارية
              </span>
              <h2 className="text-3xl font-extrabold leading-snug mt-2 text-white">
                حلول رقمية رائدة لإدارة المشاريع، الوحدات والأقساط العقارية
              </h2>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/80">المعاملات المالية المتطابقة</span>
                <span className="text-xs text-secondary-fixed font-bold font-mono">100% بدون تقريب float</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">حسابات دقيقة بالهللة</div>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/80">
              <CheckCircle2 className="w-4 h-4 text-secondary-fixed" />
              <span>فصل تام بين بيانات الشركات (Strict Multi-Tenancy)</span>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-primary-fixed-dim pt-4 border-t border-white/10">
            <span>اختبار تقني - RA-HR-2026-1110</span>
            <span className="font-mono">72h SLA</span>
          </div>
        </div>

      </div>
    </div>
  );
}
