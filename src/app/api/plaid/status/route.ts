import { and, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { financialAccounts, plaidItems } from "@/db/schema";
import { resolveAuthedUserId } from "@/lib/authed-user";
import { getPlaidEnvironment, isPlaidConfigured } from "@/lib/plaid/client";

function buildDisconnectedPayload(reason?: string) {
  return {
    plaidEnabled: isPlaidConfigured(),
    plaidEnvironment: getPlaidEnvironment(),
    ingestionMode: "manual" as const,
    linkedItems: 0,
    reconnectRequiredItems: 0,
    linkedAccounts: 0,
    manualEntryAvailable: true,
    ...(reason ? { reason } : {}),
  };
}

export async function GET() {
  try {
    const userId = await resolveAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const plaidEnabled = isPlaidConfigured();
    if (!plaidEnabled) {
      return NextResponse.json(
        buildDisconnectedPayload("Plaid credentials are not configured"),
      );
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

    const linkedItems = Number(itemCountRows[0]?.count ?? 0);
    const reconnectRequiredItems = Number(reconnectRows[0]?.count ?? 0);
    const linkedAccounts = Number(accountCountRows[0]?.count ?? 0);

    return NextResponse.json({
      plaidEnabled,
      plaidEnvironment: getPlaidEnvironment(),
      ingestionMode: linkedItems > 0 ? "plaid" : "manual",
      linkedItems,
      reconnectRequiredItems,
      linkedAccounts,
      manualEntryAvailable: true,
    });
  } catch (error) {
    console.error("[api/plaid/status] Falling back to disconnected payload", error);
    return NextResponse.json(
      buildDisconnectedPayload("Plaid status is temporarily unavailable"),
    );
  }
}
