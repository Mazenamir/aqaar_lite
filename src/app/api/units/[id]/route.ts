import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { sarToHalalas } from "@/lib/money";
import { UnitStatus } from "@prisma/client";

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

    const unit = await prisma.unit.findFirst({
      where: {
        id,
        companyId: user!.companyId,
      },
    });

    if (!unit) {
      return NextResponse.json({ success: false, error: "الوحدة غير موجودة أو غير تابعة للشركة" }, { status: 404 });
    }

    const updateData: any = {};
    const { project, type, floor, area, rooms, priceSar } = result.data;

    if (project) updateData.project = project;
    if (type) updateData.type = type;
    if (floor) updateData.floor = floor;
    if (area) updateData.area = area;
    if (rooms) updateData.rooms = rooms;

    // Price change validation (Mandated by PDF)
    if (priceSar !== undefined) {
      if (unit.status !== UnitStatus.AVAILABLE) {
        return NextResponse.json(
          { success: false, error: "لا يجوز تعديل سعر وحدة محجوزة أو مباعة" },
          { status: 400 }
        );
      }

      const newPriceHalalas = sarToHalalas(priceSar);
      if (newPriceHalalas <= 0n) {
        return NextResponse.json({ success: false, error: "السعر يجب أن يكون أكبر من صفر" }, { status: 400 });
      }

      if (newPriceHalalas !== unit.priceHalalas) {
        updateData.priceHalalas = newPriceHalalas;

        // Mandated by PDF: كل تغيير سعر يُسجّل في سجل التدقيق
        await prisma.auditLog.create({
          data: {
            companyId: user!.companyId,
            userId: user!.id,
            action: "PRICE_CHANGE",
            entityType: "Unit",
            entityId: unit.id,
            details: JSON.stringify({
              unitCode: unit.code,
              oldPriceHalalas: unit.priceHalalas.toString(),
              newPriceHalalas: newPriceHalalas.toString(),
            }),
          },
        });
      }
    }

    const updatedUnit = await prisma.unit.update({
      where: { id: unit.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUnit.id,
        code: updatedUnit.code,
        priceHalalas: updatedUnit.priceHalalas.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل تعديل الوحدة" }, { status: 400 });
  }
}
