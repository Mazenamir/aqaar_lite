import { describe, it, expect } from "vitest";

describe("Payment Distribution - FIFO Allocation Invariant", () => {
  interface MockInstallment {
    id: string;
    installmentNumber: number;
    amountHalalas: bigint;
    paidAmountHalalas: bigint;
    status: "PENDING" | "PARTIAL" | "PAID";
  }

  function simulateFifoAllocation(
    installments: MockInstallment[],
    paymentAmountHalalas: bigint,
    remainingContractBalance: bigint
  ) {
    if (paymentAmountHalalas <= 0n) {
      throw new Error("Payment amount must be greater than zero");
    }

    if (paymentAmountHalalas > remainingContractBalance) {
      throw new Error("Payment exceeds remaining contract balance");
    }

    let unallocated = paymentAmountHalalas;
    const allocations: { installmentId: string; amount: bigint }[] = [];

    const updatedInstallments = installments.map((inst) => ({ ...inst }));

    for (const inst of updatedInstallments) {
      if (unallocated <= 0n) break;
      if (inst.status === "PAID") continue;

      const needed = inst.amountHalalas - inst.paidAmountHalalas;
      const allocate = unallocated >= needed ? needed : unallocated;

      inst.paidAmountHalalas += allocate;
      inst.status = inst.paidAmountHalalas === inst.amountHalalas ? "PAID" : "PARTIAL";

      allocations.push({
        installmentId: inst.id,
        amount: allocate,
      });

      unallocated -= allocate;
    }

    return { updatedInstallments, allocations };
  }

  it("should allocate payment FIFO to the oldest unpaid installment first and mark as PAID or PARTIAL", () => {
    const installments: MockInstallment[] = [
      { id: "inst-1", installmentNumber: 1, amountHalalas: 1000000n, paidAmountHalalas: 0n, status: "PENDING" },
      { id: "inst-2", installmentNumber: 2, amountHalalas: 1000000n, paidAmountHalalas: 0n, status: "PENDING" },
      { id: "inst-3", installmentNumber: 3, amountHalalas: 1000000n, paidAmountHalalas: 0n, status: "PENDING" },
    ];

    // Pay 15,000 SAR = 1,500,000 halalas (should fully pay inst-1 and partially pay inst-2)
    const result = simulateFifoAllocation(installments, 1500000n, 3000000n);

    expect(result.updatedInstallments[0]!.paidAmountHalalas).toBe(1000000n);
    expect(result.updatedInstallments[0]!.status).toBe("PAID");

    expect(result.updatedInstallments[1]!.paidAmountHalalas).toBe(500000n);
    expect(result.updatedInstallments[1]!.status).toBe("PARTIAL");

    expect(result.updatedInstallments[2]!.paidAmountHalalas).toBe(0n);
    expect(result.updatedInstallments[2]!.status).toBe("PENDING");

    expect(result.allocations).toEqual([
      { installmentId: "inst-1", amount: 1000000n },
      { installmentId: "inst-2", amount: 500000n },
    ]);
  });

  it("should reject payment that exceeds remaining contract balance", () => {
    const installments: MockInstallment[] = [
      { id: "inst-1", installmentNumber: 1, amountHalalas: 1000000n, paidAmountHalalas: 500000n, status: "PARTIAL" },
    ];

    expect(() => {
      // Remaining is 500,000 halalas, trying to pay 600,000
      simulateFifoAllocation(installments, 600000n, 500000n);
    }).toThrow("Payment exceeds remaining contract balance");
  });
});
