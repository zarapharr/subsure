export const VALIDATION_DECISIONS = [
  {
    id: "keep",
    label: "Keep",
    description: "You still use this service.",
    shortcut: "k",
    toneClassName: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  {
    id: "cancel",
    label: "Cancel",
    description: "You plan to stop this service.",
    shortcut: "c",
    toneClassName: "border-rose-300 bg-rose-50 text-rose-900",
  },
  {
    id: "downgrade",
    label: "Downgrade",
    description: "Keep access on a lower-cost tier, if available.",
    shortcut: "d",
    toneClassName: "border-amber-300 bg-amber-50 text-amber-900",
  },
  {
    id: "review_later",
    label: "Review later",
    description: "Come back once you have more context.",
    shortcut: "r",
    toneClassName: "border-slate-300 bg-slate-100 text-slate-900",
  },
  {
    id: "not_mine",
    label: "Not mine",
    description: "This charge does not belong to you.",
    shortcut: "n",
    toneClassName: "border-cyan-300 bg-cyan-50 text-cyan-900",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    description: "Same subscription represented twice.",
    shortcut: "u",
    toneClassName: "border-violet-300 bg-violet-50 text-violet-900",
  },
] as const;

export type ValidationDecisionId = (typeof VALIDATION_DECISIONS)[number]["id"];

export type ValidationRecommendationReason = {
  summary: string;
  evidence: string[];
  confidenceNote: string;
};

export type ValidationCardTransaction = {
  id: string;
  postedAt: string;
  amountCents: number;
  accountLabel: string;
};

export type DuplicateMergeTarget = {
  cardId: string;
  merchant: string;
  accountLabel: string;
  amountCents: number;
  lastChargedAt: string;
  reason: string;
};

export type ValidationCard = {
  id: string;
  merchant: string;
  amountCents: number;
  cadence: "monthly" | "annual";
  lastChargedAt: string;
  confidenceScore: number;
  accountLabel: string;
  recommendation: ValidationDecisionId;
  recommendationReason: ValidationRecommendationReason;
  transactionHistory: ValidationCardTransaction[];
  duplicateMergeTargets?: DuplicateMergeTarget[];
};

export type ValidationDecision = (typeof VALIDATION_DECISIONS)[number];

export type ValidationHistoryEntry = {
  cardId: string;
  merchant: string;
  decisionId: ValidationDecisionId;
  decidedAtIso: string;
  mergeIntoCardId?: string | null;
};

const decisionById = new Map<ValidationDecisionId, ValidationDecision>(
  VALIDATION_DECISIONS.map((decision) => [decision.id, decision]),
);

const shortcutPairs: Array<readonly [string, ValidationDecisionId]> = [
  ...VALIDATION_DECISIONS.map((decision) => [decision.shortcut, decision.id] as const),
  ["1", "keep"],
  ["2", "cancel"],
  ["3", "downgrade"],
  ["4", "review_later"],
  ["5", "not_mine"],
  ["6", "duplicate"],
];

const decisionByShortcut = new Map<string, ValidationDecisionId>(shortcutPairs);

export function getDecisionById(id: ValidationDecisionId): ValidationDecision {
  const decision = decisionById.get(id);
  if (!decision) {
    throw new Error(`Unknown validation decision: ${id}`);
  }

  return decision;
}

export function resolveDecisionFromKey(key: string): ValidationDecisionId | null {
  return decisionByShortcut.get(key.toLowerCase()) ?? null;
}

export const MOCK_VALIDATION_CARDS: ValidationCard[] = [
  {
    id: "card-netflix",
    merchant: "Netflix",
    amountCents: 2299,
    cadence: "monthly",
    lastChargedAt: "2026-04-09",
    confidenceScore: 0.97,
    accountLabel: "Chase Freedom",
    recommendation: "downgrade",
    recommendationReason: {
      summary: "Recent viewing activity is lower than earlier months.",
      evidence: [
        "Usage dropped during the last 60 days compared with prior periods.",
        "A lower-cost ad-supported tier is available for this service.",
      ],
      confidenceNote: "This is a suggestion based on linked activity and billing data.",
    },
    transactionHistory: [
      { id: "txn-netflix-2026-04", postedAt: "2026-04-09", amountCents: -2299, accountLabel: "Chase Freedom" },
      { id: "txn-netflix-2026-03", postedAt: "2026-03-09", amountCents: -2299, accountLabel: "Chase Freedom" },
      { id: "txn-netflix-2026-02", postedAt: "2026-02-09", amountCents: -1999, accountLabel: "Chase Freedom" },
      { id: "txn-netflix-2026-01", postedAt: "2026-01-09", amountCents: -1999, accountLabel: "Chase Freedom" },
      { id: "txn-netflix-2025-12", postedAt: "2025-12-09", amountCents: -1999, accountLabel: "Chase Freedom" },
    ],
    duplicateMergeTargets: [
      {
        cardId: "card-netflix-family",
        merchant: "Netflix Family",
        accountLabel: "Amex Gold",
        amountCents: 2299,
        lastChargedAt: "2026-04-10",
        reason: "Matching amount and billing date on another linked card.",
      },
    ],
  },
  {
    id: "card-adobe",
    merchant: "Adobe Creative Cloud",
    amountCents: 6499,
    cadence: "monthly",
    lastChargedAt: "2026-04-03",
    confidenceScore: 0.94,
    accountLabel: "Amex Gold",
    recommendation: "cancel",
    recommendationReason: {
      summary: "We did not detect recent usage in connected activity for this billing period.",
      evidence: [
        "No matching product activity was found in linked accounts this month.",
        "Monthly billing remained at the full plan amount.",
      ],
      confidenceNote: "Connected accounts can be incomplete, so verify before deciding.",
    },
    transactionHistory: [
      { id: "txn-adobe-2026-04", postedAt: "2026-04-03", amountCents: -6499, accountLabel: "Amex Gold" },
      { id: "txn-adobe-2026-03", postedAt: "2026-03-03", amountCents: -6499, accountLabel: "Amex Gold" },
      { id: "txn-adobe-2026-02", postedAt: "2026-02-03", amountCents: -6499, accountLabel: "Amex Gold" },
      { id: "txn-adobe-2026-01", postedAt: "2026-01-03", amountCents: -6499, accountLabel: "Amex Gold" },
    ],
  },
  {
    id: "card-costco",
    merchant: "Costco Membership",
    amountCents: 6000,
    cadence: "annual",
    lastChargedAt: "2026-03-28",
    confidenceScore: 0.9,
    accountLabel: "BofA Cash Rewards",
    recommendation: "keep",
    recommendationReason: {
      summary: "Signals indicate this membership is still actively used.",
      evidence: [
        "Renewal pattern has been stable year over year.",
        "Recent in-person warehouse spend was detected on the linked account.",
      ],
      confidenceNote: "Recommendation confidence is directional and may miss offline behavior.",
    },
    transactionHistory: [
      {
        id: "txn-costco-2026",
        postedAt: "2026-03-28",
        amountCents: -6000,
        accountLabel: "BofA Cash Rewards",
      },
      {
        id: "txn-costco-2025",
        postedAt: "2025-03-28",
        amountCents: -6000,
        accountLabel: "BofA Cash Rewards",
      },
      {
        id: "txn-costco-2024",
        postedAt: "2024-03-28",
        amountCents: -6000,
        accountLabel: "BofA Cash Rewards",
      },
    ],
  },
];
