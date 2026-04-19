import { NextResponse } from "next/server";
import { env } from "@/env";
import { isPlaidConfigured } from "@/lib/plaid/client";
import { refreshAllPlaidItems } from "@/lib/plaid/sync";

function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = env.PLAID_REFRESH_CRON_SECRET;
  if (!configuredSecret) return true;

  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const fallbackHeader = request.headers.get("x-cron-secret") ?? "";

  return bearerToken === configuredSecret || fallbackHeader === configuredSecret;
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  if (!isPlaidConfigured()) {
    return NextResponse.json({
      refreshedItems: 0,
      skipped: true,
      reason: "Plaid credentials are not configured",
    });
  }

  const results = await refreshAllPlaidItems();
  const reconnectRequiredCount = results.filter(
    (item) => item.status === "reconnect_required",
  ).length;
  const errorCount = results.filter((item) => item.status === "error").length;

  return NextResponse.json({
    refreshedItems: results.length,
    reconnectRequiredCount,
    errorCount,
    results,
  });
}

export const GET = POST;
