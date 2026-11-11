import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ReservationService } from "@/lib/services/reservation.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const cancelled = await ReservationService.cancelReservation(
      prisma,
      user.companyId,
      id,
      user.id,
      user.role
    );

    return NextResponse.json({
      success: true,
      message: "تم إلغاء الحجز وإعادة الوحدة إلى متاحة بنجاح",
      data: cancelled,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
