import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";

export interface CreateClientInput {
  companyId: string;
  createdById: string;
  name: string;
  phone: string;
  notes?: string;
}

export class ClientService {
  /**
   * Retrieves clients according to user role:
   * - SALES_AGENT: Only sees clients created by themselves (Mandated by assessment).
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
          select: { id: true },
        },
        contracts: {
          select: { id: true },
        },
      },
    });

    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes || "",
      createdByName: c.createdBy.name,
      activeReservationsCount: c.reservations.length,
      contractsCount: c.contracts.length,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Onboards a new client under the tenant and attaches ownership to the creating agent.
   */
  public static async createClient(prisma: PrismaClient, input: CreateClientInput) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("اسم العميل مطلوب ويجب أن يتكون من حرفين على الأقل");
    }
    if (!input.phone || input.phone.trim().length < 8) {
      throw new ValidationError("رقم هاتف العميل غير صالح");
    }

    return await prisma.client.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        name: input.name.trim(),
        phone: input.phone.trim(),
        notes: input.notes?.trim() || null,
      },
    });
  }

  /**
   * Fetches a single client, ensuring it belongs to the tenant.
   */
  public static async getClientById(prisma: PrismaClient, companyId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        companyId,
      },
    });

    if (!client) {
      throw new NotFoundError("العميل غير موجود أو لا ينتمي لشركتك");
    }

    return client;
  }
}
