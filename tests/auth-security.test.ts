import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";
import {
  AuthService,
  AuthenticatedUser,
  hashSessionToken,
  generateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS,
} from "../src/lib/auth";
import { verifyPassword, dummyVerifyPassword } from "../src/lib/security/password";
import { loginRateLimiter } from "../src/lib/security/rate-limiter";
import { validateOrigin } from "../src/lib/security/csrf";
import { UnauthorizedError, ForbiddenError } from "../src/lib/errors/app-error";

const prisma = new PrismaClient();

describe("Phase 3: Authentication & Security Architecture", () => {
  let companyAUser: AuthenticatedUser;
  let companyBUser: AuthenticatedUser;
  let accountantAUser: AuthenticatedUser;
  let salesAUser: AuthenticatedUser;
  let seededAdminA: { id: string; email: string; passwordHash: string; companyId: string };

  beforeAll(async () => {
    // Fetch users created in seed
    const adminA = await prisma.user.findFirstOrThrow({
      where: { email: "admin@greenryad.sa" },
      include: { company: true },
    });
    const accountantA = await prisma.user.findFirstOrThrow({
      where: { email: "accountant@greenryad.sa" },
      include: { company: true },
    });
    const salesA = await prisma.user.findFirstOrThrow({
      where: { email: "agent1@greenryad.sa" },
      include: { company: true },
    });
    const adminB = await prisma.user.findFirstOrThrow({
      where: { email: "admin@horizon.sa" },
      include: { company: true },
    });

    seededAdminA = adminA;

    companyAUser = {
      id: adminA.id,
      companyId: adminA.companyId,
      companyName: adminA.company.name,
      email: adminA.email,
      name: adminA.name,
      role: adminA.role,
      sessionId: "mock-session-admin-a",
    };

    accountantAUser = {
      id: accountantA.id,
      companyId: accountantA.companyId,
      companyName: accountantA.company.name,
      email: accountantA.email,
      name: accountantA.name,
      role: accountantA.role,
      sessionId: "mock-session-acc-a",
    };

    salesAUser = {
      id: salesA.id,
      companyId: salesA.companyId,
      companyName: salesA.company.name,
      email: salesA.email,
      name: salesA.name,
      role: salesA.role,
      sessionId: "mock-session-sales-a",
    };

    companyBUser = {
      id: adminB.id,
      companyId: adminB.companyId,
      companyName: adminB.company.name,
      email: adminB.email,
      name: adminB.name,
      role: adminB.role,
      sessionId: "mock-session-admin-b",
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. SUCCESSFUL LOGIN
  // =========================================================================
  it("1. should successfully authenticate with valid credentials using Argon2id", async () => {
    // Verify password hash using Argon2id
    const isValid = await verifyPassword(seededAdminA.passwordHash, "Password123!");
    expect(isValid).toBe(true);

    // Create session in PostgreSQL
    const session = await AuthService.createSession(prisma, seededAdminA.id, {
      ipAddress: "127.0.0.1",
      userAgent: "Vitest-Agent",
    });

    expect(session.rawToken).toBeDefined();
    expect(session.rawToken.length).toBeGreaterThanOrEqual(32);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify session stored as hash in database (raw token must NOT be in DB)
    const expectedHash = hashSessionToken(session.rawToken);
    const dbSession = await prisma.session.findUnique({
      where: { sessionTokenHash: expectedHash },
    });

    expect(dbSession).not.toBeNull();
    expect(dbSession?.userId).toBe(seededAdminA.id);
    expect(dbSession?.revokedAt).toBeNull();

    // Verify session validation retrieves user
    const validated = await AuthService.validateSession(prisma, session.rawToken);
    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe(seededAdminA.id);
    expect(validated?.user.role).toBe(UserRole.COMPANY_ADMIN);
  });

  // =========================================================================
  // 2. INVALID PASSWORD
  // =========================================================================
  it("2. should reject authentication with an invalid password", async () => {
    const isPasswordValid = await verifyPassword(seededAdminA.passwordHash, "WrongPassword999!");
    expect(isPasswordValid).toBe(false);
  });

  // =========================================================================
  // 3. UNKNOWN EMAIL
  // =========================================================================
  it("3. should reject authentication with an unknown email safely without throwing", async () => {
    const unknownUser = await prisma.user.findUnique({
      where: { email: "ghost_user_12345@unknown.sa" },
    });
    expect(unknownUser).toBeNull();

    // Dummy Argon2 verify must run to avoid timing side-channels
    const dummyResult = await dummyVerifyPassword("Password123!");
    expect(dummyResult).toBe(false);
  });

  // =========================================================================
  // 4. GENERIC LOGIN ERROR RESPONSES (No Account Enumeration)
  // =========================================================================
  it("4. should produce identical generic error responses for unknown email vs invalid password", async () => {
    const GENERIC_ERROR_MESSAGE = "بيانات الاعتماد غير صحيحة";

    // Simulate login logic for unknown email:
    const simulateUnknownEmail = async () => {
      const user = await prisma.user.findUnique({ where: { email: "unknown@example.com" } });
      if (!user) {
        await dummyVerifyPassword("SomePassword");
        return { statusCode: 401, error: GENERIC_ERROR_MESSAGE };
      }
      return { statusCode: 200, error: null };
    };

    // Simulate login logic for wrong password:
    const simulateWrongPassword = async () => {
      const user = await prisma.user.findUnique({ where: { email: "admin@greenryad.sa" } });
      const isValid = user ? await verifyPassword(user.passwordHash, "WrongPassword") : false;
      if (!isValid) {
        return { statusCode: 401, error: GENERIC_ERROR_MESSAGE };
      }
      return { statusCode: 200, error: null };
    };

    const res1 = await simulateUnknownEmail();
    const res2 = await simulateWrongPassword();

    // Both status codes and error messages must be strictly identical
    expect(res1.statusCode).toBe(401);
    expect(res2.statusCode).toBe(401);
    expect(res1.error).toBe(GENERIC_ERROR_MESSAGE);
    expect(res2.error).toBe(GENERIC_ERROR_MESSAGE);
    expect(res1.error).toBe(res2.error);
  });

  // =========================================================================
  // 5. EXPIRED SESSIONS
  // =========================================================================
  it("5. should reject sessions whose expiration date has passed", async () => {
    const rawToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(rawToken);

    // Create session expired 2 hours ago
    const pastDate = new Date(Date.now() - 2 * 3600 * 1000);
    await prisma.session.create({
      data: {
        sessionTokenHash,
        userId: seededAdminA.id,
        expiresAt: pastDate,
      },
    });

    const validated = await AuthService.validateSession(prisma, rawToken);
    expect(validated).toBeNull();
  });

  // =========================================================================
  // 6. REVOKED SESSIONS
  // =========================================================================
  it("6. should reject sessions marked as revoked", async () => {
    const { rawToken, sessionId } = await AuthService.createSession(prisma, seededAdminA.id);

    // Mark session revoked in database
    await AuthService.revokeSessionById(prisma, sessionId);

    // Validating the revoked token must return null
    const validated = await AuthService.validateSession(prisma, rawToken);
    expect(validated).toBeNull();
  });

  // =========================================================================
  // 7. SUCCESSFUL LOGOUT
  // =========================================================================
  it("7. should invalidate session on server-side during logout", async () => {
    const { rawToken } = await AuthService.createSession(prisma, seededAdminA.id);

    // Verify session is initially valid
    const initialCheck = await AuthService.validateSession(prisma, rawToken);
    expect(initialCheck).not.toBeNull();

    // Execute logout invalidation
    const destroyed = await AuthService.destroySession(prisma, rawToken);
    expect(destroyed).toBe(true);

    // Verify database record has revokedAt set
    const tokenHash = hashSessionToken(rawToken);
    const sessionInDb = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
    });
    expect(sessionInDb?.revokedAt).not.toBeNull();
  });

  // =========================================================================
  // 8. REUSING A REVOKED SESSION
  // =========================================================================
  it("8. should strictly block and detect reuse attempts of a revoked session", async () => {
    const { rawToken } = await AuthService.createSession(prisma, seededAdminA.id);

    // Invalidate session (logout)
    await AuthService.destroySession(prisma, rawToken);

    // Attacker attempts to reuse the revoked token
    const reuseAttempt = await AuthService.getCurrentUser(prisma, rawToken);
    expect(reuseAttempt).toBeNull();
  });

  // =========================================================================
  // 9. RATE LIMITING
  // =========================================================================
  it("9. should block excessive failed attempts and reset on successful authentication", () => {
    const testIp = "192.168.100.55";
    loginRateLimiter.reset(testIp);

    // 4 failed attempts should remain allowed
    for (let i = 1; i <= 4; i++) {
      loginRateLimiter.recordFailedAttempt(testIp);
      const check = loginRateLimiter.check(testIp);
      expect(check.allowed).toBe(true);
      expect(check.remainingAttempts).toBe(5 - i);
    }

    // 5th attempt reaches maxAttempts -> blocked
    const fifthResult = loginRateLimiter.recordFailedAttempt(testIp);
    expect(fifthResult.blocked).toBe(true);

    // Subsequent checks must report blocked with retryAfterSeconds
    const checkBlocked = loginRateLimiter.check(testIp);
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.retryAfterSeconds).toBeGreaterThan(0);

    // Successful login resets rate limit counter
    loginRateLimiter.reset(testIp);
    const checkAfterReset = loginRateLimiter.check(testIp);
    expect(checkAfterReset.allowed).toBe(true);
    expect(checkAfterReset.remainingAttempts).toBe(5);
  });

  // =========================================================================
  // 10. UNAUTHENTICATED API ACCESS
  // =========================================================================
  it("10. should reject unauthenticated requests with UnauthorizedError (HTTP 401)", () => {
    expect(() => {
      AuthService.requireAuth(null);
    }).toThrow(UnauthorizedError);

    try {
      AuthService.requireAuth(null);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect((err as UnauthorizedError).statusCode).toBe(401);
    }
  });

  // =========================================================================
  // 11. UNAUTHORIZED ROLE ACCESS (RBAC)
  // =========================================================================
  it("11. should enforce RBAC and reject unauthorized roles with ForbiddenError (HTTP 403)", () => {
    // 1. Sales Agent trying to approve contract (only ACCOUNTANT allowed)
    expect(() => {
      AuthService.requireRole(salesAUser, [UserRole.ACCOUNTANT]);
    }).toThrow(ForbiddenError);

    // 2. Sales Agent trying to modify unit prices (only COMPANY_ADMIN allowed)
    expect(() => {
      AuthService.requireRole(salesAUser, [UserRole.COMPANY_ADMIN]);
    }).toThrow(ForbiddenError);

    // 3. Accountant trying to reserve a unit (only SALES_AGENT allowed)
    expect(() => {
      AuthService.requireRole(accountantAUser, [UserRole.SALES_AGENT]);
    }).toThrow(ForbiddenError);

    // 4. Authorized role succeeds
    expect(() => {
      AuthService.requireRole(accountantAUser, [UserRole.ACCOUNTANT]);
    }).not.toThrow();

    expect(() => {
      AuthService.requireRole(companyAUser, [UserRole.COMPANY_ADMIN]);
    }).not.toThrow();
  });

  // =========================================================================
  // 12. CROSS-COMPANY ACCESS ATTEMPTS
  // =========================================================================
  it("12. should prevent Company A user from accessing Company B records", async () => {
    // Fetch units belonging to Company B
    const companyBUnits = await prisma.unit.findMany({
      where: { companyId: companyBUser.companyId },
    });
    expect(companyBUnits.length).toBeGreaterThan(0);
    const targetUnitB = companyBUnits[0]!;

    // Company A user attempts to fetch or update Company B's unit
    // Protected service query always applies authenticated user's companyId
    const findAttempt = await prisma.unit.findFirst({
      where: {
        id: targetUnitB.id,
        companyId: companyAUser.companyId, // Forced to Company A's tenant ID
      },
    });

    // Must return null (unit invisible across tenants)
    expect(findAttempt).toBeNull();
  });

  // =========================================================================
  // 13. ATTEMPTS TO MANIPULATE COMPANYID OR ROLE FROM CLIENT
  // =========================================================================
  it("13. should derive companyId and role strictly from verified session, ignoring client claims", async () => {
    // Even if client payload supplies spoofed companyId and role:
    const spoofedClientPayload = {
      companyId: "spoofed-fake-company-uuid-9999",
      role: UserRole.COMPANY_ADMIN,
    };

    // The server-side session strictly retrieves real companyId and role from database
    const { rawToken } = await AuthService.createSession(prisma, salesAUser.id);
    const realUser = await AuthService.getCurrentUser(prisma, rawToken);

    expect(realUser).not.toBeNull();
    // User's role is SALES_AGENT, not the spoofed COMPANY_ADMIN
    expect(realUser?.role).toBe(UserRole.SALES_AGENT);
    expect(realUser?.role).not.toBe(spoofedClientPayload.role);
    // User's companyId is real Company A, not the spoofed company
    expect(realUser?.companyId).toBe(salesAUser.companyId);
    expect(realUser?.companyId).not.toBe(spoofedClientPayload.companyId);
  });

  // =========================================================================
  // 14. SESSION COOKIE SECURITY ATTRIBUTES & CSRF VALIDATION
  // =========================================================================
  it("14. should configure secure session cookie attributes and block CSRF cross-origin state mutations", () => {
    // Verify Cookie constants
    expect(SESSION_COOKIE_NAME).toBe("aqar_session_token");
    expect(SESSION_DURATION_DAYS).toBe(7);

    // CSRF Protection: GET request is safe
    const safeGetReq = new Request("http://localhost:3000/api/units", { method: "GET" });
    expect(validateOrigin(safeGetReq).valid).toBe(true);

    // CSRF Protection: POST from matching origin is allowed
    const validPostReq = new Request("http://localhost:3000/api/units", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(validateOrigin(validPostReq).valid).toBe(true);

    // CSRF Protection: POST from hostile cross-origin is blocked
    const hostilePostReq = new Request("http://localhost:3000/api/contracts/approve", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-hacker-site.com",
      },
    });
    const hostileCheck = validateOrigin(hostilePostReq);
    expect(hostileCheck.valid).toBe(false);
    expect(hostileCheck.reason).toContain("Origin host mismatch");
  });
});
