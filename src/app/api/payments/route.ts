import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import { sarToHalalas } from "@/lib/money";
import { PaymentMethod } from "@prisma/client";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

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

    const payments = await PaymentService.listPayments(prisma, user.companyId);

    return NextResponse.json({ success: true, data: payments });
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
          amount: paymentResult.payment.amount.toFixed(2),
          isDuplicate: paymentResult.isDuplicate,
        },
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
