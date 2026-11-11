"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/Modal";
import {
  FileText,
  PlusCircle,
  CheckCircle2,
  Clock,
  Building,
  Search,
  Check,
  AlertCircle,
  Gavel,
  Receipt,
  RefreshCw,
  Coins
} from "lucide-react";

interface InstallmentItem {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountHalalas: string;
  amountSar: string;
  paidAmountHalalas: string;
  paidAmountSar: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  paidAt: string | null;
}

interface ContractItem {
  id: string;
  contractNumber: string;
  status: "DRAFT" | "APPROVED" | "COMPLETED";
  unit: {
    id: string;
    code: string;
    project: string;
    type: string;
  };
  client: {
    id: string;
    name: string;
    phone: string;
  };
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  startDate: string;
  discountPercent: number;
  unitPriceHalalas: string;
  finalPriceHalalas: string;
  finalPriceSar: string;
  downPaymentHalalas: string;
  downPaymentSar: string;
  totalPaidHalalas: string;
  totalPaidSar: string;
  remainingBalanceHalalas: string;
  remainingBalanceSar: string;
  installments: InstallmentItem[];
}

interface ActiveReservation {
  id: string;
  expiresAt: string;
  unit: {
    id: string;
    code: string;
    project: string;
    type: string;
    priceHalalas: string;
    priceSar: string;
    rawPriceNumber: number;
  };
  client: {
    id: string;
    name: string;
    phone: string;
  };
  agentName: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  companyName?: string;
}

interface ContractsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function ContractsView({ onNavigateTab: _onNavigateTab }: ContractsViewProps) {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");

  // Selected contract for detail focus view
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Draft Modal
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [activeReservations, setActiveReservations] = useState<ActiveReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const [draftForm, setDraftForm] = useState({
    reservationId: "",
    discountPercent: 0,
    downPaymentSar: "",
    installmentCount: 24,
    startDate: new Date().toISOString().split("T")[0],
  });
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submittingDraft, setSubmittingDraft] = useState(false);

  // Approval state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
        if (json.user?.companyName) setCompanyName(json.user.companyName);
      }
    } catch (e) {}
  };

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/contracts");
      if (!res.ok) throw new Error("تعذر تحميل قائمة العقود");
      const json = await res.json();
      if (json.success) {
        setContracts(json.data);
        if (json.data.length > 0 && !selectedContractId) {
          setSelectedContractId(json.data[0].id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveReservations = async () => {
    try {
      setLoadingReservations(true);
      const res = await fetch("/api/reservations");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setActiveReservations(json.data);
          if (json.data.length > 0) {
            setDraftForm((prev) => ({ ...prev, reservationId: json.data[0].id }));
          }
        }
      }
    } catch (e) {
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchContracts();
  }, []);

  const handleOpenDraftModal = () => {
    fetchActiveReservations();
    setDraftError(null);
    setIsDraftModalOpen(true);
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setDraftError(null);

    if (draftForm.discountPercent > 5) {
      setDraftError("خصم المندوب مقيد بحد أقصى 5% وفقاً لسياسة الشركة");
      return;
    }

    if (!draftForm.reservationId) {
      setDraftError("يرجى اختيار الحجز المراد إنشاء العقد له");
      return;
    }

    setSubmittingDraft(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: draftForm.reservationId,
          discountPercent: Number(draftForm.discountPercent),
          downPaymentSar: Number(draftForm.downPaymentSar) || 0,
          installmentCount: Number(draftForm.installmentCount),
          startDate: draftForm.startDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل إنشاء مسودة العقد");
      }

      setIsDraftModalOpen(false);
      setFeedbackMsg({ type: "success", text: `تم إنشاء مسودة العقد ${json.data.contractNumber} بنجاح` });
      fetchContracts();
      setSelectedContractId(json.data.id);
    } catch (err: unknown) {
      setDraftError(err instanceof Error ? err.message : "فشل إنشاء مسودة العقد");
    } finally {
      setSubmittingDraft(false);
    }
  };

  const handleApproveContract = async (contractId: string) => {
    setApprovingId(contractId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/approve`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل اعتماد العقد");
      }

      setFeedbackMsg({ type: "success", text: `تم اعتماد العقد ${json.data.contractNumber} وترحيله محاسبياً بنجاح` });
      fetchContracts();
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ أثناء اعتماد العقد" });
    } finally {
      setApprovingId(null);
    }
  };

  const selectedContract = useMemo(() => {
    return contracts.find((c) => c.id === selectedContractId) || contracts[0] || null;
  }, [contracts, selectedContractId]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchesSearch =
        c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.client.name.toLowerCase().includes(search.toLowerCase()) ||
        c.unit.code.toLowerCase().includes(search.toLowerCase()) ||
        c.unit.project.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      return true;
    });
  }, [contracts, search, statusFilter]);

  // Live calculation for draft modal
  const selectedReservation = activeReservations.find((r) => r.id === draftForm.reservationId);
  const basePrice = selectedReservation ? (Number(BigInt(selectedReservation.unit.priceHalalas) / 100n)) : 0;
  const discountAmount = (basePrice * (draftForm.discountPercent || 0)) / 100;
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const downPaymentVal = Number(draftForm.downPaymentSar) || 0;
  const remainingForInstallments = Math.max(0, finalPrice - downPaymentVal);
  const approxMonthly = draftForm.installmentCount > 0 ? Math.round(remainingForInstallments / draftForm.installmentCount) : 0;

  // Counts for Bento Cards
  const totalContracts = contracts.length;
  const approvedContracts = contracts.filter((c) => c.status === "APPROVED").length;
  const draftContracts = contracts.filter((c) => c.status === "DRAFT").length;
  const totalRemainingSar = useMemo(() => {
    const totalHalalas = contracts.reduce((acc, c) => acc + BigInt(c.remainingBalanceHalalas || "0"), 0n);
    return (Number(totalHalalas) / 100).toLocaleString("en-US");
  }, [contracts]);

  const canApprove = currentUser?.role === "ACCOUNTANT" || currentUser?.role === "COMPANY_ADMIN";

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        {/* Title */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>العقود وجداول الأقساط</span>
            <span className="text-2xl">📑</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            إعداد مسودات العقود، تطبيق قيود الخصم (5% كحد أقصى)، واعتماد وترحيل الدفاتر المالية.
          </p>
        </div>

        {/* Action & Utility Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenDraftModal}
            className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ إنشاء مسودة عقد</span>
          </button>

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم العقد أو العميل..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-44 sm:w-56 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchContracts}
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
        {/* Total Contracts Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#d9f99d]/50 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              إجمالي العقود
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {totalContracts}
              </span>
              <span className="text-xs font-bold text-gray-500">عقد مسجل</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              شاملة العقود المعتمدة والمسودات
            </p>
          </div>
        </div>

        {/* Approved Contracts Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#bbf7d0]/50 rounded-[50%_50%_30%_70%/60%_40%_60%_40%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center font-bold text-xs shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              معتمدة رسمياً
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {approvedContracts}
              </span>
              <span className="text-xs font-bold text-emerald-700">عقد معتمد</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              تم ترحيلها محاسبياً وتثبيت أقساطها
            </p>
          </div>
        </div>

        {/* Draft Contracts Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#fed7aa]/50 rounded-[40%_60%_60%_40%/50%_50%_50%_50%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <Gavel className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              بانتظار الاعتماد
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {draftContracts}
              </span>
              <span className="text-xs font-bold text-orange-700">مسودة متبقية</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              تنتظر مراجعة المحاسب أو مدير النظام
            </p>
          </div>
        </div>

        {/* Total Outstanding Balance */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              مستحقات الأقساط
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-num text-white tracking-tight">
                {totalRemainingSar}
              </span>
              <span className="text-xs font-bold text-[#86efac]">ر.س</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
              إجمالي رصيد الأقساط المتبقية للتحصيل
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
          الكل ({contracts.length})
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "APPROVED"
              ? "bg-[#047857] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المعتمدة ({approvedContracts})
        </button>
        <button
          onClick={() => setStatusFilter("DRAFT")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "DRAFT"
              ? "bg-[#ea580c] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المسودات ({draftContracts})
        </button>
      </div>

      {/* CONTRACTS WORKSPACE: TWO COLUMN VIEW (Table + Live Schedule Focus) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* CONTRACTS TABLE (7 COLS) */}
        <div className="xl:col-span-7 bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#002117]">سجل العقود والمبيعات</span>
            <span className="text-[11px] text-gray-400 font-num">{filteredContracts.length} عقد</span>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-gray-500">جاري تحميل سجل العقود...</span>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span className="text-xs font-bold">{error}</span>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <FileText className="w-12 h-12 stroke-[1.2] text-gray-300" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-gray-700">لا توجد عقود مطابقة</span>
                <span className="text-xs text-gray-400">أنشئ مسودة عقد جديدة من أحد الحجوزات القائمة</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                  <tr className="h-10">
                    <th className="pr-5 pl-3">رقم العقد</th>
                    <th className="px-3">العميل والوحدة</th>
                    <th className="px-3">القيمة والخصم</th>
                    <th className="px-3">الحالة</th>
                    <th className="pl-5 pr-3 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80 text-gray-800">
                  {filteredContracts.map((c) => {
                    const isSelected = selectedContract?.id === c.id;
                    const finalSarFormatted = (Number(BigInt(c.finalPriceHalalas) / 100n)).toLocaleString("en-US");
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedContractId(c.id)}
                        className={`h-16 transition-colors cursor-pointer group ${
                          isSelected ? "bg-[#f4f7f4]" : "hover:bg-[#fafaf8]"
                        }`}
                      >
                        {/* Contract Number */}
                        <td className="pr-5 pl-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-[#002117] text-xs font-num group-hover:text-[#064e3b] transition-colors">
                              {c.contractNumber}
                            </span>
                            <span className="text-[10px] text-gray-400 font-num">
                              {c.startDate}
                            </span>
                          </div>
                        </td>

                        {/* Client & Unit */}
                        <td className="px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800 text-xs">{c.client.name}</span>
                            <span className="text-[10px] text-gray-500 font-num">
                              وحدة: <span className="font-bold text-gray-700">{c.unit.code}</span> ({c.unit.project})
                            </span>
                          </div>
                        </td>

                        {/* Price & Discount */}
                        <td className="px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-800 text-xs font-num">
                              {finalSarFormatted} ر.س
                            </span>
                            {c.discountPercent > 0 && (
                              <span className="text-[10px] text-orange-700 font-num font-bold">
                                خصم: {c.discountPercent}%
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-3 whitespace-nowrap">
                          {c.status === "APPROVED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] font-bold text-[10px] border border-emerald-200/60">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>معتمد رسمياً</span>
                            </span>
                          ) : c.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e0e7ff] text-[#3730a3] font-bold text-[10px] border border-indigo-200/60">
                              <Check className="w-3 h-3" />
                              <span>مكتمل السداد</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffedd5] text-[#9a3412] font-bold text-[10px] border border-orange-200/60">
                              <Clock className="w-3 h-3" />
                              <span>مسودة</span>
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="pl-5 pr-3 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {c.status === "DRAFT" && canApprove ? (
                            <button
                              onClick={() => handleApproveContract(c.id)}
                              disabled={approvingId === c.id}
                              className="bg-[#064e3b] hover:bg-[#003527] text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xs transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {approvingId === c.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <Gavel className="w-3 h-3" />
                              )}
                              <span>اعتماد العقد</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedContractId(c.id)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                            >
                              الأقساط ({c.installments?.length || 0})
                            </button>
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

        {/* INSTALLMENTS SCHEDULE & CONTRACT FOCUS (5 COLS) */}
        <div className="xl:col-span-5 bg-white rounded-[28px] border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          {selectedContract ? (
            <div className="flex flex-col gap-4">
              {/* Header Focus */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#002117] text-sm font-num">
                      عقد {selectedContract.contractNumber}
                    </span>
                    {selectedContract.status === "APPROVED" ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] font-bold text-[10px]">
                        معتمد
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#ffedd5] text-[#9a3412] font-bold text-[10px]">
                        مسودة
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    العميل: <strong className="text-gray-700">{selectedContract.client.name}</strong> • وحدة: <strong className="text-gray-700">{selectedContract.unit.code}</strong>
                  </span>
                </div>

                {selectedContract.status === "DRAFT" && canApprove && (
                  <button
                    onClick={() => handleApproveContract(selectedContract.id)}
                    disabled={approvingId === selectedContract.id}
                    className="bg-[#064e3b] hover:bg-[#003527] text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {approvingId === selectedContract.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Gavel className="w-3.5 h-3.5" />
                    )}
                    <span>اعتماد رسمي</span>
                  </button>
                )}
              </div>

              {/* Summary Stats Pill Box */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[#fcfdfa] border border-gray-100 font-num text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-medium">القيمة الإجمالية</span>
                  <span className="font-extrabold text-gray-800 text-sm">
                    {(Number(BigInt(selectedContract.finalPriceHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-medium">الدفعة الأولى المدفوعة</span>
                  <span className="font-extrabold text-[#064e3b] text-sm">
                    {(Number(BigInt(selectedContract.downPaymentHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </span>
                </div>
                <div className="flex flex-col pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 font-medium">المسدد من الأقساط</span>
                  <span className="font-extrabold text-indigo-700 text-sm">
                    {(Number(BigInt(selectedContract.totalPaidHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </span>
                </div>
                <div className="flex flex-col pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 font-medium">المتبقي للتحصيل</span>
                  <span className="font-extrabold text-orange-700 text-sm">
                    {(Number(BigInt(selectedContract.remainingBalanceHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </span>
                </div>
              </div>

              {/* Installments List */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>جدول الأقساط الشهرية ({selectedContract.installments.length})</span>
                  <span className="text-[10px] text-gray-400 font-normal">دقة 100% بالهللة</span>
                </div>

                <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                  {selectedContract.installments.map((inst) => {
                    const instAmountSar = (Number(BigInt(inst.amountHalalas) / 100n)).toLocaleString("en-US");
                    const paidSar = (Number(BigInt(inst.paidAmountHalalas) / 100n)).toLocaleString("en-US");
                    return (
                      <div
                        key={inst.id}
                        className="p-3 rounded-2xl border border-gray-100 bg-white flex items-center justify-between hover:border-gray-200 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full font-num font-black text-xs flex items-center justify-center shrink-0 ${
                              inst.status === "PAID"
                                ? "bg-[#dcfce7] text-[#166534]"
                                : inst.status === "PARTIALLY_PAID"
                                ? "bg-[#ffedd5] text-[#9a3412]"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {inst.installmentNumber}
                          </div>
                          <div className="flex flex-col font-num">
                            <span className="font-bold text-gray-800 text-xs">
                              {instAmountSar} ر.س
                            </span>
                            <span className="text-[10px] text-gray-400">
                              استحقاق: {inst.dueDate}
                            </span>
                          </div>
                        </div>

                        <div>
                          {inst.status === "PAID" ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] font-bold text-[10px]">
                              مسدد
                            </span>
                          ) : inst.status === "PARTIALLY_PAID" ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#ffedd5] text-[#9a3412] font-bold text-[10px] font-num">
                              مسدد جزئياً ({paidSar} ر.س)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold text-[10px]">
                              غير مدفوع
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Receipt className="w-10 h-10 stroke-[1.2] text-gray-300" />
              <span className="text-xs font-semibold">اختر عقداً من القائمة لعرض جدول أقساطه</span>
            </div>
          )}
        </div>
      </div>

      {/* CREATE DRAFT MODAL */}
      <Modal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        title="إنشاء مسودة عقد بيع وتقسيط"
      >
        <form onSubmit={handleCreateDraft} className="flex flex-col gap-4">
          {draftError && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-800 text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{draftError}</span>
            </div>
          )}

          {/* Reservation Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              اختر الحجز الفعال للعميل <span className="text-red-500">*</span>
            </label>
            {loadingReservations ? (
              <span className="text-xs text-gray-400">جاري تحميل الحجوزات...</span>
            ) : activeReservations.length === 0 ? (
              <div className="p-3 rounded-xl bg-orange-50 text-orange-800 text-xs border border-orange-200">
                لا توجد حجوزات جارية صالحة لإنشاء عقد. يرجى حجز وحدة لعميل أولاً من صفحة الوحدات.
              </div>
            ) : (
              <select
                required
                value={draftForm.reservationId}
                onChange={(e) => setDraftForm({ ...draftForm, reservationId: e.target.value })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-medium"
              >
                {activeReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    وحدة {r.unit.code} ({r.unit.project}) - العميل: {r.client.name} - السعر: {(Number(BigInt(r.unit.priceHalalas) / 100n)).toLocaleString("en-US")} ر.س
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Discount Field with hard 5% policy cap */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">
                نسبة الخصم التجاري (%)
              </label>
              <span className="text-[10px] font-bold text-[#064e3b] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                الحد الأقصى المسموح: 5%
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                min="0"
                max="5"
                step="0.5"
                required
                value={draftForm.discountPercent}
                onChange={(e) => setDraftForm({ ...draftForm, discountPercent: parseFloat(e.target.value) || 0 })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] w-full font-num"
              />
              <span className="absolute left-3 text-xs text-gray-400 font-bold">%</span>
            </div>
          </div>

          {/* Down payment & Installment count */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">
                الدفعة الأولى (ر.س)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="مثال: 150000"
                value={draftForm.downPaymentSar}
                onChange={(e) => setDraftForm({ ...draftForm, downPaymentSar: e.target.value })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-num"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">
                عدد الأقساط (بالأشهر) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={draftForm.installmentCount}
                onChange={(e) => setDraftForm({ ...draftForm, installmentCount: parseInt(e.target.value, 10) || 1 })}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-num"
              />
            </div>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              تاريخ بداية العقد
            </label>
            <input
              type="date"
              required
              value={draftForm.startDate}
              onChange={(e) => setDraftForm({ ...draftForm, startDate: e.target.value })}
              className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-num"
            />
          </div>

          {/* Live Invariant Box */}
          <div className="p-3.5 rounded-2xl bg-[#fcfdfa] border border-gray-100 flex flex-col gap-2 font-num text-xs">
            <div className="flex justify-between text-gray-500">
              <span>السعر بعد الخصم:</span>
              <span className="font-bold text-gray-800">{finalPrice.toLocaleString("en-US")} ر.س</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>الدفعة الأولى المدخلة:</span>
              <span className="font-bold text-gray-800">{downPaymentVal.toLocaleString("en-US")} ر.س</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>المتبقي للأقساط:</span>
              <span className="font-bold text-[#064e3b]">{remainingForInstallments.toLocaleString("en-US")} ر.س</span>
            </div>
            <div className="flex justify-between text-gray-800 font-bold pt-1.5 border-t border-gray-100">
              <span>القسط الشهري التقريبي:</span>
              <span className="text-emerald-800 font-black">{approxMonthly.toLocaleString("en-US")} ر.س / شهر</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsDraftModalOpen(false)}
              className="h-10 px-4 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submittingDraft || activeReservations.length === 0 || draftForm.discountPercent > 5}
              className="h-10 px-5 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submittingDraft ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>حفظ مسودة العقد</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
