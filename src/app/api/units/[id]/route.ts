import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { UnitService } from "@/lib/services/unit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";
import { stripMassAssignmentFields } from "@/lib/security/rbac";

const updateUnitSchema = z.object({
  projectName: z.string().optional(),
  project: z.string().optional(),
  unitNumber: z.string().optional(),
  code: z.string().optional(),
  type: z.string().optional(),
  floor: z.string().optional(),
  area: z.number().int().positive("المساحة يجب أن تكون رقماً موجباً").optional(),
  rooms: z.number().int().positive("عدد الغرف يجب أن يكون رقماً موجباً").optional(),
  price: z.union([z.string(), z.number()]).optional(),
  priceSar: z.union([z.string(), z.number()]).optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const unit = await UnitService.getUnitById(prisma, user.companyId, id);

    return NextResponse.json({
      success: true,
      data: unit,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const { id } = await params;
    const body = await req.json();

    const sanitizedBody = stripMassAssignmentFields(body, ["companyId", "role", "createdById", "id"]);
    const result = updateUnitSchema.safeParse(sanitizedBody);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const updatedUnit = await UnitService.updateUnit(prisma, {
      companyId: user!.companyId,
      unitId: id,
      updatedById: user!.id,
      ...result.data,
    });

    return NextResponse.json({
      success: true,
      data: updatedUnit,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
