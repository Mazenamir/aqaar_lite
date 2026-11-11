import { cookies } from "next/headers";
import { PrismaClient, UserRole } from "@prisma/client";
import { addDays } from "date-fns";

const SESSION_COOKIE_NAME = "aqar_session_token";

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  name: string;
  role: UserRole;
}

export class AuthService {
  /**
   * Creates a persistent server-side session and sets an HttpOnly Secure cookie.
   */
  public static async createSession(prisma: PrismaClient, userId: string): Promise<string> {
    const expiresAt = addDays(new Date(), 7); // 7 days session

    const session = await prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return session.id;
  }

  /**
   * Destroys session in database (server-side invalidation) and clears cookie.
   */
  public static async destroySession(prisma: PrismaClient): Promise<void> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      await prisma.session.deleteMany({
        where: { id: sessionId },
      });
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
  }

  /**
   * Retrieves the authenticated user strictly from the verified session in database.
   * Guarantees tenant isolation: companyId is always derived from server session, NEVER client parameters.
   */
  public static async getCurrentUser(prisma: PrismaClient): Promise<AuthenticatedUser | null> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) return null;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: { company: true },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return {
      id: session.user.id,
      companyId: session.user.companyId,
      companyName: session.user.company.name,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  }

  /**
   * Enforces role authorization strictly on the server.
   */
  public static requireRole(user: AuthenticatedUser | null, allowedRoles: UserRole[]): AuthenticatedUser {
    if (!user) {
      throw new Error("UNAUTHORIZED: يرجى تسجيل الدخول أولاً");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new Error("FORBIDDEN: ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء");
    }

    return user;
  }
}
