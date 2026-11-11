import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { UnitService } from "@/lib/services/unit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const querySchema = z.object({
  status: z.enum(["all", "AVAILABLE", "RESERVED", "SOLD"]).optional().default("all"),
  minPriceSar: z.string().optional(),
  maxPriceSar: z.string().optional(),
  sortBy: z.enum(["priceAsc", "priceDesc", "areaAsc", "areaDesc", "newest"]).optional().default("newest"),
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  search: z.string().optional(),
});

const createUnitSchema = z.object({
  project: z.string().min(2, "اسم المشروع مطلوب"),
  code: z.string().min(1, "رقم الوحدة مطلوب"),
  type: z.string().min(2, "نوع الوحدة مطلوب"),
  floor: z.string().min(1, "الطابق مطلوب"),
  area: z.number().int().positive("المساحة يجب أن تكون رقماً موجباً"),
  rooms: z.number().int().positive("عدد الغرف يجب أن يكون رقماً موجباً"),
  priceSar: z.union([z.string(), z.number()]),
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
      return NextResponse.json({ success: false, error: "معاملات البحث غير صالحة" }, { status: 400 });
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
    const result = createUnitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
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
        data: {
          id: unit.id,
          code: unit.code,
          project: unit.project,
          priceHalalas: unit.priceHalalas.toString(),
        },
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
