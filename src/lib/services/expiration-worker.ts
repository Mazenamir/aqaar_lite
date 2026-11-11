import { prisma } from "../prisma";
import { ReservationService } from "./reservation.service";

/**
 * ExpirationWorker
 * Handles automatic expiration of 72-hour reservations without manual intervention.
 * 
 * Modes of Execution:
 * 1. Background Interval Worker: Periodically checks and expires reservations in development or long-running containers.
 * 2. Scheduled Cron Endpoint: Invoked via Vercel Cron, Kubernetes CronJob, or Linux crontab via GET/POST /api/cron/expire-reservations.
 * 3. Lazy In-Flight Sweeping: Executed automatically on every unit list, unit detail fetch, and reservation attempt.
 */
export class ExpirationWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static lastRun: Date | null = null;
  private static totalSweeps = 0;
  private static totalExpired = 0;

  /**
   * Executes a single sweep of all active reservations past expiresAt.
   */
  public static async sweep(): Promise<{ expiredCount: number; timestamp: string }> {
    try {
      const expiredCount = await ReservationService.autoExpireReservations(prisma);
      this.lastRun = new Date();
      this.totalSweeps++;
      this.totalExpired += expiredCount;

      return {
        expiredCount,
        timestamp: this.lastRun.toISOString(),
      };
    } catch (error) {
      console.error("[ExpirationWorker] Error during sweep:", error);
      throw error;
    }
  }

  /**
   * Starts a background interval worker loop.
   */
  public static start(intervalMs = 60000): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`[ExpirationWorker] Started. Interval: ${intervalMs}ms`);

    // Run immediate sweep on start
    this.sweep().catch((err) => console.error("[ExpirationWorker] Initial sweep error:", err));

    this.timer = setInterval(() => {
      this.sweep().catch((err) => console.error("[ExpirationWorker] Periodic sweep error:", err));
    }, intervalMs);

    // Ensure timer doesn't prevent Node process termination
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stops the background interval worker.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[ExpirationWorker] Stopped.");
  }

  /**
   * Retrieves the current worker status.
   */
  public static getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun ? this.lastRun.toISOString() : null,
      totalSweeps: this.totalSweeps,
      totalExpired: this.totalExpired,
    };
  }
}
