import type { ValidationCard } from "@/lib/validation-queue";
import {
  isReminderCadence,
  resolveNextRenewalFromIsoDate,
  type ReminderCadence,
} from "@/lib/reminder-scheduling";

const AT_RISK_RECOMMENDATIONS = new Set<ValidationCard["recommendation"]>(["cancel", "downgrade"]);
const EXCLUDED_TIMELINE_RECOMMENDATIONS = new Set<ValidationCard["recommendation"]>(["not_mine", "duplicate"]);
const RECOMMENDATION_LABELS: Record<ValidationCard["recommendation"], string> = {
  keep: "Keep",
  cancel: "Cancel",
  downgrade: "Downgrade",
  review_later: "Review later",
  not_mine: "Not mine",
  duplicate: "Duplicate",
};

export type RenewalConfidenceBand = "high" | "medium" | "low";

export type AtRiskSubscriptionItem = {
  cardId: string;
  merchant: string;
  amountCents: number;
  cadence: ValidationCard["cadence"];
  recommendation: ValidationCard["recommendation"];
  reasonSummary: string;
};

export type RenewalTimelineItem = {
  cardId: string;
  merchant: string;
  amountCents: number;
  cadence: ValidationCard["cadence"];
  nextRenewalIso: string;
  confidenceScore: number;
  confidenceBand: RenewalConfidenceBand;
  suggestedActionId: ValidationCard["recommendation"];
  suggestedActionLabel: string;
  suggestedActionSummary: string;
};

export type DashboardListModules = {
  atRiskSubscriptions: AtRiskSubscriptionItem[];
  renewalTimeline: RenewalTimelineItem[];
};

export type RenewalTimelineSort = "soonest" | "latest" | "amount_desc" | "amount_asc";

function toConfidenceBand(score: number): RenewalConfidenceBand {
  if (score >= 0.9) return "high";
  if (score >= 0.75) return "medium";
  return "low";
}

function resolveNextRenewal(card: ValidationCard, asOf: Date): Date | null {
  if (!isReminderCadence(card.cadence)) return null;
  return resolveNextRenewalFromIsoDate(card.lastChargedAt, card.cadence as ReminderCadence, asOf);
}

export function buildDashboardListModules(
  cards: ValidationCard[],
  params?: {
    asOf?: Date;
    renewalWindowDays?: number;
    atRiskLimit?: number;
    renewalLimit?: number;
    renewalSort?: RenewalTimelineSort;
  },
): DashboardListModules {
  const asOf = params?.asOf ?? new Date();
  const renewalWindowDays = params?.renewalWindowDays ?? 90;
  const atRiskLimit = params?.atRiskLimit ?? 5;
  const renewalLimit = params?.renewalLimit ?? 8;
  const renewalSort = params?.renewalSort ?? "soonest";
  const renewalWindowEnd = new Date(asOf);
  renewalWindowEnd.setUTCDate(renewalWindowEnd.getUTCDate() + renewalWindowDays);

  const atRiskSubscriptions = cards
    .filter((card) => AT_RISK_RECOMMENDATIONS.has(card.recommendation))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, atRiskLimit)
    .map((card) => ({
      cardId: card.id,
      merchant: card.merchant,
      amountCents: card.amountCents,
      cadence: card.cadence,
      recommendation: card.recommendation,
      reasonSummary: card.recommendationReason.summary,
    }));

  const renewalTimeline = cards
    .filter((card) => !EXCLUDED_TIMELINE_RECOMMENDATIONS.has(card.recommendation))
    .map((card) => {
      const nextRenewal = resolveNextRenewal(card, asOf);
      if (!nextRenewal || nextRenewal > renewalWindowEnd) return null;

      return {
        cardId: card.id,
        merchant: card.merchant,
        amountCents: card.amountCents,
        cadence: card.cadence,
        nextRenewalIso: nextRenewal.toISOString(),
        confidenceScore: card.confidenceScore,
        confidenceBand: toConfidenceBand(card.confidenceScore),
        suggestedActionId: card.recommendation,
        suggestedActionLabel: RECOMMENDATION_LABELS[card.recommendation],
        suggestedActionSummary: card.recommendationReason.summary,
      };
    })
    .filter((item): item is RenewalTimelineItem => item !== null)
    .sort((a, b) => {
      const dateDiff = new Date(a.nextRenewalIso).getTime() - new Date(b.nextRenewalIso).getTime();
      const amountDiff = b.amountCents - a.amountCents;

      if (renewalSort === "latest") {
        if (dateDiff !== 0) return -dateDiff;
        return amountDiff;
      }

      if (renewalSort === "amount_desc") {
        if (amountDiff !== 0) return amountDiff;
        return dateDiff;
      }

      if (renewalSort === "amount_asc") {
        if (amountDiff !== 0) return -amountDiff;
        return dateDiff;
      }

      if (dateDiff !== 0) return dateDiff;
      return amountDiff;
    })
    .slice(0, renewalLimit);

  return {
    atRiskSubscriptions,
    renewalTimeline,
  };
}
