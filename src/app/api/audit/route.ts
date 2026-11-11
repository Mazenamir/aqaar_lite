import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { AuditService } from "@/lib/services/audit.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const logs = await AuditService.listAuditLogs(prisma, user!.companyId);

    return NextResponse.json({ success: true, data: logs });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
