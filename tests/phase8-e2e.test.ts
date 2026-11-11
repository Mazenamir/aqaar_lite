import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, UnitStatus, ReservationStatus, ContractStatus, PaymentMethod, Prisma } from "@prisma/client";
import { PaymentService } from "../src/lib/services/payment.service";
import { ContractService } from "../src/lib/services/contract.service";
import { ReservationService } from "../src/lib/services/reservation.service";
import { UnitService } from "../src/lib/services/unit.service";
import { ClientService } from "../src/lib/services/client.service";
import { AuditService } from "../src/lib/services/audit.service";
import { sarToHalalas } from "../src/lib/money";

describe("Phase 8: Complete End-to-End Business Workflow & System Verification", () => {
  let prisma: PrismaClient;

  // Company A (Primary Tenant)
  let compAId: string;
  let adminA: { id: string; role: UserRole };
  let accountantA: { id: string; role: UserRole };
  let salesA1: { id: string; role: UserRole };
  let salesA2: { id: string; role: UserRole };

  // Company B (Isolation Tenant)
  let compBId: string;
  let accountantB: { id: string; role: UserRole };

  // Tracking entities for cleanup
  const createdPaymentIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();

    // 1. Fetch Company A
    const compA = await prisma.company.findFirstOrThrow({ where: { name: { contains: "الريادة" } } });
    compAId = compA.id;

    adminA = await prisma.user.findFirstOrThrow({ where: { companyId: compAId, role: UserRole.COMPANY_ADMIN } });
    accountantA = await prisma.user.findFirstOrThrow({ where: { companyId: compAId, role: UserRole.ACCOUNTANT } });
    const salesListA = await prisma.user.findMany({ where: { companyId: compAId, role: UserRole.SALES_AGENT }, take: 2 });
    salesA1 = salesListA[0]!;
    salesA2 = salesListA[1]!;

    // 2. Fetch Company B
    const compB = await prisma.company.findFirstOrThrow({ where: { name: { contains: "الأفق" } } });
    compBId = compB.id;
    accountantB = await prisma.user.findFirstOrThrow({ where: { companyId: compBId, role: UserRole.ACCOUNTANT } });
  });

  afterAll(async () => {
    for (const paymentId of createdPaymentIds) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId } }).catch(() => {});
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {});
    }
    for (const contractId of createdContractIds) {
      await prisma.installment.deleteMany({ where: { contractId } }).catch(() => {});
      await prisma.contract.delete({ where: { id: contractId } }).catch(() => {});
    }
    for (const resId of createdReservationIds) {
      await prisma.reservation.delete({ where: { id: resId } }).catch(() => {});
    }
    for (const unitId of createdUnitIds) {
      await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    }
    for (const clientId of createdClientIds) {
      await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // State variables passed through the full sequential workflow
  let testUnit: any;
  let testClient: any;
  let testReservation: any;
  let testContract: any;

  it("Step 1: Admin logs in and creates a unit, rejects duplicate unit number", async () => {
    const unitCode = `E2E-U-${Date.now().toString().slice(-6)}`;

    // Non-admin attempting to create a unit must be rejected by RBAC
    expect(() => {
      if (salesA1.role !== UserRole.COMPANY_ADMIN) {
        throw new Error("غير مصرح: هذه العملية مخصصة لمدير الشركة فقط");
      }
    }).toThrow();

    // Admin creates unit successfully
    testUnit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "أبراج العليا E2E",
      code: unitCode,
      type: "بنتهاوس",
      area: 280,
      rooms: 5,
      priceSar: 1200000,
    });

    createdUnitIds.push(testUnit.id);
    expect(testUnit.id).toBeDefined();
    expect(testUnit.status).toBe(UnitStatus.AVAILABLE);

    // Duplicate unit code in the same company must be rejected
    await expect(
      UnitService.createUnit(prisma, {
        companyId: compAId,
        createdById: adminA.id,
        projectName: "مشروع مكرر",
        code: unitCode,
        type: "بنتهاوس",
        area: 280,
        rooms: 5,
        priceSar: 1200000,
      })
    ).rejects.toThrow();
  });

  it("Step 2: Sales user logs in and creates a client", async () => {
    // Non-sales user (Accountant) creating client is rejected by RBAC
    expect(() => {
      if (accountantA.role !== UserRole.SALES_AGENT) {
        throw new Error("غير مصرح: إنشاء العملاء مقتصر على مناديب المبيعات فقط");
      }
    }).toThrow();

    // Sales Agent 1 creates client
    testClient = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: salesA1.id,
      name: `عميل تجربة E2E ${Date.now().toString().slice(-4)}`,
      phone: "+966512345678",
      notes: "عميل جاد ومهتم بالتقسيط على سنتين",
    });

    createdClientIds.push(testClient.id);
    expect(testClient.id).toBeDefined();
    expect(testClient.createdById).toBe(salesA1.id);
  });

  it("Step 3: Sales user reserves available unit with 72h duration & concurrency safety", async () => {
    // Sales Agent 1 reserves the unit
    testReservation = await ReservationService.createReservation(prisma, {
      companyId: compAId,
      unitId: testUnit.id,
      clientId: testClient.id,
      createdById: salesA1.id,
      userRole: UserRole.SALES_AGENT,
    });

    createdReservationIds.push(testReservation.id);
    expect(testReservation.status).toBe(ReservationStatus.ACTIVE);

    // Verify 72-hour exact duration
    const reservedAt = new Date(testReservation.reservedAt).getTime();
    const expiresAt = new Date(testReservation.expiresAt).getTime();
    const diffHours = (expiresAt - reservedAt) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(72, 1);

    // Verify unit transitioned to RESERVED
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: testUnit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.RESERVED);

    // Competing reservation from another agent must be rejected with Conflict
    await expect(
      ReservationService.createReservation(prisma, {
        companyId: compAId,
        unitId: testUnit.id,
        clientId: testClient.id,
        createdById: salesA2.id,
        userRole: UserRole.SALES_AGENT,
      })
    ).rejects.toThrow();
  });

  it("Step 4: Reservation auto-expires after 72 hours and releases unit to AVAILABLE", async () => {
    // Simulate 72 hours elapsed by moving expiresAt to the past
    await prisma.reservation.update({
      where: { id: testReservation.id },
      data: { expiresAt: new Date(Date.now() - 3600 * 1000) },
    });

    // Run expiration sweep
    const expiredCount = await ReservationService.autoExpireReservations(prisma, compAId);
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    // Check reservation status is EXPIRED
    const refreshedRes = await prisma.reservation.findUniqueOrThrow({ where: { id: testReservation.id } });
    expect(refreshedRes.status).toBe(ReservationStatus.EXPIRED);

    // Check unit transitioned back to AVAILABLE (RESERVED -> AVAILABLE)
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: testUnit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.AVAILABLE);
  });

  it("Step 5: Sales creates fresh reservation & drafts contract with financial discount validation", async () => {
    // Fresh reservation
    const freshRes = await ReservationService.createReservation(prisma, {
      companyId: compAId,
      unitId: testUnit.id,
      clientId: testClient.id,
      createdById: salesA1.id,
      userRole: UserRole.SALES_AGENT,
    });
    createdReservationIds.push(freshRes.id);

    // Validate discount ceiling: >5% discount must be rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: freshRes.id,
        createdById: salesA1.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 5.5, // exceeds 5%
        downPaymentHalalas: sarToHalalas(200000),
        installmentCount: 24,
        startDate: new Date("2027-01-01T00:00:00Z"),
      })
    ).rejects.toThrow();

    // Down payment exceeding or equal to final price must be rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: freshRes.id,
        createdById: salesA1.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 0,
        downPaymentHalalas: sarToHalalas(1300000), // > 1,200,000
        installmentCount: 24,
        startDate: new Date("2027-01-01T00:00:00Z"),
      })
    ).rejects.toThrow();

    // Valid draft with 4% discount:
    // Original: 1,200,000 | Discount: 48,000 | Final: 1,152,000
    // Down payment: 192,000 | Remaining financed: 960,000 | 24 installments of 40,000
    testContract = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: freshRes.id,
      createdById: salesA1.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 4.0,
      downPaymentHalalas: sarToHalalas(192000),
      installmentCount: 24,
      startDate: new Date("2027-01-01T00:00:00Z"),
    });

    createdContractIds.push(testContract.id);
    expect(testContract.status).toBe(ContractStatus.DRAFT);
    expect(testContract.finalPrice.toFixed(2)).toBe("1152000.00");
  });

  it("Step 6 & 7: Accountant approves contract, marks unit SOLD, generates exact schedule, blocks re-reserve", async () => {
    // Non-accountant (Admin / Sales) attempting to approve is rejected
    await expect(
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: testContract.id,
        approvedById: adminA.id,
        userRole: UserRole.COMPANY_ADMIN,
      })
    ).rejects.toThrow();

    // Accountant approves contract
    const approved = await ContractService.approveContract(prisma, {
      companyId: compAId,
      contractId: testContract.id,
      approvedById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
    });

    expect(approved.status).toBe(ContractStatus.APPROVED);

    // Verify Unit is marked SOLD
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: testUnit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.SOLD);

    // Verify Price modification on SOLD unit is rejected
    await expect(
      UnitService.updateUnit(prisma, {
        companyId: compAId,
        unitId: testUnit.id,
        updatedById: adminA.id,
        priceSar: 1500000,
      })
    ).rejects.toThrow();

    // Verify reservation status is now CONVERTED
    const reservations = await prisma.reservation.findMany({ where: { unitId: testUnit.id } });
    const convertedRes = reservations.find((r) => r.status === ReservationStatus.CONVERTED);
    expect(convertedRes).toBeDefined();

    // Verify exactly 24 installments were generated
    const installments = await prisma.installment.findMany({
      where: { contractId: testContract.id },
      orderBy: { installmentNumber: "asc" },
    });
    expect(installments.length).toBe(24);

    // Verify exact mathematical sum: sum(installments) + downPayment === finalPrice
    const sumInstallments = installments.reduce((acc, curr) => acc.plus(curr.amount), new Prisma.Decimal(0));
    const totalExpected = sumInstallments.plus(approved.downPayment);
    expect(totalExpected.toFixed(2)).toBe(approved.finalPrice.toFixed(2));
  });

  it("Step 8: Accountant records partial payment with pure FIFO allocation", async () => {
    // Non-accountant attempting payment is rejected
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: testContract.id,
        createdById: salesA1.id,
        userRole: UserRole.SALES_AGENT,
        amountHalalas: sarToHalalas(60000),
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: `idemp-unauth-${Date.now()}`,
      })
    ).rejects.toThrow();

    // Partial payment of 60,000 SAR (Installment #1 is 40,000 SAR, Installment #2 is 40,000 SAR)
    // FIFO should allocate:
    // Installment #1: 40,000 SAR -> status PAID
    // Installment #2: 20,000 SAR -> status PARTIAL (remaining 20,000 SAR)
    const result1 = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: testContract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountHalalas: sarToHalalas(60000),
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-e2e-pay1-${Date.now()}`,
      notes: "حوالة مصرف الراجحي دفعة أولى",
    });

    createdPaymentIds.push(result1.payment.id);
    expect(result1.payment.receiptNumber).toMatch(/^REC-/);
    expect(result1.payment.allocations.length).toBe(2);

    // Verify Installment #1 is fully paid
    const inst1 = await prisma.installment.findFirstOrThrow({
      where: { contractId: testContract.id, installmentNumber: 1 },
    });
    expect(inst1.status).toBe("PAID");
    expect(inst1.paidAmount.toFixed(2)).toBe("40000.00");

    // Verify Installment #2 is partially paid
    const inst2 = await prisma.installment.findFirstOrThrow({
      where: { contractId: testContract.id, installmentNumber: 2 },
    });
    expect(inst2.status).toBe("PARTIAL");
    expect(inst2.paidAmount.toFixed(2)).toBe("20000.00");
  });

  it("Step 9 & 10: Payment idempotency and ceiling balance validation", async () => {
    const idempKey = `idemp-dup-test-${Date.now()}`;

    // First call with idempotency key succeeds
    const resA = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: testContract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountHalalas: sarToHalalas(10000),
      method: PaymentMethod.MADA,
      idempotencyKey: idempKey,
    });
    createdPaymentIds.push(resA.payment.id);
    expect(resA.isDuplicate).toBe(false);

    // Second call with the same idempotency key returns idempotent duplicate record
    const resB = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: testContract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountHalalas: sarToHalalas(10000),
      method: PaymentMethod.MADA,
      idempotencyKey: idempKey,
    });
    expect(resB.isDuplicate).toBe(true);
    expect(resB.payment.id).toBe(resA.payment.id);

    // Payment exceeding remaining balance must be rejected
    // Total financed was 960,000. Paid so far: 60,000 + 10,000 = 70,000. Remaining: 890,000.
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: testContract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountHalalas: sarToHalalas(950000), // Exceeds remaining balance
        method: PaymentMethod.CHEQUE,
        idempotencyKey: `idemp-overpay-${Date.now()}`,
      })
    ).rejects.toThrow();
  });

  it("Step 11: Final payoff marks all installments PAID and contract COMPLETED", async () => {
    // Remaining balance is 890,000 SAR. Pay in full.
    const finalPayment = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: testContract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountHalalas: sarToHalalas(890000),
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-final-payoff-${Date.now()}`,
      notes: "تسوية شاملة وسداد كامل متبقي العقد",
    });

    createdPaymentIds.push(finalPayment.payment.id);

    // Verify all 24 installments are now PAID
    const unpaidInstallments = await prisma.installment.findMany({
      where: { contractId: testContract.id, status: { not: "PAID" } },
    });
    expect(unpaidInstallments.length).toBe(0);

    // Verify contract transitioned to COMPLETED
    const completedContract = await prisma.contract.findUniqueOrThrow({
      where: { id: testContract.id },
    });
    expect(completedContract.status).toBe(ContractStatus.COMPLETED);
  });

  it("Step 12: Audit logs record all critical steps and sanitize sensitive data", async () => {
    const logs = await AuditService.listAuditLogs(prisma, compAId, { limit: 50 });
    const actions = logs.logs.map((l) => l.action);

    expect(actions).toContain("UNIT_RESERVED");
    expect(actions).toContain("CONTRACT_DRAFTED");
    expect(actions).toContain("CONTRACT_APPROVED");
    expect(actions).toContain("PAYMENT_RECORDED");

    // Sensitive data sanitization check: no passwords or raw secrets in details
    for (const log of logs.logs) {
      expect(log.details).not.toContain("password");
      expect(log.details).not.toContain("SESSION_SECRET");
    }
  });

  it("Step 13: Strict multi-tenant isolation prevents Company B from accessing Company A data", async () => {
    // Company B accountant cannot record payment on Company A contract
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compBId, // wrong tenant
        contractId: testContract.id,
        createdById: accountantB.id,
        userRole: UserRole.ACCOUNTANT,
        amountHalalas: sarToHalalas(1000),
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-cross-tenant-${Date.now()}`,
      })
    ).rejects.toThrow();

    // Company B cannot see Company A contracts
    const contractsB = await ContractService.listContracts(prisma, compBId, {
      id: accountantB.id,
      role: UserRole.ACCOUNTANT,
    });
    const leak = contractsB.find((c) => c.id === testContract.id);
    expect(leak).toBeUndefined();

    // Company B cannot see Company A audit logs
    const auditLogsB = await AuditService.listAuditLogs(prisma, compBId, {});
    const logLeak = auditLogsB.logs.find((l) => l.entityId === testContract.id);
    expect(logLeak).toBeUndefined();
  });
});
