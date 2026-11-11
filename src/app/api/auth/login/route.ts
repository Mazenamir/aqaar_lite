import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { verifyPassword, dummyVerifyPassword } from "@/lib/security/password";
import { loginRateLimiter } from "@/lib/security/rate-limiter";
import { validateOrigin } from "@/lib/security/csrf";

const loginSchema = z.object({
  email: z.string().email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور"),
});

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

    // 2. Extract Client IP for Rate Limiting & Audit Logging
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 3. Rate Limiting Check
    const rateLimit = loginRateLimiter.check(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد ${rateLimit.retryAfterSeconds} ثانية.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }

    // 4. Zod Input Validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "صيغة البيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "يرجى التأكد من صحة البيانات المدخلة" },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // 5. Query user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { company: true },
    });

    // 6. Timing-Safe Password Verification
    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await verifyPassword(user.passwordHash, password);
    } else {
      // Execute dummy Argon2 verify to mitigate timing enumeration attacks
      await dummyVerifyPassword(password);
    }

    // 7. Handle Invalid Credentials (Generic Error Response)
    if (!user || !isPasswordValid) {
      // Record failed attempt in rate limiter
      loginRateLimiter.recordFailedAttempt(clientIp);

      // Audit log failed attempt if tenant user exists
      if (user) {
        await prisma.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: "FAILED_LOGIN",
            entityType: "User",
            entityId: user.id,
            ipAddress: clientIp,
            details: JSON.stringify({ email, reason: "Invalid credentials" }),
          },
        });
      }

      // Strictly generic error response: never reveal whether the email exists
      return NextResponse.json(
        { success: false, error: "بيانات الاعتماد غير صحيحة" },
        { status: 401 }
      );
    }

    // 8. Successful Login: Reset rate limit attempts
    loginRateLimiter.reset(clientIp);

    // 9. Session Fixation Protection: Create new server-side session
    const session = await AuthService.createSession(prisma, user.id, {
      ipAddress: clientIp,
      userAgent,
    });

    // 10. Audit Log Successful Login
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        ipAddress: clientIp,
        details: JSON.stringify({
          email: user.email,
          role: user.role,
          sessionId: session.sessionId,
        }),
      },
    });

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
    console.error("Login processing error:", error);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    );
  }
}
