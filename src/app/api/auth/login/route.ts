import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "يرجى التأكد من صحة البيانات المدخلة" },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    // Timing-safe check & generic error message (Mandated by PDF)
    const isPasswordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      // Record failed attempt in audit log if company can be identified
      if (user) {
        await prisma.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: "FAILED_LOGIN",
            entityType: "User",
            entityId: user.id,
            details: JSON.stringify({ email, reason: "Invalid password" }),
          },
        });
      }

      // Generic error: never reveal if email exists or not
      return NextResponse.json(
        { success: false, error: "بيانات الاعتماد غير صحيحة" },
        { status: 401 }
      );
    }

    // Create session & set HttpOnly cookie
    await AuthService.createSession(prisma, user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyName: user.company.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    );
  }
}
