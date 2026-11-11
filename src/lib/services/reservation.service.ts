import { PrismaClient, UnitStatus, ReservationStatus } from "@prisma/client";
import { addHours } from "date-fns";

export interface CreateReservationInput {
  companyId: string;
  unitId: string;
  clientId: string;
  createdById: string;
}

export class ReservationService {
  /**
   * Sweeps expired reservations and sets their units back to AVAILABLE automatically.
   */
  public static async autoExpireReservations(prisma: PrismaClient, companyId?: string) {
    const now = new Date();
    const expired = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lte: now },
        ...(companyId ? { companyId } : {}),
      },
      include: { unit: true },
    });

    for (const res of expired) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: res.id },
          data: { status: ReservationStatus.EXPIRED },
        });

        if (res.unit.status === UnitStatus.RESERVED) {
          await tx.unit.update({
            where: { id: res.unitId },
            data: { status: UnitStatus.AVAILABLE },
          });

          await tx.auditLog.create({
            data: {
              companyId: res.companyId,
              action: "RESERVATION_EXPIRED",
              entityType: "Reservation",
              entityId: res.id,
              details: JSON.stringify({ unitId: res.unitId, reason: "72 hours elapsed" }),
            },
          });
        }
      });
    }
  }

  /**
   * Concurrency-safe reservation creation.
   * Uses an atomic conditional update inside a transaction to guarantee that only ONE
   * concurrent agent succeeds, while the other receives a clear failure response.
   */
  public static async createReservation(prisma: PrismaClient, input: CreateReservationInput) {
    // Sweep any expired reservations first
    await this.autoExpireReservations(prisma, input.companyId);

    return await prisma.$transaction(async (tx) => {
      // Atomic conditional update on unit status
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
        throw new Error("عذراً، الوحدة غير متاحة للحجز حالياً أو تم حجزها من قبل مندوب آخر.");
      }

      // Check client ownership or tenant
      const client = await tx.client.findFirst({
        where: {
          id: input.clientId,
          companyId: input.companyId,
        },
      });

      if (!client) {
        throw new Error("العميل غير موجود أو لا ينتمي لشركتك");
      }

      // 72-hour validity
      const expiresAt = addHours(new Date(), 72);

      const reservation = await tx.reservation.create({
        data: {
          companyId: input.companyId,
          unitId: input.unitId,
          clientId: input.clientId,
          createdById: input.createdById,
          expiresAt,
          status: ReservationStatus.ACTIVE,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById,
          action: "UNIT_RESERVED",
          entityType: "Reservation",
          entityId: reservation.id,
          details: JSON.stringify({ unitId: input.unitId, clientId: input.clientId, expiresAt }),
        },
      });

      return reservation;
    });
  }
}
