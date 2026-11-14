import { PrismaClient, Prisma, ContractStatus, UnitStatus, ReservationStatus, UserRole } from "@prisma/client";
import { InstallmentService } from "./installment.service";
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from "@/lib/errors/app-error";
import { toDecimal, formatSar, sarToHalalas } from "../money";

export interface CreateDraftContractInput {
  companyId: string;
  reservationId: string;
  createdById: string;
  userRole?: UserRole;
  discountPercent: number; // 0 to 5%
  downPaymentSar?: string | number;
  downPaymentHalalas?: bigint;
  installmentCount: number;
  startDate: Date;
}

export interface ApproveContractInput {
  companyId: string;
  contractId: string;
  approvedById: string;
  userRole?: UserRole;
}

export const CONTRACT_WITH_RELATIONS_INCLUDE = {
  unit: true,
  client: true,
  reservation: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  installments: { orderBy: { installmentNumber: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.ContractInclude;

export type ContractWithRelations = Prisma.ContractGetPayload<{
  include: typeof CONTRACT_WITH_RELATIONS_INCLUDE;
}>;

export class ContractService {
  /**
   * Helper to format contract and installment DTO with strict Decimal string outputs
   * and halalas representations for full compatibility and precision.
   */
  private static formatContractDto(c: ContractWithRelations, now: Date = new Date()) {
    const totalPaid = c.payments ? c.payments.reduce(
      (sum: Prisma.Decimal, p) => sum.plus(p.amount),
      new Prisma.Decimal("0.00")
    ) : new Prisma.Decimal("0.00");

    const remainingBalance = c.finalPrice.minus(c.downPayment).minus(totalPaid);
    const discountRate = c.discountPercent.dividedBy(100);
    const discountAmount = c.unitPrice.times(discountRate);

    const unitPriceHalalas = sarToHalalas(c.unitPrice.toString());
    const discountAmountHalalas = sarToHalalas(discountAmount.toString());
    const finalPriceHalalas = sarToHalalas(c.finalPrice.toString());
    const downPaymentHalalas = sarToHalalas(c.downPayment.toString());
    const totalPaidHalalas = sarToHalalas(totalPaid.toString());
    const remainingBalanceHalalas = sarToHalalas(remainingBalance.toString());

    return {
      id: c.id,
      contractNumber: c.contractNumber,
      status: c.status,
      startDate: c.startDate instanceof Date ? c.startDate.toISOString().split("T")[0]! : String(c.startDate).split("T")[0]!,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
      unit: c.unit ? {
        id: c.unit.id,
        code: c.unit.code,
        project: c.unit.project,
        type: c.unit.type,
        floor: c.unit.floor,
        area: c.unit.area,
        rooms: c.unit.rooms,
        price: c.unit.price.toFixed(2),
        priceSar: formatSar(c.unit.price),
        status: c.unit.status,
      } : undefined,
      client: c.client ? {
        id: c.client.id,
        name: c.client.name,
        phone: c.client.phone,
        notes: c.client.notes || null,
      } : undefined,
      reservation: c.reservation ? {
        id: c.reservation.id,
        expiresAt: c.reservation.expiresAt?.toISOString(),
        status: c.reservation.status,
      } : undefined,
      createdBy: c.createdBy?.name || null,
      createdById: c.createdById,
      approvedBy: c.approvedBy?.name || null,
      approvedById: c.approvedById || null,
      approvedAt: c.approvedAt?.toISOString() || null,
      unitPrice: c.unitPrice.toFixed(2),
      unitPriceSar: formatSar(c.unitPrice),
      unitPriceHalalas: unitPriceHalalas.toString(),
      discountPercent: Number(c.discountPercent),
      discountAmount: discountAmount.toFixed(2),
      discountAmountSar: formatSar(discountAmount),
      discountAmountHalalas: discountAmountHalalas.toString(),
      finalPrice: c.finalPrice.toFixed(2),
      finalPriceSar: formatSar(c.finalPrice),
      finalPriceHalalas: finalPriceHalalas.toString(),
      downPayment: c.downPayment.toFixed(2),
      downPaymentSar: formatSar(c.downPayment),
      downPaymentHalalas: downPaymentHalalas.toString(),
      totalPaid: totalPaid.toFixed(2),
      totalPaidSar: formatSar(totalPaid),
      totalPaidHalalas: totalPaidHalalas.toString(),
      remainingBalance: remainingBalance.toFixed(2),
      remainingBalanceSar: formatSar(remainingBalance),
      remainingBalanceHalalas: remainingBalanceHalalas.toString(),
      installmentCount: c.installmentCount,
      installments: (c.installments || []).map((inst) => {
        const isOverdue = inst.status !== "PAID" && new Date(inst.dueDate) < now;
        const instAmountHalalas = sarToHalalas(inst.amount.toString());
        const instPaidHalalas = sarToHalalas(inst.paidAmount.toString());

        return {
          id: inst.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate instanceof Date ? inst.dueDate.toISOString().split("T")[0]! : String(inst.dueDate).split("T")[0]!,
          amount: inst.amount.toFixed(2),
          amountSar: formatSar(inst.amount),
          amountHalalas: instAmountHalalas.toString(),
          paidAmount: inst.paidAmount.toFixed(2),
          paidAmountSar: formatSar(inst.paidAmount),
          paidAmountHalalas: instPaidHalalas.toString(),
          status: (isOverdue ? "OVERDUE" : inst.status) as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE",
          paidAt: inst.paidAt?.toISOString() || null,
        };
      }),
      payments: (c.payments || []).map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        amount: p.amount.toFixed(2),
        amountSar: formatSar(p.amount),
        method: p.method,
        createdAt: p.createdAt?.toISOString(),
      })),
    };
  }

  /**
   * Lists all contracts for the tenant with full installment schedules and payment balances.
   * Enforces role isolation: SALES_AGENT can only view contracts they drafted.
   */
  public static async listContracts(
    prisma: PrismaClient,
    companyId: string,
    user?: { id: string; role: UserRole }
  ) {
    const where: Prisma.ContractWhereInput = {
      companyId,
      ...(user?.role === UserRole.SALES_AGENT ? { createdById: user.id } : {}),
    };

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: CONTRACT_WITH_RELATIONS_INCLUDE,
    });

    const now = new Date();
    return contracts.map((c) => this.formatContractDto(c, now));
  }

  /**
   * Retrieves single contract details by ID with tenant and ownership validation.
   */
  public static async getContractById(
    prisma: PrismaClient,
    companyId: string,
    contractId: string,
    user?: { id: string; role: UserRole }
  ) {
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        companyId,
      },
      include: CONTRACT_WITH_RELATIONS_INCLUDE,
    });

    if (!contract) {
      throw new NotFoundError("العقد غير موجود أو غير تابع للشركة");
    }

    // Role-based ownership enforcement for SALES_AGENT
    if (user?.role === UserRole.SALES_AGENT && contract.createdById !== user.id) {
      throw new ForbiddenError("لا يحق لمندوب المبيعات الاطلاع على عقود مندوبين آخرين");
    }

    return this.formatContractDto(contract);
  }

  /**
   * Creates a draft contract from an active reservation.
   * Validations:
   * - Only SALES users can create contract drafts.
   * - Reservation must belong to company, be ACTIVE, and not expired.
   * - Sales rep must own the reservation.
   * - Unit and client must belong to the same company.
   * - Unit must be RESERVED.
   * - No duplicate contracts for the same reservation.
   * - Discount between 0% and 5% max.
   * - Non-negative prices and down payments.
   * - Down payment strictly less than final price.
   * - Installment count valid positive integer.
   * - Original price retrieved from DB.
   * - Zero floating point arithmetic (Prisma Decimal and BigInt halalas only).
   */
  public static async createDraft(prisma: PrismaClient, input: CreateDraftContractInput) {
    // 1. Role validation
    if (input.userRole && input.userRole !== UserRole.SALES_AGENT) {
      throw new ForbiddenError("فقط مندوب المبيعات يمكنه إنشاء مسودات العقود");
    }

    // 2. Discount ceiling validation (0% to 5%)
    if (input.discountPercent < 0 || input.discountPercent > 5) {
      throw new ValidationError("نسبة الخصم المسموح بها يجب أن تتراوح بين 0% و 5% كحد أقصى");
    }

    // 3. Installment count validation
    if (!Number.isInteger(input.installmentCount) || input.installmentCount <= 0) {
      throw new ValidationError("عدد الأقساط يجب أن يكون رقماً صحيحاً موجباً أكبر من الصفر");
    }

    return await prisma.$transaction(async (tx) => {
      // 4. Fetch reservation with tenant isolation
      const reservation = await tx.reservation.findFirst({
        where: {
          id: input.reservationId,
          companyId: input.companyId,
        },
        include: { unit: true, client: true },
      });

      if (!reservation) {
        throw new NotFoundError("الحجز غير موجود أو غير تابع للشركة");
      }

      // Check reservation status
      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new ValidationError("لا يمكن إنشاء عقد لحجز غير فعال أو منتهي الصلاحية");
      }

      // Check reservation expiration (72h duration)
      if (reservation.expiresAt <= new Date()) {
        throw new ValidationError("الحجز منتهي الصلاحية، لا يمكن إنشاء عقد له");
      }

      // Assert ownership: Sales agents can only create drafts from their own active reservations
      if (reservation.createdById !== input.createdById) {
        throw new ForbiddenError("لا يحق لمندوب المبيعات إنشاء مسودة عقد لحجز مندوب آخر");
      }

      // Verify client and unit tenant consistency
      if (reservation.client.companyId !== input.companyId) {
        throw new ForbiddenError("العميل غير تابع لنفس الشركة");
      }

      const unit = reservation.unit;
      if (unit.companyId !== input.companyId) {
        throw new ForbiddenError("الوحدة غير تابعة لنفس الشركة");
      }

      if (unit.status !== UnitStatus.RESERVED) {
        throw new ConflictError("الوحدة ليست في حالة حجز مؤقت");
      }

      // Check for duplicate active/draft contract on this reservation
      const existingContract = await tx.contract.findFirst({
        where: {
          reservationId: reservation.id,
          companyId: input.companyId,
          status: { in: [ContractStatus.DRAFT, ContractStatus.APPROVED] },
        },
      });

      if (existingContract) {
        throw new ConflictError("يوجد عقد قائم بالفعل لهذا الحجز");
      }

      // Parse downPayment strictly using Decimal
      let downPayment: Prisma.Decimal;
      if (input.downPaymentHalalas !== undefined) {
        downPayment = new Prisma.Decimal(input.downPaymentHalalas.toString()).dividedBy(100);
      } else if (input.downPaymentSar !== undefined) {
        downPayment = toDecimal(input.downPaymentSar);
      } else {
        downPayment = new Prisma.Decimal("0.00");
      }

      if (downPayment.lt(0)) {
        throw new ValidationError("الدفعة الأولى لا يمكن أن تكون سالبة");
      }

      // Original unit price is taken strictly from DB
      if (unit.price.lte(0)) {
        throw new ValidationError("سعر الوحدة الأصلي غير صالح");
      }

      // Calculate final price with exact decimal arithmetic
      const discountRate = new Prisma.Decimal(input.discountPercent).dividedBy(100);
      const discountAmount = unit.price.times(discountRate);
      const finalPrice = unit.price.minus(discountAmount);

      if (finalPrice.lte(0)) {
        throw new ValidationError("السعر النهائي للوحدة يجب أن يكون أكبر من الصفر");
      }

      if (downPayment.gte(finalPrice)) {
        throw new ValidationError("الدفعة الأولى لا يمكن أن تساوي أو تتجاوز السعر النهائي للوحدة");
      }

      const contractNumber = `CNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create draft contract
      const contract = await tx.contract.create({
        data: {
          companyId: input.companyId,
          contractNumber,
          unitId: unit.id,
          clientId: reservation.clientId,
          reservationId: reservation.id,
          createdById: input.createdById,
          unitPrice: unit.price,
          discountPercent: new Prisma.Decimal(input.discountPercent.toFixed(2)),
          finalPrice,
          downPayment,
          installmentCount: input.installmentCount,
          status: ContractStatus.DRAFT,
          startDate: input.startDate,
        },
      });

      // Generate Installments using mathematical service
      const schedule = InstallmentService.calculateSchedule(
        sarToHalalas(finalPrice.toString()),
        sarToHalalas(downPayment.toString()),
        input.installmentCount,
        input.startDate
      );

      for (const inst of schedule) {
        await tx.installment.create({
          data: {
            contractId: contract.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            amount: inst.amount,
          },
        });
      }

      // Note: Reservation remains linked with status ACTIVE so its expiration window is maintained until approval!

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById,
          action: "CONTRACT_DRAFTED",
          entityType: "Contract",
          entityId: contract.id,
          details: JSON.stringify({
            contractNumber,
            unitCode: unit.code,
            unitPrice: unit.price.toFixed(2),
            finalPrice: finalPrice.toFixed(2),
            discountPercent: input.discountPercent,
            downPayment: downPayment.toFixed(2),
            installmentCount: input.installmentCount,
          }),
        },
      });

      return contract;
    });
  }

  /**
   * Approves contract by Accountant.
   * Concurrency-safe atomic transaction:
   * - Only ACCOUNTANT users can approve contracts.
   * - Only DRAFT contracts can be approved.
   * - Validate linked active reservation and its expiration.
   * - Validate unit is still RESERVED.
   * - Conditionally move unit to SOLD.
   * - Conditionally update contract to APPROVED with approvedById and approvedAt.
   * - Move reservation to CONVERTED.
   * - Immutable post-approval.
   */
  public static async approveContract(prisma: PrismaClient, input: ApproveContractInput) {
    if (input.userRole && input.userRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenError("فقط المحاسب يملك صلاحية اعتماد العقود");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch draft contract
      const contract = await tx.contract.findFirst({
        where: {
          id: input.contractId,
          companyId: input.companyId,
        },
        include: {
          unit: true,
          reservation: true,
        },
      });

      if (!contract) {
        throw new NotFoundError("العقد غير موجود أو غير تابع للشركة");
      }

      if (contract.status !== ContractStatus.DRAFT) {
        throw new ConflictError("العقد ليس في حالة مسودة أو تم اعتماده مسبقاً ولا يمكن تعديله");
      }

      // 2. Validate linked reservation if present
      if (contract.reservation) {
        if (contract.reservation.expiresAt <= new Date()) {
          throw new ValidationError("انتهت صلاحية الحجز المرتبط بهذا العقد، لا يمكن اعتماده");
        }
        if (contract.reservation.status !== ReservationStatus.ACTIVE) {
          throw new ConflictError("الحجز المرتبط بالعقد لم يعد فعالاً");
        }
      }

      // 3. Validate unit
      if (contract.unit.companyId !== input.companyId) {
        throw new ForbiddenError("الوحدة غير تابعة لنفس الشركة");
      }
      if (contract.unit.status !== UnitStatus.RESERVED) {
        throw new ConflictError("الوحدة ليست في حالة حجز مؤقت (ربما تم بيعها أو تحريرها)");
      }

      // 4. Atomic conditional update of unit from RESERVED to SOLD
      const unitUpdate = await tx.unit.updateMany({
        where: {
          id: contract.unitId,
          companyId: input.companyId,
          status: UnitStatus.RESERVED,
        },
        data: {
          status: UnitStatus.SOLD,
        },
      });

      if (unitUpdate.count === 0) {
        throw new ConflictError("فشل تحديث حالة الوحدة إلى مباعة؛ الوحدة ليست محجوزة أو تم تحديثها بالتزامن");
      }

      // 5. Atomic conditional update of contract from DRAFT to APPROVED
      const contractUpdate = await tx.contract.updateMany({
        where: {
          id: contract.id,
          companyId: input.companyId,
          status: ContractStatus.DRAFT,
        },
        data: {
          status: ContractStatus.APPROVED,
          approvedById: input.approvedById,
          approvedAt: new Date(),
        },
      });

      if (contractUpdate.count === 0) {
        throw new ConflictError("فشل اعتماد العقد؛ ربما تم اعتماده بالتزامن من محاسب آخر");
      }

      // 6. Transition reservation to CONVERTED
      if (contract.reservationId) {
        await tx.reservation.updateMany({
          where: {
            id: contract.reservationId,
            companyId: input.companyId,
            status: ReservationStatus.ACTIVE,
          },
          data: {
            status: ReservationStatus.CONVERTED,
          },
        });
      }

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.approvedById,
          action: "CONTRACT_APPROVED",
          entityType: "Contract",
          entityId: contract.id,
          details: JSON.stringify({
            contractNumber: contract.contractNumber,
            unitId: contract.unitId,
            unitCode: contract.unit.code,
            approvedAt: new Date().toISOString(),
          }),
        },
      });

      // Return updated contract with relations
      return await tx.contract.findUniqueOrThrow({
        where: { id: contract.id },
        include: {
          unit: true,
          client: true,
          approvedBy: true,
        },
      });
    });
  }
}
