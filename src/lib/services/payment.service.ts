import { PrismaClient, Prisma, PaymentMethod, InstallmentStatus, ContractStatus, UserRole } from "@prisma/client";
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from "@/lib/errors/app-error";
import { toDecimal, formatSar, sarToHalalas } from "../money";
import { PaymentAllocationService } from "./payment-allocation.service";

export interface RecordPaymentInput {
  companyId: string;
  contractId: string;
  createdById: string;
  userRole?: UserRole;
  amountSar?: string | number;
  amountHalalas?: bigint;
  method: PaymentMethod;
  idempotencyKey: string;
  notes?: string;
  receiptNumber?: string;
}

export interface PaymentDto {
  id: string;
  receiptNumber: string;
  contractId: string;
  contractNumber: string;
  unitCode: string;
  clientName: string;
  amount: string;
  amountSar: string;
  amountHalalas: string;
  method: PaymentMethod;
  notes: string;
  createdByName: string;
  createdById: string;
  createdAt: string;
  allocations: {
    id: string;
    installmentNumber: number;
    allocatedAmount: string;
    allocatedAmountSar: string;
    allocatedAmountHalalas: string;
    newStatus: string;
  }[];
}

export const PAYMENT_WITH_RELATIONS_INCLUDE = {
  contract: {
    include: {
      unit: true,
      client: true,
    },
  },
  createdBy: {
    select: { id: true, name: true },
  },
  allocations: {
    include: {
      installment: true,
    },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_WITH_RELATIONS_INCLUDE;
}>;

export class PaymentService {
  /**
   * Helper to format payment DTO with exact Decimal strings and halalas representations.
   */
  private static formatPaymentDto(p: PaymentWithRelations): PaymentDto {
    const amountHalalas = sarToHalalas(p.amount.toString());
    return {
      id: p.id,
      receiptNumber: p.receiptNumber,
      contractId: p.contractId,
      contractNumber: p.contract?.contractNumber || "",
      unitCode: p.contract?.unit?.code || "",
      clientName: p.contract?.client?.name || "",
      amount: p.amount.toFixed(2),
      amountSar: formatSar(p.amount),
      amountHalalas: amountHalalas.toString(),
      method: p.method,
      notes: p.notes || "",
      createdByName: p.createdBy?.name || "المحاسب المالي",
      createdById: p.createdById,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      allocations: (p.allocations || []).map((a) => {
        const allocHalalas = sarToHalalas(a.amount.toString());
        return {
          id: a.id,
          installmentNumber: a.installment?.installmentNumber || 0,
          allocatedAmount: a.amount.toFixed(2),
          allocatedAmountSar: formatSar(a.amount),
          allocatedAmountHalalas: allocHalalas.toString(),
          newStatus: a.installment?.status || "PARTIAL",
        };
      }),
    };
  }

  /**
   * Lists all recorded payments for the tenant with contract details and installment allocations.
   * Enforces role isolation: SALES_AGENT can only view payments for their own contracts.
   */
  public static async listPayments(
    prisma: PrismaClient,
    companyId: string,
    options?: {
      contractId?: string;
      user?: { id: string; role: UserRole };
    }
  ) {
    const where: Prisma.PaymentWhereInput = {
      companyId,
      ...(options?.contractId ? { contractId: options.contractId } : {}),
      ...(options?.user?.role === UserRole.SALES_AGENT
        ? { contract: { createdById: options.user.id } }
        : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: PAYMENT_WITH_RELATIONS_INCLUDE,
    });

    return payments.map((p) => this.formatPaymentDto(p));
  }

  /**
   * Retrieves single payment details by ID with tenant and ownership validation.
   */
  public static async getPaymentById(
    prisma: PrismaClient,
    companyId: string,
    paymentId: string,
    user?: { id: string; role: UserRole }
  ) {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        companyId,
      },
      include: PAYMENT_WITH_RELATIONS_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundError("سند القبض غير موجود أو غير تابع للشركة");
    }

    // Role-based ownership enforcement for SALES_AGENT
    if (user?.role === UserRole.SALES_AGENT && payment.contract.createdById !== user.id) {
      throw new ForbiddenError("لا يحق لمندوب المبيعات الاطلاع على مدفوعات عقود مندوبين آخرين");
    }

    return this.formatPaymentDto(payment);
  }

  /**
   * Records a payment and allocates it FIFO across oldest unpaid installments in a single transaction.
   * Enforces:
   * - Only ACCOUNTANT role can record payments.
   * - Payments can only be recorded against APPROVED contracts.
   * - Rejects zero or negative payment amounts.
   * - Rejects payments exceeding remaining contract balance.
   * - PostgreSQL row-level locking (SELECT FOR UPDATE) to prevent concurrent overpayments.
   * - Database-level idempotency to prevent duplicate submissions.
   * - Single atomic transaction with automatic rollback.
   * - Zero floating-point arithmetic (uses Prisma.Decimal only).
   */
  public static async recordPayment(prisma: PrismaClient, input: RecordPaymentInput) {
    // 1. Role authorization
    if (input.userRole && input.userRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenError("فقط المحاسب يملك صلاحية تسجيل الدفعات وسندات القبض");
    }

    // 2. Validate amount
    const paymentAmount = input.amountHalalas !== undefined
      ? new Prisma.Decimal(input.amountHalalas.toString()).dividedBy(100)
      : input.amountSar !== undefined
      ? toDecimal(input.amountSar)
      : new Prisma.Decimal("0.00");

    if (paymentAmount.lte(0)) {
      throw new ValidationError("مبلغ الدفعة يجب أن يكون أكبر من الصفر");
    }

    // 3. Validate idempotency key
    const trimmedIdempotencyKey = (input.idempotencyKey || "").trim();
    if (!trimmedIdempotencyKey || trimmedIdempotencyKey.length < 4) {
      throw new ValidationError("مفتاح منع التكرار (Idempotency Key) مطلوب وصحيح");
    }

    // 4. Initial Idempotency check: if key already processed, return existing payment
    const existingPayment = await prisma.payment.findFirst({
      where: {
        idempotencyKey: trimmedIdempotencyKey,
        companyId: input.companyId,
      },
      include: PAYMENT_WITH_RELATIONS_INCLUDE,
    });

    if (existingPayment) {
      return {
        payment: this.formatPaymentDto(existingPayment),
        isDuplicate: true,
      };
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Concurrency Safety: Exclusive row-level lock on the contract in PostgreSQL
        // Prevents two concurrent accountants from overpaying the contract or same installments
        await tx.$queryRaw`
          SELECT id FROM "contracts"
          WHERE id = ${input.contractId} AND "companyId" = ${input.companyId}
          FOR UPDATE
        `;

        // Fetch contract with fresh lock state
        const contract = await tx.contract.findFirst({
          where: {
            id: input.contractId,
            companyId: input.companyId,
          },
          include: {
            unit: true,
            client: true,
            payments: true,
          },
        });

        if (!contract) {
          throw new NotFoundError("العقد غير موجود أو غير تابع للشركة");
        }

        if (contract.status === ContractStatus.DRAFT) {
          throw new ConflictError("لا يمكن تسجيل دفعات لعقد غير معتمد (في حالة مسودة)");
        }

        if (contract.status === ContractStatus.COMPLETED) {
          throw new ConflictError("العقد مكتمل السداد مسبقاً ولا توجد أقساط متبقية للتحصيل");
        }

        // Verify total payments do not exceed contract remaining balance
        const totalPaidAlready = contract.payments.reduce(
          (sum, p) => sum.plus(p.amount),
          new Prisma.Decimal("0.00")
        );
        const remainingContractBalance = contract.finalPrice
          .minus(contract.downPayment)
          .minus(totalPaidAlready);

        if (paymentAmount.gt(remainingContractBalance)) {
          throw new ValidationError(
            `مبلغ الدفعة يتجاوز المتبقي من العقد. المبلغ المتبقي هو: ${formatSar(remainingContractBalance)}`
          );
        }

        // Fetch unpaid and partially paid installments sorted by dueDate ASC, then installmentNumber ASC
        const unpaidInstallments = await tx.installment.findMany({
          where: {
            contractId: contract.id,
            status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIAL] },
          },
          orderBy: [
            { dueDate: "asc" },
            { installmentNumber: "asc" },
          ],
        });

        if (unpaidInstallments.length === 0) {
          throw new ConflictError("لا توجد أقساط مستحقة أو غير مسددة لهذا العقد");
        }

        // Calculate FIFO Allocations using dedicated mathematical service
        const allocationResult = PaymentAllocationService.calculateFifoAllocations(
          unpaidInstallments,
          paymentAmount
        );

        // Generate receipt number
        const receiptNumber =
          input.receiptNumber ||
          `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

        // Create Payment record
        const payment = await tx.payment.create({
          data: {
            companyId: input.companyId,
            contractId: input.contractId,
            createdById: input.createdById,
            receiptNumber,
            amount: paymentAmount,
            method: input.method,
            idempotencyKey: trimmedIdempotencyKey,
            notes: input.notes,
          },
        });

        // Insert Allocations & Update Installment balances
        for (const alloc of allocationResult.allocations) {
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              installmentId: alloc.installmentId,
              amount: alloc.allocatedAmount,
            },
          });

          await tx.installment.update({
            where: { id: alloc.installmentId },
            data: {
              paidAmount: alloc.newPaidAmount,
              status: alloc.newStatus,
              paidAt: alloc.newStatus === InstallmentStatus.PAID ? new Date() : undefined,
            },
          });
        }

        // If all installments are now fully paid, transition contract to COMPLETED
        const remainingUnpaidCount = await tx.installment.count({
          where: {
            contractId: contract.id,
            status: { not: InstallmentStatus.PAID },
          },
        });

        if (remainingUnpaidCount === 0) {
          await tx.contract.update({
            where: { id: contract.id },
            data: { status: ContractStatus.COMPLETED },
          });
        }

        // Immutable Audit Log
        await tx.auditLog.create({
          data: {
            companyId: input.companyId,
            userId: input.createdById,
            action: "PAYMENT_RECORDED",
            entityType: "Payment",
            entityId: payment.id,
            details: JSON.stringify({
              paymentId: payment.id,
              receiptNumber: payment.receiptNumber,
              contractId: contract.id,
              contractNumber: contract.contractNumber,
              amount: payment.amount.toFixed(2),
              method: payment.method,
              allocationsCount: allocationResult.allocations.length,
              previousTotalPaid: totalPaidAlready.toFixed(2),
              newTotalPaid: totalPaidAlready.plus(paymentAmount).toFixed(2),
              remainingBalance: remainingContractBalance.minus(paymentAmount).toFixed(2),
              contractCompleted: remainingUnpaidCount === 0,
            }),
          },
        });

        // Fetch created payment with relations for return DTO
        const completePayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: PAYMENT_WITH_RELATIONS_INCLUDE,
        });

        return {
          payment: this.formatPaymentDto(completePayment),
          isDuplicate: false,
        };
      });
    } catch (error: unknown) {
      // Concurrency Idempotency Fallback: If concurrent request hit unique constraint on idempotencyKey
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raceExisting = await prisma.payment.findFirst({
          where: {
            idempotencyKey: trimmedIdempotencyKey,
            companyId: input.companyId,
          },
          include: PAYMENT_WITH_RELATIONS_INCLUDE,
        });

        if (raceExisting) {
          return {
            payment: this.formatPaymentDto(raceExisting),
            isDuplicate: true,
          };
        }
      }

      throw error;
    }
  }
}
