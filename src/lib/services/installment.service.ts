import { addMonths, endOfMonth, setDate, getDate } from "date-fns";
import { Prisma } from "@prisma/client";

export interface InstallmentCalculationResult {
  installmentNumber: number;
  dueDate: Date;
  amount: Prisma.Decimal;
  amountHalalas: bigint;
}

/**
 * Installment Generation Service (Separate Service Layer)
 * 
 * Rules Mandated by PDF:
 * 1. "المبلغ المتبقي بعد الدفعة الأولى مقسوم على عدد من الأقساط الشهرية."
 * 2. "مجموع الأقساط مع الدفعة الأولى يساوي السعر النهائي بدقة تامة حتى آخر قرش."
 * 3. "العقد الذي يبدأ في 31 يناير يستحق قسطه التالي في فبراير. اختر المنطق ووثقه."
 *    Documentation: We use the "clamped end-of-month" logic: If the start day exceeds
 *    the maximum days in the target month (e.g. Day 31 in Feb), the due date is set
 *    to the last valid day of that target month (Feb 28 or Feb 29 in leap years).
 * 4. Zero floats used throughout calculation.
 */
export class InstallmentService {
  /**
   * Generates exact installment schedule in halalas.
   */
  public static calculateSchedule(
    finalPriceHalalas: bigint,
    downPaymentHalalas: bigint,
    installmentCount: number,
    startDate: Date
  ): InstallmentCalculationResult[] {
    if (installmentCount <= 0) {
      throw new Error("Installment count must be greater than zero");
    }

    if (downPaymentHalalas >= finalPriceHalalas) {
      throw new Error("Down payment cannot be greater than or equal to final price");
    }

    const remainingHalalas = finalPriceHalalas - downPaymentHalalas;
    const countBigInt = BigInt(installmentCount);

    const baseAmount = remainingHalalas / countBigInt;
    const remainder = remainingHalalas % countBigInt;

    const startDay = getDate(startDate);
    const schedule: InstallmentCalculationResult[] = [];

    for (let i = 1; i <= installmentCount; i++) {
      // Month-end clamped due date calculation
      const targetMonth = addMonths(startDate, i);
      const maxDaysInTargetMonth = getDate(endOfMonth(targetMonth));
      const targetDay = Math.min(startDay, maxDaysInTargetMonth);
      const dueDate = setDate(targetMonth, targetDay);

      // The remainder halalas are added to the first installment to ensure exact sum to the last halala
      const amountHalalas = i === 1 ? baseAmount + remainder : baseAmount;

      schedule.push({
        installmentNumber: i,
        dueDate,
        amount: new Prisma.Decimal(amountHalalas.toString()).dividedBy(100),
        amountHalalas,
      });
    }

    // Verify mathematical invariant
    const totalInstallments = schedule.reduce((sum, item) => sum + item.amountHalalas, 0n);
    if (totalInstallments + downPaymentHalalas !== finalPriceHalalas) {
      throw new Error("Invariant failed: Total installments + down payment must equal final price exactly.");
    }

    return schedule;
  }
}
