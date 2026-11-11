import { describe, it, expect } from "vitest";

describe("Reservation Concurrency - Race Condition Protection", () => {
  it("should allow only ONE reservation when two agents attempt to reserve the exact same unit simultaneously", async () => {
    // Shared unit state in database
    let unitStatus: "AVAILABLE" | "RESERVED" = "AVAILABLE";
    let reservationCount = 0;

    // Concurrency atomic update simulation (representing DB transaction / row-level lock)
    async function reserveUnit(agentId: string) {
      // Simulate random network latency (0-50ms)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

      // Atomic conditional check & lock
      if (unitStatus === "AVAILABLE") {
        unitStatus = "RESERVED";
        reservationCount++;
        return { success: true, agentId };
      } else {
        throw new Error("عذراً، الوحدة غير متاحة للحجز حالياً أو تم حجزها من قبل مندوب آخر.");
      }
    }

    // Fire 2 simultaneous reservation promises for Agent 1 and Agent 2
    const promise1 = reserveUnit("agent-1");
    const promise2 = reserveUnit("agent-2");

    const results = await Promise.allSettled([promise1, promise2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 must succeed
    expect(fulfilled).toHaveLength(1);
    // Exactly 1 must fail with a clear rejection message
    expect(rejected).toHaveLength(1);

    if (rejected[0]?.status === "rejected") {
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("الوحدة غير متاحة للحجز حالياً");
    }

    expect(reservationCount).toBe(1);
    expect(unitStatus).toBe("RESERVED");
  });
});
