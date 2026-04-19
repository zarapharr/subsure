import { and, eq, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { subscriptionCandidates, validationDecisions } from "@/db/schema";
import type { DashboardKpiSummary } from "@/lib/dashboard-kpis";
import { resolveNextRenewalFromLastCharge } from "@/lib/reminder-scheduling";
import type { ValidationDecisionId } from "@/lib/validation-queue";

type KpiDecisionRow = {
  cardId: string;
  decisionId: ValidationDecisionId;
  amountCents: number | null;
  cadence: "monthly" | "annual" | null;
  lastSeenAt: Date | null;
};

const CANCELLATION_OPPORTUNITY_DECISIONS = new Set<ValidationDecisionId>(["cancel", "downgrade"]);
const EXCLUDED_DECISIONS = new Set<ValidationDecisionId>(["not_mine", "duplicate"]);

function resolveNextRenewal(lastSeenAt: Date | null, cadence: "monthly" | "annual", asOf: Date): Date | null {
  if (!lastSeenAt) return null;
  return resolveNextRenewalFromLastCharge(lastSeenAt, cadence, asOf);
}

export function summarizeDashboardKpisFromDecisionRows(
  rows: KpiDecisionRow[],
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

  for (const row of rows) {
    if (EXCLUDED_DECISIONS.has(row.decisionId)) continue;
    if (!row.cadence || row.amountCents === null) continue;

    if (row.cadence === "monthly") {
      monthlyRecurringSpendCents += row.amountCents;
    } else {
      annualRecurringSpendCents += row.amountCents;
    }

    const nextRenewal = resolveNextRenewal(row.lastSeenAt, row.cadence, asOf);
    if (nextRenewal && nextRenewal <= renewalWindowEnd) {
      upcomingRenewalsCount += 1;
      upcomingRenewalsAmountCents += row.amountCents;
    }

    if (CANCELLATION_OPPORTUNITY_DECISIONS.has(row.decisionId)) {
      cancellationOpportunityCount += 1;
      if (row.cadence === "monthly") {
        monthlySpendAtRiskCents += row.amountCents;
      } else {
        annualSpendAtRiskCents += row.amountCents;
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

export async function getDashboardKpiSummaryForUser(
  userId: string,
  params?: { asOf?: Date; renewalWindowDays?: number; database?: Database },
): Promise<DashboardKpiSummary> {
  const database = params?.database ?? db;

  const latestDecisionRows = database.$with("latest_decision_rows").as(
    database
      .select({
        cardId: validationDecisions.cardId,
        decisionId: validationDecisions.decisionId,
        amountCents: validationDecisions.amountCents,
        cadence: validationDecisions.cadence,
        lastSeenAt: subscriptionCandidates.lastSeenAt,
        rowNumber: sql<number>`row_number() over (
          partition by ${validationDecisions.cardId}
          order by ${validationDecisions.decidedAt} desc, ${validationDecisions.createdAt} desc, ${validationDecisions.id} desc
        )`,
      })
      .from(validationDecisions)
      .leftJoin(
        subscriptionCandidates,
        and(
          eq(validationDecisions.subscriptionCandidateId, subscriptionCandidates.id),
          eq(validationDecisions.userId, subscriptionCandidates.userId),
        ),
      )
      .where(eq(validationDecisions.userId, userId)),
  );

  const rows = await database
    .with(latestDecisionRows)
    .select({
      cardId: latestDecisionRows.cardId,
      decisionId: latestDecisionRows.decisionId,
      amountCents: latestDecisionRows.amountCents,
      cadence: latestDecisionRows.cadence,
      lastSeenAt: latestDecisionRows.lastSeenAt,
    })
    .from(latestDecisionRows)
    .where(eq(latestDecisionRows.rowNumber, 1));

  return summarizeDashboardKpisFromDecisionRows(
    rows.map((row) => ({
      cardId: row.cardId,
      decisionId: row.decisionId as ValidationDecisionId,
      amountCents: row.amountCents,
      cadence: (row.cadence as "monthly" | "annual" | null) ?? null,
      lastSeenAt: row.lastSeenAt,
    })),
    params,
  );
}
