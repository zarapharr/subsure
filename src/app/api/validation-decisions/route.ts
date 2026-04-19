import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { subscriptionCandidates, validationDecisions } from "@/db/schema";
import { resolveAuthedUserId } from "@/lib/authed-user";
import {
  createValidationDecisionSchema,
  listValidationDecisionsQuerySchema,
  type ValidationDecisionRecord,
} from "@/lib/validation-decisions";
import type { ValidationDecisionId } from "@/lib/validation-queue";

const INACTIVE_DECISIONS = new Set<ValidationDecisionId>(["cancel", "not_mine", "duplicate"]);

function toRecord(row: {
  id: string;
  cardId: string;
  merchant: string;
  decisionId: string;
  amountCents: number | null;
  cadence: string | null;
  decidedAt: Date;
  subscriptionCandidateId: string | null;
  mergeIntoCardId: string | null;
}): ValidationDecisionRecord {
  return {
    id: row.id,
    cardId: row.cardId,
    merchant: row.merchant,
    decisionId: row.decisionId as ValidationDecisionId,
    amountCents: row.amountCents,
    cadence: (row.cadence as "monthly" | "annual" | null) ?? null,
    decidedAtIso: row.decidedAt.toISOString(),
    subscriptionCandidateId: row.subscriptionCandidateId,
    mergeIntoCardId: row.mergeIntoCardId,
  };
}

export async function GET(request: Request) {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedQuery = listValidationDecisionsQuerySchema.safeParse({
    limit: new URL(request.url).searchParams.get("limit") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: validationDecisions.id,
      cardId: validationDecisions.cardId,
      merchant: validationDecisions.merchant,
      decisionId: validationDecisions.decisionId,
      amountCents: validationDecisions.amountCents,
      cadence: validationDecisions.cadence,
      decidedAt: validationDecisions.decidedAt,
      subscriptionCandidateId: validationDecisions.subscriptionCandidateId,
      mergeIntoCardId: validationDecisions.mergeIntoCardId,
    })
    .from(validationDecisions)
    .where(eq(validationDecisions.userId, userId))
    .orderBy(desc(validationDecisions.decidedAt))
    .limit(parsedQuery.data.limit);

  return NextResponse.json({
    decisions: rows.map(toRecord),
  });
}

export async function POST(request: Request) {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsedBody = createValidationDecisionSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = parsedBody.data;
  const decidedAt = input.decidedAtIso ? new Date(input.decidedAtIso) : new Date();

  const inserted = await db
    .insert(validationDecisions)
    .values({
      userId,
      subscriptionCandidateId: input.subscriptionCandidateId ?? null,
      cardId: input.cardId,
      merchant: input.merchant,
      decisionId: input.decisionId,
      amountCents: input.amountCents ?? null,
      cadence: input.cadence ?? null,
      mergeIntoCardId: input.mergeIntoCardId ?? null,
      decidedAt,
    })
    .returning({
      id: validationDecisions.id,
      cardId: validationDecisions.cardId,
      merchant: validationDecisions.merchant,
      decisionId: validationDecisions.decisionId,
      amountCents: validationDecisions.amountCents,
      cadence: validationDecisions.cadence,
      decidedAt: validationDecisions.decidedAt,
      subscriptionCandidateId: validationDecisions.subscriptionCandidateId,
      mergeIntoCardId: validationDecisions.mergeIntoCardId,
    });

  const persisted = inserted[0];
  if (!persisted) {
    return NextResponse.json({ error: "Failed to persist decision" }, { status: 500 });
  }

  if (input.subscriptionCandidateId) {
    await db
      .update(subscriptionCandidates)
      .set({
        isActive: !INACTIVE_DECISIONS.has(input.decisionId),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionCandidates.id, input.subscriptionCandidateId),
          eq(subscriptionCandidates.userId, userId),
        ),
      );
  }

  return NextResponse.json(
    {
      decision: toRecord(persisted),
    },
    { status: 201 },
  );
}
