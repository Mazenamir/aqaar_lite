import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ReservationService } from "@/lib/services/reservation.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";
import { stripMassAssignmentFields } from "@/lib/security/rbac";

const createReservationSchema = z.object({
  unitId: z.string().min(1, "يرجى تحديد الوحدة العقارية المراد حجزها"),
  clientId: z.string().min(1, "يرجى اختيار العميل المسجل"),
});

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ACTIVE";

    const reservations = await ReservationService.listReservations(
      prisma,
      user.companyId,
      user.id,
      user.role,
      status
    );

    return NextResponse.json({ success: true, data: reservations });
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
    // Mandated by Phase 5 requirements: Only SALES users can reserve units
    AuthService.requireRole(user, ["SALES_AGENT"]);

    const body = await req.json();
    const sanitized = stripMassAssignmentFields(body, ["companyId", "role", "createdById", "salesRepId", "id", "status"]);

    const result = createReservationSchema.safeParse(sanitized);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات الحجز غير صالحة" },
        { status: 400 }
      );
    }

    const reservation = await ReservationService.createReservation(prisma, {
      companyId: user!.companyId,
      unitId: result.data.unitId,
      clientId: result.data.clientId,
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
