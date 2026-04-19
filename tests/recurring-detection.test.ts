import { describe, expect, it } from "vitest";
import { classifyCadence, scoreAmountStability } from "@/lib/recurring-detection";
import { CADENCE_DRIFT_FIXTURES } from "./fixtures/reminder-engine-fixtures";

function datesFromIso(isoDates: readonly string[]) {
  return isoDates.map((isoDate) => new Date(`${isoDate}T00:00:00.000Z`));
}

describe("classifyCadence", () => {
  it("classifies weekly cadence", () => {
    const result = classifyCadence(
      datesFromIso(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]),
    );

    expect(result.cadence).toBe("weekly");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies monthly cadence", () => {
    const result = classifyCadence(
      datesFromIso(["2025-10-05", "2025-11-05", "2025-12-05", "2026-01-05", "2026-02-05"]),
    );

    expect(result.cadence).toBe("monthly");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies quarterly cadence", () => {
    const result = classifyCadence(
      datesFromIso(["2025-01-10", "2025-04-10", "2025-07-10", "2025-10-10", "2026-01-10"]),
    );

    expect(result.cadence).toBe("quarterly");
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it("classifies annual cadence", () => {
    const result = classifyCadence(
      datesFromIso(["2022-03-15", "2023-03-18", "2024-03-16", "2025-03-17", "2026-03-18"]),
    );

    expect(result.cadence).toBe("annual");
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies inconsistent timing as irregular", () => {
    const result = classifyCadence(
      datesFromIso(["2025-01-10", "2025-01-28", "2025-02-03", "2025-03-29", "2025-04-11"]),
    );

    expect(result.cadence).toBe("irregular");
  });

  it("returns irregular when there is not enough history", () => {
    const result = classifyCadence(datesFromIso(["2026-01-01"]));

    expect(result.cadence).toBe("irregular");
    expect(result.score).toBe(0);
  });

  it("handles cadence drift fixtures deterministically", () => {
    for (const fixture of CADENCE_DRIFT_FIXTURES) {
      const result = classifyCadence(datesFromIso(fixture.chargeDates));
      expect(result.cadence, fixture.id).toBe(fixture.expectedCadence);
    }
  });
});

describe("scoreAmountStability", () => {
  it("scores tightly clustered amounts as stable", () => {
    const result = scoreAmountStability([999, 1000, 1001, 1000, 999]);

    expect(result.band).toBe("stable");
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("scores modest drift as near_stable", () => {
    const result = scoreAmountStability([1000, 1120, 930, 1080, 890]);

    expect(result.band).toBe("near_stable");
    expect(result.score).toBeGreaterThanOrEqual(0.6);
    expect(result.score).toBeLessThan(0.85);
  });

  it("scores large variance as unstable", () => {
    const result = scoreAmountStability([1000, 1600, 700, 1900, 500]);

    expect(result.band).toBe("unstable");
    expect(result.score).toBeLessThan(0.6);
  });

  it("returns unstable when there is not enough amount history", () => {
    const result = scoreAmountStability([1299]);

    expect(result.band).toBe("unstable");
    expect(result.score).toBe(0);
  });
});
