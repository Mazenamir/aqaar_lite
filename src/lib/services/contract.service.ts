import { PrismaClient, ContractStatus, UnitStatus, ReservationStatus } from "@prisma/client";
import { InstallmentService } from "./installment.service";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";

export interface CreateDraftContractInput {
  companyId: string;
  reservationId: string;
  createdById: string;
  discountPercent: number; // 0 to 5%
  downPaymentHalalas: bigint;
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
      const totalPaid = c.payments.reduce((sum, p) => sum + p.amountHalalas, 0n);
      const remainingBalance = (c.finalPriceHalalas - c.downPaymentHalalas) - totalPaid;

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
        discountPercent: c.discountPercent,
        unitPriceHalalas: c.unitPriceHalalas.toString(),
        finalPriceHalalas: c.finalPriceHalalas.toString(),
        finalPriceSar: (Number(c.finalPriceHalalas) / 100).toLocaleString("ar-SA"),
        downPaymentHalalas: c.downPaymentHalalas.toString(),
        downPaymentSar: (Number(c.downPaymentHalalas) / 100).toLocaleString("ar-SA"),
        totalPaidHalalas: totalPaid.toString(),
        totalPaidSar: (Number(totalPaid) / 100).toLocaleString("ar-SA"),
        remainingBalanceHalalas: remainingBalance.toString(),
        remainingBalanceSar: (Number(remainingBalance) / 100).toLocaleString("ar-SA"),
        installments: c.installments.map((inst) => {
          const isOverdue = inst.status !== "PAID" && inst.dueDate < now;

          return {
            id: inst.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate.toISOString().split("T")[0]!,
            amountHalalas: inst.amountHalalas.toString(),
            amountSar: (Number(inst.amountHalalas) / 100).toLocaleString("ar-SA"),
            paidAmountHalalas: inst.paidAmountHalalas.toString(),
            paidAmountSar: (Number(inst.paidAmountHalalas) / 100).toLocaleString("ar-SA"),
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

      const unit = reservation.unit;
      if (unit.status !== UnitStatus.RESERVED) {
        throw new ConflictError("الوحدة ليست في حالة حجز مؤقت");
      }

      // Calculate final price with exact discount
      const discountHalalas = (unit.priceHalalas * BigInt(input.discountPercent)) / 100n;
      const finalPriceHalalas = unit.priceHalalas - discountHalalas;

      if (input.downPaymentHalalas >= finalPriceHalalas) {
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
          unitPriceHalalas: unit.priceHalalas,
          discountPercent: input.discountPercent,
          finalPriceHalalas,
          downPaymentHalalas: input.downPaymentHalalas,
          installmentCount: input.installmentCount,
          status: ContractStatus.DRAFT,
          startDate: input.startDate,
        },
      });

      // Generate Installments
      const schedule = InstallmentService.calculateSchedule(
        finalPriceHalalas,
        input.downPaymentHalalas,
        input.installmentCount,
        input.startDate
      );

      for (const inst of schedule) {
        await tx.installment.create({
          data: {
            contractId: contract.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            amountHalalas: inst.amountHalalas,
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
            finalPriceHalalas: finalPriceHalalas.toString(),
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
