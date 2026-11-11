"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/Modal";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Phone,
  Clock,
  Search,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Eye,
  StickyNote,
  Calendar,
  Building2
} from "lucide-react";

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdByName: string;
  salesRepId?: string;
  createdById?: string;
  activeReservationsCount: number;
  contractsCount: number;
  createdAt: string;
}

interface ClientDetails {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdByName: string;
  salesRepId: string;
  createdAt: string;
  activeReservationsCount: number;
  contractsCount: number;
  reservations?: Array<{
    id: string;
    unitId: string;
    unitCode: string;
    expiresAt: string;
    status: string;
  }>;
  contracts?: Array<{
    id: string;
    contractNumber: string;
    status: string;
  }>;
}

interface ClientsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function ClientsView({ onNavigateTab }: ClientsViewProps) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Client Details Modal
  const [selectedClient, setSelectedClient] = useState<ClientDetails | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Add Client Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch Current User
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) {
          if (d.user.companyName) setCompanyName(d.user.companyName);
          if (d.user.role) setCurrentUserRole(d.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("تعذر تحميل قائمة العملاء");
      const json = await res.json();
      if (json.success) {
        setClients(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Open Client Details Modal
  const handleViewClientDetails = async (clientId: string) => {
    try {
      setLoadingDetails(true);
      setIsDetailsModalOpen(true);
      const res = await fetch(`/api/clients/${clientId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedClient(json.data);
      } else {
        // Fallback to client item from list
        const item = clients.find((c) => c.id === clientId);
        if (item) {
          setSelectedClient({
            id: item.id,
            name: item.name,
            phone: item.phone,
            notes: item.notes,
            createdByName: item.createdByName,
            salesRepId: item.salesRepId || "",
            createdAt: item.createdAt,
            activeReservationsCount: item.activeReservationsCount,
            contractsCount: item.contractsCount,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل تسجيل العميل");
      }

      setIsAddModalOpen(false);
      setFormData({ name: "", phone: "", notes: "" });
      setFeedbackMsg({ type: "success", text: "تم تسجيل العميل بنجاح وربطه بحسابك" });
      fetchClients();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "فشل تسجيل العميل");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search) ||
          (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === "active-contract") {
          return c.contractsCount > 0;
        }
        if (statusFilter === "active-reserve") {
          return c.activeReservationsCount > 0 && c.contractsCount === 0;
        }
        if (statusFilter === "potential") {
          return c.activeReservationsCount === 0 && c.contractsCount === 0;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "date-asc") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "name-asc") {
          return a.name.localeCompare(b.name, "ar");
        }
        return 0;
      });
  }, [clients, search, statusFilter, sortBy]);

  // Metric counts
  const totalClients = clients.length;
  const withContracts = clients.filter((c) => c.contractsCount > 0).length;
  const withReservations = clients.filter((c) => c.activeReservationsCount > 0 && c.contractsCount === 0).length;
  const potentials = clients.filter((c) => c.contractsCount === 0 && c.activeReservationsCount === 0).length;

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        {/* Greeting & Subtitle */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>سجل العملاء والعلاقات</span>
            <span className="text-2xl">👥</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            إدارة قاعدة عملاء الشركة ومتابعة مسار تحويل الحجوزات إلى عقود موثقة.
          </p>
        </div>

        {/* Action & Utility Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentUserRole === "SALES_AGENT" && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ تسجيل عميل جديد</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الجوال أو الملاحظات..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-48 sm:w-60 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={fetchClients}
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
        {/* Total Clients Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#d9f99d]/50 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              إجمالي السجل
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {totalClients}
              </span>
              <span className="text-xs font-bold text-gray-500">عميل مسجل</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              قاعدة العملاء التابعة لحسابك في الشركة
            </p>
          </div>
        </div>

        {/* Clients with Contracts Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#fed7aa]/50 rounded-[50%_50%_30%_70%/60%_40%_60%_40%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              عقود نشطة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {withContracts}
              </span>
              <span className="text-xs font-bold text-orange-700">عملاء مرتبطين بعقود</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              يمتلكون عقود بيع أو أقساط جارية
            </p>
          </div>
        </div>

        {/* Clients with Reservations Card */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#e0e7ff]/60 rounded-[40%_60%_60%_40%/50%_50%_50%_50%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#e0e7ff] text-[#3730a3] flex items-center justify-center font-bold text-xs shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              حجوزات مؤقتة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-[#002117] tracking-tight">
                {withReservations}
              </span>
              <span className="text-xs font-bold text-indigo-700">حجز جاري</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              وحدات محجوزة بانتظار إبرام العقود (72h)
            </p>
          </div>
        </div>

        {/* Potential Clients Card */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-[#022c22] rounded-[28px] p-5 shadow-sm text-white relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-[#bbf7d0] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              فرص واعدة
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-num text-white tracking-tight">
                {potentials}
              </span>
              <span className="text-xs font-bold text-[#86efac]">عملاء محتملين</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
              جاهزون لمعاينة الوحدات المتاحة
            </p>
          </div>
        </div>
      </div>

      {/* FILTER PILLS & SORT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[#064e3b] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            الكل ({clients.length})
          </button>
          <button
            onClick={() => setStatusFilter("active-contract")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "active-contract"
                ? "bg-[#ea580c] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            مرتبطون بعقود ({withContracts})
          </button>
          <button
            onClick={() => setStatusFilter("active-reserve")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "active-reserve"
                ? "bg-[#4338ca] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            لديهم حجز جاري ({withReservations})
          </button>
          <button
            onClick={() => setStatusFilter("potential")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "potential"
                ? "bg-[#047857] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
            }`}
          >
            عملاء محتملين ({potentials})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">ترتيب:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-gray-200/80 rounded-full px-3 py-1.5 text-xs text-gray-700 font-semibold outline-none focus:border-[#064e3b] shadow-xs cursor-pointer"
          >
            <option value="date-desc">الأحدث إضافة</option>
            <option value="date-asc">الأقدم إضافة</option>
            <option value="name-asc">أبجدياً (أ - ي)</option>
          </select>
        </div>
      </div>

      {/* CLIENTS DATA TABLE CONTAINER */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-gray-500">جاري تحميل سجل العملاء...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold">{error}</span>
            <button
              onClick={fetchClients}
              className="mt-2 text-xs font-bold bg-red-50 text-red-700 px-4 py-1.5 rounded-full border border-red-200 hover:bg-red-100 cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Users className="w-12 h-12 stroke-[1.2] text-gray-300" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-700">لا يوجد عملاء يطابقون خيارات البحث</span>
              <span className="text-xs text-gray-400">جرّب تغيير عبارة البحث أو اختيار تصنيف آخر</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
                <tr className="h-11">
                  <th className="pr-6 pl-4">اسم العميل</th>
                  <th className="px-4">رقم الجوال</th>
                  <th className="px-4">المندوب المسؤول</th>
                  <th className="px-4">الحالة والارتباط</th>
                  <th className="px-4">العقود النشطة</th>
                  <th className="px-4">تاريخ التسجيل</th>
                  <th className="px-4">ملاحظات</th>
                  <th className="pl-6 pr-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80 text-gray-800">
                {filteredClients.map((client) => {
                  return (
                    <tr
                      key={client.id}
                      onClick={() => handleViewClientDetails(client.id)}
                      className="h-16 hover:bg-[#fafaf8] transition-colors group cursor-pointer"
                    >
                      {/* Name & Avatar */}
                      <td className="pr-6 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs font-num">
                            {client.name.slice(0, 1)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-[#002117] text-xs group-hover:text-[#064e3b] transition-colors">
                              {client.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-num">
                              #{client.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-num text-xs font-bold text-gray-700" dir="ltr">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{client.phone}</span>
                        </div>
                      </td>

                      {/* Created By Agent */}
                      <td className="px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200/60 font-semibold text-[11px]">
                          <ShieldCheck className="w-3 h-3 text-[#064e3b]" />
                          <span>{client.createdByName}</span>
                        </span>
                      </td>

                      {/* Status & Ties */}
                      <td className="px-4 whitespace-nowrap">
                        {client.contractsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ffedd5] text-[#9a3412] font-bold text-[10px] border border-orange-200/60">
                            <FileText className="w-3 h-3" />
                            <span>مرتبط بعقد رسمي</span>
                          </span>
                        ) : client.activeReservationsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e0e7ff] text-[#3730a3] font-bold text-[10px] border border-indigo-200/60">
                            <Clock className="w-3 h-3" />
                            <span>حجز وحدة جاري</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] font-bold text-[10px] border border-emerald-200/60">
                            <UserCheck className="w-3 h-3" />
                            <span>عميل محتمل</span>
                          </span>
                        )}
                      </td>

                      {/* Contracts count */}
                      <td className="px-4 whitespace-nowrap">
                        <span className="font-num font-extrabold text-xs text-gray-700">
                          {client.contractsCount} عقد
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="px-4 whitespace-nowrap text-gray-500 font-num text-[11px]">
                        {client.createdAt.split("T")[0]}
                      </td>

                      {/* Notes */}
                      <td className="px-4 max-w-xs truncate text-[11px] text-gray-500 font-medium" title={client.notes}>
                        {client.notes || "—"}
                      </td>

                      {/* Actions */}
                      <td className="pl-6 pr-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewClientDetails(client.id)}
                          className="bg-gray-100 hover:bg-[#064e3b] text-gray-700 hover:text-white px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض التفاصيل</span>
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

      {/* CLIENT DETAILS MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="الملف التفصيلي للعميل"
      >
        {loadingDetails ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-gray-400">
            <div className="w-6 h-6 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold">جاري جلب تفاصيل العميل...</span>
          </div>
        ) : selectedClient ? (
          <div className="flex flex-col gap-4">
            {/* Header Identity Badge */}
            <div className="bg-[#fcfdfa] border border-gray-200/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#ecfccb] text-[#365314] font-black text-lg flex items-center justify-center shadow-xs">
                {selectedClient.name.slice(0, 1)}
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base text-[#002117]">
                  {selectedClient.name}
                </span>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1 font-num font-semibold" dir="ltr">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{selectedClient.phone}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>تاريخ التسجيل: {selectedClient.createdAt.split("T")[0]}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Sales Representative Attribution */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs">
              <span className="text-gray-500 font-medium">المندوب المسؤول المالك للسجل:</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-[#064e3b]">
                <ShieldCheck className="w-4 h-4 text-[#064e3b]" />
                <span>{selectedClient.createdByName}</span>
              </span>
            </div>

            {/* CLIENT NOTES (Requirement 7: Display client notes on the client details page) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <StickyNote className="w-3.5 h-3.5 text-emerald-800" />
                <span>ملاحظات ومتطلبات العميل العقارية:</span>
              </div>
              <div className="p-3.5 bg-[#fefce8] border border-[#fef08a] rounded-2xl text-xs text-gray-800 leading-relaxed font-medium min-h-[60px]">
                {selectedClient.notes ? (
                  <p>{selectedClient.notes}</p>
                ) : (
                  <p className="text-gray-400 italic">لا توجد ملاحظات مسجلة لهذا العميل حالياً.</p>
                )}
              </div>
            </div>

            {/* Active Reservations for this client */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-700" />
                <span>الحجوزات النشطة للوحدات:</span>
              </span>
              {selectedClient.reservations && selectedClient.reservations.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedClient.reservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs font-semibold text-indigo-950"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-700" />
                        <span>الوحدة #{res.unitCode}</span>
                      </div>
                      <span className="text-[11px] text-indigo-800 font-num">
                        ينتهي الحجز: {new Date(res.expiresAt).toLocaleString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-400 text-center">
                  لا توجد وحدات محجوزة حالياً لهذا العميل
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  onNavigateTab?.("units", "/units");
                }}
                className="h-10 px-4 rounded-full bg-[#064e3b] text-white text-xs font-bold hover:bg-[#003527] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>حجز وحدة جديدة لهذا العميل</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="h-10 px-5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="تسجيل عميل جديد في الشركة"
      >
        <form onSubmit={handleCreateClient} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-800 text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              الاسم الكامل للعميل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: عبد الله بن إبراهيم القحطاني"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              رقم الجوال <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="05XXXXXXXX"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-10 px-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 font-num text-left"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">
              ملاحظات أو متطلبات العميل العقارية
            </label>
            <textarea
              rows={3}
              placeholder="الميزانية، الحي المطلوب، شروط الدفع، التمويل البنكي..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="p-3 bg-white text-gray-800 text-xs rounded-xl outline-none border border-gray-200 focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 resize-none font-medium"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center gap-2 text-xs text-[#365314] font-medium">
            <ShieldCheck className="w-4 h-4 text-[#65a30d] shrink-0" />
            <span>سيتم ربط العميل باسمك كمندوب مسؤول وحفظه في سجل الشركة تلقائياً</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="h-10 px-4 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>حفظ بيانات العميل</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
