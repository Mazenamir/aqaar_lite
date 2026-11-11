import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { UnitService } from "@/lib/services/unit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const updateUnitSchema = z.object({
  project: z.string().optional(),
  type: z.string().optional(),
  floor: z.string().optional(),
  area: z.number().int().positive().optional(),
  rooms: z.number().int().positive().optional(),
  priceSar: z.union([z.string(), z.number()]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const { id } = await params;
    const body = await req.json();
    const result = updateUnitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "بيانات غير صالحة" }, { status: 400 });
    }

    const updatedUnit = await UnitService.updateUnit(prisma, {
      companyId: user!.companyId,
      unitId: id,
      updatedById: user!.id,
      ...result.data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUnit.id,
        code: updatedUnit.code,
        priceHalalas: updatedUnit.priceHalalas.toString(),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
