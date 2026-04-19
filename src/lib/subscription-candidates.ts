import { and, eq, notInArray } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { subscriptionCandidates } from "@/db/schema";
import {
  normalizeMerchantDescriptor,
  type MerchantConfidenceBand,
} from "@/lib/merchant-normalization";
import { classifyCadence, scoreAmountStability, type CadenceType } from "@/lib/recurring-detection";

export type TransactionInput = {
  amountCents: number;
  merchantDescriptor: string;
  postedAt: Date;
};

export type SubscriptionCandidateDraft = {
  userId: string;
  merchantNormalized: string;
  displayName: string;
  estimatedAmountCents: number | null;
  cadence: CadenceType;
  confidenceBand: MerchantConfidenceBand;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  occurrenceCount: number;
};

export type CandidatePersistenceSummary = {
  inserted: number;
  updated: number;
  deactivated: number;
  candidateCount: number;
};

const MERCHANT_CONFIDENCE_WEIGHTS: Record<MerchantConfidenceBand, number> = {
  high: 1,
  medium: 0.7,
  low: 0.35,
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toConfidenceBand(score: number): MerchantConfidenceBand {
  if (score >= 0.78) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function pickBestMerchantConfidence(bands: MerchantConfidenceBand[]) {
  return bands.reduce<MerchantConfidenceBand>((best, current) => {
    return MERCHANT_CONFIDENCE_WEIGHTS[current] > MERCHANT_CONFIDENCE_WEIGHTS[best] ? current : best;
  }, "low");
}

function pickEstimatedAmountCents(amountsCents: number[]) {
  if (amountsCents.length === 0) return null;

  const sorted = [...amountsCents].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];

  if (mid === 0 || sorted.length % 2 === 1 || lower === undefined || upper === undefined) {
    return upper ?? null;
  }

  return Math.round((lower + upper) / 2);
}

function combineConfidenceScores(params: {
  merchantBand: MerchantConfidenceBand;
  cadenceScore: number;
  amountStabilityScore: number;
}) {
  const merchantWeight = MERCHANT_CONFIDENCE_WEIGHTS[params.merchantBand];
  const weightedScore =
    clamp01(params.cadenceScore) * 0.45 +
    clamp01(params.amountStabilityScore) * 0.35 +
    clamp01(merchantWeight) * 0.2;

  return {
    score: clamp01(weightedScore),
    band: toConfidenceBand(weightedScore),
  };
}

export function deriveSubscriptionCandidates(
  userId: string,
  transactions: TransactionInput[],
): SubscriptionCandidateDraft[] {
  const grouped = new Map<
    string,
    Array<{ amountCents: number; postedAt: Date; merchantBand: MerchantConfidenceBand; displayName: string }>
  >();

  for (const transaction of transactions) {
    if (!transaction.merchantDescriptor?.trim()) continue;

    const normalized = normalizeMerchantDescriptor(transaction.merchantDescriptor);
    const merchantNormalized = normalized.canonicalName;

    if (!merchantNormalized || merchantNormalized === "unknown_merchant") continue;

    const postedAt = transaction.postedAt instanceof Date ? transaction.postedAt : new Date(transaction.postedAt);
    if (!Number.isFinite(postedAt.getTime())) continue;

    const group = grouped.get(merchantNormalized);
    const normalizedAmount = Math.abs(Math.round(transaction.amountCents));
    if (!Number.isFinite(normalizedAmount)) continue;

    const entry = {
      amountCents: normalizedAmount,
      postedAt,
      merchantBand: normalized.confidenceBand,
      displayName: normalized.displayName,
    };

    if (group) {
      group.push(entry);
    } else {
      grouped.set(merchantNormalized, [entry]);
    }
  }

  const candidates: SubscriptionCandidateDraft[] = [];

  for (const [merchantNormalized, entries] of grouped.entries()) {
    if (entries.length < 2) continue;

    const sortedByDate = [...entries].sort((left, right) => left.postedAt.getTime() - right.postedAt.getTime());
    const chargeDates = sortedByDate.map((entry) => entry.postedAt);
    const amountsCents = sortedByDate.map((entry) => entry.amountCents);

    const cadence = classifyCadence(chargeDates);
    const amountStability = scoreAmountStability(amountsCents);
    const merchantBand = pickBestMerchantConfidence(entries.map((entry) => entry.merchantBand));
    const combinedConfidence = combineConfidenceScores({
      merchantBand,
      cadenceScore: cadence.score,
      amountStabilityScore: amountStability.score,
    });

    const firstSeenAt = sortedByDate[0]?.postedAt ?? null;
    const lastSeenAt = sortedByDate[sortedByDate.length - 1]?.postedAt ?? null;
    const displayName = sortedByDate[0]?.displayName ?? merchantNormalized;

    candidates.push({
      userId,
      merchantNormalized,
      displayName,
      estimatedAmountCents:
        amountStability.medianAmountCents !== null
          ? Math.round(amountStability.medianAmountCents)
          : pickEstimatedAmountCents(amountsCents),
      cadence: cadence.cadence,
      confidenceBand: combinedConfidence.band,
      firstSeenAt,
      lastSeenAt,
      occurrenceCount: sortedByDate.length,
    });
  }

  return candidates.sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    return left.merchantNormalized.localeCompare(right.merchantNormalized);
  });
}

export async function persistSubscriptionCandidates(
  database: Database,
  userId: string,
  candidates: SubscriptionCandidateDraft[],
): Promise<CandidatePersistenceSummary> {
  const existingRows = await database
    .select({
      id: subscriptionCandidates.id,
      merchantNormalized: subscriptionCandidates.merchantNormalized,
      isActive: subscriptionCandidates.isActive,
    })
    .from(subscriptionCandidates)
    .where(eq(subscriptionCandidates.userId, userId));

  const existingByMerchant = new Map(existingRows.map((row) => [row.merchantNormalized, row]));

  let inserted = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existing = existingByMerchant.get(candidate.merchantNormalized);

    if (existing) {
      await database
        .update(subscriptionCandidates)
        .set({
          displayName: candidate.displayName,
          estimatedAmountCents: candidate.estimatedAmountCents,
          cadence: candidate.cadence,
          confidenceBand: candidate.confidenceBand,
          firstSeenAt: candidate.firstSeenAt,
          lastSeenAt: candidate.lastSeenAt,
          occurrenceCount: candidate.occurrenceCount,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionCandidates.id, existing.id));
      updated += 1;
    } else {
      await database.insert(subscriptionCandidates).values({
        userId,
        merchantNormalized: candidate.merchantNormalized,
        displayName: candidate.displayName,
        estimatedAmountCents: candidate.estimatedAmountCents,
        cadence: candidate.cadence,
        confidenceBand: candidate.confidenceBand,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        occurrenceCount: candidate.occurrenceCount,
        isActive: true,
      });
      inserted += 1;
    }
  }

  const activeMerchants = candidates.map((candidate) => candidate.merchantNormalized);
  let deactivated = 0;

  if (activeMerchants.length === 0) {
    const deactivatedRows = await database
      .update(subscriptionCandidates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(subscriptionCandidates.userId, userId), eq(subscriptionCandidates.isActive, true)))
      .returning({ id: subscriptionCandidates.id });

    deactivated = deactivatedRows.length;
  } else {
    const deactivatedRows = await database
      .update(subscriptionCandidates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionCandidates.userId, userId),
          eq(subscriptionCandidates.isActive, true),
          notInArray(subscriptionCandidates.merchantNormalized, activeMerchants),
        ),
      )
      .returning({ id: subscriptionCandidates.id });

    deactivated = deactivatedRows.length;
  }

  return {
    inserted,
    updated,
    deactivated,
    candidateCount: candidates.length,
  };
}

export async function syncSubscriptionCandidatesForUser(params: {
  userId: string;
  transactions: TransactionInput[];
  database?: Database;
}) {
  const database = params.database ?? db;
  const candidates = deriveSubscriptionCandidates(params.userId, params.transactions);

  const persistence = await persistSubscriptionCandidates(database, params.userId, candidates);

  return {
    ...persistence,
    candidates,
  };
}
