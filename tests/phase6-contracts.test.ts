import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, UnitStatus, ReservationStatus, ContractStatus, Prisma } from "@prisma/client";
import { ContractService } from "../src/lib/services/contract.service";
import { ReservationService } from "../src/lib/services/reservation.service";
import { UnitService } from "../src/lib/services/unit.service";
import { ClientService } from "../src/lib/services/client.service";

describe("Phase 6: Contracts & Installments Architecture, Security & Financial Integrity", () => {
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
  let sales1B: { id: string; role: UserRole };

  // Track created entities for clean cleanup
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
    sales1B = await prisma.user.findFirstOrThrow({ where: { companyId: compBId, role: UserRole.SALES_AGENT } });
  });

  afterAll(async () => {
    // Cleanup created test entities in reverse dependency order
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

  // Helper to create a dedicated unit, client, and active reservation
  async function setupActiveReservation(overrides?: {
    companyId?: string;
    salesUser?: { id: string; role: UserRole };
    unitPrice?: string;
    expiresAt?: Date;
  }) {
    const targetCompId = overrides?.companyId || compAId;
    const targetSales = overrides?.salesUser || sales1A;
    const price = overrides?.unitPrice || "1000000.00"; // 1,000,000 SAR

    // Create unit
    const unitCode = `U-P6-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const unit = await UnitService.createUnit(prisma, {
      companyId: targetCompId,
      createdById: targetCompId === compAId ? adminA.id : accountantB.id,
      projectName: "مشروع النخيل الفاخر",
      unitNumber: unitCode,
      type: "APARTMENT",
      floor: "3",
      area: 180,
      rooms: 4,
      priceSar: price,
    });
    createdUnitIds.push(unit.id);

    // Create client
    const client = await ClientService.createClient(prisma, {
      companyId: targetCompId,
      createdById: targetSales.id,
      name: `عميل اختبار عقد ${Date.now()}`,
      phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
      notes: "عميل مهتم بالتقسيط على سنتين",
    });
    createdClientIds.push(client.id);

    // Create reservation
    const expiresAt = overrides?.expiresAt || new Date(Date.now() + 72 * 3600 * 1000);
    const reservation = await prisma.reservation.create({
      data: {
        companyId: targetCompId,
        unitId: unit.id,
        clientId: client.id,
        createdById: targetSales.id,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      },
      include: { unit: true, client: true },
    });
    createdReservationIds.push(reservation.id);

    // Update unit to RESERVED (as done by createReservation)
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED },
    });

    return { unit, client, reservation };
  }

  // =========================================================================
  // 1. DRAFT CREATION & FINANCIAL RULES
  // =========================================================================
  it("1. Only SALES users can create contract drafts from their active reservation", async () => {
    const { unit, client, reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 5, // 5% max discount
      downPaymentSar: "150000.00",
      installmentCount: 24,
      startDate: new Date("2026-02-01T00:00:00Z"),
    });
    createdContractIds.push(draft.id);

    expect(draft.status).toBe(ContractStatus.DRAFT);
    expect(draft.unitPrice.toFixed(2)).toBe("1000000.00");
    // 5% discount = 50,000 -> finalPrice = 950,000.00
    expect(draft.finalPrice.toFixed(2)).toBe("950000.00");
    expect(draft.downPayment.toFixed(2)).toBe("150000.00");
    expect(draft.installmentCount).toBe(24);

    // Verify installments generated in DB
    const installments = await prisma.installment.findMany({
      where: { contractId: draft.id },
      orderBy: { installmentNumber: "asc" },
    });
    expect(installments).toHaveLength(24);

    // Verify sum of installments + downPayment === finalPrice exactly
    const sumInstallments = installments.reduce((sum, inst) => sum.plus(inst.amount), new Prisma.Decimal("0.00"));
    expect(sumInstallments.plus(draft.downPayment).toFixed(2)).toBe(draft.finalPrice.toFixed(2));

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: draft.id, action: "CONTRACT_DRAFTED" },
    });
    expect(audit).not.toBeNull();
  });

  it("2. Non-sales role (Accountant or Admin) cannot create contract drafts", async () => {
    const { reservation } = await setupActiveReservation();

    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
        discountPercent: 0,
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("فقط مندوب المبيعات يمكنه إنشاء مسودات العقود");
  });

  it("3. Sales representative cannot create a draft for another representative's reservation", async () => {
    // Reservation belongs to sales1A
    const { reservation } = await setupActiveReservation({ salesUser: sales1A });

    // sales2A attempts to draft contract
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales2A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 0,
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("لا يحق لمندوب المبيعات إنشاء مسودة عقد لحجز مندوب آخر");
  });

  it("4. Cannot create a contract draft from an expired reservation", async () => {
    const expiredDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const { reservation } = await setupActiveReservation({ expiresAt: expiredDate });

    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 0,
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("الحجز منتهي الصلاحية");
  });

  it("5. Strict 5% discount ceiling: discounts > 5% or negative are rejected", async () => {
    const { reservation } = await setupActiveReservation();

    // Discount 5.1% -> Rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 5.1,
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("نسبة الخصم المسموح بها يجب أن تتراوح بين 0% و 5% كحد أقصى");

    // Discount -1% -> Rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: -1,
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("نسبة الخصم المسموح بها يجب أن تتراوح بين 0% و 5% كحد أقصى");
  });

  it("6. Down payment equal to or exceeding final price is rejected", async () => {
    const { reservation } = await setupActiveReservation({ unitPrice: "500000.00" });

    // Down payment = 500,000 -> equal to final price -> Rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 0,
        downPaymentSar: "500000.00",
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("الدفعة الأولى لا يمكن أن تساوي أو تتجاوز السعر النهائي");

    // Down payment > 500,000 -> exceeds final price -> Rejected
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 0,
        downPaymentSar: "600000.00",
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("الدفعة الأولى لا يمكن أن تساوي أو تتجاوز السعر النهائي");
  });

  it("7. Duplicate contract drafts for the same reservation are rejected", async () => {
    const { reservation } = await setupActiveReservation();

    const draft1 = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 2,
      downPaymentSar: "100000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft1.id);

    // Attempt second draft on the same reservation
    await expect(
      ContractService.createDraft(prisma, {
        companyId: compAId,
        reservationId: reservation.id,
        createdById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
        discountPercent: 2,
        downPaymentSar: "100000.00",
        installmentCount: 12,
        startDate: new Date(),
      })
    ).rejects.toThrow("يوجد عقد قائم بالفعل لهذا الحجز");
  });

  // =========================================================================
  // 2. CONTRACT APPROVAL & ATOMIC TRANSACTION INTEGRITY
  // =========================================================================
  it("8. Only ACCOUNTANT can approve contracts, atomically transitioning unit to SOLD and contract to APPROVED", async () => {
    const { unit, reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 3,
      downPaymentSar: "100000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    // Accountant approves
    const approved = await ContractService.approveContract(prisma, {
      companyId: compAId,
      contractId: draft.id,
      approvedById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
    });

    expect(approved.status).toBe(ContractStatus.APPROVED);
    expect(approved.approvedById).toBe(accountantA.id);
    expect(approved.approvedAt).not.toBeNull();

    // Verify unit transitioned to SOLD
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.SOLD);

    // Verify reservation transitioned to CONVERTED
    const refreshedRes = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(refreshedRes.status).toBe(ReservationStatus.CONVERTED);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: draft.id, action: "CONTRACT_APPROVED" },
    });
    expect(audit).not.toBeNull();
  });

  it("9. Sales representatives cannot approve contracts (403 Forbidden)", async () => {
    const { reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    await expect(
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: draft.id,
        approvedById: sales1A.id,
        userRole: UserRole.SALES_AGENT,
      })
    ).rejects.toThrow("فقط المحاسب يملك صلاحية اعتماد العقود");
  });

  it("10. Duplicate approval of already APPROVED contract is strictly rejected (Contract Immutability)", async () => {
    const { reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    // First approval
    await ContractService.approveContract(prisma, {
      companyId: compAId,
      contractId: draft.id,
      approvedById: accountantA.id,
      userRole: UserRole.ACCOUNTANT,
    });

    // Second approval attempt -> Must fail with Conflict
    await expect(
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: draft.id,
        approvedById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
      })
    ).rejects.toThrow("العقد ليس في حالة مسودة أو تم اعتماده مسبقاً ولا يمكن تعديله");
  });

  it("11. Approval is rejected if reservation expired before approval", async () => {
    // Setup reservation with short expiry
    const { unit, reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    // Simulate 72 hours elapsed: manually expire reservation in DB
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // Attempt approval -> Must reject because reservation expired
    await expect(
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: draft.id,
        approvedById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
      })
    ).rejects.toThrow("انتهت صلاحية الحجز المرتبط بهذا العقد");

    // Invariant: Unit must NOT be SOLD
    const refreshedUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshedUnit.status).toBe(UnitStatus.RESERVED);
  });

  // =========================================================================
  // 3. TENANT & ROLE ISOLATION
  // =========================================================================
  it("12. Tenant Isolation: Company B accountant cannot approve or view Company A contract", async () => {
    const { reservation } = await setupActiveReservation({ companyId: compAId });

    const draftA = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 1,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draftA.id);

    // Company B accountant attempts to view contract A
    await expect(
      ContractService.getContractById(prisma, compBId, draftA.id, accountantB)
    ).rejects.toThrow("العقد غير موجود أو غير تابع للشركة");

    // Company B accountant attempts to approve contract A
    await expect(
      ContractService.approveContract(prisma, {
        companyId: compBId,
        contractId: draftA.id,
        approvedById: accountantB.id,
        userRole: UserRole.ACCOUNTANT,
      })
    ).rejects.toThrow("العقد غير موجود أو غير تابع للشركة");
  });

  it("13. Sales representative can only view their own contracts", async () => {
    const { reservation: res1 } = await setupActiveReservation({ salesUser: sales1A });
    const { reservation: res2 } = await setupActiveReservation({ salesUser: sales2A });

    const draft1 = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: res1.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft1.id);

    const draft2 = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: res2.id,
      createdById: sales2A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft2.id);

    // sales1A listing contracts -> should see draft1 but NOT draft2
    const sales1List = await ContractService.listContracts(prisma, compAId, sales1A);
    const hasDraft1 = sales1List.some((c) => c.id === draft1.id);
    const hasDraft2 = sales1List.some((c) => c.id === draft2.id);
    expect(hasDraft1).toBe(true);
    expect(hasDraft2).toBe(false);

    // sales1A directly requesting draft2 by ID -> 403 Forbidden
    await expect(
      ContractService.getContractById(prisma, compAId, draft2.id, sales1A)
    ).rejects.toThrow("لا يحق لمندوب المبيعات الاطلاع على عقود مندوبين آخرين");

    // Accountant sees both
    const accountantList = await ContractService.listContracts(prisma, compAId, accountantA);
    expect(accountantList.some((c) => c.id === draft1.id)).toBe(true);
    expect(accountantList.some((c) => c.id === draft2.id)).toBe(true);
  });

  it("14. Contract details DTO formats monetary values strictly as string decimals without JavaScript floats", async () => {
    const { reservation } = await setupActiveReservation({ unitPrice: "850000.00" });

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 4.5, // 4.5% discount
      downPaymentSar: "100000.00",
      installmentCount: 10,
      startDate: new Date("2027-01-01T00:00:00Z"),
    });
    createdContractIds.push(draft.id);

    const dto = await ContractService.getContractById(prisma, compAId, draft.id, accountantA);

    // Verify string decimal properties
    expect(typeof dto.unitPrice).toBe("string");
    expect(dto.unitPrice).toBe("850000.00");
    expect(typeof dto.finalPrice).toBe("string");
    expect(typeof dto.downPayment).toBe("string");
    expect(typeof dto.remainingBalance).toBe("string");
    expect(dto.unitPriceSar).toContain("850,000.00 ر.س");

    // Verify installment items have string decimals
    expect(dto.installments.length).toBe(10);
    for (const inst of dto.installments) {
      expect(typeof inst.amount).toBe("string");
      expect(inst.amountSar).toContain("ر.س");
      expect(inst.status).toBe("PENDING");
    }
  });

  it("15. Evaluates installment status dynamically to OVERDUE when past due date and unpaid", async () => {
    const { reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "100000.00",
      installmentCount: 3,
      startDate: new Date("2025-01-01T00:00:00Z"), // Past start date
    });
    createdContractIds.push(draft.id);

    // In DB, installment status is PENDING, but due date was in 2025 (in the past)
    const dto = await ContractService.getContractById(prisma, compAId, draft.id, accountantA);
    expect(dto.installments[0]!.status).toBe("OVERDUE");
  });

  // =========================================================================
  // 4. CONCURRENT APPROVAL SAFETY
  // =========================================================================
  it("16. Concurrency Safety: Two concurrent approval requests on the same draft contract result in exactly 1 success and 1 conflict", async () => {
    const { unit, reservation } = await setupActiveReservation();

    const draft = await ContractService.createDraft(prisma, {
      companyId: compAId,
      reservationId: reservation.id,
      createdById: sales1A.id,
      userRole: UserRole.SALES_AGENT,
      discountPercent: 0,
      downPaymentSar: "50000.00",
      installmentCount: 12,
      startDate: new Date(),
    });
    createdContractIds.push(draft.id);

    // Launch 2 simultaneous approval requests
    const results = await Promise.allSettled([
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: draft.id,
        approvedById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
      }),
      ContractService.approveContract(prisma, {
        companyId: compAId,
        contractId: draft.id,
        approvedById: accountantA.id,
        userRole: UserRole.ACCOUNTANT,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, and one must be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Unit must be SOLD exactly once
    const finalUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(finalUnit.status).toBe(UnitStatus.SOLD);

    // Contract must be APPROVED
    const finalContract = await prisma.contract.findUniqueOrThrow({ where: { id: draft.id } });
    expect(finalContract.status).toBe(ContractStatus.APPROVED);
  });
});
