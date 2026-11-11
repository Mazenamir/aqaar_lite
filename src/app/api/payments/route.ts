import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import { sarToHalalas } from "@/lib/money";
import { PaymentMethod } from "@prisma/client";

const recordPaymentSchema = z.object({
  contractId: z.string().min(1, "معرف العقد مطلوب"),
  amountSar: z.union([z.string(), z.number()]),
  method: z.enum(["SADAD", "MADA", "BANK_TRANSFER", "CASH", "CHEQUE"]).default("SADAD"),
  idempotencyKey: z.string().min(8, "مفتاح منع التكرار مطلوب"),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          include: {
            unit: true,
            client: true,
          },
        },
        createdBy: {
          select: { name: true },
        },
        allocations: {
          include: {
            installment: true,
          },
        },
      },
    });

    const formatted = payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      contractNumber: p.contract.contractNumber,
      unitCode: p.contract.unit.code,
      clientName: p.contract.client.name,
      amountHalalas: p.amountHalalas.toString(),
      amountSar: (Number(p.amountHalalas) / 100).toLocaleString("ar-SA"),
      method: p.method,
      notes: p.notes || "",
      createdByName: p.createdBy.name,
      createdAt: p.createdAt.toISOString(),
      allocations: p.allocations.map((a) => ({
        installmentNumber: a.installment.installmentNumber,
        allocatedAmountSar: (Number(a.amountHalalas) / 100).toLocaleString("ar-SA"),
      })),
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل استرجاع المدفوعات" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["ACCOUNTANT"]);

    const body = await req.json();
    const result = recordPaymentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const { contractId, amountSar, method, idempotencyKey, notes } = result.data;
    const amountHalalas = sarToHalalas(amountSar);

    const paymentResult = await PaymentService.recordPayment(prisma, {
      companyId: user!.companyId,
      contractId,
      createdById: user!.id,
      amountHalalas,
      method: method as PaymentMethod,
      idempotencyKey,
      notes,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: paymentResult.payment.id,
          receiptNumber: paymentResult.payment.receiptNumber,
          isDuplicate: paymentResult.isDuplicate,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل تسجيل الدفعة" }, { status: 400 });
  }
}
