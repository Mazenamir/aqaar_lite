import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/lib/auth";

export async function POST() {
  try {
    await AuthService.destroySession(prisma);
    return NextResponse.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل تسجيل الخروج" }, { status: 500 });
  }
}
