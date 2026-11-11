"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/Modal";
import {
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building,
  RefreshCw,
  PlusCircle,
  FileText,
  User,
  Phone,
  Building2,
  Ban,
  Check
} from "lucide-react";

interface ReservationItem {
  id: string;
  unitId: string;
  clientId: string;
  salesRepId: string;
  createdById: string;
  reservedAt: string;
  createdAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED" | "CONVERTED" | "CANCELLED";
  unit: {
    id: string;
    code: string;
    unitNumber: string;
    project: string;
    projectName: string;
    type: string;
    price: string;
    priceSar: string;
    rawPriceNumber?: number;
  };
  client: {
    id: string;
    name: string;
    phone: string;
  };
  agentName: string;
}

interface UnitOption {
  id: string;
  code: string;
  project: string;
  priceSar?: string;
  status: string;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

interface ReservationsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function ReservationsView({ onNavigateTab }: ReservationsViewProps) {
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // New Reservation Modal (SALES_AGENT)
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);
  const [myClients, setMyClients] = useState<ClientOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Cancelling state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          if (json.user.companyName) setCompanyName(json.user.companyName);
          if (json.user.role) setCurrentUserRole(json.user.role);
          if (json.user.id) setCurrentUserId(json.user.id);
        }
      }
    } catch {}
  };

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/reservations?status=all");
      if (!res.ok) throw new Error("تعذر تحميل قائمة الحجوزات");
      const json = await res.json();
      if (json.success) {
        setReservations(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchReservations();
  }, []);

  // Fetch available units & clients when opening modal
  const handleOpenReserveModal = async () => {
    setFormError(null);
    try {
      const [unitsRes, clientsRes] = await Promise.all([
        fetch("/api/units?status=AVAILABLE&limit=100"),
        fetch("/api/clients"),
      ]);
      const unitsJson = await unitsRes.json();
      const clientsJson = await clientsRes.json();

      if (unitsJson.success && unitsJson.data) {
        setAvailableUnits(unitsJson.data);
        if (unitsJson.data.length > 0) setSelectedUnitId(unitsJson.data[0].id);
      }
      if (clientsJson.success && clientsJson.data) {
        setMyClients(clientsJson.data);
        if (clientsJson.data.length > 0) setSelectedClientId(clientsJson.data[0].id);
      }
      setIsReserveModalOpen(true);
    } catch {
      setFeedbackMsg({ type: "error", text: "تعذر تحميل الوحدات والعملاء المتاحين" });
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId || !selectedClientId) {
      setFormError("يرجى اختيار الوحدة والعميل لإتمام الحجز");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: selectedUnitId, clientId: selectedClientId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل إتمام الحجز");
      }

      setIsReserveModalOpen(false);
      setFeedbackMsg({
        type: "success",
        text: `تم حجز الوحدة ${json.data?.unit?.code || ""} بنجاح لمدة 72 ساعة`,
      });
      fetchReservations();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "فشل إتمام الحجز");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReservation = async (resId: string) => {
    if (!confirm("هل أنت متأكد من إلغاء هذا الحجز؟ ستعود الوحدة متاحة للحجز فوراً.")) return;

    setCancellingId(resId);
    try {
      const res = await fetch(`/api/reservations/${resId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل إلغاء الحجز");
      }

      setFeedbackMsg({ type: "success", text: "تم إلغاء الحجز وإعادة الوحدة إلى الحالة المتاحة بنجاح" });
      fetchReservations();
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "فشل إلغاء الحجز" });
    } finally {
      setCancellingId(null);
    }
  };

  const getRemainingTime = (expiresAtStr: string, status: string) => {
    if (status !== "ACTIVE") return null;
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) return { label: "منتهي الصلاحية", isExpired: true, isCritical: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return {
      label: `${hours} ساعة و ${minutes} دقيقة`,
      isExpired: false,
      isCritical: hours < 12,
    };
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === "ACTIVE") {
      const remaining = getRemainingTime(expiresAt, status);
      if (remaining?.isExpired) {
        return { label: "منتهي (بانتظار الفرز)", color: "bg-red-50 text-red-700 border-red-200" };
      }
      return { label: "نشط (72 ساعة)", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    }
    if (status === "CONVERTED") {
      return { label: "تم تحويله لعقد", color: "bg-blue-50 text-blue-800 border-blue-200" };
    }
    if (status === "CANCELLED") {
      return { label: "ملغي يدوياً", color: "bg-gray-100 text-gray-700 border-gray-200" };
    }
    return { label: "منتهي الصلاحية", color: "bg-red-50 text-red-800 border-red-200" };
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const matchesSearch =
        r.unit.code.toLowerCase().includes(search.toLowerCase()) ||
        r.unit.project.toLowerCase().includes(search.toLowerCase()) ||
        r.client.name.toLowerCase().includes(search.toLowerCase()) ||
        r.agentName.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "ACTIVE") {
        if (r.status !== "ACTIVE") return false;
        const diff = new Date(r.expiresAt).getTime() - Date.now();
        if (diff <= 0) return false;
      } else if (statusFilter === "CRITICAL") {
        if (r.status !== "ACTIVE") return false;
        const diff = new Date(r.expiresAt).getTime() - Date.now();
        if (diff <= 0 || diff > 12 * 60 * 60 * 1000) return false;
      } else if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [reservations, search, statusFilter]);

  // Metrics
  const activeCount = reservations.filter(
    (r) => r.status === "ACTIVE" && new Date(r.expiresAt).getTime() > Date.now()
  ).length;

  const criticalCount = reservations.filter((r) => {
    if (r.status !== "ACTIVE") return false;
    const diff = new Date(r.expiresAt).getTime() - Date.now();
    return diff > 0 && diff <= 12 * 60 * 60 * 1000;
  }).length;

  const convertedCount = reservations.filter((r) => r.status === "CONVERTED").length;
  const expiredCount = reservations.filter(
    (r) => r.status === "EXPIRED" || (r.status === "ACTIVE" && new Date(r.expiresAt).getTime() <= Date.now())
  ).length;

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>إدارة الحجوزات العقارية</span>
            <span className="text-2xl">⏳</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            حجز آمن لمدة 72 ساعة، محرك منع التضارب والتنافسية اللحظية، وإلغاء تلقائي عند انتهاء المدة.
          </p>
        </div>

        {/* Action & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentUserRole === "SALES_AGENT" && (
            <button
              onClick={handleOpenReserveModal}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ حجز وحدة جديدة</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الوحدة، العميل، المندوب..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-52 sm:w-64 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchReservations}
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

      {/* BENTO KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Active Reservations */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              حجوزات نشطة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {activeCount}
              </span>
              <span className="text-xs font-bold text-emerald-800">وحدة محجوزة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              سارية وضمن مهلة الـ 72 ساعة
            </p>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#fed7aa] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              تنتهي قريباً
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {criticalCount}
              </span>
              <span className="text-xs font-bold text-orange-700">حجز حرج</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              أقل من 12 ساعة متبقية قبل الإلغاء
            </p>
          </div>
        </div>

        {/* Converted */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px] group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#e0e7ff] text-[#3730a3] flex items-center justify-center font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              تحولت لعقود
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {convertedCount}
              </span>
              <span className="text-xs font-bold text-indigo-700">حجز مكتمل</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              تم تحويلها إلى عقود بيع معتمدة
            </p>
          </div>
        </div>

        {/* Expired / Cancelled */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[150px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <Ban className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              منتهية / ملغاة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-white tracking-tight">
                {expiredCount}
              </span>
              <span className="text-xs font-bold text-[#86efac]">تم استرجاعها</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
              أعيدت الوحدات تلقائياً للمبيعات
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
          الكل ({reservations.length})
        </button>
        <button
          onClick={() => setStatusFilter("ACTIVE")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "ACTIVE"
              ? "bg-[#064e3b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          النشطة ({activeCount})
        </button>
        <button
          onClick={() => setStatusFilter("CRITICAL")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "CRITICAL"
              ? "bg-[#c2410c] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          أوشكت على الانتهاء ({criticalCount})
        </button>
        <button
          onClick={() => setStatusFilter("CONVERTED")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "CONVERTED"
              ? "bg-[#3730a3] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المحولة لعقود ({convertedCount})
        </button>
        <button
          onClick={() => setStatusFilter("EXPIRED")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            statusFilter === "EXPIRED"
              ? "bg-[#991b1b] text-white shadow-xs"
              : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
          }`}
        >
          المنتهية ({expiredCount})
        </button>
      </div>

      {/* RESERVATIONS TABLE */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-gray-500">جاري تحميل سجل الحجوزات...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Clock className="w-12 h-12 stroke-[1.2] text-gray-300" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-700">لا توجد حجوزات مطابقة</span>
              <span className="text-xs text-gray-400">يمكنك حجز وحدة جديدة من خلال زر الإضافة أعلاه</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                <tr className="h-11">
                  <th className="pr-6 pl-4">الوحدة والمشروع</th>
                  <th className="px-4">العميل</th>
                  <th className="px-4">المندوب المسؤول</th>
                  <th className="px-4">سعر الوحدة</th>
                  <th className="px-4">تاريخ الحجز</th>
                  <th className="px-4">صلاحية الحجز (72 ساعة)</th>
                  <th className="px-4">الحالة</th>
                  <th className="pl-6 pr-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 text-gray-800">
                {filteredReservations.map((r) => {
                  const badge = getStatusBadge(r.status, r.expiresAt);
                  const remaining = getRemainingTime(r.expiresAt, r.status);
                  const canCancel =
                    r.status === "ACTIVE" &&
                    (currentUserRole === "COMPANY_ADMIN" ||
                      (currentUserRole === "SALES_AGENT" && r.createdById === currentUserId));

                  return (
                    <tr key={r.id} className="h-16 hover:bg-[#fafaf8] transition-colors group">
                      {/* Unit & Project */}
                      <td className="pr-6 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] font-bold text-xs flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-[#002117] text-xs font-num group-hover:text-[#064e3b] transition-colors">
                              {r.unit.code}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {r.unit.project} • {r.unit.type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-xs">{r.client.name}</span>
                          <span className="text-[10px] text-gray-400 font-num flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{r.client.phone}</span>
                          </span>
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="px-4 whitespace-nowrap text-gray-700 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{r.agentName}</span>
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 whitespace-nowrap font-extrabold text-[#064e3b] font-num">
                        {r.unit.priceSar || `${r.unit.price} ر.س`}
                      </td>

                      {/* Reserved At */}
                      <td className="px-4 whitespace-nowrap text-gray-500 font-num text-[11px]">
                        {r.createdAt.split("T")[0]}
                      </td>

                      {/* Remaining / Expiration */}
                      <td className="px-4 whitespace-nowrap">
                        {r.status === "ACTIVE" ? (
                          remaining?.isExpired ? (
                            <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              انتهت الصلاحية
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold font-num px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                remaining?.isCritical
                                  ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>متبقي: {remaining?.label}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-gray-400 font-num">
                            انتهى في {r.expiresAt.split("T")[0]}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="pl-6 pr-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {r.status === "ACTIVE" && !remaining?.isExpired && (
                            <button
                              onClick={() => {
                                if (onNavigateTab) {
                                  onNavigateTab("contracts", "/contracts");
                                }
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                              title="صياغة مسودة عقد لهذا الحجز"
                            >
                              <FileText className="w-3 h-3" />
                              <span>صياغة عقد</span>
                            </button>
                          )}

                          {canCancel && (
                            <button
                              onClick={() => handleCancelReservation(r.id)}
                              disabled={cancellingId === r.id}
                              className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold border border-red-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="إلغاء الحجز وإعادة الوحدة للحالة المتاحة"
                            >
                              <Ban className="w-3 h-3" />
                              <span>{cancellingId === r.id ? "جاري الإلغاء..." : "إلغاء"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE RESERVATION MODAL */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title="حجز وحدة عقارية جديدة (مهلة 72 ساعة)"
      >
        <form onSubmit={handleCreateReservation} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-800 text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Unit selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              اختر الوحدة المتاحة <span className="text-red-500">*</span>
            </label>
            {availableUnits.length === 0 ? (
              <div className="p-3 rounded-xl bg-orange-50 text-orange-800 text-xs border border-orange-200">
                لا توجد وحدات بحالة متاحة حالياً.
              </div>
            ) : (
              <select
                required
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-medium"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} - {u.project} ({u.priceSar})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Client selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              اختر العميل المسجل <span className="text-red-500">*</span>
            </label>
            {myClients.length === 0 ? (
              <div className="p-3 rounded-xl bg-orange-50 text-orange-800 text-xs border border-orange-200">
                لا يوجد عملاء مسجلين لديك. يرجى إضافة عميل أولاً من صفحة العملاء.
              </div>
            ) : (
              <select
                required
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] font-medium"
              >
                {myClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Policy Information Box */}
          <div className="p-3.5 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex flex-col gap-1 text-xs">
            <span className="font-extrabold text-[#365314] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#65a30d]" />
              <span>شروط وسياسة الحجز المؤقت:</span>
            </span>
            <ul className="text-[#365314]/80 text-[11px] list-disc list-inside space-y-1">
              <li>مدة الحجز إلزامية ودقيقة: 72 ساعة من لحظة التأكيد.</li>
              <li>لا يمكن حجز وحدة محجوزة أو مباعة من قبل أي مندوب آخر.</li>
              <li>إذا لم يتم إبرام عقد خلال الـ 72 ساعة، تعود الوحدة فورياً ومجانياً لحالة متاحة.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsReserveModalOpen(false)}
              className="h-10 px-4 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableUnits.length === 0 || myClients.length === 0}
              className="h-10 px-5 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>تأكيد الحجز (72 ساعة)</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
