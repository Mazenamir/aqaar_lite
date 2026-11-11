import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { UnitService } from "@/lib/services/unit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";
import { stripMassAssignmentFields } from "@/lib/security/rbac";

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

const createUnitSchema = z
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

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: parsedQuery.error.issues[0]?.message || "معاملات البحث غير صالحة" },
        { status: 400 }
      );
    }

    const result = await UnitService.listUnits(prisma, user.companyId, parsedQuery.data);

    return NextResponse.json({
      success: true,
      data: result.units,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const body = await req.json();
    const sanitizedBody = stripMassAssignmentFields(body);

    const result = createUnitSchema.safeParse(sanitizedBody);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات الوحدة غير صالحة" },
        { status: 400 }
      );
    }

    const unit = await UnitService.createUnit(prisma, {
      companyId: user!.companyId,
      createdById: user!.id,
      ...result.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: unit,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
