"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import {
  Building2,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Tag,
  Layers,
  SlidersHorizontal,
  Building,
  Eye,
  Filter,
  RotateCcw
} from "lucide-react";

interface Unit {
  id: string;
  projectName?: string;
  project: string;
  unitNumber?: string;
  code: string;
  type: string;
  floor: string;
  area: number;
  rooms: number;
  price: string;
  priceSar?: string;
  priceHalalas?: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD";
  reservation?: {
    id: string;
    clientId?: string;
    clientName: string;
    agentName: string;
    salesRepId?: string;
    expiresAt: string;
  } | null;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

interface UnitsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function UnitsView({ onNavigateTab: _onNavigateTab }: UnitsViewProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");

  // Filters & Search (Server-side filtering: Status, minPrice, maxPrice, pagination, sorting)
  const [statusFilter, setStatusFilter] = useState("all");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedDetailsUnit, setSelectedDetailsUnit] = useState<Unit | null>(null);

  // Form states
  const [myClients, setMyClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Unit Form (Only ADMIN can create)
  const [newProject, setNewProject] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("شقة ديلوكس");
  const [newFloor, setNewFloor] = useState("1");
  const [newArea, setNewArea] = useState(150);
  const [newRooms, setNewRooms] = useState(4);
  const [newPriceSar, setNewPriceSar] = useState("");

  // Edit Price Form (Only ADMIN can update, prohibited on RESERVED or SOLD)
  const [editPriceSar, setEditPriceSar] = useState("");

  // Fetch Current User
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) {
          setUserRole(d.user.role || "");
          setCompanyName(d.user.companyName || "شركة الرياض");
        }
      });
  }, []);

  // Fetch Units with server-side filters
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        sortBy,
        page: page.toString(),
        limit: "10",
        ...(search ? { search } : {}),
        ...(minPriceFilter ? { minPrice: minPriceFilter } : {}),
        ...(maxPriceFilter ? { maxPrice: maxPriceFilter } : {}),
      });

      const res = await fetch(`/api/units?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUnits(data.data || []);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotalCount(data.pagination?.total ?? (data.data?.length || 0));
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

  const handleApplyPriceFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUnits();
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setSearch("");
    setSortBy("newest");
    setPage(1);
  };

  // Open Unit Details Modal
  const handleOpenDetails = async (unit: Unit) => {
    setSelectedDetailsUnit(unit);
    setIsDetailsModalOpen(true);
    // Refresh unit data from single unit endpoint
    try {
      const res = await fetch(`/api/units/${unit.id}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedDetailsUnit(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load clients for reservation (Only SALES users can reserve)
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
    } catch (e) {
      console.error(e);
    }
    setIsReserveModalOpen(true);
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !selectedClientId) return;

    try {
      // POST to /api/reservations (REST standard mandated by Phase 5)
      const res = await fetch(`/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: selectedUnit.id,
          clientId: selectedClientId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedbackMsg({
          type: "error",
          text: data.error || "عذراً، الوحدة غير متاحة للحجز حالياً أو تم حجزها من قبل مندوب آخر.",
        });
        return;
      }

      setIsReserveModalOpen(false);
      if (isDetailsModalOpen) setIsDetailsModalOpen(false);

      setFeedbackMsg({
        type: "success",
        text: `تم حجز الوحدة #${selectedUnit.code} بنجاح لمدة 72 ساعة لصالح العميل المختار!`,
      });
      fetchUnits();
    } catch (e) {
      setFeedbackMsg({
        type: "error",
        text: "حدث خطأ في الاتصال بالخادم أثناء تأكيد الحجز المتزامن",
      });
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: newProject,
          unitNumber: newCode,
          type: newType,
          floor: newFloor,
          area: Number(newArea),
          rooms: Number(newRooms),
          price: newPriceSar,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "فشل إضافة الوحدة");
        return;
      }

      setIsAddModalOpen(false);
      setNewProject("");
      setNewCode("");
      setNewPriceSar("");
      setFeedbackMsg({ type: "success", text: `تمت إضافة الوحدة #${data.data.code} بنجاح كمعروض متاح للبيع!` });
      fetchUnits();
    } catch (e) {
      alert("خطأ في الاتصال بالخادم أثناء إضافة الوحدة");
    }
  };

  const handleOpenEditPrice = (unit: Unit) => {
    if (unit.status !== "AVAILABLE") {
      alert("لا يجوز تعديل سعر وحدة محجوزة أو مباعة وفقاً للسياسات الرقابية.");
      return;
    }
    setSelectedUnit(unit);
    setEditPriceSar(unit.price || "");
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    try {
      const res = await fetch(`/api/units/${selectedUnit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: editPriceSar }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "فشل تعديل السعر");
        return;
      }

      setIsPriceModalOpen(false);
      if (isDetailsModalOpen) setIsDetailsModalOpen(false);

      setFeedbackMsg({
        type: "success",
        text: `تم تحديث سعر الوحدة #${selectedUnit.code} وتوثيق العملية في سجل التدقيق بنجاح!`,
      });
      fetchUnits();
    } catch (e) {
      alert("خطأ أثناء تحديث السعر");
    }
  };

  // Metric stats
  const availableCount = units.filter((u) => u.status === "AVAILABLE").length;
  const reservedCount = units.filter((u) => u.status === "RESERVED").length;
  const soldCount = units.filter((u) => u.status === "SOLD").length;

  const formatPriceDisplay = (u: Unit) => {
    if (u.priceSar) return u.priceSar;
    if (u.price) return `${Number(u.price).toLocaleString("en-US")} ر.س`;
    return "0.00 ر.س";
  };

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>إدارة الوحدات والمخزون العقاري</span>
            <span className="text-2xl">🏢</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            عرض المخزون، فلترة الأسعار والحالات، وإدارة عمليات الحجز الذري وتعديل الأسعار.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {userRole === "COMPANY_ADMIN" && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إضافة وحدة جديدة</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالرقم أو المشروع..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-44 sm:w-56 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

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

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Units */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px]">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              إجمالي المخزون
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#002117] font-num tracking-tight">
                {totalCount}
              </span>
              <span className="text-xs font-bold text-gray-500">وحدة مسجلة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">كافة الوحدات التابعة لمحفظة الشركة</p>
          </div>
        </div>

        {/* Available Units */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px]">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              جاهزة للحجز
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#166534] font-num tracking-tight">
                {availableCount}
              </span>
              <span className="text-xs font-bold text-emerald-700">وحدة متاحة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">متاحة للبيع والحجز المؤقت (72h)</p>
          </div>
        </div>

        {/* Reserved Units */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[150px]">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              حجز مؤقت (72h)
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#9a3412] font-num tracking-tight">
                {reservedCount}
              </span>
              <span className="text-xs font-bold text-orange-700">وحدة محجوزة</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">تنتهي تلقائياً بعد انقضاء المهلة</p>
          </div>
        </div>

        {/* Sold Units */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#043327] to-[#002117] rounded-[28px] p-5 text-white flex flex-col justify-between min-h-[150px] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-200">
              الوحدات المباعة
            </span>
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-white font-num tracking-tight">
                {soldCount}
              </span>
              <span className="text-xs text-emerald-200 font-sans">وحدة مباعة</span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1 font-medium">تم اعتماد عقودها نهائياً ولا تلغى</p>
          </div>
        </div>
      </div>

      {/* FILTER & PRICE RANGE BAR (Server-Side Filtering by Status, MinPrice, MaxPrice, Sorting) */}
      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[#064e3b] text-white shadow-xs"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setStatusFilter("AVAILABLE")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "AVAILABLE"
                ? "bg-[#166534] text-white shadow-xs"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            المتاحة ({availableCount})
          </button>
          <button
            onClick={() => setStatusFilter("RESERVED")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "RESERVED"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            المحجوزة ({reservedCount})
          </button>
          <button
            onClick={() => setStatusFilter("SOLD")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "SOLD"
                ? "bg-gray-800 text-white shadow-xs"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            المباعة ({soldCount})
          </button>
        </div>

        {/* Server-Side Min/Max Price Filter */}
        <form onSubmit={handleApplyPriceFilter} className="flex items-center gap-2">
          <span className="text-gray-400 font-medium">السعر (ر.س):</span>
          <input
            type="number"
            placeholder="الحد الأدنى"
            value={minPriceFilter}
            onChange={(e) => setMinPriceFilter(e.target.value)}
            className="w-24 sm:w-28 h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num text-[11px]"
          />
          <span className="text-gray-300">-</span>
          <input
            type="number"
            placeholder="الحد الأقصى"
            value={maxPriceFilter}
            onChange={(e) => setMaxPriceFilter(e.target.value)}
            className="w-24 sm:w-28 h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num text-[11px]"
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#003527] transition-all flex items-center gap-1 cursor-pointer"
          >
            <Filter className="w-3 h-3" />
            <span>تصفية</span>
          </button>
          {(minPriceFilter || maxPriceFilter) && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="إعادة تعيين التصفية"
              className="h-8 px-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </form>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-medium">ترتيب:</span>
          <div className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer"
            >
              <option value="newest">الأحدث إضافة</option>
              <option value="priceAsc">السعر: من الأقل</option>
              <option value="priceDesc">السعر: من الأعلى</option>
              <option value="areaAsc">المساحة: الأصغر</option>
              <option value="areaDesc">المساحة: الأكبر</option>
            </select>
          </div>
        </div>
      </div>

      {/* UNITS DATA TABLE */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#fcfdfa] text-gray-500 font-bold border-b border-gray-100 select-none">
              <tr className="h-11">
                <th className="pr-6 pl-3">رقم الوحدة</th>
                <th className="px-3">المشروع</th>
                <th className="px-3">النوع والطابق</th>
                <th className="px-3">المساحة والغرف</th>
                <th className="px-3 font-num">السعر المعتمد</th>
                <th className="px-3 text-center">الحالة</th>
                <th className="px-3">الحجز النشط</th>
                <th className="pl-6 pr-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/80 text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-semibold text-gray-500">جاري تحميل بيانات الوحدات...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-10 h-10 stroke-[1.2] text-gray-300" />
                      <span className="text-sm font-bold text-gray-700">لا توجد وحدات تطابق معايير البحث</span>
                      <span className="text-xs text-gray-400">جرّب تعديل نطاق السعر أو الحالة المحددة</span>
                    </div>
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isAvailable = unit.status === "AVAILABLE";
                  const isReserved = unit.status === "RESERVED";

                  return (
                    <tr
                      key={unit.id}
                      onClick={() => handleOpenDetails(unit)}
                      className="h-16 hover:bg-[#fafaf8] transition-colors group cursor-pointer"
                    >
                      <td className="pr-6 pl-3 font-extrabold text-gray-900 font-num text-sm">
                        #{unit.code}
                      </td>

                      <td className="px-3 font-semibold text-[#002117]">
                        {unit.project}
                      </td>

                      <td className="px-3 text-gray-600">
                        <div className="flex flex-col">
                          <span>{unit.type}</span>
                          <span className="text-[10px] text-gray-400">طابق {unit.floor}</span>
                        </div>
                      </td>

                      <td className="px-3 font-num text-gray-600">
                        <span className="font-semibold text-gray-900">{unit.area}</span> م² • <span className="font-semibold text-gray-900">{unit.rooms}</span> غرف
                      </td>

                      <td className="px-3 font-num font-extrabold text-gray-900 text-sm">
                        {formatPriceDisplay(unit)}
                      </td>

                      <td className="px-3 text-center">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#166534]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#166534]"></span>
                            متاحة
                          </span>
                        ) : isReserved ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-[#ffedd5] text-[#9a3412]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9a3412] animate-pulse"></span>
                            محجوزة (72h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                            مباعة
                          </span>
                        )}
                      </td>

                      <td className="px-3 text-xs">
                        {unit.reservation ? (
                          <div className="flex flex-col text-[11px]">
                            <span className="font-semibold text-gray-800">{unit.reservation.clientName}</span>
                            <span className="text-[10px] text-indigo-700 font-num font-medium">
                              ينتهي: {new Date(unit.reservation.expiresAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="pl-6 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(unit)}
                            title="عرض تفاصيل الوحدة"
                            className="p-1.5 rounded-full text-gray-500 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAvailable && userRole === "SALES_AGENT" && (
                            <button
                              onClick={() => handleOpenReserve(unit)}
                              className="px-3 py-1 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                              حجز 72h
                            </button>
                          )}

                          {userRole === "COMPANY_ADMIN" && (
                            <button
                              onClick={() => handleOpenEditPrice(unit)}
                              disabled={!isAvailable}
                              title={!isAvailable ? "لا يمكن تعديل سعر وحدة محجوزة أو مباعة" : "تعديل السعر المعتمد"}
                              className={`p-1.5 rounded-full transition-colors ${
                                isAvailable
                                  ? "text-gray-500 hover:text-[#064e3b] hover:bg-emerald-50 cursor-pointer"
                                  : "text-gray-300 cursor-not-allowed"
                              }`}
                            >
                              <Tag className="w-4 h-4" />
                            </button>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 text-xs font-num">
            <span className="text-gray-500 font-sans">
              الصفحة {page} من {totalPages} ({totalCount} وحدة إجمالاً)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1 cursor-pointer font-sans"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1 cursor-pointer font-sans"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UNIT DETAILS MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="الملف التفصيلي للوحدة العقارية"
      >
        {selectedDetailsUnit && (
          <div className="flex flex-col gap-4 text-xs font-sans">
            <div className="bg-[#fcfdfa] border border-gray-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#064e3b] font-bold flex items-center justify-center text-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-base text-[#002117]">
                    الوحدة #{selectedDetailsUnit.code}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedDetailsUnit.project}
                  </span>
                </div>
              </div>

              <div>
                {selectedDetailsUnit.status === "AVAILABLE" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#166534]">
                    متاحة للحجز والبيع
                  </span>
                ) : selectedDetailsUnit.status === "RESERVED" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ffedd5] text-[#9a3412]">
                    محجوزة مؤقتاً (72h)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                    مباعة بمعقد معتمد
                  </span>
                )}
              </div>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col">
                <span className="text-[11px] text-gray-400">النوع</span>
                <span className="font-bold text-gray-800 text-xs mt-0.5">{selectedDetailsUnit.type}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col">
                <span className="text-[11px] text-gray-400">الطابق</span>
                <span className="font-bold text-gray-800 text-xs mt-0.5">طابق {selectedDetailsUnit.floor}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col">
                <span className="text-[11px] text-gray-400">المساحة</span>
                <span className="font-bold text-gray-800 text-xs font-num mt-0.5">{selectedDetailsUnit.area} م²</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col">
                <span className="text-[11px] text-gray-400">الغرف</span>
                <span className="font-bold text-gray-800 text-xs font-num mt-0.5">{selectedDetailsUnit.rooms} غرف</span>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs">السعر المعتمد:</span>
              <span className="text-xl font-extrabold text-[#064e3b] font-num">
                {formatPriceDisplay(selectedDetailsUnit)}
              </span>
            </div>

            {/* Active Reservation Notice if any */}
            {selectedDetailsUnit.reservation ? (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Clock className="w-4 h-4 text-indigo-700" />
                  <span>تفاصيل الحجز المؤقت القائم:</span>
                </div>
                <div className="text-xs text-indigo-950 flex flex-col gap-1">
                  <span>العميل: <strong>{selectedDetailsUnit.reservation.clientName}</strong></span>
                  <span>المندوب: {selectedDetailsUnit.reservation.agentName}</span>
                  <span className="font-num text-[11px] text-indigo-800 font-bold">
                    ينتهي الحجز في: {new Date(selectedDetailsUnit.reservation.expiresAt).toLocaleString("ar-SA")}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Policy badge if RESERVED or SOLD */}
            {selectedDetailsUnit.status !== "AVAILABLE" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                قيد أمني: لا يجوز تعديل سعر أي وحدة محجوزة أو مباعة وفقاً للوائح النظام الرقابي.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
              <div className="flex items-center gap-2">
                {selectedDetailsUnit.status === "AVAILABLE" && userRole === "SALES_AGENT" && (
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenReserve(selectedDetailsUnit);
                    }}
                    className="px-4 py-2 rounded-full bg-[#064e3b] text-white font-bold hover:bg-[#003527] transition-all cursor-pointer"
                  >
                    حجز هذه الوحدة (72h)
                  </button>
                )}

                {selectedDetailsUnit.status === "AVAILABLE" && userRole === "COMPANY_ADMIN" && (
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenEditPrice(selectedDetailsUnit);
                    }}
                    className="px-4 py-2 rounded-full bg-emerald-100 text-[#064e3b] font-bold hover:bg-emerald-200 transition-all cursor-pointer"
                  >
                    تعديل السعر المعتمد
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-5 py-2 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* RESERVE MODAL */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title={`تأكيد حجز الوحدة #${selectedUnit?.code} (لمدة 72 ساعة)`}
      >
        <form onSubmit={handleConfirmReservation} className="flex flex-col gap-4 text-xs font-sans">
          <div className="bg-[#ecfdf5] border border-emerald-200 rounded-2xl p-4 flex flex-col gap-1.5">
            <span className="font-bold text-[#065f46] text-sm">
              الوحدة: #{selectedUnit?.code} • {selectedUnit?.project}
            </span>
            <span className="text-gray-600 font-num">
              السعر: {selectedUnit ? formatPriceDisplay(selectedUnit) : ""} • {selectedUnit?.type} • {selectedUnit?.area} م²
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold mt-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                سيتم قفل الوحدة حصرياً لك لمدة 72 ساعة لمنع أي تعارض أو حجز متزامن.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-bold text-gray-700">اختر العميل المعتمد *</label>
            {myClients.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                ليس لديك أي عملاء مسجلين حالياً. يرجى التوجه لتبويب «إدارة العملاء» لإضافة عميل أولاً.
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-semibold cursor-pointer"
                required
              >
                {myClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsReserveModalOpen(false)}
              className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={myClients.length === 0}
              className="px-5 py-2 rounded-full bg-[#064e3b] text-white font-bold hover:bg-[#003527] disabled:opacity-50 shadow-sm cursor-pointer"
            >
              تأكيد الحجز الذري
            </button>
          </div>
        </form>
      </Modal>

      {/* ADD UNIT MODAL (Only ADMIN can create) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة وحدة عقارية جديدة إلى المحفظة"
      >
        <form onSubmit={handleCreateUnit} className="flex flex-col gap-3 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">اسم المشروع *</label>
              <input
                type="text"
                required
                placeholder="مثال: برج الأندلس، فلل الياسمين"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">رقم/كود الوحدة *</label>
              <input
                type="text"
                required
                placeholder="مثال: A-101, V-05"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">النوع *</label>
              <input
                type="text"
                required
                placeholder="شقة، فيلا، تاون هاوس"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">الطابق *</label>
              <input
                type="text"
                required
                placeholder="الأرضي، الأول، روف"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">المساحة (م²) *</label>
              <input
                type="number"
                min="10"
                required
                value={newArea}
                onChange={(e) => setNewArea(Number(e.target.value))}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">عدد الغرف *</label>
              <input
                type="number"
                min="1"
                required
                value={newRooms}
                onChange={(e) => setNewRooms(Number(e.target.value))}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700">السعر (ر.س) *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="مثال: 750000"
                value={newPriceSar}
                onChange={(e) => setNewPriceSar(e.target.value)}
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#064e3b] text-white font-bold hover:bg-[#003527] shadow-sm cursor-pointer"
            >
              حفظ الوحدة
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRICE MODAL (Only ADMIN can update, prohibited on RESERVED or SOLD) */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={`تعديل السعر المعتمد للوحدة #${selectedUnit?.code}`}
      >
        <form onSubmit={handleSavePrice} className="flex flex-col gap-4 text-xs font-sans">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 leading-relaxed font-sans">
            <span className="font-bold block mb-1">تنبيه رقابي:</span>
            وفقاً لسياسات النظام، لا يجوز تعديل سعر أي وحدة محجوزة أو مباعة. سيتم تسجيل وتوثيق عملية تعديل السعر في سجل التدقيق والرقابة تلقائياً.
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-bold text-gray-700">السعر الحالي</label>
            <span className="text-base font-bold text-gray-900 font-num">
              {selectedUnit ? formatPriceDisplay(selectedUnit) : ""}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-bold text-gray-700">السعر الجديد (ر.س) *</label>
            <input
              type="number"
              min="1"
              required
              placeholder="أدخل السعر الجديد بالريال"
              value={editPriceSar}
              onChange={(e) => setEditPriceSar(e.target.value)}
              className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-num font-bold"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsPriceModalOpen(false)}
              className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#064e3b] text-white font-bold hover:bg-[#003527] shadow-sm cursor-pointer"
            >
              حفظ وتوثيق السعر
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
