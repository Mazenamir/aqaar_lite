import { UserRole } from "@prisma/client";
import { AuthenticatedUser, AuthService } from "../auth";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error";
import { prisma } from "../prisma";

/**
 * Granular Permissions for Aqaar Lite (RBAC)
 */
export enum Permission {
  // Units
  UNIT_CREATE = "UNIT_CREATE",
  UNIT_PRICE_UPDATE = "UNIT_PRICE_UPDATE",
  UNIT_READ = "UNIT_READ",

  // Clients
  CLIENT_CREATE = "CLIENT_CREATE",
  CLIENT_READ_ALL = "CLIENT_READ_ALL",
  CLIENT_READ_OWN = "CLIENT_READ_OWN",
  CLIENT_UPDATE_OWN = "CLIENT_UPDATE_OWN",

  // Reservations
  RESERVATION_CREATE = "RESERVATION_CREATE",
  RESERVATION_READ = "RESERVATION_READ",

  // Contracts
  CONTRACT_CREATE_DRAFT = "CONTRACT_CREATE_DRAFT",
  CONTRACT_APPROVE = "CONTRACT_APPROVE",
  CONTRACT_READ_ALL = "CONTRACT_READ_ALL",

  // Payments
  PAYMENT_CREATE = "PAYMENT_CREATE",
  PAYMENT_READ = "PAYMENT_READ",

  // Audit Logs
  AUDIT_READ = "AUDIT_READ",
}

/**
 * Explicit Role-to-Permission Mapping Matrix
 *
 * Rules:
 * - COMPANY_ADMIN: Full unit management, all client/contract read, audit log inspection.
 *                  CANNOT approve contracts or register payments (segregation of financial duties).
 * - SALES_AGENT: Manage owned clients, reserve units, create contract drafts.
 *                CANNOT modify prices, approve contracts, register payments, or access other agents' clients.
 * - ACCOUNTANT: Approve contracts, register payments, view all contracts and payments.
 *               CANNOT create/modify units or prices, CANNOT create/modify clients.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.COMPANY_ADMIN]: [
    Permission.UNIT_CREATE,
    Permission.UNIT_PRICE_UPDATE,
    Permission.UNIT_READ,
    Permission.CLIENT_READ_ALL,
    Permission.CLIENT_READ_OWN,
    Permission.RESERVATION_READ,
    Permission.CONTRACT_READ_ALL,
    Permission.PAYMENT_READ,
    Permission.AUDIT_READ,
  ],
  [UserRole.SALES_AGENT]: [
    Permission.UNIT_READ,
    Permission.CLIENT_CREATE,
    Permission.CLIENT_READ_OWN,
    Permission.CLIENT_UPDATE_OWN,
    Permission.RESERVATION_CREATE,
    Permission.RESERVATION_READ,
    Permission.CONTRACT_CREATE_DRAFT,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.UNIT_READ,
    Permission.CONTRACT_READ_ALL,
    Permission.CONTRACT_APPROVE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_READ,
  ],
};

export interface TenantContext {
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  role: UserRole;
  user: AuthenticatedUser;
}

/**
 * Retrieves the authenticated user from the active session.
 * Throws 401 UnauthorizedError if no valid session exists.
 */
export async function requireAuthenticatedUser(rawTokenOverride?: string): Promise<AuthenticatedUser> {
  const user = await AuthService.getCurrentUser(prisma, rawTokenOverride);
  if (!user) {
    throw new UnauthorizedError("يرجى تسجيل الدخول أولاً للمتابعة");
  }
  return user;
}

/**
 * Returns the trusted Tenant Context strictly derived from the verified session.
 * NEVER trusts companyId or role supplied by client requests.
 */
export async function getTenantContext(rawTokenOverride?: string): Promise<TenantContext> {
  const user = await requireAuthenticatedUser(rawTokenOverride);
  return {
    companyId: user.companyId,
    companyName: user.companyName,
    userId: user.id,
    userName: user.name,
    role: user.role,
    user,
  };
}

/**
 * Enforces that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(user: AuthenticatedUser | null, allowedRoles: UserRole[]): AuthenticatedUser {
  if (!user) {
    throw new UnauthorizedError("يرجى تسجيل الدخول أولاً للمتابعة");
  }
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

/**
 * Enforces that the authenticated user possesses the specific permission.
 */
export function requirePermission(user: AuthenticatedUser | null, permission: Permission): AuthenticatedUser {
  if (!user) {
    throw new UnauthorizedError("يرجى تسجيل الدخول أولاً للمتابعة");
  }

  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(`ليس لديك الصلاحية المطلوبة: ${permission}`);
  }

  return user;
}

/**
 * Asserts tenant ownership of a resource.
 * Throws ForbiddenError if the resource belongs to a different company.
 */
export function assertTenantOwnership(
  resourceCompanyId: string,
  authenticatedCompanyId: string,
  resourceName = "المورد"
): void {
  if (resourceCompanyId !== authenticatedCompanyId) {
    throw new ForbiddenError(`لا يمكنك الوصول إلى ${resourceName} التابع لشركة أخرى`);
  }
}

/**
 * Asserts individual resource ownership for restricted roles (e.g. Sales Agents owning clients).
 * Sales Agents can only access resources they personally created.
 * Admins have company-wide access.
 */
export function assertResourceOwnership(
  resourceOwnerId: string,
  authenticatedUser: AuthenticatedUser,
  resourceName = "السجل"
): void {
  if (authenticatedUser.role === UserRole.SALES_AGENT) {
    if (resourceOwnerId !== authenticatedUser.id) {
      throw new ForbiddenError(`لا يحق لمندوب المبيعات الوصول إلى ${resourceName} الخاص بمندوب آخر`);
    }
  }
}

/**
 * Sanitizes input payloads to eliminate any mass assignment attempts.
 * Strips out sensitive fields such as companyId, role, createdById, approvedById.
 */
export function stripMassAssignmentFields<T extends Record<string, unknown>>(
  input: T,
  forbiddenFields: (keyof T | string)[] = ["companyId", "role", "createdById", "approvedById", "status", "id"]
): Omit<T, "companyId" | "role" | "createdById" | "approvedById" | "status" | "id"> {
  const sanitized = { ...input };
  for (const field of forbiddenFields) {
    delete sanitized[field as keyof T];
  }
  return sanitized;
}
