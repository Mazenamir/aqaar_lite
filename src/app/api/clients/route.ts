import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";
import { ClientService } from "@/lib/services/client.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";

const createClientSchema = z.object({
  name: z.string().min(2, "اسم العميل مطلوب"),
  phone: z.string().min(8, "رقم الهاتف مطلوب"),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const clients = await ClientService.listClients(
      prisma,
      user.companyId,
      user.id,
      user.role
    );

    return NextResponse.json({
      success: true,
      data: clients,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await AuthService.getCurrentUser(prisma);
    AuthService.requireRole(user, ["SALES_AGENT", "COMPANY_ADMIN"]);

    const body = await req.json();
    const result = createClientSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات العميل غير صحيحة" },
        { status: 400 }
      );
    }

    const client = await ClientService.createClient(prisma, {
      companyId: user!.companyId,
      createdById: user!.id,
      ...result.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: client,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
