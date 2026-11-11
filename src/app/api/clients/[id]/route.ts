import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/rbac";
import { ClientService } from "@/lib/services/client.service";
import { getErrorMessage, getErrorStatusCode } from "@/lib/errors/app-error";
import { stripMassAssignmentFields } from "@/lib/security/rbac";

const updateClientSchema = z.object({
  name: z.string().min(2, "اسم العميل يجب أن يتكون من حرفين على الأقل").optional(),
  phone: z.string().min(8, "رقم الهاتف غير صالح").optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;

    const client = await ClientService.getClientById(prisma, user.companyId, id, user);

    return NextResponse.json({
      success: true,
      data: client,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();

    const { id } = await params;
    const body = await req.json();

    const sanitized = stripMassAssignmentFields(body, ["companyId", "role", "createdById", "salesRepId", "id"]);
    const result = updateClientSchema.safeParse(sanitized);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const updatedClient = await ClientService.updateClient(prisma, {
      companyId: user.companyId,
      clientId: id,
      user,
      ...result.data,
    });

    return NextResponse.json({
      success: true,
      data: updatedClient,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: getErrorStatusCode(error) }
    );
  }
}
