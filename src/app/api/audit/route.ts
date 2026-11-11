import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const logs = await prisma.auditLog.findMany({
      where: { companyId: user!.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, role: true },
        },
      },
      take: 100,
    });

    const formatted = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      ipAddress: log.ipAddress || "Internal Server",
      userName: log.user?.name || "النظام الأمني",
      userRole: log.user?.role || "SYSTEM",
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل استرجاع سجل التدقيق" }, { status: 400 });
  }
}
