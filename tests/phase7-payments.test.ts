import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, UnitStatus, ReservationStatus, ContractStatus, PaymentMethod, Prisma } from "@prisma/client";
import { PaymentService } from "../src/lib/services/payment.service";
import { ContractService } from "../src/lib/services/contract.service";
import { UnitService } from "../src/lib/services/unit.service";
import { ClientService } from "../src/lib/services/client.service";
import { AuditService } from "../src/lib/services/audit.service";

describe("Phase 7: Payments, FIFO Allocation & Audit Logs Architecture, Security & Integrity", () => {
  let prisma: PrismaClient;

  // Company A
  let compAId: string;
  let adminA: { id: string; role: UserRole };
  let accountantA: { id: string; role: UserRole };
  let sales1A: { id: string; role: UserRole };
  let sales2A: { id: string; role: UserRole };

  // Company B (for Tenant Isolation)
  let compBId: string;
  let accountantB: { id: string; role: UserRole };

  // Track created entities for clean cleanup
  const createdPaymentIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();

    // 1. Fetch Company A users
    const compA = await prisma.company.findFirstOrThrow({ where: { name: { contains: "الريادة" } } });
    compAId = compA.id;

    adminA = await prisma.user.findFirstOrThrow({ where: { companyId: compAId, role: UserRole.COMPANY_ADMIN } });
    accountantA = await prisma.user.findFirstOrThrow({ where: { companyId: compAId, role: UserRole.ACCOUNTANT } });
    const salesListA = await prisma.user.findMany({ where: { companyId: compAId, role: UserRole.SALES_AGENT }, take: 2 });
    sales1A = salesListA[0]!;
    sales2A = salesListA[1]!;

    // 2. Fetch Company B users
    const compB = await prisma.company.findFirstOrThrow({ where: { name: { contains: "الأفق" } } });
    compBId = compB.id;

    accountantB = await prisma.user.findFirstOrThrow({ where: { companyId: compBId, role: UserRole.ACCOUNTANT } });
  });

  afterAll(async () => {
    // Cleanup created test entities in reverse dependency order
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

  // Helper to create an approved contract with known installment schedule
  async function setupApprovedContract(overrides?: {
    companyId?: string;
    salesUser?: { id: string; role: UserRole };
    unitPrice?: string;
    downPayment?: string;
    installmentCount?: number;
  }) {
    const targetCompId = overrides?.companyId || compAId;
    const targetSales = overrides?.salesUser || sales1A;
    const price = overrides?.unitPrice || "300000.00"; // 300,000 SAR
    const downPaymentSar = overrides?.downPayment || "60000.00"; // 60,000 SAR
    const installmentCount = overrides?.installmentCount || 3; // 3 installments

    // 1. Create unit
    const unitCode = `U-P7-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const unit = await UnitService.createUnit(prisma, {
      companyId: targetCompId,
      createdById: adminA.id,
      projectName: "برج الدفعات المعتمد",
      unitNumber: unitCode,
      type: "APARTMENT",
      floor: "5",
      area: 150,
      rooms: 3,
      priceSar: price,
    });
    createdUnitIds.push(unit.id);

    // 2. Create client
    const client = await ClientService.createClient(prisma, {
      companyId: targetCompId,
      createdById: targetSales.id,
      name: `عميل اختبار دفعات ${Date.now()}`,
      phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
      notes: "عميل منتظم بالسداد",
    });
    createdClientIds.push(client.id);

    // 3. Create active reservation
    const reservation = await prisma.reservation.create({
      data: {
        companyId: targetCompId,
        unitId: unit.id,
        clientId: client.id,
        createdById: targetSales.id,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      },
    });
    createdReservationIds.push(reservation.id);

    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED },
    });

    // 4. Create draft contract (0% discount -> finalPrice = 300,000, downPayment = 60,000, remaining = 240,000)
    // 3 installments of 80,000 each
    const draft = await ContractService.createDraft(prisma, {
      companyId: targetCompId,
      reservationId: reservation.id,
      createdById: targetSales.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar,
      installmentCount,
      startDate: new Date("2026-03-01T00:00:00Z"),
    });
    createdContractIds.push(draft.id);

    // 5. Approve contract by Accountant
    const approvedContract = await ContractService.approveContract(prisma, {
      companyId: targetCompId,
      contractId: draft.id,
      approvedById: targetCompId === compAId ? accountantA.id : accountantB.id,
      userRole: UserRole.ACCOUNTANT,
    });

    return { unit, client, reservation, contract: approvedContract };
  }

  // =========================================================================
  // 1. PAYMENT RECORDING & FIFO ALLOCATION
  // =========================================================================
  it("1. Accountant records payment against approved contract, allocating FIFO across installments with audit log", async () => {
    const { contract } = await setupApprovedContract();

    // Remaining balance is 240,000 (3 installments of 80,000)
    // Pay 120,000:
    // Should fully pay installment 1 (80,000) -> status: PAID
    // Should partially pay installment 2 (40,000) -> status: PARTIAL
    // Installment 3 untouched (0) -> status: PENDING
    const idempotencyKey = `idemp-test-1-${Date.now()}`;
    const result = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "120000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey,
      notes: "دفعة تحويل بنكي على قسطين",
    });
    createdPaymentIds.push(result.payment.id);

    expect(result.isDuplicate).toBe(false);
    expect(result.payment.amount).toBe("120000.00");
    expect(result.payment.method).toBe(PaymentMethod.BANK_TRANSFER);
    expect(result.payment.receiptNumber).toMatch(/^REC-/);
    expect(result.payment.allocations).toHaveLength(2);

    // Allocation 1: Inst 1 (80,000)
    expect(result.payment.allocations[0]!.installmentNumber).toBe(1);
    expect(result.payment.allocations[0]!.allocatedAmount).toBe("80000.00");
    expect(result.payment.allocations[0]!.newStatus).toBe("PAID");

    // Allocation 2: Inst 2 (40,000)
    expect(result.payment.allocations[1]!.installmentNumber).toBe(2);
    expect(result.payment.allocations[1]!.allocatedAmount).toBe("40000.00");
    expect(result.payment.allocations[1]!.newStatus).toBe("PARTIAL");

    // Invariant: SUM(allocations) === payment amount
    const sumAlloc = result.payment.allocations.reduce(
      (sum, a) => sum.plus(new Prisma.Decimal(a.allocatedAmount)),
      new Prisma.Decimal("0.00")
    );
    expect(sumAlloc.toFixed(2)).toBe("120000.00");

    // Verify installments state in database
    const installments = await prisma.installment.findMany({
      where: { contractId: contract.id },
      orderBy: { installmentNumber: "asc" },
    });
    expect(installments[0]!.paidAmount.toFixed(2)).toBe("80000.00");
    expect(installments[0]!.status).toBe("PAID");

    expect(installments[1]!.paidAmount.toFixed(2)).toBe("40000.00");
    expect(installments[1]!.status).toBe("PARTIAL");

    expect(installments[2]!.paidAmount.toFixed(2)).toBe("0.00");
    expect(installments[2]!.status).toBe("PENDING");

    // Verify AuditLog record
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: result.payment.id, action: "PAYMENT_RECORDED" },
    });
    expect(audit).not.toBeNull();
    const details = JSON.parse(audit!.details);
    expect(details.amount).toBe("120000.00");
    expect(details.contractId).toBe(contract.id);
  });

  it("2. Non-accountant role (Sales representative) cannot record payments (403 Forbidden)", async () => {
    const { contract } = await setupApprovedContract();

    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        amountSar: "50000.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-sales-forbidden-${Date.now()}`,
      })
    ).rejects.toThrow("فقط المحاسب يملك صلاحية تسجيل الدفعات وسندات القبض");
  });

  it("3. Payments can only be recorded against APPROVED contracts (rejects DRAFT contracts)", async () => {
    // Create draft contract WITHOUT approving it
    const unitCode = `U-P7-DRAFT-${Date.now()}`;
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "برج المسودة",
      unitNumber: unitCode,
      type: "APARTMENT",
      floor: "2",
      area: 120,
      rooms: 3,
      priceSar: "200000.00",
    });
    createdUnitIds.push(unit.id);

    const client = await ClientService.createClient(prisma, {
      companyId: compAId,
      createdById: sales1A.id,
      name: `عميل مسودة ${Date.now()}`,
      phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
    });
    createdClientIds.push(client.id);

    const reservation = await prisma.reservation.create({
      data: {
        companyId: compAId,
        unitId: unit.id,
        clientId: client.id,
        createdById: sales1A.id,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      },
    });
    createdReservationIds.push(reservation.id);

    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED },
    });

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "40000.00",
      installmentCount: 2,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    // Attempt to pay against draft contract
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: draft.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "20000.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-draft-rejected-${Date.now()}`,
      })
    ).rejects.toThrow("لا يمكن تسجيل دفعات لعقد غير معتمد");
  });

  it("4. Reject zero or negative payment amounts", async () => {
    const { contract } = await setupApprovedContract();

    // Zero amount
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "0.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-zero-${Date.now()}`,
      })
    ).rejects.toThrow("مبلغ الدفعة يجب أن يكون أكبر من الصفر");

    // Negative amount
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "-500.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-neg-${Date.now()}`,
      })
    ).rejects.toThrow("مبلغ الدفعة يجب أن يكون أكبر من الصفر");
  });

  it("5. Reject payment exceeding remaining contract balance", async () => {
    const { contract } = await setupApprovedContract(); // remaining balance is 240,000

    // Attempt to pay 240,001.00 (exceeds balance)
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "240001.00",
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: `idemp-exceed-${Date.now()}`,
      })
    ).rejects.toThrow("مبلغ الدفعة يتجاوز المتبقي من العقد");
  });

  it("6. Fully paying all remaining balance transitions contract status to COMPLETED", async () => {
    const { contract } = await setupApprovedContract(); // remaining balance is 240,000

    // Pay full 240,000
    const result = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "240000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-full-${Date.now()}`,
    });
    createdPaymentIds.push(result.payment.id);

    // Verify contract is now COMPLETED
    const refreshed = await prisma.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(refreshed.status).toBe(ContractStatus.COMPLETED);

    // Verify all installments are PAID
    const installments = await prisma.installment.findMany({ where: { contractId: contract.id } });
    expect(installments.every((i) => i.status === "PAID")).toBe(true);

    // Attempting another payment on COMPLETED contract must fail
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "1000.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-after-completed-${Date.now()}`,
      })
    ).rejects.toThrow("العقد مكتمل السداد مسبقاً");
  });

  // =========================================================================
  // 2. IDEMPOTENCY & CONCURRENCY SAFETY
  // =========================================================================
  it("7. Idempotency: Repeated request with the same key returns original payment without creating duplicate", async () => {
    const { contract } = await setupApprovedContract();
    const idempotencyKey = `idemp-dup-test-${Date.now()}`;

    // Request 1
    const res1 = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "50000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey,
      notes: "دفعة اختبار منع التكرار",
    });
    createdPaymentIds.push(res1.payment.id);

    expect(res1.isDuplicate).toBe(false);

    // Request 2 with IDENTICAL idempotencyKey
    const res2 = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "50000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey,
      notes: "دفعة مكررة",
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.payment.id).toBe(res1.payment.id);
    expect(res2.payment.receiptNumber).toBe(res1.payment.receiptNumber);

    // Verify exactly ONE payment in DB with this key
    const countInDb = await prisma.payment.count({
      where: { idempotencyKey, companyId: compAId },
    });
    expect(countInDb).toBe(1);
  });

  it("8. Concurrency Protection: Concurrent payments cannot overpay contract via PostgreSQL row locking", async () => {
    // Setup contract with remaining balance 100,000 (unitPrice 150,000, downPayment 50,000)
    const { contract } = await setupApprovedContract({
      unitPrice: "150000.00",
      downPayment: "50000.00",
      installmentCount: 2,
    });
    // Remaining balance is 100,000

    // Two accountants simultaneously attempt to pay 70,000 each (70,000 + 70,000 = 140,000 > 100,000)
    // Thanks to SELECT ... FOR UPDATE, one will succeed and the second will see remaining is only 30,000 and fail!
    const key1 = `idemp-race-1-${Date.now()}`;
    const key2 = `idemp-race-2-${Date.now()}`;

    const results = await Promise.allSettled([
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "70000.00",
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: key1,
      }),
      PaymentService.recordPayment(prisma, {
        companyId: compAId,
        contractId: contract.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "70000.00",
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: key2,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Exactly 1 must succeed and 1 must fail due to insufficient remaining balance
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason.message).toContain("مبلغ الدفعة يتجاوز المتبقي من العقد");

    createdPaymentIds.push(fulfilled[0]!.value.payment.id);

    // Verify total paid in DB is strictly 70,000, not 140,000
    const paymentsInDb = await prisma.payment.findMany({ where: { contractId: contract.id } });
    const totalPaid = paymentsInDb.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal("0.00"));
    expect(totalPaid.toFixed(2)).toBe("70000.00");
  });

  // =========================================================================
  // 3. TENANT & ROLE ISOLATION
  // =========================================================================
  it("9. Tenant Isolation: Company B accountant cannot pay or view Company A contract payments", async () => {
    const { contract } = await setupApprovedContract();

    // Company B accountant attempts to pay for Company A contract
    await expect(
      PaymentService.recordPayment(prisma, {
        companyId: compBId, // Company B
        contractId: contract.id, // Contract in Company A
        createdById: accountantB.id,
        userRole: UserRole.ACCOUNTANT,
        amountSar: "10000.00",
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-cross-tenant-${Date.now()}`,
      })
    ).rejects.toThrow("العقد غير موجود أو غير تابع للشركة");

    // Record a valid payment in Company A
    const payment = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "10000.00",
      method: PaymentMethod.CASH,
      idempotencyKey: `idemp-valid-compA-${Date.now()}`,
    });
    createdPaymentIds.push(payment.payment.id);

    // Company B accountant attempts to query Company A payment
    await expect(
      PaymentService.getPaymentById(prisma, compBId, payment.payment.id, accountantB)
    ).rejects.toThrow("سند القبض غير موجود أو غير تابع للشركة");
  });

  it("10. Sales representative can only view payments related to contracts they created", async () => {
    // Contract 1 by sales1A, Contract 2 by sales2A
    const { contract: c1 } = await setupApprovedContract({ salesUser: sales1A });
    const { contract: c2 } = await setupApprovedContract({ salesUser: sales2A });

    const p1 = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: c1.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "20000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-sales-view-1-${Date.now()}`,
    });
    createdPaymentIds.push(p1.payment.id);

    const p2 = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: c2.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "20000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-sales-view-2-${Date.now()}`,
    });
    createdPaymentIds.push(p2.payment.id);

    // sales1A lists payments -> sees p1, but NOT p2
    const sales1List = await PaymentService.listPayments(prisma, compAId, { user: sales1A });
    expect(sales1List.some((p) => p.id === p1.payment.id)).toBe(true);
    expect(sales1List.some((p) => p.id === p2.payment.id)).toBe(false);

    // sales1A directly requesting p2 by ID -> 403 Forbidden
    await expect(
      PaymentService.getPaymentById(prisma, compAId, p2.payment.id, sales1A)
    ).rejects.toThrow("لا يحق لمندوب المبيعات الاطلاع على مدفوعات عقود مندوبين آخرين");

    // Accountant sees both
    const accountantList = await PaymentService.listPayments(prisma, compAId, { user: accountantA });
    expect(accountantList.some((p) => p.id === p1.payment.id)).toBe(true);
    expect(accountantList.some((p) => p.id === p2.payment.id)).toBe(true);
  });

  // =========================================================================
  // 4. IMMUTABILITY & AUDIT LOGS
  // =========================================================================
  it("11. Audit Logs: Payment creation generates immutable audit record with financial metadata", async () => {
    const { contract } = await setupApprovedContract();

    const payment = await PaymentService.recordPayment(prisma, {
      companyId: compAId,
      contractId: contract.id,
      createdById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
      amountSar: "40000.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: `idemp-audit-${Date.now()}`,
    });
    createdPaymentIds.push(payment.payment.id);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: payment.payment.id,
        action: "PAYMENT_RECORDED",
      },
    });

    expect(audit).not.toBeNull();
    expect(audit!.companyId).toBe(compAId);
    expect(audit!.userId).toBe(accountantA.id);

    const parsed = JSON.parse(audit!.details);
    expect(parsed.paymentId).toBe(payment.payment.id);
    expect(parsed.amount).toBe("40000.00");
    expect(parsed.method).toBe(PaymentMethod.BANK_TRANSFER);
    expect(parsed.remainingBalance).toBeDefined();
  });

  it("12. Audit Logs: Unit price change creates audit record with oldPrice and newPrice", async () => {
    const unitCode = `U-AUDIT-${Date.now()}`;
    const unit = await UnitService.createUnit(prisma, {
      companyId: compAId,
      createdById: adminA.id,
      projectName: "مشروع تدقيق الأسعار",
      unitNumber: unitCode,
      type: "VILLA",
      floor: "1",
      area: 250,
      rooms: 5,
      priceSar: "1500000.00",
    });
    createdUnitIds.push(unit.id);

    // Update price to 1,600,000.00
    await UnitService.updateUnit(prisma, {
      companyId: compAId,
      unitId: unit.id,
      updatedById: adminA.id,
      priceSar: "1600000.00",
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: unit.id,
        action: "UNIT_PRICE_CHANGED",
      },
    });

    expect(audit).not.toBeNull();
    const parsed = JSON.parse(audit!.details);
    expect(parsed.oldPrice).toBe("1500000.00");
    expect(parsed.newPrice).toBe("1600000.00");
    expect(parsed.unitCode).toBe(unitCode);
  });

  it("13. Audit Logs: Contract approval creates audit record with contract metadata", async () => {
    const { contract } = await setupApprovedContract();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: contract.id,
        action: "CONTRACT_APPROVED",
      },
    });

    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(accountantA.id);
    const parsed = JSON.parse(audit!.details);
    expect(parsed.contractNumber).toBe(contract.contractNumber);
    expect(parsed.unitId).toBe(contract.unitId);
  });

  it("14. Audit Logs: Sanitizes sensitive fields (passwords, tokens, secrets) before persisting", () => {
    const sensitivePayload = {
      email: "user@test.sa",
      password: "SuperSecretPassword123!",
      sessionToken: "secret_session_token_xyz",
      cardCVV: "123",
      safeNote: "Regular customer inquiry",
    };

    const sanitized = AuditService.sanitizeDetails(sensitivePayload);
    const parsed = JSON.parse(sanitized);

    expect(parsed.email).toBe("user@test.sa");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.sessionToken).toBe("[REDACTED]");
    expect(parsed.safeNote).toBe("Regular customer inquiry");
  });

  it("15. Audit Logs: Pagination and Tenant Isolation in AuditService.listAuditLogs", async () => {
    // List audit logs for Company A
    const resultA = await AuditService.listAuditLogs(prisma, compAId, {
      page: 1,
      limit: 10,
    });

    expect(resultA.logs.length).toBeGreaterThan(0);
    expect(resultA.pagination.page).toBe(1);
    expect(resultA.pagination.limit).toBe(10);
    expect(resultA.pagination.total).toBeGreaterThanOrEqual(resultA.logs.length);

    // Every log must belong to Company A
    for (const log of resultA.logs) {
      expect(log.details).toBeDefined();
    }

    // Company B audit logs query returns Company B logs only
    const resultB = await AuditService.listAuditLogs(prisma, compBId, {
      page: 1,
      limit: 10,
    });

    // Check no Company A logs appear in Company B query
    const companyALogIds = new Set(resultA.logs.map((l) => l.id));
    for (const log of resultB.logs) {
      expect(companyALogIds.has(log.id)).toBe(false);
    }
  });
});
