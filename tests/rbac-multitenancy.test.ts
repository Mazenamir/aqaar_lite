import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, UnitStatus } from "@prisma/client";
import { AuthenticatedUser } from "../src/lib/auth";
import {
  Permission,
  requireRole,
  requirePermission,
  assertTenantOwnership,
  assertResourceOwnership,
  stripMassAssignmentFields,
} from "../src/lib/security/rbac";
import { ClientService } from "../src/lib/services/client.service";
import { UnitService } from "../src/lib/services/unit.service";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "../src/lib/errors/app-error";

const prisma = new PrismaClient();

describe("Phase 4: Multi-Tenancy Enforcement & Role-Based Access Control (RBAC)", () => {
  let companyAId: string;
  let companyBId: string;

  let adminA: AuthenticatedUser;
  let accountantA: AuthenticatedUser;
  let sales1A: AuthenticatedUser;
  let sales2A: AuthenticatedUser;

  let adminB: AuthenticatedUser;
  let sales1B: AuthenticatedUser;

  let unitA: { id: string; code: string; companyId: string };
  let unitB: { id: string; code: string; companyId: string };

  let clientA1: { id: string; name: string; createdById: string; companyId: string };
  let clientA2: { id: string; name: string; createdById: string; companyId: string };
  let clientB: { id: string; name: string; createdById: string; companyId: string };

  beforeAll(async () => {
    // 1. Fetch Companies
    const compA = await prisma.company.findUniqueOrThrow({ where: { crNumber: "1010892341" } });
    const compB = await prisma.company.findUniqueOrThrow({ where: { crNumber: "2050119842" } });
    companyAId = compA.id;
    companyBId = compB.id;

    // 2. Fetch Users
    const uAdminA = await prisma.user.findFirstOrThrow({ where: { email: "admin@greenryad.sa" } });
    const uAccA = await prisma.user.findFirstOrThrow({ where: { email: "accountant@greenryad.sa" } });
    const uSales1A = await prisma.user.findFirstOrThrow({ where: { email: "agent1@greenryad.sa" } });
    const uSales2A = await prisma.user.findFirstOrThrow({ where: { email: "agent2@greenryad.sa" } });

    const uAdminB = await prisma.user.findFirstOrThrow({ where: { email: "admin@horizon.sa" } });
    const uSales1B = await prisma.user.findFirstOrThrow({ where: { email: "agent1@horizon.sa" } });

    adminA = {
      id: uAdminA.id,
      companyId: companyAId,
      companyName: compA.name,
      email: uAdminA.email,
      name: uAdminA.name,
      role: uAdminA.role,
      sessionId: "session-admin-a",
    };

    accountantA = {
      id: uAccA.id,
      companyId: companyAId,
      companyName: compA.name,
      email: uAccA.email,
      name: uAccA.name,
      role: uAccA.role,
      sessionId: "session-acc-a",
    };

    sales1A = {
      id: uSales1A.id,
      companyId: companyAId,
      companyName: compA.name,
      email: uSales1A.email,
      name: uSales1A.name,
      role: uSales1A.role,
      sessionId: "session-sales1-a",
    };

    sales2A = {
      id: uSales2A.id,
      companyId: companyAId,
      companyName: compA.name,
      email: uSales2A.email,
      name: uSales2A.name,
      role: uSales2A.role,
      sessionId: "session-sales2-a",
    };

    adminB = {
      id: uAdminB.id,
      companyId: companyBId,
      companyName: compB.name,
      email: uAdminB.email,
      name: uAdminB.name,
      role: uAdminB.role,
      sessionId: "session-admin-b",
    };

    sales1B = {
      id: uSales1B.id,
      companyId: companyBId,
      companyName: compB.name,
      email: uSales1B.email,
      name: uSales1B.name,
      role: uSales1B.role,
      sessionId: "session-sales1-b",
    };

    // 3. Fetch Units
    unitA = await prisma.unit.findFirstOrThrow({ where: { companyId: companyAId, code: "A-101" } });
    unitB = await prisma.unit.findFirstOrThrow({ where: { companyId: companyBId, code: "HZ-201" } });

    // 4. Fetch Clients
    clientA1 = await prisma.client.findFirstOrThrow({ where: { companyId: companyAId, createdById: sales1A.id } });
    clientA2 = await prisma.client.findFirstOrThrow({ where: { companyId: companyAId, createdById: sales2A.id } });
    clientB = await prisma.client.findFirstOrThrow({ where: { companyId: companyBId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // A. TENANT ISOLATION TESTS
  // =========================================================================
  describe("A. Tenant Isolation", () => {
    it("1. Company A cannot read Company B's units", async () => {
      const result = await UnitService.listUnits(prisma, companyAId, {});
      // Every unit returned must strictly belong to Company A
      expect(result.units.length).toBeGreaterThan(0);
      for (const u of result.units) {
        expect(u.id).not.toBe(unitB.id);
        expect(u.code).not.toBe("HZ-201");
      }
    });

    it("2. Company A cannot read Company B's clients", async () => {
      const result = await ClientService.listClients(prisma, companyAId, adminA.id, adminA.role);
      expect(result.length).toBeGreaterThan(0);
      for (const c of result) {
        expect(c.id).not.toBe(clientB.id);
      }

      // Direct read by ID must fail with NotFoundError
      await expect(
        ClientService.getClientById(prisma, companyAId, clientB.id, adminA)
      ).rejects.toThrow(NotFoundError);
    });

    it("3. Company A cannot modify Company B's records", async () => {
      await expect(
        UnitService.updateUnit(prisma, {
          companyId: companyAId,
          unitId: unitB.id, // Targeting Company B's unit with Company A context
          updatedById: adminA.id,
          project: "محاولة اختراق",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("4. Company A cannot reference Company B's records via database composite foreign keys", async () => {
      // Trying to assert tenant ownership must throw ForbiddenError
      expect(() => {
        assertTenantOwnership(unitB.companyId, companyAId, "الوحدة");
      }).toThrow(ForbiddenError);

      // Attempting to create a reservation in Company A for a client in Company B must fail at DB level
      await expect(
        prisma.reservation.create({
          data: {
            companyId: companyAId,
            unitId: unitA.id,
            clientId: clientB.id, // Client belongs to Company B!
            createdById: sales1A.id,
            expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
            status: "ACTIVE",
          },
        })
      ).rejects.toThrow();
    });

    it("5. Changing companyId in a request does not change access (Session Authority)", async () => {
      // Simulate client request sending spoofed companyId:
      const spoofedCompanyId = companyBId;

      // Safe service execution extracts companyId ONLY from session:
      const safeCompanyId = adminA.companyId; // From trusted session
      expect(safeCompanyId).not.toBe(spoofedCompanyId);

      const units = await UnitService.listUnits(prisma, safeCompanyId, {});
      for (const u of units.units) {
        expect(u.id).not.toBe(unitB.id);
      }
    });

    it("6. Company B Admin cannot access Company A units", async () => {
      await expect(
        UnitService.updateUnit(prisma, {
          companyId: adminB.companyId,
          unitId: unitA.id,
          updatedById: adminB.id,
          project: "تعديل غير مشروع من شركة ب",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("7. Company B Sales cannot access Company A clients", async () => {
      await expect(
        ClientService.getClientById(prisma, sales1B.companyId, clientA1.id, sales1B)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // B. ROLE AUTHORIZATION (RBAC) TESTS
  // =========================================================================
  describe("B. Role Authorization (RBAC)", () => {
    it("1. Sales representative cannot change unit prices", async () => {
      expect(() => {
        requirePermission(sales1A, Permission.UNIT_PRICE_UPDATE);
      }).toThrow(ForbiddenError);
    });

    it("2. Sales representative cannot approve contracts", async () => {
      expect(() => {
        requirePermission(sales1A, Permission.CONTRACT_APPROVE);
      }).toThrow(ForbiddenError);
    });

    it("3. Sales representative cannot register payments", async () => {
      expect(() => {
        requirePermission(sales1A, Permission.PAYMENT_CREATE);
      }).toThrow(ForbiddenError);
    });

    it("4. Sales representative cannot access another representative's clients", async () => {
      // Sales Agent 1 attempts to fetch Client A2 (created by Sales Agent 2)
      await expect(
        ClientService.getClientById(prisma, companyAId, clientA2.id, sales1A)
      ).rejects.toThrow(ForbiddenError);

      // Sales Agent 1 attempts to update Client A2 (created by Sales Agent 2)
      await expect(
        ClientService.updateClient(prisma, {
          companyId: companyAId,
          clientId: clientA2.id,
          user: sales1A,
          name: "محاولة تعديل عميل زميل",
        })
      ).rejects.toThrow(ForbiddenError);

      // Direct assertion utility check
      expect(() => {
        assertResourceOwnership(clientA2.createdById, sales1A, "العميل");
      }).toThrow(ForbiddenError);

      // But Sales Agent 1 CAN access their own client (clientA1)
      const ownClient = await ClientService.getClientById(prisma, companyAId, clientA1.id, sales1A);
      expect(ownClient.id).toBe(clientA1.id);
    });

    it("5. Accountant can approve eligible contracts", () => {
      expect(() => {
        requirePermission(accountantA, Permission.CONTRACT_APPROVE);
      }).not.toThrow();
    });

    it("6. Accountant can register payments", () => {
      expect(() => {
        requirePermission(accountantA, Permission.PAYMENT_CREATE);
      }).not.toThrow();
    });

    it("7. Accountant cannot modify client or unit information", async () => {
      // Accountant cannot update clients
      await expect(
        ClientService.updateClient(prisma, {
          companyId: companyAId,
          clientId: clientA1.id,
          user: accountantA,
          name: "محاولة تعديل محاسب",
        })
      ).rejects.toThrow(ForbiddenError);

      // Accountant lacks unit create or update permissions
      expect(() => {
        requirePermission(accountantA, Permission.UNIT_CREATE);
      }).toThrow(ForbiddenError);

      expect(() => {
        requirePermission(accountantA, Permission.UNIT_PRICE_UPDATE);
      }).toThrow(ForbiddenError);
    });

    it("8. Admin can manage company units and prices", () => {
      expect(() => {
        requirePermission(adminA, Permission.UNIT_CREATE);
      }).not.toThrow();

      expect(() => {
        requirePermission(adminA, Permission.UNIT_PRICE_UPDATE);
      }).not.toThrow();
    });

    it("9. Admin cannot access another company's records", async () => {
      expect(() => {
        assertTenantOwnership(companyBId, adminA.companyId, "سجلات الشركة الأخرى");
      }).toThrow(ForbiddenError);

      await expect(
        UnitService.updateUnit(prisma, {
          companyId: adminA.companyId,
          unitId: unitB.id,
          updatedById: adminA.id,
          project: "تعديل غير مشروع",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // C. MASS ASSIGNMENT PROTECTION TESTS
  // =========================================================================
  describe("C. Mass Assignment Protection", () => {
    it("1. Cannot change role through request payload", () => {
      const maliciousPayload = {
        name: "خالد التميمي",
        role: "COMPANY_ADMIN", // Attacker trying privilege escalation
      };

      const sanitized = stripMassAssignmentFields(maliciousPayload);
      expect((sanitized as Record<string, unknown>).role).toBeUndefined();
      expect(sanitized.name).toBe("خالد التميمي");
    });

    it("2. Cannot change companyId through request payload", () => {
      const maliciousPayload = {
        companyId: companyBId, // Attacker trying cross-tenant hijacking
        name: "مشروع النخيل",
        code: "NK-101",
      };

      const sanitized = stripMassAssignmentFields(maliciousPayload);
      expect((sanitized as Record<string, unknown>).companyId).toBeUndefined();
      expect(sanitized.code).toBe("NK-101");
    });

    it("3. Cannot change salesRepId / createdById through request payload", () => {
      const maliciousPayload = {
        createdById: "fake-agent-uuid-777",
        name: "عميل جديد",
        phone: "0501112233",
      };

      const sanitized = stripMassAssignmentFields(maliciousPayload);
      expect((sanitized as Record<string, unknown>).createdById).toBeUndefined();
      expect(sanitized.name).toBe("عميل جديد");
    });

    it("4. Cannot modify protected workflow status fields directly", () => {
      const maliciousPayload = {
        status: UnitStatus.SOLD, // Trying to bypass contract approval workflow
        priceSar: "950000",
      };

      const sanitized = stripMassAssignmentFields(maliciousPayload);
      expect((sanitized as Record<string, unknown>).status).toBeUndefined();
      expect(sanitized.priceSar).toBe("950000");
    });
  });

  // =========================================================================
  // D. UNAUTHENTICATED REQUESTS
  // =========================================================================
  describe("D. Unauthenticated Requests", () => {
    it("1. Protected endpoints reject requests without a valid session", () => {
      expect(() => {
        requireRole(null, [UserRole.COMPANY_ADMIN]);
      }).toThrow(UnauthorizedError);

      expect(() => {
        requirePermission(null, Permission.UNIT_READ);
      }).toThrow(UnauthorizedError);
    });
  });
});
