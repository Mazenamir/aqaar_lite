"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
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
  Check
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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        setCurrentUser(json.user);
      }
    } catch (e) {}
  };

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
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات");
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
          const eligible = json.data
            .filter((c: any) => c.status === "APPROVED" && BigInt(c.remainingBalanceHalalas) > 0n)
            .map((c: any) => ({
              id: c.id,
              contractNumber: c.contractNumber,
              clientName: c.client.name,
              unitCode: c.unit.code,
              remainingBalanceHalalas: c.remainingBalanceHalalas,
              remainingBalanceSar: c.remainingBalanceSar,
              status: c.status,
            }));
          setContracts(eligible);
          if (eligible.length > 0 && !formData.contractId) {
            setFormData((prev) => ({ ...prev, contractId: eligible[0].id }));
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

    const amountNum = parseFloat(formData.amountSar);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("يرجى إدخال مبلغ سداد صحيح أكبر من الصفر");
      return;
    }

    // Balance check
    const selectedContract = contracts.find((c) => c.id === formData.contractId);
    if (selectedContract) {
      const maxRemainingSar = Number(selectedContract.remainingBalanceHalalas) / 100;
      if (amountNum > maxRemainingSar) {
        setFormError(`مبلغ الدفعة (${amountNum.toLocaleString("ar-SA")} ر.س) يتجاوز الرصيد المتبقي بالعقد (${maxRemainingSar.toLocaleString("ar-SA")} ر.س)`);
        return;
      }
    }

    if (!formData.confirmed) {
      setFormError("يرجى الإقرار بصحة استلام المبلغ ومطابقته");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: formData.contractId,
          amountSar: formData.amountSar,
          method: formData.method,
          idempotencyKey: formData.idempotencyKey,
          notes: formData.notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل تسجيل الدفعة");
      }

      setIsModalOpen(false);
      setSuccessMsg(`تم إصدار سند القبض رقم #${json.data.receiptNumber} بنجاح وتوزيع المبلغ تلقائياً على الأقساط (FIFO)!`);
      await fetchPayments();
      await fetchContractsForPayment();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "BANK_TRANSFER":
        return { label: "تحويل بنكي سريع (سريع)", color: "bg-blue-100 text-blue-900 border-blue-200" };
      case "MADA":
        return { label: "مدى / بطاقة بنكية", color: "bg-emerald-100 text-emerald-900 border-emerald-200" };
      case "SADAD":
        return { label: "نظام سداد الإلكتروني", color: "bg-purple-100 text-purple-900 border-purple-200" };
      case "CHEQUE":
        return { label: "شيك مصرفي مصدق", color: "bg-amber-100 text-amber-900 border-amber-200" };
      case "CASH":
        return { label: "إيداع نقدي مباشر", color: "bg-gray-100 text-gray-800 border-gray-200" };
      default:
        return { label: method, color: "bg-surface-container text-on-surface border-surface-container" };
    }
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        p.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName.toLowerCase().includes(search.toLowerCase()) ||
        p.unitCode.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (methodFilter === "all") return true;
      return p.method === methodFilter;
    });
  }, [payments, search, methodFilter]);

  // Financial KPIs
  const totalCollectedHalalas = payments.reduce((sum, p) => sum + BigInt(p.amountHalalas), 0n);
  const totalCollectedSar = (Number(totalCollectedHalalas) / 100).toLocaleString("ar-SA");

  const totalOutstandingHalalas = contracts.reduce((sum, c) => sum + BigInt(c.remainingBalanceHalalas), 0n);
  const totalOutstandingSar = (Number(totalOutstandingHalalas) / 100).toLocaleString("ar-SA");

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-surface-container-high text-primary font-bold text-xs">
                المالية والتحصيل
              </span>
              <span className="text-on-surface-variant text-xs">• تحديث فوري للأرصدة وتوزيع FIFO</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">سجل المدفوعات والتحصيل</h1>
            <p className="text-xs text-on-surface-variant max-w-2xl">
              تسجيل الدفعات المالية وتوزيعها على الأقساط الأقدم فالأحدث ومتابعة الرصيد المتبقي بدقة متناهية
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(currentUser?.role === "ACCOUNTANT" || currentUser?.role === "COMPANY_ADMIN") && (
              <button
                onClick={handleOpenModal}
                className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary-container text-on-primary text-xs font-semibold shadow-md hover:bg-primary transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ تسجيل دفعة جديدة</span>
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-secondary" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs underline">
              إغلاق
            </button>
          </div>
        )}

        {/* Financial KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Collected */}
          <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant font-medium">إجمالي المبالغ المحصلة</span>
              <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center text-primary">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl text-primary font-bold font-mono">{totalCollectedSar}</span>
                <span className="text-xs text-on-surface-variant">ر.س</span>
              </div>
              <div className="flex items-center gap-1 text-secondary text-xs mt-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>موزعة بدقة عبر {payments.length} سند قبض</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 left-0 h-1 bg-gradient-to-l from-primary via-secondary to-transparent"></div>
          </div>

          {/* Outstanding Balance */}
          <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant font-medium">الرصيد الإجمالي المتبقي</span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl text-on-surface font-bold font-mono">{totalOutstandingSar}</span>
                <span className="text-xs text-on-surface-variant">ر.س</span>
              </div>
              <div className="text-xs text-on-surface-variant mt-1 font-mono">
                عبر {contracts.length} عقد بيع نشط
              </div>
            </div>
            <div className="absolute bottom-0 right-0 left-0 h-1 bg-amber-400"></div>
          </div>

          {/* Active Bank Account */}
          <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant font-medium">الحساب البنكي المعتمد</span>
              <Landmark className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-on-surface">مصرف الراجحي - الشركات</span>
              <span className="text-[11px] font-mono text-primary font-semibold mt-1" dir="ltr">
                SA44 8000 0213 6080 1004 5591
              </span>
            </div>
            <div className="absolute bottom-0 right-0 left-0 h-1 bg-primary"></div>
          </div>

          {/* Invariant Policy */}
          <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant font-medium">قاعدة التوزيع النظامية</span>
              <ShieldCheck className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-on-surface">FIFO Allocation</span>
              <span className="text-[11px] text-on-surface-variant mt-1">
                الأقساط الأقدم تسدد أولاً تلقائياً لمنع التراكم
              </span>
            </div>
            <div className="absolute bottom-0 right-0 left-0 h-1 bg-secondary"></div>
          </div>
        </div>

        {/* Search & Filter Strip */}
        <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex items-center w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الإيصال، العقد، أو العميل..."
              className="h-10 pr-10 pl-3 w-full bg-surface-container-low text-on-surface text-xs rounded-xl outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setMethodFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === "all"
                  ? "bg-primary-container text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              الكل ({payments.length})
            </button>
            <button
              onClick={() => setMethodFilter("BANK_TRANSFER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === "BANK_TRANSFER"
                  ? "bg-blue-100 text-blue-900 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              تحويل بنكي
            </button>
            <button
              onClick={() => setMethodFilter("MADA")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === "MADA"
                  ? "bg-emerald-100 text-emerald-900 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              مدى
            </button>
            <button
              onClick={() => setMethodFilter("SADAD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === "SADAD"
                  ? "bg-purple-100 text-purple-900 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              سداد
            </button>
            <button
              onClick={() => setMethodFilter("CHEQUE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === "CHEQUE"
                  ? "bg-amber-100 text-amber-900 shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              شيك
            </button>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          <div className="p-4 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-on-surface">سندات القبض وحركات التوزيع المالي</h2>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              إجمالي السجلات: {filteredPayments.length} سند
            </span>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">جاري تحميل سجلات المدفوعات...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <Receipt className="w-12 h-12 stroke-[1.5] text-outline-variant" />
              <span className="text-base font-semibold text-on-surface">لا توجد عمليات سداد مسجلة</span>
              <span className="text-xs">سجّل دفعة جديدة لربطها بأقساط العقود المعتمدة</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-xs">
                <thead className="bg-surface-container text-on-surface-variant font-semibold select-none border-b border-surface-container-high">
                  <tr className="h-11">
                    <th className="pr-6 pl-3">رقم الإيصال</th>
                    <th className="px-4">رقم العقد</th>
                    <th className="px-4">العميل والوحدة</th>
                    <th className="px-4">تاريخ السداد</th>
                    <th className="px-4">طريقة الدفع</th>
                    <th className="px-4 text-left">المبلغ المحصل</th>
                    <th className="px-4">توزيع الأقساط (FIFO)</th>
                    <th className="px-4">المحاسب المسجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface font-body-sm">
                  {filteredPayments.map((p) => {
                    const badge = getMethodBadge(p.method);
                    return (
                      <tr key={p.id} className="h-16 hover:bg-surface/60 transition-colors">
                        <td className="pr-6 pl-3 font-mono font-bold text-primary">
                          #{p.receiptNumber}
                        </td>
                        <td className="px-4 font-mono font-semibold text-on-surface">
                          #{p.contractNumber}
                        </td>
                        <td className="px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface">{p.clientName}</span>
                            <span className="text-[11px] text-on-surface-variant">وحدة: {p.unitCode}</span>
                          </div>
                        </td>
                        <td className="px-4 font-mono text-[11px] text-on-surface-variant">
                          {p.createdAt.split("T")[0]}
                        </td>
                        <td className="px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 text-left font-mono font-bold text-primary text-sm">
                          {p.amountSar} <span className="text-xs font-normal text-on-surface-variant">ر.س</span>
                        </td>
                        <td className="px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs font-mono text-[11px]">
                            {p.allocations.map((a, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface"
                              >
                                قسط #{a.installmentNumber}: {a.allocatedAmountSar} ر.س
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 text-[11px] text-on-surface-variant">
                          {p.createdByName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record Payment Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="تسجيل عملية سداد جديدة وإصدار سند قبض"
        >
          <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
            {formError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Contract Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                <span>اختر العقد المعتمد للسداد <span className="text-error">*</span></span>
                <span className="text-secondary text-[11px]">عقود معتمدة فقط</span>
              </label>

              {contracts.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs border border-amber-200">
                  لا توجد عقود معتمدة عليها مبالغ متبقية حالياً.
                </div>
              ) : (
                <select
                  required
                  value={formData.contractId}
                  onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                  className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20"
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      عقد #{c.contractNumber} - {c.clientName} (وحدة {c.unitCode}) - المتبقي: {c.remainingBalanceSar} ر.س
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Amount & Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  المبلغ المدفوع (ر.س) <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="مثال: 25000"
                  value={formData.amountSar}
                  onChange={(e) => setFormData({ ...formData, amountSar: e.target.value })}
                  className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 font-mono font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  طريقة السداد <span className="text-error">*</span>
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                  className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="BANK_TRANSFER">تحويل بنكي سريع (سريع)</option>
                  <option value="MADA">مدى / بطاقة مصرفية</option>
                  <option value="SADAD">نظام سداد الإلكتروني</option>
                  <option value="CHEQUE">شيك مصرفي مصدق</option>
                  <option value="CASH">إيداع نقدي مباشر</option>
                </select>
              </div>
            </div>

            {/* Idempotency Key (Prevents double payment) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                  <span>مفتاح منع التكرار المالي (Idempotency Key)</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, idempotencyKey: generateKey() })}
                  className="text-[11px] text-primary flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>توليد مفتاح جديد</span>
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={formData.idempotencyKey}
                className="h-9 px-3 bg-surface-container-low text-on-surface text-xs rounded-xl outline-none border border-outline-variant/30 font-mono"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                ملاحظات أو رقم الإشعار البنكي
              </label>
              <input
                type="text"
                placeholder="مثال: حوالة من مصرف الراجحي مرجع #TX-98421"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Smart Allocation Info */}
            <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col gap-1 text-xs">
              <span className="font-bold text-primary flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>قاعدة التوزيع الآلي (FIFO Allocation):</span>
              </span>
              <p className="text-on-surface-variant text-[11px] leading-relaxed">
                سيقوم النظام فوراً بتوزيع هذا المبلغ لسداد الأقساط غير المدفوعة ذات تاريخ الاستحقاق الأقدم أولاً حتى
                استنفاد المبلغ بالكامل، وإذا كان المبلغ أكبر من قسط واحد سيتم سداد الأقساط التالية تباعاً.
              </p>
            </div>

            {/* Checkbox confirmation */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low cursor-pointer border border-outline-variant/20 select-none">
              <input
                type="checkbox"
                required
                checked={formData.confirmed}
                onChange={(e) => setFormData({ ...formData, confirmed: e.target.checked })}
                className="mt-0.5 rounded text-primary accent-primary"
              />
              <span className="text-xs text-on-surface leading-tight">
                أقر بصحة قيد واستلام المبلغ ومطابقة الإشعار المرفق لمنع التكرار المالي والامتثال لدفاتر المحاسبة.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || contracts.length === 0}
                className="h-10 px-5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
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
    </AppShell>
  );
}
