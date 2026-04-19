import { NextResponse } from "next/server";
import { resolveAuthedUserId } from "@/lib/authed-user";
import {
  getPlaidClient,
  getPlaidCountryCodes,
  getPlaidEnvironment,
  getPlaidProducts,
  isPlaidConfigured,
} from "@/lib/plaid/client";
import { env } from "@/env";

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

  const client = getPlaidClient();
  const linkTokenResponse = await client.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: "SubSure",
    language: "en",
    country_codes: getPlaidCountryCodes(),
    products: getPlaidProducts(),
    webhook: env.PLAID_WEBHOOK_URL,
  });

  return NextResponse.json({
    linkToken: linkTokenResponse.data.link_token,
    expiration: linkTokenResponse.data.expiration,
    plaidEnvironment: getPlaidEnvironment(),
    ingestionMode: "plaid",
  });
}
