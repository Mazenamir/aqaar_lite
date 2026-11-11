import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ContractService } from "@/lib/services/contract.service";
import { sarToHalalas } from "@/lib/money";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

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

    const contracts = await ContractService.listContracts(prisma, user.companyId);

    return NextResponse.json({ success: true, data: contracts });
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

    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    const contract = await ContractService.createDraft(prisma, {
      companyId: user!.companyId,
      reservationId,
      createdById: user!.id,
      userRole: user!.role,
      discountPercent,
      downPaymentHalalas,
      installmentCount,
      startDate: parsedStartDate,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          finalPrice: contract.finalPrice.toFixed(2),
          status: contract.status,
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
