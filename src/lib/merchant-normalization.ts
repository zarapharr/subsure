export type MerchantConfidenceBand = "high" | "medium" | "low";

export type MerchantNormalizationResult = {
  canonicalName: string;
  displayName: string;
  confidenceBand: MerchantConfidenceBand;
  cleanedDescriptor: string;
};

type MerchantRule = {
  canonicalName: string;
  displayName: string;
  patterns: RegExp[];
};

const NOISE_TOKENS = new Set([
  "ACH",
  "AM",
  "AUTOPAY",
  "CARD",
  "CHECKCARD",
  "COM",
  "DBT",
  "DEBIT",
  "HELPPAY",
  "INC",
  "ONLINE",
  "PAYMENT",
  "POS",
  "PURCHASE",
  "RECURRING",
  "SQ",
  "STORE",
  "SUBSCRIPTION",
  "US",
  "USA",
  "VISA",
  "WWW",
]);

const STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

const MERCHANT_RULES: MerchantRule[] = [
  { canonicalName: "netflix", displayName: "Netflix", patterns: [/\bNETFLIX\b/] },
  { canonicalName: "spotify", displayName: "Spotify", patterns: [/\bSPOTIFY\b/] },
  { canonicalName: "youtube", displayName: "YouTube", patterns: [/\bYOUTUBE\b/] },
  { canonicalName: "apple", displayName: "Apple", patterns: [/\bAPPLE\b/] },
  { canonicalName: "amazon", displayName: "Amazon", patterns: [/\bAMZN\b/, /\bAMAZON\b/] },
  { canonicalName: "hulu", displayName: "Hulu", patterns: [/\bHULU\b/] },
  { canonicalName: "notion", displayName: "Notion", patterns: [/\bNOTION\b/] },
  { canonicalName: "figma", displayName: "Figma", patterns: [/\bFIGMA\b/] },
];

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function tokenizeDescriptor(raw: string) {
  const upper = raw
    .toUpperCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\w]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = upper.split(" ").filter(Boolean);

  const cleanedTokens = tokens.filter((token, idx) => {
    if (NOISE_TOKENS.has(token)) return false;
    if (/^\d+$/.test(token)) return false;
    if (/^\d+[A-Z]+$/.test(token)) return false;
    if (/^[A-Z]+\d+$/.test(token)) return false;
    if (/^[A-Z0-9]{9,}$/.test(token)) return false;
    if (token.length === 1) return false;
    if (idx === tokens.length - 1 && STATE_CODES.has(token)) return false;
    return true;
  });

  return cleanedTokens;
}

function findRule(cleanedDescriptor: string) {
  return MERCHANT_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(cleanedDescriptor)));
}

export function normalizeMerchantDescriptor(rawDescriptor: string): MerchantNormalizationResult {
  const cleanedTokens = tokenizeDescriptor(rawDescriptor);
  const cleanedDescriptor = cleanedTokens.join(" ").trim();
  const matchedRule = findRule(cleanedDescriptor);

  if (matchedRule) {
    return {
      canonicalName: matchedRule.canonicalName,
      displayName: matchedRule.displayName,
      confidenceBand: "high",
      cleanedDescriptor,
    };
  }

  if (cleanedTokens.length === 0) {
    return {
      canonicalName: "unknown_merchant",
      displayName: "Unknown Merchant",
      confidenceBand: "low",
      cleanedDescriptor: "",
    };
  }

  const fallbackTokens = cleanedTokens.slice(0, 3);
  const fallbackDescriptor = fallbackTokens.join(" ");

  return {
    canonicalName: slugify(fallbackDescriptor),
    displayName: toTitleCase(fallbackDescriptor),
    confidenceBand: "medium",
    cleanedDescriptor,
  };
}

export function mapDescriptorsToCanonicalNames(rawDescriptors: string[]) {
  return rawDescriptors.map((rawDescriptor) => ({
    rawDescriptor,
    normalized: normalizeMerchantDescriptor(rawDescriptor),
  }));
}

export function groupDescriptorsByCanonicalName(rawDescriptors: string[]) {
  const groups: Record<string, string[]> = {};

  for (const { rawDescriptor, normalized } of mapDescriptorsToCanonicalNames(rawDescriptors)) {
    const canonicalName = normalized.canonicalName;
    const group = groups[canonicalName];
    if (group) {
      group.push(rawDescriptor);
    } else {
      groups[canonicalName] = [rawDescriptor];
    }
  }

  return groups;
}
