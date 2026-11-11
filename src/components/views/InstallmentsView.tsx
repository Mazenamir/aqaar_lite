"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building,
  RefreshCw,
  CreditCard,
  Phone,
  TrendingUp,
  Wallet
} from "lucide-react";

interface InstallmentRecord {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountSar: string;
  amountHalalas: string;
  paidAmountSar: string;
  paidAmountHalalas: string;
  remainingAmountSar: string;
  remainingAmountHalalas: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "UNPAID" | "PARTIALLY_PAID";
  isOverdue: boolean;
  contractId: string;
  contractNumber: string;
  contractStatus: string;
  clientName: string;
  clientPhone: string;
  unitCode: string;
  unitProject: string;
}

interface InstallmentsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function InstallmentsView({ onNavigateTab }: InstallmentsViewProps) {
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          if (json.user.companyName) setCompanyName(json.user.companyName);
          if (json.user.role) setCurrentUserRole(json.user.role);
        }
      }
    } catch {}
  };

  const fetchInstallments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/installments");
      if (!res.ok) throw new Error("تعذر تحميل جدول الأقساط");
      const json = await res.json();
      if (json.success) {
        setInstallments(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchInstallments();
  }, []);

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (status === "PAID") {
      return { label: "مسدد بالكامل", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    }
    if (status === "OVERDUE" || (isOverdue && status !== "PAID")) {
      return { label: "متأخر عن السداد", color: "bg-red-50 text-red-800 border-red-200" };
    }
    if (status === "PARTIAL" || status === "PARTIALLY_PAID") {
      return { label: "مسدد جزئياً", color: "bg-amber-50 text-amber-800 border-amber-200" };
    }
    return { label: "مستحق / قيد الانتظار", color: "bg-blue-50 text-blue-800 border-blue-200" };
  };

  const filteredInstallments = useMemo(() => {
    return installments.filter((item) => {
      const matchesSearch =
        item.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        item.clientName.toLowerCase().includes(search.toLowerCase()) ||
        item.unitCode.toLowerCase().includes(search.toLowerCase()) ||
        item.unitProject.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "OVERDUE") {
        return item.status === "OVERDUE" || (item.isOverdue && item.status !== "PAID");
      }
      if (statusFilter === "PENDING") {
        return item.status === "PENDING" && !item.isOverdue;
      }
      if (statusFilter === "PARTIAL") {
        return item.status === "PARTIAL" || item.status === "PARTIALLY_PAID";
      }
      if (statusFilter === "PAID") {
        return item.status === "PAID";
      }

      return true;
    });
  }, [installments, search, statusFilter]);

  // Aggregate Metrics in Halalas
  const metrics = useMemo(() => {
    let totalDueHalalas = 0n;
    let totalPaidHalalas = 0n;
    let overdueHalalas = 0n;
    let overdueCount = 0;
    let pendingCount = 0;
    let paidCount = 0;

    for (const inst of installments) {
      const amt = BigInt(inst.amountHalalas || "0");
      const paid = BigInt(inst.paidAmountHalalas || "0");
      totalDueHalalas += amt;
      totalPaidHalalas += paid;

      const isOver = inst.status === "OVERDUE" || (inst.isOverdue && inst.status !== "PAID");
      if (isOver) {
        overdueHalalas += amt - paid;
        overdueCount++;
      } else if (inst.status === "PAID") {
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const collectionRate =
      totalDueHalalas > 0n
        ? Number((totalPaidHalalas * 10000n) / totalDueHalalas) / 100
        : 0;

    return {
      totalDueSar: (Number(totalDueHalalas) / 100).toLocaleString("en-US"),
      totalPaidSar: (Number(totalPaidHalalas) / 100).toLocaleString("en-US"),
      overdueSar: (Number(overdueHalalas) / 100).toLocaleString("en-US"),
      overdueCount,
      pendingCount,
      paidCount,
      collectionRate: collectionRate.toFixed(1),
    };
  }, [installments]);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>جدول الأقساط والتحصيل المالي</span>
            <span className="text-2xl">📅</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            متابعة استحقاق الأقساط الشهرية، جدول المديونيات، التنبيه للأقساط المتأخرة، وتوزيع المدفوعات.
          </p>
        </div>

        {/* Action & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentUserRole === "ACCOUNTANT" && (
            <button
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab("payments", "/payments");
                }
              }}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>+ تسجيل سند قبض</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم العقد، العميل، الوحدة..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-52 sm:w-64 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchInstallments}
            title="تحديث البيانات"
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

      {/* BENTO KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Due */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              إجمالي الأقساط
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-num text-[#002117] tracking-tight">
                {metrics.totalDueSar}
              </span>
              <span className="text-xs font-bold text-emerald-800">ر.س</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              مجموع الأقساط المجدولة على العقود المعتمدة
            </p>
          </div>
        </div>

        {/* Collected */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#e0e7ff] text-[#3730a3] flex items-center justify-center font-bold text-xs shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              المحصل الفعلي
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-num text-[#002117] tracking-tight">
                {metrics.totalPaidSar}
              </span>
              <span className="text-xs font-bold text-indigo-700">ر.س</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              نسبة التحصيل: <strong className="text-indigo-800 font-num">{metrics.collectionRate}%</strong>
            </p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#fef2f2] text-[#991b1b] flex items-center justify-center font-bold text-xs shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-red-800 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
              المتأخرات
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-num text-[#991b1b] tracking-tight">
                {metrics.overdueSar}
              </span>
              <span className="text-xs font-bold text-red-700">ر.س</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium font-num">
              {metrics.overdueCount} قسط تجاوز تاريخ الاستحقاق
            </p>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[150px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              حالة الأقساط
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-white tracking-tight">
                {installments.length}
              </span>
              <span className="text-xs font-bold text-[#86efac]">إجمالي الأقساط</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium font-num">
              {metrics.paidCount} مسدد • {metrics.pendingCount} بانتظار السداد
            </p>
          </div>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-[#064e3b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          الكل ({installments.length})
        </button>
        <button
          onClick={() => setStatusFilter("OVERDUE")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "OVERDUE"
              ? "bg-[#991b1b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المتأخرة ({metrics.overdueCount})
        </button>
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "PENDING"
              ? "bg-[#064e3b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المستحقة ({metrics.pendingCount})
        </button>
        <button
          onClick={() => setStatusFilter("PARTIAL")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "PARTIAL"
              ? "bg-[#c2410c] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المسددة جزئياً
        </button>
        <button
          onClick={() => setStatusFilter("PAID")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "PAID"
              ? "bg-[#3730a3] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المسددة بالكامل ({metrics.paidCount})
        </button>
      </div>

      {/* INSTALLMENTS TABLE */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-gray-500">جاري تحميل جدول الأقساط...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        ) : filteredInstallments.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Calendar className="w-12 h-12 stroke-[1.2] text-gray-300" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-700">لا توجد أقساط مطابقة</span>
              <span className="text-xs text-gray-400">ستظهر الأقساط فور اعتماد العقود من قبل المحاسب المالي</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                <tr className="h-11">
                  <th className="pr-6 pl-4">رقم القسط والعقد</th>
                  <th className="px-4">الوحدة والمشروع</th>
                  <th className="px-4">العميل</th>
                  <th className="px-4">تاريخ الاستحقاق</th>
                  <th className="px-4">قيمة القسط</th>
                  <th className="px-4">المسدد</th>
                  <th className="px-4">المتبقي</th>
                  <th className="px-4">الحالة</th>
                  <th className="pl-6 pr-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 text-gray-800">
                {filteredInstallments.map((inst) => {
                  const badge = getStatusBadge(inst.status, inst.isOverdue);
                  const isFullyPaid = inst.status === "PAID";

                  return (
                    <tr key={inst.id} className="h-16 hover:bg-[#fafaf8] transition-colors group">
                      {/* Installment & Contract */}
                      <td className="pr-6 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] font-bold text-xs flex items-center justify-center shrink-0">
                            #{inst.installmentNumber}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-[#002117] text-xs font-num group-hover:text-[#064e3b] transition-colors">
                              قسط {inst.installmentNumber}
                            </span>
                            <span className="text-[10px] text-gray-500 font-num">
                              عقد {inst.contractNumber}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Unit & Project */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-xs font-num">{inst.unitCode}</span>
                          <span className="text-[10px] text-gray-500">{inst.unitProject}</span>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-xs">{inst.clientName}</span>
                          <span className="text-[10px] text-gray-400 font-num flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{inst.clientPhone}</span>
                          </span>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-num">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              inst.isOverdue && !isFullyPaid
                                ? "bg-red-50 text-red-800 border border-red-200"
                                : "text-gray-700 bg-gray-50 border border-gray-100"
                            }`}
                          >
                            {inst.dueDate}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 whitespace-nowrap font-extrabold text-sm text-[#064e3b] font-num">
                        {inst.amountSar} ر.س
                      </td>

                      {/* Paid */}
                      <td className="px-4 whitespace-nowrap font-bold text-xs text-gray-700 font-num">
                        {inst.paidAmountSar} ر.س
                      </td>

                      {/* Remaining */}
                      <td className="px-4 whitespace-nowrap font-bold text-xs font-num">
                        <span className={isFullyPaid ? "text-gray-400" : "text-red-700"}>
                          {inst.remainingAmountSar} ر.س
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="pl-6 pr-4 whitespace-nowrap text-center">
                        {!isFullyPaid && currentUserRole === "ACCOUNTANT" && (
                          <button
                            onClick={() => {
                              if (onNavigateTab) {
                                onNavigateTab("payments", "/payments");
                              }
                            }}
                            className="px-2.5 py-1 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 mx-auto cursor-pointer"
                            title="تسجيل دفعة لهذا العقد"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>سداد</span>
                          </button>
                        )}
                        {isFullyPaid && (
                          <span className="text-emerald-700 text-[11px] font-bold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مكتمل</span>
                          </span>
                        )}
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
