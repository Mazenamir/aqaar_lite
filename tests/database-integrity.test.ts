import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma, UnitStatus, ContractStatus, ReservationStatus, PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

describe("Phase 2: Database Architecture, Multi-Tenancy & Integrity Constraints", () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;
  let unitAId: string;
  let unitBId: string;
  let clientAId: string;
  let clientBId: string;

  beforeAll(async () => {
    // Fetch seeded companies and users
    const compA = await prisma.company.findUniqueOrThrow({ where: { crNumber: "1010892341" } });
    const compB = await prisma.company.findUniqueOrThrow({ where: { crNumber: "2050119842" } });
    companyAId = compA.id;
    companyBId = compB.id;

    const uA = await prisma.user.findFirstOrThrow({ where: { companyId: companyAId, role: "SALES_AGENT" } });
    const uB = await prisma.user.findFirstOrThrow({ where: { companyId: companyBId, role: "SALES_AGENT" } });
    userAId = uA.id;
    userBId = uB.id;

    const unA = await prisma.unit.findFirstOrThrow({ where: { companyId: companyAId, code: "A-101" } });
    const unB = await prisma.unit.findFirstOrThrow({ where: { companyId: companyBId, code: "A-101" } });
    unitAId = unA.id;
    unitBId = unB.id;

    const clA = await prisma.client.findFirstOrThrow({ where: { companyId: companyAId } });
    const clB = await prisma.client.findFirstOrThrow({ where: { companyId: companyBId } });
    clientAId = clA.id;
    clientBId = clB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. MULTI-TENANCY AT DATABASE LEVEL (Composite Foreign Keys)
  // =========================================================================
  it("should prevent Company A from referencing Company B's records via database-level composite foreign key", async () => {
    // Attempt to create a Contract in Company A, but pointing to Unit in Company B!
    // The composite foreign key FOREIGN KEY (unitId, companyId) REFERENCES units(id, companyId)
    // MUST reject this at the database engine level!
    await expect(
      prisma.contract.create({
        data: {
          companyId: companyAId, // Company A
          contractNumber: "ILLEGAL-CROSS-TENANT-001",
          unitId: unitBId,       // Unit belongs to Company B!
          clientId: clientAId,
          createdById: userAId,
          unitPrice: new Prisma.Decimal("1000000.00"),
          discountPercent: new Prisma.Decimal("0.00"),
          finalPrice: new Prisma.Decimal("1000000.00"),
          downPayment: new Prisma.Decimal("200000.00"),
          installmentCount: 12,
          status: ContractStatus.DRAFT,
          startDate: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it("should prevent Company A from creating a reservation for Company B's client", async () => {
    await expect(
      prisma.reservation.create({
        data: {
          companyId: companyAId, // Company A
          unitId: unitAId,       // Unit in Company A
          clientId: clientBId,   // Client in Company B!
          createdById: userAId,
          expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
          status: ReservationStatus.ACTIVE,
        },
      })
    ).rejects.toThrow();
  });

  it("should prevent Company A from assigning Company B's user as client creator via composite foreign key", async () => {
    await expect(
      prisma.client.create({
        data: {
          companyId: companyAId, // Company A
          name: "عميل تجربة عزل",
          phone: "0500000000",
          createdById: userBId, // User from Company B!
        },
      })
    ).rejects.toThrow();
  });

  // =========================================================================
  // 2. UNIQUE CONSTRAINTS (Scoped vs Cross-Tenant)
  // =========================================================================
  it("should reject duplicate unit numbers within the same company", async () => {
    // Attempt to insert another unit with code 'A-101' in Company A
    await expect(
      prisma.unit.create({
        data: {
          companyId: companyAId,
          project: "مجمع النخيل ريزيدنس",
          code: "A-101", // Duplicate code in Company A
          type: "شقة",
          floor: "1",
          area: 120,
          rooms: 3,
          price: new Prisma.Decimal("500000.00"),
          status: UnitStatus.AVAILABLE,
        },
      })
    ).rejects.toThrow();
  });

  it("should allow duplicate unit numbers across different companies", async () => {
    // Both Company A and Company B have a unit with code 'A-101'
    const unitInA = await prisma.unit.findUnique({
      where: { companyId_code: { companyId: companyAId, code: "A-101" } },
    });
    const unitInB = await prisma.unit.findUnique({
      where: { companyId_code: { companyId: companyBId, code: "A-101" } },
    });

    expect(unitInA).toBeDefined();
    expect(unitInB).toBeDefined();
    expect(unitInA?.code).toBe("A-101");
    expect(unitInB?.code).toBe("A-101");
    expect(unitInA?.companyId).not.toBe(unitInB?.companyId);
  });

  it("should enforce unique idempotency keys on payments", async () => {
    const contract = await prisma.contract.findFirstOrThrow({ where: { companyId: companyAId } });
    const duplicateKey = "idemp-duplicate-test-key-001";

    // 1st payment succeeds
    const p1 = await prisma.payment.create({
      data: {
        companyId: companyAId,
        contractId: contract.id,
        createdById: userAId,
        receiptNumber: `REC-IDEMP-1-${Date.now()}`,
        amount: new Prisma.Decimal("1000.00"),
        method: PaymentMethod.CASH,
        idempotencyKey: duplicateKey,
      },
    });
    expect(p1.id).toBeDefined();

    // 2nd payment with identical idempotencyKey MUST fail
    await expect(
      prisma.payment.create({
        data: {
          companyId: companyAId,
          contractId: contract.id,
          createdById: userAId,
          receiptNumber: `REC-IDEMP-2-${Date.now()}`,
          amount: new Prisma.Decimal("1000.00"),
          method: PaymentMethod.CASH,
          idempotencyKey: duplicateKey,
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.payment.delete({ where: { id: p1.id } });
  });

  // =========================================================================
  // 3. FINANCIAL CHECK CONSTRAINTS
  // =========================================================================
  it("should reject invalid monetary amounts (negative or zero unit price)", async () => {
    await expect(
      prisma.unit.create({
        data: {
          companyId: companyAId,
          project: "مشروع اختباري",
          code: "NEG-001",
          type: "شقة",
          floor: "1",
          area: 100,
          rooms: 2,
          price: new Prisma.Decimal("-50000.00"), // Negative price!
          status: UnitStatus.AVAILABLE,
        },
      })
    ).rejects.toThrow();

    await expect(
      prisma.unit.create({
        data: {
          companyId: companyAId,
          project: "مشروع اختباري",
          code: "ZERO-001",
          type: "شقة",
          floor: "1",
          area: 100,
          rooms: 2,
          price: new Prisma.Decimal("0.00"), // Zero price!
          status: UnitStatus.AVAILABLE,
        },
      })
    ).rejects.toThrow();
  });

  it("should reject contract discounts exceeding the 5% legal ceiling", async () => {
    await expect(
      prisma.contract.create({
        data: {
          companyId: companyAId,
          contractNumber: "CNT-INVALID-DISCOUNT-001",
          unitId: unitAId,
          clientId: clientAId,
          createdById: userAId,
          unitPrice: new Prisma.Decimal("1000000.00"),
          discountPercent: new Prisma.Decimal("6.50"), // > 5% discount!
          finalPrice: new Prisma.Decimal("935000.00"),
          downPayment: new Prisma.Decimal("100000.00"),
          installmentCount: 12,
          status: ContractStatus.DRAFT,
          startDate: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it("should reject contract down payments greater than or equal to final price", async () => {
    await expect(
      prisma.contract.create({
        data: {
          companyId: companyAId,
          contractNumber: "CNT-INVALID-DOWN-001",
          unitId: unitAId,
          clientId: clientAId,
          createdById: userAId,
          unitPrice: new Prisma.Decimal("1000000.00"),
          discountPercent: new Prisma.Decimal("0.00"),
          finalPrice: new Prisma.Decimal("1000000.00"),
          downPayment: new Prisma.Decimal("1000000.00"), // Down payment = Final Price!
          installmentCount: 12,
          status: ContractStatus.DRAFT,
          startDate: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  // =========================================================================
  // 4. ACTIVE RESERVATION DATABASE CONSTRAINT
  // =========================================================================
  it("should prevent concurrent booking conflicts with partial unique index on active reservations", async () => {
    // Create a new test unit
    const testUnit = await prisma.unit.create({
      data: {
        companyId: companyAId,
        project: "مشروع الحجز المتزامن",
        code: `RES-LOCK-${Date.now()}`,
        type: "شقة",
        floor: "2",
        area: 120,
        rooms: 3,
        price: new Prisma.Decimal("700000.00"),
        status: UnitStatus.AVAILABLE,
      },
    });

    // 1st active reservation succeeds
    const res1 = await prisma.reservation.create({
      data: {
        companyId: companyAId,
        unitId: testUnit.id,
        clientId: clientAId,
        createdById: userAId,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
        status: ReservationStatus.ACTIVE,
      },
    });
    expect(res1.id).toBeDefined();

    // 2nd active reservation for the exact same unit MUST be rejected by database partial unique index!
    await expect(
      prisma.reservation.create({
        data: {
          companyId: companyAId,
          unitId: testUnit.id,
          clientId: clientAId,
          createdById: userAId,
          expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
          status: ReservationStatus.ACTIVE, // Duplicate ACTIVE reservation!
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.reservation.delete({ where: { id: res1.id } });
    await prisma.unit.delete({ where: { id: testUnit.id } });
  });

  // =========================================================================
  // 5. PAYMENT ALLOCATION CEILING TRIGGER CONSTRAINTS
  // =========================================================================
  it("should reject payment allocations that exceed the corresponding payment amount via trigger", async () => {
    const contract = await prisma.contract.findFirstOrThrow({
      where: { companyId: companyAId, installments: { some: {} } },
      include: { installments: true },
    });

    const payment = await prisma.payment.create({
      data: {
        companyId: companyAId,
        contractId: contract.id,
        createdById: userAId,
        receiptNumber: `REC-TRIGGER-TEST-${Date.now()}`,
        amount: new Prisma.Decimal("5000.00"), // Max payment amount is 5,000.00
        method: PaymentMethod.CASH,
        idempotencyKey: `idemp-trigger-test-${Date.now()}`,
      },
    });

    // Pick an installment with 0 prior allocations (e.g. installment #5 with amount 38,550.00)
    const targetInstallment = contract.installments.find((i) => i.paidAmount.toNumber() === 0) || contract.installments[0]!;

    // Allocating 6,000.00 when payment is only 5,000.00 (while installment allows up to 38,550.00)
    // MUST trigger the payment allocation ceiling error!
    await expect(
      prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          installmentId: targetInstallment.id,
          amount: new Prisma.Decimal("6000.00"), // Exceeds payment amount of 5,000.00!
        },
      })
    ).rejects.toThrow(/exceed payment amount/i);

    // Clean up
    await prisma.payment.delete({ where: { id: payment.id } });
  });

  it("should reject installment allocations that exceed the installment amount via trigger", async () => {
    const contract = await prisma.contract.findFirstOrThrow({
      where: { companyId: companyAId, installments: { some: {} } },
      include: { installments: true },
    });

    const targetInstallment = contract.installments[0]!; // amount is 38,550.00

    const bigPayment = await prisma.payment.create({
      data: {
        companyId: companyAId,
        contractId: contract.id,
        createdById: userAId,
        receiptNumber: `REC-INST-TRIGGER-${Date.now()}`,
        amount: new Prisma.Decimal("100000.00"),
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: `idemp-inst-trigger-${Date.now()}`,
      },
    });

    // Allocating 50,000.00 to an installment that is only 38,550.00 MUST be rejected by trigger!
    await expect(
      prisma.paymentAllocation.create({
        data: {
          paymentId: bigPayment.id,
          installmentId: targetInstallment.id,
          amount: new Prisma.Decimal("50000.00"), // Exceeds installment amount!
        },
      })
    ).rejects.toThrow(/exceed installment amount/i);

    // Clean up
    await prisma.payment.delete({ where: { id: bigPayment.id } });
  });
});
