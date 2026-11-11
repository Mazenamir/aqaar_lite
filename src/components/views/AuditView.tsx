"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Lock,
  Database,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  Building,
  RefreshCw
} from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress: string;
  userName: string;
  userRole: string;
  createdAt: string;
}

interface AuditViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function AuditView({ onNavigateTab: _onNavigateTab }: AuditViewProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/audit");
      if (!res.ok) {
        if (res.status === 403) throw new Error("غير مصرح: هذا السجل مخصص لمدير الشركة فقط");
        throw new Error("تعذر تحميل سجل التدقيق والرقابة");
      }
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل السجلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user?.companyName) setCompanyName(d.user.companyName);
      })
      .catch(() => {});
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "UNIT_PRICE_CHANGED":
        return { label: "تعديل سعر وحدة", color: "bg-red-50 text-red-800 border-red-200" };
      case "CONTRACT_APPROVED":
        return { label: "اعتماد عقد وترحيل", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "CONTRACT_DRAFTED":
        return { label: "إنشاء مسودة عقد", color: "bg-amber-50 text-amber-800 border-amber-200" };
      case "PAYMENT_RECORDED":
        return { label: "تسجيل سند قبض", color: "bg-blue-50 text-blue-800 border-blue-200" };
      case "UNIT_RESERVED":
        return { label: "حجز وحدة مؤقت", color: "bg-purple-50 text-purple-800 border-purple-200" };
      case "RESERVATIONS_EXPIRED":
        return { label: "انتهاء حجز تلقائي", color: "bg-gray-100 text-gray-800 border-gray-200" };
      default:
        return { label: action, color: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === "COMPANY_ADMIN") return "مدير الشركة";
    if (role === "ACCOUNTANT") return "محاسب مالي";
    if (role === "SALES_AGENT") return "مندوب مبيعات";
    return role;
  };

  const parseDetails = (detailsStr: string) => {
    try {
      const obj = JSON.parse(detailsStr);
      if (obj.oldPriceHalalas && obj.newPriceHalalas) {
        const oldSar = (Number(BigInt(obj.oldPriceHalalas) / 100n)).toLocaleString("en-US");
        const newSar = (Number(BigInt(obj.newPriceHalalas) / 100n)).toLocaleString("en-US");
        return `تغيير السعر: من ${oldSar} ر.س إلى ${newSar} ر.س`;
      }
      if (obj.contractNumber) {
        return `رقم العقد: ${obj.contractNumber} (وحدة: ${obj.unitCode || obj.unitId || ""})`;
      }
      if (obj.amountHalalas) {
        const sar = (Number(BigInt(obj.amountHalalas) / 100n)).toLocaleString("en-US");
        return `مبلغ السداد: ${sar} ر.س (مفتاح: ${obj.idempotencyKey?.slice(0, 8)}...)`;
      }
      return detailsStr;
    } catch (e) {
      return detailsStr;
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.entityId.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (roleFilter !== "all" && log.userRole !== roleFilter) return false;

      return true;
    });
  }, [logs, search, actionFilter, roleFilter]);

  const priceChangesCount = logs.filter((l) => l.action === "UNIT_PRICE_CHANGED").length;
  const approvalsCount = logs.filter((l) => l.action === "CONTRACT_APPROVED").length;
  const paymentsCount = logs.filter((l) => l.action === "PAYMENT_RECORDED").length;

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        {/* Title */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>سجل الرقابة والتدقيق الأمني</span>
            <span className="text-2xl">🛡️</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            سجل غير قابل للتعديل (Append-Only) لتوثيق كافة التعديلات الحساسة والمالية وعناوين IP.
          </p>
        </div>

        {/* Action & Utility Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالموظف، الإجراء، الكيان..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-48 sm:w-60 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchLogs}
            title="تحديث السجل"
            className="bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full p-2 text-gray-600 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#064e3b]" : ""}`} />
          </button>

          <div className="hidden md:flex items-center gap-1.5 bg-white border border-gray-200/80 rounded-full px-3.5 py-2 text-xs font-medium text-gray-600 shadow-xs select-none">
            <Building className="w-3.5 h-3.5 text-emerald-800" />
            <span>{companyName}</span>
          </div>
        </div>
      </div>

      {/* BENTO CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Logs Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#d9f99d]/50 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              سجل محمي
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {logs.length}
              </span>
              <span className="text-xs font-bold text-gray-500">عملية موثقة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              إجمالي الحركات المحفوظة والمشفرة
            </p>
          </div>
        </div>

        {/* Price Modifications */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#fed7aa]/50 rounded-[50%_50%_30%_70%/60%_40%_60%_40%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              تعديل أسعار
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {priceChangesCount}
              </span>
              <span className="text-xs font-bold text-orange-700">تعديل سعر وحدة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              تغييرات طرأت على تسعيرة الوحدات
            </p>
          </div>
        </div>

        {/* Contract Approvals */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#bbf7d0]/50 rounded-[40%_60%_60%_40%/50%_50%_50%_50%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center font-bold text-xs shadow-xs">
              <FileCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              اعتمادات مالية
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {approvalsCount}
              </span>
              <span className="text-xs font-bold text-emerald-700">عقد معتمد</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              قرارات ترحيل رسمية للدفاتر
            </p>
          </div>
        </div>

        {/* Security & Immutability */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              حماية مطلقة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white tracking-tight">
                Append-Only
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
              السجلات غير قابلة للحذف أو التعديل بأي شكل
            </p>
          </div>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActionFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              actionFilter === "all"
                ? "bg-[#064e3b] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            كافة العمليات ({logs.length})
          </button>
          <button
            onClick={() => setActionFilter("UNIT_PRICE_CHANGED")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              actionFilter === "UNIT_PRICE_CHANGED"
                ? "bg-[#dc2626] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            تعديل الأسعار ({priceChangesCount})
          </button>
          <button
            onClick={() => setActionFilter("CONTRACT_APPROVED")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              actionFilter === "CONTRACT_APPROVED"
                ? "bg-[#059669] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            اعتماد العقود ({approvalsCount})
          </button>
          <button
            onClick={() => setActionFilter("PAYMENT_RECORDED")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              actionFilter === "PAYMENT_RECORDED"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            سندات القبض ({paymentsCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">المنصب:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-gray-200/80 rounded-full px-3 py-1.5 text-xs text-gray-700 font-semibold outline-none focus:border-[#064e3b] shadow-xs cursor-pointer"
          >
            <option value="all">كافة المناصب</option>
            <option value="COMPANY_ADMIN">مدير الشركة</option>
            <option value="ACCOUNTANT">محاسب مالي</option>
            <option value="SALES_AGENT">مندوب مبيعات</option>
          </select>
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-gray-500">جاري تحميل سجل التدقيق والرقابة...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <ShieldAlert className="w-12 h-12 stroke-[1.2] text-gray-300" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-700">لا توجد سجلات مطابقة</span>
              <span className="text-xs text-gray-400">جرّب تغيير عبارة البحث أو اختيار إجراء آخر</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                <tr className="h-11">
                  <th className="pr-6 pl-4">الوقت والتاريخ</th>
                  <th className="px-4">الموظف والمنصب</th>
                  <th className="px-4">نوع الإجراء</th>
                  <th className="px-4">الكيان المتأثر</th>
                  <th className="px-4">تفاصيل التغيير</th>
                  <th className="pl-6 pr-4 text-left">عنوان IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 text-gray-800">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id} className="h-16 hover:bg-[#fafaf8] transition-colors group">
                      {/* Date & Time */}
                      <td className="pr-6 pl-4 font-num whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-[#002117] text-xs">
                            {log.createdAt.split("T")[0]}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {log.createdAt.split("T")[1]?.slice(0, 8)}
                          </span>
                        </div>
                      </td>

                      {/* User & Role */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] font-bold text-xs flex items-center justify-center shrink-0">
                            {log.userName.slice(0, 1)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-800 text-xs">{log.userName}</span>
                            <span className="text-[10px] text-[#064e3b] font-semibold">
                              {getRoleLabel(log.userRole)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Affected Entity */}
                      <td className="px-4 font-num font-semibold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                          {log.entityType} #{log.entityId.slice(0, 8)}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="px-4 max-w-md">
                        <span className="text-gray-800 font-medium block truncate text-xs" title={log.details}>
                          {parseDetails(log.details)}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="pl-6 pr-4 text-left font-num text-[11px] text-gray-500 whitespace-nowrap" dir="ltr">
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
