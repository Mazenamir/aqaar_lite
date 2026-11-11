"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import {
  FileText,
  PlusCircle,
  CheckCircle2,
  Clock,
  Building,
  Search,
  Check,
  Calendar,
  AlertCircle,
  Eye,
  Gavel,
  ShieldCheck,
  TrendingUp,
  Receipt
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

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
  const [approvalSuccessMsg, setApprovalSuccessMsg] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
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
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات");
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
    setIsDraftModalOpen(true);
    setDraftError(null);
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setDraftError(null);

    if (draftForm.discountPercent > 5) {
      setDraftError("خصم بحد أقصى 5% - أي نسبة أعلى يرفضها النظام فوراً");
      return;
    }

    if (!draftForm.reservationId) {
      setDraftError("يرجى اختيار حجز نشط");
      return;
    }

    const downPaymentNum = parseFloat(draftForm.downPaymentSar || "0");
    if (isNaN(downPaymentNum) || downPaymentNum < 0) {
      setDraftError("الدفعة الأولى غير صحيحة");
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
          downPaymentSar: draftForm.downPaymentSar,
          installmentCount: Number(draftForm.installmentCount),
          startDate: draftForm.startDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل إنشاء مسودة العقد");
      }

      setIsDraftModalOpen(false);
      setDraftForm({
        reservationId: "",
        discountPercent: 0,
        downPaymentSar: "",
        installmentCount: 24,
        startDate: new Date().toISOString().split("T")[0],
      });
      await fetchContracts();
      if (json.data?.id) {
        setSelectedContractId(json.data.id);
      }
    } catch (err: any) {
      setDraftError(err.message);
    } finally {
      setSubmittingDraft(false);
    }
  };

  const handleApproveContract = async (contractId: string) => {
    if (!confirm("هل أنت متأكد من اعتماد هذا العقد؟ سيتم تحويل حالة العقد إلى معتمد (ACTIVE) وترحيل جدول الأقساط وتحويل حالة الوحدة إلى مباعة (SOLD).")) {
      return;
    }

    setApprovingId(contractId);
    setApprovalSuccessMsg(null);

    try {
      const res = await fetch(`/api/contracts/${contractId}/approve`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل اعتماد العقد");
      }

      setApprovalSuccessMsg("تم اعتماد العقد بنجاح وترحيل الأقساط وتحديث حالة الوحدة إلى مباعة!");
      await fetchContracts();
    } catch (err: any) {
      alert(err.message || "فشل اعتماد العقد");
    } finally {
      setApprovingId(null);
    }
  };

  // Selected reservation details for live calc in modal
  const selectedReservation = activeReservations.find((r) => r.id === draftForm.reservationId);
  const unitPrice = selectedReservation ? selectedReservation.unit.rawPriceNumber : 0;
  const discountVal = (unitPrice * (draftForm.discountPercent || 0)) / 100;
  const finalPrice = Math.max(0, unitPrice - discountVal);
  const downPaymentVal = parseFloat(draftForm.downPaymentSar || "0") || 0;
  const remainingForInstallments = Math.max(0, finalPrice - downPaymentVal);
  const approxMonthly = draftForm.installmentCount > 0 ? (remainingForInstallments / draftForm.installmentCount) : 0;

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchesSearch =
        c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.client.name.toLowerCase().includes(search.toLowerCase()) ||
        c.unit.code.toLowerCase().includes(search.toLowerCase()) ||
        c.unit.project.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      return c.status === statusFilter;
    });
  }, [contracts, search, statusFilter]);

  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];

  // Calculations for KPI Cards
  const activeContractsCount = contracts.filter((c) => c.status === "APPROVED").length;
  const pendingApprovalCount = contracts.filter((c) => c.status === "DRAFT").length;
  const totalScheduledSar = contracts
    .reduce((sum, c) => sum + (Number(c.finalPriceHalalas) - Number(c.downPaymentHalalas)), 0) / 100;

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Header Banner & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden">
          <div className="absolute -left-12 -top-12 w-56 h-56 rounded-full bg-primary-fixed-dim/20 blur-2xl pointer-events-none"></div>
          <div className="flex flex-col gap-1 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
              <span className="text-xs text-on-surface-variant font-medium">سجل المعاملات والتوثيق المالي</span>
            </div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">إدارة العقود وجداول الأقساط</h1>
            <p className="text-xs text-on-surface-variant max-w-2xl">
              إنشاء مسودات العقود من الحجوزات النشطة واعتمادها محاسبياً ومتابعة سداد الأقساط الشهرية
            </p>
          </div>

          <div className="flex items-center gap-2 z-10 flex-wrap">
            {(currentUser?.role === "SALES_AGENT" || currentUser?.role === "COMPANY_ADMIN") && (
              <button
                onClick={handleOpenDraftModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 active:scale-98 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إنشاء مسودة عقد من حجز نشط</span>
              </button>
            )}
          </div>
        </div>

        {approvalSuccessMsg && (
          <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-secondary" />
              <span>{approvalSuccessMsg}</span>
            </div>
            <button onClick={() => setApprovalSuccessMsg(null)} className="text-xs underline">
              إغلاق
            </button>
          </div>
        )}

        {/* KPI Pulse Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-medium">إجمالي العقود النشطة</span>
              <Gavel className="w-5 h-5 text-secondary" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-on-surface font-mono">
                {activeContractsCount} <span className="text-xs text-on-surface-variant font-normal">عقداً</span>
              </div>
              <div className="flex items-center gap-1 text-primary text-[11px] mt-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>سارية ومعتمدة بالنظام</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-medium">محفظة الأقساط المجدولة</span>
              <Building className="w-5 h-5 text-secondary" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-on-surface font-mono">
                {totalScheduledSar.toLocaleString("ar-SA")}{" "}
                <span className="text-xs text-on-surface-variant font-normal">ر.س</span>
              </div>
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] mt-1">
                <span>توزع شهرياً عبر العقود</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-medium">بانتظار تدقيق واعتماد المحاسب</span>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-amber-700 font-mono">
                {pendingApprovalCount} <span className="text-xs text-on-surface-variant font-normal">عقود</span>
              </div>
              <div className="flex items-center gap-1 text-amber-600 text-[11px] mt-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                <span>تتطلب مراجعة الدفعة الأولى</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-medium">إجمالي العقود المسجلة</span>
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-primary font-mono">{contracts.length}</div>
              <div className="flex items-center gap-1 text-primary text-[11px] mt-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>شاملة المسودات والمعتمدة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tabs Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest p-2 rounded-xl shadow-sm border border-outline-variant/20">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-primary-container text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              الكل ({contracts.length})
            </button>
            <button
              onClick={() => setStatusFilter("DRAFT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "DRAFT"
                  ? "bg-amber-100 text-amber-900 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              مسودة بانتظار الاعتماد ({contracts.filter((c) => c.status === "DRAFT").length})
            </button>
            <button
              onClick={() => setStatusFilter("APPROVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "APPROVED"
                  ? "bg-secondary-container text-on-secondary-container shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              ساري ومعتمد ({contracts.filter((c) => c.status === "APPROVED").length})
            </button>
            <button
              onClick={() => setStatusFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "COMPLETED"
                  ? "bg-surface-container-high text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              مكتمل السداد ({contracts.filter((c) => c.status === "COMPLETED").length})
            </button>
          </div>

          <div className="relative flex items-center w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="رقم العقد، العميل، الوحدة..."
              className="h-9 pr-9 pl-3 w-full bg-surface-container-low text-on-surface text-xs rounded-lg outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30"
            />
          </div>
        </div>

        {/* Detailed Contract Focus View (If selected) */}
        {selectedContract && (
          <div className="flex flex-col gap-4">
            {/* Accountant Approval Workflow Banner */}
            {selectedContract.status === "DRAFT" && (
              <div className="bg-gradient-to-l from-amber-50 to-surface-container-lowest p-5 rounded-xl shadow-sm border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-on-surface">إجراء تدقيق واعتماد المحاسب المالي</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                        قيد المراجعة المالية
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      العقد رقم {selectedContract.contractNumber} للعميل {selectedContract.client.name} بمبلغ إجمالي{" "}
                      {selectedContract.finalPriceSar} ر.س. دفعة أولى: {selectedContract.downPaymentSar} ر.س.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentUser?.role === "ACCOUNTANT" || currentUser?.role === "COMPANY_ADMIN" ? (
                    <button
                      onClick={() => handleApproveContract(selectedContract.id)}
                      disabled={approvingId === selectedContract.id}
                      className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-md hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {approvingId === selectedContract.id ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>اعتماد العقد وترحيل الأقساط (SOLD)</span>
                    </button>
                  ) : (
                    <span className="text-xs text-amber-800 bg-amber-100 px-3 py-1.5 rounded-lg font-medium">
                      بانتظار مراجعة المحاسب المالي للاعتماد
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contract Focus Bento Card */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-low">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-primary font-mono">
                        عقد بيع بالتقسيط #{selectedContract.contractNumber}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-surface-container text-on-surface">
                        {selectedContract.status === "APPROVED"
                          ? "معتمد وساري"
                          : selectedContract.status === "COMPLETED"
                          ? "مكتمل السداد"
                          : "مسودة قيد التدقيق"}
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      تاريخ البدء: {selectedContract.startDate} | أنشئ بواسطة: {selectedContract.createdBy}
                      {selectedContract.approvedBy && ` | معتمد بواسطة: ${selectedContract.approvedBy}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">خصم مطبق:</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono font-bold">
                    {selectedContract.discountPercent}%
                  </span>
                </div>
              </div>

              {/* Parties Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
                  <span className="text-xs text-secondary font-bold">الطرف الأول (البائع)</span>
                  <div className="text-sm font-bold text-on-surface mt-1">شركة عقار لايت للتطوير العقاري</div>
                  <span className="text-xs text-on-surface-variant">الفرع المعتمد - الرياض</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
                  <span className="text-xs text-secondary font-bold">الطرف الثاني (المشتري)</span>
                  <div className="text-sm font-bold text-on-surface mt-1">{selectedContract.client.name}</div>
                  <span className="text-xs text-on-surface-variant font-mono" dir="ltr">
                    {selectedContract.client.phone}
                  </span>
                </div>
              </div>

              {/* Unit & Financials Grid */}
              <div className="p-4 rounded-xl bg-surface-container flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Building className="w-8 h-8 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs text-on-surface-variant">الوحدة العقارية المتعاقد عليها</span>
                    <span className="text-base font-bold text-on-surface">
                      {selectedContract.unit.project} - وحدة #{selectedContract.unit.code} ({selectedContract.unit.type})
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[11px]">السعر النهائي</span>
                    <span className="font-bold text-sm text-primary">{selectedContract.finalPriceSar} ر.س</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[11px]">الدفعة الأولى</span>
                    <span className="font-bold text-sm text-on-surface">{selectedContract.downPaymentSar} ر.س</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[11px]">المسدد للأقساط</span>
                    <span className="font-bold text-sm text-secondary">{selectedContract.totalPaidSar} ر.س</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-on-surface-variant text-[11px]">المتبقي من العقد</span>
                    <span className="font-bold text-sm text-amber-700">{selectedContract.remainingBalanceSar} ر.س</span>
                  </div>
                </div>
              </div>

              {/* Installments Schedule Table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-on-surface">
                      جدول الأقساط الشهرية ({selectedContract.installments.length} قسط)
                    </h3>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    القسط الأول يشمل كسور الهللات لضمان دقة 100%
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-outline-variant/20 max-h-72 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="sticky top-0 bg-surface-container-high text-on-surface font-semibold z-10">
                      <tr className="h-9">
                        <th className="pr-4 pl-2">#</th>
                        <th className="px-3">تاريخ الاستحقاق</th>
                        <th className="px-3">المبلغ المستحق</th>
                        <th className="px-3">المسدد</th>
                        <th className="px-3 text-center">الحالة</th>
                        <th className="px-3">تاريخ السداد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container bg-surface-container-lowest font-mono">
                      {selectedContract.installments.map((inst) => (
                        <tr key={inst.id} className="h-10 hover:bg-surface/50 transition-colors">
                          <td className="pr-4 pl-2 font-bold text-primary">#{inst.installmentNumber}</td>
                          <td className="px-3">{inst.dueDate}</td>
                          <td className="px-3 font-semibold">{inst.amountSar} ر.س</td>
                          <td className="px-3 text-secondary">{inst.paidAmountSar} ر.س</td>
                          <td className="px-3 text-center">
                            {inst.status === "PAID" ? (
                              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-bold text-[10px]">
                                مدفوع
                              </span>
                            ) : inst.status === "PARTIALLY_PAID" ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                                سداد جزئي
                              </span>
                            ) : inst.status === "OVERDUE" ? (
                              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-bold text-[10px]">
                                متأخر
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-bold text-[10px]">
                                قيد الانتظار
                              </span>
                            )}
                          </td>
                          <td className="px-3 text-on-surface-variant text-[11px]">
                            {inst.paidAt ? inst.paidAt.split("T")[0] : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Master Comprehensive Contracts Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-on-surface">سجل كافة العقود والاتفاقيات الرسمية</h2>
                <span className="text-xs text-on-surface-variant">
                  انقر على أي عقد لمعاينة جدوله المالي وتفاصيل الدفعات
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">جاري تحميل سجلات العقود...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
              <table className="w-full text-right text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant font-semibold select-none">
                <tr className="h-11">
                  <th className="px-4">رقم العقد</th>
                  <th className="px-4">العميل (المشتري)</th>
                  <th className="px-4">الوحدة العقارية</th>
                  <th className="px-4">قيمة العقد</th>
                  <th className="px-4">المسدد</th>
                  <th className="px-4 text-center">حالة العقد</th>
                  <th className="px-4">المسؤول / المحاسب</th>
                  <th className="px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface">
                {filteredContracts.map((c) => {
                  const isSelected = c.id === selectedContract?.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContractId(c.id)}
                      className={`h-14 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary-fixed-dim/20 font-semibold" : "hover:bg-surface/60"
                      }`}
                    >
                      <td className="px-4 font-mono font-bold text-primary">#{c.contractNumber}</td>
                      <td className="px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{c.client.name}</span>
                          <span className="text-[11px] text-on-surface-variant font-mono" dir="ltr">
                            {c.client.phone}
                          </span>
                        </div>
                      </td>
                      <td className="px-4">
                        <span className="font-medium">
                          {c.unit.project} - {c.unit.code}
                        </span>
                      </td>
                      <td className="px-4 font-mono font-bold">{c.finalPriceSar} ر.س</td>
                      <td className="px-4 font-mono text-secondary font-bold">{c.totalPaidSar} ر.س</td>
                      <td className="px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            c.status === "APPROVED"
                              ? "bg-secondary-container text-on-secondary-container"
                              : c.status === "COMPLETED"
                              ? "bg-surface-container text-on-surface"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {c.status === "APPROVED"
                            ? "ساري ومعتمد"
                            : c.status === "COMPLETED"
                            ? "مكتمل السداد"
                            : "مسودة بانتظار الاعتماد"}
                        </span>
                      </td>
                      <td className="px-4 text-[11px] text-on-surface-variant">
                        {c.approvedBy ? `معتمد: ${c.approvedBy}` : `أنشأه: ${c.createdBy}`}
                      </td>
                      <td className="px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContractId(c.id);
                          }}
                          className="p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Create Draft Modal */}
        <Modal
          isOpen={isDraftModalOpen}
          onClose={() => setIsDraftModalOpen(false)}
          title="إنشاء مسودة عقد من حجز نشط"
        >
          <form onSubmit={handleCreateDraft} className="flex flex-col gap-4">
            {draftError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{draftError}</span>
              </div>
            )}

            {/* Active Reservation Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                <span>اختر الحجز النشط <span className="text-error">*</span></span>
                {loadingReservations && <span className="text-[10px] text-primary">جاري التحميل...</span>}
              </label>

              {activeReservations.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 text-amber-900 text-xs border border-amber-200 flex flex-col gap-1">
                  <span className="font-bold">لا يوجد حجوزات نشطة حالياً</span>
                  <span>
                    وفقاً لقواعد النظام: لا يمكن إنشاء عقد إلا بناء على حجز نشط غير منتهي. يرجى حجز وحدة أولاً من
                    صفحة الوحدات العقارية.
                  </span>
                </div>
              ) : (
                <select
                  value={draftForm.reservationId}
                  onChange={(e) => setDraftForm({ ...draftForm, reservationId: e.target.value })}
                  className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20"
                  required
                >
                  {activeReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.unit.project} - وحدة #{r.unit.code} ({r.unit.priceSar} ر.س) - العميل: {r.client.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedReservation && (
              <div className="p-3 rounded-xl bg-surface-container-low text-xs flex items-center justify-between font-mono">
                <span className="text-on-surface-variant">سعر الوحدة الأصلي:</span>
                <span className="font-bold text-primary">{selectedReservation.unit.priceSar} ر.س</span>
              </div>
            )}

            {/* Discount Percent (Max 5%) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface">
                  نسبة الخصم المالي (%) <span className="text-on-surface-variant font-normal">(بحد أقصى 5%)</span>
                </label>
                {draftForm.discountPercent > 5 && (
                  <span className="text-xs text-error font-bold">تجاوزت الحد الأقصى (5%)!</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                max="5"
                step="1"
                required
                value={draftForm.discountPercent}
                onChange={(e) => setDraftForm({ ...draftForm, discountPercent: parseInt(e.target.value, 10) || 0 })}
                className={`h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border font-mono ${
                  draftForm.discountPercent > 5
                    ? "border-error focus:ring-error"
                    : "border-outline-variant/40 focus:ring-primary/20"
                }`}
              />
            </div>

            {/* Down Payment & Installments Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  الدفعة الأولى (ر.س) <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="مثال: 150000"
                  value={draftForm.downPaymentSar}
                  onChange={(e) => setDraftForm({ ...draftForm, downPaymentSar: e.target.value })}
                  className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  عدد الأقساط (بالأشهر) <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={draftForm.installmentCount}
                  onChange={(e) => setDraftForm({ ...draftForm, installmentCount: parseInt(e.target.value, 10) || 1 })}
                  className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                تاريخ بداية العقد <span className="text-on-surface-variant font-normal">(يحدد يوم استحقاق الأقساط)</span>
              </label>
              <input
                type="date"
                required
                value={draftForm.startDate}
                onChange={(e) => setDraftForm({ ...draftForm, startDate: e.target.value })}
                className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>

            {/* Live Financial Invariants Box */}
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between text-on-surface-variant">
                <span>السعر بعد الخصم:</span>
                <span className="font-bold text-on-surface">{finalPrice.toLocaleString("ar-SA")} ر.س</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>الدفعة الأولى المدخلة:</span>
                <span className="font-bold text-on-surface">{downPaymentVal.toLocaleString("ar-SA")} ر.س</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>المبلغ المتبقي للأقساط:</span>
                <span className="font-bold text-primary">{remainingForInstallments.toLocaleString("ar-SA")} ر.س</span>
              </div>
              <div className="flex justify-between text-on-surface font-semibold pt-1 border-t border-outline-variant/20">
                <span>القسط الشهري التقريبي:</span>
                <span className="text-secondary">{approxMonthly.toLocaleString("ar-SA")} ر.س / شهر</span>
              </div>
              <span className="text-[10px] text-on-surface-variant pt-1 font-sans">
                * ملاحظة: يتم حساب الأقساط بالهللة بدقة 100% ويضاف أي كسر بالهللات للقسط الأول تلقائياً.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submittingDraft || activeReservations.length === 0 || draftForm.discountPercent > 5}
                className="h-10 px-5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
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
    </AppShell>
  );
}
