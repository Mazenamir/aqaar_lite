import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import { sarToHalalas } from "@/lib/money";
import { PaymentMethod } from "@prisma/client";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const recordPaymentSchema = z.object({
  contractId: z.string().uuid("معرف العقد غير صالح"),
  amountSar: z.union([z.string(), z.number()]),
  method: z.enum(["SADAD", "MADA", "BANK_TRANSFER", "CASH", "CHEQUE"]).default("BANK_TRANSFER"),
  idempotencyKey: z.string().min(4, "مفتاح منع التكرار مطلوب").optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN", "ACCOUNTANT", "SALES_AGENT"]);

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contractId") || undefined;

    const payments = await PaymentService.listPayments(prisma, user!.companyId, {
      contractId,
      user: user!,
    });

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

    // Idempotency-Key can come from HTTP header or request body
    const headerIdempotency = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
    const idempotencyKey = (headerIdempotency || result.data.idempotencyKey || "").trim();

    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "مفتاح منع التكرار (Idempotency-Key) مطلوب إما في الترويسة أو البيانات" },
        { status: 400 }
      );
    }

    const { contractId, amountSar, method, notes } = result.data;
    const amountHalalas = sarToHalalas(amountSar);

    const paymentResult = await PaymentService.recordPayment(prisma, {
      companyId: user!.companyId,
      contractId,
      createdById: user!.id,
      userRole: user!.role,
      amountHalalas,
      method: method as PaymentMethod,
      idempotencyKey,
      notes,
    });

    return NextResponse.json(
      {
        success: true,
        data: paymentResult.payment,
        isDuplicate: paymentResult.isDuplicate,
      },
      { status: paymentResult.isDuplicate ? 200 : 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

// Payment Immutability: Payments cannot be edited or deleted
export async function PUT() {
  return NextResponse.json(
    { success: false, error: "سندات القبض والدفعات المالية غير قابلة للتعديل أو الحذف" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: "سندات القبض والدفعات المالية غير قابلة للتعديل أو الحذف" },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: "سندات القبض والدفعات المالية غير قابلة للتعديل أو الحذف" },
    { status: 405 }
  );
}
