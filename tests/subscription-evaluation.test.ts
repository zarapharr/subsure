import { describe, expect, it } from "vitest";
import { OFFLINE_SUBSCRIPTION_FIXTURES } from "@/lib/evaluation/offline-subscription-fixtures";
import { evaluateSubscriptionFixtures } from "@/lib/evaluation/subscription-evaluation";

describe("evaluateSubscriptionFixtures", () => {
  it("computes stable precision/recall metrics for the offline fixture set", () => {
    const result = evaluateSubscriptionFixtures(OFFLINE_SUBSCRIPTION_FIXTURES);

    expect(result.fixtureCount).toBe(5);
    expect(result.truePositives).toBe(4);
    expect(result.falsePositives).toBe(1);
    expect(result.falseNegatives).toBe(1);

    expect(result.precision).toBeCloseTo(0.8, 5);
    expect(result.recall).toBeCloseTo(0.8, 5);
    expect(result.f1Score).toBeCloseTo(0.8, 5);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          fixtureId: "fixture-false-positive-irregular",
          kind: "false_positive",
          merchantNormalized: "paypal_acme_video",
        },
        {
          fixtureId: "fixture-false-negative-single-occurrence",
          kind: "false_negative",
          merchantNormalized: "hulu",
        },
      ]),
    );
  });

  it("supports confidence-threshold evaluation", () => {
    const result = evaluateSubscriptionFixtures(OFFLINE_SUBSCRIPTION_FIXTURES, {
      minConfidenceBand: "medium",
    });

    expect(result.truePositives).toBe(4);
    expect(result.falsePositives).toBe(0);
    expect(result.falseNegatives).toBe(1);
    expect(result.precision).toBe(1);
    expect(result.recall).toBeCloseTo(0.8, 5);
  });
});
