"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Phone, 
  Clock, 
  Search, 
  Filter, 
  SortAsc, 
  RefreshCw,
  Building,
  CheckCircle2,
  Calendar,
  AlertCircle
} from "lucide-react";

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdByName: string;
  activeReservationsCount: number;
  contractsCount: number;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Add Client Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

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
      fetchClients();
    } catch (err: any) {
      setFormError(err.message);
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
          c.notes.toLowerCase().includes(search.toLowerCase());

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
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Header Banner & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-primary text-2xl font-bold">
              <Users className="w-8 h-8 text-primary" />
              <h1>إدارة العملاء</h1>
            </div>
            <p className="text-sm text-on-surface-variant mt-1">
              قائمة العملاء المخصصين لنطاقك البيعي وفق معايير الخصوصية وعزل البيانات
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 px-5 bg-primary-container text-on-primary font-semibold text-sm rounded-xl shadow-md hover:bg-primary transition-all flex items-center gap-2 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ إضافة عميل جديد</span>
            </button>
          </div>
        </div>

        {/* Rep Isolation Notice Banner */}
        <div className="bg-surface-container-low rounded-xl p-4 flex items-center justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
              <ShieldCheck className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-on-surface font-bold">نطاق الصلاحيات المعزول (Agent Isolation)</span>
              <span className="text-xs text-on-surface-variant">
                تنبيه: مسؤولو المبيعات يشاهدون فقط العملاء الذين تم تسجيلهم بواسطة حسابهم المباشر لحماية أمان العملاء.
              </span>
            </div>
          </div>
          <span className="text-xs text-secondary bg-surface-container-lowest px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            صلاحية نشطة
          </span>
        </div>

        {/* Metric Badges Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">إجمالي العملاء المخصصين</span>
              <span className="text-3xl text-primary font-bold font-mono mt-1">{totalClients}</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">لديهم عقود سارية</span>
              <span className="text-3xl text-secondary font-bold font-mono mt-1">{withContracts}</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-secondary-container/40 flex items-center justify-center text-secondary">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">حجوزات نشطة (قيد التعاقد)</span>
              <span className="text-3xl text-amber-600 font-bold font-mono mt-1">{withReservations}</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">عملاء محتملون</span>
              <span className="text-3xl text-on-surface font-bold font-mono mt-1">{potentials}</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <Building className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، رقم الجوال، أو الملاحظات..."
              className="w-full h-11 pr-11 pl-4 bg-surface text-on-surface text-sm rounded-xl outline-none shadow-sm focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-surface px-3 py-2 rounded-xl shadow-sm border border-outline-variant/30">
              <Filter className="w-4 h-4 text-secondary" />
              <label htmlFor="statusFilter" className="text-xs text-on-surface-variant font-medium">
                حالة العميل:
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-on-surface font-semibold outline-none cursor-pointer"
              >
                <option value="all">الكل ({totalClients})</option>
                <option value="active-contract">عقد ساري ({withContracts})</option>
                <option value="active-reserve">حجز نشط ({withReservations})</option>
                <option value="potential">عميل محتمل ({potentials})</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-surface px-3 py-2 rounded-xl shadow-sm border border-outline-variant/30">
              <SortAsc className="w-4 h-4 text-secondary" />
              <label htmlFor="sortBy" className="text-xs text-on-surface-variant font-medium">
                الترتيب:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-on-surface font-semibold outline-none cursor-pointer"
              >
                <option value="date-desc">تاريخ الإضافة (الأحدث)</option>
                <option value="date-asc">تاريخ الإضافة (الأقدم)</option>
                <option value="name-asc">الاسم (أ - ي)</option>
              </select>
            </div>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setSortBy("date-desc");
              }}
              title="إعادة ضبط الفلاتر"
              className="h-10 w-10 bg-surface text-on-surface-variant hover:text-on-surface rounded-xl shadow-sm border border-outline-variant/30 flex items-center justify-center transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">جاري تحميل سجلات العملاء...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
              <button
                onClick={fetchClients}
                className="mt-2 px-4 py-2 bg-surface-container text-on-surface text-xs rounded-lg hover:bg-surface-container-high transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <Users className="w-12 h-12 stroke-[1.5] text-outline-variant" />
              <span className="text-base font-semibold text-on-surface">لا توجد نتائج مطابقة</span>
              <span className="text-xs">جرّب تغيير عبارة البحث أو الفلتر المختار</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right border-collapse min-w-[900px]">
                <thead>
                  <tr className="h-12 bg-surface-container-low text-on-surface-variant text-xs font-semibold select-none border-b border-surface-container">
                    <th className="pr-6 pl-3 py-2">العميل</th>
                    <th className="px-4 py-2">رقم الجوال</th>
                    <th className="px-4 py-2">المسؤول المباشر</th>
                    <th className="px-4 py-2">الوحدات / الحجوزات</th>
                    <th className="px-4 py-2">حالة التعاقد</th>
                    <th className="px-4 py-2">تاريخ التسجيل</th>
                    <th className="px-4 py-2">ملاحظات المبيعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm text-on-surface">
                  {filteredClients.map((client) => {
                    const hasContract = client.contractsCount > 0;
                    const hasReservation = client.activeReservationsCount > 0;

                    return (
                      <tr key={client.id} className="h-16 hover:bg-surface/60 transition-colors group">
                        <td className="pr-6 pl-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                              {client.name.trim().slice(0, 1)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                                {client.name}
                              </span>
                              <span className="text-xs text-on-surface-variant font-mono">
                                ID: {client.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-medium text-xs dir-ltr text-right" dir="ltr">
                          <span className="inline-flex items-center gap-1.5 text-on-surface">
                            <Phone className="w-3.5 h-3.5 text-secondary" />
                            {client.phone}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-on-surface font-medium">
                          {client.createdByName}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            {client.activeReservationsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                {client.activeReservationsCount} حجز نشط
                              </span>
                            )}
                            {client.contractsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                                {client.contractsCount} عقد
                              </span>
                            )}
                            {client.activeReservationsCount === 0 && client.contractsCount === 0 && (
                              <span className="text-on-surface-variant">-</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {hasContract ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                              عقد ساري
                            </span>
                          ) : hasReservation ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              حجز مؤقت
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                              عميل محتمل
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-on-surface-variant font-mono">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(client.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-on-surface-variant max-w-xs truncate" title={client.notes}>
                          {client.notes || "لا توجد ملاحظات"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Client Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="إضافة عميل جديد"
        >
          <form onSubmit={handleCreateClient} className="flex flex-col gap-4">
            {formError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                الاسم الكامل للعميل <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: محمد بن عبد العزيز الراجحي"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                رقم الجوال <span className="text-error">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="05XXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-10 px-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 font-mono text-left"
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                ملاحظات واحتياجات العميل
              </label>
              <textarea
                rows={3}
                placeholder="الميزانية المقترحة، متطلبات التمويل، الحي المستهدف..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="p-3 bg-surface text-on-surface text-sm rounded-xl outline-none border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between text-xs text-on-surface-variant">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-secondary" />
                <span>سيتم ربط العميل بحسابك المباشر في الشركة تلقائياً</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-5 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
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
    </AppShell>
  );
}
