"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ShieldAlert,
  Search,
  Lock,
  Database,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCheck
} from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress: string;
  userName: string;
  userRole: string;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/audit");
      if (!res.ok) {
        if (res.status === 403) throw new Error("غير مصرح: هذا السجل مخصص لمدير الشركة فقط");
        throw new Error("تعذر تحميل سجل التدقيق والرقابة");
      }
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل السجلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "UNIT_PRICE_CHANGED":
        return { label: "تعديل سعر وحدة", color: "bg-red-100 text-red-900 border-red-200" };
      case "CONTRACT_APPROVED":
        return { label: "اعتماد عقد وترحيل", color: "bg-emerald-100 text-emerald-900 border-emerald-200" };
      case "CONTRACT_DRAFTED":
        return { label: "إنشاء مسودة عقد", color: "bg-amber-100 text-amber-900 border-amber-200" };
      case "PAYMENT_RECORDED":
        return { label: "تسجيل سند قبض", color: "bg-blue-100 text-blue-900 border-blue-200" };
      case "UNIT_RESERVED":
        return { label: "حجز وحدة مؤقت", color: "bg-purple-100 text-purple-900 border-purple-200" };
      case "RESERVATIONS_EXPIRED":
        return { label: "انتهاء حجز تلقائي", color: "bg-gray-100 text-gray-800 border-gray-200" };
      default:
        return { label: action, color: "bg-surface-container text-on-surface border-surface-container" };
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === "COMPANY_ADMIN") return "مدير الشركة";
    if (role === "ACCOUNTANT") return "محاسب مالي";
    if (role === "SALES_AGENT") return "مندوب مبيعات";
    return role;
  };

  const parseDetails = (detailsStr: string) => {
    try {
      const obj = JSON.parse(detailsStr);
      if (obj.oldPriceHalalas && obj.newPriceHalalas) {
        const oldSar = (Number(obj.oldPriceHalalas) / 100).toLocaleString("ar-SA");
        const newSar = (Number(obj.newPriceHalalas) / 100).toLocaleString("ar-SA");
        return `تغيير السعر: من ${oldSar} ر.س إلى ${newSar} ر.س`;
      }
      if (obj.contractNumber) {
        return `رقم العقد: ${obj.contractNumber} (وحدة: ${obj.unitCode || obj.unitId || ""})`;
      }
      if (obj.amountHalalas) {
        const sar = (Number(obj.amountHalalas) / 100).toLocaleString("ar-SA");
        return `مبلغ السداد: ${sar} ر.س (مفتاح: ${obj.idempotencyKey?.slice(0, 8)}...)`;
      }
      return detailsStr;
    } catch (e) {
      return detailsStr;
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        log.entityId.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (roleFilter !== "all" && log.userRole !== roleFilter) return false;

      return true;
    });
  }, [logs, search, actionFilter, roleFilter]);

  const priceChangesCount = logs.filter((l) => l.action === "UNIT_PRICE_CHANGED").length;
  const approvalsCount = logs.filter((l) => l.action === "CONTRACT_APPROVED").length;

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">سجل الرقابة وتدقيق العمليات</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-surface-container-high text-primary text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                صلاحية: مدير الشركة فقط (Read-Only)
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              سجل تدقيق شامل ومحمي للقراءة فقط مخصص لمدير الشركة لمتابعة كافة العمليات الحساسة والامتثال المالي
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm border border-outline-variant/20">
              <Database className="w-4 h-4 text-secondary" />
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant font-medium">إجمالي السجلات</span>
                <span className="text-base text-primary font-bold font-mono">{logs.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm border border-outline-variant/20">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant font-medium">العقود المعتمدة</span>
                <span className="text-base text-emerald-700 font-bold font-mono">{approvalsCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm border border-outline-variant/20">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant font-medium">تعديلات الأسعار</span>
                <span className="text-base text-red-700 font-bold font-mono">{priceChangesCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Immutable Audit Vault Info Banner */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="absolute -left-10 -bottom-10 w-44 h-44 rounded-full bg-primary/5 pointer-events-none blur-2xl"></div>
          <div className="flex items-start md:items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary">
                نظام سلامة السجلات المعزز (Append-Only Immutable Ledger)
              </span>
              <p className="text-xs text-on-surface-variant max-w-3xl mt-0.5">
                سجل العمليات محمي وغير قابل للتعديل أو الحذف وفق معايير الحوكمة المالية. يتم تسجيل كل تعديل لسعر
                الوحدات واعتماد العقود مع عزل كامل على مستوى الشركة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 relative z-10">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
              <span>Status: Immutable</span>
            </span>
          </div>
        </div>

        {/* Filters & Search Strip */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Search */}
            <div className="md:col-span-5 flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">بحث سريع في الأنشطة</label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute right-3 text-on-surface-variant pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالمستخدم، الإجراء، أو التفاصيل..."
                  className="h-10 pr-9 pl-3 w-full bg-surface text-on-surface text-xs rounded-xl outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/30"
                />
              </div>
            </div>

            {/* Action Type */}
            <div className="md:col-span-4 flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">نوع الإجراء</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/30 cursor-pointer"
              >
                <option value="all">كافة الإجراءات المسجلة</option>
                <option value="UNIT_PRICE_CHANGED">تعديل أسعار الوحدات</option>
                <option value="CONTRACT_APPROVED">اعتماد العقود وترحيل الأقساط</option>
                <option value="CONTRACT_DRAFTED">إنشاء مسودات العقود</option>
                <option value="PAYMENT_RECORDED">تسجيل المدفوعات وسندات القبض</option>
                <option value="UNIT_RESERVED">حجوزات الوحدات</option>
              </select>
            </div>

            {/* User Role */}
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface">الدور الوظيفي</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 px-3 bg-surface text-on-surface text-xs rounded-xl outline-none border border-outline-variant/30 cursor-pointer"
              >
                <option value="all">كافة الأدوار</option>
                <option value="COMPANY_ADMIN">مدير الشركة</option>
                <option value="ACCOUNTANT">محاسب مالي</option>
                <option value="SALES_AGENT">مندوب مبيعات</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">جاري تحميل سجل التدقيق والرقابة...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <ShieldAlert className="w-12 h-12 stroke-[1.5] text-outline-variant" />
              <span className="text-base font-semibold text-on-surface">لا توجد سجلات مطابقة</span>
              <span className="text-xs">جرّب اختيار فلتر إجراء مختلف أو مسح البحث</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant font-semibold select-none border-b border-surface-container">
                  <tr className="h-11">
                    <th className="pr-6 pl-3">الوقت والتاريخ</th>
                    <th className="px-4">المستخدم والمنصب</th>
                    <th className="px-4">نوع الإجراء</th>
                    <th className="px-4">الكيان المتأثر</th>
                    <th className="px-4">تفاصيل التغيير</th>
                    <th className="px-4 text-left">عنوان IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface font-body-sm">
                  {filteredLogs.map((log) => {
                    const badge = getActionBadge(log.action);
                    return (
                      <tr key={log.id} className="h-16 hover:bg-surface/60 transition-colors">
                        <td className="pr-6 pl-3 font-mono whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface">
                              {log.createdAt.split("T")[0]}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {log.createdAt.split("T")[1]?.slice(0, 8)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {log.userName.slice(0, 1)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">{log.userName}</span>
                              <span className="text-[10px] text-primary font-medium">
                                {getRoleLabel(log.userRole)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-4 font-mono font-medium whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface">
                            {log.entityType} #{log.entityId.slice(0, 8)}
                          </span>
                        </td>

                        <td className="px-4 max-w-md">
                          <span className="text-on-surface font-medium block truncate" title={log.details}>
                            {parseDetails(log.details)}
                          </span>
                        </td>

                        <td className="px-4 text-left font-mono text-[11px] text-on-surface-variant whitespace-nowrap" dir="ltr">
                          {log.ipAddress}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
