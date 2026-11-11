import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ContractService } from "@/lib/services/contract.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["ACCOUNTANT"]);

    const { id } = await params;

    const contract = await ContractService.approveContract(prisma, {
      companyId: user!.companyId,
      contractId: id,
      approvedById: user!.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
