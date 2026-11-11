import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ContractService } from "@/lib/services/contract.service";
import { sarToHalalas } from "@/lib/money";

const draftContractSchema = z.object({
  reservationId: z.string().min(1, "معرف الحجز مطلوب"),
  discountPercent: z.number().int().min(0).max(5, "الخصم لا يمكن أن يتجاوز 5%"),
  downPaymentSar: z.union([z.string(), z.number()]),
  installmentCount: z.number().int().min(1).max(120, "عدد الأقساط يجب أن يكون بين 1 و 120"),
  startDate: z.string().optional(),
});

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const contracts = await prisma.contract.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        client: true,
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        installments: { orderBy: { installmentNumber: "asc" } },
        payments: true,
      },
    });

    const now = new Date();

    const formatted = contracts.map((c) => {
      const totalPaid = c.payments.reduce((sum, p) => sum + p.amountHalalas, 0n);
      const remainingBalance = (c.finalPriceHalalas - c.downPaymentHalalas) - totalPaid;

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        status: c.status,
        unit: {
          id: c.unit.id,
          code: c.unit.code,
          project: c.unit.project,
          type: c.unit.type,
        },
        client: {
          id: c.client.id,
          name: c.client.name,
          phone: c.client.phone,
        },
        createdBy: c.createdBy.name,
        approvedBy: c.approvedBy?.name || null,
        approvedAt: c.approvedAt?.toISOString() || null,
        startDate: c.startDate.toISOString().split("T")[0],
        discountPercent: c.discountPercent,
        unitPriceHalalas: c.unitPriceHalalas.toString(),
        finalPriceHalalas: c.finalPriceHalalas.toString(),
        finalPriceSar: (Number(c.finalPriceHalalas) / 100).toLocaleString("ar-SA"),
        downPaymentHalalas: c.downPaymentHalalas.toString(),
        downPaymentSar: (Number(c.downPaymentHalalas) / 100).toLocaleString("ar-SA"),
        totalPaidHalalas: totalPaid.toString(),
        totalPaidSar: (Number(totalPaid) / 100).toLocaleString("ar-SA"),
        remainingBalanceHalalas: remainingBalance.toString(),
        remainingBalanceSar: (Number(remainingBalance) / 100).toLocaleString("ar-SA"),
        installments: c.installments.map((inst) => {
          // Check if overdue: dueDate in past & not paid
          const isOverdue = inst.status !== "PAID" && inst.dueDate < now;

          return {
            id: inst.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate.toISOString().split("T")[0],
            amountHalalas: inst.amountHalalas.toString(),
            amountSar: (Number(inst.amountHalalas) / 100).toLocaleString("ar-SA"),
            paidAmountHalalas: inst.paidAmountHalalas.toString(),
            paidAmountSar: (Number(inst.paidAmountHalalas) / 100).toLocaleString("ar-SA"),
            status: isOverdue ? "OVERDUE" : inst.status,
            paidAt: inst.paidAt?.toISOString() || null,
          };
        }),
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل استرجاع العقود" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["SALES_AGENT"]);

    const body = await req.json();
    const result = draftContractSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const { reservationId, discountPercent, downPaymentSar, installmentCount, startDate } = result.data;
    const downPaymentHalalas = sarToHalalas(downPaymentSar);

    const contract = await ContractService.createDraft(prisma, {
      companyId: user!.companyId,
      reservationId,
      createdById: user!.id,
      discountPercent,
      downPaymentHalalas,
      installmentCount,
      startDate: startDate ? new Date(startDate) : new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          finalPriceHalalas: contract.finalPriceHalalas.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل إنشاء مسودة العقد" }, { status: 400 });
  }
}
