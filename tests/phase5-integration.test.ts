import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UnitStatus, ReservationStatus, UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../src/lib/auth";
import { UnitService } from "../src/lib/services/unit.service";
import { ClientService } from "../src/lib/services/client.service";
import { ReservationService } from "../src/lib/services/reservation.service";
import { requireRole, requirePermission, Permission } from "../src/lib/security/rbac";
import { ForbiddenError, ValidationError, NotFoundError } from "../src/lib/errors/app-error";

const prisma = new PrismaClient();

describe("Phase 5 Integration Tests: Units, Clients, Reservations & Policies", () => {
  let compAId: string;
  let compBId: string;

  let adminA: AuthenticatedUser;
  let sales1A: AuthenticatedUser;
  let sales2A: AuthenticatedUser;
  let salesB: AuthenticatedUser;

  // Track created entities for cleanup
  const createdUnitIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdReservationIds: string[] = [];

  beforeAll(async () => {
    const compA = await prisma.company.findUniqueOrThrow({ where: { crNumber: "1010892341" } });
    const compB = await prisma.company.findUniqueOrThrow({ where: { crNumber: "2050119842" } });
    compAId = compA.id;
    compBId = compB.id;

    const uAdminA = await prisma.user.findFirstOrThrow({ where: { email: "admin@greenryad.sa" } });
    const uSales1A = await prisma.user.findFirstOrThrow({ where: { email: "agent1@greenryad.sa" } });
    const uSales2A = await prisma.user.findFirstOrThrow({ where: { email: "agent2@greenryad.sa" } });
    const uSalesB = await prisma.user.findFirstOrThrow({ where: { email: "agent1@horizon.sa" } });

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

    salesB = {
      id: uSalesB.id,
      companyId: compBId,
      companyName: compB.name,
      email: uSalesB.email,
      name: uSalesB.name,
      role: uSalesB.role,
      sessionId: "session-sales-b",
    };
  });

  afterAll(async () => {
    // Clean up created test entities
    if (createdReservationIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: createdReservationIds } } });
    }
    if (createdClientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    }
    if (createdUnitIds.length > 0) {
      await prisma.unit.deleteMany({ where: { id: { in: createdUnitIds } } });
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. ADMIN CREATES A UNIT
  // =========================================================================
  it("1. Admin creates a unit successfully with initial AVAILABLE status and audit log", async () => {
    const timestamp = Date.now();
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "مشروع أبراج السحاب",
      unitNumber: `TEST-UNIT-${timestamp}`,
      type: "شقة ديلوكس",
      floor: "7",
      area: 165,
      rooms: 4,
      price: "1350000.00",
    });

    createdUnitIds.push(unit.id);

    expect(unit.id).toBeDefined();
    expect(unit.status).toBe(UnitStatus.AVAILABLE);
    expect(unit.unitNumber).toBe(`TEST-UNIT-${timestamp}`);
    expect(unit.projectName).toBe("مشروع أبراج السحاب");
    expect(unit.price).toBe("1350000.00");

    // Verify Audit Log created
    const log = await prisma.auditLog.findFirst({
      where: {
        entityType: "Unit",
        entityId: unit.id,
        action: "UNIT_CREATED",
      },
    });
    expect(log).not.toBeNull();
  });

  // =========================================================================
  // 2. SALES CANNOT CREATE A UNIT
  // =========================================================================
  it("2. Sales representative cannot create a unit (rejected by RBAC authorization)", () => {
    // RBAC permission check
    expect(() => {
      requirePermission(sales1A, Permission.UNIT_CREATE);
    }).toThrow(ForbiddenError);

    // Role check
    expect(() => {
      requireRole(sales1A, [UserRole.COMPANY_ADMIN]);
    }).toThrow(ForbiddenError);
  });

  // =========================================================================
  // 3. ADMIN CANNOT CHANGE PRICE OF A RESERVED UNIT
  // =========================================================================
  it("3. Admin cannot change the price of a RESERVED unit", async () => {
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الفرسان",
      unitNumber: `RES-PRICE-${Date.now()}`,
      type: "شقة",
      floor: "2",
      area: 120,
      rooms: 3,
      price: "900000.00",
    });
    createdUnitIds.push(unit.id);

    // Transition to RESERVED
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED },
    });

    // Attempting to modify price on RESERVED unit must be rejected
    await expect(
      UnitService.updateUnit(prisma, {
        companyId: compAId,
        unitId: unit.id,
        updatedById: adminA.id,
        price: "950000.00",
      })
    ).rejects.toThrow(ValidationError);
  });

  // =========================================================================
  // 4. ADMIN CANNOT CHANGE PRICE OF A SOLD UNIT
  // =========================================================================
  it("4. Admin cannot change the price of a SOLD unit", async () => {
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الفرسان",
      unitNumber: `SOLD-PRICE-${Date.now()}`,
      type: "شقة",
      floor: "3",
      area: 130,
      rooms: 3,
      price: "950000.00",
    });
    createdUnitIds.push(unit.id);

    // Transition to SOLD
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.SOLD },
    });

    // Attempting to modify price on SOLD unit must be rejected
    await expect(
      UnitService.updateUnit(prisma, {
        companyId: compAId,
        unitId: unit.id,
        updatedById: adminA.id,
        price: "1050000.00",
      })
    ).rejects.toThrow(ValidationError);
  });

  // =========================================================================
  // 5. SALES CREATES A CLIENT
  // =========================================================================
  it("5. Sales user creates a client with automatic ownership and company scoping", async () => {
    const client = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: "منصور بن عبدالعزيز العبدلي",
      phone: "0509988776",
      notes: "يبحث عن شقة 4 غرف في برج السحاب",
    });
    createdClientIds.push(client.id);

    expect(client.id).toBeDefined();
    expect(client.companyId).toBe(compAId);
    expect(client.createdById).toBe(sales1A.id);
    expect(client.salesRepId).toBe(sales1A.id);
    expect(client.name).toBe("منصور بن عبدالعزيز العبدلي");
    expect(client.notes).toBe("يبحث عن شقة 4 غرف في برج السحاب");
  });

  // =========================================================================
  // 6. SALES SEES ONLY OWNED CLIENTS
  // =========================================================================
  it("6. Sales users see ONLY their own clients when listing", async () => {
    // Create client for Sales 1
    const c1 = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: `عميل ساري 1 - ${Date.now()}`,
      phone: "0501111111",
    });
    createdClientIds.push(c1.id);

    // Create client for Sales 2
    const c2 = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales2A.id,
      name: `عميل ساري 2 - ${Date.now()}`,
      phone: "0502222222",
    });
    createdClientIds.push(c2.id);

    // Sales 1 lists clients
    const sales1Clients = await ClientService.listClients(prisma, compAId, sales1A.id, sales1A.role);
    const sales1ClientIds = sales1Clients.map((c) => c.id);

    expect(sales1ClientIds).toContain(c1.id);
    expect(sales1ClientIds).not.toContain(c2.id);

    // Sales 2 lists clients
    const sales2Clients = await ClientService.listClients(prisma, compAId, sales2A.id, sales2A.role);
    const sales2ClientIds = sales2Clients.map((c) => c.id);

    expect(sales2ClientIds).toContain(c2.id);
    expect(sales2ClientIds).not.toContain(c1.id);
  });

  // =========================================================================
  // 7. SALES CANNOT ACCESS ANOTHER REPRESENTATIVE'S CLIENTS
  // =========================================================================
  it("7. Sales cannot access another representative's clients (403 Forbidden)", async () => {
    const c2 = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales2A.id,
      name: `عميل خاص بسارة - ${Date.now()}`,
      phone: "0503333333",
    });
    createdClientIds.push(c2.id);

    // Sales 1 attempts to fetch client belonging to Sales 2
    await expect(
      ClientService.getClientById(prisma, compAId, c2.id, sales1A)
    ).rejects.toThrow(ForbiddenError);
  });

  // =========================================================================
  // 8. SALES RESERVES AN AVAILABLE UNIT
  // =========================================================================
  it("8. Sales reserves an available unit: unit status becomes RESERVED and 72-hour duration applied", async () => {
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الفردوس",
      unitNumber: `RES-OK-${Date.now()}`,
      type: "شقة",
      floor: "5",
      area: 140,
      rooms: 3,
      price: "1100000.00",
    });
    createdUnitIds.push(unit.id);

    const client = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: "سعود بن فهد السبيعي",
      phone: "0504444444",
    });
    createdClientIds.push(client.id);

    // Execute reservation
    const reservation = await ReservationService.createReservation(prisma, {
      companyId: compAId,
      unitId: unit.id,
      clientId: client.id,
      createdById: sales1A.id,
      userRole: sales1A.role,
    });
    createdReservationIds.push(reservation.id);

    expect(reservation.id).toBeDefined();
    expect(reservation.status).toBe(ReservationStatus.ACTIVE);

    // Unit status in DB must now be RESERVED
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.RESERVED);

    // Duration must be exactly 72 hours
    const reservedTime = new Date(reservation.reservedAt).getTime();
    const expiryTime = new Date(reservation.expiresAt).getTime();
    expect(expiryTime - reservedTime).toBe(72 * 3600 * 1000);
  });

  // =========================================================================
  // 9. EXPIRED RESERVATIONS RELEASE THEIR UNITS
  // =========================================================================
  it("9. Expired reservations release their units back to AVAILABLE automatically", async () => {
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الشروق",
      unitNumber: `EXP-REL-${Date.now()}`,
      type: "شقة",
      floor: "2",
      area: 130,
      rooms: 3,
      price: "850000.00",
    });
    createdUnitIds.push(unit.id);

    const client = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: "خالد المحمدي",
      phone: "0505555555",
    });
    createdClientIds.push(client.id);

    // Manually create an expired reservation (expiresAt 2 hours in the past)
    const expiredTime = new Date(Date.now() - 2 * 3600 * 1000);
    const reservation = await prisma.reservation.create({
      data: {
        companyId: compAId,
        unitId: unit.id,
        clientId: client.id,
        createdById: sales1A.id,
        expiresAt: expiredTime,
        status: ReservationStatus.ACTIVE,
      },
    });
    createdReservationIds.push(reservation.id);

    // Mark unit RESERVED
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED },
    });

    // Run expiration sweep
    const count = await ReservationService.autoExpireReservations(prisma, compAId);
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify reservation is EXPIRED
    const refreshedRes = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(refreshedRes.status).toBe(ReservationStatus.EXPIRED);

    // Verify unit was returned to AVAILABLE
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.AVAILABLE);
  });

  // =========================================================================
  // 10. SOLD UNITS ARE NEVER RELEASED BY EXPIRATION
  // =========================================================================
  it("10. Sold units are NEVER released to AVAILABLE by expiration worker", async () => {
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج الشروق",
      unitNumber: `SOLD-NO-REL-${Date.now()}`,
      type: "شقة",
      floor: "6",
      area: 150,
      rooms: 4,
      price: "1200000.00",
    });
    createdUnitIds.push(unit.id);

    const client = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: "تركي بن طلال",
      phone: "0506666666",
    });
    createdClientIds.push(client.id);

    // Unit was sold
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.SOLD },
    });

    // Create an expired reservation linked to this unit
    const expiredTime = new Date(Date.now() - 5 * 3600 * 1000);
    const reservation = await prisma.reservation.create({
      data: {
        companyId: compAId,
        unitId: unit.id,
        clientId: client.id,
        createdById: sales1A.id,
        expiresAt: expiredTime,
        status: ReservationStatus.ACTIVE,
      },
    });
    createdReservationIds.push(reservation.id);

    // Run expiration sweep
    await ReservationService.autoExpireReservations(prisma, compAId);

    // Reservation becomes EXPIRED
    const refreshedRes = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(refreshedRes.status).toBe(ReservationStatus.EXPIRED);

    // CRITICAL: Unit status MUST REMAIN SOLD!
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.SOLD);
  });

  // =========================================================================
  // 11. CROSS-COMPANY RESOURCE ACCESS IS REJECTED
  // =========================================================================
  it("11. Cross-company resource access is strictly rejected", async () => {
    // Create unit in Company B
    const unitB = await UnitService.createUnit(prisma, {
      companyId: compBId,
      createdById: salesB.id,
      projectName: "أبراج الأفق ب",
      unitNumber: `HZ-ISO-${Date.now()}`,
      type: "مكتب",
      floor: "1",
      area: 90,
      rooms: 2,
      price: "600000.00",
    });
    createdUnitIds.push(unitB.id);

    // Company A attempts to view Company B's unit by ID
    await expect(
      UnitService.getUnitById(prisma, compAId, unitB.id)
    ).rejects.toThrow(NotFoundError);

    // Company A attempts to update Company B's unit
    await expect(
      UnitService.updateUnit(prisma, {
        companyId: compAId,
        unitId: unitB.id,
        updatedById: adminA.id,
        price: "700000.00",
      })
    ).rejects.toThrow(NotFoundError);
  });
});
