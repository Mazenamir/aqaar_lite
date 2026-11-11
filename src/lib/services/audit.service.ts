import { PrismaClient, Prisma } from "@prisma/client";

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditService {
  /**
   * Sanitizes audit metadata to prevent passwords, tokens, or secrets from entering audit logs.
   */
  public static sanitizeDetails(details: Record<string, unknown> | string): string {
    if (typeof details === "string") {
      try {
        const parsed = JSON.parse(details);
        return JSON.stringify(this.cleanObject(parsed));
      } catch {
        return details;
      }
    }
    return JSON.stringify(this.cleanObject(details));
  }

  private static cleanObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "passwordhash", "token", "sessiontoken", "secret", "cvv", "cardnumber"];
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        cleaned[key] = "[REDACTED]";
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        cleaned[key] = this.cleanObject(value as Record<string, unknown>);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Retrieves tenant audit trail with pagination and filtering.
   * Scoped strictly by companyId.
   */
  public static async listAuditLogs(
    prisma: PrismaClient,
    companyId: string,
    options: AuditQueryOptions = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(200, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      companyId,
      ...(options.action && options.action !== "all" ? { action: options.action } : {}),
      ...(options.entityType && options.entityType !== "all" ? { entityType: options.entityType } : {}),
      ...(options.startDate || options.endDate
        ? {
            createdAt: {
              ...(options.startDate ? { gte: options.startDate } : {}),
              ...(options.endDate ? { lte: options.endDate } : {}),
            },
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      }),
    ]);

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      ipAddress: log.ipAddress || "Internal Server",
      userName: log.user?.name || "النظام الأمني",
      userRole: log.user?.role || "SYSTEM",
      userEmail: log.user?.email || null,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      logs: formattedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Helper to write an immutable audit log entry.
   * Always sanitizes details before persisting.
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
    const sanitizedDetails = this.sanitizeDetails(params.details);

    return await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: sanitizedDetails,
        ipAddress: params.ipAddress,
      },
    });
  }
}
