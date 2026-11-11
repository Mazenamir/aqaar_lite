import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { validateOrigin } from "@/lib/security/csrf";

export async function POST(req: Request) {
  try {
    // 1. CSRF & Origin Validation
    const csrfCheck = validateOrigin(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { success: false, error: "طلب غير مصرح به (CSRF)" },
        { status: 403 }
      );
    }

    // 2. Fetch current user before invalidation for audit trail
    const user = await AuthService.getCurrentUser(prisma);

    // 3. Invalidate session in PostgreSQL and delete cookie
    await AuthService.destroySession(prisma);

    // 4. Audit Log
    if (user) {
      await prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: "LOGOUT",
          entityType: "User",
          entityId: user.id,
          details: JSON.stringify({ email: user.email }),
        },
      });
    }

    return NextResponse.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تسجيل الخروج" },
      { status: 500 }
    );
  }
}
