export const REMINDER_TIMEZONE_BOUNDARY_FIXTURES = [
  {
    id: "month-end-local-evening",
    cadence: "monthly" as const,
    lastChargedAtIso: "2026-01-31",
    asOf: new Date("2026-02-27T17:30:00.000-06:00"),
    expectedNextRenewalIso: "2026-02-28T00:00:00.000Z",
  },
  {
    id: "leap-day-local-evening",
    cadence: "annual" as const,
    lastChargedAtIso: "2024-02-29",
    asOf: new Date("2025-02-27T15:00:00.000-08:00"),
    expectedNextRenewalIso: "2025-02-28T00:00:00.000Z",
  },
] as const;

export const REMINDER_DRIFT_WINDOW_FIXTURES = [
  {
    id: "clock-skew-last-sweep-in-future",
    now: new Date("2026-04-18T12:00:00.000Z"),
    lastSweepCompletedAt: new Date("2026-04-18T12:15:00.000Z"),
    defaultLookbackHours: 26,
    expectedStartExclusiveIso: "2026-04-17T10:00:00.000Z",
  },
] as const;

export const CADENCE_DRIFT_FIXTURES = [
  {
    id: "monthly-with-small-drift",
    chargeDates: [
      "2026-01-01",
      "2026-01-31",
      "2026-03-02",
      "2026-04-01",
      "2026-05-02",
      "2026-06-01",
    ],
    expectedCadence: "monthly",
  },
  {
    id: "monthly-with-high-drift",
    chargeDates: [
      "2026-01-01",
      "2026-01-18",
      "2026-02-26",
      "2026-04-11",
      "2026-04-28",
      "2026-06-19",
    ],
    expectedCadence: "irregular",
  },
] as const;
