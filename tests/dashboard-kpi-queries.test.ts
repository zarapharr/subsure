import { describe, expect, it } from "vitest";
import { summarizeDashboardKpisFromDecisionRows } from "@/lib/dashboard-kpi-queries";

describe("summarizeDashboardKpisFromDecisionRows", () => {
  it("aggregates recurring totals and at-risk spend from latest decision rows", () => {
    const summary = summarizeDashboardKpisFromDecisionRows(
      [
        {
          cardId: "card-1",
          decisionId: "keep",
          amountCents: 1500,
          cadence: "monthly",
          lastSeenAt: new Date("2026-04-08T00:00:00.000Z"),
        },
        {
          cardId: "card-2",
          decisionId: "cancel",
          amountCents: 7500,
          cadence: "annual",
          lastSeenAt: new Date("2026-03-30T00:00:00.000Z"),
        },
        {
          cardId: "card-3",
          decisionId: "downgrade",
          amountCents: 4200,
          cadence: "monthly",
          lastSeenAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      {
        asOf: new Date("2026-04-18T00:00:00.000Z"),
        renewalWindowDays: 30,
      },
    );

    expect(summary.monthlyRecurringSpendCents).toBe(5700);
    expect(summary.annualRecurringSpendCents).toBe(7500);
    expect(summary.cancellationOpportunityCount).toBe(2);
    expect(summary.monthlySpendAtRiskCents).toBe(4200);
    expect(summary.annualSpendAtRiskCents).toBe(7500);
  });

  it("excludes not-mine and duplicate decisions from recurring spend and renewal totals", () => {
    const summary = summarizeDashboardKpisFromDecisionRows(
      [
        {
          cardId: "card-1",
          decisionId: "not_mine",
          amountCents: 1999,
          cadence: "monthly",
          lastSeenAt: new Date("2026-04-06T00:00:00.000Z"),
        },
        {
          cardId: "card-2",
          decisionId: "duplicate",
          amountCents: 999,
          cadence: "monthly",
          lastSeenAt: new Date("2026-04-02T00:00:00.000Z"),
        },
      ],
      {
        asOf: new Date("2026-04-18T00:00:00.000Z"),
        renewalWindowDays: 30,
      },
    );

    expect(summary.monthlyRecurringSpendCents).toBe(0);
    expect(summary.annualRecurringSpendCents).toBe(0);
    expect(summary.upcomingRenewalsCount).toBe(0);
    expect(summary.upcomingRenewalsAmountCents).toBe(0);
  });

  it("counts only renewals falling inside the configured window", () => {
    const summary = summarizeDashboardKpisFromDecisionRows(
      [
        {
          cardId: "card-1",
          decisionId: "keep",
          amountCents: 3000,
          cadence: "monthly",
          lastSeenAt: new Date("2026-04-05T00:00:00.000Z"),
        },
        {
          cardId: "card-2",
          decisionId: "keep",
          amountCents: 12000,
          cadence: "annual",
          lastSeenAt: new Date("2025-03-25T00:00:00.000Z"),
        },
      ],
      {
        asOf: new Date("2026-04-18T00:00:00.000Z"),
        renewalWindowDays: 20,
      },
    );

    expect(summary.upcomingRenewalsCount).toBe(1);
    expect(summary.upcomingRenewalsAmountCents).toBe(3000);
  });
});
