import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { AuditService } from "@/lib/services/audit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parseResult = auditQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message || "معلمات غير صالحة" },
        { status: 400 }
      );
    }

    const { page, limit, action, entityType, startDate, endDate } = parseResult.data;

    const result = await AuditService.listAuditLogs(prisma, user!.companyId, {
      page,
      limit,
      action,
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

// Audit Log Immutability: Audit records can NEVER be modified or deleted
export async function POST() {
  return NextResponse.json(
    { success: false, error: "سجلات التدقيق غير قابلة للإنشاء المباشر عبر الواجهة؛ تُولد تلقائياً داخل العمليات التجارية" },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "سجلات التدقيق غير قابلة للتعديل نهائياً" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: "سجلات التدقيق غير قابلة للتعديل نهائياً" },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: "سجلات التدقيق غير قابلة للحذف نهائياً" },
    { status: 405 }
  );
}
