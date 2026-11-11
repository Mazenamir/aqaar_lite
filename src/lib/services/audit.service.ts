import { PrismaClient } from "@prisma/client";

export class AuditService {
  /**
   * Retrieves tenant audit trail ordered by most recent first.
   * Access is strictly restricted to COMPANY_ADMIN at the route level.
   */
  public static async listAuditLogs(prisma: PrismaClient, companyId: string, limit = 100) {
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, role: true },
        },
      },
      take: Math.min(limit, 500),
    });

    return logs.map((log) => ({
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
  }

  /**
   * Helper to write an immutable audit log entry.
   */
  public static async log(
    prisma: PrismaClient,
    params: {
      companyId: string;
      userId?: string;
      action: string;
      entityType: string;
      entityId?: string;
      details: Record<string, unknown> | string;
      ipAddress?: string;
    }
  ) {
    const detailsString =
      typeof params.details === "string" ? params.details : JSON.stringify(params.details);

    return await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: detailsString,
        ipAddress: params.ipAddress,
      },
    });
  }
}
