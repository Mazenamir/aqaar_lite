import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";

const createClientSchema = z.object({
  name: z.string().min(2, "اسم العميل مطلوب"),
  phone: z.string().min(8, "رقم الهاتف مطلوب"),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Agent isolation rule: Sales agent ONLY sees their own clients
    const where: any = {
      companyId: user.companyId,
    };

    if (user.role === "SALES_AGENT") {
      where.createdById = user.id;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true },
        },
        reservations: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
        contracts: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: clients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes || "",
        createdByName: c.createdBy.name,
        activeReservationsCount: c.reservations.length,
        contractsCount: c.contracts.length,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل استرجاع العملاء" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["SALES_AGENT", "COMPANY_ADMIN"]);

    const body = await req.json();
    const result = createClientSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "بيانات العميل غير صحيحة" }, { status: 400 });
    }

    const { name, phone, notes } = result.data;

    const client = await prisma.client.create({
      data: {
        companyId: user!.companyId,
        createdById: user!.id,
        name,
        phone,
        notes: notes || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: client,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل إضافة العميل" }, { status: 400 });
  }
}
