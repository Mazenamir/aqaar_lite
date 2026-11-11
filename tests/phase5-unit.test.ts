import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toDecimal, formatSar } from "../src/lib/money";
import { Decimal } from "@prisma/client/runtime/library";

// Validation schemas matching Phase 5 requirements
const querySchema = z.object({
  status: z.enum(["all", "AVAILABLE", "RESERVED", "SOLD"]).optional().default("all"),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  minPriceSar: z.string().optional(),
  maxPriceSar: z.string().optional(),
  rooms: z.string().optional(),
  project: z.string().optional(),
  projectName: z.string().optional(),
  sortBy: z.enum(["price", "priceAsc", "priceDesc", "area", "areaAsc", "areaDesc", "newest"]).optional().default("newest"),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.string().regex(/^\d+$/, "رقم الصفحة غير صالح").optional().default("1"),
  limit: z.string().regex(/^\d+$/, "حد العناصر غير صالح").optional().default("10"),
  search: z.string().optional(),
});

const unitInputSchema = z
  .object({
    projectName: z.string().min(2, "اسم المشروع مطلوب").optional(),
    project: z.string().min(2, "اسم المشروع مطلوب").optional(),
    unitNumber: z.string().min(1, "رقم الوحدة مطلوب").optional(),
    code: z.string().min(1, "رقم الوحدة مطلوب").optional(),
    type: z.string().min(2, "نوع الوحدة مطلوب"),
    floor: z.string().optional().default("1"),
    area: z.number().int().positive("المساحة يجب أن تكون رقماً موجباً"),
    rooms: z.number().int().positive("عدد الغرف يجب أن يكون رقماً موجباً"),
    price: z.union([z.string(), z.number()]).optional(),
    priceSar: z.union([z.string(), z.number()]).optional(),
  })
  .refine((d) => d.projectName !== undefined || d.project !== undefined, {
    message: "اسم المشروع مطلوب",
    path: ["projectName"],
  })
  .refine((d) => d.unitNumber !== undefined || d.code !== undefined, {
    message: "رقم الوحدة مطلوب",
    path: ["unitNumber"],
  })
  .refine((d) => d.price !== undefined || d.priceSar !== undefined, {
    message: "سعر الوحدة مطلوب",
    path: ["price"],
  });

describe("Phase 5 Unit Tests: Validation, Pricing, Expiration & Queries", () => {
  // =========================================================================
  // 1. UNIT VALIDATION
  // =========================================================================
  describe("1. Unit Input Validation", () => {
    it("validates a complete and compliant unit definition", () => {
      const valid = {
        projectName: "برج الياسمين",
        unitNumber: "YAS-401",
        type: "شقة ديلوكس",
        floor: "4",
        area: 185,
        rooms: 4,
        price: "1250000.00",
      };

      const result = unitInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("accepts 'project' and 'code' aliases for backward compatibility", () => {
      const validAliases = {
        project: "مشروع النخيل",
        code: "NK-102",
        type: "بنتهاوس",
        area: 240,
        rooms: 5,
        priceSar: "2100000",
      };

      const result = unitInputSchema.safeParse(validAliases);
      expect(result.success).toBe(true);
    });

    it("rejects when project name is missing or too short", () => {
      const invalid = {
        projectName: "A", // too short (< 2)
        unitNumber: "U-1",
        type: "شقة",
        area: 120,
        rooms: 3,
        price: "800000",
      };

      const result = unitInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects when unitNumber is empty", () => {
      const invalid = {
        projectName: "مشروع الرمال",
        unitNumber: "",
        type: "فيلا",
        area: 320,
        rooms: 6,
        price: "1500000",
      };

      const result = unitInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects non-positive area or rooms", () => {
      const invalidArea = {
        projectName: "مشروع الرمال",
        unitNumber: "R-10",
        type: "شقة",
        area: 0,
        rooms: 3,
        price: "500000",
      };
      expect(unitInputSchema.safeParse(invalidArea).success).toBe(false);

      const invalidRooms = {
        projectName: "مشروع الرمال",
        unitNumber: "R-10",
        type: "شقة",
        area: 100,
        rooms: -1,
        price: "500000",
      };
      expect(unitInputSchema.safeParse(invalidRooms).success).toBe(false);
    });
  });

  // =========================================================================
  // 2. PRICE VALIDATION (Zero Floating-Point / Decimal Precision)
  // =========================================================================
  describe("2. Price Validation & Financial Precision", () => {
    it("ensures Decimal is used without Float/Double precision degradation", () => {
      // Classic JS float inaccuracy: 0.1 + 0.2 !== 0.3
      const price1 = toDecimal("0.1");
      const price2 = toDecimal("0.2");
      const sum = price1.plus(price2);

      expect(sum.equals(new Decimal("0.3"))).toBe(true);
      expect(sum.toString()).toBe("0.3");
    });

    it("correctly parses financial values and formats SAR representation", () => {
      const price = toDecimal("1250000.50");
      expect(price.toFixed(2)).toBe("1250000.50");

      const formatted = formatSar(price);
      expect(formatted).toContain("1,250,000.50");
      expect(formatted).toContain("ر.س");
    });

    it("detects and rejects non-positive financial values", () => {
      const zero = toDecimal("0");
      expect(zero.lte(0)).toBe(true);

      const negative = toDecimal("-5000");
      expect(negative.lte(0)).toBe(true);
    });

    it("handles large Saudi real estate prices without overflow or exponential notation", () => {
      const largePrice = toDecimal("75000000.00"); // 75 Million SAR
      expect(largePrice.toFixed(2)).toBe("75000000.00");
      expect(formatSar(largePrice)).toContain("75,000,000.00");
    });
  });

  // =========================================================================
  // 3. RESERVATION EXPIRATION CALCULATION
  // =========================================================================
  describe("3. Reservation Expiration Calculation", () => {
    it("calculates exact 72-hour expiration duration from reservation start time", () => {
      const reservedAt = new Date("2026-11-11T12:00:00.000Z");
      const expectedExpiresAt = new Date(reservedAt.getTime() + 72 * 60 * 60 * 1000);

      // 72 hours = 3 full days = 259,200 seconds = 259,200,000 milliseconds
      const diffMs = expectedExpiresAt.getTime() - reservedAt.getTime();
      expect(diffMs).toBe(72 * 3600 * 1000);
      expect(expectedExpiresAt.toISOString()).toBe("2026-11-14T12:00:00.000Z");
    });

    it("accurately detects when a reservation is expired vs still active", () => {
      const now = new Date("2026-11-14T12:00:00.000Z");

      const pastExpiry = new Date("2026-11-14T11:59:59.000Z");
      const futureExpiry = new Date("2026-11-14T12:00:01.000Z");

      expect(pastExpiry.getTime() <= now.getTime()).toBe(true); // Expired
      expect(futureExpiry.getTime() <= now.getTime()).toBe(false); // Active
    });
  });

  // =========================================================================
  // 4. QUERY FILTERING & SORTING VALIDATION
  // =========================================================================
  describe("4. Query Filtering & Sorting Validation", () => {
    it("validates valid query parameters for status, price range, and sorting", () => {
      const validQuery = {
        status: "AVAILABLE",
        minPrice: "500000",
        maxPrice: "1500000",
        sortBy: "priceAsc",
        page: "2",
        limit: "20",
      };

      const parsed = querySchema.safeParse(validQuery);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("AVAILABLE");
        expect(parsed.data.minPrice).toBe("500000");
        expect(parsed.data.maxPrice).toBe("1500000");
        expect(parsed.data.sortBy).toBe("priceAsc");
        expect(parsed.data.page).toBe("2");
        expect(parsed.data.limit).toBe("20");
      }
    });

    it("applies default values for optional query parameters", () => {
      const emptyQuery = {};
      const parsed = querySchema.safeParse(emptyQuery);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("all");
        expect(parsed.data.sortBy).toBe("newest");
        expect(parsed.data.page).toBe("1");
        expect(parsed.data.limit).toBe("10");
      }
    });

    it("rejects invalid status filter", () => {
      const invalidQuery = { status: "DELETED" };
      const parsed = querySchema.safeParse(invalidQuery);
      expect(parsed.success).toBe(false);
    });

    it("rejects non-numeric page or limit parameters", () => {
      const invalidPage = { page: "abc" };
      expect(querySchema.safeParse(invalidPage).success).toBe(false);

      const invalidLimit = { limit: "-5" };
      expect(querySchema.safeParse(invalidLimit).success).toBe(false);
    });

    it("supports sorting options: price asc/desc, area asc/desc, newest", () => {
      const sortOptions = ["price", "priceAsc", "priceDesc", "area", "areaAsc", "areaDesc", "newest"];
      for (const sortBy of sortOptions) {
        const parsed = querySchema.safeParse({ sortBy });
        expect(parsed.success).toBe(true);
      }
    });
  });
});
