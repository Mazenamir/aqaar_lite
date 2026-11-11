"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/Modal";
import {
  CreditCard,
  PlusCircle,
  Receipt,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Check,
  Building
} from "lucide-react";

interface PaymentItem {
  id: string;
  receiptNumber: string;
  contractNumber: string;
  unitCode: string;
  clientName: string;
  amountHalalas: string;
  amountSar: string;
  method: "SADAD" | "MADA" | "BANK_TRANSFER" | "CASH" | "CHEQUE";
  notes: string;
  createdByName: string;
  createdAt: string;
  allocations: {
    installmentNumber: number;
    allocatedAmountSar: string;
  }[];
}

interface ContractOption {
  id: string;
  contractNumber: string;
  clientName: string;
  unitCode: string;
  remainingBalanceHalalas: string;
  remainingBalanceSar: string;
  status: string;
}

interface PaymentsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function PaymentsView({ onNavigateTab: _onNavigateTab }: PaymentsViewProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // New Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    contractId: "",
    amountSar: "",
    method: "BANK_TRANSFER",
    idempotencyKey: "",
    notes: "",
    confirmed: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const generateKey = () => {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.user?.companyName) setCompanyName(json.user.companyName);
        if (json.user?.role) setCurrentUserRole(json.user.role);
      }
    } catch (e) {}
  };

interface RawContractItem {
  id: string;
  contractNumber: string;
  status: string;
  remainingBalanceHalalas: string;
  remainingBalanceSar: string;
  client: { name: string };
  unit: { code: string };
}

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error("تعذر تحميل سجل المدفوعات");
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const fetchContractsForPayment = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const eligible = (json.data as RawContractItem[])
            .filter((c) => c.status === "APPROVED" && BigInt(c.remainingBalanceHalalas) > 0n)
            .map((c) => ({
              id: c.id,
              contractNumber: c.contractNumber,
              clientName: c.client.name,
              unitCode: c.unit.code,
              remainingBalanceHalalas: c.remainingBalanceHalalas,
              remainingBalanceSar: c.remainingBalanceSar,
              status: c.status,
            }));
          setContracts(eligible);
          const firstEligible = eligible[0];
          if (firstEligible && !formData.contractId) {
            setFormData((prev) => ({ ...prev, contractId: firstEligible.id }));
          }
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchPayments();
    fetchContractsForPayment();
  }, []);

  const handleOpenModal = () => {
    fetchContractsForPayment();
    setFormData({
      contractId: contracts[0]?.id || "",
      amountSar: "",
      method: "BANK_TRANSFER",
      idempotencyKey: generateKey(),
      notes: "",
      confirmed: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.contractId) {
      setFormError("يرجى اختيار العقد المستحق للسداد");
      return;
    }

    const val = parseFloat(formData.amountSar);
    if (isNaN(val) || val <= 0) {
      setFormError("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    const selectedContract = contracts.find((c) => c.id === formData.contractId);
    if (selectedContract) {
      const balanceSar = Number(BigInt(selectedContract.remainingBalanceHalalas) / 100n);
      if (val > balanceSar) {
        setFormError(`المبلغ المدخل (${val.toLocaleString("en-US")} ر.س) يتجاوز الرصيد المتبقي على العقد (${balanceSar.toLocaleString("en-US")} ر.س)`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: formData.contractId,
          amountSar: val,
          method: formData.method,
          idempotencyKey: formData.idempotencyKey,
          notes: formData.notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل قيد سند القبض");
      }

      setIsModalOpen(false);
      setFeedbackMsg({
        type: "success",
        text: `تم إصدار سند القبض رقم ${json.data.receiptNumber} بقيمة ${val.toLocaleString("en-US")} ر.س وتوزيع الأقساط آلياً (FIFO)`,
      });
      fetchPayments();
      fetchContractsForPayment();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "فشل قيد سند القبض");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "SADAD":
        return { label: "سداد", color: "bg-blue-50 text-blue-800 border-blue-100" };
      case "MADA":
        return { label: "مدى", color: "bg-emerald-50 text-emerald-800 border-emerald-100" };
      case "BANK_TRANSFER":
        return { label: "حوالة بنكية", color: "bg-purple-50 text-purple-800 border-purple-100" };
      case "CASH":
        return { label: "نقدي", color: "bg-amber-50 text-amber-800 border-amber-100" };
      case "CHEQUE":
        return { label: "شيك مصدق", color: "bg-gray-50 text-gray-800 border-gray-100" };
      default:
        return { label: method, color: "bg-gray-50 text-gray-800 border-gray-100" };
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        p.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName.toLowerCase().includes(search.toLowerCase()) ||
        p.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.unitCode.toLowerCase().includes(search.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;

      return true;
    });
  }, [payments, search, methodFilter]);

  // Financial Metrics
  const totalCollectionsSar = useMemo(() => {
    const totalHalalas = payments.reduce((acc, p) => acc + BigInt(p.amountHalalas || "0"), 0n);
    return (Number(totalHalalas) / 100).toLocaleString("en-US");
  }, [payments]);

  const bankTransferCount = payments.filter((p) => p.method === "BANK_TRANSFER").length;
  const madaCount = payments.filter((p) => p.method === "MADA").length;
  const sadadCount = payments.filter((p) => p.method === "SADAD").length;

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        {/* Title */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>المدفوعات وسندات القبض</span>
            <span className="text-2xl">💳</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            قيد سندات القبض المالية، التوزيع الآلي بنظام الأسبقية (FIFO)، ومنع التكرار المحاسبي.
          </p>
        </div>

        {/* Action & Utility Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentUserRole === "ACCOUNTANT" && (
            <button
              onClick={handleOpenModal}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ تسجيل دفعة جديدة</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم السند أو العقد أو العميل..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-48 sm:w-60 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchPayments}
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

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in ${
            feedbackMsg.type === "success"
              ? "bg-[#ecfdf5] text-[#065f46] border border-emerald-200"
              : "bg-[#fef2f2] text-[#991b1b] border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* BENTO CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Collected Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#d9f99d]/50 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              إجمالي المحصل
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-num text-[#002117] tracking-tight">
                {totalCollectionsSar}
              </span>
              <span className="text-xs font-bold text-emerald-800">ر.س</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              إجمالي السندات المقيدة والمرحلة
            </p>
          </div>
        </div>

        {/* Payments Count */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#fed7aa]/50 rounded-[50%_50%_30%_70%/60%_40%_60%_40%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              سندات القبض
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {payments.length}
              </span>
              <span className="text-xs font-bold text-orange-700">سند قبض صادر</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              عمليات دفع مسجلة وموثقة
            </p>
          </div>
        </div>

        {/* Bank Transfers */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#e0e7ff]/60 rounded-[40%_60%_60%_40%/50%_50%_50%_50%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#e0e7ff] text-[#3730a3] flex items-center justify-center font-bold text-xs shadow-xs">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              حوالات بنكية
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {bankTransferCount}
              </span>
              <span className="text-xs font-bold text-indigo-700">عملية تحويل</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              حوالات مصرفية مباشرة في حساب الشركة
            </p>
          </div>
        </div>

        {/* Electronic Card (Mada / Sadad) */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              مدى وسداد
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-white tracking-tight">
                {madaCount + sadadCount}
              </span>
              <span className="text-xs font-bold text-[#86efac]">دفع فوري</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
              تحصيل إلكتروني عبر بوابات الدفع
            </p>
          </div>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => setMethodFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            methodFilter === "all"
              ? "bg-[#064e3b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          الكل ({payments.length})
        </button>
        <button
          onClick={() => setMethodFilter("BANK_TRANSFER")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            methodFilter === "BANK_TRANSFER"
              ? "bg-[#4338ca] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          حوالات بنكية ({bankTransferCount})
        </button>
        <button
          onClick={() => setMethodFilter("MADA")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            methodFilter === "MADA"
              ? "bg-[#047857] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          مدى ({madaCount})
        </button>
        <button
          onClick={() => setMethodFilter("SADAD")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            methodFilter === "SADAD"
              ? "bg-[#2563eb] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          سداد ({sadadCount})
        </button>
      </div>

      {/* PAYMENTS DATA TABLE */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-gray-500">جاري تحميل سجل سندات القبض...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Receipt className="w-12 h-12 stroke-[1.2] text-gray-300" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-700">لا توجد سندات قبض مطابقة</span>
              <span className="text-xs text-gray-400">سجل دفعة جديدة لأحد العقود المعتمدة</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                <tr className="h-11">
                  <th className="pr-6 pl-4">رقم السند</th>
                  <th className="px-4">العقد والوحدة</th>
                  <th className="px-4">اسم العميل</th>
                  <th className="px-4">المبلغ المحصل</th>
                  <th className="px-4">طريقة السداد</th>
                  <th className="px-4">توزيع الأقساط (FIFO)</th>
                  <th className="px-4">تاريخ السند</th>
                  <th className="pl-6 pr-4">المسؤول والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 text-gray-800">
                {filteredPayments.map((p) => {
                  const badge = getMethodBadge(p.method);
                  const amountSarFormatted = (Number(BigInt(p.amountHalalas) / 100n)).toLocaleString("en-US");
                  return (
                    <tr key={p.id} className="h-16 hover:bg-[#fafaf8] transition-colors group">
                      {/* Receipt Number */}
                      <td className="pr-6 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] font-bold text-xs flex items-center justify-center shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-[#002117] text-xs font-num group-hover:text-[#064e3b] transition-colors">
                              {p.receiptNumber}
                            </span>
                            <span className="text-[10px] text-gray-400 font-num">
                              #{p.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contract & Unit */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex flex-col font-num">
                          <span className="font-bold text-gray-800 text-xs">
                            عقد {p.contractNumber}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            وحدة: <strong className="text-gray-700">{p.unitCode}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="px-4 whitespace-nowrap font-bold text-gray-800">
                        {p.clientName}
                      </td>

                      {/* Amount */}
                      <td className="px-4 whitespace-nowrap">
                        <span className="font-extrabold text-sm text-[#064e3b] font-num">
                          {amountSarFormatted} ر.س
                        </span>
                      </td>

                      {/* Method Badge */}
                      <td className="px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Allocation Details (FIFO) */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.allocations && p.allocations.length > 0 ? (
                            p.allocations.map((a, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-num font-semibold"
                              >
                                قسط #{a.installmentNumber}: {a.allocatedAmountSar} ر.س
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400">سداد دفعة</span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 whitespace-nowrap text-gray-500 font-num text-[11px]">
                        {p.createdAt.split("T")[0]}
                      </td>

                      {/* Created By & Notes */}
                      <td className="pl-6 pr-4 max-w-xs truncate text-[11px] text-gray-500" title={p.notes}>
                        <span className="font-semibold text-gray-700">{p.createdByName}</span>
                        {p.notes ? ` • ${p.notes}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="تسجيل وقيد سند قبض جديد"
      >
        <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-800 text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Contract Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              اختر العقد المستحق للسداد <span className="text-red-500">*</span>
            </label>
            {contracts.length === 0 ? (
              <div className="p-3 rounded-xl bg-orange-50 text-orange-800 text-xs border border-orange-200">
                لا توجد عقود معتمدة عليها مبالغ متبقية حالياً.
              </div>
            ) : (
              <select
                required
                value={formData.contractId}
                onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-medium"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    عقد {c.contractNumber} - {c.clientName} (وحدة: {c.unitCode}) - المتبقي: {(Number(BigInt(c.remainingBalanceHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">
                المبلغ المسدد (ر.س) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="مثال: 50000"
                value={formData.amountSar}
                onChange={(e) => setFormData({ ...formData, amountSar: e.target.value })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-num"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">
                وسيلة السداد <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-medium"
              >
                <option value="BANK_TRANSFER">حوالة بنكية</option>
                <option value="MADA">بطاقة مدى</option>
                <option value="SADAD">نظام سداد</option>
                <option value="CHEQUE">شيك بنكي مصدق</option>
                <option value="CASH">نقداً في الصندوق</option>
              </select>
            </div>
          </div>

          {/* Idempotency Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <span>مفتاح منع التكرار المالي (Idempotency Key)</span>
                <ShieldCheck className="w-3.5 h-3.5 text-[#064e3b]" />
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, idempotencyKey: generateKey() })}
                className="text-[11px] text-[#064e3b] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>توليد مفتاح جديد</span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={formData.idempotencyKey}
              className="h-9 px-3 bg-gray-50 text-gray-600 text-xs rounded-xl outline-none border border-gray-200 font-num select-all"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              ملاحظات أو مرجع الحوالة البنكية
            </label>
            <input
              type="text"
              placeholder="مثال: حوالة مصرف الراجحي - مرجع #TX-8921"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b]"
            />
          </div>

          {/* FIFO Allocation Note */}
          <div className="p-3.5 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex flex-col gap-1 text-xs">
            <span className="font-extrabold text-[#365314] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#65a30d]" />
              <span>قاعدة التوزيع المالي الذكي (FIFO Allocation):</span>
            </span>
            <p className="text-[#365314]/80 text-[11px] leading-relaxed">
              سيقوم النظام فورياً بتوزيع هذا المبلغ لسداد الأقساط غير المدفوعة ذات تاريخ الاستحقاق الأقدم أولاً حتى
              استنفاد المبلغ بالكامل، وإذا كان المبلغ أكبر من قسط واحد سيتم سداد الأقساط التالية تباعاً.
            </p>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 cursor-pointer border border-gray-200 select-none">
            <input
              type="checkbox"
              required
              checked={formData.confirmed}
              onChange={(e) => setFormData({ ...formData, confirmed: e.target.checked })}
              className="mt-0.5 rounded text-[#064e3b] accent-[#064e3b]"
            />
            <span className="text-xs text-gray-700 leading-tight">
              أقر بصحة قيد واستلام المبلغ ومطابقة الإشعار المرفق لمنع التكرار المالي والامتثال لدفاتر المحاسبة.
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="h-10 px-4 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || contracts.length === 0}
              className="h-10 px-5 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>تأكيد وقيد الدفعة</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
