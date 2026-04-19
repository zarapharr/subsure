import { z } from "zod";
import { NextResponse } from "next/server";
import { resolveAuthedUserId } from "@/lib/authed-user";
import { isPlaidConfigured } from "@/lib/plaid/client";
import { linkPlaidItemAndImportTransactions } from "@/lib/plaid/sync";

const ExchangePublicTokenSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const userId = await resolveAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPlaidConfigured()) {
    return NextResponse.json(
      {
        error: "Plaid is not configured",
        ingestionMode: "manual",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = ExchangePublicTokenSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await linkPlaidItemAndImportTransactions({
    userId,
    publicToken: parsed.data.publicToken,
    institutionName: parsed.data.institutionName,
  });

  return NextResponse.json({
    itemId: result.plaidItemId,
    accountsUpserted: result.accountsUpserted,
    transactionsUpserted: result.transactionsUpserted,
    transactionsRemoved: result.transactionsRemoved,
    status: result.status,
  });
}
