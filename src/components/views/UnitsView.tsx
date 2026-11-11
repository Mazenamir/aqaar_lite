"use client";

import { useEffect, useState, useMemo } from "react";
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
  ArrowUpRight,
  Sparkles,
  Calendar,
  Layers,
  ArrowLeft,
  SlidersHorizontal,
  Home,
  Building
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

interface UnitsViewProps {
  onNavigateTab?: (tab: string, href: string) => void;
}

export function UnitsView({ onNavigateTab }: UnitsViewProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("المستخدم");
  const [userRole, setUserRole] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("شركة الرياض");

  // Filters & Search
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
        if (d?.user) {
          setUserName(d.user.name || "المستخدم");
          setUserRole(d.user.role || "");
          setCompanyName(d.user.companyName || "شركة الرياض");
        }
      });
  }, []);

  // Fetch Units
  const fetchUnits = async () => {
    try {
      setLoading(true);
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
        setFeedbackMsg({
          type: "error",
          text: data.error || "فشل حجز الوحدة، قد تكون محجوزة بالفعل من قبل مندوب آخر.",
        });
        return;
      }

      setIsReserveModalOpen(false);
      setFeedbackMsg({
        type: "success",
        text: `تم حجز الوحدة #${selectedUnit.code} بنجاح لمدة 72 ساعة لصالح العميل المختار!`,
      });
      fetchUnits();
    } catch (e) {
      setFeedbackMsg({ type: "error", text: "حدث خطأ في الاتصال بالخادم أثناء تأكيد الحجز" });
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
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
        alert(data.error || "فشل إضافة الوحدة");
        return;
      }

      setIsAddModalOpen(false);
      setNewProject("");
      setNewCode("");
      setNewPriceSar("");
      fetchUnits();
    } catch (e) {
      alert("حدث خطأ أثناء حفظ الوحدة");
    }
  };

  const handleOpenEditPrice = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditPriceSar("");
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
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
        alert(data.error || "فشل تعديل السعر");
        return;
      }

      setIsPriceModalOpen(false);
      fetchUnits();
    } catch (e) {
      alert("خطأ أثناء تعديل السعر");
    }
  };

  // Counts for Bento Cards
  const availableCount = units.filter((u) => u.status === "AVAILABLE").length;
  const reservedCount = units.filter((u) => u.status === "RESERVED").length;
  const soldCount = units.filter((u) => u.status === "SOLD").length;
  const totalValuationSar = useMemo(() => {
    const totalHalalas = units.reduce((acc, u) => acc + BigInt(u.priceHalalas || "0"), 0n);
    return (Number(totalHalalas) / 100).toLocaleString("en-US");
  }, [units]);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Header Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        {/* Greeting */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002117] tracking-tight flex items-center gap-2">
            <span>مرحباً {userName.split(" ")[0]}</span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            سعداء برؤيتك مجدداً! إليك أحدث مؤشرات مبيعات الوحدات العقارية اليوم.
          </p>
        </div>

        {/* Action & Utility Pills Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-white border border-gray-200/80 rounded-full px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs flex items-center gap-1.5 select-none">
            <Home className="w-3.5 h-3.5 text-[#064e3b]" />
            <span>الرئيسية</span>
          </div>

          {(userRole === "COMPANY_ADMIN" || userRole === "SALES_AGENT") && (
            <button
              onClick={() => (userRole === "COMPANY_ADMIN" ? setIsAddModalOpen(true) : setStatusFilter("AVAILABLE"))}
              className="bg-[#064e3b] hover:bg-[#003527] text-white rounded-full px-4 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{userRole === "COMPANY_ADMIN" ? "+ إضافة وحدة جديدة" : "حجز وحدة متاحة"}</span>
            </button>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث سريع عن وحدة أو مشروع..."
              className="bg-white border border-gray-200/80 rounded-full pr-8 pl-4 py-2 text-xs text-gray-800 shadow-xs outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 w-40 sm:w-52 transition-all placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-white border border-gray-200/80 rounded-full px-3.5 py-2 text-xs font-num font-bold text-gray-700 shadow-xs select-none">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>10:37 ص</span>
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

      {/* BENTO GRID ROW 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[175px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#d9f99d]/50 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold text-xs shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              محدث لحظياً
            </span>
          </div>

          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#002117] font-num tracking-tight">
                {totalCount}
              </span>
              <span className="text-sm font-semibold text-gray-500 font-sans">وحدة</span>
            </div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              إجمالي الوحدات المسجلة في المحفظة
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100/90 relative overflow-hidden flex flex-col justify-between min-h-[175px] group hover:shadow-md transition-shadow">
          <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#fed7aa]/55 rounded-[60%_40%_30%_70%/50%_60%_40%_50%] pointer-events-none group-hover:scale-110 transition-transform"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-full bg-[#ffedd5] text-[#9a3412] flex items-center justify-center font-bold text-xs shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              جاهزة للحجز
            </span>
          </div>

          <div className="relative z-10 mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#9a3412] font-num tracking-tight">
                {availableCount}
              </span>
              <span className="text-sm font-semibold text-gray-500 font-sans">وحدة متاحة</span>
            </div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              متاحة للبيع والتقسيط مع دفعة أولى
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            const firstAvail = units.find((u) => u.status === "AVAILABLE");
            if (firstAvail) {
              handleOpenReserve(firstAvail);
            } else {
              alert("لا توجد وحدات متاحة للحجز حالياً.");
            }
          }}
          className="border-2 border-dashed border-gray-300 hover:border-[#064e3b] rounded-[28px] p-5 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer bg-white/70 hover:bg-emerald-50/40 min-h-[175px] group select-none shadow-xs"
        >
          <div className="w-11 h-11 rounded-full bg-[#dcfce7] group-hover:bg-[#064e3b] text-[#166534] group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
            <Plus className="w-5 h-5 font-bold" />
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-[#002117] group-hover:text-[#064e3b] block transition-colors">
              + حجز وحدة سريعة (72h)
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              تخصيص فوري لعميل معتمد
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#064e3b] via-[#043327] to-[#002117] rounded-[28px] p-5 text-white flex flex-col justify-between min-h-[175px] shadow-lg shadow-emerald-950/20 relative overflow-hidden group">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#b0f0d6_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-semibold text-emerald-200">
              إجمالي قيمة المعروض
            </span>
            <div className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white text-xs group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="relative z-10 my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-num tracking-tight">
                {totalValuationSar}
              </span>
              <span className="text-xs text-emerald-300 font-sans font-medium">ر.س</span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 font-num">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-semibold text-white">
              <span className="font-bold">{soldCount}</span> مباعة
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 backdrop-blur-sm text-[10px] font-semibold text-emerald-200">
              <span className="font-bold">{reservedCount}</span> محجوزة
            </span>
          </div>
        </div>
      </div>

      {/* BENTO GRID ROW 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[280px] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#064e3b] flex items-center justify-center font-bold text-xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">حركة نشاط المبيعات والحجوزات الأسبوعية</h3>
                <span className="text-[11px] text-gray-400">معدل الإقبال وتوزيع المعاملات على مدار الأيام</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0fdf4] border border-emerald-200 text-[#166534] text-xs font-semibold shadow-2xs font-num">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>الحجوزات النشطة: {reservedCount} وحدات</span>
            </div>
          </div>

          <div className="relative pt-6 pb-2">
            <svg
              viewBox="0 0 600 120"
              className="w-full h-24 overflow-visible pointer-events-none absolute top-10 left-0 right-0 z-10"
              preserveAspectRatio="none"
            >
              <path
                d="M 10,75 Q 80,110 160,50 T 320,30 T 450,75 T 590,95"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="opacity-80"
              />
              <path
                d="M 10,95 Q 120,40 240,65 T 400,20 T 590,55"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="opacity-60"
              />
            </svg>

            <div className="grid grid-cols-7 gap-2 text-center relative z-20">
              {[
                { day: "السبت", count: "3h", height: "h-20", active: false },
                { day: "الأحد", count: "5h", height: "h-28", active: false },
                { day: "الإثنين", count: "8h", height: "h-36", active: true },
                { day: "الثلاثاء", count: "2h", height: "h-16", active: false },
                { day: "الأربعاء", count: "6h", height: "h-32", active: false },
                { day: "الخميس", count: "4h", height: "h-24", active: false },
                { day: "الجمعة", count: "1h", height: "h-12", active: false },
              ].map((col, idx) => (
                <div key={idx} className="flex flex-col items-center justify-end gap-2 group cursor-pointer">
                  <span
                    className={`text-[10px] font-bold font-num px-2 py-0.5 rounded-full transition-all ${
                      col.active
                        ? "bg-[#002117] text-white shadow-sm scale-110"
                        : "bg-gray-100 text-gray-600 group-hover:bg-emerald-100 group-hover:text-emerald-800"
                    }`}
                  >
                    {col.count}
                  </span>

                  <div className="w-10 bg-gray-50 rounded-full p-1 border border-gray-100 flex flex-col justify-end h-36">
                    <div
                      className={`w-full rounded-full transition-all ${col.height} ${
                        col.active
                          ? "bg-gradient-to-t from-[#064e3b] to-[#10b981]"
                          : "bg-gray-200 group-hover:bg-[#bbf7d0]"
                      }`}
                    ></div>
                  </div>

                  <span className="text-[11px] font-semibold text-gray-500 mt-1">{col.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 bg-[#f0fdf4] border border-emerald-100 rounded-[32px] p-6 shadow-sm flex flex-col justify-between min-h-[280px]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">إحصائيات إنجاز المبيعات</h3>
              <span className="text-[11px] text-emerald-800 font-medium">معدل التعاقد والإشغال</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 my-4">
            <div className="bg-white/80 rounded-2xl p-3 border border-emerald-200/50 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex justify-between text-xs font-semibold text-gray-800">
                <span>الوحدات المباعة والمعتمدة</span>
                <span className="font-num text-[#064e3b] font-bold">
                  {totalCount > 0 ? Math.round((soldCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-[#064e3b] rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (soldCount / totalCount) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/80 rounded-2xl p-3 border border-emerald-200/50 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex justify-between text-xs font-semibold text-gray-800">
                <span>الحجوزات النشطة (72h)</span>
                <span className="font-num text-emerald-700 font-bold">
                  {totalCount > 0 ? Math.round((reservedCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (reservedCount / totalCount) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/80 rounded-2xl p-3 border border-emerald-200/50 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex justify-between text-xs font-semibold text-gray-800">
                <span>المعروض المتاح للبيع</span>
                <span className="font-num text-orange-600 font-bold">
                  {totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (availableCount / totalCount) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab?.("contracts", "/contracts")}
            className="flex items-center justify-between text-xs font-bold text-[#064e3b] pt-1 cursor-pointer hover:underline"
          >
            <span>عرض تفاصيل العقود والمبيعات</span>
            <ArrowLeft className="w-4 h-4 text-[#064e3b] rtl:rotate-0" />
          </div>
        </div>
      </div>

      {/* BENTO GRID ROW 3 */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#064e3b] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900">سجل الوحدات العقارية والأسعار</h2>
              <p className="text-xs text-gray-400">إدارة الأسعار، المساحات، وحالات الحجز والبيع</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-num">
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border border-gray-200">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === "all" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                الكل ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === "AVAILABLE" ? "bg-[#064e3b] text-white shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                متاحة ({availableCount})
              </button>
              <button
                onClick={() => setStatusFilter("RESERVED")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === "RESERVED" ? "bg-amber-500 text-white shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                محجوزة ({reservedCount})
              </button>
              <button
                onClick={() => setStatusFilter("SOLD")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === "SOLD" ? "bg-gray-800 text-white shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                مباعة ({soldCount})
              </button>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer"
              >
                <option value="newest">الأحدث إضافة</option>
                <option value="priceAsc">السعر: من الأقل</option>
                <option value="priceDesc">السعر: من الأعلى</option>
                <option value="areaDesc">المساحة: الأكبر</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50/70 text-gray-500 font-semibold select-none">
              <tr className="h-11">
                <th className="pr-4 pl-2">الوحدة</th>
                <th className="px-3">المشروع</th>
                <th className="px-3">النوع والطابق</th>
                <th className="px-3">المساحة والغرف</th>
                <th className="px-3 font-num">السعر المعتمد</th>
                <th className="px-3 text-center">حالة الوحدة</th>
                <th className="px-3">الحجز النشط</th>
                <th className="pl-4 pr-2 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                      <div className="w-7 h-7 border-3 border-[#064e3b] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">جاري تحميل بيانات الوحدات...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    لا توجد وحدات تطابق معايير البحث والفرز المحددة.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isAvailable = unit.status === "AVAILABLE";
                  const isReserved = unit.status === "RESERVED";

                  return (
                    <tr
                      key={unit.id}
                      className="h-16 hover:bg-emerald-50/20 transition-colors group"
                    >
                      <td className="pr-4 pl-2 font-bold text-gray-900 font-num text-sm">
                        #{unit.code}
                      </td>

                      <td className="px-3 font-semibold text-[#002117]">
                        {unit.project}
                      </td>

                      <td className="px-3 text-gray-600">
                        <div className="flex flex-col">
                          <span>{unit.type}</span>
                          <span className="text-[10px] text-gray-400">{unit.floor}</span>
                        </div>
                      </td>

                      <td className="px-3 font-num text-gray-600">
                        <span className="font-semibold text-gray-900">{unit.area}</span> م² • <span className="font-semibold text-gray-900">{unit.rooms}</span> غرف
                      </td>

                      <td className="px-3 font-num font-extrabold text-gray-900 text-sm">
                        {(Number(BigInt(unit.priceHalalas || "0") / 100n)).toLocaleString("en-US")} <span className="text-[10px] font-normal text-gray-400">ر.س</span>
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
                            <span className="text-[10px] text-gray-400 font-num">
                              ينتهي: {new Date(unit.reservation.expiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="pl-4 pr-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAvailable && (userRole === "SALES_AGENT" || userRole === "COMPANY_ADMIN") && (
                            <button
                              onClick={() => handleOpenReserve(unit)}
                              className="px-3 py-1.5 rounded-full bg-[#064e3b] hover:bg-[#003527] text-white text-[11px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
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
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-num">
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

      {/* MODALS */}
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
              السعر: {(Number(BigInt(selectedUnit?.priceHalalas || "0") / 100n)).toLocaleString("en-US")} ر.س • {selectedUnit?.type} • {selectedUnit?.area} م²
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
                className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#064e3b] font-semibold"
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
              {(Number(BigInt(selectedUnit?.priceHalalas || "0") / 100n)).toLocaleString("en-US")} ر.س
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
