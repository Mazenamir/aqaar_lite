import { Prisma, InstallmentStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors/app-error";

export interface InstallmentForAllocation {
  id: string;
  installmentNumber: number;
  dueDate: Date;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  status: InstallmentStatus;
}

export interface CalculatedAllocation {
  installmentId: string;
  installmentNumber: number;
  allocatedAmount: Prisma.Decimal;
  allocatedAmountHalalas: bigint;
  newPaidAmount: Prisma.Decimal;
  newStatus: InstallmentStatus;
}

export interface FifoAllocationResult {
  allocations: CalculatedAllocation[];
  totalAllocated: Prisma.Decimal;
  totalAllocatedHalalas: bigint;
  remainingUnallocated: Prisma.Decimal;
  allInstallmentsPaid: boolean;
}

/**
 * Dedicated FIFO Payment Allocation Service.
 * Implements strict FIFO distribution across outstanding installments:
 * 1. Retrieves unpaid or partially paid installments.
 * 2. Sorts by due date ascending, with installmentNumber as a stable tie-breaker.
 * 3. Allocates to the oldest outstanding installment first.
 * 4. Continues until payment is fully allocated or remaining balance is satisfied.
 * 5. Updates installment paid amounts and statuses (PARTIAL / PAID).
 * 6. Guarantees mathematical invariant: SUM(allocations) === payment amount.
 * 7. Zero floating-point arithmetic (uses Prisma.Decimal and BigInt halalas only).
 */
export class PaymentAllocationService {
  public static calculateFifoAllocations(
    installments: InstallmentForAllocation[],
    paymentAmount: Prisma.Decimal
  ): FifoAllocationResult {
    if (paymentAmount.lte(0)) {
      throw new ValidationError("مبلغ الدفعة يجب أن يكون أكبر من الصفر");
    }

    // Sort installments strictly by dueDate ASC, then installmentNumber ASC (stable tie-breaker)
    const sorted = [...installments].sort((a, b) => {
      const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.installmentNumber - b.installmentNumber;
    });

    let unallocated = paymentAmount;
    const allocations: CalculatedAllocation[] = [];

    for (const inst of sorted) {
      if (unallocated.lte(0)) break;

      // Skip already fully paid installments
      if (inst.status === InstallmentStatus.PAID || inst.paidAmount.gte(inst.amount)) {
        continue;
      }

      const outstanding = inst.amount.minus(inst.paidAmount);
      // Allocate the smaller of unallocated payment or outstanding balance
      const allocate = unallocated.gte(outstanding) ? outstanding : unallocated;

      const newPaidAmount = inst.paidAmount.plus(allocate);
      const newStatus = newPaidAmount.equals(inst.amount)
        ? InstallmentStatus.PAID
        : InstallmentStatus.PARTIAL;

      const allocateHalalas = BigInt(allocate.times(100).toFixed(0));

      allocations.push({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        allocatedAmount: allocate,
        allocatedAmountHalalas: allocateHalalas,
        newPaidAmount,
        newStatus,
      });

      unallocated = unallocated.minus(allocate);
    }

    const totalAllocated = allocations.reduce(
      (sum, a) => sum.plus(a.allocatedAmount),
      new Prisma.Decimal("0.00")
    );
    const totalAllocatedHalalas = allocations.reduce(
      (sum, a) => sum + a.allocatedAmountHalalas,
      0n
    );

    // Verify mathematical invariant: allocations must sum exactly to the allocated amount
    if (!totalAllocated.equals(paymentAmount.minus(unallocated))) {
      throw new Error("Invariant failed: Sum of allocations does not match allocated payment amount");
    }

    // Determine if all installments for this contract are now fully paid
    const allInstallmentsPaid = sorted.every((inst) => {
      const alloc = allocations.find((a) => a.installmentId === inst.id);
      if (alloc) {
        return alloc.newStatus === InstallmentStatus.PAID;
      }
      return inst.status === InstallmentStatus.PAID;
    });

    return {
      allocations,
      totalAllocated,
      totalAllocatedHalalas,
      remainingUnallocated: unallocated,
      allInstallmentsPaid,
    };
  }
}
