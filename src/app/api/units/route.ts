import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { sarToHalalas } from "@/lib/money";
import { ReservationService } from "@/lib/services/reservation.service";
import { UnitStatus } from "@prisma/client";

const querySchema = z.object({
  status: z.enum(["all", "AVAILABLE", "RESERVED", "SOLD"]).optional().default("all"),
  minPriceSar: z.string().optional(),
  maxPriceSar: z.string().optional(),
  sortBy: z.enum(["priceAsc", "priceDesc", "areaAsc", "areaDesc", "newest"]).optional().default("newest"),
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  search: z.string().optional(),
});

const createUnitSchema = z.object({
  project: z.string().min(2, "اسم المشروع مطلوب"),
  code: z.string().min(1, "رقم الوحدة مطلوب"),
  type: z.string().min(2, "نوع الوحدة مطلوب"),
  floor: z.string().min(1, "الطابق مطلوب"),
  area: z.number().int().positive("المساحة يجب أن تكون رقماً موجباً"),
  rooms: z.number().int().positive("عدد الغرف يجب أن يكون رقماً موجباً"),
  priceSar: z.union([z.string(), z.number()]),
});

export async function GET(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Auto-expire reservations for this company
    await ReservationService.autoExpireReservations(prisma, user.companyId);

    const { searchParams } = new URL(req.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json({ success: false, error: "معاملات البحث غير صالحة" }, { status: 400 });
    }

    const { status, minPriceSar, maxPriceSar, sortBy, page, limit, search } = parsedQuery.data;

    const pageNum = Math.max(1, parseInt(page, 10));
    const take = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * take;

    // Filters strictly scoped by tenant
    const where: any = {
      companyId: user.companyId,
    };

    if (status !== "all") {
      where.status = status as UnitStatus;
    }

    if (minPriceSar || maxPriceSar) {
      where.priceHalalas = {};
      if (minPriceSar) where.priceHalalas.gte = sarToHalalas(minPriceSar);
      if (maxPriceSar) where.priceHalalas.lte = sarToHalalas(maxPriceSar);
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { project: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ];
    }

    // Sorting
    const orderBy: any = {};
    if (sortBy === "priceAsc") orderBy.priceHalalas = "asc";
    else if (sortBy === "priceDesc") orderBy.priceHalalas = "desc";
    else if (sortBy === "areaAsc") orderBy.area = "asc";
    else if (sortBy === "areaDesc") orderBy.area = "desc";
    else orderBy.createdAt = "desc";

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

    // Format BigInt to string in JSON (no floats)
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
        priceSar: (Number(u.priceHalalas) / 100).toLocaleString("en-US"),
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        reservation: activeRes
          ? {
              id: activeRes.id,
              clientName: activeRes.client.name,
              agentName: activeRes.createdBy.name,
              expiresAt: activeRes.expiresAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedUnits,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("GET /api/units error:", error);
    return NextResponse.json({ success: false, error: "فشل استرجاع الوحدات" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["COMPANY_ADMIN"]);

    const body = await req.json();
    const result = createUnitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const { project, code, type, floor, area, rooms, priceSar } = result.data;
    const priceHalalas = sarToHalalas(priceSar);

    if (priceHalalas <= 0n) {
      return NextResponse.json({ success: false, error: "السعر يجب أن يكون أكبر من صفر" }, { status: 400 });
    }

    // Check code uniqueness within company
    const existing = await prisma.unit.findUnique({
      where: {
        companyId_code: {
          companyId: user!.companyId,
          code,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "رقم الوحدة مسجل مسبقاً في شركتك" }, { status: 409 });
    }

    const unit = await prisma.unit.create({
      data: {
        companyId: user!.companyId,
        project,
        code,
        type,
        floor,
        area,
        rooms,
        priceHalalas,
        status: UnitStatus.AVAILABLE,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: user!.companyId,
        userId: user!.id,
        action: "UNIT_CREATED",
        entityType: "Unit",
        entityId: unit.id,
        details: JSON.stringify({ code, project, priceHalalas: priceHalalas.toString() }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: unit.id,
          code: unit.code,
          project: unit.project,
          priceHalalas: unit.priceHalalas.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "فشل إضافة الوحدة" }, { status: 400 });
  }
}
