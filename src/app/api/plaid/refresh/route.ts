import { NextResponse } from "next/server";
import { resolveAuthedUserId } from "@/lib/authed-user";
import { isPlaidConfigured } from "@/lib/plaid/client";
import { refreshPlaidItemsForUser } from "@/lib/plaid/sync";

export async function POST() {
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

  const results = await refreshPlaidItemsForUser(userId);

  return NextResponse.json({
    refreshedItems: results.length,
    results,
  });
}
