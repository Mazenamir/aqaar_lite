"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  CheckCheck, 
  PlusCircle, 
  Search, 
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from "lucide-react";

interface Unit {
  id: string;
  project: string;
  code: string;
  type: string;
  floor: string;
  area: number;
  rooms: number;
  priceHalalas: string;
  priceSar: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD";
  reservation?: {
    id: string;
    clientName: string;
    agentName: string;
    expiresAt: string;
  } | null;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Form states
  const [myClients, setMyClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Unit Form
  const [newProject, setNewProject] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("شقة ديلوكس");
  const [newFloor, setNewFloor] = useState("الدور الأول");
  const [newArea, setNewArea] = useState(150);
  const [newRooms, setNewRooms] = useState(4);
  const [newPriceSar, setNewPriceSar] = useState("");

  // Edit Price Form
  const [editPriceSar, setEditPriceSar] = useState("");

  // Fetch Current User
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) setUserRole(d.user.role);
      });
  }, []);

  // Fetch Units
  const fetchUnits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        sortBy,
        page: page.toString(),
        limit: "10",
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/units?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUnits(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [statusFilter, sortBy, page, search]);

  // Load clients for reservation
  const handleOpenReserve = async (unit: Unit) => {
    setSelectedUnit(unit);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/clients");
      const d = await res.json();
      if (d.success) {
        setMyClients(d.data);
        if (d.data.length > 0) setSelectedClientId(d.data[0].id);
      }
    } catch (e) {}
    setIsReserveModalOpen(true);
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !selectedClientId) return;

    try {
      const res = await fetch(`/api/units/${selectedUnit.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedbackMsg({ type: "error", text: data.error || "فشل حجز الوحدة" });
        return;
      }

      setFeedbackMsg({ type: "success", text: "تم حجز الوحدة بنجاح لمدة 72 ساعة." });
      setIsReserveModalOpen(false);
      fetchUnits();
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "خطأ في الاتصال بالخادم" });
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: newProject,
          code: newCode,
          type: newType,
          floor: newFloor,
          area: Number(newArea),
          rooms: Number(newRooms),
          priceSar: newPriceSar,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedbackMsg({ type: "error", text: data.error || "فشل إضافة الوحدة" });
        return;
      }

      setIsAddModalOpen(false);
      setNewProject("");
      setNewCode("");
      setNewPriceSar("");
      setFeedbackMsg({ type: "success", text: "تمت إضافة الوحدة بنجاح." });
      fetchUnits();
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "خطأ في الاتصال" });
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    try {
      const res = await fetch(`/api/units/${selectedUnit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceSar: editPriceSar }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedbackMsg({ type: "error", text: data.error || "فشل تعديل السعر" });
        return;
      }

      setIsPriceModalOpen(false);
      setFeedbackMsg({ type: "success", text: "تم تحديث السعر وتوثيقه في سجل التدقيق بنجاح." });
      fetchUnits();
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "خطأ في الاتصال" });
    }
  };

  const availableCount = units.filter((u) => u.status === "AVAILABLE").length;
  const reservedCount = units.filter((u) => u.status === "RESERVED").length;
  const soldCount = units.filter((u) => u.status === "SOLD").length;

  return (
    <AppShell breadcrumbTitle="الوحدات العقارية">
      {/* Top Action & Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-6 rounded-full bg-primary-container"></span>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">الوحدات العقارية</h1>
            <span className="text-xs bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full font-medium">
              محدّث بالكامل
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            إدارة وحجز الوحدات، فحص الأسعار، ومتابعة تواريخ انتهاء الحجز اللحظي (72 ساعة)
          </p>
        </div>

        {userRole === "COMPANY_ADMIN" && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة وحدة جديدة</span>
          </button>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-error-container text-on-error"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Metric Bento Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-on-surface-variant font-medium">إجمالي الوحدات</span>
            <div className="text-3xl font-bold text-on-surface mt-1">{totalCount}</div>
            <span className="text-[11px] text-secondary font-medium">ضمن الشركة الحالية</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-on-surface-variant font-medium">الوحدات المتاحة</span>
            <div className="text-3xl font-bold text-primary-container mt-1">{availableCount}</div>
            <span className="text-[11px] text-secondary font-medium">جاهزة للحجز الفوري</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary-container/40 flex items-center justify-center text-primary-container">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-on-surface-variant font-medium">الوحدات المحجوزة</span>
            <div className="text-3xl font-bold text-tertiary-container mt-1">{reservedCount}</div>
            <span className="text-[11px] text-tertiary font-medium">صلاحية 72 ساعة</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/60 flex items-center justify-center text-tertiary-container">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-on-surface-variant font-medium">الوحدات المباعة</span>
            <div className="text-3xl font-bold text-on-surface-variant mt-1">{soldCount}</div>
            <span className="text-[11px] text-on-surface-variant font-medium">عقود معتمدة نهائياً</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant">
            <CheckCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filtration Strip */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-outline-variant/20">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الوحدة، اسم المشروع، أو النوع..."
            className="w-full h-10 pr-9 pl-4 bg-surface-container-low text-on-surface text-xs rounded-xl outline-none border border-outline-variant/20 focus:border-primary-container focus:ring-1 focus:ring-primary-container"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "الكل" },
            { id: "AVAILABLE", label: "متاح" },
            { id: "RESERVED", label: "محجوز" },
            { id: "SOLD", label: "مباع" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-primary-container text-on-primary shadow-sm"
                  : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-10 px-3 bg-surface-container-low text-on-surface text-xs rounded-xl border border-outline-variant/20 outline-none"
        >
          <option value="newest">الأحدث إضافة</option>
          <option value="priceAsc">السعر: من الأقل للأعلى</option>
          <option value="priceDesc">السعر: من الأعلى للأقل</option>
          <option value="areaDesc">المساحة: الأكبر أولاً</option>
          <option value="areaAsc">المساحة: الأصغر أولاً</option>
        </select>
      </div>

      {/* Units Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col mb-6 border border-outline-variant/20">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="h-12 bg-surface-container-low/80 text-on-surface-variant font-semibold border-b border-surface-container">
                <th className="px-5 py-3">رقم الوحدة</th>
                <th className="px-5 py-3">المشروع</th>
                <th className="px-5 py-3">النوع والطابق</th>
                <th className="px-5 py-3">المساحة / الغرف</th>
                <th className="px-5 py-3">السعر (ر.س)</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3 text-center">الإجراء المتاح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                    جاري تحميل بيانات الوحدات العقارية...
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                    لا توجد وحدات مطابقة لمعايير البحث في شركتك.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isAvailable = unit.status === "AVAILABLE";
                  const isReserved = unit.status === "RESERVED";
                  const isSold = unit.status === "SOLD";

                  return (
                    <tr key={unit.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-primary-container">
                        {unit.code}
                      </td>
                      <td className="px-5 py-3 font-medium text-on-surface">
                        {unit.project}
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant">
                        <div>
                          <span className="font-semibold text-on-surface">{unit.type}</span>
                          <span className="text-[11px] block text-on-surface-variant">{unit.floor}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-on-surface">
                        {unit.area} م² ({unit.rooms} غرف)
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-on-surface">
                        {unit.priceSar} ر.س
                      </td>
                      <td className="px-5 py-3">
                        {isAvailable && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-secondary-container text-on-secondary-container">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                            متاح للبيع
                          </span>
                        )}
                        {isReserved && (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-tertiary-fixed text-tertiary-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container"></span>
                              محجوز مؤقتاً
                            </span>
                            {unit.reservation && (
                              <span className="text-[10px] text-on-surface-variant mt-0.5">
                                العميل: {unit.reservation.clientName}
                              </span>
                            )}
                          </div>
                        )}
                        {isSold && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface-variant">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                            تم البيع
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isAvailable && userRole === "SALES_AGENT" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReserve(unit)}
                              className="px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary hover:bg-primary text-xs font-semibold shadow-sm transition-all"
                            >
                              حجز الوحدة
                            </button>
                          )}

                          {isAvailable && userRole === "COMPANY_ADMIN" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnit(unit);
                                setEditPriceSar(unit.priceSar.replace(/[^\d]/g, ""));
                                setIsPriceModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface"
                            >
                              تعديل السعر
                            </button>
                          )}

                          {isReserved && (
                            <span className="text-[11px] text-tertiary font-mono">
                              حجز نشط 72h
                            </span>
                          )}

                          {isSold && (
                            <span className="text-[11px] text-on-surface-variant font-mono">
                              مباعة نهائياً
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 bg-surface-container-low/40 flex items-center justify-between border-t border-surface-container">
          <div className="text-xs text-on-surface-variant font-medium">
            عرض صفحة <span className="font-bold text-on-surface">{page}</span> من أصل <span className="font-bold text-on-surface">{totalPages || 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono font-bold text-xs bg-primary-container text-on-primary rounded-lg">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reservation Modal */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title="حجز وحدة عقارية لعميل (صلاحية 72 ساعة)"
      >
        {selectedUnit && (
          <form onSubmit={handleConfirmReservation} className="flex flex-col gap-4">
            <div className="p-3 bg-surface-container-low rounded-xl">
              <span className="font-mono text-sm font-bold text-primary-container">{selectedUnit.code}</span>
              <div className="text-xs font-semibold text-on-surface">{selectedUnit.project}</div>
              <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                السعر المعتمد: {selectedUnit.priceSar} ر.س
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">اختر العميل من قائمة عملائك *</label>
              {myClients.length === 0 ? (
                <div className="p-3 bg-error-container text-on-error rounded-xl text-xs">
                  لا يوجد لديك عملاء مسجلين حالياً. يرجى التوجه لصفحة العملاء وإضافة عميل أولاً.
                </div>
              ) : (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs rounded-xl border border-outline-variant/30 outline-none"
                >
                  {myClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant flex items-start gap-2">
              <Clock className="w-4 h-4 text-tertiary-container shrink-0 mt-0.5" />
              <span>
                الحجز صالح لمدة 72 ساعة فقط. في حال عدم تحويله لعقد معتمد وسداد الدفعة الأولى، تعود الوحدة تلقائياً لحالة «متاح».
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-low">
              <button
                type="button"
                onClick={() => setIsReserveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={myClients.length === 0}
                className="px-5 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-sm hover:bg-primary disabled:opacity-50"
              >
                تأكيد حجز الوحدة
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Unit Modal (Admin Only) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة وحدة عقارية جديدة للمشروع"
      >
        <form onSubmit={handleAddUnit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface">اسم المشروع العقاري *</label>
            <input
              type="text"
              required
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              placeholder="مثال: مجمع النخيل ريزيدنس"
              className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs rounded-xl border border-outline-variant/30 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">رقم / كود الوحدة *</label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="A-301"
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">نوع الوحدة *</label>
              <input
                type="text"
                required
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">الطابق</label>
              <input
                type="text"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">المساحة (م²)</label>
              <input
                type="number"
                value={newArea}
                onChange={(e) => setNewArea(Number(e.target.value))}
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">الغرف</label>
              <input
                type="number"
                value={newRooms}
                onChange={(e) => setNewRooms(Number(e.target.value))}
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface">السعر الإجمالي (ر.س) *</label>
            <input
              type="text"
              required
              value={newPriceSar}
              onChange={(e) => setNewPriceSar(e.target.value)}
              placeholder="مثال: 950000"
              className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-xl border border-outline-variant/30 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-low">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-sm hover:bg-primary"
            >
              حفظ الوحدة
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Price Modal (Admin Only) */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title="تعديل سعر وحدة عقارية (موثق بالرقابة)"
      >
        {selectedUnit && (
          <form onSubmit={handleUpdatePrice} className="flex flex-col gap-4">
            <div className="text-xs">
              <span className="text-on-surface-variant">الوحدة: </span>
              <span className="font-bold font-mono">{selectedUnit.code}</span> - {selectedUnit.project}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">السعر الجديد (ر.س) *</label>
              <input
                type="text"
                required
                value={editPriceSar}
                onChange={(e) => setEditPriceSar(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-xl border border-outline-variant/30 outline-none"
              />
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant">
              تنبيه: سيتم توثيق هذا التعديل مباشرة في سجل التدقيق والرقابة وتحديث السعر اللحظي للوحدة المتاحة.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-low">
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-sm hover:bg-primary"
              >
                تأكيد التعديل
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
