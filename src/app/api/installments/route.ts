import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { UserRole, InstallmentStatus } from "@prisma/client";
import { formatSar, decimalToHalalas } from "@/lib/money";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    const where: any = {
      contract: {
        companyId: user.companyId,
        status: { in: ["APPROVED", "COMPLETED"] },
        ...(user.role === UserRole.SALES_AGENT ? { createdById: user.id } : {}),
      },
    };

    if (search) {
      where.OR = [
        { contract: { contractNumber: { contains: search, mode: "insensitive" } } },
        { contract: { client: { name: { contains: search, mode: "insensitive" } } } },
        { contract: { unit: { code: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const now = new Date();

    const installments = await prisma.installment.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            client: { select: { id: true, name: true, phone: true } },
            unit: { select: { id: true, code: true, project: true } },
          },
        },
      },
      orderBy: [
        { dueDate: "asc" },
        { installmentNumber: "asc" },
      ],
    });

    const mapped = installments.map((inst) => {
      const amountHalalas = decimalToHalalas(inst.amount);
      const paidHalalas = decimalToHalalas(inst.paidAmount);
      const remainingHalalas = amountHalalas - paidHalalas;
      const isOverdue = inst.status !== InstallmentStatus.PAID && new Date(inst.dueDate) < now;

      let effectiveStatus = inst.status as string;
      if (isOverdue && inst.status !== InstallmentStatus.PAID) {
        effectiveStatus = "OVERDUE";
      }

      return {
        id: inst.id,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate.toISOString().split("T")[0],
        amountSar: formatSar(inst.amount),
        amountHalalas: amountHalalas.toString(),
        paidAmountSar: formatSar(inst.paidAmount),
        paidAmountHalalas: paidHalalas.toString(),
        remainingAmountSar: formatSar(inst.amount.minus(inst.paidAmount)),
        remainingAmountHalalas: remainingHalalas.toString(),
        status: effectiveStatus,
        isOverdue,
        contractId: inst.contract.id,
        contractNumber: inst.contract.contractNumber,
        contractStatus: inst.contract.status,
        clientName: inst.contract.client.name,
        clientPhone: inst.contract.client.phone,
        unitCode: inst.contract.unit.code,
        unitProject: inst.contract.unit.project,
      };
    });

    const filtered = statusParam === "all"
      ? mapped
      : mapped.filter((item) => item.status === statusParam);

    return NextResponse.json({
      success: true,
      data: filtered,
      totalCount: filtered.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
