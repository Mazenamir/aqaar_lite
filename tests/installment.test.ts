import { describe, it, expect } from "vitest";
import { InstallmentService } from "../src/lib/services/installment.service";

describe("InstallmentService - Mathematical Precision & Date Invariants", () => {
  it("should generate installments whose sum + down payment EXACTLY equals final price to the last halala", () => {
    // 100,000 SAR = 10,000,000 halalas
    // Down payment: 25,000 SAR = 2,500,000 halalas
    // Remaining: 75,000 SAR = 7,500,000 halalas divided by 7 installments (causes remainder!)
    const finalPrice = 10000000n;
    const downPayment = 2500000n;
    const count = 7;
    const startDate = new Date("2026-01-15T00:00:00Z");

    const schedule = InstallmentService.calculateSchedule(finalPrice, downPayment, count, startDate);

    expect(schedule).toHaveLength(7);

    // Verify mathematical sum
    const totalInstallments = schedule.reduce((sum, item) => sum + item.amountHalalas, 0n);
    expect(totalInstallments + downPayment).toBe(finalPrice);

    // Verify remainder distribution (7,500,000 % 7 = 3 halalas remainder added to first installment)
    const base = 7500000n / 7n; // 1,071,428
    const rem = 7500000n % 7n;  // 4
    expect(schedule[0]!.amountHalalas).toBe(base + rem);
    expect(schedule[1]!.amountHalalas).toBe(base);
    expect(schedule[6]!.amountHalalas).toBe(base);
  });

  it("should handle Jan 31 contract start date and clamp due dates for shorter months (Feb 28, Apr 30)", () => {
    const finalPrice = 12000000n;
    const downPayment = 2000000n;
    const count = 4;
    // Jan 31, 2026 (2026 is non-leap year: Feb has 28 days)
    const startDate = new Date("2026-01-31T00:00:00Z");

    const schedule = InstallmentService.calculateSchedule(finalPrice, downPayment, count, startDate);

    // Month 1: February -> Due date must clamp to Feb 28
    const febDate = schedule[0]!.dueDate;
    expect(febDate.getMonth()).toBe(1); // February (0-indexed)
    expect(febDate.getDate()).toBe(28);

    // Month 2: March -> March has 31 days -> Due date is March 31
    const marDate = schedule[1]!.dueDate;
    expect(marDate.getMonth()).toBe(2);
    expect(marDate.getDate()).toBe(31);

    // Month 3: April -> April has 30 days -> Due date is April 30
    const aprDate = schedule[2]!.dueDate;
    expect(aprDate.getMonth()).toBe(3);
    expect(aprDate.getDate()).toBe(30);
  });

  it("should reject down payment greater than or equal to final price", () => {
    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 1000000n, 12, new Date());
    }).toThrow("Down payment cannot be greater than or equal to final price");
  });

  it("should reject installment count less than or equal to zero", () => {
    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 100000n, 0, new Date());
    }).toThrow("Installment count must be greater than zero");
  });
});
