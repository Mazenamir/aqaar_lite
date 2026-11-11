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
  downPaymentSar?: string;
  downPaymentHalalas?: bigint;
  installmentCount: number;
  startDate: Date;
}

export interface ApproveContractInput {
  companyId: string;
  contractId: string;
  approvedById: string;
}

export class ContractService {
  /**
   * Lists all contracts for the tenant with full installment schedules and payment balances.
   */
  public static async listContracts(prisma: PrismaClient, companyId: string) {
    const contracts = await prisma.contract.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        client: true,
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        installments: { orderBy: { installmentNumber: "asc" } },
        payments: true,
      },
    });

    const now = new Date();

    return contracts.map((c) => {
      const totalPaid = c.payments.reduce(
        (sum, p) => sum.plus(p.amount),
        new Prisma.Decimal("0.00")
      );
      const remainingBalance = c.finalPrice.minus(c.downPayment).minus(totalPaid);

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        status: c.status,
        unit: {
          id: c.unit.id,
          code: c.unit.code,
          project: c.unit.project,
          type: c.unit.type,
        },
        client: {
          id: c.client.id,
          name: c.client.name,
          phone: c.client.phone,
        },
        createdBy: c.createdBy.name,
        approvedBy: c.approvedBy?.name || null,
        approvedAt: c.approvedAt?.toISOString() || null,
        startDate: c.startDate.toISOString().split("T")[0]!,
        discountPercent: Number(c.discountPercent),
        unitPrice: c.unitPrice.toFixed(2),
        finalPrice: c.finalPrice.toFixed(2),
        finalPriceSar: formatSar(c.finalPrice),
        downPayment: c.downPayment.toFixed(2),
        downPaymentSar: formatSar(c.downPayment),
        totalPaid: totalPaid.toFixed(2),
        totalPaidSar: formatSar(totalPaid),
        remainingBalance: remainingBalance.toFixed(2),
        remainingBalanceSar: formatSar(remainingBalance),
        installments: c.installments.map((inst) => {
          const isOverdue = inst.status !== "PAID" && inst.dueDate < now;

          return {
            id: inst.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate.toISOString().split("T")[0]!,
            amount: inst.amount.toFixed(2),
            amountSar: formatSar(inst.amount),
            paidAmount: inst.paidAmount.toFixed(2),
            paidAmountSar: formatSar(inst.paidAmount),
            status: (isOverdue ? "OVERDUE" : inst.status) as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE",
            paidAt: inst.paidAt?.toISOString() || null,
          };
        }),
      };
    });
  }

  /**
   * Creates a draft contract from an active reservation.
   * Enforces max 5% discount rule.
   */
  public static async createDraft(prisma: PrismaClient, input: CreateDraftContractInput) {
    if (input.discountPercent < 0 || input.discountPercent > 5) {
      throw new ValidationError("نسبة الخصم المسموح بها يجب أن تتراوح بين 0% و 5% كحد أقصى");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch active reservation
      const reservation = await tx.reservation.findFirst({
        where: {
          id: input.reservationId,
          companyId: input.companyId,
          status: ReservationStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        include: { unit: true, client: true },
      });

      if (!reservation) {
        throw new NotFoundError("الحجز غير موجود أو منتهي الصلاحية أو غير تابع للشركة");
      }

      // Assert ownership: Sales agents can only create drafts from their own active reservations
      if (input.userRole === "SALES_AGENT" && reservation.createdById !== input.createdById) {
        throw new ForbiddenError("لا يحق لمندوب المبيعات إنشاء مسودة عقد لحجز مندوب آخر");
      }

      const unit = reservation.unit;
      if (unit.status !== UnitStatus.RESERVED) {
        throw new ConflictError("الوحدة ليست في حالة حجز مؤقت");
      }

      const downPayment = input.downPaymentSar
        ? toDecimal(input.downPaymentSar)
        : input.downPaymentHalalas !== undefined
        ? new Prisma.Decimal(input.downPaymentHalalas.toString()).dividedBy(100)
        : new Prisma.Decimal("0.00");

      // Calculate final price with exact discount
      const discountRate = new Prisma.Decimal(input.discountPercent).dividedBy(100);
      const discountAmount = unit.price.times(discountRate);
      const finalPrice = unit.price.minus(discountAmount);

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

      // Generate Installments
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

      // Mark reservation as CONVERTED
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONVERTED },
      });

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
            finalPrice: finalPrice.toFixed(2),
            discountPercent: input.discountPercent,
          }),
        },
      });

      return contract;
    });
  }

  /**
   * Approves contract by Accountant.
   * Unit moves from RESERVED to SOLD in a single atomic transaction.
   * Contract becomes immutable.
   */
  public static async approveContract(prisma: PrismaClient, input: ApproveContractInput) {
    return await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: {
          id: input.contractId,
          companyId: input.companyId,
        },
        include: { unit: true },
      });

      if (!contract) {
        throw new NotFoundError("العقد غير موجود أو غير تابع للشركة");
      }

      if (contract.status !== ContractStatus.DRAFT) {
        throw new ConflictError("العقد معتمد بالفعل ولا يمكن تعديله أو إعادة اعتماده");
      }

      // 1. Move unit to SOLD
      await tx.unit.update({
        where: { id: contract.unitId },
        data: { status: UnitStatus.SOLD },
      });

      // 2. Update contract to APPROVED
      const approvedContract = await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.APPROVED,
          approvedById: input.approvedById,
          approvedAt: new Date(),
        },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.approvedById,
          action: "CONTRACT_APPROVED",
          entityType: "Contract",
          entityId: contract.id,
          details: JSON.stringify({ contractNumber: contract.contractNumber, unitId: contract.unitId }),
        },
      });

      return approvedContract;
    });
  }
}
