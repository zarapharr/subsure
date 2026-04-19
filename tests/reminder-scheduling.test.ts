import { describe, expect, it } from "vitest";
import {
  buildReminderTriggerWindow,
  getRenewalReminderTimingRule,
  isDateInTriggerWindow,
  isReminderCadence,
  resolveNextRenewalFromIsoDate,
  resolveRenewalReminderTriggerAt,
  resolveRenewalValueBand,
  shouldFireRenewalReminder,
} from "@/lib/reminder-scheduling";
import {
  REMINDER_DRIFT_WINDOW_FIXTURES,
  REMINDER_TIMEZONE_BOUNDARY_FIXTURES,
} from "./fixtures/reminder-engine-fixtures";

describe("reminder scheduling rules", () => {
  it("assigns value bands from amount thresholds", () => {
    expect(resolveRenewalValueBand(1999)).toBe("low");
    expect(resolveRenewalValueBand(2000)).toBe("medium");
    expect(resolveRenewalValueBand(9999)).toBe("medium");
    expect(resolveRenewalValueBand(10000)).toBe("high");
  });

  it("returns cadence-specific lead times", () => {
    expect(getRenewalReminderTimingRule("monthly", 1200).leadDays).toBe(2);
    expect(getRenewalReminderTimingRule("monthly", 6500).leadDays).toBe(5);
    expect(getRenewalReminderTimingRule("monthly", 22000).leadDays).toBe(7);

    expect(getRenewalReminderTimingRule("annual", 1200).leadDays).toBe(14);
    expect(getRenewalReminderTimingRule("annual", 6500).leadDays).toBe(21);
    expect(getRenewalReminderTimingRule("annual", 22000).leadDays).toBe(30);
  });
});

describe("renewal date resolution", () => {
  it("keeps month-end renewals clamped to month-end", () => {
    const next = resolveNextRenewalFromIsoDate("2026-01-31", "monthly", new Date("2026-02-27T18:00:00.000-05:00"));
    expect(next?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps leap-day annual renewals in non-leap years", () => {
    const next = resolveNextRenewalFromIsoDate("2024-02-29", "annual", new Date("2025-02-27T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2025-02-28T00:00:00.000Z");
  });

  it("validates cadence values", () => {
    expect(isReminderCadence("monthly")).toBe(true);
    expect(isReminderCadence("annual")).toBe(true);
    expect(isReminderCadence("irregular")).toBe(false);
  });

  it("keeps timezone boundary fixtures deterministic in UTC", () => {
    for (const fixture of REMINDER_TIMEZONE_BOUNDARY_FIXTURES) {
      const next = resolveNextRenewalFromIsoDate(fixture.lastChargedAtIso, fixture.cadence, fixture.asOf);
      expect(next?.toISOString(), fixture.id).toBe(fixture.expectedNextRenewalIso);
    }
  });
});

describe("trigger windowing", () => {
  it("computes renewal reminder trigger date from cadence/value rule", () => {
    const triggerAt = resolveRenewalReminderTriggerAt(
      new Date("2026-05-01T00:00:00.000Z"),
      "annual",
      12000,
    );

    expect(triggerAt?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("evaluates window boundaries as start-exclusive and end-inclusive", () => {
    const window = buildReminderTriggerWindow({
      now: new Date("2026-04-18T12:00:00.000Z"),
      lastSweepCompletedAt: new Date("2026-04-17T12:00:00.000Z"),
    });

    expect(isDateInTriggerWindow(new Date("2026-04-17T12:00:00.000Z"), window)).toBe(false);
    expect(isDateInTriggerWindow(new Date("2026-04-18T12:00:00.000Z"), window)).toBe(true);
    expect(isDateInTriggerWindow(new Date("2026-04-18T12:00:00.001Z"), window)).toBe(false);
  });

  it("fires reminders only when derived trigger date is inside the current sweep window", () => {
    const window = buildReminderTriggerWindow({
      now: new Date("2026-04-18T02:00:00.000Z"),
      lastSweepCompletedAt: new Date("2026-04-17T01:59:59.000Z"),
    });

    const shouldFireInsideWindow = shouldFireRenewalReminder({
      nextRenewalAt: new Date("2026-04-20T00:00:00.000Z"),
      cadence: "monthly",
      amountCents: 1500,
      window,
    });

    const shouldFireOutsideWindow = shouldFireRenewalReminder({
      nextRenewalAt: new Date("2026-05-28T00:00:00.000Z"),
      cadence: "monthly",
      amountCents: 1500,
      window,
    });

    expect(shouldFireInsideWindow).toBe(true);
    expect(shouldFireOutsideWindow).toBe(false);
  });

  it("falls back to deterministic lookback when last sweep has clock skew", () => {
    const fixture = REMINDER_DRIFT_WINDOW_FIXTURES[0];
    const window = buildReminderTriggerWindow({
      now: fixture.now,
      lastSweepCompletedAt: fixture.lastSweepCompletedAt,
      defaultLookbackHours: fixture.defaultLookbackHours,
    });

    expect(window.startExclusive.toISOString()).toBe(fixture.expectedStartExclusiveIso);
    expect(window.endInclusive.toISOString()).toBe("2026-04-18T12:00:00.000Z");
  });
});
