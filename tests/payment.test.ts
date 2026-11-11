import { describe, it, expect } from "vitest";
import { Prisma, InstallmentStatus } from "@prisma/client";
import { PaymentAllocationService, InstallmentForAllocation } from "../src/lib/services/payment-allocation.service";

describe("PaymentAllocationService - FIFO Allocation Mathematical Unit Tests", () => {
  it("should fully allocate payment to a single installment when payment equals installment balance", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-1",
        installmentNumber: 1,
        dueDate: new Date("2026-03-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
    ];

    const result = PaymentAllocationService.calculateFifoAllocations(
      installments,
      new Prisma.Decimal("10000.00")
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.allocatedAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[0]!.newPaidAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[0]!.newStatus).toBe(InstallmentStatus.PAID);
    expect(result.totalAllocated.toFixed(2)).toBe("10000.00");
    expect(result.remainingUnallocated.toFixed(2)).toBe("0.00");
    expect(result.allInstallmentsPaid).toBe(true);
  });

  it("should support partial installment payment and mark status as PARTIAL", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-1",
        installmentNumber: 1,
        dueDate: new Date("2026-03-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
    ];

    const result = PaymentAllocationService.calculateFifoAllocations(
      installments,
      new Prisma.Decimal("4500.00")
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.allocatedAmount.toFixed(2)).toBe("4500.00");
    expect(result.allocations[0]!.newPaidAmount.toFixed(2)).toBe("4500.00");
    expect(result.allocations[0]!.newStatus).toBe(InstallmentStatus.PARTIAL);
    expect(result.totalAllocated.toFixed(2)).toBe("4500.00");
    expect(result.remainingUnallocated.toFixed(2)).toBe("0.00");
    expect(result.allInstallmentsPaid).toBe(false);
  });

  it("should distribute payment FIFO across multiple installments ordered by dueDate ASC", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-1",
        installmentNumber: 1,
        dueDate: new Date("2026-01-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
      {
        id: "inst-2",
        installmentNumber: 2,
        dueDate: new Date("2026-02-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
      {
        id: "inst-3",
        installmentNumber: 3,
        dueDate: new Date("2026-03-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
    ];

    // Pay 25,000.00 SAR:
    // Should fully pay inst-1 (10,000)
    // Should fully pay inst-2 (10,000)
    // Should partially pay inst-3 (5,000)
    const result = PaymentAllocationService.calculateFifoAllocations(
      installments,
      new Prisma.Decimal("25000.00")
    );

    expect(result.allocations).toHaveLength(3);

    // Inst 1
    expect(result.allocations[0]!.installmentId).toBe("inst-1");
    expect(result.allocations[0]!.allocatedAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[0]!.newPaidAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[0]!.newStatus).toBe(InstallmentStatus.PAID);

    // Inst 2
    expect(result.allocations[1]!.installmentId).toBe("inst-2");
    expect(result.allocations[1]!.allocatedAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[1]!.newPaidAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[1]!.newStatus).toBe(InstallmentStatus.PAID);

    // Inst 3
    expect(result.allocations[2]!.installmentId).toBe("inst-3");
    expect(result.allocations[2]!.allocatedAmount.toFixed(2)).toBe("5000.00");
    expect(result.allocations[2]!.newPaidAmount.toFixed(2)).toBe("5000.00");
    expect(result.allocations[2]!.newStatus).toBe(InstallmentStatus.PARTIAL);

    // Sum invariant
    expect(result.totalAllocated.toFixed(2)).toBe("25000.00");
    expect(result.remainingUnallocated.toFixed(2)).toBe("0.00");
    expect(result.allInstallmentsPaid).toBe(false);
  });

  it("should use installmentNumber as a stable tie-breaker when due dates are identical", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-b",
        installmentNumber: 2,
        dueDate: new Date("2026-04-01"),
        amount: new Prisma.Decimal("5000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
      {
        id: "inst-a",
        installmentNumber: 1,
        dueDate: new Date("2026-04-01"), // Identical dueDate
        amount: new Prisma.Decimal("5000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
    ];

    const result = PaymentAllocationService.calculateFifoAllocations(
      installments,
      new Prisma.Decimal("6000.00")
    );

    // inst-1 must be prioritized before inst-2
    expect(result.allocations[0]!.installmentId).toBe("inst-a");
    expect(result.allocations[0]!.allocatedAmount.toFixed(2)).toBe("5000.00");
    expect(result.allocations[0]!.newStatus).toBe(InstallmentStatus.PAID);

    expect(result.allocations[1]!.installmentId).toBe("inst-b");
    expect(result.allocations[1]!.allocatedAmount.toFixed(2)).toBe("1000.00");
    expect(result.allocations[1]!.newStatus).toBe(InstallmentStatus.PARTIAL);
  });

  it("should skip already fully paid installments and allocate only to outstanding balance", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-1",
        installmentNumber: 1,
        dueDate: new Date("2026-01-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("10000.00"), // Already fully paid
        status: InstallmentStatus.PAID,
      },
      {
        id: "inst-2",
        installmentNumber: 2,
        dueDate: new Date("2026-02-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("4000.00"), // Partially paid (6000 remaining)
        status: InstallmentStatus.PARTIAL,
      },
    ];

    const result = PaymentAllocationService.calculateFifoAllocations(
      installments,
      new Prisma.Decimal("6000.00")
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.installmentId).toBe("inst-2");
    expect(result.allocations[0]!.allocatedAmount.toFixed(2)).toBe("6000.00");
    expect(result.allocations[0]!.newPaidAmount.toFixed(2)).toBe("10000.00");
    expect(result.allocations[0]!.newStatus).toBe(InstallmentStatus.PAID);
    expect(result.allInstallmentsPaid).toBe(true);
  });

  it("should reject zero or negative payment amounts", () => {
    const installments: InstallmentForAllocation[] = [
      {
        id: "inst-1",
        installmentNumber: 1,
        dueDate: new Date("2026-01-01"),
        amount: new Prisma.Decimal("10000.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        status: InstallmentStatus.PENDING,
      },
    ];

    expect(() =>
      PaymentAllocationService.calculateFifoAllocations(installments, new Prisma.Decimal("0.00"))
    ).toThrow("مبلغ الدفعة يجب أن يكون أكبر من الصفر");

    expect(() =>
      PaymentAllocationService.calculateFifoAllocations(installments, new Prisma.Decimal("-500.00"))
    ).toThrow("مبلغ الدفعة يجب أن يكون أكبر من الصفر");
  });
});
