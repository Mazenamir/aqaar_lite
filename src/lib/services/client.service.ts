import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors/app-error";
import { AuthenticatedUser } from "../auth";
import { assertResourceOwnership } from "../security/rbac";

export interface CreateClientInput {
  companyId: string;
  createdById: string;
  name: string;
  phone: string;
  notes?: string;
}

export interface UpdateClientInput {
  companyId: string;
  clientId: string;
  user: AuthenticatedUser;
  name?: string;
  phone?: string;
  notes?: string;
}

export class ClientService {
  /**
   * Retrieves clients according to user role:
   * - SALES_AGENT: Only sees clients created by themselves (mandated by assessment).
   * - COMPANY_ADMIN / ACCOUNTANT: Sees all clients within the tenant.
   */
  public static async listClients(
    prisma: PrismaClient,
    companyId: string,
    userId: string,
    userRole: UserRole
  ) {
    const where: Prisma.ClientWhereInput = {
      companyId,
    };

    if (userRole === UserRole.SALES_AGENT) {
      where.createdById = userId;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true },
        },
        reservations: {
          where: { status: "ACTIVE" },
          select: { id: true, expiresAt: true, unitId: true },
        },
        contracts: {
          select: { id: true, contractNumber: true, status: true },
        },
      },
    });

    return clients.map((c) => ({
      id: c.id,
      companyId: c.companyId,
      name: c.name,
      phone: c.phone,
      notes: c.notes || "",
      salesRepId: c.createdById,
      createdById: c.createdById,
      createdByName: c.createdBy?.name || "مندوب المبيعات",
      activeReservationsCount: c.reservations.length,
      contractsCount: c.contracts.length,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Onboards a new client under the tenant and attaches ownership to the creating sales rep.
   */
  public static async createClient(prisma: PrismaClient, input: CreateClientInput) {
    const name = input.name ? input.name.trim() : "";
    if (!name || name.length < 2) {
      throw new ValidationError("اسم العميل مطلوب ويجب أن يتكون من حرفين على الأقل");
    }

    const phone = input.phone ? input.phone.trim() : "";
    if (!phone || phone.length < 8) {
      throw new ValidationError("رقم هاتف العميل غير صالح");
    }

    const client = await prisma.client.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        name,
        phone,
        notes: input.notes?.trim() || null,
      },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    return {
      id: client.id,
      companyId: client.companyId,
      name: client.name,
      phone: client.phone,
      notes: client.notes || "",
      salesRepId: client.createdById,
      createdById: client.createdById,
      createdByName: client.createdBy?.name || "مندوب المبيعات",
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    };
  }

  /**
   * Fetches a single client with strict tenant isolation and sales representative ownership validation.
   * If a sales agent attempts to view another agent's client, access is denied (403 Forbidden).
   * Cross-company access is rejected with NotFoundError (404 Not Found).
   */
  public static async getClientById(
    prisma: PrismaClient,
    companyId: string,
    clientId: string,
    user?: AuthenticatedUser
  ) {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        companyId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        reservations: {
          where: { status: "ACTIVE" },
          include: { unit: true },
        },
        contracts: true,
      },
    });

    if (!client) {
      throw new NotFoundError("العميل غير موجود أو لا ينتمي لشركتك");
    }

    // Enforce sales rep ownership: Sales reps cannot view clients created by other agents
    if (user && user.role === UserRole.SALES_AGENT) {
      assertResourceOwnership(client.createdById, user, "العميل");
    }

    return {
      id: client.id,
      companyId: client.companyId,
      name: client.name,
      phone: client.phone,
      notes: client.notes || "",
      salesRepId: client.createdById,
      createdById: client.createdById,
      createdByName: client.createdBy?.name || "مندوب المبيعات",
      createdBy: client.createdBy,
      activeReservationsCount: client.reservations.length,
      contractsCount: client.contracts.length,
      reservations: client.reservations.map((r) => ({
        id: r.id,
        unitId: r.unitId,
        unitCode: r.unit.code,
        expiresAt: r.expiresAt.toISOString(),
        status: r.status,
      })),
      contracts: client.contracts.map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        status: c.status,
      })),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    };
  }

  /**
   * Updates client attributes.
   * Only the creator sales representative or a company admin can update.
   */
  public static async updateClient(prisma: PrismaClient, input: UpdateClientInput) {
    if (input.user.role === UserRole.ACCOUNTANT) {
      throw new ForbiddenError("لا يملك المحاسب صلاحية تعديل بيانات العملاء");
    }

    const client = await prisma.client.findFirst({
      where: {
        id: input.clientId,
        companyId: input.companyId,
      },
    });

    if (!client) {
      throw new NotFoundError("العميل غير موجود أو لا ينتمي لشركتك");
    }

    // Ownership assertion: sales reps can only edit their own clients
    assertResourceOwnership(client.createdById, input.user, "العميل");

    const updateData: Prisma.ClientUpdateInput = {};
    if (input.name !== undefined) {
      if (input.name.trim().length < 2) {
        throw new ValidationError("اسم العميل يجب أن يتكون من حرفين على الأقل");
      }
      updateData.name = input.name.trim();
    }
    if (input.phone !== undefined) {
      if (input.phone.trim().length < 8) {
        throw new ValidationError("رقم الهاتف غير صالح");
      }
      updateData.phone = input.phone.trim();
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes.trim() || null;
    }

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: updateData,
    });

    return {
      id: updated.id,
      companyId: updated.companyId,
      name: updated.name,
      phone: updated.phone,
      notes: updated.notes || "",
      salesRepId: updated.createdById,
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
