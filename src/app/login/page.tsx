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
  KeyRound
} from "lucide-react";

const testAccounts = [
  { label: "مدير شركة الرياض", email: "admin@riyadh.sa", role: "مدير الشركة (Admin)", company: "شركة الرياض" },
  { label: "محاسب مالي", email: "acc@riyadh.sa", role: "محاسب (Accountant)", company: "شركة الرياض" },
  { label: "مندوب مبيعات 1", email: "agent1@riyadh.sa", role: "مبيعات (Agent 1)", company: "شركة الرياض" },
  { label: "مندوب مبيعات 2", email: "agent2@riyadh.sa", role: "مبيعات (Agent 2)", company: "شركة الرياض" },
  { label: "شركة ديار نجد (معزول)", email: "admin@najd.sa", role: "مدير (Tenant 2)", company: "ديار نجد" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agent1@riyadh.sa");
  const [password, setPassword] = useState("Password@123");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeAccountLabel, setActiveAccountLabel] = useState("مندوب مبيعات 1");

  const handleSelectAccount = (acc: typeof testAccounts[0]) => {
    setEmail(acc.email);
    setPassword("Password@123");
    setErrorMsg("");
    setActiveAccountLabel(acc.label);
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
    <div
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-br from-[#002117] via-[#064e3b] to-[#043327] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans"
    >
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center z-10">
        
        {/* Left Side: Welcome Brand Messaging (5 cols in desktop) */}
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

          {/* Big Greeting Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
            أهلاً، مرحباً بك!
          </h1>

          {/* Subheading */}
          <h2 className="text-lg sm:text-xl font-semibold text-primary-fixed mb-4">
            المنصة الذكية لإدارة مبيعات العقارات والتحصيل المالي
          </h2>

          {/* Descriptive Body */}
          <p className="text-emerald-100/75 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
            نوفر لك كافة المزايا المتقدمة لتسهيل صياغة العقود وتوزيع الأقساط الشهرية آلياً دون أي أخطاء حسابية أو تعقيدات إضافية.
          </p>

          {/* Trust Highlights Pills */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-emerald-100/90 font-medium">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <ShieldCheck className="w-4 h-4 text-primary-fixed" />
              <span>عزل متعدد الشركات (Multi-Tenant)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <KeyRound className="w-4 h-4 text-primary-fixed" />
              <span>دقة الهللة بنسبة 100%</span>
            </span>
          </div>
        </div>

        {/* Right Side: Floating Clean White Card (7 cols in desktop) */}
        <div className="lg:col-span-7 flex justify-center order-1 lg:order-2">
          <div className="w-full max-w-[480px] bg-white rounded-[32px] sm:rounded-[36px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] p-8 sm:p-12 flex flex-col justify-between border border-white/80 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Card Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#003527] tracking-tight">
                تسجيل الدخول
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                أدخل بيانات حسابك للمتابعة إلى النظام العقاري
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2.5 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Username / Email Input */}
              <div className="flex flex-col gap-1.5">
                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setActiveAccountLabel("");
                    }}
                    placeholder="اسم المستخدم أو البريد الإلكتروني"
                    className="w-full h-12 sm:h-14 px-6 bg-gray-50/80 hover:bg-gray-50 text-gray-900 text-sm rounded-full outline-none border border-gray-200 focus:border-[#064e3b] focus:bg-white focus:ring-4 focus:ring-[#064e3b]/10 transition-all placeholder:text-gray-400 font-medium text-right"
                  />
                  <Mail className="w-5 h-5 absolute left-5 text-gray-400 pointer-events-none" />
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
                    className="w-full h-12 sm:h-14 px-6 bg-gray-50/80 hover:bg-gray-50 text-gray-900 text-sm rounded-full outline-none border border-gray-200 focus:border-[#064e3b] focus:bg-white focus:ring-4 focus:ring-[#064e3b]/10 transition-all placeholder:text-gray-400 font-medium text-right"
                  />
                  <Lock className="w-5 h-5 absolute left-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pt-0.5">
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
                className="w-full h-12 sm:h-14 mt-2 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white font-bold text-base shadow-lg shadow-[#064e3b]/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>دخول للنظام</span>
                    <ArrowLeft className="w-4 h-4 rtl:rotate-0" />
                  </>
                )}
              </button>
            </form>

            {/* OR Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-gray-200"></div>
              <span className="absolute px-3 bg-white text-[11px] font-bold text-gray-400 tracking-wider">
                أو اختر حساباً تجريبياً (QUICK LOGIN)
              </span>
            </div>

            {/* Quick Test Accounts Pills Grid (Styled like the social buttons in the mockup) */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {testAccounts.slice(0, 4).map((acc) => {
                  const isSelected = activeAccountLabel === acc.label;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectAccount(acc)}
                      className={`h-11 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                        isSelected
                          ? "bg-secondary-container/40 border-secondary text-primary font-bold shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-secondary shrink-0" />
                      <span className="truncate">{acc.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Company 2 Quick Switcher (Tenant 2 isolation test) */}
              {testAccounts[4] && (
                <button
                  type="button"
                  onClick={() => handleSelectAccount(testAccounts[4]!)}
                  className={`w-full h-10 px-4 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all border ${
                    activeAccountLabel === testAccounts[4]!.label
                      ? "bg-secondary-container/40 border-secondary text-primary font-bold"
                      : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600"
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-secondary" />
                  <span>تبديل إلى: {testAccounts[4]!.label}</span>
                </button>
              )}
            </div>

            {/* Footer Notice */}
            <div className="mt-8 text-center text-xs text-gray-500">
              <span>تحتاج إلى مساعدة؟ </span>
              <span className="text-[#064e3b] font-bold hover:underline cursor-pointer">
                تواصل مع الدعم الفني
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
