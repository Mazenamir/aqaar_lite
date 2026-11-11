import { PrismaClient, PaymentMethod, InstallmentStatus } from "@prisma/client";

export interface RecordPaymentInput {
  companyId: string;
  contractId: string;
  createdById: string;
  amountHalalas: bigint;
  method: PaymentMethod;
  idempotencyKey: string;
  notes?: string;
  receiptNumber?: string;
}

export class PaymentService {
  /**
   * Records a payment and allocates it FIFO across oldest unpaid installments in a single transaction.
   * Enforces idempotency to prevent duplicate payments on network retries or double submits.
   */
  public static async recordPayment(prisma: PrismaClient, input: RecordPaymentInput) {
    if (input.amountHalalas <= 0n) {
      throw new Error("Payment amount must be greater than zero");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: if idempotencyKey already exists, return existing payment
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          allocations: true,
        },
      });

      if (existingPayment) {
        // Return existing without creating duplicate
        return {
          payment: existingPayment,
          isDuplicate: true,
        };
      }

      // 2. Fetch contract with tenant isolation
      const contract = await tx.contract.findFirst({
        where: {
          id: input.contractId,
          companyId: input.companyId,
        },
        include: {
          installments: {
            orderBy: { dueDate: "asc" },
          },
          payments: true,
        },
      });

      if (!contract) {
        throw new Error("العقد غير موجود أو غير تابع للشركة");
      }

      if (contract.status !== "APPROVED") {
        throw new Error("لا يمكن تسجيل دفعات لعقد غير معتمد");
      }

      // 3. Verify total payments do not exceed contract remaining amount
      const totalPaidAlready = contract.payments.reduce((sum, p) => sum + p.amountHalalas, 0n);
      const remainingContractBalance = (contract.finalPriceHalalas - contract.downPaymentHalalas) - totalPaidAlready;

      if (input.amountHalalas > remainingContractBalance) {
        throw new Error(
          `مبلغ الدفعة يتجاوز المتبقي من العقد. المبلغ المتبقي هو: ${(Number(remainingContractBalance) / 100).toLocaleString("ar-SA")} ر.س`
        );
      }

      // 4. Generate receipt number if not provided
      const receiptNumber = input.receiptNumber || `REC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      // 5. Create Payment record
      const payment = await tx.payment.create({
        data: {
          companyId: input.companyId,
          contractId: input.contractId,
          createdById: input.createdById,
          receiptNumber,
          amountHalalas: input.amountHalalas,
          method: input.method,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
        },
      });

      // 6. FIFO Allocation across installments
      let unallocatedHalalas = input.amountHalalas;
      const unpaidInstallments = contract.installments.filter(
        (inst) => inst.status !== InstallmentStatus.PAID
      );

      for (const inst of unpaidInstallments) {
        if (unallocatedHalalas <= 0n) break;

        const neededToFinish = inst.amountHalalas - inst.paidAmountHalalas;
        const allocationAmount = unallocatedHalalas >= neededToFinish ? neededToFinish : unallocatedHalalas;

        const newPaidAmount = inst.paidAmountHalalas + allocationAmount;
        const newStatus = newPaidAmount === inst.amountHalalas ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL;

        // Update installment
        await tx.installment.update({
          where: { id: inst.id },
          data: {
            paidAmountHalalas: newPaidAmount,
            status: newStatus,
            paidAt: newStatus === InstallmentStatus.PAID ? new Date() : inst.paidAt,
          },
        });

        // Record Allocation
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            installmentId: inst.id,
            amountHalalas: allocationAmount,
          },
        });

        unallocatedHalalas -= allocationAmount;
      }

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById,
          action: "PAYMENT_RECORDED",
          entityType: "Payment",
          entityId: payment.id,
          details: JSON.stringify({
            receiptNumber: payment.receiptNumber,
            contractId: contract.id,
            amountHalalas: payment.amountHalalas.toString(),
            method: payment.method,
          }),
        },
      });

      return {
        payment,
        isDuplicate: false,
      };
    });
  }
}
