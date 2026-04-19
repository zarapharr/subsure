import { describe, expect, it } from "vitest";
import {
  createValidationDecisionSchema,
  listValidationDecisionsQuerySchema,
  toValidationHistoryEntry,
} from "@/lib/validation-decisions";

describe("validation decisions schema", () => {
  it("accepts a valid decision payload", () => {
    const parsed = createValidationDecisionSchema.safeParse({
      cardId: "card-netflix",
      merchant: "Netflix",
      decisionId: "downgrade",
      amountCents: 2299,
      cadence: "monthly",
      decidedAtIso: "2026-04-18T20:00:00.000Z",
      mergeIntoCardId: "card-netflix-family",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown decision ids", () => {
    const parsed = createValidationDecisionSchema.safeParse({
      cardId: "card-netflix",
      merchant: "Netflix",
      decisionId: "archive",
    });

    expect(parsed.success).toBe(false);
  });

  it("parses list query limit with defaults and bounds", () => {
    expect(listValidationDecisionsQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(listValidationDecisionsQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 });
    expect(() => listValidationDecisionsQuerySchema.parse({ limit: "0" })).toThrow();
  });
});

describe("validation decision mapping", () => {
  it("maps persisted records to validation history entries", () => {
    const entry = toValidationHistoryEntry({
      id: "decision-1",
      cardId: "card-netflix",
      merchant: "Netflix",
      decisionId: "keep",
      amountCents: 1599,
      cadence: "monthly",
      decidedAtIso: "2026-04-18T20:00:00.000Z",
      subscriptionCandidateId: null,
      mergeIntoCardId: "card-netflix-family",
    });

    expect(entry).toEqual({
      cardId: "card-netflix",
      merchant: "Netflix",
      decisionId: "keep",
      decidedAtIso: "2026-04-18T20:00:00.000Z",
      mergeIntoCardId: "card-netflix-family",
    });
  });
});
