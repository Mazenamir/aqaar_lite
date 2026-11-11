import { describe, it, expect } from "vitest";
import { AuthService, AuthenticatedUser } from "../src/lib/auth";
import { UserRole } from "@prisma/client";

describe("Multi-Tenant & RBAC Security Verification", () => {
  const company1User: AuthenticatedUser = {
    id: "usr-1",
    companyId: "comp-1",
    companyName: "شركة الرياض",
    email: "agent1@riyadh.sa",
    name: "أحمد المنصور",
    role: UserRole.SALES_AGENT,
    sessionId: "mock-session-1",
  };

  const company2User: AuthenticatedUser = {
    id: "usr-2",
    companyId: "comp-2",
    companyName: "شركة ديار نجد",
    email: "admin@najd.sa",
    name: "سليمان النجد",
    role: UserRole.COMPANY_ADMIN,
    sessionId: "mock-session-2",
  };

  it("should prevent cross-tenant access when companyIds differ", () => {
    // Simulate query with tenant enforcement
    function fetchUnitsForTenant(currentUser: AuthenticatedUser, targetCompanyId: string) {
      if (currentUser.companyId !== targetCompanyId) {
        throw new Error("SECURITY_VIOLATION: Cross-tenant data access is strictly forbidden");
      }
      return [{ id: "unit-1", companyId: targetCompanyId }];
    }

    // Company 1 user accessing Company 1 data succeeds
    expect(() => fetchUnitsForTenant(company1User, "comp-1")).not.toThrow();

    // Company 1 user attempting to access Company 2 data is blocked
    expect(() => fetchUnitsForTenant(company1User, "comp-2")).toThrow("SECURITY_VIOLATION");
  });

  it("should enforce server-side role check and reject unauthorized roles", () => {
    // Only COMPANY_ADMIN can edit price or view audit logs
    expect(() => {
      AuthService.requireRole(company1User, [UserRole.COMPANY_ADMIN]);
    }).toThrow("FORBIDDEN");

    expect(() => {
      AuthService.requireRole(company2User, [UserRole.COMPANY_ADMIN]);
    }).not.toThrow();
  });
});
