export type OfflineFixtureTransaction = {
  merchantDescriptor: string;
  amountCents: number;
  postedAtIso: string;
};

export type OfflineSubscriptionFixtureCase = {
  id: string;
  description: string;
  userId: string;
  transactions: OfflineFixtureTransaction[];
  expectedRecurringMerchants: string[];
};

export const OFFLINE_SUBSCRIPTION_FIXTURES: OfflineSubscriptionFixtureCase[] = [
  {
    id: "fixture-netflix-monthly",
    description: "Known monthly recurring merchant plus unrelated one-off purchase",
    userId: "fixture-user-1",
    transactions: [
      { merchantDescriptor: "NETFLIX.COM 408-540-3700 CA", amountCents: -1599, postedAtIso: "2025-10-05" },
      { merchantDescriptor: "NETFLIX.COM 408-540-3700 CA", amountCents: -1599, postedAtIso: "2025-11-05" },
      { merchantDescriptor: "NETFLIX.COM 408-540-3700 CA", amountCents: -1599, postedAtIso: "2025-12-05" },
      { merchantDescriptor: "NETFLIX.COM 408-540-3700 CA", amountCents: -1599, postedAtIso: "2026-01-05" },
      { merchantDescriptor: "AMZN Mktp US*2A3B4C5D6 Amzn.com/bill WA", amountCents: -2899, postedAtIso: "2026-01-17" },
    ],
    expectedRecurringMerchants: ["netflix"],
  },
  {
    id: "fixture-notion-weekly",
    description: "Rule-based merchant with steady weekly cadence",
    userId: "fixture-user-2",
    transactions: [
      { merchantDescriptor: "NOTION LABS INC SF CA", amountCents: -799, postedAtIso: "2026-01-02" },
      { merchantDescriptor: "NOTION LABS INC SF CA", amountCents: -799, postedAtIso: "2026-01-09" },
      { merchantDescriptor: "NOTION LABS INC SF CA", amountCents: -799, postedAtIso: "2026-01-16" },
      { merchantDescriptor: "NOTION LABS INC SF CA", amountCents: -799, postedAtIso: "2026-01-23" },
      { merchantDescriptor: "NOTION LABS INC SF CA", amountCents: -799, postedAtIso: "2026-01-30" },
    ],
    expectedRecurringMerchants: ["notion"],
  },
  {
    id: "fixture-false-positive-irregular",
    description: "Irregular same-merchant spend that should not be considered recurring",
    userId: "fixture-user-3",
    transactions: [
      { merchantDescriptor: "PAYPAL *ACME VIDEO SERVICES 8001234567 TX", amountCents: -1000, postedAtIso: "2026-01-02" },
      { merchantDescriptor: "PAYPAL *ACME VIDEO SERVICES 8001234567 TX", amountCents: -1800, postedAtIso: "2026-01-11" },
      { merchantDescriptor: "PAYPAL *ACME VIDEO SERVICES 8001234567 TX", amountCents: -700, postedAtIso: "2026-02-18" },
      { merchantDescriptor: "PAYPAL *ACME VIDEO SERVICES 8001234567 TX", amountCents: -2200, postedAtIso: "2026-04-03" },
    ],
    expectedRecurringMerchants: [],
  },
  {
    id: "fixture-false-negative-single-occurrence",
    description: "Expected recurring charge with only one observed event",
    userId: "fixture-user-4",
    transactions: [{ merchantDescriptor: "HULU.COM/BILL CA", amountCents: -1799, postedAtIso: "2026-03-03" }],
    expectedRecurringMerchants: ["hulu"],
  },
  {
    id: "fixture-multi-merchant-monthly",
    description: "Two true monthly subscriptions for one user",
    userId: "fixture-user-5",
    transactions: [
      { merchantDescriptor: "SPOTIFY USA 877-778-1161 NY", amountCents: -1299, postedAtIso: "2025-11-08" },
      { merchantDescriptor: "SPOTIFY USA 877-778-1161 NY", amountCents: -1299, postedAtIso: "2025-12-08" },
      { merchantDescriptor: "SPOTIFY USA 877-778-1161 NY", amountCents: -1299, postedAtIso: "2026-01-08" },
      { merchantDescriptor: "APPLE.COM/BILL 866-712-7753 CA", amountCents: -999, postedAtIso: "2025-11-12" },
      { merchantDescriptor: "APPLE.COM/BILL 866-712-7753 CA", amountCents: -999, postedAtIso: "2025-12-12" },
      { merchantDescriptor: "APPLE.COM/BILL 866-712-7753 CA", amountCents: -1099, postedAtIso: "2026-01-12" },
    ],
    expectedRecurringMerchants: ["spotify", "apple"],
  },
];
