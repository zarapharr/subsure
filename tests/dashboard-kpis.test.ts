import { describe, expect, it } from "vitest";
import { buildDashboardKpiSummary } from "@/lib/dashboard-kpis";
import { MOCK_VALIDATION_CARDS, type ValidationCard } from "@/lib/validation-queue";

function cloneCard(card: ValidationCard, overrides: Partial<ValidationCard>): ValidationCard {
  return { ...card, ...overrides };
}

describe("buildDashboardKpiSummary", () => {
  it("aggregates recurring spend totals by cadence", () => {
    const summary = buildDashboardKpiSummary(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
    });

    expect(summary.monthlyRecurringSpendCents).toBe(8798);
    expect(summary.annualRecurringSpendCents).toBe(6000);
  });

  it("counts upcoming renewals inside the configured window", () => {
    const cards: ValidationCard[] = [
      cloneCard(MOCK_VALIDATION_CARDS[0] as ValidationCard, {
        id: "monthly-inside-window",
        lastChargedAt: "2026-04-08",
        cadence: "monthly",
        amountCents: 1200,
      }),
      cloneCard(MOCK_VALIDATION_CARDS[1] as ValidationCard, {
        id: "annual-outside-window",
        lastChargedAt: "2025-05-30",
        cadence: "annual",
        amountCents: 9000,
      }),
    ];

    const summary = buildDashboardKpiSummary(cards, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
    });

    expect(summary.upcomingRenewalsCount).toBe(1);
    expect(summary.upcomingRenewalsAmountCents).toBe(1200);
  });

  it("tracks cancellation and downgrade opportunity spend", () => {
    const summary = buildDashboardKpiSummary(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
    });

    expect(summary.cancellationOpportunityCount).toBe(2);
    expect(summary.monthlySpendAtRiskCents).toBe(8798);
    expect(summary.annualSpendAtRiskCents).toBe(0);
  });
});
