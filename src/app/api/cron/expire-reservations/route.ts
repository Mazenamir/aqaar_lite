import { NextResponse } from "next/server";
import { ExpirationWorker } from "@/lib/services/expiration-worker";
import { getErrorMessage } from "@/lib/errors/app-error";

/**
 * Endpoint for scheduled cron jobs (e.g. Vercel Cron, external monitoring, curl).
 * Supports both GET and POST requests.
 */
export async function GET() {
  try {
    const result = await ExpirationWorker.sweep();
    return NextResponse.json({
      success: true,
      message: `تم فحص الحجوزات المنتهية بنجاح. عدد الحجوزات المحولة لمنتهية: ${result.expiredCount}`,
      ...result,
      workerStatus: ExpirationWorker.getStatus(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
