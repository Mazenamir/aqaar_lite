import { describe, it, expect } from "vitest";

describe("Contract & Financial Integrity Invariants", () => {
  function validateContractParameters(
    unitPriceHalalas: bigint,
    discountPercent: number,
    downPaymentHalalas: bigint
  ) {
    if (discountPercent < 0 || discountPercent > 5) {
      throw new Error("نسبة الخصم المسموح بها يجب أن تتراوح بين 0% و 5% كحد أقصى");
    }

    const discountHalalas = (unitPriceHalalas * BigInt(discountPercent)) / 100n;
    const finalPriceHalalas = unitPriceHalalas - discountHalalas;

    if (downPaymentHalalas >= finalPriceHalalas) {
      throw new Error("الدفعة الأولى لا يمكن أن تساوي أو تتجاوز السعر النهائي للوحدة");
    }

    return {
      discountHalalas,
      finalPriceHalalas,
      remainingHalalas: finalPriceHalalas - downPaymentHalalas,
    };
  }

  it("should enforce the strict 5% discount ceiling and reject discounts greater than 5%", () => {
    const unitPrice = 100000000n; // 1,000,000 SAR in Halalas
    const downPayment = 20000000n; // 200,000 SAR

    // Valid discounts (0% to 5%)
    expect(() => validateContractParameters(unitPrice, 0, downPayment)).not.toThrow();
    expect(() => validateContractParameters(unitPrice, 5, downPayment)).not.toThrow();

    const valid5Result = validateContractParameters(unitPrice, 5, downPayment);
    expect(valid5Result.discountHalalas).toBe(5000000n); // 50,000 SAR
    expect(valid5Result.finalPriceHalalas).toBe(95000000n); // 950,000 SAR

    // Invalid discounts (> 5% or negative)
    expect(() => validateContractParameters(unitPrice, 6, downPayment)).toThrow("نسبة الخصم المسموح بها");
    expect(() => validateContractParameters(unitPrice, 10, downPayment)).toThrow("نسبة الخصم المسموح بها");
    expect(() => validateContractParameters(unitPrice, -1, downPayment)).toThrow("نسبة الخصم المسموح بها");
  });

  it("should reject down payments that equal or exceed the final price", () => {
    const unitPrice = 100000000n;

    // Down payment equals final price
    expect(() => validateContractParameters(unitPrice, 0, 100000000n)).toThrow("الدفعة الأولى");

    // Down payment exceeds final price
    expect(() => validateContractParameters(unitPrice, 0, 100000001n)).toThrow("الدفعة الأولى");
  });

  it("should verify unit price updates are forbidden for non-AVAILABLE units", () => {
    function canUpdateUnitPrice(status: "AVAILABLE" | "RESERVED" | "SOLD"): boolean {
      if (status !== "AVAILABLE") {
        throw new Error("لا يجوز تعديل سعر وحدة محجوزة أو مباعة");
      }
      return true;
    }

    expect(() => canUpdateUnitPrice("AVAILABLE")).not.toThrow();
    expect(() => canUpdateUnitPrice("RESERVED")).toThrow("لا يجوز تعديل سعر وحدة محجوزة أو مباعة");
    expect(() => canUpdateUnitPrice("SOLD")).toThrow("لا يجوز تعديل سعر وحدة محجوزة أو مباعة");
  });
});
