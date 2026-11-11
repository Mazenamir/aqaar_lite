import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UnitStatus, ReservationStatus } from "@prisma/client";
import { AuthenticatedUser } from "../src/lib/auth";
import { UnitService } from "../src/lib/services/unit.service";
import { ClientService } from "../src/lib/services/client.service";
import { ReservationService } from "../src/lib/services/reservation.service";
import { ConflictError } from "../src/lib/errors/app-error";

const prisma = new PrismaClient();

describe("Phase 5 Concurrency Tests: Genuine PostgreSQL Race Condition Protection", () => {
  let compAId: string;
  let adminA: AuthenticatedUser;
  let sales1A: AuthenticatedUser;
  let sales2A: AuthenticatedUser;

  const cleanupUnitIds: string[] = [];
  const cleanupClientIds: string[] = [];
  const cleanupReservationIds: string[] = [];

  beforeAll(async () => {
    const compA = await prisma.company.findUniqueOrThrow({ where: { crNumber: "1010892341" } });
    compAId = compA.id;

    const uAdminA = await prisma.user.findFirstOrThrow({ where: { email: "admin@greenryad.sa" } });
    const uSales1A = await prisma.user.findFirstOrThrow({ where: { email: "agent1@greenryad.sa" } });
    const uSales2A = await prisma.user.findFirstOrThrow({ where: { email: "agent2@greenryad.sa" } });

    adminA = {
      id: uAdminA.id,
      companyId: compAId,
      companyName: compA.name,
      email: uAdminA.email,
      name: uAdminA.name,
      role: uAdminA.role,
      sessionId: "session-admin-a",
    };

    sales1A = {
      id: uSales1A.id,
      companyId: compAId,
      companyName: compA.name,
      email: uSales1A.email,
      name: uSales1A.name,
      role: uSales1A.role,
      sessionId: "session-sales1-a",
    };

    sales2A = {
      id: uSales2A.id,
      companyId: compAId,
      companyName: compA.name,
      email: uSales2A.email,
      name: uSales2A.name,
      role: uSales2A.role,
      sessionId: "session-sales2-a",
    };
  });

  afterAll(async () => {
    if (cleanupReservationIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: cleanupReservationIds } } });
    }
    if (cleanupClientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: cleanupClientIds } } });
    }
    if (cleanupUnitIds.length > 0) {
      await prisma.unit.deleteMany({ where: { id: { in: cleanupUnitIds } } });
    }
    await prisma.$disconnect();
  });

  it("simulates two genuinely concurrent reservation requests for the exact same unit in PostgreSQL", async () => {
    // 1. Create a genuine unit in PostgreSQL in AVAILABLE status
    const targetUnit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج التنافسية الذرية",
      unitNumber: `CONCUR-2-${Date.now()}`,
      type: "شقة ديلوكس",
      floor: "9",
      area: 175,
      rooms: 4,
      price: "1400000.00",
    });
    cleanupUnitIds.push(targetUnit.id);

    // 2. Create two distinct clients owned by Sales 1 and Sales 2
    const client1 = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: `عميل مندوب 1 - ${Date.now()}`,
      phone: "0501112233",
    });
    cleanupClientIds.push(client1.id);

    const client2 = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales2A.id,
      name: `عميل مندوب 2 - ${Date.now()}`,
      phone: "0504445566",
    });
    cleanupClientIds.push(client2.id);

    // Verify target unit is AVAILABLE before concurrent attempts
    expect(targetUnit.status).toBe(UnitStatus.AVAILABLE);

    // 3. Fire TWO GENUINELY CONCURRENT reservation requests using Promise.allSettled
    // Both attempt to reserve the exact same unit simultaneously
    const promise1 = ReservationService.createReservation(prisma, {
      companyId: compAId,
      unitId: targetUnit.id,
      clientId: client1.id,
      createdById: sales1A.id,
      userRole: sales1A.role,
    });

    const promise2 = ReservationService.createReservation(prisma, {
      companyId: compAId,
      unitId: targetUnit.id,
      clientId: client2.id,
      createdById: sales2A.id,
      userRole: sales2A.role,
    });

    const results = await Promise.allSettled([promise1, promise2]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );

    // Mandatory requirement 1: Exactly ONE successful reservation
    expect(fulfilled).toHaveLength(1);

    // Mandatory requirement 2: Exactly ONE rejected reservation
    expect(rejected).toHaveLength(1);

    const winningResult = fulfilled[0];
    const losingResult = rejected[0];
    expect(winningResult).toBeDefined();
    expect(losingResult).toBeDefined();

    if (!winningResult || !losingResult) {
      throw new Error("Concurrency expectation failed: fulfilled or rejected is missing");
    }

    // Register winning reservation for cleanup
    cleanupReservationIds.push(winningResult.value.id);

    // Mandatory requirement 3: Clear conflict response for losing request
    const rejectionReason = losingResult.reason;
    expect(rejectionReason).toBeInstanceOf(ConflictError);
    expect(rejectionReason.message).toContain("الوحدة غير متاحة للحجز حالياً أو تم حجزها من قبل مندوب آخر");

    // Mandatory requirement 4: Exactly ONE active reservation in the database
    const dbReservations = await prisma.reservation.findMany({
      where: {
        unitId: targetUnit.id,
      },
    });
    expect(dbReservations).toHaveLength(1);
    expect(dbReservations[0]?.status).toBe(ReservationStatus.ACTIVE);
    expect(dbReservations[0]?.id).toBe(winningResult.value.id);

    // Mandatory requirement 5: Unit status remains RESERVED
    const dbUnit = await prisma.unit.findUniqueOrThrow({
      where: { id: targetUnit.id },
    });
    expect(dbUnit.status).toBe(UnitStatus.RESERVED);

    // Mandatory requirement 6: No duplicate or inconsistent records
    const allReservationsForUnit = await prisma.reservation.count({
      where: { unitId: targetUnit.id },
    });
    expect(allReservationsForUnit).toBe(1);
  });

  it("handles high concurrency (5 simultaneous requests for 1 available unit) correctly", async () => {
    // 1. Create a unit
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الضغط العالي",
      unitNumber: `CONCUR-5-${Date.now()}`,
      type: "بنتهاوس",
      floor: "15",
      area: 280,
      rooms: 6,
      price: "3500000.00",
    });
    cleanupUnitIds.push(unit.id);

    // 2. Create 5 clients
    const clients = await Promise.all(
      Array.from({ length: 5 }).map((_, idx) =>
        ClientService.createClient(prisma, {
          companyId: compAId,
          createdById: idx % 2 === 0 ? sales1A.id : sales2A.id,
          name: `عميل سباق ${idx + 1} - ${Date.now()}`,
          phone: `055000000${idx}`,
        })
      )
    );
    for (const c of clients) cleanupClientIds.push(c.id);

    // 3. Fire 5 simultaneous reservation requests
    const promises = clients.map((c, idx) => {
      const agent = idx % 2 === 0 ? sales1A : sales2A;
      return ReservationService.createReservation(prisma, {
        companyId: compAId,
        unitId: unit.id,
        clientId: c.id,
        createdById: agent.id,
        userRole: agent.role,
      });
    });

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 winner
    expect(fulfilled).toHaveLength(1);
    // Exactly 4 losers
    expect(rejected).toHaveLength(4);

    if (fulfilled[0] && fulfilled[0].status === "fulfilled") {
      cleanupReservationIds.push(fulfilled[0].value.id);
    }

    // Every loser received ConflictError
    for (const rej of rejected) {
      if (rej.status === "rejected") {
        expect(rej.reason).toBeInstanceOf(ConflictError);
      }
    }

    // Exactly 1 reservation record exists in DB
    const count = await prisma.reservation.count({ where: { unitId: unit.id } });
    expect(count).toBe(1);

    // Unit status is RESERVED
    const refreshed = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshed.status).toBe(UnitStatus.RESERVED);
  });
});
