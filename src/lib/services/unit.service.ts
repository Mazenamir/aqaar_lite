import { PrismaClient, UnitStatus, Prisma } from "@prisma/client";
import { sarToHalalas } from "@/lib/money";
import { ReservationService } from "./reservation.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";

export interface ListUnitsQuery {
  status?: string;
  minPriceSar?: string;
  maxPriceSar?: string;
  sortBy?: "priceAsc" | "priceDesc" | "areaAsc" | "areaDesc" | "newest";
  page?: string;
  limit?: string;
  search?: string;
}

export interface CreateUnitInput {
  companyId: string;
  createdById: string;
  project: string;
  code: string;
  type: string;
  floor: string;
  area: number;
  rooms: number;
  priceSar: string | number;
}

export interface UpdateUnitInput {
  companyId: string;
  unitId: string;
  updatedById: string;
  project?: string;
  type?: string;
  floor?: string;
  area?: number;
  rooms?: number;
  priceSar?: string | number;
}

export class UnitService {
  /**
   * List units with strict multi-tenant isolation, filtering, search and pagination.
   */
  public static async listUnits(prisma: PrismaClient, companyId: string, query: ListUnitsQuery) {
    // Proactively sweep expired reservations for this company
    await ReservationService.autoExpireReservations(prisma, companyId);

    const pageNum = Math.max(1, parseInt(query.page || "1", 10));
    const take = Math.min(50, Math.max(1, parseInt(query.limit || "10", 10)));
    const skip = (pageNum - 1) * take;

    const where: Prisma.UnitWhereInput = {
      companyId,
    };

    if (query.status && query.status !== "all") {
      where.status = query.status as UnitStatus;
    }

    if (query.minPriceSar || query.maxPriceSar) {
      where.priceHalalas = {};
      if (query.minPriceSar) {
        where.priceHalalas.gte = sarToHalalas(query.minPriceSar);
      }
      if (query.maxPriceSar) {
        where.priceHalalas.lte = sarToHalalas(query.maxPriceSar);
      }
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: "insensitive" } },
        { project: { contains: query.search, mode: "insensitive" } },
        { type: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.UnitOrderByWithRelationInput =
      query.sortBy === "priceAsc"
        ? { priceHalalas: "asc" }
        : query.sortBy === "priceDesc"
        ? { priceHalalas: "desc" }
        : query.sortBy === "areaAsc"
        ? { area: "asc" }
        : query.sortBy === "areaDesc"
        ? { area: "desc" }
        : { createdAt: "desc" };

    const [total, units] = await Promise.all([
      prisma.unit.count({ where }),
      prisma.unit.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          reservations: {
            where: { status: "ACTIVE" },
            include: { client: true, createdBy: true },
            take: 1,
          },
        },
      }),
    ]);

    const formattedUnits = units.map((u) => {
      const activeRes = u.reservations[0];
      return {
        id: u.id,
        project: u.project,
        code: u.code,
        type: u.type,
        floor: u.floor,
        area: u.area,
        rooms: u.rooms,
        priceHalalas: u.priceHalalas.toString(),
        priceSar: (Number(u.priceHalalas) / 100).toLocaleString("ar-SA"),
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        reservation: activeRes
          ? {
              id: activeRes.id,
              clientId: activeRes.clientId,
              clientName: activeRes.client.name,
              agentName: activeRes.createdBy.name,
              expiresAt: activeRes.expiresAt.toISOString(),
            }
          : null,
      };
    });

    return {
      units: formattedUnits,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Create a new real estate unit with company code uniqueness validation.
   */
  public static async createUnit(prisma: PrismaClient, input: CreateUnitInput) {
    const priceHalalas = sarToHalalas(input.priceSar);
    if (priceHalalas <= 0n) {
      throw new ValidationError("السعر يجب أن يكون أكبر من صفر");
    }

    // Check code uniqueness within tenant
    const existing = await prisma.unit.findUnique({
      where: {
        companyId_code: {
          companyId: input.companyId,
          code: input.code,
        },
      },
    });

    if (existing) {
      throw new ConflictError("رقم الوحدة مسجل مسبقاً في هذه الشركة");
    }

    const unit = await prisma.unit.create({
      data: {
        companyId: input.companyId,
        project: input.project,
        code: input.code,
        type: input.type,
        floor: input.floor,
        area: input.area,
        rooms: input.rooms,
        priceHalalas,
        status: UnitStatus.AVAILABLE,
      },
    });

    // Immutable Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.createdById,
        action: "UNIT_CREATED",
        entityType: "Unit",
        entityId: unit.id,
        details: JSON.stringify({
          code: unit.code,
          project: unit.project,
          priceHalalas: priceHalalas.toString(),
        }),
      },
    });

    return unit;
  }

  /**
   * Update unit attributes with strict pricing change controls (mandated by assessment).
   * Changing price is strictly prohibited for RESERVED or SOLD units.
   */
  public static async updateUnit(prisma: PrismaClient, input: UpdateUnitInput) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: input.unitId,
        companyId: input.companyId,
      },
    });

    if (!unit) {
      throw new NotFoundError("الوحدة غير موجودة أو غير تابعة للشركة");
    }

    const updateData: Prisma.UnitUpdateInput = {};

    if (input.project) updateData.project = input.project;
    if (input.type) updateData.type = input.type;
    if (input.floor) updateData.floor = input.floor;
    if (input.area) updateData.area = input.area;
    if (input.rooms) updateData.rooms = input.rooms;

    if (input.priceSar !== undefined) {
      if (unit.status !== UnitStatus.AVAILABLE) {
        throw new ValidationError("لا يجوز تعديل سعر وحدة محجوزة أو مباعة");
      }

      const newPriceHalalas = sarToHalalas(input.priceSar);
      if (newPriceHalalas <= 0n) {
        throw new ValidationError("السعر يجب أن يكون أكبر من صفر");
      }

      if (newPriceHalalas !== unit.priceHalalas) {
        updateData.priceHalalas = newPriceHalalas;

        // Mandated by assessment: Record price changes in audit log
        await prisma.auditLog.create({
          data: {
            companyId: input.companyId,
            userId: input.updatedById,
            action: "PRICE_CHANGE",
            entityType: "Unit",
            entityId: unit.id,
            details: JSON.stringify({
              unitCode: unit.code,
              oldPriceHalalas: unit.priceHalalas.toString(),
              newPriceHalalas: newPriceHalalas.toString(),
            }),
          },
        });
      }
    }

    return await prisma.unit.update({
      where: { id: unit.id },
      data: updateData,
    });
  }
}
