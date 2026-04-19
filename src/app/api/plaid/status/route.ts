import { and, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { financialAccounts, plaidItems } from "@/db/schema";
import { resolveAuthedUserId } from "@/lib/authed-user";
import { getPlaidEnvironment, isPlaidConfigured } from "@/lib/plaid/client";

export async function GET() {
  const userId = await resolveAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plaidEnabled = isPlaidConfigured();
  if (!plaidEnabled) {
    return NextResponse.json({
      plaidEnabled,
      plaidEnvironment: getPlaidEnvironment(),
      ingestionMode: "manual",
      reason: "Plaid credentials are not configured",
    });
  }

  const [itemCountRows, reconnectRows, accountCountRows] = await Promise.all([
    db
      .select({ count: count() })
      .from(plaidItems)
      .where(and(eq(plaidItems.userId, userId), eq(plaidItems.status, "active"))),
    db
      .select({ count: count() })
      .from(plaidItems)
      .where(and(eq(plaidItems.userId, userId), eq(plaidItems.status, "reconnect_required"))),
    db
      .select({ count: count() })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.userId, userId),
          sql`${financialAccounts.plaidItemId} is not null`,
        ),
      ),
  ]);

  const linkedItems = itemCountRows[0]?.count ?? 0;
  const reconnectRequiredItems = reconnectRows[0]?.count ?? 0;
  const linkedAccounts = accountCountRows[0]?.count ?? 0;

  return NextResponse.json({
    plaidEnabled,
    plaidEnvironment: getPlaidEnvironment(),
    ingestionMode: linkedItems > 0 ? "plaid" : "manual",
    linkedItems,
    reconnectRequiredItems,
    linkedAccounts,
    manualEntryAvailable: true,
  });
}
