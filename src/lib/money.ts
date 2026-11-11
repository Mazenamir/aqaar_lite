import { Prisma } from "@prisma/client";

/**
 * Strict Monetary Utility
 * 
 * Mandated Rules:
 * 1. Never use Float or Double for money in DB, Code, or JSON.
 * 2. Use PostgreSQL DECIMAL(14, 2) and Prisma.Decimal.
 * 3. Monetary values must never be converted to JavaScript floating-point numbers.
 * 4. Use decimal strings ("1500000.00") in JSON representations and API payloads.
 * 5. Ensure exact installment calculations where sum(installments) === (finalPrice - downPayment).
 */

export type DecimalValue = Prisma.Decimal.Value;

/**
 * Safely parse a value into a Prisma.Decimal with 2 decimal places.
 */
export function toDecimal(val: DecimalValue): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) {
    return val;
  }
  const str = typeof val === "number" ? val.toString() : String(val).trim();
  if (!str) return new Prisma.Decimal("0.00");

  // Clean currency symbols, spaces, commas
  const clean = str.replace(/[^\d.-]/g, "");
  if (!clean || isNaN(Number(clean))) return new Prisma.Decimal("0.00");

  return new Prisma.Decimal(clean);
}

/**
 * Format a Decimal to standard fixed 2-decimal string (e.g. "1250000.00")
 */
export function toDecimalString(val: DecimalValue): string {
  return toDecimal(val).toFixed(2);
}

/**
 * Format Decimal for Arabic UI display (e.g. "1,250,000.00 ر.س")
 * Uses string manipulation to avoid floating-point inaccuracies.
 */
export function formatSar(val: DecimalValue): string {
  const d = toDecimal(val);
  const fixed = d.toFixed(2);
  const parts = fixed.split(".");
  const intPart = parts[0] ?? "0";
  const decPart = parts[1] ?? "00";

  // Format integer part with thousands separators
  const isNeg = intPart.startsWith("-");
  const absInt = isNeg ? intPart.slice(1) : intPart;
  const withCommas = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${isNeg ? "-" : ""}${withCommas}.${decPart} ر.س`;
}

/**
 * Split remaining balance into equal installments with exact penny allocation.
 * If there is a remainder from division, it is added to the last installment.
 * Guarantees sum(installments) === (finalPrice - downPayment).
 */
export function calculateInstallments(
  finalPrice: DecimalValue,
  downPayment: DecimalValue,
  count: number,
  startDate: Date = new Date()
): { installmentNumber: number; dueDate: Date; amount: Prisma.Decimal }[] {
  if (count <= 0) {
    throw new Error("Installment count must be greater than 0");
  }

  const finalD = toDecimal(finalPrice);
  const downD = toDecimal(downPayment);
  const totalFinanced = finalD.minus(downD);

  if (totalFinanced.isNegative()) {
    throw new Error("Down payment cannot exceed final price");
  }

  // Multiply by 100 to work in base cents/halalas as BigInt
  const totalCents = BigInt(totalFinanced.times(100).toFixed(0));
  const bigCount = BigInt(count);

  const baseCents = totalCents / bigCount;
  const remainderCents = totalCents % bigCount;

  const result: { installmentNumber: number; dueDate: Date; amount: Prisma.Decimal }[] = [];

  for (let i = 1; i <= count; i++) {
    const isLast = i === count;
    // Add remainder to the last installment
    const installmentCents = isLast ? baseCents + remainderCents : baseCents;
    const amount = new Prisma.Decimal(installmentCents.toString()).dividedBy(100);

    // Monthly due date
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    result.push({
      installmentNumber: i,
      dueDate,
      amount,
    });
  }

  return result;
}

// Backward compatibility helpers for integer halalas if needed
export function decimalToHalalas(d: Prisma.Decimal): bigint {
  return BigInt(d.times(100).toFixed(0));
}

export function sarToHalalas(sarStringOrNumber: string | number): bigint {
  const d = toDecimal(sarStringOrNumber);
  return BigInt(d.times(100).toFixed(0));
}

export function halalasToSarDisplay(halalas: bigint | number | string): string {
  const d = new Prisma.Decimal(halalas.toString()).dividedBy(100);
  return formatSar(d);
}

export function halalasToString(halalas: bigint): string {
  return halalas.toString();
}

export function stringToHalalas(str: string): bigint {
  return BigInt(str || "0");
}
