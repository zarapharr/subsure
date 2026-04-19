export type CadenceType = "weekly" | "monthly" | "quarterly" | "annual" | "irregular";

export type AmountStabilityBand = "stable" | "near_stable" | "unstable";

export type CadenceClassification = {
  cadence: CadenceType;
  score: number;
  occurrenceCount: number;
  averageIntervalDays: number | null;
};

export type AmountStabilityScore = {
  score: number;
  band: AmountStabilityBand;
  medianAmountCents: number | null;
  coefficientOfVariation: number | null;
};

type CadenceCandidate = Exclude<CadenceType, "irregular">;

const DAY_MS = 24 * 60 * 60 * 1000;

const CADENCE_TARGETS: Array<{
  cadence: CadenceCandidate;
  targetIntervalDays: number;
  toleranceDays: number;
}> = [
  { cadence: "weekly", targetIntervalDays: 7, toleranceDays: 2 },
  { cadence: "monthly", targetIntervalDays: 30.44, toleranceDays: 5 },
  { cadence: "quarterly", targetIntervalDays: 91.31, toleranceDays: 12 },
  { cadence: "annual", targetIntervalDays: 365.25, toleranceDays: 30 },
];

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toSortedChargeTimestamps(chargeDates: Date[]) {
  return chargeDates
    .map((chargeDate) => chargeDate.getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);
}

function getIntervalsInDays(sortedTimestamps: number[]) {
  const intervals: number[] = [];

  for (let idx = 1; idx < sortedTimestamps.length; idx += 1) {
    const prior = sortedTimestamps[idx - 1];
    const current = sortedTimestamps[idx];

    if (prior === undefined || current === undefined) continue;

    const intervalDays = (current - prior) / DAY_MS;
    if (intervalDays > 0) {
      intervals.push(intervalDays);
    }
  }

  return intervals;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]) {
  const avg = mean(values);
  if (avg === null) return null;

  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (mid === 0 || sorted.length % 2 === 1 || lower === undefined || upper === undefined) {
    return upper ?? null;
  }
  return (lower + upper) / 2;
}

function evaluateCadenceScore(intervalsDays: number[], cadenceTarget: (typeof CADENCE_TARGETS)[number]) {
  const avgInterval = mean(intervalsDays);
  if (avgInterval === null) return 0;

  const withinTolerance = intervalsDays.filter(
    (intervalDays) => Math.abs(intervalDays - cadenceTarget.targetIntervalDays) <= cadenceTarget.toleranceDays,
  ).length;

  const coverageScore = withinTolerance / intervalsDays.length;
  const meanDistance = Math.abs(avgInterval - cadenceTarget.targetIntervalDays);
  const meanScore = clamp01(1 - meanDistance / cadenceTarget.toleranceDays);

  const intervalStdDev = stdDev(intervalsDays) ?? cadenceTarget.targetIntervalDays;
  const varianceScore = clamp01(1 - intervalStdDev / (cadenceTarget.targetIntervalDays * 0.35));

  return clamp01(coverageScore * 0.5 + meanScore * 0.3 + varianceScore * 0.2);
}

export function classifyCadence(chargeDates: Date[]): CadenceClassification {
  const sortedTimestamps = toSortedChargeTimestamps(chargeDates);
  const intervalsDays = getIntervalsInDays(sortedTimestamps);
  const avgInterval = mean(intervalsDays);

  if (intervalsDays.length < 1) {
    return {
      cadence: "irregular",
      score: 0,
      occurrenceCount: sortedTimestamps.length,
      averageIntervalDays: avgInterval,
    };
  }

  const rankedCandidates = CADENCE_TARGETS.map((cadenceTarget) => ({
    cadence: cadenceTarget.cadence,
    score: evaluateCadenceScore(intervalsDays, cadenceTarget),
  })).sort((left, right) => right.score - left.score);

  const bestCandidate = rankedCandidates[0];
  const secondBest = rankedCandidates[1];

  if (!bestCandidate || bestCandidate.score < 0.6) {
    return {
      cadence: "irregular",
      score: bestCandidate?.score ?? 0,
      occurrenceCount: sortedTimestamps.length,
      averageIntervalDays: avgInterval,
    };
  }

  const scoreGap = bestCandidate.score - (secondBest?.score ?? 0);
  if (scoreGap < 0.1 && bestCandidate.score < 0.8) {
    return {
      cadence: "irregular",
      score: bestCandidate.score,
      occurrenceCount: sortedTimestamps.length,
      averageIntervalDays: avgInterval,
    };
  }

  return {
    cadence: bestCandidate.cadence,
    score: bestCandidate.score,
    occurrenceCount: sortedTimestamps.length,
    averageIntervalDays: avgInterval,
  };
}

export function scoreAmountStability(amountsCents: number[]): AmountStabilityScore {
  const sanitized = amountsCents.map((amount) => Math.abs(amount)).filter((amount) => Number.isFinite(amount));
  const amountMedian = median(sanitized);
  const amountMean = mean(sanitized);

  if (sanitized.length < 2 || amountMedian === null || amountMedian <= 0 || amountMean === null) {
    return {
      score: 0,
      band: "unstable",
      medianAmountCents: amountMedian,
      coefficientOfVariation: null,
    };
  }

  const amountStdDev = stdDev(sanitized) ?? 0;
  const coefficientOfVariation = amountStdDev / amountMean;

  const deviations = sanitized.map((amount) => Math.abs(amount - amountMedian) / amountMedian);
  const maxDeviation = Math.max(...deviations);

  const cvPenalty = clamp01(coefficientOfVariation / 0.25);
  const deviationPenalty = clamp01(maxDeviation / 0.3);
  const score = clamp01(1 - (cvPenalty * 0.7 + deviationPenalty * 0.3));

  const band: AmountStabilityBand = score >= 0.85 ? "stable" : score >= 0.6 ? "near_stable" : "unstable";

  return {
    score,
    band,
    medianAmountCents: amountMedian,
    coefficientOfVariation,
  };
}
