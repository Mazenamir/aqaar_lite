import { ExpirationWorker } from "../src/lib/services/expiration-worker";
import { prisma } from "../src/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const isDaemon = args.includes("--daemon");
  const intervalSeconds = Number(process.env.WORKER_INTERVAL_SECONDS || 60);

  console.log("=================================================");
  console.log("   Aqaar Lite – Reservation Expiration Worker    ");
  console.log("=================================================");

  if (isDaemon) {
    console.log(`Starting continuous daemon worker (interval: ${intervalSeconds}s)...`);
    ExpirationWorker.start(intervalSeconds * 1000);

    // Keep process alive
    process.on("SIGINT", async () => {
      console.log("\nReceived SIGINT. Shutting down worker...");
      ExpirationWorker.stop();
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nReceived SIGTERM. Shutting down worker...");
      ExpirationWorker.stop();
      await prisma.$disconnect();
      process.exit(0);
    });
  } else {
    console.log("Running one-shot expiration sweep...");
    const result = await ExpirationWorker.sweep();
    console.log(`[Sweep Completed] Expired reservations: ${result.expiredCount} at ${result.timestamp}`);
    await prisma.$disconnect();
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error("Worker fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
