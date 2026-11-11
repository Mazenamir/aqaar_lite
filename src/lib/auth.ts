import { cookies } from "next/headers";
import { PrismaClient, UserRole, Session } from "@prisma/client";
import { addDays } from "date-fns";
import crypto from "crypto";
import { UnauthorizedError, ForbiddenError } from "./errors/app-error";

export const SESSION_COOKIE_NAME = "aqar_session_token";
export const SESSION_DURATION_DAYS = 7;

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId: string;
}

export interface SessionValidationResult {
  user: AuthenticatedUser;
  session: Session;
}

/**
 * Computes a secure SHA-256 hash of a raw session token.
 * Only the hash is stored in PostgreSQL to protect against database leaks.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a cryptographically secure random session identifier with 256 bits of entropy.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export class AuthService {
  /**
   * Safely reads the session cookie if within a Next.js request context.
   */
  private static async getCookieSafe(name: string): Promise<string | null> {
    try {
      const cookieStore = await cookies();
      return cookieStore.get(name)?.value ?? null;
    } catch {
      // Outside request context (e.g. unit tests or background scripts)
      return null;
    }
  }

  /**
   * Safely sets the session cookie if within a Next.js request context.
   */
  private static async setCookieSafe(
    name: string,
    value: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const cookieStore = await cookies();
      cookieStore.set(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });
    } catch {
      // Outside request context
    }
  }

  /**
   * Safely clears the session cookie if within a Next.js request context.
   */
  private static async deleteCookieSafe(name: string): Promise<void> {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(name);
    } catch {
      // Outside request context
    }
  }

  /**
   * Creates a persistent server-side session in PostgreSQL.
   * Generates a high-entropy random token, stores its SHA-256 hash in DB,
   * and sets an HttpOnly Secure cookie.
   */
  public static async createSession(
    prisma: PrismaClient,
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
    const rawToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(rawToken);
    const expiresAt = addDays(new Date(), SESSION_DURATION_DAYS);

    const session = await prisma.session.create({
      data: {
        sessionTokenHash,
        userId,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    await this.setCookieSafe(SESSION_COOKIE_NAME, rawToken, expiresAt);

    return {
      rawToken,
      expiresAt,
      sessionId: session.id,
    };
  }

  /**
   * Validates a session by raw token.
   * Rejects if session does not exist, is expired, or has been revoked.
   */
  public static async validateSession(
    prisma: PrismaClient,
    rawToken: string
  ): Promise<SessionValidationResult | null> {
    if (!rawToken || typeof rawToken !== "string") {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: {
          include: { company: true },
        },
      },
    });

    // 1. Session does not exist
    if (!session) {
      return null;
    }

    // 2. Session has been revoked (e.g. explicitly logged out)
    if (session.revokedAt !== null) {
      return null;
    }

    // 3. Session has expired
    if (session.expiresAt < new Date()) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        companyId: session.user.companyId,
        companyName: session.user.company.name,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        sessionId: session.id,
      },
      session,
    };
  }

  /**
   * Destroys the current session by marking it revoked in PostgreSQL
   * and deleting the HttpOnly cookie.
   */
  public static async destroySession(
    prisma: PrismaClient,
    rawTokenOverride?: string
  ): Promise<boolean> {
    const rawToken = rawTokenOverride ?? (await this.getCookieSafe(SESSION_COOKIE_NAME));

    if (!rawToken) {
      return false;
    }

    const tokenHash = hashSessionToken(rawToken);

    // Mark revoked in DB (server-side invalidation)
    const result = await prisma.session.updateMany({
      where: {
        sessionTokenHash: tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.deleteCookieSafe(SESSION_COOKIE_NAME);

    return result.count > 0;
  }

  /**
   * Revokes a specific session by sessionId.
   */
  public static async revokeSessionById(
    prisma: PrismaClient,
    sessionId: string
  ): Promise<boolean> {
    const result = await prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Revokes all active sessions for a given user.
   */
  public static async revokeAllUserSessions(
    prisma: PrismaClient,
    userId: string
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Retrieves the authenticated user strictly from the verified session in database.
   * Guarantees tenant isolation: companyId is always derived from server session, NEVER client parameters.
   */
  public static async getCurrentUser(
    prisma: PrismaClient,
    rawTokenOverride?: string
  ): Promise<AuthenticatedUser | null> {
    const rawToken = rawTokenOverride ?? (await this.getCookieSafe(SESSION_COOKIE_NAME));
    if (!rawToken) return null;

    const validated = await this.validateSession(prisma, rawToken);
    return validated ? validated.user : null;
  }

  /**
   * Requires an authenticated session. Throws 401 UnauthorizedError if absent.
   */
  public static requireAuth(user: AuthenticatedUser | null): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedError("يرجى تسجيل الدخول أولاً للمتابعة");
    }
    return user;
  }

  /**
   * Enforces role authorization strictly on the server.
   * Throws 401 if unauthenticated, 403 if role is not permitted.
   */
  public static requireRole(
    user: AuthenticatedUser | null,
    allowedRoles: UserRole[]
  ): AuthenticatedUser {
    const authedUser = this.requireAuth(user);

    if (!allowedRoles.includes(authedUser.role)) {
      throw new ForbiddenError();
    }

    return authedUser;
  }

  // =========================================================================
  // Granular Role & Permission Matrix Checks
  // =========================================================================

  public static canManageUnits(role: UserRole): boolean {
    return role === UserRole.COMPANY_ADMIN;
  }

  public static canModifyUnitPrice(role: UserRole): boolean {
    return role === UserRole.COMPANY_ADMIN;
  }

  public static canReadAuditLogs(role: UserRole): boolean {
    return role === UserRole.COMPANY_ADMIN;
  }

  public static canManageClients(role: UserRole): boolean {
    return role === UserRole.COMPANY_ADMIN || role === UserRole.SALES_AGENT;
  }

  public static canReserveUnits(role: UserRole): boolean {
    return role === UserRole.SALES_AGENT || role === UserRole.COMPANY_ADMIN;
  }

  public static canDraftContracts(role: UserRole): boolean {
    return role === UserRole.SALES_AGENT || role === UserRole.COMPANY_ADMIN;
  }

  public static canApproveContracts(role: UserRole): boolean {
    return role === UserRole.ACCOUNTANT;
  }

  public static canRegisterPayments(role: UserRole): boolean {
    return role === UserRole.ACCOUNTANT;
  }

  public static canViewContracts(role: UserRole): boolean {
    // All authenticated roles can view contracts (scoped to company/agent)
    return [UserRole.COMPANY_ADMIN, UserRole.ACCOUNTANT, UserRole.SALES_AGENT].includes(role);
  }

  public static canDeletePayments(_role: UserRole): boolean {
    // Payments are immutable audit records; no role is permitted to delete them
    return false;
  }
}
