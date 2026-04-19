import { z } from "zod";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { plaidItems } from "@/db/schema";
import { isPlaidConfigured } from "@/lib/plaid/client";
import { markPlaidItemReauthRequired, syncTransactionsForPlaidItem } from "@/lib/plaid/sync";

const PlaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string().optional(),
  error: z
    .object({
      error_type: z.string().optional(),
      error_code: z.string().optional(),
      error_message: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Plaid not configured" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = PlaidWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    webhook_type: webhookType,
    webhook_code: webhookCode,
    item_id: itemId,
    error,
  } = parsed.data;
  if (!itemId) return NextResponse.json({ ok: true, ignored: true });

  const itemRows = await db
    .select({
      userId: plaidItems.userId,
      plaidItemId: plaidItems.plaidItemId,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.transactionsCursor,
    })
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, itemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) return NextResponse.json({ ok: true, ignored: true });

  if (webhookType === "ITEM" && (webhookCode === "ERROR" || webhookCode === "PENDING_EXPIRATION")) {
    await markPlaidItemReauthRequired({
      plaidItemId: item.plaidItemId,
      webhookCode,
      errorCode: error?.error_code,
      errorType: error?.error_type,
      errorMessage: error?.error_message,
    });

    return NextResponse.json({ ok: true, status: "reconnect_required" });
  }

  if (
    webhookType === "TRANSACTIONS" &&
    ["DEFAULT_UPDATE", "INITIAL_UPDATE", "HISTORICAL_UPDATE"].includes(webhookCode)
  ) {
    const result = await syncTransactionsForPlaidItem({
      userId: item.userId,
      plaidItemId: item.plaidItemId,
      accessToken: item.accessToken,
      initialCursor: item.cursor,
    });

    return NextResponse.json({ ok: true, sync: result });
  }

  await db
    .update(plaidItems)
    .set({
      lastWebhookCode: `${webhookType}:${webhookCode}`,
      updatedAt: new Date(),
    })
    .where(and(eq(plaidItems.userId, item.userId), eq(plaidItems.plaidItemId, item.plaidItemId)));

  return NextResponse.json({ ok: true, ignored: true });
}
