import { describe, expect, it } from "vitest";
import { MOCK_VALIDATION_CARDS, VALIDATION_DECISIONS, getDecisionById, resolveDecisionFromKey } from "@/lib/validation-queue";

describe("validation queue decisions", () => {
  it("includes exactly the six required decision actions", () => {
    expect(VALIDATION_DECISIONS.map((decision) => decision.id)).toEqual([
      "keep",
      "cancel",
      "downgrade",
      "review_later",
      "not_mine",
      "duplicate",
    ]);
  });

  it("maps numeric shortcuts 1-6 to each decision", () => {
    expect(resolveDecisionFromKey("1")).toBe("keep");
    expect(resolveDecisionFromKey("2")).toBe("cancel");
    expect(resolveDecisionFromKey("3")).toBe("downgrade");
    expect(resolveDecisionFromKey("4")).toBe("review_later");
    expect(resolveDecisionFromKey("5")).toBe("not_mine");
    expect(resolveDecisionFromKey("6")).toBe("duplicate");
  });

  it("maps letter shortcuts case-insensitively", () => {
    expect(resolveDecisionFromKey("k")).toBe("keep");
    expect(resolveDecisionFromKey("C")).toBe("cancel");
    expect(resolveDecisionFromKey("d")).toBe("downgrade");
    expect(resolveDecisionFromKey("R")).toBe("review_later");
    expect(resolveDecisionFromKey("n")).toBe("not_mine");
    expect(resolveDecisionFromKey("u")).toBe("duplicate");
  });

  it("returns null for unsupported keys", () => {
    expect(resolveDecisionFromKey("x")).toBeNull();
    expect(resolveDecisionFromKey("0")).toBeNull();
    expect(resolveDecisionFromKey("ArrowRight")).toBeNull();
  });

  it("resolves metadata by decision id", () => {
    const decision = getDecisionById("downgrade");
    expect(decision.label).toBe("Downgrade");
    expect(decision.shortcut).toBe("d");
  });

  it("includes transparent rationale fields for each recommendation", () => {
    for (const card of MOCK_VALIDATION_CARDS) {
      expect(card.recommendationReason.summary.trim().length).toBeGreaterThan(0);
      expect(card.recommendationReason.evidence.length).toBeGreaterThan(0);
      for (const signal of card.recommendationReason.evidence) {
        expect(signal.trim().length).toBeGreaterThan(0);
      }
      expect(card.recommendationReason.confidenceNote.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes transaction history for expandable card evidence", () => {
    for (const card of MOCK_VALIDATION_CARDS) {
      expect(card.transactionHistory.length).toBeGreaterThan(0);
      for (const txn of card.transactionHistory) {
        expect(txn.id.trim().length).toBeGreaterThan(0);
        expect(txn.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Math.abs(txn.amountCents)).toBeGreaterThan(0);
        expect(txn.accountLabel.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("provides merge targets when a card can be marked duplicate", () => {
    const cardWithMergeTargets = MOCK_VALIDATION_CARDS.find((card) => (card.duplicateMergeTargets?.length ?? 0) > 0);
    expect(cardWithMergeTargets).toBeDefined();
    for (const target of cardWithMergeTargets?.duplicateMergeTargets ?? []) {
      expect(target.cardId.trim().length).toBeGreaterThan(0);
      expect(target.merchant.trim().length).toBeGreaterThan(0);
      expect(target.reason.trim().length).toBeGreaterThan(0);
    }
  });
});
