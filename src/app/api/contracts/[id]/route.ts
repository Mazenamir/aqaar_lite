import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ContractService } from "@/lib/services/contract.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const paramSchema = z.object({
  id: z.string().uuid("معرف العقد غير صالح"),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN", "SALES_AGENT", "ACCOUNTANT"]);

    const resolvedParams = await params;
    const parseResult = paramSchema.safeParse(resolvedParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message || "معرف غير صالح" },
        { status: 400 }
      );
    }

    const { id } = parseResult.data;

    const contract = await ContractService.getContractById(
      prisma,
      user!.companyId,
      id,
      user!
    );

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
