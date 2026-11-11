import { PrismaClient, Prisma, UnitStatus } from "@prisma/client";
import { toDecimal, formatSar } from "../money";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors/app-error";
import { ReservationService } from "./reservation.service";

export interface ListUnitsQuery {
  status?: string;
  minPrice?: string;
  maxPrice?: string;
  minPriceSar?: string;
  maxPriceSar?: string;
  rooms?: number | string;
  project?: string;
  projectName?: string;
  search?: string;
  sortBy?: "price" | "priceAsc" | "priceDesc" | "area" | "areaAsc" | "areaDesc" | "newest";
  sortOrder?: "asc" | "desc";
  page?: number | string;
  limit?: number | string;
}

export interface CreateUnitInput {
  companyId: string;
  createdById: string;
  projectName?: string;
  project?: string;
  unitNumber?: string;
  code?: string;
  type: string;
  floor?: string;
  area: number;
  rooms: number;
  price?: string | number;
  priceSar?: string | number;
}

export interface UpdateUnitInput {
  unitId: string;
  companyId: string;
  updatedById: string;
  projectName?: string;
  project?: string;
  unitNumber?: string;
  code?: string;
  type?: string;
  floor?: string;
  area?: number;
  rooms?: number;
  price?: string | number;
  priceSar?: string | number;
  status?: UnitStatus;
}

export class UnitService {
  /**
   * List units with strict tenant isolation, lazy expiration, filtering, sorting, and pagination.
   */
  public static async listUnits(
    prisma: PrismaClient,
    companyId: string,
    query: ListUnitsQuery
  ) {
    // Lazy expiration of any pending reservations for this company
    await ReservationService.autoExpireReservations(prisma, companyId);

    const pageNum = Math.max(1, Number(query.page) || 1);
    const take = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (pageNum - 1) * take;

    const where: Prisma.UnitWhereInput = {
      companyId,
    };

    if (query.status && query.status !== "all") {
      where.status = query.status as UnitStatus;
    }

    const minPriceValue = query.minPrice || query.minPriceSar;
    const maxPriceValue = query.maxPrice || query.maxPriceSar;

    if (minPriceValue || maxPriceValue) {
      where.price = {};
      if (minPriceValue) {
        where.price.gte = toDecimal(minPriceValue);
      }
      if (maxPriceValue) {
        where.price.lte = toDecimal(maxPriceValue);
      }
    }

    if (query.rooms) {
      where.rooms = Number(query.rooms);
    }

    const projectFilter = query.projectName || query.project;
    if (projectFilter) {
      where.project = { contains: projectFilter, mode: "insensitive" };
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: "insensitive" } },
        { project: { contains: query.search, mode: "insensitive" } },
        { type: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // Determine sorting
    let orderBy: Prisma.UnitOrderByWithRelationInput = { createdAt: "desc" };

    if (query.sortBy === "priceAsc" || (query.sortBy === "price" && query.sortOrder === "asc")) {
      orderBy = { price: "asc" };
    } else if (query.sortBy === "priceDesc" || (query.sortBy === "price" && (query.sortOrder === "desc" || !query.sortOrder))) {
      orderBy = { price: "desc" };
    } else if (query.sortBy === "areaAsc" || (query.sortBy === "area" && query.sortOrder === "asc")) {
      orderBy = { area: "asc" };
    } else if (query.sortBy === "areaDesc" || (query.sortBy === "area" && (query.sortOrder === "desc" || !query.sortOrder))) {
      orderBy = { area: "desc" };
    }

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
        companyId: u.companyId,
        projectName: u.project,
        project: u.project,
        unitNumber: u.code,
        code: u.code,
        type: u.type,
        floor: u.floor,
        area: u.area,
        rooms: u.rooms,
        price: u.price.toFixed(2),
        priceSar: formatSar(u.price),
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        reservation: activeRes
          ? {
              id: activeRes.id,
              clientId: activeRes.clientId,
              clientName: activeRes.client.name,
              agentName: activeRes.createdBy.name,
              salesRepId: activeRes.createdById,
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
   * Get single unit by ID with tenant isolation and active reservation details.
   */
  public static async getUnitById(
    prisma: PrismaClient,
    companyId: string,
    unitId: string
  ) {
    await ReservationService.autoExpireReservations(prisma, companyId);

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        companyId,
      },
      include: {
        reservations: {
          where: { status: "ACTIVE" },
          include: { client: true, createdBy: true },
          take: 1,
        },
      },
    });

    if (!unit) {
      throw new NotFoundError("الوحدة غير موجودة أو غير تابعة للشركة");
    }

    const activeRes = unit.reservations[0];

    return {
      id: unit.id,
      companyId: unit.companyId,
      projectName: unit.project,
      project: unit.project,
      unitNumber: unit.code,
      code: unit.code,
      type: unit.type,
      floor: unit.floor,
      area: unit.area,
      rooms: unit.rooms,
      price: unit.price.toFixed(2),
      priceSar: formatSar(unit.price),
      status: unit.status,
      createdAt: unit.createdAt.toISOString(),
      reservation: activeRes
        ? {
            id: activeRes.id,
            clientId: activeRes.clientId,
            clientName: activeRes.client.name,
            agentName: activeRes.createdBy.name,
            salesRepId: activeRes.createdById,
            expiresAt: activeRes.expiresAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Create a new real estate unit with company code uniqueness validation.
   */
  public static async createUnit(prisma: PrismaClient, input: CreateUnitInput) {
    const project = (input.projectName || input.project || "").trim();
    if (!project || project.length < 2) {
      throw new ValidationError("اسم المشروع مطلوب ويجب ألا يقل عن حرفين");
    }

    const code = (input.unitNumber || input.code || "").trim();
    if (!code) {
      throw new ValidationError("رقم الوحدة مطلوب");
    }

    const type = (input.type || "").trim();
    if (!type || type.length < 2) {
      throw new ValidationError("نوع الوحدة مطلوب");
    }

    if (!input.area || input.area <= 0) {
      throw new ValidationError("المساحة يجب أن تكون رقماً موجباً");
    }

    if (!input.rooms || input.rooms <= 0) {
      throw new ValidationError("عدد الغرف يجب أن يكون رقماً موجباً");
    }

    const rawPrice = input.price !== undefined ? input.price : input.priceSar;
    if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
      throw new ValidationError("سعر الوحدة مطلوب");
    }

    const price = toDecimal(rawPrice);
    if (price.lte(0)) {
      throw new ValidationError("السعر يجب أن يكون أكبر من صفر");
    }

    // Check code uniqueness within tenant
    const existing = await prisma.unit.findUnique({
      where: {
        companyId_code: {
          companyId: input.companyId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictError("رقم الوحدة مسجل مسبقاً في هذه الشركة");
    }

    try {
      const unit = await prisma.unit.create({
        data: {
          companyId: input.companyId,
          project,
          code,
          type,
          floor: input.floor || "1",
          area: input.area,
          rooms: input.rooms,
          price,
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
            unitNumber: unit.code,
            project: unit.project,
            projectName: unit.project,
            price: price.toFixed(2),
          }),
        },
      });

      return {
        id: unit.id,
        companyId: unit.companyId,
        projectName: unit.project,
        project: unit.project,
        unitNumber: unit.code,
        code: unit.code,
        type: unit.type,
        floor: unit.floor,
        area: unit.area,
        rooms: unit.rooms,
        price: unit.price.toFixed(2),
        priceSar: formatSar(unit.price),
        status: unit.status,
        createdAt: unit.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("رقم الوحدة مسجل مسبقاً في هذه الشركة");
      }
      throw error;
    }
  }

  /**
   * Update unit attributes with strict pricing change controls and valid state transitions.
   * Changing price is strictly prohibited for RESERVED or SOLD units.
   * Allowed state transitions:
   *   AVAILABLE -> RESERVED
   *   RESERVED -> AVAILABLE
   *   RESERVED -> SOLD
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

    const project = input.projectName || input.project;
    if (project !== undefined) updateData.project = project.trim();

    const code = input.unitNumber || input.code;
    if (code !== undefined) updateData.code = code.trim();

    if (input.type !== undefined) updateData.type = input.type.trim();
    if (input.floor !== undefined) updateData.floor = input.floor.trim();
    if (input.area !== undefined) {
      if (input.area <= 0) throw new ValidationError("المساحة يجب أن تكون رقماً موجباً");
      updateData.area = input.area;
    }
    if (input.rooms !== undefined) {
      if (input.rooms <= 0) throw new ValidationError("عدد الغرف يجب أن يكون رقماً موجباً");
      updateData.rooms = input.rooms;
    }

    // Status transition validation
    if (input.status !== undefined && input.status !== unit.status) {
      const current = unit.status;
      const target = input.status;

      const isValidTransition =
        (current === UnitStatus.AVAILABLE && target === UnitStatus.RESERVED) ||
        (current === UnitStatus.RESERVED && target === UnitStatus.AVAILABLE) ||
        (current === UnitStatus.RESERVED && target === UnitStatus.SOLD);

      if (!isValidTransition) {
        throw new ValidationError(
          `انتقال غير مسموح به لحالة الوحدة من ${current} إلى ${target}`
        );
      }

      updateData.status = target;

      await prisma.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.updatedById,
          action: "UNIT_STATUS_CHANGED",
          entityType: "Unit",
          entityId: unit.id,
          details: JSON.stringify({
            unitCode: unit.code,
            fromStatus: current,
            toStatus: target,
          }),
        },
      });
    }

    // Price change validation
    const rawPrice = input.price !== undefined ? input.price : input.priceSar;
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
      if (unit.status !== UnitStatus.AVAILABLE) {
        throw new ValidationError("لا يجوز تعديل سعر وحدة محجوزة أو مباعة");
      }

      const newPrice = toDecimal(rawPrice);
      if (newPrice.lte(0)) {
        throw new ValidationError("السعر يجب أن يكون أكبر من صفر");
      }

      if (!newPrice.equals(unit.price)) {
        updateData.price = newPrice;

        // Record price changes in audit log
        await prisma.auditLog.create({
          data: {
            companyId: input.companyId,
            userId: input.updatedById,
            action: "PRICE_CHANGE",
            entityType: "Unit",
            entityId: unit.id,
            details: JSON.stringify({
              unitCode: unit.code,
              oldPrice: unit.price.toFixed(2),
              newPrice: newPrice.toFixed(2),
            }),
          },
        });
      }
    }

    const updatedUnit = await prisma.unit.update({
      where: { id: unit.id },
      data: updateData,
    });

    return {
      id: updatedUnit.id,
      companyId: updatedUnit.companyId,
      projectName: updatedUnit.project,
      project: updatedUnit.project,
      unitNumber: updatedUnit.code,
      code: updatedUnit.code,
      type: updatedUnit.type,
      floor: updatedUnit.floor,
      area: updatedUnit.area,
      rooms: updatedUnit.rooms,
      price: updatedUnit.price.toFixed(2),
      priceSar: formatSar(updatedUnit.price),
      status: updatedUnit.status,
      createdAt: updatedUnit.createdAt.toISOString(),
      updatedAt: updatedUnit.updatedAt.toISOString(),
    };
  }
}
