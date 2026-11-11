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

    // Verify remainder distribution (7,500,000 % 7 = 4 halalas remainder added to first installment)
    const base = 7500000n / 7n; // 1,071,428
    const rem = 7500000n % 7n;  // 4
    expect(schedule[0]!.amountHalalas).toBe(base + rem);
    expect(schedule[1]!.amountHalalas).toBe(base);
    expect(schedule[6]!.amountHalalas).toBe(base);
  });

  it("should accurately distribute remaining amount 100,000.00 across 3 installments with remainder allocated to the first", () => {
    // Assessment prompt example:
    // Remaining amount: 100000.00 (10,000,000 halalas)
    // Installments: 3
    // Expected: 33333.34, 33333.33, 33333.33 -> Total: 100000.00
    const finalPrice = 10000000n;
    const downPayment = 0n;
    const count = 3;
    const startDate = new Date("2026-03-01T00:00:00Z");

    const schedule = InstallmentService.calculateSchedule(finalPrice, downPayment, count, startDate);

    expect(schedule).toHaveLength(3);
    expect(schedule[0]!.amount.toString()).toBe("33333.34");
    expect(schedule[1]!.amount.toString()).toBe("33333.33");
    expect(schedule[2]!.amount.toString()).toBe("33333.33");

    const sum = schedule.reduce((acc, item) => acc + item.amountHalalas, 0n);
    expect(sum).toBe(10000000n);
  });

  it("should handle Jan 31 contract start date in non-leap year (clamps to Feb 28, then returns to Mar 31)", () => {
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

    // Month 2: March -> Returns to anchor day: March 31!
    const marDate = schedule[1]!.dueDate;
    expect(marDate.getMonth()).toBe(2);
    expect(marDate.getDate()).toBe(31);

    // Month 3: April -> Clamps to April 30
    const aprDate = schedule[2]!.dueDate;
    expect(aprDate.getMonth()).toBe(3);
    expect(aprDate.getDate()).toBe(30);

    // Month 4: May -> Returns to anchor day: May 31!
    const mayDate = schedule[3]!.dueDate;
    expect(mayDate.getMonth()).toBe(4);
    expect(mayDate.getDate()).toBe(31);
  });

  it("should handle Jan 31 contract start date in LEAP YEAR (2024 clamps to Feb 29, then returns to Mar 31)", () => {
    const finalPrice = 12000000n;
    const downPayment = 2000000n;
    const count = 3;
    // Jan 31, 2024 is in a leap year
    const startDate = new Date("2024-01-31T00:00:00Z");

    const schedule = InstallmentService.calculateSchedule(finalPrice, downPayment, count, startDate);

    // Month 1: February 2024 (Leap year -> 29 days)
    const febDate = schedule[0]!.dueDate;
    expect(febDate.getFullYear()).toBe(2024);
    expect(febDate.getMonth()).toBe(1);
    expect(febDate.getDate()).toBe(29);

    // Month 2: March 2024 -> returns to March 31
    const marDate = schedule[1]!.dueDate;
    expect(marDate.getMonth()).toBe(2);
    expect(marDate.getDate()).toBe(31);

    // Month 3: April 2024 -> clamps to April 30
    const aprDate = schedule[2]!.dueDate;
    expect(aprDate.getMonth()).toBe(3);
    expect(aprDate.getDate()).toBe(30);
  });

  it("should handle cross-year boundary transitions accurately (e.g. October 31 to February next year)", () => {
    const finalPrice = 10000000n;
    const downPayment = 1000000n;
    const count = 5;
    // Start on Oct 31, 2025
    const startDate = new Date("2025-10-31T00:00:00Z");

    const schedule = InstallmentService.calculateSchedule(finalPrice, downPayment, count, startDate);

    // M1: Nov 30, 2025
    expect(schedule[0]!.dueDate.getFullYear()).toBe(2025);
    expect(schedule[0]!.dueDate.getMonth()).toBe(10); // Nov
    expect(schedule[0]!.dueDate.getDate()).toBe(30);

    // M2: Dec 31, 2025
    expect(schedule[1]!.dueDate.getFullYear()).toBe(2025);
    expect(schedule[1]!.dueDate.getMonth()).toBe(11); // Dec
    expect(schedule[1]!.dueDate.getDate()).toBe(31);

    // M3: Jan 31, 2026 (Year transition!)
    expect(schedule[2]!.dueDate.getFullYear()).toBe(2026);
    expect(schedule[2]!.dueDate.getMonth()).toBe(0); // Jan
    expect(schedule[2]!.dueDate.getDate()).toBe(31);

    // M4: Feb 28, 2026
    expect(schedule[3]!.dueDate.getFullYear()).toBe(2026);
    expect(schedule[3]!.dueDate.getMonth()).toBe(1); // Feb
    expect(schedule[3]!.dueDate.getDate()).toBe(28);

    // M5: Mar 31, 2026
    expect(schedule[4]!.dueDate.getFullYear()).toBe(2026);
    expect(schedule[4]!.dueDate.getMonth()).toBe(2); // Mar
    expect(schedule[4]!.dueDate.getDate()).toBe(31);
  });

  it("should reject down payment greater than or equal to final price", () => {
    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 1000000n, 12, new Date());
    }).toThrow("Down payment cannot be greater than or equal to final price");

    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 1000001n, 12, new Date());
    }).toThrow("Down payment cannot be greater than or equal to final price");
  });

  it("should reject installment count less than or equal to zero", () => {
    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 100000n, 0, new Date());
    }).toThrow("Installment count must be greater than zero");

    expect(() => {
      InstallmentService.calculateSchedule(1000000n, 100000n, -5, new Date());
    }).toThrow("Installment count must be greater than zero");
  });
});
