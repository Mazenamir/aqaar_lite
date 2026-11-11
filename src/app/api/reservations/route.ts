import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ReservationService } from "@/lib/services/reservation.service";

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Auto-expire
    await ReservationService.autoExpireReservations(prisma, user.companyId);

    const where: any = {
      companyId: user.companyId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      // Not yet converted to an active or pending contract
      contracts: {
        none: {
          status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
        },
      },
    };

    if (user.role === "SALES_AGENT") {
      where.createdById = user.id;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        client: true,
        createdBy: { select: { name: true } },
      },
    });

    const formatted = reservations.map((r) => ({
      id: r.id,
      expiresAt: r.expiresAt.toISOString(),
      unit: {
        id: r.unit.id,
        code: r.unit.code,
        project: r.unit.project,
        type: r.unit.type,
        priceHalalas: r.unit.priceHalalas.toString(),
        priceSar: (Number(r.unit.priceHalalas) / 100).toLocaleString("ar-SA"),
        rawPriceNumber: Number(r.unit.priceHalalas) / 100,
      },
      client: {
        id: r.client.id,
        name: r.client.name,
        phone: r.client.phone,
      },
      agentName: r.createdBy.name,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل استرجاع الحجوزات" }, { status: 500 });
  }
}
