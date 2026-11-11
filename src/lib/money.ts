/**
 * Strict Monetary Utility
 * Mandated by PDF Rule: "المبالغ لا تُمثّل بـ float في أي مكان: لا في قاعدة البيانات ولا في الكود ولا في JSON."
 * All monetary amounts are handled strictly as integer halalas (1 SAR = 100 Halalas).
 */

export function sarToHalalas(sarStringOrNumber: string | number): bigint {
  const str = typeof sarStringOrNumber === "number" ? sarStringOrNumber.toString() : sarStringOrNumber.trim();
  if (!str) return BigInt(0);

  // Clean currency symbols, spaces, commas
  const clean = str.replace(/[^\d.-]/g, "");
  if (!clean || isNaN(Number(clean))) return BigInt(0);

  const parts = clean.split(".");
  const integerPart = BigInt(parts[0] || "0");
  const decimalPartStr = (parts[1] || "").slice(0, 2).padEnd(2, "0");
  const decimalPart = BigInt(decimalPartStr);

  const sign = clean.startsWith("-") ? -1n : 1n;
  const absInteger = integerPart < 0n ? -integerPart : integerPart;

  return sign * (absInteger * 100n + decimalPart);
}

export function halalasToSarDisplay(halalas: bigint | number | string, includeFractions = false): string {
  const h = typeof halalas === "bigint" ? halalas : BigInt(halalas || 0);
  const isNegative = h < 0n;
  const absH = isNegative ? -h : h;

  const whole = absH / 100n;
  const fraction = absH % 100n;

  const formattedWhole = whole.toLocaleString("ar-SA");

  if (includeFractions && fraction > 0n) {
    const fractionStr = fraction.toString().padStart(2, "0");
    return `${isNegative ? "-" : ""}${formattedWhole}.${fractionStr} ر.س`;
  }

  return `${isNegative ? "-" : ""}${formattedWhole} ر.س`;
}

export function halalasToString(halalas: bigint): string {
  return halalas.toString();
}

export function stringToHalalas(str: string): bigint {
  return BigInt(str || "0");
}
