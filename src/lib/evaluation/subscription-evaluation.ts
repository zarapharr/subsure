import { deriveSubscriptionCandidates } from "@/lib/subscription-candidates";
import type { MerchantConfidenceBand } from "@/lib/merchant-normalization";
import type { OfflineSubscriptionFixtureCase } from "@/lib/evaluation/offline-subscription-fixtures";

export type EvaluationError = {
  fixtureId: string;
  kind: "false_positive" | "false_negative";
  merchantNormalized: string;
};

export type FixtureCaseResult = {
  fixtureId: string;
  expectedRecurringMerchants: string[];
  predictedRecurringMerchants: string[];
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
};

export type SubscriptionEvaluationResult = {
  fixtureCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  caseResults: FixtureCaseResult[];
  errors: EvaluationError[];
};

const CONFIDENCE_ORDER: Record<MerchantConfidenceBand, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function normalizeMerchantList(merchants: string[]) {
  return Array.from(new Set(merchants.filter(Boolean))).sort();
}

function computeRatio(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function evaluateSubscriptionFixtures(
  fixtures: OfflineSubscriptionFixtureCase[],
  options?: { minConfidenceBand?: MerchantConfidenceBand },
): SubscriptionEvaluationResult {
  const minConfidenceBand = options?.minConfidenceBand ?? "low";
  const minimumWeight = CONFIDENCE_ORDER[minConfidenceBand];

  const caseResults: FixtureCaseResult[] = [];
  const errors: EvaluationError[] = [];

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const fixture of fixtures) {
    const transactions = fixture.transactions.map((transaction) => ({
      merchantDescriptor: transaction.merchantDescriptor,
      amountCents: transaction.amountCents,
      postedAt: new Date(`${transaction.postedAtIso}T00:00:00.000Z`),
    }));

    const predictedCandidates = deriveSubscriptionCandidates(fixture.userId, transactions).filter(
      (candidate) => CONFIDENCE_ORDER[candidate.confidenceBand] >= minimumWeight,
    );

    const expected = new Set(normalizeMerchantList(fixture.expectedRecurringMerchants));
    const predicted = new Set(normalizeMerchantList(predictedCandidates.map((candidate) => candidate.merchantNormalized)));

    const caseTruePositives = Array.from(predicted).filter((merchant) => expected.has(merchant));
    const caseFalsePositives = Array.from(predicted).filter((merchant) => !expected.has(merchant));
    const caseFalseNegatives = Array.from(expected).filter((merchant) => !predicted.has(merchant));

    truePositives += caseTruePositives.length;
    falsePositives += caseFalsePositives.length;
    falseNegatives += caseFalseNegatives.length;

    for (const merchantNormalized of caseFalsePositives) {
      errors.push({ fixtureId: fixture.id, kind: "false_positive", merchantNormalized });
    }

    for (const merchantNormalized of caseFalseNegatives) {
      errors.push({ fixtureId: fixture.id, kind: "false_negative", merchantNormalized });
    }

    caseResults.push({
      fixtureId: fixture.id,
      expectedRecurringMerchants: Array.from(expected),
      predictedRecurringMerchants: Array.from(predicted),
      truePositives: caseTruePositives.length,
      falsePositives: caseFalsePositives.length,
      falseNegatives: caseFalseNegatives.length,
    });
  }

  const precision = computeRatio(truePositives, truePositives + falsePositives);
  const recall = computeRatio(truePositives, truePositives + falseNegatives);
  const f1Score = computeRatio(2 * precision * recall, precision + recall);

  return {
    fixtureCount: fixtures.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1Score,
    caseResults,
    errors,
  };
}
