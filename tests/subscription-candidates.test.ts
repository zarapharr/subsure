import { describe, expect, it } from "vitest";
import { deriveSubscriptionCandidates } from "@/lib/subscription-candidates";

function tx(merchantDescriptor: string, amountCents: number, isoDate: string) {
  return {
    merchantDescriptor,
    amountCents,
    postedAt: new Date(`${isoDate}T00:00:00.000Z`),
  };
}

describe("deriveSubscriptionCandidates", () => {
  it("derives and scores a stable monthly candidate", () => {
    const candidates = deriveSubscriptionCandidates("user-1", [
      tx("NETFLIX.COM 408-540-3700 CA", -1599, "2025-10-05"),
      tx("NETFLIX.COM 408-540-3700 CA", -1599, "2025-11-05"),
      tx("NETFLIX.COM 408-540-3700 CA", -1599, "2025-12-05"),
      tx("NETFLIX.COM 408-540-3700 CA", -1599, "2026-01-05"),
      tx("NETFLIX.COM 408-540-3700 CA", -1599, "2026-02-05"),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      userId: "user-1",
      merchantNormalized: "netflix",
      displayName: "Netflix",
      estimatedAmountCents: 1599,
      cadence: "monthly",
      confidenceBand: "high",
      occurrenceCount: 5,
    });

    expect(candidates[0]?.firstSeenAt?.toISOString()).toContain("2025-10-05");
    expect(candidates[0]?.lastSeenAt?.toISOString()).toContain("2026-02-05");
  });

  it("produces lower confidence for unstable cadence and amount", () => {
    const candidates = deriveSubscriptionCandidates("user-2", [
      tx("PAYPAL *ACME VIDEO SERVICES 8001234567 TX", -1000, "2026-01-02"),
      tx("PAYPAL *ACME VIDEO SERVICES 8001234567 TX", -1800, "2026-01-11"),
      tx("PAYPAL *ACME VIDEO SERVICES 8001234567 TX", -700, "2026-02-18"),
      tx("PAYPAL *ACME VIDEO SERVICES 8001234567 TX", -2200, "2026-04-03"),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      merchantNormalized: "paypal_acme_video",
      cadence: "irregular",
      confidenceBand: "low",
      occurrenceCount: 4,
    });
  });

  it("ignores unknown merchants and one-off transactions", () => {
    const candidates = deriveSubscriptionCandidates("user-3", [
      tx("1234 5678 9012", -999, "2026-01-01"),
      tx("SPOTIFY USA 877-778-1161 NY", -1299, "2026-01-08"),
    ]);

    expect(candidates).toHaveLength(0);
  });
});
