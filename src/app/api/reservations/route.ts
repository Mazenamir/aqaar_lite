import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ReservationService } from "@/lib/services/reservation.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const reservations = await ReservationService.listActiveReservations(
      prisma,
      user.companyId,
      user.id,
      user.role
    );

    return NextResponse.json({ success: true, data: reservations });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
