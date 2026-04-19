import type { ValidationCard } from "@/lib/validation-queue";
import { resolveNextRenewalFromIsoDate } from "@/lib/reminder-scheduling";

export type DashboardKpiSummary = {
  monthlyRecurringSpendCents: number;
  annualRecurringSpendCents: number;
  upcomingRenewalsCount: number;
  upcomingRenewalsAmountCents: number;
  cancellationOpportunityCount: number;
  monthlySpendAtRiskCents: number;
  annualSpendAtRiskCents: number;
};

const CANCELLATION_OPPORTUNITY_DECISIONS = new Set(["cancel", "downgrade"]);

function resolveNextRenewal(card: ValidationCard, asOf: Date): Date | null {
  return resolveNextRenewalFromIsoDate(card.lastChargedAt, card.cadence, asOf);
}

export function formatUsdFromCents(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function buildDashboardKpiSummary(
  cards: ValidationCard[],
  params?: { asOf?: Date; renewalWindowDays?: number },
): DashboardKpiSummary {
  const asOf = params?.asOf ?? new Date();
  const renewalWindowDays = params?.renewalWindowDays ?? 30;
  const renewalWindowEnd = new Date(asOf);
  renewalWindowEnd.setUTCDate(renewalWindowEnd.getUTCDate() + renewalWindowDays);

  let monthlyRecurringSpendCents = 0;
  let annualRecurringSpendCents = 0;
  let upcomingRenewalsCount = 0;
  let upcomingRenewalsAmountCents = 0;
  let cancellationOpportunityCount = 0;
  let monthlySpendAtRiskCents = 0;
  let annualSpendAtRiskCents = 0;

  for (const card of cards) {
    if (card.cadence === "monthly") {
      monthlyRecurringSpendCents += card.amountCents;
    } else if (card.cadence === "annual") {
      annualRecurringSpendCents += card.amountCents;
    }

    const nextRenewal = resolveNextRenewal(card, asOf);
    if (nextRenewal && nextRenewal <= renewalWindowEnd) {
      upcomingRenewalsCount += 1;
      upcomingRenewalsAmountCents += card.amountCents;
    }

    if (CANCELLATION_OPPORTUNITY_DECISIONS.has(card.recommendation)) {
      cancellationOpportunityCount += 1;
      if (card.cadence === "monthly") {
        monthlySpendAtRiskCents += card.amountCents;
      } else {
        annualSpendAtRiskCents += card.amountCents;
      }
    }
  }

  return {
    monthlyRecurringSpendCents,
    annualRecurringSpendCents,
    upcomingRenewalsCount,
    upcomingRenewalsAmountCents,
    cancellationOpportunityCount,
    monthlySpendAtRiskCents,
    annualSpendAtRiskCents,
  };
}
