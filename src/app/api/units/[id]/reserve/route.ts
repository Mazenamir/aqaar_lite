import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ReservationService } from "@/lib/services/reservation.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const reserveSchema = z.object({
  clientId: z.string().min(1, "يرجى اختيار العميل"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["SALES_AGENT"]);

    const { id: unitId } = await params;
    const body = await req.json();
    const result = reserveSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "بيانات غير صالحة" }, { status: 400 });
    }

    const { clientId } = result.data;

    const reservation = await ReservationService.createReservation(prisma, {
      companyId: user!.companyId,
      unitId,
      clientId,
      createdById: user!.id,
      userRole: user!.role,
    });

    return NextResponse.json(
      {
        success: true,
        data: reservation,
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
