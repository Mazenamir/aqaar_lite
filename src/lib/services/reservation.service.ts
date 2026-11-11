import { PrismaClient, UnitStatus, ReservationStatus, UserRole, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors/app-error";
import { formatSar } from "../money";

export interface CreateReservationInput {
  companyId: string;
  unitId: string;
  clientId: string;
  createdById: string;
  userRole?: UserRole;
}

export class ReservationService {
  /**
   * Sweeps expired reservations and safely returns their units to AVAILABLE.
   * Invariant: Never releases a unit that has already been converted to SOLD.
   * Concurrency: Uses atomic conditional updates inside database transactions.
   */
  public static async autoExpireReservations(prisma: PrismaClient, companyId?: string): Promise<number> {
    const now = new Date();
    const expired = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lte: now },
        ...(companyId ? { companyId } : {}),
      },
      include: { unit: true },
    });

    let expiredCount = 0;

    for (const res of expired) {
      await prisma.$transaction(async (tx) => {
        // 1. Atomically mark reservation as EXPIRED (only if still ACTIVE)
        const updatedRes = await tx.reservation.updateMany({
          where: {
            id: res.id,
            status: ReservationStatus.ACTIVE,
          },
          data: {
            status: ReservationStatus.EXPIRED,
          },
        });

        if (updatedRes.count === 0) {
          // Already transitioned concurrently
          return;
        }

        expiredCount++;

        // 2. Atomically transition unit from RESERVED to AVAILABLE
        // MANDATED INVARIANT: Never release a unit that has already been SOLD!
        const updatedUnit = await tx.unit.updateMany({
          where: {
            id: res.unitId,
            companyId: res.companyId,
            status: UnitStatus.RESERVED,
          },
          data: {
            status: UnitStatus.AVAILABLE,
          },
        });

        const releasedToAvailable = updatedUnit.count > 0;

        // 3. Immutable audit log entry
        await tx.auditLog.create({
          data: {
            companyId: res.companyId,
            action: "RESERVATION_EXPIRED",
            entityType: "Reservation",
            entityId: res.id,
            details: JSON.stringify({
              unitId: res.unitId,
              unitCode: res.unit.code,
              reason: "72 hours elapsed",
              releasedToAvailable,
              note: releasedToAvailable
                ? "Unit returned to AVAILABLE"
                : "Unit not returned to AVAILABLE (status was not RESERVED, e.g. already SOLD)",
            }),
          },
        });
      });
    }

    return expiredCount;
  }

  /**
   * Concurrency-safe reservation creation.
   * Uses an atomic conditional update inside a transaction to guarantee that only ONE
   * concurrent agent succeeds, while any competing concurrent request receives a 409 Conflict.
   */
  public static async createReservation(prisma: PrismaClient, input: CreateReservationInput) {
    // Lazy expiration sweep for the tenant before reservation
    await this.autoExpireReservations(prisma, input.companyId);

    return await prisma.$transaction(async (tx) => {
      // 1. Validate client exists in tenant and sales rep ownership
      const client = await tx.client.findFirst({
        where: {
          id: input.clientId,
          companyId: input.companyId,
        },
      });

      if (!client) {
        throw new NotFoundError("العميل غير موجود أو لا ينتمي لشركتك");
      }

      // Assert ownership: Sales agents can only reserve for their own clients
      if (input.userRole === UserRole.SALES_AGENT && client.createdById !== input.createdById) {
        throw new ForbiddenError("لا يحق لمندوب المبيعات حجز وحدة لعميل لم يقم بإنشائه");
      }

      // 2. Atomic conditional update on unit status
      // UPDATE "units" SET "status" = 'RESERVED' WHERE "id" = ? AND "companyId" = ? AND "status" = 'AVAILABLE'
      const updateResult = await tx.unit.updateMany({
        where: {
          id: input.unitId,
          companyId: input.companyId,
          status: UnitStatus.AVAILABLE,
        },
        data: {
          status: UnitStatus.RESERVED,
        },
      });

      if (updateResult.count === 0) {
        // Check if unit exists in company
        const unitExists = await tx.unit.findFirst({
          where: {
            id: input.unitId,
            companyId: input.companyId,
          },
        });

        if (!unitExists) {
          throw new NotFoundError("الوحدة غير موجودة أو لا تنتمي لشركتك");
        }

        throw new ConflictError("عذراً، الوحدة غير متاحة للحجز حالياً أو تم حجزها من قبل مندوب آخر.");
      }

      // 3. Reservation duration must be exactly 72 hours
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

      // 4. Create reservation record
      const reservation = await tx.reservation.create({
        data: {
          companyId: input.companyId,
          unitId: input.unitId,
          clientId: input.clientId,
          createdById: input.createdById,
          createdAt: now,
          expiresAt,
          status: ReservationStatus.ACTIVE,
        },
        include: {
          unit: true,
          client: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // 5. Immutable Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById,
          action: "UNIT_RESERVED",
          entityType: "Reservation",
          entityId: reservation.id,
          details: JSON.stringify({
            unitId: input.unitId,
            unitCode: reservation.unit.code,
            clientId: input.clientId,
            clientName: reservation.client.name,
            expiresAt: expiresAt.toISOString(),
          }),
        },
      });

      return {
        id: reservation.id,
        companyId: reservation.companyId,
        unitId: reservation.unitId,
        clientId: reservation.clientId,
        salesRepId: reservation.createdById,
        createdById: reservation.createdById,
        reservedAt: reservation.createdAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        expiresAt: reservation.expiresAt.toISOString(),
        status: reservation.status,
        unit: {
          id: reservation.unit.id,
          code: reservation.unit.code,
          unitNumber: reservation.unit.code,
          project: reservation.unit.project,
          projectName: reservation.unit.project,
          type: reservation.unit.type,
          price: reservation.unit.price.toFixed(2),
          priceSar: formatSar(reservation.unit.price),
        },
        client: {
          id: reservation.client.id,
          name: reservation.client.name,
          phone: reservation.client.phone,
        },
        agentName: reservation.createdBy.name,
      };
    });
  }

  /**
   * Retrieves active, non-expired reservations for contract creation and inspection.
   * Scoped by tenant and role.
   */
  public static async listActiveReservations(
    prisma: PrismaClient,
    companyId: string,
    userId: string,
    userRole: UserRole
  ) {
    return this.listReservations(prisma, companyId, userId, userRole, "ACTIVE");
  }

  /**
   * Retrieves reservations with tenant isolation, role scoping, and optional status filtering.
   */
  public static async listReservations(
    prisma: PrismaClient,
    companyId: string,
    userId: string,
    userRole: UserRole,
    statusFilter?: string
  ) {
    await this.autoExpireReservations(prisma, companyId);

    const where: Prisma.ReservationWhereInput = {
      companyId,
    };

    if (userRole === UserRole.SALES_AGENT) {
      where.createdById = userId;
    }

    if (!statusFilter || statusFilter === "ACTIVE") {
      where.status = ReservationStatus.ACTIVE;
      where.expiresAt = { gt: new Date() };
      where.contracts = {
        none: {
          status: { in: ["DRAFT", "APPROVED", "COMPLETED"] },
        },
      };
    } else if (statusFilter === "EXPIRED") {
      where.status = ReservationStatus.EXPIRED;
    } else if (statusFilter === "CONVERTED") {
      where.status = ReservationStatus.CONVERTED;
    } // if "all", no status restriction applied

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        client: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return reservations.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      unitId: r.unitId,
      clientId: r.clientId,
      salesRepId: r.createdById,
      createdById: r.createdById,
      reservedAt: r.createdAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      status: r.status,
      unit: {
        id: r.unit.id,
        code: r.unit.code,
        unitNumber: r.unit.code,
        project: r.unit.project,
        projectName: r.unit.project,
        type: r.unit.type,
        price: r.unit.price.toFixed(2),
        priceSar: formatSar(r.unit.price),
        rawPriceNumber: Number(r.unit.price.toFixed(2)),
      },
      client: {
        id: r.client.id,
        name: r.client.name,
        phone: r.client.phone,
      },
      agentName: r.createdBy.name,
    }));
  }

  /**
   * Cancels an active reservation and safely returns the unit to AVAILABLE.
   * Mandated transition: RESERVED -> AVAILABLE
   */
  public static async cancelReservation(
    prisma: PrismaClient,
    companyId: string,
    reservationId: string,
    userId: string,
    userRole: UserRole
  ) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, companyId },
        include: { unit: true },
      });

      if (!reservation) {
        throw new NotFoundError("الحجز غير موجود أو لا ينتمي لشركتك");
      }

      // Sales agent can only cancel their own reservations
      if (userRole === UserRole.SALES_AGENT && reservation.createdById !== userId) {
        throw new ForbiddenError("لا يحق لك إلغاء حجز تابع لمندوب آخر");
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new ValidationError("لا يمكن إلغاء حجز غير نشط");
      }

      // 1. Transition reservation to EXPIRED (cancelled before expiration)
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.EXPIRED },
      });

      // 2. Safely return unit to AVAILABLE if still RESERVED
      await tx.unit.updateMany({
        where: {
          id: reservation.unitId,
          companyId,
          status: UnitStatus.RESERVED,
        },
        data: { status: UnitStatus.AVAILABLE },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "RESERVATION_CANCELLED",
          entityType: "Reservation",
          entityId: reservationId,
          details: JSON.stringify({
            unitId: reservation.unitId,
            unitCode: reservation.unit.code,
            reason: "Cancelled by user",
          }),
        },
      });

      return updated;
    });
  }
}
