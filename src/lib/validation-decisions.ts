import { z } from "zod";
import { VALIDATION_DECISIONS, type ValidationDecisionId, type ValidationHistoryEntry } from "@/lib/validation-queue";

const validationDecisionIds = VALIDATION_DECISIONS.map((decision) => decision.id) as [
  ValidationDecisionId,
  ...ValidationDecisionId[],
];

export const validationDecisionIdSchema = z.enum(validationDecisionIds);

export const createValidationDecisionSchema = z.object({
  cardId: z.string().trim().min(1).max(128),
  merchant: z.string().trim().min(1).max(200),
  decisionId: validationDecisionIdSchema,
  amountCents: z.number().int().nonnegative().nullable().optional(),
  cadence: z.enum(["monthly", "annual"]).nullable().optional(),
  decidedAtIso: z.string().datetime({ offset: true }).optional(),
  subscriptionCandidateId: z.string().trim().min(1).max(128).optional(),
  mergeIntoCardId: z.string().trim().min(1).max(128).nullable().optional(),
});

export const listValidationDecisionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateValidationDecisionInput = z.infer<typeof createValidationDecisionSchema>;

export type ValidationDecisionRecord = {
  id: string;
  cardId: string;
  merchant: string;
  decisionId: ValidationDecisionId;
  amountCents: number | null;
  cadence: "monthly" | "annual" | null;
  decidedAtIso: string;
  subscriptionCandidateId: string | null;
  mergeIntoCardId: string | null;
};

export function toValidationHistoryEntry(record: ValidationDecisionRecord): ValidationHistoryEntry {
  return {
    cardId: record.cardId,
    merchant: record.merchant,
    decisionId: record.decisionId,
    decidedAtIso: record.decidedAtIso,
    mergeIntoCardId: record.mergeIntoCardId,
  };
}
